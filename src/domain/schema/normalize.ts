import { parseDataType } from "./data-type";
import type { DraftForeignKey, DraftKey, DraftSchema, DraftTable } from "./draft";
import { NameLookup, columnId, relationshipId, tableId, uniqueId } from "./ids";
import type {
  ColumnId,
  ImportIssue,
  ImportResult,
  KeyConstraint,
  Relationship,
  Schema,
  Table,
  TableId,
} from "./types";

interface Context {
  issues: ImportIssue[];
  tables: Record<TableId, Table>;
  tableOrder: TableId[];
  /** Lookup by bare name and by `schema.name`. */
  tableLookup: NameLookup<TableId>;
  columnLookups: Map<TableId, NameLookup<ColumnId>>;
  defaultSchemaName?: string;
}

/**
 * Builds a normalized `Schema` from a draft. Never throws for user data: unresolvable references,
 * duplicates and mismatches become `ImportIssue`s and the offending item is skipped.
 */
export function normalizeSchema(draft: DraftSchema): Schema {
  const enumLookup = new NameLookup((draft.enums ?? []).map((e) => [e.name, e.name] as const));
  const ctx: Context = {
    issues: [...(draft.issues ?? [])],
    tables: {},
    tableOrder: [],
    tableLookup: new NameLookup(),
    columnLookups: new Map(),
    defaultSchemaName: draft.defaultSchemaName,
  };

  const added = new Map<DraftTable, TableId>();
  for (const t of draft.tables) {
    const id = addTable(ctx, t, (n) => enumLookup.get(n));
    if (id) added.set(t, id);
  }
  for (const [t, id] of added) addTableKeys(ctx, t, id);
  for (const idx of draft.indexes ?? []) {
    const id = resolveTable(
      ctx,
      idx.table,
      idx.schemaName,
      `index ${idx.name ?? ""}`.trim(),
      idx.line,
    );
    const table = id ? ctx.tables[id] : undefined;
    if (!table) continue;
    const columnIds = resolveColumns(ctx, table.id, idx.columns, `index on ${table.name}`);
    if (columnIds)
      table.indexes.push(withName({ columnIds, unique: idx.unique ?? false }, idx.name));
  }

  const relationships: Record<string, Relationship> = {};
  const pending: { owner: string; ownerSchema?: string; fk: DraftForeignKey }[] = [];
  for (const t of added.keys()) {
    for (const c of t.columns) {
      if (c.references) {
        const { name, onDelete, onUpdate, ...references } = c.references;
        pending.push({
          owner: t.name,
          ownerSchema: t.schemaName,
          fk: { name, onDelete, onUpdate, references, columns: [c.name], line: t.line },
        });
      }
    }
    for (const fk of t.foreignKeys ?? [])
      pending.push({ owner: t.name, ownerSchema: t.schemaName, fk });
  }
  for (const fk of draft.foreignKeys ?? [])
    pending.push({ owner: fk.table, ownerSchema: fk.schemaName, fk });

  for (const { owner, ownerSchema, fk } of pending) {
    const rel = buildRelationship(ctx, owner, ownerSchema, fk);
    if (!rel) continue;
    rel.id = uniqueId(rel.id, { has: (id) => id in relationships });
    relationships[rel.id] = rel;
  }

  applyColumnFlags(ctx.tables, relationships);
  linkIssuesToTables(ctx);

  return {
    name: draft.name,
    source: draft.source,
    tables: ctx.tables,
    tableOrder: ctx.tableOrder,
    relationships,
    enums: Object.fromEntries(
      (draft.enums ?? []).map((e) => [e.name, { name: e.name, values: [...e.values] }]),
    ),
    issues: ctx.issues,
  };
}

/** Wraps a schema as an `ImportResult`; `ok` is false when any error-severity issue exists. */
export function toImportResult(schema: Schema): ImportResult {
  const ok = !schema.issues.some((i) => i.severity === "error");
  return ok ? { ok, schema, issues: schema.issues } : { ok, schema, issues: schema.issues };
}

function addTable(
  ctx: Context,
  draft: DraftTable,
  enumName: (n: string) => string | undefined,
): TableId | undefined {
  const name = draft.name.trim();
  if (!name) {
    ctx.issues.push({
      severity: "error",
      message: "Table with an empty name was skipped.",
      line: draft.line,
    });
    return undefined;
  }
  const schemaName = draft.schemaName ?? ctx.defaultSchemaName;
  const id = tableId(name, schemaName);
  if (ctx.tables[id] || ctx.tableLookup.has(id)) {
    ctx.issues.push({
      severity: "error",
      message: `Duplicate table "${id}" (names are matched case-insensitively) was skipped.`,
      line: draft.line,
      tableId: ctx.tables[id] ? id : (ctx.tableLookup.get(id) ?? id),
    });
    return undefined;
  }

  const columnLookup = new NameLookup<ColumnId>();
  const table: Table = {
    id,
    name,
    columns: [],
    uniqueConstraints: [],
    indexes: [],
    checkConstraints: [...(draft.checkConstraints ?? [])],
    origin: draft.origin ?? "declared",
  };
  if (schemaName) table.schemaName = schemaName;
  if (draft.comment) table.comment = draft.comment;

  for (const c of draft.columns) {
    if (columnLookup.has(c.name)) {
      ctx.issues.push({
        severity: "warning",
        message: `Duplicate column "${c.name}" in "${id}" was skipped.`,
        line: draft.line,
        tableId: id,
      });
      continue;
    }
    const cid = columnId(id, c.name);
    columnLookup.set(c.name, cid);
    table.columns.push({
      id: cid,
      tableId: id,
      name: c.name,
      dataType: parseDataType(c.type, enumName),
      nullable: c.nullable ?? true,
      ...(c.default ? { default: c.default } : {}),
      ...(c.comment ? { comment: c.comment } : {}),
      isPrimaryKey: false,
      isForeignKey: false,
      isUnique: false,
    });
  }

  ctx.tables[id] = table;
  ctx.tableOrder.push(id);
  ctx.columnLookups.set(id, columnLookup);
  ctx.tableLookup.set(id, id);
  if (id !== name) ctx.tableLookup.set(name, id);
  return id;
}

function addTableKeys(ctx: Context, draft: DraftTable, id: TableId): void {
  const table = ctx.tables[id];
  if (!table) return;

  const inlinePk = draft.columns.filter((c) => c.primaryKey).map((c) => c.name);
  const pk: DraftKey | undefined =
    draft.primaryKey ?? (inlinePk.length > 0 ? { columns: inlinePk } : undefined);
  if (draft.primaryKey && inlinePk.length > 0) {
    ctx.issues.push({
      severity: "warning",
      message: `Table "${id}" declares both inline and table-level primary keys; using the table-level key.`,
      line: draft.line,
      tableId: id,
    });
  }
  if (pk) {
    const columnIds = resolveColumns(ctx, id, pk.columns, `primary key of ${table.name}`);
    if (columnIds) table.primaryKey = withName({ columnIds }, pk.name);
  }

  const uniques: DraftKey[] = [
    ...draft.columns.filter((c) => c.unique).map((c) => ({ columns: [c.name] })),
    ...(draft.uniqueConstraints ?? []),
  ];
  for (const u of uniques) {
    const columnIds = resolveColumns(ctx, id, u.columns, `unique constraint on ${table.name}`);
    if (columnIds) table.uniqueConstraints.push(withName({ columnIds }, u.name));
  }
  for (const idx of draft.indexes ?? []) {
    const columnIds = resolveColumns(ctx, id, idx.columns, `index on ${table.name}`);
    if (columnIds)
      table.indexes.push(withName({ columnIds, unique: idx.unique ?? false }, idx.name));
  }
}

function buildRelationship(
  ctx: Context,
  owner: string,
  ownerSchema: string | undefined,
  fk: DraftForeignKey,
): Relationship | undefined {
  const label = fk.name ? `foreign key "${fk.name}"` : `foreign key on "${owner}"`;
  const fromId = resolveTable(ctx, owner, ownerSchema, label, fk.line);
  if (!fromId) return undefined;
  const toId = resolveTable(
    ctx,
    fk.references.table,
    fk.references.schemaName,
    label,
    fk.line,
    fromId,
  );
  if (!toId) return undefined;
  const target = ctx.tables[toId];
  if (!target) return undefined;

  const fromColumns = resolveColumns(ctx, fromId, fk.columns, label, fk.line);
  if (!fromColumns) return undefined;

  let toColumns: ColumnId[] | undefined;
  if (fk.references.columns && fk.references.columns.length > 0) {
    toColumns = resolveColumns(ctx, toId, fk.references.columns, label, fk.line, fromId);
  } else if (target.primaryKey) {
    toColumns = target.primaryKey.columnIds;
  } else {
    issue(
      ctx,
      `${capitalize(label)} references "${toId}" without columns, and "${toId}" has no primary key.`,
      fk.line,
      fromId,
    );
  }
  if (!toColumns) return undefined;
  if (toColumns.length !== fromColumns.length) {
    issue(
      ctx,
      `${capitalize(label)} has ${fromColumns.length} column(s) but references ${toColumns.length}.`,
      fk.line,
      fromId,
    );
    return undefined;
  }

  const rel: Relationship = {
    id: relationshipId(fromId, fk.columns, toId),
    from: { tableId: fromId, columnIds: fromColumns },
    to: { tableId: toId, columnIds: toColumns },
    cardinality: "many-to-one",
    origin: fk.origin ?? "declared",
  };
  if (fk.name) rel.name = fk.name;
  if (fk.onDelete) rel.onDelete = fk.onDelete;
  if (fk.onUpdate) rel.onUpdate = fk.onUpdate;
  return rel;
}

function resolveTable(
  ctx: Context,
  name: string,
  schemaName: string | undefined,
  label: string,
  line?: number,
  /** Table the issue is about (e.g. the FK's source table), for linking. */
  subject?: TableId,
): TableId | undefined {
  for (const candidate of tableCandidates(ctx, name, schemaName)) {
    if (ctx.tableLookup.isAmbiguous(candidate)) {
      issue(ctx, `${capitalize(label)}: table name "${candidate}" is ambiguous.`, line, subject);
      return undefined;
    }
    const id = ctx.tableLookup.get(candidate);
    if (id) return id;
  }
  issue(
    ctx,
    `${capitalize(label)} references unknown table "${tableId(name, schemaName)}".`,
    line,
    subject,
  );
  return undefined;
}

/** An explicit schema must match exactly; otherwise try the default schema, then the bare name. */
function tableCandidates(ctx: Context, name: string, schemaName: string | undefined): string[] {
  if (schemaName) return [tableId(name, schemaName)];
  return ctx.defaultSchemaName ? [tableId(name, ctx.defaultSchemaName), name] : [name];
}

/**
 * Links parser issues to tables: an issue tagged with a raw `table` name gets the `tableId` of the
 * table it names, when that table exists (names match case-insensitively, like everywhere else).
 */
function linkIssuesToTables(ctx: Context): void {
  for (const i of ctx.issues) {
    if (i.tableId || !i.table) continue;
    const dot = i.table.lastIndexOf(".");
    const [schemaName, name] =
      dot > 0 ? [i.table.slice(0, dot), i.table.slice(dot + 1)] : [undefined, i.table];
    for (const candidate of tableCandidates(ctx, name, schemaName)) {
      const id = ctx.tableLookup.isAmbiguous(candidate)
        ? undefined
        : ctx.tableLookup.get(candidate);
      if (id) {
        i.tableId = id;
        break;
      }
    }
  }
}

function resolveColumns(
  ctx: Context,
  table: TableId,
  names: readonly string[],
  label: string,
  line?: number,
  subject: TableId = table,
): ColumnId[] | undefined {
  const lookup = ctx.columnLookups.get(table);
  if (!lookup || names.length === 0) {
    issue(ctx, `${capitalize(label)} has no columns.`, line, subject);
    return undefined;
  }
  const ids: ColumnId[] = [];
  for (const n of names) {
    const id = lookup.get(n);
    if (!id) {
      issue(
        ctx,
        `${capitalize(label)} references unknown column "${n}" in "${table}".`,
        line,
        subject,
      );
      return undefined;
    }
    ids.push(id);
  }
  return ids;
}

function applyColumnFlags(
  tables: Record<TableId, Table>,
  relationships: Record<string, Relationship>,
): void {
  const fkColumns = new Set<ColumnId>();
  for (const rel of Object.values(relationships))
    rel.from.columnIds.forEach((c) => fkColumns.add(c));

  for (const table of Object.values(tables)) {
    const pk = new Set(table.primaryKey?.columnIds ?? []);
    const singleUnique = new Set<ColumnId>();
    for (const key of [...table.uniqueConstraints, ...table.indexes.filter((i) => i.unique)]) {
      const only = key.columnIds.length === 1 ? key.columnIds[0] : undefined;
      if (only) singleUnique.add(only);
    }
    for (const col of table.columns) {
      col.isPrimaryKey = pk.has(col.id);
      col.isForeignKey = fkColumns.has(col.id);
      col.isUnique = singleUnique.has(col.id);
      if (col.isPrimaryKey) col.nullable = false;
    }
  }

  for (const rel of Object.values(relationships)) {
    const table = tables[rel.from.tableId];
    if (table && isCoveredByUniqueKey(table, rel.from.columnIds)) rel.cardinality = "one-to-one";
  }
}

/** True when `columnIds` exactly equals (as a set) the PK, a unique constraint, or a unique index. */
export function isCoveredByUniqueKey(table: Table, columnIds: readonly ColumnId[]): boolean {
  const keys: KeyConstraint[] = [
    ...(table.primaryKey ? [table.primaryKey] : []),
    ...table.uniqueConstraints,
    ...table.indexes.filter((i) => i.unique),
  ];
  const target = new Set(columnIds);
  return keys.some(
    (k) => k.columnIds.length === target.size && k.columnIds.every((c) => target.has(c)),
  );
}

function withName<T extends object>(value: T, name: string | undefined): T & { name?: string } {
  return name ? { name, ...value } : value;
}

function issue(ctx: Context, message: string, line?: number, subject?: TableId): void {
  ctx.issues.push({
    severity: "warning",
    message,
    ...(line !== undefined ? { line } : {}),
    ...(subject ? { tableId: subject } : {}),
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
