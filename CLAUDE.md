# SchemaFlow — agent rules

Browser-only database schema explorer (Next.js 16 static export, React 19, React Flow 12,
Zustand 5, Tailwind v4, shadcn/ui). Imported SQL is parsed as text and never executed; schema data
never leaves the browser. No backend, no Docker, no AI integrations, 2D only.

@AGENTS.md

Full detail for every section below: [docs/development/AGENT-REFERENCE.md](docs/development/AGENT-REFERENCE.md).
Workflow skills: implement-plan, fix-qa-round (user-level). Plans go in `docs/development/plans/`.

## Commands

- `npm run check` — typecheck → lint → test → build (fail fast). Must be green before a commit.
- `npm run dev` — http://localhost:3000. At most one; never leave watchers running (`vitest run`).
- Also: `test`, `test:coverage`, `typecheck`, `lint`, `format`; `npm run e2e` (Playwright, separate
  from `check`; needs a served build); production check, perf sample,
  performance budgets and the phone toolbar regression (`scripts/headless/toolbar-width.mjs`
  must print PASS at 390×844) are in the reference.

## Architecture boundaries

- `src/domain`, `src/graph`, `src/samples`, `src/parsers` (later `src/analysis`, `src/generators`)
  are **pure TypeScript**: no React, Next or browser imports.
- Normalized `Schema` is the single source of truth; React Flow nodes/edges come from
  `schemaToFlow()`. Parsers never touch React Flow; canvas never touches parsers.
- Three Zustand stores (`schema-store`, `layout-store`, `ui-store`); narrow selectors, `useShallow`
  for object/array selectors. React Flow `nodeTypes`/`edgeTypes` are module-scope, nodes `memo`ed.
- Every new dependency is justified in `docs/development/ARCHITECTURE.md` first.

## Conventions

- Strict TS; no `any`, no `@ts-ignore`, no disabled lint rules without documented justification.
- kebab-case files, PascalCase components, named exports, colocated tests (jsdom header for
  component tests). Components small; no dead code; no TODO without a ROADMAP task ID.
- User data never crashes the app: return `ImportIssue`s, never throw; canvas has an error boundary.
- Accessibility: semantic elements, labelled icon buttons, visible focus, keyboard reachable.
- `data-testid` on key UI (list in the reference).

## Per-task protocol

1. Fix failures at the root cause; run `npm run check`; record actual results.
2. Commit referencing task IDs.
3. Update `ROADMAP.md`, `VERIFICATION.md` (`AC-<task>-<n>`), `QA_LOG.md` (append-only); status
   vocabulary is in the reference.
4. Ensure exactly one dev server is running and report its URL.
5. Write `docs/development/handoffs/<TASK>.md`; print it under `### Claude Cowork Verification Handoff`.
6. On a pasted Cowork report: log `QA-###` defects, fix root causes with regression tests,
   re-run checks, commit, issue a re-verification handoff for affected ACs.

## Honesty rule

Claude Code implements and runs automated checks only. Claude Cowork is a separate agent that
verifies in the browser; we cannot invoke it. **Never** claim Cowork or a human verified anything
unless their report has been pasted into the conversation. Until then, status is "Awaiting Cowork
verification" and QA_LOG says "Pending — not independently verified."
