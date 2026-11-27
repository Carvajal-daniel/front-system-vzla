"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Receipt, Sparkles, Wallet, X } from "lucide-react";
import { PaidBadge } from "@/components/ui/agenda-status";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiRequest } from "@/lib/api-client";
import { isAppointmentPaid } from "@/lib/agenda";
import { formatDateTimeInTimezone, formatPriceFromCents, getTodayIsoDateInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { agendaStrings } from "@/lib/i18n/agenda";
import { useCompanySettings } from "@/lib/use-company-settings";
import type { Appointment } from "@/lib/types/appointment";
import type { Collaborator } from "@/lib/types/team";
import {
  paymentMethods,
  type AppointmentCollections,
  type FinanceAppointment,
  type PaymentMethod,
  type SavedFinanceOrder,
} from "@/lib/types/finance";
import { PrintableReceipt, type PrintableReceiptData } from "./printable-receipt";

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

export function ReceiptDialog({ appointmentId, order, candidates = [], timezone, onClose, onChanged, closingOrder = false }: {
  appointmentId?: string;
  order?: SavedFinanceOrder;
  candidates?: Candidate[];
  timezone: string;
  onClose: () => void;
  onChanged?: () => void;
  closingOrder?: boolean;
}) {
  const { locale, t } = useLocale();
  const isEs = locale === "es";
  const f = t.finance;
  const { session } = useSession();
  const { settings } = useCompanySettings(session.company.id);
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState(appointmentId ?? "");
  const [busy, setBusy] = useState(false);

  const companyInfo = {
    companyName: session.company.companyName,
    companyPhone: settings.reminders?.servicePhone || session.phone || null,
    companyDocument:
      settings.documents?.businessDoc?.trim() ||
      settings.documents?.personalDoc?.trim() ||
      null,
    currency: session.company.currency ?? "BRL",
  };

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); };
  }, []);

  const orderReceiptData: PrintableReceiptData | null = order
    ? {
        companyName: companyInfo.companyName,
        companyPhone: companyInfo.companyPhone,
        companyDocument: companyInfo.companyDocument,
        receiptCode: order.code.startsWith("#") ? order.code : `#${order.code}`,
        issuedAt: order.createdAt,
        clientName:
          order.clientName?.trim() || (isEs ? "Venta Suelta" : "Venda Avulsa"),
        clientPhone: order.clientPhone,
        clientDocument: order.clientDocument ?? null,
        professionals: Array.from(
          new Set(
            order.items
              .map((item) => item.collaboratorName)
              .filter((name): name is string => Boolean(name)),
          ),
        ),
        items: order.items.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          subtotalCents: item.subtotalCents,
          collaboratorName: item.collaboratorName,
        })),
        subtotalCents: order.subtotalCents,
        discountCents: order.discountCents,
        totalCents: order.totalCents,
        paidCents: order.paidCents,
        openInCents: order.openInCents,
        payments: order.payments.map((p) => ({
          id: p.id,
          method: p.method,
          amountCents: p.amountCents,
          paidAt: p.paidAt,
        })),
        notes: order.notes ?? null,
        currency: companyInfo.currency,
        timezone,
      }
    : null;

  return (
    <dialog ref={dialog}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      aria-labelledby="receipt-dialog-title"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[min(94vw,44rem)] overflow-y-auto rounded-2xl border border-border-strong bg-surface p-4 text-ink shadow-2xl backdrop:bg-slate-950/55 sm:p-6">
      <div className="no-print mb-4 flex items-center justify-between gap-2">
        <h2 id="receipt-dialog-title" className="flex items-center gap-2 text-lg font-semibold">
          {order ? (
            <>
              <Receipt className="size-5 text-accent" aria-hidden="true" />
              {isEs ? "Recibo de Comanda" : "Recibo da Comanda"}
            </>
          ) : (
            <>
              <Wallet className="size-5 text-accent" aria-hidden="true" />
              {closingOrder ? agendaStrings(locale).closeOrder : f.registerReceipt}
            </>
          )}
        </h2>
        <Button variant="ghost" size="icon-sm" type="button" aria-label={t.common.close} className={actionCursor}
          onClick={onClose} disabled={busy}><X aria-hidden="true" /></Button>
      </div>
      {orderReceiptData ? (
        <PrintableReceipt data={orderReceiptData} />
      ) : (
        <>
          {!appointmentId && candidates.length > 0 && (
            <div className="no-print mb-4 space-y-1">
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
            <ReceiptAppointment
              key={selected}
              appointmentId={selected}
              companyInfo={companyInfo}
              timezone={timezone}
              onClose={onClose}
              onChanged={onChanged}
              onBusy={setBusy}
              closingOrder={closingOrder}
            />
          ) : !candidates.length && <p className="text-sm text-ink-muted">{f.noEligible}</p>}
        </>
      )}
    </dialog>
  );
}

function ReceiptAppointment({ appointmentId, companyInfo, timezone, onClose, onChanged, onBusy, closingOrder }: {
  appointmentId: string;
  companyInfo: {
    companyName: string;
    companyPhone: string | null;
    companyDocument: string | null;
    currency: string;
  };
  timezone: string;
  onClose: () => void;
  onChanged?: () => void;
  onBusy: (busy: boolean) => void;
  closingOrder: boolean;
}) {
  const { t } = useLocale();
  const [data, setData] = useState<AppointmentCollections | null>(null);
  const [appointmentMeta, setAppointmentMeta] = useState<{
    clientPhone?: string | null;
    professionalName?: string | null;
    startsAt?: string;
    notes?: string | null;
  } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      apiRequest<AppointmentCollections>("/finance/appointments/" + appointmentId, { signal: controller.signal }),
      apiRequest<Appointment>("/appointments/" + encodeURIComponent(appointmentId), { signal: controller.signal }).catch(() => null),
      apiRequest<{ collaborators?: Collaborator[] } | Collaborator[]>("/collaborators", { signal: controller.signal }).catch(() => []),
    ])
      .then(([response, appDetails, collabsRes]) => {
        if (controller.signal.aborted) return;
        const collabs = Array.isArray(collabsRes) ? collabsRes : collabsRes?.collaborators ?? [];
        const matchedPro = appDetails
          ? collabs.find((c) => c.id === appDetails.collaboratorId)?.name ?? null
          : null;
        setAppointmentMeta({
          clientPhone: appDetails?.clientPhone ?? null,
          professionalName: matchedPro,
          startsAt: appDetails?.startsAt,
          notes: appDetails?.notes ?? null,
        });
        setData(response);
        setLoadFailed(false);
      }, () => {
        if (!controller.signal.aborted) setLoadFailed(true);
      });
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
  return (
    <ReceiptDetails
      data={data}
      companyInfo={companyInfo}
      appointmentMeta={appointmentMeta}
      timezone={timezone}
      onClose={onClose}
      onBusy={onBusy}
      closingOrder={closingOrder}
      onChanged={() => {
        setVersion((v) => v + 1);
        onChanged?.();
      }}
    />
  );
}

function ReceiptDetails({ data, companyInfo, appointmentMeta, timezone, onClose, onChanged, onBusy, closingOrder }: {
  data: AppointmentCollections;
  companyInfo: {
    companyName: string;
    companyPhone: string | null;
    companyDocument: string | null;
    currency: string;
  };
  appointmentMeta: {
    clientPhone?: string | null;
    professionalName?: string | null;
    startsAt?: string;
    notes?: string | null;
  } | null;
  timezone: string;
  onClose: () => void;
  onChanged: () => void;
  onBusy: (busy: boolean) => void;
  closingOrder: boolean;
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
  const [completedForClosure, setCompletedForClosure] = useState(false);
  const money = (cents: number) => formatPriceFromCents(cents, locale, data.currency);
  const localDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

  async function completeForClosure() {
    if (submitting.current) return;
    submitting.current = true;
    setSending(true);
    onBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/appointments/${encodeURIComponent(data.appointmentId)}/status`, {
        method: "PATCH", body: { status: "COMPLETED" },
      });
      setCompletedForClosure(true);
      setNotice(agendaStrings(locale).completedSuccess);
      onChanged();
    } catch {
      setError(t.errors.unexpectedDescription);
    } finally {
      submitting.current = false;
      setSending(false);
      onBusy(false);
    }
  }

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

  const activePayments = data.receipts
    .filter((r) => !r.reversesReceiptId)
    .map((r) => ({
      id: r.id,
      method: r.method,
      amountCents: r.amountInCents,
      paidAt: r.recordedAt,
    }));

  const printableData: PrintableReceiptData = {
    companyName: companyInfo.companyName,
    companyPhone: companyInfo.companyPhone,
    companyDocument: companyInfo.companyDocument,
    receiptCode: `#REC-${data.appointmentId.slice(0, 8).toUpperCase()}`,
    issuedAt: data.receipts[0]?.recordedAt ?? appointmentMeta?.startsAt ?? new Date().toISOString(),
    clientName: data.clientName,
    clientPhone: appointmentMeta?.clientPhone ?? null,
    professionals: appointmentMeta?.professionalName ? [appointmentMeta.professionalName] : [],
    items: [
      {
        id: data.appointmentId,
        name: data.serviceName,
        quantity: 1,
        unitPriceCents: data.netInCents,
        subtotalCents: data.netInCents,
        collaboratorName: appointmentMeta?.professionalName ?? null,
      },
    ],
    subtotalCents: data.netInCents,
    discountCents: 0,
    totalCents: data.netInCents,
    paidCents: data.collectedInCents,
    openInCents: data.openInCents,
    payments: activePayments,
    notes: appointmentMeta?.notes ?? null,
    currency: data.currency,
    timezone,
  };

  return (
    <div className="space-y-4">
      {/* Comprovante imprimível formatado */}
      <PrintableReceipt data={printableData} />

      {/* Banner de Comanda Completa (oculto na impressão e oculto quando já pago/fechado para impedir cobrança duplicada) */}
      {!isAppointmentPaid(data) && data.canCollect && data.openInCents > 0 && (
        <div className="no-print flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs">
          <span className="text-ink">
            {locale === "es"
              ? "Para incluir productos, propina o más detalles en este cobro:"
              : "Para incluir produtos, gorjeta ou mais detalhes nessa cobrança:"}
          </span>
          <Link
            href={`/owner/finance/orders/new?appointmentId=${encodeURIComponent(data.appointmentId)}`}
            onClick={onClose}
            className="inline-flex cursor-pointer items-center gap-1 font-bold text-accent hover:underline shrink-0"
          >
            <span>{locale === "es" ? "Abrir Comanda Completa" : "Abrir Comanda Completa"}</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      )}

      <div className="no-print space-y-4">
        <div>
          <p className="text-sm font-semibold">{data.clientName} · {data.serviceName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-secondary">{t.status[completedForClosure ? "COMPLETED" : data.status]}</span>
            {isAppointmentPaid(data) && <PaidBadge label={agendaStrings(locale).paid} />}
            {closingOrder && data.status === "CONFIRMED" && !completedForClosure && (
              <Button type="button" variant="outline" size="sm" className={actionCursor} disabled={sending}
                onClick={() => void completeForClosure()}>
                {agendaStrings(locale).completeForClosure}
              </Button>
            )}
          </div>
          {data.historical && <p className="mt-1 text-xs text-ink-muted">{f.legacy}</p>}
        </div>
        <dl className="grid gap-2 rounded-xl bg-subtle p-3 text-xs tabular-nums sm:grid-cols-3">
          {[[f.gross, data.netInCents], [f.collected, data.collectedInCents],
            [data.retainedInCents ? f.retained : f.outstanding, data.retainedInCents || data.openInCents]].map(([label, value]) => (
            <div key={label}><dt className="text-ink-secondary">{label}</dt><dd className="mt-1 text-sm font-semibold">{money(Number(value))}</dd></div>
          ))}
        </dl>

        {/* Previsão de fidelidade */}
        {data.openInCents > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-surface-subtle px-3 py-2 text-xs text-ink-secondary">
            <Sparkles size={13} className="text-amber-500" />
            <span>
              {locale === "es" ? (
                <>Este pago generará <strong className="text-ink">{Math.round(data.openInCents / 100)} puntos</strong> de fidelidad para el cliente.</>
              ) : (
                <>Este pagamento gerará <strong className="text-ink">{Math.round(data.openInCents / 100)} pontos</strong> de fidelidade para o cliente.</>
              )}
            </span>
          </div>
        )}
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
    </div>
  );
}
