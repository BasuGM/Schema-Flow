"use client";

import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/stores/ui-store";
import { ClearDataItem } from "./clear-data-item";
import { CollapseAllItems } from "./collapse-all-items";
import { ExportItem, keepFocusForExportDialog } from "./export-item";
import { HealthItem } from "./health-item";
import { NeighbourhoodRadio } from "./neighbourhood-radio";

export function SettingsMenu() {
  const showMiniMap = useUiStore((s) => s.showMiniMap);
  const setShowMiniMap = useUiStore((s) => s.setShowMiniMap);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Settings" data-testid="toolbar-settings">
          <Settings aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={keepFocusForExportDialog}>
        <DropdownMenuLabel>View</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={showMiniMap}
          onCheckedChange={(v) => setShowMiniMap(v === true)}
          data-testid="settings-minimap"
        >
          Show minimap
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <NeighbourhoodRadio testIdPrefix="settings" />
        <DropdownMenuSeparator />
        <CollapseAllItems testIdPrefix="settings" />
        <DropdownMenuSeparator />
        <HealthItem testId="settings-health" />
        <DropdownMenuSeparator />
        <ExportItem testId="settings-export" returnFocusTestId="toolbar-settings" />
        <ExportItem
          testId="settings-export-image"
          returnFocusTestId="toolbar-settings"
          tab="image"
        />
        <DropdownMenuSeparator />
        <ClearDataItem testId="settings-clear-data" returnFocusTestId="toolbar-settings" />
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>More settings arrive in later phases</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
