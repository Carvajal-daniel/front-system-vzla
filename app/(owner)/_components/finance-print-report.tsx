"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, Printer, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Company } from "@/lib/types/auth";
import type { FinanceSummaryResponse } from "@/lib/types/finance";
import { getExecutivePdfData } from "./finance-report-data";
import "./finance-print.css";

export function FinanceDataTable({
  headers, rows, numericFrom, empty, colWidths, footer, footerRows, mutedRows,
}: {
  headers: string[];
  rows: string[][];
  numericFrom: number;
  empty: string;
  colWidths?: string[];
  footer?: string[];
  footerRows?: string[][];
  mutedRows?: boolean[];
}) {
  if (!rows.length) return <p className="py-3 text-xs text-ink-muted">{empty}</p>;
  return (
    <div className="finance-table-scroll overflow-x-auto">
      <table className="finance-report-table w-full text-left text-xs">
        {colWidths && (
          <colgroup>
            {colWidths.map((width, index) => <col key={index} style={{ width }} />)}
          </colgroup>
        )}
        <thead className="border-y border-border-subtle bg-subtle text-[11px] uppercase tracking-wide text-ink-secondary">
          <tr>{headers.map((label, index) => (
            <th key={label} scope="col" className={"px-2.5 py-2 font-semibold " + (index >= numericFrom ? "text-right" : "")}>
              {label}
            </th>
          ))}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={"border-b border-border-subtle/70 " + (mutedRows?.[rowIndex] ? "text-ink-muted line-through/0 opacity-70" : "")}>
              {row.map((cell, index) => (
                <td key={index} className={"px-2.5 py-1.5 align-top " + (index >= numericFrom ? "whitespace-nowrap text-right tabular-nums" : "")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {(footer || footerRows?.length) && (
          <tfoot className="border-t-2 border-border-subtle bg-subtle/70 font-semibold text-ink">
            {(footerRows ?? (footer ? [footer] : [])).map((fRow, fIndex) => (
              <tr key={fIndex} className="border-b border-border-subtle/50 last:border-b-0">
                {fRow.map((cell, index) => (
                  <td key={index} className={"px-2.5 py-1.5 " + (index >= numericFrom ? "whitespace-nowrap text-right tabular-nums" : "")}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  );
}

function CashOverviewBars({
  title, bars,
}: {
  title: string;
  bars: { label: string; cents: number; formatted: string; tone: "inflow" | "outflow" | "net" }[];
}) {
  const max = Math.max(...bars.map((b) => b.cents), 1);
  const fill = { inflow: "#0f766e", outflow: "#b91c1c", net: "#1d4ed8" };
  return (
    <div className="finance-print-block rounded-xl border border-border-subtle p-3">
      <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-secondary">{title}</h4>
      <div className="space-y-2.5">
        {bars.map((bar) => {
          const pct = Math.max(2, Math.round((bar.cents / max) * 100));
          return (
            <div key={bar.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-secondary">{bar.label}</span>
                <span className="font-semibold tabular-nums text-ink">{bar.formatted}</span>
              </div>
              <svg className="h-2.5 w-full overflow-hidden rounded-full bg-subtle" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
                <rect x="0" y="0" width={pct} height="6" rx="3" fill={fill[bar.tone]} />
              </svg>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FinancePrintReport({
  data, company, currency, onClose,
}: {
  data: FinanceSummaryResponse;
  company: Company;
  currency: string;
  onClose: () => void;
}) {
  const { locale, t } = useLocale();
  const f = t.finance;
  const p = f.pdfReport;
  const report = getExecutivePdfData(data, t, locale, currency);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { heading.current?.focus(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          <ArrowLeft aria-hidden="true" />{f.closePreview}
        </Button>
        <Button type="button" onClick={() => window.print()}>
          <Printer aria-hidden="true" />{f.printReport}
        </Button>
      </div>

      <article className="finance-print-report rounded-2xl border border-border-subtle bg-surface p-5 text-ink sm:p-8">
        {/* Cabeçalho corporativo */}
        <header className="finance-print-heading flex flex-wrap items-center justify-between gap-4 border-b-2 border-border-subtle pb-4">
          <div className="flex items-center gap-3.5">
            {company.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="size-12 shrink-0 rounded-xl object-contain" src={company.avatarUrl} alt="" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-subtle text-accent">
                <Scissors className="size-5" aria-hidden="true" />
              </span>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">{company.companyName}</p>
              <h2 ref={heading} tabIndex={-1} className="text-xl font-bold tracking-tight outline-none">{f.reportTitle}</h2>
              <p className="mt-0.5 text-xs text-ink-secondary tabular-nums">
                {report.period} · {report.professional} · {currency}
              </p>
            </div>
          </div>
          <div className="text-right text-[11px] text-ink-muted tabular-nums">
            <p>{p.generatedAt}: {report.generatedAt}</p>
            <p>{p.comparisonPeriodLabel}: {report.comparisonPeriod}</p>
          </div>
        </header>

        {/* Seção 1 — Resumo executivo (6 KPIs + Resumo inteligente) */}
        <section className="mt-5">
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-secondary">
            1. {f.summaryTitle}
          </h3>
          <dl className="finance-print-kpis grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {report.kpis.map((kpi) => (
              <div
                key={kpi.label}
                className={
                  "rounded-xl border px-3.5 py-2.5 " +
                  (kpi.highlight ? "border-accent/40 bg-subtle/60" : "border-border-subtle bg-surface")
                }
              >
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-[11px] font-medium text-ink-secondary">{kpi.label}</dt>
                  {kpi.delta && kpi.delta !== "—" && (
                    <span className="text-[10px] font-semibold tabular-nums text-accent">{kpi.delta}</span>
                  )}
                </div>
                <dd className="mt-1 text-base font-bold tabular-nums text-ink">{kpi.value}</dd>
                <p className="mt-0.5 text-[10px] leading-snug text-ink-muted">{kpi.hint}</p>
              </div>
            ))}
          </dl>

          {!!report.insights.length && (
            <div className="finance-print-block mt-3 rounded-xl border border-border-subtle bg-subtle/40 px-3.5 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">{p.executiveInsights}</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-ink">
                {report.insights.map((line) => <li key={line}>{line}</li>)}
              </ul>
              {report.hasCommissionDiff && (
                <p className="mt-2 border-t border-border-subtle/70 pt-1.5 text-[11px] text-ink-muted">
                  {p.commissionReconciliationNote}
                </p>
              )}
            </div>
          )}
        </section>

        {/* Seção 2 — Análise financeira e comparativo */}
        <section className="mt-6">
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-secondary">
            2. {p.sectionAnalysis}
          </h3>
          <div className="finance-print-two-col grid gap-4 md:grid-cols-2">
            <div className="finance-print-block">
              <FinanceDataTable
                headers={[p.indicator, p.currentPeriod, p.previousCol, p.variation]}
                rows={report.comparisonRows}
                numericFrom={1}
                colWidths={["40%", "22%", "22%", "16%"]}
                empty={f.noDataPeriod}
              />
            </div>
            <CashOverviewBars title={p.cashChartTitle} bars={report.cashBars} />
          </div>
        </section>

        {/* Seção 3 — Receitas e recebimentos */}
        <section className="mt-6">
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-secondary">
            3. {p.sectionRevenue}
          </h3>
          <div className="finance-print-two-col grid gap-4 md:grid-cols-2">
            <div className="finance-print-block">
              <FinanceDataTable
                headers={[f.method, f.totalAmount, p.shareCol]}
                rows={report.methodRows}
                numericFrom={1}
                colWidths={["50%", "30%", "20%"]}
                footer={report.methodRows.length ? [p.totalRow, report.methodTotal, "100%"] : undefined}
                empty={f.noDataPeriod}
              />
            </div>
            <div className="finance-print-block rounded-xl border border-border-subtle p-3 text-xs">
              <dl className="space-y-2">
                <div className="flex justify-between gap-2 border-b border-border-subtle/60 pb-1.5">
                  <dt className="text-ink-secondary">{p.serviceRevenueShare}</dt>
                  <dd className="font-semibold tabular-nums">{report.serviceCashFormatted}</dd>
                </div>
                {report.productSalesFormatted && (
                  <div className="flex justify-between gap-2 border-b border-border-subtle/60 pb-1.5">
                    <dt className="text-ink-secondary">{p.productRevenueShare}</dt>
                    <dd className="font-semibold tabular-nums">{report.productSalesFormatted}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-secondary">{f.pendingBalance}</dt>
                  <dd className="font-semibold tabular-nums">{report.kpis[2]?.value}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* Seção 4 — Despesas (somente visão da empresa) */}
        {report.expensesSummary && (
          <section className="mt-6">
            <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-secondary">
              4. {p.sectionExpenses}
            </h3>
            <div className="finance-print-two-col mb-3 grid gap-4 md:grid-cols-2">
              <div className="finance-print-block rounded-xl border border-border-subtle p-3 text-xs">
                <dl className="grid grid-cols-2 gap-2.5">
                  <div><dt className="text-ink-secondary">{f.expensesInPeriod}</dt><dd className="font-bold tabular-nums">{report.expensesSummary.total}</dd></div>
                  <div><dt className="text-ink-secondary">{f.expenseCashTotal}</dt><dd className="font-bold tabular-nums">{report.expensesSummary.paid}</dd></div>
                  <div><dt className="text-ink-secondary">{f.expensePending}</dt><dd className="font-semibold tabular-nums">{report.expensesSummary.pending}</dd></div>
                  <div><dt className="text-ink-secondary">{f.expenseOverdue}</dt><dd className="font-semibold tabular-nums">{report.expensesSummary.overdue}</dd></div>
                </dl>
              </div>
              <div className="finance-print-block">
                <FinanceDataTable
                  headers={[f.expenseCategory, f.totalAmount, f.expensePaid, p.shareCol]}
                  rows={report.expenseCategoryRows}
                  numericFrom={1}
                  colWidths={["40%", "22%", "22%", "16%"]}
                  empty={f.noDataPeriod}
                />
              </div>
            </div>
            <FinanceDataTable
              headers={[f.expenseDescription, f.expenseCategory, f.expenseType, f.expenseDue, f.expenseStatus, p.paymentAndMethod, f.totalAmount]}
              rows={report.expenseDetailRows}
              numericFrom={6}
              colWidths={["26%", "15%", "9%", "10%", "10%", "18%", "12%"]}
              footer={report.expenseDetailRows.length ? [p.totalRow, "", "", "", "", "", report.expensesSummary.total] : undefined}
              empty={f.noDataPeriod}
            />
          </section>
        )}

        {/* Seção 5 — Comissões por profissional */}
        <section className={"mt-6 " + (report.staffRows.length <= 10 ? "finance-print-keep-together" : "")}>
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-secondary">
            {report.expensesSummary ? "5." : "4."} {p.sectionCommissions}
          </h3>
          <FinanceDataTable
            headers={[
              f.colProfessional, f.colCompleted, f.colRevenue, f.awaitingCommission,
              f.readyCommission, f.deductionsColumn, f.netPayable, f.paidCommission,
            ]}
            rows={report.staffRows}
            numericFrom={1}
            colWidths={["20%", "8%", "13%", "12%", "12%", "11%", "12%", "12%"]}
            footer={report.staffRows.length ? report.staffTotals : undefined}
            empty={f.noDataPeriod}
          />
        </section>

        {/* Seção 6 — Desempenho do negócio */}
        <section className="mt-6">
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-ink-secondary">
            {report.expensesSummary ? "6." : "5."} {p.sectionPerformance}
          </h3>
          <div className="finance-print-block mb-3 grid grid-cols-2 gap-2.5 rounded-xl border border-border-subtle bg-subtle/40 p-3 text-xs sm:grid-cols-5">
            <div><span className="text-ink-secondary">{p.completedCount}</span><p className="font-bold tabular-nums">{report.performanceMetrics.completed}</p></div>
            <div><span className="text-ink-secondary">{p.completionRate}</span><p className="font-bold tabular-nums">{report.performanceMetrics.completionRate}</p></div>
            <div><span className="text-ink-secondary">{p.averageTicket}</span><p className="font-bold tabular-nums">{report.performanceMetrics.averageTicket}</p></div>
            <div><span className="text-ink-secondary">{p.canceledCount}</span><p className="font-bold tabular-nums">{report.performanceMetrics.canceled}</p></div>
            <div><span className="text-ink-secondary">{p.noShowCount}</span><p className="font-bold tabular-nums">{report.performanceMetrics.noShow}</p></div>
          </div>
          <FinanceDataTable
            headers={[f.service, f.colCompleted, p.averageTicket, f.colRevenue, p.shareCol]}
            rows={report.serviceRows}
            numericFrom={1}
            colWidths={["42%", "12%", "16%", "18%", "12%"]}
            empty={f.noDataPeriod}
          />
        </section>

        {/* Seção 7 — Anexo: Detalhamento dos atendimentos (nova página) */}
        <section className="finance-print-annex mt-6">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-ink-secondary">
            {report.expensesSummary ? "7." : "6."} {p.sectionAnnex}
          </h3>
          <p className="mb-2 text-[11px] text-ink-muted">{f.reportScopeNote}</p>
          <FinanceDataTable
            headers={[f.dateTime, f.client, f.service, f.colProfessional, f.status, f.gross, f.commissionValue, f.netValue]}
            rows={report.appointmentRows.map((row) => row.cells)}
            mutedRows={report.appointmentRows.map((row) => row.muted)}
            numericFrom={5}
            colWidths={["13%", "16%", "18%", "15%", "10%", "9%", "9%", "10%"]}
            footerRows={report.appointmentRows.length ? report.annexSubtotals : undefined}
            empty={f.noDataPeriod}
          />
        </section>
      </article>
    </div>
  );
}
