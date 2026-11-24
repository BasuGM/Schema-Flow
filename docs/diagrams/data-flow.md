# Diagram: data flow

How a schema gets from input to pixels. Used by [ARCHITECTURE](../ARCHITECTURE.md) and
[SYSTEM_DESIGN](../SYSTEM_DESIGN.md). Source of truth:
[development/ARCHITECTURE.md](../development/ARCHITECTURE.md#data-flow).

```mermaid
flowchart LR
  subgraph pure["Pure TypeScript, no React"]
    SAMPLES[samples] --> DRAFT[DraftSchema]
    IMPORT["Import dialog, lazy chunk"] --> PARSERS[parsers] --> DRAFT
    DRAFT --> NORM[normalizeSchema] --> MODEL[(Schema)]
    MODEL --> VALID[validateSchema]
    MODEL --> FP[fingerprintSchema]
    MODEL --> LAYOUT[layoutWithDagre] --> POS[positions]
    MODEL --> FLOW[schemaToFlow]
    POS --> FLOW
  end
  subgraph state["Zustand stores"]
    SS[schema-store]
    LS[layout-store]
    US[ui-store]
  end
  MODEL --> SS
  POS --> LS
  FLOW --> CANVAS[React Flow canvas]
  SS --> CANVAS
  SS --> LIST[Table list]
  SS --> INSPECTOR[Inspector]
  LS --> FLOW
  US --> CANVAS
  US --> LIST
  US --> INSPECTOR
```
