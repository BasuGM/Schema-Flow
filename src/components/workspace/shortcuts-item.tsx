"use client";

import { Keyboard } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/stores/ui-store";

/** "Keyboard shortcuts" for the Settings and phone More menus; `returnFocusTestId` is the trigger. */
export function ShortcutsItem({
  testId,
  returnFocusTestId,
}: {
  testId: string;
  returnFocusTestId: string;
}) {
  return (
    <DropdownMenuItem
      onSelect={() => useUiStore.getState().openShortcuts(returnFocusTestId)}
      data-testid={testId}
    >
      <Keyboard aria-hidden />
      Keyboard shortcuts
    </DropdownMenuItem>
  );
}
