import { describe, expect, it } from "vitest";
import { normalizeSchema } from "./normalize";
import {
  getAdjacency,
  getFocusSet,
  getIncomingRelationships,
  getNeighbors,
  getOutgoingRelationships,
} from "./selectors";
import { draft } from "./test-helpers";

// a -> b -> c -> d, e -> b, f isolated, c self-references
const t = (name: string, refs: string[] = []) => ({
  name,
  columns: [
    { name: "id", type: "int", primaryKey: true },
    ...refs.map((r) => ({ name: `${r}_id`, type: "int", references: { table: r } })),
  ],
});
const schema = normalizeSchema(
  draft([t("a", ["b"]), t("b", ["c"]), t("c", ["d", "c"]), t("d"), t("e", ["b"]), t("f")]),
);

describe("relationship selectors", () => {
  it("returns outgoing and incoming relationships", () => {
    expect(getOutgoingRelationships(schema, "c").map((r) => r.to.tableId)).toEqual(["d", "c"]);
    expect(getIncomingRelationships(schema, "b").map((r) => r.from.tableId)).toEqual(["a", "e"]);
    expect(getIncomingRelationships(schema, "f")).toEqual([]);
  });
});

describe("getNeighbors", () => {
  it("follows relationships in both directions up to depth", () => {
    expect([...getNeighbors(schema, "b")].sort()).toEqual(["a", "c", "e"]);
    expect([...getNeighbors(schema, "b", 2)].sort()).toEqual(["a", "c", "d", "e"]);
    expect([...getNeighbors(schema, "a", 0)]).toEqual([]);
  });

  it("excludes the start table even when self-referencing", () => {
    expect([...getNeighbors(schema, "c")].sort()).toEqual(["b", "d"]);
  });

  it("returns empty sets for isolated or unknown tables", () => {
    expect(getNeighbors(schema, "f").size).toBe(0);
    expect(getNeighbors(schema, "zzz", 3).size).toBe(0);
  });
});

describe("getFocusSet", () => {
  const sorted = (set: ReadonlySet<string> | null) => (set ? [...set].sort() : null);

  it("is the table plus its neighbours up to depth; depth 0 is off", () => {
    expect(sorted(getFocusSet(schema, "b", 1))).toEqual(["a", "b", "c", "e"]);
    expect(sorted(getFocusSet(schema, "b", 2))).toEqual(["a", "b", "c", "d", "e"]);
    expect(getFocusSet(schema, "b", 0)).toBeNull();
  });

  it("handles self-references, cycles, isolated and unknown tables", () => {
    expect(sorted(getFocusSet(schema, "c", 1))).toEqual(["b", "c", "d"]);
    const cyclic = normalizeSchema(draft([t("x", ["y"]), t("y", ["z"]), t("z", ["x"])]));
    expect(sorted(getFocusSet(cyclic, "x", 2))).toEqual(["x", "y", "z"]);
    expect(sorted(getFocusSet(schema, "f", 2))).toEqual(["f"]);
    expect(getFocusSet(schema, "zzz", 1)).toBeNull();
  });

  it("caches the adjacency per schema object", () => {
    expect(getAdjacency(schema)).toBe(getAdjacency(schema));
    expect(getAdjacency(structuredClone(schema))).not.toBe(getAdjacency(schema));
  });
});
