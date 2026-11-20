"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Hourglass,
  Loader2,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api-client";
import {
  formatDateTimeInTimezone,
  formatPriceFromCents,
  formatTimeInTimezone,
  getTodayIsoDateInTimezone,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type {
  Appointment,
  AppointmentStatus,
  UpdatableAppointmentStatus,
} from "@/lib/types/appointment";
import {
  AgendaCard,
  formatShortDayMonth,
  getAvatarTint,
  getClientInitials,
} from "@/components/ui/agenda-card";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

const STATUS_OPTIONS: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELED",
  "NO_SHOW",
];

type MetricFilter = "ALL" | "COMPLETED" | "PENDING" | "CANCELED";

function shiftIsoDate(isoDate: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

function getIsoDateInTimezone(isoUtcString: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoUtcString));
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function MyAppointmentsPanel() {
  const { session } = useSession();
  const { locale, t } = useLocale();
  const searchParams = useSearchParams();
  const timezone = session.company.timezone;
  const today = useMemo(() => getTodayIsoDateInTimezone(timezone), [timezone]);
  const targetAppointmentId = searchParams.get("appointmentId");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState(today);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "">("");
  const [metricFilter, setMetricFilter] = useState<MetricFilter>("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Modal de motivo de cancelamento
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const lastScrolledIdRef = useRef<string | null>(null);

  const fetchMyAppointments = useCallback(async () => {
    return apiRequest<Appointment[]>("/me/appointments", {
      auth: true,
    });
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetchMyAppointments();
      setAppointments(Array.isArray(res) ? res : []);
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : t.errors.networkDescription,
      );
    } finally {
      setLoading(false);
    }
  }, [fetchMyAppointments, t.errors.networkDescription]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetchMyAppointments();
        if (!active) return;
        setAppointments(Array.isArray(res) ? res : []);
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof ApiError ? err.message : t.errors.networkDescription,
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchMyAppointments, t.errors.networkDescription]);

  // Deep-link de notificação (?appointmentId=<id>)
  useEffect(() => {
    if (!targetAppointmentId || loading) return;
    if (lastScrolledIdRef.current === targetAppointmentId) return;

    const found = appointments.some((a) => a.id === targetAppointmentId);
    if (!found && (dateFilter || statusFilter || metricFilter !== "ALL")) {
      const clearTimer = window.setTimeout(() => {
        setDateFilter("");
        setStatusFilter("");
        setMetricFilter("ALL");
        void reload();
      }, 0);
      return () => window.clearTimeout(clearTimer);
    }

    if (found) {
      lastScrolledIdRef.current = targetAppointmentId;
      const startTimer = window.setTimeout(() => {
        setMetricFilter("ALL");
        setHighlightedId(targetAppointmentId);
        const el = document.getElementById(
          `appointment-card-${targetAppointmentId}`,
        );
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);

      const stopTimer = window.setTimeout(() => {
        setHighlightedId((prev) =>
          prev === targetAppointmentId ? null : prev,
        );
      }, 4500);

      return () => {
        window.clearTimeout(startTimer);
        window.clearTimeout(stopTimer);
      };
    }
  }, [
    targetAppointmentId,
    loading,
    appointments,
    dateFilter,
    statusFilter,
    metricFilter,
    reload,
  ]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (dateFilter) {
        const apptDate = getIsoDateInTimezone(a.startsAt, timezone);
        if (apptDate !== dateFilter) return false;
      }
      if (statusFilter && a.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [appointments, dateFilter, statusFilter, timezone]);

  const kpis = useMemo(() => {
    const total = filteredAppointments.length;
    const completed = filteredAppointments.filter((a) => a.status === "COMPLETED").length;
    const pending = filteredAppointments.filter((a) => a.status === "PENDING").length;
    const canceled = filteredAppointments.filter(
      (a) => a.status === "CANCELED" || a.status === "NO_SHOW",
    ).length;
    const estimatedCommissionCents = filteredAppointments
      .filter((a) => a.status !== "CANCELED" && a.status !== "NO_SHOW")
      .reduce(
        (acc, a) =>
          acc +
          Math.round(
            (a.servicePriceInCentsSnapshot * a.commissionPercentageSnapshot) /
              100,
          ),
        0,
      );
    return { total, completed, pending, canceled, estimatedCommissionCents };
  }, [filteredAppointments]);

  const visibleAppointments = useMemo(() => {
    if (metricFilter === "ALL") return filteredAppointments;
    if (metricFilter === "COMPLETED") {
      return filteredAppointments.filter((a) => a.status === "COMPLETED");
    }
    if (metricFilter === "PENDING") {
      return filteredAppointments.filter((a) => a.status === "PENDING");
    }
    return filteredAppointments.filter(
      (a) => a.status === "CANCELED" || a.status === "NO_SHOW",
    );
  }, [filteredAppointments, metricFilter]);

  const { upcomingScheduleDays, totalFutureAppointments } = useMemo(() => {
    const future = appointments.filter((a) => {
      if (a.status === "CANCELED") return false;
      const apptDate = getIsoDateInTimezone(a.startsAt, timezone);
      return apptDate >= today;
    });

    const countByDate = new Map<string, number>();
    for (const a of future) {
      const apptDate = getIsoDateInTimezone(a.startsAt, timezone);
      countByDate.set(apptDate, (countByDate.get(apptDate) ?? 0) + 1);
    }

    const sortedDates = [...countByDate.keys()].sort();
    const daysList = sortedDates.map((date) => ({
      date,
      count: countByDate.get(date) ?? 0,
      isToday: date === today,
    }));

    return {
      upcomingScheduleDays: daysList,
      totalFutureAppointments: future.length,
    };
  }, [appointments, timezone, today]);

  const pendingQueue = useMemo(
    () => appointments.filter((a) => a.status === "PENDING"),
    [appointments],
  );

  const handleApplyFilters = (
    nextDate: string,
    nextStatus: AppointmentStatus | "",
  ) => {
    setDateFilter(nextDate);
    setStatusFilter(nextStatus);
    setMetricFilter("ALL");
  };

  const handleMetricClick = (next: MetricFilter) => {
    setMetricFilter((prev) => (prev === next ? "ALL" : next));
  };

  const handleStatusChange = async (
    appointmentId: string,
    nextStatus: UpdatableAppointmentStatus,
    cancellationReason?: string,
  ) => {
    setUpdatingId(appointmentId);
    setActionError(null);
    try {
      const updated = await apiRequest<Appointment>(
        `/appointments/${encodeURIComponent(appointmentId)}/status`,
        {
          method: "PATCH",
          auth: true,
          body: {
            status: nextStatus,
            ...(cancellationReason ? { cancellationReason } : {}),
          },
        },
      );
      setAppointments((prev) =>
        prev.map((item) => (item.id === appointmentId ? updated : item)),
      );
      return true;
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
      return false;
    } finally {
      setUpdatingId(null);
    }
  };

  const openCancelModal = (appt: Appointment) => {
    setCancelTarget(appt);
    setCancelReason("");
    setCancelError(null);
  };

  const handleConfirmCancel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cancelTarget) return;
    const trimmed = cancelReason.trim();
    if (!trimmed) {
      setCancelError(t.common.cancelReasonRequired);
      return;
    }
    setCanceling(true);
    setCancelError(null);
    const ok = await handleStatusChange(cancelTarget.id, "CANCELED", trimmed);
    setCanceling(false);
    if (ok) {
      setCancelTarget(null);
      setCancelReason("");
    }
  };

  const hasFilters = Boolean(dateFilter || statusFilter || metricFilter !== "ALL");

  const metricCards: Array<{
    key: MetricFilter;
    label: string;
    value: number;
    icon: typeof CalendarDays;
    tint: string;
  }> = [
    {
      key: "ALL",
      label: t.common.agendaTotal,
      value: kpis.total,
      icon: CalendarDays,
      tint: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    },
    {
      key: "COMPLETED",
      label: t.common.agendaCompleted,
      value: kpis.completed,
      icon: CheckCircle2,
      tint: "bg-teal-500/12 text-teal-600 dark:text-teal-400",
    },
    {
      key: "PENDING",
      label: t.common.agendaPending,
      value: kpis.pending,
      icon: Hourglass,
      tint: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    },
    {
      key: "CANCELED",
      label: t.common.agendaCanceled,
      value: kpis.canceled,
      icon: XCircle,
      tint: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
    },
  ];

  return (
    <div className="space-y-5">
      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-xs font-medium text-[var(--status-danger-ink)]"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {actionError}
          </span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label={t.common.close}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-surface/60 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Barra superior limpa com filtros e navegação rápida por dias */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-ink">
              {t.collaborator.agendaTitle}
            </h2>
            <span className="hidden sm:inline-flex items-center rounded-full bg-subtle px-2.5 py-0.5 font-mono text-xs font-medium text-ink-secondary tabular-nums">
              {t.owner.commissions}:{" "}
              <span className="ml-1 font-semibold text-accent">
                {formatPriceFromCents(kpis.estimatedCommissionCents, locale)}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleApplyFilters("", "")}
                className="min-h-10 rounded-xl px-3.5 text-xs font-medium cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                {t.common.clearFilter}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => void reload()}
              aria-label={t.common.retry}
              className="min-h-10 rounded-xl px-3 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Navegação rápida de dias + botão ver todos */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-border-subtle/60">
          <div className="inline-flex items-center rounded-xl border border-border-subtle bg-subtle/50 p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const base = dateFilter || today;
                handleApplyFilters(shiftIsoDate(base, -1), statusFilter);
              }}
              className="h-8 px-2.5 text-xs font-medium cursor-pointer"
              title={t.common.previousDay}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
              <span className="hidden sm:inline">{t.common.previousDay}</span>
            </Button>
            <Button
              type="button"
              variant={dateFilter === today ? "secondary" : "ghost"}
              size="sm"
              onClick={() => handleApplyFilters(today, statusFilter)}
              className="h-8 px-3 text-xs font-medium cursor-pointer"
            >
              {t.common.today}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const base = dateFilter || today;
                handleApplyFilters(shiftIsoDate(base, 1), statusFilter);
              }}
              className="h-8 px-2.5 text-xs font-medium cursor-pointer"
              title={t.common.nextDay}
            >
              <span className="hidden sm:inline">{t.common.nextDay}</span>
              <ChevronRight className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
            </Button>
          </div>

          <Button
            type="button"
            variant={dateFilter === "" ? "secondary" : "outline"}
            size="sm"
            onClick={() => handleApplyFilters("", statusFilter)}
            className="h-9 rounded-xl px-3 text-xs font-medium cursor-pointer"
          >
            {t.common.viewAll}
          </Button>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="collab-date-filter" className="text-[11px] text-ink-muted">
              {t.common.date}
            </Label>
            <Input
              id="collab-date-filter"
              type="date"
              value={dateFilter}
              onChange={(e) => handleApplyFilters(e.target.value, statusFilter)}
              className="min-h-10 rounded-xl border-border-strong bg-subtle/40 px-3 text-xs tabular-nums"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="collab-status-filter" className="text-[11px] text-ink-muted">
              {t.common.status}
            </Label>
            <select
              id="collab-status-filter"
              value={statusFilter}
              onChange={(e) =>
                handleApplyFilters(
                  dateFilter,
                  e.target.value as AppointmentStatus | "",
                )
              }
              className="min-h-10 w-full rounded-xl border border-border-strong bg-subtle/40 px-3 text-xs text-ink"
            >
              <option value="">{t.common.all}</option>
              {STATUS_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {t.status[st]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Arquitetura 2 colunas */}
      <div className="grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)] items-start">
        <aside className="space-y-5">
          {/* Métricas clicáveis */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-3.5 space-y-2">
            {metricCards.map((card) => {
              const Icon = card.icon;
              const active = metricFilter === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => handleMetricClick(card.key)}
                  aria-pressed={active}
                  className={[
                    "flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all cursor-pointer",
                    active
                      ? "border-accent bg-accent-soft/45 ring-1 ring-accent/40"
                      : "border-border-subtle bg-subtle/35 hover:border-border-strong hover:bg-subtle/60",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      card.tint,
                    ].join(" ")}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-ink-muted truncate">
                      {card.label}
                    </p>
                    <p className="font-mono text-xl font-semibold text-ink tabular-nums">
                      {card.value}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Card: Próximos dias agendados clicáveis com contagem */}
          <div className="rounded-2xl border border-border-subtle bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-accent" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-ink">
                  {t.common.upcomingDaysSummary}
                </h3>
              </div>
              <span
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-soft px-2 font-mono text-[11px] font-semibold text-accent tabular-nums"
                title={t.common.futureAppointments}
              >
                {totalFutureAppointments}
              </span>
            </div>

            {upcomingScheduleDays.length === 0 ? (
              <p className="rounded-xl bg-subtle/50 px-3 py-4 text-center text-xs text-ink-muted">
                {t.common.noUpcomingDays}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                {upcomingScheduleDays.map((item) => {
                  const active = dateFilter === item.date;
                  const formattedDate = formatShortDayMonth(
                    `${item.date}T12:00:00.000Z`,
                    timezone,
                    locale,
                  );
                  return (
                    <button
                      key={item.date}
                      type="button"
                      onClick={() => handleApplyFilters(item.date, statusFilter)}
                      className={[
                        "flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs transition-colors cursor-pointer text-left",
                        active
                          ? "bg-accent text-accent-ink font-semibold shadow-xs"
                          : "bg-subtle/40 text-ink hover:bg-subtle/80 hover:text-ink font-medium",
                      ].join(" ")}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span>{formattedDate}</span>
                        {item.isToday && (
                          <span
                            className={[
                              "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                              active
                                ? "bg-accent-ink/20 text-accent-ink"
                                : "bg-accent-soft text-accent font-semibold",
                            ].join(" ")}
                          >
                            {t.common.today}
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums">
                        {item.count} {t.common.appointmentsSuffix}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border-subtle bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">
                {t.common.pendingQueueTitle}
              </h3>
              {pendingQueue.length > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/15 px-1.5 font-mono text-[11px] font-medium text-amber-700 dark:text-amber-300 tabular-nums">
                  {pendingQueue.length}
                </span>
              )}
            </div>

            {pendingQueue.length === 0 ? (
              <p className="rounded-xl bg-subtle/50 px-3 py-5 text-center text-xs text-ink-muted">
                {t.common.pendingQueueEmpty}
              </p>
            ) : (
              <ul className="space-y-2.5 max-h-[420px] overflow-y-auto pr-0.5">
                {pendingQueue.map((appt) => {
                  const busy = updatingId === appt.id;
                  return (
                    <li
                      key={appt.id}
                      className="rounded-xl border border-border-subtle bg-subtle/40 p-3 space-y-2.5"
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={[
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                            getAvatarTint(appt.clientName),
                          ].join(" ")}
                        >
                          {getClientInitials(appt.clientName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-ink">
                            {appt.clientName}
                          </p>
                          <p className="font-mono text-[11px] text-ink-muted tabular-nums">
                            {formatShortDayMonth(appt.startsAt, timezone, locale)}
                            , {formatTimeInTimezone(appt.startsAt, timezone, locale)}{" "}
                            - {formatTimeInTimezone(appt.endsAt, timezone, locale)}
                          </p>
                          <p className="truncate text-[11px] text-ink-secondary">
                            {appt.serviceNameSnapshot}
                          </p>

                          {/* Foto e nome do profissional logado */}
                          <div className="mt-1.5 flex items-center gap-1.5 pt-1.5 border-t border-border-subtle/50">
                            {session.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={session.avatarUrl}
                                alt={session.name}
                                className="h-4 w-4 shrink-0 rounded-full object-cover border border-border-subtle"
                              />
                            ) : (
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-subtle text-[9px] font-semibold text-ink-secondary">
                                {getClientInitials(session.name)}
                              </span>
                            )}
                            <span className="truncate text-[11px] text-ink-muted font-medium">
                              {session.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => openCancelModal(appt)}
                          className="min-h-9 rounded-lg bg-[var(--status-danger-bg)] text-xs font-medium text-[var(--status-danger-ink)] transition-opacity hover:opacity-85 disabled:opacity-50 cursor-pointer"
                        >
                          {t.common.rejectAction}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void handleStatusChange(appt.id, "CONFIRMED")
                          }
                          className="min-h-9 rounded-lg bg-accent-soft text-xs font-medium text-accent transition-opacity hover:opacity-85 disabled:opacity-50 cursor-pointer"
                        >
                          {t.common.acceptAction}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Coluna Direita: Grade de cards */}
        <section aria-label={t.collaborator.agendaTitle} className="min-w-0">
          {loading ? (
            <CardListSkeleton count={6} />
          ) : loadError ? (
            <ErrorState
              title={t.errors.networkTitle}
              description={loadError}
              retryLabel={t.common.retry}
              onRetry={() => void reload()}
            />
          ) : visibleAppointments.length === 0 ? (
            <EmptyState
              title={t.common.noData}
              description={t.collaborator.agendaTitle}
              icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {visibleAppointments.map((appt) => {
                const commissionCents = Math.round(
                  (appt.servicePriceInCentsSnapshot *
                    appt.commissionPercentageSnapshot) /
                    100,
                );
                return (
                  <AgendaCard
                    key={appt.id}
                    appointment={appt}
                    timezone={timezone}
                    collaboratorName={session.name}
                    collaboratorAvatarUrl={session.avatarUrl}
                    commissionLabel={`+${formatPriceFromCents(commissionCents, locale)}`}
                    busy={updatingId === appt.id}
                    highlighted={highlightedId === appt.id}
                    onStatusChange={(id, status) =>
                      void handleStatusChange(id, status)
                    }
                    onRequestCancel={openCancelModal}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Modal: Motivo de cancelamento */}
      <Modal
        open={Boolean(cancelTarget)}
        title={t.common.cancelModalTitle}
        onClose={() => setCancelTarget(null)}
      >
        {cancelTarget && (
          <form onSubmit={handleConfirmCancel} className="space-y-4">
            <p className="text-xs text-ink-secondary">
              {t.common.cancelModalSubtitle}
            </p>
            <div className="rounded-xl bg-subtle/60 px-3.5 py-2.5 text-xs">
              <p className="font-semibold text-ink">{cancelTarget.clientName}</p>
              <p className="text-ink-secondary">
                {cancelTarget.serviceNameSnapshot} ·{" "}
                {formatDateTimeInTimezone(cancelTarget.startsAt, timezone, locale)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="collab-cancel-reason">
                {t.common.cancelReasonLabel}
              </Label>
              <textarea
                id="collab-cancel-reason"
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={t.common.cancelReasonPlaceholder}
                className="w-full rounded-xl border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
              />
            </div>
            {cancelError && (
              <p
                role="alert"
                className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
              >
                {cancelError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCancelTarget(null)}
                className="min-h-10 rounded-xl px-4 text-xs font-medium cursor-pointer"
              >
                {t.common.back}
              </Button>
              <Button
                type="submit"
                disabled={canceling}
                className="min-h-10 rounded-xl bg-[var(--status-danger-ink)] px-4 text-xs font-medium text-white hover:opacity-90 cursor-pointer"
              >
                {canceling && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                )}
                {t.common.actionCancel}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
