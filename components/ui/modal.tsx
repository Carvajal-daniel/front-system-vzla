"use client";

import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { useTheme } from "@/lib/theme-context";

export interface ModalProps {
  open: boolean;
  title: string;
  maxWidth?: "max-w-md" | "max-w-lg" | "max-w-xl" | "max-w-2xl" | "max-w-3xl";
  onClose: () => void;
  children: ReactNode;
}

/**
 * Modal centrado apoiado no Base UI Dialog para garantir focus trap,
 * fechamento por Escape, restauração de foco e herança das 11 paletas + Claro/Escuro.
 */
export function Modal({
  open,
  title,
  maxWidth = "max-w-lg",
  onClose,
  children,
}: ModalProps) {
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
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup
          data-palette={palette}
          data-theme={mode}
          className={[
            mode === "dark" ? "dark" : "",
            "fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl border border-border-subtle bg-surface p-5 text-ink shadow-2xl outline-none duration-150 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            maxWidth,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="mb-4 flex items-center justify-between gap-3 sticky top-0 bg-surface/95 backdrop-blur-xs pb-2.5 z-10 border-b border-border-subtle/60">
            <Dialog.Title className="text-title-sm font-semibold text-ink">
              {title}
            </Dialog.Title>
            <Dialog.Close
              type="button"
              aria-label={t.common.close}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-secondary hover:bg-subtle hover:text-ink transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
