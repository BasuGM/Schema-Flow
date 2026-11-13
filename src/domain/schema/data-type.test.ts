import { describe, expect, it } from "vitest";
import { parseDataType } from "./data-type";

describe("parseDataType", () => {
  it.each([
    ["integer", { raw: "integer", base: "integer" }],
    ["VARCHAR(255)", { raw: "VARCHAR(255)", base: "varchar", params: ["255"] }],
    ["numeric(10, 2)", { raw: "numeric(10, 2)", base: "numeric", params: ["10", "2"] }],
    ["text[]", { raw: "text[]", base: "text", isArray: true }],
    [
      "timestamp with time zone",
      { raw: "timestamp with time zone", base: "timestamp with time zone" },
    ],
    ["  bigint  ", { raw: "bigint", base: "bigint" }],
  ])("parses %s", (raw, expected) => {
    expect(parseDataType(raw)).toEqual(expected);
  });

  it("links enum types case-insensitively via the resolver", () => {
    const type = parseDataType("Order_Status", (n) =>
      n.toLowerCase() === "order_status" ? "order_status" : undefined,
    );
    expect(type.enumName).toBe("order_status");
  });

  it("never throws on odd input", () => {
    expect(parseDataType("(")).toEqual({ raw: "(", base: "(" });
    expect(parseDataType("")).toEqual({ raw: "", base: "" });
  });
});
