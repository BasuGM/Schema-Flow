// Text export from the command line (P3-T04): reads a SQL or Prisma file, detects its format and
// prints the chosen export to stdout. Warnings and import issues go to stderr. Exit code: 0 ok,
// 1 the file could not be read or parsed into a schema, 2 usage.
//
// Run with plain Node (≥ 22.18, TypeScript type stripping is built in; no dependency). The small
// resolve hook maps the project's `@/…` alias and extensionless imports to `src/`:
//
//   node --import ./scripts/headless/alias-hook.mjs scripts/headless/generate.ts \
//     <fixture-path> <postgres|mysql|sqlite|prisma|mermaid|mermaid-keys|json>
//
// The built-in sample the app loads can be used instead of a file, so a download from the app can be
// compared byte for byte (P3-T05): `--sample` is the e-commerce sample, and
// `--sample="sample=synthetic&tables=50&seed=7"` mirrors the app's `?sample=…` URL.
//
// Example (run the SQLite output in sqlite3):
//   node --import ./scripts/headless/alias-hook.mjs scripts/headless/generate.ts \
//     tests/fixtures/sql/ecommerce.postgres.sql sqlite 2>/dev/null | sqlite3 :memory: ".tables"
import { readFileSync } from "node:fs";
import { generateSchemaText, type GeneratorTarget } from "@/generators";
import { decodeSchemaFile, parseSchemaText } from "@/parsers";
import { createSample, parseSampleRequest } from "@/samples/resolve-sample";

const TARGETS: Record<string, GeneratorTarget> = {
  postgres: { kind: "sql", dialect: "postgresql" },
  postgresql: { kind: "sql", dialect: "postgresql" },
  mysql: { kind: "sql", dialect: "mysql" },
  sqlite: { kind: "sql", dialect: "sqlite" },
  prisma: { kind: "prisma" },
  mermaid: { kind: "mermaid", columns: "all" },
  "mermaid-keys": { kind: "mermaid", columns: "keys" },
  json: { kind: "json" },
};

const [path, name] = process.argv.slice(2);
const sampleQuery = path?.startsWith("--sample") ? path.slice("--sample=".length) : null;
const target = name ? TARGETS[name] : undefined;
if (!path || !target) {
  console.error(`Usage: generate.ts <file> <${Object.keys(TARGETS).join("|")}>`);
  process.exit(2);
}

let schema;
if (sampleQuery !== null) {
  schema = createSample(parseSampleRequest(sampleQuery));
  console.error(`Using the built-in sample (${schema.tableOrder.length} tables).`);
} else {
  const decoded = decodeSchemaFile(readFileSync(path!));
  if (!decoded.ok) {
    console.error(`Cannot read ${path}: ${decoded.reason} file.`);
    process.exit(1);
  }
  const { result, format } = parseSchemaText(decoded.text, {
    now: () => "2026-01-01T00:00:00.000Z",
  });
  schema = result.schema;
  if (!schema) {
    for (const issue of result.issues) console.error(`${issue.severity}: ${issue.message}`);
    process.exit(1);
  }
  const counts = { error: 0, warning: 0 };
  for (const issue of result.issues) counts[issue.severity]++;
  console.error(
    `Read ${schema.tableOrder.length} tables as ${format}` +
      `${schema.source.dialect ? ` (${schema.source.dialect})` : ""}; ` +
      `${counts.error} import errors, ${counts.warning} import warnings.`,
  );
}

const out = generateSchemaText(schema, target);
process.stdout.write(out.text);
for (const warning of out.warnings) console.error(`warning: ${warning}`);
console.error(`${out.warnings.length} export warnings.`);
