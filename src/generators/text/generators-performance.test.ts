import { describe, expect, it } from "vitest";
import { generateSyntheticSchema } from "@/samples/synthetic";
import { generateSchemaText } from "./generate-text";
import type { GeneratorTarget } from "./types";

// P3-T04 budget: every text generator turns a 1,000-table schema into text well inside one second
// on a development machine; the limit here is loose (shared CI-like load).
const BUDGET_MS = 3000;

const TARGETS: [string, GeneratorTarget][] = [
  ["PostgreSQL", { kind: "sql", dialect: "postgresql" }],
  ["MySQL", { kind: "sql", dialect: "mysql" }],
  ["SQLite", { kind: "sql", dialect: "sqlite" }],
  ["Prisma", { kind: "prisma" }],
  ["Mermaid", { kind: "mermaid", columns: "all" }],
  ["JSON", { kind: "json" }],
];

describe("text generators on 1,000 tables", () => {
  const schema = generateSyntheticSchema({ tables: 1000, seed: 11 });
  for (const [name, target] of TARGETS) {
    it(`${name} stays under ${BUDGET_MS} ms`, () => {
      const start = performance.now();
      const out = generateSchemaText(schema, target);
      const ms = performance.now() - start;
      expect(out.text.length).toBeGreaterThan(10_000);
      expect(ms).toBeLessThan(BUDGET_MS);
    });
  }
});
