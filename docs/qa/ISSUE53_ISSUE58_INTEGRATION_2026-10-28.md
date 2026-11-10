# Issue #53 + #58 combined branch — 2026-10-28

**Status:** Draft integration for hosted Windows CI and scoped local fake-process validation only. DO NOT MERGE until reviewed and real Windows/Gnirehtet/one-phone QA is completed.

## Provenance
- Base from current main commit `d282ed6fc7118feeb43ded05cef243e5ea7539b0` after merged #57 (ADB warnings), #61 (original lifecycle audit), and #62 (Dependabot routine version updates paused).
- Lifecycle implementation from Draft PR #55 / `fix/issue53-gnirehtet-lifecycle-20261024` (`gnirehtetService.ts`, 5 new lifecycle scenario tests).
- Privacy implementation and tests from Draft PR #59 / `fix/issue58-gnirehtet-log-privacy-20261025` (native line buffer, recognizer, 6 helper tests, 3 service scenario tests, corrected readable-stream data event types).
- Integrated `GnirehtetService` retains start/stop promise single-flight, generation cancellation after awaited readiness, identity-bound process close/error, fail-closed 2-second stop timeout, gating cleanup before replacement; overlays redaction on all logs, known device IDs in action errors, separate per-process stdout/stderr line buffers, and safe trailing fragments on close/error.
- Combined scenario file contains 14 tests: six original baseline scenarios + five lifecycle scenarios + three privacy scenarios. Separate helper test file has six additional tests. `AGENTS.md` has existing main issue #53/#56 notes plus issue #53 fix and issue #58 privacy notes; no notes discarded.

## Validation boundaries
PR #55 hosted Windows CI was green at older head (51 Vitest cases); PR #59 pre-fix hosted CI failed typecheck on four `.write()` uses, since corrected at commit `ca6c1dc` but no new PR-run automatically appeared. Original upstream heads are not yet merged.
**No combined branch CI, typecheck, Vitest, native Windows build, Gnirehtet process, USB/VPN or physical Android validation existed at the moment this checkpoint was authored.** Check the actual GitHub Actions run of this Draft integration PR, revise this statement with evidence, and never equate mocked CI with hardware validation.

This branch is deliberately separate from the main app UX #50 and startup #51, which may have IPC/App conflicts on later integration. Issue #44 startup long-tail delay is still unsolved. Preserve ADB's global server and other apps' reverse tunnels; no dependency upgrades, app install, user profile edits, or merge approvals are implied.

## Review targets
1. Test every combined source behavior on CI Windows and then real Windows with synthetic data; use fake process for timeout/late-close first.
2. Ensure old native child `error`/`close` cannot clear or corrupt newer relay state; each child has its own stdout/stderr buffers and every published log passes redaction. Streams from intentional stops may flush sanitized trailing error context, but must not trigger stale client cleanup.
3. Verify meaningful recognized Gnirehtet Rust `["-s","SERIAL"]`, `adb -s SERIAL`, and device-error patterns; unknown freeform third-party logs are **not** guaranteed universally sanitized.
4. Validate stop-timeout status and replacement fail-closed on real Windows. A command-level ADB stop count is **not** verified VPN disconnection; one real Android handset should prove end-to-end RX/TX.
5. Maintain PR #50 UX, PR #51 startup, and all AGENTS notes when constructing any subsequently authorized integration; no automatic merge from this branch.
