import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  Package,
  Plus,
  RefreshCw,
  Workflow,
} from 'lucide-react'
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
import { useShop } from '../components/Layout'
import DashboardBannerCarousel from './DashboardBannerCarousel'
import FirstUseChecklist from '../components/FirstUseChecklist'
import {
  DashboardVideoGuides,
  InformationalBanner,
  EcosystemVisualModal,
} from '../components/visual-content'

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
}

const fmtCurrency = value =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`

const percentChange = (current, previous) => {
  if (!Number(previous)) return 0
  return Math.round(
    ((Number(current) - Number(previous)) / Number(previous)) * 100
  * 10
  ) / 10
}

function formatDateShort(dateString) {
  if (!dateString) return '—'
  const d = new Date(dateString)
  if (isNaN(d.getTime())) return '—'
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear()).slice(-2)
  return `${day}/${month}/${year}`
}

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

  const [data, setData] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [ecosystemModalOpen, setEcosystemModalOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const loadDashboard = useCallback(async () => {
    try {
      setRefreshing(true)
      setError('')
      const response = await api.get('/dashboard/')
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
  }, [])

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

  if (loading) {
    return <Spinner label="Loading dashboard" />
  }

  return (
    <div className="dashboard-page min-w-0 space-y-4 pb-6">
      
      {/* -------------------------------------------------------------
          TOP BAR: Store Name, Live IST Clock, Action Controls
      -------------------------------------------------------------- */}
      <header className="dashboard-header rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 sm:px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
           

            <h1 className="truncate text-lg sm:text-xl font-bold tracking-tight text-[var(--ink)]">
              {shopName || 'Dreamwithtech ERP'}
            </h1>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <span className="inline-flex items-center gap-1 font-medium">
                <CalendarDays size={13} className="text-[var(--muted)] shrink-0" />
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
                <Clock3 size={13} className="text-[#1E3A5F] dark:text-sky-400 shrink-0" />
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

          <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <button
              type="button"
              onClick={() => navigate('/billing/new')}
              className="btn-primary col-span-2 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition sm:col-span-1"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>New Bill</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="btn-secondary inline-flex min-h-[40px] min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold shadow-2xs transition sm:px-3.5"
            >
              <FileText size={14} />
              <span>Reports</span>
            </button>
             <button
              type="button"
              onClick={loadDashboard}
              disabled={refreshing}
              className="btn-secondary inline-flex min-h-[40px] min-w-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold shadow-2xs transition sm:px-3.5"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

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
            <AlertTriangle size={15} className="shrink-0" />
            {error}
          </span>
          <button onClick={loadDashboard} className="font-bold underline">
            Try again
          </button>
        </div>
      )}

      {/* BUSINESS SNAPSHOT */}
      <section aria-labelledby="business-snapshot-title" className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <h2 id="business-snapshot-title" className="border-b border-[var(--line)] px-4 py-2.5 text-sm font-semibold">Business Insights</h2>
        <div className="grid grid-cols-2 gap-px bg-[var(--line)] lg:grid-cols-4">
          <button type="button" onClick={() => navigate('/sales/invoices')} className="min-w-0 bg-[var(--surface)] px-3 py-3 text-left transition hover:bg-[var(--surface-hover)] sm:px-4">
            <span className="text-xs font-semibold text-[var(--muted)]">Sales</span>
            <p className="mt-1 truncate font-mono text-xl font-extrabold tabular-nums text-[var(--ink)] sm:text-2xl">{fmtCurrency(data.today_sales)}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-sm font-medium text-[var(--muted)]"><span>{data.today_bills || 0} bills</span><span className="px-0.5">·</span><span className={`inline-flex items-center gap-0.5 ${Number(data.yesterday_sales) ? (salesTrend > 0 ? 'text-emerald-700 dark:text-emerald-400' : salesTrend < 0 ? 'text-red-600 dark:text-red-400' : 'text-[var(--muted)]') : ''}`}>{Number(data.yesterday_sales) && (salesTrend > 0 ? <ArrowUp size={14} aria-label="Up" /> : salesTrend < 0 ? <ArrowDown size={14} aria-label="Down" /> : null)}{salesTrendLabel}</span></p>
          </button>
          <button type="button" onClick={() => navigate('/sales/payments')} className="min-w-0 bg-[var(--surface)] px-3 py-3 text-left transition hover:bg-[var(--surface-hover)] sm:px-4">
            <span className="text-xs font-semibold text-[var(--muted)]">Collections</span>
            <p className="mt-1 truncate font-mono text-xl font-extrabold tabular-nums text-[var(--ink)] sm:text-2xl">{fmtCurrency(data.today_collection || data.today_payments_total)}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Today <span className="px-1">·</span> Tax {fmtCurrency(data.today_tax)}</p>
          </button>
          <button type="button" onClick={() => navigate('/reports')} className="min-w-0 bg-[var(--surface)] px-3 py-3 text-left transition hover:bg-[var(--surface-hover)] sm:px-4">
            <span className="text-xs font-semibold text-[var(--muted)]">Profit</span>
            <p className={`mt-1 truncate font-mono text-xl font-extrabold tabular-nums sm:text-2xl ${Number(data.today_profit) >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{fmtCurrency(data.today_profit)}</p>
            <p className="mt-1 flex flex-wrap items-center gap-1 text-sm font-medium text-[var(--muted)]"><span>Margin {Number(data.profit_margin || 0).toFixed(1)}%</span>{hasProfitBaseline && <span className={`inline-flex items-center gap-0.5 ${profitDifference >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{profitDifference > 0 ? <ArrowUp size={14} /> : profitDifference < 0 ? <ArrowDown size={14} /> : null}{profitTrendLabel}</span>}</p>
          </button>
          <div className="min-w-0 bg-[var(--surface)] px-3 py-3 sm:px-4">
            <span className="text-xs font-semibold text-[var(--muted)]">Receivables & stock</span>
            <button type="button" onClick={() => navigate('/parties/customers?credit_due=1')} className="mt-1 block max-w-full truncate text-left font-mono text-xl font-extrabold tabular-nums text-amber-700 hover:underline dark:text-amber-400 sm:text-2xl">{fmtCurrency(data.pending_credit)} due</button>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-[var(--muted)]"><span>{creditDueCount} customers pending</span><button type="button" onClick={() => navigate('/inventory/stock')} className={Number(data.out_of_stock) ? 'text-red-600 dark:text-red-400' : ''}>{data.out_of_stock || 0} out</button><button type="button" onClick={() => navigate('/inventory/stock')} className={Number(data.low_stock_count) ? 'text-amber-700 dark:text-amber-400' : ''}>{data.low_stock_count || 0} low</button></div>
          </div>
        </div>
      </section>

      {/* TODAY AT A GLANCE */}
      <section aria-label="Today at a glance" className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 sm:px-4">
        <h2 className="mb-2 text-sm font-semibold text-[var(--ink)]">Today at a glance</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="text-[var(--muted)]">Bills <strong className="font-mono tabular-nums text-[var(--ink)]">{data.today_bills || 0}</strong></span><span className="hidden text-[var(--line-strong)] sm:inline">|</span>
        <span className="text-[var(--muted)]">Avg bill <strong className="font-mono tabular-nums text-[var(--ink)]">{fmtCurrency(data.avg_bill_today)}</strong></span><span className="hidden text-[var(--line-strong)] sm:inline">|</span>
        <span className="text-[var(--muted)]">Purchases <strong className="font-mono tabular-nums text-[var(--ink)]">{fmtCurrency(data.today_purchases)}</strong></span><span className="hidden text-[var(--line-strong)] sm:inline">|</span>
        <span className="text-[var(--muted)]">Expenses <strong className="font-mono tabular-nums text-[var(--ink)]">{fmtCurrency(data.today_expenses)}</strong></span><span className="hidden text-[var(--line-strong)] sm:inline">|</span>
        <span className="text-[var(--muted)]">Month sales <strong className="font-mono tabular-nums text-[var(--ink)]">{fmtCurrency(data.month_sales)}</strong> <span className="text-xs">{Number(data.last_month_sales) ? `${data.sales_growth > 0 ? '+' : ''}${Number(data.sales_growth || 0).toFixed(1)}% vs prior month` : ''}</span></span><span className="hidden text-[var(--line-strong)] sm:inline">|</span>
        <span className="text-[var(--muted)]">Month profit <strong className="font-mono tabular-nums text-[var(--ink)]">{fmtCurrency(data.month_profit)}</strong> <span className="text-xs">{Number(data.last_month_profit) ? `${percentChange(data.month_profit, data.last_month_profit) > 0 ? '+' : ''}${percentChange(data.month_profit, data.last_month_profit)}% vs prior month` : ''}</span></span>
        </div>
      </section>

      {/* ATTENTION REQUIRED */}
  
      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--ink)]">Attention Required</h2>
          <span className="shrink-0 rounded-full bg-[var(--surface-elevated)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">{attentionItems.length} items</span>
        </div>
        {attentionItems.length ? (
          <div className="mt-3 grid grid-cols-1 gap-2 border-t border-[var(--line-subtle)] pt-3 sm:grid-cols-2 lg:grid-cols-3">
            {attentionItems.map(item => (
              <div key={item.key} className="min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold capitalize text-[var(--ink)]">{item.title}</span>
                  <span className="shrink-0 rounded bg-[var(--surface)] px-1.5 py-0.5 font-mono text-xs font-bold text-[var(--ink)]">{item.count}</span>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs text-[var(--muted)]">{item.detail}</span>
                  <button type="button" onClick={() => navigate(item.route)} className="shrink-0 text-xs font-semibold text-[var(--primary)] hover:underline">{item.action}</button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="mt-2 border-t border-[var(--line-subtle)] pt-3 text-sm text-[var(--muted)]">No operational issues require attention.</p>}
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
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg bg-[#1E3A5F] px-1.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#162b47] active:scale-95 dark:bg-sky-600 dark:hover:bg-sky-500 sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>New Bill</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/billing/drafts')}
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-medium text-[var(--ink)] shadow-2xs transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-95 sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
          >
            <Clock3 size={13} className="text-amber-600 dark:text-amber-400" />
            <span>Parked Bills</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/sales/payments')}
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-medium text-[var(--ink)] shadow-2xs transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-95 sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
          >
            <CreditCard size={13} className="text-emerald-600 dark:text-emerald-400" />
            <span>Payments</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/sales/invoices')}
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-medium text-[var(--ink)] shadow-2xs transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-95 sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
          >
            <FileText size={13} className="text-slate-600 dark:text-slate-400" />
            <span>All Bills</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/inventory/stock')}
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-medium text-[var(--ink)] shadow-2xs transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-95 sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
          >
            <Package size={13} className="text-purple-600 dark:text-purple-400" />
            <span>Stock</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/purchases')}
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-medium text-[var(--ink)] shadow-2xs transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-95 sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
          >
            <BarChart3 size={13} className="text-teal-600 dark:text-teal-400" />
            <span>Purchases</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--surface-hover)] sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
          >
            <FileText size={13} />
            <span>Reports</span>
          </button>

          <button
            type="button"
            onClick={() => setEcosystemModalOpen(true)}
            className="inline-flex h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-medium text-[var(--ink)] shadow-2xs transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-95 sm:h-8 sm:shrink-0 sm:gap-1.5 sm:px-2.5"
            title="View Connected Enterprise Ecosystem Architecture"
          >
            <Workflow size={13} className="text-[#0057B8] dark:text-sky-400" />
            <span>Ecosystem</span>
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
                icon={BarChart3}
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
            <ArrowUpRight size={13} />
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
                      {formatDateShort(bill.created_at)}
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
                      <Eye size={11} />
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
                        {formatDateShort(bill.created_at)}
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
                          <Eye size={12} />
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
            icon={FileText}
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
              <ArrowUpRight size={13} />
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
                        {prod.total_qty} units
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
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{prod.total_qty} units sold</p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">{fmtCurrency(prod.total_revenue)}</span>
                </div>
              ))}
            </div>
            </>
          ) : (
            <EmptyState
              icon={Package}
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
              <ArrowUpRight size={13} />
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
                        {prod.current_stock}
                      </td>
                      <td className="text-right num-col text-xs text-[var(--muted)] font-mono">
                        {prod.minimum_stock}
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
                    <p className="mt-0.5 text-xs text-[var(--muted)]">Minimum {prod.minimum_stock}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge status={Number(prod.current_stock) <= 0 ? 'out_of_stock' : 'low_stock'} />
                    <span className={`font-mono text-xs font-bold tabular-nums ${Number(prod.current_stock) <= 0 ? 'text-red-600' : 'text-amber-600'}`}>{prod.current_stock} in stock</span>
                  </div>
                  <button type="button" onClick={() => navigate('/inventory/products')} className="min-h-9 shrink-0 rounded-md border border-[var(--line)] px-2 text-xs font-medium">Adjust</button>
                </div>
              ))}
            </div>
            </>
          ) : (
            <EmptyState
              icon={CheckCircle2}
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
    </div>
  )
}
