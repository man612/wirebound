# Wirebound roadmap

Wirebound is a Windows-only utility for sharing a PC's internet connection with Android over USB using Gnirehtet. The priority is **reliable connection control and understandable, verifiable status**, not a growing feature list.

The [README](README.md) describes what the app does. [Release readiness](docs/V1_2_RELEASE_READINESS.md), [open issues](https://github.com/man612/wirebound/issues), and [pull requests](https://github.com/man612/wirebound/pulls) are the source of truth for current progress. Work committed on a draft branch is not necessarily in `main` or the published installer.

## Before the v1.2 release

- Complete integrated UI, Gnirehtet lifecycle, and privacy validation, including per-device Connect/Disconnect and honest diagnostic progress (see [PR #67](https://github.com/man612/wirebound/pull/67)).
- Investigate intermittent Electron startup delays and blank-window reports without treating tracing or a successful single launch as proof of a fix ([issue #44](https://github.com/man612/wirebound/issues/44)).
- Complete release checks for Windows packaging, real Android VPN/internet traffic, tray Quit cleanup, and installer integrity ([issue #38](https://github.com/man612/wirebound/issues/38)).
- Keep ADB interactions scoped to explicitly authorized devices. Never disrupt the shared ADB server or another application's reverse mappings.

The project has been tested with one real Android phone; two-phone simultaneous physical testing is **not** a v1.2 release blocker. Multi-device behavior still requires automated regression coverage. Signing a public installer requires publisher credentials outside this repository.

## After stability is established

- Consider a portable Windows distribution ([issue #6](https://github.com/man612/wirebound/issues/6)) if installation-free use provides enough value to justify extra QA.
- Expand tested Windows/Android device coverage based on real reports, not unverified compatibility claims.
- Revisit dependency updates and upstream Gnirehtet maintenance risk in controlled, separately tested changes. See [runtime policy](docs/UPSTREAM_RUNTIME_RISK.md) and [dependency audit](docs/DEPENDENCY_AUDIT_2026-10-20.md).
- Reassess Electron alternatives only if repeatable measurements on representative hardware justify the migration cost. A Tauri/native rewrite is not currently a release prerequisite.

## Non-negotiable product principles

Report observed state rather than invented success. A running relay is not necessarily an active Android VPN, and an active VPN is not proof of internet access. RX/TX counters are cumulative measured bytes, not speed estimates. Protect device identifiers in exported reports, and preserve user configuration and unrelated ADB clients.
