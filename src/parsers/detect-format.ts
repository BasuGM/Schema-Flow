import type { SqlDialect } from "@/domain/schema/types";

export interface DetectedFormat {
  format: "sql" | "prisma" | "unknown";
  /** Best guess for SQL; undefined for other formats. */
  dialect?: SqlDialect;
}

const PRISMA = /^\s*(model|enum|datasource|generator)\s+\w+\s*\{/m;
const SQL = /\b(create|alter)\s+(table|index|unique|type|sequence)\b/i;

/** Cheap heuristics on raw text; no parsing. */
export function detectFormat(text: string): DetectedFormat {
  const sample = text.length > 200_000 ? text.slice(0, 200_000) : text;
  const looksPrisma = PRISMA.test(sample) || /@@(id|unique|index|map)\b/.test(sample);
  const looksSql = SQL.test(sample);
  if (looksPrisma && !looksSql) return { format: "prisma" };
  if (!looksSql && !/;\s*$/m.test(sample)) return { format: "unknown" };
  return { format: "sql", dialect: detectSqlDialect(sample) };
}

export function detectSqlDialect(text: string): SqlDialect {
  if (/`\w+`|\bENGINE\s*=|\bAUTO_INCREMENT\b|\bUNSIGNED\b/i.test(text)) return "mysql";
  if (/\bAUTOINCREMENT\b|\bPRAGMA\b|\bWITHOUT\s+ROWID\b/i.test(text)) return "sqlite";
  return "postgresql";
}
