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
import { getCanonicalClientId } from "@/lib/use-clients";
import { AppointmentHoverCard } from "./agenda-card";
import type { AgendaPayment, HoverCardAnchor } from "./agenda-card";
import type { AgendaPerson } from "./agenda-controls";

const arrow = "grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-secondary hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-accent";
const closedSurface = "bg-[color-mix(in_srgb,var(--status-danger-bg)_60%,var(--surface-elevated))]";

function formatMinute(minute: number): string {
  const h = String(Math.floor(minute / 60)).padStart(2, "0");
  const m = String(minute % 60).padStart(2, "0");
  return `${h}:${m}`;
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
  const monthLabel = formatAgendaDay(start, locale, { month: "long", year: "numeric" });

  return <section aria-label={`${copy.calendar} · ${monthLabel}`} className={spacious ? "overflow-hidden rounded-2xl border border-border-subtle bg-surface" : "min-w-0"}>
    {onMonth && <div className="mb-2 flex items-center justify-between gap-1">
      <h3 className="min-w-0 text-sm font-semibold text-ink first-letter:uppercase">{monthLabel}</h3>
      <div className="flex shrink-0">
        <button type="button" className={arrow} aria-label={copy.previous} onClick={() => onMonth(shiftAgendaMonth(month, -1))}><ChevronLeft size={16} /></button>
        <button type="button" className={arrow} aria-label={copy.next} onClick={() => onMonth(shiftAgendaMonth(month, 1))}><ChevronRight size={16} /></button>
      </div>
    </div>}
    <div className={`grid grid-cols-7 ${spacious ? "border-b border-border-subtle bg-subtle/45" : "gap-px"}`}>
      {days.slice(0, 7).map((date) => <div key={date} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-ink-muted sm:text-[11px]">
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
        const tone = closed ? `bg-[var(--status-danger-bg)] font-semibold text-[var(--status-danger-ink)] ring-inset focus-visible:outline-[var(--status-danger-ink)] ${active ? "ring-2 ring-[var(--status-danger-ink)]" : "ring-1 ring-[var(--status-danger-border)]"}`
          : active ? "bg-accent text-accent-ink"
          : hasSlot || date === today ? "bg-accent-soft text-accent"
          : outside || disabled ? "text-ink-muted" : "text-ink";
        const button = <button key={date} type="button" disabled={disabled} aria-label={label} title={label} data-agenda-date={date} data-closed={closed || undefined}
          aria-pressed={active} aria-current={date === today ? "date" : undefined} onClick={() => onSelect(date)}
          className={`relative flex min-w-0 cursor-pointer items-center justify-center rounded-lg text-xs tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed ${closed ? "" : "font-medium focus-visible:outline-accent enabled:hover:ring-1 enabled:hover:ring-accent"} ${tone} ${spacious ? "size-7" : "aspect-square w-full"} ${outside && !closed ? "opacity-55" : ""}`}>
          {Number(date.slice(-2))}
          {count > 0 ? (
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
  selected,
  today,
  now,
  company,
  byDay,
  appointments,
  blocks,
  staff,
  payments,
  firstVisitClientIds,
  blocksReady,
  isOwner = false,
  onSelect,
  renderBlock,
  onRescheduleDrop,
  onRescheduleConflict,
  onEmptySlotClick,
}: {
  days: string[];
  selected: string;
  today: string;
  now: number;
  company: Company;
  byDay: Map<string, Appointment[]>;
  appointments: readonly Appointment[];
  blocks: ScheduleBlock[];
  staff: ReadonlyMap<string, AgendaPerson>;
  payments?: ReadonlyMap<string, AgendaPayment>;
  firstVisitClientIds?: ReadonlySet<string>;
  blocksReady: boolean;
  isOwner?: boolean;
  onSelect: (date: string) => void;
  renderBlock: (appointment: Appointment, compact: boolean) => ReactNode;
  onRescheduleDrop?: (appointment: Appointment, targetDate: string, targetMinute: number) => void;
  onRescheduleConflict: () => void;
  onEmptySlotClick?: (date: string, minute: number) => void;
}) {
  const { locale } = useLocale();
  const copy = agendaStrings(locale);
  const viewportRef = useRef<HTMLDivElement>(null);
  const clock = useMemo(() => agendaClock(company.timezone), [company.timezone]);

  // Estados e referências de arraste (Drag & Drop) com tolerância de > 6px
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragTargetRef = useRef<DragState | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{ day: string; minute: number } | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<{ appointment: Appointment; anchor: HoverCardAnchor } | null>(null);
  const dragPendingRef = useRef<{
    appointment: Appointment;
    startX: number;
    startY: number;
    originDate: string;
    originMinute: number;
    duration: number;
  } | null>(null);
  const dragMovedRef = useRef(false);
  const emptyClickRef = useRef<{ day: string; x: number; y: number } | null>(null);

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

  const columns = days.map((day) => ({ day, ...companyDay(company, day), events: layoutDay([...(byDay.get(day) ?? []), ...(Array.isArray(blocks) ? blocks : [])], day, clock) }));
  const events = columns.flatMap((column) => column.events);
  const parse = (value?: string | null, fallback = 0) => {
    if (!value || typeof value !== "string" || value.length < 5) return fallback;
    const h = Number(value.slice(0, 2));
    const m = Number(value.slice(3, 5));
    const total = h * 60 + m;
    return Number.isFinite(total) ? total : fallback;
  };
  const startsRaw = Math.floor(Math.min(8 * 60, ...events.map((event) => event.start), ...columns.filter((c) => !c.closed).map(({ hours }) => parse(hours?.openTime, 8 * 60))) / 60) * 60;
  const endsRaw = Math.ceil(Math.max(19 * 60, ...events.map((event) => event.end), ...columns.filter((c) => !c.closed).map(({ hours }) => parse(hours?.closeTime, 19 * 60))) / 60) * 60;
  const starts = Number.isFinite(startsRaw) ? Math.max(0, Math.min(23 * 60, startsRaw)) : 8 * 60;
  const ends = Number.isFinite(endsRaw) && endsRaw > starts ? Math.min(24 * 60, endsRaw) : Math.max(starts + 60, 19 * 60);
  const pixelsPerMinute = 1.15;
  const height = (ends - starts) * pixelsPerMinute;
  const hourCount = Math.max(1, Math.floor((ends - starts) / 60));
  const hourLabels = Array.from({ length: hourCount }, (_, index) => starts + index * 60);
  const current = now ? clock(now) : null;
  const gridStyle = { gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(0, 1fr))` };

  // Handlers globais de ponteiro para cálculo de arrasto e soltura
  function handleEventPointerDown(e: React.PointerEvent, appointment: Appointment) {
    if (!isOwner || !blocksReady || e.button !== 0 || dragPendingRef.current) return;
    if ((e.target as Element).closest("[data-agenda-quick-action]")) return;
    if (appointment.status !== "PENDING" && appointment.status !== "CONFIRMED") return;
    setHoveredSlot(null);
    setHoveredEvent(null);
    emptyClickRef.current = null;
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
      const rect = targetEl.getBoundingClientRect();
      const relY = moveEvent.clientY - rect.top;
      const rawMinute = starts + (relY / pixelsPerMinute);

      // Encaixe estrito na grade de 30 em 30 minutos
      let snappedMinute = Math.round(rawMinute / 30) * 30;
      const duration = dragPendingRef.current.duration;
      snappedMinute = Math.max(starts, Math.min(ends - duration, snappedMinute));

      const { closed } = companyDay(company, targetDay);
      const targetIso = localDayMinuteToUtcIso(targetDay, snappedMinute, company.timezone);
      const targetStart = Date.parse(targetIso);
      const targetEnd = targetStart + duration * 60_000;
      const isPast = targetStart <= Date.now();
      const isBlocked = overlapsScheduleBlock(blocks, targetStart, targetEnd, appointment.collaboratorId);
      const conflict = findAppointmentConflict(appointments, appointment, targetStart, targetEnd);
      const invalidReason = conflict ? copy.appointmentConflict(conflict.clientName)
        : closed ? copy.closedDay : isBlocked ? copy.blockedTime : isPast ? copy.pastTime : null;

      const target = {
        appointment: dragPendingRef.current.appointment,
        originDate: dragPendingRef.current.originDate,
        originMinute: dragPendingRef.current.originMinute,
        targetDate: targetDay,
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
        (target.targetDate !== target.originDate || target.targetMinute !== target.originMinute)) {
        if (target.hasAppointmentConflict) onRescheduleConflict();
        else if (!target.isInvalid) onRescheduleDrop?.(target.appointment, target.targetDate, target.targetMinute);
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

  function availableSlot(day: string, minute: number) {
    if (minute < starts || minute >= ends) return false;
    const start = Date.parse(localDayMinuteToUtcIso(day, minute, company.timezone));
    return start > now && !overlapsScheduleBlock(blocks, start, start + 30 * 60_000);
  }

  return <div ref={viewportRef} onScroll={() => { if (hoveredEvent) setHoveredEvent(null); }} onPointerLeave={() => { if (hoveredEvent) setHoveredEvent(null); }} className="relative overflow-auto rounded-2xl border border-border-subtle bg-surface" tabIndex={0} aria-label={copy.calendar}>
    <div className={days.length > 1 ? "min-w-198" : "min-w-0"}>
      <div className="grid border-b border-border-subtle" style={gridStyle}>
        <div data-agenda-gutter aria-hidden="true" className="sticky left-0 z-30 bg-surface" />
        {columns.map(({ day, closed }) => <button key={day} data-agenda-date={day} type="button" onClick={() => onSelect(day)} aria-pressed={day === selected}
          className={`flex min-h-16 cursor-pointer items-center justify-center gap-2 border-l border-border-subtle px-1 text-sm hover:bg-subtle ${closed ? `${closedSurface} text-[var(--status-danger-ink)]` : "text-ink-secondary"}`}>
          <span className="min-w-0 truncate capitalize" title={closed ? copy.closed : undefined}>{formatAgendaDay(day, locale, { weekday: "short" })}</span>
          <strong className={`grid size-7 shrink-0 place-items-center rounded-lg tabular-nums ${day === today && !closed ? "bg-accent text-accent-ink" : day === selected ? "ring-1 ring-current" : ""}`}>{Number(day.slice(-2))}</strong>
        </button>)}
      </div>

      <div className="grid" style={gridStyle}>
        <div className="sticky left-0 z-30 select-none bg-surface" aria-hidden="true" style={{ height }}>
          {hourLabels.map((minute) => <div key={minute} className="absolute inset-x-0 pr-2 pt-1 text-right text-[10px] tabular-nums text-ink-muted" style={{ top: (minute - starts) * pixelsPerMinute }}>
            {String(minute / 60).padStart(2, "0")}:00
          </div>)}
        </div>

        {columns.map(({ day, closed, hours, events: dayEvents }) => (
          <div
            key={day}
            data-agenda-column-day={day}
            className={`relative border-l border-border-subtle ${closed ? closedSurface : ""} ${
              isOwner && !dragState ? hoveredSlot?.day === day ? "cursor-pointer" : "cursor-not-allowed" : ""
            }`}
            aria-label={closed ? copy.closed : undefined}
            style={{ height }}
            onPointerMove={(e) => {
              if (!isOwner || !blocksReady || closed || dragState !== null) {
                if (hoveredSlot) setHoveredSlot(null);
                return;
              }
              if ((e.target as HTMLElement).closest("[data-agenda-event-wrapper], [data-agenda-schedule-block]")) {
                if (hoveredSlot) setHoveredSlot(null);
                return;
              }
              const rect = e.currentTarget.getBoundingClientRect();
              const relY = e.clientY - rect.top;
              const rawMinute = starts + (relY / pixelsPerMinute);
              const snappedMinute = Math.floor(rawMinute / 30) * 30;
              if (!availableSlot(day, snappedMinute)) {
                if (hoveredSlot) setHoveredSlot(null);
                return;
              }
              if (!hoveredSlot || hoveredSlot.day !== day || hoveredSlot.minute !== snappedMinute) {
                setHoveredSlot({ day, minute: snappedMinute });
              }
            }}
            onPointerLeave={() => {
              if (hoveredSlot) setHoveredSlot(null);
            }}
            onPointerDown={(e) => {
              if (e.button !== 0 || !isOwner || !blocksReady) return;
              if ((e.target as HTMLElement).closest("[data-agenda-event-wrapper], [data-agenda-schedule-block]")) return;
              emptyClickRef.current = { day, x: e.clientX, y: e.clientY };
            }}
            onPointerUp={(e) => {
              if (!emptyClickRef.current || emptyClickRef.current.day !== day) return;
              const startPoint = emptyClickRef.current;
              emptyClickRef.current = null;
              const dist = Math.hypot(e.clientX - startPoint.x, e.clientY - startPoint.y);
              if (dist > 6) return;
              if (closed || !isOwner || !blocksReady) return;

              const rect = e.currentTarget.getBoundingClientRect();
              const relY = e.clientY - rect.top;
              const rawMinute = starts + (relY / pixelsPerMinute);
              const snappedMinute = Math.floor(rawMinute / 30) * 30;
              if (!availableSlot(day, snappedMinute)) return;

              onEmptySlotClick?.(day, snappedMinute);
            }}
          >
            {/* Feedback sutil de hover com ícone + e horário em slots livres */}
            {blocksReady && hoveredSlot?.day === day && !dragState && availableSlot(day, hoveredSlot.minute) && (
              <div
                className="pointer-events-none absolute inset-x-1 z-5 flex items-center gap-1.5 rounded-lg border border-dashed border-accent/45 bg-accent/8 px-2 text-[11px] font-semibold text-accent transition-opacity animate-in fade-in-0 duration-150"
                style={{
                  top: (hoveredSlot.minute - starts) * pixelsPerMinute,
                  height: 30 * pixelsPerMinute,
                }}
              >
                <Plus size={13} className="shrink-0" />
                <span className="tabular-nums">{formatMinute(hoveredSlot.minute)}</span>
              </div>
            )}

            {!closed && hours?.openTime && hours.closeTime && <>
              <div aria-hidden="true" className="absolute inset-x-0 top-0 bg-subtle/65" style={{ height: Math.max(0, (parse(hours.openTime) - starts) * pixelsPerMinute) }} />
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 bg-subtle/65" style={{ height: Math.max(0, (ends - parse(hours.closeTime)) * pixelsPerMinute) }} />
            </>}
            {hourLabels.map((minute) => <div key={minute} aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-border-subtle" style={{ top: (minute - starts) * pixelsPerMinute }} />)}
            {hourLabels.map((minute) => <div key={minute} aria-hidden="true" className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border-subtle/75" style={{ top: (minute + 30 - starts) * pixelsPerMinute }} />)}

            {/* Pré-visualização do slot de destino durante o arrasto */}
            {dragState && dragState.targetDate === day && (
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
                  } ${isDraggable ? "group/agenda-drag cursor-pointer active:cursor-grabbing" : ""}`}
                  style={position}
                >
                  {renderBlock(row, end - start < 30)}
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
