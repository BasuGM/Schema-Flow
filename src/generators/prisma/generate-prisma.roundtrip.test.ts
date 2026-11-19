import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Schema } from "@/domain/schema/types";
import { parsePrisma } from "@/parsers/prisma/parse-prisma";
import { parseSql } from "@/parsers/sql/parse-sql";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { canonicalSchema, type CanonicalOption } from "@/test/canonical-schema";
import { generatePrisma } from "./generate-prisma";

const ROOT = new URL("../../../tests/fixtures/", import.meta.url);
const NOW = () => "2026-01-01T00:00:00.000Z";
const load = (path: string) => readFileSync(new URL(path, ROOT), "utf8");
const parse = (text: string): Schema => {
  const result = parsePrisma(text, { now: NOW });
  expect(result.schema, "must parse").toBeDefined();
  return result.schema!;
};

/** Prisma-origin schemas keep their exact types, defaults and implicit-table markers. */
const EXACT: CanonicalOption[] = ["types", "defaults", "origin"];

describe("a Prisma schema is a fixed point of parse → generate → parse", () => {
  for (const path of [
    "prisma/blog.prisma",
    "prisma/shop.mysql.prisma",
    "prisma/edge-cases.prisma",
    "real/large-200.prisma",
  ]) {
    it(path, () => {
      const original = parse(load(path));
      const { text } = generatePrisma(original);
      const again = parse(text);
      expect(canonicalSchema(again, EXACT)).toEqual(canonicalSchema(original, EXACT));
    });
  }
});

describe("SQL-origin schemas keep their structure through Prisma", () => {
  /** Unique indexes and unique constraints are the same thing in Prisma (`@@unique`). */
  const mergeUnique = (schema: Schema): unknown => {
    const c = canonicalSchema(schema, []) as {
      tables: { unique: unknown[]; indexes: { unique: boolean; columns: unknown }[] }[];
    };
    for (const t of c.tables) {
      t.unique = [...t.unique, ...t.indexes.filter((i) => i.unique).map((i) => i.columns)]
        .map((u) => JSON.stringify(u))
        .sort();
      t.indexes = t.indexes.filter((i) => !i.unique);
    }
    return c;
  };
  /** Prisma lists are never null, so a nullable array column comes back non-nullable. */
  const listsNeverNull = (schema: Schema): Schema => ({
    ...schema,
    tables: Object.fromEntries(
      Object.entries(schema.tables).map(([id, t]) => [
        id,
        {
          ...t,
          columns: t.columns.map((c) => (c.dataType.isArray ? { ...c, nullable: false } : c)),
        },
      ]),
    ),
  });
  const withoutChecks = (value: unknown) => {
    const copy = JSON.parse(JSON.stringify(value)) as { tables: { checks: unknown[] }[] };
    // Prisma has no CHECK constraints.
    for (const t of copy.tables) t.checks = [];
    return copy;
  };

  const cases: [string, Schema][] = [
    ["the ecommerce sample", createEcommerceSchema()],
    [
      "ecommerce.postgres.sql",
      parseSql(load("sql/ecommerce.postgres.sql"), { dialect: "postgresql", now: NOW }).schema!,
    ],
    [
      "shop.mysql.sql",
      parseSql(load("sql/shop.mysql.sql"), { dialect: "mysql", now: NOW }).schema!,
    ],
    [
      "sakila",
      parseSql(load("real/sakila-schema.mysql.sql"), { dialect: "mysql", now: NOW }).schema!,
    ],
  ];
  for (const [name, original] of cases) {
    it(name, () => {
      const { text } = generatePrisma(original);
      const again = parse(text);
      expect(withoutChecks(mergeUnique(again))).toEqual(
        withoutChecks(mergeUnique(listsNeverNull(original))),
      );
    });
  }
});
