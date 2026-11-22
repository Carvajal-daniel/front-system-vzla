"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock3,
  DollarSign,
  ExternalLink,
  Flame,
  HandCoins,
  History,
  Loader2,
  MessageCircle,
  Package,
  Receipt,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  User,
  UserCheck,
  UserX,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone, formatPriceFromCents, formatTimeInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import type { Appointment } from "@/lib/types/appointment";
import type {
  CommissionReport,
  FinanceExpense,
  FinanceSummaryResponse,
} from "@/lib/types/finance";
import type { Collaborator } from "@/lib/types/team";

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
  collectedInCents: number;
  openInCents: number;
}

export default function FinanceReportAnalyticsPage() {
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

  const [summary, setSummary] = useState<FinanceSummaryResponse | null>(null);
  const [commissionReport, setCommissionReport] = useState<CommissionReport | null>(null);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [paymentsMap, setPaymentsMap] = useState<Map<string, PaymentSummaryItem>>(new Map());
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);

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

      const [summaryRes, commsRes, expensesRes, appsRes, collabsRes] = await Promise.all([
        apiRequest<FinanceSummaryResponse>("/finance/summary", {
          query: { from: fromDate, to: toDate },
        }).catch(() => null),
        apiRequest<CommissionReport>("/finance/commissions", {
          query: { from: fromDate, to: toDate },
        }).catch(() => null),
        apiRequest<{ items: FinanceExpense[] } | FinanceExpense[]>("/finance/expenses", {
          query: { from: fromDate, to: toDate },
        }).catch(() => []),
        apiRequest<Appointment[]>("/appointments", {
          query: { from: fromIso, to: toIso },
        }).catch(() => []),
        apiRequest<{ collaborators: Collaborator[] } | Collaborator[]>("/collaborators").catch(
          () => [],
        ),
      ]);

      setSummary(summaryRes);
      setCommissionReport(commsRes);
      setExpenses(Array.isArray(expensesRes) ? expensesRes : expensesRes.items ?? []);
      setAppointments(appsRes);
      setCollaborators(Array.isArray(collabsRes) ? collabsRes : collabsRes.collaborators ?? []);

      // Busca pagamentos de comandas
      if (appsRes.length > 0) {
        const ids = appsRes.map((a) => a.id);
        const batches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
          ids.slice(i * 100, (i + 1) * 100).join(","),
        );
        const pList = await Promise.all(
          batches.map((batch) =>
            apiRequest<PaymentSummaryItem[]>("/finance/appointments/payment-summary", {
              query: { ids: batch },
            }).catch(() => []),
          ),
        );
        const map = new Map<string, PaymentSummaryItem>();
        for (const item of pList.flat()) {
          map.set(item.appointmentId, item);
        }
        setPaymentsMap(map);
      } else {
        setPaymentsMap(new Map());
      }
    } catch {
      toast.error("Erro ao carregar dados analíticos de finanças.");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // 4 KPIs Analíticos
  const analyticsKpis = useMemo(() => {
    // 1) Comissão Acumulada
    const accumulatedCommissionsCents =
      commissionReport?.professionals.reduce((sum, p) => sum + p.payableInCents, 0) ??
      summary?.summary?.realizedCommissionsInCents ??
      0;

    // 2) Total de Saídas / Sangrias (Despesas pagas + Deduções)
    const totalOutflowsCents =
      expenses.filter((e) => e.status === "PAID").reduce((sum, e) => sum + e.amountCents, 0) +
      (commissionReport?.professionals.reduce((sum, p) => sum + p.deductionsInCents, 0) ?? 0);

    // 3 e 4) Comandas Abertas (qtd) e Fechadas (qtd)
    let openOrdersCount = 0;
    let closedOrdersCount = 0;

    for (const a of appointments) {
      if (a.status === "CANCELED") continue;
      const payment = paymentsMap.get(a.id);
      const openDebt = payment ? payment.openInCents : a.status === "COMPLETED" ? 0 : a.servicePriceInCentsSnapshot;
      if (openDebt > 0) {
        openOrdersCount += 1;
      } else {
        closedOrdersCount += 1;
      }
    }

    return {
      accumulatedCommissionsCents,
      totalOutflowsCents,
      openOrdersCount,
      closedOrdersCount,
    };
  }, [commissionReport, summary, expenses, appointments, paymentsMap]);

  // Bloco 1: Serviços Faturados por Profissional
  const revenueByCollaborator = useMemo(() => {
    const map = new Map<string, { count: number; revenueCents: number }>();

    for (const a of appointments) {
      if (a.status === "CANCELED") continue;
      const entry = map.get(a.collaboratorId) ?? { count: 0, revenueCents: 0 };
      entry.count += 1;
      entry.revenueCents += a.servicePriceInCentsSnapshot;
      map.set(a.collaboratorId, entry);
    }

    const totalRev = Array.from(map.values()).reduce((sum, x) => sum + x.revenueCents, 0);

    return Array.from(map.entries())
      .map(([collabId, data]) => {
        const collab = collaboratorMap.get(collabId);
        return {
          id: collabId,
          name: collab?.name ?? "Profissional",
          avatarUrl: collab?.avatarUrl ?? null,
          specialty: collab?.specialty ?? "Geral",
          count: data.count,
          revenueCents: data.revenueCents,
          ticketAverageCents: data.count > 0 ? Math.round(data.revenueCents / data.count) : 0,
          share: totalRev > 0 ? (data.revenueCents / totalRev) * 100 : 0,
        };
      })
      .sort((a, b) => b.revenueCents - a.revenueCents);
  }, [appointments, collaboratorMap]);

  // Bloco 2: Lista de Contas a Pagar no Período
  const pendingBills = useMemo(() => {
    return expenses
      .filter((e) => e.status !== "PAID")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5);
  }, [expenses]);

  // Bloco 3: Quantidade de Serviços por Profissional
  const servicesVolumeByCollab = useMemo(() => {
    return [...revenueByCollaborator].sort((a, b) => b.count - a.count);
  }, [revenueByCollaborator]);

  // Bloco 4 (Prioritário): Clientes com Débitos (Fiado)
  const debitClients = useMemo(() => {
    const list: {
      appointmentId: string;
      clientName: string;
      clientPhone: string;
      serviceName: string;
      date: string;
      openDebtCents: number;
    }[] = [];

    for (const a of appointments) {
      if (a.status === "CANCELED") continue;
      const payment = paymentsMap.get(a.id);
      const openDebt = payment ? payment.openInCents : a.status === "COMPLETED" ? 0 : a.servicePriceInCentsSnapshot;

      if (openDebt > 0) {
        list.push({
          appointmentId: a.id,
          clientName: a.clientName,
          clientPhone: a.clientPhone,
          serviceName: a.serviceNameSnapshot,
          date: a.startsAt,
          openDebtCents: openDebt,
        });
      }
    }

    return list.sort((a, b) => b.openDebtCents - a.openDebtCents);
  }, [appointments, paymentsMap]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <TrendingUp className="size-6 text-accent" />
            Painel Financeiro Analítico
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Visão consolidada de rentabilidade, produtividade da equipe e clientes com saldo devedor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/owner/finance"
            className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-accent transition-colors"
          >
            Ir para Comandas
            <ExternalLink size={13} />
          </Link>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors"
            title="Atualizar relatório"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filtro de Período */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-ink-secondary">Período de Análise:</span>
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

        <div className="flex rounded-xl border border-border-subtle bg-canvas/40 p-1 text-xs">
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
      </div>

      {/* 4 KPIs Analíticos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
              Comissão Acumulada
            </span>
            <span className="grid size-8 place-items-center rounded-lg bg-blue-500/10 text-blue-500">
              <HandCoins size={16} />
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold text-ink">
            <SensitiveValue>
              {formatPriceFromCents(analyticsKpis.accumulatedCommissionsCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Gerado para profissionais no período</p>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
              Total de Saídas / Sangrias
            </span>
            <span className="grid size-8 place-items-center rounded-lg bg-rose-500/10 text-rose-500">
              <TrendingDown size={16} />
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold text-rose-600 dark:text-rose-400">
            <SensitiveValue>
              {formatPriceFromCents(analyticsKpis.totalOutflowsCents, locale, currency)}
            </SensitiveValue>
          </div>
          <p className="mt-1 text-xs text-ink-muted">Contas pagas + vales de colaboradores</p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
              Comandas Abertas (Fiado)
            </span>
            <span className="grid size-8 place-items-center rounded-lg bg-amber-500/10 text-amber-500">
              <Clock3 size={16} />
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {analyticsKpis.openOrdersCount}
          </div>
          <p className="mt-1 text-xs text-ink-muted">Atendimentos aguardando quitação total</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
              Comandas Fechadas
            </span>
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {analyticsKpis.closedOrdersCount}
          </div>
          <p className="mt-1 text-xs text-ink-muted">Comandas 100% liquidadas no caixa</p>
        </div>
      </div>

      {/* Grid com 4 Blocos de Análise */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bloco 1: Serviços Faturados por Profissional */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <UserCheck size={16} className="text-accent" />
                Serviços Faturados por Profissional
              </h3>
              <p className="text-[11px] text-ink-muted">
                Ranking de faturamento bruto gerado na bancada
              </p>
            </div>
            <Link
              href="/owner/finance/commissions"
              className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
            >
              Comissões
              <ExternalLink size={12} />
            </Link>
          </div>

          <div className="space-y-2 pt-2">
            {revenueByCollaborator.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-muted">Sem faturamento no período.</p>
            ) : (
              revenueByCollaborator.slice(0, 5).map((collab, index) => (
                <div
                  key={collab.id}
                  className="rounded-xl border border-border-subtle/60 bg-canvas/40 p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="grid size-5 place-items-center rounded-full bg-accent/10 text-[10px] font-bold text-accent shrink-0">
                        {index + 1}
                      </span>
                      <p className="text-xs font-semibold text-ink truncate">{collab.name}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-ink">
                        <SensitiveValue>
                          {formatPriceFromCents(collab.revenueCents, locale, currency)}
                        </SensitiveValue>
                      </span>
                      <span className="block text-[10px] text-ink-muted">
                        Ticket médio:{" "}
                        <SensitiveValue>
                          {formatPriceFromCents(collab.ticketAverageCents, locale, currency)}
                        </SensitiveValue>
                      </span>
                    </div>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-border-subtle overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.max(5, collab.share))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bloco 2: Lista de Contas a Pagar no Período */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <Receipt size={16} className="text-rose-500" />
                Próximas Contas a Pagar no Período
              </h3>
              <p className="text-[11px] text-ink-muted">
                Compromissos pendentes com vencimento próximo
              </p>
            </div>
            <Link
              href="/owner/finance/payables"
              className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1"
            >
              Ver todas
              <ExternalLink size={12} />
            </Link>
          </div>

          <div className="space-y-2 pt-2">
            {pendingBills.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-muted">
                Nenhuma conta pendente para este período!
              </p>
            ) : (
              pendingBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between rounded-xl border border-border-subtle/60 bg-canvas/40 p-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-ink">{bill.description}</p>
                    <p className="text-[11px] text-ink-muted">Vence em: {bill.dueDate}</p>
                  </div>
                  <span className="text-xs font-bold text-rose-500">
                    <SensitiveValue>
                      {formatPriceFromCents(bill.amountCents, locale, currency)}
                    </SensitiveValue>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bloco 3: Quantidade de Serviços por Profissional */}
        <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <Flame size={16} className="text-amber-500" />
                Volume de Serviços por Profissional
              </h3>
              <p className="text-[11px] text-ink-muted">Quantidade de atendimentos finalizados</p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            {servicesVolumeByCollab.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-muted">Nenhum serviço registrado.</p>
            ) : (
              servicesVolumeByCollab.slice(0, 5).map((collab) => (
                <div
                  key={collab.id}
                  className="flex items-center justify-between rounded-xl border border-border-subtle/60 bg-canvas/40 p-3"
                >
                  <p className="text-xs font-semibold text-ink">{collab.name}</p>
                  <span className="text-xs font-bold text-ink">
                    {collab.count} {collab.count === 1 ? "atendimento" : "atendimentos"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Bloco 4 (PRIORITÁRIO): Clientes com Débitos (Fiado) */}
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-500" />
                Clientes com Débitos (Fiado)
              </h3>
              <p className="text-[11px] text-ink-muted">
                Cobranças pendentes de clientes com saldo devedor
              </p>
            </div>
            <Link
              href="/owner/finance"
              className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1"
            >
              Cobrar Comandas
              <ExternalLink size={12} />
            </Link>
          </div>

          <div className="space-y-2 pt-2 max-h-64 overflow-y-auto pr-1">
            {debitClients.length === 0 ? (
              <p className="py-6 text-center text-xs text-ink-muted">
                Parabéns! Não há débitos de fiado pendentes no período.
              </p>
            ) : (
              debitClients.map((client) => {
                const dateStr = formatDateTimeInTimezone(client.date, timezone, locale);
                const digits = client.clientPhone.replace(/\D/g, "");
                const waLink = digits ? `https://wa.me/55${digits}` : null;

                return (
                  <div
                    key={client.appointmentId}
                    className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-surface p-3"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-ink truncate">{client.clientName}</p>
                      <p className="text-[10px] text-ink-muted font-mono">{client.clientPhone}</p>
                      <p className="text-[10px] text-ink-muted truncate">
                        {client.serviceName} · {dateStr.split(" ")[0]}
                      </p>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <span className="text-xs font-bold text-rose-500 block">
                        <SensitiveValue>
                          {formatPriceFromCents(client.openDebtCents, locale, currency)}
                        </SensitiveValue>
                      </span>
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          <MessageCircle size={11} />
                          Cobrar WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
