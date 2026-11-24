# Scalability discussion

**This page is speculation. None of it is built.** It is how I would answer "what if it were 10×
or 100× bigger?" in an interview. What the app really does today is in
[SCALABILITY](SCALABILITY.md). Stamped 2026-11-24.

Today's design target is about **300 tables**. Here, "10×" means about 3,000 tables and "100×"
means about 30,000. The only evidence I have above 300 is a 992-table real sample and a 2,000-table
stress fixture.

## What I know today

| Fact                                                  | Value                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| GitLab sample (992 tables), layout on the main thread | about 3–4.6 s                                                     |
| Hub select at 2,000 tables, first frame               | 34–66 ms (goal of 40 ms not met)                                  |
| Pan at 2,000 tables, zoomed out                       | 57–59 fps                                                         |
| Dagre on a 2,000-table linear foreign-key chain       | over 90 s (observed in QA, not guarded); realistic ones about 3 s |
| Cost of selecting or dimming                          | browser style and paint over many DOM elements, not JavaScript    |

## 10×: about 3,000 tables

What breaks first, in order:

1. **Layout blocks the tab.** Dagre runs on the main thread. _Idea:_ run layout in a Web Worker and
   show progress. This is the first thing I would do. It moves the cost off the UI thread without
   changing the model. I rejected a worker for parsing because parsing is cheap
   ([ADR-014](development/ARCHITECTURE.md#adr-014--import-dialog-lazy-parsers-on-the-main-thread-no-web-worker-2026-11-16));
   layout is a different measurement.
2. **A pathological graph.** A long FK chain can take over a minute. _Idea:_ a time or size guard
   that falls back to the packed grid.
3. **The table list.** Hundreds of rows in the DOM. _Idea:_ a virtualised list, like the search
   results, which are already windowed
   ([ADR-016](development/ARCHITECTURE.md#adr-016--own-search-palette-instead-of-shadcn-command--cmdk-2026-11-16)).
4. **Selection cost.** _Idea:_ render fewer elements, for example only tables near the viewport at
   any zoom.

## 100×: about 30,000 tables

I do not think the current design survives this, and I would not try to stretch it.

- **Rendering.** One DOM element per table cannot work. _Idea:_ a canvas or WebGL renderer for the
  zoomed-out view, switching to DOM tables only when zoomed in. I prototyped a canvas overview
  renderer and cut it on 2026-11-20. The code is in git history (`509ea54`, `ca06fee`), not in the
  tree. It is evidence I thought about it, not a result.
- **Layout.** Layered layout of the whole graph is too slow. _Idea:_ cluster by subject area first
  (already derived,
  [ADR-036](development/ARCHITECTURE.md#adr-036--subject-areas-derived-and-hidden-on-the-canvas-2026-11-23-p4-t03)),
  lay out areas separately and show one area at a time.
- **Memory and parsing.** The 5 MB cap would need streaming or chunked parsing, and likely a
  worker. No memory figure has been measured, so I make no claim.
- **Product.** At this size, nobody reads a diagram. The useful features would be search, paths
  and area views, which already exist.

## What I would not change

The pure `Schema` core, the parsers' tolerance, and the "derive, don't store" analysis scale
fine. The change would be in rendering and layout, not in the model.

## How I would decide

I would not build any of this on a guess. I would collect a real schema of the new size, profile
it, and change the one thing the profile names. That is how ADR-022 and ADR-031 were made, and
the scope rule in [CLAUDE.md](../CLAUDE.md) says to stop when the common case is good.
