import type { ChangeItem, ChatMessage, FileEntry, SessionItem } from '@/types/workspace'

export const demoSessions: SessionItem[] = [
  { id: 'demo-auth', title: 'Tối ưu luồng xác thực', preview: 'Thêm refresh token và xử lý…', updatedAt: 'Bây giờ', active: true },
  { id: 'demo-responsive', title: 'Sửa lỗi responsive', preview: 'Kiểm tra breakpoint 375px', updatedAt: '10:24' },
  { id: 'demo-api', title: 'Refactor API client', preview: 'Gộp retry và timeout chung', updatedAt: 'Hôm qua' },
  { id: 'demo-tests', title: 'Bổ sung integration test', preview: 'Auth guard và session store', updatedAt: 'T3' },
]

export const demoMessages: ChatMessage[] = [
  {
    id: 'm1', role: 'user', time: '10:42',
    content: 'Luồng đăng nhập hiện tại bị hết hạn phiên sau khi reload. Hãy kiểm tra và sửa, nhớ chạy test liên quan.',
  },
  {
    id: 'm2', role: 'thought', time: '10:42',
    content: 'Mình sẽ lần theo vòng đời của access token và middleware bảo vệ route.',
  },
  {
    id: 'm3', role: 'plan', time: '10:42', content: '',
    plan: [
      { content: 'Đọc auth store và API client', status: 'completed' },
      { content: 'Sửa refresh token khi khôi phục phiên', status: 'completed' },
      { content: 'Chạy test và kiểm tra diff', status: 'in_progress' },
    ],
  },
  {
    id: 'm4', role: 'tool', time: '10:43', content: 'Đã tìm thấy nguyên nhân trong auth.store.ts',
    tool: {
      toolCallId: 'tool-read', title: 'Đọc src/stores/auth.store.ts', kind: 'read', status: 'completed',
      locations: [{ path: 'src/stores/auth.store.ts', line: 48 }],
    },
  },
  {
    id: 'm5', role: 'assistant', time: '10:44',
    content: 'Nguyên nhân là `restoreSession()` chỉ đọc access token cũ mà không kiểm tra thời điểm hết hạn. Mình đã chuyển sang khôi phục bằng refresh token và cập nhật request interceptor.\n\n**Thay đổi chính:**\n- Làm mới token trước khi hydrate store.\n- Tránh gọi refresh song song bằng promise dùng chung.\n- Xóa session nếu refresh token không còn hợp lệ.',
  },
  {
    id: 'm6', role: 'tool', time: '10:44', content: 'Cập nhật 2 file · +38 −12',
    tool: {
      toolCallId: 'tool-edit', title: 'Chỉnh sửa auth store và API client', kind: 'edit', status: 'completed',
      locations: [{ path: 'src/stores/auth.store.ts' }, { path: 'src/lib/api.ts' }],
      diffs: [{ path: 'src/stores/auth.store.ts', oldText: 'set({ user, token })', newText: 'await refreshBeforeHydrate()\nset({ user, token })' }],
    },
  },
]

export const demoChanges: ChangeItem[] = [
  {
    path: 'src/stores/auth.store.ts', additions: 24, deletions: 8, status: 'modified',
    oldText: `export async function restoreSession() {\n  const session = readStorage()\n  if (!session) return null\n  set({ user: session.user, token: session.token })\n  return session\n}`,
    newText: `let refreshPromise: Promise<Session> | null = null\n\nexport async function restoreSession() {\n  const session = readStorage()\n  if (!session?.refreshToken) return null\n  refreshPromise ??= refreshSession(session)\n  const next = await refreshPromise.finally(() => {\n    refreshPromise = null\n  })\n  set({ user: next.user, token: next.token })\n  return next\n}`,
  },
  {
    path: 'src/lib/api.ts', additions: 14, deletions: 4, status: 'modified',
    oldText: `client.interceptors.request.use((config) => {\n  config.headers.Authorization = \`Bearer \${token}\`\n  return config\n})`,
    newText: `client.interceptors.request.use(async (config) => {\n  const token = await getValidToken()\n  config.headers.Authorization = \`Bearer \${token}\`\n  return config\n})`,
  },
  { path: 'tests/auth/session.test.ts', additions: 46, deletions: 0, status: 'added', newText: `describe('restoreSession', () => {\n  it('refreshes an expired token before hydrating', async () => {\n    // ...\n  })\n})` },
]

export const demoFiles: FileEntry[] = [
  { name: 'src', path: 'src', type: 'directory' },
  { name: 'tests', path: 'tests', type: 'directory' },
  { name: '.env.example', path: '.env.example', type: 'file' },
  { name: 'GEMINI.md', path: 'GEMINI.md', type: 'file' },
  { name: 'package.json', path: 'package.json', type: 'file' },
  { name: 'vite.config.ts', path: 'vite.config.ts', type: 'file' },
]

export const demoSrcFiles: FileEntry[] = [
  { name: 'components', path: 'src/components', type: 'directory' },
  { name: 'lib', path: 'src/lib', type: 'directory' },
  { name: 'stores', path: 'src/stores', type: 'directory' },
  { name: 'App.tsx', path: 'src/App.tsx', type: 'file' },
  { name: 'main.tsx', path: 'src/main.tsx', type: 'file' },
]

export const demoPermission = {
  requestId: 'demo-permission', sessionId: 'demo-auth',
  toolCall: { toolCallId: 'tool-test', title: 'Chạy npm test -- session.test.ts', kind: 'execute' },
  options: [
    { optionId: 'allow', name: 'Cho phép một lần', kind: 'allow_once' as const },
    { optionId: 'always', name: 'Luôn cho phép', kind: 'allow_always' as const },
    { optionId: 'reject', name: 'Từ chối', kind: 'reject_once' as const },
  ],
}
