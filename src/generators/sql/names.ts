import type { SqlDialect } from "@/domain/schema/types";

/**
 * Hands out names that are unique within a scope (an index namespace, a database, a table). A clash
 * gets a numeric suffix, so output is deterministic. Case-insensitive for MySQL and SQLite, whose
 * identifiers are; case-sensitive for PostgreSQL.
 */
export function createNameRegistry(dialect: SqlDialect) {
  const used = new Map<string, Set<string>>();
  const fold = (s: string) => (dialect === "postgresql" ? s : s.toLowerCase());
  return {
    claim(scope: string, wanted: string): { name: string; renamed: boolean } {
      let set = used.get(scope);
      if (!set) used.set(scope, (set = new Set()));
      let name = wanted;
      for (let n = 2; set.has(fold(name)); n++) name = `${wanted}_${n}`;
      set.add(fold(name));
      return { name, renamed: name !== wanted };
    },
  };
}
export type NameRegistry = ReturnType<typeof createNameRegistry>;
