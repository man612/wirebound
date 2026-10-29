# Wirebound — agent operational notes

Read [docs/CI_LOCAL_VALIDATION.md](docs/CI_LOCAL_VALIDATION.md) before interpreting or rerunning GitHub Actions. Keep incident notes dated and evidence-based.

- On 2026-10-20, the maintainer reported exhausting monthly included Actions usage on their account, with a reset expected early November. This is a **reported, temporary account condition**, not proof Wirebound's public Windows runner jobs are billable or blocked.
- **Do not call every red check a quota failure.** Standard GitHub-hosted runners in public repos are free. When a workflow executed steps, inspect the actual log. The Oct 12/19 runtime-watch errors were PowerShell version-parser errors, not observed billing denials.
- Prefer the local PowerShell command documented in docs/CI_LOCAL_VALIDATION.md on a clean Windows checkout when hosted Actions are genuinely unavailable. Clearly identify local validation; do not claim it is GitHub CI.
- Do not attach a personal workstation as a persistent self-hosted runner on this public repository. Avoid merging dependency updates that fail compatibility tests or using forced peer dependencies to hide conflicts.
- Keep Windows/Android real-device validation separate from successful builds. Do not release untested feature claims.
- As of 2026-10-20 the maintainer has **one** Android phone. Physical two-device testing is explicitly waived for v1.2; do not repeatedly request another phone or claim multi-device hardware validation. Continue scenario tests and describe this limitation in release notes. Source of truth: docs/V1_2_RELEASE_READINESS.md and issue #38.

## Open v1.2 UI/UX feedback — 2026-10-20

- **Read [issue #48](https://github.com/man612/wirebound/issues/48) and [the detailed UX audit](docs/UX_DASHBOARD_AUDIT_2026-10-20.md) before changing onboarding, Dashboard, Settings, device lists or diagnostics.** These are 10 real user-observed defects and design requests; do not claim they are already fixed because this documentation exists.
- P0: onboarding Light mode live preview; malformed device-detail separators and localized date; preserve dashboard scroll position on log updates; responsive Android list without horizontal scrollbar; visible copy-report feedback; disable empty-log Clear.
- P1: briefly auto-reveal then collapse diagnostics without overriding manual actions; rerun progress with truthful checks and temporary reveal; compact dismissible ready banner; show accurate last check date/time/seconds for updates.
- Existing source contains the log-scroll cause in Dashboard.tsx (`scrollIntoView` on logs), a `min-w-[920px]` device table, local-only onboarding theme state, and corrupted separators in diagnostic details. Confirm actual code and tests instead of blindly redesigning.
- Preserve real ADB/VPN status, true cumulative TUN RX/TX counts, translation, keyboard accessibility, Dark/Light behavior and reduced-motion preferences. Do not fake scanning or force scrolling to logs.
- Document any before/after screenshots only after masking Android device serial/IDs. The maintainer has one physical phone; dual-phone hardware testing is waived.
- Close/check off each item in #48 only after implementation, tests, and a linked merged PR. Keep GitHub release readiness (#38) separate from these UX requirements.

## Issue #56 ADB log privacy / cleanup-count audit — 2026-10-24

- Read [issue #56](https://github.com/man612/wirebound/issues/56) and [the exact offline fix/QA handoff](docs/qa/ISSUE56_ADB_PRIVACY_CLEANUP_CHECKPOINT_2026-10-24.md) before touching ADB warning logs, `stopAllClients()` or Android client cleanup semantics.
- Proposed isolated branch masks the current Android device ID in selected `console.warn` calls and counts successful `am force-stop` **commands**, not previously active clients. This is **not** proof a physical VPN ended or all native process/renderer logs are redacted. The two native Vitest fixtures are written but unrun; only 7/7 source-method JavaScript assertions passed without hardware.
- Do not alter shared/global ADB or another app's reverse mapping; preserve `localabstract:gnirehtet`-only cleanup. The Gnirehtet lifecycle fix is separately proposed in Draft PR #55; this branch must not silently merge it or modify user Windows installations. Current Windows availability is not confirmed before roughly Tue 2026-10-27 09:00 WIB.

## Safety audit: concurrent Gnirehtet lifecycle — 2026-10-24

- Read [issue #53](https://github.com/man612/wirebound/issues/53) and [the offline ADB/Gnirehtet lifecycle safety audit](docs/qa/GNIREHTET_LIFECYCLE_SAFETY_AUDIT_2026-10-24.md) before editing `gnirehtetService.ts`, its process events, device cleanup, or start/stop sequencing.
- Three races were reproduced by executing the original method bodies with fake dependencies (concurrent Start spawns twice; Stop during pending Start allows a late spawn; stale child `close` after a timed-out Stop dispatches unexpected-exit cleanup). These are **isolated JavaScript control-flow reproductions**, not live Windows/USB proof. Do not release or claim they are fixed; add deterministic native Vitest regressions and validate actual hardware before production changes.
- Do not kill global/shared ADB or other applications' reverse mappings. Preserve masked structured reports and investigate raw device IDs in console/native subprocess logs separately. PR #50 UX and PR #51 startup remain separate and Draft.
- The Windows QA computer is expected to be offline until roughly Tuesday 2026-10-27 09:00 WIB; do not poll repeatedly, use the normal user profile, install over the user's application, or interpret a project chat's memory as source-of-truth.

## Issue #53: fail-closed Gnirehtet lifecycle fix — 2026-10-24

- Before changing `src/main/services/gnirehtetService.ts`, consult [issue #53](https://github.com/man612/wirebound/issues/53), [the proposed fix checkpoint](docs/qa/ISSUE53_LIFECYCLE_FIX_CHECKPOINT_2026-10-24.md) and documentation-only audit [PR #54](https://github.com/man612/wirebound/pull/54). The issue-53 fix is on its **own Draft branch** and has only 5/5 isolated JS control-flow checks, **not native Vitest, typecheck, Windows, NSIS or Android validation**.
- Preserve single-flight Start/Stop, cancellation after async ADB readiness, process-identity checks, and fail-closed behavior if child exit is not confirmed. Never use a global ADB kill or force-stop other apps' reverse mappings as a workaround.
- Keep UX PR #50, startup PR #51 and Tauri PR #52 separate; the existing PR #50+#51 merge preservation contract still applies. No merges/releases, Windows installation or forced resets without explicit approval. The Windows host is expected offline until roughly 2026-10-27 09:00 WIB; do not repeatedly poll.

## Issue #58 native Gnirehtet stdout/stderr privacy — 2026-10-25

- Read [issue #58](https://github.com/man612/wirebound/issues/58) and [the log privacy audit/checkpoint](docs/qa/ISSUE58_GNIREHTET_LOG_PRIVACY_CHECKPOINT_2026-10-25.md) before editing `src/main/services/gnirehtetService.ts` or the new `gnirehtetLogPrivacy.ts`.
- The isolated Draft proposal redacts known and structured Gnirehtet device serials from **reassembled** native process lines and selected returned errors; it is **not universal log/PII sanitization**. Pure JS helper checks passed 16/16 only; native Vitest, typecheck, actual Windows Gnirehtet and Android VPN checks are **NOT** complete.
- **Same-file integration conflict:** Draft PR #55 also edits `gnirehtetService.ts` for lifecycle safety. Preserve its child-generation and cancellation safeguards plus this branch's per-child/per-stream line buffers and error sanitization; do not select one version of the file wholesale. Separate ADB warning changes are on Draft PR #57. No merge, release, global ADB changes or ordinary Windows profile edits.

## 2026-10-29 Motorola hardware breakthrough / ADB monitor trap

- Read [native Android 15 QA checkpoint](docs/qa/GNIREHTET_MOTOROLA_NATIVE_QA_2026-10-29.md) and [Draft PR #63](https://github.com/man612/wirebound/pull/63) before diagnosing physical VPN failures or changing Gnirehtet process management. This newer evidence supersedes the **historical, dated** "native tests not run" claims in the Oct 24–28 checkpoints without changing what was true then.
- **Root cause of earlier nondefault-port QA failures:** upstream Gnirehtet Rust `AdbMonitor::track_devices()` hardcodes **127.0.0.1:5037**, ignoring `ANDROID_ADB_SERVER_PORT=15379`. Therefore `gnirehtet autorun` can open the relay on 31416 but cannot see devices from the isolated QA ADB server. This is **not proof of a Wirebound production issue**: Wirebound normally uses 5037. Never "fix" Android permissions, reinstall APKs, or change Wirebound global ADB handling on the basis of that QA artifact.
- For a **single** preauthorized Moto g45 5G / Android 15, the native **`gnirehtet run -d 8.8.8.8 -p 31416`** path (no `AdbMonitor`) using isolated ADB port **15379** successfully established the relay, reverse mapping, Android VPN, and `Relay tunnel connected`; a bounded `/system/bin/curl` HTTPS request returned **HTTP 200**, with **both VPN `tun*` RX and TX byte counters increasing**. These are genuine **native Gnirehtet hardware** results, **not** an executable test of PR #63's Electron app or a claim that every network works.
- A genuine Android pop-up need not appear: Android AppOps reported `ACTIVATE_VPN: allow`, GnirehtetActivity reported "VPN was already authorized" in filtered live logcat. Distinguish permission from active connectivity; do not instruct the maintainer to revoke/grant privileged permissions based on speculation.
- **Cleanup needs explicit scrutiny:** Gnirehtet CLI `stop` can return success while its Android process and `localabstract:gnirehtet` reverse mapping briefly remain. QA used targeted `am force-stop com.genymobile.gnirehtet` only for that package, and `adb reverse --remove localabstract:gnirehtet` only for that mapping. A final separate check confirmed no Gnirehtet app, reverse, VPN, Windows process or listeners on **5037/15379/31416**. Never run `adb reverse --remove-all` or `adb kill-server` against another app's shared server.
- **Still required before merge:** build and physically operate the **exact current head** of Draft PR #63 with a separate Windows QA checkout/userData; verify real UI Start/Stop, per-device Start/Stop race, multiple Stop/Retry, logs, and fail-closed native shutdown on the intended **default ADB 5037**. The existing CI 64/64 PASS is mocked/test/build evidence, not app-level hardware QA. Preserve PR #50 UX, #51 startup and all QA docs; do not upgrade dependencies, install over user's Wirebound, or merge without explicit authorization.
