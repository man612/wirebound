# Wirebound v1.2.0 — interactive UX QA (2026-10-21)

**Scope:** [PR #50](https://github.com/man612/wirebound/pull/50), [UX issue #48](https://github.com/man612/wirebound/issues/48). This document is evidence for the renderer/onboarding behavior, **not** a physical Android VPN sign-off and **not** a release approval.

## Evidence and environment

- Windows 11, Node.js 24, production output from `npm run build` served over local HTTP to a headless Chromium instance.
- `scripts/qa/renderer-mock-qa.cjs` injects a **synthetic** Electron preload API before React starts. No genuine USB serial, machine identity, local settings, telemetry or terminal data are used.
- The harness exercises live DOM controls, actual React effects and timers, resize/layout, copy error paths, and temporary synthetic ADB/VPN/log events. It does **not** launch a packaged Electron executable or actually connect a phone.
- Validation on the review checkout: `npm ci` succeeded without dependency upgrades; lint returned **0 errors** (231 formatting/hook warnings in the initial run); typecheck passed; **52/52 Vitest cases passed**; `npm run build` passed, including a repeat after the narrow-layout fix.
- **17/17 interactive browser QA scenarios passed** after the narrow-layout fix. Browser result JSON and screenshots were produced locally with only fake device data.

## Interactive scenarios (17/17 passed)

| Scenario | Result |
| --- | --- |
| Returning user opens dashboard and a real diagnostics API scan starts once | PASS |
| Diagnostics stays visible during scan and auto-collapses after approximately 2.6 s following result | PASS |
| Manually expanded diagnostics remains open after timer elapses | PASS |
| Rerun invokes a fresh scan and reveals the panel | PASS |
| Copy action returns a report with masked device identifier | PASS |
| No document-level horizontal overflow at 600, 800, 1008 and 1280 px; Engine text stays readable at 600 px | PASS |
| Two simulated devices, including unauthorized/long-name entry, have visible actions at 600 px | PASS |
| Empty simulated device list renders correctly, then restores | PASS |
| 30 incoming synthetic log lines do not scroll the dashboard page | PASS |
| Clear Logs becomes enabled with logs and disabled again after clearing | PASS |
| Settings shows the real time of an actual simulated successful update check (with seconds) | PASS |
| First-run onboarding immediately applies Dark → Light → Dark | PASS |
| Failed diagnostic rerun clears previous success, shows error, and remains expanded | PASS |
| A subsequent successful rerun clears the failure and collapses after the reveal | PASS |
| Failed copy attempt shows visible localized error feedback | PASS |
| Ready banner can be dismissed within the dashboard session | PASS |
| Update check timestamp persists when navigating away and back | PASS |

## Visual review (synthetic data only)

- [Dashboard at 1008×650, diagnostics collapsed](screenshots/dashboard-collapsed-mock-1008.png): compact diagnostic summary, device card and log all visible.
- [Narrow 600×650, two simulated devices](screenshots/multi-device-mock-600.png): responsive Engine header, no clipped action controls, unauthorized state.
- [First-run onboarding, Dark, 800×600](screenshots/onboarding-dark-mock-800.png).
- [First-run onboarding, Light, 800×600](screenshots/onboarding-light-mock-800.png).

Screenshots show fabricated ID strings, device model names and counters, not actual user devices.

## Re-run without adding or upgrading repo dependencies

The browser harness is **optional**; Puppeteer/Chromium are deliberately not added to `package.json` or `package-lock.json`. From the repository root on Windows:

1. Run `npm ci` and `npm run build`.
2. Start a localhost-only static server for `out/renderer`, e.g. `python -m http.server 8765 --bind 127.0.0.1 --directory out/renderer`.
3. In another terminal, make Puppeteer available in Node's resolution path or point `PUPPETEER_MODULE` to an existing Puppeteer installation. Set `CHROMIUM_EXECUTABLE` if Puppeteer's bundled Chrome is not present.
4. Run `node scripts/qa/renderer-mock-qa.cjs`.

Environment overrides: `WIREBOUND_QA_BASE_URL` for the static renderer URL and `WIREBOUND_QA_OUTPUT_DIR` for the generated screenshot/results directory (default under the operating system's temporary directory). A nonzero exit code means at least one scenario failed.

## Remaining release / platform gates

- **Unverified in this run:** packaged Electron cold launches and intermittent blank renderer issue [#44](https://github.com/man612/wirebound/issues/44).
- **Unverified in this run:** one physical Android phone's real USB authorization, Gnirehtet connect → disconnect → retry → stop, VPN approval and genuine TUN RX/TX under these newest UI changes. Previous hardware validation is documented in [#38](https://github.com/man612/wirebound/issues/38), but should not be misrepresented as a physical test of this exact UX commit.
- No dependency modernization, package version increase, tagging, installer publishing or merge is included in this QA task.
- Hosted GitHub Actions minutes can be exhausted independently of code correctness; locally recorded tests remain useful but do not turn missing hardware/installed-app QA into a pass.

**Decision:** PR #50 may proceed to review with credible unit/build/browser evidence. Keep release claims and actual-device validation separate until they are explicitly performed.
