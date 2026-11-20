"use client";

import { useCallback, useEffect, useState } from "react";
import { Ban, Loader2, Plus, Trash2 } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api-client";
import {
  formatDateTimeInTimezone,
  getTodayIsoDateInTimezone,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type {
  AffectedAppointment,
  CreateScheduleBlockResponse,
  ScheduleBlock,
} from "@/lib/types/appointment";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { ConflictAlert } from "@/components/ui/conflict-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";

export function MyBlocksPanel() {
  const { session } = useSession();
  const { locale, t } = useLocale();
  const timezone = session.company.timezone;

  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [affectedAppointments, setAffectedAppointments] = useState<
    AffectedAppointment[]
  >([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("12:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("13:00");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBlocks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<ScheduleBlock[]>("/me/schedule-blocks", {
        auth: true,
      });
      setBlocks(Array.isArray(res) ? res : []);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t.errors.networkDescription,
      );
    } finally {
      setLoading(false);
    }
  }, [t.errors.networkDescription]);

  useEffect(() => {
    let active = true;
    const today = getTodayIsoDateInTimezone(timezone);
    void (async () => {
      try {
        const res = await apiRequest<ScheduleBlock[]>("/me/schedule-blocks", {
          auth: true,
        });
        if (!active) return;
        setStartDate(today);
        setEndDate(today);
        setBlocks(Array.isArray(res) ? res : []);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof ApiError ? err.message : t.errors.networkDescription,
        );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [timezone, t.errors.networkDescription]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const startsAt = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endsAt = new Date(`${endDate}T${endTime}:00`).toISOString();
    if (new Date(startsAt) >= new Date(endsAt)) {
      setFormError(t.errors.invalidTimeRange);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<CreateScheduleBlockResponse>(
        "/me/schedule-blocks",
        {
          method: "POST",
          auth: true,
          body: {
            startsAt,
            endsAt,
            reason: reason.trim() || null,
          },
        },
      );
      setBlocks((prev) => [res.block, ...prev]);
      setAffectedAppointments(res.affectedAppointments ?? []);
      setDrawerOpen(false);
      setReason("");
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (blockId: string) => {
    setDeletingId(blockId);
    try {
      await apiRequest<void>(
        `/me/schedule-blocks/${encodeURIComponent(blockId)}`,
        {
          method: "DELETE",
          auth: true,
        },
      );
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <ConflictAlert
        affectedAppointments={affectedAppointments}
        timezone={timezone}
        onDismiss={() => setAffectedAppointments([])}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title-sm font-bold text-ink">
          {t.collaborator.blocksTitle}
        </h2>
        <Button
          type="button"
          onClick={() => {
            setFormError(null);
            setDrawerOpen(true);
          }}
          className="min-h-11 rounded-full bg-accent px-5 text-accent-ink hover:bg-accent-hover cursor-pointer"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t.owner.newBlock}
        </Button>
      </div>

      {loading ? (
        <CardListSkeleton count={3} />
      ) : error ? (
        <ErrorState
          title={t.errors.networkTitle}
          description={error}
          retryLabel={t.common.retry}
          onRetry={() => void loadBlocks()}
        />
      ) : blocks.length === 0 ? (
        <EmptyState
          title={t.common.noData}
          description={t.collaborator.blocksTitle}
          icon={<Ban className="h-6 w-6" aria-hidden="true" />}
          action={
            <Button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="min-h-11 rounded-full bg-accent px-5 text-accent-ink hover:bg-accent-hover cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t.owner.newBlock}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {blocks.map((block) => (
            <article
              key={block.id}
              className="card-interactive flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="space-y-1 min-w-0">
                <p className="font-mono text-sm font-semibold text-ink tabular-nums">
                  {formatDateTimeInTimezone(block.startsAt, timezone, locale)} →{" "}
                  {formatDateTimeInTimezone(block.endsAt, timezone, locale)}
                </p>
                {block.reason && (
                  <p className="text-xs text-ink-secondary">{block.reason}</p>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={deletingId === block.id}
                onClick={() => void handleDelete(block.id)}
                className="min-h-11 rounded-xl border-[var(--status-danger-border)] text-[var(--status-danger-ink)] hover:bg-[var(--status-danger-bg)] cursor-pointer"
              >
                {deletingId === block.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                {t.common.delete}
              </Button>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={drawerOpen}
        title={t.owner.newBlock}
        maxWidth="max-w-lg"
        onClose={() => setDrawerOpen(false)}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="me-block-start-date">{t.common.startDate}</Label>
              <Input
                id="me-block-start-date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3 tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="me-block-start-time">{t.common.startTime}</Label>
              <Input
                id="me-block-start-time"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3 tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="me-block-end-date">{t.common.endDate}</Label>
              <Input
                id="me-block-end-date"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3 tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="me-block-end-time">{t.common.endTime}</Label>
              <Input
                id="me-block-end-time"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3 tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="me-block-reason">{t.common.reasonOptional}</Label>
            <Input
              id="me-block-reason"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-11 rounded-xl border-border-strong bg-surface px-3.5"
            />
          </div>

          {formError && (
            <p
              role="alert"
              className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3.5 py-2.5 text-xs font-medium text-[var(--status-danger-ink)]"
            >
              {formError}
            </p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="min-h-11 w-full rounded-full bg-accent text-accent-ink hover:bg-accent-hover cursor-pointer"
          >
            {submitting && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {t.common.save}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
