// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui-store";
import {
  centerDuration,
  fitPadding,
  issuesSheetOpen,
  motionDuration,
  sheetCenterOffset,
  tallNodeTargetY,
  visibleCanvasHeight,
} from "./use-canvas-commands";

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

describe("centring animation on large schemas (ADR-022)", () => {
  it("jumps without animation only for a large schema and a zoom change of more than 4×", () => {
    mockReducedMotion(false);
    expect(centerDuration(0.05, 1, true)).toBe(0);
    expect(centerDuration(1, 0.2, true)).toBe(0);
    expect(centerDuration(0.3, 1, true)).toBe(300);
    expect(centerDuration(0.05, 1, false)).toBe(300);
  });
});

describe("reveal above the issues sheet (QA-039)", () => {
  it("subtracts the covered pixels from the pane height, never below 0", () => {
    expect(visibleCanvasHeight(700, 0)).toBe(700);
    expect(visibleCanvasHeight(700, 420)).toBe(280);
    expect(visibleCanvasHeight(300, 420)).toBe(0);
  });

  it("shifts the centre down only when something is covered", () => {
    expect(sheetCenterOffset(700, 700, 1)).toBe(0);
    expect(sheetCenterOffset(700, 280, 1)).toBe(210);
    expect(sheetCenterOffset(700, 280, 2)).toBe(105);
  });

  it("top-aligns a tall node 16 px below the pane top", () => {
    // node top at flow y 100, zoom 1, pane 700: viewport centre sits 350 px below the top
    expect(tallNodeTargetY(100, 1, 700)).toBe(434);
    expect(tallNodeTargetY(100, 2, 700)).toBe(100 - 8 + 175);
  });
});
