"use client";

import { HeartPulse } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

/** "Schema health" for the Settings and phone More menus (P4-T01): opens the panel on Health. */
export function HealthItem({ testId }: { testId: string }) {
  const hasTables = useSchemaStore((s) => (s.schema?.tableOrder.length ?? 0) > 0);
  return (
    <DropdownMenuItem
      disabled={!hasTables}
      onSelect={() => useUiStore.getState().openHealthPanel()}
      data-testid={testId}
    >
      <HeartPulse aria-hidden />
      Schema health
    </DropdownMenuItem>
  );
}
