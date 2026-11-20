import { readFileSync } from "node:fs";
import { getViewportForBounds } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { layoutPacked } from "@/graph/layout-packed";
import { NODE_WIDTH, estimateNodeHeight, visibleColumns } from "@/graph/node-metrics";
import { parseSchemaText } from "@/parsers";
import { CANVAS_MIN_ZOOM } from "./zoom-detail";

describe("Reset view on GitLab (QA-035)", () => {
  it("fits the whole diagram in a 718 × 752 pane without hitting the minimum zoom", () => {
    const text = readFileSync(
      new URL("../../../tests/fixtures/real/gitlab-structure.postgres.sql", import.meta.url),
      "utf8",
    );
    const schema = parseSchemaText(text).result.schema!;
    const { positions } = layoutPacked(schema);
    let width = 0;
    let height = 0;
    for (const [id, p] of Object.entries(positions)) {
      const rows = visibleColumns(schema.tables[id]!, "full").length;
      width = Math.max(width, p.x + NODE_WIDTH);
      height = Math.max(height, p.y + estimateNodeHeight(rows));
    }
    // The fit options used by the canvas: padding 0.15, maxZoom 1.
    const fitted = getViewportForBounds({ x: 0, y: 0, width, height }, 718, 752, 0.0001, 1, 0.15);
    expect(fitted.zoom).toBeGreaterThan(CANVAS_MIN_ZOOM);
  }, 60_000);
});
