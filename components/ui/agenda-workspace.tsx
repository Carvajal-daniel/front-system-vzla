"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Plus, RotateCw, SlidersHorizontal, Users, Wallet, XCircle } from "lucide-react";
import { toast, Toaster } from "sonner";
import { agendaBoundary, agendaClock, agendaMonth, agendaRange, agendaViews, findAppointmentConflict, formatAgendaDay, isAppointmentPaid, isReadyToComplete, isUnpaidCompleted, localDayMinuteToUtcIso, overlapsScheduleBlock, shiftAgendaDay, shiftAgendaMonth, whatsAppReminder } from "@/lib/agenda";
import type { AgendaView } from "@/lib/agenda";
import { ApiError, apiRequest } from "@/lib/api-client";
import { agendaBookingSignal } from "@/lib/agenda-sync";
import { formatDateTimeInTimezone, formatPriceFromCents, formatTimeInTimezone, getTodayIsoDateInTimezone } from "@/lib/format";
import { agendaStrings } from "@/lib/i18n/agenda";
import { useLocale } from "@/lib/i18n/locale-context";
import { useTheme } from "@/lib/theme-context";
import type { Appointment, AppointmentStatus, CreateAppointmentPayload, ScheduleBlock, UpdatableAppointmentStatus } from "@/lib/types/appointment";
import type { MeResponse } from "@/lib/types/auth";
import type { FinanceSummaryResponse } from "@/lib/types/finance";
import type { PublicAvailabilityResponse } from "@/lib/types/public-booking";
import type { Service } from "@/lib/types/service";
import type { Collaborator, CollaboratorsListResponse, WorkScheduleSlot } from "@/lib/types/team";
import { getCanonicalClientId, useClients } from "@/lib/use-clients";
import { useWaitlist, waitlistCandidates, type WaitlistEntry } from "@/lib/use-waitlist";
import { AgendaAppointmentDetails, AgendaCard, WhatsAppLink } from "./agenda-card";
import type { AgendaItemProps, AgendaPayment } from "./agenda-card";
import { useCompanySettings } from "@/lib/use-company-settings";
import { AgendaMonthGrid, agendaRangeLabel, AgendaTimeGrid } from "./agenda-calendar";
import { AgendaDialog, AgendaProfessionalFilter, AgendaSelect } from "./agenda-controls";
import type { AgendaPerson } from "./agenda-controls";
import { AgendaEditor, type AgendaEditorTab } from "./agenda-editor";
import { PaidBadge } from "./agenda-status";

type StatusFilter = "" | AppointmentStatus | "CANCELED_OR_ABSENT";
type AlertFilter = "readyToComplete" | "unpaidCompleted";
type AlertType = "PENDING" | AlertFilter;
type Filter = StatusFilter | AlertFilter;
type EditorTarget =
  | Appointment
  | {
      mode: "new";
      date?: string;
      time?: string;
      endTime?: string;
      personId?: string;
      initialTab?: AgendaEditorTab;
      initialClientName?: string;
      initialClientPhone?: string;
      initialServiceId?: string;
      fromWaitlistId?: string;
    }
  | "new"
  | null;
const statuses: AppointmentStatus[] = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"];
const emptyAppointments: Appointment[] = [];
const emptyBlocks: ScheduleBlock[] = [];
const metricIcons = [CalendarDays, CheckCircle2, Clock3, XCircle];
const metricIconTones = [
  "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "bg-rose-500/10 text-rose-700 dark:text-rose-400",
];
const control = "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-2.5 text-xs font-semibold text-ink-secondary hover:border-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";
const alertColors: Record<AlertType, string> = {
  PENDING: "border-amber-500/40 bg-amber-500/12 text-amber-800 dark:text-amber-300",
  readyToComplete: "border-sky-500/40 bg-sky-500/12 text-sky-800 dark:text-sky-300",
  unpaidCompleted: "border-orange-500/40 bg-orange-500/12 text-orange-800 dark:text-orange-300",
};

function useAgendaRange<T extends { id: string }>(
  path: string, from: string, to: string, timezone: string, refresh: number, empty: T[],
  enabled = true, syncKey?: string, onSyncedRows?: (rows: T[], previousIds?: ReadonlyMap<string, string>) => void,
) {
  const key = `${path}/${from}/${to}/${timezone}/${refresh}/${syncKey ?? ""}`;
  const [result, setResult] = useState<{ key: string; rows?: T[]; error?: boolean }>({ key: "" });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let snapshot: Map<string, string> | undefined;
    let inFlight = false;
    let revalidateAfterRequest = false;
    let lastSignal: string | undefined;

    async function load(background = false) {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      try {
        const response = await apiRequest<T[] | { appointments?: T[]; blocks?: T[]; items?: T[] }>(path, {
          query: { from: agendaBoundary(from, timezone), to: agendaBoundary(to, timezone) },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const rows = Array.isArray(response) ? response
          : Array.isArray(response?.appointments) ? response.appointments
          : Array.isArray(response?.blocks) ? response.blocks
          : Array.isArray(response?.items) ? response.items : [];
        const next = new Map(rows.map((row) => [row.id, JSON.stringify(row)]));
        if (!snapshot || snapshot.size !== next.size || [...next].some(([id, value]) => snapshot?.get(id) !== value)) {
          onSyncedRows?.(rows, snapshot);
          snapshot = next;
          setResult({ key, rows });
        }
      } catch {
        if (!controller.signal.aborted && !background) setResult({ key, error: true });
      } finally {
        inFlight = false;
        if (revalidateAfterRequest) {
          revalidateAfterRequest = false;
          void load(true);
        }
      }
    }

    void load();
    if (!syncKey) return () => controller.abort();

    function revalidate() {
      if (inFlight) revalidateAfterRequest = true;
      else void load(true);
    }
    function onVisibilityChange() {
      if (!document.hidden) revalidate();
    }
    function onBookingSignal(id: unknown) {
      if (typeof id !== "string" || !id || id === lastSignal) return;
      lastSignal = id;
      revalidate();
    }
    function onStorage(event: StorageEvent) {
      if (event.key === syncKey) onBookingSignal(event.newValue);
    }
    let channel: BroadcastChannel | undefined;
    try {
      if (typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(syncKey);
    } catch {
      // Storage events and polling remain available.
    }
    if (channel) channel.onmessage = (event) => onBookingSignal(event.data);
    const timer = window.setInterval(() => void load(true), 10_000);
    window.addEventListener("focus", revalidate);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      controller.abort();
      channel?.close();
      window.clearInterval(timer);
      window.removeEventListener("focus", revalidate);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, from, key, onSyncedRows, path, syncKey, timezone, to]);
  return {
    rows: enabled && result.key === key ? result.rows ?? empty : empty,
    loading: enabled && result.key !== key,
    error: enabled && result.key === key && result.error,
  };
}

async function getPaymentSummaries(ids: string[], signal: AbortSignal) {
  if (!ids.length) return new Map<string, AgendaPayment>();
  const batches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) => ids.slice(index * 100, (index + 1) * 100).join(","));
  const rows = await Promise.all(batches.map((batch) => apiRequest<AgendaPayment[]>("/finance/appointments/payment-summary", {
    query: { ids: batch }, signal,
  }).then((res) => (Array.isArray(res) ? res : []))));
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
        return apiRequest<Appointment[] | { appointments?: Appointment[] }>(path, { query: { status }, signal })
          .then((res) => (Array.isArray(res) ? res : Array.isArray(res?.appointments) ? res.appointments : []));
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
  const { mode } = useTheme();
  const copy = agendaStrings(locale);
  const searchParams = useSearchParams();
  const targetId = searchParams.get("appointmentId");
  const actionParam = searchParams.get("action");
  const { company } = session;
  const timezone = company?.timezone || "America/Sao_Paulo";
  const isOwner = session.role === "OWNER";
  // Carrega as configurações privadas (incluindo o modelo de lembretes) quando o usuário é OWNER sem gerar 403 para colaboradores.
  const { settings } = useCompanySettings(company?.id ?? "", undefined, !!company, isOwner);
  const currency = company?.currency ?? "BRL";
  const bookingAppUrl = company?.id
    ? (typeof window === "undefined" ? `/book/${company.id}` : new URL(`/book/${company.id}`, window.location.origin).href)
    : undefined;
  const canManagePayments = isOwner && !!renderReceipt;
  const clock = useMemo(() => agendaClock(timezone), [timezone]);
  const [initialToday] = useState(() => getTodayIsoDateInTimezone(timezone));
  const [focus, setFocus] = useState(initialToday);
  const [miniMonth, setMiniMonth] = useState(initialToday);
  const [view, setView] = useState<AgendaView>("day");
  const [selectedPersonIds, setSelectedPersonIds] = useState<ReadonlySet<string> | null>(null);
  const [status, setStatus] = useState<Filter>("");
  const [highlightedId, setHighlightedId] = useState("");
  const [agendaFiltersOpen, setAgendaFiltersOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [changedPayment, setChangedPayment] = useState(0);
  const [opened, setOpened] = useState<Appointment | null>(null);
  const [openedFromAlert, setOpenedFromAlert] = useState(false);
  const [canceling, setCanceling] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [editor, setEditor] = useState<EditorTarget>(null);
  const waitlist = useWaitlist(company.id);
  const [vacancies, setVacancies] = useState<Appointment[]>([]);
  const [offer, setOffer] = useState<{ vacancy: Appointment; entry: WaitlistEntry; serviceName: string } | null>(null);
  const [offerError, setOfferError] = useState("");
  const [offerRetry, setOfferRetry] = useState(0);
  const [placingWaitlist, setPlacingWaitlist] = useState(false);
  const placementPending = useRef(false);
  const seenCancellations = useRef(new Set<string>());
  const [watchStartedAt] = useState(Date.now);
  const seenBookings = useRef(new Set<string>());
  const onSyncedAppointments = useCallback((rows: Appointment[], previousIds?: ReadonlyMap<string, string>) => {
    let received = false;
    for (const row of rows) {
      if (seenBookings.current.has(row.id)) continue;
      seenBookings.current.add(row.id);
      if (previousIds ? !previousIds.has(row.id) : Date.parse(row.createdAt) >= watchStartedAt) received = true;
    }
    if (received) toast.info(copy.newBookingReceived);
  }, [copy.newBookingReceived, watchStartedAt]);
  const vacancy = vacancies[0];
  // Carrega a base de clientes uma única vez no workspace para identificar primeira visita e cadastro automático
  const {
    clients: clientRecords,
    createClient,
    hasRegisteredClient,
  } = useClients(isOwner ? company.id : "");
  const [missingPhoneConfirm, setMissingPhoneConfirm] = useState<{
    appointment: Appointment;
    phone: string;
    error: string;
  } | null>(null);
  const firstVisitClientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const client of clientRecords) {
      if (client.totalVisits === 0) ids.add(client.id);
    }
    return ids;
  }, [clientRecords]);
  const [waitlistDrawerOpen, setWaitlistDrawerOpen] = useState(false);
  const [pendingReschedule, setPendingReschedule] = useState<{
    appointment: Appointment;
    targetPersonId: string;
    targetStartsAt: string;
    targetEndsAt: string;
  } | null>(null);
  const [receiptId, setReceiptId] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [catalog, setCatalog] = useState<{ people: Collaborator[]; services: Service[]; error: boolean }>({ people: [], services: [], error: false });

  const registerVacancy = useCallback((row: Appointment) => {
    const key = `${row.id}/${row.updatedAt}`;
    if (row.status !== "CANCELED" || Date.parse(row.startsAt) <= Date.now() || seenCancellations.current.has(key)) return false;
    seenCancellations.current.add(key);
    setVacancies((current) => [...current, row]);
    return true;
  }, []);

  const hasWaitlist = waitlist.count > 0;
  useEffect(() => {
    if (!isOwner || !hasWaitlist) return;
    let activeRequest: AbortController | undefined;
    function checkCancellations() {
      if (activeRequest || document.hidden) return;
      const request = new AbortController();
      activeRequest = request;
      void apiRequest<Appointment[]>("/appointments", {
        query: { status: "CANCELED", from: new Date().toISOString() },
        signal: request.signal,
      }).then((rows) => {
        if (request.signal.aborted) return;
        let changed = false;
        const recent = rows.filter((row) => Date.parse(row.updatedAt) >= watchStartedAt)
          .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
        for (const row of recent) if (registerVacancy(row)) changed = true;
        if (changed) setRefresh((current) => current + 1);
      }).catch(() => {
        // The next poll or focus event retries the read.
      }).finally(() => { activeRequest = undefined; });
    }
    checkCancellations();
    const timer = window.setInterval(checkCancellations, 15_000);
    window.addEventListener("focus", checkCancellations);
    document.addEventListener("visibilitychange", checkCancellations);
    return () => {
      activeRequest?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", checkCancellations);
      document.removeEventListener("visibilitychange", checkCancellations);
    };
  }, [company.id, hasWaitlist, isOwner, registerVacancy, watchStartedAt]);

  useEffect(() => {
    if (!vacancy || offer?.vacancy === vacancy && waitlist.entries.some((entry) => entry.id === offer.entry.id)) return;
    const candidates = waitlistCandidates(waitlist.entries, vacancy, timezone);
    const request = new AbortController();
    const startsAt = Date.parse(vacancy.startsAt);
    const endsAt = Date.parse(vacancy.endsAt);
    const date = clock(startsAt).date;

    async function findOffer(opening: Appointment) {
      const availability = new Map<string, boolean>();
      for (const entry of candidates) {
        const clientId = getCanonicalClientId(entry.clientPhone, entry.clientName);
        if (clientRecords.some((client) => client.id === clientId && client.isBlocked)) continue;
        if (!availability.has(entry.serviceId)) {
          try {
            const result = await apiRequest<PublicAvailabilityResponse>("/appointments/availability", {
              query: { serviceId: entry.serviceId, collaboratorId: opening.collaboratorId, date },
              signal: request.signal,
            });
            availability.set(entry.serviceId, result.slots.some((slot) =>
              Date.parse(slot.startsAt) === startsAt && Date.parse(slot.endsAt) <= endsAt,
            ));
          } catch (error) {
            if (!(error instanceof ApiError) || ![400, 403, 404, 409, 422].includes(error.status)) throw error;
            availability.set(entry.serviceId, false);
          }
        }
        if (request.signal.aborted) return;
        if (availability.get(entry.serviceId)) {
          const serviceName = catalog.services.find((service) => service.id === entry.serviceId)?.name
            || entry.serviceName || (opening.serviceId === entry.serviceId ? opening.serviceNameSnapshot : "Serviço");
          setOfferError("");
          setOffer({ vacancy: opening, entry, serviceName });
          return;
        }
      }
      if (!request.signal.aborted) {
        setOfferError("");
        setVacancies((current) => current.filter((row) => row !== opening));
      }
    }
    void findOffer(vacancy).catch(() => {
      if (!request.signal.aborted) setOfferError("Não foi possível verificar a disponibilidade da fila de espera.");
    });
    return () => request.abort();
  }, [catalog.services, clientRecords, clock, offer, offerRetry, timezone, vacancy, waitlist.entries]);

  useEffect(() => {
    if (actionParam === "new-appointment") {
      setEditor({ mode: "new", initialTab: "appointment" });
    } else if (actionParam === "new-block") {
      setEditor({ mode: "new", initialTab: "block" });
    }
  }, [actionParam]);

  const range = useMemo(() => agendaRange(view, focus), [focus, view]);
  const month = useMemo(() => agendaMonth(miniMonth), [miniMonth]);
  const path = isOwner ? "/appointments" : "/me/appointments";
  const bookingSignal = agendaBookingSignal(company.id);
  const sameMonthRange = month.from === range.from && month.to === range.to;
  const main = useAgendaRange(path, range.from, range.to, timezone, refresh, emptyAppointments, true, bookingSignal, onSyncedAppointments);
  const mini = useAgendaRange(path, month.from, month.to, timezone, refresh, emptyAppointments, !sameMonthRange, bookingSignal, onSyncedAppointments);
  const openedAppointment = opened && (main.rows.find((row) => row.id === opened.id) ?? opened);
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
      apiRequest<CollaboratorsListResponse | Collaborator[]>("/collaborators", { signal: ctl.signal }),
      apiRequest<{ services?: Service[] } | Service[]>("/services", { signal: ctl.signal }),
    ]).then(async ([staff, services]) => {
      if (ctl.signal.aborted) return;
      const people = Array.isArray(staff)
        ? staff
        : Array.isArray(staff?.collaborators)
          ? staff.collaborators
          : [];
      const serviceList = Array.isArray(services)
        ? services
        : Array.isArray(services?.services)
          ? services.services
          : [];
      setCatalog({ people, services: serviceList, error: false });
      // Older collaborator responses omit avatarUrl from their serialized schema.
      if (people.some((person) => person.avatarUrl === undefined)) {
        const profiles = await apiRequest<Pick<FinanceSummaryResponse, "byCollaborator">>("/finance/summary", {
          query: { from: initialToday, to: initialToday }, signal: ctl.signal,
        }).catch(() => null);
        if (!Array.isArray(profiles?.byCollaborator) || ctl.signal.aborted) return;
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
      setFocus(date); setMiniMonth(date); setOpened(row); setSelectedPersonIds(null); setStatus("");
    }).catch((error) => { if (!ctl.signal.aborted) setActionError(error instanceof ApiError && error.status === 404 ? copy.empty : t.errors.networkDescription); });
    return () => ctl.abort();
  }, [clock, copy.empty, targetId, t.errors.networkDescription]);

  const staff = useMemo(() => new Map<string, AgendaPerson>((isOwner ? catalog.people : [session]).map((person) => [person.id, person])), [isOwner, catalog.people, session]);
  const activePeople = useMemo(() => isOwner ? catalog.people.filter((person) => person.isActive) : [session], [isOwner, catalog.people, session]);
  const selectedPeople = useMemo(() => selectedPersonIds === null ? activePeople : activePeople.filter(({ id }) => selectedPersonIds.has(id)),
    [activePeople, selectedPersonIds]);
  const showTimeGrid = view === "day" || view === "week";
  const [workSchedules, setWorkSchedules] = useState<{ people: AgendaPerson[]; slots: WorkScheduleSlot[] }>();
  useEffect(() => {
    if (!showTimeGrid) return;
    const controller = new AbortController();
    const paths = isOwner
      ? selectedPeople.map(({ id }) => `/collaborators/${encodeURIComponent(id)}/work-schedules`)
      : ["/me/work-schedules"];
    void Promise.all(paths.map((path) =>
      apiRequest<{ schedules: WorkScheduleSlot[] } | WorkScheduleSlot[]>(path, { signal: controller.signal })
        .then((response) => Array.isArray(response) ? response : response.schedules ?? [])
        .catch(() => []),
    )).then((schedules) => {
      if (!controller.signal.aborted) setWorkSchedules({ people: selectedPeople, slots: schedules.flat() });
    });
    return () => controller.abort();
  }, [isOwner, selectedPeople, showTimeGrid, refresh]);
  const filteredPersonIds = useMemo(() => selectedPersonIds === null ? null : new Set(selectedPeople.map(({ id }) => id)), [selectedPeople, selectedPersonIds]);
  const gridPersonId = selectedPeople.length === 1 ? selectedPeople[0].id : undefined;
  const blocks = useMemo(() => schedule.rows.filter((block) => !filteredPersonIds || !block.collaboratorId || filteredPersonIds.has(block.collaboratorId)),
    [filteredPersonIds, schedule.rows]);
  const periodRows = useMemo(() => main.rows.filter((row) => !filteredPersonIds || filteredPersonIds.has(row.collaboratorId)), [main.rows, filteredPersonIds]);
  const metricRows = view === "month" ? periodRows.filter((row) => clock(row.startsAt).date.slice(0, 7) === focus.slice(0, 7)) : periodRows;
  const miniCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const all = new Map<string, Appointment>();
    for (const row of mini.rows) if (row?.id) all.set(row.id, row);
    for (const row of main.rows) if (row?.id) all.set(row.id, row);
    for (const row of all.values()) {
      if (filteredPersonIds && !filteredPersonIds.has(row.collaboratorId)) continue;
      if (!row.startsAt || Number.isNaN(Date.parse(row.startsAt))) continue;
      const day = clock(row.startsAt).date;
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return counts;
  }, [mini.rows, main.rows, filteredPersonIds, clock]);
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
  const displayedPayments = visiblePayments ?? (pay.key.endsWith(`/${changedPayment}/${refresh}`) ? pay.rows : undefined);
  const paymentLoading = pay.key !== paymentKey && !displayedPayments && periodRows.some((row) => row.status === "COMPLETED");
  const readyToComplete = useMemo(() => global.confirmed.filter((row) => isReadyToComplete(row, now)), [global.confirmed, now]);
  const shown = useMemo(() => periodRows.filter((row) => {
    if (status === "readyToComplete") return isReadyToComplete(row, now);
    if (status === "unpaidCompleted") return isUnpaidCompleted(row, displayedPayments?.get(row.id));
    return filterStatus(row, status);
  }), [now, periodRows, status, displayedPayments]);
  const rowsByDay = useMemo(() => {
    const rows = new Map<string, Appointment[]>();
    for (const row of shown) {
      if (!row?.startsAt || Number.isNaN(Date.parse(row.startsAt))) continue;
      const date = clock(row.startsAt).date;
      const startDay = date < range.from ? range.from : date;
      let appointmentDays = [startDay];
      if (showTimeGrid && Number.isFinite(Date.parse(row.endsAt))) {
        const end = clock(row.endsAt);
        appointmentDays = range.days.filter((day) => day >= startDay && (day < end.date || (day === end.date && end.minute > 0)));
      }
      for (const day of appointmentDays) {
        const group = rows.get(day) ?? [];
        group.push(row);
        rows.set(day, group);
      }
    }
    return rows;
  }, [clock, shown, range.days, range.from, showTimeGrid]);
  const monthCounts = useMemo(() => new Map(Array.from(rowsByDay, ([day, rows]) => [day, rows.length])), [rowsByDay]);
  const alertItems: { filter: AlertType; rows: Appointment[]; countLabel: (count: number) => string; icon: typeof Clock3 }[] = [
    { filter: "PENDING", rows: global.pending, countLabel: copy.pendingConfirmationCount, icon: CalendarDays },
    { filter: "readyToComplete", rows: readyToComplete, countLabel: copy.readyToCompleteCount, icon: Clock3 },
    { filter: "unpaidCompleted", rows: global.unpaid, countLabel: copy.unpaidCompletedCount, icon: Wallet },
  ];

  const metrics: { filter: StatusFilter; label: string; count: number }[] = [
    { filter: "", label: isOwner ? "Total" : copy.total, count: metricRows.length },
    ...([ ["COMPLETED", copy.completed], ["PENDING", copy.pending], ["CANCELED_OR_ABSENT", copy.canceled] ] as const)
      .map(([filter, label]) => ({ filter, label, count: metricRows.filter((row) => filterStatus(row, filter)).length })),
  ];
  const expectedCommission = isOwner ? 0 : metricRows
    .filter((row) => row.status !== "CANCELED" && row.status !== "NO_SHOW")
    .reduce((total, row) => total + Math.round(row.servicePriceInCentsSnapshot * row.commissionPercentageSnapshot / 100), 0);

  function navigate(date: string) { setFocus(date); setMiniMonth(date); setHighlightedId(""); }
  function changeStatus(value: Filter) { setStatus(value); setHighlightedId(""); setOpenedFromAlert(false); }
  function openAlert(row: Appointment, filter: AlertType) {
    navigate(clock(row.startsAt).date);
    if (view === "month" || view === "list") setView("day");
    setSelectedPersonIds(null);
    setStatus(filter);
    setOpenedFromAlert(true);
    setHighlightedId(row.id);
    setActionError("");
    setOpened(row);
  }
  function closeOpenedDetails() {
    setOpened(null);
    setActionError("");
    if (openedFromAlert) {
      setStatus("");
      setOpenedFromAlert(false);
    }
  }

  // Restaura o filtro lateral para "Todos os status" quando não restarem pendências no alerta ativo
  useEffect(() => {
    if (status === "readyToComplete" && readyToComplete.length === 0) {
      setStatus("");
      setOpenedFromAlert(false);
    } else if (status === "unpaidCompleted" && global.unpaid.length === 0) {
      setStatus("");
      setOpenedFromAlert(false);
    } else if (openedFromAlert && status === "PENDING" && global.pending.length === 0) {
      setStatus("");
      setOpenedFromAlert(false);
    }
  }, [status, openedFromAlert, readyToComplete.length, global.unpaid.length, global.pending.length]);
  function changePeriod(direction: number) {
    navigate(view === "month" || view === "list" ? shiftAgendaMonth(focus, direction) : shiftAgendaDay(focus, direction * (view === "week" ? 7 : 1)));
  }

  function handleRescheduleDrop(appointment: Appointment, targetDate: string, targetMinute: number, targetPersonId: string) {
    const targetStartsAt = localDayMinuteToUtcIso(targetDate, targetMinute, timezone);
    const durationMs = appointment.serviceDurationMinutesSnapshot * 60_000;
    const targetEndsAt = new Date(Date.parse(targetStartsAt) + durationMs).toISOString();
    if (overlapsScheduleBlock(schedule.rows, Date.parse(targetStartsAt), Date.parse(targetEndsAt), targetPersonId)) return;
    setPendingReschedule({
      appointment,
      targetPersonId,
      targetStartsAt,
      targetEndsAt,
    });
  }

  async function confirmReschedule() {
    if (!pendingReschedule || busy) return;
    const { appointment, targetPersonId, targetStartsAt, targetEndsAt } = pendingReschedule;
    const start = Date.parse(targetStartsAt);
    const end = Date.parse(targetEndsAt);
    if (findAppointmentConflict(main.rows, { id: appointment.id, collaboratorId: targetPersonId }, start, end)) {
      setPendingReschedule(null);
      toast.warning(copy.professionalAlreadyBooked);
      return;
    }
    if (overlapsScheduleBlock(schedule.rows, start, end, targetPersonId)) {
      setPendingReschedule(null);
      toast.error(copy.blockedTime);
      return;
    }
    setBusy(appointment.id);
    setActionError("");
    try {
      await apiRequest<Appointment>(`/appointments/${appointment.id}/reschedule`, {
        method: "PATCH",
        body: { startsAt: targetStartsAt, ...(targetPersonId !== appointment.collaboratorId && { collaboratorId: targetPersonId }) },
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

  function handleEmptySlotSelect(date: string, minute: number, endMinute?: number, targetPersonId?: string) {
    if (!isOwner) return;
    setEditor({
      mode: "new",
      date,
      time: localDayMinuteToUtcIso(date, minute, timezone),
      endTime: endMinute === undefined ? undefined : localDayMinuteToUtcIso(date, endMinute, timezone),
      personId: targetPersonId,
    });
  }

  function dismissWaitlistOffer() {
    setOffer(null);
    setOfferError("");
    setVacancies((current) => current.slice(1));
  }

  async function confirmWaitlistPlacement() {
    if (!offer || offer.vacancy !== vacancy || placementPending.current) return;
    if (!waitlist.entries.some((entry) => entry.id === offer.entry.id)) return;
    placementPending.current = true;
    setPlacingWaitlist(true);
    setOfferError("");
    const { entry } = offer;
    const payload: CreateAppointmentPayload = {
      serviceId: entry.serviceId,
      collaboratorId: vacancy.collaboratorId,
      startsAt: vacancy.startsAt,
      clientName: entry.clientName,
      clientPhone: entry.clientPhone,
      notes: entry.notes,
      initialStatus: "CONFIRMED",
    };
    async function bookEntry() {
      if (!waitlist.hasEntry(entry.id)) return null;
      const row = await apiRequest<Appointment>("/appointments", { method: "POST", body: payload });
      waitlist.removeEntry(entry.id);
      return row;
    }
    try {
      const row = navigator.locks
        ? await navigator.locks.request(`waitlist-placement/${company.id}/${entry.id}`, bookEntry)
        : await bookEntry();
      dismissWaitlistOffer();
      if (!row) return;
      saved(row);
      const link = whatsAppReminder(row, locale, timezone, "placement", {
        companyName: company?.companyName,
        professionalName: staff.get(row.collaboratorId)?.name,
        reminders: settings.reminders,
        appUrl: bookingAppUrl,
      });
      toast.success("Encaixe confirmado!", link ? {
        duration: 15_000,
        action: { label: "Enviar WhatsApp", onClick: () => window.open(link, "_blank", "noopener,noreferrer") },
      } : undefined);
    } catch (failure) {
      setOfferError(failure instanceof ApiError && failure.status === 409
        ? "O horário já está ocupado. O cliente continua na fila de espera."
        : "Não foi possível confirmar o encaixe. O cliente continua na fila de espera.");
    } finally {
      placementPending.current = false;
      setPlacingWaitlist(false);
    }
  }

  function saved(row: Appointment) {
    seenBookings.current.add(row.id);
    setEditor(null);
    setActionError("");
    setRefresh((value) => value + 1);
    navigate(clock(row.startsAt).date);
    setSelectedPersonIds(null); setStatus("");
    setOpened(row);
  }

  function openPayments(appointmentId: string) {
    setOpened(null);
    if (openedFromAlert) {
      setStatus("");
      setOpenedFromAlert(false);
    }
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

  async function update(
    row: Appointment,
    next: UpdatableAppointmentStatus,
    reason?: string,
    overridePhone?: string,
  ) {
    if (busy) return;
    if (next === "COMPLETED" && Date.now() < Date.parse(row.startsAt)) return;

    const isConfirmingPending = isOwner && row.status === "PENDING" && next === "CONFIRMED";
    const effectivePhone = (overridePhone ?? row.clientPhone ?? "").trim();
    const effectivePhoneDigits = effectivePhone.replace(/\D/g, "");
    const clientAlreadyExists = isConfirmingPending
      ? hasRegisteredClient({
          phone: effectivePhone,
          name: row.clientName,
          excludeAppointmentId: row.id,
        })
      : true;

    // Se o agendamento pendente veio sem telefone e o cliente ainda não está cadastrado, solicita o número antes de concluir
    if (isConfirmingPending && !clientAlreadyExists && effectivePhoneDigits.length < 8) {
      setMissingPhoneConfirm({
        appointment: row,
        phone: row.clientPhone ?? "",
        error: "",
      });
      return;
    }

    setBusy(row.id);
    setActionError("");
    try {
      const updated = await apiRequest<Appointment>(`/appointments/${row.id}/status`, { method: "PATCH", body: { status: next, cancellationReason: reason } });
      setOpened((current) => current?.id === updated.id ? updated : current);
      if (openedFromAlert) {
        setStatus("");
        setOpenedFromAlert(false);
      }
      if (next === "CANCELED") {
        setCanceling(null);
        if (isOwner && hasWaitlist) registerVacancy(updated);
      }
      if (isConfirmingPending) setMissingPhoneConfirm(null);
      setRefresh((value) => value + 1);

      // Cadastra automaticamente o novo cliente na base ao confirmar um agendamento pendente
      if (isConfirmingPending && updated.status === "CONFIRMED" && !clientAlreadyExists && effectivePhoneDigits.length >= 8) {
        createClient({
          name: updated.clientName,
          phone: effectivePhone,
        });
        toast.success("Novo cliente cadastrado automaticamente na base");
      }

      if (updated.status === "COMPLETED") {
        if (canManagePayments) void offerPayment(updated);
        else toast.success(copy.completedSuccess);
      }
    } catch (error) {
      setActionError(error instanceof ApiError && error.message === "Cannot complete an appointment before it ends."
        ? copy.endHint(formatTimeInTimezone(row.endsAt, timezone, locale)) : t.errors.networkDescription);
    } finally { setBusy(""); }
  }

  function submitMissingPhoneConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!missingPhoneConfirm) return;
    const trimmedPhone = missingPhoneConfirm.phone.trim();
    const digits = trimmedPhone.replace(/\D/g, "");
    if (digits.length < 8) {
      setMissingPhoneConfirm((prev) =>
        prev ? { ...prev, error: "Informe um telefone válido com DDD para concluir o cadastro do cliente." } : null,
      );
      return;
    }
    void update(missingPhoneConfirm.appointment, "CONFIRMED", undefined, trimmedPhone);
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
      isOwner,
      companyName: company?.companyName, reminders: settings.reminders, bookingAppUrl,
      isFirstVisit: firstVisitClientIds.has(getCanonicalClientId(row.clientPhone, row.clientName)),
      ...(canManagePayments ? {
      payment: displayedPayments?.get(row.id),
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

  async function revertCompletedAppointment(
    row: Appointment,
    reason: string,
    ownerPassword: string,
  ): Promise<{ ok: true } | { ok: false; code: string }> {
    setBusy(row.id);
    setActionError("");
    try {
      const result = await apiRequest<{ appointment: Appointment }>(
        `/appointments/${encodeURIComponent(row.id)}/revert-completion`,
        {
          method: "POST",
          body: { reason, ownerPassword },
        },
      );
      setOpened(result.appointment);
      setRefresh((value) => value + 1);
      toast.success(
        locale === "es"
          ? "Atención revertida a Confirmado y registrada en auditoría."
          : "Atendimento revertido para Confirmado e registrado na auditoria.",
      );
      return { ok: true };
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "UNKNOWN_ERROR";
      return { ok: false, code: message };
    } finally {
      setBusy("");
    }
  }

  function renderEvent(row: Appointment, compact: boolean, showAlertActions = true) {
    const person = staff.get(row.collaboratorId);
    const start = formatTimeInTimezone(row.startsAt, timezone, locale);
    const end = formatTimeInTimezone(row.endsAt, timezone, locale);
    const payment = displayedPayments?.get(row.id);
    const paid = isAppointmentPaid(payment);
    const readyToComplete = showAlertActions && isReadyToComplete(row, now);
    const unpaidCompleted = showAlertActions && isUnpaidCompleted(row, payment);
    const description = [row.clientName, row.serviceNameSnapshot, `${start} – ${end}`, person?.name, t.status[row.status],
      unpaidCompleted ? copy.unpaidCompleted : paid ? copy.paid : null].filter(Boolean).join(" · ");
    const alertAction = readyToComplete ? {
      label: copy.endedComplete,
      icon: Clock3,
      run: () => void update(row, "COMPLETED"),
    } : unpaidCompleted ? {
      label: t.finance.registerReceipt,
      icon: Wallet,
      run: () => openPayments(row.id),
    } : showAlertActions && row.status === "PENDING" ? {
      label: t.common.actionConfirm,
      icon: CheckCircle2,
      run: () => void update(row, "CONFIRMED"),
    } : null;
    const ActionIcon = alertAction?.icon;
    return <div data-agenda-status={row.status} data-agenda-event data-agenda-highlighted={row.id === highlightedId || undefined}
      className={`relative flex size-full min-w-0 overflow-hidden rounded-md border-s-2 shadow-xs ${row.id === highlightedId ? "ring-2 ring-inset ring-[var(--appointment-accent)]" : ""}`}>
      <button type="button" onClick={() => { setActionError(""); setOpened(row); }}
        aria-label={`${copy.openDetails} · ${description}`}
        className={`flex min-w-0 flex-1 cursor-pointer flex-col items-start overflow-hidden px-2 text-left hover:bg-ink/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent group-active/agenda-drag:cursor-grabbing ${compact ? "justify-center" : "justify-start gap-px py-1"}`}>
        <span className="w-full shrink-0 truncate text-xs font-bold leading-4">{compact ? row.serviceNameSnapshot : row.clientName}</span>
        {!compact && <>
          <span className="w-full shrink-0 truncate text-[11px] leading-3.5">{row.serviceNameSnapshot}</span>
          <span className="flex w-full shrink-0 flex-wrap items-center gap-x-2 text-[10px] font-semibold leading-3.5">
            <span className="tabular-nums">{start}–{end}</span><span>{t.status[row.status]}</span>
            {paid && <PaidBadge compact label={copy.paid} />}
            {unpaidCompleted && <span className="text-[var(--status-warning-ink)]">{copy.unpaidCompletedShort}</span>}
          </span>
        </>}
      </button>
      {showAlertActions && (!compact || alertAction) && <div className="hidden shrink-0 flex-col items-center gap-0.5 border-s border-border-subtle px-0.5 py-0.5 @min-[5rem]:flex [&_a]:size-6 [&_svg]:size-3.5 [&:empty]:hidden">
        {!compact && <WhatsAppLink
          appointment={row}
          timezone={timezone}
          person={person}
          companyName={company?.companyName}
          reminders={settings.reminders}
          bookingAppUrl={bookingAppUrl}
        />}
        {alertAction && ActionIcon && <button type="button" data-agenda-quick-action
          disabled={!!busy} onClick={(event) => { event.stopPropagation(); alertAction.run(); }}
          title={alertAction.label} aria-label={`${alertAction.label} · ${row.clientName}`}
          className={`grid shrink-0 cursor-pointer place-items-center rounded-md border hover:brightness-95 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55 ${compact ? "size-5" : "size-6"} ${unpaidCompleted ? "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-ink)]" : "border-border-subtle bg-surface text-ink"}`}>
          <ActionIcon aria-hidden="true" />
        </button>}
      </div>}
    </div>;
  }

  const visibleDateLabel = agendaRangeLabel(focus, range.days, view === "list" || view === "month", locale);
  const refreshButton = <button type="button" aria-label={t.common.retry} onClick={() => setRefresh((value) => value + 1)} className={`${control} size-9 p-0`}><RotateCw size={15} className={main.loading ? "animate-spin" : ""} /></button>;
  const metricCards = (
    <section aria-label={copy.appointments} className={`grid grid-cols-2 gap-2 ${isOwner ? "" : "sm:gap-3 md:grid-cols-4"}`}>
      {metrics.map((metric, index) => {
        const active = status === metric.filter;
        const Icon = metricIcons[index];
        return <button key={metric.filter} type="button" aria-pressed={active} onClick={() => changeStatus(active ? "" : metric.filter)}
          className={`flex min-w-0 cursor-pointer border bg-surface text-left transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent ${isOwner ? "items-center gap-1.5 rounded-xl p-2" : "items-center gap-2 rounded-xl px-2.5 py-1.5 sm:gap-2.5 sm:px-3 sm:py-2"} ${active ? "border-accent/65" : "border-border-subtle"}`}>
          {!isOwner && <span className={`grid size-7 shrink-0 place-items-center rounded-lg ${metricIconTones[index]}`}><Icon size={15} aria-hidden="true" /></span>}
          <span className={isOwner ? "flex w-full min-w-0 flex-1 flex-col gap-1" : "min-w-0"}>
            <span className={`block text-[10px] font-medium leading-tight text-ink-secondary ${isOwner ? "wrap-anywhere" : "sm:text-xs"}`}>{metric.label}</span>
            <strong className={`block font-bold leading-tight text-ink tabular-nums ${isOwner ? "mt-auto wrap-anywhere text-xl" : "text-lg"}`}>{main.loading ? "—" : metric.count}</strong>
          </span>
        </button>;
      })}
    </section>
  );

  const sidebar = <>
    <div className="mx-auto w-full max-w-57 lg:max-w-none">
      <AgendaMonthGrid company={company} month={miniMonth} selected={focus} today={today} counts={miniCounts}
        onMonth={setMiniMonth} onSelect={(date) => { navigate(date); setAgendaFiltersOpen(false); if (view === "month") setView("day"); }} />
    </div>

    {/* 2. Widget de Fila de Espera na Sidebar Auxiliar */}
    <div className="space-y-1.5 rounded-xl border border-border-subtle bg-canvas/60 p-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className="size-4 text-accent" />
          <span className="text-xs font-semibold text-ink">{locale === "es" ? "Lista de espera" : "Fila de Espera"}</span>
        </div>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent tabular-nums">
          {waitlist.count}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
        <button
          type="button"
          onClick={() => { setAgendaFiltersOpen(false); setWaitlistDrawerOpen(true); }}
          className="cursor-pointer rounded-lg border border-border-subtle bg-surface px-2 py-1.5 text-[11px] font-medium text-ink hover:border-accent transition-colors truncate"
        >
          {locale === "es" ? "Ver lista" : "Ver fila"} ({waitlist.count})
        </button>
        <button
          type="button"
          onClick={() => { setAgendaFiltersOpen(false); setEditor({ mode: "new", initialTab: "waitlist" }); }}
          className="cursor-pointer rounded-lg bg-accent px-2 py-1.5 text-[11px] font-semibold text-accent-ink hover:bg-accent-hover transition-colors truncate"
        >
          {locale === "es" ? "+ Agregar" : "+ Adicionar"}
        </button>
      </div>
    </div>

    <div className={`min-w-0 space-y-2 border-t border-border-subtle pt-2 ${isOwner ? "sm:col-span-2 lg:col-span-1" : "sm:border-t-0 sm:pt-0 lg:border-t lg:pt-3"}`}>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-secondary">
        <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="size-1 shrink-0 rounded-full bg-emerald-500" />{copy.working}</span>
        <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="size-1 rounded-full bg-[var(--status-danger-ink)]/65" />{copy.closed}</span>
      </div>
      {isOwner && <AgendaProfessionalFilter people={activePeople} value={selectedPersonIds} onChange={setSelectedPersonIds} />}
      <AgendaSelect label={copy.status} placeholder={status === "CANCELED_OR_ABSENT" ? copy.canceled : undefined} value={status} onChange={(value) => changeStatus(value as Filter)} options={[
        { value: "", label: copy.allStatuses }, ...statuses.map((value) => ({ value, label: t.status[value] })),
        { value: "readyToComplete", label: copy.readyToComplete },
        ...(canManagePayments ? [{ value: "unpaidCompleted", label: copy.unpaidCompleted }] : []),
      ]} />
      {isOwner && metricCards}
    </div>
  </>;
  return <div data-slot="agenda-workspace" className={`min-w-0 [&_button:not(:disabled)]:cursor-pointer ${isOwner ? "flex h-full min-h-0 flex-col gap-3 overflow-hidden" : "space-y-4 sm:space-y-5"}`}>
    {!isOwner && <>
      <Toaster theme={mode} richColors position="bottom-right" />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold leading-tight tracking-tight text-ink sm:text-2xl">{t.collaborator.agendaTitle}</h2>
          <p className="mt-1 text-xs text-ink-secondary">{t.owner.commissions} <span className="font-semibold text-accent">{formatPriceFromCents(expectedCommission, locale, currency)}</span></p>
        </div>
        {refreshButton}
      </header>
      {metricCards}
    </>}

    {(actionError && !canceling && !opened || catalog.error || mini.error || schedule.error || global.appointmentsError) && <p role="alert" className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-sm text-[var(--status-danger-ink)]">{actionError || t.errors.networkDescription}</p>}
    <div className={`grid min-w-0 gap-3 ${isOwner
      ? "min-h-0 flex-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]"
      : "items-start lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)]"}`}>
      {/* Mantém a coluna lateral esquerda sempre visível em desktop com rolagem interna discreta para não gerar scroll na página inteira */}
      <aside className={`min-w-0 gap-3 self-start rounded-2xl border border-border-subtle bg-surface p-3 sm:grid-cols-[minmax(11rem,14rem)_1fr] lg:grid-cols-1 ${isOwner ? "hidden max-h-full overflow-y-auto overscroll-contain [scrollbar-width:thin] lg:grid" : "grid"}`} aria-label={copy.calendar}>
        {sidebar}
      </aside>

      <section className={`min-w-0 ${isOwner ? "flex min-h-0 flex-col gap-3" : "space-y-3"}`} aria-label={copy.appointments} aria-busy={main.loading || (status === "unpaidCompleted" && paymentLoading)}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-2xl border border-border-subtle bg-surface p-2.5 sm:p-3">
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
          {isOwner && <div className="flex flex-wrap items-center gap-2">
            {refreshButton}
            <button type="button" onClick={() => setAgendaFiltersOpen(true)} className={`${control} lg:hidden`}>
              <SlidersHorizontal size={15} aria-hidden="true" />Filtros
            </button>
            <button type="button" onClick={() => setEditor("new")} className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-accent-ink shadow-xs hover:bg-accent-hover sm:text-sm"><Plus size={16} />{t.owner.newAppointment}</button>
          </div>}
        </div>

        {(alertItems.some(({ rows }) => rows.length > 0) || global.paymentsError) &&
          <section aria-label={copy.alerts} className="flex shrink-0 flex-wrap gap-2 rounded-xl border border-border-subtle bg-surface p-2">
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
        {main.error ? <div className="rounded-xl border border-border-subtle bg-surface p-5 text-sm text-ink-secondary" role="alert">{t.errors.networkDescription}</div>
          : view === "list" ? <div className="min-h-0 space-y-4 overflow-auto overscroll-contain">
            {main.loading || (status === "unpaidCompleted" && paymentLoading) ? <p className="rounded-xl bg-surface p-4 text-sm text-ink-secondary" role="status">{t.common.loading}</p>
              : status === "unpaidCompleted" && paymentError ? null
              : !shown.length && <p className="rounded-xl border border-border-subtle bg-surface p-5 text-sm text-ink-secondary">{copy.empty}</p>}
            {Array.from(rowsByDay).map(([day, rows]) => <section key={day} className="space-y-2">
              <h4 className="text-sm font-semibold text-ink first-letter:uppercase">{formatAgendaDay(day, locale, { weekday: "long", day: "numeric", month: "long" })}</h4>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <AgendaCard key={row.id} {...itemProps(row)} onDetails={() => { setActionError(""); setOpened(row); }} />)}</div>
            </section>)}
          </div> : view === "month" ? <div className="min-h-0 overflow-auto overscroll-contain"><AgendaMonthGrid company={company} month={focus} selected={focus} today={today} counts={monthCounts}
            onSelect={(date) => { navigate(date); setView("day"); }} renderDay={(date) => {
              const rows = rowsByDay.get(date) ?? [];
              return <div className="mt-1 space-y-0.5">
                {rows.slice(0, 2).map((row) => <div key={row.id} className="h-5.5">{renderEvent(row, true, false)}</div>)}
                {rows.length > 2 && <button type="button" aria-label={`${rows.length} ${copy.appointments}`} className="cursor-pointer px-1 text-[10px] font-semibold text-accent hover:underline" onClick={() => { navigate(date); setView("day"); }}>+{rows.length - 2}</button>}
              </div>;
            }} /></div> : view === "day" && !selectedPeople.length ? (
              <p className="rounded-xl border border-border-subtle bg-surface p-5 text-sm text-ink-secondary" role="status">
                {activePeople.length ? copy.noSelectedProfessionals : copy.noActiveProfessionals}
              </p>
            ) : <AgendaTimeGrid days={range.days} dayPeople={view === "day" ? selectedPeople : undefined} company={company} selected={focus} today={today} now={now} byDay={rowsByDay} slotInterval={settings.agendaInterval}
              workSchedules={workSchedules?.people === selectedPeople ? workSchedules.slots : []}
              appointments={main.rows} blocks={blocks} blocksReady={!schedule.loading && !schedule.error && !main.loading && !main.error} staff={staff}
              payments={displayedPayments} firstVisitClientIds={firstVisitClientIds}
              isOwner={isOwner} onSelect={(date) => { navigate(date); setView("day"); }} renderBlock={(row, compact) => renderEvent(row, compact)}
              onRescheduleDrop={handleRescheduleDrop} onRescheduleConflict={() => toast.warning(copy.professionalAlreadyBooked)}
              collaboratorId={gridPersonId} onEmptySlotSelect={handleEmptySlotSelect} />}
      </section>
    </div>

    {agendaFiltersOpen && <AgendaDialog title={locale === "es" ? "Calendario y filtros" : "Calendário e filtros"} onClose={() => setAgendaFiltersOpen(false)}>
      <div className="grid gap-3">{sidebar}</div>
    </AgendaDialog>}
    {openedAppointment && (
      <AgendaAppointmentDetails
        {...itemProps(openedAppointment)}
        error={actionError}
        onClose={closeOpenedDetails}
        {...(isOwner
          ? {
              // Verifica estritamente na base oficial de clientes (supplements), ignorando agendamentos públicos não salvos
              isRegisteredClient: hasRegisteredClient({
                phone: openedAppointment.clientPhone,
                name: openedAppointment.clientName,
                onlySupplements: true,
              }),
              onRegisterNewClient: (data) => {
                createClient(data);
                toast.success("Cliente cadastrado com sucesso!");
              },
              onRevertCompleted: (reason, ownerPassword) =>
                revertCompletedAppointment(openedAppointment, reason, ownerPassword),
            }
          : {})}
      />
    )}
    {editor && <AgendaEditor
      key={typeof editor === "object" && !("mode" in editor) ? editor.id : "new"}
      company={company}
      today={today}
      focusDate={typeof editor === "object" && !("mode" in editor) ? clock(editor.startsAt).date : typeof editor === "object" && "mode" in editor && editor.date ? editor.date : focus}
      initialDate={typeof editor === "object" && "mode" in editor ? editor.date : undefined}
      initialTime={typeof editor === "object" && "mode" in editor ? editor.time : undefined}
      initialEndTime={typeof editor === "object" && "mode" in editor ? editor.endTime : undefined}
      initialPersonId={typeof editor === "object" && "mode" in editor ? editor.personId : undefined}
      initialTab={typeof editor === "object" && "mode" in editor ? editor.initialTab : "appointment"}
      initialClientName={typeof editor === "object" && "mode" in editor ? editor.initialClientName : undefined}
      initialClientPhone={typeof editor === "object" && "mode" in editor ? editor.initialClientPhone : undefined}
      initialServiceId={typeof editor === "object" && "mode" in editor ? editor.initialServiceId : undefined}
      appointment={typeof editor === "object" && !("mode" in editor) ? editor : undefined}
      collaborators={catalog.people}
      services={catalog.services}
      onClose={() => setEditor(null)}
      onSaved={(row) => {
        if (typeof editor === "object" && "mode" in editor && editor.fromWaitlistId) {
          waitlist.removeEntry(editor.fromWaitlistId);
        }
        saved(row);
      }}
      onBlockSaved={() => {
        setRefresh((v) => v + 1);
      }}
    />}
    {vacancy && !editor && !opened && !canceling && !waitlistDrawerOpen && !pendingReschedule && !missingPhoneConfirm && !receiptId &&
      (offer?.vacancy === vacancy || offerError) && (
        <AgendaDialog centered title="Encaixe Automático da Fila de Espera" closeDisabled={placingWaitlist} onClose={dismissWaitlistOffer}>
          <div className="space-y-4">
            <div className="rounded-xl border border-border-subtle bg-subtle/40 p-3 text-sm">
              <p className="font-semibold text-ink">Horário liberado</p>
              <p className="text-ink-secondary">
                {formatDateTimeInTimezone(vacancy.startsAt, timezone, locale)}–{formatTimeInTimezone(vacancy.endsAt, timezone, locale)}
              </p>
              {staff.get(vacancy.collaboratorId)?.name && <p className="text-ink-secondary">{staff.get(vacancy.collaboratorId)?.name}</p>}
            </div>
            {offer?.vacancy === vacancy && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-ink-secondary">Cliente</dt><dd className="font-medium text-ink">{offer.entry.clientName}</dd>
                <dt className="text-ink-secondary">WhatsApp</dt><dd className="text-ink">{offer.entry.clientPhone}</dd>
                <dt className="text-ink-secondary">Serviço desejado</dt><dd className="text-ink">{offer.serviceName}</dd>
              </dl>
            )}
            {offerError && <p role="alert" className="text-sm text-[var(--status-danger-ink)]">{offerError}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" disabled={placingWaitlist} onClick={dismissWaitlistOffer} className={control}>
                Manter Horário Livre
              </button>
              {offer?.vacancy === vacancy ? (
                <button type="button" disabled={placingWaitlist || !waitlist.entries.some((entry) => entry.id === offer.entry.id)}
                  onClick={() => void confirmWaitlistPlacement()}
                  className="min-h-9 cursor-pointer rounded-lg bg-accent px-3 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50">
                  {placingWaitlist ? "Confirmando…" : "Confirmar Encaixe Agora"}
                </button>
              ) : (
                <button type="button" className={control} onClick={() => { setOfferError(""); setOfferRetry((current) => current + 1); }}>
                  {t.common.retry}
                </button>
              )}
            </div>
          </div>
        </AgendaDialog>
      )}

    {waitlistDrawerOpen && (
      <AgendaDialog
        centered
        title={`Fila de Espera (${waitlist.count})`}
        onClose={() => setWaitlistDrawerOpen(false)}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <p className="text-xs text-ink-muted">
              Clientes aguardando liberação de horários
            </p>
            <button
              type="button"
              onClick={() => {
                setWaitlistDrawerOpen(false);
                setEditor({ mode: "new", initialTab: "waitlist" });
              }}
              className="rounded-lg bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors"
            >
              + Adicionar Cliente
            </button>
          </div>

          {waitlist.entries.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-muted border border-dashed border-border-subtle rounded-xl">
              Nenhum cliente na fila de espera no momento.
            </div>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {waitlist.entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-border-subtle bg-canvas/40 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-ink">{entry.clientName}</p>
                      <p className="font-mono text-xs text-ink-muted">{entry.clientPhone}</p>
                    </div>
                    <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                      {entry.serviceName || "Serviço"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
                    <span>Profissional: {entry.collaboratorName || "Qualquer"}</span>
                    <span>·</span>
                    <span>
                      {entry.preferredTiming === "SPECIFIC"
                        ? `Preferência: ${entry.preferredDate || ""} ${entry.preferredTime || ""}`
                        : "Horário flexível"}
                    </span>
                  </div>

                  {entry.notes && (
                    <p className="rounded-lg bg-subtle p-2 text-xs text-ink-secondary">
                      {entry.notes}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-border-subtle/50">
                    <button
                      type="button"
                      onClick={() => waitlist.removeEntry(entry.id)}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
                    >
                      Remover
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWaitlistDrawerOpen(false);
                        const preferredDate = entry.preferredDate;
                        const preferredTime = entry.preferredTime;
                        const [hours, minutes] = preferredTime?.split(":").map(Number) ?? [];
                        const hasPreferredSlot = preferredDate && Number.isFinite(Date.parse(preferredDate))
                          && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
                        setEditor({
                          mode: "new",
                          initialTab: "appointment",
                          initialClientName: entry.clientName,
                          initialClientPhone: entry.clientPhone,
                          initialServiceId: entry.serviceId,
                          personId: entry.collaboratorId || undefined,
                          date: preferredDate || undefined,
                          time: hasPreferredSlot ? localDayMinuteToUtcIso(preferredDate, hours * 60 + minutes, timezone) : undefined,
                          fromWaitlistId: entry.id,
                        });
                      }}
                      className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors"
                    >
                      Agendar Agora
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </AgendaDialog>
    )}
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
                {pendingReschedule.targetPersonId !== pendingReschedule.appointment.collaboratorId && (
                  <p className="text-xs text-ink-secondary">{staff.get(pendingReschedule.appointment.collaboratorId)?.name}</p>
                )}
              </div>
              <div>
                <span className="text-xs font-semibold text-accent">{copy.newSchedule}</span>
                <p className="text-xs font-semibold text-accent tabular-nums">
                  {formatDateTimeInTimezone(pendingReschedule.targetStartsAt, timezone, locale)} – {formatTimeInTimezone(pendingReschedule.targetEndsAt, timezone, locale)}
                </p>
                {pendingReschedule.targetPersonId !== pendingReschedule.appointment.collaboratorId && (
                  <p className="text-xs font-semibold text-accent">{staff.get(pendingReschedule.targetPersonId)?.name}</p>
                )}
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
    {missingPhoneConfirm && (
      <AgendaDialog
        centered
        title="Informar telefone do cliente"
        closeDisabled={!!busy}
        onClose={() => setMissingPhoneConfirm(null)}
      >
        <form onSubmit={submitMissingPhoneConfirm} className="space-y-4">
          <p className="text-sm text-ink-secondary">
            O agendamento de <strong className="text-ink">{missingPhoneConfirm.appointment.clientName}</strong> não possui telefone registrado. Informe o número para confirmar o agendamento e cadastrar o cliente na base.
          </p>
          <label className="block space-y-1.5 text-sm font-medium text-ink">
            <span>Telefone (WhatsApp)</span>
            <input
              type="tel"
              required
              autoFocus
              value={missingPhoneConfirm.phone}
              onChange={(event) =>
                setMissingPhoneConfirm((prev) =>
                  prev ? { ...prev, phone: event.target.value, error: "" } : null,
                )
              }
              placeholder="+55 11 99999-9999"
              className="block min-h-11 w-full rounded-xl border border-border-subtle bg-surface px-3.5 text-sm text-ink outline-none focus-visible:border-accent"
            />
          </label>
          {missingPhoneConfirm.error && (
            <p role="alert" className="text-xs text-[var(--status-danger-ink)]">
              {missingPhoneConfirm.error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => setMissingPhoneConfirm(null)}
              className="min-h-10 cursor-pointer rounded-xl border border-border-subtle bg-surface px-4 text-sm font-semibold text-ink hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-55"
            >
              {copy.cancel}
            </button>
            <button
              type="submit"
              disabled={!!busy}
              className="min-h-10 cursor-pointer rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-55"
            >
              Confirmar e cadastrar
            </button>
          </div>
        </form>
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
