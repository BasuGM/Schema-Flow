"use client";

import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown while subject areas are hidden (P4-T03), so the state is visible with the list closed. */
export function AreaFilterNotice({
  hiddenTables,
  onShowAll,
}: {
  hiddenTables: number;
  onShowAll: () => void;
}) {
  if (hiddenTables === 0) return null;
  return (
    <div
      role="status"
      data-testid="area-filter-notice"
      className="flex items-center gap-2 rounded-md border bg-card py-1 pr-1 pl-2.5 text-xs text-muted-foreground shadow-sm"
    >
      <EyeOff aria-hidden className="size-3.5 shrink-0" />
      <span className="tabular-nums">
        {hiddenTables} {hiddenTables === 1 ? "table" : "tables"} hidden
      </span>
      <Button variant="ghost" size="xs" onClick={onShowAll} data-testid="area-show-all">
        Show all
      </Button>
    </div>
  );
}
