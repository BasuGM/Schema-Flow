/** Longest excerpt line shown; minified dumps can put megabytes on one line. */
export const MAX_EXCERPT_LINE = 400;

/** Start offset of every line (1-based line N starts at `index[N - 1]`). One linear scan. */
export function createLineIndex(text: string): Int32Array {
  let count = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) count++;
  const starts = new Int32Array(count);
  let k = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts[k++] = i + 1;
  return starts;
}

export interface ExcerptLine {
  number: number;
  /** At most `MAX_EXCERPT_LINE` characters, without the line break. */
  text: string;
  /** Characters cut from the end of the line (0 when it fits). */
  truncated: number;
  current: boolean;
}

/**
 * Lines `line - context … line + context` of `text`. Only the shown characters are sliced, so a
 * 5 MB single-line source costs no more than a short one. Empty for a line outside the text.
 */
export function excerpt(text: string, index: Int32Array, line: number, context = 2): ExcerptLine[] {
  if (!Number.isInteger(line) || line < 1 || line > index.length) return [];
  const out: ExcerptLine[] = [];
  const last = Math.min(index.length, line + context);
  for (let n = Math.max(1, line - context); n <= last; n++) {
    let start = index[n - 1]!;
    let end = n < index.length ? index[n]! - 1 : text.length;
    if (end > start && text.charCodeAt(end - 1) === 13) end--;
    if (n === 1 && text.charCodeAt(0) === 0xfeff) start++;
    const length = Math.max(0, end - start);
    const shown = Math.min(length, MAX_EXCERPT_LINE);
    out.push({
      number: n,
      text: text.slice(start, start + shown),
      truncated: length - shown,
      current: n === line,
    });
  }
  return out;
}
