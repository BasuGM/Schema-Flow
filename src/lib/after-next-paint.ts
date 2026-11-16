/**
 * Resolves after the browser has painted the current frame: a requestAnimationFrame callback runs
 * just before the paint, and a task queued from it runs after. Use it to show a busy state before
 * blocking the main thread. Falls back to a plain task where there is no rAF (tests, SSR).
 */
export function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function")
      requestAnimationFrame(() => setTimeout(resolve, 0));
    else setTimeout(resolve, 0);
  });
}
