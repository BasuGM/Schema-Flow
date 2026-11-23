import { useUiStore } from "@/stores/ui-store";
import { actions } from "./actions";

/**
 * The single source for keyboard shortcuts: the global handler, the help dialog and the palette
 * hints all read this table, so they cannot drift apart (P4-T04, ADR-037).
 */
export interface Shortcut {
  id: string;
  description: string;
  /** `key` is compared with `event.key` lower-cased (Shift and CapsLock don't matter). */
  bindings: readonly { key: string; mod?: boolean }[];
  /** Needs a loaded schema (everything except Import and the help dialog). */
  needsSchema: boolean;
  /** Opens a dialog: phone sheets close first. */
  opensDialog?: boolean;
  run: () => void;
}

export const SHORTCUTS: readonly Shortcut[] = [
  {
    id: "search",
    description: "Search tables, columns and commands",
    bindings: [{ key: "k", mod: true }, { key: "/" }],
    needsSchema: true,
    run: () => useUiStore.getState().setSearchOpen(true),
  },
  {
    id: "shortcuts",
    description: "Keyboard shortcuts",
    bindings: [{ key: "?" }],
    needsSchema: false,
    opensDialog: true,
    run: actions.shortcuts,
  },
  {
    id: "reset-view",
    description: "Reset view (fit all tables)",
    bindings: [{ key: "f" }],
    needsSchema: true,
    run: actions.resetView,
  },
  {
    id: "layout",
    description: "Re-run automatic layout",
    bindings: [{ key: "l" }],
    needsSchema: true,
    run: actions.layout,
  },
  {
    id: "toggle-list",
    description: "Show or hide the table list",
    bindings: [{ key: "[" }],
    needsSchema: false,
    run: actions.toggleTableList,
  },
  {
    id: "toggle-inspector",
    description: "Show or hide the inspector",
    bindings: [{ key: "]" }],
    needsSchema: false,
    run: actions.toggleInspector,
  },
  {
    id: "health",
    description: "Open schema health",
    bindings: [{ key: "h" }],
    needsSchema: true,
    run: actions.health,
  },
  {
    id: "export",
    description: "Export…",
    bindings: [{ key: "e" }],
    needsSchema: true,
    opensDialog: true,
    run: actions.exportSchema,
  },
  {
    id: "import",
    description: "Import a schema…",
    bindings: [{ key: "i" }],
    needsSchema: false,
    opensDialog: true,
    run: actions.importSchema,
  },
];

export function shortcutById(id: string): Shortcut | undefined {
  return SHORTCUTS.find((s) => s.id === id);
}

/** The shortcut for this key press, or null. Ctrl/Meta/Alt belong to the browser, except ⌘K. */
export function matchShortcut(event: KeyboardEvent): Shortcut | null {
  if (event.repeat || event.altKey) return null;
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key.toLowerCase();
  for (const shortcut of SHORTCUTS) {
    for (const binding of shortcut.bindings) {
      if (binding.key !== key) continue;
      if (binding.mod ? mod && !event.shiftKey : !mod) return shortcut;
    }
  }
  return null;
}

export function isMac(): boolean {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
}

const display = (binding: { key: string; mod?: boolean }, mac: boolean) => {
  const key = binding.key.length === 1 ? binding.key.toUpperCase() : binding.key;
  return binding.mod ? (mac ? `⌘${key}` : `Ctrl+${key}`) : key;
};

/** Labels such as ["⌘K", "/"] for the help dialog and palette hints. */
export function shortcutLabels(shortcut: Shortcut, mac = isMac()): string[] {
  return shortcut.bindings.map((b) => display(b, mac));
}

/** For `aria-keyshortcuts` (e.g. "Meta+K /"). */
export function ariaKeyShortcuts(shortcut: Shortcut, mac = isMac()): string {
  return shortcut.bindings
    .map((b) => (b.mod ? `${mac ? "Meta" : "Control"}+${b.key.toUpperCase()}` : b.key))
    .join(" ");
}
