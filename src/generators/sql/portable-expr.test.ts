import { describe, expect, it } from "vitest";
import { portableExpression } from "./portable-expr";

const sql = (expr: string, to: "mysql" | "sqlite") => {
  const r = portableExpression(expr, to);
  return r.ok ? r.sql : null;
};

describe("portableExpression (QA-031)", () => {
  it("strips simple and multi-word casts", () => {
    expect(sql("(status <> ''::text)", "sqlite")).toBe("(status <> '')");
    expect(sql("(a = 'x'::character varying(255))", "sqlite")).toBe("(a = 'x')");
    expect(sql("(t > '2020-01-01'::timestamp without time zone)", "mysql")).toBe(
      "(t > '2020-01-01')",
    );
    expect(sql("(a = '{}'::integer[])", "sqlite")).toBe("(a = '{}')");
    expect(sql("(n > (0)::numeric(10, 2))", "sqlite")).toBe("(n > (0))");
    expect(sql("(x = 'a'::public.my_enum)", "sqlite")).toBe("(x = 'a')");
  });

  it("leaves text inside string literals and quoted identifiers alone", () => {
    expect(sql("(ip <> '::/0')", "sqlite")).toBe("(ip <> '::/0')");
    expect(sql("(a ~ 1)", "sqlite")).toBeNull();
    expect(sql("(a = 'x ~ y')", "sqlite")).toBe("(a = 'x ~ y')");
    expect(sql("(a = 'it''s ~ ok')", "sqlite")).toBe("(a = 'it''s ~ ok')");
    expect(sql('("we::ird" > 0)', "sqlite")).toBe('("we::ird" > 0)');
    expect(sql("(a = $q$it's ~ here$q$)", "sqlite")).toBe("(a = 'it''s ~ here')");
  });

  it("maps char_length per dialect and never touches names that merely contain it", () => {
    expect(sql("(char_length(a) <= 10)", "sqlite")).toBe("(length(a) <= 10)");
    expect(sql("(char_length(a) <= 10)", "mysql")).toBe("(char_length(a) <= 10)");
    expect(sql("(length(a) <= 10)", "mysql")).toBe("(char_length(a) <= 10)");
    expect(sql("(my_char_length(a) <= 10)", "sqlite")).toBeNull();
  });

  it("re-quotes identifiers and string backslashes for MySQL", () => {
    expect(sql('("order" > 0)', "mysql")).toBe("(`order` > 0)");
    expect(sql("(a <> '\\x00')", "mysql")).toBe("(a <> '\\\\x00')");
    expect(sql("(a <> '\\x00')", "sqlite")).toBe("(a <> '\\x00')");
  });

  it.each([
    "(num_nonnulls(a, b) = 1)",
    "(jsonb_typeof(a) = 'object'::text)",
    "(cardinality(a) <= 3)",
    "(a ~ '^[0-9]+$'::text)",
    "(a !~ 'x')",
    "(a ~* 'x')",
    "(a = ANY (ARRAY['x'::text, 'y'::text]))",
    "(a ILIKE 'x')",
    "(a IS DISTINCT FROM b)",
    "(length(TRIM(BOTH FROM a)) >= 1)",
    "(a @> b)",
    "(e = E'a\\nb')",
    "(a = 'unterminated)",
    "(a = $q$unterminated)",
    "(a > 1 -- why\n)",
    "(a > 1 /* why */)",
    "(date_trunc('day'::text, a) = a)",
  ])("leaves out %s", (expr) => {
    expect(portableExpression(expr, "sqlite")).toEqual({ ok: false });
    expect(portableExpression(expr, "mysql")).toEqual({ ok: false });
  });

  it("allows || (concatenation) for SQLite only", () => {
    expect(sql("(a || b = 'x')", "sqlite")).toBe("(a || b = 'x')");
    expect(sql("(a || b = 'x')", "mysql")).toBeNull();
  });

  it("leaves out functions that are not on the shared list (octet_length)", () => {
    expect(portableExpression("(octet_length(a) <= 8)", "sqlite")).toEqual({ ok: false });
  });
});
