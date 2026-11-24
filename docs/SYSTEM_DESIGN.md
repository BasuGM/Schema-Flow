# System design

Requirements, constraints, components and the principles that tie them together. The overview is
[ARCHITECTURE](ARCHITECTURE.md); the engineering record is
[development/ARCHITECTURE.md](development/ARCHITECTURE.md).

## Requirements

| Kind           | Requirement                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| Functional     | Import SQL DDL (PostgreSQL, MySQL, SQLite) and Prisma schemas by file or paste                         |
| Functional     | Show an interactive 2D diagram; select, search, inspect, collapse, group and find paths                |
| Functional     | Report import problems and schema health findings                                                      |
| Functional     | Export PNG, SVG, SQL, Prisma, Mermaid and JSON; restore the last session after a reload                |
| Non-functional | Schema data never leaves the browser; imported SQL is parsed as text and never executed                |
| Non-functional | Smooth on a MacBook Air M1 with 8 GB for schemas of up to about 300 tables                             |
| Non-functional | User data never crashes the app: problems become `ImportIssue`s, and each region has an error boundary |
| Non-functional | Keyboard reachable, labelled, visible focus, light and dark themes, a phone layout (390 px)            |

## Constraints

- **Target machine:** MacBook Air M1, 8 GB. Features, fixtures and checks have to run comfortably there.
- **Envelope:** about 300 tables. Beyond it the app degrades gracefully (no crash, a short notice) and stops there ([ADR-031](development/ARCHITECTURE.md#adr-031--packed-layout-300-table-design-target-no-canvas-overview-2026-11-20-p3-t07)).
- **Input cap:** 5 MB per import, refused before it is read.
- **No server, Docker, AI integration or 3D view.** 2D only, by choice.
- **Priority:** development speed and everyday usability over completeness.

## Components

Diagram: [module boundaries](diagrams/module-boundaries.md).

| Component  | Responsibility                                                                         | Detail                                            |
| ---------- | -------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Domain     | `Schema` types, IDs, normalize, validate, fingerprint, selectors, search, path finding | `src/domain`                                      |
| Parsers    | SQL and Prisma text to `DraftSchema` and issues; format detection; file decoding       | `src/parsers`                                     |
| Graph      | `schemaToFlow`, Dagre and packed layout, edge paths, node metrics                      | `src/graph`                                       |
| Analysis   | Health checks and subject areas, as pure functions                                     | `src/analysis`                                    |
| Generators | Image and text export                                                                  | `src/generators`                                  |
| Stores     | Three Zustand stores and the persistence helpers                                       | `src/stores`                                      |
| UI         | Workspace, canvas, inspector, issues, search, commands, export, import                 | [FRONTEND_ARCHITECTURE](FRONTEND_ARCHITECTURE.md) |

## Data and state

One normalized `Schema` per session; everything shown is derived. See
[DATABASE_DESIGN](DATABASE_DESIGN.md) for the model and browser storage, and
[DATA_FLOW](DATA_FLOW.md) for the sequences.

## Principles

1. **One source of truth.** The `Schema` is never duplicated; React Flow nodes and edges are derived.
2. **Pure core, thin UI.** Anything testable without a DOM lives in a pure folder and is tested there.
3. **Never throw on user data.** Return issues; show them; keep going ([ERROR_HANDLING](ERROR_HANDLING.md)).
4. **Narrow subscriptions.** A change re-renders only what reads it.
5. **Derive, do not store.** Health, paths and subject areas are computed from the schema.
6. **Few dependencies.** Every new one is justified in the ADRs first ([DEPENDENCIES](DEPENDENCIES.md)).
7. **Be honest about limits.** What is not built is labelled so ([KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md)).
