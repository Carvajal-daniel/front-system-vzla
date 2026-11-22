"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { ReactNode } from "react";

const STORAGE_KEY = "atelier_agenda_hide_sensitive_values";
const CHANGE_EVENT = "atelier:privacy-change";

function readValue(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

interface PrivacyContextValue {
  hideSensitiveValues: boolean;
  togglePrivacy: () => void;
  setHideSensitiveValues: (hide: boolean) => void;
}

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const hideSensitiveValues = useSyncExternalStore(subscribe, readValue, () => false);
  const setHideSensitiveValues = useCallback((hide: boolean) => {
    try { window.localStorage.setItem(STORAGE_KEY, String(hide)); } catch { /* storage may be unavailable */ }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }, []);
  const togglePrivacy = useCallback(() => setHideSensitiveValues(!readValue()), [setHideSensitiveValues]);
  const value = useMemo(() => ({ hideSensitiveValues, togglePrivacy, setHideSensitiveValues }), [hideSensitiveValues, togglePrivacy, setHideSensitiveValues]);
  return <PrivacyContext value={value}>{children}</PrivacyContext>;
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (!context) throw new Error("usePrivacy must be used within PrivacyProvider");
  return context;
}
