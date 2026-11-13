/**
 * Normalized schema model — the single source of truth for schema data.
 * Every importer (SQL, Prisma, samples) produces a `Schema` via `normalizeSchema()`.
 * React Flow nodes/edges are derived from it and are never the source of truth.
 */

/** Schema-qualified when a schema name is known, e.g. `public.users`; otherwise the bare name. */
export type TableId = string;
/** `<TableId>.<column name>`, e.g. `public.users.id`. */
export type ColumnId = string;
/** Deterministic, see `relationshipId()` in ids.ts. */
export type RelationshipId = string;

export type ReferentialAction = "cascade" | "restrict" | "set null" | "set default" | "no action";

export type SourceFormat = "sql" | "prisma" | "sample";
export type SqlDialect = "postgresql" | "mysql" | "sqlite";

export interface SchemaSource {
  format: SourceFormat;
  dialect?: SqlDialect;
  /** ISO 8601 timestamp. Samples use a fixed value so output is deterministic. */
  importedAt: string;
}

export interface DataType {
  /** Exactly as written, e.g. `numeric(10, 2)`. */
  raw: string;
  /** Lower-cased type name without params/array suffix, e.g. `numeric`. */
  base: string;
  params?: string[];
  isArray?: boolean;
  /** Set when `base` names an enum declared in `Schema.enums`. */
  enumName?: string;
}

export interface ColumnDefault {
  kind: "literal" | "expression" | "function" | "autoincrement";
  value: string;
}

export interface Column {
  id: ColumnId;
  tableId: TableId;
  name: string;
  dataType: DataType;
  nullable: boolean;
  default?: ColumnDefault;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  /** True when the column alone is covered by a unique constraint or unique index (not the PK). */
  isUnique: boolean;
  comment?: string;
}

export interface KeyConstraint {
  name?: string;
  columnIds: ColumnId[];
}

export interface TableIndex extends KeyConstraint {
  unique: boolean;
}

export interface CheckConstraint {
  name?: string;
  expression: string;
}

export interface Table {
  id: TableId;
  name: string;
  schemaName?: string;
  comment?: string;
  columns: Column[];
  primaryKey?: KeyConstraint;
  uniqueConstraints: KeyConstraint[];
  indexes: TableIndex[];
  checkConstraints: CheckConstraint[];
  /** `implicit` for synthetic tables such as Prisma's implicit many-to-many join tables. */
  origin: "declared" | "implicit";
}

export interface RelationshipEnd {
  tableId: TableId;
  columnIds: ColumnId[];
}

export interface Relationship {
  id: RelationshipId;
  name?: string;
  /** FK-holding (child) side. */
  from: RelationshipEnd;
  /** Referenced (parent) side. */
  to: RelationshipEnd;
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
  cardinality: "many-to-one" | "one-to-one";
  origin: "declared" | "prisma-implicit";
}

export interface EnumType {
  name: string;
  values: string[];
}

export interface ImportIssue {
  severity: "error" | "warning";
  message: string;
  line?: number;
  statement?: string;
}

export interface Schema {
  name: string;
  source: SchemaSource;
  tables: Record<TableId, Table>;
  /** Declaration order; drives sidebar order and deterministic layout input. */
  tableOrder: TableId[];
  relationships: Record<RelationshipId, Relationship>;
  enums: Record<string, EnumType>;
  issues: ImportIssue[];
}

export type ImportResult =
  | { ok: true; schema: Schema; issues: ImportIssue[] }
  | { ok: false; schema?: Schema; issues: ImportIssue[] };

export type CollapseMode = "full" | "keys" | "header";
export type LayoutDirection = "LR" | "TB";

export interface Position {
  x: number;
  y: number;
}

export interface Viewport extends Position {
  zoom: number;
}

/**
 * Obstacle-avoiding route computed by the auto-layout for an edge that spans more than one rank.
 * Valid only while both end tables are still at the recorded positions.
 */
export interface EdgeRoute {
  /** Intermediate waypoints, ordered from the FK (source) side to the referenced (target) side. */
  waypoints: Position[];
  sourceAt: Position;
  targetAt: Position;
}

/** Layout state is kept separate from schema data and keyed by schema fingerprint. */
export interface DiagramLayout {
  fingerprint: string;
  positions: Record<TableId, Position>;
  /** Present after auto-layout; only edges that need routing have an entry. */
  edgeRoutes?: Record<RelationshipId, EdgeRoute>;
  collapsed: Record<TableId, CollapseMode>;
  viewport?: Viewport;
  direction: LayoutDirection;
}
