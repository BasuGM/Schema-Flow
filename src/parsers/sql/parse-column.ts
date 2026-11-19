import type { DraftColumn } from "@/domain/schema/draft";
import type { CheckConstraint } from "@/domain/schema/types";
import { AUTOINCREMENT_DEFAULT, classifyDefault, isSerialType } from "./parse-default";
import { parseReferences } from "./references";
import type { TokenStream } from "./token-stream";

/** Words that start a column constraint; a DEFAULT expression ends before any of them. */
const CONSTRAINT_START = new Set([
  "NOT",
  "NULL",
  "DEFAULT",
  "PRIMARY",
  "UNIQUE",
  "CHECK",
  "REFERENCES",
  "CONSTRAINT",
  "GENERATED",
  "AUTO_INCREMENT",
  "AUTOINCREMENT",
  "COLLATE",
  "COMMENT",
  "ON",
  "AS",
  "CHARACTER",
  "CHARSET",
]);

export interface ParsedColumn {
  column: DraftColumn;
  checks: CheckConstraint[];
}

/** Parses `name type [constraints…]` up to (not including) the next top-level `,` or `)`. */
export function parseColumn(ts: TokenStream): ParsedColumn {
  const name = ts.readIdentifier("column name");
  const type = readType(ts);
  const column: DraftColumn = { name, type };
  const checks: CheckConstraint[] = [];
  if (isSerialType(type.split("(")[0]!.trim())) column.default = AUTOINCREMENT_DEFAULT;

  let constraintName: string | undefined;
  while (!ts.done && !ts.isPunct(",") && !ts.isPunct(")")) {
    if (ts.acceptKeywords("CONSTRAINT")) {
      constraintName = ts.readIdentifier("constraint name");
      continue;
    }
    if (ts.acceptKeywords("NOT", "NULL")) column.nullable = false;
    else if (ts.acceptKeywords("NULL")) column.nullable = true;
    else if (ts.acceptKeywords("DEFAULT"))
      column.default = classifyDefault(readDefaultExpression(ts));
    else if (ts.acceptKeywords("PRIMARY", "KEY")) {
      column.primaryKey = true;
      ts.acceptAny("ASC", "DESC");
      if (ts.acceptKeywords("AUTOINCREMENT")) column.default = AUTOINCREMENT_DEFAULT;
    } else if (ts.acceptKeywords("UNIQUE")) {
      column.unique = true;
      ts.acceptKeywords("KEY");
    } else if (ts.acceptKeywords("CHECK")) {
      checks.push(withName({ expression: ts.readParenthesized() }, constraintName));
    } else if (ts.acceptKeywords("REFERENCES")) {
      const ref = parseReferences(ts);
      column.references = constraintName ? { ...ref, name: constraintName } : ref;
    } else if (ts.acceptKeywords("GENERATED")) {
      readGenerated(ts, column);
    } else if (ts.acceptKeywords("AS")) {
      // MySQL/SQLite generated column: AS (expr) [STORED|VIRTUAL]
      if (ts.isPunct("(")) ts.readParenthesized();
    } else if (ts.acceptKeywords("AUTO_INCREMENT") || ts.acceptKeywords("AUTOINCREMENT")) {
      column.default = AUTOINCREMENT_DEFAULT;
    } else if (ts.acceptKeywords("COMMENT")) {
      const t = ts.next();
      if (t?.kind === "string") column.comment = t.value;
    } else if (ts.acceptKeywords("ON", "UPDATE")) {
      readDefaultExpression(ts);
    } else if (
      ts.acceptKeywords("COLLATE") ||
      ts.acceptKeywords("CHARSET") ||
      ts.acceptKeywords("CHARACTER", "SET")
    ) {
      ts.next();
    } else if (ts.isPunct("(")) {
      ts.readParenthesized();
    } else {
      // Tolerant: skip anything we don't model (STORAGE, COMPRESSION, ON CONFLICT, …).
      ts.next();
    }
    constraintName = undefined;
  }
  return { column, checks };
}

/** Words that may continue a multi-word type name, given the previous word. */
function continuesType(prev: string, word: string, nextWord: string | undefined): boolean {
  const p = prev.toUpperCase();
  const w = word.toUpperCase();
  const n = nextWord?.toUpperCase();
  if (w === "PRECISION") return p === "DOUBLE";
  if (w === "VARYING") return p === "CHARACTER" || p === "BIT" || p === "CHAR";
  if (w === "WITH" || w === "WITHOUT") return n === "TIME" || n === "LOCAL";
  if (w === "LOCAL") return p === "WITH";
  if (w === "TIME") return p === "WITH" || p === "WITHOUT" || p === "LOCAL";
  if (w === "ZONE") return p === "TIME";
  if (w === "UNSIGNED" || w === "SIGNED" || w === "ZEROFILL") return true;
  if (w === "VARCHAR" || w === "CHAR" || w === "CHARACTER") return p === "NATIONAL";
  return false;
}

/**
 * Reads a column type and returns it as written, with quotes and schema qualifiers removed so
 * `public."order_status"` becomes `order_status` (matching the enum's name).
 */
function readType(ts: TokenStream): string {
  const first = ts.peek();
  // A bare column name (`name,` / `name)` / end of input) has no type; SQLite allows it (QA-008).
  if (!first || (first.kind === "punct" && (first.text === "," || first.text === ")"))) return "";
  if (first.kind !== "word" && first.kind !== "quoted") return ts.fail("Expected a column type");
  // Some dialects allow omitting the type entirely (SQLite) — treat a constraint keyword as "no type".
  if (
    first.kind === "word" &&
    CONSTRAINT_START.has(first.value.toUpperCase()) &&
    first.value.toUpperCase() !== "CHARACTER"
  ) {
    return "";
  }
  const { name } = ts.readQualifiedName("type");
  const parts: string[] = [name];
  let prev = name;
  for (;;) {
    const t = ts.peek();
    if (!t) break;
    if (t.kind === "word" && continuesType(prev, t.value, ts.peek(1)?.value)) {
      parts.push(" " + t.value);
      prev = t.value;
      ts.next();
    } else if (t.kind === "punct" && t.text === "(") {
      parts.push(`(${ts.readParenthesized()})`);
    } else if (t.kind === "punct" && t.text === "[") {
      ts.next();
      if (ts.peek()?.kind === "number") ts.next();
      ts.expectPunct("]");
      parts.push("[]");
    } else if (t.kind === "word" && t.value.toUpperCase() === "ARRAY") {
      ts.next();
      parts.push("[]");
    } else break;
  }
  return parts.join("");
}

/** True when the next word is part of a cast type (`::character varying`), not a constraint. */
function isCastType(ts: TokenStream): boolean {
  return ts.peekBack()?.text === "::" || ts.peekBack()?.value?.toUpperCase() === "NATIONAL";
}

/** DEFAULT expression: tokens up to the next constraint keyword or `,`/`)` at depth 0. */
function readDefaultExpression(ts: TokenStream): string {
  const start = ts.index;
  let first = true;
  while (!ts.done && !ts.isPunct(",") && !ts.isPunct(")")) {
    const t = ts.peek()!;
    if (!first && t.kind === "word" && CONSTRAINT_START.has(t.value.toUpperCase()) && !isCastType(ts))
      break;
    if (t.kind === "punct" && t.text === "(") ts.readParenthesized();
    else ts.next();
    first = false;
  }
  return ts.textSince(start);
}

function readGenerated(ts: TokenStream, column: DraftColumn): void {
  // GENERATED {ALWAYS | BY DEFAULT} AS IDENTITY [( sequence options )]
  // GENERATED ALWAYS AS ( expr ) [STORED | VIRTUAL]
  ts.acceptAny("ALWAYS", ["BY", "DEFAULT"]);
  ts.expectKeywords("AS");
  if (ts.acceptKeywords("IDENTITY")) {
    column.default = AUTOINCREMENT_DEFAULT;
    if (ts.isPunct("(")) ts.readParenthesized();
  } else if (ts.isPunct("(")) {
    ts.readParenthesized();
    ts.acceptAny("STORED", "VIRTUAL");
  }
}

function withName<T extends object>(value: T, name: string | undefined): T & { name?: string } {
  return name ? { name, ...value } : value;
}
