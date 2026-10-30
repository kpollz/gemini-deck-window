import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRight, FileDiff, FolderOpen, Keyboard, MessageSquarePlus, Search,
  Settings, TerminalSquare, X,
} from 'lucide-react'
import { IconButton } from './AppChrome'

export type AppSettings = {
  cliPath: string
  saveHistory: boolean
  compactTools: boolean
  defaultMode: string
}

function Modal({ children, onClose, label, className = '' }: { children: ReactNode; onClose: () => void; label: string; className?: string }) {
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]')
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', listener)
    return () => { document.removeEventListener('keydown', listener); previous?.focus() }
  }, [onClose])
  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className={`modal-panel ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={panelRef}>{children}</div>
    </div>
  )
}

export function SettingsDialog({ open, onClose, settings, onSave }: { open: boolean; onClose: () => void; settings: AppSettings; onSave: (settings: AppSettings) => void }) {
  const [draft, setDraft] = useState(settings)
  // Reset the form whenever the dialog is reopened.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open) setDraft(settings) }, [open, settings])
  if (!open) return null
  return (
    <Modal onClose={onClose} label="Cài đặt Gemini Desk" className="settings-modal">
      <div className="modal-header"><div><h2>Cài đặt</h2><p>Cấu hình Gemini CLI và trải nghiệm workspace.</p></div><IconButton title="Đóng cài đặt" onClick={onClose}><X size={18} /></IconButton></div>
      <form onSubmit={(event) => { event.preventDefault(); onSave(draft); onClose() }}>
        <div className="settings-section">
          <h3>Gemini CLI</h3>
          <label className="settings-field"><span>Đường dẫn executable</span><input value={draft.cliPath} onChange={(event) => setDraft({ ...draft, cliPath: event.target.value })} placeholder="gemini (mặc định lấy từ PATH)" /><small>Ví dụ: C:\Users\ban\AppData\Roaming\npm\gemini.cmd</small></label>
          <label className="settings-field"><span>Chế độ mặc định</span><select value={draft.defaultMode} onChange={(event) => setDraft({ ...draft, defaultMode: event.target.value })}><option value="default">Mặc định · luôn hỏi quyền</option><option value="auto_edit">Tự động duyệt chỉnh sửa</option><option value="plan">Plan · chỉ đọc</option></select></label>
        </div>
        <div className="settings-section">
          <h3>Workspace</h3>
          <label className="settings-toggle"><span><strong>Lưu lịch sử phiên</strong><small>Lưu metadata phiên trên thiết bị này.</small></span><input type="checkbox" checked={draft.saveHistory} onChange={(event) => setDraft({ ...draft, saveHistory: event.target.checked })} /></label>
          <label className="settings-toggle"><span><strong>Thu gọn tiến trình công cụ</strong><small>Chỉ mở chi tiết khi bạn nhấn vào công cụ.</small></span><input type="checkbox" checked={draft.compactTools} onChange={(event) => setDraft({ ...draft, compactTools: event.target.checked })} /></label>
        </div>
        <div className="settings-note"><Keyboard size={16} /><span>Phím tắt: <kbd>Ctrl K</kbd> mở command palette, <kbd>Ctrl N</kbd> tạo phiên mới.</span></div>
        <div className="modal-actions"><button type="button" onClick={onClose}>Hủy</button><button type="submit" className="primary-button">Lưu cài đặt</button></div>
      </form>
    </Modal>
  )
}

export type CommandItem = { id: string; label: string; hint: string; icon: 'new' | 'folder' | 'diff' | 'terminal' | 'settings'; action: () => void }

export function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: CommandItem[] }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open) { setQuery(''); setActiveIndex(0) } }, [open])
  if (!open) return null
  const filtered = commands.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
  const runActive = () => {
    const item = filtered[activeIndex]
    if (item) { item.action(); onClose() }
  }
  const icons = { new: MessageSquarePlus, folder: FolderOpen, diff: FileDiff, terminal: TerminalSquare, settings: Settings }
  return (
    <Modal onClose={onClose} label="Command palette" className="command-modal">
      <label className="command-search"><Search size={18} /><input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, filtered.length - 1)) }
          if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)) }
          if (event.key === 'Enter') { event.preventDefault(); runActive() }
        }} placeholder="Nhập lệnh hoặc tìm tính năng…" /></label>
      <div className="command-results">
        {filtered.map((item, index) => {
          const Icon = icons[item.icon]
          return <button key={item.id} className={index === activeIndex ? 'active' : ''} onMouseEnter={() => setActiveIndex(index)} onClick={() => { item.action(); onClose() }}><Icon size={17} /><span>{item.label}</span><small>{item.hint}</small><ArrowRight size={14} /></button>
        })}
        {filtered.length === 0 && <p className="command-empty">Không tìm thấy lệnh phù hợp.</p>}
      </div>
      <div className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> di chuyển</span><span><kbd>Esc</kbd> đóng</span></div>
    </Modal>
  )
}
