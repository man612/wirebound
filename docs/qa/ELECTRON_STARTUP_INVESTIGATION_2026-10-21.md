# Windows Electron startup investigation — issue #44

## Problem to distinguish

Intermittent observations on Windows include an unpacked Electron process with a blank/undisplayed renderer and, in later QA runs, a live executable whose optional Chromium DevTools endpoint never became available. A missing debug endpoint **does not prove** a blank Electron page.

Electron's `ready-to-show` is a first-paint event, not a reliable diagnostic of why a load failed. A failed `BrowserWindow.loadFile()` promise and `webContents` lifecycle events contain separate evidence.

## Opt-in, privacy-limited startup tracing

Set `WIREBOUND_QA_STARTUP_TRACE` to an **absolute** path before launching the Windows application. No startup trace file is written for ordinary launches. The main process writes newline-delimited JSON (JSONL) containing only time, process ID, elapsed milliseconds, fixed lifecycle event names, failure codes/reasons and whether the React root has children.

The trace does **not** record device serials, connection traffic, user settings, URLs, file paths, DOM text, or IPC payloads. If writing the trace fails, normal application startup is unaffected. The instrumentation does not auto-reload the renderer.

Key events: `main-module-start`, `single-instance-lock`, `app-when-ready`, `window-created`, `renderer-load-requested`, `did-start-loading`, `dom-ready`, `did-finish-load`, `renderer-load-resolved`, `ready-to-show`, `window-shown`, `renderer-root-probe`, `did-fail-load`, `renderer-load-rejected`, `render-process-gone` and `bootstrap-rejected`.

## Windows evidence gathered on 2026-10-21

**Test scope:** Windows 11 Pro (build 26100), Electron 44.4.1, locally packaged Wirebound v1.2.0 from UX branch PR #50 with this startup instrumentation. These are QA measurements, not official release claims.

- **Unpacked app, no DevTools flags:** 3/3 isolated cold starts passed; first visible window at 8,915 ms and React root populated at 9,217 ms, second at 789 ms / 2,790 ms, third at 1,076 ms / 3,073 ms. No manual reload.
- **Installed NSIS app, no DevTools flags:** silent QA installation exited 0, but 0/3 cold starts reached a visible, populated React root within **30 seconds**. Attempt 1 reached `window-creating` at 14,355 ms and never logged `window-created` before timeout. Attempt 2 reached `window-created` at 5,398 ms and `did-start-loading` at 7,168 ms, without `dom-ready` before timeout. Attempt 3 reached `window-created` at 891 ms and `did-start-loading` at 978 ms, without `dom-ready` before timeout. Neither `did-fail-load` nor `render-process-gone` was observed by the timeout.
- **ADB is not proven causal:** first unpacked attempt logged `adb-server-unavailable` but showed UI successfully. Installed attempt 3 also logged ADB unavailable, but that alone does not establish why navigation stalled.
- **Cleanup:** silent QA uninstaller exited 0, installed executable removed, normal user installer location remained absent. No actual Android tethering was initiated.
- **Signing:** test installer was independently reported `NotSigned`; do not distribute as an official release.

**Interpretation:** The installed-versus-unpacked difference is reproducible under this QA time budget, but `startup-timed-out` is not the same as a renderer crash or proven permanent hang. A longer bounded attempt, safe OS/AV process observations, and a baseline comparison using the same Windows environment are needed to determine cause. Do not close issue #44 or add an unconditional reload timer on this evidence alone.

## Reproduction (Windows QA)

1. Run the existing `npm run package:check` script to create `dist/win-unpacked/wirebound.exe`. It does not install or publish anything.
2. Run `pwsh -NoProfile -File scripts/qa/electron-cold-start.ps1 -Attempts 3 -WaitSeconds 25`.
3. The harness uses a distinct temporary APPDATA and LOCALAPPDATA per attempt, preserving startup event traces under your system temporary folder in `wirebound-cold-start-qa`. It will terminate **only its own** executable process after confirming the executable path.
4. Inspect each `startup.jsonl`; a passing attempt includes a `renderer-root-probe` with `rootChildren > 0` and `visible: true`. The script returns nonzero for failed attempts.

These experiments do not automatically start tethering because fresh default settings have `autoStart: false`. ADB bootstrap may still inspect locally connected USB devices; the script never deliberately activates or disconnects their VPN.

## How to interpret a failed attempt

| Last evidence | Plausible area to investigate |
| --- | --- |
| No main-module event | Electron bootstrap, executable launch, process/OS security; investigate without assuming renderer failure. |
| `single-instance-lock.acquired = false` | Unexpected existing instance/profile collision. |
| `window-created` but no `did-finish-load` | Renderer navigation not completing; inspect main-frame `did-fail-load` code and load promise. |
| `did-fail-load` or `renderer-load-rejected` | Real renderer file / URL loading failure, not just a debug-port problem. |
| `render-process-gone` | Render-process crash; use reason/exitCode. |
| `did-finish-load` but rootChildren = 0 | HTML arrived but React may not have mounted: investigate preload, React errors, hydration/mount timing. |
| rootChildren > 0, but window hidden | Window visibility/show lifecycle issue; inspect `ready-to-show`. |
| rootChildren > 0 and visible, but DevTools port absent | Debug endpoint issue rather than proven blank renderer. |

Keep issue #44 open until repeated **installed NSIS** cold starts work without debug flags, and the failure is either explained or resolved. Do not add blanket reload loops or change dependency versions solely in response to an unproven cause.

Official Electron references: https://www.electronjs.org/docs/latest/api/browser-window and https://www.electronjs.org/docs/latest/api/web-contents
