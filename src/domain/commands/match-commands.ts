/** A command the search dialog can run (P4-T04). Pure data; the run handler lives in the UI layer. */
export interface CommandSpec {
  id: string;
  label: string;
  group: string;
  /** Extra words that should find the command (e.g. "dark" for the theme commands). */
  keywords: readonly string[];
}

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Lower is better; `null` = no match. Every query token must match the label or a keyword. */
function rank(spec: CommandSpec, tokens: readonly string[], query: string): number | null {
  const label = spec.label.toLowerCase();
  const labelWords = words(spec.label);
  const keywordWords = spec.keywords.flatMap(words);
  for (const token of tokens) {
    const inLabel = label.includes(token);
    const inKeywords = keywordWords.some((w) => w.startsWith(token));
    if (!inLabel && !inKeywords) return null;
  }
  if (label.startsWith(query)) return 0;
  if (labelWords.some((w) => w.startsWith(tokens[0]!))) return 1;
  if (label.includes(tokens[0]!)) return 2;
  return 3;
}

/**
 * Commands matching `query`, best first (label prefix, then word prefix, then substring, then
 * keyword); ties keep the input order. An empty query returns every command in input order.
 */
export function matchCommands<T extends CommandSpec>(items: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [...items];
  const tokens = q.split(/\s+/);
  return items
    .map((item, order) => ({ item, order, score: rank(item, tokens, q) }))
    .filter((r): r is { item: T; order: number; score: number } => r.score !== null)
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .map((r) => r.item);
}
