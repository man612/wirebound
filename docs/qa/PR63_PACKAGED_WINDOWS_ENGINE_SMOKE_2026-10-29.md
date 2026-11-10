# Wirebound PR #63 — packaged Windows QA engine smoke, 2026-10-29

**Status:** Actual packaged Electron main/renderer/preload + native Gnirehtet process Start/Stop **PASS without Android device present**. Native one-phone Gnirehtet VPN/HTTPS/TUN previously **PASS in a separate CLI QA** (see `GNIREHTET_MOTOROLA_NATIVE_QA_2026-10-29.md`). **PR #63's end-to-end Android VPN and UI-click QA remains NOT RUN**. Keep Draft, no merge/release.

## Source provenance

- Target integration Draft [PR #63](https://github.com/man612/wirebound/pull/63), source code head `d9937c99144b26708d28c74d25a2918c866f0b28` at preparation.
- The local YASMAN build `npm.cmd run build` became nonresponsive and did **not** produce `out/main/index.js`, `out/renderer/index.html`, or `dist/win-unpacked/wirebound.exe`. It was **not counted as passed**. Its exact Desktop Commander terminal session was targeted for termination; no `npm ci` was repeated on the slow PC.
- Created **temporary, Draft-only [QA PR #66](https://github.com/man612/wirebound/pull/66)** on a branch from PR #63 source head. GitHub compare proved the QA branch differed **only in `.github/workflows/ci.yml`** (10 appended lines to upload a temporary unpacked Windows artifact; no application-source changes).
- Hosted Windows Actions [run 40820151487](https://github.com/man612/wirebound/actions/runs/40820151487) at QA workflow commit `3a88bfd4d2262f447b680b53f97a25cebbbf70c0`: lint, TypeScript, **64/64 Vitest**, renderer/main build, electron-builder unpacked smoke, and QA upload all **SUCCESS**.
- Artifact: `qa-pr63-win-unpacked`, artifact ID **12873643698**, SHA-256 archive digest `49246919378528f59721455f19164a4e73244ca5545482e421ef2d1d74e126c6`, compressed ~156 MB, retention 2 days. Windows GitHub CLI `gh run download 40820151487 --repo man612/wirebound --name qa-pr63-win-unpacked --dir F:\Wirebound-Lab\qa-packages\pr63-hosted-20261029` succeeded.
- Verified unpacked package at `F:\Wirebound-Lab\qa-packages\pr63-hosted-20261029`:
  - `wirebound.exe` SHA-256 `f0b48fd16373ab10f9c5e88054852bcb890ec1c52f95414b96f76a0c37053392`.
  - `resources/app.asar` SHA-256 `a140a6f8bb438894e77c968c22c1bc8abbc33ea1fd44ca5e4ef00d9b85389935`.
  - `gnirehtet.exe` SHA-256 `d5daefbb48143fbc2b01f24be79135fc11959fe4553b00f5a454801ed5ff720d`; runtime pin 2.5.1.
  - `adb.exe` SHA-256 `b4a6b455702684652cccf7b46258b29e653538904359a58fd4931cf3ef286b3f`; platform-tools 37.0.1.
  - Executable was **unsigned** (`Get-AuthenticodeSignature` = `NotSigned`). It was run only unpacked, **not installed** into user profile.

## QA isolation and boot

- Clean exact-source checkout: `F:\Wirebound-Lab\qa-pr63-20261029` at head `d9937c9`. Pinned Android runtime files copied into its `bin`, preserving tracked `bin/README.md`.
- `node_modules` under that checkout is a **JUNCTION to `D:\Projects\wirebound-ux-review-20261021\node_modules`**. The source lock Git blob `a3810f5731543e195216d395d3149948f57c88fd` matched. **NEVER recursively delete/clean or run `npm ci` through this junction**, and never use it to claim an isolated native dependency install.
- Actual packaged executable launched from F: using the QA-only PowerShell script `F:\Wirebound-Lab\qa-tools\start-pr63-isolated-20261029.ps1` with `APPDATA`, `LOCALAPPDATA`, `TEMP`, and `TMP` redirected under `F:\Wirebound-Lab\qa-pr63-20261029\qa-profile`, plus Chromium `--user-data-dir` pointing to `qa-profile\Chromium`. Debugging limited to loopback `127.0.0.1:19665`. Auto-start and telemetry both explicitly disabled.
- **Critical finding on Electron profile isolation:** A settings seed at `qa-profile\Roaming\Wirebound\settings.json` alone was **not** reflected by `window.api.getSettings()`: onboarding initially read `false`. After creating the identical QA settings at `qa-profile\Chromium\settings.json`, **the app returned `onboardingCompleted: true`, matching the QA seed**. Thus the effective settings location with this launch configuration was confirmed to be the F: Chromium QA folder. Do **not** assume `APPDATA` alone controls `app.getPath('userData')` when `--user-data-dir` is supplied; verify behavior before any write actions.
- The packaged app exposed a working renderer and preload: `document.title=Wirebound`, version **1.2.0**, `window.api` present, renderer populated. Read-only status initially `disconnected`; settings `autoStart:false`, `telemetryEnabled:false`, `onboardingCompleted:true`. No renderer settings-save or production profile modification was requested.
- Bootstrap started a QA-owned default ADB server `5037` from the F: `LOCALAPPDATA\Wirebound\runtime\platform-tools-*` cache. **No ADB server was killed globally**; exact owner PID/path/zero established clients were verified before targeted Stop-Process after QA.
- At app QA time: `window.api.getDeviceSnapshot()` reported **0 devices**, `adb -P 5037 devices` returned **0**, and Windows `Get-PnpDevice -PresentOnly` had **0 entries matching Android/Motorola/ADB/MTP**. This is a **currently missing physical USB connection**, not a regression attributed to PR #63. Earlier Motorola native CLI VPN+HTTPS tests occurred while it was detected.

## Real packaged Electron main/preload/native engine QA, no phone

Tests were driven through the *actual renderer-exposed* `window.api` IPC over local Chromium DevTools Protocol. They validate the running packaged app's main process and native relay, **not user mouse clicks or on-phone UI**. Command scripts under `F:\Wirebound-Lab\qa-tools`:
- `inspect-pr63-cdp-20261029.cjs` — read-only version/settings/status/device count, no serial printing.
- `pr63-engine-two-cycles-20261029.cjs` — sequential two Start/Stop cycles.
- `pr63-concurrent-start-20261029.cjs` — three simultaneous Start API calls, followed by Stop.
- `pr63-start-stop-race-20261029.cjs` — Start and Stop nearly simultaneous.

| Check | Result |
| --- | --- |
| API/preload in packaged executable | **PASS**, `window.api` exposed |
| Start → native relay listening on TCP 31416 → Stop → port closed | **PASS, cycle 1** |
| Second Start → relay listening → Stop → port closed | **PASS, cycle 2** |
| Status while no phone attached | `connecting` (expected; don't claim VPN connected) |
| Status after each successful Stop | `disconnected` |
| Three concurrent Start calls | **3/3 returned `success:true`**; one relay TCP listening endpoint, then successful Stop and disconnected state (exact spawned process count was not measured) |
| Start/Stop overlap | Both returned `success:true`; after settling **port closed**, status `disconnected` |
| Android VPN/TUN/HTTP through PR #63 packaged app | **NOT RUN: USB handset absent** |
| UI button clicks, tray Quit, reboot/reconnect, network disconnection | **NOT RUN** |

## Cleanup and remaining blockers

- Before cleanup, the native Gnirehtet process count and port 31416 were checked to be zero/closed. Stopped **only five `wirebound.exe` processes whose executable path was the F: QA unpacked package**; other Wirebound process count was zero.
- The QA-owned ADB process at TCP 5037 was stopped **only after confirming its executable path was in F: QA `LOCALAPPDATA\Wirebound\runtime`, its PID owned the single listener, zero established connections, and Gnirehtet was not running**. No `adb kill-server` on a shared user process or `adb reverse --remove-all`.
- Independent final verification showed **0 processes named Wirebound/Gnirehtet/ADB**, and no listeners at TCP **5037, 15379, 31416, 19665**. Git checkout remained `d9937c9`; F: QA Chromium settings file existed. No installation, dependency upgrades, releases, or merges.
- **Next hardware gate:** reconnect/authorize the Motorola for the currently running test session, check exactly one `adb devices` `device` on default **5037**, then repeat exact packaged PR #63 Start → Android VPN `connected` → HTTPS/TUN RX/TX → Stop → reverse mapping cleanup → Retry, checking process identity and UI labels/animation. Do not transfer the native CLI success to these unrun app tests.
- The temporary artifact/QA PR exists only to obtain a CI-built executable. **Close QA PR #66 unmerged** after confirming extraction/retaining evidence. PR #63 remains **DRAFT**, current main unchanged. The v1.2.0 app's pre-existing startup performance issue #44 is not resolved by these smoke results.
