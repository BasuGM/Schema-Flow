# Roadmap

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

- Layout is not persisted across reloads (P3-T01).
- Dagre layouts of large, shallow schemas are tall.
- A composite FK draws as one edge.
- Edges are not keyboard-focusable; labels need a pointer.
- Long-edge routes are dropped after dragging an end table and not recomputed when intermediate
  tables move; TB layout has no routes.
- Side-panel widths change after crossing the 900 px breakpoint.
- The Next.js dev badge overlaps the zoom controls (dev only).
- AC-P1-T09-6 (reduced motion) is covered by a unit test only.

## Phase 2 — Import, search, full inspector

| ID     | Task                                      | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P2-T01 | SQL tokenizer, splitter, format detection | **Verified** (Cowork, `3806424`, `c9c49a3`, `3a17db4`; QA-007/009/011 fixed). QA-013 (blank-line regex backtracking) fixed and verified (`83558da`). Internal, no UI. Dialect-aware tokenizer; `;`-safe splitter with line numbers; SQL/Prisma detection. Unit tests.                                                                                                                                                                            |
| P2-T02 | SQL → DraftSchema (PostgreSQL)            | **Verified** (Cowork, `3806424`). Internal, no UI. Hand-written tolerant parser (ADR-012): CREATE TABLE / ALTER TABLE / CREATE INDEX / CREATE TYPE ENUM; pg_dump support; grouped warnings; never executes SQL. Fixtures `ecommerce`, `pgdump`, `edge-cases`.                                                                                                                                                                                    |
| P2-T03 | SQL dialects: MySQL & SQLite              | **Verified** (Cowork, `3806424`; QA-008 fixed). Internal, no UI. Backticks, `AUTO_INCREMENT`, `KEY`/`UNIQUE KEY`, inline ENUM, `[id]`, `AUTOINCREMENT`, `WITHOUT ROWID`. Fixtures `shop.mysql`, `blog.sqlite`.                                                                                                                                                                                                                                   |
| P2-T04 | Prisma → DraftSchema                      | **Verified** (Cowork, `c9c49a3`; AC-P2-T04-1…6). QA-010 (enum default with `@map`) fixed and verified (`3a17db4`). Internal, no UI. Own tolerant parser (ADR-013, no dependency): models, `@map`/`@@map`/`@@schema`, relations with referential actions, `@id`/`@@id`, `@unique`/`@@unique`, `@@index`/`@@fulltext`, `@default`, enums, native `@db.*` types, `///` comments, implicit m:n `_AToB`. Fixtures `blog`, `shop.mysql`, `edge-cases`. |
| P2-T05 | Import dialog                             | **Verified** (Cowork, `3a17db4`: all 15 steps pass; AC-P2-T05-1…10). Paste / choose / drop (any extension), UTF-16 and binary detection, 5 MB cap, Format override, preview of counts and issues, import with errors allowed, draft kept on Cancel, lazy-loaded parsers (ADR-014). Handoff P2-T05.                                                                                                                                               |
| P2-T06 | Import issues panel                       | **Verified** (Cowork, `83558da`: steps 1–14 pass; AC-P2-T06-1…11). QA-014 (fit under the phone sheet) and QA-015 (tooltip after dialog close) fixed and verified (`ac91200`). Bottom panel (sheet below md) with severity filters, errors-first order, keyboard-toggled source excerpts, "Show table" links (issues now carry `tableId`), Copy with fallbacks, batches of 500; error imports open it (ADR-015).                                  |
| P2-T07 | Search                                    | **Verified** (Cowork, `ac91200`: steps 1–14 pass; AC-P2-T07-1…9). QA-016 (persistent live region) folded into P2-T08. Own palette (ADR-016, no cmdk): ⌘K / Ctrl+K / `/` or the toolbar button; tables and columns ranked by tier (exact → fuzzy), multi-word and dotted queries, highlights; choosing a column centers on its row and highlights it. Phone toolbar: Layout / Theme / Settings in a More menu.                                    |
| P2-T08 | Full inspector                            | Tabs: columns (defaults, comments, enum values), keys & indexes, constraints, relationships (clickable to navigate).                                                                                                                                                                                                                                                                                                                             |
| P2-T09 | Neighbourhood highlighting                | Dim unrelated tables when one is selected (`getNeighbors`, depth 1–2), via a `Set<TableId>` in ui-store.                                                                                                                                                                                                                                                                                                                                         |
| P2-T10 | Phase 2 hardening                         | Large real-world fixtures (e.g. 150+ table DDL), error-boundary paths, docs, final handoff.                                                                                                                                                                                                                                                                                                                                                      |

## Phase 3 — Persistence & export (summary)

P3-T01 Layout persistence (localStorage, keyed by fingerprint) · P3-T02 Per-table collapse modes
UI · P3-T03 Image export (PNG/SVG via `html-to-image`) · P3-T04 Schema generators (SQL DDL,
Prisma, Mermaid, JSON) · P3-T05 Export dialog · P3-T06 Session restore.

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
