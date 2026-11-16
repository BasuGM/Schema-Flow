import type { DraftForeignKey, DraftKey, DraftSchema, DraftTable } from "@/domain/schema/draft";
import { normalizeSchema, toImportResult } from "@/domain/schema/normalize";
import type { ImportIssue, ImportResult, SqlDialect } from "@/domain/schema/types";
import { validateSchema } from "@/domain/schema/validate";
import {
  arg,
  attribute,
  columnDefault,
  columnType,
  fieldList,
  PRISMA_SCALARS,
  referentialAction,
  stringArg,
} from "./field-mapping";
import { lexPrisma } from "./lexer";
import {
  parsePrismaBlocks,
  type PrismaAttribute,
  type PrismaBlock,
  type PrismaField,
  type Warn,
} from "./parse-blocks";

export interface ParsePrismaOptions {
  /** Schema display name. */
  name?: string;
  /** Clock for `source.importedAt` (injectable for deterministic tests). */
  now?: () => string;
}

interface Model {
  block: PrismaBlock;
  table: DraftTable;
  /** Prisma field name → column name (`@map`). */
  columns: Map<string, string>;
  /** Prisma field name → column type, for implicit many-to-many join columns. */
  types: Map<string, string>;
  /** Prisma field names of the primary key. */
  idFields: string[];
}

interface RelationField {
  model: Model;
  field: PrismaField;
  name?: string;
}

/**
 * Parses a Prisma schema into a normalized schema. Never throws: every problem becomes an
 * `ImportIssue`, and one bad line or block does not prevent the rest from being imported.
 */
export function parsePrisma(text: string, options: ParsePrismaOptions = {}): ImportResult {
  const issues: ImportIssue[] = [];
  const warn: Warn = (message, line) =>
    issues.push(
      line === undefined
        ? { severity: "warning", message }
        : { severity: "warning", message, line },
    );
  try {
    const { tokens, issues: lexIssues } = lexPrisma(text);
    issues.push(...lexIssues);
    const draft = buildDraft(parsePrismaBlocks(tokens, warn), warn, issues, text, options);
    const schema = normalizeSchema(draft);
    schema.issues.push(...validateSchema(schema));
    return toImportResult(schema);
  } catch (error) {
    // Defensive: a bug in the parser must never crash the app.
    issues.push({
      severity: "error",
      message: `The Prisma schema could not be imported: ${error instanceof Error ? error.message : String(error)}`,
    });
    return { ok: false, issues };
  }
}

function buildDraft(
  blocks: PrismaBlock[],
  warn: Warn,
  issues: ImportIssue[],
  text: string,
  options: ParsePrismaOptions,
): DraftSchema {
  const of = (keyword: string) => blocks.filter((b) => b.keyword === keyword);
  const enumNames = new Map<string, string>();
  const enumValues = new Map<string, Map<string, string>>();
  const enums = of("enum").map((b) => {
    const name = stringArg(attribute(blockAttributes(b), "map"), "name", 0) ?? b.name;
    enumNames.set(b.name, name);
    const stored = new Map<string, string>();
    for (const m of b.members) {
      if (m.kind === "enumValue")
        stored.set(m.name, stringArg(attribute(m.attributes, "map"), "name", 0) ?? m.name);
    }
    enumValues.set(b.name, stored);
    return { name, values: [...stored.values()] };
  });
  for (const view of of("view"))
    warn(`Skipped view "${view.name}": views are not part of the diagram.`, view.line);

  const context: Context = {
    enumNames,
    enumValues,
    modelNames: new Set(of("model").map((b) => b.name)),
    viewNames: new Set(of("view").map((b) => b.name)),
    typeNames: new Set(of("type").map((b) => b.name)),
    relations: [],
    warn,
  };
  const models = new Map(of("model").map((b) => [b.name, buildModel(b, context)] as const));
  const joinTables = linkRelations(models, context);

  const tables = [...[...models.values()].map((m) => m.table), ...joinTables];
  if (tables.length === 0) {
    issues.push({
      severity: "error",
      message: text.trim() ? "No models were found." : "The input is empty.",
    });
  }
  const dialect = providerDialect(blocks);
  const draft: DraftSchema = {
    name: options.name ?? "Imported Prisma schema",
    source: { format: "prisma", importedAt: options.now?.() ?? new Date().toISOString() },
    tables,
    enums,
    issues,
  };
  if (dialect) draft.source.dialect = dialect;
  if (dialect === "postgresql") draft.defaultSchemaName = "public";
  return draft;
}

interface Context {
  enumNames: Map<string, string>;
  /** Enum name → Prisma value name → stored value (`@map`). */
  enumValues: Map<string, Map<string, string>>;
  modelNames: Set<string>;
  viewNames: Set<string>;
  typeNames: Set<string>;
  relations: RelationField[];
  warn: Warn;
}

function blockAttributes(block: PrismaBlock): PrismaAttribute[] {
  return block.members.flatMap((m) => (m.kind === "blockAttribute" ? [m.attribute] : []));
}

function buildModel(block: PrismaBlock, ctx: Context): Model {
  const attrs = blockAttributes(block);
  const table: DraftTable = {
    name: stringArg(attribute(attrs, "map"), "name", 0) ?? block.name,
    columns: [],
    line: block.line,
  };
  const schemaName = stringArg(attribute(attrs, "schema"), "name", 0);
  if (schemaName) table.schemaName = schemaName;
  if (block.doc) table.comment = block.doc;
  const model: Model = { block, table, columns: new Map(), types: new Map(), idFields: [] };

  for (const field of block.members) {
    if (field.kind !== "field") continue;
    if (ctx.modelNames.has(field.type) || ctx.viewNames.has(field.type)) {
      const name = stringArg(attribute(field.attributes, "relation"), "name", 0);
      ctx.relations.push(name === undefined ? { model, field } : { model, field, name });
      continue;
    }
    const known =
      PRISMA_SCALARS.has(field.type) ||
      ctx.enumNames.has(field.type) ||
      ctx.typeNames.has(field.type);
    if (!known)
      ctx.warn(
        `Unknown type "${field.type}" on "${block.name}.${field.name}"; kept as written.`,
        field.line,
      );
    const column = {
      name: stringArg(attribute(field.attributes, "map"), "name", 0) ?? field.name,
      type: columnType(field, (n) => ctx.enumNames.get(n)),
      nullable: field.optional,
      ...(field.doc ? { comment: field.doc } : {}),
    };
    const def = columnDefault(field, ctx.enumValues.get(field.type));
    table.columns.push({
      ...column,
      ...(def ? { default: def } : {}),
      ...(attribute(field.attributes, "id") ? { primaryKey: true } : {}),
      ...(attribute(field.attributes, "unique") ? { unique: true } : {}),
    });
    model.columns.set(field.name, column.name);
    model.types.set(field.name, column.type);
    if (attribute(field.attributes, "id")) model.idFields = [field.name];
  }

  for (const attr of attrs) {
    if (!["id", "unique", "index", "fulltext"].includes(attr.name)) continue;
    const fields = fieldList(arg(attr, "fields", 0));
    if (!fields) {
      ctx.warn(`Could not read the fields of @@${attr.name} in model "${block.name}".`, block.line);
      continue;
    }
    const key: DraftKey = { columns: fields.map((f) => model.columns.get(f) ?? f) };
    const name = stringArg(attr, "map") ?? stringArg(attr, "name");
    if (name) key.name = name;
    if (attr.name === "id") {
      table.primaryKey = key;
      model.idFields = fields;
    } else if (attr.name === "unique") (table.uniqueConstraints ??= []).push(key);
    else (table.indexes ??= []).push({ ...key, unique: false });
  }
  return model;
}

/**
 * Turns `@relation(fields, references)` into foreign keys and pairs list fields without `fields`
 * on both sides into implicit many-to-many join tables (`_AToB`), as Prisma creates them.
 */
function linkRelations(models: Map<string, Model>, ctx: Context): DraftTable[] {
  const joinTables: DraftTable[] = [];
  const paired = new Set<string>();
  for (const rf of ctx.relations) {
    const { model, field } = rf;
    const label = `${model.block.name}.${field.name}`;
    const target = models.get(field.type);
    if (!target) {
      ctx.warn(`Relation "${label}" points to view "${field.type}" and was skipped.`, field.line);
      continue;
    }
    const rel = attribute(field.attributes, "relation");
    const fields = fieldList(arg(rel, "fields"));
    if (fields) {
      const fk = foreignKey(rf, target, fields, fieldList(arg(rel, "references")), ctx);
      if (fk) (model.table.foreignKeys ??= []).push(fk);
      continue;
    }
    if (!field.list) continue; // The back side of a one-to-one / one-to-many relation.
    const opposite = ctx.relations.find(
      (o) =>
        o !== rf &&
        o.model.block.name === field.type &&
        o.field.type === model.block.name &&
        o.name === rf.name,
    );
    if (!opposite) {
      ctx.warn(
        `Relation "${label}" has no opposite field in "${field.type}" and was skipped.`,
        field.line,
      );
      continue;
    }
    if (!opposite.field.list) continue; // One-to-many: the foreign key is on the other side.
    const [a, b] = [model, target].sort((x, y) => x.block.name.localeCompare(y.block.name)) as [
      Model,
      Model,
    ];
    const key = `${rf.name ?? ""}|${a.block.name}|${b.block.name}`;
    if (paired.has(key)) continue;
    paired.add(key);
    const join = implicitJoinTable(rf, a, b, ctx);
    if (join) joinTables.push(join);
  }
  return joinTables;
}

function foreignKey(
  { model, field }: RelationField,
  target: Model,
  fields: string[],
  references: string[] | undefined,
  ctx: Context,
): DraftForeignKey | undefined {
  const label = `${model.block.name}.${field.name}`;
  if (!references || references.length !== fields.length) {
    ctx.warn(`Relation "${label}" needs matching "fields" and "references"; skipped.`, field.line);
    return undefined;
  }
  const missing = [
    ...fields.filter((f) => !model.columns.has(f)).map((f) => `${model.block.name}.${f}`),
    ...references.filter((f) => !target.columns.has(f)).map((f) => `${target.block.name}.${f}`),
  ];
  if (missing.length > 0) {
    ctx.warn(
      `Relation "${label}" references unknown field(s) ${missing.join(", ")}; skipped.`,
      field.line,
    );
    return undefined;
  }
  const rel = attribute(field.attributes, "relation");
  const fk: DraftForeignKey = {
    columns: fields.map((f) => model.columns.get(f)!),
    references: {
      table: target.table.name,
      ...(target.table.schemaName ? { schemaName: target.table.schemaName } : {}),
      columns: references.map((f) => target.columns.get(f)!),
    },
    line: field.line,
  };
  const name = stringArg(rel, "map");
  if (name) fk.name = name;
  const onDelete = referentialAction(arg(rel, "onDelete"));
  if (onDelete) fk.onDelete = onDelete;
  const onUpdate = referentialAction(arg(rel, "onUpdate"));
  if (onUpdate) fk.onUpdate = onUpdate;
  return fk;
}

function implicitJoinTable(
  rf: RelationField,
  a: Model,
  b: Model,
  ctx: Context,
): DraftTable | undefined {
  const name = rf.name ? `_${rf.name}` : `_${a.block.name}To${b.block.name}`;
  const [idA] = a.idFields;
  const [idB] = b.idFields;
  if (a.idFields.length !== 1 || b.idFields.length !== 1 || !idA || !idB) {
    ctx.warn(
      `Implicit many-to-many relation "${name}" needs a single-field @id on "${a.block.name}" and "${b.block.name}"; skipped.`,
      rf.field.line,
    );
    return undefined;
  }
  const side = (column: "A" | "B", m: Model, id: string): DraftForeignKey => ({
    name: `${name}_${column}_fkey`,
    columns: [column],
    references: {
      table: m.table.name,
      ...(m.table.schemaName ? { schemaName: m.table.schemaName } : {}),
      columns: [m.columns.get(id)!],
    },
    onDelete: "cascade",
    onUpdate: "cascade",
    origin: "prisma-implicit",
    line: rf.field.line,
  });
  const table: DraftTable = {
    name,
    origin: "implicit",
    line: rf.field.line,
    columns: [
      { name: "A", type: a.types.get(idA)!, nullable: false },
      { name: "B", type: b.types.get(idB)!, nullable: false },
    ],
    indexes: [
      { name: `${name}_AB_unique`, columns: ["A", "B"], unique: true },
      { name: `${name}_B_index`, columns: ["B"], unique: false },
    ],
    foreignKeys: [side("A", a, idA), side("B", b, idB)],
  };
  if (a.table.schemaName) table.schemaName = a.table.schemaName;
  return table;
}

function providerDialect(blocks: PrismaBlock[]): SqlDialect | undefined {
  const datasource = blocks.find((b) => b.keyword === "datasource");
  const provider = datasource?.members.find((m) => m.kind === "assignment" && m.key === "provider");
  const value =
    provider?.kind === "assignment" && provider.value.kind === "string" ? provider.value.value : "";
  if (value === "postgresql" || value === "postgres" || value === "cockroachdb")
    return "postgresql";
  if (value === "mysql" || value === "sqlite") return value;
  return undefined;
}
