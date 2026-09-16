import { useEffect, useState } from 'react'
import TitleBar from './components/layout/TitleBar'
import Sidebar from './components/layout/Sidebar'
import OnboardingScreen from './components/OnboardingScreen'
import Dashboard from './components/views/Dashboard'
import Settings from './components/views/Settings'
import { useAppVersion, useDevices, useDiagnostics, useGnirehtet, useSettings } from './hooks'
import type { Language } from './i18n'
import { translations } from './i18n'

function App(): React.JSX.Element {
  const [activePage, setActivePage] = useState<'dashboard' | 'settings'>('dashboard')
  const { status, logs, isLoading, start, stop, clearLogs } = useGnirehtet()
  const { devices, error: adbError } = useDevices()
  const { settings, updateSettings, loaded } = useSettings()
  const diagnostics = useDiagnostics()
  const version = useAppVersion()
  const t = translations[(settings?.language as Language) || 'en']

  const handleStart = async (): Promise<void> => {
    const dns = settings.dns === 'custom' ? settings.customDns : settings.dns
    const port = settings.port || '31416'
    const result = await start(dns || '8.8.8.8', port)

    if (!result.success) {
      console.warn('Failed to start Wirebound.', result.error)
    }
  }

  const handleStop = async (): Promise<void> => {
    const result = await stop()

    if (!result.success) {
      console.warn('Failed to stop Wirebound.', result.error)
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

  useEffect(() => {
    if (loaded && settings?.theme) {
      const theme = settings.theme
      document.documentElement.setAttribute('data-theme', theme)
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }
  }, [loaded, settings?.theme])

  if (!loaded) return <div className="h-screen w-screen bg-bg-primary" />

  return (
    <div className="w-screen h-screen flex overflow-hidden font-sans text-text-primary bg-bg-surface selection:bg-blue-600/30 theme-transition">
      <TitleBar />

      {!settings.onboardingCompleted && <OnboardingScreen onComplete={handleCompleteOnboarding} />}

      {settings.onboardingCompleted && (
        <>
          <Sidebar activePage={activePage} onNavigate={setActivePage} t={t} version={version} />
          <main className="flex-grow relative overflow-hidden bg-bg-surface pt-8 theme-transition">
            <div key={activePage} className="h-full">
              {activePage === 'dashboard' && (
                <Dashboard
                  status={status}
                  isLoading={isLoading}
                  onStart={handleStart}
                  onStop={handleStop}
                  devices={devices}
                  adbError={adbError}
                  logs={logs}
                  onClearLogs={clearLogs}
                  diagnostics={diagnostics}
                  t={t}
                />
              )}
              {activePage === 'settings' && (
                <Settings
                  settings={settings}
                  updateSettings={updateSettings}
                  version={version}
                  t={t}
                />
              )}
            </div>
          </main>
        </>
      )}
    </div>
  )
}

export default App
