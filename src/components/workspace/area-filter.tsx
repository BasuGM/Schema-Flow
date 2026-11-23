"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { SubjectAreas } from "@/analysis/subject-areas";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

/**
 * Subject-area visibility controls (P4-T03): a disclosure with one checkbox row per area, an
 * "Only" shortcut and "Show all". Hiding an area hides its tables and their edges on the canvas.
 */
export function AreaFilter({ areas }: { areas: SubjectAreas }) {
  const [open, setOpen] = useState(false);
  const hidden = useUiStore((s) => s.hiddenAreas);
  const setAreaVisible = useUiStore((s) => s.setAreaVisible);
  const showOnlyArea = useUiStore((s) => s.showOnlyArea);
  const showAllAreas = useUiStore((s) => s.showAllAreas);
  const allIds = areas.areas.map((a) => a.id);
  const shown = areas.areas.filter((a) => !hidden.has(a.id)).length;

  return (
    <div className="px-3 pb-2" data-testid="area-filter-panel">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="area-filter-rows"
          onClick={() => setOpen((o) => !o)}
          data-testid="area-filter"
          className="-ml-1 flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight
            aria-hidden
            className={cn("size-3.5 transition-transform", open && "rotate-90")}
          />
          Areas · {shown} of {areas.areas.length} shown
        </button>
        <Button
          variant="ghost"
          size="xs"
          disabled={hidden.size === 0}
          onClick={showAllAreas}
          data-testid="area-show-all-list"
        >
          Show all
        </Button>
      </div>
      {open && (
        <ul id="area-filter-rows" className="mt-1 max-h-48 overflow-y-auto">
          {areas.areas.map((area) => {
            const visible = !hidden.has(area.id);
            const onlyThis = visible && shown === 1;
            return (
              <li
                key={area.id}
                data-testid={`area-row-${area.id}`}
                className="flex items-center gap-1 rounded-md pl-1 hover:bg-accent"
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={(e) => setAreaVisible(area.id, e.target.checked)}
                    data-testid={`area-toggle-${area.id}`}
                    className="size-3.5 shrink-0 accent-brand outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {area.label} ({area.tableIds.length})
                  </span>
                </label>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={onlyThis}
                  aria-label={`Show only ${area.label}`}
                  onClick={() => showOnlyArea(area.id, allIds)}
                  data-testid={`area-only-${area.id}`}
                >
                  Only
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
