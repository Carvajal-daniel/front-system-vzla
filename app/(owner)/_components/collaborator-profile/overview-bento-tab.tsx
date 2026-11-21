"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Award,
  Briefcase,
  CalendarClock,
  Camera,
  CheckCircle2,
  Clock,
  DollarSign,
  Loader2,
  Mail,
  Pencil,
  Percent,
  Phone,
  ShoppingBag,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { formatPercentage, formatPrice, stripNonDigits } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  resolveCollaboratorAvatarUrl,
  updateCollaboratorProfile,
  uploadCollaboratorAvatar,
  type CollaboratorProfileDossier,
} from "@/lib/types/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";

const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatDateInputValue(isoDate?: string | null): string {
  if (!isoDate) return "";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function formatReferenceMonth(refMonth: string, locale: string): string {
  // Converte YYYY-MM para formato curto localizado (ex.: Out/2026 ou Oct/2026)
  const match = /^(\d{4})-(\d{2})$/.exec(refMonth.trim());
  if (!match) return refMonth;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const d = new Date(Date.UTC(year, monthIdx, 15));
  if (Number.isNaN(d.getTime())) return refMonth;
  const monthLabel = new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "pt-BR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(d)
    .replace(".", "");
  const capitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  return `${capitalized}/${year}`;
}

interface OverviewBentoTabProps {
  dossier: CollaboratorProfileDossier;
  currency: string;
  onRefresh: () => Promise<void>;
}

export function OverviewBentoTab({
  dossier,
  currency,
  onRefresh,
}: OverviewBentoTabProps) {
  const { locale, t } = useLocale();
  const cp = t.owner.collaboratorProfile;
  const td = t.owner.teamDirectory;

  const { collaborator, ranking, stats, awards, recentReviews } = dossier;

  // Upload direto de avatar com preview imediato
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Modal de edição de perfil
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(collaborator.name);
  const [editSpecialty, setEditSpecialty] = useState(collaborator.specialty);
  const [editPhone, setEditPhone] = useState(collaborator.phone);
  const [editWhatsapp, setEditWhatsapp] = useState(collaborator.whatsapp ?? "");
  const [editCommission, setEditCommission] = useState(
    String(
      collaborator.defaultCommissionRate && collaborator.defaultCommissionRate > 0
        ? collaborator.defaultCommissionRate
        : collaborator.commissionPercentage,
    ),
  );
  const [editMonthlyGoal, setEditMonthlyGoal] = useState(
    collaborator.monthlyRevenueGoal && collaborator.monthlyRevenueGoal > 0
      ? String(collaborator.monthlyRevenueGoal / 100)
      : "",
  );
  const [editHiredAt, setEditHiredAt] = useState(
    formatDateInputValue(collaborator.hiredAt),
  );
  const [editBio, setEditBio] = useState(collaborator.bio ?? "");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Sincroniza formulário quando o dossiê é atualizado
  useEffect(() => {
    setEditName(collaborator.name);
    setEditSpecialty(collaborator.specialty);
    setEditPhone(collaborator.phone);
    setEditWhatsapp(collaborator.whatsapp ?? "");
    setEditCommission(
      String(
        collaborator.defaultCommissionRate && collaborator.defaultCommissionRate > 0
          ? collaborator.defaultCommissionRate
          : collaborator.commissionPercentage,
      ),
    );
    setEditMonthlyGoal(
      collaborator.monthlyRevenueGoal && collaborator.monthlyRevenueGoal > 0
        ? String(collaborator.monthlyRevenueGoal / 100)
        : "",
    );
    setEditHiredAt(formatDateInputValue(collaborator.hiredAt));
    setEditBio(collaborator.bio ?? "");
  }, [collaborator]);

  // Libera ObjectURL do preview local para evitar vazamento de memória
  useEffect(() => {
    return () => {
      if (localAvatarPreview) {
        URL.revokeObjectURL(localAvatarPreview);
      }
    };
  }, [localAvatarPreview]);

  const avatarSrc =
    localAvatarPreview ?? resolveCollaboratorAvatarUrl(collaborator.avatarUrl);

  // Tempo de empresa localizado a partir de hiredAt ou tenureMonths
  const tenureLabelFormatted = useMemo(() => {
    let totalMonths = dossier.tenureMonths;
    if (collaborator.hiredAt) {
      const hired = new Date(collaborator.hiredAt);
      if (!Number.isNaN(hired.getTime())) {
        const now = new Date();
        const diffMonths =
          (now.getFullYear() - hired.getFullYear()) * 12 +
          (now.getMonth() - hired.getMonth());
        totalMonths = Math.max(0, diffMonths);
      }
    }
    if (totalMonths < 1) return cp.tenureLessThanMonth;
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    const parts: string[] = [];
    if (years > 0) {
      parts.push(
        `${years} ${years === 1 ? cp.tenureYearSingular : cp.tenureYearPlural}`,
      );
    }
    if (months > 0) {
      parts.push(
        `${months} ${months === 1 ? cp.tenureMonthSingular : cp.tenureMonthPlural}`,
      );
    }
    return parts.join(` ${cp.tenureConnector} `);
  }, [collaborator.hiredAt, dossier.tenureMonths, cp]);

  const rawWhatsapp = collaborator.whatsapp || collaborator.phone;
  const whatsappDigits = rawWhatsapp ? stripNonDigits(rawWhatsapp) : "";
  const hasWhatsapp = whatsappDigits.length >= 8;

  const rankingWeights = useMemo(
    () =>
      ranking.weights ?? {
        servicesRevenueWeight: 35,
        productsSalesWeight: 25,
        appointmentsVolumeWeight: 15,
        clientReviewsWeight: 15,
        punctualityRetentionWeight: 10,
      },
    [ranking.weights],
  );

  // Selos automáticos de mérito derivados dos 5 pilares reais de desempenho
  const meritBadges = useMemo(() => {
    const badges: Array<{ key: string; label: string; tone: string }> = [];
    const servicesRatio =
      rankingWeights.servicesRevenueWeight > 0
        ? (ranking.pillars.servicesRevenueScore / rankingWeights.servicesRevenueWeight) * 100
        : 0;
    const productsRatio =
      rankingWeights.productsSalesWeight > 0
        ? (ranking.pillars.productsSalesScore / rankingWeights.productsSalesWeight) * 100
        : 0;
    const volumeRatio =
      rankingWeights.appointmentsVolumeWeight > 0
        ? (ranking.pillars.appointmentsVolumeScore / rankingWeights.appointmentsVolumeWeight) * 100
        : 0;
    const punctualityRatio =
      rankingWeights.punctualityRetentionWeight > 0
        ? (ranking.pillars.punctualityRetentionScore / rankingWeights.punctualityRetentionWeight) * 100
        : 0;

    if (servicesRatio >= 80) {
      badges.push({
        key: "revenue",
        label: cp.badgeTopRevenue,
        tone: "bg-accent-soft text-accent border-accent/25",
      });
    }
    if (productsRatio >= 80) {
      badges.push({
        key: "products",
        label: cp.badgeTopProducts,
        tone: "bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/25",
      });
    }
    if (volumeRatio >= 80) {
      badges.push({
        key: "volume",
        label: cp.badgeHighVolume,
        tone: "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25",
      });
    }
    if (stats.averageRating >= 4.7 && stats.totalReviews >= 1) {
      badges.push({
        key: "favorite",
        label: cp.badgeClientFavorite,
        tone: "bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/25",
      });
    }
    if (punctualityRatio >= 85) {
      badges.push({
        key: "punctuality",
        label: cp.badgePunctuality,
        tone: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
      });
    }
    return badges;
  }, [ranking.pillars, rankingWeights, stats.averageRating, stats.totalReviews, cp]);

  const rankingPillars = useMemo(() => {
    const items = [
      {
        key: "servicesRevenue",
        label: cp.pillarServicesRevenue,
        score: ranking.pillars.servicesRevenueScore ?? 0,
        weight: rankingWeights.servicesRevenueWeight,
      },
      {
        key: "productsSales",
        label: cp.pillarProductsSales,
        score: ranking.pillars.productsSalesScore ?? 0,
        weight: rankingWeights.productsSalesWeight,
      },
      {
        key: "appointmentsVolume",
        label: cp.pillarAppointmentsVolume,
        score: ranking.pillars.appointmentsVolumeScore ?? 0,
        weight: rankingWeights.appointmentsVolumeWeight,
      },
      {
        key: "clientReviews",
        label: cp.pillarClientReviews,
        score: ranking.pillars.clientReviewsScore ?? 0,
        weight: rankingWeights.clientReviewsWeight,
      },
      {
        key: "punctualityRetention",
        label: cp.pillarPunctualityRetention,
        score: ranking.pillars.punctualityRetentionScore ?? 0,
        weight: rankingWeights.punctualityRetentionWeight,
      },
    ];

    return items.map((item) => ({
      ...item,
      fillPercent: item.weight > 0 ? clampPercent((item.score / item.weight) * 100) : 0,
    }));
  }, [ranking.pillars, rankingWeights, cp]);

  const servicesRevenueMonthInCents =
    stats.servicesRevenueMonthInCents ?? stats.revenueMonthInCents;
  const productsSalesMonthInCents = stats.productsSalesMonthInCents ?? 0;
  const productsSoldCountMonth = stats.productsSoldCountMonth ?? 0;

  // Meta mensal em centavos e ticket médio
  const monthlyGoalCents = collaborator.monthlyRevenueGoal ?? 0;
  const hasMonthlyGoal = monthlyGoalCents > 0;
  const monthlyGoalPercent = hasMonthlyGoal
    ? Math.min(100, Math.round((stats.revenueMonthInCents / monthlyGoalCents) * 100))
    : 0;
  const averageTicketCents =
    stats.completedAppointmentsMonth > 0
      ? Math.round(stats.revenueMonthInCents / stats.completedAppointmentsMonth)
      : stats.totalCompletedAppointments > 0
        ? Math.round(stats.totalRevenueInCents / stats.totalCompletedAppointments)
        : 0;

  const handleAvatarFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      toast.error(td.avatarInvalidType);
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(td.avatarTooLarge);
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setLocalAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });

    setUploadingAvatar(true);
    try {
      await uploadCollaboratorAvatar(collaborator.id, file);
      toast.success(cp.photoUpdatedToast);
      await onRefresh();
      setLocalAvatarPreview(null);
    } catch (err) {
      setLocalAvatarPreview(null);
      toast.error(err instanceof ApiError ? err.message : cp.photoUploadError);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveEditProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setEditError(null);

    if (editName.trim().length < 2 || !editSpecialty.trim() || editPhone.trim().length < 8) {
      setEditError(t.errors.requiredField);
      return;
    }

    const parsedCommission = Number(editCommission.replace(",", "."));
    if (
      Number.isNaN(parsedCommission) ||
      parsedCommission < 0 ||
      parsedCommission > 100
    ) {
      setEditError(t.errors.requiredField);
      return;
    }

    let parsedGoalInCents: number | null = null;
    if (editMonthlyGoal.trim() !== "") {
      const parsedGoal = Number(editMonthlyGoal.replace(",", "."));
      if (Number.isNaN(parsedGoal) || parsedGoal < 0) {
        setEditError(t.errors.requiredField);
        return;
      }
      parsedGoalInCents = Math.round(parsedGoal * 100);
    }

    setEditSaving(true);
    try {
      await updateCollaboratorProfile(collaborator.id, {
        name: editName.trim(),
        specialty: editSpecialty.trim(),
        phone: editPhone.trim(),
        whatsapp: editWhatsapp.trim() ? stripNonDigits(editWhatsapp) : null,
        bio: editBio.trim() || null,
        commissionPercentage: parsedCommission,
        defaultCommissionRate: parsedCommission,
        monthlyRevenueGoal: parsedGoalInCents,
        ...(editHiredAt ? { hiredAt: new Date(`${editHiredAt}T12:00:00.000Z`).toISOString() } : {}),
      });
      toast.success(cp.profileSavedToast);
      setEditOpen(false);
      await onRefresh();
    } catch (err) {
      setEditError(
        err instanceof ApiError ? err.message : t.errors.unexpectedDescription,
      );
    } finally {
      setEditSaving(false);
    }
  };

  const formatReviewDate = (iso: string) => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return iso;
    return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(parsed);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* COLUNA ESQUERDA (4 colunas): Retrato, Dados Pessoais & Troféus */}
      <div className="lg:col-span-4 space-y-5">
        {/* Card de Retrato & Dados Pessoais */}
        <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xs">
          {/* Retrato com overlay de troca de foto */}
          <div className="relative h-64 w-full overflow-hidden bg-subtle">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={collaborator.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 18%, var(--surface-subtle)) 0%, var(--surface-elevated) 100%)",
                }}
              >
                <span className="text-5xl font-semibold tracking-tight text-accent/85">
                  {getInitials(collaborator.name)}
                </span>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/65 via-slate-950/20 to-transparent" />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void handleAvatarFileChange(e)}
              className="hidden"
            />

            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md hover:bg-slate-900 transition-colors disabled:opacity-60"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              {uploadingAvatar ? cp.uploadingPhoto : cp.changePhotoBtn}
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Identidade */}
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-ink">
                {collaborator.name}
              </h2>
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                <Briefcase className="h-3.5 w-3.5 shrink-0" />
                {collaborator.specialty}
              </p>

              <p className="mt-3 text-xs leading-relaxed text-ink-secondary">
                {collaborator.bio?.trim() ? collaborator.bio : cp.bioEmpty}
              </p>
            </div>

            {/* Destaque Tempo de Empresa */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-subtle/60 px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <CalendarClock className="h-4 w-4 text-accent shrink-0" />
                <span>{cp.tenureLabel}</span>
              </div>
              <span className="text-xs font-semibold text-ink">
                {tenureLabelFormatted}
              </span>
            </div>

            {/* Bloco de Contato Direto */}
            <div className="space-y-2.5 pt-2 border-t border-border-subtle">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {cp.contactSectionTitle}
              </p>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-ink-muted">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {cp.phoneLabel}
                  </span>
                  <span className="font-mono text-ink truncate">
                    {collaborator.phone || cp.notInformed}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-ink-muted">
                    <WhatsAppIcon className="h-3.5 w-3.5 shrink-0 text-[#25D366]" />
                    {cp.whatsappLabel}
                  </span>
                  <span className="font-mono text-ink truncate">
                    {collaborator.whatsapp || collaborator.phone || cp.notInformed}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-ink-muted">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {cp.emailLabel}
                  </span>
                  <span className="text-ink truncate max-w-[190px]" title={collaborator.email}>
                    {collaborator.email}
                  </span>
                </div>
              </div>
            </div>

            {/* Ações do Card */}
            <div className="flex flex-col gap-2 pt-2">
              {hasWhatsapp && (
                <a
                  href={`https://wa.me/${whatsappDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                >
                  <WhatsAppIcon className="h-4 w-4 text-white" />
                  {cp.whatsappSendBtn}
                </a>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditError(null);
                  setEditOpen(true);
                }}
                className="cursor-pointer w-full"
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                {cp.editProfileBtn}
              </Button>
            </div>
          </div>
        </section>

        {/* Card de Troféus & Conquistas */}
        <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink inline-flex items-center gap-2">
              <Trophy className="h-4 w-4 text-accent" />
              {cp.trophiesTitle}
            </h3>
          </div>

          {/* Contador em destaque */}
          <div className="flex items-center gap-3.5 rounded-xl border border-border-subtle bg-accent-soft/60 p-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-xs">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold tracking-tight text-ink tabular-nums leading-none">
                {awards.length}
                <span className="text-base font-semibold text-accent ml-0.5">
                  {cp.bestEmployeeCounterSuffix}
                </span>
              </p>
              <p className="text-xs font-medium text-ink-secondary mt-1">
                {cp.bestEmployeeLabel}
              </p>
            </div>
          </div>

          {/* Selos automáticos de mérito */}
          {meritBadges.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {cp.meritBadgesTitle}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {meritBadges.map((badge) => (
                  <span
                    key={badge.key}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${badge.tone}`}
                  >
                    <Sparkles className="h-3 w-3 shrink-0" />
                    {badge.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Lista de prêmios conquistados */}
          {awards.length > 0 ? (
            <ul className="space-y-2 pt-1">
              {awards.map((award) => (
                <li
                  key={award.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-subtle/50 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Award className="h-4 w-4 shrink-0 text-accent" />
                    <span className="font-medium text-ink truncate">
                      {award.title} — {formatReferenceMonth(award.referenceMonth, locale)}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] font-semibold text-ink-secondary tabular-nums">
                    {Math.round(award.score)} pts
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border-subtle bg-subtle/30 p-3.5 text-center">
              <p className="text-xs font-medium text-ink-secondary">
                {cp.noAwardsYet}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-muted">{cp.noAwardsHint}</p>
            </div>
          )}
        </section>
      </div>

      {/* COLUNA CENTRAL & DIREITA (8 colunas): Ranking, Métricas & Avaliações */}
      <div className="lg:col-span-8 space-y-5">
        {/* Bloco Superior: 2 cards lado a lado */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Card 1: Score & Ranking Geral */}
          <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs flex flex-col justify-between space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">{cp.rankingTitle}</h3>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight text-ink tabular-nums">
                    {clampPercent(ranking.totalScore)}
                  </span>
                  <span className="text-xs font-medium text-ink-muted">
                    {cp.rankingScoreOutOf}
                  </span>
                </div>
              </div>

              {ranking.position > 0 && (
                <div className="flex flex-col items-end">
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent text-accent-ink px-3 py-1 text-sm font-bold tabular-nums shadow-xs">
                    <Trophy className="h-3.5 w-3.5" />#{ranking.position}
                  </span>
                  {ranking.totalInCompany > 0 && (
                    <span className="mt-1 text-[11px] text-ink-muted tabular-nums">
                      {cp.rankingOfTeamPrefix} {ranking.totalInCompany}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Barras de progresso individuais dos 5 pilares conforme pesos do dono */}
            <div className="space-y-3">
              {rankingPillars.map((pillar) => (
                <div key={pillar.key} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-ink-secondary truncate">
                      {pillar.label}{" "}
                      <span className="text-ink-muted tabular-nums">({pillar.weight}%)</span>
                    </span>
                    <span className="font-semibold text-ink tabular-nums shrink-0">
                      {pillar.score.toFixed(1)} / {pillar.weight}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-subtle">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${pillar.fillPercent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Card 2: Estatísticas Financeiras & Operacionais */}
          <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-ink inline-flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              {cp.statsTitle}
            </h3>

            {/* Grade de métricas: Serviços vs. Produtos, Atendimentos, Comissões e Ticket Médio */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border-subtle bg-subtle/50 p-3">
                <p className="text-[11px] text-ink-muted flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span className="truncate">{cp.servicesRevenueMonth}</span>
                </p>
                <p className="mt-1 text-lg font-bold text-ink tabular-nums truncate">
                  {formatPrice(servicesRevenueMonthInCents / 100, locale, currency)}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted tabular-nums truncate">
                  {cp.appointmentsTotal}:{" "}
                  {formatPrice(stats.totalRevenueInCents / 100, locale, currency)}
                </p>
              </div>

              <div className="rounded-xl border border-border-subtle bg-subtle/50 p-3">
                <p className="text-[11px] text-ink-muted flex items-center gap-1">
                  <ShoppingBag className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span className="truncate">{cp.productsSalesMonth}</span>
                </p>
                <p className="mt-1 text-lg font-bold text-ink tabular-nums truncate">
                  {formatPrice(productsSalesMonthInCents / 100, locale, currency)}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted tabular-nums truncate">
                  {productsSoldCountMonth}{" "}
                  {productsSoldCountMonth === 1
                    ? cp.productsSoldUnitsSingular
                    : cp.productsSoldUnitsPlural}
                </p>
              </div>

              <div className="rounded-xl border border-border-subtle bg-subtle/50 p-3">
                <p className="text-[11px] text-ink-muted flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span className="truncate">{cp.appointmentsMonth}</span>
                </p>
                <p className="mt-1 text-xl font-bold text-ink tabular-nums">
                  {stats.completedAppointmentsMonth}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted tabular-nums">
                  {cp.appointmentsTotal}: {stats.totalCompletedAppointments}
                </p>
              </div>

              <div className="rounded-xl border border-border-subtle bg-subtle/50 p-3">
                <p className="text-[11px] text-ink-muted flex items-center gap-1">
                  <Wallet className="h-3.5 w-3.5 text-accent shrink-0" />
                  <span className="truncate">{cp.commissionMonth}</span>
                </p>
                <p className="mt-1 text-lg font-bold text-ink tabular-nums truncate">
                  {formatPrice(stats.commissionMonthInCents / 100, locale, currency)}
                </p>
                <p className="mt-0.5 text-[11px] text-ink-muted tabular-nums flex items-center justify-between gap-1">
                  <span>
                    <Percent className="inline h-3 w-3 mr-0.5" />
                    {formatPercentage(
                      collaborator.defaultCommissionRate && collaborator.defaultCommissionRate > 0
                        ? collaborator.defaultCommissionRate
                        : collaborator.commissionPercentage,
                      locale,
                    )}
                  </span>
                  <span className="truncate" title={cp.averageTicket}>
                    {formatPrice(averageTicketCents / 100, locale, currency)}
                  </span>
                </p>
              </div>
            </div>

            {/* Barra de progresso da Meta Mensal */}
            <div className="rounded-xl border border-border-subtle bg-subtle/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-medium text-ink inline-flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-accent shrink-0" />
                  {cp.monthlyGoalLabel}
                </span>
                {hasMonthlyGoal ? (
                  <span className="font-semibold text-accent tabular-nums">
                    {monthlyGoalPercent}% {cp.monthlyGoalReached}
                  </span>
                ) : (
                  <span className="text-ink-muted">{cp.monthlyGoalUnset}</span>
                )}
              </div>

              {hasMonthlyGoal && (
                <>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-subtle">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${monthlyGoalPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-ink-muted tabular-nums">
                    <span>
                      {formatPrice(stats.revenueMonthInCents / 100, locale, currency)}
                    </span>
                    <span>
                      {formatPrice(monthlyGoalCents / 100, locale, currency)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Bloco Inferior: Avaliações & Comentários de Clientes */}
        <section className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border-subtle">
            <div>
              <h3 className="text-sm font-semibold text-ink">{cp.reviewsTitle}</h3>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-subtle/60 px-3 py-1 text-xs">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
              <span className="font-bold text-ink tabular-nums">
                {stats.averageRating.toFixed(1)}
              </span>
              <span className="text-ink-muted">
                ({stats.totalReviews}{" "}
                {stats.totalReviews === 1
                  ? cp.reviewsCountSingular
                  : cp.reviewsCountPlural}
                )
              </span>
            </div>
          </div>

          {recentReviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-subtle/30 py-10 px-4 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent mb-3">
                <Star className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-ink">{cp.noReviewsTitle}</p>
              <p className="mt-1 max-w-md text-xs text-ink-muted">
                {cp.noReviewsDescription}
              </p>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto pr-1 space-y-3">
              {recentReviews.map((review) => (
                <article
                  key={review.id}
                  className="rounded-xl border border-border-subtle bg-subtle/40 p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-ink truncate">
                        {review.clientName}
                      </span>
                      {review.serviceName && (
                        <span className="rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent truncate">
                          {review.serviceName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        className="inline-flex items-center gap-0.5"
                        aria-label={`${review.rating} / 5`}
                      >
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={[
                              "h-3.5 w-3.5",
                              i < review.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-border-strong",
                            ].join(" ")}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-ink-muted inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatReviewDate(review.createdAt)}
                      </span>
                    </div>
                  </div>

                  {review.comment && (
                    <p className="text-xs leading-relaxed text-ink-secondary">
                      “{review.comment}”
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Modal de Edição de Perfil (PATCH /collaborators/:id) */}
      <Modal
        open={editOpen}
        onClose={() => {
          if (!editSaving) setEditOpen(false);
        }}
        title={cp.editModalTitle}
      >
        <form onSubmit={handleSaveEditProfile} className="space-y-4">
          <p className="text-xs text-ink-muted">{cp.editModalSubtitle}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-collab-name">{t.auth.nameLabel}</Label>
              <Input
                id="edit-collab-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-collab-specialty">{t.common.specialty}</Label>
              <Input
                id="edit-collab-specialty"
                value={editSpecialty}
                onChange={(e) => setEditSpecialty(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-collab-phone">{cp.phoneLabel}</Label>
              <Input
                id="edit-collab-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-collab-whatsapp">{td.whatsappOptionalLabel}</Label>
              <Input
                id="edit-collab-whatsapp"
                value={editWhatsapp}
                onChange={(e) => setEditWhatsapp(e.target.value)}
                placeholder={td.whatsappPlaceholder}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-collab-commission">
                {cp.defaultCommissionLabel}
              </Label>
              <Input
                id="edit-collab-commission"
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={editCommission}
                onChange={(e) => setEditCommission(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-collab-goal">{td.monthlyGoalLabel}</Label>
              <Input
                id="edit-collab-goal"
                type="number"
                min={0}
                step="0.01"
                value={editMonthlyGoal}
                onChange={(e) => setEditMonthlyGoal(e.target.value)}
                placeholder={td.monthlyGoalPlaceholder}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-collab-hired-at">{cp.hiredAtLabel}</Label>
              <Input
                id="edit-collab-hired-at"
                type="date"
                value={editHiredAt}
                onChange={(e) => setEditHiredAt(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-collab-bio">{td.bioLabel}</Label>
              <textarea
                id="edit-collab-bio"
                rows={3}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder={td.bioPlaceholder}
                className="w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
              />
            </div>
          </div>

          {editError && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
              {editError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={editSaving}
              onClick={() => setEditOpen(false)}
              className="cursor-pointer"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              disabled={editSaving}
              className="cursor-pointer"
            >
              {editSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editSaving ? t.common.saving : t.common.save}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
