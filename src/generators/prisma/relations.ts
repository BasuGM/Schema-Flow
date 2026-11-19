import type {
  ReferentialAction,
  Relationship,
  Schema,
  Table,
  TableId,
} from "@/domain/schema/types";
import { prismaString } from "../text/escape";
import { lowerFirst } from "../text/identifiers";
import { listFieldName } from "./naming";

const ACTION: Record<ReferentialAction, string> = {
  cascade: "Cascade",
  restrict: "Restrict",
  "set null": "SetNull",
  "set default": "SetDefault",
  "no action": "NoAction",
};

/** A Prisma implicit many-to-many join table (`_AToB`), folded back into list fields. */
export interface ImplicitJoin {
  table: Table;
  /** The relation name: the join table's name without its leading underscore. */
  name: string;
  a: TableId;
  b: TableId;
}

/**
 * Join tables Prisma creates itself: `origin: "implicit"`, two `prisma-implicit` foreign keys from
 * columns `A` and `B`, each to a model whose primary key is that single referenced column. Anything
 * that does not fit stays an ordinary model (and is reported).
 */
export function findImplicitJoins(schema: Schema, tables: Table[]): Map<TableId, ImplicitJoin> {
  const joins = new Map<TableId, ImplicitJoin>();
  const rels = Object.values(schema.relationships);
  for (const t of tables) {
    if (t.origin !== "implicit") continue;
    const own = rels.filter((r) => r.from.tableId === t.id && r.origin === "prisma-implicit");
    const relA = own.find((r) => r.from.columnIds[0] === `${t.id}.A`);
    const relB = own.find((r) => r.from.columnIds[0] === `${t.id}.B`);
    if (own.length !== 2 || !relA || !relB) continue;
    const singlePk = (r: Relationship) => {
      const parent = schema.tables[r.to.tableId];
      return parent?.origin !== "implicit" && parent?.primaryKey?.columnIds.length === 1
        ? parent.primaryKey.columnIds[0] === r.to.columnIds[0]
        : false;
    };
    if (!singlePk(relA) || !singlePk(relB)) continue;
    joins.set(t.id, {
      table: t,
      name: t.name.startsWith("_") ? t.name.slice(1) : t.name,
      a: relA.to.tableId,
      b: relB.to.tableId,
    });
  }
  return joins;
}

export interface RelationNaming {
  modelName: (id: TableId) => string;
  /** Prisma field name of a column. */
  fieldName: (columnId: string) => string;
  /** Reserves a name on a model (relation fields share the namespace with columns). */
  allocate: (id: TableId, wanted: string) => string;
}

/**
 * The relation fields for foreign keys: one on the child (`fields` / `references`) and its back
 * field on the parent (`Child[]`, or `Child?` for one-to-one). Lines are returned per model.
 * A relation gets an explicit name when it is a self-relation or two models share several.
 */
export function relationFields(
  schema: Schema,
  rels: Relationship[],
  naming: RelationNaming,
): Map<TableId, string[]> {
  const lines = new Map<TableId, string[]>();
  const push = (id: TableId, line: string) => lines.set(id, [...(lines.get(id) ?? []), line]);
  const pairCount = new Map<string, number>();
  const pair = (r: Relationship) => [r.from.tableId, r.to.tableId].sort().join("\u0000");
  for (const r of rels) pairCount.set(pair(r), (pairCount.get(pair(r)) ?? 0) + 1);

  for (const r of rels) {
    const child = naming.modelName(r.from.tableId);
    const parent = naming.modelName(r.to.tableId);
    const childField = naming.allocate(r.from.tableId, lowerFirst(parent));
    const oneToOne = r.cardinality === "one-to-one";
    const backField = naming.allocate(
      r.to.tableId,
      oneToOne ? lowerFirst(child) : listFieldName(child),
    );
    const named = r.from.tableId === r.to.tableId || (pairCount.get(pair(r)) ?? 0) > 1;
    const relName = `${child}_${childField}`;
    const nullable = r.from.columnIds.some(
      (id) => schema.tables[r.from.tableId]?.columns.find((c) => c.id === id)?.nullable,
    );
    const list = (ids: string[]) => `[${ids.map(naming.fieldName).join(", ")}]`;
    const args = [
      ...(named ? [prismaString(relName)] : []),
      `fields: ${list(r.from.columnIds)}`,
      `references: ${list(r.to.columnIds)}`,
      ...(r.onDelete ? [`onDelete: ${ACTION[r.onDelete]}`] : []),
      ...(r.onUpdate ? [`onUpdate: ${ACTION[r.onUpdate]}`] : []),
      ...(r.name ? [`map: ${prismaString(r.name)}`] : []),
    ];
    push(
      r.from.tableId,
      `${childField} ${parent}${nullable ? "?" : ""} @relation(${args.join(", ")})`,
    );
    push(
      r.to.tableId,
      `${backField} ${child}${oneToOne ? "?" : "[]"}${named ? ` @relation(${prismaString(relName)})` : ""}`,
    );
  }
  return lines;
}
