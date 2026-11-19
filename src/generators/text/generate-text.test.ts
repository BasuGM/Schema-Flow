import { describe, expect, it } from "vitest";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { exportFileName } from "../raster-size";
import { generateSchemaText } from "./generate-text";
import type { GeneratorTarget } from "./types";

const TARGETS: [GeneratorTarget, string, string, RegExp][] = [
  [{ kind: "sql", dialect: "postgresql" }, "sql", "application/sql", /^-- SchemaFlow export/],
  [{ kind: "sql", dialect: "mysql" }, "sql", "application/sql", /CREATE TABLE users/],
  [{ kind: "sql", dialect: "sqlite" }, "sql", "application/sql", /AUTOINCREMENT/],
  [{ kind: "prisma" }, "prisma", "text/plain", /^\/\/ SchemaFlow export[\s\S]*model Users/],
  [{ kind: "mermaid", columns: "all" }, "mmd", "text/vnd.mermaid", /^erDiagram\n/],
  [{ kind: "json" }, "json", "application/json", /^\{\n {2}"format": "schemaflow-schema"/],
];

describe("generateSchemaText", () => {
  for (const [target, extension, mime, shape] of TARGETS) {
    it(`${target.kind}${"dialect" in target ? ` (${target.dialect})` : ""}: text, extension and MIME type`, () => {
      const out = generateSchemaText(createEcommerceSchema(), target);
      expect(out.extension).toBe(extension);
      expect(out.mime).toBe(mime);
      expect(out.text).toMatch(shape);
      expect(out.text.endsWith("\n")).toBe(true);
      expect(Array.isArray(out.warnings)).toBe(true);
      expect(exportFileName("My shop", out.extension)).toBe(`my-shop.${extension}`);
    });
  }
});
