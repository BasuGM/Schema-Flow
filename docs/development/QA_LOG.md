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
