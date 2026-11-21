"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Ban, Globe2, Loader2, Plus, Trash2, User, X } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api-client";
import {
  formatDateTimeInTimezone,
  getTodayIsoDateInTimezone,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type {
  AffectedAppointment,
  CreateScheduleBlockPayload,
  CreateScheduleBlockResponse,
  ScheduleBlock,
} from "@/lib/types/appointment";
import type { Collaborator, CollaboratorsListResponse } from "@/lib/types/team";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { ConflictAlert } from "@/components/ui/conflict-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";

export function BlocksPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterCollaboratorId = searchParams.get("collaboratorId")?.trim() ?? "";

  const { session } = useSession();
  const { locale, t } = useLocale();
  const td = t.owner.teamDirectory;
  const timezone = session.company.timezone;

  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [affectedAppointments, setAffectedAppointments] = useState<
    AffectedAppointment[]
  >([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collaboratorId, setCollaboratorId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("12:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("13:00");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [blocksRes, collabsRes] = await Promise.all([
        apiRequest<ScheduleBlock[]>("/schedule-blocks", { auth: true }),
        apiRequest<CollaboratorsListResponse>("/collaborators", { auth: true }),
      ]);
      setBlocks(Array.isArray(blocksRes) ? blocksRes : []);
      setCollaborators(collabsRes.collaborators ?? []);
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
        const [blocksRes, collabsRes] = await Promise.all([
          apiRequest<ScheduleBlock[]>("/schedule-blocks", { auth: true }),
          apiRequest<CollaboratorsListResponse>("/collaborators", {
            auth: true,
          }),
        ]);
        if (!active) return;
        setStartDate(today);
        setEndDate(today);
        setBlocks(Array.isArray(blocksRes) ? blocksRes : []);
        setCollaborators(collabsRes.collaborators ?? []);
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

  const collaboratorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of collaborators) {
      map.set(c.id, c.name);
    }
    return map;
  }, [collaborators]);

  // Pré-seleciona o colaborador no formulário quando o filtro via query param estiver ativo
  useEffect(() => {
    if (filterCollaboratorId) {
      setCollaboratorId(filterCollaboratorId);
    }
  }, [filterCollaboratorId]);

  const filteredBlocks = useMemo(() => {
    if (!filterCollaboratorId) return blocks;
    return blocks.filter((b) => b.collaboratorId === filterCollaboratorId);
  }, [blocks, filterCollaboratorId]);

  const filteredCollaboratorName = filterCollaboratorId
    ? (collaboratorMap.get(filterCollaboratorId) ?? filterCollaboratorId)
    : null;

  const kpis = useMemo(() => {
    const total = filteredBlocks.length;
    const globalCount = filteredBlocks.filter((b) => b.collaboratorId === null).length;
    return { total, globalCount, individualCount: total - globalCount };
  }, [filteredBlocks]);

  const handleOpenNewBlock = () => {
    setFormError(null);
    setCollaboratorId(filterCollaboratorId || "");
    setDrawerOpen(true);
  };

  const handleClearCollaboratorFilter = () => {
    setCollaboratorId("");
    router.replace("/owner/blocks");
  };

  const handleCreateBlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const startIso = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endIso = new Date(`${endDate}T${endTime}:00`).toISOString();

    if (new Date(startIso) >= new Date(endIso)) {
      setFormError(t.errors.invalidTimeRange);
      return;
    }

    setSubmitting(true);
    const payload: CreateScheduleBlockPayload = {
      collaboratorId: collaboratorId ? collaboratorId : null,
      startsAt: startIso,
      endsAt: endIso,
      reason: reason.trim() || null,
    };

    try {
      const res = await apiRequest<CreateScheduleBlockResponse>(
        "/schedule-blocks",
        {
          method: "POST",
          auth: true,
          body: payload,
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
      await apiRequest<void>(`/schedule-blocks/${encodeURIComponent(blockId)}`, {
        method: "DELETE",
        auth: true,
      });
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
      {/* KPI Cards */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card-interactive rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">
              {t.owner.blocksTitle}
            </span>
            <Ban className="h-4 w-4 text-accent" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            {kpis.total}
          </p>
        </div>

        <div className="card-interactive rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">
              {t.owner.globalBlock}
            </span>
            <Globe2 className="h-4 w-4 text-accent" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            {kpis.globalCount}
          </p>
        </div>

        <div className="card-interactive rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted">
              {t.booking.stepProfessional}
            </span>
            <User className="h-4 w-4 text-accent" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-ink tabular-nums">
            {kpis.individualCount}
          </p>
        </div>
      </section>

      <ConflictAlert
        affectedAppointments={affectedAppointments}
        timezone={timezone}
        onDismiss={() => setAffectedAppointments([])}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-title-sm font-bold text-ink">
            {t.owner.blocksTitle}
          </h2>

          {filteredCollaboratorName && (
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
              <span>
                {td.blocksFilteredByPrefix} {filteredCollaboratorName}
              </span>
              <button
                type="button"
                onClick={handleClearCollaboratorFilter}
                aria-label={td.clearBlockFilterBtn}
                title={td.clearBlockFilterBtn}
                className="cursor-pointer inline-flex items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[11px] hover:bg-accent/25 transition-colors"
              >
                <X className="h-3 w-3" />
                <span>{td.clearBlockFilterBtn}</span>
              </button>
            </span>
          )}
        </div>
        <Button
          type="button"
          onClick={handleOpenNewBlock}
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
          onRetry={() => void loadData()}
        />
      ) : filteredBlocks.length === 0 ? (
        <EmptyState
          title={t.common.noData}
          description={t.owner.blocksTitle}
          icon={<Ban className="h-6 w-6" aria-hidden="true" />}
          action={
            <Button
              type="button"
              onClick={handleOpenNewBlock}
              className="min-h-11 rounded-full bg-accent px-5 text-accent-ink hover:bg-accent-hover cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t.owner.newBlock}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredBlocks.map((block) => (
            <article
              key={block.id}
              className="card-interactive flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    tone={block.collaboratorId === null ? "accent" : "neutral"}
                    label={
                      block.collaboratorId === null
                        ? t.owner.globalBlock
                        : (collaboratorMap.get(block.collaboratorId) ??
                          block.collaboratorId)
                    }
                  />
                </div>
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
        <form onSubmit={handleCreateBlock} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="block-collab">{t.booking.stepProfessional}</Label>
            <select
              id="block-collab"
              value={collaboratorId}
              onChange={(e) => setCollaboratorId(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink"
            >
              <option value="">{t.owner.globalBlock}</option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {collaborators.find((c) => c.id === collaboratorId) && (
              <div className="flex items-center gap-2.5 rounded-xl border border-border-subtle bg-subtle/40 p-2">
                {collaborators.find((c) => c.id === collaboratorId)?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={collaborators.find((c) => c.id === collaboratorId)!.avatarUrl!}
                    alt={collaborators.find((c) => c.id === collaboratorId)!.name}
                    className="h-8 w-8 shrink-0 rounded-full object-cover border border-border-subtle"
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent text-xs font-semibold">
                    {collaborators.find((c) => c.id === collaboratorId)!.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink truncate">
                    {collaborators.find((c) => c.id === collaboratorId)!.name}
                  </p>
                  {collaborators.find((c) => c.id === collaboratorId)!.specialty && (
                    <p className="text-[11px] text-ink-secondary truncate">
                      {collaborators.find((c) => c.id === collaboratorId)!.specialty}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="block-start-date">{t.common.startDate}</Label>
              <Input
                id="block-start-date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3 tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-start-time">{t.common.startTime}</Label>
              <Input
                id="block-start-time"
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
              <Label htmlFor="block-end-date">{t.common.endDate}</Label>
              <Input
                id="block-end-date"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3 tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-end-time">{t.common.endTime}</Label>
              <Input
                id="block-end-time"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="min-h-11 rounded-xl border-border-strong bg-surface px-3 tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="block-reason">{t.common.reasonOptional}</Label>
            <Input
              id="block-reason"
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
