/** Result of turning a file's bytes into schema text. */
export type DecodedFile = { ok: true; text: string } | { ok: false; reason: "binary" };

const startsWith = (bytes: Uint8Array, magic: number[]) => magic.every((b, i) => bytes[i] === b);

/**
 * Decodes an imported file. UTF-16 files (common for SQL Server Management Studio and other
 * Windows exports) are recognised by their byte-order mark; everything else is read as UTF-8 (the
 * decoder drops a UTF-8 BOM). Compressed archives and files with NUL characters are rejected as
 * binary instead of being parsed into noise. `TextDecoder` is standard in browsers and Node.
 */
export function decodeSchemaFile(bytes: Uint8Array): DecodedFile {
  if (startsWith(bytes, [0x1f, 0x8b]) || startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]))
    return { ok: false, reason: "binary" };
  const encoding = startsWith(bytes, [0xff, 0xfe])
    ? "utf-16le"
    : startsWith(bytes, [0xfe, 0xff])
      ? "utf-16be"
      : "utf-8";
  const text = new TextDecoder(encoding).decode(bytes);
  if (text.includes("\0")) return { ok: false, reason: "binary" };
  return { ok: true, text };
}
