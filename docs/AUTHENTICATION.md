# Authentication

**There is none.** SchemaFlow has no accounts, sign-in, sessions, tokens or cookies of its own.
Anyone who opens the app can use all of it.

## Why

- There is no server, so there is nothing to protect and nowhere to keep an identity
  ([BACKEND_ARCHITECTURE](BACKEND_ARCHITECTURE.md)).
- Imported schema text never leaves the browser, so access control would only guard data that the
  user already holds on their own machine.
- Sharing and collaboration are out of scope ([KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md)).

## The nearest thing: who can see saved data

What the app keeps (see [DATABASE_DESIGN](DATABASE_DESIGN.md#browser-storage)) is stored in the
browser profile of the person using it: layouts and preferences in localStorage, and the last
imported schema's source text in IndexedDB. It is tied to the browser, the profile and the site
origin, not to a user.

Consequences:

- Another person on the same browser profile can see the last import after a reload. On a shared
  machine, use **Clear saved data** (Settings or More, with a confirm dialog) when finished. It
  deletes the session, selection, layouts, layout index and preferences, then loads the sample.
- Clearing is final within a tab: pending saves are cancelled, and other open tabs are told over a
  `BroadcastChannel` to stop saving until their next import. Without `BroadcastChannel` another open
  tab could write its state back
  ([ADR-030](development/ARCHITECTURE.md#adr-030--session-restore-indexeddb-source-text-re-parsed-on-load-2026-11-19-p3-t06)).
- Private browsing or blocked site data simply means nothing is saved; the app still works.

See [SECURITY](SECURITY.md) for the wider threat model.

## If sign-in were ever needed

It would arrive with a server and a feature that needs one, such as shared workspaces. That would
mean a hosted auth provider rather than home-made accounts, and a decision on whether schemas may
be uploaded at all. None of this exists or is planned.
