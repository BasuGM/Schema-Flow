# Deployment

**SchemaFlow is not deployed.** There is no hosted demo, by choice: nothing in the app needs a
server, and the project is a portfolio piece that anyone can run locally ([DEMO_GUIDE](DEMO_GUIDE.md)).

## What the build produces

`next build` with `output: "export"` in `next.config.ts` writes a fully static site to `out/`: HTML,
JavaScript, CSS and the prerendered error pages
([ADR-002](development/ARCHITECTURE.md#adr-002--static-export-cache-components-disabled-2026-11-13)).
There is no Node server at run time, no API route, no server action, no middleware and no image
optimisation service. `out/` is git-ignored.

The one build-time switch is `NEXT_PUBLIC_QA_HOOKS=1`, which adds crash hooks to the console for the
error-region test ([ERROR_HANDLING](ERROR_HANDLING.md)). Leave it unset for anything shared.

## Serving it locally

```bash
npm run build
npm run start     # python3 -m http.server 3000 --directory out
```

`npm run start` is a plain static file server, not `next start`. To keep the dev server on port 3000
and serve the build elsewhere: `python3 -m http.server 3100 --directory out`. Use a production build
for any speed measurement ([PERFORMANCE](PERFORMANCE.md)).

## How it could be hosted

Any static host that serves a folder would work, for example GitHub Pages, Netlify, Cloudflare Pages
or S3 with a CDN. This is reasoning from how static export works, **not something that has been done
or tested**. Points to check if it ever happens:

- **Sub-path hosting.** GitHub Pages serves project sites under `/<repo>/`. The config sets no
  `basePath`, so that would need configuring.
- **Headers.** The repo sets no Content-Security-Policy or other headers; the host would
  ([SECURITY](SECURITY.md)). Long-lived caching of the fingerprinted build assets is also a host
  setting ([CACHING_STRATEGY](CACHING_STRATEGY.md)).
- **Single page.** The app is one page with no client-side routes, so no rewrite rules are needed
  ([FRONTEND_ARCHITECTURE](FRONTEND_ARCHITECTURE.md#routing)).
- **Node version.** Build with Node 22 or newer. The unused workflow uses Node 20
  ([CI_CD](CI_CD.md)).

## Environments, configuration and data

There are no environments, secrets, environment variables (other than the build flag above),
databases or migrations ([ENVIRONMENT_SETUP](ENVIRONMENT_SETUP.md)). Each visitor's data stays in
their own browser, so there is nothing to back up or migrate on the host
([DATABASE_DESIGN](DATABASE_DESIGN.md)).

## Rollback

Not applicable. With a static host, a rollback would be redeploying an earlier `out/` folder; there
is no state on the server to reconcile.
