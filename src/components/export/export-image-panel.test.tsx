// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Toolbar } from "@/components/workspace/toolbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { exportFileName } from "@/generators/raster-size";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { resetStores } from "@/test/store-helpers";

const downloadBlob = vi.fn();
const svgToPngBlob = vi.fn();
vi.mock("@/lib/download", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));
vi.mock("@/lib/svg-to-png", () => ({ svgToPngBlob: (...a: unknown[]) => svgToPngBlob(...a) }));
vi.mock("@/lib/measure-text", async () => ({
  measureText: (await import("@/generators/export-palette")).approxMeasure,
}));

function renderToolbar() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <TooltipProvider>
        <Toolbar />
      </TooltipProvider>
    </ThemeProvider>,
  );
}

async function openFromSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("toolbar-settings"));
  await user.click(await screen.findByTestId("settings-export-image"));
  return screen.findByTestId("export-dialog");
}

beforeEach(() => {
  downloadBlob.mockReset();
  svgToPngBlob.mockReset();
  // jsdom has no canvas: the palette resolver then falls back to the built-in palette.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  resetStores();
});

describe("Export image dialog", () => {
  it("opens from the Settings menu with PNG, current theme and 2× selected", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFromSettings(user);
    expect(screen.getByTestId("export-format-png")).toBeChecked();
    expect(screen.getByTestId("export-theme-current")).toBeChecked();
    expect(screen.getByTestId("export-scale-2")).toBeChecked();
    expect(screen.getByTestId("export-size")).toHaveTextContent(/tables · [\d,]+ × [\d,]+ px/);
  });

  it("is disabled without a schema", async () => {
    resetStores(null);
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-settings"));
    expect(await screen.findByTestId("settings-export-image")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("disables the scale for SVG", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFromSettings(user);
    await user.click(screen.getByTestId("export-format-svg"));
    expect(screen.getByTestId("export-scale-1")).toBeDisabled();
    expect(screen.getByTestId("export-scale-2")).toBeDisabled();
    expect(screen.queryByTestId("export-output")).toBeNull();
  });

  it("downloads an SVG named after the schema and closes", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFromSettings(user);
    await user.click(screen.getByTestId("export-format-svg"));
    await user.click(screen.getByTestId("export-download"));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce());
    const [blob, name] = downloadBlob.mock.calls[0] as [Blob, string];
    expect(blob.type).toContain("image/svg+xml");
    expect(name).toBe(exportFileName(useSchemaStore.getState().schema!.name, "svg"));
    expect(await blob.text()).toContain("<svg");
    await waitFor(() => expect(screen.queryByTestId("export-dialog")).toBeNull());
  });

  it("downloads a PNG at the chosen scale", async () => {
    svgToPngBlob.mockResolvedValue({ ok: true, blob: new Blob(["png"], { type: "image/png" }) });
    const user = userEvent.setup();
    renderToolbar();
    await openFromSettings(user);
    await user.click(screen.getByTestId("export-scale-1"));
    await user.click(screen.getByTestId("export-download"));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledOnce());
    expect(svgToPngBlob.mock.calls[0]![3]).toBe(1);
    expect((downloadBlob.mock.calls[0] as [Blob, string])[1]).toMatch(/\.png$/);
  });

  it("shows an inline error and stays open when the PNG fails", async () => {
    svgToPngBlob.mockResolvedValue({ ok: false, message: "No canvas here." });
    const user = userEvent.setup();
    renderToolbar();
    await openFromSettings(user);
    await user.click(screen.getByTestId("export-download"));
    expect(await screen.findByRole("alert")).toHaveTextContent("No canvas here.");
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(screen.getByTestId("export-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("export-download")).toBeEnabled();
  });

  it("notes a reduced PNG scale for a huge layout", async () => {
    const fp = useSchemaStore.getState().fingerprint!;
    const layout = useLayoutStore.getState().layouts[fp]!;
    const first = Object.keys(layout.positions)[0]!;
    useLayoutStore.setState({
      layouts: {
        ...useLayoutStore.getState().layouts,
        [fp]: { ...layout, positions: { ...layout.positions, [first]: { x: 0, y: 240_000 } } },
      },
    });
    const user = userEvent.setup();
    renderToolbar();
    await openFromSettings(user);
    expect(screen.getByTestId("export-reduced-note")).toHaveTextContent(/reduced to 0\.\d+×/);
    await user.click(screen.getByTestId("export-format-svg"));
    expect(screen.queryByTestId("export-reduced-note")).toBeNull();
  });

  it("gives focus back to the Settings button on Escape", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await openFromSettings(user);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("export-dialog")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("toolbar-settings")).toHaveFocus());
  });

  it("opens from the More menu too, returning focus to it", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-more"));
    await user.click(await screen.findByTestId("more-export-image"));
    await screen.findByTestId("export-dialog");
    await user.click(screen.getByTestId("export-cancel"));
    await waitFor(() => expect(screen.getByTestId("toolbar-more")).toHaveFocus());
  });
});
