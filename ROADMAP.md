# Wirebound Roadmap

Wirebound is a small Windows desktop utility that makes Android reverse tethering through Gnirehtet easier to operate and troubleshoot.

## Current focus

The current codebase prioritizes correctness and honest status reporting before adding more features.

Already implemented in the current development line:

- non-overlapping ADB polling
- explicit ADB error reporting instead of treating failures as an empty device list
- cached device metadata to reduce repeated ADB subprocesses
- connection state based on both the desktop relay and Android Gnirehtet client
- graceful relay/client cleanup on stop and application shutdown
- pinned, checksum-verified Gnirehtet and Platform Tools runtimes
- sandboxed Electron renderer and stricter IPC/external-navigation boundaries
- Windows-native CI with unit tests and package smoke testing
- removal of simulated traffic telemetry

## Next priorities

### 1. Real-world compatibility testing

Test more combinations of Windows versions, USB drivers, Android releases, OEM firmware, multiple devices, disconnect/reconnect scenarios, and VPN-permission behavior.

### 2. Better diagnostics

Improve user-facing explanations for driver failures, missing runtime files, ADB server problems, VPN permission rejection, relay exits, and partial multi-device failures.

### 3. Measured traffic telemetry

A traffic monitor should return only if Wirebound has a reliable source of real RX/TX counters with documented units and failure behavior. Animated or simulated throughput is intentionally not part of the product.

### 4. Release quality

Keep release artifacts reproducible, attach checksums, verify packaged runtime contents, and improve smoke testing around launch/start/stop behavior.

### 5. Packaging size

Electron is still acceptable for the current product. Size and startup improvements should be measured before considering a framework rewrite. A Tauri/native migration is only worth revisiting after behavior is well covered by tests.

### 6. Documentation

Expand first-run help for USB debugging, ADB authorization, Windows drivers, VPN permission, and common failure states.

## Platform scope

Wirebound is Windows-only today. macOS/Linux targets should not be advertised until their runtime paths, dependencies, packaging, and behavior are actually implemented and tested.

## Maintainer principle

Prefer a small feature set that reports its state truthfully over a larger interface that guesses, simulates, or hides failure modes.