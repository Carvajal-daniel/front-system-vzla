"use client";

import { useId } from "react";
import { Menu } from "@base-ui/react/menu";
import { CalendarClock, ClipboardList, Clock3, MoreHorizontal, Wallet } from "lucide-react";
import { isAppointmentPaid, isReadyToComplete, isUnpaidCompleted, whatsAppReminder } from "@/lib/agenda";
import { formatDateTimeInTimezone, formatPriceFromCents, formatTimeInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { agendaStrings } from "@/lib/i18n/agenda";
import { useTheme } from "@/lib/theme-context";
import type { Appointment, UpdatableAppointmentStatus } from "@/lib/types/appointment";
import type { PaymentMethod } from "@/lib/types/finance";
import { AgendaDialog, ProfessionalAvatar } from "./agenda-controls";
import type { AgendaPerson } from "./agenda-controls";
import { AgendaStatusBadge, PaidBadge } from "./agenda-status";

export function getClientInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words.at(-1)![0]}` : words[0]?.slice(0, 2) ?? "?").toUpperCase();
}

export type AgendaPayment = {
  appointmentId: string; currency: string; collectedInCents: number; netInCents: number;
  openInCents: number; canCollect: boolean; methods: PaymentMethod[];
};

type AppointmentActions = {
  onStatusChange: (status: UpdatableAppointmentStatus) => void;
  onCancel: () => void;
  onReschedule?: () => void;
};

export type AgendaItemProps = {
  appointment: Appointment; timezone: string; currency: string; person?: AgendaPerson; now: number;
  busy: boolean; actions: AppointmentActions; payment?: AgendaPayment; paymentError?: boolean;
  onPayments?: () => void; commissionLabel?: string;
};

function AgendaActions({ appointment, now, timezone, busy, actions, inline }: AgendaItemProps & { inline?: boolean }) {
  const { locale, t } = useLocale();
  const { mode, palette } = useTheme();
  const hintId = useId();
  const { status, endsAt } = appointment;
  if (status !== "PENDING" && status !== "CONFIRMED") return null;

  const blocked = !isReadyToComplete(appointment, now);
  const hint = agendaStrings(locale).endHint(formatTimeInTimezone(endsAt, timezone, locale));
  const endAction = () => { if (Date.now() >= Date.parse(endsAt)) actions.onStatusChange("COMPLETED"); };
  const options = status === "PENDING"
    ? [{ name: t.common.actionConfirm, run: () => actions.onStatusChange("CONFIRMED") }]
    : [{ name: t.common.actionComplete, run: endAction, blocked, hint },
      { name: t.common.actionNoShow, run: () => actions.onStatusChange("NO_SHOW") }];
  if (actions.onReschedule) options.push({ name: t.owner.reschedule, run: actions.onReschedule });
  options.push({ name: t.common.actionCancel, run: actions.onCancel });

  if (inline) return <div className="flex flex-wrap gap-2">
    {options.map((option) => <button key={option.name} type="button" disabled={busy || option.blocked} onClick={option.run}
      aria-describedby={option.blocked ? hintId : undefined} title={option.blocked ? option.hint : undefined}
      className="cursor-pointer rounded-lg border border-border-subtle bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-accent disabled:cursor-not-allowed disabled:opacity-55">
      {option.name}
    </button>)}
    {status === "CONFIRMED" && blocked && <p id={hintId} className="w-full text-xs text-ink-secondary">{hint}</p>}
  </div>;

  return <Menu.Root>
    <Menu.Trigger disabled={busy} aria-label={t.common.quickActionsLabel} className="relative z-10 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-secondary hover:bg-subtle hover:text-ink disabled:cursor-not-allowed data-disabled:cursor-not-allowed">
      <MoreHorizontal size={19} />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner align="end" sideOffset={6} className="z-80">
        <Menu.Popup data-palette={palette} data-theme={mode} className={`${mode === "dark" ? "dark" : ""} w-53 rounded-xl border border-border-subtle bg-surface p-1.5 text-ink shadow-xl outline-none`}>
          {options.map((option) => <Menu.Item key={option.name} disabled={busy || option.blocked} onClick={option.run}
            aria-describedby={option.blocked ? hintId : undefined} className="cursor-pointer rounded-lg px-2.5 py-2 text-xs font-medium outline-none data-highlighted:bg-accent-soft data-disabled:cursor-not-allowed data-disabled:text-ink-muted">
            {option.name}
          </Menu.Item>)}
          {status === "CONFIRMED" && blocked && <p id={hintId} className="px-2.5 pb-2 text-[11px] text-ink-secondary">{hint}</p>}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>;
}

function AgendaPaymentState({ appointment, payment, paymentError, onPayments }: Pick<AgendaItemProps, "appointment" | "payment" | "paymentError" | "onPayments">) {
  const { locale, t } = useLocale();
  const copy = agendaStrings(locale);
  if (!onPayments) return null;
  const settled = isAppointmentPaid(payment);
  const unpaidCompleted = isUnpaidCompleted(appointment, payment);
  const format = (amount: number) => formatPriceFromCents(amount, locale, payment?.currency);
  return <div className="relative z-10 flex flex-wrap items-center gap-2 text-xs">
    {paymentError && <span className="text-ink-secondary">{copy.failedPaymentStatus}</span>}
    {settled && payment && <PaidBadge label={`${copy.paid} · ${format(payment.collectedInCents)}`} />}
    {unpaidCompleted && <span className="rounded-md bg-[var(--status-warning-bg)] px-2 py-1 font-semibold text-[var(--status-warning-ink)]">{copy.unpaidCompleted}</span>}
    {payment && !settled && payment.collectedInCents > 0 && <span className="font-medium text-ink-secondary">{copy.received} {format(payment.collectedInCents)}</span>}
    {payment && !settled && payment.openInCents > 0 && <span className="font-medium text-ink-secondary">{copy.balance} {format(payment.openInCents)}</span>}
    {payment && payment.methods.length > 0 && <span className="text-ink-secondary">{payment.methods.map((method) => t.finance.paymentMethods[method]).join(" + ")}</span>}
    <button type="button" onClick={onPayments}
      className={`inline-flex min-h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-accent ${unpaidCompleted ? "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-ink)] hover:underline" : "border-border-subtle text-accent hover:bg-accent-soft"}`}>
      <Wallet size={13} aria-hidden="true" />{settled ? copy.viewReceipt : unpaidCompleted || payment?.canCollect ? t.finance.registerReceipt : t.finance.paymentHistory}
    </button>
  </div>;
}

export function WhatsAppLink({ appointment, timezone }: Pick<AgendaItemProps, "appointment" | "timezone">) {
  const { locale } = useLocale();
  const copy = agendaStrings(locale);
  const link = whatsAppReminder(appointment, locale, timezone);
  if (!link) return null;
  return <a href={link} target="_blank" rel="noopener noreferrer" title={copy.whatsapp} aria-label={copy.whatsapp} data-agenda-quick-action
    className="relative z-10 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border border-[#25D366]/35! bg-[#25D366]/12! text-[#25D366]! hover:ring-1 hover:ring-[#25D366]/50">
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.5 12A8.5 8.5 0 0 1 8 19.5l-4.5 1 1.1-4.4A8.5 8.5 0 1 1 20.5 12Z" />
      <path d="M8.7 8.2c-.6 0-1 .7-1 1.4 0 2.4 3 5.7 5.7 5.9.9 0 1.8-.5 1.9-1.2l-1.9-1.1-.8.8c-1.5-.6-2.7-1.9-3.1-3.1l.6-.8-.8-1.7Z" />
    </svg>
  </a>;
}

export function AgendaCard({ onDetails, ...props }: AgendaItemProps & { onDetails: () => void }) {
  const { locale, t } = useLocale();
  const copy = agendaStrings(locale);
  const { appointment, timezone, currency, person, commissionLabel } = props;
  const start = formatTimeInTimezone(appointment.startsAt, timezone, locale);
  const end = formatTimeInTimezone(appointment.endsAt, timezone, locale);
  return <article id={`appointment-card-${appointment.id}`} data-agenda-status={appointment.status} data-agenda-card
    className="relative space-y-3 rounded-xl border border-s-4 border-border-subtle bg-surface p-3.5 sm:p-4">
    <button type="button" onClick={onDetails} aria-label={`${copy.openDetails} · ${appointment.clientName} · ${appointment.serviceNameSnapshot}`}
      className="absolute inset-0 z-1 cursor-pointer rounded-xl focus-visible:outline-2 focus-visible:outline-accent" />
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 space-y-1">
        <h4 className="truncate text-sm font-semibold text-ink">{appointment.serviceNameSnapshot}</h4>
        <p className="text-xs font-medium text-ink-secondary tabular-nums">{start} – {end} · {formatPriceFromCents(appointment.servicePriceInCentsSnapshot, locale, currency)} {commissionLabel && <span className="text-accent">· {commissionLabel}</span>}</p>
      </div>
      <AgendaActions {...props} />
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <AgendaStatusBadge status={appointment.status} label={t.status[appointment.status]} />
      {isReadyToComplete(appointment, props.now) && <button type="button" disabled={props.busy}
        onClick={() => props.actions.onStatusChange("COMPLETED")}
        className="relative z-10 inline-flex min-h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-soft px-2 text-xs font-semibold text-ink hover:border-accent focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55">
        <Clock3 size={13} aria-hidden="true" />{copy.endedComplete}
      </button>}
      {person && <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-secondary"><ProfessionalAvatar person={person} className="size-5" />{person.name}</span>}
    </div>
    <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
      <div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{appointment.clientName}</p><p className="truncate text-xs text-ink-secondary tabular-nums">{appointment.clientPhone}</p></div>
      <WhatsAppLink appointment={appointment} timezone={timezone} />
    </div>
    {appointment.notes && <p className="flex items-center gap-1.5 text-xs text-ink-secondary"><ClipboardList size={13} className="shrink-0 text-accent" /><span className="truncate">{appointment.notes}</span></p>}
    {appointment.cancellationReason && <p className="truncate text-xs text-[var(--status-danger-ink)]">{appointment.cancellationReason}</p>}
    <AgendaPaymentState {...props} />
  </article>;
}

export function AgendaAppointmentDetails({ onClose, error, ...props }: AgendaItemProps & { onClose: () => void; error?: string }) {
  const { locale, t } = useLocale();
  const copy = agendaStrings(locale);
  const { appointment, timezone, currency, person } = props;
  const period = `${formatDateTimeInTimezone(appointment.startsAt, timezone, locale)} – ${formatTimeInTimezone(appointment.endsAt, timezone, locale)}`;

  return <AgendaDialog centered title={copy.openDetails} onClose={onClose}>
    <div className="space-y-5">
      <div className="rounded-2xl border border-border-subtle bg-subtle/50 p-4">
        <h3 className="text-lg font-semibold text-ink">{appointment.serviceNameSnapshot}</h3>
        <p className="mt-1.5 flex items-center gap-2 text-xs text-ink-secondary"><CalendarClock size={15} className="shrink-0 text-accent" />{period}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2"><AgendaStatusBadge status={appointment.status} label={t.status[appointment.status]} />
          <span className="text-sm font-semibold text-accent">{formatPriceFromCents(appointment.servicePriceInCentsSnapshot, locale, currency)}</span></div>
      </div>
      <dl className="space-y-4 text-sm">
        <div><dt className="text-xs font-semibold text-ink-secondary">{copy.client}</dt><dd className="mt-1 font-semibold">{appointment.clientName}</dd>
          <dd className="flex items-center gap-2 text-ink-secondary"><span className="tabular-nums">{appointment.clientPhone}</span><WhatsAppLink appointment={appointment} timezone={timezone} /></dd></div>
        {person && <div><dt className="text-xs font-semibold text-ink-secondary">{copy.professional}</dt>
          <dd className="mt-1 flex items-center gap-2"><ProfessionalAvatar person={person} />{person.name}</dd></div>}
        <div><dt className="text-xs font-semibold text-ink-secondary">{copy.notes}</dt>
          <dd className="mt-1 whitespace-pre-wrap wrap-break-word rounded-xl bg-subtle p-3 text-ink">{appointment.notes || copy.noNotes}</dd></div>
        {appointment.cancellationReason && <div><dt className="text-xs font-semibold text-ink-secondary">{t.common.cancellationReasonTag}</dt><dd className="mt-1 text-[var(--status-danger-ink)]">{appointment.cancellationReason}</dd></div>}
        {props.onPayments && <div><dt className="mb-2 text-xs font-semibold text-ink-secondary">{copy.payment}</dt><dd><AgendaPaymentState {...props} /></dd></div>}
      </dl>
      <AgendaActions {...props} inline />
      {error && <p role="alert" className="rounded-xl bg-[var(--status-danger-bg)] p-3 text-xs text-[var(--status-danger-ink)]">{error}</p>}
    </div>
  </AgendaDialog>;
}
