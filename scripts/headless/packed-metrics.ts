// Prints the packed layout size of a SQL fixture: width, height, area, aspect and overlap count.
// Used by BB-P3 to check a layout change does not make in-scope schemas worse.
//   node --experimental-transform-types --no-warnings --import ./scripts/headless/alias-hook.mjs \
//     scripts/headless/packed-metrics.ts <fixture>
import { readFileSync } from "node:fs";
import { layoutPacked } from "@/graph/layout-packed";
import { NODE_WIDTH, estimateNodeHeight, visibleColumns } from "@/graph/node-metrics";
import { parseSchemaText } from "@/parsers";

const path = process.argv[2]!;
const { result } = parseSchemaText(readFileSync(path, "utf8"), { now: () => "t" });
const schema = result.schema!;
const { positions } = layoutPacked(schema);
const boxes = Object.entries(positions).map(([id, p]) => {
  const t = schema.tables[id]!;
  return { x: p.x, y: p.y, w: NODE_WIDTH, h: estimateNodeHeight(visibleColumns(t, "full").length) };
});
let overlaps = 0;
for (let i = 0; i < boxes.length; i++)
  for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i]!;
    const b = boxes[j]!;
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps++;
  }
const width = Math.max(...boxes.map((b) => b.x + b.w));
const height = Math.max(...boxes.map((b) => b.y + b.h));
console.log(JSON.stringify({ tables: boxes.length, width, height, area: width * height, overlaps }));
