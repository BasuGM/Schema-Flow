"use client";

import { useEffect } from "react";
import { getFocusSet } from "@/domain/schema/selectors";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Keeps `ui-store.focusSet` (neighbourhood highlighting, P2-T09) in step with the schema, the
 * selection and the depth setting. Store subscriptions run synchronously inside the `set` that
 * changed the selection, so the new selection and its focus set render in the same commit, and the
 * canvas component itself never re-renders for it.
 */
export function useFocusSetSync(): void {
  useEffect(() => {
    const sync = () => {
      const schema = useSchemaStore.getState().schema;
      const { selectedTableId, neighbourhoodDepth, setFocusSet } = useUiStore.getState();
      setFocusSet(
        schema && selectedTableId ? getFocusSet(schema, selectedTableId, neighbourhoodDepth) : null,
      );
    };
    sync();
    const offUi = useUiStore.subscribe((s, prev) => {
      if (
        s.selectedTableId !== prev.selectedTableId ||
        s.neighbourhoodDepth !== prev.neighbourhoodDepth
      )
        sync();
    });
    const offSchema = useSchemaStore.subscribe((s, prev) => {
      if (s.schema !== prev.schema) sync();
    });
    return () => {
      offUi();
      offSchema();
    };
  }, []);
}
