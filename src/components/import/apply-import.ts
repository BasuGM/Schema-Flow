import type { Schema } from "@/domain/schema/types";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Replaces the current diagram with an imported schema. The layout is keyed by fingerprint, so
 * importing the same schema again reuses its layout (and any dragged positions) instead of
 * re-running auto-layout. Selection, pinned edge and table filter are cleared.
 */
export function applyImportedSchema(schema: Schema): void {
  useSchemaStore.getState().loadSchema(schema);
  const { fingerprint } = useSchemaStore.getState();
  if (fingerprint) useLayoutStore.getState().ensureLayout(schema, fingerprint);
  const ui = useUiStore.getState();
  ui.clearSelection();
  ui.setTableFilter("");
}
