import { useUiStore } from "@/stores/ui-store";

/**
 * Closes the docked issues panel and moves focus to the toolbar's Issues button, where Enter opens
 * it again at its previous size. The control that had focus (the panel's close button or its
 * separator) is hidden with the panel, so without this focus falls to `<body>` (QA-021, QA-025).
 */
export function closeIssuesPanel(): void {
  useUiStore.getState().setIssuesPanelOpen(false);
  document.querySelector<HTMLElement>('[data-testid="toolbar-issues"]')?.focus();
}
