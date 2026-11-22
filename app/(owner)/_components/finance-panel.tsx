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
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Upload,
  User,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone, formatPriceFromCents, formatTimeInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import type { Appointment } from "@/lib/types/appointment";
import type { FinanceDay, FinanceSummaryResponse, PaymentMethod } from "@/lib/types/finance";
import type { Collaborator } from "@/lib/types/team";
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
  const [paymentsMap, setPaymentsMap] = useState<Map<string, PaymentSummaryItem>>(new Map());
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [summary, setSummary] = useState<FinanceSummaryResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [operation, setOperation] = useState<FinanceOperation | null>(null);
  const [newSaleChoiceOpen, setNewSaleChoiceOpen] = useState(false);

  const searchParams = useSearchParams();
  const actionParam = searchParams.get("action");

  useEffect(() => {
    if (actionParam === "new-sale") {
      setNewSaleChoiceOpen(true);
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

      const [summaryRes, appsRes, collabsRes] = await Promise.all([
        apiRequest<FinanceSummaryResponse>("/finance/summary", {
          query: { from: fromDate, to: toDate },
        }).catch(() => null),
        apiRequest<Appointment[]>("/appointments", {
          query: { from: fromIso, to: toIso },
        }),
        apiRequest<{ collaborators: Collaborator[] } | Collaborator[]>("/collaborators"),
      ]);

      setSummary(summaryRes);
      setAppointments(appsRes);
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

  // Lista de comandas filtradas
  const comandas = useMemo(() => {
    const term = search.trim().toLowerCase();
    return appointments
      .filter((app) => app.status !== "CANCELED")
      .map((app) => {
        const payment = paymentsMap.get(app.id);
        const totalInCents = app.servicePriceInCentsSnapshot;
        const paidInCents = payment?.collectedInCents ?? (app.status === "COMPLETED" ? totalInCents : 0);
        const openDebtInCents = payment ? payment.openInCents : app.status === "COMPLETED" ? 0 : totalInCents;
        const isClosed = openDebtInCents === 0 && paidInCents > 0;
        const hasDebt = openDebtInCents > 0;

        return {
          ...app,
          totalInCents,
          paidInCents,
          openDebtInCents,
          isClosed,
          hasDebt,
          methods: payment?.methods ?? [],
        };
      })
      .filter((comanda) => {
        if (statusFilter === "OPEN_DEBT" && !comanda.hasDebt) return false;
        if (statusFilter === "CLOSED" && !comanda.isClosed) return false;
        if (term) {
          const matchClient = comanda.clientName.toLowerCase().includes(term);
          const matchPhone = comanda.clientPhone.toLowerCase().includes(term);
          const matchService = comanda.serviceNameSnapshot.toLowerCase().includes(term);
          if (!matchClient && !matchPhone && !matchService) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }, [appointments, paymentsMap, search, statusFilter]);

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
    if (comandas.length === 0) {
      toast.error("Nenhuma comanda para exportar.");
      return;
    }
    const headers = ["Cliente", "Telefone", "Serviço", "Data/Hora", "Valor Total (R$)", "Valor Pago (R$)", "Saldo Devedor (R$)", "Status"];
    const rows = comandas.map((c) => [
      `"${c.clientName.replace(/"/g, '""')}"`,
      `"${c.clientPhone}"`,
      `"${c.serviceNameSnapshot.replace(/"/g, '""')}"`,
      `"${formatDateTimeInTimezone(c.startsAt, timezone, locale)}"`,
      (c.totalInCents / 100).toFixed(2),
      (c.paidInCents / 100).toFixed(2),
      (c.openDebtInCents / 100).toFixed(2),
      c.hasDebt ? "Em aberto (Fiado)" : c.isClosed ? "Fechada" : "Pendente",
    ]);
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comandas-${fromDate}-a-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV de comandas exportado com sucesso!");
  }

  function handleImportCsv() {
    toast.info("Importação de CSV: selecione um arquivo de vendas ou extrato bancário para conciliação.");
  }

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* TOPO COMPACTO: GESTÃO OPERACIONAL DE COMANDAS */}
      {/* ======================================================== */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Receipt className="size-6 text-accent" />
            Gestão Operacional de Comandas
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Registre vendas, controle comandas abertas (fiado) e receba pagamentos no balcão.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="grid size-10 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Grid de 3 Cards: Caixa (com Nova Venda), Gráfico Diário e Donut de Pagamentos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Card 1: Caixa com Ação Rápida de Nova Venda */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide flex items-center gap-1.5">
                <Wallet className="size-4 text-accent" />
                Caixa & Faturamento
              </span>
              <button
                type="button"
                onClick={() => setNewSaleChoiceOpen(true)}
                className="inline-flex items-center gap-1 rounded-lg bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent hover:bg-accent/25 transition-colors cursor-pointer"
              >
                <Plus size={12} />
                Nova venda
              </button>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-ink">
                <SensitiveValue>
                  {formatPriceFromCents(comandasTotals.totalCents, locale, currency)}
                </SensitiveValue>
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {comandas.length} comanda(s) no período selecionado
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border-subtle/60 pt-3">
            <div className="rounded-xl bg-emerald-500/10 p-2.5 border border-emerald-500/20">
              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 block">
                Total Recebido
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                <SensitiveValue>
                  {formatPriceFromCents(comandasTotals.paidCents, locale, currency)}
                </SensitiveValue>
              </span>
            </div>

            <div className="rounded-xl bg-rose-500/10 p-2.5 border border-rose-500/20">
              <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 block">
                Saldo Devedor (Fiado)
              </span>
              <span className="text-sm font-bold text-rose-600 dark:text-rose-400">
                <SensitiveValue>
                  {formatPriceFromCents(comandasTotals.debtCents, locale, currency)}
                </SensitiveValue>
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Mini-Gráfico Diário de Receitas x Despesas */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                Receitas x Despesas Diárias
              </span>
              <span className="text-[11px] text-ink-muted">Últimos dias</span>
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
            <span className="text-ink-muted text-[11px]">Total no Meio:</span>
            <span className="font-bold text-ink">
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
            <span className="font-semibold text-ink-secondary">Período:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
            />
            <span className="text-ink-muted">até</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleImportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:text-ink hover:border-accent transition-colors cursor-pointer"
            >
              <Upload size={13} />
              Importar CSV
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:text-ink hover:border-accent transition-colors cursor-pointer"
            >
              <Download size={13} />
              Exportar CSV
            </button>

            <Link
              href="/owner/finance/orders/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-xs font-bold text-accent-ink hover:bg-accent-hover transition-colors cursor-pointer"
            >
              <Plus size={13} />
              + Nova comanda
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
              className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors"
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => {
                setFromDate(formatIsoInTimezone(new Date(Date.now() - 7 * dayInMs), timezone));
                setToDate(todayIso);
              }}
              className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors"
            >
              7 dias
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
              className="rounded-lg px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink hover:bg-surface transition-colors"
            >
              Este mês
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_220px] flex-1 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-muted" />
              <input
                type="text"
                placeholder="Buscar comanda por cliente, telefone ou serviço..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border-subtle bg-canvas/40 pl-9 pr-3 py-1.5 text-xs text-ink outline-none focus-visible:border-accent"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "ALL" | "OPEN_DEBT" | "CLOSED")}
              className="rounded-xl border border-border-subtle bg-canvas/40 px-3 py-1.5 text-xs text-ink outline-none focus-visible:border-accent"
            >
              <option value="ALL">Todas as Comandas</option>
              <option value="OPEN_DEBT">Em aberto / Fiado (Com débito)</option>
              <option value="CLOSED">Fechadas / Pagas 100%</option>
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
                  const collab = collaboratorMap.get(cmd.collaboratorId);
                  const dateStr = formatDateTimeInTimezone(cmd.startsAt, timezone, locale);

                  return (
                    <tr
                      key={cmd.id}
                      onClick={() => setReceiptId(cmd.id)}
                      className="hover:bg-canvas/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-ink whitespace-nowrap">
                        <span className="block font-semibold">#{cmd.id.slice(0, 8)}</span>
                        <span className="text-[11px] text-ink-muted">{dateStr}</span>
                      </td>

                      <td className="py-3 px-4 min-w-[130px]">
                        <p className="font-semibold text-ink group-hover:text-accent transition-colors">
                          {cmd.clientName}
                        </p>
                        <p className="text-[11px] text-ink-muted font-mono">{cmd.clientPhone}</p>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-ink-secondary">
                        {collab?.name ?? "Profissional"}
                      </td>

                      <td className="py-3 px-4 max-w-[180px] truncate text-ink font-medium">
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
                          <span className="text-ink-muted text-[11px]">R$ 0,00</span>
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
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReceiptId(cmd.id);
                          }}
                          className="rounded-lg bg-surface border border-border-subtle px-2.5 py-1 text-xs font-semibold text-ink hover:border-accent hover:text-accent transition-colors shadow-2xs"
                        >
                          {cmd.hasDebt ? "Cobrar" : "Ver Recibo"}
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

      {/* Modal de Recebimento / Comanda */}
      {receiptId && (
        <ReceiptDialog
          appointmentId={receiptId}
          timezone={timezone}
          onClose={() => {
            setReceiptId(null);
            void loadData();
          }}
        />
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
                  setOperation({ kind: "create" });
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
            void loadData();
          }}
        />
      )}
    </div>
  );
}
