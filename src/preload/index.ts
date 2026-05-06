import { contextBridge, ipcRenderer } from 'electron'
import type { GnirehtetAPI } from '../shared/types'

const api: GnirehtetAPI = {
  startGnirehtet: (dns: string, port: string) => ipcRenderer.invoke('gnirehtet:start', dns, port),
  stopGnirehtet: () => ipcRenderer.invoke('gnirehtet:stop'),
  getStatus: () => ipcRenderer.invoke('gnirehtet:status'),
  getDevices: () => ipcRenderer.invoke('adb:devices'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  testSpeedOnDevice: (deviceId: string) => ipcRenderer.invoke('adb:testSpeed', deviceId),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  windowControl: (action: 'minimize' | 'maximize' | 'close') =>
    ipcRenderer.send('window:control', action),
  onLog: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, entry: unknown): void => {
      callback(entry as Parameters<typeof callback>[0])
    }
    ipcRenderer.on('gnirehtet:log', handler)
    return () => {
      ipcRenderer.removeListener('gnirehtet:log', handler)
    }
  },
  onStatusChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown): void => {
      callback(status as Parameters<typeof callback>[0])
    }
    ipcRenderer.on('gnirehtet:status-change', handler)
    return () => {
      ipcRenderer.removeListener('gnirehtet:status-change', handler)
    }
  },
  onDevicesChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, devices: unknown): void => {
      callback(devices as Parameters<typeof callback>[0])
    }
    ipcRenderer.on('adb:devices-change', handler)
    return () => {
      ipcRenderer.removeListener('adb:devices-change', handler)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  const preloadWindow = window as Window & typeof globalThis & { api: GnirehtetAPI }
  preloadWindow.api = api
}
