import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import api, { API_BASE_URL } from '../api'
import logoImg from '../assets/logo.png'

import {
  LayoutDashboard, ShoppingCart, FileText, Package, Users, BarChart2,
  UserCog, Settings, LogOut, ChevronDown, ChevronUp, ChevronRight,
  Search, Bell, RotateCcw, CreditCard, Boxes, ShoppingBag, Building2,
  IndianRupee, HelpCircle, Layers, Activity, Zap, X
} from 'lucide-react'

import { useEffect, useState, createContext, useContext, useRef } from 'react'

/* =========================================================
   CUSTOM MENU ICON
========================================================= */

function MenuIcon({ size = 20 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 50 50" fill="currentColor" aria-hidden="true">
      <path d="M 3 9 A 1.0001 1.0001 0 1 0 3 11 L 47 11 A 1.0001 1.0001 0 1 0 47 9 L 3 9 z M 3 24 A 1.0001 1.0001 0 1 0 3 26 L 47 26 A 1.0001 1.0001 0 1 0 47 24 L 3 24 z M 3 39 A 1.0001 1.0001 0 1 0 3 41 L 47 41 A 1.0001 1.0001 0 1 0 47 39 L 3 39 z" />
    </svg>
  )
}

/* =========================================================
   SHOP CONTEXT
========================================================= */

export const ShopContext = createContext({ logoSrc: '', shopName: 'Dreamwithtech' })
export const useShop = () => useContext(ShopContext)

/* =========================================================
   NAVIGATION GROUPS
========================================================= */

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' }
    ]
  },
  {
    label: 'Billing',
    items: [
      { to: '/billing/new', icon: ShoppingCart, label: 'New Bill' },
      { to: '/billing/drafts', icon: Layers, label: 'Drafts' }
    ]
  },
  {
    label: 'Sales',
    items: [
      { to: '/sales/invoices', icon: FileText, label: 'Invoices' },
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
    label: 'Parties',
    items: [
      { to: '/parties/customers', icon: Users, label: 'Customers' },
      { to: '/parties/suppliers', icon: Building2, label: 'Suppliers' }
    ]
  },
  {
    label: 'Finance',
    items: [
      { to: '/expenses', icon: IndianRupee, label: 'Expenses' },
      { to: '/reports', icon: BarChart2, label: 'Reports', adminOnly: true }
    ]
  },
  {
    label: 'System',
    adminOnly: true,
    items: [
      { to: '/users', icon: UserCog, label: 'Users', adminOnly: true },
      { to: '/settings', icon: Settings, label: 'Settings', adminOnly: true }
    ]
  },
  {
    label: 'Help',
    items: [
      { to: '/support', icon: HelpCircle, label: 'Support' }
    ]
  }
]

// Flat lookup of icon + group label by path, used for the page heading in the topbar
const PAGE_META = NAV_GROUPS.reduce((acc, group) => {
  group.items.forEach(item => {
    acc[item.to] = { icon: item.icon, group: group.label, label: item.label }
  })
  return acc
}, {})

/* =========================================================
   GROUP COLORS
========================================================= */

const GROUP_ACCENT = {
  Overview: 'text-blue-400', Billing: 'text-emerald-400', Sales: 'text-violet-400',
  Inventory: 'text-amber-400', Parties: 'text-cyan-400', Finance: 'text-rose-400',
  System: 'text-slate-400', Help: 'text-slate-400'
}

const ACTIVE_BG = {
  Overview: 'bg-blue-600', Billing: 'bg-emerald-600', Sales: 'bg-violet-600',
  Inventory: 'bg-amber-500', Parties: 'bg-cyan-600', Finance: 'bg-rose-600',
  System: 'bg-slate-600', Help: 'bg-slate-600'
}

// Solid hex per group, used for the topbar accent bar (can't use Tailwind bg-* via JS string there)
const ACCENT_HEX = {
  Overview: '#60a5fa', Billing: '#34d399', Sales: '#a78bfa', Inventory: '#fbbf24',
  Parties: '#22d3ee', Finance: '#fb7185', System: '#94a3b8', Help: '#94a3b8'
}

/* =========================================================
   NAV GROUP
   Expanded groups render a vertical "rail" that connects every
   item back to its group heading, tree-style.
========================================================= */

function NavGroup({ group, collapsed, user, onNav }) {
  const location = useLocation()
  const [open, setOpen] = useState(true)

  const visibleItems = group.items.filter(item => !item.adminOnly || user?.role === 'admin')
  if (!visibleItems.length) return null
  if (group.adminOnly && user?.role !== 'admin') return null

  const isGroupActive = visibleItems.some(item =>
    item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
  )

  const activeBg = ACTIVE_BG[group.label] || 'bg-indigo-600'
  const accent = GROUP_ACCENT[group.label] || 'text-slate-400'

  /* ---------- COLLAPSED SIDEBAR ---------- */
  if (collapsed) {
    return (
      <div className="px-2 mb-2">
        {visibleItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} onClick={onNav} title={label}
            className={({ isActive }) =>
              `relative flex items-center justify-center w-10 h-10 rounded-xl mb-1 transition-all duration-150 group ${
                isActive ? `${activeBg} text-white shadow-lg` : 'text-slate-400 hover:bg-slate-700/80 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-white/60" />}
                <Icon size={17} />
                <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[100] shadow-xl border border-slate-700">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    )
  }

  /* ---------- EXPANDED SIDEBAR ---------- */
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-3 py-1.5 mb-0.5 rounded-md transition-colors ${
          isGroupActive ? accent : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.12em]">{group.label}</span>
        {open ? <ChevronUp size={10} className="opacity-60" /> : <ChevronRight size={10} className="opacity-60" />}
      </button>

      {open && (
        // ASCII-tree connector: each item draws its own vertical stub (top
        // half) plus, unless it's the last item, a continuation (bottom
        // half) — chained together this reads as a shared trunk line with
        // "├──" branches off every item and a "└──" corner on the last one.
        <div className="relative ml-[22px]">
          {visibleItems.map(({ to, icon: Icon, label }, index) => {
            const isLast = index === visibleItems.length - 1
            return (
              <div key={to} className="relative pb-0.5">
                <span className="absolute left-0 top-0 w-px h-1/2 bg-slate-700/60" aria-hidden="true" />
                {!isLast && <span className="absolute left-0 top-1/2 w-px h-1/2 bg-slate-700/60" aria-hidden="true" />}
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-px bg-slate-700/60" aria-hidden="true" />

                <NavLink to={to} end={to === '/'} onClick={onNav}
                  className={({ isActive }) =>
                    `relative flex items-center gap-2.5 ml-4 mr-1.5 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                      isActive ? `${activeBg} text-white shadow-md` : 'text-slate-400 hover:bg-slate-700/60 hover:text-slate-100'
                    }`
                  }
                >
                  <Icon size={15} className="flex-shrink-0" />
                  <span className="truncate">{label}</span>
                </NavLink>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* =========================================================
   SIDEBAR
========================================================= */

function Sidebar({ collapsed, mobile, user, shopName, logoSrc, onLogout, onNav, onToggle, onClose }) {
  const [headerHovered, setHeaderHovered] = useState(false)

  return (
    <div
      className={`flex flex-col h-full transition-all duration-300 ease-in-out ${
        mobile ? 'w-64' : collapsed ? 'w-[62px]' : 'w-[220px]'
      }`}
      style={{ background: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)' }}
    >
      {/* BRAND / SHOP HEADER */}
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

      {/* NAVIGATION */}
      <nav className="flex-1 py-2 space-y-0.5" style={{ overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {NAV_GROUPS.map(group => (
          <NavGroup key={group.label} group={group} collapsed={collapsed && !mobile} user={user} onNav={onNav} />
        ))}
      </nav>

      {/* USER STRIP */}
      <div className={`border-t border-white/[0.06] flex-shrink-0 ${collapsed && !mobile ? 'px-2 py-3' : 'px-3 py-3'}`}>
        {collapsed && !mobile ? (
          <button onClick={onLogout} title="Sign Out"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all mx-auto">
            <LogOut size={16} />
          </button>
        ) : (
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
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

/* =========================================================
   GLOBAL SEARCH
========================================================= */

function GlobalSearch() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handleClickOutside = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2 w-64 transition-all duration-200 border ${
        open || q ? 'bg-white border-blue-300 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
      }`}>
        <Search size={14} className="text-slate-400 flex-shrink-0" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(e.target.value.length > 0) }}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (!q) setOpen(false) }}
          placeholder="Search invoices, products…"
          className="bg-transparent text-sm outline-none w-full text-slate-700 placeholder-slate-400"
        />
        {q ? (
          <button onClick={() => { setQ(''); setOpen(false) }}>
            <X size={13} className="text-slate-400 hover:text-slate-600" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded">⌘K</kbd>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs text-slate-500">
              {q ? <>Searching for <span className="font-semibold text-slate-800">"{q}"</span>…</> : 'Start typing to search'}
            </p>
          </div>
          <div className="px-3 py-2">
            {['Invoices', 'Products', 'Customers'].map(category => (
              <div key={category} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                <Search size={12} className="text-slate-300" />
                <span className="text-xs text-slate-500">Search in <span className="font-medium text-slate-700">{category}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   NOTIFICATION BELL
========================================================= */

const NOTIFICATIONS = [
  { icon: Activity, color: 'text-orange-500 bg-orange-50', title: 'Low stock alert', desc: '5 products running low', time: '2m ago' },
  { icon: ShoppingCart, color: 'text-blue-500 bg-blue-50', title: 'New bill created', desc: 'INV-0042 · ₹4,500', time: '18m ago' },
  { icon: Zap, color: 'text-violet-500 bg-violet-50', title: 'Daily report ready', desc: "Today's summary available", time: '1h ago' }
]

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handleClickOutside = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all">
        <Bell size={17} />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-semibold text-slate-800 text-sm">Notifications</span>
            <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full">3 new</span>
          </div>
          <div className="divide-y divide-slate-50">
            {NOTIFICATIONS.map((n, i) => {
              const Icon = n.icon
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${n.color}`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">{n.title}</div>
                    <div className="text-xs text-slate-500 truncate">{n.desc}</div>
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">{n.time}</span>
                </div>
              )
            })}
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100 text-center">
            <button className="text-xs font-semibold text-blue-600 hover:text-blue-700">View all notifications</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   PROFILE MENU
========================================================= */

function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handleClickOutside = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials = ((user?.first_name?.[0] || '') + (user?.last_name?.[0] || '')) || user?.username?.[0]?.toUpperCase() || 'U'
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2.5 hover:bg-slate-100 rounded-xl px-2.5 py-1.5 transition-all">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-sm">
          {initials}
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-[13px] font-semibold text-slate-800 leading-tight">{fullName}</div>
          <div className="text-[10px] text-slate-500 capitalize font-medium">{user?.role}</div>
        </div>
        <ChevronDown size={13} className={`text-slate-400 hidden sm:block transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          <div className="px-4 py-3.5 bg-gradient-to-br from-slate-50 to-slate-100 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center shadow">
                {initials}
              </div>
              <div>
                <div className="font-semibold text-slate-800 text-sm">{fullName}</div>
                <div className="text-[11px] text-slate-500 capitalize">{user?.role}</div>
              </div>
            </div>
          </div>
          <div className="py-1.5">
            <NavLink to="/settings" onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
              <Settings size={14} className="text-slate-400" />
              Settings
            </NavLink>
            <button onClick={() => { setOpen(false); onLogout() }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   PAGE HEADING
   Prominent current-page title with a color accent tied to its
   nav group, the section icon, and the shop name as a small
   breadcrumb-style eyebrow above it.
========================================================= */

function PageHeading({ shopName, pathname }) {
  const meta = PAGE_META[pathname]
  const Icon = meta?.icon || LayoutDashboard
  const title = meta?.label || 'ShopEase'
  const accentHex = ACCENT_HEX[meta?.group] || '#6366f1'

  return (
    <div className="flex items-center gap-3 min-w-0 flex-shrink">
      <div
        className="hidden sm:flex w-9 h-9 rounded-xl items-center justify-center flex-shrink-0"
        style={{ background: `${accentHex}1a`, color: accentHex }}
      >
        <Icon size={17} />
      </div>

      <div className="min-w-0 flex flex-col justify-center leading-tight">
        <div className="text-[10px] sm:text-[11px] text-slate-400 font-semibold uppercase tracking-[0.08em] truncate">
          {shopName || 'Dreamwithtech'}
        </div>
        <h1 className="font-extrabold text-slate-900 text-[16px] sm:text-[18px] md:text-[19px] tracking-tight truncate max-w-[150px] sm:max-w-[260px] lg:max-w-[360px]">
          {title}
        </h1>
      </div>
    </div>
  )
}

/* =========================================================
   MAIN LAYOUT
========================================================= */

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const mainRef = useRef()

  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const [shopName, setShopName] = useState('Dreamwithtech')
  const [shopLogo, setShopLogo] = useState('')

  // Load shop settings, and keep in sync with in-app updates
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

  // Scroll main content to top and close mobile menu on route change
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
    setMobileOpen(false)
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const logoSrc = shopLogo
    ? (shopLogo.startsWith('http') ? shopLogo : `${API_BASE_URL.replace(/\/api$/, '')}${shopLogo}`)
    : logoImg

  return (
    <ShopContext.Provider value={{ logoSrc, shopName }}>
      <div className="flex h-screen overflow-hidden" style={{ background: '#f1f5f9' }}>

        {/* DESKTOP SIDEBAR */}
        <div className={`hidden md:flex flex-shrink-0 shadow-xl transition-all duration-300 ease-in-out ${collapsed ? 'w-[62px]' : 'w-[220px]'}`}>
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

        {/* MOBILE SIDEBAR */}
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
            <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          </div>
        )}

        {/* MAIN APPLICATION */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* TOPBAR */}
          <header className="flex-shrink-0 z-10 bg-white border-b border-slate-200">
            <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-16">

              <button onClick={() => setMobileOpen(true)} title="Open menu" aria-label="Open menu"
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-all duration-200">
                <MenuIcon size={20} />
              </button>

              <PageHeading shopName={shopName} pathname={location.pathname} />

              <div className="flex-1 min-w-2" />

              <div className="hidden lg:block">
                <GlobalSearch />
              </div>

              <div className="hidden lg:block w-px h-6 bg-slate-200" />

              <NotificationBell />

              <div className="w-px h-6 bg-slate-200" />

              <ProfileMenu user={user} onLogout={handleLogout} />
            </div>
          </header>

          {/* PAGE CONTENT */}
          <main ref={mainRef} className="flex-1 overflow-y-auto">
            <div className="p-3 sm:p-4 md:p-6 max-w-[1600px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ShopContext.Provider>
  )
}