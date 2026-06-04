# Security Policy

Wirebound is a desktop utility that manages Android reverse tethering through Gnirehtet and ADB.

## Reporting security issues

If you find a security issue, please open a GitHub issue with a clear description, or contact the maintainer through the GitHub profile.

Please do not include sensitive personal data, private network credentials, or device-specific secrets in public issues.

## Scope

Security-related reports may include:

- Unsafe handling of bundled binaries
- Unexpected command execution
- Insecure logging of sensitive information
- ADB-related behavior that could confuse users
- Misleading permission prompts or unclear setup instructions

## Notes for users

Wirebound requires Android USB Debugging and a VPN permission prompt on the Android device because it relies on Gnirehtet's reverse tethering workflow.

Only use this tool on devices you own or are authorized to manage.
