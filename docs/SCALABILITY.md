# Scalability

Facts about how big a schema SchemaFlow handles, and where that stops. What a 10× or 100× version
would need is a separate, clearly speculative page: [SCALABILITY_DISCUSSION](SCALABILITY_DISCUSSION.md).

"Scale" here means schema size in one browser tab. There are no users, requests or servers to scale
([BACKEND_ARCHITECTURE](BACKEND_ARCHITECTURE.md)).

## Design target

**About 300 tables**, on a MacBook Air M1 with 8 GB of RAM
([ADR-031](development/ARCHITECTURE.md#adr-031--packed-layout-300-table-design-target-no-canvas-overview-2026-11-20-p3-t07)).
The app is built and checked for realistic inputs at that size. Above 300 tables the canvas shows a
dismissible one-line notice (`DESIGN_TABLE_LIMIT`) and makes no speed promise. It still works; it is
just not tuned.

## Thresholds in the code

| Threshold                            | Value             | Effect                                                                                                      |
| ------------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `LARGE_SCHEMA_THRESHOLD`             | 80 tables         | React Flow renders only the elements in view; zoomed-out detail (below) can apply                           |
| `DESIGN_TABLE_LIMIT`                 | 300 tables        | Notice that the schema is above the design target                                                           |
| Zoomed-out detail                    | zoom below 0.3    | Large schemas draw rows as one striped block and drop edge markers ([ADR-023](development/ARCHITECTURE.md)) |
| Packed layout                        | 50+ tables, > 4:1 | A very elongated layout is re-packed toward 16:10 (ADR-031); small schemas are laid out exactly as by Dagre |
| `MAX_IMPORT_BYTES`                   | 5 MB              | Larger files are refused with a message                                                                     |
| Saved layout (`MAX_LAYOUT_CHARS`)    | 1.5 million chars | Over the limit, the saved edge routes are dropped and only positions are kept                               |
| Export preview (`PREVIEW_MAX_CHARS`) | 200,000 chars     | The preview is truncated; the downloaded file is complete                                                   |

## Measured numbers

All stamped: **measured on an M1 MacBook Air in Chrome, 2026-11-16 to 2026-11-20**, from the ADRs
and handoffs below. They will drift as code changes; the scripts that produced them are listed in
[PERFORMANCE](PERFORMANCE.md#reproducing-measurements).

| What                                           | Result                                             | Source                                                                                     |
| ---------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Dagre layout, 200 tables (Node)                | about 180 ms                                       | [Architecture: performance strategy](development/ARCHITECTURE.md#performance-strategy)     |
| Panning a 2,000-table schema, zoomed out       | 57–59 fps after level-of-detail (27–34 fps before) | [ADR-022](development/ARCHITECTURE.md#adr-022--large-schema-frame-costs-2026-11-16-p2-t10) |
| Hub select/deselect, 2,000 tables, first frame | 34–66 ms; the 40 ms goal was **not met**           | ADR-023                                                                                    |
| GitLab sample (992 tables), layout             | about 3–4.6 s, packed to about 20,480 × 17,688 px  | ADR-031                                                                                    |

The 2,000-table figures come from a stress fixture, not from a target. They show where the large
schema work stopped, not a promise.

## Where it stops

- **Layout is synchronous.** Dagre runs on the main thread, so a very large schema blocks the tab
  while it lays out.
- **Every table is a DOM element.** Above a few hundred tables, selecting or dimming restyles
  hundreds of elements; that rendering cost is browser style and paint, not JavaScript
  ([ADR-022](development/ARCHITECTURE.md#adr-022--large-schema-frame-costs-2026-11-16-p2-t10)).
- **A fitted view of a packed 992-table schema mounts many tables and is slow by design** (ADR-031).
  Reset view fits it at a zoom of about 0.03, which the canvas minimum of 0.02 allows (QA-035),
  and a schema this size is outside the design target ([KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md)).
- **No canvas overview renderer.** One was prototyped and dropped when its scope was cut
  (ADR-031).
- **Memory.** Source text, the parsed schema and the layout all live in the tab. No memory figure
  has been measured, so none is claimed.

## What does not apply

No horizontal scaling, load balancing, queues or database sizing: there is no backend. Concurrent
use means two people opening their own copy of a static file, which costs the host nothing special
([DEPLOYMENT](DEPLOYMENT.md)).
