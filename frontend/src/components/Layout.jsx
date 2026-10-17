import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useTheme } from '../ThemeContext'
import api from '../api'
import logoImg from '../assets/logo.png'
import { ROLES } from '../constants'
import {
  LayoutDashboard, ShoppingCart, FileText, Package, Users, BarChart2,
  UserCog, Settings, LogOut, ChevronDown, ChevronUp, ChevronRight,
  Search, Bell, RotateCcw, CreditCard, Boxes, ShoppingBag, Building2,
  IndianRupee, HelpCircle, Layers, Activity, X, Sun, Moon, Clock, ScanLine, ArrowRight, Check,
  ShieldCheck, Trash2, AlertCircle, AlertTriangle, CheckCircle2, XCircle
} from 'lucide-react'
import { useEffect, useState, createContext, useContext, useRef, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'

import AppFooter from './AppFooter'
import { PageLoadingContext } from './PageLoadingContext'
import { SETTINGS_TABS } from './SettingsNavigation'
import appPackage from '../../package.json'

function MenuIcon({ size = 20 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 50 50" fill="currentColor" aria-hidden="true">
      <path d="M 3 9 A 1.0001 1.0001 0 1 0 3 11 L 47 11 A 1.0001 1.0001 0 1 0 47 9 L 3 9 z M 3 24 A 1.0001 1.0001 0 1 0 3 26 L 47 26 A 1.0001 1.0001 0 1 0 47 24 L 3 24 z M 3 39 A 1.0001 1.0001 0 1 0 3 41 L 47 41 A 1.0001 1.0001 0 1 0 47 39 L 3 39 z" />
    </svg>
  )
}

export const ShopContext = createContext({ logoSrc: '', shopName: 'Dreamwithtech' })
export const useShop = () => useContext(ShopContext)

const NAV_GROUPS = [
  {
    label: 'Dashboard',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ]
  },
  {
    label: 'Billing',
    items: [
      { to: '/billing/new', icon: ShoppingCart, label: 'New Bill' },
      { to: '/sales/invoices', icon: FileText, label: 'Invoices' },
      { to: '/billing/drafts', icon: Layers, label: 'Drafts' },
      { to: '/sales/returns', icon: RotateCcw, label: 'Returns' },
      { to: '/sales/payments', icon: CreditCard, label: 'Payments' }
    ]
  },
  {
    label: 'Inventory',
    items: [
      { to: '/inventory/products', icon: Package, label: 'Products' },
      { to: '/inventory/stock', icon: Boxes, label: 'Stock' },
      { to: '/inventory/purchases', icon: ShoppingBag, label: 'Purchases' }
    ]
  },
  {
    label: 'Contacts',
    items: [
      { to: '/parties/customers', icon: Users, label: 'Customers' },
      { to: '/parties/suppliers', icon: Building2, label: 'Suppliers' }
    ]
  },
  {
    label: 'Business',
    items: [
      { to: '/expenses', icon: IndianRupee, label: 'Expenses' },
      { to: '/reports', icon: BarChart2, label: 'Reports', roles: [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT] }
    ]
  },
  {
    label: 'Administration',
    adminOnly: true,
    items: [
      { to: '/users', icon: UserCog, label: 'Users', adminOnly: true },
      { to: '/recycle-bin', icon: Trash2, label: 'Recycle Bin', adminOnly: true },
      { to: '/payments/reconciliation', icon: ScanLine, label: 'Reconciliation', adminOnly: true },
      { to: '/support', icon: HelpCircle, label: 'Support' }
    ]
  }
]

const SIDEBAR_UTILITY_ITEMS = [
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/audit-trail', icon: ShieldCheck, label: 'Business Activity' },
]

const PAGE_META = NAV_GROUPS.reduce((acc, group) => {
  group.items.forEach(item => {
    acc[item.to] = { icon: item.icon, group: group.label, label: item.label }
  })
  return acc
}, {})

function NavGroup({ group, collapsed, user, onNav }) {
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
      groupLabel={group.label}
      open={open}
      setOpen={setOpen}
      onNav={onNav}
    />
  )
}

function NavGroupItems({ items, collapsed, groupLabel, open, setOpen, onNav }) {
  if (collapsed) {
    return (
      <div className="px-2 mb-2.5">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNav}
            title={label}
            className={({ isActive }) =>
              `relative flex items-center justify-center w-10 h-10 rounded-lg mb-1 transition-all duration-150 group ${
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
    <div className={`mb-2.5 ${groupLabel === 'Dashboard' ? '' : 'border-t border-white/[0.06] pt-1.5'}`}>
      {/* Group header: strictly neutral, never highlighted when active */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 mb-1 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
          {groupLabel}
        </span>
        {open ? <ChevronUp size={11} className="opacity-50" /> : <ChevronRight size={11} className="opacity-50" />}
      </button>

      {open && (
        <div className="space-y-1 px-2">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onNav}
              className={({ isActive }) =>
                `relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)] shadow-xs font-semibold'
                    : 'text-slate-300 hover:bg-[var(--sidebar-hover)] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={`flex-shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function Sidebar({ collapsed, mobile, settingsMode, user, shopName, shopPhone, logoSrc, onLogout, onNav, onToggle, onClose }) {
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
              <div className={`font-bold text-[13.5px] truncate leading-tight tracking-tight ${settingsMode ? 'text-slate-900' : 'text-white'}`}>{shopName}</div>
              {settingsMode && shopPhone && <div className="mt-1 truncate text-[10px] font-medium text-slate-500">{shopPhone}</div>}
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
                <X size={17} />
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
            <ArrowRight size={15} className="rotate-180" />
            <span>Back to Dashboard</span>
          </NavLink>
        </div>
      )}

      {/* Nav List */}
      <nav className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain py-3.5 space-y-1" style={{ scrollbarWidth: 'thin', scrollbarColor: settingsMode ? '#CBD5E1 transparent' : 'rgba(148,163,184,.35) transparent' }}>
        {settingsMode ? (
          <div className="px-2">
            {(!collapsed || mobile) && <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">Settings</p>}
            <div className="space-y-1">
              {SETTINGS_TABS.map(({ id, label, icon: Icon, badge }) => {
                const isActive = currentSettingsTab === id
                return (
                  <NavLink
                    key={id}
                    to={`/settings?tab=${id}`}
                    onClick={onNav}
                    title={collapsed && !mobile ? label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex min-h-10 items-center rounded-xl text-[12px] font-medium transition-colors duration-150 ${
                      collapsed && !mobile ? 'justify-center px-2' : 'gap-3 px-3'
                    } ${isActive
                      ? 'bg-indigo-50 text-indigo-800 font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={16} strokeWidth={1.8} className={`shrink-0 ${isActive ? 'text-indigo-700' : 'text-slate-400'}`} />
                    {(!collapsed || mobile) && (
                      <>
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                        {badge && <span className={`max-w-24 truncate rounded px-1.5 py-0.5 text-[9px] ${isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{badge}</span>}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ) : NAV_GROUPS.map(group => (
          <NavGroup key={group.label} group={group} collapsed={collapsed && !mobile} user={user} onNav={onNav} />
        )).concat(!settingsMode && canAccessUtility ? [
          <div key="settings-security" className={`mt-2.5 border-t border-white/10 pt-2.5 ${collapsed && !mobile ? 'px-2' : 'px-2.5'}`}>
            {(!collapsed || mobile) && <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">Settings &amp; Security</p>}
            <div className="space-y-1">
              {SIDEBAR_UTILITY_ITEMS.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onNav}
                  title={collapsed && !mobile ? label : undefined}
                  className={({ isActive }) => `flex min-h-9 items-center rounded-xl text-[12px] font-medium transition-colors ${
                    collapsed && !mobile ? 'justify-center' : 'gap-2.5 px-2.5'
                  } ${isActive
                    ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-text)] font-semibold'
                    : 'text-slate-300 hover:bg-[var(--sidebar-hover)] hover:text-white'
                  }`}
                >
                  <Icon size={15} className="shrink-0 text-slate-400" />
                  {(!collapsed || mobile) && <span className="truncate">{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>,
        ] : [])}
      </nav>

      {/* User / Sign Out Footer */}
      <div className={`flex-shrink-0 ${settingsMode ? 'border-t border-slate-200 bg-slate-50/80 px-3 py-3' : ''} ${collapsed && !mobile ? 'px-2 py-3' : 'px-3 py-3.5'}`}>
        {settingsMode ? (
          <>
            <div className="flex items-center gap-2.5 px-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-indigo-50 text-xs font-bold text-indigo-700">
                {((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')) || user?.username?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold leading-tight text-slate-800">
                  {[user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username}
                </div>
                <div className="mt-0.5 text-[10px] font-medium capitalize text-slate-500">{user?.role || 'Staff'}</div>
              </div>
            </div>
            <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
              <ShieldCheck size={14} className="shrink-0 text-emerald-600" />
              <span className="text-[10px] font-medium text-slate-600">Secure settings access</span>
            </div>
            <div className="mt-2 px-1 text-[10px] text-slate-400">App version {appPackage.version}</div>

            <div className="mt-3 border-t border-slate-200 pt-2.5">
              <button
                type="button"
                onClick={onLogout}
                className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
              >
                <LogOut size={15} />
                <span>Logout</span>
              </button>
            </div>
          </>
        ) : collapsed && !mobile ? (
          <button
            onClick={onLogout}
            title="Sign Out"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-[#1E293B] transition-all mx-auto"
          >
            <LogOut size={16} />
          </button>
        ) : (
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-full bg-[#1E3A5F] border border-slate-700 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-xs">
              {((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')) || user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-slate-200 truncate leading-tight">
                {[user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username}
              </div>
              <div className="text-[10px] text-slate-300 capitalize font-medium flex items-center gap-1 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                <span>{user?.role || 'Staff'}</span>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Sign Out"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-[#1F2937] transition-all flex-shrink-0"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
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
          <Search size={13} strokeWidth={2.2} />
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
            <X size={12} strokeWidth={2.5} />
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
  danger:  { icon: AlertCircle,   color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  warning: { icon: AlertTriangle, color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  success: { icon: CheckCircle2,  color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  info:    { icon: Bell,          color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
}

function relativeTime(isoString) {
  if (!isoString) return ''
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
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
        <Bell size={17} className={criticalCount > 0 ? 'text-red-600' : ''} />
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
                  <Bell size={16} className={criticalCount > 0 ? 'text-red-600' : ''} />
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
                    className="btn-secondary h-7 px-2 text-[11px] font-semibold text-[var(--primary)] inline-flex items-center gap-1"
                    title="Mark all as read"
                  >
                    <Check size={11} />
                    <span>Read all</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                  aria-label="Close notification drawer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Critical banner */}
            {criticalCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900/40">
                <AlertCircle size={14} className="text-red-600 flex-shrink-0" />
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
                  className={`h-7 px-2.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition ${
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
                      {/* Top row: Severity badge & timestamp */}
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 font-bold"
                            style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}
                          >
                            <SevIcon size={10} />
                            <span>{sev.label}</span>
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
                        <span className="text-[10px] text-[var(--muted)] font-mono shrink-0">
                          {relativeTime(n.created_at)}
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
                        <p className="text-[11px] text-[var(--muted)] line-clamp-2 mt-0.5 leading-relaxed">
                          {n.message}
                        </p>
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
                                  className="h-7 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-2xs transition"
                                  title="Approve & execute request"
                                >
                                  <CheckCircle2 size={12} />
                                  <span>{isActing ? 'Saving…' : 'Approve'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={e => handleQuickApproval(e, n, 'reject')}
                                  disabled={isActing}
                                  className="h-7 px-2.5 rounded-md border border-rose-300 dark:border-rose-800 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-[11px] font-semibold inline-flex items-center gap-1 shadow-2xs transition"
                                  title="Reject request"
                                >
                                  <XCircle size={12} />
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
                            className="h-7 px-2.5 rounded-md bg-[var(--primary)] text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-2xs hover:brightness-110 transition"
                          >
                            <span>Review PO</span>
                            <ArrowRight size={11} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleNotificationClick(n)}
                            className="h-7 px-2.5 rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--ink)] text-[11px] font-semibold inline-flex items-center gap-1 shadow-2xs transition"
                          >
                            <span>Open Details</span>
                            <ArrowRight size={11} />
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
                            className="h-7 px-2 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-elevated)] text-[11px] font-medium inline-flex items-center gap-1"
                            title="Mark as read"
                          >
                            <Check size={11} />
                            <span>Read</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <CheckCircle2 size={28} className="text-teal-500" />
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
                <Activity size={12} />
                <span>Refresh</span>
              </button>

              <button
                type="button"
                onClick={() => { setOpen(false); navigate('/notifications') }}
                className="btn-primary h-8 px-3 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <span>Full Notifications Center</span>
                <ArrowRight size={12} />
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    const handleClickOutside = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials = ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')) || user?.username?.[0]?.toUpperCase() || 'U'
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 hover:bg-[var(--surface-hover)] rounded-lg px-2 py-1.5 transition-all border border-transparent hover:border-[var(--line)]"
      >
        <div className="w-8 h-8 rounded-full bg-[#1E3A5F] border border-[#D7DEE7] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-xs">
          {initials}
        </div>
        <div className="text-left hidden md:block">
          <div className="text-xs font-semibold text-[var(--ink)] leading-tight">{fullName}</div>
          <div className="text-[10px] text-[var(--muted)] capitalize font-medium flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500"></span>
            <span>{user?.role || 'Staff'}</span>
          </div>
        </div>
        <ChevronDown size={13} className={`text-[var(--muted)] hidden md:block transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--surface)] rounded-[12px] shadow-[var(--shadow-lg)] border border-[var(--line)] z-50 overflow-hidden">
          <div className="px-4 py-3 bg-[var(--surface-elevated)] border-b border-[var(--line)]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#1E3A5F] border border-[#D7DEE7] text-white text-sm font-bold flex items-center justify-center">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[var(--ink)] text-sm truncate">{fullName}</div>
                <div className="mt-0.5">
                  <span className=" text-[10px] text-[var(--muted)] capitalize font-medium flex items-center gap-1">
                    {user?.role || 'Staff'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="py-1.5">
            <NavLink
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] transition-colors"
            >
              <Settings size={14} className="text-[var(--muted)]" />
              Settings
            </NavLink>
            <button
              onClick={() => { toggleTheme(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              {theme === 'dark' ? <Sun size={14} className="text-[var(--muted)]" /> : <Moon size={14} className="text-[var(--muted)]" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <div className="h-px bg-[var(--line)] my-1 mx-3" />
            <button
              onClick={() => { setOpen(false); onLogout() }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function getPageMeta(pathname) {
  if (PAGE_META[pathname]) return PAGE_META[pathname]
  if (pathname.startsWith('/invoice/')) return { icon: FileText, group: 'Billing', label: 'Invoice Details' }
  if (pathname.startsWith('/public-bill/') || pathname.startsWith('/bill/')) return { icon: FileText, group: 'Billing', label: 'Digital Bill' }
  if (pathname.startsWith('/parties/customers/')) return { icon: Users, group: 'Contacts', label: 'Customer Details' }
  if (pathname.startsWith('/parties/suppliers/')) return { icon: Building2, group: 'Contacts', label: 'Supplier Details' }
  if (pathname.startsWith('/inventory/products/')) return { icon: Package, group: 'Inventory', label: 'Product Details' }
  if (pathname.startsWith('/inventory/purchases/')) return { icon: ShoppingBag, group: 'Inventory', label: 'Purchases' }
  if (pathname.startsWith('/sales/invoices')) return { icon: FileText, group: 'Billing', label: 'Billing & Invoices' }
  if (pathname.startsWith('/audit-trail')) return { icon: ShieldCheck, group: 'Administration', label: 'Audit Trail' }
  if (pathname.startsWith('/billing/new')) return { icon: ShoppingCart, group: 'Billing', label: 'New Sale' }
  if (pathname.startsWith('/sales/payments')) return { icon: CreditCard, group: 'Billing', label: 'Payments' }
  if (pathname.startsWith('/billing/drafts')) return { icon: Layers, group: 'Billing', label: 'Parked Bills' }
  if (pathname.startsWith('/sales/returns')) return { icon: RotateCcw, group: 'Billing', label: 'Sales Returns' }
  return { icon: LayoutDashboard, group: '', label: 'Billing ERP' }
}

function PageHeading({ shopName, pathname }) {
  const meta = getPageMeta(pathname)
  const Icon = meta?.icon || LayoutDashboard
  const title = meta?.label || 'Dashboard'

  return (
    <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-[var(--surface-elevated)] border border-[var(--line)] text-[#1E3A5F] dark:text-sky-300 shadow-2xs">
        <Icon size={16} strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex flex-col justify-center leading-tight">
        <h1 className="font-bold text-[var(--ink)] text-[13px] sm:text-[15px] tracking-tight truncate">
          {title}
        </h1>
        <div className="text-[10px] text-[var(--muted)] font-medium truncate">
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
      <Clock size={13} className="text-[#1E3A5F] dark:text-sky-400 flex-shrink-0" />
      <span className="font-semibold text-[var(--ink)] tabular-nums">{date}</span>
      <span className="text-[var(--line-strong)]">·</span>
      <span className="font-mono font-medium text-[var(--ink)] tabular-nums">{time}</span>
      <span className="text-[9px] font-bold text-[var(--muted)] bg-[var(--surface)] px-1 py-0.5 rounded border border-[var(--line)] uppercase">IST</span>
    </div>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
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

  const handleLogout = () => { logout(); navigate('/login') }
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
            onLogout={handleLogout}
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
              onLogout={handleLogout}
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
            <div className="flex min-w-0 items-center gap-1.5 px-2.5 sm:gap-3 sm:px-5 h-14">
              <button
                onClick={() => setMobileOpen(true)}
                title="Open menu"
                aria-label="Open menu"
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] transition-all duration-150"
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
                className={`lg:hidden w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-150 ${
                  mobileSearchOpen
                    ? 'bg-slate-100 text-[#1E3A5F] dark:bg-slate-800 dark:text-slate-200'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
                }`}
              >
                <Search size={18} />
              </button>

              <div className="hidden lg:block w-px h-5 bg-[var(--line)]" />

              {/* Notifications */}
              <NotificationBell />

              <div className="hidden lg:block w-px h-5 bg-[var(--line)]" />

              {/* Live Clock */}
              <LiveDateTime />

              <div className="w-px h-5 bg-[var(--line)]" />

              {/* Profile Menu */}
              <ProfileMenu user={user} onLogout={handleLogout} />
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
