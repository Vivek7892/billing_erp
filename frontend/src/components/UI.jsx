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
        'rounded-[12px] border border-[var(--line)]',
        'bg-[var(--surface)]',
        'shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
        'transition-all duration-150',
        padding ? 'p-5 sm:p-6' : '',
        hover
          ? 'hover:border-[var(--line-strong)] hover:shadow-xs'
          : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

/* ============================================================
   KPI CARD (ERP Style - Strict 6 Colored Variants)
   Section 5: Sales, Revenue, Profit, Outstanding, Low Stock, Expenses
============================================================ */

export function KpiCard({
  type = 'sales', // 'sales' | 'revenue' | 'profit' | 'outstanding' | 'low_stock' | 'expenses'
  label,
  value,
  sub,
  icon: Icon,
  trend,
  onClick,
  className = '',
}) {
  const Tag = onClick ? 'button' : 'div'
  const cardVariantClass = `kpi-card-${type.replace(/_/g, '-')}`

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'kpi-card group w-full text-left',
        cardVariantClass,
        onClick ? 'cursor-pointer' : 'cursor-default',
        className,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="kpi-label leading-tight">
            {label}
          </p>

          <p
            className="kpi-value mt-1.5 truncate leading-none font-bold"
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontFeatureSettings: '"tnum"',
            }}
          >
            {value}
          </p>

          {sub && (
            <p className="mt-1.5 truncate text-xs opacity-85">
              {sub}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className="kpi-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          >
            <Icon size={17} strokeWidth={2} />
          </div>
        )}
      </div>

      {trend !== undefined && (
        <div className="mt-2.5 flex items-center gap-1 text-[11px] opacity-90 font-medium">
          <span>{trend > 0 ? '↑' : trend < 0 ? '↓' : '—'}</span>
          <span>{trend !== 0 ? `${Math.abs(trend)}% vs previous` : 'No change'}</span>
        </div>
      )}
    </Tag>
  )
}

/* ============================================================
   KPI / STAT SUMMARY BOX (ERP Style)
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
    blue: { icon: 'bg-slate-100 text-[#1E3A5F] border-[#D7DEE7] dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700', accent: 'border-l-[#1E3A5F]' },
    indigo: { icon: 'bg-slate-100 text-[#1E3A5F] border-[#D7DEE7] dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700', accent: 'border-l-[#1E3A5F]' },
    teal: { icon: 'bg-teal-50 text-[#0F766E] border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/40', accent: 'border-l-[#0F766E]' },
    green: { icon: 'bg-emerald-50 text-[#15803D] border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40', accent: 'border-l-[#15803D]' },
    orange: { icon: 'bg-amber-50 text-[#B45309] border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40', accent: 'border-l-[#B45309]' },
    red: { icon: 'bg-red-50 text-[#B91C1C] border-red-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40', accent: 'border-l-[#B91C1C]' },
    purple: { icon: 'bg-slate-100 text-[#1E3A5F] border-[#D7DEE7] dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700', accent: 'border-l-[#1E3A5F]' },
    gray: { icon: 'bg-slate-100 text-[#475569] border-[#D7DEE7] dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700/60', accent: 'border-l-[#475569]' },
  }

  const selectedColor = colorStyles[color] || colorStyles.indigo || colorStyles.blue

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={[
        'group w-full text-left',
        'rounded-lg border border-[var(--line)]',
        'border-l-2',
        selectedColor.accent,
        'bg-[var(--surface)]',
        'p-3.5 sm:p-4',
        'shadow-[var(--shadow-xs)]',
        'transition-all duration-150',
        onClick
          ? 'cursor-pointer hover:border-[var(--line-strong)]'
          : 'cursor-default',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)] leading-tight">
            {label}
          </p>

          <p
            className="mt-1.5 truncate text-xl font-bold tracking-tight text-[var(--ink)] leading-none"
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontFeatureSettings: '"tnum"',
            }}
          >
            {value}
          </p>

          {sub && (
            <p className="mt-1.5 truncate text-xs text-[var(--muted)]">
              {sub}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className={[
              'flex h-8 w-8 shrink-0 items-center justify-center',
              'rounded-md border',
              selectedColor.icon,
            ].join(' ')}
          >
            <Icon size={16} strokeWidth={1.8} />
          </div>
        )}
      </div>

      {trend !== undefined && (
        <div className="mt-2.5 flex items-center gap-1 text-[11px]">
          <span
            className={[
              'font-semibold',
              trend > 0
                ? 'text-teal-600 dark:text-teal-400'
                : trend < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-[var(--muted)]',
            ].join(' ')}
          >
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '—'}
          </span>

          <span className="text-[var(--muted)]">
            {trend !== 0 ? `${Math.abs(trend)}% vs previous` : 'No change'}
          </span>
        </div>
      )}
    </Tag>
  )
}

/* ============================================================
   COMPACT SUMMARY TABLE (ERP Style)
   Metric | Column 1 | Column 2 | Column 3 ...
============================================================ */

export function CompactSummaryTable({
  columns = [],
  rows = [],
  className = '',
  title,
  action,
}) {
  return (
    <div className={['erp-table-container', className].join(' ')}>
      {title && (
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            {title}
          </h3>
          {action}
        </div>
      )}
      <table className="erp-summary-table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {columns.map((col, cIdx) => (
                <td
                  key={cIdx}
                  className={[
                    col.align === 'right' ? 'text-right tabular' : col.align === 'center' ? 'text-center' : 'text-left',
                    col.className || '',
                    cIdx === 0 ? 'font-medium text-[var(--ink)]' : 'text-[var(--ink-secondary)]',
                  ].join(' ')}
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ============================================================
   BADGE
============================================================ */

export function Badge({ status, label: customLabel }) {
  const statusKey = String(status || '').toLowerCase().trim().replace(/\s+/g, '_')

  const classMap = {
    paid: 'badge-paid',
    completed: 'badge-completed',
    in_stock: 'badge-in-stock',
    active: 'badge-active',
    confirmed: 'badge-confirmed',
    pending: 'badge-pending',
    partial: 'badge-partial',
    partially_paid: 'badge-pending',
    low_stock: 'badge-low-stock',
    credit: 'badge-credit',
    overdue: 'badge-overdue',
    failed: 'badge-failed',
    out_of_stock: 'badge-out-of-stock',
    cancelled: 'badge-cancelled',
    refunded: 'badge-refunded',
    unpaid: 'badge-unpaid',
    draft: 'badge-draft',
    inactive: 'badge-inactive',
    archived: 'badge-archived',
  }

  const badgeClass = classMap[statusKey] || 'status-neutral'
  const label =
    customLabel ||
    statusKey.replace(/_/g, ' ') ||
    'Unknown'

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5',
        'rounded-full px-2.5 py-0.5',
        'text-[11px] font-semibold capitalize',
        'whitespace-nowrap transition-colors',
        badgeClass,
      ].join(' ')}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
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
          'overflow-hidden rounded-t-[12px] sm:max-h-[90vh] sm:rounded-[12px]',
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
  children,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[12px] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-modal)] sm:p-6">
        <div
          className={[
            'mb-4 flex h-11 w-11 items-center justify-center rounded-xl border',
            danger
              ? 'border-red-200 bg-red-50 text-[#B91C1C] dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400'
              : 'border-[#D7DEE7] bg-slate-100 text-[#1E3A5F] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
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

        {children}

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
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-400">
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
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-400">
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
      wrapper: 'border-blue-200 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/40',
      icon: 'text-[#2563EB] dark:text-blue-400',
      text: 'text-blue-950 dark:text-blue-200',
    },
    success: {
      wrapper: 'border-emerald-200 bg-emerald-50 dark:border-teal-800/50 dark:bg-teal-950/40',
      icon: 'text-emerald-600 dark:text-teal-400',
      text: 'text-emerald-900 dark:text-teal-200',
    },
    warning: {
      wrapper: 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/40',
      icon: 'text-amber-600 dark:text-amber-400',
      text: 'text-amber-900 dark:text-amber-200',
    },
    danger: {
      wrapper: 'border-red-200 bg-red-50 dark:border-rose-800/50 dark:bg-rose-950/40',
      icon: 'text-red-600 dark:text-rose-400',
      text: 'text-red-900 dark:text-rose-200',
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

/* ============================================================
   GLOBAL BUTTON COMPONENTS (Standard Height: 40px, Radius: 8px)
============================================================ */

export function PrimaryButton({
  children,
  className = '',
  icon: Icon,
  loading = false,
  disabled = false,
  ...props
}) {
  return (
    <button
      className={`btn-base btn-primary ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <InlineSpinner className="w-4 h-4 mr-1 text-white" /> : Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  )
}

export function SecondaryButton({
  children,
  className = '',
  icon: Icon,
  loading = false,
  disabled = false,
  ...props
}) {
  return (
    <button
      className={`btn-base btn-secondary ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <InlineSpinner className="w-4 h-4 mr-1 text-[var(--ink)]" /> : Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  )
}

export function DangerButton({
  children,
  className = '',
  icon: Icon,
  loading = false,
  disabled = false,
  ...props
}) {
  return (
    <button
      className={`btn-base btn-danger ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <InlineSpinner className="w-4 h-4 mr-1 text-white" /> : Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  )
}

export function SuccessButton({
  children,
  className = '',
  icon: Icon,
  loading = false,
  disabled = false,
  ...props
}) {
  return (
    <button
      className={`btn-base btn-success ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <InlineSpinner className="w-4 h-4 mr-1 text-white" /> : Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  )
}

export function WarningButton({
  children,
  className = '',
  icon: Icon,
  loading = false,
  disabled = false,
  ...props
}) {
  return (
    <button
      className={`btn-base btn-warning ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <InlineSpinner className="w-4 h-4 mr-1 text-white" /> : Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  )
}

export function IconButton({
  icon: Icon,
  label,
  className = '',
  danger = false,
  disabled = false,
  ...props
}) {
  return (
    <button
      type="button"
      className={`icon-btn ${danger ? 'danger' : ''} ${className}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      {...props}
    >
      {Icon && <Icon size={16} />}
    </button>
  )
}

/* ============================================================
   STATUS BADGE (Strict Semantic Mapping)
   Paid / Active / In Stock / Operational = Green
   Pending / Partial / Low Stock / Due = Amber
   Failed / Cancelled / Out of Stock / Overdue = Red
   Draft / Authorized / Information = Blue
   Inactive / Archived = Gray
============================================================ */

export function StatusBadge({ status, label: customLabel }) {
  const statusKey = String(status || '').toLowerCase().trim().replace(/[\s-]+/g, '_')

  const classMap = {
    // Green
    paid: 'badge-paid',
    completed: 'badge-completed',
    active: 'badge-active',
    in_stock: 'badge-in-stock',
    confirmed: 'badge-confirmed',
    operational: 'badge-operational',
    success: 'badge-paid',
    settled: 'badge-paid',

    // Amber
    pending: 'badge-pending',
    partial: 'badge-partial',
    partially_paid: 'badge-partial',
    low_stock: 'badge-low-stock',
    due: 'badge-due',
    warning: 'badge-pending',

    // Red
    failed: 'badge-failed',
    cancelled: 'badge-cancelled',
    canceled: 'badge-cancelled',
    out_of_stock: 'badge-out-of-stock',
    overdue: 'badge-overdue',
    credit: 'badge-credit',
    refunded: 'badge-refunded',
    unpaid: 'badge-unpaid',
    danger: 'badge-failed',

    // Blue
    draft: 'badge-draft',
    authorized: 'badge-authorized',
    info: 'badge-info',
    information: 'badge-info',

    // Gray
    inactive: 'badge-inactive',
    archived: 'badge-archived',
    neutral: 'badge-inactive',
  }

  const badgeClass = classMap[statusKey] || 'status-neutral'
  const displayLabel =
    customLabel ||
    statusKey.replace(/_/g, ' ') ||
    'Unknown'

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5',
        'rounded-full px-2.5 py-0.5',
        'text-[11px] font-semibold capitalize',
        'whitespace-nowrap transition-colors',
        badgeClass,
      ].join(' ')}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {displayLabel}
    </span>
  )
}

/* ============================================================
   SEARCH BAR (With Ctrl+K and clear button)
============================================================ */

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search products, customers, invoices… (Ctrl+K)',
  className = '',
  onClear,
}) {
  return (
    <div className={`relative flex-1 min-w-[200px] ${className}`}>
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full pl-9 pr-8 text-xs rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] placeholder:text-[var(--placeholder)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 transition-all"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange?.('')
            onClear?.()
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] p-1 text-xs"
          aria-label="Clear search"
        >
          ✕
        </button>
      ) : (
        <kbd className="hidden sm:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] bg-[var(--surface-elevated)] border border-[var(--line)] rounded">
          Ctrl+K
        </kbd>
      )}
    </div>
  )
}

/* ============================================================
   FILTER BAR (Structured toolbar for search & filters)
============================================================ */

export function FilterBar({ children, className = '' }) {
  return (
    <div className={`flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 sm:p-3 ${className}`}>
      {children}
    </div>
  )
}

/* ============================================================
   DATA TABLE (Consistent Reusable Table)
============================================================ */

export function DataTable({
  columns = [],
  data = [],
  loading = false,
  emptyMessage = 'No records found',
  onRowClick,
  rowClassName,
  className = '',
}) {
  if (loading) {
    return <TableSkeleton rows={5} cols={columns.length || 4} />
  }

  return (
    <div className={`overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] ${className}`}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                className={[col.align === 'right' ? 'num-col' : '', col.className || ''].join(' ')}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data && data.length > 0 ? (
            data.map((row, rIdx) => (
              <tr
                key={row.id || rIdx}
                onClick={() => onRowClick?.(row)}
                className={[
                  onRowClick ? 'cursor-pointer' : '',
                  typeof rowClassName === 'function' ? rowClassName(row) : (rowClassName || ''),
                ].join(' ')}
              >
                {columns.map((col, cIdx) => (
                  <td
                    key={col.key || cIdx}
                    className={[
                      col.align === 'right' ? 'num-col' : '',
                      col.cellClassName || col.className || '',
                    ].join(' ')}
                  >
                    {col.render ? col.render(row[col.key], row, rIdx) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length || 1} className="py-8 text-center text-xs text-[var(--muted)]">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/* ============================================================
   DRAWER (Slide-over panel from right)
============================================================ */

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'max-w-md',
}) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/50 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="absolute inset-y-0 right-0 flex max-w-full pl-10">
        <div className={`w-screen ${width} flex flex-col bg-[var(--surface)] border-l border-[var(--line)] shadow-xl animate-in slide-in-from-right duration-200`}>
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
            <div className="min-w-0">
              <h3 className="card-title truncate">{title}</h3>
              {subtitle && <p className="mt-0.5 text-xs text-[var(--muted)] truncate">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)] transition-colors"
              aria-label="Close drawer"
            >
              ✕
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {children}
          </div>

          {/* Drawer Footer */}
          {footer && (
            <div className="border-t border-[var(--line)] bg-[var(--surface-elevated)] p-4 flex items-center justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   PAGINATION
============================================================ */

export function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems,
  pageSize = 10,
  onPageChange,
  className = '',
}) {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, totalItems || currentPage * pageSize)

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[var(--line)] bg-[var(--surface)] text-xs text-[var(--muted)] ${className}`}>
      <div>
        {totalItems !== undefined ? (
          <span>
            Showing <strong className="text-[var(--ink)] font-semibold">{start}</strong> to <strong className="text-[var(--ink)] font-semibold">{end}</strong> of <strong className="text-[var(--ink)] font-semibold">{totalItems}</strong> entries
          </span>
        ) : (
          <span>
            Page <strong className="text-[var(--ink)]">{currentPage}</strong> of <strong className="text-[var(--ink)]">{totalPages}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="btn-secondary h-8 px-2.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        <span className="px-2 text-xs font-semibold text-[var(--ink)]">
          {currentPage} / {Math.max(1, totalPages)}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="btn-secondary h-8 px-2.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  )
}

/* Alias for compatibility */
export const ConfirmationDialog = ConfirmDialog