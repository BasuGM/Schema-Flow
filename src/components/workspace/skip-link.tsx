export const DIAGRAM_ID = "diagram-main";

/** First focusable element: jumps past the toolbar and panels to the diagram (P4-T06). */
export function SkipLink() {
  return (
    <a
      href={`#${DIAGRAM_ID}`}
      data-testid="skip-link"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      onClick={(e) => {
        e.preventDefault();
        document.getElementById(DIAGRAM_ID)?.focus();
      }}
    >
      Skip to diagram
    </a>
  );
}
