"use client";

import { useEffect } from "react";
import { useUiStore } from "@/stores/ui-store";

/**
 * Escape clears the table selection and unpins a clicked edge label, wherever focus is: in a panel,
 * on the canvas, or on `<body>` (clicking an edge doesn't focus anything, because edges are not
 * focusable, so a handler on the workspace root would never see the key). Ignored in text inputs
 * (Escape belongs to the field) and open menus or dialogs (Escape closes them first).
 */
export function useEscapeToClear(): void {
  const clearSelection = useUiStore((s) => s.clearSelection);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [role='menu'], [role='dialog']",
        )
      )
        return;
      clearSelection();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [clearSelection]);
}
