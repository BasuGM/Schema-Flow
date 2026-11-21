"use client";

import { Check, Copy, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  HEALTH_CHECKS,
  HEALTH_CHECK_LABELS,
  countFindings,
  findingsToText,
  type HealthCheckId,
  type HealthFinding,
} from "@/analysis/health";
import { cn } from "@/lib/utils";
import { revealTable } from "@/stores/reveal";
import { useSchemaStore } from "@/stores/schema-store";
import { closeIssuesPanel } from "./close-issues";
import { ISSUE_BATCH } from "./issues-panel";
import { IssueRow, type RowIssue } from "./issue-row";
import { useCopyText } from "./use-copy-text";

type Filter = "all" | HealthCheckId;

/**
 * Schema health findings (P4-T01): advisory checks, shown beside the import issues in the bottom
 * panel. `findings` is computed once by the parent; remount (key) when the schema changes.
 */
export function HealthPanel({
  findings,
  className,
}: {
  findings: readonly HealthFinding[];
  className?: string;
}) {
  const tables = useSchemaStore((s) => s.schema?.tables);
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(ISSUE_BATCH);
  const counts = useMemo(() => countFindings(findings), [findings]);
  const rows = useMemo(
    () =>
      findings.map((f): RowIssue => ({
        severity: f.severity,
        message: f.message,
        tableId: f.tableId,
        columnId: f.columnIds?.[0],
      })),
    [findings],
  );
  const visible = useMemo(
    () =>
      rows
        .map((issue, key) => ({ issue, key }))
        .filter((_, i) => filter === "all" || findings[i]?.check === filter),
    [rows, findings, filter],
  );
  const { copy, fallbackRef, onCopy } = useCopyText(() => findingsToText(findings));

  const chip = (value: Filter, label: string, n: number) => (
    <Button
      key={value}
      variant={filter === value ? "secondary" : "ghost"}
      size="xs"
      aria-pressed={filter === value}
      onClick={() => {
        setFilter(value);
        setLimit(ISSUE_BATCH);
      }}
      data-testid={`health-filter-${value}`}
    >
      {label} <span className="tabular-nums">{n}</span>
    </Button>
  );

  return (
    <section
      aria-label="Schema health"
      className={cn("flex h-full min-h-0 flex-col bg-card", className)}
      data-testid="health-panel"
    >
      <header className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        <div
          className="flex flex-wrap items-center gap-0.5"
          role="group"
          aria-label="Filter checks"
        >
          {chip("all", "All", findings.length)}
          {HEALTH_CHECKS.map((id) => chip(id, HEALTH_CHECK_LABELS[id], counts[id]))}
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void onCopy()}
            disabled={findings.length === 0}
            data-testid="health-copy"
          >
            {copy === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copy === "copied" ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Close issues"
            onClick={closeIssuesPanel}
            data-testid="health-close"
          >
            <X aria-hidden />
          </Button>
        </div>
      </header>
      {copy === "failed" && (
        <div className="border-b px-3 py-2 text-xs" role="alert">
          <p className="mb-1 text-destructive">Copy failed — select the text manually.</p>
          <textarea
            ref={fallbackRef}
            readOnly
            value={findingsToText(findings)}
            className="h-24 w-full resize-y rounded border bg-background p-1 font-mono text-[11px]"
            aria-label="Health findings as text"
            data-testid="health-copy-fallback"
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {findings.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-testid="health-empty">
            No health findings.
          </p>
        ) : (
          <>
            <ul data-testid="health-list">
              {visible.slice(0, limit).map(({ issue, key }) => (
                <IssueRow
                  key={key}
                  issue={issue}
                  tableName={issue.tableId ? tables?.[issue.tableId]?.name : undefined}
                  onShowTable={revealTable}
                />
              ))}
            </ul>
            {visible.length > limit && (
              <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
                <span>
                  Showing {limit.toLocaleString("en-US")} of{" "}
                  {visible.length.toLocaleString("en-US")}
                </span>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setLimit((n) => n + ISSUE_BATCH)}
                  data-testid="health-show-more"
                >
                  Show {Math.min(ISSUE_BATCH, visible.length - limit)} more
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
