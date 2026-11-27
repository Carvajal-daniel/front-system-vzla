import { CheckCircle2, Clock3 } from "lucide-react";
import type { AppointmentStatus } from "@/lib/types/appointment";

export const agendaStatuses = ["CONFIRMED", "PENDING", "CANCELED", "NO_SHOW", "COMPLETED"] as const;

const closureColors = "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-ink)]";

export function AwaitingClosureBadge({ label, actionLabel, clientName, onClick, calendar = false }: {
  label: string;
  actionLabel: string;
  clientName: string;
  onClick: () => void;
  calendar?: boolean;
}) {
  return <button type="button" data-agenda-quick-action
    title={label} aria-label={`${label} · ${actionLabel} · ${clientName}`}
    onClick={(event) => { event.stopPropagation(); onClick(); }}
    className={`inline-flex min-w-0 cursor-pointer items-center gap-1 rounded-md border font-semibold hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current ${closureColors} ${calendar ? "m-0.5 max-w-[65%] self-start px-1 text-[10px] leading-4" : "relative z-10 min-h-7 px-2 text-xs"}`}>
    <Clock3 size={12} aria-hidden="true" className="shrink-0" />
    <span className={calendar ? "sr-only @min-[10rem]:not-sr-only @min-[10rem]:truncate" : undefined}>{label}</span>
  </button>;
}

export function AgendaStatusBadge({ status, label }: { status: AppointmentStatus; label: string }) {
  return <span data-agenda-status={status} data-agenda-status-badge className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold">
    <span aria-hidden="true" data-agenda-status-dot className="size-1.5 rounded-full" />{label}
  </span>;
}

export function AgendaStatusLegend({ label, labels }: {
  label: string;
  labels: Record<AppointmentStatus, string>;
}) {
  return <ul role="list" aria-label={label} className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-ink-secondary">
    {agendaStatuses.map((status) =>
      <li key={status} data-agenda-status={status} className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" data-agenda-status-dot className="size-2 rounded-full" />{labels[status]}
      </li>,
    )}
  </ul>;
}

export function PaidBadge({ label, compact = false }: { label: string; compact?: boolean }) {
  return <span data-agenda-paid className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] font-semibold text-[var(--status-success-ink)] ${compact ? "px-0.5 text-[9px] leading-3" : "px-2 py-0.5 text-xs"}`}>
    <CheckCircle2 aria-hidden="true" className={compact ? "size-2.5" : "size-3.5"} />
    <span data-agenda-compact-paid-label={compact || undefined}>{label}</span>
  </span>;
}
