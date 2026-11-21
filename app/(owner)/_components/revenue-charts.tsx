"use client";

import { useId, useState, type PointerEvent } from "react";
import { getCurrencyFormatter } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { THEME_PALETTES, type ThemeMode, type ThemePalette } from "@/lib/theme-context";
import type { Currency } from "@/lib/types/finance";

export const goalStageColors = ["#F43F5E", "#F59E0B", "#3B82F6", "#10B981"] as const;
const goalTrackColors = { light: "#E2E8F0", dark: "#1E293B" };

const columnColors = {
  cobalt: { light: "#7BA8FF", body: "#2563EB", shade: "#1647B8", cap: "#96B9FF" },
  emerald: { light: "#68E4BC", body: "#10B981", shade: "#087655", cap: "#8CECCF" },
  rose: { light: "#FF8CAA", body: "#E11D48", shade: "#A71137", cap: "#FFABBF" },
  velvet: { light: "#B290FF", body: "#7C3AED", shade: "#5220B1", cap: "#CBADFF" },
  obsidian: { light: "#6EE7F4", body: "#06B6D4", shade: "#087E96", cap: "#A1F3FA" },
} satisfies Record<ThemePalette, { light: string; body: string; shade: string; cap: string }>;

const plotHeight = 176;
export function revenueComparisonColors(palette: ThemePalette, mode: ThemeMode) {
  const swatch = THEME_PALETTES.find((item) => item.id === palette) ?? THEME_PALETTES[0];
  return { current: mode === "dark" ? swatch.swatchDark : swatch.swatchLight,
    previous: palette === "velvet" ? (mode === "dark" ? "#67E8F9" : "#0E7490") : (mode === "dark" ? "#C4B5FD" : "#7C3AED") };
}

export function smoothPath(points: readonly (readonly [number, number])[]) {
  return points.map(([x, y], index) => {
    if (index === 0) return `M ${x} ${y}`;
    const [previousX, previousY] = points[index - 1];
    const offset = (x - previousX) / 3;
    return `C ${previousX + offset} ${previousY}, ${x - offset} ${y}, ${x} ${y}`;
  }).join(" ");
}

function revenueAxis(highest: number, lowest = 0) {
  const maximum = Math.max(highest, 0);
  const approximateStep = ((maximum - Math.min(lowest, 0)) || 10000) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(approximateStep));
  const factor = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= approximateStep) ?? 10;
  const step = Math.max(1, factor * magnitude);
  const top = Math.ceil(maximum / step);
  const bottom = Math.floor(lowest / step);
  const intervals = Math.max(1, top - bottom);
  return {
    ceiling: (bottom + intervals) * step,
    floor: bottom * step,
    ticks: Array.from({ length: intervals + 1 }, (_, index) => (bottom + intervals - index) * step),
  };
}

export function RevenueComparisonChart({ points, locale, currency, labels, period, today, colors: comparisonColors }: {
  points: { date: string; previousDate: string; current: number; previous: number }[];
  locale: Locale;
  currency: Currency;
  labels: { chart: string; current: string; previous: string; today: string; dayOne: string };
  period: "week" | "month" | "30days";
  colors: { current: string; previous: string };
  today: string;
}) {
  const id = useId();
  const [pointerIndex, setPointerIndex] = useState<number | null>(null);
  const [keyboardIndex, setKeyboardIndex] = useState<number | null>(null);
  const lastIndex = points.length - 1;
  const activeIndex = pointerIndex ?? keyboardIndex;
  const active = activeIndex === null ? undefined : points[activeIndex];
  const values = points.flatMap(({ current, previous }) => [current, previous]);
  const { ceiling, floor, ticks } = revenueAxis(Math.max(0, ...values), Math.min(0, ...values));
  const x = (index: number) => lastIndex > 0 ? index / lastIndex * 100 : 50;
  const y = (value: number) => (ceiling - value) / (ceiling - floor) * 100;
  const formatAxis = getCurrencyFormatter(locale, currency, 0);
  const formatValue = getCurrencyFormatter(locale, currency);
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
          {series.map(({ key, path }) => <path key={key} d={`${path} V ${y(0)} H 0 Z`} fill={`url(#${id}-${key})`} />)}
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
                    {key === "previous" && active.previousDate !== active.date &&
                      <p className="text-ink-secondary">{formatDate.format(new Date(active.previousDate))}</p>}
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

export function GoalGauge({ ratio, percentage, caption, mode }: { ratio: number; percentage: string; caption: string; mode: ThemeMode }) {
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

export function RevenueColumns({ columns, locale, currency, palette }: {
  columns: { id: string; label: string; shortLabel: string; amountInCents: number }[];
  locale: string;
  currency: Currency;
  palette: ThemePalette;
}) {
  const id = useId();
  const colors = columnColors[palette];
  const gradientId = `${id}-body`;
  const shadowId = `${id}-shadow`;
  const axisCurrency = getCurrencyFormatter(locale, currency, 0);
  const exactCurrency = getCurrencyFormatter(locale, currency);
  const { ceiling, ticks } = revenueAxis(Math.max(0, ...columns.map((column) => column.amountInCents)));

  return (
    <div className="mt-6 mb-6 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 sm:gap-x-3">
      <div aria-hidden="true" className="flex h-44 flex-col items-end justify-between text-[10px] whitespace-nowrap text-ink-secondary tabular-nums">
        {ticks.map((tick) => <span key={tick} className="flex h-0 items-center">{axisCurrency.format(tick / 100)}</span>)}
      </div>
      <div className="relative h-44">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {ticks.map((tick) => <span key={tick} className={`h-0 border-t border-border-strong ${tick > 0 ? "border-dashed opacity-70" : ""}`} />)}
        </div>
        <div className="grid h-full" style={{ gridTemplateColumns: "repeat(" + columns.length + ", minmax(0, 1fr))" }}>
          {columns.map(({ id, label, shortLabel, amountInCents }, index) => {
            const amount = exactCurrency.format(amountInCents / 100);
            const fraction = Math.max(0, amountInCents / ceiling);
            const height = fraction * plotHeight;
            const capRadius = Math.min(5, height / 2);
            const capY = plotHeight - height + capRadius;
            const baseY = plotHeight - capRadius;
            const tooltipPosition = index < 2 ? "left-0" : index >= columns.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2";

            return (
              <div key={id} role="img" aria-label={`${label}, ${amount}`} tabIndex={0}
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
                  {shortLabel}
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

