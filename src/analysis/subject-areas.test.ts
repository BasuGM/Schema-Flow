import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSchemaText } from "@/parsers/parse-schema-text";
import type { Schema } from "@/domain/schema/types";
import { getSubjectAreas } from "./subject-areas";

function load(path: string): Schema {
  const text = readFileSync(new URL(`../../tests/fixtures/${path}`, import.meta.url), "utf8");
  return parseSchemaText(text, { now: () => "t" }).result.schema!;
}
const summary = (s: Schema) =>
  getSubjectAreas(s)?.areas.map((a) => [a.id, a.tableIds.length] as const) ?? null;

describe("getSubjectAreas", () => {
  it("uses DB schema names for saas-300", () => {
    const s = load("synthetic/saas-300.postgres.sql");
    const areas = getSubjectAreas(s)!;
    expect(areas.source).toBe("schema");
    expect(summary(s)).toEqual([
      ["core", 100],
      ["billing", 100],
      ["analytics", 100],
    ]);
    expect(areas.areaOf.size).toBe(300);
  });

  it("uses name prefixes for mysqldump-180 with no Other", () => {
    const s = load("real/mysqldump-180.mysql.sql");
    const list = summary(s)!;
    expect(getSubjectAreas(s)!.source).toBe("prefix");
    expect(list).toHaveLength(9);
    expect(list.every(([, n]) => n === 20)).toBe(true);
    expect(list.some(([id]) => id === "other")).toBe(false);
  });

  it("large-200.prisma: 10 areas of 20 plus Other 20", () => {
    const s = load("real/large-200.prisma");
    const list = summary(s)!;
    expect(list).toHaveLength(11);
    expect(list.at(-1)).toEqual(["other", 20]);
    expect(list.slice(0, 10).every(([, n]) => n === 20)).toBe(true);
  });

  it("GitLab: 78 prefix areas, Other 179", () => {
    const s = load("real/gitlab-structure.postgres.sql");
    const list = summary(s)!;
    expect(list).toHaveLength(79);
    expect(list.at(-1)).toEqual(["other", 179]);
  });

  it("returns null for ecommerce, sakila and blog", () => {
    for (const f of [
      "sql/ecommerce.postgres.sql",
      "real/sakila-schema.mysql.sql",
      "prisma/blog.prisma",
    ])
      expect(getSubjectAreas(load(f))).toBeNull();
  });

  it("is memoised per schema object", () => {
    const s = load("synthetic/saas-300.postgres.sql");
    expect(getSubjectAreas(s)).toBe(getSubjectAreas(s));
  });
});
