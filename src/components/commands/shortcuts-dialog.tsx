"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRef } from "react";
import { useUiStore } from "@/stores/ui-store";
import { restorePaletteFocus } from "./focus-return";
import { SHORTCUTS, shortcutLabels } from "./shortcuts";

/** The keyboard shortcuts help (P4-T04): one row per entry of `SHORTCUTS`, nothing hand-written. */
export function ShortcutsDialog() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  const openedFrom = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-md"
        data-testid="shortcuts-dialog"
        onOpenAutoFocus={() => {
          const active = document.activeElement;
          openedFrom.current =
            active instanceof HTMLElement && active !== document.body ? active : null;
        }}
        onCloseAutoFocus={(event) => {
          if (restorePaletteFocus(event)) return;
          const id = useUiStore.getState().shortcutsReturnFocus;
          const byId = id ? document.querySelector<HTMLElement>(`[data-testid="${id}"]`) : null;
          const trigger = byId ?? (openedFrom.current?.isConnected ? openedFrom.current : null);
          if (!trigger) return;
          event.preventDefault();
          trigger.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Single keys work on the canvas, not while typing in a field or with a dialog open.
          </DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm" data-testid="shortcuts-table">
          <caption className="sr-only">Keyboard shortcuts</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Action</th>
              <th scope="col">Keys</th>
            </tr>
          </thead>
          <tbody>
            {SHORTCUTS.map((shortcut) => (
              <tr
                key={shortcut.id}
                className="border-b last:border-0"
                data-testid="shortcut-row"
                data-id={shortcut.id}
              >
                <th scope="row" className="py-2 pr-3 text-left font-normal">
                  {shortcut.description}
                </th>
                <td className="py-2 text-right whitespace-nowrap">
                  {shortcutLabels(shortcut).map((label, i) => (
                    <span key={label}>
                      {i > 0 && <span className="px-1 text-muted-foreground">or</span>}
                      <kbd className="rounded border px-1.5 py-0.5 font-mono text-xs">{label}</kbd>
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
