"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, apiRequest } from "@/lib/api-client";
import { useLocale } from "@/lib/i18n/locale-context";
import { importColumns, importRequestKey, readImport, templateRows, validateImport, type ImportKind } from "@/lib/owner-spreadsheet";
import { OwnerModal, ownerControl } from "./owner-modal";

const pageSize = 20;

export function SpreadsheetImport({ kind, today, onClose, onImported }: {
  kind: ImportKind;
  today: string;
  onClose: () => void;
  onImported: (message: string) => void;
}) {
  const { t, locale } = useLocale();
  const x = t.executive;
  const [rows, setRows] = useState<{ values: Record<string, string>; enabled: boolean }[]>([]);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef(false);
  const columns = importColumns(kind, t);
  const selectedSkus = new Map<string, number>();
  if (kind === "inventory") {
    for (const row of rows) {
      const sku = row.values.sku?.trim().toLowerCase();
      if (row.enabled && sku) selectedSkus.set(sku, (selectedSkus.get(sku) ?? 0) + 1);
    }
  }
  const checked = rows.map((row) => {
    const result = validateImport(kind, row.values, t, today);
    const sku = row.values.sku?.trim().toLowerCase();
    if (row.enabled && sku && (selectedSkus.get(sku) ?? 0) > 1) result.error.sku = x.importDuplicateSku;
    return { ...row, ...result, valid: !Object.keys(result.error).length };
  });
  const selected = checked.filter((row) => row.enabled && row.valid);
  const hasErrors = checked.some((row) => row.enabled && !row.valid);
  const pageCount = Math.ceil(rows.length / pageSize);

  function download() {
    const csv = templateRows(kind, t, today).map((row) => row.map((cell) =>
      '"' + cell.replaceAll('"', '""') + '"').join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = (kind === "inventory" ? x.stock : t.finance.expenseTab).toLowerCase() + "-" + locale + ".csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function load(file?: File) {
    if (!file || operation.current) return;
    operation.current = true;
    setBusy(true);
    setError("");
    setRows([]);
    setPage(0);
    try {
      setRows((await readImport(file, kind)).map((values) => ({ values, enabled: true })));
    } catch (failure) {
      setError(failure instanceof Error && failure.message === "headers" ? x.importHeaderError : x.importReadError);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  async function confirm() {
    if (operation.current || hasErrors || !selected.length) return;
    operation.current = true;
    setBusy(true);
    setError("");
    try {
      const payload = selected.map((row) => row.data);
      const requestKey = await importRequestKey(kind, payload);
      const path = kind === "inventory" ? "/inventory/items/import" : "/finance/expenses/import";
      const result = await apiRequest<{ imported: number }>(path, { method: "POST", body: { requestKey, rows: payload } });
      onImported(x.importReport + " · " + new Intl.NumberFormat(locale).format(result.imported));
    } catch (failure) {
      const code = failure instanceof ApiError ? failure.message : "";
      setError(Object.hasOwn(x, code) ? String(x[code as keyof typeof x])
        : Object.hasOwn(t.finance, code) ? String(t.finance[code as keyof typeof t.finance]) : t.errors.unexpectedDescription);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  return (
    <OwnerModal title={x.importSheet} onClose={onClose} wide busy={busy}>
      <div className="space-y-4">
        <div className="space-y-1 text-sm text-ink-secondary"><p>{x.importHelp}</p><p className="text-xs">{x.importLimit}</p></div>
        <div className="flex flex-wrap items-end gap-3">
          <Button type="button" variant="outline" onClick={download}><Download aria-hidden="true" />{x.downloadTemplate}</Button>
          <label className="grid gap-1 text-xs font-medium text-ink-secondary">{x.uploadFile}
            <input type="file" disabled={busy} accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="max-w-full rounded-lg border border-border-subtle bg-subtle p-1 text-xs file:me-2 file:rounded-md file:border-0 file:bg-surface file:px-2 file:py-1 file:text-ink"
              onChange={(event) => { void load(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
          </label>
        </div>
        {!!rows.length && (
          <>
            <p className="text-xs font-semibold">{x.importSelected} · {selected.length}</p>
            <div className="overflow-x-auto rounded-xl border border-border-subtle">
              <table className="w-full text-left text-xs">
                <thead className="bg-subtle text-ink-secondary">
                  <tr><th scope="col" className="p-2">#</th>{columns.map(([key, label]) =>
                    <th key={key} scope="col" className="min-w-32 p-2">{label}</th>)}
                    <th scope="col" className="p-2">{t.common.status}</th></tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {checked.slice(page * pageSize, (page + 1) * pageSize).map((row, offset) => {
                    const index = page * pageSize + offset;
                    const tone = row.valid ? "bg-[var(--status-success-bg)] text-[var(--status-success-ink)]"
                      : "bg-[var(--status-danger-bg)] text-[var(--status-danger-ink)]";
                    return <tr key={index} className={row.enabled ? tone : "bg-subtle text-ink-muted"}>
                      <th scope="row" className="p-2 align-top">
                        <label className="flex items-center gap-1"><input type="checkbox" checked={row.enabled}
                          disabled={busy} className="accent-accent" onChange={(event) => {
                            const enabled = event.target.checked;
                            setRows((current) => current.map((item, i) => i === index ? { ...item, enabled } : item));
                          }} />{index + 1}</label>
                      </th>
                      {columns.map(([key, label]) => <td key={key} className="p-2 align-top">
                        <input className={ownerControl + " h-8 px-2 text-xs"} aria-label={label + " · " + (index + 1)}
                          aria-invalid={!!row.error[key]} aria-describedby={row.error[key] ? "import-error-" + index + "-" + key : undefined}
                          disabled={busy} value={row.values[key] ?? ""} onChange={(event) => {
                            const value = event.target.value;
                            setRows((current) => current.map((item, i) => i === index ? { ...item, values: { ...item.values, [key]: value } } : item));
                          }} />
                        {row.error[key] && <p id={"import-error-" + index + "-" + key} className="mt-1 font-medium">{row.error[key]}</p>}
                      </td>)}
                      <td className="p-2 align-top font-medium">{row.valid ? x.importValid : Object.values(row.error)[0]}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && <div className="flex items-center justify-end gap-2 text-xs">
              <Button type="button" size="sm" variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>{t.common.back}</Button>
              <span>{page + 1} / {pageCount}</span>
              <Button type="button" size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>{t.finance.moreMovements}</Button>
            </div>}
          </>
        )}
        {error && <p role="alert" className="text-sm text-[var(--status-danger-ink)]">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t.common.cancel}</Button>
          <Button type="button" disabled={busy || !selected.length || hasErrors} onClick={() => void confirm()}>
            <Upload aria-hidden="true" />{busy ? t.common.loading : x.importConfirm}
          </Button>
        </div>
      </div>
    </OwnerModal>
  );
}
