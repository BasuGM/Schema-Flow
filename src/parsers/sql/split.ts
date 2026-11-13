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
 * MySQL `DELIMITER` lines are not supported and are reported.
 */
export function splitStatements(sql: string, dialect: SqlDialect): SplitResult {
  const { tokens, issues } = tokenize(sql, dialect);
  const statements: SqlStatement[] = [];
  let current: Token[] = [];

  const flush = (endOffset: number) => {
    const first = current[0];
    if (first) {
      if (
        dialect === "mysql" &&
        first.kind === "word" &&
        first.value.toUpperCase() === "DELIMITER"
      ) {
        issues.push({
          severity: "warning",
          message:
            "DELIMITER blocks are not supported; the statements they wrap may be split incorrectly.",
          line: first.line,
        });
      } else {
        statements.push({
          tokens: current,
          text: sql.slice(first.offset, endOffset).trim(),
          startLine: first.line,
        });
      }
    }
    current = [];
  };

  for (const t of tokens) {
    if (t.kind === "punct" && t.text === ";") flush(t.offset);
    else current.push(t);
  }
  const last = current.at(-1);
  flush(last ? last.offset + last.text.length : sql.length);
  return { statements, issues };
}
