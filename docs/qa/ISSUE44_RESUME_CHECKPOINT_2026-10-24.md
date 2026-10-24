# Wirebound issue #44 — agent handoff and Windows-safe resume (2026-10-24)

> Investigation checkpoint, not a fix or release approval. Read this together with issue #44, Draft PR #51, and the dated renderer/QA evidence. Do not replace new observations with this snapshot.

## Identity and review boundaries

- Repository: https://github.com/man612/wirebound
- Application: Wirebound Windows v1.2.0, Electron + React + TypeScript + Vite + ADB + Gnirehtet.
- Startup issue: https://github.com/man612/wirebound/issues/44 (OPEN at 2026-10-24 check).
- Diagnostic branch: fix/issue44-startup-trace-20261021, Draft PR https://github.com/man612/wirebound/pull/51 (OPEN/DRAFT, unmerged at check).
- Last verified diagnostic/code checkpoint before writing this handoff: 800714c3965191f8eb7668bfa41bcaded993b008. This is a baseline SHA, **not a prediction of the future branch HEAD**. Documentation-only handoff commits may advance branch HEAD; compare diffs before concluding code changed.
- UX PR #50 (fix/ux-audit-10-items-20261020) and Tauri experiment PR #52 are separate. Do not mix with the startup investigation. Electron remains the production direction.
- Default/main branch is not to be changed, and no merge, public release or installation on the regular user profile is authorized by this handoff.
- The maintainer expects the Windows computer to be OFFLINE until approximately **Tuesday 2026-10-27 09:00 WIB (Asia/Jakarta)**; this is a plan, not an uptime guarantee. Do not repeatedly poll the remote device.

## Where the original, non-portable evidence lives

- Windows QA source checkout: D:\Projects\wirebound-ux-review-20261021
- Independent QA lab: F:\Wirebound-Lab
- Local chronology: F:\Wirebound-Lab\STATUS-2026-10-24.md
- V6 outlier traces: F:\Wirebound-Lab\benchmarks\issue44-v6-controlled-followup-20261024\
- Mixed historical analysis: F:\Wirebound-Lab\benchmarks\issue44-v6-v7-heartbeat-correlated-20261024.csv
- V7 12-run series: F:\Wirebound-Lab\benchmarks\issue44-v7-cpu-followup-12runs-20261024\
- Repository technical evidence: docs/qa/RENDERER_BOOT_PHASES_2026-10-24.md and docs/qa/ELECTRON_STARTUP_INVESTIGATION_2026-10-21.md.
- Existing analyzer: scripts/qa/startup-mark-deltas.cjs; native regression tests: scripts/qa/startup-mark-deltas.nodecheck.cjs.
- Remote desktop connection/device: YASMAN. It was reported OFFLINE in the 2026-10-24 evening session, last seen around 3 hours earlier. **Do not assume it remains offline later.**

The local traces are **not checked into this public repository**. Do not fabricate raw traces from documentation, upload unredacted private logs, copy Android serials or profile contents, or claim GitHub has verified the Windows filesystem.

## Verified performance and instrumentation evidence

1. The problem is **intermittent**. Normal startup can show the window in about one second; severe outliers have spanned about 15–57 seconds. Trace-disabled launches have also suffered >57 seconds. No demonstrated root cause or permanent production fix exists.
2. Six starts of the *same manually assembled QA v6 executable*: 18,284 / 1,221 / 1,176 / 1,201 / 3,041 / 1,139 milliseconds to window-shown, all six passed; median 1,211 ms. On the 18,284-ms outlier:
   - main-module-start at process uptime 3,616 ms (this marker occurs AFTER module imports and early initialization);
   - main-module-start to app.whenReady: 2,355 ms;
   - native BrowserWindow construction: 3,008 ms;
   - did-start-loading to dom-ready: 7,162 ms;
   - renderer ESM entry to first React commit: 98 ms; React commit to settings-ready UI mark: 892 ms;
   - heartbeat delays 5,899 and 1,104 ms;
   - trace writer cumulative before window shown ~15.577 ms; ADB fingerprint ~310 ms. Neither alone accounts for the stall.
3. Later v7 adds CPU deltas via process.cpuUsage() on the **existing QA-only main-process heartbeat**, not an extra polling sampler. Fields cpuUserMs and cpuSystemMs do NOT cover Chromium renderer, GPU, or other child processes. The v6 18,284-ms trace predates this CPU instrumentation. Its CPU values are **unknown**.
4. QA v7 passed 82/82 Vitest tests, typecheck and build; packaged QA ASAR integrity 16/16; eight normal-icon smoke starts 8/8; one held-open real Electron run emitted numeric CPU heartbeat records (tick 5: user/system 0/0 ms and tick 10: 16/0 ms). Those runs did not reproduce a severe startup stall.
5. Twelve further sequential v7 launches reused the same frozen manual QA binary: 12/12 passed, times in order 1105, 1294, 1129, 1097, 1034, 1180, 946, 1096, 1058, 1089, 1084, 1093 ms; median 1,094.5 ms. No malformed trace, no orphaned QA executable, and no heartbeat event before safe cleanup. This is **no sampled CPU**, not zero CPU and not evidence the issue vanished.
6. The CSV analyzer's additional fields are heartbeatSamples, maxHeartbeatDelayMs, cpuUserMsAtMaxLag, cpuSystemMsAtMaxLag, cpuSampledHeartbeats. Seven of seven native Node tests passed on Windows, and 18 existing v6/v7 traces were parsed. The v6 18,284-ms case had four heartbeat records, 5,899-ms maximum lag, zero CPU-*sampled* heartbeats, and blank (NOT zero) CPU cells.
7. Late renderer QA probes at approximately 2, 5, 12, 25 and 45 seconds can observe recovery beyond the first probe, but the 5–45-second branch was only validated with deterministic tests, not during an actual extreme Windows stall. The readiness gate must require a full UI-ready probe, not mistake a nonempty pre-settings React placeholder for complete readiness. A UI mark does not prove real USB traffic, settings IPC success or painted content.
8. Independent investigations ruled out a necessary contribution from icon decoding, a sufficient explanation from trace-writer overhead, and a necessary trace-enabled condition. A malformed local ASAR from changing packaging inputs **was** found and an integrity gate added, but separate valid-ASAR startups still had severe delays. Do not collapse these into one cause.
9. A delayed main-process heartbeat can arise from synchronous blocking, CPU pressure, Windows scheduling, disk waits, or a combination. It is **not proof of a slow HDD, Windows Defender, or a Chromium defect**. The blind spot before main-module-start remains, because the heartbeat starts after that mark.

## 2026-10-24 evening connectivity checkpoint

- GitHub PR #51: OPEN and DRAFT, head 800714c3965191f8eb7668bfa41bcaded993b008 **before handoff writing**; issue #44 OPEN. PR #50 and #52 separately OPEN/DRAFT at inspection.
- Remote Desktop Commander device YASMAN: OFFLINE. No remote shell was started, no Windows filesystem or process was read, no fast-forward was verified.
- **Last successfully confirmed Windows checkout** from the preceding investigation: clean working tree on 62b4f57f880ac5a153348c88b89095568ca8de53. A later attempted fast-forward to 800714c timed out. It might have completed or not; the actual Windows HEAD and process state are UNKNOWN. Never silently treat the old confirmed SHA as the live HEAD.
- No further build, benchmark, QA process, source edit, merge, installer or Android action occurred during this GitHub-only status verification.

## Resume procedure when Windows access genuinely returns

1. Read this note, existing dated QA documents, current PR #51 and issue #44. Recheck current GitHub PR/issue state and branch SHA; notes may have changed.
2. Check Desktop Commander online status **once**, conservatively. Avoid repeated timeouts, polling or duplicate remote processes when quota or connection is constrained.
3. On the Windows host, inspect existing remote terminal sessions before starting a new one if the old invocation may still be active. Verify checkout HEAD, git status, any QA processes by **exact executable path**, and tail of F:\Wirebound-Lab\STATUS-2026-10-24.md. Keep the regular Wirebound installation and user profile untouched.
4. If and only if working tree is clean and nothing is running, compare Windows HEAD with the current GitHub diagnostic branch and do a non-destructive **fast-forward**. Never force reset and do not overwrite local changes or logs. The original remote uses SSH; earlier safe temporary HTTPS fetch avoided changing global remote config.
5. Do **not** repeat the 12-fast-run v7 benchmark, rebuild packages, or reinstall NSIS without a concrete measurement need. Preserve frozen QA binary and comparable settings. If a new rare stall occurs, correlate process-visible window, main-module-start, app.whenReady, BrowserWindow ctor, renderer loading, ESM/React/UI/FCP markers, worst heartbeat delay and same-interval CPU deltas against a same-binary fast baseline. Keep process-relative and navigation-relative clock origins separate.
6. Only if measured evidence is insufficient, consider a small tested diagnostic extension (e.g. selected synchronous-operation durations, child CPU or bounded Windows ETW) after assessing host load. No heavy stress test, Defender disable/exclusions, HDD saturation, high-rate resource polling or speculative renderer reload loop.
7. Treat new production startup behavior as unapproved until safety tests pass: lifecycle, device availability, NSIS parity and a real Android USB/ADB/Gnirehtet connection. Report **passed / failed / not tested / hypothesis** separately.

## Working rules for any later AI agent

- GitHub source and immutable commit SHAs plus Windows raw QA artifacts are the evidentiary sources, **not chatbot memory** or this handoff alone. Always verify current HEAD, test outcomes and process safety.
- Keep diagnostics privacy-limited and opt-in. Never capture device IDs, traffic, file paths, settings values, or private profile contents in startup telemetry.
- Do not upgrade end-of-life dependencies just for being old; maintainer explicitly defers that work.
- GitHub Actions quota was reported constrained; read AGENTS.md and docs/CI_LOCAL_VALIDATION.md, do not misclassify a workflow error as a billing failure. Local tests must be identified as local, not hosted CI.
- One real Android phone is available; dual-device hardware testing is waived, but single-device USB reverse tethering must be validated before release.
- Do not merge any PR, publish a release, install over the user's normal Wirebound, reset working trees, clean global ADB, or change default Windows settings without explicit authorization.
- Treat issue #44 as OPEN, PR #51 as DRAFT, and the root cause as UNKNOWN unless newer evidence supersedes them.
- New conversation prompt: "Continue Wirebound issue #44 from the latest repo docs/qa/ISSUE44_RESUME_CHECKPOINT_2026-10-24.md, AGENTS.md and current PR #51; check reality before modifying anything." This is a pointer, not an assertion that ChatGPT's project memory persists.

## What can be done without the Windows computer

- GitHub-only static code audit, privacy and safety analysis, test-gap assessment, improvements to self-contained documentation/tests, and review of PR/issue evidence.
- Keep modifications isolated and reviewable. Do not claim Windows smoke, executable behavior, official installer parity, live Android traffic or actual performance improvements based solely on static source review.
- Leave #50 UX audit and #52 Tauri spike outside #51 unless a precisely scoped technical dependency is proven.

**Next human checkpoint:** planned Windows availability Tuesday 2026-10-27 around 09:00 WIB, subject to user confirmation. This file itself is not an automation or a guarantee of a computer becoming available.

## Offline QA analyzer audit — 2026-10-24 later continuation

A GitHub-only source audit found a concrete **reporting correctness issue**, not a new Electron runtime or USB defect. The Node CSV phase analyzer previously scanned all `renderer-root-probe` and `renderer-timing-early` records and independently selected the last available numeric value for each performance mark. With **two renderer navigations in one trace**, the latest page could have ESM/React marks but *no* UI-ready/FCP while the CSV borrowed older UI-ready/FCP from the prior page, misleadingly implying that the latest page rendered correctly. It also paired the **first** `did-start-loading` with the **first** `dom-ready`, which could conceal an unfinished later navigation.

- Commit `83313ea` updates **only** `scripts/qa/startup-mark-deltas.cjs`: renderer timing probes are scoped to events after the latest `did-start-loading` when present; renderer load-to-DOM duration is matched to that same latest load, or left empty when no later DOM readiness was observed. Historical synthetic traces that have no load-start event continue to use the old probe behavior.
- Commit `9a6d8f2` adds two native Node regression fixtures to `scripts/qa/startup-mark-deltas.nodecheck.cjs`: the second navigation must not inherit UI-ready/FCP from the first, and an unfinished second navigation must not inherit the first `dom-ready`.
- **Offline logic verification:** the *actual, freshly fetched* JS analyzer and test source were executed in an isolated JavaScript harness with emulated `fs`, `path`, and `node:test` dependencies; all **9/9** test callbacks passed, including the two new cases. This is **not** a native Node `node --test` run, not Vitest, and not Windows/packaged QA validation. No browser process, benchmarking, device, installer or normal user profile was touched.
- **Residual review boundary:** `scripts/qa/startup-phase-report.ps1` is a separate PowerShell summary and was **not changed**; its early/first-event timing policy can still give a different answer on multi-navigation traces. Verify and repair it with real PowerShell tests when appropriate. No claim that *all* QA reporters are multi-navigation safe.
- No source under `src/` was modified. Draft PR #51 remains diagnostic only; issue #44 retains unknown root cause. New documentation-only or QA-only commits can make branch HEAD newer than the initial checkpoint SHA `800714c`.

For any later AI agent: inspect current PR #51 HEAD, and verify native `node --test scripts/qa/startup-mark-deltas.nodecheck.cjs` and Windows QA before promoting this code review to platform validation.
