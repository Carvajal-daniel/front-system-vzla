import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Clock,
  XCircle,
} from "lucide-react";
import type { AppointmentStatus } from "@/lib/types/appointment";

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "accent";

const toneClasses: Record<StatusTone, string> = {
  success:
    "bg-[var(--status-success-bg)] text-[var(--status-success-ink)] border-[var(--status-success-border)]",
  warning:
    "bg-[var(--status-warning-bg)] text-[var(--status-warning-ink)] border-[var(--status-warning-border)]",
  danger:
    "bg-[var(--status-danger-bg)] text-[var(--status-danger-ink)] border-[var(--status-danger-border)]",
  neutral:
    "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-ink)] border-[var(--status-neutral-border)]",
  accent: "bg-accent-soft text-accent border-accent/20",
};

const toneIcons: Record<StatusTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: Clock,
  danger: XCircle,
  neutral: CircleDot,
  accent: AlertCircle,
};

export function appointmentStatusTone(status: AppointmentStatus): StatusTone {
  switch (status) {
    case "CONFIRMED":
    case "COMPLETED":
      return "success";
    case "PENDING":
      return "warning";
    case "CANCELED":
    case "NO_SHOW":
      return "danger";
  }
}

export function StatusBadge({
  tone,
  label,
}: {
  tone: StatusTone;
  label: string;
}) {
  const Icon = toneIcons[tone];
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        toneClasses[tone],
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
