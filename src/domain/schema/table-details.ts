import { displayTableName, showsSchemaName } from "./selectors";
import type {
  CheckConstraint,
  Column,
  ColumnDefault,
  ColumnId,
  ReferentialAction,
  Relationship,
  RelationshipId,
  Schema,
  SchemaSource,
  Table,
  TableId,
} from "./types";

/**
 * Display-ready details of one table for the inspector (P2-T08). Pure; never throws: an unknown
 * column id (not expected after normalize) is shown as the raw id.
 */

export interface ColumnName {
  id: ColumnId;
  name: string;
}

export interface ColumnTarget {
  tableId: TableId;
  /** Display name: `billing.invoices`, or `users` when the schema is the default. */
  table: string;
  column: ColumnName;
}

export interface DefaultLabel {
  text: string;
  /** Rendered as "auto-increment" (identity, serial, AUTO_INCREMENT, Prisma autoincrement()). */
  auto: boolean;
  /** Prisma `dbgenerated("x")`: the database computes it. */
  db: boolean;
}

export interface ColumnDetails {
  column: Column;
  default?: DefaultLabel;
  enumName?: string;
  enumValues?: string[];
  /** Where this column points as (part of) a foreign key; usually one target. */
  references: ColumnTarget[];
}

export interface KeyDetails {
  name?: string;
  columns: ColumnName[];
}

export interface IndexDetails extends KeyDetails {
  unique: boolean;
}

export interface RelationDetails {
  id: RelationshipId;
  name?: string;
  /** The table at the other end (for a self-reference, this table). */
  other: { tableId: TableId; table: string };
  /** Column pairs, FK side first: `[from, to]`. */
  pairs: [from: ColumnName, to: ColumnName][];
  cardinality: Relationship["cardinality"];
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  self: boolean;
  implicit: boolean;
}

export interface TableDetails {
  table: Table;
  showSchema: boolean;
  columns: ColumnDetails[];
  primaryKey?: KeyDetails;
  uniques: KeyDetails[];
  indexes: IndexDetails[];
  checks: CheckConstraint[];
  /** This table holds the foreign key ("References"). */
  outgoing: RelationDetails[];
  /** Other tables point here ("Referenced by"). */
  incoming: RelationDetails[];
}

export function defaultLabel(value: ColumnDefault, source: SchemaSource): DefaultLabel {
  if (value.kind === "autoincrement") return { text: "auto-increment", auto: true, db: false };
  // Prisma only produces "expression" defaults from dbgenerated("…").
  const db = source.format === "prisma" && value.kind === "expression";
  return { text: value.value, auto: false, db };
}

type RelationIndex = Map<TableId, { outgoing: Relationship[]; incoming: Relationship[] }>;
const relationIndexes = new WeakMap<Schema, RelationIndex>();

/** Relationships by table, built once per schema object (O(relationships)). */
function relationIndex(schema: Schema): RelationIndex {
  let index = relationIndexes.get(schema);
  if (index) return index;
  index = new Map();
  const entry = (id: TableId) => {
    let e = index!.get(id);
    if (!e) index!.set(id, (e = { outgoing: [], incoming: [] }));
    return e;
  };
  for (const r of Object.values(schema.relationships)) {
    entry(r.from.tableId).outgoing.push(r);
    entry(r.to.tableId).incoming.push(r);
  }
  relationIndexes.set(schema, index);
  return index;
}

function columnName(schema: Schema, id: ColumnId, tableId: TableId): ColumnName {
  const column = schema.tables[tableId]?.columns.find((c) => c.id === id);
  return { id, name: column?.name ?? id };
}

function tableName(schema: Schema, id: TableId): string {
  const table = schema.tables[id];
  return table ? displayTableName(schema, table) : id;
}

function relationDetails(schema: Schema, r: Relationship, here: TableId): RelationDetails {
  const otherId = r.from.tableId === here ? r.to.tableId : r.from.tableId;
  return {
    id: r.id,
    name: r.name,
    other: { tableId: otherId, table: tableName(schema, otherId) },
    pairs: r.from.columnIds.map((fromId, i) => [
      columnName(schema, fromId, r.from.tableId),
      columnName(schema, r.to.columnIds[i] ?? "", r.to.tableId),
    ]),
    cardinality: r.cardinality,
    onDelete: r.onDelete,
    onUpdate: r.onUpdate,
    self: r.from.tableId === r.to.tableId,
    implicit: r.origin === "prisma-implicit",
  };
}

export function getTableDetails(schema: Schema, tableId: TableId): TableDetails | null {
  const table = schema.tables[tableId];
  if (!table) return null;
  const rels = relationIndex(schema).get(tableId) ?? { outgoing: [], incoming: [] };
  const keyColumns = (ids: ColumnId[]) => ids.map((id) => columnName(schema, id, tableId));

  const targets = new Map<ColumnId, ColumnTarget[]>();
  for (const r of rels.outgoing) {
    r.from.columnIds.forEach((fromId, i) => {
      const list = targets.get(fromId) ?? [];
      list.push({
        tableId: r.to.tableId,
        table: tableName(schema, r.to.tableId),
        column: columnName(schema, r.to.columnIds[i] ?? "", r.to.tableId),
      });
      targets.set(fromId, list);
    });
  }

  return {
    table,
    showSchema: showsSchemaName(schema, table),
    columns: table.columns.map((column) => {
      const enumName = column.dataType.enumName;
      return {
        column,
        default: column.default ? defaultLabel(column.default, schema.source) : undefined,
        enumName,
        enumValues: enumName ? schema.enums[enumName]?.values : undefined,
        references: targets.get(column.id) ?? [],
      };
    }),
    primaryKey: table.primaryKey && {
      name: table.primaryKey.name,
      columns: keyColumns(table.primaryKey.columnIds),
    },
    uniques: table.uniqueConstraints.map((k) => ({
      name: k.name,
      columns: keyColumns(k.columnIds),
    })),
    indexes: table.indexes.map((k) => ({
      name: k.name,
      unique: k.unique,
      columns: keyColumns(k.columnIds),
    })),
    checks: table.checkConstraints,
    outgoing: rels.outgoing.map((r) => relationDetails(schema, r, tableId)),
    incoming: rels.incoming.map((r) => relationDetails(schema, r, tableId)),
  };
}

/** Tab counts: Keys = primary key + unique constraints + indexes + checks. */
export function detailCounts(d: TableDetails) {
  return {
    columns: d.columns.length,
    keys: (d.primaryKey ? 1 : 0) + d.uniques.length + d.indexes.length + d.checks.length,
    relations: d.outgoing.length + d.incoming.length,
  };
}
