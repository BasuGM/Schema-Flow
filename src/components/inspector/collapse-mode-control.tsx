"use client";

import { useId } from "react";
import type { CollapseMode, TableId } from "@/domain/schema/types";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";

const OPTIONS: { mode: CollapseMode; label: string }[] = [
  { mode: "full", label: "All columns" },
  { mode: "keys", label: "Keys" },
  { mode: "header", label: "Header only" },
];

/**
 * How the selected table draws on the canvas (P3-T02). Native radios in a fieldset: arrow keys work
 * for free, and the group name comes from `useId` so two mounted inspectors never share a group.
 */
export function CollapseModeControl({ tableId }: { tableId: TableId }) {
  const name = useId();
  const fingerprint = useSchemaStore((s) => s.fingerprint);
  const current = useLayoutStore((s) =>
    fingerprint ? (s.layouts[fingerprint]?.collapsed[tableId] ?? "full") : "full",
  );
  return (
    <fieldset
      className="relative min-w-0 overflow-hidden border-b px-4 py-2"
      data-testid="inspector-collapse"
    >
      <legend className="sr-only">Show on canvas</legend>
      <p aria-hidden className="mb-1 text-[11px] text-muted-foreground">
        Show on canvas
      </p>
      <div className="flex rounded-md border bg-muted/40 p-0.5 text-xs">
        {OPTIONS.map(({ mode, label }) => (
          <label
            key={mode}
            className={cn(
              "relative min-w-0 flex-1 cursor-pointer truncate rounded px-2 py-1 text-center",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              current === mode ? "bg-card font-medium shadow-sm" : "text-muted-foreground",
            )}
          >
            <input
              type="radio"
              name={name}
              value={mode}
              checked={current === mode}
              disabled={!fingerprint}
              onChange={() => {
                if (fingerprint) useLayoutStore.getState().setCollapse(fingerprint, tableId, mode);
              }}
              className="sr-only"
              data-testid={`inspector-collapse-${mode}`}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
