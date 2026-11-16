"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";

interface RegionFallbackProps {
  region: string;
  testId: string;
  error: unknown;
  onRetry: () => void;
  onClose?: () => void;
}

/** Compact fallback for one region; the rest of the workspace keeps working. */
export function RegionFallback({ region, testId, error, onRetry, onClose }: RegionFallbackProps) {
  const ref = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);

  // The failed region's focused element is gone: focus went to <body>, or (in a dialog) to the
  // dialog itself. Move it to "Try again" then; otherwise leave the user's focus where it is.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || (ref.current && active.contains(ref.current)))
      retryRef.current?.focus();
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !onClose) return;
    event.preventDefault();
    onClose();
  };

  const message = error instanceof Error ? error.message : null;
  return (
    <div
      ref={ref}
      role="alert"
      data-testid={testId}
      onKeyDown={onKeyDown}
      className="flex h-full min-h-32 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <p className="text-sm font-medium">The {region} could not be displayed.</p>
      {message && <p className="max-w-sm text-xs break-words text-muted-foreground">{message}</p>}
      <div className="flex gap-2">
        <Button
          ref={retryRef}
          size="sm"
          variant="outline"
          onClick={onRetry}
          data-testid={`${testId}-retry`}
        >
          Try again
        </Button>
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose} data-testid={`${testId}-close`}>
            Close
          </Button>
        )}
      </div>
    </div>
  );
}
