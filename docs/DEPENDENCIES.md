# Dependencies

The authoritative lists are `dependencies` and `devDependencies` in [package.json](../package.json);
versions and roles are in [TECH_STACK.md](TECH_STACK.md). This page adds the policy.

## Policy

- Every new dependency is justified in [ARCHITECTURE.md](development/ARCHITECTURE.md) first (project rule).
- Core logic is nearly dependency-free: `src/domain`, `src/parsers`, `src/generators` and
  `src/analysis` import no third-party package; `src/graph` uses Dagre (and React Flow types).
- 13 runtime dependencies. All of them are UI or layout related and ship in the static bundle; none runs
  on a server because there is no server.

## Runtime dependencies (13)

next, react, react-dom, @xyflow/react, @dagrejs/dagre, zustand, radix-ui, class-variance-authority, cn,
lucide-react, next-themes, react-resizable-panels, tw-animate-css.

## Development dependencies

Testing (vitest, jsdom, Testing Library, Playwright, axe), linting (ESLint 9 with `eslint-config-next`),
formatting (Prettier with the Tailwind plugin), styling build (Tailwind v4), types, and the shadcn CLI
(used to scaffold components, not at runtime).

## Keeping them honest

- `npm audit` can be run at any time; no result is recorded here because none was captured while
  writing this set (see the QA log for anything found).
- Imported SQL is never evaluated by a dependency: no parser library, no `eval`.
- Notable choices of what _not_ to depend on are in [TECH_STACK.md](TECH_STACK.md#deliberately-not-used).
