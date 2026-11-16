# Roadmap

Status vocabulary (exact): `Not started | In progress | Self-checked | Awaiting Cowork verification |
Verified | Verified with known issues | Blocked`. `Verified*` is set only after a Cowork report has
been pasted into a session and logged in [QA_LOG.md](QA_LOG.md).

## Phase 1 — Foundation, model, interactive canvas

| ID     | Task                                  | Status                       | Notes                                                                                                                        |
| ------ | ------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| P1-T01 | Inspect & scaffold                    | Self-checked                 | Shell-verifiable; handoff P1-T01-T05                                                                                         |
| P1-T02 | Documentation & agent rules           | Self-checked                 | Docs only; handoff P1-T01-T05                                                                                                |
| P1-T03 | Domain model                          | Self-checked                 | Internal; unit tests in `src/domain`                                                                                         |
| P1-T04 | Sample schemas                        | Verified                     | Cowork 2026-11-13: counts, 200 & 1000-table samples pass (QA_LOG)                                                            |
| P1-T05 | Graph transform & layout              | Self-checked                 | Internal; unit tests in `src/graph`                                                                                          |
| P1-T06 | App shell                             | Verified with known issues   | Cowork 2026-11-13 pass; theme flash not frame-checked; panel widths after breakpoint differ (cosmetic)                       |
| P1-T07 | Custom node & edge                    | Verified                     | Cowork (relayed 2026-11-16): QA-001/002/004/005/006 fixed; selected-edge style                                               |
| P1-T08 | Canvas interactions & basic inspector | Awaiting Cowork verification | Earlier ACs verified; AC-P1-T08-12 (table selection clears edge) and AC-P1-T08-13 (Escape unpins edge) awaiting verification |
| P1-T09 | Hardening                             | Verified with known issues   | Cowork: T09-1/2/3/4/7 pass; T09-6 (reduced motion) not emulable by Cowork — unit test only                                   |

**Phase 1 overall:** Awaiting Cowork verification of AC-P1-T08-12 and AC-P1-T08-13 (P1-T08). Once those are
confirmed it becomes **Verified with known issues**. Remaining known issues: layout not persisted
across reloads; tall Dagre layouts for large shallow schemas; one edge per composite FK; edges not
keyboard-focusable (labels need a pointer); long-edge routes dropped after dragging an end table
and not recomputed when intermediate tables move; no routes in TB layout; side-panel widths change
after crossing the 900 px breakpoint; Next.js dev badge overlaps the zoom controls (dev only);
AC-P1-T09-6 (reduced motion) covered by a unit test only.

## Phase 2 — Import, search, full inspector

| ID     | Task                                      | Scope                                                                                                                                                                                                                                                         |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-T01 | SQL tokenizer, splitter, format detection | **Verified** (Cowork, `3806424`; QA-007 fixed). QA-009 (mid-file BOM) fix awaiting re-verification. Internal, no UI. Dialect-aware tokenizer; `;`-safe splitter with line numbers; SQL/Prisma detection. Unit tests.                                          |
| P2-T02 | SQL → DraftSchema (PostgreSQL)            | **Verified** (Cowork, `3806424`). Internal, no UI. Hand-written tolerant parser (ADR-012): CREATE TABLE / ALTER TABLE / CREATE INDEX / CREATE TYPE ENUM; pg_dump support; grouped warnings; never executes SQL. Fixtures `ecommerce`, `pgdump`, `edge-cases`. |
| P2-T03 | SQL dialects: MySQL & SQLite              | **Verified** (Cowork, `3806424`; QA-008 fixed). Internal, no UI. Backticks, `AUTO_INCREMENT`, `KEY`/`UNIQUE KEY`, inline ENUM, `[id]`, `AUTOINCREMENT`, `WITHOUT ROWID`. Fixtures `shop.mysql`, `blog.sqlite`.                                                |
| P2-T04 | Prisma → DraftSchema                      | Install `@mrleebo/prisma-ast`; models, `@map`/`@@map`, relations, `@id`/`@@id`, `@unique`/`@@unique`, `@@index`, `@default`, enums, implicit m:n `_AToB`.                                                                                                     |
| P2-T05 | Import dialog                             | Paste or drop a file, format/dialect detection, parse in a Web Worker if needed for large inputs, preview counts and issues, confirm to replace schema; enables the Import button.                                                                            |
| P2-T06 | Import issues panel                       | List warnings/errors with line numbers; link to statements.                                                                                                                                                                                                   |
| P2-T07 | Search                                    | Command palette (shadcn `command`) over tables and columns; jump to table.                                                                                                                                                                                    |
| P2-T08 | Full inspector                            | Tabs: columns (defaults, comments, enum values), keys & indexes, constraints, relationships (clickable to navigate).                                                                                                                                          |
| P2-T09 | Neighbourhood highlighting                | Dim unrelated tables when one is selected (`getNeighbors`, depth 1–2), via a `Set<TableId>` in ui-store.                                                                                                                                                      |
| P2-T10 | Phase 2 hardening                         | Large real-world fixtures (e.g. 150+ table DDL), error-boundary paths, docs, final handoff.                                                                                                                                                                   |

## Phase 3 — Persistence & export (summary)

P3-T01 Layout persistence (localStorage, keyed by fingerprint) · P3-T02 Per-table collapse modes
UI · P3-T03 Image export (PNG/SVG via `html-to-image`) · P3-T04 Schema generators (SQL DDL,
Prisma, Mermaid, JSON) · P3-T05 Export dialog · P3-T06 Session restore.

## Phase 4 — Analysis & polish (summary)

P4-T01 Schema health checks (missing PKs, unindexed FKs, orphan tables, naming) · P4-T02 Path
finder between tables · P4-T03 Subject-area grouping/filtering · P4-T04 Keyboard shortcuts &
command palette extensions · P4-T05 Performance & layout pass for 500+ tables (component packing) ·
P4-T06 Accessibility audit & docs.
