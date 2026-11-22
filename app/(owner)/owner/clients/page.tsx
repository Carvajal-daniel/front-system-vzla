"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeInTimezone, formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import { useClients, type ClientRecord } from "@/lib/use-clients";

function getClientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export default function ClientsPage() {
  const { session } = useSession();
  const { locale } = useLocale();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";
  const companyId = session.company.id;

  const { clients, loading, createClient, refresh } = useClients(companyId);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "DEBT" | "BLOCKED" | "ACTIVE">("ALL");
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);

  const searchParams = useSearchParams();
  const actionParam = searchParams.get("action");

  useEffect(() => {
    if (actionParam === "new-client") {
      setNewClientModalOpen(true);
    }
  }, [actionParam]);

  // Formulário de novo cliente
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    birthDate: "",
    document: "",
    notes: "",
  });

  // Filtra clientes por texto e categoria
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

    return clients.filter((c) => {
      // Busca por nome ou telefone
      if (q) {
        const matchName = c.name.toLowerCase().includes(q);
        const matchPhone = c.phone.replace(/\D/g, "").includes(q.replace(/\D/g, ""));
        if (!matchName && !matchPhone) return false;
      }

      // Filtro de tipo
      if (filterType === "DEBT") return c.pendingDebtCents > 0;
      if (filterType === "BLOCKED") return c.isBlocked;
      if (filterType === "ACTIVE") {
        return c.lastVisitAt ? new Date(c.lastVisitAt) >= thirtyDaysAgo : false;
      }

      return true;
    });
  }, [clients, search, filterType]);

  // KPIs da carteira de clientes
  const kpis = useMemo(() => {
    const totalClients = clients.length;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

    let activeMonth = 0;
    let totalDebtCents = 0;

    for (const c of clients) {
      if (c.lastVisitAt && new Date(c.lastVisitAt) >= thirtyDaysAgo) {
        activeMonth += 1;
      }
      totalDebtCents += c.pendingDebtCents;
    }

    return { totalClients, activeMonth, totalDebtCents };
  }, [clients]);

  // Exportação CSV
  const handleExportCsv = () => {
    if (filteredClients.length === 0) {
      toast.warning("Nenhum cliente para exportar.");
      return;
    }

    const headers = [
      "Nome",
      "Telefone",
      "Email",
      "Documento (CPF / C.I.)",
      "Total de Visitas",
      "Faltas",
      "Total Gasto (R$)",
      "Saldo Devedor (R$)",
      "Status",
    ];

    const rows = filteredClients.map((c) => {
      return [
        `"${c.name.replace(/"/g, '""')}"`,
        `"${c.phone}"`,
        `"${c.email || ""}"`,
        `"${c.document || ""}"`,
        c.totalVisits,
        c.noShows,
        (c.totalSpentCents / 100).toFixed(2),
        (c.pendingDebtCents / 100).toFixed(2),
        c.isBlocked ? "Bloqueado" : "Ativo",
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `clientes_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Lista de clientes exportada com sucesso!");
  };

  // Criação de cliente
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (!formData.phone.trim()) {
      toast.error("Informe o telefone do cliente.");
      return;
    }

    createClient({
      name: formData.name,
      phone: formData.phone,
      email: formData.email,
      birthDate: formData.birthDate,
      document: formData.document,
      notes: formData.notes,
    });

    toast.success("Cliente cadastrado com sucesso!");
    setFormData({ name: "", phone: "", email: "", birthDate: "", document: "", notes: "" });
    setNewClientModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Users className="size-6 text-accent" />
            Base de Clientes
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Gestão completa da carteira de clientes, histórico de visitas e controle de inadimplência.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || filteredClients.length === 0}
            className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3.5 py-2 text-xs font-semibold text-ink hover:border-accent transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Download size={14} />
            Salvar em CSV
          </button>

          <button
            type="button"
            onClick={() => setNewClientModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors cursor-pointer shadow-xs"
          >
            <Plus size={14} />
            Novo Cliente
          </button>

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 3 KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Total de Clientes
          </span>
          <div className="mt-2 text-3xl font-bold text-ink">{kpis.totalClients}</div>
          <p className="mt-1 text-xs text-ink-muted">Clientes cadastrados na base</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
            Clientes Ativos no Mês
          </span>
          <div className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {kpis.activeMonth}
          </div>
          <p className="mt-1 text-xs text-ink-muted">Atendidos nos últimos 30 dias</p>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 shadow-xs">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
            Total em Débitos (Fiado)
          </span>
          <div className="mt-2 text-3xl font-bold text-rose-600 dark:text-rose-400">
            <SensitiveValue>
              {formatPriceFromCents(kpis.totalDebtCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Cobranças em aberto a receber</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64 sm:w-72">
            <Search className="absolute left-3 top-2.5 size-4 text-ink-muted" />
            <input
              type="text"
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border-subtle bg-canvas/40 pl-9 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterType("ALL")}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                filterType === "ALL"
                  ? "bg-accent text-accent-ink font-semibold"
                  : "text-ink-secondary hover:text-ink hover:bg-canvas/50"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFilterType("ACTIVE")}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                filterType === "ACTIVE"
                  ? "bg-accent text-accent-ink font-semibold"
                  : "text-ink-secondary hover:text-ink hover:bg-canvas/50"
              }`}
            >
              Ativos no Mês
            </button>
            <button
              type="button"
              onClick={() => setFilterType("DEBT")}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                filterType === "DEBT"
                  ? "bg-rose-500 text-white font-semibold"
                  : "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              }`}
            >
              Com Débito / Fiado
            </button>
            <button
              type="button"
              onClick={() => setFilterType("BLOCKED")}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                filterType === "BLOCKED"
                  ? "bg-ink text-canvas font-semibold"
                  : "text-ink-secondary hover:text-ink hover:bg-canvas/50"
              }`}
            >
              Bloqueados
            </button>
          </div>
        </div>

        <span className="text-xs text-ink-muted">{filteredClients.length} cliente(s)</span>
      </div>

      {/* Tabela de Clientes */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="mt-3 text-xs text-ink-muted">Consolidando carteira de clientes...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted">
            Nenhum cliente encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Última Visita</th>
                  <th className="py-3 px-4">Visitas / Faltas</th>
                  <th className="py-3 px-4">Total Gasto</th>
                  <th className="py-3 px-4">Saldo Devedor</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredClients.map((client) => {
                  const digits = client.phone.replace(/\D/g, "");
                  const waLink = digits ? `https://wa.me/55${digits}` : null;
                  const lastVisitStr = client.lastVisitAt
                    ? formatDateTimeInTimezone(client.lastVisitAt, timezone, locale).split(" ")[0]
                    : "Sem histórico";

                  return (
                    <tr key={client.id} className="hover:bg-canvas/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="grid size-8 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent shrink-0">
                            {getClientInitials(client.name)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/owner/clients/${client.id}`}
                                className="font-semibold text-ink hover:text-accent hover:underline truncate"
                              >
                                {client.name}
                              </Link>
                              {client.isBlocked && (
                                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                  <ShieldAlert size={10} />
                                  Bloqueado
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-ink-muted font-mono">{client.phone}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-ink-secondary">
                        {lastVisitStr}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-medium text-ink">{client.totalVisits} visitas</span>
                        {client.noShows > 0 && (
                          <span className="ml-1.5 text-rose-500 font-semibold">
                            ({client.noShows} faltas)
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-medium text-ink">
                        <SensitiveValue>
                          {formatPriceFromCents(client.totalSpentCents, locale, currency)}
                        </SensitiveValue>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-bold">
                        {client.pendingDebtCents > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            <SensitiveValue>
                              {formatPriceFromCents(client.pendingDebtCents, locale, currency)}
                            </SensitiveValue>
                          </span>
                        ) : (
                          <span className="text-ink-muted font-normal">R$ 0,00</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-grid size-7 place-items-center rounded-lg border border-border-subtle bg-surface text-emerald-600 hover:border-emerald-500 transition-colors"
                            title="Conversar no WhatsApp"
                          >
                            <MessageCircle size={13} />
                          </a>
                        )}

                        <Link
                          href={`/owner/clients/${client.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-border-subtle bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:border-accent transition-colors"
                        >
                          Ficha
                          <ExternalLink size={11} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Novo Cliente */}
      {newClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <UserPlus size={18} className="text-accent" />
                Cadastrar Novo Cliente
              </h3>
              <button
                type="button"
                onClick={() => setNewClientModalOpen(false)}
                className="text-ink-muted hover:text-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-ink-secondary mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Maria Silva"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1">Telefone / WhatsApp *</label>
                <input
                  type="text"
                  required
                  placeholder="(11) 99999-9999"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="cliente@exemplo.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">Nascimento</label>
                  <input
                    type="date"
                    value={formData.birthDate}
                    onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1">CPF / C.I.</label>
                <input
                  type="text"
                  placeholder="000.000.000-00 ou V-12.345.678"
                  value={formData.document}
                  onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="block font-semibold text-ink-secondary mb-1">
                  Observações / Anamnese Inicial
                </label>
                <textarea
                  rows={2}
                  placeholder="Tipo de cabelo, alergias, restrições ou preferências..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setNewClientModalOpen(false)}
                  className="rounded-xl border border-border-subtle px-4 py-2 text-xs font-semibold text-ink hover:bg-canvas transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
