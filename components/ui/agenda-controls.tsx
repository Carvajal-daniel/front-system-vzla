"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Users, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useLocale } from "@/lib/i18n/locale-context";
import { useTheme } from "@/lib/theme-context";

export type AgendaPerson = { id: string; name: string; avatarUrl?: string | null };

export function ProfessionalAvatar({ person, className = "size-7" }: { person: AgendaPerson; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const words = person.name.trim().split(/\s+/).filter(Boolean);
  const initials = words.length > 1 ? `${words[0][0]}${words.at(-1)![0]}` : words[0]?.slice(0, 2) ?? "?";
  return <span aria-hidden="true" className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-border-subtle bg-accent-soft text-[10px] font-semibold text-accent ${className}`}>
    {person.avatarUrl && person.avatarUrl !== failedUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={person.avatarUrl} alt="" className="size-full rounded-full object-cover" onError={() => setFailedUrl(person.avatarUrl ?? undefined)} />
    ) : initials.toUpperCase()}
  </span>;
}

export type AgendaSelectOption = { value: string; label: string; person?: AgendaPerson };

export function AgendaSelect({ label, placeholder, value, options, onChange, disabled, compact }: {
  label: string; placeholder?: string; value: string; options: AgendaSelectOption[];
  onChange: (value: string) => void; disabled?: boolean; compact?: boolean;
}) {
  const { mode, palette } = useTheme();
  const labelId = useId();
  const selected = options.find((option) => option.value === value);
  return <div className="min-w-0 space-y-1.5">
    <span id={labelId} className={compact ? "sr-only" : "block text-xs font-semibold text-ink-secondary"}>{label}</span>
    <Select value={selected ? value : null} onValueChange={(next) => onChange(next ?? "")} disabled={disabled}>
      <SelectTrigger aria-labelledby={labelId} className="min-h-10 w-full cursor-pointer gap-2 rounded-xl border-border-subtle bg-surface text-ink disabled:cursor-not-allowed data-disabled:cursor-not-allowed">
        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {selected?.person && <ProfessionalAvatar person={selected.person} className="size-5" />}
          <span className={`truncate ${selected ? "text-ink" : "text-ink-secondary"}`}>{selected?.label ?? placeholder ?? label}</span>
        </span>
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} positionerClassName="z-80" data-palette={palette} data-theme={mode}
        className={`${mode === "dark" ? "dark" : ""} z-80 min-w-36 rounded-xl border border-border-subtle bg-surface p-1 text-ink shadow-xl ring-0 [&_[data-slot=select-scroll-up-button]]:cursor-pointer [&_[data-slot=select-scroll-down-button]]:cursor-pointer`}>
        {options.map(({ value: option, label: text, person }) => <SelectItem key={option} value={option} label={text} className="min-h-9 cursor-pointer rounded-lg py-1.5 focus:bg-accent-soft data-disabled:pointer-events-auto data-disabled:cursor-not-allowed">
          {person && <ProfessionalAvatar person={person} className="size-6" />}{text}
        </SelectItem>)}
      </SelectContent>
    </Select>
  </div>;
}

export function AgendaProfessionalFilter({ label, allLabel, people, value, onChange }: {
  label: string; allLabel: string; people: AgendaPerson[]; value: string; onChange: (id: string) => void;
}) {
  return <fieldset className="min-w-0">
    <legend className="mb-2 text-xs font-semibold text-ink-secondary">{label}</legend>
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-3">
      {[{ id: "", name: allLabel }, ...people].map((person) => {
        const active = person.id === value;
        return <button key={person.id} type="button" aria-pressed={active} title={person.name} onClick={() => onChange(person.id)}
          className={`flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-xl border p-1.5 text-center text-xs font-medium text-ink hover:border-accent focus-visible:outline-2 focus-visible:outline-accent ${active ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-border-subtle bg-surface"}`}>
          {person.id ? <ProfessionalAvatar person={person} className="size-8" />
            : <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-accent-soft text-accent"><Users size={16} /></span>}
          <span className="line-clamp-2 w-full wrap-break-word text-[11px] leading-tight">{person.name}</span>
        </button>;
      })}
    </div>
  </fieldset>;
}

export function AgendaDialog({ title, children, onClose, centered = false, closeDisabled = false }: {
  title: string; children: ReactNode; onClose: () => void; centered?: boolean; closeDisabled?: boolean;
}) {
  const { t } = useLocale();
  const { mode, palette } = useTheme();
  return <Dialog.Root open onOpenChange={(open) => { if (!open && !closeDisabled) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs" />
      <Dialog.Popup data-palette={palette} data-theme={mode} className={`${mode === "dark" ? "dark" : ""} fixed z-60 flex flex-col overflow-hidden border border-border-subtle bg-surface text-ink shadow-2xl outline-none ${centered
        ? "top-1/2 left-1/2 max-h-[90dvh] w-[90vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-2xl"
        : "inset-x-0 bottom-0 max-h-[94dvh] w-full rounded-t-2xl sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[calc(100%-2rem)] sm:max-w-2xl sm:-translate-1/2 sm:rounded-2xl"}`}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <Dialog.Title className="text-base font-semibold sm:text-lg">{title}</Dialog.Title>
          <Dialog.Close aria-label={t.common.close} disabled={closeDisabled} className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink disabled:cursor-not-allowed data-disabled:cursor-not-allowed"><X size={18} /></Dialog.Close>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5">{children}</div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
