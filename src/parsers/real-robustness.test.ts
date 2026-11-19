import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prng } from "@/samples/synthetic";
import { parseSchemaText } from "./parse-schema-text";

const REAL = new URL("../../tests/fixtures/real/", import.meta.url);
const files = readdirSync(REAL).filter((f) => /\.(sql|prisma)$/.test(f));
/** CPU ms per parse: a hang detector, not a perf budget (GitLab, 2.8 MB, takes about 0.4 s). */
const PARSE_LIMIT_MS = 5000;
const NASTY = ["'", '"', "`", "$$", "(", ")", ";", "/*", "*/", "/*!", "--", "{", "}", "@@", "\n"];

function expectParses(text: string): void {
  const start = process.cpuUsage();
  let ok: unknown;
  expect(() => (ok = parseSchemaText(text, { now: () => "t" }).result.ok)).not.toThrow();
  expect(typeof ok).toBe("boolean");
  const { user, system } = process.cpuUsage(start);
  // CPU time, not wall time: parallel test workers can starve a parse for seconds.
  expect((user + system) / 1000, text.slice(0, 80)).toBeLessThan(PARSE_LIMIT_MS);
}

/**
 * The real-world fixtures, truncated and corrupted. Seeded, so deterministic. Multi-megabyte files
 * get fewer cuts (each parse of the GitLab dump costs ~0.4 s); the whole file adds about 4 s to
 * the test run on the development machine.
 */
describe("real-world fixtures never make the parsers throw", () => {
  it.each(files)(
    "%s survives truncations and corruptions",
    (name) => {
      const url = new URL(name, REAL);
      const text = readFileSync(url, "utf8");
      const cuts = statSync(url).size > 1_000_000 ? 6 : 30;
      const rand = prng(20261116);
      for (let k = 0; k < cuts; k++) expectParses(text.slice(0, Math.floor(rand() * text.length)));
      for (let k = 0; k < cuts; k++) {
        let mutated = text;
        for (let m = 0; m < 5; m++) {
          const at = Math.floor(rand() * mutated.length);
          const insert = NASTY[Math.floor(rand() * NASTY.length)]!;
          mutated = mutated.slice(0, at) + insert + mutated.slice(at + Math.floor(rand() * 3));
        }
        expectParses(mutated);
      }
    },
    60_000,
  );
});
