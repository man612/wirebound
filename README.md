# Wirebound

Wirebound is a Windows desktop GUI for [Gnirehtet](https://github.com/Genymobile/gnirehtet), providing a management interface for reverse tethering. It allows Android devices to use a computer's internet connection via USB without requiring root access.

## Deep Dive: Technical Overview

The application establishes a per-device VPN tunnel on the Android side that routes network traffic through a TCP relay server running on the PC. It automates the lifecycle of this relay and the ADB (Android Debug Bridge) connection.

### 1. Multi-Device Engine (Autorun)
Wirebound uses the `autorun` execution mode which:
- Monitors the ADB bus for new device connections.
- Automatically pushes the `gnirehtet.apk` to connected devices.
- Initiates the VPN service on each device simultaneously.

### 2. Architecture
Built on Electron, the application uses a decoupled structure:
- **Main Process (Node.js)**: Manages `gnirehtet.exe` and `adb.exe` child processes and handles environment variable injection.
- **Renderer Process (React)**: An isolated UI layer communicating via secure IPC.
- **Telemetry Layer**: Parses stdout/stderr from the engine to provide real-time throughput data.

### 3. Project Structure
```text
├── build/                # Build assets (icons, etc.)
├── gnirehtet-rust-win64/ # Bundled Gnirehtet binaries
├── platform-tools/       # Bundled Android ADB binaries
├── src/
│   ├── main/             # Backend logic
│   ├── renderer/         # React frontend
│   └── shared/           # Common TypeScript types
└── package.json          # Dependency manifest
```

## Usage Tutorial (Step-by-Step)

### Step 1: Prepare the Android Device
1. Open **Settings** on your Android phone.
2. Go to **About Phone**.
3. Tap **Build Number** 7 times until "Developer mode" is enabled.
4. Go to **Settings > System (or Additional Settings) > Developer Options**.
5. Enable **USB Debugging**.

### Step 2: Connection and Authorization
1. Connect your phone to the computer using a USB data cable.
2. A prompt "Allow USB debugging?" will appear on your phone.
3. Check **"Always allow"** and tap **Allow**.
4. (Note) If no prompt appears, change the USB mode on your phone to "File Transfer" or "MTP".

### Step 3: Running Wirebound
1. Open `Wirebound.exe`.
2. Go to **Settings** to select a DNS (e.g., 8.8.8.8).
3. Go to the **Dashboard** and click **Start**.
4. **Look at your phone screen**: A VPN connection request will appear. Tap **OK** or **Accept**.
5. Once the status turns green ("Connected"), your phone has internet access.

## Troubleshooting
- **No devices found**: Ensure you are using a data cable, not just a charging cable.
- **VPN prompt not appearing**: Click **Stop** in the app and then **Start** again.
- **No internet**: Switch DNS to `1.1.1.1` or `8.8.8.8` in the app's settings.

## Credits & License
- Wrapper for **Gnirehtet** by [Genymobile](https://github.com/Genymobile).
- Licensed under the Apache License 2.0.
