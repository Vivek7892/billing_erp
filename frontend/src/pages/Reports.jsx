import { useState, useEffect, useMemo } from 'react'
import api from '../api'
import { Card, PageHeader, Spinner, EmptyState } from '../components/UI'
import {
  Download,
  AlertCircle,
  RefreshCw,
  Calendar,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  DollarSign,
  Package,
  Users,
  CreditCard,
  Receipt,
  Percent,
  CheckCircle,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'
import toast from 'react-hot-toast'

const fmtCurrency = v =>
  `₹${Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const fmtShort = v =>
  `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const today = new Date().toISOString().slice(0, 10)
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  .toISOString()
  .slice(0, 10)

const TABS = [
  { key: 'sales', label: 'Sales Summary', icon: TrendingUp },
  { key: 'products', label: 'Product Sales', icon: Package },
  { key: 'profit', label: 'Profit & Loss', icon: DollarSign },
  { key: 'gst', label: 'GST Tax Summary', icon: Percent },
  { key: 'customers', label: 'Customer Receivables', icon: Users },
  { key: 'payments', label: 'Payment Modes', icon: CreditCard },
  { key: 'expenses', label: 'Operating Expenses', icon: Receipt },
]

export default function Reports() {
  const [tab, setTab] = useState('sales')
  const [start, setStart] = useState(monthStart)
  const [end, setEnd] = useState(today)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')

  const endpoints = {
    sales: '/reports/sales/',
    products: '/reports/products/',
    profit: '/reports/profit/',
    gst: '/reports/gst/',
    customers: '/reports/customers/',
    payments: '/reports/payments/',
    expenses: '/reports/expenses/',
  }

  const reportNames = {
    sales: 'sales-summary-report',
    products: 'product-sales-report',
    profit: 'profit-and-loss-report',
    gst: 'gst-summary-report',
    customers: 'customer-credit-receivables-report',
    payments: 'payment-modes-report',
    expenses: 'operating-expenses-report',
  }

  const load = async () => {
    if (tab !== 'customers' && start > end) {
      setError('Start date cannot be after end date.')
      return
    }

    setLoading(true)
    setData(null)
    setError('')

    try {
      const params =
        tab === 'customers' ? '' : `?start_date=${start}&end_date=${end}`

      const response = await api.get(`${endpoints[tab]}${params}`)
      setData(response.data)
    } catch (err) {
      const message =
        err.response?.status === 403
          ? 'Reports are restricted to administrator roles.'
          : err.response?.data?.detail ||
            'Failed to generate report from server. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = async format => {
    if (tab !== 'customers' && start > end) {
      return toast.error('Start date cannot be after end date')
    }

    setExporting(format)
    try {
      const params = new URLSearchParams()
      if (tab !== 'customers') {
        params.set('start_date', start)
        params.set('end_date', end)
      }
      params.set('export', format)

      const { data, headers } = await api.get(
        `${endpoints[tab]}?${params.toString()}`,
        { responseType: 'blob' },
      )

      const blob = new Blob([data], {
        type:
          headers['content-type'] ||
          (format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${reportNames[tab]}_${new Date().toISOString().slice(0, 10)}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(
        `Report exported as ${format === 'pdf' ? 'PDF' : 'Excel spreadsheet'}`,
      )
    } catch (err) {
      toast.error('Failed to export report')
    } finally {
      setExporting('')
    }
  }

  useEffect(() => {
    load()
  }, [tab, start, end])

  return (
    <div className="reports-page w-full min-w-0 space-y-5 pb-12 text-[var(--ink)]">
      <style>{`
        .reports-page .erp-report-table {
          width: 100%;
          border-collapse: collapse;
        }

        .reports-page .erp-report-table th {
          padding: 11px 14px;
          text-align: left;
          white-space: nowrap;
          background: var(--surface-elevated);
          border-bottom: 1px solid var(--line);
          color: var(--muted-light);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .05em;
          text-transform: uppercase;
        }

        .reports-page .erp-report-table td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--line-subtle);
          vertical-align: middle;
          font-size: 13px;
        }

        .reports-page .erp-report-table tbody tr:hover {
          background: var(--surface-elevated);
        }

        .reports-page .erp-report-table tfoot td {
          padding: 13px 14px;
          border-top: 2px solid var(--line);
          border-bottom: 2px solid var(--line);
          background: var(--surface-elevated);
          font-weight: 700;
        }
      `}</style>

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}
      <PageHeader
        title="Business Intelligence & Reports"
        subtitle="Comprehensive financial, tax, inventory, and customer receivables analysis."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => downloadReport('pdf')}
              disabled={Boolean(exporting)}
              className="btn-secondary btn-base text-xs flex items-center gap-1.5"
              title="Download formal A4 PDF Report"
            >
              <FileText size={14} className="text-rose-600" />
              {exporting === 'pdf' ? 'Generating...' : 'Export PDF'}
            </button>

            <button
              type="button"
              onClick={() => downloadReport('xlsx')}
              disabled={Boolean(exporting)}
              className="btn-secondary btn-base text-xs flex items-center gap-1.5"
              title="Download formatted Excel workbook"
            >
              <FileSpreadsheet size={14} className="text-teal-600" />
              {exporting === 'xlsx' ? 'Generating...' : 'Export Excel'}
            </button>
          </div>
        }
      />

      {/* =====================================================
          REPORT MODULE TABS
      ====================================================== */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon
          const isActive = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]'
              }`}
            >
              <Icon size={13} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* =====================================================
          DATE CONTROLS & PRESETS WORKBENCH
      ====================================================== */}
      {tab !== 'customers' && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Quick date presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <Calendar size={13} className="text-[var(--muted)] mr-1 shrink-0" />
              {[
                ['Today', today, today],
                ['This Month', monthStart, today],
                [
                  'Last 30 Days',
                  new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
                  today,
                ],
                [
                  'Last 90 Days',
                  new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10),
                  today,
                ],
              ].map(([label, fDate, tDate]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setStart(fDate)
                    setEnd(tDate)
                  }}
                  className={`rounded-md px-2.5 py-1 font-medium whitespace-nowrap transition-colors ${
                    start === fDate && end === tDate
                      ? 'bg-[#1E3A5F] text-white font-semibold'
                      : 'bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* From - To date inputs */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-[var(--muted)]">From:</span>
                <input
                  type="date"
                  value={start}
                  max={end}
                  onChange={e => setStart(e.target.value)}
                  className="input h-9 px-2 text-xs font-mono font-medium"
                />
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-[var(--muted)]">To:</span>
                <input
                  type="date"
                  value={end}
                  min={start}
                  onChange={e => setEnd(e.target.value)}
                  className="input h-9 px-2 text-xs font-mono font-medium"
                />
              </div>

              <button
                type="button"
                onClick={load}
                className="btn-primary h-9 px-3.5 text-xs font-semibold"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          REPORT CONTENT BODY
      ====================================================== */}
      {loading ? (
        <div className="flex min-h-64 items-center justify-center p-8">
          <Spinner />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-8 text-center">
          <AlertCircle className="mx-auto text-rose-500 mb-2" size={32} />
          <h3 className="text-sm font-bold text-[var(--ink)]">
            Report Generation Error
          </h3>
          <p className="mt-1 text-xs text-[var(--muted)]">{error}</p>
          <button
            type="button"
            onClick={load}
            className="btn-secondary btn-base mt-4"
          >
            Try Again
          </button>
        </div>
      ) : data ? (
        <div className="space-y-5">
          {tab === 'sales' && <SalesReportView data={data} />}
          {tab === 'products' && <ProductReportView data={data} />}
          {tab === 'profit' && <ProfitReportView data={data} />}
          {tab === 'gst' && <GSTReportView data={data} />}
          {tab === 'customers' && <CustomerReportView data={data} />}
          {tab === 'payments' && <PaymentReportView data={data} />}
          {tab === 'expenses' && <ExpenseReportView data={data} />}
        </div>
      ) : null}
    </div>
  )
}

/* =========================================================
   1. SALES SUMMARY REPORT VIEW
========================================================= */
function SalesReportView({ data }) {
  const summary = data.summary || {}
  const daily = Array.isArray(data.daily) ? data.daily : []

  return (
    <div className="space-y-4">
      {/* Executive Financial Summary Table */}
      <div className="erp-table-container">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--surface-elevated)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Sales Performance Summary
          </span>
          <span className="text-xs text-[var(--muted)]">Gross &amp; Net Operations</span>
        </div>
        <div className="overflow-x-auto">
          <table className="erp-summary-table">
            <thead>
              <tr>
                <th>Gross Invoiced Sales</th>
                <th>Net Sales Revenue</th>
                <th>Total Invoices</th>
                <th>Output GST Tax</th>
                <th>Collections</th>
                <th>Outstanding Credit</th>
                <th>Discounts</th>
                <th>Returns</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-[#1E3A5F] dark:text-slate-200 text-sm">
                  {fmtCurrency(summary.total_sales)}
                </td>
                <td className="font-mono font-bold text-teal-600 dark:text-teal-400 text-sm">
                  {fmtCurrency(summary.net_sales || summary.total_sales)}
                </td>
                <td className="font-mono font-semibold text-[var(--ink)] text-sm">
                  {summary.count ?? 0}
                </td>
                <td className="font-mono font-semibold text-[var(--ink)] text-sm">
                  {fmtCurrency(summary.total_tax)}
                </td>
                <td className="font-mono font-semibold text-teal-600 dark:text-teal-400 text-sm">
                  {fmtCurrency(summary.collection || summary.total_sales)}
                </td>
                <td className="font-mono font-semibold text-rose-600 dark:text-rose-400 text-sm">
                  {fmtCurrency(summary.outstanding)}
                </td>
                <td className="font-mono font-semibold text-amber-600 dark:text-amber-400 text-sm">
                  {fmtCurrency(summary.total_discount)}
                </td>
                <td className="font-mono font-semibold text-[var(--muted)] text-sm">
                  {fmtCurrency(summary.returns)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Sales Chart */}
      {daily.length > 0 && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-4">
            Daily Sales Revenue Trend
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={daily}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--line-subtle)"
              />
              <XAxis
                dataKey="created_at__date"
                tick={{ fontSize: 11, fill: 'var(--muted)' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted)' }}
                tickFormatter={v => `₹${v}`}
              />
              <Tooltip
                formatter={v => fmtCurrency(v)}
                contentStyle={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--line)',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="Sales"
                stroke="#1E3A5F"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#1E3A5F' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   2. PRODUCT SALES REPORT VIEW
========================================================= */
function ProductReportView({ data }) {
  const rows = Array.isArray(data) ? data : data?.results || []

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
      <div className="border-b border-[var(--line)] px-4 py-3 sm:px-5 flex items-center justify-between bg-[var(--surface-elevated)]">
        <h3 className="text-sm font-bold text-[var(--ink)]">
          Product Sales Performance
        </h3>
        <span className="text-xs font-mono text-[var(--muted)]">
          {rows.length} product(s) sold
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="erp-report-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU</th>
              <th className="text-right">Qty Sold</th>
              <th className="text-right">Total Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-[var(--muted)]">
                  No product sales in the selected period.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i}>
                  <td className="font-semibold text-[var(--ink)]">
                    {r.product_name}
                  </td>
                  <td className="font-mono text-xs text-[var(--muted)]">
                    {r.sku || '—'}
                  </td>
                  <td className="text-right font-mono font-bold">
                    {r.total_qty}
                  </td>
                  <td className="text-right font-mono font-bold text-teal-600 dark:text-teal-400">
                    {fmtCurrency(r.total_revenue)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2}>Grand Total</td>
                <td className="text-right font-mono">
                  {rows.reduce((sum, r) => sum + Number(r.total_qty || 0), 0)}
                </td>
                <td className="text-right font-mono text-teal-600 dark:text-teal-400">
                  {fmtCurrency(
                    rows.reduce(
                      (sum, r) => sum + Number(r.total_revenue || 0),
                      0,
                    ),
                  )}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

/* =========================================================
   3. PROFIT & LOSS REPORT VIEW
========================================================= */
function ProfitReportView({ data }) {
  const items = Array.isArray(data.items) ? data.items : []
  const margin =
    Number(data.total_revenue || 0) > 0
      ? (
          (Number(data.total_profit || 0) / Number(data.total_revenue || 0)) *
          100
        ).toFixed(1)
      : 0

  return (
    <div className="space-y-4">
      {/* Financial Profit Summary Table */}
      <div className="erp-table-container">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--surface-elevated)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Profit &amp; Margin Overview
          </span>
          <span className="text-xs font-bold text-teal-600 dark:text-teal-400">{margin}% Gross Profit Margin</span>
        </div>
        <div className="overflow-x-auto">
          <table className="erp-summary-table">
            <thead>
              <tr>
                <th>Total Invoiced Revenue</th>
                <th>Cost of Goods Sold (COGS)</th>
                <th>Gross Margin Profit</th>
                <th>Overall Margin (%)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-[#1E3A5F] dark:text-slate-200 text-sm">
                  {fmtCurrency(data.total_revenue)}
                </td>
                <td className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                  {fmtCurrency(data.total_cost)}
                </td>
                <td className="font-mono font-bold text-teal-600 dark:text-teal-400 text-sm">
                  {fmtCurrency(data.total_profit)}
                </td>
                <td className="font-mono font-bold text-teal-600 dark:text-teal-400 text-sm">
                  {margin}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Profit Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)] px-4 py-3 sm:px-5 bg-[var(--surface-elevated)] flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--ink)]">
            Item-wise Profitability Breakdown
          </h3>
          <span className="text-xs text-[var(--muted)]">Top 40 active items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Revenue</th>
                <th className="text-right">Cost</th>
                <th className="text-right">Gross Profit</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-[var(--muted)]">
                    No sales items recorded in this date range.
                  </td>
                </tr>
              ) : (
                items.slice(0, 40).map((it, i) => (
                  <tr key={i}>
                    <td className="font-semibold text-[var(--ink)]">
                      {it.product}
                    </td>
                    <td className="text-right font-mono">{it.qty}</td>
                    <td className="text-right font-mono">
                      {fmtCurrency(it.revenue)}
                    </td>
                    <td className="text-right font-mono text-[var(--muted)]">
                      {fmtCurrency(it.cost)}
                    </td>
                    <td className="text-right font-mono font-bold text-teal-600 dark:text-teal-400">
                      {fmtCurrency(it.profit)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   4. GST TAX SUMMARY REPORT VIEW
========================================================= */
function GSTReportView({ data }) {
  const rates = Array.isArray(data.rates) ? data.rates : []

  return (
    <div className="space-y-4">
      {/* GST Summary Table */}
      <div className="erp-table-container">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--surface-elevated)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            GST Liability Overview (GSTR-1)
          </span>
          <span className="text-xs text-[var(--muted)]">Output Tax Liability</span>
        </div>
        <div className="overflow-x-auto">
          <table className="erp-summary-table">
            <thead>
              <tr>
                <th>Taxable Turnover</th>
                <th>Output CGST</th>
                <th>Output SGST</th>
                <th>Total Output GST Tax</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-[var(--ink)] text-sm">
                  {fmtCurrency(data.total_taxable)}
                </td>
                <td className="font-mono font-bold text-[#1E3A5F] dark:text-slate-200 text-sm">
                  {fmtCurrency(data.total_cgst || Number(data.total_tax || 0) / 2)}
                </td>
                <td className="font-mono font-bold text-[#1E3A5F] dark:text-slate-200 text-sm">
                  {fmtCurrency(data.total_sgst || Number(data.total_tax || 0) / 2)}
                </td>
                <td className="font-mono font-bold text-teal-600 dark:text-teal-400 text-sm">
                  {fmtCurrency(data.total_tax)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Slab Breakdown Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)] px-4 py-3 sm:px-5 bg-[var(--surface-elevated)]">
          <h3 className="text-sm font-bold text-[var(--ink)]">
            GST Slab-wise Tax Liability (GSTR-1 Format)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>GST Rate Slab</th>
                <th className="text-right">Taxable Turnover</th>
                <th className="text-right">CGST</th>
                <th className="text-right">SGST</th>
                <th className="text-right">Total GST Tax</th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-[var(--muted)]">
                    No tax transactions recorded in this period.
                  </td>
                </tr>
              ) : (
                rates.map((r, i) => (
                  <tr key={i}>
                    <td className="font-bold">
                      <span className="rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] px-2 py-0.5 text-xs font-mono">
                        {r.gst_percent ?? 0}% GST
                      </span>
                    </td>
                    <td className="text-right font-mono">
                      {fmtCurrency(r.taxable)}
                    </td>
                    <td className="text-right font-mono text-[var(--muted)]">
                      {fmtCurrency(r.cgst || Number(r.tax || 0) / 2)}
                    </td>
                    <td className="text-right font-mono text-[var(--muted)]">
                      {fmtCurrency(r.sgst || Number(r.tax || 0) / 2)}
                    </td>
                    <td className="text-right font-mono font-bold text-teal-600 dark:text-teal-400">
                      {fmtCurrency(r.tax)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   5. CUSTOMER RECEIVABLES / CREDIT REPORT VIEW
========================================================= */
function CustomerReportView({ data }) {
  const rows = Array.isArray(data) ? data : data?.results || []

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
      <div className="border-b border-[var(--line)] px-4 py-3 sm:px-5 flex items-center justify-between bg-[var(--surface-elevated)]">
        <h3 className="text-sm font-bold text-[var(--ink)]">
          Customer Credit &amp; Outstanding Receivables
        </h3>
        <span className="text-xs text-[var(--muted)]">
          Total Receivables:{' '}
          <strong className="text-rose-600 font-mono">
            {fmtCurrency(
              rows.reduce(
                (sum, c) => sum + Number(c.outstanding_amount || 0),
                0,
              ),
            )}
          </strong>
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="erp-report-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th className="text-right">Credit Limit</th>
              <th className="text-right">Outstanding Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-[var(--muted)]">
                  No customers with outstanding credit balance.
                </td>
              </tr>
            ) : (
              rows.map((c, i) => (
                <tr key={i}>
                  <td className="font-semibold text-[var(--ink)]">{c.name}</td>
                  <td className="font-mono text-xs text-[var(--muted)]">
                    {c.mobile || '—'}
                  </td>
                  <td className="text-right font-mono text-[var(--muted)]">
                    {fmtCurrency(c.credit_limit)}
                  </td>
                  <td className="text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                    {fmtCurrency(c.outstanding_amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* =========================================================
   6. PAYMENT MODES REPORT VIEW
========================================================= */
function PaymentReportView({ data }) {
  const methods = Array.isArray(data.methods) ? data.methods : []

  return (
    <div className="space-y-4">
      {/* Payment Summary */}
      <div className="erp-table-container">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--surface-elevated)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Total Payment Collections Summary
          </span>
          <span className="font-mono text-sm font-bold text-teal-600 dark:text-teal-400">
            {fmtCurrency(data.total_amount)}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)] px-4 py-3 sm:px-5 bg-[var(--surface-elevated)]">
          <h3 className="text-sm font-bold text-[var(--ink)]">
            Collections by Payment Channel
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Payment Mode</th>
                <th className="text-right">Number of Transactions</th>
                <th className="text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {methods.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-[var(--muted)]">
                    No payments recorded in this date range.
                  </td>
                </tr>
              ) : (
                methods.map((m, i) => (
                  <tr key={i}>
                    <td className="font-semibold capitalize text-[var(--ink)]">
                      {m.method || m.payment_method}
                    </td>
                    <td className="text-right font-mono font-medium">
                      {m.count}
                    </td>
                    <td className="text-right font-mono font-bold text-teal-600 dark:text-teal-400">
                      {fmtCurrency(m.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   7. OPERATING EXPENSES REPORT VIEW
========================================================= */
function ExpenseReportView({ data }) {
  const categories = Array.isArray(data.categories) ? data.categories : []

  return (
    <div className="space-y-4">
      {/* Expense Summary */}
      <div className="erp-table-container">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--surface-elevated)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Total Operating Expenses Summary
          </span>
          <span className="font-mono text-sm font-bold text-rose-600 dark:text-rose-400">
            {fmtCurrency(data.total_expenses)}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)] px-4 py-3 sm:px-5 bg-[var(--surface-elevated)]">
          <h3 className="text-sm font-bold text-[var(--ink)]">
            Expense Breakdown by Category
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Expense Category</th>
                <th className="text-right">Transactions</th>
                <th className="text-right">Total Expense Amount</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-[var(--muted)]">
                    No expenses recorded in this period.
                  </td>
                </tr>
              ) : (
                categories.map((c, i) => (
                  <tr key={i}>
                    <td className="font-semibold text-[var(--ink)]">
                      {c.category__name || c.name || 'General Expense'}
                    </td>
                    <td className="text-right font-mono">{c.count}</td>
                    <td className="text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      {fmtCurrency(c.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
