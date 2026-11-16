import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prng } from "@/samples/synthetic";
import { parseSql } from "./parse-sql";

const FIXTURES = new URL("../../../tests/fixtures/sql/", import.meta.url);
const fixtures = readdirSync(FIXTURES).filter((f) => f.endsWith(".sql"));
const NASTY = [
  "'",
  '"',
  "`",
  "$$",
  "$a$",
  "(",
  ")",
  ";",
  "/*",
  "*/",
  "--",
  "\n",
  ",",
  "E'",
  "[",
  "::",
];

/** Per parse; each fixture parses in well under 100 ms. */
const PARSE_LIMIT_MS = 2000;

function expectImportResult(text: string): void {
  let result: ReturnType<typeof parseSql> | undefined;
  const start = performance.now();
  expect(() => (result = parseSql(text, { now: () => "t" })), text.slice(0, 80)).not.toThrow();
  // A super-linear blow-up (like QA-013's regex) fails here instead of hanging the run.
  expect(performance.now() - start, text.slice(0, 80)).toBeLessThan(PARSE_LIMIT_MS);
  expect(typeof result?.ok).toBe("boolean");
  expect(Array.isArray(result?.issues)).toBe(true);
}

/**
 * Deterministic (seeded) and bounded: about 1,000 parses in total, budgeted at ~2 s for the whole
 * file on the 8 GB development machine.
 */
describe("parseSql never throws on malformed input", () => {
  it("handles truncations and random corruptions of every fixture", () => {
    const start = performance.now();
    const rand = prng(20261113);
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
    const rand = prng(7);
    for (let k = 0; k < 200; k++) {
      let text = "";
      const len = Math.floor(rand() * 200);
      for (let c = 0; c < len; c++) {
        text +=
          rand() < 0.3
            ? NASTY[Math.floor(rand() * NASTY.length)]
            : String.fromCharCode(32 + Math.floor(rand() * 95));
      }
      expectImportResult(`CREATE TABLE x (${text}`);
      expectImportResult(text);
    }
  });
});
