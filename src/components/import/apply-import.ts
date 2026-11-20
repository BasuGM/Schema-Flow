import { countIssues } from "@/domain/schema/issues";
import type { Schema } from "@/domain/schema/types";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import {
  loadSessionUi,
  saveSession,
  type InspectorTabName,
} from "@/stores/session-persistence";
import { useUiStore } from "@/stores/ui-store";
import type { ImportFormatChoice } from "@/parsers";

/** The part of a session that only the import knows: the resolved format. */
export interface SessionSave {
  format: ImportFormatChoice;
}

/**
 * Replaces the current diagram with an imported schema. The layout is keyed by fingerprint, so
 * importing the same schema again reuses its layout (and any dragged positions) instead of
 * re-running auto-layout. Selection, pinned edge, table filter and a search highlight are
 * cleared, and search closes.
 *
 * Issues panel: an import with errors opens it; any other import leaves it as it is, so a panel
 * the user closed stays closed after a warnings-only import, and an open panel is not auto-closed
 * by a clean import (it shows its empty state).
 *
 * With `session`, the import is also saved so a reload brings it back (P3-T06, ADR-030).
 */
export function applyImportedSchema(
  schema: Schema,
  sourceText?: string,
  session?: SessionSave,
): void {
  load(schema, sourceText);
  if (session && sourceText !== undefined)
    void saveSession({
      v: 1,
      text: sourceText,
      format: session.format,
      name: schema.name,
      savedAt: Date.now(),
    });
}

function load(schema: Schema, sourceText?: string): void {
  useSchemaStore.getState().loadSchema(schema, sourceText);
  const { fingerprint, issues } = useSchemaStore.getState();
  if (fingerprint) useLayoutStore.getState().ensureLayout(schema, fingerprint);
  const ui = useUiStore.getState();
  ui.resetForNewSchema();
  if (countIssues(issues).errors > 0) ui.setIssuesPanelOpen(true);
}

/**
 * Puts a saved session back on screen. Same as an import (so the issues panel follows the same
 * rule) but nothing is saved or announced, the saved pan and zoom are used instead of fitting the
 * view, and the selected table and inspector tab come back when they still exist. Selecting does
 * not center the canvas and never moves focus.
 */
export function applyRestoredSchema(schema: Schema, sourceText: string): void {
  load(schema, sourceText);
  const { fingerprint } = useSchemaStore.getState();
  if (!fingerprint) return;
  useLayoutStore.getState().queueSavedViewport(fingerprint);
  const saved = loadSessionUi();
  if (saved?.fingerprint !== fingerprint) return;
  const ui = useUiStore.getState();
  if (saved.selectedTableId !== null && schema.tables[saved.selectedTableId])
    ui.selectTable(saved.selectedTableId);
  ui.setInspectorTab(saved.inspectorTab satisfies InspectorTabName);
}
