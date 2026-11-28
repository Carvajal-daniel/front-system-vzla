"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronRight, Clock3, Crosshair, Loader2, Users } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { formatTimeInTimezone, getCurrencyFormatter, getTodayIsoDateInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useTheme } from "@/lib/theme-context";
import { useSession } from "@/components/ui/auth-guard";
import { usePrivacy } from "@/lib/privacy-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { maskCurrency } from "@/components/ui/sensitive-value";
import { appointmentStatusTone, StatusBadge } from "@/components/ui/status-badge";
import type { Appointment } from "@/lib/types/appointment";
import type { Collaborator } from "@/lib/types/team";
import type { FinanceSummaryResponse } from "@/lib/types/finance";
import { ExecutiveKpisSection } from "./executive-kpis-section";
import { GoalGauge, goalStageColors, RevenueColumns, RevenueComparisonChart, revenueComparisonColors, smoothPath } from "./revenue-charts";

type GoalResponse = { monthlyGoalInCents: number; currency: FinanceSummaryResponse["currency"] };
type DashboardData = { current: FinanceSummaryResponse; previous: FinanceSummaryResponse; months: FinanceSummaryResponse[]; appointments: Appointment[]; collaborators: Collaborator[]; goal: GoalResponse };
type DashboardPeriod = "week" | "month" | "30days";

const rankingBorders = [
  "border-[3px] border-amber-400 ring-2 ring-amber-400/30",
  "border-[3px] border-slate-300 ring-2 ring-slate-300/30",
  "border-[3px] border-amber-600 ring-2 ring-amber-600/30",
];

const dayInMs = 86_400_000;

const kpiTrends = {
  growth: { color: "var(--status-success)", bg: "var(--status-success-bg)", ink: "var(--status-success-ink)", icon: ArrowUp },
  decline: { color: "var(--status-danger)", bg: "var(--status-danger-bg)", ink: "var(--status-danger-ink)", icon: ArrowDown },
  stable: { color: "var(--ink-muted)", bg: "var(--status-neutral-bg)", ink: "var(--status-neutral-ink)", icon: null },
};

type RevenuePoint = { date: string; previousDate: string; dailyRevenue: number; current: number; previous: number };

function shiftMonth(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}
function monthRange(year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}
function isoDateInTimezone(value: Date, timezone: string) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  return `${p.find((x) => x.type === "year")?.value}-${p.find((x) => x.type === "month")?.value}-${p.find((x) => x.type === "day")?.value}`;
}
function percentChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function dateKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function comparisonWindow(data: DashboardData, today: number, period: DashboardPeriod) {
  if (period === "week") {
    const daysSinceMonday = (new Date(today).getUTCDay() + 6) % 7;
    const monday = today - daysSinceMonday * dayInMs;
    return { currentStart: monday, currentEnd: monday + 6 * dayInMs, previousStart: monday - 7 * dayInMs, previousEnd: monday - dayInMs };
  }
  if (period === "30days") {
    const currentStart = today - 29 * dayInMs;
    return { currentStart, currentEnd: today, previousStart: currentStart - 30 * dayInMs, previousEnd: currentStart - dayInMs };
  }
  return {
    currentStart: Date.parse(data.current.period.from),
    currentEnd: today,
    previousStart: Date.parse(data.previous.period.from),
    previousEnd: Date.parse(data.previous.period.to),
  };
}

function buildRevenueComparison(data: DashboardData, today: string, period: DashboardPeriod): RevenuePoint[] {
  const todayTimestamp = Date.parse(today);
  const { currentStart, currentEnd, previousStart, previousEnd } = comparisonWindow(data, todayTimestamp, period);
  const dailyRevenue = new Map(
    [...data.months.slice(0, -2), data.previous, data.current]
      .flatMap(({ series }) => series.map(({ date, realizedInCents }) => [date, realizedInCents] as const)),
  );
  let current = 0;
  let previous = 0;

  return Array.from({ length: (currentEnd - currentStart) / dayInMs + 1 }, (_, index) => {
    const currentDay = currentStart + index * dayInMs;
    const date = dateKey(currentDay);
    const previousDay = previousStart + index * dayInMs;
    const previousDate = dateKey(Math.min(previousDay, previousEnd));
    const daily = currentDay <= todayTimestamp ? (dailyRevenue.get(date) ?? 0) : 0;
    current += daily;
    if (previousDay <= previousEnd) previous += dailyRevenue.get(previousDate) ?? 0;
    return { date, previousDate, dailyRevenue: daily, current, previous };
  });
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const gradientId = useId();
  const samples = values.length < 2 ? [values[0] ?? 0, values[0] ?? 0] : values;
  const max = Math.max(1, ...samples);
  const points = samples.map((value, index) => [
    (index / (samples.length - 1)) * 320,
    39 - (value / max) * 32,
  ] as const);
  const path = smoothPath(points);
  return (
    <svg viewBox="0 0 320 48" preserveAspectRatio="none" className="h-14 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x2="0" y2="1">
          <stop stopColor={color} stopOpacity=".24" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} V 48 H 0 Z`} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function OwnerDashboard() {
  const { session } = useSession();
  const { locale, t } = useLocale();
  const { mode, palette } = useTheme();
  const { hideSensitiveValues } = usePrivacy();
  const router = useRouter();
  const searchParams = useSearchParams();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";
  const comparisonColors = revenueComparisonColors(palette, mode);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const nowRange = useMemo(() => {
    const today = getTodayIsoDateInTimezone(timezone);
    const [year, month] = today.split("-").map(Number);
    return { today, ...monthRange(year, month), previous: monthRange(...Object.values(shiftMonth(year, month, -1)) as [number, number]) };
  }, [timezone]);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      // The paired 30-day windows start 59 days ago. Include one extra UTC day for the company timezone.
      const firstDay = new Date(Date.parse(nowRange.today) - 60 * dayInMs);
      const [current, previous, months, appointments, collabRaw, goal] = await Promise.all([
        apiRequest<FinanceSummaryResponse>("/finance/summary", { query: { from: nowRange.from, to: nowRange.to } }),
        apiRequest<FinanceSummaryResponse>("/finance/summary", { query: { from: nowRange.previous.from, to: nowRange.previous.to } }),
        Promise.all(Array.from({ length: 6 }, (_, index) => {
          const [year, month] = nowRange.from.split("-").map(Number);
          const shifted = shiftMonth(year, month, index - 5);
          return apiRequest<FinanceSummaryResponse>("/finance/summary", { query: monthRange(shifted.year, shifted.month) });
        })),
        apiRequest<Appointment[]>("/appointments", { query: { from: firstDay.toISOString(), to: `${isoDateInTimezone(new Date(Date.now() + 30 * dayInMs), timezone)}T23:59:59.999Z` } }),
        apiRequest<{ collaborators: Collaborator[] } | Collaborator[]>("/collaborators"),
        apiRequest<GoalResponse>("/companies/me/monthly-goal").catch(() => ({
          monthlyGoalInCents: 0,
          currency,
        })),
      ]);
      const collaborators = Array.isArray(collabRaw) ? collabRaw : collabRaw.collaborators ?? [];
      setData({ current, previous, months, appointments, collaborators, goal });
      setGoalInput(String(goal.monthlyGoalInCents / 100));
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [nowRange, timezone, currency]);
  useEffect(() => {
    const appointmentId = searchParams.get("appointmentId");
    if (appointmentId) {
      router.replace(`/owner/appointments?appointmentId=${encodeURIComponent(appointmentId)}`);
      return;
    }
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, router, searchParams]);

  const saveGoal = async () => {
    const amount = Number(goalInput.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return;
    setSavingGoal(true);
    try {
      const goal = await apiRequest<GoalResponse>("/companies/me/monthly-goal", { method: "PATCH", body: { monthlyGoalInCents: Math.round(amount * 100), currency } });
      setData((old) => old ? { ...old, goal } : old); setGoalOpen(false);
    } finally { setSavingGoal(false); }
  };

  useEffect(() => {
    if (!goalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGoalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goalOpen]);

  if (searchParams.has("appointmentId")) return null;
  if (loading) return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-4">{[1,2,3,4].map((x) => <div key={x} className="h-36 animate-pulse rounded-2xl border border-border-subtle bg-surface" />)}</div><div className="h-[35rem] animate-pulse rounded-2xl border border-border-subtle bg-surface" /></div>;
  if (error || !data) return <section className="rounded-2xl border border-border-subtle bg-surface p-8 text-center"><p className="text-sm text-ink-secondary">{t.dashboard.loadError}</p><button type="button" onClick={() => void load()} className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">{t.common.retry}</button></section>;

  const summary = data.current.summary;
  const previousSummary = data.previous.summary;
  const monthlyRevenue = summary.realizedRevenueInCents;
  const upcoming = data.appointments.filter((a) => (a.status === "PENDING" || a.status === "CONFIRMED") && new Date(a.startsAt) >= new Date()).sort((a,b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 5);
  const completedByDay = new Map<string, number>();
  for (const appointment of data.appointments) {
    if (appointment.status !== "COMPLETED") continue;
    const date = isoDateInTimezone(new Date(appointment.startsAt), timezone);
    completedByDay.set(date, (completedByDay.get(date) ?? 0) + 1);
  }
  const comparison = buildRevenueComparison(data, nowRange.today, period);
  const comparisonTotal = comparison[comparison.length - 1];
  const days = comparison.map(({ date, dailyRevenue }) => ({
    revenue: dailyRevenue,
    completed: date <= nowRange.today ? (completedByDay.get(date) ?? 0) : 0,
  }));
  const revenue = period === "month" ? monthlyRevenue : comparisonTotal.current;
  const previousRevenue = period === "month" ? previousSummary.realizedRevenueInCents : comparisonTotal.previous;
  const completed = period === "month" ? summary.completedCount : days.reduce((total, day) => total + day.completed, 0);
  const previousCompleted = period === "month" ? previousSummary.completedCount : comparison.reduce(
    (total, { previousDate }) => total + (completedByDay.get(previousDate) ?? 0), 0,
  );
  const average = completed ? Math.round(revenue / completed) : 0;
  const previousAverage = previousCompleted ? Math.round(previousRevenue / previousCompleted) : 0;
  const maxRankRevenue = Math.max(1, ...data.current.byCollaborator.map((person) => person.realizedRevenueInCents));
  const maxRankCount = Math.max(1, ...data.current.byCollaborator.map((person) => person.completedCount));
  const maxRankCommission = Math.max(1, ...data.current.byCollaborator.map((person) => person.commissionToPayInCents));
  const rankScore = (person: FinanceSummaryResponse["byCollaborator"][number]) => person.realizedRevenueInCents / maxRankRevenue + person.completedCount / maxRankCount + person.commissionToPayInCents / maxRankCommission;
  const rank = [...data.current.byCollaborator].sort((a,b) => rankScore(b) - rankScore(a));
  const periodLabels = {
    week: { current: t.dashboard.thisWeek, previous: t.dashboard.previousWeek, change: t.dashboard.vsPreviousWeek },
    month: { current: t.dashboard.currentMonth, previous: t.dashboard.previousMonth, change: t.dashboard.vsPrevious },
    "30days": { current: t.dashboard.last30Days, previous: t.dashboard.previous30Days, change: t.dashboard.vsPrevious30Days },
  }[period];
  const comparisonLabels = {
    chart: t.dashboard.revenueComparison,
    current: periodLabels.current,
    previous: periodLabels.previous,
    today: t.dashboard.today,
    dayOne: t.dashboard.dayOne,
  };
  const displayCurrency = currency;
  const currencyFormat = getCurrencyFormatter(locale, displayCurrency, 0);
  const fmt = (value: number) => maskCurrency(currencyFormat.format(value / 100), hideSensitiveValues);
  const deltaFormat = new Intl.NumberFormat(locale, { style: "percent", signDisplay: "exceptZero", maximumFractionDigits: 1 });
  const smallDeltaFormat = new Intl.NumberFormat(locale, { style: "percent", signDisplay: "exceptZero", maximumSignificantDigits: 1 });
  const target = data.goal.monthlyGoalInCents ?? 0;
  const goalRatio = target > 0 ? monthlyRevenue / target : 0;
  const goalPercent = new Intl.NumberFormat(locale, { style: "percent" }).format(goalRatio);

  return <div className="space-y-5">
    <div className="flex justify-end">
      <span className="rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-xs text-ink-secondary">
        {t.dashboard.updated}: <time dateTime={nowRange.today}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(nowRange.today))}</time>
      </span>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { label: period === "month" ? t.dashboard.revenue : t.dashboard.periodRevenue, value: fmt(revenue), delta: percentChange(revenue, previousRevenue), href: "/owner/finance", spark: days.map((day) => day.revenue) },
        { label: t.dashboard.completed, value: new Intl.NumberFormat(locale).format(completed), delta: percentChange(completed, previousCompleted), href: "/owner/appointments", spark: days.map((day) => day.completed) },
        { label: t.dashboard.averageTicket, value: fmt(average), delta: percentChange(average, previousAverage), href: "/owner/finance", spark: days.map((day) => day.completed ? day.revenue / day.completed : 0) },
      ].map((kpi) => {
        const trend = kpiTrends[kpi.delta > 0 ? "growth" : kpi.delta < 0 ? "decline" : "stable"];
        const TrendIcon = trend.icon;
        const changeFormat = Math.abs(kpi.delta) < 0.1 ? smallDeltaFormat : deltaFormat;

        return (
          <article key={kpi.label} className="flex min-w-0 flex-col rounded-2xl border border-border-subtle bg-surface shadow-[0_1px_3px_0_rgb(15_23_42/0.06),0_1px_2px_-1px_rgb(15_23_42/0.04)]">
            <div className="flex flex-1 flex-col px-4 pt-4 sm:px-3 xl:px-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs leading-5 font-medium text-ink-secondary sm:text-xs xl:text-sm">{kpi.label}</h3>
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[11px] leading-4 font-semibold tabular-nums" title={periodLabels.change}
                  style={{ backgroundColor: trend.bg, color: trend.ink }}>
                  {TrendIcon && <TrendIcon aria-hidden="true" className="size-3" />}
                  {changeFormat.format(kpi.delta / 100)}
                  <span className="sr-only"> {periodLabels.change}</span>
                </span>
              </div>
              <strong className="mt-1 mb-2 font-mono text-2xl leading-tight font-bold tracking-tight break-words text-ink tabular-nums xl:text-3xl">{kpi.value}</strong>
              <div className="mt-auto"><Sparkline values={kpi.spark} color={trend.color} /></div>
            </div>
            <div className="border-t border-border-subtle px-4 py-3 sm:px-3 xl:px-5">
              <Link href={kpi.href} aria-label={`${t.dashboard.viewMoreDetails} · ${kpi.label}`} className="inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-ink hover:text-accent">
                {t.dashboard.viewMoreDetails}
                <ChevronRight aria-hidden="true" className="size-3.5" />
              </Link>
            </div>
          </article>
        );
      })}
    </div>

    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
        <section className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-ink">{t.dashboard.revenueComparison}</h3>
              {period === "month" && <p className="mt-1 text-xs text-ink-secondary">{t.dashboard.revenueComparisonHint}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label={t.dashboard.revenueComparison} value={period} onChange={(event) => setPeriod(event.target.value as DashboardPeriod)}
                className="h-9 rounded-lg border border-border-strong bg-surface px-2 text-xs text-ink">
                <option value="week">{t.dashboard.thisWeek}</option>
                <option value="month">{t.dashboard.thisMonth}</option>
                <option value="30days">{t.dashboard.last30Days}</option>
              </select>
              <button type="button" onClick={() => { setGoalInput(String(target / 100)); setGoalOpen(true); }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-ink cursor-pointer">
                <Crosshair aria-hidden="true" className="size-3.5" />{t.dashboard.setGoal}
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-ink-secondary">
            {(["current", "previous"] as const).map((key) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: comparisonColors[key] }} />{comparisonLabels[key]}
              </span>
            ))}
            <strong className="ml-auto font-mono text-ink tabular-nums">{fmt(comparisonTotal.current)}</strong>
          </div>
          <RevenueComparisonChart key={period} points={comparison} locale={locale} currency={displayCurrency} labels={comparisonLabels} period={period} colors={comparisonColors} today={nowRange.today} />
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="flex min-w-0 flex-col rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm sm:p-5">
            <h3 className="font-bold text-ink">{t.dashboard.monthlyGoal}</h3>
            <p className="mt-1 text-xs text-ink-secondary">{t.dashboard.goalProgress}</p>
            <div className="flex flex-1 items-center py-4">
              <GoalGauge ratio={goalRatio} percentage={goalPercent} caption={t.dashboard.achieved} mode={mode} />
            </div>
            <ul role="list" className="mb-3 flex flex-wrap justify-center gap-x-3 gap-y-1.5 text-[10px] text-ink-secondary">
              {t.dashboard.goalStages.map((stage, index) => (
                <li key={stage} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: goalStageColors[index] }} />
                  {stage}
                </li>
              ))}
            </ul>
            <dl className="grid grid-cols-2 gap-3 border-t border-border-subtle pt-3 text-xs">
              <div>
                <dt className="text-ink-secondary">{t.dashboard.reached}</dt>
                <dd className="mt-1 font-mono font-semibold break-words text-ink tabular-nums">{fmt(monthlyRevenue)}</dd>
              </div>
              <div className="text-right">
                <dt className="text-ink-secondary">{t.dashboard.target}</dt>
                <dd className="mt-1 font-mono font-semibold break-words text-ink tabular-nums">{target ? fmt(target) : t.dashboard.goalNotSet}</dd>
              </div>
            </dl>
          </section>
          <section className="min-w-0 rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm sm:p-5">
            <h3 className="font-bold text-ink">{t.dashboard.monthlyRevenue}</h3>
            <p className="mt-1 text-xs text-ink-secondary">{t.dashboard.lastSixMonths}</p>
            <RevenueColumns columns={data.months.map(({ period, summary }) => ({
              id: period.from,
              label: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(period.from)),
              shortLabel: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(period.from)),
              amountInCents: summary.realizedRevenueInCents,
            }))} locale={locale} currency={displayCurrency} palette={palette} />
          </section>
        </div>
      </div>

      <aside className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-1">
        <section className="min-w-0 rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-ink">{t.dashboard.staffRanking}</h3>
              <p className="mt-1 text-xs text-ink-secondary">{t.dashboard.employeeOfMonth}</p>
            </div>
            <span className="rounded-lg bg-accent-soft p-2 text-accent"><Users aria-hidden="true" className="size-4" /></span>
          </div>
          {rank.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-secondary">{t.dashboard.noRanking}</p>
          ) : (
            <ol role="list" className="mt-3 list-none divide-y divide-border-subtle">
              {rank.slice(0, 5).map((person, index) => (
                <li key={person.collaboratorId} className="flex items-center gap-2.5 py-2.5">
                  <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-xs font-bold text-ink-secondary ${rankingBorders[index] ?? ""}`}>
                    {person.avatarUrl ? (
                      <Image src={person.avatarUrl} alt="" width={40} height={40} unoptimized className="h-full w-full object-cover" />
                    ) : person.name.slice(0, 1).toLocaleUpperCase(locale)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink">{person.name}</p>
                    <p className="truncate text-[10px] text-ink-secondary">{data.collaborators.find((collaborator) => collaborator.id === person.collaboratorId)?.specialty ?? t.common.specialty}</p>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <p className="text-xs font-bold text-ink">{fmt(person.realizedRevenueInCents)}</p>
                    <p className="text-[11px] text-ink-secondary">{person.completedCount} {t.dashboard.attendances} · {fmt(person.commissionToPayInCents)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-ink">{t.dashboard.upcomingAppointments}</h3>
              <p className="mt-1 text-xs text-ink-muted">{t.dashboard.nextAppointments}</p>
            </div>
            <span className="rounded-lg bg-accent-soft p-2 text-accent">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {upcoming.map((appointment) => (
              <div key={appointment.id} className="rounded-xl border border-border-subtle bg-subtle/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-ink tabular-nums">
                    {new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short", timeZone: timezone }).format(new Date(appointment.startsAt))} · {formatTimeInTimezone(appointment.startsAt, timezone, locale)}
                  </span>
                  <StatusBadge tone={appointmentStatusTone(appointment.status)} label={t.status[appointment.status]} />
                </div>
                <p className="mt-1 truncate text-xs font-bold text-ink">{appointment.clientName}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="max-w-[65%] truncate rounded-md border border-border-subtle bg-surface px-1.5 py-0.5 text-xs text-ink-secondary">{appointment.serviceNameSnapshot}</span>
                  <span className="truncate text-xs text-ink-muted">{data.collaborators.find((c) => c.id === appointment.collaboratorId)?.name ?? ""}</span>
                </div>
              </div>
            ))}
            {upcoming.length === 0 && <p className="py-5 text-center text-xs text-ink-muted">{t.dashboard.noUpcoming}</p>}
          </div>
          <Link href="/owner/appointments" className="mt-3 flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-subtle">
            <span>{t.dashboard.openAgenda}</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </section>
      </aside>
    </div>
    <ExecutiveKpisSection from={nowRange.from} to={nowRange.to} />
    <Modal open={goalOpen} title={t.dashboard.goalModalTitle} maxWidth="max-w-md" onClose={() => setGoalOpen(false)}>
      <div className="space-y-4">
        <p className="text-xs text-ink-muted">{t.dashboard.goalModalHint}</p>
        <div className="space-y-1.5">
          <label htmlFor="monthly-goal" className="block text-xs font-semibold text-ink">{t.dashboard.goalAmount}</label>
          <div className="flex gap-2">
            <Input
              id="monthly-goal"
              type="number"
              min="1"
              step="0.01"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              className="h-10 min-w-0 flex-1 rounded-lg border-border-strong bg-surface px-3 font-mono text-sm text-ink tabular-nums"
            />
            <span className="inline-flex h-10 items-center rounded-lg border border-border-strong px-3 font-mono text-xs font-semibold text-ink">{currency}</span>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setGoalOpen(false)}>
            {t.common.cancel}
          </Button>
          <Button type="button" disabled={savingGoal} onClick={() => void saveGoal()}>
            {savingGoal ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            {t.common.save}
          </Button>
        </div>
      </div>
    </Modal>
  </div>;
}
