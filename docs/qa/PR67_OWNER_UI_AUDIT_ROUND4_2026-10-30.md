# PR #67 Owner UI/UX audit round 4 — 2026-10-30

## Maintainer observations (screenshots of live Windows QA)

1. Upward scrolling must **not** change the selected auto-follow toggle. Resume styling was oversized and bright; permanent "Auto-follow paused" badge wasted toolbar width. Transitions on controls were too abrupt.
2. Maintainer's item 2 was only "gaada wkwkw" and did not specify an actionable change.
3. **"Relay and Android VPN are active"** notice must also offer a dismiss X.
4. Diagnostics progress appeared at a nonzero percentage and sometimes seemed to regress.
5. **Connect** for each Android phone was disabled while global Start was idle, and required clicking global Start first.
6. Jump-to-latest log entry lacked smooth scrolling.

## Implemented

- Rebuilt terminal follow state: **explicit Pause/Resume is now completely independent of scrolling**. Upward wheel/keyboard or deliberate thumb scrolling temporarily detaches the viewport so new logs do not steal the reader's position. The user's mode stays Follow. Scrolling back to the bottom or clicking Jump reattaches; the per-device log badge counts unread lines. Only pressing Pause/Resume changes that mode. A lightweight **fixed-width** crossfade button replaces the resizing label, and "Auto-follow paused" is a transient (1.5-second) small overlay *inside* the terminal, not a permanent toolbar pill. No orange/yellow screaming state. Jump-to-latest now uses browser native `scrollTo({behavior:'smooth'})` with a guarded follow-up alignment for logs arriving mid-animation. Copy/Export/clear behavior and serial redaction are retained.
- The ready/active status notice can be closed in **every state** (including "Relay and Android VPN are active") via its X. A dismissed notice is re-evaluated when the underlying state tone changes; no hidden layout gap.
- Real diagnostic IPC milestones (0–6) are now serialized and displayed in order at 200ms intervals; a fresh run starts from a reset `attempt` ID and the 0% frame is painted first. This is a **pacing buffer of real, completed checks**, not time-based fake progress. The fill never rewinds; errors are not silently reported as 100% successful.
- Android per-device Connect is enabled whenever the ADB device is authorized, the engine is not in a global connecting transition and the row action isn't busy. If no relay exists, it starts a targeted `gnirehtet relay -p <port>` process and executes `gnirehtet start <serial> -d <dns> -p <port>`. This does **not** use global `autorun`, and never silently starts all other connected phones. Native relay CLI accepts `-p`; DNS belongs to the phone start command. Global Start keeps its original all-device autorun behavior. As before, last-client Stop tears down the idle relay; cancellation generation checks and draining of pending device operations protect Stop/start races. Global button becomes a usable Stop while the engine is still connecting to enable cancellation rather than trapping the user behind a disabled button.
- Source usage guidance: https://github.com/Genymobile/gnirehtet (v2.5.1 commands `relay`, `start [serial]`, `autorun`) and https://learn.microsoft.com/en-us/windows/win32/uxguide/progress-bars (never rewind progress).

## Real Windows QA and boundaries

- At code validation, **86/86** existing+new tests passed (two new targeted relay lifecycle tests); TypeScript web/node and Electron Vite main/preload/renderer build passed, changed runtime ESLint zero errors. The additional markup coverage for enabled idle Connect and dismissible active banner is included in a final test re-run.
- New, real packaged QA executable was **started** under `F:\Wirebound-Lab\qa-packages\ux-audit-round4-20261030\wirebound.exe`, with wholly separate QA profile `F:\Wirebound-Lab\qa-profiles\ux-audit-round4-20261030`, remote debugging on loopback port **19677**, and autoStart:false. QA-only `resources/app.asar` SHA256: `aca4aef611f1a3f22d853b24ab0ed72b9baf38c156671e1043484121d8fd94e7`. No regular installation/profile or main branch touched.
- Independent preflight before switching confirmed previous QA disconnected, one authorized Motorola, Gnirehtet VPN inactive, no reverse mapping, and no global autoStart; only prior F:-owned processes stopped. Real new renderer while disconnected: one authorized Moto, **Connect button enabled** and Speed Test enabled, eight sidebar entries, global Start available.
- Live diagnostic rerun **PASS**: 0% at click/80/180ms, 33% at ~340ms, 50% ~510ms, 67% ~680ms, **100% ~850ms**, with genuine IPC check completion events (2/6, 3/6, 4/6, 5/6, 6/6). No reverse transition.
- Controlled end-to-end test of the direct device Connect was **aborted before any click** when the renderer preflight observed a **user-active connected VPN** (one active Android) instead of the expected disconnected state. This is not evidence of a failed or successful physical Connect path. **Never kill the active Wirebound session or Gnirehtet to force the test.** Owner must inspect the button and perform physical validation at an appropriate disconnected moment.
- Still to QA: active-banner X and terminal scrolling/animations under incoming real log stream from the final running package; physical targeted device start/stop and HTTPS/TUN, multiple phones unavailable. Keep PR Draft.

## Non-changes / safeguards

No dependency upgrades. No normal Windows installation change. No global `adb kill-server`. No merge or release. All changes belong in existing PR #67, not competing PRs.

## Final test addendum

- After adding a regression for idle-device Connect accessibility and dismissal of the active VPN notice, the entire suite was rerun: **87/87 Vitest PASS across 14 files**, TypeScript web PASS; node TypeScript, full Electron Vite production build and targeted changed-runtime ESLint had passed before this **test-only** addition. This change to a test file does not modify the already launched executable.
- The source change to global Start/Stop explicitly enables **Stop while connecting**, making a failed/pending manual relay stoppable without trapping the user behind an unclickable button.
- The attempted CDP direct-connect physical test aborted at preconditions: **the owner already had status connected, one active Android client**. It issued zero UI clicks and never stopped any running process. Subsequent native process checks were inconsistent with that momentary connected snapshot due to concurrent user testing; do not claim a clean controlled physical test.
