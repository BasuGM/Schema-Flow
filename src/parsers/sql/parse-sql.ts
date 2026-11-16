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
} from "./parse-statements";
import { splitStatements, type SqlStatement } from "./split";
import { SqlSyntaxError, TokenStream } from "./token-stream";

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
  | "LOCK/UNLOCK";

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
    const warn = (message: string, line?: number) =>
      this.warn(message, line ?? statement.startLine, statement);
    try {
      this.dispatch(ts, statement, warn);
    } catch (error) {
      const detail = error instanceof SqlSyntaxError ? error.message : "unexpected parser error";
      const line = error instanceof SqlSyntaxError ? error.line : undefined;
      warn(`Could not parse ${describe(statement)}: ${detail}. The statement was skipped.`, line);
    }
  }

  private dispatch(
    ts: TokenStream,
    statement: SqlStatement,
    warn: (m: string, line?: number) => void,
  ): void {
    const ignore = classifyIgnored(statement);
    if (ignore) {
      this.ignored.set(ignore, (this.ignored.get(ignore) ?? 0) + 1);
      return;
    }
    if (ts.acceptKeywords("CREATE")) {
      ts.acceptKeywords("OR", "REPLACE");
      ts.acceptAny("GLOBAL", "LOCAL");
      ts.acceptAny("TEMPORARY", "TEMP", "UNLOGGED");
      if (ts.acceptKeywords("TABLE")) {
        ts.acceptKeywords("IF", "NOT", "EXISTS");
        return this.addTable(parseCreateTable(ts, warn), warn);
      }
      const unique = ts.acceptKeywords("UNIQUE");
      if (ts.acceptKeywords("INDEX")) {
        const index = parseCreateIndex(ts, unique);
        if ("expressionOn" in index)
          warn(`Skipped an index on expressions for "${index.expressionOn.name}".`);
        else this.indexes.push(index);
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

  private addTable(table: DraftTable, warn: (m: string, line?: number) => void): void {
    const key = this.key(table.name, table.schemaName);
    if (this.byKey.has(key)) {
      // Let normalize report the duplicate (error); keep the first for ALTER lookups.
      this.tables.push(table);
      return;
    }
    this.byKey.set(key, table);
    this.tables.push(table);
    if (table.columns.length === 0) warn(`Table "${table.name}" has no columns.`, table.line);
  }

  private applyAlter(alter: AlterTable, warn: (m: string, line?: number) => void): void {
    const table = this.byKey.get(this.key(alter.table.name, alter.table.schemaName));
    const label = alter.table.schemaName
      ? `${alter.table.schemaName}.${alter.table.name}`
      : alter.table.name;
    for (const action of alter.actions) {
      switch (action.kind) {
        case "ownerTo":
          this.ignored.set("OWNER TO", (this.ignored.get("OWNER TO") ?? 0) + 1);
          break;
        case "unsupported":
          warn(
            `Skipped unsupported ALTER TABLE action on "${label}": ${truncate(action.description, 60)}.`,
            action.line,
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
            if (action.column.type === "")
              warnNoType(warn, table.name, action.column.name, action.line);
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

  finish(options: ParseSqlOptions, text: string): DraftSchema {
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

  private warn(message: string, line: number, statement: SqlStatement): void {
    this.issues.push({
      severity: "warning",
      message,
      line,
      statement: truncate(statement.text, SNIPPET),
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
  const [a, b, c, d] = words(statement, 4);
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
  const createKind = a === "CREATE" ? (b === "OR" && c === "REPLACE" ? d : b) : undefined;
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
  return null;
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
  const all = words(statement, 8);
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
