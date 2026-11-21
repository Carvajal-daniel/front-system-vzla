"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Loader2,
  MoreVertical,
  UserX,
  XCircle,
  Wallet,
} from "lucide-react";
import {
  formatDuration,
  formatPriceFromCents,
  formatTimeInTimezone,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type {
  Appointment,
  AppointmentStatus,
  UpdatableAppointmentStatus,
} from "@/lib/types/appointment";
import {
  appointmentStatusTone,
  StatusBadge,
} from "@/components/ui/status-badge";

const PILL_CLASS_BY_STATUS: Record<AppointmentStatus, string> = {
  CONFIRMED: "bg-[#0D9488] text-white",
  PENDING: "bg-[#F59E0B] text-white",
  COMPLETED: "bg-[#4F46E5] text-white",
  CANCELED: "bg-[#E11D48] text-white",
  NO_SHOW: "bg-[#64748B] text-white",
};

const AVATAR_TINTS = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-amber-500/15 text-amber-800 dark:text-amber-300",
];

export function getClientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getAvatarTint(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

export function formatShortDayMonth(
  iso: string,
  timeZone: string,
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

interface AgendaCardProps {
  appointment: Appointment;
  timezone: string;
  currency?: string;
  onOpenPayments?: () => void;
  collaboratorName?: string;
  collaboratorAvatarUrl?: string | null;
  commissionLabel?: string;
  busy: boolean;
  highlighted: boolean;
  onStatusChange: (
    appointmentId: string,
    nextStatus: UpdatableAppointmentStatus,
  ) => void;
  onRequestCancel: (appointment: Appointment) => void;
  onReschedule?: (appointment: Appointment) => void;
}

/**
 * Card de agendamento refinado: pill superior colorido por status, hierarquia
 * tipográfica equilibrada (medium/semibold), foto real do profissional, exibição
 * discreta do motivo de cancelamento e ações rápidas apenas em turnos ativos.
 */
export function AgendaCard({
  appointment,
  timezone,
  currency,
  onOpenPayments,
  collaboratorName,
  collaboratorAvatarUrl,
  commissionLabel,
  busy,
  highlighted,
  onStatusChange,
  onRequestCancel,
  onReschedule,
}: AgendaCardProps) {
  const { locale, t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [observedNow, setObservedNow] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const completionHintId = useId();
  const startTimeMs = Date.parse(appointment.startsAt);
  const isFuture = startTimeMs > observedNow;

  const isActive =
    appointment.status === "PENDING" || appointment.status === "CONFIRMED";

  useEffect(() => {
    if (!menuOpen) return;
    let timer: ReturnType<typeof setTimeout>;
    function checkStart() {
      const now = Date.now();
      if (now >= startTimeMs) {
        setObservedNow(now);
        return;
      }
      timer = setTimeout(checkStart, Math.min(startTimeMs - now, 2_147_483_647));
    }
    timer = setTimeout(checkStart, 0);
    return () => clearTimeout(timer);
  }, [menuOpen, startTimeMs]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [menuOpen]);

  const dateShort = formatShortDayMonth(appointment.startsAt, timezone, locale);
  const startTime = formatTimeInTimezone(appointment.startsAt, timezone, locale);
  const endTime = formatTimeInTimezone(appointment.endsAt, timezone, locale);

  return (
    <article
      id={`appointment-card-${appointment.id}`}
      className={[
        "card-interactive relative flex flex-col justify-between rounded-2xl border bg-surface p-5 transition-all duration-300",
        highlighted
          ? "border-accent ring-2 ring-accent ring-offset-2 ring-offset-canvas shadow-lg shadow-accent/20 animate-pulse"
          : "border-border-subtle",
      ].join(" ")}
    >
      {/* Topo: Pill de data/horário + menu de ações (somente PENDING/CONFIRMED) */}
      <div className="flex items-start justify-between gap-2">
        <span
          className={[
            "inline-flex items-center rounded-full px-3 py-1 font-mono text-[11px] font-medium tracking-tight tabular-nums",
            PILL_CLASS_BY_STATUS[appointment.status],
          ].join(" ")}
        >
          {dateShort}, {startTime} - {endTime}
        </span>

        {isActive && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setObservedNow(Date.now());
                setMenuOpen((prev) => !prev);
              }}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={t.common.quickActionsLabel}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-subtle hover:text-ink cursor-pointer"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {menuOpen && (
              <div
                role="menu"
                aria-label={t.common.quickActionsLabel}
                className="absolute right-0 top-9 z-30 w-48 rounded-xl border border-border-subtle bg-surface p-1.5 shadow-xl space-y-0.5"
              >
                {appointment.status === "PENDING" && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onStatusChange(appointment.id, "CONFIRMED");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-ink hover:bg-subtle cursor-pointer"
                  >
                    <Check
                      className="h-3.5 w-3.5 text-accent"
                      aria-hidden="true"
                    />
                    {t.common.actionConfirm}
                  </button>
                )}

                {(isFuture || appointment.status === "CONFIRMED") && <button
                  type="button"
                  role="menuitem"
                  aria-disabled={isFuture}
                  aria-describedby={isFuture ? completionHintId : undefined}
                  onClick={() => {
                    if (startTimeMs > Date.now()) return;
                    setMenuOpen(false);
                    onStatusChange(appointment.id, "COMPLETED");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-ink hover:bg-subtle cursor-pointer aria-disabled:cursor-not-allowed aria-disabled:text-ink-muted"
                >
                  <CheckCircle2
                    className="h-3.5 w-3.5 text-[var(--status-success-ink)]"
                    aria-hidden="true"
                  />
                  {t.common.actionComplete}
                </button>}
                {isFuture && (
                  <p id={completionHintId} className="px-2.5 pb-2 text-[11px] leading-snug text-ink-muted">
                    {t.common.completeAfterStart}
                  </p>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onStatusChange(appointment.id, "NO_SHOW");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-ink hover:bg-subtle cursor-pointer"
                >
                  <UserX
                    className="h-3.5 w-3.5 text-[var(--status-warning-ink)]"
                    aria-hidden="true"
                  />
                  {t.common.actionNoShow}
                </button>

                {onReschedule && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onReschedule(appointment);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-ink hover:bg-subtle cursor-pointer"
                  >
                    <CalendarClock
                      className="h-3.5 w-3.5 text-ink-secondary"
                      aria-hidden="true"
                    />
                    {t.owner.reschedule}
                  </button>
                )}

                <div className="my-1 border-t border-border-subtle" />

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onRequestCancel(appointment);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[var(--status-danger-ink)] hover:bg-[var(--status-danger-bg)] cursor-pointer"
                >
                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.common.actionCancel}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Corpo: Título do serviço + metadados */}
      <div className="mt-3.5 space-y-2.5">
        <h3 className="text-[15px] font-semibold leading-snug text-ink line-clamp-2">
          {appointment.serviceNameSnapshot}
        </h3>

        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary tabular-nums">
          <StatusBadge
            tone={appointmentStatusTone(appointment.status)}
            label={t.status[appointment.status]}
          />
          <span>
            {formatDuration(appointment.serviceDurationMinutesSnapshot, locale)}
          </span>
          <span className="font-medium text-ink">
            {formatPriceFromCents(
              appointment.servicePriceInCentsSnapshot,
              locale,
              currency,
            )}
          </span>
          {commissionLabel && (
            <span className="text-[11px] font-medium text-accent">
              {commissionLabel}
            </span>
          )}
        </div>

        {/* Motivo do cancelamento exibido discretamente quando CANCELED */}
        {appointment.status === "CANCELED" && appointment.cancellationReason && (
          <p className="rounded-xl border border-[var(--status-danger-border)]/60 bg-[var(--status-danger-bg)]/50 px-3 py-2 text-[11px] leading-relaxed text-[var(--status-danger-ink)]">
            <span className="font-medium">{t.common.cancellationReasonTag}:</span>{" "}
            {appointment.cancellationReason}
          </p>
        )}
      </div>

      {/* Rodapé: Cliente + Profissional com foto real */}
      <div className="mt-4 flex items-center justify-between gap-2.5 border-t border-border-subtle pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={[
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-medium",
              getAvatarTint(appointment.clientName),
            ].join(" ")}
          >
            {getClientInitials(appointment.clientName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">
              {appointment.clientName}
            </p>
            <p className="truncate font-mono text-[11px] text-ink-muted tabular-nums">
              {appointment.clientPhone}
            </p>
          </div>
        </div>

        {collaboratorName && (
          <div className="inline-flex max-w-[140px] shrink-0 items-center gap-1.5 rounded-full border border-border-subtle bg-subtle/60 py-1 pl-1 pr-2.5">
            {collaboratorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={collaboratorAvatarUrl}
                alt={collaboratorName}
                className="h-5 w-5 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-medium",
                  getAvatarTint(collaboratorName),
                ].join(" ")}
              >
                {getClientInitials(collaboratorName)}
              </span>
            )}
            <span className="truncate text-[11px] font-medium text-ink-secondary">
              {collaboratorName}
            </span>
          </div>
        )}
      </div>
      {onOpenPayments && (
        <button type="button" onClick={onOpenPayments}
          className="mt-3 inline-flex min-h-9 items-center gap-2 self-start rounded-lg border border-border-subtle px-3 text-xs font-semibold text-accent hover:bg-subtle">
          <Wallet className="size-4" aria-hidden="true" />
          {appointment.status === "CONFIRMED" || appointment.status === "COMPLETED"
            ? t.finance.registerReceipt : t.finance.paymentHistory}
        </button>
      )}
    </article>
  );
}
