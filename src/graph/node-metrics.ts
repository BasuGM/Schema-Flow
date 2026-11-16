import type { CollapseMode, Column, ColumnId, Table } from "@/domain/schema/types";

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

/**
 * Rows a node renders: the visible columns plus a highlighted column the mode would hide (a
 * search hit must be visible on the canvas), in declaration order.
 */
export function renderedColumns(
  table: Table,
  mode: CollapseMode,
  highlighted: ColumnId | null = null,
): Column[] {
  const visible = visibleColumns(table, mode);
  if (!highlighted || visible.some((c) => c.id === highlighted)) return visible;
  const shown = new Set(visible.map((c) => c.id)).add(highlighted);
  return table.columns.filter((c) => shown.has(c.id));
}

/** Vertical offset of a rendered row's centre from the top of its node, or null if not rendered. */
export function rowCenterOffset(rows: Column[], columnId: ColumnId): number | null {
  const index = rows.findIndex((c) => c.id === columnId);
  if (index < 0) return null;
  return NODE_HEADER_HEIGHT + NODE_PADDING_Y + index * NODE_ROW_HEIGHT + NODE_ROW_HEIGHT / 2;
}

export function estimateNodeHeight(rowCount: number): number {
  return NODE_HEADER_HEIGHT + (rowCount > 0 ? rowCount * NODE_ROW_HEIGHT + NODE_PADDING_Y * 2 : 0);
}
