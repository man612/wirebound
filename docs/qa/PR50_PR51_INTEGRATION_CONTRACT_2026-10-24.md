# PR #50 + PR #51 integration contract — 2026-10-24

> **Planning only. No merge, release, installed-app modification, Windows QA or cross-branch code integration was performed.** Recheck both PR HEADs and the target `main` at integration time. This document records actual source overlaps to stop a later agent from accidentally taking one side of a merge conflict wholesale.

## Pinned inspection points

- `main`: `188751e535ee2250cb93ca01a9b2c753544ac466` when audited.
- UX: [PR #50](https://github.com/man612/wirebound/pull/50) Draft/OPEN, reviewed head `daf7c6bf39977764678d7bbbf67e13335d5d5dfb`.
- Startup: [PR #51](https://github.com/man612/wirebound/pull/51) Draft/OPEN, reviewed head `a0b2aa586d34ffa0a08a6b79c1c792caf7868f3f`.
- Startup root cause remains **unknown** and [issue #44](https://github.com/man612/wirebound/issues/44) remains OPEN. UX [issue #48](https://github.com/man612/wirebound/issues/48) remains OPEN.
- Both PRs targeted `main` and each was individually shown as mergeable against that base at inspection. **This does NOT certify merging one branch after the other**, nor certify their combined behavior.
- Intersection of PR changed-file paths: **exactly three**: `src/main/ipc.ts`, `src/renderer/src/App.tsx` and `AGENTS.md`. Other paths are disjoint *at this inspection*, but independent files can still have behavioral/type/API integration dependencies.

## Three-source merge preservation checklist

### 1. `src/main/ipc.ts` — P0: preserve device/service safety AND copy report

The UX branch adds Electron `clipboard` import and an `app:copy-support-report` IPC handler. The handler checks the trusted sender, validates that the request is a nonempty string of at most 100,000 characters, catches errors and returns an explicit `ActionResult`. Its matching preload API `copySupportReport`, UI feedback, and `GnirehtetAPI` type live in separate PR #50 files. If only the startup version of `ipc.ts` survives, UI copy calls may reject with **no handler registered**.

The startup branch replaces eager `adbService`/`gnirehtetService` IPC dependencies with async `getServices()` and `trustedServices(event)` so requests wait for the same startup readiness promise, and **recheck the trusted renderer after awaiting**. The startup `src/main/index.ts` calls `registerIpcHandlers({ getServices: () => servicesGate.wait(), ... })`. If only the UX version of `ipc.ts` survives, the signature no longer matches and the deferred runtime/lifecycle safety gate may be bypassed or typecheck may fail.

**Required combined behavior:** keep startup `IpcDependencies.getServices`, `trustedServices` and its before/after-wait sender checks for device/engine operations; also keep UX clipboard import and safely validated, trusted `app:copy-support-report` handler. Clipboard is independent from ADB readiness and must not spuriously wait on the ADB gate. Do not weaken `assertTrustedSender` for convenience. Preserve all other existing IPC handlers and per-device operations.

Integration checks:
- Typecheck compiles `registerIpcHandlers` dependencies with PR #51 main process.
- Preload/type/UI `copySupportReport` matches a registered IPC channel; copying a masked report succeeds or shows a localized actionable error.
- Main vs untrusted sender is rejected, and requests waiting for services are rejected after renderer navigation/crash/shutdown; no duplicate Gnirehtet engine or unauthorized action is created.
- Normal engine start/stop, per-device actions, diagnostics, settings and update checks retain existing behavior.

### 2. `src/renderer/src/App.tsx` — P0: preserve theme preview AND startup milestones/lazy Settings

PR #50 adds `language={settings.language}` to `Dashboard` and restricts the root theme effect to **`settings.onboardingCompleted`** while onboarding is being previewed. Without that guard, `OnboardingScreen`'s provisional Dark/Light selection can be overwritten by the parent effect from stored settings during initial mount or settings refresh.

PR #51 adds `markRendererStartup('react-first-commit')`, `markRendererStartup('ui-settings-ready')`, and code-split `Settings` using `lazy` + `Suspense`. These are diagnostic and startup-related behaviors; taking only the UX `App.tsx` drops the markers and lazy chunk while taking only startup `App.tsx` drops the dashboard `language` prop and risks the theme preview.

**Required combined behavior:**
- `react-first-commit` remains a once-only (helper deduplicated) mount marker; it is **not** interpreted as actual dashboard readiness.
- `ui-settings-ready` remains emitted when `loaded` becomes true, regardless of whether onboarding has been completed. Do not accidentally gate this diagnostic mark on onboarding completion when gating the *theme effect*.
- Onboarding's temporary selected theme is authoritative **until** setup completion. Parent's stored-settings theme effect must not override it while onboarding is active. Preserve Dark -> Light -> Dark immediate preview.
- Keep the UX Dashboard `language` prop, PR #51 `lazy(() => import('./components/views/Settings'))` + `Suspense` fallback, and Settings screen's last-update-check state from PR #50.
- Do not treat `ui-settings-ready` as settings IPC success, a native paint or physical USB readiness.

Integration checks:
- Initial onboarding Dark/Light switching, completion and theme persistence.
- Dashboard -> lazy Settings -> Dashboard, both ID/EN locales and timestamps.
- Renderer entry/React/UI-ready/FCP numeric QA marks and full readiness gate.
- Confirm lazy-loaded Settings assets are present in the verified package and do not break renderer navigation.

### 3. `AGENTS.md` — P1: preserve both agent handoffs

PR #50 links [UX offline audit](UX_OFFLINE_SOURCE_AUDIT_2026-10-24.md), issue #48 and historical UX mock/browser tests. PR #51 links [startup offline-safe handoff](ISSUE44_RESUME_CHECKPOINT_2026-10-24.md), issue #44 and measured CPU/heartbeat limitations. Both append to the same root file. Keep **both instructions and both linked documents**; do not discard either while resolving conflicts. File path links above are relative to `docs/qa/`; root `AGENTS.md` links need `docs/qa/...`.

## Integration behavior beyond overlapping paths

- PR #50's dashboard diagnostics may start immediately on mounting; PR #51's *QA-only* UI-first path intentionally defers ADB runtime until after window show. The startup service gate must handle that queue without blocking the first UI render or leaking unhandled failures. This is a **test scenario**, not a proven current deadlock.
- PR #50's added preload IPC and shared `GnirehtetAPI` type must agree with final `src/main/ipc.ts`.
- PR #51's Renderer/ESM startup markers and late full probes must not mistake PR #50's complex dashboard or an early placeholder for a fully ready UI.
- PR #50's additional diagnostics and new renderer components could change startup timings relative to the *isolated* PR #51 v6/v7 QA package. Historic ~1s normal launches and 18.284s outlier are NOT automatically combined-build benchmarks.
- Normal Electron release lifecycle, ADB/Gnirehtet runtime, tray behavior, true TUN RX/TX counters, theme accessibility, and Windows auto-start settings require independent regression checks.
- Do not bring PR #52 (Tauri exploration) into this integration.

## Safe eventual procedure — only after maintainer explicitly approves

1. Check live `main`, PR #50 and #51 HEADs, open/merged status, and their updated changed-path intersection. This document is a dated snapshot; do not use stale SHAs for merges.
2. Establish an **isolated, disposable integration worktree/branch** from the approved target commit. Never force-reset either existing review branch; do not mutate the user's installed Wirebound or the established Windows QA checkout.
3. Apply one authorized PR, then the other, solving shared-file changes line-by-line using the preservation requirements above. Inspect the complete diff rather than blindly selecting `--ours` or `--theirs`. Do not push a production merge without explicit approval.
4. Run targeted typecheck and tests for startup service gate, renderer marks, UX diagnostics disclosure, clipboard IPC, theme/onboarding and lazy Settings. Then lint, full Vitest, build and packaged ASAR verification. Report native Node/Vitest/PowerShell, mock Chromium, packaged Electron and real hardware as **distinct evidence classes**; old PR-specific green checks do not transfer automatically.
5. On Windows when available, run isolated QA package smoke and actual official NSIS parity. Use the available **single** Android phone to verify ADB authorization, Gnirehtet connect/stop/retry, VPN approval and genuine RX/TX. Do not introduce Defender changes, heavy disk stress or high-frequency OS sampling to provoke startup stalls.
6. Do not close issues #44/#48 or release solely because source files merge or compilation succeeds. Keep root cause and platform-test uncertainty visible.

## Offline audit result and limitations

This review inspected actual GitHub versions of the three intersecting files and the current PR metadata. It found **source-level integration hazards**, not an executed Git conflict and not a validated combined build. No local/remote Windows terminal commands, merge rehearsal, Node/TypeScript/Chromium tests, source edits, releases or installer changes were performed to establish the above requirements.

**Future AI handoff:** read this contract together with each branch's own `AGENTS.md`, QA checkpoint and current PR discussion. GitHub plus Windows evidence outrank chatbot memory.
