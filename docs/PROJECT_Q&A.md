# Project Q&A

Questions I expect, with answers I can say aloud. Short sentences. Each answer points to the file
that backs it. Five questions are marked **Hard follow-up**: the ones where an interviewer is most
likely to push a second time.

Stamped 2026-11-24. See also [INTERVIEW_GUIDE](INTERVIEW_GUIDE.md).

## The project

**1. What is SchemaFlow?**
A browser app that turns SQL DDL or a Prisma schema into an interactive diagram. It runs fully in
the browser. SQL is parsed as text and never executed.

**2. Who is it for?**
Developers who want to understand or document a schema without installing anything or uploading
it. It is a portfolio project. There are no users to report on.

**3. Why did you build it?**
To practise building a real front end end to end: parsing, state, layout, performance and
testing. And to practise directing AI tools with a clear process.

**4. What does it not do?**
No editing, no live database connection, no collaboration, no 3D, no hosted demo. Views and
functions in SQL are skipped. See [KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md).

**5. What is the tech stack?**
Next.js 16 as a static export, React 19, React Flow 12, Zustand 5, Tailwind v4, shadcn/ui and
Dagre for layout. Table in [TECH_STACK](TECH_STACK.md).

## Architecture

**6. How is it structured?**
A pure TypeScript core, with no React or browser imports: `domain`, `graph`, `parsers`,
`analysis`, `generators`. The UI sits on top. See [ARCHITECTURE](ARCHITECTURE.md).

**7. What is the single source of truth?**
A normalized `Schema` object. React Flow nodes and edges are derived from it by `schemaToFlow()`.
Parsers never touch React Flow. The canvas never touches parsers.

**8. How do you manage state?**
Three Zustand stores: schema, layout and UI. I use narrow selectors, and `useShallow` for object
or array selectors. See [FRONTEND_ARCHITECTURE](FRONTEND_ARCHITECTURE.md).

**9. Why Zustand and not Redux or context?**
It is small and has no provider tree. Selectors keep a table node from re-rendering when
something unrelated changes. This matters on a canvas with hundreds of nodes.

**10. How does data move through the app?**
Import text, detect the format, parse to a `Schema`, normalize, derive flow nodes, render. See
[DATA_FLOW](DATA_FLOW.md).

**11. Why a static export?**
Because there is nothing for a server to do. Static output means any file server can host it
([ADR-002](development/ARCHITECTURE.md#adr-002--static-export-cache-components-disabled-2026-11-13)).

## Parsing and data

**12. How do you handle bad input?**
Parsers return `ImportIssue`s and never throw. Each region of the UI has an error boundary. A
bad statement becomes a warning with a line number. See [ERROR_HANDLING](ERROR_HANDLING.md).

**13. How do you protect against huge or hostile input?**
Files over 5 MB are refused. I fixed a regex that backtracked on blank lines and froze the tab
(QA-013), and audited every regex in the parsers. See [SECURITY](SECURITY.md).

**14. Does imported SQL ever run?**
No. It is read as text by my parsers. There is no `eval`, no database and no network call with
the text.

**15. Why does the app keep my schema after a reload?**
Session restore. The last import's text is saved in IndexedDB and re-parsed on load. Layouts are
saved per schema fingerprint in `localStorage`. "Clear saved data" removes both
([ADR-030](development/ARCHITECTURE.md#adr-030--session-restore-indexeddb-source-text-re-parsed-on-load-2026-11-19-p3-t06)).
It is unencrypted, and I say so in [SECURITY](SECURITY.md).

**16. What happens to saved positions if the schema changes?**
Layouts are keyed by a fingerprint of the schema. Adding or removing a table changes the
fingerprint, so positions reset. That is a known trade-off ([TRADE_OFFS](TRADE_OFFS.md)).

## Features

**17. How does the path finder work?**
Breadth-first search over relationships in either direction. Ties are broken in a fixed order, so
the result is deterministic. It shows one shortest path, not all paths
([ADR-035](development/ARCHITECTURE.md#adr-035--path-finder-in-an-inspector-tab-2026-11-23-p4-t02)).

**18. How are subject areas decided?**
Derived, not stored. The database schema name if there are two or more, otherwise the table-name
prefix before the first underscore. Prefixes shared by fewer than three tables go to "Other"
([ADR-036](development/ARCHITECTURE.md#adr-036--subject-areas-derived-and-hidden-on-the-canvas-2026-11-23-p4-t03)).

**19. How does export work?**
Images are drawn from the `Schema` by my own SVG renderer, not from a DOM snapshot, so the whole
diagram is exported, not just what is on screen
([ADR-027](development/ARCHITECTURE.md#adr-027--image-export-own-svg-renderer-instead-of-html-to-image-2026-11-19-p3-t03)).
Text exports (SQL, Prisma, Mermaid, JSON) are pure functions that return text plus warnings.

**20. What happens when you export PostgreSQL SQL to MySQL?**
Types and defaults are mapped. Anything I cannot translate safely is left out, with a counted
warning. A half-translated constraint is never emitted
([ADR-033](development/ARCHITECTURE.md#adr-033--postgresql-expressions-in-mysql-and-sqlite-exports-2026-11-20-bb-p3)).

## Performance and scale

**21. How big a schema does it handle?**
It is designed for about 300 tables. Above that it shows a notice and makes no speed promise. See
[SCALABILITY](SCALABILITY.md).

**22. What did you do for performance?**
Render only visible elements above 80 tables. Draw simplified tables when zoomed out. Memoise
rows, edges and derived data per schema. Pack very tall layouts. Details in
[PERFORMANCE](PERFORMANCE.md).

**23. What goal did you miss?**
Selecting a hub table in a 2,000-table stress schema took 34–66 ms for the first frame. My goal
was 40 ms. I did not meet it, and I stopped, because 2,000 tables is outside the target.

**24. Why not a Web Worker?**
I measured first. About 1 MB of SQL parses in 99–144 ms. A worker would add a message protocol
and a second bundle for little gain
([ADR-014](development/ARCHITECTURE.md#adr-014--import-dialog-lazy-parsers-on-the-main-thread-no-web-worker-2026-11-16)).
Layout is the bigger cost, and it is still on the main thread. That is a known limit.

## Quality

**25. How do you test it?**
`npm run check` runs typecheck, lint, 863 unit tests and the production build. Playwright e2e
(254 tests) runs separately against a built app. See [TESTING](TESTING.md).

**26. What about accessibility?**
Semantic HTML, labelled icon buttons, a skip link, visible focus, keyboard routes. Axe passes on
ten covered states. Three issues are open and won't fix: QA-043 (a build-time shortcut string),
QA-044 (a button contrast of 3.79) and QA-045 (a flaky test). See [KNOWN_ISSUES](KNOWN_ISSUES.md).

**27. What is the biggest bug you found?**
QA-013: about 1 MB of blank lines hung the tab. A regex backtracked quadratically. Story in
[TECHNICAL_CHALLENGES](TECHNICAL_CHALLENGES.md#2-a-regex-that-froze-the-tab-qa-013).

**28. Is there CI?**
No working CI. I run `npm run check` locally, plus e2e, plus the Cowork loop. A GitHub workflow
file exists but is unused ([CI_CD](CI_CD.md)).

## Process and AI

**29. Did you use AI?**
Yes, and openly. I planned, directed and reviewed. Claude Code implemented. Cowork verified in a
browser, independently. Details in [LESSONS_LEARNED](LESSONS_LEARNED.md).

**30. What would you do differently?**
Run the browser verification earlier on each task, and set the 300-table scope on day one rather
than on day eight. See [LESSONS_LEARNED](LESSONS_LEARNED.md).

## Hard follow-ups

**Hard follow-up 1. Why no backend? Couldn't you do more with one?**
Yes, I could do more. Sharing links, accounts, sync, comments. But that is a different product. My
goal was a tool you can trust with a sensitive schema. No backend means no storage, no breach, no
hosting bill. The cost is real: no collaboration, and heavy work shares the UI thread. If sharing
became the goal, I would add a backend then, and the pure TypeScript core would move with it
unchanged. See [BACKEND_ARCHITECTURE](BACKEND_ARCHITECTURE.md).

**Hard follow-up 2. Why write your own parsers? That is risky.**
It is risky, and I own it. I probed `node-sql-parser`. Its PostgreSQL build rejected whole tables
on enum column types, `GENERATED ALWAYS AS IDENTITY` and `REFERENCES t` with no column list.
Those are normal in `pg_dump`. The dialect builds were also 200–300 KB each. So I wrote a tolerant
parser, about 1,190 code lines. It only reads DDL that affects the diagram. The cost is that
odd dialect corners are mine to fix. I cover that with 11 SQL fixtures, real-world dumps, seeded
robustness tests and a performance test. The full reasoning:
[ADR-012](development/ARCHITECTURE.md#adr-012--hand-written-tolerant-ddl-parser-instead-of-node-sql-parser-2026-11-13).

**Hard follow-up 3. How do you actually know it works?**
In layers, and I know which layer proves what. Unit tests prove the pure logic. `npm run check`
proves it builds. The e2e suite proves flows in a real browser. Cowork, a separate agent,
re-tested in a browser across 29 rounds and found real defects the other layers missed: edges
behind tables, a hung tab, unnamed buttons. What I cannot say: that a human user tested it, or
that it is bug-free. Three issues are open. A defect found by a test I wrote myself is not
independent, and I treat Cowork's reports as the independent signal. See [TESTING](TESTING.md) and
[QA_REPORT](QA_REPORT.md).

**Hard follow-up 4. What breaks at 1,000 tables?**
It does not crash, but it is not good. The GitLab sample has 992 tables. Layout takes about 3 to
4.6 seconds on the main thread and blocks the tab. Before I added packing, the layout was about
242,000 px tall. Now it is about 20,480 × 17,688 px. A fitted view mounts many tables and is slow
by design. At 2,000 tables I missed my own 40 ms selection goal. I scoped the target to about
300 tables and show a notice above it. For more, I would move layout to a worker and virtualise
the list. That is not built. See [SCALABILITY_DISCUSSION](SCALABILITY_DISCUSSION.md).

**Hard follow-up 5. How much of this is you, and how much is the AI?**
The decisions are mine. I wrote the plans and acceptance criteria, set the scope, and made the
calls: tolerant parsers over a library, cutting the canvas overview renderer, the 300-table
target. I reviewed what came back. Claude Code wrote the code and ran the checks. Cowork tested
it. I did not type most of the code, and I do not claim to. What I can do is explain any module,
trace a bug to its cause, and say why a design was chosen. Ask me about any file. The honesty
rule in the repo says the same: nothing is called verified unless a verification report was
pasted in. See [LESSONS_LEARNED](LESSONS_LEARNED.md).
