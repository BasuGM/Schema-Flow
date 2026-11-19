import { describe, expect, it } from "vitest";
import { normalizeSchema } from "@/domain/schema/normalize";
import { draft } from "@/domain/schema/test-helpers";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { hostileSchema, HOSTILE } from "@/test/hostile-schema";
import { generateJson, JSON_FORMAT, JSON_VERSION } from "./generate-json";
import { generateMermaid } from "./generate-mermaid";

const blog = () =>
  normalizeSchema(
    draft(
      [
        {
          name: "users",
          columns: [
            { name: "id", type: "bigint", nullable: false, primaryKey: true },
            { name: "email", type: "varchar(255)", nullable: false, unique: true },
          ],
        },
        {
          name: "posts",
          columns: [
            { name: "id", type: "bigint", nullable: false, primaryKey: true },
            {
              name: "user_id",
              type: "bigint",
              nullable: false,
              comment: 'owner "author"',
              references: { table: "users", columns: ["id"] },
            },
            { name: "price", type: "numeric(10, 2)" },
          ],
        },
        {
          name: "profiles",
          columns: [
            { name: "id", type: "bigint", nullable: false, primaryKey: true },
            {
              name: "user_id",
              type: "bigint",
              unique: true,
              references: { table: "users", columns: ["id"] },
            },
          ],
        },
      ],
      { name: "blog" },
    ),
  );

const emptySchema = () => normalizeSchema(draft([]));
const noPkOnly = () =>
  normalizeSchema(draft([{ name: "logs", columns: [{ name: "message", type: "text" }] }]));

describe("generateMermaid", () => {
  it("draws entities, keys, comments and relationships", () => {
    const { text, warnings } = generateMermaid(blog(), { columns: "all" });
    expect(warnings).toEqual([]);
    expect(text).toBe(
      [
        "erDiagram",
        "    users {",
        "        bigint id PK",
        "        varchar(255) email UK",
        "    }",
        "    posts {",
        "        bigint id PK",
        "        bigint user_id FK \"owner 'author'\"",
        "        numeric(10_2) price",
        "    }",
        "    profiles {",
        "        bigint id PK",
        "        bigint user_id FK, UK",
        "    }",
        '    users ||--o{ posts : "user_id"',
        '    users |o--o| profiles : "user_id"',
        "",
      ].join("\n"),
    );
  });

  it("keeps only key columns in keys mode, and a bare entity when none remain", () => {
    const { text } = generateMermaid(blog(), { columns: "keys" });
    expect(text).not.toContain("email");
    expect(text).not.toContain("price");
    const only = generateMermaid(noPkOnly(), { columns: "keys" }).text;
    expect(only).toBe("erDiagram\n    logs\n");
  });

  it("emits a well-formed line for every table and relationship of the ecommerce sample", () => {
    const schema = createEcommerceSchema();
    const { text } = generateMermaid(schema, { columns: "all" });
    const entity = String.raw`(?:[A-Za-z_][A-Za-z0-9_-]*|"[^"\n]+")`;
    const shapes = [
      /^erDiagram$/,
      new RegExp(String.raw`^    ${entity} \{$`),
      new RegExp(String.raw`^    ${entity}$`),
      /^    \}$/,
      /^ {8}[a-z][a-z0-9_\-()[\]]* [A-Za-z_][A-Za-z0-9_-]*(?: (?:PK|FK|UK)(?:, (?:PK|FK|UK))*)?(?: "[^"\n]*")?$/,
      new RegExp(String.raw`^    ${entity} (?:\|\||\|o)--(?:o\{|o\|) ${entity} : "[^"\n]+"$`),
    ];
    const lines = text.trimEnd().split("\n");
    for (const line of lines) {
      expect(
        shapes.some((re) => re.test(line)),
        `unexpected line: ${line}`,
      ).toBe(true);
    }
    expect(lines.filter((l) => / \{$/.test(l))).toHaveLength(schema.tableOrder.length);
    expect(lines.filter((l) => / : "/.test(l))).toHaveLength(
      Object.keys(schema.relationships).length,
    );
  });

  it("is deterministic", () => {
    const s = createEcommerceSchema();
    expect(generateMermaid(s, { columns: "all" })).toEqual(generateMermaid(s, { columns: "all" }));
  });

  it("removes quotes and newlines from hostile names, comments and labels", () => {
    const { text } = generateMermaid(hostileSchema(), { columns: "all" });
    for (const line of text.trimEnd().split("\n")) {
      expect(line.split('"').length % 2, `unbalanced quotes: ${line}`).toBe(1);
    }
    expect(text).not.toContain(HOSTILE);
  });

  it("keeps clashing entity names apart and says so", () => {
    const s = normalizeSchema(
      draft([
        { name: "a b", columns: [{ name: "id", type: "int" }] },
        { name: "a  b", columns: [{ name: "id", type: "int" }] },
      ]),
    );
    const { text, warnings } = generateMermaid(s, { columns: "all" });
    expect(text.match(/^ {4}"a b(?:_2)?" \{$/gm)).toHaveLength(2);
    expect(warnings).toHaveLength(1);
  });

  it("returns a valid diagram for an empty schema and for a table without a key", () => {
    expect(generateMermaid(emptySchema(), { columns: "all" })).toEqual({
      text: "erDiagram\n",
      warnings: [],
    });
    expect(generateMermaid(noPkOnly(), { columns: "all" }).text).toBe(
      "erDiagram\n    logs {\n        text message\n    }\n",
    );
  });
});

describe("generateJson", () => {
  it("is versioned, deterministic and has no issues", () => {
    const s = createEcommerceSchema();
    const a = generateJson(s);
    expect(generateJson(s)).toEqual(a);
    const doc = JSON.parse(a.text);
    expect(doc.format).toBe(JSON_FORMAT);
    expect(doc.version).toBe(JSON_VERSION);
    expect("issues" in doc).toBe(false);
    expect(a.warnings).toEqual([]);
    expect(a.text.endsWith("}\n")).toBe(true);
  });

  it("lists tables in declaration order with column names, and every relationship", () => {
    const s = createEcommerceSchema();
    const doc = JSON.parse(generateJson(s).text);
    expect(doc.tables.map((t: { id: string }) => t.id)).toEqual(s.tableOrder);
    expect(doc.relationships).toHaveLength(Object.keys(s.relationships).length);
    const orders = doc.tables.find((t: { id: string }) => t.id === "public.orders");
    expect(orders.columns.map((c: { name: string }) => c.name)).toEqual(
      s.tables["public.orders"]!.columns.map((c) => c.name),
    );
    const fk = doc.relationships.find(
      (r: { from: { table: string; columns: string[] } }) =>
        r.from.table === "public.orders" && r.from.columns[0] === "user_id",
    );
    expect(fk.to).toEqual({ table: "public.users", columns: ["id"] });
    expect(doc.enums.length).toBe(Object.keys(s.enums).length);
  });

  it("keeps hostile strings intact through JSON", () => {
    const s = hostileSchema();
    const doc = JSON.parse(generateJson(s).text);
    expect(doc.name).toBe(s.name);
    expect(doc.tables[0].comment).toContain(HOSTILE);
    expect(doc.enums[0].values[0]).toContain(HOSTILE);
  });

  it("is valid for an empty schema and a table without a key", () => {
    expect(JSON.parse(generateJson(emptySchema()).text)).toMatchObject({
      tables: [],
      relationships: [],
      enums: [],
    });
    const doc = JSON.parse(generateJson(noPkOnly()).text);
    expect(doc.tables[0].primaryKey).toBeUndefined();
  });
});
