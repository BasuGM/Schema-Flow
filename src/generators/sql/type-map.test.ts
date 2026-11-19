import { describe, expect, it } from "vitest";
import { parseDataType } from "@/domain/schema/data-type";
import type { SqlDialect } from "@/domain/schema/types";
import { isUnindexableOnMysql, mapType, mysqlKeyType } from "./type-map";

const map = (raw: string, from: SqlDialect, to: SqlDialect, prisma = false) =>
  mapType(parseDataType(raw), from, to, prisma);

describe("mapType", () => {
  it("maps common types across the three dialects", () => {
    expect(map("timestamptz", "postgresql", "mysql")).toEqual({ sql: "datetime", exact: false });
    expect(map("timestamptz", "postgresql", "postgresql")).toEqual({
      sql: "timestamp with time zone",
      exact: true,
    });
    expect(map("varchar(255)", "postgresql", "sqlite")).toEqual({
      sql: "varchar(255)",
      exact: true,
    });
    expect(map("varchar", "postgresql", "mysql")).toEqual({ sql: "text", exact: false });
    expect(map("numeric(10, 2)", "postgresql", "mysql")).toEqual({
      sql: "decimal(10, 2)",
      exact: true,
    });
    expect(map("boolean", "mysql", "sqlite")).toEqual({ sql: "boolean", exact: true });
    expect(map("uuid", "postgresql", "mysql")).toEqual({ sql: "char(36)", exact: false });
    expect(map("jsonb", "postgresql", "sqlite")).toEqual({ sql: "text", exact: false });
  });

  it("keeps the family of MySQL UNSIGNED types, also after parameters, and reports the range loss", () => {
    expect(map("int unsigned", "mysql", "postgresql")).toEqual({ sql: "integer", exact: false });
    expect(map("decimal(10,2) unsigned", "mysql", "sqlite")).toEqual({
      sql: "numeric",
      exact: false,
    });
    expect(map("tinyint unsigned", "mysql", "sqlite").sql).toBe("integer");
    expect(map("YEAR", "mysql", "postgresql").sql).toBe("smallint");
  });

  it("turns types with quoted parameters (SET, ENUM) into text rather than invalid SQL", () => {
    expect(map("SET('a','b')", "mysql", "sqlite")).toEqual({ sql: "text", exact: false });
    expect(map("geometry('x')", "postgresql", "mysql")).toEqual({ sql: "text", exact: false });
  });

  it("passes unknown plain types through and says so", () => {
    expect(map("point", "postgresql", "mysql")).toEqual({ sql: "point", exact: false });
  });

  it("treats Prisma scalars by their Prisma meaning", () => {
    expect(map("String", "postgresql", "mysql", true).sql).toBe("text");
    expect(map("Float", "postgresql", "mysql", true).sql).toBe("double");
    expect(map("DateTime", "postgresql", "sqlite", true).sql).toBe("datetime");
    expect(map("Int", "postgresql", "sqlite", true).sql).toBe("integer");
  });

  it("knows which types MySQL cannot index", () => {
    expect(isUnindexableOnMysql(parseDataType("text"))).toBe(true);
    expect(isUnindexableOnMysql(parseDataType("varchar(10)"))).toBe(false);
    expect(mysqlKeyType(parseDataType("bytea"))).toBe("varbinary(255)");
    expect(mysqlKeyType(parseDataType("text"))).toBe("varchar(255)");
  });
});
