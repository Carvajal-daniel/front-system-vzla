"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiRequest } from "@/lib/api-client";
import { getTodayIsoDateInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  commissionDeductionCategories, expenseCategories, paymentMethods, type CommissionDeduction,
  type CommissionDeductionCategory, type CommissionProfessional, type ExpenseCategory,
  type ExpenseType, type FinanceExpense, type PaymentMethod,
} from "@/lib/types/finance";
import { formatFinanceRange, type FinanceRange } from "./finance-report-data";
import { FinanceDeductionDetails, previewCommissionSettlement } from "./finance-deduction-details";

export type DeductionProfessional = { collaboratorId: string; name: string };

export type FinanceOperation =
  | { kind: "create" }
  | { kind: "edit"; expense: FinanceExpense }
  | { kind: "pay"; expense: FinanceExpense }
  | { kind: "remove"; expense: FinanceExpense }
  | { kind: "deduct"; professionals: DeductionProfessional[]; collaboratorId?: string }
  | { kind: "removeDeduction"; deduction: CommissionDeduction }
  | { kind: "settle"; professional: CommissionProfessional; period: FinanceRange };

const control = "h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm text-ink";
const field = "grid gap-1 text-xs font-medium text-ink-secondary";
const settlementMethods = ["PIX", "CASH", "TRANSFER"] as const satisfies readonly PaymentMethod[];

function parseUnitAmount(value: string) {
  const text = value.trim();
  if (!/^\d{1,8}(?:[,.]\d{1,2})?$/.test(text)) return 0;
  const [whole, fraction = ""] = text.split(/[,.]/);
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function FinanceOperationDialog({ operation, timezone, money, onClose, onSaved }: {
  operation: FinanceOperation;
  timezone: string;
  money: (cents: number) => string;
  onClose: () => void;
  onSaved: (notice: string, expense?: FinanceExpense) => void;
}) {
  const { locale, t } = useLocale();
  const f = t.finance;
  const x = t.executive;
  const editing = operation.kind === "edit" ? operation.expense : null;
  const today = getTodayIsoDateInTimezone(timezone);
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const submitting = useRef(false);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [quantity, setQuantity] = useState(String(editing?.quantity ?? 1));
  const [unitAmount, setUnitAmount] = useState(editing ? ((editing.unitAmountCents ?? editing.amountCents) / 100).toFixed(2) : "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(editing?.category ?? "OTHER");
  const [deductionCategory, setDeductionCategory] = useState<CommissionDeductionCategory>("STOCK_PRODUCT");
  const [professionalId, setProfessionalId] = useState(operation.kind === "deduct" ? operation.collaboratorId ?? "" : "");
  const [expenseType, setExpenseType] = useState<ExpenseType>(editing?.expenseType ?? "VARIABLE");
  const [method, setMethod] = useState<PaymentMethod>(editing?.paymentMethod ?? (operation.kind === "settle" ? "PIX" : "CASH"));
  const [recurring, setRecurring] = useState(editing?.isRecurring ?? false);
  const [dueDate, setDueDate] = useState(editing?.dueDate ?? today);
  const [paidOn, setPaidOn] = useState(editing?.paidOn ?? today);
  const [paid, setPaid] = useState(editing?.status === "PAID");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { kind } = operation;
  const unitAmountCents = parseUnitAmount(unitAmount);
  const units = Number(quantity);
  const totalCents = units * unitAmountCents;
  const validTotal = Number.isInteger(units) && units >= 1 && totalCents > 0 && totalCents <= 2147483647;
  const removing = kind === "remove" || kind === "removeDeduction";
  const expenseFields = kind === "create" || kind === "edit";
  const inventoryLinked = editing?.externalSourceType === "INVENTORY_MOVEMENT";
  const titles = { create: f.registerExpense, edit: x.editExpense, pay: f.markPaid, remove: f.deleteExpense, settle: f.settleBatch,
    deduct: f.deductionAction, removeDeduction: f.deleteDeduction };
  const settlementAmount = operation.kind === "settle" ? previewCommissionSettlement(operation.professional, date).netCents : 0;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      function withRequestKey(payload: object) {
        const fingerprint = JSON.stringify(payload);
        if (request.current?.fingerprint !== fingerprint) {
          request.current = { fingerprint, key: crypto.randomUUID() };
        }
        return { ...payload, requestKey: request.current.key };
      }
      if (operation.kind === "create" || operation.kind === "edit") {
        if (!validTotal) { setError(f.FINANCE_INVALID_AMOUNT); return; }
        const fields = { description: description.trim(), expenseType, dueDate,
          notes: notes.trim() || null, isRecurring: recurring };
        if (operation.kind === "edit") {
          const expense = await apiRequest<FinanceExpense>("/finance/expenses/" + operation.expense.id, { method: "PATCH", body: {
            ...fields, ...(inventoryLinked ? {} : { category, quantity: units, unitAmountCents }),
            status: paid ? "PAID" : "PENDING", paymentMethod: paid ? method : null, paidOn: paid ? paidOn : null,
          } });
          onSaved(x.expenseUpdated, expense);
        } else {
          const expense = await apiRequest<FinanceExpense>("/finance/expenses", { method: "POST", body: withRequestKey({
            ...fields, category, quantity: units, unitAmountCents,
          }) });
          onSaved(f.expenseSaved, expense);
        }
      } else if (operation.kind === "deduct") {
        if (!validTotal) { setError(f.FINANCE_INVALID_AMOUNT); return; }
        await apiRequest("/finance/commission-deductions", { method: "POST", body: withRequestKey({
          collaboratorId: professionalId, category: deductionCategory, description: description.trim(),
          quantity: units, unitAmountCents, deductedAt: date, notes: notes.trim() || null,
        }) });
        onSaved(f.deductionSaved);
      } else if (operation.kind === "removeDeduction") {
        await apiRequest("/finance/commission-deductions/" + operation.deduction.id, { method: "DELETE" });
        onSaved(f.deductionDeleted);
      } else if (operation.kind === "settle") {
        await apiRequest("/finance/commission-settlements", { method: "POST", body: withRequestKey({
          collaboratorId: operation.professional.collaboratorId, periodStart: operation.period.from,
          periodEnd: operation.period.to, expectedAmountCents: settlementAmount,
          paymentMethod: settlementAmount === 0 ? "OTHER" : method, paidOn: date, notes: notes.trim() || null,
        }) });
        onSaved(f.appliedSettlement);
      } else if (operation.kind === "pay") {
        const expense = await apiRequest<FinanceExpense>("/finance/expenses/" + operation.expense.id + "/pay", {
          method: "PATCH", body: { paidOn: date, paymentMethod: method },
        });
        onSaved(f.expenseWasPaid, expense);
      } else {
        await apiRequest("/finance/expenses/" + operation.expense.id, { method: "DELETE" });
        onSaved(f.expenseDeleted);
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "";
      setError(message.startsWith("FINANCE_") && Object.hasOwn(x, message) ? String(x[message as keyof typeof x])
        : message.startsWith("FINANCE_") && Object.hasOwn(f, message)
          ? String(f[message as keyof typeof f]) : t.errors.unexpectedDescription);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="finance-operation-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[min(94vw,34rem)] overflow-y-auto rounded-2xl border border-border-strong bg-surface p-4 text-ink shadow-xl [color-scheme:light] backdrop:bg-slate-950/55 sm:p-6 dark:[color-scheme:dark]">
      <div className="mb-4 flex items-center justify-between">
        <h2 id="finance-operation-title" className="text-lg font-semibold">{titles[kind]}</h2>
        <Button variant="ghost" size="icon-sm" type="button" aria-label={t.common.close} disabled={busy} onClick={onClose}>
          <X aria-hidden="true" />
        </Button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          {operation.kind === "deduct" && (
            <>
              <label className={field}>{f.colProfessional}
                <select required value={professionalId} onChange={(event) => setProfessionalId(event.target.value)} className={control}>
                  <option value="" disabled>{f.chooseDeductionProfessional}</option>
                  {operation.professionals.map((person) => (
                    <option key={person.collaboratorId} value={person.collaboratorId}>{person.name}</option>
                  ))}
                </select>
              </label>
              <label className={field}>{f.deductionCategory}
                <select value={deductionCategory} onChange={(event) => setDeductionCategory(event.target.value as CommissionDeductionCategory)}
                  className={control}>
                  {commissionDeductionCategories.map((value) => <option key={value} value={value}>{f.deductionCategories[value]}</option>)}
                </select>
              </label>
            </>
          )}
          {(expenseFields || kind === "deduct") && (
            <label className={field + " sm:col-span-2"}>{kind === "deduct" ? f.deductionDescription : f.expenseDescription}
              <Input required maxLength={240} placeholder={kind === "deduct" ? f.deductionExample : undefined}
                value={description} onChange={(event) => setDescription(event.target.value)} className={control} />
            </label>
          )}
          {expenseFields && (
            <>
              <label className={field + " sm:col-span-2"}>{f.expenseCategory}
                <select value={category} disabled={inventoryLinked} onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
                  className={control + (category === "STOCK_PURCHASE" ? " border-accent" : "")}>
                  {expenseCategories.map((value) => <option key={value} value={value}>{f.expenseCategories[value]}</option>)}
                </select>
              </label>
              <label className={field}>{f.expenseType}
                <select value={expenseType} onChange={(event) => setExpenseType(event.target.value as ExpenseType)} className={control}>
                  <option value="FIXED">{f.expenseFixed}</option><option value="VARIABLE">{f.expenseVariable}</option>
                </select>
              </label>
            </>
          )}
          {(expenseFields || kind === "deduct") && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <label className={field}>{f.quantity}
                  <Input required type="number" disabled={inventoryLinked} min={1} max={2147483647} step={1}
                    value={quantity} onChange={(event) => setQuantity(event.target.value)} className={control} />
                </label>
                <label className={field}>{f.unitAmount}
                  <Input required inputMode="decimal" disabled={inventoryLinked} value={unitAmount} onChange={(event) => setUnitAmount(event.target.value)} className={control} />
                </label>
              </div>
              <p className="flex items-center justify-between rounded-lg bg-subtle px-3 py-2 text-sm sm:col-span-2">
                <span>{f.totalAmount}</span>
                <output aria-live="polite" className="font-semibold tabular-nums">{validTotal ? money(totalCents) : "—"}</output>
              </p>
            </>
          )}
          {expenseFields && (
            <label className="flex items-center gap-2 text-xs sm:col-span-2">
              <input type="checkbox" className="accent-accent" checked={recurring} onChange={(event) => setRecurring(event.target.checked)} />
              {f.expenseRecurring}
            </label>
          )}
          {operation.kind === "settle" && (
            <div className="rounded-xl bg-subtle p-3 text-sm sm:col-span-2">
              <p className="font-semibold">{operation.professional.name}</p>
              <p className="mt-1 text-xs text-ink-secondary">{f.settlementPeriod} · {formatFinanceRange(operation.period, locale)}</p>
              <p className="mt-1 text-xs text-ink-secondary">{f.settlementReview}</p>
            </div>
          )}
          {operation.kind === "settle" && (
            <>
              <FinanceDeductionDetails professional={operation.professional} money={money} paidOn={date} />
              <p className="flex justify-between rounded-lg bg-subtle px-3 py-2 text-sm sm:col-span-2">
                {f.netPayable}<output className="font-semibold tabular-nums">{money(settlementAmount)}</output>
              </p>
            </>
          )}
          {(operation.kind === "remove" || operation.kind === "pay") && (
            <div className="rounded-xl bg-subtle p-3 text-sm sm:col-span-2">
              <p className="font-semibold">{operation.expense.description} · {money(operation.expense.amountCents)}</p>
              {kind === "remove" && <p className="mt-1 text-xs text-ink-secondary">{x.deleteExpenseImpact}</p>}
            </div>
          )}
          {operation.kind === "removeDeduction" && (
            <div className="rounded-xl bg-subtle p-3 text-sm sm:col-span-2">
              <p className="font-semibold">{operation.deduction.description} · {money(operation.deduction.amountCents)}</p>
              <p className="mt-1 text-xs text-ink-secondary">{f.deleteDeductionConfirm}</p>
            </div>
          )}
          {expenseFields && (
            <label className={field}>{f.expenseDue}
              <Input type="date" required max="9999-12-31" value={dueDate}
                onChange={(event) => setDueDate(event.target.value)} className={control} />
            </label>
          )}
          {kind === "edit" && (
            <label className={field}>{f.expenseStatus}
              <select className={control} value={paid ? "PAID" : "PENDING"} onChange={(event) => setPaid(event.target.value === "PAID")}>
                <option value="PENDING">{f.expensePending}</option>
                <option value="PAID">{f.expensePaid}</option>
              </select>
            </label>
          )}
          {!removing && (!expenseFields || (kind === "edit" && paid)) && (
            <label className={field}>{kind === "deduct" ? f.deductionDate : f.expensePaidOn}
              <Input type="date" required max={today} value={kind === "edit" ? paidOn : date}
                onChange={(event) => (kind === "edit" ? setPaidOn : setDate)(event.target.value)}
                className={control} />
            </label>
          )}
          {(kind === "pay" || (kind === "edit" && paid) || (kind === "settle" && settlementAmount > 0)) && (
            <label className={field}>{f.method}
              <select className={control} value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
                {(kind === "settle" ? settlementMethods : paymentMethods)
                  .map((value) => <option key={value} value={value}>{f.paymentMethods[value]}</option>)}
              </select>
            </label>
          )}
          {(expenseFields || kind === "settle" || kind === "deduct") && (
            <label className={field + " sm:col-span-2"}>{f.financeNotes}
              <textarea rows={2} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)}
                className={control + " h-auto resize-y py-2"} />
            </label>
          )}
        </fieldset>
        {error && <p role="alert" className="text-sm text-[var(--status-danger-ink)]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t.common.cancel}</Button>
          <Button type="submit" variant={removing ? "destructive" : "default"} disabled={busy}>
            {busy ? t.common.saving : removing ? titles[kind] : t.common.save}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
