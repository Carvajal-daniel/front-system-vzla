"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";

export type ThemeMode = "light" | "dark";

export type ThemePalette =
  | "cobalt"
  | "rose"
  | "emerald"
  | "velvet"
  | "obsidian";

export interface PaletteOption {
  id: ThemePalette;
  swatchLight: string;
  swatchDark: string;
}

/**
 * 5 paletas exclusivas dos dashboards (Owner e Colaborador), sem tons de marrom.
 */
export const THEME_PALETTES: PaletteOption[] = [
  { id: "cobalt", swatchLight: "#1D4ED8", swatchDark: "#60A5FA" },
  { id: "rose", swatchLight: "#BE185D", swatchDark: "#F472B6" },
  { id: "emerald", swatchLight: "#047857", swatchDark: "#34D399" },
  { id: "velvet", swatchLight: "#6D28D9", swatchDark: "#A78BFA" },
  { id: "obsidian", swatchLight: "#18181B", swatchDark: "#FAFAFA" },
];

const MODE_STORAGE_KEY = "atelier_agenda_theme_mode";
const PALETTE_STORAGE_KEY = "atelier_agenda_theme_palette";
const THEME_CHANGE_EVENT = "atelier:theme-change";

const DEFAULT_MODE: ThemeMode = "light";
const DEFAULT_PALETTE: ThemePalette = "cobalt";

const VALID_PALETTES = new Set<string>(THEME_PALETTES.map((p) => p.id));

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const raw = window.localStorage.getItem(MODE_STORAGE_KEY);
    return raw === "dark" || raw === "light" ? raw : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function readStoredPalette(): ThemePalette {
  if (typeof window === "undefined") return DEFAULT_PALETTE;
  try {
    const raw = window.localStorage.getItem(PALETTE_STORAGE_KEY);
    return raw && VALID_PALETTES.has(raw)
      ? (raw as ThemePalette)
      : DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}

function subscribeThemeStore(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = () => callback();
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onStorage);
  };
}

interface ThemeContextValue {
  mode: ThemeMode;
  palette: ThemePalette;
  setMode: (next: ThemeMode) => void;
  toggleMode: () => void;
  setPalette: (next: ThemePalette) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Não aplica data-palette nem .dark no <html> global: cada dashboard
 * (OwnerShell e CollaboratorShell) aplica o tema no próprio wrapper raiz,
 * preservando a identidade editorial fixa da Landing Page e de /login /register.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore<ThemeMode>(
    subscribeThemeStore,
    readStoredMode,
    () => DEFAULT_MODE,
  );

  const palette = useSyncExternalStore<ThemePalette>(
    subscribeThemeStore,
    readStoredPalette,
    () => DEFAULT_PALETTE,
  );

  const setMode = useCallback((next: ThemeMode) => {
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Ignora falhas de storage
    }
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
  }, []);

  const toggleMode = useCallback(() => {
    setMode(readStoredMode() === "dark" ? "light" : "dark");
  }, [setMode]);

  const setPalette = useCallback((next: ThemePalette) => {
    try {
      window.localStorage.setItem(PALETTE_STORAGE_KEY, next);
    } catch {
      // Ignora falhas de storage
    }
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, palette, setMode, toggleMode, setPalette }),
    [mode, palette, setMode, toggleMode, setPalette],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
