import { describe, expect, it } from "vitest";
import { generateSchemaText } from "@/generators/text/generate-text";
import type { GeneratorTarget } from "@/generators/text/types";
import { parseSql } from "./parse-sql";

const DDL = `CREATE TABLE t (
  a character varying DEFAULT ''::character varying NOT NULL,
  b character varying(255) DEFAULT 'x'::character varying NOT NULL,
  c character varying[] DEFAULT '{}'::character varying[],
  d character varying(255)[] DEFAULT '{}'::character varying(255)[] NOT NULL,
  e timestamp without time zone DEFAULT '2020-01-01'::timestamp without time zone,
  f national character varying DEFAULT 'y'::national character varying
);`;

describe("PostgreSQL multi-word cast defaults (QA-030)", () => {
  it("keeps the default value and every following constraint", () => {
    const result = parseSql(DDL, { dialect: "postgresql" });
    const cols = Object.values(result.schema!.tables)[0]!.columns;
    expect(cols.map((c) => c.default?.value)).toEqual([
      "''",
      "'x'",
      "'{}'",
      "'{}'",
      "'2020-01-01'",
      "'y'",
    ]);
    expect(cols.slice(0, 2).every((c) => c.nullable === false)).toBe(true);
  });

  it("emits no truncated cast (`::)`) for any target", () => {
    const schema = parseSql(DDL, { dialect: "postgresql" }).schema!;
    const targets: GeneratorTarget[] = [
      { kind: "sql", dialect: "postgresql" },
      { kind: "sql", dialect: "mysql" },
      { kind: "sql", dialect: "sqlite" },
      { kind: "prisma" },
    ];
    for (const target of targets) {
      expect(generateSchemaText(schema, target).text, target.kind).not.toContain("::)");
    }
  });
});
