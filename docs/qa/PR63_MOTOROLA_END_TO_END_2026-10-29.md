# PR #63 — real Motorola end-to-end acceptance via packaged Wirebound (2026-10-29)

**Status: PASS for two sequential real-phone `Start → VPN connected → Android HTTPS 200 / TUN RX+TX → Stop` cycles through the actual packaged Wirebound v1.2.0 Electron main/preload/IPC and Gnirehtet engine.**

**Limits:** Start/Stop was issued via the *real renderer-exposed* `window.api` through local Chromium DevTools Protocol, not by clicking visible UI buttons. Direct UI button/animation, tray Quit, USB disconnect mid-session, intentional stop timeout, multiple simultaneously connected physical phones, and exact per-device Start/Stop concurrency have **not** passed physical QA. This checkpoint does not close startup performance issue #44 or automatically approve a merge/release.

## Source and test asset provenance

- Integration [Draft PR #63](https://github.com/man612/wirebound/pull/63). The **tested app code** comes from source commit `d9937c99144b26708d28c74d25a2918c866f0b28`.
- Temporary **workflow-only** [QA PR #66](https://github.com/man612/wirebound/pull/66) commit `3a88bfd4d2262f447b680b53f97a25cebbbf70c0` changed **only** `.github/workflows/ci.yml` to upload its unpacked Windows package. QA PR #66 was subsequently **closed unmerged**.
- Hosted Windows CI [run 40820151487](https://github.com/man612/wirebound/actions/runs/40820151487) passed lint, typecheck, **64/64 Vitest**, renderer/main build, electron-builder packaging smoke and artifact upload. Artifact `qa-pr63-win-unpacked` ID **12873643698** downloaded with GitHub CLI to `F:\Wirebound-Lab\qa-packages\pr63-hosted-20261029`.
- Verified package fingerprints: `wirebound.exe` SHA256 `f0b48fd16373ab10f9c5e88054852bcb890ec1c52f95414b96f76a0c37053392`; `resources/app.asar` SHA256 `a140a6f8bb438894e77c968c22c1bc8abbc33ea1fd44ca5e4ef00d9b85389935`. Bundled Gnirehtet 2.5.1 and ADB/platform-tools 37.0.1. Unsigned, **unpacked-only QA, not an installer**.
- At the time of this test, integration PR #63 head `258f6303278c3fd802df0528979daf6c9f90a734` was verified to differ from the tested `d9937c9` source **only** in `AGENTS.md` and the added `docs/qa/PR63_PACKAGED_WINDOWS_ENGINE_SMOKE_2026-10-29.md`. Thus **no application code changed** between the packaged artifact and the live PR head prior to adding this report.
- Physical device: one authorized **Motorola moto g45 5G**, Android 15 / SDK 35, USB debugging allowed. No real phone serials, personal IPs, raw app logs, or response bodies were printed into this report.

## Setup and isolation

- First read-only ADB preflight used temporary server **15379** (correct `ANDROID_ADB_SERVER_PORT`) and found **exactly one authorized `device`** matching the expected Motorola; unauthorized = 0, no Android Gnirehtet process, no `localabstract:gnirehtet` reverse, no VPN transport. The dedicated 15379 server was stopped before opening the packaged app. Windows preflight had **0 Wirebound/Gnirehtet/ADB processes** and ports 5037/15379/31416/19665 unused.
- Packaged app launched from F: via `F:\Wirebound-Lab\qa-tools\start-pr63-isolated-20261029.ps1`, with `APPDATA`, `LOCALAPPDATA`, `TEMP`, `TMP`, and Chromium `--user-data-dir` redirected into `F:\Wirebound-Lab\qa-pr63-20261029\qa-profile`. The effective `qa-profile\Chromium\settings.json` was previously seeded and verified by the renderer, with **`autoStart:false`, `telemetryEnabled:false`, `onboardingCompleted:true`**. No ordinary Wirebound profile used.
- App bootstrap started an **app-owned** default ADB 5037 server in the F: QA `LOCALAPPDATA\Wirebound\runtime` folder. The **Rust Gnirehtet `autorun` monitor hardcodes ADB 5037**; using app's normal default port, rather than prior isolated 15379 for Gnirehtet `autorun`, is necessary and correct here.
- The first renderer API inspection was slow (~115.55 sec elapsed for the inspection process; **do not misinterpret as independently measured time-to-window**). It eventually reported `Wirebound`, version 1.2.0, `window.api` present, engine `disconnected`, **one authorized device**, correct F: settings. A subsequent read-only probe after a 3-second local HTTP diagnostic timeout took ~71.65 sec before reporting the same correct state, demonstrating local diagnostic responsiveness variability. Startup performance issue #44 remains separate.

## Two real-phone acceptance cycles

Driver: `F:\Wirebound-Lab\qa-tools\pr63-real-motorola-acceptance-20261029.cjs`. It calls the **real running renderer `window.api.startGnirehtet` / `stopGnirehtet` IPC** through a loopback-only Chrome DevTools Protocol endpoint (`127.0.0.1:19665`). It uses the app's own bundled ADB client `-P 5037` only to query Android and issue a bounded network probe; it does not mutate another app's VPN or expose the device serial.

| Step | First cycle | Second (Retry after Stop) |
| --- | --- | --- |
| Initial app state | `disconnected`, 1 authorized device | `disconnected`, 1 authorized device |
| Initial Gnirehtet Android process, reverse and VPN | All **absent** | All **absent** |
| `window.api.startGnirehtet('8.8.8.8','31416')` | `success:true` | `success:true` |
| Windows native relay TCP **31416** | Listening | Listening |
| Android Gnirehtet client process | **Running** | **Running** |
| ADB `localabstract:gnirehtet` reverse mapping | **Present** | **Present** |
| Android VPN transport | **Present** | **Present** |
| App `window.api.getStatus()` | **`connected`** | **`connected`** |
| On-phone bounded `/system/bin/curl` `https://example.com` | **HTTP 200** | **HTTP 200** |
| `tun*` RX byte count between before/after HTTPS | **Increased** | **Increased** |
| `tun*` TX byte count between before/after HTTPS | **Increased** | **Increased** |
| `window.api.stopGnirehtet()` | `success:true` | `success:true` |
| Windows relay port after Stop | **Closed** | **Closed** |
| App status after Stop | **`disconnected`** | **`disconnected`** |
| Android Gnirehtet process after Stop | **Absent** | **Absent** |
| Gnirehtet ADB reverse after Stop | **Absent** | **Absent** |
| Android VPN transport after Stop | **Absent** | **Absent** |
| Need Android `am force-stop` or reverse-remove fallback | **No** | **No** |

The first attempt to query the app for this session had a **local CDP HTTP read timeout before any Start call was issued**. The app's renderer remained slow but subsequently responded, and the real acceptance run proceeded. Do not count this timeout as a VPN failure or as a passed UI startup timing check.

## Final host process cleanup

- After both full app→phone cycles reported clean Android shutdown, the real packaged Wirebound QA process was closed by **exact F: executable path** only (5 Electron processes, no other Wirebound executable). **No installed app or personal profile was modified.**
- A single QA-owned default ADB server 5037 remained after the Electron processes exited. Ownership was verified by its **F: QA runtime path**, exact listener PID, **zero established connections**, and the absence of native Gnirehtet processes before stopping **that PID only**. No global/shared `adb kill-server` or mass reverse-removal used.
- A **separate, read-only final verification** reported: **0 processes** named Wirebound, Gnirehtet, or ADB; no listener at **5037**, **15379**, **31416**, or **19665**. The physical handset was not disconnected or modified beyond Gnirehtet VPN Start/Stop.
- QA checkout `F:\Wirebound-Lab\qa-pr63-20261029\node_modules` still is a **junction** into D: dependencies; never recursively remove or run `npm ci` through it. The tested package remains in `F:\Wirebound-Lab\qa-packages\pr63-hosted-20261029`.

## Release / merge interpretation

This **closes the prior technical QA blocker of proving Wirebound's packaged Electron engine can establish, use and cleanly stop a real Android VPN/USB reverse-tethering session** on the one physical device. It **does not** test actual mouse-driven button states, tray lifecycle, simultaneous Stop during an already dispatched `startDevice`, network detach during shutdown, fail-closed 2-second native timeout, or multiple physical phones (the maintainer has one device; multi-phone hardware QA waived).

Keep issue #44 startup performance separate, privacy claims limited to tested identifiers, and PR #63 **Draft and unmerged** until the maintainer explicitly authorizes release gating/merge and any chosen remaining UI or fault-injection checks are assessed.
