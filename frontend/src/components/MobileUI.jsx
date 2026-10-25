import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  IconHome,
  IconReceipt,
  IconPlus,
  IconPackage,
  IconMenu2,
  IconX,
  IconFilter,
  IconDotsVertical,
  IconUsers,
  IconCurrencyRupee,
  IconChevronRight,
  IconChevronDown,
  IconChevronUp,
  IconSearch,
} from '@tabler/icons-react'

/* ============================================================
   1. MOBILE BOTTOM NAVIGATION (Section 24)
   Thumb-friendly 5-item bar with safe-area support
============================================================ */
export function MobileBottomNav({ onOpenMenu, onQuickAction }) {
  const location = useLocation()
  const pathname = location.pathname

  const isHome = pathname === '/'
  const isBills = pathname.startsWith('/billing') || pathname.startsWith('/bills')
  const isProducts = pathname.startsWith('/products') || pathname.startsWith('/inventory') || pathname.startsWith('/stock')

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--line)] bg-[var(--surface)]/95 shadow-lg backdrop-blur-md md:hidden print:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-15 items-center justify-around px-2">
        {/* Home */}
        <Link
          to="/"
          className={`flex min-h-[44px] min-w-[48px] flex-col items-center justify-center rounded-xl px-2 py-1 transition-colors ${
            isHome
              ? 'text-[var(--primary)] font-bold'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <IconHome size={21} strokeWidth={isHome ? 2.4 : 1.8} />
          <span className="mt-0.5 text-[10px] tracking-tight">Home</span>
        </Link>

        {/* Bills / Invoices */}
        <Link
          to="/billing/invoices"
          className={`flex min-h-[44px] min-w-[48px] flex-col items-center justify-center rounded-xl px-2 py-1 transition-colors ${
            isBills
              ? 'text-[var(--primary)] font-bold'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <IconReceipt size={21} strokeWidth={isBills ? 2.4 : 1.8} />
          <span className="mt-0.5 text-[10px] tracking-tight">Bills</span>
        </Link>

        {/* Center Quick Action Action FAB (+) */}
        <button
          type="button"
          onClick={onQuickAction}
          aria-label="Quick Actions"
          className="flex h-11 w-11 -mt-3 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/30 active:scale-95 transition-transform"
        >
          <IconPlus size={24} strokeWidth={2.6} />
        </button>

        {/* Products / Stock */}
        <Link
          to="/products"
          className={`flex min-h-[44px] min-w-[48px] flex-col items-center justify-center rounded-xl px-2 py-1 transition-colors ${
            isProducts
              ? 'text-[var(--primary)] font-bold'
              : 'text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <IconPackage size={21} strokeWidth={isProducts ? 2.4 : 1.8} />
          <span className="mt-0.5 text-[10px] tracking-tight">Products</span>
        </Link>

        {/* More / Navigation Drawer */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open Navigation Menu"
          className="flex min-h-[44px] min-w-[48px] flex-col items-center justify-center rounded-xl px-2 py-1 text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
        >
          <IconMenu2 size={21} strokeWidth={1.8} />
          <span className="mt-0.5 text-[10px] tracking-tight">More</span>
        </button>
      </div>
    </nav>
  )
}

/* ============================================================
   2. MOBILE QUICK ACTION SHEET
   Triggers from center "+" button on mobile bottom navigation
============================================================ */
export function MobileQuickActionSheet({ open, onClose }) {
  if (!open) return null

  const actions = [
    {
      to: '/billing/new',
      label: 'New Bill / POS',
      sub: 'Create and collect counter sale',
      icon: IconPlus,
      color: 'bg-blue-600 text-white',
    },
    {
      to: '/products',
      label: 'Add Product',
      sub: 'Create item or adjust inventory',
      icon: IconPackage,
      color: 'bg-emerald-600 text-white',
    },
    {
      to: '/parties/customers',
      label: 'Add Customer',
      sub: 'Register new client profile',
      icon: IconUsers,
      color: 'bg-purple-600 text-white',
    },
    {
      to: '/expenses',
      label: 'Record Expense',
      sub: 'Log shop or operating costs',
      icon: IconCurrencyRupee,
      color: 'bg-amber-600 text-white',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-150">
      <div className="flex-1" onClick={onClose} />
      <div
        className="w-full rounded-t-2xl border-t border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[var(--line-strong)]" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--ink)]">Quick Actions</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {actions.map((act) => (
            <Link
              key={act.to + act.label}
              to={act.to}
              onClick={onClose}
              className="flex min-h-[52px] items-center gap-3.5 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3 active:scale-[0.99] transition-all hover:border-[var(--primary)]"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${act.color} shadow-xs`}>
                <act.icon size={20} strokeWidth={2.4} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[var(--ink)]">{act.label}</p>
                <p className="text-[11px] text-[var(--muted)]">{act.sub}</p>
              </div>
              <IconChevronRight size={16} className="text-[var(--muted)] shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   3. MOBILE FLOATING ACTION BUTTON (Section 5)
============================================================ */
export function MobileFAB({ icon: Icon = IconPlus, label, onClick, to, className = '' }) {
  const content = (
    <>
      <Icon size={20} strokeWidth={2.4} />
      {label && <span className="text-xs font-bold hidden xs:inline">{label}</span>}
    </>
  )

  const classes = [
    'fixed right-4 fab-bottom z-30 flex items-center justify-center gap-2 rounded-full shadow-lg shadow-[var(--primary)]/30 transition-all active:scale-95 md:hidden',
    'bg-[var(--primary)] text-white hover:brightness-105',
    label ? 'h-12 w-12 xs:w-auto px-0 xs:px-4.5' : 'h-13 w-13',
    className,
  ].join(' ')

  if (to) {
    return (
      <Link to={to} className={classes} aria-label={label || 'Action'}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={classes} aria-label={label || 'Action'}>
      {content}
    </button>
  )
}

/* ============================================================
   4. MOBILE FILTER SHEET & TRIGGER (Section 8)
============================================================ */
export function MobileFilterButton({ activeCount = 0, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--ink)] shadow-2xs hover:bg-[var(--surface-hover)] active:scale-95 transition-all md:hidden ${className}`}
    >
      <IconFilter size={15} className="text-[var(--muted)]" />
      <span>Filters</span>
      {activeCount > 0 && (
        <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white">
          {activeCount}
        </span>
      )}
    </button>
  )
}

export function MobileFilterSheet({ open, onClose, onClear, onApply, activeCount = 0, title = 'Filters', children }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs md:hidden animate-in fade-in duration-150">
      <div className="flex-1" onClick={onClose} />
      <div
        className="flex max-h-[85vh] flex-col rounded-t-2xl border-t border-[var(--line)] bg-[var(--surface)] shadow-2xl animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="mx-auto mt-2.5 h-1 w-12 rounded-full bg-[var(--line-strong)]" />
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--ink)]">{title}</h3>
            {activeCount > 0 && (
              <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[10px] font-bold text-white">
                {activeCount} active
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-hover)]"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {children}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[var(--line)] bg-[var(--surface-elevated)] p-3 flex gap-2">
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="flex-1 min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)]"
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onApply?.()
              onClose?.()
            }}
            className="flex-1 min-h-[44px] rounded-xl bg-[var(--primary)] text-xs font-bold text-white shadow-xs hover:brightness-105"
          >
            Apply filters
          </button>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   5. MOBILE CARD (Section 10)
   Standard responsive card replacing desktop table rows on mobile
============================================================ */
export function MobileCard({
  title,
  subtitle,
  amount,
  badge,
  tags = [],
  actions,
  onClick,
  className = '',
  children,
}) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-2xs transition-all active:scale-[0.99] ${
        onClick ? 'cursor-pointer hover:border-[var(--line-strong)]' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-bold text-[var(--ink)] truncate leading-snug">
            {title}
          </p>
          {subtitle && (
            <p className="text-[11px] text-[var(--muted)] truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end shrink-0">
          {amount && (
            <span className="text-xs sm:text-sm font-mono font-bold text-[var(--ink)]">
              {amount}
            </span>
          )}
          {badge && <div className="mt-1">{badge}</div>}
        </div>
      </div>

      {tags && tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[var(--line)]/60 pt-2">
          {tags.map((t, idx) => (
            <span
              key={idx}
              className="inline-flex items-center rounded-md bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {children && <div className="mt-2 text-xs text-[var(--ink-secondary)]">{children}</div>}

      {actions && (
        <div className="mt-3 flex items-center justify-end gap-2 border-t border-[var(--line)]/60 pt-2.5">
          {actions}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   6. MOBILE MORE ACTION MENU (Section 25)
============================================================ */
export function MobileMoreMenu({ actions = [] }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(v => !v)
        }}
        aria-label="More actions"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-95"
      >
        <IconDotsVertical size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[140px] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-lg animate-in fade-in duration-100">
          {actions.map((act, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(false)
                act.onClick?.()
              }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                act.danger
                  ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                  : 'text-[var(--ink)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {act.icon && <act.icon size={15} />}
              <span>{act.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ============================================================
   7. COMPACT MOBILE KPI GRID (Section 6 & 7)
============================================================ */
export function MobileKpiGrid({
  title = 'Business Insights',
  primaryKpis = [],
  secondaryKpis = [],
  allKpis = [],
  className = '',
  initialExpanded = false,
}) {
  const [showMore, setShowMore] = useState(initialExpanded)

  const cards = allKpis.length > 0 ? allKpis : [...primaryKpis, ...secondaryKpis]
  if (cards.length === 0) return null

  // Mobile display rules:
  // - If 3 cards: initially display only 2, with "Show more" for the 3rd card
  // - If > 4 cards: initially display only 4, with "Show more" for the rest
  // - If <= 2 or exactly 4 cards: display all without toggle
  const initialCount = cards.length === 3 ? 2 : cards.length > 4 ? 4 : cards.length
  const hasMore = cards.length > initialCount

  const visibleCards = showMore ? cards : cards.slice(0, initialCount)

  return (
    <div className={`space-y-2 md:hidden ${className}`}>
      {/* Top Header with Title and underlined Show more / Show less button */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
          {title}
        </span>
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowMore(v => !v)}
            className="text-xs font-semibold text-[var(--primary)] underline underline-offset-4 hover:opacity-80 transition"
          >
            {showMore ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* 2-Column Responsive Grid: Displays 2 or 4 cards initially */}
      <div className="grid grid-cols-2 gap-2">
        {visibleCards.map((kpi, idx) => (
          <div
            key={idx}
            onClick={kpi.onClick}
            className={`flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-2xs transition active:scale-[0.99] ${
              kpi.onClick ? 'cursor-pointer hover:border-[var(--line-strong)]' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-medium text-[var(--muted)] truncate">{kpi.label}</p>
              {kpi.icon && <kpi.icon size={13} className="text-[var(--muted)] shrink-0" />}
            </div>
            <p className="mt-1 text-base font-bold font-mono text-[var(--ink)] tracking-tight truncate">
              {kpi.value}
            </p>
            {kpi.sub && (
              <p className="mt-0.5 text-[9px] text-[var(--muted)] truncate">{kpi.sub}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

