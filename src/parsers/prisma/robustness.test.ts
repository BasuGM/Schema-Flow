import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prng } from "@/samples/synthetic";
import { parsePrisma } from "./parse-prisma";

const FIXTURES = new URL("../../../tests/fixtures/prisma/", import.meta.url);
const fixtures = readdirSync(FIXTURES).filter((f) => f.endsWith(".prisma"));
const NASTY = [
  '"',
  "{",
  "}",
  "(",
  ")",
  "[",
  "]",
  "@",
  "@@",
  "\n",
  ",",
  ":",
  "?",
  "///",
  "//",
  "\\",
];

function expectImportResult(text: string): void {
  let result: ReturnType<typeof parsePrisma> | undefined;
  expect(() => (result = parsePrisma(text, { now: () => "t" })), text.slice(0, 80)).not.toThrow();
  expect(typeof result?.ok).toBe("boolean");
  expect(Array.isArray(result?.issues)).toBe(true);
}

/** Deterministic (seeded) and bounded, like the SQL robustness suite. */
describe("parsePrisma never throws on malformed input", () => {
  it("handles truncations and random corruptions of every fixture", () => {
    const start = performance.now();
    const rand = prng(20261116);
    for (const name of fixtures) {
      const text = readFileSync(new URL(name, FIXTURES), "utf8");
      for (let k = 0; k < 60; k++)
        expectImportResult(text.slice(0, Math.floor(rand() * text.length)));
      for (let k = 0; k < 60; k++) {
        let mutated = text;
        for (let m = 0; m < 3; m++) {
          const at = Math.floor(rand() * mutated.length);
          const insert = NASTY[Math.floor(rand() * NASTY.length)]!;
          mutated = mutated.slice(0, at) + insert + mutated.slice(at + Math.floor(rand() * 3));
        }
        expectImportResult(mutated);
      }
    }
    expect(performance.now() - start).toBeLessThan(2000);
  });

  it("handles random garbage", () => {
    const rand = prng(11);
    for (let k = 0; k < 200; k++) {
      let text = "";
      const len = Math.floor(rand() * 200);
      for (let c = 0; c < len; c++) {
        text +=
          rand() < 0.3
            ? NASTY[Math.floor(rand() * NASTY.length)]
            : String.fromCharCode(32 + Math.floor(rand() * 95));
      }
      expectImportResult(`model X {\n${text}`);
      expectImportResult(text);
    }
  });
});

/** ~500 KB: 500 models × 20 fields, each related to the previous one. */
function generateLargeSchema(models = 500): string {
  const out = ['datasource db {\n  provider = "postgresql"\n}'];
  for (let m = 0; m < models; m++) {
    const fields = ["  id Int @id @default(autoincrement())"];
    if (m > 0) {
      fields.push(`  parentId Int @map("parent_id")`);
      fields.push(`  parent Model${m - 1} @relation(fields: [parentId], references: [id])`);
    }
    if (m < models - 1) fields.push(`  children Model${m + 1}[]`);
    for (let f = 0; f < 17; f++)
      fields.push(`  field_number_${f} String @default("value_${m}_${f}") @db.VarChar(255)`);
    out.push(`model Model${m} {\n${fields.join("\n")}\n  @@map("table_${m}")\n}`);
  }
  return out.join("\n\n");
}

describe("parsePrisma performance", () => {
  it("parses a 500-model schema in under 1.5 s", () => {
    const text = generateLargeSchema();
    expect(text.length).toBeGreaterThan(500_000);
    const start = performance.now();
    const result = parsePrisma(text, { now: () => "t" });
    const elapsed = performance.now() - start;
    expect(result.ok).toBe(true);
    expect(result.schema?.tableOrder).toHaveLength(500);
    expect(Object.keys(result.schema?.relationships ?? {})).toHaveLength(499);
    expect(elapsed).toBeLessThan(1500);
  });
});
