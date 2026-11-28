"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Crown,
  Scissors,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  getExecutiveDashboard,
  type ExecutiveDashboardResponse,
} from "@/lib/executive-dashboard";
import { getCurrencyFormatter } from "@/lib/format";
import { usePrivacy } from "@/lib/privacy-context";
import { maskCurrency } from "@/components/ui/sensitive-value";

interface ExecutiveKpisSectionProps {
  from: string;
  to: string;
}

export function ExecutiveKpisSection({ from, to }: ExecutiveKpisSectionProps) {
  const { hideSensitiveValues } = usePrivacy();
  const [data, setData] = useState<ExecutiveDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [rankingTab, setRankingTab] = useState<"services" | "professionals">("services");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void getExecutiveDashboard({ from, to }, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) setData(res);
      })
      .catch(() => {
        if (!controller.signal.aborted) setData(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [from, to]);

  if (loading) {
    return (
      <section className="space-y-4">
        <div className="h-6 w-56 animate-pulse rounded-lg bg-subtle" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-2xl border border-border-subtle bg-surface"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!data) return null;

  const formatter = getCurrencyFormatter("pt-BR", data.currency);
  const fmt = (cents: number) =>
    maskCurrency(formatter.format(cents / 100), hideSensitiveValues);

  const { revenueSplit, depositConversion, attendanceComparison, upcomingRenewals7Days, rankings } =
    data;

  const clubPct = Math.min(100, Math.max(0, revenueSplit.clubSharePercent));
  const avulsaPct = Math.max(0, Math.round((100 - clubPct) * 10) / 10);

  return (
    <section aria-labelledby="executive-kpis-heading" className="space-y-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="executive-kpis-heading" className="text-base font-bold text-ink flex items-center gap-2">
            <TrendingUp className="size-4 text-accent" aria-hidden="true" />
            Indicadores Executivos (Clube VIP &amp; Anti-No-Show)
          </h2>
          <p className="text-xs text-ink-muted">
            Receita recorrente vs. avulsa, eficiência dos sinais, comparecimento e renovações dos próximos 7 dias.
          </p>
        </div>
      </div>

      {/* Linha 1: 3 KPIs Executivos */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Card 1: Receita Avulsa vs. MRR do Clube VIP */}
        <article className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-ink-secondary">Receita Avulsa vs. MRR Clube VIP</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-ink">
                {fmt(revenueSplit.totalRevenueInCents)}
              </p>
            </div>
            <span className="grid size-9 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Crown className="size-4" aria-hidden="true" />
            </span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-subtle flex">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${clubPct}%` }}
              title={`MRR Clube VIP: ${clubPct}%`}
            />
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${avulsaPct}%` }}
              title={`Receita Avulsa: ${avulsaPct}%`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-amber-500/10 px-2.5 py-2">
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                MRR Clube ({revenueSplit.activeSubscribersCount} ativos)
              </p>
              <p className="mt-0.5 font-bold tabular-nums text-ink">
                {fmt(revenueSplit.clubMrrInCents)}
              </p>
            </div>
            <div className="rounded-xl bg-subtle/70 px-2.5 py-2">
              <p className="text-[11px] font-medium text-ink-secondary">Serviços Avulsos</p>
              <p className="mt-0.5 font-bold tabular-nums text-ink">
                {fmt(revenueSplit.avulsaRevenueInCents)}
              </p>
            </div>
          </div>
        </article>

        {/* Card 2: Conversão de Sinais Anti-No-Show */}
        <article className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-ink-secondary">Conversão de Sinais Anti-No-Show</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-ink">
                {depositConversion.conversionRatePercent.toFixed(1).replace(".", ",")}%
              </p>
            </div>
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
          </div>

          <p className="text-xs text-ink-muted">
            <strong className="text-ink">{depositConversion.confirmedCharges}</strong> de{" "}
            <strong className="text-ink">{depositConversion.totalCharges}</strong> cobranças de sinal confirmadas no período.
          </p>

          <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs">
            <span className="text-ink-secondary">Total recebido em sinais</span>
            <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {fmt(depositConversion.totalDepositedInCents)}
            </span>
          </div>
        </article>

        {/* Card 3: Taxa de Comparecimento (VIP vs. Avulsos) */}
        <article className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-ink-secondary">Taxa de Comparecimento</p>
              <p className="mt-1 text-xs text-ink-muted">Assinantes VIP vs. Clientes Avulsos</p>
            </div>
            <span className="grid size-9 place-items-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <CheckCircle2 className="size-4" aria-hidden="true" />
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2.5">
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                Clube VIP
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-ink">
                {attendanceComparison.subscribers.ratePercent !== null
                  ? `${attendanceComparison.subscribers.ratePercent.toFixed(1).replace(".", ",")}%`
                  : "—"}
              </p>
              <p className="text-[10px] text-ink-muted">
                {attendanceComparison.subscribers.completed} concl. · {attendanceComparison.subscribers.noShow} faltas
              </p>
            </div>
            <div className="rounded-xl border border-border-subtle bg-subtle/60 p-2.5">
              <p className="text-[11px] font-semibold text-ink-secondary">Avulsos</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-ink">
                {attendanceComparison.avulsos.ratePercent !== null
                  ? `${attendanceComparison.avulsos.ratePercent.toFixed(1).replace(".", ",")}%`
                  : "—"}
              </p>
              <p className="text-[10px] text-ink-muted">
                {attendanceComparison.avulsos.completed} concl. · {attendanceComparison.avulsos.noShow} faltas
              </p>
            </div>
          </div>
        </article>
      </div>

      {/* Linha 2: Previsão de Renovações (7 dias) + Ranking de Serviços/Profissionais */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Renovações Próximos 7 Dias */}
        <article className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs flex flex-col justify-between gap-3">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                  <CalendarClock className="size-4 text-accent" aria-hidden="true" />
                  Previsão de Renovações (7 dias)
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {upcomingRenewals7Days.totalCount} assinatura(s) prevista(s) ·{" "}
                  <strong className="text-ink tabular-nums">
                    {fmt(upcomingRenewals7Days.totalExpectedCents)}
                  </strong>
                </p>
              </div>
              <Link
                href="/owner/clube"
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border-subtle px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:border-accent hover:text-ink transition-colors"
              >
                Ver Clube
                <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>

            {upcomingRenewals7Days.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border-subtle py-6 text-center text-xs text-ink-muted">
                Nenhuma assinatura do Clube VIP vence nos próximos 7 dias.
              </p>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {upcomingRenewals7Days.items.map((item) => (
                  <li
                    key={item.subscriptionId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{item.clientName}</p>
                      <p className="truncate text-[11px] text-ink-muted">
                        {item.planName} ·{" "}
                        {item.daysRemaining <= 0
                          ? "Em período de tolerância"
                          : `Vence em ${item.daysRemaining} dia(s)`}
                      </p>
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-accent">
                      {fmt(item.priceCents)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        {/* Ranking de Serviços e Profissionais */}
        <article className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-ink flex items-center gap-2">
              {rankingTab === "services" ? (
                <Scissors className="size-4 text-accent" aria-hidden="true" />
              ) : (
                <Users className="size-4 text-accent" aria-hidden="true" />
              )}
              Ranking do Período
            </h3>
            <div className="flex rounded-lg border border-border-subtle bg-canvas/50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setRankingTab("services")}
                className={`cursor-pointer rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  rankingTab === "services"
                    ? "bg-accent text-accent-ink"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                Serviços
              </button>
              <button
                type="button"
                onClick={() => setRankingTab("professionals")}
                className={`cursor-pointer rounded-md px-2.5 py-1 font-semibold transition-colors ${
                  rankingTab === "professionals"
                    ? "bg-accent text-accent-ink"
                    : "text-ink-secondary hover:text-ink"
                }`}
              >
                Profissionais
              </button>
            </div>
          </div>

          {rankingTab === "services" ? (
            rankings.services.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border-subtle py-6 text-center text-xs text-ink-muted">
                Nenhum serviço concluído no período selecionado.
              </p>
            ) : (
              <ol className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {rankings.services.map((svc, idx) => (
                  <li
                    key={svc.serviceId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{svc.serviceName}</p>
                        <p className="text-[11px] text-ink-muted">
                          {svc.completedCount} concluído(s) · {svc.totalCount} total
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-ink">
                      {fmt(svc.revenueInCents)}
                    </span>
                  </li>
                ))}
              </ol>
            )
          ) : rankings.professionals.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-subtle py-6 text-center text-xs text-ink-muted">
              Nenhum profissional com atendimentos concluídos no período.
            </p>
          ) : (
            <ol className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {rankings.professionals.map((pro, idx) => (
                <li
                  key={pro.collaboratorId}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{pro.name}</p>
                      <p className="text-[11px] text-ink-muted">
                        {pro.completedCount} atendimento(s) concluído(s)
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 font-bold tabular-nums text-ink">
                    {fmt(pro.revenueInCents)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </article>
      </div>
    </section>
  );
}
