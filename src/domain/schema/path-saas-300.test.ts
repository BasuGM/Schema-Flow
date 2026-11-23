import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSchemaText } from "@/parsers/parse-schema-text";
import { findPath } from "./path";

const text = readFileSync(
  new URL("../../../tests/fixtures/synthetic/saas-300.postgres.sql", import.meta.url),
  "utf8",
);
const schema = parseSchemaText(text, { now: () => "t" }).result.schema!;

/** The recount table in the P4-T02 handoff: Cowork recounts these with its own BFS. */
const PAIRS: [string, string, string[] | null][] = [
  ["core.t001_wide", "core.t068_entity", ["core.t001_wide", "core.t068_entity"]],
  [
    "core.t001_wide",
    "core.t079_entity",
    [
      "core.t001_wide",
      "core.t011_entity",
      "core.t037_entity",
      "core.t038_entity",
      "core.t079_entity",
    ],
  ],
  [
    "billing.t097_link",
    "analytics.t031_entity",
    [
      "billing.t097_link",
      "core.t053_entity",
      "core.t002_wide",
      "core.t009_entity",
      "core.t060_entity",
      "billing.t010_entity",
      "billing.t001_wide",
      "analytics.t031_entity",
    ],
  ],
  [
    "core.t007_link",
    "core.t001_wide",
    ["core.t007_link", "core.t002_wide", "core.t026_entity", "core.t001_wide"],
  ],
  ["core.t012_entity", "core.t001_wide", null],
];

describe("findPath on saas-300", () => {
  it.each(PAIRS)("%s → %s", (from, to, expected) => {
    const path = findPath(schema, from, to);
    expect(path?.tables ?? null).toEqual(expected);
    if (!path) return;
    expect(path.hops).toHaveLength(path.tables.length - 1);
    for (const hop of path.hops) {
      const r = schema.relationships[hop.relationshipId]!;
      const [fk, ref] = hop.direction === "references" ? [hop.from, hop.to] : [hop.to, hop.from];
      expect([r.from.tableId, r.to.tableId]).toEqual([fk, ref]);
    }
  });

  it("finds the same shortest length in both directions", () => {
    const a = findPath(schema, "billing.t097_link", "analytics.t031_entity")!;
    const b = findPath(schema, "analytics.t031_entity", "billing.t097_link")!;
    expect(b.hops).toHaveLength(a.hops.length);
  });
});
