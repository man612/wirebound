# PR #67 — owner UI/UX audit implementation, first pass (2026-10-30)

**Scope:** seven maintainer observations from the 2026-10-30 screenshot. This is an isolated new design iteration on top of the real PR #67 UX + lifecycle/privacy merge `29230c5`, not a merge to `main` or a regular installation update. More owner feedback is expected before release.

## Actual changes

1. **Motion:** shared control transitions (130 ms), entering content and interactions (190–240 ms); diagnostics use animated CSS grid collapse instead of the instantaneous `hidden` toggle. Respects system `prefers-reduced-motion`. No excessive glow, parallax or fake scanning.
2. **Diagnostic device details:** one compact row per device with masked ID, Android version/API, ADB state and native-client state, replacing the tall detail card. Real ADB serial remains masked. The runtime check tiles are kept because their individual result/detail matters.
3. **Android device roster:** responsive, compact rows with device name and secondary Android version/codename, ADB/tunnel status, battery, real RX/TX and per-device controls. Preserves per-device actual Start/Stop/Retry, Speed Test, and error feedback. No horizontal table or fake network counters.
4. **Terminal:** functional Log page and Dashboard preview, with errors-only filter, manual auto-follow pause/resume, jump to bottom, unread-line indicator, Copy/Export via existing trusted Electron support-report IPC, disabled empty actions and short success/failure feedback. Known active device IDs are masked before rendering/copying/exporting. Copy/export retain the existing IPC report limits and file dialog.
5. **Device identity:** primary marketing model/name remains readable; optional `ro.product.device` codename and `ro.build.version.release` are obtained via best-effort ADB. Never expose the raw ADB identifier in UI or copied logs. Device name/battery metadata is cached for 30 seconds as before.
6. **New navigation:** Dashboard, Devices, Diagnostics, Activity Logs, Speed Test, Updates, Settings, About, in purposeful grouped sections. Logs is functional. Other newly introduced routes are explicitly labeled nonfunctional placeholders so users are not tricked into thinking they work.
7. **Battery:** real Android `dumpsys battery` level and status (charging/full/discharging/unknown) determine visual state. UX thresholds are critical ≤15%, low 16–25%, other values normal/high, full at 100% or real Android full status; charging takes precedence over low percentages except full. Unknown values remain `--`. Colors are backed by labels/icons, not color alone.

## Validation

- Windows local TypeScript for renderer and main: **PASS**.
- Native Vitest suite with four new helper scenarios: **13 test files, 77/77 tests PASS**. Existing mocked ADB snapshot scenario adjusted for the newly returned fields.
- Real Electron Vite build: **PASS** (main + preload + renderer).
- Actual Windows QA executable: copied the unchanged and previously hardware-tested unpacked PR #67 Electron runtime into `F:\Wirebound-Lab\qa-packages\ux-audit-20261030`, unpacked original app.asar, replaced only compiled `out`, repacked its ASAR. It is a QA-only assembled package **not** a new NSIS installer or normal-user upgrade. Original Electron exe SHA256 `fa4da0bf6898251cb72848be3d0f56b34abf59eeded3df873dfdf443e18a73f8`, new QA ASAR SHA256 `71edd449c9ca9647058eb5d59b1f50e6da8fefb013838dcc5f27ccf06e608584`. Isolated userData/APPDATA/LOCALAPPDATA/TEMP on F:, autoStart false, telemetry off, CDP loopback port 19668.
- Packaged renderer via CDP: v1.2.0, engine disconnected, one authorized Motorola; all eight menu entries rendered, new Device row and battery (observed charging) and codename and Android version present, no unmasked device ID in visible page, no mojibake; Copy/Export Log buttons present; computed button transition 130 ms, diagnostics CSS expansion 240 ms; navigation to placeholder Devices, real Logs and Settings works; no page horizontal overflow or clipped real device row at CSS widths **1000, 800, 600, 480**. No Engine Start was triggered.
- QA screenshot saved only on the Windows PC: `F:\Wirebound-Lab\qa-tools\ux-audit-preview-20261030.png`.
- The QA executable is deliberately left open for the maintainer's hands-on review; don't interpret this as an unattended production deployment.

## Boundaries and follow-up

- Keep PR #67 Draft and `main` / everyday installation unchanged pending the owner's visual review and additional requests.
- New labels are inline bilingual placeholders. New Devices/Diagnostics/Speed/Updates/About page functionality is **not** implemented yet, by explicit owner permission; avoid claiming otherwise.
- This new ASAR/ADB metadata iteration has not yet repeated the physical HTTPS/TUN VPN integration acceptance; the prior PR #67 package passed physical hardware Start/Stop/Retry on 2026-10-30. Production lifecycle source stayed intact.
- Test with Windows native font scaling, keyboard navigation, low-battery real hardware, repeated log arrival/scrolling, and error cases before release. Two-phone physical testing stays waived.
- The `node_modules` directory in this QA checkout is a Windows junction to `D:\Projects\wirebound-ux-review-20261021\node_modules`. **Never recurse-delete it** or run `npm ci` through that junction. No dependencies were updated.

## Design research references

Microsoft Fluent 2 motion and navigation (functional, consistent, accessible), IBM Carbon structured lists and overflow tools, and W3C WCAG animation-reduction guidance informed this implementation. Cite these as UI patterns, not as proof of physical functional correctness.
