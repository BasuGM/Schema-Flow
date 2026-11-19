import { showsSchemaName } from "@/domain/schema/selectors";
import type {
  ColumnId,
  ReferentialAction,
  Relationship,
  Schema,
  SqlDialect,
  Table,
  TableId,
} from "@/domain/schema/types";
import { sqlLineComment, sqlString } from "../text/escape";
import { createWarnings, type GeneratedText } from "../text/types";
import { renderColumn } from "./column-sql";
import { createIdent, createTally, type SqlContext } from "./context";
import { createNameRegistry } from "./names";

export interface SqlOptions {
  dialect: SqlDialect;
}

const ACTION: Record<ReferentialAction, string> = {
  cascade: "CASCADE",
  restrict: "RESTRICT",
  "set null": "SET NULL",
  "set default": "SET DEFAULT",
  "no action": "NO ACTION",
};

const DIALECT_LABEL: Record<SqlDialect, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

/**
 * DDL for `schema` in `options.dialect`. Same dialect: types and defaults are copied as written.
 * Otherwise they are mapped, and everything approximated or dropped is reported in `warnings`.
 * PostgreSQL and MySQL add foreign keys with `ALTER TABLE` after all tables (cycles and
 * self-references are safe); SQLite, which cannot, declares them inline. Never throws.
 */
export function generateSql(schema: Schema, options: SqlOptions): GeneratedText {
  const warnings = createWarnings();
  const header = sqlLineComment(
    `SchemaFlow export: ${schema.name} (${DIALECT_LABEL[options.dialect]})`,
  );
  try {
    return { text: build(schema, options.dialect, warnings, header), warnings: warnings.list() };
  } catch (error) {
    warnings.add(`The export failed: ${error instanceof Error ? error.message : String(error)}`);
    return { text: `${header}\n`, warnings: warnings.list() };
  }
}

function createContext(
  schema: Schema,
  to: SqlDialect,
  tables: Table[],
  warnings: ReturnType<typeof createWarnings>,
): SqlContext {
  const from = schema.source.dialect ?? "postgresql";
  const isPrisma = schema.source.format === "prisma";
  const keyColumns = new Set<ColumnId>();
  const columnName = new Map<ColumnId, string>();
  for (const t of tables) {
    for (const c of t.columns) columnName.set(c.id, c.name);
    for (const id of t.primaryKey?.columnIds ?? []) keyColumns.add(id);
    for (const key of [...t.uniqueConstraints, ...t.indexes]) {
      for (const id of key.columnIds) keyColumns.add(id);
    }
  }
  for (const r of Object.values(schema.relationships)) {
    for (const id of [...r.from.columnIds, ...r.to.columnIds]) keyColumns.add(id);
  }
  return {
    schema,
    to,
    from,
    isPrisma,
    faithful: from === to && !isPrisma,
    warnings,
    tally: createTally(),
    names: createNameRegistry(to),
    copied: new Set(),
    keyColumns,
    columnName,
    ident: createIdent(to, warnings),
  };
}

function build(
  schema: Schema,
  to: SqlDialect,
  warnings: ReturnType<typeof createWarnings>,
  header: string,
): string {
  const tables = schema.tableOrder.flatMap((id) => schema.tables[id] ?? []);
  const ctx = createContext(schema, to, tables, warnings);
  const { ident, names, tally } = ctx;
  const cols = (ids: ColumnId[]) => ids.map((id) => ident(ctx.columnName.get(id) ?? id)).join(", ");

  // Table references (SQLite has no schemas: the prefix is dropped and clashes are renamed).
  const ref = new Map<TableId, string>();
  const schemasUsed = new Set<string>();
  for (const t of tables) {
    const qualified = to !== "sqlite" && showsSchemaName(schema, t);
    if (qualified) schemasUsed.add(t.schemaName!);
    if (to === "sqlite") {
      const first = names.claim("tables", t.name);
      const name =
        first.renamed && t.schemaName
          ? names.claim("tables", `${t.schemaName}_${t.name}`).name
          : first.name;
      if (showsSchemaName(schema, t))
        tally.add("SQLite has no schemas; table names lost their schema prefix.");
      if (name !== t.name) warnings.add(`Table "${t.name}" is created as "${name}" (name clash).`);
      ref.set(t.id, ident(name));
    } else {
      ref.set(t.id, qualified ? `${ident(t.schemaName!)}.${ident(t.name)}` : ident(t.name));
    }
  }
  const tableRef = (id: TableId) => ref.get(id) ?? ident(id);

  // Namespaces: PostgreSQL indexes and unique / PK constraints share one per schema; MySQL index
  // names are per table and foreign keys per database; SQLite index names are per database.
  const indexScope = (t: Table) =>
    to === "postgresql" ? `idx:${t.schemaName ?? ""}` : to === "mysql" ? `idx:${t.id}` : "idx";
  const claim = (scope: string, wanted: string) => {
    const r = names.claim(scope, wanted);
    if (r.renamed)
      warnings.add(`Name "${wanted}" is already used in its namespace; renamed to "${r.name}".`);
    return r.name;
  };

  const relsByChild = new Map<TableId, Relationship[]>();
  const relationships = Object.values(schema.relationships)
    .filter((r) => ref.has(r.from.tableId) && ref.has(r.to.tableId))
    .sort((a, b) => a.id.localeCompare(b.id));
  for (const r of relationships) {
    relsByChild.set(r.from.tableId, [...(relsByChild.get(r.from.tableId) ?? []), r]);
  }

  const fkClause = (r: Relationship): string => {
    let onDelete = r.onDelete;
    let onUpdate = r.onUpdate;
    if (to === "mysql") {
      for (const action of [onDelete, onUpdate]) {
        if (action === "set default") {
          tally.add("SET DEFAULT is not supported by InnoDB; the action was left out.");
        }
      }
      if (onDelete === "set default") onDelete = undefined;
      if (onUpdate === "set default") onUpdate = undefined;
    }
    const name = r.name
      ? `CONSTRAINT ${ident(to === "sqlite" ? r.name : claim(to === "mysql" ? "fk" : `fk:${r.from.tableId}`, r.name))} `
      : "";
    return (
      `${name}FOREIGN KEY (${cols(r.from.columnIds)}) REFERENCES ${tableRef(r.to.tableId)} (${cols(r.to.columnIds)})` +
      (onDelete ? ` ON DELETE ${ACTION[onDelete]}` : "") +
      (onUpdate ? ` ON UPDATE ${ACTION[onUpdate]}` : "")
    );
  };

  const sections: string[] = [header];

  if (to === "postgresql") {
    const pre = [...schemasUsed].sort().map((s) => `CREATE SCHEMA IF NOT EXISTS ${ident(s)};`);
    for (const e of Object.values(schema.enums)) {
      pre.push(
        `CREATE TYPE ${ident(e.name)} AS ENUM (${e.values.map((v) => sqlString(v, to)).join(", ")});`,
      );
    }
    if (pre.length > 0) sections.push(pre.join("\n"));
  } else if (to === "mysql" && schemasUsed.size > 0) {
    sections.push(
      [...schemasUsed]
        .sort()
        .map((s) => `CREATE DATABASE IF NOT EXISTS ${ident(s)};`)
        .join("\n"),
    );
  }

  const afterTables: string[] = [];
  const comments: string[] = [];
  for (const t of tables) {
    const lines: string[] = [];
    const checks: string[] = [];
    let inlinePk = false;
    for (const c of t.columns) {
      const r = renderColumn(ctx, t, c);
      lines.push(r.line);
      checks.push(...r.checks);
      inlinePk ||= r.inlinePrimaryKey;
    }
    if (t.columns.length === 0 && to !== "postgresql") {
      warnings.add(`Table "${t.name}" has no columns; ${DIALECT_LABEL[to]} may reject it.`);
    }
    const constraint = (name: string | undefined, scope: string | null) =>
      name ? `CONSTRAINT ${ident(scope ? claim(scope, name) : name)} ` : "";
    if (t.primaryKey && !inlinePk) {
      lines.push(
        `${constraint(t.primaryKey.name, to === "postgresql" ? indexScope(t) : null)}PRIMARY KEY (${cols(t.primaryKey.columnIds)})`,
      );
    }
    for (const u of t.uniqueConstraints) {
      const scope = to === "sqlite" ? null : indexScope(t);
      lines.push(`${constraint(u.name, scope)}UNIQUE (${cols(u.columnIds)})`);
    }
    for (const c of t.checkConstraints) {
      lines.push(`${constraint(c.name, null)}CHECK (${c.expression})`);
      if (!ctx.faithful) ctx.copied.add(t.id);
    }
    for (const expr of checks) lines.push(`CHECK (${expr})`);
    if (to === "sqlite") for (const r of relsByChild.get(t.id) ?? []) lines.push(fkClause(r));
    if (t.partitions?.length) {
      warnings.add(`Table "${t.name}": ${t.partitions.length} folded partitions are not emitted.`);
    }

    const tableComment =
      to === "mysql" && t.comment ? ` COMMENT=${sqlString(t.comment, "mysql")}` : "";
    const sqliteComments =
      to === "sqlite"
        ? [
            ...(t.comment ? [sqlLineComment(`${t.name}: ${t.comment}`)] : []),
            ...t.columns.flatMap((c) =>
              c.comment ? [sqlLineComment(`${t.name}.${c.name}: ${c.comment}`)] : [],
            ),
          ]
        : [];
    sections.push(
      [
        ...sqliteComments,
        `CREATE TABLE ${tableRef(t.id)} (\n${lines.map((l) => `  ${l}`).join(",\n")}${lines.length ? "\n" : ""})${tableComment};`,
      ].join("\n"),
    );

    for (const index of t.indexes) {
      const base =
        index.name ??
        `${t.name}_${index.columnIds.map((id) => ctx.columnName.get(id) ?? id).join("_")}_${index.unique ? "key" : "idx"}`.slice(
          0,
          60,
        );
      afterTables.push(
        `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${ident(claim(indexScope(t), base))} ON ${tableRef(t.id)} (${cols(index.columnIds)});`,
      );
    }
    if (to === "postgresql") {
      if (t.comment)
        comments.push(`COMMENT ON TABLE ${tableRef(t.id)} IS ${sqlString(t.comment, to)};`);
      for (const c of t.columns) {
        if (c.comment) {
          comments.push(
            `COMMENT ON COLUMN ${tableRef(t.id)}.${ident(c.name)} IS ${sqlString(c.comment, to)};`,
          );
        }
      }
    }
  }

  if (afterTables.length > 0) sections.push(afterTables.join("\n"));
  if (to !== "sqlite" && relationships.length > 0) {
    sections.push(
      relationships
        .map((r) => `ALTER TABLE ${tableRef(r.from.tableId)} ADD ${fkClause(r)};`)
        .join("\n"),
    );
  }
  if (comments.length > 0) sections.push(comments.join("\n"));

  tally.flush(warnings);
  for (const id of ctx.copied) {
    const t = schema.tables[id];
    warnings.add(
      `Table "${t?.name ?? id}": CHECK constraints and expression defaults are copied as written and may need editing.`,
    );
  }
  return `${sections.join("\n\n")}\n`;
}
