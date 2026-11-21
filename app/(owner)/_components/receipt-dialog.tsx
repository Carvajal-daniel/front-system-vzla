"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Wallet, X } from "lucide-react";
import { PaidBadge } from "@/components/ui/agenda-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiRequest } from "@/lib/api-client";
import { isAppointmentPaid } from "@/lib/agenda";
import { formatDateTimeInTimezone, formatPriceFromCents, getTodayIsoDateInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { agendaStrings } from "@/lib/i18n/agenda";
import {
  paymentMethods, type AppointmentCollections, type FinanceAppointment, type PaymentMethod,
} from "@/lib/types/finance";

const disabledCursor = "disabled:pointer-events-auto disabled:cursor-not-allowed";
const control = `h-10 w-full rounded-xl border border-border-strong bg-surface px-3 text-sm text-ink ${disabledCursor}`;
const choice = `${control} cursor-pointer`;
const optionCursor = "cursor-pointer disabled:cursor-not-allowed";
const actionCursor = `cursor-pointer ${disabledCursor}`;
type Candidate = Pick<FinanceAppointment, "id" | "clientName" | "serviceName" | "startsAt">;

function toCents(text: string) {
  if (!/^\d{1,8}(?:[,.]\d{1,2})?$/.test(text.trim())) return 0;
  const [whole, fractional = ""] = text.trim().split(/[,.]/);
  return Number(whole) * 100 + Number(fractional.padEnd(2, "0"));
}

function currencyInput(cents: number) {
  return (Math.max(0, cents) / 100).toFixed(2);
}

export function ReceiptDialog({ appointmentId, candidates = [], timezone, onClose, onChanged }: {
  appointmentId?: string;
  candidates?: Candidate[];
  timezone: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { locale, t } = useLocale();
  const f = t.finance;
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(appointmentId ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);

  return (
    <dialog ref={dialog}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      aria-labelledby="receipt-dialog-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[min(94vw,42rem)] overflow-y-auto rounded-2xl border border-border-strong bg-surface p-4 text-ink shadow-2xl backdrop:bg-slate-950/55 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id="receipt-dialog-title" className="flex items-center gap-2 text-lg font-semibold">
          <Wallet className="size-5 text-accent" aria-hidden="true" />{f.registerReceipt}
        </h2>
        <Button variant="ghost" size="icon-sm" type="button" aria-label={t.common.close} className={actionCursor}
          onClick={onClose} disabled={busy}><X aria-hidden="true" /></Button>
      </div>
      {!appointmentId && candidates.length > 0 && (
        <div className="mb-4 space-y-1">
          <Label htmlFor="receipt-appointment">{f.chooseAppointment}</Label>
          <select id="receipt-appointment" className={choice} value={selected} disabled={busy}
            onChange={(event) => setSelected(event.target.value)}>
            <option value="" className={optionCursor}>{f.chooseAppointment}</option>
            {candidates.map((item) => (
              <option key={item.id} value={item.id} className={optionCursor}>
                {item.clientName} · {item.serviceName} · {formatDateTimeInTimezone(item.startsAt, timezone, locale)}
              </option>
            ))}
          </select>
        </div>
      )}
      {selected ? (
        <ReceiptAppointment key={selected} appointmentId={selected} timezone={timezone}
          onChanged={onChanged} onBusy={setBusy} />
      ) : !candidates.length && <p className="text-sm text-ink-muted">{f.noEligible}</p>}
    </dialog>
  );
}

function ReceiptAppointment({ appointmentId, timezone, onChanged, onBusy }: {
  appointmentId: string;
  timezone: string;
  onChanged?: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useLocale();
  const [data, setData] = useState<AppointmentCollections | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<AppointmentCollections>("/finance/appointments/" + appointmentId, { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) { setData(response); setLoadFailed(false); }
      }, () => { if (!controller.signal.aborted) setLoadFailed(true); });
    return () => controller.abort();
  }, [appointmentId, version]);

  if (loadFailed) return (
    <p role="alert" className="text-sm">{t.errors.networkDescription}{" "}
      <Button type="button" variant="outline" className={actionCursor} onClick={() => { setLoadFailed(false); setVersion((v) => v + 1); }}>
        {t.common.retry}
      </Button>
    </p>
  );
  if (!data) return <p role="status" className="text-sm text-ink-muted">{t.common.loading}</p>;
  return <ReceiptDetails data={data} timezone={timezone} onBusy={onBusy} onChanged={() => {
    setVersion((v) => v + 1);
    onChanged?.();
  }} />;
}

function ReceiptDetails({ data, timezone, onChanged, onBusy }: {
  data: AppointmentCollections;
  timezone: string;
  onChanged: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const { locale, t } = useLocale();
  const f = t.finance;
  const today = getTodayIsoDateInTimezone(timezone);
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState(() => currencyInput(data.openInCents));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [split, setSplit] = useState(false);
  const [otherAmount, setOtherAmount] = useState("");
  const [otherMethod, setOtherMethod] = useState<PaymentMethod>("PIX");
  const [refund, setRefund] = useState<{ id: string; amount: string; reason: string; date: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const idempotency = useRef<{ payload: string; key: string } | null>(null);
  const submitting = useRef(false);
  const money = (cents: number) => formatPriceFromCents(cents, locale, data.currency);
  const localDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  async function send(path: string, payload: object, success: string) {
    if (submitting.current) return;
    submitting.current = true;
    const fingerprint = JSON.stringify([path, payload]);
    setSending(true);
    onBusy(true);
    setNotice("");
    setError("");
    try {
      if (idempotency.current?.payload !== fingerprint) {
        idempotency.current = { payload: fingerprint, key: crypto.randomUUID() };
      }
      await apiRequest(path, {
        method: "POST",
        body: { ...payload, requestKey: idempotency.current.key },
      });
      idempotency.current = null;
      setRefund(null);
      setSplit(false);
      setAmount("");
      setOtherAmount("");
      setNotice(success);
      onChanged();
    } catch (err) {
      const code = err instanceof ApiError ? err.message : "";
      setError(code.startsWith("FINANCE_") && Object.hasOwn(f, code)
        ? String(f[code as keyof typeof f]) : t.errors.unexpectedDescription);
    } finally {
      submitting.current = false;
      setSending(false);
      onBusy(false);
    }
  }

  function submitReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payments = [{ method, amountInCents: toCents(amount) }];
    if (split) payments.push({ method: otherMethod, amountInCents: toCents(otherAmount) });
    if (payments.some((item) => item.amountInCents < 1) ||
        payments.reduce((sum, item) => sum + item.amountInCents, 0) > data.openInCents ||
        (split && method === otherMethod)) {
      setError(f.FINANCE_AMOUNT_EXCEEDS_BALANCE);
      return;
    }
    void send("/finance/receipts", { appointmentId: data.appointmentId, effectiveOn: date, payments }, f.appliedReceipt);
  }

  function submitRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!refund) return;
    const amountInCents = toCents(refund.amount);
    const original = data.receipts.find((item) => item.id === refund.id);
    if (amountInCents < 1 || !original || amountInCents > original.refundableInCents) {
      setError(f.FINANCE_AMOUNT_EXCEEDS_BALANCE);
      return;
    }
    if (!refund.reason.trim()) { setError(f.FINANCE_REFUND_REASON_REQUIRED); return; }
    void send("/finance/receipts/" + refund.id + "/refunds",
      { amountInCents, effectiveOn: refund.date, reason: refund.reason.trim() }, f.appliedRefund);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">{data.clientName} · {data.serviceName}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-secondary">{t.status[data.status]}</span>
          {isAppointmentPaid(data) && <PaidBadge label={agendaStrings(locale).paid} />}
        </div>
        {data.historical && <p className="mt-1 text-xs text-ink-muted">{f.legacy}</p>}
      </div>
      <dl className="grid gap-2 rounded-xl bg-subtle p-3 text-xs tabular-nums sm:grid-cols-3">
        {[[f.gross, data.netInCents], [f.collected, data.collectedInCents],
          [data.retainedInCents ? f.retained : f.outstanding, data.retainedInCents || data.openInCents]].map(([label, value]) => (
          <div key={label}><dt className="text-ink-secondary">{label}</dt><dd className="mt-1 text-sm font-semibold">{money(Number(value))}</dd></div>
        ))}
      </dl>
      {data.retainedInCents > 0 && <p className="text-xs text-ink-muted">{f.retainedHint}</p>}
      {error && <p role="alert" className="text-sm text-[var(--status-danger-ink)]">{error}</p>}
      {notice && <p role="status" className="text-sm text-accent">{notice}</p>}
      {data.canCollect && !refund && (
        <form onSubmit={submitReceipt} className="space-y-3 rounded-xl border border-border-subtle p-3">
          <fieldset disabled={sending} className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs"><span>{f.method}</span>
              <select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className={choice}>
                {paymentMethods.map((item) => <option key={item} value={item} className={optionCursor}>{f.paymentMethods[item]}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs"><span>{f.amount} · {data.currency}</span>
              <Input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className={control} />
            </label>
            <label className="space-y-1 text-xs"><span>{f.effectiveOn}</span>
              <Input required type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} className={choice} />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <Button type="button" size="sm" variant="outline" className={actionCursor} onClick={() => {
                if (split) setOtherAmount(currencyInput(data.openInCents - toCents(amount)));
                else setAmount(currencyInput(data.openInCents));
              }}>{f.useRemainder}</Button>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs has-disabled:cursor-not-allowed sm:col-span-2">
              <input type="checkbox" className="cursor-pointer accent-accent disabled:cursor-not-allowed" checked={split} onChange={(event) => setSplit(event.target.checked)} />{f.split}
            </label>
            {split && <>
              <label className="space-y-1 text-xs"><span>{f.secondMethod}</span>
                <select value={otherMethod} onChange={(event) => setOtherMethod(event.target.value as PaymentMethod)} className={choice}>
                  {paymentMethods.map((item) => <option key={item} value={item} disabled={method === item} className={optionCursor}>{f.paymentMethods[item]}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs"><span>{f.amount} · {data.currency}</span>
                <Input required inputMode="decimal" value={otherAmount} onChange={(event) => setOtherAmount(event.target.value)} className={control} />
              </label>
            </>}
          </fieldset>
          <Button type="submit" disabled={sending} className={actionCursor}>{sending ? t.common.saving : f.saveReceipt}</Button>
        </form>
      )}

      <section aria-label={f.paymentHistory}>
        <h3 className="text-sm font-semibold">{f.paymentHistory}</h3>
        {!data.receipts.length ? <p className="mt-2 text-sm text-ink-muted">{f.historyEmpty}</p> : (
          <ul className="mt-2 divide-y divide-border-subtle">
            {data.receipts.map((item) => (
              <li key={item.id} className="space-y-2 py-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <div>
                    <p className="font-semibold">
                      {item.reversesReceiptId ? f.refundRecorded : f.receiptRecorded} · {f.paymentMethods[item.method]}
                    </p>
                    <p className="mt-1 text-ink-muted">
                      {localDate.format(new Date(item.effectiveOn))} · {f.recordedBy} {formatDateTimeInTimezone(item.recordedAt, timezone, locale)}
                    </p>
                    {item.reason && <p className="mt-1 text-ink-secondary">{item.reason}</p>}
                  </div>
                  <span className="font-semibold tabular-nums">{money(item.reversesReceiptId ? -item.amountInCents : item.amountInCents)}</span>
                </div>
                {item.refundableInCents > 0 && refund?.id !== item.id &&
                  <Button type="button" size="sm" variant="outline" disabled={sending} className={actionCursor} onClick={() => setRefund({
                    id: item.id, amount: currencyInput(item.refundableInCents), reason: "", date: today,
                  })}>{f.refund}</Button>}
                {refund?.id === item.id && (
                  <form className="space-y-2 rounded-lg border border-border-subtle p-3" onSubmit={submitRefund}>
                    <p className="font-medium">{f.refundAvailable} · {money(item.refundableInCents)}</p>
                    <fieldset disabled={sending} className="grid gap-2 sm:grid-cols-2">
                      <label className="space-y-1"><span>{f.amount} · {data.currency}</span>
                        <Input required inputMode="decimal" className={disabledCursor} value={refund.amount} onChange={(event) => setRefund({ ...refund, amount: event.target.value })} />
                      </label>
                      <label className="space-y-1"><span>{f.effectiveOn}</span>
                        <Input required type="date" className={actionCursor} min={item.effectiveOn} max={today} value={refund.date} onChange={(event) => setRefund({ ...refund, date: event.target.value })} />
                      </label>
                      <label className="space-y-1 sm:col-span-2"><span>{f.refundReason}</span>
                        <Input required maxLength={500} className={disabledCursor} value={refund.reason} onChange={(event) => setRefund({ ...refund, reason: event.target.value })} />
                      </label>
                    </fieldset>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={sending} className={actionCursor}>{f.refund}</Button>
                      <Button type="button" variant="outline" disabled={sending} className={actionCursor} onClick={() => setRefund(null)}>{t.common.cancel}</Button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
