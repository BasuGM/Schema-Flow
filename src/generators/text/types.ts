import type { SqlDialect } from "@/domain/schema/types";

/** Generated text plus what could not be expressed exactly in the target. Never throws. */
export interface GeneratedText {
  text: string;
  /** Human-readable, de-duplicated and sorted, so the output is deterministic. */
  warnings: string[];
}

export type GeneratorTarget =
  | { kind: "sql"; dialect: SqlDialect }
  | { kind: "prisma" }
  | { kind: "mermaid"; columns: "all" | "keys" }
  | { kind: "json" };

export type TextExtension = "sql" | "prisma" | "mmd" | "json";

export interface TargetFile {
  extension: TextExtension;
  mime: string;
}

export function targetFile(target: GeneratorTarget): TargetFile {
  switch (target.kind) {
    case "sql":
      return { extension: "sql", mime: "application/sql" };
    case "prisma":
      return { extension: "prisma", mime: "text/plain" };
    case "mermaid":
      return { extension: "mmd", mime: "text/vnd.mermaid" };
    case "json":
      return { extension: "json", mime: "application/json" };
  }
}

/** Collects warnings; `list()` is de-duplicated and sorted. */
export function createWarnings() {
  const seen = new Set<string>();
  return {
    add(message: string) {
      seen.add(message);
    },
    list(): string[] {
      return [...seen].sort();
    },
  };
}
export type Warnings = ReturnType<typeof createWarnings>;
