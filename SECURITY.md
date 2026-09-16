# Security Policy

Wirebound is a Windows desktop utility that manages Android reverse tethering through Gnirehtet and ADB. It can launch bundled executables and issue ADB commands to authorized Android devices, so reports involving those trust boundaries are taken seriously.

## Reporting a vulnerability

Please prefer GitHub's **private vulnerability reporting** for this repository when that option is available. If it is not available, contact the maintainer through the GitHub profile before publishing exploit details.

Do not post credentials, private network data, device identifiers, or working exploit details in a public issue.

For non-sensitive bugs that do not create a security risk, a normal GitHub issue is appropriate.

## In scope

Examples include:

- IPC or renderer behavior that can trigger unintended privileged actions
- unexpected command or executable execution
- unsafe handling or substitution of bundled runtime files
- navigation or external-link behavior that escapes the intended allowlist
- sensitive information exposed in logs or settings
- ADB behavior that can affect devices beyond the user's explicit action
- misleading security or permission state shown by the application

## Runtime integrity

Wirebound release builds pin Gnirehtet and Android SDK Platform Tools versions. The runtime preparation script verifies SHA-256 before extraction; a checksum mismatch fails the build instead of silently accepting changed binaries.

## User responsibility

Wirebound requires Android USB debugging authorization and a VPN permission prompt because that is how Gnirehtet works. Only connect devices you own or are authorized to manage, and revoke USB-debugging authorization when a computer should no longer control a device.

Security fixes are applied to the actively developed branch. There is currently no promise of long-term security maintenance for older Wirebound releases.