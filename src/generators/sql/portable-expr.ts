import type { SqlDialect } from "@/domain/schema/types";
import { sqlString } from "../text/escape";

export type PortableExpression = { ok: true; sql: string } | { ok: false };

/** Functions that mean the same in PostgreSQL, MySQL and SQLite (after the renames below). */
const SAFE_FUNCTIONS = new Set([
  "length",
  "char_length",
  "character_length",
  "lower",
  "upper",
  "abs",
  "coalesce",
  "nullif",
  "substr",
  "substring",
  "trim",
  "ltrim",
  "rtrim",
  "replace",
  "round",
]);
/** Keywords that may be followed by `(`: not function calls. */
const KEYWORDS_BEFORE_PAREN = new Set([
  "and",
  "or",
  "not",
  "in",
  "is",
  "between",
  "like",
  "case",
  "when",
  "then",
  "else",
  "end",
]);
/** Words with no equivalent (or a different meaning) in the other dialects. */
const UNPORTABLE_WORDS = new Set([
  "any",
  "all",
  "some",
  "array",
  "ilike",
  "distinct",
  "similar",
  "collate",
  "interval",
  "at",
  "row",
  // `TRIM(BOTH FROM x)`, `SUBSTRING(x FROM 1 FOR 3)`, subqueries and window clauses.
  "both",
  "leading",
  "trailing",
  "from",
  "for",
  "select",
  "over",
  "filter",
]);

/** `::` followed by a type name: schema-qualified or quoted, multi-word, `(n[, m])`, `[]`. */
const CAST =
  /::\s*(?:"[^"]+"|(?:(?:double\s+precision|(?:national\s+)?(?:character|char|bit)(?:\s+varying)?|(?:timestamp|time)(?:\s*\(\s*\d+\s*\))?(?:\s+with(?:out)?\s+time\s+zone)?|[A-Za-z_][A-Za-z0-9_]*)(?:\s*\.\s*[A-Za-z_][A-Za-z0-9_]*)?))(?:\s*\(\s*\d+\s*(?:,\s*\d+\s*)?\))?(?:\s*\[\s*\d*\s*\])*/gi;

type Piece = { kind: "code"; text: string } | { kind: "out"; text: string };

/**
 * Splits `expr` into code and protected pieces (`'…'` strings with `''`, `"…"` identifiers,
 * `$tag$…$tag$` bodies) and re-renders the protected ones for `to`. Null when anything is
 * uncertain: an unterminated literal, an `E'…'` string, a comment, a parameter.
 */
function scan(expr: string, to: SqlDialect): Piece[] | null {
  const pieces: Piece[] = [];
  let code = "";
  const flush = () => {
    if (code) pieces.push({ kind: "code", text: code });
    code = "";
  };
  let i = 0;
  while (i < expr.length) {
    const c = expr[i]!;
    const prev = i > 0 ? expr[i - 1]! : "";
    if (c === "'") {
      if (/^[eE]$/.test(prev) && !/[A-Za-z0-9_]/.test(expr[i - 2] ?? "")) return null;
      let j = i + 1;
      let value = "";
      for (;;) {
        if (j >= expr.length) return null;
        if (expr[j] === "'") {
          if (expr[j + 1] === "'") {
            value += "'";
            j += 2;
            continue;
          }
          break;
        }
        value += expr[j];
        j++;
      }
      flush();
      pieces.push({ kind: "out", text: sqlString(value, to) });
      i = j + 1;
    } else if (c === '"') {
      let j = i + 1;
      let name = "";
      for (;;) {
        if (j >= expr.length) return null;
        if (expr[j] === '"') {
          if (expr[j + 1] === '"') {
            name += '"';
            j += 2;
            continue;
          }
          break;
        }
        name += expr[j];
        j++;
      }
      flush();
      const quoted =
        to === "mysql" ? `\`${name.replace(/`/g, "``")}\`` : `"${name.replace(/"/g, '""')}"`;
      pieces.push({ kind: "out", text: quoted });
      i = j + 1;
    } else if (c === "$") {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(expr.slice(i, i + 64));
      if (!m) return null;
      const end = expr.indexOf(m[0], i + m[0].length);
      if (end === -1) return null;
      flush();
      pieces.push({ kind: "out", text: sqlString(expr.slice(i + m[0].length, end), to) });
      i = end + m[0].length;
    } else if (c === "-" && expr[i + 1] === "-") {
      return null;
    } else if (c === "/" && expr[i + 1] === "*") {
      return null;
    } else {
      code += c;
      i++;
    }
  }
  flush();
  return pieces;
}

/** Checks one code piece; returns the rewritten text or null. */
function rewriteCode(text: string, to: SqlDialect): string | null {
  const noCasts = text.replace(CAST, "");
  // Only operators and punctuation every target understands. `||` concatenates in PostgreSQL and
  // SQLite but is logical OR in MySQL, so MySQL leaves such expressions out.
  if (!/^[\w\s=<>!+\-*/%(),.]*$/.test(noCasts.replace(/\|\|/g, to === "sqlite" ? "" : "|")))
    return null;
  if (/!(?!=)/.test(noCasts)) return null;
  for (const m of noCasts.matchAll(/(?<![\w.])([A-Za-z_]\w*)\b/g)) {
    if (UNPORTABLE_WORDS.has(m[1]!.toLowerCase())) return null;
  }
  let sql = noCasts;
  for (const m of noCasts.matchAll(/(?<![\w.])([A-Za-z_]\w*)\s*\(/g)) {
    const name = m[1]!.toLowerCase();
    if (KEYWORDS_BEFORE_PAREN.has(name)) continue;
    if (!SAFE_FUNCTIONS.has(name)) return null;
  }
  if (to === "sqlite") {
    sql = sql.replace(/(?<![\w.])(?:char_length|character_length)(\s*\()/gi, "length$1");
  } else if (to === "mysql") {
    sql = sql.replace(/(?<![\w.])length(\s*\()/gi, "char_length$1");
    sql = sql.replace(/(?<![\w.])character_length(\s*\()/gi, "char_length$1");
  }
  return sql;
}

/**
 * A PostgreSQL CHECK or default expression rewritten for MySQL or SQLite, or `{ ok: false }` when
 * it cannot be done with confidence (PG-only functions, operators, arrays, `E'…'` strings). A
 * partly rewritten expression is never returned. Pure; callers use it only for PostgreSQL sources
 * going to another dialect.
 */
export function portableExpression(expr: string, to: SqlDialect): PortableExpression {
  const pieces = scan(expr, to);
  if (!pieces) return { ok: false };
  let sql = "";
  for (const piece of pieces) {
    if (piece.kind === "out") sql += piece.text;
    else {
      const rewritten = rewriteCode(piece.text, to);
      if (rewritten === null) return { ok: false };
      sql += rewritten;
    }
  }
  return { ok: true, sql: sql.trim() };
}
