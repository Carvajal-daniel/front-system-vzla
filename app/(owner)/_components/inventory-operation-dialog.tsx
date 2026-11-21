"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiRequest } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import { integerValue, moneyCents } from "@/lib/owner-spreadsheet";
import { paymentMethods, type PaymentMethod } from "@/lib/types/finance";
import {
  inventoryCategories, inventoryUnits, outgoingMovementTypes,
  type InventoryCategory, type InventoryItem, type InventoryList, type InventoryMovement, type InventoryMovementType, type InventoryUnit,
} from "@/lib/types/inventory";
import { OwnerModal, ownerControl, ownerField } from "./owner-modal";
import { useOwnerInventory } from "./use-owner-inventory";

export type InventoryOperation =
  | { kind: "item"; item?: InventoryItem }
  | { kind: "movement"; mode: "in" | "out" | "adjust"; item?: InventoryItem }
  | { kind: "archive"; item: InventoryItem }
  | { kind: "reverse"; movement: InventoryMovement };

type Staff = { id: string; name: string; isActive: boolean };

export function InventoryOperationDialog({ operation, today, onClose, onSaved }: {
  operation: InventoryOperation;
  today: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { t } = useLocale();
  const { executive: x, finance: f } = t;
  const existing = operation.kind === "item" ? operation.item : undefined;
  const picked = operation.kind === "movement" ? operation.item : undefined;
  const [product, setProduct] = useState(picked);
  const [name, setName] = useState(existing?.name ?? "");
  const [sku, setSku] = useState(existing?.sku ?? "");
  const [category, setCategory] = useState<InventoryCategory>(existing?.category ?? "RESALE_PRODUCT");
  const [unit, setUnit] = useState<InventoryUnit>(existing?.unit ?? "UN");
  const [minimum, setMinimum] = useState(String(existing?.minStock ?? 0));
  const [quantity, setQuantity] = useState(operation.kind === "item" ? "0" : "1");
  const [cost, setCost] = useState(existing ? (existing.costPriceCents / 100).toFixed(2) : "");
  const [salePrice, setSalePrice] = useState(existing?.salePriceCents != null ? (existing.salePriceCents / 100).toFixed(2) : "");
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState<InventoryMovementType>(operation.kind === "movement" && operation.mode === "in"
    ? "PURCHASE_IN" : operation.kind === "movement" && operation.mode === "adjust" ? "ADJUSTMENT"
      : picked?.category === "INTERNAL_SUPPLY" ? "INTERNAL_CONSUMPTION" : "SALE_OUT");
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [collaboratorId, setCollaboratorId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PIX");
  const [postExpense, setPostExpense] = useState(false);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const saving = useRef(false);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const products = useOwnerInventory<InventoryList<InventoryItem>>(
    operation.kind === "movement" && !picked ? "/inventory/items?search=" + encodeURIComponent(search) : null, lookupAttempt,
  );
  const directory = useOwnerInventory<Staff[] | { collaborators: Staff[] }>(
    operation.kind === "movement" && movementType === "COLLABORATOR_WITHDRAWAL" ? "/collaborators" : null, lookupAttempt,
  );
  const options = products?.items ?? [];
  const staff = Array.isArray(directory) ? directory : directory?.collaborators ?? [];
  const title = operation.kind === "movement"
    ? { in: x.registerIn, out: x.registerOut, adjust: x.adjustment }[operation.mode]
    : operation.kind === "item" ? existing ? x.editItem : x.newItem
      : operation.kind === "archive" ? x.archiveItem : x.reverse;
  const confirm = operation.kind === "archive" || operation.kind === "reverse";
  const sale = movementType === "SALE_OUT";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true;
    setError("");
    setBusy(true);
    try {
      if (operation.kind === "item") {
        const costPriceCents = moneyCents(cost);
        const salePriceCents = salePrice.trim() ? moneyCents(salePrice) : null;
        const initialStock = integerValue(quantity);
        const minStock = integerValue(minimum);
        if (!name.trim() || costPriceCents === null || (salePrice.trim() && salePriceCents === null) || initialStock === null || minStock === null) {
          setError(x.importRequired);
          return;
        }
        const details = { name, sku: sku.trim() || null, category, unit, minStock, costPriceCents, salePriceCents };
        await apiRequest(existing ? "/inventory/items/" + existing.id : "/inventory/items", {
          method: existing ? "PATCH" : "POST", body: existing ? details : { ...details, initialStock },
        });
      } else if (operation.kind === "movement") {
        const units = integerValue(quantity);
        const price = (sale ? salePrice : cost).trim();
        const override = price ? moneyCents(price) : undefined;
        if (!product || !units || override === null) { setError(x.INVENTORY_MOVEMENT_FIELDS); return; }
        const body = {
          itemId: product.id, movementType, quantity: units, occurredOn: date, notes,
          ...(sale ? { unitSaleCents: override, paymentMethod } : { unitCostCents: override }),
          ...(movementType === "COLLABORATOR_WITHDRAWAL" ? { collaboratorId } : {}),
          ...(movementType === "ADJUSTMENT" ? { direction } : {}),
          postExpense: movementType === "PURCHASE_IN" && postExpense,
        };
        const fingerprint = JSON.stringify(body);
        if (request.current?.fingerprint !== fingerprint) request.current = { fingerprint, key: crypto.randomUUID() };
        await apiRequest("/inventory/movements", { method: "POST", body: { ...body, requestKey: request.current.key } });
      } else if (operation.kind === "archive") {
        await apiRequest("/inventory/items/" + operation.item.id, { method: "DELETE" });
      } else {
        await apiRequest("/inventory/movements/" + operation.movement.id + "/reverse", { method: "POST" });
      }
      onSaved(x.saved);
    } catch (failure) {
      const code = failure instanceof ApiError ? failure.message : "";
      setError(Object.hasOwn(x, code) ? String(x[code as keyof typeof x])
        : Object.hasOwn(f, code) ? String(f[code as keyof typeof f]) : t.errors.unexpectedDescription);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <OwnerModal title={title} onClose={onClose} busy={busy}>
      <form className="space-y-4" onSubmit={submit}>
        {confirm ? <div className="rounded-lg bg-subtle p-3 text-sm">
          <p className="font-semibold">{operation.kind === "archive" ? operation.item.name : operation.movement.itemName}</p>
          <p className="mt-1 text-ink-secondary">{operation.kind === "archive" ? x.archiveImpact : x.reverseImpact}</p>
        </div> : <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          {operation.kind === "item" ? <>
            <label className={ownerField}>{x.name}<Input required maxLength={240} placeholder={x.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className={ownerField}>{x.sku}<Input maxLength={80} placeholder={x.skuPlaceholder} value={sku} onChange={(e) => setSku(e.target.value)} /></label>
            <label className={ownerField}>{f.expenseCategory}<select className={ownerControl} value={category}
              onChange={(e) => setCategory(e.target.value as InventoryCategory)}>
              {inventoryCategories.map((value) => <option key={value} value={value}>{x.categories[value]}</option>)}
            </select></label>
            <label className={ownerField}>{x.unit}<select className={ownerControl} value={unit} onChange={(e) => setUnit(e.target.value as InventoryUnit)}>
              {inventoryUnits.map((value) => <option key={value} value={value}>{x.units[value]}</option>)}
            </select></label>
            <label className={ownerField}>{x.minStock}<Input required type="number" min={0} step={1} placeholder={x.minStockPlaceholder} value={minimum} onChange={(e) => setMinimum(e.target.value)} /></label>
            {!existing && <label className={ownerField}>{x.initialStock}<Input required type="number" min={0} step={1}
              placeholder={x.initialStockPlaceholder} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>}
            <label className={ownerField}>{x.costPrice}<Input required inputMode="decimal" placeholder={x.costPricePlaceholder} value={cost} onChange={(e) => setCost(e.target.value)} /></label>
            <label className={ownerField}>{x.salePrice}<Input inputMode="decimal" placeholder={x.salePricePlaceholder} value={salePrice} onChange={(e) => setSalePrice(e.target.value)} /></label>
          </> : <>
            {picked ? <p className="font-semibold sm:col-span-2">{picked.name} · {picked.currentStock} {picked.unit}</p> : <>
              <label className={ownerField + " sm:col-span-2"}>{x.inventorySearch}<Input value={search} maxLength={100}
                onChange={(e) => setSearch(e.target.value)} /></label>
              <label className={ownerField + " sm:col-span-2"}>{x.selectItem}
                <select required className={ownerControl} value={product?.id ?? ""} onChange={(e) => {
                  const next = options.find((item) => item.id === e.target.value);
                  setProduct(next);
                  if (next?.category === "INTERNAL_SUPPLY" && sale) setMovementType("INTERNAL_CONSUMPTION");
                }}>
                  <option value="" disabled>{products === undefined ? t.common.loading : x.selectItem}</option>
                  {product && !options.some((item) => item.id === product.id) && <option value={product.id}>{product.name}</option>}
                  {options.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.currentStock} {item.unit}</option>)}
                </select>
              </label>
              {products?.hasMore && <p className="text-xs text-ink-muted sm:col-span-2">{x.inventorySearch}</p>}
            </>}
            {operation.kind === "movement" && operation.mode === "out" && (
              <label className={ownerField}>{x.movementKind}<select className={ownerControl} value={movementType}
                onChange={(e) => setMovementType(e.target.value as InventoryMovementType)}>
                {outgoingMovementTypes.filter((value) => value !== "SALE_OUT" || product?.category !== "INTERNAL_SUPPLY")
                  .map((value) => <option key={value} value={value}>{x.movements[value]}</option>)}
              </select></label>
            )}
            {movementType === "ADJUSTMENT" && <label className={ownerField}>{x.movementKind}
              <select className={ownerControl} value={direction} onChange={(e) => setDirection(e.target.value as "IN" | "OUT")}>
                <option value="IN">{x.registerIn}</option><option value="OUT">{x.registerOut}</option>
              </select>
            </label>}
            {movementType === "COLLABORATOR_WITHDRAWAL" && <label className={ownerField}>{x.collaborator}
              <select required className={ownerControl} value={collaboratorId} onChange={(e) => setCollaboratorId(e.target.value)}>
                <option value="" disabled>{directory === undefined ? t.common.loading : f.chooseDeductionProfessional}</option>
                {staff.filter((person) => person.isActive).map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </label>}
            {(products === null || directory === null) && <p className="flex items-center gap-2 text-xs text-ink-muted sm:col-span-2">
              {t.errors.networkDescription}<Button type="button" variant="outline" size="sm" onClick={() => setLookupAttempt((n) => n + 1)}>{t.common.retry}</Button>
            </p>}
            <label className={ownerField}>{f.quantity}<Input required type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></label>
            <label className={ownerField}>{sale ? x.salePrice : x.costPrice}<Input inputMode="decimal" value={sale ? salePrice : cost}
              placeholder={sale ? product?.salePriceCents == null ? undefined : (product.salePriceCents / 100).toFixed(2)
                : product ? (product.costPriceCents / 100).toFixed(2) : undefined}
              onChange={(e) => (sale ? setSalePrice : setCost)(e.target.value)} /></label>
            {sale && <label className={ownerField}>{f.method}<select className={ownerControl} value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
              {paymentMethods.map((method) => <option key={method} value={method}>{f.paymentMethods[method]}</option>)}
            </select></label>}
            <label className={ownerField}>{x.date}<Input required type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} /></label>
            {movementType === "PURCHASE_IN" && <label className="flex items-center gap-2 text-xs sm:col-span-2">
              <input type="checkbox" checked={postExpense} onChange={(e) => setPostExpense(e.target.checked)} className="accent-accent" />
              {x.postPurchaseExpense}
            </label>}
            <label className={ownerField + " sm:col-span-2"}>{f.financeNotes}<textarea className={ownerControl + " h-auto py-2"}
              rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          </>}
        </fieldset>}
        {error && <p role="alert" className="text-sm text-[var(--status-danger-ink)]">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{t.common.cancel}</Button>
          <Button type="submit" variant={confirm ? "destructive" : "default"} disabled={busy}>
            {busy ? t.common.saving : confirm ? title : t.common.save}
          </Button>
        </div>
      </form>
    </OwnerModal>
  );
}
