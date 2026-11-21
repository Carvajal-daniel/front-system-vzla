import type { Appointment, ScheduleBlock } from "@/lib/types/appointment";
import type { Company } from "@/lib/types/auth";

export type AgendaView = "day" | "week" | "month" | "list";
export const agendaViews: AgendaView[] = ["day", "week", "month", "list"];

export function calendarDate(day: string) {
  return new Date(`${day}T00:00:00Z`);
}

export function shiftAgendaDay(day: string, steps: number) {
  const date = calendarDate(day);
  date.setUTCDate(date.getUTCDate() + steps);
  return date.toISOString().slice(0, 10);
}

export function shiftAgendaMonth(day: string, steps: number) {
  const date = calendarDate(`${day.slice(0, 7)}-01`);
  date.setUTCMonth(date.getUTCMonth() + steps);
  return date.toISOString().slice(0, 10);
}

function weekStart(day: string) {
  return shiftAgendaDay(day, -((calendarDate(day).getUTCDay() + 6) % 7));
}

export function agendaDays(from: string, count: number) {
  return Array.from({ length: count }, (_, index) => shiftAgendaDay(from, index));
}

export function agendaMonth(day: string) {
  const start = shiftAgendaMonth(day, 0);
  const end = shiftAgendaMonth(day, 1);
  const from = weekStart(start);
  const last = shiftAgendaDay(weekStart(shiftAgendaDay(end, -1)), 7);
  const count = (calendarDate(last).getTime() - calendarDate(from).getTime()) / 86_400_000;
  return { start, end, from, to: last, days: agendaDays(from, count) };
}

export function agendaRange(view: AgendaView, day: string) {
  if (view === "day") return { from: day, to: shiftAgendaDay(day, 1), days: [day] };
  if (view === "week") {
    const from = weekStart(day);
    return { from, to: shiftAgendaDay(from, 7), days: agendaDays(from, 7) };
  }
  const month = agendaMonth(day);
  return view === "month" ? month : { from: month.start, to: month.end, days: month.days.filter((date) => date >= month.start && date < month.end) };
}

export function formatAgendaDay(date: string, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(calendarDate(date));
}

export function agendaClock(timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  return (instant: string | number) => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
  };
}

export function agendaBoundary(day: string, timezone: string) {
  const clock = agendaClock(timezone);
  const midnight = calendarDate(day).getTime();
  const localMillis = (instant: number) => {
    const local = clock(instant);
    return calendarDate(local.date).getTime() + local.minute * 60_000;
  };
  const first = midnight - (localMillis(midnight) - midnight);
  const second = midnight - (localMillis(first) - first);
  // At a forward offset change at midnight, use the first real time of the new civil day.
  return new Date(localMillis(second) === midnight ? second : Math.max(first, second)).toISOString();
}

/**
 * Converte data e minuto civis locais no fuso horário informado para um instante ISO UTC exato.
 * Permite posicionar reagendamentos arrastados na grade de forma precisa e imune a diferenças de fuso do navegador.
 */
export function localDayMinuteToUtcIso(day: string, minute: number, timezone: string): string {
  const clock = agendaClock(timezone);
  const targetLocal = calendarDate(day).getTime() + minute * 60_000;
  const localMillis = (instant: number) => {
    const local = clock(instant);
    return calendarDate(local.date).getTime() + local.minute * 60_000;
  };
  const first = targetLocal - (localMillis(targetLocal) - targetLocal);
  const second = targetLocal - (localMillis(first) - targetLocal);
  return new Date(localMillis(second) === targetLocal ? second : Math.max(first, second)).toISOString();
}

export function companyWeekday(company: Pick<Company, "operatingSchedule" | "operatingDays">, weekday: number) {
  const hours = company.operatingSchedule?.find((entry) => entry.dayOfWeek === weekday);
  const operatingDays = company.operatingDays?.trim();
  // Settings and calendar dates both use 0 for Sunday, even when the display starts on Monday.
  const isOpen = hours?.isOpen ?? (operatingDays
    ? operatingDays.split(",").some((entry) => entry.trim() === String(weekday))
    : weekday !== 0);
  return { isOpen, hours };
}

export function companyDay(company: Pick<Company, "operatingSchedule" | "operatingDays">, day: string) {
  const { isOpen, hours } = companyWeekday(company, calendarDate(day).getUTCDay());
  const closed = !isOpen || Boolean(hours && (!hours.openTime || !hours.closeTime));
  return { closed, hours };
}

export function isAppointmentPaid(payment?: { collectedInCents: number; netInCents: number } | null) {
  return !!payment && payment.collectedInCents > 0 && payment.collectedInCents >= payment.netInCents;
}

export function isReadyToComplete(appointment: Pick<Appointment, "status" | "endsAt">, now: number) {
  return appointment.status === "CONFIRMED" && now >= Date.parse(appointment.endsAt);
}

export function overlapsScheduleBlock(
  blocks: readonly ScheduleBlock[], startsAt: number, endsAt: number, collaboratorId?: string,
) {
  return blocks.some((block) =>
    (!collaboratorId || !block.collaboratorId || block.collaboratorId === collaboratorId) &&
    Date.parse(block.startsAt) < endsAt && Date.parse(block.endsAt) > startsAt,
  );
}

export function findAppointmentConflict(
  appointments: readonly Appointment[], appointment: Pick<Appointment, "id" | "collaboratorId">,
  startsAt: number, endsAt: number,
) {
  return appointments.find((row) =>
    row.id !== appointment.id && row.collaboratorId === appointment.collaboratorId &&
    (row.status === "PENDING" || row.status === "CONFIRMED" || row.status === "COMPLETED") &&
    Date.parse(row.startsAt) < endsAt && Date.parse(row.endsAt) > startsAt,
  );
}

export function isUnpaidCompleted(appointment: Pick<Appointment, "status">, payment?: { openInCents: number }) {
  return appointment.status === "COMPLETED" && (payment?.openInCents ?? 0) > 0;
}

export function whatsAppReminder(appointment: Appointment, locale: string, timezone: string) {
  const raw = appointment.clientPhone.trim();
  const digits = raw.replace(/\D/g, "");
  let phone = raw.startsWith("+") || /^(55\d{10,11}|58\d{10})$/.test(digits) ? digits : "";
  if (!phone && (/^[1-9]\d9\d{8}$/.test(digits) || (timezone.startsWith("America/Sao_") && /^\d{10}$/.test(digits)))) phone = `55${digits}`;
  if (!phone && timezone === "America/Caracas" && /^4\d{9}$/.test(digits)) phone = `58${digits}`;
  if (!/^[1-9]\d{9,14}$/.test(phone)) return null;
  const date = new Intl.DateTimeFormat(locale, { timeZone: timezone, dateStyle: "short", timeStyle: "short" }).format(new Date(appointment.startsAt));
  const message = locale === "es"
    ? `Hola, ${appointment.clientName}. Te recordamos tu cita de ${appointment.serviceNameSnapshot} el ${date}. ¿Puedes confirmar tu asistencia?`
    : `Olá, ${appointment.clientName}. Lembramos do seu agendamento de ${appointment.serviceNameSnapshot} em ${date}. Pode confirmar sua presença?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
