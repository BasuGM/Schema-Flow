# Diagram: module boundaries

Which folder may import which. Arrows point from the importer to the imported folder. Used by
[ARCHITECTURE](../ARCHITECTURE.md), [SYSTEM_DESIGN](../SYSTEM_DESIGN.md) and
[PROJECT_STRUCTURE](../PROJECT_STRUCTURE.md). Table form:
[development/ARCHITECTURE.md](../development/ARCHITECTURE.md#module-boundaries).

```mermaid
flowchart TD
  subgraph pure["Pure TypeScript: no React, Next or browser imports"]
    DOMAIN[domain]
    SAMPLES[samples]
    PARSERS[parsers]
    GRAPH[graph]
    ANALYSIS[analysis]
    GENERATORS[generators]
  end
  STORES[stores]
  COMPONENTS[components]
  APP[app]

  SAMPLES --> DOMAIN
  PARSERS --> DOMAIN
  GRAPH --> DOMAIN
  ANALYSIS --> DOMAIN
  GENERATORS --> DOMAIN
  GENERATORS --> GRAPH
  STORES --> DOMAIN
  STORES --> GRAPH
  COMPONENTS --> STORES
  COMPONENTS --> PARSERS
  COMPONENTS --> GENERATORS
  COMPONENTS --> ANALYSIS
  COMPONENTS --> GRAPH
  COMPONENTS --> DOMAIN
  APP --> COMPONENTS
```

Two rules the picture cannot show: parsers never import React Flow, and canvas components never
import parsers (only the Import dialog does, through a lazy chunk). `src/graph` imports only types
from `@xyflow/react`.
