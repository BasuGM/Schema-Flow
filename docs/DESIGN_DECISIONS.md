# Design decisions

Ten decisions I would explain in an interview, in question-and-answer form. The index of every
decision is [TECHNICAL_DECISIONS](TECHNICAL_DECISIONS.md). Pros and cons tables:
[TRADE_OFFS](TRADE_OFFS.md). The full records are in
[development/ARCHITECTURE.md](development/ARCHITECTURE.md#decision-records). Stamped 2026-11-24.

## 1. Why is there no backend?

[ADR-002](development/ARCHITECTURE.md#adr-002--static-export-cache-components-disabled-2026-11-13)

Schema text can be sensitive, and nothing here needs a server. A static export means nothing to
host, secure or pay for. The cost is no sharing, no accounts and no sync. I would revisit only if
sharing became a goal, and that would be a different product.

## 2. Why a pure TypeScript core?

`src/domain`, `src/graph`, `src/parsers`, `src/analysis` and `src/generators` import no React,
Next or browser APIs. The normalized `Schema` is the single source of truth, and `schemaToFlow()`
derives the canvas data from it. This makes the logic cheap to test, and it keeps parsers and
canvas independent. See [ARCHITECTURE](ARCHITECTURE.md).

## 3. Why my own SQL and Prisma parsers?

[ADR-012](development/ARCHITECTURE.md#adr-012--hand-written-tolerant-ddl-parser-instead-of-node-sql-parser-2026-11-13),
[ADR-013](development/ARCHITECTURE.md#adr-013--hand-written-prisma-schema-parser-instead-of-mrleeboprisma-ast-2026-11-16)

The library I probed rejected whole tables on common `pg_dump` features. I chose tolerant parsing:
skip what I do not need, warn with a line number. I own correctness. Fixtures and robustness tests
carry that.

## 4. Why parse on the main thread, with no Web Worker?

[ADR-014](development/ARCHITECTURE.md#adr-014--import-dialog-lazy-parsers-on-the-main-thread-no-web-worker-2026-11-16)

I measured. About 1 MB of SQL parses in 99–144 ms. The parsers load lazily, about 12 KB gzip. A
worker would add a protocol and a second bundle, and it would not move the layout, which is the
bigger cost. The 5 MB cap is a hard limit, not a streaming design.

## 5. Why Dagre, plus a packed variant?

[ADR-010](development/ARCHITECTURE.md#adr-010--use-dagres-edge-routes-for-long-edges-2026-11-13-qa-001),
[ADR-031](development/ARCHITECTURE.md#adr-031--packed-layout-300-table-design-target-no-canvas-overview-2026-11-20-p3-t07)

Dagre gives a deterministic, readable layered layout, about 180 ms for 200 tables. Reusing its
edge routes fixed edges crossing tables. For large shallow schemas the layered layout is far too
tall, so a packed variant arranges the pieces toward a 16:10 shape. Small schemas are untouched.

## 6. Why one `Schema` and three stores?

[ADR-008](development/ARCHITECTURE.md#adr-008--node-selection-owned-by-ui-store-2026-11-13),
[ADR-009](development/ARCHITECTURE.md#adr-009--rebuilding-react-flow-nodes-only-on-layout-version-changes-2026-11-13)

Schema, layout and UI state change at different rates. Splitting them stops a selection from
rebuilding the nodes. React Flow nodes are rebuilt only when the layout "version" changes, because
subscribing to positions would rebuild every node after each drag.

## 7. Why my own export renderer and search palette?

[ADR-027](development/ARCHITECTURE.md#adr-027--image-export-own-svg-renderer-instead-of-html-to-image-2026-11-19-p3-t03),
[ADR-016](development/ARCHITECTURE.md#adr-016--own-search-palette-instead-of-shadcn-command--cmdk-2026-11-16)

A DOM snapshot would miss most of a large schema, because the canvas only renders what is in view.
So I draw the whole diagram from the `Schema` as SVG. For search, `cmdk` scores every item on every
keystroke and does not understand `table.column`. The cost is more code to maintain.

## 8. Why derive analysis instead of storing it?

[ADR-034](development/ARCHITECTURE.md#adr-034--schema-health-checks-in-a-second-bottom-panel-tab-2026-11-21-p4-t01),
[ADR-035](development/ARCHITECTURE.md#adr-035--path-finder-in-an-inspector-tab-2026-11-23-p4-t02),
[ADR-036](development/ARCHITECTURE.md#adr-036--subject-areas-derived-and-hidden-on-the-canvas-2026-11-23-p4-t03)

Health checks, paths and subject areas are pure functions of the `Schema`. They are easy to test,
and there is nothing new to save or migrate. The cost: areas cannot be edited, and the path finder
shows one shortest path. I also added no toolbar buttons, because the toolbar has to fit 390 px.

## 9. Why persist to the browser, and how?

[ADR-025](development/ARCHITECTURE.md#adr-025--layout-persistence-per-fingerprint-localstorage-keys-2026-11-19-p3-t01),
[ADR-030](development/ARCHITECTURE.md#adr-030--session-restore-indexeddb-source-text-re-parsed-on-load-2026-11-19-p3-t06)

A reload should bring the diagram back. Layouts are keyed by schema fingerprint in `localStorage`,
so there is no id to manage. The import text is stored in IndexedDB and re-parsed on load, so
parser fixes apply and issues come back. The cost: restore takes about an import's time, positions
reset when the schema changes, and the text stays on the device until the user clears it.

## 10. Why "uncertain means left out" in exports, and an honest verification loop?

[ADR-033](development/ARCHITECTURE.md#adr-033--postgresql-expressions-in-mysql-and-sqlite-exports-2026-11-20-bb-p3),
[ADR-024](development/ARCHITECTURE.md#adr-024--committed-playwright-e2e-suite-2026-11-19-e2e-01)

Two sides of one habit: never claim more than I know. An export drops what it cannot translate and
warns. The project never calls something verified unless a Cowork report was pasted in. The
e2e suite and the axe audit are committed, so anyone can rerun them. They need a built app and
cover Chromium only.
