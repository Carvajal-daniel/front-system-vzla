"use client";

import { Printer } from "lucide-react";
import { formatDateTimeInTimezone, formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import type { Currency, PaymentMethod } from "@/lib/types/finance";
import "./receipt-print.css";

export interface PrintableReceiptItem {
  id: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  collaboratorName?: string | null;
}

export interface PrintableReceiptPayment {
  id: string;
  method: PaymentMethod;
  amountCents: number;
  paidAt?: string;
}

export interface PrintableReceiptData {
  companyName: string;
  companyPhone?: string | null;
  companyDocument?: string | null;
  receiptCode: string;
  issuedAt: string;
  clientName: string;
  clientPhone?: string | null;
  clientDocument?: string | null;
  professionals: string[];
  items: PrintableReceiptItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paidCents: number;
  openInCents: number;
  payments: PrintableReceiptPayment[];
  notes?: string | null;
  currency: Currency | string;
  timezone: string;
}

export function PrintableReceipt({ data }: { data: PrintableReceiptData }) {
  const { locale, t } = useLocale();
  const isEs = locale === "es";
  const money = (cents: number) => formatPriceFromCents(cents, locale, data.currency);
  const isPaid = data.openInCents <= 0 && (data.totalCents === 0 || data.paidCents > 0);

  return (
    <div className="space-y-3">
      <div className="receipt-print-sheet rounded-2xl border border-border-subtle bg-surface p-4 sm:p-5 text-xs text-ink space-y-4">
        {/* Cabeçalho da Empresa */}
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-3">
          <div className="space-y-0.5">
            <h3 className="text-base font-bold tracking-tight text-ink">{data.companyName}</h3>
            {data.companyPhone && (
              <p className="text-[11px] text-ink-secondary font-mono">{data.companyPhone}</p>
            )}
            {data.companyDocument && (
              <p className="text-[11px] text-ink-muted">
                {isEs ? "Doc. Fiscal:" : "Doc. Fiscal:"} {data.companyDocument}
              </p>
            )}
          </div>

          <div className="text-right space-y-0.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              {isEs ? "Comprobante / Recibo" : "Comprovante / Recibo"}
            </p>
            <p className="font-mono text-sm font-bold text-ink">{data.receiptCode}</p>
            <p className="text-[11px] text-ink-secondary tabular-nums">
              {isEs ? "Emitido:" : "Emitido em:"}{" "}
              {formatDateTimeInTimezone(data.issuedAt, data.timezone, locale)}
            </p>
          </div>
        </header>

        {/* Dados do Cliente e Profissionais */}
        <section className="grid gap-3 sm:grid-cols-2 rounded-xl bg-subtle/60 p-3">
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              {isEs ? "Cliente" : "Cliente"}
            </p>
            <p className="font-semibold text-ink">{data.clientName}</p>
            {data.clientPhone && (
              <p className="text-[11px] font-mono text-ink-secondary">{data.clientPhone}</p>
            )}
            {data.clientDocument && (
              <p className="text-[11px] text-ink-muted">{data.clientDocument}</p>
            )}
          </div>

          <div className="space-y-0.5 sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              {isEs ? "Profesional(es)" : "Profissional(is)"}
            </p>
            <p className="font-semibold text-ink">
              {data.professionals.length > 0 ? data.professionals.join(", ") : "—"}
            </p>
            <div className="pt-1">
              <span
                className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                  isPaid
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                {isPaid
                  ? isEs
                    ? "Pagado"
                    : "Pago"
                  : isEs
                    ? `Saldo pendiente: ${money(data.openInCents)}`
                    : `Saldo pendente: ${money(data.openInCents)}`}
              </span>
            </div>
          </div>
        </section>

        {/* Tabela detalhada de Serviços e Produtos */}
        <section className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border-subtle text-[11px] text-ink-muted">
              <tr>
                <th className="py-2 pr-2 font-semibold">
                  {isEs ? "Servicio / Producto" : "Serviço / Produto"}
                </th>
                <th className="py-2 px-2 text-center font-semibold">
                  {isEs ? "Cant." : "Qtd"}
                </th>
                <th className="py-2 px-2 text-right font-semibold">
                  {isEs ? "Unitario" : "Unitário"}
                </th>
                <th className="py-2 pl-2 text-right font-semibold">
                  {isEs ? "Subtotal" : "Subtotal"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/60">
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 pr-2">
                    <p className="font-medium text-ink">{item.name}</p>
                    {item.collaboratorName && (
                      <p className="text-[10px] text-ink-muted">{item.collaboratorName}</p>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center tabular-nums text-ink-secondary">
                    {item.quantity}
                  </td>
                  <td className="py-2 px-2 text-right tabular-nums text-ink-secondary">
                    {money(item.unitPriceCents)}
                  </td>
                  <td className="py-2 pl-2 text-right font-semibold tabular-nums text-ink">
                    {money(item.subtotalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Totais e Descontos */}
        <section className="border-t border-border-subtle pt-3 space-y-1 tabular-nums">
          <div className="flex justify-between text-ink-secondary">
            <span>{isEs ? "Subtotal" : "Subtotal"}</span>
            <span>{money(data.subtotalCents)}</span>
          </div>
          {data.discountCents > 0 && (
            <div className="flex justify-between text-rose-600 dark:text-rose-400">
              <span>{isEs ? "Descuentos" : "Descontos"}</span>
              <span>- {money(data.discountCents)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border-subtle/70 pt-1.5 text-sm font-bold text-ink">
            <span>{isEs ? "Total" : "Total"}</span>
            <span>{money(data.totalCents)}</span>
          </div>
          <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
            <span>{isEs ? "Total Pagado" : "Total Pago"}</span>
            <span>{money(data.paidCents)}</span>
          </div>
          {data.openInCents > 0 && (
            <div className="flex justify-between text-amber-700 dark:text-amber-300 font-semibold">
              <span>{isEs ? "Saldo Pendiente" : "Saldo Pendente"}</span>
              <span>{money(data.openInCents)}</span>
            </div>
          )}
        </section>

        {/* Formas de Pagamento */}
        <section className="border-t border-border-subtle pt-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            {isEs ? "Forma(s) de Pago" : "Forma(s) de Pagamento"}
          </p>
          {data.payments.length > 0 ? (
            <ul className="space-y-1">
              {data.payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">
                    {t.finance.paymentMethods[payment.method] ?? payment.method}
                  </span>
                  <span className="font-semibold tabular-nums text-ink">
                    {money(payment.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-ink-muted">
              {isEs ? "Sin pagos registrados todavía." : "Nenhum pagamento registrado até o momento."}
            </p>
          )}
        </section>

        {data.notes && (
          <section className="border-t border-border-subtle pt-2 text-[11px] text-ink-secondary">
            <span className="font-semibold text-ink">{isEs ? "Obs.:" : "Obs.:"}</span> {data.notes}
          </section>
        )}
      </div>

      {/* Botão Imprimir (oculto na impressão) */}
      <div className="no-print flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs"
        >
          <Printer size={14} aria-hidden="true" />
          {isEs ? "Imprimir Recibo" : "Imprimir Recibo"}
        </button>
      </div>
    </div>
  );
}
