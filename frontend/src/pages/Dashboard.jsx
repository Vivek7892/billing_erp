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
  cash: '#16a34a',
  upi: '#2563eb',
  card: '#7c3aed',
  online: '#0891b2',
  credit: '#dc2626'
}

const CAT_COLORS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#dc2626'
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
  const colors = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/60',
      icon: 'text-blue-600 dark:text-blue-400'
    },

    green: {
      bg: 'bg-green-50 dark:bg-green-950/60',
      icon: 'text-green-600 dark:text-green-400'
    },

    orange: {
      bg: 'bg-orange-50 dark:bg-orange-950/60',
      icon: 'text-orange-500'
    },

    red: {
      bg: 'bg-red-50 dark:bg-red-950/60',
      icon: 'text-red-500'
    },

    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600'
    },

    cyan: {
      bg: 'bg-cyan-50',
      icon: 'text-cyan-600'
    },

    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/60',
      icon: 'text-indigo-600'
    }
  }

  const style = colors[color] || colors.blue

  return (
    <div
      className={`
        group
        bg-[var(--surface)]
        rounded-2xl
        border border-[var(--line)]/80
        ${highlight ? 'ring-2 ring-blue-200 border-blue-300' : ''}
        p-4 sm:p-5
        flex flex-col gap-3
        shadow-[0_6px_24px_rgba(15,23,42,0.045)]
        hover:-translate-y-0.5
        hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)]
        transition-all
      `}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="
            text-[10px]
            font-bold
            text-[var(--muted-light)]
            uppercase
            tracking-[0.14em]
            leading-tight
          "
        >
          {label}
        </span>

        <div
          className={`
            w-9 h-9
            rounded-xl
            ${style.bg}
            flex
            items-center
            justify-center
            flex-shrink-0
            ring-1
            ring-black/5
          `}
        >
          <Icon
            size={16}
            className={style.icon}
          />
        </div>
      </div>

      <div
        className="
          text-xl
          sm:text-2xl
          font-extrabold
          tracking-tight
          text-[var(--ink)]
          truncate
        "
      >
        {value}
      </div>

      {sub && (
        <div className="text-xs text-[var(--muted)] truncate">
          {sub}
        </div>
      )}

      {trend !== undefined && (
        <Trend value={trend} />
      )}
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
  const colors = {
    green:
      'bg-green-50 dark:bg-green-950/60 border-green-100 text-green-700',

    blue:
      'bg-blue-50 dark:bg-blue-950/60 border-blue-100 text-blue-700',

    orange:
      'bg-orange-50 dark:bg-orange-950/60 border-orange-100 text-orange-700',

    purple:
      'bg-purple-50 border-purple-100 text-purple-700'
  }

  return (
    <div
      className={`
        rounded-xl
        border
        p-4
        ${colors[color] || colors.blue}
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} />

        <span
          className="
            text-xs
            font-semibold
            uppercase
            tracking-wide
          "
        >
          {label}
        </span>
      </div>

      <div
        className="
          text-2xl
          font-extrabold
          tracking-tight
        "
      >
        {value}
      </div>

      {note && (
        <div className="text-xs mt-1 opacity-70">
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
        bg-[var(--app-bg)]
        border border-slate-800
        rounded-xl
        shadow-2xl
        px-3 py-2.5
        text-xs
        text-white
      "
    >
      <div className="font-semibold text-slate-300 mb-1">
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

          <span className="text-[var(--muted-light)]">
            {item.name}:
          </span>

          <span className="font-bold text-white">
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
        bg-slate-900
        text-white
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
    }, 30000)

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
        space-y-6
        bg-[var(--surface-elevated)]/80
        -m-2
        sm:-m-4
        p-2
        sm:p-4
        rounded-2xl
      "
    >

      {/* =================================================
          HEADER
      ================================================= */}

      <div
        className="
          w-full
          bg-[var(--app-bg)]
          border border-[var(--line)]
          rounded-2xl
          px-4 sm:px-5
          py-3
          shadow-[var(--shadow-card)]
        "
      >
        <div
          className="
            flex
            flex-col
            gap-3
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          {/* SHOP INFO */}

          <div className="min-w-0 flex-1">
            <h2
              className="
                text-base
                sm:text-lg
                lg:text-xl
                font-bold
                tracking-tight
                text-[var(--ink)]
                truncate
              "
            >
              {shopName}
            </h2>

            <div
              className="
                mt-0.5
                flex
                flex-wrap
                items-center
                gap-x-2
                gap-y-0.5
                text-[11px]
                text-[var(--muted-light)]
              "
            >
              <span>
                {now.toLocaleDateString(
                  'en-IN',
                  {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  }
                )}
              </span>

              <span className="text-[var(--muted-light)]">
                ·
              </span>

              <span>
                {now.toLocaleTimeString(
                  'en-IN',
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true
                  }
                )}
              </span>
            </div>
          </div>

          {/* ACTIONS */}

          <div
            className="
              flex
              items-center
              gap-2
              w-full
              sm:w-auto
            "
          >
            <button
              onClick={() =>
                navigate('/billing/new')
              }
              className="
                flex-1
                sm:flex-none
                h-8
                sm:h-9
                px-3
                sm:px-4
                rounded-lg
                bg-[var(--primary)]
                hover:bg-[var(--primary-hover)]
                active:bg-[var(--primary-active)]
                text-white
                text-xs
                sm:text-sm
                font-semibold
                flex
                items-center
                justify-center
                gap-1.5
                transition-colors
                shadow-[var(--shadow-primary)]
                whitespace-nowrap
              "
            >
              <ShoppingCart size={13} />
              <span>New Bill</span>
            </button>

            <button
              onClick={() =>
                loadDashboard({
                  force: true
                })
              }
              disabled={refreshing}
              aria-label="Refresh"
              title="Refresh dashboard"
              className="
                shrink-0
                w-8
                h-8
                rounded-lg
                border
                border-[var(--line)]
                bg-[var(--surface)]
                text-[var(--muted)]
                flex
                items-center
                justify-center
                hover:bg-[var(--surface-hover)]
                active:bg-[var(--line-subtle)]
                disabled:opacity-50
                transition-colors
              "
            >
              <RefreshCw
                size={13}
                className={
                  refreshing
                    ? 'animate-spin'
                    : ''
                }
              />
            </button>
          </div>
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
          className={`
            flex
            flex-wrap
            items-center
            justify-between
            gap-3
            rounded-2xl
            border
            px-4
            py-3
            shadow-[var(--shadow-card)]
            ${
              dashboard.out_of_stock > 0
                ? 'bg-red-50 dark:bg-red-950/60 border-red-200'
                : 'bg-orange-50 dark:bg-orange-950/60 border-orange-200'
            }
          `}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle
              size={16}
              className={
                dashboard.out_of_stock > 0
                  ? 'text-red-500'
                  : 'text-orange-500'
              }
            />

            <span
              className={`
                text-sm
                font-semibold
                ${
                  dashboard.out_of_stock > 0
                    ? 'text-red-700'
                    : 'text-orange-700'
                }
              `}
            >
              Stock Alert:

              {dashboard.out_of_stock >
                0 && (
                <span className="ml-1">
                  {dashboard.out_of_stock}{' '}
                  product
                  {dashboard.out_of_stock >
                  1
                    ? 's'
                    : ''}{' '}
                  out of stock
                </span>
              )}

              {dashboard.out_of_stock >
                0 &&
                dashboard.low_stock_count >
                  0 && (
                  <span className="mx-1">
                    ·
                  </span>
                )}

              {dashboard.low_stock_count >
                0 && (
                <span>
                  {
                    dashboard.low_stock_count
                  }{' '}
                  product
                  {dashboard.low_stock_count >
                  1
                    ? 's'
                    : ''}{' '}
                  running low
                </span>
              )}
            </span>
          </div>

          <button
            onClick={() =>
              navigate('/inventory')
            }
            className="
              text-xs
              font-semibold
              underline
              text-blue-600 dark:text-blue-400
            "
          >
            View Inventory →
          </button>
        </div>
      )}

      {/* =================================================
          TODAY'S PERFORMANCE
      ================================================= */}

      <section>
        <p
          className="
            text-[10px]
            font-bold
            text-[var(--muted-light)]
            uppercase
            tracking-[0.18em]
            mb-3
          "
        >
          Today's Performance
        </p>

        <div
            className="grid grid-cols-2 xl:grid-cols-4 gap-3"
        >
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

          <Stat
            label="Today's Collection"
            value={fmt(dashboard.today_collection)}
            icon={CreditCard}
            color="orange"
            sub={`Tax: ${fmt(dashboard.today_tax)}`}
          />
        </div>
      </section>

      {/* =================================================
          MONTH
      ================================================= */}

      <section>
        <p
          className="
            text-[10px]
            font-bold
            text-[var(--muted-light)]
            uppercase
            tracking-[0.18em]
            mb-3
          "
        >
          This Month
        </p>

        <div
          className="
            grid
            grid-cols-2
            xl:grid-cols-4
            gap-3
          "
        >
          <Stat
            label="Month Sales"
            value={fmt(
              dashboard.month_sales
            )}
            icon={BarChart2}
            color="blue"
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
            color="orange"
            sub={`${
              dashboard.total_suppliers || 0
            } suppliers`}
          />
        </div>
      </section>

      {actionRequired.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-amber-600" />
            <h2 className="text-sm font-bold text-amber-900 dark:text-amber-400">Action Required</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            {actionRequired.map(item => (
              <button
                key={item.key}
                onClick={() => navigate(item.route)}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-[var(--surface)] px-3 py-3 text-left hover:border-amber-400 hover:shadow-[var(--shadow-card)] transition"
              >
                <span className="text-xs font-medium text-[var(--ink-secondary)]">
                   <strong className="text-base text-[var(--ink)] mr-1">{item.count}</strong>
                  {item.label}
                </span>
                <ArrowUpRight size={15} className="text-amber-600 shrink-0" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* =================================================
          BUSINESS INSIGHTS
      ================================================= */}

      <section>
        <p
          className="
            text-[10px]
            font-bold
            text-[var(--muted-light)]
            uppercase
            tracking-[0.18em]
            mb-3
          "
        >
          Business Insights
        </p>

        <div
          className="
            grid
            grid-cols-2
            xl:grid-cols-4
            gap-3
          "
        >
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

      <div
        className="
          flex
          items-center
          gap-3
          pt-2
        "
      >
        <span
          className="
            text-[10px]
            font-bold
            uppercase
            tracking-[0.18em]
            text-[var(--muted-light)]
          "
        >
          Analytics
        </span>

        <div className="h-px flex-1 bg-slate-200" />
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
            border border-[var(--line)]/80
            shadow-[0_8px_30px_rgba(15,23,42,0.05)]
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
                bg-slate-100
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
            border border-[var(--line)]/80
            shadow-[0_8px_30px_rgba(15,23,42,0.05)]
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
                Today's Hourly Sales
              </h3>

              <p className="text-xs text-[var(--muted)]">
                Revenue by hour of day
              </p>
            </div>

            <span
              className="
                text-[11px]
                bg-violet-50
                text-violet-700
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
                    stopColor="#7c3aed"
                    stopOpacity={0.9}
                  />

                  <stop
                    offset="100%"
                    stopColor="#a78bfa"
                    stopOpacity={0.5}
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
            border border-[var(--line)]/80
            shadow-[0_8px_30px_rgba(15,23,42,0.05)]
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
                bg-emerald-50 dark:bg-emerald-950/60
                text-emerald-700
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
            border border-[var(--line)]/80
            shadow-[0_8px_30px_rgba(15,23,42,0.05)]
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
            border border-[var(--line)]/80
            shadow-[0_8px_30px_rgba(15,23,42,0.05)]
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
                          bg-gray-100
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
            border border-[var(--line)]/80
            shadow-[0_8px_30px_rgba(15,23,42,0.05)]
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
            border border-[var(--line)]/80
            shadow-[0_8px_30px_rgba(15,23,42,0.05)]
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
                    bg-red-50 dark:bg-red-950/60
                    text-red-600 dark:text-red-400
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
                    bg-orange-50 dark:bg-orange-950/60
                    text-orange-600 dark:text-orange-400
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
                  bg-green-50 dark:bg-green-950/60
                  flex
                  items-center
                  justify-center
                "
              >
                <Package
                  size={20}
                  className="text-green-500"
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
                      border-gray-50
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
                            ${
                              product.current_stock <=
                              0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-orange-500'
                            }
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
            border border-[var(--line)]/80
            shadow-[0_8px_30px_rgba(15,23,42,0.05)]
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
                      border-gray-50
                      last:border-0
                    "
                  >
                    <div className="min-w-0">
                      <div
                        className="
                          text-sm
                          font-mono
                          font-semibold
                          text-blue-600 dark:text-blue-400
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

      {firstLoad && !refreshing && (
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
              bg-blue-50 dark:bg-blue-950/600
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
