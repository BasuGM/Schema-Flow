import { matchTerm, prepareTerm, type Field, type Range, type Term, type TermMatch } from "./field";
import type { ColumnEntry, SearchIndex, TableEntry } from "./search-index";

export const SEARCH_LIMIT = 50;
const MAX_QUERY_LENGTH = 200;

/** Highlight ranges per displayed field. */
export interface Marks {
  schema: Range[];
  table: Range[];
  column: Range[];
}

export interface TableHit {
  entry: TableEntry;
  tier: number;
  marks: Marks;
}

export interface ColumnHit {
  entry: ColumnEntry;
  tier: number;
  marks: Marks;
}

export interface SearchResults {
  tables: TableHit[];
  columns: ColumnHit[];
  totalTables: number;
  totalColumns: number;
}

type Query = { kind: "empty" } | { kind: "terms"; terms: Term[] } | { kind: "path"; parts: Term[] };

/**
 * Query syntax:
 * - one term matches the primary field only (table name for tables, column name for columns);
 * - several space-separated terms are ANDed over schema / table / column, and at least one must
 *   match the primary field (`order user` → `orders.user_id`);
 * - a dotted query is positional, aligned from the right: `ord.user` = table ~ `ord`, column ~
 *   `user`; `billing.inv` = schema + table. An empty part matches anything (`orders.`).
 */
export function parseQuery(text: string): Query {
  const q = text.slice(0, MAX_QUERY_LENGTH).trim();
  if (!q) return { kind: "empty" };
  if (q.includes("."))
    return { kind: "path", parts: q.split(".").map((p) => prepareTerm(p.trim())) };
  return { kind: "terms", terms: q.split(/\s+/).map(prepareTerm) };
}

/** Ranking key: worst term tier, sum of tiers, primary name length, declaration order. */
interface Rank {
  worst: number;
  sum: number;
  length: number;
  order: number;
}

interface Scored {
  rank: Rank;
  /** Field index (0 schema, 1 table, 2 column) and matched ranges, for the marks. */
  matched: { at: number; ranges: Range[] }[];
}

const KEYS = ["schema", "table", "column"] as const;

/** Matches query term `i` against a field. */
type Matcher = (field: Field, i: number) => TermMatch | null;

/**
 * Schema and table fields are shared by every column of a table, so their matches are memoized
 * per query; column names go straight to `matchTerm` (most are distinct, and a miss is cheap).
 */
function matchers(terms: Term[]): { shared: Matcher; direct: Matcher } {
  const memo = terms.map(() => new Map<Field, TermMatch | null>());
  return {
    shared: (field, i) => {
      const cache = memo[i]!;
      let m = cache.get(field);
      if (m === undefined) cache.set(field, (m = matchTerm(field, terms[i]!)));
      return m;
    },
    direct: (field, i) => matchTerm(field, terms[i]!),
  };
}

/**
 * Scores one entry. `fields` are aligned with KEYS (tables pass schema + table, columns schema +
 * table + column); the last one is the primary field and is matched with `primary`.
 */
function score(
  fields: readonly (Field | null)[],
  query: Query,
  order: number,
  m: { shared: Matcher; direct: Matcher },
): Scored | null {
  const last = fields.length - 1;
  const matchAt = (at: number, i: number) => {
    const field = fields[at];
    if (!field) return null;
    return at === last && last === 2 ? m.direct(field, i) : m.shared(field, i);
  };
  const matched: Scored["matched"] = [];
  let worst = 0;
  let sum = 0;
  let length = fields[last]!.raw.length;
  if (query.kind === "path") {
    const offset = fields.length - query.parts.length;
    if (offset < 0) return null;
    // The primary (last) part first: it rejects most entries.
    for (let i = query.parts.length - 1; i >= 0; i--) {
      if (query.parts[i]!.lower === "") continue;
      const hit = matchAt(offset + i, i);
      if (!hit) return null;
      worst = Math.max(worst, hit.tier);
      sum += hit.tier;
      matched.push({ at: offset + i, ranges: hit.ranges });
    }
    // `orders.` lists columns in declaration order, not by name length.
    if (query.parts[query.parts.length - 1]!.lower === "") length = 0;
  } else if (query.kind === "terms") {
    const single = query.terms.length === 1;
    let primaryHit = false;
    for (let i = 0; i < query.terms.length; i++) {
      let best: TermMatch | null = null;
      let bestAt = last;
      for (let at = last; at >= (single ? last : 0); at--) {
        const hit = matchAt(at, i);
        if (hit && (!best || hit.tier < best.tier)) {
          best = hit;
          bestAt = at;
        }
      }
      if (!best) return null;
      if (bestAt === last) primaryHit = true;
      worst = Math.max(worst, best.tier);
      sum += best.tier;
      matched.push({ at: bestAt, ranges: best.ranges });
    }
    if (!primaryHit) return null;
  } else return null;
  return { rank: { worst, sum, length, order }, matched };
}

const compare = (a: Rank, b: Rank) =>
  a.worst - b.worst || a.sum - b.sum || a.length - b.length || a.order - b.order;

/** Keeps the best `limit` items without sorting everything. */
class TopList<T> {
  readonly items: { scored: Scored; item: T }[] = [];
  total = 0;
  constructor(private readonly limit: number) {}
  add(scored: Scored, item: T) {
    this.total++;
    const items = this.items;
    const rank = scored.rank;
    if (items.length === this.limit && compare(rank, items[items.length - 1]!.scored.rank) >= 0) {
      return;
    }
    let i = items.length;
    while (i > 0 && compare(rank, items[i - 1]!.scored.rank) < 0) i--;
    items.splice(i, 0, { scored, item });
    if (items.length > this.limit) items.pop();
  }
}

function toMarks(matched: Scored["matched"]): Marks {
  const marks: Marks = { schema: [], table: [], column: [] };
  for (const { at, ranges } of matched) marks[KEYS[at]!].push(...ranges);
  return marks;
}

const NO_MARKS: Marks = { schema: [], table: [], column: [] };

/**
 * Searches tables and columns. Ranking per group: worst term tier, then the sum of tiers, then
 * the shorter name, then declaration order. Each group keeps the best `limit` hits plus a total.
 */
export function search(index: SearchIndex, text: string, limit = SEARCH_LIMIT): SearchResults {
  const query = parseQuery(text);
  if (query.kind === "empty") {
    return {
      tables: index.tables.slice(0, limit).map((entry) => ({ entry, tier: 0, marks: NO_MARKS })),
      columns: [],
      totalTables: index.tables.length,
      totalColumns: 0,
    };
  }
  const m = matchers(query.kind === "path" ? query.parts : query.terms);
  const tables = new TopList<TableEntry>(limit);
  const tableFields: (Field | null)[] = [null, null];
  for (const entry of index.tables) {
    tableFields[0] = entry.schema;
    tableFields[1] = entry.name;
    const s = score(tableFields, query, entry.order, m);
    if (s) tables.add(s, entry);
  }
  const columns = new TopList<ColumnEntry>(limit);
  const columnFields: (Field | null)[] = [null, null, null];
  for (const entry of index.columns) {
    columnFields[0] = entry.table.schema;
    columnFields[1] = entry.table.name;
    columnFields[2] = entry.name;
    const s = score(columnFields, query, entry.order, m);
    if (s) columns.add(s, entry);
  }
  const hits = <T>(list: TopList<T>) =>
    list.items.map(({ scored, item }) => ({
      entry: item,
      tier: scored.rank.worst,
      marks: toMarks(scored.matched),
    }));
  return {
    tables: hits(tables),
    columns: hits(columns),
    totalTables: tables.total,
    totalColumns: columns.total,
  };
}
