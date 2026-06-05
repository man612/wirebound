export type Language = 'en' | 'id'

export const translations = {
  en: {
    // Onboarding
    welcome: 'Welcome to Wirebound',
    onboardingDesc: "Share your computer's internet connection with Android devices via USB.",
    chooseLanguage: 'Choose Language',
    chooseTheme: 'Choose Theme',
    lightTheme: 'Light',
    darkTheme: 'Dark',
    next: 'Next',
    getStarted: 'Get Started',

    // Dashboard
    testDesktopSpeed: 'Test Desktop Speed',
    testDeviceSpeed: 'Speed Test',
    noDevice: 'No device detected',
    connectDevice: 'Connect an Android device via USB',
    setupReadyTitle: 'Device ready',
    setupReadyDesc: 'Start the connection, then accept the VPN prompt on the Android device.',
    setupConnectedTitle: 'Connection active',
    setupConnectedDesc: 'The relay is running. Use the speed test to verify device connectivity.',
    setupConnectingTitle: 'Waiting for device VPN',
    setupConnectingDesc: 'Keep the phone unlocked and accept the Gnirehtet VPN permission prompt.',
    setupNoDeviceTitle: 'No Android device detected',
    setupNoDeviceDesc:
      'Connect a device via USB, enable USB debugging, and authorize this computer.',
    setupUnauthorizedTitle: 'USB debugging not authorized',
    setupUnauthorizedDesc:
      'Unlock the phone and approve the USB debugging prompt for this computer.',
    setupOfflineTitle: 'ADB device is offline',
    setupOfflineDesc:
      'Reconnect the USB cable, switch USB mode if needed, or restart ADB on the device.',
    setupNoPermissionsTitle: 'ADB cannot access the device',
    setupNoPermissionsDesc:
      'Check the USB driver, cable, and system permissions, then reconnect the device.',
    adbStatusReady: 'Ready',
    adbStatusUnauthorized: 'Unauthorized',
    adbStatusOffline: 'Offline',
    adbStatusNoAccess: 'No access',
    online: 'Online',
    dashboard: 'Dashboard',
    settings: 'Settings',
    terminal: 'Terminal Logs',

    // Status
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Connection Error',

    // Actions
    start: 'Start Connection',
    stop: 'Stop Connection',

    // Traffic
    trafficMonitor: 'Traffic Monitor',
    download: 'Download',
    upload: 'Upload',
    gathering: 'Gathering data...',
    noActiveConnection: 'No active connection',
    // Settings
    networkConfig: 'Network Configuration',
    environment: 'Environment',
    dnsProvider: 'DNS Provider',
    dnsDesc: 'Primary resolution server for tethered traffic',
    customIp: 'Custom IP Address',
    autoStartLabel: 'Auto-Start Tethering',
    autoStartDesc: 'Launch engine when application starts',
    themeLabel: 'Color Theme',
    themeDesc: 'Interface appearance',
    langLabel: 'Display Language',
    relayPort: 'Relay Port',
    portDesc: 'The local port used for the relay server',

    // UI Elements
    terminalLabel: 'Terminal Logs',
    clear: 'Clear',
    deviceStatus: 'Status',
    deviceId: 'ID',
    model: 'Model',
    power: 'Power',
    actions: 'Actions',

    // About
    about: 'About Wirebound',
    developer: 'Developer',
    githubRepo: 'GitHub',
    creditsDesc: 'A desktop GUI for Gnirehtet reverse tethering.'
  },
  id: {
    // Onboarding
    welcome: 'Selamat Datang di Wirebound',
    onboardingDesc: 'Bagikan koneksi internet komputer ke perangkat Android melalui USB.',
    chooseLanguage: 'Pilih Bahasa',
    chooseTheme: 'Pilih Tema',
    lightTheme: 'Terang',
    darkTheme: 'Gelap',
    next: 'Selanjutnya',
    getStarted: 'Mulai Sekarang',

    // Dashboard
    testDesktopSpeed: 'Test Desktop Speed',
    testDeviceSpeed: 'Speed Test',
    noDevice: 'Tidak ada perangkat terdeteksi',
    connectDevice: 'Hubungkan perangkat Android via USB',
    setupReadyTitle: 'Perangkat siap',
    setupReadyDesc: 'Mulai koneksi, lalu terima prompt VPN Gnirehtet di perangkat Android.',
    setupConnectedTitle: 'Koneksi aktif',
    setupConnectedDesc:
      'Relay sedang berjalan. Gunakan speed test untuk memeriksa koneksi perangkat.',
    setupConnectingTitle: 'Menunggu VPN perangkat',
    setupConnectingDesc: 'Biarkan HP terbuka dan terima prompt izin VPN Gnirehtet.',
    setupNoDeviceTitle: 'Perangkat Android tidak terdeteksi',
    setupNoDeviceDesc:
      'Hubungkan perangkat via USB, aktifkan USB debugging, lalu authorize komputer ini.',
    setupUnauthorizedTitle: 'USB debugging belum diizinkan',
    setupUnauthorizedDesc: 'Buka kunci HP dan setujui prompt USB debugging untuk komputer ini.',
    setupOfflineTitle: 'Perangkat ADB offline',
    setupOfflineDesc:
      'Sambungkan ulang kabel USB, ubah mode USB jika perlu, atau restart ADB di perangkat.',
    setupNoPermissionsTitle: 'ADB tidak bisa mengakses perangkat',
    setupNoPermissionsDesc:
      'Periksa driver USB, kabel, dan izin sistem, lalu sambungkan ulang perangkat.',
    adbStatusReady: 'Siap',
    adbStatusUnauthorized: 'Belum izin',
    adbStatusOffline: 'Offline',
    adbStatusNoAccess: 'Tidak ada akses',
    online: 'Online',
    dashboard: 'Dasbor',
    settings: 'Pengaturan',
    terminal: 'Log Terminal',

    // Status
    disconnected: 'Terputus',
    connecting: 'Menghubungkan...',
    connected: 'Terhubung',
    error: 'Koneksi Error',

    // Actions
    start: 'Mulai Koneksi',
    stop: 'Hentikan Koneksi',

    // Traffic
    trafficMonitor: 'Monitor Lalu Lintas',
    download: 'Unduh',
    upload: 'Unggah',
    gathering: 'Mengumpulkan data...',
    noActiveConnection: 'Tidak ada koneksi aktif',

    // Settings
    networkConfig: 'Konfigurasi Jaringan',
    environment: 'Lingkungan',
    dnsProvider: 'Penyedia DNS',
    dnsDesc: 'Server utama untuk resolusi lalu lintas data',
    customIp: 'Alamat IP Kustom',
    autoStartLabel: 'Auto-Start Tethering',
    autoStartDesc: 'Jalankan mesin saat aplikasi dibuka',
    themeLabel: 'Tema Warna',
    themeDesc: 'Tampilan antarmuka',
    langLabel: 'Bahasa Tampilan',
    relayPort: 'Port Relay',
    portDesc: 'Port lokal yang digunakan untuk server relay',

    // UI Elements
    terminalLabel: 'Log Terminal',
    clear: 'Bersihkan',
    deviceStatus: 'Status',
    deviceId: 'ID',
    model: 'Model',
    power: 'Daya',
    actions: 'Aksi',

    // About
    about: 'Tentang Wirebound',
    developer: 'Pengembang',
    githubRepo: 'GitHub',
    creditsDesc: 'GUI desktop untuk reverse tethering Gnirehtet.'
  }
}

export type TranslationKey = keyof typeof translations.en
export type Translation = typeof translations.en
