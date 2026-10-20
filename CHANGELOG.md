# Changelog

All notable Wirebound changes for the Windows application are documented here. Releases are tagged in GitHub; the version in this source tree is not, by itself, proof that a release has been published.

## [1.2.0] — Release candidate, not yet published (2026-10-20)

### Added
- Guided first-run flow and clearer USB debugging, ADB authorization, device troubleshooting, and diagnostics.
- More honest per-device ADB/VPN states, individually targeted connect, retry, and disconnect actions, and automated multi-device scenario coverage.
- Actual cumulative Android TUN-interface RX/TX byte counters (not a bandwidth or internet speed measurement).
- Windows notification-area tray with close-to-tray behavior and separate launch-at-login versus auto-start tethering settings.
- Privacy-safe support reports masking device identifiers; local crash capture, with optional remote upload requiring explicit opt-in and an independently configured HTTPS collector.
- Manual GitHub release update checks; checksummed runtime preparation; Windows release workflow with checksums and GitHub attestation. Authenticode signing remains optional and requires a publisher certificate.

### Fixed
- False 'connected' state caused by using the existence of the Gnirehtet Android process instead of a verified active VPN network.
- Stale Gnirehtet-owned ADB reverse forwarding after device disconnect or full engine shutdown, without deleting unrelated reverse mappings.
- Weekly runtime-upstream watch PowerShell version parsing; added regression coverage and a local Windows CI fallback.
- High-severity npm transitive development-tool advisories through compatible lockfile refresh (eight moderate build-tool findings remain under review).

### Verified
- On Windows 11 Pro build 26100 with **Motorola moto g45 5G (Android 15)**: connect, measured TUN counters, single-device disconnect, reconnect, stop, VPN state accuracy, and owned ADB reverse cleanup.
- While a real VPN/relay session was active, Electron main-process `app.quit()` followed the real shutdown handler; afterwards no Windows Wirebound or Gnirehtet processes, Android VPN, TUN interface, or Gnirehtet ADB reverse mapping remained.
- Windows NSIS installer built, installed to an isolated QA directory, opened actual installed onboarding through Electron IPC, and silently uninstalled with no installed executable remaining.
- Hosted Windows CI: **46 automated tests** plus lint, typecheck, production build, unpacked package and locale smoke checks.

### Known limits
- **Only one physical Android device has been tested.** Simultaneous two-device hardware validation was waived by the maintainer; its automated tests do not prove real two-device compatibility.
- The native Windows tray **Keluar/Quit menu click** has not been independently clicked during a controlled active-VPN run. The underlying `app.quit()` shutdown path was tested and cleaned up successfully.
- Do not infer independently verified internet throughput from cumulative TUN byte counters. Android USB drivers/OEM ROMs and VPN permission flows can behave differently.
- Packaged/installed Electron cold starts passed, but an intermittent blank renderer seen during local project-directory preview remains under investigation (#44).
- Windows Authenticode signing is not configured; local QA installer was **unsigned**. Windows may warn users about an unknown publisher. Checksums and release attestations do not replace publisher signing.
- Optional remote crash collector is not configured; local capture only unless a compatible HTTPS endpoint is supplied and the user opts in.
- Remaining eight moderate npm audit findings belong to the build/tooling chain (#39). The npm production-dependency audit reported zero findings; this does not certify bundled binary security.

For release gates and evidence see [v1.2 readiness](docs/V1_2_RELEASE_READINESS.md) and [issue #38](https://github.com/man612/wirebound/issues/38). Do **not** create the `v1.2.0` Git tag or publish the public release without verifying the final versioned installer and agreeing on the remaining stated limitations.

## [1.1.1] — 2026-09-16

Previous public Windows release. See the [GitHub release](https://github.com/man612/wirebound/releases/tag/v1.1.1) for its published assets and notes.
