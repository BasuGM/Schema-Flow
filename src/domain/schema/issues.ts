import type { ImportIssue } from "./types";

/** Errors first, then by line (issues without a line last); stable within equal keys. */
export function sortIssues(issues: readonly ImportIssue[]): ImportIssue[] {
  const rank = (i: ImportIssue) => (i.severity === "error" ? 0 : 1);
  return issues
    .map((issue, k) => ({ issue, k }))
    .sort(
      (a, b) =>
        rank(a.issue) - rank(b.issue) ||
        (a.issue.line ?? Number.POSITIVE_INFINITY) - (b.issue.line ?? Number.POSITIVE_INFINITY) ||
        a.k - b.k,
    )
    .map(({ issue }) => issue);
}

export function countIssues(issues: readonly ImportIssue[]): { errors: number; warnings: number } {
  let errors = 0;
  for (const i of issues) if (i.severity === "error") errors++;
  return { errors, warnings: issues.length - errors };
}

/** Plain-text list for copying: `ERROR    line 27   message`, one issue per line. */
export function issuesToText(issues: readonly ImportIssue[]): string {
  return issues
    .map((i) =>
      [
        i.severity.toUpperCase().padEnd(8),
        (i.line !== undefined ? `line ${i.line}` : "").padEnd(10),
        i.message,
      ].join(""),
    )
    .join("\n");
}
