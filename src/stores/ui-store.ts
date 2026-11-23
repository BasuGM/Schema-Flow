import { create } from "zustand";
import type { TablePath } from "@/domain/schema/path";
import type { ColumnId, RelationshipId, TableId } from "@/domain/schema/types";
import { readJson, writeText } from "@/lib/safe-storage";

/**
 * A request for the canvas to center on a table, or on one of its column rows; `nonce` makes
 * repeated requests distinct.
 */
export interface FocusRequest {
  tableId: TableId;
  columnId?: ColumnId;
  /**
   * `center` (default): explicit "go to" actions (list, search, links). `ensure-visible`: pan only
   * if the target row is off-screen (clicking a column in the inspector).
   */
  mode?: "center" | "ensure-visible";
  nonce: number;
}

/** Neighbourhood highlighting depth (P2-T09): 0 = off. */
export type ExportTab = "sql" | "prisma" | "mermaid" | "json" | "image";
export type BottomTab = "issues" | "health";

export type NeighbourhoodDepth = 0 | 1 | 2;

/** Preferences kept across visits (P3-T01). Read after mount, never at store creation. */
export const PREFS_KEY = "schemaflow:prefs:v1";

const isDepth = (v: unknown): v is NeighbourhoodDepth => v === 0 || v === 1 || v === 2;

/**
 * Applies saved preferences. Called once from an effect after mount so the server render and the
 * first client render both use the defaults. An invalid or missing value keeps the default.
 */
export function hydratePrefs(): void {
  const saved = readJson(PREFS_KEY);
  const depth =
    typeof saved === "object" && saved !== null
      ? (saved as Record<string, unknown>).neighbourhoodDepth
      : undefined;
  if (isDepth(depth)) useUiStore.getState().setNeighbourhoodDepth(depth);
}

export type InspectorTab = "columns" | "keys" | "relations" | "path";

/** The path found in the inspector's Path tab (P4-T02); highlighted on the canvas until cleared. */
export interface ActivePath {
  from: TableId;
  to: TableId;
  path: TablePath;
  tables: ReadonlySet<TableId>;
  relationships: ReadonlySet<RelationshipId>;
}

/** A request for the canvas to fit these tables in view; `nonce` makes repeats distinct. */
export interface FitRequest {
  tableIds: readonly TableId[];
  nonce: number;
}

/** Where Relations navigation came from, so "Back" restores the table and the tab. */
export interface InspectorBack {
  tableId: TableId;
  tab: InspectorTab;
}

export interface FocusOptions {
  mode?: FocusRequest["mode"];
  /** Tab to show; omitted = a column highlight switches to Columns, a table keeps the tab. */
  tab?: InspectorTab;
}

/** A column found by search, highlighted in its table node (P2-T07). */
export interface HighlightedColumn {
  tableId: TableId;
  columnId: ColumnId;
}

interface UiState {
  selectedTableId: TableId | null;
  tableFilter: string;
  showMiniMap: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  focusRequest: FocusRequest | null;
  /** Bumped by `clearSelection`; the canvas unpins a clicked edge when it changes. */
  clearRequest: number;
  /** Bottom issues panel (P2-T06). */
  issuesPanelOpen: boolean;
  /** Tab of the bottom panel (P4-T01); session only. */
  issuesPanelTab: BottomTab;
  /** Search and commands dialog (P2-T07, P4-T04). */
  searchOpen: boolean;
  /** Import dialog (P4-T04: in the store so a command or key can open it). */
  importOpen: boolean;
  /** Keyboard shortcuts dialog (P4-T04) and the menu button that gets focus back, if any. */
  shortcutsOpen: boolean;
  shortcutsReturnFocus: string | null;
  /** Bumped to ask the canvas to fit all tables in view (Reset view, P4-T04). */
  resetViewRequest: number;
  /** Export dialog (P3-T03, P3-T05), its tab (session only) and the button that gets focus back. */
  exportOpen: boolean;
  exportTab: ExportTab;
  exportReturnFocus: string | null;
  /** "Clear saved data…" dialog (P3-T06), the button that gets focus back, and its live notice. */
  clearDataOpen: boolean;
  clearDataReturnFocus: string | null;
  clearDataNotice: boolean;
  /** Cleared when the selection changes, on Escape and on a new schema. */
  highlightedColumn: HighlightedColumn | null;
  /** Inspector tab (P2-T08); plain table selection never changes it. */
  inspectorTab: InspectorTab;
  inspectorBack: InspectorBack | null;
  /** A setting: survives selections and new imports. */
  neighbourhoodDepth: NeighbourhoodDepth;
  /**
   * The selected table and its neighbours within `neighbourhoodDepth`; everything else is dimmed.
   * Derived by `useFocusSetSync`; `null` = nothing dimmed.
   */
  focusSet: ReadonlySet<TableId> | null;
  /** Session only; not saved. Cleared by Escape, Clear and a new schema. */
  activePath: ActivePath | null;
  fitRequest: FitRequest | null;
  /** Subject areas hidden on the canvas (P4-T03, ids from `getSubjectAreas`). Session only. */
  hiddenAreas: ReadonlySet<string>;
  /**
   * A large schema is zoomed out past readable row text (`ZoomDetail`, ADR-022/023): table nodes
   * render column rows as skeletons. Set by the canvas only.
   */
  canvasZoomedOut: boolean;
  selectTable: (id: TableId | null) => void;
  /** Escape: clear the table selection and any clicked (pinned) edge. */
  clearSelection: () => void;
  /**
   * Select a table and center the canvas on it (e.g. from the sidebar list). With a column, center
   * on its row and highlight it.
   */
  focusTable: (id: TableId, columnId?: ColumnId, options?: FocusOptions) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setInspectorBack: (back: InspectorBack | null) => void;
  setNeighbourhoodDepth: (depth: NeighbourhoodDepth) => void;
  setFocusSet: (set: ReadonlySet<TableId> | null) => void;
  setActivePath: (path: ActivePath | null) => void;
  setAreaVisible: (areaId: string, visible: boolean) => void;
  /** Hide every area except this one (`allAreaIds` = all area ids of the schema). */
  showOnlyArea: (areaId: string, allAreaIds: readonly string[]) => void;
  showAllAreas: () => void;
  /** Ask the canvas to fit these tables in view (path "Show on canvas"). */
  fitTables: (tableIds: readonly TableId[]) => void;
  setCanvasZoomedOut: (zoomedOut: boolean) => void;
  setTableFilter: (filter: string) => void;
  setShowMiniMap: (show: boolean) => void;
  setPanelOpen: (panel: "left" | "right", open: boolean) => void;
  setIssuesPanelOpen: (open: boolean) => void;
  setIssuesPanelTab: (tab: BottomTab) => void;
  /** Opens the bottom panel on the Health tab. */
  openHealthPanel: () => void;
  setSearchOpen: (open: boolean) => void;
  setImportOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  /** `returnFocusTestId`: the menu trigger the dialog was opened from (omit for a key or command). */
  openShortcuts: (returnFocusTestId?: string) => void;
  requestResetView: () => void;
  /** `returnFocusTestId` is the `data-testid` of the toolbar button the dialog was opened from. */
  openExport: (returnFocusTestId: string, tab?: ExportTab) => void;
  setExportTab: (tab: ExportTab) => void;
  closeExport: () => void;
  openClearData: (returnFocusTestId: string) => void;
  closeClearData: () => void;
  setClearDataNotice: (shown: boolean) => void;
  /** A new import or sample: clear selection, pinned edge, filter and highlight; close search. */
  resetForNewSchema: () => void;
  reset: () => void;
}

const initial = {
  selectedTableId: null,
  tableFilter: "",
  showMiniMap: false,
  leftPanelOpen: true,
  rightPanelOpen: true,
  focusRequest: null,
  clearRequest: 0,
  issuesPanelOpen: false,
  issuesPanelTab: "issues",
  searchOpen: false,
  importOpen: false,
  shortcutsOpen: false,
  shortcutsReturnFocus: null,
  resetViewRequest: 0,
  exportOpen: false,
  exportTab: "sql",
  exportReturnFocus: null,
  clearDataOpen: false,
  clearDataReturnFocus: null,
  clearDataNotice: false,
  highlightedColumn: null,
  inspectorTab: "columns" as InspectorTab,
  inspectorBack: null,
  neighbourhoodDepth: 1 as NeighbourhoodDepth,
  focusSet: null,
  activePath: null,
  fitRequest: null,
  hiddenAreas: new Set<string>() as ReadonlySet<string>,
  canvasZoomedOut: false,
} satisfies Partial<UiState>;

export const useUiStore = create<UiState>()((set) => ({
  ...initial,
  selectTable: (id) =>
    set((s) =>
      s.selectedTableId === id
        ? s
        : { selectedTableId: id, highlightedColumn: null, inspectorBack: null },
    ),
  clearSelection: () =>
    set((s) => ({
      selectedTableId: null,
      highlightedColumn: null,
      inspectorBack: null,
      focusSet: null,
      activePath: null,
      clearRequest: s.clearRequest + 1,
    })),
  focusTable: (id, columnId, options = {}) =>
    set((s) => ({
      selectedTableId: id,
      highlightedColumn: columnId ? { tableId: id, columnId } : null,
      inspectorBack: null,
      inspectorTab: options.tab ?? (columnId ? "columns" : s.inspectorTab),
      focusRequest: {
        tableId: id,
        columnId,
        mode: options.mode,
        nonce: (s.focusRequest?.nonce ?? 0) + 1,
      },
    })),
  setInspectorTab: (inspectorTab) =>
    set((s) => (s.inspectorTab === inspectorTab ? s : { inspectorTab })),
  setInspectorBack: (inspectorBack) => set({ inspectorBack }),
  setNeighbourhoodDepth: (neighbourhoodDepth) =>
    set((s) => {
      if (s.neighbourhoodDepth === neighbourhoodDepth) return s;
      writeText(PREFS_KEY, JSON.stringify({ neighbourhoodDepth }));
      return { neighbourhoodDepth };
    }),
  setFocusSet: (focusSet) => set((s) => (s.focusSet === focusSet ? s : { focusSet })),
  setActivePath: (activePath) => set({ activePath }),
  setAreaVisible: (areaId, visible) =>
    set((s) => {
      if (s.hiddenAreas.has(areaId) === !visible) return s;
      const next = new Set(s.hiddenAreas);
      if (visible) next.delete(areaId);
      else next.add(areaId);
      return { hiddenAreas: next };
    }),
  showOnlyArea: (areaId, allAreaIds) =>
    set((s) => {
      const next = new Set(allAreaIds.filter((id) => id !== areaId));
      const same =
        next.size === s.hiddenAreas.size && [...next].every((id) => s.hiddenAreas.has(id));
      return same ? s : { hiddenAreas: next };
    }),
  showAllAreas: () => set((s) => (s.hiddenAreas.size === 0 ? s : { hiddenAreas: new Set() })),
  fitTables: (tableIds) =>
    set((s) => ({ fitRequest: { tableIds, nonce: (s.fitRequest?.nonce ?? 0) + 1 } })),
  setCanvasZoomedOut: (canvasZoomedOut) =>
    set((s) => (s.canvasZoomedOut === canvasZoomedOut ? s : { canvasZoomedOut })),
  setTableFilter: (tableFilter) => set({ tableFilter }),
  setShowMiniMap: (showMiniMap) => set({ showMiniMap }),
  setPanelOpen: (panel, open) =>
    set((s) => {
      const key = panel === "left" ? "leftPanelOpen" : "rightPanelOpen";
      return s[key] === open ? s : { [key]: open };
    }),
  setIssuesPanelOpen: (issuesPanelOpen) =>
    set((s) => (s.issuesPanelOpen === issuesPanelOpen ? s : { issuesPanelOpen })),
  setIssuesPanelTab: (issuesPanelTab) =>
    set((s) => (s.issuesPanelTab === issuesPanelTab ? s : { issuesPanelTab })),
  openHealthPanel: () => set({ issuesPanelOpen: true, issuesPanelTab: "health" }),
  setSearchOpen: (searchOpen) => set((s) => (s.searchOpen === searchOpen ? s : { searchOpen })),
  setImportOpen: (importOpen) => set((s) => (s.importOpen === importOpen ? s : { importOpen })),
  setShortcutsOpen: (shortcutsOpen) =>
    set((s) => (s.shortcutsOpen === shortcutsOpen ? s : { shortcutsOpen })),
  openShortcuts: (returnFocusTestId) =>
    set({ shortcutsOpen: true, shortcutsReturnFocus: returnFocusTestId ?? null }),
  requestResetView: () => set((s) => ({ resetViewRequest: s.resetViewRequest + 1 })),
  openExport: (exportReturnFocus, tab) =>
    set((s) => ({ exportOpen: true, exportReturnFocus, exportTab: tab ?? s.exportTab })),
  setExportTab: (exportTab) => set({ exportTab }),
  closeExport: () => set({ exportOpen: false }),
  openClearData: (clearDataReturnFocus) =>
    set({ clearDataOpen: true, clearDataReturnFocus, clearDataNotice: false }),
  closeClearData: () => set({ clearDataOpen: false }),
  setClearDataNotice: (clearDataNotice) => set({ clearDataNotice }),
  resetForNewSchema: () =>
    set((s) => ({
      selectedTableId: null,
      highlightedColumn: null,
      clearRequest: s.clearRequest + 1,
      tableFilter: "",
      searchOpen: false,
      exportOpen: false,
      inspectorTab: "columns",
      inspectorBack: null,
      focusSet: null,
      activePath: null,
      fitRequest: null,
      hiddenAreas: new Set(),
    })),
  reset: () => set(initial),
}));
