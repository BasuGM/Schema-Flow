# Trade-off analysis

The per-choice tables are in [TRADE_OFFS](TRADE_OFFS.md). This page is the cross-cutting view:
three forces I kept trading against each other, and where I landed. Stamped 2026-11-24.

The forces: **performance**, **maintainability**, and **scope**. Scope won most arguments. That is
a deliberate choice, and it is why the project is finished.

## Scope against performance

I started without a size target. By round 12 (2026-11-19) I was profiling 2,000-table stress
schemas, and each fix helped but none made them good. The GitLab sample (992 tables) laid out at
about 242,000 px tall. I prototyped a canvas overview renderer to fix that. It worked as a design.
Then I cut it.

On 2026-11-20 I set the target at about 300 tables and dropped the budgets I could not afford to
chase. The result:

- Above 300 tables the canvas shows a one-line notice and makes no speed promise.
- The 40 ms selection goal at 2,000 tables was **not met** (34–66 ms), and I stopped.
- A packed 992-table view is slow by design, and I say so.

What I gave up: large schemas. What I got: a project that closed, with a clear claim I can defend
([ADR-031](development/ARCHITECTURE.md#adr-031--packed-layout-300-table-design-target-no-canvas-overview-2026-11-20-p3-t07),
[SCALABILITY](SCALABILITY.md)). The scope rule in [CLAUDE.md](../CLAUDE.md) says the same: build for
the common case, degrade gracefully beyond it, and stop.

## Maintainability against performance

Where I could get speed cheaply, I took it. Where it would cost clarity, I did not.

| I paid for performance with…                       | I protected maintainability by…                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| Memoised rows, edges and derived data per schema   | `WeakMap` caches keyed by the immutable `Schema`: no invalidation code |
| Simplified tables when zoomed out on large schemas | Applying it only above 80 tables and below zoom 0.3                    |
| A packed layout for tall graphs                    | Returning the plain Dagre layout, byte-identical, for small schemas    |
| Rendering only elements in view                    | Using React Flow's own option, not my own virtualiser                  |

What I would not do: write a custom edge router, a canvas renderer or a worker protocol for a
target size I never set. Each is more code to own. They are listed in
[SCALABILITY_DISCUSSION](SCALABILITY_DISCUSSION.md) as ideas, not as work.

## Maintainability against scope

Writing my own parsers, search palette and export renderer was the biggest bet on maintainability.
Each replaced a dependency, and each is code I now own:

- **Parsers.** More code, but tolerant, with line-numbered issues, and no 200–300 KB bundles.
- **Search palette.** More code, but windowed and `table.column` aware.
- **Export renderer.** More code, but it exports the whole diagram, not what is on screen.

I paid for these with tests: fixtures, seeded robustness tests, fixed-point tests for generators.
The check is that the tests are part of `npm run check`, so owning the code is not a hidden cost
([TESTING](TESTING.md)).

## Speed against assurance

AI made implementation fast. It did not make correctness free. I traded raw speed for a loop:
plan with acceptance criteria, implement, run checks, verify in a browser, log defects, fix at
the root, repeat. That is slower per task and cheaper overall. Examples where it paid off: QA-001,
QA-013, QA-030 and the unnamed buttons. All four passed their unit tests and failed in a browser or
on real input.

What I accepted: the verification is by another AI agent, not a person. I do not hide that.

## Where I would change the balance

- With real users who need large schemas, I would invest in performance: first a layout worker,
  then a virtualised list.
- With a team, I would invest in the shared case: a backend, and CI that runs e2e.
- With neither, I would stay where I am. The project does what it claims.
