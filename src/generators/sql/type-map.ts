import type { DataType, SqlDialect } from "@/domain/schema/types";

export interface MappedType {
  sql: string;
  /** False when the target type is not an exact equivalent (reported as a warning). */
  exact: boolean;
}

type Family =
  | "smallint"
  | "int"
  | "bigint"
  | "boolean"
  | "text"
  | "varchar"
  | "char"
  | "numeric"
  | "real"
  | "double"
  | "timestamp"
  | "timestamptz"
  | "date"
  | "time"
  | "timetz"
  | "uuid"
  | "json"
  | "binary";

/** Type names of all three dialects and Prisma's scalars (`String`, `Int`, `DateTime`, …), lower-cased. */
const FAMILY: Record<string, Family> = {
  smallint: "smallint",
  int2: "smallint",
  smallserial: "smallint",
  tinyint: "smallint",
  integer: "int",
  int: "int",
  int4: "int",
  serial: "int",
  serial4: "int",
  mediumint: "int",
  bigint: "bigint",
  int8: "bigint",
  bigserial: "bigint",
  serial8: "bigint",
  boolean: "boolean",
  bool: "boolean",
  text: "text",
  tinytext: "text",
  mediumtext: "text",
  longtext: "text",
  clob: "text",
  string: "text",
  varchar: "varchar",
  "character varying": "varchar",
  nvarchar: "varchar",
  char: "char",
  character: "char",
  nchar: "char",
  bpchar: "char",
  numeric: "numeric",
  decimal: "numeric",
  dec: "numeric",
  number: "numeric",
  money: "numeric",
  real: "real",
  float4: "real",
  float: "double",
  float8: "double",
  double: "double",
  "double precision": "double",
  timestamp: "timestamp",
  "timestamp without time zone": "timestamp",
  datetime: "timestamp",
  datetime2: "timestamp",
  smalldatetime: "timestamp",
  timestamptz: "timestamptz",
  "timestamp with time zone": "timestamptz",
  date: "date",
  time: "time",
  "time without time zone": "time",
  timetz: "timetz",
  "time with time zone": "timetz",
  uuid: "uuid",
  json: "json",
  jsonb: "json",
  bytea: "binary",
  blob: "binary",
  tinyblob: "binary",
  mediumblob: "binary",
  longblob: "binary",
  binary: "binary",
  varbinary: "binary",
  bytes: "binary",
};

/** Prisma scalars whose meaning differs from the SQL type of the same name. */
const PRISMA_OVERRIDES: Record<string, Family> = { float: "double", datetime: "timestamp" };

const KEY_TRAP_BASES = new Set([
  "text",
  "tinytext",
  "mediumtext",
  "longtext",
  "clob",
  "string",
  "blob",
  "tinyblob",
  "mediumblob",
  "longblob",
  "bytea",
  "bytes",
  "json",
  "jsonb",
]);

const params = (dt: DataType, fallback = "") =>
  dt.params && dt.params.length > 0 ? `(${dt.params.join(", ")})` : fallback;

const PG = {
  smallint: "smallint",
  int: "integer",
  bigint: "bigint",
  boolean: "boolean",
  text: "text",
  real: "real",
  double: "double precision",
  timestamp: "timestamp",
  timestamptz: "timestamp with time zone",
  date: "date",
  time: "time",
  timetz: "time with time zone",
  uuid: "uuid",
  json: "jsonb",
  binary: "bytea",
} as const;
const MYSQL = {
  smallint: "smallint",
  int: "int",
  bigint: "bigint",
  boolean: "boolean",
  text: "text",
  real: "float",
  double: "double",
  timestamp: "datetime",
  timestamptz: "datetime",
  date: "date",
  time: "time",
  timetz: "time",
  uuid: "char(36)",
  json: "json",
  binary: "blob",
} as const;
const SQLITE = {
  smallint: "integer",
  int: "integer",
  bigint: "integer",
  boolean: "boolean",
  text: "text",
  real: "real",
  double: "real",
  timestamp: "datetime",
  timestamptz: "datetime",
  date: "date",
  time: "time",
  timetz: "time",
  uuid: "text",
  json: "text",
  binary: "blob",
} as const;

/** True for the families that MySQL cannot index without a prefix length (TEXT, BLOB, JSON). */
export function isUnindexableOnMysql(dt: DataType): boolean {
  return KEY_TRAP_BASES.has(dt.base.toLowerCase());
}

/** The MySQL replacement used when such a column is part of a key. */
export function mysqlKeyType(dt: DataType): string {
  return /blob|bytea|bytes|binary/i.test(dt.base) ? "varbinary(255)" : "varchar(255)";
}

/**
 * The SQL type for `dt` in the `to` dialect (used whenever the export is not a same-dialect copy).
 * Parameters (`varchar(255)`, `numeric(10, 2)`) carry over where the target has them.
 */
export function mapType(
  dt: DataType,
  from: SqlDialect,
  to: SqlDialect,
  isPrisma: boolean,
): MappedType {
  const base = dt.base.toLowerCase().trim();
  const family = (isPrisma ? PRISMA_OVERRIDES[base] : undefined) ?? FAMILY[base];
  if (!family) return { sql: dt.raw, exact: false };
  const fixed = to === "postgresql" ? PG : to === "mysql" ? MYSQL : SQLITE;

  switch (family) {
    case "varchar":
      if (to === "mysql") {
        return dt.params?.length
          ? { sql: `varchar${params(dt)}`, exact: true }
          : { sql: "text", exact: false };
      }
      return { sql: `varchar${params(dt)}`, exact: true };
    case "char":
      return { sql: `char${params(dt, "(1)")}`, exact: true };
    case "numeric": {
      const p = params(dt);
      if (to === "sqlite") return { sql: "numeric", exact: true };
      if (to === "mysql") {
        return p
          ? { sql: `decimal${p}`, exact: base !== "money" }
          : { sql: "decimal(65, 30)", exact: false };
      }
      return { sql: `numeric${p}`, exact: base !== "money" };
    }
    case "timestamptz":
      return { sql: fixed.timestamptz, exact: to === "postgresql" };
    case "timetz":
      return { sql: fixed.timetz, exact: to === "postgresql" };
    case "json":
      return { sql: fixed.json, exact: to !== "sqlite" };
    case "real":
      return { sql: fixed.real, exact: true };
    case "double":
      // MySQL's FLOAT is single precision; PostgreSQL's and Prisma's float is double.
      if (base === "float" && from === "mysql" && !isPrisma)
        return { sql: fixed.real, exact: true };
      return { sql: fixed.double, exact: true };
    case "binary":
      return { sql: fixed.binary, exact: true };
    case "uuid":
      return { sql: fixed.uuid, exact: to === "postgresql" };
    default:
      return { sql: fixed[family], exact: true };
  }
}
