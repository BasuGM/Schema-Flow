import { describe, expect, it } from "vitest";
import { normalizeSchema } from "./normalize";
import { getIncomingRelationships, getNeighbors, getOutgoingRelationships } from "./selectors";
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
