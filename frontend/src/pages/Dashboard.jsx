import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  CreditCard,
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

const money = value =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`

const percentChange = (current, previous) => {
  if (!Number(previous)) return 0

  return Math.round(
    ((Number(current) - Number(previous)) / Number(previous)) * 100,
  )
}

/* ----------------------------------------
   Section Title
----------------------------------------- */

function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight text-[var(--ink)] sm:text-lg">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div className="shrink-0">
          {action}
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------
   Panel
----------------------------------------- */

function Panel({ children, className = '' }) {
  return (
    <section
      className={`
        min-w-0 overflow-hidden
        rounded-2xl
        border border-[var(--line)]
        bg-[var(--surface)]
        p-4
        shadow-[var(--shadow-card)]
        sm:p-5
        ${className}
      `}
    >
      {children}
    </section>
  )
}

/* ----------------------------------------
   KPI Card
----------------------------------------- */

function KpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'primary',
}) {
  const tones = {
    primary:
      'bg-[var(--primary-light)] text-[var(--primary)] border-[var(--primary-border)]',

    success:
      'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',

    warning:
      'bg-amber-500/10 text-amber-600 border-amber-500/20',

    neutral:
      'bg-[var(--surface-elevated)] text-[var(--ink-secondary)] border-[var(--line)]',
  }

  return (
    <div
      className="
        group relative min-w-0 overflow-hidden
        rounded-2xl
        border border-[var(--line)]
        bg-[var(--surface)]
        p-3.5
        shadow-[var(--shadow-card)]
        transition-all duration-200
        hover:-translate-y-0.5 hover:shadow-lg
        sm:p-5
      "
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <p className="min-w-0 text-[10px] font-bold uppercase leading-relaxed tracking-[0.08em] text-[var(--muted)] sm:text-[11px] sm:tracking-[0.12em]">
          {label}
        </p>

        <span
          className={`
            flex h-8 w-8 shrink-0 items-center justify-center
            rounded-xl border
            sm:h-10 sm:w-10
            ${tones[tone]}
          `}
        >
          <Icon size={16} strokeWidth={2} />
        </span>
      </div>

      <p className="mt-4 truncate text-xl font-extrabold tracking-tight text-[var(--ink)] min-[400px]:text-2xl sm:mt-6 sm:text-3xl">
        {value}
      </p>

      {detail && (
        <p className="mt-1.5 line-clamp-2 text-[10px] leading-relaxed text-[var(--muted)] sm:mt-2 sm:text-xs">
          {detail}
        </p>
      )}
    </div>
  )
}

/* ----------------------------------------
   Quick Action
----------------------------------------- */

function QuickAction({
  label,
  description,
  icon: Icon,
  onClick,
}) {
  return (
    <button
      onClick={onClick}
      className="
        group flex min-w-0 w-full items-center gap-3
        rounded-xl
        border border-[var(--line)]
        bg-[var(--surface)]
        p-3.5
        text-left
        transition-all duration-200
        hover:border-[var(--primary-border)]
        hover:bg-[var(--surface-elevated)]
        active:scale-[0.99]
        sm:p-4
      "
    >
      <span
        className="
          flex h-10 w-10 shrink-0 items-center justify-center
          rounded-xl
          bg-[var(--primary-light)]
          text-[var(--primary)]
          transition-transform
          group-hover:scale-105
          sm:h-11 sm:w-11
        "
      >
        <Icon size={19} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-[var(--ink)]">
          {label}
        </span>

        <span className="mt-1 block truncate text-[11px] text-[var(--muted)]">
          {description}
        </span>
      </span>

      <ArrowUpRight
        size={16}
        className="shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </button>
  )
}

/* ----------------------------------------
   Chart Tooltip
----------------------------------------- */

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-[var(--muted)]">
        {label}
      </p>

      <p className="font-bold text-[var(--ink)]">
        {money(payload[0]?.value)}
      </p>
    </div>
  )
}

/* ----------------------------------------
   Empty State
----------------------------------------- */

function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-3 text-center">
      <Icon
        size={25}
        className="text-[var(--muted-light)]"
      />

      <p className="text-xs leading-relaxed text-[var(--muted)] sm:text-sm">
        {text}
      </p>
    </div>
  )
}

/* ----------------------------------------
   Mobile Invoice Card
----------------------------------------- */

function MobileInvoiceCard({ bill }) {
  return (
    <div
      className="
        rounded-xl
        border border-[var(--line-subtle)]
        bg-[var(--surface-elevated)]
        p-3.5
      "
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Invoice
          </p>

          <p className="mt-1 truncate font-mono text-xs font-bold text-[var(--ink-secondary)]">
            {bill.invoice_number}
          </p>
        </div>

        <div className="shrink-0">
          <Badge status={bill.payment_status} />
        </div>
      </div>

      <div className="my-3 h-px bg-[var(--line-subtle)]" />

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Customer
          </p>

          <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">
            {bill.customer_name || 'Walk-in customer'}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Amount
          </p>

          <p className="mt-1 text-base font-extrabold text-[var(--ink)]">
            {money(bill.grand_total)}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------------------
   Dashboard
----------------------------------------- */

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
    () =>
      percentChange(
        data.today_sales,
        data.yesterday_sales,
      ),
    [data.today_sales, data.yesterday_sales],
  )

  const salesData = data.sales_7days || []
  const payments = data.payment_distribution || []
  const lowStock = data.low_stock_products || []
  const recentBills = data.recent_bills || []

  const totalSales = useMemo(
    () =>
      salesData.reduce(
        (sum, item) => sum + Number(item.sales || 0),
        0,
      ),
    [salesData],
  )

  if (loading) {
    return (
      <div className="min-w-0 animate-pulse space-y-5 pb-6">
        <div className="h-36 rounded-2xl bg-[var(--surface-elevated)] sm:h-28" />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-36 rounded-2xl bg-[var(--surface-elevated)] sm:h-40"
            />
          ))}
        </div>

        <div className="h-72 rounded-2xl bg-[var(--surface-elevated)] sm:h-80" />
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-6 pb-6 sm:space-y-7">

      {/* --------------------------------
          Business Header
      --------------------------------- */}

      <header
        className="
          overflow-hidden rounded-2xl
          border border-[var(--line)]
          bg-[var(--surface)]
          p-4
          shadow-[var(--shadow-card)]
          sm:p-5
        "
      >
        <div className=" flex flex-wrap items-start justify-between gap-3 sm:flex-nowrap sm:items-center ">

          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)] sm:text-[11px] sm:tracking-[0.16em]">
              Business overview
            </p>

            <h1 className="mt-1.5 truncate text-xl font-extrabold tracking-tight text-[var(--ink)] sm:text-2xl">
              {shopName || 'Your Business'}
            </h1>

            <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-[var(--muted)]">
              <Clock3 size={13} className="mt-0.5 shrink-0" />

              <span>
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </p>
          </div>

          <div className="flex w-full gap-2 sm:w-auto sm:justify-end">

            <button
              onClick={loadDashboard}
              disabled={refreshing}
              className="
                flex min-h-11 flex-1 items-center justify-center gap-2
                rounded-xl
                border border-[var(--line)]
                px-3 py-2.5
                text-xs font-semibold
                text-[var(--ink-secondary)]
                transition
                hover:bg-[var(--surface-elevated)]
                disabled:cursor-not-allowed disabled:opacity-60
                sm:flex-none
              "
            >
              <RefreshCw
                size={14}
                className={refreshing ? 'animate-spin' : ''}
              />

              <span>Refresh</span>
            </button>

            <button
              onClick={() => navigate('/billing/new')}
              className="
                flex min-h-11 flex-1 items-center justify-center gap-2
                rounded-xl
                bg-[var(--primary)]
                px-4 py-2.5
                text-xs font-bold text-white
                shadow-sm
                transition
                hover:bg-[var(--primary-hover)]
                active:scale-[0.98]
                sm:flex-none
              "
            >
              <Plus size={15} />

              <span>New Bill</span>
            </button>

          </div>
        </div>
      </header>

      {/* --------------------------------
          Error
      --------------------------------- */}

      {error && (
        <div
          className="
            flex flex-col gap-2
            rounded-xl
            border border-amber-500/30
            bg-amber-500/10
            px-4 py-3
            text-xs text-amber-700
            min-[420px]:flex-row
            min-[420px]:items-center
            min-[420px]:justify-between
          "
        >
          <span className="flex items-start gap-2 leading-relaxed">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            {error}
          </span>

          <button
            onClick={loadDashboard}
            className="self-start font-bold underline min-[420px]:self-auto"
          >
            Try again
          </button>
        </div>
      )}

      {/* --------------------------------
          KPI Section
      --------------------------------- */}

      <section>
        <SectionTitle
          title="Today's performance"
          subtitle="A quick view of your business activity"
        />

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard
            label="Today's sales"
            value={money(data.today_sales)}
            detail={`${salesTrend >= 0 ? '+' : ''}${salesTrend}% compared with yesterday`}
            icon={TrendingUp}
            tone="primary"
          />

          <KpiCard
            label="Collection"
            value={money(data.today_collection)}
            detail={`Tax collected: ${money(data.today_tax)}`}
            icon={CreditCard}
            tone="success"
          />

          <KpiCard
            label="Today's profit"
            value={money(data.today_profit)}
            detail={`Average bill: ${money(data.avg_bill_today)}`}
            icon={BarChart3}
            tone="success"
          />

          <KpiCard
            label="Bills generated"
            value={data.today_bills || 0}
            detail="Invoices created today"
            icon={FileText}
            tone="neutral"
          />
        </div>
      </section>

      {/* --------------------------------
          Quick Actions
      --------------------------------- */}

      <section>
        <SectionTitle
          title="Quick actions"
          subtitle="Jump directly to the tasks you use most"
        />

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            label="Create invoice"
            description="Generate a new customer bill"
            icon={ShoppingCart}
            onClick={() => navigate('/billing/new')}
          />

          <QuickAction
            label="Manage inventory"
            description="Review stock and products"
            icon={Package}
            onClick={() => navigate('/inventory')}
          />

          <QuickAction
            label="Customers"
            description="View customer accounts"
            icon={Users}
            onClick={() => navigate('/customers')}
          />

          <QuickAction
            label="Reports"
            description="Analyze business performance"
            icon={BarChart3}
            onClick={() => navigate('/reports')}
          />
        </div>
      </section>

      {/* --------------------------------
          Sales Chart
      --------------------------------- */}

      <section>
        <Panel>
          <SectionTitle
            title="Sales overview"
            subtitle="Revenue generated over the last 7 days"
            action={
              <span className="inline-flex rounded-lg bg-[var(--surface-elevated)] px-2.5 py-1.5 text-[10px] font-bold text-[var(--ink-secondary)] sm:text-xs">
                {money(totalSales)} total
              </span>
            }
          />

          <div className="h-56 w-full min-w-0 sm:h-72">
            {salesData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={salesData}
                  margin={{
                    top: 8,
                    right: 4,
                    left: -20,
                    bottom: 0,
                  }}
                >
                  <defs>
                    <linearGradient
                      id="salesFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--primary)"
                        stopOpacity={0.25}
                      />

                      <stop
                        offset="100%"
                        stopColor="var(--primary)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    vertical={false}
                    stroke="var(--line)"
                    strokeDasharray="4 4"
                  />

                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: 10,
                      fill: 'var(--muted)',
                    }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />

                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: 'var(--muted)',
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                    tickFormatter={v =>
                      v >= 1000
                        ? `₹${v / 1000}k`
                        : `₹${v}`
                    }
                  />

                  <Tooltip content={<ChartTooltip />} />

                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    fill="url(#salesFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-xs text-[var(--muted)] sm:text-sm">
                Sales data will appear here once invoices are generated.
              </div>
            )}
          </div>
        </Panel>
      </section>

      {/* --------------------------------
          Payment + Inventory
      --------------------------------- */}

      <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">

        {/* Payment Summary */}

        <Panel>
          <SectionTitle
            title="Payment summary"
            subtitle="Today's collection by payment method"
          />

          {payments.length ? (
            <div className="space-y-4">
              {payments.map((payment, index) => {
                const total =
                  payments.reduce(
                    (sum, item) =>
                      sum + Number(item.total || 0),
                    0,
                  ) || 1

                const share = Math.round(
                  (Number(payment.total || 0) / total) * 100,
                )

                return (
                  <div key={`${payment.method}-${index}`}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-semibold capitalize text-[var(--ink-secondary)]">
                        {payment.method}
                      </span>

                      <span className="shrink-0 font-bold text-[var(--ink)]">
                        {money(payment.total)} · {share}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                      <div
                        className="h-full rounded-full bg-[var(--primary)] transition-all duration-500"
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
              text="No payment data available yet."
            />
          )}
        </Panel>

        {/* Inventory Alerts */}

        <Panel>
          <SectionTitle
            title="Inventory alerts"
            subtitle={`${data.out_of_stock || 0} out of stock · ${data.low_stock_count || 0} low stock`}
            action={
              <button
                onClick={() => navigate('inventory/stock')}
                className="flex min-h-8 items-center gap-1 text-xs font-bold text-[var(--primary)]"
              >
                View all
                <ArrowUpRight size={13} />
              </button>
            }
          />

          {lowStock.length ? (
            <div className="space-y-3">
              {lowStock.slice(0, 5).map(product => (
                <div
                  key={product.id}
                  className="
                    flex min-w-0 items-center gap-2
                    border-b border-[var(--line-subtle)]
                    pb-3
                    last:border-0 last:pb-0
                  "
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">
                      {product.name}
                    </p>

                    <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                      {product.sku || 'No SKU'}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-sm font-extrabold text-[var(--ink)]">
                      {product.current_stock}
                    </p>

                    <p className="text-[10px] text-[var(--muted)]">
                      Min {product.minimum_stock}
                    </p>
                  </div>

                  <div className="shrink-0">
                    <Badge
                      status={
                        Number(product.current_stock) <= 0
                          ? 'out_of_stock'
                          : 'low_stock'
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CheckCircle2}
              text="All products are sufficiently stocked."
            />
          )}
        </Panel>
      </section>

      {/* --------------------------------
          Recent Invoices
      --------------------------------- */}

      <section>
        <Panel>
          <SectionTitle
            title="Recent invoices"
            subtitle={`Latest ${recentBills.length} transactions`}
            action={
              <button
                onClick={() => navigate('sales/invoices')}
                className="flex min-h-8 items-center gap-1 text-xs font-bold text-[var(--primary)]"
              >
                View all
                <ArrowUpRight size={13} />
              </button>
            }
          />

          {recentBills.length ? (
            <>
              {/* Mobile: Card Layout */}

              <div className="space-y-2.5 sm:hidden">
                {recentBills.slice(0, 6).map(bill => (
                  <MobileInvoiceCard
                    key={bill.id}
                    bill={bill}
                  />
                ))}
              </div>

              {/* Desktop: Table Layout */}

              <div className="hidden overflow-x-auto sm:block">
                <div className="min-w-[520px]">
                  <div className="grid grid-cols-[1.2fr_1.5fr_1fr_1fr] gap-3 border-b border-[var(--line)] pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    <span>Invoice</span>
                    <span>Customer</span>
                    <span>Amount</span>
                    <span>Status</span>
                  </div>

                  <div className="divide-y divide-[var(--line-subtle)]">
                    {recentBills.slice(0, 6).map(bill => (
                      <div
                        key={bill.id}
                        className="grid grid-cols-[1.2fr_1.5fr_1fr_1fr] items-center gap-3 py-3 text-xs"
                      >
                        <span
  onClick={() => navigate(`/invoice/${bill.id}`)}
  className="font-mono font-bold text-[var(--ink-secondary)] cursor-pointer hover:underline"
>
  {bill.invoice_number}
</span>

                        <span className="truncate text-[var(--muted)]">
                          {bill.customer_name || 'Walk-in customer'}
                        </span>

                        <span className="font-bold text-[var(--ink)]">
                          {money(bill.grand_total)}
                        </span>

                        <span>
                          <Badge status={bill.payment_status} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={FileText}
              text="No invoices have been generated yet."
            />
          )}
        </Panel>
      </section>
    </div>
  )
}