import { SHEET_QUERY } from "@/components/issues/issues-sheet";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

/** The plain actions behind both the single-key shortcuts and the palette commands (P4-T04). */
export const actions = {
  resetView: () => useUiStore.getState().requestResetView(),
  layout: () => {
    const { schema, fingerprint } = useSchemaStore.getState();
    if (schema && fingerprint) useLayoutStore.getState().relayout(schema, fingerprint);
  },
  toggleTableList: () => {
    const ui = useUiStore.getState();
    ui.setPanelOpen("left", !ui.leftPanelOpen);
  },
  toggleInspector: () => {
    const ui = useUiStore.getState();
    ui.setPanelOpen("right", !ui.rightPanelOpen);
  },
  toggleMiniMap: () => {
    const ui = useUiStore.getState();
    ui.setShowMiniMap(!ui.showMiniMap);
  },
  health: () => useUiStore.getState().openHealthPanel(),
  exportSchema: () => useUiStore.getState().openExport("toolbar-export"),
  exportImage: () => useUiStore.getState().openExport("toolbar-export", "image"),
  importSchema: () => useUiStore.getState().setImportOpen(true),
  shortcuts: () => useUiStore.getState().openShortcuts(),
  clearData: () => useUiStore.getState().openClearData("toolbar-export"),
  pathFinder: () => {
    const ui = useUiStore.getState();
    ui.setInspectorTab("path");
    ui.setPanelOpen("right", true);
  },
};

/**
 * On phones the table list, inspector and issues panel are sheets without a dialog role; E, I and ?
 * open dialogs, so they close the sheets first (P4-T04).
 */
export function closeSheets(): void {
  if (typeof window === "undefined" || !window.matchMedia?.(SHEET_QUERY).matches) return;
  const ui = useUiStore.getState();
  ui.setPanelOpen("left", false);
  ui.setPanelOpen("right", false);
  ui.setIssuesPanelOpen(false);
}
