### Claude Cowork Verification Handoff

**Type:** Re-verification of QA-004 from your round-2 report, plus the production-build check
(AC-P1-T09-7) you asked us to enable, and a short regression checklist.

**Context.** SchemaFlow is a browser-only database schema explorer that shows a schema as an
interactive entity-relationship diagram (table list · canvas · inspector). Your round-2 report
confirmed QA-001, QA-002 and QA-003 as fixed and raised QA-004: when a table was selected, all of its
edge labels were drawn on top of neighbouring tables. Commit `f382257` changes edge labels:

- Selecting a table now **only highlights** its edges in blue, with no labels.
- **Hovering** an edge shows one label with the full text (e.g.
  `orders_user_fk · orders.user_id → users.id`) beside its FK row, drawn above tables.
- Moving the pointer away hides the label.
- **Clicking** an edge keeps its label until you click empty canvas. Edge click-selection didn't
  work before at all; that is fixed too.
- The native SVG `<title>` tooltip was removed, because it duplicated the hover label. Edges now
  carry the same text as their `aria-label`.
- From your observation: all edges now use the same smooth curve style, routed or not.

**Files modified:**

- `src/components/canvas/{relationship-edge,schema-canvas,use-canvas-commands}.tsx|ts`
- `src/graph/{describe,schema-to-flow}.ts`
- Tests: `src/graph/{describe,layout-dagre}.test.ts`, `src/components/canvas/use-canvas-commands.test.ts`,
  `src/components/workspace/selection-sync.test.tsx`
- Docs: `docs/development/*`

**Environment — note the change:**

- Project folder: `/Users/basavachethan/Documents/Focus/Claude-Code/Schema-Flow`
- **http://localhost:3000 is now the PRODUCTION static build** (`npm run start` serving `out/`),
  not the dev server. You should see no Next.js "N" badge and no `[HMR] connected` message.
- If the server isn't running, the user can run `npm run start` in the project root (it needs
  `npm run build` first, and the dev server must be stopped).
- Use Chrome. Reload first.

**Acceptance criteria:** AC-P1-T07-8 (revised again), AC-P1-T07-12, AC-P1-T07-13, AC-P1-T09-7.
See "Fixes for Cowork round 2" in `docs/development/VERIFICATION.md`.

**Steps → expected results**

1. Load http://localhost:3000. → No "N" badge in the bottom-left; the console is completely empty.
   12 nodes, 13 edges, 12 list items. (AC-P1-T09-7)
2. Click `orders` in the list. → The six connected edges turn blue and **no labels appear**. No
   table content is covered. (AC-P1-T07-8, QA-004)
3. Hover the edge into `orders.user_id`. → One label, `orders_user_fk · orders.user_id → users.id`,
   appears just left of the `user_id` row, above other content. Move the pointer away → it
   disappears. Hover a different edge → only that edge's label shows. (AC-P1-T07-8)
4. Click the `payments → orders` edge. → It stays blue with the label
   `payments_order_fk · payments.order_id → orders.id` after the pointer leaves. Click empty canvas
   → the label disappears. (AC-P1-T07-8)
5. Repeat steps 2–3 with `users` selected, then in the dark theme. → There are no labels until you
   hover, and the hover label is readable.
6. Look at the edges. → All edges are smooth curves; there are no right-angled step lines except
   the `categories` self-loop, which is a curve too. None passes behind an unrelated table. After
   dragging `orders`, its edges become direct smooth curves; "Layout" restores the routes.
   (AC-P1-T07-12, AC-P1-T07-11)
7. In the DOM: `[data-id="fk:public.orders(user_id)->public.users"]` has
   `aria-label="Relationship orders_user_fk · orders.user_id → users.id"`. (AC-P1-T07-13)
8. Production check of earlier fixes: repeat QA-001 (orders→users routes below `addresses`) and
   QA-003 (click `users` in the list and press Escape → the selection clears). (AC-P1-T09-7)
9. Load `/?sample=synthetic&tables=200` on the production server. → 200 tables, smooth pan, zoom
   and drag. Report the longest task if you measure it; it should be lower than in dev.
   (AC-P1-T09-1, AC-P1-T09-7)

**Regression checklist:**

- Selection sync between list, canvas and inspector.
- List clicks center the node.
- Clicking empty canvas clears the selection.
- Escape from the list clears it; Escape in the filter keeps it.
- Enter on a focused node.
- Drag, then Layout.
- Reset view.
- Minimap.
- Theme switch, including a reload in dark mode.
- Panel toggles and the narrow-window collapse (not re-run last round).
- Two-line inspector rows.

**Still open:**

- AC-P1-T09-6 (reduced motion). We know your tooling can't emulate it; it is now covered by a
  unit test. Mark it NOT TESTED unless you find a way.

**Edge cases:**

- Hover an edge while a different table is selected.
- Click an edge, then click a node.
- Hover the self-loop on `categories`.
- Hover edges at 0.05 zoom on the 200-table sample; the label should still be readable at screen
  size, since labels don't scale down.

**Potential failure cases:**

- Labels showing on selection again.
- A label that doesn't disappear on mouse leave.
- Edge clicks doing nothing.
- A step-style edge remaining.
- Any console output in production.
- A blank page or 404s for `/_next/static/*` assets.

**Automated results (Claude Code, 2026-11-13):**

- `npm run check` passes: typecheck ✔, ESLint ✔, Vitest ✔ 19 files / 116 tests, build ✔.
- New tests:
  - no labels on selection;
  - exactly one label on hover, removed on leave;
  - a clicked edge keeps its label until the canvas is clicked;
  - every edge (routed or direct) sampled against all table boxes;
  - edge aria-labels;
  - reduced-motion duration.
- Production server headless load: 0 console messages, 12 nodes, 13 edges.
- A headless screenshot showed uniform curves with no crossings.
- Hover and click labels were not visually checked by Claude Code; headless capture can't hover.

**Known limitations:**

- Edge labels require a pointer, because edges aren't keyboard-focusable. Keyboard and
  screen-reader users get the relationship text through the edge `aria-label` and the inspector
  counts.
- Routes are dropped for dragged end tables until "Layout".
- TB layout has no routes.

**Report format requested:**

- For each step and AC: PASS / FAIL / NOT TESTED, with a reason.
- QA-004 status: Fixed / Not fixed / Partially fixed.
- New defects as `QA-005…` with severity, repro, expected vs actual, and a screenshot.
- Separate what you verified in the running app from what you inferred.
