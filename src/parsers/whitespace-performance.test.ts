import { describe, expect, it } from "vitest";
import { detectFormat } from "./detect-format";
import { parseSchemaText, type ImportFormatChoice } from "./parse-schema-text";
import { classifyDefault } from "./sql/parse-default";

const FIVE_MB = 5 * 1024 * 1024;
const fill = (unit: string) => unit.repeat(Math.floor(FIVE_MB / unit.length));

/**
 * Fastest of up to 3 runs, retrying only when over budget: a quadratic regression is slow on every
 * run, while a one-off stall caused by other test workers on the shared machine is not (seen once
 * in a full parallel `npm run check`).
 */
function timed<T>(fn: () => T, budgetMs: number): { value: T; ms: number } {
  let best: { value: T; ms: number } | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const start = performance.now();
    const value = fn();
    const ms = performance.now() - start;
    if (!best || ms < best.ms) best = { value, ms };
    if (ms < budgetMs) break;
  }
  return best!;
}

/**
 * QA-013: `^\s*` under the /m flag backtracked quadratically on long runs of blank lines (80,000
 * newlines took seconds; ~1 MB hung the tab). 5 MB is the import cap.
 */
describe("long runs of blank or whitespace-only lines (QA-013)", () => {
  it.each([
    ["\\n", "\n"],
    ["space + \\n", " \n"],
  ])("5 MB of %s parses in under 1 s in every format", (_label, unit) => {
    const blank = fill(unit);
    const cases: [ImportFormatChoice, string, number][] = [
      ["auto", "", 0],
      ["postgresql", "", 0],
      ["prisma", "", 0],
      ["auto", "CREATE TABLE a (id int);\n", 1],
      ["auto", "model A {\n  id Int @id\n}\n", 1],
    ];
    for (const [format, prefix, tables] of cases) {
      const { value, ms } = timed(() => parseSchemaText(prefix + blank, { format }), 1000);
      expect(ms, `${format} ${JSON.stringify(prefix)}`).toBeLessThan(1000);
      expect(value.result.schema?.tableOrder.length ?? 0).toBe(tables);
    }
  });

  it("detects the format of the reported repro instantly", () => {
    const { value, ms } = timed(
      () => detectFormat(`CREATE TABLE a (id int);${"\n".repeat(80_000)}`),
      100,
    );
    expect(value).toEqual({ format: "sql", dialect: "postgresql" });
    expect(ms).toBeLessThan(100);
  });

  it("strips a cast followed by a long run of spaces without backtracking (audit)", () => {
    const { value, ms } = timed(() => classifyDefault(`'x'::text${" ".repeat(50_000)}(`), 100);
    expect(value.kind).toBe("expression");
    expect(ms).toBeLessThan(100);
    expect(classifyDefault("'a'::character varying").value).toBe("'a'");
    expect(classifyDefault("'2020-01-01'::timestamp with time zone").value).toBe("'2020-01-01'");
    expect(classifyDefault("'{}'::text[]").value).toBe("'{}'");
    expect(classifyDefault("(0)::numeric(10, 2)").value).toBe("0");
  });
});
