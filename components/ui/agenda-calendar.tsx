"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, LockKeyhole, Plus, TriangleAlert } from "lucide-react";
import {
  agendaClock,
  agendaMonth,
  companyDay,
  findAppointmentConflict,
  formatAgendaDay,
  localDayMinuteToUtcIso,
  overlapsScheduleBlock,
  shiftAgendaDay,
  shiftAgendaMonth,
} from "@/lib/agenda";
import { useLocale } from "@/lib/i18n/locale-context";
import { agendaStrings } from "@/lib/i18n/agenda";
import type { Company } from "@/lib/types/auth";
import { formatTimeInTimezone } from "@/lib/format";
import type { Appointment, ScheduleBlock } from "@/lib/types/appointment";
import type { WorkScheduleSlot } from "@/lib/types/team";
import { getCanonicalClientId } from "@/lib/use-clients";
import { AppointmentHoverCard } from "./agenda-card";
import type { AgendaPayment, HoverCardAnchor } from "./agenda-card";
import { ProfessionalAvatar, type AgendaPerson } from "./agenda-controls";

const arrow = "grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-secondary hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";
const closedSurface = "bg-[color-mix(in_srgb,var(--status-danger-bg)_60%,var(--surface-elevated))]";

function formatMinute(minute: number): string {
  const h = String(Math.floor(minute / 60)).padStart(2, "0");
  const m = String(minute % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function parseGridMinute(value?: string | null) {
  if (!value || !/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) return NaN;
  const hour = Number(value.slice(0, 2));
  const minute = Number(value.slice(3, 5));
  return minute < 60 && (hour < 24 || (hour === 24 && minute === 0)) ? hour * 60 + minute : NaN;
}

export function AgendaMonthGrid({ month, selected, today, company, counts, available, booking = false, onMonth, onSelect, renderDay }: {
  month: string;
  selected?: string;
  today: string;
  company: Company;
  counts?: ReadonlyMap<string, number>;
  available?: ReadonlySet<string>;
  booking?: boolean;
  onMonth?: (date: string) => void;
  onSelect: (date: string) => void;
  renderDay?: (date: string) => ReactNode;
}) {
  const { locale } = useLocale();
  const copy = agendaStrings(locale);
  const { start, end, days } = agendaMonth(month);
  const spacious = !!renderDay;
  const sidebar = !spacious && !booking;
  const monthLabel = formatAgendaDay(start, locale, { month: "long", year: "numeric" });

  return <section aria-label={`${copy.calendar} · ${monthLabel}`} className={spacious ? "overflow-hidden rounded-2xl border border-border-subtle bg-surface" : "min-w-0"}>
    {onMonth && <div className="mb-2 flex items-center justify-between gap-1">
      <h3 className={`min-w-0 font-semibold text-ink first-letter:uppercase ${sidebar ? "text-xs" : "text-sm"}`}>{monthLabel}</h3>
      <div className="flex shrink-0">
        <button type="button" className={arrow} aria-label={copy.previous} onClick={() => onMonth(shiftAgendaMonth(month, -1))}><ChevronLeft size={16} /></button>
        <button type="button" className={arrow} aria-label={copy.next} onClick={() => onMonth(shiftAgendaMonth(month, 1))}><ChevronRight size={16} /></button>
      </div>
    </div>}
    <div className={`grid grid-cols-7 ${spacious ? "border-b border-border-subtle bg-subtle/45" : "gap-px"}`}>
      {days.slice(0, 7).map((date) => <div key={date} className={`text-center text-[10px] font-semibold uppercase tracking-wide text-ink-muted sm:text-[11px] ${sidebar ? "py-1" : "py-2"}`}>
        {formatAgendaDay(date, locale, { weekday: "short" }).replace(/\.$/, "")}
      </div>)}
    </div>
    <div className={`grid grid-cols-7 ${spacious ? "gap-px bg-border-subtle" : "gap-px"}`}>
      {days.map((date) => {
        const { closed } = companyDay(company, date);
        const count = counts?.get(date) ?? 0;
        const hasSlot = !closed && (available?.has(date) ?? false);
        const outside = date < start || date >= end;
        const disabled = booking && (outside || closed || date < today || (available !== undefined && !hasSlot));
        const active = selected === date;
        const label = [formatAgendaDay(date, locale, { dateStyle: "full" }), closed && copy.closed,
          count > 0 && `${count} ${copy.appointments.toLowerCase()}`,
          booking && !closed && available !== undefined && (hasSlot ? copy.available : copy.unavailable)].filter(Boolean).join(" · ");
        const tone = sidebar
          ? active ? "bg-accent font-bold text-accent-ink"
            : date === today ? "bg-accent-soft text-accent"
            : outside ? "text-ink-muted" : "text-ink"
          : closed ? `bg-[var(--status-danger-bg)] font-semibold text-[var(--status-danger-ink)] ring-inset focus-visible:outline-[var(--status-danger-ink)] ${active ? "ring-2 ring-[var(--status-danger-ink)]" : "ring-1 ring-[var(--status-danger-border)]"}`
          : active ? "bg-accent text-accent-ink"
          : hasSlot || date === today ? "bg-accent-soft text-accent"
          : outside || disabled ? "text-ink-muted" : "text-ink";
        const button = <button key={date} type="button" disabled={disabled} aria-label={label} title={label} data-agenda-date={date} data-closed={closed || undefined}
          aria-pressed={active} aria-current={date === today ? "date" : undefined} onClick={() => onSelect(date)}
          className={`relative flex min-w-0 cursor-pointer items-center justify-center rounded-lg text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed ${sidebar ? "leading-none" : ""} ${closed && !sidebar ? "" : "focus-visible:outline-accent enabled:hover:ring-1 enabled:hover:ring-accent"} ${!closed && (!sidebar || !active) ? "font-medium" : ""} ${tone} ${spacious ? "size-7" : "aspect-square w-full"} ${outside && (sidebar ? !active : !closed) ? "opacity-55" : ""}`}>
          {Number(date.slice(-2))}
          {sidebar ? (
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[12%] flex justify-center gap-0.5">
              {count > 0 && <i className={`size-1 rounded-full ${active ? "bg-current" : "bg-emerald-500"}`} />}
              {closed && <i className={`size-1 rounded-full ${active ? "ring-1 ring-inset ring-current" : "bg-[var(--status-danger-ink)]/65"}`} />}
            </span>
          ) : count > 0 ? (
            <span
              aria-hidden="true"
              className={`absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-[#10B981] shadow-xs ${
                active && !closed ? "ring-1 ring-white dark:ring-neutral-950" : ""
              }`}
            />
          ) : hasSlot ? (
            <span aria-hidden="true" className={`absolute bottom-0.5 h-1.5 w-1.5 rounded-full ${active && !closed ? "bg-current" : "bg-accent"}`} />
          ) : null}
        </button>;
        return spacious ? <div key={date} className={`min-h-19 min-w-0 p-1.5 sm:min-h-29 sm:p-2 ${closed ? closedSurface : "bg-surface"}`}>
          <div className="flex items-center justify-between gap-1">
            {button}
            {count > 0 && <span className="rounded-full bg-emerald-500/15 px-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{count}</span>}
          </div>
          {renderDay(date)}
        </div> : button;
      })}
    </div>
  </section>;
}

function layoutDay(rows: (Appointment | ScheduleBlock)[], date: string, clock: ReturnType<typeof agendaClock>) {
  const groups: { row: Appointment | ScheduleBlock; start: number; end: number; lane: number }[][] = [];
  let ends: number[] = [];
  let groupEnd = -1;
  const safeRows = (Array.isArray(rows) ? rows : []).filter(
    (row) => row && typeof row.startsAt === "string" && typeof row.endsAt === "string" && !Number.isNaN(Date.parse(row.startsAt)) && !Number.isNaN(Date.parse(row.endsAt)),
  );
  for (const row of safeRows.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))) {
    const from = clock(row.startsAt);
    const to = clock(row.endsAt);
    const start = from.date < date ? 0 : from.minute;
    if (from.date > date || to.date < date || (to.date === date && to.minute === 0 && from.date < date)) continue;
    const end = to.date > date ? 1440 : Math.max(start + 1, to.minute);
    if (start >= groupEnd) {
      ends = [];
      groups.push([]);
      groupEnd = end;
    }
    let lane = ends.findIndex((occupiedUntil) => occupiedUntil <= start);
    if (lane < 0) lane = ends.length;
    ends[lane] = end;
    groupEnd = Math.max(end, groupEnd);
    groups.at(-1)!.push({ row, start, end, lane });
  }
  return groups.flatMap((group) => {
    const lanes = Math.max(...group.map(({ lane }) => lane)) + 1;
    return group.map((entry) => ({ ...entry, width: 100 / lanes }));
  });
}

interface DragState {
  appointment: Appointment;
  originDate: string;
  originMinute: number;
  targetDate: string;
  targetColumn: string;
  targetPersonId: string;
  targetMinute: number;
  duration: number;
  isInvalid: boolean;
  hasAppointmentConflict: boolean;
  invalidReason: string | null;
  pointerX: number;
  pointerY: number;
}

export function AgendaTimeGrid({
  days,
  dayPeople,
  selected,
  today,
  now,
  company,
  byDay,
  appointments,
  blocks,
  workSchedules,
  slotInterval = 30,
  staff,
  payments,
  firstVisitClientIds,
  blocksReady,
  isOwner = false,
  onSelect,
  renderBlock,
  onRescheduleDrop,
  onRescheduleConflict,
  collaboratorId,
  onEmptySlotSelect,
}: {
  days: string[];
  dayPeople?: AgendaPerson[];
  selected: string;
  today: string;
  now: number;
  company: Company;
  byDay: Map<string, Appointment[]>;
  appointments: readonly Appointment[];
  blocks: ScheduleBlock[];
  workSchedules: readonly WorkScheduleSlot[];
  slotInterval?: number;
  staff: ReadonlyMap<string, AgendaPerson>;
  payments?: ReadonlyMap<string, AgendaPayment>;
  firstVisitClientIds?: ReadonlySet<string>;
  blocksReady: boolean;
  isOwner?: boolean;
  onSelect: (date: string) => void;
  renderBlock: (appointment: Appointment, compact: boolean) => ReactNode;
  onRescheduleDrop?: (appointment: Appointment, targetDate: string, targetMinute: number, targetPersonId: string) => void;
  onRescheduleConflict: () => void;
  collaboratorId?: string;
  onEmptySlotSelect?: (date: string, startMinute: number, endMinute?: number, personId?: string) => void;
}) {
  const { locale } = useLocale();
  const copy = agendaStrings(locale);
  const viewportRef = useRef<HTMLDivElement>(null);
  const clock = useMemo(() => agendaClock(company.timezone), [company.timezone]);

  // Estados e referências de arraste (Drag & Drop) com tolerância de > 6px
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragTargetRef = useRef<DragState | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{ column: string; minute: number } | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<{ appointment: Appointment; anchor: HoverCardAnchor } | null>(null);
  const hasHoveredEvent = hoveredEvent !== null;
  useEffect(() => {
    if (!hasHoveredEvent) return;
    const clearHover = () => setHoveredEvent(null);
    window.addEventListener("scroll", clearHover);
    return () => window.removeEventListener("scroll", clearHover);
  }, [hasHoveredEvent]);
  const dragPendingRef = useRef<{
    appointment: Appointment;
    startX: number;
    startY: number;
    originDate: string;
    originMinute: number;
    duration: number;
  } | null>(null);
  const dragMovedRef = useRef(false);
  const selectionOrigin = useRef<{
    minute: number;
    pointerId: number;
    x: number;
    y: number;
    bounds?: { first: number; last: number; closes: number };
  } | null>(null);
  const [selection, setSelection] = useState<{ column: string; start: number; end: number } | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || days.length < 2) return;
    function revealDay() {
      const button = viewport?.querySelector(`button[data-agenda-date="${selected}"]`);
      if (!viewport || !button) return;
      const view = viewport.getBoundingClientRect();
      const day = button.getBoundingClientRect();
      const gutter = viewport.firstElementChild?.querySelector("[data-agenda-gutter]")?.getBoundingClientRect().width ?? 0;
      if (day.left < view.left + gutter || day.right > view.right) viewport.scrollLeft += day.left - view.left - gutter;
    }
    revealDay();
    const observer = new ResizeObserver(revealDay);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [days, selected]);

  const columnSpecs = dayPeople
    ? dayPeople.map((person) => ({ key: person.id, day: selected, person }))
    : days.map((day) => ({ key: day, day, person: undefined }));
  const columns = columnSpecs.map(({ key, day, person }) => {
    const dayAppointments = byDay.get(day) ?? [];
    const columnBlocks = Array.isArray(blocks) ? blocks : [];
    const rows = person
      ? [...dayAppointments.filter((row) => row.collaboratorId === person.id),
        ...columnBlocks.filter((row) => !row.collaboratorId || row.collaboratorId === person.id)]
      : [...dayAppointments, ...columnBlocks];
    return { key, day, person, personId: person?.id ?? collaboratorId, ...companyDay(company, day), events: layoutDay(rows, day, clock) };
  });
  const defaultHours = { start: 8 * 60, end: 19 * 60 };
  const intervals = columns.flatMap(({ closed, shifts, events }) => [
    ...events,
    ...(!closed ? shifts.length ? shifts.map(({ start, end }) => ({ start: parseGridMinute(start), end: parseGridMinute(end) })) : [defaultHours] : []),
  ]);
  for (const schedule of workSchedules) {
    const companyHours = company.operatingSchedule?.find((day) => day.dayOfWeek === schedule.dayOfWeek);
    if (!companyHours && schedule.isWorkingDay && days.some((day) => new Date(`${day}T00:00:00Z`).getUTCDay() === schedule.dayOfWeek && !companyDay(company, day).closed)) {
      intervals.push({ start: parseGridMinute(schedule.startTime), end: parseGridMinute(schedule.endTime) });
    }
  }
  let starts = 1440;
  let ends = 0;
  for (const { start, end } of intervals) {
    if (start < end) {
      starts = Math.min(starts, start);
      ends = Math.max(ends, end);
    }
  }
  if (starts >= ends) {
    ({ start: starts, end: ends } = defaultHours);
  }
  const pixelsPerMinute = 2;
  const height = (ends - starts) * pixelsPerMinute;
  const gridLines: number[] = [];
  for (let minute = Math.floor(starts / slotInterval) * slotInterval + slotInterval; minute < ends; minute += slotInterval) {
    gridLines.push(minute);
  }
  const hourLabels = [starts, ...Array.from({ length: 24 }, (_, hour) => hour * 60)
    .filter((minute) => minute - starts >= 15 && ends - minute >= 20)];
  const current = now ? clock(now) : null;
  const columnWidth = dayPeople ? "13.125rem" : "12rem";
  const gridStyle = { gridTemplateColumns: `3.25rem repeat(${columns.length}, minmax(${columnWidth}, 1fr))` };

  function dayRanges(day: string) {
    const { closed, shifts } = companyDay(company, day);
    if (closed) return [];
    return shifts.length ? shifts.map(({ start, end }) => ({
      start: parseGridMinute(start), end: parseGridMinute(end),
    })) : [{ start: starts, end: ends }];
  }

  function shiftAt(day: string, minute: number) {
    return dayRanges(day).find(({ start, end }) => minute >= start && minute < end);
  }

  // Handlers globais de ponteiro para cálculo de arrasto e soltura
  function handleEventPointerDown(e: React.PointerEvent, appointment: Appointment) {
    if (!isOwner || !blocksReady || e.button !== 0 || dragPendingRef.current) return;
    if ((e.target as Element).closest("[data-agenda-quick-action]")) return;
    if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") return;
    setHoveredSlot(null);
    setHoveredEvent(null);
    const pointerId = e.pointerId;

    const from = clock(appointment.startsAt);
    dragPendingRef.current = {
      appointment,
      startX: e.clientX,
      startY: e.clientY,
      originDate: from.date,
      originMinute: from.minute,
      duration: appointment.serviceDurationMinutesSnapshot,
    };
    dragMovedRef.current = false;

    function onPointerMove(moveEvent: PointerEvent) {
      if (moveEvent.pointerId !== pointerId || !dragPendingRef.current) return;
      const dist = Math.hypot(
        moveEvent.clientX - dragPendingRef.current.startX,
        moveEvent.clientY - dragPendingRef.current.startY,
      );

      // Limiar estrito: só ativa arrasto se mover mais de 6px
      if (!dragMovedRef.current && dist <= 6) return;
      dragMovedRef.current = true;
      document.body.style.userSelect = "none";

      const columnEls = viewportRef.current?.querySelectorAll<HTMLElement>("[data-agenda-column-day]");
      if (!columnEls || columnEls.length === 0) return;

      let targetEl: HTMLElement | null = null;
      for (const col of columnEls) {
        const rect = col.getBoundingClientRect();
        if (moveEvent.clientX >= rect.left && moveEvent.clientX <= rect.right) {
          targetEl = col;
          break;
        }
      }

      // Se saiu das colunas lateralmente, fixa na primeira ou na última
      if (!targetEl) {
        const first = columnEls[0];
        const last = columnEls[columnEls.length - 1];
        if (moveEvent.clientX < first.getBoundingClientRect().left) targetEl = first;
        else targetEl = last;
      }

      const targetDay = targetEl.getAttribute("data-agenda-column-day") ?? dragPendingRef.current.originDate;
      const targetColumn = targetEl.getAttribute("data-agenda-column-key") ?? targetDay;
      const targetPersonId = targetEl.getAttribute("data-agenda-column-person") ?? appointment.collaboratorId;
      const rect = targetEl.getBoundingClientRect();
      const relY = moveEvent.clientY - rect.top;
      const rawMinute = starts + (relY / pixelsPerMinute);

      let snappedMinute = Math.round(rawMinute / slotInterval) * slotInterval;
      const duration = dragPendingRef.current.duration;
      const ranges = dayRanges(targetDay);
      const firstSlot = Math.ceil((ranges[0]?.start ?? starts) / slotInterval) * slotInterval;
      const lastSlot = Math.floor(((ranges.at(-1)?.end ?? ends) - duration) / slotInterval) * slotInterval;
      snappedMinute = Math.max(firstSlot, Math.min(lastSlot, snappedMinute));
      const fitsShift = ranges.some(({ start, end }) => snappedMinute >= start && snappedMinute + duration <= end);
      const targetIso = localDayMinuteToUtcIso(targetDay, snappedMinute, company.timezone);
      const targetStart = Date.parse(targetIso);
      const targetEnd = targetStart + duration * 60_000;
      const isPast = targetStart <= Date.now();
      const isBlocked = overlapsScheduleBlock(blocks, targetStart, targetEnd, targetPersonId);
      const conflict = findAppointmentConflict(appointments, { id: appointment.id, collaboratorId: targetPersonId }, targetStart, targetEnd);
      const invalidReason = conflict ? copy.appointmentConflict(conflict.clientName)
        : !ranges.length ? copy.closedDay : isBlocked || !fitsShift ? copy.blockedTime : isPast ? copy.pastTime : null;

      const target = {
        appointment: dragPendingRef.current.appointment,
        originDate: dragPendingRef.current.originDate,
        originMinute: dragPendingRef.current.originMinute,
        targetDate: targetDay,
        targetColumn,
        targetPersonId,
        targetMinute: snappedMinute,
        duration,
        isInvalid: invalidReason !== null,
        hasAppointmentConflict: Boolean(conflict),
        invalidReason,
        pointerX: moveEvent.clientX,
        pointerY: moveEvent.clientY,
      };
      dragTargetRef.current = target;
      setDragState(target);
    }

    function endDrag(event: PointerEvent) {
      if (event.pointerId !== pointerId) return;
      if (event.type === "pointerup" && dragMovedRef.current) onPointerMove(event);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
      document.body.style.userSelect = "";

      const target = dragTargetRef.current;
      if (event.type === "pointerup" && target &&
        (target.targetDate !== target.originDate || target.targetMinute !== target.originMinute || target.targetPersonId !== target.appointment.collaboratorId)) {
        if (target.hasAppointmentConflict) onRescheduleConflict();
        else if (!target.isInvalid) onRescheduleDrop?.(target.appointment, target.targetDate, target.targetMinute, target.targetPersonId);
      }
      setDragState(null);
      dragTargetRef.current = null;
      dragPendingRef.current = null;
      setTimeout(() => {
        dragMovedRef.current = false;
      }, 50);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  }

  function availableSlot(day: string, minute: number, personId?: string, minimumStart = now) {
    const closes = shiftAt(day, minute)?.end;
    if (closes === undefined) return false;
    const start = Date.parse(localDayMinuteToUtcIso(day, minute, company.timezone));
    const end = Date.parse(localDayMinuteToUtcIso(day, Math.min(minute + slotInterval, closes), company.timezone));
    return start > minimumStart
      && !overlapsScheduleBlock(blocks, start, end, personId)
      && !appointments.some((row) =>
        (!personId || row.collaboratorId === personId)
        && (row.status === "PENDING" || row.status === "CONFIRMED" || row.status === "COMPLETED")
        && Date.parse(row.startsAt) < end && Date.parse(row.endsAt) > start,
      );
  }

  function minuteAtPointer(event: React.PointerEvent<HTMLDivElement>) {
    const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
    return Math.floor((starts + y / pixelsPerMinute) / slotInterval) * slotInterval;
  }

  function freeBounds(day: string, anchor: number, personId: string | undefined, minimumStart: number) {
    let first = anchor;
    let last = anchor;
    const { start, end } = shiftAt(day, anchor) ?? { start: anchor, end: anchor };
    while (first - slotInterval >= start && availableSlot(day, first - slotInterval, personId, minimumStart)) first -= slotInterval;
    while (last + slotInterval < end && availableSlot(day, last + slotInterval, personId, minimumStart)) last += slotInterval;
    return { first, last, closes: end };
  }

  function selectionRange(anchor: number, minute: number, { first, last, closes }: { first: number; last: number; closes: number }) {
    const edge = Math.max(first, Math.min(last, minute));
    return { start: Math.min(anchor, edge), end: Math.min(Math.max(anchor, edge) + slotInterval, closes) };
  }

  function clearSelection() {
    selectionOrigin.current = null;
    setSelection(null);
  }

  return <div ref={viewportRef} onScroll={() => { if (hoveredEvent) setHoveredEvent(null); }} onPointerLeave={() => { if (hoveredEvent) setHoveredEvent(null); }}
    className={`relative min-h-0 min-w-0 overflow-x-auto overflow-y-auto overscroll-contain rounded-2xl border border-border-subtle bg-surface ${isOwner ? "flex-1" : "max-h-[72dvh]"}`} tabIndex={0} aria-label={copy.calendar}>
    <div style={{ minWidth: `calc(3.25rem + ${columns.length} * ${columnWidth})` }}>
      <div className="sticky top-0 z-20 grid border-b border-border-subtle bg-surface" style={gridStyle}>
        <div data-agenda-gutter aria-hidden="true" className="sticky left-0 z-30 bg-surface" />
        {columns.map(({ key, day, closed, person }) => person ? (
          <div key={key} className="flex min-w-0 items-center gap-1.5 overflow-hidden border-l border-border-subtle px-2 py-1.5">
            <ProfessionalAvatar person={person} className="size-6" />
            <span className="min-w-0 truncate text-xs font-medium text-ink" title={person.name}>{person.name}</span>
          </div>
        ) : <button key={key} data-agenda-date={day} type="button" onClick={() => onSelect(day)} aria-pressed={day === selected}
          className={`flex min-h-16 cursor-pointer items-center justify-center gap-2 border-l border-border-subtle px-1 text-sm hover:bg-subtle ${closed ? `${closedSurface} text-[var(--status-danger-ink)]` : "text-ink-secondary"}`}>
          <span className="min-w-0 truncate capitalize" title={closed ? copy.closed : undefined}>{formatAgendaDay(day, locale, { weekday: "short" })}</span>
          <strong className={`grid size-7 shrink-0 place-items-center rounded-lg tabular-nums ${day === today && !closed ? "bg-accent text-accent-ink" : day === selected ? "ring-1 ring-current" : ""}`}>{Number(day.slice(-2))}</strong>
        </button>)}
      </div>

      <div className="isolate grid" style={gridStyle}>
        <div className="sticky left-0 z-10 select-none border-r border-border-subtle bg-surface" aria-hidden="true" style={{ height }}>
          {hourLabels.map((minute) => <div key={minute} className="absolute inset-x-0 pr-2 pt-1 text-right text-[10px] tabular-nums text-ink-muted" style={{ top: (minute - starts) * pixelsPerMinute }}>
            {formatMinute(minute)}
          </div>)}
          <div className="absolute inset-x-0 bottom-0 pb-0.5 pr-2 text-right text-[10px] tabular-nums text-ink-muted">
            {formatMinute(ends)}
          </div>
        </div>

        {columns.map(({ key, day, person, personId, closed, shifts, events: dayEvents }) => (
          <div
            key={key}
            data-agenda-column-day={day}
            data-agenda-column-key={key}
            data-agenda-column-person={person?.id}
            className={`relative isolate border-l border-border-subtle ${isOwner ? "select-none" : ""} ${closed ? closedSurface : ""} ${
              isOwner && !dragState ? hoveredSlot?.column === key ? "cursor-pointer" : "cursor-not-allowed" : ""
            }`}
            role={person ? "group" : undefined}
            aria-label={person ? (closed ? `${person.name} · ${copy.closed}` : person.name) : closed ? copy.closed : undefined}
            style={{ height }}
            onPointerMove={(e) => {
              const origin = selectionOrigin.current;
              if (origin?.pointerId === e.pointerId) {
                if (e.pointerType === "mouse" && Math.abs(e.clientY - origin.y) > 6) {
                  origin.bounds ??= freeBounds(day, origin.minute, personId, Date.now());
                  setSelection({ column: key, ...selectionRange(origin.minute, minuteAtPointer(e), origin.bounds) });
                }
                return;
              }
              if (!isOwner || !blocksReady || closed || dragState !== null) {
                if (hoveredSlot) setHoveredSlot(null);
                return;
              }
              if ((e.target as HTMLElement).closest("[data-agenda-event-wrapper], [data-agenda-schedule-block]")) {
                if (hoveredSlot) setHoveredSlot(null);
                return;
              }
              const snappedMinute = minuteAtPointer(e);
              if (!availableSlot(day, snappedMinute, personId)) {
                if (hoveredSlot) setHoveredSlot(null);
                return;
              }
              if (!hoveredSlot || hoveredSlot.column !== key || hoveredSlot.minute !== snappedMinute) {
                setHoveredSlot({ column: key, minute: snappedMinute });
              }
            }}
            onPointerLeave={() => {
              if (hoveredSlot) setHoveredSlot(null);
            }}
            onPointerDown={(e) => {
              if (e.button !== 0 || !isOwner || !blocksReady || closed || !onEmptySlotSelect || selectionOrigin.current) return;
              if ((e.target as HTMLElement).closest("[data-agenda-event-wrapper], [data-agenda-schedule-block]")) return;
              const minute = minuteAtPointer(e);
              if (!availableSlot(day, minute, personId, Date.now())) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              selectionOrigin.current = { minute, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
              setHoveredSlot(null);
              setHoveredEvent(null);
            }}
            onPointerUp={(e) => {
              const origin = selectionOrigin.current;
              if (origin?.pointerId !== e.pointerId) return;
              clearSelection();
              const minimumStart = Date.now();
              if (!blocksReady || !availableSlot(day, origin.minute, personId, minimumStart)) return;
              const moved = Math.abs(e.clientY - origin.y) > 6;
              if (e.pointerType === "mouse" && moved) {
                const { start, end } = selectionRange(origin.minute, minuteAtPointer(e), freeBounds(day, origin.minute, personId, minimumStart));
                onEmptySlotSelect?.(day, start, end, personId);
              } else if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) <= 6) {
                onEmptySlotSelect?.(day, origin.minute, undefined, personId);
              }
            }}
            onLostPointerCapture={(e) => {
              if (selectionOrigin.current?.pointerId === e.pointerId) clearSelection();
            }}
          >
            {selection?.column === key && (
              <div className="pointer-events-none absolute inset-x-1 z-10 flex flex-col justify-between overflow-hidden rounded-md border border-blue-500 bg-blue-500/35 text-[11px] font-semibold tabular-nums text-ink"
                style={{ top: (selection.start - starts) * pixelsPerMinute, height: (selection.end - selection.start) * pixelsPerMinute }}>
                <span className="px-2">{formatMinute(selection.start)}</span>
                <span className="bg-blue-500/20 px-2">{formatMinute(selection.end)}</span>
              </div>
            )}
            {/* Feedback sutil de hover com ícone + e horário em slots livres */}
            {blocksReady && hoveredSlot?.column === key && !dragState && availableSlot(day, hoveredSlot.minute, personId) && (
              <div
                className="pointer-events-none absolute inset-x-1 z-5 flex items-center gap-1.5 rounded-lg border border-dashed border-accent/45 bg-accent/8 px-2 text-[11px] font-semibold text-accent transition-opacity animate-in fade-in-0 duration-150"
                style={{
                  top: (hoveredSlot.minute - starts) * pixelsPerMinute,
                  height: Math.min(slotInterval, (shiftAt(day, hoveredSlot.minute)?.end ?? hoveredSlot.minute) - hoveredSlot.minute) * pixelsPerMinute,
                }}
              >
                <Plus size={13} className="shrink-0" />
                <span className="tabular-nums">{formatMinute(hoveredSlot.minute)}</span>
              </div>
            )}

            {!closed && shifts.length > 0 && [...shifts, { start: "" }].map(({ start }, index) => {
              const from = index === 0 ? starts : parseGridMinute(shifts[index - 1].end);
              const to = index === shifts.length ? ends : parseGridMinute(start);
              if (to <= from) return null;
              const isBreak = index > 0 && index < shifts.length;
              return <div key={index} aria-hidden={!isBreak} aria-label={isBreak ? copy.blockedTime : undefined}
                className={`pointer-events-none absolute inset-x-0 bg-subtle/65 ${isBreak ? "border-y border-border-strong" : ""}`}
                style={{ top: (from - starts) * pixelsPerMinute, height: (to - from) * pixelsPerMinute }} />;
            })}
            {gridLines.map((minute) => <div key={minute} aria-hidden="true" className={`pointer-events-none absolute inset-x-0 border-t ${minute % 60 === 0 ? "border-border-subtle" : "border-dashed border-border-subtle/75"}`} style={{ top: (minute - starts) * pixelsPerMinute }} />)}

            {/* Pré-visualização do slot de destino durante o arrasto */}
            {dragState && dragState.targetColumn === key && (
              <div
                className={`pointer-events-none absolute inset-x-1 z-25 flex flex-col justify-center rounded-lg border-2 border-dashed p-1.5 text-xs font-semibold shadow-sm transition-all ${
                  dragState.isInvalid
                    ? "border-rose-500 bg-rose-500/20 text-rose-600 dark:text-rose-400"
                    : "border-accent bg-accent/20 text-accent"
                }`}
                style={{
                  top: (dragState.targetMinute - starts) * pixelsPerMinute,
                  height: Math.max(26, dragState.duration * pixelsPerMinute),
                }}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {dragState.isInvalid && <TriangleAlert size={14} aria-hidden="true" className="shrink-0" />}
                  <span className="truncate">
                    {dragState.isInvalid
                      ? `${dragState.invalidReason ?? copy.closedDay} (${formatMinute(dragState.targetMinute)})`
                      : `${formatMinute(dragState.targetMinute)} – ${formatMinute(dragState.targetMinute + dragState.duration)} · ${dragState.appointment.serviceNameSnapshot}`}
                  </span>
                </span>
              </div>
            )}

            {dayEvents.map(({ row, start, end, lane, width }) => {
              const position = {
                top: (start - starts) * pixelsPerMinute,
                height: (end - start) * pixelsPerMinute,
                left: `${lane * width}%`,
                width: `${width}%`,
              };
              if (!("serviceId" in row)) {
                const name = row.collaboratorId ? staff.get(row.collaboratorId)?.name ?? copy.professional : copy.blockedCompany;
                const time = `${formatTimeInTimezone(row.startsAt, company.timezone, locale)} – ${formatTimeInTimezone(row.endsAt, company.timezone, locale)}`;
                const reason = row.reason?.trim() || copy.noBlockReason;
                return <div key={row.id} data-agenda-schedule-block={row.id} className="absolute z-10 px-0.5" style={position}>
                  <div title={`${name} · ${time} · ${reason}`} aria-label={`${name} · ${time} · ${reason}`} role="group"
                    className="h-full cursor-not-allowed overflow-hidden rounded-md border border-rose-500/45 bg-rose-500/14 px-1 py-px text-[10px] leading-[10px] text-rose-800 dark:text-rose-300">
                    <span className="flex items-center gap-1 font-semibold"><LockKeyhole size={11} className="shrink-0" aria-hidden="true" /><span className="truncate">{name}</span></span>
                    <span className="block truncate tabular-nums">{time}</span>
                    <span className="block truncate">{reason}</span>
                  </div>
                </div>;
              }
              const isBeingDragged = dragState?.appointment.id === row.id;
              const isDraggable = isOwner && (row.status === "PENDING" || row.status === "CONFIRMED");
              return (
                <div
                  key={row.id}
                  data-agenda-event-wrapper={row.id}
                  onPointerDown={(e) => handleEventPointerDown(e, row)}
                  onPointerEnter={(e) => {
                    if (dragState) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredEvent({
                      appointment: row,
                      anchor: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right },
                    });
                  }}
                  onPointerLeave={() => {
                    setHoveredEvent((prev) => (prev?.appointment.id === row.id ? null : prev));
                  }}
                  onClickCapture={(e) => {
                    if (dragMovedRef.current) {
                      e.stopPropagation();
                      e.preventDefault();
                    }
                  }}
                  className={`absolute z-10 px-0.5 select-none transition-opacity ${
                    isBeingDragged ? "opacity-35 pointer-events-none" : ""
                  } ${isDraggable ? "group/agenda-drag cursor-pointer active:cursor-grabbing" : ""} ${isDraggable && dayPeople ? "touch-none" : ""}`}
                  style={position}
                >
                  {renderBlock(row, end - start < 27)}
                </div>
              );
            })}

            {current?.date === day && current.minute >= starts && current.minute < ends && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 z-20 border-t border-accent" style={{ top: (current.minute - starts) * pixelsPerMinute }}>
                <span className="absolute -top-1 left-0 size-2 rounded-full bg-accent" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>

    {/* Card flutuante rico no hover do agendamento (estilo Gendo) */}
    {hoveredEvent && !dragState && (
      <AppointmentHoverCard
        appointment={hoveredEvent.appointment}
        anchor={hoveredEvent.anchor}
        timezone={company.timezone}
        person={staff.get(hoveredEvent.appointment.collaboratorId)}
        payment={payments?.get(hoveredEvent.appointment.id)}
        isFirstVisit={
          firstVisitClientIds?.has(
            getCanonicalClientId(hoveredEvent.appointment.clientPhone, hoveredEvent.appointment.clientName),
          ) ?? false
        }
      />
    )}

    {/* Badge flutuante que acompanha o cursor durante o arrasto */}
    {dragState && (
      <div
        className={`fixed pointer-events-none z-100 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold shadow-2xl backdrop-blur-md ${
          dragState.isInvalid
            ? "border border-rose-500/30 bg-rose-600 text-white"
            : "border border-accent/30 bg-accent text-accent-ink"
        }`}
        style={{
          left: dragState.pointerX + 14,
          top: dragState.pointerY + 14,
        }}
      >
        {dragState.isInvalid && <TriangleAlert size={14} aria-hidden="true" className="shrink-0" />}
        <span>
          {dragState.isInvalid
            ? `${dragState.invalidReason ?? copy.closedDay} (${formatMinute(dragState.targetMinute)})`
            : `✓ ${formatMinute(dragState.targetMinute)} – ${formatMinute(dragState.targetMinute + dragState.duration)} · ${dragState.appointment.serviceNameSnapshot}`}
        </span>
      </div>
    )}
  </div>;
}

export function agendaRangeLabel(day: string, days: string[], monthOnly: boolean, locale: string) {
  if (monthOnly) return formatAgendaDay(day, locale, { month: "long", year: "numeric" });
  const last = days.at(-1) ?? shiftAgendaDay(day, 0);
  if (days.length < 2) return formatAgendaDay(day, locale, { day: "numeric", month: "long", year: "numeric" });
  return `${formatAgendaDay(days[0], locale, { day: "numeric", month: "short" })} – ${formatAgendaDay(last, locale, { day: "numeric", month: "short", year: "numeric" })}`;
}
