# Third-Party Notices

Wirebound uses and redistributes third-party components. Release builds fetch pinned upstream artifacts during the build instead of storing executable binaries in the Git repository.

## Gnirehtet

Gnirehtet is an open-source reverse-tethering tool created by Genymobile.

- Original repository: https://github.com/Genymobile/gnirehtet
- License: Apache License 2.0
- Bundled version: **2.5.1**, Rust Windows build
- Archive SHA-256: `7f5b1063e7895182aa60def1437e50363c3758144088dcd079037bb7c3c46a1c`
- Modification status: Wirebound uses the original upstream Windows runtime and APK. Wirebound does not modify Gnirehtet source code.

Wirebound uses Gnirehtet as the reverse-tethering engine and adds Windows GUI, lifecycle management, settings, status handling, logs, and device workflow integration around it.

## Android SDK Platform Tools / ADB

Android Debug Bridge (ADB) is distributed as part of Android SDK Platform Tools by Google.

- Official release information: https://developer.android.com/tools/releases/platform-tools
- Bundled version: **37.0.1**, Windows
- Archive SHA-256: `45f4d63113e895ebde0c90f194099a4676b6ac653bd28d54314a9e022bbc1a99`
- Redistributed subset: `adb.exe`, `AdbWinApi.dll`, `AdbWinUsbApi.dll`, `NOTICE.txt`, and `source.properties`

Wirebound uses ADB to discover authorized Android devices, inspect device state, launch the speed-test URL, detect the Gnirehtet client, and stop that client during cleanup.

Wirebound packages only `adb.exe`, `AdbWinApi.dll`, `AdbWinUsbApi.dll`, Google's `NOTICE.txt`, and `source.properties` from Platform Tools. At runtime the executable ADB files are copied into a content-addressed `%LOCALAPPDATA%\Wirebound\runtime` cache so Wirebound can share the standard ADB server on port 5037 without keeping packaged application files locked.

The hashes above are also enforced by `scripts/prepare-runtime.ps1`. If an upstream artifact changes, the build fails until the pinned version and checksum are intentionally reviewed and updated.

Refer to the respective upstream projects and distribution terms for complete copyright and license information.