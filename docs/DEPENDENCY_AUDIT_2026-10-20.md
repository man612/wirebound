# npm dependency advisory triage — 2026-10-20

Scope: the Wirebound npm lockfile and build toolchain, audited on Windows with Node.js 24.

| npm audit command | Before safe lockfile refresh | After safe lockfile refresh |
| --- | ---: | ---: |
| npm audit (high) | 2 | 0 |
| npm audit (moderate) | 8 | 8 |
| npm audit --omit=dev (all severities) | 0 | 0 |

The lockfile was refreshed with `npm audit fix --package-lock-only --no-fund`. It adjusts transitive dependency resolutions without changing direct dependency declarations. This reduces the total advisory count from 10 to 8, without accepting an automatically proposed breaking electron-builder replacement.

Two high advisories removed by the lockfile refresh:
- `http-cache-semantics`: max-stale response caching flaw
- `source-map-js`: indexed source map offsets may trigger event-loop denial of service

The remaining eight moderate advisories relate to the electron-builder packaging/dependency chain, ultimately including `sprintf-js`, `roarr`, `global-agent`, and `@electron/get`. The npm-suggested `--force` change selects electron-builder 26.5.0, while the project's current declaration is `^26.15.3`; do not apply an untested downgrade or bypass peer compatibility to chase an audit count.

**Risk boundary:** npm `--omit=dev` returning zero does not certify built installers, the Electron binary, the USB relay, or Android platform tools. Dev/build tooling could still affect distributable artifact integrity. Follow up on the remaining build chain and version constraints in issue #39.

Validation requirement for this lockfile: run npm ci, lint, typecheck, tests, full renderer/main build, and Windows package smoke test in CI; only merge once confirmed passing. Review the resulting lockfile diff as dependency updates can adjust additional transitive packages.
