"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Coffee, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { companyWeekday } from "@/lib/agenda";
import { ApiError } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import type { CompanyOperatingDaySchedule } from "@/lib/types/auth";
import {
  syncCollaboratorSchedule,
  type CollaboratorProfileDossier,
  type DayOfWeek,
} from "@/lib/types/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

interface DayScheduleRow {
  dayOfWeek: DayOfWeek;
  isWorkingDay: boolean;
  startTime: string;
  endTime: string;
  hasBreak: boolean;
  breakStartTime: string;
  breakEndTime: string;
}

function toMinutes(hhmm: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

interface ScheduleTabProps {
  dossier: CollaboratorProfileDossier;
  companyOperatingSchedule?: CompanyOperatingDaySchedule[] | null;
  companyOperatingDays?: string | null;
  onRefresh: () => Promise<void>;
}

export function ScheduleTab({
  dossier,
  companyOperatingSchedule,
  companyOperatingDays,
  onRefresh,
}: ScheduleTabProps) {
  const { t } = useLocale();
  const cp = t.owner.collaboratorProfile;

  // Referência do horário de funcionamento da empresa por dia da semana
  const companyRefByDay = useMemo(() => {
    const map = new Map<
      DayOfWeek,
      { isOpen: boolean; openTime: string | null; closeTime: string | null }
    >();
    for (const day of DAYS) {
      const info = companyWeekday(
        {
          operatingSchedule: companyOperatingSchedule,
          operatingDays: companyOperatingDays,
        },
        day,
      );
      map.set(day, {
        isOpen: info.isOpen,
        openTime: info.hours?.openTime?.slice(0, 5) ?? null,
        closeTime: info.hours?.closeTime?.slice(0, 5) ?? null,
      });
    }
    return map;
  }, [companyOperatingSchedule, companyOperatingDays]);

  const [rows, setRows] = useState<DayScheduleRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Hidrata os 7 dias da semana a partir do dossiê + fallback com horário da empresa
  useEffect(() => {
    const savedByDay = new Map(dossier.schedules.map((s) => [s.dayOfWeek, s]));
    const nextRows: DayScheduleRow[] = DAYS.map((day) => {
      const saved = savedByDay.get(day);
      const compRef = companyRefByDay.get(day);
      const defaultStart = compRef?.openTime ?? "09:00";
      const defaultEnd = compRef?.closeTime ?? "18:00";

      const breakStart = saved?.breakStartTime ?? saved?.breakStart ?? null;
      const breakEnd = saved?.breakEndTime ?? saved?.breakEnd ?? null;

      return {
        dayOfWeek: day,
        isWorkingDay: saved ? saved.isWorkingDay : false,
        startTime: saved?.startTime?.slice(0, 5) ?? defaultStart,
        endTime: saved?.endTime?.slice(0, 5) ?? defaultEnd,
        hasBreak: Boolean(breakStart && breakEnd),
        breakStartTime: breakStart?.slice(0, 5) ?? "12:00",
        breakEndTime: breakEnd?.slice(0, 5) ?? "13:00",
      };
    });
    setRows(nextRows);
    setBackendError(null);
  }, [dossier.schedules, companyRefByDay]);

  // Validação visual imediata em tempo real contra o expediente da empresa
  const rowErrors = useMemo(() => {
    const errors = new Map<DayOfWeek, string>();

    for (const row of rows) {
      if (!row.isWorkingDay) continue;

      const compRef = companyRefByDay.get(row.dayOfWeek);
      if (compRef && !compRef.isOpen) {
        errors.set(row.dayOfWeek, cp.scheduleErrorCompanyClosed);
        continue;
      }

      const startMin = toMinutes(row.startTime);
      const endMin = toMinutes(row.endTime);
      if (startMin === null || endMin === null || endMin <= startMin) {
        errors.set(row.dayOfWeek, cp.scheduleErrorInvalidShift);
        continue;
      }

      if (compRef?.openTime && compRef?.closeTime) {
        const compOpenMin = toMinutes(compRef.openTime);
        const compCloseMin = toMinutes(compRef.closeTime);
        if (
          compOpenMin !== null &&
          compCloseMin !== null &&
          (startMin < compOpenMin || endMin > compCloseMin)
        ) {
          errors.set(
            row.dayOfWeek,
            `${cp.scheduleErrorOutsideCompany} (${compRef.openTime} – ${compRef.closeTime}).`,
          );
          continue;
        }
      }

      if (row.hasBreak) {
        const bStartMin = toMinutes(row.breakStartTime);
        const bEndMin = toMinutes(row.breakEndTime);
        if (bStartMin === null || bEndMin === null || bEndMin <= bStartMin) {
          errors.set(row.dayOfWeek, cp.scheduleErrorInvalidBreak);
          continue;
        }
        if (bStartMin <= startMin || bEndMin >= endMin) {
          errors.set(row.dayOfWeek, cp.scheduleErrorBreakOutsideShift);
          continue;
        }
      }
    }

    return errors;
  }, [rows, companyRefByDay, cp]);

  const updateRow = (day: DayOfWeek, patch: Partial<DayScheduleRow>) => {
    setBackendError(null);
    setRows((prev) =>
      prev.map((row) => (row.dayOfWeek === day ? { ...row, ...patch } : row)),
    );
  };

  const handleSave = async () => {
    setBackendError(null);
    if (rowErrors.size > 0) {
      toast.error(cp.scheduleFixValidationHint);
      return;
    }

    setSaving(true);
    try {
      await syncCollaboratorSchedule(dossier.collaborator.id, {
        schedules: rows.map((row) => ({
          dayOfWeek: row.dayOfWeek,
          isWorkingDay: row.isWorkingDay,
          startTime: row.isWorkingDay ? row.startTime : null,
          endTime: row.isWorkingDay ? row.endTime : null,
          breakStartTime:
            row.isWorkingDay && row.hasBreak ? row.breakStartTime : null,
          breakEndTime:
            row.isWorkingDay && row.hasBreak ? row.breakEndTime : null,
        })),
      });
      toast.success(cp.scheduleSavedToast);
      await onRefresh();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription;
      setBackendError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border-subtle bg-surface p-5 sm:p-6 shadow-xs space-y-5">
      <div className="border-b border-border-subtle pb-4">
        <h2 className="text-base font-semibold text-ink inline-flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-accent" />
          {cp.scheduleTitle}
        </h2>
        <p className="mt-0.5 text-xs text-ink-muted">{cp.scheduleSubtitle}</p>
      </div>

      {backendError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs font-medium text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{backendError}</span>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          const compRef = companyRefByDay.get(row.dayOfWeek);
          const errorMsg = rowErrors.get(row.dayOfWeek);

          return (
            <div
              key={row.dayOfWeek}
              className={[
                "rounded-xl border p-4 transition-colors space-y-3",
                errorMsg
                  ? "border-red-500/50 bg-red-500/5"
                  : row.isWorkingDay
                    ? "border-border-strong bg-surface shadow-xs"
                    : "border-border-subtle bg-subtle/40 opacity-80",
              ].join(" ")}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                {/* Dia + Toggle Trabalha neste dia + Referência da Empresa */}
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer min-w-[155px]">
                    <input
                      type="checkbox"
                      checked={row.isWorkingDay}
                      onChange={(e) =>
                        updateRow(row.dayOfWeek, {
                          isWorkingDay: e.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded accent-accent cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-ink">
                      {t.days[row.dayOfWeek]}
                    </span>
                  </label>

                  {compRef && (
                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-subtle px-2.5 py-0.5 text-[11px] font-medium text-ink-muted tabular-nums">
                      {compRef.isOpen && compRef.openTime && compRef.closeTime
                        ? `${cp.companyHoursRef} ${compRef.openTime} – ${compRef.closeTime}`
                        : cp.companyClosedRef}
                    </span>
                  )}
                </div>

                {/* Horários de início/fim + toggle de intervalo */}
                {row.isWorkingDay ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-muted">
                        {cp.shiftStartLabel}
                      </span>
                      <Input
                        type="time"
                        value={row.startTime}
                        onChange={(e) =>
                          updateRow(row.dayOfWeek, { startTime: e.target.value })
                        }
                        className="h-9 w-28 rounded-lg border-border-strong bg-surface px-2 font-mono text-xs tabular-nums text-center"
                      />
                      <span className="text-xs text-ink-muted">–</span>
                      <span className="text-xs text-ink-muted">
                        {cp.shiftEndLabel}
                      </span>
                      <Input
                        type="time"
                        value={row.endTime}
                        onChange={(e) =>
                          updateRow(row.dayOfWeek, { endTime: e.target.value })
                        }
                        className="h-9 w-28 rounded-lg border-border-strong bg-surface px-2 font-mono text-xs tabular-nums text-center"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        updateRow(row.dayOfWeek, { hasBreak: !row.hasBreak })
                      }
                      className={[
                        "cursor-pointer inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                        row.hasBreak
                          ? "border-accent/40 bg-accent-soft text-accent"
                          : "border-border-subtle bg-subtle text-ink-secondary hover:text-ink",
                      ].join(" ")}
                    >
                      <Coffee className="h-3.5 w-3.5" />
                      {cp.breakToggleLabel}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-ink-muted italic">
                    {cp.dayOffLabel}
                  </span>
                )}
              </div>

              {/* Linha opcional de Intervalo / Almoço */}
              {row.isWorkingDay && row.hasBreak && (
                <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3 pl-0 sm:pl-6 text-xs">
                  <Coffee className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span className="font-medium text-ink-secondary mr-1">
                    {cp.breakToggleLabel}:
                  </span>
                  <Input
                    type="time"
                    value={row.breakStartTime}
                    aria-label={cp.breakStartLabel}
                    onChange={(e) =>
                      updateRow(row.dayOfWeek, {
                        breakStartTime: e.target.value,
                      })
                    }
                    className="h-8 w-28 rounded-lg border-border-strong bg-surface px-2 font-mono text-xs tabular-nums text-center"
                  />
                  <span className="text-ink-muted">–</span>
                  <Input
                    type="time"
                    value={row.breakEndTime}
                    aria-label={cp.breakEndLabel}
                    onChange={(e) =>
                      updateRow(row.dayOfWeek, { breakEndTime: e.target.value })
                    }
                    className="h-8 w-28 rounded-lg border-border-strong bg-surface px-2 font-mono text-xs tabular-nums text-center"
                  />
                </div>
              )}

              {/* Alerta imediato de validação */}
              {errorMsg && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {errorMsg}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-2 border-t border-border-subtle">
        <Button
          type="button"
          disabled={saving || rowErrors.size > 0}
          onClick={() => void handleSave()}
          className="cursor-pointer"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          {saving ? t.common.saving : cp.saveScheduleBtn}
        </Button>
      </div>
    </section>
  );
}
