import { describe, expect, it } from "vitest";
import { classifyDefault, isSerialType } from "./parse-default";

describe("classifyDefault", () => {
  it.each([
    ["'pending'::order_status", "literal", "'pending'"],
    ["'USD'::bpchar", "literal", "'USD'"],
    ["0", "literal", "0"],
    ["-1.5", "literal", "-1.5"],
    ["false", "literal", "false"],
    ["NULL", "literal", "NULL"],
    ["('x'::text)", "literal", "'x'"],
    ["now()", "function", "now()"],
    ["gen_random_uuid()", "function", "gen_random_uuid()"],
    ["CURRENT_TIMESTAMP", "expression", "CURRENT_TIMESTAMP"],
    ["CURRENT_DATE", "expression", "CURRENT_DATE"],
    ["(datetime('now'))", "function", "datetime('now')"],
    [
      "nextval('public.accounts_id_seq'::regclass)",
      "autoincrement",
      "nextval('public.accounts_id_seq'::regclass)",
    ],
    ["1 + 2", "expression", "1 + 2"],
  ])("%s → %s", (raw, kind, value) => {
    expect(classifyDefault(raw)).toEqual({ kind, value });
  });

  it("recognises serial pseudo-types", () => {
    expect(["serial", "bigserial", "smallserial", "serial4", "SERIAL8"].every(isSerialType)).toBe(
      true,
    );
    expect(isSerialType("integer")).toBe(false);
  });
});
