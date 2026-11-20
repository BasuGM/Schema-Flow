const INSPECTOR = '[data-testid="inspector"]';

/**
 * Moves focus to `[data-testid=testId]` inside the inspector that holds `from`, after the next frame
 * (the activated control is about to unmount with the selection change, so focus would fall to
 * `<body>`). The container is captured now and the target looked up in the frame; if the container
 * was replaced meanwhile, the first inspector on the page is used (ADR-032).
 */
export function focusInInspector(from: HTMLElement, testId: string): void {
  const container = from.closest<HTMLElement>(INSPECTOR);
  requestAnimationFrame(() => {
    const root = container?.isConnected ? container : document.querySelector<HTMLElement>(INSPECTOR);
    root?.querySelector<HTMLElement>(`[data-testid="${testId}"]`)?.focus();
  });
}
