import type { Relationship, Schema } from "@/domain/schema/types";

/** e.g. `orders_user_fk · orders.user_id → users.id`; composite keys list every column pair. */
export function describeRelationship(rel: Relationship, schema: Schema): string {
  const col = (id: string, tableId: string) => {
    const table = schema.tables[tableId];
    const column = table?.columns.find((c) => c.id === id);
    return `${table?.name ?? tableId}.${column?.name ?? id}`;
  };
  const pairs = rel.from.columnIds.map(
    (fromId, i) =>
      `${col(fromId, rel.from.tableId)} → ${col(rel.to.columnIds[i] ?? "", rel.to.tableId)}`,
  );
  return [rel.name, pairs.join(", ")].filter(Boolean).join(" · ");
}
