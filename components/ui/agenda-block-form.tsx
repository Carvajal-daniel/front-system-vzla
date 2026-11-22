"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { agendaClock, companyDay, localDayMinuteToUtcIso, shiftAgendaDay } from "@/lib/agenda";
import { ApiError, apiRequest } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import type { CreateScheduleBlockPayload, CreateScheduleBlockResponse } from "@/lib/types/appointment";
import type { Company } from "@/lib/types/auth";
import type { Collaborator, WorkScheduleSlot } from "@/lib/types/team";

const field = "min-h-10 w-full min-w-0 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm font-normal text-ink outline-none focus-visible:border-accent";
const label = "block min-w-0 space-y-1.5 text-xs font-medium text-ink-secondary";
const durations = [
  ["30 min", 30], ["1 hora", 60], ["2 horas", 120], ["3 horas", 180],
  ["4 horas", 240], ["5 horas", 300], ["6 horas", 360], ["7 horas", 420],
] as const;
const repeatOptions = [
  ["1w", "Por 1 semana"], ["4w", "Por 4 semanas"],
  ["3m", "Por 3 meses"], ["6m", "Por 6 meses"],
] as const;
type Frequency = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY";
type RepeatPeriod = (typeof repeatOptions)[number][0];

const timeMinute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const minuteTime = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;

function shiftMonth(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month + months, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function AgendaBlockForm({
  company, collaborators, initialDate, initialTime, initialEndTime, initialPersonId,
  onClose, onCreated, onSavingChange,
}: {
  company: Company;
  collaborators: Collaborator[];
  initialDate: string;
  initialTime?: string;
  initialEndTime?: string;
  initialPersonId?: string;
  onClose: () => void;
  onCreated: (created: CreateScheduleBlockResponse[], complete: boolean) => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const { t } = useLocale();
  const clock = useMemo(() => agendaClock(company.timezone), [company.timezone]);
  const initialRange = useMemo(() => {
    const start = initialTime ? Date.parse(initialTime) : NaN;
    const end = initialEndTime ? Date.parse(initialEndTime) : start + 60 * 60_000;
    return { start: Number.isFinite(start) ? clock(start) : null, end: Number.isFinite(end) ? clock(end) : null };
  }, [clock, initialEndTime, initialTime]);
  const [collaboratorId, setCollaboratorId] = useState(initialPersonId ?? "");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialRange.start ? minuteTime(initialRange.start.minute) : "12:00");
  const [endDate, setEndDate] = useState(initialRange.end?.date ?? initialDate);
  const [endTime, setEndTime] = useState(initialRange.end ? minuteTime(initialRange.end.minute) : "13:00");
  const [frequency, setFrequency] = useState<Frequency>("ONCE");
  const [period, setPeriod] = useState<RepeatPeriod>("4w");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<CreateScheduleBlockPayload[]>([]);
  const [workHours, setWorkHours] = useState<{ id: string; schedules: WorkScheduleSlot[] }>();

  useEffect(() => {
    if (!allDay || !collaboratorId) return;
    const controller = new AbortController();
    void apiRequest<WorkScheduleSlot[] | { schedules: WorkScheduleSlot[] }>(
      `/collaborators/${encodeURIComponent(collaboratorId)}/work-schedules`,
      { signal: controller.signal },
    ).then((result) => {
      if (!controller.signal.aborted) setWorkHours({ id: collaboratorId, schedules: Array.isArray(result) ? result : result.schedules ?? [] });
    }).catch(() => {
      if (!controller.signal.aborted) setWorkHours({ id: collaboratorId, schedules: [] });
    });
    return () => controller.abort();
  }, [allDay, collaboratorId]);

  const loadingHours = allDay && !!collaboratorId && workHours?.id !== collaboratorId;
  function fullDayHours(date: string) {
    const { hours, closed } = companyDay(company, date);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const personal = collaboratorId && workHours?.id === collaboratorId
      ? workHours.schedules.find((day) => day.dayOfWeek === weekday) : undefined;
    const opens = Math.max(timeMinute(hours?.openTime ?? "00:00"), timeMinute(personal?.startTime ?? "00:00"));
    const closes = Math.min(timeMinute(hours?.closeTime ?? "24:00"), timeMinute(personal?.endTime ?? "24:00"));
    const working = !closed && personal?.isWorkingDay !== false && opens < closes;
    return { opens: working ? opens : 0, closes: working ? closes : 1440 };
  }

  function selectDuration(duration: number) {
    const end = timeMinute(startTime) + duration;
    setEndDate(shiftAgendaDay(startDate, Math.floor(end / 1440)));
    setEndTime(minuteTime(end % 1440));
  }

  function buildBlocks() {
    const daySpan = Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000);
    if (daySpan < 0) return [];
    const count = Number(period.slice(0, -1));
    const limit = period.endsWith("m") ? shiftMonth(startDate, count) : shiftAgendaDay(startDate, count * 7);
    const blocks: CreateScheduleBlockPayload[] = [];
    let date = startDate;
    for (let index = 1; frequency === "ONCE" || date < limit; index++) {
      const lastDate = shiftAgendaDay(date, daySpan);
      const firstHours = fullDayHours(date);
      const lastHours = fullDayHours(lastDate);
      const startsAt = localDayMinuteToUtcIso(date, allDay ? firstHours.opens : timeMinute(startTime), company.timezone);
      const endsAt = localDayMinuteToUtcIso(lastDate, allDay ? lastHours.closes : timeMinute(endTime), company.timezone);
      if (startsAt >= endsAt) return [];
      blocks.push({ collaboratorId: collaboratorId || null, startsAt, endsAt, reason: reason.trim() || null });
      if (frequency === "ONCE") break;
      date = frequency === "MONTHLY" ? shiftMonth(startDate, index)
        : shiftAgendaDay(startDate, index * (frequency === "WEEKLY" ? 7 : 1));
    }
    return blocks;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loadingHours) return;
    const requests = remaining.length ? remaining : buildBlocks();
    if (!requests.length) {
      setError("O horário final do bloqueio deve ser posterior ao horário inicial.");
      return;
    }
    setSaving(true);
    onSavingChange(true);
    setError("");
    const created: CreateScheduleBlockResponse[] = [];
    try {
      for (const body of requests) {
        created.push(await apiRequest<CreateScheduleBlockResponse>("/schedule-blocks", { method: "POST", body }));
      }
      onCreated(created, true);
      onClose();
    } catch (failure) {
      const pending = requests.slice(created.length);
      const message = failure instanceof ApiError ? failure.message : t.errors.networkDescription;
      if (created.length) onCreated(created, false);
      if (created.length || remaining.length) setRemaining(pending);
      setError(created.length || remaining.length ? `Restam ${pending.length} bloqueio(s) para salvar. ${message}` : message);
    } finally {
      setSaving(false);
      onSavingChange(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={saving || remaining.length > 0} className="space-y-4 disabled:opacity-65">
        <label className={label}>
          Profissional
          <select className={field} value={collaboratorId} onChange={(event) => setCollaboratorId(event.target.value)}>
            <option value="">Todos os profissionais</option>
            {collaborators.filter((person) => person.isActive || person.id === initialPersonId).map((person) => (
              <option key={person.id} value={person.id}>{person.name}</option>
            ))}
          </select>
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-border-subtle px-3 py-2.5 text-sm font-medium text-ink">
          Bloquear dia inteiro
          <span className="relative flex">
            <input type="checkbox" role="switch" className="peer sr-only" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
            <span aria-hidden="true" className="h-5 w-9 rounded-full bg-ink-muted transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2" />
            <span aria-hidden="true" className="pointer-events-none absolute top-0.5 left-0.5 size-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Data de início
            <input className={field} type="date" required value={startDate} onChange={(event) => {
              const date = event.target.value;
              setStartDate(date);
              if (endDate === startDate || endDate < date) setEndDate(date);
            }} />
          </label>
          <label className={label}>
            Horário de início
            <input className={field} type={allDay ? "text" : "time"} required readOnly={allDay}
              value={allDay ? loadingHours ? "" : minuteTime(fullDayHours(startDate).opens) : startTime}
              onChange={(event) => setStartTime(event.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Data de término
            <input className={field} type="date" required min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label className={label}>
            Horário de término
            <input className={field} type={allDay ? "text" : "time"} required readOnly={allDay}
              value={allDay ? loadingHours ? "" : minuteTime(fullDayHours(endDate).closes) : endTime}
              onChange={(event) => setEndTime(event.target.value)} />
          </label>
        </div>

        <div className={label}>
          <p>Sugestões de bloqueios</p>
          <div className="flex flex-wrap gap-1.5">
            {durations.map(([name, minutes]) => (
              <button key={minutes} type="button" disabled={allDay || !startDate || !startTime} onClick={() => selectDuration(minutes)}
                className="cursor-pointer rounded-full border border-border-subtle px-2.5 py-1 text-xs hover:border-accent hover:text-ink disabled:opacity-50">
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Frequência
            <select className={field} value={frequency} onChange={(event) => {
              const next = event.target.value as Frequency;
              setFrequency(next);
              if (next === "MONTHLY" && period.endsWith("w")) setPeriod("3m");
              if (next === "WEEKLY" && period === "1w") setPeriod("4w");
            }}>
              <option value="ONCE">Único</option>
              <option value="DAILY">Diário</option>
              <option value="WEEKLY">Semanal</option>
              <option value="MONTHLY">Mensal</option>
            </select>
          </label>
          <label className={label}>
            Repete
            <select className={field} disabled={frequency === "ONCE"} value={frequency === "ONCE" ? "" : period}
              onChange={(event) => setPeriod(event.target.value as RepeatPeriod)}>
              <option value="" disabled>Não se repete</option>
              {repeatOptions.filter(([value]) => frequency === "MONTHLY" ? value.endsWith("m")
                : frequency !== "WEEKLY" || value !== "1w").map(([value, name]) => (
                <option key={value} value={value}>{name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className={label}>
          Motivo do bloqueio
          <textarea className={`${field} min-h-16 resize-y`} placeholder="Descreva o motivo" maxLength={500}
            value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
      </fieldset>

      {error && <p role="alert" className="rounded-xl bg-[var(--status-danger-bg)] p-3 text-xs text-[var(--status-danger-ink)]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={saving} onClick={onClose}
          className="min-h-10 cursor-pointer rounded-xl border border-border-subtle px-4 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-50">
          {t.common.cancel}
        </button>
        <button type="submit" disabled={saving || loadingHours}
          className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50">
          {saving && <LoaderCircle size={16} className="animate-spin" />}
          {remaining.length ? "Salvar restantes" : t.common.save}
        </button>
      </div>
    </form>
  );
}
