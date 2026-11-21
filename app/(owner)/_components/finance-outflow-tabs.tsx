"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClientInitials } from "@/components/ui/agenda-card";
import { apiRequest } from "@/lib/api-client";
import { formatDateInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type { CommissionReport, ExpenseStatus, ExpenseSummary, FinanceExpense, FinanceSummaryResponse } from "@/lib/types/finance";
import { formatFinanceRange } from "./finance-report-data";
import type { FinanceOperation } from "./finance-operation-dialog";

const panel = "overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xs";
type Money = (cents: number) => string;
type OpenOperation = (operation: FinanceOperation) => void;

export function useFinanceReport<T>(path: string | null, period: { from: string; to: string; collaboratorId?: string | null },
  status?: string, revision = 0) {
  const query = new URLSearchParams({ from: period.from, to: period.to });
  if (period.collaboratorId) query.set("collaboratorId", period.collaboratorId);
  if (status) query.set("status", status);
  const url = path === null ? null : path + "?" + query.toString();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ url: string; attempt: number; revision: number; data: T | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    void apiRequest<T>(url, { signal: controller.signal }).then(
      (data) => { if (!controller.signal.aborted) setResult({ url, attempt, revision, data }); },
      () => { if (!controller.signal.aborted) setResult({ url, attempt, revision, data: null }); },
    );
    return () => controller.abort();
  }, [url, attempt, revision]);
  return {
    data: result?.url === url && result.attempt === attempt && result.revision === revision ? result.data : undefined,
    retry: () => setAttempt((version) => version + 1),
  };
}

function ReportStatus({ failed, retry }: { failed: boolean; retry: () => void }) {
  const { t } = useLocale();
  return failed ? (
    <div role="alert" className="flex flex-wrap items-center gap-2 p-4 text-sm text-ink-muted">
      {t.errors.networkDescription}
      <Button type="button" variant="outline" size="sm" onClick={retry}>{t.common.retry}</Button>
    </div>
  ) : <p role="status" className="p-4 text-sm text-ink-muted">{t.common.loading}</p>;
}

export function FinanceExpenses({ report, summary, money, status, onStatusChange, onOperation, onImport }: {
  report: { data: { items: FinanceExpense[] } | null | undefined; retry: () => void };
  summary: ExpenseSummary;
  money: Money;
  status: ExpenseStatus | "";
  onStatusChange: (status: ExpenseStatus | "") => void;
  onOperation: OpenOperation;
  onImport: () => void;
}) {
  const { locale, t } = useLocale();
  const f = t.finance;
  const { data, retry } = report;
  const labels = { PENDING: f.expensePending, PAID: f.expensePaid, OVERDUE: f.expenseOverdue };
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" });
  const number = new Intl.NumberFormat(locale);
  const date = (value: string) => dateFormat.format(new Date(value));

  return (
    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle p-4">
        <h3 className="font-semibold text-ink">{f.expenseTab}</h3>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onImport}>{t.executive.importSheet}</Button>
          <Button type="button" size="sm" onClick={() => onOperation({ kind: "create" })}>
            <Plus aria-hidden="true" />{f.registerExpense}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant={status === "" ? "default" : "outline"}
            aria-pressed={!status} onClick={() => onStatusChange("")}>{f.allExpenses}</Button>
          {(["PENDING", "PAID", "OVERDUE"] as const).map((value) => (
            <Button key={value} type="button" size="sm" variant={status === value ? "default" : "outline"}
              aria-pressed={status === value} onClick={() => onStatusChange(value)}>{labels[value]}</Button>
          ))}
        </div>
        <p className="text-xs text-ink-secondary">{f.expensesInPeriod}{" "}
          <strong className="font-semibold text-ink tabular-nums">{money(summary.totalCents)}</strong>
        </p>
      </div>
      {!data ? <ReportStatus failed={data === null} retry={retry} /> : !data.items.length ? (
        <p className="p-5 text-sm text-ink-muted">{f.noDataPeriod}</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {data.items.map((expense) => (
            <li key={expense.id} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="min-w-0">
                <p className="break-words text-sm font-semibold text-ink">{expense.description}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-ink-muted">
                  <span className={expense.category === "STOCK_PURCHASE" ? "rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent" : ""}>
                    {f.expenseCategories[expense.category]}
                  </span>
                  <span>· {expense.expenseType === "FIXED" ? f.expenseFixed : f.expenseVariable}</span>
                  {expense.isRecurring && <span>· {f.expenseRecurring}</span>}
                </div>
                {expense.externalSourceType === "STOCK_ORDER" &&
                  <p className="mt-1 text-[11px] text-accent">{f.stockSource}</p>}
                {expense.externalSourceType === "INVENTORY_MOVEMENT" &&
                  <p className="mt-1 text-[11px] text-accent">{t.executive.linkedInventory}</p>}
                {expense.notes && <p className="mt-1 break-words text-ink-secondary">{expense.notes}</p>}
              </div>
              <div className="space-y-1">
                <span className={"inline-block rounded-full px-2 py-0.5 font-medium " +
                  (expense.status === "OVERDUE" ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-ink)]" : "bg-subtle text-ink-secondary")}>
                  {labels[expense.status]}
                </span>
                <p className="text-ink-muted tabular-nums">{f.expenseDue} · {date(expense.dueDate)}</p>
                {expense.paidOn && expense.paymentMethod && (
                  <p className="text-ink-muted tabular-nums">{date(expense.paidOn)} · {f.paymentMethods[expense.paymentMethod]}</p>
                )}
              </div>
              <div className="text-ink tabular-nums sm:text-right">
                <strong>{money(expense.amountCents)}</strong>
                {expense.quantity > 1 && expense.unitAmountCents !== null && (
                  <p className="mt-1 whitespace-nowrap text-[11px] text-ink-muted">
                    {number.format(expense.quantity)} {f.unitsShort} × {money(expense.unitAmountCents)}
                  </p>
                )}
              </div>
                <div className="flex flex-wrap gap-1 sm:justify-end">
                  {expense.status !== "PAID" && (
                  <Button variant="outline" size="sm" type="button" onClick={() => onOperation({ kind: "pay", expense })}>
                    {f.markPaid}
                  </Button>
                  )}
                  <Button variant="outline" size="sm" type="button" aria-label={t.executive.editExpense + " · " + expense.description}
                    onClick={() => onOperation({ kind: "edit", expense })}>{t.common.edit}</Button>
                  {expense.externalSourceType === "INVENTORY_MOVEMENT" ? (
                    <p className="max-w-48 text-ink-muted">{t.executive.FINANCE_EXPENSE_INVENTORY_LINKED}</p>
                  ) : (
                    <Button variant="ghost" size="sm" type="button"
                      aria-label={f.deleteExpense + " · " + expense.description} onClick={() => onOperation({ kind: "remove", expense })}>
                      <Trash2 className="size-3.5 text-[var(--status-danger-ink)]" aria-hidden="true" />{t.common.delete}
                    </Button>
                  )}
                </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FinanceCommissions({ data: summary, report, money, onOperation, onReview, reviewId }: {
  data: FinanceSummaryResponse;
  report: ReturnType<typeof useFinanceReport<CommissionReport>>;
  money: Money;
  onOperation: OpenOperation;
  onReview: (collaboratorId: string, trigger: HTMLButtonElement) => void;
  reviewId: string | null;
}) {
  const { locale, t } = useLocale();
  const f = t.finance;
  const { data, retry } = report;
  const people = new Map(summary.byCollaborator.map((person) => [person.collaboratorId, person]));

  if (!data) return <div className={panel}><ReportStatus failed={data === null} retry={retry} /></div>;
  return (
    <div className="space-y-4">
      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle p-4">
          <h3 className="font-semibold text-ink">{f.commissionsTableTitle}</h3>
          <Button type="button" size="sm" disabled={!data.professionals.length}
            onClick={() => onOperation({ kind: "deduct", professionals: data.professionals,
              collaboratorId: summary.period.collaboratorId ?? undefined })}>
            <Plus aria-hidden="true" />{f.deductionAction}
          </Button>
        </div>
        {data.professionals.length === 0 ? <p className="p-4 text-sm text-ink-muted">{f.noDataPeriod}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-left text-xs">
              <thead className="bg-subtle text-ink-secondary">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">{f.colProfessional}</th>
                  {[f.commissionForecast, f.waitingCustomerCollection, f.commissionPayable, f.commissionPaid,
                    f.deductionsColumn, f.netPayable].map((title) => (
                    <th key={title} scope="col" className="px-4 py-3 text-right font-semibold">{title}</th>
                  ))}
                  <th scope="col"><span className="sr-only">{f.filtersActions}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-ink">
                {data.professionals.map((person) => {
                  const profile = people.get(person.collaboratorId);
                  return (
                    <tr key={person.collaboratorId}>
                      <th scope="row" className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2.5">
                          {profile?.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={profile.avatarUrl} loading="lazy" alt="" className="size-8 shrink-0 rounded-full object-cover" />
                          ) : <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/10 font-semibold text-accent">{getClientInitials(person.name)}</span>}
                          <span>{person.name}{profile?.specialty && <span className="block text-[11px] text-ink-muted">{profile.specialty}</span>}</span>
                        </div>
                      </th>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money(person.forecastInCents)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money(person.awaitingCollectionInCents)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">{money(person.payableInCents)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money(person.paidInCents)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money(person.deductionsInCents)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-accent tabular-nums">{money(person.netPayableInCents)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 sm:justify-end">
                          {person.payableInCents > 0 && (
                            <Button type="button" size="sm" aria-label={f.settleBatch + " · " + person.name}
                              onClick={() => onOperation({ kind: "settle", professional: person, period: data.period })}>
                              {f.settleBatch}
                            </Button>
                          )}
                          <Button type="button" variant="outline" size="sm"
                            onClick={() => onOperation({ kind: "deduct", collaboratorId: person.collaboratorId,
                              professionals: data.professionals })}>{f.deductionAction}</Button>
                          <Button type="button" variant="ghost" size="sm"
                            aria-expanded={reviewId === person.collaboratorId}
                            aria-controls={reviewId === person.collaboratorId ? "finance-review" : undefined}
                            onClick={(event) => onReview(person.collaboratorId, event.currentTarget)}>
                            {f.checkDetails}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={panel}>
        <h3 className="border-b border-border-subtle p-4 font-semibold text-ink">{f.settlementHistory}</h3>
        {!data.settlements.length ? <p className="p-4 text-sm text-ink-muted">{f.noDataPeriod}</p> : (
          <ul className="divide-y divide-border-subtle">
            {data.settlements.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs">
                <div>
                  <p className="font-semibold text-ink">{entry.collaboratorName}</p>
                  <p className="mt-1 text-ink-muted tabular-nums">
                    {formatDateInTimezone(entry.paidAt, summary.period.timezone, locale)} ·{" "}
                    {formatFinanceRange({ from: entry.periodStart, to: entry.periodEnd }, locale)}
                    {entry.paymentMethod && entry.amountCents > 0 ? " · " + f.paymentMethods[entry.paymentMethod] : ""}
                  </p>
                  {entry.notes && <p className="mt-1 break-words text-ink-secondary">{entry.notes}</p>}
                </div>
                <strong className="text-sm text-ink tabular-nums">{money(entry.amountCents)}</strong>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
