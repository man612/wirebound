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

## Follow-up: unpacked Electron with fine-grained ADB timing (2026-10-21)

After rebuilding from this issue #44 instrumentation branch (based on `main`, without the PR #50 UX changes), the unpacked Windows application was launched **four times**, with a fresh QA APPDATA/LOCALAPPDATA profile each time and a 55-second readiness deadline. No debugging port, real VPN action, or change to Windows Defender configuration was used.

| Attempt | Startup result | ADB runtime paths (fingerprint / cache verify) | BrowserWindow constructor | Navigation / renderer |
| --- | --- | --- | --- | --- |
| 1 | **Timeout at 55s** | 1,388ms total (1,077ms / 20ms) | **17,149ms** | Load began; no `dom-ready` before deadline. The main module's first recorded event was already at 26,613ms process uptime. |
| 2 | **Timeout at 55s** | 268ms total (238ms / 7ms) | 286ms | Load began; no `dom-ready` before deadline. |
| 3 | **Pass** | 431ms total (404ms / 8ms) | 162ms | `did-start-loading` to `dom-ready`: **16,348ms**. Window shown at 17,438ms, React-root probe at 19,404ms. |
| 4 | **Pass** | 52ms total (28ms / 7ms) | 91ms | `did-start-loading` to `dom-ready`: 316ms. Window shown at 616ms, React-root probe at 2,648ms. |

During the two 55-second timeouts the QA main process accumulated only approximately **0.52 seconds of CPU** each. Defender engine cumulative CPU increased approximately **3.92 / 5.45 CPU-seconds** across those 55-second observation windows. Normalizing the Defender deltas by the number of one-second samples yields approximately **0.071, 0.099, 0.079 and 0.093 CPU-seconds per elapsed second** for attempts 1 through 4 respectively, including both the slower and the fast attempts; the larger raw cumulative deltas primarily reflect **longer observation windows**, not demonstrated antivirus blocking. The four experiments produced **zero Defender operational events inside their measured windows**. These are **observational values**, not proof that Defender, disk I/O, system scheduling, ADB or Electron's GPU subsystem caused the delay. An OS process may be blocked or waiting while using little CPU; sampling does not identify the wait source.

**What this rules down:** ADB hashing/verification does **not account for the tens of seconds** missing in these particular runs. At least two distinct stalls were observed: slow main process/BrowserWindow creation and slow renderer navigation. The phenomenon occurs with an **unpacked main-based build as well as installed NSIS builds**, so it is **not exclusive to NSIS or PR #50**.

**Additional trace coverage for the next reproduction:** the instrumentation now separates primary-display query, window icon loading and BrowserWindow construction, and records unresponsive/responsive renderer transitions plus unexpected Electron GPU/utility child-process exits. These additions are strictly opt-in trace events, not a renderer auto-reload or GPU setting change.

To get a compact timing breakdown from preserved JSONL files, use `pwsh -NoProfile -File scripts/qa/startup-phase-report.ps1 -OutputRoot QA_OUTPUT_DIRECTORY`. Interpret absent events as **unobserved**, not as a zero-millisecond stage. Use the startup readiness classifier to distinguish confirmed root+window visibility from timeouts and later QA cleanup kills.

Official Electron performance guidance recommends measuring bottlenecks and not blocking its main process with unnecessary synchronous I/O: https://www.electronjs.org/docs/latest/tutorial/performance . This report does not advocate an unmeasured optimization or disabling host security.

## Important separate finding: ASAR corruption caused by packaging inputs changing

During this investigation, a **local unpacked package** made with Electron Builder unexpectedly exited **code 1 before any main-module trace**. Electron Builder had reported exit code **0**. Examination of its `dist/win-unpacked/resources/app.asar` exposed a genuine payload/header inconsistency:

- ASAR header's `docs/qa/ELECTRON_STARTUP_INVESTIGATION_2026-10-21.md` entry declared **16,612 bytes**, whereas the same working-tree report had grown to **16,974 bytes** (**362-byte delta**) while the asynchronous packaging session was active.
- The first corrupted payload was that QA document. All following payloads had incorrect offsets, including `out/main/index.js`, preload, renderer JS/CSS/HTML and `package.json`. With the ASAR's 8-byte prefix correctly accounted for, the raw file data for `package.json` was displaced by **362 bytes** relative to the header's declared offset.
- `package.json` extraction returned a fragment of renderer HTML/CSP rather than a JSON manifest, consistent with Electron aborting **before** the JavaScript main module. This was reproduced by checking raw archive bytes, not inferred merely from process exit codes.
- A new verification tool (`node scripts/qa/verify-packaged-asar.cjs PATH_TO_APP_ASAR`) checks **every embedded SHA-256-protected file** against its header integrity hash and verifies the Wirebound manifest and required Electron entrypoints. It rejected the corrupted archive (**3,969 entries inspected, 12 failures**) and accepted a known-good earlier package (**3,967 entries, 0 failures**).
- A synthetic corruption regression test (`npm run qa:asar:test`) creates a valid ASAR, verifies it passes, alters one payload byte without updating the header, and verifies the checker fails. No external dependency upgrade is required.

**Prevention:** `electron-builder.yml` now excludes `docs/**` from runtime packaging because QA reports are not application assets; `scripts/**` was already excluded. The existing `package:check` pipeline now runs the synthetic validator test before packaging and scans the built ASAR afterward; `build:win` and `build:unpack` also scan the built ASAR. This means an Electron Builder exit-0 **cannot automatically be interpreted as packaging success** if the runtime archive contains mismatched payloads.

**Root-cause qualification:** Concurrent editing of an included documentation file is strongly supported by the matching 362-byte displacement and the observed packaging/edit timeline, but the exact internal packer race is not independently instrumented. This **corrupt local QA artefact is a separate issue** from earlier startup stalls reproduced on archives that successfully mounted React. Do not claim fixing packaging input stability fully resolves intermittent #44 startup timing.

### Frozen-checkout rebuild and smoke validation (2026-10-22)

After committing the packaging guard to a clean worktree, **no source or documentation files were edited while Electron Builder was packing**. The complete local Windows `npm run package:check` returned **exit 0**. The new guard inspected **3,960 SHA-256-protected ASAR payloads, zero mismatches**. Independent header checks confirmed `docs/**` was absent, while the manifest and compiled Electron main module remained present.

With the verified unpacked executable and **three fresh isolated QA profiles** (no DevTools port, no manual renderer reload), the corrected cold-start harness returned **3/3 PASS**:

| Attempt | Window shown | React root probe | Notable phase |
| --- | --- | --- | --- |
| 1 | 9,029ms | 11,014ms | 905ms runtime paths, 1,294ms BrowserWindow construction, 5,751ms renderer loading |
| 2 | 625ms | 2,619ms | 87ms BrowserWindow construction and 306ms renderer loading |
| 3 | 568ms | 2,564ms | 83ms BrowserWindow construction and 265ms renderer loading |

The test subprocesses were terminated by the scoped QA harness after success, no Wirebound QA executable remained running, and the user's normal install path was not used. This was **unpacked smoke QA only**, not an installed NSIS comparison for the exact newly guarded commit, not a phone VPN connectivity retest, and not an official release.

**Assessment:** The distinct ASAR corruption in the previous local package is addressed for this clean build and guarded against in future packaging commands. The underlying intermittent slow/blank startup tracked by #44 **remains open**, since valid packages in earlier experiments still showed navigation or BrowserWindow delays beyond the chosen deadline.

### Full NSIS installer validation and hosted CI enforcement (2026-10-22)

An installer was rebuilt from the clean guarded commit `8449d8d` with `npm run build:win` on Windows. Electron Builder returned **exit 0**, generated `dist/wirebound-1.2.0-setup.exe`, and the post-package guard verified **3,960 SHA-256-protected ASAR entries, zero failures**. The unsigned **local QA installer** had SHA-256:

`B5CC8A6A69682E65AECD7E36A6C0B4D9140911085191E44FB6FE972D62C2365E`

This checksum applies **only to this locally built installer**, not a future GitHub release asset. Authenticode status was `NotSigned`.

The installer was silently installed into an isolated QA path, and its `resources/app.asar` had the **identical SHA-256** as the unpacked reference from the same build. The corrected startup harness then performed **6/6 successful** cold launches (fresh APPDATA/LOCALAPPDATA on each launch) with a 60-second deadline, without browser-debug flags, reloads or real Android VPN actions. Windows showed the window at **0.598–1.890 seconds** and confirmed a populated React root at **2.679–3.884 seconds** across those six trials. One cleanup-related `render-process-gone` event appeared *after* an otherwise successful startup; the chronological classifier correctly preserved the success. Silent uninstall exited **0**, the QA executable was removed and the normal per-user Wirebound install location remained absent.

A reusable, safety-checked helper was added at `scripts/qa/nsis-installed-smoke.ps1`. It refuses to run when the default or registry-recorded user installation exists or an unrelated Wirebound process is running; installs only into an isolated QA folder; checks the installed-vs-unpacked ASAR checksum **and full embedded SHA-256 integrity**; runs the chronological readiness harness; and attempts silent cleanup even if a test fails. The helper itself also passed **2/2 independent installed cold starts** on the same installer, with a successful uninstall and no residual QA executable.

To repeat the manual GUI/installer validation from a clean checkout on Windows:

```powershell
npm run build:win
pwsh -NoProfile -File scripts/qa/nsis-installed-smoke.ps1 -Installer dist/wirebound-1.2.0-setup.exe -Attempts 3 -WaitSeconds 60
```

**Hosted CI coverage correction:** The Windows GitHub workflow previously called `npx electron-builder --win --dir` directly; therefore prior green CI runs did **not** execute the new ASAR integrity gate. It now runs `npm run qa:asar:test` before packaging and `npm run qa:asar` immediately afterward, failing the job if a SHA-256 payload does not match. Interactive installed NSIS launches are **manual QA**, not misrepresented as tests performed on headless GitHub Actions.

**Remaining boundary:** six installed passes plus two helper-validation passes increase confidence in installer integrity, but they do **not** explain the unrelated earlier slow/blank Electron cases on valid ASAR packages. Keep #44 open until the remaining intermittent root cause is identified or consistently ruled out. No dependency upgrade, merge, real-device VPN retest, Windows security change or release publication was made.

### Rebuild discipline

Use an unchanged Git checkout from the start of Electron Builder's packaging phase until validation finishes. For a real release, use a clean immutable checkout and run `npm run package:check` in full, then verify the actual installer payload separately. Do not modify files included in `app.asar` during packaging, even if the edits seem to be documentation-only.

## 2026-10-22 follow-up: healthy ASAR still shows a long-tail startup

Before any new runtime instrumentation was added, the integrity-guarded **same unpacked Electron artifact** passed `npm run qa:asar` (**3,960 of 3,960 embedded payload hashes match**), with no existing Wirebound process or default user installation. Eight fresh APPDATA/LOCALAPPDATA cold starts used the corrected chronological readiness harness with a **70-second timeout**, no debug port, and resource sampling. **All 8/8 passed without reload**, but the first attempt still showed a substantial startup outlier:

| Measurement | Slow first attempt | Other 7 attempts |
| --- | ---: | --- |
| First main-module event after process start | 2,374ms | 50–105ms |
| Runtime path setup | 575ms | 38–460ms |
| `new BrowserWindow()` | **5,275ms** | 79–126ms |
| Navigation start to `dom-ready` | **11,209ms** | 257–1,386ms |
| `window-shown` | **24,716ms** | **576–2,147ms** |
| Populated React root probe | **26,369ms** | 2,562–4,148ms |

During that 24.7-second visible-window delay, the main process sampled only ~0.66 cumulative CPU-seconds over 28 samples; Defender had ~5.31 CPU-seconds over the same interval. Those totals are descriptive only and **do not prove** antivirus contention, stalled disk I/O or GPU failure.

One notable temporal coincidence: in the slow attempt, `adb-server-ready` occurred at **24,291ms**, and `dom-ready` at **24,349ms**—58ms later. The ADB server bootstrap uses asynchronous sockets/process calls, and other valid earlier tests rendered even when ADB was unavailable. Therefore the correlation does **not establish ADB as the cause**; system-wide scheduling or I/O stalls could delay both events.

### New QA-only event-loop heartbeat

The startup trace now supports a **bounded main-process event-loop heartbeat**: once every five ticks (~5s) and whenever a one-second timer fires >500ms late, it records only `main-loop-heartbeat` with numeric tick and delay. It is activated **only** when `WIREBOUND_QA_STARTUP_TRACE` points to an absolute path; it does not run in ordinary app sessions, does not collect paths or process command lines, calls `unref()`, and stops by 120 seconds or 120 ticks. Two new unit tests cover the default-disabled behavior and bounded QA output.

Interpretation on future long-tail samples: regular heartbeats while the renderer is slow suggest a renderer/navigation or other asynchronous bottleneck; prolonged heartbeat gaps suggest main-loop starvation or OS scheduling delays. Neither pattern alone proves a specific root cause. The heartbeat is diagnostic only—no automatic reload, GPU flag, ADB dependency change or security exclusion is introduced.

### Event-loop heartbeat observed in a rebuilt, ASAR-verified Windows app (2026-10-22)

From frozen commit `8585767`, `npm run build:unpack` returned **exit 0**; the full ASAR verification checked **3,960 files, zero mismatches**. Eight fresh-profile QA launches of this new unpacked executable, with a 70-second deadline, produced **8/8 PASS** and no manual reload. No physical VPN start, debugging port or Windows Defender exclusions were used.

| Metric | One slower startup | Seven faster startups |
| --- | ---: | ---: |
| `main-module-start` elapsed | **5,559ms** | 49–60ms |
| Runtime path setup | 876ms | 37–63ms |
| Display query | 687ms | 0–1ms |
| Window icon load | **2,037ms** | 4–7ms |
| `new BrowserWindow()` | **2,667ms** | 81–328ms |
| `did-start-loading` to `dom-ready` | **2,848ms** | 166–561ms |
| Window visible | **20,144ms** | 598–894ms |
| React root populated | **21,300ms** | 2,593–2,885ms |

The slower trace had numeric heartbeat records: **tick 1 delayed 2,053ms**, **tick 2 delayed 7,642ms**, **tick 3 delayed 945ms**, followed by a healthy 5th tick (1ms late). The 7.6-second main-loop timer gap overlaps the sequence of synchronous native/filesystem work (ADB fingerprinting, display query, icon decode and BrowserWindow constructor). **This demonstrates that the main event loop failed to run its one-second callback on schedule**; it does not establish exactly which operation or OS scheduling condition was responsible. The absence of heartbeat records on quick launches is expected when launches finish before the periodic fifth tick; it is **not a measured zero-millisecond delay**.

In this slower trial, `dom-ready` occurred at **19,294ms** and `adb-server-ready` at **21,033ms**, i.e. **the renderer loaded 1,739ms before ADB readiness**. This is additional evidence against treating ADB startup as an unconditional blocker of renderer load.

`scripts/qa/startup-phase-report.ps1` now summarizes the initial main-module timestamp, display/icon/native window timings, heartbeat event count and maximum reported late-timer duration alongside renderer phases. These traces are limited to QA numeric metadata; **no operating-system security setting, runtime dependency or VPN behavior was changed**.

**Next decision:** determine whether native synchronous window preparation should be reordered or made nonblocking, with a controlled A/B QA comparison before changing the production startup path. A long heartbeat gap is not by itself a reason to disable GPU or add a blind renderer reload. Keep #44 open.

## 2026-10-23 controlled A/B: is native window icon decoding the cause?

**Hypothesis:** Windows image decoding for the frameless BrowserWindow icon might be a major contributor to occasional 20–25-second startup stalls. To isolate this without affecting normal users, commit `3d588b8` added `WIREBOUND_QA_SKIP_WINDOW_ICON=1`, strictly gated behind an **explicit absolute `WIREBOUND_QA_STARTUP_TRACE` file path**. Ordinary application launches continue to decode and display the normal icon. The harness's `-SkipWindowIcon` switch changes **only that one variable**, and records `skipped: true/false` at the icon stage. Production icon handling and the renderer were not changed.

### Protocol and integrity

- Windows 11 QA host YASMAN; same `dist/win-unpacked/wirebound.exe` executable for **all 48** starts, identical application binaries/renderer/dependencies in both groups; all starts used their own APPDATA and LOCALAPPDATA directories.
- `npm run build:unpack` **PASS** on the frozen `3d588b8` source. The post-package check verified **3,960/3,960** embedded ASAR payload hashes. The ASAR SHA-256 was `86E1BC55A90A4373C7A0ABD030B4766813110BD693D9803C8E07A66337FD360C`; the unpacked `wirebound.exe` SHA-256 was `00F88D9B92A432C858AD437E9F6362A6B12CFC27F8E4EA1BBB4295B28F0B5AAF`. These are **local QA artefact hashes**, not signed or published installer checksums.
- First run: **6 balanced blocks** of `normal, skip, skip, normal` = 24 starts. Second run: **6 balanced blocks** of `skip, normal, normal, skip` = 24 starts. Each start had a **70-second** deadline; the script checked both the visible window and populated React root in event order. All **48/48 passed**; no reload.
- Both sequences used one **same binary** for both modes. This counterbalancing helps, but **does not fully control Windows scheduling, file cache, or other system activity**.

### Numeric observations

| Measurement | Normal icon (24 starts) | QA skips icon decode (24 starts) |
| --- | ---: | ---: |
| Window+React startup tests passed | **24/24** | **24/24** |
| Median `window-shown` | **638.5 ms** | **648.5 ms** |
| 90th percentile `window-shown` (nearest rank) | 865 ms | 1,279 ms |
| Maximum `window-shown` | 4,181 ms | 2,816 ms |
| Median `window-icon-load-start` → ready | 5.0 ms | 0.0 ms |
| Median `new BrowserWindow()` duration | 92.5 ms | 32.5 ms |
| Median navigation to `dom-ready` | 297.5 ms | 333.5 ms |

The first run's **first trial** was normal-icon and took **4,181 ms** to show a window, with a 2,173ms main-loop heartbeat delay. Reversing the order caused the other run's **first trial**, **without** icon decoding, to take **2,816 ms** (heartbeat delayed 931ms). This is evidence that **slower initial launches can occur independently of decoding the icon**, consistent with a first-run/system-cache confound. It is not a demonstration of the precise OS mechanism.

The mode without icon does spend **~60ms less median time inside the native BrowserWindow constructor** and avoids ~5ms median synchronous icon decoding; however the **overall median window-show time did not improve** (648.5ms skip versus 638.5ms normal) and the skip group had a slower 90th percentile in this limited sample. Neither series reproduced the rare 20–25-second outlier, which remains possible with a larger sample. No statistical claim of causation or permanent resolution can be made from 24 attempts per mode.

**Decision:** **Do not remove or alter the user's production Wirebound icon** based on these numbers. This QA-only experiment rules down the icon as a necessary cause of long startup stalls, not every possible interaction with the native window manager. Keep #44 open. No runtime behavior, ADB/Gnirehtet connectivity, GPU flags, antivirus configuration, dependency version, installation or published release was changed.

### Reproduce the paired experiment

```powershell
npm run build:unpack
pwsh -NoProfile -File scripts/qa/compare-window-icon-startup.ps1 -Rounds 6 -WaitSeconds 70 -OutputRoot YOUR_EMPTY_QA_FOLDER_ABBA
pwsh -NoProfile -File scripts/qa/compare-window-icon-startup.ps1 -Rounds 6 -WaitSeconds 70 -StartWithSkip -OutputRoot YOUR_OTHER_EMPTY_QA_FOLDER_BAAB
```

The A/B script refuses to run if a Wirebound instance is active, the default user install exists, the expected packaged ASAR is missing or a named QA output directory already exists. It delegates individual launches to the path-checked cold-start harness, saving numeric `icon-ab-results.csv` and each attempt's trace locally. It never auto-installs, starts a VPN, mutates user settings, disables Windows protections, or uploads local process logs.

## 2026-10-23: launch-gap QA, trace-on/off comparison and corrected profile isolation

### Long-tail startup reproduced in different conditions

On the same existing ASAR-verified unpacked executable, an **observational** `compare-launch-gaps.ps1` experiment compared 2-second versus 20-second pauses using a balanced sequence and 70-second per-attempt deadline:

| Group | Outcome | Median `window-shown` among observed passes |
| --- | --- | --- |
| Unscored warm-up | Window shown **55,257ms**; first main event **7,426ms**; maximum heartbeat lateness **19,586ms** | — |
| 2-second gap (6) | **6/6 passed**, including a **51,232ms** launch | **751.5ms** |
| 20-second gap (6) | **5/6 passed**; one remained without `dom-ready` or a visible window by the 70-second QA cutoff | **710ms** |

The 20-second-gap timeout showed first main trace at **60ms**, `window-created` at **336ms**, and `did-start-loading` at **376ms**. Heartbeat lateness reached **17,626ms**, yet from roughly 26 seconds onward it resumed regular ~5-second entries while the renderer still had not reached `dom-ready` past **70 seconds**. There was no recorded `did-fail-load` or renderer crash before the harness terminated its own process. This is **not proof of a permanent deadlock**, since the QA intentionally imposed a deadline.

The 2-second-gap outlier showed `window-shown` at **51,232ms**, `new BrowserWindow()` lasting ~**9,913ms**, and event-loop heartbeat delay reaching **16,453ms**. Because both gap treatments exhibit major delays, there is **no evidence that simply waiting 20 seconds between launches fixes #44**. The warm-up launched under the same QA harness and could reflect additional first-run/cache/system effects.

### Trace instrumentation can affect timing, but does not explain all stalls

A separate independent **Windows API external window-visibility probe** (`Get-Process.MainWindowHandle` and `IsWindowVisible`) enabled a first A/B comparison of the *same executable* with `WIREBOUND_QA_STARTUP_TRACE` either enabled or entirely unset. Unlike the internal root probe, external window detection works even with tracing off.

- Original trace-first 12 scored starts: **5/6 trace-on windows visible within 70s** (one internal `window-shown` event at **72,289ms**, beyond external cutoff), compared with **6/6 trace-off windows visible**, between **660–4,514ms**. A second trace-on run showed the window externally but lacked a root probe before termination; the original A/B script incorrectly classified this as a failure. We corrected scoring to treat **external visibility identically for both variants**, with React as optional diagnostic metadata.
- Reversed 12 scored starts: **6/6 trace-on** and **6/6 trace-off** windows visible within 70s; medians **866.5ms** and **793.5ms** respectively. Crucially, the separate *untraced warm-up* required **57,071ms** to show the window. Therefore severe launch latency **can occur without internal tracing**.
- These comparisons are **small, uncontrolled for host CPU/disk scheduling**, and do not establish that tracing is harmless or causal. A one-off Windows counter sample during investigation showed around **84% total CPU** and **2.2GB available RAM**, also not proof of a specific cause.

### Important QA safety correction: APPDATA alone did not isolate Electron userData

We audited the actual child-process command lines instead of trusting harness environment variables. Under the earlier harness, which changed `APPDATA` and `LOCALAPPDATA` but did not explicitly set Electron's `userData`, Chromium child processes still used the regular Windows roaming `wirebound` profile, while the intended temporary QA `appdata` directory was empty. **Earlier descriptions of complete fresh-profile isolation were therefore incorrect**. The temporary `LOCALAPPDATA` override did affect ADB cache placement, but **did not guarantee isolated Chromium settings or caches**. This is an important methodological limitation on older startup comparisons and any effects of cache warming. We did **not** inspect or delete the existing roaming Wirebound user data.

The new QA-only gate `WIREBOUND_QA_PROFILE_ISOLATION=1` plus an **absolute** `WIREBOUND_QA_PROFILE_DIR` calls Electron `app.setPath('userData', ...)` and `app.setPath('sessionData', ...)` **before** Electron's `ready` event, creating the directory if necessary. If explicitly requested with a missing or relative path, it fails closed rather than silently falling back. No override runs for ordinary app launches. The updated `electron-cold-start.ps1` and the external trace-on/off A/B runner set this path independently for every trial, **including trials with internal tracing disabled**, while preserving independent temporary `APPDATA` and `LOCALAPPDATA` for any other code.

**Verification after a frozen Windows rebuild:** typecheck **PASS**, **58/58 Vitest** PASS, lint **0 errors / 54 warnings**, `npm run build:unpack` PASS, embedded ASAR integrity **3,960 files verified / zero mismatches**. A separate QA-only smoke run demonstrated the requested profile was created and populated (**16 top-level entries**), the new `qa-profile-isolated` event occurred, **one renderer** had the explicit QA user-data path, and **all four sampled Chromium subprocesses** used the QA path. The app created a window and the smoke helper exited **0** with targeted process cleanup.

### Re-run after verified profile isolation

The updated standalone cold-start harness also passed **2/2** isolated launches, with **two independent populated QA `user-data` folders** (14 entries each). The corrected trace-on/off runner was exercised on the **new ASAR-verified Windows build** with its normal icon in place, using two reversed/balanced blocks and 60-second cutoff, after independently proving user-data isolation. An unscored, untraced warm-up showed the window at **1,162ms**. All **8/8 scored launches** visibly opened: **4/4 trace-on** and **4/4 trace-off**. External-window medians were **1,069ms trace-on** and **1,209ms trace-off**, maxima **1,579ms** and **1,292ms**, respectively. A sample from each variant had a freshly populated isolated `user-data` directory (**14 top-level entries**), and no QA Wirebound process remained at the end. These numbers show **no observed trace penalty** in this small, successful batch; they do **not establish equality or explain the rare 50–70s outliers**. Unlike prior comparisons, these launches did not share the default Electron Chromium profile.

The source of intermittent main-process stalls and incomplete renderer loads is **still unproven**. In particular, changed OS load, Chromium caches, and timing instrumentation remain potential confounders. Do not disable Defender, force GPU flags, strip normal Wirebound icons, or install a blind renderer reload as a purported solution.

[Electron app path documentation](https://www.electronjs.org/docs/latest/api/app#appsetpathname-path) notes that `app.setPath` needs an existing directory and session paths must be overridden before `ready`. These path overrides are a **test-harness correction**, not a production-mode startup optimization.

## Reproduction (Windows QA)

1. Run the existing `npm run package:check` script to create `dist/win-unpacked/wirebound.exe`. It does not install or publish anything.
2. Run `pwsh -NoProfile -File scripts/qa/electron-cold-start.ps1 -Attempts 3 -WaitSeconds 25`.
3. The updated harness creates distinct temporary APPDATA and LOCALAPPDATA **and explicitly sets Electron's `userData`/`sessionData` via the QA-only isolation gate** for each attempt, preserving event traces under your system temporary folder in `wirebound-cold-start-qa`. (Earlier harness versions did **not** isolate Electron's Chromium profile; see the October 23 correction above.) It will terminate **only its own** executable process after confirming the executable path.
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
