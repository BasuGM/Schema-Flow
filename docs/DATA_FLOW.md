# Data flow

How data moves through SchemaFlow, as sequence diagrams. The static pipeline diagram is in
[diagrams/data-flow.md](diagrams/data-flow.md); the overview is [ARCHITECTURE](ARCHITECTURE.md).
Nothing here crosses a network: every arrow stays inside the browser tab.

## Import to render

```mermaid
sequenceDiagram
  actor User
  participant Dialog as Import dialog
  participant Parsers as parsers (lazy chunk)
  participant Domain as normalizeSchema
  participant Stores as Zustand stores
  participant Layout as layout (Dagre or packed)
  participant Canvas as React Flow canvas

  User->>Dialog: paste text or pick a file (5 MB cap)
  Dialog->>Parsers: dynamic import, then parseSchemaText
  Parsers-->>Dialog: ImportResult with ImportIssues
  Dialog->>Domain: draft schema
  Domain-->>Stores: Schema into schema-store
  Stores->>Layout: ensureLayout for the fingerprint
  Layout-->>Stores: positions into layout-store
  Stores->>Canvas: schemaToFlow(schema, layout)
  Canvas-->>User: diagram, table list, inspector, issues
```

Points worth knowing:

- Parsing runs on the main thread after one `setTimeout(0)`, so "Parsing..." paints first
  ([ADR-014](development/ARCHITECTURE.md#adr-014--import-dialog-lazy-parsers-on-the-main-thread-no-web-worker-2026-11-16)).
- Parsers never throw on user data. A statement they cannot read becomes an `ImportIssue` and the
  rest of the file still imports.
- `ensureLayout` loads a saved layout for this fingerprint if one is valid, otherwise it lays out
  and saves.
- The canvas reads the stores with narrow selectors; `schemaToFlow` is the only place nodes and
  edges are built.

## Export

```mermaid
sequenceDiagram
  actor User
  participant Dialog as Export dialog
  participant Gen as generators
  participant Browser as Browser download

  User->>Dialog: pick a tab and options
  Dialog->>Gen: generateSchemaText or renderDiagramSvg
  Gen-->>Dialog: text and warnings, or SVG
  Dialog-->>User: preview, warnings listed
  User->>Dialog: Download or Copy
  Dialog->>Browser: Blob download or clipboard write
```

Generation is stale-safe: if the user changes options while one is running, the older result is
dropped ([ADR-029](development/ARCHITECTURE.md#adr-029--one-export-dialog-with-tabs-preview-and-stale-safe-generation-2026-11-19-p3-t05)).
PNG export rasterises the generated SVG in the browser.

## Persistence and restore

```mermaid
sequenceDiagram
  actor User
  participant App as Workspace
  participant LS as localStorage
  participant IDB as IndexedDB

  User->>App: import a schema, drag tables
  App->>IDB: save source text (session.current)
  App->>LS: save layout per fingerprint (debounced 300 ms)
  Note over App,LS: also flushed when the page is hidden
  User->>App: reload
  App->>IDB: read session
  IDB-->>App: text, format, name
  App->>App: re-parse, "Restoring name..." status
  App->>LS: read layout, selection, viewport
  LS-->>App: saved state if the fingerprint matches
  App-->>User: same schema, same layout, same selection
```

Rules: `?sample=` loads that sample and neither reads nor changes the session; with no record, no
IndexedDB, a read slower than 2 s or a parse with no tables, the app falls back to the sample.
"Clear saved data" deletes all of it and loads the sample
([ADR-030](development/ARCHITECTURE.md#adr-030--session-restore-indexeddb-source-text-re-parsed-on-load-2026-11-19-p3-t06),
[DATABASE_DESIGN](DATABASE_DESIGN.md#browser-storage)).
