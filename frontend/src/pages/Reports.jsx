import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import api from '../api'
import { PageHeader, Spinner } from '../components/UI'
import { InformationalBanner } from '../components/visual-content'
import {
  IconTrendingUp,
  IconPackage,
  IconCurrencyDollar,
  IconPercentage,
  IconUsers,
  IconCreditCard,
  IconReceipt,
  IconCalendar,
  IconFilter,
  IconRefresh,
  IconFileText,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconFileTypeXls,
  IconAlertCircle,
  IconInfoCircle,
  IconRotate2,
  IconChevronDown,
  IconX,
} from '@tabler/icons-react'
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
import { MobileKpiGrid } from '../components/MobileUI'

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


/* ============================================================
   CONFIG & TABS
============================================================ */
const toLocalDateInput = date => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const getToday = () => toLocalDateInput(new Date())
const getYesterday = () => toLocalDateInput(new Date(Date.now() - 86400000))
const getWeekStart = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return toLocalDateInput(monday)
}
const getMonthStart = () => toLocalDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const getLast30Days = () => toLocalDateInput(new Date(Date.now() - 29 * 86400000))
const getLast90Days = () => toLocalDateInput(new Date(Date.now() - 89 * 86400000))
const getYearStart = () => toLocalDateInput(new Date(new Date().getFullYear(), 0, 1))

const DATE_PRESETS = [
  { key: 'today', label: 'Today', getStart: getToday, getEnd: getToday },
  { key: 'yesterday', label: 'Yesterday', getStart: getYesterday, getEnd: getYesterday },
  { key: 'week', label: 'This Week', getStart: getWeekStart, getEnd: getToday },
  { key: 'month', label: 'This Month', getStart: getMonthStart, getEnd: getToday },
  { key: 'last30', label: 'Last 30 Days', getStart: getLast30Days, getEnd: getToday },
  { key: 'last90', label: 'Last 90 Days', getStart: getLast90Days, getEnd: getToday },
  { key: 'year', label: 'This Year', getStart: getYearStart, getEnd: getToday },
]

const TABS = [
  { key: 'sales', label: 'Sales Summary', icon: IconTrendingUp },
  { key: 'products', label: 'Product Sales', icon: IconPackage },
  { key: 'profit', label: 'Profit & Loss', icon: IconCurrencyDollar },
  { key: 'gst', label: 'GST Tax Summary', icon: IconPercentage },
  { key: 'customers', label: 'Customer Receivables', icon: IconUsers },
  { key: 'payments', label: 'Payment Modes', icon: IconCreditCard },
  { key: 'expenses', label: 'Operating Expenses', icon: IconReceipt },
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
  const [datePreset, setDatePreset] = useState('month')
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
  const [mobileDateFilterOpen, setMobileDateFilterOpen] = useState(false)

  const activeRequestRef = useRef(0)
  const abortControllerRef = useRef(null)
  const reportsViewedRef = useRef(false)

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
          if (!reportsViewedRef.current) {
            reportsViewedRef.current = true
            api.post('/auth/onboarding/reports-viewed/')
              .catch(() => { reportsViewedRef.current = false })
          }
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          return
        }
        if (reqId === activeRequestRef.current) {
          const msg =
            err.response?.status === 403
              ? 'Reports are restricted to administrator and owner roles.'
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

  const applyPreset = preset => {
    setDatePreset(preset.key)
    const s = preset.getStart()
    const e = preset.getEnd()
    setStartDate(s)
    setEndDate(e)
    setAppliedDates({ start: s, end: e })
  }

  const handleResetFilters = () => {
    setDatePreset('month')
    const s = getMonthStart()
    const e = getToday()
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
          <div className="flex w-full sm:w-auto items-center justify-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={Boolean(exporting) || loading}
              className="btn-secondary inline-flex h-8 min-w-0 items-center justify-center gap-1.5 px-3 text-xs font-semibold sm:h-9"
              title="Download formal black-and-white A4 PDF Report"
            >
              <IconFileTypePdf size={16} className="text-rose-600 dark:text-rose-400" />
              <span className="truncate">{exporting === 'pdf' ? 'Generating PDF…' : 'PDF'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleExport('xlsx')}
              disabled={Boolean(exporting) || loading}
              className="btn-secondary inline-flex h-8 min-w-0 items-center justify-center gap-1.5 px-3 text-xs font-semibold sm:h-9"
              title="Download formatted Excel workbook"
            >
              <IconFileTypeXls size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{exporting === 'xlsx' ? 'Generating Excel…' : 'Excel'}</span>
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
          DATE FILTER BAR (HIGH-VISIBILITY & MOBILE-FRIENDLY)
      ====================================================== */}
      {tab === 'customers' ? (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 sm:p-3 shadow-2xs">
          <div className="flex items-center gap-2.5 text-xs text-[var(--muted)]">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-elevated)] text-[#1E3A5F] dark:text-sky-400">
              <IconInfoCircle size={15} />
            </div>
            <div>
              <span className="font-semibold text-[var(--ink)]">Live Outstanding Ledger Balances</span>
              <p className="text-[11px] text-[var(--muted)]">Customer receivables reflect real-time outstanding ledger amounts as of today. Date range filtering does not apply.</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Mobile Filter Toggle Strip (hidden sm:hidden - hidden by default on mobile) */}
          <div className="flex sm:hidden items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 shadow-2xs">
            <button
              type="button"
              onClick={() => setMobileDateFilterOpen(v => !v)}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-expanded={mobileDateFilterOpen}
              aria-label="Toggle date filters"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-elevated)] text-[#1E3A5F] dark:text-sky-400">
                <IconCalendar size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted)] block">Report Period</span>
                <span className="font-mono text-xs font-semibold text-[var(--ink)] truncate block">
                  {appliedDates.start} → {appliedDates.end}
                </span>
              </div>
              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-[var(--line)] transition-colors ${
                mobileDateFilterOpen ? 'bg-[#1E3A5F] text-white' : 'bg-[var(--surface-elevated)] text-[var(--muted)]'
              }`}>
                <IconFilter size={12} />
                <span>{mobileDateFilterOpen ? 'Hide Filter' : 'Change Dates'}</span>
              </span>
            </button>
          </div>

          <section
            className={`${mobileDateFilterOpen ? 'block' : 'hidden'} sm:block rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 sm:p-3 shadow-2xs`}
            aria-label="Report date filters"
          >
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            {/* Quick Date Presets Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--surface-elevated)] text-[var(--muted)]">
                <IconCalendar size={14} />
              </div>
              {DATE_PRESETS.map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    datePreset === preset.key
                      ? 'bg-[#1E3A5F] text-white shadow-2xs'
                      : 'bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Range & Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={startDate}
                  max={endDate || getToday()}
                  onChange={e => {
                    setStartDate(e.target.value)
                    setDatePreset('custom')
                  }}
                  className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] px-2.5 text-xs font-mono text-[var(--ink)] outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
                  aria-label="Report start date"
                />
                <span className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-wider">TO</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={getToday()}
                  onChange={e => {
                    setEndDate(e.target.value)
                    setDatePreset('custom')
                  }}
                  className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] px-2.5 text-xs font-mono text-[var(--ink)] outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F]"
                  aria-label="Report end date"
                />
              </div>

              <button
                type="button"
                onClick={handleApplyFilters}
                disabled={isDateInvalid || loading}
                className="h-8 px-3.5 rounded-md bg-[#1E3A5F] text-white text-xs font-semibold hover:bg-[#162d4a] disabled:opacity-50 transition shadow-2xs"
              >
                Apply
              </button>

              <button
                type="button"
                onClick={handleResetFilters}
                disabled={loading}
                title="Reset to current month"
                aria-label="Reset date range to current month"
                className="h-8 px-2.5 rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--muted)] text-xs font-semibold hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition flex items-center gap-1"
              >
                <IconRotate2 size={13} />
                <span className="hidden sm:inline">Reset</span>
              </button>
            </div>
          </div>

          {isDateInvalid && (
            <p
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-rose-600"
              role="alert"
            >
              <IconAlertCircle size={13} />
              Start date cannot be after end date.
            </p>
          )}
        </section>
        </>
      )}

      {/* =====================================================
          APPLIED FILTER METADATA STRIP
      ====================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-[var(--muted)]">
            <IconFilter size={13} className="text-[#1E3A5F] dark:text-sky-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Period:</span>
          </div>
          <span className="font-mono text-[11px] font-semibold text-[var(--ink)] bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--line)]">
            {tab === 'customers' ? 'Live Balances (Today)' : `${appliedDates.start} → ${appliedDates.end}`}
          </span>
          {data && (
            <span className="text-[11px] text-[var(--muted)]">
              • {data.summary?.count ?? data.count ?? data.invoices?.length ?? data.products?.length ?? data.expenses?.length ?? data.daily?.length ?? data.results?.length ?? 0} records analyzed
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
          <span>Report Currency: <strong className="text-[var(--ink)] font-mono">INR (₹)</strong></span>
        </div>
      </div>
      
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
            <IconAlertCircle className="mx-auto mb-2 text-rose-500" size={30} />
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
      <InformationalBanner
        tip="Pro Tip: You can export CA-ready GSTR-1, GSTR-3B, and Balance Sheets in Excel and PDF formats anytime."
        className="my-3"
      />
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
      {/* Mobile KPI Grid */}
      <MobileKpiGrid
        title="Sales Overview"
        primaryKpis={[
          { label: 'Net Sales', value: fmtCurrency(summary.net_sales || totalSales), tone: 'text-teal-700 dark:text-teal-400' },
          { label: 'Collections', value: fmtCurrency(summary.collection), tone: 'text-emerald-700 dark:text-emerald-400' },
          { label: 'Total Invoices', value: fmtNumber(totalInvoices), tone: 'text-[var(--ink)]' },
          { label: 'Outstanding', value: fmtCurrency(summary.outstanding), tone: Number(summary.outstanding || 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--muted)]' },
        ]}
        secondaryKpis={[
          { label: 'Gross Sales', value: fmtCurrency(totalSales), tone: 'text-[var(--ink)]' },
          { label: 'Output GST', value: fmtCurrency(summary.total_tax), tone: 'text-[var(--ink-secondary)]' },
          { label: 'Total Discounts', value: fmtCurrency(summary.total_discount), tone: 'text-rose-600 dark:text-rose-400' },
          { label: 'Returns', value: fmtCurrency(summary.returns), tone: 'text-[var(--muted)]' },
        ]}
      />

      {/* Desktop Executive Summary Table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
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
      {/* Mobile KPI Grid */}
      <MobileKpiGrid
        title="Products Overview"
        primaryKpis={[
          { label: 'Unique Items', value: fmtNumber(rows.length), tone: 'text-[var(--ink)]' },
          { label: 'Units Sold', value: fmtNumber(totalQty), tone: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Total Revenue', value: fmtCurrency(totalRevenue), tone: 'text-teal-700 dark:text-teal-400' },
        ]}
      />

      {/* Product Summary Overview */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
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
      {/* Mobile KPI Grid */}
      <MobileKpiGrid
        title="Financial Overview"
        primaryKpis={[
          { label: 'Net Profit', value: fmtCurrency(netProfit), tone: 'text-teal-700 dark:text-teal-400' },
          { label: 'Net Revenue', value: fmtCurrency(netRevenue), tone: 'text-[var(--ink)]' },
          { label: 'Gross Profit', value: fmtCurrency(grossProfit), tone: 'text-emerald-700 dark:text-emerald-400' },
          { label: 'Expenses', value: fmtCurrency(expenses), tone: 'text-rose-700 dark:text-rose-400' },
        ]}
        secondaryKpis={[
          { label: 'COGS', value: fmtCurrency(cogs), tone: 'text-[var(--muted)]' },
          { label: 'Gross Margin', value: `${grossMargin}%`, tone: 'text-teal-700 dark:text-teal-400' },
          { label: 'Net Margin', value: `${netMargin}%`, tone: 'text-teal-700 dark:text-teal-400' },
          { label: 'Returns', value: fmtCurrency(returns), tone: 'text-[var(--muted)]' },
        ]}
      />

      {/* Desktop Executive Financial Statement Table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
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
      {/* Mobile KPI Grid */}
      <MobileKpiGrid
        title="GST Overview"
        primaryKpis={[
          { label: 'Total Output GST', value: fmtCurrency(totalTax), tone: 'text-teal-700 dark:text-teal-400' },
          { label: 'Taxable Turnover', value: fmtCurrency(totalTaxable), tone: 'text-[var(--ink)]' },
          { label: 'CGST', value: fmtCurrency(totalCgst), tone: 'text-[var(--ink-secondary)]' },
          { label: 'SGST', value: fmtCurrency(totalSgst), tone: 'text-[var(--ink-secondary)]' },
        ]}
      />

      {/* Desktop GST Executive Liability Overview */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
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
      {/* Mobile KPI Grid */}
      <MobileKpiGrid
        title="Credit Overview"
        primaryKpis={[
          { label: 'Outstanding Due', value: fmtCurrency(totalOutstanding), tone: 'text-rose-700 dark:text-rose-400' },
          { label: 'Customers with Due', value: fmtNumber(rows.length), tone: 'text-amber-700 dark:text-amber-400' },
        ]}
      />

      {/* Desktop Executive Receivables Summary */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
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

      {/* Customer Credit Collection History (Who Gave, Who Collected, Exact Date & Time) */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-3 bg-[var(--surface-subtle)] flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Customer Receivables Collection History
            </h3>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">
              Detailed tracking: Who Gave (Customer), Who Collected (Staff), Date & Time, and Reference
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400">
            {Array.isArray(data?.collections) ? data.collections.length : 0} Collections
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Date &amp; Time (When)</th>
                <th>Who Gave (Customer)</th>
                <th>Who Collected</th>
                <th>Method</th>
                <th>Transaction / Ref</th>
                <th>Invoice</th>
                <th className="text-right">Amount Collected</th>
              </tr>
            </thead>
            <tbody>
              {!Array.isArray(data?.collections) || data.collections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[var(--muted)]">
                    No customer receivable collections recorded yet.
                  </td>
                </tr>
              ) : (
                data.collections.map((col, idx) => (
                  <tr key={col.id || idx}>
                    <td className="font-mono text-xs text-[var(--ink)]">
                      {col.date_time || (col.created_at ? new Date(col.created_at).toLocaleString() : '—')}
                    </td>
                    <td>
                      <div className="font-semibold text-xs text-[var(--ink)]">{col.who_gave}</div>
                      {col.who_gave_phone && col.who_gave_phone !== '—' && (
                        <div className="font-mono text-[10px] text-[var(--muted)]">{col.who_gave_phone}</div>
                      )}
                    </td>
                    <td>
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {col.who_collected || 'Staff'}
                      </span>
                    </td>
                    <td className="font-mono text-xs font-semibold uppercase text-[var(--ink)]">
                      {col.method}
                    </td>
                    <td className="font-mono text-xs text-[var(--muted)] select-all">
                      {col.reference}
                    </td>
                    <td className="font-mono text-xs text-[#1E3A5F] dark:text-sky-300">
                      {col.invoice_number}
                    </td>
                    <td className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      + {fmtCurrency(col.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {Array.isArray(data?.collections) && data.collections.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={6}>Total Recent Collections</td>
                  <td className="text-right font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                    + {fmtCurrency(data?.total_collected_amount || data.collections.reduce((sum, c) => sum + (Number(c.amount) || 0), 0))}
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
      {/* Mobile KPI Grid */}
      <MobileKpiGrid
        title="Collections Overview"
        primaryKpis={[
          { label: 'Total Collections', value: fmtCurrency(totalAmount), tone: 'text-teal-700 dark:text-teal-400' },
          { label: 'Transactions', value: fmtNumber(totalCount), tone: 'text-[var(--ink)]' },
        ]}
      />

      {/* Desktop Executive Payment Summary */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
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

      {/* Detailed Payment Audit Trail (Who Gave, Who Collected, When Collected) */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="border-b border-[var(--line)] px-4 py-3 bg-[var(--surface-subtle)] flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Payment Collection Log (Who Gave, Who Collected, Date &amp; Time)
            </h3>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">
              Auditable collection entries with exact timestamps, staff receiver, and transaction references
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-teal-700 dark:text-teal-400">
            {Array.isArray(data?.transactions) ? data.transactions.length : 0} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Date &amp; Time (When)</th>
                <th>Who Gave (Customer)</th>
                <th>Who Collected</th>
                <th>Method</th>
                <th>Transaction / Ref</th>
                <th>Invoice</th>
                <th className="text-right">Amount Collected</th>
              </tr>
            </thead>
            <tbody>
              {!Array.isArray(data?.transactions) || data.transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[var(--muted)]">
                    No payment collection transactions recorded in this period.
                  </td>
                </tr>
              ) : (
                data.transactions.map((tx, idx) => (
                  <tr key={tx.id || idx}>
                    <td className="font-mono text-xs text-[var(--ink)]">
                      {tx.date_time || (tx.created_at ? new Date(tx.created_at).toLocaleString() : '—')}
                    </td>
                    <td>
                      <div className="font-semibold text-xs text-[var(--ink)]">{tx.who_gave}</div>
                      {tx.who_gave_phone && (
                        <div className="font-mono text-[10px] text-[var(--muted)]">{tx.who_gave_phone}</div>
                      )}
                    </td>
                    <td>
                      <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 dark:bg-teal-950/40 dark:text-teal-300">
                        {tx.who_collected || 'Staff'}
                      </span>
                    </td>
                    <td className="font-mono text-xs font-semibold uppercase text-[var(--ink)]">
                      {tx.method}
                    </td>
                    <td className="font-mono text-xs text-[var(--muted)] select-all">
                      {tx.reference}
                    </td>
                    <td className="font-mono text-xs text-[#1E3A5F] dark:text-sky-300">
                      {tx.invoice_number}
                    </td>
                    <td className="text-right font-mono font-bold text-teal-700 dark:text-teal-400">
                      + {fmtCurrency(tx.amount)}
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
  const categories = Array.isArray(data?.categories)
    ? data.categories
    : Array.isArray(data?.by_category)
      ? data.by_category
      : []

  const totalExpenses = Number(
    data?.total_expenses ??
      data?.summary?.total_amount ??
      categories.reduce((s, c) => s + Number(c.total || 0), 0),
  )
  const totalCount = Number(
      data?.summary?.count ??
      categories.reduce((s, c) => s + Number(c.count || 0), 0),
  )
  const avgAmount = Number(
    data?.summary?.avg_amount ?? (totalCount > 0 ? totalExpenses / totalCount : 0),
  )

  return (
    <div className="space-y-4">
      {/* Mobile KPI Grid */}
      <MobileKpiGrid
        title="Expenses Overview"
        primaryKpis={[
          { label: 'Total Expenses', value: fmtCurrency(totalExpenses), tone: 'text-rose-700 dark:text-rose-400' },
          { label: 'Entries', value: fmtNumber(totalCount), tone: 'text-[var(--ink)]' },
          { label: 'Avg per Entry', value: fmtCurrency(avgAmount), tone: 'text-[var(--ink-secondary)]' },
        ]}
      />

      {/* Desktop Executive Summary Table */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
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

    </div>
  )
}
