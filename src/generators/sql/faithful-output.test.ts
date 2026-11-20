import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SqlDialect } from "@/domain/schema/types";
import { decodeSchemaFile, parseSchemaText } from "@/parsers";
import { generateSchemaText } from "../text/generate-text";

/**
 * BB-P3 guard: re-exporting a schema in its own dialect (faithful) is byte-identical to the output
 * before the cross-dialect clean-up (QA-031). Hashes were recorded from the code at 9393c3b+.
 */
const ROOT = new URL("../../../", import.meta.url);
const BASELINE: Array<[string, SqlDialect, string]> = [
  ["tests/fixtures/real/gitlab-structure.postgres.sql", "postgresql", "bb80461156ed4325"],
  ["tests/fixtures/sql/bom.postgres.sql", "postgresql", "ad11b17afac2f69c"],
  ["tests/fixtures/sql/ecommerce.postgres.sql", "postgresql", "9dba767c87e37431"],
  ["tests/fixtures/sql/edge-cases.postgres.sql", "postgresql", "f24e448f6056db2f"],
  ["tests/fixtures/sql/pg-casts.postgres.sql", "postgresql", "a26b2b677c43de4b"],
  ["tests/fixtures/sql/pgdump.postgres.sql", "postgresql", "28f34606650cb51f"],
  ["tests/fixtures/sql/utf16le.postgres.sql", "postgresql", "d9a3c313ce5aaa47"],
  ["tests/fixtures/synthetic/saas-300.postgres.sql", "postgresql", "723a76f56b66882f"],
  ["tests/fixtures/real/mysqldump-180.mysql.sql", "mysql", "7586b90b661632ec"],
  ["tests/fixtures/real/sakila-schema.mysql.sql", "mysql", "f0714fd2e1ae56a7"],
  ["tests/fixtures/sql/shop.mysql.sql", "mysql", "4ccc21f021baeffe"],
  ["tests/fixtures/sql/blog.sqlite.sql", "sqlite", "7cf1650bed0af3e8"],
];

describe("same-dialect SQL export is unchanged (faithful)", () => {
  it.each(BASELINE)("%s → %s", (path, dialect, hash) => {
    // The CLI decodes files with `decodeSchemaFile` (UTF-16, BOM); do the same.
    const bytes = readFileSync(new URL(path, ROOT));
    const decoded = decodeSchemaFile(bytes);
    if (!decoded.ok) throw new Error(decoded.reason);
    const text = decoded.text;
    const { result } = parseSchemaText(text, { now: () => "2026-01-01T00:00:00.000Z" });
    const out = generateSchemaText(result.schema!, { kind: "sql", dialect });
    expect(createHash("sha256").update(out.text).digest("hex").slice(0, 16)).toBe(hash);
  });
});
