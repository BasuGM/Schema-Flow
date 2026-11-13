import { describe, expect, it } from "vitest";
import { validateSchema } from "@/domain/schema/validate";
import { parseSampleRequest, createSample } from "./resolve-sample";
import { clampTableCount, generateSyntheticSchema } from "./synthetic";

describe("generateSyntheticSchema", () => {
  it("generates the requested number of valid tables", () => {
    const s = generateSyntheticSchema({ tables: 200 });
    expect(s.tableOrder).toHaveLength(200);
    expect(s.issues).toEqual([]);
    expect(validateSchema(s)).toEqual([]);
    expect(Object.keys(s.relationships).length).toBeGreaterThan(150);
  });

  it("is deterministic per seed", () => {
    const a = generateSyntheticSchema({ tables: 30, seed: 3 });
    expect(generateSyntheticSchema({ tables: 30, seed: 3 })).toEqual(a);
    expect(generateSyntheticSchema({ tables: 30, seed: 4 })).not.toEqual(a);
  });

  it("clamps table counts", () => {
    expect(clampTableCount(0)).toBe(1);
    expect(clampTableCount(5000)).toBe(1000);
    expect(clampTableCount(Number.NaN)).toBe(50);
  });
});

describe("sample requests", () => {
  it("parses query strings", () => {
    expect(parseSampleRequest("")).toEqual({ kind: "ecommerce" });
    expect(parseSampleRequest("?sample=other")).toEqual({ kind: "ecommerce" });
    expect(parseSampleRequest("?sample=synthetic&tables=200")).toEqual({
      kind: "synthetic",
      tables: 200,
      seed: 1,
    });
    expect(parseSampleRequest("?sample=synthetic&tables=x&seed=9")).toEqual({
      kind: "synthetic",
      tables: 50,
      seed: 9,
    });
  });

  it("creates the requested sample", () => {
    expect(createSample({ kind: "ecommerce" }).tableOrder).toHaveLength(12);
    expect(createSample({ kind: "synthetic", tables: 5, seed: 1 }).tableOrder).toHaveLength(5);
  });
});
