# QA log

## Backlog

Every QA item that is not Verified. Status: open / fixed – pending QA / verified / deferred → target.
Update this table when an item changes; the dated log below stays append-only.

| ID     | Found in                      | Description                                                                    | Repro (one line)                                                                          | Severity      | Status              |
| ------ | ----------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------- | ------------------- |
| QA-018 | Cowork round 12 (P2-T10)      | GitLab layout ~242,000 px tall; Reset view at 0.05 shows a slice               | Import GitLab `structure.sql`, press Reset view                                           | Medium        | deferred → P3-T07   |
| QA-019 | Cowork round 12 (P2-T10)      | Real-input select/deselect cost; harness used synthetic clicks                 | `large-schema-perf.mjs` on `neighbourhood-2000`: select/deselect still above 40 ms budget | Medium        | verified (round 13) |
| QA-020 | Cowork round 12 (P2-T10)      | Pan at zoom 1 with many dimmed edges is slow                                   | Select a hub in a packed large layout, pan at zoom 1                                      | Low           | verified (round 13) |
| QA-021 | Cowork round 12 (P2-T10)      | Enter on "Resize issues panel" drops focus to body                             | Focus the issues divider, press Enter                                                     | Low           | verified (round 13) |
| QA-022 | Subagent smoke test (tooling) | ESLint scanned `out-qa/`, so `npm run check` failed                            | Build with QA hooks into `out-qa/`, run `npm run check`                                   | Low           | verified (round 13) |
| QA-023 | Cowork round 13 (P2-T10)      | Import counts lack thousands separators ("9982 columns")                       | Import GitLab `structure.sql`, read the preview counts                                    | Low           | verified (round 14) |
| QA-024 | Claude Code bug-bash (BB-P2)  | A file 1 byte over the limit reads "5.0 MB; the limit is 5.0 MB"               | Choose a 5 MiB + 1 byte file                                                              | Low           | verified (round 14) |
| QA-025 | Claude Code bug-bash (BB-P2)  | Close button of the issues panel drops focus to `body`                         | Open issues, focus Close, Enter                                                           | Medium (a11y) | verified (round 14) |
| QA-026 | Claude Code bug-bash (BB-P2)  | Inspector "Clear selection" button drops focus to `body`                       | Select a table, focus the X, Enter                                                        | Medium (a11y) | verified (round 14) |
| QA-027 | Cowork round 14 (BB-P2)       | Enter on inspector-relation-target shows the target but focus goes to `body`   | Open a table, Relations tab, focus a target, Enter                                        | Medium (a11y) | deferred → P3-T08   |
| QA-028 | Cowork round 14 (BB-P2)       | Enter on inspector-back returns to the previous table but focus goes to `body` | Follow a relation, focus Back, Enter                                                      | Medium (a11y) | deferred → P3-T08   |
| QA-029 | Cowork round 14 (BB-P2)       | Import dialog "Choose file…" label shows no focus ring (sr-only input focused) | Open Import, Tab to Choose file…                                                          | Medium (a11y) | deferred → P3-T08   |

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

- **Handoff:** [handoffs/archive/P1-final.md](handoffs/archive/P1-final.md)
- **Cowork result:** Pending — not independently verified.
- **Defects:** none recorded by Cowork. Issues found and fixed by Claude Code before handoff
  (self-found, not QA defects): workspace not filling the viewport with `h-dvh` in headless Chrome
  (switched to `h-full`); React Flow attribution background in dark mode; missing focus ring on
  non-selectable nodes; low-contrast nullable marker.
- **Fixes:** included in the Phase 1 UI commit.
- **Re-verification:** n/a

---

## 2026-11-13 — Cowork report: Phase 1 (P1-T04 browser checks, P1-T06…T09)

- **Handoff verified:** [handoffs/archive/P1-final.md](handoffs/archive/P1-final.md)
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
- **Re-verification:** pending, see [handoffs/archive/P1-fix-QA-001-003.md](handoffs/archive/P1-fix-QA-001-003.md).

---

## 2026-11-13 — Cowork re-verification: QA-001…003 (c879f58) + Phase 1 open items

- **Handoff verified:** [handoffs/archive/P1-fix-QA-001-003.md](handoffs/archive/P1-fix-QA-001-003.md)
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
- **Re-verification:** pending, see [handoffs/archive/P1-fix-QA-004.md](handoffs/archive/P1-fix-QA-004.md).

---

## 2026-11-13 — Cowork re-verification round 3: QA-004 (f382257) + production build

- **Handoff verified:** [handoffs/archive/P1-fix-QA-004.md](handoffs/archive/P1-fix-QA-004.md)
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
- **Re-verification:** pending, see [handoffs/archive/P1-QA-005.md](handoffs/archive/P1-QA-005.md).

---

## 2026-11-13 — P2-T01…T03 (SQL import core, pure logic)

- **Handoff:** [handoffs/archive/P2-T01-T03.md](handoffs/archive/P2-T01-T03.md)
- **Commit:** `2efa17c`. `npm run check` passes: 27 files / 185 tests (parser: 8 files / 61 tests).
- **Cowork result:** Pending — not independently verified.
- **Defects:** none recorded.

---

## 2026-11-16 — Cowork QA at ca08df3: QA-006, QA-007, QA-008

- **Source:** the user pasted a summary of Cowork's findings at `ca08df3` into the Claude Code
  session on 2026-11-16. The summary lists these three defects only; it does not report results
  for the steps of [handoffs/archive/P1-QA-005.md](handoffs/archive/P1-QA-005.md) or
  [handoffs/archive/P2-T01-T03.md](handoffs/archive/P2-T01-T03.md), so those ACs stay awaiting verification.
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
- **Re-verification:** pending, see [handoffs/archive/P2-fix-QA-006-008.md](handoffs/archive/P2-fix-QA-006-008.md).

---

## 2026-11-16 — Cowork re-verification round 5 at 3806424: QA-006…008 fixed; QA-009

- **Handoff verified:** [handoffs/archive/P2-fix-QA-006-008.md](handoffs/archive/P2-fix-QA-006-008.md)
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
  Re-verification pending, see [handoffs/archive/P2-T04.md](handoffs/archive/P2-T04.md).
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

- **Handoff verified:** [handoffs/archive/P2-T04.md](handoffs/archive/P2-T04.md)
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
- **Cowork result:** Pending — not independently verified. See [handoffs/archive/P2-T05.md](handoffs/archive/P2-T05.md).

---

## 2026-11-16 — Cowork re-verification round 7 at 3a17db4: P2-T05 all pass; QA-013

- **Handoff verified:** [handoffs/archive/P2-T05.md](handoffs/archive/P2-T05.md)
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
- **Cowork result:** Pending — not independently verified. See [handoffs/archive/P2-T06.md](handoffs/archive/P2-T06.md).

---

## 2026-11-16 — Cowork re-verification round 8 at 83558da: P2-T06 all pass; QA-014, QA-015

- **Handoffs verified:** [handoffs/archive/P2-T06.md](handoffs/archive/P2-T06.md),
  [handoffs/archive/P2-fix-QA-013.md](handoffs/archive/P2-fix-QA-013.md)
- **Source:** the user pasted a summary of Cowork's report into the Claude Code session on
  2026-11-16.
- **Verified:** QA-013 **Fixed** (AC-P2-T01-7). P2-T06 steps 1–14 all PASS (AC-P2-T06-1…11).
  P2-T06 → **Verified**.
- **Note from Cowork (kept as is):** with 0 issues and the panel open, the Issues button is
  enabled, so the panel can still be closed from the toolbar. AC-P2-T06-1 and the P2-T06 handoff
  said "disabled"; both are corrected, and the panel test now asserts it.
- **New defects:**
  - **QA-014** · minor · _On phones the sheet hides the freshly fitted diagram._ At 390×844,
    importing `edge-cases.postgres.sql` opened the sheet over a diagram fitted to the full canvas:
    every table was under the sheet and the visible top 40% was empty.
    - Root cause: the desktop re-fit reacts to canvas size changes, but the sheet overlays the
      canvas without resizing it, so nothing re-fitted.
    - Fix: while the sheet is open, every fit (after an import, and Reset view) uses padding
      `{ top: 5%, bottom: 65%, x: 6% }` of the canvas, so the diagram lands above the 60% sheet.
      Opening the sheet later by hand still keeps the viewport (AC-P2-T06-8).
    - Tests: `fitPadding` / `issuesSheetOpen` unit tests (jsdom can't lay out the canvas).
      Browser check by Claude Code in headless Chrome on the production build, 390×844 light and
      dark: table bottoms at 223–326 px, sheet top at 366 px; 1280×720 unchanged (tables above
      the docked panel); console empty. Not independent verification.
    - Status: **Fixed — awaiting re-verification.**
  - **QA-015** · trivial · _The Import tooltip stays visible after the dialog closes._
    - Root cause: Radix Dialog returns focus to its trigger on close, and Radix Tooltip opens on
      focus.
    - Fix: `useReturnFocusTooltip` (controlled tooltip) ignores the one focus that the dialog's
      `onCloseAutoFocus` announces. Focus still returns to the button (a11y), and hover or
      keyboard focus still opens the tooltip.
    - Test: `import-dialog.test.tsx` "does not show the Import tooltip when focus returns…"
      fails without the fix.
    - Status: **Fixed — awaiting re-verification.**
- **Checks:** `npm run check` green: 39 files / 276 tests, build ✔.
- **Re-verification handoff:** [handoffs/archive/P2-fix-QA-014-015.md](handoffs/archive/P2-fix-QA-014-015.md) (code `2d52d95`). Pending — not independently verified.

---

## 2026-11-16 — P2-T07 (Search)

- **Plan:** approved with amendments 1–8:
  - the fuzzy rule;
  - spaces and dots;
  - the default-schema rule;
  - centering on the row and showing hidden rows;
  - a reset on new schema;
  - IME, ⌘K and `/` edge cases;
  - a phone More menu;
  - exact handoff orders and a 2,000-table timing sample.
- **Commit:** `72dabd2`. `npm run check` passes 3× in a row: 44 files / 307 tests, build ✔.
- **Found by Claude Code while building it (not Cowork defects):**
  - **Timing tests measured contention.** With 44 test files in parallel on this 8 GB machine,
    the new search budgets (and once the existing 1 MB parser budget) failed even after 3
    attempts. They pass alone with wide margins. Files named `*performance.test.ts` now run in
    their own Vitest project after the others, one file at a time. Budgets unchanged.
  - **The 2,000-table fixture slowed the robustness suite** to 11.8 s, because it mutates every
    file in `tests/fixtures/sql/`. Moved to `tests/fixtures/large/`.
  - **jsdom focus:** in jsdom the resizable-panels pointer hit-testing (all rects are 0×0) moved
    focus to a separator when a toolbar button was clicked. The dialog tests open search with the
    keyboard instead. This doesn't happen in a browser: headless Chrome returns focus to the
    Search button.
  - **Synthetic sample cap:** `?sample=synthetic&tables=2000` is capped at 1,000 tables (8,606
    columns). For the requested 2,000-table timing, the handoff uses the generated fixture
    `tests/fixtures/large/search-2000.postgres.sql` (2,000 × 20, 1.16 MB) instead.
- **Plan deviation:** after choosing a result, focus returns to where it was (or the Search
  button), not to the table node. Focusing a React Flow node can auto-pan it into view, which
  would fight the centering on a row.
- **Known limitation:** collapse modes have no UI yet (P3-T02). The hidden-row reveal is covered
  by a test that sets a mode directly.
- **Cowork result:** Pending — not independently verified. See
  [handoffs/archive/P2-T07.md](handoffs/archive/P2-T07.md).

---

## 2026-11-16 — Cowork re-verification round 9 at ac91200: P2-T07 all pass; QA-016

- **Handoffs verified:** [handoffs/archive/P2-T07.md](handoffs/archive/P2-T07.md),
  [handoffs/archive/P2-fix-QA-014-015.md](handoffs/archive/P2-fix-QA-014-015.md)
- **Source:** the user pasted a summary of Cowork's report into the Claude Code session on
  2026-11-16.
- **Verified:** P2-T07 steps 1–14 all PASS (AC-P2-T07-1…9); P2-T07 → **Verified**. QA-014 and
  QA-015 **Fixed** (AC-P2-T06-12, AC-P1-T06-9).
- **Cowork's notes:**
  - Firefox was not available; Ctrl+K's `defaultPrevented` was confirmed in Chromium only.
  - The IME case was simulated through CDP.
  - The 2,000-table fixture took 50–160 ms per key on a slower machine, with no long tasks.
- **New defect:**
  - **QA-016** · trivial · a11y · _The search result count may not be announced on no match._
    - Cowork reports that with no match, `search-status` is replaced by a newly inserted
      `search-empty` live region, and live regions inserted with content already in them are often
      not announced.
    - Claude Code's reading of the code: it is one `<p aria-live>` whose `data-testid` switches.
      React keeps the same element, so it may not actually be re-inserted. This is not checked
      with a screen reader.
    - Either way, the live region and the visible message share an element whose identity
      depends on the state.
    - Fix, as requested: one always-mounted, screen-reader-only polite region whose text alone
      changes ("4 results" / "No tables or columns match …"), with the visible status and empty
      message kept separate.
    - Folded into P2-T08. Status: **Open — scheduled in P2-T08.**

---

## 2026-11-16 — P2-T08 (Full inspector) + QA-016

- **Plan:** approved with amendments 1–7: the AC-P1-T08-5 revision, pan-only-if-off-screen,
  100-row caps with a perf budget, tab rules, default labels per source, phone check, and handoff
  coverage.
- **Commit:** `7bec7a6`. `npm run check` passes 3× in a row: 48 files / 333 tests, build ✔.
- **Intentional AC revision (not a defect):** AC-P1-T08-5. The inspector hides the schema line
  when it is the source default (`public` on PostgreSQL, as in search), so the sample no longer
  shows "schema public". The column list moved into the Columns tab.
- **QA-016:** fixed. Search has one polite live region (`search-live`) whose text alone changes.
  The visible status and no-match message are separate, non-live elements. The test asserts the
  same DOM node across result → no-match → result; it fails on the old code (no such element).
  Status: **Fixed — awaiting re-verification.**
- **Found by Claude Code while building it (not Cowork defects):**
  - **Phones:** the inspector toggle at 390 px opened a 0 px panel. 240 px of inspector beside
    the 320 px minimum canvas can't fit. Below `md` the inspector is now an overlay sheet
    (ADR-017). Measured at 390×844: the sheet is 352 px, tabs aren't truncated, there's no
    horizontal scroll, and `toolbar-width.mjs` passes.
  - **jsdom and Radix Tabs:** inside the full workspace, the resizable-panels pointer
    hit-testing (all rects 0×0 in jsdom) cancels pointerdown, so Radix Tabs (which activate on
    mousedown) never saw clicks. The inspector tests render the inspector next to a real canvas
    instead. In the browser the tabs work (headless Chrome, real mouse events).
  - **Duplicate test id (pre-existing, not changed):** `react-resizable-panels` puts the panel
    id on its element as `data-testid`. In the full app, `[data-testid=inspector]` therefore
    matches the panel wrapper (first) and the inspector `aside`. Use
    `aside[aria-label=Inspector]` for the inspector itself.
- **Plan detail made explicit:** Relations navigation highlights the column at the other end but
  stays on the Relations tab (walking the schema), and Back restores the table and the tab you
  were on. FK-target links, key-section links and search switch to Columns (amendment 4).
- **Claude Code headless Chrome (production build; not independent verification):**
  - 1280×720, light and dark, at default (300 px) and minimum (240 px) width: tab labels not
    truncated.
  - orders → users via Relations (users selected, `users.id` highlighted, Relations kept), then
    Back (orders, Relations).
  - Clicking a visible column row keeps the viewport transform. In a 1,000-column table,
    clicking `c_90` (off-screen) pans, and then `c_91` (now visible) doesn't.
  - Selecting the 1,000-column table: 50–59 ms click → painted, with "Show 100 more".
  - Console empty.
- **Bundle:** +17.1 KB raw / +4.8 KB gzip initial JS. Parsers still lazy.
- **Cowork result:** Pending — not independently verified. See
  [handoffs/archive/P2-T08.md](handoffs/archive/P2-T08.md).

---

## 2026-11-16 — Cowork re-verification round 10 at 30260fe: P2-T08 all pass; QA-017

- **Handoff verified:** [handoffs/archive/P2-T08.md](handoffs/archive/P2-T08.md)
- **Source:** the user pasted a summary of Cowork's report into the Claude Code session on
  2026-11-16.
- **Verified:** P2-T08 steps 1–12 all PASS (AC-P2-T08-1…8 and the revised AC-P1-T08-5); P2-T08 →
  **Verified**. QA-016 **Fixed** (AC-P2-T07-10). Cowork accepted Claude Code's correction of the
  QA-016 diagnosis (one element whose `data-testid` switched, not a newly inserted region).
- **New defect:**
  - **QA-017** · minor · a11y · _A collapsed side panel stays focusable._
    - Repro: collapse the inspector (toolbar toggle, or drag the divider to 0 px), then Tab
      through the page.
    - Actual: focus reaches the invisible `inspector-close` button. All 13 inspector controls
      stay mounted, not hidden and not inert, so screen readers can still read the hidden panel.
    - Expected: a collapsed panel's content is `inert` (or unmounted) and focus never lands in it.
    - Claude Code's reading of the code: both side panels always render their content
      (`<TableList />`, `<Inspector />`) and collapsing only sets the panel to 0 px, so the left
      table list (P1-T06) has the same defect. Not yet checked in a browser.
    - Folded into P2-T09, with a jsdom test for `inert` on collapse. Status: **Open — scheduled
      in P2-T09.**

---

## 2026-11-16 — P2-T09 (Neighbourhood highlighting) + QA-017

- **Plan:** approved with amendments 1–6: depth as a setting, per-theme dim tokens, hover/focus
  brightening, a regression list of verified ACs, hub timing, and extra QA-017 checks.
- **Commit:** `9cb3155`. `npm run check` passes 3× in a row: 50 files / 350 tests, build ✔.
- **QA-017:** fixed. Side panel content is wrapped in `InertPanel` (`inert` while the panel is
  collapsed). Focus inside a collapsing panel moves to its toolbar toggle. Tests: both panels get
  `inert` on collapse and lose it on expand; `table-filter` / `inspector-close` have an `[inert]`
  ancestor while collapsed; focus moves to the toggle on collapse and on the ≤ 900 px
  auto-collapse. They fail on the old code (no wrapper). Status: **Fixed — awaiting
  re-verification.**
- **Found by Claude Code while building it (not Cowork defects):**
  - **Separator keyboard:** Enter on a resize separator toggles the panel _before_ it (the
    library's primary panel), so Enter on "Resize inspector" acts on the canvas and does nothing
    useful. Arrow keys (← on the inspector separator, → on the table-list separator) and Home/End
    do expand and collapse the side panels. Pre-existing library behaviour, unchanged; the
    handoff uses the arrow keys.
  - **Large-schema fades:** on the 2,000-table hub fixture, 150 ms opacity fades on ~820
    simultaneously flipping elements cut the frame rate while the canvas centred. Per amendment
    5, fades are dropped above 300 tables + relationships (`data-instant-dim`).
  - **Centring jank (pre-existing):** selecting from the list on that fixture centres from zoom
    0.05 to 1. One long frame of 160–600 ms happens with neighbourhood Off as well (baseline). With
    1 hop it measured 383–718 ms in 3 runs: dimmed (semi-transparent) tables cost more to paint
    while the view moves. Not addressed here; noted for P2-T10.
- **Claude Code headless Chrome (production build; not independent verification):**
  - 1280×720, light and dark: `orders` at 1 and 2 hops dims exactly the expected sets. Computed
    opacity: dimmed 0.3 / 0.4, edges 0.15 / 0.25, hovered dimmed table 0.7 / 0.75. Console empty.
  - QA-017: both panels collapsed → 60 Tab stops never entered a panel. ← on "Resize inspector"
    re-expanded it and Tab landed on `inspector-close`. → on "Resize table list" re-expanded it and
    Shift+Tab landed in the list. With focus on `inspector-close`, narrowing to 800 px moved
    focus to `toolbar-toggle-right`.
  - Hub timing (`tests/fixtures/large/neighbourhood-2000.postgres.sql`, 149 nodes / 674 edges
    rendered): clicking `hub` on the canvas paints in 67–74 ms at 1 hop and 50 ms at 2 hops, vs
    52 ms with Off, then ~60 fps.
  - `toolbar-width.mjs` PASS (light and dark).
- **Bundle:** +2.4 KB raw / +1.6 KB gzip initial JS.
- **Cowork result:** Pending — not independently verified. See
  [handoffs/archive/P2-T09.md](handoffs/archive/P2-T09.md).

---

## 2026-11-16 — Cowork re-verification round 11 at c82ba77: P2-T09 all pass; QA-017 fixed

- **Handoff verified:** [handoffs/archive/P2-T09.md](handoffs/archive/P2-T09.md)
- **Source:** the user pasted a summary of Cowork's report into the Claude Code session on
  2026-11-16.
- **Verified:** P2-T09 steps 1–14 all PASS (AC-P2-T09-1…6); P2-T09 → **Verified**. QA-017
  **Fixed** (AC-P1-T06-10), checked via the toolbar toggle, drag to 0 px, arrow keys, Home and
  End, keyboard re-expand, and the narrow-viewport focus move.
- **Observation (not a defect; pre-existing, not caused by dimming):** on
  `tests/fixtures/large/neighbourhood-2000.postgres.sql`, switching the selection away from `hub`
  (499 edges) or deselecting takes 210–350 ms on Cowork's machine (about 2–3× slower than the
  M1), the same with highlighting Off; selecting `hub` takes 45–90 ms. Cowork's hypothesis: the
  edge-state (default/highlighted) re-renders of the hub's edges. Panning with `hub` selected ran
  at about 32 fps. To be profiled in P2-T10 together with the long centring frame.
- **New defects:** none.

---

## 2026-11-16 — P2-T10 (Phase 2 hardening) + Phase 2 final handoff

- **Plan:** approved with amendments 1–17 (source-derived fixture counts, partition/schema ADR,
  byte-for-byte generators, busy state, fuzz time limits, boundary behaviour, QA hooks, phone
  sheet interactions, edge-state selector, centring ADR, raw harness output, Enter details,
  per-commit handoff). Fixture source chosen by the user: vendor + generate.
- **Commits:** `2be3530` (fixtures, parser, names, busy state), `70bdf99` (error boundaries, QA
  hooks), `9a53579` (phone list sheet, Enter on separators), `418c542` (frame costs), `5a92986`
  (busy label, test warm-up). `npm run check` passes 3× in a row: 58 files / 399 tests, build ✔.
- **Found by Claude Code with the real fixtures (not Cowork defects), fixed with regression
  tests:**
  - GitLab `structure.sql`: 434 partitions drawn as tables and 2,536 warnings (1,871 `ALTER INDEX
… ATTACH PARTITION`). Partitions are now folded into their parent (ADR-019): 992 tables,
    1,720 relationships, 140 warnings.
  - Sakila: MySQL `DELIMITER` blocks were not supported, so procedure bodies split into stray
    statements and a `CREATE TEMPORARY TABLE` inside a procedure became a 17th table.
    `DELIMITER` now switches the terminator. `/*!50705 … */` executable comments were dropped, so
    `address.location` was missing; they are now read as code (statements entirely inside them,
    mysqldump's session plumbing, are skipped silently, so `sql/shop.mysql.sql` keeps "No
    issues"). `CREATE DEFINER=… PROCEDURE|VIEW` was reported as "CREATE DEFINER"; now classified
    by object kind.
  - Same-named tables in two schemas looked identical on the canvas and in the list and shared a
    test ID; non-default schemas now show `schema.table` (ADR-019).
  - The 2.5 s GitLab layout ran inside the Import click with no feedback; a busy state now paints
    first from 150 tables.
  - A test flake: the first parse in the import-dialog tests could exceed `waitFor`'s 1 s while the
    lazy parser chunk was transformed under load; the tests now load the parsers up front.
- **Error boundaries:** six regions plus `app/error.tsx` and `global-error.tsx` (ADR-020), checked
  in jsdom and in a QA-hook production build in headless Chrome; the normal build has no hook
  code.
- **Phone table list (ROADMAP note from P2-T09):** fixed — opens as a sheet instead of a 0 px
  panel (ADR-021). Enter on separators now toggles their own panel.
- **Frame costs (Cowork's P2-T09 observation):** measured with the committed harness on the M1.
  Panning at the fitted zoom 27–34 → 57–59 fps; worst centring frame 230–351 → 52–81 ms; hub
  select / deselect first frame unchanged at 52–68 ms (Off 37–54 ms), **over the 40 ms budget**;
  reason and evidence in ADR-022. Cowork's hypothesis (edge-state re-renders) was checked: about
  3 ms of the frame.
- **Claude Code headless Chrome (production build; not independent verification):** see
  [handoffs/P2-final.md](handoffs/P2-final.md) — region errors, app/root errors, Enter widths,
  phone sheet in light and dark, widening past md, `toolbar-width.mjs` PASS, perf before/after.
- **Bundle:** +12,494 B raw / +4,897 B gzip initial JS (1,147,345 / 362,838).
- **Cowork result:** Pending — not independently verified. See
  [handoffs/P2-final.md](handoffs/P2-final.md).

## 2026-11-19 — Cowork round 12: P2-T10 at `40f0d16` (report pasted by the user)

- **Cowork result (pasted):** steps 1–5 PASS (except the issues divider), step 8 functional
  checks, 9 and 10–17 PASS. Fixture counts independently recounted (own statement split): all four
  match, 0 dangling relationships; fuzz 1,532 parses, 0 throws, worst 322 ms. Busy label painted at
  100 ms. Phone sheet light/dark, one-sheet rule, 700→820 docking, `toolbar-width` PASS; Enter on
  the inspector and table-list dividers PASS. Steps 6–7 **NOT TESTED** (Cowork cannot run
  `npm install`; asked for a prebuilt `out-qa/`). Cowork harness (cloud, 1 hop vs Off): select hub
  94 vs 86 ms, deselect 89 vs 53, hub→other 82 vs 55, centring 107 vs 101, pan fitted with hub
  24–28 vs 27–30 fps. Recommendation: not closed yet.
- **QA-018 (Medium) — GitLab layout ~230,000 px tall; Reset view at 0.05 shows a slice.**
  Measured: 3,904 × 242,359 px (a 709-table component with a 248-table rank, plus 131 isolated
  tables). A packing pass was built and tested (24,696 × 15,892 px, small schemas unchanged), but
  it puts 1,790–2,000 tables in the fitted view of `neighbourhood-2000`: select / deselect
  150–330 ms and panning 10–17 fps on the M1. **Deferred to P3-T07 by the user's decision**, to
  land with a cheap overview renderer (ADR-023). Status: Open (deferred).
- **QA-019 (Medium) — real-input select/deselect cost; the harness used synthetic clicks.**
  Fixed in `9168b2a`: the harness clicks through CDP (pressed/released) and reports pointerdown →
  next frame and the longest task. Profiled: React Flow's pointerdown path is ~15–20 ms of JS; the
  rest is rendering, proportional to elements on screen. Rows now carry handles only where edges
  attach, and zoomed-out large schemas render skeleton rows and marker-less edges (fitted view
  11,854 → 4,189 elements). M1, real input, 1 hop: select 60–95 → 34–53 ms, deselect 59–77 → 58–66
  ms (one 142 ms outlier in 6 runs), hub→other 50–53 → 31–74 ms. The 40 ms budget is still not
  met (ADR-023). Status: Fixed (budget not met) — pending re-verification.
- **QA-020 (Low) — pan at zoom 1 with many dimmed edges is slow.** Fixed in `9168b2a`: edges dim
  with stroke/fill opacity instead of group opacity, and dim transitions are off while the
  viewport moves. On the M1 the default layout already ran at 60 fps; in the packed test layout
  (434 dimmed long edges in view) 6 → 60 fps. Revision to AC-P2-T09-3 noted in VERIFICATION.
  Status: Fixed — pending re-verification.
- **QA-021 (Low, a11y) — Enter on "Resize issues panel" drops focus to body.** Fixed in
  `9168b2a`: Enter closes the panel and moves focus to `toolbar-issues`, where Enter reopens it at
  its previous size (the separator is hidden with the panel, so focus can't stay on it).
  Regression test in `phone-sheets.test.tsx`. Status: Fixed — pending re-verification.
- **Steps 6–7:** QA-hook build of `9168b2a` placed in `out-qa/` (git-ignored); `out/` rebuilt as
  the normal build. The hook code is in one `out-qa` chunk and in none of `out/`.
- **Checks:** `npm run check` exit 0 (58 files / 400 tests, build ✔).
- **Cowork result:** Pending — not independently verified. See
  [handoffs/P2-T10-r12.md](handoffs/P2-T10-r12.md).

## 2026-11-19 — Subagent smoke test: QA-022

- **QA-022 (Low, tooling) — ESLint scanned `out-qa/`, so `npm run check` failed while it existed.**
  Found by the check-runner smoke test (39 errors, 3,173 warnings from minified QA-hook chunks).
  Fixed: `out-qa/**` added to the ESLint ignores, `out-qa` to `.prettierignore`, and `out-qa` to
  the tsconfig `exclude`. Vitest only includes `src/**`, so it needed no change. Status: Fixed.

## 2026-11-19 — E2E-01: Playwright e2e suite (tooling)

- **E2E-01 — Pending — not independently verified.** The suite was run only by Claude Code
  (`npm run e2e`, `E2E_QA_HOOKS=1` against `out-qa/`, and `npm run check` with e2e excluded). No
  Cowork or human run. See VERIFICATION AC-E2E-01-1…4.
- **Note:** `python -m http.server` resets connections when browsers run in parallel, so the e2e
  suite defaults to 1 worker.

## 2026-11-19 — Cowork round 13 at `3fdd4c9`: P2-T10 and E2E-01 verified; QA-023

- **Cowork result (pasted report):** e2e 120 passed / 0 failed / 20 skipped against `out/`;
  error-regions 19 / 0 / 1 against `out-qa/` (`E2E_QA_HOOKS=1`).
  - **Verified:** QA-019, QA-020, QA-021, QA-022; P2-T10 steps 6–7 (AC-P2-T10-3/4, via
    `error-regions.spec`); zoomed-out rendering (revised AC-P2-T10-7); E2E-01.
  - Cowork's real-input harness (cloud, 1 hop): deselect 63–66 ms, hub→other 38–58 ms (was
    215–400), pan at zoom 1 with `t_1500` selected 60 fps (was 28–30). Dimmed edge: group opacity 1,
    stroke/fill-opacity 0.15 light / 0.25 dark.
  - **Phase 2 closed as "Verified with known issues":** QA-018 → P3-T07, hub select/deselect over
    40 ms, parsing on the main thread, skipped DDL kinds.
- **QA-023 (Low) — import counts lack thousands separators ("9982 columns").** Fixed: the count
  formatter uses `toLocaleString("en-US")` ("9,982 columns · 1,720 relationships", and in the
  Import button label). Unit test `import-preview.test.ts`; `import.spec.ts` strings updated.
  Status: Fixed — pending re-verification.
- **E2E-01 follow-up (Cowork request):** two specs added: QA-020 dimmed-edge stroke/fill opacity
  and group opacity 1 in both themes (`neighbourhood.spec.ts`); zoomed-out rendering
  (`zoomed-out.spec.ts`: `data-zoomed-out`, `skeleton-rows`, no `column-*`, `edge-hit-*` or
  markers; zooming in restores detail; the sample is never an overview).
- **Flake fixed:** `real-robustness.test.ts` per-parse limit 2 s → 5 s (hang detector); one run
  under load exceeded 2 s on a 0.4 s parse.
- **Checks:** `npm run check` exit 0; `npm run e2e` on a served normal build: 123 passed, 0 failed,
  20 skipped.

## 2026-11-19 — BB-P2: Phase 2 bug-bash (Claude Code, exploratory)

- **Found by Claude Code, not independently verified.** Charter and per-row results:
  [plans/bug-bash-p2.md](plans/bug-bash-p2.md). Rows 1–3 and 6 were explored by script; rows 4, 5
  and 7 are automated in `tests/e2e/bug-bash.spec.ts` (AC-BB-P2-1…3).
- **QA-024 (Low) — limit message.** A file a few bytes over 5 MiB read "This file is 5.0 MB; the
  limit is 5.0 MB." Now shows exact bytes when rounding hides the difference. Unit test.
- **QA-025 (Medium, a11y) — issues Close button.** Closing the docked issues panel with its Close
  button left focus on `body`. A shared `closeIssuesPanel()` (also used by the divider's Enter,
  QA-021) moves focus to the toolbar's Issues button. Unit test and e2e.
- **QA-026 (Medium, a11y) — inspector X.** "Clear selection" removed itself and dropped focus to
  `body`. Focus now moves to the inspector's empty message (`tabIndex` −1). Unit test and e2e.
- **Not defects, recorded:** a cancelled import keeps its draft (by design); an open issues panel
  stays open after a clean import and shows its empty state (documented in `apply-import.ts`).
- **Test flake fixed:** the fuzz test's per-parse limit now measures CPU time (`process.cpuUsage`),
  because a loaded machine (parallel workers) made a 0.4 s parse take over 5 s of wall time.
- **Backlog after triage:** 5 open (QA-018 deferred; QA-023…026 pending re-verification), so no
  bug-fix task is added before P3-T01.
- **Checks:** `npm run check` exit 0 (59 files / 405 tests); `npm run e2e` on a served normal
  build: 137 passed, 0 failed, 20 skipped; `toolbar-width.mjs` PASS light and dark.

## 2026-11-19 — Cowork round 14 at `021f867`: BB-P2 Verified with known issues

- **Found by: Cowork round 14** (report pasted by the user). `npm run e2e` on `out/`: 137 passed,
  0 failed, 20 skipped. QA-023, QA-024, QA-025 and QA-026 verified; row 1 (import × state) clean;
  console empty. BB-P2 is **Verified with known issues**.
- **User decision: do not fix now.** All three new defects are deferred to P3-T08 (a bug-fix task
  placed before the Phase 3 bug-bash; fold earlier if a P3 task touches the inspector or the
  import dialog).
- **QA-027 (Medium, a11y)** — Enter or click on `inspector-relation-target` shows the target but
  focus goes to `body`. Likely the `key={table.id}` remount of the Relations tab. Expected: focus
  stays in the inspector with a visible ring.
- **QA-028 (Medium, a11y)** — Enter on `inspector-back` returns to the previous table but focus
  goes to `body`. Expected: focus on a stable inspector element.
- **QA-029 (Medium, a11y, Phase 1)** — Import dialog "Choose file…": Tab focuses the sr-only
  `input[type=file]` but its `<label>` shows no focus ring. Expected: a ring via `:focus-within`.
- **Spec gap (P3-T08):** AC-BB-P2-3 asserts only "not `body`" and the inspector case sits behind
  `if (isVisible)`. Assert exact focus targets and make it unconditional.

## 2026-11-19 — Cowork round 15 at `4ef042a`: P3-T01 Verified

- **Found by: Cowork round 15** (report pasted by the user). `npm run e2e` on `out/`: 144 passed,
  0 failed, 20 skipped. Drag → reload (including 50 ms after a drag), re-import restore, Layout
  reset, 2-hop depth, corrupt JSON/index, NaN positions, depth 7, throwing `localStorage` getter
  and `setItem` quota, 390 px: all pass; console clean. No new defects. P3-T01 is **Verified**.
- **Note (no action):** positions are saved rounded to whole px (≤0.5 px shift on reload).
- **Not tested:** `out-qa` error regions (not rebuilt).
