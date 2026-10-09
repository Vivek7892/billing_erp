import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  CreditCard,
  Eye,
  FileText,
  Package,
  Plus,
  RefreshCw,
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
import { Badge } from '../components/UI'
import { useShop } from '../components/Layout'

const EMPTY = {
  today_sales: 0,
  yesterday_sales: 0,
  today_collection: 0,
  today_profit: 0,
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

  const summaryRows = useMemo(
    () => [
      {
        metric: 'Gross Sales',
        today: fmtCurrency(data.today_sales),
        month: fmtCurrency(data.month_sales),
        prevMonth: fmtCurrency(data.last_month_sales),
      },
      {
        metric: 'Collections / Received',
        today: fmtCurrency(data.today_collection || data.today_payments_total),
        month: fmtCurrency(data.month_payments_total),
        prevMonth: fmtCurrency(data.last_month_payments_total),
      },
      {
        metric: 'Gross Profit',
        today: fmtCurrency(data.today_profit),
        month: fmtCurrency(data.month_profit),
        prevMonth: fmtCurrency(data.last_month_profit),
      },
      {
        metric: 'Purchases (Inward)',
        today: fmtCurrency(data.today_purchases),
        month: fmtCurrency(data.month_purchases),
        prevMonth: fmtCurrency(data.last_month_purchases),
      },
      {
        metric: 'Operating Expenses',
        today: fmtCurrency(data.today_expenses),
        month: fmtCurrency(data.month_expenses),
        prevMonth: fmtCurrency(data.last_month_expenses),
      },
      {
        metric: 'Invoices Generated',
        today: `${data.today_bills || 0} bills`,
        month: `${data.month_bills || 0} bills`,
        prevMonth: '—',
      },
    ],
    [data]
  )

  if (loading) {
    return (
      <div className="min-w-0 space-y-4 pb-6 animate-pulse">
        <div className="h-16 rounded-lg bg-[var(--surface-elevated)] border border-[var(--line)]" />
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-[var(--surface-elevated)] border border-[var(--line)]" />
          ))}
        </div>
        <div className="h-48 rounded-lg bg-[var(--surface-elevated)] border border-[var(--line)]" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-64 rounded-lg bg-[var(--surface-elevated)] border border-[var(--line)]" />
          <div className="h-64 rounded-lg bg-[var(--surface-elevated)] border border-[var(--line)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page min-w-0 space-y-6 pb-6">
      {/* -------------------------------------------------------------
          TOP BAR: Store Name, Current Date, Action Controls
      -------------------------------------------------------------- */}
      <header className="dashboard-header border-b border-[var(--line)] bg-[var(--surface)] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            
            <h1 className="mt-0.5 truncate text-lg sm:text-xl font-bold text-[var(--ink)]">
              {shopName || 'Dreamwithtech ERP'}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)]">
              <Clock3 size={13} className="shrink-0" />
              <span>
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigate('/billing/new')}
              className="btn-primary h-9 text-xs px-4"
            >
              <Plus size={15} />
              <span>New Bill</span>
            </button>
            <button
              onClick={loadDashboard}
              disabled={refreshing}
              className="btn-secondary h-9 text-xs px-3"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => navigate('/reports')}
              className="btn-secondary h-9 text-xs px-3"
            >
              <FileText size={14} />
              <span>Reports</span>
            </button>
          </div>
        </div>
      </header>

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

      {/* -------------------------------------------------------------
          SECTION 1: ERP METRICS SUMMARY (Table-Based KPI Strip)
      -------------------------------------------------------------- */}
      <section className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-none">
        {/* Row 1: Today's Metrics */}
        <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          <div
            onClick={() => navigate('/sales/invoices')}
            className="p-3 sm:p-3.5 cursor-pointer hover:bg-[var(--surface-elevated)] transition"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Total Sales
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--ink)]">
              {fmtCurrency(data.today_sales)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              {data.today_bills || 0} orders today {salesTrend !== 0 && `(${salesTrend >= 0 ? '+' : ''}${salesTrend}%)`}
            </p>
          </div>

          <div
            onClick={() => navigate('/sales/payments')}
            className="p-3 sm:p-3.5 cursor-pointer hover:bg-[var(--surface-elevated)] transition"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Collected
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-teal-600 dark:text-teal-400">
              {fmtCurrency(data.today_collection || data.today_payments_total)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              Tax: {fmtCurrency(data.today_tax)}
            </p>
          </div>

          <div
            onClick={() => navigate('/reports')}
            className="p-3 sm:p-3.5 cursor-pointer hover:bg-[var(--surface-elevated)] transition"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Net Profit
            </span>
            <p
              className={`mt-1 font-mono text-lg font-bold ${
                data.today_profit >= 0
                  ? 'text-teal-600 dark:text-teal-400'
                  : 'text-red-500'
              }`}
            >
              {fmtCurrency(data.today_profit)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              Margin {Number(data.profit_margin || 0).toFixed(1)}%
            </p>
          </div>

          <div
            onClick={() => navigate('/sales/invoices')}
            className="p-3 sm:p-3.5 cursor-pointer hover:bg-[var(--surface-elevated)] transition"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Average Bill
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-[#1E3A5F] dark:text-slate-200">
              {fmtCurrency(data.avg_bill_today)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              Average per sale
            </p>
          </div>
        </div>

        {/* Row 2: Monthly Position, Receivables & Supply */}
        <div className="grid grid-cols-2 divide-y divide-[var(--line)] border-t border-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          <div
            onClick={() => navigate('/sales/invoices')}
            className="p-3 sm:p-3.5 cursor-pointer hover:bg-[var(--surface-elevated)] transition"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              This Month Sales
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--ink)]">
              {fmtCurrency(data.month_sales)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              {data.month_bills || 0} bills this month
            </p>
          </div>

          <div
            onClick={() => navigate('/parties/customers?credit_due=1')}
            className="p-3 sm:p-3.5 cursor-pointer hover:bg-[var(--surface-elevated)] transition"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Outstanding Dues
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-amber-700 dark:text-amber-400">
              {fmtCurrency(data.pending_credit)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              {creditDueCount} customer{creditDueCount === 1 ? '' : 's'} pending
            </p>
          </div>

          <div
            onClick={() => navigate('/inventory/stock')}
            className="p-3 sm:p-3.5 cursor-pointer hover:bg-[var(--surface-elevated)] transition"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Stock Alerts
            </span>
            <p
              className={`mt-1 font-mono text-lg font-bold ${
                data.out_of_stock > 0
                  ? 'text-red-500'
                  : data.low_stock_count > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-teal-600 dark:text-teal-400'
              }`}
            >
              {data.out_of_stock || 0} Out · {data.low_stock_count || 0} Low
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              {Number(data.total_products || data.product_count || 0)} total products
            </p>
          </div>

          <div
            onClick={() => navigate('/purchases')}
            className="p-3 sm:p-3.5 cursor-pointer hover:bg-[var(--surface-elevated)] transition"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Purchases
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--ink)]">
              {fmtCurrency(data.today_purchases)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              Month: {fmtCurrency(data.month_purchases)}
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          SECTION 2: SUMMARY TABLE (Metric | Today | This Month | Previous Month)
      -------------------------------------------------------------- */}
      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2.5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Financial & Operational Summary
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              Multi-period comparison across key ERP performance metrics
            </p>
          </div>
          <button
            onClick={() => navigate('/reports')}
            className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            <span>Detailed Reports</span>
            <ArrowUpRight size={13} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="table table-compact">
            <thead>
              <tr>
                <th className="w-1/3">Financial Metric</th>
                <th className="num-col">Today</th>
                <th className="num-col">This Month</th>
                <th className="num-col">Previous Month</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row, idx) => (
                <tr key={idx}>
                  <td className="font-semibold text-[var(--ink)]">
                    {row.metric}
                  </td>
                  <td className="num-col font-bold font-mono text-[var(--ink)]">
                    {row.today}
                  </td>
                  <td className="num-col font-mono text-[var(--ink-secondary)]">
                    {row.month}
                  </td>
                  <td className="num-col font-mono text-[var(--muted)]">
                    {row.prevMonth}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* -------------------------------------------------------------
          SECTION 3: CHARTS (Sales Daily Trend & Payment Breakdown)
      -------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Overview Chart (2 cols) */}
        <section className="lg:col-span-2 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2.5">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                Sales Trend (Last 7 Days)
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                7-day total:{' '}
                <span className="font-mono font-bold text-[var(--primary)]">
                  {fmtCurrency(totalSales)}
                </span>
              </p>
            </div>
            <span className="text-[11px] font-semibold text-[var(--muted)]">
              Daily Distribution
            </span>
          </div>

          <div className="p-4 h-56 sm:h-64">
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
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Payment Methods
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              Today's collection breakdown
            </p>
          </div>

          <div className="p-4 flex-1 flex flex-col justify-center">
            {payments.length ? (
              <div className="space-y-3.5">
                {payments.map((p, i) => {
                  const share = p.share || 0
                  return (
                    <div key={`${p.method}-${i}`}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-semibold capitalize text-[var(--ink-secondary)]">
                          {p.method}
                        </span>
                        <span className="font-mono font-bold text-[var(--ink)]">
                          {fmtCurrency(p.total)} ({share}%)
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-elevated)] border border-[var(--line)]">
                        <div
                          className="h-full rounded-full bg-[var(--primary)]"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={CreditCard}
                text="No payments recorded today."
              />
            )}
          </div>
        </section>
      </div>

      {/* -------------------------------------------------------------
          SECTION 4: RECENT TRANSACTIONS TABLE
      -------------------------------------------------------------- */}
      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2.5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Recent Invoices
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
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th className="num-col">Grand Total</th>
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
                    <td className="num-col font-bold text-[var(--ink)] font-mono">
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
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
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
            <div className="overflow-x-auto">
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th className="num-col">Qty Sold</th>
                    <th className="num-col">Revenue</th>
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
                      <td className="num-col font-mono text-xs text-[var(--ink-secondary)]">
                        {prod.total_qty} units
                      </td>
                      <td className="num-col font-mono font-bold text-[var(--ink)]">
                        {fmtCurrency(prod.total_revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                Low-Stock Inventory Alerts
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
            <div className="overflow-x-auto">
              <table className="table table-compact">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th className="num-col">Stock</th>
                    <th className="num-col">Min</th>
                    <th>Status</th>
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
                        className={`num-col font-bold font-mono ${
                          Number(prod.current_stock) <= 0
                            ? 'text-red-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {prod.current_stock}
                      </td>
                      <td className="num-col text-xs text-[var(--muted)] font-mono">
                        {prod.minimum_stock}
                      </td>
                      <td>
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
          ) : (
            <EmptyState
              icon={CheckCircle2}
              text="All inventory items are sufficiently stocked."
            />
          )}
        </section>
      </div>

      {/* -------------------------------------------------------------
          SECTION 6: OUTSTANDING PAYMENTS / ACTION REQUIRED TABLE
      -------------------------------------------------------------- */}
      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2.5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Operational Action Items
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              Items requiring immediate staff review or reconciliation
            </p>
          </div>
        </div>

        {actionRequired.length ? (
          <div className="overflow-x-auto">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Status Detail</th>
                  <th className="num-col">Pending Count</th>
                  <th className="text-right">Quick Navigation</th>
                </tr>
              </thead>
              <tbody>
                {actionRequired.map((item, idx) => (
                  <tr
                    key={idx}
                    className={item.count > 0 ? 'row-pending' : ''}
                  >
                    <td className="font-semibold capitalize text-[var(--ink)]">
                      {item.key}
                    </td>
                    <td className="text-[var(--ink-secondary)]">
                      {item.label}
                    </td>
                    <td className="num-col font-mono font-bold">
                      <span
                        className={
                          item.count > 0
                            ? 'text-amber-600 font-bold'
                            : 'text-[var(--muted)]'
                        }
                      >
                        {item.count}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => navigate(item.route)}
                        className="btn-secondary btn-sm text-xs inline-flex items-center gap-1"
                      >
                        <span>Resolve</span>
                        <ArrowUpRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={CheckCircle2}
            text="No immediate pending operational tasks."
          />
        )}
      </section>
    </div>
  )
}