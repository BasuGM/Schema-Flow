"use client";

import { useSyncExternalStore } from "react";

/**
 * QA hooks (P2-T10): a way for browser verification to make one region fail to render. Only in a
 * build made with `NEXT_PUBLIC_QA_HOOKS=1`; Next inlines the variable, so in a normal build
 * `qaHooksEnabled()` is `false` and `QaCrash` renders nothing. With the hooks on, the console has
 * `schemaflowQa.crash("<region>")` and `schemaflowQa.heal()`.
 */
export const QA_REGIONS = [
  "root",
  "app",
  "canvas",
  "table-list",
  "inspector",
  "issues",
  "search",
  "import",
] as const;
export type QaRegion = (typeof QA_REGIONS)[number];

export function qaHooksEnabled(): boolean {
  return process.env.NEXT_PUBLIC_QA_HOOKS === "1";
}

const crashing = new Set<QaRegion>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const qaHooks = {
  regions: QA_REGIONS,
  /** Makes the region throw on every render until healed. */
  crash(region: QaRegion): void {
    if (!QA_REGIONS.includes(region)) throw new Error(`Unknown region "${region}".`);
    crashing.add(region);
    emit();
  },
  /** Stops one region (or all) from throwing; press "Try again" afterwards. */
  heal(region?: QaRegion): void {
    if (region) crashing.delete(region);
    else crashing.clear();
    emit();
  },
};

/** Exposes `window.schemaflowQa` in a QA build. */
export function installQaHooks(): void {
  if (!qaHooksEnabled() || typeof window === "undefined") return;
  (window as unknown as { schemaflowQa?: typeof qaHooks }).schemaflowQa = qaHooks;
}

export function QaCrash({ region }: { region: QaRegion }) {
  return qaHooksEnabled() ? <ActiveQaCrash region={region} /> : null;
}

function ActiveQaCrash({ region }: { region: QaRegion }) {
  const crash = useSyncExternalStore(
    subscribe,
    () => crashing.has(region),
    () => false,
  );
  if (crash) throw new Error(`QA hook: simulated render error in the ${region} region.`);
  return null;
}
