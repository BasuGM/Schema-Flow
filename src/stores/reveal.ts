import type { ColumnId, TableId } from "@/domain/schema/types";
import { useSchemaStore } from "./schema-store";
import { useUiStore } from "./ui-store";

/**
 * Select and center a table (issues panel "Show table", search). The table list hides tables that
 * don't match its filter, so a filter that would hide this one is cleared. With a column, the
 * canvas centers on that row and highlights it.
 */
export function revealTable(tableId: TableId, columnId?: ColumnId): void {
  const ui = useUiStore.getState();
  const name = useSchemaStore.getState().schema?.tables[tableId]?.name ?? "";
  const q = ui.tableFilter.trim().toLowerCase();
  if (q && !name.toLowerCase().includes(q)) ui.setTableFilter("");
  ui.focusTable(tableId, columnId);
}
