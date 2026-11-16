"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ToolbarButtonProps extends Omit<ComponentProps<typeof Button>, "disabled"> {
  tooltip: ReactNode;
  /** Unavailable controls stay focusable (aria-disabled) so their tooltip explains why. */
  unavailable?: boolean;
  /** Controlled tooltip state, e.g. from `useReturnFocusTooltip`. */
  tooltipOpen?: boolean;
  onTooltipOpenChange?: (open: boolean) => void;
}

export function ToolbarButton({
  tooltip,
  unavailable,
  onClick,
  className,
  tooltipOpen,
  onTooltipOpenChange,
  ...props
}: ToolbarButtonProps) {
  return (
    <Tooltip open={tooltipOpen} onOpenChange={onTooltipOpenChange}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-disabled={unavailable || undefined}
          onClick={unavailable ? (e) => e.preventDefault() : onClick}
          className={cn(
            unavailable && "cursor-not-allowed opacity-50 hover:bg-transparent",
            className,
          )}
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
