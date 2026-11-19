import type { Column, EnumType, Relationship, Schema, Table } from "@/domain/schema/types";

/**
 * Canonical, comparable projection of a `Schema` for round-trip tests (parse → generate → parse).
 * Every field of every model is classified exactly once below; `Record<keyof T, …>` makes adding a
 * field to the domain types a compile error until it is classified, and the test in
 * `canonical-schema.test.ts` checks the classification against real objects as well.
 */
export type CanonicalOption = "types" | "defaults" | "comments" | "origin";

export type FieldMode = "compared" | { optional: CanonicalOption } | { excluded: string };

const compared: FieldMode = "compared";
const optional = (option: CanonicalOption): FieldMode => ({ optional: option });
const excluded = (reason: string): FieldMode => ({ excluded: reason });

export const SCHEMA_FIELDS: Record<keyof Schema, FieldMode> = {
  name: excluded("the exported file does not carry the source's name"),
  source: excluded("format, dialect and importedAt legitimately differ after a round trip"),
  tables: compared,
  tableOrder: excluded("order is not compared; tables are sorted by id"),
  relationships: compared,
  enums: compared,
  issues: excluded("import warnings are not part of the model"),
};

export const TABLE_FIELDS: Record<keyof Table, FieldMode> = {
  id: compared,
  name: compared,
  schemaName: compared,
  comment: optional("comments"),
  columns: compared,
  primaryKey: compared,
  uniqueConstraints: compared,
  indexes: compared,
  checkConstraints: compared,
  origin: optional("origin"),
  partitions: excluded("folded partitions are dropped by the generators (reported as a warning)"),
};

export const COLUMN_FIELDS: Record<keyof Column, FieldMode> = {
  id: compared,
  tableId: excluded("derived from the table id"),
  name: compared,
  dataType: optional("types"),
  nullable: compared,
  default: optional("defaults"),
  isPrimaryKey: compared,
  isForeignKey: compared,
  isUnique: compared,
  comment: optional("comments"),
};

export const RELATIONSHIP_FIELDS: Record<keyof Relationship, FieldMode> = {
  id: compared,
  name: compared,
  from: compared,
  to: compared,
  onDelete: compared,
  onUpdate: compared,
  cardinality: compared,
  origin: optional("origin"),
};

export const ENUM_FIELDS: Record<keyof EnumType, FieldMode> = {
  name: compared,
  values: compared,
};

/** Everything the projection never compares, with the reason (one list for the docs and tests). */
export const CANONICAL_EXCLUDED: readonly string[] = [
  ...Object.entries(SCHEMA_FIELDS).map(([k, v]) => ["schema", k, v] as const),
  ...Object.entries(TABLE_FIELDS).map(([k, v]) => ["table", k, v] as const),
  ...Object.entries(COLUMN_FIELDS).map(([k, v]) => ["column", k, v] as const),
  ...Object.entries(RELATIONSHIP_FIELDS).map(([k, v]) => ["relationship", k, v] as const),
  ...Object.entries(ENUM_FIELDS).map(([k, v]) => ["enum", k, v] as const),
].flatMap(([scope, key, mode]) =>
  typeof mode === "object" && "excluded" in mode ? [`${scope}.${key}: ${mode.excluded}`] : [],
);

const on = (mode: FieldMode, options: ReadonlySet<CanonicalOption>) =>
  mode === "compared" || ("optional" in mode && options.has(mode.optional));

const norm = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();
const byJson = <T>(items: T[]): T[] =>
  [...items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

export function canonicalSchema(
  schema: Schema,
  compare: readonly CanonicalOption[] = [],
): Record<string, unknown> {
  const options = new Set(compare);
  const column = (c: Column) => ({
    ...(on(COLUMN_FIELDS.id, options) && { id: c.id }),
    ...(on(COLUMN_FIELDS.name, options) && { name: c.name }),
    ...(on(COLUMN_FIELDS.dataType, options) && { type: norm(c.dataType.raw) }),
    ...(on(COLUMN_FIELDS.nullable, options) && { nullable: c.nullable }),
    ...(on(COLUMN_FIELDS.default, options) && {
      default: c.default ? { kind: c.default.kind, value: norm(c.default.value) } : null,
    }),
    ...(on(COLUMN_FIELDS.isPrimaryKey, options) && { pk: c.isPrimaryKey }),
    ...(on(COLUMN_FIELDS.isForeignKey, options) && { fk: c.isForeignKey }),
    ...(on(COLUMN_FIELDS.isUnique, options) && { unique: c.isUnique }),
    ...(on(COLUMN_FIELDS.comment, options) && { comment: c.comment ?? null }),
  });
  const table = (t: Table) => ({
    ...(on(TABLE_FIELDS.id, options) && { id: t.id }),
    ...(on(TABLE_FIELDS.name, options) && { name: t.name }),
    ...(on(TABLE_FIELDS.schemaName, options) && { schemaName: t.schemaName ?? null }),
    ...(on(TABLE_FIELDS.comment, options) && { comment: t.comment ?? null }),
    ...(on(TABLE_FIELDS.origin, options) && { origin: t.origin }),
    ...(on(TABLE_FIELDS.columns, options) && { columns: t.columns.map(column) }),
    ...(on(TABLE_FIELDS.primaryKey, options) && {
      primaryKey: t.primaryKey ? t.primaryKey.columnIds : null,
    }),
    ...(on(TABLE_FIELDS.uniqueConstraints, options) && {
      unique: byJson(t.uniqueConstraints.map((u) => u.columnIds)),
    }),
    ...(on(TABLE_FIELDS.indexes, options) && {
      indexes: byJson(t.indexes.map((i) => ({ columns: i.columnIds, unique: i.unique }))),
    }),
    ...(on(TABLE_FIELDS.checkConstraints, options) && {
      checks: byJson(t.checkConstraints.map((c) => norm(c.expression))),
    }),
  });
  const relationship = (r: Relationship) => ({
    ...(on(RELATIONSHIP_FIELDS.id, options) && { id: r.id }),
    ...(on(RELATIONSHIP_FIELDS.from, options) && { from: r.from }),
    ...(on(RELATIONSHIP_FIELDS.to, options) && { to: r.to }),
    ...(on(RELATIONSHIP_FIELDS.onDelete, options) && { onDelete: r.onDelete ?? null }),
    ...(on(RELATIONSHIP_FIELDS.onUpdate, options) && { onUpdate: r.onUpdate ?? null }),
    ...(on(RELATIONSHIP_FIELDS.cardinality, options) && { cardinality: r.cardinality }),
    ...(on(RELATIONSHIP_FIELDS.origin, options) && { origin: r.origin }),
  });
  return {
    tables: Object.values(schema.tables)
      .map(table)
      .sort((a, b) => String(a.id).localeCompare(String(b.id))),
    relationships: byJson(Object.values(schema.relationships).map(relationship)),
    enums: Object.values(schema.enums)
      .map((e) => ({ name: e.name, values: e.values }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
