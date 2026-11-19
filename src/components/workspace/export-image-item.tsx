"use client";

import { ImageDown } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * "Export image…" for the Settings and phone More menus (P3-T03). `returnFocusTestId` is the menu's
 * own trigger: the dialog gives focus back to it when it closes.
 */
export function ExportImageItem({
  testId,
  returnFocusTestId,
}: {
  testId: string;
  returnFocusTestId: string;
}) {
  const hasTables = useSchemaStore((s) => (s.schema?.tableOrder.length ?? 0) > 0);
  return (
    <DropdownMenuItem
      disabled={!hasTables}
      onSelect={() => useUiStore.getState().openExportImage(returnFocusTestId)}
      data-testid={testId}
    >
      <ImageDown aria-hidden />
      Export image…
    </DropdownMenuItem>
  );
}

/**
 * Pass to the menu content's `onCloseAutoFocus`: when an item opened the export dialog, the menu must
 * not pull focus back to its trigger while the dialog takes it (the dialog returns it on close).
 */
export function keepFocusForExportDialog(event: Event) {
  if (useUiStore.getState().exportImageOpen) event.preventDefault();
}
