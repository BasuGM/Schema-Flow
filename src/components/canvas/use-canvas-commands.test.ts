// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { motionDuration } from "./use-canvas-commands";

const original = window.matchMedia;
afterEach(() => {
  window.matchMedia = original;
});

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
  })) as unknown as typeof window.matchMedia;
}

describe("motionDuration (AC-P1-T09-6)", () => {
  it("keeps the animation duration by default", () => {
    mockReducedMotion(false);
    expect(motionDuration(300)).toBe(300);
  });

  it("disables viewport animation when the user prefers reduced motion", () => {
    mockReducedMotion(true);
    expect(motionDuration(300)).toBe(0);
  });
});
