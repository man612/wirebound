# Renderer boot-phase QA instrumentation — 2026-10-24

**Scope:** Draft PR #51, issue #44. This is diagnostic work only, not a production startup optimization.

## Why this exists

Earlier isolated Windows HDD starts varied between under one second and 22–35 seconds. A 22,406ms start showed the first main-module trace at 3,299ms, `app.whenReady` at 8,054ms, native BrowserWindow construction taking 4,032ms, and renderer `did-start-loading` → `dom-ready` taking 8,266ms. The QA synchronous trace writer accumulated only 39.96ms **before** that window was shown. Thus a single ADB hash, the icon decoder or the logger cannot explain the long tail.

The existing renderer probe ran two seconds after `did-finish-load` and only checked that the React root contained a child. This cannot separate HTML/ES module evaluation, initial React commit, settings load, and the actual interface becoming available. A root child might represent an initial blank placeholder.

## Low-cost renderer milestones

A tiny, exception-tolerant `performance.mark` helper is added. It records only fixed event names, no user content, settings values, paths, URLs, device identifiers or network data:

- `wirebound:entry-evaluated` — renderer `main.tsx` reached its own top-level statement **after its statically imported module graph was evaluated**. It is not the first instruction executed by Chromium.
- `wirebound:react-first-commit` — `App` mounted and its first effect ran. This may still be the blank pre-settings placeholder, so it does **not** prove visible dashboard content.
- `wirebound:ui-settings-ready` — the React settings hook has completed loading and an `App` effect ran after that state was committed; the dashboard or onboarding selection can now render. It is not a real device-readiness or native paint milestone.

The helper ignores duplicate marks (important under React StrictMode), and fails open when the Performance API is missing or throws.

When a valid absolute QA startup trace is explicitly enabled, the existing Electron `webContents.executeJavaScript` probe collects only these numeric navigation-relative mark offsets plus `responseEnd`, `domInteractive`, first paint, first contentful paint, root child count/readyState, and window visibility. The QA window now samples once about 250ms after `did-finish-load` (`renderer-timing-early`) and preserves its prior two-second readiness probe (`renderer-root-probe`). It does not continuously poll the OS or read DOM text. The existing readiness harness remains compatible because its original `renderer-root-probe` event is kept.

`scripts/qa/startup-phase-report.ps1` reports the new navigation-relative milestones separately from process-uptime phase timings and remains compatible with old traces. **Navigation-relative values cannot be directly subtracted from `process.uptime()` based timestamps without a shared origin.** A `-1` or missing value means unavailable, not zero.

## Validation and release boundary

A new test file validates once-only marks and graceful failures of the Performance API. The full Windows Vitest suite and TypeScript/Electron-Vite build must pass separately. A verified packaged QA ASAR and a real isolated Windows launch are required to demonstrate that the numerical markers appear in Chromium. No new telemetry upload or remote endpoint is added.

This diagnostic does not change user-visible startup decisions, ADB cache integrity, Gnirehtet sidecars or normal release startup mode. Next steps should distinguish the delayed Chromium renderer import/evaluation and React settings/UI-commit from delay before renderer execution starts. Changes that significantly alter startup behavior remain QA-only until NSIS + real Android USB/ADB/Gnirehtet parity pass.

## Resume checkpoint — 2026-10-24 afternoon (unpackaged smoke still pending)

Windows QA checkout was inspected at clean commit `2575d38`; GitHub draft PR #51 was at `652a3a8`, exactly two commits ahead containing **only this documentation and `scripts/qa/check-renderer-milestones.ps1`**, so renderer/main/preload source code was identical. No Wirebound/Electron QA process appeared in the process-name inspection; no `dist/win-unpacked/resources/app.asar` file was returned by the checkout's local artifact check. Do not reuse incomplete `dist` output.

Directly reread the Windows validation logs under `F:\\Wirebound-Lab\\logs`:

- `issue44-react-milestones-tests.log`: **14/14 test files and 78/78 tests passed**, including three `startupMarks` cases. This is actual unit-test output.
- `issue44-react-milestones-build.log`: Node + web typecheck stages emitted no errors; Electron main, preload, and renderer Vite phases all ended with `built` markers (renderer 1,754 modules, main entry ~63.60 kB, preload ~2.20 kB, renderer main chunk ~643.16 kB and lazy Settings ~25.99 kB). The redirected log does **not** itself contain an explicit shell exit-code record; therefore report *completed compilation according to output*, not a separately verified shell exit code.
- No current manual QA ASAR for this milestone build has yet passed the packaged-archive hash verifier, and **no new Chromium navigation / ESM / React / Settings / FCP startup values were collected**. Smoke, official NSIS, USB/ADB/Gnirehtet parity and end-to-end release gate all remain **NOT TESTED** for these milestone changes.

### Source-level semantics audit

- `entry-evaluated` runs in the entry module after its static imports. It cannot measure the beginning of module download/evaluation or time before Chromium navigation.
- `react-first-commit` runs in an `App` effect after React commits. The first render can still be `<div className="h-screen w-screen bg-bg-primary" />` while `loaded` is false; it **must not** be treated as real visible UI readiness.
- `ui-settings-ready` runs in an `App` effect after `loaded` is true and the main dashboard/onboarding branch has been committed. However, `useSettings()` also sets `loaded=true` when settings IPC **rejects**, falling back to default settings. Thus the mark means *UI render path unblocked after settings request settled*, not proof settings IPC succeeded, paint completed, or device operations are ready.
- Both renderer probes are scheduled relative to `did-finish-load`; when settings IPC or React is slow, a mark absent from the two-second sample may simply be **late**, not necessarily failed. The existing QA harness still requires a visible native window and populated React root; a nonempty root alone is insufficient evidence of content readiness.
- `performance` milestones are navigation-relative. The process-main trace uses a different origin. Treat `-1` as unavailable and avoid mixing clock origins without explicit conversion.

The Windows remote command used to attempt a fast-forward encountered a stalled shell/fetch and its termination could not be fully confirmed. **Do not claim the Windows checkout was updated** without checking the process and HEAD again. No merge/release/dependency upgrade or production profile/global ADB change is justified by this checkpoint.
