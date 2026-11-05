import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { PageHeader } from '../components/UI'
import { InformationalBanner } from '../components/visual-content'
import {
  IconTrendingUp,
  IconShoppingCart,
  IconPackage,
  IconCurrencyDollar,
  IconPercentage,
  IconUsers,
  IconCreditCard,
  IconReceipt,
  IconCalendar,
  IconFilter,
  IconRefresh,
  IconDownload,
  IconChevronDown,
  IconChevronUp,
  IconFileTypePdf,
  IconFileTypeXls,
  IconSearch,
  IconAlertCircle,
  IconInfoCircle,
  IconFileText,
  IconPackages,
  IconRotate2,
  IconClock,
  IconCash,
  IconBuildingStore,
  IconUser,
  IconFolder,
  IconReceiptTax,
  IconFileSpreadsheet,
  IconX,
  IconChartBar,
  IconChevronLeft,
  IconChevronRight,
  IconCheck,
  IconArrowLeft,
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
import {
  fmtCurrency,
  fmtNumber,
  formatDate,
} from '../utils/formatters'

/* ============================================================
   DATE PRESETS & HELPERS
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
  { key: 'year', label: 'This Year', getStart: getYearStart, getEnd: getToday },
  { key: 'month', label: 'This Month', getStart: getMonthStart, getEnd: getToday },
  { key: 'last30', label: 'Last 30 Days', getStart: getLast30Days, getEnd: getToday },
  { key: 'last90', label: 'Last 90 Days', getStart: getLast90Days, getEnd: getToday },
  { key: 'week', label: 'This Week', getStart: getWeekStart, getEnd: getToday },
  { key: 'today', label: 'Today', getStart: getToday, getEnd: getToday },
  { key: 'yesterday', label: 'Yesterday', getStart: getYesterday, getEnd: getYesterday },
]

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
  // Sales & Revenue
  { key: 'sales', category: 'sales', label: 'Sales Summary', endpoint: '/reports/sales/', filename: 'sales_summary_report', icon: IconTrendingUp, desc: 'Sales performance overview, daily revenue and collection trends' },
  { key: 'sales_register', category: 'sales', label: 'Sales Register', endpoint: '/reports/sales-register/', filename: 'sales_register_report', icon: IconFileText, desc: 'Detailed invoice-by-invoice sales register with GST breakup' },
  { key: 'products', category: 'sales', label: 'Item-wise Sales', endpoint: '/reports/products/', filename: 'product_sales_report', icon: IconPackage, desc: 'Sales volume, turnover, margin, and contribution per product' },

  // Purchases
  { key: 'purchases', category: 'purchases', label: 'Purchase Summary', endpoint: '/reports/purchases/', filename: 'purchase_summary_report', icon: IconShoppingCart, desc: 'Summary of inwards procurements and supplier purchase totals' },
  { key: 'purchase_register', category: 'purchases', label: 'Purchase Register', endpoint: '/reports/purchase-register/', filename: 'purchase_register_report', icon: IconFileText, desc: 'Inward purchase bills register with tax details and payment status' },
  { key: 'item_wise_purchases', category: 'purchases', label: 'Item-wise Purchases', endpoint: '/reports/item-wise-purchases/', filename: 'item_wise_purchases_report', icon: IconPackages, desc: 'Procurement quantities and purchase cost per item' },

  // Stock & Inventory
  { key: 'stock_summary', category: 'inventory', label: 'Stock Valuation Summary', endpoint: '/reports/stock-summary/', filename: 'stock_summary_report', icon: IconPackages, desc: 'Live inventory stock-in-hand, cost rate, retail price, and total valuation' },
  { key: 'stock_movement', category: 'inventory', label: 'Stock Movement Report', endpoint: '/reports/stock-movement/', filename: 'stock_movement_report', icon: IconRotate2, desc: 'Stock audit trail: purchases, sales, damaged, and adjustments' },

  // Accounting Books
  { key: 'day_book', category: 'books', label: 'Day Book', endpoint: '/reports/day-book/', filename: 'day_book_report', icon: IconClock, desc: 'Day-to-day chronological record of all accounting transactions' },
  { key: 'cash_book', category: 'books', label: 'Cash Book', endpoint: '/reports/cash-book/', filename: 'cash_book_report', icon: IconCash, desc: 'Cash in hand receipts, payments, and closing cash balance' },
  { key: 'bank_book', category: 'books', label: 'Bank Book', endpoint: '/reports/bank-book/', filename: 'bank_book_report', icon: IconCreditCard, desc: 'Bank account deposits, withdrawals, UPI, and online receipts' },
  { key: 'payments', category: 'books', label: 'Payment Collection Register', endpoint: '/reports/payment-collection/', filename: 'payment_collection_report', icon: IconCreditCard, desc: 'Receipts by payment method: UPI, Cash, Cards, Bank' },
  { key: 'expenses', category: 'books', label: 'Operating Expenses', endpoint: '/reports/expenses/', filename: 'operating_expenses_report', icon: IconReceipt, desc: 'Store operational expenditures categorized by expense heads' },
  { key: 'profit', category: 'books', label: 'Profit & Loss Statement', endpoint: '/reports/profit/', filename: 'profit_and_loss_report', icon: IconCurrencyDollar, desc: 'Gross revenue, cost of goods sold, overheads, and net profit' },

  // Ledgers & Dues
  { key: 'customers', category: 'ledgers', label: 'Customer Receivables', endpoint: '/reports/customers/', filename: 'customer_receivables_report', icon: IconUsers, desc: 'Outstanding balances and credit limits for all credit customers' },
  { key: 'customer_ledger', category: 'ledgers', label: 'Customer Ledger Statement', endpoint: '/reports/customer-ledger/', filename: 'customer_ledger_report', icon: IconUser, desc: 'Debit, credit, invoice, and payment history per customer' },
  { key: 'outstanding_payables', category: 'ledgers', label: 'Supplier Payables', endpoint: '/reports/outstanding-payables/', filename: 'supplier_payables_report', icon: IconBuildingStore, desc: 'Outstanding dues payable to vendors and distributors' },
  { key: 'supplier_ledger', category: 'ledgers', label: 'Supplier Ledger Statement', endpoint: '/reports/supplier-ledger/', filename: 'supplier_ledger_report', icon: IconBuildingStore, desc: 'Inward bills, returns, and payment settlements per supplier' },

  // GST & Compliance
  { key: 'gst', category: 'gst', label: 'GST Tax Summary', endpoint: '/reports/gst-summary/', filename: 'gst_tax_summary_report', icon: IconPercentage, desc: 'Consolidated taxable value, CGST, SGST, IGST tax liability' },
  { key: 'gstr1', category: 'gst', label: 'GSTR-1 Outward Supplies', endpoint: '/reports/gstr1/', filename: 'gstr1_report', icon: IconFileText, desc: 'Outward invoice sales for monthly/quarterly GST filing' },
  { key: 'gstr2', category: 'gst', label: 'GSTR-2 Inward Supplies', endpoint: '/reports/gstr2/', filename: 'gstr2_report', icon: IconFileText, desc: 'Inward supplies and Input Tax Credit (ITC) reconciliation' },
  { key: 'gstr3b', category: 'gst', label: 'GSTR-3B Return Summary', endpoint: '/reports/gstr3b/', filename: 'gstr3b_report', icon: IconFileText, desc: 'Monthly self-assessment summary: output tax liability vs eligible ITC' },
]

const ENDPOINTS = ALL_REPORTS.reduce((acc, r) => {
  acc[r.key] = r.endpoint
  return acc
}, {})

const REPORT_FILENAMES = ALL_REPORTS.reduce((acc, r) => {
  acc[r.key] = r.filename
  return acc
}, {})

const NAVIGATION_CATEGORIES = REPORT_CATEGORIES.filter(c => c.key !== 'all')

function ReportNavigationMenu({
  reportSearch,
  setReportSearch,
  expandedCategories,
  toggleCategory,
  expandAllCategories,
  collapseAllCategories,
  filteredReportsByCategory,
  totalMatchingReports,
  tab,
  onSelectReport,
}) {
  const isSearching = Boolean(reportSearch.trim())

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Search Input */}
      <div className="relative mb-2.5 shrink-0">
        <IconSearch
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
        />
        <input
          type="text"
          value={reportSearch}
          onChange={e => setReportSearch(e.target.value)}
          placeholder="Filter reports…"
          className="w-full rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] pl-8 pr-7 py-1.5 text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#0057B8] focus:bg-[var(--surface)] transition"
        />
        {reportSearch && (
          <button
            type="button"
            onClick={() => setReportSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] p-0.5"
            title="Clear filter"
          >
            <IconX size={13} />
          </button>
        )}
      </div>

      {/* Meta Bar */}
      <div className="px-1 mb-2 flex items-center justify-between text-[11px] text-[var(--muted)] shrink-0">
        <span className="font-mono">
          {isSearching
            ? `${totalMatchingReports} of ${ALL_REPORTS.length} matched`
            : `${ALL_REPORTS.length} reports in 6 categories`}
        </span>
        {!isSearching && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <button
              type="button"
              onClick={expandAllCategories}
              className="text-[#0057B8] hover:underline transition"
            >
              Expand all
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={collapseAllCategories}
              className="text-[var(--muted)] hover:text-[var(--ink)] transition"
            >
              Collapse
            </button>
          </div>
        )}
      </div>

      {/* Accordion Categories and Sub-reports */}
      <div className="space-y-1.5 flex-1 overflow-y-auto pr-0.5 scrollbar-thin">
        {NAVIGATION_CATEGORIES.map(cat => {
          const reports = filteredReportsByCategory[cat.key] || []
          if (isSearching && reports.length === 0) return null

          const isExpanded = isSearching || expandedCategories.has(cat.key)
          const CatIcon = cat.icon
          const hasActiveReport = reports.some(r => r.key === tab)

          return (
            <div
              key={cat.key}
              className={`rounded-lg border transition-colors overflow-hidden ${
                hasActiveReport
                  ? 'border-[#0057B8]/40 bg-[#0057B8]/[0.02]'
                  : 'border-[var(--line-subtle)] bg-[var(--surface)]'
              }`}
            >
              {/* Category Header */}
              <button
                type="button"
                onClick={() => toggleCategory(cat.key)}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-xs font-semibold transition-colors ${
                  hasActiveReport
                    ? 'text-[#0057B8] bg-[#0057B8]/5'
                    : 'text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <CatIcon
                    size={16}
                    className={hasActiveReport ? 'text-[#0057B8]' : 'text-[var(--muted)]'}
                  />
                  <span className="truncate">{cat.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      hasActiveReport
                        ? 'bg-[#0057B8]/15 text-[#0057B8] font-bold'
                        : 'bg-[var(--surface-elevated)] text-[var(--muted)]'
                    }`}
                  >
                    {reports.length}
                  </span>
                  {isExpanded ? (
                    <IconChevronUp size={13} className="text-[var(--muted)]" />
                  ) : (
                    <IconChevronDown size={13} className="text-[var(--muted)]" />
                  )}
                </div>
              </button>

              {/* Sub-category reports list */}
              {isExpanded && (
                <div className="p-1 space-y-0.5 border-t border-[var(--line-subtle)] bg-[var(--surface)]">
                  {reports.map(r => {
                    const isActive = tab === r.key
                    const RIcon = r.icon
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => onSelectReport(r.key, cat.key)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all text-left ${
                          isActive
                            ? 'bg-[#0057B8] text-white font-semibold shadow-2xs'
                            : 'text-[var(--ink)] hover:bg-[var(--surface-hover)] hover:text-[#0057B8] font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <RIcon
                            size={14}
                            className={isActive ? 'text-white' : 'text-[var(--muted)]'}
                          />
                          <span className="truncate">{r.label}</span>
                        </div>
                        {isActive && (
                          <IconCheck size={13} className="text-white shrink-0 ml-1" />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {isSearching && totalMatchingReports === 0 && (
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)]/50 p-6 text-center text-xs text-[var(--muted)]">
            <IconAlertCircle size={20} className="mx-auto mb-1.5 text-[var(--muted)]" />
            <p className="font-medium text-[var(--ink)]">No reports match "{reportSearch}"</p>
            <p className="mt-1 text-[11px]">Try searching with a different keyword</p>
            <button
              type="button"
              onClick={() => setReportSearch('')}
              className="btn-secondary h-7 px-2.5 text-xs mt-2.5"
            >
              Clear filter
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Reports() {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState('sales')
  const [tab, setTab] = useState('sales')
  const [reportSearch, setReportSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState(
    () => new Set(['sales', 'purchases', 'inventory', 'books', 'ledgers', 'gst'])
  )
  const [datePreset, setDatePreset] = useState('year')
  const [startDate, setStartDate] = useState(getYearStart())
  const [endDate, setEndDate] = useState(getToday())
  const [appliedDates, setAppliedDates] = useState({
    start: getYearStart(),
    end: getToday(),
  })
  const [filterOpen, setFilterOpen] = useState(false)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState('')
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [error, setError] = useState('')

  const activeRequestRef = useRef(0)
  const abortControllerRef = useRef(null)
  const reportsViewedRef = useRef(false)
  const exportMenuRef = useRef(null)

  const isSnapshotReport = useMemo(() => {
    return ['customers', 'outstanding_payables', 'stock_summary'].includes(tab)
  }, [tab])

  const currentReport = useMemo(() => {
    return ALL_REPORTS.find(r => r.key === tab) || ALL_REPORTS[0]
  }, [tab])

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const activeCategoryObj = useMemo(() => {
    const catKey = currentReport?.category || activeCategory
    return REPORT_CATEGORIES.find(c => c.key === catKey) || REPORT_CATEGORIES[0]
  }, [currentReport, activeCategory])

  const toggleCategory = useCallback((catKey) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(catKey)) next.delete(catKey)
      else next.add(catKey)
      return next
    })
  }, [])

  const expandAllCategories = useCallback(() => {
    setExpandedCategories(new Set(['sales', 'purchases', 'inventory', 'books', 'ledgers', 'gst']))
  }, [])

  const collapseAllCategories = useCallback(() => {
    setExpandedCategories(new Set())
  }, [])

  const handleSelectReport = useCallback((reportKey, catKey) => {
    setTab(reportKey)
    setActiveCategory(catKey)
    setExpandedCategories(prev => {
      if (prev.has(catKey)) return prev
      const next = new Set(prev)
      next.add(catKey)
      return next
    })
    setMobileDrawerOpen(false)
  }, [])

  const filteredReportsByCategory = useMemo(() => {
    const q = reportSearch.trim().toLowerCase()
    const result = {}
    NAVIGATION_CATEGORIES.forEach(cat => {
      const reports = ALL_REPORTS.filter(r => r.category === cat.key)
      if (!q) {
        result[cat.key] = reports
      } else {
        result[cat.key] = reports.filter(r =>
          r.label.toLowerCase().includes(q) ||
          r.desc.toLowerCase().includes(q) ||
          cat.label.toLowerCase().includes(q)
        )
      }
    })
    return result
  }, [reportSearch])

  const totalMatchingReports = useMemo(() => {
    return Object.values(filteredReportsByCategory).reduce((sum, list) => sum + list.length, 0)
  }, [filteredReportsByCategory])

  useEffect(() => {
    if (!exportMenuOpen) return undefined
    const closeOnOutsideClick = event => {
      if (!exportMenuRef.current?.contains(event.target)) setExportMenuOpen(false)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setExportMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [exportMenuOpen])

  const isDateInvalid = !isSnapshotReport && startDate > endDate

  const fetchReport = useCallback(
    async (targetTab, dates) => {
      const isSnapshot = ['customers', 'outstanding_payables', 'stock_summary'].includes(targetTab)
      if (!isSnapshot && dates.start > dates.end) {
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
        const endpoint = ENDPOINTS[targetTab] || `/reports/${targetTab}/`
        const params = isSnapshot
          ? ''
          : `?start_date=${dates.start}&end_date=${dates.end}`

        const response = await api.get(`${endpoint}${params}`, {
          signal: controller.signal,
        })

        if (reqId === activeRequestRef.current) {
          setData(response.data)
          if (!reportsViewedRef.current) {
            reportsViewedRef.current = true
            api.post('/auth/onboarding/reports-viewed/').catch(() => {
              reportsViewedRef.current = false
            })
          }
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
          return
        }
        if (reqId === activeRequestRef.current) {
          const msg =
            err.response?.status === 403
              ? 'Reports are restricted to administrator and finance roles.'
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
    setDatePreset('year')
    const s = getYearStart()
    const e = getToday()
    setStartDate(s)
    setEndDate(e)
    setAppliedDates({ start: s, end: e })
  }

  const handleExport = async format => {
    if (!isSnapshotReport && appliedDates.start > appliedDates.end) {
      toast.error('Start date cannot be after end date')
      return
    }

    if (format === 'csv') {
      const filenameBase = REPORT_FILENAMES[tab] || `${tab}_report`
      const headers = data?.headers || []
      const rows = data?.rows || []
      if (headers.length === 0 || rows.length === 0) {
        toast.error('No tabular records to export as CSV')
        return
      }
      const escapeCell = val => {
        if (val === null || val === undefined) return '""'
        const str = String(val).replace(/"/g, '""')
        return `"${str}"`
      }
      const csvContent = [
        headers.map(escapeCell).join(','),
        ...rows.map(row => (Array.isArray(row) ? row : headers.map(h => row[h] ?? '')).map(escapeCell).join(','))
      ].join('\r\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filenameBase}_${getToday()}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Report exported as CSV spreadsheet')
      return
    }

    setExporting(format)
    try {
      const endpoint = ENDPOINTS[tab] || `/reports/${tab}/`
      const params = new URLSearchParams()
      if (!isSnapshotReport) {
        params.set('start_date', appliedDates.start)
        params.set('end_date', appliedDates.end)
      }
      params.set('export', format)

      const response = await api.get(`${endpoint}?${params.toString()}`, {
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
      const filenameBase = REPORT_FILENAMES[tab] || `${tab}_report`
      link.download = `${filenameBase}_${getToday()}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success(
        `Report exported as ${format === 'pdf' ? 'PDF (A4 Accounting standard)' : 'Excel (.xlsx native)'}`,
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
          font-variant-numeric: tabular-nums;
          background: var(--surface);
        }
        .reports-page .erp-report-table th {
          padding: 8px 12px;
          text-align: left;
          white-space: nowrap;
          background: var(--table-header-bg, #f8fafc);
          border-bottom: 1px solid var(--line);
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-secondary);
        }
        .reports-page .erp-report-table td {
          padding: 9px 12px;
          border-bottom: 1px solid var(--line-subtle, #f1f5f9);
          font-size: 13px;
          vertical-align: middle;
        }
        .reports-page .erp-report-table tbody tr:hover {
          background: var(--surface-hover, rgba(15, 23, 42, 0.02));
        }
        .dark .reports-page .erp-report-table tbody tr:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .reports-page .erp-report-table tfoot td {
          padding: 10px 12px;
          border-top: 2px solid var(--line);
          border-bottom: 2px solid var(--line);
          background: var(--table-header-bg, #f8fafc);
          font-weight: 700;
          font-size: 13px;
        }
        .reports-page .summary-strip-table {
          width: 100%;
          min-width: 640px;
          border-collapse: collapse;
          font-variant-numeric: tabular-nums;
          background: var(--surface);
        }
        .reports-page .summary-strip-table th {
          padding: 7px 12px;
          background: var(--table-header-bg, #f8fafc);
          border-bottom: 1px solid var(--line);
          font-size: 11px;
          font-weight: 600;
          color: var(--ink-secondary);
          text-align: left;
        }
        .reports-page .summary-strip-table td {
          padding: 9px 12px;
          font-size: 13px;
          border-bottom: 1px solid var(--line);
        }
      `}</style>

      {/* =====================================================
          PAGE HEADER (Unified ERP Style with Back Button)
      ====================================================== */}
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn-secondary h-8.5 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 rounded-lg shadow-2xs hover:bg-[var(--surface-hover)] transition cursor-pointer"
              title="Go back to previous page"
              aria-label="Go back"
            >
              <IconArrowLeft size={16} />
              <span className="hidden sm:inline">Back</span>
            </button>
            <span>Business Reports</span>
          </div>
        }
        subtitle="CA-ready financial statements, sales registers, ledgers, and GST compliance summaries."
        action={
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {/* Mobile Report Selector Drawer Trigger (< lg) */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="btn-secondary lg:hidden h-8.5 px-3 text-xs font-semibold inline-flex items-center gap-2 shrink-0 rounded-lg cursor-pointer"
              aria-label="Open report navigator"
            >
              <IconFolder size={15} className="text-[#0057B8]" />
              <span>Select Report</span>
              <span className="ml-0.5 rounded-full bg-[#0057B8]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#0057B8]">
                {currentReport?.label}
              </span>
            </button>

            <span className="hidden sm:inline-block text-xs font-mono px-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)]">
              22 Reports • Indian Accounting Standard
            </span>
          </div>
        }
      />

      {/* =====================================================
          TWO-COLUMN WORKSPACE:
          LEFT: Category & Sub-Category Selector (Adjacent to Main Menu Bar)
          RIGHT: Selected Report Workspace
      ====================================================== */}
      <div className="flex flex-col lg:flex-row items-start gap-4 sm:gap-5">
        {/* LEFT COLUMN: CATEGORIES & SUB-REPORTS NAVIGATOR (DESKTOP) */}
        <aside className="hidden lg:flex flex-col w-72 shrink-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-2xs sticky top-4 max-h-[calc(100vh-6rem)] overflow-hidden">
          <div className="flex items-center gap-2 px-1 pb-2 mb-2 border-b border-[var(--line-subtle)] shrink-0">
            <IconFolder size={16} className="text-[#0057B8]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Report Navigator
            </h2>
          </div>

          <ReportNavigationMenu
            reportSearch={reportSearch}
            setReportSearch={setReportSearch}
            expandedCategories={expandedCategories}
            toggleCategory={toggleCategory}
            expandAllCategories={expandAllCategories}
            collapseAllCategories={collapseAllCategories}
            filteredReportsByCategory={filteredReportsByCategory}
            totalMatchingReports={totalMatchingReports}
            tab={tab}
            onSelectReport={handleSelectReport}
          />
        </aside>

        {/* RIGHT COLUMN: MAIN REPORT WORKSPACE */}
        <div className="flex-1 min-w-0 w-full space-y-3.5">
          {/* Active Report Header Card */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#0057B8]/10 text-[#0057B8]">
                  {currentReport?.icon ? <currentReport.icon size={22} /> : <IconFileText size={22} />}
                </div>
                <div className="min-w-0 flex-1">
                  {/* Breadcrumb */}
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)] mb-1 truncate">
                    <span>Reports</span>
                    <span>/</span>
                    <span className="text-[#0057B8] font-medium">{activeCategoryObj.label}</span>
                    <span>/</span>
                    <span className="font-semibold text-[var(--ink)] truncate">{currentReport?.label}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-bold text-[var(--ink)]">
                      {currentReport?.label}
                    </h2>
                    <span className="rounded bg-[var(--surface-elevated)] px-2 py-0.5 text-[10px] font-mono uppercase text-[var(--muted)] font-semibold border border-[var(--line-subtle)]">
                      {currentReport?.category}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)] mt-0.5">{currentReport?.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                {/* Compact Filter Toggle Button */}
                {!isSnapshotReport && (
                  <button
                    type="button"
                    onClick={() => setFilterOpen(v => !v)}
                    className={`h-8.5 px-3 text-xs font-semibold inline-flex items-center gap-1.5 rounded-lg border transition cursor-pointer ${
                      filterOpen
                        ? 'bg-[#0057B8] text-white border-[#0057B8] shadow-xs'
                        : 'btn-secondary text-[var(--ink)]'
                    }`}
                    title="Toggle Date Filters"
                    aria-expanded={filterOpen}
                  >
                    <IconFilter size={15} className={filterOpen ? 'text-white' : 'text-[#0057B8]'} />
                    <span>Filter</span>
                    <IconChevronDown
                      size={13}
                      className={`transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}

                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={() => fetchReport(tab, appliedDates)}
                  disabled={loading}
                  title="Refresh Report Data"
                  className="btn-secondary h-8.5 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 rounded-lg cursor-pointer"
                >
                  <IconRefresh size={15} className={loading ? 'animate-spin' : ''} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>

                {/* Export Dropdown Menu */}
                <div className="relative" ref={exportMenuRef}>
                  <button
                    type="button"
                    onClick={() => setExportMenuOpen(open => !open)}
                    disabled={Boolean(exporting) || loading}
                    aria-haspopup="menu"
                    aria-expanded={exportMenuOpen}
                    className="btn-primary h-8.5 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 rounded-lg shadow-xs cursor-pointer"
                  >
                    <IconDownload size={15} />
                    <span>{exporting ? `Preparing ${exporting.toUpperCase()}…` : 'Export'}</span>
                    <IconChevronDown size={14} />
                  </button>
                  {exportMenuOpen && (
                    <div
                      role="menu"
                      aria-label="Choose report export format"
                      className="absolute right-0 top-full z-50 mt-1.5 min-w-52 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1 shadow-lg animate-in fade-in zoom-in-95 duration-100"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setExportMenuOpen(false); handleExport('pdf') }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                      >
                        <IconFileTypePdf size={16} className="text-rose-600 dark:text-rose-400" />
                        <span>Download PDF (A4 Accounting)</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setExportMenuOpen(false); handleExport('xlsx') }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                      >
                        <IconFileTypeXls size={16} className="text-emerald-600 dark:text-emerald-400" />
                        <span>Download Excel (.xlsx)</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setExportMenuOpen(false); handleExport('csv') }}
                        className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                      >
                        <IconFileSpreadsheet size={16} className="text-sky-600 dark:text-sky-400" />
                        <span>Download CSV</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Simple and Proper Date Filter Section */}
          {isSnapshotReport ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-2xs">
              <div className="flex items-center gap-2.5 text-xs text-[var(--muted)]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--surface-elevated)] text-[#0057B8]">
                  <IconInfoCircle size={16} />
                </div>
                <div>
                  <span className="font-semibold text-[var(--ink)]">Live Snapshot Ledger</span>
                  <p className="text-[11px] text-[var(--muted)]">
                    Reflects real-time outstanding balances and live stock valuation as of today. Date range filtering does not apply.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Active Reporting Period Pill Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-xs shadow-2xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[var(--muted)]">
                    <IconCalendar size={14} className="text-[#0057B8]" />
                    <span className="font-medium text-[var(--ink)]">Reporting Period:</span>
                  </div>
                  <span className="font-mono font-semibold text-[var(--ink)] bg-[var(--surface-elevated)] px-2 py-0.5 rounded border border-[var(--line-subtle)] text-xs">
                    {formatDate(appliedDates.start)} — {formatDate(appliedDates.end)}
                  </span>
                  <span className="text-[10px] font-sans font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#0057B8]/10 text-[#0057B8]">
                    {DATE_PRESETS.find(p => p.key === datePreset)?.label || 'Custom Period'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterOpen(v => !v)}
                  className="text-xs font-semibold text-[#0057B8] hover:underline inline-flex items-center gap-1 self-start sm:self-auto cursor-pointer"
                >
                  <IconFilter size={13} />
                  <span>{filterOpen ? 'Hide Filters' : 'Change Period / Custom Dates'}</span>
                </button>
              </div>

              {/* Expandable Filter Panel */}
              {filterOpen && (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--line-subtle)]">
                    <div className="flex items-center gap-2">
                      <IconFilter size={15} className="text-[#0057B8]" />
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                        Date Range &amp; Presets
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFilterOpen(false)}
                      className="text-[var(--muted)] hover:text-[var(--ink)] p-1 rounded-md hover:bg-[var(--surface-hover)] transition cursor-pointer"
                      aria-label="Close filter panel"
                    >
                      <IconX size={15} />
                    </button>
                  </div>

                  {/* Preset Quick Chips */}
                  <div>
                    <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider block mb-1.5">
                      Quick Presets
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {DATE_PRESETS.map(p => {
                        const isSelected = datePreset === p.key
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => applyPreset(p)}
                            className={`h-7 px-3 text-xs font-medium rounded-md transition cursor-pointer ${
                              isSelected
                                ? 'bg-[#0057B8] text-white font-semibold shadow-2xs'
                                : 'bg-[var(--surface-elevated)] text-[var(--ink)] hover:bg-[var(--surface-hover)] border border-[var(--line-subtle)]'
                            }`}
                          >
                            {p.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Date Inputs & Apply/Reset Actions */}
                  <div className="pt-2 border-t border-[var(--line-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-[var(--muted)]">From:</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={e => {
                            setStartDate(e.target.value)
                            setDatePreset('custom')
                          }}
                          className="h-8.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[#0057B8] transition"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-[var(--muted)]">To:</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={e => {
                            setEndDate(e.target.value)
                            setDatePreset('custom')
                          }}
                          className="h-8.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[#0057B8] transition"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          handleApplyFilters()
                          setFilterOpen(false)
                        }}
                        disabled={isDateInvalid || loading}
                        className="btn-primary h-8.5 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5 rounded-lg shadow-xs cursor-pointer"
                      >
                        <IconFilter size={14} />
                        <span>Apply</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleResetFilters()
                          setFilterOpen(false)
                        }}
                        disabled={loading}
                        className="btn-secondary h-8.5 px-3 text-xs font-semibold inline-flex items-center gap-1.5 rounded-lg cursor-pointer"
                        title="Reset to current financial year"
                      >
                        <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>

                  {isDateInvalid && (
                    <p className="text-xs text-rose-600 font-medium">
                      Start date cannot be after end date.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* REPORT CONTENT BODY */}
          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {loading ? (
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-12 text-center shadow-xs">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-[#0057B8] border-r-transparent"></div>
                <p className="mt-3 text-xs font-medium text-[var(--muted)]">Loading report data…</p>
              </div>
            ) : error ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-6 text-center text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-400">
                <IconAlertCircle size={24} className="mx-auto mb-2" />
                <p className="text-xs font-medium">{error}</p>
                <button
                  type="button"
                  onClick={() => fetchReport(tab, appliedDates)}
                  className="btn-secondary h-8 px-3 text-xs font-semibold inline-flex items-center gap-1.5 mt-3"
                >
                  <IconRefresh size={14} />
                  <span>Try Again</span>
                </button>
              </div>
            ) : data ? (
              <div>
                {tab === 'sales' && <SalesReportView data={data} />}
                {tab === 'purchases' && <PurchaseReportView data={data} />}
                {tab === 'products' && <ProductReportView data={data} />}
                {tab === 'profit' && <ProfitReportView data={data} />}
                {tab === 'gst' && <GSTReportView data={data} appliedDates={appliedDates} />}
                {tab === 'customers' && <CustomerReportView data={data} />}
                {tab === 'payments' && <PaymentReportView data={data} />}
                {tab === 'expenses' && <ExpenseReportView data={data} />}
                {![
                  'sales',
                  'purchases',
                  'products',
                  'profit',
                  'gst',
                  'customers',
                  'payments',
                  'expenses',
                ].includes(tab) && (
                  <TraditionalAccountingTableView data={data} reportMeta={currentReport} />
                )}
              </div>
            ) : null}
          </div>

          <InformationalBanner
            tip="Reports follow standard Indian Accounting principles. Use Export to download a PDF, Excel spreadsheet or CSV."
            className="my-3"
          />

          <footer className="flex flex-col gap-1 border-t border-[var(--line)] pt-3 text-[11px] text-[var(--muted)] sm:flex-row sm:items-center sm:justify-between">
            <span>
              {isSnapshotReport
                ? 'Reflects live business balances as of today.'
                : `Reporting period: ${formatDate(appliedDates.start)} to ${formatDate(appliedDates.end)}`}
            </span>
            <span>Amounts shown in INR (₹)</span>
          </footer>
        </div>
      </div>

      {/* MOBILE / TABLET SLIDE-OVER DRAWER (SLIDES FROM LEFT) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-start bg-black/40 backdrop-blur-xs transition-opacity lg:hidden">
          <div className="w-80 max-w-[85vw] h-full bg-[var(--surface)] p-3.5 shadow-xl flex flex-col justify-between border-r border-[var(--line)] animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)] mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <IconFolder size={18} className="text-[#0057B8]" />
                <h3 className="text-sm font-bold text-[var(--ink)]">Report Navigator</h3>
              </div>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="btn-secondary h-8 w-8 p-0 inline-flex items-center justify-center shrink-0"
                aria-label="Close report selector"
              >
                <IconX size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <ReportNavigationMenu
                reportSearch={reportSearch}
                setReportSearch={setReportSearch}
                expandedCategories={expandedCategories}
                toggleCategory={toggleCategory}
                expandAllCategories={expandAllCategories}
                collapseAllCategories={collapseAllCategories}
                filteredReportsByCategory={filteredReportsByCategory}
                totalMatchingReports={totalMatchingReports}
                tab={tab}
                onSelectReport={handleSelectReport}
              />
            </div>

            <div className="pt-2.5 border-t border-[var(--line)] text-center shrink-0">
              <p className="text-[11px] text-[var(--muted)]">Tap any report to view statement</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   TRADITIONAL INDIAN ACCOUNTING REPORT VIEW (UNIVERSAL)
========================================================= */
function TraditionalAccountingTableView({ data, reportMeta }) {
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const headers = Array.isArray(data?.headers) ? data.headers : []
  const rawRows = Array.isArray(data?.rows) ? data.rows : []
  const summaryRows = Array.isArray(data?.summary_rows) ? data.summary_rows : []
  const summaryObj = data?.summary && typeof data.summary === 'object' ? data.summary : null

  // Reset page when search or dataset changes
  useEffect(() => {
    setCurrentPage(1)
  }, [search, rawRows])

  // Filter rows based on search
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rawRows
    const q = search.toLowerCase()
    return rawRows.filter(row => {
      if (Array.isArray(row)) {
        return row.some(cell => String(cell ?? '').toLowerCase().includes(q))
      }
      if (typeof row === 'object' && row !== null) {
        return Object.values(row).some(cell => String(cell ?? '').toLowerCase().includes(q))
      }
      return false
    })
  }, [rawRows, search])

  // Paginated subset
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage, pageSize])

  // Helper to determine if column is monetary / numeric
  const isMonetaryCol = headerName => {
    const h = String(headerName || '').toLowerCase()
    return (
      h.includes('amount') ||
      h.includes('total') ||
      h.includes('tax') ||
      h.includes('price') ||
      h.includes('balance') ||
      h.includes('debit') ||
      h.includes('credit') ||
      h.includes('due') ||
      h.includes('valuation') ||
      h.includes('cost') ||
      h.includes('mrp') ||
      h.includes('revenue') ||
      h.includes('turnover') ||
      h.includes('profit') ||
      h.includes('paid') ||
      h.includes('inflow') ||
      h.includes('outflow')
    )
  }

  const isCenterCol = headerName => {
    const h = String(headerName || '').toLowerCase()
    return (
      h.includes('date') ||
      h.includes('time') ||
      h.includes('code') ||
      h.includes('no.') ||
      h.includes('number') ||
      h.includes('gstin') ||
      h.includes('hsn') ||
      h.includes('voucher') ||
      h.includes('mode') ||
      h.includes('unit') ||
      h.includes('status') ||
      h.includes('type')
    )
  }

  // Format cell value
  const renderCell = (val, headerName) => {
    if (val === null || val === undefined || val === '') return '—'
    if (typeof val === 'number') {
      if (isMonetaryCol(headerName)) {
        return <span className="font-mono font-medium">{fmtCurrency(val)}</span>
      }
      return <span className="font-mono">{fmtNumber(val)}</span>
    }
    const str = String(val)
    if (isCenterCol(headerName)) {
      return <span className="font-mono text-xs text-[var(--muted)]">{str}</span>
    }
    return <span>{str}</span>
  }

  return (
    <div className="space-y-4">
      {/* Summary Strip (if summaryRows or summaryObj is present) */}
      {(summaryRows.length > 0 || summaryObj) && (
        <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
          <div className="border-b border-[var(--line)] px-4 py-2 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              {reportMeta?.label || 'Accounting Summary'}
            </span>
            <span className="text-xs font-mono text-[var(--muted)]">
              {rawRows.length} total record(s)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="summary-strip-table">
              <thead>
                <tr>
                  {summaryRows.length > 0 ? (
                    summaryRows.map(([label], idx) => <th key={idx}>{label}</th>)
                  ) : summaryObj ? (
                    Object.keys(summaryObj).map((k, idx) => (
                      <th key={idx}>{k.replace(/_/g, ' ').toUpperCase()}</th>
                    ))
                  ) : null}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {summaryRows.length > 0 ? (
                    summaryRows.map(([label, val], idx) => {
                      const isMoney = isMonetaryCol(label)
                      return (
                        <td
                          key={idx}
                          className={`font-mono font-bold ${
                            isMoney ? 'text-teal-700 dark:text-teal-400' : 'text-[var(--ink)]'
                          }`}
                        >
                          {typeof val === 'number'
                            ? isMoney
                              ? fmtCurrency(val)
                              : fmtNumber(val)
                            : String(val ?? '—')}
                        </td>
                      )
                    })
                  ) : summaryObj ? (
                    Object.entries(summaryObj).map(([k, val], idx) => {
                      const isMoney = isMonetaryCol(k)
                      return (
                        <td
                          key={idx}
                          className={`font-mono font-bold ${
                            isMoney ? 'text-teal-700 dark:text-teal-400' : 'text-[var(--ink)]'
                          }`}
                        >
                          {typeof val === 'number'
                            ? isMoney
                              ? fmtCurrency(val)
                              : fmtNumber(val)
                            : String(val ?? '—')}
                        </td>
                      )
                    })
                  ) : null}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--table-header-bg, #f8fafc)] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              {reportMeta?.label || data?.title || 'Report Statement'}
            </h3>
            {reportMeta?.desc && (
              <p className="text-[11px] text-[var(--muted)] mt-0.5">{reportMeta.desc}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Search table…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full rounded border border-[var(--line)] bg-[var(--surface)] pl-8 pr-7 py-1 text-xs text-[var(--ink)] focus:outline-none focus:border-[#0057B8]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]"
                  aria-label="Clear search"
                >
                  <IconX size={12} />
                </button>
              )}
            </div>

            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[#0057B8]"
              title="Rows per page"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th className="w-12 text-center">#</th>
                {headers.map((h, idx) => {
                  const alignClass = isMonetaryCol(h)
                    ? 'text-right'
                    : isCenterCol(h)
                    ? 'text-center'
                    : 'text-left'
                  return (
                    <th key={idx} className={alignClass}>
                      {h}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={Math.max(headers.length + 1, 1)} className="py-8 text-center text-xs text-[var(--muted)]">
                    {search ? 'No records match your search query.' : 'No records found for the selected period.'}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, rowIdx) => {
                  const cells = Array.isArray(row)
                    ? row
                    : headers.map(h => row[h] ?? Object.values(row)[0])
                  const actualIndex = (currentPage - 1) * pageSize + rowIdx + 1
                  return (
                    <tr key={rowIdx}>
                      <td className="text-center font-mono text-xs text-[var(--muted)]">{actualIndex}</td>
                      {cells.map((cell, cIdx) => {
                        const h = headers[cIdx] || ''
                        const alignClass = isMonetaryCol(h)
                          ? 'text-right'
                          : isCenterCol(h)
                          ? 'text-center'
                          : 'text-left'
                        return (
                          <td key={cIdx} className={alignClass}>
                            {renderCell(cell, h)}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
            {filteredRows.length > 0 && headers.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2} className="font-bold">
                    Grand Total ({filteredRows.length} rows)
                  </td>
                  {headers.slice(1).map((h, cIdx) => {
                    const isMoney = isMonetaryCol(h)
                    if (!isMoney) return <td key={cIdx}></td>
                    const colIdx = cIdx + 1
                    const totalVal = filteredRows.reduce((sum, r) => {
                      const val = Array.isArray(r) ? r[colIdx] : r[h]
                      return sum + (typeof val === 'number' ? val : Number(val) || 0)
                    }, 0)
                    return (
                      <td
                        key={cIdx}
                        className="text-right font-mono font-bold text-teal-700 dark:text-teal-400"
                      >
                        {fmtCurrency(totalVal)}
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-2.5 border-t border-[var(--line)] bg-[var(--surface)] text-xs text-[var(--muted)]">
          <div>
            Showing <span className="font-semibold text-[var(--ink)] font-mono">{filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="font-semibold text-[var(--ink)] font-mono">{Math.min(currentPage * pageSize, filteredRows.length)}</span> of{' '}
            <span className="font-semibold text-[var(--ink)] font-mono">{filteredRows.length}</span> entries
            {rawRows.length !== filteredRows.length && ` (filtered from ${rawRows.length} total)`}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 self-center sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-secondary h-8 px-2.5 text-xs font-medium inline-flex items-center gap-1"
              >
                <IconChevronLeft size={13} />
                <span>Previous</span>
              </button>
              <span className="px-2 font-mono font-medium text-[var(--ink)]">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary h-8 px-2.5 text-xs font-medium inline-flex items-center gap-1"
              >
                <span>Next</span>
                <IconChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   1. SALES SUMMARY REPORT VIEW (CLEAN ACCOUNTING TABLE)
========================================================= */
function SalesReportView({ data }) {
  const summary = data?.summary || {}
  const rawDaily = Array.isArray(data?.daily) ? data.daily : []

  // Normalize daily records (supports both list of lists and list of objects)
  const daily = useMemo(() => {
    return rawDaily.map(row => {
      if (Array.isArray(row)) {
        return {
          date: row[0] || '—',
          count: Number(row[1] || 0),
          total: Number(row[2] || 0),
        }
      }
      return {
        date: row.created_at__date || row.date || '—',
        count: Number(row.count || 0),
        total: Number(row.total || row.total_sales || 0),
      }
    })
  }, [rawDaily])

  const totalInvoices = Number(summary.count || 0)
  const totalSales = Number(summary.gross_sales || summary.total_sales || 0)
  const netSales = Number(summary.net_sales || totalSales)

  return (
    <div className="space-y-4">
      {/* Executive Performance Summary Strip Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Sales Performance Overview</span>
          <span className="text-xs font-mono text-[var(--muted)]">{totalInvoices} invoice(s) completed</span>
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
                <th>Outstanding Due</th>
                <th className="text-right">Completed Invoices</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-[var(--ink)]">{fmtCurrency(totalSales)}</td>
                <td className="font-mono text-[var(--muted)]">{fmtCurrency(summary.total_discount || 0)}</td>
                <td className="font-mono text-[var(--muted)]">{fmtCurrency(summary.returns || 0)}</td>
                <td className="font-mono font-bold text-teal-700 dark:text-teal-400">{fmtCurrency(netSales)}</td>
                <td className="font-mono text-[var(--ink)]">{fmtCurrency(summary.total_tax || 0)}</td>
                <td className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{fmtCurrency(summary.collection || 0)}</td>
                <td className="font-mono font-bold text-amber-600 dark:text-amber-400">{fmtCurrency(summary.outstanding || 0)}</td>
                <td className="text-right font-mono font-bold text-[var(--ink)]">{fmtNumber(totalInvoices)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Daily Breakdown Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Daily Sales Register</h3>
          <span className="text-xs font-mono text-[var(--muted)]">{daily.length} day(s) recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="text-right">Invoices Completed</th>
                <th className="text-right">Average Order Value</th>
                <th className="text-right">Total Invoiced Sales</th>
              </tr>
            </thead>
            <tbody>
              {daily.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-[var(--muted)]">
                    No sales recorded in the selected period.
                  </td>
                </tr>
              ) : (
                daily.map((row, idx) => {
                  const dayCount = Number(row.count || 0)
                  const dayTotal = Number(row.total || 0)
                  const dayAvg = dayCount > 0 ? (dayTotal / dayCount).toFixed(2) : 0
                  return (
                    <tr key={idx}>
                      <td className="font-mono font-medium text-[var(--ink)]">{row.date}</td>
                      <td className="text-right font-mono text-[var(--ink)]">{fmtNumber(dayCount)}</td>
                      <td className="text-right font-mono text-[var(--muted)]">{fmtCurrency(dayAvg)}</td>
                      <td className="text-right font-mono font-bold text-[var(--ink)]">{fmtCurrency(dayTotal)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {daily.length > 0 && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="text-right font-mono">{fmtNumber(daily.reduce((sum, r) => sum + Number(r.count || 0), 0))}</td>
                  <td className="text-right font-mono text-[var(--muted)]">—</td>
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
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xs">
          <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
            Sales Revenue Trend (₹)
          </h4>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-subtle, #f1f5f9)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={v => `₹${v}`} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={v => [fmtCurrency(v), 'Sales']}
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--line)',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                />
                <Line type="monotone" dataKey="total" stroke="#1E3A5F" strokeWidth={2} dot={{ r: 2.5, fill: '#1E3A5F' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   2. PURCHASES REPORT VIEW (CLEAN ACCOUNTING TABLE)
========================================================= */
function PurchaseReportView({ data }) {
  const summary = data?.summary || {}
  const rawDaily = Array.isArray(data?.daily) ? data.daily : Array.isArray(data?.rows) ? data.rows : []

  const daily = useMemo(() => {
    return rawDaily.map(row => {
      if (Array.isArray(row)) {
        return {
          date: row[0] || '—',
          count: Number(row[1] || 0),
          total: Number(row[2] || 0),
        }
      }
      return {
        date: row.purchase_date || row.date || '—',
        count: Number(row.count || 0),
        total: Number(row.total || 0),
      }
    })
  }, [rawDaily])

  const totalPurchases = Number(summary.total_purchases || summary.total_amount || 0)
  const totalPaid = Number(summary.total_paid || summary.paid_amount || 0)
  const balanceDue = Number(summary.balance_due || (totalPurchases - totalPaid))
  const count = Number(summary.count || daily.length || 0)

  return (
    <div className="space-y-4">
      {/* Executive Purchase Summary Strip Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Inward Purchases Overview</span>
          <span className="text-xs font-mono text-[var(--muted)]">{count} bill(s) recorded</span>
        </div>
        <div className="overflow-x-auto">
          <table className="summary-strip-table">
            <thead>
              <tr>
                <th>Gross Inward Purchases</th>
                <th>Paid to Suppliers</th>
                <th>Purchase Returns</th>
                <th>Outstanding Payables</th>
                <th className="text-right">Purchase Bills Count</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-[var(--ink)]">{fmtCurrency(totalPurchases)}</td>
                <td className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{fmtCurrency(totalPaid)}</td>
                <td className="font-mono text-[var(--muted)]">{fmtCurrency(summary.returns || 0)}</td>
                <td className="font-mono font-bold text-rose-700 dark:text-rose-400">{fmtCurrency(balanceDue)}</td>
                <td className="text-right font-mono font-bold text-[var(--ink)]">{fmtNumber(count)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Purchases Breakdown Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Purchase Summary By Date</h3>
          <span className="text-xs font-mono text-[var(--muted)]">{daily.length} day(s) recorded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="text-right">Purchase Invoices</th>
                <th className="text-right">Total Inward Purchases Value</th>
              </tr>
            </thead>
            <tbody>
              {daily.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-xs text-[var(--muted)]">
                    No purchase bills recorded in the selected period.
                  </td>
                </tr>
              ) : (
                daily.map((row, idx) => (
                  <tr key={idx}>
                    <td className="font-mono font-medium text-[var(--ink)]">{row.date}</td>
                    <td className="text-right font-mono text-[var(--ink)]">{fmtNumber(row.count)}</td>
                    <td className="text-right font-mono font-bold text-[var(--ink)]">{fmtCurrency(row.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {daily.length > 0 && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="text-right font-mono">{fmtNumber(daily.reduce((sum, r) => sum + Number(r.count || 0), 0))}</td>
                  <td className="text-right font-mono text-teal-700 dark:text-teal-400">
                    {fmtCurrency(daily.reduce((sum, r) => sum + Number(r.total || 0), 0))}
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
   3. PRODUCT SALES REPORT VIEW (WITH SEARCH & METRICS)
========================================================= */
function ProductReportView({ data }) {
  const [search, setSearch] = useState('')
  const rawRows = Array.isArray(data)
    ? data
    : Array.isArray(data?.products)
      ? data.products
      : Array.isArray(data?.results)
        ? data.results
        : []

  const summary = data?.summary || {}
  const totalQty = summary.total_qty ?? rawRows.reduce((sum, r) => sum + Number(r.total_qty || 0), 0)
  const totalRevenue = summary.total_revenue ?? rawRows.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0)

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rawRows
    const q = search.toLowerCase()
    return rawRows.filter(r =>
      (r.product_name && r.product_name.toLowerCase().includes(q)) ||
      (r.sku && r.sku.toLowerCase().includes(q))
    )
  }, [rawRows, search])

  return (
    <div className="space-y-4">
      {/* Product Summary Strip Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Product Sales Summary</span>
          <span className="text-xs font-mono text-[var(--muted)]">{rawRows.length} catalog product(s) sold</span>
        </div>
        <div className="overflow-x-auto">
          <table className="summary-strip-table">
            <thead>
              <tr>
                <th>Unique Products Sold</th>
                <th>Total Units Dispatched</th>
                <th className="text-right">Total Product Turnover</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-[var(--ink)]">{fmtNumber(rawRows.length)}</td>
                <td className="font-mono font-bold text-indigo-700 dark:text-indigo-400">{fmtNumber(totalQty)}</td>
                <td className="text-right font-mono font-bold text-teal-700 dark:text-teal-400">{fmtCurrency(totalRevenue)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Product Sales Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--table-header-bg, #f8fafc)] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Item-Wise Sales Breakdown</h3>
          <div className="relative w-full sm:w-64">
            <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Search product or SKU…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded border border-[var(--line)] bg-[var(--surface)] pl-8 pr-3 py-1 text-xs text-[var(--ink)] focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th className="w-12 text-center">#</th>
                <th>Product Name</th>
                <th>SKU / Barcode</th>
                <th className="text-right">Quantity Sold</th>
                <th className="text-right">Avg Realized Price</th>
                <th className="text-right">Total Revenue</th>
                <th className="text-right">Revenue Share</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[var(--muted)]">
                    {search ? 'No products match your search.' : 'No product sales recorded in the selected period.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, i) => {
                  const qty = Number(r.total_qty || 0)
                  const rev = Number(r.total_revenue || 0)
                  const avgPrice = qty > 0 ? (rev / qty).toFixed(2) : 0
                  const share = totalRevenue > 0 ? ((rev / totalRevenue) * 100).toFixed(1) : 0
                  return (
                    <tr key={i}>
                      <td className="text-center font-mono text-xs text-[var(--muted)]">{i + 1}</td>
                      <td className="font-semibold text-[var(--ink)]">{r.product_name}</td>
                      <td className="font-mono text-xs text-[var(--muted)]">{r.sku || '—'}</td>
                      <td className="text-right font-mono font-medium text-[var(--ink)]">{fmtNumber(qty)}</td>
                      <td className="text-right font-mono text-[var(--muted)]">{fmtCurrency(avgPrice)}</td>
                      <td className="text-right font-mono font-bold text-[var(--ink)]">{fmtCurrency(rev)}</td>
                      <td className="text-right font-mono text-xs text-[var(--muted)]">{share}%</td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Grand Total</td>
                  <td className="text-right font-mono">{fmtNumber(totalQty)}</td>
                  <td className="text-right font-mono text-[var(--muted)]">—</td>
                  <td className="text-right font-mono text-teal-700 dark:text-teal-400">{fmtCurrency(totalRevenue)}</td>
                  <td className="text-right font-mono text-xs">100.0%</td>
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
   4. PROFIT & LOSS REPORT VIEW (EXECUTIVE ACCOUNTING FORMAT)
========================================================= */
function ProfitReportView({ data }) {
  const netRevenue = Number(data?.net_revenue ?? data?.revenue ?? data?.total_revenue ?? 0)
  const grossSales = Number(data?.gross_sales ?? netRevenue)
  const cogs = Number(data?.total_cogs ?? data?.total_cost ?? (grossSales - (data?.gross_profit ?? 0)))
  const grossProfit = Number(data?.gross_profit ?? data?.total_profit ?? (netRevenue - cogs))
  const grossMargin = data?.gross_margin ?? (netRevenue > 0 ? ((grossProfit / netRevenue) * 100).toFixed(1) : 0)
  const expenses = Number(data?.expenses ?? data?.operating_expenses ?? data?.total_expenses ?? 0)
  const returns = Number(data?.sales_returns ?? (grossSales - netRevenue))
  const netProfit = Number(data?.net_profit ?? (grossProfit - expenses))
  const netMargin = data?.net_margin ?? (netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(1) : 0)

  return (
    <div className="space-y-4">
      {/* Executive Financial Statement Summary Strip Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Profit &amp; Loss Overview</span>
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
                <th>Cost of Goods (COGS)</th>
                <th>Gross Operating Profit</th>
                <th>Operating Expenses</th>
                <th className="text-right">Net Operating Profit / (Loss)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono text-[var(--ink)]">{fmtCurrency(grossSales)}</td>
                <td className="font-mono font-bold text-[var(--ink)]">{fmtCurrency(netRevenue)}</td>
                <td className="font-mono text-[var(--muted)]">{fmtCurrency(cogs)}</td>
                <td className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{fmtCurrency(grossProfit)}</td>
                <td className="font-mono font-bold text-rose-700 dark:text-rose-400">{fmtCurrency(expenses)}</td>
                <td className={`text-right font-mono font-bold ${netProfit >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  {fmtCurrency(netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Statement of Profit & Loss Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Financial Statement Breakdown</h3>
          <span className="text-xs font-mono text-[var(--muted)]">Standard Operating Format</span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th>Account Head / Particulars</th>
                <th>Classification</th>
                <th className="text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-semibold text-[var(--ink)]">Gross Invoiced Sales</td>
                <td className="text-xs text-[var(--muted)]">Operating Revenue</td>
                <td className="text-right font-mono font-medium text-[var(--ink)]">{fmtCurrency(grossSales)}</td>
              </tr>
              {returns > 0 && (
                <tr>
                  <td className="text-[var(--muted)] pl-6">Less: Sales Returns &amp; Refunds</td>
                  <td className="text-xs text-[var(--muted)]">Deduction</td>
                  <td className="text-right font-mono text-rose-600 dark:text-rose-400">-{fmtCurrency(returns)}</td>
                </tr>
              )}
              <tr className="bg-[var(--surface-subtle)]">
                <td className="font-bold text-[var(--ink)]">Net Sales Revenue</td>
                <td className="text-xs font-semibold text-[var(--ink)]">Total Operating Revenue</td>
                <td className="text-right font-mono font-bold text-[var(--ink)]">{fmtCurrency(netRevenue)}</td>
              </tr>
              <tr>
                <td className="font-semibold text-[var(--ink)]">Less: Cost of Goods Sold (COGS / Purchases)</td>
                <td className="text-xs text-[var(--muted)]">Direct Inventory Costs</td>
                <td className="text-right font-mono text-[var(--muted)]">-{fmtCurrency(cogs)}</td>
              </tr>
              <tr className="bg-[var(--surface-subtle)] font-bold">
                <td className="text-emerald-700 dark:text-emerald-400">Gross Operating Profit</td>
                <td className="text-xs text-emerald-700 dark:text-emerald-400">{grossMargin}% Gross Margin</td>
                <td className="text-right font-mono text-emerald-700 dark:text-emerald-400">{fmtCurrency(grossProfit)}</td>
              </tr>
              <tr>
                <td className="font-semibold text-[var(--ink)]">Less: Total Operating Overhead &amp; Expenses</td>
                <td className="text-xs text-[var(--muted)]">Indirect Business Overheads</td>
                <td className="text-right font-mono text-rose-600 dark:text-rose-400">-{fmtCurrency(expenses)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="font-bold">Net Operating Profit / (Loss)</td>
                <td className="text-xs font-bold text-teal-700 dark:text-teal-400">{netMargin}% Net Margin</td>
                <td className={`text-right font-mono font-bold ${netProfit >= 0 ? 'text-teal-700 dark:text-teal-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  {fmtCurrency(netProfit)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   5. GST TAX SUMMARY REPORT VIEW (CA-READY & INFORMATIVE)
========================================================= */
function GSTReportView({ data, appliedDates }) {
  const [viewMode, setViewMode] = useState('slabs')
  const [gstr1Data, setGstr1Data] = useState(null)
  const [loadingGstr1, setLoadingGstr1] = useState(false)

  const rawRates = data?.rates || data?.by_rate || []
  const rates = useMemo(() => {
    if (rawRates.length > 0) {
      return rawRates.map(r => ({
        gst_percent: Number(r.gst_percent ?? 0),
        taxable: Number(r.taxable || r.taxable_amount || 0),
        tax: Number(r.tax || r.gst_collected || 0),
        cgst: Number(r.cgst || (r.tax ? r.tax / 2 : 0)),
        sgst: Number(r.sgst || (r.tax ? r.tax / 2 : 0)),
      }))
    }
    if (Array.isArray(data?.rows) && data.rows.length > 0) {
      return data.rows.map(r => {
        if (Array.isArray(r)) {
          const slabNum = parseFloat(String(r[0]).replace('%', '').replace('Slab', '').trim()) || 0
          return {
            gst_percent: slabNum,
            taxable: Number(r[1] || 0),
            cgst: Number(r[2] || 0),
            sgst: Number(r[3] || 0),
            tax: Number(r[4] || 0),
          }
        }
        return r
      })
    }
    return []
  }, [rawRates, data?.rows])

  const totalTaxable = Number(
    data?.total_taxable ?? rates.reduce((sum, r) => sum + Number(r.taxable || 0), 0),
  )
  const totalTax = Number(
    data?.total_tax ?? data?.total_gst ?? rates.reduce((sum, r) => sum + Number(r.tax || 0), 0),
  )
  const totalCgst = Number(data?.total_cgst ?? (totalTax / 2))
  const totalSgst = Number(data?.total_sgst ?? (totalTax / 2))

  useEffect(() => {
    if (viewMode === 'gstr1' && !gstr1Data) {
      setLoadingGstr1(true)
      api.get(`/reports/gstr1/?start_date=${appliedDates.start}&end_date=${appliedDates.end}`)
        .then(res => setGstr1Data(res.data))
        .catch(() => setGstr1Data({ rows: [] }))
        .finally(() => setLoadingGstr1(false))
    }
  }, [viewMode, appliedDates, gstr1Data])

  return (
    <div className="space-y-4">
      {/* Executive GST Summary Strip Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">GST Tax Liability Overview</span>
          <span className="text-xs font-mono text-[var(--muted)]">CGST + SGST Breakdown</span>
        </div>
        <div className="overflow-x-auto">
          <table className="summary-strip-table">
            <thead>
              <tr>
                <th>Taxable Turnover</th>
                <th>Output CGST (50%)</th>
                <th>Output SGST (50%)</th>
                <th className="text-right">Total Output GST Tax</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-[var(--ink)]">{fmtCurrency(totalTaxable)}</td>
                <td className="font-mono text-[var(--ink)]">{fmtCurrency(totalCgst)}</td>
                <td className="font-mono text-[var(--ink)]">{fmtCurrency(totalSgst)}</td>
                <td className="text-right font-mono font-bold text-teal-700 dark:text-teal-400">{fmtCurrency(totalTax)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Sub-navigation View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setViewMode('slabs')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === 'slabs'
                ? 'bg-[#0057B8] text-white shadow-xs'
                : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
            }`}
          >
            Slab-Wise Tax (GSTR-3B)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('gstr1')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === 'gstr1'
                ? 'bg-[#0057B8] text-white shadow-xs'
                : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
            }`}
          >
            Invoice Breakdown (GSTR-1)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calc')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              viewMode === 'calc'
                ? 'bg-[#0057B8] text-white shadow-xs'
                : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
            }`}
          >
            Tax Liability &amp; ITC
          </button>
        </div>

        <span className="text-[11px] font-mono text-[var(--muted)]">
          {rates.length} active tax rate slab(s)
        </span>
      </div>

      {/* SUB-VIEW 1: SLAB-WISE GST LIABILITY TABLE */}
      {viewMode === 'slabs' && (
        <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
          <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              GSTR-3B Rate Slab Breakdown
            </h3>
            <span className="text-xs font-mono text-[var(--muted)]">CGST + SGST Split</span>
          </div>

          <div className="overflow-x-auto">
            <table className="erp-report-table">
              <thead>
                <tr>
                  <th>Rate Slab</th>
                  <th className="text-right">Taxable Turnover</th>
                  <th className="text-right">Output CGST</th>
                  <th className="text-right">Output SGST</th>
                  <th className="text-right">Total GST Tax</th>
                  <th className="text-right">Share of Tax</th>
                </tr>
              </thead>
              <tbody>
                {rates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-[var(--muted)]">
                      No GST tax transactions recorded in this period.
                    </td>
                  </tr>
                ) : (
                  rates.map((r, i) => {
                    const taxable = Number(r.taxable || 0)
                    const tax = Number(r.tax || 0)
                    const cgst = Number(r.cgst || tax / 2)
                    const sgst = Number(r.sgst || tax / 2)
                    const share = totalTax > 0 ? ((tax / totalTax) * 100).toFixed(1) : 0
                    return (
                      <tr key={i}>
                        <td className="font-bold text-[var(--ink)]">
                          <span className="rounded border border-[var(--line)] bg-[var(--surface-subtle)] px-2 py-0.5 font-mono text-xs">
                            {r.gst_percent ?? 0}% GST
                          </span>
                        </td>
                        <td className="text-right font-mono font-medium text-[var(--ink)]">{fmtCurrency(taxable)}</td>
                        <td className="text-right font-mono text-[var(--muted)]">{fmtCurrency(cgst)}</td>
                        <td className="text-right font-mono text-[var(--muted)]">{fmtCurrency(sgst)}</td>
                        <td className="text-right font-mono font-bold text-teal-700 dark:text-teal-400">{fmtCurrency(tax)}</td>
                        <td className="text-right font-mono text-xs text-[var(--muted)]">{share}%</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              {rates.length > 0 && (
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td className="text-right font-mono">{fmtCurrency(totalTaxable)}</td>
                    <td className="text-right font-mono">{fmtCurrency(totalCgst)}</td>
                    <td className="text-right font-mono">{fmtCurrency(totalSgst)}</td>
                    <td className="text-right font-mono text-teal-700 dark:text-teal-400">{fmtCurrency(totalTax)}</td>
                    <td className="text-right font-mono text-xs">100.0%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: INVOICE BREAKDOWN (GSTR-1) */}
      {viewMode === 'gstr1' && (
        <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
          <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              GSTR-1 Outward Supplies Register
            </h3>
            <span className="text-xs font-mono text-[var(--muted)]">
              {loadingGstr1 ? 'Fetching invoices…' : `${gstr1Data?.rows?.length || 0} invoice(s)`}
            </span>
          </div>

          <div className="overflow-x-auto">
            {loadingGstr1 ? (
              <div className="p-8 text-center text-xs text-[var(--muted)]">Loading GSTR-1 records…</div>
            ) : (
              <table className="erp-report-table">
                <thead>
                  <tr>
                    <th>Invoice No.</th>
                    <th>Date</th>
                    <th>Customer Name</th>
                    <th>GSTIN</th>
                    <th>Place of Supply</th>
                    <th className="text-right">Taxable Value</th>
                    <th className="text-right">CGST</th>
                    <th className="text-right">SGST</th>
                    <th className="text-right">Invoice Total</th>
                  </tr>
                </thead>
                <tbody>
                  {!gstr1Data?.rows || gstr1Data.rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-[var(--muted)]">
                        No outward invoices found for this period.
                      </td>
                    </tr>
                  ) : (
                    gstr1Data.rows.map((row, idx) => (
                      <tr key={idx}>
                        <td className="font-mono font-bold text-[var(--ink)]">{row[0]}</td>
                        <td className="font-mono text-xs text-[var(--muted)]">{row[1]}</td>
                        <td className="font-medium text-[var(--ink)]">{row[2]}</td>
                        <td className="font-mono text-xs text-[var(--muted)]">{row[3]}</td>
                        <td className="text-xs text-[var(--muted)]">{row[4]}</td>
                        <td className="text-right font-mono">{fmtCurrency(row[5])}</td>
                        <td className="text-right font-mono text-[var(--muted)]">{fmtCurrency(row[6])}</td>
                        <td className="text-right font-mono text-[var(--muted)]">{fmtCurrency(row[7])}</td>
                        <td className="text-right font-mono font-bold text-teal-700 dark:text-teal-400">{fmtCurrency(row[9])}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: TAX LIABILITY & ITC SUMMARY */}
      {viewMode === 'calc' && (
        <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
          <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--table-header-bg, #f8fafc)]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Tax Liability &amp; Input Tax Credit (ITC) Summary
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="erp-report-table">
              <thead>
                <tr>
                  <th>Compliance Step</th>
                  <th>Description</th>
                  <th className="text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-bold text-[var(--ink)]">1. Output GST Liability</td>
                  <td className="text-xs text-[var(--muted)]">Total GST tax collected from customers on outward sales</td>
                  <td className="text-right font-mono font-bold text-[var(--ink)]">{fmtCurrency(totalTax)}</td>
                </tr>
                <tr>
                  <td className="font-bold text-emerald-700 dark:text-emerald-400">2. Eligible ITC (Input Tax Credit)</td>
                  <td className="text-xs text-[var(--muted)]">Claimed on verified purchases and supplier invoices</td>
                  <td className="text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">{fmtCurrency(0)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td className="font-bold text-teal-700 dark:text-teal-400">3. Net GST Tax Payable to Government</td>
                  <td className="text-xs text-[var(--muted)]">Payable via Electronic Cash Ledger for monthly GSTR-3B</td>
                  <td className="text-right font-mono font-bold text-teal-700 dark:text-teal-400">{fmtCurrency(totalTax)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* =========================================================
   6. CUSTOMER RECEIVABLES REPORT VIEW (WITH SEARCH)
========================================================= */
function CustomerReportView({ data }) {
  const [search, setSearch] = useState('')
  const rawCustomers = Array.isArray(data?.customers)
    ? data.customers
    : Array.isArray(data)
      ? data
      : []

  // Normalize customer records (supports both list of lists and list of objects)
  const rows = useMemo(() => {
    return rawCustomers.map(c => {
      if (Array.isArray(c)) {
        return {
          name: c[0] || '—',
          mobile: c[1] || '—',
          credit_limit: Number(c[2] || 0),
          outstanding_amount: Number(c[3] || 0),
        }
      }
      return {
        name: c.name || c.customer_name || '—',
        mobile: c.mobile || c.phone || '—',
        credit_limit: Number(c.credit_limit || 0),
        outstanding_amount: Number(c.outstanding_amount || c.balance || c.balance_due || 0),
      }
    })
  }, [rawCustomers])

  const totalOutstanding = Number(
    data?.total_outstanding ?? rows.reduce((sum, c) => sum + Number(c.outstanding_amount || 0), 0),
  )

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.mobile && c.mobile.toLowerCase().includes(q))
    )
  }, [rows, search])

  return (
    <div className="space-y-4">
      {/* Customer Receivables Summary Strip Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Receivables Overview</span>
          <span className="text-xs font-mono text-[var(--muted)]">{rows.length} debtor account(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="summary-strip-table">
            <thead>
              <tr>
                <th>Total Outstanding Receivables</th>
                <th>Customers with Due Balance</th>
                <th className="text-right">Average Due per Debtor</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-rose-700 dark:text-rose-400">{fmtCurrency(totalOutstanding)}</td>
                <td className="font-mono font-bold text-[var(--ink)]">{fmtNumber(rows.length)}</td>
                <td className="text-right font-mono font-bold text-[var(--ink)]">
                  {fmtCurrency(rows.length > 0 ? (totalOutstanding / rows.length).toFixed(2) : 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Ledger Balances Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--table-header-bg, #f8fafc)] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Customer Ledger Balances</h3>
          <div className="relative w-full sm:w-64">
            <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Search customer or mobile…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded border border-[var(--line)] bg-[var(--surface)] pl-8 pr-3 py-1 text-xs text-[var(--ink)] focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th className="w-12 text-center">#</th>
                <th>Customer Name</th>
                <th>Mobile Number</th>
                <th className="text-right">Credit Limit</th>
                <th className="text-right">Outstanding Balance</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[var(--muted)]">
                    {search ? 'No customers match your search.' : 'No customers with outstanding credit balance.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((c, i) => {
                  const bal = Number(c.outstanding_amount || 0)
                  const limit = Number(c.credit_limit || 0)
                  const isExceeded = limit > 0 && bal > limit
                  return (
                    <tr key={i}>
                      <td className="text-center font-mono text-xs text-[var(--muted)]">{i + 1}</td>
                      <td className="font-semibold text-[var(--ink)]">{c.name}</td>
                      <td className="font-mono text-xs text-[var(--muted)]">{c.mobile || '—'}</td>
                      <td className="text-right font-mono text-[var(--muted)]">{limit > 0 ? fmtCurrency(limit) : 'No Limit'}</td>
                      <td className="text-right font-mono font-bold text-rose-700 dark:text-rose-400">{fmtCurrency(bal)}</td>
                      <td className="text-center">
                        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold ${
                          isExceeded
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                        }`}>
                          {isExceeded ? 'Exceeded' : 'Active Due'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {filteredRows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>Grand Total Outstanding</td>
                  <td className="text-right font-mono text-rose-700 dark:text-rose-400">{fmtCurrency(totalOutstanding)}</td>
                  <td></td>
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
   7. PAYMENT MODES REPORT VIEW
========================================================= */
function PaymentReportView({ data }) {
  const methods = Array.isArray(data?.methods) ? data.methods : []
  const totalAmount = Number(
    data?.total_amount ?? methods.reduce((sum, m) => sum + Number(m.total || m.total_amount || 0), 0),
  )
  const totalCount = Number(
    data?.total_count ?? methods.reduce((sum, m) => sum + Number(m.count || 0), 0),
  )

  return (
    <div className="space-y-4">
      {/* Payment Modes Summary Strip Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Collections Summary</span>
          <span className="text-xs font-mono text-[var(--muted)]">{methods.length} mode(s) utilized</span>
        </div>
        <div className="overflow-x-auto">
          <table className="summary-strip-table">
            <thead>
              <tr>
                <th>Total Collections</th>
                <th>Receipts Processed</th>
                <th className="text-right">Active Payment Modes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-teal-700 dark:text-teal-400">{fmtCurrency(totalAmount)}</td>
                <td className="font-mono font-bold text-[var(--ink)]">{fmtNumber(totalCount)}</td>
                <td className="text-right font-mono font-bold text-[var(--ink)]">{fmtNumber(methods.length)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modes Detailed Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Payment Mode Breakdown</h3>
          <span className="text-xs font-mono text-[var(--muted)]">{methods.length} mode(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th className="w-12 text-center">#</th>
                <th>Payment Mode</th>
                <th className="text-right">Transaction Count</th>
                <th className="text-right">Avg Ticket Size</th>
                <th className="text-right">Total Amount Collected</th>
                <th className="text-right">Share of Total</th>
              </tr>
            </thead>
            <tbody>
              {methods.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[var(--muted)]">
                    No payment collections recorded in this period.
                  </td>
                </tr>
              ) : (
                methods.map((m, i) => {
                  const amt = Number(m.total || m.total_amount || 0)
                  const count = Number(m.count || 0)
                  const avg = count > 0 ? (amt / count).toFixed(2) : 0
                  const share = totalAmount > 0 ? ((amt / totalAmount) * 100).toFixed(1) : 0
                  return (
                    <tr key={i}>
                      <td className="text-center font-mono text-xs text-[var(--muted)]">{i + 1}</td>
                      <td className="font-bold text-[var(--ink)] uppercase tracking-wide text-xs">
                        {m.method || m.payment_method || 'Cash'}
                      </td>
                      <td className="text-right font-mono font-medium text-[var(--ink)]">{fmtNumber(count)}</td>
                      <td className="text-right font-mono text-[var(--muted)]">{fmtCurrency(avg)}</td>
                      <td className="text-right font-mono font-bold text-[var(--ink)]">{fmtCurrency(amt)}</td>
                      <td className="text-right font-mono text-xs text-[var(--muted)]">{share}%</td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {methods.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>Total</td>
                  <td className="text-right font-mono">{fmtNumber(totalCount)}</td>
                  <td className="text-right font-mono text-[var(--muted)]">—</td>
                  <td className="text-right font-mono text-teal-700 dark:text-teal-400">{fmtCurrency(totalAmount)}</td>
                  <td className="text-right font-mono text-xs">100.0%</td>
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
   8. OPERATING EXPENSES REPORT VIEW (WITH SEARCH)
========================================================= */
function ExpenseReportView({ data }) {
  const [search, setSearch] = useState('')
  const rawData = Array.isArray(data?.expenses)
    ? data.expenses
    : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data)
        ? data
        : []

  // Normalize expense records (supports both list of lists and list of objects)
  const expenses = useMemo(() => {
    return rawData.map(e => {
      if (Array.isArray(e)) {
        return {
          expense_date: e[0] || '—',
          category: e[1] || 'General',
          description: e[2] || '—',
          payment_method: e[3] || 'CASH',
          amount: Number(e[4] || 0),
          created_by: e[5] || '—',
        }
      }
      return {
        expense_date: e.expense_date || e.date || '—',
        category: e.category || e.category_name || 'General',
        description: e.description || e.notes || '—',
        payment_method: e.payment_method || 'CASH',
        amount: Number(e.amount || 0),
        created_by: e.created_by || '—',
      }
    })
  }, [rawData])

  const totalAmount = Number(
    data?.total_amount ?? data?.total_expenses ?? expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
  )

  const filteredExpenses = useMemo(() => {
    if (!search.trim()) return expenses
    const q = search.toLowerCase()
    return expenses.filter(e =>
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q)) ||
      (e.payment_method && e.payment_method.toLowerCase().includes(q))
    )
  }, [expenses, search])

  return (
    <div className="space-y-4">
      {/* Operating Expenses Summary Strip Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2 bg-[var(--table-header-bg, #f8fafc)] flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Expenses Overview</span>
          <span className="text-xs font-mono text-[var(--muted)]">{expenses.length} record(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="summary-strip-table">
            <thead>
              <tr>
                <th>Total Operating Overhead</th>
                <th>Expense Records</th>
                <th className="text-right">Average Expense Size</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-mono font-bold text-rose-700 dark:text-rose-400">{fmtCurrency(totalAmount)}</td>
                <td className="font-mono font-bold text-[var(--ink)]">{fmtNumber(expenses.length)}</td>
                <td className="text-right font-mono font-bold text-[var(--ink)]">
                  {fmtCurrency(expenses.length > 0 ? (totalAmount / expenses.length).toFixed(2) : 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Operating Expenses Table */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="border-b border-[var(--line)] px-4 py-2.5 bg-[var(--table-header-bg, #f8fafc)] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">Operating Expenses Register</h3>
          <div className="relative w-full sm:w-64">
            <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Search category, description…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded border border-[var(--line)] bg-[var(--surface)] pl-8 pr-3 py-1 text-xs text-[var(--ink)] focus:outline-none focus:border-[#1E3A5F]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="erp-report-table">
            <thead>
              <tr>
                <th className="w-12 text-center">#</th>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Payment Mode</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-[var(--muted)]">
                    {search ? 'No expenses match your search.' : 'No expenses recorded in the selected period.'}
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp, i) => {
                  const amt = Number(exp.amount || 0)
                  const share = totalAmount > 0 ? ((amt / totalAmount) * 100).toFixed(1) : 0
                  return (
                    <tr key={i}>
                      <td className="text-center font-mono text-xs text-[var(--muted)]">{i + 1}</td>
                      <td className="font-mono text-xs text-[var(--muted)]">{exp.expense_date}</td>
                      <td className="font-semibold text-[var(--ink)]">{exp.category}</td>
                      <td className="text-xs text-[var(--ink)]">{exp.description}</td>
                      <td className="font-mono text-xs uppercase text-[var(--muted)]">{exp.payment_method}</td>
                      <td className="text-right font-mono font-bold text-rose-700 dark:text-rose-400">{fmtCurrency(amt)}</td>
                      <td className="text-right font-mono text-xs text-[var(--muted)]">{share}%</td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {filteredExpenses.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5}>Grand Total</td>
                  <td className="text-right font-mono text-rose-700 dark:text-rose-400">{fmtCurrency(totalAmount)}</td>
                  <td className="text-right font-mono text-xs">100.0%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}