"use client";

import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Clock3,
  Edit,
  ExternalLink,
  History,
  Info,
  MoreHorizontal,
  Phone,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  Wallet,
  XCircle,
} from "lucide-react";
import { isAppointmentPaid, isReadyToComplete, isUnpaidCompleted, whatsAppReminder } from "@/lib/agenda";
import type { ReminderSettings } from "@/lib/company-settings";
import { formatDateTimeInTimezone, formatPriceFromCents, formatTimeInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { agendaStrings } from "@/lib/i18n/agenda";
import { useTheme } from "@/lib/theme-context";
import type { Appointment, AppointmentStatus, UpdatableAppointmentStatus } from "@/lib/types/appointment";
import type { PaymentMethod } from "@/lib/types/finance";
import { AgendaDialog, ProfessionalAvatar } from "./agenda-controls";
import type { AgendaPerson } from "./agenda-controls";
import { AgendaStatusBadge, PaidBadge } from "./agenda-status";
import { getCanonicalClientId } from "@/lib/use-clients";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

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
  onPayments?: () => void; commissionLabel?: string; isFirstVisit?: boolean;
  companyName?: string; reminders?: ReminderSettings | null; bookingAppUrl?: string;
};

export type HoverCardAnchor = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

const HOVER_HEADER_COLORS: Record<AppointmentStatus, string> = {
  CONFIRMED: "bg-emerald-600",
  COMPLETED: "bg-emerald-600",
  PENDING: "bg-amber-500",
  CANCELED: "bg-rose-600",
  NO_SHOW: "bg-orange-500",
};

function formatScheduledDateTime(
  iso: string,
  timezone: string,
  locale: Parameters<typeof formatTimeInTimezone>[2],
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const dayMonth = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  const time = formatTimeInTimezone(iso, timezone, locale);
  return `${dayMonth} às ${time}`;
}

/**
 * Card flutuante rico (estilo Gendo) exibido no hover do agendamento via portal em document.body
 * com posicionamento fixed e z-index alto para nunca ficar cortado ou oculto pela grade.
 */
export function AppointmentHoverCard({
  appointment,
  anchor,
  timezone,
  person,
  payment,
  isFirstVisit = false,
}: {
  appointment: Appointment;
  anchor: HoverCardAnchor;
  timezone: string;
  person?: AgendaPerson;
  payment?: AgendaPayment;
  isFirstVisit?: boolean;
}) {
  const { locale, t } = useLocale();
  const { mode, palette } = useTheme();
  const start = formatTimeInTimezone(appointment.startsAt, timezone, locale);
  const end = formatTimeInTimezone(appointment.endsAt, timezone, locale);

  if (typeof document === "undefined") return null;

  const settled = isAppointmentPaid(payment) || (appointment.status === "COMPLETED" && (payment?.openInCents ?? 0) === 0);
  const statusHint =
    appointment.status === "CANCELED"
      ? "Agendamento cancelado"
      : appointment.status === "NO_SHOW"
        ? "Cliente não compareceu ao atendimento"
        : settled
          ? "Atendimento finalizado e pago"
          : 'Finalize o serviço clicando em "Cobrar Agora" e efetue o pagamento';

  // Calcula posição fixed respeitando os limites do viewport para nunca cortar o card
  const cardWidth = 260;
  const estimatedHeight = 230;
  const margin = 12;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  let left = anchor.right + 10;
  if (left + cardWidth > vw - margin) {
    left = anchor.left - cardWidth - 10;
  }
  if (left < margin) {
    left = Math.max(margin, Math.min(anchor.left, vw - cardWidth - margin));
  }

  const top = Math.max(margin, Math.min(anchor.top, vh - estimatedHeight - margin));

  return createPortal(
    <div
      role="tooltip"
      data-palette={palette}
      data-theme={mode}
      className={`${mode === "dark" ? "dark" : ""} w-[260px] overflow-hidden rounded-xl border border-border-strong bg-white dark:bg-surface text-xs shadow-2xl animate-in fade-in-0 zoom-in-95 duration-120`}
      style={{ position: "fixed", zIndex: 9999, top, left, pointerEvents: "none" }}
    >
      {/* Cabeçalho colorido conforme status */}
      <div className={`px-3.5 py-2.5 ${HOVER_HEADER_COLORS[appointment.status]}`}>
        <p className="truncate text-xs font-bold text-white">{appointment.clientName}</p>
      </div>

      {/* Corpo com informações estruturadas */}
      <div className="space-y-1.5 bg-white dark:bg-surface px-3.5 py-3 text-ink-secondary">
        <p className="font-bold leading-snug text-ink">{appointment.serviceNameSnapshot}</p>
        <p className="truncate">
          <span className="font-semibold text-ink">Com:</span> {person?.name ?? "—"}
        </p>
        <p>
          <span className="font-semibold text-ink">Situação:</span> {t.status[appointment.status]}
        </p>

        {isFirstVisit && (
          <p className="pt-0.5 text-[11px] italic text-ink-muted">
            Cliente agendando pela primeira vez
          </p>
        )}

        <div className="mt-2 flex items-start gap-1.5 border-t border-border-subtle pt-2 text-[11px] leading-snug text-ink-secondary">
          <Info size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
          <span>{statusHint}</span>
        </div>
      </div>

      {/* Rodapé destacado com intervalo de horário */}
      <div className="flex items-center gap-1.5 border-t border-border-subtle bg-subtle/75 px-3.5 py-2 text-[11px] font-semibold text-ink tabular-nums">
        <Clock size={13} className="shrink-0 text-ink-secondary" aria-hidden="true" />
        <span>
          {start} até {end}
        </span>
      </div>
    </div>,
    document.body,
  );
}

function AgendaActions({ appointment, now, timezone, busy, actions, inline }: AgendaItemProps & { inline?: boolean }) {
  const { locale, t } = useLocale();
  const { mode, palette } = useTheme();
  const hintId = useId();
  const { status, startsAt } = appointment;
  if (status !== "PENDING" && status !== "CONFIRMED") return null;

  const startTimeMs = Date.parse(startsAt);
  const blocked = !Number.isNaN(startTimeMs) && (now || Date.now()) < startTimeMs;
  const hint = `Disponível apenas após a data e horário agendados (${formatScheduledDateTime(startsAt, timezone, locale)})`;
  const endAction = () => { if (Number.isNaN(startTimeMs) || Date.now() >= startTimeMs) actions.onStatusChange("COMPLETED"); };
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

export function WhatsAppLink({
  appointment,
  timezone,
  person,
  companyName,
  reminders,
  bookingAppUrl,
}: Pick<AgendaItemProps, "appointment" | "timezone" | "person" | "companyName" | "reminders" | "bookingAppUrl">) {
  const { locale } = useLocale();
  const copy = agendaStrings(locale);
  const link = whatsAppReminder(appointment, locale, timezone, "reminder", {
    companyName,
    professionalName: person?.name,
    reminders,
    appUrl: bookingAppUrl,
  });
  if (!link) return null;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      title={copy.whatsapp}
      aria-label={copy.whatsapp}
      data-agenda-quick-action
      className="relative z-10 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full bg-[#25D366] text-white shadow-xs hover:scale-105 transition-transform"
    >
      <WhatsAppIcon className="size-4" />
    </a>
  );
}

export function AgendaCard({ onDetails, ...props }: AgendaItemProps & { onDetails: () => void }) {
  const { locale, t } = useLocale();
  const copy = agendaStrings(locale);
  const { appointment, timezone, currency, person, commissionLabel, payment, isFirstVisit } = props;
  const start = formatTimeInTimezone(appointment.startsAt, timezone, locale);
  const end = formatTimeInTimezone(appointment.endsAt, timezone, locale);
  const [hoverAnchor, setHoverAnchor] = useState<HoverCardAnchor | null>(null);

  return <article id={`appointment-card-${appointment.id}`} data-agenda-status={appointment.status} data-agenda-card
    onPointerEnter={(e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setHoverAnchor({ top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right });
    }}
    onPointerLeave={() => setHoverAnchor(null)}
    className="group/card relative space-y-3 rounded-xl border border-s-4 border-border-subtle bg-surface p-3.5 sm:p-4">
    {hoverAnchor && (
      <AppointmentHoverCard
        appointment={appointment}
        anchor={hoverAnchor}
        timezone={timezone}
        person={person}
        payment={payment}
        isFirstVisit={isFirstVisit}
      />
    )}

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
      <WhatsAppLink
        appointment={appointment}
        timezone={timezone}
        person={person}
        companyName={props.companyName}
        reminders={props.reminders}
        bookingAppUrl={props.bookingAppUrl}
      />
    </div>
    {appointment.notes && <p className="flex items-center gap-1.5 text-xs text-ink-secondary"><ClipboardList size={13} className="shrink-0 text-accent" /><span className="truncate">{appointment.notes}</span></p>}
    {appointment.cancellationReason && <p className="truncate text-xs text-[var(--status-danger-ink)]">{appointment.cancellationReason}</p>}
    <AgendaPaymentState {...props} />
  </article>;
}

export type QuickRegisterClientInput = {
  name: string;
  phone: string;
  document?: string;
  email?: string;
};

export function AgendaAppointmentDetails({
  onClose,
  error,
  isRegisteredClient,
  onRegisterNewClient,
  ...props
}: AgendaItemProps & {
  onClose: () => void;
  error?: string;
  isRegisteredClient?: boolean;
  onRegisterNewClient?: (data: QuickRegisterClientInput) => void;
}) {
  const { locale, t } = useLocale();
  const copy = agendaStrings(locale);
  const { appointment, timezone, currency, person, actions, busy, onPayments } = props;
  const router = useRouter();
  const period = `${formatDateTimeInTimezone(appointment.startsAt, timezone, locale)} – ${formatTimeInTimezone(appointment.endsAt, timezone, locale)}`;

  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [editDropdownOpen, setEditDropdownOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewTab, setViewTab] = useState<"services" | "history">("services");

  // Estado do mini-modal de cadastro rápido de cliente na base CRM
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [registeredAppointmentId, setRegisteredAppointmentId] = useState<string | null>(null);
  const [registerName, setRegisterName] = useState(appointment.clientName);
  const [registerPhone, setRegisterPhone] = useState(appointment.clientPhone ?? "");
  const [registerDocument, setRegisterDocument] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerError, setRegisterError] = useState("");

  const canRegisterClient = typeof isRegisteredClient === "boolean" && Boolean(onRegisterNewClient);
  const effectiveIsRegistered = Boolean(isRegisteredClient) || registeredAppointmentId === appointment.id;

  const openRegisterModal = () => {
    setRegisterName(appointment.clientName);
    setRegisterPhone(appointment.clientPhone ?? "");
    setRegisterDocument("");
    setRegisterEmail("");
    setRegisterError("");
    setRegisterModalOpen(true);
  };

  const handleRegisterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = registerName.trim();
    const trimmedPhone = registerPhone.trim();
    const phoneDigits = trimmedPhone.replace(/\D/g, "");

    if (!trimmedName) {
      setRegisterError("Informe o nome do cliente.");
      return;
    }
    if (phoneDigits.length < 8) {
      setRegisterError("Informe um telefone/WhatsApp válido com no mínimo 8 dígitos.");
      return;
    }

    onRegisterNewClient?.({
      name: trimmedName,
      phone: trimmedPhone,
      document: registerDocument.trim() || undefined,
      email: registerEmail.trim() || undefined,
    });
    setRegisteredAppointmentId(appointment.id);
    setRegisterModalOpen(false);
  };

  // Dados estruturados para o modal "Visualizar Agendamento"
  const startDate = new Date(appointment.startsAt);
  const isValidStart = !Number.isNaN(startDate.getTime());
  const monthShort = isValidStart
    ? new Intl.DateTimeFormat(locale, { timeZone: timezone, month: "short" })
        .format(startDate)
        .replace(/\.$/, "")
        .toUpperCase()
    : "---";
  const dayNumber = isValidStart
    ? new Intl.DateTimeFormat(locale, { timeZone: timezone, day: "2-digit" }).format(startDate)
    : "--";
  const startTimeLabel = formatTimeInTimezone(appointment.startsAt, timezone, locale);
  const endTimeLabel = formatTimeInTimezone(appointment.endsAt, timezone, locale);

  const historyEntries: {
    id: string;
    title: string;
    description: string;
    timestamp?: string;
    tone: "neutral" | "success" | "warning" | "danger" | "info";
  }[] = [
    {
      id: "created",
      title: "Agendamento criado",
      description: `${appointment.serviceNameSnapshot} agendado para ${appointment.clientName}${person ? ` com ${person.name}` : ""}.`,
      timestamp: formatDateTimeInTimezone(appointment.createdAt, timezone, locale),
      tone: "info",
    },
  ];

  if (appointment.updatedAt && appointment.updatedAt !== appointment.createdAt) {
    const statusDescription =
      appointment.status === "CONFIRMED"
        ? "Agendamento confirmado."
        : appointment.status === "COMPLETED"
          ? "Atendimento finalizado."
          : appointment.status === "NO_SHOW"
            ? "Cliente marcado como ausente."
            : appointment.status === "CANCELED"
              ? appointment.cancellationReason
                ? `Cancelado — Motivo: ${appointment.cancellationReason}`
                : "Agendamento cancelado."
              : `Situação atualizada para ${t.status[appointment.status]}.`;

    historyEntries.push({
      id: "status-update",
      title: `Status: ${t.status[appointment.status]}`,
      description: statusDescription,
      timestamp: formatDateTimeInTimezone(appointment.updatedAt, timezone, locale),
      tone:
        appointment.status === "CONFIRMED" || appointment.status === "COMPLETED"
          ? "success"
          : appointment.status === "CANCELED"
            ? "danger"
            : appointment.status === "NO_SHOW"
              ? "warning"
              : "neutral",
    });
  } else {
    historyEntries.push({
      id: "current-status",
      title: `Status atual: ${t.status[appointment.status]}`,
      description:
        appointment.status === "CANCELED" && appointment.cancellationReason
          ? `Motivo: ${appointment.cancellationReason}`
          : "Sem alterações posteriores de status.",
      timestamp: formatDateTimeInTimezone(appointment.createdAt, timezone, locale),
      tone:
        appointment.status === "CONFIRMED" || appointment.status === "COMPLETED"
          ? "success"
          : appointment.status === "CANCELED"
            ? "danger"
            : appointment.status === "NO_SHOW"
              ? "warning"
              : "neutral",
    });
  }

  if (props.payment) {
    const paid = isAppointmentPaid(props.payment);
    const methodsText =
      props.payment.methods.length > 0
        ? ` (${props.payment.methods.map((method) => t.finance.paymentMethods[method]).join(" + ")})`
        : "";
    historyEntries.push({
      id: "payment",
      title: paid ? "Cobrança liquidada" : "Cobrança / Pagamento",
      description: paid
        ? `Recebido ${formatPriceFromCents(props.payment.collectedInCents, locale, props.payment.currency)}${methodsText}.`
        : props.payment.collectedInCents > 0
          ? `Recebido ${formatPriceFromCents(props.payment.collectedInCents, locale, props.payment.currency)} · Saldo em aberto: ${formatPriceFromCents(props.payment.openInCents, locale, props.payment.currency)}${methodsText}.`
          : `Valor em aberto: ${formatPriceFromCents(props.payment.openInCents, locale, props.payment.currency)}.`,
      tone: paid ? "success" : "warning",
    });
  }

  if (appointment.notes) {
    historyEntries.push({
      id: "notes",
      title: "Observações do agendamento",
      description: appointment.notes,
      tone: "neutral",
    });
  }

  // Regra de negócio: o atendimento só pode ser finalizado após a data e horário agendados (startsAt)
  const startsAtMs = Date.parse(appointment.startsAt);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    setNowMs(Date.now());
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [appointment.startsAt]);

  const isBeforeStart = !Number.isNaN(startsAtMs) && nowMs < startsAtMs;
  const formattedSchedule = formatScheduledDateTime(appointment.startsAt, timezone, locale);
  const blockedFinishMessage = `Disponível apenas após a data e horário agendados (${formattedSchedule})`;

  const whatsAppLink = whatsAppReminder(appointment, locale, timezone, "reminder", {
    companyName: props.companyName,
    professionalName: person?.name,
    reminders: props.reminders,
    appUrl: props.bookingAppUrl,
  });

  // Ação 2: Finalizar e Faturar
  const handleCompleteAndInvoice = () => {
    if (!Number.isNaN(startsAtMs) && Date.now() < startsAtMs) return;
    actions.onStatusChange("COMPLETED");
    if (onPayments) {
      setTimeout(() => {
        onPayments();
      }, 350);
    }
  };

  return (
    <AgendaDialog centered title="Detalhes do Agendamento" onClose={onClose}>
      <div className="space-y-4">
        {/* Cabeçalho do Agendamento com Botão Editar */}
        <div className="rounded-2xl border border-border-subtle bg-subtle/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-ink truncate">
                {appointment.serviceNameSnapshot}
              </h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-secondary">
                <CalendarClock size={14} className="shrink-0 text-accent" />
                {period}
              </p>
            </div>

            {/* Dropdown de Edição (Cliente / Agendamento) */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setEditDropdownOpen((prev) => !prev)}
                className="flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:border-accent transition-colors"
              >
                <Edit size={13} />
                Editar
                <ChevronDown size={12} className={`transition-transform ${editDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {editDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-30 w-44 rounded-xl border border-border-subtle bg-surface p-1 shadow-lg text-xs space-y-0.5">
                  {actions.onReschedule && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditDropdownOpen(false);
                        actions.onReschedule?.();
                      }}
                      className="w-full text-left rounded-lg px-2.5 py-1.5 font-medium text-ink hover:bg-subtle transition-colors"
                    >
                      Editar Agendamento
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setEditDropdownOpen(false);
                      const clientId = getCanonicalClientId(appointment.clientPhone, appointment.clientName);
                      router.push(`/owner/clients/${clientId}`);
                    }}
                    className="w-full text-left rounded-lg px-2.5 py-1.5 font-medium text-ink hover:bg-subtle transition-colors flex items-center justify-between"
                  >
                    <span>Ficha do Cliente</span>
                    <ExternalLink size={12} className="text-ink-muted" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle/60 pt-3">
            <div className="flex items-center gap-2">
              <AgendaStatusBadge status={appointment.status} label={t.status[appointment.status]} />
              <span className="text-sm font-bold text-accent">
                {formatPriceFromCents(appointment.servicePriceInCentsSnapshot, locale, currency)}
              </span>
            </div>
            {person && (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
                <ProfessionalAvatar person={person} className="size-5" />
                {person.name}
              </span>
            )}
          </div>
        </div>

        {/* Informações do Cliente e Observações */}
        <div className="rounded-xl border border-border-subtle/70 bg-canvas/40 p-3 text-xs space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-semibold text-ink text-sm">{appointment.clientName}</p>
                {canRegisterClient && !effectiveIsRegistered && (
                  <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    Cliente não cadastrado
                  </span>
                )}
                {canRegisterClient && effectiveIsRegistered && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={11} aria-hidden="true" />
                    Cliente cadastrado na base
                  </span>
                )}
              </div>
              <p className="font-mono text-ink-muted">{appointment.clientPhone}</p>
            </div>
            {appointment.cancellationReason && (
              <span className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-500 border border-rose-500/20">
                Cancelado: {appointment.cancellationReason}
              </span>
            )}
          </div>

          {appointment.notes && (
            <p className="whitespace-pre-wrap rounded-lg bg-subtle p-2 text-ink text-[11px]">
              {appointment.notes}
            </p>
          )}

          {(props.onPayments || (canRegisterClient && !effectiveIsRegistered)) && (
            <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-border-subtle/50">
              {props.onPayments && <AgendaPaymentState {...props} />}
              {canRegisterClient && !effectiveIsRegistered && (
                <button
                  type="button"
                  onClick={openRegisterModal}
                  className="inline-flex min-h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-2.5 text-xs font-semibold text-accent hover:border-accent hover:bg-accent/15 transition-colors focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <UserPlus size={13} aria-hidden="true" />
                  + Cadastrar como novo cliente
                </button>
              )}
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* LISTA VERTICAL DE AÇÕES RÁPIDAS COM ÍCONES */}
        {/* ======================================================== */}
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
            Ações Rápidas
          </p>

          <div className="grid gap-2">
            {/* 1) Cobrar Agora */}
            {onPayments && (
              <button
                type="button"
                disabled={busy}
                onClick={onPayments}
                className="flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 transition-colors disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <Wallet size={16} />
                  Cobrar Agora
                </span>
                <span className="text-[10px] font-medium opacity-80">Registrar pagamento</span>
              </button>
            )}

            {/* 2) Finalizar e Faturar */}
            {appointment.status !== "COMPLETED" && appointment.status !== "CANCELED" && (
              <div className="space-y-1">
                <button
                  type="button"
                  disabled={busy || isBeforeStart}
                  onClick={isBeforeStart ? undefined : handleCompleteAndInvoice}
                  title={isBeforeStart ? blockedFinishMessage : undefined}
                  className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-colors ${
                    isBeforeStart
                      ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800/60 dark:text-slate-500 dark:border-slate-700"
                      : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    Finalizar e Faturar
                  </span>
                  <span className="text-[10px] font-medium opacity-80">Concluir atendimento</span>
                </button>
                {isBeforeStart && (
                  <p className="flex items-center gap-1.5 px-1 text-[11px] text-ink-muted">
                    <Clock size={12} className="shrink-0" aria-hidden="true" />
                    <span>{blockedFinishMessage}</span>
                  </p>
                )}
              </div>
            )}

            {appointment.status === "PENDING" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => actions.onStatusChange("CONFIRMED")}
                className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-cyan-500/20 disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-cyan-600 dark:text-cyan-400" aria-hidden="true" />
                  Confirmar Agendamento
                </span>
                <span className="text-[10px] text-ink-secondary">Confirmar horário</span>
              </button>
            )}

            {/* 3) Cliente Chegou (Marcar presença/CONFIRMED) */}
            {appointment.status === "PENDING" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => actions.onStatusChange("CONFIRMED")}
                className="flex w-full items-center justify-between rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5 text-xs font-semibold text-ink hover:border-accent transition-colors disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <UserCheck size={16} className="text-emerald-500" />
                  Cliente Chegou
                </span>
                <span className="text-[10px] text-ink-muted">Confirmar presença</span>
              </button>
            )}

            {/* 4) Cliente Faltou (NO_SHOW) */}
            {appointment.status !== "COMPLETED" && appointment.status !== "NO_SHOW" && appointment.status !== "CANCELED" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => actions.onStatusChange("NO_SHOW")}
                className="flex w-full items-center justify-between rounded-xl border border-border-subtle bg-surface px-3.5 py-2.5 text-xs font-semibold text-ink hover:border-accent transition-colors disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <UserX size={16} className="text-purple-500" />
                  Cliente Faltou
                </span>
                <span className="text-[10px] text-ink-muted">Marcar ausência</span>
              </button>
            )}

            {/* 5) Mais Opções (Acordeão Expansível) */}
            <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden">
              <button
                type="button"
                onClick={() => setMoreOptionsOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-ink-secondary hover:text-ink transition-colors"
              >
                <span className="flex items-center gap-2">
                  <MoreHorizontal size={16} />
                  Mais Opções
                </span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${moreOptionsOpen ? "rotate-180" : ""}`}
                />
              </button>

              {moreOptionsOpen && (
                <div className="border-t border-border-subtle p-2 space-y-1.5 bg-canvas/30 text-xs">
                  {appointment.status !== "CANCELED" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={actions.onCancel}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-rose-500 hover:bg-rose-500/10 transition-colors"
                    >
                      <XCircle size={14} />
                      Cancelar Agendamento
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={actions.onCancel}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-ink-muted hover:text-rose-500 hover:bg-subtle transition-colors"
                  >
                    <Trash2 size={14} />
                    Remover Agendamento
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* BOTÕES INFERIORES: VISUALIZAR, WHATSAPP E REGISTRO DE ALTERAÇÕES */}
        {/* ======================================================== */}
        <div className="grid gap-2 pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={() => {
              setViewTab("services");
              setViewModalOpen(true);
            }}
            className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/15 transition-colors"
          >
            <CalendarDays size={16} className="text-indigo-500 dark:text-indigo-400" aria-hidden="true" />
            Visualizar Agendamento
          </button>

          {whatsAppLink && (
            <a
              href={whatsAppLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2B9155] px-4 text-xs font-bold text-white shadow-xs hover:bg-[#237746] transition-colors"
            >
              <WhatsAppIcon className="size-4 text-white" />
              Enviar Mensagem WhatsApp
            </a>
          )}

          <button
            type="button"
            onClick={() => setAuditOpen((prev) => !prev)}
            className="flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3 text-xs font-semibold text-ink-secondary hover:text-ink hover:border-accent transition-colors"
          >
            <History size={14} />
            {auditOpen ? "Ocultar Registro de Alterações" : "Registro de Alterações"}
          </button>

          {auditOpen && (
            <div className="rounded-xl border border-border-subtle bg-canvas/60 p-3 text-xs space-y-1.5 text-ink-secondary animate-in fade-in duration-200">
              <div className="flex justify-between">
                <span>Criado em:</span>
                <span className="font-mono text-ink">
                  {formatDateTimeInTimezone(appointment.createdAt, timezone, locale)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Última atualização:</span>
                <span className="font-mono text-ink">
                  {formatDateTimeInTimezone(appointment.updatedAt, timezone, locale)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>ID do agendamento:</span>
                <span className="font-mono text-[10px] text-ink-muted">{appointment.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Status atual:</span>
                <span className="font-semibold text-ink">{appointment.status}</span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-[var(--status-danger-bg)] p-3 text-xs text-[var(--status-danger-ink)]"
          >
            {error}
          </p>
        )}
      </div>

      {viewModalOpen && (
        <AgendaDialog
          centered
          title="Agendamento"
          onClose={() => setViewModalOpen(false)}
        >
          <div className="space-y-5">
            {/* Abas no topo */}
            <div
              role="tablist"
              aria-label="Seções do agendamento"
              className="flex items-center gap-2 border-b border-border-subtle"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewTab === "services"}
                onClick={() => setViewTab("services")}
                className={`relative -mb-px cursor-pointer border-b-2 px-3 pb-2.5 text-xs font-semibold transition-colors ${
                  viewTab === "services"
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-ink-secondary hover:text-ink"
                }`}
              >
                Serviços
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewTab === "history"}
                onClick={() => setViewTab("history")}
                className={`relative -mb-px cursor-pointer border-b-2 px-3 pb-2.5 text-xs font-semibold transition-colors ${
                  viewTab === "history"
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-ink-secondary hover:text-ink"
                }`}
              >
                Histórico
              </button>
            </div>

            {viewTab === "services" ? (
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1.15fr)_auto_minmax(0,1.45fr)] sm:items-center">
                {/* Esquerda: Avatar circular com iniciais + Nome + Telefone */}
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    aria-hidden="true"
                    className="grid size-12 shrink-0 place-items-center rounded-full bg-indigo-500/12 text-sm font-bold text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/20"
                  >
                    {getClientInitials(appointment.clientName)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {appointment.clientName}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-xs text-ink-secondary tabular-nums">
                      <Phone size={12} className="shrink-0 text-ink-muted" aria-hidden="true" />
                      <span>{appointment.clientPhone || "Sem telefone"}</span>
                    </p>
                  </div>
                </div>

                {/* Centro: Card compacto de data (Mês abreviado + Dia grande) */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-border-subtle bg-subtle/60 px-4 py-2.5 text-center shadow-2xs sm:min-w-[72px]">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {monthShort}
                  </span>
                  <span className="mt-0.5 text-2xl font-bold leading-none text-ink tabular-nums">
                    {dayNumber}
                  </span>
                </div>

                {/* Direita: Card bordado com Serviço, Horário/Duração e Profissional */}
                <div className="min-w-0 space-y-2 rounded-xl border border-border-subtle bg-surface p-3.5 shadow-2xs">
                  <p className="truncate text-sm font-bold text-ink">
                    {appointment.serviceNameSnapshot}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-ink-secondary tabular-nums">
                    <Clock size={13} className="shrink-0 text-ink-muted" aria-hidden="true" />
                    <span>
                      {startTimeLabel} - {endTimeLabel} ({appointment.serviceDurationMinutesSnapshot}min)
                    </span>
                  </p>
                  <div className="flex items-center gap-2 border-t border-border-subtle/70 pt-2">
                    {person ? (
                      <ProfessionalAvatar person={person} className="size-6" />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="grid size-6 shrink-0 place-items-center rounded-full bg-subtle text-[10px] font-semibold text-ink-secondary"
                      >
                        ?
                      </span>
                    )}
                    <span className="truncate text-xs font-medium text-ink">
                      {person?.name ?? "—"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ol className="relative space-y-3 border-s border-border-subtle ps-4">
                  {historyEntries.map((item) => {
                    const dotColor =
                      item.tone === "success"
                        ? "bg-emerald-500"
                        : item.tone === "danger"
                          ? "bg-rose-500"
                          : item.tone === "warning"
                            ? "bg-amber-500"
                            : item.tone === "info"
                              ? "bg-indigo-500"
                              : "bg-ink-muted";
                    return (
                      <li key={item.id} className="relative">
                        <span
                          aria-hidden="true"
                          className={`absolute -start-[21px] top-1.5 size-2.5 rounded-full ring-4 ring-surface ${dotColor}`}
                        />
                        <div className="rounded-xl border border-border-subtle bg-canvas/50 p-3 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-bold text-ink">{item.title}</p>
                            {item.timestamp && (
                              <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                                {item.timestamp}
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap text-xs text-ink-secondary">
                            {item.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <div className="flex items-center justify-between rounded-xl border border-border-subtle/70 bg-subtle/40 px-3 py-2 text-[11px] text-ink-muted">
                  <span>ID do agendamento</span>
                  <span className="font-mono">{appointment.id}</span>
                </div>
              </div>
            )}
          </div>
        </AgendaDialog>
      )}

      {registerModalOpen && (
        <AgendaDialog
          centered
          title="Cadastrar novo cliente"
          onClose={() => setRegisterModalOpen(false)}
        >
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <p className="text-xs text-ink-secondary">
              Salve este cliente na base oficial do CRM para acompanhar histórico, ficha e atendimentos futuros.
            </p>

            <label className="block space-y-1 text-xs font-semibold text-ink">
              <span>Nome *</span>
              <input
                type="text"
                required
                autoFocus
                value={registerName}
                onChange={(event) => {
                  setRegisterName(event.target.value);
                  if (registerError) setRegisterError("");
                }}
                placeholder="Nome completo do cliente"
                className="block min-h-10 w-full rounded-xl border border-border-subtle bg-surface px-3 text-sm font-normal text-ink outline-none focus-visible:border-accent"
              />
            </label>

            <label className="block space-y-1 text-xs font-semibold text-ink">
              <span>WhatsApp / Telefone *</span>
              <input
                type="tel"
                required
                value={registerPhone}
                onChange={(event) => {
                  setRegisterPhone(event.target.value);
                  if (registerError) setRegisterError("");
                }}
                placeholder="+55 11 99999-9999"
                className="block min-h-10 w-full rounded-xl border border-border-subtle bg-surface px-3 text-sm font-normal text-ink outline-none focus-visible:border-accent"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs font-semibold text-ink">
                <span>CPF / C.I. (opcional)</span>
                <input
                  type="text"
                  value={registerDocument}
                  onChange={(event) => setRegisterDocument(event.target.value)}
                  placeholder="000.000.000-00"
                  className="block min-h-10 w-full rounded-xl border border-border-subtle bg-surface px-3 text-sm font-normal text-ink outline-none focus-visible:border-accent"
                />
              </label>

              <label className="block space-y-1 text-xs font-semibold text-ink">
                <span>E-mail (opcional)</span>
                <input
                  type="email"
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  placeholder="cliente@email.com"
                  className="block min-h-10 w-full rounded-xl border border-border-subtle bg-surface px-3 text-sm font-normal text-ink outline-none focus-visible:border-accent"
                />
              </label>
            </div>

            {registerError && (
              <p
                role="alert"
                className="rounded-lg bg-[var(--status-danger-bg)] px-3 py-2 text-xs text-[var(--status-danger-ink)]"
              >
                {registerError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setRegisterModalOpen(false)}
                className="min-h-9 cursor-pointer rounded-xl border border-border-subtle bg-surface px-3.5 text-xs font-semibold text-ink hover:bg-subtle transition-colors"
              >
                {copy.cancel}
              </button>
              <button
                type="submit"
                className="min-h-9 cursor-pointer rounded-xl bg-accent px-4 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors"
              >
                Salvar Cliente
              </button>
            </div>
          </form>
        </AgendaDialog>
      )}
    </AgendaDialog>
  );
}
