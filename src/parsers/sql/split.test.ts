import { describe, expect, it } from "vitest";
import { splitStatements } from "./split";

describe("splitStatements", () => {
  it("splits on top-level semicolons only", () => {
    const sql = [
      "CREATE TABLE a (s text DEFAULT 'x;y'); -- comment; here",
      '/* block; */ CREATE TABLE "b;c" (id int);',
      "CREATE FUNCTION f() AS $$ SELECT 1; SELECT 2; $$;",
      "CREATE TABLE d (id int)",
    ].join("\n");
    const { statements, issues } = splitStatements(sql, "postgresql");
    expect(issues).toEqual([]);
    expect(statements.map((s) => s.startLine)).toEqual([1, 2, 3, 4]);
    expect(statements[0]?.text).toBe("CREATE TABLE a (s text DEFAULT 'x;y')");
    expect(statements[2]?.text).toContain("SELECT 2;");
  });

  it("drops empty statements", () => {
    expect(splitStatements(";;\n;  ; /* only a comment */;", "postgresql").statements).toEqual([]);
  });

  it("reports MySQL DELIMITER blocks", () => {
    const { issues } = splitStatements("DELIMITER //\nCREATE TABLE a (id int);", "mysql");
    expect(issues[0]?.message).toContain("DELIMITER");
    expect(issues[0]?.line).toBe(1);
  });
});
