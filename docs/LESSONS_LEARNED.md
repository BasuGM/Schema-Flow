# Lessons learned

What I learned building SchemaFlow, in my own words. Technical lessons first, then process.
Evidence is in the [QA log](development/QA_LOG.md) and the handoffs in
[development/handoffs/](development/handoffs/). Stamped 2026-11-24.

## How the work was done

I planned, directed and reviewed. Claude Code implemented. Claude Cowork, a separate agent,
verified in a real browser. The project ran from 2026-11-13 to 2026-11-24, with 143 commits and 29
Cowork rounds. I did not type most of the code. What I did was write plans with acceptance
criteria, set scope, make the calls, and read what came back.

## Technical lessons

1. **Probe before you depend.** I tested `node-sql-parser` on real PostgreSQL dumps before
   adopting it. It dropped whole tables. That one probe saved a bigger rewrite later
   ([ADR-012](development/ARCHITECTURE.md#adr-012--hand-written-tolerant-ddl-parser-instead-of-node-sql-parser-2026-11-13)).
2. **Hostile input is not only a security topic.** A file of blank lines hung the tab through a
   backtracking regex (QA-013). When I find one bad regex, I audit all of them.
3. **Measure the way a user acts.** My first performance harness used synthetic clicks, and it
   skipped the code path real users trigger (QA-019). Real input events gave real numbers.
4. **Profile, then fix the thing the profile names.** The frame-rate problem was painting tiny
   text, not JavaScript. The fix was drawing less
   ([ADR-022](development/ARCHITECTURE.md#adr-022--large-schema-frame-costs-2026-11-16-p2-t10)).
5. **Pure functions make everything cheaper.** Health checks, paths, subject areas and generators
   are plain functions of a `Schema`. They are the easiest code to test, and the easiest to trust.
6. **A fix can create the next bug.** Fixing edges that crossed tables (QA-001) led to labels
   covering neighbours (QA-004). I now re-verify in a browser after each fix.
7. **"Uncertain means left out."** An export that drops a constraint and warns is better than one
   that guesses ([ADR-033](development/ARCHITECTURE.md#adr-033--postgresql-expressions-in-mysql-and-sqlite-exports-2026-11-20-bb-p3)).
8. **Know the limit of a claim.** Axe found zero violations on ten states. That is not "the app is
   accessible". Three issues are open (QA-043, QA-044, QA-045).

## Process lessons

1. **Set the scope on day one.** I set the 300-table target and the "stop at the common case" rule
   on 2026-11-20, day eight. Before that I spent effort on 2,000-table stress cases and a canvas
   overview renderer I then cut. I would write the target into the first plan.
2. **Separate the builder from the verifier.** Cowork found defects my own checks missed: edges
   behind tables, the regex hang, unnamed buttons. A verifier that has not seen the code tests
   what a user sees.
3. **Be honest about what verified means.** The repo rule is that nothing is "Verified" until a
   Cowork report is pasted in. Until then the status is "Awaiting Cowork verification". It stops
   me from overclaiming, including to myself.
4. **Log everything, fix at the root.** 45 QA items, each with a repro, a cause and a regression
   test. Fixing the cause (not the symptom) also meant auditing nearby code, as with the regexes.
5. **Triage.** Only blocking bugs get fixed before the next task. The rest are logged with a
   target. The rule: when the backlog passes about ten, it becomes a bug-fix task.
6. **Keep durable state in files.** Plans, handoffs, the ROADMAP "Now" block and the QA log mean a
   cleared session loses nothing. This is what made a long AI-assisted project workable.
7. **A reviewer is still needed.** AI output reads fluently even when it is wrong. Acceptance
   criteria written first gave me something concrete to review against.

## What I would do differently

- Write the size target and the "what is out of scope" list into the first plan.
- Get a working CI in place. The workflow file in the repo is unused
  ([CI_CD](CI_CD.md)).
- Try the app with a real person before calling it done. The record has none.
