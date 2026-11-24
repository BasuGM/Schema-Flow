# Security

SchemaFlow has no server, no accounts and no network calls with user data
([AUTHENTICATION](AUTHENTICATION.md), [BACKEND_ARCHITECTURE](BACKEND_ARCHITECTURE.md)). The threat
model is therefore small: a browser tab that reads untrusted text and keeps a little of it in browser
storage.

## Assets and boundaries

- **Asset:** the user's schema text. It is parsed in the tab and never leaves the browser.
- **Untrusted input:** SQL or Prisma text pasted or loaded from a file, including names and comments
  inside it.
- **Trust boundary:** the import dialog. Everything after `normalizeSchema` works on a typed
  `Schema` object ([DATA_FLOW](DATA_FLOW.md)).

## Threats and what is done

| Threat                                             | What the app does                                                                                                                                                                                                                                                                                                | Where                                                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Imported SQL runs something                        | SQL is read as text by hand-written parsers; nothing is executed, evaluated or sent to a database. No `eval`, no `new Function`, no `dangerouslySetInnerHTML` in `src`.                                                                                                                                          | [ADR-012](development/ARCHITECTURE.md#adr-012--hand-written-tolerant-ddl-parser-instead-of-node-sql-parser-2026-11-13)                        |
| Huge input freezes the tab                         | Files over 5 MB are refused with a message (`MAX_IMPORT_BYTES`). Restored source text over 5 million characters is ignored.                                                                                                                                                                                      | `src/components/import/import-draft.ts`, `src/stores/session-persistence.ts`                                                                  |
| Regex backtracking on crafted text (QA-013)        | Cowork found that about 1 MB of blank lines hung the tab (`^\s*` under the multiline flag backtracks quadratically). Fixed by using `[ \t]` in line-anchored patterns, with every regex in `src/parsers` audited. Wall-clock tests keep it fixed (`whitespace-performance.test.ts`, budgets of 100 ms to 1 s).   | [QA_LOG](development/QA_LOG.md#2026-11-16--cowork-re-verification-round-7-at-3a17db4-p2-t05-all-pass-qa-013)                                  |
| Script injection through table or column names     | React escapes text it renders. Generated text exports (SQL, Prisma, Mermaid, JSON) escape every user string, tested with a name containing quotes, a backtick, a backslash, a newline and comment openers (`src/test/hostile-schema.ts`). The SVG image export escapes XML characters (`src/generators/xml.ts`). | [ADR-028](development/ARCHITECTURE.md#adr-028--text-generators-sql-prisma-mermaid-json-with-warnings-and-fixed-point-tests-2026-11-19-p3-t04) |
| Malformed input crashes the app                    | Parsers return `ImportIssue`s and never throw. Each region has an error boundary, so a render failure shows a local message and the rest keeps working ([ERROR_HANDLING](ERROR_HANDLING.md)).                                                                                                                    | ADR-020                                                                                                                                       |
| Corrupt or hand-edited saved data                  | Saved layouts and the saved source record are validated before use; invalid data is dropped and the app starts fresh.                                                                                                                                                                                            | `src/stores/layout-persistence.ts`, `src/stores/session-persistence.ts`                                                                       |
| Another person on a shared machine reads the saved | The last import's text and the layouts stay in this browser profile, unencrypted. **Clear saved data** in the app removes them. There is no way to protect them from someone with access to the profile.                                                                                                         | [DATABASE_DESIGN](DATABASE_DESIGN.md#browser-storage)                                                                                         |
| Vulnerable dependencies                            | Few runtime dependencies ([DEPENDENCIES](DEPENDENCIES.md)). There is no server-side code to attack, but a compromised build dependency could still end up in the bundle. `npm audit` is not part of `npm run check`.                                                                                             | `package.json`                                                                                                                                |

## Not covered

- **No security headers.** The output is static files (`out/`). A host would set its own
  Content-Security-Policy and headers; the repo sets none ([DEPLOYMENT](DEPLOYMENT.md)).
- **No third-party scripts, analytics or web fonts.** The app code loads nothing from other origins and uses system fonts.
- **No penetration test.** The checks above are unit tests, the Cowork rounds and axe. Nobody has
  audited the app as an attacker.
- **Schema content is not secret-scanned.** A DDL file can contain sensitive names or comments; the
  app does not detect or redact them, and exported files contain whatever the schema contains.

## Reporting a problem

Open a GitHub issue ([CONTRIBUTING](../CONTRIBUTING.md)). There is nothing server-side to disclose
privately, but for something sensitive, contact the maintainer through GitHub.
