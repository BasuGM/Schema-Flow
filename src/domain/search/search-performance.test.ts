import { describe, expect, it } from "vitest";
import type { DraftTable } from "@/domain/schema/draft";
import { normalizeSchema } from "@/domain/schema/normalize";
import { buildSearchIndex } from "./search-index";
import { search } from "./search";

/** Fastest of up to 3 runs, retrying only when over budget (parallel test workers add noise). */
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

const WORDS = ["user", "order", "item", "product", "invoice", "account", "event", "audit"];

/**
 * 2,000 tables × 20 columns (40,000 columns), snake_case names. Every column name is distinct
 * (the worst case: real schemas repeat `id`, `created_at`, … and each distinct name is matched
 * once per query).
 */
function bigSchema() {
  const tables: DraftTable[] = Array.from({ length: 2000 }, (_, t) => ({
    name: `${WORDS[t % WORDS.length]}_${WORDS[(t * 7) % WORDS.length]}_${t}`,
    columns: Array.from({ length: 20 }, (_, c) => ({
      name: `${WORDS[(t + c) % WORDS.length]}_${c % 3 ? "id" : "name"}_${t}_${c}`,
      type: "int",
      nullable: true,
    })),
  }));
  return normalizeSchema({
    name: "big",
    source: { format: "sample", importedAt: "2026-01-01T00:00:00.000Z" },
    tables,
  });
}

describe("search performance (2,000 tables × 20 columns)", () => {
  const schema = bigSchema();

  it("builds the index in under 150 ms", () => {
    const { value, ms } = timed(() => buildSearchIndex(schema), 150);
    expect(value.columns).toHaveLength(40_000);
    expect(ms).toBeLessThan(150);
  });

  it("answers each query in under 30 ms, keeping only the top 50", () => {
    const index = buildSearchIndex(schema);
    for (const q of ["u", "id", "user", "ord.user", "uid", "ordit", "order user id", "zzzz", "_"]) {
      const { value, ms } = timed(() => search(index, q), 30);
      expect(ms, q).toBeLessThan(30);
      expect(value.columns.length).toBeLessThanOrEqual(50);
    }
  });
});
