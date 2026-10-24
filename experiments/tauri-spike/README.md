# Wirebound Tauri 2 experiment — UI-only, isolated

**Status:** source-level prototype; NOT a Wirebound migration, production build, or measured performance improvement.

This experiment uses **the existing React dashboard and styles from the main repository**, wrapped in Tauri 2 on Windows. The shared UI is rendered via an isolated in-memory implementation of its existing window.api interface; it is deliberately **not capable of connecting Android devices**.

## Scope and safety

- All changes are contained in experiments/tauri-spike on an independent branch. The production Electron app, package.json/lockfile, installer, ADB cache, settings, GitHub releases, PR #50 and PR #51 are unchanged.
- The app identifier is com.wirebound.taurilab (NOT the production ID).
- Startup does NOT execute or contact ADB, Gnirehtet, telemetry, update servers, or persisted Wirebound settings. Actions that could affect real devices are explicitly disabled.
- The overlay says "TAURI LAB · DEMO ONLY". It uses default in-memory settings and forces autoStart/launchAtLogin/telemetry off.
- The Rust backend only exposes runtime_probe and window_action (minimize/maximize/close). There is no process spawning or network access.
- The app uses the EXISTING UI, but NOT the real Electron backend: performance comparisons can estimate shell/UI overhead only, NOT full feature parity or networking overhead. No release decision should be based on this spike alone.

## Requirements

On Windows, Tauri 2 needs:
1. Rust with the MSVC target.
2. Microsoft C++ Build Tools / Windows SDK (Desktop development with C++).
3. WebView2, normally already included on Windows 11.
4. Node.js + npm.

The current Windows QA machine has Node/npm but no Rust/MSVC compiler. **Do not silently install large system-wide toolchains to run this experiment.** Use a prepared test machine or get explicit approval for system modifications.

## Build and run

Run in the repository root's experiments/tauri-spike directory:

    npm install
    npm run dev

This opens the Tauri demo with the existing Wirebound UI. For a packaged Windows build:

    npm run build

The installer is configured as an independent NSIS bundle named "Wirebound Tauri Lab". It must NEVER overwrite the Wirebound Electron installation. No installer is published from this branch. Generated files are ignored by Git.

The package currently has no committed npm/Cargo lock files; generate and commit both lock files once a working toolchain has validated them. Until then this is an unvalidated reproducibility limitation. Do not claim a successful native build without evidence.

## How to collect evidence

1. Build the **release** Tauri executable on Windows with the required toolchain.
2. Ensure no instance of the lab app is running.
3. Execute measure-tauri.ps1 against the built executable. It uses a visible native window and records elapsed time, main-process memory and a best-effort descendant-process sum.
4. Repeat for an idle Windows session, then while the same background applications are open.
5. For Electron, **reuse the corrected issue #44 packaged-app QA harness with VERIFIED isolated userData**. Do not run ordinary installed Wirebound with its real profile for comparisons. Keep trace/no-trace configurations and the exact benchmark window consistent.
6. Capture CPU / disk activity, storage type, Windows Defender activity, raw results and any timeouts. Include WebView2 helper processes in memory comparisons; a single Tauri process measurement is misleading.
7. Do not compare installer size unless BOTH applications include equivalent features and required runtime binaries (ADB, Gnirehtet and their dependencies). Tauri Lab excludes these intentionally.

### Acceptance before considering migration

- Actual native Tauri release executable builds and displays the SAME UI.
- At least 10 non-traced starts per condition on the same PC, with raw measurements retained.
- Profile isolation verified for both apps; no production data touched.
- No long-tail startup regressions, blank windows or orphaned processes.
- Resource comparisons include subprocesses and both private/working-set memory.
- Real ADB/Gnirehtet process lifecycle, tray and quit cleanup, settings, diagnostics, signed/unsigned installer behavior and security checks would require **separate feature-parity implementation and tests**.

No benchmark numbers have been collected by creating these source files.

### References

- https://v2.tauri.app/start/prerequisites/
- https://v2.tauri.app/start/frontend/
- https://v2.tauri.app/reference/config/
- https://v2.tauri.app/develop/sidecar/
- https://github.com/man612/wirebound/issues/44
