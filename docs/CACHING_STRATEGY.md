# Caching strategy

There is no HTTP cache layer, CDN or server cache to tune. The app caches in three places inside
the browser: derived data in memory, the lazily loaded parser chunk, and saved state in browser
storage.

## 1. In-memory memoisation per schema

Derived structures are built once per `Schema` object and kept in a `WeakMap` keyed by that object.
When a new import replaces the schema, the old entries become unreachable and are garbage
collected, so there is no invalidation code and no leak.

| Cache         | File                                 | Holds                                                        |
| ------------- | ------------------------------------ | ------------------------------------------------------------ |
| Adjacency     | `src/domain/schema/selectors.ts`     | Table to neighbouring tables, for neighbourhood highlighting |
| Path edges    | `src/domain/schema/path.ts`          | Edges per table, for the path finder                         |
| Table details | `src/domain/schema/table-details.ts` | Relation indexes for the inspector                           |
| Search index  | `src/domain/search/search-index.ts`  | Table and column entries for search                          |
| Subject areas | `src/analysis/subject-areas.ts`      | Grouping result (or `null`)                                  |
| Edge ends     | `src/graph/handles.ts`               | Which columns each edge connects, for handle placement       |

This works because the `Schema` is treated as immutable: it is replaced, never edited.

## 2. Lazy parser chunk

The SQL and Prisma parsers (about 35 KB raw, 12 KB gzip) are not in the initial bundle. They load
with a dynamic `import()` the first time the Import dialog needs them, and the promise is reused
afterwards
([ADR-014](development/ARCHITECTURE.md#adr-014--import-dialog-lazy-parsers-on-the-main-thread-no-web-worker-2026-11-16)).
Sizes are from that ADR's measurement and will drift as code changes.

## 3. Browser storage

Layouts (localStorage, per fingerprint, at most 20, least recently used evicted) and the last
import's text (IndexedDB) act as a cache of the user's work. A saved layout is reused only if it
validates; otherwise layout runs again. Details and keys:
[DATABASE_DESIGN](DATABASE_DESIGN.md#browser-storage),
[ADR-025](development/ARCHITECTURE.md#adr-025--layout-persistence-per-fingerprint-localstorage-keys-2026-11-19-p3-t01).

## Rendering caches

React Flow `nodeTypes` and `edgeTypes` are module-scope and node components are wrapped in `memo`,
so unrelated store updates do not re-render every table. Stores use narrow selectors
([FRONTEND_ARCHITECTURE](FRONTEND_ARCHITECTURE.md)).

## Not present

No service worker, no offline cache, no server or CDN cache rules of our own (a static host applies
its own defaults to `out/`; see [DEPLOYMENT](DEPLOYMENT.md)). If the app were hosted, fingerprinted
asset files from the Next.js build could be cached long-term; that is a hosting setting, not code
in this repo.
