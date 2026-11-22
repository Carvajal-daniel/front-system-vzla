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
  ScheduleBlock,
} from "@/lib/types/appointment";
import type { Collaborator, CollaboratorsListResponse } from "@/lib/types/team";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { ConflictAlert } from "@/components/ui/conflict-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { AgendaBlockForm } from "@/components/ui/agenda-block-form";
import { AgendaDialog } from "@/components/ui/agenda-controls";
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
    void (async () => {
      try {
        const [blocksRes, collabsRes] = await Promise.all([
          apiRequest<ScheduleBlock[]>("/schedule-blocks", { auth: true }),
          apiRequest<CollaboratorsListResponse>("/collaborators", {
            auth: true,
          }),
        ]);
        if (!active) return;
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
  }, [t.errors.networkDescription]);

  const collaboratorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of collaborators) {
      map.set(c.id, c.name);
    }
    return map;
  }, [collaborators]);

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
    setAffectedAppointments([]);
    setDrawerOpen(true);
  };

  const handleClearCollaboratorFilter = () => router.replace("/owner/blocks");

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

      {drawerOpen && (
        <AgendaDialog title={t.owner.newBlock} closeDisabled={submitting} onClose={() => setDrawerOpen(false)}>
          <AgendaBlockForm
            company={session.company}
            collaborators={collaborators}
            initialDate={getTodayIsoDateInTimezone(timezone)}
            initialPersonId={filterCollaboratorId || undefined}
            onClose={() => setDrawerOpen(false)}
            onSavingChange={setSubmitting}
            onCreated={(created) => {
              setBlocks((current) => [...created.map((result) => result.block).reverse(), ...current]);
              setAffectedAppointments((current) => Array.from(new Map(
                [...current, ...created.flatMap((result) => result.affectedAppointments ?? [])].map((row) => [row.id, row]),
              ).values()));
            }}
          />
        </AgendaDialog>
      )}
    </div>
  );
}
