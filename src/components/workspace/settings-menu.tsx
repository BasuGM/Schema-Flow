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
import { CollapseAllItems } from "./collapse-all-items";
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
      <DropdownMenuContent align="end" className="w-56">
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
        <DropdownMenuItem disabled>More settings arrive in later phases</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
