"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Clock, MoreVertical } from "lucide-react";
import type { CascadeDelayMinutes } from "@/lib/operations-api";
import type { AgendaPerson } from "./agenda-controls";

const DELAY_OPTIONS: CascadeDelayMinutes[] = [15, 30, 45];

export interface BarberOperationsMenuProps {
  person: AgendaPerson;
  disabled?: boolean;
  onCascadeDelay: (person: AgendaPerson, delayMinutes: CascadeDelayMinutes) => void;
  onEmergencyAbsence: (person: AgendaPerson) => void;
}

/**
 * Menu discreto no cabeçalho de cada profissional na agenda do dia.
 * Usa posicionamento fixo calculado a partir do botão para evitar recorte pelo overflow do cabeçalho sticky.
 */
export function BarberOperationsMenu({
  person,
  disabled = false,
  onCascadeDelay,
  onEmergencyAbsence,
}: BarberOperationsMenuProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function close() {
      setOpen(false);
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function toggleMenu(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (open) {
      setOpen(false);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const menuWidth = 224;
      const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
      const left = Math.min(maxLeft, Math.max(8, rect.right - menuWidth));
      setCoords({ top: rect.bottom + 6, left });
    }
    setOpen(true);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={toggleMenu}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Ações rápidas para ${person.name}`}
        title={`Ações rápidas · ${person.name}`}
        className="ml-auto grid size-6 shrink-0 cursor-pointer place-items-center rounded-md text-ink-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        <MoreVertical className="size-3.5" aria-hidden="true" />
      </button>

      {open && coords && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={`Operações de ${person.name}`}
          style={{ top: coords.top, left: coords.left }}
          className="fixed z-50 w-56 overflow-hidden rounded-xl border border-border-subtle bg-surface p-1.5 shadow-xl"
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-[11px] font-semibold text-ink">
              {person.name}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              <Clock className="size-3" aria-hidden="true" />
              Atrasar agenda
            </p>
          </div>

          <div className="grid grid-cols-3 gap-1 px-1.5 pb-1.5">
            {DELAY_OPTIONS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onCascadeDelay(person, minutes);
                }}
                className="min-h-8 cursor-pointer rounded-lg border border-border-subtle bg-canvas/60 px-2 py-1 text-xs font-semibold text-ink transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
              >
                +{minutes}m
              </button>
            ))}
          </div>

          <div className="my-1 border-t border-border-subtle" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEmergencyAbsence(person);
            }}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400"
          >
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Modo Imprevisto (Falta hoje)</span>
          </button>
        </div>
      )}
    </>
  );
}
