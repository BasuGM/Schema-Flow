import { describe, expect, it } from "vitest";
import { NameLookup, columnId, relationshipId, tableId, uniqueId } from "./ids";

describe("id builders", () => {
  it("builds schema-qualified and bare table ids", () => {
    expect(tableId("users", "public")).toBe("public.users");
    expect(tableId("users")).toBe("users");
  });

  it("builds column and relationship ids deterministically", () => {
    expect(columnId("public.users", "id")).toBe("public.users.id");
    expect(relationshipId("public.orders", ["user_id"], "public.users")).toBe(
      "fk:public.orders(user_id)->public.users",
    );
    expect(relationshipId("a", ["x", "y"], "b")).toBe(relationshipId("a", ["x", "y"], "b"));
  });

  it("makes ids unique by suffixing", () => {
    const taken = new Set(["a", "a#2"]);
    expect(uniqueId("b", taken)).toBe("b");
    expect(uniqueId("a", taken)).toBe("a#3");
  });
});

describe("NameLookup", () => {
  it("looks up names case-insensitively", () => {
    const lookup = new NameLookup([["Users", 1] as const]);
    expect(lookup.get("users")).toBe(1);
    expect(lookup.get("USERS")).toBe(1);
    expect(lookup.has("uSeRs")).toBe(true);
    expect(lookup.get("orders")).toBeUndefined();
  });

  it("keeps the first value and flags case-only duplicates as ambiguous", () => {
    const lookup = new NameLookup([["Users", 1] as const, ["users", 2] as const]);
    expect(lookup.get("users")).toBe(1);
    expect(lookup.isAmbiguous("USERS")).toBe(true);
    expect(lookup.isAmbiguous("orders")).toBe(false);
  });
});
