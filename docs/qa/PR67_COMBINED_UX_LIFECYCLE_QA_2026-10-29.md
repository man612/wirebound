# PR #67 — combined UX + lifecycle Windows QA checkpoint (2026-10-29)

**Status: SOURCE INTEGRATION AND HOSTED WINDOWS CI PASS; LIMITED REAL-PACKAGE UX SMOKE PASS; COMBINED-END-TO-END PHONE QA NOT YET ACCEPTED.** Keep Draft, no merge/release/install. The user's ordinary Wirebound installation and profile were not intentionally modified.

## Exact source and CI

- Merge branch `integration/ux-lifecycle-hardware-20261029`, [Draft PR #67](https://github.com/man612/wirebound/pull/67).
- True two-parent Git merge commit **`29230c5773d53b55ac16b75b77d696e9140f06e9`** with parents PR #63 head **`383f806422a6a58d3f1cff4cc7df0bac1e86c509`** and PR #50 head **`69473c2c0c153987deff7a26f567c2ce9cdf8501`**. This includes the actual UX implementation and native Gnirehtet lifecycle/privacy source, not a docs-only proposal.
- Git merge had exactly **one textual conflict**, in `AGENTS.md`; resolved while retaining both branch agent sections. Other 23 changes relative to the lifecycle parent merged without textual conflicts. No source dependency upgrade; startup investigation PR #51 is **not** included.
- Exact CI/QA workflow head `2d2c0242deb48468b70c3053523ef825697c4435`. Hosted Windows [run 40838547533](https://github.com/man612/wirebound/actions/runs/40838547533) completed **SUCCESS**: lint passed with nonfatal formatter warnings; typecheck passed; **12 Vitest files, 73/73 cases PASS**; Electron build, unpacked-package smoke and temporary artifact upload PASS.
- Short-lived artifact `qa-ux-lifecycle-win-unpacked`, ID **12881463034**, GitHub archive SHA256 digest `4cff5727a02a15340e5f44b0b0abb7685227d587148838ae8d91211e3e24276f`, 2-day retention. Authenticated GitHub CLI downloaded and extracted it to `F:\Wirebound-Lab\qa-packages\pr67-ux-lifecycle-hosted-20261029`; exit code 0. **Download/extraction was slow (~766s)** on YASMAN, so do not reattempt automatically or launch partially extracted files.
- Local unpacked package hashes: `wirebound.exe` SHA256 **`fa4da0bf6898251cb72848be3d0f56b34abf59eeded3df873dfdf443e18a73f8`** (246,324,736 bytes); `resources/app.asar` SHA256 **`88c518ceb6c3611183ed8b693d5126bb97fab6b4f0a8ed9e8c78e85c7063c953`** (21,640,898 bytes). Pinned Gnirehtet 2.5.1 and ADB/platform-tools 37.0.1 hashes matched the prior checked package. This was **not installed**.

## Isolated profile and initial real renderer check

- Isolated checkout on F: `F:\Wirebound-Lab\qa-ux-lifecycle-integration-20261029`. Separate QA profile `qa-profile` under that checkout, with `APPDATA`, `LOCALAPPDATA`, `TEMP` and `--user-data-dir=...\Chromium` redirected to F:. Seeded settings in both Roaming Wirebound and Chromium userData with `autoStart:false`, `telemetryEnabled:false`, `onboardingCompleted:true`, `language:'id'`, `theme:'dark'`. QA main process opened from F: with CDP bound to **127.0.0.1:19667**; ordinary app/profile not overwritten.
- `window.api` present, version 1.2.0, settings reflected the QA seed, engine reported `disconnected`. Renderer root present. At that early UI inspection device snapshot was **0** (not enough to prove USB detached for the entire session).
- At 1000 px viewport width: no document horizontal overflow, no literal corrupted `Â·` separator observed. Diagnostic panel was present and expanded, copy report button present, settings navigation visible.
- Direct real renderer UI interaction: manually collapsing diagnostics succeeded; clicking **`Jalankan Lagi`** reopened the diagnostic panel; the rerun button subsequently returned to non-busy state. Settings view opened; theme and update-related controls were present. These are **limited actual UI checks**, not full acceptance of all ten UX requirements.
- Current item-by-item evidence for the integrated build:
  - UX-01 onboarding immediate Dark/Light preview: **not tested on this package** (requires fresh onboarding profile).
  - UX-02 diagnostic disclosure behavior: **manual collapse/expand PASS**, timed collapse only for clean scans **not tested**.
  - UX-03 copy report button: **present**; actual clipboard operation and toast **not tested**.
  - UX-04 diagnostics rerun: **real UI click expands and completes**; detailed failure/recovery animation scenarios **not fully tested**.
  - UX-05 device detail encoding/date: no global corrupt separator observed; real device card detail **not tested**.
  - UX-06 responsive device cards and real RX/TX: **not tested on the combined UI with an authorized phone**.
  - UX-07 Clear disabled for empty logs: button present, but logs apparently nonempty; empty case **not verified**.
  - UX-08 dismissible ready notice: **not verified** without a ready-state UI.
  - UX-09 Settings update-check timestamp: section present; persisted timestamp behavior **not verified**.
  - UX-10 dashboard scroll-pinning: no horizontal overflow at 1000px; actual log-follow/scroll behavior **not verified**.
- Prior UX PR #50's synthetic 18/18 Chromium scenarios and PR #63's real Motorola VPN+HTTPS 2/2 are **different builds**, not evidence for PR #67's untested items.

## Safety-critical unexpected active relay during UI QA

During the **post-UI cleanup attempt** the safety guard detected TCP **31416 listening**, and **aborted** planned shutdown before touching Wirebound. The exclusive listener was an **actual Gnirehtet process** from the F: **PR #67 QA package**, not a foreign executable. Earlier renderer read-only probes had reported **`disconnected`** and `autoStart:false`. The cause/timing of Gnirehtet activation is **UNKNOWN**: do not assert a confirmed app regression based on this single observation; external UI interactions, asynchronous events and a stale renderer state were not ruled out.

An initial force-cleanup preflight detected an ADB device and **refused** to kill the relay. A subsequent read-only ADB check showed **one authorized `device`**, Android Gnirehtet client running, Gnirehtet reverse mapping present, and Android VPN transport active. **No formal combined-build HTTPS/TUN acceptance was captured during this session**. A renderer `stopGnirehtet()` attempt failed to complete within the local diagnostic timeout on the slow host. Therefore targeted recovery used the pinned QA native `gnirehtet stop` command at ADB port 5037 (exit 0), which removed the Android VPN transport but temporarily left client and reverse mapping. Then **only** `am force-stop com.genymobile.gnirehtet` and **only** `adb reverse --remove localabstract:gnirehtet` were used. Verification showed client absent, reverse absent and VPN transport absent; a single Gnirehtet relay from the exact QA executable was stopped after verifying there were no established relay TCP connections. No unrelated Android application or VPN was modified.

Finally, exactly **5 Wirebound processes** were stopped by matching the F: QA executable path; the single QA-owned default ADB 5037 process was identified by its F: QA runtime executable path, exclusive listener ownership and zero established clients before targeted PID stop. Independent final Windows check: **0 Wirebound, 0 Gnirehtet, 0 ADB processes**, and **no listeners on 5037, 15379, 31416, 19667**.

## Next gates

1. Investigate why the QA relay was active while earlier UI status showed disconnected. Capture **bounded, redacted timestamped state transitions** for settings `autoStart`, app IPC Start origin, Gnirehtet generation/child ownership, UI start click and actual USB re-enumeration. Reproduce in isolation before labeling an application regression or altering lifecycle source.
2. Complete onboarding theme preview and the remaining UX-specific interactive checks on an isolated QA profile, avoiding accidental VPN start while the source of the unexpected connection remains uncertain.
3. Repeat controlled **PR #67 combined package** real Moto g45 Android 15 full Start → engine connected → Android VPN/tun HTTPS 200 RX/TX → Stop → Retry → clean stop, with strict process ownership and no live shared ADB clients. The previous successful 2/2 tests were through **PR #63**, not PR #67.
4. Do not upgrade dependencies, install over the user's regular Wirebound, merge any Draft PR, release or close issues #48/#53/#58 until the combined acceptance is documented and maintainer-approved. Keep startup issue #44 separate.
