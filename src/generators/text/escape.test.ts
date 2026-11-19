import { describe, expect, it } from "vitest";
import { HOSTILE } from "@/test/hostile-schema";
import { mermaidString, prismaDocComment, prismaString, sqlLineComment, sqlString } from "./escape";
import { createWarnings, targetFile } from "./types";
import { isPrismaIdent, pascalCase, quoteIdent } from "./identifiers";

describe("sqlString", () => {
  it("doubles single quotes, and backslashes only for MySQL", () => {
    expect(sqlString("it's", "postgresql")).toBe("'it''s'");
    expect(sqlString("a\\b", "postgresql")).toBe("'a\\b'");
    expect(sqlString("a\\b", "sqlite")).toBe("'a\\b'");
    expect(sqlString("a\\b'c", "mysql")).toBe("'a\\\\b''c'");
  });
  it("keeps the hostile text inside one literal", () => {
    for (const d of ["postgresql", "mysql", "sqlite"] as const) {
      const lit = sqlString(HOSTILE, d);
      expect(lit.startsWith("'") && lit.endsWith("'")).toBe(true);
      // Every inner quote is doubled, so removing the doubled pairs leaves no lone quote.
      expect(lit.slice(1, -1).replace(/''/g, "")).not.toContain("'");
    }
  });
  it("drops NUL", () => {
    expect(sqlString("a\u0000b", "postgresql")).toBe("'ab'");
  });
});

describe("sqlLineComment", () => {
  it("prefixes every line so a newline cannot end the comment", () => {
    expect(sqlLineComment("one\ntwo\r\nthree")).toBe("-- one\n-- two\n-- three");
    for (const line of sqlLineComment(HOSTILE).split("\n"))
      expect(line.startsWith("--")).toBe(true);
  });
});

describe("prismaString / prismaDocComment", () => {
  it("escapes backslash, quote and newline", () => {
    expect(prismaString('a"b\\c\nd')).toBe('"a\\"b\\\\c\\nd"');
    const s = prismaString(HOSTILE);
    expect(s).not.toContain("\n");
    expect(s.slice(1, -1).replace(/\\\\|\\"|\\n/g, "")).not.toMatch(/["\\]/);
  });
  it("never contains a raw newline in a doc comment", () => {
    const c = prismaDocComment(`a\nb\r\nc ${HOSTILE}`);
    expect(c.startsWith("/// ")).toBe(true);
    expect(c).not.toMatch(/[\r\n]/);
  });
});

describe("mermaidString", () => {
  it("removes quotes and newlines", () => {
    const m = mermaidString(HOSTILE);
    expect(m).not.toMatch(/["\r\n]/);
    expect(mermaidString('  a "b"\n c ')).toBe("a 'b' c");
  });
});

describe("quoteIdent", () => {
  it("leaves plain lower-case names bare and quotes the rest", () => {
    expect(quoteIdent("users", "postgresql")).toBe("users");
    expect(quoteIdent("Users", "postgresql")).toBe('"Users"');
    expect(quoteIdent("order", "postgresql")).toBe('"order"');
    expect(quoteIdent("order", "mysql")).toBe("`order`");
    expect(quoteIdent("a b", "sqlite")).toBe('"a b"');
  });
  it("doubles the quote character", () => {
    expect(quoteIdent('a"b', "postgresql")).toBe('"a""b"');
    expect(quoteIdent("a`b", "mysql")).toBe("`a``b`");
    expect(quoteIdent(HOSTILE, "mysql").startsWith("`")).toBe(true);
  });
});

describe("prisma names", () => {
  it("pascal-cases and never returns an empty or digit-leading name", () => {
    expect(pascalCase("order_items")).toBe("OrderItems");
    expect(pascalCase("users")).toBe("Users");
    expect(pascalCase("UserRole")).toBe("UserRole");
    expect(pascalCase("日本")).toBe("Model");
    expect(pascalCase("2fa")).toBe("M2fa");
    expect(isPrismaIdent("Users")).toBe(true);
    expect(isPrismaIdent("a-b")).toBe(false);
  });
});

describe("types", () => {
  it("de-duplicates and sorts warnings", () => {
    const w = createWarnings();
    w.add("b");
    w.add("a");
    w.add("b");
    expect(w.list()).toEqual(["a", "b"]);
  });
  it("maps each target to an extension and mime type", () => {
    expect(targetFile({ kind: "sql", dialect: "mysql" }).extension).toBe("sql");
    expect(targetFile({ kind: "prisma" }).extension).toBe("prisma");
    expect(targetFile({ kind: "mermaid", columns: "all" }).extension).toBe("mmd");
    expect(targetFile({ kind: "json" }).mime).toBe("application/json");
  });
});
