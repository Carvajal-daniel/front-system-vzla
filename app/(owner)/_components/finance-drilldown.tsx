"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { formatDateInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { paymentMethods, type FinanceSummaryResponse } from "@/lib/types/finance";
import { FinanceDataTable } from "./finance-print-report";
import { formatFinanceRange } from "./finance-report-data";
import { OwnerModal, ownerSection } from "./owner-modal";
import { ReceiptMovements } from "./receipt-movements";

export type FinanceDrilldownKind = "billing" | "collection" | "outstanding" | "result";

const line = "flex flex-wrap items-center justify-between gap-2 py-2";

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return <section className={ownerSection + " p-3 sm:p-4"}><h3 className="mb-2 text-sm font-semibold">{title}</h3>{children}</section>;
}

function Values({ rows }: { rows: [label: string, value: string][] }) {
  return <dl className="divide-y divide-border-subtle text-sm">{rows.map(([label, value]) => (
    <div key={label} className={line}><dt className="text-ink-secondary">{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>
  ))}</dl>;
}

export function FinanceDrilldown({ kind, data, money, revision, onClose, onPayment }: {
  kind: FinanceDrilldownKind;
  data: FinanceSummaryResponse;
  money: (cents: number) => string;
  revision: number;
  onClose: () => void;
  onPayment: (id: string) => void;
}) {
  const { locale, t } = useLocale();
  const x = t.executive;
  const f = t.finance;
  const { collections, expenses, summary } = data;
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const number = new Intl.NumberFormat(locale);
  const completed = data.appointments.filter((appointment) => appointment.status === "COMPLETED");
  const outstanding = completed.filter((appointment) => appointment.payment.openInCents > 0);
  const title = { billing: x.billingDetails, collection: x.collectionDetails, outstanding: x.outstandingDetails,
    result: expenses ? x.profitDetails : x.professionalDetails }[kind];
  const date = (value: string) => formatDateInTimezone(value, data.period.timezone, locale);
  const professional = data.byCollaborator[0];
  return (
    <OwnerModal title={title} onClose={onClose} wide>
      <p className="mb-4 text-sm text-ink-muted">{formatFinanceRange(data.period, locale)}</p>
      {kind === "billing" && <div className="space-y-4">
        <Values rows={[
          [f.realizedRevenue, money(summary.realizedRevenueInCents) + " · " + number.format(summary.completedCount)],
          [f.legendForecast, money(summary.forecastRevenueInCents) + " · " + number.format(summary.pendingCount + summary.confirmedCount)],
        ]} />
        <DetailBlock title={x.byService}>
          <FinanceDataTable headers={[x.service, x.completedServices, f.realizedRevenue, f.legendForecast]}
            rows={data.byService.map((service) => [service.serviceName, number.format(service.realizedCount),
              money(service.realizedInCents), money(service.revenueInCents - service.realizedInCents)])}
            numericFrom={1} empty={f.noDataPeriod} />
        </DetailBlock>
        <DetailBlock title={x.completedServices}>
          <FinanceDataTable headers={[x.date, x.client, x.service, x.collaborator, x.paymentStatus, x.amountBilled]}
            rows={completed.map((appointment) => [date(appointment.startsAt), appointment.clientName, appointment.serviceName,
              appointment.collaboratorName ?? "—", appointment.payment.historical ? f.legacy
                : appointment.payment.openInCents === 0 ? x.fullyPaid
                  : appointment.payment.collectedInCents > 0 ? x.partialPayment : x.noPayment,
              money(appointment.payment.netInCents)])} numericFrom={5} empty={f.noDataPeriod} />
        </DetailBlock>
      </div>}
      {kind === "collection" && <div className="space-y-4">
        <DetailBlock title={f.collected}>
          <Values rows={[
            ...paymentMethods.map((method): [string, string] => [f.paymentMethods[method], money(collections.paidByMethod[method] ?? 0)]),
            ...(data.period.collaboratorId ? [] : [[x.salesProduct, money(collections.productSalesInCents)] as [string, string]]),
            [f.collected, money(collections.collectedInCents)],
          ]} />
        </DetailBlock>
        <ReceiptMovements period={data.period} onOpen={onPayment} revision={revision} />
      </div>}
      {kind === "outstanding" && (outstanding.length ? (
        <ul className={ownerSection + " divide-y divide-border-subtle"}>
          {outstanding.map((appointment) => <li key={appointment.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="break-words font-semibold">{appointment.clientName}</p>
              <p className="text-xs text-ink-muted">{appointment.serviceName} · {date(appointment.startsAt)}</p>
              {appointment.payment.historical && <p className="mt-1 text-xs text-ink-muted">{f.legacy}</p>}
            </div>
            <dl className="grid grid-cols-3 gap-2 text-xs">
              <div><dt className="text-ink-muted">{x.amountBilled}</dt><dd className="font-semibold tabular-nums">{money(appointment.payment.netInCents)}</dd></div>
              <div><dt className="text-ink-muted">{f.collected}</dt><dd className="font-semibold tabular-nums">{money(appointment.payment.collectedInCents)}</dd></div>
              <div><dt className="text-ink-muted">{f.pendingBalance}</dt><dd className="font-semibold text-accent tabular-nums">{money(appointment.payment.openInCents)}</dd></div>
            </dl>
            <Button type="button" size="sm" onClick={() => onPayment(appointment.id)}>{f.registerReceipt}</Button>
          </li>)}
        </ul>
      ) : <p className="text-sm text-ink-muted">{f.noDataPeriod}</p>)}
      {kind === "result" && (expenses ? <div className="space-y-4">
        <Values rows={[
          [f.collected, money(collections.collectedInCents)],
          [f.cashCommissionTotal, money(-collections.cashCommissionsInCents)],
          [f.expenseCashTotal, money(-expenses.cashPaidCents)],
          [f.realNetProfit, money(summary.realNetProfitInCents ?? 0)],
          [x.netMargin, collections.collectedInCents > 0
            ? percent.format((summary.realNetProfitInCents ?? 0) / collections.collectedInCents) : "—"],
        ]} />
        <DetailBlock title={x.expenseImpact}>
          <Values rows={expenses.byCategory.map(({ category, cashPaidCents }) => [f.expenseCategories[category], money(cashPaidCents)])} />
        </DetailBlock>
        <p className="rounded-lg bg-accent/10 p-3 text-sm font-semibold text-accent">
          {f.commissionDueOverview}{" "}<strong className="tabular-nums">{money(data.insights.unsettledCommissionInCents)}</strong>
        </p>
      </div> : <Values rows={[
        [f.commissionForecast, money(professional?.forecastCommissionInCents ?? 0)],
        [f.waitingCustomerCollection, money(collections.awaitingCommissionInCents)],
        [f.commissionPayable, money(collections.readyCommissionInCents)],
        [f.deductionsColumn, money(professional?.deductionsInCents ?? 0)],
        [f.netPayable, money(data.insights.netPayableCommissionInCents)],
        [f.commissionPaidInPeriod, money(collections.cashCommissionsInCents)],
      ]} />)}
    </OwnerModal>
  );
}
