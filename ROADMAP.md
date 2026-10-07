# Wirebound Roadmap

Wirebound is a Windows desktop utility that makes Android reverse tethering through Gnirehtet easier to operate and troubleshoot.

## Product principle

Prefer observable, truthful state over simulated data or optimistic status labels. If Wirebound cannot verify something, the UI should say so instead of guessing.

## Completed in the v1.2 development line

### First-run and troubleshooting

- guided first-run flow for USB connection, USB debugging, ADB authorization, and preflight readiness
- live diagnostics for bundled runtime, ADB response, device access, Android version, and Gnirehtet client state
- beginner-facing ADB/VPN troubleshooting guidance
- privacy-safe support-report export with masked device identifiers

### Connection state and multi-device behavior

- separate ADB readiness from actual Gnirehtet tethering state
- per-device idle, waiting, connected, error, and unavailable states
- honest partial-success reporting when several Android devices are attached
- serial-targeted Retry/Connect and Disconnect controls without stopping other active devices
- Speed Test is enabled only for devices whose Gnirehtet VPN client is verified active

### Real traffic counters

- real Android TUN-interface RX/TX byte counters through ADB
- no simulated or estimated traffic values
- graceful unavailable state when an Android ROM does not expose readable TUN counters

### Windows desktop behavior

- notification-area system tray
- closing/minimizing the window keeps an active tethering session running
- tray actions for Show, Disconnect Tethering, and Quit
- separate **Launch Wirebound at Windows login** and **Auto-Start Tethering** settings
- clean Gnirehtet/client shutdown on explicit Quit

### Distribution and release quality

- manual GitHub Release update checker
- Windows release workflow prepared for Authenticode signing through protected GitHub Actions secrets
- release-time Authenticode verification when signing credentials are configured
- checksum-verified pinned Android Platform-Tools and Gnirehtet runtimes
- release checksums and GitHub artifact attestation
- Windows-native CI with lint, typecheck, unit/scenario tests, application build, and package smoke test

### Test coverage

- deterministic ADB scenarios for no access, unauthorized/authorized devices, details, and explicit ADB errors
- deterministic Gnirehtet lifecycle scenarios for connecting, active Android client, stop cleanup, and unexpected relay failure
- targeted multi-device command validation
- traffic-counter parser coverage
- adaptive-polling policy coverage

### Maintenance and upstream risk

- Dependabot for npm and GitHub Actions
- weekly upstream watch for Android Platform-Tools and Gnirehtet releases
- documented Gnirehtet maintenance risk and replacement strategy
- pinned runtime versions and SHA-256 verification remain mandatory

### Packaging/runtime efficiency

- only supported Electron locales are packaged
- CI verifies the packaged locale set and records the Windows package footprint
- adaptive ADB polling backs off while Wirebound is disconnected or idle in the tray
- connected/connecting sessions retain responsive polling
- a Tauri/native rewrite is not planned unless measurements show that its benefit justifies the rewrite and maintenance cost

### Privacy/crash reporting foundation

- Electron Crashpad can retain local crash dumps with remote upload disabled by default
- remote crash upload requires both a configured HTTPS collector endpoint and explicit user opt-in
- no general usage analytics or behavioral tracking
- privacy behavior is documented in `docs/PRIVACY.md`

## External release prerequisites

These cannot be completed by source-code changes alone:

### Windows Authenticode certificate

The release pipeline is ready for `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD`, but an actual certificate/private key must be obtained and configured by the publisher. Until then, release artifacts remain unsigned at the Windows Authenticode layer.

### Optional remote crash collector

Crash upload remains unavailable unless the maintainer configures a compatible HTTPS Crashpad/Breakpad collector through `WIREBOUND_CRASH_REPORT_URL`. Local crash capture and the consent gate work without it.

## Intentionally deferred

### Portable build

Deferred for now. The installed NSIS build remains the supported distribution format.

### Compatibility/tested-device matrix

A formal public matrix of Windows versions, Android releases, and OEM devices is deferred for now. Wirebound should not claim combinations as verified until they have actually been tested.

## Platform scope

Wirebound is Windows-only today. macOS/Linux targets should not be advertised until their runtime paths, dependencies, packaging, and behavior are implemented and tested.

## Next development decision

After v1.2 behavior is validated on real hardware, prioritize fixes driven by reproducible failures rather than adding speculative features. In particular, monitor Android/VPN compatibility because Gnirehtet 2.5.1 is stable but upstream is not actively maintained.
