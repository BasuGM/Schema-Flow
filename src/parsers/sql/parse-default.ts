import type { ColumnDefault } from "@/domain/schema/types";

const EXPRESSION_KEYWORDS =
  /^(current_timestamp|current_date|current_time|localtimestamp|localtime|current_user|session_user|user)\b/i;

const TYPE_WORD = String.raw`[\w."[\]]+`;
const CAST_SUFFIX = new RegExp(
  String.raw`::\s*${TYPE_WORD}(?:\s+${TYPE_WORD})*(?:\(\s*\d+(?:\s*,\s*\d+)?\s*\))?(?:\[\])*$`,
  "u",
);

/** Removes redundant outer parentheses and trailing `::type` casts: `('a'::text)` → `'a'`. */
function stripCastsAndParens(text: string): string {
  let t = text.trim();
  for (;;) {
    const before = t;
    if (t.startsWith("(") && t.endsWith(")") && balanced(t.slice(1, -1))) t = t.slice(1, -1).trim();
    // `t` is trimmed, so no trailing `\s*`; words of a multi-word type are separated by `\s+` so no
    // two repeating groups can both match a space (that backtracked polynomially, QA-013 audit).
    t = t.replace(CAST_SUFFIX, "").trim();
    if (t === before) return t;
  }
}

function balanced(s: string): boolean {
  let depth = 0;
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")" && --depth < 0) return false;
  }
  return depth === 0;
}

/**
 * Classifies a column default.
 * - `nextval('seq'::regclass)` → autoincrement (PostgreSQL sequences, e.g. pg_dump output)
 * - strings, numbers, TRUE/FALSE/NULL (casts stripped) → literal
 * - CURRENT_TIMESTAMP and friends → expression
 * - `name(...)` → function
 * - anything else → expression
 */
export function classifyDefault(raw: string): ColumnDefault {
  const value = stripCastsAndParens(raw);
  if (/^nextval\s*\(/i.test(value)) return { kind: "autoincrement", value };
  if (
    /^[eEnN]?'(?:[^']|'')*'$/u.test(value) ||
    /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(value) ||
    /^(true|false|null)$/i.test(value)
  ) {
    return { kind: "literal", value };
  }
  if (EXPRESSION_KEYWORDS.test(value)) return { kind: "expression", value };
  if (/^[\w."]+\s*\(.*\)$/su.test(value)) return { kind: "function", value };
  return { kind: "expression", value };
}

export const AUTOINCREMENT_DEFAULT: ColumnDefault = { kind: "autoincrement", value: "identity" };

/** PostgreSQL serial pseudo-types imply an autoincrement default. */
export function isSerialType(base: string): boolean {
  return /^(small|big)?serial[248]?$/i.test(base);
}
