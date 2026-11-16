import { showsSchemaName } from "@/domain/schema/selectors";
import type { ColumnId, Schema, TableId } from "@/domain/schema/types";
import { prepareField, type Field } from "./field";

export interface TableEntry {
  id: TableId;
  /** Declaration order (tie-break). */
  order: number;
  schema: Field | null;
  name: Field;
  /** Whether rows show the schema name (see `showsSchemaName`). */
  showSchema: boolean;
  columnCount: number;
}

export interface ColumnEntry {
  id: ColumnId;
  table: TableEntry;
  order: number;
  name: Field;
  type: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
}

export interface SearchIndex {
  tables: TableEntry[];
  columns: ColumnEntry[];
}

export function buildSearchIndex(schema: Schema): SearchIndex {
  const tables: TableEntry[] = [];
  const columns: ColumnEntry[] = [];
  // Names repeat a lot (id, created_at, …): one prepared field per distinct name, which also lets
  // a search match each distinct name once.
  const fields = new Map<string, Field>();
  const field = (raw: string) => {
    let prepared = fields.get(raw);
    if (!prepared) fields.set(raw, (prepared = prepareField(raw)));
    return prepared;
  };
  schema.tableOrder.forEach((id, order) => {
    const table = schema.tables[id];
    if (!table) return;
    const entry: TableEntry = {
      id,
      order,
      schema: table.schemaName ? field(table.schemaName) : null,
      name: field(table.name),
      showSchema: showsSchemaName(schema, table),
      columnCount: table.columns.length,
    };
    tables.push(entry);
    for (const column of table.columns) {
      columns.push({
        id: column.id,
        table: entry,
        order: columns.length,
        name: field(column.name),
        type: column.dataType.raw,
        isPrimaryKey: column.isPrimaryKey,
        isForeignKey: column.isForeignKey,
      });
    }
  });
  return { tables, columns };
}

const cache = new WeakMap<Schema, SearchIndex>();

/** Built once per schema object; a new import is a new object, so it gets a new index. */
export function getSearchIndex(schema: Schema): SearchIndex {
  let index = cache.get(schema);
  if (!index) {
    index = buildSearchIndex(schema);
    cache.set(schema, index);
  }
  return index;
}
