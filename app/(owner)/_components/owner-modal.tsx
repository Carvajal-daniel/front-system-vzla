"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/locale-context";

export const ownerField = "grid min-w-0 gap-1 text-xs font-medium text-ink-secondary";
export const ownerControl = "h-10 w-full min-w-0 rounded-lg border border-border-strong bg-surface px-3 text-sm text-ink";
export const ownerSection = "overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xs";

export function OwnerModal({ title, onClose, children, busy = false, wide = false }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  wide?: boolean;
}) {
  const { t } = useLocale();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog ref={dialog} aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      className={"fixed inset-0 m-auto max-h-[92dvh] overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-5 text-ink shadow-2xl [color-scheme:light] backdrop:bg-black/50 sm:p-6 dark:[color-scheme:dark] " +
        (wide ? "w-[min(96vw,72rem)]" : "w-[min(94vw,36rem)]")}>
      <header className="mb-4 flex items-center justify-between gap-4 border-b border-border-subtle/60 pb-3">
        <h2 id={titleId} className="text-title-sm font-semibold text-ink">{title}</h2>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t.common.close} disabled={busy} onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </header>
      {children}
    </dialog>
  );
}
