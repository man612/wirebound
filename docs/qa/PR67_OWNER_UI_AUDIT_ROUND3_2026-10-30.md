# Wirebound PR #67 — Owner UI/UX Audit, Round 3 (2026-10-30)

This checkpoint responds to ten visual/interaction defects reported in five live QA screenshots. Work was done **only** in the F: isolated feature worktree, on top of Draft PR #67. Do **not** assume changes reached the everyday installed app, `main`, or a release.

## Changes and diagnosis

1. **Diagnostics collapsed panel wasting vertical space:** The banner of diagnostic feedback used to reserve a line even with no text. It is now a separate grid track that collapses to 0 when idle, preserving animated feedback when needed. The initial CSS progress collapse still consumed exactly **16 px** due to a direct grid child's `my-2` margins. That margin was moved to a nested inner element with an overflow-hidden wrapper so `0fr` can truly collapse.
2. **Ready notification leaves a hole after dismissal:** A collapsed banner was still a flex child with a parent `gap-4` and a direct child's padding/borders retaining **18 px**. The direct grid child is now a padding-free clipping wrapper; the visible banner is nested inside and the unused flex gap is neutralized by a collapsed-state margin. This layout must be confirmed at 0px in the final packaged build.
3. **Blue Gnirehtet client / misleading 5/6:** The Gnirehtet client check is deliberately `info` when the engine is stopped; that is not a failure and must not be painted green falsely. The summary is now calculated from **applicable non-info checks** (e.g. `5/5 passed · 1 info`). When the engine changes from stopped to connected or back, App schedules a fresh real diagnostic scan. **Real connected QA evidence:** the *already running* round-3 package was observed with `status=connected`, actual Android VPN + Gnirehtet reverse, the UI's **`6/6 passed`**, and actual global `Stop Connection` button. No fake 'pass' was introduced.
4. **Sidebar tooltip too fast:** Delayed pointer-hover tooltip increased to **1300ms** for sidebar; icon controls use 850ms. Keyboard `:focus-visible` still receives accessibility support, with Escape dismissal and `aria-describedby` on the actual trigger. Based on WAI-ARIA tooltip semantics.
5. **Tooltip on click or after modal dismissal:** Pointer down and clicks cancel/suppress tooltip until pointer leaves and re-enters; mouse-induced focus does not show it. This also prevents the mobile-data speed-test tooltip from reappearing while the pointer remains over its button after a modal closes.
6. **Auto-follow unstable:** No longer treats every `scroll` event (including programmatic bottom alignment) as user intent. Real upward wheel/keyboard/thumb interaction pauses following, following mode pins to bottom in `useLayoutEffect`, and only explicit Resume/Jump Latest re-enables it. Paused-state visual is amber and the informative badge lives alongside Pause/Resume in the toolbar, not floating under Copy/Export messages. The latest-log icon uses `ListEnd`, distinct from `FileDown` export.
7. **Tooltip for desktop speed and global Start/Stop:** Context-specific tooltips added without changing connection mechanics.
8. **Phantom gray bar above Wirebound version:** Actual culprit was the sidebar's horizontal overflow due to translating a full-width nav row on hover. The row no longer translates sideways, and the nav container has `overflow-x:hidden`. **Live round-3 proof:** sidebar `scrollWidth=199`, `clientWidth=199`, i.e. no horizontal scroll area.
9. **Motion:** existing transitions/reduced-motion support retained; compact panel heights adjusted structurally rather than masking elements with opacity alone.
10. **Release safety:** The user was testing active Android tethering during this session. Do not kill or replace an active `wirebound.exe`, `adb.exe`, `gnirehtet.exe` or reverse mapping. Build a separate QA package and swap only after authoritative disconnect preflight.

## Evidence and validation

- Unit tests: **84/84 PASS** across 14 files (one new informational-check regression). TypeScript web + node PASS. Electron Vite production build for main, preload, renderer PASS. Targeted changed-file ESLint PASS with 0 errors before final nested-grid adjustment; rerun if needed for release.
- The first actual packaged renderer check found that the collapsed diagnostic details content **was already 0px**, its idle feedback **0px**, but the progress grid **16px**. The dismissed notice had **18px** height. These were measured from Chromium `getBoundingClientRect()`, not inferred from the screenshots. The final nested-grid fix was rebuilt and packaged but was not yet run under Windows because the phone VPN became active.
- Old/live round-3 QA package: `F:\Wirebound-Lab\qa-packages\ux-audit-round3-20261030\wirebound.exe`, isolated userData profile `F:\Wirebound-Lab\qa-profiles\ux-audit-round3-20261030`, CDP 127.0.0.1:19675. Live renderer during active tethering: connected / `6/6 passed`.
- **Ready for a safe future handoff, NOT launched yet:** `F:\Wirebound-Lab\qa-packages\ux-audit-round3b-20261030\wirebound.exe`, actual QA-only repacked `app.asar` SHA256 `f0dfec9b907c8a59de537a53ced2c43e34a1af7f0df534fd9e3cc6330dbdc164`. Preserve this path and hash; never substitute the normal installed program or interfere with active tethering.

## Remaining QA gates

1. **Final nested-grid package**: verify collapsed diagnostics progress = 0px, dismissed banner = 0px, total compact panel and no horizontal nav scrollbar, visually under reduced motion and Windows scaling.
2. Tooltip user timing/click/modal dismissal and terminal manual upward scroll with continuous real logs, including follow state and unread.
3. Running service + Gnirehtet Android client state under the refreshed build, safe global Stop and per-device last/remaining device semantics. One phone only; two-device physical case remains waived.
4. Native Save dialog export formats and negative/error flows.
5. Maintain PR #67 as Draft until user reviews. No dependency upgrade.
