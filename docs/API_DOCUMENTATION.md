# API documentation

**There is no network API.** SchemaFlow exposes no endpoints and calls none. This page documents
what stands in for one: the internal module interfaces and the import/export formats. Signatures
are read from the source in `src/`; where it matters the file is named.

## Internal module interfaces

All of these are pure TypeScript with no React or browser imports.

| Module              | Function                                                             | Contract                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/parsers`       | `parseSchemaText(text, { format?, name?, now? })`                    | Single entry for the Import dialog. Detects the format (or takes `auto`, a dialect, or `prisma`) and returns `{ result, format, dialect? }`. Never throws. |
| `src/parsers`       | `parseSql(text, options)` / `parsePrisma(text, options)`             | Return an `ImportResult`: `{ ok, schema?, issues }`. Problems become `ImportIssue`s.                                                                       |
| `src/parsers`       | `detectFormat(text)`, `detectSqlDialect(text)`                       | Guess `sql` or `prisma`, and `postgresql`, `mysql` or `sqlite`.                                                                                            |
| `src/parsers`       | `decodeSchemaFile(bytes)`                                            | `{ ok: true, text }` or `{ ok: false, reason: "binary" }`.                                                                                                 |
| `src/domain/schema` | `normalizeSchema(draft)`                                             | Turns a `DraftSchema` into the one `Schema`, adding its own issues.                                                                                        |
| `src/domain/schema` | `validateSchema(schema)`                                             | Returns `ImportIssue[]`.                                                                                                                                   |
| `src/domain/schema` | `fingerprintSchema(schema)`                                          | Stable hash of the table structure.                                                                                                                        |
| `src/domain/schema` | `findPath(schema, from, to)`                                         | Shortest foreign-key path as `{ tables, hops }` (each hop says `references` or `referenced-by`), or `null`.                                                |
| `src/domain/search` | `getSearchIndex(schema)`                                             | Table and column index, cached per schema.                                                                                                                 |
| `src/analysis`      | `getSubjectAreas(schema)`                                            | Groups by schema name or name prefix (at least 3 tables) with an `other` catch-all, or `null`.                                                             |
| `src/analysis`      | `analyzeSchema(schema)`                                              | `HealthFinding[]` for four checks: missing primary key, unindexed foreign key, orphan table, naming style. Advice, not import errors.                      |
| `src/graph`         | `layoutWithDagre(schema, options)` / `layoutPacked(schema, options)` | Positions and edge routes. Packed is used for large, elongated schemas.                                                                                    |
| `src/graph`         | `schemaToFlow(schema, layout)`                                       | Builds React Flow nodes and edges from the schema, positions and collapse modes.                                                                           |
| `src/generators`    | `generateSchemaText(schema, target)`                                 | Text for a `GeneratorTarget` plus a file extension and MIME type.                                                                                          |
| `src/generators`    | `renderDiagramSvg(input)`                                            | The diagram as SVG, rendered without React Flow (used for image export).                                                                                   |

The architecture rule behind this table: parsers never touch React Flow, and the canvas never
touches parsers ([ARCHITECTURE](ARCHITECTURE.md)).

## Import formats

| Format                        | Notes                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL, MySQL, SQLite DDL | `CREATE TABLE`, `ALTER TABLE ... ADD CONSTRAINT`, indexes, enums where the dialect has them. Unsupported statements (views, functions) are skipped and reported as issues. |
| Prisma schema                 | Models, enums, relations; implicit many-to-many join tables become `implicit` tables.                                                                                      |

Limits: input over 5 MB is refused before it is read; binary files are rejected by
`decodeSchemaFile`. The text is parsed, never executed.

## Export formats

Produced by `generateSchemaText` (`GeneratorTarget`) and the image renderer:

| Target                                          | File        | Notes                                                                                                                                        |
| ----------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `{ kind: "sql", dialect }`                      | `.sql`      | DDL in the chosen dialect. Same dialect copies types as written; other dialects map types.                                                   |
| `{ kind: "prisma" }`                            | `.prisma`   | Prisma schema.                                                                                                                               |
| `{ kind: "mermaid", columns: "all" \| "keys" }` | `.mmd`      | Mermaid `erDiagram`.                                                                                                                         |
| `{ kind: "json" }`                              | `.json`     | Versioned: `format: "schemaflow-schema"`, `version: 1`. **Export only; there is no JSON importer.**                                          |
| Image                                           | SVG and PNG | Own SVG renderer ([ADR-027](development/ARCHITECTURE.md#adr-027--image-export-own-svg-renderer-instead-of-html-to-image-2026-11-19-p3-t03)). |

Every generator returns `{ text, warnings }`. Warnings list what the target could not express
exactly; the generators never throw and are tested to be deterministic
([ADR-028](development/ARCHITECTURE.md#adr-028--text-generators-sql-prisma-mermaid-json-with-warnings-and-fixed-point-tests-2026-11-19-p3-t04)).
