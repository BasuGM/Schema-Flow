# Logging and monitoring

**There is no logging pipeline or monitoring.** No analytics, telemetry, error reporting service or
remote logs: that would send information about the user's schemas off their machine. What exists
instead is in-product feedback about the user's own data, plus a few developer aids.

## What the user sees

| Mechanism        | What it reports                                                                                                                                                                                           | Where                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `ImportIssue`    | Problems found while importing: unreadable or unsupported statements, unresolved references, name clashes. Severity `error` or `warning`, with line, statement excerpt and a link to the table when known | Import preview; issues panel (`src/components/issues`)                 |
| Issues panel     | All issues for the loaded schema, with source excerpts, copy as text, and jump to the table                                                                                                               | Docked panel, or a sheet on small screens                              |
| Health panel     | Four advisory checks: missing primary key, unindexed foreign key, orphan table, naming style. Advice, not import errors                                                                                   | Same bottom panel, `src/analysis/health.ts`                            |
| Error boundaries | A render failure in one region (diagram, table list, inspector, issues, search, import)                                                                                                                   | Compact `role="alert"` fallback with Try again; the rest keeps working |
| App error pages  | A failure outside the regions, or in the root layout                                                                                                                                                      | `src/app/error.tsx`, `src/app/global-error.tsx`                        |
| Status messages  | "Restoring...", "Saved data cleared" and similar                                                                                                                                                          | Live regions                                                           |

See [ERROR_HANDLING](ERROR_HANDLING.md) for how these fit together.

## Console output

Normal use logs nothing. When an error boundary catches a render error it writes exactly two
expected lines: React's own error report and `SchemaFlow: the <region> could not be displayed.`
([ADR-020](development/ARCHITECTURE.md#adr-020--error-boundaries-per-region-app-level-error-pages-build-time-qa-hooks-2026-11-16-p2-t10)).

## How to debug

1. Open the issues panel first; most import trouble is explained there with the statement excerpt.
2. Reproduce with `npm run dev` (http://localhost:3000) and the browser console.
3. To test the failure screens, build with `NEXT_PUBLIC_QA_HOOKS=1 npm run build`: the console then
   has `schemaflowQa.crash("<region>")` and `schemaflowQa.heal()`. The variable is a build-time
   constant, so a normal build contains neither it nor the hook code.
4. For speed questions use the perf scripts in `scripts/headless/`, described in
   [PERFORMANCE](PERFORMANCE.md).
5. Check saved state under Application, then localStorage keys starting `schemaflow:` and the
   IndexedDB database `schemaflow`.

## If monitoring were ever added

It would have to be opt-in and carry no schema content (counts and timings at most). Nothing like
that exists or is planned.
