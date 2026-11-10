# Issue #58 — Gnirehtet native log privacy (2026-10-25 offline checkpoint)

**Tracking:** [issue #58](https://github.com/man612/wirebound/issues/58). This is an isolated **Draft candidate** to review, NOT native Windows/Android validation or release approval. Baseline `main`: `188751e535ee2250cb93ca01a9b2c753544ac466` at audit time.

## Source-grounded exposure path

Wirebound `GnirehtetService.attachProcessEvents()` formerly forwarded every `childProcess.stdout`/`stderr` data chunk via `handleOutput()`, which converted it to lines and sent the text to `src/main/index.ts:sendLog()` and `gnirehtet:log`. The Dashboard terminal displays the log text; users might take screenshots or copy it manually.

Upstream **Rust** Gnirehtet may emit an ADB command with full command-line arguments, including `-s` and a device serial, when a command fails. The upstream references inspected during the audit:
- https://github.com/Genymobile/gnirehtet/blob/master/relay-rust/src/main.rs (the `exec_adb()` path and `error!(... Cannot start client: ...)`)
- https://github.com/Genymobile/gnirehtet/blob/master/relay-rust/src/execution_error.rs (error formatter serializes command and args)
- https://github.com/Genymobile/gnirehtet/blob/master/relay-rust/src/logger.rs (error records written to stderr)

**No user's actual serial was read or exposed during this work.** All samples are synthetic. The source path is potentially privacy-sensitive, not proof of actual leakage.

The UX [Draft PR #50](https://github.com/man612/wirebound/pull/50) **Copy Support Report** constructs a separate `DiagnosticReport` with masked device IDs; it is **not a raw terminal log export**. That distinction must survive reviews and UI copywriting.

## Narrow implementation on this branch

New `src/main/services/gnirehtetLogPrivacy.ts`:
- `redactGnirehtetLogLine()` masks known ADB IDs from strings using longest-match-first substitution.
- Recognizes **specific** native error shapes: Rust-style `["-s", "ID"]` argument arrays; CLI `adb -s ID`; `adb: device 'ID' not found/offline/unauthorized`; and keyed labels such as `serial=ID`/`device_id=ID`. It preserves the rest of the original error for diagnostics.
- `NativeLogLineBuffer` buffers each native child stream until newline, then hands complete lines to the redactor, so IDs split across two `data` events cannot bypass line-level patterns. Each buffer retains at most **8192 characters per line**; oversized lines are omitted until a newline and represented by a non-sensitive truncation marker.
- `flush()` publishes safely sanitized trailing data when native child `error`/`close` arrives.
- This is **not** general-purpose PII redaction: unknown unstructured logs, hostnames, IP addresses, filesystem paths and other sensitive data remain possible. The redactor intentionally does not promise complete removal.

Edited `src/main/services/gnirehtetService.ts`:
- All the service's calls to the injected `sendLog` now go through `emitSafeLog()`, including raw native subprocess lines and device-action errors. A bounded collection (64 entries) of recognized device IDs is learned from polling snapshots, active clients and explicit start/stop requests; no new ADB queries or delays are introduced for logging.
- Stream line buffers are **separate per child and per stdout/stderr** to avoid mixing unrelated processes. Partial lines flush at error and close.
- `startDevice()`, `stopDevice()` and `fail()` return masked `ActionResult.error` text as well as emitting masked logs.
- No native binary, ADB/Gnirehtet command argument, global ADB server, VPN, tunnel mapping, packaging or dependency change.

## Evidence and current verification status

New tests are checked in:
- `src/main/services/gnirehtetLogPrivacy.test.ts`: 6 Vitest cases for Rust errors, ADB/CLI forms, known IDs, chunk boundaries, stdout/stderr and oversized line handling.
- `src/main/services/gnirehtetService.scenario.test.ts`: 3 new fake-process scenarios for split stderr serials, trailing-line flush and known per-device error redaction.

A source-method V8 exercise of the exact new helper's GitHub content, after stripping TypeScript annotations in-memory, initially revealed a mistake in the `adb -s` regex's word boundary. This was corrected in a subsequent commit. **The final 16/16 focused JS helper assertions passed** on the updated source blob. This does **NOT** constitute TypeScript typecheck, native Node/Vitest, renderer/Chromium, packaged Windows or Android validation.

**Second isolated service-boundary reproduction (corrected harness):** the updated `GnirehtetService` method bodies `rememberDeviceId`, `emitSafeLog`, `attachProcessEvents`, `handleOutput`, and `startDevice` were extracted from the fresh GitHub file and run with synthetic event emitters and mocked ADB. **9/9 targeted assertions passed**: no emission of partial data chunks, masked Rust stderr, no raw synthetic ID, stdout retained, trailing stderr buffered then masked at child close, and masked per-device action error in both logs and returned result. A preliminary harness invoked `startDevice` after the fake child closed, which correctly triggered the unrelated 'engine must be started' guard and failed two assertions; the harness ordering was corrected and **9/9 passed** without any production-code change. As before, this is NOT native TypeScript/Vitest/Windows validation.

**Not run:** exact branch `npm run typecheck`, focused/full `npm test`, lint, build, Windows installed Electron startup, real native Gnirehtet process output, or genuine Android VPN traffic. Windows host offline; do not infer tests passed from another branch or from the current GitHub Actions quota. Do not misrepresent these checks.

## Special integration warning: conflict with PR #55

Lifecycle [Draft PR #55](https://github.com/man612/wirebound/pull/55) changes **the same file `src/main/services/gnirehtetService.ts`** (generation-based start/stop cancellation, child identity and unexpected-close cleanup). The present branch starts from `main`, not PR #55. **Neither version must be chosen wholesale during an eventual merge.**

Preserve both sets of behavior:
- From PR #55: single-flight Start/Stop, no late child spawn after Stop, and no stale process `close` changing new relay state.
- From PR #58: redacted native process/error logging, per-child/per-stream buffering and safe returned device-action errors.
- The child-bound log buffers should be tied to the **actual PR #55 child identity and generation**, not a globally shared buffer. Check logs emitted after a stale child `error` or `close`: avoid trusting obsolete events, do not bypass the lifecycle's source and identity checks.
- Additional known paths: ADB warning privacy Draft PR #57 edits `adbService.ts`, not this `gnirehtetService.ts` at this checkpoint; UX PR #50 and startup PR #51 are independent. Recheck live HEADs before integrating any branch.

## Residual privacy and QA gates

1. Unrecognized native output can still contain unexpected identifiers and unrelated PII. Future work must sample **redacted** synthetic/native output patterns and decide if a stricter log allowlist or opt-in verbose diagnostics is needed. Never commit the actual phone's unredacted serial, full ADB command traces, private IPs or personally sensitive logs.
2. The `log` redaction layer only covers GnirehtetService-injected engine logs. Other unredacted `console.warn` paths, the `adb:snapshot` IPC device IDs needed for actions, and raw third-party output outside this service are not claimed sanitized. The ID-mask policy for ADB warnings is separately tracked in Draft PR #57.
3. Run native `npm run typecheck`, targeted `npx vitest run src/main/services/gnirehtetLogPrivacy.test.ts src/main/services/gnirehtetService.scenario.test.ts`, the full Vitest suite, lint and build **on the exact new head**. Verify stream stdout/stderr timing, fake process `close/error`, and that the user's terminal still displays ordinary non-sensitive diagnostic messages.
4. On an isolated Windows QA checkout, validate process logging, serial redaction, error reporting, UI display, and first-run connectivity **without** the user's normal installer/profile or global ADB restarts. Then use the single Android phone to check Gnirehtet connect/disconnect/retry, native log output and genuine TUN RX/TX without sharing real serials.
5. Keep the PR **Draft**, issue #58 **OPEN** and `main` untouched until test evidence and explicit approval. Do not merge or release on the strength of synthetic checks alone.

**Future agent:** start with this file, issue #58, current GitHub heads/diffs and any actual Windows QA evidence. The Windows system was expected offline until roughly Tue 2026-10-27 around 09:00 WIB; availability must be established from actual machine status, not from the date or chat memory.
