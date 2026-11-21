"use client";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/locale-context";
import type { CommissionDeduction, CommissionProfessional } from "@/lib/types/finance";

export function previewCommissionSettlement(professional: CommissionProfessional, paidOn: string) {
  let netCents = professional.payableInCents;
  const deductions = [];
  for (const deduction of professional.deductions) {
    if (deduction.deductedAt > paidOn || netCents <= 0) break;
    const amountCents = Math.min(netCents, deduction.openAmountCents);
    netCents -= amountCents;
    deductions.push({ deduction, amountCents, key: deduction.id });
  }
  return { deductions, netCents };
}

export function FinanceDeductionDetails({ professional, money, paidOn, onRemove }: {
  professional: CommissionProfessional;
  money: (cents: number) => string;
  paidOn?: string;
  onRemove?: (deduction: CommissionDeduction) => void;
}) {
  const { locale, t } = useLocale();
  const f = t.finance;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" });
  const number = new Intl.NumberFormat(locale);
  const open = paidOn ? previewCommissionSettlement(professional, paidOn).deductions : professional.deductions.map((deduction) => ({
    deduction, amountCents: deduction.openAmountCents, key: deduction.id,
  }));

  function list(title: string, items: { deduction: CommissionDeduction; amountCents: number; key: string }[], removable = false) {
    return (
      <div>
        <h4 className="font-semibold">{title}</h4>
        {items.length === 0 ? <p className="mt-1 text-ink-muted">{f.noDeductions}</p> : (
          <ul className="mt-1 divide-y divide-border-subtle">
            {items.map(({ deduction, amountCents, key }) => (
              <li key={key} className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2">
                <div className="min-w-0 break-words">
                  <p className="font-medium">{deduction.description}</p>
                  <p className="text-ink-muted">
                    {f.deductionCategories[deduction.category]} · {date.format(new Date(deduction.deductedAt))}
                    {" · "}{number.format(deduction.quantity)} {f.unitsShort}
                    {deduction.unitAmountCents !== null && " × " + money(deduction.unitAmountCents)}
                  </p>
                  {deduction.notes && <p className="text-ink-secondary">{deduction.notes}</p>}
                  {removable && amountCents < deduction.amountCents && (
                    <p className="text-ink-secondary">{f.deductionBalance} · {money(amountCents)}</p>
                  )}
                </div>
                <div className="flex items-start gap-2">
                  <strong className="tabular-nums">{money(amountCents)}</strong>
                  {removable && deduction.externalSourceType === "INVENTORY_MOVEMENT" && (
                    <p className="text-ink-muted">{t.executive.linkedInventory}</p>
                  )}
                  {removable && onRemove && amountCents === deduction.amountCents &&
                    deduction.externalSourceType !== "INVENTORY_MOVEMENT" && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => onRemove(deduction)}>
                      {f.deleteDeduction}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl bg-subtle p-3 text-xs sm:col-span-2">
      {list(paidOn ? f.deductionsThisSettlement : f.openDeductions, open, !paidOn)}
      {!paidOn && list(f.appliedDeductions, professional.appliedDeductions.map((entry) => ({
        ...entry, key: entry.settlementId + "/" + entry.deduction.id,
      })))}
    </div>
  );
}
