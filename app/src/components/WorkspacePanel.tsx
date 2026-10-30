import { useEffect, useRef, useState } from 'react'
import {
  AtSign, ChevronRight, CircleStop, File, FileCode2, Folder, FolderOpen,
  FileDiff, LoaderCircle, RefreshCw, TerminalSquare, Trash2, X,
} from 'lucide-react'
import type { ChangeItem, FileEntry } from '@/types/workspace'
import { EmptyState, IconButton } from './AppChrome'
import { cn } from '@/lib/utils'

export type InspectorTab = 'changes' | 'files' | 'terminal'
export type TerminalLine = { id: string; text: string; tone?: 'command' | 'error' | 'muted' }

type Props = {
  open: boolean
  onClose: () => void
  tab: InspectorTab
  onTab: (tab: InspectorTab) => void
  changes: ChangeItem[]
  files: FileEntry[]
  filePath: string
  selectedFile?: { path: string; content: string }
  filesLoading?: boolean
  terminalLines: TerminalLine[]
  terminalRunning: boolean
  onSelectChange: (change: ChangeItem) => void
  onNavigate: (path: string) => void
  onReadFile: (path: string) => void
  onMention: (path: string) => void
  onRefreshFiles: () => void
  onCommand: (command: string) => void
  onClearTerminal: () => void
  onStopTerminal: () => void
}

function DiffView({ change }: { change: ChangeItem }) {
  const oldLines = (change.oldText ?? '').split('\n')
  const newLines = change.newText.split('\n')
  return (
    <div className="diff-view">
      <div className="diff-file-heading"><FileCode2 size={14} /><span>{change.path}</span></div>
      <div className="diff-code" aria-label={`Thay đổi trong ${change.path}`}>
        {change.oldText && (
          <div className="diff-old">
            {oldLines.map((line, index) => <div className="diff-line removed" key={`old-${index}`}><span>{index + 1}</span><span>−</span><code>{line || ' '}</code></div>)}
          </div>
        )}
        <div className="diff-new">
          {newLines.map((line, index) => <div className="diff-line added" key={`new-${index}`}><span>{index + 1}</span><span>+</span><code>{line || ' '}</code></div>)}
        </div>
      </div>
    </div>
  )
}

export function WorkspacePanel(props: Props) {
  const [selectedChange, setSelectedChange] = useState<ChangeItem | null>(props.changes[0] ?? null)
  const [command, setCommand] = useState('')
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    terminalRef.current?.scrollTo({ top: terminalRef.current.scrollHeight })
  }, [props.terminalLines])

  const totals = props.changes.reduce((acc, item) => ({ additions: acc.additions + item.additions, deletions: acc.deletions + item.deletions }), { additions: 0, deletions: 0 })
  const visibleChange = selectedChange && props.changes.some((item) => item.path === selectedChange.path)
    ? selectedChange
    : props.changes[0] ?? null

  return (
    <>
      {props.open && <button className="drawer-backdrop inspector-backdrop xl:hidden" aria-label="Đóng workspace" onClick={props.onClose} />}
      <aside className={cn('workspace-panel', props.open && 'drawer-open')} aria-label="Workspace">
        <div className="inspector-tabs">
          <button className={cn(props.tab === 'changes' && 'active')} onClick={() => props.onTab('changes')}><FileDiff size={14} /> Thay đổi <span>{props.changes.length}</span></button>
          <button className={cn(props.tab === 'files' && 'active')} onClick={() => props.onTab('files')}><FolderOpen size={14} /> Files</button>
          <button className={cn(props.tab === 'terminal' && 'active')} onClick={() => props.onTab('terminal')}><TerminalSquare size={14} /> Terminal</button>
          <IconButton title="Đóng workspace" className="ml-auto xl:hidden" onClick={props.onClose}><X size={17} /></IconButton>
        </div>

        {props.tab === 'changes' && (
          <div className="inspector-content changes-layout">
            <div className="changes-summary"><span>{props.changes.length} file đã thay đổi</span><span><strong>+{totals.additions}</strong> <em>−{totals.deletions}</em></span></div>
            {props.changes.length === 0 ? (
              <EmptyState icon={<FileDiff size={24} />} title="Chưa có thay đổi" description="Các diff do Gemini tạo sẽ xuất hiện tại đây." />
            ) : (
              <>
                <div className="change-file-list">
                  {props.changes.map((change) => (
                    <button key={change.path} className={cn(visibleChange?.path === change.path && 'active')} onClick={() => { setSelectedChange(change); props.onSelectChange(change) }}>
                      <FileCode2 size={14} /><span>{change.path}</span><small><strong>+{change.additions}</strong> <em>−{change.deletions}</em></small>
                    </button>
                  ))}
                </div>
                {visibleChange && <DiffView change={visibleChange} />}
              </>
            )}
          </div>
        )}

        {props.tab === 'files' && (
          <div className="inspector-content files-layout">
            <div className="file-toolbar">
              <span className="file-breadcrumb">{props.selectedFile ? props.selectedFile.path : props.filePath || 'Workspace'}</span>
              <IconButton title="Làm mới file explorer" onClick={props.onRefreshFiles}><RefreshCw size={14} className={props.filesLoading ? 'spin' : ''} /></IconButton>
            </div>
            {props.selectedFile ? (
              <div className="file-preview">
                <div className="file-preview-actions">
                  <button onClick={() => props.onNavigate(props.filePath)}><ChevronRight size={14} className="rotate-180" /> Quay lại</button>
                  <button onClick={() => props.onMention(props.selectedFile!.path)}><AtSign size={14} /> Nhắc file</button>
                </div>
                <pre><code>{props.selectedFile.content}</code></pre>
              </div>
            ) : (
              <div className="file-list">
                {props.filePath && <button onClick={() => props.onNavigate(props.filePath.split('/').slice(0, -1).join('/'))}><Folder size={15} /><span>..</span></button>}
                {props.files.map((entry) => (
                  <button key={entry.path} onClick={() => entry.type === 'directory' ? props.onNavigate(entry.path) : props.onReadFile(entry.path)}>
                    {entry.type === 'directory' ? <Folder size={15} /> : <File size={15} />}<span>{entry.name}</span><ChevronRight size={13} />
                  </button>
                ))}
                {!props.filesLoading && props.files.length === 0 && <EmptyState icon={<FolderOpen size={24} />} title="Thư mục trống" description="Không có file nào để hiển thị." />}
              </div>
            )}
          </div>
        )}

        {props.tab === 'terminal' && (
          <div className="inspector-content terminal-layout">
            <div className="terminal-toolbar"><span><span className={cn('terminal-led', props.terminalRunning && 'running')} /> shell · workspace</span><div>{props.terminalRunning && <IconButton title="Dừng lệnh" onClick={props.onStopTerminal}><CircleStop size={15} /></IconButton>}<IconButton title="Xóa terminal" onClick={props.onClearTerminal}><Trash2 size={14} /></IconButton></div></div>
            <div className="terminal-output" ref={terminalRef}>
              {props.terminalLines.map((line) => <div key={line.id} className={cn(line.tone && `terminal-${line.tone}`)}>{line.text || '\u00a0'}</div>)}
              {props.terminalRunning && <LoaderCircle size={13} className="spin" />}
            </div>
            <form className="terminal-input" onSubmit={(event) => { event.preventDefault(); if (command.trim() && !props.terminalRunning) { props.onCommand(command.trim()); setCommand('') } }}>
              <span>›</span><input value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Nhập lệnh…" aria-label="Lệnh terminal" disabled={props.terminalRunning} /><button type="submit" disabled={!command.trim() || props.terminalRunning}>Chạy</button>
            </form>
          </div>
        )}
      </aside>
    </>
  )
}
