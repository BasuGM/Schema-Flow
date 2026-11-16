"use client";

import { useEffect } from "react";

const STYLE = `
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
  main { max-width: 28rem; padding: 1.5rem; text-align: center; }
  p { opacity: 0.75; font-size: 0.875rem; }
  button { font: inherit; font-size: 0.875rem; padding: 0.375rem 0.75rem; margin: 0 0.25rem; border-radius: 0.375rem; border: 1px solid GrayText; background: transparent; color: inherit; cursor: pointer; }
`;

/**
 * Replaces the root layout when it fails (ADR-020). It renders its own document without the app's
 * stylesheet, so it carries minimal inline styles and follows the OS colour scheme.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("SchemaFlow: the page could not be displayed.", error);
  }, [error]);
  return (
    <html lang="en">
      <body>
        <style>{STYLE}</style>
        <title>SchemaFlow — error</title>
        <main role="alert" data-testid="global-error">
          <h1>SchemaFlow hit an unexpected error.</h1>
          <p>Your schema never left this browser. Try again, or reload the page.</p>
          <button type="button" onClick={retry}>
            Try again
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
