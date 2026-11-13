import type { CollapseMode, Column, Table } from "@/domain/schema/types";

/** Shared between layout estimation and the TableNode renderer so handles line up with rows. */
export const NODE_WIDTH = 280;
export const NODE_HEADER_HEIGHT = 40;
export const NODE_ROW_HEIGHT = 26;
export const NODE_PADDING_Y = 6;

/** Columns rendered for a collapse mode. `keys` keeps primary- and foreign-key columns. */
export function visibleColumns(table: Table, mode: CollapseMode): Column[] {
  if (mode === "header") return [];
  if (mode === "keys") return table.columns.filter((c) => c.isPrimaryKey || c.isForeignKey);
  return table.columns;
}

export function estimateNodeHeight(rowCount: number): number {
  return NODE_HEADER_HEIGHT + (rowCount > 0 ? rowCount * NODE_ROW_HEIGHT + NODE_PADDING_Y * 2 : 0);
}
