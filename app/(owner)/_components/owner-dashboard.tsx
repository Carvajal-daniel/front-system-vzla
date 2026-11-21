"use client";

import { useCallback, useEffect, useId, useMemo, useState, type PointerEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronRight, Clock3, Crosshair, Loader2, Users, X } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { formatTimeInTimezone, getTodayIsoDateInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Locale } from "@/lib/i18n";
import { useTheme, type ThemeMode, type ThemePalette } from "@/lib/theme-context";
import { useSession } from "@/components/ui/auth-guard";
import type { Appointment } from "@/lib/types/appointment";
import type { Collaborator } from "@/lib/types/team";
import type { FinanceSummaryResponse } from "@/lib/types/finance";

type GoalResponse = { monthlyGoalInCents: number; currency: "BRL" | "USD" };
type DashboardData = { current: FinanceSummaryResponse; previous: FinanceSummaryResponse; months: FinanceSummaryResponse[]; appointments: Appointment[]; collaborators: Collaborator[]; goal: GoalResponse };
type DashboardPeriod = "week" | "month" | "30days";

const rankingBorders = [
  "border-[3px] border-amber-400 ring-2 ring-amber-400/30",
  "border-[3px] border-slate-300 ring-2 ring-slate-300/30",
  "border-[3px] border-amber-600 ring-2 ring-amber-600/30",
];

const goalStageColors = ["#F43F5E", "#F59E0B", "#3B82F6", "#10B981"] as const;
const goalTrackColors = { light: "#E2E8F0", dark: "#1E293B" };

const columnColors = {
  cobalt: { light: "#7BA8FF", body: "#2563EB", shade: "#1647B8", cap: "#96B9FF" },
  emerald: { light: "#68E4BC", body: "#10B981", shade: "#087655", cap: "#8CECCF" },
  rose: { light: "#FF8CAA", body: "#E11D48", shade: "#A71137", cap: "#FFABBF" },
  velvet: { light: "#B290FF", body: "#7C3AED", shade: "#5220B1", cap: "#CBADFF" },
  obsidian: { light: "#6EE7F4", body: "#06B6D4", shade: "#087E96", cap: "#A1F3FA" },
} satisfies Record<ThemePalette, { light: string; body: string; shade: string; cap: string }>;

const plotHeight = 176;
const dayInMs = 86_400_000;

const kpiTrends = {
  growth: { color: "#10B981", lightInk: "#047857", darkInk: "#6EE7B7", icon: ArrowUp },
  decline: { color: "#EF4444", lightInk: "#B91C1C", darkInk: "#FCA5A5", icon: ArrowDown },
  stable: { color: "#64748B", lightInk: "#475569", darkInk: "#CBD5E1", icon: null },
};

const comparisonColors = { current: "#4F46E5", previous: "#C084FC" };

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

function smoothPath(points: readonly (readonly [number, number])[]) {
  return points.map(([x, y], index) => {
    if (index === 0) return `M ${x} ${y}`;
    const [previousX, previousY] = points[index - 1];
    const offset = (x - previousX) / 3;
    return `C ${previousX + offset} ${previousY}, ${x - offset} ${y}, ${x} ${y}`;
  }).join(" ");
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

function revenueAxis(highest: number) {
  const maximum = highest || 10000;
  const approximateStep = maximum / 4;
  const magnitude = 10 ** Math.floor(Math.log10(approximateStep));
  const factor = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= approximateStep) ?? 10;
  const step = Math.max(1, factor * magnitude);
  const intervals = Math.ceil(maximum / step);
  return {
    ceiling: intervals * step,
    ticks: Array.from({ length: intervals + 1 }, (_, index) => (intervals - index) * step),
  };
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

function RevenueComparisonChart({ points, locale, currency, labels, period, today }: {
  points: RevenuePoint[];
  locale: Locale;
  currency: GoalResponse["currency"];
  labels: { chart: string; current: string; previous: string; today: string; dayOne: string };
  period: DashboardPeriod;
  today: string;
}) {
  const id = useId();
  const [pointerIndex, setPointerIndex] = useState<number | null>(null);
  const [keyboardIndex, setKeyboardIndex] = useState<number | null>(null);
  const lastIndex = points.length - 1;
  const activeIndex = pointerIndex ?? keyboardIndex;
  const active = activeIndex === null ? undefined : points[activeIndex];
  const { ceiling, ticks } = revenueAxis(Math.max(0, ...points.map(({ current, previous }) => Math.max(current, previous))));
  const x = (index: number) => lastIndex > 0 ? index / lastIndex * 100 : 50;
  const y = (value: number) => (1 - value / ceiling) * 100;
  const formatAxis = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 0 });
  const formatValue = new Intl.NumberFormat(locale, { style: "currency", currency });
  const formatDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const formatShortDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const formatWeekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const series = (["previous", "current"] as const).map((key) => ({
    key,
    color: comparisonColors[key],
    path: lastIndex === 0
      ? `M 0 ${y(points[0][key])} H 100`
      : smoothPath(points.map((point, index) => [x(index), y(point[key])] as const)),
  }));
  const xTicks = points.map(({ date }, index) => ({ date, index })).filter(({ date, index }) =>
    period === "week" || index === 0 || index === lastIndex || (lastIndex - index >= 4 && (period === "30days" ? index % 5 === 0 : Number(date.slice(-2)) % 5 === 0)),
  );

  function selectPointer(event: PointerEvent<HTMLDivElement>) {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    if (width > 0) setPointerIndex(Math.min(lastIndex, Math.max(0, Math.round((event.clientX - left) / width * lastIndex))));
  }

  return (
    <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2">
      <div aria-hidden="true" className="flex h-52 flex-col items-end justify-between text-[10px] whitespace-nowrap text-ink-secondary tabular-nums sm:h-60">
        {ticks.map((tick) => <span key={tick} className="flex h-0 items-center">{formatAxis.format(tick / 100)}</span>)}
      </div>
      <div role="group" aria-label={labels.chart} aria-keyshortcuts="ArrowLeft ArrowRight Home End Escape" tabIndex={0}
        className="relative h-52 rounded-sm sm:h-60" onPointerMove={selectPointer} onPointerDown={selectPointer}
        onPointerLeave={() => setPointerIndex(null)} onPointerCancel={() => setPointerIndex(null)}
        onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setKeyboardIndex(pointerIndex ?? 0); }}
        onBlur={() => setKeyboardIndex(null)} onKeyDown={(event) => {
          const index = activeIndex ?? 0;
          const shortcuts = new Map([
            ["ArrowLeft", Math.max(0, index - 1)],
            ["ArrowRight", Math.min(lastIndex, index + 1)],
            ["Home", 0],
            ["End", lastIndex],
            ["Escape", null],
          ]);
          const nextIndex = shortcuts.get(event.key);
          if (nextIndex === undefined) return;
          event.preventDefault();
          setPointerIndex(null);
          setKeyboardIndex(nextIndex);
        }}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {ticks.map((tick) => <span key={tick} className="h-0 border-t border-dashed border-border-strong/70" />)}
        </div>
        <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <defs>
            {series.map(({ key, color }) => (
              <linearGradient key={key} id={`${id}-${key}`} x2="0" y2="1">
                <stop stopColor={color} stopOpacity=".22" />
                <stop offset="100%" stopColor={color} stopOpacity=".02" />
              </linearGradient>
            ))}
          </defs>
          {series.map(({ key, path }) => <path key={key} d={`${path} V 100 H 0 Z`} fill={`url(#${id}-${key})`} />)}
          {series.map(({ key, path, color }) => (
            <path key={key} d={path} fill="none" stroke={color} strokeWidth={key === "previous" ? 3.5 : 2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {active && activeIndex !== null && (
          <>
            <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 border-l border-dashed border-border-strong" style={{ left: `${x(activeIndex)}%` }} />
            {series.map(({ key, color }) => (
              <span key={key} aria-hidden="true" className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-surface ${key === "previous" ? "size-3.5" : "size-2.5"}`}
                style={{ backgroundColor: color, left: `${x(activeIndex)}%`, top: `${y(active[key])}%` }} />
            ))}
            <div aria-hidden="true" className="pointer-events-none absolute z-10 w-64 max-w-full rounded-xl border border-border-subtle bg-surface p-3 text-[10px] shadow-lg sm:text-xs"
              style={{ left: `clamp(0px, calc(${x(activeIndex)}% - 8rem), calc(100% - min(16rem, 100%)))`, top: `${Math.max(3, Math.min(46, Math.min(y(active.current), y(active.previous)) - 38))}%` }}>
              <p className="mb-2 font-semibold text-ink">{formatDate.format(new Date(active.date))}</p>
              <div className="grid grid-cols-2 gap-2">
                {(["current", "previous"] as const).map((key) => (
                  <div key={key}>
                    <p className="flex items-center gap-1.5 text-ink-secondary"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: comparisonColors[key] }} />{labels[key]}</p>
                    <p className="mt-1 font-semibold text-ink tabular-nums">{formatValue.format(active[key] / 100)}</p>
                    {key === "previous" && <p className="text-ink-secondary">{formatDate.format(new Date(active.previousDate))}</p>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
        <span className="sr-only" aria-live="polite">
          {keyboardIndex !== null && active ? `${formatDate.format(new Date(active.date))}. ${labels.current}: ${formatValue.format(active.current / 100)}. ${labels.previous}, ${formatDate.format(new Date(active.previousDate))}: ${formatValue.format(active.previous / 100)}.` : ""}
        </span>
      </div>
      <div aria-hidden="true" className="relative col-start-2 h-4 text-[10px] whitespace-nowrap text-ink-secondary">
        {xTicks.map(({ date, index }, tickIndex) => {
          const label = date === today ? labels.today : {
            week: () => formatWeekday.format(new Date(date)),
            month: () => labels.dayOne.replace("1", String(Number(date.slice(-2)))),
            "30days": () => formatShortDate.format(new Date(date)),
          }[period]();
          const alignment = lastIndex === 0 || (index !== 0 && index !== lastIndex) ? "-translate-x-1/2" : index === lastIndex ? "-translate-x-full" : "";
          const hiddenOnMobile = period !== "week" && index !== 0 && index !== lastIndex && tickIndex % 2 === 0;
          return <span key={date} className={`absolute ${alignment} ${hiddenOnMobile ? "hidden sm:block" : ""}`} style={{ left: `${x(index)}%` }}>{label}</span>;
        })}
      </div>
    </div>
  );
}

function gaugePoint(radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return `${120 + radius * Math.cos(radians)} ${116 - radius * Math.sin(radians)}`;
}

const goalSegments = goalStageColors.map((color, index) => {
  const start = 180 - index * 45 - 1.5;
  const end = start - 42;
  const outer = 108;
  const inner = 86;
  const cornerAngle = 1.7;
  const cornerDepth = 3;

  return {
    color,
    outline: [
      `M ${gaugePoint(outer, start - cornerAngle)}`,
      `A ${outer} ${outer} 0 0 1 ${gaugePoint(outer, end + cornerAngle)}`,
      `Q ${gaugePoint(outer, end)} ${gaugePoint(outer - cornerDepth, end)}`,
      `L ${gaugePoint(inner + cornerDepth, end)}`,
      `Q ${gaugePoint(inner, end)} ${gaugePoint(inner, end + cornerAngle)}`,
      `A ${inner} ${inner} 0 0 0 ${gaugePoint(inner, start - cornerAngle)}`,
      `Q ${gaugePoint(inner, start)} ${gaugePoint(inner + cornerDepth, start)}`,
      `L ${gaugePoint(outer - cornerDepth, start)}`,
      `Q ${gaugePoint(outer, start)} ${gaugePoint(outer, start - cornerAngle)} Z`,
    ].join(" "),
    arc: `M ${gaugePoint(97, start)} A 97 97 0 0 1 ${gaugePoint(97, end)}`,
  };
});

function GoalGauge({ ratio, percentage, caption, mode }: { ratio: number; percentage: string; caption: string; mode: ThemeMode }) {
  const id = useId();

  return (
    <div className="relative mx-auto w-full max-w-64">
      <svg viewBox="0 0 240 125" className="block w-full" aria-hidden="true">
        <defs>
          <clipPath id={`${id}-segments`}>
            {goalSegments.map(({ outline }) => <path key={outline} d={outline} />)}
          </clipPath>
        </defs>
        <g clipPath={`url(#${id}-segments)`}>
          <rect width="240" height="125" fill={goalTrackColors[mode]} fillOpacity=".8" />
          {goalSegments.map(({ arc, color }, index) => {
            const fill = Math.max(0, Math.min(1, ratio * goalSegments.length - index));
            return fill > 0 && (
              <path key={arc} d={arc} pathLength="1" fill="none" stroke={color}
                strokeWidth="26" strokeLinecap="butt" strokeDasharray={`${fill} 1`} />
            );
          })}
        </g>
      </svg>
      <div className="absolute inset-x-[20%] bottom-[13%] text-center">
        <strong className="block text-2xl leading-tight font-bold tracking-tight break-words text-ink tabular-nums sm:text-3xl">{percentage}</strong>
        <p className="text-[11px] text-ink-secondary">{caption}</p>
      </div>
    </div>
  );
}

function MonthlyRevenueChart({ months, locale, currency, palette }: {
  months: FinanceSummaryResponse[];
  locale: string;
  currency: GoalResponse["currency"];
  palette: ThemePalette;
}) {
  const id = useId();
  const colors = columnColors[palette];
  const gradientId = `${id}-body`;
  const shadowId = `${id}-shadow`;
  const axisCurrency = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 0 });
  const exactCurrency = new Intl.NumberFormat(locale, { style: "currency", currency });
  const shortMonth = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" });
  const fullMonth = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const { ceiling, ticks } = revenueAxis(Math.max(0, ...months.map((month) => month.summary.realizedRevenueInCents)));

  return (
    <div className="mt-6 mb-6 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 sm:gap-x-3">
      <div aria-hidden="true" className="flex h-44 flex-col items-end justify-between text-[10px] whitespace-nowrap text-ink-secondary tabular-nums">
        {ticks.map((tick) => <span key={tick} className="flex h-0 items-center">{axisCurrency.format(tick / 100)}</span>)}
      </div>
      <div className="relative h-44">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {ticks.map((tick) => <span key={tick} className={`h-0 border-t border-border-strong ${tick > 0 ? "border-dashed opacity-70" : ""}`} />)}
        </div>
        <div className="grid h-full grid-cols-6">
          {months.map(({ period, summary }, index) => {
            const date = new Date(`${period.from}T00:00:00Z`);
            const amount = exactCurrency.format(summary.realizedRevenueInCents / 100);
            const label = fullMonth.format(date);
            const fraction = Math.max(0, summary.realizedRevenueInCents / ceiling);
            const height = fraction * plotHeight;
            const capRadius = Math.min(5, height / 2);
            const capY = plotHeight - height + capRadius;
            const baseY = plotHeight - capRadius;
            const tooltipPosition = index < 2 ? "left-0" : index >= months.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2";

            return (
              <div key={period.from} role="img" aria-label={`${label}, ${amount}`} tabIndex={0}
                className="group relative flex min-w-0 items-end justify-center rounded-t-md">
                {height > 0 && (
                  <svg aria-hidden="true" viewBox={`0 0 48 ${plotHeight}`} preserveAspectRatio="none"
                    className="pointer-events-none h-full w-[72%] max-w-12 overflow-visible group-hover:brightness-110 group-focus:brightness-110">
                    <ellipse cx="24" cy={plotHeight} rx="24" ry="5" fill={`url(#${shadowId})`} />
                    <path d={`M 3 ${capY} H 45 V ${baseY} A 21 ${capRadius} 0 0 1 3 ${baseY} Z`} fill={`url(#${gradientId})`} />
                    <ellipse cx="24" cy={capY} rx="21" ry={capRadius} fill={colors.cap} />
                  </svg>
                )}
                <span aria-hidden="true" className="absolute inset-x-0 top-full mt-2 text-center text-[10px] whitespace-nowrap text-ink-secondary">
                  {shortMonth.format(date).replace(/\.$/, "")}
                </span>
                <span aria-hidden="true" style={{ bottom: `calc(${fraction * 100}% + 0.5rem)` }}
                  className={`pointer-events-none absolute z-10 hidden whitespace-nowrap rounded-lg border border-border-strong bg-surface px-2.5 py-1.5 text-xs shadow-lg group-hover:block group-focus:block ${tooltipPosition}`}>
                  <span className="block text-ink-secondary">{label}</span>
                  <strong className="block text-ink tabular-nums">{amount}</strong>
                </span>
              </div>
            );
          })}
        </div>
        <svg aria-hidden="true" width="0" height="0" className="pointer-events-none absolute">
          <defs>
            <linearGradient id={gradientId} x1="0%" x2="100%" y1="0%" y2="0%">
              <stop stopColor={colors.light} />
              <stop offset="48%" stopColor={colors.body} />
              <stop offset="100%" stopColor={colors.shade} />
            </linearGradient>
            <radialGradient id={shadowId}>
              <stop stopColor={colors.shade} stopOpacity=".4" />
              <stop offset="100%" stopColor={colors.shade} stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

export function OwnerDashboard() {
  const { session } = useSession();
  const { locale, t } = useLocale();
  const { mode, palette } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const timezone = session.company.timezone;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<DashboardPeriod>("month");
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [currency, setCurrency] = useState<"BRL" | "USD">("BRL");
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
          currency: locale === "pt-BR" ? "BRL" as const : "USD" as const,
        })),
      ]);
      const collaborators = Array.isArray(collabRaw) ? collabRaw : collabRaw.collaborators ?? [];
      setData({ current, previous, months, appointments, collaborators, goal });
      setGoalInput(String(goal.monthlyGoalInCents / 100));
      setCurrency(goal.monthlyGoalInCents > 0 ? goal.currency : locale === "pt-BR" ? "BRL" : "USD");
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [nowRange, timezone, locale]);
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

  if (searchParams.has("appointmentId")) return null;
  if (loading) return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]"><div className="space-y-4">{[1,2,3,4].map((x) => <div key={x} className="h-36 animate-pulse rounded-2xl border border-border-subtle bg-surface" />)}</div><div className="h-[35rem] animate-pulse rounded-2xl border border-border-subtle bg-surface" /></div>;
  if (error || !data) return <section className="rounded-2xl border border-border-subtle bg-surface p-8 text-center"><p className="text-sm text-ink-secondary">{t.dashboard.loadError}</p><button onClick={() => void load()} className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">{t.common.retry}</button></section>;

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
  const displayCurrency = data.goal.monthlyGoalInCents > 0 ? data.goal.currency : locale === "pt-BR" ? "BRL" : "USD";
  const currencyFormat = new Intl.NumberFormat(locale, { style: "currency", currency: displayCurrency, minimumFractionDigits: 0 });
  const fmt = (value: number) => currencyFormat.format(value / 100);
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
          <article key={kpi.label} className="flex min-w-0 flex-col rounded-2xl border border-border-subtle bg-surface shadow-sm">
            <div className="flex flex-1 flex-col px-4 pt-4 sm:px-3 xl:px-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs leading-5 font-medium text-ink-secondary sm:text-[11px] xl:text-sm">{kpi.label}</h3>
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] leading-4 font-semibold tabular-nums" title={periodLabels.change}
                  style={{ backgroundColor: `${trend.color}1A`, color: mode === "dark" ? trend.darkInk : trend.lightInk }}>
                  {TrendIcon && <TrendIcon aria-hidden="true" className="size-3" />}
                  {changeFormat.format(kpi.delta / 100)}
                  <span className="sr-only"> {periodLabels.change}</span>
                </span>
              </div>
              <strong className="mt-1 mb-2 text-2xl leading-tight font-bold tracking-tight break-words text-ink tabular-nums xl:text-3xl">{kpi.value}</strong>
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
              <button onClick={() => { setGoalInput(String(target / 100)); setGoalOpen(true); }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-ink">
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
            <strong className="ml-auto text-ink tabular-nums">{fmt(comparisonTotal.current)}</strong>
          </div>
          <RevenueComparisonChart key={period} points={comparison} locale={locale} currency={displayCurrency} labels={comparisonLabels} period={period} today={nowRange.today} />
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
                <dd className="mt-1 font-semibold break-words text-ink tabular-nums">{fmt(monthlyRevenue)}</dd>
              </div>
              <div className="text-right">
                <dt className="text-ink-secondary">{t.dashboard.target}</dt>
                <dd className="mt-1 font-semibold break-words text-ink tabular-nums">{target ? fmt(target) : t.dashboard.goalNotSet}</dd>
              </div>
            </dl>
          </section>
          <section className="min-w-0 rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm sm:p-5">
            <h3 className="font-bold text-ink">{t.dashboard.monthlyRevenue}</h3>
            <p className="mt-1 text-xs text-ink-secondary">{t.dashboard.lastSixMonths}</p>
            <MonthlyRevenueChart months={data.months} locale={locale} currency={displayCurrency} palette={palette} />
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
                  <div className="text-right tabular-nums">
                    <p className="text-xs font-bold text-ink">{fmt(person.realizedRevenueInCents)}</p>
                    <p className="text-[10px] text-ink-secondary">{person.completedCount} {t.dashboard.attendances} · {fmt(person.commissionToPayInCents)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm"><div className="flex items-start justify-between"><div><h3 className="font-bold text-ink">{t.dashboard.upcomingAppointments}</h3><p className="mt-1 text-xs text-ink-muted">{t.dashboard.nextAppointments}</p></div><span className="rounded-lg bg-accent-soft p-2 text-accent"><Clock3 className="h-4 w-4"/></span></div><div className="mt-3 space-y-2">{upcoming.map((appointment)=><div key={appointment.id} className="rounded-xl border border-border-subtle bg-subtle/50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-ink">{new Intl.DateTimeFormat(locale,{day:"2-digit",month:"short",timeZone:timezone}).format(new Date(appointment.startsAt))} · {formatTimeInTimezone(appointment.startsAt,timezone,locale)}</span><span className="rounded-full bg-accent-soft px-2 py-0.5 text-[9px] font-semibold text-accent">{t.status[appointment.status]}</span></div><p className="mt-1 truncate text-xs font-bold text-ink">{appointment.clientName}</p><div className="mt-1 flex items-center justify-between gap-2"><span className="max-w-[65%] truncate rounded-md border border-border-subtle bg-surface px-1.5 py-0.5 text-[10px] text-ink-secondary">{appointment.serviceNameSnapshot}</span><span className="truncate text-[10px] text-ink-muted">{data.collaborators.find((c)=>c.id===appointment.collaboratorId)?.name ?? ""}</span></div></div>)}{upcoming.length===0&&<p className="py-5 text-center text-xs text-ink-muted">{t.dashboard.noUpcoming}</p>}</div><Link href="/owner/appointments" className="mt-3 flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-subtle"><span>{t.dashboard.openAgenda}</span><ArrowRight className="h-3.5 w-3.5"/></Link></section>
      </aside>
    </div>
    {goalOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)setGoalOpen(false)}}><section role="dialog" aria-modal="true" aria-labelledby="goal-title" className="w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-5 shadow-xl"><div className="flex items-center justify-between"><div><h3 id="goal-title" className="font-bold text-ink">{t.dashboard.goalModalTitle}</h3><p className="mt-1 text-xs text-ink-muted">{t.dashboard.goalModalHint}</p></div><button onClick={()=>setGoalOpen(false)} aria-label={t.common.close} className="rounded-lg p-2 text-ink-muted hover:bg-subtle"><X className="h-4 w-4"/></button></div><label htmlFor="monthly-goal" className="mt-4 block text-xs font-semibold text-ink">{t.dashboard.goalAmount}</label><div className="mt-1 flex gap-2"><input id="monthly-goal" type="number" min="1" step="0.01" value={goalInput} onChange={(e)=>setGoalInput(e.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface px-3 text-sm text-ink"/><select aria-label={t.dashboard.currency} value={currency} onChange={(e)=>setCurrency(e.target.value as "BRL"|"USD")} className="h-10 rounded-lg border border-border-strong bg-surface px-2 text-sm text-ink"><option value="BRL">R$</option><option value="USD">US$</option></select></div><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setGoalOpen(false)} className="rounded-lg border border-border-strong px-3 py-2 text-xs font-semibold text-ink-secondary">{t.common.cancel}</button><button disabled={savingGoal} onClick={()=>void saveGoal()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-ink disabled:opacity-60">{savingGoal?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<Check className="h-3.5 w-3.5"/>}{t.common.save}</button></div></section></div>}
  </div>;
}
