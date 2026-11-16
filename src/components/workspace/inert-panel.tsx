"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * A side panel's content (QA-017). While the panel is collapsed its content stays mounted (the
 * table filter, inspector scroll and "Show more" state survive) but is `inert`: unfocusable and
 * hidden from assistive technology. If focus was inside when it collapsed (e.g. the viewport
 * narrowed past 900 px), it moves to the panel's toolbar toggle instead of falling to `<body>`.
 */
export function InertPanel({
  side,
  open,
  children,
}: {
  side: "left" | "right";
  open: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Runs in the commit that set `inert`, before the browser's focus fixup blurs the element.
    if (open || !ref.current?.contains(document.activeElement)) return;
    const toggle = document.querySelector<HTMLElement>(`[data-testid="toolbar-toggle-${side}"]`);
    toggle?.focus();
  }, [open, side]);
  return (
    <div ref={ref} className="h-full" inert={!open} data-testid={`panel-content-${side}`}>
      {children}
    </div>
  );
}
