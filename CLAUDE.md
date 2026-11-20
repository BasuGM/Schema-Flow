# SchemaFlow — agent rules

Browser-only database schema explorer (Next.js 16 static export, React 19, React Flow 12,
Zustand 5, Tailwind v4, shadcn/ui). Imported SQL is parsed as text and never executed; schema data
never leaves the browser. No backend, no Docker, no AI integrations, 2D only.

@AGENTS.md

Full detail for every section below: [docs/development/AGENT-REFERENCE.md](docs/development/AGENT-REFERENCE.md).
Workflow skills: implement-plan, fix-qa-round (user-level). Plans go in `docs/development/plans/`.

## Scope

- Target machine: MacBook Air M1, 8 GB RAM. Features, fixtures and checks must run comfortably there.
- Build for the common case: realistic inputs (SchemaFlow: up to ~300 tables). No work on extreme sizes or rare edge cases. Beyond the envelope, degrade gracefully (no crash, a short notice) and stop there.
- Priority: development speed and good everyday usability over completeness. Plans list edge cases only if they cause a crash or data loss. Perf budgets and perf harness runs only when a feature is visibly slow on the target machine.

## Commands

- `npm run check` — typecheck → lint → test → build (fail fast). Must be green before a commit.
- `npm run dev` — http://localhost:3000. At most one; never leave watchers running (`vitest run`).
- Also: `test`, `test:coverage`, `typecheck`, `lint`, `format`; `npm run e2e` (Playwright, separate
  from `check`; needs a served build); production check, perf sample,
  performance budgets and the phone toolbar regression (`scripts/headless/toolbar-width.mjs`
  must print PASS at 390×844) are in the reference.
- Perf and e2e runs: run `scripts/cleanup.sh` first and check `uptime` (1-min load < 4); never run
  two browsers at once; measure only a production build served on a free port (`next dev` on :3000
  gives dev-mode numbers). The perf scripts refuse to run when the load exceeds the core count.

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

## Workflow rules

- Start of every session: read the **Now** block in `docs/development/ROADMAP.md`, then the plan or
  handoff you were given. Don't read `docs/development/handoffs/archive/`.
- End of every task:
  1. Write the handoff in `docs/development/handoffs/<TASK>.md`: Summary (2 lines) / Commits / Files
     changed / How to test (steps → expected) / ACs met yes/no / Open items or deviations.
  2. Update the ROADMAP Now block and the task status.
  3. Add new decisions as ADRs plus a line in the Decision index (ARCHITECTURE.md).
  4. Update ARCHITECTURE only if structure or the data model changed.
  5. Set fixed QA items to "fixed – pending QA" in the QA_LOG Backlog table.
  6. Commit `<TASK>: <short title>` and push.
- Fix failures at the root cause; `npm run check` must be green; record actual results.
- Cowork instructions live in `COWORK.md`; a pasted Cowork report is handled with `/qa`.
- Bug triage: fix only **blocking** bugs before moving on (High, crash/data loss, breaks the next
  task, or stops verification). Log the rest in the QA_LOG Backlog as Deferred → target (a bug-fix
  task or the phase-end bug-bash) and start the next task. Backlog > ~10 → add a bug-fix task.

## Honesty rule

Claude Code implements and runs automated checks only. Claude Cowork is a separate agent that
verifies in the browser; we cannot invoke it. **Never** claim Cowork or a human verified anything
unless their report has been pasted into the conversation. Until then, status is "Awaiting Cowork
verification" and QA_LOG says "Pending — not independently verified."
