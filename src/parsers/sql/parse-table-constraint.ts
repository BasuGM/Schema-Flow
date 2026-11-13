import type { DraftForeignKey, DraftKey } from "@/domain/schema/draft";
import type { CheckConstraint } from "@/domain/schema/types";
import { parseReferences } from "./references";
import type { TokenStream } from "./token-stream";

export type TableConstraint =
  | { kind: "primaryKey"; key: DraftKey }
  | { kind: "unique"; key: DraftKey }
  | { kind: "index"; key: DraftKey }
  | { kind: "foreignKey"; fk: DraftForeignKey }
  | { kind: "check"; check: CheckConstraint }
  | { kind: "skipped"; reason: string };

/** True when the stream is at a table-level constraint rather than a column definition. */
export function atTableConstraint(ts: TokenStream): boolean {
  const word = ts.peek()?.kind === "word" ? ts.peek()!.value.toUpperCase() : "";
  if (
    [
      "CONSTRAINT",
      "PRIMARY",
      "FOREIGN",
      "CHECK",
      "EXCLUDE",
      "LIKE",
      "FULLTEXT",
      "SPATIAL",
    ].includes(word)
  )
    return true;
  if (word === "UNIQUE")
    return (
      ts.isPunct("(", 1) || ts.isKeyword("KEY", 1) || ts.isKeyword("INDEX", 1) || ts.isPunct("(", 2)
    );
  if (word === "KEY" || word === "INDEX") {
    // `KEY idx (col)` / `INDEX (col)` vs a column named "key" with a type such as `varchar(10)`.
    if (ts.isPunct("(", 1)) return true;
    return ts.isPunct("(", 2) && ts.peek(3)?.kind !== "number";
  }
  return false;
}

/** Parses one table-level constraint (inside CREATE TABLE or after ALTER TABLE … ADD). */
export function parseTableConstraint(ts: TokenStream): TableConstraint {
  const line = ts.line;
  const name = ts.acceptKeywords("CONSTRAINT") ? ts.readIdentifier("constraint name") : undefined;
  const named = <T extends object>(v: T): T & { name?: string } => (name ? { name, ...v } : v);

  if (ts.acceptKeywords("PRIMARY", "KEY")) {
    const columns = readKeyColumns(ts);
    return columns
      ? { kind: "primaryKey", key: named({ columns }) }
      : { kind: "skipped", reason: "primary key on expressions" };
  }
  if (ts.acceptKeywords("UNIQUE")) {
    ts.acceptAny("KEY", "INDEX");
    const indexName = !ts.isPunct("(") ? ts.readIdentifier("index name") : undefined;
    const columns = readKeyColumns(ts);
    const key = name ?? indexName;
    return columns
      ? { kind: "unique", key: key ? { name: key, columns } : { columns } }
      : { kind: "skipped", reason: "unique constraint on expressions" };
  }
  if (ts.acceptKeywords("FOREIGN", "KEY")) {
    if (!ts.isPunct("(")) ts.readIdentifier("index name");
    const columns = ts.readIdentifierList();
    ts.expectKeywords("REFERENCES");
    const ref = parseReferences(ts);
    if (!columns) return { kind: "skipped", reason: "foreign key on expressions" };
    const { onDelete, onUpdate, ...references } = ref;
    const fk: DraftForeignKey = named({ columns, references });
    if (onDelete) fk.onDelete = onDelete;
    if (onUpdate) fk.onUpdate = onUpdate;
    if (line !== undefined) fk.line = line;
    return { kind: "foreignKey", fk };
  }
  if (ts.acceptKeywords("CHECK")) {
    const expression = ts.readParenthesized();
    ts.acceptAny(["NO", "INHERIT"], ["NOT", "VALID"]);
    return { kind: "check", check: named({ expression }) };
  }
  if (
    ts.acceptKeywords("FULLTEXT") ||
    ts.acceptKeywords("SPATIAL") ||
    ts.isKeyword("KEY") ||
    ts.isKeyword("INDEX")
  ) {
    ts.acceptAny("KEY", "INDEX");
    const indexName = !ts.isPunct("(") ? ts.readIdentifier("index name") : undefined;
    if (ts.acceptKeywords("USING")) ts.next();
    const columns = readKeyColumns(ts);
    return columns
      ? { kind: "index", key: indexName ? { name: indexName, columns } : { columns } }
      : { kind: "skipped", reason: "index on expressions" };
  }
  if (ts.acceptKeywords("EXCLUDE")) {
    ts.skipUntilListEnd();
    return { kind: "skipped", reason: "EXCLUDE constraint" };
  }
  if (ts.acceptKeywords("LIKE")) {
    ts.skipUntilListEnd();
    return { kind: "skipped", reason: "LIKE clause (copied columns are not imported)" };
  }
  return ts.fail("Expected a table constraint");
}

function readKeyColumns(ts: TokenStream): string[] | null {
  const columns = ts.readIdentifierList();
  // Trailing index options: USING BTREE, WITH (...), USING INDEX TABLESPACE x, DEFERRABLE …
  while (!ts.done && !ts.isPunct(",") && !ts.isPunct(")")) {
    if (ts.isPunct("(")) ts.readParenthesized();
    else ts.next();
  }
  return columns && columns.length > 0 ? columns : null;
}
