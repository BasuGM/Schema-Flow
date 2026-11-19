import { scheduleSessionUiSave, type SessionUi } from "./session-persistence";
import { useSchemaStore } from "./schema-store";
import { useUiStore } from "./ui-store";

/** The selection of an imported or restored schema; null for samples (they are never restored). */
function currentSessionUi(): SessionUi | null {
  const { fingerprint, sourceText } = useSchemaStore.getState();
  if (!fingerprint || sourceText === null) return null;
  const { selectedTableId, inspectorTab } = useUiStore.getState();
  return { fingerprint, selectedTableId, inspectorTab };
}

/**
 * Saves the selected table and inspector tab (debounced, flushed on pagehide) so a reload can bring
 * them back with the session. Returns the unsubscribe function.
 */
export function startSessionUiSync(): () => void {
  return useUiStore.subscribe((state, prev) => {
    if (state.selectedTableId === prev.selectedTableId && state.inspectorTab === prev.inspectorTab)
      return;
    if (currentSessionUi()) scheduleSessionUiSave(currentSessionUi);
  });
}
