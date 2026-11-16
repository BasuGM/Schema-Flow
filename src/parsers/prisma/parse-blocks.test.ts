import { describe, expect, it } from "vitest";
import { lexPrisma } from "./lexer";
import { parsePrismaBlocks, type PrismaBlock } from "./parse-blocks";

function parse(src: string): { blocks: PrismaBlock[]; warnings: string[] } {
  const warnings: string[] = [];
  const blocks = parsePrismaBlocks(lexPrisma(src).tokens, (m, line) =>
    warnings.push(`${line}: ${m}`),
  );
  return { blocks, warnings };
}

describe("parsePrismaBlocks", () => {
  it("parses fields with modifiers, attributes and keyed/positional arguments", () => {
    const { blocks, warnings } = parse(`model Post {
  id     String  @id @default(uuid())
  tags   String[]
  author User?   @relation("Writes", fields: [authorId], references: [id], onDelete: Cascade)
  geo    Unsupported("point")?
  @@index([authorId, title(sort: Desc)], map: "idx")
}`);
    expect(warnings).toEqual([]);
    const [block] = blocks;
    expect(block).toMatchObject({ keyword: "model", name: "Post", line: 1 });
    expect(block!.members).toHaveLength(5);
    expect(block!.members[1]).toMatchObject({
      kind: "field",
      name: "tags",
      type: "String",
      list: true,
    });
    expect(block!.members[2]).toMatchObject({
      kind: "field",
      optional: true,
      attributes: [
        {
          name: "relation",
          args: [
            { value: { kind: "string", value: "Writes" } },
            {
              key: "fields",
              value: { kind: "array", items: [{ kind: "ident", value: "authorId" }] },
            },
            { key: "references" },
            { key: "onDelete", value: { kind: "ident", value: "Cascade" } },
          ],
        },
      ],
    });
    expect(block!.members[3]).toMatchObject({
      type: "Unsupported",
      optional: true,
      typeArgs: [{ value: { kind: "string", value: "point" } }],
    });
    expect(block!.members[4]).toMatchObject({ kind: "blockAttribute", line: 6 });
  });

  it("reads datasource assignments and enum values", () => {
    const { blocks } = parse(`datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}
enum Role {
  ADMIN
  USER @map("user")
}`);
    expect(blocks[0]!.members[0]).toMatchObject({ kind: "assignment", key: "provider" });
    expect(blocks[1]!.members.map((m) => m.kind)).toEqual(["enumValue", "enumValue"]);
  });

  it("attaches /// comments to the block and to fields (leading or trailing)", () => {
    const { blocks } = parse(`/// Users.
model User {
  /// Primary key.
  id Int @id
  name String /// Display name.
}`);
    expect(blocks[0]!.doc).toBe("Users.");
    expect(blocks[0]!.members.map((m) => (m.kind === "field" ? m.doc : undefined))).toEqual([
      "Primary key.",
      "Display name.",
    ]);
  });

  it("keeps multi-line attribute arguments together", () => {
    const { blocks, warnings } = parse(`model T {
  a Int
  @@index([
    a
  ], map: "i")
}`);
    expect(warnings).toEqual([]);
    expect(blocks[0]!.members).toHaveLength(2);
  });

  it("skips a bad line without losing the following ones, even with an unclosed '('", () => {
    const { blocks, warnings } = parse(`model T {
  a Int @default(
  b Int
  c Int ]
}`);
    expect(blocks[0]!.members.map((m) => (m.kind === "field" ? m.name : m.kind))).toEqual(["b"]);
    expect(warnings).toEqual([
      '2: Could not parse a line in model "T": Expected a value. The line was skipped.',
      '4: Could not parse a line in model "T": Expected the end of the line, found "]". The line was skipped.',
    ]);
  });

  it("reports unknown blocks, stray lines and a missing closing brace", () => {
    const { blocks, warnings } = parse(`modle X {
  id Int
}
stray tokens here
model Y {
  id Int`);
    expect(blocks.map((b) => b.name)).toEqual(["Y"]);
    expect(warnings).toEqual([
      '1: Unknown block "modle X" was skipped.',
      '4: Expected a block such as "model Name {", found "stray". The line was skipped.',
      '5: Block "Y" is missing a closing "}".',
    ]);
  });
});
