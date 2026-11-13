import type { DataType } from "./types";

/**
 * Splits a raw type string into base name, params and array flag.
 * `numeric(10, 2)` → { base: "numeric", params: ["10", "2"] }; `text[]` → { base: "text", isArray }.
 * Never throws: unrecognised input becomes `{ raw, base: raw.toLowerCase() }`.
 */
export function parseDataType(
  raw: string,
  enumNames?: (name: string) => string | undefined,
): DataType {
  const trimmed = raw.trim();
  let rest = trimmed;
  let isArray = false;
  while (rest.endsWith("[]")) {
    isArray = true;
    rest = rest.slice(0, -2).trimEnd();
  }

  let params: string[] | undefined;
  const open = rest.indexOf("(");
  if (open > 0 && rest.endsWith(")")) {
    params = rest
      .slice(open + 1, -1)
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    rest = rest.slice(0, open).trimEnd();
  }

  const base = rest.replace(/\s+/g, " ").toLowerCase();
  const type: DataType = { raw: trimmed, base };
  if (params && params.length > 0) type.params = params;
  if (isArray) type.isArray = true;
  const enumName = enumNames?.(rest);
  if (enumName) type.enumName = enumName;
  return type;
}
