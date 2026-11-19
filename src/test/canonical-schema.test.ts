import { describe, expect, it } from "vitest";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { generateSyntheticSchema } from "@/samples/synthetic";
import {
  CANONICAL_EXCLUDED,
  COLUMN_FIELDS,
  ENUM_FIELDS,
  RELATIONSHIP_FIELDS,
  SCHEMA_FIELDS,
  TABLE_FIELDS,
  canonicalSchema,
} from "./canonical-schema";

const schemas = [createEcommerceSchema(), generateSyntheticSchema({ tables: 30, seed: 3 })];

function keysOf(objects: object[]): Set<string> {
  return new Set(objects.flatMap((o) => Object.keys(o)));
}

describe("canonicalSchema", () => {
  it("classifies every field that real schemas carry (compared, optional or excluded)", () => {
    const tables = schemas.flatMap((s) => Object.values(s.tables));
    const cases: [string, object[], object][] = [
      ["schema", schemas, SCHEMA_FIELDS],
      ["table", tables, TABLE_FIELDS],
      ["column", tables.flatMap((t) => t.columns), COLUMN_FIELDS],
      ["relationship", schemas.flatMap((s) => Object.values(s.relationships)), RELATIONSHIP_FIELDS],
      ["enum", schemas.flatMap((s) => Object.values(s.enums)), ENUM_FIELDS],
    ];
    for (const [scope, objects, classified] of cases) {
      const unclassified = [...keysOf(objects)].filter((k) => !(k in classified));
      expect(unclassified, `${scope} fields missing from canonical-schema.ts`).toEqual([]);
    }
  });

  it("lists what it excludes, each with a reason", () => {
    expect(CANONICAL_EXCLUDED.length).toBeGreaterThan(0);
    expect(CANONICAL_EXCLUDED.every((line) => /^\w+\.\w+: .{10,}/.test(line))).toBe(true);
    expect(CANONICAL_EXCLUDED).toContain(
      "table.partitions: folded partitions are dropped by the generators (reported as a warning)",
    );
  });

  it("is order-insensitive for tables but keeps column order", () => {
    const s = createEcommerceSchema();
    const reversed = { ...s, tableOrder: [...s.tableOrder].reverse() };
    expect(canonicalSchema(reversed)).toEqual(canonicalSchema(s));
    const users = Object.values(s.tables)[0]!;
    const shuffled = {
      ...s,
      tables: { ...s.tables, [users.id]: { ...users, columns: [...users.columns].reverse() } },
    };
    expect(canonicalSchema(shuffled)).not.toEqual(canonicalSchema(s));
  });

  it("compares optional fields only when asked", () => {
    const s = createEcommerceSchema();
    const users = Object.values(s.tables)[0]!;
    const col = users.columns[0]!;
    const changed = {
      ...s,
      tables: {
        ...s.tables,
        [users.id]: {
          ...users,
          comment: "x",
          columns: [{ ...col, comment: "y", default: undefined }, ...users.columns.slice(1)],
        },
      },
    };
    expect(canonicalSchema(changed)).toEqual(canonicalSchema(s));
    expect(canonicalSchema(changed, ["comments"])).not.toEqual(canonicalSchema(s, ["comments"]));
    expect(canonicalSchema(changed, ["defaults"])).not.toEqual(canonicalSchema(s, ["defaults"]));
  });
});
