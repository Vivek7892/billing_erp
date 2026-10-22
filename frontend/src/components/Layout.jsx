import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api from '../api'
import logoImg from '../assets/logo.png'
import { ROLES } from '../constants'
import {
  IconLayoutDashboard,
  IconShoppingCart,
  IconFileText,
  IconPackage,
  IconUsers,
  IconChartBar,
  IconUserCog,
  IconSettings,
  IconChevronUp,
  IconChevronRight,
  IconChevronDown,
  IconSun,
  IconMoon,
  IconLogout,
  IconSearch,
  IconBell,
  IconRotate2,
  IconCreditCard,
  IconPackages,
  IconShoppingBag,
  IconBuildingStore,
  IconCurrencyRupee,
  IconHelpCircle,
  IconLayersLinked,
  IconActivity,
  IconX,
  IconClock,
  IconScan,
  IconArrowRight,
  IconCheck,
  IconShieldCheck,
  IconTrash,
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconCircleX,
  IconMenu2,
} from '@tabler/icons-react'
import { useEffect, useState, createContext, useContext, useRef, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'

import AppFooter from './AppFooter'
import { PageLoadingContext } from './PageLoadingContext'
import { SETTINGS_TABS } from './SettingsNavigation'
import { useTheme } from '../ThemeContext'

function MenuIcon({ size = 20 }) {
  return <IconMenu2 size={size} stroke={2} aria-hidden="true" />
}

export const ShopContext = createContext({ logoSrc: '', shopName: 'Dreamwithtech' })
export const useShop = () => useContext(ShopContext)

const NAV_GROUPS = [
  {
    label: 'Dashboard',
    items: [
      { to: '/', icon: IconLayoutDashboard, label: 'Dashboard' },
    ]
  },
  {
    label: 'Billing',
    items: [
      { to: '/billing/new', icon: IconShoppingCart, label: 'New Bill' },
      { to: '/sales/invoices', icon: IconFileText, label: 'Invoices' },
      { to: '/billing/drafts', icon: IconLayersLinked, label: 'Drafts' },
      { to: '/sales/returns', icon: IconRotate2, label: 'Returns' },
      { to: '/sales/payments', icon: IconCreditCard, label: 'Payments' }
    ]
  },
  {
    label: 'Inventory',
    items: [
      { to: '/inventory/products', icon: IconPackage, label: 'Products' },
      { to: '/inventory/stock', icon: IconPackages, label: 'Stock' },
      { to: '/inventory/purchases', icon: IconShoppingBag, label: 'Purchases' }
    ]
  },
  {
    label: 'Contacts',
    items: [
      { to: '/parties/customers', icon: IconUsers, label: 'Customers' },
      { to: '/parties/suppliers', icon: IconBuildingStore, label: 'Suppliers' }
    ]
  },
  {
    label: 'Business',
    items: [
      { to: '/expenses', icon: IconCurrencyRupee, label: 'Expenses' },
      { to: '/reports', icon: IconChartBar, label: 'Reports', roles: [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT] }
    ]
  },
  {
    label: 'Administration',
    adminOnly: true,
    items: [
      { to: '/users', icon: IconUserCog, label: 'Users', adminOnly: true },
      { to: '/recycle-bin', icon: IconTrash, label: 'Recycle Bin', adminOnly: true },
      { to: '/payments/reconciliation', icon: IconScan, label: 'Transaction Ledger', adminOnly: true },
      { to: '/support', icon: IconHelpCircle, label: 'Support' }
    ]
  }
]

const SIDEBAR_UTILITY_ITEMS = [
  { to: '/settings', icon: IconSettings, label: 'Settings' },
  { to: '/audit-trail', icon: IconShieldCheck, label: 'Business Activity' },
]

const PAGE_META = NAV_GROUPS.reduce((acc, group) => {
  group.items.forEach(item => {
    acc[item.to] = { icon: item.icon, group: group.label, label: item.label }
  })
  return acc
}, {})

function NavGroup({ group, collapsed, mobile, user, onNav }) {
  const location = useLocation()
  const [open, setOpen] = useState(true)

  const userRole = String(user?.role || '').toLowerCase()

  const visibleItems = group.items.filter(item => {
    if (item.to === '/support') return true
    if (item.roles && !item.roles.map(r => String(r).toLowerCase()).includes(userRole)) return false
    return !item.adminOnly || [ROLES.ADMIN, ROLES.OWNER].includes(userRole)
  })
  if (!visibleItems.length) return null

  if (group.adminOnly && ![ROLES.ADMIN, ROLES.OWNER].includes(userRole)) {
    const supportOnly = visibleItems.filter(i => i.to === '/support')
    if (!supportOnly.length) return null
    return (
      <NavGroupItems
        items={supportOnly}
        collapsed={collapsed}
        mobile={mobile}
        groupLabel={group.label}
        open={open}
        setOpen={setOpen}
        onNav={onNav}
      />
    )
  }

  return (
    <NavGroupItems
      items={visibleItems}
      collapsed={collapsed}
      mobile={mobile}
      groupLabel={group.label}
      open={open}
      setOpen={setOpen}
      onNav={onNav}
    />
  )
}

function NavGroupItems({ items, collapsed, mobile, groupLabel, open, setOpen, onNav }) {
  if (collapsed) {
    return (
      <div className="px-2 mb-1.5">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNav}
            title={label}
            className={({ isActive }) =>
              `relative flex items-center justify-center w-9 h-9 rounded-lg mb-0.5 transition-all duration-150 group ${
                isActive
                  ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)] shadow-xs font-semibold'
                  : 'text-slate-400 hover:bg-[var(--sidebar-hover)] hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={17} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#0F172A] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100] shadow-lg border border-[#1E293B]">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    )
  }

  return (
    <div className={`mb-1.5 ${groupLabel === 'Dashboard' ? '' : 'border-t border-white/[0.06] pt-1'}`}>
      {/* Group header: strictly neutral, never highlighted when active */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-2.5 py-1 mb-0.5 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
          {groupLabel}
        </span>
        {open ? <IconChevronUp size={11} className="opacity-50" /> : <IconChevronRight size={11} className="opacity-50" />}
      </button>

      {open && (
        <div className="space-y-0.5 px-2">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onNav}
              className={({ isActive }) =>
                `relative flex ${mobile ? 'min-h-10' : 'min-h-9'} items-center gap-2.5 rounded-lg px-2.5 text-[11px] font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)] shadow-xs font-semibold'
                    : 'text-slate-300 hover:bg-[var(--sidebar-hover)] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={`flex-shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span className="min-w-0 whitespace-normal break-words leading-snug">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function Sidebar({ collapsed, mobile, settingsMode, user, shopName, shopPhone, logoSrc, onNav, onToggle, onClose }) {
  const [headerHovered, setHeaderHovered] = useState(false)
  const location = useLocation()
  const canAccessUtility = [ROLES.ADMIN, ROLES.OWNER].includes(String(user?.role || '').toLowerCase())
  const requestedSettingsTab = new URLSearchParams(location.search).get('tab') || 'manage-business'
  const currentSettingsTab = requestedSettingsTab === 'business'
    ? 'manage-business'
    : requestedSettingsTab === 'billing'
      ? 'invoice-settings'
      : requestedSettingsTab === 'templates'
        ? 'print-settings'
        : requestedSettingsTab

  return (
    <div
      className={`flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out select-none ${
        mobile ? `w-64 rounded-r-2xl ${settingsMode ? 'border-r border-slate-200 shadow-xl' : ''}` : `${collapsed ? 'w-[62px]' : 'w-[220px]'} rounded-2xl ${settingsMode ? 'border border-slate-200 shadow-sm' : ''}`
      }`}
      style={{ background: settingsMode ? '#FFFFFF' : 'var(--sidebar-bg)' }}
    >
      {/* Brand Header */}
      <div
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        onClick={collapsed && !mobile ? onToggle : undefined}
        className={`flex items-center flex-shrink-0 border-b transition-all duration-300 cursor-pointer ${settingsMode ? 'border-slate-200' : 'border-white/10'} ${
          collapsed && !mobile ? 'justify-center px-2 py-4' : 'gap-3 px-4 py-3.5'
        }`}
      >
        {collapsed && !mobile ? (
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className={`absolute inset-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${headerHovered ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}`}>
              <img src={logoSrc} alt={shopName} className="w-8 h-8 object-contain rounded-md" />
            </div>
            <div
              title="Expand sidebar"
              className={`absolute inset-0 w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.1] transition-all duration-200 ${headerHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
            >
              <MenuIcon size={18} />
            </div>
          </div>
        ) : (
          <>
            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 p-1 ${settingsMode ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.06] border-white/[0.1]'}`}>
              <img src={logoSrc} alt={shopName} className="w-full h-full object-contain rounded" />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-[11px] font-bold whitespace-nowrap leading-tight tracking-tight ${settingsMode ? 'text-slate-900' : 'text-white'}`}>{shopName}</div>
              {shopPhone && <div className={`mt-1 whitespace-normal break-words text-[10px] font-medium ${settingsMode ? 'text-slate-500' : 'text-slate-400'}`}>{shopPhone}</div>}
            </div>
            {!mobile && (
              <button
                onClick={onToggle}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150 flex-shrink-0 ${settingsMode ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/[0.1]'}`}
              >
                <MenuIcon size={18} />
              </button>
            )}
            {mobile && (
              <button
                onClick={onClose}
                title="Close menu"
                aria-label="Close menu"
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0 ${settingsMode ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/[0.1]'}`}
              >
                <IconX size={17} />
              </button>
            )}
          </>
        )}
      </div>

      {settingsMode && (
        <div className="shrink-0 px-3 pt-3">
          <NavLink
            to="/"
            onClick={onNav}
            className="flex h-10 items-center justify-center gap-2 rounded-full bg-red-600 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <IconArrowRight size={15} className="rotate-180" />
            <span>Back to Dashboard</span>
          </NavLink>
        </div>
      )}

      {/* Scrollable navigation */}
  
      <nav className="sidebar-menu-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain py-2 space-y-0.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {settingsMode ? (
          <div className="px-2">
            {(!collapsed || mobile) && <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Settings</p>}
            <div className="space-y-0.5">
              {SETTINGS_TABS.map(({ id, label, icon: Icon, badge }) => {
                const isActive = currentSettingsTab === id
                return (
                  <NavLink
                    key={id}
                    to={`/settings?tab=${id}`}
                    onClick={onNav}
                    title={collapsed && !mobile ? label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex ${mobile ? 'min-h-10' : 'min-h-9'} items-center rounded-lg text-[11px] font-medium transition-colors duration-150 ${
                      collapsed && !mobile ? 'justify-center px-2' : 'gap-3 px-3'
                    } ${isActive
                      ? 'bg-indigo-50 text-indigo-800 font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={16} strokeWidth={1.8} className={`shrink-0 ${isActive ? 'text-indigo-700' : 'text-slate-400'}`} />
                    {(!collapsed || mobile) && (
                      <>
                        <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">{label}</span>
                        {badge && <span className={`max-w-24 truncate rounded px-1.5 py-0.5 text-[9px] ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{badge}</span>}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ) : NAV_GROUPS.map(group => (
          <NavGroup key={group.label} group={group} collapsed={collapsed && !mobile} mobile={mobile} user={user} onNav={onNav} />
        )).concat(!settingsMode && canAccessUtility ? [
          <div key="settings-security" className={`mt-1.5 border-t border-white/10 pt-1.5 ${collapsed && !mobile ? 'px-2' : 'px-2.5'}`}>
            {(!collapsed || mobile) && <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Settings &amp; Security</p>}
            <div className="space-y-0.5">
              {SIDEBAR_UTILITY_ITEMS.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onNav}
                  title={collapsed && !mobile ? label : undefined}
                  className={({ isActive }) => `flex ${mobile ? 'min-h-10' : 'min-h-9'} items-center rounded-lg text-[11px] font-medium transition-colors ${
                    collapsed && !mobile ? 'justify-center' : 'gap-2.5 px-2.5'
                  } ${isActive
                    ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)] font-semibold'
                    : 'text-slate-300 hover:bg-[var(--sidebar-hover)] hover:text-white'
                  }`}
                >
                  <Icon size={15} className="shrink-0 text-slate-400" />
                  {(!collapsed || mobile) && <span className="min-w-0 whitespace-normal break-words leading-snug">{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>,
        ] : [])}
      </nav>

    </div>
  )
}

function GlobalSearch() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const ref = useRef()
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const value = q.trim()
    if (value.length < 2) { setResults([]); return undefined }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const response = await api.get('/search/', { params: { q: value } })
        setResults(response.data?.results || [])
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 200)
    return () => clearTimeout(timer)
  }, [q])

  useEffect(() => {
    const onShortcut = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        ref.current?.querySelector('input')?.focus()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  const handleKeyDown = e => {
    if (e.key === 'Enter' && q.trim()) {
      navigate(`/inventory/products?search=${encodeURIComponent(q.trim())}`)
      setQ(''); setOpen(false)
    }
    if (e.key === 'Escape') { setQ(''); setOpen(false) }
  }

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <div className={`group flex items-center gap-2 rounded-xl px-2.5 py-1.5 w-full transition-all duration-200 border shadow-xs ${
        open || q
          ? 'bg-[var(--surface)] border-[#1E3A5F] ring-2 ring-[#1E3A5F]/15 dark:border-sky-500 dark:ring-sky-500/20'
          : 'bg-[var(--surface-elevated)] border-[var(--line)] hover:border-slate-300 dark:hover:border-slate-600'
      }`}>
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--surface)] text-[var(--muted)] group-focus-within:text-[#1E3A5F] dark:group-focus-within:text-sky-300">
          <IconSearch size={13} strokeWidth={2.2} />
        </div>
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(e.target.value.length > 0) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (!q) setOpen(false) }}
          onKeyDown={handleKeyDown}
          placeholder="Search products… (Ctrl+K)"
          aria-label="Search products"
          className="bg-transparent text-xs outline-none w-full text-[var(--ink)] placeholder:text-[var(--placeholder)] font-medium"
        />
        {q ? (
          <button onClick={() => { setQ(''); setOpen(false) }} aria-label="Clear search" className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition-colors">
            <IconX size={12} strokeWidth={2.5} />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex shrink-0 items-center rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] shadow-2xs">Ctrl+K</kbd>
        )}
      </div>

      {open && q && (
        <div className="absolute top-full mt-2 left-0 w-80 bg-[var(--surface)] rounded-2xl shadow-[var(--shadow-lg)] border border-[var(--line)] z-50 overflow-hidden">
          {searching ? (
            <div className="px-4 py-3 text-xs text-[var(--muted)] flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-[var(--line)] border-t-[var(--primary)] rounded-full animate-spin" />
              Searching...
            </div>
          ) : results.length ? (
            results.map(result => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => { navigate(result.route); setQ(''); setOpen(false) }}
                className="w-full px-4 py-2.5 text-left hover:bg-[var(--surface-hover)] border-b border-[var(--line-subtle)] last:border-0 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[var(--ink)] truncate">{result.label}</span>
                  <span className="text-[10px] uppercase text-[var(--muted)] shrink-0 bg-[var(--surface-elevated)] px-1.5 py-0.5 rounded border border-[var(--line)]">{result.type}</span>
                </div>
                <div className="text-xs text-[var(--muted)] truncate mt-0.5">{result.subtitle}</div>
              </button>
            ))
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-xs font-medium text-[var(--ink-secondary)]">No results for "{q}"</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">Try a different search term</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const SEVERITY_ICON_MAP = {
  danger:  { icon: IconAlertCircle,   color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  warning: { icon: IconAlertTriangle, color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  success: { icon: IconCircleCheck,  color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  info:    { icon: IconBell,          color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
}

function relativeTime(isoString) {
  if (!isoString) return ''
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function notificationTypeLabel(type = '') {
  return type.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) || 'Notification'
}

function notificationDateTime(isoString) {
  if (!isoString) return 'Time unavailable'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return 'Time unavailable'
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [criticalCount, setCriticalCount] = useState(0)
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)
  const [drawerFilter, setDrawerFilter] = useState('all') // 'all' | 'unread' | 'approvals' | 'critical'
  const [actioningId, setActioningId] = useState(null)
  const ref = useRef()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManageApprovals = [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER].includes(user?.role) || user?.is_superuser

  const getNotificationDestination = notification => {
    const data = notification.data || {}
    const type = notification.notification_type
    const actionParams = new URLSearchParams((notification.action_url || '').split('?')[1] || '')
    if (type === 'approval_required') {
      return '/notifications?tab=approvals'
    }
    if (type === 'low_stock' || type === 'batch_expiring') {
      const query = data.sku || data.product_id || data.product_name || ''
      return `/inventory/stock${query ? `?search=${encodeURIComponent(query)}` : ''}`
    }
    if (type === 'invoice_overdue' || type === 'quotation_expiring') {
      const query = data.invoice_number || actionParams.get('search') || notification.reference_id || ''
      return `/sales/invoices${query ? `?search=${encodeURIComponent(query)}` : ''}`
    }
    if (type === 'payment_received') {
      const query = data.invoice_number || actionParams.get('search') || ''
      return `/sales/payments${query ? `?search=${encodeURIComponent(query)}` : ''}`
    }
    if (type === 'purchase_order_pending') {
      const purchaseId = data.po_number || data.purchase_id || actionParams.get('po') || ''
      return `/inventory/purchases${purchaseId ? `?po=${encodeURIComponent(purchaseId)}` : ''}`
    }
    if (type === 'gst_submission_failed' || type === 'einvoice_failed' || type === 'eway_bill_expiring') {
      return '/reports'
    }
    return notification.action_url || '/notifications'
  }

  useEffect(() => {
    const handleClickOutside = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNotifications = useCallback(() => {
    api.get('/notifications/?limit=16').then(({ data }) => {
      setNotifications(data.notifications || [])
      setUnreadCount(data.unread_count || 0)
      setCriticalCount(data.critical_count || 0)
      setPendingApprovalCount(data.pending_approval_count || 0)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    loadNotifications()
    const timer = setInterval(loadNotifications, 20000)
    return () => clearInterval(timer)
  }, [loadNotifications])

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all/')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
      toast.success('All notifications marked as read')
    } catch {
      toast.error('Failed to mark notifications as read')
    }
  }

  const handleNotificationClick = async (n) => {
    if (!n.is_read) {
      try {
        await api.post(`/notifications/${n.id}/read/`)
        setUnreadCount(c => Math.max(0, c - 1))
      } catch {}
    }
    setOpen(false)
    navigate(getNotificationDestination(n))
  }

  const handleQuickApproval = async (e, n, action) => {
    e.stopPropagation()
    if (!canManageApprovals) {
      toast.error('Access Denied: Manager or Administrator sign-off required for this approval.', { icon: '🔒' })
      return
    }

    try {
      setActioningId(n.id)
      const res = await api.post(`/notifications/${n.id}/action/`, {
        action,
        notes: action === 'approve' ? 'Approved via Notification Drawer' : 'Rejected via Notification Drawer',
      })
      setNotifications(prev => prev.map(item => item.id === n.id ? {
        ...item,
        status: res.data?.notification_status || (action === 'approve' ? 'approved' : 'rejected'),
        is_read: true,
      } : item))
      if (n.status === 'active') {
        setPendingApprovalCount(c => Math.max(0, c - 1))
      }
      toast.success(action === 'approve' ? 'Request Approved & Executed' : 'Request Rejected')
    } catch (err) {
      toast.error(err?.response?.data?.error || `Failed to ${action}`)
    } finally {
      setActioningId(null)
    }
  }

  const filteredDrawerNotifications = useMemo(() => {
    if (drawerFilter === 'unread') return notifications.filter(n => !n.is_read)
    if (drawerFilter === 'approvals') return notifications.filter(n => n.requires_approval)
    if (drawerFilter === 'critical') return notifications.filter(n => n.severity === 'danger' || n.severity === 'warning')
    return notifications
  }, [notifications, drawerFilter])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className={`relative flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
          open ? 'bg-[var(--surface-hover)] text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]'
        }`}
        title="Open Notifications Drawer"
      >
        <IconBell size={17} className={criticalCount > 0 ? 'text-red-600' : ''} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white bg-[#DC2626] animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop for Desktop & Mobile */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          />

          {/* Slide-over Drawer from Right (Visible on Desktop, Tablet & Mobile) */}
          <aside
            className="fixed inset-y-0 right-0 z-50 flex flex-col w-[92vw] max-w-[420px] bg-[var(--surface)] shadow-2xl border-l border-[var(--line)] animate-in slide-in-from-right duration-200 text-[var(--ink)]"
            aria-label="Notification Drawer"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)] bg-[var(--surface-elevated)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 flex items-center justify-center text-[var(--primary)]">
                  <IconBell size={16} className={criticalCount > 0 ? 'text-red-600' : ''} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--ink)] text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-[#1E3A5F] text-white px-1.5 py-0.2 rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--muted)]">Work queue & operational alerts</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="btn-secondary min-h-9 px-2 text-[11px] font-semibold text-[var(--primary)] inline-flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <IconCheck size={11} />
                    <span>Read all</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                  aria-label="Close notification drawer"
                >
                  <IconX size={16} />
                </button>
              </div>
            </div>

            {/* Critical banner */}
            {criticalCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/40">
                <IconAlertCircle size={14} className="text-red-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                  {criticalCount} critical alert{criticalCount > 1 ? 's' : ''} require attention
                </span>
              </div>
            )}

            {/* Quick Drawer Filter Chips */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--line)] bg-[var(--surface)] overflow-x-auto">
              {[
                { id: 'all', label: 'All', count: notifications.length },
                { id: 'unread', label: 'Unread', count: unreadCount },
                { id: 'approvals', label: 'Approvals', count: pendingApprovalCount },
                { id: 'critical', label: 'Urgent', count: criticalCount },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDrawerFilter(tab.id)}
                  className={`min-h-9 px-2.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition ${
                    drawerFilter === tab.id
                      ? 'bg-[var(--primary)] text-white shadow-2xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className={`px-1 py-0.2 rounded text-[10px] ${drawerFilter === tab.id ? 'bg-white/20' : 'bg-[var(--surface-elevated)]'}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Notification Items List */}
            <div className="divide-y divide-[var(--line-subtle)] flex-1 overflow-y-auto">
              {filteredDrawerNotifications.length ? (
                filteredDrawerNotifications.map(n => {
                  const sev = SEVERITY_ICON_MAP[n.severity] || SEVERITY_ICON_MAP.info
                  const SevIcon = sev.icon
                  const isApproval = n.requires_approval
                  const isPendingPO = n.notification_type === 'purchase_order_pending'
                  const isActing = actioningId === n.id
                  const data = n.data || {}
                  const referenceDetails = [
                    data.invoice_number && `Invoice ${data.invoice_number}`,
                    data.po_number && `PO ${data.po_number}`,
                    data.product_name && `Product ${data.product_name}`,
                    data.sku && `SKU ${data.sku}`,
                    (data.customer_name || data.customer) && `Customer ${data.customer_name || data.customer}`,
                    (data.supplier_name || data.supplier) && `Supplier ${data.supplier_name || data.supplier}`,
                    data.quantity !== undefined && `Qty ${data.quantity}`,
                    data.amount !== undefined && `Amount ₹${data.amount}`,
                    data.days_overdue !== undefined && `${data.days_overdue} days overdue`,
                  ].filter(Boolean)

                  return (
                    <div
                      key={n.id}
                      className={`p-3.5 hover:bg-[var(--surface-hover)] transition-colors text-left space-y-2 border-l-3 ${
                        n.severity === 'danger' ? 'border-l-rose-500' :
                        n.severity === 'warning' ? 'border-l-amber-500' :
                        n.severity === 'success' ? 'border-l-emerald-500' :
                        'border-l-blue-500'
                      } ${!n.is_read ? 'bg-blue-50/20 dark:bg-blue-950/20' : ''}`}
                    >
                      {/* Quick scan: severity, category and recency */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 font-bold"
                            style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}
                          >
                            <SevIcon size={10} />
                            <span>{sev.label}</span>
                          </span>
                          <span className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink-secondary)]">
                            {notificationTypeLabel(n.notification_type)}
                          </span>
                          {isApproval && (
                            <span className={`px-1.5 py-0.2 rounded-full font-bold uppercase ${
                              n.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' :
                              n.status === 'rejected' ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300' :
                              'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                            }`}>
                              {n.status === 'active' ? 'Approval Required' : n.status}
                            </span>
                          )}
                        </div>
                        <span className="shrink-0 text-right">
                          <span className="block text-[10px] font-medium text-[var(--ink-secondary)]">{relativeTime(n.created_at)}</span>
                          <span className="block text-[10px] text-[var(--muted)]">{notificationDateTime(n.created_at)}</span>
                        </span>
                      </div>

                      {/* Title & message preview */}
                      <div
                        onClick={() => handleNotificationClick(n)}
                        className="cursor-pointer group"
                      >
                        <p className={`text-xs leading-snug group-hover:text-[var(--primary)] transition-colors ${!n.is_read ? 'font-bold text-[var(--ink)]' : 'font-medium text-[var(--ink-secondary)]'}`}>
                          {n.title}
                        </p>
                        <p className="text-[11px] text-[var(--muted)] line-clamp-3 mt-0.5 leading-relaxed">
                          {n.message}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-elevated)] px-2.5 py-2 text-[10px]">
                        <div className="min-w-0">
                          <span className="block text-[var(--muted)]">Status</span>
                          <span className={`mt-0.5 inline-flex items-center rounded-full px-1.5 py-0.5 font-semibold ${n.is_read ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200'}`}>
                            {n.is_read ? 'Read' : 'Unread'}
                          </span>
                        </div>
                        {referenceDetails.length > 0 && (
                          <div className="min-w-0">
                            <span className="block text-[var(--muted)]">Reference</span>
                            <span className="mt-0.5 block break-words font-medium text-[var(--ink-secondary)]">
                              {referenceDetails.slice(0, 2).join(' · ')}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Direct Inline Action Buttons */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--line-subtle)]">
                        {isApproval && n.status === 'active' ? (
                          <div className="flex items-center gap-1.5">
                            {canManageApprovals ? (
                              <>
                                <button
                                  type="button"
                                  onClick={e => handleQuickApproval(e, n, 'approve')}
                                  disabled={isActing}
                                  className="min-h-9 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-2xs transition"
                                  title="Approve & execute request"
                                >
                                  <IconCircleCheck size={12} />
                                  <span>{isActing ? 'Saving…' : 'Approve'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={e => handleQuickApproval(e, n, 'reject')}
                                  disabled={isActing}
                                  className="min-h-9 px-2.5 rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] font-semibold inline-flex items-center gap-1 shadow-2xs transition"
                                  title="Reject request"
                                >
                                  <IconCircleX size={12} />
                                  <span>Reject</span>
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                Awaiting Manager Sign-off
                              </span>
                            )}
                          </div>
                        ) : isPendingPO ? (
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(n)}
                            className="min-h-9 px-2.5 rounded-md bg-[var(--primary)] text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-2xs hover:brightness-110 transition"
                          >
                            <span>Review PO</span>
                            <IconArrowRight size={11} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(n)}
                            className="min-h-9 px-2.5 rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--ink)] text-[11px] font-semibold inline-flex items-center gap-1 shadow-2xs transition"
                          >
                            <span>Open Details</span>
                            <IconArrowRight size={11} />
                          </button>
                        )}

                        {!n.is_read && (
                          <button
                            type="button"
                            onClick={async e => {
                              e.stopPropagation()
                              try {
                                await api.post(`/notifications/${n.id}/read/`)
                                setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item))
                                setUnreadCount(c => Math.max(0, c - 1))
                              } catch {}
                            }}
                            className="min-h-9 px-2 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-elevated)] text-[11px] font-medium inline-flex items-center gap-1"
                            title="Mark as read"
                          >
                            <IconCheck size={11} />
                            <span>Read</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <IconCircleCheck size={28} className="text-teal-500" />
                  <p className="text-xs font-semibold text-[var(--ink)]">No notifications in this view</p>
                  <p className="text-[11px] text-[var(--muted)]">Your operational queues are up to date.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2.5 mt-auto flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={loadNotifications}
                className="btn-secondary h-8 px-2.5 text-xs font-semibold inline-flex items-center gap-1"
                title="Refresh notifications feed"
              >
                <IconActivity size={12} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => { setOpen(false); navigate('/notifications') }}
                className="btn-primary h-8 px-3 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <span>Full Notifications Center</span>
                <IconArrowRight size={12} />
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

function getPageMeta(pathname) {
  if (PAGE_META[pathname]) return PAGE_META[pathname]
  if (pathname.startsWith('/invoice/')) return { icon: IconFileText, group: 'Billing', label: 'Invoice Details' }
  if (pathname.startsWith('/public-bill/') || pathname.startsWith('/bill/')) return { icon: IconFileText, group: 'Billing', label: 'Digital Bill' }
  if (pathname.startsWith('/parties/customers/')) return { icon: IconUsers, group: 'Contacts', label: 'Customer Details' }
  if (pathname.startsWith('/parties/suppliers/')) return { icon: IconBuildingStore, group: 'Contacts', label: 'Supplier Details' }
  if (pathname.startsWith('/inventory/products/')) return { icon: IconPackage, group: 'Inventory', label: 'Product Details' }
  if (pathname.startsWith('/inventory/purchases/')) return { icon: IconShoppingBag, group: 'Inventory', label: 'Purchases' }
  if (pathname.startsWith('/sales/invoices')) return { icon: IconFileText, group: 'Billing', label: 'Billing & Invoices' }
  if (pathname.startsWith('/audit-trail')) return { icon: IconShieldCheck, group: 'Administration', label: 'Audit Trail' }
  if (pathname.startsWith('/billing/new')) return { icon: IconShoppingCart, group: 'Billing', label: 'New Sale' }
  if (pathname.startsWith('/sales/payments')) return { icon: IconCreditCard, group: 'Billing', label: 'Payments' }
  if (pathname.startsWith('/billing/drafts')) return { icon: IconLayersLinked, group: 'Billing', label: 'Parked Bills' }
  if (pathname.startsWith('/sales/returns')) return { icon: IconRotate2, group: 'Billing', label: 'Sales Returns' }
  return { icon: IconLayoutDashboard, group: '', label: 'Billing ERP' }
}

function PageHeading({ shopName, pathname }) {
  const meta = getPageMeta(pathname)
  const Icon = meta?.icon || IconLayoutDashboard
  const title = meta?.label || 'Dashboard'

  return (
    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[var(--surface-elevated)] border border-[var(--line)] text-[#1E3A5F] dark:text-sky-300 shadow-2xs">
        <Icon size={16} strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex flex-col justify-center leading-tight">
        <h1 className="max-w-[125px] truncate font-bold text-[var(--ink)] text-[13px] sm:max-w-none sm:text-[15px] tracking-tight sm:whitespace-normal sm:break-words">
          {title}
        </h1>
        <div className="max-w-[125px] truncate text-[9px] text-[var(--muted)] font-medium leading-snug sm:max-w-none sm:whitespace-nowrap">
          {meta?.group ? `${shopName} · ${meta.group}` : shopName}
        </div>
      </div>
    </div>
  )
}

function LiveDateTime() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const date = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })

  const time = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })

  return (
    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--line)] text-xs text-[var(--muted)] shadow-2xs">
      <IconClock size={13} className="text-[#1E3A5F] dark:text-sky-400 flex-shrink-0" />
      <span className="font-semibold text-[var(--ink)] tabular-nums">{date}</span>
      <span className="text-[var(--line-strong)]">·</span>
      <span className="font-mono font-medium text-[var(--ink)] tabular-nums">{time}</span>
      <span className="text-[9px] font-bold text-[var(--muted)] bg-[var(--surface)] px-1 py-0.5 rounded border border-[var(--line)] uppercase">IST</span>
    </div>
  )
}

function ProfileMenu({ user }) {
  const { logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || user?.email || 'User'
  const initials = displayName.trim().charAt(0).toUpperCase() || 'U'

  useEffect(() => {
    if (!open) return
    const handlePointerDown = event => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false)
    }
    const handleKeyDown = event => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => setOpen(false), [location.pathname, location.search])

  const handleSignOut = () => {
    setOpen(false)
    logout()
    navigate('/login', { replace: true })
  }

  const profileActions = () => (
    <>
      <div className="border-b border-[var(--line)] p-2">
        <button
          type="button"
          role="menuitem"
          aria-pressed={theme === 'dark'}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={toggleTheme}
          className="flex min-h-10 w-full items-center justify-between rounded-md px-2.5 text-xs font-medium text-[var(--ink-secondary)] transition hover:bg-[var(--surface-hover)]"
        >
          <span className="inline-flex items-center gap-2">
            {theme === 'dark' ? <IconMoon size={14} /> : <IconSun size={14} />}
            {theme === 'dark' ? 'Dark mode' : 'Light mode'}
          </span>
          <span className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${theme === 'dark' ? 'bg-[var(--primary)]' : 'bg-[var(--line-strong)]'}`} aria-hidden="true">
            <span className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${theme === 'dark' ? 'translate-x-3' : 'translate-x-0'}`} />
          </span>
        </button>
      </div>

      <div className="space-y-0.5 p-1.5">
        <button
          type="button"
          role="menuitem"
          onClick={() => { setOpen(false); navigate('/settings') }}
          className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-xs font-medium text-[var(--ink-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
        >
          <IconSettings size={15} /> Settings
        </button>
        <button
          type="button"
          role="menuitem"
          onClick={handleSignOut}
          className="flex min-h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
        >
          <IconLogout size={15} /> Sign out
        </button>
      </div>
    </>
  )

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label="Open account options"
        aria-expanded={open}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] sm:h-10 sm:w-auto sm:max-w-[180px] sm:justify-start sm:gap-2 sm:py-1 sm:pl-1 sm:pr-2.5"
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-[var(--primary-contrast)]">
          {initials}
        </span>
        <span className="hidden max-w-28 truncate text-xs font-semibold sm:inline">{displayName}</span>
        <IconChevronDown size={14} className={`hidden text-[var(--muted)] transition-transform sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Profile menu"
          className="absolute right-0 top-full z-50 mt-2 hidden w-[min(18rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-lg sm:block"
        >
          <div className="flex items-center gap-3 border-b border-[var(--line)] px-3 py-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--primary-contrast)]">{initials}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--ink)]">{displayName}</p>
              <p className="truncate text-[11px] text-[var(--muted)]">{user?.email || 'Signed in'}</p>
              {user?.role && <p className="mt-0.5 text-[10px] capitalize text-[var(--muted)]">{user.role}</p>}
            </div>
          </div>
          {profileActions()}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[100] sm:hidden" role="presentation">
          <button
            type="button"
            aria-label="Close profile drawer"
            className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Profile and account options"
            className="absolute inset-x-3 bottom-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-[var(--line)] px-4 py-4">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-[var(--primary-contrast)]">{initials}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--ink)]">{displayName}</p>
                <p className="truncate text-xs text-[var(--muted)]">{user?.email || 'Signed in'}</p>
                {user?.role && <p className="mt-0.5 text-[10px] capitalize text-[var(--muted)]">{user.role}</p>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close profile drawer"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
              >
                <IconX size={18} />
              </button>
            </div>
            {profileActions()}
          </section>
        </div>
      )}
    </div>
  )
}

export default function Layout({ children }) {
  const { user } = useAuth()
  const location = useLocation()
  const mainRef = useRef()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [shopName, setShopName] = useState('Dreamwithtech')
  const [shopPhone, setShopPhone] = useState('')
  const [shopLogo, setShopLogo] = useState('')
  const [activePageLoaders, setActivePageLoaders] = useState(() => new Set())

  const registerPageLoader = useCallback((id, isLoading) => {
    setActivePageLoaders(current => {
      const next = new Set(current)
      if (isLoading) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  useEffect(() => {
    api.get('/settings/all/').then(response => {
      if (response.data?.shop_name) setShopName(response.data.shop_name)
      if (response.data?.shop_phone) setShopPhone(response.data.shop_phone)
      if (response.data?.shop_logo) setShopLogo(response.data.shop_logo)
    }).catch(() => {})

    const onUpdate = e => {
      if (e.detail?.shop_logo) setShopLogo(e.detail.shop_logo)
      if (e.detail?.shop_name) setShopName(e.detail.shop_name)
      if (e.detail?.shop_phone) setShopPhone(e.detail.shop_phone)
    }
    window.addEventListener('shop-settings-updated', onUpdate)
    return () => window.removeEventListener('shop-settings-updated', onUpdate)
  }, [])

  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
    setMobileOpen(false)
    setMobileSearchOpen(false)
  }, [location.pathname])

  const logoSrc = shopLogo || logoImg
  const settingsMode = location.pathname === '/settings' || location.pathname.startsWith('/settings/')

  return (
    <ShopContext.Provider value={{ logoSrc, shopName }}>
      <div className="flex h-screen h-[100dvh] min-h-0 overflow-hidden" style={{ background: 'var(--app-bg)' }}>

        {/* Sidebar Desktop */}
        <div className={`hidden md:flex flex-shrink-0 p-2 transition-all duration-300 ease-in-out ${settingsMode || !collapsed ? 'w-[236px]' : 'w-[78px]'}`}>
          <Sidebar
            collapsed={settingsMode ? false : collapsed}
            mobile={false}
            settingsMode={settingsMode}
            user={user}
            shopName={shopName}
            shopPhone={shopPhone}
            logoSrc={logoSrc}
            onNav={() => {}}
            onToggle={() => setCollapsed(v => !v)}
            onClose={() => {}}
          />
        </div>

        {/* Sidebar Mobile Overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <Sidebar
              collapsed={false}
              mobile={true}
              settingsMode={settingsMode}
              user={user}
              shopName={shopName}
              shopPhone={shopPhone}
              logoSrc={logoSrc}
              onNav={() => setMobileOpen(false)}
              onToggle={() => {}}
              onClose={() => setMobileOpen(false)}
            />
            <div className="flex-1 bg-black/60 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Top Menu Bar / Header */}
          <header className="flex-shrink-0 z-10 bg-[var(--surface)] border-b border-[var(--line)] shadow-xs">
            <div className="flex min-h-12 min-w-0 items-center gap-1.5 px-2 py-1 sm:min-h-14 sm:gap-3 sm:px-5 sm:py-1.5">
              <button
                onClick={() => setMobileOpen(true)}
                title="Open menu"
                aria-label="Open menu"
                className="md:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
              >
                <MenuIcon size={20} />
              </button>

              {/* Page Title & Breadcrumb */}
              <PageHeading shopName={shopName} pathname={location.pathname} />

              <div className="flex-1 min-w-2" />

              {/* Global Search (Desktop) */}
              <div className="hidden lg:block">
                <GlobalSearch />
              </div>

              {/* Mobile Search Toggle */}
              <button
                onClick={() => setMobileSearchOpen(v => !v)}
                title="Search"
                aria-label="Search"
                className={`lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  mobileSearchOpen
                    ? 'bg-slate-100 text-[#1E3A5F] dark:bg-slate-800 dark:text-slate-200'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
                }`}
              >
                <IconSearch size={18} />
              </button>

              <div className="hidden lg:block w-px h-5 bg-[var(--line)]" />

              {/* Notifications */}
              <NotificationBell />

              <div className="hidden lg:block w-px h-5 bg-[var(--line)]" />

              {/* Live Clock */}
              <LiveDateTime />

              <div className="hidden sm:block w-px h-5 bg-[var(--line)]" />

              <ProfileMenu user={user} />
            </div>

            {/* Mobile Search Bar Expansion */}
            {mobileSearchOpen && (
              <div className="lg:hidden px-3 py-2.5 bg-[var(--surface-elevated)] border-t border-[var(--line)]">
                <GlobalSearch />
              </div>
            )}
          </header>

          {/* Page Body */}
          <main ref={mainRef} className={`min-w-0 min-h-0 flex-1 flex flex-col ${location.pathname.startsWith('/billing/new') ? 'overflow-y-auto md:overflow-hidden' : 'overflow-y-auto'} bg-[var(--app-bg)]`}>
            <div className={location.pathname.startsWith('/billing/new') ? 'flex-1 flex flex-col p-1.5 sm:p-3 w-full max-w-none min-w-0 min-h-0' : 'flex-1 p-2.5 sm:p-4 md:p-6 max-w-[1600px] w-full min-w-0 mx-auto page-enter'}>
              <PageLoadingContext.Provider value={registerPageLoader}>
                {children}
              </PageLoadingContext.Provider>
            </div>
            {!activePageLoaders.size && !location.pathname.startsWith('/billing/new') && <AppFooter shopName={shopName} />}
          </main>
        </div>
      </div>
    </ShopContext.Provider>
  )
}
