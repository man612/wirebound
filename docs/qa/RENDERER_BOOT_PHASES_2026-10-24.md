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
