/** `schema.name` or `name`, as written: the raw table name parsers attach to issues for linking. */
export function tableLabel(table: { name: string; schemaName?: string }): string {
  return table.schemaName ? `${table.schemaName}.${table.name}` : table.name;
}
