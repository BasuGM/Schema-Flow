import type { Relationship, Schema, Table, TableId } from "./types";

export function getOutgoingRelationships(schema: Schema, table: TableId): Relationship[] {
  return Object.values(schema.relationships).filter((r) => r.from.tableId === table);
}

export function getIncomingRelationships(schema: Schema, table: TableId): Relationship[] {
  return Object.values(schema.relationships).filter((r) => r.to.tableId === table);
}

/** Undirected adjacency list built once per schema; use for repeated neighbour queries. */
export function buildAdjacency(schema: Schema): Map<TableId, Set<TableId>> {
  const adj = new Map<TableId, Set<TableId>>();
  for (const id of schema.tableOrder) adj.set(id, new Set());
  for (const r of Object.values(schema.relationships)) {
    adj.get(r.from.tableId)?.add(r.to.tableId);
    adj.get(r.to.tableId)?.add(r.from.tableId);
  }
  return adj;
}

/**
 * Tables reachable from `table` within `depth` hops, following relationships in either direction.
 * Excludes `table` itself (even when self-referencing). Unknown tables yield an empty set.
 */
export function getNeighbors(
  schema: Schema,
  table: TableId,
  depth = 1,
  adjacency: Map<TableId, Set<TableId>> = buildAdjacency(schema),
): Set<TableId> {
  const result = new Set<TableId>();
  if (!adjacency.has(table)) return result;
  const visited = new Set<TableId>([table]);
  let frontier: TableId[] = [table];
  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const next: TableId[] = [];
    for (const id of frontier) {
      for (const n of adjacency.get(id) ?? []) {
        if (visited.has(n)) continue;
        visited.add(n);
        result.add(n);
        next.push(n);
      }
    }
    frontier = next;
  }
  return result;
}

/**
 * The schema name is shown unless it is the source's default: none at all (MySQL, SQLite, Prisma
 * without `@@schema`) or `public` on PostgreSQL (SQL or Prisma). Used by search and the inspector.
 */
export function showsSchemaName(schema: Schema, table: Table): boolean {
  if (!table.schemaName) return false;
  return !(schema.source.dialect === "postgresql" && table.schemaName === "public");
}

/** `billing.invoices`, or just `users` when the schema name is the default. */
export function displayTableName(schema: Schema, table: Table): string {
  return showsSchemaName(schema, table) ? `${table.schemaName}.${table.name}` : table.name;
}
