# Architecture

A ten-minute overview. The engineering record, with every ADR and the full state-slice and module
tables, is [development/ARCHITECTURE.md](development/ARCHITECTURE.md); this page summarises it and
links in rather than copying.

## In one paragraph

SchemaFlow is a static, client-only Next.js app. A schema comes from a built-in sample or from SQL
or Prisma text the user imports. Own parsers read the text (never executing it) into a draft, one
`normalizeSchema` step turns it into a single in-memory `Schema` model, and everything else (the
React Flow diagram, table list, inspector, search, health checks, path finder, exports) is derived
from that model.

## Why there is no backend

| Question                      | Answer                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| What would a server add?      | Sharing, accounts, sync. None of those is in scope ([PROJECT_OVERVIEW](PROJECT_OVERVIEW.md#scope)).                                    |
| What would it cost?           | Schemas can describe private systems; uploading them is a trust problem, and hosting is an operations problem.                         |
| What does the browser handle? | Parsing a 1 MB file takes about 0.1 s and layout of 200 tables about 180 ms on an M1 ([PERFORMANCE](PERFORMANCE.md)).                  |
| What is the build output?     | A folder of static files (`out/`, [ADR-002](development/ARCHITECTURE.md#adr-002--static-export-cache-components-disabled-2026-11-13)). |

See [BACKEND_ARCHITECTURE](BACKEND_ARCHITECTURE.md) for what that means for the usual backend topics.

## The pipeline

Diagram: [data flow](diagrams/data-flow.md). In words:

1. **Input.** A sample (`src/samples`) or the Import dialog, which lazy-loads the parsers
   ([ADR-014](development/ARCHITECTURE.md#adr-014--import-dialog-lazy-parsers-on-the-main-thread-no-web-worker-2026-11-16)).
2. **Parse.** `src/parsers` turns SQL (PostgreSQL, MySQL, SQLite) or Prisma text into a
   `DraftSchema` plus `ImportIssue`s. It never throws on user data.
3. **Normalize.** `normalizeSchema` resolves names, builds stable IDs, decides cardinality and adds
   its own issues. The result is the one `Schema`.
4. **Layout.** `layoutWithDagre` (or the packed variant for large, shallow schemas) produces
   positions, saved per schema fingerprint.
5. **Transform.** `schemaToFlow` builds React Flow nodes and edges from the schema, the positions
   and the collapse modes.
6. **Render.** The canvas, table list and inspector read the stores with narrow selectors.
7. **Export.** `src/generators` writes SVG/PNG images and SQL, Prisma, Mermaid and JSON text from
   the same `Schema`.

## Boundaries

Diagram: [module boundaries](diagrams/module-boundaries.md).

- `src/domain`, `src/samples`, `src/parsers`, `src/graph`, `src/analysis` and `src/generators` are
  pure TypeScript: no React, Next or browser imports. They are unit-tested without a DOM.
- Parsers never touch React Flow; canvas components never touch parsers.
- `Schema` is the single source of truth; React Flow nodes and edges are derived by `schemaToFlow`.
- Three Zustand stores ([diagram](diagrams/stores.md)): `schema-store`, `layout-store`, `ui-store`.

## Where state lives

| What                                          | Where                                                                                                                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The schema and its issues                     | `schema-store`, in memory                                                                                                                                                      |
| Positions, collapse modes, viewport           | `layout-store`; saved to localStorage per fingerprint ([ADR-025](development/ARCHITECTURE.md#adr-025--layout-persistence-per-fingerprint-localstorage-keys-2026-11-19-p3-t01)) |
| The last imported text                        | IndexedDB, re-parsed on load ([ADR-030](development/ARCHITECTURE.md#adr-030--session-restore-indexeddb-source-text-re-parsed-on-load-2026-11-19-p3-t06))                       |
| Selection, panels, search, tabs, hidden areas | `ui-store`, in memory (a few preferences saved)                                                                                                                                |
| Theme                                         | `next-themes`, localStorage                                                                                                                                                    |

## Making it fast enough

Nodes carry only a table id and a mode; components look the table up. `nodeTypes` and `edgeTypes`
are module-scope and the node and edge components are memoised. Selection is a boolean selector
per component, so selecting a table re-renders only the affected nodes. React Flow renders only
visible elements above 80 tables. Details and measured numbers: [PERFORMANCE](PERFORMANCE.md).

## Where to go next

| For                     | Read                                                                           |
| ----------------------- | ------------------------------------------------------------------------------ |
| Requirements and design | [SYSTEM_DESIGN](SYSTEM_DESIGN.md)                                              |
| Components and stores   | [FRONTEND_ARCHITECTURE](FRONTEND_ARCHITECTURE.md)                              |
| The folder tree         | [PROJECT_STRUCTURE](PROJECT_STRUCTURE.md)                                      |
| Every decision          | [TECHNICAL_DECISIONS](TECHNICAL_DECISIONS.md), [TRADE_OFFS](TRADE_OFFS.md)     |
| Versions and libraries  | [TECH_STACK](TECH_STACK.md), [VERSION_COMPATIBILITY](VERSION_COMPATIBILITY.md) |
