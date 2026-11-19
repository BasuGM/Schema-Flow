import type { ColumnDefault, SqlDialect } from "@/domain/schema/types";

export interface RenderedDefault {
  sql: string;
  /** The value was passed through (or rebuilt) and may need editing in the target. */
  copied: boolean;
}

const CURRENT =
  /^(current_timestamp|current_date|current_time|localtimestamp|localtime)(\(\s*\d*\s*\))?$/i;
const NOW = /^(now|current_timestamp|statement_timestamp|transaction_timestamp)\(\s*\)$/i;
const UUID_FN = /^(gen_random_uuid|uuid_generate_v4|uuid|newid)\(\s*\)$/i;

/**
 * The `DEFAULT` clause value for a non-autoincrement default, or null when it cannot be expressed
 * (Prisma `cuid()` has no SQL equivalent). `faithful` = same dialect as the source.
 * PostgreSQL takes bare literals and function calls; MySQL (8.0.13+) and SQLite need other
 * expressions in parentheses, and `now()` becomes `CURRENT_TIMESTAMP` there.
 */
export function renderDefault(
  def: ColumnDefault,
  to: SqlDialect,
  faithful: boolean,
): RenderedDefault | null {
  const value = def.value.trim();
  if (def.kind === "literal") return { sql: value, copied: false };
  if (CURRENT.test(value)) return { sql: value.toUpperCase(), copied: false };
  if (NOW.test(value)) {
    return { sql: to === "postgresql" ? "now()" : "CURRENT_TIMESTAMP", copied: false };
  }
  if (UUID_FN.test(value)) {
    if (to === "postgresql") return { sql: "gen_random_uuid()", copied: false };
    if (to === "mysql") return { sql: "(uuid())", copied: false };
    return { sql: "(lower(hex(randomblob(16))))", copied: true };
  }
  if (/^cuid\(\s*\)$/i.test(value)) return null;
  if (def.kind === "function" && to === "postgresql") return { sql: value, copied: !faithful };
  return { sql: `(${value})`, copied: !faithful };
}
