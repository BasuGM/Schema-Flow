# Roadmap

## Now

- **Task:** P3-T03 (image export): Awaiting Cowork verification (self-checked; ADR-027). P3-T02 Verified with known issues (Cowork round 16); P3-T01 Verified (round 15). HEAD: see the latest commit.
- **Progress:** Phase 1 and Phase 2 Verified with known issues (P2-T10 and E2E-01 Verified by Cowork round 13).
- **Next:** P3-T04 (schema generators: SQL DDL, Prisma, Mermaid, JSON; plan first). P3-T08 (bug-fix: QA-027…029 and the AC-BB-P2-3 spec gap) comes before the Phase 3 bug-bash.
- **Backlog:** 4 open: QA-018 deferred → P3-T07; QA-027…029 deferred → P3-T08 ([QA_LOG Backlog](QA_LOG.md#backlog)).
- **Blockers:** none.
- **Latest handoff:** [handoffs/P3-T03.md](handoffs/P3-T03.md).

Status vocabulary (exact): `Not started | In progress | Self-checked | Awaiting Cowork verification |
Verified | Verified with known issues | Blocked`. `Verified*` is set only after a Cowork report has
been pasted into a session and logged in [QA_LOG.md](QA_LOG.md).

## Phase 1 — Foundation, model, interactive canvas

| ID     | Task                                  | Status                     | Notes                                                                                                                        |
| ------ | ------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| P1-T01 | Inspect & scaffold                    | Self-checked               | Shell-verifiable; handoff P1-T01-T05                                                                                         |
| P1-T02 | Documentation & agent rules           | Self-checked               | Docs only; handoff P1-T01-T05                                                                                                |
| P1-T03 | Domain model                          | Self-checked               | Internal; unit tests in `src/domain`                                                                                         |
| P1-T04 | Sample schemas                        | Verified                   | Cowork 2026-11-13: counts, 200 & 1000-table samples pass (QA_LOG)                                                            |
| P1-T05 | Graph transform & layout              | Self-checked               | Internal; unit tests in `src/graph`                                                                                          |
| P1-T06 | App shell                             | Verified with known issues | Cowork 2026-11-13 pass; theme flash not frame-checked; panel widths after breakpoint differ (cosmetic)                       |
| P1-T07 | Custom node & edge                    | Verified                   | Cowork (relayed 2026-11-16): QA-001/002/004/005/006 fixed; selected-edge style                                               |
| P1-T08 | Canvas interactions & basic inspector | Verified                   | Cowork `c9c49a3` (relayed 2026-11-16): AC-P1-T08-12 (table selection clears edge) and AC-P1-T08-13 (Escape unpins edge) pass |
| P1-T09 | Hardening                             | Verified with known issues | Cowork: T09-1/2/3/4/7 pass; T09-6 (reduced motion) not emulable by Cowork — unit test only                                   |

**Phase 1 overall: Verified with known issues** (Cowork, `c9c49a3`, relayed 2026-11-16). Known
issues accepted at close-out:

- Dagre layouts of large, shallow schemas are tall.
- A composite FK draws as one edge.
- Edges are not keyboard-focusable; labels need a pointer.
- Long-edge routes are dropped after dragging an end table and not recomputed when intermediate
  tables move; TB layout has no routes.
- Side-panel widths change after crossing the 900 px breakpoint.
- The Next.js dev badge overlaps the zoom controls (dev only).
- AC-P1-T09-6 (reduced motion) is covered by a unit test only.

## Phase 2 — Import, search, full inspector

| ID     | Task                                      | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-T01 | SQL tokenizer, splitter, format detection | **Verified** (Cowork, `3806424`, `c9c49a3`, `3a17db4`; QA-007/009/011 fixed). QA-013 (blank-line regex backtracking) fixed and verified (`83558da`). Internal, no UI. Dialect-aware tokenizer; `;`-safe splitter with line numbers; SQL/Prisma detection. Unit tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| P2-T02 | SQL → DraftSchema (PostgreSQL)            | **Verified** (Cowork, `3806424`). Internal, no UI. Hand-written tolerant parser (ADR-012): CREATE TABLE / ALTER TABLE / CREATE INDEX / CREATE TYPE ENUM; pg_dump support; grouped warnings; never executes SQL. Fixtures `ecommerce`, `pgdump`, `edge-cases`.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| P2-T03 | SQL dialects: MySQL & SQLite              | **Verified** (Cowork, `3806424`; QA-008 fixed). Internal, no UI. Backticks, `AUTO_INCREMENT`, `KEY`/`UNIQUE KEY`, inline ENUM, `[id]`, `AUTOINCREMENT`, `WITHOUT ROWID`. Fixtures `shop.mysql`, `blog.sqlite`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| P2-T04 | Prisma → DraftSchema                      | **Verified** (Cowork, `c9c49a3`; AC-P2-T04-1…6). QA-010 (enum default with `@map`) fixed and verified (`3a17db4`). Internal, no UI. Own tolerant parser (ADR-013, no dependency): models, `@map`/`@@map`/`@@schema`, relations with referential actions, `@id`/`@@id`, `@unique`/`@@unique`, `@@index`/`@@fulltext`, `@default`, enums, native `@db.*` types, `///` comments, implicit m:n `_AToB`. Fixtures `blog`, `shop.mysql`, `edge-cases`.                                                                                                                                                                                                                                                                       |
| P2-T05 | Import dialog                             | **Verified** (Cowork, `3a17db4`: all 15 steps pass; AC-P2-T05-1…10). Paste / choose / drop (any extension), UTF-16 and binary detection, 5 MB cap, Format override, preview of counts and issues, import with errors allowed, draft kept on Cancel, lazy-loaded parsers (ADR-014). Handoff P2-T05.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| P2-T06 | Import issues panel                       | **Verified** (Cowork, `83558da`: steps 1–14 pass; AC-P2-T06-1…11). QA-014 (fit under the phone sheet) and QA-015 (tooltip after dialog close) fixed and verified (`ac91200`). Bottom panel (sheet below md) with severity filters, errors-first order, keyboard-toggled source excerpts, "Show table" links (issues now carry `tableId`), Copy with fallbacks, batches of 500; error imports open it (ADR-015).                                                                                                                                                                                                                                                                                                        |
| P2-T07 | Search                                    | **Verified** (Cowork, `ac91200`: steps 1–14 pass; AC-P2-T07-1…9). QA-016 (persistent live region) folded into P2-T08. Own palette (ADR-016, no cmdk): ⌘K / Ctrl+K / `/` or the toolbar button; tables and columns ranked by tier (exact → fuzzy), multi-word and dotted queries, highlights; choosing a column centers on its row and highlights it. Phone toolbar: Layout / Theme / Settings in a More menu.                                                                                                                                                                                                                                                                                                          |
| P2-T08 | Full inspector                            | **Verified** (Cowork, `30260fe`: steps 1–12 pass; AC-P2-T08-1…8, revised AC-P1-T08-5; QA-016 fixed). Columns · Keys · Relations tabs (ADR-017): defaults, comments, enum values, FK links; PK/unique/indexes/checks; references and referenced-by with navigation and one-step Back; 100-row caps; phone overlay sheet. QA-017 (collapsed panels focusable) folded into P2-T09.                                                                                                                                                                                                                                                                                                                                        |
| P2-T09 | Neighbourhood highlighting                | **Verified** (Cowork, `c82ba77`: steps 1–14 pass; AC-P2-T09-1…6; QA-017 fixed, AC-P1-T06-10). Selecting a table dims every table more than 1 or 2 hops away (setting: Off / 1 / 2, default 1; ADR-018), with per-theme dim tokens. Collapsed side panels are inert.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| P2-T10 | Phase 2 hardening                         | **Verified with known issues** (Cowork round 13 at `3fdd4c9`; QA-019…022 verified, QA-018 → P3-T07; `2be3530`, `70bdf99`, `9a53579`, `418c542`, `5a92986` + docs; round 12 fixes `9168b2a`: QA-019, QA-020, QA-021; QA-018 deferred to P3-T07). Real-world fixtures (GitLab `structure.sql`, Sakila, generated mysqldump-180 and Prisma-200) with source-derived counts; partitions folded, MySQL `DELIMITER` and `/*! */`, qualified table names (ADR-019); import busy state; error boundaries per region, app/global error pages and build-time QA hooks (ADR-020); phone table-list sheet and Enter on separators (ADR-021); large-schema frame costs (ADR-022: two of four budgets met). README and Phase 2 docs. |
| E2E-01 | Playwright e2e suite (tooling)            | **Verified** (Cowork round 13; two specs added after: QA-020 dim opacity, zoomed-out rendering; ADR-024; plan [plans/e2e-suite.md](plans/e2e-suite.md); AC-E2E-01-1…4). Specs in `tests/e2e`; `npm run e2e` against a served build, plus error-region specs with `E2E_QA_HOOKS=1` against `out-qa/`.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| BB-P2  | Phase 2 bug-bash (exploratory)            | **Verified with known issues** (Cowork round 14 at `021f867`; QA-023…026 verified, QA-027…029 → P3-T08; plan [plans/bug-bash-p2.md](plans/bug-bash-p2.md); AC-BB-P2-1…4). 7 charter rows; QA-024…026 found and fixed; `tests/e2e/bug-bash.spec.ts` (console, viewport × theme, focus).                                                                                                                                                                                                                                                                                                                                                                                                                                 |

**Phase 2 overall: Verified with known issues** (Cowork round 13; final handoff
[handoffs/P2-final.md](handoffs/P2-final.md)). Accepted known issues:

- Parsing and layout run on the main thread: GitLab's 992 tables take ≈ 3 s behind a busy state;
  a 2,000-table linear FK chain can take over 90 s (possible P3 guard below).
- Hub select / deselect on a 2,000-table schema: 34–66 ms from pointerdown to the next frame on an
  M1 with real input (40 ms budget not met; ADR-022, ADR-023).
- QA-018: very large, shallow schemas lay out as tall columns; Reset view shows a slice
  (P3-T07).
- Views, functions, triggers, expression indexes and EXCLUDE constraints are skipped (reported).

## Phase 3 — Persistence & export (summary)

P3-T01 Layout persistence (localStorage, keyed by fingerprint) · P3-T02 Per-table collapse modes
UI · P3-T03 Image export (PNG/SVG, own SVG renderer, ADR-027) · P3-T04 Schema generators (SQL DDL,
Prisma, Mermaid, JSON) · P3-T05 Export dialog · P3-T06 Session restore · P3-T07 Packed layout for
large, shallow schemas together with a cheap overview renderer (QA-018; a packed 2,000-table
overview drawn as DOM costs 150–330 ms per click and 10–17 fps panning, ADR-023) · P3-T08
Bug-fix task before the Phase 3 bug-bash: QA-027 and QA-028 (inspector focus after relation
navigation and Back), QA-029 (import file label focus ring), and the AC-BB-P2-3 spec gap (assert exact
focus targets, unconditionally). Fold into an earlier P3 task if it touches the inspector or import dialog.

**P3-T01 Layout persistence: Verified** (Cowork round 15 at `4ef042a`, no new defects; ADR-025;
AC-P3-T01-1…6). Per-fingerprint localStorage keys, LRU 20, debounced saves, safe when storage is
blocked; neighbourhood depth saved; the viewport still fits on load (restore: P3-T06). Note (no action): positions are saved rounded to whole px (≤0.5 px shift on reload).

**P3-T02 Collapse modes UI: Verified with known issues** (Cowork round 16 at `bef3380`, no new defects; ADR-026; AC-P3-T02-1…6). Inspector
control, node-header toggle, "All tables" actions; modes persist per fingerprint.

**P3-T03 Image export: Awaiting Cowork verification** (ADR-027; AC-P3-T03-1…6). Settings / More → "Export image…": PNG or SVG of the whole diagram, Current / Light / Dark, PNG 1× / 2× (lowered to browser canvas limits). Drawn by our own SVG renderer, not `html-to-image` (the canvas virtualizes large schemas).

**Possible P3 guard: layout cost (observation from Cowork, 2026-11-16; not scheduled).** Dagre
took **over 90 s** on a 2,000-table linear FK chain (each table referencing the previous one),
while realistic 2,000-table schemas lay out in about 3 s. Import doesn't guard against this yet.
Options: warn before laying out above N tables or above a large chain depth (longest FK path),
offer a cheaper layout (grid/components) for such schemas, or run layout off the main thread.

## Phase 4 — Analysis & polish (summary)

P4-T01 Schema health checks (missing PKs, unindexed FKs, orphan tables, naming) · P4-T02 Path
finder between tables · P4-T03 Subject-area grouping/filtering · P4-T04 Keyboard shortcuts &
command palette extensions · P4-T05 Performance & layout pass for 500+ tables (component packing) ·
P4-T06 Accessibility audit & docs.
