# Coding standards

The project's working rules in short form. The authoritative, longer versions are the root
`CLAUDE.md` and [development/AGENT-REFERENCE.md](development/AGENT-REFERENCE.md); if they ever
disagree with this page, they win.

## Language and tooling

- **Strict TypeScript.** No `any` (`@typescript-eslint/no-explicit-any` is an error), no
  `@ts-ignore`, no disabled lint rules without a documented justification.
- **Prettier** with `printWidth: 100` and the Tailwind class-sorting plugin. `npm run format` fixes,
  `npm run format:check` verifies.
- **ESLint 9** with `eslint-config-next`.
- **Node 22 or newer** ([ENVIRONMENT_SETUP](ENVIRONMENT_SETUP.md)).

## Files and naming

- kebab-case files, PascalCase components, named exports (no default exports for components).
- Tests sit next to the code (`thing.ts`, `thing.test.ts`). Component tests start with the
  `// @vitest-environment jsdom` docblock; everything else runs in Node.
- Components stay small. No dead code. A `TODO` needs a ROADMAP task ID.
- `data-testid` on key UI so the browser suite can find it without relying on text or pixels.

## Architecture boundaries

These are the rules that matter most ([SYSTEM_DESIGN](SYSTEM_DESIGN.md),
[diagram](diagrams/module-boundaries.md)).

- `src/domain`, `src/graph`, `src/samples`, `src/parsers`, `src/analysis` and `src/generators` are
  **pure TypeScript**: no React, Next or browser imports.
- The normalized `Schema` is the single source of truth. React Flow nodes and edges are derived by
  `schemaToFlow()` and never hold schema data.
- Parsers never touch React Flow; canvas components never touch parsers.
- Three Zustand stores (`schema-store`, `layout-store`, `ui-store`). Narrow selectors, and
  `useShallow` when a selector returns an object or array.
- React Flow `nodeTypes` and `edgeTypes` are module-scope constants; node components are `memo`ed.
- A new dependency is justified in the architecture record first ([DEPENDENCIES](DEPENDENCIES.md)).

## Behaviour

- **User data never crashes the app.** Return `ImportIssue`s, do not throw
  ([ERROR_HANDLING](ERROR_HANDLING.md)).
- **Accessibility:** semantic elements, labelled icon buttons, visible focus, everything reachable by
  keyboard. An axe audit runs in the browser suite ([TESTING](TESTING.md)).
- **Privacy:** schema data never leaves the browser; SQL is parsed as text and never executed
  ([SECURITY](SECURITY.md)).

## Scope rules

The project is built for a MacBook Air M1 with 8 GB of RAM and realistic inputs, up to about 300
tables. Beyond that the app degrades gracefully (no crash, a short notice) and stops. Development
speed and everyday usability beat completeness: edge cases get planned work only if they cause a
crash or data loss, and performance budgets are added only when a feature is visibly slow
([PERFORMANCE](PERFORMANCE.md)).

## Before a commit

`npm run check` must be green: typecheck, then lint, then test, then build, stopping at the first
failure. Failures are fixed at the root cause rather than by loosening a check. Commit messages are
`<TASK>: <short title>`. See [CI_CD](CI_CD.md) for how checks and verification fit together.

## Bug triage

Fix only blocking bugs (high severity, crash or data loss, breaks the next task, or stops
verification) before moving on. The rest are logged in the
[QA_LOG backlog](development/QA_LOG.md#backlog) with a target.
