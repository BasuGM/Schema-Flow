import type { Schema } from "@/domain/schema/types";
import { generatePrisma } from "../prisma/generate-prisma";
import { generateSql } from "../sql/generate-sql";
import { generateJson } from "./generate-json";
import { generateMermaid } from "./generate-mermaid";
import { targetFile, type GeneratedText, type GeneratorTarget, type TargetFile } from "./types";

export type GeneratedFile = GeneratedText & TargetFile;

/** Any text export in one call: the text, its warnings and the file extension / MIME type. */
export function generateSchemaText(schema: Schema, target: GeneratorTarget): GeneratedFile {
  const file = targetFile(target);
  switch (target.kind) {
    case "sql":
      return { ...generateSql(schema, { dialect: target.dialect }), ...file };
    case "prisma":
      return { ...generatePrisma(schema), ...file };
    case "mermaid":
      return { ...generateMermaid(schema, { columns: target.columns }), ...file };
    case "json":
      return { ...generateJson(schema), ...file };
  }
}
