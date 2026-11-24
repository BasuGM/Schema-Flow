"use client";

import { CircleAlert, TriangleAlert } from "lucide-react";
import { keyShortcutsFor, withShortcut } from "@/components/commands/shortcuts";
import { ToolbarButton } from "@/components/workspace/toolbar-button";
import { countIssues } from "@/domain/schema/issues";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Toolbar toggle for the issues panel; counts are primitive selectors (no re-render on other store changes). */
export function IssuesButton() {
  const errors = useSchemaStore((s) => countIssues(s.issues).errors);
  const warnings = useSchemaStore((s) => countIssues(s.issues).warnings);
  const total = useSchemaStore((s) => s.issues.length);
  const hasSchema = useSchemaStore((s) => s.schema !== null);
  const open = useUiStore((s) => s.issuesPanelOpen);
  const setOpen = useUiStore((s) => s.setIssuesPanelOpen);
  const openHealth = useUiStore((s) => s.openHealthPanel);
  const none = errors + warnings === 0;
  const summary = none
    ? "No import issues"
    : [errors && plural(errors, "error"), warnings && plural(warnings, "warning")]
        .filter(Boolean)
        .join(", ");

  return (
    <ToolbarButton
      tooltip={withShortcut("Issues and health checks", "health")}
      aria-keyshortcuts={keyShortcutsFor("health")}
      unavailable={!hasSchema && !open}
      aria-label={`Issues and health checks: ${summary}`}
      aria-pressed={open}
      // With nothing to show under Issues the panel opens on Health.
      onClick={() => (!open && total === 0 ? openHealth() : setOpen(!open))}
      data-testid="toolbar-issues"
    >
      {errors > 0 && (
        <span
          className="flex items-center gap-0.5 text-destructive"
          data-testid="toolbar-issues-errors"
        >
          <CircleAlert aria-hidden />
          <span className="tabular-nums">{errors}</span>
        </span>
      )}
      {(warnings > 0 || none) && (
        <span
          className="flex items-center gap-0.5 text-muted-foreground"
          data-testid="toolbar-issues-warnings"
        >
          <TriangleAlert aria-hidden />
          <span className="tabular-nums">{warnings}</span>
        </span>
      )}
      <span className="max-lg:sr-only">Issues</span>
    </ToolbarButton>
  );
}
