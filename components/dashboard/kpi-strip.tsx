import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type KpiTone = "default" | "success" | "warning" | "danger" | "accent";

const toneAccentStyles: Record<KpiTone, string> = {
  default: "text-ink-muted",
  success: "text-[var(--status-success-ink)]",
  warning: "text-[var(--status-warning-ink)]",
  danger: "text-[var(--status-danger-ink)]",
  accent: "text-accent",
};

const iconContainerStyles: Record<KpiTone, string> = {
  default: "bg-subtle text-ink-secondary",
  success: "bg-[var(--status-success-bg)] text-[var(--status-success-ink)]",
  warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-ink)]",
  danger: "bg-[var(--status-danger-bg)] text-[var(--status-danger-ink)]",
  accent: "bg-accent-soft text-accent",
};

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon?: ReactNode;
  tone?: KpiTone;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Cartão de KPI sóbrio para dashboards operacionais: superfície neutra elevada,
 * borda hairline, padding unificado (14px–16px) e valor em Geist Mono tabular-nums.
 */
export function KpiCard({
  label,
  value,
  helper,
  icon,
  tone = "default",
  interactive = false,
  onClick,
  className,
}: KpiCardProps) {
  const baseClassName = cn(
    "flex flex-col justify-between gap-2 rounded-xl border border-border-subtle bg-surface p-3.5 sm:p-4 text-left shadow-xs",
    (interactive || onClick) &&
      "card-interactive cursor-pointer hover:border-border-strong focus-visible:outline-2 focus-visible:outline-accent",
    className,
  );

  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-secondary truncate">
          {label}
        </span>
        {icon && (
          <span
            aria-hidden="true"
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg",
              iconContainerStyles[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>

      <div className="space-y-1 min-w-0">
        <div className="font-mono text-lg sm:text-xl font-semibold tracking-tight tabular-nums text-ink truncate">
          {value}
        </div>
        {helper && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              toneAccentStyles[tone],
            )}
          >
            {helper}
          </div>
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={baseClassName}>
        {content}
      </button>
    );
  }

  return <article className={baseClassName}>{content}</article>;
}

export interface KpiStripProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

const columnClasses: Record<2 | 3 | 4, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

export function KpiStrip({
  children,
  columns = 4,
  className,
}: KpiStripProps) {
  return (
    <section
      className={cn("grid gap-3", columnClasses[columns], className)}
    >
      {children}
    </section>
  );
}
