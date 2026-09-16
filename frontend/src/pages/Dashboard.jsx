import { useEffect, useState, useCallback, useMemo } from 'react'
import api from '../api'
import { Badge } from '../components/UI'
import { useShop } from '../components/Layout'
import {
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Line
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Package,
  AlertTriangle,
  Users,
  CreditCard,
  DollarSign,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ShoppingCart,
  Truck,
  Clock,
  BarChart2,
  Percent
} from 'lucide-react'

/* =====================================================
   CONFIGURATION
===================================================== */

const CACHE_KEY = 'billing_dashboard_cache'
const CACHE_TIME_KEY = 'billing_dashboard_cache_time'

// Cache dashboard data for 30 seconds
const CACHE_TTL = 30 * 1000

// API request timeout
const REQUEST_TIMEOUT = 15000

/* =====================================================
   FORMATTERS
===================================================== */

const fmt = value =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0
  })}`

const fmtDec = value =>
  `₹${Number(value || 0).toFixed(2)}`

const pct = (a, b) => {
  const current = Number(a || 0)
  const previous = Number(b || 0)

  if (previous <= 0) return 0

  return Math.round(
    ((current - previous) / previous) * 100
  )
}

/* =====================================================
   COLORS
===================================================== */

const PAY_COLORS = {
  cash: '#374151',
  upi: '#374151',
  card: '#374151',
  online: '#374151',
  credit: '#374151'
}

const CAT_COLORS = [
  '#374151',
  '#6b7280',
  '#9ca3af',
  '#4b5563',
  '#1f2937',
  '#d1d5db'
]

/* =====================================================
   DEFAULT DASHBOARD DATA
===================================================== */

const EMPTY_DATA = {
  today_sales: 0,
  yesterday_sales: 0,

  today_profit: 0,
  yesterday_profit: 0,
  today_collection: 0,

  today_bills: 0,
  avg_bill_today: 0,

  today_tax: 0,
  today_discount: 0,

  month_sales: 0,
  last_month_sales: 0,

  month_profit: 0,
  month_bills: 0,

  pending_credit: 0,
  total_customers: 0,

  pending_purchases: 0,
  total_suppliers: 0,

  sales_growth: 0,
  profit_margin: 0,
  avg_bill_month: 0,
  new_customers_today: 0,

  out_of_stock: 0,
  low_stock_count: 0,

  sales_7days: [],
  monthly_sales: [],
  hourly_sales: [],
  top_products: [],
  category_sales: [],
  payment_distribution: [],
  low_stock_products: [],
  recent_bills: [],
  top_customers: [],
  action_required: [],
}

/* =====================================================
   CACHE HELPERS
===================================================== */

function getCachedDashboard() {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)

    if (!cached) {
      return null
    }

    return JSON.parse(cached)
  } catch {
    return null
  }
}

function getCacheTime() {
  try {
    return Number(
      sessionStorage.getItem(CACHE_TIME_KEY) || 0
    )
  } catch {
    return 0
  }
}

function saveDashboardCache(data) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify(data)
    )

    sessionStorage.setItem(
      CACHE_TIME_KEY,
      String(Date.now())
    )
  } catch {
    // Ignore storage errors
  }
}

function isCacheFresh() {
  const cacheTime = getCacheTime()

  if (!cacheTime) {
    return false
  }

  return (
    Date.now() - cacheTime < CACHE_TTL
  )
}

/* =====================================================
   TREND COMPONENT
===================================================== */

function Trend({ value }) {
  if (value === 0) {
    return (
      <span className="text-xs text-[var(--muted-light)] flex items-center gap-0.5">
        <Minus size={11} />
        No change
      </span>
    )
  }

  const up = value > 0

  return (
    <span
      className={`text-xs flex items-center gap-0.5 font-medium ${
        up
          ? 'text-green-600 dark:text-green-400'
          : 'text-red-500'
      }`}
    >
      {up ? (
        <ArrowUpRight size={12} />
      ) : (
        <ArrowDownRight size={12} />
      )}

      {up ? '+' : ''}
      {value}% vs yesterday
    </span>
  )
}

/* =====================================================
   STAT CARD
===================================================== */

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  color = 'blue',
  trend,
  highlight
}) {
  // Blue is used for normal/positive business KPIs.
  // Red is reserved for attention/obligation KPIs such as credit and purchases.
  const isRed = ['red', 'amber'].includes(color)

  const accent = isRed
    ? {
        line: 'bg-red-500',
        iconBg: 'bg-red-50',
        iconBorder: 'border-red-100',
        icon: 'text-red-600',
      }
    : {
        line: 'bg-blue-600',
        iconBg: 'bg-blue-50',
        iconBorder: 'border-blue-100',
        icon: 'text-blue-600',
      }

  return (
    <div
      className="
        relative overflow-hidden
        bg-[var(--surface)]
        border border-[var(--line)]
        rounded-xl
        shadow-[0_3px_14px_rgba(15,23,42,0.045)]
        hover:shadow-[0_7px_22px_rgba(15,23,42,0.08)]
        hover:-translate-y-[1px]
        transition-all duration-200
        flex flex-col
        p-3
        sm:p-5
        gap-2.5 sm:gap-3
        min-w-0
      "
    >
      {/* KPI accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${accent.line}`} />

      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <span className="block text-[9px] sm:text-[10px] font-bold text-[var(--muted-light)] uppercase tracking-[0.08em] sm:tracking-[0.12em] leading-tight truncate">
            {label}
          </span>
          {highlight && (
            <span className="inline-flex items-center mt-1.5 text-[9px] font-semibold uppercase tracking-wider text-blue-600">
              Today
            </span>
          )}
        </div>

        <div
          className={`
            w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex-shrink-0
            ${accent.iconBg}
            border ${accent.iconBorder}
            flex items-center justify-center
          `}
        >
          <Icon size={17} className={accent.icon} strokeWidth={2.1} />
        </div>
      </div>

      <div
        className="text-[1.35rem] sm:text-[1.9rem] font-bold tracking-tight text-[var(--ink)] truncate leading-none"
        style={{ fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}
      >
        {value}
      </div>

      <div className="flex items-center justify-between gap-2 min-h-[18px]">
        {sub && (
          <div className="text-[11px] sm:text-xs text-[var(--muted)] truncate">
            {sub}
          </div>
        )}
        {trend !== undefined && (
          <div className="shrink-0">
            <Trend value={trend} />
          </div>
        )}
      </div>
    </div>
  )
}

/* =====================================================
   INSIGHT CARD
===================================================== */

function Insight({
  label,
  value,
  icon: Icon,
  color,
  note
}) {
  const isRed = color === 'orange'

  const accent = isRed
    ? {
        line: 'bg-red-500',
        iconBg: 'bg-red-50',
        iconBorder: 'border-red-100',
        icon: 'text-red-600',
      }
    : {
        line: 'bg-blue-600',
        iconBg: 'bg-blue-50',
        iconBorder: 'border-blue-100',
        icon: 'text-blue-600',
      }

  return (
    <div
      className="
        relative overflow-hidden
        bg-[var(--surface)]
        border border-[var(--line)]
        rounded-xl
        shadow-[0_3px_14px_rgba(15,23,42,0.045)]
        hover:shadow-[0_7px_22px_rgba(15,23,42,0.08)]
        hover:-translate-y-[1px]
        transition-all duration-200
        flex flex-col
        gap-3
        p-4
        sm:p-5
      "
    >
      {/* KPI accent line */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${accent.line}`} />

      <div className="flex items-start justify-between gap-3 pt-1">
        <span className="text-[10px] font-bold text-[var(--muted-light)] uppercase tracking-[0.12em] leading-tight mt-0.5">
          {label}
        </span>

        <div
          className={`
            w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex-shrink-0
            ${accent.iconBg}
            border ${accent.iconBorder}
            flex items-center justify-center
          `}
        >
          <Icon size={17} className={accent.icon} strokeWidth={2.1} />
        </div>
      </div>

      <div
        className="text-[1.35rem] sm:text-[1.9rem] font-bold tracking-tight leading-none text-[var(--ink)] truncate"
        style={{ fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' }}
      >
        {value}
      </div>

      {note && (
        <div className="text-[11px] sm:text-xs text-[var(--muted)] truncate">
          {note}
        </div>
      )}
    </div>
  )
}

/* =====================================================
   CHART TOOLTIP
===================================================== */

const ChartTooltip = ({
  active,
  payload,
  label
}) => {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div
      className="
        bg-[var(--surface)]
        border border-[var(--line)]
        rounded-xl
        shadow-[var(--shadow-lg)]
        px-3 py-2.5
        text-xs
      "
    >
      <div className="font-semibold text-[var(--muted)] mb-1">
        {label}
      </div>

      {payload.map((item, index) => (
        <div
          key={index}
          className="flex items-center gap-2"
        >
          <span
            className="w-2 h-2 rounded-full"
            style={{
              background: item.color
            }}
          />

          <span className="text-[var(--muted)]">
            {item.name}:
          </span>

          <span className="font-bold text-[var(--ink)]">
            ₹
            {Number(
              item.value || 0
            ).toLocaleString('en-IN')}
          </span>
        </div>
      ))}
    </div>
  )
}

/* =====================================================
   SIMPLE LOADING INDICATOR
===================================================== */

function BackgroundLoading() {
  return (
    <div
      className="
        fixed
        bottom-4
        right-4
        z-50
        flex
        items-center
        gap-2
        bg-[var(--ink)]
        text-[var(--surface)]
        text-xs
        font-medium
        px-3
        py-2
        rounded-full
        shadow-lg
      "
    >
      <span
        className="
          w-2
          h-2
          rounded-full
          bg-[var(--surface)]
          animate-pulse
        "
      />

      Updating...
    </div>
  )
}

/* =====================================================
   DASHBOARD
===================================================== */

export default function Dashboard() {
  const navigate = useNavigate()
  const { shopName } = useShop()

  /* ---------------------------------------------------
     INITIAL CACHE
  --------------------------------------------------- */

  const [dashboard, setDashboard] = useState(() => {
    const cached = getCachedDashboard()

    return {
      ...EMPTY_DATA,
      ...(cached || {})
    }
  })

  /*
    IMPORTANT:

    We don't block the dashboard with a full-page
    Spinner anymore.

    Cached data is displayed immediately.
  */

  const [refreshing, setRefreshing] =
    useState(false)

  const [firstLoad, setFirstLoad] =
    useState(() => {
      return !getCachedDashboard()
    })

  const [loadError, setLoadError] =
    useState(false)

  const [now, setNow] = useState(
    () => new Date()
  )

  /* ---------------------------------------------------
     CLOCK

     Previously this updated every second.

     That causes the complete Dashboard component
     to render every second.

     30 seconds is sufficient for a billing dashboard.
  --------------------------------------------------- */

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => {
      clearInterval(timer)
    }
  }, [])

  /* ---------------------------------------------------
     LOAD DASHBOARD
  --------------------------------------------------- */

  const loadDashboard = useCallback(
    async ({ force = false } = {}) => {
      /*
        If cached data is fresh, don't make another
        API request.
      */

      if (
        !force &&
        isCacheFresh()
      ) {
        setFirstLoad(false)
        return
      }

      setRefreshing(true)
      setLoadError(false)

      const controller =
        new AbortController()

      const timeout = setTimeout(() => {
        controller.abort()
      }, REQUEST_TIMEOUT)

      try {
        const response = await api.get(
          '/dashboard/',
          {
            signal:
              controller.signal
          }
        )

        const freshData = {
          ...EMPTY_DATA,
          ...(response.data || {})
        }

        /*
          Update UI immediately.
        */

        setDashboard(freshData)

        /*
          Save data so the next dashboard visit
          can render instantly.
        */

        saveDashboardCache(
          freshData
        )

        setLoadError(false)
      } catch (error) {

        /*
          IMPORTANT:

          Don't remove existing data if the backend
          temporarily fails.

          User can still use the dashboard.
        */

        if (
          !getCachedDashboard()
        ) {
          setLoadError(true)
        }
      } finally {
        clearTimeout(timeout)

        setRefreshing(false)
        setFirstLoad(false)
      }
    },
    []
  )

  /* ---------------------------------------------------
     INITIAL API LOAD
  --------------------------------------------------- */

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  /* ---------------------------------------------------
     DERIVED DATA
  --------------------------------------------------- */

  const salesTrend = useMemo(
    () =>
      pct(
        dashboard.today_sales,
        dashboard.yesterday_sales
      ),
    [
      dashboard.today_sales,
      dashboard.yesterday_sales
    ]
  )

  const profitTrend = useMemo(
    () =>
      pct(
        dashboard.today_profit,
        dashboard.yesterday_profit
      ),
    [
      dashboard.today_profit,
      dashboard.yesterday_profit
    ]
  )

  const billsTrend = useMemo(
    () =>
      pct(
        dashboard.today_bills,
        dashboard.yesterday_bills
      ),
    [
      dashboard.today_bills,
      dashboard.yesterday_bills
    ]
  )

  const sales7 =
    dashboard.sales_7days || []

  const monthly =
    dashboard.monthly_sales || []

  const hourly =
    dashboard.hourly_sales || []

  const topProducts =
    dashboard.top_products || []

  const catSales =
    dashboard.category_sales || []

  const payDist =
    dashboard.payment_distribution || []

  const lowStock =
    dashboard.low_stock_products || []

  const recentBills =
    dashboard.recent_bills || []

  const topCustomers = dashboard.top_customers || []
  const actionRequired = (dashboard.action_required || []).filter(item => Number(item.count || 0) > 0)

  const maxRevenue = useMemo(() => {
    return Math.max(
      ...topProducts.map(
        product =>
          Number(
            product.total_revenue || 0
          )
      ),
      1
    )
  }, [topProducts])

  /* ---------------------------------------------------
     ERROR SCREEN ONLY WHEN ABSOLUTELY NECESSARY
  --------------------------------------------------- */

  if (
    loadError &&
    firstLoad
  ) {
    return (
      <div
        className="
          min-h-full
          flex
          flex-col
          items-center
          justify-center
          gap-4
          p-6
        "
      >
        <div
          className="
            w-12 h-12
            rounded-full
            bg-red-50 dark:bg-red-950/60
            flex
            items-center
            justify-center
          "
        >
          <AlertTriangle
            size={22}
            className="text-red-500"
          />
        </div>

        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--ink)]">
            Could not load dashboard
          </p>

          <p className="text-xs text-[var(--muted)] mt-1">
            Please check your connection and try again.
          </p>
        </div>

        <button
          className="
            flex
            items-center
            gap-2
            px-4
            py-2
            rounded-xl
            bg-blue-600
            hover:bg-blue-700
            text-white
            text-sm
            font-semibold
          "
          onClick={() =>
            loadDashboard({
              force: true
            })
          }
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    )
  }

  /* ===================================================
     MAIN DASHBOARD
  =================================================== */

  return (
    <div
      className="
        min-h-full
        space-y-5
      "
    >

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-[var(--shadow-card)] px-3 sm:px-5 py-3.5 flex items-center gap-3 min-w-0">
        {/* Left: headline + date/time */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--muted-light)] uppercase tracking-widest mb-0.5">Dashboard</p>
          <p className="text-sm sm:text-base font-bold text-[var(--ink)] truncate leading-tight">{shopName}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)] font-medium bg-[var(--surface-elevated)] border border-[var(--line-subtle)] rounded-md px-2 py-0.5">
              <Clock size={10} className="text-gray-500 shrink-0" />
              {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-[var(--ink)] bg-[var(--surface-elevated)] border border-[var(--line)] rounded-md px-2 py-0.5 tabular-nums">
              {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/billing/new')}
            className="flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-xl bg-[var(--ink)] hover:bg-black text-white text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
          >
            <ShoppingCart size={14} />
            <span>New Bill</span>
          </button>
          <button
            onClick={() => loadDashboard({ force: true })}
            disabled={refreshing}
            aria-label="Refresh"
            className="w-9 h-9 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] flex items-center justify-center hover:bg-[var(--surface-hover)] disabled:opacity-50 transition-colors shrink-0"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* =================================================
          BACKGROUND REFRESH
      ================================================= */}

      {refreshing && (
        <BackgroundLoading />
      )}

      {/* =================================================
          STOCK ALERT
      ================================================= */}

      {(dashboard.out_of_stock > 0 ||
        dashboard.low_stock_count > 0) && (
        <div
          className="flex flex-wrap items-center justify-between gap-3
            rounded-2xl px-4 py-3
            bg-[var(--surface-elevated)] border border-[var(--line)]"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-[var(--muted)] shrink-0" />
            <span className="text-sm font-semibold text-[var(--ink-secondary)]">
              Stock Alert:
              {dashboard.out_of_stock > 0 && (
                <span className="ml-1">
                  {dashboard.out_of_stock} product{dashboard.out_of_stock > 1 ? 's' : ''} out of stock
                </span>
              )}
              {dashboard.out_of_stock > 0 && dashboard.low_stock_count > 0 && (
                <span className="mx-1">·</span>
              )}
              {dashboard.low_stock_count > 0 && (
                <span>
                  {dashboard.low_stock_count} product{dashboard.low_stock_count > 1 ? 's' : ''} running low
                </span>
              )}
            </span>
          </div>
          <button
            onClick={() => navigate('/inventory')}
            className="text-xs font-semibold text-[var(--muted)] underline underline-offset-2 hover:text-[var(--ink)] transition-colors"
          >
            View Inventory →
          </button>
        </div>
      )}

      {/* =================================================
          TODAY'S PERFORMANCE
      ================================================= */}

      <section>
        <div className="flex items-center gap-2 mb-2"><span className="w-1 h-4 rounded-full bg-blue-600"></span><p className="section-label mb-0">Today's Performance</p></div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
          <Stat
            label="Today's Sales"
            value={fmt(
              dashboard.today_sales
            )}
            icon={TrendingUp}
            color="blue"
            trend={salesTrend}
            highlight
            sub={`Yesterday: ${fmt(
              dashboard.yesterday_sales
            )}`}
          />

          <Stat
            label="Today's Collection"
            value={fmt(dashboard.today_collection)}
            icon={CreditCard}
            color="orange"
            sub={`Tax: ${fmt(dashboard.today_tax)}`}
          />

          <Stat
            label="Today's Profit"
            value={fmt(
              dashboard.today_profit
            )}
            icon={DollarSign}
            color="green"
            trend={profitTrend}
            sub={`Margin: ${
              dashboard.profit_margin || 0
            }%`}
          />

          <Stat
            label="Bills Today"
            value={
              dashboard.today_bills || 0
            }
            icon={ShoppingBag}
            color="purple"
            trend={billsTrend}
            sub={`Avg: ${fmt(
              dashboard.avg_bill_today
            )}/bill`}
          />
        </div>
      </section>

      {/* =================================================
          MONTH
      ================================================= */}

      <section>
        <div className="flex items-center gap-2 mb-2"><span className="w-1 h-4 rounded-full bg-blue-600"></span><p className="section-label mb-0">This Month</p></div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
          <Stat
            label="Month Sales"
            value={fmt(
              dashboard.month_sales
            )}
            icon={BarChart2}
            color="indigo"
            sub={`Last month: ${fmt(
              dashboard.last_month_sales
            )}`}
            trend={pct(
              dashboard.month_sales,
              dashboard.last_month_sales
            )}
          />

          <Stat
            label="Month Profit"
            value={fmt(
              dashboard.month_profit
            )}
            icon={TrendingUp}
            color="green"
            sub={`${
              dashboard.month_bills || 0
            } invoices`}
          />

          <Stat
            label="Pending Credit"
            value={fmt(
              dashboard.pending_credit
            )}
            icon={CreditCard}
            color="red"
            sub={`${
              dashboard.total_customers || 0
            } customers`}
          />

          <Stat
            label="Pending Purchases"
            value={fmt(
              dashboard.pending_purchases
            )}
            icon={Truck}
            color="amber"
            sub={`${
              dashboard.total_suppliers || 0
            } suppliers`}
          />
        </div>
      </section>

      {actionRequired.length > 0 && (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-[var(--muted)]" />
            <h2 className="text-sm font-bold text-[var(--ink)]">Action Required</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            {actionRequired.map(item => (
              <button
                key={item.key}
                onClick={() => navigate(item.route)}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-left hover:border-gray-400 hover:shadow-[var(--shadow-card)] transition"
              >
                <span className="text-xs font-medium text-[var(--ink-secondary)]">
                   <strong className="text-base text-[var(--ink)] mr-1">{item.count}</strong>
                  {item.label}
                </span>
                <ArrowUpRight size={15} className="text-[var(--muted)] shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* =================================================
          BUSINESS INSIGHTS
      ================================================= */}

      <section>
        <div className="flex items-center gap-2 mb-2"><span className="w-1 h-4 rounded-full bg-blue-600"></span><p className="section-label mb-0">Business Insights</p></div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3.5">
          <Insight
            label="Sales Growth"
            value={`${
              dashboard.sales_growth > 0
                ? '+'
                : ''
            }${
              dashboard.sales_growth || 0
            }%`}
            icon={
              dashboard.sales_growth >= 0
                ? TrendingUp
                : TrendingDown
            }
            color={
              dashboard.sales_growth >= 0
                ? 'green'
                : 'orange'
            }
            note="vs last month"
          />

          <Insight
            label="Profit Margin"
            value={`${
              dashboard.profit_margin || 0
            }%`}
            icon={Percent}
            color="blue"
            note="Today's margin"
          />

          <Insight
            label="Avg Bill/Month"
            value={fmt(
              dashboard.avg_bill_month
            )}
            icon={ShoppingCart}
            color="purple"
            note="Per invoice this month"
          />

          <Insight
            label="New Customers"
            value={
              dashboard.new_customers_today ||
              0
            }
            icon={Users}
            color="green"
            note="Registered today"
          />
        </div>
      </section>

      {/* =================================================
          ANALYTICS DIVIDER
      ================================================= */}

      <div className="flex items-center gap-3 pt-1">
        <span className="section-label mb-0">Analytics</span>
        <div className="h-px flex-1 bg-[var(--line)]" />
      </div>

      {/* =================================================
          SALES 7 DAYS + HOURLY
      ================================================= */}

      <div
        className="
          grid
          grid-cols-1
          xl:grid-cols-2
          gap-5
        "
      >
        {/* 7 DAYS */}

        <div
          className="
            bg-[var(--surface)]
            rounded-2xl
            border border-[var(--line)]
            shadow-[var(--shadow-card)]
            p-5
            sm:p-6
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              mb-3
            "
          >
            <div>
              <h3 className="font-bold text-[var(--ink)] text-sm tracking-tight">
                Sales & Profit — Last 7 Days
              </h3>

              <p className="text-xs text-[var(--muted)]">
                Daily revenue vs profit
              </p>
            </div>

            <span
              className="
                text-[11px]
                bg-[var(--surface-elevated)]
                border border-[var(--line)]
                text-[var(--ink-secondary)]
                font-bold
                px-2.5
                py-1.5
                rounded-lg
              "
            >
              {fmt(
                sales7.reduce(
                  (sum, item) =>
                    sum +
                    Number(
                      item.sales || 0
                    ),
                  0
                )
              )}{' '}
              week
            </span>
          </div>

          <ResponsiveContainer
            width="100%"
            height={210}
          >
            <ComposedChart
              data={sales7}
              margin={{
                top: 4,
                right: 4,
                left: 0,
                bottom: 0
              }}
            >
              <defs>
                <linearGradient
                  id="salesGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#2563eb"
                    stopOpacity={0.15}
                  />

                  <stop
                    offset="95%"
                    stopColor="#2563eb"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="date"
                tick={{
                  fontSize: 10
                }}
                tickFormatter={value =>
                  String(value).slice(5)
                }
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{
                  fontSize: 10
                }}
                tickFormatter={value =>
                  value >= 1000
                    ? `₹${(
                        value / 1000
                      ).toFixed(0)}k`
                    : `₹${value}`
                }
                axisLine={false}
                tickLine={false}
                width={42}
              />

              <Tooltip
                content={
                  <ChartTooltip />
                }
              />

              <Area
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#salesGradient)"
                dot={{
                  r: 3,
                  fill: '#2563eb'
                }}
                activeDot={{
                  r: 5
                }}
              />

              <Line
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke="#16a34a"
                strokeWidth={2}
                dot={false}
                strokeDasharray="4 2"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* HOURLY */}

        <div
          className="
            bg-[var(--surface)]
            rounded-2xl
            border border-[var(--line)]\r\n            shadow-[var(--shadow-card)]
            p-5
            sm:p-6
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              mb-3
            "
          >
            <div>
              <h3 className="font-bold text-[var(--ink)] text-sm tracking-tight">
                Today&#39;s Hourly Sales
              </h3>

              <p className="text-xs text-[var(--muted)]">
                Revenue by hour of day
              </p>
            </div>

            <span
              className="
                text-[11px]
                bg-[var(--surface-elevated)]
                border border-[var(--line)]
                text-[var(--ink-secondary)]
                font-bold
                px-2.5
                py-1.5
                rounded-lg
                flex
                items-center
                gap-1
              "
            >
              <Clock size={11} />
              Today
            </span>
          </div>

          <ResponsiveContainer
            width="100%"
            height={210}
          >
            <BarChart
              data={hourly}
              margin={{
                top: 4,
                right: 4,
                left: 0,
                bottom: 0
              }}
            >
              <defs>
                <linearGradient
                  id="hourGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="#2563eb"
                    stopOpacity={0.9}
                  />

                  <stop
                    offset="100%"
                    stopColor="#3b82f6"
                    stopOpacity={0.4}
                  />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="hour"
                tick={{
                  fontSize: 9
                }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{
                  fontSize: 10
                }}
                tickFormatter={value =>
                  value >= 1000
                    ? `${(
                        value / 1000
                      ).toFixed(0)}k`
                    : value
                }
                axisLine={false}
                tickLine={false}
                width={32}
              />

              <Tooltip
                content={
                  <ChartTooltip />
                }
              />

              <Bar
                dataKey="total"
                name="Sales"
                fill="url(#hourGradient)"
                radius={[
                  4,
                  4,
                  0,
                  0
                ]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* =================================================
          MONTHLY + CATEGORY
      ================================================= */}

      <div
        className="
          grid
          grid-cols-1
          xl:grid-cols-2
          gap-5
        "
      >
        {/* MONTHLY */}

        <div
          className="
            bg-[var(--surface)]
            rounded-2xl
            border border-[var(--line)]
            shadow-[var(--shadow-card)]
            p-5
            sm:p-6
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              mb-3
            "
          >
            <div>
              <h3 className="font-bold text-[var(--ink)] text-sm tracking-tight">
                Monthly Sales
              </h3>

              <p className="text-xs text-[var(--muted)]">
                Last 6 months revenue
              </p>
            </div>

            <span
              className="
                text-[11px]
                bg-[var(--surface-elevated)]
                border border-[var(--line)]
                text-[var(--ink-secondary)]
                font-bold
                px-2.5
                py-1.5
                rounded-lg
              "
            >
              {fmt(
                monthly[
                  monthly.length - 1
                ]?.total || 0
              )}{' '}
              this month
            </span>
          </div>

          <ResponsiveContainer
            width="100%"
            height={210}
          >
            <BarChart
              data={monthly}
              margin={{
                top: 4,
                right: 4,
                left: 0,
                bottom: 0
              }}
            >
              <XAxis
                dataKey="month"
                tick={{
                  fontSize: 10
                }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{
                  fontSize: 10
                }}
                tickFormatter={value =>
                  value >= 1000
                    ? `₹${(
                        value / 1000
                      ).toFixed(0)}k`
                    : `₹${value}`
                }
                axisLine={false}
                tickLine={false}
                width={42}
              />

              <Tooltip
                content={
                  <ChartTooltip />
                }
              />

              <Bar
                dataKey="total"
                name="Sales"
                fill="#2563eb"
                radius={[
                  5,
                  5,
                  0,
                  0
                ]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CATEGORY */}

        <div
          className="
            bg-[var(--surface)]
            rounded-2xl
            border border-[var(--line)]
            shadow-[var(--shadow-card)]
            p-5
            sm:p-6
          "
        >
          <div className="mb-3">
            <h3 className="font-bold text-[var(--ink)] text-sm tracking-tight">
              Category Sales — This Month
            </h3>

            <p className="text-xs text-[var(--muted)]">
              Revenue by product category
            </p>
          </div>

          {catSales.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-[var(--muted-light)]">
              No category data yet
            </div>
          ) : (
            <div className="flex items-center gap-5">
              <ResponsiveContainer
                width="50%"
                height={180}
              >
                <PieChart>
                  <Pie
                    data={catSales}
                    dataKey="total_revenue"
                    nameKey="product__category__name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {catSales.map(
                      (_, index) => (
                        <Cell
                          key={index}
                          fill={
                            CAT_COLORS[
                              index %
                                CAT_COLORS.length
                            ]
                          }
                        />
                      )
                    )}
                  </Pie>

                  <Tooltip
                    formatter={value =>
                      fmt(value)
                    }
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="flex-1 space-y-2">
                {catSales.map(
                  (category, index) => (
                    <div
                      key={index}
                      className="
                        flex
                        items-center
                        justify-between
                      "
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="
                            w-2.5
                            h-2.5
                            rounded-full
                            shrink-0
                          "
                          style={{
                            background:
                              CAT_COLORS[
                                index %
                                  CAT_COLORS.length
                              ]
                          }}
                        />

                        <span
                          className="
                            text-xs
                            text-[var(--muted)]
                            truncate
                            max-w-[90px]
                          "
                        >
                          {
                            category.product__category__name
                          }
                        </span>
                      </div>

                      <span
                        className="
                          text-xs
                          font-semibold
                          text-[var(--ink)]
                        "
                      >
                        {fmt(
                          category.total_revenue
                        )}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =================================================
          TOP PRODUCTS + PAYMENT
      ================================================= */}

      <div
        className="
          grid
          grid-cols-1
          xl:grid-cols-2
          gap-5
        "
      >
        {/* TOP PRODUCTS */}

        <div
          className="
            bg-[var(--surface)]
            rounded-2xl
            border border-[var(--line)]
            shadow-[var(--shadow-card)]
            p-5
            sm:p-6
          "
        >
          <div className="mb-3">
            <h3 className="font-bold text-[var(--ink)] text-sm tracking-tight">
              Top Products by Revenue
            </h3>

            <p className="text-xs text-[var(--muted)]">
              All-time best sellers
            </p>
          </div>

          {topProducts.length === 0 ? (
            <p className="text-sm text-[var(--muted-light)] py-8 text-center">
              No sales data yet
            </p>
          ) : (
            <div className="space-y-3.5">
              {topProducts.map(
                (product, index) => {
                  const percentage =
                    Math.round(
                      (Number(
                        product.total_revenue ||
                          0
                      ) /
                        maxRevenue) *
                        100
                    )

                  return (
                    <div
                      key={
                        product.id ||
                        index
                      }
                    >
                      <div
                        className="
                          flex
                          items-center
                          justify-between
                          mb-1
                        "
                      >
                        <div
                          className="
                            flex
                            items-center
                            gap-2
                            min-w-0
                          "
                        >
                          <span
                            className="
                              text-[10px]
                              font-bold
                              text-[var(--muted-light)]
                              w-4
                            "
                          >
                            #{index + 1}
                          </span>

                          <span
                            className="
                              text-xs
                              font-medium
                              text-[var(--ink-secondary)]
                              truncate
                              max-w-[55%]
                            "
                          >
                            {
                              product.product_name
                            }
                          </span>
                        </div>

                        <div
                          className="
                            flex
                            items-center
                            gap-2
                            shrink-0
                          "
                        >
                          <span
                            className="
                              text-[10px]
                              text-[var(--muted-light)]
                            "
                          >
                            {Number(
                              product.total_qty ||
                                0
                            ).toFixed(0)}{' '}
                            units
                          </span>

                          <span
                            className="
                              text-xs
                              font-bold
                              text-[var(--ink)]
                            "
                          >
                            {fmt(
                              product.total_revenue
                            )}
                          </span>
                        </div>
                      </div>

                      <div
                        className="
                          h-1.5
                          bg-[var(--line)]
                          rounded-full
                          overflow-hidden
                        "
                      >
                        <div
                          className="
                            h-full
                            rounded-full
                          "
                          style={{
                            width: `${Math.min(
                              percentage,
                              100
                            )}%`,
                            background:
                              CAT_COLORS[
                                index %
                                  CAT_COLORS.length
                              ]
                          }}
                        />
                      </div>
                    </div>
                  )
                }
              )}
            </div>
          )}
        </div>

        {/* PAYMENT */}

        <div
          className="
            bg-[var(--surface)]
            rounded-2xl
            border border-[var(--line)]
            shadow-[var(--shadow-card)]
            p-5
            sm:p-6
          "
        >
          <div className="mb-3">
            <h3 className="font-bold text-[var(--ink)] text-sm tracking-tight">
              Payment Methods
            </h3>

            <p className="text-xs text-[var(--muted)]">
              Today's collection by payment type
            </p>
          </div>

          {payDist.length === 0 ? (
            <p className="text-sm text-[var(--muted-light)] py-8 text-center">
              No payment data yet
            </p>
          ) : (
            <div className="flex items-center gap-5">
              <ResponsiveContainer
                width="55%"
                height={180}
              >
                <PieChart>
                  <Pie
                    data={payDist}
                    dataKey="total"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {payDist.map(
                      (payment, index) => (
                        <Cell
                          key={index}
                          fill={
                            PAY_COLORS[
                              payment.method
                            ] ||
                            CAT_COLORS[
                              index %
                                CAT_COLORS.length
                            ]
                          }
                        />
                      )
                    )}
                  </Pie>

                  <Tooltip
                    formatter={value =>
                      fmt(value)
                    }
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="flex-1 space-y-2.5">
                {payDist.map(
                  (payment, index) => (
                    <div
                      key={index}
                      className="
                        flex
                        items-center
                        justify-between
                      "
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="
                            w-2.5
                            h-2.5
                            rounded-full
                            shrink-0
                          "
                          style={{
                            background:
                              PAY_COLORS[
                                payment.method
                              ] ||
                              CAT_COLORS[
                                index %
                                  CAT_COLORS.length
                              ]
                          }}
                        />

                        <span
                          className="
                            text-xs
                            text-[var(--muted)]
                            capitalize
                          "
                        >
                          {
                            payment.method
                          }
                        </span>
                      </div>

                      <div className="text-right">
                        <div
                          className="
                            text-xs
                            font-bold
                            text-[var(--ink)]
                          "
                        >
                          {fmt(
                            payment.total
                          )}
                        </div>

                        <div
                          className="
                            text-[10px]
                            text-[var(--muted-light)]
                          "
                        >
                          {
                            payment.count
                          }{' '}
                          txns
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =================================================
          STOCK + RECENT BILLS
      ================================================= */}

      <div
        className="
          grid
          grid-cols-1
          xl:grid-cols-3
          gap-5
        "
      >
        {/* STOCK */}

        <div
          className="
            bg-[var(--surface)]
            rounded-2xl
            border border-[var(--line)]
            shadow-[var(--shadow-card)]
            p-5
            sm:p-6
          "
        >
          <div
            className="
              flex
              items-center
              justify-between
              mb-3
            "
          >
            <div>
              <h3 className="font-bold text-[var(--ink)] text-sm tracking-tight">
                Stock Alerts
              </h3>

              <p className="text-xs text-[var(--muted)]">
                {
                  dashboard.out_of_stock ||
                  0
                }{' '}
                out of stock ·{' '}
                {
                  dashboard.low_stock_count ||
                  0
                }{' '}
                low stock
              </p>
            </div>

            <div className="flex gap-2">
              {dashboard.out_of_stock >
                0 && (
                <span
                  className="
                    text-xs
                    bg-[var(--surface-elevated)]
                    text-[var(--ink-secondary)]
                    border border-[var(--line)]
                    font-semibold
                    px-2
                    py-1
                    rounded-lg
                  "
                >
                  {
                    dashboard.out_of_stock
                  }{' '}
                  out
                </span>
              )}

              {dashboard.low_stock_count >
                0 && (
                <span
                  className="
                    text-xs
                    bg-[var(--surface-elevated)]
                    text-[var(--ink-secondary)]
                    border border-[var(--line)]
                    font-semibold
                    px-2
                    py-1
                    rounded-lg
                  "
                >
                  {
                    dashboard.low_stock_count
                  }{' '}
                  low
                </span>
              )}
            </div>
          </div>

          {lowStock.length === 0 ? (
            <div
              className="
                flex
                flex-col
                items-center
                justify-center
                py-8
                gap-2
              "
            >
              <div
                className="
                  w-10
                  h-10
                  rounded-full
                  bg-[var(--surface-elevated)]
                  border border-[var(--line)]
                  flex
                  items-center
                  justify-center
                "
              >
                <Package
                  size={20}
                  className="text-[var(--muted)]"
                />
              </div>

              <p className="text-sm text-[var(--muted-light)]">
                All products well stocked
              </p>
            </div>
          ) : (
            <div
              className="
                space-y-2
                max-h-60
                overflow-y-auto
              "
            >
              {lowStock.map(
                product => (
                  <div
                    key={product.id}
                    className="
                      flex
                      items-center
                      justify-between
                      py-1.5
                      border-b
                      border-[var(--line-subtle)]
                      last:border-0
                    "
                  >
                    <div className="min-w-0">
                      <div
                        className="
                          text-sm
                          font-medium
                          text-[var(--ink)]
                          truncate
                        "
                      >
                        {product.name}
                      </div>

                      <div
                        className="
                          text-xs
                          text-[var(--muted)]
                        "
                      >
                        {product.sku}
                      </div>
                    </div>

                    <div
                      className="
                        flex
                        items-center
                        gap-3
                        shrink-0
                      "
                    >
                      <div className="text-right">
                        <div
                          className={`
                            text-sm
                            font-bold
                            text-[var(--ink)]
                          `}
                        >
                          {
                            product.current_stock
                          }
                        </div>

                        <div
                          className="
                            text-[10px]
                            text-[var(--muted-light)]
                          "
                        >
                          min{' '}
                          {
                            product.minimum_stock
                          }
                        </div>
                      </div>

                      <Badge
                        status={
                          product.current_stock <=
                          0
                            ? 'out_of_stock'
                            : 'low_stock'
                        }
                      />
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* RECENT BILLS */}

        <div
          className="
            bg-[var(--surface)]
            rounded-2xl
            border border-[var(--line)]
            shadow-[var(--shadow-card)]
            p-5
            sm:p-6
          "
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-[var(--ink)] text-sm tracking-tight">
                Recent Bills
              </h3>

              <p className="text-xs text-[var(--muted)]">
                Latest {recentBills.length}{' '}
                invoices
              </p>
            </div>
          </div>

          <div
            className="
              space-y-2
              max-h-60
              overflow-y-auto
            "
          >
            {recentBills.length === 0 ? (
              <p
                className="
                  text-sm
                  text-[var(--muted-light)]
                  text-center
                  py-8
                "
              >
                No bills yet
              </p>
            ) : (
              recentBills.map(
                bill => (
                  <div
                    key={bill.id}
                    className="
                      flex
                      items-center
                      justify-between
                      py-1.5
                      border-b
                      border-[var(--line-subtle)]
                      last:border-0
                    "
                  >
                    <div className="min-w-0">
                      <div
                        className="
                          text-sm
                          font-mono
                          font-semibold
                          text-[var(--ink-secondary)]
                        "
                      >
                        {
                          bill.invoice_number
                        }
                      </div>

                      <div
                        className="
                          text-xs
                          text-[var(--muted-light)]
                          truncate
                        "
                      >
                        {
                          bill.customer_name
                        }
                      </div>
                    </div>

                    <div
                      className="
                        flex
                        items-center
                        gap-3
                        shrink-0
                      "
                    >
                      <div className="text-right">
                        <div
                          className="
                            text-sm
                            font-bold
                            text-[var(--ink)]
                          "
                        >
                          {fmtDec(
                            bill.grand_total
                          )}
                        </div>

                        <div
                          className="
                            text-[10px]
                            text-[var(--muted-light)]
                            capitalize
                          "
                        >
                          {
                            bill.payment_method
                          }
                        </div>
                      </div>

                      <Badge
                        status={
                          bill.payment_status
                        }
                      />
                    </div>
                  </div>
                )
              )
            )}
          </div>
        </div>

        {/* TOP CUSTOMERS */}
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--line)]/80 shadow-[0_8px_30px_rgba(15,23,42,0.05)] p-5 sm:p-6">
          <div className="mb-3">
            <h3 className="font-bold text-[var(--ink)] text-sm tracking-tight">Top Customers</h3>
            <p className="text-xs text-[var(--muted)]">Highest completed sales</p>
          </div>
          {topCustomers.length === 0 ? (
            <p className="text-sm text-[var(--muted-light)] py-8 text-center">No customer sales yet</p>
          ) : (
            <div className="space-y-3">
              {topCustomers.map((customer, index) => (
                <div key={customer.customer_id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[var(--muted-light)] w-4">#{index + 1}</span>
                    <span className="text-sm font-medium text-[var(--ink-secondary)] truncate">{customer.customer__name}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-[var(--ink)]">{fmt(customer.total)}</div>
                    <div className="text-[10px] text-[var(--muted-light)]">{customer.bills} bills</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* =================================================
          FIRST LOAD BACKGROUND INDICATOR
      ================================================= */}

      {firstLoad && refreshing && (
        <div
          className="
            fixed
            bottom-4
            right-4
            z-40
            bg-[var(--surface)]
            border
            border-[var(--line)]
            shadow-lg
            rounded-full
            px-3
            py-2
            text-xs
            text-[var(--muted)]
            flex
            items-center
            gap-2
          "
        >
          <span
            className="
              w-2
              h-2
              bg-gray-400
              rounded-full
              animate-pulse
            "
          />

          Loading latest data...
        </div>
      )}

    </div>
  )
}
