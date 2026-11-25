import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ResponsiveTableColumn<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
  render: (item: T, index: number) => ReactNode;
}

export interface ResponsiveDataTableProps<T> {
  items: readonly T[];
  getRowKey: (item: T, index: number) => string;
  columns: readonly ResponsiveTableColumn<T>[];
  renderMobileCard: (item: T, index: number) => ReactNode;
  emptyState?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  tableMinWidthClassName?: string;
  className?: string;
}

const alignClasses = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * Padrão Mobile-First para tabelas operacionais dos dashboards:
 * exibe tabela compacta em desktop (`md+`) e lista com divisores finos em mobile,
 * eliminando rolagem horizontal forçada em telas estreitas.
 */
export function ResponsiveDataTable<T>({
  items,
  getRowKey,
  columns,
  renderMobileCard,
  emptyState,
  toolbar,
  footer,
  tableMinWidthClassName = "min-w-full",
  className,
}: ResponsiveDataTableProps<T>) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-xs",
        className,
      )}
    >
      {toolbar}

      {items.length === 0 ? (
        <div className="p-6">{emptyState}</div>
      ) : (
        <>
          {/* Vista Mobile: linhas/cartões compactos separados por divisores finos */}
          <ul className="divide-y divide-border-subtle md:hidden">
            {items.map((item, index) => (
              <li key={getRowKey(item, index)} className="p-3.5">
                {renderMobileCard(item, index)}
              </li>
            ))}
          </ul>

          {/* Vista Desktop: tabela semântica com cabeçalho sutil e densidade operacional */}
          <div className="hidden overflow-x-auto md:block">
            <table className={cn("w-full border-collapse text-sm", tableMinWidthClassName)}>
              <thead>
                <tr className="border-b border-border-subtle bg-subtle/50 text-xs font-semibold text-ink-secondary">
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn(
                        "px-4 py-2.5 whitespace-nowrap",
                        alignClasses[column.align ?? "left"],
                        column.headerClassName,
                      )}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/80">
                {items.map((item, index) => (
                  <tr
                    key={getRowKey(item, index)}
                    className="transition-colors hover:bg-subtle/40"
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-4 py-3 align-middle text-ink",
                          alignClasses[column.align ?? "left"],
                          column.className,
                        )}
                      >
                        {column.render(item, index)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {footer && (
        <div className="border-t border-border-subtle bg-subtle/30 px-4 py-3">
          {footer}
        </div>
      )}
    </section>
  );
}
