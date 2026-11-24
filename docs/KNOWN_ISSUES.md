# Known issues

Bugs that are **open**: found by testing and not fixed. The source is the
[QA log Backlog](development/QA_LOG.md#backlog), as of Cowork round 29 (2026-11-24). Things the
app does not do by design are in [KNOWN_LIMITATIONS](KNOWN_LIMITATIONS.md).

SchemaFlow is a closed project, so these three are marked **Open — won't fix (project closed)**.
All three were reported in Cowork round 29 at `64c5aa7`, and no code changed after that report.

| ID     | Severity | Area                     | Summary                                                |
| ------ | -------- | ------------------------ | ------------------------------------------------------ |
| QA-043 | Low      | Search button            | `aria-keyshortcuts` says `Meta+K` on Windows and Linux |
| QA-044 | Medium   | Destructive buttons      | Text contrast is below 4.5:1                           |
| QA-045 | Low      | Accessibility test suite | Flaky, and it does not cover some menus and a dialog   |

## QA-043 — wrong shortcut hint on Windows and Linux

- **What you see:** the Search toolbar button exposes `aria-keyshortcuts="Meta+K /"` to assistive
  technology on Windows and Linux, while the help dialog correctly shows Ctrl+K. The shortcut itself
  works.
- **Cause:** the static export is prerendered on a Mac with Node 22's global `navigator`, so the
  Mac check is true at build time and `out/index.html` keeps the Mac string.
- **Fix, if ever done:** compute the value after mount (`useSyncExternalStore`, server snapshot
  "Control").
- **Repro:** on Linux, inspect `toolbar-search`.
- **Impact:** a screen reader may announce the wrong modifier key. No data is affected.

## QA-044 — destructive button contrast

- **What you see:** the destructive button variant (red text on a light red tint) has a contrast
  ratio of 3.79 in light mode and 4.28 in dark mode. WCAG AA asks for 4.5. It shows on the
  confirm button of **Clear saved data**.
- **Cause:** the `button.tsx` destructive variant (`text-destructive` on `bg-destructive/10`).
- **Fix, if ever done:** change the variant colours in both themes, and add the clear-data dialog
  to the accessibility spec.
- **Repro:** `a11y.spec -g "dark.*dialogs"`, or open Clear saved data and read the confirm button.
- **Impact:** harder to read for some users. The button is still labelled and keyboard reachable.

## QA-045 — accessibility suite is flaky and has gaps

- **What you see:** `a11y.spec` sometimes fails in dark mode because axe reads colours while a
  dialog is still fading in (2 of 9 runs failed with `--repeat-each=3`). Cowork's full end-to-end
  run in round 29 had this one failure, in the dark-mode dialogs test.
- **Not covered:** the Settings and More menus, where axe would report `aria-hidden-focus` (the
  skip link, header and panels are hidden by the modal menu while still focusable and focus is
  trapped), and the clear-data dialog.
- **Fix, if ever done:** wait for `document.getAnimations()` to finish before auditing, and add the
  menus and the dialog.
- **Repro:** `a11y.spec -g "dark.*dialogs" --repeat-each=3`.
- **Impact:** a test problem. It can hide real accessibility defects, and it can fail a verification
  run. The app is not affected by the flakiness itself.

## Closed items worth knowing about

All other QA items (QA-001 to QA-042) are verified; QA-042 only in part, and its remainder is
QA-043. See [QA_REPORT](QA_REPORT.md) for the totals.

The accessibility picture as a whole, including what has not been tested (no manual screen-reader
pass), is in the [README](../README.md#accessibility).
