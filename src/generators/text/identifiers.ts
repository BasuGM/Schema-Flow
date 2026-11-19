import type { SqlDialect } from "@/domain/schema/types";

/** Words that must be quoted as identifiers in at least one of PostgreSQL / MySQL / SQLite. */
const RESERVED = new Set(
  (
    "add all alter analyse analyze and any array as asc asymmetric authorization between binary both " +
    "by case cast check collate column constraint create cross current_date current_time " +
    "current_timestamp current_user default delete desc distinct do drop else end except exists false " +
    "fetch for foreign from full grant group having if in index inner insert intersect interval into is " +
    "join key keys leading left like limit natural not null offset on only or order outer primary " +
    "references replace right row select set show some table then to trailing true union unique unsigned " +
    "update user using values when where with rename range rank rows read write text integer int " +
    "timestamp date time float double"
  ).split(" "),
);

const PLAIN = /^[a-z_][a-z0-9_]*$/;

/**
 * An identifier for `dialect`: bare when it is plain lower-case and not a reserved word, otherwise
 * quoted (backticks for MySQL, double quotes for PostgreSQL / SQLite) with the quote character
 * doubled. NUL is dropped.
 */
export function quoteIdent(name: string, dialect: SqlDialect): string {
  const n = name.replace(/\u0000/g, "");
  if (PLAIN.test(n) && !RESERVED.has(n)) return n;
  return dialect === "mysql" ? `\`${n.replace(/`/g, "``")}\`` : `"${n.replace(/"/g, '""')}"`;
}

/** Longest identifier each dialect accepts (SQLite has no limit). */
export const MAX_IDENTIFIER_LENGTH: Record<SqlDialect, number> = {
  postgresql: 63,
  mysql: 64,
  sqlite: Infinity,
};

/** `Order_items` / `order-items` → `OrderItems`; never empty and never starts with a digit. */
export function pascalCase(name: string): string {
  const parts = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  if (joined === "") return "Model";
  return /^[0-9]/.test(joined) ? `M${joined}` : joined;
}

export function isPrismaIdent(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(name);
}
