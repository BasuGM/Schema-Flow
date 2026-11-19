import { isPrismaIdent, lowerFirst, pascalCase, PRISMA_RESERVED } from "../text/identifiers";

/** Hands out names that are unique in a scope; a clash gets a numeric suffix. */
export function uniqueNames() {
  const used = new Set<string>();
  return (wanted: string): string => {
    let name = wanted;
    for (let n = 2; used.has(name); n++) name = `${wanted}${n}`;
    used.add(name);
    return name;
  };
}

/** A model or enum name: PascalCase, never a Prisma scalar or keyword. */
export function modelBaseName(tableName: string): string {
  const name = pascalCase(tableName);
  return PRISMA_RESERVED.has(name) ? `${name}Model` : name;
}

/** A field name for `column`: itself when valid, else a cleaned name (the caller adds `@map`). */
export function fieldBaseName(column: string): string {
  if (isPrismaIdent(column)) return column;
  const cleaned = column.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+/, "");
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `f${cleaned === "" ? "" : `_${cleaned}`}`;
}

/** An enum value's identifier: the stored value when valid, else a cleaned name; unique per enum. */
export function prismaEnumValueName(value: string, values: readonly string[]): string {
  const taken = new Set<string>();
  for (const v of values) {
    let name = fieldBaseName(v);
    for (let n = 2; taken.has(name); n++) name = `${fieldBaseName(v)}${n}`;
    taken.add(name);
    if (v === value) return name;
  }
  return fieldBaseName(value);
}

export { lowerFirst };

/** `Order` → `orders`; a name that already ends in `s` is kept (`OrderItems` → `orderItems`). */
export function listFieldName(modelName: string): string {
  const lower = lowerFirst(modelName);
  return lower.endsWith("s") ? lower : `${lower}s`;
}
