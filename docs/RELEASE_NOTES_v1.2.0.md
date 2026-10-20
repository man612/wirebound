# Wirebound v1.2.0 — Draft release notes

> DRAFT. These notes are for final review; v1.2.0 is not yet a public release. A signed publisher identity is **not** available by default.

Wirebound v1.2 improves the reliability and transparency of sharing a Windows PC's internet connection with an Android phone over USB, using the included Gnirehtet relay. It adds a guided first-run experience, more informative ADB/VPN diagnostics, per-device connection controls, real cumulative Android VPN traffic counts, and Windows tray behavior.

## What's new

- Easier setup: first-run guidance for USB debugging, ADB authorization, permissions, and common connection problems.
- More accurate status: distinguishes ADB readiness, a running PC relay, and an Android VPN that is genuinely connected. Stops claiming connected when only the Android app process remains alive.
- Control and recovery: connect, disconnect, and retry individual devices, and clean up Wirebound's own ADB reverse port forwarding without touching unrelated mappings.
- Real traffic totals: RX/TX bytes read from Android's VPN TUN interface when available. These are **totals, not live speed measurements**.
- Better desktop behavior: closing the window leaves an active session in the tray; choosing Quit exits and cleans up the engine. Launch at Windows login and auto-start tethering are separate preferences.
- Distribution and privacy: privacy-safe support diagnostics, verified bundled runtime checksums, GitHub release/update checking, local crash dumps by default, and release artifact verification.

## Tested configuration

Verified on Windows 11 Pro (build 26100) with one Motorola moto g45 5G running Android 15. Hardware checks included USB connection, app-started VPN, relay network traffic, real RX/TX counters, disconnect/reconnect, per-device ADB mapping cleanup, and application shutdown with an active VPN. NSIS installer QA install/open/uninstall also passed in an isolated Windows directory.

**Two simultaneous Android phones have not been hardware-tested.** The maintainer has one phone and waived the second-phone test for this release; automated multi-device tests are not a substitute for real two-phone validation. Other OEMs, Android builds, and USB driver combinations are not claimed verified.

## Before installing

- Windows PC with internet access, an Android device connected via a data-capable USB cable, USB debugging enabled, and ADB authorization accepted.
- Android will prompt for VPN permission when Gnirehtet starts. Granting it is necessary for the reverse tether.
- A dashboard 'Connected' state reflects an active relay plus Android VPN; verify internet access on your phone separately, for example with the included Speed Test shortcut.
- This Windows installer may be **unsigned** until a trusted Authenticode certificate is configured. Check GitHub release checksums and artifact attestation for the actual downloaded installer; do not ignore security warnings for an unexpected download source.
- The app is Windows-only. No portable Windows build, macOS or Linux version is advertised.

## Remaining limitations

Physical Windows tray-menu Quit selection, repeated packaged cold starts on multiple PCs, Android unplug/replug scenarios and Wi-Fi/cellular-isolated internet proof have not all received the same depth of hardware testing as the primary connection path. Remote crash reporting needs a separate compatible collector and explicit opt-in. Eight moderate npm advisory findings in the development packaging chain remain tracked.

Source and detailed release gate: https://github.com/man612/wirebound/issues/38 . Security audit: https://github.com/man612/wirebound/issues/39 .

Do not publish these draft notes unchanged until the final v1.2.0 installer is produced, SHA-256 is independently recorded, and release claims match the last verified checks.
