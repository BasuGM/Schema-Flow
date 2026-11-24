# Backend architecture

**Not applicable: SchemaFlow has no backend.** There is no server, API, database, queue or hosted
service. The build output is a folder of static files (`out/`), and everything runs in the browser
tab. This page says why and where the usual backend topics live instead.

## Why there is no backend

- **Privacy.** Schemas can describe private systems. The imported SQL or Prisma text is parsed as
  text, never executed, and never leaves the browser.
- **Scope.** Sharing, accounts and sync are out of scope ([PROJECT_OVERVIEW](PROJECT_OVERVIEW.md#scope)).
- **Cost.** A server would add hosting, operations and a trust problem for no feature the app has.
- **Evidence it is enough.** Parsing about 1 MB of SQL takes roughly 0.1 s on an M1, so a worker or
  server round trip buys nothing
  ([ADR-014](development/ARCHITECTURE.md#adr-014--import-dialog-lazy-parsers-on-the-main-thread-no-web-worker-2026-11-16)).

## Where each backend topic lives instead

| Usual backend topic | In SchemaFlow                                                                                 | Page                                                |
| ------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Database            | The in-memory `Schema` model; layouts in localStorage; last import text in IndexedDB          | [DATABASE_DESIGN](DATABASE_DESIGN.md)               |
| API                 | Internal TypeScript module interfaces and import/export formats                               | [API_DOCUMENTATION](API_DOCUMENTATION.md)           |
| Authentication      | None                                                                                          | [AUTHENTICATION](AUTHENTICATION.md)                 |
| Business logic      | Pure TypeScript in `src/domain`, `src/parsers`, `src/graph`, `src/analysis`, `src/generators` | [ARCHITECTURE](ARCHITECTURE.md)                     |
| Caching             | `WeakMap` memoisation per schema, lazy parser chunk, browser storage                          | [CACHING_STRATEGY](CACHING_STRATEGY.md)             |
| Logging             | `ImportIssue`s, error boundaries, issues and health panels                                    | [LOGGING_AND_MONITORING](LOGGING_AND_MONITORING.md) |
| Deployment          | Static export, any static file host                                                           | [DEPLOYMENT](DEPLOYMENT.md)                         |

## The closest thing to a "backend layer"

The pure-TypeScript modules play that role. They import no React, Next or browser APIs (a rule in
CLAUDE.md, enforced by review and by tests running in plain Node), so they could be lifted into a
server or a worker unchanged. Data flows one way: parsers produce a draft, `normalizeSchema`
produces the `Schema`, and the UI only reads it ([DATA_FLOW](DATA_FLOW.md)).

## What it would take if a backend were ever needed

Only if a real feature required it (shared links, team workspaces, live introspection of a
database). The pure modules would move behind an API with little change; the decision to keep user
schemas off a server would have to be revisited first, because it is the main reason there is none.
Nothing of this is built or planned.
