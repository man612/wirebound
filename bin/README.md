# Runtime binaries

Wirebound does not commit executable runtime binaries to the repository.

Run `npm run runtime:prepare` on Windows to download the pinned runtime versions used by release builds:

- Android SDK Platform Tools 37.0.1
- Gnirehtet Rust for Windows 2.5.1

The preparation script verifies SHA-256 checksums before extracting either archive. Release and CI workflows use the same script so local and packaged builds use the same runtime inputs.
