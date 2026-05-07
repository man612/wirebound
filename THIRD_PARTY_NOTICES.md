# Third-Party Notices

Wirebound includes and/or uses third-party open-source components. This file lists major third-party components bundled or used by this project.

## Gnirehtet

Gnirehtet is an open-source reverse tethering tool created by Genymobile.

- **Original repository**: [https://github.com/Genymobile/gnirehtet](https://github.com/Genymobile/gnirehtet)
- **License**: Apache License 2.0
- **Copyright**: Copyright (C) Genymobile and Gnirehtet contributors.
- **Bundled Version**: Gnirehtet v2.5.1 (Rust Windows build).
- **Modification Status**: Wirebound uses the original Gnirehtet binaries as an underlying engine. No modifications have been made to the Gnirehtet source code itself. The primary development focus of Wirebound is the GUI, automation, process management, and multi-device workflow integration.

**Use in Wirebound:**
Wirebound uses Gnirehtet as the reverse tethering engine and provides a desktop GUI, automation, logging, DNS/port configuration, traffic monitoring, and multi-device management around it.

## Android SDK Platform Tools / ADB

Android Debug Bridge (ADB) is part of Android SDK Platform Tools.

- **Original source**: [https://developer.android.com/tools/releases/platform-tools](https://developer.android.com/tools/releases/platform-tools)
- **Bundled Version**: Latest stable Android Platform Tools.

**Use in Wirebound:**
Wirebound uses ADB to detect Android devices, authorize USB debugging, and manage the connection required by Gnirehtet.

Please refer to the Android SDK Platform Tools license terms from Google for details.
