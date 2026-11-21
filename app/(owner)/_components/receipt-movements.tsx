"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";
import { formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type { CashMovementList, FinanceSummaryResponse } from "@/lib/types/finance";

export function ReceiptMovements({ period, onOpen, revision = 0 }: {
  period: FinanceSummaryResponse["period"];
  onOpen: (appointmentId: string) => void;
  revision?: number;
}) {
  const { locale, t } = useLocale();
  const f = t.finance;
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ key: string; data: CashMovementList | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { from, to, collaboratorId } = period;
  const key = [from, to, collaboratorId, revision, page, attempt].join("/");
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<CashMovementList>("/finance/cash-movements", {
      query: { from, to, collaboratorId, page }, signal: controller.signal,
    }).then((data) => {
      if (!controller.signal.aborted) setResult({ key, data });
    }, () => { if (!controller.signal.aborted) setResult({ key, data: null }); });
    return () => controller.abort();
  }, [from, to, collaboratorId, page, key]);

  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const data = result?.key === key ? result.data : undefined;

  return (
    <section className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xs">
      <h3 className="border-b border-border-subtle px-5 py-4 text-sm font-semibold text-ink">{f.cashMovements}</h3>
      {data === undefined ? <p role="status" className="px-5 py-3 text-xs text-ink-muted">{t.common.loading}</p>
        : data === null ? (
          <p role="alert" className="px-5 py-3 text-xs">
            {t.errors.networkDescription}{" "}
            <Button type="button" size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              {t.common.retry}
            </Button>
          </p>
        ) : !data.items.length ? <p className="px-5 py-3 text-xs text-ink-muted">{f.historyEmpty}</p> : (
          <ul className="divide-y divide-border-subtle">
            {data.items.map((item) => (
              <li key={item.id} className="grid items-center gap-2 px-4 py-3 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div>
                  <p className="font-semibold text-ink">{item.clientName ?? t.executive.productSale} · {item.serviceName}</p>
                  <p className="mt-1 text-ink-muted">
                    {dateFormat.format(new Date(item.effectiveOn))} · {f.paymentMethods[item.method]} ·{" "}
                    {item.reversal ? f.refundRecorded : f.receiptRecorded}
                  </p>
                </div>
                <span className="font-semibold text-ink tabular-nums">
                  {formatPriceFromCents(item.reversal ? -item.amountInCents : item.amountInCents, locale, item.currency)}
                </span>
                {item.appointmentId && <Button variant="ghost" size="sm" type="button"
                  onClick={() => { if (item.appointmentId) onOpen(item.appointmentId); }}>{f.paymentHistory}</Button>}
              </li>
            ))}
          </ul>
        )}
      {(page > 1 || data?.hasMore) && (
        <div className="flex justify-end gap-2 border-t border-border-subtle p-3">
          {page > 1 && <Button type="button" variant="outline" size="sm" onClick={() => setPage(page - 1)}>{t.common.back}</Button>}
          {data?.hasMore && <Button type="button" variant="outline" size="sm" onClick={() => setPage(page + 1)}>{f.moreMovements}</Button>}
        </div>
      )}
    </section>
  );
}
