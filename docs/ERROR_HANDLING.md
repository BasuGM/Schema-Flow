# Error handling

One rule drives everything here: **user data never crashes the app.** Bad input becomes a message
the user can read and act on, and a bug in one part of the screen does not take the rest with it.

## Parsing and import: issues, not exceptions

Parsers and the normalize step return `ImportIssue`s and never throw
([DATA_FLOW](DATA_FLOW.md), [API_DOCUMENTATION](API_DOCUMENTATION.md)):

```ts
interface ImportIssue {
  severity: "error" | "warning";
  message: string;
  line?: number;
  statement?: string;
  table?: string; // raw name as a parser saw it
  tableId?: TableId; // set when the table exists in the schema
}
```

`ImportResult` is either `{ ok: true, schema, issues }` or `{ ok: false, schema?, issues }`. A
statement the parser cannot read is skipped with a warning and the rest of the file still imports, so
one odd line does not hide the other 299 tables. Input the importer will not even try (a file over
5 MB, a binary file) is refused in the import dialog with a message, before any parsing.

Issues reach the user in two places: the import dialog, and the **Issues** panel docked under the
canvas, which opens by itself on errors. Issues with a `tableId` link to that table on the canvas
([ADR-015](development/ARCHITECTURE.md#adr-015--issues-panel-docked-under-the-canvas-errors-open-it-2026-11-16)).
A separate **Health** tab runs checks on a schema that imported fine (for example tables without a
primary key); it is advice, not error handling ([ADR-034](development/ARCHITECTURE.md#adr-034--schema-health-checks-in-a-second-bottom-panel-tab-2026-11-21-p4-t01)).

## Rendering: error boundaries per region

A render error in one region shows a compact `role="alert"` message with **Try again**, and the rest
of the workspace keeps working
([ADR-020](development/ARCHITECTURE.md#adr-020--error-boundaries-per-region-app-level-error-pages-build-time-qa-hooks-2026-11-16-p2-t10)).

| Region        | Boundary test id   |
| ------------- | ------------------ |
| Canvas        | `canvas-error`     |
| Table list    | `table-list-error` |
| Inspector     | `inspector-error`  |
| Issues panel  | `issues-error`     |
| Search dialog | `search-error`     |
| Import form   | `import-error`     |

- Boundaries are keyed on the schema fingerprint, so a new import retries the region by itself.
- In sheets and dialogs the fallback also offers **Close**, and Escape closes. If the failed region
  held focus, focus moves to Try again.
- Each caught error logs two expected console lines: React's own report and
  `SchemaFlow: the <region> could not be displayed.`

Above the regions, `src/app/error.tsx` catches errors in the toolbar and layout (Try again and
Reload), and `src/app/global-error.tsx` replaces the root layout if it fails, with inline styles
that follow the OS colour scheme.

## Storage failures

Reading `localStorage` can throw (private mode, blocked site data), and IndexedDB may be missing.
`src/lib/safe-storage.ts` and `src/lib/session-db.ts` turn those cases into "nothing saved". Saved
layouts and the saved source record are validated before use, and invalid ones are dropped, so the
worst outcome is a fresh layout ([DATABASE_DESIGN](DATABASE_DESIGN.md#browser-storage)).

## Export and file operations

Text generators return warnings alongside the text when a feature cannot be expressed in the target
dialect (for example PostgreSQL expressions in MySQL), so the user sees the loss before copying
([ADR-028](development/ARCHITECTURE.md#adr-028--text-generators-sql-prisma-mermaid-json-with-warnings-and-fixed-point-tests-2026-11-19-p3-t04)).
The export preview is truncated at 200,000 characters, and the downloaded file is complete.

## Testing the failure paths

- **Unit:** hostile names in every generator (`src/test/hostile-schema.ts`), regex-backtracking
  budgets (`src/parsers/whitespace-performance.test.ts`), invalid saved data, Try again behaviour.
- **Browser:** `tests/e2e/error-regions.spec.ts` crashes each region on purpose. It needs a build
  made with `NEXT_PUBLIC_QA_HOOKS=1`, which adds `schemaflowQa.crash("<region>")` and
  `schemaflowQa.heal()` to the console. `next.config.ts` fixes the variable at build time, so a
  normal build contains neither the variable nor the hook code ([TESTING](TESTING.md)).

## Limits

There is no error reporting service, so a crash on someone else's machine is invisible to the
maintainer ([LOGGING_AND_MONITORING](LOGGING_AND_MONITORING.md)). Errors are also not translated or
categorised beyond error and warning.
