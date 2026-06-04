# Wirebound Roadmap

Wirebound is a small Windows desktop utility that makes Android reverse tethering easier to use through a graphical interface.

## Current focus

- Improve Windows setup reliability
- Improve ADB device detection troubleshooting
- Make first-run onboarding clearer for non-technical users
- Reduce packaging size and startup overhead
- Document common connection problems

## Planned improvements

### 1. Better diagnostics

Wirebound should provide clearer messages when:
- ADB is not available
- No Android device is detected
- USB Debugging is disabled
- VPN permission is not accepted on the Android device
- Gnirehtet runtime files are missing

### 2. Lighter Windows packaging

The current version uses Electron. Future work may explore build optimization or a lighter native Windows architecture while keeping the interface simple.

### 3. Portable build

A portable package may help users run Wirebound without a full installer.

### 4. Documentation

The project needs clearer guides for:
- First-time setup
- USB Debugging
- ADB authorization
- Common Windows driver issues
- Troubleshooting connection failures

## Maintainer note

This project is early, but it solves a practical usability problem: reverse tethering tools are often terminal-based and confusing for non-technical users. Wirebound aims to make that workflow easier on Windows.
