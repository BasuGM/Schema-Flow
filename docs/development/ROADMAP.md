# Roadmap

Status vocabulary (exact): `Not started | In progress | Self-checked | Awaiting Cowork verification |
Verified | Verified with known issues | Blocked`. `Verified*` is set only after a Cowork report has
been pasted into a session and logged in [QA_LOG.md](QA_LOG.md).

## Phase 1 — Foundation, model, interactive canvas

| ID     | Task                                  | Status                       | Notes                                              |
| ------ | ------------------------------------- | ---------------------------- | -------------------------------------------------- |
| P1-T01 | Inspect & scaffold                    | Self-checked                 | Shell-verifiable; handoff P1-T01-T05               |
| P1-T02 | Documentation & agent rules           | Self-checked                 | Docs only; handoff P1-T01-T05                      |
| P1-T03 | Domain model                          | Self-checked                 | Internal; unit tests in `src/domain`               |
| P1-T04 | Sample schemas                        | Awaiting Cowork verification | Unit tests; browser counts in handoff P1-final     |
| P1-T05 | Graph transform & layout              | Self-checked                 | Internal; unit tests in `src/graph`                |
| P1-T06 | App shell                             | Awaiting Cowork verification | Handoff P1-final                                   |
| P1-T07 | Custom node & edge                    | Awaiting Cowork verification | Handoff P1-final                                   |
| P1-T08 | Canvas interactions & basic inspector | Awaiting Cowork verification | Handoff P1-final                                   |
| P1-T09 | Hardening                             | Awaiting Cowork verification | Handoff P1-final; headless console/DOM checks only |

## Phase 2 — Import, search, full inspector (proposed breakdown)

| ID     | Task                           | Scope                                                                                                                                                                               |
| ------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-T01 | SQL statement splitter         | Pure splitter (quotes, comments, dollar-quoting) with line numbers; unit tests.                                                                                                     |
| P2-T02 | SQL → DraftSchema (PostgreSQL) | Install `node-sql-parser`; lazy-load the PostgreSQL build; CREATE TABLE / ALTER TABLE ADD CONSTRAINT / CREATE INDEX / CREATE TYPE ENUM; per-statement warnings; never executes SQL. |
| P2-T03 | SQL dialects: MySQL & SQLite   | Dialect-specific builds, `AUTO_INCREMENT`, inline `KEY`, SQLite affinity types; fixture tests.                                                                                      |
| P2-T04 | Prisma → DraftSchema           | Install `@mrleebo/prisma-ast`; models, `@map`/`@@map`, relations, `@id`/`@@id`, `@unique`/`@@unique`, `@@index`, `@default`, enums, implicit m:n `_AToB`.                           |
| P2-T05 | Import dialog                  | Paste or drop a file, format/dialect detection, parse in a Web Worker if needed for large inputs, preview counts and issues, confirm to replace schema; enables the Import button.  |
| P2-T06 | Import issues panel            | List warnings/errors with line numbers; link to statements.                                                                                                                         |
| P2-T07 | Search                         | Command palette (shadcn `command`) over tables and columns; jump to table.                                                                                                          |
| P2-T08 | Full inspector                 | Tabs: columns (defaults, comments, enum values), keys & indexes, constraints, relationships (clickable to navigate).                                                                |
| P2-T09 | Neighbourhood highlighting     | Dim unrelated tables when one is selected (`getNeighbors`, depth 1–2), via a `Set<TableId>` in ui-store.                                                                            |
| P2-T10 | Phase 2 hardening              | Large real-world fixtures (e.g. 150+ table DDL), error-boundary paths, docs, final handoff.                                                                                         |

## Phase 3 — Persistence & export (summary)

P3-T01 Layout persistence (localStorage, keyed by fingerprint) · P3-T02 Per-table collapse modes
UI · P3-T03 Image export (PNG/SVG via `html-to-image`) · P3-T04 Schema generators (SQL DDL,
Prisma, Mermaid, JSON) · P3-T05 Export dialog · P3-T06 Session restore.

## Phase 4 — Analysis & polish (summary)

P4-T01 Schema health checks (missing PKs, unindexed FKs, orphan tables, naming) · P4-T02 Path
finder between tables · P4-T03 Subject-area grouping/filtering · P4-T04 Keyboard shortcuts &
command palette extensions · P4-T05 Performance & layout pass for 500+ tables (component packing) ·
P4-T06 Accessibility audit & docs.
