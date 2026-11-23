"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { restorePaletteFocus } from "@/components/commands/focus-return";
import { useUiStore } from "@/stores/ui-store";
import { clearSavedData } from "./clear-saved-data";

/**
 * Confirm dialog for "Clear saved data…" (Settings and More). Focus returns to the control that
 * opened it. The polite notice outlives the dialog so a screen reader hears that it worked.
 */
export function ClearDataDialog() {
  const open = useUiStore((s) => s.clearDataOpen);
  const notice = useUiStore((s) => s.clearDataNotice);
  const close = useUiStore((s) => s.closeClearData);
  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent
          data-testid="clear-data-dialog"
          onCloseAutoFocus={(event) => {
            if (restorePaletteFocus(event)) return;
            event.preventDefault();
            const id = useUiStore.getState().clearDataReturnFocus;
            document.querySelector<HTMLElement>(`[data-testid="${id}"]`)?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Clear saved data?</DialogTitle>
            <DialogDescription>
              The last imported schema, your saved table positions and your preferences are stored
              only on this device. Clearing them loads the sample diagram and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" data-testid="clear-data-cancel">
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={clearSavedData} data-testid="clear-data-confirm">
              Clear saved data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p role="status" className="sr-only" data-testid="clear-data-status">
        {notice ? "Saved data cleared" : ""}
      </p>
    </>
  );
}
