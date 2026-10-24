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


## Actual isolated Windows smoke — 2026-10-24

A second hand-built **QA-only** Windows package was assembled from the known intact v1.2 unpacked Electron runtime and the latest UI-first compiled main/preload/renderer bundles. Its archive at F:\Wirebound-Lab\qa-packages\issue44-ui-first-manual-v2\win-unpacked\resources\app.asar passed **15/15 SHA-256 payload checks**, zero failures. The embedded code and QA flag were verified. It is NOT a normal electron-builder package or installer.

Ran the isolated cold-start harness separately against this same QA executable, with separate QA profiles:

| Stage | UI-first opt-in | Normal control |
| --- | ---: | ---: |
| Main module started | 3,358ms | 26ms |
| Eager runtime cache start | — | 107ms |
| Window created | 10,103ms | 259ms |
| Renderer DOM ready | 17,505ms | 624ms |
| Full-size window shown | **17,577ms** | **641ms** |
| Deferred runtime scheduled | 17,577ms | — |
| Deferred ADB fingerprint began | 17,637ms | — |
| Deferred cache fully prepared | 18,479ms | — |
| ADB server ready | 19,391ms | 964ms |
| Populated React root verified | 19,962ms | 2,638ms |

Both were **PASS**, leaving zero QA Wirebound processes. UI-first displayed the application window **59ms before deferred runtime work began** and completed ADB/server preparation afterward. Normal control still loaded ADB before the window, without deferred markers. The source-controlled QA trace checker accepted both traces with exit code zero.

Evidence:
- F:\Wirebound-Lab\benchmarks\issue44-ui-first-smoke-20261024\attempt-1\startup.jsonl
- F:\Wirebound-Lab\benchmarks\issue44-ui-first-normal-control-20261024\attempt-1\startup.jsonl

**Interpretation:** This verifies lifecycle ordering, NOT a speedup. The UI-first attempt had a 17.6s startup and the immediately following normal control 0.64s amid drastically different cache/OS/HDD conditions. These sequential trials are not a controlled performance comparison. The native-window, renderer and early module stages still showed severe long-tail variation independently of ADB preparation. A true first-paint metric remains to be implemented, and actual Android tethering and installed NSIS parity are untested. Mode remains QA-only, PR Draft and issue #44 Open.


## 2026-10-24 follow-up: renderer failure fail-fast and paint metrics

Further audit found that the deferred service gate was activated on the BrowserWindow show event only. If Chromium failed to load the main frame and never displayed the window, device IPC could remain pending indefinitely. PR #51 now rejects the pending gate when a *main-frame* did-fail-load (except expected ERR_ABORTED code -3) or a renderer-process-gone event occurs. These paths do not trigger a blind reload. A subframe load failure or aborted navigation alone must not abort services. A completed readiness barrier cannot be retroactively rejected. Dedicated unit tests cover all four cases. Ongoing ADB pollers also stop sending stale snapshots if shutdown began while polling was awaiting a device response.

The existing QA-only renderer-root probe now records navigation-relative Performance Timeline first-paint and first-contentful-paint values (in milliseconds; -1 if unavailable), alongside the root child count and document readyState. This reads only performance numbers; no DOM text, URL, file path, settings or device ID is captured. Chromium paint entries and window-shown are distinct milestones: neither should be used as a substitute for the other, and trace correctness must be verified in actual Windows smoke tests.

The Settings page was also switched to a React.lazy dynamic import with a localized loading placeholder; dashboard and initial onboarding remain eager to preserve their current startup UX. TypeScript/web build confirmed Vite emitted a **25,986-byte Settings JS chunk**, and the initial renderer JS bundle decreased from **665,290 bytes to 642,681 bytes** (22,609 bytes / approximately 3.4% smaller). This is a **bundle-byte reduction, not a measured 3.4% startup speedup**. Verify actual Settings navigation and error behavior in an isolated packaged UI before release.

Windows checks after renderer failure changes: **75/75 Vitest tests passed across 13 test files**, Node and web typechecks passed, main/preload/renderer production build passed. The on-demand Settings change also passed the subsequent production source build. The official NSIS installer, device tethering parity and repeatable long-tail startup measurements remain outstanding.


## 2026-10-24 afternoon: recovered QA v3 package, Chromium paint, Settings navigation

The Windows HDD computer recovered after the prior interrupted manual-v3 ASAR assembly. A process audit at about 13:11 WIB found zero remaining QA packagers or Wirebound QA processes and one existing global ADB process (untouched). The previously uncertain v3 archive at F:\Wirebound-Lab\qa-packages\issue44-renderer-paint-manual-v3\win-unpacked\resources\app.asar was independently verified using scripts/qa/verify-packaged-asar.cjs: **16 payload files verified, zero skipped, zero SHA-256 failures**. The packed v1.2.0 app included the UI-first marker, deferred-renderer-failure guard and paint probe, plus a separate Settings-*.js chunk. Both Windows executable and native ADB/Gnirehtet resources were present. Manual QA-only packaging remains NOT equivalent to electron-builder/NSIS validation.

Two isolated UI-first runs on the same verified v3 executable:

| Milestone | Normal icon, extremely slow run | QA skip-icon control |
| --- | ---: | ---: |
| Main module started | 3,751ms | 126ms |
| Decode window icon | 1,980ms | 0ms |
| Native BrowserWindow creation | 8,732ms | 418ms |
| Renderer did-start-loading → DOM ready | 14,307ms | 185ms |
| Full-size window shown | **34,979ms** | **1,301ms** |
| Deferred ADB started | 34,983ms | 1,315ms |
| Deferred ADB cache ready | 36,110ms | 2,230ms |
| React root | Not confirmed before QA deadline | 3,193ms, rootChildren=1, visible=true |
| Chromium first paint (navigation-relative) | Not confirmed | **948ms** |
| Chromium first contentful paint (navigation-relative) | Not confirmed | **948ms** |
| Isolated harness status | **FAIL, timeout at 40 seconds** | **PASS** |

The slow run later recorded cleanup-induced GPU/renderer exits; this does NOT establish a spontaneous crash. The 40-second harness finished without a verified React root/FCP, so it must NOT be counted as a successful startup. On the fast run ADB runtime preparation completed; adb-server-ready was not recorded before the harness cleanup, so only deferred runtime preparation was confirmed. First Paint/FCP offsets are relative to renderer navigation, not process start.

**Causality limitation:** The difference cannot be attributed to omitting the icon alone. HDD/OS cache and scheduler conditions were uncontrolled and native window/renderer phases differed dramatically as well. Icon decoding, native BrowserWindow construction and renderer startup remain separate areas for future paired measurements.

### Settings navigation smoke, QA-only loopback browser debugging

A new isolated userData profile was seeded with the nonpersonal onboarding-complete test fixture. A short-lived CDP session bound to 127.0.0.1 opened the dashboard, clicked Settings, confirmed the form and checkbox controls rendered, then returned to Dashboard. The second smoke PASSED:

SETTINGS_NAVIGATION_PASS sidebar=true form=true lazySettingsRendered=true dashboardReturn=true

The first check had also rendered Settings but falsely rejected because the dynamic Settings JS request was not visible through performance.getEntriesByType('resource') on the file:// Electron app. That PerformanceResourceTiming value remains false and is not proof of broken lazy import: the chunk was independently verified inside the ASAR and its React controls worked. The corrected test verifies actual functionality and logs resource-timing observation separately. No settings values, device identifiers or page text were captured.

Local evidence:
- F:\Wirebound-Lab\benchmarks\issue44-renderer-paint-smoke-v3-20261024\attempt-1\startup.jsonl (slow; timeout)
- F:\Wirebound-Lab\benchmarks\issue44-renderer-paint-noicon-control-20261024\attempt-1\startup.jsonl (paint metrics; passed)
- F:\Wirebound-Lab\logs\issue44-settings-cdp-smoke.log (initial assertion too strict)
- F:\Wirebound-Lab\logs\issue44-settings-cdp-smoke-v2.log (actual navigation passed)
- F:\Wirebound-Lab\qa-settings-cdp-smoke.mjs and F:\Wirebound-Lab\run-qa-settings-cdp-smoke.ps1 (local-only test tools; exact QA process cleanup)

No source functionality was changed in this checkpoint. Official NSIS packaging, USB/ADB/Gnirehtet device parity, more extensive failure/shutdown tests and repeated comparable slow-start analysis remain outstanding. PR #51 stays Draft and issue #44 Open.
