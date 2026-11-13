# SchemaFlow — agent rules

Browser-only database schema explorer (Next.js 16 static export, React 19, React Flow 12,
Zustand 5, Tailwind v4, shadcn/ui). Imported SQL is parsed as text and never executed; schema data
never leaves the browser. No backend, no Docker, no AI integrations, 2D only.

@AGENTS.md

## Commands

- `npm run dev` — dev server on http://localhost:3000. Run **at most one**; never leave watchers
  running (`vitest run`, not `vitest --watch`). Machine is an 8 GB M1 shared with VS Code/Chrome.
- `npm run check` — typecheck → lint → test → build (fail fast). Must be green before a commit.
- `npm run test` / `npm run test:coverage` / `npm run typecheck` / `npm run lint` / `npm run format`.
- Dev-only perf sample: `/?sample=synthetic&tables=200`.

## Architecture boundaries

- `src/domain`, `src/graph`, `src/samples` (and in later phases `src/parsers`, `src/analysis`,
  `src/generators`) are **pure TypeScript**: no React, Next or browser imports. Fully unit-tested.
- The normalized `Schema` (`src/domain/schema/types.ts`) is the single source of truth. React Flow
  nodes/edges are derived by `schemaToFlow()`; never store schema data in React Flow state.
- Parsers never touch React Flow; canvas components never touch parsers.
- State lives in three Zustand stores (`src/stores`): `schema-store`, `layout-store`, `ui-store`.
  Subscribe with narrow selectors; use `useShallow` when a selector returns an object/array.
- React Flow `nodeTypes`/`edgeTypes` are module-scope constants; custom nodes/edges are `memo`ed and
  receive only IDs + minimal display data. Selection/highlight state is read per node from
  `ui-store`, so selecting a table does not rebuild the nodes array.
- Every new dependency is justified in `docs/development/ARCHITECTURE.md` before it is added.
  Phase 2 libs (`node-sql-parser`, `@mrleebo/prisma-ast`) are not installed until Phase 2.

## Conventions

- Strict TS (`noUncheckedIndexedAccess`, `noImplicitOverride`). No `any`, no `@ts-ignore`, no
  disabled lint rules without a documented, specific justification.
- kebab-case files, PascalCase components, named exports, colocated `*.test.ts(x)`.
  Component tests start with `// @vitest-environment jsdom`.
- Components stay small (> ~200 lines is a smell). No dead code, no commented-out blocks, no TODO
  without a ROADMAP task ID.
- User data never crashes the app: return `ImportIssue`s, never throw; canvas has an error boundary.
- Accessibility: semantic elements, labelled icon buttons, visible focus, keyboard reachable.
- Add `data-testid` to key UI (toolbar buttons, `table-list-item-<name>`, `table-node-<name>`,
  inspector root, empty states).

## Per-task protocol (see docs/development/)

1. Fix failures at the root cause; run `npm run check`; record actual results.
2. Commit referencing task IDs.
3. Update `ROADMAP.md` (status vocabulary: Not started | In progress | Self-checked | Awaiting Cowork
   verification | Verified | Verified with known issues | Blocked), `VERIFICATION.md` (numbered ACs
   `AC-<task>-<n>`), `QA_LOG.md` (append-only).
4. Ensure exactly one dev server is running and report its URL.
5. Write `docs/development/handoffs/<TASK>.md` and print it under the heading
   `### Claude Cowork Verification Handoff`.
6. When a Cowork report is pasted: log it in QA_LOG (`QA-###` defects), fix root causes with
   regression tests, re-run checks, commit, and issue a re-verification handoff for affected ACs.

## Honesty rule

Claude Code implements and runs automated checks only. Claude Cowork is a separate agent that
verifies in the browser; we cannot invoke it. **Never** claim Cowork or a human verified anything
unless their report has been pasted into the conversation. Until then, status is "Awaiting Cowork
verification" and QA_LOG says "Pending — not independently verified."
