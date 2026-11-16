import { create } from "zustand";
import type { ColumnId, TableId } from "@/domain/schema/types";

/**
 * A request for the canvas to center on a table, or on one of its column rows; `nonce` makes
 * repeated requests distinct.
 */
export interface FocusRequest {
  tableId: TableId;
  columnId?: ColumnId;
  nonce: number;
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
  /** Cleared when the selection changes, on Escape and on a new schema. */
  highlightedColumn: HighlightedColumn | null;
  selectTable: (id: TableId | null) => void;
  /** Escape: clear the table selection and any clicked (pinned) edge. */
  clearSelection: () => void;
  /**
   * Select a table and center the canvas on it (e.g. from the sidebar list). With a column, center
   * on its row and highlight it.
   */
  focusTable: (id: TableId, columnId?: ColumnId) => void;
  setTableFilter: (filter: string) => void;
  setShowMiniMap: (show: boolean) => void;
  setPanelOpen: (panel: "left" | "right", open: boolean) => void;
  setIssuesPanelOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
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
  highlightedColumn: null,
} satisfies Partial<UiState>;

export const useUiStore = create<UiState>()((set) => ({
  ...initial,
  selectTable: (id) =>
    set((s) => (s.selectedTableId === id ? s : { selectedTableId: id, highlightedColumn: null })),
  clearSelection: () =>
    set((s) => ({
      selectedTableId: null,
      highlightedColumn: null,
      clearRequest: s.clearRequest + 1,
    })),
  focusTable: (id, columnId) =>
    set((s) => ({
      selectedTableId: id,
      highlightedColumn: columnId ? { tableId: id, columnId } : null,
      focusRequest: { tableId: id, columnId, nonce: (s.focusRequest?.nonce ?? 0) + 1 },
    })),
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
  resetForNewSchema: () =>
    set((s) => ({
      selectedTableId: null,
      highlightedColumn: null,
      clearRequest: s.clearRequest + 1,
      tableFilter: "",
      searchOpen: false,
    })),
  reset: () => set(initial),
}));
