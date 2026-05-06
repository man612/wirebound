# Wirebound

![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows)
![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge)
![Version: 1.0.0](https://img.shields.io/badge/Version-1.0.0-green?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-v39.x-47848F?style=for-the-badge&logo=electron)
![React](https://img.shields.io/badge/React-v19.x-61DAFB?style=for-the-badge&logo=react)

Wirebound is a Windows desktop GUI for [Gnirehtet](https://github.com/Genymobile/gnirehtet), providing a management interface for reverse tethering. It allows Android devices to use a computer's internet connection via USB without requiring root access.

---

## 📸 Preview

<p align="center">
  <img src="resources/dashboard.png" width="480" alt="Wirebound Dashboard">
  <img src="resources/settings.png" width="480" alt="Wirebound Settings">
</p>

---

## ✨ Features

- **Auto-Run Engine**: Detects connected ADB devices and initiates reverse tethering automatically.
- **Traffic Monitor**: Visualizes data throughput with real-time charts.
- **Themed Interface**: Supports native Light and Dark modes.
- **DNS Configuration**: Includes presets (Google, Cloudflare) and custom DNS options.
- **Live Logs**: Real-time terminal output parser for debugging and status tracking.
- **Localization**: Available in English and Indonesian.
- **Bundled Binaries**: Includes Gnirehtet Rust and ADB binaries for immediate use.

---

## 💻 Technical Overview

The application establishes a per-device VPN tunnel on the Android side that routes network traffic through a TCP relay server running on the PC. It automates the lifecycle of this relay and the ADB (Android Debug Bridge) connection.

### 1. Execution Mode
Wirebound uses the `autorun` mode:
- Monitors ADB bus for new connections.
- Deploys `gnirehtet.apk` to the device.
- Initiates the VPN service on multiple devices simultaneously.

### 2. Architecture
Built with **Electron + Vite**:
- **Main Process (Node.js)**: Manages `gnirehtet.exe` and `adb.exe` processes.
- **Renderer Process (React)**: UI layer styled with Tailwind CSS.
- **Preload Layer**: Context Bridge for secure IPC communication.

### 3. Project Structure
```text
bin/          # Bundled binaries (Gnirehtet & ADB)
build/        # Installer assets & icons
resources/    # Dashboard screenshots
src/          # Application source code
package.json  # Project manifest
LICENSE       # Apache 2.0
```

---

## 📖 Usage

### Step 1: Device Preparation
1. Enable **Developer Options** on the Android device.
2. Enable **USB Debugging**.

### Step 2: Connection
1. Connect the device via USB.
2. Authorize the ADB debugging prompt on the phone screen.

### Step 3: Execution
1. Run `Wirebound.exe`.
2. Configure DNS and Port in **Settings** if necessary.
3. Click **Start** in the Dashboard.
4. Accept the VPN request on the Android device.

---

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/man612/wirebound.git

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for Windows
npm run build:win
```

---

## 📄 License & Credits

- Wrapper for **Gnirehtet** by [Genymobile](https://github.com/Genymobile).
- GUI by **man612**.
- Licensed under the **Apache License 2.0**.
