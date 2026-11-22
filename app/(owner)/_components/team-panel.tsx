"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarCheck,
  CalendarOff,
  Check,
  Copy,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  UserCheck,
  UserRound,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api-client";
import {
  formatPercentage,
  formatPrice,
  stripNonDigits,
} from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  getCollaboratorFutureAppointmentsCount,
  resolveCollaboratorAvatarUrl,
  updateCollaboratorStatus,
  type Collaborator,
  type CollaboratorsListResponse,
  type TeamKpis,
} from "@/lib/types/team";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { usePlanLimits } from "@/lib/use-plan-limits";
import {
  NewCollaboratorModal,
  type GeneratedInvite,
} from "./new-collaborator-modal";
import { RankingCriteriaModal } from "./ranking-criteria-modal";
import { DeactivationModal } from "./collaborator-profile/deactivation-modal";

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function TeamPanel() {
  const router = useRouter();
  const { session } = useSession();
  const { locale, t } = useLocale();
  const td = t.owner.teamDirectory;

  const currency = session.company.currency ?? "BRL";

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [teamKpis, setTeamKpis] = useState<TeamKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Busca e filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const { limits } = usePlanLimits();

  // Modais
  const [createOpen, setCreateOpen] = useState(false);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [invite, setInvite] = useState<GeneratedInvite | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Atalho rápido de afastamento / reativação nos cards
  const [leaveTarget, setLeaveTarget] = useState<{
    id: string;
    name: string;
    futureCount: number;
  } | null>(null);
  const [checkingLeaveId, setCheckingLeaveId] = useState<string | null>(null);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<CollaboratorsListResponse>("/collaborators", {
        auth: true,
      });
      setCollaborators(res.collaborators ?? []);
      setTeamKpis(res.teamKpis ?? null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t.errors.networkDescription,
      );
    } finally {
      setLoading(false);
    }
  }, [t.errors.networkDescription]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  // Fallback seguro caso o backend ainda não retorne teamKpis
  const computedKpis = useMemo<TeamKpis>(() => {
    if (teamKpis) return teamKpis;
    const activeCount = collaborators.filter(
      (c) => (c.status ? c.status === "ACTIVE" : c.isActive),
    ).length;
    return {
      totalCollaborators: collaborators.length,
      activeCollaborators: activeCount,
      totalCompletedAppointmentsMonth: collaborators.reduce(
        (sum, c) => sum + (c.completedAppointmentsMonth ?? 0),
        0,
      ),
      totalRevenueMonthInCents: collaborators.reduce(
        (sum, c) => sum + (c.revenueMonthInCents ?? 0),
        0,
      ),
      averageTeamRating: 5.0,
    };
  }, [teamKpis, collaborators]);

  const filteredCollaborators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return collaborators.filter((collab) => {
      const isActive = collab.status ? collab.status === "ACTIVE" : collab.isActive;
      if (statusFilter === "ACTIVE" && !isActive) return false;
      if (statusFilter === "INACTIVE" && isActive) return false;

      if (!q) return true;
      return (
        collab.name.toLowerCase().includes(q) ||
        collab.specialty.toLowerCase().includes(q)
      );
    });
  }, [collaborators, searchQuery, statusFilter]);

  const handleCreated = (generatedInvite: GeneratedInvite) => {
    setCreateOpen(false);
    setInvite(generatedInvite);
    setInviteCopied(false);
    void loadTeam();
  };

  const buildInviteMessage = (inv: GeneratedInvite) =>
    `${inv.name}, seu acesso ao portal está pronto!\nLink: ${inv.loginUrl}\nE-mail: ${inv.email}\nSenha: ${inv.tempPassword}`;

  const handleCopyInvite = async () => {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(buildInviteMessage(invite));
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 2500);
    } catch {
      // Clipboard indisponível
    }
  };

  const handleSendInviteWhatsApp = () => {
    if (!invite) return;
    const digits = stripNonDigits(invite.phoneE164);
    const text = encodeURIComponent(buildInviteMessage(invite));
    window.open(`https://wa.me/${digits}?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const handleOpenQuickLeave = async (collab: Collaborator) => {
    setCheckingLeaveId(collab.id);
    try {
      const res = await getCollaboratorFutureAppointmentsCount(collab.id);
      setLeaveTarget({
        id: collab.id,
        name: collab.name,
        futureCount: res.futureAppointmentsCount ?? 0,
      });
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setCheckingLeaveId(null);
    }
  };

  const handleQuickReactivate = async (collab: Collaborator) => {
    setReactivatingId(collab.id);
    try {
      await updateCollaboratorStatus(collab.id, true);
      toast.success(t.owner.collaboratorProfile.reactivatedToast);
      await loadTeam();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setReactivatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="h-24 rounded-2xl border border-border-subtle bg-surface animate-pulse"
            />
          ))}
        </div>
        <CardListSkeleton count={4} />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={t.errors.unexpectedTitle}
        description={error}
        retryLabel={t.common.retry}
        onRetry={() => void loadTeam()}
      />
    );
  }

  const reachedLimit = computedKpis.activeCollaborators >= limits.maxProfessionals;

  return (
    <div className="space-y-6">
      {/* Banner de Limite de Plano Atingido */}
      {reachedLimit && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-semibold">
            <AlertCircle className="size-5 shrink-0" />
            <span>
              Você atingiu o limite de {limits.maxProfessionals} profissionais ativos do seu plano ({computedKpis.activeCollaborators}/{limits.maxProfessionals}). Faça upgrade para o plano Pro para adicionar mais membros.
            </span>
          </div>
          <Link
            href="/owner/settings"
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-accent-ink hover:bg-accent-hover transition-colors shrink-0"
          >
            <Sparkles size={13} />
            <span>Fazer Upgrade</span>
          </Link>
        </div>
      )}

      {/* Header Principal */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {t.owner.teamTitle}
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">{td.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCriteriaOpen(true)}
            className="cursor-pointer border-border-strong bg-surface text-ink hover:bg-subtle"
          >
            <SlidersHorizontal className="h-4 w-4 mr-1.5 text-accent" />
            {td.criteriaAndAwardsBtn}
          </Button>

          <Button
            type="button"
            disabled={reachedLimit}
            onClick={() => {
              if (reachedLimit) {
                toast.error(
                  `Limite de profissionais atingido (${computedKpis.activeCollaborators}/${limits.maxProfessionals}). Faça upgrade para adicionar mais.`,
                );
                return;
              }
              setCreateOpen(true);
            }}
            className={`cursor-pointer ${
              reachedLimit
                ? "opacity-50 cursor-not-allowed bg-surface border border-border-subtle text-ink-muted"
                : "bg-accent text-accent-ink hover:bg-accent-hover"
            }`}
            title={reachedLimit ? "Limite de profissionais do plano atingido" : undefined}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {t.owner.newCollaborator}
          </Button>
        </div>
      </div>

      {/* 4 Cards de KPIs Consolidados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border-subtle bg-surface p-4 flex items-center gap-3.5 transition-colors">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-muted truncate">
              {td.kpiActiveTeam}
            </p>
            <p className="text-xl font-semibold text-ink mt-0.5 tabular-nums">
              {computedKpis.activeCollaborators}
              <span className="text-sm font-normal text-ink-muted">
                {" "}
                / {computedKpis.totalCollaborators}
              </span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 flex items-center gap-3.5 transition-colors">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-muted truncate">
              {td.kpiMonthlyAppointments}
            </p>
            <p className="text-xl font-semibold text-ink mt-0.5 tabular-nums">
              {computedKpis.totalCompletedAppointmentsMonth}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 flex items-center gap-3.5 transition-colors">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-muted truncate">
              {td.kpiMonthlyRevenue}
            </p>
            <p className="text-xl font-semibold text-ink mt-0.5 tabular-nums truncate">
              {formatPrice(
                computedKpis.totalRevenueMonthInCents / 100,
                locale,
                currency,
              )}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-4 flex items-center gap-3.5 transition-colors">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
            <Star className="h-5 w-5 fill-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink-muted truncate">
              {td.kpiAverageRating}
            </p>
            <p className="text-xl font-semibold text-ink mt-0.5 tabular-nums flex items-center gap-1">
              {computedKpis.averageTeamRating.toFixed(1)}
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={td.searchPlaceholder}
            className="pl-10 bg-surface"
          />
        </div>

        <div className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface p-1 self-start sm:self-auto">
          {(
            [
              { key: "ALL", label: td.filterAll },
              { key: "ACTIVE", label: td.filterActive },
              { key: "INACTIVE", label: td.filterInactive },
            ] as const
          ).map((pill) => {
            const selected = statusFilter === pill.key;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => setStatusFilter(pill.key)}
                className={[
                  "cursor-pointer rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
                  selected
                    ? "bg-accent text-accent-ink shadow-xs"
                    : "text-ink-secondary hover:text-ink hover:bg-subtle",
                ].join(" ")}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de Cards Verticais (Formato Retrato) */}
      {collaborators.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={t.owner.teamTitle}
          description={td.subtitle}
          action={
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              {t.owner.newCollaborator}
            </Button>
          }
        />
      ) : filteredCollaborators.length === 0 ? (
        <EmptyState
          icon={<Search className="h-6 w-6" />}
          title={td.emptyFilterTitle}
          description={td.emptyFilterDescription}
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
              className="cursor-pointer"
            >
              {td.clearFilters}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredCollaborators.map((collab) => {
            const avatarSrc = resolveCollaboratorAvatarUrl(collab.avatarUrl);
            const isActive = collab.status
              ? collab.status === "ACTIVE"
              : collab.isActive;
            const rankPos = collab.rankingPosition ?? 0;
            const rankScore = Math.round(collab.rankingScore ?? 0);
            const avgRating = collab.averageRating ?? 0;
            const totalReviews = collab.totalReviews ?? 0;
            const awardsCount = collab.awardsCount ?? 0;
            const completedMonth = collab.completedAppointmentsMonth ?? 0;
            const commissionMonth = collab.commissionMonthInCents ?? 0;
            const commissionRate =
              collab.defaultCommissionRate && collab.defaultCommissionRate > 0
                ? collab.defaultCommissionRate
                : collab.commissionPercentage;

            const rawWhatsapp = collab.whatsapp || collab.phone;
            const whatsappDigits = rawWhatsapp ? stripNonDigits(rawWhatsapp) : "";
            const hasWhatsapp = whatsappDigits.length >= 8;
            const profileHref = `/owner/collaborators/${encodeURIComponent(collab.id)}`;
            const blocksHref = `/owner/blocks?collaboratorId=${encodeURIComponent(collab.id)}`;

            return (
              <article
                key={collab.id}
                className={[
                  "group flex flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md",
                  !isActive ? "opacity-75" : "",
                ].join(" ")}
              >
                {/* Cabeçalho Retrato (Foto ou Gradiente com Iniciais) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(profileHref)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(profileHref);
                    }
                  }}
                  className="cursor-pointer relative h-48 w-full overflow-hidden bg-subtle select-none"
                >
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={collab.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{
                        background:
                          "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 18%, var(--surface-subtle)) 0%, var(--surface-elevated) 100%)",
                      }}
                    >
                      <span className="text-4xl font-semibold tracking-tight text-accent/85">
                        {getInitials(collab.name)}
                      </span>
                    </div>
                  )}

                  {/* Gradiente sutil inferior para legibilidade */}
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-slate-950/35 to-transparent" />

                  {/* Badge de Ranking (Canto Superior Esquerdo) */}
                  {rankPos > 0 && (
                    <div
                      className={[
                        "absolute top-3 left-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold shadow-xs backdrop-blur-md",
                        rankPos === 1
                          ? "bg-amber-400/95 text-slate-950"
                          : "bg-slate-900/75 text-white",
                      ].join(" ")}
                    >
                      {(rankPos === 1 || awardsCount > 0) && (
                        <Trophy className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>#{rankPos}</span>
                    </div>
                  )}

                  {/* Pill de Status (Canto Superior Direito) */}
                  <span
                    className={[
                      "absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-xs backdrop-blur-md",
                      isActive
                        ? "bg-emerald-500/90 text-white"
                        : "bg-slate-700/85 text-slate-100",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-1.5 w-1.5 rounded-full",
                        isActive ? "bg-emerald-100" : "bg-slate-300",
                      ].join(" ")}
                    />
                    {isActive ? t.common.active : t.common.inactive}
                  </span>
                </div>

                {/* Corpo de Identidade & Avaliação */}
                <div className="flex flex-1 flex-col p-4">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(profileHref)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(profileHref);
                      }
                    }}
                    className="cursor-pointer min-w-0"
                  >
                    <h2 className="truncate text-base font-semibold text-ink group-hover:text-accent transition-colors">
                      {collab.name}
                    </h2>
                    <p className="truncate text-xs text-ink-muted mt-0.5">
                      {collab.specialty}
                    </p>
                  </div>

                  {/* Linha de Estrelas e Score de Ranking */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1 text-xs font-medium text-ink">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                      {totalReviews > 0 ? (
                        <>
                          <span className="tabular-nums">
                            {avgRating.toFixed(1)}
                          </span>
                          <span className="text-ink-muted">
                            ({totalReviews})
                          </span>
                        </>
                      ) : (
                        <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
                          {td.newBadge}
                        </span>
                      )}
                    </div>

                    <span className="inline-flex items-center rounded-full border border-border-subtle bg-subtle px-2 py-0.5 text-[11px] font-medium text-ink-secondary tabular-nums">
                      {rankScore} {td.rankingPts}
                    </span>
                  </div>

                  {/* Mini-Métricas do Mês (2 colunas compactas) */}
                  <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-border-subtle bg-subtle/60 p-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] text-ink-muted truncate">
                        {td.appointmentsMonthLabel}
                      </p>
                      <p className="text-sm font-semibold text-ink tabular-nums mt-0.5">
                        {completedMonth}
                      </p>
                    </div>

                    <div className="min-w-0 border-l border-border-subtle pl-2.5">
                      <p className="text-[11px] text-ink-muted truncate">
                        {td.commissionMonthLabel}
                      </p>
                      <p className="text-sm font-semibold text-ink tabular-nums mt-0.5 truncate">
                        {formatPrice(commissionMonth / 100, locale, currency)}
                      </p>
                      <p className="text-[10px] text-ink-muted tabular-nums">
                        {formatPercentage(commissionRate, locale)}
                      </p>
                    </div>
                  </div>

                  {/* Rodapé de Ações Rápidas */}
                  <div className="mt-4 pt-3 border-t border-border-subtle flex items-center gap-2">
                    <Link
                      href={profileHref}
                      className="cursor-pointer flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-xs font-medium text-accent-ink hover:bg-accent-hover transition-colors"
                    >
                      <UserRound className="h-3.5 w-3.5" />
                      {td.viewProfile}
                    </Link>

                    {hasWhatsapp ? (
                      <a
                        href={`https://wa.me/${whatsappDigits}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={td.whatsappAction}
                        aria-label={td.whatsappAction}
                        className="cursor-pointer inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-subtle text-[#25D366] hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-colors"
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        disabled
                        title={td.whatsappUnavailable}
                        aria-label={td.whatsappUnavailable}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-subtle text-ink-muted opacity-40 cursor-not-allowed"
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                      </button>
                    )}

                    <Link
                      href={blocksHref}
                      title={td.quickBlockAction}
                      aria-label={td.quickBlockAction}
                      className="cursor-pointer inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-subtle text-ink-secondary hover:text-ink hover:border-border-strong transition-colors"
                    >
                      <CalendarOff className="h-4 w-4" />
                    </Link>

                    {isActive ? (
                      <button
                        type="button"
                        disabled={checkingLeaveId === collab.id}
                        onClick={() => void handleOpenQuickLeave(collab)}
                        title={td.quickLeaveAction}
                        aria-label={td.quickLeaveAction}
                        className="cursor-pointer inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-subtle text-ink-secondary hover:text-red-600 dark:hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        {checkingLeaveId === collab.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserX className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={reactivatingId === collab.id}
                        onClick={() => void handleQuickReactivate(collab)}
                        title={td.quickReactivateAction}
                        aria-label={td.quickReactivateAction}
                        className="cursor-pointer inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-subtle text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                      >
                        {reactivatingId === collab.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal de Cadastro Enriquecido (+ Novo Colaborador) */}
      <NewCollaboratorModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      {/* Modal de Critérios do Funcionário do Mês & Premiação */}
      <RankingCriteriaModal
        open={criteriaOpen}
        onClose={() => setCriteriaOpen(false)}
        onUpdated={loadTeam}
      />

      {/* Modal Rápido de Afastamento / Desativação Estruturada */}
      {leaveTarget && (
        <DeactivationModal
          open={true}
          collaboratorId={leaveTarget.id}
          collaboratorName={leaveTarget.name}
          futureCount={leaveTarget.futureCount}
          title={t.owner.collaboratorProfile.quickLeaveModalTitle}
          onClose={() => setLeaveTarget(null)}
          onDeactivated={loadTeam}
        />
      )}

      {/* Modal de Convite Gerado (Pós-criação) */}
      <Modal
        open={invite !== null}
        onClose={() => setInvite(null)}
        title={t.owner.inviteTitle}
      >
        {invite && (
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary">{t.owner.inviteSubtitle}</p>

            <div className="rounded-xl border border-border-subtle bg-subtle p-4 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-ink-muted">{t.auth.nameLabel}:</span>
                <span className="font-medium text-ink">{invite.name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-ink-muted">{t.auth.emailLabel}:</span>
                <span className="font-mono text-ink">{invite.email}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-ink-muted">{t.owner.tempPasswordLabel}:</span>
                <span className="font-mono font-semibold text-ink">
                  {invite.tempPassword}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-ink-muted">{t.owner.loginLinkLabel}:</span>
                <span className="font-mono text-ink truncate max-w-[200px]">
                  {invite.loginUrl}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyInvite}
                className="cursor-pointer"
              >
                {inviteCopied ? (
                  <Check className="h-4 w-4 mr-1.5 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4 mr-1.5" />
                )}
                {inviteCopied ? t.common.copied : t.owner.copyInvite}
              </Button>

              <Button
                type="button"
                onClick={handleSendInviteWhatsApp}
                className="cursor-pointer bg-[#25D366] text-slate-950 hover:bg-[#1ebe5d]"
              >
                <WhatsAppIcon className="h-4 w-4 mr-1.5" />
                {t.owner.sendWhatsApp}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
