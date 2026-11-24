# Performance

The techniques SchemaFlow uses to stay responsive, the measurements behind them, and how to
reproduce them. Size limits and thresholds are on [SCALABILITY](SCALABILITY.md).

Project rule: performance work is done when a feature is visibly slow on the target machine (an M1
MacBook Air, 8 GB) at about 300 tables. Larger sizes are out of scope
([CODING_STANDARDS](CODING_STANDARDS.md#scope-rules)).

## Techniques

**Rendering**

- Nodes carry only `{ tableId, mode }`; components look the immutable table up by ID. React Flow
  `nodeTypes` and `edgeTypes` are module-scope constants and node and edge components are `memo`ed.
- Selection and highlight are per-component boolean selectors, so selecting a table re-renders the
  old and new `TableNode`s, their edges, the inspector and the matching list items, not every node
  ([ADR-009](development/ARCHITECTURE.md#adr-009--rebuilding-react-flow-nodes-only-on-layout-version-changes-2026-11-13)).
- Positions are written to the layout store when a drag **stops**, not on each frame.
- Above 80 tables, `onlyRenderVisibleElements` is on. Below zoom 0.3, large schemas draw column rows
  as one striped block, with edge markers and hover targets removed
  ([ADR-022](development/ARCHITECTURE.md#adr-022--large-schema-frame-costs-2026-11-16-p2-t10)).
- Edge dimming uses `stroke-opacity` rather than group `opacity`, which avoids an offscreen buffer
  per dimmed edge. A recorded test case went from 6 fps to 60 fps (ADR-023).
- Centring that changes the zoom by more than 4× in a large schema jumps instead of animating, and
  nothing animates under `prefers-reduced-motion`.
- Handles are rendered only where an edge attaches.

**Computation**

- Derived data is memoised per schema in a `WeakMap` ([CACHING_STRATEGY](CACHING_STRATEGY.md)).
- Positions: Dagre runs once on load or on the Layout button, not while dragging.
- The parser chunk loads on first use of the Import dialog, off the initial bundle
  ([ADR-014](development/ARCHITECTURE.md#adr-014--import-dialog-lazy-parsers-on-the-main-thread-no-web-worker-2026-11-16)).
- The export preview is cut at 200,000 characters; the downloaded file is complete.

## Measurements

Stamped: **M1 MacBook Air, Chrome, production build, 2026-11-16 to 2026-11-20.** These are the
numbers recorded in the ADRs at the time, not re-measured for this page.

| Measure                               | Before          | After                 | Source                                                                                                                                                              |
| ------------------------------------- | --------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pan, 2,000 tables zoomed out          | 27–34 fps       | 57–59 fps             | ADR-022                                                                                                                                                             |
| Dimmed edges across a zoom-1 view     | 6 fps           | 60 fps                | [ADR-023](development/ARCHITECTURE.md#adr-023--real-input-selection-costs-lighter-zoomed-out-canvas-edge-dimming-packed-layout-deferred-2026-11-19-p2-t10-round-12) |
| Elements on a 2,000-table fitted view | 11,854          | 4,189                 | ADR-023                                                                                                                                                             |
| Hub select/deselect, first frame      | 47–95 ms        | 34–66 ms (goal 40)    | ADR-023, goal not met                                                                                                                                               |
| Layout of GitLab sample (992 tables)  | tall 242,359 px | about 3–4.6 s, packed | [ADR-031](development/ARCHITECTURE.md#adr-031--packed-layout-300-table-design-target-no-canvas-overview-2026-11-20-p3-t07)                                          |

The first three rows are stress fixtures well above the design target; they explain why the
techniques exist. Nothing here is a claim about typical use, and no Lighthouse or Core Web Vitals
numbers have been collected.

## Budgets in the test suite

`*performance.test.ts` files assert wall-clock limits, and Vitest runs them in their own project one
file at a time so that parallel workers do not measure each other
([TESTING](TESTING.md)). Examples: the whitespace parser tests (100 ms to 1 s), the SQL parser test
(1.5 s), and search on 2,000 tables (150 ms to build the index, 30 ms per query). They guard against regressions; they are
not benchmarks, and a loaded machine can trip them.

## Reproducing measurements

Run `scripts/cleanup.sh` first and check `uptime` (1-minute load under 4). Never run two browsers at
once, and measure only a production build served on a free port: `next dev` gives dev-mode numbers.

| Script                                   | Measures                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `scripts/headless/large-schema-perf.mjs` | Pan and select frame times on the 2,000-table fixtures, with real input            |
| `scripts/headless/collapse-perf.mjs`     | Collapse all / show all on the 992-table GitLab fixture                            |
| `scripts/headless/restore-perf.mjs`      | Session restore after reload (992 tables)                                          |
| `scripts/headless/export-perf.mjs`       | Image and text export (992 tables)                                                 |
| `scripts/headless/perf-guard.mjs`        | The load check the others use; they refuse to run when load exceeds the core count |
| `scripts/headless/toolbar-width.mjs`     | Not a perf script: the phone toolbar regression, must print PASS at 390×844        |

For a quick look, the dev-only sample `/?sample=synthetic&tables=200` builds a synthetic schema of
the given size (capped at 1,000).

## Not done

No web worker for parsing or layout ([ADR-014](development/ARCHITECTURE.md#adr-014--import-dialog-lazy-parsers-on-the-main-thread-no-web-worker-2026-11-16)),
no canvas or WebGL renderer, no list virtualisation. See [SCALABILITY_DISCUSSION](SCALABILITY_DISCUSSION.md).
