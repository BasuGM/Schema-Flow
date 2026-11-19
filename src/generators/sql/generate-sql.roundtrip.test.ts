import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Schema, SqlDialect } from "@/domain/schema/types";
import { parsePrisma } from "@/parsers/prisma/parse-prisma";
import { parseSql } from "@/parsers/sql/parse-sql";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { canonicalSchema, type CanonicalOption } from "@/test/canonical-schema";
import { generateSql } from "./generate-sql";

const ROOT = new URL("../../../tests/fixtures/", import.meta.url);
const NOW = () => "2026-01-01T00:00:00.000Z";
const load = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
const parse = (text: string, dialect: SqlDialect): Schema => {
  const result = parseSql(text, { dialect, now: NOW });
  expect(result.schema, "fixture must parse").toBeDefined();
  return result.schema!;
};

/** Comments are left out: PostgreSQL `COMMENT ON` and table comments are skipped by the parser. */
const SAME: CanonicalOption[] = ["types", "defaults"];

const FIXTURES: [string, SqlDialect][] = [
  ["sql/ecommerce.postgres.sql", "postgresql"],
  ["sql/pgdump.postgres.sql", "postgresql"],
  ["sql/edge-cases.postgres.sql", "postgresql"],
  ["sql/shop.mysql.sql", "mysql"],
  ["sql/blog.sqlite.sql", "sqlite"],
  ["real/sakila-schema.mysql.sql", "mysql"],
  ["real/mysqldump-180.mysql.sql", "mysql"],
];

describe("same-dialect SQL is a fixed point of parse → generate → parse", () => {
  for (const [path, dialect] of FIXTURES) {
    it(`${path}`, () => {
      const original = parse(load(path), dialect);
      const { text } = generateSql(original, { dialect });
      const again = parse(text, dialect);
      expect(canonicalSchema(again, SAME)).toEqual(canonicalSchema(original, SAME));
    });
  }

  it("the ecommerce sample (PostgreSQL)", () => {
    const original = createEcommerceSchema();
    const again = parse(generateSql(original, { dialect: "postgresql" }).text, "postgresql");
    expect(canonicalSchema(again, SAME)).toEqual(canonicalSchema(original, SAME));
  });
});

/** PostgreSQL's `public.` prefix and enum types do not exist on MySQL / SQLite (enums become CHECKs). */
const withoutPublic = (schema: Schema): unknown => {
  const canonical = canonicalSchema(schema, []);
  delete canonical.enums;
  return JSON.parse(
    JSON.stringify(canonical)
      .replace(/"schemaName":"public"/g, '"schemaName":null')
      .replace(/public\./g, "")
      // SQLite has no enum type: the generator adds `col IN ('a', 'b')` checks instead.
      .replace(/"\w+ in \([^"]*\)",?/g, "")
      .replace(/,\]/g, "]"),
  );
};

describe("cross-dialect SQL keeps the structure", () => {
  for (const dialect of ["mysql", "sqlite"] as const) {
    it(`ecommerce sample → ${dialect}: tables, columns, keys and relationships`, () => {
      const original = createEcommerceSchema();
      const { text, warnings } = generateSql(original, { dialect });
      expect(withoutPublic(parse(text, dialect))).toEqual(withoutPublic(original));
      expect(warnings.length).toBeGreaterThan(0);
    });
  }
});

describe("Prisma schemas export to every SQL dialect with their structure intact", () => {
  for (const path of ["prisma/blog.prisma", "prisma/shop.mysql.prisma"]) {
    for (const dialect of ["postgresql", "mysql", "sqlite"] as const) {
      it(`${path} → ${dialect}`, () => {
        const original = parsePrisma(load(path), { now: NOW }).schema!;
        const { text, warnings } = generateSql(original, { dialect });
        expect(withoutPublic(parse(text, dialect))).toEqual(withoutPublic(original));
        // Prisma scalars were mapped, never copied: no `String` / `DateTime` in the DDL.
        expect(text).not.toMatch(/\b(String|DateTime|Boolean)\b/);
        expect(warnings.every((w) => typeof w === "string")).toBe(true);
      });
    }
  }
});
