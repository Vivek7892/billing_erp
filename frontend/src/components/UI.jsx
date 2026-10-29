import { useEffect, useId, useLayoutEffect, useRef, isValidElement } from 'react'
import {
  IconSearch,
  IconX,
  IconAlertTriangle,
  IconAlertCircle,
  IconPackage,
  IconRefresh,
  IconCheck,
} from '@tabler/icons-react'
import { usePageLoadingRegistration } from './PageLoadingContext'
import SearchInput from './SearchInput'
export { SearchInput }

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
        'rounded-lg border border-[var(--line)]',
        'bg-[var(--surface)]',
        'shadow-none',
        'transition-all duration-150',
        padding ? 'p-5 sm:p-6' : '',
        hover
          ? 'hover:border-[var(--line-strong)]'
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
  active = false,
  className = '',
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
        'px-3 py-2 sm:px-3.5 sm:py-2.5',
        'shadow-[var(--shadow-xs)]',
        'transition-all duration-150',
        active ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/15' : '',
        onClick
          ? 'cursor-pointer hover:border-[var(--line-strong)]'
          : 'cursor-default',
        className,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] leading-tight truncate">
            {label}
          </p>

          <p
            className="mt-0.5 truncate font-mono text-base sm:text-lg font-bold tracking-tight text-[var(--ink)] leading-tight"
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontFeatureSettings: '"tnum"',
            }}
          >
            {value}
          </p>

          {sub && (
            <p className="mt-0.5 truncate text-[10px] text-[var(--muted)]">
              {sub}
            </p>
          )}
        </div>

        {Icon && (
          <div
            className={[
              'flex h-6 w-6 shrink-0 items-center justify-center',
              'rounded-md border',
              selectedColor.icon,
            ].join(' ')}
          >
            <Icon size={13} strokeWidth={2} />
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
   MODAL ACCESSIBILITY HOOK
============================================================ */

export function useModalA11y(isOpen, onClose, containerRef) {
  const onCloseRef = useRef(onClose)
  const triggeringElementRef = useRef(null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const hasFocusedRef = useRef(false)

  useEffect(() => {
    if (!isOpen) {
      hasFocusedRef.current = false
      if (triggeringElementRef.current && typeof triggeringElementRef.current.focus === 'function') {
        try {
          triggeringElementRef.current.focus()
        } catch {
          // Ignore focus restoration errors if element unmounted
        }
      }
      return undefined
    }

    triggeringElementRef.current = document.activeElement

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current?.()
        return
      }

      if (event.key === 'Tab' && containerRef?.current) {
        const focusable = containerRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
      }
    }

    const previousOverflow = document.body.style.overflow
    const previousPaddingRight = document.body.style.paddingRight
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    // Set initial focus once upon opening
    if (!hasFocusedRef.current) {
      hasFocusedRef.current = true
      const timer = setTimeout(() => {
        if (containerRef?.current) {
          if (
            containerRef.current.contains(document.activeElement) &&
            document.activeElement !== containerRef.current
          ) {
            return
          }

          // Prioritize first active form field
          const formField = containerRef.current.querySelector(
            'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
          )
          if (formField) {
            formField.focus()
            return
          }

          const focusable = containerRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
          if (focusable.length > 0) {
            focusable[0].focus()
          }
        }
      }, 50)

      return () => {
        clearTimeout(timer)
        window.removeEventListener('keydown', handleKeyDown)
        document.body.style.overflow = previousOverflow
        document.body.style.paddingRight = previousPaddingRight
      }
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
    }
  }, [isOpen, containerRef])
}

/* ============================================================
   MODAL (Unified Design System)
============================================================ */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  description,
  children,
  size = 'md',
  footer,
  preventBackdropClose = false,
  className = '',
  contentClassName = '',
  headerActions,
}) {
  const dialogRef = useRef(null)
  const titleId = useId()
  const descId = useId()

  useModalA11y(open, onClose, dialogRef)

  if (!open) return null

  const sizes = {
    sm: 'sm:max-w-[420px]',
    md: 'sm:max-w-[600px]',
    lg: 'sm:max-w-[850px]',
    xl: 'sm:max-w-[1050px]',
    full: 'sm:max-w-[1240px]',
  }

  const subText = subtitle || description

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 md:p-6 backdrop-blur-xs transition-opacity duration-200"
      role="presentation"
      onMouseDown={(event) => {
        if (!preventBackdropClose && event.target === event.currentTarget) {
          onClose?.()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subText ? descId : undefined}
        tabIndex={-1}
        className={[
          'flex flex-col w-full sm:w-[calc(100vw-24px)] max-h-[92dvh] sm:max-h-[88vh]',
          sizes[size] || sizes.md,
          'rounded-t-2xl sm:rounded-2xl border-t sm:border border-[var(--line)] bg-[var(--surface)]',
          'shadow-2xl shadow-black/25',
          'outline-none overflow-hidden',
          'transition-all duration-200 ease-out animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-[0.98]',
          className,
        ].join(' ')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--line-strong)] sm:hidden shrink-0" />
        {/* Fixed Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="text-base sm:text-lg font-bold text-[var(--ink)] tracking-tight truncate"
            >
              {title}
            </h2>
            {subText && (
              <p id={descId} className="mt-0.5 text-xs text-[var(--muted)] leading-relaxed line-clamp-2">
                {subText}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--ink)] active:scale-95 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              <IconX size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className={`min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 ${contentClassName}`}>
          {children}
        </div>

        {/* Fixed Footer */}
        {footer && (
          <div className="shrink-0 border-t border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   CONFIRM DIALOG (Unified Standard)
============================================================ */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  danger = false,
  confirmLabel,
  cancelLabel = 'Cancel',
  loading = false,
  children,
}) {
  const dialogRef = useRef(null)
  const titleId = useId()

  useModalA11y(open, onClose, dialogRef)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm transition-opacity"
      role="presentation"
      onMouseDown={(e) => {
        if (!loading && e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-[calc(100vw-24px)] sm:w-full sm:max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xl shadow-black/25 outline-none animate-in fade-in zoom-in-[0.98]"
      >
        <div className="flex items-start gap-3.5">
          <div
            className={[
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border',
              danger
                ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400'
                : 'border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--primary)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
            ].join(' ')}
          >
            {danger ? (
              <IconAlertTriangle size={22} stroke={2} />
            ) : (
              <IconAlertCircle size={22} stroke={2} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 id={titleId} className="text-base sm:text-lg font-bold text-[var(--ink)] leading-snug">
              {title}
            </h3>
            {message && (
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-[var(--muted)]">
                {message}
              </p>
            )}
          </div>
        </div>

        {children && <div className="mt-4">{children}</div>}

        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary min-h-[44px] flex-1 sm:flex-initial sm:min-w-[100px] justify-center text-xs sm:text-sm font-semibold"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={[
              'btn-base min-h-[44px] flex-1 sm:flex-initial sm:min-w-[110px] justify-center text-xs sm:text-sm font-bold shadow-sm',
              danger ? 'btn-danger' : 'btn-primary',
            ].join(' ')}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <InlineSpinner className="w-4 h-4 text-white" />
                <span>Processing…</span>
              </span>
            ) : (
              confirmLabel || (danger ? 'Delete' : 'Confirm')
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export const ConfirmModal = ConfirmDialog

/* ============================================================
   DRAWER / SLIDE-OVER (Desktop slide-over, Mobile full sheet)
============================================================ */

export function Drawer({
  open,
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  width,
  preventBackdropClose = false,
}) {
  const visible = open ?? isOpen
  const drawerRef = useRef(null)
  const titleId = useId()

  useModalA11y(visible, onClose, drawerRef)

  if (!visible) return null

  const sizeClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
  }

  const customWidth = width || sizeClasses[size] || sizeClasses.md

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs transition-opacity duration-200"
      role="presentation"
      onMouseDown={(e) => {
        if (!preventBackdropClose && e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[
          'fixed inset-y-0 right-0 flex flex-col w-full',
          customWidth,
          'bg-[var(--surface)] border-l border-[var(--line)] shadow-2xl shadow-black/30',
          'outline-none animate-in slide-in-from-right duration-200 ease-out',
        ].join(' ')}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base sm:text-lg font-bold text-[var(--ink)] truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[var(--muted)] truncate">
                {subtitle}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)] transition-colors active:scale-95"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   RESPONSIVE TAG CHIP COMPONENT
============================================================ */

export function TagChip({ label, onRemove, color = 'default', className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 py-1 text-xs font-semibold',
        'bg-[var(--surface-elevated)] text-[var(--ink)] shadow-xs transition-colors',
        className,
      ].join(' ')}
    >
      <span className="truncate max-w-[140px] sm:max-w-[200px]">{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label}`}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--line)] hover:text-red-500 transition-colors"
        >
          <IconX size={12} />
        </button>
      )}
    </span>
  )
}

/* ============================================================
   LOADING PLACEHOLDER
============================================================ */

export function Spinner({
  label = 'Loading data',
}) {
  const id = useId()
  const registerLoading = usePageLoadingRegistration()

  useLayoutEffect(() => {
    registerLoading(id, true)
    return () => registerLoading(id, false)
  }, [id, registerLoading])

  return (
    <div className="flex min-h-40 w-full flex-col items-center justify-center gap-3 p-6 text-[var(--muted)]" role="status" aria-label={label}>
      <InlineSpinner className="h-7 w-7 text-[var(--primary)]" />
      <span className="text-xs font-medium">{label}</span>
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
  icon: Icon,
  title,
  message,
  description,
  action,
  className = '',
}) {
  const displayTitle = title || message || 'No data found'

  const renderIcon = () => {
    if (!Icon) {
      return <IconPackage size={24} stroke={1.5} />
    }
    if (isValidElement(Icon)) {
      return Icon
    }
    if (typeof Icon === 'function' || typeof Icon === 'object') {
      return <Icon size={24} strokeWidth={1.5} className="text-[var(--muted)]" />
    }
    return null
  }

  const renderAction = () => {
    if (!action) return null
    if (isValidElement(action)) {
      return <div className="mt-4">{action}</div>
    }
    if (typeof action === 'object' && action.label && action.onClick) {
      return (
        <div className="mt-4">
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E3A5F] px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#162F4D]"
          >
            {action.label}
          </button>
        </div>
      )
    }
    return null
  }

  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      <div className="mb-3.5 flex h-13 w-13 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--muted)] shadow-xs">
        {renderIcon()}
      </div>

      <h3 className="text-sm font-bold text-[var(--ink)]">
        {displayTitle}
      </h3>

      {description && (
        <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-[var(--muted)]">
          {description}
        </p>
      )}

      {renderAction()}
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
        'animate-pulse rounded-md bg-[var(--line)]',
        className,
      ].join(' ')}
    />
  )
}

/* ============================================================
   TABLE SKELETON
============================================================ */

export function TableSkeleton({
  rows = 8,
  cols = 5,
  columns,
  label = 'Loading data',
}) {
  return (
    <Spinner label={label} />
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
          className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--line)]" />
            <div className="h-8 w-8 animate-pulse rounded-lg bg-[var(--line)]" />
          </div>

          <div className="mt-4 h-7 w-28 animate-pulse rounded bg-[var(--line)]" />
          <div className="mt-2 h-3 w-20 animate-pulse rounded bg-[var(--line)]" />
        </div>
      ))}
    </div>
  )
}

/* ============================================================
   FORM SKELETON
============================================================ */

export function FormSkeleton() {
  return (
    <div className="space-y-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-6 shadow-xs" aria-hidden="true" role="status">
      <div className="space-y-2">
        <div className="h-3 w-28 animate-pulse rounded bg-[var(--line)]" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--line)]" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--line)]" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-[var(--line)]" />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="h-3 w-32 animate-pulse rounded bg-[var(--line)]" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-[var(--line)]" />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <div className="h-9 w-20 animate-pulse rounded-lg bg-[var(--line)]" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-[var(--line)]" />
      </div>

      <span className="sr-only">Loading form...</span>
    </div>
  )
}

/* ============================================================
   PAGE SKELETON
============================================================ */

export function PageSkeleton() {
  return (
    <div
      className="grid min-h-screen grid-cols-1 bg-[var(--app-bg)] lg:grid-cols-[220px_minmax(0,1fr)]"
      aria-hidden="true"
    >
      <aside className="hidden border-r border-[var(--line)] bg-[var(--sidebar-bg)] p-5 lg:block">
        <Skeleton className="mb-10 h-9 w-32 bg-white/10" />
        <div className="space-y-5">
          {Array.from({ length: 5 }, (_, group) => (
            <div key={group} className="space-y-2">
              <Skeleton className="h-2.5 w-20 bg-white/10" />
              <Skeleton className="h-9 w-full bg-white/10" />
              <Skeleton className="h-9 w-11/12 bg-white/10" />
            </div>
          ))}
        </div>
      </aside>

      <main className="min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-[var(--line)] bg-[var(--surface)] px-4 sm:px-6">
          <Skeleton className="h-8 w-32 sm:w-48" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="hidden h-3 w-24 sm:block" />
          </div>
        </header>

        <div className="space-y-5 p-4 sm:p-6">
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-3 w-64 max-w-full" />
          </div>
          <CardSkeleton count={4} />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </main>
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
        <IconAlertCircle size={24} stroke={1.8} />
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
          <IconRefresh size={14} stroke={2} />
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
        <IconCheck size={24} stroke={2} />
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
        'mb-3 sm:mb-4 flex min-w-0 flex-col gap-2 sm:gap-3 border-b border-[var(--line)] pb-2.5 sm:pb-4',
        'sm:flex-row sm:items-start sm:justify-between',
        className,
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-lg sm:text-2xl font-bold leading-tight tracking-tight text-[var(--ink)]">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-0.5 sm:mt-1.5 max-w-2xl text-xs sm:text-sm leading-relaxed text-[var(--muted)]">
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 shrink-0 sm:w-auto sm:justify-end">
          {action}
        </div>
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
      {type === 'success' ? (
        <IconCheck size={18} stroke={1.8} className={`mt-0.5 shrink-0 ${selectedStyle.icon}`} />
      ) : (
        <IconAlertCircle size={18} stroke={1.8} className={`mt-0.5 shrink-0 ${selectedStyle.icon}`} />
      )}

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
          <IconX size={15} stroke={2.2} />
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
   SEARCH BAR (Standardized Search Component wrapper)
============================================================ */

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search…',
  className = '',
  onClear,
  shortcut = 'Ctrl+K',
  inputRef,
  inputProps = {},
  inputClassName = '',
  iconClassName = '',
  clearButtonClassName = '',
  clearButtonProps = {},
  shortcutClassName = '',
  variant = 'standard',
  autoFocus = false,
  children,
  ...props
}) {
  const handleChange = (e) => {
    // Support both direct string handler and event handler
    if (typeof onChange === 'function') {
      if (e && e.target !== undefined) {
        onChange(e.target.value)
      } else {
        onChange(e)
      }
    }
  }

  return (
    <SearchInput
      ref={inputRef}
      value={value}
      onChange={handleChange}
      onClear={onClear}
      placeholder={placeholder}
      shortcut={shortcut}
      variant={variant}
      className={className}
      inputClassName={inputClassName}
      iconClassName={iconClassName}
      clearButtonClassName={clearButtonClassName}
      inputProps={{ ...inputProps, autoFocus }}
      {...props}
    >
      {children}
    </SearchInput>
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
  renderMobileCard,
}) {
  if (loading) {
    return <TableSkeleton rows={5} cols={columns.length || 4} />
  }

  return (
    <div className={`w-full min-w-0 ${className}`}>
      {renderMobileCard && data && data.length > 0 && (
        <div className="md:hidden space-y-2.5 mb-3">
          {data.map((row, rIdx) => (
            <div key={row.id || rIdx} onClick={() => onRowClick?.(row)} className={onRowClick ? 'cursor-pointer' : ''}>
              {renderMobileCard(row, rIdx)}
            </div>
          ))}
        </div>
      )}

      <div className={`overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] ${renderMobileCard && data && data.length > 0 ? 'hidden md:block' : ''}`}>
        <table className="table">
        <thead>
          <tr>
            {columns.map((col, idx) => {
              const alignClass = col.align === 'right' ? 'text-right num-col' : col.align === 'center' ? 'text-center' : 'text-left'
              return (
                <th
                  key={col.key || idx}
                  className={[alignClass, col.className || ''].join(' ')}
                >
                  {col.header}
                </th>
              )
            })}
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
                {columns.map((col, cIdx) => {
                  const alignClass = col.align === 'right' ? 'text-right num-col font-mono' : col.align === 'center' ? 'text-center' : 'text-left'
                  return (
                    <td
                      key={col.key || cIdx}
                      className={[
                        alignClass,
                        col.cellClassName || col.className || '',
                      ].join(' ')}
                    >
                      {col.render ? col.render(row[col.key], row, rIdx) : row[col.key]}
                    </td>
                  )
                })}
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
  if (totalItems === 0) return null

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
