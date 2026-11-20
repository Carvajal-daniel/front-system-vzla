"use client";

import { AlertTriangle, X } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { formatDateTimeInTimezone } from "@/lib/format";
import type { AffectedAppointment } from "@/lib/types/appointment";

export interface ConflictAlertProps {
  affectedAppointments: AffectedAppointment[];
  timezone: string;
  onDismiss?: () => void;
}

/**
 * Banner de impacto (assinatura visual do produto) exibindo agendamentos colidentes
 * retornados pela API ao criar um bloqueio de agenda.
 */
export function ConflictAlert({
  affectedAppointments,
  timezone,
  onDismiss,
}: ConflictAlertProps) {
  const { locale, t } = useLocale();

  if (affectedAppointments.length === 0) {
    return null;
  }

  const countLabel =
    affectedAppointments.length === 1
      ? t.conflicts.singleAffected
      : `${affectedAppointments.length} ${t.conflicts.multipleAffected}`;

  return (
    <div
      role="alert"
      className="rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-warning-ink)]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[var(--status-warning-ink)]">
              {t.conflicts.title} ({countLabel})
            </h3>
            <p className="mt-1 text-xs text-ink-secondary">
              {t.conflicts.description}
            </p>
          </div>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t.common.close}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-secondary hover:bg-surface/60 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <ul className="mt-3 space-y-2">
        {affectedAppointments.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--status-warning-border)] bg-surface px-3.5 py-2.5 text-xs"
          >
            <div className="min-w-0">
              <p className="font-semibold text-ink truncate">
                {item.clientName}
              </p>
              <p className="font-mono text-ink-muted truncate tabular-nums">
                {item.clientPhone}
              </p>
            </div>
            <span className="font-mono font-semibold text-ink tabular-nums">
              {formatDateTimeInTimezone(item.startsAt, timezone, locale)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
