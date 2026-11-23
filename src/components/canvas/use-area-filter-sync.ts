"use client";

import { useEffect } from "react";
import { getSubjectAreas } from "@/analysis/subject-areas";
import type { TableId } from "@/domain/schema/types";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

/** Turns back on the hidden areas of these tables. */
function revealAreasOf(tableIds: Iterable<TableId>): void {
  const schema = useSchemaStore.getState().schema;
  const areas = schema ? getSubjectAreas(schema) : null;
  const ui = useUiStore.getState();
  if (!areas || ui.hiddenAreas.size === 0) return;
  for (const id of tableIds) {
    const area = areas.areaOf.get(id);
    if (area && ui.hiddenAreas.has(area)) ui.setAreaVisible(area, true);
  }
}

/**
 * Revealing a table (list, search, Show table, links, path "Show on canvas") or showing a path
 * turns its hidden area back on, so the canvas never points at an invisible table. Subscriptions
 * run synchronously inside the `set`, so the area is visible in the same commit. Hiding the area
 * of the selected table keeps the selection (no request fires).
 */
export function useAreaFilterSync(): void {
  useEffect(
    () =>
      useUiStore.subscribe((s, prev) => {
        if (s.focusRequest !== prev.focusRequest && s.focusRequest)
          revealAreasOf([s.focusRequest.tableId]);
        if (s.fitRequest !== prev.fitRequest && s.fitRequest) revealAreasOf(s.fitRequest.tableIds);
        if (s.activePath !== prev.activePath && s.activePath) revealAreasOf(s.activePath.tables);
      }),
    [],
  );
}
