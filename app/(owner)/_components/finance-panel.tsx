"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Coins,
  Percent,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api-client";
import { formatPriceFromCents, getTodayIsoDateInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type { FinanceSummaryResponse } from "@/lib/types/finance";
import {
  getAvatarTint,
  getClientInitials,
} from "@/components/ui/agenda-card";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getMonthRange(timezone: string): { from: string; to: string } {
  const today = getTodayIsoDateInTimezone(timezone);
  const [y, m] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return {
    from: `${y}-${mm}-01`,
    to: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function getLast30DaysRange(timezone: string): { from: string; to: string } {
  const today = getTodayIsoDateInTimezone(timezone);
  const [y, m, d] = today.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d - 29));
  const sy = start.getUTCFullYear();
  const sm = String(start.getUTCMonth() + 1).padStart(2, "0");
  const sd = String(start.getUTCDate()).padStart(2, "0");
  return { from: `${sy}-${sm}-${sd}`, to: today };
}

function formatShortIsoDay(isoDate: string, locale: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
  }).format(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
}

export function FinancePanel() {
  const { session } = useSession();
  const { locale, t } = useLocale();
  const timezone = session.company.timezone;

  const initialRange = useMemo(() => getMonthRange(timezone), [timezone]);
  const [fromDate, setFromDate] = useState(initialRange.from);
  const [toDate, setToDate] = useState(initialRange.to);
  const [data, setData] = useState<FinanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFinance = useCallback(
    async (fromVal: string, toVal: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiRequest<FinanceSummaryResponse>(
          "/finance/summary",
          {
            auth: true,
            query: { from: fromVal || undefined, to: toVal || undefined },
          },
        );
        setData(res);
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : t.errors.networkDescription,
        );
      } finally {
        setLoading(false);
      }
    },
    [t.errors.networkDescription],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await apiRequest<FinanceSummaryResponse>(
          "/finance/summary",
          {
            auth: true,
            query: { from: initialRange.from, to: initialRange.to },
          },
        );
        if (active) setData(res);
      } catch (err) {
        if (active) {
          setError(
            err instanceof ApiError ? err.message : t.errors.networkDescription,
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [initialRange.from, initialRange.to, t.errors.networkDescription]);

  const applyRange = (nextFrom: string, nextTo: string) => {
    setFromDate(nextFrom);
    setToDate(nextTo);
    void loadFinance(nextFrom, nextTo);
  };

  const maxDayValue = useMemo(() => {
    if (!data?.series.length) return 1;
    return Math.max(
      1,
      ...data.series.map((d) => d.realizedInCents + d.forecastInCents),
    );
  }, [data]);

  const maxServiceRevenue = useMemo(() => {
    if (!data?.byService.length) return 1;
    return Math.max(1, ...data.byService.map((s) => s.revenueInCents));
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Filtro de período */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-title-sm font-semibold text-ink">
              {t.finance.title}
            </h2>
            <p className="mt-0.5 text-xs text-ink-secondary">
              {t.finance.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const r = getMonthRange(timezone);
                applyRange(r.from, r.to);
              }}
              className="min-h-9 rounded-xl px-3 text-xs font-medium cursor-pointer"
            >
              <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
              {t.finance.thisMonth}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const r = getLast30DaysRange(timezone);
                applyRange(r.from, r.to);
              }}
              className="min-h-9 rounded-xl px-3 text-xs font-medium cursor-pointer"
            >
              {t.finance.last30Days}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadFinance(fromDate, toDate)}
              aria-label={t.common.retry}
              className="min-h-9 rounded-xl px-2.5 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 max-w-md">
          <div className="space-y-1">
            <Label htmlFor="fin-from" className="text-xs text-ink-muted">
              {t.finance.from}
            </Label>
            <Input
              id="fin-from"
              type="date"
              value={fromDate}
              onChange={(e) => applyRange(e.target.value, toDate)}
              className="min-h-10 rounded-xl border-border-strong bg-subtle/40 px-3 text-xs tabular-nums"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fin-to" className="text-xs text-ink-muted">
              {t.finance.to}
            </Label>
            <Input
              id="fin-to"
              type="date"
              value={toDate}
              onChange={(e) => applyRange(fromDate, e.target.value)}
              className="min-h-10 rounded-xl border-border-strong bg-subtle/40 px-3 text-xs tabular-nums"
            />
          </div>
        </div>
      </section>

      {loading ? (
        <CardListSkeleton count={4} />
      ) : error ? (
        <ErrorState
          title={t.errors.networkTitle}
          description={error}
          retryLabel={t.common.retry}
          onRetry={() => void loadFinance(fromDate, toDate)}
        />
      ) : !data ? null : (
        <>
          {/* 4 KPIs Financeiros com alto contraste e badges distintas */}
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 space-y-2 shadow-xs transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t.finance.realizedRevenue}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="font-mono text-2xl font-bold text-ink tabular-nums">
                {formatPriceFromCents(
                  data.summary.realizedRevenueInCents,
                  locale,
                )}
              </p>
              <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">
                ✓ {data.summary.completedCount} {t.common.agendaCompleted.toLowerCase()}
              </p>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface p-5 space-y-2 shadow-xs transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t.finance.forecastRevenue}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold shadow-xs">
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="font-mono text-2xl font-bold text-ink tabular-nums">
                {formatPriceFromCents(
                  data.summary.forecastRevenueInCents,
                  locale,
                )}
              </p>
              <p className="text-[11px] font-medium text-blue-600 dark:text-blue-400 tabular-nums">
                {data.summary.confirmedCount + data.summary.pendingCount}{" "}
                {t.finance.colUpcoming.toLowerCase()}
              </p>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface p-5 space-y-2 shadow-xs transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t.finance.commissionsToPay}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold shadow-xs">
                  <Percent className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="font-mono text-2xl font-bold text-ink tabular-nums">
                {formatPriceFromCents(
                  data.summary.realizedCommissionsInCents,
                  locale,
                )}
              </p>
              <p className="text-[11px] text-ink-muted tabular-nums">
                +{formatPriceFromCents(data.summary.forecastCommissionsInCents, locale)}{" "}
                {t.finance.legendForecast.toLowerCase()}
              </p>
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface p-5 space-y-2 shadow-xs transition-shadow hover:shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  {t.finance.netProfit}
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-xs">
                  <Wallet className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <p className="font-mono text-2xl font-bold text-accent tabular-nums">
                {formatPriceFromCents(
                  data.summary.netProfitRealizedInCents,
                  locale,
                )}
              </p>
              <p className="text-[11px] text-ink-muted tabular-nums">
                {t.finance.legendForecast}:{" "}
                <span className="font-semibold text-ink">
                  {formatPriceFromCents(
                    data.summary.netProfitProjectedInCents,
                    locale,
                  )}
                </span>
              </p>
            </div>
          </section>

          {/* Gráficos: Evolução Diária + Distribuição por Serviço */}
          <section className="grid gap-5 lg:grid-cols-12">
            <div className="rounded-2xl border border-border-subtle bg-surface p-5 lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BarChart3
                    className="h-4 w-4 text-accent"
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold text-ink">
                    {t.finance.evolutionChartTitle}
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-accent" />
                    {t.finance.legendRealized}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-xs bg-accent/30" />
                    {t.finance.legendForecast}
                  </span>
                </div>
              </div>

              {data.series.length === 0 ? (
                <EmptyState
                  title={t.common.noData}
                  description={t.finance.noDataPeriod}
                  icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />}
                />
              ) : (
                <div className="overflow-x-auto pb-2">
                  <div className="flex items-end gap-2.5 min-w-[360px] h-52 pt-4">
                    {data.series.map((day) => {
                      const realizedPct = Math.round(
                        (day.realizedInCents / maxDayValue) * 100,
                      );
                      const forecastPct = Math.round(
                        (day.forecastInCents / maxDayValue) * 100,
                      );
                      const tooltip = `${formatShortIsoDay(day.date, locale)} · ${t.finance.legendRealized}: ${formatPriceFromCents(day.realizedInCents, locale)} | ${t.finance.legendForecast}: ${formatPriceFromCents(day.forecastInCents, locale)}`;
                      return (
                        <div
                          key={day.date}
                          title={tooltip}
                          className="flex flex-1 min-w-9 flex-col items-center justify-end gap-1.5 h-full"
                        >
                          <div className="flex w-full max-w-8 flex-1 flex-col justify-end rounded-lg bg-subtle/60 overflow-hidden">
                            {forecastPct > 0 && (
                              <div
                                style={{ height: `${Math.max(4, forecastPct)}%` }}
                                className="w-full bg-accent/30 transition-all duration-300"
                              />
                            )}
                            {realizedPct > 0 && (
                              <div
                                style={{ height: `${Math.max(4, realizedPct)}%` }}
                                className="w-full bg-accent transition-all duration-300"
                              />
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-ink-muted tabular-nums whitespace-nowrap">
                            {formatShortIsoDay(day.date, locale)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border-subtle bg-surface p-5 lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-accent" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-ink">
                  {t.finance.servicesBreakdownTitle}
                </h3>
              </div>

              {data.byService.length === 0 ? (
                <p className="py-8 text-center text-xs text-ink-muted">
                  {t.finance.noDataPeriod}
                </p>
              ) : (
                <ul className="space-y-3">
                  {data.byService.slice(0, 6).map((svc) => {
                    const widthPct = Math.max(
                      6,
                      Math.round((svc.revenueInCents / maxServiceRevenue) * 100),
                    );
                    return (
                      <li key={svc.serviceName} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-ink">
                            {svc.serviceName}{" "}
                            <span className="text-ink-muted">({svc.count})</span>
                          </span>
                          <span className="shrink-0 font-mono font-medium text-ink tabular-nums">
                            {formatPriceFromCents(svc.revenueInCents, locale)}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-subtle">
                          <div
                            style={{ width: `${widthPct}%` }}
                            className="h-full rounded-full bg-accent transition-all duration-300"
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Tabela detalhada de repasse de comissões por funcionário */}
          <section className="rounded-2xl border border-border-subtle bg-surface overflow-hidden">
            <div className="border-b border-border-subtle px-5 py-4">
              <h3 className="text-sm font-semibold text-ink">
                {t.finance.commissionsTableTitle}
              </h3>
            </div>

            {data.byCollaborator.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-ink-muted">
                {t.finance.noDataPeriod}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-subtle bg-subtle/40 text-ink-muted">
                      <th className="px-5 py-3 font-medium">
                        {t.finance.colProfessional}
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        {t.finance.colCompleted}
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        {t.finance.colUpcoming}
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        {t.finance.colRevenue}
                      </th>
                      <th className="px-4 py-3 font-medium text-right">
                        {t.finance.colCommissionToPay}
                      </th>
                      <th className="px-5 py-3 font-medium text-right">
                        {t.finance.colForecastCommission}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {data.byCollaborator.map((row) => (
                      <tr
                        key={row.collaboratorId}
                        className="transition-colors hover:bg-subtle/30"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            {row.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={row.avatarUrl}
                                alt={row.name}
                                className="h-8 w-8 shrink-0 rounded-full object-cover border border-border-subtle"
                              />
                            ) : (
                              <span
                                className={[
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
                                  getAvatarTint(row.name),
                                ].join(" ")}
                              >
                                {getClientInitials(row.name)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">
                                {row.name}
                              </p>
                              <p className="truncate text-[11px] text-ink-muted">
                                {row.specialty}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-ink tabular-nums">
                          {row.completedCount}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-ink-secondary tabular-nums">
                          {row.upcomingCount}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-ink tabular-nums">
                          {formatPriceFromCents(
                            row.realizedRevenueInCents,
                            locale,
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-accent tabular-nums">
                          {formatPriceFromCents(
                            row.commissionToPayInCents,
                            locale,
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-ink-secondary tabular-nums">
                          {formatPriceFromCents(
                            row.forecastCommissionInCents,
                            locale,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
