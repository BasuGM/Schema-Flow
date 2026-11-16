import type { ImportResult, SqlDialect } from "@/domain/schema/types";
import { detectFormat } from "./detect-format";
import { parsePrisma } from "./prisma/parse-prisma";
import { parseSql } from "./sql/parse-sql";

/** What the user picked in the import dialog; `auto` means "detect from the text". */
export type ImportFormatChoice = "auto" | SqlDialect | "prisma";

export interface ParseSchemaTextOptions {
  format?: ImportFormatChoice;
  /** Schema display name; defaults to "Pasted SQL" / "Pasted Prisma schema". */
  name?: string;
  now?: () => string;
}

export interface ParsedSchemaText {
  result: ImportResult;
  /** The format that was parsed (detected or chosen). */
  format: "sql" | "prisma" | "unknown";
  dialect?: SqlDialect;
}

/**
 * Single entry point for the import dialog: detects (or takes) the format and dispatches to the SQL
 * or Prisma parser. Never throws.
 */
export function parseSchemaText(
  text: string,
  options: ParseSchemaTextOptions = {},
): ParsedSchemaText {
  const choice = options.format ?? "auto";
  const detected = detectFormat(text);
  const format = choice === "auto" ? detected.format : choice === "prisma" ? "prisma" : "sql";
  const common = options.now ? { now: options.now } : {};

  if (format === "prisma") {
    const result = parsePrisma(text, { ...common, name: options.name ?? "Pasted Prisma schema" });
    return { result, format };
  }
  if (format === "sql") {
    const dialect = choice === "auto" || choice === "prisma" ? detected.dialect : choice;
    const result = parseSql(text, {
      ...common,
      name: options.name ?? "Pasted SQL",
      ...(dialect ? { dialect } : {}),
    });
    const parsedDialect = result.schema?.source.dialect ?? dialect;
    return parsedDialect ? { result, format, dialect: parsedDialect } : { result, format };
  }
  const message = text.trim()
    ? "This doesn't look like SQL DDL or a Prisma schema."
    : "The input is empty.";
  return { result: { ok: false, issues: [{ severity: "error", message }] }, format: "unknown" };
}
