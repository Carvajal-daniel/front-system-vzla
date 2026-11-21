"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Hourglass,
  Loader2,
  Plus,
  RefreshCw,
  X,
  XCircle,
} from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api-client";
import {
  formatDateTimeInTimezone,
  formatPhoneToE164,
  formatPriceFromCents,
  formatTimeInTimezone,
  getTodayIsoDateInTimezone,
  isValidInternationalPhone,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type {
  Appointment,
  AppointmentStatus,
  CreateAppointmentPayload,
  RescheduleAppointmentPayload,
  UpdatableAppointmentStatus,
} from "@/lib/types/appointment";
import type {
  AvailabilitySlot,
  PhoneCountryCode,
  PublicAvailabilityResponse,
} from "@/lib/types/public-booking";
import type { Service } from "@/lib/types/service";
import type {
  Collaborator,
  CollaboratorsListResponse,
  DayOfWeek,
  WorkScheduleSlot,
} from "@/lib/types/team";
import {
  AgendaCard,
  formatShortDayMonth,
  getAvatarTint,
  getClientInitials,
} from "@/components/ui/agenda-card";
import { useSession } from "@/components/ui/auth-guard";
import { ReceiptDialog } from "./receipt-dialog";
import { Button } from "@/components/ui/button";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PhoneInput } from "@/components/ui/phone-input";

const STATUS_OPTIONS: AppointmentStatus[] = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "CANCELED",
  "NO_SHOW",
];

type MetricFilter = "ALL" | "COMPLETED" | "PENDING" | "CANCELED";

function extractList<T>(raw: unknown, key: string): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && key in raw) {
    const val = (raw as Record<string, unknown>)[key];
    if (Array.isArray(val)) return val as T[];
  }
  return [];
}

function getDayOfWeekFromIsoDate(isoDate: string): DayOfWeek | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay() as DayOfWeek;
}

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

export function AppointmentsPanel() {
  const { session } = useSession();
  const [receiptAppointmentId, setReceiptAppointmentId] = useState<string | null>(null);
  const { locale, t } = useLocale();
  const searchParams = useSearchParams();
  const timezone = session.company.timezone;
  const today = useMemo(() => getTodayIsoDateInTimezone(timezone), [timezone]);
  const targetAppointmentId = searchParams.get("appointmentId");

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Destaque temporário vindo do clique em uma notificação
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const lastScrolledIdRef = useRef<string | null>(null);

  // Filtros: inicializa a agenda focada em Hoje por padrão
  const [dateFilter, setDateFilter] = useState(today);
  const [collaboratorFilter, setCollaboratorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "">("");
  const [metricFilter, setMetricFilter] = useState<MetricFilter>("ALL");

  // Modal de motivo de cancelamento
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  // Drawer de criação manual com grade real de horários livres
  const [createOpen, setCreateOpen] = useState(false);
  const [newServiceId, setNewServiceId] = useState("");
  const [newCollaboratorId, setNewCollaboratorId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [selectedSlotIso, setSelectedSlotIso] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newCountryCode, setNewCountryCode] = useState<PhoneCountryCode>("+55");
  const [newPhoneDigits, setNewPhoneDigits] = useState("");
  const [createConfirmed, setCreateConfirmed] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [collabSchedules, setCollabSchedules] = useState<WorkScheduleSlot[]>(
    [],
  );
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Drawer de reagendamento
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(
    null,
  );
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("10:00");
  const [rescheduleCollaboratorId, setRescheduleCollaboratorId] = useState("");
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchAppointments = useCallback(
    async (
      dateVal: string,
      collabVal: string,
      statusVal: AppointmentStatus | "",
    ) => {
      const query: Record<string, string | undefined> = {
        collaboratorId: collabVal || undefined,
        status: statusVal || undefined,
      };
      if (dateVal) {
        query.from = `${dateVal}T00:00:00.000Z`;
        query.to = `${dateVal}T23:59:59.999Z`;
      }
      return apiRequest<Appointment[]>("/appointments", {
        auth: true,
        query,
      });
    },
    [],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [appts, collabsRaw, servicesRaw] = await Promise.all([
        fetchAppointments("", "", ""),
        apiRequest<CollaboratorsListResponse>("/collaborators", {
          auth: true,
        }),
        apiRequest<unknown>("/services", { auth: true }),
      ]);
      setAppointments(Array.isArray(appts) ? appts : []);
      setCollaborators(collabsRaw.collaborators ?? []);
      setServices(extractList<Service>(servicesRaw, "services"));
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : t.errors.networkDescription,
      );
    } finally {
      setLoading(false);
    }
  }, [fetchAppointments, t.errors.networkDescription]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [appts, collabsRaw, servicesRaw] = await Promise.all([
          fetchAppointments("", "", ""),
          apiRequest<CollaboratorsListResponse>("/collaborators", {
            auth: true,
          }),
          apiRequest<unknown>("/services", { auth: true }),
        ]);
        if (!active) return;
        setNewDate(today);
        setAppointments(Array.isArray(appts) ? appts : []);
        setCollaborators(collabsRaw.collaborators ?? []);
        setServices(extractList<Service>(servicesRaw, "services"));
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
  }, [fetchAppointments, today, t.errors.networkDescription]);

  // Deep-link de notificação (?appointmentId=<id>): limpa filtros conflitantes, faz scroll e destaca o card
  useEffect(() => {
    if (!targetAppointmentId || loading) return;
    if (lastScrolledIdRef.current === targetAppointmentId) return;

    const found = appointments.some((a) => a.id === targetAppointmentId);
    if (
      !found &&
      (dateFilter || collaboratorFilter || statusFilter || metricFilter !== "ALL")
    ) {
      const clearTimer = window.setTimeout(() => {
        setDateFilter("");
        setCollaboratorFilter("");
        setStatusFilter("");
        setMetricFilter("ALL");
        void loadAll();
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
    collaboratorFilter,
    statusFilter,
    metricFilter,
    loadAll,
  ]);

  // Consulta expediente e disponibilidade real (turno + bloqueios + horários livres)
  const refreshShiftAndSlots = useCallback(
    async (collabId: string, serviceId: string, dateStr: string) => {
      setSelectedSlotIso("");
      if (!collabId) {
        setCollabSchedules([]);
        setAvailableSlots([]);
        return;
      }
      setSlotsLoading(true);
      try {
        const schedulePromise = apiRequest<unknown>(
          `/collaborators/${encodeURIComponent(collabId)}/work-schedules`,
          { auth: true },
        );
        const availabilityPromise =
          serviceId && dateStr
            ? apiRequest<PublicAvailabilityResponse>(
                `/public/companies/${encodeURIComponent(session.company.id)}/availability`,
                {
                  auth: false,
                  query: {
                    serviceId,
                    date: dateStr,
                    collaboratorId: collabId,
                    timezone,
                  },
                },
              ).catch(() => null)
            : Promise.resolve(null);

        const [schedRaw, availRes] = await Promise.all([
          schedulePromise,
          availabilityPromise,
        ]);
        const slots = availRes?.slots ?? [];
        setCollabSchedules(extractList<WorkScheduleSlot>(schedRaw, "schedules"));
        setAvailableSlots(slots);
        if (slots.length > 0) {
          setSelectedSlotIso(slots[0].startsAt);
        }
      } catch {
        setCollabSchedules([]);
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    },
    [session.company.id, timezone],
  );

  const dayShift = useMemo(() => {
    const dow = getDayOfWeekFromIsoDate(newDate);
    if (dow === null || !newCollaboratorId) return null;
    return collabSchedules.find((s) => s.dayOfWeek === dow) ?? null;
  }, [collabSchedules, newDate, newCollaboratorId]);

  const collaboratorMap = useMemo(() => {
    const map = new Map<string, Collaborator>();
    for (const c of collaborators) {
      map.set(c.id, c);
    }
    return map;
  }, [collaborators]);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((a) => {
      if (dateFilter) {
        const apptDate = getIsoDateInTimezone(a.startsAt, timezone);
        if (apptDate !== dateFilter) return false;
      }
      if (collaboratorFilter && a.collaboratorId !== collaboratorFilter) {
        return false;
      }
      if (statusFilter && a.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [appointments, dateFilter, collaboratorFilter, statusFilter, timezone]);

  const kpis = useMemo(() => {
    const total = filteredAppointments.length;
    const completed = filteredAppointments.filter((a) => a.status === "COMPLETED").length;
    const pending = filteredAppointments.filter((a) => a.status === "PENDING").length;
    const canceled = filteredAppointments.filter(
      (a) => a.status === "CANCELED" || a.status === "NO_SHOW",
    ).length;
    const revenueCents = filteredAppointments
      .filter((a) => a.status !== "CANCELED" && a.status !== "NO_SHOW")
      .reduce((acc, a) => acc + a.servicePriceInCentsSnapshot, 0);
    return { total, completed, pending, canceled, revenueCents };
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
    nextCollab: string,
    nextStatus: AppointmentStatus | "",
  ) => {
    setDateFilter(nextDate);
    setCollaboratorFilter(nextCollab);
    setStatusFilter(nextStatus);
    setMetricFilter("ALL");
  };

  const handleMetricClick = (next: MetricFilter) => {
    setMetricFilter((prev) => (prev === next ? "ALL" : next));
  };

  const translateApiError = (err: unknown): string => {
    if (!(err instanceof ApiError)) return t.errors.unexpectedDescription;
    const msg = err.message.toLowerCase();
    if (
      msg.includes("no longer available") ||
      msg.includes("slot") ||
      msg.includes("conflict") ||
      msg.includes("already booked")
    ) {
      return t.common.slotNoLongerAvailable;
    }
    if (msg.includes("work schedule") || msg.includes("outside")) {
      return t.common.outsideWorkHours;
    }
    return err.message;
  };

  const handleStatusChange = async (
    appointmentId: string,
    nextStatus: UpdatableAppointmentStatus,
    cancellationReason?: string,
  ) => {
    const target = appointments.find((appointment) => appointment.id === appointmentId);
    if (nextStatus === "COMPLETED" && target && Date.parse(target.startsAt) > Date.now()) {
      setActionError(t.common.completeAfterStart);
      return false;
    }
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
      if (err instanceof ApiError && err.message === "Cannot complete an appointment before its scheduled date and time.") {
        setActionError(t.common.completeAfterStart);
      } else if (err instanceof ApiError && err.message === "The appointment changed. Refresh and try again.") {
        setActionError(t.common.appointmentChanged);
      } else {
        setActionError(translateApiError(err));
      }
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

  const handleCreateAppointment = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);

    if (!newServiceId || !newCollaboratorId || !newDate) {
      setCreateError(t.errors.requiredField);
      return;
    }

    if (!selectedSlotIso) {
      setCreateError(t.common.noAvailableSlotsForDay);
      return;
    }

    if (!isValidInternationalPhone(newCountryCode, newPhoneDigits)) {
      setCreateError(t.errors.invalidPhone);
      return;
    }

    setCreating(true);
    const payload: CreateAppointmentPayload = {
      serviceId: newServiceId,
      collaboratorId: newCollaboratorId,
      startsAt: selectedSlotIso,
      clientName: newClientName.trim(),
      clientPhone: formatPhoneToE164(newCountryCode, newPhoneDigits),
      initialStatus: createConfirmed ? "CONFIRMED" : "PENDING",
    };

    try {
      await apiRequest<Appointment>("/appointments", {
        method: "POST",
        auth: true,
        body: payload,
      });
      setCreateOpen(false);
      setNewClientName("");
      setNewPhoneDigits("");
      setSelectedSlotIso("");
      void loadAll();
    } catch (err) {
      setCreateError(translateApiError(err));
      // Recarrega os slots disponíveis caso o horário tenha sido ocupado segundos antes
      void refreshShiftAndSlots(newCollaboratorId, newServiceId, newDate);
    } finally {
      setCreating(false);
    }
  };

  const openRescheduleDrawer = (appt: Appointment) => {
    setRescheduleTarget(appt);
    setRescheduleDate(dateFilter || getTodayIsoDateInTimezone(timezone));
    setRescheduleTime("10:00");
    setRescheduleCollaboratorId(appt.collaboratorId);
    setRescheduleError(null);
  };

  const handleReschedule = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) return;

    setRescheduling(true);
    setRescheduleError(null);

    const payload: RescheduleAppointmentPayload = {
      startsAt: new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString(),
      collaboratorId: rescheduleCollaboratorId || undefined,
    };

    try {
      const updated = await apiRequest<Appointment>(
        `/appointments/${encodeURIComponent(rescheduleTarget.id)}/reschedule`,
        {
          method: "PATCH",
          auth: true,
          body: payload,
        },
      );
      setAppointments((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      setRescheduleTarget(null);
    } catch (err) {
      setRescheduleError(translateApiError(err));
    } finally {
      setRescheduling(false);
    }
  };

  const activeServices = services.filter((s) => s.active);
  const activeCollaborators = collaborators.filter((c) => c.isActive);
  const hasFilters = Boolean(
    dateFilter || collaboratorFilter || statusFilter || metricFilter !== "ALL",
  );

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
              {t.owner.agendaTitle}
            </h2>
            <span className="hidden sm:inline-flex items-center rounded-full bg-subtle px-2.5 py-0.5 font-mono text-xs font-medium text-ink-secondary tabular-nums">
              {t.owner.revenueForecast}:{" "}
              <span className="ml-1 font-semibold text-ink">
                {formatPriceFromCents(kpis.revenueCents, locale, session.company.currency)}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleApplyFilters("", "", "")}
                className="min-h-10 rounded-xl px-3.5 text-xs font-medium cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                {t.common.clearFilter}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadAll()}
              aria-label={t.common.retry}
              className="min-h-10 rounded-xl px-3 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
              className="min-h-10 rounded-xl bg-accent px-4 text-xs font-medium text-accent-ink hover:bg-accent-hover cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t.owner.newAppointment}
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
                handleApplyFilters(shiftIsoDate(base, -1), collaboratorFilter, statusFilter);
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
              onClick={() => handleApplyFilters(today, collaboratorFilter, statusFilter)}
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
                handleApplyFilters(shiftIsoDate(base, 1), collaboratorFilter, statusFilter);
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
            onClick={() => handleApplyFilters("", collaboratorFilter, statusFilter)}
            className="h-9 rounded-xl px-3 text-xs font-medium cursor-pointer"
          >
            {t.common.viewAll}
          </Button>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="owner-date-filter" className="text-[11px] text-ink-muted">
              {t.common.date}
            </Label>
            <Input
              id="owner-date-filter"
              type="date"
              value={dateFilter}
              onChange={(e) =>
                handleApplyFilters(
                  e.target.value,
                  collaboratorFilter,
                  statusFilter,
                )
              }
              className="min-h-10 rounded-xl border-border-strong bg-subtle/40 px-3 text-xs tabular-nums"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="owner-collab-filter" className="text-[11px] text-ink-muted">
              {t.booking.stepProfessional}
            </Label>
            <select
              id="owner-collab-filter"
              value={collaboratorFilter}
              onChange={(e) =>
                handleApplyFilters(dateFilter, e.target.value, statusFilter)
              }
              className="min-h-10 w-full rounded-xl border border-border-strong bg-subtle/40 px-3 text-xs text-ink"
            >
              <option value="">{t.common.all}</option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="owner-status-filter" className="text-[11px] text-ink-muted">
              {t.common.status}
            </Label>
            <select
              id="owner-status-filter"
              value={statusFilter}
              onChange={(e) =>
                handleApplyFilters(
                  dateFilter,
                  collaboratorFilter,
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
          {/* Métricas clicáveis para filtrar a grade */}
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
                      onClick={() =>
                        handleApplyFilters(item.date, collaboratorFilter, statusFilter)
                      }
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

          {/* Fila rápida de pendentes */}
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
                  const collab = collaboratorMap.get(appt.collaboratorId);
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

                          {/* Foto e nome do colaborador responsável */}
                          {collab && (
                            <div className="mt-1.5 flex items-center gap-1.5 pt-1.5 border-t border-border-subtle/50">
                              {collab.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={collab.avatarUrl}
                                  alt={collab.name}
                                  className="h-4 w-4 shrink-0 rounded-full object-cover border border-border-subtle"
                                />
                              ) : (
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-subtle text-[9px] font-semibold text-ink-secondary">
                                  {getClientInitials(collab.name)}
                                </span>
                              )}
                              <span className="truncate text-[11px] text-ink-muted font-medium">
                                {collab.name}
                              </span>
                            </div>
                          )}
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
        <section aria-label={t.owner.agendaTitle} className="min-w-0">
          {loading ? (
            <CardListSkeleton count={6} />
          ) : loadError ? (
            <ErrorState
              title={t.errors.networkTitle}
              description={loadError}
              retryLabel={t.common.retry}
              onRetry={() => void loadAll()}
            />
          ) : visibleAppointments.length === 0 ? (
            <EmptyState
              title={t.common.noData}
              description={t.owner.agendaTitle}
              icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
              action={
                <Button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="min-h-11 rounded-full bg-accent px-5 text-accent-ink hover:bg-accent-hover cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t.owner.newAppointment}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {visibleAppointments.map((appt) => {
                const collab = collaboratorMap.get(appt.collaboratorId);
                return (
                  <AgendaCard
                    key={appt.id}
                    appointment={appt}
                    timezone={timezone}
                    currency={session.company.currency}
                    onOpenPayments={appt.status === "PENDING" ? undefined : () => setReceiptAppointmentId(appt.id)}
                    collaboratorName={collab?.name}
                    collaboratorAvatarUrl={collab?.avatarUrl}
                    busy={updatingId === appt.id}
                    highlighted={highlightedId === appt.id}
                    onStatusChange={(id, status) =>
                      void handleStatusChange(id, status)
                    }
                    onRequestCancel={openCancelModal}
                    onReschedule={openRescheduleDrawer}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Modal: Motivo de cancelamento */}
      {receiptAppointmentId && (
        <ReceiptDialog appointmentId={receiptAppointmentId} timezone={timezone}
          onClose={() => setReceiptAppointmentId(null)} />
      )}
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
              <Label htmlFor="owner-cancel-reason">
                {t.common.cancelReasonLabel}
              </Label>
              <textarea
                id="owner-cancel-reason"
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

      {/* Modal: Criar Agendamento Manual com Grade Real de Horários Livres */}
      <Modal
        open={createOpen}
        title={t.owner.newAppointment}
        maxWidth="max-w-xl"
        onClose={() => setCreateOpen(false)}
      >
        <form onSubmit={handleCreateAppointment} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-appt-service">{t.booking.stepService}</Label>
            <select
              id="new-appt-service"
              required
              value={newServiceId}
              onChange={(e) => {
                const nextSvc = e.target.value;
                setNewServiceId(nextSvc);
                void refreshShiftAndSlots(newCollaboratorId, nextSvc, newDate);
              }}
              className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink"
            >
              <option value="">—</option>
              {activeServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatPriceFromCents(s.priceInCents, locale, session.company.currency)})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-appt-collab">
              {t.booking.stepProfessional}
            </Label>
            <select
              id="new-appt-collab"
              required
              value={newCollaboratorId}
              onChange={(e) => {
                const nextCollab = e.target.value;
                setNewCollaboratorId(nextCollab);
                void refreshShiftAndSlots(nextCollab, newServiceId, newDate);
              }}
              className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink"
            >
              <option value="">—</option>
              {activeCollaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {collaboratorMap.get(newCollaboratorId) && (
              <div className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-subtle/40 p-2">
                {collaboratorMap.get(newCollaboratorId)?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={collaboratorMap.get(newCollaboratorId)!.avatarUrl!}
                    alt={collaboratorMap.get(newCollaboratorId)!.name}
                    className="h-8 w-8 shrink-0 rounded-full object-cover border border-border-subtle"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent text-xs font-semibold">
                    {getClientInitials(collaboratorMap.get(newCollaboratorId)!.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink truncate">
                    {collaboratorMap.get(newCollaboratorId)!.name}
                  </p>
                  {collaboratorMap.get(newCollaboratorId)!.specialty && (
                    <p className="text-[11px] text-ink-secondary truncate">
                      {collaboratorMap.get(newCollaboratorId)!.specialty}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-appt-date">{t.common.date}</Label>
            <Input
              id="new-appt-date"
              type="date"
              required
              value={newDate}
              onChange={(e) => {
                const nextDate = e.target.value;
                setNewDate(nextDate);
                void refreshShiftAndSlots(
                  newCollaboratorId,
                  newServiceId,
                  nextDate,
                );
              }}
              className="min-h-11 rounded-xl border-border-strong bg-surface px-3 tabular-nums"
            />
          </div>

          {/* Grade real de horários livres clicáveis */}
          <div className="rounded-xl border border-border-subtle bg-subtle/50 p-3.5 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                <Clock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                {t.common.availableSlotsLabel}
              </span>
              {newCollaboratorId && newDate && dayShift?.isWorkingDay && dayShift.startTime && dayShift.endTime && (
                <span className="font-mono text-[11px] font-medium text-ink-muted tabular-nums">
                  {dayShift.startTime.slice(0, 5)} – {dayShift.endTime.slice(0, 5)}
                </span>
              )}
            </div>

            {!newServiceId || !newCollaboratorId || !newDate ? (
              <p className="text-ink-muted">
                {t.common.selectServiceAndProForSlots}
              </p>
            ) : slotsLoading ? (
              <div className="flex items-center gap-2 py-2 text-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t.common.loading}
              </div>
            ) : dayShift && !dayShift.isWorkingDay ? (
              <p className="font-medium text-[var(--status-warning-ink)]">
                {t.common.dayOffNotice}
              </p>
            ) : availableSlots.length === 0 ? (
              <p className="font-medium text-[var(--status-warning-ink)]">
                {t.common.noAvailableSlotsForDay}
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-0.5">
                {availableSlots.map((slot) => {
                  const hhmm = formatTimeInTimezone(
                    slot.startsAt,
                    timezone,
                    locale,
                  );
                  const active = selectedSlotIso === slot.startsAt;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      onClick={() => setSelectedSlotIso(slot.startsAt)}
                      className={[
                        "min-h-10 rounded-xl border font-mono text-xs font-medium tabular-nums transition-colors cursor-pointer",
                        active
                          ? "border-accent bg-accent text-accent-ink shadow-xs"
                          : "border-border-strong bg-surface text-ink hover:border-accent",
                      ].join(" ")}
                    >
                      {hhmm}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-appt-client">{t.booking.clientNameLabel}</Label>
            <Input
              id="new-appt-client"
              required
              minLength={2}
              maxLength={120}
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
            />
          </div>

          <PhoneInput
            id="new-appt-phone"
            label={t.booking.whatsappLabel}
            countryCode={newCountryCode}
            value={newPhoneDigits}
            onCountryCodeChange={setNewCountryCode}
            onChange={setNewPhoneDigits}
          />

          <label className="flex min-h-11 items-center gap-2.5 rounded-xl border border-border-subtle bg-subtle px-3.5 text-sm font-medium text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={createConfirmed}
              onChange={(e) => setCreateConfirmed(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            {t.owner.createAsConfirmed}
          </label>

          {createError && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
            >
              {createError}
            </p>
          )}

          <Button
            type="submit"
            disabled={creating || !selectedSlotIso}
            className="min-h-11 w-full rounded-full bg-accent text-accent-ink hover:bg-accent-hover cursor-pointer"
          >
            {creating && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {t.common.save}
          </Button>
        </form>
      </Modal>

      {/* Modal: Reagendar */}
      <Modal
        open={Boolean(rescheduleTarget)}
        title={t.owner.reschedule}
        maxWidth="max-w-lg"
        onClose={() => setRescheduleTarget(null)}
      >
        <form onSubmit={handleReschedule} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-date">{t.common.date}</Label>
              <Input
                id="reschedule-date"
                type="date"
                required
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3 tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-time">{t.common.time}</Label>
              <Input
                id="reschedule-time"
                type="time"
                required
                value={rescheduleTime}
                onChange={(e) => setRescheduleTime(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3 tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reschedule-collab">
              {t.booking.stepProfessional}
            </Label>
            <select
              id="reschedule-collab"
              value={rescheduleCollaboratorId}
              onChange={(e) => setRescheduleCollaboratorId(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink"
            >
              {activeCollaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {collaboratorMap.get(rescheduleCollaboratorId) && (
              <div className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-subtle/40 p-2">
                {collaboratorMap.get(rescheduleCollaboratorId)?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={collaboratorMap.get(rescheduleCollaboratorId)!.avatarUrl!}
                    alt={collaboratorMap.get(rescheduleCollaboratorId)!.name}
                    className="h-8 w-8 shrink-0 rounded-full object-cover border border-border-subtle"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent text-xs font-semibold">
                    {getClientInitials(collaboratorMap.get(rescheduleCollaboratorId)!.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink truncate">
                    {collaboratorMap.get(rescheduleCollaboratorId)!.name}
                  </p>
                  {collaboratorMap.get(rescheduleCollaboratorId)!.specialty && (
                    <p className="text-[11px] text-ink-secondary truncate">
                      {collaboratorMap.get(rescheduleCollaboratorId)!.specialty}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {rescheduleError && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
            >
              {rescheduleError}
            </p>
          )}

          <Button
            type="submit"
            disabled={rescheduling}
            className="min-h-11 w-full rounded-full bg-accent text-accent-ink hover:bg-accent-hover cursor-pointer"
          >
            {rescheduling && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {t.common.confirm}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
