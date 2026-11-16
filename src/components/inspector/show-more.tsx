"use client";

import { Button } from "@/components/ui/button";

/** "Showing 100 of 1,000" + "Show 100 more", as in the issues panel. */
export function ShowMore({
  shown,
  total,
  onMore,
  testId,
}: {
  shown: number;
  total: number;
  onMore: () => void;
  testId: string;
}) {
  if (shown >= total) return null;
  const next = Math.min(100, total - shown);
  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-3 text-xs text-muted-foreground">
      <span>
        Showing {shown.toLocaleString("en-US")} of {total.toLocaleString("en-US")}
      </span>
      <Button variant="outline" size="xs" onClick={onMore} data-testid={testId}>
        Show {next} more
      </Button>
    </div>
  );
}
