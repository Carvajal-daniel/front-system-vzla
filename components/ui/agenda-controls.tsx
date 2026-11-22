"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Popover } from "@base-ui/react/popover";
import { ChevronDown, Search, Users, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useLocale } from "@/lib/i18n/locale-context";
import { useTheme } from "@/lib/theme-context";
import { agendaStrings } from "@/lib/i18n/agenda";

export type AgendaPerson = { id: string; name: string; avatarUrl?: string | null };

export function ProfessionalAvatar({ person, className = "size-7" }: { person: AgendaPerson; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const words = (person?.name ?? "").trim().split(/\s+/).filter(Boolean);
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

export function AgendaProfessionalFilter({ people, value, onChange }: {
  people: AgendaPerson[]; value: ReadonlySet<string> | null; onChange: (ids: ReadonlySet<string> | null) => void;
}) {
  const { locale } = useLocale();
  const { mode, palette } = useTheme();
  const copy = agendaStrings(locale);
  const labelId = useId();
  const summaryId = useId();
  const [query, setQuery] = useState("");
  const selected = new Set(people.filter(({ id }) => value === null || value.has(id)).map(({ id }) => id));
  const summary = people.length === 0 ? copy.noActiveProfessionals
    : selected.size === people.length ? copy.allProfessionalsSelected : copy.selectedProfessionals(selected.size);
  const normalize = (name: string) => name.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase(locale);
  const search = normalize(query.trim());
  const matching = people.filter(({ name }) => normalize(name).includes(search));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next.size === people.length ? null : next);
  }

  return <div className="min-w-0 space-y-1.5">
    <span id={labelId} className="block text-xs font-semibold text-ink-secondary">{copy.professional}</span>
    <Popover.Root onOpenChange={(open) => { if (!open) setQuery(""); }}>
      <Popover.Trigger aria-labelledby={`${labelId} ${summaryId}`} title={summary}
        className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-xl border border-border-subtle bg-surface px-3 text-left text-xs font-medium text-ink hover:border-accent focus-visible:outline-2 focus-visible:outline-accent">
        <Users size={15} aria-hidden="true" className="shrink-0 text-ink-secondary" />
        <span id={summaryId} className="min-w-0 flex-1 truncate">{summary}</span>
        <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner align="start" sideOffset={6} className="z-80">
          <Popover.Popup data-palette={palette} data-theme={mode}
            className={`${mode === "dark" ? "dark" : ""} flex max-h-[var(--available-height)] w-[min(18rem,calc(100vw-1.5rem))] flex-col gap-2 rounded-xl border border-border-subtle bg-surface p-2 text-ink shadow-xl outline-none`}>
            <Popover.Title className="sr-only">{copy.professional}</Popover.Title>
            <label className="flex shrink-0 items-center gap-2 rounded-lg border border-border-subtle px-2 focus-within:border-accent">
              <Search size={14} aria-hidden="true" className="shrink-0 text-ink-muted" />
              <input type="search" aria-label={copy.searchProfessionals} placeholder={copy.searchProfessionals} value={query}
                onChange={(event) => setQuery(event.target.value)} className="min-h-8 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-ink-muted" />
            </label>
            <div className="flex shrink-0 justify-between gap-2 border-b border-border-subtle pb-1 text-xs font-medium">
              <button type="button" disabled={selected.size === people.length} onClick={() => onChange(null)}
                className="cursor-pointer rounded-md px-2 py-1 text-accent enabled:hover:bg-subtle disabled:cursor-default disabled:opacity-50">{copy.selectAllProfessionals}</button>
              <button type="button" disabled={!selected.size} onClick={() => onChange(new Set())}
                className="cursor-pointer rounded-md px-2 py-1 text-ink-secondary enabled:hover:bg-subtle disabled:cursor-default disabled:opacity-50">{copy.clearProfessionals}</button>
            </div>
            <div className="min-h-0 max-h-60 overflow-y-auto overscroll-contain">
              {matching.map((person) => <label key={person.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs hover:bg-subtle">
                <input type="checkbox" checked={selected.has(person.id)} onChange={() => toggle(person.id)} className="size-4 shrink-0 accent-accent" />
                <ProfessionalAvatar person={person} className="size-6" />
                <span className="min-w-0 truncate" title={person.name}>{person.name}</span>
              </label>)}
              {!matching.length && <p className="px-2 py-2 text-xs text-ink-secondary">{people.length ? copy.noMatchingProfessionals : copy.noActiveProfessionals}</p>}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </div>;
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
