"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Loader2, Save } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import type { DayOfWeek, WorkScheduleSlot } from "@/lib/types/team";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";

const DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

interface DayRowState {
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  startTime: string;
  endTime: string;
}

function buildDefaultRows(): DayRowState[] {
  return DAYS.map((day) => ({
    dayOfWeek: day,
    enabled: false,
    startTime: "09:00",
    endTime: "18:00",
  }));
}

function extractSchedules(raw: unknown): WorkScheduleSlot[] {
  if (Array.isArray(raw)) return raw as WorkScheduleSlot[];
  if (raw && typeof raw === "object" && "schedules" in raw) {
    const val = (raw as { schedules?: unknown }).schedules;
    if (Array.isArray(val)) return val as WorkScheduleSlot[];
  }
  return [];
}

function mapSlotsToRows(slots: WorkScheduleSlot[]): DayRowState[] {
  const map = new Map<DayOfWeek, WorkScheduleSlot>();
  for (const s of slots) {
    map.set(s.dayOfWeek, s);
  }
  return DAYS.map((day) => {
    const existing = map.get(day);
    return existing
      ? {
          dayOfWeek: day,
          enabled: existing.isWorkingDay,
          startTime: (existing.startTime ?? "09:00").slice(0, 5),
          endTime: (existing.endTime ?? "18:00").slice(0, 5),
        }
      : {
          dayOfWeek: day,
          enabled: false,
          startTime: "09:00",
          endTime: "18:00",
        };
  });
}

export function MySchedulePanel() {
  const { session } = useSession();
  const { t } = useLocale();

  const [rows, setRows] = useState<DayRowState[]>(buildDefaultRows);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const raw = await apiRequest<unknown>("/me/work-schedules", {
        auth: true,
      });
      setRows(mapSlotsToRows(extractSchedules(raw)));
    } catch (err) {
      setLoadError(
        err instanceof ApiError ? err.message : t.errors.networkDescription,
      );
    } finally {
      setLoading(false);
    }
  }, [t.errors.networkDescription]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const raw = await apiRequest<unknown>("/me/work-schedules", {
          auth: true,
        });
        if (!active) return;
        setRows(mapSlotsToRows(extractSchedules(raw)));
      } catch (err) {
        if (!active) return;
        setLoadError(
          err instanceof ApiError ? err.message : t.errors.networkDescription,
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [t.errors.networkDescription]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveError(null);
    setSaved(false);

    for (const row of rows) {
      if (row.enabled && row.startTime >= row.endTime) {
        setSaveError(t.errors.invalidTimeRange);
        return;
      }
    }

    setSaving(true);
    const schedules: WorkScheduleSlot[] = rows.map((r) => ({
      dayOfWeek: r.dayOfWeek,
      isWorkingDay: r.enabled,
      startTime: r.enabled ? r.startTime : null,
      endTime: r.enabled ? r.endTime : null,
    }));

    try {
      await apiRequest(
        `/collaborators/${encodeURIComponent(session.id)}/work-schedules`,
        {
          method: "PUT",
          auth: true,
          body: { schedules },
        },
      );
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setSaveError(t.errors.forbidden);
      } else {
        setSaveError(
          err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
        );
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-title-sm font-bold text-ink">
            {t.collaborator.scheduleTitle}
          </h2>
          <p className="mt-1 text-xs text-ink-secondary">
            {t.collaborator.scheduleSubtitle}
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-3 py-1.5 text-xs font-mono text-ink-muted">
          <Clock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          {session.company.timezone}
        </div>
      </div>

      {loading ? (
        <CardListSkeleton count={4} />
      ) : loadError ? (
        <ErrorState
          title={t.errors.networkTitle}
          description={loadError}
          retryLabel={t.common.retry}
          onRetry={() => void load()}
        />
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div
                key={row.dayOfWeek}
                className="rounded-2xl border border-border-subtle bg-surface p-4 space-y-3"
              >
                <label className="flex min-h-11 items-center justify-between gap-2 text-sm font-bold text-ink cursor-pointer">
                  <span>{t.days[row.dayOfWeek]}</span>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => {
                      setSaved(false);
                      setRows((prev) =>
                        prev.map((item) =>
                          item.dayOfWeek === row.dayOfWeek
                            ? { ...item, enabled: e.target.checked }
                            : item,
                        ),
                      );
                    }}
                    className="h-4 w-4 accent-accent"
                  />
                </label>

                {row.enabled ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Input
                      type="time"
                      aria-label={`${t.days[row.dayOfWeek]} ${t.common.startTime}`}
                      value={row.startTime}
                      onChange={(e) => {
                        setSaved(false);
                        setRows((prev) =>
                          prev.map((item) =>
                            item.dayOfWeek === row.dayOfWeek
                              ? { ...item, startTime: e.target.value }
                              : item,
                          ),
                        );
                      }}
                      className="min-h-11 rounded-xl border-border-strong bg-surface px-3 font-mono text-sm tabular-nums"
                    />
                    <Input
                      type="time"
                      aria-label={`${t.days[row.dayOfWeek]} ${t.common.endTime}`}
                      value={row.endTime}
                      onChange={(e) => {
                        setSaved(false);
                        setRows((prev) =>
                          prev.map((item) =>
                            item.dayOfWeek === row.dayOfWeek
                              ? { ...item, endTime: e.target.value }
                              : item,
                          ),
                        );
                      }}
                      className="min-h-11 rounded-xl border-border-strong bg-surface px-3 font-mono text-sm tabular-nums"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-ink-muted">{t.common.inactive}</p>
                )}
              </div>
            ))}
          </div>

          {saveError && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-3 text-xs font-medium text-[var(--status-danger-ink)]"
            >
              {saveError}
            </p>
          )}

          {saved && (
            <p
              role="status"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-4 py-3 text-xs font-medium text-[var(--status-success-ink)]"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              {t.owner.scheduleSaved}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-full bg-accent px-6 text-accent-ink hover:bg-accent-hover cursor-pointer"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-4 w-4" aria-hidden="true" />
              )}
              {t.common.save}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
