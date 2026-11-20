import type { ColumnId, Schema, SqlDialect, TableId } from "@/domain/schema/types";
import { MAX_IDENTIFIER_LENGTH, quoteIdent } from "../text/identifiers";
import type { Warnings } from "../text/types";
import type { NameRegistry } from "./names";

/** Counts repeated approximations so a 10,000-column schema yields one line per kind, not 10,000. */
export function createTally() {
  const counts = new Map<string, number>();
  return {
    add(message: string) {
      counts.set(message, (counts.get(message) ?? 0) + 1);
    },
    flush(warnings: Warnings) {
      for (const [message, n] of counts) warnings.add(n > 1 ? `${message} (×${n})` : message);
    },
  };
}
export type Tally = ReturnType<typeof createTally>;

/** PostgreSQL-only CHECKs and defaults left out of a MySQL / SQLite export (QA-031, ADR-033). */
export function createLeftOut() {
  const checks: string[] = [];
  const defaults: string[] = [];
  const line = (n: number, noun: string, example: string) =>
    `${n} ${noun}${n === 1 ? " uses" : "s use"} PostgreSQL-only syntax and ${n === 1 ? "was" : "were"} left out (e.g. ${example}).`;
  return {
    checks,
    defaults,
    flush(warnings: Warnings) {
      if (checks.length) warnings.add(line(checks.length, "CHECK constraint", checks[0]!));
      if (defaults.length) warnings.add(line(defaults.length, "column default", defaults[0]!));
    },
  };
}
export type LeftOut = ReturnType<typeof createLeftOut>;

/** Everything the SQL renderers share for one export. */
export interface SqlContext {
  schema: Schema;
  /** Target dialect. */
  to: SqlDialect;
  /** Dialect the schema was written in (PostgreSQL for samples). */
  from: SqlDialect;
  isPrisma: boolean;
  /** Same dialect and not Prisma: types and defaults are copied as written. */
  faithful: boolean;
  warnings: Warnings;
  tally: Tally;
  leftOut: LeftOut;
  names: NameRegistry;
  /** Tables whose CHECKs or defaults were copied as written across dialects. */
  copied: Set<TableId>;
  /** Columns in a PK, unique constraint, index or foreign key (MySQL cannot key TEXT / BLOB). */
  keyColumns: ReadonlySet<ColumnId>;
  columnName: ReadonlyMap<ColumnId, string>;
  /** A quoted identifier; warns when the target's length limit is exceeded. */
  ident: (name: string) => string;
}

export function createIdent(to: SqlDialect, warnings: Warnings) {
  return (name: string): string => {
    const max = MAX_IDENTIFIER_LENGTH[to];
    if (name.length > max) {
      const dialect = to === "postgresql" ? "PostgreSQL" : "MySQL";
      warnings.add(`Identifier "${name}" is ${name.length} characters; ${dialect} allows ${max}.`);
    }
    return quoteIdent(name, to);
  };
}
