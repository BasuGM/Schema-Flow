import { findPath, type TablePath } from "@/domain/schema/path";
import type { ColumnId, TableId } from "@/domain/schema/types";
import { useSchemaStore } from "./schema-store";
import { useUiStore, type FocusOptions } from "./ui-store";

/**
 * Select and center a table (table list, issues panel "Show table", search, inspector links). The
 * table list hides tables that don't match its filter, so a filter that would hide this one is
 * cleared. With a column, the canvas centers on that row (or, with `mode: "ensure-visible"`, pans
 * only if it is off-screen) and highlights it.
 */
export function revealTable(tableId: TableId, columnId?: ColumnId, options?: FocusOptions): void {
  const ui = useUiStore.getState();
  const name = useSchemaStore.getState().schema?.tables[tableId]?.name ?? "";
  const q = ui.tableFilter.trim().toLowerCase();
  if (q && !name.toLowerCase().includes(q)) ui.setTableFilter("");
  ui.focusTable(tableId, columnId, options);
}

/**
 * Inspector Relations navigation: go to the related table (highlighting the referenced column),
 * stay on Relations, and remember where we came from for "Back".
 */
export function navigateToRelated(tableId: TableId, columnId?: ColumnId): void {
  const { selectedTableId: from, inspectorTab: tab } = useUiStore.getState();
  revealTable(tableId, columnId, { tab: "relations" });
  if (from && from !== tableId) useUiStore.getState().setInspectorBack({ tableId: from, tab });
}

/** "Back": the table and the tab the user was on before Relations navigation. */
export function inspectorGoBack(): void {
  const back = useUiStore.getState().inspectorBack;
  if (!back) return;
  revealTable(back.tableId, undefined, { tab: back.tab });
}

/**
 * Path finder (P4-T02): find the shortest chain of foreign keys and make it the active path, so
 * the canvas highlights it. Returns the path, or null when the tables are not connected; either
 * way the earlier path is replaced, so the canvas never shows a path the panel doesn't describe.
 */
export function showPath(from: TableId, to: TableId): TablePath | null {
  const schema = useSchemaStore.getState().schema;
  const path = schema ? findPath(schema, from, to) : null;
  if (!path) {
    useUiStore.getState().setActivePath(null);
    return null;
  }
  useUiStore.getState().setActivePath({
    from,
    to,
    path,
    tables: new Set(path.tables),
    relationships: new Set(path.hops.map((h) => h.relationshipId)),
  });
  return path;
}
