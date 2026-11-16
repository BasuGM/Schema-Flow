import type { ImportIssue, SqlDialect } from "@/domain/schema/types";
import { tokenize, type Token } from "./tokenizer";

export interface SqlStatement {
  tokens: Token[];
  /** Source text of the statement (without the terminating `;`). */
  text: string;
  /** 1-based line of the first token. */
  startLine: number;
}

export interface SplitResult {
  statements: SqlStatement[];
  issues: ImportIssue[];
}

/**
 * Splits SQL into statements on top-level `;` tokens. Because splitting works on tokens, semicolons
 * inside strings, comments, quoted identifiers and dollar-quoted bodies never split a statement.
 * MySQL `DELIMITER x` lines (mysql client syntax, e.g. around procedures and triggers) switch the
 * terminator to `x` until the next `DELIMITER` line; the `DELIMITER` lines themselves are dropped.
 */
export function splitStatements(sql: string, dialect: SqlDialect): SplitResult {
  const { tokens, issues } = tokenize(sql, dialect);
  const statements: SqlStatement[] = [];
  let current: Token[] = [];
  let delimiter = ";";
  /** Tokens before this offset belong to a `DELIMITER` line or a multi-token terminator. */
  let skipUntil = 0;

  const flush = (endOffset: number) => {
    const first = current[0];
    if (first) {
      statements.push({
        tokens: current,
        text: sql.slice(first.offset, endOffset).trim(),
        startLine: first.line,
      });
    }
    current = [];
  };

  for (const t of tokens) {
    if (t.offset < skipUntil) continue;
    if (
      dialect === "mysql" &&
      current.length === 0 &&
      t.kind === "word" &&
      t.value.toUpperCase() === "DELIMITER"
    ) {
      const lineEnd = sql.indexOf("\n", t.offset);
      const end = lineEnd === -1 ? sql.length : lineEnd;
      const next = sql
        .slice(t.offset + t.text.length, end)
        .trim()
        .split(/\s+/)[0];
      if (next) delimiter = next;
      skipUntil = end;
      continue;
    }
    if (
      delimiter === ";" ? t.kind === "punct" && t.text === ";" : sql.startsWith(delimiter, t.offset)
    ) {
      flush(t.offset);
      skipUntil = t.offset + delimiter.length;
    } else current.push(t);
  }
  const last = current.at(-1);
  flush(last ? last.offset + last.text.length : sql.length);
  return { statements, issues };
}
