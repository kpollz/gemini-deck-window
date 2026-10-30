import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function IconButton({ className, children, title, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={cn('icon-button', className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function GeminiMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 1.75c.7 5.7 4.55 9.55 10.25 10.25C16.55 12.7 12.7 16.55 12 22.25 11.3 16.55 7.45 12.7 1.75 12 7.45 11.3 11.3 7.45 12 1.75Z" fill="currentColor" />
      <path d="M19 1.5c.2 2.1 1.4 3.3 3.5 3.5-2.1.2-3.3 1.4-3.5 3.5-.2-2.1-1.4-3.3-3.5-3.5 2.1-.2 3.3-1.4 3.5-3.5Z" fill="currentColor" opacity=".55" />
    </svg>
  )
}

export function StatusDot({ tone = 'success' }: { tone?: 'success' | 'busy' | 'muted' | 'error' }) {
  return <span className={`status-dot status-${tone}`} aria-hidden="true" />
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
