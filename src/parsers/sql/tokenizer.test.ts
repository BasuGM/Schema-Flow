import { describe, expect, it } from "vitest";
import { tokenize } from "./tokenizer";

const kinds = (sql: string, dialect: "postgresql" | "mysql" | "sqlite" = "postgresql") =>
  tokenize(sql, dialect).tokens.map((t) => `${t.kind}:${t.value}`);

describe("tokenize", () => {
  it("produces words, punctuation, numbers and operators; drops whitespace and comments", () => {
    expect(kinds("CREATE TABLE t (a int, -- c\n b numeric(10, 2)); /* x */")).toEqual([
      "word:CREATE",
      "word:TABLE",
      "word:t",
      "punct:(",
      "word:a",
      "word:int",
      "punct:,",
      "word:b",
      "word:numeric",
      "punct:(",
      "number:10",
      "punct:,",
      "number:2",
      "punct:)",
      "punct:)",
      "punct:;",
    ]);
    expect(kinds("x::text >= 1.5e3")).toEqual([
      "word:x",
      "op:::",
      "word:text",
      "op:>",
      "op:=",
      "number:1.5e3",
    ]);
  });

  it("handles strings with doubled quotes and PostgreSQL E-strings", () => {
    expect(kinds("'it''s; ok' E'a\\'b'")).toEqual(["string:it's; ok", "string:a'b"]);
  });

  it("handles quoted identifiers per dialect", () => {
    expect(kinds('"Order ""Lines"""')).toEqual(['quoted:Order "Lines"']);
    expect(kinds('`order lines` "str"', "mysql")).toEqual(["quoted:order lines", "string:str"]);
    expect(kinds("[my col] `x`", "sqlite")).toEqual(["quoted:my col", "quoted:x"]);
  });

  it("handles dollar-quoted bodies (with and without tags)", () => {
    expect(kinds("AS $$ SELECT 1; $$ $fn$ a;b $fn$")).toEqual([
      "word:AS",
      "dollar: SELECT 1; ",
      "dollar: a;b ",
    ]);
  });

  it("supports nested block comments in PostgreSQL and # comments in MySQL", () => {
    expect(kinds("/* a /* b; */ c; */ x")).toEqual(["word:x"]);
    expect(kinds("# note; here\nx", "mysql")).toEqual(["word:x"]);
  });

  it("skips a leading byte-order mark without shifting offsets or lines (QA-007)", () => {
    const { tokens, issues } = tokenize("\uFEFFCREATE\nTABLE", "postgresql");
    expect(issues).toEqual([]);
    expect(tokens.map((t) => [t.text, t.offset, t.line])).toEqual([
      ["CREATE", 1, 1],
      ["TABLE", 8, 2],
    ]);
  });

  it("tracks line numbers", () => {
    const { tokens } = tokenize("a\n'multi\nline'\n  b", "postgresql");
    expect(tokens.map((t) => t.line)).toEqual([1, 2, 4]);
  });

  it("reports unterminated constructs instead of throwing", () => {
    for (const sql of ["'open", '"open', "/* open", "$$ open", "E'open"]) {
      const { issues } = tokenize(sql, "postgresql");
      expect(issues).toHaveLength(1);
      expect(issues[0]?.message).toMatch(/^Unterminated/);
    }
  });
});
