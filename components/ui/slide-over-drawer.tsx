"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";

export interface SlideOverDrawerProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Gaveta lateral deslizante (slide-over drawer) para ações de dashboard SaaS
 * sem perder o contexto da listagem principal, respeitando prefers-reduced-motion.
 */
export function SlideOverDrawer({
  open,
  title,
  description,
  onClose,
  children,
}: SlideOverDrawerProps) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-ink/45 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="animate-drawer-in flex h-dvh w-full max-w-md flex-col border-l border-border-subtle bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="min-w-0">
            <h2 id="drawer-title" className="text-title-sm font-bold text-ink">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-ink-secondary">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:bg-subtle hover:text-ink cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
