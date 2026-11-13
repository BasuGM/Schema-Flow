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
