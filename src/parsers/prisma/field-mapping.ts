import type { ColumnDefault, ReferentialAction } from "@/domain/schema/types";
import type { PrismaArg, PrismaAttribute, PrismaField, PrismaValue } from "./parse-blocks";

export const PRISMA_SCALARS = new Set([
  "String",
  "Boolean",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "DateTime",
  "Json",
  "Bytes",
  "Unsupported",
]);

export function attribute(
  attributes: PrismaAttribute[],
  name: string,
): PrismaAttribute | undefined {
  return attributes.find((a) => a.name === name);
}

/** A keyed argument, or the positional argument at `position` when given. */
export function arg(attr: PrismaAttribute | undefined, key: string, position?: number) {
  if (!attr) return undefined;
  const keyed = attr.args.find((a) => a.key === key);
  if (keyed) return keyed.value;
  if (position === undefined) return undefined;
  return attr.args.filter((a) => a.key === undefined)[position]?.value;
}

export function stringArg(attr: PrismaAttribute | undefined, key: string, position?: number) {
  const v = arg(attr, key, position);
  return v?.kind === "string" ? v.value : undefined;
}

/**
 * Field names from `[a, b(sort: Desc), c(ops: …)]`. Returns undefined when any element is not a
 * plain field reference (e.g. a string).
 */
export function fieldList(value: PrismaValue | undefined): string[] | undefined {
  if (!value) return undefined;
  const items = value.kind === "array" ? value.items : [value];
  const names: string[] = [];
  for (const item of items) {
    if (item.kind === "ident") names.push(item.value);
    else if (item.kind === "call") names.push(item.name);
    else return undefined;
  }
  return names;
}

/** `@db.VarChar(255)` → `varchar(255)`, `@db.DoublePrecision` → `double precision`. */
function nativeType(attr: PrismaAttribute): string {
  const raw = attr.name.slice(3);
  const unsigned = /^Unsigned(.+)$/.exec(raw);
  const base = unsigned
    ? `${unsigned[1]!.toLowerCase()} unsigned`
    : raw === "DoublePrecision"
      ? "double precision"
      : raw.toLowerCase();
  const params = attr.args.map((a) => printValue(a.value));
  return params.length > 0 ? `${base}(${params.join(",")})` : base;
}

/**
 * Column type text. A native `@db.*` type wins; enums use their database name; other types are
 * kept as written in Prisma (`String`, `DateTime`) rather than guessing provider defaults.
 */
export function columnType(field: PrismaField, enumDbName: (name: string) => string | undefined) {
  const native = field.attributes.find((a) => a.name.startsWith("db."));
  const unsupported = field.type === "Unsupported" ? field.typeArgs[0]?.value : undefined;
  const base = native
    ? nativeType(native)
    : unsupported?.kind === "string"
      ? unsupported.value
      : (enumDbName(field.type) ?? field.type);
  return field.list ? `${base}[]` : base;
}

export function printValue(value: PrismaValue): string {
  switch (value.kind) {
    case "string":
      return value.text;
    case "number":
    case "ident":
      return value.value;
    case "array":
      return `[${value.items.map(printValue).join(", ")}]`;
    case "call":
      return `${value.name}(${value.args.map(printArg).join(", ")})`;
  }
}

function printArg(a: PrismaArg): string {
  return a.key ? `${a.key}: ${printValue(a.value)}` : printValue(a.value);
}

/** `@default(...)` → `ColumnDefault`. */
export function columnDefault(field: PrismaField): ColumnDefault | undefined {
  const value = arg(attribute(field.attributes, "default"), "value", 0);
  if (!value) return undefined;
  if (value.kind === "call") {
    if (value.name === "autoincrement" || value.name === "sequence")
      return { kind: "autoincrement", value: printValue(value) };
    if (value.name === "dbgenerated") {
      const inner = value.args[0]?.value;
      return {
        kind: "expression",
        value: inner?.kind === "string" ? inner.value : "dbgenerated()",
      };
    }
    return { kind: "function", value: printValue(value) };
  }
  return { kind: "literal", value: printValue(value) };
}

const ACTIONS: Record<string, ReferentialAction> = {
  Cascade: "cascade",
  Restrict: "restrict",
  NoAction: "no action",
  SetNull: "set null",
  SetDefault: "set default",
};

export function referentialAction(value: PrismaValue | undefined): ReferentialAction | undefined {
  return value?.kind === "ident" ? ACTIONS[value.value] : undefined;
}
