import { useEffect, useId, useRef } from 'react'

/* ============================================================
   CARD
============================================================ */

export function Card({
  children,
  className = '',
  padding = true,
  hover = false,
}) {
  return (
    <div
      className={[
        'rounded-2xl border border-[var(--line)]',
        'bg-[var(--surface)]',
        'shadow-[var(--shadow-card)]',
        'transition-all duration-200',
        padding ? 'p-4 sm:p-5' : '',
        hover
          ? 'hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--primary-border)]'
          : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

/* ============================================================
   KPI / STAT CARD
============================================================ */

export function StatCard({
  label,
  value,
  icon: Icon,
  color = 'blue',
  sub,
  trend,
  onClick,
}) {
  const Tag = onClick ? 'button' : 'div'

  const colorStyles = {
    blue: {
      icon: 'bg-blue-50 text-blue-600 border-blue-100',
      accent: 'border-l-blue-500',
    },
    green: {
      icon: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      accent: 'border-l-emerald-500',
    },
    orange: {
      icon: 'bg-orange-50 text-orange-600 border-orange-100',
      accent: 'border-l-orange-500',
    },
    red: {
      icon: 'bg-rose-50 text-rose-600 border-rose-100',
      accent: 'border-l-rose-500',
    },
    purple: {
      icon: 'bg-violet-50 text-violet-600 border-violet-100',
      accent: 'border-l-violet-500',
    },
    gray: {
      icon: 'bg-slate-100 text-slate-600 border-slate-200',
      accent: 'border-l-slate-400',
    },
  }

  const selectedColor = colorStyles[color] || colorStyles.blue

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'group w-full text-left',
        'rounded-2xl border border-[var(--line)]',
        'border-l-4',
        selectedColor.accent,
        'bg-[var(--surface)]',
        'p-4 sm:p-5',
        'shadow-[var(--shadow-card)]',
        'transition-all duration-200',
        onClick
          ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--primary-border)]'
          : 'cursor-default',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)] leading-tight">
            {label}
          </p>

          <p
            className="mt-3 truncate text-2xl sm:text-[1.9rem] font-semibold tracking-tight text-[var(--ink)] leading-none"
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontFeatureSettings: '"tnum"',
            }}
          >
            {value}
          </p>

          {sub && (
            <p className="mt-2 truncate text-xs text-[var(--muted)]">
              {sub}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className={[
              'flex h-10 w-10 shrink-0 items-center justify-center',
              'rounded-xl border',
              'transition-transform duration-200',
              'group-hover:scale-105',
              selectedColor.icon,
            ].join(' ')}
          >
            <Icon size={18} strokeWidth={1.8} />
          </div>
        )}
      </div>

      {trend !== undefined && (
        <div className="mt-4 flex items-center gap-1 text-xs">
          <span
            className={[
              'font-semibold',
              trend > 0
                ? 'text-emerald-600'
                : trend < 0
                  ? 'text-rose-600'
                  : 'text-[var(--muted)]',
            ].join(' ')}
          >
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '—'}
          </span>

          <span className="text-[var(--muted)]">
            {trend !== 0 ? `${Math.abs(trend)}% from previous period` : 'No change'}
          </span>
        </div>
      )}
    </Tag>
  )
}

/* ============================================================
   BADGE
============================================================ */

export function Badge({ status, label: customLabel }) {
  const statusMap = {
    in_stock: 'success',
    low_stock: 'warning',
    out_of_stock: 'danger',
    paid: 'success',
    partial: 'warning',
    credit: 'danger',
    completed: 'success',
    cancelled: 'danger',
    refunded: 'warning',
    active: 'success',
    inactive: 'neutral',
    pending: 'warning',
    failed: 'danger',
    processing: 'info',
    draft: 'neutral',
  }

  const styles = {
    success:
      'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning:
      'bg-amber-50 text-amber-700 border-amber-200',
    danger:
      'bg-rose-50 text-rose-700 border-rose-200',
    info:
      'bg-blue-50 text-blue-700 border-blue-200',
    neutral:
      'bg-slate-50 text-slate-600 border-slate-200',
  }

  const type = statusMap[status] || 'neutral'
  const label =
    customLabel ||
    status?.replace(/_/g, ' ') ||
    'Unknown'

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5',
        'rounded-full border px-2.5 py-1',
        'text-[11px] font-medium capitalize',
        'whitespace-nowrap',
        styles[type],
      ].join(' ')}
    >
      <span
        className={[
          'h-1.5 w-1.5 rounded-full',
          type === 'success'
            ? 'bg-emerald-500'
            : type === 'warning'
              ? 'bg-amber-500'
              : type === 'danger'
                ? 'bg-rose-500'
                : type === 'info'
                  ? 'bg-blue-500'
                  : 'bg-slate-400',
        ].join(' ')}
      />

      {label}
    </span>
  )
}

/* ============================================================
   TABS
============================================================ */

export function Tabs({
  tabs = [],
  active,
  onChange,
  className = '',
}) {
  return (
    <div
      className={[
        'flex w-full gap-1 overflow-x-auto',
        'rounded-xl border border-[var(--line)]',
        'bg-[var(--surface-elevated)] p-1',
        'no-scrollbar',
        className,
      ].join(' ')}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = active === tab.value

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.value)}
            className={[
              'flex min-h-9 flex-1 items-center justify-center',
              'gap-1.5 whitespace-nowrap rounded-lg',
              'px-3 py-2 text-xs transition-all duration-200',
              isActive
                ? 'bg-[var(--primary)] font-medium text-white shadow-sm'
                : 'font-normal text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]',
            ].join(' ')}
          >
            {tab.label}

            {tab.count !== undefined && tab.count !== null && (
              <span
                className={[
                  'rounded-full px-1.5 py-0.5 text-[10px]',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--line)] text-[var(--muted)]',
                ].join(' ')}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ============================================================
   MODAL
============================================================ */

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}) {
  const dialogRef = useRef(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    const previousOverflow = document.body.style.overflow

    window.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          'flex max-h-[95dvh] w-full flex-col',
          sizes[size] || sizes.md,
          'overflow-hidden rounded-t-2xl sm:max-h-[90vh] sm:rounded-2xl',
          'border border-[var(--line)]',
          'bg-[var(--surface)]',
          'shadow-[var(--shadow-modal)]',
        ].join(' ')}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--surface-elevated)] px-5 py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate text-base font-semibold text-[var(--ink)]"
            >
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--line)] hover:text-[var(--ink)]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-[var(--line)] bg-[var(--surface-elevated)] px-5 py-4">
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

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  danger = false,
  confirmLabel,
  loading = false,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-modal)] sm:p-6">
        <div
          className={[
            'mb-4 flex h-11 w-11 items-center justify-center rounded-xl border',
            danger
              ? 'border-rose-200 bg-rose-50 text-rose-600'
              : 'border-blue-200 bg-blue-50 text-blue-600',
          ].join(' ')}
        >
          {danger ? (
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          ) : (
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          )}
        </div>

        <h3 className="text-base font-semibold text-[var(--ink)]">
          {title}
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {message}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirm?.()
              onClose?.()
            }}
            disabled={loading}
            className={[
              'btn-base flex-1',
              danger ? 'btn-danger' : 'btn-primary',
            ].join(' ')}
          >
            {loading
              ? 'Processing…'
              : confirmLabel || (danger ? 'Delete' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   SPINNER
============================================================ */

export function Spinner({
  size = 'md',
  label = 'Loading…',
}) {
  const spinnerSize =
    size === 'sm'
      ? 'h-5 w-5 border-2'
      : size === 'lg'
        ? 'h-10 w-10 border-4'
        : 'h-8 w-8 border-[3px]'

  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-12"
      role="status"
      aria-label={label}
    >
      <div
        className={[
          spinnerSize,
          'animate-spin rounded-full',
          'border-[var(--line)] border-t-[var(--primary)]',
        ].join(' ')}
      />

      <span className="sr-only">{label}</span>
    </div>
  )
}

/* ============================================================
   INLINE SPINNER
============================================================ */

export function InlineSpinner({ className = '' }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={[
        'inline-block h-4 w-4 animate-spin rounded-full',
        'border-2 border-current border-t-transparent',
        'opacity-70',
        className,
      ].join(' ')}
    />
  )
}

/* ============================================================
   EMPTY STATE
============================================================ */

export function EmptyState({
  message = 'No data found',
  description,
  action,
  icon,
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--muted-light)]">
        {icon || (
          <svg
            width="27"
            height="27"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="20" height="14" x="2" y="7" rx="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        )}
      </div>

      <p className="text-sm font-medium text-[var(--ink-secondary)]">
        {message}
      </p>

      {description && (
        <p className="mt-2 max-w-sm text-xs leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      )}

      {action && <div className="mt-5">{action}</div>}
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
      className={[
        'animate-pulse rounded-lg',
        'bg-[var(--surface-elevated)]',
        className,
      ].join(' ')}
    />
  )
}

/* ============================================================
   TABLE SKELETON
============================================================ */

export function TableSkeleton({
  rows = 5,
  columns = 5,
}) {
  return (
    <div
      className="divide-y divide-[var(--line-subtle)]"
      aria-label="Loading data"
      role="status"
    >
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="flex gap-3 px-4 py-4"
        >
          {Array.from({ length: columns }, (_, col) => (
            <Skeleton
              key={col}
              className={[
                'h-5 flex-1',
                col === 0 ? 'max-w-10' : '',
                col === columns - 1 ? 'max-w-24' : '',
              ].join(' ')}
            />
          ))}
        </div>
      ))}

      <span className="sr-only">Loading data</span>
    </div>
  )
}

/* ============================================================
   CARD SKELETON
============================================================ */

export function CardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>

          <Skeleton className="mt-5 h-8 w-28" />
          <Skeleton className="mt-3 h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

/* ============================================================
   ERROR STATE
============================================================ */

export function ErrorState({
  title = 'Unable to load data',
  message = 'Something went wrong. Please try again.',
  onRetry,
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center px-6 py-14 text-center"
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      </div>

      <h2 className="text-base font-semibold text-[var(--ink)]">
        {title}
      </h2>

      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
        {message}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn-secondary btn-sm mt-5 flex items-center gap-2"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
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

export function SuccessState({
  title = 'Done!',
  message,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>

      <h2 className="text-base font-semibold text-[var(--ink)]">
        {title}
      </h2>

      {message && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
          {message}
        </p>
      )}

      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ============================================================
   PAGE HEADER
============================================================ */

export function PageHeader({
  title,
  subtitle,
  action,
  className = '',
}) {
  return (
    <div
      className={[
        'mb-5 flex flex-col gap-4',
        'sm:flex-row sm:items-start sm:justify-between',
        className,
      ].join(' ')}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-tight tracking-tight text-[var(--ink)] sm:text-2xl">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div className="w-full shrink-0 sm:w-auto">
          {action}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   SEARCH INPUT
============================================================ */

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  autoFocus = false,
}) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-light)]"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>

      <input
        type="search"
        className={[
          'input w-full rounded-xl',
          'pl-10 pr-10',
          'transition-all duration-200',
          'focus:ring-2 focus:ring-[var(--primary)]/15',
        ].join(' ')}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange({ target: { value: '' } })}
          className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted-light)] transition-colors hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
          aria-label="Clear search"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

/* ============================================================
   DATE FILTER BAR
============================================================ */

export function DateFilterBar({
  active,
  onChange,
  className = '',
}) {
  const filters = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'This Week', value: 'this_week' },
    { label: 'This Month', value: 'this_month' },
    { label: 'All Time', value: '' },
  ]

  return (
    <div
      className={[
        'flex gap-2 overflow-x-auto pb-1 no-scrollbar',
        className,
      ].join(' ')}
    >
      {filters.map((filter) => {
        const isActive = active === filter.value

        return (
          <button
            key={filter.value}
            type="button"
            onClick={() => onChange(filter.value)}
            className={[
              'shrink-0 rounded-full border px-4 py-2',
              'text-xs transition-all duration-200',
              isActive
                ? 'border-[var(--primary)] bg-[var(--primary)] font-medium text-white shadow-sm'
                : 'border-[var(--line)] bg-[var(--surface)] font-normal text-[var(--muted)] hover:border-[var(--primary-border)] hover:text-[var(--ink)]',
            ].join(' ')}
          >
            {filter.label}
          </button>
        )
      })}
    </div>
  )
}

/* ============================================================
   ALERT BANNER
============================================================ */

export function AlertBanner({
  type = 'info',
  title,
  message,
  onDismiss,
}) {
  const styles = {
    info: {
      wrapper: 'border-blue-200 bg-blue-50',
      icon: 'text-blue-700',
      text: 'text-blue-900',
    },
    success: {
      wrapper: 'border-emerald-200 bg-emerald-50',
      icon: 'text-emerald-700',
      text: 'text-emerald-900',
    },
    warning: {
      wrapper: 'border-amber-200 bg-amber-50',
      icon: 'text-amber-700',
      text: 'text-amber-900',
    },
    danger: {
      wrapper: 'border-rose-200 bg-rose-50',
      icon: 'text-rose-700',
      text: 'text-rose-900',
    },
  }

  const selectedStyle = styles[type] || styles.info

  return (
    <div
      className={[
        'flex items-start gap-3 rounded-xl border px-4 py-3.5',
        selectedStyle.wrapper,
      ].join(' ')}
      role="alert"
    >
      <svg
        className={`mt-0.5 shrink-0 ${selectedStyle.icon}`}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {type === 'success' ? (
          <path d="M20 6 9 17l-5-5" />
        ) : (
          <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </>
        )}
      </svg>

      <div className="min-w-0 flex-1">
        {title && (
          <p className={`text-sm font-medium ${selectedStyle.text}`}>
            {title}
          </p>
        )}

        {message && (
          <p className={`mt-1 text-xs leading-relaxed ${selectedStyle.text} opacity-80`}>
            {message}
          </p>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className={`shrink-0 rounded-md p-1 ${selectedStyle.icon} transition-opacity hover:opacity-60`}
          aria-label="Dismiss"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}