"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { THEME_PALETTES, useTheme } from "@/lib/theme-context";
import type { ThemePalette } from "@/lib/theme-context";

/**
 * Controle compacto de tema: alternância Claro/Escuro + popover visual com
 * as 11 paletas em círculos de cor (alvos táteis confortáveis, acessível por teclado).
 */
export function ThemeCustomizer({ className = "" }: { className?: string }) {
  const { mode, palette, toggleMode, setPalette } = useTheme();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleSelectPalette = (next: ThemePalette) => {
    setPalette(next);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={["relative inline-flex items-center gap-1.5", className]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        type="button"
        onClick={toggleMode}
        aria-label={mode === "dark" ? t.theme.toggleLight : t.theme.toggleDark}
        title={mode === "dark" ? t.theme.toggleLight : t.theme.toggleDark}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border-subtle bg-surface text-ink-secondary transition-colors hover:border-border-strong hover:text-ink cursor-pointer"
      >
        {mode === "dark" ? (
          <Sun className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Moon className="h-4 w-4" aria-hidden="true" />
        )}
      </button>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t.theme.paletteLabel}
        title={t.theme.paletteLabel}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border-subtle bg-surface text-ink-secondary transition-colors hover:border-border-strong hover:text-ink cursor-pointer"
      >
        <Palette className="h-4 w-4 text-accent" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t.theme.paletteLabel}
          className="absolute right-0 top-13 z-50 w-56 rounded-2xl border border-border-subtle bg-surface p-3 shadow-lg"
        >
          <p className="mb-2.5 px-1 text-xs font-semibold text-ink-secondary">
            {t.theme.paletteLabel}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {THEME_PALETTES.map((item) => {
              const selected = palette === item.id;
              const swatch =
                mode === "dark" ? item.swatchDark : item.swatchLight;
              const label = t.theme.palettes[item.id];
              const useDarkCheck =
                mode === "dark" || item.id === "cyan" || item.id === "gold";
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  aria-label={label}
                  title={label}
                  onClick={() => handleSelectPalette(item.id)}
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform hover:scale-105 cursor-pointer",
                    selected ? "border-ink scale-105" : "border-transparent",
                  ].join(" ")}
                  style={{ backgroundColor: swatch }}
                >
                  {selected && (
                    <Check
                      className="h-4 w-4"
                      style={{
                        color: useDarkCheck ? "#09090B" : "#FFFFFF",
                      }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 px-1 text-xs font-medium text-ink-muted">
            {t.theme.palettes[palette]}
          </p>
        </div>
      )}
    </div>
  );
}
