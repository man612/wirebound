# UI-first startup prototype — 2026-10-24 (PR #51, Draft)

## Why

Issue #44 reproduced long-tail Windows startup delays on an HDD. Normal main-process startup synchronously prepares/verifies the ADB cache before constructing BrowserWindow. An isolated 21,301ms launch spent 664ms in ADB fingerprinting, 3,393ms constructing the window and 7,663ms loading the renderer, with a 7,230ms main-loop heartbeat delay. Cache work contributes but does not account for all extreme delays.

The goal is to let the renderer/window show before ADB cache initialization, **without silently skipping ADB integrity checks or permitting tethering to use unverified runtime paths**.

## Current implementation — QA opt-in, NOT enabled for ordinary launches

Set the following **only inside an isolated QA harness**:

- WIREBOUND_QA_STARTUP_TRACE = absolute path to a trace JSONL in the QA profile.
- WIREBOUND_QA_PROFILE_ISOLATION = 1.
- WIREBOUND_QA_PROFILE_DIR = a real, distinct QA userData path accepted by Electron.
- WIREBOUND_QA_DEFER_ADB_RUNTIME = 1.

The UI-first flag is ignored without actual accepted QA-profile isolation. Production launch keeps the original eager service and ADB cache behavior.

When enabled:

1. Resolve UI/tray paths without preparing the ADB cache. Create BrowserWindow, wire tray/settings/telemetry and register IPC handlers.
2. On the **actual BrowserWindow show event**, start deferred preparation (once) using asynchronous file reads and writes. The historical bundled ADB fingerprint algorithm and per-file SHA-256 destination-integrity check are preserved. Corrupt destinations are repaired. If the cache cannot be prepared, the original warning+bundled-runtime fallback applies.
3. Only after paths are prepared construct AdbService and GnirehtetService with the **final** verified/fallback paths. A single StartupServiceGate promise coordinates concurrent IPC calls. All ADB/diagnostics/Gnirehtet IPC handlers authenticate the sender both before and after waiting.
4. Then initialize the ADB server, start device polling and apply auto-connect settings. Tray and renderer settings remain available independently of ADB readiness.
5. On shutdown, reject pending readiness calls rather than allowing new ADB work after quit. The gate is one-shot and never starts multiple engine instances.

Trace markers include deferred-runtime-scheduled, deferred-runtime-start, adb-cache-fingerprint-start/ready, adb-cache-verify-start/ready, deferred-runtime-ready, ready-to-show and window-shown. UI-first mode must show the full-size application window before the deferred runtime begins; a 16x16 helper HWND never counts.

## Current evidence / outstanding QA gate

Windows local QA checkout at D:\Projects\wirebound-ux-review-20261021. On this branch:

- Focused Vitest: **22/22 pass**, covering startup gate single-flight/cancel, ordinary-launch QA gating, async cache fingerprint compatibility, missing/tampered cache behavior.
- Node TypeScript typecheck: passed.
- Electron/Vite source production build plus node/web typechecks: passed.
- Native NSIS installer/package release validation, real-device USB/Gnirehtet tethering workflow, and measured UI-first Windows smoke with isolated profiles: **required before enabling outside QA**.

Do not infer a production speedup from the earlier ADB-skip A/B (median 1133.5ms normal vs 485ms skip); that experiment bypassed cache work altogether and used an old packaged Electron runtime. This new variant retains cache integrity but moves its I/O after UI display, a materially different intervention.

Safety constraints: Never merge/release without ASAR verification, a packaged Windows test with actual React content, a verified trace showing window-shown before deferred-runtime-start, positive and negative IPC tests (early/late operations, shutdown, corrupted cache, missing runtime), and ADB/Gnirehtet functional parity with a real Android device. The demo-only hand-built 15-file ASAR, if used for smoke QA due electron-builder HDD stalls, is **not** production-equivalent packaging.
