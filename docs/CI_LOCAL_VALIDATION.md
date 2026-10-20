# CI availability and local Windows verification

> Maintainer note (2026-10-20): The maintainer reported exhausting the account's monthly free GitHub Actions usage, with a reset expected in early November 2026. Treat this as **account-reported and time-bound**, not as a verified root cause of every failed Wirebound workflow. Confirm current usage and any block in GitHub billing/settings before assuming a quota problem.

## Public repository billing distinction

Wirebound is a **public** repository. Standard GitHub-hosted runners (including the project's windows-latest) are free for public repositories and do not consume the monthly included minutes used for private-repository Actions workloads. Larger runners and other metered resources have different billing rules. Account spending or usage limits can still affect other repositories and services.

Official references:
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax

**Do not label a failed workflow "quota exceeded" unless GitHub explicitly reports a usage/billing block.** A workflow that starts running a step and exits nonzero is an execution/test problem, even if other account limits have been reached.

## Known failures as of 2026-10-20

| Area | Evidence | Interpretation |
| --- | --- | --- |
| Weekly Runtime Upstream Watch, Oct 12 and Oct 19 | https://github.com/man612/wirebound/actions/runs/38228594701 and https://github.com/man612/wirebound/actions/runs/39218327348 | PowerShell regex failed to parse pinned runtime versions before any upstream comparison. This is a script defect, not proof of a quota block. |
| Dependabot Vite 8, TypeScript 7, plugin-react 6, ESLint 10 | GitHub PRs #31, #30, #28, #27 | Dependency compatibility errors in install/lint logs. Do not force peer dependencies or assume the public base app is broken. |
| Main branch CI, Oct 7 | https://github.com/man612/wirebound/actions/runs/37588135922 | Last observed main CI completed successfully. This does not replace real-hardware checks or guarantee a later run. |

## Local fallback (Windows)

Work from a **fresh clone or clean branch** to avoid clobbering uncommitted changes. Require Windows, Node.js 24+, npm, PowerShell 7, Git, and internet access for pinned runtime archives.

From the repository root, run:

    pwsh -NoProfile -File scripts/verify-local.ps1 -IncludePackage

This runs npm ci, the runtime-watch parser regression test, pinned runtime preparation, lint, typecheck, unit/scenario tests, production build, and Windows unpacked package smoke test. The local script intentionally limits Vitest to one worker because some Windows PCs time out while spawning multiple test workers; hosted CI keeps its normal parallel configuration. Omit -IncludePackage for the faster pre-commit pass. -SkipInstall avoids repeating npm ci only when dependencies have already been installed from the current lockfile.

A local successful run is **local evidence**, not a green GitHub check; report the branch/commit, platform, commands, result, and date in the PR. Do not silently bypass protected branch requirements.

## How to diagnose unavailable Actions

1. Check repository **Actions** and the exact run summary: was the job rejected/queued by GitHub for billing, or did a step actually execute and fail?
2. If the job executed, inspect the *first failing step* and job logs. Fix that error. Do not wait for the monthly billing reset.
3. If GitHub explicitly reports a billing restriction, inspect the account/organization's billing usage and budget. Do not expose tokens or billing details in a public issue.
4. Use the local Windows fallback while hosted checks are unavailable. Resume hosted validation when available.

## Security boundary

Do **not** register the maintainer's everyday Windows workstation as a permanent self-hosted runner for this public repository. Pull requests from forks can potentially execute untrusted code on that machine. Manual local validation or an isolated disposable Windows VM is safer.

Source: https://docs.github.com/en/actions/reference/security/secure-use

## Release boundary

CI and local smoke tests cannot prove an Android device has real internet connectivity. Before tagging a v1.2 release, verify first-run onboarding, USB authorization, VPN prompt, connection/reconnection, multi-device isolation, tray/quit cleanup, and real RX/TX counters on hardware. Record tested Windows and Android versions and only claim combinations actually tested.
