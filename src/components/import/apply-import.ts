import { countIssues } from "@/domain/schema/issues";
import type { Schema } from "@/domain/schema/types";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Replaces the current diagram with an imported schema. The layout is keyed by fingerprint, so
 * importing the same schema again reuses its layout (and any dragged positions) instead of
 * re-running auto-layout. Selection, pinned edge and table filter are cleared.
 *
 * Issues panel: an import with errors opens it; any other import leaves it as it is, so a panel
 * the user closed stays closed after a warnings-only import, and an open panel is not auto-closed
 * by a clean import (it shows its empty state).
 */
export function applyImportedSchema(schema: Schema, sourceText?: string): void {
  useSchemaStore.getState().loadSchema(schema, sourceText);
  const { fingerprint, issues } = useSchemaStore.getState();
  if (fingerprint) useLayoutStore.getState().ensureLayout(schema, fingerprint);
  const ui = useUiStore.getState();
  ui.clearSelection();
  ui.setTableFilter("");
  if (countIssues(issues).errors > 0) ui.setIssuesPanelOpen(true);
}
