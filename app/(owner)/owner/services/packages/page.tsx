"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  Clock,
  Edit2,
  Package,
  Plus,
  Power,
  Search,
  ShoppingCart,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone, formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import type { Service } from "@/lib/types/service";
import { useClients } from "@/lib/use-clients";
import {
  useServiceCatalogMeta,
  type ServicePackage,
  type SoldPackageRecord,
} from "@/lib/use-service-catalog-meta";

export default function ServicePackagesPage() {
  const { session } = useSession();
  const { locale } = useLocale();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";
  const companyId = session.company.id;

  const {
    packages,
    addPackage,
    updatePackage,
    deletePackage,
    soldPackages,
    sellPackage,
    deductSession,
  } = useServiceCatalogMeta(companyId);

  const { clients } = useClients(companyId);

  const [services, setServices] = useState<Service[]>([]);
  const [activeTab, setActiveTab] = useState<"packages" | "sold">("packages");

  // Modal Novo Pacote
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<ServicePackage | null>(null);
  const [pkgName, setPkgName] = useState("");
  const [pkgDesc, setPkgDesc] = useState("");
  const [pkgSessions, setPkgSessions] = useState(4);
  const [pkgPriceReais, setPkgPriceReais] = useState("150.00");
  const [pkgValidity, setPkgValidity] = useState(30);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // Modal Venda de Pacote
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [selectedPkgForSale, setSelectedPkgForSale] = useState<ServicePackage | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");

  useEffect(() => {
    apiRequest<Service[]>("/services")
      .then((res) => setServices(res))
      .catch(() => setServices([]));
  }, []);

  const handleOpenCreate = () => {
    setEditingPackage(null);
    setPkgName("");
    setPkgDesc("");
    setPkgSessions(4);
    setPkgPriceReais("150.00");
    setPkgValidity(30);
    setSelectedServiceIds(services[0] ? [services[0].id] : []);
    setModalOpen(true);
  };

  const handleOpenEdit = (pkg: ServicePackage) => {
    setEditingPackage(pkg);
    setPkgName(pkg.name);
    setPkgDesc(pkg.description || "");
    setPkgSessions(pkg.totalSessions);
    setPkgPriceReais((pkg.priceInCents / 100).toFixed(2));
    setPkgValidity(pkg.validityDays);
    setSelectedServiceIds(pkg.serviceIds || []);
    setModalOpen(true);
  };

  const handleSavePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgName.trim()) {
      toast.error("Informe o nome do pacote.");
      return;
    }

    const priceCents = Math.round(parseFloat(pkgPriceReais.replace(",", ".")) * 100) || 0;
    const serviceNames = services
      .filter((s) => selectedServiceIds.includes(s.id))
      .map((s) => s.name);

    if (editingPackage) {
      updatePackage(editingPackage.id, {
        name: pkgName.trim(),
        description: pkgDesc.trim() || undefined,
        totalSessions: pkgSessions,
        priceInCents: priceCents,
        validityDays: pkgValidity,
        serviceIds: selectedServiceIds,
        serviceNames,
      });
      toast.success("Pacote atualizado com sucesso!");
    } else {
      addPackage({
        name: pkgName.trim(),
        description: pkgDesc.trim() || undefined,
        totalSessions: pkgSessions,
        priceInCents: priceCents,
        validityDays: pkgValidity,
        serviceIds: selectedServiceIds,
        serviceNames,
        active: true,
      });
      toast.success("Novo pacote criado com sucesso!");
    }

    setModalOpen(false);
  };

  const handleOpenSell = (pkg: ServicePackage) => {
    setSelectedPkgForSale(pkg);
    setSelectedClientId(clients[0]?.id || "");
    setSellModalOpen(true);
  };

  const handleConfirmSell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPkgForSale || !selectedClientId) return;

    const client = clients.find((c) => c.id === selectedClientId);
    if (!client) {
      toast.error("Selecione um cliente válido.");
      return;
    }

    sellPackage(selectedPkgForSale, {
      id: client.id,
      name: client.name,
      phone: client.phone,
    });

    toast.success(`Pacote "${selectedPkgForSale.name}" vinculado a ${client.name}!`);
    setSellModalOpen(false);
    setActiveTab("sold");
  };

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div className="flex items-center justify-between">
        <Link
          href="/owner/services"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} />
          Voltar para Serviços
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Boxes className="size-6 text-accent" />
            Pacotes de Sessões e Combos
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Venda planos pré-pagos (ex: 4 cortes no mês) e controle o saldo de sessões dos seus
            clientes.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
        >
          <Plus size={14} />
          Novo Pacote
        </button>
      </div>

      {/* Abas */}
      <div className="space-y-4">
        <div className="flex border-b border-border-subtle gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("packages")}
            className={`pb-3 px-1 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "packages"
                ? "border-b-2 border-accent text-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Boxes size={14} />
            Catálogo de Pacotes ({packages.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("sold")}
            className={`pb-3 px-1 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === "sold"
                ? "border-b-2 border-accent text-accent"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <ShoppingCart size={14} />
            Sessões Vendidas / Clientes ({soldPackages.length})
          </button>
        </div>

        {/* Aba 1: Catálogo de Pacotes */}
        {activeTab === "packages" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packages.length === 0 ? (
              <div className="col-span-full py-16 text-center text-xs text-ink-muted rounded-2xl border border-border-subtle bg-surface">
                Nenhum pacote promocional cadastrado ainda. Clique em "+ Novo Pacote" para criar.
              </div>
            ) : (
              packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-ink text-base">{pkg.name}</h3>
                      <button
                        type="button"
                        onClick={() => {
                          updatePackage(pkg.id, { active: !pkg.active });
                          toast.info(pkg.active ? "Pacote desativado." : "Pacote ativado.");
                        }}
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold border transition-colors ${
                          pkg.active
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : "bg-slate-500/10 text-slate-500 border-slate-500/20"
                        }`}
                      >
                        {pkg.active ? "Ativo" : "Inativo"}
                      </button>
                    </div>

                    <p className="text-xs text-ink-muted">
                      {pkg.description || "Combo promocional de procedimentos."}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-ink-secondary pt-2">
                      <span className="font-semibold text-accent">
                        {pkg.totalSessions} sessões inclusas
                      </span>
                      <span>·</span>
                      <span>Validade: {pkg.validityDays} dias</span>
                    </div>

                    <div className="pt-2 text-xl font-bold text-ink">
                      <SensitiveValue>
                        {formatPriceFromCents(pkg.priceInCents, locale, currency)}
                      </SensitiveValue>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border-subtle pt-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenSell(pkg)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs"
                    >
                      <ShoppingCart size={13} />
                      Vender Pacote
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(pkg)}
                        className="rounded-lg border border-border-subtle bg-surface p-1.5 text-ink-secondary hover:text-ink hover:border-accent transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Excluir o pacote "${pkg.name}"?`)) {
                            deletePackage(pkg.id);
                            toast.success("Pacote excluído!");
                          }
                        }}
                        className="rounded-lg border border-border-subtle bg-surface p-1.5 text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Aba 2: Sessões Vendidas */}
        {activeTab === "sold" && (
          <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
            {soldPackages.length === 0 ? (
              <div className="py-16 text-center text-xs text-ink-muted">
                Nenhum pacote vendido registrado ainda.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                    <tr>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Pacote Adquirido</th>
                      <th className="py-3 px-4">Sessões Restantes</th>
                      <th className="py-3 px-4">Expiração</th>
                      <th className="py-3 px-4 text-right">Ação de Abatimento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {soldPackages.map((item) => {
                      const remaining = item.totalSessions - item.usedSessions;
                      const isComplete = remaining <= 0;
                      const expiresDate = formatDateTimeInTimezone(
                        item.expiresAt,
                        timezone,
                        locale,
                      ).split(" ")[0];

                      return (
                        <tr key={item.id} className="hover:bg-canvas/30 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-semibold text-ink">{item.clientName}</p>
                            <p className="text-[11px] text-ink-muted font-mono">
                              {item.clientPhone}
                            </p>
                          </td>

                          <td className="py-3 px-4 font-medium text-ink">{item.packageName}</td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                                isComplete
                                  ? "bg-slate-500/10 text-slate-500"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              }`}
                            >
                              {item.usedSessions} de {item.totalSessions} usadas
                            </span>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap text-ink-secondary">
                            Vence em {expiresDate}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              disabled={isComplete}
                              onClick={() => {
                                deductSession(item.id);
                                toast.success(
                                  `1 Sessão abatida para ${item.clientName}! Restam ${
                                    remaining - 1
                                  }.`,
                                );
                              }}
                              className="rounded-xl bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-40 transition-colors cursor-pointer shadow-xs"
                            >
                              {isComplete ? "Pacote Esgotado" : "Abater 1 Sessão"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Criar / Editar Pacote */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <Boxes size={18} className="text-accent" />
                {editingPackage ? "Editar Pacote" : "Novo Pacote de Sessões"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-ink-muted hover:text-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePackage} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-ink-secondary mb-1">
                  Nome do Pacote *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 4 Cortes no Mês, Combo Barba + Cabelo 4x"
                  value={pkgName}
                  onChange={(e) => setPkgName(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1">Descrição</label>
                <textarea
                  rows={2}
                  placeholder="Detalhes ou condições do pacote..."
                  value={pkgDesc}
                  onChange={(e) => setPkgDesc(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">
                    Qtd Sessões *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    required
                    value={pkgSessions}
                    onChange={(e) => setPkgSessions(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">
                    Preço Total (R$) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="150.00"
                    value={pkgPriceReais}
                    onChange={(e) => setPkgPriceReais(e.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">
                    Validade (Dias) *
                  </label>
                  <input
                    type="number"
                    min={7}
                    max={365}
                    required
                    value={pkgValidity}
                    onChange={(e) => setPkgValidity(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-border-subtle px-4 py-2 text-xs font-semibold text-ink hover:bg-canvas transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors"
                >
                  Salvar Pacote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Vender Pacote */}
      {sellModalOpen && selectedPkgForSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <ShoppingCart size={18} className="text-accent" />
                Vender Pacote: {selectedPkgForSale.name}
              </h3>
              <button
                type="button"
                onClick={() => setSellModalOpen(false)}
                className="text-ink-muted hover:text-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmSell} className="space-y-3 text-xs">
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 space-y-1">
                <div className="flex justify-between font-bold text-ink">
                  <span>Valor do Pacote:</span>
                  <span>{formatPriceFromCents(selectedPkgForSale.priceInCents, locale, currency)}</span>
                </div>
                <p className="text-[11px] text-ink-muted">
                  {selectedPkgForSale.totalSessions} sessões · Válido por {selectedPkgForSale.validityDays} dias
                </p>
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1">
                  Selecionar Cliente *
                </label>
                <select
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                >
                  <option value="">Selecione um cliente...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setSellModalOpen(false)}
                  className="rounded-xl border border-border-subtle px-4 py-2 text-xs font-semibold text-ink hover:bg-canvas transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs"
                >
                  Confirmar Venda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
