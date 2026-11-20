"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/** SchemaFlow is designed for schemas up to about this many tables (ADR-031). */
export const DESIGN_TABLE_LIMIT = 300;

/**
 * A dismissible one-line note for a schema past the design limit. Huge schemas still open and
 * work; there is no speed promise for them.
 */
export function LargeSchemaNotice({
  tables,
  onDismiss,
}: {
  tables: number;
  onDismiss: () => void;
}) {
  if (tables <= DESIGN_TABLE_LIMIT) return null;
  return (
    <div
      role="status"
      data-testid="large-schema-notice"
      className="flex max-w-[min(36rem,calc(100vw-10rem))] items-start gap-2 rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm"
    >
      <p>
        Large schema ({tables.toLocaleString("en-US")} tables): SchemaFlow is designed for up to
        about {DESIGN_TABLE_LIMIT} tables, so panning and selecting may be slow.
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="-my-1 -mr-1 size-6 shrink-0"
        aria-label="Dismiss large schema note"
        data-testid="large-schema-notice-dismiss"
        onClick={onDismiss}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
