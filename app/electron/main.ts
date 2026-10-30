import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable, Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import {
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  type CreateTerminalRequest,
  type ReadTextFileRequest,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type TerminalOutputRequest,
  type WaitForTerminalExitRequest,
  type WriteTextFileRequest,
} from '@zed-industries/agent-client-protocol'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
let mainWindow: BrowserWindow | null = null
let workspace = process.cwd()
let agentProcess: ChildProcessWithoutNullStreams | null = null
let connection: ClientSideConnection | null = null
let activeSessionId: string | null = null

type PermissionResolver = (response: RequestPermissionResponse) => void
const pendingPermissions = new Map<string, PermissionResolver>()

type TerminalRecord = {
  child: ChildProcessWithoutNullStreams
  output: string
  truncated: boolean
  exitCode?: number
  signal?: string
  limit: number
}
const terminals = new Map<string, TerminalRecord>()

function send(channel: string, payload: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

function resolveInWorkspace(inputPath: string) {
  const resolved = path.resolve(inputPath)
  const relative = path.relative(workspace, resolved)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Đường dẫn nằm ngoài workspace đã chọn.')
  }
  return resolved
}

function appendTerminalOutput(id: string, chunk: string) {
  const terminal = terminals.get(id)
  if (!terminal) return
  terminal.output += chunk
  const excess = terminal.output.length - terminal.limit
  if (excess > 0) {
    terminal.output = terminal.output.slice(excess)
    terminal.truncated = true
  }
  send('terminal:output', { terminalId: id, chunk, ...terminalStatus(terminal) })
}

function terminalStatus(terminal: TerminalRecord) {
  return {
    output: terminal.output,
    truncated: terminal.truncated,
    exitCode: terminal.exitCode,
    signal: terminal.signal,
  }
}

function launchTerminal(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  outputByteLimit = 200_000,
  useShell = process.platform === 'win32',
) {
  const terminalId = randomUUID()
  const child = spawn(command, args, {
    cwd: resolveInWorkspace(cwd),
    env: { ...process.env, ...env },
    shell: useShell,
    windowsHide: true,
  }) as ChildProcessWithoutNullStreams
  const record: TerminalRecord = {
    child,
    output: '',
    truncated: false,
    limit: Math.max(1024, outputByteLimit),
  }
  terminals.set(terminalId, record)
  child.stdout.on('data', (data) => appendTerminalOutput(terminalId, data.toString()))
  child.stderr.on('data', (data) => appendTerminalOutput(terminalId, data.toString()))
  child.on('error', (error) => appendTerminalOutput(terminalId, `\n${error.message}\n`))
  child.on('close', (code, signal) => {
    record.exitCode = code ?? undefined
    record.signal = signal ?? undefined
    send('terminal:output', {
      terminalId,
      chunk: '',
      ...terminalStatus(record),
    })
  })
  return { terminalId, record }
}

function makeAcpClient() {
  return {
    async sessionUpdate(params: SessionNotification) {
      send('acp:update', params)
    },
    async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
      const requestId = randomUUID()
      send('acp:permission', { requestId, ...params })
      return new Promise<RequestPermissionResponse>((resolve) => {
        pendingPermissions.set(requestId, resolve)
      })
    },
    async readTextFile(params: ReadTextFileRequest) {
      const content = await fs.readFile(resolveInWorkspace(params.path), 'utf8')
      if (params.line || params.limit) {
        const lines = content.split(/\r?\n/)
        const start = Math.max(0, (params.line ?? 1) - 1)
        const end = params.limit ? start + params.limit : undefined
        return { content: lines.slice(start, end).join('\n') }
      }
      return { content }
    },
    async writeTextFile(params: WriteTextFileRequest) {
      const filePath = resolveInWorkspace(params.path)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, params.content, 'utf8')
      return {}
    },
    async createTerminal(params: CreateTerminalRequest) {
      const env = Object.fromEntries((params.env ?? []).map((item) => [item.name, item.value]))
      const { terminalId } = launchTerminal(
        params.command,
        params.args ?? [],
        params.cwd ?? workspace,
        env,
        params.outputByteLimit ?? 200_000,
      )
      return { terminalId }
    },
    async terminalOutput(params: TerminalOutputRequest) {
      const terminal = terminals.get(params.terminalId)
      if (!terminal) throw new Error('Terminal không tồn tại.')
      return terminalStatus(terminal)
    },
    async waitForTerminalExit(params: WaitForTerminalExitRequest) {
      const terminal = terminals.get(params.terminalId)
      if (!terminal) throw new Error('Terminal không tồn tại.')
      if (terminal.exitCode !== undefined || terminal.signal) {
        return { exitCode: terminal.exitCode, signal: terminal.signal }
      }
      return new Promise<{ exitCode?: number; signal?: string }>((resolve) => {
        terminal.child.once('close', (code, signal) => {
          resolve({ exitCode: code ?? undefined, signal: signal ?? undefined })
        })
      })
    },
    async killTerminal({ terminalId }: { terminalId: string }) {
      terminals.get(terminalId)?.child.kill()
      return {}
    },
    async releaseTerminal({ terminalId }: { terminalId: string }) {
      const terminal = terminals.get(terminalId)
      terminal?.child.kill()
      terminals.delete(terminalId)
      return {}
    },
  }
}

async function stopAgent() {
  for (const resolve of pendingPermissions.values()) {
    resolve({ outcome: { outcome: 'cancelled' } })
  }
  pendingPermissions.clear()
  connection = null
  activeSessionId = null
  agentProcess?.kill()
  agentProcess = null
}

async function connectAgent(cwd: string, cliPath?: string) {
  await stopAgent()
  workspace = path.resolve(cwd)
  const stat = await fs.stat(workspace)
  if (!stat.isDirectory()) throw new Error('Workspace phải là một thư mục.')

  const command = cliPath?.trim() || (process.platform === 'win32' ? 'gemini.cmd' : 'gemini')
  const child = spawn(command, ['--acp'], {
    cwd: workspace,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  }) as ChildProcessWithoutNullStreams
  agentProcess = child

  child.stderr.on('data', (data) => {
    send('acp:status', { state: 'log', message: data.toString() })
  })
  child.on('error', (error) => {
    send('acp:status', { state: 'error', message: error.message })
  })
  child.on('close', (code) => {
    if (agentProcess === child) {
      agentProcess = null
      connection = null
      send('acp:status', { state: 'closed', message: `Gemini CLI đã đóng (mã ${code ?? '—'}).` })
    }
  })

  const stream = ndJsonStream(
    Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
    Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
  )
  connection = new ClientSideConnection(() => makeAcpClient(), stream)
  const initialized = await connection.initialize({
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: {
      fs: { readTextFile: true, writeTextFile: true },
      terminal: true,
    },
  })
  return initialized
}

async function startAgent(cwd: string, cliPath?: string) {
  const initialized = await connectAgent(cwd, cliPath)
  const session = await requireConnection().newSession({ cwd: workspace, mcpServers: [] })
  activeSessionId = session.sessionId
  send('acp:status', { state: 'ready', message: 'Gemini CLI đã sẵn sàng.' })
  return { ...session, agentCapabilities: initialized.agentCapabilities, cwd: workspace }
}

function requireConnection() {
  if (!connection) throw new Error('Chưa kết nối Gemini CLI. Hãy mở workspace và bắt đầu phiên.')
  return connection
}

function registerIpc() {
  ipcMain.handle('desktop:get-info', () => ({
    isDesktop: true,
    platform: process.platform,
    workspace,
    versions: { electron: process.versions.electron, node: process.versions.node },
  }))
  ipcMain.handle('workspace:select', async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Chọn thư mục dự án',
      defaultPath: workspace,
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) return null
    workspace = result.filePaths[0]
    return workspace
  })
  ipcMain.handle('workspace:list', async (_event, relativePath = '') => {
    const directory = resolveInWorkspace(path.join(workspace, relativePath))
    const entries = await fs.readdir(directory, { withFileTypes: true })
    return entries
      .filter((entry) => !['node_modules', '.git', 'dist-electron'].includes(entry.name))
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
      .slice(0, 300)
      .map((entry) => ({
        name: entry.name,
        path: `${relativePath ? relativePath.replace(/[\\/]+$/, '') + '/' : ''}${entry.name}`,
        type: entry.isDirectory() ? 'directory' : 'file',
      }))
  })
  ipcMain.handle('workspace:read', async (_event, relativePath: string) => {
    const content = await fs.readFile(resolveInWorkspace(path.join(workspace, relativePath)), 'utf8')
    return content.length > 250_000 ? `${content.slice(0, 250_000)}\n… đã rút gọn …` : content
  })
  ipcMain.handle('acp:start', (_event, options: { cwd: string; cliPath?: string }) =>
    startAgent(options.cwd, options.cliPath),
  )
  ipcMain.handle('acp:load', async (_event, options: { sessionId: string; cwd: string; cliPath?: string }) => {
    if (!connection || workspace !== path.resolve(options.cwd)) {
      await connectAgent(options.cwd, options.cliPath)
    }
    const result = await requireConnection().loadSession({
      sessionId: options.sessionId,
      cwd: workspace,
      mcpServers: [],
    })
    activeSessionId = options.sessionId
    return result
  })
  ipcMain.handle('acp:prompt', async (_event, options: { sessionId: string; text: string }) => {
    if (!options.text.trim()) throw new Error('Prompt không được để trống.')
    activeSessionId = options.sessionId
    return requireConnection().prompt({
      sessionId: options.sessionId,
      prompt: [{ type: 'text', text: options.text }],
    })
  })
  ipcMain.handle('acp:cancel', async (_event, sessionId?: string) => {
    const id = sessionId ?? activeSessionId
    if (!id) return
    for (const resolve of pendingPermissions.values()) resolve({ outcome: { outcome: 'cancelled' } })
    pendingPermissions.clear()
    await requireConnection().cancel({ sessionId: id })
  })
  ipcMain.handle('acp:set-mode', (_event, options: { sessionId: string; modeId: string }) =>
    requireConnection().setSessionMode(options),
  )
  ipcMain.handle('acp:set-model', (_event, options: { sessionId: string; modelId: string }) =>
    requireConnection().setSessionModel(options),
  )
  ipcMain.handle('acp:permission-response', (_event, options: { requestId: string; optionId: string }) => {
    const resolve = pendingPermissions.get(options.requestId)
    if (!resolve) return false
    pendingPermissions.delete(options.requestId)
    resolve({ outcome: { outcome: 'selected', optionId: options.optionId } })
    return true
  })
  ipcMain.handle('terminal:execute', (_event, options: { command: string; cwd?: string }) => {
    const shellCommand = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : '/bin/sh'
    const args = process.platform === 'win32' ? ['/d', '/s', '/c', options.command] : ['-lc', options.command]
    const { terminalId } = launchTerminal(shellCommand, args, options.cwd ?? workspace, {}, 200_000, false)
    return { terminalId }
  })
  ipcMain.handle('terminal:kill', (_event, terminalId: string) => {
    terminals.get(terminalId)?.child.kill()
  })
  ipcMain.handle('app:open-external', async (_event, url: string) => {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') throw new Error('Chỉ cho phép mở liên kết HTTPS.')
    await shell.openExternal(url)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 360,
    minHeight: 640,
    backgroundColor: '#111211',
    title: 'Gemini Desk',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  } else {
    void mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  void stopAgent()
  for (const terminal of terminals.values()) terminal.child.kill()
  if (process.platform !== 'darwin') app.quit()
})
