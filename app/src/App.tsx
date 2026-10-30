import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { SessionSidebar } from '@/components/SessionSidebar'
import { ChatPanel, type SelectOption } from '@/components/ChatPanel'
import { WorkspacePanel, type InspectorTab, type TerminalLine } from '@/components/WorkspacePanel'
import { CommandPalette, SettingsDialog, type AppSettings, type CommandItem } from '@/components/AppDialogs'
import { IconButton } from '@/components/AppChrome'
import { demoChanges, demoFiles, demoMessages, demoPermission, demoSessions, demoSrcFiles } from '@/data/demo'
import type { AcpSession } from '@/types/desktop'
import type { ChangeItem, ChatMessage, DiffContent, FileEntry, PermissionRequest, SessionItem } from '@/types/workspace'

const defaultModels: SelectOption[] = [
  { id: 'gemini-3-pro', name: 'Gemini 3 Pro' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash' },
]
const defaultModes: SelectOption[] = [
  { id: 'default', name: 'Hỏi quyền' },
  { id: 'auto_edit', name: 'Tự động sửa' },
  { id: 'plan', name: 'Plan' },
]
const defaultSettings: AppSettings = { cliPath: '', saveHistory: true, compactTools: true, defaultMode: 'default' }

function now() {
  return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
function uid(prefix = 'id') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
function projectName(cwd: string) { return cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd }
function loadSettings(): AppSettings {
  try { return { ...defaultSettings, ...JSON.parse(localStorage.getItem('gemini-desk-settings') ?? '{}') } }
  catch { return defaultSettings }
}
function loadSessions(): SessionItem[] {
  try { return JSON.parse(localStorage.getItem('gemini-desk-sessions') ?? '[]') }
  catch { return [] }
}
function extractDiffs(content: unknown): DiffContent[] {
  if (!Array.isArray(content)) return []
  return content.filter((item) => item?.type === 'diff' && typeof item.path === 'string').map((item) => ({
    path: item.path,
    oldText: typeof item.oldText === 'string' ? item.oldText : '',
    newText: typeof item.newText === 'string' ? item.newText : '',
  }))
}
function changeFromDiff(diff: DiffContent): ChangeItem {
  const oldLines = (diff.oldText ?? '').split('\n').filter(Boolean).length
  const newLines = diff.newText.split('\n').filter(Boolean).length
  return {
    path: diff.path,
    additions: newLines,
    deletions: oldLines,
    status: !diff.oldText ? 'added' : !diff.newText ? 'deleted' : 'modified',
    oldText: diff.oldText ?? '',
    newText: diff.newText,
  }
}

export default function App() {
  const desktop = window.geminiDesktop
  const isDesktop = Boolean(desktop)
  const [settings, setSettings] = useState<AppSettings>(loadSettings)
  const [sessions, setSessions] = useState<SessionItem[]>(() => isDesktop ? loadSessions() : demoSessions)
  const [activeSessionId, setActiveSessionId] = useState(() => isDesktop ? (loadSessions()[0]?.id ?? '') : 'demo-auth')
  const [messages, setMessages] = useState<ChatMessage[]>(() => isDesktop ? [] : demoMessages)
  const [changes, setChanges] = useState<ChangeItem[]>(() => isDesktop ? [] : demoChanges)
  const [permission, setPermission] = useState<PermissionRequest | null>(() => isDesktop ? null : demoPermission)
  const [workspaceName, setWorkspaceName] = useState(isDesktop ? 'Chưa mở dự án' : 'orbit-dashboard')
  const [workspacePath, setWorkspacePath] = useState(isDesktop ? '' : 'C:\\dev\\orbit-dashboard')
  const [connected, setConnected] = useState(!isDesktop)
  const [connecting, setConnecting] = useState(false)
  const [sending, setSending] = useState(false)
  const [models, setModels] = useState<SelectOption[]>(defaultModels)
  const [modes, setModes] = useState<SelectOption[]>(defaultModes)
  const [model, setModel] = useState(defaultModels[0].id)
  const [mode, setMode] = useState(settings.defaultMode)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('changes')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [commandsOpen, setCommandsOpen] = useState(false)
  const [files, setFiles] = useState<FileEntry[]>(() => isDesktop ? [] : demoFiles)
  const [filePath, setFilePath] = useState('')
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string }>()
  const [filesLoading, setFilesLoading] = useState(false)
  const [composerPrefill, setComposerPrefill] = useState('')
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { id: 'welcome', text: isDesktop ? 'Gemini Desk terminal · lệnh chạy trong workspace đã chọn.' : 'PS C:\\dev\\orbit-dashboard> npm test -- session.test.ts', tone: 'muted' },
    ...(!isDesktop ? [
      { id: 'test-1', text: 'PASS tests/auth/session.test.ts (3 tests)', tone: undefined },
      { id: 'test-2', text: 'Test Suites: 1 passed, 1 total · Time: 1.84s', tone: 'muted' as const },
    ] : []),
  ])
  const [terminalRunning, setTerminalRunning] = useState(false)
  const [toast, setToast] = useState<{ id: string; message: string } | null>(null)
  const streamMessageRef = useRef<string | null>(null)
  const thoughtMessageRef = useRef<string | null>(null)
  const terminalIdRef = useRef<string | null>(null)
  const demoTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const notify = useCallback((message: string) => {
    const id = uid('toast')
    setToast({ id, message })
    setTimeout(() => setToast((current) => current?.id === id ? null : current), 3200)
  }, [])

  const addChanges = useCallback((diffs: DiffContent[]) => {
    if (!diffs.length) return
    setChanges((current) => {
      const next = [...current]
      for (const diff of diffs) {
        const index = next.findIndex((item) => item.path === diff.path)
        const change = changeFromDiff(diff)
        if (index >= 0) next[index] = change
        else next.push(change)
      }
      return next
    })
  }, [])

  useEffect(() => {
    localStorage.setItem('gemini-desk-settings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (isDesktop && settings.saveHistory) localStorage.setItem('gemini-desk-sessions', JSON.stringify(sessions.slice(0, 30)))
  }, [sessions, isDesktop, settings.saveHistory])

  useEffect(() => {
    if (!desktop) return
    const offUpdate = desktop.on('acp:update', (notification) => {
      const update = notification.update
      if (!update) return
      if (update.sessionUpdate === 'agent_message_chunk' && update.content?.type === 'text') {
        const text = update.content.text as string
        setMessages((current) => {
          if (streamMessageRef.current) {
            return current.map((message) => message.id === streamMessageRef.current ? { ...message, content: message.content + text, streaming: true } : message)
          }
          const id = uid('assistant')
          streamMessageRef.current = id
          return [...current, { id, role: 'assistant', content: text, time: now(), streaming: true }]
        })
      } else if (update.sessionUpdate === 'agent_thought_chunk' && update.content?.type === 'text') {
        const text = update.content.text as string
        setMessages((current) => {
          if (thoughtMessageRef.current) return current.map((message) => message.id === thoughtMessageRef.current ? { ...message, content: message.content + text } : message)
          const id = uid('thought')
          thoughtMessageRef.current = id
          return [...current, { id, role: 'thought', content: text, time: now() }]
        })
      } else if (update.sessionUpdate === 'tool_call') {
        const diffs = extractDiffs(update.content)
        addChanges(diffs)
        setMessages((current) => [...current, {
          id: update.toolCallId, role: 'tool', content: update.title ?? 'Công cụ', time: now(),
          tool: {
            toolCallId: update.toolCallId, title: update.title ?? 'Công cụ', kind: update.kind,
            status: update.status ?? 'pending', locations: update.locations ?? [], diffs,
          },
        }])
      } else if (update.sessionUpdate === 'tool_call_update') {
        const diffs = extractDiffs(update.content)
        addChanges(diffs)
        setMessages((current) => current.map((message) => {
          if (message.tool?.toolCallId !== update.toolCallId) return message
          const tool = message.tool!
          return {
            ...message,
            tool: { ...tool, title: update.title ?? tool.title, status: update.status ?? tool.status, diffs: diffs.length ? diffs : tool.diffs },
          }
        }))
      } else if (update.sessionUpdate === 'plan') {
        setMessages((current) => {
          const id = `plan-${notification.sessionId}`
          const plan = update.entries ?? []
          const existing = current.find((message) => message.id === id)
          if (existing) return current.map((message) => message.id === id ? { ...message, plan } : message)
          return [...current, { id, role: 'plan', content: '', time: now(), plan }]
        })
      } else if (update.sessionUpdate === 'current_mode_update') {
        setMode(update.currentModeId)
      }
    })
    const offPermission = desktop.on('acp:permission', (request: PermissionRequest) => setPermission(request))
    const offStatus = desktop.on('acp:status', (status) => {
      if (status.state === 'ready') setConnected(true)
      if (status.state === 'closed' || status.state === 'error') {
        setConnected(false)
        setSending(false)
        setConnecting(false)
        notify(status.message ?? 'Kết nối Gemini CLI đã đóng.')
      }
    })
    const offTerminal = desktop.on('terminal:output', (event) => {
      if (event.terminalId !== terminalIdRef.current) return
      if (event.chunk) setTerminalLines((current) => [...current, { id: uid('output'), text: event.chunk }])
      if (event.exitCode !== undefined || event.signal) {
        setTerminalRunning(false)
        setTerminalLines((current) => [...current, { id: uid('exit'), text: `[tiến trình kết thúc · mã ${event.exitCode ?? event.signal}]`, tone: 'muted' }])
      }
    })
    return () => { offUpdate(); offPermission(); offStatus(); offTerminal() }
  }, [desktop, addChanges, notify])

  const openInspector = useCallback((tab: InspectorTab = 'changes') => {
    setInspectorTab(tab)
    setInspectorOpen(true)
  }, [])

  const startRealSession = useCallback(async (cwd: string) => {
    if (!desktop) return
    setConnecting(true)
    setPermission(null)
    try {
      const session: AcpSession = await desktop.startSession({ cwd, cliPath: settings.cliPath || undefined })
      setWorkspacePath(cwd)
      setWorkspaceName(projectName(cwd))
      setActiveSessionId(session.sessionId)
      setMessages([])
      setChanges([])
      setConnected(true)
      streamMessageRef.current = null
      thoughtMessageRef.current = null
      if (session.models?.availableModels.length) {
        setModels(session.models.availableModels.map((item) => ({ id: item.modelId, name: item.name })))
        setModel(session.models.currentModelId)
      }
      if (session.modes?.availableModes.length) {
        setModes(session.modes.availableModes.map((item) => ({ id: item.id, name: item.name })))
        setMode(session.modes.currentModeId)
      }
      setSessions((current) => [
        { id: session.sessionId, title: 'Phiên mới', preview: cwd, updatedAt: 'Bây giờ', cwd },
        ...current.filter((item) => item.id !== session.sessionId),
      ])
      setFilesLoading(true)
      const entries = await desktop.listFiles('')
      setFiles(entries)
      notify('Đã kết nối Gemini CLI qua ACP.')
    } catch (error) {
      setConnected(false)
      notify(`Không thể khởi chạy Gemini CLI: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setConnecting(false)
      setFilesLoading(false)
    }
  }, [desktop, settings.cliPath, notify])

  const openProject = useCallback(async () => {
    if (!desktop) {
      notify('Bản xem trước dùng workspace minh họa. Hãy chạy bản Electron để mở dự án thật.')
      return
    }
    const cwd = await desktop.selectWorkspace()
    if (cwd) await startRealSession(cwd)
  }, [desktop, startRealSession, notify])

  const newSession = useCallback(async () => {
    setSidebarOpen(false)
    if (desktop) {
      if (!workspacePath) { await openProject(); return }
      await startRealSession(workspacePath)
      return
    }
    const id = uid('session')
    setActiveSessionId(id)
    setMessages([])
    setChanges([])
    setPermission(null)
    setSessions((current) => [{ id, title: 'Phiên mới', preview: 'Chưa có tin nhắn', updatedAt: 'Bây giờ' }, ...current])
  }, [desktop, workspacePath, openProject, startRealSession])

  const selectSession = useCallback(async (session: SessionItem) => {
    setSidebarOpen(false)
    setActiveSessionId(session.id)
    setPermission(null)
    streamMessageRef.current = null
    thoughtMessageRef.current = null
    if (desktop) {
      if (!session.cwd) return
      setConnecting(true)
      setMessages([])
      try {
        await desktop.loadSession({ sessionId: session.id, cwd: session.cwd, cliPath: settings.cliPath || undefined })
        setWorkspacePath(session.cwd)
        setWorkspaceName(projectName(session.cwd))
        setConnected(true)
      } catch (error) { notify(`Không thể tải phiên: ${error instanceof Error ? error.message : String(error)}`) }
      finally { setConnecting(false) }
      return
    }
    setMessages(session.id === 'demo-auth' ? demoMessages : [{ id: uid('assistant'), role: 'assistant', time: now(), content: `Đã mở lại phiên **${session.title}**. Bạn muốn tiếp tục từ đâu?` }])
    setChanges(session.id === 'demo-auth' ? demoChanges : [])
  }, [desktop, settings.cliPath, notify])

  const sendMessage = useCallback(async (text: string) => {
    if (sending) return
    const userMessage: ChatMessage = { id: uid('user'), role: 'user', content: text, time: now() }
    setMessages((current) => [...current, userMessage])
    setSessions((current) => current.map((session) => session.id === activeSessionId ? {
      ...session,
      title: session.title === 'Phiên mới' ? text.slice(0, 42) : session.title,
      preview: text.slice(0, 64), updatedAt: 'Bây giờ',
    } : session))
    setSending(true)
    streamMessageRef.current = null
    thoughtMessageRef.current = null
    if (desktop) {
      try {
        await desktop.prompt({ sessionId: activeSessionId, text })
      } catch (error) {
        setMessages((current) => [...current, { id: uid('error'), role: 'assistant', content: `Không thể hoàn tất yêu cầu: ${error instanceof Error ? error.message : String(error)}`, time: now() }])
      } finally {
        setSending(false)
        setMessages((current) => current.map((message) => ({ ...message, streaming: false })))
      }
      return
    }
    const thoughtId = uid('thought')
    const responseId = uid('assistant')
    demoTimersRef.current.push(setTimeout(() => {
      setMessages((current) => [...current, { id: thoughtId, role: 'thought', content: 'Mình sẽ kiểm tra các file liên quan, khoanh vùng nguyên nhân rồi mới đề xuất thay đổi.', time: now() }])
    }, 350))
    demoTimersRef.current.push(setTimeout(() => {
      setMessages((current) => [...current, { id: responseId, role: 'assistant', content: '', time: now(), streaming: true }])
    }, 650))
    demoTimersRef.current.push(setTimeout(() => {
      setMessages((current) => current.map((message) => message.id === responseId ? {
        ...message,
        content: `Mình đã tiếp nhận yêu cầu: **${text.slice(0, 90)}**.\n\nTrong bản desktop, yêu cầu này sẽ được gửi trực tiếp tới Gemini CLI qua ACP. Bản xem trước này chỉ mô phỏng streaming; bạn vẫn có thể thử duyệt công cụ, xem diff, mở file và chạy terminal minh họa.`,
        streaming: false,
      } : message))
      setSending(false)
    }, 1450))
  }, [sending, desktop, activeSessionId])

  const stopSending = useCallback(async () => {
    demoTimersRef.current.forEach(clearTimeout)
    demoTimersRef.current = []
    if (desktop) await desktop.cancel(activeSessionId)
    setSending(false)
    setMessages((current) => current.map((message) => ({ ...message, streaming: false })))
    notify('Đã dừng tác vụ hiện tại.')
  }, [desktop, activeSessionId, notify])

  const resolvePermission = useCallback(async (optionId: string) => {
    if (!permission || !optionId) { setPermission(null); return }
    const rejected = permission.options.find((item) => item.optionId === optionId)?.kind.startsWith('reject')
    if (desktop) await desktop.respondPermission({ requestId: permission.requestId, optionId })
    setPermission(null)
    if (!desktop) {
      const toolId = uid('tool')
      setMessages((current) => [...current, { id: toolId, role: 'tool', content: 'npm test -- session.test.ts', time: now(), tool: { toolCallId: toolId, title: 'Chạy test auth session', kind: 'execute', status: rejected ? 'failed' : 'in_progress' } }])
      if (!rejected) setTimeout(() => setMessages((current) => current.map((message) => message.id === toolId ? { ...message, tool: { ...message.tool!, status: 'completed' } } : message)), 900)
    }
    notify(rejected ? 'Đã từ chối yêu cầu thực thi.' : 'Đã gửi lựa chọn cho Gemini CLI.')
  }, [permission, desktop, notify])

  const changeModel = async (id: string) => {
    setModel(id)
    if (desktop && activeSessionId) {
      try { await desktop.setModel({ sessionId: activeSessionId, modelId: id }) }
      catch (error) { notify(`Không thể đổi model: ${error instanceof Error ? error.message : String(error)}`) }
    }
  }
  const changeMode = async (id: string) => {
    setMode(id)
    if (desktop && activeSessionId) {
      try { await desktop.setMode({ sessionId: activeSessionId, modeId: id }) }
      catch (error) { notify(`Không thể đổi chế độ: ${error instanceof Error ? error.message : String(error)}`) }
    }
  }

  const navigateFiles = useCallback(async (path: string) => {
    setSelectedFile(undefined)
    setFilePath(path)
    if (!desktop) { setFiles(path === 'src' ? demoSrcFiles : path ? [] : demoFiles); return }
    setFilesLoading(true)
    try { setFiles(await desktop.listFiles(path)) }
    catch (error) { notify(`Không thể đọc thư mục: ${error instanceof Error ? error.message : String(error)}`) }
    finally { setFilesLoading(false) }
  }, [desktop, notify])

  const readFile = useCallback(async (path: string) => {
    if (!desktop) {
      setSelectedFile({ path, content: path.endsWith('package.json') ? '{\n  "name": "orbit-dashboard",\n  "private": true,\n  "scripts": {\n    "dev": "vite",\n    "test": "vitest"\n  }\n}' : `// ${path}\n// Nội dung minh họa trong bản xem trước.\nexport const ready = true\n` })
      return
    }
    try { setSelectedFile({ path, content: await desktop.readFile(path) }) }
    catch (error) { notify(`Không thể đọc file: ${error instanceof Error ? error.message : String(error)}`) }
  }, [desktop, notify])

  const runCommand = useCallback(async (command: string) => {
    setTerminalLines((current) => [...current, { id: uid('command'), text: `› ${command}`, tone: 'command' }])
    setTerminalRunning(true)
    if (desktop) {
      try {
        const result = await desktop.runCommand({ command, cwd: workspacePath || undefined })
        terminalIdRef.current = result.terminalId
      } catch (error) {
        setTerminalLines((current) => [...current, { id: uid('error'), text: String(error), tone: 'error' }])
        setTerminalRunning(false)
      }
      return
    }
    setTimeout(() => {
      const output = command === 'git status'
        ? 'On branch main\nChanges not staged for commit:\n  modified:   src/stores/auth.store.ts\n  modified:   src/lib/api.ts\n  new file:   tests/auth/session.test.ts'
        : command.startsWith('npm test')
          ? 'PASS tests/auth/session.test.ts\nTest Suites: 1 passed, 1 total\nTests: 3 passed, 3 total'
          : command === 'dir' || command === 'ls'
            ? 'src  tests  package.json  vite.config.ts  GEMINI.md'
            : `Đã mô phỏng lệnh: ${command}\nChạy bản Electron để thực thi lệnh thật trong workspace.`
      setTerminalLines((current) => [...current, { id: uid('output'), text: output }])
      setTerminalRunning(false)
    }, 700)
  }, [desktop, workspacePath])

  const commands: CommandItem[] = [
    { id: 'new', label: 'Tạo phiên mới', hint: 'Ctrl N', icon: 'new', action: () => void newSession() },
    { id: 'project', label: 'Mở thư mục dự án', hint: 'Workspace', icon: 'folder', action: () => void openProject() },
    { id: 'changes', label: 'Xem thay đổi và diff', hint: `${changes.length} file`, icon: 'diff', action: () => openInspector('changes') },
    { id: 'terminal', label: 'Mở terminal', hint: 'Shell', icon: 'terminal', action: () => openInspector('terminal') },
    { id: 'settings', label: 'Mở cài đặt', hint: 'Ctrl ,', icon: 'settings', action: () => setSettingsOpen(true) },
  ]

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandsOpen((value) => !value) }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') { event.preventDefault(); void newSession() }
      if ((event.ctrlKey || event.metaKey) && event.key === ',') { event.preventDefault(); setSettingsOpen(true) }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [newSession])

  return (
    <div className="app-shell">
      <SessionSidebar
        sessions={sessions} activeSessionId={activeSessionId} workspaceName={workspaceName} workspacePath={workspacePath || 'Chọn thư mục dự án'}
        connected={connected} isDesktop={isDesktop} open={sidebarOpen} onClose={() => setSidebarOpen(false)}
        onSelect={(session) => void selectSession(session)} onNew={() => void newSession()} onOpenProject={() => void openProject()} onSettings={() => setSettingsOpen(true)}
      />
      <ChatPanel
        messages={messages} sending={sending || connecting} permission={permission} isDesktop={isDesktop} connected={connected}
        workspaceName={workspaceName} models={models} modes={modes} model={model} mode={mode}
        onModel={(id) => void changeModel(id)} onMode={(id) => void changeMode(id)} onSend={(text) => void sendMessage(text)} onStop={() => void stopSending()}
        onPermission={(optionId) => void resolvePermission(optionId)} onOpenSessions={() => setSidebarOpen(true)} onOpenWorkspace={() => openInspector('changes')} onOpenInspector={openInspector}
        onOpenProject={() => void openProject()} prefill={composerPrefill}
      />
      <WorkspacePanel
        open={inspectorOpen} onClose={() => setInspectorOpen(false)} tab={inspectorTab} onTab={setInspectorTab} changes={changes}
        files={files} filePath={filePath} selectedFile={selectedFile} filesLoading={filesLoading} terminalLines={terminalLines} terminalRunning={terminalRunning}
        onSelectChange={() => undefined} onNavigate={(path) => void navigateFiles(path)} onReadFile={(path) => void readFile(path)}
        onMention={(path) => { setComposerPrefill(`@${path} `); setInspectorOpen(false); notify(`Đã thêm @${path} vào ô nhập.`) }}
        onRefreshFiles={() => void navigateFiles(filePath)} onCommand={(command) => void runCommand(command)}
        onClearTerminal={() => setTerminalLines([])} onStopTerminal={() => { if (desktop && terminalIdRef.current) void desktop.killCommand(terminalIdRef.current); setTerminalRunning(false) }}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onSave={(next) => { setSettings(next); setMode(next.defaultMode); notify('Đã lưu cài đặt trên thiết bị.') }} />
      <CommandPalette open={commandsOpen} onClose={() => setCommandsOpen(false)} commands={commands} />
      {toast && <div className="app-toast" role="status"><CheckCircle2 size={16} /><span>{toast.message}</span><IconButton title="Đóng thông báo" onClick={() => setToast(null)}><X size={14} /></IconButton></div>}
    </div>
  )
}
