import type { ColumnId, Schema, TableId } from "@/domain/schema/types";

/**
 * Handle IDs. Each column row has a `source` handle on its left edge (where FK edges start) and a
 * `target` handle on its right edge (where references arrive). With the default LR layout,
 * referenced (parent) tables sit to the left of the tables that reference them.
 * Header handles are used when a column is hidden by a collapse mode.
 */
export function columnHandleId(column: ColumnId, kind: "source" | "target"): string {
  return `${kind}:${column}`;
}

export function headerHandleId(table: TableId, kind: "source" | "target"): string {
  return `${kind}:${table}::header`;
}

export interface EdgeEndColumns {
  /** Columns an edge starts from (the first FK column of a relationship). */
  source: ReadonlySet<ColumnId>;
  /** Columns an edge arrives at (the first referenced column of a relationship). */
  target: ReadonlySet<ColumnId>;
}

const endsCache = new WeakMap<Schema, EdgeEndColumns>();

/**
 * The column handles edges actually use (`schemaToFlow` attaches each relationship to its first
 * column on each side). Table nodes render only these, not two handles on every row: on a
 * 2,000-table schema that is ~5,000 handle elements instead of ~32,000 (ADR-023, QA-019).
 * Cached per schema object, so every node shares one result.
 */
export function edgeEndColumns(schema: Schema): EdgeEndColumns {
  const cached = endsCache.get(schema);
  if (cached) return cached;
  const source = new Set<ColumnId>();
  const target = new Set<ColumnId>();
  for (const rel of Object.values(schema.relationships)) {
    const from = rel.from.columnIds[0];
    const to = rel.to.columnIds[0];
    if (from) source.add(from);
    if (to) target.add(to);
  }
  const ends = { source, target };
  endsCache.set(schema, ends);
  return ends;
}
