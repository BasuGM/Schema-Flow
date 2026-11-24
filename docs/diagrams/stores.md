# Diagram: the three stores

What each Zustand store owns and who reads it. Used by [FRONTEND_ARCHITECTURE](../FRONTEND_ARCHITECTURE.md)
and [ARCHITECTURE](../ARCHITECTURE.md). Full slice list:
[development/ARCHITECTURE.md](../development/ARCHITECTURE.md#state-slices-srcstores).

```mermaid
flowchart LR
  subgraph stores["Zustand stores"]
    SS["schema-store: schema, fingerprint, issues, sourceText"]
    LS["layout-store: positions, collapsed, viewport per fingerprint"]
    US["ui-store: selection, panels, search, inspector tab, focus set, hidden areas"]
  end
  LS -- "saved per fingerprint" --> LSTORE[(localStorage)]
  SS -- "import source text" --> IDB[(IndexedDB)]
  SS --> CANVAS[Canvas]
  LS --> CANVAS
  US --> CANVAS
  SS --> PANELS["Table list, Inspector, Issues, Health"]
  US --> PANELS
  US -- "theme: next-themes" --> THEME[(localStorage)]
```
