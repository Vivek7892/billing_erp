import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconArrowUpRight,
  IconChartBar,
  IconCalendarEvent,
  IconCheck,
  IconCircleCheck,
  IconClockHour3,
  IconCreditCard,
  IconEye,
  IconFileText,
  IconFilter,
  IconPackage,
  IconPlus,
  IconRefresh,
  IconRoute,
  IconShieldCheck,
  IconX,
} from '@tabler/icons-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '../api'
import { Badge, Spinner } from '../components/UI'
import { MobileKpiGrid, MobileFAB } from '../components/MobileUI'
import { useShop } from '../components/Layout'
import { useAuth } from '../AuthContext'
import DashboardBannerCarousel from './DashboardBannerCarousel'
import FirstUseChecklist from '../components/FirstUseChecklist'
import {
  DashboardVideoGuides,
  InformationalBanner,
  EcosystemVisualModal,
} from '../components/visual-content'
import {
  formatCurrency,
  formatNumber,
  formatDecimal,
  formatPercent,
  formatQuantity,
  formatDate,
  formatDateTime,
  fmtCurrency,
} from '../utils/formatters'

const EMPTY = {
  today_sales: 0,
  yesterday_sales: 0,
  today_collection: 0,
  today_profit: 0,
  yesterday_profit: 0,
  today_bills: 0,
  avg_bill_today: 0,
  today_tax: 0,
  month_sales: 0,
  month_bills: 0,
  month_profit: 0,
  last_month_sales: 0,
  last_month_profit: 0,
  today_purchases: 0,
  month_purchases: 0,
  last_month_purchases: 0,
  today_expenses: 0,
  month_expenses: 0,
  last_month_expenses: 0,
  today_payments_total: 0,
  month_payments_total: 0,
  last_month_payments_total: 0,
  pending_credit: 0,
  out_of_stock: 0,
  low_stock_count: 0,
  profit_margin: 0,
  sales_7days: [],
  payment_distribution: [],
  action_required: [],
  low_stock_products: [],
  recent_bills: [],
  top_products: [],
  is_filtered: false,
  filter_label: '',
  filter_period: 'today',
  filter_start: '',
  filter_end: '',
}

const percentChange = (current, previous) => {
  if (!Number(previous)) return 0
  return Math.round(
    ((Number(current) - Number(previous)) / Number(previous)) * 100
  * 10
  ) / 10
}

const formatDateShort = (dateString) => formatDate(dateString)

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs shadow-md">
      <p className="mb-0.5 font-semibold text-[var(--muted)]">{label}</p>
      <p className="font-bold text-[var(--ink)] font-mono">
        {fmtCurrency(payload[0]?.value)}
      </p>
    </div>
  )
}

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex min-h-28 flex-col items-center justify-center gap-2 px-3 py-6 text-center">
      <Icon size={22} className="text-[var(--muted-light)]" />
      <p className="text-xs text-[var(--muted)]">{text}</p>
    </div>
  )
}

const getInvoiceRowClass = status => {
  const s = String(status || '').toLowerCase()
  if (s === 'paid' || s === 'completed') return 'row-paid'
  if (s === 'pending' || s === 'partial') return 'row-pending'
  if (s === 'credit' || s === 'overdue') return 'row-overdue'
  if (s === 'cancelled') return 'row-cancelled'
  return ''
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { shopName } = useShop()
  const { user } = useAuth()

  const [totpBannerDismissed, setTotpBannerDismissed] = useState(() => {
    return sessionStorage.getItem('dismiss_totp_reminder') === 'true'
  })

  const handleDismissTotpBanner = () => {
    setTotpBannerDismissed(true)
    sessionStorage.setItem('dismiss_totp_reminder', 'true')
  }

  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [ecosystemModalOpen, setEcosystemModalOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [showMoreMobile, setShowMoreMobile] = useState(false)
  const [filterPeriod, setFilterPeriod] = useState('today')
  const [customDate, setCustomDate] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef(null)

  const isFiltered = useMemo(() => {
    return filterPeriod !== 'today' || Boolean(customDate) || Boolean(data?.is_filtered)
  }, [filterPeriod, customDate, data?.is_filtered])

  useEffect(() => {
    function handleClickOutside(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false)
      }
    }
    if (filterOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [filterOpen])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadDashboard = useCallback(async (overrideFilter) => {
    try {
      setRefreshing(true)
      setError('')
      const activePeriod = overrideFilter && 'period' in overrideFilter ? overrideFilter.period : filterPeriod
      const activeDate = overrideFilter && 'date' in overrideFilter ? overrideFilter.date : customDate

      const params = {}
      if (activePeriod && activePeriod !== 'today') {
        params.period = activePeriod
      }
      if (activeDate) {
        params.date = activeDate
      }

      const response = await api.get('/dashboard/', { params })
      setData({
        ...EMPTY,
        ...(response.data || {}),
      })
    } catch {
      setError('Unable to refresh dashboard data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filterPeriod, customDate])

  const handleSelectPeriod = (period) => {
    setFilterPeriod(period)
    setCustomDate('')
    setFilterOpen(false)
    loadDashboard({ period, date: '' })
  }

  const handleApplyCustomDate = (dateVal) => {
    if (!dateVal) return
    setFilterPeriod('custom')
    setCustomDate(dateVal)
    setFilterOpen(false)
    loadDashboard({ period: 'custom', date: dateVal })
  }

  const handleResetFilter = () => {
    setFilterPeriod('today')
    setCustomDate('')
    setFilterOpen(false)
    loadDashboard({ period: 'today', date: '' })
  }

  const filterOptions = [
    { id: 'today', label: 'Today (Live)' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: '7days', label: 'Last 7 Days' },
    { id: 'this_month', label: 'This Month' },
    { id: 'prev_month', label: 'Previous Month' },
  ]

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const salesTrend = useMemo(
    () => percentChange(data.today_sales, data.yesterday_sales),
    [data.today_sales, data.yesterday_sales]
  )
  const salesTrendLabel = Number(data.yesterday_sales)
    ? `${salesTrend > 0 ? '+' : ''}${salesTrend}% vs yesterday`
    : 'No prior-day baseline'
  const profitDifference = Number(data.today_profit || 0) - Number(data.yesterday_profit || 0)
  const hasProfitBaseline = Number(data.yesterday_profit) !== 0
  const profitTrendLabel = hasProfitBaseline && Number(data.yesterday_profit) > 0
    ? `${percentChange(data.today_profit, data.yesterday_profit) > 0 ? '+' : ''}${percentChange(data.today_profit, data.yesterday_profit)}% vs yesterday`
    : hasProfitBaseline
      ? `${profitDifference > 0 ? 'Higher' : profitDifference < 0 ? 'Lower' : 'Unchanged'} than yesterday`
      : 'No prior-day baseline'

  const salesChartData = useMemo(() => {
    const list = data.sales_7days || []
    return list.map(item => ({
      ...item,
      sales: Number(item.sales || 0),
    }))
  }, [data.sales_7days])

  const paymentDistributionData = useMemo(() => {
    const list = data.payment_distribution || []
    const total = list.reduce((s, x) => s + Number(x.total || 0), 0) || 1
    return list.map(p => ({
      ...p,
      share: Math.round((Number(p.total || 0) / total) * 100),
    }))
  }, [data.payment_distribution])

  const salesData = salesChartData
  const payments = paymentDistributionData
  const paymentTotal = payments.reduce((sum, payment) => sum + Number(payment.total || 0), 0)
  const paymentMethodRows = useMemo(() => {
    const methods = new Map(payments.map(payment => [String(payment.method || '').toLowerCase(), payment]))
    const preferred = ['upi', 'cash', 'credit', 'razorpay']
    const rows = preferred.map(method => methods.get(method) || { method, total: 0, count: 0 })
    const other = payments.filter(payment => !preferred.includes(String(payment.method || '').toLowerCase()))
    return [...rows, ...other]
  }, [payments])
  const lowStock = data.low_stock_products || []
  const nearExpiryBatches = data.near_expiry_batches || []
  const recentBills = data.recent_bills || []
  const topProducts = data.top_products || []
  const actionRequired = data.action_required || []

  const creditDueCount = useMemo(() => {
    const item = actionRequired.find(a => a.key === 'credit')
    return item ? item.count : 0
  }, [actionRequired])

  const totalSales = useMemo(
    () => salesData.reduce((sum, item) => sum + Number(item.sales || 0), 0),
    [salesData]
  )

  const attentionItems = useMemo(() => {
    const items = []
    if (Number(data.pending_credit) > 0 || creditDueCount > 0) {
      items.push({ key: 'credit', title: 'Outstanding credit', count: creditDueCount, detail: `${fmtCurrency(data.pending_credit)} due`, route: '/parties/customers?credit_due=1', action: 'View customers' })
    }
    if (Number(data.out_of_stock) > 0) {
      items.push({ key: 'out-of-stock', title: 'Out of stock', count: Number(data.out_of_stock), detail: 'Immediate restock needed', route: '/inventory/stock', action: 'Manage stock' })
    }
    if (Number(data.low_stock_count) > 0) {
      items.push({ key: 'low-stock', title: 'Low stock', count: Number(data.low_stock_count), detail: 'Below minimum level', route: '/inventory/stock', action: 'Manage stock' })
    }
    actionRequired.filter(item => item.key !== 'credit' && item.key !== 'stock' && Number(item.count) > 0).forEach(item => {
      items.push({ key: item.key, title: String(item.key || 'Action required').replace(/_/g, ' '), count: item.count, detail: item.label, route: item.route, action: 'Review' })
    })
    return items
  }, [actionRequired, creditDueCount, data])

  const primaryKpis = useMemo(() => [
    {
      label: isFiltered ? `${data.filter_label || 'Period'} Sales` : "Today's Sales",
      value: fmtCurrency(data.today_sales),
      sub: `${data.today_bills || 0} bills`,
      onClick: () => navigate('/sales/invoices'),
    },
    {
      label: "Collections",
      value: fmtCurrency(data.today_collection || data.today_payments_total),
      sub: `Tax ${fmtCurrency(data.today_tax)}`,
      onClick: () => navigate('/sales/payments'),
    },
    {
      label: "Gross Profit",
      value: fmtCurrency(data.today_profit),
      sub: `Margin ${Number(data.profit_margin || 0).toFixed(1)}%`,
      onClick: () => navigate('/reports'),
    },
    {
      label: "Receivables",
      value: fmtCurrency(data.pending_credit),
      sub: `${creditDueCount} pending`,
      onClick: () => navigate('/parties/customers?credit_due=1'),
    },
  ], [data, creditDueCount, navigate, isFiltered])

  const secondaryKpis = useMemo(() => [
    {
      label: "Gross Profit",
      value: fmtCurrency(data.today_profit),
      sub: `Margin ${Number(data.profit_margin || 0).toFixed(1)}%`,
    },
    {
      label: "Stock Alerts",
      value: `${data.low_stock_count || 0} low`,
      sub: `${data.out_of_stock || 0} out of stock`,
    },
    {
      label: "Purchases Today",
      value: fmtCurrency(data.today_purchases),
    },
    {
      label: "Expenses Today",
      value: fmtCurrency(data.today_expenses),
    },
    {
      label: "Month Sales",
      value: fmtCurrency(data.month_sales),
      sub: Number(data.last_month_sales) ? `${data.sales_growth > 0 ? '+' : ''}${Number(data.sales_growth || 0).toFixed(1)}% vs prior` : undefined,
    },
    {
      label: "Month Profit",
      value: fmtCurrency(data.month_profit),
    },
  ], [data])

  if (loading) {
    return <Spinner label="Loading dashboard" />
  }

  return (
    <div className="dashboard-page min-w-0 space-y-4 pb-6">
      
      {/* 2FA Security Reminder Banner (Mobile-Friendly & Dismissable) */}
      {!user?.totp_enabled && !totpBannerDismissed && (
        <div className="relative overflow-hidden rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/90 via-sky-50/70 to-white dark:border-indigo-900/50 dark:from-indigo-950/40 dark:via-slate-900/40 dark:to-slate-900/40 p-3 sm:p-3.5 shadow-xs transition-all">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pr-7 sm:pr-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <IconShieldCheck size={18} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Protect Your Account with 2FA</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Recommended</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 sm:line-clamp-none mt-0.5">
                  Enable Google Authenticator (TOTP) to secure store logins and staff access.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => navigate(user?.role === 'cashier' ? '/settings' : '/settings?tab=security')}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
              >
                <span>Enable 2FA</span>
                <IconArrowUpRight size={13} />
              </button>

              <button
                type="button"
                onClick={handleDismissTotpBanner}
                title="Dismiss reminder"
                aria-label="Dismiss 2FA reminder"
                className="absolute sm:static top-2.5 right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <IconX size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TOP BAR: Store Name, Live IST Clock, Action Controls & Filter Symbol
      -------------------------------------------------------------- */}
      <header className="dashboard-header rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg sm:text-xl font-bold tracking-tight text-[var(--ink)]">
              {shopName || 'Dreamwithtech ERP'}
            </h1>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1 font-medium">
                <IconCalendarEvent size={13} className="text-[var(--muted)] shrink-0" />
                {currentTime.toLocaleDateString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              <span className="text-[var(--line-strong)]">·</span>
              <span className="inline-flex items-center gap-1 font-mono font-semibold text-[var(--ink)]">
                <IconClockHour3 size={13} className="text-[#1E3A5F] dark:text-sky-400 shrink-0" />
                {currentTime.toLocaleTimeString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true,
                })}
              </span>
              <span className="text-[10px] text-[var(--muted)] font-medium bg-[var(--surface-elevated)] px-1.5 py-0.5 rounded border border-[var(--line)]">
                IST
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Small filter button - symbol only - to get previous data */}
            <div className="relative" ref={filterRef}>
              <button
                type="button"
                onClick={() => setFilterOpen(v => !v)}
                title={isFiltered ? `Filtered: ${data.filter_label || 'Previous Data'}` : 'Filter previous data'}
                aria-label="Filter previous data"
                className={`relative inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border transition shadow-2xs ${
                  isFiltered
                    ? 'border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-400 font-bold'
                    : 'border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)]'
                }`}
              >
                <IconFilter size={15} />
                {isFiltered && (
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                  </span>
                )}
              </button>

              {filterOpen && (
                <div className="erp-filter-panel absolute right-0 top-full mt-1.5 w-56 z-50 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-xl ring-1 ring-black/5 dark:ring-white/5 animate-in fade-in zoom-in-95 duration-100">
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-[var(--line)] mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      Previous Data
                    </span>
                    {isFiltered && (
                      <button
                        type="button"
                        onClick={handleResetFilter}
                        className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {filterOptions.map(opt => {
                      const active = filterPeriod === opt.id && !customDate
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectPeriod(opt.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                            active
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-bold'
                              : 'text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {active && <IconCheck size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>

                  <div className="mt-2 pt-2 border-t border-[var(--line)] px-1">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1">
                      Pick Specific Date
                    </label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={e => handleApplyCustomDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs text-[var(--ink)] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:flex sm:items-center sm:gap-2">
              <button
                type="button"
                onClick={() => navigate('/billing/new')}
                className="btn-primary inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition"
              >
                <IconPlus size={15} strokeWidth={2.5} />
                <span>New Bill</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/reports')}
                className="btn-secondary inline-flex min-h-[36px] min-w-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-2xs transition"
              >
                <IconFileText size={14} />
                <span>Reports</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* FILTER ACTIVE BANNER */}
      {isFiltered && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <IconCalendarEvent size={15} className="shrink-0 text-blue-600 dark:text-blue-400" />
            <span>
              Showing previous data: <strong>{data.filter_label || 'Custom Period'}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleResetFilter}
            className="flex items-center gap-1 font-bold text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200 hover:underline"
          >
            <IconX size={13} />
            <span>Reset to Today</span>
          </button>
        </div>
      )}

      {nearExpiryBatches.length > 0 && (
        <section aria-labelledby="near-expiry-title" className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 shadow-sm dark:border-amber-800 dark:bg-amber-950/30 sm:p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"><IconAlertTriangle size={17} /></span>
              <div>
                <h2 id="near-expiry-title" className="text-sm font-bold text-amber-950 dark:text-amber-100">Stock nearing expiry</h2>
                <p className="text-xs text-amber-800 dark:text-amber-300">{nearExpiryBatches.length} in-stock batch{nearExpiryBatches.length === 1 ? '' : 'es'} expire within 30 days</p>
              </div>
            </div>
            <button type="button" onClick={() => navigate('/inventory/stock')} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200">Review stock</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {nearExpiryBatches.slice(0, 6).map(batch => (
              <button key={batch.id} type="button" onClick={() => navigate(`/inventory/stock?search=${encodeURIComponent(batch.sku || batch.product_name)}`)} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-left hover:border-amber-400 dark:border-amber-900/70 dark:bg-slate-900/50">
                <span className="min-w-0"><span className="block truncate text-xs font-semibold text-[var(--ink)]">{batch.product_name}</span><span className="block truncate text-[11px] text-[var(--muted)]">Batch {batch.batch_number} · {formatQuantity(batch.quantity)} {batch.unit}</span></span>
                <span className={`shrink-0 text-right text-[11px] font-bold ${batch.days_left <= 7 ? 'text-rose-700 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'}`}><span className="block">{batch.days_left === 0 ? 'Expires today' : `${batch.days_left} days`}</span><span className="font-medium">{formatDate(batch.expiry_date)}</span></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------
          DASHBOARD BANNER CAROUSEL (Below Name on Top, Above Business Insights)
      -------------------------------------------------------------- */}
      <DashboardBannerCarousel className="my-3" />

      {/* Getting Started First-Use Checklist */}
      <FirstUseChecklist className="my-3" />


      {/* -------------------------------------------------------------
          ERROR BANNER
      -------------------------------------------------------------- */}
      {error && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
          <span className="flex items-center gap-2">
            <IconAlertTriangle size={15} className="shrink-0" />
            {error}
          </span>
          <button onClick={loadDashboard} className="font-bold underline">
            Try again
          </button>
        </div>
      )}

      {/* MOBILE BUSINESS INSIGHTS: ONLY 4 KPI CARDS & SIMPLE DETAILS */}
      <div className="md:hidden space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Business Insights
          </span>
          <button
            type="button"
            onClick={() => setShowMoreMobile(v => !v)}
            className="text-xs font-semibold text-[var(--primary)] underline underline-offset-4 hover:opacity-80 transition"
          >
            {showMoreMobile ? 'Show less' : 'Show more'}
          </button>
        </div>

        {/* ONLY 4 Primary KPI Cards in 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2">
          {primaryKpis.map((kpi, idx) => (
            <div
              key={idx}
              onClick={kpi.onClick}
              className={`flex flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-2xs transition active:scale-[0.99] ${
                kpi.onClick ? 'cursor-pointer hover:border-[var(--line-strong)]' : ''
              }`}
            >
              <p className="text-[10px] font-medium text-[var(--muted)] truncate">{kpi.label}</p>
              <p className="mt-1 text-base font-bold font-mono text-[var(--ink)] tracking-tight truncate">
                {kpi.value}
              </p>
              {kpi.sub && (
                <p className="mt-0.5 text-[9px] text-[var(--muted)] truncate">{kpi.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* When Show More is clicked, show Today at a Glance in simple clean details (not KPI cards) */}
        {showMoreMobile && (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 divide-y divide-[var(--line-subtle)] text-xs shadow-2xs space-y-0">
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                {isFiltered ? `${data.filter_label || 'Period'} at a glance` : 'Today at a glance'}
              </span>
              <span className="text-[11px] text-[var(--muted)] font-mono">
                {data.today_bills || 0} bills {isFiltered ? 'in period' : 'today'}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-[var(--muted)]">Average Bill</span>
              <span className="font-mono font-semibold text-[var(--ink)] tabular-nums">
                {fmtCurrency(data.avg_bill_today)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-[var(--muted)]">{isFiltered ? 'Purchases (Period)' : 'Purchases Today'}</span>
              <span className="font-mono font-semibold text-[var(--ink)] tabular-nums">
                {fmtCurrency(data.today_purchases)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-[var(--muted)]">{isFiltered ? 'Expenses (Period)' : 'Expenses Today'}</span>
              <span className="font-mono font-semibold text-[var(--ink)] tabular-nums">
                {fmtCurrency(data.today_expenses)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-[var(--muted)]">This Month Sales</span>
              <div className="text-right">
                <span className="font-mono font-semibold text-[var(--ink)] tabular-nums">
                  {fmtCurrency(data.month_sales)}
                </span>
                {Number(data.last_month_sales) ? (
                  <span className={`ml-1 text-[10px] ${data.sales_growth >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    ({data.sales_growth > 0 ? '+' : ''}{Number(data.sales_growth || 0).toFixed(1)}%)
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-[var(--muted)]">This Month Profit</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {fmtCurrency(data.month_profit)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[var(--muted)]">Stock Alerts</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/inventory/stock')}
                  className={`text-xs font-semibold ${Number(data.out_of_stock) > 0 ? 'text-red-600 dark:text-red-400 underline' : 'text-[var(--muted)]'}`}
                >
                  {data.out_of_stock || 0} out of stock
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => navigate('/inventory/stock')}
                  className={`text-xs font-semibold ${Number(data.low_stock_count) > 0 ? 'text-amber-600 dark:text-amber-400 underline' : 'text-[var(--muted)]'}`}
                >
                  {data.low_stock_count || 0} low
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DESKTOP BUSINESS SNAPSHOT & AT A GLANCE */}
      <div className="hidden md:block space-y-4">
      {/* BUSINESS SNAPSHOT */}
      <section aria-labelledby="business-snapshot-title" className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
          <h2 id="business-snapshot-title" className="text-sm font-semibold">Business Insights</h2>
          {isFiltered && (
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              Showing: {data.filter_label || 'Previous Data'}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-px bg-[var(--line)] lg:grid-cols-4">
          <button type="button" onClick={() => navigate('/sales/invoices')} className="min-w-0 bg-[var(--surface)] px-3 py-3 text-left transition hover:bg-[var(--surface-hover)] sm:px-4">
            <span className="text-xs font-semibold text-[var(--muted)]">{isFiltered ? (data.filter_label ? `${data.filter_label} Sales` : 'Period Sales') : 'Sales'}</span>
            <p className="mt-1 truncate font-mono text-xl font-extrabold tabular-nums text-[var(--ink)] sm:text-2xl">{fmtCurrency(data.today_sales)}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-sm font-medium text-[var(--muted)]"><span>{data.today_bills || 0} bills</span>{!isFiltered && <><span className="px-0.5">·</span><span className={`inline-flex items-center gap-0.5 ${Number(data.yesterday_sales) ? (salesTrend > 0 ? 'text-emerald-700 dark:text-emerald-400' : salesTrend < 0 ? 'text-red-600 dark:text-red-400' : 'text-[var(--muted)]') : ''}`}>{Number(data.yesterday_sales) && (salesTrend > 0 ? <IconArrowUp size={14} aria-label="Up" /> : salesTrend < 0 ? <IconArrowDown size={14} aria-label="Down" /> : null)}{salesTrendLabel}</span></>}</p>
          </button>
          <button type="button" onClick={() => navigate('/sales/payments')} className="min-w-0 bg-[var(--surface)] px-3 py-3 text-left transition hover:bg-[var(--surface-hover)] sm:px-4">
            <span className="text-xs font-semibold text-[var(--muted)]">Collections</span>
            <p className="mt-1 truncate font-mono text-xl font-extrabold tabular-nums text-[var(--ink)] sm:text-2xl">{fmtCurrency(data.today_collection || data.today_payments_total)}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{isFiltered ? (data.filter_label || 'Period') : 'Today'} <span className="px-1">·</span> Tax {fmtCurrency(data.today_tax)}</p>
          </button>
          <button type="button" onClick={() => navigate('/reports')} className="min-w-0 bg-[var(--surface)] px-3 py-3 text-left transition hover:bg-[var(--surface-hover)] sm:px-4">
            <span className="text-xs font-semibold text-[var(--muted)]">Profit</span>
            <p className={`mt-1 truncate font-mono text-xl font-extrabold tabular-nums sm:text-2xl ${Number(data.today_profit) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{fmtCurrency(data.today_profit)}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-sm font-medium text-[var(--muted)]"><span>Margin {Number(data.profit_margin || 0).toFixed(1)}%</span>{!isFiltered && hasProfitBaseline && <span className={`inline-flex items-center gap-0.5 ${profitDifference >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{profitDifference > 0 ? <IconArrowUp size={14} /> : profitDifference < 0 ? <IconArrowDown size={14} /> : null}{profitTrendLabel}</span>}</p>
          </button>
          <div className="min-w-0 bg-[var(--surface)] px-3 py-3 sm:px-4">
            <span className="text-xs font-semibold text-[var(--muted)]">Receivables & stock</span>
            <button type="button" onClick={() => navigate('/parties/customers?credit_due=1')} className="mt-1 block max-w-full truncate text-left font-mono text-xl font-extrabold tabular-nums text-amber-700 hover:underline dark:text-amber-400 sm:text-2xl">{fmtCurrency(data.pending_credit)} due</button>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-[var(--muted)]"><span>{creditDueCount} customers pending</span><button type="button" onClick={() => navigate('/inventory/stock')} className={Number(data.out_of_stock) ? 'text-red-600 dark:text-red-400' : ''}>{data.out_of_stock || 0} out</button><button type="button" onClick={() => navigate('/inventory/stock')} className={Number(data.low_stock_count) ? 'text-amber-700 dark:text-amber-400' : ''}>{data.low_stock_count || 0} low</button></div>
          </div>
        </div>
      </section>

      {/* TODAY AT A GLANCE */}
      <section aria-label="Summary at a glance" className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 sm:px-4">
        <h2 className="mb-2 text-sm font-semibold text-[var(--ink)]">{isFiltered ? `${data.filter_label || 'Period'} at a glance` : 'Today at a glance'}</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="text-[var(--muted)]">Bills <strong className="font-mono tabular-nums text-[var(--ink)]">{data.today_bills || 0}</strong></span><span className="hidden text-[var(--line-strong)] sm:inline">|</span>
        <span className="text-[var(--muted)]">Avg bill <strong className="font-mono tabular-nums text-[var(--ink)]">{fmtCurrency(data.avg_bill_today)}</strong></span><span className="hidden text-[var(--line-strong)] sm:inline">|</span>
        <span className="text-[var(--muted)]">{isFiltered ? 'Purchases' : 'Purchases'} <strong className="font-mono tabular-nums text-[var(--ink)]">{fmtCurrency(data.today_purchases)}</strong></span><span className="hidden text-[var(--line-strong)] sm:inline">|</span>
        <span className="text-[var(--muted)]">{isFiltered ? 'Expenses' : 'Expenses'} <strong className="font-mono tabular-nums text-[var(--ink)]">{fmtCurrency(data.today_expenses)}</strong></span><span className="hidden text-[var(--line-strong)] sm:inline">|</span>
        <span className="text-[var(--muted)]">Month sales <strong className="font-mono tabular-nums text-[var(--ink)]">{fmtCurrency(data.month_sales)}</strong> <span className="text-xs">{Number(data.last_month_sales) ? `${data.sales_growth > 0 ? '+' : ''}${Number(data.sales_growth || 0).toFixed(1)}% vs prior month` : ''}</span></span><span className="hidden text-[var(--line-strong)] sm:inline">|</span>
        <span className="text-[var(--muted)]">Month profit <strong className="font-mono tabular-nums text-[var(--ink)]">{fmtCurrency(data.month_profit)}</strong> <span className="text-xs">{Number(data.last_month_profit) ? `${percentChange(data.month_profit, data.last_month_profit) > 0 ? '+' : ''}${percentChange(data.month_profit, data.last_month_profit)}% vs prior month` : ''}</span></span>
        </div>
      </section>
      </div>

      {/* ATTENTION REQUIRED — HIGH IMPORTANCE COLOR & CONTRAST */}
      <section className="rounded-xl border border-amber-300/80 bg-amber-50/20 dark:border-amber-700/60 dark:bg-amber-950/15 p-3.5 sm:p-4 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:bg-amber-400/20 dark:text-amber-400">
              <IconAlertTriangle size={16} strokeWidth={2.4} />
            </span>
            <h2 className="text-sm sm:text-base font-bold text-[var(--ink)]">
              Attention Required
            </h2>
          </div>
          {attentionItems.length > 0 ? (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
              {attentionItems.length} Urgent Action{attentionItems.length === 1 ? '' : 's'}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              All clear
            </span>
          )}
        </div>

        {attentionItems.length ? (
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {attentionItems.map(item => {
              const isHigh = item.key === 'credit' || item.key === 'out-of-stock'
              return (
                <div
                  key={item.key}
                  className={`min-w-0 rounded-xl border p-3 transition-all ${
                    isHigh
                      ? 'border-rose-200 bg-rose-50/50 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30 dark:hover:bg-rose-950/50'
                      : 'border-amber-200 bg-amber-50/50 hover:bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 dark:hover:bg-amber-950/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold capitalize text-[var(--ink)]">
                      {item.title}
                    </span>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-xs font-extrabold ${
                        isHigh
                          ? 'bg-rose-600 text-white dark:bg-rose-500'
                          : 'bg-amber-600 text-white dark:bg-amber-500'
                      }`}
                    >
                      {item.count}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-[var(--muted)] font-medium">
                      {item.detail}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(item.route)}
                      className={`shrink-0 text-xs font-bold px-2 py-1 rounded-md transition shadow-2xs ${
                        isHigh
                          ? 'bg-rose-600/10 text-rose-700 hover:bg-rose-600/20 dark:text-rose-300'
                          : 'bg-amber-600/10 text-amber-800 hover:bg-amber-600/20 dark:text-amber-300'
                      }`}
                    >
                      {item.action} &rarr;
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="mt-2.5 text-xs text-[var(--muted)]">No operational issues require attention.</p>
        )}
      </section>

      {/* -------------------------------------------------------------
          QUICK ACTIONS BAR (Compact & Small Buttons After KPI Cards)
      -------------------------------------------------------------- */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
        <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
          
          <span>Quick Actions</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 py-0.5 min-[420px]:grid-cols-3 sm:flex sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={() => navigate('/billing/new')}
            className="hidden sm:inline-flex h-8 shrink-0 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-[#1E3A5F] px-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#162b47] active:scale-95 dark:bg-sky-600 dark:hover:bg-sky-500"
          >
            <IconPlus size={13} strokeWidth={2.5} />
            <span>New Bill</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/billing/drafts')}
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-medium text-[var(--ink)] shadow-2xs transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-95 sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
          >
            <IconClockHour3 size={13} className="text-amber-600 dark:text-amber-400" />
            <span>Parked Bills</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/sales/payments')}
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-medium text-[var(--ink)] shadow-2xs transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-95 sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
          >
            <IconCreditCard size={13} className="text-emerald-600 dark:text-emerald-400" />
            <span>Payments</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/sales/invoices')}
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-medium text-[var(--ink)] shadow-2xs transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-95 sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
          >
            <IconFileText size={13} className="text-slate-600 dark:text-slate-400" />
            <span>All Bills</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/inventory/stock')}
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-medium text-[var(--ink)] shadow-2xs transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-95 sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
          >
            <IconPackage size={13} className="text-purple-600 dark:text-purple-400" />
            <span>Stock</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/purchases')}
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-medium text-[var(--ink)] shadow-2xs transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-95 sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
          >
            <IconChartBar size={13} className="text-teal-600 dark:text-teal-400" />
            <span>Purchases</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--surface-hover)] sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
          >
            <IconFileText size={13} />
            <span>Reports</span>
          </button>
          </div>
      </section>

      {/* -------------------------------------------------------------
          SECTION 3: CHARTS (Sales Daily Trend & Payment Breakdown)
      -------------------------------------------------------------- */}
      <section aria-labelledby="sales-performance-title" className="space-y-2">
        <h2 id="sales-performance-title" className="text-sm font-semibold">Sales performance</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Overview Chart (2 cols) */}
        <section className="lg:col-span-2 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex flex-col gap-1 border-b border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">
              Sales — last 7 days
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                7-day total:{' '}
                <span className="font-mono font-bold text-[var(--primary)]">
                  {fmtCurrency(totalSales)}
                </span>
              </p>
            </div>
            <span className="text-[11px] font-semibold text-[var(--muted)] sm:text-right">
              {salesTrendLabel}
            </span>
          </div>

          <div className="h-52 p-3 sm:h-56 sm:p-4">
            {salesData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={salesData}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="primarySalesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1E3A5F" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#1E3A5F" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--muted)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={d => {
                      if (!d) return ''
                      const parts = d.split('-')
                      return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--muted)' }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                    tickFormatter={v => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`)}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="#1E3A5F"
                    strokeWidth={2}
                    fill="url(#primarySalesFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                icon={IconChartBar}
                text="Sales data will appear here once invoices are created."
              />
            )}
          </div>
        </section>

        {/* Payment Methods (1 col) */}
        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] flex flex-col">
          <div className="border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2.5">
            <h2 className="text-sm font-semibold text-[var(--ink)]">
              Today’s collection
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              Payment method breakdown
            </p>
          </div>

          <div className="flex-1 p-3 sm:p-4">
            {paymentTotal > 0 || Number(data.today_collection) > 0 ? <>
              <div className="divide-y divide-[var(--line-subtle)]">
                {paymentMethodRows.map((payment, index) => <div key={`${payment.method}-${index}`} className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0">
                  <span className="font-medium text-[var(--ink-secondary)]">{String(payment.method || 'other').replace(/_/g, ' ').toUpperCase()}</span>
                  <span className="font-mono font-semibold tabular-nums text-[var(--ink)]">{fmtCurrency(payment.total)}</span>
                </div>)}
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-[var(--line)] pt-2 text-sm font-semibold"><span>Total collected</span><span className="font-mono tabular-nums">{fmtCurrency(data.today_collection || paymentTotal)}</span></div>
            </> : <p className="py-5 text-center text-xs text-[var(--muted)]">No payments recorded today.</p>}
          </div>
        </section>
      </div>
      </section>

      {/* -------------------------------------------------------------
          SECTION 4: RECENT TRANSACTIONS TABLE
      -------------------------------------------------------------- */}
      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2.5">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ink)]">
              Recent Transactions
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              Latest transactions with payment status
            </p>
          </div>
          <button
            onClick={() => navigate('/sales/invoices')}
            className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            <span>All Invoices</span>
            <IconArrowUpRight size={13} />
          </button>
        </div>

        {recentBills.length ? (
          <>
            {/* Mobile Card List */}
            <div className="divide-y divide-[var(--line-subtle)] lg:hidden">
              {recentBills.slice(0, 8).map(bill => (
                <div
                  key={bill.id}
                  onClick={() => navigate(`/invoice/${bill.id}`)}
                  className="flex items-center justify-between p-3 transition active:bg-[var(--surface-elevated)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#1E3A5F] dark:text-slate-200">
                        {bill.invoice_number}
                      </span>
                      <Badge status={bill.payment_status || bill.status} />
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold text-[var(--ink)]">
                      {bill.customer_name || 'Walk-in Customer'}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-[var(--muted)]">
                      {formatDate(bill.created_at)}
                    </p>
                  </div>

                  <div className="ml-3 shrink-0 text-right">
                    <p className="font-mono text-sm font-bold text-[var(--ink)]">
                      {fmtCurrency(bill.grand_total)}
                    </p>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        navigate(`/invoice/${bill.id}`)
                      }}
                      className="mt-1 inline-flex min-h-[32px] items-center gap-1 rounded border border-[var(--line)] bg-[var(--surface-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink-secondary)]"
                    >
                      <IconEye size={11} />
                      <span>View</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice #</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th className="text-right num-col">Grand Total</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBills.slice(0, 8).map(bill => (
                    <tr
                      key={bill.id}
                      className={getInvoiceRowClass(bill.payment_status || bill.status)}
                    >
                      <td>
                        <button
                          onClick={() => navigate(`/invoice/${bill.id}`)}
                          className="font-mono font-bold text-[var(--primary)] hover:underline"
                        >
                          {bill.invoice_number}
                        </button>
                      </td>
                      <td>
                        <span className="font-medium text-[var(--ink)]">
                          {bill.customer_name || 'Walk-in Customer'}
                        </span>
                      </td>
                      <td className="text-xs text-[var(--muted)] font-mono">
                        {formatDate(bill.created_at)}
                      </td>
                      <td className="text-right num-col font-bold text-[var(--ink)] font-mono">
                        {fmtCurrency(bill.grand_total)}
                      </td>
                      <td>
                        <Badge status={bill.payment_status || bill.status} />
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => navigate(`/invoice/${bill.id}`)}
                          className="btn-secondary btn-sm flex items-center gap-1 text-xs inline-flex"
                          title="View Invoice"
                        >
                          <IconEye size={12} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <EmptyState
            icon={IconFileText}
            text="No invoices have been generated yet."
          />
        )}
      </section>

      {/* -------------------------------------------------------------
          SECTION 5: TOP SELLING PRODUCTS & LOW-STOCK ALERTS (2-Column Grid)
      -------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Selling Products */}
        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2.5">
            <div>
              <h2 className="text-sm font-semibold text-[var(--ink)]">
                Top Selling Products
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                Highest revenue generating items
              </p>
            </div>
            <button
              onClick={() => navigate('/reports')}
              className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
            >
              <span>Sales Report</span>
              <IconArrowUpRight size={13} />
            </button>
          </div>

          {topProducts.length ? (
            <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th className="text-right num-col">Qty Sold</th>
                    <th className="text-right num-col">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.slice(0, 6).map((prod, idx) => (
                    <tr key={idx}>
                      <td className="w-8 font-mono text-xs font-bold text-[var(--muted)]">
                        {idx + 1}
                      </td>
                      <td className="font-semibold text-[var(--ink)]">
                        <span className="truncate block max-w-[200px]" title={prod.product_name}>
                          {prod.product_name}
                        </span>
                      </td>
                      <td className="text-right num-col font-mono text-xs text-[var(--ink-secondary)]">
                        {formatQuantity(prod.total_qty)} units
                      </td>
                      <td className="text-right num-col font-mono font-bold text-[var(--ink)]">
                        {fmtCurrency(prod.total_revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-[var(--line-subtle)] lg:hidden">
              {topProducts.slice(0, 6).map((prod, idx) => (
                <div key={idx} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-elevated)] font-mono text-xs font-bold text-[var(--muted)]">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">{prod.product_name}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{formatQuantity(prod.total_qty)} units sold</p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">{fmtCurrency(prod.total_revenue)}</span>
                </div>
              ))}
            </div>
            </>
          ) : (
            <EmptyState
              icon={IconPackage}
              text="No product sales recorded yet."
            />
          )}
        </section>

        {/* Low-Stock Inventory Alerts */}
        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2.5">
            <div>
              <h2 className="text-sm font-semibold text-[var(--ink)]">
                Inventory alerts
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                {data.out_of_stock || 0} out of stock · {data.low_stock_count || 0} below threshold
              </p>
            </div>
            <button
              onClick={() => navigate('/inventory/stock')}
              className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
            >
              <span>Manage Stock</span>
              <IconArrowUpRight size={13} />
            </button>
          </div>

          {lowStock.length ? (
            <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th className="text-right num-col">Stock</th>
                    <th className="text-right num-col">Min</th>
                    <th className="text-center">Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.slice(0, 6).map(prod => (
                    <tr key={prod.id} className="row-low-stock">
                      <td className="font-semibold text-[var(--ink)]">
                        <span className="truncate block max-w-[160px]" title={prod.name}>
                          {prod.name}
                        </span>
                      </td>
                      <td
                        className={`text-right num-col font-bold font-mono ${
                          Number(prod.current_stock) <= 0
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {formatQuantity(prod.current_stock)}
                      </td>
                      <td className="text-right num-col text-xs text-[var(--muted)] font-mono">
                        {formatQuantity(prod.minimum_stock)}
                      </td>
                      <td className="text-center">
                        <Badge
                          status={
                            Number(prod.current_stock) <= 0
                              ? 'out_of_stock'
                              : 'low_stock'
                          }
                        />
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => navigate('/inventory/products')}
                          className="btn-secondary btn-sm text-xs"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-[var(--line-subtle)] lg:hidden">
              {lowStock.slice(0, 6).map(prod => (
                <div key={prod.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">{prod.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">Minimum {formatQuantity(prod.minimum_stock)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge status={Number(prod.current_stock) <= 0 ? 'out_of_stock' : 'low_stock'} />
                    <span className={`font-mono text-xs font-bold tabular-nums ${Number(prod.current_stock) <= 0 ? 'text-red-600' : 'text-amber-600'}`}>{formatQuantity(prod.current_stock)} in stock</span>
                  </div>
                  <button type="button" onClick={() => navigate('/inventory/products')} className="min-h-9 shrink-0 rounded-md border border-[var(--line)] px-2 text-xs font-medium">Adjust</button>
                </div>
              ))}
            </div>
            </>
          ) : (
            <EmptyState
              icon={IconCircleCheck}
              text="All inventory items are sufficiently stocked."
            />
          )}
        </section>
      </div>

      {/* -------------------------------------------------------------
          BOTTOM HELPFUL RESOURCES: Clean Video Guides & Pro Tip Strip
      -------------------------------------------------------------- */}
      <DashboardVideoGuides />

      <div className="mt-4">
        <InformationalBanner
          tip="Pro Tip: Press F2 anytime on the billing screen to immediately search products, or F4 to complete the transaction."
          actionText="Try Billing"
          onActionClick={() => navigate('/billing/new')}
          className="my-0"
        />
      </div>

      {/* Connected Architecture & Ecosystem Modal */}
      <EcosystemVisualModal
        isOpen={ecosystemModalOpen}
        onClose={() => setEcosystemModalOpen(false)}
      />

      {/* Mobile Floating Action Buttons: New Bill & Reports */}
      <div className="fixed right-4 bottom-20 z-40 flex flex-col items-end gap-2 sm:hidden print:hidden">
        <button
          type="button"
          onClick={() => navigate('/reports')}
          className="flex h-10 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] px-3.5 text-xs font-semibold text-[var(--ink)] shadow-md hover:bg-[var(--surface-hover)] active:scale-95 transition-transform backdrop-blur-md"
          aria-label="Reports"
        >
          <IconFileText size={15} />
          <span>Reports</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/billing/new')}
          className="flex h-12 items-center gap-1.5 rounded-full bg-[var(--primary)] px-4.5 text-xs font-bold text-white shadow-lg shadow-[var(--primary)]/30 active:scale-95 transition-transform"
          aria-label="New Bill"
        >
          <IconPlus size={18} strokeWidth={2.5} />
          <span>New Bill</span>
        </button>
      </div>
      
      
    </div>
  )
}
