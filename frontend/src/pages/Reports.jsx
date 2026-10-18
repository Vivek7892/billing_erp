import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api'
import { PageHeader, Spinner } from '../components/UI'
import {
  TrendingUp,
  Package,
  DollarSign,
  Percent,
  Users,
  CreditCard,
  Receipt,
  Calendar,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  Info,
  RotateCcw,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import toast from 'react-hot-toast'

/* ============================================================
   FORMATTING UTILITIES
============================================================ */
const fmtCurrency = v =>
  `₹${Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const fmtNumber = v =>
  Number(v || 0).toLocaleString('en-IN')

const formatDateInput = value => {
  if (!value) return ''
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

const parseDateInput = value => {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length !== 8) return null
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null
  }
  return `${year}-${month}-${day}`
}

function ReportDateField({ label, value, min, max, onChange, id }) {
  const [draft, setDraft] = useState(formatDateInput(value))
  const dateInputRef = useRef(null)

  useEffect(() => {
    setDraft(formatDateInput(value))
  }, [value])

  const commit = nextValue => {
    const formatted = nextValue.replace(/\D/g, '').slice(0, 8)
    const display =
      formatted.length > 4
        ? `${formatted.slice(0, 2)}/${formatted.slice(2, 4)}/${formatted.slice(4)}`
        : formatted.length > 2
          ? `${formatted.slice(0, 2)}/${formatted.slice(2)}`
          : formatted
    setDraft(display)
    if (formatted.length === 8) {
      const parsed = parseDateInput(display)
      if (parsed && (!min || parsed >= min) && (!max || parsed <= max)) {
        onChange(parsed)
      }
    }
  }

  const triggerCalendar = () => {
    if (dateInputRef.current) {
      if (typeof dateInputRef.current.showPicker === 'function') {
        dateInputRef.current.showPicker()
      } else {
        dateInputRef.current.focus()
      }
    }
  }

  return (
   <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-none">
      <label
        htmlFor={id}
        className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={event => commit(event.target.value)}
          onBlur={() => setDraft(formatDateInput(value))}
          placeholder="DD/MM/YYYY"
          aria-label={`${label} date in DD/MM/YYYY format`}
         className="input h-8 min-h-8 w-full min-w-0 pr-7 text-xs font-mono font-semibold tracking-wide sm:w-28 focus:ring-1 focus:ring-[#1E3A5F]"
        />
        <input
          ref={dateInputRef}
          type="date"
          value={value || ''}
          min={min}
          max={max}
          onChange={e => {
            if (e.target.value) onChange(e.target.value)
          }}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={triggerCalendar}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[var(--muted)] hover:text-[#1E3A5F] dark:hover:text-slate-200"
          title="Open calendar picker"
          aria-label="Open calendar picker"
        >
          <Calendar size={14} />
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   CONFIG & TABS
============================================================ */
const getToday = () => new Date().toISOString().slice(0, 10)
const getMonthStart = () =>
  new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10)
const getLast30Days = () =>
  new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
const getLast90Days = () =>
  new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10)

const TABS = [
  { key: 'sales', label: 'Sales Summary', icon: TrendingUp },
  { key: 'products', label: 'Product Sales', icon: Package },
  { key: 'profit', label: 'Profit & Loss', icon: DollarSign },
  { key: 'gst', label: 'GST Tax Summary', icon: Percent },
  { key: 'customers', label: 'Customer Receivables', icon: Users },
  { key: 'payments', label: 'Payment Modes', icon: CreditCard },
  { key: 'expenses', label: 'Operating Expenses', icon: Receipt },
]

const ENDPOINTS = {
  sales: '/reports/sales/',
  products: '/reports/products/',
  profit: '/reports/profit/',
  gst: '/reports/gst/',
  customers: '/reports/customers/',
  payments: '/reports/payments/',
  expenses: '/reports/expenses/',
}

const REPORT_FILENAMES = {
  sales: 'sales_summary_report',
  products: 'product_sales_report',
  profit: 'profit_and_loss_report',
  gst: 'gst_tax_summary_report',
  customers: 'customer_receivables_report',
  payments: 'payment_modes_report',
  expenses: 'operating_expenses_report',
}

export default function Reports() {
  const [tab, setTab] = useState('sales')
  const [startDate, setStartDate] = useState(getMonthStart())
  const [endDate, setEndDate] = useState(getToday())
  const [appliedDates, setAppliedDates] = useState({
    start: getMonthStart(),
    end: getToday(),
  })

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')

  const activeRequestRef = useRef(0)
  const abortControllerRef = useRef(null)

  // Validation
  const isDateInvalid = tab !== 'customers' && startDate > endDate

  const fetchReport = useCallback(
    async (targetTab, dates) => {
      if (targetTab !== 'customers' && dates.start > dates.end) {
        setError('Start date cannot be after end date.')
        return
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      const controller = new AbortController()
      abortControllerRef.current = controller

      const reqId = ++activeRequestRef.current
      setLoading(true)
      setError('')

      try {
        const params =
          targetTab === 'customers'
            ? ''
            : `?start_date=${dates.start}&end_date=${dates.end}`

        const response = await api.get(`${ENDPOINTS[targetTab]}${params}`, {
          signal: controller.signal,
        })

        if (reqId === activeRequestRef.current) {
          setData(response.data)
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          return
        }
        if (reqId === activeRequestRef.current) {
          const msg =
            err.response?.status === 403
              ? 'Reports are restricted to administrator and accountant roles.'
              : err.response?.data?.detail ||
                'Failed to load report from server. Please try again.'
          setError(msg)
          setData(null)
        }
      } finally {
        if (reqId === activeRequestRef.current) {
          setLoading(false)
        }
      }
    },
    [],
  )

  useEffect(() => {
    fetchReport(tab, appliedDates)
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [tab, appliedDates, fetchReport])

  const handleApplyFilters = () => {
    if (isDateInvalid) return
    setAppliedDates({ start: startDate, end: endDate })
  }

  const handleResetFilters = () => {
    const s = getMonthStart()
    const e = getToday()
    setStartDate(s)
    setEndDate(e)
    setAppliedDates({ start: s, end: e })
  }

  const handlePreset = (s, e) => {
    setStartDate(s)
    setEndDate(e)
    setAppliedDates({ start: s, end: e })
  }

  const handleExport = async format => {
    if (tab !== 'customers' && appliedDates.start > appliedDates.end) {
      toast.error('Start date cannot be after end date')
      return
    }

    setExporting(format)
    try {
      const params = new URLSearchParams()
      if (tab !== 'customers') {
        params.set('start_date', appliedDates.start)
        params.set('end_date', appliedDates.end)
      }
      params.set('export', format)

      const response = await api.get(`${ENDPOINTS[tab]}?${params.toString()}`, {
        responseType: 'blob',
      })

      const mimeType =
        response.headers['content-type'] ||
        (format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      const blob = new Blob([response.data], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${REPORT_FILENAMES[tab]}_${getToday()}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success(
        `Report exported as ${format === 'pdf' ? 'PDF' : 'Excel spreadsheet'}`,
      )
    } catch {
      toast.error('Failed to export report')
    } finally {
      setExporting('')
    }
  }

  return (
    <div className="reports-page w-full min-w-0 space-y-4 pb-12 text-[var(--ink)]">
      <style>{`
        .reports-page .erp-report-table {
          width: 100%;
          min-width: 640px;
          border-collapse: collapse;
          font-family: "Inter", Arial, sans-serif;
          font-variant-numeric: tabular-nums;
          background: var(--surface);
        }

        .reports-page .erp-report-table th {
          padding: 9px 12px;
          text-align: left;
          white-space: nowrap;
          background: var(--table-header-bg);
          border-bottom: 1px solid var(--line);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0;
          color: var(--ink-secondary);
          border-right: 1px solid var(--line-subtle);
        }

        .reports-page .erp-report-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--line-subtle);
          vertical-align: middle;
          font-size: 14px;
          border-right: 1px solid var(--line-subtle);
        }

        .reports-page .erp-report-table tbody tr:hover {
          background: rgba(15, 23, 42, 0.02);
        }

        .dark .reports-page .erp-report-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .reports-page .erp-report-table tfoot td {
          padding: 11px 12px;
          border-top: 2px solid var(--line);
          background: var(--table-header-bg);
          font-weight: 700;
          font-size: 13px;
        }

        .reports-page .summary-strip-table {
          width: 100%;
          min-width: 640px;
          border-collapse: collapse;
          font-family: "Inter", Arial, sans-serif;
          background: var(--surface);
        }

        .reports-page .summary-strip-table th {
          padding: 8px 12px;
          background: var(--table-header-bg);
          border-bottom: 1px solid var(--line);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0;
          color: var(--ink-secondary);
          border-right: 1px solid var(--line-subtle);
          text-align: left;
        }

        .reports-page .summary-strip-table td {
          padding: 9px 12px;
          font-size: 14px;
          border-right: 1px solid var(--line-subtle);
          border-bottom: 1px solid var(--line-subtle);
        }
      `}</style>

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}
      <PageHeader
        title="Business Reports"
        subtitle="Sales, tax, payments, and operating summaries for your selected period."
        action={
          <div className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2">
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={Boolean(exporting) || loading}
              className="btn-secondary inline-flex h-8 min-w-0 items-center justify-center gap-1 px-2 text-[11px] font-semibold sm:h-9 sm:gap-1.5 sm:px-3 sm:text-xs"
              title="Download formal black-and-white A4 PDF Report"
            >
              <FileText size={14} className="text-slate-700 dark:text-slate-300" />
              <span className="truncate">{exporting === 'pdf' ? 'Generating PDF…' : 'Export PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport('xlsx')}
              disabled={Boolean(exporting) || loading}
              className="btn-secondary inline-flex h-8 min-w-0 items-center justify-center gap-1 px-2 text-[11px] font-semibold sm:h-9 sm:gap-1.5 sm:px-3 sm:text-xs"
              title="Download formatted Excel workbook"
            >
              <FileSpreadsheet size={14} className="text-slate-700 dark:text-slate-300" />
              <span className="truncate">{exporting === 'xlsx' ? 'Generating Excel…' : 'Export Excel'}</span>
            </button>
            <button
              type="button"
              onClick={() => fetchReport(tab, appliedDates)}
              disabled={loading}
              className="btn-secondary inline-flex h-8 min-w-0 items-center justify-center gap-1 px-2 text-[11px] font-semibold sm:h-9 sm:gap-1.5 sm:px-3 sm:text-xs"
              title="Refresh report data"
              aria-label="Refresh report data"
            >
              <RefreshCw
                size={14}
                className={loading ? 'animate-spin text-[#1E3A5F]' : 'text-[var(--muted)]'}
              />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* =====================================================
          CATEGORY NAVIGATION TABS
      ====================================================== */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xs">
        <div
          role="tablist"
          aria-label="Report Categories"
          className="scrollbar-none flex snap-x items-center gap-1.5 overflow-x-auto pb-0.5"
        >
          {TABS.map(t => {
            const Icon = t.icon
            const isActive = tab === t.key
            return (
              <button
                key={t.key}
                role="tab"
                id={`tab-${t.key}`}
                aria-selected={isActive}
                aria-controls={`panel-${t.key}`}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#1E3A5F] text-white shadow-xs'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* =====================================================
          DATE RANGE & FILTER CONTROLS
      ====================================================== */}
      {tab !== 'customers' ? (
  <section
    className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 shadow-xs sm:px-2.5"
    aria-label="Report date filters"
  >
    <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">

      {/* Date presets */}
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
        <Calendar
          size={13}
          className="shrink-0 text-[var(--muted)]"
        />

        {[
          ['Today', getToday(), getToday()],
          ['This Month', getMonthStart(), getToday()],
          ['Last 30 Days', getLast30Days(), getToday()],
          ['Last 90 Days', getLast90Days(), getToday()],
        ].map(([label, fDate, tDate]) => {
          const isSelected =
            appliedDates.start === fDate &&
            appliedDates.end === tDate

          return (
            <button
              key={label}
              type="button"
              onClick={() => handlePreset(fDate, tDate)}
              className={`h-7 whitespace-nowrap rounded-md px-2 text-[10px] font-medium transition-colors ${
                isSelected
                  ? 'bg-[#1E3A5F] text-white font-semibold'
                  : 'bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Custom date range + actions */}
      <div className="flex shrink-0 items-end gap-1">
        <ReportDateField
          id="report-from-date"
          label="Start Date"
          value={startDate}
          max={endDate}
          onChange={setStartDate}
        />

        <ReportDateField
          id="report-to-date"
          label="End Date"
          value={endDate}
          min={startDate}
          onChange={setEndDate}
        />

        <button
          type="button"
          onClick={handleApplyFilters}
          disabled={isDateInvalid || loading}
          className="btn-primary h-8 min-h-8 min-w-14 px-2 text-[10px] font-semibold justify-center whitespace-nowrap"
        >
          Apply
        </button>

        <button
          type="button"
          onClick={handleResetFilters}
          disabled={loading}
          title="Reset date filter to This Month"
          aria-label="Reset date range to this month"
          className="btn-secondary inline-flex h-8 min-h-8 items-center gap-1 px-2 text-[10px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
        >
          <RotateCcw
            size={12}
          />
          <span>Reset</span>
        </button>
      </div>
    </div>

    {isDateInvalid && (
      <p
        className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-rose-600"
        role="alert"
      >
        <AlertCircle size={12} />
        Start date cannot be after end date.
      </p>
    )}
  </section>
) : (
  <div className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-2 text-[11px] text-[var(--muted)]">
    <Info
      size={13}
      className="shrink-0 text-[#1E3A5F] dark:text-slate-300"
    />
    <span>
      Customer receivables reflect real-time outstanding ledger amounts as of today.
      Date range filtering does not apply.
    </span>
  </div>
)}

      {/* =====================================================
          REPORT BODY CONTENT
      ====================================================== */}
      <div
        id={`panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className="space-y-4"
      >
        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-xs">
            <Spinner />
            <p className="text-xs text-[var(--muted)]">Generating report...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-xs">
            <AlertCircle className="mx-auto mb-2 text-rose-500" size={30} />
            <h3 className="text-sm font-bold text-[var(--ink)]">
              Unable to Load Report
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">{error}</p>
            <button
              type="button"
              onClick={() => fetchReport(tab, appliedDates)}
              className="btn-secondary btn-base mt-4"
            >
              Try Again
            </button>
          </div>
        ) : data ? (
          <div>
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
      <footer className="flex flex-col gap-1 border-t border-[var(--line)] pt-3 text-[11px] text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
        <span>{tab === 'customers' ? 'Receivables are current as of today.' : `Reporting period: ${formatDateInput(appliedDates.start)} – ${formatDateInput(appliedDates.end)}`}</span>
        <span>Amounts are shown in INR</span>
      </footer>
    </div>
  )
}

/* =========================================================
   1. SALES SUMMARY REPORT VIEW
========================================================= */
function SalesReportView({ data }) {
  const summary = data?.summary || {}
  const daily = Array.isArray(data?.daily) ? data.daily : []

  const totalInvoices = Number(summary.count || 0)
  const totalSales = Number(summary.gross_sales || summary.total_sales || 0)

  return (
    <div className="space-y-4">
      {/* Executive Summary Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--surface-subtle)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Sales Performance Overview
          </span>
          <span className="text-xs font-mono text-[var(--muted)]">
            {totalInvoices} completed bill{totalInvoices !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="summary-strip-table">
            <thead>
              <tr>
                <th>Gross Invoiced Sales</th>
                <th>Total Discounts</th>
                <th>Sales Returns</th>
                <th>Net Sales Revenue</th>
                <th>Output GST Tax</th>
                <th>Total Collections</th>
                <th>Outstanding Balance</th>
                <th className="text-right">Invoices</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-[var(--ink)]">
                  {fmtCurrency(totalSales)}
                </td>
                <td className="font-mono text-[var(--muted)]">
                  {fmtCurrency(summary.total_discount)}
                </td>
                <td className="font-mono text-[var(--muted)]">
                  {fmtCurrency(summary.returns)}
                </td>
                <td className="font-mono font-bold text-teal-700 dark:text-teal-400">
                  {fmtCurrency(summary.net_sales || totalSales)}
                </td>
                <td className="font-mono text-[var(--ink)]">
                  {fmtCurrency(summary.total_tax)}
                </td>
                <td className="font-mono font-bold text-[var(--ink)]">
                  {fmtCurrency(summary.collection)}
                </td>
                <td className="font-mono font-bold text-rose-700 dark:text-rose-400">
                  {fmtCurrency(summary.outstanding)}
                </td>
                <td className="text-right font-mono font-semibold text-[var(--ink)]">
                  {fmtNumber(totalInvoices)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Daily Breakdown Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-3 bg-[var(--surface-subtle)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Daily Sales Transactions
          </h3>
          <span className="text-xs font-mono text-[var(--muted)]">
            {daily.length} day{daily.length !== 1 ? 's' : ''} recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="text-right">Invoices Completed</th>
                <th className="text-right">Total Invoiced Sales</th>
              </tr>
            </thead>
            <tbody>
              {daily.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-xs text-[var(--muted)]">
                    No sales recorded in the selected period.
                  </td>
                </tr>
              ) : (
                daily.map((row, idx) => (
                  <tr key={idx}>
                    <td className="font-mono font-medium text-[var(--ink)]">
                      {row.created_at__date}
                    </td>
                    <td className="text-right font-mono text-[var(--ink)]">
                      {fmtNumber(row.count)}
                    </td>
                    <td className="text-right font-mono font-bold text-[var(--ink)]">
                      {fmtCurrency(row.total)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {daily.length > 0 && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="text-right font-mono">
                    {fmtNumber(daily.reduce((sum, r) => sum + Number(r.count || 0), 0))}
                  </td>
                  <td className="text-right font-mono text-teal-700 dark:text-teal-400">
                    {fmtCurrency(daily.reduce((sum, r) => sum + Number(r.total || 0), 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Daily Sales Trend Chart */}
      {daily.length > 1 && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs">
          <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Daily Sales Revenue Trend
          </h4>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-subtle)" />
                <XAxis
                  dataKey="created_at__date"
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickFormatter={v => `₹${v}`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={v => [fmtCurrency(v), 'Sales']}
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
                  stroke="#1E3A5F"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: '#1E3A5F' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   2. PRODUCT SALES REPORT VIEW
========================================================= */
function ProductReportView({ data }) {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.products)
      ? data.products
      : Array.isArray(data?.results)
        ? data.results
        : []

  const summary = data?.summary || {}
  const totalQty =
    summary.total_qty ?? rows.reduce((sum, r) => sum + Number(r.total_qty || 0), 0)
  const totalRevenue =
    summary.total_revenue ??
    rows.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0)

  return (
    <div className="space-y-4">
      {/* Product Summary Overview */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--surface-subtle)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Product Sales Performance Summary
          </span>
          <span className="text-xs font-mono text-[var(--muted)]">
            {rows.length} product{rows.length !== 1 ? 's' : ''} sold
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="summary-strip-table">
            <thead>
              <tr>
                <th>Total Unique Products</th>
                <th className="text-right">Total Units Sold</th>
                <th className="text-right">Total Product Revenue</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-semibold text-[var(--ink)]">
                  {fmtNumber(rows.length)}
                </td>
                <td className="text-right font-mono font-bold text-[var(--ink)]">
                  {fmtNumber(totalQty)}
                </td>
                <td className="text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                  {fmtCurrency(totalRevenue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Product Sales Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-3 bg-[var(--surface-subtle)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Item-wise Sales Breakdown
          </h3>
          <span className="text-xs font-mono text-[var(--muted)]">Sorted by Quantity Sold</span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU</th>
                <th className="text-right">Quantity Sold</th>
                <th className="text-right">Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-[var(--muted)]">
                    No product sales recorded in the selected period.
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
                    <td className="text-right font-mono font-medium text-[var(--ink)]">
                      {fmtNumber(r.total_qty)}
                    </td>
                    <td className="text-right font-mono font-bold text-[var(--ink)]">
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
                    {fmtNumber(totalQty)}
                  </td>
                  <td className="text-right font-mono text-teal-700 dark:text-teal-400">
                    {fmtCurrency(totalRevenue)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   3. PROFIT & LOSS REPORT VIEW
========================================================= */
function ProfitReportView({ data }) {
  const items = Array.isArray(data?.items) ? data.items : []

  const grossSales = Number(data?.gross_sales || 0)
  const netRevenue = Number(data?.net_revenue ?? data?.total_revenue ?? 0)
  const cogs = Number(data?.total_cogs ?? data?.total_cost ?? 0)
  const grossProfit = Number(data?.gross_profit ?? data?.total_profit ?? (netRevenue - cogs))
  const grossMargin = data?.gross_margin ?? (netRevenue > 0 ? ((grossProfit / netRevenue) * 100).toFixed(1) : 0)
  const expenses = Number(data?.expenses ?? data?.operating_expenses ?? 0)
  const returns = Number(data?.sales_returns ?? 0)
  const netProfit = Number(data?.net_profit ?? (grossProfit - expenses - returns))
  const netMargin = data?.net_margin ?? (netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(1) : 0)

  return (
    <div className="space-y-4">
      {/* Executive Financial Statement Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--surface-subtle)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Profit &amp; Loss Statement Overview
          </span>
          <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">
            {grossMargin}% Gross Margin | {netMargin}% Net Margin
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="summary-strip-table">
            <thead>
              <tr>
                <th>Gross Invoiced Sales</th>
                <th>Net Revenue</th>
                <th>Cost of Goods Sold (COGS)</th>
                <th>Gross Profit</th>
                <th>Gross Margin</th>
                <th>Operating Expenses</th>
                <th>Sales Returns</th>
                <th>Net Profit</th>
                <th className="text-right">Net Margin</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono text-[var(--ink)]">
                  {fmtCurrency(grossSales)}
                </td>
                <td className="font-mono font-bold text-[var(--ink)]">
                  {fmtCurrency(netRevenue)}
                </td>
                <td className="font-mono text-[var(--muted)]">
                  {fmtCurrency(cogs)}
                </td>
                <td className="font-mono font-bold text-teal-700 dark:text-teal-400">
                  {fmtCurrency(grossProfit)}
                </td>
                <td className="font-mono font-semibold text-teal-700 dark:text-teal-400">
                  {grossMargin}%
                </td>
                <td className="font-mono text-rose-700 dark:text-rose-400">
                  {fmtCurrency(expenses)}
                </td>
                <td className="font-mono text-[var(--muted)]">
                  {fmtCurrency(returns)}
                </td>
                <td className="font-mono font-bold text-teal-700 dark:text-teal-400">
                  {fmtCurrency(netProfit)}
                </td>
                <td className="text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                  {netMargin}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Product Profitability Breakdown */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-3 bg-[var(--surface-subtle)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Item-wise Profitability Breakdown
          </h3>
          <span className="text-xs font-mono text-[var(--muted)]">
            {items.length} item{items.length !== 1 ? 's' : ''} sold
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>SKU</th>
                <th className="text-right">Quantity</th>
                <th className="text-right">Net Revenue</th>
                <th className="text-right">Cost (COGS)</th>
                <th className="text-right">Gross Profit</th>
                <th className="text-right">Margin (%)</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[var(--muted)]">
                    No sales items recorded in the selected date range.
                  </td>
                </tr>
              ) : (
                items.map((it, i) => {
                  const rev = Number(it.revenue || 0)
                  const prf = Number(it.profit || 0)
                  const itemMargin = rev > 0 ? ((prf / rev) * 100).toFixed(1) : 0
                  return (
                    <tr key={i}>
                      <td className="font-semibold text-[var(--ink)]">
                        {it.product}
                      </td>
                      <td className="font-mono text-xs text-[var(--muted)]">
                        {it.sku || '—'}
                      </td>
                      <td className="text-right font-mono text-[var(--ink)]">
                        {fmtNumber(it.qty)}
                      </td>
                      <td className="text-right font-mono font-medium text-[var(--ink)]">
                        {fmtCurrency(it.revenue)}
                      </td>
                      <td className="text-right font-mono text-[var(--muted)]">
                        {fmtCurrency(it.cost)}
                      </td>
                      <td className="text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                        {fmtCurrency(it.profit)}
                      </td>
                      <td className="text-right font-mono text-xs font-semibold text-[var(--ink)]">
                        {itemMargin}%
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>Grand Total</td>
                  <td className="text-right font-mono">
                    {fmtNumber(items.reduce((s, r) => s + Number(r.qty || 0), 0))}
                  </td>
                  <td className="text-right font-mono">
                    {fmtCurrency(items.reduce((s, r) => s + Number(r.revenue || 0), 0))}
                  </td>
                  <td className="text-right font-mono">
                    {fmtCurrency(items.reduce((s, r) => s + Number(r.cost || 0), 0))}
                  </td>
                  <td className="text-right font-mono text-teal-700 dark:text-teal-400">
                    {fmtCurrency(items.reduce((s, r) => s + Number(r.profit || 0), 0))}
                  </td>
                  <td className="text-right font-mono text-teal-700 dark:text-teal-400">
                    {grossMargin}%
                  </td>
                </tr>
              </tfoot>
            )}
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
  const rates = Array.isArray(data?.rates)
    ? data.rates
    : Array.isArray(data?.by_rate)
      ? data.by_rate
      : []

  const totalTaxable = Number(
    data?.total_taxable ??
      rates.reduce((sum, r) => sum + Number(r.taxable || r.taxable_amount || 0), 0),
  )
  const totalTax = Number(
    data?.total_tax ??
      data?.total_gst ??
      rates.reduce((sum, r) => sum + Number(r.tax || r.gst_collected || 0), 0),
  )
  const totalCgst = Number(data?.total_cgst ?? totalTax / 2)
  const totalSgst = Number(data?.total_sgst ?? totalTax / 2)

  return (
    <div className="space-y-4">
      {/* GST Executive Liability Overview */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--surface-subtle)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            GST Output Tax Liability (GSTR-1 Format)
          </span>
          <span className="text-xs font-mono text-[var(--muted)]">
            CGST + SGST Breakdown
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="summary-strip-table">
            <thead>
              <tr>
                <th>Taxable Turnover</th>
                <th className="text-right">Output CGST</th>
                <th className="text-right">Output SGST</th>
                <th className="text-right">Total Output GST Tax</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-[var(--ink)]">
                  {fmtCurrency(totalTaxable)}
                </td>
                <td className="text-right font-mono text-[var(--ink)]">
                  {fmtCurrency(totalCgst)}
                </td>
                <td className="text-right font-mono text-[var(--ink)]">
                  {fmtCurrency(totalSgst)}
                </td>
                <td className="text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                  {fmtCurrency(totalTax)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Slab Breakdown Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-3 bg-[var(--surface-subtle)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Slab-wise GST Liability
          </h3>
          <span className="text-xs font-mono text-[var(--muted)]">
            {rates.length} active tax slab{rates.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>GST Rate Slab</th>
                <th className="text-right">Taxable Turnover</th>
                <th className="text-right">Output CGST</th>
                <th className="text-right">Output SGST</th>
                <th className="text-right">Total GST Tax</th>
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-[var(--muted)]">
                    No GST tax transactions recorded in this period.
                  </td>
                </tr>
              ) : (
                rates.map((r, i) => {
                  const taxable = Number(r.taxable || r.taxable_amount || 0)
                  const tax = Number(r.tax || r.gst_collected || 0)
                  const cgst = Number(r.cgst || tax / 2)
                  const sgst = Number(r.sgst || tax / 2)
                  return (
                    <tr key={i}>
                      <td className="font-bold text-[var(--ink)]">
                        <span className="rounded border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-0.5 font-mono text-xs">
                          {r.gst_percent ?? 0}% GST
                        </span>
                      </td>
                      <td className="text-right font-mono font-medium text-[var(--ink)]">
                        {fmtCurrency(taxable)}
                      </td>
                      <td className="text-right font-mono text-[var(--muted)]">
                        {fmtCurrency(cgst)}
                      </td>
                      <td className="text-right font-mono text-[var(--muted)]">
                        {fmtCurrency(sgst)}
                      </td>
                      <td className="text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                        {fmtCurrency(tax)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {rates.length > 0 && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="text-right font-mono">
                    {fmtCurrency(totalTaxable)}
                  </td>
                  <td className="text-right font-mono">
                    {fmtCurrency(totalCgst)}
                  </td>
                  <td className="text-right font-mono">
                    {fmtCurrency(totalSgst)}
                  </td>
                  <td className="text-right font-mono text-teal-700 dark:text-teal-400">
                    {fmtCurrency(totalTax)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   5. CUSTOMER RECEIVABLES REPORT VIEW
========================================================= */
function CustomerReportView({ data }) {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.customers)
      ? data.customers
      : Array.isArray(data?.results)
        ? data.results
        : []

  const totalOutstanding = Number(
    data?.total_outstanding ??
      rows.reduce((sum, c) => sum + Number(c.outstanding_amount || 0), 0),
  )

  return (
    <div className="space-y-4">
      {/* Executive Receivables Summary */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--surface-subtle)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Receivables Summary
          </span>
          <span className="text-xs font-mono text-[var(--muted)]">
            {rows.length} customer{rows.length !== 1 ? 's' : ''} with balance
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="summary-strip-table">
            <thead>
              <tr>
                <th>Total Outstanding Receivables</th>
                <th className="text-right">Customers with Due Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-rose-700 dark:text-rose-400">
                  {fmtCurrency(totalOutstanding)}
                </td>
                <td className="text-right font-mono font-semibold text-[var(--ink)]">
                  {fmtNumber(rows.length)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Credit Detailed Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-3 bg-[var(--surface-subtle)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Customer Credit Ledger Balance
          </h3>
          <span className="text-xs font-mono text-[var(--muted)]">
            Sorted by Outstanding Balance
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Mobile Number</th>
                <th className="text-right">Credit Limit</th>
                <th className="text-right">Outstanding Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-[var(--muted)]">
                    No customers with outstanding credit balance.
                  </td>
                </tr>
              ) : (
                rows.map((c, i) => (
                  <tr key={i}>
                    <td className="font-semibold text-[var(--ink)]">
                      {c.name}
                    </td>
                    <td className="font-mono text-xs text-[var(--muted)]">
                      {c.mobile || '—'}
                    </td>
                    <td className="text-right font-mono text-[var(--muted)]">
                      {fmtCurrency(c.credit_limit)}
                    </td>
                    <td className="text-right font-mono font-bold text-rose-700 dark:text-rose-400">
                      {fmtCurrency(c.outstanding_amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Total Outstanding Balance</td>
                  <td className="text-right font-mono text-rose-700 dark:text-rose-400">
                    {fmtCurrency(totalOutstanding)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   6. PAYMENT MODES REPORT VIEW
========================================================= */
function PaymentReportView({ data }) {
  const methods = Array.isArray(data?.methods) ? data.methods : []
  const totalAmount = Number(
    data?.total_amount ?? methods.reduce((s, m) => s + Number(m.total || 0), 0),
  )
  const totalCount = Number(
    data?.total_count ?? methods.reduce((s, m) => s + Number(m.count || 0), 0),
  )

  return (
    <div className="space-y-4">
      {/* Executive Payment Summary */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--surface-subtle)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Total Collections Summary
          </span>
          <span className="text-xs font-mono text-[var(--muted)]">
            {fmtNumber(totalCount)} total transactions
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="summary-strip-table">
            <thead>
              <tr>
                <th>Total Collections</th>
                <th className="text-right">Total Transactions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-teal-700 dark:text-teal-400">
                  {fmtCurrency(totalAmount)}
                </td>
                <td className="text-right font-mono font-semibold text-[var(--ink)]">
                  {fmtNumber(totalCount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Single Unified Table for Desktop and Mobile */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-3 bg-[var(--surface-subtle)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Collections by Payment Channel
          </h3>
          <span className="text-xs font-mono text-[var(--muted)]">
            {methods.length} payment method{methods.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Payment Channel</th>
                <th className="text-right">Number of Transactions</th>
                <th className="text-right">Total Amount Collected</th>
                <th className="text-right">Share of Collections</th>
              </tr>
            </thead>
            <tbody>
              {methods.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-[var(--muted)]">
                    No payments recorded in this date range.
                  </td>
                </tr>
              ) : (
                methods.map((m, i) => (
                  <tr key={i}>
                    <td className="font-semibold text-[var(--ink)]">
                      {m.method || m.payment_method}
                    </td>
                    <td className="text-right font-mono text-[var(--ink)]">
                      {fmtNumber(m.count)}
                    </td>
                    <td className="text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                      {fmtCurrency(m.total)}
                    </td>
                    <td className="text-right font-mono text-xs font-semibold text-[var(--muted)]">
                      {m.share_pct ?? (totalAmount ? ((Number(m.total || 0) / totalAmount) * 100).toFixed(1) : 0)}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {methods.length > 0 && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="text-right font-mono">
                    {fmtNumber(totalCount)}
                  </td>
                  <td className="text-right font-mono text-teal-700 dark:text-teal-400">
                    {fmtCurrency(totalAmount)}
                  </td>
                  <td className="text-right font-mono text-teal-700 dark:text-teal-400">
                    100.0%
                  </td>
                </tr>
              </tfoot>
            )}
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
  const categories = Array.isArray(data?.categories)
    ? data.categories
    : Array.isArray(data?.by_category)
      ? data.by_category
      : []

  const expenses = Array.isArray(data?.expenses) ? data.expenses : []

  const totalExpenses = Number(
    data?.total_expenses ??
      data?.summary?.total_amount ??
      categories.reduce((s, c) => s + Number(c.total || 0), 0),
  )
  const totalCount = Number(
    data?.summary?.count ??
      categories.reduce((s, c) => s + Number(c.count || 0), expenses.length),
  )
  const avgAmount = Number(
    data?.summary?.avg_amount ?? (totalCount > 0 ? totalExpenses / totalCount : 0),
  )

  return (
    <div className="space-y-4">
      {/* Executive Summary Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--surface-subtle)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Operating Expenses Summary
          </span>
          <span className="text-xs font-mono text-[var(--muted)]">
            {fmtNumber(totalCount)} total entries
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="summary-strip-table">
            <thead>
              <tr>
                <th>Total Operating Expenses</th>
                <th className="text-right">Number of Entries</th>
                <th className="text-right">Average per Entry</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-rose-700 dark:text-rose-400">
                  {fmtCurrency(totalExpenses)}
                </td>
                <td className="text-right font-mono font-semibold text-[var(--ink)]">
                  {fmtNumber(totalCount)}
                </td>
                <td className="text-right font-mono text-[var(--ink)]">
                  {fmtCurrency(avgAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-3 bg-[var(--surface-subtle)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
            Expense Breakdown by Category
          </h3>
          <span className="text-xs font-mono text-[var(--muted)]">
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Expense Category</th>
                <th className="text-right">Number of Entries</th>
                <th className="text-right">Total Amount</th>
                <th className="text-right">Share (%)</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-[var(--muted)]">
                    No expense records in this period.
                  </td>
                </tr>
              ) : (
                categories.map((c, i) => {
                  const catTotal = Number(c.total || 0)
                  const share = totalExpenses > 0 ? ((catTotal / totalExpenses) * 100).toFixed(1) : 0
                  return (
                    <tr key={i}>
                      <td className="font-semibold text-[var(--ink)]">
                        {c.category || c.name || c.category__name || 'General Expense'}
                      </td>
                      <td className="text-right font-mono text-[var(--ink)]">
                        {fmtNumber(c.count)}
                      </td>
                      <td className="text-right font-mono font-bold text-rose-700 dark:text-rose-400">
                        {fmtCurrency(catTotal)}
                      </td>
                      <td className="text-right font-mono text-xs font-semibold text-[var(--muted)]">
                        {share}%
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {categories.length > 0 && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="text-right font-mono">
                    {fmtNumber(totalCount)}
                  </td>
                  <td className="text-right font-mono text-rose-700 dark:text-rose-400">
                    {fmtCurrency(totalExpenses)}
                  </td>
                  <td className="text-right font-mono text-rose-700 dark:text-rose-400">
                    100.0%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Detailed Expense Transactions Itemization */}
      {expenses.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
          <div className="border-b border-[var(--line)] px-4 py-3 bg-[var(--surface-subtle)] flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Expense Itemization
            </h3>
            <span className="text-xs font-mono text-[var(--muted)]">
              {expenses.length} transaction{expenses.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="erp-report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Payment Method</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp, idx) => (
                  <tr key={idx}>
                    <td className="font-mono text-xs font-medium text-[var(--ink)]">
                      {exp.expense_date}
                    </td>
                    <td className="font-medium text-[var(--ink)]">
                      {exp.description || '—'}
                    </td>
                    <td className="text-[var(--muted)]">
                      {exp.category || 'General Expense'}
                    </td>
                    <td className="text-[var(--muted)] capitalize">
                      {exp.payment_method || '—'}
                    </td>
                    <td className="text-right font-mono font-bold text-rose-700 dark:text-rose-400">
                      {fmtCurrency(exp.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Grand Total</td>
                  <td className="text-right font-mono text-rose-700 dark:text-rose-400">
                    {fmtCurrency(totalExpenses)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
