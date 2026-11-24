# Contributing

SchemaFlow is a solo portfolio project, and it is **closed**: Phases 1 to 4 are built and no further
work is planned ([ROADMAP](docs/ROADMAP.md)). Issues are welcome, for example a bug report or a
question about how something works. Pull requests may not be reviewed or merged, so open an issue
first. Forking is fine under the [MIT license](LICENSE).

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you open an issue

- Check [KNOWN_ISSUES](docs/KNOWN_ISSUES.md) and [KNOWN_LIMITATIONS](docs/KNOWN_LIMITATIONS.md).
  Three accessibility defects are open on purpose (QA-043, QA-044, QA-045).
- Say what you did, what you expected, and what happened. For an import problem, say the format
  (PostgreSQL, MySQL, SQLite or Prisma) and attach a small SQL or Prisma snippet that shows it.
  Don't attach a real production schema.

## If you fork and change code

Setup is in [ENVIRONMENT_SETUP](docs/ENVIRONMENT_SETUP.md): Node 22 or newer, `npm install`,
`npm run dev`.

Run `npm run check` before you commit. It runs typecheck, lint, tests and the production build, and
stops at the first failure. End-to-end tests (`npm run e2e`) are separate and need a served build
([TESTING](docs/TESTING.md)).

The rules that matter most:

- Strict TypeScript: no `any`, no `@ts-ignore`, no disabled lint rules without a written reason.
- `src/domain`, `src/graph`, `src/samples`, `src/parsers`, `src/analysis` and `src/generators` are
  pure TypeScript: no React, Next or browser imports.
- User data never crashes the app. Parsers return `ImportIssue`s and don't throw.
- Imported SQL is parsed as text and never executed, and schema data never leaves the browser.
  Changes that break either rule won't fit this project ([SECURITY](docs/SECURITY.md)).
- A new dependency needs a written reason first ([DEPENDENCIES](docs/DEPENDENCIES.md)).
- Keep tests next to the code, and keep controls keyboard reachable and labelled.

The full list is in [CODING_STANDARDS](docs/CODING_STANDARDS.md); the structure is in
[PROJECT_STRUCTURE](docs/PROJECT_STRUCTURE.md).
