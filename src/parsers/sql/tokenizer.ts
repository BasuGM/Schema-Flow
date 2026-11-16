import type { ImportIssue, SqlDialect } from "@/domain/schema/types";

export type TokenKind = "word" | "quoted" | "string" | "number" | "punct" | "op" | "dollar";

export interface Token {
  kind: TokenKind;
  /** Source text exactly as written. */
  text: string;
  /** Unquoted identifier / unescaped string content; equals `text` for other kinds. */
  value: string;
  offset: number;
  line: number;
  /** Inside a MySQL executable comment (`/*!` … `*\/`). */
  executable?: true;
}

export interface TokenizeResult {
  tokens: Token[];
  issues: ImportIssue[];
}

const PUNCT = new Set(["(", ")", ",", ";", ".", "[", "]"]);
const OP_CHARS = "+-*/<>=~!@#%^&|`?:";

/**
 * Splits SQL text into tokens. Comments and whitespace are dropped. Never throws: unterminated
 * strings, quoted identifiers, comments or dollar quotes consume the rest of the input and add a
 * warning.
 */
export function tokenize(sql: string, dialect: SqlDialect): TokenizeResult {
  const tokens: Token[] = [];
  const issues: ImportIssue[] = [];
  let i = 0;
  let line = 1;
  const n = sql.length;
  // Inside a MySQL executable comment (`/*!` … `*/`), whose closing marker is skipped.
  let executable = false;

  const advanceTo = (end: number) => {
    for (let k = i; k < end; k++) if (sql.charCodeAt(k) === 10) line++;
    i = end;
  };
  const push = (kind: TokenKind, end: number, value?: string) => {
    const text = sql.slice(i, end);
    const token: Token = { kind, text, value: value ?? text, offset: i, line };
    if (executable) token.executable = true;
    tokens.push(token);
    advanceTo(end);
  };
  const unterminated = (what: string) =>
    issues.push({
      severity: "warning",
      message: `Unterminated ${what}; the rest of the input was ignored.`,
      line,
    });

  while (i < n) {
    const c = sql[i]!;
    const next = sql[i + 1];

    // U+FEFF (byte-order mark / zero-width no-break space) is whitespace anywhere: a leading BOM
    // (QA-007) or one left in the middle by concatenated files (QA-009). Skipping it keeps offsets
    // indexing `sql` and line numbers unchanged.
    if (c === " " || c === "\t" || c === "\r" || c === "\n" || c === "\f" || c === "\uFEFF") {
      advanceTo(i + 1);
      continue;
    }
    // Line comments: `--` everywhere, `#` in MySQL.
    if ((c === "-" && next === "-") || (c === "#" && dialect === "mysql")) {
      const end = sql.indexOf("\n", i);
      advanceTo(end === -1 ? n : end);
      continue;
    }
    // MySQL executable comments `/*! … */` and `/*!50705 … */`: MySQL runs their content (mysqldump
    // wraps SET, triggers and views in them; Sakila declares a column in one), so it is tokenized
    // as code. The markers themselves are skipped.
    if (dialect === "mysql" && c === "/" && next === "*" && sql[i + 2] === "!") {
      let k = i + 3;
      while (k < n && k < i + 9 && sql.charCodeAt(k) >= 48 && sql.charCodeAt(k) <= 57) k++;
      advanceTo(k);
      executable = true;
      continue;
    }
    if (executable && c === "*" && next === "/") {
      advanceTo(i + 2);
      executable = false;
      continue;
    }
    // Block comments (nested in PostgreSQL).
    if (c === "/" && next === "*") {
      let depth = 0;
      let k = i;
      let closed = false;
      while (k < n) {
        if (sql[k] === "/" && sql[k + 1] === "*") {
          depth++;
          k += 2;
          if (dialect !== "postgresql" && depth > 1) depth = 1;
        } else if (sql[k] === "*" && sql[k + 1] === "/") {
          depth--;
          k += 2;
          if (depth === 0) {
            closed = true;
            break;
          }
        } else k++;
      }
      if (!closed) unterminated("comment");
      advanceTo(closed ? k : n);
      continue;
    }
    // Strings: '…' with '' escapes; PostgreSQL E'…' with backslash escapes; MySQL also "…".
    const isEString = (c === "E" || c === "e") && next === "'" && dialect === "postgresql";
    if (c === "'" || isEString || (c === '"' && dialect === "mysql")) {
      const quote = isEString ? "'" : c;
      const start = isEString ? i + 2 : i + 1;
      const backslash = isEString || dialect === "mysql";
      const end = scanQuoted(sql, start, quote, backslash);
      if (end === -1) {
        unterminated("string");
        push("string", n, sql.slice(start));
      } else push("string", end + 1, unescape(sql.slice(start, end), quote, backslash));
      continue;
    }
    // Quoted identifiers: "…" (not MySQL), `…` (MySQL, SQLite), […] (SQLite).
    const identClose =
      c === '"' && dialect !== "mysql"
        ? '"'
        : c === "`" && dialect !== "postgresql"
          ? "`"
          : c === "[" && dialect === "sqlite"
            ? "]"
            : null;
    if (identClose) {
      const end = scanQuoted(sql, i + 1, identClose, false);
      if (end === -1) {
        unterminated("quoted identifier");
        push("quoted", n, sql.slice(i + 1));
      } else
        push(
          "quoted",
          end + 1,
          sql
            .slice(i + 1, end)
            .split(identClose + identClose)
            .join(identClose),
        );
      continue;
    }
    // PostgreSQL dollar quotes: $$…$$ or $tag$…$tag$.
    if (c === "$" && dialect === "postgresql") {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 64));
      if (m) {
        const tag = m[0];
        const end = sql.indexOf(tag, i + tag.length);
        if (end === -1) {
          unterminated("dollar-quoted string");
          push("dollar", n, sql.slice(i + tag.length));
        } else push("dollar", end + tag.length, sql.slice(i + tag.length, end));
        continue;
      }
    }
    if (isDigit(c) || (c === "." && next !== undefined && isDigit(next))) {
      let k = i + 1;
      while (k < n && /[0-9.eE]/.test(sql[k]!)) {
        if ((sql[k] === "e" || sql[k] === "E") && (sql[k + 1] === "+" || sql[k + 1] === "-")) k++;
        k++;
      }
      push("number", k);
      continue;
    }
    if (isWordStart(c)) {
      let k = i + 1;
      while (k < n && isWordPart(sql[k]!)) k++;
      push("word", k);
      continue;
    }
    if (PUNCT.has(c)) {
      push("punct", i + 1);
      continue;
    }
    if (OP_CHARS.includes(c)) {
      let k = i + 1;
      // Keep `::` together (PostgreSQL casts); other operators are single characters.
      if (c === ":" && next === ":") k++;
      push("op", k);
      continue;
    }
    // Any other character (e.g. stray unicode punctuation) becomes a one-char operator token.
    push("op", i + 1);
  }
  return { tokens, issues };
}

/** Index of the closing quote, honouring doubled quotes and (optionally) backslash escapes. */
function scanQuoted(sql: string, start: number, quote: string, backslash: boolean): number {
  let k = start;
  while (k < sql.length) {
    const ch = sql[k];
    if (backslash && ch === "\\") {
      k += 2;
      continue;
    }
    if (ch === quote) {
      if (sql[k + 1] === quote) {
        k += 2;
        continue;
      }
      return k;
    }
    k++;
  }
  return -1;
}

function unescape(body: string, quote: string, backslash: boolean): string {
  const doubled = body.split(quote + quote).join(quote);
  return backslash ? doubled.replace(/\\(.)/g, "$1") : doubled;
}

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

// Non-ASCII letters are identifier characters, except U+FEFF, which is whitespace (QA-009).
function isWordStart(c: string): boolean {
  return c !== "﻿" && /[A-Za-z_\u0080-￿]/.test(c);
}

function isWordPart(c: string): boolean {
  return c !== "﻿" && /[A-Za-z0-9_$\u0080-￿]/.test(c);
}
