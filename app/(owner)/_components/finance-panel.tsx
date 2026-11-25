"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Clock3,
  CreditCard,
  DollarSign,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Loader2,
  Lock,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  User,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone, formatPriceFromCents, formatTimeInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import type { Appointment } from "@/lib/types/appointment";
import type {
  FinanceDay,
  FinanceSummaryResponse,
  PaymentMethod,
  SavedFinanceOrder,
} from "@/lib/types/finance";
import type { Collaborator } from "@/lib/types/team";
import { clientPhoneKey, getCanonicalClientId, useClients } from "@/lib/use-clients";
import { ReceiptDialog } from "./receipt-dialog";
import { FinanceOperationDialog, type FinanceOperation } from "./finance-operation-dialog";

const dayInMs = 86_400_000;

function formatIsoInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

interface PaymentSummaryItem {
  appointmentId: string;
  currency: string;
  collectedInCents: number;
  netInCents: number;
  openInCents: number;
  canCollect: boolean;
  methods: PaymentMethod[];
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  PIX: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Crédito",
  DEBIT_CARD: "Débito",
  TRANSFER: "Transferência",
  OTHER: "Outros",
};

export function FinancePanel() {
  const router = useRouter();
  const { session } = useSession();
  const { locale, t } = useLocale();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";

  const todayIso = useMemo(() => formatIsoInTimezone(new Date(), timezone), [timezone]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(Date.now() - 7 * dayInMs);
    return formatIsoInTimezone(d, timezone);
  });
  const [toDate, setToDate] = useState(() => {
    const d = new Date(Date.now() + 1 * dayInMs);
    return formatIsoInTimezone(d, timezone);
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN_DEBT" | "CLOSED">("ALL");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [savedOrders, setSavedOrders] = useState<SavedFinanceOrder[]>([]);
  const [paymentsMap, setPaymentsMap] = useState<Map<string, PaymentSummaryItem>>(new Map());
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [summary, setSummary] = useState<FinanceSummaryResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<SavedFinanceOrder | null>(null);
  const [operation, setOperation] = useState<FinanceOperation | null>(null);
  const [newSaleChoiceOpen, setNewSaleChoiceOpen] = useState(false);
  const [hasOwnerPin, setHasOwnerPin] = useState<boolean | null>(null);
  const [reopenTarget, setReopenTarget] = useState<SavedFinanceOrder | null>(null);
  const [reopenPin, setReopenPin] = useState("");
  const [reopenReason, setReopenReason] = useState("");
  const [reopenError, setReopenError] = useState("");
  const [reopening, setReopening] = useState(false);
  const { clients } = useClients(session.company.id);

  // Restaura todos os filtros para o estado padrão limpo (ex.: após finalizar operação)
  const resetFilters = useCallback(() => {
    setFromDate(formatIsoInTimezone(new Date(Date.now() - 7 * dayInMs), timezone));
    setToDate(formatIsoInTimezone(new Date(Date.now() + 1 * dayInMs), timezone));
    setSearch("");
    setStatusFilter("ALL");
  }, [timezone]);

  useEffect(() => {
    let active = true;
    void apiRequest<{ hasPin: boolean }>("/companies/me/security/pin")
      .then((res) => {
        if (active) setHasOwnerPin(Boolean(res?.hasPin));
      })
      .catch(() => {
        if (active) setHasOwnerPin(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Resolve o ID canônico de um cliente cadastrado na base da empresa para navegação direta ao perfil/histórico
  const resolveClientProfileId = useCallback(
    (name?: string | null, phone?: string | null): string | null => {
      const trimmedName = (name ?? "").trim();
      if (!trimmedName) return null;
      const phoneKey = clientPhoneKey(phone ?? undefined);
      const lowerName = trimmedName.toLowerCase();

      const matched = clients.find((client) => {
        if (phoneKey && clientPhoneKey(client.phone) === phoneKey) return true;
        return client.name.trim().toLowerCase() === lowerName;
      });

      if (matched) return matched.id;
      return getCanonicalClientId(phone ?? undefined, trimmedName);
    },
    [clients],
  );

  const searchParams = useSearchParams();
  const actionParam = searchParams.get("action");

  useEffect(() => {
    if (actionParam === "new-sale") {
      setNewSaleChoiceOpen(true);
      window.history.replaceState(null, "", "/owner/finance");
    }
  }, [actionParam]);

  const collaboratorMap = useMemo(() => {
    const map = new Map<string, Collaborator>();
    for (const c of collaborators) map.set(c.id, c);
    return map;
  }, [collaborators]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const fromIso = `${fromDate}T00:00:00.000Z`;
      const toIso = `${toDate}T23:59:59.999Z`;

      const [summaryRes, appsRes, collabsRes, ordersRes] = await Promise.all([
        apiRequest<FinanceSummaryResponse>("/finance/summary", {
          query: { from: fromDate, to: toDate },
        }).catch(() => null),
        apiRequest<Appointment[]>("/appointments", {
          query: { from: fromIso, to: toIso },
        }),
        apiRequest<{ collaborators: Collaborator[] } | Collaborator[]>("/collaborators"),
        apiRequest<{ items?: SavedFinanceOrder[] }>("/finance/orders", {
          query: { from: fromDate, to: toDate },
        }).catch(() => ({ items: [] })),
      ]);

      setSummary(summaryRes);
      setAppointments(appsRes);
      setSavedOrders(Array.isArray(ordersRes?.items) ? ordersRes.items : []);
      setCollaborators(Array.isArray(collabsRes) ? collabsRes : collabsRes.collaborators ?? []);

      // Busca resumos de pagamento em lotes
      if (appsRes.length > 0) {
        const ids = appsRes.map((a) => a.id);
        const batches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
          ids.slice(i * 100, (i + 1) * 100).join(","),
        );
        const paymentsRes = await Promise.all(
          batches.map((batch) =>
            apiRequest<PaymentSummaryItem[]>("/finance/appointments/payment-summary", {
              query: { ids: batch },
            }).catch(() => []),
          ),
        );
        const map = new Map<string, PaymentSummaryItem>();
        for (const item of paymentsRes.flat()) {
          map.set(item.appointmentId, item);
        }
        setPaymentsMap(map);
      } else {
        setPaymentsMap(new Map());
      }
    } catch {
      toast.error("Erro ao carregar dados financeiros e comandas.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Lista unificada de comandas (agendamentos + comandas salvas em /finance/orders)
  const comandas = useMemo(() => {
    const term = search.trim().toLowerCase();
    // Evita duplicar a linha de agendamento quando já existe uma comanda persistida vinculada a ele
    const linkedAppointmentIds = new Set(
      savedOrders
        .map((order) => order.appointmentId)
        .filter((id): id is string => Boolean(id)),
    );

    const appointmentRows = appointments
      .filter((app) => app.status !== "CANCELED" && !linkedAppointmentIds.has(app.id))
      .map((app) => {
        const payment = paymentsMap.get(app.id);
        const totalInCents = app.servicePriceInCentsSnapshot;
        const paidInCents = payment?.collectedInCents ?? (app.status === "COMPLETED" ? totalInCents : 0);
        const openDebtInCents = payment ? payment.openInCents : app.status === "COMPLETED" ? 0 : totalInCents;
        const isClosed = openDebtInCents === 0 && paidInCents > 0;
        const hasDebt = openDebtInCents > 0;

        return {
          id: app.id,
          source: "APPOINTMENT" as const,
          codeLabel: `#${app.id.slice(0, 8)}`,
          clientName: app.clientName,
          clientPhone: app.clientPhone,
          clientProfileId: resolveClientProfileId(app.clientName, app.clientPhone),
          collaboratorId: app.collaboratorId,
          collaboratorLabel: collaboratorMap.get(app.collaboratorId)?.name ?? "Profissional",
          serviceNameSnapshot: app.serviceNameSnapshot,
          startsAt: app.startsAt,
          totalInCents,
          paidInCents,
          openDebtInCents,
          isClosed,
          hasDebt,
          methods: payment?.methods ?? [],
          order: null as SavedFinanceOrder | null,
        };
      });

    const orderRows = savedOrders.map((order) => {
      const openDebtInCents = order.openInCents;
      const isClosed = order.status === "CLOSED" || (openDebtInCents === 0 && order.paidCents > 0);
      const hasDebt = openDebtInCents > 0;
      const itemSummary =
        order.items.map((it) => `${it.quantity}x ${it.name}`).join(", ") ||
        (locale === "es" ? "Venta suelta" : "Venda avulsa");
      const firstSeller =
        order.items.find((it) => it.collaboratorName)?.collaboratorName ??
        (order.items.some((it) => it.itemType === "PRODUCT" && !it.collaboratorId)
          ? locale === "es"
            ? "Venta de la Empresa"
            : "Venda da Empresa"
          : "—");
      const normalizedCode = order.code.startsWith("#") ? order.code : `#${order.code}`;
      const hasLinkedClient = Boolean(order.clientName?.trim());

      return {
        id: `order_${order.id}`,
        source: "ORDER" as const,
        codeLabel: normalizedCode,
        clientName: hasLinkedClient
          ? order.clientName!.trim()
          : locale === "es"
            ? "Venta Suelta"
            : "Venda Avulsa",
        clientPhone: order.clientPhone || "—",
        clientProfileId: hasLinkedClient
          ? resolveClientProfileId(order.clientName, order.clientPhone)
          : null,
        collaboratorId: "",
        collaboratorLabel: firstSeller,
        serviceNameSnapshot: itemSummary,
        startsAt: order.createdAt,
        totalInCents: order.totalCents,
        paidInCents: order.paidCents,
        openDebtInCents,
        isClosed,
        hasDebt,
        methods: order.payments.map((p) => p.method),
        order,
      };
    });

    return [...orderRows, ...appointmentRows]
      .filter((comanda) => {
        if (statusFilter === "OPEN_DEBT" && !comanda.hasDebt) return false;
        if (statusFilter === "CLOSED" && !comanda.isClosed) return false;
        if (term) {
          const matchCode = comanda.codeLabel.toLowerCase().includes(term);
          const matchClient = comanda.clientName.toLowerCase().includes(term);
          const matchPhone = comanda.clientPhone.toLowerCase().includes(term);
          const matchService = comanda.serviceNameSnapshot.toLowerCase().includes(term);
          if (!matchCode && !matchClient && !matchPhone && !matchService) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [appointments, collaboratorMap, locale, paymentsMap, resolveClientProfileId, savedOrders, search, statusFilter]);

  // Totais das comandas filtradas
  const comandasTotals = useMemo(() => {
    let totalCents = 0;
    let paidCents = 0;
    let debtCents = 0;
    let openCount = 0;
    let closedCount = 0;

    for (const c of comandas) {
      totalCents += c.totalInCents;
      paidCents += c.paidInCents;
      debtCents += c.openDebtInCents;
      if (c.hasDebt) openCount += 1;
      if (c.isClosed) closedCount += 1;
    }

    return { totalCents, paidCents, debtCents, openCount, closedCount };
  }, [comandas]);

  const donutData = useMemo(() => {
    const paidBy = summary?.collections?.paidByMethod ?? {};
    const entries = Object.entries(paidBy).filter(([, val]) => (val ?? 0) > 0);
    const total = entries.reduce((s, [, val]) => s + (val ?? 0), 0);
    const colors = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];
    let accPercent = 0;
    const circumference = 251.32; // 2 * pi * 40
    const segments = entries.map(([method, amount], idx) => {
      const fraction = total > 0 ? (amount ?? 0) / total : 0;
      const strokeDasharray = `${(fraction * circumference).toFixed(2)} ${circumference.toFixed(2)}`;
      const strokeDashoffset = (-accPercent * circumference).toFixed(2);
      accPercent += fraction;
      return {
        method: method as PaymentMethod,
        amount: amount ?? 0,
        percent: Math.round(fraction * 100),
        color: colors[idx % colors.length],
        strokeDasharray,
        strokeDashoffset,
      };
    });
    return { segments, total };
  }, [summary]);

  function handleExportCsv() {
    const es = locale === "es";
    if (comandas.length === 0) {
      toast.error(es ? "No hay comandas para exportar." : "Nenhuma comanda para exportar.");
      return;
    }
    const headers = es
      ? ["Cliente", "Teléfono", "Servicio", "Fecha/Hora", `Valor Total (${currency})`, `Valor Pagado (${currency})`, `Saldo Pendiente (${currency})`, "Estado"]
      : ["Cliente", "Telefone", "Serviço", "Data/Hora", `Valor Total (${currency})`, `Valor Pago (${currency})`, `Saldo Devedor (${currency})`, "Status"];
    const rows = comandas.map((c) => [
      `"${c.clientName.replace(/"/g, '""')}"`,
      `"${c.clientPhone}"`,
      `"${c.serviceNameSnapshot.replace(/"/g, '""')}"`,
      `"${formatDateTimeInTimezone(c.startsAt, timezone, locale)}"`,
      (c.totalInCents / 100).toFixed(2),
      (c.paidInCents / 100).toFixed(2),
      (c.openDebtInCents / 100).toFixed(2),
      c.hasDebt ? (es ? "Pendiente (Fiado)" : "Em aberto (Fiado)") : c.isClosed ? (es ? "Cerrada" : "Fechada") : (es ? "Pendiente" : "Pendente"),
    ]);
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comandas-${fromDate}-a-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(es ? "¡CSV de comandas exportado con éxito!" : "CSV de comandas exportado com sucesso!");
  }

  const es = locale === "es";

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* TOPO COMPACTO: GESTÃO OPERACIONAL DE COMANDAS */}
      {/* ======================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2 text-balance">
            <Receipt className="size-6 text-accent" aria-hidden="true" />
            {es ? "Gestión Operativa de Comandas" : "Gestão Operacional de Comandas"}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            {es
              ? "Registra ventas, controla comandas abiertas y recibe pagos en caja."
              : "Registre vendas, controle comandas abertas (fiado) e receba pagamentos no balcão."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="grid size-10 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors cursor-pointer"
            title={es ? "Actualizar datos" : "Atualizar dados"}
            aria-label={es ? "Actualizar datos" : "Atualizar dados"}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Grid de 3 Cards: Caixa (com Nova Venda), Gráfico Diário e Donut de Pagamentos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Card 1: Caixa com Ação Rápida de Nova Venda */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-[0_1px_3px_0_rgb(15_23_42/0.06),0_1px_2px_-1px_rgb(15_23_42/0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide flex items-center gap-1.5">
                <Wallet className="size-4 text-accent" aria-hidden="true" />
                {es ? "Caja y Facturación" : "Caixa & Faturamento"}
              </span>
              <button
                type="button"
                onClick={() => setNewSaleChoiceOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent hover:bg-accent/25 transition-colors cursor-pointer"
              >
                <Plus size={12} aria-hidden="true" />
                {es ? "Nueva venta" : "Nova venda"}
              </button>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-2xl sm:text-3xl font-bold text-ink tabular-nums">
                <SensitiveValue>
                  {formatPriceFromCents(comandasTotals.totalCents, locale, currency)}
                </SensitiveValue>
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted tabular-nums">
              {es
                ? `${comandas.length} comanda(s) en el período seleccionado`
                : `${comandas.length} comanda(s) no período selecionado`}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border-subtle/60 pt-3">
            <div className="rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] p-2.5">
              <span className="text-xs font-semibold text-[var(--status-success-ink)] block">
                {es ? "Total Cobrado" : "Total Recebido"}
              </span>
              <span className="font-mono text-sm font-bold text-[var(--status-success-ink)] tabular-nums">
                <SensitiveValue>
                  {formatPriceFromCents(comandasTotals.paidCents, locale, currency)}
                </SensitiveValue>
              </span>
            </div>

            <div className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-2.5">
              <span className="text-xs font-semibold text-[var(--status-danger-ink)] block">
                {es ? "Saldo Pendiente" : "Saldo Devedor (Fiado)"}
              </span>
              <span className="font-mono text-sm font-bold text-[var(--status-danger-ink)] tabular-nums">
                <SensitiveValue>
                  {formatPriceFromCents(comandasTotals.debtCents, locale, currency)}
                </SensitiveValue>
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Mini-Gráfico Diário de Receitas x Despesas */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-[0_1px_3px_0_rgb(15_23_42/0.06),0_1px_2px_-1px_rgb(15_23_42/0.04)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                {es ? "Ingresos vs Gastos Diarios" : "Receitas x Despesas Diárias"}
              </span>
              <span className="text-xs text-ink-muted">{es ? "Últimos días" : "Últimos dias"}</span>
            </div>

            {/* Mini barras do período */}
            <div className="mt-4 flex h-24 items-end gap-1.5 overflow-x-auto pb-1">
              {summary?.series && summary.series.length > 0 ? (
                summary.series.slice(-7).map((d: FinanceDay) => {
                  const maxVal = Math.max(
                    ...summary.series.map((x: FinanceDay) => Math.max(x.realizedInCents, x.commissionsInCents)),
                    1,
                  );
                  const revenueHeight = Math.min(100, Math.max(8, (d.realizedInCents / maxVal) * 100));
                  const expenseHeight = Math.min(100, Math.max(6, (d.commissionsInCents / maxVal) * 100));

                  return (
                    <div key={d.date} className="flex-1 min-w-[28px] flex flex-col items-center gap-1">
                      <div className="flex h-18 w-full items-end justify-center gap-0.5">
                        <div
                          style={{ height: `${revenueHeight}%` }}
                          title={`Receita em ${d.date}: ${formatPriceFromCents(d.realizedInCents, locale, currency)}`}
                          className="w-2.5 rounded-t-sm bg-emerald-500 transition-all hover:opacity-80"
                        />
                        <div
                          style={{ height: `${expenseHeight}%` }}
                          title={`Despesas em ${d.date}: ${formatPriceFromCents(d.commissionsInCents, locale, currency)}`}
                          className="w-2.5 rounded-t-sm bg-rose-500/80 transition-all hover:opacity-80"
                        />
                      </div>
                      <span className="text-[9px] font-mono text-ink-muted">
                        {d.date.slice(8, 10)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-ink-muted">
                  Sem dados diários no período.
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border-subtle/60 pt-2 text-[10px] text-ink-secondary">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" /> Receitas
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-rose-500" /> Despesas / Comissões
            </span>
          </div>
        </div>

        {/* Card 3: Recebimentos por meio de pagamento com Gráfico Donut SVG */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                Recebimentos por Meio
              </span>
              <Link
                href="/owner/finance/payment-methods"
                className="text-[11px] font-semibold text-accent hover:underline inline-flex items-center gap-1"
              >
                Taxas
                <ExternalLink size={10} />
              </Link>
            </div>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Valores já liquidados e consolidados
            </p>
          </div>

          <div className="mt-2 flex items-center gap-4">
            {/* Donut SVG */}
            <div className="relative size-24 shrink-0 flex items-center justify-center">
              <svg className="size-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="12"
                  className="text-border-subtle/40"
                />
                {donutData.segments.map((seg) => (
                  <circle
                    key={seg.method}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth="12"
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    className="transition-all duration-500"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-[10px] font-bold text-ink">
                  {donutData.segments.length > 0 ? "100%" : "0%"}
                </span>
              </div>
            </div>

            {/* Legendas dos métodos */}
            <div className="flex-1 space-y-1 overflow-y-auto max-h-24 pr-1 text-xs">
              {donutData.segments.length > 0 ? (
                donutData.segments.map((seg) => (
                  <div key={seg.method} className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 truncate text-ink-secondary">
                      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                      <span className="truncate">{paymentMethodLabels[seg.method] ?? seg.method}</span>
                    </span>
                    <span className="font-semibold text-ink shrink-0 ml-1">
                      {seg.percent}%
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-[11px] text-ink-muted py-2">
                  Sem recebimentos no período.
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-border-subtle/60 pt-2 flex items-center justify-between text-xs">
            <span className="text-ink-muted">{es ? "Total por Método:" : "Total no Meio:"}</span>
            <span className="font-mono font-bold text-ink tabular-nums">
              <SensitiveValue>
                {formatPriceFromCents(donutData.total, locale, currency)}
              </SensitiveValue>
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* BARRA DE FILTROS, BUSCA E AÇÕES DE COMANDAS */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-border-subtle bg-surface p-4 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-ink-secondary">{es ? "Período:" : "Período:"}</span>
            <input
              type="date"
              autoComplete="off"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 font-mono text-xs text-ink tabular-nums"
            />
            <span className="text-ink-muted">{es ? "hasta" : "até"}</span>
            <input
              type="date"
              autoComplete="off"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 font-mono text-xs text-ink tabular-nums"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:text-ink hover:border-accent transition-colors cursor-pointer"
            >
              <Download size={13} aria-hidden="true" />
              {es ? "Exportar CSV" : "Exportar CSV"}
            </button>

            <Link
              href="/owner/finance/orders/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-accent-ink hover:bg-accent-hover transition-colors cursor-pointer"
            >
              <Plus size={13} aria-hidden="true" />
              {es ? "Nueva comanda" : "Nova comanda"}
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle/60 pt-3">
          <div className="flex rounded-xl border border-border-subtle bg-canvas/40 p-1 text-xs">
            <button
              type="button"
              onClick={() => {
                setFromDate(todayIso);
                setToDate(todayIso);
              }}
              className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors"
            >
              {es ? "Hoy" : "Hoje"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFromDate(formatIsoInTimezone(new Date(Date.now() - 7 * dayInMs), timezone));
                setToDate(todayIso);
              }}
              className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors"
            >
              {es ? "7 días" : "7 dias"}
            </button>
            <button
              type="button"
              onClick={() => {
                const [y, m] = todayIso.split("-").map(Number);
                const first = new Date(Date.UTC(y, m - 1, 1));
                const last = new Date(Date.UTC(y, m, 0));
                setFromDate(formatIsoInTimezone(first, timezone));
                setToDate(formatIsoInTimezone(last, timezone));
              }}
              className="cursor-pointer rounded-lg px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors"
            >
              {es ? "Este mes" : "Este mês"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_220px] flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-muted" aria-hidden="true" />
              <input
                type="text"
                autoComplete="off"
                placeholder={
                  es
                    ? "Buscar comanda por cliente, teléfono o servicio..."
                    : "Buscar comanda por cliente, telefone ou serviço..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-canvas/40 pl-9 pr-3 py-1.5 text-xs text-ink outline-none focus-visible:border-accent"
              />
            </div>

            <select
              autoComplete="off"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | "OPEN_DEBT" | "CLOSED")}
              className="cursor-pointer rounded-xl border border-border-subtle bg-canvas/40 px-3 py-1.5 text-xs text-ink outline-none focus-visible:border-accent"
            >
              <option value="ALL">{es ? "Todas las Comandas" : "Todas as Comandas"}</option>
              <option value="OPEN_DEBT">{es ? "Abiertas / Con saldo pendiente" : "Em aberto / Fiado (Com débito)"}</option>
              <option value="CLOSED">{es ? "Cerradas / Pagadas 100%" : "Fechadas / Pagas 100%"}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TABELA DE COMANDAS */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="mt-3 text-xs text-ink-muted">Carregando comandas e recebimentos...</p>
          </div>
        ) : comandas.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted">
            Nenhuma comanda encontrada para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Comanda / Horário</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Profissional</th>
                  <th className="py-3 px-4">Serviço / Itens</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Pago</th>
                  <th className="py-3 px-4">Saldo Devedor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {comandas.map((cmd) => {
                  const dateStr = formatDateTimeInTimezone(cmd.startsAt, timezone, locale);
                  const isAppointment = cmd.source === "APPOINTMENT";

                  return (
                    <tr
                      key={cmd.id}
                      onClick={() => {
                        // Bloqueia clique na linha/serviço quando a comanda já está fechada/paga
                        if (cmd.isClosed) return;
                        if (isAppointment) setReceiptId(cmd.id);
                        else if (cmd.order) router.push(`/owner/finance/orders/new?orderId=${encodeURIComponent(cmd.order.id)}`);
                      }}
                      className={`${cmd.isClosed ? "cursor-default" : "cursor-pointer hover:bg-canvas/40"} transition-colors group`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-ink whitespace-nowrap">
                        <span className="block font-semibold">{cmd.codeLabel}</span>
                        <span className="text-[11px] text-ink-muted">{dateStr}</span>
                      </td>

                      <td className="py-3 px-4 min-w-[130px]">
                        {cmd.clientProfileId ? (
                          <Link
                            href={`/owner/clients/${encodeURIComponent(cmd.clientProfileId)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex cursor-pointer items-center gap-1 font-semibold text-ink hover:text-accent hover:underline transition-colors"
                          >
                            <span>{cmd.clientName}</span>
                            <ExternalLink size={11} className="opacity-60" aria-hidden="true" />
                          </Link>
                        ) : (
                          <p className="font-semibold text-ink">{cmd.clientName}</p>
                        )}
                        <p className="text-[11px] text-ink-muted font-mono">{cmd.clientPhone}</p>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-ink-secondary">
                        {cmd.collaboratorLabel}
                      </td>

                      <td className="py-3 px-4 max-w-[180px] truncate text-ink font-medium" title={cmd.serviceNameSnapshot}>
                        {cmd.serviceNameSnapshot}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-medium text-ink">
                        <SensitiveValue>
                          {formatPriceFromCents(cmd.totalInCents, locale, currency)}
                        </SensitiveValue>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-emerald-600 dark:text-emerald-400 font-medium">
                        <SensitiveValue>
                          {formatPriceFromCents(cmd.paidInCents, locale, currency)}
                        </SensitiveValue>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-bold">
                        {cmd.hasDebt ? (
                          <span className="text-rose-500">
                            <SensitiveValue>
                              {formatPriceFromCents(cmd.openDebtInCents, locale, currency)}
                            </SensitiveValue>
                          </span>
                        ) : (
                          <span className="text-ink-muted text-[11px]">
                            {formatPriceFromCents(0, locale, currency)}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {cmd.hasDebt ? (
                          <span className="inline-flex rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
                            Em aberto (Fiado)
                          </span>
                        ) : (
                          <span className="inline-flex rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Fechada / Paga
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {isAppointment ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReceiptId(cmd.id);
                              }}
                              className="cursor-pointer rounded-lg bg-surface border border-border-subtle px-2.5 py-1 text-xs font-semibold text-ink hover:border-accent hover:text-accent transition-colors shadow-2xs"
                            >
                              {cmd.hasDebt
                                ? "Cobrar"
                                : "Ver Recibo"}
                            </button>
                          ) : (
                            <>
                              {!cmd.isClosed && cmd.order && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/owner/finance/orders/new?orderId=${encodeURIComponent(cmd.order!.id)}`);
                                  }}
                                  className="cursor-pointer rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors shadow-2xs"
                                >
                                  {locale === "es" ? "Editar / Cobrar" : "Editar / Cobrar"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (cmd.order) setReceiptOrder(cmd.order);
                                }}
                                className="cursor-pointer rounded-lg bg-surface border border-border-subtle px-2.5 py-1 text-xs font-semibold text-ink hover:border-accent hover:text-accent transition-colors shadow-2xs"
                              >
                                Ver Recibo
                              </button>
                              {cmd.isClosed && cmd.order && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReopenPin("");
                                    setReopenReason("");
                                    setReopenError("");
                                    setReopenTarget(cmd.order);
                                  }}
                                  title={
                                    locale === "es"
                                      ? "Reabrir / Editar con PIN del Dueño"
                                      : "Reabrir / Editar com PIN do Dono"
                                  }
                                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-subtle bg-canvas/50 px-2 py-1 text-[11px] font-medium text-ink-secondary hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                                >
                                  <Lock size={11} aria-hidden="true" />
                                  <span>{locale === "es" ? "Reabrir (PIN)" : "Reabrir (PIN)"}</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Recebimento / Comanda */}
      {(receiptId || receiptOrder) && (
        <ReceiptDialog
          appointmentId={receiptId ?? undefined}
          order={receiptOrder ?? undefined}
          timezone={timezone}
          onChanged={() => {
            resetFilters();
            void loadData();
          }}
          onClose={() => {
            setReceiptId(null);
            setReceiptOrder(null);
            void loadData();
          }}
        />
      )}

      {/* Modal de Reabertura Controlada com PIN do Dono */}
      {reopenTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div
            className="fixed inset-0"
            onClick={() => {
              if (!reopening) setReopenTarget(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reopen-order-pin-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-border-strong bg-surface p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  id="reopen-order-pin-title"
                  className="text-base font-bold text-ink flex items-center gap-2"
                >
                  <Lock size={16} className="text-amber-500" aria-hidden="true" />
                  {locale === "es"
                    ? `Reabrir Comanda ${reopenTarget.code}`
                    : `Reabrir Comanda ${reopenTarget.code}`}
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {locale === "es"
                    ? "Requiere el PIN de autorización del Dueño y un motivo para auditoría."
                    : "Exige o PIN de autorização do Dono e um motivo para registro em auditoria."}
                </p>
              </div>
              <button
                type="button"
                disabled={reopening}
                onClick={() => setReopenTarget(null)}
                aria-label="Fechar"
                className="grid size-8 place-items-center rounded-lg text-ink-secondary hover:bg-surface-hover hover:text-ink cursor-pointer disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {hasOwnerPin === false ? (
              <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-ink">
                <p className="font-semibold text-amber-700 dark:text-amber-300">
                  {locale === "es"
                    ? "PIN del Dueño aún no configurado"
                    : "PIN do Dono ainda não configurado"}
                </p>
                <p className="text-ink-secondary">
                  {locale === "es"
                    ? "Define un PIN numérico de 4 a 6 dígitos en Configuraciones > Seguridad y Contraseña antes de reabrir comandas cerradas."
                    : "Defina um PIN numérico de 4 a 6 dígitos em Configurações > Segurança & Senha antes de permitir reaberturas."}
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setReopenTarget(null)}
                    className="cursor-pointer rounded-lg border border-border-subtle px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:text-ink"
                  >
                    {locale === "es" ? "Cerrar" : "Fechar"}
                  </button>
                  <Link
                    href="/owner/settings"
                    onClick={() => setReopenTarget(null)}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-ink hover:bg-accent-hover"
                  >
                    {locale === "es" ? "Ir a Seguridad y Contraseña" : "Ir para Segurança & Senha"}
                  </Link>
                </div>
              </div>
            ) : (
              <form
                autoComplete="off"
                className="space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const trimmedPin = reopenPin.trim();
                  const trimmedReason = reopenReason.trim();
                  if (!/^\d{4,6}$/.test(trimmedPin)) {
                    setReopenError(
                      locale === "es"
                        ? "Ingresa un PIN numérico de 4 a 6 dígitos."
                        : "Informe um PIN numérico de 4 a 6 dígitos.",
                    );
                    return;
                  }
                  if (trimmedReason.length < 3) {
                    setReopenError(
                      locale === "es"
                        ? "Informa el motivo de la reapertura (mínimo 3 caracteres)."
                        : "Informe o motivo da reabertura (mínimo 3 caracteres).",
                    );
                    return;
                  }

                  setReopening(true);
                  setReopenError("");
                  try {
                    await apiRequest(`/finance/orders/${encodeURIComponent(reopenTarget.id)}/reopen`, {
                      method: "POST",
                      body: { pin: trimmedPin, reason: trimmedReason },
                    });
                    const targetId = reopenTarget.id;
                    setReopenTarget(null);
                    setReopenPin("");
                    setReopenReason("");
                    toast.success(
                      locale === "es"
                        ? "Comanda reabierta con éxito. Liberada para edición."
                        : "Comanda reaberta com sucesso! Liberada para edição.",
                    );
                    router.push(`/owner/finance/orders/new?orderId=${encodeURIComponent(targetId)}`);
                  } catch (err) {
                    if (err instanceof ApiError) {
                      if (err.message === "OWNER_PIN_NOT_CONFIGURED") {
                        setHasOwnerPin(false);
                      } else if (err.message === "OWNER_PIN_INVALID") {
                        setReopenError(
                          locale === "es"
                            ? "PIN del Dueño incorrecto. Inténtalo nuevamente."
                            : "PIN do Dono incorreto. Tente novamente.",
                        );
                      } else {
                        setReopenError(err.message);
                      }
                    } else {
                      setReopenError(
                        locale === "es"
                          ? "No fue posible reabrir la comanda."
                          : "Não foi possível reabrir a comanda.",
                      );
                    }
                  } finally {
                    setReopening(false);
                  }
                }}
              >
                <div className="space-y-1">
                  <label htmlFor="reopen-pin-input" className="block text-xs font-semibold text-ink-secondary">
                    {locale === "es" ? "PIN del Dueño (4 a 6 dígitos)" : "PIN do Dono (4 a 6 dígitos)"}
                  </label>
                  <input
                    id="reopen-pin-input"
                    type="password"
                    inputMode="numeric"
                    pattern="\d{4,6}"
                    minLength={4}
                    maxLength={6}
                    autoComplete="off"
                    required
                    disabled={reopening}
                    value={reopenPin}
                    onChange={(e) => setReopenPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••"
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-sm tracking-widest text-ink outline-none focus-visible:border-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="reopen-reason-input" className="block text-xs font-semibold text-ink-secondary">
                    {locale === "es" ? "Motivo de la reapertura *" : "Motivo da reabertura *"}
                  </label>
                  <textarea
                    id="reopen-reason-input"
                    rows={3}
                    required
                    minLength={3}
                    maxLength={500}
                    disabled={reopening}
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder={
                      locale === "es"
                        ? "Ej.: Cliente agregó un producto después del cierre..."
                        : "Ex.: Cliente adicionou produto após o fechamento..."
                    }
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink outline-none focus-visible:border-accent"
                  />
                </div>

                {reopenError && (
                  <p role="alert" className="text-xs font-medium text-rose-500">
                    {reopenError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    disabled={reopening}
                    onClick={() => setReopenTarget(null)}
                    className="cursor-pointer rounded-xl border border-border-subtle px-3 py-2 text-xs font-semibold text-ink-secondary hover:text-ink disabled:opacity-50"
                  >
                    {locale === "es" ? "Cancelar" : "Cancelar"}
                  </button>
                  <button
                    type="submit"
                    disabled={reopening}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
                  >
                    {reopening && <Loader2 size={13} className="animate-spin" />}
                    {locale === "es" ? "Autorizar y Reabrir" : "Autorizar e Reabrir"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal compacto de escolha do tipo de venda */}
      {newSaleChoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="fixed inset-0" onClick={() => setNewSaleChoiceOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-sale-choice-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-border-strong bg-surface p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="new-sale-choice-title" className="text-base font-bold text-ink">
                  O que deseja vender?
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">Escolha o tipo de venda.</p>
              </div>
              <button
                type="button"
                onClick={() => setNewSaleChoiceOpen(false)}
                aria-label="Fechar"
                className="grid size-8 place-items-center rounded-lg text-ink-secondary hover:bg-surface-hover hover:text-ink cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setNewSaleChoiceOpen(false);
                  router.push("/owner/finance/orders/new");
                }}
                className="flex min-h-11 items-center justify-center rounded-xl bg-[#00A8C6] hover:bg-[#0092AD] px-4 py-2.5 text-xs font-bold text-white transition-colors shadow-xs cursor-pointer"
              >
                Produtos e Serviços
              </button>

              <button
                type="button"
                onClick={() => {
                  setNewSaleChoiceOpen(false);
                  router.push("/owner/services/packages");
                }}
                className="flex min-h-11 items-center justify-center rounded-xl bg-[#131B2E] hover:bg-[#1E293B] px-4 py-2.5 text-xs font-bold text-white transition-colors shadow-xs cursor-pointer"
              >
                Crédito de Pacote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de Venda / Operação Rápida */}
      {operation && (
        <FinanceOperationDialog
          operation={operation}
          timezone={timezone}
          money={(cents) => formatPriceFromCents(cents, locale, currency)}
          onClose={() => setOperation(null)}
          onSaved={() => {
            setOperation(null);
            resetFilters();
            void loadData();
          }}
        />
      )}
    </div>
  );
}
