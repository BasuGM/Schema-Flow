import { describe, expect, it } from "vitest";
import { normalizeSchema } from "./normalize";
import { findPath } from "./path";
import { draft } from "./test-helpers";

const t = (name: string, refs: string[] = []) => ({
  name,
  columns: [
    { name: "id", type: "int", primaryKey: true },
    ...refs.map((r) => ({ name: `${r}_id`, type: "int", references: { table: r } })),
  ],
});

// a -> b -> c -> d, e -> b, f isolated, c self-references
const chain = normalizeSchema(
  draft([t("a", ["b"]), t("b", ["c"]), t("c", ["d", "c"]), t("d"), t("e", ["b"]), t("f")]),
);

describe("findPath", () => {
  it("walks a direct foreign key in both directions", () => {
    const forward = findPath(chain, "a", "b")!;
    expect(forward.tables).toEqual(["a", "b"]);
    expect(forward.hops.map((h) => h.direction)).toEqual(["references"]);
    const back = findPath(chain, "b", "a")!;
    expect(back.tables).toEqual(["b", "a"]);
    expect(back.hops.map((h) => h.direction)).toEqual(["referenced-by"]);
    expect(back.hops[0]!.relationshipId).toBe(forward.hops[0]!.relationshipId);
  });

  it("finds multi-hop chains with mixed directions", () => {
    const path = findPath(chain, "a", "e")!;
    expect(path.tables).toEqual(["a", "b", "e"]);
    expect(path.hops.map((h) => h.direction)).toEqual(["references", "referenced-by"]);
    expect(findPath(chain, "a", "d")!.tables).toEqual(["a", "b", "c", "d"]);
  });

  it("returns the table alone for the same table and null for unknown or unreachable", () => {
    expect(findPath(chain, "a", "a")).toEqual({ tables: ["a"], hops: [] });
    expect(findPath(chain, "a", "f")).toBeNull();
    expect(findPath(chain, "a", "nope")).toBeNull();
    expect(findPath(chain, "nope", "a")).toBeNull();
  });

  it("ignores self-references", () => {
    const path = findPath(chain, "c", "c")!;
    expect(path.hops).toEqual([]);
    expect(findPath(chain, "b", "d")!.hops).toHaveLength(2);
  });

  it("prefers the shorter route", () => {
    // x -> y -> z, and a longer x -> p -> q -> z
    const s = normalizeSchema(
      draft([t("z"), t("y", ["z"]), t("x", ["y", "p"]), t("q", ["z"]), t("p", ["q"])]),
    );
    expect(findPath(s, "x", "z")!.tables).toEqual(["x", "y", "z"]);
  });

  it("breaks ties by table order: the first-discovered parent wins", () => {
    // s reaches u through m1 or m2 (same length); m1 comes first in tableOrder.
    const s = normalizeSchema(
      draft([t("u"), t("m1", ["u"]), t("m2", ["u"]), t("s", ["m2", "m1"])]),
    );
    expect(findPath(s, "s", "u")!.tables).toEqual(["s", "m1", "u"]);
    // Reversed table order flips the winner.
    const r = normalizeSchema(
      draft([t("u"), t("m2", ["u"]), t("m1", ["u"]), t("s", ["m2", "m1"])]),
    );
    expect(findPath(r, "s", "u")!.tables).toEqual(["s", "m2", "u"]);
  });

  it("picks the lowest relationship id among parallel foreign keys", () => {
    const s = normalizeSchema(
      draft([
        t("u"),
        {
          name: "o",
          columns: [
            { name: "id", type: "int", primaryKey: true },
            { name: "created_by", type: "int", references: { table: "u" } },
            { name: "updated_by", type: "int", references: { table: "u" } },
          ],
        },
      ]),
    );
    const ids = Object.keys(s.relationships).sort();
    expect(ids).toHaveLength(2);
    expect(findPath(s, "o", "u")!.hops[0]!.relationshipId).toBe(ids[0]);
  });

  it("travels through a join table", () => {
    const s = normalizeSchema(
      draft([
        t("users"),
        t("groups"),
        {
          name: "_users_groups",
          columns: [
            { name: "user_id", type: "int", references: { table: "users" } },
            { name: "group_id", type: "int", references: { table: "groups" } },
          ],
        },
      ]),
    );
    const path = findPath(s, "users", "groups")!;
    expect(path.tables).toEqual(["users", "_users_groups", "groups"]);
    expect(path.hops.map((h) => h.direction)).toEqual(["referenced-by", "references"]);
  });
});
