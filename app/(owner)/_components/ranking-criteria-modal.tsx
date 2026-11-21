"use client";

import { useEffect, useMemo, useState } from "react";
import { Award, CheckCircle2, Loader2, SlidersHorizontal, Trophy } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  closeMonthAward,
  getCompanyRankingWeights,
  updateCompanyRankingWeights,
  type CompanyRankingWeights,
} from "@/lib/types/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

const DEFAULT_WEIGHTS: CompanyRankingWeights = {
  servicesRevenueWeight: 35,
  productsSalesWeight: 25,
  appointmentsVolumeWeight: 15,
  clientReviewsWeight: 15,
  punctualityRetentionWeight: 10,
};

function getCurrentReferenceMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

interface RankingCriteriaModalProps {
  open: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
}

export function RankingCriteriaModal({
  open,
  onClose,
  onUpdated,
}: RankingCriteriaModalProps) {
  const { t } = useLocale();
  const td = t.owner.teamDirectory;

  const [weights, setWeights] = useState<CompanyRankingWeights>(DEFAULT_WEIGHTS);
  const [loadingWeights, setLoadingWeights] = useState(false);
  const [savingWeights, setSavingWeights] = useState(false);
  const [weightsError, setWeightsError] = useState<string | null>(null);

  const [referenceMonth, setReferenceMonth] = useState(getCurrentReferenceMonth);
  const [closingMonth, setClosingMonth] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);

  // Carrega os pesos atuais da empresa sempre que o modal é aberto
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingWeights(true);
    setWeightsError(null);
    setAwardError(null);

    void (async () => {
      try {
        const res = await getCompanyRankingWeights();
        if (!active) return;
        setWeights(res);
      } catch {
        if (!active) return;
        setWeights(DEFAULT_WEIGHTS);
      } finally {
        if (active) setLoadingWeights(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [open]);

  const totalSum = useMemo(
    () =>
      weights.servicesRevenueWeight +
      weights.productsSalesWeight +
      weights.appointmentsVolumeWeight +
      weights.clientReviewsWeight +
      weights.punctualityRetentionWeight,
    [weights],
  );

  const isSumValid = totalSum === 100;

  const weightItems: Array<{
    key: keyof CompanyRankingWeights;
    label: string;
  }> = [
    { key: "servicesRevenueWeight", label: td.weightServicesRevenue },
    { key: "productsSalesWeight", label: td.weightProductsSales },
    { key: "appointmentsVolumeWeight", label: td.weightAppointmentsVolume },
    { key: "clientReviewsWeight", label: td.weightClientReviews },
    { key: "punctualityRetentionWeight", label: td.weightPunctualityRetention },
  ];

  const handleWeightChange = (key: keyof CompanyRankingWeights, rawValue: number) => {
    const safeVal = Number.isFinite(rawValue)
      ? Math.max(0, Math.min(100, Math.round(rawValue)))
      : 0;
    setWeights((prev) => ({ ...prev, [key]: safeVal }));
    setWeightsError(null);
  };

  const handleSaveWeights = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isSumValid) {
      setWeightsError(td.weightsSumError);
      return;
    }

    setSavingWeights(true);
    setWeightsError(null);
    try {
      const saved = await updateCompanyRankingWeights(weights);
      setWeights(saved);
      toast.success(td.criteriaSavedToast);
      await onUpdated();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t.errors.unexpectedDescription;
      setWeightsError(msg);
      toast.error(msg);
    } finally {
      setSavingWeights(false);
    }
  };

  const handleCloseMonthAward = async () => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)) return;
    setClosingMonth(true);
    setAwardError(null);
    try {
      const result = await closeMonthAward(referenceMonth);
      toast.success(
        `${td.awardWinnerSuccessPrefix} ${result.collaboratorName} (${Math.round(result.score)} pts)`,
      );
      await onUpdated();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t.errors.unexpectedDescription;
      setAwardError(msg);
      toast.error(msg);
    } finally {
      setClosingMonth(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!savingWeights && !closingMonth) onClose();
      }}
      title={td.rankingModalTitle}
      maxWidth="max-w-xl"
    >
      <div className="space-y-6">
        <p className="text-xs text-ink-secondary">{td.rankingModalSubtitle}</p>

        {/* Seção 1: 5 Pesos Configuráveis */}
        <form onSubmit={handleSaveWeights} className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink inline-flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-accent" />
              {td.weightsSectionTitle}
            </h3>
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums border",
                isSumValid
                  ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                  : "border-red-500/30 bg-red-500/12 text-red-700 dark:text-red-300",
              ].join(" ")}
            >
              {isSumValid && <CheckCircle2 className="h-3.5 w-3.5" />}
              {td.weightsTotalLabel}: {totalSum}%
            </span>
          </div>

          <p className="text-[11px] text-ink-muted">{td.weightsSectionHint}</p>

          {loadingWeights ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-subtle animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {weightItems.map((item) => {
                const val = weights[item.key];
                return (
                  <div
                    key={item.key}
                    className="rounded-xl border border-border-subtle bg-subtle/40 px-3.5 py-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Label
                        htmlFor={`weight-${item.key}`}
                        className="text-xs font-medium text-ink"
                      >
                        {item.label}
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          id={`weight-${item.key}`}
                          type="number"
                          min={0}
                          max={100}
                          value={val}
                          onChange={(e) =>
                            handleWeightChange(item.key, Number(e.target.value))
                          }
                          className="h-8 w-16 text-right text-xs font-semibold tabular-nums bg-surface px-2"
                        />
                        <span className="text-xs text-ink-muted">%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={val}
                      onChange={(e) =>
                        handleWeightChange(item.key, Number(e.target.value))
                      }
                      aria-label={item.label}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[var(--accent-primary)] bg-border-subtle"
                    />
                  </div>
                );
              })}
            </div>
          )}

          {weightsError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
              {weightsError}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!isSumValid || savingWeights || loadingWeights}
              className="cursor-pointer bg-accent text-accent-ink hover:bg-accent-hover"
            >
              {savingWeights && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {td.saveCriteriaBtn}
            </Button>
          </div>
        </form>

        {/* Seção 2: Apuração e Premiação Oficial do Mês */}
        <div className="border-t border-border-subtle pt-5 space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-ink inline-flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              {td.closeMonthSectionTitle}
            </h3>
            <p className="text-[11px] text-ink-muted">{td.closeMonthSectionHint}</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3 rounded-xl border border-border-subtle bg-subtle/40 p-3.5">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="award-reference-month" className="text-xs">
                {td.referenceMonthLabel}
              </Label>
              <Input
                id="award-reference-month"
                type="month"
                value={referenceMonth}
                onChange={(e) => {
                  setReferenceMonth(e.target.value);
                  setAwardError(null);
                }}
                className="bg-surface tabular-nums"
              />
            </div>

            <Button
              type="button"
              disabled={closingMonth || !referenceMonth}
              onClick={() => void handleCloseMonthAward()}
              className="cursor-pointer bg-accent text-accent-ink hover:bg-accent-hover shrink-0"
            >
              {closingMonth ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Award className="h-4 w-4 mr-1.5" />
              )}
              {td.awardWinnerBtn}
            </Button>
          </div>

          {awardError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
              {awardError}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
