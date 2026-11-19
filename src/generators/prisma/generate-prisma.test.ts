import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeSchema } from "@/domain/schema/normalize";
import type { DraftSchema, DraftTable } from "@/domain/schema/draft";
import { draft } from "@/domain/schema/test-helpers";
import type { Schema } from "@/domain/schema/types";
import { parsePrisma } from "@/parsers/prisma/parse-prisma";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { HOSTILE, hostileSchema } from "@/test/hostile-schema";
import { generatePrisma } from "./generate-prisma";

const NOW = () => "2026-01-01T00:00:00.000Z";
const build = (tables: DraftTable[], extra: Partial<DraftSchema> = {}): Schema =>
  normalizeSchema(
    draft(tables, {
      defaultSchemaName: "public",
      ...extra,
      source: { format: "sql", dialect: "postgresql", importedAt: NOW() },
    }),
  );
const gen = (s: Schema) => generatePrisma(s);
const reparse = (text: string) => parsePrisma(text, { now: NOW });

describe("hostile strings", () => {
  it("never break the schema: every line is a comment, a block line or an indented member", () => {
    const { text } = gen(hostileSchema());
    for (const line of text.split("\n")) {
      expect(line, `stray line: ${JSON.stringify(line)}`).toMatch(
        /^(\s*$|\/\/|\s+\S|(model|enum|generator|datasource) \S+ \{$|\}$)/,
      );
    }
    expect(text).not.toMatch(/^\/\/\/.*\n.*\bn--l\*\/e/m);
  });

  it("round-trips the real names through @@map / @map and escaped strings", () => {
    const result = reparse(gen(hostileSchema()).text);
    expect(result.schema).toBeDefined();
    const table = Object.values(result.schema!.tables)[0]!;
    expect(table.name).toBe(`t${HOSTILE}`);
    expect(table.columns.map((c) => c.name)).toContain(`c${HOSTILE}`);
    expect(Object.values(result.schema!.enums)[0]!.name).toBe(`k${HOSTILE}`);
    expect(Object.values(result.schema!.enums)[0]!.values).toContain(`v${HOSTILE}`);
    expect(result.issues.filter((i) => i.severity === "error")).toEqual([]);
  });

  it("keeps doc comments on one line", () => {
    const docs = gen(hostileSchema())
      .text.split("\n")
      .filter((l) => l.trimStart().startsWith("///"));
    expect(docs.length).toBeGreaterThan(0);
    for (const d of docs) expect(d).not.toMatch(/[\r\n]/);
  });
});

describe("models, fields and attributes", () => {
  it("PascalCases models and keeps the real table and column names", () => {
    const { text } = gen(
      build([
        {
          name: "order_items",
          columns: [
            { name: "id", type: "int", nullable: false, primaryKey: true },
            { name: "unit price", type: "numeric(10, 2)" },
            { name: "_hidden", type: "text" },
            { name: "1st", type: "text" },
          ],
        },
      ]),
    );
    expect(text).toContain("model OrderItems {");
    expect(text).toContain('@@map("order_items")');
    expect(text).toMatch(/unit_price Decimal\? @db\.Decimal\(10, 2\) @map\("unit price"\)/);
    expect(text).toMatch(/hidden String\? @map\("_hidden"\)/);
    expect(text).toMatch(/f_1st String\? @map\("1st"\)/);
    expect(text).toMatch(/id Int @id\n/);
  });

  it("renders defaults, enums and Unsupported types", () => {
    const s = createEcommerceSchema();
    const { text, warnings } = gen(s);
    expect(text).toMatch(/enum OrderStatus \{\n {2}pending\n {2}paid/);
    expect(text).toContain('@@map("order_status")');
    expect(text).toMatch(/status OrderStatus @default\(pending\)/);
    expect(text).toMatch(/created_at DateTime @db\.Timestamptz @default\(now\(\)\)/);
    expect(text).toMatch(/tags String\[\]/);
    const odd = gen(build([{ name: "t", columns: [{ name: "p", type: "point" }] }]));
    expect(odd.text).toContain('p Unsupported("point")?');
    expect(odd.warnings.some((w) => w.includes("Unsupported"))).toBe(true);
    expect(warnings.some((w) => w.includes("CHECK constraints"))).toBe(true);
  });

  it("emits composite keys, uniques and indexes with their names", () => {
    const { text } = gen(
      build([
        {
          name: "t",
          columns: [
            { name: "a", type: "int", nullable: false },
            { name: "b", type: "int", nullable: false },
            { name: "c", type: "int" },
          ],
          primaryKey: { name: "t_pk", columns: ["a", "b"] },
          uniqueConstraints: [{ name: "t_c_b", columns: ["c", "b"] }],
          indexes: [{ name: "t_c_idx", columns: ["c"] }],
        },
      ]),
    );
    expect(text).toContain('@@id([a, b], map: "t_pk")');
    expect(text).toContain('@@unique([c, b], map: "t_c_b")');
    expect(text).toContain('@@index([c], map: "t_c_idx")');
  });
});

describe("relations", () => {
  const rel = (table: string, extra: object = {}) => ({
    table,
    columns: ["id"],
    ...extra,
  });

  it("writes both sides, optionality, actions and constraint names", () => {
    const s = build([
      { name: "users", columns: [{ name: "id", type: "int", nullable: false, primaryKey: true }] },
      {
        name: "posts",
        columns: [
          { name: "id", type: "int", nullable: false, primaryKey: true },
          {
            name: "user_id",
            type: "int",
            references: rel("users", { onDelete: "set null", name: "posts_user_fk" }),
          },
        ],
      },
    ]);
    const { text } = gen(s);
    expect(text).toContain(
      'users Users? @relation(fields: [user_id], references: [id], onDelete: SetNull, map: "posts_user_fk")',
    );
    expect(text).toMatch(/model Users \{[^}]*posts Posts\[\]/);
    const again = reparse(text).schema!;
    expect(Object.values(again.relationships)).toHaveLength(1);
  });

  it("uses a one-to-one back field for a unique foreign key", () => {
    const s = build([
      { name: "users", columns: [{ name: "id", type: "int", nullable: false, primaryKey: true }] },
      {
        name: "profiles",
        columns: [
          { name: "id", type: "int", nullable: false, primaryKey: true },
          { name: "user_id", type: "int", nullable: false, unique: true, references: rel("users") },
        ],
      },
    ]);
    const { text } = gen(s);
    expect(text).toMatch(/profiles Profiles\?\n/);
    expect(Object.values(reparse(text).schema!.relationships)[0]!.cardinality).toBe("one-to-one");
  });

  it("names relations that are ambiguous (self, or several between two models)", () => {
    const s = build([
      {
        name: "people",
        columns: [
          { name: "id", type: "int", nullable: false, primaryKey: true },
          { name: "boss_id", type: "int", references: rel("people") },
          { name: "mentor_id", type: "int", references: rel("people") },
        ],
      },
    ]);
    const { text } = gen(s);
    expect(text.match(/@relation\("People_/g)!.length).toBe(4);
    expect(Object.keys(reparse(text).schema!.relationships)).toHaveLength(2);
  });

  it("folds Prisma implicit many-to-many join tables back into list fields", () => {
    const blog = parsePrisma(
      readFileSync(new URL("../../../tests/fixtures/prisma/blog.prisma", import.meta.url), "utf8"),
      { now: NOW },
    ).schema!;
    const joins = Object.values(blog.tables).filter((t) => t.origin === "implicit");
    expect(joins.length).toBeGreaterThan(0);
    const { text } = gen(blog);
    for (const j of joins) expect(text).not.toContain(`model ${j.name}`);
    expect(text).toContain('@relation("CategoryToPost")');
    expect(
      Object.values(reparse(text).schema!.tables).filter((t) => t.origin === "implicit"),
    ).toHaveLength(joins.length);
  });

  it("uses @@schema and multiSchema for non-default schemas", () => {
    const s = build([
      {
        name: "t",
        schemaName: "billing",
        columns: [{ name: "id", type: "int", nullable: false, primaryKey: true }],
      },
    ]);
    const { text } = gen(s);
    expect(text).toContain('previewFeatures = ["multiSchema"]');
    expect(text).toContain('schemas  = ["billing"]');
    expect(text).toContain('@@schema("billing")');
  });
});

describe("degenerate inputs", () => {
  it("an empty schema is the header, generator and datasource only", () => {
    const { text, warnings } = gen(build([]));
    expect(text).toMatch(
      /^\/\/ SchemaFlow export: test\n\ngenerator client \{[^}]*\}\n\ndatasource db \{[^}]*\}\n$/,
    );
    expect(warnings).toEqual([]);
    expect(reparse(text).issues.some((i) => i.severity === "error")).toBe(true);
  });

  it("a table without a key is exported with a warning and a note", () => {
    const { text, warnings } = gen(
      build([{ name: "logs", columns: [{ name: "message", type: "text" }] }]),
    );
    expect(text).toContain("model Logs {");
    expect(text).toContain("// Prisma needs an @id or @@unique on every model.");
    expect(warnings).toEqual([
      'Model "Logs" has no primary key or unique key; Prisma needs one before it can be used.',
    ]);
  });

  it("is deterministic and never throws on a large synthetic schema", async () => {
    const { generateSyntheticSchema } = await import("@/samples/synthetic");
    const s = generateSyntheticSchema({ tables: 150, seed: 9 });
    const a = gen(s);
    expect(gen(s)).toEqual(a);
    expect(reparse(a.text).schema).toBeDefined();
  });
});
