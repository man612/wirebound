# Wirebound contributor and coding-agent guide

Wirebound is a **Windows-only** Electron/React desktop interface for Gnirehtet and ADB. Prefer small, verified fixes over speculative rewrites. The source of truth is the actual code, the current GitHub issue/PR state, and observed test results—not dated chat summaries or historical QA plans.

## Before editing

- Inspect the target branch, `git status`, and related open issues/PRs. The `main` branch is not automatically equivalent to an unmerged feature branch or a released installer.
- Read `README.md`, `docs/V1_2_RELEASE_READINESS.md`, and the relevant tests. Hardware observations and synthetic tests are different kinds of evidence.
- Do not change pinned ADB/Gnirehtet binaries, runtime checksums, dependency versions, or supported platform as incidental cleanup.
- Preserve existing user settings, local profiles, and any active Android VPN/USB session. Use an isolated QA profile and build; do not replace the normal installed app during testing.

## Runtime invariants

- Never kill the shared ADB server or remove reverse mappings owned by other apps. Clean up only Wirebound's Gnirehtet resources, with the appropriate device target.
- Do not infer Android VPN connectivity from a lingering process alone. Distinguish ADB authorization, relay state, VPN state, and independently tested internet access.
- RX/TX values must come from observed Android TUN counters. Never fabricate traffic or claim they represent transfer speed.
- Limit sensitive identifiers in logs and support reports. Do not upload real serials or personal logs to public issues or screenshots.
- When changing the Gnirehtet lifecycle, inspect the target branch for existing Start/Stop race safeguards and preserve them. Validate cancellation, late child exits, and per-device isolation; issue #53 fixes may still be in an unmerged PR.

## Verification and delivery

- For a code change, run relevant tests and, where feasible, `npm run lint -- --no-cache`, `npm run typecheck`, `npm test`, and `npm run build`. Windows package changes also need a package smoke test.
- Real USB/VPN/network and tray/quit behavior require **physical QA**; green CI or mocked renderer interactions cannot prove them. The project currently validates with one real phone; a simultaneous two-phone hardware test is not a v1.2 release gate.
- Record exactly what ran, on which branch/commit, what failed, and what remains unverified. Do not mark a Draft PR or an issue complete solely because code exists.
- For GitHub Actions troubleshooting and the local Windows fallback, see `docs/CI_LOCAL_VALIDATION.md`. A failed workflow must be diagnosed from its actual step logs, not presumed to be a quota issue.
- For active release blockers, see [issue #38](https://github.com/man612/wirebound/issues/38); for startup investigation, [issue #44](https://github.com/man612/wirebound/issues/44). Consult the live PR list for other ongoing work.
