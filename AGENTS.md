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


## 2026-10-24 issue #44 Windows-offline handoff

- **MANDATORY for any AI/assistant working on startup issue #44:** first read [the Windows-safe issue #44 checkpoint](docs/qa/ISSUE44_RESUME_CHECKPOINT_2026-10-24.md), the current [Draft PR #51](https://github.com/man612/wirebound/pull/51), [issue #44](https://github.com/man612/wirebound/issues/44), and [renderer QA evidence](docs/qa/RENDERER_BOOT_PHASES_2026-10-24.md). Current live repository and Windows evidence override the dated snapshot.
- The maintainer plans to leave the Windows QA machine offline until approximately **Tuesday 2026-10-27 09:00 WIB**. Do not repeatedly poll the remote device or create replacement remote processes after timeouts. If unavailable, do only bounded GitHub/source/docs/tests work; do not claim Windows validation.
- The Windows checkout at D:\Projects\wirebound-ux-review-20261021 was **last proven clean at 62b4f57**. A later attempted fast-forward timed out, so the current Windows HEAD, running processes, and checkpoint update are **unknown**. When the device returns, check terminal sessions, git HEAD/status, exact-path QA process presence and F:\Wirebound-Lab\STATUS-2026-10-24.md before a non-destructive fast-forward. Never force-reset.
- Diagnostic branch PR #51 may advance by documentation-only commits after the last code checkpoint **800714c**; compare the diff before claiming new runtime changes. Keep #51 Draft, #44 Open, and PR #50 (UX) / #52 (Tauri) separate. No merge or release without maintainer approval.
- The v6 18,284ms outlier had **no CPU data**, despite its 5,899ms maximum heartbeat lag. QA v7 adds main-process CPU deltas, but the subsequent 12/12 quick runs generated no heartbeat samples before cleanup. Do not guess CPU values, blame the HDD, repeat the 12-run benchmark without a reason, or claim startup fixed. The target is one informative *future* extreme stall.
- Never modify the regular Wirebound installation, user profile, global ADB/Defender settings or production startup lifecycle to chase an unproven cause. Do not treat static audits, passing Vitest, or manual QA packages as physical USB/NSIS release parity.
- Repo handoff notes do not imply chatbot memory automatically persists. In new threads, agents should explicitly load these committed files and re-verify facts.
