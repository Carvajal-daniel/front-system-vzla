"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Loader2, Percent, Save, Scissors } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { formatDuration, formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Service } from "@/lib/types/service";
import {
  syncCollaboratorServices,
  type CollaboratorProfileDossier,
} from "@/lib/types/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ServicesTabProps {
  dossier: CollaboratorProfileDossier;
  companyServices: Service[];
  currency: string;
  onRefresh: () => Promise<void>;
}

interface ServiceSelectionState {
  selected: boolean;
  customCommission: string;
}

export function ServicesTab({
  dossier,
  companyServices,
  currency,
  onRefresh,
}: ServicesTabProps) {
  const { locale, t } = useLocale();
  const cp = t.owner.collaboratorProfile;

  const { collaborator } = dossier;
  const defaultCommissionRate =
    collaborator.defaultCommissionRate && collaborator.defaultCommissionRate > 0
      ? collaborator.defaultCommissionRate
      : collaborator.commissionPercentage;

  // Mescla serviços da empresa com eventuais serviços já vinculados ao colaborador
  const displayServices = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; priceInCents: number; durationMinutes: number; active: boolean }
    >();
    for (const svc of companyServices) {
      map.set(svc.id, {
        id: svc.id,
        name: svc.name,
        priceInCents: svc.priceInCents,
        durationMinutes: svc.durationMinutes,
        active: svc.active,
      });
    }
    for (const linked of dossier.services) {
      if (!map.has(linked.serviceId)) {
        map.set(linked.serviceId, {
          id: linked.serviceId,
          name: linked.name,
          priceInCents: linked.priceInCents,
          durationMinutes: linked.durationMinutes,
          active: true,
        });
      }
    }
    return Array.from(map.values());
  }, [companyServices, dossier.services]);

  const [selections, setSelections] = useState<Record<string, ServiceSelectionState>>({});
  const [saving, setSaving] = useState(false);

  // Hidrata seleção a partir dos serviços vinculados no dossiê
  useEffect(() => {
    const linkedMap = new Map(dossier.services.map((s) => [s.serviceId, s]));
    const next: Record<string, ServiceSelectionState> = {};
    for (const svc of displayServices) {
      const linked = linkedMap.get(svc.id);
      next[svc.id] = {
        selected: Boolean(linked),
        customCommission:
          linked?.customCommissionRate !== null &&
          linked?.customCommissionRate !== undefined
            ? String(linked.customCommissionRate)
            : "",
      };
    }
    setSelections(next);
  }, [displayServices, dossier.services]);

  const selectedCount = useMemo(
    () => Object.values(selections).filter((item) => item.selected).length,
    [selections],
  );

  const toggleService = (serviceId: string) => {
    setSelections((prev) => {
      const current = prev[serviceId] ?? { selected: false, customCommission: "" };
      return {
        ...prev,
        [serviceId]: {
          ...current,
          selected: !current.selected,
        },
      };
    });
  };

  const updateCustomCommission = (serviceId: string, value: string) => {
    setSelections((prev) => {
      const current = prev[serviceId] ?? { selected: true, customCommission: "" };
      return {
        ...prev,
        [serviceId]: {
          ...current,
          customCommission: value,
        },
      };
    });
  };

  const handleSave = async () => {
    const payloadServices: Array<{
      serviceId: string;
      customCommissionRate: number | null;
    }> = [];

    for (const svc of displayServices) {
      const state = selections[svc.id];
      if (!state?.selected) continue;

      let customRate: number | null = null;
      if (state.customCommission.trim() !== "") {
        const parsed = Number(state.customCommission.replace(",", "."));
        if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
          toast.error(`${svc.name}: ${t.errors.requiredField}`);
          return;
        }
        customRate = parsed;
      }

      payloadServices.push({
        serviceId: svc.id,
        customCommissionRate: customRate,
      });
    }

    setSaving(true);
    try {
      await syncCollaboratorServices(collaborator.id, {
        services: payloadServices,
      });
      toast.success(cp.servicesSavedToast);
      await onRefresh();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 shadow-xs space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border-subtle pb-4">
        <div>
          <h2 className="text-base font-semibold text-ink inline-flex items-center gap-2">
            <Scissors className="h-4 w-4 text-accent" />
            {cp.servicesTitle}
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">{cp.servicesSubtitle}</p>
        </div>

        <span className="inline-flex items-center rounded-full border border-border-subtle bg-subtle px-3 py-1 text-xs font-medium text-ink-secondary self-start sm:self-auto tabular-nums">
          {selectedCount} {cp.servicesSelectedCount}
        </span>
      </div>

      {displayServices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle bg-subtle/30 py-10 px-4 text-center">
          <p className="text-sm font-medium text-ink-secondary">{cp.servicesEmpty}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayServices.map((svc) => {
            const state = selections[svc.id] ?? {
              selected: false,
              customCommission: "",
            };
            return (
              <div
                key={svc.id}
                className={[
                  "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border p-3.5 transition-colors",
                  state.selected
                    ? "border-accent/40 bg-accent-soft/25"
                    : "border-border-subtle bg-subtle/30 hover:border-border-strong",
                ].join(" ")}
              >
                <label className="flex items-start sm:items-center gap-3 cursor-pointer flex-1 min-w-0">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={state.selected}
                    onClick={() => toggleService(svc.id)}
                    className={[
                      "cursor-pointer mt-0.5 sm:mt-0 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      state.selected
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-border-strong bg-surface text-transparent",
                    ].join(" ")}
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </button>

                  <div
                    onClick={() => toggleService(svc.id)}
                    className="min-w-0 flex-1"
                  >
                    <p className="text-sm font-semibold text-ink truncate">
                      {svc.name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-ink-muted tabular-nums">
                      <span>
                        {formatPriceFromCents(svc.priceInCents, locale, currency)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(svc.durationMinutes, locale)}
                      </span>
                    </div>
                  </div>
                </label>

                {/* Input opcional de comissão personalizada quando o serviço está marcado */}
                {state.selected && (
                  <div className="flex items-center gap-2 sm:w-64 shrink-0 pl-8 sm:pl-0">
                    <div className="relative flex-1">
                      <Percent className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-muted" />
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.5"
                        value={state.customCommission}
                        onChange={(e) =>
                          updateCustomCommission(svc.id, e.target.value)
                        }
                        aria-label={`${cp.customCommissionLabel} — ${svc.name}`}
                        placeholder={`${cp.defaultCommissionPlaceholder} ${defaultCommissionRate}%`}
                        className="pr-8 bg-surface text-xs h-9"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-border-subtle">
        <Button
          type="button"
          disabled={saving || displayServices.length === 0}
          onClick={() => void handleSave()}
          className="cursor-pointer"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          {saving ? t.common.saving : cp.saveServicesBtn}
        </Button>
      </div>
    </section>
  );
}
