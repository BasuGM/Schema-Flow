// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui-store";
import { fitPadding, issuesSheetOpen, motionDuration } from "./use-canvas-commands";

const original = window.matchMedia;
afterEach(() => {
  window.matchMedia = original;
  useUiStore.getState().setIssuesPanelOpen(false);
});

function mockNarrow(narrow: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: narrow && query === "(max-width: 767px)",
    media: query,
  })) as unknown as typeof window.matchMedia;
}

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

describe("fit padding with the issues sheet (QA-014)", () => {
  it("keeps the usual margin without the sheet", () => {
    expect(fitPadding(false)).toBe(0.15);
  });

  it("fits into the area above the sheet (60% of the canvas) when it is open", () => {
    expect(fitPadding(true)).toEqual({ top: "5%", bottom: "65%", x: "6%" });
  });

  it("counts the sheet as open only on narrow screens with the panel open", () => {
    mockNarrow(true);
    expect(issuesSheetOpen()).toBe(false);
    useUiStore.getState().setIssuesPanelOpen(true);
    expect(issuesSheetOpen()).toBe(true);
    mockNarrow(false);
    expect(issuesSheetOpen()).toBe(false); // docked panel resizes the canvas instead
  });
});
