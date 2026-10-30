import { contextBridge, ipcRenderer } from 'electron'

const eventChannels = new Set(['acp:update', 'acp:permission', 'acp:status', 'terminal:output'])

contextBridge.exposeInMainWorld('geminiDesktop', {
  isDesktop: true,
  getInfo: () => ipcRenderer.invoke('desktop:get-info'),
  selectWorkspace: () => ipcRenderer.invoke('workspace:select'),
  listFiles: (path?: string) => ipcRenderer.invoke('workspace:list', path),
  readFile: (path: string) => ipcRenderer.invoke('workspace:read', path),
  startSession: (options: { cwd: string; cliPath?: string }) => ipcRenderer.invoke('acp:start', options),
  loadSession: (options: { sessionId: string; cwd: string; cliPath?: string }) => ipcRenderer.invoke('acp:load', options),
  prompt: (options: { sessionId: string; text: string }) => ipcRenderer.invoke('acp:prompt', options),
  cancel: (sessionId?: string) => ipcRenderer.invoke('acp:cancel', sessionId),
  setMode: (options: { sessionId: string; modeId: string }) => ipcRenderer.invoke('acp:set-mode', options),
  setModel: (options: { sessionId: string; modelId: string }) => ipcRenderer.invoke('acp:set-model', options),
  respondPermission: (options: { requestId: string; optionId: string }) =>
    ipcRenderer.invoke('acp:permission-response', options),
  runCommand: (options: { command: string; cwd?: string }) => ipcRenderer.invoke('terminal:execute', options),
  killCommand: (terminalId: string) => ipcRenderer.invoke('terminal:kill', terminalId),
  openExternal: (url: string) => ipcRenderer.invoke('app:open-external', url),
  on: (channel: string, callback: (payload: unknown) => void) => {
    if (!eventChannels.has(channel)) throw new Error(`Kênh sự kiện không hợp lệ: ${channel}`)
    const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
