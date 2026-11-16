"use client";

import { ErrorBoundary } from "@/components/errors/error-boundary";
import { QaCrash } from "@/components/errors/qa-crash";
import { Search } from "lucide-react";
import { useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ToolbarButton } from "@/components/workspace/toolbar-button";
import { useReturnFocusTooltip } from "@/components/workspace/use-return-focus-tooltip";
import type { ColumnId, TableId } from "@/domain/schema/types";
import { revealTable } from "@/stores/reveal";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { SearchPanel } from "./search-panel";

export function shortcutLabel(): string {
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  return mac ? "⌘K" : "Ctrl+K";
}

/**
 * Toolbar "Search" button + dialog (P2-T07, ADR-016). Open state lives in `ui-store`, so the
 * keyboard shortcut and the button share it. On close, focus returns to where it was before
 * opening (the canvas, a list item, or this button); returning to the button does not pop its
 * tooltip (QA-015).
 */
export function SearchDialog() {
  const open = useUiStore((s) => s.searchOpen);
  const setOpen = useUiStore((s) => s.setSearchOpen);
  const hasSchema = useSchemaStore((s) => s.schema !== null);
  const tooltip = useReturnFocusTooltip();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const onChoose = useCallback(
    (tableId: TableId, columnId?: ColumnId) => {
      revealTable(tableId, columnId);
      setOpen(false);
    },
    [setOpen],
  );

  return (
    <Dialog open={open && hasSchema} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <ToolbarButton
          ref={triggerRef}
          tooltip={`Search tables and columns (${shortcutLabel()})`}
          tooltipOpen={tooltip.tooltipOpen}
          onTooltipOpenChange={tooltip.onTooltipOpenChange}
          unavailable={!hasSchema}
          size="icon"
          aria-label="Search tables and columns"
          data-testid="toolbar-search"
        >
          <Search aria-hidden />
        </ToolbarButton>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="top-2 flex max-h-[70dvh] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:top-[12dvh] sm:max-w-xl"
        onOpenAutoFocus={() => {
          // Still the element that had focus before the dialog opened.
          const active = document.activeElement;
          returnTo.current =
            active instanceof HTMLElement && active !== document.body ? active : null;
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          const target = returnTo.current?.isConnected ? returnTo.current : triggerRef.current;
          if (target === triggerRef.current) tooltip.onCloseAutoFocus();
          target?.focus();
        }}
        data-testid="search-dialog"
      >
        <DialogTitle className="sr-only">Search tables and columns</DialogTitle>
        <DialogDescription className="sr-only">
          Type to filter, use the arrow keys to move, and Enter to show the result on the canvas.
        </DialogDescription>
        <ErrorBoundary region="search" testId="search-error" onClose={() => setOpen(false)}>
          <QaCrash region="search" />
          <SearchPanel onChoose={onChoose} />
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}
