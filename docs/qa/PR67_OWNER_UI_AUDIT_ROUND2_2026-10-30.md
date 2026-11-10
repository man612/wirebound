# Wirebound PR #67 — owner UI/UX audit round 2 (2026-10-30)

## Original maintainer feedback and implementation

The maintainer identified fourteen UX defects and logical issues in the live Windows QA executable.

1. **Hover explanations**: a shared delayed-hover (550 ms) / immediate-keyboard-focus tooltip with a fixed portal overlay, for grouped sidebar destinations and important icon-only controls. The control itself retains its accessible label. See Microsoft Fluent 2 tooltip guidance.
2. **ADB $Ready**: the erroneous literal dollar prefix in JSX `ADB ${...}` has been corrected to `ADB {...}`; regression test prevents reappearance.
3. **Copy Report**: constant-width button with three cross-fading copy/copying/copied labels and icons, avoiding width jumps.
4. **Motion polish**: added CSS transitions for feedback text, notice-collapse, diagnostic progress, confirmation dialogs, responsive buttons and page navigation via native Document View Transitions with reduced-motion override. Motion has semantic purpose and does not prolong actual operations.
5. **Export**: Electron native Save dialog exposes **TXT, LOG, Markdown, JSON, CSV** filters. The chosen extension selects actual file content, not merely filename changes; JSON is structured with text lines, CSV escapes quotes and includes UTF-8 BOM for typical Windows spreadsheet handling. Unsupported extensions are rejected safely. Existing main process IPC trust and 100K report cap remain.
6. **Diagnostic progress**: the native ADB diagnostics emits *actual six-check milestones* to the renderer through narrowly scoped preload IPC; the bar fills smoothly from the completed-check ratio and shows 100% when the real operation completes. This is not a fake time-based counter. A failed early scan still reports finished work, with failure feedback.
7. **Diagnostic expand**: the existing grid-based panel transition remains and the chevron now rotates without icon replacement; the toggle occupies a constant width.
8. **'Checks complete'**: completion text fades out after a short delay instead of staying forever.
9. **Dashboard return**: only the first Dashboard mount initially expands diagnostics; returning from any other page respects the collapsed default, unless a failed check requires display.
10. **Global/per-device connection semantics**: per-device **Connect** replaces misleading Retry. Disconnect of the *last* VPN automatically stops the now-empty native autorun relay and returns to disconnected/Start; if other active clients remain, relay and global Stop remain. Regression tests cover both cases. No global `adb kill-server`.
11. **Copy Report feedback**: copied-to-clipboard feedback fades in/out without layout shifts.
12. **Speed test icon**: the phone speed test uses a `Gauge` speedometer icon, with a hover/focus tooltip.
13. **Terminal**: All/Errors, follow-pause/resume and jump-to-latest are disabled when empty. Jump-to-latest (`ChevronsDown`) differs from export (`FileDown`). Tooltips explain every action, including Pause/Resume; scrolling up auto-pauses and shows explicit paused state; Clear requires accessible animated confirm/cancel dialog, without ending the connection.
14. **Phone speed test when disconnected**: enabled whenever the ADB device is authorized. If Wirebound VPN is not connected, an accessible confirmation explicitly warns of possible Wi-Fi/mobile-data usage before opening Fast.com on the Android phone.

## Validation and safety

- Edits staged in the isolated **F:\Wirebound-Lab\ux-audit-20261030** worktree, based on existing Draft PR #67. No dependency upgrades and no changes to the ordinary Windows application.
- TypeScript main and renderer checks passed during round-2 implementation; original 83-unit suite passed after lifecycle and IPC changes. Further final checks are recorded in the PR discussion.
- The original QA session on Windows was found running its own F:-owned Gnirehtet relay. Do not silently kill it, force-stop the phone VPN, or replace its ASAR while in use. The round-2 executable must be staged separately and launched only after confirming the existing VPN/relay is stopped or using a genuinely independent non-conflicting sandbox.
- One physical Motorola is available. Earlier PR #67 real USB tethering/HTTPS/TUN Start/Retry/Stop passed on the *prior* build; do not misrepresent this redesigned build as physically validated without repeating it.
- Motion should also be visually assessed with Windows reduced motion and 125% scaling, multi-device semantics, long-log scroll, and native Save dialog paths. Unavailable interactions remain as explicit QA gates.

## References

- Fluent 2 tooltip usage: https://fluent2.microsoft.design/components/web/react/core/tooltip/usage/
- WAI-ARIA modal dialog pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- Material progress guidance: https://m1.material.io/components/progress-activity.html
- Electron native Save dialog: https://www.electronjs.org/docs/latest/api/dialog

## Final executed QA checkpoint

- **83/83 Vitest tests PASS** across 14 test files, including new real progress milestone and two Gnirehtet last-client/multiple-client lifecycle tests. All main and renderer TypeScript checks PASS; Electron Vite production build PASS; targeted ESLint of 13 changed runtime files **0 errors** (legacy formatting warnings remain outside this targeted check).
- The updated executable was repacked into a new, separate **`F:\\Wirebound-Lab\\qa-packages\\ux-audit-round2-20261030\\wirebound.exe`**, QA-only ASAR SHA256 **`7733b68a3aff96d8850b049a351a9990eba05877a0b256c6e58c9ed6e7965f39`**, original vetted EXE SHA256 `fa4da0bf6898251cb72848be3d0f56b34abf59eeded3df873dfdf443e18a73f8`. This is **not** a regular NSIS installation or release.
- Before switching from old QA, an independent renderer/CDP probe confirmed `status=disconnected`, `autoStart=false`, exactly one authorized Android, Gnirehtet VPN and reverse both absent. Process ownership guard found exactly five old F: QA Wirebound processes and one F: QA ADB; no native relay process/port. Targeted stop was followed by a transient process-list cleanup guard exception, but independent read-only confirmation showed **Wirebound 0, ADB 0, Gnirehtet 0, and ports 5037/31416/19669/19671 closed**. The new QA executable was then launched under fully independent `F:\\Wirebound-Lab\\qa-profiles\\ux-audit-round2-20261030` with telemetry and autoStart disabled, main PID **14344** and DevTools `127.0.0.1:19671`.
- Packaged renderer readback: v1.2.0, one authorized Motorola, eight sidebar entries, `ADB Ready` without a stray dollar, one device row with **Connect** label after global stop, no body overflow at 1000 CSS px, engine disconnected. Keyboard focus triggered **“Connected Android devices”** tooltip. An initial probe used the wrong localized speed-test accessible name and confused the two mounted-but-hidden confirmation dialog nodes; the corrected probe found the **enabled “Speed Test” button**, then verified that the **phone data-usage confirmation dialog was visible** and warned about mobile data; it canceled safely without starting the test.
- Actual Run Again GUI click: renderer received real `app:diagnostics-progress` stages **2/6, 3/6, 4/6, 5/6, 6/6**, progressbar reached aria-valuenow **100**, diagnostic disclosure expanded while running and collapsed afterward. Engine remained disconnected. These are actual packaged IPC / ADB checks, not mocked percentages.
- **Not yet fully accepted:** all desktop animations on non-default scaling/reduced motion, native Save dialog multiple-filter screenshots, long streaming-log pause/unread/clear modal with real entries, and physical VPN/HTTPS/TUN after new lifecycle behavior. Keep PR Draft until owner evaluation. Ordinary Wirebound installation and `main` remain unchanged.
