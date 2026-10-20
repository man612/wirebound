# Wirebound v1.2 — Release readiness and tested-device evidence

Date: 2026-10-20. Release status: **candidate under validation, NOT yet released**. Latest downloadable release: v1.1.1. Repository issue: https://github.com/man612/wirebound/issues/38

## Physical test scope

The maintainer owns **one Android device**. They explicitly waived a simultaneous two-device physical test for v1.2 on 2026-10-20. Keep automated multi-device test coverage, but **do not claim two-device hardware compatibility has been demonstrated** and do not block this release only because a second phone is unavailable.

Observed test hardware:
- Host: Windows 11 Pro, build 26100
- Phone: Motorola moto g45 5G, Android 15 / API 35
- Bundled tools: Android Platform Tools 37.0.1, Gnirehtet 2.5.1
- Device serial and other unique identifiers must not appear in reports

## Verified through actual Wirebound Electron UI and ADB

- The authorized USB device appears with correct model and Android version.
- Starting the engine via **Mulai Koneksi** activates Windows relay and Gnirehtet VPN. Android reports a connected/validated VPN, with observable TCP/UDP relay activity.
- Connected UI displays genuine **cumulative TUN RX/TX byte totals**, including an observation of approximately RX 32.7 KB / TX 22.0 KB. These are **not bitrate / transfer-speed measurements**.
- Per-device **Putuskan** stops that VPN; the main dashboard changes to waiting, not falsely connected. This exposed and validated the status fix in #41.
- The Gnirehtet-owned reverse mapping is specifically removed and no unrelated test mapping is deleted (#43).
- **Coba Lagi** reconnects successfully. **Hentikan Koneksi** then terminates relay/VPN and clears Gnirehtet ADB reverse mapping.
- Close-to-tray behavior: after window close, Electron main process remains running with the window hidden. This does **not** mean it was Quit.
- All post-test relay processes, VPN and ADB reverse mappings were verified absent.

## Packaged Windows application

- Windows Electron packaged **unpacked executable** was built locally with electron-builder v26.15.3. This is NOT a signed installer.
- The packaged wirebound.exe launched on an isolated QA user-data directory and showed the **Step 1/3 first-run onboarding**, language/theme controls, Electron IPC bridge and correct app version. This is stronger evidence than a project-directory Electron preview.
- An earlier project preview intermittently displayed a blank renderer. A successful packaged launch does not prove the issue is resolved on every cold start. See https://github.com/man612/wirebound/issues/44 .
- **NSIS installer test passed:** generated a 103.4 MiB one-click installer, installed silently into an isolated QA directory (exit code 0), launched the actual installed executable, verified first-run onboarding Step 1/3 and IPC, then uninstalled silently (exit code 0). The executable and uninstaller were removed. This test build is not a published v1.2 release.
- Repeated cold starts on different user accounts and genuine tray-context-menu Quit remain unverified.

## CI and security

- Branch/main CI has passed lint, typecheck, **46 automated tests**, renderer/main build, unpacked package smoke test and locale checks at commit 6de294e: https://github.com/man612/wirebound/actions/runs/39390955732 .
- npm audit of complete lockfile: **8 moderate, 0 high, 0 critical**; npm audit production subset: **0**. Residual chain involves electron-builder and transitive build tooling, not a proof that all distributed binaries are risk-free. See #39.
- Do not run npm audit fix --force merely to silence a build-tool advisory; check compatible upstream releases and breaking changes first.
- Standard public-repository GitHub-hosted Windows CI still runs successfully. Account-reported exhaustion of monthly included usage must not be mistaken for log-proven source errors.
- Authenticode publisher signing needs external certificate/secrets; without that, distributed installers are unsigned. Repository release workflow provides SHA-256 checksum and artifact attestation.

## Release gates that still need decisions

- [ ] Genuine **tray menu Quit** (not window close) terminates active relay and removes device VPN and ADB mapping
- [x] NSIS silent install/uninstall in isolated Windows QA directory, plus installed-executable onboarding and IPC smoke check (2026-10-20)
- [ ] More cold starts of the packaged/installed executable; investigate #44 only if reproducible
- [ ] USB disconnection/reconnection and revoked or unauthorized access behavior on the single available handset
- [ ] Browser/network check with Wi-Fi/mobile-data isolated where safe and practical
- [ ] Review changes in README, release notes, installer checksum/signing policy
- [x] Prepare v1.2.0 versions in package.json and package-lock.json on release preparation branch; no v1.2.0 Git tag or public release created
- [ ] Verify final versioned Windows installer, checksum and release notes before creating v1.2.0 tag
- [ ] Physical simultaneous two-phone test — **WAIVED, not a blocker; no compatibility claim**

## Sources for lifecycle and installer semantics

- https://www.electronjs.org/docs/latest/tutorial/tray
- https://www.electronjs.org/docs/latest/api/browser-window
- https://www.electronjs.org/docs/latest/api/app
- https://www.electron.build/v26/docs/win/
- https://www.electron.build/docs/nsis/

Keep the release candidate scoped to verified behavior. Hardware results on one phone never imply support for every Android OEM/ROM.
