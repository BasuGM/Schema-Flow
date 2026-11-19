import type { Schema } from "@/domain/schema/types";
import type { GeneratedText } from "./types";

/** Bump when the shape changes; documented in ADR-028. Export-only: there is no JSON importer. */
export const JSON_FORMAT = "schemaflow-schema";
export const JSON_VERSION = 1;

/**
 * The normalized schema as versioned JSON. Records become arrays in declaration order (tables) and
 * id order (relationships); columns are referenced by name inside their table; `issues` (import
 * diagnostics) are left out. Deterministic: no timestamps beyond the source's own `importedAt`.
 */
export function generateJson(schema: Schema): GeneratedText {
  const columnName = new Map<string, string>();
  for (const table of Object.values(schema.tables)) {
    for (const column of table.columns) columnName.set(column.id, column.name);
  }
  const names = (ids: string[]) => ids.map((id) => columnName.get(id) ?? id);

  const tables = schema.tableOrder.flatMap((id) => {
    const t = schema.tables[id];
    if (!t) return [];
    return [
      {
        id: t.id,
        name: t.name,
        schemaName: t.schemaName,
        comment: t.comment,
        origin: t.origin,
        columns: t.columns.map((c) => ({
          name: c.name,
          dataType: c.dataType,
          nullable: c.nullable,
          default: c.default,
          isPrimaryKey: c.isPrimaryKey,
          isForeignKey: c.isForeignKey,
          isUnique: c.isUnique,
          comment: c.comment,
        })),
        primaryKey: t.primaryKey && {
          name: t.primaryKey.name,
          columns: names(t.primaryKey.columnIds),
        },
        uniqueConstraints: t.uniqueConstraints.map((u) => ({
          name: u.name,
          columns: names(u.columnIds),
        })),
        indexes: t.indexes.map((i) => ({
          name: i.name,
          unique: i.unique,
          columns: names(i.columnIds),
        })),
        checkConstraints: t.checkConstraints,
        partitions: t.partitions,
      },
    ];
  });

  const relationships = Object.values(schema.relationships)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      from: { table: r.from.tableId, columns: names(r.from.columnIds) },
      to: { table: r.to.tableId, columns: names(r.to.columnIds) },
      onDelete: r.onDelete,
      onUpdate: r.onUpdate,
      cardinality: r.cardinality,
      origin: r.origin,
    }));

  const document = {
    format: JSON_FORMAT,
    version: JSON_VERSION,
    name: schema.name,
    source: schema.source,
    enums: Object.values(schema.enums).map((e) => ({ name: e.name, values: e.values })),
    tables,
    relationships,
  };
  return { text: `${JSON.stringify(document, null, 2)}\n`, warnings: [] };
}
