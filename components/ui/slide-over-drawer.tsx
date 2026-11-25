"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { useTheme } from "@/lib/theme-context";

export interface SlideOverDrawerProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Gaveta lateral deslizante (slide-over drawer) apoiada no Base UI Dialog
 * para garantir focus trap, fechamento por Escape, herança de tema/paleta e prefers-reduced-motion.
 */
export function SlideOverDrawer({
  open,
  title,
  description,
  onClose,
  children,
}: SlideOverDrawerProps) {
  const { t } = useLocale();
  const { mode, palette } = useTheme();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup
          data-palette={palette}
          data-theme={mode}
          className={[
            mode === "dark" ? "dark" : "",
            "dashboard-shell animate-drawer-in fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-md flex-col border-l border-border-subtle bg-surface text-ink shadow-2xl outline-none",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-5">
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
              aria-label={t.common.close}
              className="grid min-h-11 min-w-11 md:min-h-9 md:min-w-9 shrink-0 place-items-center rounded-lg text-ink-secondary hover:bg-subtle hover:text-ink transition-colors cursor-pointer"
            >
              <X className="size-4" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
