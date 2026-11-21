"use client";

import { ChevronRight, CircleAlert, Crosshair, Info, TriangleAlert } from "lucide-react";
import { memo, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ImportIssue } from "@/domain/schema/types";
import { cn } from "@/lib/utils";
import { IssueExcerpt } from "./issue-excerpt";

/** An import issue, or a health finding (P4-T01), which adds the `info` severity and a column. */
export type RowIssue = Pick<ImportIssue, "message" | "line" | "statement" | "tableId"> & {
  severity: "error" | "warning" | "info";
  /** Column to reveal along with the table. */
  columnId?: string;
};

interface IssueRowProps {
  issue: RowIssue;
  /** The linked table's display name, when it exists in the current schema. */
  tableName: string | undefined;
  onShowTable: (tableId: string, columnId?: string) => void;
}

/**
 * One issue. Rows with a line number toggle a source excerpt (Enter/Space, since the toggle is a
 * button). Severity is shown by icon and text, not only by colour.
 */
export const IssueRow = memo(function IssueRow({ issue, tableName, onShowTable }: IssueRowProps) {
  const [open, setOpen] = useState(false);
  const excerptId = useId();
  const error = issue.severity === "error";
  const Icon = error ? CircleAlert : issue.severity === "info" ? Info : TriangleAlert;
  const content = (
    <>
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          error
            ? "text-destructive"
            : issue.severity === "info"
              ? "text-muted-foreground"
              : "text-amber-600 dark:text-amber-400",
        )}
      />
      <span className="sr-only">
        {error ? "Error" : issue.severity === "info" ? "Info" : "Warning"}
      </span>
      {issue.line !== undefined && (
        <Badge
          variant={error ? "destructive" : "secondary"}
          className="shrink-0 font-normal tabular-nums"
          data-testid="issue-line"
        >
          line {issue.line}
        </Badge>
      )}
      <span className="min-w-0 text-left break-words">{issue.message}</span>
    </>
  );

  return (
    <li
      className="border-b px-3 py-1.5 last:border-b-0"
      data-testid="issue-row"
      data-severity={issue.severity}
    >
      <div className="flex items-start gap-2">
        {issue.line !== undefined ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-2 rounded-sm text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={open}
            aria-controls={open ? excerptId : undefined}
            onClick={() => setOpen((o) => !o)}
            data-testid="issue-toggle"
          >
            <ChevronRight
              aria-hidden
              className={cn(
                "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-90",
              )}
            />
            {content}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-2 pl-6 text-xs">{content}</div>
        )}
        {issue.tableId !== undefined && (
          <ShowTable
            tableId={issue.tableId}
            columnId={issue.columnId}
            tableName={tableName}
            onShowTable={onShowTable}
          />
        )}
      </div>
      {open && issue.line !== undefined && (
        <IssueExcerpt id={excerptId} line={issue.line} statement={issue.statement} />
      )}
    </li>
  );
});

function ShowTable({
  tableId,
  columnId,
  tableName,
  onShowTable,
}: {
  tableId: string;
  columnId: string | undefined;
  tableName: string | undefined;
  onShowTable: (tableId: string, columnId?: string) => void;
}) {
  const missing = tableName === undefined;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className={cn("shrink-0", missing && "cursor-not-allowed opacity-50")}
          aria-disabled={missing || undefined}
          onClick={
            missing
              ? undefined
              : () => (columnId ? onShowTable(tableId, columnId) : onShowTable(tableId))
          }
          data-testid="issue-show-table"
        >
          <Crosshair aria-hidden />
          Show table
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {missing ? "Table not in the diagram" : `Select and center ${tableName}`}
      </TooltipContent>
    </Tooltip>
  );
}
