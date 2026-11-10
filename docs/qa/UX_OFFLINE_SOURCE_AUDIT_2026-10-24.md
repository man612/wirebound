# UX PR #50 — offline source audit and safe handoff (2026-10-24)

Scope: [Draft PR #50](https://github.com/man612/wirebound/pull/50) and [issue #48](https://github.com/man612/wirebound/issues/48). This is a review of code checked into GitHub while the maintainer's Windows host is offline. **Do not call static inspection or pure-JS checks Windows/Chromium/USB validation.** The previously observed 18/18 Chromium-mock pass and 52/52 Vitest pass apply to the **older** PR HEAD `393623b307f3407e5c0236221c62b02d815061eb`, not necessarily to subsequent edits in this document.

## UX requirement traceability (code as of 2026-10-24)

| Issue | Source evidence on PR #50 | Audit assessment |
| --- | --- | --- |
| UX-01 onboarding Dark/Light preview | `OnboardingScreen.tsx` applies `data-theme` and root `dark` class in an effect driven by the selected theme; `App.tsx` saves completion settings | Implementation present; previously tested with browser mock, not retested after this audit |
| UX-02 brief diagnostic reveal | `Dashboard.tsx` starts expanded, schedules a 2,600ms collapse **after** the real scan settles and has a manual override ref | Implementation present; now also preserves visibility on failed individual checks |
| UX-03 copy report feedback | `Dashboard.tsx` uses Electron preload `copySupportReport`, copying/success/error UI, masked device IDs; `src/main/ipc.ts` uses Electron clipboard | Implemented; actual Windows clipboard acceptance remains untested on new edits |
| UX-04 rerun scan and temporary expand | `useDiagnostics` serializes runs, drops stale report before rescan; `Dashboard.tsx` rerun lock and temporary expansion | Implemented; completed scan containing error checks now shows a distinct localized status and stays expanded |
| UX-05 readable device details | `Dashboard.tsx` uses structured grid, `maskDeviceId`, status/version/API rows; `formatUiTimestamp` uses Intl per language | Implemented; OS locale/display scaling verification pending |
| UX-06 responsive device cards | `Dashboard.tsx` uses responsive `article` cards and device-specific action buttons, masked IDs, battery and genuine traffic `rxBytes`/`txBytes` | Implemented; physical device parity not proven by mock snapshots |
| UX-07 Clear disabled with empty logs | `Dashboard.tsx`: `disabled={logs.length === 0}` | Implemented with existing component test |
| UX-08 dismissible compact ready notice | `Dashboard.tsx` maintains `readyDismissed`, hides only 'ready' tone and retains alerts for other tones | Implemented; meaningful state transitions need native visual verification |
| UX-09 last update timestamp | `Settings.tsx` saves last attempt and success to localStorage and renders `formatUiTimestamp` | Implemented; failure state after app restart not independently validated |
| UX-10 no dashboard scroll jump | `Dashboard.tsx` scrolls only the `logViewportRef` element when pinned near bottom; no `scrollIntoView` on log changes | Implemented; original 18-scenario mock tested page scroll behavior |

The original detailed requirements remain at [issue #48](https://github.com/man612/wirebound/issues/48) and `docs/UX_DASHBOARD_AUDIT_2026-10-20.md`. The older evidence `docs/qa/UX_INTERACTIVE_QA_2026-10-21.md` is a **historical verified baseline**, not evidence of newly added changes.

## Confirmed offline code-review issue and isolated correction

Previously, `Dashboard.tsx` prevented auto-collapse only when `diagnostics.error` was set (i.e., the diagnostic API rejected). But `getDiagnostics()` may **complete normally and return individual `checks` with `status: 'error'`**, e.g. missing ADB/Gnirehtet runtime, device-access failure, or an active-client mismatch. The old auto-collapse timer could therefore hide an actionable diagnostic result after 2.6 seconds. This is a **source-supported UX logic gap** rather than a live measured Windows regression.

Changes on the PR #50 branch, with no production ADB/Gnirehtet, NSIS, packaging, or dependency edits:

- New pure `diagnosticsDisclosure.ts`: `hasFailedDiagnosticChecks(report)` examines the report's actual check statuses; an individual `error` is significant, while an informational/warning result is not automatically treated as a failed scan.
- `Dashboard.tsx` now inhibits both initial auto-collapse and post-rerun auto-collapse for a report containing real failed checks. A user can still manually collapse the panel. It distinguishes an API failure (`diagnosticsFailed`) from a completed scan with actual failures (`diagnosticsIssues`).
- English and Indonesian translations added: `Some checks need attention` / `Beberapa pemeriksaan perlu ditangani`.
- New `diagnosticsDisclosure.test.ts` covers missing, pass, warning, info and error statuses.
- The optional mock Chromium QA harness now includes a future `completed scan with failed check stays expanded` scenario; its synthetic failure changes passing count from **5/6 to 4/6**. This scenario has been **added but NOT executed in Chromium** during the Windows-offline review.

**Verification performed in this review:** the freshly fetched helper's function was evaluated using an isolated JS transform of its type annotation, and static assertions confirmed source branches, both translations and browser-case presence; **10/10** focused offline assertions passed. The browser harness source parsed as valid JavaScript. These are NOT native Vitest, TypeScript typecheck, packaged Electron or UI screenshot results.

## Remaining checks when Windows access returns

1. Check GitHub PR #50 HEAD versus the Windows UX checkout; inspect clean worktree/processes before any fast-forward. Do not interfere with the separate PR #51 issue #44 Windows checkout or `F:\Wirebound-Lab` artifacts.
2. Native checks on the exact new UX branch: `npm run typecheck`, `npm test`, and the original optional mock Chromium QA harness. The older baseline was 52/52 Vitest and 18/18 mock UI scenarios; **new counts are unknown** until actually executed. Confirm the newly added per-check error scenario does not auto-collapse and that a clean rerun does.
3. Review at roughly 600, 800, 1008 and 1280 px, Light/Dark and ID/EN; keyboard focus and reduced motion. Chromium mock testing is not an installed native Electron test.
4. After startup issue #44 is understood, validate separately packaged NSIS and the available **one** real Android phone: authorize, connect/retry/stop Gnirehtet, assess ADB and VPN state, and verify genuine RX/TX counters. Do not require a second handset; do not claim dual-device physical testing.
5. Keep #50 DRAFT / #48 OPEN pending maintainer approval, appropriate tests, and merge decision. PR #51 and PR #52 are separate. Do not release, bump dependencies, alter Windows Defender, or overwrite a working installation.

**Next agent entry point:** read root `AGENTS.md`, this audit, `docs/qa/UX_INTERACTIVE_QA_2026-10-21.md`, then verify the *current* PR #50 HEAD before editing. Chat memory and dated notes are not live repository or Windows evidence.
