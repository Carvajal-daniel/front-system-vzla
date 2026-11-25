"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

export type DashboardDialogSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<DashboardDialogSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export interface DashboardDialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  busy?: boolean;
  size?: DashboardDialogSize;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Modal unificado dos dashboards apoiado no Base UI Dialog.
 * Garante focus trap, fechamento por Escape, herança de tema/paleta (11 paletas + Dark)
 * e alvos táteis seguros (>= 44px em mobile).
 */
export function DashboardDialog({
  open,
  title,
  description,
  onClose,
  busy = false,
  size = "md",
  footer,
  children,
  className,
}: DashboardDialogProps) {
  const { t } = useLocale();
  const { mode, palette } = useTheme();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-none">
          <Dialog.Popup
            data-palette={palette}
            data-theme={mode}
            className={cn(
              mode === "dark" ? "dark" : "",
              "dashboard-shell pointer-events-auto flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface text-ink shadow-2xl outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              sizeClasses[size],
              className,
            )}
          >
            <header className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <Dialog.Title className="text-base sm:text-lg font-semibold tracking-tight text-ink">
                  {title}
                </Dialog.Title>
                {description && (
                  <Dialog.Description className="mt-0.5 text-xs text-ink-secondary">
                    {description}
                  </Dialog.Description>
                )}
              </div>
              <Dialog.Close
                type="button"
                disabled={busy}
                aria-label={t.common.close}
                className="grid min-h-11 min-w-11 md:min-h-9 md:min-w-9 shrink-0 place-items-center rounded-lg text-ink-secondary transition-colors hover:bg-subtle hover:text-ink disabled:opacity-50 cursor-pointer"
              >
                <X className="size-4" aria-hidden="true" />
              </Dialog.Close>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {children}
            </div>

            {footer && (
              <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle bg-subtle/40 px-4 py-3 sm:px-5">
                {footer}
              </footer>
            )}
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
