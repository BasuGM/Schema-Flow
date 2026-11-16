import type {
  DraftDetachedForeignKey,
  DraftDetachedIndex,
  DraftSchema,
  DraftTable,
} from "@/domain/schema/draft";
import { normalizeSchema, toImportResult } from "@/domain/schema/normalize";
import type { ImportIssue, ImportResult, SqlDialect } from "@/domain/schema/types";
import { validateSchema } from "@/domain/schema/validate";
import { detectFormat } from "../detect-format";
import {
  applyConstraint,
  parseAlterTable,
  parseCreateIndex,
  parseCreateTable,
  parseCreateType,
  warnNoType,
  type AlterTable,
  type PartitionLink,
  type Warn,
} from "./parse-statements";
import { tableLabel } from "../table-label";
import { splitStatements, type SqlStatement } from "./split";
import { SqlSyntaxError, TokenStream, type QualifiedName } from "./token-stream";

export interface ParseSqlOptions {
  /** Detected from the text when omitted. */
  dialect?: SqlDialect;
  /** Schema display name. */
  name?: string;
  /** Clock for `source.importedAt` (injectable for deterministic tests). */
  now?: () => string;
}

/**
 * Statement kinds that carry nothing the diagram needs. They are counted and reported in ONE summary
 * warning instead of one warning each (a pg_dump file has dozens of them).
 */
type IgnoredKind =
  | "SET"
  | "SELECT"
  | "OWNER TO"
  | "GRANT/REVOKE"
  | "COMMENT ON"
  | "sequences"
  | "extensions"
  | "functions/triggers"
  | "schemas"
  | "transactions"
  | "DROP"
  | "data (INSERT)"
  | "PRAGMA"
  | "USE"
  | "LOCK/UNLOCK"
  | "ALTER INDEX"
  | "DISABLE/ENABLE KEYS";

const SNIPPET = 120;

/**
 * Parses SQL DDL text into a normalized schema. The SQL is only tokenized — never executed.
 * Never throws: every problem becomes an `ImportIssue`, and one bad statement does not prevent the
 * others from being imported.
 */
export function parseSql(text: string, options: ParseSqlOptions = {}): ImportResult {
  const issues: ImportIssue[] = [];
  try {
    const detected = detectFormat(text);
    const dialect = options.dialect ?? detected.dialect ?? "postgresql";
    const { statements, issues: splitIssues } = splitStatements(text, dialect);
    issues.push(...splitIssues);

    const builder = new DraftBuilder(dialect, issues, text);
    for (const statement of statements) builder.add(statement);
    const draft = builder.finish(options, text);

    const schema = normalizeSchema(draft);
    schema.issues.push(...validateSchema(schema));
    return toImportResult(schema);
  } catch (error) {
    // Defensive: a bug in the parser must never crash the app.
    issues.push({
      severity: "error",
      message: `The SQL could not be imported: ${error instanceof Error ? error.message : String(error)}`,
    });
    return { ok: false, issues };
  }
}

class DraftBuilder {
  private readonly tables: DraftTable[] = [];
  private readonly byKey = new Map<string, DraftTable>();
  private readonly foreignKeys: DraftDetachedForeignKey[] = [];
  private readonly indexes: DraftDetachedIndex[] = [];
  private readonly enums: { name: string; values: string[] }[] = [];
  private readonly ignored = new Map<IgnoredKind, number>();
  private readonly defaultSchema: string | undefined;
  /** Partition key → its parent (ADR-019); folded into the parent in `finish()`. */
  private readonly partitionOf = new Map<
    string,
    { parentKey: string; child: QualifiedName; line: number | undefined; warn: Warn }
  >();
  /** Warnings about one table, emitted in `finish()` unless the table was folded away. */
  private readonly deferred: { key: string; emit: () => void }[] = [];

  constructor(
    private readonly dialect: SqlDialect,
    private readonly issues: ImportIssue[],
    /** Whole input; token offsets index into it (shared, never copied per statement). */
    private readonly source: string,
  ) {
    this.defaultSchema = dialect === "postgresql" ? "public" : undefined;
  }

  add(statement: SqlStatement): void {
    const ts = new TokenStream(statement.tokens, this.source);
    const warn: Warn = (message, line, table) =>
      this.warn(message, line ?? statement.startLine, statement, table);
    try {
      this.dispatch(ts, statement, warn);
    } catch (error) {
      const detail = error instanceof SqlSyntaxError ? error.message : "unexpected parser error";
      const line = error instanceof SqlSyntaxError ? error.line : undefined;
      warn(`Could not parse ${describe(statement)}: ${detail}. The statement was skipped.`, line);
    }
  }

  private dispatch(ts: TokenStream, statement: SqlStatement, warn: Warn): void {
    const ignore = classifyIgnored(statement);
    if (ignore) {
      // mysqldump's version-guarded session plumbing (`/*!40101 SET … */;`, `/*!40000 ALTER TABLE
      // t DISABLE KEYS */;`) is skipped without a mention: it is not part of the user's schema.
      if (!statement.tokens.every((t) => t.executable))
        this.ignored.set(ignore, (this.ignored.get(ignore) ?? 0) + 1);
      return;
    }
    if (ts.acceptKeywords("CREATE")) {
      ts.acceptKeywords("OR", "REPLACE");
      ts.acceptAny("GLOBAL", "LOCAL");
      ts.acceptAny("TEMPORARY", "TEMP", "UNLOGGED");
      if (ts.acceptKeywords("TABLE")) {
        ts.acceptKeywords("IF", "NOT", "EXISTS");
        const created = parseCreateTable(ts, warn);
        if ("child" in created) return this.linkPartition(created, warn);
        return this.addTable(created, warn);
      }
      const unique = ts.acceptKeywords("UNIQUE");
      if (ts.acceptKeywords("INDEX")) {
        const index = parseCreateIndex(ts, unique);
        if ("expressionOn" in index) {
          const on = index.expressionOn;
          this.deferred.push({
            key: this.key(on.name, on.schemaName),
            emit: () =>
              warn(`Skipped an index on expressions for "${on.name}".`, undefined, tableLabel(on)),
          });
        } else this.indexes.push(index);
        return;
      }
      if (ts.acceptKeywords("TYPE")) {
        const enumType = parseCreateType(ts);
        if (enumType) this.enums.push(enumType);
        else warn("Skipped a CREATE TYPE that is not an enum.");
        return;
      }
    } else if (ts.acceptKeywords("ALTER", "TABLE")) {
      return this.applyAlter(parseAlterTable(ts), warn);
    }
    warn(`Skipped unsupported statement: ${describe(statement)}.`);
  }

  private addTable(table: DraftTable, warn: Warn): void {
    const key = this.key(table.name, table.schemaName);
    if (this.byKey.has(key)) {
      // Let normalize report the duplicate (error); keep the first for ALTER lookups.
      this.tables.push(table);
      return;
    }
    this.byKey.set(key, table);
    this.tables.push(table);
    if (table.columns.length === 0)
      warn(`Table "${table.name}" has no columns.`, table.line, tableLabel(table));
  }

  private applyAlter(alter: AlterTable, warn: Warn): void {
    const table = this.byKey.get(this.key(alter.table.name, alter.table.schemaName));
    const label = tableLabel(alter.table);
    for (const action of alter.actions) {
      switch (action.kind) {
        case "ownerTo":
          this.ignored.set("OWNER TO", (this.ignored.get("OWNER TO") ?? 0) + 1);
          break;
        case "attachPartition":
          this.linkPartition({ child: action.child, parent: alter.table, line: action.line }, warn);
          break;
        case "unsupported":
          warn(
            `Skipped unsupported ALTER TABLE action on "${label}": ${truncate(action.description, 60)}.`,
            action.line,
            label,
          );
          break;
        case "constraint":
          if (action.constraint.kind === "foreignKey") {
            // Detached so normalize resolves it even if the table is declared later or missing.
            this.foreignKeys.push({
              ...action.constraint.fk,
              table: alter.table.name,
              ...(alter.table.schemaName ? { schemaName: alter.table.schemaName } : {}),
            });
          } else if (table) applyConstraint(table, action.constraint, warn, action.line);
          else warn(`ALTER TABLE references unknown table "${label}".`, action.line);
          break;
        case "addColumn":
          if (table) {
            table.columns.push(action.column);
            if (action.column.type === "") warnNoType(warn, table, action.column.name, action.line);
          } else warn(`ALTER TABLE references unknown table "${label}".`, action.line);
          break;
        case "columnDefault":
        case "columnNullable": {
          const column = table?.columns.find(
            (c) => c.name.toLowerCase() === action.column.toLowerCase(),
          );
          if (!column) {
            warn(
              `ALTER TABLE references unknown column "${action.column}" in "${label}".`,
              action.line,
              label,
            );
          } else if (action.kind === "columnNullable") {
            column.nullable = action.nullable;
          } else if (action.value) {
            column.default = action.value;
          } else delete column.default;
          break;
        }
      }
    }
  }

  private linkPartition(link: PartitionLink, warn: Warn): void {
    this.partitionOf.set(this.key(link.child.name, link.child.schemaName), {
      parentKey: this.key(link.parent.name, link.parent.schemaName),
      child: link.child,
      line: link.line,
      warn,
    });
  }

  /**
   * Folds PostgreSQL partitions into their root partitioned table (ADR-019): the partitions leave
   * the diagram and are listed on the parent. Foreign keys and indexes declared on a partition go
   * with it (pg_dump declares the real ones on the parent); references to a partition point at
   * the parent instead.
   */
  private foldPartitions(): void {
    if (this.partitionOf.size === 0) return;
    const rootOf = (key: string): string => {
      const seen = new Set<string>();
      let current = key;
      for (let next = this.partitionOf.get(current); next && !seen.has(current);) {
        seen.add(current);
        current = next.parentKey;
        next = this.partitionOf.get(current);
      }
      return current;
    };
    const folded = new Map<string, DraftTable>();
    for (const [childKey, link] of this.partitionOf) {
      const parent = this.byKey.get(rootOf(childKey));
      if (!parent || parent === this.byKey.get(childKey)) {
        const label = tableLabel(link.child);
        if (!this.byKey.has(childKey))
          link.warn(`Partition "${label}" of an unknown table was skipped.`, link.line, label);
        continue;
      }
      folded.set(childKey, parent);
      (parent.partitions ??= []).push(tableLabel(link.child));
    }
    if (folded.size === 0) return;

    const keep = this.tables.filter((t) => !folded.has(this.key(t.name, t.schemaName)));
    this.tables.splice(0, this.tables.length, ...keep);
    const retarget = (ref: { table: string; schemaName?: string }) => {
      const parent = folded.get(this.key(ref.table, ref.schemaName));
      if (!parent) return;
      ref.table = parent.name;
      if (parent.schemaName) ref.schemaName = parent.schemaName;
      else delete ref.schemaName;
    };
    const fks = this.foreignKeys.filter((fk) => !folded.has(this.key(fk.table, fk.schemaName)));
    this.foreignKeys.splice(0, this.foreignKeys.length, ...fks);
    for (const fk of this.foreignKeys) retarget(fk.references);
    for (const t of this.tables) {
      for (const fk of t.foreignKeys ?? []) retarget(fk.references);
      for (const c of t.columns) if (c.references) retarget(c.references);
    }
    const indexes = this.indexes.filter((i) => !folded.has(this.key(i.table, i.schemaName)));
    this.indexes.splice(0, this.indexes.length, ...indexes);
    const deferred = this.deferred.filter((d) => !folded.has(d.key));
    this.deferred.splice(0, this.deferred.length, ...deferred);

    const parents = new Set(folded.values()).size;
    this.issues.push({
      severity: "warning",
      message: `Folded ${folded.size} partition${folded.size === 1 ? "" : "s"} into ${parents} partitioned table${parents === 1 ? "" : "s"}; the inspector lists each table's partitions.`,
    });
  }

  finish(options: ParseSqlOptions, text: string): DraftSchema {
    this.foldPartitions();
    for (const d of this.deferred) d.emit();
    const total = [...this.ignored.values()].reduce((a, b) => a + b, 0);
    if (total > 0) {
      const parts = [...this.ignored.entries()].map(([kind, n]) => `${kind} ×${n}`).join(", ");
      this.issues.push({
        severity: "warning",
        message: `Skipped ${total} statement${total === 1 ? "" : "s"} not needed for the diagram: ${parts}.`,
      });
    }
    if (this.tables.length === 0) {
      this.issues.push({
        severity: "error",
        message: text.trim() ? "No CREATE TABLE statements were found." : "The input is empty.",
      });
    }
    const draft: DraftSchema = {
      name: options.name ?? "Imported SQL",
      source: {
        format: "sql",
        dialect: this.dialect,
        importedAt: options.now?.() ?? new Date().toISOString(),
      },
      tables: this.tables,
      foreignKeys: this.foreignKeys,
      indexes: this.indexes,
      enums: this.enums,
      issues: this.issues,
    };
    if (this.defaultSchema) draft.defaultSchemaName = this.defaultSchema;
    return draft;
  }

  private warn(message: string, line: number, statement: SqlStatement, table?: string): void {
    this.issues.push({
      severity: "warning",
      message,
      line,
      statement: truncate(statement.text, SNIPPET),
      ...(table ? { table } : {}),
    });
  }

  private key(name: string, schemaName?: string): string {
    return `${(schemaName ?? this.defaultSchema ?? "").toLowerCase()}.${name.toLowerCase()}`;
  }
}

function words(statement: SqlStatement, count: number): string[] {
  return statement.tokens
    .slice(0, count)
    .map((t) => (t.kind === "word" ? t.value.toUpperCase() : t.text));
}

/** Statements that are irrelevant to the diagram, grouped for the summary warning. */
function classifyIgnored(statement: SqlStatement): IgnoredKind | null {
  const [a, b] = words(statement, 2);
  const upper = statement.tokens.filter((t) => t.kind === "word").map((t) => t.value.toUpperCase());
  if (a === "SET" || a === "RESET") return "SET";
  if (a === "SELECT") return "SELECT";
  if (a === "GRANT" || a === "REVOKE") return "GRANT/REVOKE";
  if (a === "COMMENT" && b === "ON") return "COMMENT ON";
  if (a === "PRAGMA") return "PRAGMA";
  if (a === "USE") return "USE";
  if (a === "LOCK" || a === "UNLOCK") return "LOCK/UNLOCK";
  if (a === "DROP") return "DROP";
  if (a === "INSERT" || a === "REPLACE") return "data (INSERT)";
  if (["BEGIN", "COMMIT", "START", "ROLLBACK", "END", "SAVEPOINT", "RELEASE"].includes(a ?? ""))
    return "transactions";
  const createKind = a === "CREATE" ? createdObjectKind(upper) : undefined;
  if (createKind === "SEQUENCE" || (a === "ALTER" && b === "SEQUENCE")) return "sequences";
  if (createKind === "EXTENSION") return "extensions";
  if (createKind === "SCHEMA" || createKind === "DATABASE") return "schemas";
  if (
    ["FUNCTION", "PROCEDURE", "TRIGGER", "EVENT", "AGGREGATE", "OPERATOR", "RULE"].includes(
      createKind ?? "",
    )
  )
    return "functions/triggers";
  if (a === "ALTER" && b !== "TABLE" && upper.includes("OWNER")) return "OWNER TO";
  // Index plumbing such as pg_dump's `ALTER INDEX parent_idx ATTACH PARTITION child_idx`.
  if (a === "ALTER" && b === "INDEX") return "ALTER INDEX";
  // mysqldump: `/*!40000 ALTER TABLE t DISABLE KEYS */` around INSERT data.
  const last = upper.at(-1);
  if (
    a === "ALTER" &&
    b === "TABLE" &&
    upper.at(-2) &&
    last === "KEYS" &&
    ["DISABLE", "ENABLE"].includes(upper.at(-2)!)
  )
    return "DISABLE/ENABLE KEYS";
  return null;
}

const OBJECT_KINDS = new Set([
  "TABLE",
  "INDEX",
  "VIEW",
  "TYPE",
  "SEQUENCE",
  "EXTENSION",
  "SCHEMA",
  "DATABASE",
  "FUNCTION",
  "PROCEDURE",
  "TRIGGER",
  "EVENT",
  "AGGREGATE",
  "OPERATOR",
  "RULE",
]);

/**
 * The kind of object a CREATE statement makes, skipping modifiers such as `OR REPLACE` and MySQL's
 * `DEFINER = user`, `ALGORITHM = …` and `SQL SECURITY …` (mysqldump and Sakila write
 * `CREATE DEFINER=… PROCEDURE`). Only the leading words are searched.
 */
function createdObjectKind(upperWords: string[]): string | undefined {
  return upperWords.slice(1, 12).find((w) => OBJECT_KINDS.has(w));
}

const MODIFIERS = new Set([
  "OR",
  "REPLACE",
  "MATERIALIZED",
  "UNIQUE",
  "TEMP",
  "TEMPORARY",
  "UNLOGGED",
  "GLOBAL",
  "LOCAL",
  "RECURSIVE",
]);

/** Leading keywords only, e.g. `CREATE OR REPLACE VIEW` (never the object's name). */
function describe(statement: SqlStatement): string {
  const all = words(statement, 12);
  const kind = all[0] === "CREATE" ? createdObjectKind(all) : undefined;
  if (kind) {
    const modifiers = all.slice(1, all.indexOf(kind)).filter((w) => MODIFIERS.has(w));
    return ["CREATE", ...modifiers, kind].join(" ");
  }
  const lead: string[] = [];
  for (const w of all) {
    if (!/^[A-Z_]+$/.test(w)) break;
    lead.push(w);
    if (lead.length > 1 && !MODIFIERS.has(w)) break;
  }
  return lead.length > 0 ? lead.join(" ") : truncate(statement.text, 40);
}

function truncate(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}
