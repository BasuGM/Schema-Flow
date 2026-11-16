import { describe, expect, it } from "vitest";
import { normalizeSchema, toImportResult } from "./normalize";
import { draft } from "./test-helpers";
import { validateSchema } from "./validate";

const users = {
  name: "users",
  columns: [
    { name: "id", type: "bigint", primaryKey: true },
    { name: "email", type: "text", nullable: false, unique: true },
  ],
};

describe("normalizeSchema", () => {
  it("builds tables with ids, flags and declaration order", () => {
    const s = normalizeSchema(
      draft(
        [
          users,
          {
            name: "orders",
            columns: [
              { name: "id", type: "bigint", primaryKey: true },
              {
                name: "user_id",
                type: "bigint",
                references: { table: "users", onDelete: "cascade" },
              },
            ],
          },
        ],
        { defaultSchemaName: "public" },
      ),
    );
    expect(s.tableOrder).toEqual(["public.users", "public.orders"]);
    const id = s.tables["public.users"]?.columns[0];
    expect(id).toMatchObject({
      id: "public.users.id",
      isPrimaryKey: true,
      nullable: false,
      isUnique: false,
    });
    expect(s.tables["public.users"]?.columns[1]).toMatchObject({ isUnique: true, nullable: false });
    const rels = Object.values(s.relationships);
    expect(rels).toHaveLength(1);
    expect(rels[0]).toMatchObject({
      from: { tableId: "public.orders", columnIds: ["public.orders.user_id"] },
      to: { tableId: "public.users", columnIds: ["public.users.id"] },
      onDelete: "cascade",
      cardinality: "many-to-one",
      origin: "declared",
    });
    expect(s.tables["public.orders"]?.columns[1]?.isForeignKey).toBe(true);
    expect(s.issues).toEqual([]);
    expect(validateSchema(s)).toEqual([]);
  });

  it("supports composite primary and foreign keys", () => {
    const s = normalizeSchema(
      draft([
        { name: "orders", columns: [{ name: "id", type: "int" }], primaryKey: { columns: ["id"] } },
        {
          name: "order_items",
          columns: [
            { name: "order_id", type: "int", nullable: false },
            { name: "line_no", type: "int", nullable: false },
          ],
          primaryKey: { name: "order_items_pkey", columns: ["order_id", "line_no"] },
        },
        {
          name: "shipment_items",
          columns: [
            { name: "order_id", type: "int" },
            { name: "line_no", type: "int" },
          ],
          foreignKeys: [
            {
              name: "fk_item",
              columns: ["order_id", "line_no"],
              references: { table: "order_items", columns: ["order_id", "line_no"] },
            },
          ],
        },
      ]),
    );
    expect(s.tables["order_items"]?.primaryKey).toEqual({
      name: "order_items_pkey",
      columnIds: ["order_items.order_id", "order_items.line_no"],
    });
    const rel = Object.values(s.relationships)[0];
    expect(rel?.name).toBe("fk_item");
    expect(rel?.from.columnIds).toEqual(["shipment_items.order_id", "shipment_items.line_no"]);
    expect(rel?.to.columnIds).toEqual(["order_items.order_id", "order_items.line_no"]);
    expect(validateSchema(s)).toEqual([]);
  });

  it("defaults referenced columns to the target primary key", () => {
    const s = normalizeSchema(
      draft([
        users,
        {
          name: "posts",
          columns: [{ name: "author", type: "bigint" }],
          foreignKeys: [{ columns: ["author"], references: { table: "users" } }],
        },
      ]),
    );
    expect(Object.values(s.relationships)[0]?.to.columnIds).toEqual(["users.id"]);
  });

  it("handles self-referencing foreign keys", () => {
    const s = normalizeSchema(
      draft([
        {
          name: "categories",
          columns: [
            { name: "id", type: "int", primaryKey: true },
            {
              name: "parent_id",
              type: "int",
              references: { table: "categories", columns: ["id"] },
            },
          ],
        },
      ]),
    );
    const rel = Object.values(s.relationships)[0];
    expect(rel?.from.tableId).toBe("categories");
    expect(rel?.to.tableId).toBe("categories");
    expect(rel?.cardinality).toBe("many-to-one");
  });

  it("turns unresolved references into warnings instead of throwing", () => {
    const s = normalizeSchema(
      draft([
        {
          name: "orders",
          columns: [
            { name: "user_id", type: "int", references: { table: "users" } },
            { name: "coupon", type: "int" },
          ],
          foreignKeys: [
            {
              name: "fk_coupon",
              columns: ["coupon"],
              references: { table: "orders", columns: ["missing"] },
            },
          ],
        },
      ]),
    );
    expect(s.relationships).toEqual({});
    expect(s.issues.map((i) => i.message)).toEqual([
      'Foreign key on "orders" references unknown table "users".',
      'Foreign key "fk_coupon" references unknown column "missing" in "orders".',
    ]);
    expect(s.issues.every((i) => i.severity === "warning")).toBe(true);
    expect(s.tables["orders"]?.columns[0]?.isForeignKey).toBe(false);
  });

  it("reports column count mismatches and missing target keys", () => {
    const s = normalizeSchema(
      draft([
        {
          name: "a",
          columns: [
            { name: "x", type: "int" },
            { name: "y", type: "int" },
          ],
        },
        { name: "b", columns: [{ name: "id", type: "int", primaryKey: true }] },
        {
          name: "c",
          columns: [
            { name: "a_x", type: "int" },
            { name: "a_y", type: "int" },
          ],
          foreignKeys: [
            { columns: ["a_x"], references: { table: "a" } },
            { columns: ["a_x", "a_y"], references: { table: "b" } },
          ],
        },
      ]),
    );
    expect(Object.keys(s.relationships)).toHaveLength(0);
    expect(s.issues[0]?.message).toContain('"a" has no primary key');
    expect(s.issues[1]?.message).toContain("has 2 column(s) but references 1");
  });

  it("infers one-to-one when FK columns match the PK, a unique constraint, or a unique index", () => {
    const s = normalizeSchema(
      draft([
        users,
        {
          name: "profiles",
          columns: [
            { name: "user_id", type: "bigint", primaryKey: true, references: { table: "users" } },
          ],
        },
        {
          name: "settings",
          columns: [
            { name: "user_id", type: "bigint", unique: true, references: { table: "users" } },
          ],
        },
        {
          name: "tokens",
          columns: [{ name: "user_id", type: "bigint", references: { table: "users" } }],
          indexes: [{ columns: ["user_id"], unique: true }],
        },
        {
          name: "memberships",
          columns: [
            { name: "user_id", type: "bigint", references: { table: "users" } },
            { name: "org", type: "int" },
          ],
          uniqueConstraints: [{ columns: ["user_id", "org"] }],
        },
      ]),
    );
    const card = Object.fromEntries(
      Object.values(s.relationships).map((r) => [r.from.tableId, r.cardinality]),
    );
    expect(card).toEqual({
      profiles: "one-to-one",
      settings: "one-to-one",
      tokens: "one-to-one",
      memberships: "many-to-one",
    });
  });

  it("resolves table and column names case-insensitively", () => {
    const s = normalizeSchema(
      draft([
        { name: "Users", columns: [{ name: "ID", type: "int", primaryKey: true }] },
        {
          name: "orders",
          columns: [
            { name: "User_Id", type: "int", references: { table: "USERS", columns: ["id"] } },
          ],
        },
      ]),
    );
    expect(Object.values(s.relationships)[0]).toMatchObject({
      from: { columnIds: ["orders.User_Id"] },
      to: { tableId: "Users", columnIds: ["Users.ID"] },
    });
  });

  it("resolves schema-qualified references and falls back from the default schema", () => {
    const s = normalizeSchema(
      draft(
        [
          {
            name: "users",
            schemaName: "auth",
            columns: [{ name: "id", type: "uuid", primaryKey: true }],
          },
          { name: "teams", columns: [{ name: "id", type: "int", primaryKey: true }] },
          {
            name: "members",
            columns: [
              { name: "user_id", type: "uuid", references: { table: "users", schemaName: "auth" } },
              { name: "team_id", type: "int", references: { table: "teams" } },
              { name: "other", type: "int", references: { table: "teams", schemaName: "auth" } },
            ],
          },
        ],
        { defaultSchemaName: "public" },
      ),
    );
    expect(s.tableOrder).toEqual(["auth.users", "public.teams", "public.members"]);
    expect(Object.values(s.relationships).map((r) => r.to.tableId)).toEqual([
      "auth.users",
      "public.teams",
    ]);
    expect(s.issues.map((i) => i.message)).toEqual([
      'Foreign key on "members" references unknown table "auth.teams".',
    ]);
  });

  it("reports duplicates and empty names, keeping the first declaration", () => {
    const s = normalizeSchema(
      draft([
        {
          name: "t",
          columns: [
            { name: "a", type: "int" },
            { name: "A", type: "text" },
          ],
          line: 1,
        },
        { name: "T", columns: [{ name: "z", type: "int", primaryKey: true }], line: 5 },
        { name: " ", columns: [] },
      ]),
    );
    expect(s.tableOrder).toEqual(["t"]);
    expect(s.tables["t"]?.columns.map((c) => c.name)).toEqual(["a"]);
    expect(s.tables["t"]?.primaryKey).toBeUndefined();
    expect(s.issues.map((i) => [i.severity, i.line])).toEqual([
      ["warning", 1],
      ["error", 5],
      ["error", undefined],
    ]);
  });

  it("applies detached foreign keys and indexes (ALTER TABLE / CREATE INDEX)", () => {
    const s = normalizeSchema(
      draft([users, { name: "orders", columns: [{ name: "user_id", type: "bigint" }] }], {
        foreignKeys: [
          {
            table: "orders",
            name: "orders_user_fk",
            columns: ["user_id"],
            references: { table: "users" },
            onUpdate: "restrict",
          },
        ],
        indexes: [
          { table: "orders", name: "orders_user_idx", columns: ["user_id"] },
          { table: "nope", columns: ["x"], line: 9 },
        ],
      }),
    );
    expect(Object.values(s.relationships)[0]).toMatchObject({
      name: "orders_user_fk",
      onUpdate: "restrict",
    });
    expect(s.tables["orders"]?.indexes).toEqual([
      { name: "orders_user_idx", columnIds: ["orders.user_id"], unique: false },
    ]);
    expect(s.issues).toEqual([
      { severity: "warning", message: 'Index references unknown table "nope".', line: 9 },
    ]);
  });

  it("links enum-typed columns and copies enums", () => {
    const s = normalizeSchema(
      draft([{ name: "orders", columns: [{ name: "status", type: "Order_Status" }] }], {
        enums: [{ name: "order_status", values: ["pending", "paid"] }],
      }),
    );
    expect(s.tables["orders"]?.columns[0]?.dataType.enumName).toBe("order_status");
    expect(s.enums).toEqual({
      order_status: { name: "order_status", values: ["pending", "paid"] },
    });
  });

  it("disambiguates identical foreign keys with a suffix", () => {
    const fk = { columns: ["user_id"], references: { table: "users" } };
    const s = normalizeSchema(
      draft([
        users,
        { name: "o", columns: [{ name: "user_id", type: "int" }], foreignKeys: [fk, fk] },
      ]),
    );
    expect(Object.keys(s.relationships)).toEqual([
      "fk:o(user_id)->users",
      "fk:o(user_id)->users#2",
    ]);
  });

  it("preserves draft issues and reports ok=false only for errors", () => {
    const warn = normalizeSchema(
      draft([], { issues: [{ severity: "warning", message: "skipped GRANT", line: 3 }] }),
    );
    expect(toImportResult(warn)).toMatchObject({
      ok: true,
      issues: [{ message: "skipped GRANT" }],
    });
    const err = normalizeSchema(draft([{ name: "", columns: [] }]));
    expect(toImportResult(err).ok).toBe(false);
  });
});

describe("issue links (P2-T06)", () => {
  const tables = [
    users,
    { name: "invoices", schemaName: "billing", columns: [{ name: "id", type: "int" }] },
    {
      name: "orders",
      columns: [
        { name: "id", type: "int", primaryKey: true },
        { name: "ghost_id", type: "int", references: { table: "ghosts" } },
        { name: "user_ref", type: "int", references: { table: "users", columns: ["nope"] } },
      ],
    },
  ];

  it("links its own issues to the table they concern", () => {
    const s = normalizeSchema(
      draft([...tables, { name: "USERS", columns: [] }], { defaultSchemaName: "public" }),
    );
    const linked = s.issues.map((i) => [i.message.split(" ").slice(0, 2).join(" "), i.tableId]);
    expect(linked).toEqual([
      ["Duplicate table", "public.users"],
      ["Foreign key", "public.orders"], // to the unknown table "ghosts"
      ["Foreign key", "public.orders"], // to the unknown column users.nope
    ]);
  });

  it("resolves a parser's raw table name: case-insensitive, schema-qualified, default schema", () => {
    const issues = [
      { severity: "warning" as const, message: "a", table: "USERS" },
      { severity: "warning" as const, message: "b", table: "billing.Invoices" },
      { severity: "warning" as const, message: "c", table: "public.orders" },
      { severity: "warning" as const, message: "d", table: "missing" },
      { severity: "warning" as const, message: "e", table: "users", tableId: "kept" },
    ];
    const s = normalizeSchema(draft(tables, { defaultSchemaName: "public", issues }));
    expect(s.issues.slice(0, 5).map((i) => i.tableId)).toEqual([
      "public.users",
      "billing.invoices",
      "public.orders",
      undefined,
      "kept",
    ]);
  });
});
