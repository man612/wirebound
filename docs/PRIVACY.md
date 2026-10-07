# Privacy

Wirebound is designed to work locally between a Windows PC and connected Android devices.

## Analytics

Wirebound does not include general usage analytics, advertising analytics, behavioral tracking, or user profiling.

## Crash reports

Electron Crashpad is initialized with uploads disabled.

This means a crash can create a local minidump in Electron's crash-dump directory, but Wirebound does not send that crash anywhere by default.

Remote crash upload has two independent requirements:

1. the distributed Wirebound build must be configured with an HTTPS crash-report endpoint; and
2. the user must explicitly enable crash reporting in Settings.

If either requirement is missing, crash uploads remain disabled.

When enabled, the payload is Electron's standard crash report. It can contain:

- Electron and Wirebound version information;
- operating-system/platform information;
- process type;
- a Crashpad-generated installation/report identifier;
- the crash minidump.

Wirebound does not add Android device serials, terminal logs, DNS settings, or exported support-report contents as crash-report annotations.

Crash upload is rate-limited to at most one uploaded report per hour by Electron Crashpad.

## Device identifiers

Wirebound needs ADB device serials locally to address a specific Android device. Those raw serials stay in local process memory and UI state.

Exported Wirebound support reports mask device identifiers before writing them to disk.

## Support reports and logs

Support reports are created only when the user explicitly clicks Export Report. They are saved locally to a path chosen by the user.

Raw terminal/engine logs are not automatically included in exported support reports and are not automatically uploaded.

## Network requests initiated by Wirebound

Wirebound can make these user-visible network requests:

- manual update checks to the public GitHub Releases API;
- opening GitHub or Fast.com after a user action;
- crash-report upload only when both an endpoint is configured in the build and the user explicitly opts in.

The reverse-tethered Android traffic itself is handled by the bundled Gnirehtet relay.
