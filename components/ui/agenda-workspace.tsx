"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Plus, RotateCw, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { agendaBoundary, agendaClock, agendaMonth, agendaRange, agendaViews, findAppointmentConflict, formatAgendaDay, isAppointmentPaid, isReadyToComplete, isUnpaidCompleted, localDayMinuteToUtcIso, overlapsScheduleBlock, shiftAgendaDay, shiftAgendaMonth } from "@/lib/agenda";
import type { AgendaView } from "@/lib/agenda";
import { ApiError, apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone, formatPriceFromCents, formatTimeInTimezone, getTodayIsoDateInTimezone } from "@/lib/format";
import { agendaStrings } from "@/lib/i18n/agenda";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Appointment, AppointmentStatus, ScheduleBlock, UpdatableAppointmentStatus } from "@/lib/types/appointment";
import type { MeResponse } from "@/lib/types/auth";
import type { FinanceSummaryResponse } from "@/lib/types/finance";
import type { Service } from "@/lib/types/service";
import type { Collaborator, CollaboratorsListResponse } from "@/lib/types/team";
import { AgendaAppointmentDetails, AgendaCard, WhatsAppLink } from "./agenda-card";
import type { AgendaItemProps, AgendaPayment } from "./agenda-card";
import { AgendaMonthGrid, agendaRangeLabel, AgendaTimeGrid } from "./agenda-calendar";
import { AgendaDialog, AgendaProfessionalFilter, AgendaSelect, ProfessionalAvatar } from "./agenda-controls";
import type { AgendaPerson } from "./agenda-controls";
import { AgendaEditor } from "./agenda-editor";
import { AgendaStatusLegend, PaidBadge } from "./agenda-status";

type StatusFilter = "" | AppointmentStatus | "CANCELED_OR_ABSENT";
type AlertFilter = "readyToComplete" | "unpaidCompleted";
type AlertType = "PENDING" | AlertFilter;
type Filter = StatusFilter | AlertFilter;
type EditorTarget =
  | Appointment
  | { mode: "new"; date?: string; time?: string; personId?: string }
  | "new"
  | null;
const statuses: AppointmentStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"];
const emptyAppointments: Appointment[] = [];
const emptyBlocks: ScheduleBlock[] = [];
const metricIcons = [CalendarDays, CheckCircle2, Clock3, XCircle];
const control = "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 text-xs font-semibold text-ink-secondary hover:border-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";
const alertColors: Record<AlertType, string> = {
  PENDING: "border-amber-500/40 bg-amber-500/12 text-amber-400",
  readyToComplete: "border-sky-500/40 bg-sky-500/12 text-sky-400",
  unpaidCompleted: "border-orange-500/40 bg-orange-500/12 text-orange-400",
};

function useAgendaRange<T>(path: string, from: string, to: string, timezone: string, refresh: number, empty: T[], enabled = true) {
  const key = `${path}/${from}/${to}/${timezone}/${refresh}`;
  const [result, setResult] = useState<{ key: string; rows?: T[]; error?: boolean }>({ key: "" });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void apiRequest<T[]>(path, {
      query: { from: agendaBoundary(from, timezone), to: agendaBoundary(to, timezone) },
      signal: controller.signal,
    }).then((rows) => {
      if (!controller.signal.aborted) setResult({ key, rows });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, error: true });
    });
    return () => controller.abort();
  }, [enabled, from, key, path, timezone, to]);
  return {
    rows: result.key === key ? result.rows ?? empty : empty,
    loading: enabled && result.key !== key,
    error: enabled && result.key === key && result.error,
  };
}

async function getPaymentSummaries(ids: string[], signal: AbortSignal) {
  const batches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) => ids.slice(index * 100, (index + 1) * 100).join(","));
  const rows = await Promise.all(batches.map((batch) => apiRequest<AgendaPayment[]>("/finance/appointments/payment-summary", {
    query: { ids: batch }, signal,
  })));
  return new Map(rows.flat().map((row) => [row.appointmentId, row]));
}

function useGlobalAppointments(path: string, canManagePayments: boolean, refresh: number) {
  const [result, setResult] = useState({
    pending: emptyAppointments, confirmed: emptyAppointments, unpaid: emptyAppointments,
    appointmentsError: false, paymentsError: false,
  });
  useEffect(() => {
    let request: AbortController | undefined;
    function load() {
      request?.abort();
      const controller = new AbortController();
      request = controller;
      const { signal } = controller;
      function list(status: AppointmentStatus) {
        return apiRequest<Appointment[]>(path, { query: { status }, signal });
      }
      void Promise.all([list("PENDING"), list("CONFIRMED")]).then(([pending, confirmed]) => {
        if (!signal.aborted) setResult((old) => ({ ...old, pending, confirmed, appointmentsError: false }));
      }).catch(() => {
        if (!signal.aborted) setResult((old) => ({ ...old, appointmentsError: true }));
      });
      if (canManagePayments) {
        void list("COMPLETED").then(async (rows) => {
          const payments = await getPaymentSummaries(rows.map((row) => row.id), signal);
          if (!signal.aborted) setResult((old) => ({
            ...old, unpaid: rows.filter((row) => isUnpaidCompleted(row, payments.get(row.id))), paymentsError: false,
          }));
        }).catch(() => {
          if (!signal.aborted) setResult((old) => ({ ...old, paymentsError: true }));
        });
      }
    }
    load();
    const timer = window.setInterval(() => { if (!document.hidden) load(); }, 60_000);
    window.addEventListener("focus", load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", load);
      request?.abort();
    };
  }, [canManagePayments, path, refresh]);
  return result;
}

function useAgendaClock(rows: Appointment[], extraEnd?: string) {
  const [now, setNow] = useState(0);
  const endTimes = useMemo(() => [...rows.filter((row) => row.status === "CONFIRMED").map((row) => Date.parse(row.endsAt)),
    ...(extraEnd ? [Date.parse(extraEnd)] : [])], [rows, extraEnd]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      clearTimeout(timer);
      const next = Date.now();
      setNow(next);
      const minute = Math.min(30_000, 60_000 - next % 60_000);
      const nearest = endTimes.reduce((soonest, end) => end > next ? Math.min(soonest, end - next) : soonest, minute);
      timer = setTimeout(tick, Math.max(nearest, 1));
    }
    timer = setTimeout(tick, 0);
    window.addEventListener("focus", tick);
    return () => { clearTimeout(timer); window.removeEventListener("focus", tick); };
  }, [endTimes]);
  return now;
}

function filterStatus(row: Appointment, filter: StatusFilter) {
  return !filter || (filter === "CANCELED_OR_ABSENT" ? row.status === "CANCELED" || row.status === "NO_SHOW" : row.status === filter);
}

export function AgendaWorkspace({ session, renderReceipt }: {
  session: MeResponse;
  renderReceipt?: (props: { appointmentId: string; timezone: string; onClose: () => void; onChanged: () => void }) => ReactNode;
}) {
  const { locale, t } = useLocale();
  const copy = agendaStrings(locale);
  const targetId = useSearchParams().get("appointmentId");
  const { company } = session;
  const { timezone, currency } = company;
  const isOwner = session.role === "OWNER";
  const canManagePayments = isOwner && !!renderReceipt;
  const clock = useMemo(() => agendaClock(timezone), [timezone]);
  const [initialToday] = useState(() => getTodayIsoDateInTimezone(timezone));
  const [focus, setFocus] = useState(initialToday);
  const [miniMonth, setMiniMonth] = useState(initialToday);
  const [view, setView] = useState<AgendaView>("week");
  const [personId, setPersonId] = useState("");
  const [status, setStatus] = useState<Filter>("");
  const [highlightedId, setHighlightedId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [changedPayment, setChangedPayment] = useState(0);
  const [opened, setOpened] = useState<Appointment | null>(null);
  const [canceling, setCanceling] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [editor, setEditor] = useState<EditorTarget>(null);
  const [pendingReschedule, setPendingReschedule] = useState<{
    appointment: Appointment;
    targetStartsAt: string;
    targetEndsAt: string;
    targetDate: string;
    targetMinute: number;
  } | null>(null);
  const [receiptId, setReceiptId] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [catalog, setCatalog] = useState<{ people: Collaborator[]; services: Service[]; error: boolean }>({ people: [], services: [], error: false });

  const range = useMemo(() => agendaRange(view, focus), [focus, view]);
  const month = useMemo(() => agendaMonth(miniMonth), [miniMonth]);
  const path = isOwner ? "/appointments" : "/me/appointments";
  const main = useAgendaRange(path, range.from, range.to, timezone, refresh, emptyAppointments);
  // Garante busca completa do mês visível no mini-calendário lateral independentemente da vista ativa
  const mini = useAgendaRange(path, month.from, month.to, timezone, refresh, emptyAppointments);
  const schedule = useAgendaRange(isOwner ? "/schedule-blocks" : "/me/schedule-blocks",
    range.from, range.to, timezone, refresh, emptyBlocks, view === "day" || view === "week");
  const global = useGlobalAppointments(path, canManagePayments, refresh + changedPayment);
  const clockRows = useMemo(() => [...main.rows, ...global.confirmed], [main.rows, global.confirmed]);
  const now = useAgendaClock(clockRows, opened?.endsAt);
  const today = now ? clock(now).date : initialToday;

  useEffect(() => {
    if (!isOwner) return;
    const ctl = new AbortController();
    void Promise.all([
      apiRequest<CollaboratorsListResponse>("/collaborators", { signal: ctl.signal }),
      apiRequest<{ services: Service[] } | Service[]>("/services", { signal: ctl.signal }),
    ]).then(async ([staff, services]) => {
      if (ctl.signal.aborted) return;
      const people = staff.collaborators;
      setCatalog({ people, services: Array.isArray(services) ? services : services.services, error: false });
      // Older collaborator responses omit avatarUrl from their serialized schema.
      if (people.some((person) => person.avatarUrl === undefined)) {
        const profiles = await apiRequest<Pick<FinanceSummaryResponse, "byCollaborator">>("/finance/summary", {
          query: { from: initialToday, to: initialToday }, signal: ctl.signal,
        }).catch(() => null);
        if (!profiles?.byCollaborator || ctl.signal.aborted) return;
        const avatars = new Map(profiles.byCollaborator.map((person) => [person.collaboratorId, person.avatarUrl]));
        setCatalog((old) => ({ ...old, people: people.map((person) => ({
          ...person, avatarUrl: person.avatarUrl === undefined ? avatars.get(person.id) : person.avatarUrl,
        })) }));
      }
    }).catch(() => { if (!ctl.signal.aborted) setCatalog((old) => ({ ...old, error: true })); });
    return () => ctl.abort();
  }, [initialToday, isOwner, refresh]);

  useEffect(() => {
    if (!targetId) return;
    const ctl = new AbortController();
    void apiRequest<Appointment>(`/appointments/${encodeURIComponent(targetId)}`, { signal: ctl.signal }).then((row) => {
      if (ctl.signal.aborted) return;
      const date = clock(row.startsAt).date;
      setFocus(date); setMiniMonth(date); setOpened(row); setPersonId(""); setStatus("");
    }).catch((error) => { if (!ctl.signal.aborted) setActionError(error instanceof ApiError && error.status === 404 ? copy.empty : t.errors.networkDescription); });
    return () => ctl.abort();
  }, [clock, copy.empty, targetId, t.errors.networkDescription]);

  const staff = useMemo(() => new Map<string, AgendaPerson>((isOwner ? catalog.people : [session]).map((person) => [person.id, person])), [isOwner, catalog.people, session]);
  const blocks = useMemo(() => schedule.rows.filter((block) => !personId || !block.collaboratorId || block.collaboratorId === personId),
    [personId, schedule.rows]);
  const periodRows = useMemo(() => main.rows.filter((row) => !personId || row.collaboratorId === personId), [main.rows, personId]);
  const metricRows = view === "month" ? periodRows.filter((row) => clock(row.startsAt).date.slice(0, 7) === focus.slice(0, 7)) : periodRows;
  const miniCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const all = new Map<string, Appointment>();
    for (const row of mini.rows) all.set(row.id, row);
    for (const row of main.rows) all.set(row.id, row);
    for (const row of all.values()) {
      if (personId && row.collaboratorId !== personId) continue;
      const day = clock(row.startsAt).date;
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return counts;
  }, [mini.rows, main.rows, personId, clock]);
  const paymentIds = useMemo(() => canManagePayments ? [...new Set([...periodRows.map((row) => row.id), ...(opened ? [opened.id] : [])])].sort().join(",") : "", [canManagePayments, opened, periodRows]);
  const paymentKey = `${paymentIds}/${changedPayment}/${refresh}`;
  const [pay, setPay] = useState<{ key: string; rows?: Map<string, AgendaPayment>; error?: boolean }>({ key: "" });
  useEffect(() => {
    if (!paymentIds) return;
    const ctl = new AbortController();
    void getPaymentSummaries(paymentIds.split(","), ctl.signal)
      .then((rows) => { if (!ctl.signal.aborted) setPay({ key: paymentKey, rows }); })
      .catch(() => { if (!ctl.signal.aborted) setPay({ key: paymentKey, error: true }); });
    return () => ctl.abort();
  }, [paymentIds, paymentKey]);

  const visiblePayments = pay.key === paymentKey ? pay.rows : undefined;
  const paymentError = pay.key === paymentKey && pay.error;
  const paymentLoading = !!paymentIds && pay.key !== paymentKey;
  const readyToComplete = useMemo(() => global.confirmed.filter((row) => isReadyToComplete(row, now)), [global.confirmed, now]);
  const shown = useMemo(() => periodRows.filter((row) => {
    if (status === "readyToComplete") return isReadyToComplete(row, now);
    if (status === "unpaidCompleted") return isUnpaidCompleted(row, visiblePayments?.get(row.id));
    return filterStatus(row, status);
  }), [now, periodRows, status, visiblePayments]);
  const rowsByDay = useMemo(() => {
    const rows = new Map<string, Appointment[]>();
    for (const row of shown) {
      const date = clock(row.startsAt).date;
      const day = date < range.from ? range.from : date;
      const group = rows.get(day) ?? [];
      group.push(row);
      rows.set(day, group);
    }
    return rows;
  }, [clock, shown, range.from]);
  const monthCounts = useMemo(() => new Map(Array.from(rowsByDay, ([day, rows]) => [day, rows.length])), [rowsByDay]);
  const alertItems: { filter: AlertType; rows: Appointment[]; countLabel: (count: number) => string; icon: typeof Clock3 }[] = [
    { filter: "PENDING", rows: global.pending, countLabel: copy.pendingConfirmationCount, icon: CalendarDays },
    { filter: "readyToComplete", rows: readyToComplete, countLabel: copy.readyToCompleteCount, icon: Clock3 },
    { filter: "unpaidCompleted", rows: global.unpaid, countLabel: copy.unpaidCompletedCount, icon: Wallet },
  ];

  const metrics: { filter: StatusFilter; label: string; count: number }[] = [
    { filter: "", label: copy.total, count: metricRows.length },
    ...([ ["COMPLETED", copy.completed], ["PENDING", copy.pending], ["CANCELED_OR_ABSENT", copy.canceled] ] as const)
      .map(([filter, label]) => ({ filter, label, count: metricRows.filter((row) => filterStatus(row, filter)).length })),
  ];
  const expectedCommission = isOwner ? 0 : metricRows
    .filter((row) => row.status !== "CANCELED" && row.status !== "NO_SHOW")
    .reduce((total, row) => total + Math.round(row.servicePriceInCentsSnapshot * row.commissionPercentageSnapshot / 100), 0);

  function navigate(date: string) { setFocus(date); setMiniMonth(date); setHighlightedId(""); }
  function changeStatus(value: Filter) { setStatus(value); setHighlightedId(""); }
  function openAlert(row: Appointment, filter: AlertType) {
    navigate(clock(row.startsAt).date);
    if (view === "month" || view === "list") setView("day");
    setPersonId("");
    setStatus(filter);
    setHighlightedId(row.id);
    setActionError("");
    setOpened(row);
  }
  function changePeriod(direction: number) {
    navigate(view === "month" || view === "list" ? shiftAgendaMonth(focus, direction) : shiftAgendaDay(focus, direction * (view === "week" ? 7 : 1)));
  }

  function handleRescheduleDrop(appointment: Appointment, targetDate: string, targetMinute: number) {
    const targetStartsAt = localDayMinuteToUtcIso(targetDate, targetMinute, timezone);
    const durationMs = appointment.serviceDurationMinutesSnapshot * 60_000;
    const targetEndsAt = new Date(Date.parse(targetStartsAt) + durationMs).toISOString();
    if (overlapsScheduleBlock(schedule.rows, Date.parse(targetStartsAt), Date.parse(targetEndsAt), appointment.collaboratorId)) return;
    setPendingReschedule({
      appointment,
      targetStartsAt,
      targetEndsAt,
      targetDate,
      targetMinute,
    });
  }

  async function confirmReschedule() {
    if (!pendingReschedule || busy) return;
    const { appointment, targetStartsAt, targetEndsAt } = pendingReschedule;
    const start = Date.parse(targetStartsAt);
    const end = Date.parse(targetEndsAt);
    if (findAppointmentConflict(main.rows, appointment, start, end)) {
      setPendingReschedule(null);
      toast.warning(copy.professionalAlreadyBooked);
      return;
    }
    if (overlapsScheduleBlock(schedule.rows, start, end, appointment.collaboratorId)) {
      setPendingReschedule(null);
      toast.error(copy.blockedTime);
      return;
    }
    setBusy(appointment.id);
    setActionError("");
    try {
      await apiRequest<Appointment>(`/appointments/${appointment.id}/reschedule`, {
        method: "PATCH",
        body: { startsAt: targetStartsAt },
      });
      toast.success(copy.rescheduledSuccess);
      setRefresh((value) => value + 1);
      setPendingReschedule(null);
    } catch (error) {
      const message = error instanceof ApiError && error.status === 409
        ? copy.rescheduleConflict
        : t.errors.networkDescription;
      toast.error(message);
      setActionError(message);
      setPendingReschedule(null);
    } finally {
      setBusy("");
    }
  }

  function handleEmptySlotClick(date: string, minute: number) {
    if (!isOwner) return;
    const targetIso = localDayMinuteToUtcIso(date, minute, timezone);
    setEditor({
      mode: "new",
      date,
      time: targetIso,
      personId: personId || undefined,
    });
  }

  function saved(row: Appointment) {
    setEditor(null);
    setActionError("");
    setRefresh((value) => value + 1);
    navigate(clock(row.startsAt).date);
    setPersonId(""); setStatus("");
    setOpened(row);
  }

  function openPayments(appointmentId: string) {
    setOpened(null);
    setReceiptId(appointmentId);
  }

  async function offerPayment(row: Appointment) {
    const [payment] = await apiRequest<AgendaPayment[]>("/finance/appointments/payment-summary", {
      query: { ids: row.id },
    }).catch(() => []);
    toast.success(copy.completedSuccess, isUnpaidCompleted(row, payment) ? {
      action: { label: t.finance.registerReceipt, onClick: () => openPayments(row.id) },
      classNames: { actionButton: "cursor-pointer" },
    } : undefined);
  }

  async function update(row: Appointment, next: UpdatableAppointmentStatus, reason?: string) {
    if (busy) return;
    if (next === "COMPLETED" && !isReadyToComplete(row, now)) return;
    setBusy(row.id);
    setActionError("");
    try {
      const updated = await apiRequest<Appointment>(`/appointments/${row.id}/status`, { method: "PATCH", body: { status: next, cancellationReason: reason } });
      setOpened((current) => current?.id === updated.id ? updated : current);
      if (next === "CANCELED") setCanceling(null);
      setRefresh((value) => value + 1);
      if (updated.status === "COMPLETED") {
        if (canManagePayments) void offerPayment(updated);
        else toast.success(copy.completedSuccess);
      }
    } catch (error) {
      setActionError(error instanceof ApiError && error.message === "Cannot complete an appointment before it ends."
        ? copy.endHint(formatTimeInTimezone(row.endsAt, timezone, locale)) : t.errors.networkDescription);
    } finally { setBusy(""); }
  }

  function submitCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = cancelReason.trim();
    if (!reason) { setActionError(t.common.cancelReasonRequired); return; }
    if (canceling) void update(canceling, "CANCELED", reason);
  }

  function itemProps(row: Appointment): AgendaItemProps {
    return {
      appointment: row, currency, timezone, now, person: staff.get(row.collaboratorId), busy: !!busy,
      ...(canManagePayments ? {
        payment: visiblePayments?.get(row.id),
        paymentError,
        onPayments: () => openPayments(row.id),
      } : {}),
      commissionLabel: isOwner ? undefined : `+${formatPriceFromCents(Math.round(row.servicePriceInCentsSnapshot * row.commissionPercentageSnapshot / 100), locale, currency)}`,
      actions: {
        onStatusChange: (value) => void update(row, value),
        onCancel: () => { setOpened(null); setCanceling(row); setCancelReason(""); setActionError(""); },
        onReschedule: isOwner ? () => { setOpened(null); setEditor(row); } : undefined,
      },
    };
  }

  function renderEvent(row: Appointment, compact: boolean, showAlertActions = true) {
    const person = staff.get(row.collaboratorId);
    const start = formatTimeInTimezone(row.startsAt, timezone, locale);
    const end = formatTimeInTimezone(row.endsAt, timezone, locale);
    const payment = visiblePayments?.get(row.id);
    const paid = isAppointmentPaid(payment);
    const readyToComplete = showAlertActions && isReadyToComplete(row, now);
    const unpaidCompleted = showAlertActions && isUnpaidCompleted(row, payment);
    const description = [row.clientName, row.serviceNameSnapshot, `${start} – ${end}`, t.status[row.status],
      unpaidCompleted ? copy.unpaidCompleted : paid ? copy.paid : null].filter(Boolean).join(" · ");
    const alertAction = readyToComplete ? {
      label: copy.endedComplete,
      shortLabel: t.common.actionComplete,
      icon: Clock3,
      run: () => void update(row, "COMPLETED"),
    } : unpaidCompleted ? {
      label: t.finance.registerReceipt,
      shortLabel: copy.registerPaymentShort,
      icon: Wallet,
      run: () => openPayments(row.id),
    } : null;
    const ActionIcon = alertAction?.icon;
    return <div data-agenda-status={row.status} data-agenda-event data-agenda-highlighted={row.id === highlightedId || undefined}
      className={`relative flex size-full min-w-0 justify-center overflow-hidden rounded-md border-s-2 shadow-xs ${compact ? "items-stretch" : "flex-col"} ${row.id === highlightedId ? "ring-2 ring-inset ring-[var(--appointment-accent)]" : ""}`}>
      <div className="flex min-h-0 min-w-0 flex-1">
      <button type="button" onClick={() => { setActionError(""); setOpened(row); }}
        aria-label={`${copy.openDetails} · ${description}`} title={description}
        className="flex min-h-0 min-w-0 flex-1 cursor-pointer flex-col items-start justify-center gap-0.5 overflow-hidden px-1.5 text-left hover:bg-ink/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent group-active/agenda-drag:cursor-grabbing">
        <span className="flex w-full min-w-0 items-center justify-between gap-1">
          <span className="min-w-0 truncate text-[11px] font-semibold leading-tight">{row.serviceNameSnapshot}</span>
          {unpaidCompleted ? <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[var(--status-warning-bg)] px-0.5 text-[9px] font-semibold text-[var(--status-warning-ink)]">
            <Wallet size={11} aria-hidden="true" />
            <span className="hidden @min-[5rem]:inline @min-[10rem]:hidden">{copy.unpaidCompletedShort}</span>
            <span className="hidden @min-[10rem]:inline">{copy.unpaidCompleted}</span>
          </span> : paid && <PaidBadge compact label={copy.paid} />}
        </span>
        {!compact && (!alertAction || row.serviceDurationMinutesSnapshot >= 45) && <span className="max-w-full truncate text-[10px] font-medium leading-tight tabular-nums">{start} – {end} · {row.clientName}</span>}
        {!compact && !alertAction && row.serviceDurationMinutesSnapshot >= 45 && person && <span className="mt-0.5 flex max-w-full items-center gap-1 text-[9px]"><ProfessionalAvatar person={person} className="size-3.5" /><span className="truncate">{person.name}</span></span>}
      </button>
      {showAlertActions && !compact && <div className="hidden self-start pe-0.5 pt-0.5 @min-[5rem]:block [&_a]:size-5 [&_svg]:size-3">
        <WhatsAppLink appointment={row} timezone={timezone} />
      </div>}
      </div>
      {alertAction && ActionIcon && <button type="button" data-agenda-quick-action
        disabled={readyToComplete && !!busy} onClick={alertAction.run}
        aria-label={`${alertAction.label} · ${row.clientName}`} title={alertAction.label}
        className={`flex min-w-0 cursor-pointer items-center gap-1 px-1.5 py-0.5 text-left text-[10px] font-semibold leading-tight hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55 ${compact ? "max-w-3/4 border-s" : "border-t"} ${unpaidCompleted ? "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-ink)]" : "border-border-subtle bg-accent-soft text-ink"}`}>
        <ActionIcon size={11} className="shrink-0" aria-hidden="true" />
        <span className="truncate @min-[10rem]:hidden">{alertAction.shortLabel}</span>
        <span className="hidden truncate @min-[10rem]:inline">{alertAction.label}</span>
      </button>}
    </div>;
  }

  const visibleDateLabel = agendaRangeLabel(focus, range.days, view === "list" || view === "month", locale);
  return <div data-slot="agenda-workspace" className="min-w-0 space-y-4 sm:space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><h2 className="text-xl font-semibold leading-tight tracking-tight text-ink sm:text-2xl">{isOwner ? t.owner.agendaTitle : t.collaborator.agendaTitle}</h2>
        {!isOwner && <p className="mt-1 text-xs text-ink-secondary">{t.owner.commissions} <span className="font-semibold text-accent">{formatPriceFromCents(expectedCommission, locale, currency)}</span></p>}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={t.common.retry} onClick={() => setRefresh((value) => value + 1)} className={`${control} size-9 p-0`}><RotateCw size={15} className={main.loading ? "animate-spin" : ""} /></button>
        {isOwner && <button type="button" onClick={() => setEditor("new")} className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink shadow-xs hover:bg-accent-hover sm:text-sm"><Plus size={16} />{t.owner.newAppointment}</button>}
      </div>
    </header>

    <section aria-label={copy.appointments} className="grid grid-cols-2 gap-2 md:grid-cols-4 sm:gap-3">
      {metrics.map((metric, index) => {
        const active = status === metric.filter;
        const Icon = metricIcons[index];
        return <button key={metric.filter} type="button" aria-pressed={active} onClick={() => changeStatus(active ? "" : metric.filter)}
          className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2.5 text-left transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent sm:gap-3 sm:px-3.5 sm:py-3 ${active ? "border-accent/65 bg-accent-soft" : "border-border-subtle bg-surface"}`}>
          <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${active ? "bg-accent text-accent-ink" : "bg-subtle text-accent"}`}><Icon size={16} /></span>
          <span className="min-w-0"><span className="block text-[10px] font-medium leading-tight text-ink-secondary sm:text-xs">{metric.label}</span><strong className="block text-lg leading-tight text-ink tabular-nums">{main.loading ? "—" : metric.count}</strong></span>
        </button>;
      })}
    </section>

    {(actionError && !canceling && !opened || catalog.error || mini.error || schedule.error || global.appointmentsError) && <p role="alert" className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-sm text-[var(--status-danger-ink)]">{actionError || t.errors.networkDescription}</p>}
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="grid min-w-0 gap-3 rounded-2xl border border-border-subtle bg-surface p-3 sm:grid-cols-[minmax(11rem,14rem)_1fr] sm:p-3.5 lg:grid-cols-1 lg:gap-4" aria-label={copy.calendar}>
        <div className="mx-auto w-full max-w-57 lg:max-w-none">
          <AgendaMonthGrid company={company} month={miniMonth} selected={focus} today={today} counts={miniCounts}
            onMonth={setMiniMonth} onSelect={(date) => { navigate(date); if (view === "month") setView("day"); }} />
        </div>
        <div className="space-y-3 border-t border-border-subtle pt-3 sm:border-t-0 sm:pt-0 lg:border-t lg:pt-3">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-secondary">
            <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[#10B981]" />{copy.working}</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-1.5 rounded-full bg-[var(--status-danger-ink)]" />{copy.closed}</span>
          </div>
          {isOwner && <AgendaProfessionalFilter label={copy.professional} allLabel={copy.allProfessionals}
            people={catalog.people} value={personId} onChange={setPersonId} />}
          <AgendaSelect label={copy.status} placeholder={status === "CANCELED_OR_ABSENT" ? copy.canceled : undefined} value={status} onChange={(value) => changeStatus(value as Filter)} options={[
            { value: "", label: copy.allStatuses }, ...statuses.map((value) => ({ value, label: t.status[value] })),
            { value: "readyToComplete", label: copy.readyToComplete },
            ...(canManagePayments ? [{ value: "unpaidCompleted", label: copy.unpaidCompleted }] : []),
          ]} />
        </div>
      </aside>

      <section className="min-w-0 space-y-3" aria-label={copy.appointments} aria-busy={main.loading || (status === "unpaidCompleted" && paymentLoading)}>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface p-2.5 sm:p-3">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => navigate(today)} className={control}>{copy.today}</button>
            <button type="button" onClick={() => changePeriod(-1)} aria-label={copy.previous} className={`${control} size-8 min-h-8 p-0`}><ChevronLeft size={16} /></button>
            <button type="button" onClick={() => changePeriod(1)} aria-label={copy.next} className={`${control} size-8 min-h-8 p-0`}><ChevronRight size={16} /></button>
            <h3 className="min-w-0 px-1 text-sm font-semibold text-ink first-letter:uppercase sm:text-base" aria-live="polite">{visibleDateLabel}</h3>
          </div>
          <div className="grid w-full grid-cols-4 gap-0.5 rounded-xl bg-subtle p-1 sm:flex sm:w-auto" aria-label={copy.calendar}>
            {agendaViews.map((value) => <button key={value} type="button" aria-pressed={value === view} onClick={() => setView(value)}
              className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-accent ${value === view ? "bg-surface text-accent shadow-xs" : "text-ink-secondary hover:text-ink"}`}>{copy.views[value]}</button>)}
          </div>
        </div>

        {(alertItems.some(({ rows }) => rows.length > 0) || global.paymentsError) &&
          <section aria-label={copy.alerts} className="flex flex-wrap gap-2 rounded-xl border border-border-subtle bg-surface p-2">
            {alertItems.map(({ filter, rows, countLabel, icon: Icon }) => {
              if (!rows.length) return null;
              const next = rows.reduce((oldest, row) => Date.parse(row.startsAt) < Date.parse(oldest.startsAt) ? row : oldest);
              return <button type="button" key={filter} onClick={() => openAlert(next, filter)}
                className={`inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1 text-left text-xs font-medium hover:underline focus-visible:outline-2 focus-visible:outline-accent ${alertColors[filter]}`}>
                <Icon size={15} aria-hidden="true" className="shrink-0 motion-safe:animate-pulse" />
                <span aria-live="polite">{countLabel(rows.length)}</span>
                <ArrowRight size={14} className="shrink-0" aria-hidden="true" />
              </button>;
            })}
            {global.paymentsError && <p role="alert" className="px-2 py-1 text-xs text-ink-secondary">{copy.failedPaymentStatus}</p>}
          </section>}
        <AgendaStatusLegend label={copy.statusLegend} labels={t.status} />
        {main.error ? <div className="rounded-xl border border-border-subtle bg-surface p-5 text-sm text-ink-secondary" role="alert">{t.errors.networkDescription}</div>
          : view === "list" ? <div className="space-y-4">
            {main.loading || (status === "unpaidCompleted" && paymentLoading) ? <p className="rounded-xl bg-surface p-4 text-sm text-ink-secondary" role="status">{t.common.loading}</p>
              : status === "unpaidCompleted" && paymentError ? null
              : !shown.length && <p className="rounded-xl border border-border-subtle bg-surface p-5 text-sm text-ink-secondary">{copy.empty}</p>}
            {Array.from(rowsByDay).map(([day, rows]) => <section key={day} className="space-y-2">
              <h4 className="text-sm font-semibold text-ink first-letter:uppercase">{formatAgendaDay(day, locale, { weekday: "long", day: "numeric", month: "long" })}</h4>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <AgendaCard key={row.id} {...itemProps(row)} onDetails={() => { setActionError(""); setOpened(row); }} />)}</div>
            </section>)}
          </div> : view === "month" ? <AgendaMonthGrid company={company} month={focus} selected={focus} today={today} counts={monthCounts}
            onSelect={(date) => { navigate(date); setView("day"); }} renderDay={(date) => {
              const rows = rowsByDay.get(date) ?? [];
              return <div className="mt-1 space-y-0.5">
                {rows.slice(0, 2).map((row) => <div key={row.id} className="h-5.5">{renderEvent(row, true, false)}</div>)}
                {rows.length > 2 && <button type="button" aria-label={`${rows.length} ${copy.appointments}`} className="cursor-pointer px-1 text-[10px] font-semibold text-accent hover:underline" onClick={() => { navigate(date); setView("day"); }}>+{rows.length - 2}</button>}
              </div>;
            }} /> : <AgendaTimeGrid days={range.days} company={company} selected={focus} today={today} now={now} byDay={rowsByDay}
              appointments={main.rows} blocks={blocks} blocksReady={!schedule.loading && !schedule.error} staff={staff}
              isOwner={isOwner} onSelect={(date) => { navigate(date); setView("day"); }} renderBlock={renderEvent}
              onRescheduleDrop={handleRescheduleDrop} onRescheduleConflict={() => toast.warning(copy.professionalAlreadyBooked)}
              onEmptySlotClick={handleEmptySlotClick} />}
      </section>
    </div>

    {opened && <AgendaAppointmentDetails {...itemProps(opened)} error={actionError} onClose={() => { setOpened(null); setActionError(""); }} />}
    {editor && <AgendaEditor
      key={typeof editor === "object" && !("mode" in editor) ? editor.id : "new"}
      company={company}
      today={today}
      focusDate={typeof editor === "object" && !("mode" in editor) ? clock(editor.startsAt).date : typeof editor === "object" && "mode" in editor && editor.date ? editor.date : focus}
      initialDate={typeof editor === "object" && "mode" in editor ? editor.date : undefined}
      initialTime={typeof editor === "object" && "mode" in editor ? editor.time : undefined}
      initialPersonId={typeof editor === "object" && "mode" in editor ? editor.personId : undefined}
      appointment={typeof editor === "object" && !("mode" in editor) ? editor : undefined}
      collaborators={catalog.people}
      services={catalog.services}
      onClose={() => setEditor(null)}
      onSaved={saved}
    />}
    {pendingReschedule && (
      <AgendaDialog
        centered
        title={copy.confirmRescheduleTitle}
        closeDisabled={!!busy}
        onClose={() => setPendingReschedule(null)}
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">{copy.confirmRescheduleSubtitle}</p>
          <div className="space-y-3 rounded-2xl border border-border-subtle bg-subtle/50 p-4">
            <div>
              <span className="text-xs font-semibold text-ink-secondary">{copy.client}</span>
              <p className="text-sm font-semibold text-ink">{pendingReschedule.appointment.clientName}</p>
            </div>
            <div>
              <span className="text-xs font-semibold text-ink-secondary">{t.booking.stepService}</span>
              <p className="text-sm font-semibold text-ink">{pendingReschedule.appointment.serviceNameSnapshot}</p>
            </div>
            <div className="grid gap-3 border-t border-border-subtle pt-2 sm:grid-cols-2">
              <div>
                <span className="text-xs font-semibold text-ink-secondary">{copy.currentSchedule}</span>
                <p className="text-xs font-medium text-ink tabular-nums">
                  {formatDateTimeInTimezone(pendingReschedule.appointment.startsAt, timezone, locale)} – {formatTimeInTimezone(pendingReschedule.appointment.endsAt, timezone, locale)}
                </p>
              </div>
              <div>
                <span className="text-xs font-semibold text-accent">{copy.newSchedule}</span>
                <p className="text-xs font-semibold text-accent tabular-nums">
                  {formatDateTimeInTimezone(pendingReschedule.targetStartsAt, timezone, locale)} – {formatTimeInTimezone(pendingReschedule.targetEndsAt, timezone, locale)}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => setPendingReschedule(null)}
              className="min-h-10 cursor-pointer rounded-xl border border-border-subtle bg-surface px-4 text-sm font-semibold text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-55"
            >
              {copy.cancel}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void confirmReschedule()}
              className="min-h-10 cursor-pointer rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55"
            >
              {copy.confirmReschedule}
            </button>
          </div>
        </div>
      </AgendaDialog>
    )}
    {canceling && <AgendaDialog title={t.common.cancelModalTitle} closeDisabled={!!busy} onClose={() => { setCanceling(null); setActionError(""); }}>
      <form onSubmit={submitCancellation} className="space-y-3">
        <p className="text-sm text-ink-secondary">{t.common.cancelModalSubtitle}</p>
        <label className="block text-sm font-medium text-ink">{t.common.cancelReasonLabel}
          <textarea required maxLength={500} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder={t.common.cancelReasonPlaceholder}
            className="mt-1 block min-h-20 w-full rounded-xl border border-border-subtle bg-surface p-3 text-sm text-ink outline-none focus-visible:border-accent" />
        </label>
        {actionError && <p role="alert" className="text-xs text-[var(--status-danger-ink)]">{actionError}</p>}
        <button type="submit" disabled={!!busy} className="min-h-10 cursor-pointer rounded-xl bg-[var(--status-danger-bg)] px-4 text-sm font-semibold text-[var(--status-danger-ink)] disabled:cursor-not-allowed disabled:opacity-55">{t.common.actionCancel}</button>
      </form>
    </AgendaDialog>}
    {receiptId && renderReceipt?.({ appointmentId: receiptId, timezone, onClose: () => setReceiptId(""), onChanged: () => setChangedPayment((value) => value + 1) })}
  </div>;
}
