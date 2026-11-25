import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FilterToolbarProps {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Barra de filtros integrada ao topo de tabelas e listas (evita cartões flutuantes separados).
 * Projetada para viver dentro de um contêiner `rounded-xl border border-border-subtle bg-surface`.
 */
export function FilterToolbar({
  children,
  actions,
  className,
}: FilterToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 border-b border-border-subtle px-3.5 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4",
        className,
      )}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
        {children}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
