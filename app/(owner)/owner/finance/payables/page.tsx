"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  DollarSign,
  Filter,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Tag,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import type {
  ExpenseCategory,
  ExpenseStatus,
  FinanceExpense,
  PaymentMethod,
} from "@/lib/types/finance";

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

const categoryLabels: Record<ExpenseCategory, string> = {
  STOCK_PURCHASE: "Compra de Estoque",
  RENT: "Aluguel",
  UTILITIES: "Contas (Luz, Água, Internet)",
  MARKETING: "Marketing / Anúncios",
  MAINTENANCE: "Manutenção",
  OTHER: "Outros Gastos",
};

export default function PayablesReceivablesPage() {
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

  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [receivablesDebtCents, setReceivablesDebtCents] = useState(0);
  const [receivablesCollectedCents, setReceivablesCollectedCents] = useState(0);

  // Modal de Criação de Despesa
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>("UTILITIES");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDueDate, setExpenseDueDate] = useState(todayIso);
  const [savingExpense, setSavingExpense] = useState(false);

  const searchParams = useSearchParams();
  const actionParam = searchParams.get("action");

  useEffect(() => {
    if (actionParam === "new-payable") {
      setExpenseModalOpen(true);
    }
  }, [actionParam]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [expensesRes, summaryRes] = await Promise.all([
        apiRequest<{ items: FinanceExpense[] } | FinanceExpense[]>("/finance/expenses", {
          query: { from: fromDate, to: toDate },
        }),
        apiRequest<{ realizedRevenueInCents: number }>("/finance/summary", {
          query: { from: fromDate, to: toDate },
        }).catch(() => null),
      ]);

      const list = Array.isArray(expensesRes) ? expensesRes : expensesRes.items ?? [];
      setExpenses(list);
      setReceivablesCollectedCents(summaryRes?.realizedRevenueInCents ?? 0);

      // Busca estimativa de débitos a receber (fiado)
      const appsRes = await apiRequest<{ id: string; servicePriceInCentsSnapshot: number }[]>(
        "/appointments",
        {
          query: { from: `${fromDate}T00:00:00.000Z`, to: `${toDate}T23:59:59.999Z` },
        },
      ).catch(() => []);

      if (appsRes.length > 0) {
        const ids = appsRes.map((a) => a.id);
        const paymentsRes = await apiRequest<{ openInCents: number }[]>(
          "/finance/appointments/payment-summary",
          {
            query: { ids: ids.slice(0, 100).join(",") },
          },
        ).catch(() => []);
        const totalOpenDebt = paymentsRes.reduce((sum, item) => sum + item.openInCents, 0);
        setReceivablesDebtCents(totalOpenDebt);
      } else {
        setReceivablesDebtCents(0);
      }
    } catch {
      toast.error("Erro ao carregar contas a pagar e receber.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // 4 KPIs
  const kpis = useMemo(() => {
    let pendingPayablesCents = 0;
    let paidPayablesCents = 0;

    for (const exp of expenses) {
      if (exp.status === "PAID") {
        paidPayablesCents += exp.amountCents;
      } else {
        pendingPayablesCents += exp.amountCents;
      }
    }

    return {
      pendingPayablesCents,
      paidPayablesCents,
      receivablesDebtCents,
      receivablesCollectedCents,
    };
  }, [expenses, receivablesDebtCents, receivablesCollectedCents]);

  // Despesas agrupadas por categoria
  const categoryTotals = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    for (const exp of expenses) {
      map.set(exp.category, (map.get(exp.category) ?? 0) + exp.amountCents);
    }
    return Array.from(map.entries())
      .map(([category, amountCents]) => ({ category, amountCents }))
      .sort((a, b) => b.amountCents - a.amountCents);
  }, [expenses]);

  // Ação rápida: Dar baixa (pagar conta)
  const handlePayExpense = async (id: string) => {
    try {
      await apiRequest(`/finance/expenses/${id}/pay`, {
        method: "PATCH",
        body: { paidOn: todayIso, paymentMethod: "PIX" },
      });
      toast.success("Conta baixada e marcada como paga!");
      void loadData();
    } catch {
      toast.error("Erro ao dar baixa na conta.");
    }
  };

  // Ação rápida: Excluir despesa
  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta conta a pagar?")) return;
    try {
      await apiRequest(`/finance/expenses/${id}`, { method: "DELETE" });
      toast.success("Conta removida com sucesso!");
      void loadData();
    } catch {
      toast.error("Erro ao excluir conta.");
    }
  };

  // Salvar Nova Conta a Pagar / Ordem de Compra
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = Math.round(Number(expenseAmount.replace(",", ".")) * 100);
    if (!cents || cents <= 0) {
      toast.warning("Informe um valor válido em reais.");
      return;
    }

    setSavingExpense(true);
    try {
      await apiRequest("/finance/expenses", {
        method: "POST",
        body: {
          description: expenseDescription.trim(),
          category: expenseCategory,
          expenseType: "VARIABLE",
          amountCents: cents,
          dueDate: expenseDueDate,
          isRecurring: false,
        },
      });

      toast.success("Conta a pagar registrada com sucesso!");
      setExpenseModalOpen(false);
      setExpenseDescription("");
      setExpenseAmount("");
      void loadData();
    } catch {
      toast.error("Erro ao registrar conta a pagar.");
    } finally {
      setSavingExpense(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <Wallet className="size-6 text-accent" />
            Contas a Pagar e a Receber
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Monitore compromissos operacionais, compras de fornecedores e previsão de recebíveis.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setExpenseCategory("UTILITIES");
              setExpenseModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-accent transition-colors cursor-pointer"
          >
            <Plus size={14} />
            + Conta a Pagar
          </button>

          <button
            type="button"
            onClick={() => {
              setExpenseCategory("STOCK_PURCHASE");
              setExpenseDescription("Compra de Produtos / Estoque");
              setExpenseModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs cursor-pointer"
          >
            <Package size={14} />
            + Ordem de Compra
          </button>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors"
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* 4 KPIs Analíticos e Operacionais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-xs">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
            Contas a Pagar (Pendentes)
          </span>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            <SensitiveValue>
              {formatPriceFromCents(kpis.pendingPayablesCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Boletos e contas aguardando quitação</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
          <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
            Contas Pagas
          </span>
          <div className="mt-2 text-2xl font-bold text-ink">
            <SensitiveValue>
              {formatPriceFromCents(kpis.paidPayablesCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Total de saídas liquidadas no período</p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
            Contas a Receber (Fiado)
          </span>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            <SensitiveValue>
              {formatPriceFromCents(kpis.receivablesDebtCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Valores em aberto de clientes</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
            Contas Recebidas
          </span>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            <SensitiveValue>
              {formatPriceFromCents(kpis.receivablesCollectedCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Total de recebíveis já compensados</p>
        </div>
      </div>

      {/* Resumo Visual por Categoria de Despesa */}
      {categoryTotals.length > 0 && (
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3">
            Despesas por Categoria no Período
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {categoryTotals.map((item) => (
              <div
                key={item.category}
                className="rounded-xl border border-border-subtle bg-canvas/40 p-2.5"
              >
                <span className="text-[11px] font-medium text-ink-muted block truncate">
                  {categoryLabels[item.category] ?? item.category}
                </span>
                <span className="text-xs font-bold text-ink mt-1 block">
                  <SensitiveValue>
                    {formatPriceFromCents(item.amountCents, locale, currency)}
                  </SensitiveValue>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtro de Período e Tabela de Contas */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-ink-secondary">Vencimento:</span>
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

          <span className="text-xs text-ink-muted">{expenses.length} registro(s)</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-accent" />
            <p className="mt-3 text-xs text-ink-muted">Buscando contas a pagar...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted">
            Nenhuma despesa ou conta registrada para o período selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-canvas/30 transition-colors">
                    <td className="py-3 px-4 min-w-[160px]">
                      <p className="font-semibold text-ink">{exp.description}</p>
                      {exp.notes && <p className="text-[11px] text-ink-muted">{exp.notes}</p>}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-ink-secondary">
                      {categoryLabels[exp.category] ?? exp.category}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-mono text-ink">
                      {exp.dueDate}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap font-bold text-ink">
                      <SensitiveValue>
                        {formatPriceFromCents(exp.amountCents, locale, currency)}
                      </SensitiveValue>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {exp.status === "PAID" ? (
                        <span className="inline-flex rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Paga
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-500">
                          Pendente
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      {exp.status !== "PAID" && (
                        <button
                          type="button"
                          onClick={() => void handlePayExpense(exp.id)}
                          className="rounded-lg bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors shadow-2xs"
                        >
                          Dar Baixa
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDeleteExpense(exp.id)}
                        className="rounded-lg border border-border-subtle bg-surface p-1 text-ink-muted hover:text-rose-500 hover:border-rose-500/30 transition-colors"
                        title="Excluir conta"
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
      </div>

      {/* Modal: Nova Conta a Pagar / Ordem de Compra */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <Plus size={18} className="text-accent" />
              {expenseCategory === "STOCK_PURCHASE"
                ? "Lançar Ordem de Compra"
                : "Nova Conta a Pagar"}
            </h3>

            <form onSubmit={handleSaveExpense} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-ink-secondary block mb-1">Categoria</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategory)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink"
                >
                  <option value="UTILITIES">Contas (Luz, Água, Internet, Telefone)</option>
                  <option value="RENT">Aluguel / Condomínio</option>
                  <option value="STOCK_PURCHASE">Compra de Produtos / Estoque</option>
                  <option value="MARKETING">Marketing / Redes Sociais</option>
                  <option value="MAINTENANCE">Manutenção e Reformas</option>
                  <option value="OTHER">Outros Gastos Operacionais</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink-secondary block mb-1">
                  Descrição da Conta
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Conta de Luz Enel ou Compra Wella Cosméticos"
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold text-ink-secondary block mb-1">
                    Valor da Conta (R$)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 350,00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink font-mono"
                  />
                </div>

                <div>
                  <label className="font-semibold text-ink-secondary block mb-1">
                    Data de Vencimento
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDueDate}
                    onChange={(e) => setExpenseDueDate(e.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-ink"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-ink-secondary hover:text-ink transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingExpense}
                  className="rounded-xl bg-accent px-4 py-2 font-bold text-accent-ink hover:bg-accent-hover transition-colors disabled:opacity-50"
                >
                  {savingExpense ? "Salvando..." : "Confirmar Conta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
