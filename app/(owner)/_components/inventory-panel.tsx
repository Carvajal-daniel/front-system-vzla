"use client";

import { useDeferredValue, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Boxes, Download, FileSpreadsheet, Package, Plus, TriangleAlert, Wallet, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/ui/auth-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCurrencyFormatter, getTodayIsoDateInTimezone } from "@/lib/format";
import { useLocale } from "@/lib/i18n/locale-context";
import {
  inventoryCategories, type InventoryCategory, type InventoryItem, type InventoryList, type InventoryMovement, type InventorySummary,
} from "@/lib/types/inventory";
import { InventoryOperationDialog, type InventoryOperation } from "./inventory-operation-dialog";
import { ownerControl, ownerField, ownerSection } from "./owner-modal";
import { SpreadsheetImport } from "./spreadsheet-import";
import { useOwnerInventory } from "./use-owner-inventory";

const tableCell = "px-4 py-3";
const tableTitle = tableCell + " font-semibold";

const stockToneStyles = {
  default: {
    card: "",
    icon: "bg-accent/10 text-accent",
    value: "text-ink",
  },
  critical: {
    card: "border-rose-500/40 bg-rose-500/5 dark:border-rose-400/35 dark:bg-rose-500/10",
    icon: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    value: "text-rose-600 dark:text-rose-400",
  },
  warning: {
    card: "border-amber-500/40 bg-amber-500/5 dark:border-amber-400/35 dark:bg-amber-500/10",
    icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
  },
  ok: {
    card: "border-emerald-500/40 bg-emerald-500/5 dark:border-emerald-400/35 dark:bg-emerald-500/10",
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
  },
} as const;

function StockCard({
  title, value, icon: Icon, hint, tone = "default", onClick,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: keyof typeof stockToneStyles;
  onClick?: () => void;
}) {
  const style = stockToneStyles[tone];
  const interactive = onClick
    ? " cursor-pointer transition-colors hover:border-accent/60 focus-within:border-accent/60"
    : "";
  return <article className={ownerSection + " relative min-w-0 p-3 sm:p-4 " + style.card + interactive}>
    {onClick && (
      <button type="button" aria-label={title} onClick={onClick}
        className="absolute inset-0 cursor-pointer rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
    )}
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-xs font-semibold text-ink-secondary">{title}</h2>
      <span className={"grid size-8 shrink-0 place-items-center rounded-lg " + style.icon}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
    </div>
    <p className={"mt-2 break-words text-lg font-semibold tabular-nums sm:text-2xl " + style.value}>{value}</p>
    {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
  </article>;
}

function RequestState({ result, onRetry }: { result: null | undefined; onRetry: () => void }) {
  const { t } = useLocale();
  if (result === undefined) return <p role="status" className="p-4 text-sm text-ink-muted">{t.common.loading}</p>;
  return <div role="alert" className="flex flex-wrap items-center gap-2 p-4 text-sm text-ink-muted">
    {t.errors.networkDescription}<Button type="button" variant="outline" size="sm" onClick={onRetry}>{t.common.retry}</Button>
  </div>;
}

function Pager({ page, hasMore, onChange }: { page: number; hasMore: boolean; onChange: (page: number) => void }) {
  const { t } = useLocale();
  return <div className="flex justify-end gap-2 border-t border-border-subtle p-3">
    <Button type="button" variant="outline" size="sm" disabled={page < 2} onClick={() => onChange(page - 1)}>{t.common.back}</Button>
    <Button type="button" variant="outline" size="sm" disabled={!hasMore} onClick={() => onChange(page + 1)}>{t.common.next}</Button>
  </div>;
}

export function InventoryPanel() {
  const { t, locale } = useLocale();
  const { session } = useSession();
  const { executive: x, finance: f } = t;
  const [view, setView] = useState<"items" | "movements">("items");
  const [category, setCategory] = useState<InventoryCategory | "">("");
  const [search, setSearch] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [itemPage, setItemPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);
  const [historyItem, setHistoryItem] = useState<InventoryItem>();
  const [operation, setOperation] = useState<InventoryOperation | null>(null);
  const [importing, setImporting] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState("");
  const listSectionRef = useRef<HTMLElement>(null);
  const deferredSearch = useDeferredValue(search);
  const query = new URLSearchParams({ page: String(itemPage), search: deferredSearch });
  if (category) query.set("category", category);
  if (lowStock) query.set("lowStock", "true");
  const historyQuery = new URLSearchParams({ page: String(movementPage) });
  if (historyItem) historyQuery.set("itemId", historyItem.id);
  const summary = useOwnerInventory<InventorySummary>("/inventory/summary", revision);
  const products = useOwnerInventory<InventoryList<InventoryItem>>(view === "items" ? "/inventory/items?" + query : null, revision);
  const movements = useOwnerInventory<InventoryList<InventoryMovement>>(view === "movements" ? "/inventory/movements?" + historyQuery : null, revision);
  const today = summary?.today ?? getTodayIsoDateInTimezone(session.company.timezone);
  const number = new Intl.NumberFormat(locale);
  const currency = summary?.currency ?? session.company.currency ?? "BRL";
  const formatter = getCurrencyFormatter(locale, currency);
  const money = (cents: number) => formatter.format(cents / 100);
  const formatDate = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeZone: "UTC" });
  const refresh = () => setRevision((n) => n + 1);

  const hasCriticalStock = Boolean(products?.items.some((item) => item.currentStock === 0));
  const lowStockTone = !summary || summary.lowStockItems === 0 ? "ok" : hasCriticalStock ? "critical" : "warning";
  const scrollToList = () => listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  function showAllItems() {
    setSearch("");
    setCategory("");
    setLowStock(false);
    setItemPage(1);
    setView("items");
    scrollToList();
  }

  function showLowStockItems() {
    setSearch("");
    setCategory("");
    setLowStock(true);
    setItemPage(1);
    setView("items");
    scrollToList();
  }

  function showMonthlyMovements() {
    setHistoryItem(undefined);
    setMovementPage(1);
    setView("movements");
    scrollToList();
  }

  function afterSave(message: string) {
    setOperation(null);
    setImporting(false);
    setNotice(message);
    refresh();
  }

  const handleExportCsv = () => {
    const es = locale === "es";
    if (!products || products.items.length === 0) {
      toast.warning(es ? "No hay artículos en el inventario para exportar." : "Não há itens no estoque para exportar.");
      return;
    }
    const headers = es
      ? ["Nombre", "Categoría", "Stock Actual", "Stock Mínimo", `Costo (${currency})`, `Precio Venta (${currency})`]
      : ["Nome", "Categoria", "Estoque Atual", "Estoque Mínimo", `Custo (${currency})`, `Preço Venda (${currency})`];
    const rows = products.items.map((it) => [
      `"${it.name.replace(/"/g, '""')}"`,
      `"${it.category}"`,
      it.currentStock,
      it.minStock,
      (it.costPriceCents / 100).toFixed(2),
      it.salePriceCents ? (it.salePriceCents / 100).toFixed(2) : "—",
    ].join(","));
    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `estoque_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(es ? "¡Inventario exportado en CSV con éxito!" : "Estoque exportado em CSV com sucesso!");
  };

  return <div className="space-y-5">
    {operation && <InventoryOperationDialog operation={operation} today={today} onClose={() => setOperation(null)} onSaved={afterSave} />}
    {importing && <SpreadsheetImport kind="inventory" today={today} onClose={() => setImporting(false)} onImported={afterSave} />}
    <header className={ownerSection + " flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5"}>
      <h1 className="text-xl font-semibold text-ink sm:text-2xl text-balance">{x.stock}</h1>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => setOperation({ kind: "item" })}><Plus aria-hidden="true" />{x.newItem}</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOperation({ kind: "movement", mode: "in" })}>
          <ArrowDownToLine aria-hidden="true" />{x.registerIn}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setOperation({ kind: "movement", mode: "out" })}>
          <ArrowUpFromLine aria-hidden="true" />{x.registerOut}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={handleExportCsv}>
          <Download aria-hidden="true" />{locale === "es" ? "Exportar CSV" : "Salvar em CSV"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setImporting(true)}>
          <FileSpreadsheet aria-hidden="true" />{x.importSheet}
        </Button>
      </div>
    </header>
    {notice && <p role="status" className="rounded-lg bg-accent/10 px-4 py-2 text-sm font-medium text-accent">{notice}</p>}
    {summary ? <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={f.summaryTitle}>
      <StockCard title={x.totalItems} icon={Package} value={number.format(summary.totalItems)} onClick={showAllItems} />
      <StockCard title={x.stockCost} icon={Wallet} value={money(summary.stockCostCents)} />
      <StockCard title={x.lowItems} icon={TriangleAlert} value={number.format(summary.lowStockItems)}
        tone={lowStockTone} hint={summary.lowStockItems === 0 ? x.stockHealthyHint : undefined} onClick={showLowStockItems} />
      <StockCard title={x.monthlyOut} icon={Boxes} value={number.format(summary.outgoingMovements)}
        hint={x.monthlySales + " · " + money(summary.salesCents)} onClick={showMonthlyMovements} />
    </section> : <div className={ownerSection}><RequestState result={summary} onRetry={refresh} /></div>}
    <section ref={listSectionRef} className={ownerSection}>
      <div className="flex flex-wrap gap-2 border-b border-border-subtle p-4">
        <Button type="button" size="sm" variant={view === "items" ? "default" : "outline"} aria-pressed={view === "items"}
          onClick={() => setView("items")}>{x.inventoryItems}</Button>
        <Button type="button" size="sm" variant={view === "movements" ? "default" : "outline"} aria-pressed={view === "movements"}
          onClick={() => { setHistoryItem(undefined); setMovementPage(1); setView("movements"); }}>{x.inventoryHistory}</Button>
      </div>
      {view === "items" ? <>
        <div className="flex flex-wrap items-end gap-3 border-b border-border-subtle bg-subtle/40 px-4 py-3">
          <label className={ownerField + " min-w-48 flex-1"}>{x.inventorySearch}
            <Input maxLength={100} value={search} onChange={(event) => { setSearch(event.target.value); setItemPage(1); }} />
          </label>
          <label className={ownerField}>{f.expenseCategory}
            <select className={ownerControl} value={category} onChange={(event) => {
              setCategory(event.target.value as InventoryCategory | ""); setItemPage(1);
            }}>
              <option value="">{x.allItems}</option>
              {inventoryCategories.map((type) => <option key={type} value={type}>{x.categories[type]}</option>)}
            </select>
          </label>
          <Button type="button" variant={lowStock ? "default" : "outline"} aria-pressed={lowStock}
            onClick={() => { setLowStock(!lowStock); setItemPage(1); }}>{x.lowItems}</Button>
        </div>
        {products ? <>
          {!products.items.length ? <p className="p-4 text-sm text-ink-muted">{f.noDataPeriod}</p> : <div className="overflow-x-auto">
            <table className="w-full min-w-[49rem] text-left text-xs">
              <thead className="bg-subtle text-ink-secondary"><tr>
                {[x.name, f.expenseCategory, x.stockQty, x.costPrice, x.salePrice, f.filtersActions].map((title) =>
                  <th scope="col" key={title} className={tableTitle}>{title}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-border-subtle text-ink">
                {products.items.map((item) => {
                  const critical = item.currentStock === 0;
                  const low = item.currentStock <= item.minStock;
                  const badge = critical ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-ink)]"
                    : low ? "bg-accent/10 text-accent" : "bg-[var(--status-success-bg)] text-[var(--status-success-ink)]";
                  return <tr key={item.id}>
                    <th scope="row" className={tableCell + " font-semibold"}>
                      {item.name}{item.sku && <span className="mt-1 block font-normal text-ink-muted">{item.sku}</span>}
                    </th>
                    <td className={tableCell}>{x.categories[item.category]}</td>
                    <td className={tableCell + " whitespace-nowrap tabular-nums"}>
                      <span className="font-semibold">{number.format(item.currentStock)} {item.unit}</span>
                      <span className={"ms-2 rounded-full px-2 py-1 font-medium " + badge}>
                        {critical ? x.criticalStock : low ? x.lowStock : x.normalStock}
                      </span>
                      <p className="mt-1 text-ink-muted">{x.minStock} · {number.format(item.minStock)}</p>
                    </td>
                    <td className={tableCell + " whitespace-nowrap tabular-nums"}>{money(item.costPriceCents)}</td>
                    <td className={tableCell + " whitespace-nowrap tabular-nums"}>{item.salePriceCents == null ? "—" : money(item.salePriceCents)}</td>
                    <td className={tableCell}>
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => setOperation({ kind: "movement", mode: "in", item })}>{x.registerIn}</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setOperation({ kind: "movement", mode: "out", item })}>{x.registerOut}</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setOperation({ kind: "movement", mode: "adjust", item })}>{x.adjustment}</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setOperation({ kind: "item", item })}>{t.common.edit}</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => {
                          setHistoryItem(item); setMovementPage(1); setView("movements");
                        }}>{x.inventoryHistory}</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setOperation({ kind: "archive", item })}>{x.archiveItem}</Button>
                      </div>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>}
          {(itemPage > 1 || products.hasMore) && <Pager page={itemPage} hasMore={products.hasMore} onChange={setItemPage} />}
        </> : <RequestState result={products} onRetry={refresh} />}
      </> : <>
        {historyItem && <p className="px-4 py-3 text-sm font-semibold">{historyItem.name}</p>}
        {movements ? <>
          {!movements.items.length ? <p className="p-4 text-sm text-ink-muted">{f.noDataPeriod}</p> :
            <ul className="divide-y divide-border-subtle text-sm">
              {movements.items.map((entry) => <li key={entry.id}
                className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="break-words font-semibold">{entry.itemName}</p>
                  <p className="text-xs text-ink-secondary">
                    {x.movements[entry.movementType]} · {formatDate.format(new Date(entry.occurredOn))}
                    {entry.collaboratorName && " · " + entry.collaboratorName}
                    {entry.paymentMethod && " · " + f.paymentMethods[entry.paymentMethod]}
                  </p>
                  {entry.financeReferenceType && <p className="text-xs text-accent">{x.stockFinanceLink}</p>}
                  {entry.notes && <p className="break-words text-xs text-ink-muted">{entry.notes}</p>}
                </div>
                <p className="whitespace-nowrap text-xs tabular-nums"><strong>{entry.stockDelta > 0 ? "+" : ""}{number.format(entry.stockDelta)}</strong>
                  {" · "}{money(entry.totalAmountCents)}</p>
                {entry.reversed || entry.reversesMovementId ? <span className="text-xs text-ink-muted">
                  {entry.reversed ? x.reversed : x.movementReversal}
                </span> : <Button type="button" variant="outline" size="sm"
                  onClick={() => setOperation({ kind: "reverse", movement: entry })}>{x.reverse}</Button>}
              </li>)}
            </ul>}
          {(movementPage > 1 || movements.hasMore) && <Pager page={movementPage} hasMore={movements.hasMore} onChange={setMovementPage} />}
        </> : <RequestState result={movements} onRetry={refresh} />}
      </>}
    </section>
  </div>;
}
