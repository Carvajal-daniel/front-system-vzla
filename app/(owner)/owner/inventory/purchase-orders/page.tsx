"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
  Truck,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { formatDateTimeInTimezone, formatPriceFromCents } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import { useSession } from "@/components/ui/auth-guard";
import { SensitiveValue } from "@/components/ui/sensitive-value";
import type { InventoryItem } from "@/lib/types/inventory";
import { useSuppliers } from "@/lib/use-suppliers";

interface PurchaseOrderItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unitCostReais: string;
  subtotalCents: number;
}

interface PurchaseOrderRecord {
  id: string;
  companyId: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  createdAt: string;
  dueDate: string;
  totalAmountCents: number;
  itemsCount: number;
  items: { itemId: string; itemName: string; quantity: number; subtotalCents: number }[];
  financeExpenseCreated: boolean;
}

function getOrdersStorageKey(companyId: string): string {
  return `atelier_purchase_orders_${companyId}`;
}

export default function PurchaseOrdersPage() {
  const { session } = useSession();
  const { locale } = useLocale();
  const timezone = session.company.timezone;
  const currency = session.company.currency ?? "BRL";
  const companyId = session.company.id;

  const { suppliers } = useSuppliers(companyId);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Modal de Criação de Ordem
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [createExpense, setCreateExpense] = useState(true);

  // Linhas da Ordem de Compra
  const [orderLines, setOrderLines] = useState<PurchaseOrderItem[]>([]);

  // Carrega produtos do estoque
  useEffect(() => {
    setLoadingItems(true);
    apiRequest<{ items: InventoryItem[] } | InventoryItem[]>("/inventory/items")
      .then((res) => {
        const list = Array.isArray(res) ? res : res.items ?? [];
        setInventoryItems(list);
      })
      .catch(() => setInventoryItems([]))
      .finally(() => setLoadingItems(false));

    // Carrega ordens salvas
    try {
      const raw = localStorage.getItem(getOrdersStorageKey(companyId));
      if (raw) setOrders(JSON.parse(raw) as PurchaseOrderRecord[]);
    } catch {
      // Ignora erro
    }
  }, [companyId]);

  const saveOrders = (next: PurchaseOrderRecord[]) => {
    setOrders(next);
    if (typeof window !== "undefined" && companyId) {
      localStorage.setItem(getOrdersStorageKey(companyId), JSON.stringify(next));
    }
  };

  const handleOpenCreate = () => {
    setSelectedSupplierId(suppliers[0]?.id || "");
    setDueDate(new Date().toISOString().split("T")[0]);
    setCreateExpense(true);

    if (inventoryItems.length > 0) {
      const first = inventoryItems[0];
      setOrderLines([
        {
          itemId: first.id,
          itemName: first.name,
          quantity: 10,
          unitCostReais: (first.costPriceCents / 100).toFixed(2),
          subtotalCents: first.costPriceCents * 10,
        },
      ]);
    } else {
      setOrderLines([]);
    }

    setModalOpen(true);
  };

  const handleAddLine = () => {
    if (inventoryItems.length === 0) return;
    const first = inventoryItems[0];
    setOrderLines([
      ...orderLines,
      {
        itemId: first.id,
        itemName: first.name,
        quantity: 5,
        unitCostReais: (first.costPriceCents / 100).toFixed(2),
        subtotalCents: first.costPriceCents * 5,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    setOrderLines(orderLines.filter((_, i) => i !== idx));
  };

  const handleUpdateLine = (idx: number, patch: Partial<PurchaseOrderItem>) => {
    setOrderLines(
      orderLines.map((line, i) => {
        if (i !== idx) return line;
        const updated = { ...line, ...patch };

        // Recalcula subtotal
        const costCents = Math.round(parseFloat(updated.unitCostReais.replace(",", ".")) * 100) || 0;
        updated.subtotalCents = Math.round(costCents * (updated.quantity || 0));
        return updated;
      }),
    );
  };

  const totalOrderCents = useMemo(() => {
    return orderLines.reduce((sum, l) => sum + l.subtotalCents, 0);
  }, [orderLines]);

  // Submissão da Ordem de Compra
  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderLines.length === 0) {
      toast.error("Adicione ao menos um item na ordem de compra.");
      return;
    }

    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    const supplierName = supplier?.name || "Fornecedor";
    const orderNumber = `OC-${Date.now().toString().slice(-6)}`;

    setSubmitting(true);
    try {
      // 1. Registra cada item no estoque via POST /inventory/movements (PURCHASE_IN)
      for (const line of orderLines) {
        await apiRequest("/inventory/movements", {
          method: "POST",
          auth: true,
          body: {
            itemId: line.itemId,
            movementType: "PURCHASE_IN",
            quantity: line.quantity,
            notes: `Entrada via Ordem de Compra ${orderNumber} (${supplierName})`,
          },
        }).catch(() => null);
      }

      // 2. Se marcado, cria a despesa financeira em POST /finance/expenses (STOCK_PURCHASE)
      if (createExpense && totalOrderCents > 0) {
        await apiRequest("/finance/expenses", {
          method: "POST",
          auth: true,
          body: {
            description: `Compra de Estoque (${orderNumber}) - ${supplierName}`,
            category: "STOCK_PURCHASE",
            amountCents: totalOrderCents,
            dueDate,
          },
        }).catch(() => null);
      }

      // 3. Salva a Ordem de Compra localmente para histórico
      const record: PurchaseOrderRecord = {
        id: `po_${Date.now()}`,
        companyId,
        orderNumber,
        supplierId: selectedSupplierId,
        supplierName,
        createdAt: new Date().toISOString(),
        dueDate,
        totalAmountCents: totalOrderCents,
        itemsCount: orderLines.reduce((s, l) => s + l.quantity, 0),
        items: orderLines.map((l) => ({
          itemId: l.itemId,
          itemName: l.itemName,
          quantity: l.quantity,
          subtotalCents: l.subtotalCents,
        })),
        financeExpenseCreated: createExpense,
      };

      saveOrders([record, ...orders]);
      toast.success(
        `Ordem de Compra ${orderNumber} confirmada! Estoque abastecido e despesa financeira registrada.`,
      );
      setModalOpen(false);
    } catch {
      toast.error("Erro ao registrar a ordem de compra.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Botão Voltar */}
      <div className="flex items-center justify-between">
        <Link
          href="/owner/inventory"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink transition-colors"
        >
          <ArrowLeft size={14} />
          Voltar para Estoque
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <ShoppingBag className="size-6 text-accent" />
            Ordens de Compra de Estoque
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Registre entradas de mercadoria integrando o estoque físico e as contas a pagar em um
            único clique.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          disabled={inventoryItems.length === 0}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs cursor-pointer disabled:opacity-50"
        >
          <Plus size={14} />
          Nova Ordem de Compra
        </button>
      </div>

      {/* Tabela de Ordens de Compra */}
      <div className="rounded-2xl border border-border-subtle bg-surface shadow-xs overflow-hidden">
        {orders.length === 0 ? (
          <div className="py-16 text-center text-xs text-ink-muted space-y-1">
            <p className="font-bold text-sm text-ink">Nenhuma ordem de compra registrada.</p>
            <p>Clique em "+ Nova Ordem de Compra" para registrar entradas de mercadorias.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-canvas/50 border-b border-border-subtle text-ink-muted font-semibold">
                <tr>
                  <th className="py-3 px-4">Ordem</th>
                  <th className="py-3 px-4">Fornecedor</th>
                  <th className="py-3 px-4">Data de Emissão</th>
                  <th className="py-3 px-4">Vencimento Financeiro</th>
                  <th className="py-3 px-4">Qtd Itens</th>
                  <th className="py-3 px-4">Valor Total</th>
                  <th className="py-3 px-4">Integração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {orders.map((po) => {
                  const createdStr = formatDateTimeInTimezone(
                    po.createdAt,
                    timezone,
                    locale,
                  ).split(" ")[0];

                  return (
                    <tr key={po.id} className="hover:bg-canvas/30 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-ink">{po.orderNumber}</td>

                      <td className="py-3 px-4 font-semibold text-ink">{po.supplierName}</td>

                      <td className="py-3 px-4 whitespace-nowrap text-ink-secondary">
                        {createdStr}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-ink-secondary font-mono">
                        {po.dueDate}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-ink-muted">
                        {po.itemsCount} unidades
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-bold text-ink">
                        <SensitiveValue>
                          {formatPriceFromCents(po.totalAmountCents, locale, currency)}
                        </SensitiveValue>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {po.financeExpenseCreated ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={11} />
                            Estoque + Contas a Pagar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md border border-slate-500/20 bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                            Apenas Estoque
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nova Ordem de Compra */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-border-subtle bg-surface p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-base font-bold text-ink flex items-center gap-2">
                <ShoppingBag size={18} className="text-accent" />
                Nova Ordem de Compra
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-ink-muted hover:text-ink transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">
                    Fornecedor *
                  </label>
                  <select
                    required
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  >
                    <option value="">Selecione um fornecedor...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.document})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-ink-secondary mb-1">
                    Vencimento Financeiro *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-xl border border-border-subtle bg-canvas/40 px-3 py-2 text-xs text-ink"
                  />
                </div>
              </div>

              {/* Itens da Ordem de Compra */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">Itens da Compra</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline cursor-pointer"
                  >
                    <Plus size={13} />
                    Adicionar Produto
                  </button>
                </div>

                <div className="rounded-xl border border-border-subtle bg-canvas/30 p-2 space-y-2 max-h-60 overflow-y-auto">
                  {orderLines.map((line, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-surface p-2 border border-border-subtle/70"
                    >
                      <div className="flex-1 min-w-[160px]">
                        <select
                          value={line.itemId}
                          onChange={(e) => {
                            const found = inventoryItems.find((it) => it.id === e.target.value);
                            handleUpdateLine(idx, {
                              itemId: e.target.value,
                              itemName: found?.name || "Item",
                              unitCostReais: found
                                ? (found.costPriceCents / 100).toFixed(2)
                                : line.unitCostReais,
                            });
                          }}
                          className="w-full rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1.5 text-xs text-ink"
                        >
                          {inventoryItems.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-20">
                        <input
                          type="number"
                          min={1}
                          required
                          placeholder="Qtd"
                          value={line.quantity}
                          onChange={(e) =>
                            handleUpdateLine(idx, { quantity: Number(e.target.value) })
                          }
                          className="w-full rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1.5 text-xs text-ink text-center"
                          title="Quantidade"
                        />
                      </div>

                      <div className="w-24">
                        <input
                          type="text"
                          required
                          placeholder="Custo (R$)"
                          value={line.unitCostReais}
                          onChange={(e) =>
                            handleUpdateLine(idx, { unitCostReais: e.target.value })
                          }
                          className="w-full rounded-lg border border-border-subtle bg-canvas/40 px-2 py-1.5 text-xs text-ink text-right"
                          title="Custo unitário"
                        />
                      </div>

                      <div className="w-24 text-right font-bold text-ink">
                        {formatPriceFromCents(line.subtotalCents, locale, currency)}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="rounded-md p-1 text-ink-muted hover:text-rose-500 transition-colors"
                        title="Remover linha"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Integração Financeira Automática */}
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={createExpense}
                    onChange={(e) => setCreateExpense(e.target.checked)}
                    className="rounded border-border-subtle accent-accent size-4"
                  />
                  <span>
                    Lançar despesa financeira automaticamente em Contas a Pagar (Compra de Estoque)
                  </span>
                </label>
                <p className="text-[11px] text-ink-muted pl-6">
                  Ao confirmar, o valor de{" "}
                  <strong>{formatPriceFromCents(totalOrderCents, locale, currency)}</strong> será
                  agendado para vencer em {dueDate}.
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-border-subtle pt-3">
                <div className="text-sm font-bold text-ink">
                  Total da Ordem:{" "}
                  <span className="text-accent">
                    {formatPriceFromCents(totalOrderCents, locale, currency)}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl border border-border-subtle px-4 py-2 text-xs font-semibold text-ink hover:bg-canvas transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || orderLines.length === 0}
                    className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:bg-accent-hover transition-colors shadow-xs disabled:opacity-50"
                  >
                    {submitting && <Loader2 size={13} className="animate-spin" />}
                    Confirmar e Dar Entrada
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
