import type { ColumnId, TableId } from "@/domain/schema/types";

/**
 * Handle IDs. Each column row has a `source` handle on its left edge (where FK edges start) and a
 * `target` handle on its right edge (where references arrive). With the default LR layout,
 * referenced (parent) tables sit to the left of the tables that reference them.
 * Header handles are used when a column is hidden by a collapse mode.
 */
export function columnHandleId(column: ColumnId, kind: "source" | "target"): string {
  return `${kind}:${column}`;
}

export function headerHandleId(table: TableId, kind: "source" | "target"): string {
  return `${kind}:${table}::header`;
}
