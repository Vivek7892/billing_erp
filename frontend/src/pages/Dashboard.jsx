import { useEffect, useState, useCallback } from 'react'
import api from '../api'
import { Badge, Spinner } from '../components/UI'
import { useShop } from '../components/Layout'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, ShoppingBag, Package, AlertTriangle,
  Users, CreditCard, DollarSign, RefreshCw, ArrowUpRight, ArrowDownRight,
  Minus, ShoppingCart, Truck, Tag, Clock, BarChart2, Percent, Plus
} from 'lucide-react'

const fmt = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const fmtDec = v => `₹${Number(v || 0).toFixed(2)}`
const pct = (a, b) => b > 0 ? Math.round(((a - b) / b) * 100) : 0

const PAY_COLORS = { cash: '#16a34a', upi: '#2563eb', card: '#7c3aed', online: '#0891b2', credit: '#dc2626' }
const CAT_COLORS = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#dc2626']

/* ── Trend badge ── */
function Trend({ value }) {
  if (value === 0) return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus size={11} /> No change</span>
  const up = value > 0
  return (
    <span className={`text-xs flex items-center gap-0.5 font-medium ${up ? 'text-green-600' : 'text-red-500'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {up ? '+' : ''}{value}% vs yesterday
    </span>
  )
}

/* ── Stat card ── */
function Stat({ label, value, sub, icon: Icon, color = 'blue', trend, highlight }) {
  const p = {
    blue:   'border-blue-100   bg-blue-50   text-blue-600',
    green:  'border-green-100  bg-green-50  text-green-600',
    orange: 'border-orange-100 bg-orange-50 text-orange-500',
    red:    'border-red-100    bg-red-50    text-red-500',
    purple: 'border-purple-100 bg-purple-50 text-purple-600',
    cyan:   'border-cyan-100   bg-cyan-50   text-cyan-600',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-600',
  }[color]
  const [border, bg, ic] = p.split(' ')
  return (
    <div className={`group bg-white rounded-2xl border border-slate-200/80 ${highlight ? 'ring-2 ring-slate-900/10' : ''} p-4 sm:p-5 flex flex-col gap-3 shadow-[0_6px_24px_rgba(15,23,42,0.045)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08)] transition-all`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.14em] leading-tight">{label}</span>
        <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center flex-shrink-0 ring-1 ring-black/5`}>
          <Icon size={16} className={ic} />
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-950 truncate">{value}</div>
      {sub && <div className="text-xs text-slate-500 truncate">{sub}</div>}
      {trend !== undefined && <Trend value={trend} />}
    </div>
  )
}

/* ── Insight card ── */
function Insight({ label, value, icon: Icon, color, note }) {
  const colors = {
    green:  'bg-green-50 border-green-100 text-green-700',
    blue:   'bg-blue-50 border-blue-100 text-blue-700',
    orange: 'bg-orange-50 border-orange-100 text-orange-700',
    purple: 'bg-purple-50 border-purple-100 text-purple-700',
  }
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={15} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-extrabold tracking-tight">{value}</div>
      {note && <div className="text-xs mt-1 opacity-70">{note}</div>}
    </div>
  )
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl shadow-2xl px-3 py-2.5 text-xs text-white">
      <div className="font-semibold text-slate-300 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-bold text-white">₹{Number(p.value).toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { shopName } = useShop()
  const [d, setD] = useState(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    api.get('/dashboard/').then(r => setD(r.data)).catch(() => setD({})).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <Spinner />
  if (!d || Object.keys(d).length === 0) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-gray-500 text-sm">Could not load dashboard data.</p>
      <button className="btn-primary text-sm" onClick={load}><RefreshCw size={14} /> Retry</button>
    </div>
  )

  const salesTrend = pct(d.today_sales, d.yesterday_sales)
  const profitTrend = pct(d.today_profit, d.yesterday_profit)
  const billsTrend = pct(d.today_bills, d.yesterday_bills)
  const sales7 = d.sales_7days || []
  const monthly = d.monthly_sales || []
  const hourly = (d.hourly_sales || []).filter(h => h.total > 0 || true)
  const topProducts = d.top_products || []
  const catSales = d.category_sales || []
  const payDist = d.payment_distribution || []
  const lowStock = d.low_stock_products || []
  const recentBills = d.recent_bills || []
  const maxQty = Math.max(...topProducts.map(p => Number(p.total_revenue || 0)), 1)

  return (
    <div className="min-h-full space-y-6 bg-slate-50/80 -m-2 sm:-m-4 p-2 sm:p-4 rounded-2xl">

      {/* Header bar */}
      <div className="w-full bg-[#F8F9FA] border border-[#DEE2E6] rounded-2xl px-4 sm:px-5 py-4 shadow-sm">
  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

    {/* Shop information */}
    <div className="min-w-0 flex-1">
      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold tracking-tight text-[#212529] truncate">
        {shopName}
      </h2>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6C757D]">
        <span>
          {now.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>

        <span className="text-[#ADB5BD]">·</span>

        <span>
          {now.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          })}
        </span>
      </div>
    </div>

    {/* Actions */}
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <button
        onClick={() => navigate('/billing/new')}
        className="
          flex-1 sm:flex-none
          h-9 sm:h-10
          px-4
          rounded-xl
          bg-[#1471D8]
          hover:bg-[#0F5FB8]
          active:bg-[#0B4F9A]
          text-white
          text-xs
          sm:text-sm
          font-semibold
          flex items-center justify-center gap-1.5
          transition-colors
          shadow-sm
          whitespace-nowrap
        "
      >
        <ShoppingCart size={14} />
        <span>New Bill</span>
      </button>

      <button
        onClick={load}
        aria-label="Refresh"
        title="Refresh"
        className="
          shrink-0
          w-9 h-9 sm:w-10 sm:h-10
          rounded-xl
          border border-[#CED4DA]
          bg-white
          text-[#495057]
          flex items-center justify-center
          hover:bg-[#E9ECEF]
          active:bg-[#DEE2E6]
          transition-colors
        "
      >
        <RefreshCw size={14} />
      </button>
    </div>

  </div>
</div>

      {/* Stock alert banner */}
      {(d.out_of_stock > 0 || d.low_stock_count > 0) && (
        <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm ${
          d.out_of_stock > 0 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className={d.out_of_stock > 0 ? 'text-red-500' : 'text-orange-500'} />
            <span className={`text-sm font-semibold ${d.out_of_stock > 0 ? 'text-red-700' : 'text-orange-700'}`}>
              Stock Alert:
              {d.out_of_stock > 0 && <span className="ml-1">{d.out_of_stock} product{d.out_of_stock > 1 ? 's' : ''} out of stock</span>}
              {d.out_of_stock > 0 && d.low_stock_count > 0 && <span className="mx-1">·</span>}
              {d.low_stock_count > 0 && <span>{d.low_stock_count} product{d.low_stock_count > 1 ? 's' : ''} running low</span>}
            </span>
          </div>
          <button onClick={() => navigate('/inventory')} className="text-xs font-semibold underline text-blue-600">View Inventory →</button>
        </div>
      )}

      {/* Today stats */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em] mb-3">Today's Performance</p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Stat label="Today's Sales"  value={fmt(d.today_sales)}   icon={TrendingUp}  color="blue"   trend={salesTrend}  highlight sub={`Yesterday: ${fmt(d.yesterday_sales)}`} />
          <Stat label="Today's Profit" value={fmt(d.today_profit)}  icon={DollarSign}  color="green"  trend={profitTrend} sub={`Margin: ${d.profit_margin}%`} />
          <Stat label="Bills Today"    value={d.today_bills}        icon={ShoppingBag} color="purple" trend={billsTrend}  sub={`Avg: ${fmt(d.avg_bill_today)}/bill`} />
          <Stat label="Tax Collected"  value={fmt(d.today_tax)}     icon={Percent}     color="orange" sub={`Discount: ${fmt(d.today_discount)}`} />
        </div>
      </div>

      {/* Month stats */}
      <div className="pt-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em] mb-3">This Month</p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Stat label="Month Sales"    value={fmt(d.month_sales)}    icon={BarChart2}   color="blue"   sub={`Last month: ${fmt(d.last_month_sales)}`} trend={pct(d.month_sales, d.last_month_sales)} />
          <Stat label="Month Profit"   value={fmt(d.month_profit)}   icon={TrendingUp}  color="green"  sub={`${d.month_bills} invoices`} />
          <Stat label="Pending Credit" value={fmt(d.pending_credit)} icon={CreditCard}  color="red"    sub={`${d.total_customers} customers`} />
          <Stat label="Pending Purchases" value={fmt(d.pending_purchases)} icon={Truck} color="orange" sub={`${d.total_suppliers} suppliers`} />
        </div>
      </div>

      {/* Business insights row */}
      <div className="pt-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.18em] mb-3">Business Insights</p>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <Insight label="Sales Growth"    value={`${d.sales_growth > 0 ? '+' : ''}${d.sales_growth}%`} icon={d.sales_growth >= 0 ? TrendingUp : TrendingDown} color={d.sales_growth >= 0 ? 'green' : 'orange'} note="vs last month" />
          <Insight label="Profit Margin"   value={`${d.profit_margin}%`}   icon={Percent}       color="blue"   note="Today's margin" />
          <Insight label="Avg Bill/Month"  value={fmt(d.avg_bill_month)}   icon={ShoppingCart}  color="purple" note="Per invoice this month" />
          <Insight label="New Customers"   value={d.new_customers_today}   icon={Users}         color="green"  note="Registered today" />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Analytics</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* Charts row 1 — 7-day area + hourly bar */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.05)] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Sales & Profit — Last 7 Days</h3>
              <p className="text-xs text-slate-500">Daily revenue vs profit</p>
            </div>
            <span className="text-[11px] bg-slate-100 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg">
              {fmt(sales7.reduce((s, x) => s + (x.sales || 0), 0))} week
            </span>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={sales7} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => v.slice(5)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} axisLine={false} tickLine={false} width={42} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="sales" name="Sales" stroke="#2563eb" strokeWidth={2} fill="url(#sg)" dot={{ r: 3, fill: '#2563eb' }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="profit" name="Profit" stroke="#16a34a" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.05)] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Today's Hourly Sales</h3>
              <p className="text-xs text-slate-500">Revenue by hour of day</p>
            </div>
            <span className="text-[11px] bg-violet-50 text-violet-700 font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1">
              <Clock size={11} /> Today
            </span>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={hourly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="total" name="Sales" fill="url(#hg)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 — Monthly + Category */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.05)] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Monthly Sales</h3>
              <p className="text-xs text-slate-500">Last 6 months revenue</p>
            </div>
            <span className="text-[11px] bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1.5 rounded-lg">
              {fmt(monthly[monthly.length - 1]?.total || 0)} this month
            </span>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} axisLine={false} tickLine={false} width={42} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="total" name="Sales" fill="url(#mg)" radius={[5, 5, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.05)] p-5 sm:p-6">
          <div className="mb-3">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Category Sales — This Month</h3>
            <p className="text-xs text-slate-500">Revenue by product category</p>
          </div>
          {catSales.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-gray-400">No category data yet</div>
          ) : (
            <div className="flex items-center gap-5">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={catSales} dataKey="total_revenue" nameKey="product__category__name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3}>
                    {catSales.map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {catSales.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                      <span className="text-xs text-gray-600 truncate max-w-[90px]">{c.product__category__name}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-800">{fmt(c.total_revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts row 3 — Top products + Payment methods */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.05)] p-5 sm:p-6">
          <div className="mb-3">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Top Products by Revenue</h3>
            <p className="text-xs text-slate-500">All-time best sellers</p>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No sales data yet</p>
          ) : (
            <div className="space-y-3.5">
              {topProducts.map((p, i) => {
                const pctVal = Math.round((Number(p.total_revenue) / maxQty) * 100)
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-gray-400 w-4">#{i + 1}</span>
                        <span className="text-xs font-medium text-gray-700 truncate max-w-[55%]">{p.product_name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-gray-400">{Number(p.total_qty).toFixed(0)} units</span>
                        <span className="text-xs font-bold text-gray-800">{fmt(p.total_revenue)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pctVal}%`, background: CAT_COLORS[i % CAT_COLORS.length] }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.05)] p-5 sm:p-6">
          <div className="mb-3">
            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Payment Methods</h3>
            <p className="text-xs text-slate-500">All-time revenue by payment type</p>
          </div>
          {payDist.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No payment data yet</p>
          ) : (
            <div className="flex items-center gap-5">
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie data={payDist} dataKey="total" nameKey="method" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {payDist.map((p, i) => <Cell key={i} fill={PAY_COLORS[p.method] || CAT_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2.5">
                {payDist.map((p, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PAY_COLORS[p.method] || CAT_COLORS[i] }} />
                      <span className="text-xs text-gray-600 capitalize">{p.method}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-gray-800">{fmt(p.total)}</div>
                      <div className="text-[10px] text-gray-400">{p.count} txns</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom row — Low stock + Recent bills */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.05)] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Stock Alerts</h3>
              <p className="text-xs text-slate-500">{d.out_of_stock} out of stock · {d.low_stock_count} low stock</p>
            </div>
            <div className="flex gap-2">
              {d.out_of_stock > 0 && <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-1 rounded-lg">{d.out_of_stock} out</span>}
              {d.low_stock_count > 0 && <span className="text-xs bg-orange-50 text-orange-600 font-semibold px-2 py-1 rounded-lg">{d.low_stock_count} low</span>}
            </div>
          </div>
          {lowStock.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                <Package size={20} className="text-green-500" />
              </div>
              <p className="text-sm text-gray-400">All products well stocked</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {lowStock.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.sku}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className={`text-sm font-bold ${p.current_stock <= 0 ? 'text-red-600' : 'text-orange-500'}`}>{p.current_stock}</div>
                      <div className="text-[10px] text-gray-400">min {p.minimum_stock}</div>
                    </div>
                    <Badge status={p.current_stock <= 0 ? 'out_of_stock' : 'low_stock'} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.05)] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Recent Bills</h3>
              <p className="text-xs text-slate-500">Latest {recentBills.length} invoices</p>
            </div>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {recentBills.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No bills yet</p>
            ) : recentBills.map(b => (
              <div key={b.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <div className="min-w-0">
                  <div className="text-sm font-mono font-semibold text-blue-600">{b.invoice_number}</div>
                  <div className="text-xs text-gray-400 truncate">{b.customer_name}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-800">{fmtDec(b.grand_total)}</div>
                    <div className="text-[10px] text-gray-400 capitalize">{b.payment_method}</div>
                  </div>
                  <Badge status={b.payment_status} />   
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}