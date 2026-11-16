/**
 * Prepared names and per-term matching for search (P2-T07, ADR-016). Pure; no React.
 *
 * A name is compared in two forms at the same tier: lower-cased, and "compact" (lower-cased with
 * spaces, `_` and `-` removed), so the camelCase query `createdAt` finds `created_at`. Matched
 * spans are always reported as character ranges of the original name, for highlighting.
 */

/** `[start, end)` character range in the original name. */
export type Range = readonly [start: number, end: number];

export const Tier = { exact: 0, prefix: 1, segment: 2, substring: 3, fuzzy: 4 } as const;
export type Tier = (typeof Tier)[keyof typeof Tier];

/** Fuzzy matching is only tried for terms with at least this many (compact) characters. */
export const FUZZY_MIN_LENGTH = 3;

export interface Field {
  raw: string;
  /** Same length as `raw`, so indices line up. */
  lower: string;
  /** Indices where a segment starts (after a separator, or at a camelCase hump). */
  starts: number[];
  compact: string;
  /** compact index → raw index. */
  map: Int32Array;
  /** 1 where the compact character starts a segment. */
  compactStarts: Uint8Array;
}

export interface Term {
  lower: string;
  compact: string;
}

export interface TermMatch {
  tier: Tier;
  ranges: Range[];
}

const isSeparator = (ch: string) => ch === " " || ch === "_" || ch === "-";
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const isWordChar = (ch: string) => {
  const c = ch.charCodeAt(0);
  if (c < 128) return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
  return LETTER_OR_DIGIT.test(ch);
};
const isUpper = (ch: string) => ch !== ch.toLowerCase() && ch === ch.toUpperCase();

/** Lower-cases per character, keeping a character whose lower case would change the length. */
export function lowerSameLength(text: string): string {
  // ASCII fast path: lower-casing never changes the length.
  if (/^[\x00-\x7f]*$/.test(text)) return text.toLowerCase();
  let out = "";
  for (const ch of text.split("")) {
    const lower = ch.toLowerCase();
    out += lower.length === 1 ? lower : ch;
  }
  return out;
}

export function prepareField(raw: string): Field {
  const lower = lowerSameLength(raw);
  const starts: number[] = [];
  const startSet = new Set<number>();
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (!isWordChar(ch)) continue;
    const prev = i > 0 ? raw[i - 1]! : "";
    const hump = prev !== "" && isUpper(ch) && !isUpper(prev) && isWordChar(prev);
    if (i === 0 || !isWordChar(prev) || hump) {
      starts.push(i);
      startSet.add(i);
    }
  }
  let compact = "";
  const map: number[] = [];
  for (let i = 0; i < lower.length; i++) {
    if (isSeparator(lower[i]!)) continue;
    compact += lower[i]!;
    map.push(i);
  }
  const compactStarts = new Uint8Array(map.length);
  map.forEach((rawIndex, k) => {
    if (startSet.has(rawIndex)) compactStarts[k] = 1;
  });
  return { raw, lower, starts, compact, map: Int32Array.from(map), compactStarts };
}

export function prepareTerm(text: string): Term {
  const lower = lowerSameLength(text);
  let compact = "";
  for (const ch of lower) if (!isSeparator(ch)) compact += ch;
  return { lower, compact };
}

/** Maps a compact range back to (possibly several) original ranges, skipping separators. */
function fromCompact(field: Field, start: number, end: number): Range[] {
  const ranges: [number, number][] = [];
  for (let k = start; k < end; k++) {
    const i = field.map[k]!;
    const last = ranges[ranges.length - 1];
    if (last && last[1] === i) last[1] = i + 1;
    else ranges.push([i, i + 1]);
  }
  return ranges;
}

/**
 * Best match of one term in one name, or null. Tiers, best first: exact, prefix, segment prefix,
 * substring, fuzzy. Fuzzy (terms of 3+ characters) is a subsequence whose every run of matched
 * characters begins at a segment start: `ordit` → **ord**er_**it**ems, `uid` → **u**ser_**id**,
 * but `uid` does not match `unit_price_cents` (no segment starts with `i`).
 */
export function matchTerm(field: Field, term: Term): TermMatch | null {
  const { lower: t, compact: tc } = term;
  if (t === "") return { tier: Tier.exact, ranges: [] };
  const { lower, compact } = field;
  const plain = (tier: Tier, at: number): TermMatch => ({ tier, ranges: [[at, at + t.length]] });
  const packed = (tier: Tier, at: number): TermMatch => ({
    tier,
    ranges: fromCompact(field, at, at + tc.length),
  });

  // One substring search per form decides between "some tier up to substring" and "fuzzy or
  // nothing". The compact form only adds something when the name or the term has separators.
  const at = lower.indexOf(t);
  const separators = compact.length !== lower.length || tc.length !== t.length;
  const atCompact = separators && tc ? compact.indexOf(tc) : -1;
  if (at < 0 && atCompact < 0) {
    if (tc.length < FUZZY_MIN_LENGTH || !isSubsequence(compact, tc)) return null;
    const runs = fuzzyRuns(field, tc);
    if (!runs) return null;
    return { tier: Tier.fuzzy, ranges: runs.flatMap(([s, e]) => fromCompact(field, s, e)) };
  }
  if (lower === t) return plain(Tier.exact, 0);
  if (atCompact === 0 && compact.length === tc.length) return packed(Tier.exact, 0);
  if (at === 0) return plain(Tier.prefix, 0);
  if (atCompact === 0) return packed(Tier.prefix, 0);
  if (at > 0) {
    for (const s of field.starts)
      if (s >= at && lower.startsWith(t, s)) return plain(Tier.segment, s);
  }
  if (atCompact > 0) {
    for (let k = atCompact; k < compact.length; k++) {
      if (field.compactStarts[k] && compact.startsWith(tc, k)) return packed(Tier.segment, k);
    }
  }
  return at >= 0 ? plain(Tier.substring, at) : packed(Tier.substring, atCompact);
}

function isSubsequence(text: string, q: string): boolean {
  let at = 0;
  for (const ch of q) {
    at = text.indexOf(ch, at) + 1;
    if (at === 0) return false;
  }
  return true;
}

/** Segment-anchored subsequence on the compact form; returns compact runs or null. */
function fuzzyRuns(field: Field, q: string): [number, number][] | null {
  const { compact, compactStarts } = field;
  const width = compact.length + 1;
  const failed = new Set<number>();
  const runs: [number, number][] = [];
  const go = (qi: number, ci: number): boolean => {
    if (qi === q.length) return true;
    const key = qi * width + ci;
    if (failed.has(key)) return false;
    for (let s = ci; s < compact.length; s++) {
      if (!compactStarts[s] || compact[s] !== q[qi]) continue;
      let len = 1;
      while (qi + len < q.length && s + len < compact.length && compact[s + len] === q[qi + len]) {
        len++;
      }
      for (let l = len; l >= 1; l--) {
        runs.push([s, s + l]);
        if (go(qi + l, s + l)) return true;
        runs.pop();
      }
    }
    failed.add(key);
    return false;
  };
  return go(0, 0) ? runs : null;
}
