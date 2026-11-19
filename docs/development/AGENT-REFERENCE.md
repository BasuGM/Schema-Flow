# Agent reference (detail moved from CLAUDE.md)

Linked from the root `CLAUDE.md`. Everything here is still a rule; nothing was dropped in the move.

## Commands (detail)

- `npm run dev` — dev server on http://localhost:3000. Run **at most one**; never leave watchers
  running (`vitest run`, not `vitest --watch`). Machine is an 8 GB M1 shared with VS Code/Chrome.
- `npm run test` / `npm run test:coverage` / `npm run typecheck` / `npm run lint` / `npm run format`.
- Production check: stop the dev server, `npm run build` (static export to `out/`), then
  `npm run start`, which serves `out/` with `python3 -m http.server 3000`. It is a static file
  server, not `next start`.
- Dev-only perf sample: `/?sample=synthetic&tables=200` (capped at 1,000 tables).
- Wall-clock budgets live in `*performance.test.ts`; Vitest runs them in their own project after
  the other tests, one file at a time.
- Phone toolbar regression: `node scripts/headless/toolbar-width.mjs` (needs Chrome and the server
  running) must print PASS for light and dark at 390×844.
- Text export from the CLI (P3-T04, plain Node ≥ 22.18, no dependency):
  `node --experimental-transform-types --no-warnings --import ./scripts/headless/alias-hook.mjs scripts/headless/generate.ts <file> <postgres|mysql|sqlite|prisma|mermaid|mermaid-keys|json>`
  prints the export to stdout and warnings to stderr.

## Browser suite (e2e, Playwright)

`tests/e2e/` is a committed Chromium-only suite (ADR-024) for the UI-observable AC-P1-\* and
AC-P2-\* ACs. It is **not** part of `npm run check` (it needs a built, served app and a browser).

- Run: serve a production build, then `npm run e2e` (the suite never starts a server).
  `npm run build && npm run start` serves `out/` on :3000; with the dev server already on :3000,
  serve `out/` elsewhere (`python3 -m http.server 3100 --directory out`) and set
  `E2E_BASE_URL=http://localhost:3100`. Default `E2E_BASE_URL` is `http://localhost:3000`.
- One worker by default (`E2E_WORKERS` raises it): python's `http.server` resets connections when
  two browsers load chunks at once, so the app never hydrates. Full run: about 2 minutes.
- Output: a compact summary (`e2e: N passed, N failed, N skipped`, then one line per failure with
  the locator and expected/received values) and `e2e-results.json` (Playwright JSON reporter, git-
  ignored). `npm run e2e -- phone.spec.ts -g "overflow"` runs a subset.
- Error regions (`error-regions.spec.ts`) need the QA-hook build: serve `out-qa/`
  (`NEXT_PUBLIC_QA_HOOKS=1 npm run build`, copied to `out-qa/`) and run
  `E2E_QA_HOOKS=1 E2E_BASE_URL=<that server> npm run e2e -- error-regions.spec.ts`. Without
  `E2E_QA_HOOKS=1` those tests are skipped and one test checks that `schemaflowQa` is undefined.
- Specs, one per area: `import` (paste / file picker / drop for every fixture, plus the real
  fixtures), `issues`, `search`, `inspector`, `neighbourhood`, `panels` (inert, Enter, keyboard),
  `phone` (390×844), `error-regions`. Shared helpers: `tests/e2e/support/app.ts`.
- Rules: assert on `data-testid`, `data-*` and ARIA state, never pixels or fixed timeouts (wait on
  state); use real mouse and keyboard input. The one synthetic input is the file **drop** (a test
  cannot start an OS drag), which dispatches `dragenter`/`dragover`/`drop` with a `DataTransfer`.
- Handoffs list the e2e command, the spec files added or changed, and the result.

## Architecture boundaries (detail)

- `src/domain`, `src/graph`, `src/samples`, `src/parsers` (and later `src/analysis`,
  `src/generators`) are **pure TypeScript**: no React, Next or browser imports. Fully unit-tested.
  SQL fixtures live in `tests/fixtures/sql/`.
- The normalized `Schema` (`src/domain/schema/types.ts`) is the single source of truth. React Flow
  nodes/edges are derived by `schemaToFlow()`; never store schema data in React Flow state.
- Parsers never touch React Flow; canvas components never touch parsers.
- State lives in three Zustand stores (`src/stores`): `schema-store`, `layout-store`, `ui-store`.
  Subscribe with narrow selectors; use `useShallow` when a selector returns an object/array.
- React Flow `nodeTypes`/`edgeTypes` are module-scope constants; custom nodes/edges are `memo`ed and
  receive only IDs + minimal display data. Selection/highlight state is read per node from
  `ui-store`, so selecting a table does not rebuild the nodes array.
- Every new dependency is justified in `docs/development/ARCHITECTURE.md` before it is added.
  SQL and Prisma are parsed by our own tolerant parsers (ADR-012, ADR-013; no dependency).
  Fixtures live in `tests/fixtures/sql/` and `tests/fixtures/prisma/`.

## Conventions (detail)

- Strict TS (`noUncheckedIndexedAccess`, `noImplicitOverride`). No `any`, no `@ts-ignore`, no
  disabled lint rules without a documented, specific justification.
- kebab-case files, PascalCase components, named exports, colocated `*.test.ts(x)`.
  Component tests start with `// @vitest-environment jsdom`.
- Components stay small (> ~200 lines is a smell). No dead code, no commented-out blocks, no TODO
  without a ROADMAP task ID.
- Add `data-testid` to key UI (toolbar buttons, `table-list-item-<name>`, `table-node-<name>`,
  inspector root, empty states).
  Export dialog (P3-T03, P3-T05): `toolbar-export`, `settings-export`, `settings-export-image`, `more-export`,
  `more-export-image`, `export-dialog`, `export-tab-{sql|prisma|mermaid|json|image}`; text tabs:
  `export-dialect-{postgresql|mysql|sqlite}`, `export-mermaid-{all|keys}`, `export-preview`, `export-text-size`,
  `export-preview-truncated`, `export-warnings`, `export-copy`, `export-copy-status`, `export-download-text`,
  `export-generating`, `export-close`; image tab: `export-format-{png|svg}`, `export-theme-{current|light|dark}`,
  `export-scale-{1|2}`, `export-size` / `export-output` (`data-width`, `data-height`), `export-reduced-note`,
  `export-download`, `export-cancel`; both: `export-error`.
  Session restore (P3-T06): `canvas-restoring`, `settings-clear-data`, `more-clear-data`, `clear-data-dialog`,
  `clear-data-confirm`, `clear-data-cancel`, `clear-data-status`.

## Workflow and status vocabulary

The workflow (session start, end-of-task steps, handoff format) is in CLAUDE.md "Workflow rules".
Status vocabulary (ROADMAP): Not started | In progress | Self-checked | Awaiting Cowork
verification | Verified | Verified with known issues | Blocked. ACs in `VERIFICATION.md` are
numbered `AC-<task>-<n>`; `QA_LOG.md` is append-only apart from its Backlog table.
