### Claude Cowork Verification Handoff

**Tasks:** Phase 1 final — P1-T06 (app shell), P1-T07 (custom node & edge), P1-T08 (canvas
interactions & basic inspector), P1-T09 (hardening), plus browser checks for P1-T04 (sample counts).
The earlier internal tasks (P1-T01…T05) have their own handoff: `handoffs/P1-T01-T05.md`.

**Context.** SchemaFlow is a browser-only database schema explorer. It shows a database schema as
an interactive 2D entity-relationship diagram so developers can understand unfamiliar schemas.
Everything runs in the browser and no data is sent anywhere. Phase 1 delivers:

- a built-in 12-table e-commerce sample, loaded by default;
- a three-panel workspace: table list, React Flow canvas, inspector;
- custom table nodes and relationship edges;
- selection sync between the canvas, the list and the inspector;
- automatic Dagre layout, light/dark/system themes, and a 200-table synthetic sample for performance testing.

Import (SQL/Prisma) is Phase 2 and Export is Phase 3. Both buttons are intentionally disabled.

**Implementation summary / files**

- Stores: `src/stores/{schema-store,layout-store,ui-store}.ts`
- Canvas: `src/components/canvas/{schema-canvas,table-node,relationship-edge,canvas-error-boundary,use-canvas-commands}.tsx|ts`
- Workspace: `src/components/workspace/{workspace,toolbar,toolbar-button,theme-toggle,settings-menu,table-list,inspector,use-panel-sync,use-sample-loader}.tsx|ts`
- App: `src/app/{page,layout}.tsx`, `src/app/globals.css`, `src/components/app-providers.tsx`
- Tests: `src/components/**/*.test.tsx`, `src/stores/stores.test.ts`, `src/test/*`
- Docs: `docs/development/{ROADMAP,ARCHITECTURE,VERIFICATION,QA_LOG}.md`

**Environment**

- Project folder: `/Users/basavachethan/Documents/Focus/Claude-Code/Schema-Flow`
- Dev server: **http://localhost:3000**. It should already be running; if not, run `npm run dev`
  in the project root. Use Chrome at that URL.
- Production check (optional): `npm run build && npm run start` serves the static export on
  port 3000. Stop the dev server first, because both use port 3000.
- Cowork may run `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build` itself if
  it has shell access to the project folder.

**Acceptance criteria:** AC-P1-T04-2/3, AC-P1-T06-1…7, AC-P1-T07-1…10, AC-P1-T08-1…10,
AC-P1-T09-1…7 (full text in `docs/development/VERIFICATION.md`, including the per-table reference
table).

**Verification steps and expected results**

1. Open http://localhost:3000 in Chrome at about 1440×900.
   → Toolbar (`data-testid="toolbar"`) shows a blue logo mark, "SchemaFlow", "E-commerce sample"
   and a "12 tables" badge. The left list shows 12 tables in this order: users, addresses, categories,
   products, product_categories, coupons, orders, order_items, payments, shipments, reviews,
   audit_log. The canvas shows 12 table nodes, fitted to the view. The right panel reads "Select a
   table to inspect it" (`inspector-empty`). (AC-P1-T04-2, T06-1, T06-7)
2. Compare each list item's number with the column counts in VERIFICATION.md (users 7, addresses 8,
   categories 4, products 9, product_categories 2, coupons 6, orders 7, order_items 5, payments 6,
   shipments 6, reviews 6, audit_log 5). Tables with foreign keys show a small blue link icon;
   users, products, coupons and audit_log do not. (AC-P1-T04-2)
3. Count the edges on the canvas. → 13 connector lines. (AC-P1-T04-2)
4. Inspect the `orders` node (`table-node-orders`).
   → Header "orders" and "7". Rows id, user_id, shipping_address_id, coupon_id, status, total_cents,
   placed_at, each with a monospace type (`status` shows `order_status`). The `id` row has a key
   icon, bold text and a tinted background. user_id, shipping_address_id and coupon_id have link
   icons. shipping_address_id and coupon_id show "null". (AC-P1-T07-1…4)
5. Follow the edge from `orders.user_id`.
   → It leaves the left side of the `user_id` row and ends on the right side of the `users.id`
   row. It shows "N" near orders and "1" near users. Find `payments.order_id → orders.id`: it shows
   "1" at both ends. (AC-P1-T07-5, T07-6)
6. Look at `categories`. → A small loop on the node's left side connects the `parent_id` row back to
   the `id` row. (AC-P1-T07-7)
7. Hover any edge for about 1 second. → A native tooltip such as
   `orders_user_fk · orders.user_id → users.id` appears. No edge is animated. (AC-P1-T07-8, T07-9)
8. Click `orders` in the left list (`table-list-item-orders`).
   → The canvas smoothly centers on the `orders` node. The node gets a blue ring and a tinted header
   (`data-selected="true"`) and the list item is highlighted. The inspector header
   (`inspector-title`) reads "orders" with "schema public". The counts read Columns 7, Outgoing 3,
   Incoming 3. The six edges touching orders turn blue and show text labels. (AC-P1-T08-1, T08-5)
9. In the inspector, check the `user_id` row (FK badge), `id` (PK badge) and `coupon_id` (FK + NULL).
   Select `users` and check that `email` shows a UQ badge. (AC-P1-T08-5)
10. Click the `payments` node on the canvas.
    → The list highlights payments and the inspector shows payments: 6 columns, 1 outgoing,
    0 incoming. (AC-P1-T08-2)
11. Click an empty area of the canvas. → The selection clears and the inspector shows the empty
    state. Select a table again and press Escape → it clears. (AC-P1-T08-3)
12. Press Tab repeatedly from the toolbar into the canvas.
    → Focus moves visibly through the toolbar buttons, the filter box, the list items and then the
    table nodes (blue outline). A screen reader name such as "Table users, 7 columns" is exposed.
    Press Enter on a focused node → it becomes selected. (AC-P1-T07-10, T08-4, T09-4)
13. Drag the `coupons` node somewhere else. → It and its edge follow smoothly. Select another table
    and pan → coupons stays where you dropped it. (AC-P1-T08-9)
14. Click "Layout" (`toolbar-layout`). → The original automatic layout is restored (coupons returns)
    and the view re-fits. (AC-P1-T08-7)
15. Zoom in using the bottom-left controls. Click "Reset view" (top-right, `canvas-reset-view`).
    → The whole diagram fits the view at ≤ 100% zoom. The controls' fit-view button does the
    same. (AC-P1-T08-6)
16. Settings gear (`toolbar-settings`) → "Show minimap". → A minimap appears bottom-right. Toggle it
    off → it disappears. It is off after a reload. (AC-P1-T08-8)
17. Type `order` in the filter (`table-filter`). → Only orders and order_items remain and the count
    shows "2 / 12". Type `zzz` → "No tables match “zzz”." (`table-list-empty`). Clear it.
    (AC-P1-T08-10)
18. Hover Import and Export. → Both look disabled and the tooltips read "Import is coming in
    Phase 2" and "Export is coming in Phase 3". Clicking them does nothing. (AC-P1-T06-2)
19. Theme button (`toolbar-theme`) → Dark → the whole UI turns dark, including the canvas, nodes,
    controls and menus. Reload → it stays dark with no white flash. Switch to Light, then System.
    (AC-P1-T06-3)
20. Drag the two panel separators. → The panels resize within limits and the canvas adapts. Use
    the toolbar's left and right panel toggle buttons (`toolbar-toggle-left` / `-right`) → the
    panels collapse and expand. (AC-P1-T06-4, T06-5)
21. Narrow the window below 900 px. → Both side panels collapse and the canvas fills the width;
    nothing overlaps or overflows. Widen it again → the panels return. (AC-P1-T06-6)
22. Open http://localhost:3000/?sample=synthetic&tables=200.
    → The toolbar reads "Synthetic (200 tables, seed 1)" and the list counts 200 (`table_0001`…
    `table_0200`). Pan, zoom with the scroll wheel and drag a node: each should respond without
    multi-second freezes. Click `table_0150` in the list → the canvas centers on it. In DevTools
    Elements, count `.react-flow__node`: it should be fewer than 200 at the fitted zoom.
    (AC-P1-T04-3, T09-1, T09-2)
23. Optional: enable "Emulate CSS prefers-reduced-motion: reduce" in DevTools Rendering. → In
    steps 8 and 15 the view jumps instantly instead of animating. (AC-P1-T09-6)

**Edge cases to try:**

- Switch the theme while a table is selected.
- Resize the panels to their minimum.
- Collapse both panels, then select from the canvas.
- Pan and zoom rapidly on the 200-table sample.
- Click the same list item twice; it should re-center.
- Drag a node, then click "Layout".
- Click the edge labels area.
- Press Escape with nothing selected.
- Reload with `?sample=synthetic&tables=5000`; it should clamp to 1000 tables. Expect a slow initial layout but no crash.

**Console check:** keep DevTools Console open throughout. Expect no errors or warnings. Known benign
messages in dev: "Download the React DevTools…" and "[HMR] connected", plus the Next.js dev
indicator ("N" button, bottom-left).

**Potential failure cases to look for:**

- Edges attached to the wrong row, or to the header.
- Nodes overlapping after layout.
- Hydration warnings or a theme flash on reload.
- Selection highlight lagging, or not syncing between list, canvas and inspector.
- Sluggish drag on the 200-table sample.
- Panels breaking the layout at narrow widths.
- Disabled buttons doing something.
- Text that is hard to read in dark mode.

**Automated results (Claude Code, 2026-11-13):**

- `npm run check` passes: typecheck ✔, ESLint ✔ (0 problems), Vitest ✔ 17 files / 97 tests, `next build` ✔ (static export, route `/` ○ Static).
- Coverage: 88% statements overall; domain 96%, graph 93%, samples 100%, stores 97%.
- Headless Chrome (load only, no interaction), dev and production export, e-commerce and 200-table samples: no console errors or warnings.
  - E-commerce DOM: 12 nodes, 13 edges, 12 list items.
  - 200-table DOM: 143 of 200 nodes rendered (culling active), 200 list items.
- Light and dark screenshots looked correct.
- These checks did **not** exercise clicks, drags or keyboard input in a real browser. Those are covered only by jsdom tests and need Cowork.

**Known limitations:**

- Manual positions are lost on reload; persistence comes in Phase 3.
- The 200-table synthetic layout is very tall and narrow, so the fitted view is tiny.
- Composite FKs draw a single edge at the first column pair.
- Edges are not keyboard-focusable.
- In TB direction, edges still use side handles (the TB toggle is not exposed in the UI yet).
- Import and Export are disabled.

**Issues already discovered and fixed by Claude Code:** `h-dvh` height gap in headless Chrome,
attribution background in dark mode, missing node focus ring, low-contrast nullable marker.

**Report format requested from Cowork:**

- For each step and each AC, report PASS / FAIL / NOT TESTED, with a reason for NOT TESTED.
- Report defects as `QA-###` with:
  - severity (blocker / major / minor / cosmetic);
  - steps to reproduce;
  - expected vs actual;
  - a screenshot if possible.
- Clearly separate what was verified in the running app from what was inferred by reading code.
