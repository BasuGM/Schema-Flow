"use client";

import type { ColumnName } from "@/domain/schema/table-details";
import type { TableId } from "@/domain/schema/types";
import { cn } from "@/lib/utils";
import { revealTable } from "@/stores/reveal";

/**
 * An explicit "go to this column" link (FK targets, key sections): reveals the table, centers the
 * canvas on the row, highlights it and shows the Columns tab.
 */
export function ColumnLink({
  tableId,
  table,
  column,
  className,
  testId,
}: {
  tableId: TableId;
  /** Shown as `table.column` when given. */
  table?: string;
  column: ColumnName;
  className?: string;
  testId?: string;
}) {
  const label = table ? `${table}.${column.name}` : column.name;
  return (
    <button
      type="button"
      onClick={() => revealTable(tableId, column.id)}
      aria-label={`Highlight column ${label}`}
      className={cn(
        "rounded-sm font-mono text-xs text-brand underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      data-testid={testId}
    >
      {label}
    </button>
  );
}
