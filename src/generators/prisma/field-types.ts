import type { DataType, SqlDialect } from "@/domain/schema/types";
import { prismaString } from "../text/escape";

const SCALARS = new Set([
  "String",
  "Boolean",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "DateTime",
  "Json",
  "Bytes",
]);

type Scalar =
  "String" | "Boolean" | "Int" | "BigInt" | "Float" | "Decimal" | "DateTime" | "Json" | "Bytes";

/** [Prisma scalar, `@db.*` attribute ("" for none), whether the attribute takes the type's parameters]. */
const NATIVE: Record<string, [Scalar, string, boolean]> = {
  smallint: ["Int", "SmallInt", false],
  int2: ["Int", "SmallInt", false],
  smallserial: ["Int", "SmallInt", false],
  tinyint: ["Int", "TinyInt", true],
  mediumint: ["Int", "MediumInt", false],
  "tinyint unsigned": ["Int", "UnsignedTinyInt", false],
  "smallint unsigned": ["Int", "UnsignedSmallInt", false],
  "mediumint unsigned": ["Int", "UnsignedMediumInt", false],
  "int unsigned": ["Int", "UnsignedInt", false],
  "bigint unsigned": ["BigInt", "UnsignedBigInt", false],
  integer: ["Int", "", false],
  int: ["Int", "", false],
  int4: ["Int", "", false],
  serial: ["Int", "", false],
  serial4: ["Int", "", false],
  bigint: ["BigInt", "", false],
  int8: ["BigInt", "", false],
  bigserial: ["BigInt", "", false],
  serial8: ["BigInt", "", false],
  boolean: ["Boolean", "", false],
  bool: ["Boolean", "", false],
  text: ["String", "Text", false],
  tinytext: ["String", "TinyText", false],
  mediumtext: ["String", "MediumText", false],
  longtext: ["String", "LongText", false],
  varchar: ["String", "VarChar", true],
  "character varying": ["String", "VarChar", true],
  char: ["String", "Char", true],
  character: ["String", "Char", true],
  bpchar: ["String", "Char", true],
  uuid: ["String", "Uuid", false],
  citext: ["String", "Citext", false],
  real: ["Float", "Real", false],
  float4: ["Float", "Real", false],
  "double precision": ["Float", "DoublePrecision", false],
  float8: ["Float", "DoublePrecision", false],
  double: ["Float", "Double", false],
  float: ["Float", "Float", true],
  decimal: ["Decimal", "Decimal", true],
  numeric: ["Decimal", "Decimal", true],
  money: ["Decimal", "Money", false],
  timestamp: ["DateTime", "Timestamp", true],
  "timestamp without time zone": ["DateTime", "Timestamp", true],
  timestamptz: ["DateTime", "Timestamptz", true],
  "timestamp with time zone": ["DateTime", "Timestamptz", true],
  datetime: ["DateTime", "DateTime", true],
  date: ["DateTime", "Date", false],
  time: ["DateTime", "Time", true],
  "time without time zone": ["DateTime", "Time", true],
  timetz: ["DateTime", "Timetz", true],
  "time with time zone": ["DateTime", "Timetz", true],
  year: ["Int", "Year", false],
  json: ["Json", "Json", false],
  jsonb: ["Json", "JsonB", false],
  bytea: ["Bytes", "ByteA", false],
  blob: ["Bytes", "Blob", false],
  tinyblob: ["Bytes", "TinyBlob", false],
  mediumblob: ["Bytes", "MediumBlob", false],
  longblob: ["Bytes", "LongBlob", false],
  binary: ["Bytes", "Binary", true],
  varbinary: ["Bytes", "VarBinary", true],
};

/** Native types that are a provider's default for their scalar; a SQL source need not spell them out. */
const PROVIDER_DEFAULT: Record<SqlDialect, ReadonlySet<string>> = {
  postgresql: new Set(["Text", "DoublePrecision", "JsonB", "ByteA"]),
  mysql: new Set(["Double", "Json", "LongBlob"]),
  sqlite: new Set(),
};

export interface PrismaFieldType {
  /** `String`, `Int`, `Unsupported("…")`, or an enum name; `[]` / `?` are added by the caller. */
  type: string;
  attrs: string[];
  /** The type could not be expressed as a Prisma scalar. */
  unsupported: boolean;
}

/**
 * The Prisma type for a column. A Prisma scalar written as such (`String`) stays; known SQL types
 * become a scalar plus `@db.*` (omitted for SQLite, which has none, and, for SQL sources, where it
 * is the provider's default). Anything else becomes `Unsupported("raw")`.
 */
export function prismaFieldType(
  dt: DataType,
  provider: SqlDialect,
  isPrismaSource: boolean,
): PrismaFieldType {
  const element = dt.raw.replace(/(\[\])+$/, "").trim();
  if (SCALARS.has(element)) return { type: element, attrs: [], unsupported: false };

  const base = dt.base.toLowerCase().trim();
  const native = NATIVE[base];
  if (!native) return unsupported(element);
  const [scalar, attr, takesParams] = native;
  if (!attr || provider === "sqlite") return { type: scalar, attrs: [], unsupported: false };
  if (!isPrismaSource && PROVIDER_DEFAULT[provider].has(attr)) {
    return { type: scalar, attrs: [], unsupported: false };
  }
  const args = takesParams && dt.params?.length ? `(${dt.params.join(", ")})` : "";
  return { type: scalar, attrs: [`@db.${attr}${args}`], unsupported: false };
}

function unsupported(raw: string): PrismaFieldType {
  return { type: `Unsupported(${prismaString(raw)})`, attrs: [], unsupported: true };
}
