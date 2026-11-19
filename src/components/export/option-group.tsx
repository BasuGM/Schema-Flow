"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export interface Option<T extends string> {
  value: T;
  label: string;
  testId: string;
}

/**
 * A segmented control made of native radios in a fieldset: arrow keys for free, a visible focus
 * ring on the label (not on the sr-only input, QA-029), and a `useId` group name.
 */
export function OptionGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  disabled,
}: {
  legend: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const name = useId();
  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="mb-1 text-xs text-muted-foreground">{legend}</legend>
      <div
        className={cn("flex rounded-md border bg-muted/40 p-0.5 text-xs", disabled && "opacity-50")}
      >
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "relative min-w-0 flex-1 cursor-pointer truncate rounded px-2 py-1.5 text-center",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              disabled && "cursor-not-allowed",
              value === o.value ? "bg-card font-medium shadow-sm" : "text-muted-foreground",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
              data-testid={o.testId}
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
