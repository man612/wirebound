# Wirebound

![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows)
![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue?style=for-the-badge)
![Version: 1.0.0](https://img.shields.io/badge/Version-1.0.0-green?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-v39.x-47848F?style=for-the-badge&logo=electron)
![React](https://img.shields.io/badge/React-v19.x-61DAFB?style=for-the-badge&logo=react)

**Wirebound** is a premium Windows desktop GUI for [Gnirehtet](https://github.com/Genymobile/gnirehtet), providing a powerful management interface for reverse tethering. It allows Android devices to use a computer's internet connection via USB—**without requiring root access**.

---

## 📸 Preview

<p align="center">
  <img src="resources/dashboard.png" width="480" alt="Wirebound Dashboard">
  <img src="resources/settings.png" width="480" alt="Wirebound Settings">
</p>

---

## ✨ Key Features

- 🚀 **Auto-Run Engine**: Automatically detects connected ADB devices and initiates reverse tethering.
- 📊 **Real-time Traffic Monitor**: Visualize your data flow with interactive charts (powered by Recharts).
- 🌓 **Adaptive UI**: Beautifully designed interface with native Light and Dark mode support.
- 🌐 **Flexible DNS**: Choose from popular presets (Google, Cloudflare) or set your own custom DNS.
- 📝 **Live Logging**: Real-time terminal output parser for easier debugging and status tracking.
- 🌍 **Multi-language Support**: Fully localized in English and Indonesian.
- 🛠️ **Environment Bundle**: Comes with pre-bundled Gnirehtet Rust and ADB binaries for a "just work" experience.

---

## 💻 Deep Dive: Technical Overview

The application establishes a per-device VPN tunnel on the Android side that routes network traffic through a TCP relay server running on the PC. It automates the lifecycle of this relay and the ADB (Android Debug Bridge) connection.

### 1. Multi-Device Engine
Wirebound uses the `autorun` execution mode which:
- Monitors the ADB bus for new device connections.
- Automatically installs the `gnirehtet.apk` if missing.
- Initiates the VPN service on each device simultaneously.

### 2. Architecture
Built with **Electron + Vite**, the application uses a strictly decoupled structure:
- **Main Process (Node.js)**: Manages `gnirehtet.exe` and `adb.exe` lifecycle and process pipes.
- **Renderer Process (React)**: An isolated UI layer built with Tailwind CSS v4 for modern styling.
- **Preload Layer**: A secure Context Bridge for IPC communication between UI and OS.

---

## 📖 Usage Tutorial

### Step 1: Prepare the Android Device
1. Open **Settings** > **About Phone**.
2. Tap **Build Number** 7 times until "Developer mode" is enabled.
3. Enable **USB Debugging** in **Developer Options**.

### Step 2: Connection
1. Connect your phone via USB.
2. Allow USB Debugging prompt on the device (check "Always allow").
3. Ensure USB mode is set to "File Transfer" or "MTP".

### Step 3: Start Wirebound
1. Open `Wirebound.exe`.
2. Configure your preferred DNS in **Settings**.
3. Hit **Start** in the Dashboard.
4. Accept the VPN request on your phone.

---

## 🛠️ Development

If you want to build or modify Wirebound:

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

## 🐞 Troubleshooting

- **No devices found**: Ensure you are using a high-quality data cable.
- **VPN prompt not appearing**: Click **Stop** and then **Start** again.
- **No internet access**: Check if your firewall is blocking the relay port (default: 31416).

---

## 📄 License & Credits

- Wrapper for **Gnirehtet** by [Genymobile](https://github.com/Genymobile).
- GUI built by **man612**.
- Licensed under the **Apache License 2.0**.
