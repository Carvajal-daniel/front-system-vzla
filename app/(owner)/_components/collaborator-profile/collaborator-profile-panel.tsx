"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  LayoutGrid,
  Scissors,
  ShieldCheck,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/ui/whatsapp-icon";
import { ApiError, apiRequest } from "@/lib/api-client";
import { stripNonDigits } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Service } from "@/lib/types/service";
import {
  getCollaboratorProfile,
  type CollaboratorProfileDossier,
} from "@/lib/types/team";
import { useSession } from "@/components/ui/auth-guard";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { AccessDeactivationTab } from "./access-deactivation-tab";
import { OverviewBentoTab } from "./overview-bento-tab";
import { ScheduleTab } from "./schedule-tab";
import { ServicesTab } from "./services-tab";

type ProfileTabKey = "overview" | "services" | "schedule" | "access";

interface CollaboratorProfilePanelProps {
  collaboratorId: string;
}

export function CollaboratorProfilePanel({
  collaboratorId,
}: CollaboratorProfilePanelProps) {
  const { session } = useSession();
  const { t } = useLocale();
  const cp = t.owner.collaboratorProfile;

  const currency = session.company.currency ?? "BRL";

  const [dossier, setDossier] = useState<CollaboratorProfileDossier | null>(null);
  const [companyServices, setCompanyServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>("overview");

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setError(null);
        setNotFound(false);
      }

      try {
        const [profileRes, servicesRes] = await Promise.all([
          getCollaboratorProfile(collaboratorId),
          apiRequest<Service[] | { services?: Service[] }>("/services", {
            auth: true,
          }).catch(() => [] as Service[]),
        ]);

        setDossier(profileRes);
        const list = Array.isArray(servicesRes)
          ? servicesRes
          : (servicesRes.services ?? []);
        setCompanyServices(list);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(
            err instanceof ApiError ? err.message : t.errors.networkDescription,
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [collaboratorId, t.errors.networkDescription],
  );

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const handleSilentRefresh = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-48 rounded-lg bg-subtle animate-pulse" />
        <div className="h-20 rounded-2xl border border-border-subtle bg-surface animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-4 h-96 rounded-2xl border border-border-subtle bg-surface animate-pulse" />
          <div className="lg:col-span-8 space-y-5">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="h-64 rounded-2xl border border-border-subtle bg-surface animate-pulse" />
              <div className="h-64 rounded-2xl border border-border-subtle bg-surface animate-pulse" />
            </div>
            <div className="h-52 rounded-2xl border border-border-subtle bg-surface animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <EmptyState
        icon={<ArrowLeft className="h-6 w-6" />}
        title={cp.notFoundTitle}
        description={cp.notFoundDescription}
        action={
          <Link
            href="/owner/team"
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:opacity-95 transition-opacity"
          >
            <ArrowLeft className="h-4 w-4" />
            {cp.backToTeam}
          </Link>
        }
      />
    );
  }

  if (error || !dossier) {
    return (
      <ErrorState
        title={t.errors.unexpectedTitle}
        description={error ?? t.errors.unexpectedDescription}
        retryLabel={t.common.retry}
        onRetry={() => void loadData(false)}
      />
    );
  }

  const { collaborator } = dossier;
  const isActive = collaborator.status
    ? collaborator.status === "ACTIVE"
    : collaborator.isActive;

  const rawWhatsapp = collaborator.whatsapp || collaborator.phone;
  const whatsappDigits = rawWhatsapp ? stripNonDigits(rawWhatsapp) : "";
  const hasWhatsapp = whatsappDigits.length >= 8;

  const tabs: Array<{
    key: ProfileTabKey;
    label: string;
    icon: typeof LayoutGrid;
  }> = [
    { key: "overview", label: cp.tabOverview, icon: LayoutGrid },
    { key: "services", label: cp.tabServices, icon: Scissors },
    { key: "schedule", label: cp.tabSchedule, icon: CalendarClock },
    { key: "access", label: cp.tabAccess, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb superior */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs font-medium text-ink-muted"
      >
        <Link
          href="/owner/team"
          className="cursor-pointer inline-flex items-center gap-1 hover:text-accent transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {cp.breadcrumbTeam}
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
        <span className="text-ink font-semibold truncate">
          {collaborator.name}
        </span>
      </nav>

      {/* Header da Página */}
      <header className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-ink truncate">
              {collaborator.name}
            </h1>

            <span
              className={[
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                isActive
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-slate-500/15 text-ink-secondary",
              ].join(" ")}
            >
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full",
                  isActive ? "bg-emerald-500" : "bg-slate-400",
                ].join(" ")}
              />
              {isActive ? t.common.active : t.common.inactive}
            </span>
          </div>

          {hasWhatsapp && (
            <a
              href={`https://wa.me/${whatsappDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/12 px-4 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors self-start sm:self-auto"
            >
              <WhatsAppIcon className="h-4 w-4 text-[#25D366]" />
              {cp.whatsappQuickBtn}
            </a>
          )}
        </div>

        {/* Abas de Navegação Interna */}
        <div
          role="tablist"
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 pt-1 border-t border-border-subtle"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "cursor-pointer inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all",
                  selected
                    ? "bg-accent text-accent-ink shadow-xs"
                    : "text-ink-secondary hover:bg-subtle hover:text-ink",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Conteúdo da Aba Ativa */}
      {activeTab === "overview" && (
        <OverviewBentoTab
          dossier={dossier}
          currency={currency}
          onRefresh={handleSilentRefresh}
        />
      )}

      {activeTab === "services" && (
        <ServicesTab
          dossier={dossier}
          companyServices={companyServices}
          currency={currency}
          onRefresh={handleSilentRefresh}
        />
      )}

      {activeTab === "schedule" && (
        <ScheduleTab
          dossier={dossier}
          companyOperatingSchedule={session.company.operatingSchedule}
          companyOperatingDays={session.company.operatingDays}
          onRefresh={handleSilentRefresh}
        />
      )}

      {activeTab === "access" && (
        <AccessDeactivationTab
          dossier={dossier}
          onRefresh={handleSilentRefresh}
        />
      )}
    </div>
  );
}
