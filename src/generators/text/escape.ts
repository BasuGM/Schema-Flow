import type { SqlDialect } from "@/domain/schema/types";

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const NEWLINES = /\r\n|\r|\n/;

/**
 * A SQL string literal for any user text (enum values, defaults, comments): `'` is doubled, MySQL
 * also doubles backslashes (they are escapes there), NUL and other control characters are dropped.
 */
export function sqlString(value: string, dialect: SqlDialect): string {
  let v = value.replace(/\u0000/g, "");
  if (dialect === "mysql") v = v.replace(/\\/g, "\\\\");
  return `'${v.replace(/'/g, "''")}'`;
}

/**
 * Text for a SQL `--` comment. Every line gets its own `-- ` prefix, so a newline in the source
 * text cannot end the comment and let the rest run as SQL.
 */
export function sqlLineComment(text: string): string {
  return text
    .replace(CONTROL, "")
    .split(NEWLINES)
    .map((line) => `-- ${line}`.trimEnd())
    .join("\n");
}

/** A Prisma string literal (`@map`, `@@map`, `dbgenerated`, `Unsupported`): `\` and `"` escaped. */
export function prismaString(value: string): string {
  const v = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(CONTROL, "");
  return `"${v}"`;
}

/** A Prisma `///` doc comment: one line, never a raw newline. */
export function prismaDocComment(text: string): string {
  return `/// ${text
    .replace(CONTROL, "")
    .replace(/\s*(?:\r\n|\r|\n)\s*/g, " ")
    .trim()}`;
}

/**
 * Text inside a Mermaid double-quoted string (entity names, attribute comments, relationship
 * labels): `"` becomes `'`, newlines and control characters collapse to single spaces.
 */
export function mermaidString(value: string): string {
  return value
    .replace(CONTROL, " ")
    .replace(/"/g, "'")
    .replace(/\\/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

/** A plain Prisma `//` comment (not a `///` doc comment, which the importer reads as documentation). */
export function prismaLineComment(text: string): string {
  return `// ${text
    .replace(CONTROL, "")
    .replace(/\s*(?:\r\n|\r|\n)\s*/g, " ")
    .trim()}`;
}
