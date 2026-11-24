# Technical challenges

Seven problems I can tell as stories. Each one has the same shape: problem, cause, fix, evidence,
lesson. In every story the bug was found by a test or by Cowork's browser run, and I directed the
fix. Claude Code made the change. Numbers are from the QA log and ADRs, stamped 2026-11-24.

Related: [QA_LOG](development/QA_LOG.md), [DESIGN_DECISIONS](DESIGN_DECISIONS.md),
[LESSONS_LEARNED](LESSONS_LEARNED.md).

## 1. Edges drawn behind unrelated tables (QA-001)

- **Problem.** Long relationships were drawn behind tables that were not part of them. The
  diagram looked like a table was connected to things it was not.
- **Cause.** The default smoothstep edge ignores tables between its two ends.
- **Fix.** Dagre already computes routes around tables. I kept its waypoints for edges that span
  more than one layer, and draw a curve through them, but only while both end tables are still
  where the route was computed. If you drag a table, the edge falls back to a plain path
  ([ADR-010](development/ARCHITECTURE.md#adr-010--use-dagres-edge-routes-for-long-edges-2026-11-13-qa-001)).
- **Evidence.** Cowork re-verified in the browser. The fix then exposed a second problem, QA-004:
  labels on every edge of a selected table covered the neighbours. Labels now show only for the
  hovered or clicked edge ([ADR-011](development/ARCHITECTURE.md#adr-011--edge-labels-anchored-at-the-fk-row-above-nodes-2026-11-13-qa-002-revised-for-qa-004)).
- **Lesson.** A fix can create the next bug. Re-verify in the browser, not only in unit tests. The
  cost I accepted: moving a table in the middle is not detected, so a route may cross it.

## 2. A regex that froze the tab (QA-013)

- **Problem.** About 1 MB of blank lines hung the tab. Cowork measured about 4 s; the same input
  took 16.5 s on my M1 under test.
- **Cause.** The Prisma detector used `^\s*` under the multiline flag. `\s` matches line breaks,
  so the engine backtracks quadratically across a run of blank lines.
- **Fix.** In line-anchored patterns, whitespace is `[ \t]`, never `\s`. I had every regex in
  `src/parsers` audited. A second one was found in the default-value parser (a cast followed by
  50,000 spaces took 6.4 s; now 1 ms). The Prisma lexer also stopped emitting one token per line
  break.
- **Evidence.** A regression test runs 5 MB of newlines through every format, each under 1 s
  (measured 17–135 ms). The repro tests fail on the old code. Full entry:
  [QA log, round 7](development/QA_LOG.md#2026-11-16--cowork-re-verification-round-7-at-3a17db4-p2-t05-all-pass-qa-013).
- **Lesson.** Hostile input is not only about security. A normal-looking file can hang a parser.
  When I find one bad regex, I audit all of them. Timing tests flake under load, so the test takes
  the best of three runs and still fails on a real quadratic regression.

## 3. Large schemas that dropped frames (QA-019, QA-020)

- **Problem.** Panning a zoomed-out 2,000-table schema ran at 27–34 fps.
- **Cause.** Profiles showed the time in painting text too small to read: row text of about 150
  tables at zoom 0.05.
- **Fix.** Above 80 tables and below zoom 0.3, rows draw as one striped block and edge markers
  drop. Rows and edges are memoised apart from their frames. Edges dim with `stroke-opacity`
  instead of group `opacity`, which forced an off-screen buffer per edge
  ([ADR-022](development/ARCHITECTURE.md#adr-022--large-schema-frame-costs-2026-11-16-p2-t10),
  [ADR-023](development/ARCHITECTURE.md#adr-023--real-input-selection-costs-lighter-zoomed-out-canvas-edge-dimming-packed-layout-deferred-2026-11-19-p2-t10-round-12)).
- **Evidence.** Panning rose to 57–59 fps. On one fitted view the canvas went from 11,854 to
  4,189 elements. **Not met:** the 40 ms goal for selecting a hub table. It measured 34–66 ms,
  and I stopped there.
- **Lesson.** My own measuring harness was wrong first. It used synthetic clicks that skip React
  Flow's pointer path, and Cowork caught it (QA-019). I switched to real input events. Measure
  the way a user does. And know when to stop: 2,000 tables is outside my target.

## 4. A 242,000 px tall diagram (QA-018, QA-034, QA-035)

- **Problem.** The GitLab sample (992 tables) laid out at 3,904 × 242,359 px. Fit-to-view showed a
  thin slice.
- **Cause.** Dagre's layered layout of a large, shallow graph is very tall and narrow.
- **Fix.** `layoutPacked` runs when a schema has 50+ tables and is more than 4:1 elongated. It
  lays out each connected component, wraps tall columns, and shelf-packs the blocks toward 16:10.
  Smaller schemas are returned unchanged
  ([ADR-031](development/ARCHITECTURE.md#adr-031--packed-layout-300-table-design-target-no-canvas-overview-2026-11-20-p3-t07)).
- **Evidence.** The layout became about 20,480 × 17,688 px. Cowork's next run found two
  follow-ups, an empty 8,000 px band (QA-034) and a clipped Reset view (QA-035). Both were fixed
  and verified.
- **Lesson.** I prototyped a canvas overview renderer, then cut it. On 2026-11-20 I decided the
  target is about 300 tables and dropped its budgets. The code is in git history, not in the tree.
  A packed 992-table view is still slow by design, and I say so.

## 5. SQL that does not survive a trip to another dialect (QA-030, QA-031)

- **Problem.** Exporting the GitLab PostgreSQL schema to SQLite produced SQL that failed to load
  ("unrecognized token ':'"). A default like `''::character varying` became `''::`.
- **Cause.** Two bugs. The parser ended a default expression at the word `character`, because it
  looked like a column constraint. And PostgreSQL casts and operators were copied as written into
  dialects that do not have them.
- **Fix.** A word right after `::` is no longer a constraint (QA-030). For other targets,
  `portableExpression` strips simple casts, remaps a few functions and allows only a whitelist.
  Anything it is unsure about is left out, with a counted warning
  ([ADR-033](development/ARCHITECTURE.md#adr-033--postgresql-expressions-in-mysql-and-sqlite-exports-2026-11-20-bb-p3)).
- **Evidence.** Cowork loaded each exported file into SQLite, and `scripts/headless/sqlite-load.mjs` repeats that. Same-dialect output is guarded by a
  hash so it stays byte-identical. After the fix, GitLab shows no `::)` in any target.
- **Lesson.** For an export that is a convenience, "uncertain means left out" beats "best guess".
  A missing constraint with a warning is honest. A wrong one is not.

## 6. A SQL parser library that rejects normal dumps (ADR-012)

- **Problem.** The obvious choice, `node-sql-parser`, failed on real PostgreSQL output.
- **Cause.** I probed it before adopting it. Its PostgreSQL build rejected the whole
  `CREATE TABLE` on enum column types, `GENERATED ALWAYS AS IDENTITY` and `REFERENCES t` with no
  column list. Each dialect build was 200–300 KB.
- **Fix.** The probe was escalated to me, and I chose a tolerant, dependency-free parser of about
  1,190 code lines. A bad statement becomes a line-numbered warning. A Prisma parser followed the
  same way ([ADR-012](development/ARCHITECTURE.md#adr-012--hand-written-tolerant-ddl-parser-instead-of-node-sql-parser-2026-11-13)).
- **Evidence.** Fixtures, seeded robustness tests, real-world dumps and a 1 MB performance test
  (about 0.1 s). The cost I accepted: I own the dialect corners.
- **Lesson.** Probe before you depend. Measure what a dependency would really cost.

## 7. Icon-only buttons with no name (ADR-038)

- **Problem.** On narrow screens, the Export, Layout, Import and Issues buttons had no accessible
  name for a screen reader.
- **Cause.** The text labels used `display: none` below a breakpoint, so only an icon remained.
- **Fix.** The labels now use `sr-only` at small sizes. I also added a skip link and replaced React
  Flow's default aria text, which offered to delete or move nodes
  ([ADR-038](development/ARCHITECTURE.md#adr-038--accessibility-audit-with-axe-2026-11-24-p4-t06)).
- **Evidence.** An axe run on ten states in light and dark found it, and passes after the fix.
  Still open, all won't fix: QA-043 (the shortcut string is fixed at build time on a Mac), QA-044
  (destructive button contrast 3.79 in light mode) and QA-045 (the test is flaky while a dialog
  fades in). See [KNOWN_ISSUES](KNOWN_ISSUES.md).
- **Lesson.** Real layout matters: contrast and hidden labels cannot be checked in jsdom. And
  "zero violations" only describes the states the test covers.
