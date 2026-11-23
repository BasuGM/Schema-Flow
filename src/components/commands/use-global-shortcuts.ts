"use client";

import { useEffect } from "react";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { closeSheets } from "./actions";
import { matchShortcut } from "./shortcuts";

const TEXT_FIELD = "input, textarea, select, [contenteditable]:not([contenteditable='false'])";
const OVERLAY = "[role='dialog'], [role='menu'], [role='alertdialog']";

/**
 * Global keys (P4-T04): ⌘K / Ctrl+K and `/` open search; single keys run the actions in `SHORTCUTS`.
 * Nothing fires while typing in a field, over an open dialog or menu, with Ctrl/Meta/Alt held
 * (except ⌘K) or on key repeat. ⌘K always prevents the default, because browsers bind Ctrl+K.
 */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const shortcut = matchShortcut(event);
      if (!shortcut) return;
      const isModK = shortcut.id === "search" && (event.metaKey || event.ctrlKey);
      const target = event.target instanceof Element ? event.target : null;
      if (!isModK && target?.closest(TEXT_FIELD)) return;
      if (isModK) event.preventDefault();
      if (shortcut.needsSchema && !useSchemaStore.getState().schema) return;
      if (useUiStore.getState().searchOpen) return;
      if (document.querySelector(OVERLAY)) return;
      event.preventDefault();
      if (shortcut.opensDialog) closeSheets();
      shortcut.run();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
