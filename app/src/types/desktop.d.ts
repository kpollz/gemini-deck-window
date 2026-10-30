export type DesktopApi = {
  isDesktop: true
  getInfo: () => Promise<{ isDesktop: boolean; platform: string; workspace: string; versions: Record<string, string> }>
  selectWorkspace: () => Promise<string | null>
  listFiles: (path?: string) => Promise<Array<{ name: string; path: string; type: 'file' | 'directory' }>>
  readFile: (path: string) => Promise<string>
  startSession: (options: { cwd: string; cliPath?: string }) => Promise<AcpSession>
  loadSession: (options: { sessionId: string; cwd: string; cliPath?: string }) => Promise<unknown>
  prompt: (options: { sessionId: string; text: string }) => Promise<{ stopReason: string }>
  cancel: (sessionId?: string) => Promise<void>
  setMode: (options: { sessionId: string; modeId: string }) => Promise<unknown>
  setModel: (options: { sessionId: string; modelId: string }) => Promise<unknown>
  respondPermission: (options: { requestId: string; optionId: string }) => Promise<boolean>
  runCommand: (options: { command: string; cwd?: string }) => Promise<{ terminalId: string }>
  killCommand: (terminalId: string) => Promise<void>
  openExternal: (url: string) => Promise<void>
  // ACP payloads are narrowed by each event subscriber in App.tsx.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (channel: string, callback: (payload: any) => void) => () => void
}

export type AcpSession = {
  sessionId: string
  cwd: string
  modes?: {
    currentModeId: string
    availableModes: Array<{ id: string; name: string; description?: string | null }>
  } | null
  models?: {
    currentModelId: string
    availableModels: Array<{ modelId: string; name: string; description?: string | null }>
  } | null
}

declare global {
  interface Window {
    geminiDesktop?: DesktopApi
  }
}

export {}
