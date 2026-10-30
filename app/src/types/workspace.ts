export type ToolStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export type DiffContent = {
  path: string
  oldText?: string | null
  newText: string
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'plan' | 'thought'
  content: string
  time: string
  streaming?: boolean
  tool?: {
    toolCallId: string
    title: string
    kind?: string
    status: ToolStatus
    locations?: Array<{ path: string; line?: number | null }>
    diffs?: DiffContent[]
  }
  plan?: Array<{ content: string; status: 'pending' | 'in_progress' | 'completed'; priority?: string }>
}

export type SessionItem = {
  id: string
  title: string
  preview: string
  updatedAt: string
  cwd?: string
  active?: boolean
}

export type ChangeItem = {
  path: string
  additions: number
  deletions: number
  status: 'modified' | 'added' | 'deleted'
  oldText?: string
  newText: string
}

export type PermissionRequest = {
  requestId: string
  sessionId: string
  options: Array<{ optionId: string; name: string; kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always' }>
  toolCall: {
    toolCallId?: string
    title?: string
    kind?: string
    content?: unknown[]
    locations?: Array<{ path: string }>
  }
}

export type FileEntry = { name: string; path: string; type: 'file' | 'directory' }
