# User flows

Five journeys through the app. Each lists the Playwright spec that exercises it
(`npm run e2e`, see [the e2e decision](development/ARCHITECTURE.md#adr-024--committed-playwright-e2e-suite-2026-11-19-e2e-01)).

## 1. First look

The app opens on the built-in e-commerce sample (12 tables). Specs:
[panels.spec.ts](../tests/e2e/panels.spec.ts), [neighbourhood.spec.ts](../tests/e2e/neighbourhood.spec.ts).

```mermaid
flowchart LR
  A["Open the app"] --> B["E-commerce sample is laid out"]
  B --> C["Select a table in the list or on the canvas"]
  C --> D["Inspector shows columns, keys, relations"]
  C --> E["Tables outside 1 or 2 hops are dimmed"]
  D --> F["Press ? for shortcuts"]
```

## 2. Import your own schema

Specs: [import.spec.ts](../tests/e2e/import.spec.ts), [issues.spec.ts](../tests/e2e/issues.spec.ts).

```mermaid
flowchart TD
  A["Import: press I or use the toolbar"] --> B["Paste, choose or drop a file"]
  B --> C{"Under 5 MB and readable text?"}
  C -- no --> X["Message in the dialog, nothing changes"]
  C -- yes --> D["Parser reads the text, never executes it"]
  D --> E["Schema laid out on the canvas"]
  D --> F{"Any issues?"}
  F -- yes --> G["Issues panel opens, with line numbers"]
  F -- no --> H["Done"]
  E --> I{"More than 300 tables?"}
  I -- yes --> J["Dismissible large-schema notice"]
  I -- no --> H
```

## 3. Understand a schema

Specs: [search.spec.ts](../tests/e2e/search.spec.ts), [inspector.spec.ts](../tests/e2e/inspector.spec.ts),
[path.spec.ts](../tests/e2e/path.spec.ts), [areas.spec.ts](../tests/e2e/areas.spec.ts).

```mermaid
flowchart LR
  A["Search: Ctrl or Cmd K"] --> B["Jump to a table or column"]
  B --> C["Inspector: Relations tab"]
  C --> D["Follow a foreign key, Back to return"]
  C --> E["Path tab: pick a second table"]
  E --> F["Shortest FK path lit on the canvas"]
  B --> G["Table list: Areas"]
  G --> H["Hide areas or show one only"]
```

## 4. Review quality

Specs: [health.spec.ts](../tests/e2e/health.spec.ts), [phone.spec.ts](../tests/e2e/phone.spec.ts).

```mermaid
flowchart TD
  A["Press H or open Schema health"] --> B["Health tab lists advisory findings"]
  B --> C["Choose Show table on a finding"]
  C --> D{"Phone layout?"}
  D -- no --> E["Table selected and brought into view"]
  D -- yes --> F["Sheet closes, table is centred in the band above it"]
```

## 5. Take it away and come back

Specs: [export.spec.ts](../tests/e2e/export.spec.ts), [persistence.spec.ts](../tests/e2e/persistence.spec.ts),
[session.spec.ts](../tests/e2e/session.spec.ts).

```mermaid
flowchart TD
  A["Press E: Export dialog"] --> B["Pick a tab: PNG, SVG, SQL, Prisma, Mermaid, JSON"]
  B --> C["Preview, then copy or download"]
  C --> D["Reload the page"]
  D --> E{"URL has a sample parameter?"}
  E -- yes --> F["That sample is shown"]
  E -- no --> G["Last import, positions, zoom and selection restored"]
  G --> H["Settings: Clear saved data removes it all"]
```
