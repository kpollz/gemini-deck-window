import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  AtSign, Bot, Check, ChevronDown, ChevronRight, CircleStop, FileCode2, GitBranch,
  ListChecks, LoaderCircle, Menu, MessageSquare, PanelRight, Play, Send, ShieldAlert,
  Sparkles, Terminal, Wrench, X,
} from 'lucide-react'
import type { ChatMessage, PermissionRequest } from '@/types/workspace'
import { GeminiMark, IconButton, StatusDot } from './AppChrome'
import { cn } from '@/lib/utils'

export type SelectOption = { id: string; name: string }

type Props = {
  messages: ChatMessage[]
  sending: boolean
  permission: PermissionRequest | null
  isDesktop: boolean
  connected: boolean
  workspaceName: string
  models: SelectOption[]
  modes: SelectOption[]
  model: string
  mode: string
  onModel: (id: string) => void
  onMode: (id: string) => void
  onSend: (text: string) => void
  onStop: () => void
  onPermission: (optionId: string) => void
  onOpenSessions: () => void
  onOpenWorkspace: () => void
  onOpenInspector: (tab?: 'changes' | 'files' | 'terminal') => void
  onOpenProject: () => void
  prefill?: string
}

function ToolMessage({ message }: { message: ChatMessage }) {
  const [expanded, setExpanded] = useState(false)
  const tool = message.tool!
  const Icon = tool.kind === 'execute' ? Terminal : tool.kind === 'edit' ? FileCode2 : Wrench
  return (
    <div className="tool-message">
      <button className="tool-summary" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Icon size={15} />
        <span>{tool.title}</span>
        <span className={cn('tool-status', `tool-${tool.status}`)}>
          {tool.status === 'in_progress' ? <LoaderCircle size={12} className="spin" /> : tool.status === 'completed' ? <Check size={12} /> : <StatusDot tone="muted" />}
          {tool.status === 'in_progress' ? 'Đang chạy' : tool.status === 'completed' ? 'Xong' : tool.status === 'failed' ? 'Lỗi' : 'Chờ'}
        </span>
      </button>
      {expanded && (
        <div className="tool-detail">
          <p>{message.content}</p>
          {tool.locations?.map((location) => <code key={`${location.path}-${location.line}`}>{location.path}{location.line ? `:${location.line}` : ''}</code>)}
          {tool.diffs?.map((diff) => <code key={diff.path}>{diff.path}</code>)}
        </div>
      )}
    </div>
  )
}

function MessageItem({ message }: { message: ChatMessage }) {
  if (message.role === 'tool') return <ToolMessage message={message} />
  if (message.role === 'plan') {
    return (
      <div className="plan-block">
        <div className="plan-title"><ListChecks size={15} /> Kế hoạch thực hiện</div>
        {message.plan?.map((item, index) => (
          <div className="plan-item" key={`${item.content}-${index}`}>
            <span className={cn('plan-check', `plan-${item.status}`)}>{item.status === 'completed' ? <Check size={11} /> : index + 1}</span>
            <span>{item.content}</span>
          </div>
        ))}
      </div>
    )
  }
  if (message.role === 'thought') {
    return <div className="thought-block"><Sparkles size={14} /><span>{message.content}</span></div>
  }
  if (message.role === 'user') {
    return (
      <div className="user-message-row">
        <div className="user-message">{message.content}</div>
        <div className="message-meta">Bạn · {message.time}</div>
      </div>
    )
  }
  return (
    <div className="assistant-message-row">
      <div className="assistant-avatar"><GeminiMark size={16} /></div>
      <div className="assistant-content markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        {message.streaming && <span className="typing-cursor" aria-label="Đang trả lời" />}
      </div>
    </div>
  )
}

export function ChatPanel(props: Props) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [props.messages, props.permission])

  useEffect(() => {
    if (!props.prefill) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInput((current) => `${current}${props.prefill}`)
    textareaRef.current?.focus()
  }, [props.prefill])

  const submit = () => {
    const text = input.trim()
    if (!text || props.sending) return
    props.onSend(text)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  return (
    <main className="chat-panel">
      <header className="chat-header">
        <IconButton title="Mở danh sách phiên" className="lg:hidden" onClick={props.onOpenSessions}><Menu size={19} /></IconButton>
        <div className="project-heading">
          <div><span className="project-name">{props.workspaceName}</span><span className="branch"><GitBranch size={12} /> main</span></div>
          <span className="project-subtitle">{props.isDesktop ? (props.connected ? 'ACP · sẵn sàng' : 'Chọn một dự án để bắt đầu') : 'Bản tương tác · dữ liệu minh họa'}</span>
        </div>
        <div className="header-controls">
          <label className="compact-select model-select" title="Chọn model">
            <Bot size={14} />
            <select value={props.model} onChange={(event) => props.onModel(event.target.value)} aria-label="Chọn model">
              {props.models.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
            <ChevronDown size={12} />
          </label>
          <IconButton title="Mở workspace" className="xl:hidden" onClick={props.onOpenWorkspace}><PanelRight size={18} /></IconButton>
        </div>
      </header>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="conversation">
          <div className="conversation-date"><span>Hôm nay</span></div>
          {props.messages.length === 0 && (
            <div className="welcome-block">
              <div className="welcome-symbol"><GeminiMark size={34} /></div>
              <h1>{props.isDesktop ? 'Cùng Gemini xây dựng dự án.' : 'Một workspace cho Gemini CLI.'}</h1>
              <p>{props.isDesktop ? 'Mở thư mục dự án để tạo phiên ACP thật. Gemini có thể đọc code, đề xuất thay đổi và chạy công cụ sau khi bạn duyệt.' : 'Chat theo ngữ cảnh, duyệt từng công cụ, xem diff và chạy terminal — trong cùng một màn hình.'}</p>
              {!props.isDesktop ? (
                <div className="prompt-suggestions">
                  {['Giải thích cấu trúc dự án này', 'Tìm và sửa lỗi trong auth flow', 'Viết test cho chức năng vừa sửa'].map((text) => (
                    <button key={text} onClick={() => { setInput(text); textareaRef.current?.focus() }}><MessageSquare size={14} />{text}</button>
                  ))}
                </div>
              ) : (
                <button className="primary-button" onClick={props.onOpenProject}>Chọn thư mục dự án</button>
              )}
            </div>
          )}
          {props.messages.map((message) => <MessageItem key={message.id} message={message} />)}
          {props.sending && !props.messages.some((message) => message.streaming) && (
            <div className="agent-working"><LoaderCircle size={15} className="spin" /><span>Gemini đang xử lý…</span></div>
          )}
        </div>
      </div>

      <div className="composer-area">
        {props.permission && (
          <div className="permission-card" role="alertdialog" aria-label="Yêu cầu quyền thực thi">
            <div className="permission-heading"><ShieldAlert size={17} /><strong>Gemini cần quyền thực thi</strong></div>
            <p>{props.permission.toolCall.title ?? 'Công cụ yêu cầu quyền truy cập.'}</p>
            {props.permission.toolCall.locations?.[0] && <code>{props.permission.toolCall.locations[0].path}</code>}
            <div className="permission-actions">
              {props.permission.options.map((option) => (
                <button key={option.optionId} className={cn(option.kind.startsWith('reject') && 'danger-button')} onClick={() => props.onPermission(option.optionId)}>
                  {option.kind.startsWith('reject') ? <X size={14} /> : <Play size={14} />}{option.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className={cn('composer', props.sending && 'composer-busy')}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => {
              setInput(event.target.value)
              event.target.style.height = 'auto'
              event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            rows={1}
            placeholder={props.isDesktop && !props.connected ? 'Mở dự án để bắt đầu trò chuyện…' : 'Giao việc cho Gemini…  (@ để nhắc file)'}
            aria-label="Nội dung gửi Gemini"
          />
          <div className="composer-toolbar">
            <div className="composer-tools">
              <IconButton title="Nhắc file trong workspace" onClick={() => props.onOpenInspector('files')}><AtSign size={17} /></IconButton>
              <label className="mode-select compact-select" title="Chế độ agent">
                <select value={props.mode} onChange={(event) => props.onMode(event.target.value)} aria-label="Chế độ agent">
                  {props.modes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
                <ChevronDown size={12} />
              </label>
            </div>
            <div className="composer-submit">
              <span>Enter để gửi · Shift + Enter xuống dòng</span>
              {props.sending ? (
                <IconButton title="Dừng tác vụ" className="stop-button" onClick={props.onStop}><CircleStop size={19} /></IconButton>
              ) : (
                <IconButton title="Gửi" className="send-button" disabled={!input.trim() || (props.isDesktop && !props.connected)} onClick={submit}><Send size={17} /></IconButton>
              )}
            </div>
          </div>
        </div>
        <div className="composer-note">Gemini có thể mắc lỗi. Hãy xem diff và duyệt công cụ trước khi thực thi.</div>
      </div>
    </main>
  )
}
