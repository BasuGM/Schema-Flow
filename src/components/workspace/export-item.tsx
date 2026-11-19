"use client";

import { Download, ImageDown } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore, type ExportTab } from "@/stores/ui-store";

/**
 * "Export…" and "Export image…" for the Settings and phone More menus (P3-T03, P3-T05). `tab` is
 * the dialog tab to open on (omitted: the last used). `returnFocusTestId` is the menu's own
 * trigger: the dialog gives focus back to it when it closes.
 */
export function ExportItem({
  testId,
  returnFocusTestId,
  tab,
}: {
  testId: string;
  returnFocusTestId: string;
  tab?: ExportTab;
}) {
  const hasTables = useSchemaStore((s) => (s.schema?.tableOrder.length ?? 0) > 0);
  const Icon = tab === "image" ? ImageDown : Download;
  return (
    <DropdownMenuItem
      disabled={!hasTables}
      onSelect={() => useUiStore.getState().openExport(returnFocusTestId, tab)}
      data-testid={testId}
    >
      <Icon aria-hidden />
      {tab === "image" ? "Export image…" : "Export…"}
    </DropdownMenuItem>
  );
}

/**
 * Pass to the menu content's `onCloseAutoFocus`: when an item opened the export or the clear-data
 * dialog, the menu must not pull focus back to its trigger while the dialog takes it (the dialog
 * returns it on close).
 */
export function keepFocusForExportDialog(event: Event) {
  const { exportOpen, clearDataOpen } = useUiStore.getState();
  if (exportOpen || clearDataOpen) event.preventDefault();
}
