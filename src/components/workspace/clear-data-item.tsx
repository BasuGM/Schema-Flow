"use client";

import { Trash2 } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/stores/ui-store";

/** "Clear saved data…" for the Settings and phone More menus; `returnFocusTestId` is the trigger. */
export function ClearDataItem({
  testId,
  returnFocusTestId,
}: {
  testId: string;
  returnFocusTestId: string;
}) {
  return (
    <DropdownMenuItem
      onSelect={() => useUiStore.getState().openClearData(returnFocusTestId)}
      data-testid={testId}
    >
      <Trash2 aria-hidden />
      Clear saved data…
    </DropdownMenuItem>
  );
}
