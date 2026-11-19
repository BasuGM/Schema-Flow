/** Characters XML 1.0 forbids: most C0 controls, U+FFFE/U+FFFF and unpaired surrogates. */
const INVALID_XML =
  // eslint-disable-next-line no-control-regex -- the point is to match control characters
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Makes any user string safe as XML text or a double-quoted attribute value. */
export function xmlText(value: string): string {
  return value.replace(INVALID_XML, "").replace(/[&<>"']/g, (c) => ENTITIES[c]!);
}
