"use client";

import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useUiStore, type NeighbourhoodDepth } from "@/stores/ui-store";

const OPTIONS: { depth: NeighbourhoodDepth; label: string }[] = [
  { depth: 0, label: "Off" },
  { depth: 1, label: "1 hop" },
  { depth: 2, label: "2 hops" },
];

/**
 * Neighbourhood highlighting depth (P2-T09), shared by the Settings menu and the phone More menu.
 * `testIdPrefix` gives `settings-neighbourhood-1`, `more-neighbourhood-2`, …
 */
export function NeighbourhoodRadio({ testIdPrefix }: { testIdPrefix: string }) {
  const depth = useUiStore((s) => s.neighbourhoodDepth);
  const setDepth = useUiStore((s) => s.setNeighbourhoodDepth);
  return (
    <>
      <DropdownMenuLabel>Highlight neighbours</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={String(depth)}
        onValueChange={(v) => setDepth(Number(v) as NeighbourhoodDepth)}
      >
        {OPTIONS.map((o) => (
          <DropdownMenuRadioItem
            key={o.depth}
            value={String(o.depth)}
            data-testid={`${testIdPrefix}-neighbourhood-${o.depth}`}
          >
            {o.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}
