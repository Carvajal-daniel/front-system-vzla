"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "atelier_sidebar_collapsed";
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (typeof window !== "undefined") {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) callback();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(callback);
      window.removeEventListener("storage", onStorage);
    };
  }
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Persiste o estado recolhido/expandido do sidebar no desktop usando
 * useSyncExternalStore para evitar erros de hidratação no Next.js 16.
 */
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggle = useCallback(() => {
    if (typeof window === "undefined") return;
    const next = !getSnapshot();
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Ignora falhas de storage
    }
    listeners.forEach((cb) => cb());
  }, []);

  return { collapsed, toggle };
}
