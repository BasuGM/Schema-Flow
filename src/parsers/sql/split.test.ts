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

  it("honours MySQL DELIMITER lines around procedure bodies", () => {
    const sql = [
      "CREATE TABLE a (id int);",
      "DELIMITER //",
      "CREATE PROCEDURE p() BEGIN CREATE TEMPORARY TABLE t (x int); SELECT 1; END//",
      "DELIMITER ;;",
      "CREATE TRIGGER tr BEFORE INSERT ON a FOR EACH ROW BEGIN SET NEW.id = 1; END;;",
      "DELIMITER $$",
      "CREATE FUNCTION f() RETURNS int BEGIN RETURN 1; END $$",
      "DELIMITER ;",
      "CREATE TABLE b (id int);",
    ].join("\n");
    const { statements, issues } = splitStatements(sql, "mysql");
    expect(issues).toEqual([]);
    expect(statements.map((s) => s.text.split(/\s+/).slice(0, 2).join(" "))).toEqual([
      "CREATE TABLE",
      "CREATE PROCEDURE",
      "CREATE TRIGGER",
      "CREATE FUNCTION",
      "CREATE TABLE",
    ]);
    expect(statements[1]?.text).toContain("SELECT 1; END");
    expect(statements[4]?.startLine).toBe(9);
  });

  it("treats DELIMITER as an ordinary word outside MySQL", () => {
    const { statements } = splitStatements("DELIMITER //\nCREATE TABLE a (id int);", "postgresql");
    expect(statements).toHaveLength(1);
  });
});
