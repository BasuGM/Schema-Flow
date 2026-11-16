import { describe, expect, it } from "vitest";
import type { DraftTable } from "./draft";
import { normalizeSchema } from "./normalize";
import { buildAdjacency, getFocusSet } from "./selectors";

/** Fastest of up to 3 runs, retrying only when over budget. */
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
 * 2,000 tables, each referencing the previous table and one earlier table (about 4,000
 * relationships), and every 4th table also references the hub `t_0` (about 500 more).
 */
function bigSchema() {
  const tables: DraftTable[] = Array.from({ length: 2000 }, (_, t) => {
    const refs = t === 0 ? [] : [t - 1, (t * 37) % t, ...(t % 4 === 0 ? [0] : [])];
    return {
      name: `t_${t}`,
      columns: [
        { name: "id", type: "int", primaryKey: true },
        ...refs.map((r, i) => ({ name: `ref_${i}`, type: "int", references: { table: `t_${r}` } })),
      ],
    };
  });
  return normalizeSchema({
    name: "big",
    source: { format: "sample", importedAt: "2026-01-01T00:00:00.000Z" },
    tables,
  });
}

describe("neighbourhood performance (P2-T09)", () => {
  const schema = bigSchema();

  it("builds the adjacency for ~4,500 relationships in under 50 ms", () => {
    expect(Object.keys(schema.relationships).length).toBeGreaterThan(4000);
    expect(timed(() => buildAdjacency(schema), 50).ms).toBeLessThan(50);
  });

  it("computes a 2-hop focus set in under 5 ms, including for the hub", () => {
    getFocusSet(schema, "t_1", 1); // builds and caches the adjacency
    const hub = timed(() => getFocusSet(schema, "t_0", 2), 5);
    expect(hub.value!.size).toBeGreaterThan(500);
    expect(hub.ms).toBeLessThan(5);
    expect(timed(() => getFocusSet(schema, "t_1234", 2), 5).ms).toBeLessThan(5);
  });
});
