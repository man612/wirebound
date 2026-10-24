# Wirebound — offline ADB/Gnirehtet lifecycle safety audit (2026-10-24)

**Tracking:** [issue #53](https://github.com/man612/wirebound/issues/53). This is an audit and regression plan, **not a runtime fix, test pass, merge request, or v1.2.0 release approval**.

## Verified source state and scope

- Inspected public repository `man612/wirebound` at `main` SHA `188751e535ee2250cb93ca01a9b2c753544ac466`.
- The file `src/main/services/gnirehtetService.ts` has the same blob SHA `6b6fc11d155fed447e6c4654b18ae488bbc46c31` on `main`, [UX PR #50](https://github.com/man612/wirebound/pull/50), and [startup PR #51](https://github.com/man612/wirebound/pull/51) as checked during this audit. Its existing scenario tests also share the same blob across all three refs.
- Other inspected files: `src/main/services/adbService.ts`, `src/main/services/adbService.scenario.test.ts`, `src/main/services/gnirehtetService.scenario.test.ts`, `src/main/ipc.ts` on startup PR #51, `src/main/index.ts`.
- The maintainer intentionally left their Windows machine offline until approximately Tuesday 2026-10-27 09:00 WIB (availability not guaranteed). There were **no Windows remote calls, installs, real ADB commands, real USB traffic, actual child processes or packaged tests** in this audit. The historical one-Android-phone hardware testing does not validate these races.

## Finding A — P0 / reproducible logical concurrency gap: two Start calls

**Source:** `src/main/services/gnirehtetService.ts`: `start()` first returns early only when `this.childProcess` exists, then `await this.adbService.ensureServerReady()`, only then calls `this.spawnProcess(...)` and assigns `this.childProcess = childProcess`.

If two callers enter before ADB readiness settles, each sees `childProcess === null`. Both can proceed to spawn. The later assignment replaces the only tracked reference to the first process. The server-side service has no single-flight Start promise or cancellation generation; a UI-local disabled button is not an engine-level concurrency guarantee.

**Deterministic reproduction** on the original `start()` method body fetched from the exact GitHub blob: the function signature's TypeScript annotation was stripped for execution in an isolated JavaScript sandbox; `ensureServerReady()` was a manually deferred Promise; `spawnProcess()` returned harmless numbered fake objects; there were no native processes. Invoke Start twice before resolving the ADB gate, then release the gate.

Observed: **2 fake child spawns, `childProcess` tracks only child #2, and both promises return `{success:true}`**. This proves the source control flow under that schedule, not that the bug happened during a physical session.

## Finding B — P0 / reproducible logical cancellation gap: Stop while Start awaits ADB

**Source:** `start()` does not re-evaluate cancellation state after `await ensureServerReady()`. `stop()` uses `this.isStopping` only for its own body, and when no child exists it cleans ADB clients and sets state `disconnected`.

**Deterministic reproduction** with the original `start()` and `stop()` bodies and fake dependencies: begin Start and hold ADB readiness; invoke and complete Stop; then release ADB.

Observed: Stop returns `{success:true}`, late Start also returns `{success:true}`, **one fake child is created after Stop**, and final reported status remains `disconnected`. The real-world implications could include an unintentional background relay or inconsistent UI state; hardware behavior is not measured.

## Finding C — P0/P1 / delayed stale process close can run unexpected-exit cleanup

**Source:** `stop()` calls `kill()`, waits only two seconds for `close`, clears `this.childProcess`, sets disconnected, and resets `isStopping=false` in `finally`. The `close` handler installed by `attachProcessEvents()` calls `handleUnexpectedClose(code)` whenever `!this.isStopping`, without checking that `this.childProcess === childProcess` or that the process generation is still current. `handleUnexpectedClose()` calls `adbService.stopAllClients()` and eventually sets connection state from the old exit code.

**Deterministic reproduction** using the original method bodies in the same sandbox and an event-emitter fake child: arrange `waitForProcessClose()` to yield `false` (the timed-out branch), complete Stop, then emit a late `close(7)`. Observed: the unexpected-close handler is invoked **after** the successful Stop return. The fake handler did not execute real Android cleanup. Whether the physical relay can deliver a late close in that exact window requires native Windows validation.

**Invariant required:** a process's asynchronous `error`/`close` events may only mutate service state or Android client lifecycle if the event still refers to the service's active process generation. Do not clean the **newer** relay's devices in reaction to an obsolete child.

## Existing safeguards — do not regress

- `GnirehtetService` uses Node `spawn`/`execFile` with arrays of arguments, not an interpolated shell command; `isValidDeviceId` gates Gnirehtet CLI device IDs, including unsafe leading hyphens.
- `AdbService.cleanupGnirehtetReverse()` validates device ID and deletes only the named `localabstract:gnirehtet` mapping; it does not remove other applications' ADB reverse mappings.
- The shared ADB server is not shut down globally on Wirebound exit; `ensureServerReady()` checks port 5037 and requests a detached server only if not available.
- `parseGnirehtetVpnConnected()` relies on an actual Gnirehtet VPN network state, not mere process existence. RX/TX counters come from Android `tun` interfaces and must not be replaced with fake throughput.
- Startup PR #51 has guarded IPC `getServices()` readiness and a trusted-renderer check before **and after** async waiting. That protects IPC identity but does **not** serialize concurrent Gnirehtet `start()` operations once a service object is available.
- Existing Vitest scenario files exercise ordinary lifecycle and targeted device IDs. They did not have the three race-schedule fixtures at this checkpoint.

## Additional source-level privacy and cleanup review (not reproduced as a user incident)

1. `src/main/services/adbService.ts` includes `console.warn(`Wirebound: Failed to read details for ${deviceId}.`, error)` and a comparable `stopClient` warning that can embed a raw Android device ID into developer logs. By contrast, the structured `DiagnosticReport.devices` path deliberately masks IDs. **Do not conflate privacy of structured exported reports with privacy of all arbitrary developer logs.** Test redaction across error messages before claiming end-to-end privacy. Avoid putting actual identifiers in public artifacts.
2. `GnirehtetService.handleOutput()` forwards arbitrary native child stdout/stderr lines directly to UI engine logs. Do not declare these logs privacy-safe until output samples are characterized and sensitive values are redacted where necessary; keep honest failure diagnostics.
3. `AdbService.stopClient()` catches `force-stop` errors and returns `void`. `stopAllClients()` reports the number of **previously detected active clients**, even when one stop command failed. `GnirehtetService.stop()` then logs `Stopped. Cleaned N device client(s).` as success. This is a **potentially misleading cleanup count**, not proof that a physical VPN remained active. Consider separate attempted/successful/failed accounting with tests, while preserving best-effort exit behavior.
4. `stop()` does not globally stop shared ADB — retain that important safety behavior, and do not add process-wide kill shortcuts to solve the race.

## Regression-first remediation contract for issue #53

**No production change is authorized by this note alone.** In a separate, reviewable branch based on updated `main`, implement *after* adding deterministic failing regressions:

1. **Single-flight Start:** `start()` must serialize concurrent requests or share one inflight result and spawn at most one relay. Do not report success for an abandoned generation.
2. **Stop-wins generation:** check a monotonically increasing lifecycle/cancellation token or equivalent after awaited steps and before spawning; Stop invalidates previous work. Handle concurrent Start/Stop/Start without an unintended child.
3. **Stale child isolation:** event listeners must verify process identity and generation. A late `close` or `error` from an old process must not mutate the status of a newer process or run Android cleanup for it. Preserve real unexpected-exit cleanup for the active child.
4. **Failure semantics:** distinguish requested Start from active VPN and from actual process launch; report cleanup status precisely. Keep tray/quit behavior and per-device start/stop coherent.
5. **Tests:** deferred `ensureServerReady` with two simultaneous starts; Stop-before-ADB-ready; repeated Start/Stop/Start; late close after 2s and after new active child; rejected ADB readiness; spawn `error` and `close` order; repeated shutdown; no stray ADB server kill; targeted Gnirehtet reverse only.
6. **Privacy:** ensure newly introduced logs/events contain no raw Android serials or sensitive settings. Review existing `adbService.ts` `console.warn` calls separately rather than using a blanket error-string sanitizer that would obscure debugging.
7. **Validation tiers:** native `npm run typecheck`, `npm test`, build and package checks; then isolated Windows QA with exact executable/process tracking; lastly the single available Android device for USB/ADB authorization/VPN start/stop/reconnect and real counters before release. Do not stress the Windows disk/CPU, disable Defender, edit global ADB, force reset a checkout, or upgrade unrelated dependencies.
8. **Integration:** PR #50 UX, PR #51 startup and PR #52 Tauri remain separate. The PR #50/#51 cross-branch integration contract is on the UX branch at `docs/qa/PR50_PR51_INTEGRATION_CONTRACT_2026-10-24.md`. Do not silently merge any of them.

## What was and was not tested

| Evidence | State |
| --- | --- |
| Exact current `main`/`#50`/`#51` engine blob identity | VERIFIED via GitHub file blob SHAs |
| Two concurrent Start operations and Stop-during-Start schedules | REPRODUCED on source method body in isolated JS with mock services |
| Late obsolete child close routing | REPRODUCED on source method body with mock emitter and simulated timeout |
| Native TypeScript typecheck / Vitest on a new fix | **NOT DONE — there is no production fix here** |
| Windows native child lifecycle / official NSIS / actual Android VPN | **NOT DONE** |
| Raw USB identifiers captured to repo | **NO — examples use synthetic IDs only** |

**New-agent entry:** open [issue #53](https://github.com/man612/wirebound/issues/53), this document, repository `AGENTS.md`, and re-verify live GitHub HEAD and actual Windows QA status first. GitHub history plus real QA evidence outrank chat/project memory. Keep this audit Draft and do not assume the computer became available merely because Tuesday arrived.
