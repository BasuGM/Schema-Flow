import type {
  CheckConstraint,
  ColumnDefault,
  ImportIssue,
  ReferentialAction,
  SchemaSource,
} from "./types";

/**
 * Loosely built schema produced by importers (and samples). Names are unresolved strings;
 * `normalizeSchema()` turns this into a validated `Schema`.
 */
export interface DraftReference {
  table: string;
  schemaName?: string;
  /** Omitted means "the referenced table's primary key". */
  columns?: string[];
}

export interface DraftForeignKey {
  name?: string;
  columns: string[];
  references: DraftReference;
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  origin?: "declared" | "prisma-implicit";
  /** Source location, carried into issues. */
  line?: number;
  statement?: string;
}

export interface DraftColumn {
  name: string;
  /** Raw type text, e.g. `varchar(255)` or `text[]`. */
  type: string;
  /** Defaults to true (SQL semantics). */
  nullable?: boolean;
  default?: ColumnDefault;
  primaryKey?: boolean;
  unique?: boolean;
  comment?: string;
  /** Inline `REFERENCES` clause. */
  references?: DraftReference & Pick<DraftForeignKey, "name" | "onDelete" | "onUpdate">;
}

export interface DraftKey {
  name?: string;
  columns: string[];
}

export interface DraftTable {
  name: string;
  schemaName?: string;
  comment?: string;
  columns: DraftColumn[];
  primaryKey?: DraftKey;
  uniqueConstraints?: DraftKey[];
  indexes?: (DraftKey & { unique?: boolean })[];
  checkConstraints?: CheckConstraint[];
  foreignKeys?: DraftForeignKey[];
  origin?: "declared" | "implicit";
  line?: number;
}

/** A foreign key declared outside its table, e.g. `ALTER TABLE ... ADD CONSTRAINT`. */
export interface DraftDetachedForeignKey extends DraftForeignKey {
  table: string;
  schemaName?: string;
}

/** A `CREATE INDEX` declared outside its table. */
export interface DraftDetachedIndex extends DraftKey {
  table: string;
  schemaName?: string;
  unique?: boolean;
  line?: number;
}

export interface DraftSchema {
  name: string;
  source: SchemaSource;
  /** Applied to tables/references without an explicit schema, e.g. `public` for PostgreSQL. */
  defaultSchemaName?: string;
  tables: DraftTable[];
  foreignKeys?: DraftDetachedForeignKey[];
  indexes?: DraftDetachedIndex[];
  enums?: { name: string; values: string[] }[];
  issues?: ImportIssue[];
}
