# Roadmap

Public summary. The engineering source of truth, with per-task acceptance criteria, verification
rounds and known issues, is [development/ROADMAP.md](development/ROADMAP.md); this page does not copy it.

Status of the project: **closed.** Phases 1 to 4 are built. No further work is planned.

## Phases

| Phase | Theme                                 | What it delivered                                                                                                                                                                               | Status                     |
| ----- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| 1     | Foundation, model, interactive canvas | Normalized `Schema` model, built-in samples, graph transform and Dagre layout, app shell, custom table node and relationship edge, selection, basic inspector                                   | Verified with known issues |
| 2     | Import, search, full inspector        | Hand-written SQL (PostgreSQL, MySQL, SQLite) and Prisma parsers, Import dialog, Issues panel, search, three-tab inspector, neighbourhood dimming, hardening on real dumps, Playwright e2e suite | Verified with known issues |
| 3     | Persistence and export                | Layout persistence, collapse modes, PNG/SVG export, SQL/Prisma/Mermaid/JSON generators, Export dialog, session restore, packed layout for large schemas                                         | Verified with known issues |
| 4     | Analysis and polish                   | Health checks, path finder, subject areas, keyboard shortcuts and commands, accessibility audit (axe), bug fixes                                                                                | Verified with known issues |

"Verified" means an independent verification pass (Claude Cowork, a separate agent) tested the task in
a browser and the result is recorded in the [QA log](development/QA_LOG.md). "With known issues" means
defects remain open and are listed there.

## Decided against

- **Canvas overview renderer** for very large schemas: prototyped, then cut in favour of a ~300-table
  design target ([ADR-031](development/ARCHITECTURE.md#adr-031--packed-layout-300-table-design-target-no-canvas-overview-2026-11-20-p3-t07)).
- **Extreme-size work** (thousands of tables), a hosted demo (DEPLOY-01 was dropped), accounts or sync.
- **P4-T05** (a further analysis task) was dropped as out of scope.

## Open defects

Three low-impact accessibility defects (QA-043, QA-044, QA-045) are open and will not be fixed because
the project is closed. They are in the [QA log Backlog](development/QA_LOG.md#backlog).
