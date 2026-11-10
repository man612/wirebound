# Issue #53 — Gnirehtet lifecycle safety fix (offline checkpoint 2026-10-24)

**Status:** proposed code fix on an independent **Draft** branch, not merged, not release-ready, not approved as native Windows-safe. Original evidence: [issue #53](https://github.com/man612/wirebound/issues/53) and the [documentation-only audit PR #54](https://github.com/man612/wirebound/pull/54). This document is intentionally separate from UX PR #50, startup PR #51 and Tauri PR #52.

## Why this exists

The unchanged baseline `GnirehtetService` on `main` had three reproducible asynchronous state-machine gaps:
1. Two simultaneous `start()` calls could both pass the `childProcess === null` gate before awaiting ADB and spawn two relays; only the second would remain tracked.
2. `stop()` during a pending `ensureServerReady()` could succeed before the late `start()` spawned a relay; reported status could remain `disconnected` while a relay had started.
3. A child `close` event after a Stop timeout could invoke unexpected-exit Android client cleanup after Stop had already returned. Old asynchronous cleanup could also overwrite a newer status.

These schedules were reproduced by directly executing original source method bodies with fake ADB and child-process dependencies; they were not observed on an actual Windows machine.

## Change details (separate issue #53 fix branch)

`src/main/services/gnirehtetService.ts` now:
- Uses a **single-flight `startPromise`**, so concurrent starts while initial readiness is pending use one resulting operation and create at most one relay.
- Uses a **single-flight `stopPromise`**, so a second concurrent Stop waits for the same true outcome instead of returning premature success.
- Increments a **lifecycle generation** synchronously when Stop begins, invalidating an older Start, and verifies the generation **after awaited startup prerequisites and before spawn**. A cancelled Start returns an explicit unsuccessful result.
- Tracks each child by object identity; recognizes intentional stops with a `WeakSet`, preventing late old-child `close` or `error` from performing unexpected-exit actions.
- If a relay **does not confirm close within the existing 2-second bound**, does **not** declare clean shutdown, drops no child reference, and refuses replacement relay creation until the old child actually closes. It reports a failure instead of an invented disconnected state. This intentionally changes error semantics and **requires native Windows shutdown parity validation**.
- Waits for an unexpected old-relay cleanup promise before starting a replacement, preventing cleanup of old clients from overlapping a newly launched autorun relay. Generation checks prevent old cleanup from updating the state of a newer generation.
- Does not change external process command arguments, DNS/port normalization, global/shared ADB handling, Gnirehtet reverse cleanup scope, executable paths, or package/dependency versions.

`src/main/services/gnirehtetService.scenario.test.ts` adds five deterministic native-Vitest regression cases:
1. two concurrent Start requests held on a deferred ADB promise;
2. Stop completing before pending Start's ADB promise resolves;
3. old native process not emitting `close` during Stop timeout, then late close and replacement;
4. new Start queued until previous unexpected-exit cleanup resolves;
5. two Stop callers sharing the actual delayed cleanup outcome, explicitly synchronized to cleanup entry.

The tests are **written but NOT yet run using native Vitest**.

## Offline source-method verification

After writing the fix, re-read the exact GitHub source file blob `ca42604c63eb9cace6073a6a695048c820633eed` (recheck live blob when using this note). Isolated JavaScript execution using **the fetched method bodies** with only their TypeScript *method signatures* replaced, and with synthetic child/ADB/process environment, gave **5/5 PASS**:
- concurrent Start: 1 fake child;
- Stop during pending Start: cancelled result, 0 spawned children and disconnected status;
- Stop timeout: unsuccessful Stop, replacement blocked while old child remains; replacement allowed after late confirmed close;
- unexpected-exit cleanup in progress: new relay not spawned until cleanup promise resolves; new status remains connecting;
- concurrent Stop: one shared completion with both returning actual success.

**Evidence boundary:** This is a **pure JavaScript control-flow harness**, not a native repo test, TypeScript typecheck, Vitest, Windows executable launch, real Gnirehtet subprocess, installed NSIS, or Android USB/VPN validation. One preliminary fake-process harness attempt failed because its own fake `queueMicrotask` was unsupported; the corrected final harness uses Promise microtasks and passed 5/5. Never report the preliminary harness failure as product code failure, or the 5/5 as native test success.

## Native test and release gates

1. When the maintainer actually reconnects Windows (planned roughly Tuesday 2026-10-27 around 09:00 WIB; not guaranteed), verify checkout `git status`, current HEAD and any QA processes, and work **in a distinct isolated branch/worktree**. Do not modify the ordinary Wirebound profile or existing `F:\Wirebound-Lab` evidence.
2. Run `npm run typecheck`, focused `npx vitest run src/main/services/gnirehtetService.scenario.test.ts`, then full local test suite and build **on this exact branch**. Fix compile/test bugs before wider scope; do not claim the historical tests from PR #50/#51 passed this branch.
3. Exercise native Windows child-process behavior in QA isolation: normal Start/Stop; repeated Start/Stop; delayed ADB ready; concurrent start; stop-before-ADB-ready; real slow or refused child close; exit codes and error callbacks; tray/quit; repeated retry without orphan processes. Avoid repeated stress benchmarks or global ADB commands.
4. On the available **single** physical Android phone, verify authorization, Gnirehtet launch, VPN approval, detach/reconnect, stop/retry, and genuine TUN RX/TX. No second handset is required.
5. Carefully verify Stop timeout behavior for real Electron/Gnirehtet child exit. With a timed-out kill, the service deliberately stays `error` and prevents a replacement until close arrives. Do **not** relax this fail-closed protection merely to hide an error; find and test a safe recovery sequence.
6. Confirm no regression to the startup readiness gate (`getServices`), sender validation, diagnostics, clipboard UX, local logging and Android reverse mapping isolation when branch integration is separately authorized.
7. Keep PR Draft, issue OPEN, and do not merge/release, upgrade dependencies, install anything over the user's live profile, reset an existing worktree, kill unrelated processes or globally restart/stop ADB based on this document.

## Source vs ongoing truth

The latest GitHub source and actual platform QA outrank this dated checkpoint and chatbot memory. The issue #53 fix has **not** been proven on the maintainer's computer, and issue #44's long-tail startup delay is **not** explained by this lifecycle race.
