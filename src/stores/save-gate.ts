/**
 * Whether this tab may write saved data (session, selection, layouts). "Clear saved data" in any tab
 * switches it off in every other tab (BroadcastChannel) until that tab imports again, so a tab that
 * was open during a clear cannot write the cleared data back. `generation` counts clears: a write
 * that began under an older generation undoes itself.
 */
let enabled = true;
let generation = 0;

export const savingEnabled = (): boolean => enabled;
export const saveGeneration = (): number => generation;
export const enableSaving = (): void => {
  enabled = true;
};
export const disableSaving = (): void => {
  enabled = false;
};
export const bumpSaveGeneration = (): number => ++generation;
