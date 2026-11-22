"use client";

import { useCallback, useEffect, useState } from "react";

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

/**
 * Hook para gerenciamento da Fila de Espera em localStorage por empresa.
 * Mantém os clientes aguardando vaga isolados por companyId até a criação de tabela no backend.
 */
export function useWaitlist(companyId: string) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);

  const loadEntries = useCallback(() => {
    if (typeof window === "undefined" || !companyId) return;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${companyId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setEntries(parsed);
          return;
        }
      }
      setEntries([]);
    } catch {
      setEntries([]);
    }
  }, [companyId]);

  useEffect(() => {
    loadEntries();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `${STORAGE_PREFIX}${companyId}`) {
        loadEntries();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [companyId, loadEntries]);

  const addEntry = useCallback(
    (data: Omit<WaitlistEntry, "id" | "createdAt" | "companyId">) => {
      const newEntry: WaitlistEntry = {
        ...data,
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `wl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        companyId,
        createdAt: new Date().toISOString(),
      };

      setEntries((prev) => {
        const next = [newEntry, ...prev];
        try {
          localStorage.setItem(`${STORAGE_PREFIX}${companyId}`, JSON.stringify(next));
        } catch {
          // ignore quota
        }
        return next;
      });

      return newEntry;
    },
    [companyId],
  );

  const removeEntry = useCallback(
    (id: string) => {
      setEntries((prev) => {
        const next = prev.filter((item) => item.id !== id);
        try {
          localStorage.setItem(`${STORAGE_PREFIX}${companyId}`, JSON.stringify(next));
        } catch {
          // ignore quota
        }
        return next;
      });
    },
    [companyId],
  );

  const clearWaitlist = useCallback(() => {
    setEntries([]);
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${companyId}`);
    } catch {
      // ignore
    }
  }, [companyId]);

  return {
    entries,
    count: entries.length,
    addEntry,
    removeEntry,
    clearWaitlist,
    refresh: loadEntries,
  };
}
