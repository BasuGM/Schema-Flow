# Changelog

Changes by phase and task. Dates are the day of the Cowork verification round that closed the task
(the work itself is in the git history). QA IDs point to the
[QA log](docs/development/QA_LOG.md); ADR numbers point to the
[decision index](docs/development/ARCHITECTURE.md#decision-index). There are no tagged releases;
the package version is 0.1.0 ([RELEASE_NOTES](docs/RELEASE_NOTES.md)).

A task is listed as verified only where a Cowork report was logged. Round numbers are the QA log's.

## [Unreleased]

- Documentation set (DOC-01): README, the `docs/` pages, LICENSE, CONTRIBUTING and CODE_OF_CONDUCT.
  Docs only; no application code changed. **Awaiting Cowork verification.**

## Phase 4 — Analysis and polish

Verified with known issues (Cowork round 29, 2026-11-24).

- **2026-11-24, P4-BF and P4-T06 (round 29).** Accessibility audit with axe-core over the main
  screens in light and dark (ADR-038); skip link, clearer node and control names, phone toolbar
  names. QA-041 (on-path edges at overview zoom) and QA-042 (`aria-keyshortcuts` on Search and
  Reset view) fixed. Open, won't fix: QA-043, QA-044, QA-045.
- **2026-11-23, P4-T04 (round 28).** Commands in the search palette, one shortcut table, a
  keyboard-shortcuts dialog (ADR-037). QA-042 found.
- **2026-11-23, P4-T03 (round 27).** Subject areas derived from schema names or table-name prefixes,
  with hide and show on the canvas (ADR-036).
- **2026-11-23, P4-T02 (round 26).** Path finder between two tables in an inspector tab (ADR-035).
  QA-041 found.
- **2026-11-23, P4-T07 (rounds 25 and 25b).** Phone sheet reveal, e2e import timeout. QA-038, QA-039
  and QA-040 fixed.
- **2026-11-23, P4-T01 (round 24).** Schema health checks in a second bottom-panel tab (ADR-034).
  QA-039 found.
- P4-T05 was dropped as out of scope.

## Phase 3 — Persistence and export

Verified with known issues (Cowork round 23, 2026-11-21).

- **2026-11-21, BB-P3 (round 23).** Bug-bash of everyday flows at up to about 300 tables. QA-031 to
  QA-037 fixed, including PostgreSQL expressions in MySQL and SQLite exports (ADR-033).
- **2026-11-20, P3-T08 (round 22).** Focus anchor in inspector navigation and a focus ring on the
  import file label (ADR-032). QA-027, QA-028 and QA-029 fixed; QA-036 found (fixed in BB-P3).
- **2026-11-20, P3-T07 (round 21).** Packed layout for large, shallow schemas, a large-schema notice
  and a roughly 300-table design target (ADR-031). QA-018 fixed. QA-034 and QA-035 found, then fixed.
- **2026-11-20, P3-T06 (round 20).** Session restore: the last schema, pan, zoom and selection come
  back after a reload (ADR-030).
- **2026-11-19, P3-T05 (round 19).** One Export dialog with SQL, Prisma, Mermaid, JSON and Image
  tabs (ADR-029).
- **2026-11-19, P3-T04 (rounds 18 and 19).** Schema text generators. Round 18 left it open on QA-030
  (High) and QA-031; QA-030 was fixed and verified in round 19 (ADR-028).
- **2026-11-19, P3-T03 (round 17).** PNG and SVG image export from an own SVG renderer (ADR-027).
- **2026-11-19, P3-T02 (round 16).** Per-table collapse modes with inspector, node and bulk
  controls (ADR-026).
- **2026-11-19, P3-T01 (round 15).** Layout persistence in localStorage, keyed by schema
  fingerprint (ADR-025).

## Phase 2 — Import, search, full inspector

Verified with known issues (Cowork round 13, 2026-11-19; hardening in rounds 13 and 14).

- **2026-11-19, BB-P2 (round 14).** Exploratory bug-bash. QA-023 to QA-026 verified; QA-027 to
  QA-029 moved to P3-T08.
- **2026-11-19, E2E-01 (round 13).** Playwright end-to-end suite and `npm run e2e` (ADR-024).
- **2026-11-19, P2-T10 (rounds 12 and 13).** Hardening for large schemas: lighter zoomed-out canvas,
  real-input selection costs, edge dimming (ADR-022, ADR-023). QA-019 to QA-022 fixed.
- **2026-11-16, P2-T09 (round 11).** Neighbourhood highlighting, 1 or 2 hops (ADR-018). QA-017.
- **2026-11-16, P2-T08 (round 10).** Full inspector with Columns, Keys and Relations tabs (ADR-017).
  QA-016 fixed.
- **2026-11-16, P2-T07 (round 9).** Own search palette for tables and columns (ADR-016).
- **2026-11-16, P2-T06 (round 8).** Import issues panel; a bottom sheet on phones. QA-014 and QA-015.
- **2026-11-16, P2-T05 (round 7).** Import dialog: paste, choose or drop; 5 MB cap; format
  detection with an override; counts preview. QA-011, QA-012 and QA-013 (blank-line freeze) found
  and fixed.
- **2026-11-16, P2-T04 (round 6).** Prisma import with an own parser (ADR-013). QA-010.
- **2026-11-16, P2-T01 to P2-T03 (rounds 4 and 5).** SQL tokenizer, splitter and format detection;
  hand-written PostgreSQL parser (ADR-012); MySQL and SQLite dialects. QA-007, QA-008, QA-009.

## Phase 1 — Foundation, model, interactive canvas

Verified with known issues (Cowork, relayed 2026-11-16).

- **2026-11-16, P1-T07 and P1-T08.** Custom table node and relationship edge; canvas
  interactions and a basic inspector. QA-001 to QA-006 fixed over rounds 2 to 5.
- **2026-11-13, P1-T01 to P1-T06 and P1-T09.** Project scaffold, documentation and agent rules,
  domain model, built-in sample schemas, graph transform and Dagre layout, app shell and hardening
  (rounds 1 to 3). QA-001 to QA-005 found.
