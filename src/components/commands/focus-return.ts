/**
 * A command run from the search dialog that opens another dialog (Export, Import, shortcuts, clear
 * data) hands that dialog the element that had focus before ⌘K; closing the dialog then returns
 * focus there instead of to a toolbar button (P4-T04). Consumed once.
 */
let target: HTMLElement | null = null;

export function setPaletteReturnFocus(el: HTMLElement | null): void {
  target = el;
}

/** Call first in a dialog's `onCloseAutoFocus`; true = focus was restored and the event handled. */
export function restorePaletteFocus(event: Event): boolean {
  const el = target;
  target = null;
  if (!el?.isConnected) return false;
  event.preventDefault();
  el.focus();
  return true;
}
