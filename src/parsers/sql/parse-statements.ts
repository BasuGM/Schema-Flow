import type { DraftColumn, DraftDetachedIndex, DraftTable } from "@/domain/schema/draft";
import type { ColumnDefault } from "@/domain/schema/types";
import { parseColumn } from "./parse-column";
import { AUTOINCREMENT_DEFAULT, classifyDefault } from "./parse-default";
import {
  atTableConstraint,
  parseTableConstraint,
  type TableConstraint,
} from "./parse-table-constraint";
import type { QualifiedName, TokenStream } from "./token-stream";

export type Warn = (message: string, line?: number) => void;

/** After `CREATE [modifiers] TABLE [IF NOT EXISTS]`. */
export function parseCreateTable(ts: TokenStream, warn: Warn): DraftTable {
  const line = ts.line;
  const name = ts.readQualifiedName("table name");
  if (!ts.isPunct("(")) {
    return ts.fail(
      ts.isKeyword("AS") ? "CREATE TABLE … AS is not supported" : "Expected a column list",
    );
  }
  ts.expectPunct("(");
  const table: DraftTable = { name: name.name, columns: [] };
  if (name.schemaName) table.schemaName = name.schemaName;
  if (line !== undefined) table.line = line;

  while (!ts.done && !ts.isPunct(")")) {
    if (atTableConstraint(ts)) applyConstraint(table, parseTableConstraint(ts), warn, ts.line);
    else {
      const { column, checks } = parseColumn(ts);
      table.columns.push(column);
      if (checks.length > 0) (table.checkConstraints ??= []).push(...checks);
    }
    if (!ts.acceptPunct(",")) break;
  }
  ts.expectPunct(")");
  // Table options (ENGINE=…, WITHOUT ROWID, INHERITS (…), PARTITION BY …) are ignored.
  return table;
}

export function applyConstraint(
  table: DraftTable,
  c: TableConstraint,
  warn: Warn,
  line?: number,
): void {
  switch (c.kind) {
    case "primaryKey":
      table.primaryKey = c.key;
      break;
    case "unique":
      (table.uniqueConstraints ??= []).push(c.key);
      break;
    case "index":
      (table.indexes ??= []).push({ ...c.key, unique: false });
      break;
    case "foreignKey":
      (table.foreignKeys ??= []).push(c.fk);
      break;
    case "check":
      (table.checkConstraints ??= []).push(c.check);
      break;
    case "skipped":
      warn(`Skipped ${c.reason} on "${table.name}".`, line);
      break;
  }
}

/** One action of an ALTER TABLE statement, applied by `parseSql` to the target draft table. */
export type AlterAction =
  | { kind: "constraint"; constraint: TableConstraint; line?: number }
  | { kind: "addColumn"; column: DraftColumn; line?: number }
  | { kind: "columnDefault"; column: string; value: ColumnDefault | null; line?: number }
  | { kind: "columnNullable"; column: string; nullable: boolean; line?: number }
  | { kind: "ownerTo" }
  | { kind: "unsupported"; description: string; line?: number };

export interface AlterTable {
  table: QualifiedName;
  actions: AlterAction[];
}

/** After `ALTER TABLE`. */
export function parseAlterTable(ts: TokenStream): AlterTable {
  ts.acceptKeywords("IF", "EXISTS");
  ts.acceptKeywords("ONLY");
  const table = ts.readQualifiedName("table name");
  // `ALTER TABLE name *` (PostgreSQL: include descendant tables).
  if (ts.peek()?.kind === "op" && ts.peek()?.text === "*") ts.next();
  const actions: AlterAction[] = [];
  do {
    actions.push(parseAlterAction(ts));
  } while (ts.acceptPunct(","));
  return { table, actions };
}

function parseAlterAction(ts: TokenStream): AlterAction {
  const line = ts.line;
  if (ts.acceptKeywords("ADD")) {
    if (atTableConstraint(ts))
      return { kind: "constraint", constraint: parseTableConstraint(ts), line };
    ts.acceptKeywords("COLUMN");
    ts.acceptKeywords("IF", "NOT", "EXISTS");
    const { column } = parseColumn(ts);
    return { kind: "addColumn", column, line };
  }
  if (ts.acceptKeywords("OWNER", "TO")) {
    ts.next();
    return { kind: "ownerTo" };
  }
  if (ts.acceptKeywords("ALTER")) {
    ts.acceptKeywords("COLUMN");
    const column = ts.readIdentifier("column name");
    if (ts.acceptKeywords("SET", "DEFAULT")) {
      const start = ts.index;
      ts.skipUntilListEnd();
      return { kind: "columnDefault", column, value: classifyDefault(ts.textSince(start)), line };
    }
    if (ts.acceptKeywords("DROP", "DEFAULT"))
      return { kind: "columnDefault", column, value: null, line };
    if (ts.acceptKeywords("ADD", "GENERATED")) {
      // pg_dump writes identity columns as ALTER COLUMN … ADD GENERATED … AS IDENTITY (…).
      ts.acceptAny("ALWAYS", ["BY", "DEFAULT"]);
      ts.expectKeywords("AS", "IDENTITY");
      if (ts.isPunct("(")) ts.readParenthesized();
      return { kind: "columnDefault", column, value: AUTOINCREMENT_DEFAULT, line };
    }
    if (ts.acceptKeywords("SET", "NOT", "NULL"))
      return { kind: "columnNullable", column, nullable: false, line };
    if (ts.acceptKeywords("DROP", "NOT", "NULL"))
      return { kind: "columnNullable", column, nullable: true, line };
    const start = ts.index;
    ts.skipUntilListEnd();
    return {
      kind: "unsupported",
      description: `ALTER COLUMN ${column} ${ts.textSince(start)}`.trim(),
      line,
    };
  }
  const start = ts.index;
  ts.skipUntilListEnd();
  return { kind: "unsupported", description: ts.textSince(start) || "empty action", line };
}

/** After `CREATE [UNIQUE] INDEX`. Expression indexes return `{ expressionOn }` for the caller to report. */
export function parseCreateIndex(
  ts: TokenStream,
  unique: boolean,
): DraftDetachedIndex | { expressionOn: QualifiedName } {
  const line = ts.line;
  ts.acceptKeywords("CONCURRENTLY");
  ts.acceptKeywords("IF", "NOT", "EXISTS");
  const name = ts.isKeyword("ON") ? undefined : ts.readQualifiedName("index name").name;
  ts.expectKeywords("ON");
  ts.acceptKeywords("ONLY");
  const table = ts.readQualifiedName("table name");
  if (ts.acceptKeywords("USING")) ts.next();
  const columns = ts.readIdentifierList();
  if (!columns || columns.length === 0) return { expressionOn: table };
  const index: DraftDetachedIndex = { table: table.name, columns, unique };
  if (table.schemaName) index.schemaName = table.schemaName;
  if (name) index.name = name;
  if (line !== undefined) index.line = line;
  return index;
}

/** After `CREATE TYPE`. Returns null for non-enum types. */
export function parseCreateType(ts: TokenStream): { name: string; values: string[] } | null {
  const { name } = ts.readQualifiedName("type name");
  if (!ts.acceptKeywords("AS", "ENUM")) return null;
  ts.expectPunct("(");
  const values: string[] = [];
  while (!ts.done && !ts.isPunct(")")) {
    const t = ts.next()!;
    if (t.kind === "string") values.push(t.value);
    else if (!(t.kind === "punct" && t.text === ",")) ts.fail("Expected an enum label");
  }
  ts.expectPunct(")");
  return { name, values };
}
