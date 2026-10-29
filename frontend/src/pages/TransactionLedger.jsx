
import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../api'
import {
  IconRefresh,
  IconAlertCircle,
  IconCircleCheck,
  IconCircleX,
  IconClockHour3,
  IconCreditCard,
  IconWallet,
  IconDeviceMobile,
  IconBuildingStore,
  IconCopy,
  IconCheck,
  IconX,
  IconDownload,
  IconReceiptTax,
  IconUser,
  IconCalendarEvent,
  IconHash,
  IconShieldCheck,
  IconArrowUpRight,
  IconCash,
  IconFilter,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'
import { SearchBar } from '../components/UI'
import { MobileKpiGrid } from '../components/MobileUI'

// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const STATUS_COLORS = {
  created: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700',
  initiated: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-700',
  pending: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700',
  success: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700',
  captured: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700',
  failed: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-700',
  expired: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/60 dark:text-slate-300 dark:border-slate-700',
  refunded: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-700',
}

const STATUS_DOT_COLORS = {
  success: 'bg-[#15803D]',
  captured: 'bg-[#15803D]',
  failed: 'bg-[#B91C1C]',
  pending: 'bg-[#B45309]',
  initiated: 'bg-[#2563EB]',
  created: 'bg-[#64748B]',
  expired: 'bg-[#64748B]',
  refunded: 'bg-[#C2410C]',
}

const STATUS_ICONS = {
  success: IconCircleCheck,
  captured: IconCircleCheck,
  failed: IconCircleX,
  pending: IconClockHour3,
  initiated: IconClockHour3,
  created: IconClockHour3,
  expired: IconClockHour3,
  refunded: IconArrowUpRight,
}

const PAYMENT_METHODS = [
  'All methods',
  'upi',
  'card',
  'netbanking',
  'wallet',
  'emi',
  'bank_transfer',
]

// Planning estimate only. Razorpay's actual fee depends on merchant pricing
// and payment method, so statement-reported fees take precedence when present.
const ESTIMATED_GATEWAY_FEE_RATE = 0.02

// --------------------------------------------------
// FORMATTERS
// --------------------------------------------------

const fmt = (value, currency = 'INR') => {
  const amount = Number(value || 0)

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `₹${amount.toFixed(2)}`
  }
}

const fmtCompact = (value, currency = 'INR') => {
  const amount = Number(value || 0)

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  } catch {
    return fmt(amount, currency)
  }
}

const fmtDate = (value) => {
  if (!value) return '—'

  try {
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return '—'

    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

const fmtDateOnly = (value) => {
  if (!value) return '—'

  try {
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

const displayValue = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

const titleCase = (value) => {
  if (!value) return '—'

  return String(value)
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

const getPaymentMethod = (row) =>
  row.method ||
  row.payment_method ||
  row.paymentMethod ||
  row.razorpay_method ||
  row.details?.method ||
  row.payment_details?.method ||
  ''

const getCurrency = (row) =>
  row.currency ||
  row.razorpay_currency ||
  row.details?.currency ||
  'INR'

const getStatus = (row) =>
  String(row.status || row.payment_status || '').toLowerCase()

const getCustomerName = (row) =>
  row.customer_name ||
  row.customerName ||
  row.contact_name ||
  row.customer?.name ||
  row.notes?.customer_name ||
  ''

const getCustomerEmail = (row) =>
  row.email ||
  row.customer_email ||
  row.customerEmail ||
  row.customer?.email ||
  row.contact_email ||
  ''

const getCustomerPhone = (row) =>
  row.contact ||
  row.phone ||
  row.customer_phone ||
  row.customerPhone ||
  row.customer?.contact ||
  ''

const getOrderId = (row) =>
  row.razorpay_order_id ||
  row.order_id ||
  row.orderId ||
  row.razorpay?.order_id ||
  ''

const getPaymentId = (row) =>
  row.razorpay_payment_id ||
  row.payment_id ||
  row.paymentId ||
  row.razorpay?.payment_id ||
  ''

const getInvoiceNumber = (row) =>
  row.invoice_number ||
  row.invoice?.invoice_number ||
  row.invoice?.number ||
  row.invoice_no ||
  ''

const getAmount = (row) =>
  row.amount ??
  row.total_amount ??
  row.payment_amount ??
  row.razorpay_amount ??
  0

const getReportedFee = (row) => {
  const value = row.fee ?? row.fees ?? row.razorpay_fee ?? row.details?.fee ?? row.payment_details?.fee
  return value === null || value === undefined || value === '' ? null : Number(value)
}

const getEstimatedFee = (row) => {
  if (!['success', 'captured'].includes(getStatus(row))) return 0
  return Math.round(Number(getAmount(row) || 0) * ESTIMATED_GATEWAY_FEE_RATE * 100) / 100
}

const getReconciliationFee = (row) => getReportedFee(row) ?? getEstimatedFee(row)

const getTax = (row) =>
  row.tax ??
  row.tax_amount ??
  row.razorpay_tax ??
  row.details?.tax ??
  row.payment_details?.tax ??
  0

const getFailureReason = (row) =>
  row.failure_reason ||
  row.error_description ||
  row.error_reason ||
  row.error?.description ||
  row.error?.reason ||
  row.details?.error_description ||
  ''

const getCreatedAt = (row) =>
  row.created_at ||
  row.createdAt ||
  row.created ||
  row.timestamp ||
  row.payment_created_at ||
  ''

const getCapturedAt = (row) =>
  row.captured_at ||
  row.capturedAt ||
  row.payment_captured_at ||
  ''

const getRefundAmount = (row) =>
  row.refund_amount ??
  row.refunded_amount ??
  row.amount_refunded ??
  0

const normalizeRows = (data) => {
  if (Array.isArray(data)) return data

  if (Array.isArray(data?.results)) return data.results

  if (Array.isArray(data?.data)) return data.data

  if (Array.isArray(data?.transactions)) return data.transactions

  if (Array.isArray(data?.payments)) return data.payments

  return []
}

// --------------------------------------------------
// REUSABLE UI
// --------------------------------------------------

function StatusBadge({ status }) {
  const norm = String(status || '').toLowerCase()
  const dot = STATUS_DOT_COLORS[norm] || 'bg-slate-400'
  const style =
    STATUS_COLORS[norm] ||
    'bg-white text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize whitespace-nowrap ${style}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
      {titleCase(status || 'unknown')}
    </span>
  )
}

function MethodBadge({ method }) {
  const normalized = String(method || '').toLowerCase()

  const icon =
    normalized === 'upi' ? (
      <IconDeviceMobile size={14} />
    ) : normalized === 'card' ? (
      <IconCreditCard size={14} />
    ) : normalized === 'wallet' ? (
      <IconWallet size={14} />
    ) : normalized === 'netbanking' ? (
      <IconBuildingStore size={14} />
    ) : (
      <IconCash size={14} />
    )

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-secondary)]">
      {icon}
      {titleCase(method || 'Unknown')}
    </span>
  )
}

function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false)

  if (!value) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(value))
      setCopied(true)
      toast.success(`${label} copied`)

      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Unable to copy')
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center justify-center rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)] transition-colors"
      title={`Copy ${label}`}
      aria-label={`Copy ${label}`}
    >
      {copied ? (
        <IconCheck size={14} className="text-emerald-600" />
      ) : (
        <IconCopy size={14} />
      )}
    </button>
  )
}

function DetailItem({ label, value, mono = false, copyable = false }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </div>

      <div className="flex items-center gap-1 min-w-0">
        <div
          className={`min-w-0 break-words text-sm text-[var(--ink)] ${
            mono ? 'font-mono text-xs' : ''
          }`}
        >
          {displayValue(value)}
        </div>

        {copyable && value && <CopyButton value={value} label={label} />}
      </div>
    </div>
  )
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--line-subtle)] pb-3">
      <Icon size={16} className="text-[var(--primary)]" />
      <h3 className="text-sm font-bold text-[var(--ink)]">{children}</h3>
    </div>
  )
}


// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------

export default function TransactionLedger() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatus] = useState('')
  const [methodFilter, setMethod] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedRow, setSelectedRow] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [reviewOnly, setReviewOnly] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      const params = {
        page_size: 200,
      }

      if (statusFilter) {
        params.status = statusFilter
      }

      if (search.trim()) {
        params.search = search.trim()
      }

      if (methodFilter) {
        params.method = methodFilter
      }

      if (dateFilter) {
        params.date = dateFilter
      }

      const res = await api.get(
        '/payments/razorpay/reconciliation/',
        { params }
      )

      setRows(normalizeRows(res.data))
    } catch (error) {
      console.error('Transaction ledger load error:', error)
      setLoadError('Unable to load transactions. Check your connection and try again.')
      toast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, methodFilter, dateFilter])

  useEffect(() => {
    load()
  }, [load])

  // --------------------------------------------------
  // SUMMARY
  // --------------------------------------------------

  const summary = useMemo(() => {
    const successful = rows.filter((row) =>
      ['success', 'captured'].includes(getStatus(row))
    )

    const failed = rows.filter(
      (row) => getStatus(row) === 'failed'
    )

    const pending = rows.filter((row) =>
      ['created', 'initiated', 'pending'].includes(getStatus(row))
    )

    const refunded = rows.filter(
      (row) => getStatus(row) === 'refunded'
    )

    const amount = successful.reduce(
      (sum, row) => sum + Number(getAmount(row) || 0),
      0
    )

    const feeRows = successful.map(row => ({ row, reported: getReportedFee(row) }))
    const fees = feeRows.reduce(
      (sum, item) => sum + (item.reported ?? getEstimatedFee(item.row)),
      0
    )
    const hasEstimatedFees = feeRows.some(item => item.reported === null)

    const tax = rows.reduce(
      (sum, row) => sum + Number(getTax(row) || 0),
      0
    )

    const refunds = rows.reduce(
      (sum, row) => sum + Number(getRefundAmount(row) || 0),
      0
    )

    const net = amount - fees - tax - refunds

    const successRate = rows.length
      ? (successful.length / rows.length) * 100
      : 0
    const unlinked = rows.filter(row => !getInvoiceNumber(row)).length

    return {
      total: rows.length,
      success: successful.length,
      failed: failed.length,
      pending: pending.length,
      refunded: refunded.length,
      amount,
      fees,
      hasEstimatedFees,
      tax,
      refunds,
      net,
      successRate,
      unlinked,
    }
  }, [rows])

  // --------------------------------------------------
  // LOCAL SEARCH FALLBACK
  // --------------------------------------------------

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase()

    return rows.filter((row) => {
      const status = getStatus(row)
      const method = getPaymentMethod(row).toLowerCase()

      const searchable = [
        getInvoiceNumber(row),
        getOrderId(row),
        getPaymentId(row),
        getCustomerName(row),
        getCustomerEmail(row),
        getCustomerPhone(row),
        row.provider,
        method,
        status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        !query || searchable.includes(query)

      const matchesStatus =
        !statusFilter || status === statusFilter

      const matchesMethod =
        !methodFilter || method === methodFilter

      const needsReview = !getInvoiceNumber(row)
      return matchesSearch && matchesStatus && matchesMethod && (!reviewOnly || needsReview)
    })
  }, [rows, search, statusFilter, methodFilter, reviewOnly])

  // --------------------------------------------------
  // CSV EXPORT
  // --------------------------------------------------

  const exportCSV = () => {
    if (!visibleRows.length) {
      toast.error('No transactions to export')
      return
    }

    const headers = [
      'Invoice',
      'Amount',
      'Currency',
      'Gateway',
      'Order ID',
      'Payment ID',
      'Status',
      'Payment Method',
      'Customer Name',
      'Email',
      'Contact',
      'Gateway Fee (actual or estimated at 2%)',
      'Tax',
      'Refund Amount',
      'Failure Reason',
      'Created At',
      'Captured At',
    ]

    const data = visibleRows.map((row) => [
      getInvoiceNumber(row),
      getAmount(row),
      getCurrency(row),
      row.provider || 'Razorpay',
      getOrderId(row),
      getPaymentId(row),
      getStatus(row),
      getPaymentMethod(row),
      getCustomerName(row),
      getCustomerEmail(row),
      getCustomerPhone(row),
      getReconciliationFee(row),
      getTax(row),
      getRefundAmount(row),
      getFailureReason(row),
      getCreatedAt(row),
      getCapturedAt(row),
    ])

    const escapeCSV = (value) => {
      const stringValue = String(value ?? '')
      return `"${stringValue.replace(/"/g, '""')}"`
    }

    const csv = [
      headers,
      ...data,
    ]
      .map((line) => line.map(escapeCSV).join(','))
      .join('\n')

    const blob = new Blob([`\ufeff${csv}`], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `transaction-ledger-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`

    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)

    toast.success('CSV exported successfully')
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="min-h-full w-full min-w-0 text-[var(--ink)]">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <header className="flex flex-col justify-between gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Transaction Ledger</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">View, search, audit, and reconcile all payment transactions in one place.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={exportCSV} disabled={loading || !visibleRows.length} className="btn-secondary inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold shadow-2xs">
              <IconDownload size={14} /> <span>Export CSV</span>
            </button>
          </div>
        </header>

        {/* Mobile KPI Grid (Displays 2 initially with Show more for 3rd) */}
        <MobileKpiGrid
          title="Ledger Summary"
          allKpis={[
            {
              label: 'Transactions',
              value: summary.total.toLocaleString('en-IN'),
              sub: `${summary.success} successful · ${summary.failed} failed`,
            },
            {
              label: 'Collected',
              value: fmt(summary.amount),
              sub: `${summary.successRate.toFixed(1)}% success rate`,
            },
            {
              label: 'Reconciliation · Net',
              value: fmt(summary.net),
              sub: 'After fees, tax & refunds',
            },
          ]}
        />

        {/* Desktop/Tablet KPI Summary */}
        <section aria-label="Ledger summary" className="hidden md:grid md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Transactions</h2>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{summary.total.toLocaleString('en-IN')}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{summary.success} successful <span className="px-1">·</span>{summary.failed} failed <span className="px-1">·</span>{summary.pending} pending</p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Collected</h2>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{fmt(summary.amount)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Successful payments <span className="px-1">·</span>{summary.successRate.toFixed(1)}% success rate</p>
          </div>
          <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3.5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Reconciliation · Net</h2>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{fmt(summary.net)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Net after gateway fees, tax, and refunds</p>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--line)] pb-3 text-xs text-[var(--muted)]">
          <span><strong className="font-semibold text-[var(--ink)]">{summary.unlinked}</strong> needing review</span>
          <span><strong className="font-semibold text-[var(--ink)]">{summary.refunded}</strong> refunded</span>
          <span><strong className="font-semibold text-[var(--ink)]">{fmt(summary.fees)}</strong> {summary.hasEstimatedFees ? 'estimated gateway fee' : 'gateway fee'}</span>
          <span><strong className="font-semibold text-[var(--ink)]">{fmt(summary.refunds)}</strong> refunds</span>
          <span><strong className="font-semibold text-[var(--ink)]">{fmt(summary.tax)}</strong> tax</span>
        </div>

        <section aria-label="Search and filters" className="flex flex-col gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <SearchBar value={search} onChange={setSearch} placeholder="Search invoice, order ID, payment ID, customer..." className="min-w-0 w-full" shortcut="Ctrl+K" />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(v => !v)}
              className="lg:hidden inline-flex h-[38px] items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] shadow-2xs shrink-0"
              aria-label="Toggle filters"
            >
              <IconFilter size={15} />
              <span>Filters</span>
              {(statusFilter || methodFilter || dateFilter || reviewOnly) ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">
                  {[statusFilter, methodFilter, dateFilter, reviewOnly].filter(Boolean).length}
                </span>
              ) : null}
            </button>
          </div>

          <div className={`${showFilters ? 'flex' : 'hidden'} lg:flex flex-col lg:flex-row flex-wrap gap-2 items-stretch lg:items-center pt-2 lg:pt-0 border-t border-[var(--line-subtle)] lg:border-t-0`}>
            <select aria-label="Filter by status" className="h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs" value={statusFilter} onChange={e => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {['success', 'failed', 'pending', 'created', 'initiated', 'refunded', 'expired'].map(status => <option key={status} value={status}>{titleCase(status)}</option>)}
            </select>
            <select aria-label="Filter by payment method" className="h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs" value={methodFilter} onChange={e => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map(method => <option key={method} value={method === 'All methods' ? '' : method}>{method === 'All methods' ? method : titleCase(method)}</option>)}
            </select>
            <input aria-label="Filter by transaction date" type="date" className="h-10 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
            <button type="button" onClick={() => setReviewOnly(value => !value)} aria-pressed={reviewOnly} className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-medium ${reviewOnly ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : 'border-[var(--line)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]'}`}>
              <IconAlertCircle size={14} /> Needs review <span>{summary.unlinked}</span>
            </button>
            {(search || statusFilter || methodFilter || dateFilter || reviewOnly) && <button type="button" onClick={() => { setSearch(''); setStatus(''); setMethod(''); setDateFilter(''); setReviewOnly(false) }} className="h-10 px-2 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)]">Clear filters</button>}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <h2 className="text-sm font-semibold">Transaction Records</h2>
            <span className="text-xs text-[var(--muted)]">{visibleRows.length} records</span>
          </div>

          {loading ? <div className="flex min-h-52 flex-col items-center justify-center gap-2 text-sm text-[var(--muted)]"><IconRefresh size={18} className="animate-spin" /><span>Loading transactions…</span></div> : loadError ? <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-4 text-center"><p className="text-sm text-[var(--ink-secondary)]">{loadError}</p><button type="button" onClick={load} className="btn-secondary inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold"><IconRefresh size={14} /> Retry</button></div> : visibleRows.length === 0 ? <div className="flex min-h-52 flex-col items-center justify-center px-4 text-center"><p className="text-sm font-semibold">No transactions found</p><p className="mt-1 text-xs text-[var(--muted)]">Try changing your search or filter criteria.</p></div> : <>
            <div className="hidden overflow-x-auto md:block">
              <table className="erp-table w-full min-w-[1100px] text-left text-xs">
                <thead><tr>
                  <th className="px-3 py-2.5">Transaction</th><th className="px-3 py-2.5 text-right">Amount</th><th className="px-3 py-2.5">Payment</th><th className="px-3 py-2.5">Customer</th><th className="px-3 py-2.5">Gateway Reference</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Created</th><th className="px-3 py-2.5 text-right">Action</th>
                </tr></thead>
                <tbody className="divide-y divide-[var(--line-subtle)]">{visibleRows.map((row, index) => {
                  const orderId = getOrderId(row); const paymentId = getPaymentId(row); const created = getCreatedAt(row)
                  return <tr key={row.id || paymentId || orderId || index} className="transition-colors hover:bg-[var(--surface-hover)]">
                    <td className="max-w-[170px] px-3 py-2.5"><p className="truncate font-semibold" title={getInvoiceNumber(row) || 'Unlinked transaction'}>{getInvoiceNumber(row) || 'Needs review'}</p><p className="mt-0.5 font-mono text-[10px] text-[var(--muted)]">DB #{row.id || '—'}</p></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right"><p className="font-mono font-semibold tabular-nums">{fmt(getAmount(row), getCurrency(row))}</p><p className="text-[10px] text-[var(--muted)]">{getCurrency(row)}</p></td>
                    <td className="px-3 py-2.5"><MethodBadge method={getPaymentMethod(row)} />{(row.card_network || row.bank || row.wallet || row.vpa) && <p className="mt-0.5 max-w-28 truncate text-[10px] text-[var(--muted)]">{row.card_network || row.bank || row.wallet || row.vpa}</p>}</td>
                    <td className="max-w-[150px] px-3 py-2.5"><p className="truncate font-medium">{getCustomerName(row) || 'Walk-in / Guest'}</p><p className="truncate text-[10px] text-[var(--muted)]">{getCustomerEmail(row) || getCustomerPhone(row) || '—'}</p></td>
                    <td className="max-w-[210px] px-3 py-2.5"><div className="flex items-center gap-1"><span className="shrink-0 text-[9px] text-[var(--muted)]">ORD</span><span className="truncate font-mono text-[10px]" title={orderId}>{orderId || '—'}</span><CopyButton value={orderId} label="Order ID" /></div><div className="mt-0.5 flex items-center gap-1"><span className="shrink-0 text-[9px] text-[var(--muted)]">PAY</span><span className="truncate font-mono text-[10px]" title={paymentId}>{paymentId || '—'}</span><CopyButton value={paymentId} label="Payment ID" /></div></td>
                    <td className="px-3 py-2.5"><StatusBadge status={getStatus(row)} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5"><p>{fmtDateOnly(created)}</p><p className="text-[10px] text-[var(--muted)]">{created ? new Date(created).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}</p></td>
                    <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => setSelectedRow(row)} className="rounded-md border border-[var(--line)] px-2.5 py-1.5 font-medium hover:bg-[var(--surface-hover)]">View</button></td>
                  </tr>
                })}</tbody>
              </table>
            </div>
            <div className="divide-y divide-[var(--line-subtle)] md:hidden">
              {visibleRows.map((row, index) => {
                const orderId = getOrderId(row)
                const paymentId = getPaymentId(row)
                return (
                  <article
                    key={row.id || paymentId || orderId || index}
                    className="p-3.5 space-y-2.5 transition active:bg-[var(--surface-elevated)]"
                    onClick={() => setSelectedRow(row)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[#1E3A5F] dark:text-sky-400">
                          {getInvoiceNumber(row) || 'Needs Review'}
                        </p>
                        <p className="truncate text-xs font-semibold text-[var(--ink)] mt-0.5">
                          {getCustomerName(row) || 'Walk-in / Guest'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm font-extrabold tabular-nums text-[var(--ink)]">
                          {fmt(getAmount(row), getCurrency(row))}
                        </p>
                        <div className="mt-1 flex justify-end">
                          <StatusBadge status={getStatus(row)} />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-[var(--line-subtle)]">
                      <MethodBadge method={getPaymentMethod(row)} />
                      <span className="text-[11px] font-mono text-[var(--muted)]">
                        {fmtDateOnly(getCreatedAt(row))}
                      </span>
                    </div>

                    {(orderId || paymentId) && (
                      <div className="rounded-lg bg-[var(--surface-elevated)] p-2 space-y-1 text-[11px] font-mono">
                        {orderId && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[var(--muted)] text-[10px] uppercase font-sans">Order</span>
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="truncate text-[10px]">{orderId}</span>
                              <CopyButton value={orderId} label="Order ID" />
                            </div>
                          </div>
                        )}
                        {paymentId && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[var(--muted)] text-[10px] uppercase font-sans">Payment</span>
                            <div className="flex items-center gap-1 min-w-0">
                              <span className="truncate text-[10px]">{paymentId}</span>
                              <CopyButton value={paymentId} label="Payment ID" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="truncate text-[11px] text-[var(--muted)]">
                        {getCustomerPhone(row) || getCustomerEmail(row) || `DB #${row.id || '—'}`}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedRow(row)
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--ink)] shadow-2xs hover:bg-[var(--surface-hover)] active:scale-95"
                      >
                        View Details
                      </button>
                    </div>
                  </article>
                )
              })}</div>
            <footer className="border-t border-[var(--line)] px-4 py-2.5 text-xs text-[var(--muted)]">Showing {visibleRows.length} transaction{visibleRows.length === 1 ? '' : 's'} <span className="px-1">·</span>{summary.hasEstimatedFees ? 'Estimated gateway fee uses a 2% planning rate where no provider fee is available.' : 'Gateway fee reflects reported provider fees.'}</footer>
          </>}
        </section>
      </div>
      {selectedRow && <TransactionDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />}
    </div>
  )
}

// --------------------------------------------------
// TRANSACTION DETAIL DRAWER
// --------------------------------------------------

function TransactionDrawer({ row, onClose }) {
  const status = getStatus(row)
  const currency = getCurrency(row)
  const amount = getAmount(row)
  const orderId = getOrderId(row)
  const paymentId = getPaymentId(row)
  const method = getPaymentMethod(row)
  const invoice = getInvoiceNumber(row)
  const fee = getReconciliationFee(row)
  const feeIsEstimated = getReportedFee(row) === null && getEstimatedFee(row) > 0
  const tax = getTax(row)
  const failureReason = getFailureReason(row)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close transaction details"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-xs"
      />

      <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-2xl">
        {/* DRAWER HEADER */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <IconReceiptTax
                size={18}
                className="text-[var(--primary)]"
              />

              <h2 className="text-base font-bold text-[var(--ink)]">
                Transaction Details
              </h2>
            </div>

            <p className="mt-1 truncate font-mono text-[11px] text-[var(--muted)]">
              {paymentId || orderId || `Record #${row.id || '—'}`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
            aria-label="Close"
          >
            <IconX size={19} />
          </button>
        </div>

        {/* DRAWER CONTENT */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {/* AMOUNT SUMMARY */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Transaction Amount
                </p>

                <p className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--ink)]">
                  {fmt(amount, currency)}
                </p>

                <p className="mt-1 text-xs text-[var(--muted)]">
                  {invoice || 'No linked invoice'}
                </p>
              </div>

              <StatusBadge status={status} />
            </div>
          </div>

          {/* IDENTIFIERS */}
          <section className="space-y-4">
            <SectionTitle icon={IconHash}>
              Razorpay Identifiers
            </SectionTitle>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem
                label="Database ID"
                value={row.id}
                mono
                copyable
              />

              <DetailItem
                label="Invoice Number"
                value={invoice}
                copyable
              />

              <DetailItem
                label="Razorpay Order ID"
                value={orderId}
                mono
                copyable
              />

              <DetailItem
                label="Razorpay Payment ID"
                value={paymentId}
                mono
                copyable
              />

              <DetailItem
                label="Provider"
                value={row.provider || 'Razorpay'}
              />

              <DetailItem
                label="Currency"
                value={currency}
              />
            </div>
          </section>

          {/* PAYMENT INFORMATION */}
          <section className="space-y-4">
            <SectionTitle icon={IconCreditCard}>
              Payment Information
            </SectionTitle>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem
                label="Payment Method"
                value={titleCase(method)}
              />

              <DetailItem
                label="Payment Status"
                value={titleCase(status)}
              />

              <DetailItem
                label="Amount"
                value={fmt(amount, currency)}
              />

              <DetailItem
                label={feeIsEstimated ? 'Estimated gateway fee (2%)' : 'Gateway fee'}
                value={fmt(fee, currency)}
              />

              <DetailItem
                label="Tax"
                value={fmt(tax, currency)}
              />

              <DetailItem
                label="Refund Amount"
                value={fmt(getRefundAmount(row), currency)}
              />

              <DetailItem
                label="Card Network"
                value={row.card_network}
              />

              <DetailItem
                label="Card Type"
                value={row.card_type}
              />

              <DetailItem
                label="Bank"
                value={row.bank}
              />

              <DetailItem
                label="Wallet"
                value={row.wallet}
              />

              <DetailItem
                label="VPA"
                value={row.vpa}
                mono
                copyable
              />

              <DetailItem
                label="UPI Transaction ID"
                value={
                  row.upi_transaction_id ||
                  row.acquirer_data?.upi_transaction_id
                }
                mono
                copyable
              />
            </div>
          </section>

          {/* CUSTOMER */}
          <section className="space-y-4">
            <SectionTitle icon={IconUser}>
              Customer Information
            </SectionTitle>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem
                label="Customer Name"
                value={getCustomerName(row)}
              />

              <DetailItem
                label="Email"
                value={getCustomerEmail(row)}
                copyable
              />

              <DetailItem
                label="Contact"
                value={getCustomerPhone(row)}
                copyable
              />

              <DetailItem
                label="Customer ID"
                value={row.customer_id || row.customer?.id}
                mono
                copyable
              />
            </div>
          </section>

          {/* TIMESTAMPS */}
          <section className="space-y-4">
            <SectionTitle icon={IconCalendarEvent}>
              Transaction Timeline
            </SectionTitle>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem
                label="Created At"
                value={fmtDate(getCreatedAt(row))}
              />

              <DetailItem
                label="Captured At"
                value={fmtDate(getCapturedAt(row))}
              />

              <DetailItem
                label="Updated At"
                value={fmtDate(row.updated_at || row.updatedAt)}
              />

              <DetailItem
                label="Refunded At"
                value={fmtDate(row.refunded_at || row.refundedAt)}
              />
            </div>
          </section>

          {/* FAILURE DETAILS */}
          {(status === 'failed' || failureReason) && (
            <section className="space-y-4">
              <SectionTitle icon={IconCircleX}>
                Failure Information
              </SectionTitle>

              <div className="rounded-xl border border-rose-800/50 bg-rose-950/30 p-3">
                <p className="text-sm leading-relaxed text-rose-300">
                  {failureReason}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailItem
                  label="Error Code"
                  value={
                    row.error_code ||
                    row.error?.code ||
                    row.failure_code
                  }
                />

                <DetailItem
                  label="Error Source"
                  value={
                    row.error_source ||
                    row.error?.source
                  }
                />

                <DetailItem
                  label="Error Step"
                  value={
                    row.error_step ||
                    row.error?.step
                  }
                />

                <DetailItem
                  label="Error Field"
                  value={
                    row.error_field ||
                    row.error?.field
                  }
                />
              </div>
            </section>
          )}

          {/* NOTES */}
          {(row.notes || row.description || row.comment) && (
            <section className="space-y-4">
              <SectionTitle icon={IconReceiptTax}>
                Notes & Description
              </SectionTitle>

              {row.description && (
                <DetailItem
                  label="Description"
                  value={row.description}
                />
              )}

              {row.comment && (
                <DetailItem
                  label="Comment"
                  value={row.comment}
                />
              )}

          {row.notes && (typeof row.notes === 'object' && Object.keys(row.notes).length ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Object.entries(row.notes).filter(([, value]) => value !== null && value !== undefined && value !== '').map(([key, value]) => (
                    <DetailItem key={key} label={titleCase(key)} value={typeof value === 'object' ? Object.entries(value).map(([nestedKey, nestedValue]) => `${titleCase(nestedKey)}: ${nestedValue}`).join(' · ') : value} />
                  ))}
                </div>
              ) : <DetailItem label="Gateway Notes" value={row.notes} />)}
            </section>
          )}

          <section className="space-y-4">
            <SectionTitle icon={IconShieldCheck}>Transaction Review</SectionTitle>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
              <div className="flex items-start gap-3">
                {invoice ? <IconCircleCheck size={18} className="mt-0.5 text-emerald-600" /> : <IconAlertCircle size={18} className="mt-0.5 text-amber-600" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--ink)]">{invoice ? 'Invoice linked' : 'Invoice link needs review'}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">{invoice ? `This gateway payment is associated with invoice ${invoice}.` : 'No invoice number was returned for this payment. Check the payment ID against your sales records.'}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailItem label="Gateway" value={row.provider || 'Razorpay'} />
              <DetailItem label="Gateway Order Reference" value={orderId} mono copyable />
              <DetailItem label="Gateway Payment Reference" value={paymentId} mono copyable />
              <DetailItem label="Receipt / Reference" value={row.receipt || row.reference_id || row.reference} mono copyable />
              <DetailItem label="Settlement ID" value={row.settlement_id || row.settlement?.id} mono copyable />
              <DetailItem label="Description" value={row.description} />
            </div>
          </section>
        </div>

        {/* DRAWER FOOTER */}
        <div className="border-t border-[var(--line)] bg-[var(--surface)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary w-full min-h-11 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
          >
            <IconX size={16} />
            Close Details
          </button>
        </div>
      </aside>
    </div>
  )
}
