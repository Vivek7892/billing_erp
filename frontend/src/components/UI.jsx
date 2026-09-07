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
   STAT CARD
============================================================ */
export function StatCard({ label, value, icon: Icon, color = 'blue', sub }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
    green:  'bg-green-50 text-green-600 dark:bg-green-950/60 dark:text-green-400',
    orange: 'bg-orange-50 text-orange-500 dark:bg-orange-950/60 dark:text-orange-400',
    red:    'bg-red-50 text-red-500 dark:bg-red-950/60 dark:text-red-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400',
  }
  return (
    <Card className="p-4 sm:p-5 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">{label}</p>
          <p className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] mt-1.5 tracking-tight truncate">{value}</p>
          {sub && <p className="text-xs text-[var(--muted)] mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl flex-shrink-0 ${colors[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
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
  return (
    <span className={`status-badge status-${type}`}>{label}</span>
  )
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
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
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
      className="modal-backdrop fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/50 backdrop-blur-sm"
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
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)] flex-shrink-0">
          <h2 id={titleId} className="text-base font-bold text-[var(--ink)]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="icon-btn"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
export function Spinner({ size = 'md' }) {
  const s = size === 'sm' ? 'w-5 h-5 border-2' : 'w-8 h-8 border-[3px]'
  return (
    <div className="flex items-center justify-center py-12">
      <div className={`${s} border-[var(--line)] border-t-[var(--primary)] rounded-full animate-spin`} />
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
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--line)] flex items-center justify-center mb-4 text-[var(--muted)]">
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
      className={`animate-pulse rounded-lg bg-[var(--line)] ${className}`}
    />
  )
}

export function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <div className="space-y-3 p-4" aria-label="Loading data" role="status">
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-3">
          {Array.from({ length: columns }, (_, col) => (
            <Skeleton key={col} className={`h-8 flex-1 ${col === 0 ? 'max-w-10' : ''}`} />
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
        <div key={i} className="bg-[var(--surface)] rounded-xl border border-[var(--line)] p-5 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-20" />
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
    <div role="alert" className="flex flex-col items-center justify-center py-16 text-center px-6">
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
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          aria-label="Clear search"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 ${
            active === f.value
              ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-[var(--shadow-primary)]'
              : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:border-[var(--primary-border)] hover:text-[var(--primary-text)]'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
