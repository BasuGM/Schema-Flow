import { describe, expect, it } from "vitest";
import { fingerprintSchema, hashString } from "./fingerprint";
import { normalizeSchema } from "./normalize";
import { draft } from "./test-helpers";

describe("hashString", () => {
  it("is deterministic and sensitive to input", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).not.toBe(hashString("abd"));
    expect(hashString("abc", 1)).not.toBe(hashString("abc"));
  });
});

describe("fingerprintSchema", () => {
  const a = {
    name: "a",
    columns: [
      { name: "id", type: "int" },
      { name: "b_id", type: "int" },
    ],
  };
  const b = { name: "b", columns: [{ name: "id", type: "int" }] };

  it("ignores declaration order, types, case and metadata", () => {
    const one = normalizeSchema(draft([a, b]));
    const two = normalizeSchema({
      ...draft([
        b,
        {
          name: "A",
          columns: [
            { name: "B_ID", type: "text" },
            { name: "id", type: "uuid" },
          ],
        },
      ]),
      name: "other",
    });
    expect(fingerprintSchema(one)).toBe(fingerprintSchema(two));
    expect(fingerprintSchema(one)).toMatch(/^sf1-[0-9a-z]+$/);
  });

  it("changes when tables or columns change", () => {
    const one = fingerprintSchema(normalizeSchema(draft([a, b])));
    expect(fingerprintSchema(normalizeSchema(draft([a])))).not.toBe(one);
    expect(
      fingerprintSchema(
        normalizeSchema(draft([a, { name: "b", columns: [{ name: "id2", type: "int" }] }])),
      ),
    ).not.toBe(one);
  });
});
