import { useMemo, useState } from 'react'
import { FolderOpen, MessageSquarePlus, Search, Settings, X } from 'lucide-react'
import type { SessionItem } from '@/types/workspace'
import { GeminiMark, IconButton, StatusDot } from './AppChrome'
import { cn } from '@/lib/utils'

type Props = {
  sessions: SessionItem[]
  activeSessionId: string
  workspaceName: string
  workspacePath: string
  connected: boolean
  isDesktop: boolean
  open: boolean
  onClose: () => void
  onSelect: (session: SessionItem) => void
  onNew: () => void
  onOpenProject: () => void
  onSettings: () => void
}

export function SessionSidebar(props: Props) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => props.sessions.filter((session) =>
    `${session.title} ${session.preview}`.toLowerCase().includes(query.toLowerCase()),
  ), [props.sessions, query])

  return (
    <>
      {props.open && <button className="drawer-backdrop lg:hidden" aria-label="Đóng danh sách phiên" onClick={props.onClose} />}
      <aside className={cn('session-sidebar', props.open && 'drawer-open')} aria-label="Điều hướng phiên">
        <div className="brand-row">
          <div className="brand-mark"><GeminiMark size={22} /></div>
          <div className="brand-copy"><strong>Gemini Desk</strong><span>ACP WORKSPACE</span></div>
          <IconButton title="Đóng" className="ml-auto lg:hidden" onClick={props.onClose}><X size={18} /></IconButton>
        </div>

        <div className="sidebar-primary-actions">
          <button className="new-session-button" onClick={props.onNew}><MessageSquarePlus size={16} /> Phiên mới <kbd>⌘ N</kbd></button>
          <button className="workspace-button" onClick={props.onOpenProject}>
            <FolderOpen size={16} />
            <span><strong>{props.workspaceName}</strong><small>{props.workspacePath}</small></span>
          </button>
        </div>

        <label className="session-search">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm phiên làm việc…" aria-label="Tìm phiên làm việc" />
          {query && <button onClick={() => setQuery('')} aria-label="Xóa tìm kiếm"><X size={13} /></button>}
        </label>

        <div className="section-label"><span>Gần đây</span><span>{filtered.length}</span></div>
        <div className="session-list">
          {filtered.map((session) => (
            <button key={session.id} className={cn('session-item', session.id === props.activeSessionId && 'active')} onClick={() => props.onSelect(session)}>
              <span className="session-title">{session.title}</span>
              <span className="session-preview">{session.preview}</span>
              <span className="session-time">{session.updatedAt}</span>
            </button>
          ))}
          {filtered.length === 0 && <div className="session-empty">Không có phiên phù hợp.</div>}
        </div>

        <div className="sidebar-footer">
          <div className="connection-line">
            <StatusDot tone={props.connected ? 'success' : props.isDesktop ? 'muted' : 'busy'} />
            <span>{props.isDesktop ? (props.connected ? 'Gemini CLI đã kết nối' : 'Chưa kết nối Gemini CLI') : 'Bản xem trước · dữ liệu minh họa'}</span>
          </div>
          <button onClick={props.onSettings}><Settings size={16} /> Cài đặt <span>⌘ ,</span></button>
        </div>
      </aside>
    </>
  )
}
