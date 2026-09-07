import { useEffect, useId, useRef } from 'react'

/* ============================================================
   CARD
============================================================ */
export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)] ${className}`}>
      {children}
    </div>
  )
}

/* ============================================================
   KPI / STAT CARD
============================================================ */
export function StatCard({ label, value, icon: Icon, color = 'blue', sub, trend, onClick }) {
  const palette = {
    blue:   { bg: 'bg-blue-50 dark:bg-blue-950/50',    icon: 'text-blue-600 dark:text-blue-400',    ring: 'ring-blue-100 dark:ring-blue-900/40',    accent: 'border-l-blue-500' },
    green:  { bg: 'bg-green-50 dark:bg-green-950/50',  icon: 'text-green-600 dark:text-green-400',  ring: 'ring-green-100 dark:ring-green-900/40',  accent: 'border-l-green-500' },
    amber:  { bg: 'bg-amber-50 dark:bg-amber-950/50',  icon: 'text-amber-600 dark:text-amber-400',  ring: 'ring-amber-100 dark:ring-amber-900/40',  accent: 'border-l-amber-500' },
    red:    { bg: 'bg-red-50 dark:bg-red-950/50',      icon: 'text-red-500 dark:text-red-400',      ring: 'ring-red-100 dark:ring-red-900/40',      accent: 'border-l-red-500' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-950/50',icon: 'text-purple-600 dark:text-purple-400',ring: 'ring-purple-100 dark:ring-purple-900/40',accent: 'border-l-purple-500' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-950/50',icon: 'text-orange-500 dark:text-orange-400',ring: 'ring-orange-100 dark:ring-orange-900/40',accent: 'border-l-orange-500' },
    cyan:   { bg: 'bg-cyan-50 dark:bg-cyan-950/50',    icon: 'text-cyan-600 dark:text-cyan-400',    ring: 'ring-cyan-100 dark:ring-cyan-900/40',    accent: 'border-l-cyan-500' },
  }
  const c = palette[color] || palette.blue
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={`kpi-card border-l-4 ${c.accent} flex flex-col gap-3 w-full text-left ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-[var(--primary-border)]' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-light)] leading-tight">{label}</p>
        <div className={`p-2 rounded-lg flex-shrink-0 ring-1 ${c.bg} ${c.ring}`}>
          <Icon size={17} className={c.icon} />
        </div>
      </div>
      <div>
        <p className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] tracking-tight truncate">{value}</p>
        {sub && <p className="text-xs text-[var(--muted)] mt-0.5 truncate">{sub}</p>}
        {trend !== undefined && (
          <div className={`mt-1 text-xs font-semibold flex items-center gap-0.5 ${trend > 0 ? 'text-green-600 dark:text-green-400' : trend < 0 ? 'text-red-500' : 'text-[var(--muted-light)]'}`}>
            <span>{trend > 0 ? '↑' : trend < 0 ? '↓' : '—'}</span>
            <span>{trend !== 0 ? `${Math.abs(trend)}%` : 'No change'}</span>
          </div>
        )}
      </div>
    </Tag>
  )
}

/* ============================================================
   BADGE
============================================================ */
export function Badge({ status }) {
  const map = {
    in_stock: 'success', low_stock: 'warning', out_of_stock: 'danger',
    paid: 'success', partial: 'warning', credit: 'info', completed: 'success',
    cancelled: 'danger', refunded: 'info', active: 'success', inactive: 'neutral',
    pending: 'warning', failed: 'danger', processing: 'info', draft: 'neutral',
  }
  const label = status?.replace(/_/g, ' ')
  const type = map[status] || 'neutral'
  return <span className={`status-badge status-${type}`}>{label}</span>
}

/* ============================================================
   TABS
============================================================ */
export function Tabs({ tabs, active, onChange, className = '' }) {
  return (
    <div
      className={`flex gap-1 bg-[var(--surface-elevated)] rounded-xl p-1 border border-[var(--line)] ${className}`}
      role="tablist"
    >
      {tabs.map(tab => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
            active === tab.value
              ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-xs)]'
              : 'text-[var(--muted)] hover:text-[var(--ink-secondary)]'
          }`}
        >
          {tab.label}
          {tab.count != null && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              active === tab.value ? 'bg-[var(--primary-light)] text-[var(--primary-text)]' : 'bg-[var(--line)] text-[var(--muted)]'
            }`}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ============================================================
   MODAL
============================================================ */
export function Modal({ open, onClose, title, children, size = 'md', footer }) {
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return undefined
    const prev = document.activeElement
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() =>
      dialogRef.current?.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus()
    )
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' }

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/55 backdrop-blur-sm"
      role="presentation"
      onMouseDown={e => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className={`modal-shell bg-[var(--surface)] w-full ${sizes[size]} max-h-[95dvh] sm:max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-[var(--shadow-modal)] border border-[var(--line)]`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--line)] flex-shrink-0 bg-[var(--surface-elevated)] rounded-t-2xl sm:rounded-t-2xl">
          <h2 id={titleId} className="text-sm font-bold text-[var(--ink)]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="icon-btn -mr-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-[var(--line)] bg-[var(--surface-elevated)] rounded-b-2xl flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   CONFIRM DIALOG
============================================================ */
export function ConfirmDialog({ open, onClose, onConfirm, title, message, danger, confirmLabel, loading }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-sm">
      <div className="modal-shell bg-[var(--surface)] rounded-2xl shadow-[var(--shadow-modal)] w-full max-w-sm p-6 border border-[var(--line)]">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${danger ? 'bg-[var(--danger-light)]' : 'bg-[var(--primary-light)]'}`}>
          {danger ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <path d="M12 9v4"/><path d="M12 17h.01"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
            </svg>
          )}
        </div>
        <h3 className="text-base font-bold text-[var(--ink)] mb-1.5">{title}</h3>
        <p className="text-[var(--muted)] text-sm leading-relaxed mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            disabled={loading}
            className={`flex-1 btn-base ${danger ? 'btn-danger' : 'btn-primary'}`}
          >
            {loading ? 'Processing…' : (confirmLabel || (danger ? 'Delete' : 'Confirm'))}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   SPINNER
============================================================ */
export function Spinner({ size = 'md', label = 'Loading…' }) {
  const s = size === 'sm' ? 'w-5 h-5 border-2' : 'w-8 h-8 border-[3px]'
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3" role="status" aria-label={label}>
      <div className={`${s} border-[var(--line)] border-t-[var(--primary)] rounded-full animate-spin`} />
      <span className="text-xs text-[var(--muted-light)] sr-only">{label}</span>
    </div>
  )
}

export function InlineSpinner({ className = '' }) {
  return (
    <div className={`w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70 ${className}`} />
  )
}

/* ============================================================
   EMPTY STATE
============================================================ */
export function EmptyState({ message = 'No data found', description, action, icon }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--line)] flex items-center justify-center mb-4 text-[var(--muted-light)]">
        {icon || (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="14" x="2" y="7" rx="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
        )}
      </div>
      <p className="text-sm font-semibold text-[var(--ink-secondary)]">{message}</p>
      {description && <p className="text-xs text-[var(--muted)] mt-1 max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ============================================================
   SKELETON
============================================================ */
export function Skeleton({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`shimmer rounded-lg ${className}`}
    />
  )
}

export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="space-y-0" aria-label="Loading data" role="status">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-3 px-4 py-3 border-b border-[var(--line-subtle)] last:border-0">
          {Array.from({ length: columns }, (_, col) => (
            <Skeleton key={col} className={`h-5 flex-1 ${col === 0 ? 'max-w-8' : col === columns - 1 ? 'max-w-20' : ''}`} />
          ))}
        </div>
      ))}
      <span className="sr-only">Loading data</span>
    </div>
  )
}

export function CardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="kpi-card border-l-4 border-l-[var(--line)] space-y-3">
          <div className="flex justify-between items-start">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}

/* ============================================================
   ERROR STATE
============================================================ */
export function ErrorState({ title = 'Unable to load data', message = 'Something went wrong. Please try again.', onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="mb-4 w-12 h-12 rounded-2xl bg-[var(--danger-light)] flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
        </svg>
      </div>
      <h2 className="text-sm font-bold text-[var(--ink)]">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-[var(--muted)] leading-relaxed">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary btn-sm mt-4 flex items-center gap-2" onClick={onRetry}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M8 16H3v5"/>
          </svg>
          Try again
        </button>
      )}
    </div>
  )
}

/* ============================================================
   SUCCESS STATE
============================================================ */
export function SuccessState({ title = 'Done!', message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="mb-4 w-12 h-12 rounded-2xl bg-[var(--success-light)] flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
      </div>
      <h2 className="text-sm font-bold text-[var(--ink)]">{title}</h2>
      {message && <p className="mt-1 max-w-sm text-sm text-[var(--muted)] leading-relaxed">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ============================================================
   PAGE HEADER
============================================================ */
export function PageHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-5 ${className}`}>
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--ink)] tracking-tight">{title}</h1>
        {subtitle && <p className="text-[var(--muted)] text-sm mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/* ============================================================
   SEARCH INPUT
============================================================ */
export function SearchInput({ value, onChange, placeholder = 'Search…', className = '', autoFocus }) {
  return (
    <div className={`relative ${className}`}>
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-light)] pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
      </svg>
      <input
        className="input pl-9 pr-9 w-full"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange({ target: { value: '' } })}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-light)] hover:text-[var(--ink)] transition-colors p-0.5 rounded"
          aria-label="Clear search"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      )}
    </div>
  )
}

/* ============================================================
   DATE FILTER BAR
============================================================ */
export function DateFilterBar({ active, onChange, className = '' }) {
  const filters = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'This Week', value: 'this_week' },
    { label: 'This Month', value: 'this_month' },
    { label: 'All Time', value: '' },
  ]
  return (
    <div className={`flex gap-1.5 overflow-x-auto no-scrollbar ${className}`}>
      {filters.map(f => (
        <button
          key={f.value}
          onClick={() => onChange(f.value)}
          className={`filter-pill ${active === f.value ? 'active' : ''}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

/* ============================================================
   ALERT BANNER
============================================================ */
export function AlertBanner({ type = 'info', title, message, onDismiss }) {
  const styles = {
    info:    { wrap: 'bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800',    icon: 'text-blue-500',  text: 'text-blue-800 dark:text-blue-200' },
    success: { wrap: 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800', icon: 'text-green-500', text: 'text-green-800 dark:text-green-200' },
    warning: { wrap: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800', icon: 'text-amber-500', text: 'text-amber-800 dark:text-amber-200' },
    danger:  { wrap: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800',         icon: 'text-red-500',   text: 'text-red-800 dark:text-red-200' },
  }
  const s = styles[type] || styles.info
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${s.wrap}`} role="alert">
      <svg className={`shrink-0 mt-0.5 ${s.icon}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {type === 'success'
          ? <><path d="M20 6 9 17l-5-5"/></>
          : <><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></>}
      </svg>
      <div className="flex-1 min-w-0">
        {title && <p className={`text-sm font-semibold ${s.text}`}>{title}</p>}
        {message && <p className={`text-xs mt-0.5 ${s.text} opacity-80`}>{message}</p>}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className={`shrink-0 ${s.icon} hover:opacity-70 transition-opacity`} aria-label="Dismiss">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      )}
    </div>
  )
}
