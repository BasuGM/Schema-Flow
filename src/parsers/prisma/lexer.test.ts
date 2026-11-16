import { describe, expect, it } from "vitest";
import { lexPrisma } from "./lexer";

const kinds = (src: string) => lexPrisma(src).tokens.map((t) => `${t.kind}:${t.value}`);

describe("lexPrisma", () => {
  it("produces identifiers, strings, numbers, punctuation and line breaks", () => {
    expect(kinds('id Int @id @default(-1.5) @db.VarChar(255)\n@@map("users")')).toEqual([
      "ident:id",
      "ident:Int",
      "punct:@",
      "ident:id",
      "punct:@",
      "ident:default",
      "punct:(",
      "number:-1.5",
      "punct:)",
      "punct:@",
      "ident:db",
      "punct:.",
      "ident:VarChar",
      "punct:(",
      "number:255",
      "punct:)",
      "nl:\n",
      "punct:@@",
      "ident:map",
      "punct:(",
      "string:users",
      "punct:)",
    ]);
  });

  it("drops // comments, keeps /// doc comments, and treats U+FEFF as whitespace", () => {
    expect(kinds("﻿a // note\n/// Doc text\nb")).toEqual([
      "ident:a",
      "nl:\n",
      "doc:Doc text",
      "nl:\n",
      "ident:b",
    ]);
  });

  it("unescapes strings and ends an unterminated string at the line break", () => {
    const { tokens, issues } = lexPrisma('"a\\"b" "open\nnext');
    expect(tokens.map((t) => [t.kind, t.value, t.line])).toEqual([
      ["string", 'a"b', 1],
      ["string", "open", 1],
      ["nl", "\n", 1],
      ["ident", "next", 2],
    ]);
    expect(issues).toEqual([{ severity: "warning", message: "Unterminated string.", line: 1 }]);
  });
});
