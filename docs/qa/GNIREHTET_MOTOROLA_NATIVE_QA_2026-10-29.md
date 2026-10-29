# Native Gnirehtet / Motorola hardware QA — 2026-10-29

**Status:** isolated Gnirehtet Rust 2.5.1 **native VPN, Android HTTPS and TUN RX/TX confirmed**, but **exact PR #63 Electron Start/Stop/Retry NOT YET tested**. This is a checkpoint on the Draft integration branch, **not merge or release approval**.

## Identity and isolation

- Authorized Windows QA host: YASMAN. Phone: Motorola moto g45 5G, Android 15 (SDK 35), one USB-debugging-authorized handset.
- Runtime used: Gnirehtet Rust 2.5.1, ADB/platform-tools 37.0.1 from an **older unpacked package** under `F:\Wirebound-Lab\qa-packages\issue44-adb-ab-manual-v1\win-unpacked\resources\bin`. **Not an exact PR #63 build.**
- QA scripts live in `F:\Wirebound-Lab\qa-tools`: `gnirehtet-physical-qa-20261029.cjs`, `gnirehtet-stage-probes-20261029.cjs`, `gnirehtet-single-device-stage-20261029.cjs`.
- Source state prior to this checkpoint: PR #63 `97538ee28b95ee920d1090843b08f3f0b28b033b`; hosted Windows CI run [40625799886](https://github.com/man612/wirebound/actions/runs/40625799886) PASS lint, typecheck, 64/64 Vitest, build, package smoke. All tests are different from physical Android validation.
- Source repository `main` was not merged or modified. The installed Wirebound profile and unrelated app sessions were not touched.

## Confirmed upstream ADB monitoring trap

**Why `autorun` failed in our nondefault-port QA even though ADB and the relay worked:**

1. Gnirehtet Rust [`adb_monitor.rs`](https://github.com/Genymobile/gnirehtet/blob/master/relay-rust/src/adb_monitor.rs), `AdbMonitor::track_devices()`, connects to **`127.0.0.1:5037`**, unconditionally, to send `host:track-devices`. It **does not use** `ANDROID_ADB_SERVER_PORT` or accept the port from the CLI.
2. We had correctly directed the **separate** ADB CLI commands to QA port **15379** using `ANDROID_ADB_SERVER_PORT=15379`. But this does **not** redirect Gnirehtet's embedded native Rust monitor. Its `autorun` creates a relay listener without seeing the device, explaining absent Android client, reverse mapping and VPN for those runs.
3. An earlier QA script also erroneously used `ADB_SERVER_PORT`, not the supported `ANDROID_ADB_SERVER_PORT`, briefly creating an unexpected QA-owned ADB server on the default port. That process was identified by executable path and start time with no established client connections and explicitly cleaned. Do not reproduce that mistake.
4. The source [`main.rs`](https://github.com/Genymobile/gnirehtet/blob/master/relay-rust/src/main.rs) `cmd_run()` starts the **one-device client directly** via `async_start()`, without the `AdbMonitor` port-5037 path. Thus `gnirehtet run -d 8.8.8.8 -p 31416` is appropriate for **isolated 15379 hardware tests** when exactly one phone is authorized.
5. Wirebound itself uses default ADB server port **5037**; this QA-port trap is **not evidence of a Wirebound regression**. Exact PR #63 app QA must either safely isolate a standard-port ADB environment or test its documented real-world default-port behavior under explicit safety constraints.

## Physical VPN launch evidence — PASS on native single-device path

With one authorized device, no existing Gnirehtet app process, no prior `localabstract:gnirehtet` mapping, no VPN transport and TCP port 31416 free, ran **one bounded native `gnirehtet run`** in a QA-only process with `ANDROID_ADB_SERVER_PORT=15379`. Concurrent filtered Android logcat was parsed *in memory* and emitted only stage categories — not raw lines, real device serials, IPs or arbitrary personal data.

| Probe | Result |
| --- | --- |
| ADB USB authorization | **1 `device`** |
| Windows Gnirehtet TCP relay listener | **PASS** |
| Android `com.genymobile.gnirehtet` process active | **PASS** |
| `adb reverse` mapping `localabstract:gnirehtet` | **PASS** |
| Android `dumpsys connectivity` VPN transport | **PASS** |
| Logcat `GnirehtetActivity` received START | **PASS** |
| Logcat `GnirehtetService` received START_VPN | **PASS** |
| Logcat `VPN was already authorized` | **PASS** |
| Logcat `Relay tunnel connected` | **PASS** |
| Filtered logcat collection | 11 lines observed, 0 collection errors |
| Rust native log categories | checking client APK, starting client, starting relay server; no stderr chunks |
| Actual HTTPS transfer from phone and tunnel TUN RX/TX | **PASS in follow-up native run: HTTPS 200, both VPN tun RX/TX counters increased** |

**No new VPN authorization prompt is expected**: the maintainer saw Gnirehtet registered but disconnected in Android VPN settings, and `adb shell cmd appops get com.genymobile.gnirehtet ACTIVATE_VPN` returned **`allow`**. The GnirehtetActivity source bypasses the prompt if `VpnService.prepare()` returns `null`.

## Second native run: actual Android HTTPS and VPN tunnel bytes — PASS

A second bounded test used `F:\\Wirebound-Lab\\qa-tools\\gnirehtet-single-device-traffic-20261029.cjs`, a validated copy of the single-device, isolated-port runner. It invoked `gnirehtet run -d 8.8.8.8 -p 31416` with **one authorized handset** and ADB server **15379** (default ADB **5037** was not in use). Startup results again showed native relay listener, active Android Gnirehtet process, the intended ADB reverse mapping, and Android VPN transport. Concurrent filtered logcat observed **START activity, START_VPN service, previously authorized VPN, relay tunnel connected**.

While the VPN and reverse mapping were active, ADB invoked **Android's own `/system/bin/curl`** with a bounded TLS request to the public test domain `https://example.com`, suppressing the response body and printing only the HTTP status. **The command succeeded and returned HTTP 200**. From Android `/proc/net/dev`, the runner compared `tun*` receive/transmit byte counters **before and after the HTTPS probe**: counters were readable, and **both RX and TX increased**. The tool displayed **only booleans and HTTP status**, not private IPs, raw interface statistics, serial numbers, URL response text or packet contents.

The native CLI Stop succeeded. Its Android process lingered briefly after Stop, so the same **only-package-specific** `am force-stop com.genymobile.gnirehtet` cleanup was used. A Gnirehtet reverse mapping was still seen at the immediate post-Stop sample; the runner removed **only `localabstract:gnirehtet`**, without `adb reverse --remove-all` or touching other ADB mappings.

A separate, subsequent read-only verification found: **zero Windows Wirebound/ADB/Gnirehtet processes**, listeners on **5037/15379/31416 all closed**, **one Android device still authorized**, **no Android Gnirehtet process**, **no Gnirehtet reverse mapping**, **no VPN transport**. The temporary QA ADB server was explicitly stopped. This is a completed, clean **native-path internet traffic QA**, **not** a pass for Wirebound PR #63's own engine or UI lifecycle.

## Stop/cleanup boundary (NOT a pass for PR #63)

- Gnirehtet native CLI `stop` returned success, yet Android Gnirehtet app process was observed immediately afterward; the QA runner used **`adb shell am force-stop com.genymobile.gnirehtet` only for that package**. This force-stop should **not** be generalized to other apps.
- A Gnirehtet reverse mapping existed transiently after Stop. During an immediately subsequent authorized, isolated port-15379 inspection, **the mapping was absent**, the Gnirehtet Android process absent, VPN transport absent, relay port **31416** closed, and default ADB **5037** closed. ADB QA server shutdown was requested and the QA script exited successfully.
- Native Gnirehtet `stop` does not remove reverse mapping itself (see upstream `cmd_stop()`). Wirebound's `AdbService.stopAllClients()` has a separately designed **targeted Gnirehtet reverse cleanup**, which still needs real end-to-end PR #63 validation.
- No evidence of a persistent unintended VPN or a leaked native relay after this QA.

## Remaining gates

1. **COMPLETED on isolated native Gnirehtet pathway:** actual Android HTTPS TCP transfer returned HTTP 200 during a live VPN session; both `tun*` RX/TX counters increased. This does not establish throughput, DNS configuration correctness for every network, or the exact Electron PR #63 runtime.
2. Build/start the **exact head of Draft PR #63** on the authorized Windows host in a **separate QA checkout and Electron profile**. Do not reuse or overwrite the old PR #51 checkout; it has a special `node_modules` junction described in `F:\Wirebound-Lab\qa-pr-blockers-20261028\QA_STATUS_2026-10-28.md`. Do not recursively clean through that junction.
3. Exercise engine Start/Stop, selected-device connect/disconnect, Retry, process close delays, ADB reverse scope and UI state using the actual app under appropriately controlled default ADB **5037**, with only the single authorized test phone and no other competing ADB client.
4. Check app log privacy with **synthetic identifiers**; do not export raw native logs or real ADB serials in GitHub comments.
5. This native PASS says nothing about issue #44 Electron 15–57s startup latency or UX PR #50. Do not label issue #53 resolved, nor merge PR #63/#55/#59 without explicit authorization and hardware QA.

## Source / audit trail

- [Draft PR #63](https://github.com/man612/wirebound/pull/63)
- [Native VPN success and port-5037 source analysis](https://github.com/man612/wirebound/pull/63#issuecomment-6487916076)
- [Gnirehtet Rust ADB monitor source](https://github.com/Genymobile/gnirehtet/blob/master/relay-rust/src/adb_monitor.rs)
- [Gnirehtet Rust single-device runner source](https://github.com/Genymobile/gnirehtet/blob/master/relay-rust/src/main.rs)
