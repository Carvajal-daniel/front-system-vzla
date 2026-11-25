import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DashboardPageHeaderProps {
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho compacto padrão para módulos autenticados (Owner e Collaborator).
 * Mantém a escala tipográfica fixa (18px–20px) definida em DESIGN.md sem kickers redundantes.
 */
export function DashboardPageHeader({
  title,
  description,
  meta,
  actions,
  className,
}: DashboardPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-ink text-balance">
            {title}
          </h1>
          {meta}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-ink-secondary text-pretty">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}
