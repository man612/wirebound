# PR #67 — real Motorola GUI + reverse-tethering acceptance (2026-10-30)

**Environment and scope:** isolated, already-downloaded unpacked Windows CI artifact for Draft PR #67 (`integration/ux-lifecycle-hardware-20261029`). Electron Wirebound v1.2.0, one authorized Motorola moto g45 5G (Android 15) and Windows QA host YASMAN. This is the **combined UX PR #50 + Gnirehtet lifecycle/privacy PR #63** build, not either predecessor alone. The earlier hosted CI for the application's unchanged source was [run 40838547533](https://github.com/man612/wirebound/actions/runs/40838547533), **73/73 Vitest PASS**, typecheck, lint, build and package smoke. No production code/dependency changes, installed-app replacement, public release or merge to `main`.

## Environment isolation and independent preflight

- Actual tested executable: `F:\Wirebound-Lab\qa-packages\pr67-ux-lifecycle-hosted-20261029\wirebound.exe`; earlier independently verified SHA-256 `fa4da0bf6898251cb72848be3d0f56b34abf59eeded3df873dfdf443e18a73f8`. Tested source is unchanged from that package; newer integration commits were documentation-only.
- Isolated QA profile: `F:\Wirebound-Lab\qa-ux-lifecycle-integration-20261029\qa-profile`, with APPDATA, LOCALAPPDATA, TEMP/TMP and Chromium `--user-data-dir` redirected there; `autoStart:false`, telemetry off, onboarding complete, theme dark, active Chromium settings in English. CDP bound only to `127.0.0.1:19667`.
- Before launch: no Wirebound/Gnirehtet process or service listener. ADB server was created by the **bundled QA ADB executable** at port 5037; it reported **exactly one authorized** Android device. The QA launcher checked server executable ownership and excluded foreign processes. The initial Android Gnirehtet process, Gnirehtet reverse mapping, VPN transport and `tun` interface were all **absent**; Android and ADB queries passed.
- This session intentionally used the default ADB 5037, not a nonstandard port: upstream native Gnirehtet `autorun` monitors 5037. No global ADB kill, `reverse --remove-all`, other package force-stop or security setting modification.

## Packaged application API end-to-end — PASS

Script `F:\Wirebound-Lab\qa-tools\pr67-real-motorola-acceptance-20261030.cjs` adapted from previously proven PR #63 test to the PR #67 QA executable and port 19667. It exercised actual packaged Electron main/preload via `window.api`:

| Check | Observed |
| --- | --- |
| Before Start | `disconnected`, 1 device authorized, `autoStart:false`, Gnirehtet Android state clean |
| `startGnirehtet()` | `success:true` |
| Native Windows relay on TCP 31416 | listening |
| Android Gnirehtet process / reverse / VPN | all active |
| App engine status | `connected` |
| Android `/system/bin/curl` HTTPS | **HTTP 200** from `https://example.com` |
| TUN kernel counters | both real RX and TX increased |
| `stopGnirehtet()` | `success:true` |
| Relay after Stop | TCP 31416 closed |
| App engine after Stop | `disconnected` |
| Android client / reverse / VPN after Stop | **all absent** |

This proves actual reverse-tether traffic, not merely a process running, simulated counters or a permission dialog.

## Actual React GUI Start / per-device Disconnect / Retry / Stop — PASS

Separate script `F:\Wirebound-Lab\qa-tools\pr67-live-gui-retry-20261030.cjs` exercised the **actual rendered buttons** rather than calling Start directly:

1. Preflight again: `disconnected`, exactly one authorized device, `autoStart:false`, no active Android Gnirehtet/VPN/reverse, port 31416 closed.
2. Actual **Start Connection** click: app and device both reached connected. Android client, reverse and VPN were active.
3. Actual device card displayed battery, RX/TX and enabled **Disconnect** and **Speed Test** actions; there was no horizontal document overflow at 1000px. Terminal showed **35 log entries**, and the dashboard scroll remained at 0 in this observed live-connection case. This is a limited scroll check, not full proof of preserving a manually scrolled log position.
4. Actual device-card **Disconnect** click: Android VPN off and Gnirehtet reverse mapping removed while Windows relay remained running for potential reconnection. An Android Gnirehtet package process was still detectable immediately after this per-device stop; do not call that equivalent to an active VPN. It was gone after final global Stop.
5. Actual device-card **Retry** became enabled and was clicked; app again became connected. Android client, reverse and VPN were all active, and a **second independent HTTPS request returned HTTP 200 with both TUN RX/TX counters increasing**.
6. Actual GUI **Stop Connection** click succeeded; final Electron Stop result `success:true`, status `disconnected`. Android client/reverse/VPN all absent; relay 31416 closed. Follow-up independent Android preflight also confirmed Gnirehtet/VPN/reverse/TUN all absent.

**Historical 29 October unexplained relay activation is NOT proved fixed by this clean controlled reproduction.** This run had a known GUI Start origin and `autoStart:false`; no spontaneous Start was observed outside deliberate actions. Keep its root-cause question separate until bounded state-transition trace exists if it recurs.

## Combined-build UX/device/privacy checks — additional PASS / qualified results

- **Real Android diagnostics:** diagnostic report contains exactly one device, a real Android version and API level, with Gnirehtet installed state available. Live diagnostic panel rendered version text without mojibake `Â·` or replacement characters. Initial `getDeviceSnapshot().devices[0].androidVersion` returned undefined, but this snapshot field does not substitute for the detailed diagnostics; the report itself populated the version and API.
- **Serial privacy false-positive corrected:** an initial probe erroneously used the *already-masked* `DiagnosticDevice.id` as if it were the raw ID and reported `visibleSerial:true`. Recheck compared against the actual ADB snapshot's unmasked ID and found **`reportIdMasked:true`, `rawSerialInReportPanel:false`, `rawSerialInDiagnosticDetails:false`, `reportMaskedIdInPanel:true`**. Do not report a serial leak based on the invalid initial probe. No raw device identifier was printed in these QA transcripts.
- **Responsive device card on real phone:** CDP-only viewport overrides at **1000, 800, 600, and 480 CSS pixels** each produced no document horizontal overflow; single real device article was entirely visible and both action buttons remained inside the viewport. This is a renderer layout check, not a separate physical screen/window resize or 125% Windows scaling check.
- **Ready notice:** correct English selector is `aria-label="Dismiss notice"` (not `Dismiss notification` used by an earlier weak heuristic). Actual ready banner dismiss button was present; click removed it; status remained disconnected.
- **Prior real-package UX evidence from 29 October** is documented in `docs/qa/PR67_COMBINED_UX_LIFECYCLE_QA_2026-10-29.md`: onboarding instant Dark/Light preview, diagnostic disclosure/rerun/collapse, Copy Report `Copied` feedback, empty terminal CLEAR disabled, Settings Light/Dark, and a real persisted update-check timestamp. Clipboard bytes and all negative diagnostic scenarios are not independently accepted.

## Guarded local teardown — final verification PASS, QA-script minor issue

After verifying one authorized phone with **no** Android Gnirehtet client, reverse mapping, VPN or TUN, and no active relay or ADB clients, the dedicated QA-only cleanup script matched exactly **five Wirebound processes** from the PR #67 F: executable and **one QA-owned ADB server** and stopped only those PIDs. It raised a PowerShell null-path exception during its *final reporting* after processes had been stopped; fixed its null guard in the QA script. **Independent read-only Windows verification after this error:** Wirebound **0**, ADB **0**, Gnirehtet **0**, and listeners **closed** on 5037, 15379, 31416 and 19667. Do not misreport the cleanup-script exit 1 as a native application shutdown failure. Ordinary installation, normal settings profile and unrelated processes were not touched.

## Remaining release/merge gates

- The maintainer explicitly intends to perform a **separate personal hands-on UI/UX audit** after this technical QA. Keep **PR #67 Draft** and leave `main` and the ordinary installation unchanged until that audit and approval.
- UX-10 manually scrolled-up terminal preservation with active arriving logs remains unverified; Copy Report real clipboard payload comparison and negative/error states remain incomplete. Native Windows 125% scaling and keyboard/a11y review are not claimed.
- Wi-Fi/cellular-off *USB-only* internet validation and physical reconnect/unauthorized scenarios from release issue #38 remain separate gates. One handset only; the two-phone physical test remains explicitly waived.
- Unrelated intermittent Electron startup issue #44 and Draft PR #51 remain unresolved and deliberately unmerged. Do not upgrade dependencies or silently publish v1.2.0.

**Assessment:** the same **combined PR #67 package** now has real Android HTTPS/TUN and both API and GUI Start/Stop/Retry evidence with clean final Android/Windows state. Treat it as a materially stronger integration candidate, not a completed public release or a substitute for the forthcoming maintainer UX review.
