import { create } from "zustand";
import type { ColumnId, TableId } from "@/domain/schema/types";
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

export type InspectorTab = "columns" | "keys" | "relations";

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
  /** Search dialog (P2-T07). */
  searchOpen: boolean;
  /** Export image dialog (P3-T03) and the toolbar button that gets focus back when it closes. */
  exportImageOpen: boolean;
  exportImageReturnFocus: string | null;
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
  setCanvasZoomedOut: (zoomedOut: boolean) => void;
  setTableFilter: (filter: string) => void;
  setShowMiniMap: (show: boolean) => void;
  setPanelOpen: (panel: "left" | "right", open: boolean) => void;
  setIssuesPanelOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  /** `returnFocusTestId` is the `data-testid` of the toolbar button the dialog was opened from. */
  openExportImage: (returnFocusTestId: string) => void;
  closeExportImage: () => void;
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
  searchOpen: false,
  exportImageOpen: false,
  exportImageReturnFocus: null,
  highlightedColumn: null,
  inspectorTab: "columns" as InspectorTab,
  inspectorBack: null,
  neighbourhoodDepth: 1 as NeighbourhoodDepth,
  focusSet: null,
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
  setSearchOpen: (searchOpen) => set((s) => (s.searchOpen === searchOpen ? s : { searchOpen })),
  openExportImage: (exportImageReturnFocus) =>
    set({ exportImageOpen: true, exportImageReturnFocus }),
  closeExportImage: () => set({ exportImageOpen: false }),
  resetForNewSchema: () =>
    set((s) => ({
      selectedTableId: null,
      highlightedColumn: null,
      clearRequest: s.clearRequest + 1,
      tableFilter: "",
      searchOpen: false,
      exportImageOpen: false,
      inspectorTab: "columns",
      inspectorBack: null,
      focusSet: null,
    })),
  reset: () => set(initial),
}));
