"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Coins,
  HandCoins,
  History,
  Loader2,
  MinusCircle,
  Package,
  Scissors,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone, formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import type { CommissionDeduction, PaymentMethod } from "@/lib/types/finance";

interface CommissionDetailItem {
  id: string;
  source: "APPOINTMENT" | "ORDER";
  itemType: "SERVICE" | "PRODUCT" | "TIP";
  date: string;
  clientName: string;
  description: string;
  baseAmountCents: number;
  commissionPercentage: number;
  commissionCents: number;
}

interface CommissionSettledBatch {
  id: string;
  paidAt: string;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  paymentMethod: PaymentMethod | null;
  notes: string | null;
  items: CommissionDetailItem[];
}

interface CollaboratorCommissionDetail {
  period: { from: string; to: string };
  collaborator: { id: string; name: string };
  summary: {
    grossPendingCents: number;
    deductionsCents: number;
    alreadyPaidCents: number;
    netPayableCents: number;
  };
  pendingItems: CommissionDetailItem[];
  deductions: CommissionDeduction[];
  settledHistory: CommissionSettledBatch[];
}

interface CommissionDetailDrawerProps {
  collaboratorId: string;
  fromDate: string;
  toDate: string;
  todayIso: string;
  timezone: string;
  currency: string;
  onClose: () => void;
  onSettled: () => void;
}

export function CommissionDetailDrawer({
  collaboratorId,
  fromDate,
  toDate,
  todayIso,
  timezone,
  currency,
  onClose,
  onSettled,
}: CommissionDetailDrawerProps) {
  const { locale } = useLocale();
  const isEs = locale === "es";

  const copy = useMemo(
    () =>
      isEs
        ? {
            title: "Reporte Detallado de Comisiones",
            periodLabel: (from: string, to: string) => `Período: ${from} al ${to}`,
            loading: "Cargando detalle de servicios, productos y liquidaciones...",
            loadError: "Error al cargar el reporte detallado del profesional.",
            kpiGrossPending: "Bruto Pendiente",
            kpiDeductions: "Vales / Descuentos",
            kpiAlreadyPaid: "Ya Liquidado en el Período",
            kpiNetPayable: "Saldo Neto a Pagar",
            tabPending: "A Pagar (Detallado)",
            tabHistory: "Histórico Liquidado",
            emptyPending: "No hay comisiones pendientes por liquidar en este período.",
            emptyHistory: "No hay liquidaciones registradas en este período.",
            colDate: "Fecha",
            colClient: "Cliente",
            colItem: "Servicio / Producto",
            colBase: "Valor Base",
            colRate: "%",
            colCommission: "Comisión",
            deductionsTitle: "Vales / Deducciones Activas",
            typeService: "Servicio",
            typeProduct: "Producto",
            typeTip: "Propina",
            settledItemsCount: (n: number) => `${n} ítem(s) liquidado(s)`,
            paymentMethodLabel: "Medio de pago",
            notesLabel: "Observaciones (opcional)",
            notesPlaceholder: "Ej.: Pagado vía transferencia...",
            confirmSettleBtn: "Confirmar Pago / Liquidar Saldo",
            settlingBtn: "Liquidando...",
            settleSuccess: "¡Saldo de comisiones liquidado y registrado en caja!",
            settleAlreadyPaid: "No hay ítems pendientes para liquidar en este período.",
            settleError: "Error al liquidar el saldo de comisiones.",
            methods: {
              PIX: "PIX",
              CASH: "Efectivo",
              TRANSFER: "Transferencia",
              CREDIT_CARD: "Tarjeta de Crédito",
              DEBIT_CARD: "Tarjeta de Débito",
              OTHER: "Otros",
            } as Record<PaymentMethod, string>,
          }
        : {
            title: "Relatório Detalhado de Comissões",
            periodLabel: (from: string, to: string) => `Período: ${from} a ${to}`,
            loading: "Carregando detalhamento de serviços, produtos e liquidações...",
            loadError: "Erro ao carregar o relatório detalhado do profissional.",
            kpiGrossPending: "Bruto Pendente",
            kpiDeductions: "Vales / Abatimentos",
            kpiAlreadyPaid: "Já Liquidado no Período",
            kpiNetPayable: "Saldo Líquido a Pagar",
            tabPending: "A Pagar (Detalhado)",
            tabHistory: "Histórico Liquidado",
            emptyPending: "Nenhuma comissão pendente para liquidar neste período.",
            emptyHistory: "Nenhuma liquidação registrada neste período.",
            colDate: "Data",
            colClient: "Cliente",
            colItem: "Serviço / Produto",
            colBase: "Valor Base",
            colRate: "%",
            colCommission: "Comissão",
            deductionsTitle: "Vales / Deduções Ativos",
            typeService: "Serviço",
            typeProduct: "Produto",
            typeTip: "Gorjeta",
            settledItemsCount: (n: number) => `${n} item(ns) quitado(s)`,
            paymentMethodLabel: "Meio de pagamento",
            notesLabel: "Observações (opcional)",
            notesPlaceholder: "Ex.: Pago via chave PIX...",
            confirmSettleBtn: "Confirmar Pagamento / Liquidar Saldo",
            settlingBtn: "Liquidando...",
            settleSuccess: "Saldo de comissões liquidado e lançamento de saída registrado!",
            settleAlreadyPaid: "Não há itens pendentes para liquidar neste período.",
            settleError: "Erro ao liquidar o saldo de comissões.",
            methods: {
              PIX: "PIX",
              CASH: "Dinheiro",
              TRANSFER: "Transferência",
              CREDIT_CARD: "Cartão de Crédito",
              DEBIT_CARD: "Cartão de Débito",
              OTHER: "Outros",
            } as Record<PaymentMethod, string>,
          },
    [isEs],
  );

  const [detail, setDetail] = useState<CollaboratorCommissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"PENDING" | "HISTORY">("PENDING");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [notes, setNotes] = useState("");
  const [settling, setSettling] = useState(false);
  const requestKeyRef = useRef<string>(crypto.randomUUID());

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<CollaboratorCommissionDetail>(
        `/v1/commissions/collaborators/${encodeURIComponent(collaboratorId)}`,
        { query: { from: fromDate, to: toDate } },
      );
      setDetail(res);
    } catch {
      toast.error(copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [collaboratorId, copy.loadError, fromDate, toDate]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleConfirmSettlement = async () => {
    if (!detail || detail.pendingItems.length === 0) return;
    setSettling(true);
    try {
      await apiRequest(
        `/v1/commissions/collaborators/${encodeURIComponent(collaboratorId)}/settle`,
        {
          method: "POST",
          body: {
            periodStart: fromDate,
            periodEnd: toDate,
            paidOn: todayIso,
            paymentMethod: detail.summary.netPayableCents === 0 ? "OTHER" : paymentMethod,
            expectedAmountCents: detail.summary.netPayableCents,
            requestKey: requestKeyRef.current,
            notes: notes.trim() || null,
          },
        },
      );

      requestKeyRef.current = crypto.randomUUID();
      setNotes("");
      toast.success(copy.settleSuccess);
      await loadDetail();
      onSettled();
    } catch (err) {
      requestKeyRef.current = crypto.randomUUID();
      if (err instanceof ApiError && err.message.includes("FINANCE_COMMISSION_NOT_READY")) {
        toast.warning(copy.settleAlreadyPaid);
      } else {
        toast.error(copy.settleError);
      }
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={() => !settling && onClose()} />
      <aside
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l border-border-strong bg-surface shadow-2xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-accent">
              <Coins size={14} />
              <span>{copy.title}</span>
            </div>
            <h3 className="mt-0.5 truncate text-lg font-bold text-ink">
              {detail?.collaborator.name ?? "..."}
            </h3>
            <p className="text-xs text-ink-muted">{copy.periodLabel(fromDate, toDate)}</p>
          </div>
          <button
            type="button"
            disabled={settling}
            onClick={onClose}
            aria-label="Fechar"
            className="grid size-8 cursor-pointer place-items-center rounded-lg border border-border-subtle text-ink-secondary hover:border-accent hover:text-ink disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corpo com scroll */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {loading || !detail ? (
            <div className="flex flex-col items-center justify-center py-20 text-xs text-ink-muted">
              <Loader2 className="size-7 animate-spin text-accent" />
              <p className="mt-3">{copy.loading}</p>
            </div>
          ) : (
            <>
              {/* 4 Cards de Resumo Financeiro */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border-subtle bg-canvas/50 p-3">
                  <span className="text-[11px] font-medium text-ink-muted">
                    {copy.kpiGrossPending}
                  </span>
                  <p className="mt-1 text-base font-bold text-ink tabular-nums">
                    <SensitiveValue>
                      {formatPriceFromCents(detail.summary.grossPendingCents, locale, currency)}
                    </SensitiveValue>
                  </p>
                </div>

                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                  <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                    {copy.kpiDeductions}
                  </span>
                  <p className="mt-1 text-base font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                    -
                    <SensitiveValue>
                      {formatPriceFromCents(detail.summary.deductionsCents, locale, currency)}
                    </SensitiveValue>
                  </p>
                </div>

                <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3">
                  <span className="text-[11px] font-medium text-sky-700 dark:text-sky-400">
                    {copy.kpiAlreadyPaid}
                  </span>
                  <p className="mt-1 text-base font-bold text-sky-700 dark:text-sky-400 tabular-nums">
                    <SensitiveValue>
                      {formatPriceFromCents(detail.summary.alreadyPaidCents, locale, currency)}
                    </SensitiveValue>
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    {copy.kpiNetPayable}
                  </span>
                  <p className="mt-1 text-base font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    <SensitiveValue>
                      {formatPriceFromCents(detail.summary.netPayableCents, locale, currency)}
                    </SensitiveValue>
                  </p>
                </div>
              </div>

              {/* Abas */}
              <div className="flex gap-1.5 border-b border-border-subtle pb-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("PENDING")}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                    activeTab === "PENDING"
                      ? "bg-accent text-accent-ink shadow-2xs"
                      : "bg-canvas/50 text-ink-secondary hover:text-ink"
                  }`}
                >
                  <HandCoins size={14} />
                  {copy.tabPending} ({detail.pendingItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("HISTORY")}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                    activeTab === "HISTORY"
                      ? "bg-accent text-accent-ink shadow-2xs"
                      : "bg-canvas/50 text-ink-secondary hover:text-ink"
                  }`}
                >
                  <History size={14} />
                  {copy.tabHistory} ({detail.settledHistory.length})
                </button>
              </div>

              {/* Aba 1: A Pagar (Detalhado) */}
              {activeTab === "PENDING" && (
                <div className="space-y-4">
                  {detail.pendingItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border-subtle py-10 text-center text-xs text-ink-muted">
                      {copy.emptyPending}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border-subtle">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-border-subtle bg-canvas/50 text-ink-muted font-semibold">
                          <tr>
                            <th className="px-3 py-2.5">{copy.colDate}</th>
                            <th className="px-3 py-2.5">{copy.colClient}</th>
                            <th className="px-3 py-2.5">{copy.colItem}</th>
                            <th className="px-3 py-2.5 text-right">{copy.colBase}</th>
                            <th className="px-3 py-2.5 text-center">{copy.colRate}</th>
                            <th className="px-3 py-2.5 text-right">{copy.colCommission}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/50">
                          {detail.pendingItems.map((item) => (
                            <tr key={item.id} className="hover:bg-canvas/30">
                              <td className="px-3 py-2.5 font-mono text-[11px] text-ink-secondary whitespace-nowrap">
                                {item.date}
                              </td>
                              <td className="px-3 py-2.5 font-medium text-ink">
                                {item.clientName}
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  {item.itemType === "PRODUCT" ? (
                                    <Package size={12} className="text-amber-500 shrink-0" />
                                  ) : (
                                    <Scissors size={12} className="text-accent shrink-0" />
                                  )}
                                  <span className="font-medium text-ink">{item.description}</span>
                                  <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted">
                                    {item.itemType === "PRODUCT"
                                      ? copy.typeProduct
                                      : item.itemType === "TIP"
                                        ? copy.typeTip
                                        : copy.typeService}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-ink-secondary whitespace-nowrap">
                                {formatPriceFromCents(item.baseAmountCents, locale, currency)}
                              </td>
                              <td className="px-3 py-2.5 text-center tabular-nums text-ink-secondary">
                                {item.commissionPercentage}%
                              </td>
                              <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                                {formatPriceFromCents(item.commissionCents, locale, currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Vales / Deduções Ativos */}
                  {detail.deductions.length > 0 && (
                    <div className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-3.5 space-y-2">
                      <h4 className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                        <MinusCircle size={14} />
                        {copy.deductionsTitle}
                      </h4>
                      <div className="space-y-1.5">
                        {detail.deductions.map((d) => (
                          <div
                            key={d.id}
                            className="flex items-center justify-between rounded-lg bg-surface/80 px-3 py-2 text-xs"
                          >
                            <div>
                              <p className="font-semibold text-ink">{d.description}</p>
                              <p className="text-[11px] text-ink-muted font-mono">{d.deductedAt}</p>
                            </div>
                            <span className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                              -{formatPriceFromCents(d.openAmountCents, locale, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Aba 2: Histórico Liquidado */}
              {activeTab === "HISTORY" && (
                <div className="space-y-3">
                  {detail.settledHistory.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border-subtle py-10 text-center text-xs text-ink-muted">
                      {copy.emptyHistory}
                    </div>
                  ) : (
                    detail.settledHistory.map((batch) => (
                      <div
                        key={batch.id}
                        className="rounded-xl border border-border-subtle bg-canvas/40 p-4 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={15} className="text-emerald-500" />
                            <div>
                              <p className="text-xs font-bold text-ink">
                                {formatDateTimeInTimezone(batch.paidAt, timezone, locale)}
                              </p>
                              <p className="text-[11px] text-ink-muted">
                                {batch.paymentMethod
                                  ? copy.methods[batch.paymentMethod] ?? batch.paymentMethod
                                  : "—"}{" "}
                                · {copy.settledItemsCount(batch.items.length)}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-lg bg-emerald-500/15 px-2.5 py-1 text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {formatPriceFromCents(batch.amountCents, locale, currency)}
                          </span>
                        </div>

                        {batch.notes && (
                          <p className="rounded-lg bg-surface px-2.5 py-1.5 text-[11px] text-ink-secondary">
                            {batch.notes}
                          </p>
                        )}

                        {batch.items.length > 0 && (
                          <div className="divide-y divide-border-subtle/50 rounded-lg border border-border-subtle bg-surface/70 text-[11px]">
                            {batch.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-2 px-3 py-1.5"
                              >
                                <span className="truncate text-ink">
                                  <span className="font-mono text-ink-muted mr-1.5">
                                    {item.date}
                                  </span>
                                  {item.description} ({item.clientName})
                                </span>
                                <span className="shrink-0 font-semibold text-ink tabular-nums">
                                  {formatPriceFromCents(item.commissionCents, locale, currency)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé de Liquidação dentro do próprio relatório */}
        {detail && !loading && (
          <div className="border-t border-border-subtle bg-canvas/50 p-4 space-y-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
              <div>
                <label className="block font-semibold text-ink-secondary mb-1">
                  {copy.paymentMethodLabel}
                </label>
                <select
                  value={paymentMethod}
                  disabled={settling || detail.pendingItems.length === 0}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full cursor-pointer rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs text-ink disabled:opacity-50"
                >
                  <option value="PIX">{copy.methods.PIX}</option>
                  <option value="CASH">{copy.methods.CASH}</option>
                  <option value="TRANSFER">{copy.methods.TRANSFER}</option>
                  <option value="OTHER">{copy.methods.OTHER}</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-ink-secondary mb-1">
                  {copy.notesLabel}
                </label>
                <input
                  type="text"
                  disabled={settling || detail.pendingItems.length === 0}
                  placeholder={copy.notesPlaceholder}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-xs text-ink disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs">
                <span className="text-ink-muted">{copy.kpiNetPayable}: </span>
                <strong className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatPriceFromCents(detail.summary.netPayableCents, locale, currency)}
                </strong>
              </div>
              <button
                type="button"
                disabled={settling || detail.pendingItems.length === 0}
                onClick={() => void handleConfirmSettlement()}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {settling ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {copy.settlingBtn}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    {copy.confirmSettleBtn}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
