import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useTheme } from '../ThemeContext'
import api from '../api'
import logoImg from '../assets/logo.png'
import {
  LayoutDashboard, ShoppingCart, FileText, Package, Users, BarChart2,
  UserCog, Settings, LogOut, ChevronDown, ChevronUp, ChevronRight,
  Search, Bell, RotateCcw, CreditCard, Boxes, ShoppingBag, Building2,
  IndianRupee, HelpCircle, Layers, Activity, X, Sun, Moon, Clock, ScanLine, ArrowRight, Check,
  ShieldCheck, Trash2
} from 'lucide-react'
import { useEffect, useState, createContext, useContext, useRef, useCallback } from 'react'

import AppFooter from './AppFooter'

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
      { to: '/reports', icon: BarChart2, label: 'Reports', roles: ['owner', 'admin', 'manager', 'accountant'] }
    ]
  },
  {
    label: 'Administration',
    adminOnly: true,
    items: [
      { to: '/users', icon: UserCog, label: 'Users', adminOnly: true },
      { to: '/settings', icon: Settings, label: 'Settings', adminOnly: true },
      { to: '/audit-trail', icon: ShieldCheck, label: 'Audit Trail', adminOnly: true },
      { to: '/recycle-bin', icon: Trash2, label: 'Recycle Bin', adminOnly: true },
      { to: '/payments/reconciliation', icon: ScanLine, label: 'Reconciliation', adminOnly: true },
      { to: '/support', icon: HelpCircle, label: 'Support' }
    ]
  }
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

  const visibleItems = group.items.filter(item => {
    if (item.to === '/support') return true
    if (item.roles && !item.roles.includes(user?.role)) return false
    return !item.adminOnly || ['admin', 'owner'].includes(user?.role)
  })
  if (!visibleItems.length) return null

  if (group.adminOnly && !['admin', 'owner'].includes(user?.role)) {
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
      <div className="px-2 mb-2">
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
                  ? 'bg-[#1E3A5F] text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:bg-[#1E293B] hover:text-white'
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
    <div className="mb-2">
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
        <div className="space-y-0.5 px-2">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onNav}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#1E3A5F] text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:bg-[#1E293B] hover:text-white'
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

function Sidebar({ collapsed, mobile, user, shopName, logoSrc, onLogout, onNav, onToggle, onClose }) {
  const [headerHovered, setHeaderHovered] = useState(false)

  return (
    <div
      className={`flex flex-col h-full transition-all duration-300 ease-in-out select-none ${
        mobile ? 'w-64' : collapsed ? 'w-[62px]' : 'w-[220px]'
      }`}
      style={{ background: '#0F172A' }}
    >
      {/* Brand Header */}
      <div
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        onClick={collapsed && !mobile ? onToggle : undefined}
        className={`flex items-center flex-shrink-0 border-b border-[#1E293B] transition-all duration-300 cursor-pointer ${
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
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.1] flex items-center justify-center flex-shrink-0 p-1">
              <img src={logoSrc} alt={shopName} className="w-full h-full object-contain rounded" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[13.5px] text-white truncate leading-tight tracking-tight">{shopName}</div>
              <div className="text-[10px] text-slate-400 uppercase tracking-[0.14em] font-semibold mt-0.5">ERP System</div>
            </div>
            {!mobile && (
              <button
                onClick={onToggle}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all duration-150 flex-shrink-0"
              >
                <MenuIcon size={18} />
              </button>
            )}
            {mobile && (
              <button
                onClick={onClose}
                title="Close menu"
                aria-label="Close menu"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all flex-shrink-0"
              >
                <X size={17} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-3 space-y-1 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {NAV_GROUPS.map(group => (
          <NavGroup key={group.label} group={group} collapsed={collapsed && !mobile} user={user} onNav={onNav} />
        ))}
      </nav>

      {/* User / Sign Out Footer */}
      <div className={`border-t border-[#1E293B] flex-shrink-0 ${collapsed && !mobile ? 'px-2 py-3' : 'px-3 py-3'}`}>
        {collapsed && !mobile ? (
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
              <div className="text-[10px] text-slate-400 capitalize font-medium">{user?.role || 'Staff'}</div>
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
    <div ref={ref} className="relative">
      <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 w-full max-w-sm transition-all duration-150 border ${
        open || q
          ? 'bg-[var(--surface)] border-[var(--primary)] shadow-xs ring-1 ring-[var(--primary)]'
          : 'bg-[var(--surface-elevated)] border-[var(--line)] hover:border-[var(--line-strong)]'
      }`}>
        <Search size={15} className="text-[var(--muted)] flex-shrink-0" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(e.target.value.length > 0) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (!q) setOpen(false) }}
          onKeyDown={handleKeyDown}
          placeholder="Search products… (Ctrl+K)"
          aria-label="Search products"
          className="bg-transparent text-xs outline-none w-full text-[var(--ink)] placeholder:text-[var(--placeholder)]"
        />
        {q ? (
          <button onClick={() => { setQ(''); setOpen(false) }} aria-label="Clear search" className="text-[var(--muted)] hover:text-[var(--ink)]">
            <X size={13} />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-light)] bg-[var(--surface)] border border-[var(--line)] rounded">⌘K</kbd>
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

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [criticalCount, setCriticalCount] = useState(0)
  const ref = useRef()
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadNotifications = useCallback(() => {
    api.get('/notifications/?limit=6').then(({ data }) => {
      setNotifications(data.notifications || [])
      setUnreadCount(data.unread_count || 0)
      setCriticalCount(data.critical_count || 0)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    loadNotifications()
    const timer = setInterval(loadNotifications, 45000)
    return () => clearInterval(timer)
  }, [loadNotifications])

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all/')
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
      setCriticalCount(0)
    } catch {}
  }

  const handleNotificationClick = async (n) => {
    if (!n.is_read) {
      try {
        await api.post(`/notifications/${n.id}/read/`)
        setUnreadCount(c => Math.max(0, c - 1))
      } catch {}
    }
    setOpen(false)
    if (n.action_url) {
      navigate(n.action_url)
    } else {
      navigate('/notifications')
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-all"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white bg-[#DC2626]"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[var(--surface)] rounded-[12px] shadow-[var(--shadow-lg)] border border-[var(--line)] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--line)] bg-[var(--surface-elevated)]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--ink)] text-xs uppercase tracking-wider">Alerts</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-slate-100 text-[#1E3A5F] border border-[#D7DEE7] px-1.5 py-0.5 rounded">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-medium text-[#1E3A5F] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="divide-y divide-[var(--line-subtle)] max-h-80 overflow-y-auto">
            {notifications.length ? (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`w-full flex items-start gap-2.5 px-3.5 py-2.5 hover:bg-[var(--surface-hover)] cursor-pointer transition-colors text-left ${
                    !n.is_read ? 'bg-slate-50 dark:bg-slate-800/40' : ''
                  }`}
                >
                  <div
                    className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                      n.severity === 'danger'
                        ? 'bg-[#B91C1C]'
                        : n.severity === 'warning'
                          ? 'bg-[#B45309]'
                          : n.severity === 'success'
                            ? 'bg-[#15803D]'
                            : 'bg-[#1E3A5F]'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-[var(--ink)] truncate">
                        {n.title}
                      </p>
                      <span className="text-[10px] font-mono text-[var(--muted)] flex-shrink-0">
                        {n.created_at ? new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--ink-secondary)] line-clamp-2 mt-0.5">
                      {n.message}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-xs text-[var(--muted)] text-center">
                All caught up — no notifications
              </div>
            )}
          </div>

          <div className="border-t border-[var(--line)] bg-[var(--surface-elevated)] p-2">
            <button
              onClick={() => {
                setOpen(false)
                navigate('/notifications')
              }}
              className="w-full py-1.5 text-center text-xs font-semibold text-[#1E3A5F] hover:underline flex items-center justify-center gap-1"
            >
              <span>Open Notification Center</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>
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
          <div className="text-[10px] text-[var(--muted)] capitalize">{user?.role || 'Staff'}</div>
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
                <div className="text-[11px] text-[var(--muted)] capitalize">{user?.role || 'Staff'}</div>
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

function PageHeading({ shopName, pathname }) {
  const meta = PAGE_META[pathname]
  const Icon = meta?.icon || LayoutDashboard
  const title = meta?.label || 'Dashboard'

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--ink)] shadow-xs">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex flex-col justify-center leading-tight">
        <h1 className="font-bold text-[var(--ink)] text-[15px] sm:text-[16px] tracking-tight truncate">
          {title}
        </h1>
        <div className="text-[10px] text-[var(--muted)] font-medium truncate hidden sm:block">
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
    <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--line)] text-xs text-[var(--muted)]">
      <Clock size={13} className="text-[var(--muted)] flex-shrink-0" />
      <span className="font-semibold text-[var(--ink)] tabular-nums">{date}</span>
      <span className="text-[var(--line-strong)]">·</span>
      <span className="font-medium tabular-nums">{time}</span>
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
  const [shopLogo, setShopLogo] = useState('')

  useEffect(() => {
    api.get('/settings/all/').then(response => {
      if (response.data?.shop_name) setShopName(response.data.shop_name)
      if (response.data?.shop_logo) setShopLogo(response.data.shop_logo)
    }).catch(() => {})

    const onUpdate = e => {
      if (e.detail?.shop_logo) setShopLogo(e.detail.shop_logo)
      if (e.detail?.shop_name) setShopName(e.detail.shop_name)
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

  return (
    <ShopContext.Provider value={{ logoSrc, shopName }}>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--app-bg)' }}>

        {/* Sidebar Desktop */}
        <div className={`hidden md:flex flex-shrink-0 shadow-[1px_0_8px_rgba(0,0,0,0.12)] transition-all duration-300 ease-in-out ${collapsed ? 'w-[62px]' : 'w-[220px]'}`}>
          <Sidebar
            collapsed={collapsed}
            mobile={false}
            user={user}
            shopName={shopName}
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
              user={user}
              shopName={shopName}
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
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-14">
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

              <div className="hidden xl:block w-px h-5 bg-[var(--line)]" />

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
          <main ref={mainRef} className={`flex-1 flex flex-col ${location.pathname.startsWith('/billing/new') ? 'overflow-y-auto md:overflow-hidden' : 'overflow-y-auto'} bg-[var(--app-bg)]`}>
            <div className={location.pathname.startsWith('/billing/new') ? 'flex-1 flex flex-col p-2 sm:p-3 w-full max-w-none min-h-0' : 'flex-1 p-3 sm:p-4 md:p-6 max-w-[1600px] w-full mx-auto page-enter'}>
              {children}
            </div>
            {!location.pathname.startsWith('/billing/new') && <AppFooter shopName={shopName} />}
          </main>
        </div>
      </div>
    </ShopContext.Provider>
  )
}
