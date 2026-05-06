export type Language = 'en' | 'id'

export const translations = {
  en: {
    // Onboarding
    welcome: 'Welcome to Wirebound',
    onboardingDesc: 'Share your computer\'s internet connection with Android devices via USB.',
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
