"use client";

import { Ellipsis, Monitor, Moon, Sun, Workflow } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUiStore } from "@/stores/ui-store";
import { ClearDataItem } from "./clear-data-item";
import { ShortcutsItem } from "./shortcuts-item";
import { CollapseAllItems } from "./collapse-all-items";
import { ExportItem, keepFocusForExportDialog } from "./export-item";
import { HealthItem } from "./health-item";
import { NeighbourhoodRadio } from "./neighbourhood-radio";

/**
 * Phones only (below `sm`): Layout, Theme and Settings in one menu, so the toolbar fits 390 px and
 * later toolbar buttons don't push it over again (QA-012 and the P2-T07 Search button).
 */
export function MoreMenu({
  onRelayout,
  canRelayout,
}: {
  onRelayout: () => void;
  canRelayout: boolean;
}) {
  const { theme, setTheme } = useTheme();
  const showMiniMap = useUiStore((s) => s.showMiniMap);
  const setShowMiniMap = useUiStore((s) => s.setShowMiniMap);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="More"
          className="sm:hidden"
          data-testid="toolbar-more"
        >
          <Ellipsis aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={keepFocusForExportDialog}>
        <DropdownMenuItem disabled={!canRelayout} onSelect={onRelayout} data-testid="more-layout">
          <Workflow aria-hidden />
          Re-run layout
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light" data-testid="more-theme-light">
            <Sun aria-hidden />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" data-testid="more-theme-dark">
            <Moon aria-hidden />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" data-testid="more-theme-system">
            <Monitor aria-hidden />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={showMiniMap}
          onCheckedChange={(v) => setShowMiniMap(v === true)}
          data-testid="more-minimap"
        >
          Show minimap
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <NeighbourhoodRadio testIdPrefix="more" />
        <DropdownMenuSeparator />
        <CollapseAllItems testIdPrefix="more" />
        <DropdownMenuSeparator />
        <HealthItem testId="more-health" />
        <DropdownMenuSeparator />
        <ExportItem testId="more-export" returnFocusTestId="toolbar-more" />
        <ExportItem testId="more-export-image" returnFocusTestId="toolbar-more" tab="image" />
        <DropdownMenuSeparator />
        <ClearDataItem testId="more-clear-data" returnFocusTestId="toolbar-more" />
        <DropdownMenuSeparator />
        <ShortcutsItem testId="more-shortcuts" returnFocusTestId="toolbar-more" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
