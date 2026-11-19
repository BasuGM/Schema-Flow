"use client";

import { DropdownMenuItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import type { CollapseMode } from "@/domain/schema/types";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";

const ITEMS: { mode: CollapseMode; label: string }[] = [
  { mode: "full", label: "Show all columns" },
  { mode: "keys", label: "Keys only" },
  { mode: "header", label: "Headers only" },
];

/**
 * Sets every table's collapse mode (P3-T02). Actions, not radios: tables can differ, so there is
 * no single current value. Shared by the Settings menu and the phone More menu; `testIdPrefix`
 * gives `settings-collapse-all-keys`, `more-collapse-all-header`, …
 */
export function CollapseAllItems({ testIdPrefix }: { testIdPrefix: string }) {
  const hasSchema = useSchemaStore((s) => s.schema !== null);
  const apply = (mode: CollapseMode) => {
    const { schema, fingerprint } = useSchemaStore.getState();
    if (schema && fingerprint) useLayoutStore.getState().setAllCollapse(schema, fingerprint, mode);
  };
  return (
    <>
      <DropdownMenuLabel>All tables</DropdownMenuLabel>
      {ITEMS.map(({ mode, label }) => (
        <DropdownMenuItem
          key={mode}
          disabled={!hasSchema}
          onSelect={() => apply(mode)}
          data-testid={`${testIdPrefix}-collapse-all-${mode}`}
        >
          {label}
        </DropdownMenuItem>
      ))}
    </>
  );
}
