import { describe, expect, it } from "vitest";
import { parseColumn } from "./parse-column";
import { TokenStream } from "./token-stream";
import { tokenize } from "./tokenizer";

function column(def: string, dialect: "postgresql" | "mysql" | "sqlite" = "postgresql") {
  const { tokens } = tokenize(def, dialect);
  const ts = new TokenStream(tokens, def);
  const parsed = parseColumn(ts);
  expect(ts.done).toBe(true);
  return parsed;
}

describe("parseColumn", () => {
  it("parses enum-typed columns that node-sql-parser rejected (ADR-012)", () => {
    expect(column("status order_status NOT NULL DEFAULT 'pending'").column).toEqual({
      name: "status",
      type: "order_status",
      nullable: false,
      default: { kind: "literal", value: "'pending'" },
    });
    expect(column('status public."order_status"').column.type).toBe("order_status");
  });

  it("parses identity columns and REFERENCES without a column list", () => {
    expect(
      column("id bigint GENERATED ALWAYS AS IDENTITY (START WITH 10) PRIMARY KEY").column,
    ).toEqual({
      name: "id",
      type: "bigint",
      default: { kind: "autoincrement", value: "identity" },
      primaryKey: true,
    });
    expect(
      column("user_id int REFERENCES public.users ON DELETE CASCADE").column.references,
    ).toEqual({
      table: "users",
      schemaName: "public",
      onDelete: "cascade",
    });
  });

  it.each([
    ["double precision", "double precision"],
    ["timestamp(3) with time zone", "timestamp(3) with time zone"],
    ["character varying(20)", "character varying(20)"],
    ["numeric(10, 2)", "numeric(10, 2)"],
    ["text[]", "text[]"],
    ["integer[3]", "integer[]"],
    ["int ARRAY", "int[]"],
    ["serial", "serial"],
  ])("reads the multi-part type %s", (type, expected) => {
    expect(column(`c ${type}`).column.type).toBe(expected);
  });

  it("marks serial columns as autoincrement", () => {
    expect(column("id serial").column.default?.kind).toBe("autoincrement");
  });

  it("parses named constraints, checks and full reference actions", () => {
    const { column: c, checks } = column(
      "qty int CONSTRAINT qty_pos CHECK (qty > 0) CONSTRAINT fk REFERENCES t (id) ON UPDATE SET NULL ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED",
    );
    expect(checks).toEqual([{ name: "qty_pos", expression: "qty > 0" }]);
    expect(c.references).toEqual({
      name: "fk",
      table: "t",
      columns: ["id"],
      onUpdate: "set null",
      onDelete: "no action",
    });
  });

  it("parses MySQL column options", () => {
    const { column: c } = column(
      "`price` decimal(10,2) unsigned NOT NULL DEFAULT '0.00' COMMENT 'net; excl. tax' ON UPDATE CURRENT_TIMESTAMP",
      "mysql",
    );
    expect(c).toMatchObject({
      name: "price",
      type: "decimal(10,2) unsigned",
      nullable: false,
      comment: "net; excl. tax",
    });
    expect(column("id int AUTO_INCREMENT PRIMARY KEY", "mysql").column.default?.kind).toBe(
      "autoincrement",
    );
    expect(column("s enum('a','b') DEFAULT 'a'", "mysql").column.type).toBe("enum('a','b')");
  });

  it("parses SQLite AUTOINCREMENT and columns without a type", () => {
    expect(column("id INTEGER PRIMARY KEY AUTOINCREMENT", "sqlite").column).toMatchObject({
      primaryKey: true,
      default: { kind: "autoincrement" },
    });
    expect(column("anything NOT NULL", "sqlite").column).toEqual({
      name: "anything",
      type: "",
      nullable: false,
    });
  });

  it("skips constructs it does not model instead of failing", () => {
    expect(column('c text COLLATE "C" STORAGE EXTERNAL COMPRESSION lz4 NOT NULL').column).toEqual({
      name: "c",
      type: "text",
      nullable: false,
    });
    expect(
      column("total numeric GENERATED ALWAYS AS (price * qty) STORED").column.default,
    ).toBeUndefined();
  });
});
