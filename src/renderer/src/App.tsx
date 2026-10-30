import { useEffect, useState } from 'react'
import TitleBar from './components/layout/TitleBar'
import Sidebar from './components/layout/Sidebar'
import OnboardingScreen from './components/OnboardingScreen'
import Dashboard from './components/views/Dashboard'
import Settings from './components/views/Settings'
import WorkspacePlaceholder from './components/views/WorkspacePlaceholder'
import TerminalLog from './components/views/TerminalLog'
import type { AppPage } from './pages'
import { useAppVersion, useDevices, useDiagnostics, useGnirehtet, useSettings } from './hooks'
import type { Language } from './i18n'
import { translations } from './i18n'

function App(): React.JSX.Element {
  const [activePage, setActivePage] = useState<AppPage>('dashboard')
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
    if (loaded && settings?.theme && settings.onboardingCompleted) {
      const theme = settings.theme
      document.documentElement.setAttribute('data-theme', theme)
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }
  }, [loaded, settings?.theme, settings.onboardingCompleted])

  if (!loaded) return <div className="h-screen w-screen bg-bg-primary" />

  return (
    <div className="w-screen h-screen flex overflow-hidden font-sans text-text-primary bg-bg-surface selection:bg-blue-600/30 theme-transition">
      <TitleBar />

      {!settings.onboardingCompleted && (
        <OnboardingScreen
          onComplete={handleCompleteOnboarding}
          devices={devices}
          adbError={adbError}
          diagnostics={diagnostics}
        />
      )}

      {settings.onboardingCompleted && (
        <>
          <Sidebar activePage={activePage} onNavigate={setActivePage} t={t} language={settings.language} version={version} />
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
                  language={settings.language}
                />
              )}
              {activePage === 'logs' && (
                <div className="flex h-full flex-col overflow-hidden bg-bg-surface">
                  <div className="border-b border-border-subtle px-4 py-2 text-xs text-text-muted">
                    Wirebound / <span className="text-text-primary">{settings.language === 'id' ? 'Log Aktivitas' : 'Activity Logs'}</span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden p-4">
                    <TerminalLog logs={logs} devices={devices} onClear={clearLogs} t={t} language={settings.language} full />
                  </div>
                </div>
              )}
              {activePage !== 'dashboard' && activePage !== 'logs' && activePage !== 'settings' && (
                <WorkspacePlaceholder page={activePage} language={settings.language} onDashboard={() => setActivePage('dashboard')}/>
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
