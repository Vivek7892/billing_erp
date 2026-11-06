import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import { useTheme } from '../ThemeContext'
import {
  formatCurrency,
  formatNumber,
} from '../utils/formatters'
import {
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconPrinter,
  IconSearch,
  IconSelector,
  IconTrendingUp,
  IconShoppingCart,
  IconPackages,
  IconCash,
  IconUsers,
  IconReceiptTax,
  IconChartBar,
  IconRefresh,
  IconX,
} from '@tabler/icons-react'

/* ------------------------------------------------------------------
   Public Exports (Retained for application-wide compatibility)
------------------------------------------------------------------- */
export const REPORT_CATEGORIES = [
  { key: 'all', label: 'All Reports', icon: IconChartBar },
  { key: 'sales', label: 'Sales & Revenue', icon: IconTrendingUp },
  { key: 'purchases', label: 'Purchases', icon: IconShoppingCart },
  { key: 'inventory', label: 'Stock & Inventory', icon: IconPackages },
  { key: 'books', label: 'Accounting Books', icon: IconCash },
  { key: 'ledgers', label: 'Ledgers & Dues', icon: IconUsers },
  { key: 'gst', label: 'GST & Compliance', icon: IconReceiptTax },
]

export const ALL_REPORTS = [
  { key: 'sales', category: 'sales', label: 'Sales Summary', desc: 'Date-wise sales totals, transaction counts and revenues' },
  { key: 'sales_register', category: 'sales', label: 'Sales Register', desc: 'Itemized sales invoices with customer, tax and totals' },
  { key: 'products', category: 'sales', label: 'Item-wise Sales', desc: 'Units sold, average selling prices and gross revenues' },
  { key: 'purchases', category: 'purchases', label: 'Purchase Summary', desc: 'Procurement count, invoiced amounts and supplier dues' },
  { key: 'purchase_register', category: 'purchases', label: 'Purchase Register', desc: 'Inward purchase bills with supplier details and payments' },
  { key: 'item_wise_purchases', category: 'purchases', label: 'Item-wise Purchases', desc: 'Purchased quantities, unit purchase costs and total outlay' },
  { key: 'stock_summary', category: 'inventory', label: 'Stock Valuation', desc: 'Current stock in hand, landed cost, retail value and valuation' },
  { key: 'stock_movement', category: 'inventory', label: 'Stock Movement', desc: 'Stock inflow, outward billing, adjustments and ledger notes' },
  { key: 'day_book', category: 'books', label: 'Day Book', desc: 'Chronological record of all vouchers, debits and credits' },
  { key: 'cash_book', category: 'books', label: 'Cash Book', desc: 'Cash counter collections, payments and closing cash balance' },
  { key: 'bank_book', category: 'books', label: 'Bank Book', desc: 'Bank inflows, outflows, UTR references and bank balance' },
  { key: 'payments', category: 'books', label: 'Payment Collection', desc: 'Collections by payment channel, transaction ID and collector' },
  { key: 'expenses', category: 'books', label: 'Operating Expenses', desc: 'Business expenses by category, payee and payment method' },
  { key: 'profit', category: 'books', label: 'Profit & Loss', desc: 'Gross margin, operating overheads and net income statement' },
  { key: 'customers', category: 'ledgers', label: 'Customer Receivables', desc: 'Customer outstanding dues, credit limits and balances' },
  { key: 'customer_ledger', category: 'ledgers', label: 'Customer Ledger', desc: 'Customer account debit, credit and running balance history' },
  { key: 'outstanding_payables', category: 'ledgers', label: 'Supplier Payables', desc: 'Vendor payables, phone, GSTIN and pending balances' },
  { key: 'supplier_ledger', category: 'ledgers', label: 'Supplier Ledger', desc: 'Vendor bills, debit entries and settlement reconciliations' },
  { key: 'gst', category: 'gst', label: 'GST Tax Summary', desc: 'GST rate slabs, taxable turnovers and net tax liability' },
  { key: 'gstr1', category: 'gst', label: 'GSTR-1 Outward', desc: 'B2B/B2C outward supply schedules with CGST, SGST and IGST' },
  { key: 'gstr2', category: 'gst', label: 'GSTR-2 Inward', desc: 'Inward procurement bills and eligible Input Tax Credit (ITC)' },
  { key: 'gstr3b', category: 'gst', label: 'GSTR-3B Summary', desc: 'Consolidated return summary: output liability vs ITC offset' },
]

const NAV_CATEGORIES = REPORT_CATEGORIES.filter(c => c.key !== 'all')

const ENDPOINTS = {
  sales: '/reports/sales/',
  sales_register: '/reports/sales-register/',
  products: '/reports/products/',
  purchases: '/reports/purchases/',
  purchase_register: '/reports/purchase-register/',
  item_wise_purchases: '/reports/item-wise-purchases/',
  stock_summary: '/reports/stock-summary/',
  stock_movement: '/reports/stock-movement/',
  day_book: '/reports/day-book/',
  cash_book: '/reports/cash-book/',
  bank_book: '/reports/bank-book/',
  payments: '/reports/payment-collection/',
  expenses: '/reports/expenses/',
  profit: '/reports/profit/',
  customers: '/reports/customers/',
  customer_ledger: '/reports/customer-ledger/',
  outstanding_payables: '/reports/outstanding-payables/',
  supplier_ledger: '/reports/supplier-ledger/',
  gst: '/reports/gst-summary/',
  gstr1: '/reports/gstr1/',
  gstr2: '/reports/gstr2/',
  gstr3b: '/reports/gstr3b/',
}

const SNAPSHOT_REPORTS = new Set(['customers', 'outstanding_payables', 'stock_summary'])

/* ------------------------------------------------------------------
   Date Presets
------------------------------------------------------------------- */
const toLocalDate = d => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const getToday = () => toLocalDate(new Date())
const getWeekStart = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return toLocalDate(new Date(d.setDate(diff)))
}
const getMonthStart = () => toLocalDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const getLast90Days = () => toLocalDate(new Date(Date.now() - 89 * 86400000))
const getYearStart = () => {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-04-01`
}

const PRESET_RANGES = {
  Today: { start: getToday, end: getToday },
  'This Week': { start: getWeekStart, end: getToday },
  'This Month': { start: getMonthStart, end: getToday },
  'Last 90 Days': { start: getLast90Days, end: getToday },
  'This Year': { start: getYearStart, end: getToday },
}
const PRESETS = Object.keys(PRESET_RANGES)

/* ------------------------------------------------------------------
   Formatters
------------------------------------------------------------------- */
const inr = n => formatCurrency(n, { maximumFractionDigits: 0, minimumFractionDigits: 0 })
const num = n => formatNumber(n)

/* ------------------------------------------------------------------
   Backend report schemas
------------------------------------------------------------------- */
const isMonetaryCol = (header = '') => {
  const s = String(header).toLowerCase()
  return (
    s.includes('amount') ||
    s.includes('total') ||
    s.includes('tax') ||
    s.includes('price') ||
    s.includes('balance') ||
    s.includes('debit') ||
    s.includes('credit') ||
    s.includes('due') ||
    s.includes('valuation') ||
    s.includes('cost') ||
    s.includes('revenue') ||
    s.includes('turnover') ||
    s.includes('paid') ||
    s.includes('cgst') ||
    s.includes('sgst') ||
    s.includes('igst') ||
    s.includes('cess') ||
    s.includes('margin') ||
    s.includes('rs.')
  )
}

const isNumericCol = (header = '') => {
  const s = String(header).toLowerCase()
  return (
    s.includes('qty') ||
    s.includes('quantity') ||
    s.includes('units') ||
    s.includes('count') ||
    s.includes('stock') ||
    s.includes('items')
  )
}

const isStatusCol = (header = '') => {
  const s = String(header).toLowerCase()
  return s.includes('status') || s.includes('state') || s.includes('payment')
}

const isModeCol = (header = '') => {
  const s = String(header).toLowerCase()
  return s.includes('mode') || s.includes('channel') || s.includes('method')
}

/* ------------------------------------------------------------------
   Main Component
------------------------------------------------------------------- */
export default function Reports() {
  const [reportKey, setReportKey] = useState('sales')
  const [preset, setPreset] = useState('This Month')
  const [startDate, setStartDate] = useState(getMonthStart())
  const [endDate, setEndDate] = useState(getToday())
  const [exportOpen, setExportOpen] = useState(false)
  const { theme } = useTheme()
  const exportRef = useRef(null)

  // Query, Sort & Pagination state
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ colIdx: null, dir: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  // Backend Integration
  const [backendData, setBackendData] = useState(null)
  const [loading, setLoading] = useState(false)
  const abortControllerRef = useRef(null)

  const report = ALL_REPORTS.find(r => r.key === reportKey) || ALL_REPORTS[0]
  const isSnapshot = SNAPSHOT_REPORTS.has(reportKey)

  // Close export dropdown on click outside
  useEffect(() => {
    const handleClick = e => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false)
      }
    }
    if (exportOpen) {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('touchstart', handleClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [exportOpen])

  // Fetch report data
  const fetchReport = useCallback(async (key, start, end) => {
    const endpoint = ENDPOINTS[key] || `/reports/${key}/`
    if (abortControllerRef.current) abortControllerRef.current.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    try {
      const isSnap = SNAPSHOT_REPORTS.has(key)
      const params = isSnap ? '' : `?start_date=${start}&end_date=${end}`
      const response = await api.get(`${endpoint}${params}`, { signal: controller.signal })
      setBackendData(response.data)
      api.post('/auth/onboarding/reports-viewed/').catch(() => {})
    } catch (err) {
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        setBackendData(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReport(reportKey, startDate, endDate)
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [reportKey, startDate, endDate, fetchReport])

  // Date Preset Handlers
  const handlePresetChange = p => {
    setPreset(p)
    const range = PRESET_RANGES[p]
    if (range) {
      setStartDate(range.start())
      setEndDate(range.end())
    }
  }

  const handleApplyCustomDates = () => {
    if (startDate > endDate) {
      toast.error('Start date cannot be after end date')
      return
    }
    setPreset('Custom')
    fetchReport(reportKey, startDate, endDate)
  }

  // EXACT PDF REPORT DATA RESOLUTION
  // Ensures the frontend shows the exact data & columns that get exported to PDF
  const reportData = useMemo(() => {
    if (backendData) {
      const backendHeaders = Array.isArray(backendData.headers) ? backendData.headers : []
      const rawRows = Array.isArray(backendData.rows)
        ? backendData.rows
        : Array.isArray(backendData.results)
        ? backendData.results
        : Array.isArray(backendData.customers)
        ? backendData.customers
        : Array.isArray(backendData.products)
        ? backendData.products
        : []

      if (backendHeaders.length > 0) {
        const rows = rawRows.map(r => {
          if (Array.isArray(r)) return r
          return backendHeaders.map(h => r[h] ?? r[h.toLowerCase().replace(/[\s/.-]+/g, '_')] ?? '')
        })

        return {
          title: backendData.title || report.label,
          headers: backendHeaders,
          rows,
          summaryRows: backendData.summary_rows || [],
        }
      }
    }

    return { title: report.label, headers: [], rows: [], summaryRows: [] }

  }, [backendData, report.label])

  // Column definitions with data type awareness
  const columns = useMemo(() => {
    return reportData.headers.map((label, idx) => ({
      idx,
      label,
      isMoney: isMonetaryCol(label),
      isNum: isNumericCol(label) && !isMonetaryCol(label),
      isStatus: isStatusCol(label),
      isMode: isModeCol(label),
      isTotal: isMonetaryCol(label) || isNumericCol(label),
    }))
  }, [reportData.headers])

  // Query & Sort Filtered Rows
  const filteredRows = useMemo(() => {
    let out = reportData.rows

    const q = query.trim().toLowerCase()
    if (q) {
      out = out.filter(row =>
        row.some(cell => String(cell ?? '').toLowerCase().includes(q))
      )
    }

    if (sort.colIdx !== null) {
      out = [...out].sort((a, b) => {
        const x = a[sort.colIdx]
        const y = b[sort.colIdx]
        const numX = Number(x)
        const numY = Number(y)
        if (!isNaN(numX) && !isNaN(numY)) {
          return sort.dir === 'asc' ? numX - numY : numY - numX
        }
        const cmp = String(x ?? '').localeCompare(String(y ?? ''))
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }

    return out
  }, [reportData.rows, query, sort])

  // Pagination
  const totalCount = filteredRows.length
  const actualPageSize = pageSize === 'all' ? Math.max(1, totalCount) : Number(pageSize)
  const pages = Math.max(1, Math.ceil(totalCount / actualPageSize))
  const current = Math.min(page, pages)
  const visibleRows = pageSize === 'all' ? filteredRows : filteredRows.slice((current - 1) * actualPageSize, current * actualPageSize)

  const toggleSort = colIdx => {
    setSort(s => (s.colIdx === colIdx ? { colIdx, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { colIdx, dir: 'asc' }))
  }

  // Calculate totals across rows for a column index
  const calcTotal = colIdx => {
    return filteredRows.reduce((acc, row) => {
      const val = Number(row[colIdx]) || 0
      return acc + val
    }, 0)
  }

  // Real Export Flow
  const exportAs = async type => {
    if (type === 'Print') {
      window.print()
      return
    }

    if (type === 'CSV') {
      try {
        const headers = reportData.headers
        const rows = filteredRows
        if (!headers.length || !rows.length) {
          toast.error('No records available')
          return
        }
        const escapeCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`
        const csvContent = [
          headers.map(h => escapeCell(h)).join(','),
          ...rows.map(row => row.map(cell => escapeCell(cell)).join(',')),
        ].join('\r\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${reportKey}_${startDate}_${endDate}.csv`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        toast.success('CSV Downloaded')
      } catch {
        toast.error('Failed to export CSV')
      }
      return
    }

    const format = type === 'PDF' ? 'pdf' : 'xlsx'
    const endpoint = ENDPOINTS[reportKey] || `/reports/${reportKey}/`
    const toastId = toast.loading(`Generating ${type}...`)

    try {
      const params = new URLSearchParams()
      if (!isSnapshot) {
        params.set('start_date', startDate)
        params.set('end_date', endDate)
      }
      params.set('export', format)

      const response = await api.get(`${endpoint}?${params.toString()}`, { responseType: 'blob' })
      const mimeType = response.headers['content-type'] || (format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const blob = new Blob([response.data], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${reportKey}_${startDate}_${endDate}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`${type} downloaded`, { id: toastId })
    } catch {
      toast.error('Server export failed. Generating local CSV...', { id: toastId })
      exportAs('CSV')
    }
  }

  // Cell Renderer for Table
  const renderCell = (col, val) => {
    if (val === undefined || val === null || val === '') return '—'

    if (col.isMoney) {
      return inr(val)
    }

    if (col.isNum && typeof val === 'number') {
      return num(val)
    }

    if (col.isStatus) {
      const s = String(val).toUpperCase()
      const isOk = s === 'PAID' || s === 'IN STOCK' || s === 'ACTIVE'
      const isWarn = s === 'PARTIAL' || s === 'LOW' || s === 'DUE SOON'
      const isBad = s === 'UNPAID' || s === 'DUE' || s === 'OVERDUE' || s === 'OUT OF STOCK'

      const toneClass = isOk
        ? theme === 'dark' ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-800 border-emerald-300'
        : isWarn
        ? theme === 'dark' ? 'bg-amber-950 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-800 border-amber-300'
        : isBad
        ? theme === 'dark' ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-rose-50 text-rose-800 border-rose-300'
        : theme === 'dark' ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'

      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold border ${toneClass}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-85" />
          {val}
        </span>
      )
    }

    if (col.isMode) {
      const m = String(val).toUpperCase()
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--surface-elevated)] border border-[var(--line)]">
          {m}
        </span>
      )
    }

    return String(val)
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.75rem)] w-full overflow-x-hidden bg-[var(--surface)] text-[var(--ink)]">
      {/* ==================================================================
          1. SIMPLE, SINGLE-ROW TOP AREA (No categories on top, pure space utilization)
      =================================================================== */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--line)] pb-2.5">
        {/* Title & Live Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--ink)] truncate">
            {reportData.title}
          </h1>
          {loading ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary)] text-[var(--primary-contrast)]">
              <IconRefresh size={11} className="animate-spin" />
              Syncing…
            </span>
          ) : (
            <span className={`'}`}>
              <span className=" " />
             
            </span>
          )}
        </div>

        {/* Date Range Presets & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Presets */}
          <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--line)]">
            {PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetChange(p)}
                className={`h-7 px-2.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                  preset === p
                    ? 'bg-[var(--primary)] text-[var(--primary-contrast)] shadow-2xs font-bold'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {!isSnapshot ? (
            <div className="flex items-center gap-1.5 text-xs">
              <IconCalendar size={14} className="text-[var(--muted)] hidden sm:inline" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                aria-label="Start date"
                className="h-7.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 font-mono text-xs outline-none focus:border-[var(--primary)]"
              />
              <span className="text-[var(--muted)] text-[11px]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                aria-label="End date"
                className="h-7.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 font-mono text-xs outline-none focus:border-[var(--primary)]"
              />
              <button
                type="button"
                onClick={handleApplyCustomDates}
                className="h-7.5 px-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-contrast)] font-bold text-xs hover:bg-[var(--primary-hover)] transition cursor-pointer shadow-2xs"
              >
                Apply
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-mono text-[var(--muted)] hidden sm:flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live as of Today
            </span>
          )}

          

         
          {/* Simple Clean Export Button */}
          <div className="relative inline-block text-left" ref={exportRef}>
            <button
              type="button"
              onClick={() => setExportOpen(v => !v)}
              className="inline-flex h-7.5 items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-contrast)] px-3 text-xs font-bold shadow-2xs hover:bg-[var(--primary-hover)] transition cursor-pointer"
            >
              <IconDownload size={14} />
              <span>Export</span>
              <IconChevronDown
                size={13}
                className={`transition-transform duration-150 ${exportOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {exportOpen && (
              <div className="absolute right-0 z-30 mt-1.5 w-44 origin-top-right rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1 shadow-xl ring-1 ring-black/5 animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false)
                    exportAs('PDF')
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <IconFileTypePdf size={15} className="text-rose-600" />
                  <span>PDF Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false)
                    exportAs('Excel')
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <IconFileSpreadsheet size={15} className="text-emerald-600" />
                  <span>Excel Spreadsheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false)
                    exportAs('CSV')
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <IconDownload size={15} className="text-[var(--muted)]" />
                  <span>CSV File</span>
                </button>
                <div className="my-1 border-t border-[var(--line-subtle)]" />
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false)
                    exportAs('Print')
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <IconPrinter size={15} className="text-[var(--primary)]" />
                  <span>Print Statement</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================
          2. TWO INDIVIDUALLY SCROLLING SIDES (Left Directory & Right Ledger)
      =================================================================== */}
      <div className="flex-1 min-h-0 pt-2 flex gap-3 overflow-hidden">
        {/* ---------------------------------------------------------------
            LEFT SIDE: Independent Scrollable Reports Directory
        ---------------------------------------------------------------- */}
        <aside className="hidden lg:flex w-[230px] shrink-0 flex-col h-full overflow-hidden border-r border-[var(--line)] bg-[var(--surface)]">
          <div className="px-3 py-2 border-b border-[var(--line-subtle)] bg-[var(--surface-elevated)] shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Reports Directory</span>
            <div className="text-xs font-bold text-[var(--ink)]">{ALL_REPORTS.length} Available Statements</div>
          </div>

          {/* Left panel independent vertical scroll */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin">
            {NAV_CATEGORIES.map(cat => {
              const catReports = ALL_REPORTS.filter(r => r.category === cat.key)
              if (catReports.length === 0) return null
              const Icon = cat.icon

              return (
                <div key={cat.key} className="space-y-1">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    <Icon size={12} className="text-[var(--primary)]" />
                    <span>{cat.label}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {catReports.map(r => {
                      const active = r.key === reportKey
                      return (
                        <li key={r.key}>
                          <button
                            type="button"
                            onClick={() => {
                              setReportKey(r.key)
                              setPage(1)
                            }}
                            className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs font-medium transition cursor-pointer ${
                              active
                                ? 'bg-[var(--surface-hover)] text-[var(--primary)] font-bold'
                                : 'text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
                            }`}
                          >
                            <span className="truncate pr-1">{r.label}</span>
                            {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary-contrast)]" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </aside>

        {/* ---------------------------------------------------------------
            RIGHT SIDE: Independent Scrollable Data Workspace
        ---------------------------------------------------------------- */}
        <main className="flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-[var(--surface)] p-2 sm:p-3">
          {/* Mobile Select Report Dropdown */}
          <div className="lg:hidden shrink-0 pb-2">
            <select
              value={reportKey}
              onChange={e => {
                setReportKey(e.target.value)
                setPage(1)
              }}
              className="h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] outline-none focus:border-[var(--primary)]"
            >
              {NAV_CATEGORIES.map(cat => (
                <optgroup key={cat.key} label={cat.label}>
                  {ALL_REPORTS.filter(r => r.category === cat.key).map(r => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Table Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0 pb-2.5">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
              <div className="relative w-full">
                <IconSearch
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Filter records..."
                  aria-label="Filter records"
                  className="h-8 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] pl-8 pr-7 text-xs outline-none focus:border-[var(--primary)]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setPage(1)
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    <IconX size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Rows per page and filtered record count */}
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <div className="flex items-center gap-1.5">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(e.target.value)
                    setPage(1)
                  }}
                  className="h-7.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-semibold text-[var(--ink)] outline-none focus:border-[var(--primary)]"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value="all">All</option>
                </select>
              </div>
              <span className="font-mono text-[11px]">{filteredRows.length} entries</span>
            </div>
          </div>

          {/* -------------------------------------------------------------
              RIGHT SIDE MAIN DATA PANE:
              Independent Vertical and Horizontal Scroll for Table
          -------------------------------------------------------------- */}
          <div className="flex-1 min-h-0 flex flex-col border-y border-[var(--line)] bg-[var(--surface)] overflow-hidden">
            {/* Desktop & Mobile Scrollable Table (WITHOUT View button column) */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[650px] border-collapse text-left text-xs sm:text-[13px]">
                {/* Pinned Sticky THEAD */}
                <thead className="sticky top-0 z-20 bg-[var(--surface-elevated)] border-b border-[var(--line)] text-[var(--muted)]">
                  <tr>
                    {columns.map(col => (
                      <th
                        key={col.idx}
                        scope="col"
                        className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider ${
                          col.isMoney || col.isNum ? 'text-right' : 'text-left'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(col.idx)}
                          className={`inline-flex items-center gap-1.5 hover:text-[var(--ink)] transition cursor-pointer select-none ${
                            col.isMoney || col.isNum ? 'flex-row-reverse' : ''
                          }`}
                        >
                          <span>{col.label}</span>
                          <IconSelector
                            size={13}
                            className={sort.colIdx === col.idx ? 'text-[var(--primary)] opacity-100' : 'opacity-35'}
                          />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {loading ? (
                    <tr>
                      <td colSpan={columns.length} className="px-3 py-16 text-center text-xs text-[var(--muted)]">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-[var(--primary)] border-r-transparent"></div>
                        <p className="mt-2 font-bold text-[var(--ink)]">Loading exact statement data…</p>
                      </td>
                    </tr>
                  ) : visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-3 py-12 text-center text-xs text-[var(--muted)]">
                        <p className="font-bold text-[var(--ink)]">No statement records match your criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="transition-colors hover:bg-[var(--surface-hover)]"
                      >
                        {columns.map(col => (
                          <td
                            key={col.idx}
                            className={`whitespace-nowrap px-3 py-2.5 ${
                              col.isMoney || col.isNum ? 'text-right font-mono tabular-nums' : 'text-left'
                            } ${col.isMoney ? 'font-semibold text-[var(--ink)]' : ''}`}
                          >
                            {renderCell(col, row[col.idx])}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Sticky TFOOT for Exact Totals */}
                {columns.some(c => c.isTotal) && filteredRows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20 bg-[var(--surface-elevated)] border-t border-[var(--line)]">
                    <tr>
                      {columns.map((col, i) => (
                        <td
                          key={col.idx}
                          className={`whitespace-nowrap px-3 py-2.5 text-xs font-bold ${
                            col.isMoney || col.isNum
                              ? 'text-right font-mono tabular-nums text-[var(--primary)]'
                              : 'text-left text-[var(--ink)]'
                          }`}
                        >
                          {i === 0
                            ? `Totals (${filteredRows.length})`
                            : col.isTotal
                            ? col.isMoney
                              ? inr(calcTotal(col.idx))
                              : num(calcTotal(col.idx))
                            : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Right Side Pagination Footer */}
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-[var(--muted)] sm:flex-row pt-2 shrink-0">
            <span>
              Showing{' '}
              <strong className="text-[var(--ink)] font-mono">
                {filteredRows.length === 0 ? 0 : (current - 1) * actualPageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-[var(--ink)] font-mono">
                {Math.min(current * actualPageSize, filteredRows.length)}
              </strong>{' '}
              of <strong className="text-[var(--ink)] font-mono">{filteredRows.length}</strong> records
            </span>

            {pageSize !== 'all' && pages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={current === 1}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)] disabled:opacity-35 hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={current === 1}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)] disabled:opacity-35 hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <IconChevronLeft size={13} />
                </button>

                <span className="px-2 font-mono font-bold text-[var(--ink)] text-xs">
                  {current} / {pages}
                </span>

                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={current === pages}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)] disabled:opacity-35 hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <IconChevronRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(pages)}
                  disabled={current === pages}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)] disabled:opacity-35 hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  »
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

    </div>

  )
}
