"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";

export interface ModalProps {
  open: boolean;
  title: string;
  maxWidth?: "max-w-md" | "max-w-lg" | "max-w-xl" | "max-w-2xl" | "max-w-3xl";
  onClose: () => void;
  children: ReactNode;
}

export function Modal({
  open,
  title,
  maxWidth = "max-w-lg",
  onClose,
  children,
}: ModalProps) {
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

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`max-h-[90dvh] w-full ${maxWidth} overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 shadow-2xl my-auto`}
          >
            <div className="mb-4 flex items-center justify-between gap-3 sticky top-0 bg-surface/90 backdrop-blur-xs pb-2 z-10 border-b border-border-subtle/50">
              <h2 id="modal-title" className="text-title-sm font-bold text-ink">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.common.close}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-secondary hover:bg-subtle hover:text-ink transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
