"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Clock3,
  ExternalLink,
  Flame,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone, formatPrice, getCurrencyFormatter } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import type { Appointment, AppointmentStatus } from "@/lib/types/appointment";
import type { Collaborator } from "@/lib/types/team";

type PeriodFilter = "week" | "month" | "30days";

interface StatusConfig {
  label: string;
  color: string;
  bgLight: string;
  badgeClass: string;
  icon: typeof CheckCircle2;
}

const statusConfigs: Record<AppointmentStatus, StatusConfig> = {
  COMPLETED: {
    label: "Concluído",
    color: "#10B981",
    bgLight: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
  },
  CONFIRMED: {
    label: "Confirmado",
    color: "#3B82F6",
    bgLight: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    icon: Clock3,
  },
  PENDING: {
    label: "Pendente",
    color: "#F59E0B",
    bgLight: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    icon: Clock,
  },
  CANCELED: {
    label: "Cancelado",
    color: "#EF4444",
    bgLight: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
    icon: XCircle,
  },
  NO_SHOW: {
    label: "Não compareceu",
    color: "#8B5CF6",
    bgLight: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    icon: UserX,
  },
};

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

export function AgendaReportPanel() {
  const { session } = useSession();
  const { locale, t } = useLocale();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";

  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Calcula o intervalo de datas do filtro com base no fuso horário da empresa
  const { periodStart, periodEnd, queryFrom, queryTo } = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (period === "week") {
      start = new Date(now.getTime() - 7 * dayInMs);
      end = now;
    } else if (period === "30days") {
      start = new Date(now.getTime() - 30 * dayInMs);
      end = now;
    } else {
      // Mês atual: do dia 1 do mês até o último dia do mês
      const [year, month] = formatIsoInTimezone(now, timezone).split("-").map(Number);
      start = new Date(Date.UTC(year, month - 1, 1));
      end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    }

    // Consulta de agendamentos no backend incluindo até 30 dias futuros para a lista de próximos
    const fetchStart = new Date(Math.min(start.getTime(), now.getTime() - 60 * dayInMs));
    const fetchEnd = new Date(now.getTime() + 30 * dayInMs);

    return {
      periodStart: start,
      periodEnd: end,
      queryFrom: fetchStart.toISOString(),
      queryTo: `${formatIsoInTimezone(fetchEnd, timezone)}T23:59:59.999Z`,
    };
  }, [period, timezone]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [appointmentsData, collabRaw] = await Promise.all([
        apiRequest<Appointment[]>("/appointments", {
          query: { from: queryFrom, to: queryTo },
        }),
        apiRequest<{ collaborators: Collaborator[] } | Collaborator[]>("/collaborators"),
      ]);

      const collabsList = Array.isArray(collabRaw) ? collabRaw : collabRaw.collaborators ?? [];
      setAppointments(appointmentsData);
      setCollaborators(collabsList);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [queryFrom, queryTo]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Mapa de colaboradores indexado por ID para lookup rápido
  const collaboratorMap = useMemo(() => {
    const map = new Map<string, Collaborator>();
    for (const c of collaborators) {
      map.set(c.id, c);
    }
    return map;
  }, [collaborators]);

  // Agendamentos dentro do período de análise selecionado
  const filteredAppointments = useMemo(() => {
    const startMs = periodStart.getTime();
    const endMs = periodEnd.getTime();
    return appointments.filter((app) => {
      const time = new Date(app.startsAt).getTime();
      return time >= startMs && time <= endMs;
    });
  }, [appointments, periodStart, periodEnd]);

  // Métricas agregadas por status no período
  const statusCounts = useMemo(() => {
    const counts: Record<AppointmentStatus, number> = {
      COMPLETED: 0,
      CONFIRMED: 0,
      PENDING: 0,
      CANCELED: 0,
      NO_SHOW: 0,
    };
    let totalRevenueInCents = 0;

    for (const app of filteredAppointments) {
      if (counts[app.status] !== undefined) {
        counts[app.status] += 1;
      }
      if (app.status === "COMPLETED" || app.status === "CONFIRMED") {
        totalRevenueInCents += app.servicePriceInCentsSnapshot ?? 0;
      }
    }

    const total = filteredAppointments.length;
    const completedRate = total > 0 ? (counts.COMPLETED / total) * 100 : 0;
    const fulfillmentRate = total > 0 ? ((counts.COMPLETED + counts.CONFIRMED) / total) * 100 : 0;

    return {
      counts,
      total,
      totalRevenueInCents,
      completedRate,
      fulfillmentRate,
    };
  }, [filteredAppointments]);

  // Ranking de profissionais mais requisitados
  const topCollaborators = useMemo(() => {
    const map = new Map<string, { count: number; revenueInCents: number }>();
    for (const app of filteredAppointments) {
      const entry = map.get(app.collaboratorId) ?? { count: 0, revenueInCents: 0 };
      entry.count += 1;
      if (app.status === "COMPLETED" || app.status === "CONFIRMED") {
        entry.revenueInCents += app.servicePriceInCentsSnapshot ?? 0;
      }
      map.set(app.collaboratorId, entry);
    }

    const list = Array.from(map.entries()).map(([collabId, data]) => {
      const collab = collaboratorMap.get(collabId);
      return {
        id: collabId,
        name: collab?.name ?? "Profissional",
        avatarUrl: collab?.avatarUrl ?? null,
        specialty: collab?.specialty ?? "Geral",
        count: data.count,
        revenueInCents: data.revenueInCents,
        share: statusCounts.total > 0 ? (data.count / statusCounts.total) * 100 : 0,
      };
    });

    return list.sort((a, b) => b.count - a.count);
  }, [filteredAppointments, collaboratorMap, statusCounts.total]);

  // Ranking dos 5 serviços mais requisitados
  const topServices = useMemo(() => {
    const map = new Map<string, { name: string; count: number; revenueInCents: number }>();
    for (const app of filteredAppointments) {
      const key = app.serviceId || app.serviceNameSnapshot;
      const entry = map.get(key) ?? {
        name: app.serviceNameSnapshot || "Serviço",
        count: 0,
        revenueInCents: 0,
      };
      entry.count += 1;
      if (app.status === "COMPLETED" || app.status === "CONFIRMED") {
        entry.revenueInCents += app.servicePriceInCentsSnapshot ?? 0;
      }
      map.set(key, entry);
    }

    const list = Array.from(map.values()).map((item) => ({
      ...item,
      share: statusCounts.total > 0 ? (item.count / statusCounts.total) * 100 : 0,
    }));

    return list.sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filteredAppointments, statusCounts.total]);

  // Próximos agendamentos futuros a partir de agora
  const upcomingAppointments = useMemo(() => {
    const nowMs = Date.now();
    return appointments
      .filter((app) => new Date(app.startsAt).getTime() >= nowMs && app.status !== "CANCELED")
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .slice(0, 10);
  }, [appointments]);

  const currencyFormatter = useMemo(
    () => getCurrencyFormatter(locale, currency),
    [locale, currency],
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho superior com filtro de período e botão de recarregar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">
            {t.product.agendaReport}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Métricas de volume, distribuição por status, produtividade da equipe e demandas futuras.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex rounded-xl border border-border-subtle bg-surface p-1 text-xs">
            <button
              type="button"
              onClick={() => setPeriod("week")}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                period === "week"
                  ? "bg-accent text-accent-ink shadow-xs"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              7 dias
            </button>
            <button
              type="button"
              onClick={() => setPeriod("month")}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                period === "month"
                  ? "bg-accent text-accent-ink shadow-xs"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              Este mês
            </button>
            <button
              type="button"
              onClick={() => setPeriod("30days")}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                period === "30days"
                  ? "bg-accent text-accent-ink shadow-xs"
                  : "text-ink-secondary hover:text-ink"
              }`}
            >
              30 dias
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            aria-label="Atualizar dados"
            title="Atualizar dados"
            className="grid size-9 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs sm:text-sm text-rose-600 dark:text-rose-400 flex items-center justify-between gap-3">
          <span>Ocorreu um erro ao carregar os relatórios da agenda. Verifique sua conexão.</span>
          <button
            type="button"
            onClick={() => void loadData()}
            className="rounded-lg bg-rose-500 text-white px-3 py-1.5 text-xs font-semibold hover:bg-rose-600 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="size-8 animate-spin text-accent" />
          <p className="mt-3 text-xs text-ink-muted">Processando métricas de agendamento...</p>
        </div>
      ) : (
        <>
          {/* Bento Grid: Cards de Resumo Principal */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Total de Agendamentos</span>
                <span className="grid size-8 place-items-center rounded-lg bg-blue-500/10 text-blue-500">
                  <CalendarDays className="size-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {statusCounts.total}
                </span>
                <span className="text-xs text-ink-muted">no período</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-ink-secondary">
                <TrendingUp className="size-3.5 text-emerald-500" />
                <span>
                  {statusCounts.fulfillmentRate.toFixed(1)}% taxa de realização
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Concluídos com Sucesso</span>
                <span className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="size-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {statusCounts.counts.COMPLETED}
                </span>
                <span className="text-xs text-ink-muted">
                  ({statusCounts.completedRate.toFixed(0)}% do total)
                </span>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                Atendimentos finalizados com pagamento
              </p>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Confirmados & Pendentes</span>
                <span className="grid size-8 place-items-center rounded-lg bg-amber-500/10 text-amber-500">
                  <Clock3 className="size-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {statusCounts.counts.CONFIRMED + statusCounts.counts.PENDING}
                </span>
                <span className="text-xs text-amber-500 font-medium">
                  {statusCounts.counts.PENDING} aguardando
                </span>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                Em andamento ou com horário reservado
              </p>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Perdas (Cancelados / Faltas)</span>
                <span className="grid size-8 place-items-center rounded-lg bg-rose-500/10 text-rose-500">
                  <UserX className="size-4" />
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                  {statusCounts.counts.CANCELED + statusCounts.counts.NO_SHOW}
                </span>
                <span className="text-xs text-ink-muted">
                  {statusCounts.total > 0
                    ? (((statusCounts.counts.CANCELED + statusCounts.counts.NO_SHOW) / statusCounts.total) * 100).toFixed(1)
                    : "0"}%
                </span>
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                {statusCounts.counts.NO_SHOW} faltas sem aviso prévio
              </p>
            </div>
          </div>

          {/* Gráfico/Barra de Distribuição por Status */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 shadow-xs">
            <h3 className="text-sm font-semibold text-ink">Distribuição de Status no Período</h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Proporção visual de cada estágio dos atendimentos registrados
            </p>

            {statusCounts.total === 0 ? (
              <p className="py-8 text-center text-xs text-ink-muted">
                Nenhum agendamento encontrado no período selecionado.
              </p>
            ) : (
              <>
                {/* Barra segmentada */}
                <div className="mt-4 flex h-3.5 w-full overflow-hidden rounded-full bg-border-subtle">
                  {(["COMPLETED", "CONFIRMED", "PENDING", "CANCELED", "NO_SHOW"] as const).map(
                    (st) => {
                      const share = (statusCounts.counts[st] / statusCounts.total) * 100;
                      if (share === 0) return null;
                      return (
                        <div
                          key={st}
                          style={{
                            width: `${share}%`,
                            backgroundColor: statusConfigs[st].color,
                          }}
                          title={`${statusConfigs[st].label}: ${statusCounts.counts[st]} (${share.toFixed(1)}%)`}
                          className="h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full hover:opacity-90"
                        />
                      );
                    },
                  )}
                </div>

                {/* Legendas e valores por status */}
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {(["COMPLETED", "CONFIRMED", "PENDING", "CANCELED", "NO_SHOW"] as const).map(
                    (st) => {
                      const count = statusCounts.counts[st];
                      const share = statusCounts.total > 0 ? (count / statusCounts.total) * 100 : 0;
                      return (
                        <div
                          key={st}
                          className="flex flex-col rounded-xl border border-border-subtle/60 bg-canvas/40 p-2.5"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: statusConfigs[st].color }}
                            />
                            <span className="text-[11px] font-medium text-ink-secondary truncate">
                              {statusConfigs[st].label}
                            </span>
                          </div>
                          <div className="mt-1 flex items-baseline justify-between">
                            <span className="text-base font-bold text-ink">{count}</span>
                            <span className="text-[10px] text-ink-muted">{share.toFixed(0)}%</span>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </>
            )}
          </div>

          {/* Grid de 2 Colunas: Profissionais Mais Requisitados + Top Serviços */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Profissionais Mais Requisitados */}
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                    <UserCheck className="size-4 text-accent" />
                    Profissionais Mais Requisitados
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Participação por número de agendamentos no período
                  </p>
                </div>
                <Link
                  href="/owner/team"
                  className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                >
                  Ver equipe
                  <ExternalLink className="size-3" />
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {topCollaborators.length === 0 ? (
                  <p className="py-6 text-center text-xs text-ink-muted">
                    Sem atendimentos para os profissionais no período.
                  </p>
                ) : (
                  topCollaborators.slice(0, 5).map((collab, index) => (
                    <div
                      key={collab.id}
                      className="rounded-xl border border-border-subtle/60 bg-canvas/30 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="grid size-6 place-items-center rounded-full bg-accent/10 text-[11px] font-bold text-accent shrink-0">
                            {index + 1}
                          </span>
                          {collab.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={collab.avatarUrl}
                              alt={collab.name}
                              className="size-8 rounded-full object-cover border border-border-subtle shrink-0"
                            />
                          ) : (
                            <span className="grid size-8 place-items-center rounded-full bg-border-subtle text-xs font-semibold text-ink-secondary shrink-0">
                              <User className="size-4" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink truncate">{collab.name}</p>
                            <p className="text-[10px] text-ink-muted truncate">{collab.specialty}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-ink">
                            {collab.count} {collab.count === 1 ? "reserva" : "reservas"}
                          </span>
                          <span className="block text-[10px] text-ink-muted">
                            {collab.share.toFixed(0)}% do total
                          </span>
                        </div>
                      </div>

                      {/* Barra de progresso individual */}
                      <div className="mt-2 h-1.5 w-full rounded-full bg-border-subtle overflow-hidden">
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

            {/* Top 5 Serviços Mais Requisitados */}
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                    <Flame className="size-4 text-amber-500" />
                    Serviços Mais Requisitados (Top 5)
                  </h3>
                  <p className="text-xs text-ink-muted mt-0.5">
                    Serviços com maior procura pelos clientes
                  </p>
                </div>
                <Link
                  href="/owner/services"
                  className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
                >
                  Ver serviços
                  <ExternalLink className="size-3" />
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {topServices.length === 0 ? (
                  <p className="py-6 text-center text-xs text-ink-muted">
                    Nenhum serviço registrado no período.
                  </p>
                ) : (
                  topServices.map((service, index) => (
                    <div
                      key={`${service.name}-${index}`}
                      className="rounded-xl border border-border-subtle/60 bg-canvas/30 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="grid size-6 place-items-center rounded-lg bg-amber-500/10 text-[11px] font-bold text-amber-500 shrink-0">
                            #{index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink truncate">{service.name}</p>
                            <p className="text-[10px] text-ink-muted">
                              Receita estimada: {currencyFormatter.format(service.revenueInCents / 100)}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-bold text-ink">
                            {service.count} {service.count === 1 ? "agendamento" : "agendamentos"}
                          </span>
                          <span className="block text-[10px] text-ink-muted">
                            {service.share.toFixed(0)}% do volume
                          </span>
                        </div>
                      </div>

                      {/* Barra de participação do serviço */}
                      <div className="mt-2 h-1.5 w-full rounded-full bg-border-subtle overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(5, service.share))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Lista de Agendamentos Futuros */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                  <Sparkles className="size-4 text-accent" />
                  Próximos Agendamentos Futuros
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">
                  Próximas reservas a partir de hoje na sua agenda
                </p>
              </div>
              <Link
                href="/owner/appointments"
                className="text-xs font-semibold text-accent hover:underline flex items-center gap-1"
              >
                Abrir Agenda completa
                <ExternalLink className="size-3" />
              </Link>
            </div>

            <div className="mt-4 overflow-x-auto">
              {upcomingAppointments.length === 0 ? (
                <div className="py-8 text-center text-xs text-ink-muted">
                  Nenhum agendamento futuro previsto para os próximos dias.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle text-ink-muted font-medium">
                      <th className="pb-3 pr-4">Data e Hora</th>
                      <th className="pb-3 pr-4">Cliente</th>
                      <th className="pb-3 pr-4">Profissional</th>
                      <th className="pb-3 pr-4">Serviço</th>
                      <th className="pb-3 pr-4">Valor</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                    {upcomingAppointments.map((app) => {
                      const collab = collaboratorMap.get(app.collaboratorId);
                      const stConfig = statusConfigs[app.status] ?? statusConfigs.CONFIRMED;
                      const formattedDate = formatDateTimeInTimezone(app.startsAt, timezone, locale);

                      return (
                        <tr key={app.id} className="hover:bg-canvas/50 transition-colors">
                          <td className="py-3 pr-4 font-mono font-medium text-ink whitespace-nowrap">
                            {formattedDate}
                          </td>
                          <td className="py-3 pr-4 min-w-[120px]">
                            <p className="font-semibold text-ink truncate">{app.clientName}</p>
                            <p className="text-[11px] text-ink-muted truncate">{app.clientPhone}</p>
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap text-ink-secondary">
                            {collab?.name ?? "Profissional"}
                          </td>
                          <td className="py-3 pr-4 text-ink truncate max-w-[180px]">
                            {app.serviceNameSnapshot || "Serviço"}
                          </td>
                          <td className="py-3 pr-4 whitespace-nowrap font-medium text-ink">
                            {formatPrice(app.servicePriceInCentsSnapshot / 100, locale, currency)}
                          </td>
                          <td className="py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border ${stConfig.badgeClass}`}
                            >
                              <stConfig.icon className="size-3" />
                              {stConfig.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
