"use client";

import { useId, useState } from "react";
import { Activity, Bell, ChartBar } from "lucide-react";
import { getTodayIsoDateInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { THEME_PALETTES, useTheme } from "@/lib/theme-context";
import type { FinanceSummaryResponse } from "@/lib/types/finance";
import { formatFinanceRange, getFinanceSeries } from "./finance-report-data";
import { GoalGauge, RevenueColumns, RevenueComparisonChart, revenueComparisonColors } from "./revenue-charts";

const panel = "rounded-2xl border border-border-subtle bg-surface p-4 shadow-xs sm:p-5";
type ChartsProps = { data: FinanceSummaryResponse; money: (cents: number) => string };
const dayMs = 86_400_000;
const isoDay = (instant: number) => new Date(instant).toISOString().slice(0, 10);

function cashComparison(data: FinanceSummaryResponse, today: string) {
  const firstDay = Date.parse(data.period.from);
  const days = Math.max(1, (Date.parse(data.period.to < today ? data.period.to : today) - firstDay) / dayMs + 1);
  const size = Math.ceil(days / 31);
  const buckets = Array.from({ length: Math.ceil(days / size) }, (_, index) => {
    const offset = Math.min(days - 1, (index + 1) * size - 1) * dayMs;
    const date = isoDay(firstDay + offset);
    return { date, previousDate: date, current: 0, previous: 0 };
  });
  const bucketFor = (date: string) => {
    const index = (Date.parse(date) - firstDay) / dayMs;
    return index >= 0 && index < days ? buckets[Math.floor(index / size)] : undefined;
  };
  for (const receipt of data.collections.currentCashDays) {
    const bucket = bucketFor(receipt.date);
    if (bucket) bucket.current += receipt.collectedInCents;
  }
  for (const outgoing of data.outflowCashDays) {
    const bucket = bucketFor(outgoing.date);
    if (bucket) bucket.previous += outgoing.commissionsCents + (data.period.collaboratorId ? 0 : outgoing.expensesCents);
  }
  return buckets;
}

function serviceColumns(data: FinanceSummaryResponse, locale: string) {
  const start = Date.parse(data.period.from);
  const end = Date.parse(data.period.to);
  const days = (end - start) / dayMs + 1;
  const width = Math.ceil(days / 7);
  const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const columns = Array.from({ length: Math.ceil(days / width) }, (_, index) => {
    const first = start + index * width * dayMs;
    const last = Math.min(end, first + (width - 1) * dayMs);
    return { id: isoDay(first), label: formatter.formatRange(first, last), shortLabel: formatter.format(first), amountInCents: 0 };
  });
  for (const item of data.series) {
    const column = columns[Math.floor((Date.parse(item.date) - start) / (dayMs * width))];
    if (column) column.amountInCents += item.realizedInCents;
  }
  return columns;
}

export function FinanceCharts({ data, money }: ChartsProps) {
  const { locale, t } = useLocale();
  const { mode, palette } = useTheme();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const tooltipId = useId();
  const serviceTooltipId = useId();
  const dark = mode === "dark";
  const swatch = THEME_PALETTES.find((option) => option.id === palette) ?? THEME_PALETTES[0];
  const primary = dark ? swatch.swatchDark : swatch.swatchLight;
  const colors = [
    primary,
    palette === "emerald" ? (dark ? "#93C5FD" : "#2563EB") : (dark ? "#5EEAD4" : "#0F766E"),
    palette === "velvet" ? (dark ? "#FDA4AF" : "#BE123C") : (dark ? "#C4B5FD" : "#7C3AED"),
  ];
  const labels = [t.finance.legendRealized, t.finance.legendForecast, t.finance.legendCommissions];
  const points = getFinanceSeries(data.period, data.series);
  const values = points.map((point) => [point.realizedInCents, point.forecastInCents, point.commissionsInCents]);
  const maximum = Math.max(1, ...values.flat());
  const active = activeIndex ?? Math.max(0, values.findLastIndex((group) => group.some(Boolean)));
  const current = points[active];
  const shortDate = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });
  const services = data.byService.filter((service) => service.realizedCount > 0);
  const activeService = services.find((service) => service.serviceId === activeServiceId) ?? services[0];
  const integer = new Intl.NumberFormat(locale);
  const today = getTodayIsoDateInTimezone(data.period.timezone);
  const cashPoints = cashComparison(data, today);
  const comparisonColors = revenueComparisonColors(palette, mode);
  const completed = data.appointments.filter((item) => item.status === "COMPLETED" && !item.payment.historical);
  const billed = completed.reduce((total, item) => total + item.grossInCents, 0);
  const collected = completed.reduce((total, item) => total + item.payment.collectedInCents, 0);
  const ratio = billed > 0 ? collected / billed : 0;
  const expenses = data.period.collaboratorId ? null : data.expenses;
  const expenseCategories = expenses?.byCategory.filter((item) => item.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents) ?? [];
  const f = t.finance;
  const flowTitle = expenses ? f.cashFlow : f.professionalCashFlow;
  const flowDetail = expenses ? f.cashFlowDetail : f.professionalCashFlowDetail;
  const outgoingLabel = expenses ? f.cashOutflows : f.cashCommissionTotal;
  const alerts = [
    expenses && data.insights.overdueCount ? [f.overdueAlert, integer.format(data.insights.overdueCount)] : null,
    expenses && data.insights.dueSoonCount ? [f.dueSoonAlert, integer.format(data.insights.dueSoonCount)] : null,
    data.insights.payableCommissionInCents ? [f.commissionAlert, money(data.insights.payableCommissionInCents)] : null,
    !expenses || data.insights.expensesAsRevenuePercent === null ? null
      : [f.expenseImpact, percent.format(data.insights.expensesAsRevenuePercent / 100)],
  ].filter((item) => item !== null);

  return (
    <div className="space-y-5">
      <div className={"grid gap-4 " + (expenses ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "")}>
      <section className={panel} aria-labelledby="finance-collections-series">
        <h3 id="finance-collections-series" className="text-sm font-semibold text-ink">{flowTitle}</h3>
        <p className="mt-1 text-xs text-ink-muted">{flowDetail}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
          {([["current", f.cashInflows], ["previous", outgoingLabel]] as const)
            .map(([key, label]) => (
              <span key={key} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: comparisonColors[key] }} aria-hidden="true" />{label}
              </span>
            ))}
        </div>
        <RevenueComparisonChart points={cashPoints} colors={comparisonColors} currency={data.currency}
          locale={locale} today={today} period={cashPoints.length <= 7 ? "week" : "30days"}
          labels={{
            chart: flowTitle, current: f.cashInflows,
            previous: outgoingLabel, today: t.common.today, dayOne: "",
          }} />
      </section>
      {expenses && <section className={panel} aria-labelledby="finance-expense-categories">
        <h3 id="finance-expense-categories" className="text-sm font-semibold text-ink">{f.expensesByCategory}</h3>
        <p className="mt-1 text-xs text-ink-muted">{f.expensesInPeriod}</p>
        {!expenseCategories.length ? <p className="mt-4 text-xs text-ink-muted">{f.noDataPeriod}</p> : (
          <ul className="mt-4 space-y-3">
            {expenseCategories.map(({ category, amountCents }) => (
              <li key={category} className="space-y-1.5">
                <div className="flex flex-wrap justify-between gap-1 text-xs text-ink-secondary">
                  <span>{f.expenseCategories[category]}</span>
                  <strong className="text-ink tabular-nums">{money(amountCents)}</strong>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: amountCents / expenses.totalCents * 100 + "%", backgroundColor: primary }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>}
      </div>
      <section className={panel} aria-labelledby="finance-alerts">
        <h3 id="finance-alerts" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Bell className="size-4 text-accent" aria-hidden="true" />{f.alertsTitle}
        </h3>
        {alerts.length ? (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {alerts.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-subtle px-3 py-2 text-xs text-ink-secondary">
                <dt>{label}</dt><dd className="mt-1 font-semibold text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="mt-2 text-xs text-ink-muted">{f.noAlerts}</p>}
      </section>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className={panel} aria-labelledby="finance-service-volume">
          <h3 id="finance-service-volume" className="text-sm font-semibold text-ink">{t.finance.serviceVolume}</h3>
          <RevenueColumns columns={serviceColumns(data, locale)} locale={locale} currency={data.currency} palette={palette} />
        </section>
        <section className={panel} aria-labelledby="finance-settled-gauge">
          <h3 id="finance-settled-gauge" className="mb-4 text-sm font-semibold text-ink">{t.finance.collectionGauge}</h3>
          <GoalGauge ratio={ratio} percentage={billed > 0 ? percent.format(ratio) : "—"}
            caption={t.finance.collectionGaugeCaption} mode={mode} />
          <p className="mt-3 text-center text-xs font-medium text-ink-secondary tabular-nums">{money(collected)} / {money(billed)}</p>
        </section>
      </div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className={panel} aria-labelledby="finance-flow-title">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-accent" aria-hidden="true" />
          <h3 id="finance-flow-title" className="text-sm font-semibold text-ink">{t.finance.evolutionChartTitle}</h3>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-secondary">
          {labels.map((label, index) => (
            <li key={label} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ backgroundColor: colors[index] }} />
              {label}
            </li>
          ))}
        </ul>

        {current && (
          <div id={tooltipId} role={activeIndex === null ? undefined : "tooltip"}
            className="my-4 rounded-xl border border-border-subtle bg-subtle/45 p-3">
            <p className="text-xs font-medium text-ink">{formatFinanceRange(current, locale)}</p>
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs tabular-nums">
              {labels.map((label, index) => (
                <div key={label}>
                  <dt className="text-ink-muted">{label}</dt>
                  <dd className="font-semibold text-ink">{money(values[active][index])}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="overflow-x-auto pb-1">
          <div className="flex h-44 items-end gap-1 border-b border-border-strong"
            style={{
              minWidth: points.length * 23,
              backgroundImage: "linear-gradient(to top, var(--border-subtle) 1px, transparent 1px)",
              backgroundSize: "100% 25%",
            }}>
            {points.map((point, index) => (
              <button
                key={point.from}
                type="button"
                aria-label={formatFinanceRange(point, locale)}
                aria-describedby={index === active ? tooltipId : undefined}
                onPointerEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => setActiveIndex(index)}
                className={"flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center gap-px rounded-t-sm px-px focus-visible:outline-2 focus-visible:outline-accent " +
                  (index === active ? "bg-accent/10" : "")}
              >
                {values[index].map((value, series) => (
                  <span key={labels[series]} aria-hidden="true" className="w-full max-w-3 rounded-t-sm"
                    style={{ backgroundColor: colors[series], height: (value / maximum) * 100 + "%" }} />
                ))}
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-ink-muted tabular-nums" aria-hidden="true">
            <span>{shortDate.format(new Date(data.period.from))}</span>
            <span>{shortDate.format(new Date(data.period.to))}</span>
          </div>
        </div>
      </section>

      <section className={panel} aria-labelledby="finance-services-title">
        <div className="flex items-center gap-2">
          <ChartBar className="size-4 text-accent" aria-hidden="true" />
          <h3 id="finance-services-title" className="text-sm font-semibold text-ink">{t.finance.servicesBreakdownTitle}</h3>
        </div>
        <p className="mt-1 text-xs text-ink-muted">{t.finance.participation}</p>
        {!activeService ? (
          <p className="py-10 text-center text-xs text-ink-muted">{t.finance.noDataPeriod}</p>
        ) : (
          <>
            <div id={serviceTooltipId} role={activeServiceId ? "tooltip" : undefined}
              className="mt-4 rounded-xl border border-border-subtle bg-subtle/45 p-3 text-xs">
              <p className="font-medium text-ink">{activeService.serviceName}</p>
              <p className="mt-1 text-ink-muted tabular-nums">
                {t.finance.colCompleted} · {integer.format(activeService.realizedCount)}
              </p>
            </div>
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
              {services.map((service) => {
                const share = data.summary.realizedRevenueInCents
                  ? service.realizedInCents / data.summary.realizedRevenueInCents
                  : 0;
                return (
                  <li key={service.serviceId}>
                    <button type="button"
                      aria-describedby={service === activeService ? serviceTooltipId : undefined}
                      onFocus={() => setActiveServiceId(service.serviceId)}
                      onPointerEnter={() => setActiveServiceId(service.serviceId)}
                      onClick={() => setActiveServiceId(service.serviceId)}
                      className="block w-full cursor-pointer rounded-lg px-2 py-2 text-left hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
                      <span className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs">
                        <span className="font-medium text-ink">{service.serviceName}</span>
                        <span className="flex items-baseline gap-2 tabular-nums">
                          <span className="font-semibold text-ink">{money(service.realizedInCents)}</span>
                          <span className="min-w-[5ch] text-right text-ink-muted">{percent.format(share)}</span>
                        </span>
                      </span>
                      <span className="block h-2 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                        <span className="block h-full rounded-full" style={{ width: share * 100 + "%", backgroundColor: primary }} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
    </div>
  );
}
