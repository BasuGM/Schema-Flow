"use client";

import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A side panel shown as an overlay sheet on phones (below md): the table list on the left
 * (ADR-021) or the inspector on the right (ADR-017). Focus moves to the sheet when it opens (the
 * container itself, so the phone keyboard doesn't pop up for the filter field), Escape closes it,
 * and on close focus returns to the panel's toolbar toggle instead of falling to `<body>`.
 */
export function SideSheet({
  side,
  testId,
  onClose,
  children,
}: {
  side: "left" | "right";
  testId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = document.activeElement;
    if (!ref.current?.contains(active)) ref.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    // Cleanup runs before the sheet's DOM is removed, while focus is still inside it.
    return () => {
      if (!el?.contains(document.activeElement)) return;
      document.querySelector<HTMLElement>(`[data-testid="toolbar-toggle-${side}"]`)?.focus();
    };
  }, [side]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || event.defaultPrevented) return;
    // Handled here, so the workspace's Escape (clear the selection) doesn't also run.
    event.preventDefault();
    onClose();
  };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={cn(
        "absolute inset-y-0 z-30 shadow-lg outline-none",
        side === "left"
          ? "left-0 w-[min(100%,20rem)] border-r"
          : "right-0 w-[min(100%,22rem)] border-l",
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
