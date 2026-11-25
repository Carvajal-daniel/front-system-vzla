"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, Gauge, Sparkles } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { usePlanLimits } from "@/lib/use-plan-limits";
import {
  intelligenceApi,
  type BillingUsageSummaryResponse,
} from "@/lib/intelligence-api";

function UsageBar({
  label,
  used,
  limit,
  percentageOverride,
}: {
  label: string;
  used: number;
  limit: number;
  percentageOverride?: number;
}) {
  const percent =
    percentageOverride !== undefined
      ? Math.min(100, Math.max(0, percentageOverride))
      : Math.min(100, limit > 0 ? (used / limit) * 100 : 0);
  const isBlocked = limit > 0 && used >= limit;
  const isWarning = !isBlocked && percent >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-3 text-xs">
        <span className="text-ink-secondary">{label}</span>
        <span
          className={`font-mono font-semibold tabular-nums ${
            isBlocked
              ? "text-[var(--status-danger-ink)]"
              : isWarning
                ? "text-[var(--status-warning-ink)]"
                : "text-ink"
          }`}
        >
          {used}/{limit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-subtle border border-border-subtle/60">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isBlocked
              ? "bg-[var(--status-danger)]"
              : isWarning
                ? "bg-[var(--status-warning)]"
                : "bg-accent"
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
  const { limits, activeProfessionals, isOverProfessionalsLimit } =
    usePlanLimits();
  const [billingUsage, setBillingUsage] =
    useState<BillingUsageSummaryResponse | null>(null);

  const loadBillingUsage = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await intelligenceApi.getBillingUsage(signal);
      setBillingUsage(data);
    } catch {
      // Mantém fallback gracioso dos limites locais caso o endpoint esteja temporariamente indisponível
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadBillingUsage(controller.signal);
    return () => controller.abort();
  }, [loadBillingUsage, session.company.id]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadBillingUsage(controller.signal);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      controller.abort();
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, loadBillingUsage]);

  const aiUsed = billingUsage?.aiSessions.used ?? 0;
  const aiLimit = billingUsage?.aiSessions.limit ?? limits.maxAiConversations;
  const aiPercent =
    billingUsage?.aiSessions.percentage ??
    (aiLimit > 0 ? Math.round((aiUsed / aiLimit) * 100) : 0);

  const outboundUsed = billingUsage?.outboundMessages.used ?? 0;
  const outboundLimit =
    billingUsage?.outboundMessages.limit ?? limits.maxWhatsAppMessages;
  const outboundPercent =
    billingUsage?.outboundMessages.percentage ??
    (outboundLimit > 0 ? Math.round((outboundUsed / outboundLimit) * 100) : 0);

  const isQuotaBlocked = Boolean(billingUsage?.isBlocked) || isOverProfessionalsLimit;
  const isQuotaWarning =
    !isQuotaBlocked && (aiPercent >= 80 || outboundPercent >= 80);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={t.product.usageShort}
        aria-label={t.product.usageShort}
        className={`relative grid min-h-11 min-w-11 md:min-h-9 md:min-w-9 md:h-9 md:w-9 place-items-center rounded-lg border bg-surface text-ink-secondary hover:text-ink hover:border-border-strong transition-colors cursor-pointer ${
          isQuotaBlocked
            ? "border-[var(--status-danger-border)] text-[var(--status-danger)]"
            : isQuotaWarning
              ? "border-[var(--status-warning-border)] text-[var(--status-warning)]"
              : "border-border-subtle"
        }`}
      >
        <Gauge className="size-4" aria-hidden="true" />
        {(isQuotaBlocked || isQuotaWarning) && (
          <span
            className={`absolute right-1.5 top-1.5 size-2 rounded-full ring-2 ring-surface ${
              isQuotaBlocked
                ? "bg-[var(--status-danger)]"
                : "bg-[var(--status-warning)]"
            }`}
          />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <section
            role="dialog"
            aria-label={t.product.planTitle}
            className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-1.5rem))] space-y-3.5 rounded-xl border border-border-subtle bg-surface p-4 shadow-xl animate-in fade-in duration-150"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-3">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {t.product.planTitle}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {billingUsage?.periodMonth
                    ? `Ciclo ${billingUsage.periodMonth}`
                    : t.product.trialDays}
                </p>
              </div>
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
                {billingUsage?.planName ?? limits.name}
              </span>
            </div>

            {isQuotaBlocked && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-2.5 text-xs text-[var(--status-danger-ink)]">
                <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {billingUsage?.isBlocked
                    ? "Você atingiu 100% da cota mensal de IA ou disparos WhatsApp. Faça upgrade para liberar novos atendimentos automáticos."
                    : `Você atingiu o limite de profissionais ativos do seu plano (${activeProfessionals}/${limits.maxProfessionals}).`}
                </span>
              </div>
            )}

            {isQuotaWarning && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-2.5 text-xs text-[var(--status-warning-ink)]">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Seu consumo mensal de IA ou WhatsApp ultrapassou 80% da cota do plano. Considere fazer upgrade para evitar pausas.
                </span>
              </div>
            )}

            <div className="space-y-3">
              <UsageBar
                label="Atendimentos IA"
                used={aiUsed}
                limit={aiLimit}
                percentageOverride={aiPercent}
              />
              <UsageBar
                label="Disparos WhatsApp"
                used={outboundUsed}
                limit={outboundLimit}
                percentageOverride={outboundPercent}
              />
              <UsageBar
                label={t.product.professionals}
                used={activeProfessionals}
                limit={limits.maxProfessionals}
              />
            </div>

            <p className="sr-only">{session.company.companyName}</p>

            <Link
              href="/owner/settings"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-accent px-3.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs"
            >
              <Sparkles className="size-3.5" aria-hidden="true" />
              <span>{t.product.upgradeAction}</span>
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
