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
  ShoppingCart,
  TrendingUp,
  Users,
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
  sales_7days: [],
  payment_distribution: [],
  low_stock_products: [],
  out_of_stock: 0,
  low_stock_count: 0,
  recent_bills: [],
}

const fmtCurrency = value =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const fmtCompact = value =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`

const percentChange = (current, previous) => {
  if (!Number(previous)) return 0
  return Math.round(
    ((Number(current) - Number(previous)) / Number(previous)) * 100
  )
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

  const salesData = data.sales_7days || []
  const payments = data.payment_distribution || []
  const lowStock = data.low_stock_products || []
  const recentBills = data.recent_bills || []

  const totalSales = useMemo(
    () => salesData.reduce((sum, item) => sum + Number(item.sales || 0), 0),
    [salesData]
  )

  if (loading) {
    return (
      <div className="min-w-0 space-y-4 pb-6 animate-pulse">
        <div className="h-20 rounded-xl bg-[var(--surface-elevated)] border border-[var(--line)]" />
        <div className="h-24 rounded-xl bg-[var(--surface-elevated)] border border-[var(--line)]" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-64 rounded-xl bg-[var(--surface-elevated)] border border-[var(--line)]" />
          <div className="h-64 rounded-xl bg-[var(--surface-elevated)] border border-[var(--line)]" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-4 pb-6">
      {/* -------------------------------------------------------------
          TOP BAR: Store Name, Current Date, Action Controls
      -------------------------------------------------------------- */}
      <header className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-600"></span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                ERP Billing Station
              </p>
            </div>
            <h1 className="mt-0.5 truncate text-lg sm:text-xl font-bold text-[var(--ink)]">
              {shopName || 'Balaji ERP'}
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

          <div className="flex items-center gap-2">
            <button
              onClick={loadDashboard}
              disabled={refreshing}
              className="btn-secondary h-9 text-xs px-3"
              title="Refresh Dashboard"
            >
              <RefreshCw
                size={14}
                className={refreshing ? 'animate-spin' : ''}
              />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={() => navigate('/billing/new')}
              className="btn-primary h-9 text-xs px-4"
            >
              <Plus size={15} />
              <span>New Bill</span>
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
          TABLE-BASED ERP METRICS BAR (Replaces Floating Cards)
      -------------------------------------------------------------- */}
      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
          Today's Financial Summary
        </div>
        <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          {/* Today's Sales */}
          <div className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Today's Sales
              </span>
              <TrendingUp size={14} className="text-blue-600" />
            </div>
            <p className="mt-2 text-lg sm:text-xl font-bold font-mono text-[var(--ink)]">
              {fmtCurrency(data.today_sales)}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              <span
                className={`font-semibold ${
                  salesTrend >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {salesTrend >= 0 ? '+' : ''}
                {salesTrend}%
              </span>{' '}
              vs yesterday
            </p>
          </div>

          {/* Collection */}
          <div className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Collection
              </span>
              <CreditCard size={14} className="text-green-600" />
            </div>
            <p className="mt-2 text-lg sm:text-xl font-bold font-mono text-green-600">
              {fmtCurrency(data.today_collection)}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Tax: {fmtCurrency(data.today_tax)}
            </p>
          </div>

          {/* Today's Profit */}
          <div className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Today's Profit
              </span>
              <BarChart3 size={14} className="text-blue-600" />
            </div>
            <p className="mt-2 text-lg sm:text-xl font-bold font-mono text-[var(--ink)]">
              {fmtCurrency(data.today_profit)}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Avg Bill: {fmtCompact(data.avg_bill_today)}
            </p>
          </div>

          {/* Bills Generated */}
          <div className="p-3.5 sm:p-4">
            <div className="flex items-center justify-between text-xs text-[var(--muted)]">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Invoices Today
              </span>
              <FileText size={14} className="text-[var(--muted)]" />
            </div>
            <p className="mt-2 text-lg sm:text-xl font-bold font-mono text-[var(--ink)]">
              {data.today_bills || 0}
            </p>
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Completed transactions
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          ERP QUICK ACTIONS TOOLBAR
      -------------------------------------------------------------- */}
      <section className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => navigate('/billing/new')}
          className="btn-primary h-9 text-xs px-3.5 flex items-center gap-1.5"
        >
          <ShoppingCart size={14} />
          <span>POS Billing</span>
        </button>
        <button
          onClick={() => navigate('/inventory/products')}
          className="btn-secondary h-9 text-xs px-3 flex items-center gap-1.5"
        >
          <Package size={14} />
          <span>Products</span>
        </button>
        <button
          onClick={() => navigate('/parties/customers')}
          className="btn-secondary h-9 text-xs px-3 flex items-center gap-1.5"
        >
          <Users size={14} />
          <span>Customers</span>
        </button>
        <button
          onClick={() => navigate('/reports')}
          className="btn-secondary h-9 text-xs px-3 flex items-center gap-1.5"
        >
          <BarChart3 size={14} />
          <span>Reports</span>
        </button>
        <button
          onClick={() => navigate('/sales/invoices')}
          className="btn-secondary h-9 text-xs px-3 flex items-center gap-1.5 ml-auto"
        >
          <span>All Invoices</span>
          <ArrowUpRight size={13} />
        </button>
      </section>

      {/* -------------------------------------------------------------
          SALES TREND & PAYMENT DISTRIBUTION
      -------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Overview Chart (2 cols) */}
        <section className="lg:col-span-2 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2.5">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                Sales Overview (Last 7 Days)
              </h2>
              <p className="text-[11px] text-[var(--muted)]">
                Total: <span className="font-mono font-bold text-blue-600">{fmtCurrency(totalSales)}</span>
              </p>
            </div>
            <span className="text-[11px] font-semibold text-[var(--muted)]">
              Daily Trend
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
                    <linearGradient id="blueSalesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--muted)' }}
                    axisLine={false}
                    tickLine={false}
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
                    stroke="#2563EB"
                    strokeWidth={2}
                    fill="url(#blueSalesFill)"
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

        {/* Payment Summary (1 col) */}
        <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] flex flex-col">
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
                  const total =
                    payments.reduce((s, x) => s + Number(x.total || 0), 0) || 1
                  const share = Math.round((Number(p.total || 0) / total) * 100)
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
                          className="h-full rounded-full bg-blue-600"
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
          RECENT INVOICES (Table-Based ERP Standard)
      -------------------------------------------------------------- */}
      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2.5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Recent Invoices
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              Latest transactions
            </p>
          </div>
          <button
            onClick={() => navigate('/sales/invoices')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowUpRight size={13} />
          </button>
        </div>

        {recentBills.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th className="num-col">Amount</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentBills.slice(0, 8).map(bill => (
                  <tr key={bill.id}>
                    <td>
                      <button
                        onClick={() => navigate(`/invoice/${bill.id}`)}
                        className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline"
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
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/invoice/${bill.id}`)}
                          className="btn-secondary btn-sm flex items-center gap-1 text-xs"
                          title="View Invoice"
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>
                      </div>
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
          INVENTORY ALERTS (Table-Based ERP Standard)
      -------------------------------------------------------------- */}
      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2.5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Inventory Alerts
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              {data.out_of_stock || 0} out of stock · {data.low_stock_count || 0} low stock
            </p>
          </div>
          <button
            onClick={() => navigate('/inventory/stock')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>Manage Stock</span>
            <ArrowUpRight size={13} />
          </button>
        </div>

        {lowStock.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th className="num-col">Current Stock</th>
                  <th className="num-col">Min Stock</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.slice(0, 6).map(prod => (
                  <tr key={prod.id}>
                    <td className="font-semibold text-[var(--ink)]">
                      {prod.name}
                    </td>
                    <td className="font-mono text-xs text-[var(--muted)]">
                      {prod.sku || '—'}
                    </td>
                    <td
                      className={`num-col font-bold font-mono ${
                        Number(prod.current_stock) <= 0
                          ? 'text-red-600'
                          : 'text-orange-500'
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
            text="All products are sufficiently stocked."
          />
        )}
      </section>
    </div>
  )
}