import { describe, expect, it } from "vitest";
import { detectFormat, detectSqlDialect } from "./detect-format";

describe("detectFormat", () => {
  it("recognises Prisma schemas", () => {
    expect(
      detectFormat('datasource db {\n provider = "postgresql"\n}\nmodel User {\n id Int @id\n}'),
    ).toEqual({
      format: "prisma",
    });
  });

  it("recognises SQL and guesses the dialect", () => {
    expect(detectFormat("CREATE TABLE a (id int);")).toEqual({
      format: "sql",
      dialect: "postgresql",
    });
    expect(detectFormat("CREATE TABLE `a` (id int) ENGINE=InnoDB;").dialect).toBe("mysql");
    expect(detectFormat("CREATE TABLE a (id INTEGER PRIMARY KEY AUTOINCREMENT);").dialect).toBe(
      "sqlite",
    );
  });

  it("returns unknown for other text", () => {
    expect(detectFormat("hello world")).toEqual({ format: "unknown" });
    expect(detectFormat("")).toEqual({ format: "unknown" });
  });

  it("finds DDL after a long header (QA-011: the first 200,000 characters were sampled)", () => {
    const header = "-- generated header line\n".repeat(20_000);
    expect(header.length).toBeGreaterThan(200_000);
    expect(detectFormat(`${header}CREATE TABLE \`a\` (id int);`)).toEqual({
      format: "sql",
      dialect: "mysql",
    });
    expect(detectFormat(`${"// note\n".repeat(30_000)}model A {\n  id Int @id\n}`).format).toBe(
      "prisma",
    );
  });

  it("prefers PostgreSQL when there are no dialect markers", () => {
    expect(detectSqlDialect("CREATE TABLE t (id serial)")).toBe("postgresql");
  });
});
