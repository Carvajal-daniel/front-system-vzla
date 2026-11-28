"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Building2,
  CalendarDays,
  CheckCircle2,
  Crown,
  Eye,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { formatPriceFromCents } from "@/lib/format";
import {
  getAdminTenantDetails,
  getPlatformOverview,
  listAdminTenants,
  updateAdminTenantStatus,
  type AdminTenantDetails,
  type AdminTenantItem,
  type PlatformOverview,
  type SaasPlan,
  type SaasStatus,
} from "@/lib/super-admin-api";

const SAAS_PLAN_LABELS: Record<SaasPlan, string> = {
  ESSENTIAL: "Essencial",
  PRO: "Pro",
  SCALE: "Scale",
};

const SAAS_STATUS_LABELS: Record<SaasStatus, string> = {
  TRIAL: "Período de teste",
  ACTIVE: "Ativo",
  PAST_DUE: "Em atraso",
  CANCELED: "Cancelado",
};

const SAAS_STATUS_BADGE: Record<SaasStatus, string> = {
  TRIAL: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  PAST_DUE: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  CANCELED: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

export function SuperAdminPanel() {
  const { session } = useSession();

  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [tenants, setTenants] = useState<AdminTenantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filtros
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState<"" | SaasPlan>("");
  const [statusFilter, setStatusFilter] = useState<"" | SaasStatus>("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");

  // Modal de detalhes
  const [details, setDetails] = useState<AdminTenantDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const loadAll = useCallback(
    async (signal?: AbortSignal) => {
      if (!session.isSuperAdmin) return;
      setLoading(true);
      setError("");
      try {
        const [ov, list] = await Promise.all([
          getPlatformOverview(signal),
          listAdminTenants(
            {
              search,
              saasPlan: planFilter,
              saasStatus: statusFilter,
              isActive: activeFilter,
            },
            signal,
          ),
        ]);
        if (signal?.aborted) return;
        setOverview(ov);
        setTenants(list);
      } catch {
        if (!signal?.aborted) {
          setError("Não foi possível carregar os dados globais da plataforma.");
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [session.isSuperAdmin, search, planFilter, statusFilter, activeFilter],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadAll(controller.signal);
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadAll]);

  const handleToggleTenantActive = async (tenant: AdminTenantItem) => {
    if (mutatingId) return;
    if (tenant.id === session.company.id && tenant.isActive) {
      toast.error("Você não pode suspender a própria conta de administrador.");
      return;
    }
    setMutatingId(tenant.id);
    try {
      const nextActive = !tenant.isActive;
      await updateAdminTenantStatus(tenant.id, { isActive: nextActive });
      toast.success(
        nextActive
          ? `${tenant.companyName} reativada com sucesso!`
          : `${tenant.companyName} suspensa com sucesso.`,
      );
      await loadAll();
      if (details?.id === tenant.id) {
        const fresh = await getAdminTenantDetails(tenant.id);
        setDetails(fresh);
      }
    } catch {
      toast.error("Não foi possível alterar o status do estabelecimento.");
    } finally {
      setMutatingId(null);
    }
  };

  const handleOpenDetails = async (companyId: string) => {
    setLoadingDetails(true);
    try {
      const data = await getAdminTenantDetails(companyId);
      setDetails(data);
    } catch {
      toast.error("Não foi possível carregar os detalhes deste estabelecimento.");
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUpdatePlanOrStatus = async (
    companyId: string,
    patch: { saasPlan?: SaasPlan; saasStatus?: SaasStatus },
  ) => {
    setMutatingId(companyId);
    try {
      await updateAdminTenantStatus(companyId, patch);
      toast.success("Plano/status atualizado com sucesso!");
      const [fresh] = await Promise.all([getAdminTenantDetails(companyId), loadAll()]);
      setDetails(fresh);
    } catch {
      toast.error("Não foi possível atualizar o plano ou status SaaS.");
    } finally {
      setMutatingId(null);
    }
  };

  if (!session.isSuperAdmin) {
    return (
      <section className="mx-auto max-w-lg rounded-2xl border border-border-subtle bg-surface p-8 text-center shadow-xs space-y-3">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
          <ShieldAlert className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-bold text-ink">Acesso restrito ao Super-Admin</h1>
        <p className="text-sm text-ink-muted">
          Esta área é exclusiva para administradores da plataforma SaaS.
        </p>
        <Link
          href="/owner"
          className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-ink hover:bg-accent-hover"
        >
          Voltar para o Dashboard
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <ShieldCheck className="size-6 text-accent" aria-hidden="true" />
            Painel Super-Admin da Plataforma
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Gestão multi-tenant de todas as barbearias e salões cadastrados, métricas globais e controle de acesso.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => void loadAll()}
          className="cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Atualizar dados
        </Button>
      </div>

      {/* Cards de Métricas Globais */}
      {overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-secondary">Tenants Ativos</p>
              <Building2 className="size-4 text-accent" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
              {overview.activeTenants}{" "}
              <span className="text-xs font-medium text-ink-muted">/ {overview.totalTenants}</span>
            </p>
            <p className="mt-1 text-[11px] text-ink-muted">
              {overview.suspendedTenants} suspenso(s)
            </p>
          </article>

          <article className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-secondary">Volume Transacionado</p>
              <Wallet className="size-4 text-emerald-500" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
              {formatPriceFromCents(overview.totalTransactedCents, "pt-BR", "BRL")}
            </p>
            <p className="mt-1 text-[11px] text-ink-muted">
              Cobranças online e GMV consolidado
            </p>
          </article>

          <article className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-secondary">Agendamentos Totais</p>
              <CalendarDays className="size-4 text-sky-500" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
              {overview.totalAppointments.toLocaleString("pt-BR")}
            </p>
            <p className="mt-1 text-[11px] text-ink-muted">
              {overview.totalAiTurns.toLocaleString("pt-BR")} turnos de IA registrados
            </p>
          </article>

          <article className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-secondary">Assinantes VIP Ativos</p>
              <Crown className="size-4 text-amber-500" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-ink">
              {overview.activeVipSubscribers.toLocaleString("pt-BR")}
            </p>
            <p className="mt-1 text-[11px] text-ink-muted">
              Essencial: {overview.byPlan.ESSENTIAL} · Pro: {overview.byPlan.PRO} · Scale:{" "}
              {overview.byPlan.SCALE}
            </p>
          </article>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="grid gap-3 rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, slug ou e-mail..."
            className="min-h-10 w-full rounded-xl border border-border-subtle bg-canvas/40 pl-9 pr-3 text-xs text-ink outline-none focus-visible:border-accent"
          />
        </div>

        <select
          aria-label="Filtrar por plano SaaS"
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as "" | SaasPlan)}
          className="min-h-10 cursor-pointer rounded-xl border border-border-subtle bg-canvas/40 px-3 text-xs text-ink"
        >
          <option value="">Todos os planos</option>
          <option value="ESSENTIAL">Essencial</option>
          <option value="PRO">Pro</option>
          <option value="SCALE">Scale</option>
        </select>

        <select
          aria-label="Filtrar por status da assinatura"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | SaasStatus)}
          className="min-h-10 cursor-pointer rounded-xl border border-border-subtle bg-canvas/40 px-3 text-xs text-ink"
        >
          <option value="">Todos os status SaaS</option>
          <option value="TRIAL">Período de teste</option>
          <option value="ACTIVE">Ativo</option>
          <option value="PAST_DUE">Em atraso</option>
          <option value="CANCELED">Cancelado</option>
        </select>

        <select
          aria-label="Filtrar por estado de acesso"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as "" | "true" | "false")}
          className="min-h-10 cursor-pointer rounded-xl border border-border-subtle bg-canvas/40 px-3 text-xs text-ink"
        >
          <option value="">Todos (Ativos e Suspensos)</option>
          <option value="true">Somente ativos</option>
          <option value="false">Somente suspensos</option>
        </select>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-3 text-xs text-[var(--status-danger-ink)]"
        >
          {error}
        </p>
      )}

      {/* Tabela Multi-Tenant */}
      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border-subtle bg-canvas/50 text-[11px] uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Estabelecimento</th>
                <th className="px-4 py-3 font-semibold">Plano / Status</th>
                <th className="px-4 py-3 font-semibold">Gateway</th>
                <th className="px-4 py-3 font-semibold text-right">Agendamentos</th>
                <th className="px-4 py-3 font-semibold text-right">VIPs</th>
                <th className="px-4 py-3 font-semibold text-right">Volume</th>
                <th className="px-4 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-ink-muted">
                    <Loader2 className="mx-auto mb-2 size-5 animate-spin text-accent" />
                    Carregando estabelecimentos…
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-ink-muted">
                    Nenhum estabelecimento encontrado para os filtros aplicados.
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-subtle/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 shrink-0 rounded-full ${
                            tenant.isActive ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                          title={tenant.isActive ? "Ativo" : "Suspenso"}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-ink truncate">{tenant.companyName}</p>
                          <p className="text-[11px] text-ink-muted truncate">
                            /{tenant.slug} · {tenant.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-md border border-border-subtle bg-canvas px-2 py-0.5 text-[11px] font-bold text-ink">
                          {SAAS_PLAN_LABELS[tenant.saasPlan]}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            SAAS_STATUS_BADGE[tenant.saasStatus]
                          }`}
                        >
                          {SAAS_STATUS_LABELS[tenant.saasStatus]}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ink-secondary">
                      {tenant.paymentProvider}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
                      {tenant.appointmentsCount}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
                      {tenant.activeSubscribersCount}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-ink">
                      {formatPriceFromCents(tenant.transactedCents, "pt-BR", tenant.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleOpenDetails(tenant.id)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-subtle bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink hover:border-accent"
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          Detalhes
                        </button>
                        <button
                          type="button"
                          disabled={
                            mutatingId === tenant.id ||
                            (tenant.id === session.company.id && tenant.isActive)
                          }
                          onClick={() => void handleToggleTenantActive(tenant)}
                          className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            tenant.isActive
                              ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/15"
                              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
                          }`}
                        >
                          {tenant.isActive ? (
                            <>
                              <PauseCircle className="size-3.5" aria-hidden="true" />
                              Suspender
                            </>
                          ) : (
                            <>
                              <PlayCircle className="size-3.5" aria-hidden="true" />
                              Ativar
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes do Tenant */}
      {(details || loadingDetails) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tenant-details-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border-subtle bg-surface p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="tenant-details-title" className="text-base font-bold text-ink">
                  {details ? details.companyName : "Carregando detalhes…"}
                </h2>
                {details && (
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Responsável: {details.ownerName} · {details.email} · {details.phone}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Fechar detalhes"
                onClick={() => setDetails(null)}
                className="cursor-pointer rounded-lg p-1.5 text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>

            {loadingDetails || !details ? (
              <div className="py-10 text-center text-xs text-ink-muted">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin text-accent" />
                Carregando indicadores do estabelecimento…
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-border-subtle bg-canvas/40 p-3">
                    <p className="text-ink-muted">Agendamentos</p>
                    <p className="mt-1 text-base font-bold tabular-nums text-ink">
                      {details.appointmentsCount}
                    </p>
                    <p className="text-[10px] text-ink-muted">
                      {details.completedAppointmentsCount} concluídos
                    </p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-canvas/40 p-3">
                    <p className="text-ink-muted">Assinantes VIP</p>
                    <p className="mt-1 text-base font-bold tabular-nums text-ink">
                      {details.activeSubscribersCount}
                    </p>
                    <p className="text-[10px] text-ink-muted">{details.clientsCount} clientes</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-canvas/40 p-3">
                    <p className="text-ink-muted">Volume Online</p>
                    <p className="mt-1 text-base font-bold tabular-nums text-ink">
                      {formatPriceFromCents(details.transactedCents, "pt-BR", details.currency)}
                    </p>
                    <p className="text-[10px] text-ink-muted">{details.paymentProvider}</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-canvas/40 p-3">
                    <p className="text-ink-muted">Equipe &amp; Serviços</p>
                    <p className="mt-1 text-sm font-bold text-ink">
                      {details.collaboratorsCount} prof. · {details.servicesCount} serv.
                    </p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-canvas/40 p-3">
                    <p className="text-ink-muted">Uso de IA</p>
                    <p className="mt-1 text-sm font-bold tabular-nums text-ink">
                      {details.totalAiTurns} turnos
                    </p>
                    <p className="text-[10px] text-ink-muted">Cota: {details.monthlyAiQuota}/mês</p>
                  </div>
                  <div className="rounded-xl border border-border-subtle bg-canvas/40 p-3">
                    <p className="text-ink-muted">Acesso</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-ink">
                      {details.isActive ? (
                        <>
                          <CheckCircle2 className="size-4 text-emerald-500" /> Ativo
                        </>
                      ) : (
                        <>
                          <Activity className="size-4 text-rose-500" /> Suspenso
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Controles rápidos de plano e status */}
                <div className="grid gap-3 rounded-xl border border-border-subtle bg-canvas/30 p-3.5 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-semibold text-ink">
                    Plano SaaS
                    <select
                      value={details.saasPlan}
                      disabled={mutatingId === details.id}
                      onChange={(e) =>
                        void handleUpdatePlanOrStatus(details.id, {
                          saasPlan: e.target.value as SaasPlan,
                        })
                      }
                      className="min-h-9 w-full cursor-pointer rounded-lg border border-border-subtle bg-surface px-2.5 text-xs text-ink"
                    >
                      <option value="ESSENTIAL">Essencial</option>
                      <option value="PRO">Pro</option>
                      <option value="SCALE">Scale</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-ink">
                    Status da Assinatura SaaS
                    <select
                      value={details.saasStatus}
                      disabled={mutatingId === details.id}
                      onChange={(e) =>
                        void handleUpdatePlanOrStatus(details.id, {
                          saasStatus: e.target.value as SaasStatus,
                        })
                      }
                      className="min-h-9 w-full cursor-pointer rounded-lg border border-border-subtle bg-surface px-2.5 text-xs text-ink"
                    >
                      <option value="TRIAL">Período de teste</option>
                      <option value="ACTIVE">Ativo</option>
                      <option value="PAST_DUE">Em atraso</option>
                      <option value="CANCELED">Cancelado</option>
                    </select>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDetails(null)}
                    className="cursor-pointer"
                  >
                    Fechar
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
