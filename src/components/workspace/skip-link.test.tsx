// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DIAGRAM_ID, SkipLink } from "./skip-link";

describe("SkipLink", () => {
  it("moves focus to the diagram landmark", async () => {
    render(
      <>
        <SkipLink />
        <main id={DIAGRAM_ID} tabIndex={-1} aria-label="Diagram" />
      </>,
    );
    await userEvent.tab();
    expect(screen.getByTestId("skip-link")).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("main")).toHaveFocus();
  });
});
