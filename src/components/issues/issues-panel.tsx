"use client";

import { Check, Copy, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { countIssues, issuesToText, sortIssues } from "@/domain/schema/issues";
import { copyText } from "@/lib/copy-text";
import { cn } from "@/lib/utils";
import { revealTable } from "@/stores/reveal";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { IssueRow } from "./issue-row";

/** Rows rendered per step: a garbage file can produce thousands of issues. */
export const ISSUE_BATCH = 500;

type Filter = "all" | "errors" | "warnings";
type CopyState = "idle" | "copied" | "failed";

/**
 * Issues of the current schema (import issues plus validation). Rendered as the bottom panel or,
 * on narrow screens, inside a bottom sheet; same content and test ids either way. Remount it (key)
 * when the schema changes to reset the filter and batch.
 */
export function IssuesPanel({ className }: { className?: string }) {
  const issues = useSchemaStore((s) => s.issues);
  const tables = useSchemaStore((s) => s.schema?.tables);
  const setOpen = useUiStore((s) => s.setIssuesPanelOpen);
  const [filter, setFilter] = useState<Filter>("all");
  const [limit, setLimit] = useState(ISSUE_BATCH);
  const [copy, setCopy] = useState<CopyState>("idle");
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  const sorted = useMemo(() => sortIssues(issues), [issues]);
  const counts = useMemo(() => countIssues(issues), [issues]);
  // Keyed by position in the full sorted list, so an expanded row stays with its issue when the
  // filter changes.
  const visible = useMemo(
    () =>
      sorted
        .map((issue, key) => ({ issue, key }))
        .filter(
          ({ issue }) => filter === "all" || (issue.severity === "error") === (filter === "errors"),
        ),
    [sorted, filter],
  );

  const onCopy = async () => setCopy(await copyText(issuesToText(sorted)));

  useEffect(() => {
    if (copy === "failed") fallbackRef.current?.select();
    if (copy !== "copied") return;
    const timer = setTimeout(() => setCopy("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copy]);

  const chip = (value: Filter, label: string, n: number) => (
    <Button
      variant={filter === value ? "secondary" : "ghost"}
      size="xs"
      aria-pressed={filter === value}
      onClick={() => {
        setFilter(value);
        setLimit(ISSUE_BATCH);
      }}
      data-testid={`issues-filter-${value}`}
    >
      {label} <span className="tabular-nums">{n}</span>
    </Button>
  );

  return (
    <section
      aria-label="Import issues"
      className={cn("flex h-full min-h-0 flex-col bg-card", className)}
      data-testid="issues-panel"
    >
      <header className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        <h2 className="px-1 text-sm font-semibold">Issues</h2>
        <div className="flex items-center gap-0.5" role="group" aria-label="Filter issues">
          {chip("all", "All", issues.length)}
          {chip("errors", "Errors", counts.errors)}
          {chip("warnings", "Warnings", counts.warnings)}
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => void onCopy()}
            disabled={issues.length === 0}
            data-testid="issues-copy"
          >
            {copy === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copy === "copied" ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Close issues"
            onClick={() => setOpen(false)}
            data-testid="issues-close"
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
            value={issuesToText(sorted)}
            className="h-24 w-full resize-y rounded border bg-background p-1 font-mono text-[11px]"
            aria-label="Issues as text"
            data-testid="issues-copy-fallback"
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {issues.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground" data-testid="issues-empty">
            No issues for this schema.
          </p>
        ) : (
          <>
            <ul data-testid="issues-list">
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
                  data-testid="issues-show-more"
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
