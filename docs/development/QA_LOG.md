# QA log

Append-only. One entry per handoff. Cowork results are summarized only from reports pasted into a
Claude Code session; until then an entry reads "Pending — not independently verified."

Defect format: `QA-###` · severity (blocker/major/minor/cosmetic) · repro · status.

---

## 2026-11-13 — P1-T01…P1-T05 (foundation)

- **Handoff:** [handoffs/P1-T01-T05.md](handoffs/P1-T01-T05.md)
- **Cowork result:** Pending — not independently verified.
- **Defects:** none recorded.
- **Fixes:** n/a
- **Re-verification:** n/a

---

## 2026-11-13 — P1-T06…P1-T09 + Phase 1 final

- **Handoff:** [handoffs/P1-final.md](handoffs/P1-final.md)
- **Cowork result:** Pending — not independently verified.
- **Defects:** none recorded by Cowork. Issues found and fixed by Claude Code before handoff
  (self-found, not QA defects): workspace not filling the viewport with `h-dvh` in headless Chrome
  (switched to `h-full`); React Flow attribution background in dark mode; missing focus ring on
  non-selectable nodes; low-contrast nullable marker.
- **Fixes:** included in the Phase 1 UI commit.
- **Re-verification:** n/a

---

## 2026-11-13 — Cowork report: Phase 1 (P1-T04 browser checks, P1-T06…T09)

- **Handoff verified:** [handoffs/P1-final.md](handoffs/P1-final.md)
- **Source:** Claude Cowork report pasted into the Claude Code session on 2026-11-13. Chrome on the
  user's MacBook, dev server only, usable viewport 1440×525 (plus a narrow test at 850 px). Real
  pointer and keyboard interaction plus DOM inspection. Cowork did not run the npm scripts or
  check the production build.
- **Result:**
  - PASS: steps 1–4, 6–10, 12–22, edge cases (`tables=5000` clamps to 1000; theme switch with a
    selection; drag then Layout), console on all six loads (only benign messages).
  - PASS with defect: step 5 (QA-001), step 8 (QA-002).
  - PARTIAL: step 11 (QA-003).
  - NOT TESTED: step 23 (reduced motion; the browser tooling can't emulate it), the full toolbar
    tab order, a frame-by-frame theme-flash check, and the production build.
  - Measured on the 200-table sample: 99 nodes rendered when fitted, 41 when zoomed. Longest task
    198 ms during pan/zoom, none during drag.
- **Defects:**
  - **QA-001** · minor · _The orders→users edge runs behind the addresses node._ Repro: load `/`
    with the default layout and look at the edge into `orders.user_id`. Status: **Fixed — awaiting
    re-verification.**
  - **QA-002** · minor (cosmetic) · _Labels on selected edges are clipped by nodes and overlap each
    other._ Repro: select `orders`. Status: **Fixed — awaiting re-verification.**
  - **QA-003** · minor · _Escape doesn't clear the selection when focus is in the table list._
    Repro: click `users` in the list, then press Escape. Status: **Fixed — awaiting
    re-verification.**
- **Observations (not defects):**
  - Long names and types truncate in the inspector at about 300 px: addressed with a two-line row.
  - The dark-mode minimap mask looked heavy: addressed with a darker mask.
  - The Next.js dev indicator overlaps the zoom controls: dev-only, not changed.
  - Panel widths differ after crossing the 900 px breakpoint: cosmetic, not changed, recorded as
    a known limitation.
- **Fixes:** commit `c879f58`, with regression tests in `src/graph/layout-dagre.test.ts`,
  `src/graph/edge-path.test.ts`, `src/components/canvas/relationship-edge.test.ts` and
  `src/components/workspace/selection-sync.test.tsx`. `npm run check` passes: 18 files / 111 tests.
- **Re-verification:** pending, see [handoffs/P1-fix-QA-001-003.md](handoffs/P1-fix-QA-001-003.md).

---

## 2026-11-13 — Cowork re-verification: QA-001…003 (c879f58) + Phase 1 open items

- **Handoff verified:** [handoffs/P1-fix-QA-001-003.md](handoffs/P1-fix-QA-001-003.md)
- **Source:** Claude Cowork report pasted into the Claude Code session on 2026-11-13. Dev server,
  1440×525 viewport, real pointer and keyboard input plus DOM checks.
- **Defect status:**
  - **QA-001: Fixed** (verified). Cowork sampled 200 points along all 13 edge paths; none crosses
    an unrelated table. Drag → step path; Layout → routed path restored.
  - **QA-002: Fixed as reported** (verified). Labels are short, sit at the FK rows, are drawn above
    tables, and don't overlap each other. Follow-up raised as QA-004.
  - **QA-003: Fixed** (verified). Escape works from the list and the inspector ×; it's ignored in
    the filter; with a menu open, the first Escape closes the menu.
- **Steps 1–9:** all PASS. **Regression checklist:** all PASS. Panel toggles and the narrow-window
  collapse were not re-run this round (they passed in round 1).
- **Open items:**
  - AC-P1-T09-4 full Tab order: **PASS**.
  - AC-P1-T09-6 reduced motion: **NOT TESTED**; Cowork's tooling can't emulate it.
  - AC-P1-T09-7 production build: **NOT TESTED**; Cowork's shell can't run the macOS
    node_modules. Cowork asked for the production server to be started on port 3000.
- **New defects:**
  - **QA-004** · minor (cosmetic) · _Selected-edge labels cover other tables' column text._ Repro:
    select `orders` (or `users`) at default sizes. Labels up to ~197 px wide sit in ~110 px rank gaps
    and overlap addresses, orders, products and users rows. Status: **Fixed — awaiting
    re-verification.**
- **Observations:**
  - Routed edges are curves while the others are step lines, which looks inconsistent: addressed,
    all edges now use the same curve style.
  - The dev "N" badge covers the bottom list item's focus ring: dev only, already documented.
- **Fixes:** commit `f382257`. QA-004: labels are shown only for the hovered or clicked edge.
  Found and fixed while writing the QA-004 regression test: edge click-selection never worked,
  because edges were fixed props without `onEdgesChange`. Observation: uniform curve style.
  Regression tests are in `selection-sync.test.tsx`, `layout-dagre.test.ts` (now covering every
  edge), `describe.test.ts` and `use-canvas-commands.test.ts`. `npm run check` passes: 19 files /
  116 tests.
- **Environment change:** the dev server was stopped and the production static export is being
  served on http://localhost:3000 (`npm run start`), as Cowork requested for AC-P1-T09-7.
- **Re-verification:** pending, see [handoffs/P1-fix-QA-004.md](handoffs/P1-fix-QA-004.md).

---

## 2026-11-13 — Cowork re-verification round 3: QA-004 (f382257) + production build

- **Handoff verified:** [handoffs/P1-fix-QA-004.md](handoffs/P1-fix-QA-004.md)
- **Source:** the user pasted a summary of Cowork's round-3 report into the Claude Code session on
  2026-11-13. Verified on the production static build served on http://localhost:3000.
- **Result:**
  - **QA-004: Fixed** (verified in production).
  - **AC-P1-T09-7** (production build): **PASS**.
  - **AC-P1-T09-6** (reduced motion): **NOT TESTED** by Cowork; covered by a unit test only.
- **New defect:**
  - **QA-005** · minor · _Hover and click edge labels scale with canvas zoom._ At the fitted zoom
    (0.354), the 10 px label renders at about 3.5 px; at 0.05 on the 200-table sample it is
    unreadable. Status: **Fixed — awaiting re-verification** (see the next entry).
- **Product decision (user, same session):** selecting a table (canvas, list or keyboard) clears
  any clicked edge and its pinned label, and a clicked edge gets a distinct selected style.
- **Docs correction:** the earlier handoffs said the production server was `npm run start`.
  That is accurate: the script runs `python3 -m http.server 3000 --directory out`, i.e. a static
  server for the `out/` export. VERIFICATION, README and CLAUDE.md now spell this out.

---

## 2026-11-13 — QA-005 fix + edge-selection decision

- **Fix commit:** `3afa62a`. Labels are counter-scaled by 1/zoom. Selecting a table clears a
  clicked edge. Distinct selected-edge style. Regression tests are in `edge-path.test.ts` and
  `selection-sync.test.tsx`. `npm run check` passes: 19 files / 124 tests.
- **Environment:** dev server back on http://localhost:3000.
- **Re-verification:** pending, see [handoffs/P1-QA-005.md](handoffs/P1-QA-005.md).

---

## 2026-11-13 — P2-T01…T03 (SQL import core, pure logic)

- **Handoff:** [handoffs/P2-T01-T03.md](handoffs/P2-T01-T03.md)
- **Commit:** `2efa17c`. `npm run check` passes: 27 files / 185 tests (parser: 8 files / 61 tests).
- **Cowork result:** Pending — not independently verified.
- **Defects:** none recorded.

---

## 2026-11-16 — Cowork QA at ca08df3: QA-006, QA-007, QA-008

- **Source:** the user pasted a summary of Cowork's findings at `ca08df3` into the Claude Code
  session on 2026-11-16. The summary lists these three defects only; it does not report results
  for the steps of [handoffs/P1-QA-005.md](handoffs/P1-QA-005.md) or
  [handoffs/P2-T01-T03.md](handoffs/P2-T01-T03.md), so those ACs stay awaiting verification.
- **New defects:**
  - **QA-006** · minor · _Edge labels near the canvas edge are clipped under the side panel._
    Repro: e-commerce, auto layout, Fit view; the `categories` self-loop label spans x≈184–589
    while the canvas starts at x=260. Root cause: labels have a constant on-screen size (QA-005),
    so a long label beside a table near the pane edge extends past it; no fitView padding can
    contain a ~400 px label at every zoom. Fix: the label is measured and shifted horizontally to
    stay at least 8 px inside the pane (`labelOverflowShift`, `relationship-edge.tsx`).
    Status: **Fixed — awaiting re-verification.**
  - **QA-007** · major · _A leading byte-order mark breaks parsing._ The tokenizer treated U+FEFF
    as part of the first statement, so a one-table file failed. Fix: the tokenizer skips a leading
    U+FEFF (offsets still index the original text; line numbers unchanged). Fixture
    `bom.postgres.sql`. Status: **Fixed — awaiting re-verification.**
  - **QA-008** · major · _A column with no type fails the whole table._ `readType` required a
    type token. Fix: a bare name before `,` / `)` / end is a typeless column (empty type), with one
    line-numbered warning per column (CREATE TABLE and ALTER TABLE ADD COLUMN). Fixture
    `typeless.sqlite.sql`. Status: **Fixed — awaiting re-verification.**
- **Fix commit:** `12697ac`. `npm run check` passes: 27 files / 195 tests (parser: 8 files / 67),
  build ✔. Pushed to `origin/main`.
- **Re-verification:** pending, see [handoffs/P2-fix-QA-006-008.md](handoffs/P2-fix-QA-006-008.md).

---

## 2026-11-16 — Cowork re-verification round 5 at 3806424: QA-006…008 fixed; QA-009

- **Handoff verified:** [handoffs/P2-fix-QA-006-008.md](handoffs/P2-fix-QA-006-008.md)
- **Source:** the user pasted a summary of Cowork's report into the Claude Code session on
  2026-11-16.
- **Result:**
  - **QA-006: Verified fixed.**
  - **QA-007: Verified fixed.**
  - **QA-008: Verified fixed.**
  - Per the user's instruction, P2-T01, P2-T02, P2-T03 and P1-T07 are now **Verified**.
- **New defect:**
  - **QA-009** · minor · _A U+FEFF in the middle of the input drops the next statement._
    `CREATE TABLE a (id int);\n\uFEFFCREATE TABLE b (id int);` imported only `a`, with
    "Skipped unsupported statement: CREATE TABLE b (id int)." Root cause: the QA-007 fix skipped
    only a leading U+FEFF, and the tokenizer counts non-ASCII characters as identifier characters,
    so `\uFEFFCREATE` became one word. Fix: U+FEFF is whitespace anywhere and never part of a word.
    Status: **Fixed — awaiting re-verification.**
- **UX decision (user):** Escape cleared a selected table but left a clicked edge label pinned.
  Escape now also unpins it, through a `clearSelection` action in `ui-store` (AC-P1-T08-13).
  Status: **Implemented — awaiting verification.**

---

## 2026-11-16 — QA-009 fix, Escape decision, P2-T04 (Prisma import)

- **QA-009 fix and Escape:** commit `57ce4f9` (pushed). `npm run check` passed: 27 files / 199 tests.
  Re-verification pending, see [handoffs/P2-T04.md](handoffs/P2-T04.md).
- **Escalation (P2-T04):** the planned `@mrleebo/prisma-ast@0.16.0` runs a filesystem config search
  (`lilconfig`) and imports Node's `os` at import time, so it doesn't bundle for the browser without
  shims; it's also all-or-nothing on syntax errors. The user chose a hand-written parser (ADR-013).
- **P2-T04:** own Prisma parser in `src/parsers/prisma`, fixtures in `tests/fixtures/prisma/`.
  `npm run check` passes: 31 files / 219 tests (parser: 12 files / 89). Size: 926 lines excluding
  tests, above the 350–450 estimated.
- **Self-check finding (Escape):** edges are created with `edgesFocusable={false}`, so after an
  edge click, keys come from `<body>` and never reached the workspace-root handler. The
  `57ce4f9` test fired Escape on the edge element and missed this. Fix: the Escape listener is
  now on `document`, and the test fires from `<body>`.
- **Cowork result:** Pending — not independently verified.

---

## 2026-11-16 — Cowork re-verification round 6 at c9c49a3: all pass; QA-010

- **Handoff verified:** [handoffs/P2-T04.md](handoffs/P2-T04.md)
- **Source:** the user pasted a summary of Cowork's report into the Claude Code session on
  2026-11-16: everything passes.
- **Verified:** QA-009 (fixed), AC-P1-T08-12, AC-P1-T08-13, AC-P2-T01-5, AC-P2-T04-1…6.
  P1-T08 → **Verified**; **Phase 1 → Verified with known issues** (list in ROADMAP);
  P2-T04 → **Verified**.
- **New defect:**
  - **QA-010** · minor · _A Prisma enum default ignores the value's `@map`._ `@default(AUTHOR)`
    with `AUTHOR @map("author")` gave the default `AUTHOR` instead of the stored `author`, unlike
    the enum's mapped values. Root cause: `columnDefault` printed the value name as written. Fix:
    for enum-typed fields, value names (also inside list defaults) are replaced by their stored
    `@map` values. Regression test in `src/parsers/prisma/fixtures.test.ts`.
    Status: **Fixed — awaiting re-verification.**

---

## 2026-11-16 — P2-T05 (Import dialog)

- **Plan:** approved with amendments (file card instead of a controlled textarea, BOM/binary
  handling, any extension, inline replace note, draft kept on Cancel, scrolling layout, detailed
  handoff).
- **Commit:** `f874d46`. `npm run check` passes: 34 files / 245 tests, build ✔.
- **Defects found by Claude Code while testing (not by Cowork):**
  - **QA-011** · major · _Format detection sampled only the first 200,000 characters._ A file whose
    DDL starts after a long header (here, 1.1 MB of comments) was reported as "doesn't look like
    SQL". Found by the "paste over 1 MB" dialog test. Fix: `detectFormat` checks the whole text
    (about 1 ms per MB; input is capped at 5 MB). Regression test in `detect-format.test.ts`,
    which fails on the old code. Status: **Fixed — awaiting verification.**
  - **QA-012** · minor · _The toolbar overflowed at phone width._ At 390 px, the right-hand toolbar
    group ended at 416 px, widening the page to 417 px and clipping the import dialog. Found in the
    headless phone screenshot; it existed before P2-T05 (Phase 1 checked narrow windows only at the
    900 px breakpoint). Fix: the "SchemaFlow" wordmark is hidden below `sm` (the logo stays).
    Status: **Fixed — awaiting verification.**
  - `loadSchema` appended validation issues that importers had already added (duplicates for
    broken schemas). Fixed with a regression test.
- **Cowork result:** Pending — not independently verified. See [handoffs/P2-T05.md](handoffs/P2-T05.md).

---

## 2026-11-16 — Cowork re-verification round 7 at 3a17db4: P2-T05 all pass; QA-013

- **Handoff verified:** [handoffs/P2-T05.md](handoffs/P2-T05.md)
- **Source:** the user pasted a summary of Cowork's report into the Claude Code session on
  2026-11-16.
- **Verified:** all 15 P2-T05 steps PASS. QA-010, QA-011 and QA-012 **Fixed**.
  AC-P2-T05-1…10, AC-P2-T01-6, AC-P1-T06-8 and AC-P2-T04-7 verified. P2-T05 → **Verified**.
- **New defect:**
  - **QA-013** · major · _Long runs of blank or whitespace-only lines freeze the main thread._
    `CREATE TABLE a (id int);` followed by 80,000 `\n` took about 4 s (Cowork) / 16.5 s (Claude
    Code's M1 under test) in `detectFormat`, and so in `parseSql`, which calls it. ~1 MB hung the
    tab.
    - Root cause: `PRISMA = /^\s*(model|…)…/m`. Under `/m`, `^\s*` matches line breaks and
      backtracks quadratically.
    - Fix: whitespace in line-anchored patterns is `[ \t]` (and `[ \t\r]` before `$`).
    - **Audit of every regex in `src/parsers`:**
      - `detect-format.ts`: `PRISMA` fixed, and `/;\s*$/m` tightened to `/;[ \t\r]*$/m`.
      - `sql/parse-default.ts`: the cast-suffix stripper had space in two adjacent repeating
        groups (`[\w ."[\]]+` then `\s*$`). A cast followed by 20,000 spaces took about 1 s, and
        50,000 spaces took 6.4 s. It is rewritten so words are separated by `\s+`, with no
        trailing `\s*` since the input is trimmed; now 1 ms.
      - The other patterns are anchored on literal words, bounded (64-char slice), sticky
        single-token matchers, or have disjoint classes. No change needed.
    - Related: the Prisma lexer emitted one token per line break, so 5 MB of `\n` would have been
      5 million token objects. Consecutive line breaks are now collapsed into one token.
    - Regression tests: `src/parsers/whitespace-performance.test.ts`. 5 MB of `\n` and ` \n`,
      every format, each run in under 1 s (measured 17–135 ms). The repro and cast tests fail on
      the old code (16.5 s, 6.4 s).
    - Timing note: the first full `npm run check` after adding the test failed two budgets
      (1.27 s for one 5 MB case; the SQL robustness suite took 2.5 s against 2 s). Both pass alone
      (102 ms, ~0.5 s), so this was contention between parallel test workers. The new test now
      takes the fastest of up to 3 runs, retrying only when over budget, so a quadratic regression
      still fails. Three consecutive full checks then passed (249 tests each). The robustness
      budget is unchanged.
    - Status: **Fixed — awaiting re-verification.**
- **Observation (no fix now):** Dagre takes over 90 s on a 2,000-table linear FK chain; realistic
  2,000-table schemas take about 3 s. Added to ROADMAP Phase 3 as a possible guard.

---

## 2026-11-16 — P2-T06 (Import issues panel)

- **Plan:** approved with amendments 0–9. On amendment 0, QA-013 was already fixed and pushed
  (`22dd5e5`, handoff `dbdabb5`).
- **Commits:** `627624e` (panel, issue links, stores, tests), `62ba31d` (fit after import,
  toolbar width). `npm run check` passes 3× in a row: 39 files / 272 tests, build ✔.
- **Found by Claude Code while verifying (not Cowork defects):**
  - **Fit after import.** An error import opens the panel in the same update, and the fit-view
    used the old canvas height, so tables were cut off under the panel (seen in the headless
    screenshot). Fixed with a 600 ms fit window after a new layout (ADR-015). User resizes after
    that keep the viewport; confirmed in headless Chrome with an identical transform after close
    and reopen.
  - **QA-012 regression.** The new Issues button widened the toolbar to 402 px at 390 px. The
    disabled Export placeholder is now hidden below `sm`, and the width is 390 px again (headless
    check).
  - **Panel layout fallback.** With pixel minimums the panel library fell back to 50/50 when it
    couldn't measure (jsdom), which would have opened the panel by itself. Fixed with percentage
    minimums and a sync hook that only accepts resizes from the user's separator interaction.
  - The jsdom `ResizeObserver` mock now returns full entries (`borderBoxSize`, realistic sizes),
    which `react-resizable-panels` needs.
- **Plan deviation:** the `issuesPanelDismissed` flag was not added; the rule "errors open,
  anything else leaves it as it is" gives the requested behaviour (ADR-015).
- **Cowork result:** Pending — not independently verified. See [handoffs/P2-T06.md](handoffs/P2-T06.md).
