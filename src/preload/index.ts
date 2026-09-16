import { contextBridge, ipcRenderer } from 'electron'
import type { GnirehtetAPI } from '../shared/types'

const api: GnirehtetAPI = {
  startGnirehtet: (dns: string, port: string) => ipcRenderer.invoke('gnirehtet:start', dns, port),
  stopGnirehtet: () => ipcRenderer.invoke('gnirehtet:stop'),
  getStatus: () => ipcRenderer.invoke('gnirehtet:status'),
  getDeviceSnapshot: () => ipcRenderer.invoke('adb:snapshot'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getDiagnostics: () => ipcRenderer.invoke('app:diagnostics'),
  testSpeedOnDevice: (deviceId: string) => ipcRenderer.invoke('adb:testSpeed', deviceId),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  windowControl: (action: 'minimize' | 'maximize' | 'close') =>
    ipcRenderer.send('window:control', action),
  onLog: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, entry: unknown): void => {
      callback(entry as Parameters<typeof callback>[0])
    }
    ipcRenderer.on('gnirehtet:log', handler)
    return () => ipcRenderer.removeListener('gnirehtet:log', handler)
  },
  onStatusChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown): void => {
      callback(status as Parameters<typeof callback>[0])
    }
    ipcRenderer.on('gnirehtet:status-change', handler)
    return () => ipcRenderer.removeListener('gnirehtet:status-change', handler)
  },
  onDevicesChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: unknown): void => {
      callback(snapshot as Parameters<typeof callback>[0])
    }
    ipcRenderer.on('adb:devices-change', handler)
    return () => ipcRenderer.removeListener('adb:devices-change', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)
