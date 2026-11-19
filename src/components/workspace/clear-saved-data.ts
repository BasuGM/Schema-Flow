import { createSample } from "@/samples/resolve-sample";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { clearAllSavedData } from "@/stores/session-persistence";
import { useUiStore } from "@/stores/ui-store";

/**
 * "Clear saved data" (P3-T06, ADR-030): removes the saved session, selection, layouts and
 * preferences from this device, then shows the default sample as a fresh visit would. The removal
 * is final: pending saves are cancelled first and other tabs stop saving.
 */
export function clearSavedData(): void {
  void clearAllSavedData();
  useLayoutStore.getState().resetAll();
  // Straight into the state: the setter would write the preference that was just removed.
  useUiStore.setState({ neighbourhoodDepth: 1 });
  const schema = createSample({ kind: "ecommerce" });
  useSchemaStore.getState().loadSchema(schema);
  const ui = useUiStore.getState();
  ui.resetForNewSchema();
  ui.setIssuesPanelOpen(false);
  const { fingerprint } = useSchemaStore.getState();
  if (fingerprint) useLayoutStore.getState().ensureLayout(schema, fingerprint);
  ui.closeClearData();
  ui.setClearDataNotice(true);
}
