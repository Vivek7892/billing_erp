import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import { useTheme } from '../ThemeContext'
import api from '../api'
import logoImg from '../assets/logo.png'
import {
  LayoutDashboard, ShoppingCart, FileText, Package, Users, BarChart2,
  UserCog, Settings, LogOut, ChevronDown, ChevronUp, ChevronRight,
  Search, Bell, RotateCcw, CreditCard, Boxes, ShoppingBag, Building2,
  IndianRupee, HelpCircle, Layers, Activity, X, Sun, Moon
} from 'lucide-react'
import { useEffect, useState, createContext, useContext, useRef } from 'react'

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
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' }
    ]
  },
  {
    label: 'Sales',
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

// Support is visible to all roles even though it's in the admin group
const SUPPORT_ITEM = { to: '/support', icon: HelpCircle, label: 'Support' }

const GROUP_ACCENT = {
  Overview: 'text-blue-400', Sales: 'text-blue-400', Inventory: 'text-amber-400',
  Contacts: 'text-cyan-400', Business: 'text-blue-400', Administration: 'text-slate-400'
}
const ACTIVE_BG = {
  Overview: 'bg-blue-600', Sales: 'bg-blue-600', Inventory: 'bg-blue-600',
  Contacts: 'bg-blue-600', Business: 'bg-blue-600', Administration: 'bg-blue-600'
}
const ACCENT_HEX = {
  Overview: '#60a5fa', Sales: '#2563eb', Inventory: '#f59e0b',
  Contacts: '#0891b2', Business: '#2563eb', Administration: '#94a3b8'
}

function NavGroup({ group, collapsed, user, onNav }) {
  const location = useLocation()
  const [open, setOpen] = useState(true)

  const visibleItems = group.items.filter(item => {
    if (item.to === '/support') return true
    if (item.roles && !item.roles.includes(user?.role)) return false
    return !item.adminOnly || user?.role === 'admin'
  })
  if (!visibleItems.length) return null
  if (group.adminOnly && user?.role !== 'admin') {
    const supportOnly = visibleItems.filter(i => i.to === '/support')
    if (!supportOnly.length) return null
    return <NavGroupItems items={supportOnly} collapsed={collapsed} activeBg={ACTIVE_BG[group.label]} accent={GROUP_ACCENT[group.label]} groupLabel={group.label} open={open} setOpen={setOpen} onNav={onNav} location={location} isGroupActive={supportOnly.some(i => location.pathname.startsWith(i.to))} />
  }

  const isGroupActive = visibleItems.some(item =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  )
  const activeBg = ACTIVE_BG[group.label] || 'bg-indigo-600'
  const accent = GROUP_ACCENT[group.label] || 'text-slate-400'

  return <NavGroupItems items={visibleItems} collapsed={collapsed} activeBg={activeBg} accent={accent} groupLabel={group.label} open={open} setOpen={setOpen} onNav={onNav} location={location} isGroupActive={isGroupActive} />
}

function NavGroupItems({ items, collapsed, activeBg, accent, groupLabel, open, setOpen, onNav, location, isGroupActive }) {
  if (collapsed) {
    return (
      <div className="px-2 mb-2">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onNav} title={label}
            className={({ isActive }) =>
              `relative flex items-center justify-center w-10 h-10 rounded-xl mb-1 transition-all duration-150 group ${
                isActive ? `${activeBg} text-white shadow-lg` : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-white/70" />}
                <Icon size={16} />
                <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100] shadow-xl border border-slate-700/80">
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
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-3 py-1.5 mb-0.5 rounded-md transition-colors ${
          isGroupActive ? accent : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <span className="text-[9.5px] font-bold uppercase tracking-[0.12em]">{groupLabel}</span>
        {open ? <ChevronUp size={9} className="opacity-40" /> : <ChevronRight size={9} className="opacity-40" />}
      </button>
      {open && (
        <div className="space-y-0.5 px-2">
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={onNav}
              className={({ isActive }) =>
                `relative flex items-center gap-2.5 px-2.5 py-[7px] rounded-xl text-[13px] font-medium transition-all duration-150 ${
                  isActive ? `${activeBg} text-white shadow-sm` : 'text-slate-400 hover:bg-white/[0.07] hover:text-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full bg-white/60" />}
                  <Icon size={15} className="flex-shrink-0" />
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
      className={`flex flex-col h-full transition-all duration-300 ease-in-out ${
        mobile ? 'w-64' : collapsed ? 'w-[62px]' : 'w-[220px]'
      }`}
      style={{ background: 'linear-gradient(180deg, #0d1526 0%, #0f172a 55%, #111827 100%)' }}
    >
      <div
        onMouseEnter={() => setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        onClick={collapsed && !mobile ? onToggle : undefined}
        className={`flex items-center flex-shrink-0 border-b border-white/[0.06] transition-all duration-300 cursor-pointer ${
          collapsed && !mobile ? 'justify-center px-2 py-4' : 'gap-3 px-4 py-4'
        }`}
      >
        {collapsed && !mobile ? (
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className={`absolute inset-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${headerHovered ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}`}>
              <img src={logoSrc} alt={shopName} className="w-8 h-8 object-contain rounded-xl" />
            </div>
            <div
              title="Expand sidebar"
              className={`absolute inset-0 w-8 h-8 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-all duration-200 ${headerHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
            >
              <MenuIcon size={18} />
            </div>
          </div>
        ) : (
          <>
            <img src={logoSrc} alt={shopName} className="w-8 h-8 object-contain rounded-xl flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[13px] text-white truncate leading-tight">{shopName}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-[0.15em] font-medium mt-0.5">ERP System</div>
            </div>
            {!mobile && (
              <button onClick={onToggle} title="Collapse sidebar" aria-label="Collapse sidebar"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all duration-200 flex-shrink-0">
                <MenuIcon size={20} />
              </button>
            )}
            {mobile && (
              <button onClick={onClose} title="Close menu" aria-label="Close menu"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0">
                <X size={18} />
              </button>
            )}
          </>
        )}
      </div>

      <nav className="flex-1 py-2 space-y-0.5" style={{ overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {NAV_GROUPS.map(group => (
          <NavGroup key={group.label} group={group} collapsed={collapsed && !mobile} user={user} onNav={onNav} />
        ))}
      </nav>

      <div className={`border-t border-white/[0.06] flex-shrink-0 ${collapsed && !mobile ? 'px-2 py-3' : 'px-3 py-3'}`}>
        {collapsed && !mobile ? (
          <button onClick={onLogout} title="Sign Out"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all mx-auto">
            <LogOut size={16} />
          </button>
        ) : (
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
              {((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')) || user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-semibold text-slate-200 truncate leading-tight">
                {[user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username}
              </div>
              <div className="text-[10px] text-slate-500 capitalize font-medium">{user?.role}</div>
            </div>
            <button onClick={onLogout} title="Sign Out"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0">
              <LogOut size={14} />
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
      <div className={`flex items-center gap-2 rounded-xl px-3.5 py-2 w-full max-w-md transition-all duration-200 border ${
        open || q
          ? 'bg-[var(--surface)] border-[var(--primary)] shadow-sm ring-2 ring-[var(--primary-light)]'
          : 'bg-[var(--surface-elevated)] border-[var(--line)] hover:border-[var(--primary-border)]'
      }`}>
        <Search size={16} className="text-[var(--muted)] flex-shrink-0" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(e.target.value.length > 0) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (!q) setOpen(false) }}
          onKeyDown={handleKeyDown}
          placeholder="Search products… (Ctrl+K)"
          aria-label="Search products"
          className="bg-transparent text-sm outline-none w-full text-[var(--ink)] placeholder:text-[var(--muted-light)]"
        />
        {q ? (
          <button onClick={() => { setQ(''); setOpen(false) }} aria-label="Clear search" className="text-[var(--muted)] hover:text-[var(--ink)]">
            <X size={14} />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-light)] bg-[var(--surface)] border border-[var(--line)] rounded">⌘K</kbd>
        )}
      </div>

      {open && q && (
        <div className="absolute top-full mt-2 left-0 w-80 bg-[var(--surface)] rounded-2xl shadow-[var(--shadow-lg)] border border-[var(--line)] z-50 overflow-hidden">
          {searching ? (
            <div className="px-4 py-3 text-xs text-[var(--muted)] flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-[var(--primary-border)] border-t-[var(--primary)] rounded-full animate-spin" />
              Searching...
            </div>
          ) : results.length ? (
            results.map(result => (
              <button key={`${result.type}-${result.id}`} onClick={() => { navigate(result.route); setQ(''); setOpen(false) }} className="w-full px-4 py-2.5 text-left hover:bg-[var(--surface-hover)] border-b border-[var(--line-subtle)] last:border-0 transition-colors">
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
  const ref = useRef()

  useEffect(() => {
    const handleClickOutside = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    api.get('/dashboard/').then(({ data }) => {
      const iconMap = { stock: Activity, credit: CreditCard, purchases: ShoppingBag, invoices: FileText }
      const colorMap = { stock: 'text-orange-500 bg-orange-50', credit: 'text-red-500 bg-red-50', purchases: 'text-blue-500 bg-blue-50', invoices: 'text-violet-500 bg-violet-50' }
      setNotifications((data.action_required || []).filter(item => Number(item.count || 0) > 0).map(item => ({
        ...item,
        icon: iconMap[item.key] || Bell,
        color: colorMap[item.key] || 'text-slate-500 bg-slate-50',
        title: 'Action required',
        desc: `${item.count} ${item.label}`,
      })))
    }).catch(() => setNotifications([]))
  }, [])

  const hasNotifications = notifications.length > 0

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} aria-label={`Notifications${hasNotifications ? `, ${notifications.length} items` : ''}`}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-all">
        <Bell size={17} />
        {hasNotifications && (
          <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-[var(--surface)]" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--surface)] rounded-2xl shadow-[var(--shadow-lg)] border border-[var(--line)] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)]">
            <span className="font-semibold text-[var(--ink)] text-sm">Notifications</span>
            {hasNotifications && (
              <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{notifications.length}</span>
            )}
          </div>
          <div className="divide-y divide-[var(--line-subtle)] max-h-72 overflow-y-auto">
            {notifications.map((n, i) => {
              const Icon = n.icon
              return (
                <button key={i} onClick={() => { window.location.href = n.route }} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[var(--surface-hover)] cursor-pointer transition-colors text-left">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${n.color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--ink)]">{n.title}</div>
                    <div className="text-xs text-[var(--muted)] truncate">{n.desc}</div>
                  </div>
                </button>
              )
            })}
            {!hasNotifications && <div className="px-4 py-6 text-xs text-[var(--muted)] text-center">All caught up — no action required</div>}
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
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 hover:bg-[var(--surface-hover)] rounded-xl px-2 py-1.5 transition-all">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
          {initials}
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-[13px] font-semibold text-[var(--ink)] leading-tight">{fullName}</div>
          <div className="text-[10px] text-[var(--muted)] capitalize font-medium">{user?.role}</div>
        </div>
        <ChevronDown size={13} className={`text-[var(--muted)] hidden sm:block transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--surface)] rounded-2xl shadow-[var(--shadow-lg)] border border-[var(--line)] z-50 overflow-hidden">
          <div className="px-4 py-3 bg-[var(--surface-elevated)] border-b border-[var(--line)]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-sm font-bold flex items-center justify-center shadow">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[var(--ink)] text-sm truncate">{fullName}</div>
                <div className="text-[11px] text-[var(--muted)] capitalize">{user?.role}</div>
              </div>
            </div>
          </div>
          <div className="py-1.5">
            <NavLink to="/settings" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] transition-colors">
              <Settings size={14} className="text-[var(--muted)]" />
              Settings
            </NavLink>
            <button onClick={() => { toggleTheme(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] transition-colors">
              {theme === 'dark' ? <Sun size={14} className="text-[var(--muted)]" /> : <Moon size={14} className="text-[var(--muted)]" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <div className="h-px bg-[var(--line)] my-1 mx-3" />
            <button onClick={() => { setOpen(false); onLogout() }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-light)] transition-colors">
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
  const title = meta?.label || 'ShopEase'
  const accentHex = ACCENT_HEX[meta?.group] || '#6366f1'

  return (
    <div className="flex items-center gap-2.5 min-w-0 flex-shrink">
      <div
        className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center flex-shrink-0"
        style={{ background: `${accentHex}18`, color: accentHex }}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex flex-col justify-center leading-tight">
        <div className="text-[10px] text-[var(--muted)] font-semibold uppercase tracking-[0.1em] truncate hidden sm:block">
          {shopName || 'ShopEase'}
        </div>
        <h1 className="font-bold text-[var(--ink)] text-[15px] sm:text-[17px] tracking-tight truncate max-w-[130px] sm:max-w-[240px] lg:max-w-[340px]">
          {title}
        </h1>
      </div>
    </div>
  )
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef()

  const [mobileOpen, setMobileOpen] = useState(false)
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
  }, [location.pathname])

  const handleLogout = () => { logout(); navigate('/login') }
  const logoSrc = shopLogo || logoImg

  return (
    <ShopContext.Provider value={{ logoSrc, shopName }}>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--app-bg)' }}>

        <div className={`hidden md:flex flex-shrink-0 shadow-[2px_0_12px_rgba(0,0,0,0.15)] transition-all duration-300 ease-in-out ${collapsed ? 'w-[62px]' : 'w-[220px]'}`}>
          <Sidebar
            collapsed={collapsed} mobile={false} user={user} shopName={shopName} logoSrc={logoSrc}
            onLogout={handleLogout} onNav={() => {}} onToggle={() => setCollapsed(v => !v)} onClose={() => {}}
          />
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <Sidebar
              collapsed={false} mobile={true} user={user} shopName={shopName} logoSrc={logoSrc}
              onLogout={handleLogout} onNav={() => setMobileOpen(false)} onToggle={() => {}} onClose={() => setMobileOpen(false)}
            />
            <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="flex-shrink-0 z-10 bg-[var(--surface)] border-b border-[var(--line)] shadow-[0_1px_0_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-14">
              <button onClick={() => setMobileOpen(true)} title="Open menu" aria-label="Open menu"
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] transition-all duration-200">
                <MenuIcon size={20} />
              </button>

              <PageHeading shopName={shopName} pathname={location.pathname} />

              <div className="flex-1 min-w-2" />

              <div className="hidden lg:block">
                <GlobalSearch />
              </div>

              <div className="hidden lg:block w-px h-5 bg-[var(--line)]" />

              <NotificationBell />

              <div className="w-px h-5 bg-[var(--line)]" />

              <ProfileMenu user={user} onLogout={handleLogout} />
            </div>
          </header>

          <main ref={mainRef} className="flex-1 overflow-y-auto bg-[var(--app-bg)]">
            <div className="p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto page-enter">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ShopContext.Provider>
  )
}
