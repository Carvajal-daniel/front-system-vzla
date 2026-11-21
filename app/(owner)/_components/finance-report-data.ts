import type { Dictionary, Locale } from "@/lib/i18n";
import type { FinanceAppointment, FinanceDay, FinanceSummaryResponse, FinanceTotals } from "@/lib/types/finance";
import { getCurrencyFormatter, getTodayIsoDateInTimezone } from "@/lib/format";
import { paymentMethods } from "@/lib/types/finance";

export const presets = ["thisWeek", "thisMonth", "lastMonth", "last90Days"] as const;
export type FinancePreset = (typeof presets)[number];
export type FinanceRange = { from: string; to: string };

const dayMs = 86_400_000;
const isoDay = (time: number) => new Date(time).toISOString().slice(0, 10);
const utcDay = (date: string) => Date.parse(date + "T00:00:00Z");

export function getFinanceRange(preset: FinancePreset, timezone: string): FinanceRange {
  const today = getTodayIsoDateInTimezone(timezone);
  const time = utcDay(today);
  const date = new Date(time);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const monthEnd = isoDay(Date.UTC(year, month + 1, 0));

  switch (preset) {
    case "thisWeek": {
      const monday = time - ((date.getUTCDay() + 6) % 7) * dayMs;
      return { from: isoDay(monday), to: isoDay(monday + 6 * dayMs) };
    }
    case "thisMonth":
      return { from: isoDay(Date.UTC(year, month, 1)), to: monthEnd };
    case "lastMonth":
      return { from: isoDay(Date.UTC(year, month - 1, 1)), to: isoDay(Date.UTC(year, month, 0)) };
    case "last90Days":
      return { from: isoDay(time - 89 * dayMs), to: monthEnd };
  }
}

export function formatFinanceRange(range: FinanceRange, locale: Locale) {
  const format = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" });
  return format.formatRange(utcDay(range.from), utcDay(range.to));
}

export function getFinanceMetrics(totals: FinanceTotals) {
  return {
    realizedRevenue: totals.realizedRevenueInCents,
    forecastRevenue: totals.forecastRevenueInCents,
    commissionsToPay: totals.realizedCommissionsInCents,
    netProfit: totals.netProfitRealizedInCents,
  };
}

export function getFinanceSeries(period: FinanceRange, series: FinanceDay[]) {
  const start = utcDay(period.from);
  const end = utcDay(period.to);
  const days = (end - start) / dayMs + 1;
  const bucketSize = days <= 31 ? 1 : Math.ceil(days / 18);
  const buckets = Array.from({ length: Math.ceil(days / bucketSize) }, (_, index) => {
    const bucketStart = start + index * bucketSize * dayMs;
    return {
      from: isoDay(bucketStart),
      to: isoDay(Math.min(end, bucketStart + (bucketSize - 1) * dayMs)),
      realizedInCents: 0,
      forecastInCents: 0,
      commissionsInCents: 0,
    };
  });
  for (const point of series) {
    const bucket = buckets[Math.floor((utcDay(point.date) - start) / (dayMs * bucketSize))];
    if (!bucket) continue;
    bucket.realizedInCents += point.realizedInCents;
    bucket.forecastInCents += point.forecastInCents;
    bucket.commissionsInCents += point.commissionsInCents;
  }
  return buckets;
}

function reportFormatters(data: FinanceSummaryResponse, locale: Locale, currency: string, csv: boolean) {
  const money = csv
    ? new Intl.NumberFormat(locale, { useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : getCurrencyFormatter(locale, currency);
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat(locale, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZone: data.period.timezone,
  });
  return {
    money: (cents: number) => money.format(cents / 100),
    percent: (value: number | null) => value === null ? (csv ? "" : "—") : percent.format(value / 100),
    date: (value: string) => date.format(new Date(value)),
  };
}

export function getFinanceReport(
  data: FinanceSummaryResponse,
  t: Dictionary,
  locale: Locale,
  currency: string,
  csv = false,
  appointments: FinanceAppointment[] = data.appointments,
) {
  const f = t.finance;
  const format = reportFormatters(data, locale, currency, csv);
  const selected = data.professionals.find((person) => person.id === data.period.collaboratorId);
  const expenses = data.period.collaboratorId ? null : data.expenses;
  const expenseDate = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const expenseStatus = { PENDING: f.expensePending, OVERDUE: f.expenseOverdue, PAID: f.expensePaid };
  const headers = {
    staff: [f.colProfessional, f.colRole, f.colCompleted, f.colRevenue, f.colAverageRate, f.colForecastCommission,
      f.awaitingCommission, f.readyCommission, f.paidCommission],
    appointments: [f.dateTime, f.client, f.service, f.colProfessional, f.status, f.gross, f.commissionRate, f.commissionValue, f.netValue],
    expenses: [f.expenseDescription, f.expenseCategory, f.expenseType, f.expenseDue, f.expenseStatus,
      f.expensePaidOn, f.method, f.financeNotes, f.quantity, f.unitAmount, f.totalAmount],
  };
  const metrics = getFinanceMetrics(data.summary);
  return {
    period: formatFinanceRange(data.period, locale),
    professional: selected?.name ?? (data.period.collaboratorId ? "—" : f.allProfessionals),
    summary: [
      ...(expenses ? [[f.realNetProfit, format.money(data.summary.realNetProfitInCents ?? 0)]] : []),
      [f.realizedRevenue, format.money(metrics.realizedRevenue)],
      [f.collected, format.money(data.collections.collectedInCents)],
      [f.outstanding, format.money(data.collections.outstandingInCents)],
      [f.forecastRevenue, format.money(metrics.forecastRevenue)],
      expenses ? [f.commissionsToPay, format.money(metrics.commissionsToPay)]
        : [f.commissionGenerated, format.money(data.collections.generatedCommissionInCents)],
      [f.awaitingCommission, format.money(data.collections.awaitingCommissionInCents)],
      [expenses ? f.readyCommission : f.commissionBalance, format.money(data.collections.readyCommissionInCents)],
      ...(expenses ? [
        [f.paidCommission, format.money(data.collections.paidCommissionInCents)],
        [f.netProfit, format.money(metrics.netProfit)],
        [f.expensesInPeriod, format.money(expenses.totalCents)],
        [f.expenseCashTotal, format.money(expenses.cashPaidCents)],
      ] : []),
      [expenses ? f.cashCommissionTotal : f.commissionPaidInPeriod, format.money(data.collections.cashCommissionsInCents)],
      [f.colForecastCommission, format.money(data.summary.forecastCommissionsInCents)],
      ...(expenses ? [[f.netProjected, format.money(data.summary.netProfitProjectedInCents)]] : []),
    ],
    byMethod: paymentMethods.filter((method) => Object.hasOwn(data.collections.paidByMethod, method))
      .map((method) => [f.paymentMethods[method], format.money(data.collections.paidByMethod[method] ?? 0)]),
    headers,
    staff: data.byCollaborator.map((person) => [
      person.name, person.specialty, String(person.completedCount),
      format.money(person.realizedRevenueInCents), format.percent(person.averageCommissionPercentage),
      format.money(person.forecastCommissionInCents), format.money(person.awaitingCommissionInCents),
      format.money(person.readyCommissionInCents), format.money(person.paidCommissionInCents),
    ]),
    appointments: appointments.map((item) => [
      format.date(item.startsAt), item.clientName, item.serviceName, item.collaboratorName ?? "—",
      t.status[item.status], format.money(item.grossInCents), format.percent(item.commissionPercentage),
      format.money(item.commissionInCents), format.money(item.netInCents),
    ]),
    expenses: expenses?.items.map((item) => [
      item.description, f.expenseCategories[item.category], item.expenseType === "FIXED" ? f.expenseFixed : f.expenseVariable,
      expenseDate.format(utcDay(item.dueDate)), expenseStatus[item.status],
      item.paidOn ? expenseDate.format(utcDay(item.paidOn)) : "",
      item.paymentMethod ? f.paymentMethods[item.paymentMethod] : "", item.notes ?? "", String(item.quantity),
      item.unitAmountCents === null ? "" : format.money(item.unitAmountCents), format.money(item.amountCents),
    ]) ?? null,
  };
}

export function getExecutivePdfData(
  data: FinanceSummaryResponse,
  t: Dictionary,
  locale: Locale,
  currency: string,
) {
  const f = t.finance;
  const p = f.pdfReport;
  const format = reportFormatters(data, locale, currency, false);
  const pctSigned = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });
  const pctPlain = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  });
  const expenseDate = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const generatedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: "short", timeStyle: "short", timeZone: data.period.timezone,
  }).format(new Date());

  const selected = data.professionals.find((person) => person.id === data.period.collaboratorId);
  const companyView = !data.period.collaboratorId && Boolean(data.expenses);
  const expenses = companyView ? data.expenses : null;
  const deltaOf = (current: number, previous: number | null | undefined) =>
    previous && previous !== 0 ? (current - previous) / Math.abs(previous) : null;
  const formatDelta = (delta: number | null) => (delta === null ? "—" : pctSigned.format(delta));

  const realizedRev = data.summary.realizedRevenueInCents;
  const prevRealizedRev = data.comparison.summary.realizedRevenueInCents;
  const collected = data.collections.collectedInCents;
  const prevCollected = data.collections.previousCollectedInCents;
  const outstanding = data.collections.outstandingInCents;
  const cashCommissions = data.collections.cashCommissionsInCents;
  const cashExpenses = expenses?.cashPaidCents ?? 0;
  const realNet = data.summary.realNetProfitInCents ?? 0;
  const prevRealNet = data.comparison.summary.realNetProfitInCents;
  const totalOutflows = cashExpenses + cashCommissions;

  // 6 KPIs executivos enxutos e sem duplicação
  const kpis = [
    {
      label: f.realizedRevenue,
      value: format.money(realizedRev),
      delta: formatDelta(deltaOf(realizedRev, prevRealizedRev)),
      hint: `${f.forecastRevenue}: ${format.money(data.summary.forecastRevenueInCents)}`,
    },
    {
      label: f.collected,
      value: format.money(collected),
      delta: formatDelta(deltaOf(collected, prevCollected)),
      hint: data.collections.productSalesInCents > 0
        ? `${p.productRevenueShare}: ${format.money(data.collections.productSalesInCents)}`
        : f.byMethod,
    },
    {
      label: f.pendingBalance,
      value: format.money(outstanding),
      delta: null,
      hint: f.outstandingHint,
    },
    ...(expenses ? [{
      label: f.expenseCashTotal,
      value: format.money(cashExpenses),
      delta: formatDelta(deltaOf(expenses.totalCents, expenses.previousTotalCents)),
      hint: `${p.pendingAndOverdue}: ${format.money(expenses.pendingCents + expenses.overdueCents)}`,
    }] : []),
    {
      label: companyView ? f.cashCommissionTotal : f.commissionPaidInPeriod,
      value: format.money(cashCommissions),
      delta: null,
      hint: `${f.netPayable}: ${format.money(data.insights.netPayableCommissionInCents)}`,
    },
    {
      label: companyView ? f.realNetProfit : f.professionalCommission,
      value: format.money(companyView ? realNet : data.insights.netPayableCommissionInCents),
      delta: companyView ? formatDelta(deltaOf(realNet, prevRealNet)) : null,
      hint: companyView ? f.netFormula : `${f.commissionGenerated}: ${format.money(data.collections.generatedCommissionInCents)}`,
      highlight: true,
    },
  ];

  // Resumo inteligente determinístico baseado apenas em dados verificados
  const insights: string[] = [];
  if (realizedRev > 0) {
    const collectedRatio = Math.min(1, Math.max(0, (collected - data.collections.productSalesInCents) / realizedRev));
    insights.push(`${pctPlain.format(collectedRatio)} ${p.insightCollectedRatio}`);
  }
  if (outstanding > 0) {
    insights.push(`${format.money(outstanding)} ${p.insightOutstanding}`);
  }
  if (expenses && data.insights.expensesAsRevenuePercent !== null) {
    insights.push(`${pctPlain.format(data.insights.expensesAsRevenuePercent / 100)} ${p.insightExpenseShare}`);
  }
  const revDelta = deltaOf(realizedRev, prevRealizedRev);
  if (revDelta !== null && revDelta !== 0) {
    insights.push(
      `${revDelta > 0 ? p.insightRevenueUp : p.insightRevenueDown} ${pctPlain.format(Math.abs(revDelta))} ${p.insightVsPrevious}`,
    );
  }
  if (companyView) {
    insights.push(
      `${realNet >= 0 ? p.insightPositiveCash : p.insightNegativeCash} ${format.money(realNet)}.`,
    );
  }
  const hasCommissionDiff = data.collections.paidCommissionInCents !== cashCommissions;

  // Tabela comparativa período atual vs anterior
  const comparisonRows = [
    [f.realizedRevenue, format.money(realizedRev), format.money(prevRealizedRev), formatDelta(revDelta)],
    [f.collected, format.money(collected), format.money(prevCollected), formatDelta(deltaOf(collected, prevCollected))],
    ...(expenses ? [[
      f.expensesInPeriod,
      format.money(expenses.totalCents),
      format.money(expenses.previousTotalCents),
      formatDelta(deltaOf(expenses.totalCents, expenses.previousTotalCents)),
    ]] : []),
    ...(companyView ? [[
      f.realNetProfit,
      format.money(realNet),
      prevRealNet === null ? "—" : format.money(prevRealNet),
      formatDelta(deltaOf(realNet, prevRealNet)),
    ]] : []),
  ];

  // Métodos de pagamento com % do total
  const methodRows = paymentMethods
    .filter((method) => Object.hasOwn(data.collections.paidByMethod, method))
    .map((method) => {
      const amount = data.collections.paidByMethod[method] ?? 0;
      const share = collected > 0 ? pctPlain.format(amount / collected) : "—";
      return [f.paymentMethods[method], format.money(amount), share];
    });

  // Despesas por categoria
  const expenseStatusLabel = { PENDING: f.expensePending, OVERDUE: f.expenseOverdue, PAID: f.expensePaid };
  const expenseCategoryRows = expenses?.byCategory
    .slice()
    .sort((a, b) => b.amountCents - a.amountCents)
    .map((row) => [
      f.expenseCategories[row.category],
      format.money(row.amountCents),
      format.money(row.cashPaidCents),
      expenses.totalCents > 0 ? pctPlain.format(row.amountCents / expenses.totalCents) : "—",
    ]) ?? [];

  // Despesas detalhadas (7 colunas legíveis em vez de 11 apertadas)
  const expenseDetailRows = expenses?.items.map((item) => {
    const payInfo = item.paidOn
      ? `${expenseDate.format(utcDay(item.paidOn))}${item.paymentMethod ? ` · ${f.paymentMethods[item.paymentMethod]}` : ""}`
      : "—";
    const desc = item.notes ? `${item.description} (${item.notes})` : item.description;
    return [
      desc,
      f.expenseCategories[item.category],
      item.expenseType === "FIXED" ? f.expenseFixed : f.expenseVariable,
      expenseDate.format(utcDay(item.dueDate)),
      expenseStatusLabel[item.status],
      payInfo,
      format.money(item.amountCents),
    ];
  }) ?? [];

  // Comissões por profissional (incluindo descontos e líquido a pagar)
  const staffRows = data.byCollaborator.map((person) => [
    person.name,
    String(person.completedCount),
    format.money(person.realizedRevenueInCents),
    format.money(person.awaitingCommissionInCents),
    format.money(person.readyCommissionInCents),
    format.money(person.deductionsInCents),
    format.money(person.netPayableInCents),
    format.money(person.paidCommissionInCents),
  ]);
  const staffTotals = [
    p.totalRow,
    String(data.byCollaborator.reduce((s, x) => s + x.completedCount, 0)),
    format.money(data.byCollaborator.reduce((s, x) => s + x.realizedRevenueInCents, 0)),
    format.money(data.byCollaborator.reduce((s, x) => s + x.awaitingCommissionInCents, 0)),
    format.money(data.byCollaborator.reduce((s, x) => s + x.readyCommissionInCents, 0)),
    format.money(data.byCollaborator.reduce((s, x) => s + x.deductionsInCents, 0)),
    format.money(data.byCollaborator.reduce((s, x) => s + x.netPayableInCents, 0)),
    format.money(data.byCollaborator.reduce((s, x) => s + x.paidCommissionInCents, 0)),
  ];

  // Desempenho por serviço
  const serviceRows = data.byService
    .filter((svc) => svc.realizedCount > 0 || svc.count > 0)
    .slice(0, 12)
    .map((svc) => {
      const avg = svc.realizedCount > 0 ? Math.round(svc.realizedInCents / svc.realizedCount) : 0;
      const share = realizedRev > 0 ? pctPlain.format(svc.realizedInCents / realizedRev) : "—";
      return [
        svc.serviceName,
        String(svc.realizedCount),
        format.money(avg),
        format.money(svc.realizedInCents),
        share,
      ];
    });

  const totalAppointments =
    data.summary.completedCount + data.summary.confirmedCount + data.summary.pendingCount +
    data.summary.canceledCount + data.summary.noShowCount;
  const performanceMetrics = {
    completed: data.summary.completedCount,
    canceled: data.summary.canceledCount,
    noShow: data.summary.noShowCount,
    completionRate: totalAppointments > 0 ? pctPlain.format(data.summary.completedCount / totalAppointments) : "—",
    averageTicket: data.summary.completedCount > 0
      ? format.money(Math.round(realizedRev / data.summary.completedCount))
      : "—",
  };

  // Anexo: atendimentos detalhados (marcando cancelados/faltas para estilo atenuado)
  const appointmentRows = data.appointments.map((item) => ({
    muted: item.status === "CANCELED" || item.status === "NO_SHOW",
    cells: [
      format.date(item.startsAt),
      item.clientName,
      item.serviceName,
      item.collaboratorName ?? "—",
      t.status[item.status],
      format.money(item.grossInCents),
      format.money(item.commissionInCents),
      format.money(item.netInCents),
    ],
  }));
  const completedAppointments = data.appointments.filter((a) => a.status === "COMPLETED");
  const forecastAppointments = data.appointments.filter((a) => a.status === "CONFIRMED" || a.status === "PENDING");
  const canceledCount = data.appointments.filter((a) => a.status === "CANCELED").length;
  const noShowCount = data.appointments.filter((a) => a.status === "NO_SHOW").length;
  const annexSubtotals: string[][] = [
    [
      p.annexCompletedTotal,
      String(completedAppointments.length),
      "", "", "",
      format.money(completedAppointments.reduce((s, a) => s + a.grossInCents, 0)),
      format.money(completedAppointments.reduce((s, a) => s + a.commissionInCents, 0)),
      format.money(completedAppointments.reduce((s, a) => s + a.netInCents, 0)),
    ],
    ...(forecastAppointments.length ? [[
      p.annexForecastTotal,
      String(forecastAppointments.length),
      "", "", "",
      format.money(forecastAppointments.reduce((s, a) => s + a.grossInCents, 0)),
      format.money(forecastAppointments.reduce((s, a) => s + a.commissionInCents, 0)),
      format.money(forecastAppointments.reduce((s, a) => s + a.netInCents, 0)),
    ]] : []),
    ...(canceledCount ? [[p.annexCanceledSummary, String(canceledCount), "", "", "", "—", "—", "—"]] : []),
    ...(noShowCount ? [[p.annexNoShowSummary, String(noShowCount), "", "", "", "—", "—", "—"]] : []),
  ];

  // Barras simples de caixa para o gráfico SVG
  const cashBars = [
    { label: f.cashInflows, cents: collected, formatted: format.money(collected), tone: "inflow" as const },
    { label: f.cashOutflows, cents: totalOutflows, formatted: format.money(totalOutflows), tone: "outflow" as const },
    ...(companyView ? [{
      label: f.realNetProfit,
      cents: Math.max(0, realNet),
      formatted: format.money(realNet),
      tone: "net" as const,
    }] : []),
  ];

  return {
    period: formatFinanceRange(data.period, locale),
    comparisonPeriod: formatFinanceRange(data.comparison, locale),
    professional: selected?.name ?? (data.period.collaboratorId ? "—" : f.allProfessionals),
    generatedAt,
    companyView,
    kpis,
    insights,
    hasCommissionDiff,
    comparisonRows,
    cashBars,
    methodRows,
    methodTotal: format.money(collected),
    productSalesFormatted: data.collections.productSalesInCents > 0
      ? format.money(data.collections.productSalesInCents) : null,
    serviceCashFormatted: format.money(Math.max(0, collected - data.collections.productSalesInCents)),
    expensesSummary: expenses ? {
      total: format.money(expenses.totalCents),
      paid: format.money(expenses.cashPaidCents),
      pending: format.money(expenses.pendingCents),
      overdue: format.money(expenses.overdueCents),
    } : null,
    expenseCategoryRows,
    expenseDetailRows,
    staffRows,
    staffTotals,
    serviceRows,
    performanceMetrics,
    appointmentRows,
    annexSubtotals,
  };
}

function csvCell(value: string) {
  const numeric = /^-?\d+(?:[,.]\d+)?(?:\s*%)?$/.test(value);
  const safe = !numeric && /^(?:[\t\r\n]|\s*[=+\-@＝＋－＠])/.test(value) ? "'" + value : value;
  return '"' + safe.replaceAll('"', '""') + '"';
}

export function downloadFinanceCsv(
  data: FinanceSummaryResponse,
  companyName: string,
  t: Dictionary,
  locale: Locale,
  currency: string,
) {
  const f = t.finance;
  const report = getFinanceReport(data, t, locale, currency, true);
  const rows = [
    [f.reportTitle, companyName],
    [f.from, data.period.from, f.to, data.period.to],
    [f.colProfessional, report.professional],
    [t.dashboard.currency, currency],
    [],
    [f.summaryTitle],
    ...report.summary,
    ...(report.expenses ? [[f.netFormula]] : []),
    [],
    [f.byMethod],
    ...report.byMethod,
    [],
    [f.commissionsTableTitle],
    report.headers.staff,
    ...report.staff,
    [],
    ...(report.expenses ? [[f.expenseTab], report.headers.expenses, ...report.expenses, []] : []),
    [f.appointmentDetails],
    [f.reportScopeNote],
    report.headers.appointments,
    ...report.appointments,
  ];
  const body = rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", body], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = (locale === "es" ? "informe-financiero" : "relatorio-financeiro") +
    "-" + data.period.from + "_" + data.period.to + ".csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
