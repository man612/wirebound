# Upstream Runtime Risk

Wirebound deliberately bundles two external runtimes:

- Android SDK Platform-Tools for ADB.
- Genymobile Gnirehtet for reverse tethering.

Both are pinned in scripts/prepare-runtime.ps1 by version and SHA-256. A release build must never replace these files with an unverified latest download.

## Current baseline

- Android Platform-Tools: **37.0.1**
- Gnirehtet: **2.5.1**

The Android release notes currently list 37.0.1 as the latest stable Platform-Tools revision. Gnirehtet 2.5.1 remains its latest published release.

## Gnirehtet maintenance risk

Gnirehtet's own README says the project is not actively maintained and that only major blockers such as build issues are expected to be fixed.

That means Wirebound should treat Gnirehtet as a stable but aging engine, not as an actively evolving dependency.

Important consequences:

1. Wirebound must not promise Android-version compatibility merely because ADB sees a device.
2. New Android background or VPN restrictions may break the client before a new Gnirehtet release exists.
3. Open upstream modernization pull requests are useful research signals, but they are not trusted release artifacts.
4. Wirebound should keep the engine boundary small enough that a maintained fork or replacement can be introduced later without rewriting the whole UI.

## Current technical limitations inherited from upstream

- The stable engine relays IPv4 TCP and UDP traffic; production IPv6 support is not part of the current release.
- The first VPN start still requires Android user permission.
- Android permits one active VPN service per user/profile, so another VPN can interfere with Gnirehtet.
- Gnirehtet supports explicit serial-targeted start/stop commands as well as the broader autorun mode.

## Update policy

When Runtime Upstream Watch finds a newer runtime:

1. do not update the version alone;
2. read upstream release notes and relevant issues;
3. download the official Windows artifact;
4. calculate and pin the new SHA-256;
5. run lint, typecheck, unit/scenario tests, build, and package smoke test;
6. specifically verify ADB coexistence on port 5037 and Gnirehtet client cleanup;
7. only then merge the runtime bump.

## Replacement strategy

If Gnirehtet becomes incompatible with current Android versions, prefer this order:

1. patch the smallest reproducible blocker while keeping the existing protocol;
2. evaluate a well-maintained upstream fork;
3. vendor or fork the Android client and relay only when the maintenance burden is understood;
4. replace the engine behind Wirebound's service boundary rather than coupling the UI directly to a new protocol.

The UI should continue to describe observable states such as ADB ready, VPN waiting, and tunnel connected instead of depending on Gnirehtet-specific implementation details.
