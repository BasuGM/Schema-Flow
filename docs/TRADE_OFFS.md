# Trade-offs

One table per major choice: what I gained, what it costs, and when I would revisit it. The
reasoning behind each is in the linked ADR. For the cross-cutting view (performance vs.
maintainability vs. scope), see [TRADE_OFF_ANALYSIS](TRADE_OFF_ANALYSIS.md).

Figures are from the ADRs at `72bb28c` (2026-11-24); the machine for all timings is a MacBook Air M1.

## No backend, everything in the browser

[ADR-002](development/ARCHITECTURE.md#adr-002--static-export-cache-components-disabled-2026-11-13)

| Gains                                                          | Costs                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| Schema text never leaves the machine; nothing to secure or run | No sharing links, accounts, sync or collaboration      |
| Static `out/` folder; any file server can host it              | No server actions, route handlers or request-time APIs |
| No hosting cost, no uptime, no data-protection duties          | Heavy work (parse, layout) competes with the UI thread |

Revisit if sharing or team features became a goal. That is a different product.

## Hand-written SQL and Prisma parsers

[ADR-012](development/ARCHITECTURE.md#adr-012--hand-written-tolerant-ddl-parser-instead-of-node-sql-parser-2026-11-13),
[ADR-013](development/ARCHITECTURE.md#adr-013--hand-written-prisma-schema-parser-instead-of-mrleeboprisma-ast-2026-11-16)

| Gains                                                                                                                                                                                | Costs                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Tolerant: a bad statement becomes a line-numbered warning, not a lost import                                                                                                         | I own correctness, including odd dialect corners                  |
| No 200–300 KB dialect bundles (the SQL parser is about 1,190 code lines; node-sql-parser rejected whole pg_dump tables on enum types, identity columns and column-less `REFERENCES`) | Not a full SQL grammar: only DDL that affects the diagram is read |
| Issues carry line numbers and table names, so they link to source excerpts and the canvas                                                                                            | Needs fixtures, robustness tests and real-world dumps to trust it |

Revisit if a dialect feature keeps showing up in real dumps that the tolerant parser skips.

## Parsing on the main thread, no Web Worker

[ADR-014](development/ARCHITECTURE.md#adr-014--import-dialog-lazy-parsers-on-the-main-thread-no-web-worker-2026-11-16)

| Gains                                                        | Costs                                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| No message protocol, second bundle entry or jsdom test gap   | A very large file blocks the page while it parses                                  |
| Parsers load lazily: about 12 KB gzip, not in the first load | The 5 MB cap is a hard limit, not a streaming solution                             |
| Measured cost is small: about 1 MB of SQL in 99–144 ms       | The layout, not the parse, is the larger cost, and it also runs on the main thread |

Revisit if real files approach the 5 MB cap and parsing becomes noticeable.

## Own search palette and export renderer

[ADR-016](development/ARCHITECTURE.md#adr-016--own-search-palette-instead-of-shadcn-command--cmdk-2026-11-16),
[ADR-027](development/ARCHITECTURE.md#adr-027--image-export-own-svg-renderer-instead-of-html-to-image-2026-11-19-p3-t03)

| Gains                                                                               | Costs                                          |
| ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| Fewer dependencies; windowed result list and `table.column` ranking that cmdk lacks | More code to maintain and test                 |
| The export is drawn from the `Schema`, so it is independent of what is on screen    | Must keep the SVG look in step with the canvas |

## Dagre layout, with a packed variant for large shallow schemas

[ADR-010](development/ARCHITECTURE.md#adr-010--use-dagres-edge-routes-for-long-edges-2026-11-13-qa-001),
[ADR-031](development/ARCHITECTURE.md#adr-031--packed-layout-300-table-design-target-no-canvas-overview-2026-11-20-p3-t07)

| Gains                                                                                | Costs                                                     |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Deterministic, readable layered layout in about 180 ms for 200 tables                | Dagre runs synchronously on the main thread               |
| Packed layout turns a 3,904 × 242,359 px GitLab layout into about 20,480 × 17,688 px | A packed 992-table view is slow by design; target is ~300 |
| Reusing Dagre's own edge routes fixed edges crossing tables (QA-001)                 | Layout quality is Dagre's, with no custom router          |

## Persisting to the browser (localStorage and IndexedDB)

[ADR-025](development/ARCHITECTURE.md#adr-025--layout-persistence-per-fingerprint-localstorage-keys-2026-11-19-p3-t01),
[ADR-030](development/ARCHITECTURE.md#adr-030--session-restore-indexeddb-source-text-re-parsed-on-load-2026-11-19-p3-t06)

| Gains                                                                   | Costs                                                                       |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Reload brings back the diagram, positions, view and selection           | The import text stays on the device until the user clears it                |
| Re-parsing the saved text means parser fixes apply and issues come back | Restore takes about an import's time (about 3 s for 992 tables)             |
| Layouts keyed by schema fingerprint: no schema id to manage             | Adding or removing a table changes the fingerprint, so positions reset      |
|                                                                         | Several tabs: last write wins, with a best-effort stop via BroadcastChannel |

## Derived analysis instead of stored or editable data

[ADR-034](development/ARCHITECTURE.md#adr-034--schema-health-checks-in-a-second-bottom-panel-tab-2026-11-21-p4-t01),
[ADR-035](development/ARCHITECTURE.md#adr-035--path-finder-in-an-inspector-tab-2026-11-23-p4-t02),
[ADR-036](development/ARCHITECTURE.md#adr-036--subject-areas-derived-and-hidden-on-the-canvas-2026-11-23-p4-t03)

| Gains                                                                           | Costs                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Health checks, paths and areas are pure functions of the `Schema`: easy to test | Subject areas cannot be edited or saved; session only  |
| No new state to persist or migrate                                              | The path finder shows one shortest path, not all paths |
| No new toolbar buttons (the toolbar has to fit 390 px)                          | Hiding an area leaves gaps instead of relaying out     |

## Own tooling for verification

[ADR-024](development/ARCHITECTURE.md#adr-024--committed-playwright-e2e-suite-2026-11-19-e2e-01),
[ADR-038](development/ARCHITECTURE.md#adr-038--accessibility-audit-with-axe-2026-11-24-p4-t06)

| Gains                                                           | Costs                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| Repeatable real-input checks and automated contrast/name checks | E2E is outside `npm run check` and needs a served build |
| Two dev-only dependencies (Playwright, axe)                     | Chromium only; no Safari or Firefox runs                |
