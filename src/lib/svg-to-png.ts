import { rasterSize } from "@/generators/raster-size";

export type PngResult = { ok: true; blob: Blob } | { ok: false; message: string };

/**
 * Rasterizes the exported SVG (`width × height` in diagram px) at `scale`, lowered to the browser
 * canvas limits by `rasterSize`. Never throws: failures come back as a message for the dialog.
 */
export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
  scale: number,
): Promise<PngResult> {
  const { pxWidth, pxHeight } = rasterSize(width, height, scale);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The browser could not read the diagram image."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = pxWidth;
    canvas.height = pxHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, message: "This browser cannot create an image canvas." };
    ctx.drawImage(image, 0, 0, pxWidth, pxHeight);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob
      ? { ok: true, blob }
      : { ok: false, message: "The browser could not encode the PNG; try a smaller scale or SVG." };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "The PNG could not be created.",
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
