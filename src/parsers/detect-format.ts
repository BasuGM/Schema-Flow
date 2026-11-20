import type { SqlDialect } from "@/domain/schema/types";

export interface DetectedFormat {
  format: "sql" | "prisma" | "unknown";
  /** Best guess for SQL; undefined for other formats. */
  dialect?: SqlDialect;
}

// Whitespace classes never span lines under /m: `^\s*` matched newlines and backtracked
// quadratically on long runs of blank lines (QA-013).
const PRISMA = /^[ \t]*(model|enum|datasource|generator)[ \t]+\w+[ \t]*\{/m;
const SQL = /\b(create|alter)\s+(table|index|unique|type|sequence)\b/i;

/**
 * Cheap heuristics on raw text; no parsing. The whole text is checked (about 1 ms per MB; imports
 * are capped at 5 MB): sampling only the start missed DDL that follows a long header (QA-011).
 */
export function detectFormat(text: string): DetectedFormat {
  const looksPrisma = PRISMA.test(text) || /@@(id|unique|index|map)\b/.test(text);
  const looksSql = SQL.test(text);
  if (looksPrisma && !looksSql) return { format: "prisma" };
  if (!looksSql && !/;[ \t\r]*$/m.test(text)) return { format: "unknown" };
  return { format: "sql", dialect: detectSqlDialect(text) };
}

/**
 * A backtick-quoted table name holding any character (`we'ird`, `back\slash`) right after a table
 * keyword. Anywhere else a backtick is only evidence when the name is a plain word, because
 * PostgreSQL dumps carry stray backticks in comments and strings (GitLab) (QA-033).
 */
const BACKTICK_TABLE =
  /\b(?:CREATE\s+(?:TEMPORARY\s+)?TABLE(?:\s+IF\s+NOT\s+EXISTS)?|ALTER\s+TABLE|REFERENCES|DROP\s+TABLE(?:\s+IF\s+EXISTS)?)\s+`[^`\r\n]+`/i;

export function detectSqlDialect(text: string): SqlDialect {
  if (BACKTICK_TABLE.test(text)) return "mysql";
  if (/`\w+`|\bENGINE\s*=|\bAUTO_INCREMENT\b|\bUNSIGNED\b/i.test(text)) return "mysql";
  if (/\bAUTOINCREMENT\b|\bPRAGMA\b|\bWITHOUT\s+ROWID\b/i.test(text)) return "sqlite";
  return "postgresql";
}
