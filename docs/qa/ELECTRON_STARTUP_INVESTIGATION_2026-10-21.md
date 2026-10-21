# Windows Electron startup investigation — issue #44

## Problem to distinguish

Intermittent observations on Windows include an unpacked Electron process with a blank/undisplayed renderer and, in later QA runs, a live executable whose optional Chromium DevTools endpoint never became available. A missing debug endpoint **does not prove** a blank Electron page.

Electron's `ready-to-show` is a first-paint event, not a reliable diagnostic of why a load failed. A failed `BrowserWindow.loadFile()` promise and `webContents` lifecycle events contain separate evidence.

## Opt-in, privacy-limited startup tracing

Set `WIREBOUND_QA_STARTUP_TRACE` to an **absolute** path before launching the Windows application. No startup trace file is written for ordinary launches. The main process writes newline-delimited JSON (JSONL) containing only time, process ID, elapsed milliseconds, fixed lifecycle event names, failure codes/reasons and whether the React root has children.

The trace does **not** record device serials, connection traffic, user settings, URLs, file paths, DOM text, or IPC payloads. If writing the trace fails, normal application startup is unaffected. The instrumentation does not auto-reload the renderer.

Key events: `runtime-paths-start`, `runtime-paths-ready`, `adb-cache-fingerprint-start`, `adb-cache-fingerprint-ready`, `adb-cache-verify-start`, `adb-cache-verify-ready` (with number of files copied only), `settings-load-start`, `settings-load-ready`, `main-module-start`, `single-instance-lock`, `app-when-ready`, `window-created`, `renderer-load-requested`, `did-start-loading`, `dom-ready`, `did-finish-load`, `renderer-load-resolved`, `ready-to-show`, `window-shown`, `renderer-root-probe`, `did-fail-load`, `renderer-load-rejected`, `render-process-gone` and `bootstrap-rejected`.

**Further slow-path hypothesis:** before creating the BrowserWindow, Wirebound performs synchronous hashing, verification, and possible copying of three bundled ADB runtime files into the profile-specific cache. The added trace milestones distinguish ADB fingerprinting, file verification/copy, settings loading, and BrowserWindow construction. This might affect first-launch disk latency but is **not established as the cause** of the intermittent timeout.

## Windows evidence gathered on 2026-10-21

**Test scope:** Windows 11 Pro (build 26100), Electron 44.4.1. Both the UX branch PR #50 plus startup tracing and the baseline `main` plus the same tracing were packaged as local v1.2.0 NSIS builds. These are QA measurements, not official release claims.

- **Unpacked app, no DevTools flags:** 3/3 isolated cold starts passed; first visible window at 8,915 ms and React root populated at 9,217 ms, second at 789 ms / 2,790 ms, third at 1,076 ms / 3,073 ms. No manual reload.
- **Installed NSIS app, no DevTools flags:** silent QA installation exited 0, but 0/3 cold starts reached a visible, populated React root within **30 seconds**. Attempt 1 reached `window-creating` at 14,355 ms and never logged `window-created` before timeout. Attempt 2 reached `window-created` at 5,398 ms and `did-start-loading` at 7,168 ms, without `dom-ready` before timeout. Attempt 3 reached `window-created` at 891 ms and `did-start-loading` at 978 ms, without `dom-ready` before timeout. Neither `did-fail-load` nor `render-process-gone` was observed by the timeout.
- **Later installed-NSIS recheck with the same unchanged UX+trace installer** (65-second limit): after a fresh isolated QA installation, **2/2 passed**. Window show at **2,090 ms** / **942 ms**, populated root at **3,757 ms** / **2,836 ms**; both silent install and uninstall exited 0 and QA binary was removed. An earlier repeated attempt was aborted by a QA parameter-range error (requested 65 seconds but only 60 was accepted); it was **not an application failure**. The harness now accepts up to 120 seconds.
- **Baseline main+trace NSIS comparison (65-second limit):** **2/2 passed**, with window shown at **2,148 ms** / **629 ms** and populated React root at **3,768 ms** / **2,627 ms**. The installed `resources/app.asar` matched the unpacked `resources/app.asar` by SHA-256. QA installation and uninstall both exited 0; the user install directory remained absent.
- **Updated interpretation:** the 0/3 30-second installed results are **not deterministically reproducible** even with the same installer. Both PR #50+trace and baseline main+trace can load normally after actual NSIS installation, so the data do **not establish a startup regression caused by PR #50**. Do not attribute timeouts to NSIS, UX changes, ADB or a permanent blank renderer without additional OS/process evidence. Security scanning and system scheduling are unproven hypotheses; do not disable security.
- **ADB is not proven causal:** first unpacked attempt logged `adb-server-unavailable` but showed UI successfully. Installed attempt 3 also logged ADB unavailable, but that alone does not establish why navigation stalled.
- **Cleanup:** silent QA uninstaller exited 0, installed executable removed, normal user installer location remained absent. No actual Android tethering was initiated.
- **Signing:** test installer was independently reported `NotSigned`; do not distribute as an official release.

**Interpretation:** Startup behavior is intermittent: the same installed UX+trace build produced both 30-second timeouts and later sub-four-second successes, while the main+trace baseline also passes. A `startup-timed-out` observation is not evidence of a renderer crash or a permanent hang. Seek safe OS/Defender/process timing evidence or a controlled reproducible failure before proposing a targeted code fix. Do not close issue #44 or add an unconditional reload timer on this evidence alone.

## Follow-up: corrected QA classification and OS observations (2026-10-21)

Two subtle issues were found in the **QA harness**, not in Wirebound's connection services:

1. A QA-only `renderer-root-probe` may report `rootChildren > 0` while `visible: false`, because React can mount **before** Electron emits `ready-to-show`/`window-shown`. The old harness required the single probe to have `visible: true` and never reconsidered it when the window showed later, producing a false timeout. In one unchanged UX+trace NSIS run, React had mounted at **4,034 ms** and the window showed at **12,693 ms**. Despite both conditions being met, the old runner reported a timeout at 45 seconds.
2. The deliberate QA `taskkill /T /F` can append `render-process-gone` with `reason: killed` **after a successful startup**. Treating any such event anywhere in the saved timeline as an earlier crash also produces false negatives.

The new `startup-readiness.psm1` evaluates **chronological first success versus first failure**: a populated React root **and** a `window-shown` event, in either order, must occur before a fatal startup event. After this, a cleanup kill cannot retrospectively fail startup. Run `pwsh -NoProfile -File scripts/qa/startup-readiness.test.ps1` for **8/8 passing synthetic sequence tests**. `summarize-startup-traces.ps1` can reclassify saved JSONL evidence without launching or modifying the application.

### Measured Windows results

| Installed local NSIS experiment | Old runner result | Corrected classification / observation |
| --- | --- | --- |
| Baseline `main` + trace, 6 new isolated attempts | 6/6 pass | **6/6 loaded React and displayed the window**. Slowest first start: show 13.568s, populated-root probe 15.571s; remaining starts showed in under 1 second. |
| UX PR #50 + trace, 6 new isolated attempts | 5/6 pass, 1 timeout | **6/6 loaded React and displayed the window**. The timeout was the confirmed early-probe/late-show harness bug: root at 4.034s, show at 12.693s. |
| UX PR #50 + trace, 3 more newly installed attempts using corrected harness (45-second cutoff) | Not applicable | **2/3 pass, 1 real not-ready-within-45s observation**. In that attempt, `window-created` appeared at 16.520s and `did-start-loading` at 20.644s, but there was still **no `dom-ready`, `window-shown`, or populated root** by the deadline. No `did-fail-load` or renderer crash event appeared before cutoff. The other two showed the window in under 0.7s. |

The corrected tool distinguishes an actual **startup timeout** from a **permanent hang**: the script intentionally stops its own process at the configured deadline. It does not establish that the process could never eventually load if allowed to continue.

### Microsoft Defender: observations, not attribution

The Windows host reports Defender antimalware and real-time protection **enabled**; protections were never disabled or excluded. Optional `-ObserveResources` stores **only numeric** per-second QA process CPU/memory/handle counts and Defender engine cumulative CPU time. Optional `-CountDefenderEvents` stores **only event-ID totals**, not messages, file paths, user content, or antivirus detections.

- During the first slower baseline sample (14 one-second observations), Defender's cumulative CPU time increased **6.34 CPU-seconds**; most fast baseline runs showed approximately **0.20–0.47 CPU-seconds** during their shorter three-sample observations.
- The corrected-harness UX timeout (45 samples) showed an increase of **6.22 Defender CPU-seconds**, but **zero Defender operational events** occurred in that test window. This is not proof that Defender blocked the renderer. Comparing cumulative CPU deltas across different sampling durations is also confounded.
- No Defender scan performance trace or security configuration change was performed. Microsoft's `New-MpPerformanceRecording` can produce an elevated ETL recording containing kernel and scanning activity (and potentially sensitive file paths); it is **not necessary** for this limited privacy-preserving QA. Official reference: https://learn.microsoft.com/en-us/defender-endpoint/performance-analyzer-reference

**Updated conclusion:** the startup issue is genuinely **intermittent**, and earlier QA also contained an identifiable false-negative classification flaw. Both `main` and PR #50 exhibit slow startup observations, so these runs do not establish a regression caused by UX changes. Defender involvement, disk contention and the exact root cause remain **unproven**. Keep #44 open and avoid disabling protection, upgrading dependencies, or injecting blind reload loops.

## Reproduction (Windows QA)

1. Run the existing `npm run package:check` script to create `dist/win-unpacked/wirebound.exe`. It does not install or publish anything.
2. Run `pwsh -NoProfile -File scripts/qa/electron-cold-start.ps1 -Attempts 3 -WaitSeconds 25`.
3. The harness uses a distinct temporary APPDATA and LOCALAPPDATA per attempt, preserving startup event traces under your system temporary folder in `wirebound-cold-start-qa`. It will terminate **only its own** executable process after confirming the executable path.
4. Inspect each `startup.jsonl`; a passing attempt needs a `renderer-root-probe` with `rootChildren > 0` **and a `window-shown` event**, in either order, before any fatal startup event. The probe's own `visible` value can legitimately be false if the window shows later. The script returns nonzero for genuinely not-ready attempts.

Optional monitoring: add `-ObserveResources -CountDefenderEvents` to the harness command to save only numeric QA/Defender process measurements and Defender event-ID totals. Run `pwsh -NoProfile -File scripts/qa/startup-readiness.test.ps1` to test the sequence classifier, and `pwsh -NoProfile -File scripts/qa/summarize-startup-traces.ps1 -OutputRoot QA_OUTPUT_DIRECTORY` to reclassify saved traces. No Defender event messages, paths or personal file data are recorded.

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
