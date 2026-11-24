# Project structure

An annotated tree of the repository at `72bb28c` (2026-11-24). Test files sit next to the code they
test (`*.test.ts`) and are left out below. Folder rules are in
[ARCHITECTURE](ARCHITECTURE.md#boundaries) and the [module boundaries diagram](diagrams/module-boundaries.md).

```text
schema-flow/
├── README.md, CHANGELOG.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, LICENSE
├── CLAUDE.md, AGENTS.md, COWORK.md     Rules for the coding agent and the verification agent
├── package.json, package-lock.json     Scripts, dependencies, engines (Node >= 22)
├── next.config.ts                      Static export (output: "export")
├── tsconfig.json, eslint.config.mjs, postcss.config.mjs, components.json
├── vitest.config.mts                   Unit and component tests (node, jsdom per file)
├── playwright.config.ts                End-to-end tests (Chromium)
├── .github/workflows/nextjs.yml        Unused; see CI_CD
│
├── src/
│   ├── app/                            Next App Router: layout, the one page, error pages, globals.css
│   ├── domain/                         PURE. The Schema model
│   │   ├── schema/                       types, draft, normalize, validate, fingerprint, selectors,
│   │   │                                 table-details, path (findPath), issues, ids, data-type
│   │   ├── search/                       Search index and ranking
│   │   └── commands/                     Command matching for the palette
│   ├── samples/                        PURE. E-commerce sample, synthetic generator, ?sample= parsing
│   ├── parsers/                        PURE. SQL and Prisma text to DraftSchema + ImportIssues
│   │   ├── sql/                          Tolerant DDL parser (tokenizer, statement splitter, column and constraint parsers)
│   │   └── prisma/                       Prisma schema parser
│   ├── graph/                          PURE. schemaToFlow, Dagre and packed layout, edge paths, node metrics
│   ├── analysis/                       PURE. Health checks (health.ts) and subject areas
│   ├── generators/                     PURE. Export: SVG diagram, raster sizing, sql/, prisma/, text/
│   ├── stores/                         Zustand: schema-store, layout-store, ui-store, persistence
│   ├── lib/                            Browser helpers: safe-storage, session-db (IndexedDB), download,
│   │                                   copy-text, svg-to-png, media query hook, cn
│   ├── components/
│   │   ├── workspace/                    Shell, toolbar, table list, panels, session restore
│   │   ├── canvas/                       React Flow canvas, TableNode, RelationshipEdge, notices
│   │   ├── inspector/                    Columns, Keys, Relations, Path tabs
│   │   ├── issues/                       Bottom panel: Issues and Health
│   │   ├── import/, export/              The two dialogs
│   │   ├── search/, commands/            Search palette, shortcuts, command hooks
│   │   ├── errors/                       Error boundaries and fallbacks
│   │   └── ui/                           shadcn/ui primitives
│   └── test/                           Shared test helpers: setup, fakes, canonical and hostile schemas
│
├── tests/
│   ├── e2e/                            Playwright specs, one per feature area, plus support/
│   └── fixtures/                       sql/, prisma/, real/ (SOURCES.md), synthetic/, large/
│
├── scripts/
│   ├── cleanup.sh                      Stops stray servers and browsers before perf or e2e runs
│   ├── fixtures/                       Generators for the large and synthetic fixtures
│   └── headless/                       Perf and layout checks, toolbar width check (docs screenshots script comes in the last DOC-01 commit)
│
└── docs/
    ├── *.md                            Public documentation (this set)
    ├── diagrams/                       Mermaid diagrams shared by several docs
    ├── images/                         Screenshots used by the README
    └── development/                    Engineering record
        ├── ROADMAP.md                    Now block and task status
        ├── ARCHITECTURE.md               ADRs, module and state tables
        ├── QA_LOG.md, VERIFICATION.md    Defects and verification status
        ├── AGENT-REFERENCE.md            Detailed agent rules and commands
        ├── plans/                        One plan per task
        └── handoffs/                     One handoff per task (archive/ for old ones)
```

`docs/images/` and the screenshots script arrive with the last DOC-01 commit; until then those
entries are planned, not present. Build output (`out/`, `.next/`), `coverage/` and `node_modules/`
are not committed.

## Where to look for

| I want to…                         | Look in                                                             |
| ---------------------------------- | ------------------------------------------------------------------- |
| Change how a SQL feature parses    | `src/parsers/sql`, then a fixture in `tests/fixtures/sql`           |
| Add a schema field                 | `src/domain/schema/types.ts`, `draft.ts`, `normalize.ts`            |
| Change a table's look              | `src/components/canvas/table-node.tsx`, `src/graph/node-metrics.ts` |
| Add an export format               | `src/generators`, then `components/export`                          |
| Add a keyboard shortcut or command | `src/components/commands/shortcuts.ts`                              |
| Understand why something is so     | [TECHNICAL_DECISIONS](TECHNICAL_DECISIONS.md)                       |
