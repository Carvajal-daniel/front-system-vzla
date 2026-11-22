"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Gauge, Sparkles } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { usePlanLimits } from "@/lib/use-plan-limits";

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const isOver = used >= limit;
  const percent = Math.min(100, limit > 0 ? (used / limit) * 100 : 0);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-3 text-xs">
        <span className="text-ink-secondary">{label}</span>
        <span
          className={`font-semibold tabular-nums ${
            isOver ? "text-rose-600 dark:text-rose-400 font-bold" : "text-ink"
          }`}
        >
          {used}/{limit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle border border-border-subtle/50">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isOver ? "bg-rose-500" : "bg-accent"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function PlanUsagePopover() {
  const { t } = useLocale();
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  const { limits, activeProfessionals, isOverProfessionalsLimit } = usePlanLimits();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Consumo do plano"
        aria-label="Consumo do plano"
        className={`relative grid size-10 place-items-center rounded-xl border border-border-subtle bg-surface text-ink-secondary hover:text-ink hover:border-accent transition-colors cursor-pointer ${
          isOverProfessionalsLimit ? "border-rose-500/50 text-rose-500" : ""
        }`}
      >
        <Gauge className="size-4" aria-hidden="true" />
        {isOverProfessionalsLimit && (
          <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500 ring-2 ring-surface" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <section
            role="dialog"
            aria-label={t.product.planTitle}
            className="absolute right-0 top-12 z-50 w-[min(21rem,calc(100vw-2rem))] space-y-4 rounded-2xl border border-border-strong bg-surface p-4 shadow-2xl animate-in fade-in duration-150"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-3">
              <div>
                <p className="text-sm font-bold text-ink">{t.product.planTitle}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{t.product.trialDays}</p>
              </div>
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[10px] font-bold text-accent">
                {limits.name}
              </span>
            </div>

            {isOverProfessionalsLimit && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>
                  Você atingiu o limite de profissionais ativos do seu plano ({activeProfessionals}/{limits.maxProfessionals}). Faça upgrade para continuar adicionando.
                </span>
              </div>
            )}

            <div className="space-y-3">
              <UsageBar
                label={t.product.professionals}
                used={activeProfessionals}
                limit={limits.maxProfessionals}
              />
              <UsageBar
                label={t.product.whatsappMessages}
                used={0}
                limit={limits.maxWhatsAppMessages}
              />
              <UsageBar
                label={t.product.aiConversations}
                used={0}
                limit={limits.maxAiConversations}
              />
            </div>

            <p className="sr-only">{session.company.companyName}</p>

            <Link
              href="/owner/settings"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-xs font-bold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs"
            >
              <Sparkles size={13} />
              <span>{t.product.upgradeAction}</span>
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
