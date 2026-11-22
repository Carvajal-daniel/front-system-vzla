"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CreditCard,
  DollarSign,
  Download,
  Filter,
  History,
  Loader2,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone, formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import type { FinanceExpense, PaymentMethod } from "@/lib/types/finance";

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

interface CashMovement {
  id: string;
  type: "INCOME" | "OUTFLOW" | "DEDUCTION";
  description: string;
  amountCents: number;
  occurredAt: string;
  paymentMethod?: PaymentMethod | null;
  category?: string;
}

export default function FinancialStatementPage() {
  const { session } = useSession();
  const { locale, t } = useLocale();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";

  const todayIso = useMemo(() => formatIsoInTimezone(new Date(), timezone), [timezone]);
  const [fromDate, setFromDate] = useState(() => {
    const [y, m] = todayIso.split("-").map(Number);
    return formatIsoInTimezone(new Date(Date.UTC(y, m - 1, 1)), timezone);
  });
  const [toDate, setToDate] = useState(() => {
    const [y, m] = todayIso.split("-").map(Number);
    return formatIsoInTimezone(new Date(Date.UTC(y, m, 0)), timezone);
  });

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cashMovementsRes, expensesRes] = await Promise.all([
        apiRequest<
          {
            id: string;
            type: "INCOME" | "REFUND";
            amountCents: number;
            method: PaymentMethod;
            createdAt: string;
            description?: string;
          }[]
        >("/finance/cash-movements", {
          query: { from: fromDate, to: toDate },
        }).catch(() => []),
        apiRequest<{ items: FinanceExpense[] } | FinanceExpense[]>("/finance/expenses", {
          query: { from: fromDate, to: toDate, status: "PAID" },
        }).catch(() => []),
      ]);

      const unified: CashMovement[] = [];

      // Converte movimentações de entrada do caixa
      const rawMovements = Array.isArray(cashMovementsRes) ? cashMovementsRes : [];
      for (const m of rawMovements) {
        unified.push({
          id: m.id,
          type: m.type === "REFUND" ? "OUTFLOW" : "INCOME",
          description: m.description || (m.type === "REFUND" ? "Estorno / Devolução" : "Recebimento de Comanda"),
          amountCents: m.amountCents,
          occurredAt: m.createdAt,
          paymentMethod: m.method,
          category: "RECEIPT",
        });
      }

      // Converte despesas pagas como saídas
      const rawExpenses = Array.isArray(expensesRes) ? expensesRes : expensesRes.items ?? [];
      for (const exp of rawExpenses) {
        unified.push({
          id: exp.id,
          type: "OUTFLOW",
          description: exp.description,
          amountCents: exp.amountCents,
          occurredAt: exp.paidAt || `${exp.dueDate}T12:00:00.000Z`,
          paymentMethod: exp.paymentMethod,
          category: exp.category,
        });
      }

      // Ordena cronologicamente decrescente
      unified.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
      setMovements(unified);
    } catch {
      toast.error("Erro ao carregar extrato financeiro.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filtra por categoria
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (categoryFilter === "INCOME") return m.type === "INCOME";
      if (categoryFilter === "OUTFLOW") return m.type === "OUTFLOW";
      return true;
    });
  }, [movements, categoryFilter]);

  // 4 KPIs
  const totals = useMemo(() => {
    let incomeCents = 0;
    let outflowCents = 0;

    for (const m of movements) {
      if (m.type === "INCOME") incomeCents += m.amountCents;
      else outflowCents += m.amountCents;
    }

    const netPeriodCents = incomeCents - outflowCents;
    const discountCents = 0; // Descontos concedidos

    return { incomeCents, outflowCents, discountCents, netPeriodCents };
  }, [movements]);

  // Exportação CSV
  const handleExportCsv = () => {
    if (filteredMovements.length === 0) {
      toast.warning("Não há movimentações para exportar.");
      return;
    }

    const headers = ["Data e Hora", "Tipo", "Descrição", "Meio de Pagamento", "Valor (R$)"];
    const rows = filteredMovements.map((m) => {
      const dt = formatDateTimeInTimezone(m.occurredAt, timezone, locale);
      const typeLabel = m.type === "INCOME" ? "Entrada" : "Saída";
      const valueFormatted = ((m.type === "OUTFLOW" ? -1 : 1) * (m.amountCents / 100)).toFixed(2);

      return [
        `"${dt}"`,
        `"${typeLabel}"`,
        `"${m.description.replace(/"/g, '""')}"`,
        `"${m.paymentMethod || "Caixa"}"`,
        valueFormatted,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `extrato_financeiro_${fromDate}_a_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Extrato CSV exportado com sucesso!");
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <History className="size-6 text-accent" />
            Controle Financeiro / Extrato
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Histórico cronológico detalhado de todas as entradas de comandas e saídas de caixa.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || filteredMovements.length === 0}
            className="flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
          >
            <Download size={14} />
            Salvar em CSV
          </button>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors"
            title="Atualizar extrato"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 4 KPIs do Extrato */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
            Receitas do Período
          </span>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            <SensitiveValue>
              {formatPriceFromCents(totals.incomeCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Entradas de serviços e vendas</p>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-xs">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
            Despesas Pagas
          </span>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            -
            <SensitiveValue>
              {formatPriceFromCents(totals.outflowCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Saídas operacionais liquidadas</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Descontos / Sangrias
          </span>
          <div className="mt-2 text-2xl font-bold text-ink">
            <SensitiveValue>
              {formatPriceFromCents(totals.discountCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Descontos e retiradas registradas</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Saldo Operacional Líquido
          </span>
          <div
            className={`mt-2 text-2xl font-bold ${
              totals.netPeriodCents >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            <SensitiveValue>
              {formatPriceFromCents(totals.netPeriodCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Resultado financeiro do período</p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
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
            <span className="font-semibold text-ink-secondary">Tipo:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-border-subtle bg-canvas/40 px-2.5 py-1.5 text-xs text-ink"
            >
              <option value="ALL">Todas as Movimentações</option>
              <option value="INCOME">Apenas Entradas (Receitas)</option>
              <option value="OUTFLOW">Apenas Saídas (Despesas)</option>
            </select>
          </div>
        </div>

        <span className="text-xs text-ink-muted">{filteredMovements.length} lançamento(s)</span>
      </div>

      {/* Tabela de Extrato */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="mt-3 text-xs text-ink-muted">Consolidando extrato do caixa...</p>
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted">
            Nenhuma movimentação registrada no período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Data e Hora</th>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Meio de Pagamento</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {filteredMovements.map((m) => {
                  const dateStr = formatDateTimeInTimezone(m.occurredAt, timezone, locale);
                  const isIncome = m.type === "INCOME";

                  return (
                    <tr key={m.id} className="hover:bg-canvas/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-ink whitespace-nowrap">
                        {dateStr}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {isIncome ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <ArrowUpRight size={12} />
                            Entrada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
                            <ArrowDownLeft size={12} />
                            Saída
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 min-w-[200px]">
                        <p className="font-semibold text-ink">{m.description}</p>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-ink-secondary">
                        {m.paymentMethod ?? "Caixa Geral"}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap font-bold text-sm">
                        <span
                          className={
                            isIncome
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }
                        >
                          {isIncome ? "+" : "-"}
                          <SensitiveValue>
                            {formatPriceFromCents(m.amountCents, locale, currency)}
                          </SensitiveValue>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
