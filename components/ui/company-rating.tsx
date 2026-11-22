"use client";

import { Star } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import type { CompanySettings } from "@/lib/company-settings";

export function CompanyRating({ rating }: { rating: (NonNullable<CompanySettings["rating"]> & { source?: string }) | null }) {
  const { locale } = useLocale();
  if (!rating) return null;
  const value = rating.average.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const label = (rating.source ? `${rating.source} · ` : "") + (locale === "es" ? `${value} de 5 · ${rating.count} evaluaciones` : `${value} de 5 · ${rating.count} avaliações`);
  return <span aria-label={label} title={label} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold tabular-nums">
    <Star aria-hidden="true" className="size-3 fill-amber-400 text-amber-400" />{value}
    {rating.count > 0 && <span className="font-normal opacity-80">({rating.count})</span>}
  </span>;
}

