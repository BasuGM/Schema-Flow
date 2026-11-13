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
