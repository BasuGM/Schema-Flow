# SchemaFlow

A browser-based, interactive database schema explorer. Import SQL DDL or a Prisma schema and
explore it as a 2D entity relationship diagram. Everything runs locally in the browser: imported
SQL is parsed as text, never executed, and schema data is never sent anywhere.

> Status: Phases 1 to 4 are built and the project is closed. Every task was implemented with
> Claude Code and tested in a browser by an independent verification pass (Claude Cowork, a
> separate agent). Open defects: [QA log Backlog](docs/development/QA_LOG.md#backlog).
> There is no hosted demo; run it locally (see Getting started).

## The problem

Reading a real schema as text is slow: a `pg_dump` lists hundreds of tables and the relationships
are buried in `ALTER TABLE` statements. SchemaFlow turns the file into an interactive diagram without
a database connection or an upload. More in [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md).

## What it does

- **Import** SQL DDL (PostgreSQL, MySQL, SQLite — including `pg_dump` and `mysqldump` output) or a
  Prisma schema: paste it, choose a file or drop one (up to 5 MB). The text is tokenized by
  SchemaFlow's own tolerant parsers. It is never executed and never leaves the browser.
  Statements that don't matter for a diagram (data, grants, functions, …) are skipped and
  summarised; problems are listed in an issues panel with line numbers, and one bad statement
  never blocks the rest. PostgreSQL partitions are folded into their partitioned table.
- **Explore** the schema as an auto-laid-out diagram: tables with their columns, keys and
  nullability, and relationships with cardinality. Select a table in the list or on the canvas
  to see its columns, keys and relations in the inspector, follow foreign keys, and dim everything
  outside its 1- or 2-hop neighbourhood.
- **Search** tables and columns (⌘K / Ctrl+K or `/`) and jump to the result; the same dialog runs
  commands (type a few letters, or start with `>`).
- **Keyboard shortcuts** (press `?` for the list): `F` reset view, `L` layout, `[` / `]` table list
  and inspector, `H` health, `E` export, `I` import. Single keys are ignored while typing in a field
  or with a dialog open. On some keyboard layouts `[` and `]` need AltGr.
- **Pick up where you left off.** A reload restores the last schema you imported, the pan and zoom and the selected table.
  `?sample=…` URLs always show that sample.
- Light and dark themes, keyboard navigation, and a phone layout with the panels as sheets.
- Tested on real schemas: GitLab's `structure.sql` (992 tables after folding partitions),
  Sakila, and generated 180-table `mysqldump` and 200-model Prisma files
  (see [tests/fixtures/real/SOURCES.md](tests/fixtures/real/SOURCES.md)).

Large schemas are laid out on the main thread: GitLab's 992 tables take about 3 s on an M1
(the Import button shows "Laying out N tables…" meanwhile).

## Tech stack and architecture

Next.js 16 (static export), React 19, React Flow 12, Zustand 5, Tailwind v4, shadcn/ui, Dagre; own
SQL and Prisma parsers. Pure TypeScript layers (`src/domain`, `src/parsers`, `src/generators`,
`src/analysis`) produce a normalized `Schema`; `schemaToFlow()` turns it into React Flow nodes and
edges. Details: [docs/TECH_STACK.md](docs/TECH_STACK.md), [docs/development/ARCHITECTURE.md](docs/development/ARCHITECTURE.md).

## Accessibility

- **Keyboard:** Tab reaches every control and every table on the diagram; Enter or Space selects a
  table; `?` lists the shortcuts. A "Skip to diagram" link is the first Tab stop.
- **Screen readers:** panels, dialogs and the diagram are labelled landmarks; tables and
  relationships have accessible names; toolbar buttons keep their names on a phone.
- **Reduced motion** is honoured (animations and viewport transitions are switched off).
- **Automated audit:** an axe-core suite (WCAG 2.0/2.1 A and AA) covers the main screens in light
  and dark. In the latest verification round it passed except for one flaky dark-mode dialog check
  (QA-045). It does not replace a manual screen-reader pass, which has not been done.
- **Known defects (open, won't fix because the project is closed):** the destructive button, for
  example on the Clear saved data confirmation, has a contrast ratio of 3.79 (light) / 4.28 (dark),
  below 4.5 (QA-044); the search button's `aria-keyshortcuts` reads `Meta+K` on Windows and Linux
  (QA-043); the audit does not cover the Settings and More menus or the clear-data dialog (QA-045).
  See the [QA log Backlog](docs/development/QA_LOG.md#backlog).
- **Other limitations:** relationship lines can't be focused with the keyboard (the inspector's
  Relations and Path tabs give the same information), and the diagram's spatial layout has no
  non-visual equivalent.

## Local data

Nothing is uploaded. To restore your work, SchemaFlow keeps on this device only: the text of your last import (IndexedDB), table
positions, collapse modes and pan/zoom per schema, the selected table, and preferences (localStorage). Settings → **Clear saved
data…** (More on phones) removes all of it. If your browser has `BroadcastChannel`, other open tabs stop saving after a clear;
without it, a tab that was already open can write its state back.

## Getting started

Requires Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script                  | What it does                                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Next.js dev server                                                                                                           |
| `npm run build`         | Static export to `out/`                                                                                                      |
| `npm run start`         | Serve the static export in `out/` on port 3000 via `python3 -m http.server` (run `npm run build` first; stop the dev server) |
| `npm run typecheck`     | `tsc --noEmit`                                                                                                               |
| `npm run lint`          | ESLint (flat config)                                                                                                         |
| `npm run format`        | Prettier (with Tailwind class sorting)                                                                                       |
| `npm run test`          | Vitest, single run                                                                                                           |
| `npm run test:coverage` | Vitest with V8 coverage                                                                                                      |
| `npm run check`         | typecheck → lint → test → build, failing fast                                                                                |

Headless checks (need Chrome and a running server): `node scripts/headless/toolbar-width.mjs`
(phone toolbar) and `node scripts/headless/large-schema-perf.mjs` (frame costs on a
2,000-table schema).

### Sample schemas

- `/` loads the built-in e-commerce sample (12 tables).
- `/?sample=synthetic&tables=200` generates a synthetic schema for performance testing
  (`tables` is clamped to 1–1000; add `&seed=7` for a different deterministic graph).

## Documentation

| Start here                                   | Engineering record (source of truth)                      |
| -------------------------------------------- | --------------------------------------------------------- |
| [Project overview](docs/PROJECT_OVERVIEW.md) | [Architecture and ADRs](docs/development/ARCHITECTURE.md) |
| [Features](docs/FEATURES.md)                 | [Roadmap](docs/development/ROADMAP.md)                    |
| [User flows](docs/USER_FLOWS.md)             | [Verification](docs/development/VERIFICATION.md)          |
| [Demo guide](docs/DEMO_GUIDE.md)             | [QA log](docs/development/QA_LOG.md)                      |
| [Public roadmap](docs/ROADMAP.md)            |                                                           |

| Design                                                 | Stack and decisions                                            |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| [Architecture overview](docs/ARCHITECTURE.md)          | [Tech stack](docs/TECH_STACK.md)                               |
| [System design](docs/SYSTEM_DESIGN.md)                 | [Dependencies](docs/DEPENDENCIES.md)                           |
| [Frontend architecture](docs/FRONTEND_ARCHITECTURE.md) | [Version compatibility](docs/VERSION_COMPATIBILITY.md)         |
| [Project structure](docs/PROJECT_STRUCTURE.md)         | [Technical decisions (ADR index)](docs/TECHNICAL_DECISIONS.md) |
| [Diagrams](docs/diagrams/data-flow.md)                 | [Trade-offs](docs/TRADE_OFFS.md)                               |

| Data and internals                                       |                                                      |
| -------------------------------------------------------- | ---------------------------------------------------- |
| [Data flow](docs/DATA_FLOW.md)                           | [Database design](docs/DATABASE_DESIGN.md)           |
| [API documentation](docs/API_DOCUMENTATION.md)           | [Backend architecture](docs/BACKEND_ARCHITECTURE.md) |
| [Authentication](docs/AUTHENTICATION.md)                 | [Caching strategy](docs/CACHING_STRATEGY.md)         |
| [Logging and monitoring](docs/LOGGING_AND_MONITORING.md) |                                                      |

| Quality and operations                         |                                          |
| ---------------------------------------------- | ---------------------------------------- |
| [Security](docs/SECURITY.md)                   | [Scalability](docs/SCALABILITY.md)       |
| [Performance](docs/PERFORMANCE.md)             | [Error handling](docs/ERROR_HANDLING.md) |
| [Coding standards](docs/CODING_STANDARDS.md)   | [Testing](docs/TESTING.md)               |
| [CI/CD](docs/CI_CD.md)                         | [Deployment](docs/DEPLOYMENT.md)         |
| [Environment setup](docs/ENVIRONMENT_SETUP.md) |                                          |

| Interview preparation (first person)                 |                                                          |
| ---------------------------------------------------- | -------------------------------------------------------- |
| [Interview guide](docs/INTERVIEW_GUIDE.md)           | [Project Q&A](docs/PROJECT_Q%26A.md)                     |
| [Technical challenges](docs/TECHNICAL_CHALLENGES.md) | [Design decisions](docs/DESIGN_DECISIONS.md)             |
| [Trade-off analysis](docs/TRADE_OFF_ANALYSIS.md)     | [Scalability discussion](docs/SCALABILITY_DISCUSSION.md) |
| [Lessons learned](docs/LESSONS_LEARNED.md)           |                                                          |

| Status and project                             |                                        |
| ---------------------------------------------- | -------------------------------------- |
| [QA report](docs/QA_REPORT.md)                 | [Known issues](docs/KNOWN_ISSUES.md)   |
| [Known limitations](docs/KNOWN_LIMITATIONS.md) | [Release notes](docs/RELEASE_NOTES.md) |
| [Changelog](CHANGELOG.md)                      | [Contributing](CONTRIBUTING.md)        |
| [Code of conduct](CODE_OF_CONDUCT.md)          | [License (MIT)](LICENSE)               |

## Author

Basavachetan Mathapati ([GitHub: BasuGM](https://github.com/BasuGM)).
