"use client";

import { cn } from "cn";
import { useEffect, useRef } from "react";
import * as ResizablePrimitive from "react-resizable-panels";

function ResizablePanelGroup({ className, ...props }: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full aria-[orientation=vertical]:flex-col", className)}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  onEnter,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean;
  /**
   * Replaces the library's Enter behaviour (it toggles the panel *before* the separator, which for
   * the inspector is the canvas). A capture-phase listener on the separator itself runs before the
   * library's own listener, which ignores events whose default was prevented.
   */
  onEnter?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onEnterRef = useRef(onEnter);
  useEffect(() => {
    onEnterRef.current = onEnter;
  });
  const handlesEnter = onEnter !== undefined;
  useEffect(() => {
    const el = ref.current;
    if (!el || !handlesEnter) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat) return;
      event.preventDefault();
      onEnterRef.current?.();
    };
    el.addEventListener("keydown", onKeyDown, { capture: true });
    return () => el.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [handlesEnter]);
  return (
    <ResizablePrimitive.Separator
      elementRef={ref}
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-px items-center justify-center bg-border ring-offset-background after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className,
      )}
      {...props}
    >
      {withHandle && <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />}
    </ResizablePrimitive.Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
