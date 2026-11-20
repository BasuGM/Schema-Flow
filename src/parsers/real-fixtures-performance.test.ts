import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { layoutPacked } from "@/graph/layout-packed";
import { schemaToFlow } from "@/graph/schema-to-flow";
import { parseSchemaText } from "./parse-schema-text";

const GITLAB = new URL("../../tests/fixtures/real/gitlab-structure.postgres.sql", import.meta.url);

/**
 * The largest real fixture (GitLab, 2.8 MB, 992 tables, 1,720 relationships), all on the main
 * thread. Measured on the development machine (M1, 8 GB): parse ≈ 0.4 s, layout ≈ 2.5 s,
 * schemaToFlow ≈ 10 ms. Budgets are about 3× that. Because the total is far over 200 ms, the
 * import dialog shows "Laying out N tables…" before the layout runs (BUSY_IMPORT_TABLES).
 */
describe("GitLab structure.sql on the main thread", () => {
  const text = readFileSync(GITLAB, "utf8");

  it("parses, lays out and converts within budget", () => {
    let start = performance.now();
    const schema = parseSchemaText(text).result.schema!;
    const parseMs = performance.now() - start;

    start = performance.now();
    const layout = layoutPacked(schema);
    const layoutMs = performance.now() - start;

    start = performance.now();
    const flow = schemaToFlow(schema, { ...layout, collapsed: {} });
    const flowMs = performance.now() - start;

    console.info(
      `GitLab: parse ${Math.round(parseMs)} ms, layout ${Math.round(layoutMs)} ms, flow ${Math.round(flowMs)} ms`,
    );
    expect(flow.nodes).toHaveLength(992);
    const xs = flow.nodes.map((n) => n.position.x);
    const ys = flow.nodes.map((n) => n.position.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    console.info(`GitLab packed extent ≈ ${w} × ${h} px (tables' top-left corners)`);
    expect(Math.max(w, h) / Math.min(w, h)).toBeLessThan(3);
    expect(parseMs).toBeLessThan(1200);
    expect(layoutMs).toBeLessThan(7500);
    expect(flowMs).toBeLessThan(100);
  }, 30_000);
});
