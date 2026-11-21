"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownRight, ArrowUpRight, CircleCheck, Clock3, Maximize2,
  Download, FileSpreadsheet, Printer, Wallet, X, HandCoins, Plus, SlidersHorizontal, type LucideIcon,
} from "lucide-react";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { CardListSkeleton } from "@/components/ui/card-list-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/api-client";
import { getCurrencyFormatter, getTodayIsoDateInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type { CommissionReport, ExpenseStatus, FinanceExpense, FinanceSummaryResponse, PaymentMethod } from "@/lib/types/finance";
import { FinanceCharts } from "./finance-charts";
import { ReceiptDialog } from "./receipt-dialog";
import { ReceiptMovements } from "./receipt-movements";
import { FinanceDataTable, FinancePrintReport } from "./finance-print-report";
import { FinanceCommissions, FinanceExpenses, useFinanceReport } from "./finance-outflow-tabs";
import { FinanceDeductionDetails } from "./finance-deduction-details";
import { FinanceDrilldown, type FinanceDrilldownKind } from "./finance-drilldown";
import { SpreadsheetImport } from "./spreadsheet-import";
import { FinanceOperationDialog, type FinanceOperation } from "./finance-operation-dialog";
import {
  downloadFinanceCsv, formatFinanceRange, getFinanceRange,
  getFinanceReport, presets, type FinancePreset, type FinanceRange,
} from "./finance-report-data";

const card = "rounded-2xl border border-border-subtle bg-surface shadow-xs";
const inputClass = "h-8 w-full min-w-0 rounded-lg border border-border-strong bg-surface px-2 text-xs text-ink tabular-nums";
const quickActionClass = "h-11 w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-center text-[11px] leading-tight";
const paymentGroups = [
  ["CASH"], ["PIX"], ["DEBIT_CARD", "CREDIT_CARD"], ["TRANSFER"], ["OTHER"],
] as const satisfies readonly (readonly PaymentMethod[])[];
const financeTabs = ["overviewTab", "expenseTab", "commissionTab"] as const;
type FinanceTab = (typeof financeTabs)[number];

type Filters = FinanceRange & { collaboratorId: string };
type FinanceRequest = { filters: Filters; preset: FinancePreset | null };
type Result = {
  request: FinanceRequest;
  data: FinanceSummaryResponse | null;
};

function FinanceKpi({ title, icon: Icon, cents, previous, comparisonPeriod, money, children, onOpen }: {
  title: string;
  icon: LucideIcon;
  cents: number;
  previous?: number;
  comparisonPeriod?: string;
  money: (cents: number) => string;
  children: ReactNode;
  onOpen: () => void;
}) {
  const { locale, t } = useLocale();
  const delta = previous ? (cents - previous) / Math.abs(previous) : null;
  const Direction = delta !== null && delta < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <article className={card + " group relative flex min-w-0 flex-col gap-2 p-3 transition-colors hover:border-accent/60 hover:bg-subtle focus-within:border-accent/60 sm:p-4"}>
      <button type="button" aria-label={title} aria-haspopup="dialog" onClick={onOpen}
        className="absolute inset-0 cursor-pointer rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
      <div className="flex min-h-8 items-center justify-between gap-1.5">
        <h3 className="text-xs font-semibold leading-snug text-ink-secondary">{title}</h3>
        <span className="flex shrink-0 items-center gap-1.5 text-accent" aria-hidden="true">
          <Maximize2 className="size-3 text-ink-muted transition-colors group-hover:text-accent group-focus-within:text-accent" />
          <span className="grid size-7 place-items-center rounded-lg bg-accent/10 sm:size-8">
            <Icon className="size-3.5 sm:size-4" />
          </span>
        </span>
      </div>
      <p className="break-words text-lg font-semibold tracking-tight text-ink tabular-nums sm:text-2xl">{money(cents)}</p>
      <div className="text-[11px] leading-snug text-ink-secondary">{children}</div>
      {delta !== null && (
        <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink-muted" title={comparisonPeriod}>
          <strong className="inline-flex items-center gap-0.5 font-semibold text-accent tabular-nums">
            {delta !== 0 && <Direction className="size-3.5" aria-hidden="true" />}
            {new Intl.NumberFormat(locale, {
              style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero",
            }).format(delta)}
          </strong>
          {t.finance.previousPeriod}
        </p>
      )}
    </article>
  );
}

export function FinancePanel() {
  const { session } = useSession();
  return <FinanceWorkspace key={session.company.id + session.company.timezone} />;
}

function FinanceWorkspace() {
  const { session } = useSession();
  const { locale, t } = useLocale();
  const f = t.finance;
  const company = session.company;
  const [request, setRequest] = useState<FinanceRequest>(() => ({
    filters: { ...getFinanceRange("thisMonth", company.timezone), collaboratorId: "" },
    preset: "thisMonth",
  }));
  const [draft, setDraft] = useState<FinanceRange>(() => ({ from: request.filters.from, to: request.filters.to }));
  const [result, setResult] = useState<Result | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [preview, setPreview] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [receiptTarget, setReceiptTarget] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<FinanceDrilldownKind | null>(null);
  const [importing, setImporting] = useState(false);
  const [operation, setOperation] = useState<FinanceOperation | null>(null);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<FinanceTab>("overviewTab");
  const [expenseStatus, setExpenseStatus] = useState<ExpenseStatus | "">("");
  const [revision, setRevision] = useState(0);
  const { from, to, collaboratorId } = request.filters;
  const companyView = !collaboratorId;
  const tabs = companyView ? financeTabs : (["overviewTab", "commissionTab"] as const);
  const commissionReport = useFinanceReport<CommissionReport>(
    tab === "commissionTab" ? "/finance/commissions" : null, { from, to, collaboratorId }, undefined, revision,
  );
  const expenseReport = useFinanceReport<{ items: FinanceExpense[] }>(
    companyView ? "/finance/expenses" : null, { from, to }, expenseStatus, revision,
  );
  const exportMenu = useRef<HTMLDetailsElement>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const reviewTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<FinanceSummaryResponse>("/finance/summary", {
      query: request.filters, signal: controller.signal,
    }).then(
      (data) => { if (!controller.signal.aborted) setResult({ request, data }); },
      () => { if (!controller.signal.aborted) setResult({ request, data: null }); },
    );
    return () => controller.abort();
  }, [request, revision]);

  useEffect(() => {
    if (reviewId) reviewHeading.current?.focus();
  }, [reviewId]);

  const current = result?.request === request ? result : null;
  const data = current?.data;
  const currency = data?.currency ?? company.currency ?? "BRL";
  const currencyFormatter = getCurrencyFormatter(locale, currency);
  const money = (cents: number) => currencyFormatter.format(cents / 100);
  const datesChanged = draft.from !== request.filters.from || draft.to !== request.filters.to;
  const comparisonPeriod = data ? formatFinanceRange(data.comparison, locale) : undefined;
  const reviewed = data?.byCollaborator.find((person) => person.collaboratorId === reviewId);
  const reviewedCommission = commissionReport.data?.professionals.find((person) => person.collaboratorId === reviewId);
  const candidates = result?.data?.appointments
    .filter((item) => item.status === "CONFIRMED" || item.status === "COMPLETED")
    .sort((a, b) => Number(b.payment.canCollect) - Number(a.payment.canCollect)) ?? [];
  const review = data && reviewed ? getFinanceReport(data, t, locale, currency, false,
    data.appointments.filter((item) => item.collaboratorId === reviewId)) : null;

  function apply(filters: Filters, preset: FinancePreset | null) {
    if (!filters.from || !filters.to || filters.from > filters.to) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft({ from: filters.from, to: filters.to });
    setReviewId(null);
    setNotice("");
    setRequest({ filters, preset });
  }

  function changeProfessional(collaboratorId: string) {
    setReviewId(null);
    setNotice("");
    if (collaboratorId && tab === "expenseTab") setTab("overviewTab");
    setRequest({ ...request, filters: { ...request.filters, collaboratorId } });
  }

  function closeExport() {
    exportMenu.current?.removeAttribute("open");
  }

  function refreshFinance() {
    setRevision((version) => version + 1);
  }

  function finishOperation(message: string, expense?: FinanceExpense) {
    setOperation(null);
    const inPeriod = (date: string) => date >= from && date <= to;
    if (expense && !inPeriod(expense.dueDate)) {
      const due = formatFinanceRange({ from: expense.dueDate, to: expense.dueDate }, locale);
      const scope = expense.paidOn && inPeriod(expense.paidOn)
        ? f.expensePaymentInPeriod
        : f.expenseChangePeriod;
      message += " " + f.expenseOutsidePeriod + " (" + due + "). " + scope;
    }
    setNotice(message);
    refreshFinance();
  }

  if (preview && data) {
    return <FinancePrintReport data={data} company={company} currency={currency} onClose={() => {
      setPreview(false);
      requestAnimationFrame(() => exportMenu.current?.querySelector("summary")?.focus());
    }} />;
  }

  return (
    <div className="space-y-5">
      {receiptTarget !== null && (
        <ReceiptDialog appointmentId={receiptTarget || undefined} candidates={candidates}
          timezone={company.timezone} onClose={() => setReceiptTarget(null)}
          onChanged={refreshFinance} />
      )}
      {operation && (
        <FinanceOperationDialog operation={operation} timezone={company.timezone} money={money}
          onClose={() => setOperation(null)} onSaved={finishOperation} />
      )}
      {data && drilldown && receiptTarget === null && (
        <FinanceDrilldown kind={drilldown} data={data} money={money} revision={revision}
          onClose={() => setDrilldown(null)} onPayment={setReceiptTarget} />
      )}
      {companyView && importing && (
        <SpreadsheetImport kind="expenses" today={getTodayIsoDateInTimezone(company.timezone)}
          onClose={() => setImporting(false)} onImported={(message) => {
            setImporting(false);
            setNotice(message);
            refreshFinance();
          }} />
      )}
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        {!current ? <div aria-busy="true"><CardListSkeleton count={4} /></div> : !data ? (
          <ErrorState title={t.errors.networkTitle} description={t.errors.networkDescription}
            retryLabel={t.common.retry} onRetry={() => setRequest({ ...request })} />
        ) : (
          <section className="grid grid-cols-2 gap-3 auto-rows-fr" aria-label={f.summaryTitle}>
            <FinanceKpi title={f.realizedRevenue} icon={CircleCheck} cents={data.summary.realizedRevenueInCents} onOpen={() => setDrilldown("billing")}
              previous={data.comparison.summary.realizedRevenueInCents} comparisonPeriod={comparisonPeriod} money={money}>
              <p>{f.legendForecast}{": "}<strong className="font-semibold text-ink tabular-nums">{money(data.summary.forecastRevenueInCents)}</strong></p>
            </FinanceKpi>
            <FinanceKpi title={f.collected} icon={HandCoins} cents={data.collections.collectedInCents} onOpen={() => setDrilldown("collection")}
              previous={data.collections.previousCollectedInCents} comparisonPeriod={comparisonPeriod} money={money}>
              <dl className="flex flex-wrap gap-x-3 gap-y-1">
                {paymentGroups.map((group) => {
                  const [method] = group;
                  const amounts = data.collections.paidByMethod;
                  if (!group.some((item) => Object.hasOwn(amounts, item))) return null;
                  const amount = group.reduce<number>((total, item) => total + (amounts[item] ?? 0), 0);
                  return (
                    <div key={method} className="flex flex-wrap items-baseline gap-x-1">
                      <dt>{group.length > 1 ? f.cardPayments : f.paymentMethods[method]}</dt>
                      <dd className="font-semibold text-ink tabular-nums">{money(amount)}</dd>
                    </div>
                  );
                })}
              </dl>
            </FinanceKpi>
            <FinanceKpi title={f.pendingBalance} icon={Clock3} cents={data.collections.outstandingInCents} money={money}
              onOpen={() => setDrilldown("outstanding")}>
              <p>{f.outstandingHint}</p>
            </FinanceKpi>
            {companyView && data.expenses ? (
              <FinanceKpi title={f.realNetProfit} icon={Wallet} cents={data.summary.realNetProfitInCents ?? 0} onOpen={() => setDrilldown("result")}
                previous={data.comparison.summary.realNetProfitInCents ?? undefined} comparisonPeriod={comparisonPeriod} money={money}>
                <p>{f.expenseCashTotal}{" "}<strong className="font-semibold text-ink tabular-nums">{money(data.expenses.cashPaidCents)}</strong></p>
                <p className="mt-1">{f.cashCommissionTotal}{" "}<strong className="font-semibold text-ink tabular-nums">{money(data.collections.cashCommissionsInCents)}</strong></p>
                <p className="mt-1 font-semibold text-accent">{f.commissionDueOverview}{" "}
                  <strong className="tabular-nums">{money(data.insights.unsettledCommissionInCents)}</strong>
                </p>
                <p className="mt-1">{f.netFormula}</p>
              </FinanceKpi>
            ) : (
              <FinanceKpi title={f.professionalCommission} icon={Wallet} cents={data.insights.netPayableCommissionInCents} money={money}
                onOpen={() => setDrilldown("result")}>
                <p className="font-semibold text-ink">{f.netPayable}</p>
                <p className="mt-1">{f.deductionsColumn}{" "}<strong className="font-semibold text-ink tabular-nums">{money(data.byCollaborator[0]?.deductionsInCents ?? 0)}</strong></p>
                <p className="mt-1">{f.commissionGenerated}{" "}<strong className="font-semibold text-ink tabular-nums">{money(data.collections.generatedCommissionInCents)}</strong></p>
                <p className="mt-1">{f.commissionPaidInPeriod}{" "}<strong className="font-semibold text-ink tabular-nums">{money(data.collections.cashCommissionsInCents)}</strong></p>
                {data.byCollaborator[0] && <Button type="button" size="sm" variant="outline" className="relative z-10 mt-2 h-auto min-h-7 whitespace-normal py-1"
                  onClick={() => setOperation({ kind: "deduct", collaboratorId,
                    professionals: data.byCollaborator })}>{f.deductionAction}</Button>}
              </FinanceKpi>
            )}
          </section>
        )}
        <section aria-labelledby="finance-filters-title" className={card + " min-w-0 space-y-3 p-3.5 sm:p-4"}>
          <h2 id="finance-filters-title" className="flex items-center gap-2 text-sm font-semibold text-ink">
            <SlidersHorizontal className="size-4 text-accent" aria-hidden="true" />{f.filtersActions}
          </h2>
          <div className={"grid gap-1.5 " + (companyView ? "grid-cols-3" : "grid-cols-2")}>
            <Button type="button" size="sm" variant="outline" className={quickActionClass}
              aria-label={f.registerReceipt} title={f.registerReceipt} disabled={!data} onClick={() => setReceiptTarget("")}>
              <HandCoins className="size-3.5 text-accent" aria-hidden="true" /><span className="w-full truncate">{f.quickPayment}</span>
            </Button>
            {companyView && (
              <Button type="button" size="sm" variant="outline" className={quickActionClass}
                aria-label={f.registerExpense} title={f.registerExpense} onClick={() => setOperation({ kind: "create" })}>
                <Plus className="size-3.5 text-accent" aria-hidden="true" /><span className="w-full truncate">{f.quickExpense}</span>
              </Button>
            )}
            {data ? (
              <details ref={exportMenu} className="group relative min-w-0"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) closeExport();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && exportMenu.current?.open) {
                    closeExport();
                    exportMenu.current.querySelector("summary")?.focus();
                  }
                }}>
                <summary aria-label={f.exportReport} title={f.exportReport}
                  className={quickActionClass + " flex cursor-pointer list-none rounded-lg bg-accent font-semibold text-accent-ink [&::-webkit-details-marker]:hidden"}>
                  <Download className="size-3.5" aria-hidden="true" /><span className="w-full truncate">{f.quickExport}</span>
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-52 max-w-[calc(100vw-2rem)] rounded-xl border border-border-subtle bg-surface p-1.5 shadow-lg">
                  <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-ink hover:bg-subtle"
                    onClick={() => {
                      downloadFinanceCsv(data, company.companyName, t, locale, currency);
                      closeExport();
                      exportMenu.current?.querySelector("summary")?.focus();
                    }}>
                    <FileSpreadsheet className="size-4 shrink-0 text-accent" aria-hidden="true" />{f.exportCsv}
                  </button>
                  <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-ink hover:bg-subtle"
                    onClick={() => { closeExport(); setPreview(true); }}>
                    <Printer className="size-4 shrink-0 text-accent" aria-hidden="true" />{f.exportPrint}
                  </button>
                </div>
              </details>
            ) : (
              <Button type="button" size="sm" className={quickActionClass} aria-label={f.exportReport} title={f.exportReport} disabled>
                <Download className="size-3.5" aria-hidden="true" /><span className="w-full truncate">{f.quickExport}</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {presets.map((preset) => (
              <Button key={preset} type="button" size="sm" variant={request.preset === preset ? "default" : "outline"}
                className="h-8 min-w-0 rounded-full px-1 text-[11px] sm:text-xs" aria-pressed={request.preset === preset}
                onClick={() => apply({
                  ...getFinanceRange(preset, company.timezone),
                  collaboratorId: request.filters.collaboratorId,
                }, preset)}>
                {f[preset]}
              </Button>
            ))}
          </div>

          <form className="grid grid-cols-2 items-end gap-x-2 gap-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (datesChanged) apply({ ...draft, collaboratorId: request.filters.collaboratorId }, null);
            }}>
            <div className="col-span-2 grid min-w-0 gap-1">
              <Label htmlFor="fin-professional" className="text-xs text-ink-secondary">{f.colProfessional}</Label>
              <select id="fin-professional" value={request.filters.collaboratorId} className={inputClass}
                onChange={(event) => changeProfessional(event.target.value)}>
                <option value="">{f.allProfessionals}</option>
                {result?.data?.professionals.map((person) => (
                  <option key={person.id} value={person.id}>{person.name}</option>
                ))}
              </select>
            </div>
            <div className="grid min-w-0 gap-1">
              <Label htmlFor="fin-from" className="text-xs text-ink-secondary">{f.from}</Label>
              <Input id="fin-from" type="date" required max="9999-12-31" value={draft.from}
                onChange={(event) => { setInvalid(false); setDraft({ ...draft, from: event.target.value }); }}
                className={inputClass} />
            </div>
            <div className="grid min-w-0 gap-1">
              <Label htmlFor="fin-to" className="text-xs text-ink-secondary">{f.to}</Label>
              <Input id="fin-to" type="date" required max="9999-12-31" value={draft.to}
                onChange={(event) => { setInvalid(false); setDraft({ ...draft, to: event.target.value }); }}
                className={inputClass} />
            </div>

            {datesChanged && (
              <Button type="submit" variant="outline" size="sm" className="col-span-2 h-8 justify-self-start rounded-lg px-2.5 text-xs">
                {f.applyFilters}
              </Button>
            )}
          </form>
          {invalid && <p role="alert" className="text-xs text-[var(--status-danger-ink)]">{f.invalidPeriod}</p>}
        </section>
      </div>
      {notice && <p role="status" className="text-sm text-accent">{notice}</p>}

      <div role="tablist" aria-label={f.title} className="flex flex-wrap gap-1.5 border-b border-border-subtle pb-2">
        {tabs.map((view, index) => (
          <Button key={view} id={"finance-tab-" + view} role="tab" type="button"
            variant={tab === view ? "default" : "ghost"} aria-selected={tab === view}
            aria-controls="finance-tabpanel" tabIndex={tab === view ? 0 : -1}
            onClick={() => { setTab(view); setReviewId(null); }}
            onKeyDown={(event) => {
              const last = tabs.length - 1;
              const next = event.key === "ArrowRight" ? (index + 1) % tabs.length
                : event.key === "ArrowLeft" ? (index + last) % tabs.length
                  : event.key === "Home" ? 0 : event.key === "End" ? last : null;
              if (next === null) return;
              event.preventDefault();
              setTab(tabs[next]);
              setReviewId(null);
              document.getElementById("finance-tab-" + tabs[next])?.focus();
            }}>
            {f[view]}
          </Button>
        ))}
      </div>
      <div id="finance-tabpanel" role="tabpanel" aria-labelledby={"finance-tab-" + tab}>
        {data && tab === "overviewTab" && (
          <div className="space-y-4">
            <FinanceCharts data={data} money={money} />
            <ReceiptMovements key={data.period.from + data.period.to + data.period.collaboratorId + revision}
              period={data.period} onOpen={setReceiptTarget} />
          </div>
        )}
        {companyView && data?.expenses && tab === "expenseTab" && (
          <FinanceExpenses report={expenseReport} summary={data.expenses} money={money}
            status={expenseStatus} onStatusChange={setExpenseStatus} onOperation={setOperation} onImport={() => setImporting(true)} />
        )}
        {data && tab === "commissionTab" && (
          <div className="space-y-4">
            <FinanceCommissions data={data} report={commissionReport} money={money} onOperation={setOperation} reviewId={reviewId}
              onReview={(id, trigger) => {
                reviewTrigger.current = trigger;
                setReviewId(reviewId === id ? null : id);
              }} />
            {review && reviewed && (
              <section id="finance-review" className={card + " p-4 sm:p-5"} aria-labelledby="finance-review-heading">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 id="finance-review-heading" ref={reviewHeading} tabIndex={-1} className="text-sm font-semibold text-ink">
                    {f.appointmentDetails} · {reviewed.name}
                  </h3>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={t.common.close}
                    onClick={() => {
                      setReviewId(null);
                      reviewTrigger.current?.focus();
                    }}><X aria-hidden="true" /></Button>
                </div>
                <dl className="mb-4 grid grid-cols-3 gap-2 text-xs">
                  {([
                    [f.colCompleted, new Intl.NumberFormat(locale).format(reviewed.completedCount)],
                    [f.colRevenue, money(reviewed.realizedRevenueInCents)],
                    [f.colAverageRate, reviewed.averageCommissionPercentage === null ? "—"
                      : new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 })
                        .format(reviewed.averageCommissionPercentage / 100)],
                  ] as const).map(([label, value]) => (
                    <div key={label}><dt className="text-ink-secondary">{label}</dt>
                      <dd className="mt-1 font-semibold text-ink tabular-nums">{value}</dd></div>
                  ))}
                </dl>
                {reviewedCommission && (
                  <div className="mb-4">
                    <FinanceDeductionDetails professional={reviewedCommission} money={money}
                      onRemove={(deduction) => setOperation({ kind: "removeDeduction", deduction })} />
                  </div>
                )}
                <FinanceDataTable headers={review.headers.appointments} rows={review.appointments} numericFrom={5} empty={f.noDataPeriod} />
                <ul className="mt-4 divide-y divide-border-subtle">
                  {data.appointments.filter((item) => item.collaboratorId === reviewId &&
                    (item.status === "COMPLETED" || item.status === "CONFIRMED" || item.payment.collectedInCents > 0)).map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                      <span>{item.clientName} · {item.serviceName}</span>
                      {item.payment.historical && <span className="text-ink-muted">{f.legacy}</span>}
                      <Button type="button" variant="outline" size="sm" onClick={() => setReceiptTarget(item.id)}>
                        {f.paymentHistory}
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
