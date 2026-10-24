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

## Issue #53: fail-closed Gnirehtet lifecycle fix — 2026-10-24

- Before changing `src/main/services/gnirehtetService.ts`, consult [issue #53](https://github.com/man612/wirebound/issues/53), [the proposed fix checkpoint](docs/qa/ISSUE53_LIFECYCLE_FIX_CHECKPOINT_2026-10-24.md) and documentation-only audit [PR #54](https://github.com/man612/wirebound/pull/54). The issue-53 fix is on its **own Draft branch** and has only 5/5 isolated JS control-flow checks, **not native Vitest, typecheck, Windows, NSIS or Android validation**.
- Preserve single-flight Start/Stop, cancellation after async ADB readiness, process-identity checks, and fail-closed behavior if child exit is not confirmed. Never use a global ADB kill or force-stop other apps' reverse mappings as a workaround.
- Keep UX PR #50, startup PR #51 and Tauri PR #52 separate; the existing PR #50+#51 merge preservation contract still applies. No merges/releases, Windows installation or forced resets without explicit approval. The Windows host is expected offline until roughly 2026-10-27 09:00 WIB; do not repeatedly poll.
