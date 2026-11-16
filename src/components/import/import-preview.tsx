"use client";

import { countIssues, sortIssues } from "@/domain/schema/issues";
import type { ImportIssue, Schema } from "@/domain/schema/types";
import type { ParsedSchemaText } from "@/parsers";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatBytes, MAX_IMPORT_BYTES } from "./import-draft";
import type { ImportParseState } from "./use-import-parse";

/** Issues listed in the dialog; the full list is the issues panel (P2-T06). */
const MAX_LISTED_ISSUES = 50;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const DIALECT_LABEL = { postgresql: "PostgreSQL", mysql: "MySQL", sqlite: "SQLite" } as const;

export function formatLabel(parsed: ParsedSchemaText): string {
  if (parsed.format === "prisma") return "Prisma schema";
  if (parsed.format === "sql")
    return parsed.dialect ? `${DIALECT_LABEL[parsed.dialect]} SQL` : "SQL";
  return "Unknown format";
}

export function countsText(schema: Schema): string {
  const tables = Object.values(schema.tables);
  const parts = [
    plural(tables.length, "table"),
    plural(
      tables.reduce((n, t) => n + t.columns.length, 0),
      "column",
    ),
    plural(Object.keys(schema.relationships).length, "relationship"),
  ];
  const enums = Object.keys(schema.enums).length;
  if (enums > 0) parts.push(plural(enums, "enum"));
  return parts.join(" · ");
}

export function issuesText(issues: ImportIssue[]): string {
  const { errors, warnings } = countIssues(issues);
  if (issues.length === 0) return "No issues";
  return [errors && plural(errors, "error"), warnings && plural(warnings, "warning")]
    .filter(Boolean)
    .join(" · ");
}

/** Label of the confirm button, e.g. "Import 3 tables (1 error)"; null when nothing can be imported. */
export function importLabel(state: ImportParseState): string | null {
  if (state.status !== "done") return null;
  const { schema, issues } = state.parsed.result;
  const tables = schema?.tableOrder.length ?? 0;
  if (tables === 0) return null;
  const { errors } = countIssues(issues);
  return `Import ${plural(tables, "table")}${errors ? ` (${plural(errors, "error")})` : ""}`;
}

function statusText(state: ImportParseState): string {
  switch (state.status) {
    case "idle":
      return "Paste SQL DDL or a Prisma schema, or choose or drop a file.";
    case "parsing":
      return "Parsing…";
    case "too-large":
      return `This file is ${formatBytes(state.size)}; the limit is ${formatBytes(MAX_IMPORT_BYTES)}.`;
    case "binary":
      return "This looks like a binary or compressed file.";
    case "done":
      return `Parsed as ${formatLabel(state.parsed)}`;
  }
}

export function ImportPreview({ state }: { state: ImportParseState }) {
  const problem = state.status === "too-large" || state.status === "binary";
  const result = state.status === "done" ? state.parsed.result : undefined;
  // Same order as the issues panel: errors first, then by line.
  const issues = result ? sortIssues(result.issues) : [];
  return (
    <section className="flex flex-col gap-2" aria-live="polite" data-testid="import-preview">
      <p
        className={cn("text-sm", problem ? "text-destructive" : "text-muted-foreground")}
        data-testid="import-status"
      >
        {statusText(state)}
      </p>
      {result?.schema && (
        <p className="text-sm font-medium tabular-nums" data-testid="import-counts">
          {countsText(result.schema)}
        </p>
      )}
      {result && (
        <div data-testid="import-issues">
          <p className="text-sm text-muted-foreground" data-testid="import-issue-summary">
            {issuesText(result.issues)}
          </p>
          {issues.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-1 text-xs">
              {issues.slice(0, MAX_LISTED_ISSUES).map((issue, k) => (
                <li key={k} className="flex items-start gap-2" data-testid="import-issue">
                  <Badge
                    variant={issue.severity === "error" ? "destructive" : "secondary"}
                    className="shrink-0 font-normal tabular-nums"
                  >
                    {issue.line !== undefined ? `line ${issue.line}` : issue.severity}
                  </Badge>
                  <span className="min-w-0 break-words">{issue.message}</span>
                </li>
              ))}
              {issues.length > MAX_LISTED_ISSUES && (
                <li className="text-muted-foreground">+{issues.length - MAX_LISTED_ISSUES} more</li>
              )}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
