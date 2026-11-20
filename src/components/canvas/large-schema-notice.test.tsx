// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DESIGN_TABLE_LIMIT, LargeSchemaNotice } from "./large-schema-notice";

describe("LargeSchemaNotice", () => {
  it("is not shown up to the design limit", () => {
    render(<LargeSchemaNotice tables={DESIGN_TABLE_LIMIT} onDismiss={() => {}} />);
    expect(screen.queryByTestId("large-schema-notice")).toBeNull();
  });

  it("names the table count and the limit above it", () => {
    render(<LargeSchemaNotice tables={992} onDismiss={() => {}} />);
    expect(screen.getByTestId("large-schema-notice")).toHaveTextContent(
      "Large schema (992 tables): SchemaFlow is designed for up to about 300 tables, so panning and selecting may be slow.",
    );
  });

  it("calls onDismiss from the close button", async () => {
    const onDismiss = vi.fn();
    render(<LargeSchemaNotice tables={400} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByTestId("large-schema-notice-dismiss"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
