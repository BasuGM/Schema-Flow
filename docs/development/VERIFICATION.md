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
