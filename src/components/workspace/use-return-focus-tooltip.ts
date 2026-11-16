"use client";

import { useRef, useState } from "react";

/**
 * For a toolbar button that opens a dialog: when the dialog closes, Radix returns focus to the
 * button, which would open its tooltip and leave it showing until focus moves (QA-015). Pass
 * `onCloseAutoFocus` to the dialog content and the tooltip props to the `ToolbarButton`; the
 * tooltip then ignores that one returning focus but still opens on hover and on keyboard focus.
 */
export function useReturnFocusTooltip() {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const returning = useRef(false);

  const onTooltipOpenChange = (next: boolean) => {
    if (next && returning.current) return;
    setTooltipOpen(next);
  };

  // Radix dispatches this just before it focuses the trigger, in the same task.
  const onCloseAutoFocus = () => {
    returning.current = true;
    setTooltipOpen(false);
    setTimeout(() => {
      returning.current = false;
    }, 0);
  };

  return { tooltipOpen, onTooltipOpenChange, onCloseAutoFocus };
}
