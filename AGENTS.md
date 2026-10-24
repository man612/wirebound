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


## PR #50 UX offline follow-up — 2026-10-24

- Before continuing ten-item UX review in [Draft PR #50](https://github.com/man612/wirebound/pull/50), read [the verified/untested source audit](docs/qa/UX_OFFLINE_SOURCE_AUDIT_2026-10-24.md), [historical Chromium-mock matrix](docs/qa/UX_INTERACTIVE_QA_2026-10-21.md), and issue #48. Current branch source and evidence take precedence over dated notes or chatbot memory.
- A source-confirmed diagnostic disclosure bug was corrected on PR #50: a successfully completed scan **may contain failed checks** and must not automatically hide them. The helper/unit fixture and mock Chromium scenario were added while Windows was offline. Focused isolated logic checks passed; **native Vitest/Chromium/browser/NSIS/real USB tests for the new commits are NOT yet run**. Never inherit the earlier 52/52 or 18/18 evidence as proof for newer commits.
- The maintainer plans to reopen the Windows computer around Tuesday 2026-10-27 09:00 WIB; device availability is not guaranteed. Do not poll repeatedly or touch the regular user installation. Keep UX #50 separate from startup #51 and Tauri #52. No merge/release/dependency modernization without explicit approval.

## PR #50 + #51 integration safety

- **Do not resolve shared-file merge conflicts by choosing one branch wholesale.** Read [the source-verified integration contract](docs/qa/PR50_PR51_INTEGRATION_CONTRACT_2026-10-24.md) before combining UX PR #50 and startup PR #51. Their overlap includes `src/main/ipc.ts`, `src/renderer/src/App.tsx`, and this `AGENTS.md`; both PRs are Draft, and no combined app/installer has passed testing.
- Preserve startup's async service readiness / post-await sender validation alongside UX's Electron clipboard IPC. Preserve startup's React markers/lazy Settings alongside UX's onboarding theme preview and Dashboard `language` prop. Preserve both dated agent handoffs. Never treat individual PR mergeability as proof that sequential merge or combined runtime behavior is safe.
