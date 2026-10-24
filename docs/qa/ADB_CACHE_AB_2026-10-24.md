# Windows QA — ADB cache startup A/B, 2026-10-24

Status: research-only. Does not prove a production optimization. Issue #44 remains open; PR #51 stays draft.

## Hypothesis and safeguard

The synchronous getRuntimePaths()/prepareAdbCache() runs before Electron creates its BrowserWindow and can delay visible startup on an HDD. A QA-only flag named WIREBOUND_QA_SKIP_ADB_CACHE bypasses that step only if both WIREBOUND_QA_PROFILE_ISOLATION=1 and an absolute WIREBOUND_QA_STARTUP_TRACE file are set. Normal application launches still verify and populate the ADB cache. Windows unit tests for this gating and cache behavior: 14/14 pass (branch commit 2e19607).

A separate, previously verified packaged Electron build produced two isolated trace samples: a slow attempt spent 4,095ms creating the ADB fingerprint, 1,299ms constructing the window, 3,984ms loading the renderer and reached window-shown at 11,060ms. The next showed 28ms, 75ms, 566ms and 888ms respectively. This demonstrates multi-stage variability, not one isolated cache bottleneck.

## Special QA packaging — not suitable for release

Standard electron-builder packaging was too slow/unresponsive during dependency packing on the Windows HDD host, although typechecks and Vite builds passed. A diagnostic package was therefore manually assembled on drive F, copying the intact prior v1.2 Electron Windows runtime and embedded ADB/Gnirehtet resource tree, then replacing the application ASAR with the newly compiled main/preload/React bundle plus its required main-process runtime toolkit. Archive integrity was checked: 15/15 files passed SHA-256 payload verification, zero failures. The new QA flag and v1.2.0 manifest were independently verified inside the ASAR.

This 15-file manual ASAR is NOT the normal electron-builder output with approximately 3,960 files and is not an installer or release artifact. Use it only to evaluate the startup hypothesis. It should never be used as evidence of full release readiness.

## Measured runs

All eight launches used the same QA executable, normal window icon, separate absolute traces, distinct APPDATA/LOCALAPPDATA and Chromium userData/sessionData profiles, with no heavy external periodic monitoring. The required nonempty React root, visible main window and presence/absence of the QA marker were verified. The first balanced ABBA block was interrupted after two trials by a conservative leftover-process check; it was resumed for trials 3 and 4 after confirming zero remaining Wirebound processes. A second block used reversed BAAB order.

| Sequence | Mode | Visible window ms | ADB fingerprint ms | Window constructor ms | Renderer load ms |
| --- | --- | ---: | ---: | ---: | ---: |
| ABBA 1 | normal | 21,301 | 664 | 3,393 | 7,663 |
| ABBA 2 | skip | 1,628 | — | 120 | 1,065 |
| ABBA 3 | skip | 586 | — | 77 | 132 |
| ABBA 4 | normal | 1,237 | 183 | 76 | 238 |
| BAAB 1 | skip | 360 | — | 76 | 138 |
| BAAB 2 | normal | 1,030 | 55 | 100 | 671 |
| BAAB 3 | normal | 722 | 52 | 74 | 281 |
| BAAB 4 | skip | 384 | — | 86 | 153 |

Normal: 4/4 passed, median 1,133.5ms. QA skip: 4/4 passed, median 485ms. This apparent difference is descriptive only. The sample is small, OS disk cache/load are uncontrolled, and skipping cache switches from a verified per-user cached ADB executable path to the bundled ADB path. These factors preclude attributing the entire median difference to fingerprint overhead.

In the 21.3-second outlier, fingerprinting contributed only 664ms. Native window construction took 3,393ms, renderer loading 7,663ms, and main-loop heartbeat delay peaked at 7,230ms. Therefore cache work alone cannot explain this severe long-tail delay. Do not disable cache integrity in production.

## Evidence and follow-up

Raw CSV files are local to the QA computer:
- F:\Wirebound-Lab\benchmarks\issue44-adb-cache-abba-20261024\results.csv (first two)
- F:\Wirebound-Lab\benchmarks\issue44-adb-cache-abba-20261024-continuation\results.csv (last two)
- F:\Wirebound-Lab\benchmarks\issue44-adb-cache-baab-20261024\results.csv (reversed four)
- F:\Wirebound-Lab\benchmarks\issue44-cache-ab-8trials-summary.csv (combined phase analysis)
- F:\Wirebound-Lab\qa-packages\issue44-adb-ab-manual-v1\win-unpacked (manual QA package, not for distribution)

A portable source-controlled harness is at scripts/qa/compare-adb-cache-startup.ps1; it requires an existing packaged ASAR, uses isolated cold-start profiles, records trace markers and fails closed if application processes persist.

The next production approach worth prototyping is to create and render the UI before potentially expensive ADB cache preparation, with a safe readiness gate for all ADB-dependent IPC and a recoverable startup failure state. Validate that the window and ADB/Gnirehtet workflows still work under an installed NSIS package before any merge or release. Do not upgrade dependencies merely to address this issue or add a blind reload loop.
