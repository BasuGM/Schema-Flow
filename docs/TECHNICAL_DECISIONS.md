# Technical decisions

An index of every architecture decision record (ADR), one line each. The full records, with
context, consequences and QA links, are in
[development/ARCHITECTURE.md](development/ARCHITECTURE.md#decision-records). For the ten decisions I
would explain in an interview, see [DESIGN_DECISIONS](DESIGN_DECISIONS.md); for the pros and cons of
the main choices, see [TRADE_OFFS](TRADE_OFFS.md).

Status as of `72bb28c` (2026-11-24). ADR-023 is superseded by ADR-031; ADR-011a is a follow-up to ADR-011 and
not a gap in the numbering.

## Foundation (2026-11-13)

| ADR                                                                                             | Decision                                 |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------- |
| [001](development/ARCHITECTURE.md#adr-001--tailwind-via-tailwindcsspostcss-2026-11-13)          | Tailwind via `@tailwindcss/postcss`      |
| [002](development/ARCHITECTURE.md#adr-002--static-export-cache-components-disabled-2026-11-13)  | Static export, Cache Components off      |
| [003](development/ARCHITECTURE.md#adr-003--no-vitejsplugin-react-2026-11-13)                    | No `@vitejs/plugin-react`                |
| [004](development/ARCHITECTURE.md#adr-004--keep-shadcns-cn-package-2026-11-13)                  | Keep shadcn's `cn` package               |
| [005](development/ARCHITECTURE.md#adr-005--stay-on-typescript-5x-and-eslint-9x-2026-11-13)      | Stay on TypeScript 5.x and ESLint 9.x    |
| [006](development/ARCHITECTURE.md#adr-006--synthetic-sample-available-in-all-builds-2026-11-13) | Synthetic sample available in all builds |

## Canvas and layout

| ADR                                                                                                                                     | Decision                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [007](development/ARCHITECTURE.md#adr-007--edge-anchoring-and-handle-sides-2026-11-13)                                                  | Edge anchoring: source handle left, target right per column   |
| [008](development/ARCHITECTURE.md#adr-008--node-selection-owned-by-ui-store-2026-11-13)                                                 | Node selection owned by `ui-store`                            |
| [009](development/ARCHITECTURE.md#adr-009--rebuilding-react-flow-nodes-only-on-layout-version-changes-2026-11-13)                       | Rebuild nodes only on layout "version" changes                |
| [010](development/ARCHITECTURE.md#adr-010--use-dagres-edge-routes-for-long-edges-2026-11-13-qa-001)                                     | Use Dagre's edge routes for long edges (QA-001)               |
| [011](development/ARCHITECTURE.md#adr-011--edge-labels-anchored-at-the-fk-row-above-nodes-2026-11-13-qa-002-revised-for-qa-004)         | Edge labels anchored at the FK row, above nodes (QA-002/004)  |
| [011a](development/ARCHITECTURE.md#adr-011a--constant-size-edge-labels-and-edge-selection-2026-11-13-qa-005)                            | Constant-size edge labels and edge selection (QA-005)         |
| [018](development/ARCHITECTURE.md#adr-018--neighbourhood-highlighting-and-inert-panels-2026-11-16)                                      | Neighbourhood highlighting and inert panels                   |
| [026](development/ARCHITECTURE.md#adr-026--collapse-modes-ui-positions-kept-mouse-toggle--keyboard-inspector-control-2026-11-19-p3-t02) | Collapse modes UI: positions kept, mouse and keyboard control |
| [031](development/ARCHITECTURE.md#adr-031--packed-layout-300-table-design-target-no-canvas-overview-2026-11-20-p3-t07)                  | Packed layout; ~300-table design target; no canvas overview   |

## Import and parsing

| ADR                                                                                                                     | Decision                                             |
| ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [012](development/ARCHITECTURE.md#adr-012--hand-written-tolerant-ddl-parser-instead-of-node-sql-parser-2026-11-13)      | Hand-written tolerant DDL parser                     |
| [013](development/ARCHITECTURE.md#adr-013--hand-written-prisma-schema-parser-instead-of-mrleeboprisma-ast-2026-11-16)   | Hand-written Prisma parser                           |
| [014](development/ARCHITECTURE.md#adr-014--import-dialog-lazy-parsers-on-the-main-thread-no-web-worker-2026-11-16)      | Import dialog: lazy parsers on the main thread       |
| [019](development/ARCHITECTURE.md#adr-019--real-world-dumps-partitions-folded-schema-qualified-names-2026-11-16-p2-t10) | Real-world dumps: partitions folded, qualified names |

## Panels, search and inspector

| ADR                                                                                                              | Decision                                               |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [015](development/ARCHITECTURE.md#adr-015--issues-panel-docked-under-the-canvas-errors-open-it-2026-11-16)       | Issues panel docked under the canvas; errors open it   |
| [016](development/ARCHITECTURE.md#adr-016--own-search-palette-instead-of-shadcn-command--cmdk-2026-11-16)        | Own search palette instead of cmdk                     |
| [017](development/ARCHITECTURE.md#adr-017--inspector-three-tabs-explicit-vs-reading-navigation-2026-11-16)       | Inspector: three tabs, explicit vs. reading navigation |
| [021](development/ARCHITECTURE.md#adr-021--phone-table-list-sheet-enter-on-resize-separators-2026-11-16-p2-t10)  | Phone table-list sheet; Enter on resize separators     |
| [032](development/ARCHITECTURE.md#adr-032--focus-anchor-after-in-inspector-navigation-2026-11-20-p3-t08)         | Focus anchor after in-inspector navigation             |
| [034](development/ARCHITECTURE.md#adr-034--schema-health-checks-in-a-second-bottom-panel-tab-2026-11-21-p4-t01)  | Health checks in a second bottom-panel tab             |
| [035](development/ARCHITECTURE.md#adr-035--path-finder-in-an-inspector-tab-2026-11-23-p4-t02)                    | Path finder in an inspector tab                        |
| [036](development/ARCHITECTURE.md#adr-036--subject-areas-derived-and-hidden-on-the-canvas-2026-11-23-p4-t03)     | Subject areas derived and hidden on the canvas         |
| [037](development/ARCHITECTURE.md#adr-037--commands-in-the-own-palette-and-one-shortcut-table-2026-11-23-p4-t04) | Commands in the own palette and one shortcut table     |

## Export, persistence and robustness

| ADR                                                                                                                                       | Decision                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [020](development/ARCHITECTURE.md#adr-020--error-boundaries-per-region-app-level-error-pages-build-time-qa-hooks-2026-11-16-p2-t10)       | Error boundary per region; app error pages; build-time hooks   |
| [025](development/ARCHITECTURE.md#adr-025--layout-persistence-per-fingerprint-localstorage-keys-2026-11-19-p3-t01)                        | Layout persistence: per-fingerprint localStorage keys          |
| [027](development/ARCHITECTURE.md#adr-027--image-export-own-svg-renderer-instead-of-html-to-image-2026-11-19-p3-t03)                      | Image export: own SVG renderer                                 |
| [028](development/ARCHITECTURE.md#adr-028--text-generators-sql-prisma-mermaid-json-with-warnings-and-fixed-point-tests-2026-11-19-p3-t04) | Text generators with warnings and fixed-point tests            |
| [029](development/ARCHITECTURE.md#adr-029--one-export-dialog-with-tabs-preview-and-stale-safe-generation-2026-11-19-p3-t05)               | One Export dialog with tabs, preview and stale-safe generation |
| [030](development/ARCHITECTURE.md#adr-030--session-restore-indexeddb-source-text-re-parsed-on-load-2026-11-19-p3-t06)                     | Session restore: IndexedDB source text, re-parsed on load      |
| [033](development/ARCHITECTURE.md#adr-033--postgresql-expressions-in-mysql-and-sqlite-exports-2026-11-20-bb-p3)                           | PostgreSQL expressions in MySQL and SQLite exports             |

## Performance, testing and accessibility

| ADR                                                                                                                                                             | Decision                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [022](development/ARCHITECTURE.md#adr-022--large-schema-frame-costs-2026-11-16-p2-t10)                                                                          | Large-schema frame costs                                                  |
| [023](development/ARCHITECTURE.md#adr-023--real-input-selection-costs-lighter-zoomed-out-canvas-edge-dimming-packed-layout-deferred-2026-11-19-p2-t10-round-12) | Real-input selection costs, lighter zoomed-out canvas (superseded by 031) |
| [024](development/ARCHITECTURE.md#adr-024--committed-playwright-e2e-suite-2026-11-19-e2e-01)                                                                    | Committed Playwright e2e suite                                            |
| [038](development/ARCHITECTURE.md#adr-038--accessibility-audit-with-axe-2026-11-24-p4-t06)                                                                      | Accessibility audit with axe                                              |
