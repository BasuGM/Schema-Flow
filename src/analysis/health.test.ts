import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { DraftTable } from "@/domain/schema/draft";
import { normalizeSchema } from "@/domain/schema/normalize";
import { draft } from "@/domain/schema/test-helpers";
import type { Schema, SqlDialect } from "@/domain/schema/types";
import { parseSchemaText } from "@/parsers/parse-schema-text";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { analyzeSchema, countFindings, findingsToText } from "./health";

const col = (name: string, extra: Partial<DraftTable["columns"][number]> = {}) => ({
  name,
  type: "integer",
  ...extra,
});

function build(tables: DraftTable[], dialect?: SqlDialect): Schema {
  return normalizeSchema(
    draft(tables, {
      source: { format: "sql", dialect, importedAt: "t" },
    }),
  );
}

const checks = (s: Schema, check: string) => analyzeSchema(s).filter((f) => f.check === check);

describe("missing-pk", () => {
  it("flags tables without a primary key only", () => {
    const s = build([
      { name: "a", columns: [col("id", { primaryKey: true })] },
      { name: "b", columns: [col("x")] },
    ]);
    const found = checks(s, "missing-pk");
    expect(found.map((f) => f.tableId)).toEqual(["b"]);
    expect(found[0]?.severity).toBe("warning");
  });

  it("skips implicit tables", () => {
    const s = build([{ name: "_ab", origin: "implicit", columns: [col("a")] }]);
    expect(checks(s, "missing-pk")).toEqual([]);
  });
});

describe("unindexed-fk", () => {
  const parent: DraftTable = { name: "p", columns: [col("id", { primaryKey: true })] };
  const child = (extra: Partial<DraftTable>): DraftTable => ({
    name: "c",
    columns: [
      col("id", { primaryKey: true }),
      col("a", { references: { table: "p" } }),
      col("b", { references: { table: "p" } }),
    ],
    ...extra,
  });

  it("flags an FK without an index and names the parent", () => {
    const found = checks(build([parent, child({})]), "unindexed-fk");
    expect(found.map((f) => f.message)).toEqual([
      "c.a has no index (FK → p)",
      "c.b has no index (FK → p)",
    ]);
  });

  it("is covered by a leading index, unique constraint or primary key", () => {
    const s = build([
      parent,
      child({
        indexes: [{ columns: ["a"] }],
        uniqueConstraints: [{ columns: ["b"] }],
      }),
    ]);
    expect(checks(s, "unindexed-fk")).toEqual([]);
  });

  it("treats key columns as a set: (a, b) covers (b, a) and (a) but not (b)", () => {
    const composite = (fkCols: string[], idx: string[]) =>
      build([
        { name: "p", columns: [col("x", { primaryKey: true }), col("y")] },
        {
          name: "c",
          columns: [col("id", { primaryKey: true }), col("a"), col("b")],
          indexes: [{ columns: idx }],
          foreignKeys: [{ columns: fkCols, references: { table: "p", columns: ["x", "y"] } }],
        },
      ]);
    expect(checks(composite(["b", "a"], ["a", "b"]), "unindexed-fk")).toEqual([]);
    const single = build([
      parent,
      {
        name: "c",
        columns: [col("id", { primaryKey: true }), col("a"), col("b")],
        indexes: [{ columns: ["a", "b"] }],
        foreignKeys: [
          { columns: ["a"], references: { table: "p" } },
          { columns: ["b"], references: { table: "p" } },
        ],
      },
    ]);
    expect(checks(single, "unindexed-fk").map((f) => f.columnIds)).toEqual([["c.b"]]);
  });

  it("reports a composite FK once", () => {
    const s = build([
      { name: "p", columns: [col("x", { primaryKey: true }), col("y")] },
      {
        name: "c",
        columns: [col("id", { primaryKey: true }), col("a"), col("b")],
        foreignKeys: [
          { columns: ["a", "b"], references: { table: "p", columns: ["x", "y"] } },
          { columns: ["b", "a"], references: { table: "p", columns: ["y", "x"] } },
        ],
      },
    ]);
    const found = checks(s, "unindexed-fk");
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toBe("c.(a, b) has no index (FK → p)");
  });

  it("is skipped for MySQL", () => {
    expect(checks(build([parent, child({})], "mysql"), "unindexed-fk")).toEqual([]);
    expect(checks(build([parent, child({})], "postgresql"), "unindexed-fk")).toHaveLength(2);
  });
});

describe("orphan-table", () => {
  it("flags tables in no relationship", () => {
    const s = build([
      { name: "p", columns: [col("id", { primaryKey: true })] },
      {
        name: "c",
        columns: [col("id", { primaryKey: true }), col("p_id", { references: { table: "p" } })],
      },
      { name: "lonely", columns: [col("id", { primaryKey: true })] },
    ]);
    expect(checks(s, "orphan-table").map((f) => f.tableId)).toEqual(["lonely"]);
  });

  it("is skipped when the schema has no relationships at all", () => {
    const s = build([{ name: "a", columns: [col("id", { primaryKey: true })] }]);
    expect(checks(s, "orphan-table")).toEqual([]);
  });
});

describe("naming", () => {
  const snakeTables = (n: number): DraftTable[] =>
    Array.from({ length: n }, (_, i) => ({
      name: `table_${i}`,
      columns: [col("id", { primaryKey: true })],
    }));

  it("is skipped below 10 names of a kind", () => {
    const s = build([
      ...snakeTables(2),
      { name: "BadName", columns: [col("id", { primaryKey: true })] },
    ]);
    expect(checks(s, "naming")).toEqual([]);
  });

  it("is skipped when no style reaches 60 %", () => {
    const names = ["a_b", "c_d", "e_f", "gH", "iJ", "kL", "MN", "OP", "QR", "ST"];
    const s = build(names.map((name) => ({ name, columns: [col("id", { primaryKey: true })] })));
    expect(checks(s, "naming")).toEqual([]);
  });

  it("gives one finding per table with the table name and its off-style columns together", () => {
    const s = build([
      ...snakeTables(11),
      {
        name: "UserSessions",
        columns: [
          col("id", { primaryKey: true }),
          col("userToken"),
          col("last_seen"),
          col("LASTSEEN"),
        ],
      },
    ]);
    const found = checks(s, "naming");
    expect(found).toHaveLength(1);
    expect(found[0]?.severity).toBe("info");
    expect(found[0]?.message).toBe(
      "UserSessions: table name is not snake_case; columns not snake_case: userToken, LASTSEEN",
    );
    expect(found[0]?.columnIds).toEqual(["UserSessions.userToken", "UserSessions.LASTSEEN"]);
  });

  it("counts ALL_CAPS as its own style, not as 'other'", () => {
    const upper = Array.from({ length: 10 }, (_, i) => ({
      name: `T_${i}`,
      columns: [col("ID", { primaryKey: true })],
    }));
    const s = build([...upper, { name: "lower_one", columns: [col("ID", { primaryKey: true })] }]);
    const found = checks(s, "naming");
    expect(found.map((f) => f.tableId)).toEqual(["lower_one"]);
    expect(found[0]?.message).toContain("not ALL_CAPS");
  });
});

describe("analyzeSchema", () => {
  it("qualifies table names when the schema has several schemas", () => {
    const s = normalizeSchema(
      draft([
        { name: "a", schemaName: "billing", columns: [col("x")] },
        { name: "b", schemaName: "public", columns: [col("x", { primaryKey: true })] },
      ]),
    );
    expect(analyzeSchema(s)[0]?.message).toBe("billing.a has no primary key");
  });

  it("sorts warnings first, then by check and declaration order", () => {
    const s = build([
      { name: "z", columns: [col("id", { primaryKey: true })] },
      { name: "a", columns: [col("x")] },
      {
        name: "m",
        columns: [
          col("id", { primaryKey: true }),
          col("a_id", { references: { table: "a", columns: ["x"] } }),
        ],
      },
    ]);
    expect(analyzeSchema(s).map((f) => `${f.check}:${f.tableId}`)).toEqual([
      "missing-pk:a",
      "unindexed-fk:m",
      "orphan-table:z",
    ]);
  });

  it("formats and counts findings", () => {
    const s = build([{ name: "a", columns: [col("x")] }]);
    const found = analyzeSchema(s);
    expect(countFindings(found)["missing-pk"]).toBe(1);
    expect(findingsToText(found)).toBe("WARNING  missing-pk    a has no primary key");
  });
});

const read = (path: string) =>
  readFileSync(new URL(`../../tests/fixtures/${path}`, import.meta.url), "utf8");
const parse = (path: string) =>
  parseSchemaText(read(path), { now: () => "t" }).result.schema as Schema;

describe("health fixtures", () => {
  it("health.postgres.sql triggers all four checks", () => {
    const found = analyzeSchema(parse("sql/health.postgres.sql"));
    expect(countFindings(found)).toEqual({
      "missing-pk": 1,
      "unindexed-fk": 3,
      "orphan-table": 2,
      naming: 1,
    });
    expect(found.map((f) => f.message)).toEqual([
      "order_items has no primary key",
      "orders.user_id has no index (FK → users)",
      "order_items.order_id has no index (FK → orders)",
      "product_tags.tag_id has no index (FK → tags)",
      "audit_log has no relationships",
      "UserSessions has no relationships",
      "UserSessions: table name is not snake_case; columns not snake_case: userToken, lastSeenAt",
    ]);
  });

  it("health.mysql.sql skips unindexed-fk", () => {
    const counts = countFindings(analyzeSchema(parse("sql/health.mysql.sql")));
    expect(counts["unindexed-fk"]).toBe(0);
    expect(counts["missing-pk"]).toBe(1);
  });
});

describe("check counts on bundled schemas (recorded in the P4-T01 handoff)", () => {
  const counts = (schema: Schema) => countFindings(analyzeSchema(schema));
  const row = (pk: number, fk: number, orphan: number, naming: number) => ({
    "missing-pk": pk,
    "unindexed-fk": fk,
    "orphan-table": orphan,
    naming,
  });

  it("ecommerce sample", () => {
    expect(counts(createEcommerceSchema())).toEqual(row(1, 7, 1, 0));
  });

  it("saas-300", () => {
    expect(counts(parse("synthetic/saas-300.postgres.sql"))).toEqual(row(0, 476, 35, 0));
  });

  it("mysqldump-180", () => {
    expect(counts(parse("real/mysqldump-180.mysql.sql"))).toEqual(row(0, 0, 1, 0));
  });
});
