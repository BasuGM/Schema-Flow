"use client";

import { useCallback, type KeyboardEvent } from "react";
import { useUiStore } from "@/stores/ui-store";

/**
 * Escape clears the table selection and unpins a clicked edge label wherever focus is in the workspace (canvas, list, inspector,
 * toolbar) — except in text inputs (Escape belongs to the field) and open menus (Escape closes the
 * menu first). Attached to the workspace root so it catches events bubbling from every panel.
 */
export function useEscapeToClear() {
  const clearSelection = useUiStore((s) => s.clearSelection);
  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog']",
        )
      )
        return;
      clearSelection();
    },
    [clearSelection],
  );
}
