import type { Schema, TableId } from "@/domain/schema/types";

/** A subject area: a group of tables derived from schema names or table-name prefixes (P4-T03). */
export interface SubjectArea {
  /** Slug: lower-case `[a-z0-9-]`, unique within the schema; `other` is the catch-all. */
  id: string;
  label: string;
  tableIds: TableId[];
}

export interface SubjectAreas {
  source: "schema" | "prefix";
  /** In order of first appearance in `tableOrder`; `other` (if any) is last. */
  areas: SubjectArea[];
  areaOf: ReadonlyMap<TableId, string>;
}

export const OTHER_AREA_ID = "other";
/** A name prefix becomes an area only when at least this many tables share it. */
const MIN_PREFIX_TABLES = 3;

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "x"
  );
}

function uniqueId(base: string, taken: Set<string>): string {
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  taken.add(id);
  return id;
}

function finish(
  source: SubjectAreas["source"],
  groups: Map<string, TableId[]>,
  other: TableId[],
): SubjectAreas | null {
  if (groups.size < 2) return null;
  const taken = new Set<string>([OTHER_AREA_ID]);
  const areas: SubjectArea[] = [];
  for (const [label, tableIds] of groups)
    areas.push({ id: uniqueId(slug(label), taken), label, tableIds });
  if (other.length > 0) areas.push({ id: OTHER_AREA_ID, label: "Other", tableIds: other });
  const areaOf = new Map<TableId, string>();
  for (const a of areas) for (const id of a.tableIds) areaOf.set(id, a.id);
  return { source, areas, areaOf };
}

function derive(schema: Schema): SubjectAreas | null {
  const defaultName = schema.source.dialect === "postgresql" ? "public" : "default";
  const nameOf = (id: TableId) => schema.tables[id]?.schemaName ?? defaultName;

  const bySchema = new Map<string, TableId[]>();
  for (const id of schema.tableOrder) {
    if (!schema.tables[id]) continue;
    const name = nameOf(id);
    const list = bySchema.get(name);
    if (list) list.push(id);
    else bySchema.set(name, [id]);
  }
  if (bySchema.size >= 2) return finish("schema", bySchema, []);

  const byPrefix = new Map<string, TableId[]>();
  for (const id of schema.tableOrder) {
    const table = schema.tables[id];
    if (!table) continue;
    const cut = table.name.indexOf("_");
    const prefix = cut > 0 ? table.name.slice(0, cut).toLowerCase() : "";
    const list = byPrefix.get(prefix);
    if (list) list.push(id);
    else byPrefix.set(prefix, [id]);
  }
  const groups = new Map<string, TableId[]>();
  const other: TableId[] = [];
  const small = new Set<string>();
  for (const [prefix, ids] of byPrefix)
    if (!prefix || ids.length < MIN_PREFIX_TABLES) small.add(prefix);
  for (const id of schema.tableOrder) {
    const table = schema.tables[id];
    if (!table) continue;
    const cut = table.name.indexOf("_");
    const prefix = cut > 0 ? table.name.slice(0, cut).toLowerCase() : "";
    if (small.has(prefix)) other.push(id);
    else {
      const list = groups.get(prefix);
      if (list) list.push(id);
      else groups.set(prefix, [id]);
    }
  }
  return finish("prefix", groups, other);
}

const cache = new WeakMap<Schema, SubjectAreas | null>();

/**
 * Derives subject areas: the DB schema name when there are 2+ schemas, else the table-name prefix
 * before the first `_` (prefixes shared by fewer than 3 tables, and names without a usable prefix,
 * go to Other). `null` when fewer than two areas result, so the UI stays flat. Memoised per schema.
 */
export function getSubjectAreas(schema: Schema): SubjectAreas | null {
  if (cache.has(schema)) return cache.get(schema) ?? null;
  const result = derive(schema);
  cache.set(schema, result);
  return result;
}
