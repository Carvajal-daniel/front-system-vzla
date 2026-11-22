"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Gift,
  Heart,
  Loader2,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import type { Appointment } from "@/lib/types/appointment";
import type { AppointmentCollections, PaymentMethod } from "@/lib/types/finance";
import type { InventoryItem } from "@/lib/types/inventory";
import type { Service } from "@/lib/types/service";
import type { Collaborator } from "@/lib/types/team";
import { useClients } from "@/lib/use-clients";
import { useLoyalty } from "@/lib/use-loyalty";

/**
 * Normaliza respostas da API para sempre retornar um array válido,
 * mesmo quando o backend envelopa a lista em chaves como services, items, collaborators ou appointments.
 */
function normalizeApiArray<T>(res: unknown, keys: string[]): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object") {
    const record = res as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(record[key])) {
        return record[key] as T[];
      }
    }
  }
  return [];
}

/**
 * Extrai um objeto de agendamento de respostas diretas ou envelopadas.
 */
function normalizeAppointment(res: unknown): Partial<Appointment> | null {
  if (!res || typeof res !== "object") return null;
  const record = res as Record<string, unknown>;
  const candidate =
    record.appointment && typeof record.appointment === "object"
      ? (record.appointment as Partial<Appointment>)
      : (record as Partial<Appointment>);
  return candidate.id ? candidate : null;
}

interface OrderLineItem {
  id: string;
  type: "SERVICE" | "PRODUCT" | "TIP";
  itemId: string;
  name: string;
  collaboratorId: string;
  quantity: number;
  unitPriceCents: number;
  commissionPercentage: number;
  subtotalCents: number;
}

interface OrderPaymentEntry {
  id: string;
  method: PaymentMethod;
  amountCents: number;
}

export default function NewOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");

  const { session } = useSession();
  const { locale, t } = useLocale();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";
  const companyId = session.company.id;

  const { clients, createClient } = useClients(companyId);
  const { program, getClientLoyalty, addPoints } = useLoyalty(companyId);

  // Dados do Catálogo
  const [services, setServices] = useState<Service[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // Informações da Comanda (Coluna Esquerda)
  const [orderCode] = useState(() => `COM-${Date.now().toString().slice(-6)}`);
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientDdi, setClientDdi] = useState<"+55" | "+58">("+55");
  const [clientEmail, setClientEmail] = useState("");
  const [clientDocument, setClientDocument] = useState("");
  const [showAddress, setShowAddress] = useState(false);
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [orderStatus, setOrderStatus] = useState<"OPEN" | "CLOSED">("OPEN");

  // Itens da Comanda (Bloco Inferior)
  const [items, setItems] = useState<OrderLineItem[]>([]);

  // Pagamento & Desconto (Coluna Direita)
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENT">("FIXED");
  const [discountValue, setDiscountValue] = useState("");
  const [payments, setPayments] = useState<OrderPaymentEntry[]>([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>("PIX");
  const [paymentAmountInput, setPaymentAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Carrega Catálogo e Pré-preenche se vier de um agendamento
  useEffect(() => {
    let active = true;
    setLoadingCatalog(true);

    const applyAppointmentToOrder = (
      app: Partial<Appointment>,
      fallbackServices: Service[],
      fallbackCollabs: Collaborator[],
    ) => {
      const safeName = typeof app.clientName === "string" ? app.clientName : "";
      const safePhone = typeof app.clientPhone === "string" ? app.clientPhone : "";
      setClientName(safeName);
      setClientPhone(safePhone);
      setClientSearch(safeName);

      const matchedService = fallbackServices.find((s) => s.id === app.serviceId);
      const serviceId = app.serviceId || matchedService?.id || "";
      const serviceName = app.serviceNameSnapshot || matchedService?.name || "Serviço";
      const unitPriceCents =
        typeof app.servicePriceInCentsSnapshot === "number"
          ? app.servicePriceInCentsSnapshot
          : (matchedService?.priceInCents ?? 0);
      const collaboratorId = app.collaboratorId || fallbackCollabs[0]?.id || "";
      const commissionPercentage =
        typeof app.commissionPercentageSnapshot === "number" && app.commissionPercentageSnapshot > 0
          ? app.commissionPercentageSnapshot
          : 50;

      // Adiciona o serviço do agendamento como item inicial sem quebrar caso algum campo venha nulo
      setItems([
        {
          id: `line_${Date.now()}`,
          type: "SERVICE",
          itemId: serviceId,
          name: serviceName,
          collaboratorId,
          quantity: 1,
          unitPriceCents,
          commissionPercentage,
          subtotalCents: unitPriceCents,
        },
      ]);
    };

    Promise.all([
      apiRequest<unknown>("/services").catch(() => []),
      apiRequest<unknown>("/collaborators").catch(() => []),
      apiRequest<unknown>("/inventory/items").catch(() => []),
    ])
      .then(async ([svcRes, colRes, invRes]) => {
        if (!active) return;

        const servicesList = normalizeApiArray<Service>(svcRes, ["services", "items"]);
        const collabsList = normalizeApiArray<Collaborator>(colRes, ["collaborators", "items"]);
        const invList = normalizeApiArray<InventoryItem>(invRes, ["items", "inventoryItems", "products"]);

        setServices(servicesList);
        setCollaborators(collabsList);
        setInventoryItems(invList);

        // Se veio de um agendamento específico, tenta carregamento individual com fallback para lista e resumo financeiro
        if (appointmentId) {
          const singleRes = await apiRequest<unknown>(
            `/appointments/${encodeURIComponent(appointmentId)}`,
          ).catch(() => null);
          const singleApp = normalizeAppointment(singleRes);

          if (!active) return;

          if (singleApp) {
            applyAppointmentToOrder(singleApp, servicesList, collabsList);
            return;
          }

          const listRes = await apiRequest<unknown>("/appointments").catch(() => []);
          const appointmentsList = normalizeApiArray<Appointment>(listRes, ["appointments", "items"]);
          const foundInList = appointmentsList.find((a) => a.id === appointmentId);

          if (!active) return;

          if (foundInList) {
            applyAppointmentToOrder(foundInList, servicesList, collabsList);
            return;
          }

          const financeApp = await apiRequest<AppointmentCollections>(
            `/finance/appointments/${encodeURIComponent(appointmentId)}`,
          ).catch(() => null);

          if (!active || !financeApp) return;

          const matchedByName = servicesList.find((s) => s.name === financeApp.serviceName);
          applyAppointmentToOrder(
            {
              id: financeApp.appointmentId,
              clientName: financeApp.clientName ?? "",
              clientPhone: "",
              serviceId: matchedByName?.id ?? "",
              serviceNameSnapshot: financeApp.serviceName ?? "Serviço",
              servicePriceInCentsSnapshot: financeApp.netInCents ?? 0,
              collaboratorId: collabsList[0]?.id ?? "",
              commissionPercentageSnapshot: 50,
            },
            servicesList,
            collabsList,
          );
        }
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });

    return () => {
      active = false;
    };
  }, [appointmentId]);

  const safeServices = Array.isArray(services) ? services : [];
  const safeCollaborators = Array.isArray(collaborators) ? collaborators : [];
  const safeInventoryItems = Array.isArray(inventoryItems) ? inventoryItems : [];

  // Autocomplete de Clientes
  const matchingClients = useMemo(() => {
    if (!clientSearch.trim()) return [];
    const q = clientSearch.trim().toLowerCase();
    return clients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, "").includes(q),
    );
  }, [clients, clientSearch]);

  const selectClient = (c: (typeof clients)[0]) => {
    setSelectedClientId(c.id);
    setClientName(c.name);
    setClientPhone(c.phone);
    setClientEmail(c.email || "");
    setClientDocument(c.document || "");
    setClientSearch(c.name);
  };

  // Cálculo de Valores
  const subtotalCents = useMemo(() => {
    return items.reduce((sum, item) => sum + item.subtotalCents, 0);
  }, [items]);

  const discountCents = useMemo(() => {
    const raw = parseFloat(discountValue.replace(",", ".")) || 0;
    if (discountType === "PERCENT") {
      return Math.round((subtotalCents * Math.min(100, Math.max(0, raw))) / 100);
    }
    return Math.round(raw * 100);
  }, [subtotalCents, discountType, discountValue]);

  const totalCents = Math.max(0, subtotalCents - discountCents);

  const totalPaidCents = useMemo(() => {
    return payments.reduce((sum, p) => sum + p.amountCents, 0);
  }, [payments]);

  const remainingCents = Math.max(0, totalCents - totalPaidCents);

  // Adicionar Linhas
  const handleAddServiceLine = () => {
    const defaultSvc = safeServices[0];
    const defaultCollab = safeCollaborators[0];
    if (!defaultSvc) return;

    setItems([
      ...items,
      {
        id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        type: "SERVICE",
        itemId: defaultSvc.id,
        name: defaultSvc.name,
        collaboratorId: defaultCollab?.id || "",
        quantity: 1,
        unitPriceCents: defaultSvc.priceInCents,
        commissionPercentage: 50,
        subtotalCents: defaultSvc.priceInCents,
      },
    ]);
  };

  const handleAddProductLine = () => {
    const defaultProd = safeInventoryItems[0];
    const defaultCollab = safeCollaborators[0];
    if (!defaultProd) return;

    setItems([
      ...items,
      {
        id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        type: "PRODUCT",
        itemId: defaultProd.id,
        name: defaultProd.name,
        collaboratorId: defaultCollab?.id || "",
        quantity: 1,
        unitPriceCents: defaultProd.salePriceCents || defaultProd.costPriceCents,
        commissionPercentage: 10,
        subtotalCents: defaultProd.salePriceCents || defaultProd.costPriceCents,
      },
    ]);
  };

  const handleAddTipLine = () => {
    const defaultCollab = safeCollaborators[0];
    setItems([
      ...items,
      {
        id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        type: "TIP",
        itemId: "tip",
        name: "Gorjeta para Profissional",
        collaboratorId: defaultCollab?.id || "",
        quantity: 1,
        unitPriceCents: 1000,
        commissionPercentage: 100,
        subtotalCents: 1000,
      },
    ]);
  };

  const handleRemoveLine = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
  };

  // Adicionar Pagamento
  const handleAddPayment = () => {
    const parsed = Math.round(parseFloat(paymentAmountInput.replace(",", ".")) * 100) || 0;
    const amount = parsed > 0 ? parsed : remainingCents;
    if (amount <= 0) return;

    setPayments([
      ...payments,
      {
        id: `pay_${Date.now()}`,
        method: selectedPaymentMethod,
        amountCents: amount,
      },
    ]);
    setPaymentAmountInput("");
  };

  const handleRemovePayment = (id: string) => {
    setPayments(payments.filter((p) => p.id !== id));
  };

  // Salvar Comanda Completa
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (items.length === 0) {
      toast.error("Adicione ao menos um serviço ou produto na comanda.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Se cliente não estiver cadastrado, cadastra automaticamente na base
      let targetClientId = selectedClientId;
      if (!targetClientId) {
        targetClientId = createClient({
          name: clientName,
          phone: clientPhone,
          email: clientEmail || undefined,
          document: clientDocument || undefined,
        });
      }

      // 2. Para cada produto vendido, dispara a saída no estoque (SALE_OUT)
      for (const item of items) {
        if (item.type === "PRODUCT" && item.itemId) {
          await apiRequest("/inventory/movements", {
            method: "POST",
            auth: true,
            body: {
              itemId: item.itemId,
              movementType: "SALE_OUT",
              quantity: item.quantity,
              notes: `Venda na comanda ${orderCode} (${clientName})`,
            },
          }).catch(() => null);
        }
      }

      // 3. Registra os pagamentos efetuados no caixa
      for (const p of payments) {
        await apiRequest("/finance/cash-movements", {
          method: "POST",
          auth: true,
          body: {
            amountCents: p.amountCents,
            method: p.method,
            type: "INCOME",
            description: `Recebimento da comanda ${orderCode} - ${clientName}`,
          },
        }).catch(() => null);
      }

      // 4. Se o programa de fidelidade estiver ativo, pontua o cliente
      if (program.autoPointOnCompletion && targetClientId) {
        addPoints(targetClientId, 1, `Pontuação da comanda ${orderCode}`);
      }

      toast.success(
        `Comanda ${orderCode} finalizada com sucesso! Estoque e recebimentos atualizados.`,
      );
      router.push("/owner/finance");
    } catch {
      toast.error("Erro ao salvar a comanda.");
    } finally {
      setSubmitting(false);
    }
  };

  const clientLoyalty = selectedClientId ? getClientLoyalty(selectedClientId) : null;

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div className="flex items-center justify-between">
        <Link
          href="/owner/finance"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} />
          Voltar para Comandas
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Receipt className="size-6 text-accent" />
            Nova Comanda Completa
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Lançamento completo de serviços, produtos de estoque, comissões por profissional e
            quitação.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-sm font-bold text-accent">
          Código: {orderCode}
        </div>
      </div>

      <form onSubmit={handleSubmitOrder} className="space-y-6">
        {/* ======================================================== */}
        {/* PARTE SUPERIOR: 2 COLUNAS (INFORMAÇÕES + PAGAMENTO) */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Coluna Esquerda: Informações da Comanda (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-border-subtle pb-2">
              <User size={16} className="text-accent" />
              Informações da Comanda & Cliente
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Data da Comanda
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Status da Comanda
                </label>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value as "OPEN" | "CLOSED")}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink font-semibold"
                >
                  <option value="OPEN">Aberta (Aguardando quitação total)</option>
                  <option value="CLOSED">Fechada (Quitada ou Faturada)</option>
                </select>
                <p className="mt-1 text-[10px] text-ink-muted">
                  * Marcar "Fechada" libera a comissão dos profissionais no período.
                </p>
              </div>
            </div>

            {/* Busca e Autocomplete de Cliente */}
            <div className="relative">
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Cliente *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Buscar cliente na base ou digitar nome..."
                  value={clientName}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    setClientSearch(e.target.value);
                    setSelectedClientId("");
                  }}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
                <Search size={14} className="absolute right-3 top-2.5 text-ink-muted" />
              </div>

              {matchingClients.length > 0 && !selectedClientId && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-48 overflow-y-auto rounded-xl border border-border-subtle bg-surface p-1 shadow-lg text-xs space-y-0.5">
                  {matchingClients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClient(c)}
                      className="w-full text-left rounded-lg p-2 hover:bg-canvas/50 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-ink block">{c.name}</span>
                        <span className="text-[10px] text-ink-muted font-mono">{c.phone}</span>
                      </div>
                      {c.pendingDebtCents > 0 && (
                        <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">
                          Débito: {formatPriceFromCents(c.pendingDebtCents, locale, currency)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Telefone / WhatsApp
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={clientDdi}
                    onChange={(e) => setClientDdi(e.target.value as "+55" | "+58")}
                    className="w-24 rounded-xl border border-border-subtle bg-canvas/40 px-2 py-2 text-xs text-ink shrink-0"
                  >
                    <option value="+55">🇧🇷 +55</option>
                    <option value="+58">🇻🇪 +58</option>
                  </select>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  CPF / C.I.
                </label>
                <input
                  type="text"
                  placeholder="000.000.000-00 ou V-12.345.678"
                  value={clientDocument}
                  onChange={(e) => setClientDocument(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                />
              </div>
            </div>

            {/* Endereço Expansível */}
            <div>
              <button
                type="button"
                onClick={() => setShowAddress(!showAddress)}
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
              >
                <ChevronDown
                  size={13}
                  className={`transition-transform ${showAddress ? "rotate-180" : ""}`}
                />
                {showAddress ? "Ocultar endereço" : "+ Adicionar dados de endereço / entrega"}
              </button>

              {showAddress && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Logradouro / Rua"
                    value={addressStreet}
                    onChange={(e) => setAddressStreet(e.target.value)}
                    className="col-span-2 rounded-xl border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
                  />
                  <input
                    type="text"
                    placeholder="Nº"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                    className="rounded-xl border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Observações da Comanda
              </label>
              <textarea
                rows={2}
                placeholder="Preferências, instruções especiais ou observações do atendimento..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink resize-none"
              />
            </div>
          </div>

          {/* Coluna Direita: Pagamento & Fidelidade (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Card de Pagamento */}
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2 border-b border-border-subtle pb-2">
                <Wallet size={16} className="text-emerald-500" />
                Resumo de Pagamento
              </h3>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-ink-muted">
                  <span>Subtotal:</span>
                  <span>{formatPriceFromCents(subtotalCents, locale, currency)}</span>
                </div>

                {/* Desconto */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">Desconto:</span>
                  <div className="flex items-center gap-1">
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as "FIXED" | "PERCENT")}
                      className="rounded-lg border border-border-subtle bg-canvas/40 px-1.5 py-1 text-[11px] text-ink"
                    >
                      <option value="FIXED">R$</option>
                      <option value="PERCENT">%</option>
                    </select>
                    <input
                      type="text"
                      placeholder="0.00"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="w-16 rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-right text-ink"
                    />
                  </div>
                </div>

                <div className="flex justify-between font-bold text-ink text-sm border-t border-border-subtle/70 pt-2">
                  <span>Total da Comanda:</span>
                  <span className="text-accent">
                    {formatPriceFromCents(totalCents, locale, currency)}
                  </span>
                </div>

                <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Valor Pago:</span>
                  <span>{formatPriceFromCents(totalPaidCents, locale, currency)}</span>
                </div>

                <div className="flex justify-between font-bold text-rose-500">
                  <span>Resta a Pagar:</span>
                  <span>{formatPriceFromCents(remainingCents, locale, currency)}</span>
                </div>
              </div>

              {/* Lançamento de Pagamentos */}
              <div className="border-t border-border-subtle/70 pt-3 space-y-2">
                <span className="block text-xs font-semibold text-ink-secondary">
                  Lançar Meio de Pagamento
                </span>

                <div className="flex gap-2">
                  <select
                    value={selectedPaymentMethod}
                    onChange={(e) => setSelectedPaymentMethod(e.target.value as PaymentMethod)}
                    className="flex-1 rounded-xl border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
                  >
                    <option value="PIX">PIX</option>
                    <option value="CASH">Dinheiro</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="DEBIT_CARD">Cartão de Débito</option>
                    <option value="TRANSFER">Transferência</option>
                  </select>

                  <input
                    type="text"
                    placeholder={`R$ ${(remainingCents / 100).toFixed(2)}`}
                    value={paymentAmountInput}
                    onChange={(e) => setPaymentAmountInput(e.target.value)}
                    className="w-24 rounded-xl border border-border-subtle bg-canvas/40 px-2 py-1.5 text-xs text-ink text-right"
                  />

                  <button
                    type="button"
                    onClick={handleAddPayment}
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
                  >
                    + Pagar
                  </button>
                </div>

                {/* Lista de Pagamentos Realizados */}
                {payments.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg bg-canvas/40 px-2.5 py-1 text-xs"
                      >
                        <span className="font-medium text-ink">{p.method}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatPriceFromCents(p.amountCents, locale, currency)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePayment(p.id)}
                            className="text-ink-muted hover:text-rose-500"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Card de Programa de Fidelidade */}
            <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-ink flex items-center gap-1.5">
                  <Gift size={15} className="text-amber-500" />
                  Programa de Fidelidade
                </span>
                <span className="text-[11px] text-accent font-semibold">{program.name}</span>
              </div>

              {clientLoyalty ? (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-ink-muted">
                    <span>Pontos acumulados:</span>
                    <strong className="text-ink font-bold">
                      {clientLoyalty.points} / {program.pointsRequired} pts
                    </strong>
                  </div>
                  <div className="h-2 w-full rounded-full bg-border-subtle overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{
                        width: `${Math.min(100, (clientLoyalty.points / program.pointsRequired) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-ink-muted">
                  Selecione um cliente para visualizar o saldo de pontos na cartela de fidelidade.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* PARTE INFERIOR: SERVIÇOS, PRODUTOS E GORJETAS */}
        {/* ======================================================== */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-3">
            <div>
              <h3 className="text-base font-bold text-ink">Itens da Comanda (Serviços e Estoque)</h3>
              <p className="text-xs text-ink-muted">
                Adicione procedimentos, produtos vendidos (com baixa no estoque) e gorjetas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddServiceLine}
                className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent transition-colors"
              >
                <Plus size={13} />
                + Serviço
              </button>

              <button
                type="button"
                onClick={handleAddProductLine}
                className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent transition-colors"
              >
                <Package size={13} />
                + Produto (Estoque)
              </button>

              <button
                type="button"
                onClick={handleAddTipLine}
                className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent transition-colors"
              >
                <Heart size={13} className="text-rose-500" />
                + Gorjeta
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="py-12 text-center text-xs text-ink-muted">
              Nenhum serviço ou produto adicionado. Clique nos botões acima para incluir itens na
              comanda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Item / Procedimento</th>
                    <th className="py-2.5 px-3">Profissional</th>
                    <th className="py-2.5 px-3">Qtd</th>
                    <th className="py-2.5 px-3">Valor Unitário</th>
                    <th className="py-2.5 px-3">% Comissão</th>
                    <th className="py-2.5 px-3">Subtotal</th>
                    <th className="py-2.5 px-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-canvas/30 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            item.type === "SERVICE"
                              ? "bg-accent/10 text-accent"
                              : item.type === "PRODUCT"
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-rose-500/10 text-rose-500"
                          }`}
                        >
                          {item.type === "SERVICE"
                            ? "Serviço"
                            : item.type === "PRODUCT"
                              ? "Produto"
                              : "Gorjeta"}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 min-w-[180px]">
                        {item.type === "SERVICE" ? (
                          <select
                            value={item.itemId}
                            onChange={(e) => {
                              const found = safeServices.find((s) => s.id === e.target.value);
                              if (!found) return;
                              setItems(
                                items.map((it, i) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        itemId: found.id,
                                        name: found.name,
                                        unitPriceCents: found.priceInCents,
                                        subtotalCents: found.priceInCents * it.quantity,
                                      }
                                    : it,
                                ),
                              );
                            }}
                            className="w-full rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-ink"
                          >
                            {item.itemId && !safeServices.some((s) => s.id === item.itemId) && (
                              <option value={item.itemId}>{item.name}</option>
                            )}
                            {!item.itemId && (
                              <option value="">{item.name || "Selecione um serviço"}</option>
                            )}
                            {safeServices.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        ) : item.type === "PRODUCT" ? (
                          <select
                            value={item.itemId}
                            onChange={(e) => {
                              const found = safeInventoryItems.find((p) => p.id === e.target.value);
                              if (!found) return;
                              const price = found.salePriceCents || found.costPriceCents;
                              setItems(
                                items.map((it, i) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        itemId: found.id,
                                        name: found.name,
                                        unitPriceCents: price,
                                        subtotalCents: price * it.quantity,
                                      }
                                    : it,
                                ),
                              );
                            }}
                            className="w-full rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-ink"
                          >
                            {safeInventoryItems.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.currentStock} em estoque)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="font-semibold text-ink">{item.name}</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 min-w-[140px]">
                        <select
                          value={item.collaboratorId}
                          onChange={(e) => {
                            setItems(
                              items.map((it, i) =>
                                i === idx ? { ...it, collaboratorId: e.target.value } : it,
                              ),
                            );
                          }}
                          className="w-full rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-ink"
                        >
                          {!item.collaboratorId && <option value="">Sem profissional</option>}
                          {safeCollaborators.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-2.5 px-3 w-16">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => {
                            const q = Math.max(1, Number(e.target.value));
                            setItems(
                              items.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      quantity: q,
                                      subtotalCents: it.unitPriceCents * q,
                                    }
                                  : it,
                              ),
                            );
                          }}
                          className="w-14 rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-ink text-center"
                        />
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-medium text-ink">
                        {formatPriceFromCents(item.unitPriceCents, locale, currency)}
                      </td>

                      <td className="py-2.5 px-3 w-20">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={item.commissionPercentage}
                          onChange={(e) => {
                            const comm = Number(e.target.value);
                            setItems(
                              items.map((it, i) =>
                                i === idx ? { ...it, commissionPercentage: comm } : it,
                              ),
                            );
                          }}
                          className="w-16 rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1 text-xs text-ink text-center"
                        />
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-bold text-ink">
                        {formatPriceFromCents(item.subtotalCents, locale, currency)}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(item.id)}
                          className="text-ink-muted hover:text-rose-500"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Rodapé de Ação */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border-subtle pt-4">
            <div className="text-sm font-bold text-ink">
              Total Líquido da Comanda:{" "}
              <span className="text-accent text-base">
                {formatPriceFromCents(totalCents, locale, currency)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/owner/finance"
                className="rounded-xl border border-border-subtle px-4 py-2 text-xs font-semibold text-ink hover:bg-canvas transition-colors"
              >
                Cancelar
              </Link>

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs cursor-pointer disabled:opacity-50"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Salvar Comanda / Finalizar Venda
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
