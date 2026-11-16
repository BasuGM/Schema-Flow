import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeSchemaFile } from "./decode-file";
import { parseSchemaText } from "./parse-schema-text";

const utf8 = (s: string) => new TextEncoder().encode(s);
function utf16(s: string, bigEndian: boolean): Uint8Array {
  const out = new Uint8Array(2 + s.length * 2);
  out.set(bigEndian ? [0xfe, 0xff] : [0xff, 0xfe]);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[2 + i * 2] = bigEndian ? c >> 8 : c & 0xff;
    out[3 + i * 2] = bigEndian ? c & 0xff : c >> 8;
  }
  return out;
}

describe("decodeSchemaFile", () => {
  const sql = "CREATE TABLE ünïcode (id int);";

  it("reads UTF-8 with and without a BOM", () => {
    expect(decodeSchemaFile(utf8(sql))).toEqual({ ok: true, text: sql });
    expect(decodeSchemaFile(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8(sql)]))).toEqual({
      ok: true,
      text: sql,
    });
  });

  it("reads UTF-16 LE and BE files by their byte-order mark", () => {
    expect(decodeSchemaFile(utf16(sql, false))).toEqual({ ok: true, text: sql });
    expect(decodeSchemaFile(utf16(sql, true))).toEqual({ ok: true, text: sql });
  });

  it("rejects gzip, zip and NUL-containing files as binary", () => {
    const binary = { ok: false, reason: "binary" };
    expect(decodeSchemaFile(new Uint8Array([0x1f, 0x8b, 8, 0]))).toEqual(binary);
    expect(decodeSchemaFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 20]))).toEqual(binary);
    expect(decodeSchemaFile(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 13]))).toEqual(binary);
    // UTF-16 without a BOM decodes as UTF-8 with NULs between characters → binary, not garbage.
    expect(decodeSchemaFile(utf16(sql, false).slice(2))).toEqual(binary);
  });

  it("decodes the UTF-16 LE fixture into importable SQL", () => {
    const bytes = readFileSync(
      new URL("../../tests/fixtures/sql/utf16le.postgres.sql", import.meta.url),
    );
    expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xfe]);
    const decoded = decodeSchemaFile(new Uint8Array(bytes));
    expect(decoded.ok).toBe(true);
    const { result } = parseSchemaText(decoded.ok ? decoded.text : "");
    expect(result.ok).toBe(true);
    expect(result.schema?.tableOrder).toEqual(["public.café", "public.crème"]);
    expect(Object.keys(result.schema?.relationships ?? {})).toHaveLength(1);
  });
});
