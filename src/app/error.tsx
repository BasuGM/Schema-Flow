"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Last-resort fallback for the page (ADR-020): an error outside every region boundary, e.g. in the
 * toolbar. Inside the root layout, so the theme and styles still apply.
 */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("SchemaFlow: the app could not be displayed.", error);
  }, [error]);
  return (
    <main
      role="alert"
      data-testid="app-error"
      className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <h1 className="text-base font-semibold">SchemaFlow hit an unexpected error.</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Your schema never left this browser. Try again, or reload the page to start over with the
        sample schema.
      </p>
      {error instanceof Error && (
        <p className="max-w-md font-mono text-xs break-words text-muted-foreground">
          {error.message}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={retry} data-testid="app-error-retry">
          Try again
        </Button>
        <Button size="sm" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </main>
  );
}
