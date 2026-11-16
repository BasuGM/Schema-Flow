import type { ImportIssue } from "@/domain/schema/types";

/** `nl` tokens matter: Prisma declares one field per line. `doc` is a `///` comment. */
export type PrismaTokenKind = "ident" | "string" | "number" | "punct" | "nl" | "doc";

export interface PrismaToken {
  kind: PrismaTokenKind;
  /** Source text exactly as written. */
  text: string;
  /** Unescaped string content / trimmed doc text; equals `text` for other kinds. */
  value: string;
  line: number;
}

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/y;
const NUMBER = /-?\d+(\.\d+)?([eE][+-]?\d+)?/y;

/**
 * Splits a Prisma schema into tokens. `//` comments and whitespace (including U+FEFF) are dropped.
 * Never throws: strings cannot span lines, so an unterminated one ends at the line break with a
 * warning, and any unexpected character becomes a one-character `punct` token for the parser to
 * report.
 */
export function lexPrisma(src: string): { tokens: PrismaToken[]; issues: ImportIssue[] } {
  const tokens: PrismaToken[] = [];
  const issues: ImportIssue[] = [];
  const n = src.length;
  let i = 0;
  let line = 1;
  const push = (kind: PrismaTokenKind, text: string, value = text) =>
    tokens.push({ kind, text, value, line });
  const match = (re: RegExp) => {
    re.lastIndex = i;
    return re.exec(src)?.[0];
  };

  while (i < n) {
    const c = src[i]!;
    if (c === "\n") {
      // Consecutive line breaks are one separator; collapsing them keeps a file of blank lines
      // from becoming millions of tokens (QA-013). Tokens still carry their own line numbers.
      if (tokens.at(-1)?.kind !== "nl") push("nl", c);
      line++;
      i++;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r" || c === "\f" || c === "﻿") {
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      const end = nl === -1 ? n : nl;
      if (src[i + 2] === "/") push("doc", src.slice(i, end), src.slice(i + 3, end).trim());
      i = end;
      continue;
    }
    if (c === '"') {
      let k = i + 1;
      let value = "";
      let closed = false;
      while (k < n && src[k] !== "\n") {
        const ch = src[k]!;
        if (ch === "\\" && k + 1 < n && src[k + 1] !== "\n") {
          const esc = src[k + 1]!;
          value += esc === "n" ? "\n" : esc === "t" ? "\t" : esc;
          k += 2;
          continue;
        }
        if (ch === '"') {
          closed = true;
          break;
        }
        value += ch;
        k++;
      }
      if (!closed) {
        issues.push({ severity: "warning", message: "Unterminated string.", line });
      }
      const end = closed ? k + 1 : k;
      push("string", src.slice(i, end), value);
      i = end;
      continue;
    }
    if (c === "@") {
      const text = src[i + 1] === "@" ? "@@" : "@";
      push("punct", text);
      i += text.length;
      continue;
    }
    const number = /[\d-]/.test(c) ? match(NUMBER) : undefined;
    if (number) {
      push("number", number);
      i += number.length;
      continue;
    }
    const ident = match(IDENT);
    if (ident) {
      push("ident", ident);
      i += ident.length;
      continue;
    }
    // Punctuation `{}()[],:=?.`, or any other character as a token the parser will reject.
    push("punct", c);
    i++;
  }
  return { tokens, issues };
}
