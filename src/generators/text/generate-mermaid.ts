import { displayTableName } from "@/domain/schema/selectors";
import type { Column, Schema, Table } from "@/domain/schema/types";
import { visibleColumns } from "@/graph/node-metrics";
import { mermaidString } from "./escape";
import { createWarnings, type GeneratedText } from "./types";

export interface MermaidOptions {
  /** `keys` keeps only primary- and foreign-key columns, like the canvas "Keys" mode. */
  columns: "all" | "keys";
}

const BARE_ENTITY = /^[A-Za-z_][A-Za-z0-9_-]*$/;

/** An attribute type Mermaid accepts: letters, digits, `_ - ( ) [ ]`; commas and spaces become `_`. */
function attributeType(raw: string): string {
  const t = raw
    .toLowerCase()
    .replace(/[^a-z0-9_\-()[\]]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .replace(/_+$/, "");
  return t === "" ? "unknown" : t;
}

/** An attribute name: letters, digits, `_` and `-`; never starts with a digit. */
function attributeName(name: string): string {
  const n = name.replace(/[^A-Za-z0-9_-]+/g, "_");
  return n === "" ? "_" : /^[0-9-]/.test(n) ? `_${n}` : n;
}

function attributeLine(column: Column, unique: ReadonlySet<string>): string {
  const keys = [
    column.isPrimaryKey && "PK",
    column.isForeignKey && "FK",
    !column.isPrimaryKey && (column.isUnique || unique.has(column.id)) && "UK",
  ].filter(Boolean);
  const comment = column.comment ? ` "${mermaidString(column.comment)}"` : "";
  const keyText = keys.length > 0 ? ` ${keys.join(", ")}` : "";
  return `        ${attributeType(column.dataType.raw)} ${attributeName(column.name)}${keyText}${comment}`;
}

/** A Mermaid `erDiagram` of the schema: an entity per table, a line per relationship. */
export function generateMermaid(schema: Schema, options: MermaidOptions): GeneratedText {
  const warnings = createWarnings();
  const lines = ["erDiagram"];

  // Entity names are unique after sanitising; a clash gets a numeric suffix and a warning.
  const entityOf = new Map<string, string>();
  const used = new Set<string>();
  const tables: Table[] = schema.tableOrder.flatMap((id) => schema.tables[id] ?? []);
  for (const table of tables) {
    const display = displayTableName(schema, table);
    const base = BARE_ENTITY.test(display) ? display : `"${mermaidString(display) || "table"}"`;
    let name = base;
    for (let n = 2; used.has(name); n++) {
      name = base.endsWith('"') ? `${base.slice(0, -1)}_${n}"` : `${base}_${n}`;
    }
    if (name !== base)
      warnings.add(`Table name "${display}" clashes after cleaning; drawn as ${name}.`);
    used.add(name);
    entityOf.set(table.id, name);
  }

  for (const table of tables) {
    const columns =
      options.columns === "keys" ? visibleColumns(table, "keys") : visibleColumns(table, "full");
    const unique = new Set(
      table.uniqueConstraints.filter((u) => u.columnIds.length === 1).map((u) => u.columnIds[0]!),
    );
    const entity = entityOf.get(table.id)!;
    if (columns.length === 0) {
      lines.push(`    ${entity}`);
      continue;
    }
    lines.push(`    ${entity} {`);
    for (const column of columns) lines.push(attributeLine(column, unique));
    lines.push("    }");
  }

  const nullableFk = (table: Table | undefined, columnIds: string[]) =>
    columnIds.some((id) => table?.columns.find((c) => c.id === id)?.nullable);
  for (const rel of Object.values(schema.relationships).sort((a, b) => a.id.localeCompare(b.id))) {
    const parent = entityOf.get(rel.to.tableId);
    const child = entityOf.get(rel.from.tableId);
    if (!parent || !child) continue;
    const parentEnd = nullableFk(schema.tables[rel.from.tableId], rel.from.columnIds) ? "|o" : "||";
    const childEnd = rel.cardinality === "one-to-one" ? "o|" : "o{";
    const label =
      mermaidString(
        rel.name ??
          rel.from.columnIds.map((id) => id.slice(rel.from.tableId.length + 1)).join(", "),
      ) || "fk";
    lines.push(`    ${parent} ${parentEnd}--${childEnd} ${child} : "${label}"`);
  }

  return { text: `${lines.join("\n")}\n`, warnings: warnings.list() };
}
