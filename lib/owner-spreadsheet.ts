import { dictionaries, type Dictionary, type Locale } from "@/lib/i18n";
import { expenseCategories, paymentMethods } from "@/lib/types/finance";

export type ImportKind = "inventory" | "expenses";
type Values = Record<string, string>;
const maxInt = 2147483647;
const fold = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function integerValue(value: string) {
  const parsed = /^\d+$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed <= maxInt ? parsed : null;
}

export function moneyCents(value: string) {
  const raw = value.trim().replace(/\s/g, "");
  const grouped = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw);
  const normalized = (grouped ? raw.replaceAll(".", "") : raw).replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimal = ""] = normalized.split(".");
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return amount <= maxInt ? amount : null;
}

function dateValue(value: string) {
  const parts = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const iso = parts ? parts[3] + "-" + parts[2].padStart(2, "0") + "-" + parts[1].padStart(2, "0") : value;
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(iso + "T00:00:00Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

function headers(kind: ImportKind, t: Dictionary): Record<string, string> {
  const x = t.executive;
  const f = t.finance;
  return kind === "inventory" ? {
    name: x.name, sku: x.sku, category: f.expenseCategory, unit: x.unit, initialStock: x.initialStock,
    minStock: x.minStock, costPrice: x.costPrice, salePrice: x.salePrice,
  } : {
    description: f.expenseDescription, category: f.expenseCategory, expenseType: f.expenseType,
    quantity: f.quantity, unitAmount: f.unitAmount, amount: f.totalAmount, dueDate: f.expenseDue,
    status: f.expenseStatus, paidOn: f.expensePaidOn, method: f.method, recurring: f.expenseRecurring, notes: f.financeNotes,
  };
}

export function importColumns(kind: ImportKind, t: Dictionary) { return Object.entries(headers(kind, t)); }

export function templateRows(kind: ImportKind, t: Dictionary, today: string) {
  const x = t.executive;
  const f = t.finance;
  return [Object.values(headers(kind, t)), ...(kind === "inventory" ? [
    [x.importExample.stock1, "SKU-001", x.categories.RESALE_PRODUCT, "UN", "12", "3", "15,00", "29,90"],
    [x.importExample.stock2, "SKU-002", x.categories.INTERNAL_SUPPLY, "ML", "500", "100", "0,05", ""],
  ] : [
    [x.importExample.expense1, f.expenseCategories.RENT, f.expenseFixed, "1", "", "850,00", today, f.expensePending, "", "", "", ""],
    [x.importExample.expense2, f.expenseCategories.OTHER, f.expenseVariable, "2", "12,50", "", today, f.expensePaid, today, "PIX", "", ""],
  ])];
}

function readCsv(text: string) {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const first = source.split("\n", 1)[0].replace(/"(?:""|[^"])*"/g, "");
  const separator = [";", ",", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === separator || char === "\n" || char === "\r") {
      row.push(field);
      if (char !== separator) { rows.push(row); row = []; }
      field = "";
      closed = false;
    } else if (char === '"' && field === "" && !closed) {
      quoted = true;
    } else {
      if (closed && char.trim()) throw new Error("csv");
      if (!closed) field += char;
    }
  }
  if (quoted) throw new Error("csv");
  if (row.length || field || closed) rows.push([...row, field]);
  return rows;
}

export async function readImport(file: File, kind: ImportKind) {
  if (file.size > 5 * 1024 * 1024) throw new Error("size");
  const name = file.name.toLowerCase();
  let rows: string[][];
  if (name.endsWith(".csv")) rows = readCsv(await file.text());
  else if (name.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    rows = (await readSheet(file, 1)).map((row) => row.map((cell) =>
      cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? "")));
  } else throw new Error("type");
  const filled = rows.filter((row) => row.some((cell) => cell.trim()));
  const [first, ...data] = filled;
  if (!first || !data.length || data.length > 500) throw new Error("rows");
  const translations = (["pt-BR", "es"] as const).map((locale) => headers(kind, dictionaries[locale]));
  const keys = Object.keys(translations[0]);
  const columns = first.map((name) => keys.find((key) =>
    [key, ...translations.map((set) => set[key])].some((candidate) => fold(candidate) === fold(name))));
  const required = kind === "inventory" ? ["name", "category", "unit", "costPrice"] : ["description", "category", "expenseType", "dueDate"];
  const mapped = columns.filter((key): key is string => !!key);
  if (mapped.length !== new Set(mapped).size || !required.every((key) => mapped.includes(key)) ||
      (kind === "expenses" && !mapped.includes("amount") && !mapped.includes("unitAmount"))) throw new Error("headers");
  if (data.some((row) => row.slice(columns.length).some((cell) => cell.trim()))) throw new Error("columns");
  return data.map((row) => Object.fromEntries(columns.flatMap((key, index) => key ? [[key, row[index]?.trim() ?? ""]] : [])));
}

function options<K extends string>(value: string, keys: readonly K[], labels: (locale: Locale, key: K) => string) {
  return keys.find((key) => [key, labels("pt-BR", key), labels("es", key)].some((label) => fold(label) === fold(value)));
}

export function validateImport(kind: ImportKind, values: Values, t: Dictionary, today: string) {
  const error: Record<string, string> = {};
  const v = (key: string) => (values[key] ?? "").trim();
  const check = (key: string, invalid: boolean, message = t.executive.importRequired) => { if (invalid) error[key] = message; };
  if (kind === "inventory") {
    const name = v("name");
    const sku = v("sku");
    const category = options(v("category"), ["RESALE_PRODUCT", "INTERNAL_SUPPLY"], (l, k) => dictionaries[l].executive.categories[k]);
    const unit = options(v("unit"), ["UN", "ML", "G", "BOX", "OTHER"], (l, k) => dictionaries[l].executive.units[k]);
    const initialStock = v("initialStock") ? integerValue(v("initialStock")) : 0;
    const minStock = v("minStock") ? integerValue(v("minStock")) : 0;
    const costPriceCents = moneyCents(v("costPrice"));
    const salePriceCents = v("salePrice") ? moneyCents(v("salePrice")) : null;
    check("name", !name || name.length > 240);
    check("sku", sku.length > 80);
    check("category", !category);
    check("unit", !unit);
    check("initialStock", initialStock === null || (initialStock ?? 0) * (costPriceCents ?? 0) > maxInt);
    check("minStock", minStock === null);
    check("costPrice", costPriceCents === null);
    check("salePrice", !!v("salePrice") && salePriceCents === null);
    return { error, data: { name, sku: sku || null, category, unit, initialStock, minStock, costPriceCents, salePriceCents } };
  }
  const description = v("description");
  const category = options(v("category"), expenseCategories, (l, k) => dictionaries[l].finance.expenseCategories[k]);
  const expenseType = options(v("expenseType"), ["FIXED", "VARIABLE"], (l, k) => k === "FIXED" ? dictionaries[l].finance.expenseFixed : dictionaries[l].finance.expenseVariable);
  const status = v("status") ? options(v("status"), ["PENDING", "PAID"], (l, k) =>
    k === "PAID" ? dictionaries[l].finance.expensePaid : dictionaries[l].finance.expensePending) : "PENDING";
  const quantity = v("quantity") ? integerValue(v("quantity")) : 1;
  const unitAmountCents = v("unitAmount") ? moneyCents(v("unitAmount")) : null;
  const amountCents = v("amount") ? moneyCents(v("amount")) : null;
  const dueDate = dateValue(v("dueDate"));
  const paidOn = dateValue(v("paidOn"));
  const paymentMethod = options(v("method"), paymentMethods, (l, k) => dictionaries[l].finance.paymentMethods[k]);
  const recurring = fold(v("recurring"));
  const notes = v("notes");
  check("description", !description || description.length > 240);
  check("category", !category);
  check("expenseType", !expenseType);
  check("status", !status);
  check("quantity", !quantity || (!unitAmountCents && quantity !== 1));
  check("unitAmount", !!v("unitAmount") && (!unitAmountCents || unitAmountCents * (quantity ?? 0) > maxInt));
  check("amount", (!unitAmountCents && !amountCents) || (!!v("amount") &&
    (!amountCents || (!!unitAmountCents && amountCents !== unitAmountCents * (quantity ?? 0)))));
  check("dueDate", !dueDate, t.executive.importDateExample);
  check("paidOn", status === "PAID" ? !paidOn || paidOn > today : !!v("paidOn"),
    paidOn && paidOn > today ? t.executive.importPayDate : t.executive.importPaidRequired);
  check("method", status === "PAID" ? !paymentMethod : !!v("method"), t.executive.importPaidRequired);
  check("recurring", !["", "true", "false", "sim", "si", "nao", "no", "1", "0"].includes(recurring));
  check("notes", notes.length > 1000);
  return { error, data: { description, category, expenseType, status, quantity, unitAmountCents,
    ...(amountCents === null ? {} : { amountCents }),
    dueDate, paidOn, paymentMethod: paymentMethod ?? null, isRecurring: ["true", "sim", "si", "1"].includes(recurring), notes: notes || null,
  } };
}

export async function importRequestKey(kind: ImportKind, rows: unknown[]) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([kind, rows]))));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
