export type Language = 'en' | 'id'

export const translations = {
  en: {
    welcome: 'Welcome to Wirebound',
    onboardingDesc: "Share your computer's internet connection with Android devices via USB.",
    chooseLanguage: 'Choose Language',
    chooseTheme: 'Choose Theme',
    lightTheme: 'Light',
    darkTheme: 'Dark',
    next: 'Next',
    getStarted: 'Get Started',

    testDesktopSpeed: 'Test Desktop Speed',
    testDeviceSpeed: 'Speed Test',
    noDevice: 'No device detected',
    adbUnavailable: 'ADB is unavailable',
    devicesLabel: 'Android Devices',
    setupReadyTitle: 'Device ready',
    setupReadyDesc: 'Start the connection, then accept the VPN prompt on the Android device.',
    setupConnectedTitle: 'Relay and Android VPN are active',
    setupConnectedDesc:
      'Use the speed test to verify that internet access is actually working on the device.',
    setupConnectingTitle: 'Waiting for Android VPN client',
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
    setupAdbErrorTitle: 'ADB is not available',
    setupAdbErrorDesc:
      'Wirebound cannot query ADB. Check the bundled runtime or restart the application.',
    adbStatusReady: 'Ready',
    adbStatusUnauthorized: 'Unauthorized',
    adbStatusOffline: 'Offline',
    adbStatusNoAccess: 'No access',
    online: 'Online',
    dashboard: 'Dashboard',
    settings: 'Settings',
    terminal: 'Terminal Logs',

    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Connection Error',

    start: 'Start Connection',
    stop: 'Stop Connection',

    networkConfig: 'Network Configuration',
    environment: 'Environment',
    dnsProvider: 'DNS Provider',
    dnsDesc: 'DNS server used by the Gnirehtet relay',
    customIp: 'Custom IPv4 Address',
    customDnsInvalid: 'Enter a valid IPv4 address.',
    autoStartLabel: 'Auto-Start Tethering',
    autoStartDesc: 'Start the tethering engine when Wirebound opens',
    themeLabel: 'Color Theme',
    themeDesc: 'Interface appearance',
    langLabel: 'Display Language',
    relayPort: 'Relay Port',
    portDesc: 'TCP port used by the local relay',
    portInvalid: 'Use a port from 1 to 65535.',

    terminalLabel: 'Terminal Logs',
    noLogsYet: 'No engine output yet',
    clear: 'Clear',
    deviceStatus: 'Status',
    deviceId: 'ID',
    model: 'Model',
    power: 'Power',
    actions: 'Actions',

    about: 'About Wirebound',
    developer: 'Developer',
    githubRepo: 'GitHub',
    creditsDesc: 'A Windows desktop GUI for Gnirehtet reverse tethering.'
  },
  id: {
    welcome: 'Selamat Datang di Wirebound',
    onboardingDesc: 'Bagikan koneksi internet komputer ke perangkat Android melalui USB.',
    chooseLanguage: 'Pilih Bahasa',
    chooseTheme: 'Pilih Tema',
    lightTheme: 'Terang',
    darkTheme: 'Gelap',
    next: 'Selanjutnya',
    getStarted: 'Mulai Sekarang',

    testDesktopSpeed: 'Tes Kecepatan PC',
    testDeviceSpeed: 'Tes Kecepatan',
    noDevice: 'Tidak ada perangkat terdeteksi',
    adbUnavailable: 'ADB tidak tersedia',
    devicesLabel: 'Perangkat Android',
    setupReadyTitle: 'Perangkat siap',
    setupReadyDesc: 'Mulai koneksi, lalu terima prompt VPN Gnirehtet di perangkat Android.',
    setupConnectedTitle: 'Relay dan VPN Android aktif',
    setupConnectedDesc:
      'Gunakan tes kecepatan untuk memastikan akses internet benar-benar bekerja di perangkat.',
    setupConnectingTitle: 'Menunggu klien VPN Android',
    setupConnectingDesc: 'Biarkan HP terbuka dan terima prompt izin VPN Gnirehtet.',
    setupNoDeviceTitle: 'Perangkat Android tidak terdeteksi',
    setupNoDeviceDesc:
      'Hubungkan perangkat via USB, aktifkan USB debugging, lalu izinkan komputer ini.',
    setupUnauthorizedTitle: 'USB debugging belum diizinkan',
    setupUnauthorizedDesc: 'Buka kunci HP dan setujui prompt USB debugging untuk komputer ini.',
    setupOfflineTitle: 'Perangkat ADB offline',
    setupOfflineDesc:
      'Sambungkan ulang kabel USB, ubah mode USB jika perlu, atau restart ADB di perangkat.',
    setupNoPermissionsTitle: 'ADB tidak bisa mengakses perangkat',
    setupNoPermissionsDesc:
      'Periksa driver USB, kabel, dan izin sistem, lalu sambungkan ulang perangkat.',
    setupAdbErrorTitle: 'ADB tidak tersedia',
    setupAdbErrorDesc:
      'Wirebound tidak bisa menjalankan ADB. Periksa runtime bawaan atau buka ulang aplikasi.',
    adbStatusReady: 'Siap',
    adbStatusUnauthorized: 'Belum izin',
    adbStatusOffline: 'Offline',
    adbStatusNoAccess: 'Tidak ada akses',
    online: 'Online',
    dashboard: 'Dasbor',
    settings: 'Pengaturan',
    terminal: 'Log Terminal',

    disconnected: 'Terputus',
    connecting: 'Menghubungkan...',
    connected: 'Terhubung',
    error: 'Koneksi Error',

    start: 'Mulai Koneksi',
    stop: 'Hentikan Koneksi',

    networkConfig: 'Konfigurasi Jaringan',
    environment: 'Lingkungan',
    dnsProvider: 'Penyedia DNS',
    dnsDesc: 'Server DNS yang digunakan relay Gnirehtet',
    customIp: 'Alamat IPv4 Kustom',
    customDnsInvalid: 'Masukkan alamat IPv4 yang valid.',
    autoStartLabel: 'Auto-Start Tethering',
    autoStartDesc: 'Jalankan mesin tethering saat Wirebound dibuka',
    themeLabel: 'Tema Warna',
    themeDesc: 'Tampilan antarmuka',
    langLabel: 'Bahasa Tampilan',
    relayPort: 'Port Relay',
    portDesc: 'Port TCP yang digunakan relay lokal',
    portInvalid: 'Gunakan port dari 1 sampai 65535.',

    terminalLabel: 'Log Terminal',
    noLogsYet: 'Belum ada output dari engine',
    clear: 'Bersihkan',
    deviceStatus: 'Status',
    deviceId: 'ID',
    model: 'Model',
    power: 'Daya',
    actions: 'Aksi',

    about: 'Tentang Wirebound',
    developer: 'Pengembang',
    githubRepo: 'GitHub',
    creditsDesc: 'GUI desktop Windows untuk reverse tethering Gnirehtet.'
  }
}

export type TranslationKey = keyof typeof translations.en
export type Translation = typeof translations.en
