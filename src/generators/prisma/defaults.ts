import type { Column, EnumType } from "@/domain/schema/types";
import { prismaString } from "../text/escape";
import { prismaEnumValueName } from "./naming";

const NOW = /^(now|current_timestamp|statement_timestamp|transaction_timestamp)(\(\s*\))?$/i;
const UUID = /^(gen_random_uuid|uuid_generate_v4|uuid)\(\s*\)$/i;

/** Text between the quotes of a SQL string literal (`''` → `'`), or null when it is not one. */
function unquoteSql(value: string): string | null {
  const m = /^'((?:[^']|'')*)'$/s.exec(value);
  return m ? m[1]!.replace(/''/g, "'") : null;
}

/**
 * The value inside `@default(…)`, or null for no default. Autoincrement, `now()`, `uuid()` and
 * `cuid()` become Prisma's; literals become Prisma literals (an enum column's literal becomes the
 * enum value's name); everything else is kept as `dbgenerated("…")`.
 */
export function prismaDefault(col: Column, enumDef: EnumType | undefined): string | null {
  const def = col.default;
  if (!def) return null;
  const value = def.value.trim();
  if (def.kind === "autoincrement") return "autoincrement()";
  if (def.kind === "literal") {
    if (/^null$/i.test(value)) return null;
    const sql = unquoteSql(value);
    if (enumDef) {
      // SQL writes `'value'`; a Prisma source stores the bare value.
      const stored = sql ?? value;
      return enumDef.values.includes(stored) ? prismaEnumValueName(stored, enumDef.values) : null;
    }
    if (sql !== null) return prismaString(sql);
    if (/^"(?:[^"\\]|\\.)*"$/s.test(value)) return value; // already a Prisma string literal
    if (/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(value)) return value;
    if (/^(true|false)$/i.test(value)) return value.toLowerCase();
    return `dbgenerated(${prismaString(value)})`;
  }
  if (NOW.test(value)) return "now()";
  if (UUID.test(value)) return "uuid()";
  if (/^cuid\(\s*\)$/i.test(value)) return "cuid()";
  return `dbgenerated(${prismaString(value)})`;
}
