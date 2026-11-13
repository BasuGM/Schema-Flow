import type { DraftColumn, DraftSchema, DraftTable } from "@/domain/schema/draft";
import { normalizeSchema } from "@/domain/schema/normalize";
import type { Schema } from "@/domain/schema/types";

export const SYNTHETIC_MIN_TABLES = 1;
export const SYNTHETIC_MAX_TABLES = 1000;

export interface SyntheticOptions {
  tables: number;
  seed?: number;
}

/** mulberry32 — tiny deterministic PRNG so synthetic schemas are reproducible. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPES = [
  "integer",
  "bigint",
  "text",
  "varchar(255)",
  "boolean",
  "timestamptz",
  "numeric(12, 2)",
  "jsonb",
  "uuid",
];

export function clampTableCount(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(SYNTHETIC_MAX_TABLES, Math.max(SYNTHETIC_MIN_TABLES, Math.round(n)));
}

/**
 * Generates a synthetic schema for performance testing: `tables` tables with 3–12 columns each and
 * 0–3 foreign keys per table pointing at earlier tables (occasionally self-referencing).
 * Deterministic for a given (tables, seed).
 */
export function generateSyntheticSchema({ tables, seed = 1 }: SyntheticOptions): Schema {
  const count = clampTableCount(tables);
  const rand = prng(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)] as T;
  const draftTables: DraftTable[] = [];

  for (let i = 0; i < count; i++) {
    const name = `table_${String(i + 1).padStart(4, "0")}`;
    const columns: DraftColumn[] = [
      { name: "id", type: "bigint", nullable: false, primaryKey: true },
    ];
    const fkCount = i === 0 ? 0 : Math.floor(rand() * 4);
    const targets = new Set<number>();
    for (let f = 0; f < fkCount; f++) targets.add(rand() < 0.05 ? i : Math.floor(rand() * i));
    for (const target of targets) {
      const targetName = `table_${String(target + 1).padStart(4, "0")}`;
      columns.push({
        name: `${targetName}_id`,
        type: "bigint",
        nullable: rand() < 0.3,
        references: { table: targetName },
      });
    }
    const extra = 2 + Math.floor(rand() * 9);
    for (let c = 0; c < extra; c++) {
      columns.push({ name: `col_${c + 1}`, type: pick(TYPES), nullable: rand() < 0.5 });
    }
    draftTables.push({ name, columns });
  }

  const draft: DraftSchema = {
    name: `Synthetic (${count} tables, seed ${seed})`,
    source: { format: "sample", importedAt: "2026-01-01T00:00:00.000Z" },
    tables: draftTables,
  };
  return normalizeSchema(draft);
}
