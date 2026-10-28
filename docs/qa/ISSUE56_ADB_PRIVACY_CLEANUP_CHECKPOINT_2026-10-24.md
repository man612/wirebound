# Issue #56 — ADB device-identifier privacy and force-stop result accounting (offline checkpoint 2026-10-24)

Tracking: [issue #56](https://github.com/man612/wirebound/issues/56). Proposed remediation is intentionally isolated from engine lifecycle [Draft PR #55](https://github.com/man612/wirebound/pull/55), startup [PR #51](https://github.com/man612/wirebound/pull/51), UX [PR #50](https://github.com/man612/wirebound/pull/50), and Tauri experiment [PR #52](https://github.com/man612/wirebound/pull/52).

**Context / platform boundary:** The user's Windows QA machine stays offline until roughly Tuesday 2026-10-27 09:00 WIB (availability not guaranteed). This work was performed using GitHub source at main SHA `188751e535ee2250cb93ca01a9b2c753544ac466`. No Windows commands, ADB, real serials, installer, process kill, package updates or VPN traffic were involved. The Linux scratch container had Node 22 but could not resolve `github.com`, so it **could not obtain the repository for native Vitest/typecheck**; do not treat native tests as done.

## Findings in the original source

1. `AdbService.getDeviceDetails()` and `AdbService.stopClient()` logged `deviceId` verbatim in developer warnings, and passed the original ADB `Error` as a logging argument. Raw serials may therefore appear in local developer logs or collected diagnostics. `stopAllClients()` also passed unredacted reverse-cleanup errors to `console.warn`. This was a source-supported privacy exposure path; there is no evidence that the user's real serial was actually shared or uploaded.
2. `AdbService.stopAllClients()` detected active VPN clients, called `stopClient()` for each, and returned `activeDevices.length`. But `stopClient()` swallowed force-stop errors and returned `void`. Consequently an `am force-stop` failure did not reduce the count reported to `GnirehtetService.stop()` or unexpected-exit cleanup. It misrepresented attempts as successes. The count was **not** evidence of completed VPN disconnect in any event.

## Narrow fix (no runtime lifecycle edit)

Only `src/main/services/adbService.ts` and its Vitest scenario file change among production/test files:

- A private `safeDeviceError(error, deviceId)` masks **the relevant device ID** in an error string using the existing `maskDeviceId` format, while preserving other diagnostic text. The three warnings from device-details read failures, `am force-stop` failures and Gnirehtet reverse-query/removal failures use a masked ID and the safely rewritten message.
- `stopClient(deviceId)` now returns `Promise<boolean>`: `true` only when the ADB force-stop command resolves without error; otherwise warn (with masking) and return `false`.
- `stopAllClients()` continues to attempt a force-stop on each detected active device and independently attempts Gnirehtet-only reverse cleanup for **all authorized devices**, but returns `stopResults.filter(Boolean).length`. Existing callers still receive `number` as before; only the accuracy of the count changes.
- No change to shell arguments, ADB server startup/stop, the targeted `localabstract:gnirehtet` reverse mapping, VPN-state parser, child-process lifecycle, native Gnirehtet relay or shared/global ADB.
- This does **not** prove a VPN physically disconnected. ADB `am force-stop` success is only an acknowledged ADB command. The `Stopped. Cleaned N device client(s).` UI log should be interpreted in that limited sense until independently validated via Android VPN and kernel TUN state. Do not claim full status reliability yet.

## Regression fixtures newly written (not yet run under Vitest)

`src/main/services/adbService.scenario.test.ts` includes two focused scenarios using **synthetic**, non-user device IDs:
1. Two previously active devices; one ADB force-stop succeeds, one rejects; another device's Gnirehtet reverse-query fails. The return count must be **1**, both force-stop commands must be attempted, reverse cleanup remains independent, and all warnings must exclude the original full device IDs.
2. A `getSnapshot()` details query fails for a device whose full ID appears in the mocked executor error; the authorized device row must remain as a generic device, while console warnings contain only the masked ID.

### Isolated deterministic source-method checks

Freshly fetched updated GitHub `adbService.ts` blob `3bf37e4c9453ea4576a7000aa2815a4a3c26fd4d` was exercised by taking the **actual method bodies** of `stopClient()`, `stopAllClients()`, `maskDeviceId()` and `safeDeviceError()`, removing method type signatures, and running them with fake ADB executor and logger. The executor returned one successful stop and one failed stop; reverse cleanup returned one failure.

**7/7 assertions passed:** count equals 1; exactly two force-stop attempts; both masked identifiers present; neither raw synthetic identifier present; unrelated error text retained.

This exercise is **not** native Vitest and does not prove the new test file compiles, nor validate Windows clipboard, actual error objects and runtime subprocesses.

## Residual privacy risks and required follow-up

- Only the **current device ID** is replaced in the three selected ADB service warnings. Unexpected error messages containing other IDs, report check-details from external ADB responses, or identifiers printed by Gnirehtet **stdout/stderr** remain outside this small change.
- `GnirehtetService.handleOutput()` currently forwards arbitrary child stdout/stderr to renderer logs; `GnirehtetService.startDevice()`, `stopDevice()`, `handleUnexpectedClose()` and `reportAdbUnavailable()` may also pass raw subprocess errors into logs. These paths require **separate** narrowly scoped tests/redaction policy, especially after merging lifecycle issue #53. Do not declare logs or exported reports completely sanitized.
- `safeDeviceError()` matches the exact original `deviceId` substring; this is useful for the known per-device ADB arguments but not a universal privacy sanitizer. Never hard-code actual user device identifiers in repository fixtures.
- `stopAllClients()` still treats failed force-stops best-effort and continues attempting Gnirehtet-specific reverse cleanup. A successful ADB command can still fail to end a VPN on the device for unrelated reasons; physical Android confirmation remains mandatory.
- **Cross-PR integration:** PR #55 changes `gnirehtetService.ts`, while this branch only changes `adbService.ts` and tests, so no same-file production overlap was introduced by this remediation at this checkpoint. Recheck changing HEADs and combined behavior before any merge. Do not silently alter or merge PR #55.

## Native / hardware release gates

1. Check live GitHub HEAD, issue and PR status, and the Windows checkout's real `git status` before modifying any existing worktree. Keep QA checkouts/profiles isolated from ordinary Wirebound installation and `F:\Wirebound-Lab` evidence.
2. On the **exact issue #56 head**, run `npm run typecheck`, `npx vitest run src/main/services/adbService.scenario.test.ts`, the rest of the Vitest suite, `npm run build` and normal package/integrity checks; inspect failures rather than relabeling them as exhausted GitHub Actions quota.
3. Test error/warning redaction with fake IDs and then privacy-preserving real Windows logs (no raw user device IDs committed), including authorized/offline states, failed ADB commands, and the normal successful stop.
4. On the available **one** Android phone, check genuine ADB/VPN disconnect/reconnect and Gnirehtet-only reverse cleanup; confirm this count is a command-level success count rather than proof of physically ended VPN.
5. Evaluate PR #55 lifecycle correctness separately, then integration with PR #50/51 using the preserved integration contract. Do not release, merge, bump dependencies, alter Windows Defender, restart global ADB, kill unrelated processes or reset live checkouts without user authorization.

**Future AI agent:** read issue #56, this checkpoint, root `AGENTS.md`, other open Draft PRs and fresh actual tests. A dated handoff is not proof of validation or an instruction to merge.
