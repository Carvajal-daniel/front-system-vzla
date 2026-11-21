import type { Currency, PaymentMethod } from "./finance";

export const inventoryCategories = ["RESALE_PRODUCT", "INTERNAL_SUPPLY"] as const;
export const inventoryUnits = ["UN", "ML", "G", "BOX", "OTHER"] as const;
export const outgoingMovementTypes = ["SALE_OUT", "COLLABORATOR_WITHDRAWAL", "INTERNAL_CONSUMPTION"] as const;
export type InventoryCategory = (typeof inventoryCategories)[number];
export type InventoryUnit = (typeof inventoryUnits)[number];
export type InventoryMovementType = "PURCHASE_IN" | "ADJUSTMENT" | (typeof outgoingMovementTypes)[number];

export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  category: InventoryCategory;
  unit: InventoryUnit;
  currentStock: number;
  minStock: number;
  costPriceCents: number;
  salePriceCents: number | null;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  itemName: string;
  movementType: InventoryMovementType;
  quantity: number;
  stockDelta: number;
  totalAmountCents: number;
  collaboratorName: string | null;
  paymentMethod: PaymentMethod | null;
  financeReferenceType: "EXPENSE" | "PRODUCT_SALE" | "COMMISSION_DEDUCTION" | null;
  notes: string | null;
  occurredOn: string;
  reversesMovementId: string | null;
  reversed: boolean;
}

export interface InventorySummary {
  totalItems: number;
  stockCostCents: number;
  lowStockItems: number;
  outgoingMovements: number;
  salesCents: number;
  currency: Currency;
  today: string;
}

export interface InventoryList<T> { items: T[]; hasMore: boolean }
