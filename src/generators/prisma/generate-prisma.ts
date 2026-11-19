import { showsSchemaName } from "@/domain/schema/selectors";
import type {
  Column,
  KeyConstraint,
  Schema,
  SqlDialect,
  Table,
  TableId,
} from "@/domain/schema/types";
import { prismaDocComment, prismaLineComment, prismaString } from "../text/escape";
import { createWarnings, type GeneratedText, type Warnings } from "../text/types";
import { prismaDefault } from "./defaults";
import { prismaFieldType } from "./field-types";
import {
  fieldBaseName,
  listFieldName,
  modelBaseName,
  prismaEnumValueName,
  uniqueNames,
} from "./naming";
import { findImplicitJoins, relationFields } from "./relations";

/**
 * A Prisma schema for `schema`. Model names are PascalCase table names (`@@map` keeps the real
 * name), columns keep their names (`@map` when they are not valid Prisma identifiers), Prisma's
 * implicit many-to-many join tables are folded back into list fields, and what Prisma cannot
 * express (CHECK constraints, a table without a key) is reported. Never throws.
 */
export function generatePrisma(schema: Schema): GeneratedText {
  const warnings = createWarnings();
  const header = prismaLineComment(`SchemaFlow export: ${schema.name}`);
  try {
    return { text: build(schema, warnings, header), warnings: warnings.list() };
  } catch (error) {
    warnings.add(`The export failed: ${error instanceof Error ? error.message : String(error)}`);
    return { text: `${header}\n`, warnings: warnings.list() };
  }
}

function build(schema: Schema, warnings: Warnings, header: string): string {
  const provider: SqlDialect = schema.source.dialect ?? "postgresql";
  const isPrismaSource = schema.source.format === "prisma";
  const allTables = schema.tableOrder.flatMap((id) => schema.tables[id] ?? []);
  const joins = findImplicitJoins(schema, allTables);
  for (const t of allTables) {
    if (t.origin === "implicit" && !joins.has(t.id)) {
      warnings.add(
        `Table "${t.name}" looks like an implicit join table but is exported as a model.`,
      );
    }
  }
  const tables = allTables.filter((t) => !joins.has(t.id));
  const tableById = new Map(tables.map((t) => [t.id, t]));

  // Models and enums share one namespace in Prisma.
  const unique = uniqueNames();
  const modelNames = new Map<TableId, string>(
    tables.map((t) => [t.id, unique(modelBaseName(t.name))]),
  );
  const enumNames = new Map(
    Object.values(schema.enums).map((e) => [e.name, unique(modelBaseName(e.name))]),
  );

  // Field names per model; relation fields allocate from the same registry.
  const registry = new Map<TableId, (wanted: string) => string>();
  const fieldNames = new Map<string, string>();
  for (const t of tables) {
    const alloc = uniqueNames();
    registry.set(t.id, alloc);
    for (const c of t.columns) fieldNames.set(c.id, alloc(fieldBaseName(c.name)));
  }
  const allocate = (id: TableId, wanted: string) => registry.get(id)!(wanted);

  const fkRels = Object.values(schema.relationships)
    .filter((r) => r.origin !== "prisma-implicit" || !joins.has(r.from.tableId))
    .filter((r) => tableById.has(r.from.tableId) && tableById.has(r.to.tableId))
    .sort((a, b) => a.id.localeCompare(b.id));
  const relLines = relationFields(schema, fkRels, {
    modelName: (id) => modelNames.get(id)!,
    fieldName: (id) => fieldNames.get(id) ?? id,
    allocate,
  });
  for (const j of joins.values()) {
    const [a, b] = [j.a, j.b];
    const attr = `@relation(${prismaString(j.name)})`;
    if (tableById.has(a) && tableById.has(b)) {
      relLines.set(a, [
        ...(relLines.get(a) ?? []),
        `${allocate(a, listFieldName(modelNames.get(b)!))} ${modelNames.get(b)}[] ${attr}`,
      ]);
      relLines.set(b, [
        ...(relLines.get(b) ?? []),
        `${allocate(b, listFieldName(modelNames.get(a)!))} ${modelNames.get(a)}[] ${attr}`,
      ]);
    }
  }

  const field = (id: string) => fieldNames.get(id) ?? id;
  const list = (ids: string[]) => `[${ids.map(field).join(", ")}]`;
  const mapArg = (name?: string) => (name ? `map: ${prismaString(name)}` : undefined);
  const schemasUsed = new Set<string>();

  const models = tables.map((t) => {
    const model = modelNames.get(t.id)!;
    const columnLines = t.columns.map((c) => columnLine(c, t));
    const attrs: string[] = [];
    const singlePk = t.primaryKey?.columnIds.length === 1;
    if (t.primaryKey && !singlePk) {
      const arg = mapArg(t.primaryKey.name);
      attrs.push(`@@id(${list(t.primaryKey.columnIds)}${arg ? `, ${arg}` : ""})`);
    }
    const keys: { key: KeyConstraint; unique: boolean }[] = [
      ...t.uniqueConstraints.map((key) => ({ key, unique: true })),
      ...t.indexes.map((key) => ({ key, unique: key.unique })),
    ];
    const seen = new Set<string>();
    for (const { key, unique: isUnique } of keys) {
      if (isUnique && key.columnIds.length === 1) continue; // written on the field
      const sig = `${isUnique}:${key.columnIds.join(",")}`;
      if (seen.has(sig)) continue;
      seen.add(sig);
      const arg = mapArg(key.name);
      attrs.push(
        `@@${isUnique ? "unique" : "index"}(${list(key.columnIds)}${arg ? `, ${arg}` : ""})`,
      );
    }
    if (model !== t.name) attrs.push(`@@map(${prismaString(t.name)})`);
    if (t.schemaName && showsSchemaName(schema, t)) {
      attrs.push(`@@schema(${prismaString(t.schemaName)})`);
      schemasUsed.add(t.schemaName);
    }

    const notes: string[] = [];
    if (t.checkConstraints.length > 0) {
      warnings.add(
        `Model "${model}": CHECK constraints are not supported by Prisma and were left out.`,
      );
      for (const c of t.checkConstraints) notes.push(prismaLineComment(`CHECK (${c.expression})`));
    }
    const hasUnique =
      t.primaryKey || t.uniqueConstraints.length > 0 || t.indexes.some((i) => i.unique);
    if (!hasUnique) {
      warnings.add(
        `Model "${model}" has no primary key or unique key; Prisma needs one before it can be used.`,
      );
      notes.push(prismaLineComment("Prisma needs an @id or @@unique on every model."));
    }
    if (t.partitions?.length) {
      warnings.add(`Model "${model}": ${t.partitions.length} folded partitions are not emitted.`);
    }

    const body = [
      ...columnLines.flat(),
      ...(relLines.get(t.id) ?? []).map((l) => `  ${l}`),
      ...notes.map((n) => `  ${n}`),
    ];
    const tail = attrs.map((a) => `  ${a}`);
    return [
      ...(t.comment ? [prismaDocComment(t.comment)] : []),
      `model ${model} {`,
      ...body,
      ...(tail.length > 0 ? ["", ...tail] : []),
      "}",
    ].join("\n");
  });

  function columnLine(c: Column, t: Table): string[] {
    const enumDef = c.dataType.enumName ? schema.enums[c.dataType.enumName] : undefined;
    const attrs: string[] = [];
    let type: string;
    let isList = false;
    let unsupported = false;
    if (enumDef) {
      type = enumNames.get(enumDef.name) ?? enumDef.name;
      isList = Boolean(c.dataType.isArray) && provider === "postgresql";
    } else if (c.dataType.isArray && provider !== "postgresql") {
      type = `Unsupported(${prismaString(c.dataType.raw)})`;
      unsupported = true;
      warnings.add(
        `Model "${modelNames.get(t.id)}": list columns need PostgreSQL; "${c.name}" is Unsupported.`,
      );
    } else {
      const mapped = prismaFieldType(c.dataType, provider, isPrismaSource);
      type = mapped.type;
      unsupported = mapped.unsupported;
      attrs.push(...mapped.attrs);
      isList = Boolean(c.dataType.isArray);
      if (unsupported) {
        warnings.add(`Type "${c.dataType.raw}" has no Prisma equivalent; exported as Unsupported.`);
      }
    }
    if (t.primaryKey?.columnIds.length === 1 && t.primaryKey.columnIds[0] === c.id) {
      attrs.unshift(t.primaryKey.name ? `@id(map: ${prismaString(t.primaryKey.name)})` : "@id");
    }
    const def = prismaDefault(c, enumDef);
    if (def && (!unsupported || def.startsWith("dbgenerated"))) attrs.push(`@default(${def})`);
    const single = [...t.uniqueConstraints, ...t.indexes.filter((i) => i.unique)].find(
      (k) => k.columnIds.length === 1 && k.columnIds[0] === c.id,
    );
    if (single && !(t.primaryKey?.columnIds.length === 1 && t.primaryKey.columnIds[0] === c.id)) {
      attrs.push(single.name ? `@unique(map: ${prismaString(single.name)})` : "@unique");
    }
    if (field(c.id) !== c.name) attrs.push(`@map(${prismaString(c.name)})`);
    if (isList && c.nullable) {
      warnings.add("Prisma lists are never null: nullable list columns become non-nullable.");
    }
    const optional = c.nullable && !isList ? "?" : "";
    const line = `  ${field(c.id)} ${type}${isList ? "[]" : ""}${optional}${attrs.length ? ` ${attrs.join(" ")}` : ""}`;
    return [...(c.comment ? [`  ${prismaDocComment(c.comment)}`] : []), line];
  }

  const enums = Object.values(schema.enums).map((e) => {
    const name = enumNames.get(e.name)!;
    const values = e.values.map((v) => {
      const id = prismaEnumValueName(v, e.values);
      return `  ${id}${id !== v ? ` @map(${prismaString(v)})` : ""}`;
    });
    return [
      `enum ${name} {`,
      ...values,
      ...(name !== e.name ? ["", `  @@map(${prismaString(e.name)})`] : []),
      "}",
    ].join("\n");
  });

  const generator = [
    "generator client {",
    '  provider = "prisma-client-js"',
    ...(schemasUsed.size > 0 ? ['  previewFeatures = ["multiSchema"]'] : []),
    "}",
  ].join("\n");
  const datasource = [
    "datasource db {",
    `  provider = ${prismaString(provider)}`,
    '  url      = env("DATABASE_URL")',
    ...(schemasUsed.size > 0
      ? [`  schemas  = [${[...schemasUsed].sort().map(prismaString).join(", ")}]`]
      : []),
    "}",
  ].join("\n");
  return `${[header, generator, datasource, ...models, ...enums].join("\n\n")}\n`;
}
