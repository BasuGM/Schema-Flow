import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeSchemaFile } from "./decode-file";
import { parseSchemaText } from "./parse-schema-text";

function links(path: string): [number | undefined, string | undefined][] {
  const decoded = decodeSchemaFile(
    new Uint8Array(readFileSync(join(process.cwd(), "tests/fixtures", path))),
  );
  if (!decoded.ok) throw new Error("binary fixture");
  const format = path.endsWith(".prisma") ? "prisma" : "auto";
  return parseSchemaText(decoded.text, { format }).result.issues.map((i) => [i.line, i.tableId]);
}

/** Issues carry the table they concern, so the issues panel can link to it (P2-T06). */
describe("issues are linked to their tables", () => {
  it("edge-cases.postgres.sql", () => {
    expect(links("sql/edge-cases.postgres.sql")).toEqual([
      [23, undefined], // CREATE VIEW
      [29, undefined], // unparseable CREATE TABLE (no table was created)
      [31, "public.users"], // expression index
      [undefined, undefined], // grouped summary
      [27, "public.users"], // duplicate USERS → the existing table
      [14, "billing.invoices"], // FK to missing "ghosts" → the FK's source table
    ]);
  });

  it("typeless.sqlite.sql and pgdump.postgres.sql", () => {
    expect(links("sql/typeless.sqlite.sql")).toEqual([
      [2, "public.t"],
      [2, "public.t"],
      [5, "public.u"],
      [6, "public.u"],
    ]);
    expect(links("sql/pgdump.postgres.sql")).toEqual([
      [130, "public.projects"],
      [undefined, undefined],
    ]);
  });

  it("edge-cases.prisma", () => {
    expect(links("prisma/edge-cases.prisma")).toEqual([
      [45, undefined], // unterminated string (lexer)
      [11, "public.Account"], // bad line in model Account
      [29, undefined], // unknown block
      [43, "public.Wallet"], // Wallet missing "}"
      [45, "public.Wallet"], // bad line in model Wallet
      [39, undefined], // view
      [15, "public.Account"], // unknown type
      [13, "public.Account"], // relation to unknown field
      [33, "public.Account"], // duplicate (via @@map) → the existing table
    ]);
  });
});
