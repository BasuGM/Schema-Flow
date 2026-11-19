/** Revoking early can cancel the download in Firefox and Safari, so the URL lives a while. */
export const REVOKE_DELAY_MS = 10_000;

/** Saves `blob` as `filename` through a temporary `<a download>`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
