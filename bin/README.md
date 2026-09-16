# Runtime binaries

Wirebound does not commit executable runtime binaries to the repository.

Run `npm run runtime:prepare` on Windows to download the pinned runtime versions used by release builds:

- Android SDK Platform Tools 37.0.1
- Gnirehtet Rust for Windows 2.5.1

The preparation script verifies SHA-256 checksums before extracting either archive. Release and CI workflows use the same script so local and packaged builds use the same runtime inputs.

Only the runtime files Wirebound actually needs are copied into the package: `adb.exe`, its two Windows ADB DLLs, Google's notice/version metadata, plus `gnirehtet.exe` and `gnirehtet.apk`. Tools such as Fastboot, sqlite3, mke2fs, and etc1tool are intentionally excluded.
At runtime, Wirebound copies the three executable ADB files into a content-addressed cache under `%LOCALAPPDATA%\Wirebound\runtime`. This lets Wirebound share the standard ADB server on port 5037 without an ADB daemon locking packaged application files during updates.
