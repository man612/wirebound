import { useState, useEffect } from 'react'
import TitleBar from './components/layout/TitleBar'
import Sidebar from './components/layout/Sidebar'
import OnboardingScreen from './components/OnboardingScreen'
import Dashboard from './components/views/Dashboard'
import Settings from './components/views/Settings'
import { useGnirehtet, useDevices, useSettings, useTraffic } from './hooks'
import type { Language } from './i18n'
import { translations } from './i18n'

function App(): React.JSX.Element {
  const [activePage, setActivePage] = useState<'dashboard' | 'settings'>('dashboard')
  const { status, logs, isLoading, start, stop, clearLogs } = useGnirehtet()
  const { devices } = useDevices()
  const { settings, updateSettings, loaded } = useSettings()
  const isConnected = status === 'connected'
  const { data: trafficData } = useTraffic(isConnected)

  const t = translations[(settings?.language as Language) || 'en']

  const handleStart = async (): Promise<void> => {
    const dns = settings.dns === 'custom' ? settings.customDns : settings.dns
    const port = settings.port || '31416'
    const res = await start(dns || '8.8.8.8', port)

    if (!res.success) {
      console.warn('Failed to start Wirebound.', res.error)
    }
  }

  const handleStop = async (): Promise<void> => {
    const res = await stop()

    if (!res.success) {
      console.warn('Failed to stop Wirebound.', res.error)
    }
  }

  const handleCompleteOnboarding = async (
    lang: Language,
    theme: 'light' | 'dark'
  ): Promise<void> => {
    await updateSettings({ theme, language: lang, onboardingCompleted: true })
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }

  // Sync theme on load
  useEffect(() => {
    if (loaded && settings?.theme) {
      const theme = settings.theme
      document.documentElement.setAttribute('data-theme', theme)
      if (theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }, [loaded, settings?.theme])

  if (!loaded) return <div className="h-screen w-screen bg-bg-primary" />

  return (
    <div className="w-screen h-screen flex overflow-hidden font-sans text-text-primary bg-bg-surface selection:bg-blue-600/30 theme-transition">
      <TitleBar />

      {!settings.onboardingCompleted && <OnboardingScreen onComplete={handleCompleteOnboarding} />}

      {settings.onboardingCompleted && (
        <>
          <Sidebar activePage={activePage} onNavigate={setActivePage} t={t} />
          <main className="flex-grow relative overflow-hidden bg-bg-surface pt-8 theme-transition">
            {/* Transition key mereset state animasi agar perpindahan view terasa mulus */}
            <div key={activePage} className="h-full">
              {activePage === 'dashboard' && (
                <Dashboard
                  status={status}
                  isLoading={isLoading}
                  onStart={handleStart}
                  onStop={handleStop}
                  devices={devices}
                  trafficData={trafficData}
                  logs={logs}
                  onClearLogs={clearLogs}
                  t={t}
                />
              )}
              {activePage === 'settings' && (
                <Settings settings={settings} updateSettings={updateSettings} t={t} />
              )}
            </div>
          </main>
        </>
      )}
    </div>
  )
}

export default App
