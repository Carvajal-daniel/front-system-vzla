"use client";

import { useCallback, useEffect, useState } from "react";
import { agendaClock } from "@/lib/agenda";
import type { Appointment } from "@/lib/types/appointment";

export interface WaitlistEntry {
  id: string;
  companyId: string;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  serviceName?: string;
  collaboratorId?: string | null;
  collaboratorName?: string | null;
  preferredTiming: "SPECIFIC" | "ANY_TIME";
  preferredDate?: string;
  preferredTime?: string;
  notes?: string;
  createdAt: string;
}

const STORAGE_PREFIX = "salao_waitlist_";
const WAITLIST_UPDATED = "salao:waitlist-updated";

export function waitlistCandidates(entries: readonly WaitlistEntry[], vacancy: Appointment, timezone: string) {
  const { date, minute } = agendaClock(timezone)(vacancy.startsAt);
  const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
  const phone = vacancy.clientPhone?.replace(/\D/g, "");
  const priority = (entry: WaitlistEntry) => Number(entry.collaboratorId === vacancy.collaboratorId)
    + Number(entry.serviceId === vacancy.serviceId);
  const exactTime = (entry: WaitlistEntry) => Number(entry.preferredTime === time);

  return entries.filter((entry) =>
    (!entry.preferredDate || entry.preferredDate === date)
    && (entry.preferredTiming !== "SPECIFIC" || entry.preferredDate === date)
    && (!entry.collaboratorId || entry.collaboratorId === vacancy.collaboratorId)
    && (!phone || entry.clientPhone.replace(/\D/g, "") !== phone)
  ).sort((a, b) => priority(b) - priority(a)
    || exactTime(b) - exactTime(a)
    || a.createdAt.localeCompare(b.createdAt));
}

/**
 * Hook para gerenciamento da Fila de Espera em localStorage por empresa.
 * Mantém os clientes aguardando vaga isolados por companyId até a criação de tabela no backend.
 */
export function useWaitlist(companyId: string) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const storageKey = `${STORAGE_PREFIX}${companyId}`;

  const readEntries = useCallback((): WaitlistEntry[] | undefined => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return undefined;
    }
  }, [storageKey]);

  const loadEntries = useCallback(() => {
    setEntries(companyId ? readEntries() ?? [] : []);
  }, [companyId, readEntries]);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadEntries, 0);
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) loadEntries();
    };
    const handleLocalChange = (event: Event) => {
      const { key, entries: next } = (event as CustomEvent<{ key: string; entries: WaitlistEntry[] }>).detail;
      if (key === storageKey) setEntries(next);
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(WAITLIST_UPDATED, handleLocalChange);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(WAITLIST_UPDATED, handleLocalChange);
    };
  }, [storageKey, loadEntries]);

  const saveEntries = useCallback((next: WaitlistEntry[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // The updated queue remains available in the current tab.
    }
    setEntries(next);
    window.dispatchEvent(new CustomEvent(WAITLIST_UPDATED, { detail: { key: storageKey, entries: next } }));
  }, [storageKey]);

  const addEntry = useCallback((data: Omit<WaitlistEntry, "id" | "createdAt" | "companyId">) => {
    const newEntry: WaitlistEntry = {
      ...data,
      id: typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      companyId,
      createdAt: new Date().toISOString(),
    };
    saveEntries([newEntry, ...(readEntries() ?? entries)]);
    return newEntry;
  }, [companyId, entries, readEntries, saveEntries]);

  const removeEntry = useCallback((id: string) => {
    saveEntries((readEntries() ?? entries).filter((entry) => entry.id !== id));
  }, [entries, readEntries, saveEntries]);

  const clearWaitlist = useCallback(() => saveEntries([]), [saveEntries]);

  const hasEntry = (id: string) => (readEntries() ?? entries).some((entry) => entry.id === id);

  return { entries, count: entries.length, addEntry, removeEntry, clearWaitlist, hasEntry, refresh: loadEntries };
}
