import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSchemaText } from "./parse-schema-text";

const fixture = (path: string) =>
  readFileSync(new URL(`../../tests/fixtures/${path}`, import.meta.url), "utf8");
const NOW = () => "t";

describe("parseSchemaText", () => {
  it.each([
    ["sql/ecommerce.postgres.sql", "sql", "postgresql", 12],
    ["sql/shop.mysql.sql", "sql", "mysql", 5],
    ["sql/blog.sqlite.sql", "sql", "sqlite", 4],
    ["prisma/blog.prisma", "prisma", undefined, 9],
  ] as const)("auto-detects %s", (path, format, dialect, tables) => {
    const parsed = parseSchemaText(fixture(path), { now: NOW });
    expect(parsed.format).toBe(format);
    expect(parsed.dialect).toBe(dialect);
    expect(parsed.result.schema?.tableOrder).toHaveLength(tables);
  });

  it("uses default names and accepts a given name", () => {
    expect(parseSchemaText("CREATE TABLE a (id int);").result.schema?.name).toBe("Pasted SQL");
    expect(parseSchemaText("model A {\n  id Int @id\n}").result.schema?.name).toBe(
      "Pasted Prisma schema",
    );
    expect(parseSchemaText("CREATE TABLE a (id int);", { name: "dump" }).result.schema?.name).toBe(
      "dump",
    );
  });

  it("lets an explicit format override detection", () => {
    const text = "CREATE TABLE a (id int);";
    expect(parseSchemaText(text).dialect).toBe("postgresql");
    const sqlite = parseSchemaText(text, { format: "sqlite" });
    expect(sqlite).toMatchObject({ format: "sql", dialect: "sqlite" });
    expect(sqlite.result.schema?.tableOrder).toEqual(["a"]);
    const asPrisma = parseSchemaText(text, { format: "prisma" });
    expect(asPrisma.format).toBe("prisma");
    expect(asPrisma.result.ok).toBe(false);
  });

  it("reports unknown and empty input as an error, never throwing", () => {
    expect(parseSchemaText("hello world")).toEqual({
      format: "unknown",
      result: {
        ok: false,
        issues: [
          { severity: "error", message: "This doesn't look like SQL DDL or a Prisma schema." },
        ],
      },
    });
    expect(parseSchemaText(" \n ").result.issues[0]?.message).toBe("The input is empty.");
  });

  it("QA-033: backtick names with a quote or a backslash import as MySQL", () => {
    for (const name of ["we'ird", "back\\slash"]) {
      const { format, result } = parseSchemaText(`CREATE TABLE \`${name}\` (id int);`, {
        now: NOW,
      });
      expect(format, name).toBe("sql");
      expect(result.schema?.source.dialect, name).toBe("mysql");
      expect(Object.keys(result.schema?.tables ?? {}), name).toHaveLength(1);
      expect(
        result.issues.filter((x) => x.severity === "error"),
        name,
      ).toEqual([]);
    }
  });
});
