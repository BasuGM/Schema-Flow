# Verification

Acceptance criteria per task (`AC-<task>-<n>`), how each is covered automatically, and what needs
manual/browser verification by Claude Cowork. "Auto" = covered by `npm run test`; "Manual" = needs a
browser check.

## Reference values — e-commerce sample (default on `/`)

Asserted in `src/samples/ecommerce.test.ts`.

| Metric                         | Value                                          |
| ------------------------------ | ---------------------------------------------- |
| Tables                         | **12**                                         |
| Columns (total)                | **71**                                         |
| Relationships (edges)          | **13**                                         |
| One-to-one relationships       | **1** (`payments.order_id → orders.id`)        |
| Self-referencing relationships | **1** (`categories.parent_id → categories.id`) |
| Enums                          | **2** (`order_status`, `payment_method`)       |
| Check constraints              | **5**                                          |
| Import / validation issues     | **0**                                          |

Per table (column count · outgoing FKs · incoming FKs):

| Table              | Cols | Out | In  | Notes                                      |
| ------------------ | ---- | --- | --- | ------------------------------------------ |
| users              | 7    | 0   | 3   | `email` unique                             |
| addresses          | 8    | 1   | 1   |                                            |
| categories         | 4    | 1   | 2   | self-reference counts as both out and in   |
| products           | 9    | 0   | 3   | `tags text[]`, 2 checks                    |
| product_categories | 2    | 2   | 0   | composite PK (`product_id`, `category_id`) |
| coupons            | 6    | 0   | 1   |                                            |
| orders             | 7    | 3   | 3   | `status order_status`                      |
| order_items        | 5    | 2   | 0   | composite PK (`order_id`, `line_no`)       |
| payments           | 6    | 1   | 0   | 1:1 to `orders`                            |
| shipments          | 6    | 1   | 0   |                                            |
| reviews            | 6    | 2   | 0   | composite unique (`product_id`, `user_id`) |
| audit_log          | 5    | 0   | 0   | no PK, no relationships                    |

Synthetic sample: `/?sample=synthetic&tables=200` → exactly 200 tables named `table_0001` …
`table_0200`; deterministic for a given `seed` (default 1).

## P1-T01 — Inspect & scaffold

- AC-P1-T01-1: `npm run typecheck`, `lint`, `test`, `build` and `check` exist and pass. _Auto (CI-style run)_
- AC-P1-T01-2: TypeScript `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride` enabled. _Inspect `tsconfig.json`_
- AC-P1-T01-3: `npm run build` produces a static export in `out/`. _Manual (shell)_
- AC-P1-T01-4: Git repository initialized with an initial commit. _Manual (shell)_

## P1-T02 — Documentation & agent rules

- AC-P1-T02-1: `CLAUDE.md` lists commands, boundaries, conventions, handoff and honesty rules.
- AC-P1-T02-2: `docs/development/` has ROADMAP, ARCHITECTURE, VERIFICATION, QA_LOG, handoffs/.
- AC-P1-T02-3: ROADMAP lists all four phases with task IDs and uses only the allowed statuses.

## P1-T03 — Domain model

Covered by `src/domain/schema/*.test.ts`.

- AC-P1-T03-1: Composite primary and foreign keys normalize with ordered column IDs. _Auto_
- AC-P1-T03-2: Self-referencing FKs produce a relationship whose `from`/`to` table are equal. _Auto_
- AC-P1-T03-3: Unresolved tables/columns become `warning` issues; nothing throws. _Auto_
- AC-P1-T03-4: One-to-one is inferred when FK columns equal the PK, a unique constraint or a unique index; composite unique containing extra columns stays many-to-one. _Auto_
- AC-P1-T03-5: Table/column lookup is case-insensitive; case-only duplicates are reported. _Auto_
- AC-P1-T03-6: `validateSchema` reports each broken invariant and returns `[]` for normalized schemas. _Auto_
- AC-P1-T03-7: `fingerprintSchema` ignores order/types/case and changes when tables/columns change. _Auto_
- AC-P1-T03-8: `getNeighbors` follows both directions to the given depth and excludes the start table. _Auto_

## P1-T04 — Sample schemas

- AC-P1-T04-1: The e-commerce sample has zero import and validation issues. _Auto_
- AC-P1-T04-2: Counts match the reference table above. _Auto_; _Manual: sidebar shows 12 tables_
- AC-P1-T04-3: `/?sample=synthetic&tables=200` yields 200 valid tables; deterministic per seed. _Auto_; _Manual: page loads_

## P1-T05 — Graph transform & layout

- AC-P1-T05-1: One node per table (declaration order) and one edge per relationship. _Auto_
- AC-P1-T05-2: Edge handles are `source:<fkColumnId>` / `target:<referencedColumnId>`. _Auto_
- AC-P1-T05-3: The self-reference edge is flagged `selfReference: true`. _Auto_
- AC-P1-T05-4: Dagre layout is deterministic, non-overlapping, and places referenced tables left (LR) / above (TB). _Auto_
- AC-P1-T05-5: 200-table layout completes well under 5 s (measured ~180 ms in Node). _Auto_

## P1-T06 — App shell

- AC-P1-T06-1: Toolbar shows the logo mark, "SchemaFlow", the schema name `E-commerce sample` and a `12 tables` badge. _Auto (toolbar test)_; _Manual_
- AC-P1-T06-2: Import and Export are visibly disabled (`aria-disabled="true"`) and their tooltips read "Import is coming in Phase 2" / "Export is coming in Phase 3". _Auto_; _Manual_
- AC-P1-T06-3: Theme menu switches Light / Dark / System; the choice survives reload (next-themes localStorage) with no flash of the wrong theme and no hydration warning. _Auto (switching)_; _Manual (flash, reload)_
- AC-P1-T06-4: Three panels (table list · canvas · inspector) are resizable by dragging the separators; side panels have min/max widths and can collapse fully. _Manual_
- AC-P1-T06-5: Toolbar buttons `toolbar-toggle-left` / `toolbar-toggle-right` hide and show the side panels and expose `aria-pressed`. _Auto (state)_; _Manual (layout)_
- AC-P1-T06-6: At viewport widths ≤ 900 px both side panels collapse automatically and the canvas fills the width; widening restores them. _Manual_
- AC-P1-T06-7: Inspector shows the empty state "Select a table to inspect it" when nothing is selected. _Auto_

## P1-T07 — Custom node & edge

- AC-P1-T07-1: Each table node (`table-node-<name>`) shows a header with the table name and column count, and one row per column with name and monospace type. _Auto_
- AC-P1-T07-2: Primary-key columns show a key icon, are bold and have a tinted row background. _Auto (icon)_; _Manual (visual)_
- AC-P1-T07-3: Foreign-key columns show a link icon. _Auto_
- AC-P1-T07-4: Nullable columns show a muted "null" marker after the type. _Auto_
- AC-P1-T07-5: Every column row has a source handle (left) and target handle (right); edges attach to the exact FK row and referenced row (e.g. `orders.user_id` row → `users.id` row). _Auto (handles)_; _Manual (visual alignment)_
- AC-P1-T07-6: Edges show cardinality markers: `N` at the FK end and `1` at the referenced end; `payments → orders` shows `1` at both ends. _Manual_
- AC-P1-T07-7: `categories.parent_id → categories.id` renders as a loop on the left side of the `categories` node. _Manual_
- AC-P1-T07-8: Hovering an edge shows a native tooltip `<name · >from.col → to.col`; edges connected to the selected table are highlighted in the accent colour and show that label on the canvas. _Auto (label text)_; _Manual_
- AC-P1-T07-9: No edge is animated. _Manual_
- AC-P1-T07-10: Nodes are reachable with Tab, have an accessible name ("Table users, 7 columns") and show a visible focus ring. _Auto (tabindex, aria-label)_; _Manual (ring)_

## P1-T08 — Canvas interactions & basic inspector

- AC-P1-T08-1: Clicking a table in the list selects it, centers the canvas on that node and highlights it (accent ring, tinted header); the list item is highlighted (`aria-current="true"`). _Auto (selection)_; _Manual (centering)_
- AC-P1-T08-2: Clicking a node selects it; list and inspector update. _Auto_
- AC-P1-T08-3: Clicking empty canvas clears the selection; inspector returns to the empty state. Escape also clears. _Auto_
- AC-P1-T08-4: With a node focused, Enter (or Space) selects it. _Auto_
- AC-P1-T08-5: Inspector shows table name, schema (`schema public`), comment if any, counts (columns / outgoing / incoming — must match the reference table) and the column list with PK / FK / UQ / NULL badges. _Auto (orders)_; _Manual (others)_
  **Revised 2026-11-16 (P2-T08, intentional):** the schema line is hidden when it is the source default (`public` on PostgreSQL; none on MySQL / SQLite / Prisma without `@@schema`), so the sample shows no schema line; `billing.invoices` shows "schema billing". The column list moved into the Columns tab.
- AC-P1-T08-6: Controls (bottom-left) zoom in/out and fit the view; "Reset view" (`canvas-reset-view`, top-right) fits the whole diagram (max zoom 100%). _Manual_
- AC-P1-T08-7: Toolbar "Layout" (`toolbar-layout`) re-runs Dagre, discarding manual positions, then fits the view. _Auto (store)_; _Manual_
- AC-P1-T08-8: Settings → "Show minimap" toggles a minimap (bottom-right); it is off by default. _Manual_
- AC-P1-T08-9: Dragging a node moves it and its edges; the position is kept while the page is open (until "Layout"). Not persisted across reloads (Phase 3). _Manual_
- AC-P1-T08-10: Table list filter narrows by name (case-insensitive), shows "n / 12", and shows "No tables match …" when empty. _Auto_

## P1-T09 — Hardening

- AC-P1-T09-1: `/?sample=synthetic&tables=200` loads 200 tables; pan, zoom and drag remain responsive (no multi-second freezes). _Manual_
- AC-P1-T09-2: Above 80 tables, `onlyRenderVisibleElements` is on: at the fitted zoom of the 200-table sample fewer than 200 node elements are in the DOM. _Verified by Claude Code via headless DOM dump: 143 of 200_; _Manual (DevTools Elements)_
- AC-P1-T09-3: No console errors or warnings in normal use in dev or production (benign: React DevTools suggestion, `[HMR] connected`). _Checked by Claude Code in headless Chrome (load only, no interaction)_; _Manual (with interaction)_
- AC-P1-T09-4: Keyboard: Tab reaches toolbar buttons, filter, list items, canvas nodes, controls, inspector close; focus is always visible. _Manual_
- AC-P1-T09-5: Text contrast is adequate in both themes (muted text ≥ 4.5:1 on its background). _Manual (DevTools / Lighthouse)_
- AC-P1-T09-6: With `prefers-reduced-motion: reduce`, centering / fit view jump instantly instead of animating. _Manual_
- AC-P1-T09-7: `npm run build` succeeds and `npm run start` serves the static export at http://localhost:3000 with the same behaviour. _Manual (shell)_

### Re-render profiling (manual, optional)

React DevTools → Profiler → enable "Highlight updates when components render":
selecting a table should flash only the old/new selected nodes, their connected edges, the two list
items and the inspector. Panning/zooming should not flash any table node.

## Fixes for Cowork defects (2026-11-13)

These criteria add to or replace the originals; the original wording is kept above for history.

- AC-P1-T07-11 (QA-001): With the default layout, no relationship line passes behind a table it
  doesn't connect. In particular, `orders.user_id → users.id` and `reviews.user_id → users.id`
  route around `addresses`/`coupons`/`products`. After you drag either end table, that edge falls
  back to a direct step path; "Layout" restores the routed version.
  _Auto (`layout-dagre.test.ts` samples every routed curve against all node boxes;
  `selection-sync.test.tsx` checks the rendered path)_; _Manual_
- AC-P1-T07-8 (revised, QA-002): Edges touching the selected table show a compact label
  (`user_id → users.id`) just outside the FK row, drawn **above** nodes and never clipped. Labels of
  different relationships don't overlap. The hover tooltip still shows the full text, including
  the constraint name (`orders_user_fk · orders.user_id → users.id`).
  _Auto (label text and anchor)_; _Manual_
- AC-P1-T08-3 (revised, QA-003): Escape clears the selection wherever focus is: canvas, node,
  table list item, inspector, toolbar button. Exceptions: inside the filter input, and while a
  menu is open (Escape closes the menu first). _Auto_; _Manual_
- AC-P1-T08-11 (observation): Inspector column rows use two lines: name and badges, then the
  monospace type underneath. Long names such as `shipping_address_id` and types such as
  `varchar(128)` are readable at the default 300 px width. _Manual_

## Fixes for Cowork round 2 (2026-11-13)

- AC-P1-T07-8 (revised again, QA-004; supersedes both earlier versions): Selecting a table
  highlights its edges in the accent colour **without** labels. Hovering an edge shows one label
  with the full text (`orders_user_fk · orders.user_id → users.id`) next to its FK row, drawn above
  tables. Moving the pointer away hides it. Clicking an edge keeps its label until the empty canvas
  is clicked. At most one hover label is visible at a time. _Auto (`selection-sync.test.tsx`)_; _Manual_
- AC-P1-T07-12 (observation): All non-self edges use the same smooth curve style, routed or not. No
  edge in the default layout passes through an unrelated table. _Auto (every edge sampled in
  `layout-dagre.test.ts`)_; _Manual_
- AC-P1-T07-13: Each edge has an accessible name such as
  `Relationship orders_user_fk · orders.user_id → users.id`. _Auto_
- AC-P1-T09-6 (coverage note): reduced-motion behaviour is covered by a unit test
  (`use-canvas-commands.test.ts`). A headless Chrome run with forced reduced motion also showed the
  initial fit completing instantly (Claude Code observation, not independent verification).

## Phase 1 close-out (2026-11-13)

- AC-P1-T07-14 (QA-005): Hover and click edge labels keep a constant on-screen size (about 11 px
  text) at any zoom, including Reset-view zoom (about 0.35) and 0.05 on the 200-table sample. They
  stay anchored beside the FK row (12 px screen gap) and above tables.
  _Auto (`labelTransform` unit tests; integration test checks `scale(1/zoom)`)_; _Manual_
- AC-P1-T07-15: A clicked edge has a distinct **selected** style: a 3 px accent line with a soft 8 px
  halo. **Highlighted** edges (touching the selected table, or hovered) are a 2 px accent line, and
  default edges a 1.25 px grey line. Exposed as `data-edge-state="default|highlighted|selected"` on
  `data-testid="edge-<relationshipId>"`. _Auto_; _Manual_
- AC-P1-T08-12: Selecting a table by canvas click, list click or Enter on a focused node, including
  re-selecting the already-selected table, clears any clicked edge and its pinned label.
  _Auto (4 cases)_; _Manual_

## Fixes for Cowork round 4 (QA-006…008, 2026-11-16)

- AC-P1-T07-16 (QA-006): A hovered or clicked edge label is never clipped under a side panel or
  past the right edge of the canvas. When it would overflow, it is shifted horizontally so it sits
  at least 8 px inside the visible pane (repro: `categories` self-loop label after Fit view).
  _Auto (`labelOverflowShift` unit tests; jsdom cannot measure label width)_; _Manual_
- AC-P2-T01-4 (QA-007): A file starting with a UTF-8 byte-order mark imports normally; offsets and
  line numbers are unchanged. Fixture `bom.postgres.sql`: ok, 2 tables, 1 relationship, 1 warning
  (CREATE VIEW, **line 4**). _Auto_
- AC-P2-T03-4 (QA-008): A column with no type (bare name before `,` or `)`) is kept with an empty
  type, and each one gets a line-numbered warning. Fixture `typeless.sqlite.sql`: ok, 2 tables,
  6 columns, 1 relationship, 4 warnings (lines 2, 2, 5, 6). _Auto_

## Fixes for Cowork round 5 (QA-009 and the Escape decision, 2026-11-16)

- AC-P2-T01-5 (QA-009): U+FEFF anywhere in the input is whitespace: it neither joins a word nor
  breaks a statement. `CREATE TABLE a (id int);\n\uFEFFCREATE TABLE b (id int);` imports both
  tables with no issues. _Auto_
- AC-P1-T08-13: Escape (outside text inputs and menus) also unpins a clicked edge label and clears
  its selected style, whether or not a table is selected. Clicking empty canvas already did.
  _Auto (2 cases)_; _Manual_

### How to check the production build

1. Stop the dev server (only one server on port 3000).
2. `npm run build`: a static export to `out/`.
3. Serve `out/` with any static file server. The project's `npm run start` does exactly this, with
   `python3 -m http.server 3000 --directory out`. Open http://localhost:3000.
4. Afterwards stop it and run `npm run dev` again.

## P2-T01…T03 — SQL import core (pure logic, no UI)

Run `npx vitest run src/parsers` (67 tests since `12697ac`; 61 at `ca08df3`). Fixtures are in `tests/fixtures/sql/`.

| Fixture                   | Dialect    | ok        | Tables | Columns | Relationships     | Issues                                                                                                                                                                            |
| ------------------------- | ---------- | --------- | ------ | ------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ecommerce.postgres.sql`  | postgresql | true      | 12     | 71      | 13 (1 one-to-one) | 0. Identical to the built-in sample (same fingerprint, columns, keys, FK pairs)                                                                                                   |
| `shop.mysql.sql`          | mysql      | true      | 5      | 18      | 4 (1 one-to-one)  | 0                                                                                                                                                                                 |
| `blog.sqlite.sql`         | sqlite     | true      | 4      | 12      | 3                 | 1 summary warning (PRAGMA ×1)                                                                                                                                                     |
| `pgdump.postgres.sql`     | postgresql | true      | 3      | 14      | 3                 | 2 warnings: expression index (line 130); summary "Skipped 31 statements…"                                                                                                         |
| `edge-cases.postgres.sql` | postgresql | **false** | 3      | 10      | 2                 | 5 warnings (CREATE VIEW line 23; unparseable CREATE TABLE line 29; expression index line 31; summary of 3; FK to missing `ghosts` line 14) + 1 error (duplicate `USERS`, line 27) |

- AC-P2-T01-1: Semicolons inside strings, comments (including nested PG comments), quoted
  identifiers and `$tag$` bodies never split a statement; each statement knows its start line. _Auto_
- AC-P2-T01-2: Unterminated strings, comments or dollar quotes produce a warning, never an
  exception. _Auto_
- AC-P2-T01-3: `detectFormat` distinguishes SQL / Prisma / unknown and guesses the SQL dialect. _Auto_
- AC-P2-T02-1: The PostgreSQL e-commerce fixture imports to the same schema as the built-in sample. _Auto_
- AC-P2-T02-2: Enum columns (also schema-qualified), `GENERATED ALWAYS AS IDENTITY` and
  `REFERENCES t` without columns are supported. _Auto_
- AC-P2-T02-3: pg_dump output works: `ALTER TABLE ONLY … ADD CONSTRAINT` PK/UNIQUE/FK,
  `ALTER COLUMN … SET DEFAULT nextval(...)` → autoincrement, `ADD GENERATED … AS IDENTITY`. _Auto_
- AC-P2-T02-4: Irrelevant statements produce exactly **one** summary warning with per-kind counts;
  relevant-but-unhandled statements produce line-numbered warnings. _Auto_
- AC-P2-T02-5: One bad statement does not prevent the others from being imported; a duplicate
  table yields `ok: false` with the schema still present. _Auto_
- AC-P2-T03-1: MySQL and SQLite fixtures import with the counts above. _Auto_
- AC-P2-T03-2: `parseSql` never throws: 600 seeded truncations/corruptions of the fixtures plus
  400 random inputs, under 2 s. _Auto_
- AC-P2-T03-3: About 1 MB of DDL (500 tables, 0.96 MiB) parses in under 1.5 s. Measured 99–144 ms
  in Node on the M1, 3 warm runs. _Auto_

## P2-T04 — Prisma import (pure logic, no UI)

Run `npx vitest run src/parsers/prisma` (4 files, 20 tests). Fixtures are in
`tests/fixtures/prisma/`.

| Fixture             | Provider   | ok        | Tables                        | Columns | Relationships                        | Issues                                                           |
| ------------------- | ---------- | --------- | ----------------------------- | ------- | ------------------------------------ | ---------------------------------------------------------------- |
| `blog.prisma`       | postgresql | true      | 9 (incl. 2 implicit m:n join) | 31      | 11 (1 one-to-one, 4 prisma-implicit) | 1 warning: view `PostStats` skipped (line 98)                    |
| `shop.mysql.prisma` | mysql      | true      | 4                             | 14      | 3 (1 composite one-to-one)           | 0                                                                |
| `edge-cases.prisma` | postgresql | **false** | 3                             | 8       | 1                                    | 8 warnings + 1 error (duplicate table `public.Account`, line 33) |

- AC-P2-T04-1: `@map`/`@@map` give column and table names; relations resolve `fields`/`references`
  to the mapped column names, with `onDelete`/`onUpdate` and `map` as the key name. _Auto_
- AC-P2-T04-2: Implicit many-to-many relations (also self-relations) produce `_AToB`/`_Name` join
  tables with `origin: "implicit"`, columns `A`/`B` and two `prisma-implicit` relationships. _Auto_
- AC-P2-T04-3: `@id`/`@@id`, `@unique`/`@@unique`, `@@index`/`@@fulltext`, `@default` kinds,
  `?` nullability, scalar lists, enums (with `@map`/`@@map`), native `@db.*` types and `///` doc
  comments are mapped. _Auto_
- AC-P2-T04-4: A bad line, unknown block, unterminated string or missing `}` is skipped with a
  line-numbered warning; the rest imports (an unclosed `(` doesn't swallow the following fields).
  _Auto_
- AC-P2-T04-5: `parsePrisma` never throws: 360 seeded truncations/corruptions of the fixtures plus
  400 random inputs, under 2 s. A 500-model schema (0.63 MiB) parses in 57–118 ms in Node on the M1
  (4 runs; the test asserts < 1.5 s). _Auto_
- AC-P2-T04-6: No new dependency; `src/parsers` imports no React, `@xyflow` or DOM APIs. _Auto (grep)_

### Fix for Cowork round 6 (QA-010, 2026-11-16)

- AC-P2-T04-7 (QA-010): An enum field's `@default(VALUE)` uses the value's stored `@map` name
  (`AUTHOR @map("author")` → default `author`), also inside list defaults; unmapped values are
  unchanged. _Auto_

## P2-T05 — Import dialog

Expected preview when each fixture is **chosen or dropped as a file**, with Format left on Auto
(`.prisma` files pre-select Prisma). Status, counts, issue summary and button text are exact
(`import-status`, `import-counts`, `import-issue-summary`, `import-confirm`); the schema name is
shown in the toolbar after import.

| Fixture                       | Status                   | Counts                                              | Issues               | Button                    | Schema name         |
| ----------------------------- | ------------------------ | --------------------------------------------------- | -------------------- | ------------------------- | ------------------- |
| `sql/blog.sqlite.sql`         | Parsed as SQLite SQL     | 4 tables · 12 columns · 3 relationships             | 1 warning            | Import 4 tables           | blog.sqlite         |
| `sql/bom.postgres.sql`        | Parsed as PostgreSQL SQL | 2 tables · 3 columns · 1 relationship               | 1 warning            | Import 2 tables           | bom.postgres        |
| `sql/ecommerce.postgres.sql`  | Parsed as PostgreSQL SQL | 12 tables · 71 columns · 13 relationships · 2 enums | No issues            | Import 12 tables          | ecommerce.postgres  |
| `sql/edge-cases.postgres.sql` | Parsed as PostgreSQL SQL | 3 tables · 10 columns · 2 relationships             | 1 error · 5 warnings | Import 3 tables (1 error) | edge-cases.postgres |
| `sql/pgdump.postgres.sql`     | Parsed as PostgreSQL SQL | 3 tables · 14 columns · 3 relationships · 1 enum    | 2 warnings           | Import 3 tables           | pgdump.postgres     |
| `sql/shop.mysql.sql`          | Parsed as MySQL SQL      | 5 tables · 18 columns · 4 relationships             | No issues            | Import 5 tables           | shop.mysql          |
| `sql/typeless.sqlite.sql`     | Parsed as PostgreSQL SQL | 2 tables · 6 columns · 1 relationship               | 4 warnings           | Import 2 tables           | typeless.sqlite     |
| `sql/utf16le.postgres.sql`    | Parsed as PostgreSQL SQL | 2 tables · 4 columns · 1 relationship               | No issues            | Import 2 tables           | utf16le.postgres    |
| `prisma/blog.prisma`          | Parsed as Prisma schema  | 9 tables · 31 columns · 11 relationships · 1 enum   | 1 warning            | Import 9 tables           | blog                |
| `prisma/edge-cases.prisma`    | Parsed as Prisma schema  | 3 tables · 8 columns · 1 relationship               | 1 error · 8 warnings | Import 3 tables (1 error) | edge-cases          |
| `prisma/shop.mysql.prisma`    | Parsed as Prisma schema  | 4 tables · 14 columns · 3 relationships · 1 enum    | No issues            | Import 4 tables           | shop.mysql          |

Pasting the same text gives the same preview, but the schema name is "Pasted SQL" or "Pasted
Prisma schema". `typeless.sqlite.sql` has no SQLite-specific markers, so Auto detects PostgreSQL;
choosing SQLite gives the same counts.

- AC-P2-T05-1: Toolbar **Import** opens the dialog with focus in the textarea; the description says
  "Parsed in your browser. Nothing is uploaded or executed."; the footer says "This replaces the
  current diagram." _Auto_; _Manual_
- AC-P2-T05-2: Pasted text, a chosen file and a dropped file each produce the preview in the table
  above; a file is shown as a card (name, size, Remove) and never in the textarea; the picker has
  no `accept` filter. _Auto_; _Manual_
- AC-P2-T05-3: Changing **Format** re-parses immediately; Auto shows the detected format. _Auto_
- AC-P2-T05-4: UTF-16 files (BOM) import; gzip/zip files and files with NUL bytes show "This looks
  like a binary or compressed file."; files over 5 MB show "This file is N MB; the limit is 5.0 MB."
  and are not read. Import stays disabled in all three error cases. _Auto_; _Manual_
- AC-P2-T05-5: Import is enabled when at least one table was parsed, even with errors
  ("Import 3 tables (1 error)"); with no tables it is disabled. _Auto_
- AC-P2-T05-6: Import replaces the diagram, closes the dialog and resets it; the selection, pinned
  edge and table filter are cleared; the canvas fits the new schema. Importing the same file again
  reuses the stored layout (dragged positions are kept; `layout-store.version` unchanged). _Auto_;
  _Manual_
- AC-P2-T05-7: Cancel, Escape or the close button keep the draft (text or file, including typing
  that wasn't committed yet) and the canvas selection; reopening shows the draft. _Auto_; _Manual_
- AC-P2-T05-8: Pastes over 1 MB turn into a "Pasted text" card instead of staying in the textarea.
  _Auto_
- AC-P2-T05-9: The dialog fits 1280×720 and 390 px wide screens in light and dark themes: the
  footer stays visible and the middle section scrolls. _Manual (Claude Code captured headless
  screenshots; not independent verification)_
- AC-P2-T05-10: The parsers are not in the initial bundle (ADR-014 evidence). _Auto (build grep)_
- AC-P2-T01-6 (QA-011): Format detection finds DDL or Prisma models after a header longer than
  200,000 characters. _Auto_
- AC-P1-T06-8 (QA-012): At 390 px wide the toolbar fits without horizontal page overflow. _Manual_

### Fix for Cowork round 7 (QA-013, 2026-11-16)

- AC-P2-T01-7 (QA-013): Long runs of blank or whitespace-only lines don't freeze the tab. 5 MB of
  `\n` or of ` \n` goes through `parseSchemaText` (Auto, SQL and Prisma, with and without a
  leading table) in under 1 s each: measured 17–135 ms. The reported repro
  (`CREATE TABLE a (id int);` + 80,000 `\n`) is detected in 0 ms (16.5 s before). _Auto
  (`src/parsers/whitespace-performance.test.ts`; the repro and cast tests fail on the old code)_

## P2-T06 — Import issues panel

Expected rows after importing each fixture. The order is errors first, then by line, then issues
without a line. The excerpt is ±2 lines around the issue line, clamped to the file.

#### sql/edge-cases.postgres.sql

| #   | Severity | Line badge | Message starts with                                           | Show table                   | Excerpt lines |
| --- | -------- | ---------- | ------------------------------------------------------------- | ---------------------------- | ------------- |
| 1   | Error    | line 27    | Duplicate table "public.USERS" (names are matched case-insen… | enabled → `public.users`     | 25–29         |
| 2   | Warning  | line 14    | Foreign key on "invoices" references unknown table "ghosts".  | enabled → `billing.invoices` | 12–16         |
| 3   | Warning  | line 23    | Skipped unsupported statement: CREATE VIEW.                   | —                            | 21–25         |
| 4   | Warning  | line 29    | Could not parse CREATE TABLE: Expected referenced table near… | —                            | 27–31         |
| 5   | Warning  | line 31    | Skipped an index on expressions for "users".                  | enabled → `public.users`     | 29–32         |
| 6   | Warning  | —          | Skipped 3 statements not needed for the diagram: schemas ×1,… | —                            | — (no line)   |

#### sql/pgdump.postgres.sql

| #   | Severity | Line badge | Message starts with                                           | Show table                  | Excerpt lines |
| --- | -------- | ---------- | ------------------------------------------------------------- | --------------------------- | ------------- |
| 1   | Warning  | line 130   | Skipped an index on expressions for "projects".               | enabled → `public.projects` | 128–132       |
| 2   | Warning  | —          | Skipped 31 statements not needed for the diagram: SET ×11, S… | —                           | — (no line)   |

#### prisma/edge-cases.prisma

| #   | Severity | Line badge | Message starts with                                           | Show table                 | Excerpt lines |
| --- | -------- | ---------- | ------------------------------------------------------------- | -------------------------- | ------------- |
| 1   | Error    | line 33    | Duplicate table "public.Account" (names are matched case-ins… | enabled → `public.Account` | 31–35         |
| 2   | Warning  | line 11    | Could not parse a line in model "Account": Expected a value.… | enabled → `public.Account` | 9–13          |
| 3   | Warning  | line 13    | Relation "Account.wallet" references unknown field(s) Wallet… | enabled → `public.Account` | 11–15         |
| 4   | Warning  | line 15    | Unknown type "Ghost" on "Account.ghost"; kept as written.     | enabled → `public.Account` | 13–17         |
| 5   | Warning  | line 29    | Unknown block "modle Typo" was skipped.                       | —                          | 27–31         |
| 6   | Warning  | line 39    | Skipped view "Summary": views are not part of the diagram.    | —                          | 37–41         |
| 7   | Warning  | line 43    | Block "Wallet" is missing a closing "}".                      | enabled → `public.Wallet`  | 41–45         |
| 8   | Warning  | line 45    | Unterminated string.                                          | —                          | 43–46         |
| 9   | Warning  | line 45    | Could not parse a line in model "Wallet": Expected the end o… | enabled → `public.Wallet`  | 43–46         |

- AC-P2-T06-1: The toolbar **Issues** button shows the error and warning counts, with
  `aria-label` "Issues: 1 error, 5 warnings". It is disabled ("No import issues") when there are
  none and the panel is closed, e.g. for the sample. With 0 issues and the panel open it stays
  enabled, so the empty panel can be closed from the toolbar (Cowork round 8). _Auto_; _Manual_
- AC-P2-T06-2: An import with errors opens the panel. A warnings-only import leaves it as it is (a
  closed panel stays closed). A clean import doesn't close an open panel; it shows "No issues for
  this schema.". Escape doesn't close it. _Auto_; _Manual_
- AC-P2-T06-3: Rows are ordered as in the tables above, and the All / Errors / Warnings chips
  filter them (`aria-pressed`). _Auto_
- AC-P2-T06-4: Rows with a line toggle a source excerpt by click, Enter or Space (`aria-expanded`,
  `aria-controls`): ±2 lines with numbers, the issue line highlighted. Lines over 400 characters
  are cut with "… (N more characters)". _Auto_; _Manual_
- AC-P2-T06-5: **Show table** selects and centers the linked table, and clears a table-list
  filter that hides it. It is disabled ("Table not in the diagram") when the table isn't in the
  schema. _Auto_; _Manual_
- AC-P2-T06-6: **Copy** puts the sorted list on the clipboard as text. Without the Clipboard API
  it falls back to `execCommand`. If both fail, it shows "Copy failed — select the text manually."
  with a selectable text box. _Auto_
- AC-P2-T06-7: More than 500 issues render 500 at a time ("Show 500 more"). _Auto_
- AC-P2-T06-8: Opening, closing or resizing the panel doesn't change the canvas viewport. An
  import that opens the panel fits the diagram to the remaining canvas height. _Auto (jsdom can't
  resize, so partial)_; _Manual (Claude Code: identical transform after close and reopen in
  headless Chrome; not independent verification)_
- AC-P2-T06-9: Below 768 px the panel is a bottom sheet (about 60% height) over the canvas, with
  its own close button. The page has no horizontal overflow at 390 px. _Auto_; _Manual_
- AC-P2-T06-10: Severity is conveyed by icon and text (screen-reader "Error" / "Warning"), not
  colour alone. _Auto_
- AC-P2-T06-11: Setting the source text re-renders neither the toolbar nor the canvas
  (`Profiler`). _Auto_

### Fixes for Cowork round 8 (QA-014, QA-015, 2026-11-16)

- AC-P2-T06-12 (QA-014): At 390×844, importing `edge-cases.postgres.sql` opens the sheet and all
  tables are fitted into the canvas area **above** the sheet. **Reset view** with the sheet open
  does the same. Opening the sheet later by hand doesn't move the viewport. _Auto (padding rule:
  `use-canvas-commands.test.ts`)_; _Manual (Claude Code headless Chrome: table bottoms at 223–326
  px, sheet top at 366 px; not independent verification)_
- AC-P1-T06-9 (QA-015): After the Import dialog closes (Import, Cancel or Escape), focus is back
  on the Import button and its tooltip is **not** shown. Hovering it or tabbing to it still shows
  the tooltip. _Auto (`import-dialog.test.tsx`; fails without the fix)_; _Manual_

## P2-T07 — Search

Expected results (generated with `search()`, checked in the UI). Tables come first, then columns;
the order within each group is the ranking.

| Fixture                       | Query         | Expected rows, in order                                                                      |
| ----------------------------- | ------------- | -------------------------------------------------------------------------------------------- |
| sample (e-commerce)           | `user`        | table `users` · columns `addresses.user_id`, `orders.user_id`, `reviews.user_id` (4 results) |
| sample                        | `ord.user`    | column `orders.user_id` (1 result)                                                           |
| sample                        | `uid`         | columns `addresses.user_id`, `orders.user_id`, `reviews.user_id` (fuzzy; 3 results)          |
| sample                        | `zzzz`        | none: "No tables or columns match “zzzz”."                                                   |
| `prisma/blog.prisma`          | `authorId`    | columns `Comment.authorId`, `posts.author_id`                                                |
| `prisma/blog.prisma`          | `createdAt`   | column `users.created_at`                                                                    |
| `sql/edge-cases.postgres.sql` | `order lines` | table `Order Lines`                                                                          |
| `sql/edge-cases.postgres.sql` | `quoted`      | column `Order Lines.weird "quoted" col`                                                      |
| `sql/edge-cases.postgres.sql` | `billing.inv` | table `billing.invoices` (schema shown: not the default)                                     |

- AC-P2-T07-1: ⌘K / Ctrl+K (default prevented) and `/` open search; `/` in a text field types a
  slash. The toolbar **Search** button (`toolbar-search`) opens it and is disabled without a
  schema. Nothing opens over another dialog or menu. _Auto_; _Manual_
- AC-P2-T07-2: Results match the table above: tiers exact → prefix → segment → substring →
  fuzzy (3+ characters, segment-anchored), multi-word AND, dotted positional queries, camelCase
  vs snake_case, unusual names. Matched characters are highlighted. _Auto_; _Manual_
- AC-P2-T07-3: Each group shows at most 50 rows plus "+ N more … — keep typing to narrow"; an
  empty query lists the first 50 tables and "Type to search N tables and M columns"; no match
  shows "No tables or columns match “q”.". _Auto_; _Manual_
- AC-P2-T07-4: Keyboard: ↑/↓ wrap, Home/End, Enter chooses (ignored while an IME composes),
  Escape closes without clearing the selection. Combobox/listbox roles, `aria-activedescendant`,
  `aria-selected`, labelled groups, and a polite result count. _Auto_; _Manual_
- AC-P2-T07-5: Choosing a table selects and centers it and clears a table-list filter that hides
  it. Choosing a column also highlights its row (`data-highlighted`) and centers the canvas on
  that row, even in a long table; the highlight clears when the selection changes or on Escape.
  _Auto_; _Manual_
- AC-P2-T07-6: A new import or sample closes search and clears the highlight. _Auto_
- AC-P2-T07-7: On close, focus returns to where it was (or the Search button) without showing a
  tooltip. _Auto_; _Manual_
- AC-P2-T07-8: Typing stays responsive on 2,000 tables × 20 columns
  (`tests/fixtures/large/search-2000.postgres.sql`): each query under 30 ms in the test (index under
  150 ms). Opening search and typing don't re-render the canvas (`Profiler`). _Auto_; _Manual
  (Claude Code headless Chrome: 31–61 ms input → painted results; not independent verification)_
- AC-P2-T07-9: Below `sm`, Layout, Theme and Settings are in the **More** menu
  (`toolbar-more`), and the page is 390 px wide at 390×844 with the Issues counts showing
  (`node scripts/headless/toolbar-width.mjs`). _Auto (menu)_; _Manual_

## P2-T08 — Full inspector

Tab counts are Columns · Keys (primary key + unique + indexes + checks) · Relations (references +
referenced by; a self-reference counts in both).

| Fixture                       | Table              | Counts (C · K · R) | Notes                                                                                      |
| ----------------------------- | ------------------ | ------------------ | ------------------------------------------------------------------------------------------ |
| sample                        | `orders`           | 7 · 2 · 6          | index `orders_user_status_idx (user_id, status)`; `status` enum values; restrict/set null  |
| sample                        | `users`            | 7 · 2 · 3          | Referenced by: addresses (cascade), orders (restrict, `orders_user_fk`), reviews (cascade) |
| sample                        | `order_items`      | 5 · 2 · 2          | composite PK `order_items_pkey`: 1 `order_id`, 2 `line_no`; check `quantity > 0`           |
| sample                        | `products`         | 9 · 5 · 3          | PK, unique `sku`, index `products_name_idx`, checks price/stock                            |
| sample                        | `payments`         | 6 · 2 · 1          | References orders **1:1** (`payments_order_fk`)                                            |
| sample                        | `categories`       | 4 · 2 · 3          | self-reference `parent_id → categories.id` in both lists, marked "self"                    |
| sample                        | `audit_log`        | 5 · 0 · 0          | every Keys / Relations section shows its empty state                                       |
| `sql/edge-cases.postgres.sql` | `billing.invoices` | 4 · 1 · 1          | header "schema billing"                                                                    |
| `sql/edge-cases.postgres.sql` | `Order Lines`      | 4 · 1 · 1          | `LineID` auto-increment; `note` = `'it''s; fine'`; `weird "quoted" col`                    |
| `prisma/blog.prisma`          | `_CategoryToPost`  | 2 · 2 · 2          | "Implicit join table"; unique index `_CategoryToPost_AB_unique`; "Prisma implicit"         |
| `prisma/shop.mysql.prisma`    | `shipments`        | 3 · 2 · 1          | composite FK `(order_id, line_no) → order_lines.(order_id, line_no)`, 1:1                  |

- AC-P2-T08-1: The inspector has Columns · Keys · Relations tabs with the counts above; ←/→,
  Home/End move between tabs. The chosen tab stays when another table is selected; a new import
  resets it to Columns. Labels don't truncate at the minimum inspector width (240 px). _Auto_;
  _Manual_
- AC-P2-T08-2: Columns show type, default (identity/serial/AUTO_INCREMENT/`autoincrement()` →
  "auto-increment"; functions as written; string literals with their quotes; Prisma
  `dbgenerated("x")` → `x` with a "db" hint), FK target link, comment, and enum values (8, then
  "+N more"). _Auto_; _Manual_
- AC-P2-T08-3: Clicking a column row highlights it on the canvas and in the inspector
  (`aria-current`) and pans only when the row is off-screen. FK-target and key-section links
  select the target table, center on the row and show Columns. A search hit also switches to
  Columns. _Auto_; _Manual_
- AC-P2-T08-4: Keys lists the primary key (ordinals for composite keys), unique constraints,
  indexes (`unique` badge) and checks (long expressions: "Show more"), each with an empty state.
  _Auto_; _Manual_
- AC-P2-T08-5: Relations lists References and Referenced by with cardinality (N:1 / 1:1),
  ON DELETE / ON UPDATE when set, constraint names, "self" and "Prisma implicit" badges, and
  composite column pairs. The table name navigates there (highlighting the other end's column,
  staying on Relations); "Back to …" restores the previous table and the tab it was on. _Auto_;
  _Manual_
- AC-P2-T08-6: Columns, References and Referenced by render 100 rows at a time ("Show 100
  more"); a highlighted column beyond that is still shown. Selecting a 1,000-column table renders
  its first tab in under 50 ms (jsdom test). _Auto_; _Manual (Claude Code headless Chrome: 50–59
  ms click → painted; not independent verification)_
- AC-P2-T08-7: Below 768 px the inspector opens (toolbar toggle) as an overlay sheet over the
  canvas, with "Close inspector"; tabs don't truncate; lists scroll inside it; no horizontal page
  scroll; `toolbar-width.mjs` passes. _Auto_; _Manual_
- AC-P2-T08-8: Switching tabs and toggling details don't re-render the canvas (`Profiler`).
  _Auto_
- AC-P2-T07-10 (QA-016): Search has one polite live region (`search-live`), mounted while the
  dialog is open, whose text alone changes; the visible status and no-match message are separate
  and not live. _Auto (same DOM node asserted)_; _Manual_

## P2-T09 — Neighbourhood highlighting

Expected sets on the sample (12 tables). "In focus" = full opacity; every other table is dimmed.
An edge is dimmed when either end is dimmed.

| Selected     | Depth | In focus (besides the selected table)                       | Dimmed                                                                                            |
| ------------ | ----- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `orders`     | 1     | users, addresses, coupons, order_items, payments, shipments | categories, products, product_categories, reviews, audit_log                                      |
| `orders`     | 2     | + products, reviews                                         | categories, product_categories, audit_log                                                         |
| `users`      | 1     | addresses, orders, reviews                                  | categories, products, product_categories, coupons, order_items, payments, shipments, audit_log    |
| `users`      | 2     | + products, coupons, order_items, payments, shipments       | categories, product_categories, audit_log                                                         |
| `categories` | 1     | product_categories (the self-reference adds nothing)        | users, addresses, products, coupons, orders, order_items, payments, shipments, reviews, audit_log |
| `categories` | 2     | + products                                                  | users, addresses, coupons, orders, order_items, payments, shipments, reviews, audit_log           |
| `audit_log`  | 1 / 2 | none                                                        | all 11 other tables                                                                               |
| `payments`   | 1     | orders                                                      | the other 10                                                                                      |

- AC-P2-T09-1: With nothing selected, nothing is dimmed. Selecting a table (canvas, list, search,
  issues "Show table", inspector links, Relations, Back) dims exactly the tables outside the sets
  above, and the edges with a dimmed end. The selected table and a search or Relations target are
  never dimmed. _Auto_; _Manual_
- AC-P2-T09-2: Settings → "Highlight neighbours" (Off / 1 hop / 2 hops; default 1 hop;
  `settings-neighbourhood-0|1|2`) and the same group in the phone More menu
  (`more-neighbourhood-0|1|2`). Off dims nothing. **The depth is a setting:** it survives
  selections and new imports. Only the dimming (`focusSet`) is cleared, by Escape / pane click /
  "Clear selection" and by a new import or sample. Not persisted across reloads (P3-T01). _Auto_;
  _Manual_
- AC-P2-T09-3: Dimmed tables use per-theme opacity tokens: `--dim-node` 0.3 light / 0.4 dark,
  `--dim-edge` 0.15 / 0.25. Hovering or keyboard-focusing a dimmed table raises it to
  `--dim-node-hover` 0.7 / 0.75 without layout change; it stays clickable, draggable and
  selectable with Enter/Space. Dimmed tables stay recognisable in both themes. _Manual_
- AC-P2-T09-4: Hovering or clicking a dimmed edge shows its label and draws it at full opacity
  while the label shows. _Auto_; _Manual_
- AC-P2-T09-5: The fade is 150 ms; it is dropped with `prefers-reduced-motion` and above 300
  tables + relationships (`data-instant-dim` on `schema-canvas`). _Manual_
- AC-P2-T09-6: Performance: a 2-hop set on a 2,000-table schema with a 500-reference hub in
  under 5 ms (performance test). On `tests/fixtures/large/neighbourhood-2000.postgres.sql`,
  clicking `hub` on the canvas paints in under 100 ms. _Auto_; _Manual (Claude Code headless
  Chrome: 67–74 ms vs 52 ms with Off; not independent verification)_
- AC-P1-T06-10 (QA-017): A collapsed side panel (toolbar toggle, drag to 0 px, or the separator
  keyboard) has `inert` content: Tab never lands in it and its content is hidden from assistive
  technology. Re-expanding it restores focusability. If focus was inside when it collapsed
  (including the ≤ 900 px auto-collapse), focus moves to that panel's toolbar toggle, not
  `<body>`. Filter text and inspector state survive collapsing. _Auto_; _Manual_

### Verified ACs that dimming could affect (re-run)

Dimming at the default 1 hop changes how every selection looks. These verified ACs were re-run
(all tests pass) and are listed in the handoff for a visual re-check: AC-P1-T07-8 / AC-P1-T08-*
(selection ring and brand-coloured edges of the selected table), AC-P2-T06 "Show table",
AC-P2-T07 search reveal and centring, AC-P2-T08-3 / -5 (FK links, Relations navigation and Back).

## P2-T10 — Phase 2 hardening

### Real-world fixtures (`tests/fixtures/real/`)

Expected counts come from the source files; [SOURCES.md](../../tests/fixtures/real/SOURCES.md)
gives the commands to recount them. Issues are grouped by kind (names blanked).

| Fixture                         | Format detected | Tables                                       | Columns | Relationships     | Issues (all warnings)                                                                                                                                                   |
| ------------------------------- | --------------- | -------------------------------------------- | ------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gitlab-structure.postgres.sql` | PostgreSQL SQL  | 992 (+434 partitions folded into 19 parents) | 9982    | 1720              | 140: expression index ×120, CREATE VIEW ×15, EXCLUDE ×2, unsupported ALTER TABLE action ×1 (ENABLE ALWAYS TRIGGER), partitions folded ×1, skipped-statements summary ×1 |
| `sakila-schema.mysql.sql`       | MySQL SQL       | 16                                           | 90      | 22                | 8: CREATE VIEW ×7, skipped-statements summary ×1                                                                                                                        |
| `mysqldump-180.mysql.sql`       | MySQL SQL       | 180                                          | 1625    | 306 (9 composite) | 1: skipped-statements summary (DROP, LOCK/UNLOCK, INSERT)                                                                                                               |
| `large-200.prisma`              | Prisma schema   | 220 (200 models + 20 implicit join tables)   | 1692    | 354               | none                                                                                                                                                                    |

- AC-P2-T10-1: Each real fixture imports through the dialog with exactly the counts above (the
  dialog counts line shows tables · columns · relationships), no crash, and only the expected
  console lines (none during a normal import). GitLab's `issue_search_data` lists 64 partitions
  in the inspector ("Partitioned · 64 partitions folded in"). Tables outside the default schema
  show `schema.table` on the canvas, in the list and in their test IDs (e.g.
  `table-node-billing.invoices` in `sql/edge-cases.postgres.sql`); the list filter matches the
  qualified name. Generated fixtures match their generators byte for byte. _Auto_; _Manual_
- AC-P2-T10-2: Importing 150 or more tables shows "Laying out N tables…" on the Import button
  (disabled, Cancel disabled, dialog `aria-busy`) and paints it before the layout runs; smaller
  imports are unchanged. GitLab parse + layout + flow on the M1: ≈ 0.4 s + 2.5 s + 10 ms
  (performance test budgets 1.2 s / 7.5 s / 100 ms). _Auto_; _Manual_
- AC-P2-T10-3: In a QA build (`NEXT_PUBLIC_QA_HOOKS=1`), `schemaflowQa.crash(r)` for each region
  shows that region's fallback (`canvas-error`, `table-list-error`, `inspector-error`,
  `issues-error`, `search-error`, `import-error`) with "The <region> could not be displayed.",
  the message and Try again; the rest of the workspace keeps working. Try again while still
  crashing shows the fallback again without a loop; after `schemaflowQa.heal()` it recovers. A new
  import resets a failed panel region. In the inspector and issues sheets and both dialogs, Close
  and Escape close the sheet or dialog; focus moves to Try again when the region held it. Each
  crash logs exactly two console errors: React's `Error: QA hook: …` and
  `SchemaFlow: the <region> could not be displayed.` _Auto_; _Manual_
- AC-P2-T10-4: In the QA build, `crash("app")` shows `app-error` ("SchemaFlow hit an unexpected
  error.", Try again, Reload) and `crash("root")` shows `global-error`; Try again after `heal()`
  restores the workspace. The normal build contains no QA hook code (`schemaflowQa` is
  undefined). _Manual_
- AC-P2-T10-5: Below 768 px the table list opens as a sheet (`table-list-sheet`, ≤ 20 rem) with
  focus on the sheet, not a 0 px panel; `toolbar-toggle-left` has `aria-expanded` matching it.
  Picking a table closes the sheet, selects and centres the table, and leaves the inspector
  closed (the table is visible); focus returns to the toggle. Escape and "Close tables" close it
  without clearing the selection; the filter text survives. Opening one sheet closes the other.
  Widening past 768 px with the sheet open docks the list (focus on the toggle, no horizontal
  overflow). Light and dark; `toolbar-width.mjs` passes. _Auto_; _Manual_
- AC-P2-T10-6: Enter on "Resize table list", "Resize inspector" or "Resize issues panel" collapses
  that panel (content `inert`, toggle `aria-expanded="false"`) and Enter again restores its
  previous width (not the minimum); focus stays on the separator and `aria-valuenow` updates.
  Arrow keys, Home and End resize as before (AC-P1-T06-10). Exception, the issues separator (it is
  hidden once the panel closes): Enter closes the issues panel and focus moves to
  `toolbar-issues` (`aria-pressed="false"`), where Enter opens it again at its previous size
  (QA-021). _Auto_; _Manual_
- AC-P2-T10-7: Large-schema frame costs, measured with `node scripts/headless/large-schema-perf.mjs`
  on `neighbourhood-2000` with **real mouse input** (CDP pressed/released; QA-019) (development
  machine budgets, 1 hop, worst of 3): worst centring frame ≤ 100 ms **(met: 70–82 ms)**; panning
  at the fitted zoom with `hub` selected ≥ 45 fps **(met: 59)**; hub select / deselect from
  pointerdown to the next frame ≤ 40 ms **(not met: 50–53 / 66–142 ms, typical 34–66 ms; Off
  baseline 47–55 / 58–65 ms; ADR-022, ADR-023)**. Other machines compare 1 hop against their own
  Off baseline. For large schemas below zoom 0.3, `schema-canvas` has `data-zoomed-out` and each
  table's rows are one striped block (`skeleton-rows`, no `column-<name>` items), the header shows
  only the name, and edges have no cardinality markers or `edge-hit-*` target; at zoom ≥ 0.3 and
  for normal-sized schemas everything renders as before. _Auto_; _Manual_
- AC-P2-T10-8: README describes the current features, formats and limits (5 MB, parsed never
  executed, stays in the browser). _Manual_

**Revisions to verified behaviour (intentional, P2-T10):**

- AC-P2-T09-3 (dim tokens, round 12, ADR-023): a dimmed edge's `<g>` keeps `data-dimmed="true"` but
  its computed `opacity` is now 1; the same `--dim-edge` value (0.15 light / 0.25 dark) is applied
  as `stroke-opacity` and `fill-opacity` on its path and marker text. Tables still use `opacity`.
- Column handles (round 12): a row has a source handle only if an edge starts there and a target
  handle only if one arrives there; edges are unchanged.

- AC-P2-T08-7 (phone inspector sheet): Escape inside the sheet now closes it (ADR-021); it used to
  clear the selection and leave the sheet open.
- Canvas and list names: tables outside the default schema now read `billing.invoices` (was
  `invoices`) on the canvas and in the table list, with matching test IDs (ADR-019).
- MySQL: `/*!NNNNN … */` executable comments are now read as code, as MySQL does; statements made
  entirely of them are skipped silently, so `sql/shop.mysql.sql` still has no issues (ADR-019).

## E2E-01 — Playwright e2e suite

Tooling only (ADR-024; plan [plans/e2e-suite.md](plans/e2e-suite.md)). Specs in `tests/e2e/`:
import, issues, search, inspector, neighbourhood, panels, phone, error-regions.

- AC-E2E-01-1: `npm run e2e` against a served build: 123 passed, 0 failed, 20 skipped (120/0/20 before the two round-13 specs) (error-region
  tests skip without `E2E_QA_HOOKS=1`; one UTF-16 paste test skips). _Auto_
- AC-E2E-01-2: With `E2E_QA_HOOKS=1` against `out-qa/`, `error-regions.spec.ts`: 19 passed, 0 failed,
  1 skipped. _Auto_
- AC-E2E-01-3: A compact summary and `e2e-results.json` are produced; verified with a deliberately
  failing test, which was then removed. _Auto_
- AC-E2E-01-4: `npm run check` passes with e2e excluded (400 unit tests). _Auto_
- **Status: Verified** (Cowork round 13, `3fdd4c9`: 120 / 0 / 20 and 19 / 0 / 1). Two specs were
  added afterwards (QA-020 opacity, zoomed-out rendering): Claude Code ran them only.
- Revision (QA-023): import preview counts show thousands separators ("9,982 columns").

## BB-P2 — Phase 2 bug-bash

Charter: [plans/bug-bash-p2.md](plans/bug-bash-p2.md). Automated in `tests/e2e/bug-bash.spec.ts`.

- AC-BB-P2-1: A journey through search, import (SQL, Prisma, a 180-table schema), the issues panel,
  Show table, and 2-hop dimming logs no console errors or warnings in the normal build. _Auto_
- AC-BB-P2-2: At 390, 768, 900 and 1280 px, light and dark, the page has no horizontal overflow (also
  with Issues counts and the phone list sheet); resizing across the breakpoints keeps the selection.
  _Auto_
- AC-BB-P2-3: Focus is never left on `body` after closing the import dialog (Escape, Cancel),
  search, settings, the issues panel (Close), or the inspector (Clear selection). _Auto_
- AC-BB-P2-4 (QA-024): a file just over 5 MiB reads "This file is 5,242,881 bytes; the limit is
  5.0 MB." _Auto_
- **Status: Verified with known issues** (Cowork round 14, `021f867`); QA-027…029 → P3-T08.

## P3-T01 — Layout persistence

Automated in `tests/e2e/persistence.spec.ts` and unit tests (`layout-persistence`,
`layout-store-persistence`).

- AC-P3-T01-1: A dragged table keeps its position after a reload, without running auto-layout again.
  _Auto_
- AC-P3-T01-2: Re-importing the same file after a reload restores its dragged positions. _Auto_
- AC-P3-T01-3: Layout replaces the saved positions, and the reset survives a reload. _Auto_
- AC-P3-T01-4: The neighbourhood depth survives a reload; invalid saved values are ignored. _Auto_
- AC-P3-T01-5: With storage blocked (getter, `getItem` or `setItem` throwing) the app works and the
  console stays empty. _Auto_
- AC-P3-T01-6: A schema with a different fingerprint does not inherit saved positions; corrupt or
  partial data falls back to auto-layout; at most 20 layouts are kept (least recently used out). _Auto_

- **Status: Verified** (Cowork round 15 at `4ef042a`: e2e 144/0/20 on `out/`; AC-P3-T01-1…6 pass, including corrupt data, blocked storage and 390 px).

## P3-T02 — Per-table collapse modes

Automated in `tests/e2e/collapse.spec.ts` and unit tests (`layout-store-collapse`,
`collapse-mode-control`, `table-node`, `more-menu`). Plan: [plans/p3-t02.md](plans/p3-t02.md).

- AC-P3-T02-1: The inspector's "Show on canvas" control (All columns · Keys · Header only) sets the
  selected table's mode and the node updates at once. _Auto_
- AC-P3-T02-2: Keys shows only primary- and foreign-key columns, Header only shows no rows; the node
  count reads "visible / total" with an aria-label ("4 of 12 columns shown"); edges to hidden
  columns attach to the header. _Auto_
- AC-P3-T02-3: The node-header toggle cycles modes with the real mouse without selecting or moving
  the node; it is absent while zoomed out. _Auto_
- AC-P3-T02-4: Settings (and the phone More menu) → All tables sets every table's mode. _Auto_
- AC-P3-T02-5: Modes survive a reload; after Headers only → Show all columns, Layout leaves no
  overlapping nodes. _Auto_
- AC-P3-T02-6: The control is keyboard operable (arrows) with a visible focus ring and causes no
  horizontal overflow at 900/768 px; a search hit hidden by the mode is still revealed and
  highlighted. _Auto_ (focus ring: _Manual_)

- **Status: Verified with known issues** (Cowork round 16 at `bef3380`: e2e 149/0/20 on `out/`; AC-P3-T02-1…6 pass, including keyboard radios with 2 px focus ring, real-mouse chevron, reload persistence, no overflow at 900/768/390). Known issues: nodes overlap until Layout; first Headers-only on GitLab ~257 ms on M1.

## P3-T03 — Image export

Automated in `tests/e2e/export.spec.ts` and unit tests (`diagram-svg`, `raster-size`, `export-adapters`, `export-image-dialog`). Plan: [plans/p3-t03.md](plans/p3-t03.md).

- AC-P3-T03-1: Settings (and the phone More menu) → "Export image…" opens the dialog; it is disabled with no tables; closing it (Escape or Cancel) returns focus to the Settings / More button, never to the page body. _Auto_
- AC-P3-T03-2: The SVG contains every table at its saved position with its current collapse mode, and every relationship; names with `<`, `&`, quotes and control characters are escaped or stripped and the file parses as XML. _Auto_
- AC-P3-T03-3: The PNG is a valid image at the size line (1×) and twice that at 2×; Light, Dark and Current themes apply (background, card and text colours differ; the dark border keeps its alpha). _Auto_
- AC-P3-T03-4: Large schema (GitLab, 992 tables): the PNG scale is reduced with a visible note, SVG is unaffected, a busy state shows while exporting, nothing crashes. _Manual_ (perf script: `scripts/headless/export-perf.mjs`)
- AC-P3-T03-5: A rasterization failure shows an inline error, the dialog stays open and the app keeps working. _Auto_ (unit)
- AC-P3-T03-6: Every control is labelled and keyboard operable with a visible focus ring on its label; the dialog has no horizontal overflow at 390×844; the phone toolbar width is unchanged (`toolbar-width.mjs` PASS). _Auto_ (focus ring: _Manual_)

- **Status: Verified** (Cowork round 17 at `785a41c`: e2e 157/0/20 on `out/`; AC-P3-T03-1…6 pass. Sample: SVG 12 tables / 13 relationships at the canvas positions, PNG 1× 1592×1283 and 2× 3184×2566 = size line; Light/Dark differ, `<html>` class restored; odd names parse; focus returns to Settings / More; phone dialog 344 px, no overflow. GitLab: reduced 0.0675× note, busy state, SVG 992 tables / 1,720 relationships.) Not browser-tested: menu item disabled with no tables (jsdom only, accepted). Note: dialog options reset on each open; GitLab PNG is unreadably small (QA-018 → P3-T07).

