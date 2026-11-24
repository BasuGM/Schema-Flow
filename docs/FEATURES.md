# Features

What SchemaFlow does, by area. Decisions are linked to the
[architecture record](development/ARCHITECTURE.md#decision-index); the verification history is in the
[QA log](development/QA_LOG.md) and [ROADMAP](development/ROADMAP.md).

## Import and parsers

- Paste, choose or drop a file (any extension, up to 5 MB). UTF-16 and binary files are detected.
- SQL DDL for PostgreSQL, MySQL and SQLite (including `pg_dump` and `mysqldump` output) and Prisma
  schemas, read by hand-written tolerant parsers
  ([ADR-012](development/ARCHITECTURE.md#adr-012--hand-written-tolerant-ddl-parser-instead-of-node-sql-parser-2026-11-13),
  [ADR-013](development/ARCHITECTURE.md#adr-013--hand-written-prisma-schema-parser-instead-of-mrleeboprisma-ast-2026-11-16)).
- Statements that do not matter for a diagram (data, grants, functions, views) are skipped and
  summarised. Problems appear in an **Issues** panel with line numbers; one bad statement never
  blocks the rest.
- PostgreSQL partitions are folded into their partitioned table
  ([ADR-019](development/ARCHITECTURE.md#adr-019--real-world-dumps-partitions-folded-schema-qualified-names-2026-11-16-p2-t10)).
- Parsers load lazily when the Import dialog opens
  ([ADR-014](development/ARCHITECTURE.md#adr-014--import-dialog-lazy-parsers-on-the-main-thread-no-web-worker-2026-11-16)).

## Canvas

- Automatic layout (Dagre); large, elongated schemas of 50+ tables are packed toward a 16:10 shape
  ([ADR-031](development/ARCHITECTURE.md#adr-031--packed-layout-300-table-design-target-no-canvas-overview-2026-11-20-p3-t07)).
  Dragging a table keeps its position; **Layout** (`L`) re-runs the layout.
- Tables show columns, keys and nullability; relationships show cardinality.
- **Collapse modes** per table: `full`, `keys` or `header`, from the inspector, a node-header toggle,
  or "All tables" actions
  ([ADR-026](development/ARCHITECTURE.md#adr-026--collapse-modes-ui-positions-kept-mouse-toggle--keyboard-inspector-control-2026-11-19-p3-t02)).
- **Neighbourhood dimming:** selecting a table dims everything outside its 1- or 2-hop neighbourhood.
- **Lighter rendering when zoomed out** below zoom 0.3 (row detail is dropped), which keeps panning
  responsive on large schemas. There is no separate "overview mode" (it was prototyped and cut,
  ADR-031).
- Schemas above 300 tables open with a dismissible notice and no speed promise.

## Inspector

Four tabs for the selected table: **Columns**, **Keys**, **Relations** (follow a foreign key to the
related table, with Back) and **Path**
([ADR-017](development/ARCHITECTURE.md#adr-017--inspector-three-tabs-explicit-vs-reading-navigation-2026-11-16),
[ADR-035](development/ARCHITECTURE.md#adr-035--path-finder-in-an-inspector-tab-2026-11-23-p4-t02)).

## Search and commands

- `⌘K` / `Ctrl+K` or `/` opens a search dialog over table and column names.
- The same dialog runs commands: type a few letters, or start with `>`
  ([ADR-037](development/ARCHITECTURE.md#adr-037--commands-in-the-own-palette-and-one-shortcut-table-2026-11-23-p4-t04)).

## Keyboard shortcuts

Defined once in a single `SHORTCUTS` table that feeds the key handler, the `?` help dialog,
palette hints and tooltips (ADR-037).

| Key                  | Action                 |
| -------------------- | ---------------------- |
| `⌘K` / `Ctrl+K`, `/` | Search and commands    |
| `?`                  | Shortcut help          |
| `F`                  | Reset view             |
| `L`                  | Layout                 |
| `[` / `]`            | Table list / inspector |
| `H`                  | Schema health          |
| `E`                  | Export                 |
| `I`                  | Import                 |
| `Esc`                | Close or clear         |

Single keys are ignored while typing in a field or with a dialog open. On some keyboard layouts
`[` and `]` need AltGr.

## Health checks

Advisory checks, not import errors: tables without a primary key, foreign keys without a covering
index, orphan tables and naming inconsistencies, in a **Health** tab next to Issues
([ADR-034](development/ARCHITECTURE.md#adr-034--schema-health-checks-in-a-second-bottom-panel-tab-2026-11-21-p4-t01)).

## Path finder

The shortest foreign-key path between two tables (either direction), lit on the canvas. Ties are
resolved deterministically (ADR-035).

## Subject areas

For schemas with several database schemas or common name prefixes, tables are grouped into areas.
Areas can be hidden or shown alone from the table list
([ADR-036](development/ARCHITECTURE.md#adr-036--subject-areas-derived-and-hidden-on-the-canvas-2026-11-23-p4-t03)).

## Export

One **Export** dialog with a preview
([ADR-029](development/ARCHITECTURE.md#adr-029--one-export-dialog-with-tabs-preview-and-stale-safe-generation-2026-11-19-p3-t05)):

- **Images:** PNG and SVG, drawn by SchemaFlow's own SVG renderer
  ([ADR-027](development/ARCHITECTURE.md#adr-027--image-export-own-svg-renderer-instead-of-html-to-image-2026-11-19-p3-t03)).
- **Text:** SQL DDL (PostgreSQL, MySQL, SQLite), Prisma, Mermaid and JSON, with warnings where the
  target cannot express something
  ([ADR-028](development/ARCHITECTURE.md#adr-028--text-generators-sql-prisma-mermaid-json-with-warnings-and-fixed-point-tests-2026-11-19-p3-t04),
  [ADR-033](development/ARCHITECTURE.md#adr-033--postgresql-expressions-in-mysql-and-sqlite-exports-2026-11-20-bb-p3)).

## Session restore and local data

A reload restores the last import (text kept in IndexedDB and re-parsed), table positions, collapse
modes, pan/zoom and the selected table (localStorage, per schema fingerprint)
([ADR-025](development/ARCHITECTURE.md#adr-025--layout-persistence-per-fingerprint-localstorage-keys-2026-11-19-p3-t01),
[ADR-030](development/ARCHITECTURE.md#adr-030--session-restore-indexeddb-source-text-re-parsed-on-load-2026-11-19-p3-t06)).
`?sample=…` URLs always show that sample. Settings → **Clear saved data…** removes everything.

## Themes, accessibility, phone

- Light and dark themes; reduced motion is honoured.
- Keyboard reachable controls and tables, a "Skip to diagram" link, labelled landmarks and an axe
  audit in the e2e suite
  ([ADR-038](development/ARCHITECTURE.md#adr-038--accessibility-audit-with-axe-2026-11-24-p4-t06)).
  Three accessibility defects are open and not going to be fixed (QA-043, QA-044, QA-045); see the
  [QA log Backlog](development/QA_LOG.md#backlog).
- On a phone the table list, inspector and bottom panel become sheets.

## Not supported

Views, functions, triggers and data are skipped on import; no live database connection; no
collaboration; 2D only. Schemas over about 300 tables open but are not tuned.
