"use client";

import { useEffect } from "react";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

const TEXT_FIELD = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";

/**
 * ⌘K / Ctrl+K open search from anywhere; `/` opens it unless focus is in a text field. Neither
 * opens over another dialog or an open menu. ⌘K / Ctrl+K always prevent the default, because
 * browsers bind Ctrl+K to their own search bar.
 */
export function useSearchShortcut(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) return;
      const mod = event.metaKey || event.ctrlKey;
      const isK = mod && !event.shiftKey && event.key.toLowerCase() === "k";
      const isSlash = !mod && event.key === "/";
      if (!isK && !isSlash) return;
      const target = event.target instanceof Element ? event.target : null;
      if (isSlash && target?.closest(TEXT_FIELD)) return;
      if (isK) event.preventDefault();
      const ui = useUiStore.getState();
      if (ui.searchOpen || !useSchemaStore.getState().schema) return;
      if (document.querySelector("[role='dialog'], [role='menu'], [role='alertdialog']")) return;
      if (isSlash) event.preventDefault();
      ui.setSearchOpen(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
