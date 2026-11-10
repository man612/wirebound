# CI and local Windows verification

CI checks and local checks establish source/build quality. Neither proves end-to-end internet access on a real Android device. For release hardware gates, see [v1.2 release readiness](V1_2_RELEASE_READINESS.md).

## Understand a failing GitHub Actions run

Open the exact [workflow run](https://github.com/man612/wirebound/actions) and read the first failing step and its logs. Distinguish:

- **Job executed, step failed:** troubleshoot the command and its output. This is not evidence of an Actions quota problem.
- **Job rejected or never started:** inspect GitHub's stated reason (billing, permissions, configuration, or another platform restriction).
- **Old incident:** do not reuse historical October 2026 billing assumptions or outdated run statuses as a diagnosis of a new failure.

This is a public repository. Ordinary GitHub-hosted runners for public projects have different billing rules from private repositories or larger runners. Refer to [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) rather than guessing from the account's subscription.

## Local fallback on Windows

Use a clean checkout; do not overwrite the installed Wirebound profile or modify active USB/VPN sessions. Requirements: Windows, Node.js 24+, npm, PowerShell 7, Git, and internet access when downloading pinned runtime archives.

From the repository root:

```powershell
pwsh -NoProfile -File scripts/verify-local.ps1 -IncludePackage
```

The script installs from the lockfile, checks runtime-watch parsing, prepares checksum-verified runtimes, and runs lint, typecheck, tests, build, and unpacked packaging. Omit `-IncludePackage` for the lighter pass. Only use `-SkipInstall` if the checkout already has dependencies installed for its current lockfile.

For focused checks:

```powershell
npm run lint -- --no-cache
npm run typecheck
npm test
npm run build
```

For a complete validation record, include the tested commit, OS, commands, exit codes, test counts, build/package result, and explicitly untested physical behaviors. Keep GitHub CI status separate from locally reproduced results.

## Security boundaries

- Do not register the maintainer's everyday PC as a persistent self-hosted runner for a public repository. Untrusted pull requests can execute code on such a runner.
- Do not publish raw device serials, private ADB logs, credentials, profiles, crash dumps, or local filesystem paths containing personal information.
- Do not blindly upgrade dependencies or use forced peer-dependency overrides to make a check green.
- A Windows package build is not equivalent to an installed app smoke test, signed installer verification, or physical USB/VPN validation.

See [GitHub Actions security guidance](https://docs.github.com/en/actions/reference/security/secure-use).
