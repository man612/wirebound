# Window-icon crossover / cold native and renderer startup — 2026-10-24

**Scope:** Research issue #44's long-tail Electron startup on an HDD Windows QA PC. Draft PR #51, not a release. This checkpoint does not change production runtime behavior or justify removing the app's window icon.

## Setup

All twelve launches used the same previously SHA-256 verified manual QA-only Wirebound v1.2.0 package (ASAR payload 16/16 pass). This is not a production-equivalent electron-builder or NSIS package. The existing isolated cold-start harness created new Electron userData/sessionData, APPDATA/LOCALAPPDATA and absolute startup trace files for every trial. Each PASS required a visible full-size application window and a nonempty React root. The QA-only UI-first flag was active; production defaults were not changed. No external resource sampling was used during the benchmark.

Three counterbalanced four-trial blocks were run in sequence: ABBA (normal / skip / skip / normal), BAAB (skip / normal / normal / skip), and a BAAB run using the hardened repository script. Icon normal decodes the configured file using nativeImage.createFromPath before new BrowserWindow; QA skip omits the custom BrowserWindow icon.

## All phase timings

| Block | Icon mode | Window shown ms | Icon decode ms | Native window creation ms | Renderer loading to DOM ms | FCP ms* |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| ABBA 1 | Normal | **15,669** | 893 | 2,781 | 6,930 | unavailable |
| ABBA 2 | Skip | 609 | 0 | 33 | 361 | 756 |
| ABBA 3 | Skip | 469 | 0 | 32 | 285 | 784 |
| ABBA 4 | Normal | 1,019 | 5 | 105 | 561 | 1,048 |
| BAAB 1 | Skip | 877 | 0 | 64 | 247 | 644 |
| BAAB 2 | Normal | 402 | 4 | 82 | 169 | 544 |
| BAAB 3 | Normal | 510 | 5 | 82 | 239 | 648 |
| BAAB 4 | Skip | 494 | 0 | 58 | 184 | 580 |
| Repo BAAB 1 | Skip | 472 | 0 | 34 | 273 | 640 |
| Repo BAAB 2 | Normal | 521 | 5 | 129 | 230 | 612 |
| Repo BAAB 3 | Normal | 479 | 5 | 87 | 225 | 608 |
| Repo BAAB 4 | Skip | 896 | 0 | 66 | 391 | 976 |

* FCP is measured relative to renderer navigation, NOT process startup. Missing or -1 means unavailable, never zero.

### Interpretation

- Normal icon: **6/6 passes**, median window shown **515.5ms**; min 402ms, max 15,669ms.
- Skip icon: **6/6 passes**, median **551.5ms**; min 469ms, max 896ms.
- The five normal starts below 2000ms had a descriptive median of **510ms**, but the threshold is post hoc and should not be used for statistical inference.
- In the 15.7s outlier, icon decoding cost only **893ms**, while native window creation cost **2,781ms** and renderer navigation to DOM cost **6,930ms**. Several unrelated startup phases were delayed. Removing the icon cannot explain this outlier by itself.
- One reversed block and the combined sample had a slightly faster median with normal icons. **No consistent speed benefit from skipping the icon was demonstrated.**
- The sample is small, consecutive starts were affected by OS/HDD caching and scheduling, and writing trace events to disk itself adds QA overhead. This is not a controlled causal benchmark. FP/FCP were unavailable on the slowest run, which does not by itself mean nothing was painted.

## QA harness update

The source-controlled script scripts/qa/compare-window-icon-startup.ps1 was hardened to avoid heavy continuous process/Defender counter sampling; require a separate QA executable rather than rejecting a machine merely because a normal installation exists; refuse tests if a Wirebound instance is already running; persist CSV after **each** trial; allow safe cleanup grace, fail closed if a process remains; capture navigation-relative Chromium paint metrics when available; and permit explicit QA-only UI-first mode. Windows PowerShell syntax parser returned **zero errors**, and its actual live BAAB run passed **4/4** without residual Wirebound QA processes.

## Local raw evidence

- F:\Wirebound-Lab\benchmarks\issue44-icon-12run-phase-summary-20261024.csv — all 12 normalized rows
- F:\Wirebound-Lab\benchmarks\issue44-icon-ABBA-20261024 — first four raw isolated profiles and traces
- F:\Wirebound-Lab\benchmarks\issue44-icon-BAAB-20261024 — second four
- F:\Wirebound-Lab\benchmarks\issue44-icon-harness-portable-20261024 — third four, source-controlled harness
- F:\Wirebound-Lab\logs\issue44-icon-ABBA-20261024.log, issue44-icon-BAAB-20261024.log, issue44-icon-portable-20261024.log

## Next work

Investigate the **native BrowserWindow constructor** and **Chromium renderer cold-start** independently of icon decode and cached-ADB readiness. Preserve the current window/taskbar branding and verified runtime integrity until full feature-equivalent Windows NSIS, real Android USB/Gnirehtet and user-facing recovery tests are done. Keep issue #44 open and PR #51 draft. No framework migration, dependency upgrade, merge or release on the basis of this experiment.
