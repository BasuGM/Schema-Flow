import type { ColumnId, TableId } from "./types";

export function tableId(name: string, schemaName?: string): TableId {
  return schemaName ? `${schemaName}.${name}` : name;
}

export function columnId(table: TableId, columnName: string): ColumnId {
  return `${table}.${columnName}`;
}

export function relationshipId(
  fromTable: TableId,
  fromColumns: readonly string[],
  toTable: TableId,
): string {
  return `fk:${fromTable}(${fromColumns.join(",")})->${toTable}`;
}

/** Identifiers are compared case-insensitively (SQL semantics for unquoted names). */
export function lookupKey(name: string): string {
  return name.toLowerCase();
}

/**
 * Case-insensitive name → value lookup. Duplicate keys (differing only in case) are recorded so
 * callers can report ambiguity instead of silently picking one.
 */
export class NameLookup<T> {
  private readonly map = new Map<string, T>();
  private readonly duplicates = new Set<string>();

  constructor(entries: Iterable<readonly [string, T]> = []) {
    for (const [name, value] of entries) this.set(name, value);
  }

  set(name: string, value: T): void {
    const key = lookupKey(name);
    if (this.map.has(key)) this.duplicates.add(key);
    else this.map.set(key, value);
  }

  get(name: string): T | undefined {
    return this.map.get(lookupKey(name));
  }

  has(name: string): boolean {
    return this.map.has(lookupKey(name));
  }

  isAmbiguous(name: string): boolean {
    return this.duplicates.has(lookupKey(name));
  }
}

/** Ensures a generated ID is unique within `taken` by appending `#2`, `#3`, … */
export function uniqueId(base: string, taken: { has(id: string): boolean }): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}#${n}`)) n += 1;
  return `${base}#${n}`;
}
