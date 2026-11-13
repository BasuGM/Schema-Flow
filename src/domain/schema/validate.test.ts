import { describe, expect, it } from "vitest";
import { normalizeSchema } from "./normalize";
import { draft } from "./test-helpers";
import type { Schema } from "./types";
import { validateSchema } from "./validate";

function base(): Schema {
  return normalizeSchema(
    draft([
      { name: "users", columns: [{ name: "id", type: "int", primaryKey: true }] },
      {
        name: "orders",
        columns: [{ name: "user_id", type: "int", references: { table: "users" } }],
      },
    ]),
  );
}

const messages = (s: Schema) => validateSchema(s).map((i) => i.message);

describe("validateSchema", () => {
  it("accepts a normalized schema", () => {
    expect(validateSchema(base())).toEqual([]);
  });

  it("detects table key/id mismatch, empty names and tableOrder drift", () => {
    const s = base();
    const users = s.tables["users"]!;
    users.name = " ";
    s.tables["people"] = { ...users, id: "people2", columns: [], primaryKey: undefined };
    expect(messages(s)).toEqual([
      "tableOrder does not list exactly the tables in the schema.",
      'Table "users" has an empty name.',
      'Table key "people" does not match its id "people2".',
      'Table "people" has an empty name.',
    ]);
  });

  it("detects duplicate column ids and wrong owners", () => {
    const s = base();
    const orders = s.tables["orders"]!;
    orders.columns.push({ ...orders.columns[0]! });
    orders.columns.push({ ...orders.columns[0]!, id: "orders.x", tableId: "users" });
    expect(messages(s)).toEqual([
      'Duplicate column id "orders.user_id".',
      'Column "orders.x" belongs to "users" but is listed in "orders".',
    ]);
  });

  it("detects keys and relationships pointing at missing tables or columns", () => {
    const s = base();
    s.tables["users"]!.primaryKey = { columnIds: ["users.nope"] };
    const rel = Object.values(s.relationships)[0]!;
    rel.to = { tableId: "ghost", columnIds: ["ghost.id"] };
    rel.from.columnIds = ["users.id"];
    expect(messages(s)).toEqual([
      'A primary key on "users" references unknown column "users.nope".',
      `Relationship "${rel.id}" references column "users.id" not in table "orders".`,
      `Relationship "${rel.id}" references missing table "ghost".`,
    ]);
  });

  it("detects mismatched column counts and empty keys", () => {
    const s = base();
    s.tables["orders"]!.indexes.push({ columnIds: [], unique: false });
    Object.values(s.relationships)[0]!.from.columnIds.push("orders.user_id");
    expect(messages(s)).toEqual([
      'A index on "orders" has no columns.',
      expect.stringContaining("mismatched column counts"),
    ]);
  });

  it("never throws, returning only issues", () => {
    expect(() => validateSchema({ ...base(), tableOrder: ["x", "x"] })).not.toThrow();
  });
});
