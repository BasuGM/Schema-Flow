import type { ColumnId, Schema, Table, TableId } from "@/domain/schema/types";

export type HealthCheckId = "missing-pk" | "unindexed-fk" | "orphan-table" | "naming";

export const HEALTH_CHECKS: readonly HealthCheckId[] = [
  "missing-pk",
  "unindexed-fk",
  "orphan-table",
  "naming",
];

export const HEALTH_CHECK_LABELS: Record<HealthCheckId, string> = {
  "missing-pk": "Missing PK",
  "unindexed-fk": "Unindexed FK",
  "orphan-table": "Orphan",
  naming: "Naming",
};

export interface HealthFinding {
  check: HealthCheckId;
  /** Advice, not an import problem: only a missing primary key is a warning. */
  severity: "warning" | "info";
  message: string;
  tableId: TableId;
  columnIds?: ColumnId[];
}

type NameStyle = "snake_case" | "camelCase" | "PascalCase" | "ALL_CAPS" | "other";

/** A single lowercase word is both snake_case and camelCase; everything else has one style. */
function stylesOf(name: string): NameStyle[] {
  if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(name)) return ["ALL_CAPS"];
  if (/^[a-z][a-z0-9]*$/.test(name)) return ["snake_case", "camelCase"];
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) return ["snake_case"];
  if (/^[a-z][a-z0-9]*([A-Z][a-z0-9]*)+$/.test(name)) return ["camelCase"];
  if (/^[A-Z][a-z0-9]*([A-Z][a-z0-9]*)*$/.test(name)) return ["PascalCase"];
  return ["other"];
}

const MIN_NAMES = 10;
const MAJORITY = 0.6;
const MAX_LISTED_COLUMNS = 5;

/** The style at least 60 % of `names` follow, or undefined (too few names or no clear majority). */
function majorityStyle(names: readonly string[]): NameStyle | undefined {
  if (names.length < MIN_NAMES) return undefined;
  const counts = new Map<NameStyle, number>();
  for (const name of names) {
    for (const style of stylesOf(name)) counts.set(style, (counts.get(style) ?? 0) + 1);
  }
  let best: NameStyle | undefined;
  let bestCount = 0;
  for (const [style, count] of counts) {
    if (count > bestCount) {
      best = style;
      bestCount = count;
    }
  }
  return best && bestCount / names.length >= MAJORITY ? best : undefined;
}

const follows = (name: string, style: NameStyle) => stylesOf(name).includes(style);

function keyColumnLists(table: Table): ColumnId[][] {
  const lists: ColumnId[][] = [];
  if (table.primaryKey) lists.push(table.primaryKey.columnIds);
  for (const u of table.uniqueConstraints) lists.push(u.columnIds);
  for (const i of table.indexes) lists.push(i.columnIds);
  return lists;
}

/** Per table: the sorted leading-column sets of every key/index, joined, for O(1) FK lookups. */
function coveredSets(table: Table): Set<string> {
  const covered = new Set<string>();
  for (const list of keyColumnLists(table)) {
    for (let k = 1; k <= list.length; k++) covered.add(list.slice(0, k).sort().join("\n"));
  }
  return covered;
}

/**
 * Advisory checks over a normalized schema: missing primary keys, foreign keys without a covering
 * index, tables with no relationships, and naming inconsistent with the schema's majority style.
 * Pure; linear in tables, relationships and indexes. Sorted warnings first, then by check and
 * declaration order.
 */
export function analyzeSchema(schema: Schema): HealthFinding[] {
  const tables = schema.tableOrder
    .map((id) => schema.tables[id])
    .filter((t): t is Table => t !== undefined && t.origin === "declared");
  const multiSchema = new Set(tables.map((t) => t.schemaName ?? "")).size > 1;
  const display = (id: TableId) => {
    const table = schema.tables[id];
    return table ? (multiSchema ? table.id : table.name) : id;
  };
  const columnName = (id: ColumnId) => {
    const dot = id.lastIndexOf(".");
    return dot < 0 ? id : id.slice(dot + 1);
  };
  const findings: HealthFinding[] = [];

  for (const table of tables) {
    if (!table.primaryKey || table.primaryKey.columnIds.length === 0) {
      findings.push({
        check: "missing-pk",
        severity: "warning",
        message: `${display(table.id)} has no primary key`,
        tableId: table.id,
      });
    }
  }

  // MySQL (InnoDB) creates an index for every foreign key, so a missing one is never real there.
  if (schema.source.dialect !== "mysql") {
    const covered = new Map<TableId, Set<string>>();
    const seen = new Set<string>();
    for (const rel of Object.values(schema.relationships)) {
      const child = schema.tables[rel.from.tableId];
      if (!child || child.origin !== "declared" || rel.from.columnIds.length === 0) continue;
      const sorted = [...rel.from.columnIds].sort();
      const key = `${child.id}\n${sorted.join("\n")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let sets = covered.get(child.id);
      if (!sets) covered.set(child.id, (sets = coveredSets(child)));
      if (sets.has(sorted.join("\n"))) continue;
      const names = rel.from.columnIds.map(columnName);
      const cols = names.length === 1 ? names[0] : `(${names.join(", ")})`;
      findings.push({
        check: "unindexed-fk",
        severity: "info",
        message: `${display(child.id)}.${cols} has no index (FK → ${display(rel.to.tableId)})`,
        tableId: child.id,
        columnIds: rel.from.columnIds,
      });
    }
  }

  const relationships = Object.values(schema.relationships);
  if (relationships.length > 0) {
    const linked = new Set<TableId>();
    for (const rel of relationships) {
      linked.add(rel.from.tableId);
      linked.add(rel.to.tableId);
    }
    for (const table of tables) {
      if (!linked.has(table.id)) {
        findings.push({
          check: "orphan-table",
          severity: "info",
          message: `${display(table.id)} has no relationships`,
          tableId: table.id,
        });
      }
    }
  }

  const tableStyle = majorityStyle(tables.map((t) => t.name));
  const columnStyle = majorityStyle(tables.flatMap((t) => t.columns.map((c) => c.name)));
  if (tableStyle || columnStyle) {
    for (const table of tables) {
      const parts: string[] = [];
      if (tableStyle && !follows(table.name, tableStyle)) {
        parts.push(`table name is not ${tableStyle}`);
      }
      const off = columnStyle ? table.columns.filter((c) => !follows(c.name, columnStyle)) : [];
      if (columnStyle && off.length > 0) {
        const listed = off.slice(0, MAX_LISTED_COLUMNS).map((c) => c.name);
        const more = off.length - listed.length;
        parts.push(
          `columns not ${columnStyle}: ${listed.join(", ")}${more > 0 ? ` (+${more} more)` : ""}`,
        );
      }
      if (parts.length === 0) continue;
      findings.push({
        check: "naming",
        severity: "info",
        message: `${display(table.id)}: ${parts.join("; ")}`,
        tableId: table.id,
        ...(off.length > 0 ? { columnIds: off.map((c) => c.id) } : {}),
      });
    }
  }

  const tableRank = new Map(schema.tableOrder.map((id, i) => [id, i]));
  const checkRank = new Map(HEALTH_CHECKS.map((c, i) => [c, i]));
  return findings
    .map((finding, k) => ({ finding, k }))
    .sort(
      (a, b) =>
        (a.finding.severity === "warning" ? 0 : 1) - (b.finding.severity === "warning" ? 0 : 1) ||
        checkRank.get(a.finding.check)! - checkRank.get(b.finding.check)! ||
        (tableRank.get(a.finding.tableId) ?? 0) - (tableRank.get(b.finding.tableId) ?? 0) ||
        a.k - b.k,
    )
    .map(({ finding }) => finding);
}

export function countFindings(findings: readonly HealthFinding[]): Record<HealthCheckId, number> {
  const counts: Record<HealthCheckId, number> = {
    "missing-pk": 0,
    "unindexed-fk": 0,
    "orphan-table": 0,
    naming: 0,
  };
  for (const f of findings) counts[f.check]++;
  return counts;
}

/** Plain-text list for copying: `WARNING  missing-pk     message`, one finding per line. */
export function findingsToText(findings: readonly HealthFinding[]): string {
  return findings
    .map((f) => `${f.severity.toUpperCase().padEnd(9)}${f.check.padEnd(14)}${f.message}`)
    .join("\n");
}
