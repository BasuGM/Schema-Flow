import type { ColumnId, ImportIssue, Schema, Table } from "./types";

/**
 * Checks structural invariants of a normalized schema. Returns issues; never throws.
 * A schema produced by `normalizeSchema()` should always yield zero errors here.
 */
export function validateSchema(schema: Schema): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const error = (message: string) => issues.push({ severity: "error", message });
  const columnOwner = new Map<ColumnId, string>();

  const tableIds = Object.keys(schema.tables);
  const ordered = new Set(schema.tableOrder);
  if (ordered.size !== schema.tableOrder.length) error("tableOrder contains duplicate table IDs.");
  if (ordered.size !== tableIds.length || tableIds.some((id) => !ordered.has(id))) {
    error("tableOrder does not list exactly the tables in the schema.");
  }

  for (const [key, table] of Object.entries(schema.tables)) {
    if (table.id !== key) error(`Table key "${key}" does not match its id "${table.id}".`);
    if (!table.name.trim()) error(`Table "${key}" has an empty name.`);
    for (const col of table.columns) {
      if (!col.name.trim()) error(`Table "${key}" has a column with an empty name.`);
      if (col.tableId !== table.id)
        error(`Column "${col.id}" belongs to "${col.tableId}" but is listed in "${table.id}".`);
      if (columnOwner.has(col.id)) error(`Duplicate column id "${col.id}".`);
      columnOwner.set(col.id, table.id);
    }
    checkKeys(table, error);
  }

  for (const [key, rel] of Object.entries(schema.relationships)) {
    if (rel.id !== key) error(`Relationship key "${key}" does not match its id "${rel.id}".`);
    for (const end of [rel.from, rel.to]) {
      if (!schema.tables[end.tableId]) {
        error(`Relationship "${rel.id}" references missing table "${end.tableId}".`);
        continue;
      }
      if (end.columnIds.length === 0) error(`Relationship "${rel.id}" has an end with no columns.`);
      for (const c of end.columnIds) {
        if (columnOwner.get(c) !== end.tableId) {
          error(`Relationship "${rel.id}" references column "${c}" not in table "${end.tableId}".`);
        }
      }
    }
    if (rel.from.columnIds.length !== rel.to.columnIds.length) {
      error(`Relationship "${rel.id}" has mismatched column counts.`);
    }
  }
  return issues;
}

function checkKeys(table: Table, error: (message: string) => void): void {
  const own = new Set(table.columns.map((c) => c.id));
  const keys = [
    ...(table.primaryKey ? [{ kind: "primary key", ids: table.primaryKey.columnIds }] : []),
    ...table.uniqueConstraints.map((u) => ({ kind: "unique constraint", ids: u.columnIds })),
    ...table.indexes.map((i) => ({ kind: "index", ids: i.columnIds })),
  ];
  for (const { kind, ids } of keys) {
    if (ids.length === 0) error(`A ${kind} on "${table.id}" has no columns.`);
    for (const id of ids) {
      if (!own.has(id)) error(`A ${kind} on "${table.id}" references unknown column "${id}".`);
    }
  }
}
