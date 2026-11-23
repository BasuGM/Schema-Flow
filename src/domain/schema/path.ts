import type { RelationshipId, Schema, TableId } from "./types";

export interface PathHop {
  /** Table the walk leaves. */
  from: TableId;
  /** Table the walk arrives at. */
  to: TableId;
  relationshipId: RelationshipId;
  /** `references`: `from` holds the foreign key; `referenced-by`: `to` holds it. */
  direction: "references" | "referenced-by";
}

/** `tables.length === hops.length + 1`. */
export interface TablePath {
  tables: TableId[];
  hops: PathHop[];
}

interface Edge {
  other: TableId;
  relationshipId: RelationshipId;
  direction: PathHop["direction"];
}

const edgeCache = new WeakMap<Schema, Map<TableId, Edge[]>>();

/**
 * Relationship-level undirected adjacency, built once per schema. Each list is ordered by the
 * neighbour's `tableOrder` index, then relationship id, so the search is deterministic.
 * Self-references are left out.
 */
function getEdges(schema: Schema): Map<TableId, Edge[]> {
  const cached = edgeCache.get(schema);
  if (cached) return cached;
  const edges = new Map<TableId, Edge[]>();
  for (const id of schema.tableOrder) edges.set(id, []);
  for (const r of Object.values(schema.relationships)) {
    if (r.from.tableId === r.to.tableId) continue;
    edges
      .get(r.from.tableId)
      ?.push({ other: r.to.tableId, relationshipId: r.id, direction: "references" });
    edges
      .get(r.to.tableId)
      ?.push({ other: r.from.tableId, relationshipId: r.id, direction: "referenced-by" });
  }
  const order = new Map(schema.tableOrder.map((id, i) => [id, i]));
  for (const list of edges.values()) {
    list.sort(
      (a, b) =>
        (order.get(a.other) ?? 0) - (order.get(b.other) ?? 0) ||
        (a.relationshipId < b.relationshipId ? -1 : a.relationshipId > b.relationshipId ? 1 : 0),
    );
  }
  edgeCache.set(schema, edges);
  return edges;
}

/**
 * Shortest chain of foreign keys between two tables, following relationships in either direction
 * (P4-T02). Breadth-first, neighbours visited in (`tableOrder`, relationship id) order, and the
 * first-discovered parent wins, so ties resolve the same way every time. `null` when a table is
 * unknown or the two are not connected.
 */
export function findPath(schema: Schema, from: TableId, to: TableId): TablePath | null {
  const edges = getEdges(schema);
  if (!edges.has(from) || !edges.has(to)) return null;
  if (from === to) return { tables: [from], hops: [] };

  const parent = new Map<TableId, PathHop>();
  const visited = new Set<TableId>([from]);
  let frontier: TableId[] = [from];
  while (frontier.length > 0 && !visited.has(to)) {
    const next: TableId[] = [];
    for (const id of frontier) {
      for (const e of edges.get(id) ?? []) {
        if (visited.has(e.other)) continue;
        visited.add(e.other);
        parent.set(e.other, {
          from: id,
          to: e.other,
          relationshipId: e.relationshipId,
          direction: e.direction,
        });
        next.push(e.other);
      }
    }
    frontier = next;
  }
  if (!visited.has(to)) return null;

  const hops: PathHop[] = [];
  for (let at = to; at !== from;) {
    const hop = parent.get(at);
    if (!hop) return null;
    hops.unshift(hop);
    at = hop.from;
  }
  return { tables: [from, ...hops.map((h) => h.to)], hops };
}
