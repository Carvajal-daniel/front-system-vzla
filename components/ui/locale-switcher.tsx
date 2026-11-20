"use client";

import { Globe } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Locale } from "@/lib/i18n";

export function LocaleSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  const toggle = (next: Locale) => {
    if (next !== locale) {
      setLocale(next);
    }
  };

  return (
    <div
      role="group"
      aria-label={t.common.languageLabel}
      className={[
        "inline-flex items-center rounded-xl border border-border-subtle bg-surface p-0.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Globe
        className="mx-2 h-4 w-4 shrink-0 text-ink-muted"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => toggle("pt-BR")}
        aria-pressed={locale === "pt-BR"}
        className={[
          "min-h-10 rounded-lg px-2.5 text-xs font-semibold transition-colors cursor-pointer",
          locale === "pt-BR"
            ? "bg-accent text-accent-ink"
            : "text-ink-secondary hover:text-ink",
        ].join(" ")}
      >
        PT
      </button>
      <button
        type="button"
        onClick={() => toggle("es")}
        aria-pressed={locale === "es"}
        className={[
          "min-h-10 rounded-lg px-2.5 text-xs font-semibold transition-colors cursor-pointer",
          locale === "es"
            ? "bg-accent text-accent-ink"
            : "text-ink-secondary hover:text-ink",
        ].join(" ")}
      >
        ES
      </button>
    </div>
  );
}
