import type { Schema } from "./types";

/**
 * 53-bit string hash (cyrb53). Fast, dependency-free and stable across runs/browsers.
 * Not cryptographic — used only to key layout state to a schema's shape.
 */
export function hashString(input: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const value = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return value.toString(36);
}

/**
 * Stable fingerprint of a schema's shape: sorted table IDs, each with its sorted column names.
 * Independent of declaration order, types, import time and relationships, so a re-import of the
 * same tables restores the same saved layout.
 */
export function fingerprintSchema(schema: Pick<Schema, "tables">): string {
  const canonical = Object.values(schema.tables)
    .map(
      (t) =>
        `${t.id.toLowerCase()}(${t.columns
          .map((c) => c.name.toLowerCase())
          .sort()
          .join(",")})`,
    )
    .sort()
    .join(";");
  return `sf1-${hashString(canonical)}`;
}
