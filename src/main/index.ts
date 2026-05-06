import { app, shell, BrowserWindow, ipcMain, screen, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { spawn, exec, execSync, ChildProcess } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import type { AdbDevice, AppSettings, ConnectionStatus } from '../shared/types'

// --- Global State ---
let mainWindow: BrowserWindow | null = null
let gnirehtetProcess: ChildProcess | null = null
let connectionStatus: ConnectionStatus = 'disconnected'

// --- Paths ---
const ROOT = process.cwd()
const GNIREHTET_EXE = join(ROOT, 'gnirehtet-rust-win64', 'gnirehtet.exe')
const ADB_EXE = join(ROOT, 'platform-tools', 'adb.exe')
const ADB_DIR = join(ROOT, 'platform-tools')
const SETTINGS_FILE = join(app.getPath('userData'), 'settings.json')

const ICON_PATH = existsSync(join(ROOT, 'build', 'icon.ico')) 
  ? join(ROOT, 'build', 'icon.ico') 
  : join(ROOT, 'resources', 'icon.png')

console.log('Wirebound: Initializing Main Process...')

// --- Settings ---
const DEFAULT_SETTINGS: AppSettings = {
  dns: '8.8.8.8', port: '31416', customDns: '', autoStart: false,
  language: 'en', theme: 'dark', onboardingCompleted: false
}

function loadSettings(): AppSettings {
  try {
    if (existsSync(SETTINGS_FILE)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8')) }
    }
  } catch (e) { }
  return DEFAULT_SETTINGS
}

// --- Helpers ---
function setStatus(status: ConnectionStatus) {
  connectionStatus = status
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('gnirehtet:status-change', status)
}

function sendLog(message: string, type: 'stdout' | 'stderr' | 'info' = 'info') {
  const ts = new Date().toLocaleTimeString('id-ID', { hour12: false })
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('gnirehtet:log', { timestamp: `[${ts}]`, message, type })
  }
}

// --- ADB ---
async function getDevices(): Promise<AdbDevice[]> {
  return new Promise((resolve) => {
    if (!existsSync(ADB_EXE)) return resolve([])
    const env = { ...process.env, PATH: `${ADB_DIR};${process.env.PATH || ''}` }
    
    exec(`"${ADB_EXE}" devices`, { env }, (err, stdout) => {
      if (err) return resolve([])
      const lines = stdout.split('\n')
      const devices: AdbDevice[] = []
      
      for (const line of lines) {
        const match = line.trim().match(/^([^\s]+)\s+(device|offline|unauthorized)$/)
        if (match) {
          const id = match[1]
          const status = match[2] as any
          let name = 'Android Device'
          let battery: string | undefined = undefined
          
          if (status === 'device') {
            try {
              // Get all details in one go to be more efficient
              const cmd = `"${ADB_EXE}" -s ${id} shell "getprop ro.product.brand; getprop ro.product.model; dumpsys battery | grep level"`
              const out = execSync(cmd, { env, windowsHide: true, timeout: 3000 }).toString().split('\n')
              
              const brand = out[0]?.trim() || ''
              const model = out[1]?.trim() || ''
              if (brand || model) {
                name = `${brand.charAt(0).toUpperCase() + brand.slice(1)} ${model}`.trim()
              }
              
              const batLine = out.find(l => l.includes('level'))
              const batMatch = batLine?.match(/level:\s+(\d+)/)
              if (batMatch) battery = batMatch[1]
            } catch (e: any) { 
              console.log(`Wirebound: Failed to get details for ${id}. Error Detail: ${e.message}`)
            }
          }
          devices.push({ id, name, status, battery })
        }
      }
      resolve(devices)
    })
  })
}

// --- Engine ---
function startEngine(dns: string, port: string) {
  if (gnirehtetProcess) return
  const d = dns || '8.8.8.8', p = port || '31416'
  setStatus('connecting')
  sendLog(`Wirebound [v1.0.1]: Starting (DNS: ${d}, Port: ${p})`)
  
  const env = { ...process.env, PATH: `${ADB_DIR};${process.env.PATH || ''}` }
  gnirehtetProcess = spawn(GNIREHTET_EXE, ['autorun', '-d', d, '-p', p], { 
    cwd: join(ROOT, 'gnirehtet-rust-win64'), env, windowsHide: true 
  })

  gnirehtetProcess.stdout?.on('data', (data) => {
    const msg = data.toString().trim()
    if (msg) {
      sendLog(msg, 'stdout')
      if (msg.includes('Open') || msg.includes('connected')) setStatus('connected')
    }
  })
  gnirehtetProcess.stderr?.on('data', (d) => sendLog(d.toString().trim(), 'stderr'))
  gnirehtetProcess.on('close', (c) => {
    sendLog(`Wirebound [v1.0.1]: Stopped (Code: ${c})`)
    setStatus('disconnected')
    gnirehtetProcess = null
  })
}

function stopEngine() {
  if (!gnirehtetProcess) return
  sendLog('Wirebound [v1.0.1]: Cleaning up...')
  try {
    const env = { ...process.env, PATH: `${ADB_DIR};${process.env.PATH || ''}` }
    const out = execSync(`"${ADB_EXE}" devices`, { env }).toString()
    out.split('\n').forEach(line => {
      const m = line.trim().match(/^([^\s]+)\s+device$/)
      if (m) execSync(`"${ADB_EXE}" -s ${m[1]} shell am force-stop com.genymobile.gnirehtet`, { env, windowsHide: true })
    })
  } catch (e) { }
  gnirehtetProcess.kill(); gnirehtetProcess = null; setStatus('disconnected'); sendLog('Wirebound [v1.0.1]: Stopped.')
}

// --- Window ---
function createWindow() {
  try {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const winIcon = nativeImage.createFromPath(ICON_PATH)
    
    mainWindow = new BrowserWindow({
      width: Math.min(1000, width * 0.9), height: Math.min(720, height * 0.9),
      show: false, autoHideMenuBar: true, frame: false,
      icon: winIcon,
      backgroundColor: '#09090b',
      webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false, contextIsolation: true }
    })
    
    mainWindow.on('ready-to-show', () => {
      mainWindow?.show()
      if (process.platform === 'win32') mainWindow?.setOverlayIcon(winIcon, 'Wirebound')
    })
    
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    else mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  } catch (err) { }
}

// --- Lifecycle ---
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.yasman.wirebound')
  
  // REGISTER ALL HANDLERS
  ipcMain.handle('gnirehtet:start', (_, dns, port) => startEngine(dns, port))
  ipcMain.handle('gnirehtet:stop', () => stopEngine())
  ipcMain.handle('adb:devices', () => getDevices())
  ipcMain.handle('settings:get', () => loadSettings())
  ipcMain.handle('settings:set', (_, s) => writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2)))
  ipcMain.handle('adb:testSpeed', () => true)
  
  ipcMain.on('window:control', (_, a) => {
    if (!mainWindow) return
    if (a === 'minimize') mainWindow.minimize()
    else if (a === 'maximize') mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
    else if (a === 'close') mainWindow.close()
  })

  createWindow()

  setInterval(async () => {
    const d = await getDevices()
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('adb:devices-change', d)
  }, 3000)
})

app.on('window-all-closed', () => {
  if (gnirehtetProcess) gnirehtetProcess.kill()
  if (process.platform !== 'darwin') app.quit()
})
