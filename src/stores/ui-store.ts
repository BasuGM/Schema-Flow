import { create } from "zustand";
import type { TableId } from "@/domain/schema/types";

/** A request for the canvas to center on a table; `nonce` makes repeated requests distinct. */
export interface FocusRequest {
  tableId: TableId;
  nonce: number;
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
  selectTable: (id: TableId | null) => void;
  /** Escape: clear the table selection and any clicked (pinned) edge. */
  clearSelection: () => void;
  /** Select a table and center the canvas on it (e.g. from the sidebar list). */
  focusTable: (id: TableId) => void;
  setTableFilter: (filter: string) => void;
  setShowMiniMap: (show: boolean) => void;
  setPanelOpen: (panel: "left" | "right", open: boolean) => void;
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
} satisfies Partial<UiState>;

export const useUiStore = create<UiState>()((set) => ({
  ...initial,
  selectTable: (id) => set((s) => (s.selectedTableId === id ? s : { selectedTableId: id })),
  clearSelection: () => set((s) => ({ selectedTableId: null, clearRequest: s.clearRequest + 1 })),
  focusTable: (id) =>
    set((s) => ({
      selectedTableId: id,
      focusRequest: { tableId: id, nonce: (s.focusRequest?.nonce ?? 0) + 1 },
    })),
  setTableFilter: (tableFilter) => set({ tableFilter }),
  setShowMiniMap: (showMiniMap) => set({ showMiniMap }),
  setPanelOpen: (panel, open) =>
    set((s) => {
      const key = panel === "left" ? "leftPanelOpen" : "rightPanelOpen";
      return s[key] === open ? s : { [key]: open };
    }),
  reset: () => set(initial),
}));
