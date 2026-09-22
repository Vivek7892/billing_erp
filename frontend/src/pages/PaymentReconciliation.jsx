
import { useState, useEffect, useCallback, useMemo } from 'react'
import api from '../api'
import {
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock3,
  IndianRupee,
  CreditCard,
  Wallet,
  Smartphone,
  Building2,
  Copy,
  Check,
  X,
  Download,
  Eye,
  ChevronDown,
  ExternalLink,
  ReceiptText,
  User,
  Mail,
  Phone,
  CalendarDays,
  Hash,
  ShieldCheck,
  ArrowUpRight,
  CircleDollarSign,
  Banknote,
} from 'lucide-react'
import toast from 'react-hot-toast'

// --------------------------------------------------
// CONSTANTS
// --------------------------------------------------

const STATUS_COLORS = {
  created: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  initiated: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  captured: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  expired: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  refunded: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
}

const STATUS_ICONS = {
  success: CheckCircle2,
  captured: CheckCircle2,
  failed: XCircle,
  pending: Clock3,
  initiated: Clock3,
  created: Clock3,
  expired: Clock3,
  refunded: ArrowUpRight,
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

const getFee = (row) =>
  row.fee ??
  row.fees ??
  row.razorpay_fee ??
  row.details?.fee ??
  row.payment_details?.fee ??
  0

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
  const Icon = STATUS_ICONS[status] || Clock3

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
        STATUS_COLORS[status] ||
        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      }`}
    >
      <Icon size={12} strokeWidth={2.5} />
      {titleCase(status || 'unknown')}
    </span>
  )
}

function MethodBadge({ method }) {
  const normalized = String(method || '').toLowerCase()

  const icon =
    normalized === 'upi' ? (
      <Smartphone size={14} />
    ) : normalized === 'card' ? (
      <CreditCard size={14} />
    ) : normalized === 'wallet' ? (
      <Wallet size={14} />
    ) : normalized === 'netbanking' ? (
      <Building2 size={14} />
    ) : (
      <Banknote size={14} />
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
        <Check size={14} className="text-emerald-600" />
      ) : (
        <Copy size={14} />
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

function KpiCard({ label, value, description, icon: Icon, tone = 'default' }) {
  const tones = {
    default: {
      icon: 'bg-[var(--surface-elevated)] text-[var(--ink-secondary)]',
      value: 'text-[var(--ink)]',
    },
    success: {
      icon: '',
      value: 'text-emerald-600 dark:text-emerald-400',
    },
    danger: {
      icon: '',
      value: 'text-rose-600 dark:text-rose-400',
    },
    warning: {
      icon: '',
      value: 'text-amber-600 dark:text-amber-400',
    },
    primary: {
      icon: '',
      value: 'text-indigo-600 dark:text-indigo-400',
    },
  }

  const selected = tones[tone] || tones.default

  return (
    <div className="group rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            {label}
          </p>

          <p
            className={`mt-2 truncate text-xl font-extrabold tracking-tight sm:text-2xl ${selected.value}`}
          >
            {value}
          </p>

          {description && (
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              {description}
            </p>
          )}
        </div>

        <div className={`rounded-xl p-2.5 ${selected.icon}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------

export default function PaymentReconciliation() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatus] = useState('')
  const [methodFilter, setMethod] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedRow, setSelectedRow] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)

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
      console.error('Reconciliation load error:', error)
      toast.error('Failed to load reconciliation data')
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

    const fees = rows.reduce(
      (sum, row) => sum + Number(getFee(row) || 0),
      0
    )

    const tax = rows.reduce(
      (sum, row) => sum + Number(getTax(row) || 0),
      0
    )

    const refunds = rows.reduce(
      (sum, row) => sum + Number(getRefundAmount(row) || 0),
      0
    )

    const net = amount - fees - tax

    const successRate = rows.length
      ? (successful.length / rows.length) * 100
      : 0

    return {
      total: rows.length,
      success: successful.length,
      failed: failed.length,
      pending: pending.length,
      refunded: refunded.length,
      amount,
      fees,
      tax,
      refunds,
      net,
      successRate,
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

      return matchesSearch && matchesStatus && matchesMethod
    })
  }, [rows, search, statusFilter, methodFilter])

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
      'Fee',
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
      getFee(row),
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
    link.download = `razorpay-reconciliation-${new Date()
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
    <div className="min-h-full bg-[var(--background)] p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">

        {/* HEADER */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3">
            <div className="hidden rounded-2xl bg-[var(--primary)]/10 p-3 text-[var(--primary)] sm:block">
              <ReceiptText size={24} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-[var(--ink)] sm:text-2xl">
                  Payment Reconciliation
                </h1>

                <span className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Admin
                </span>
              </div>

              <p className="mt-1 text-sm text-[var(--muted)]">
                Monitor, audit and reconcile Razorpay transactions.
              </p>

              <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                <ShieldCheck size={13} className="text-emerald-600" />
                Gateway transaction audit
                <span className="text-[var(--line)]">•</span>
                {fmtDate(new Date())}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCSV}
              disabled={loading || !visibleRows.length}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--ink-secondary)] shadow-sm transition-colors hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={16} />
              Export CSV
            </button>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={loading ? 'animate-spin' : ''}
              />
              Refresh
            </button>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard
            label="Total Transactions"
            value={summary.total.toLocaleString('en-IN')}
            description="Loaded transactions"
            icon={ReceiptText}
          />

          <KpiCard
            label="Successful"
            value={summary.success.toLocaleString('en-IN')}
            description={`${summary.successRate.toFixed(1)}% success rate`}
            icon={CheckCircle2}
            tone="success"
          />

          <KpiCard
            label="Failed"
            value={summary.failed.toLocaleString('en-IN')}
            description="Unsuccessful payments"
            icon={XCircle}
            tone="danger"
          />

          <KpiCard
            label="Pending"
            value={summary.pending.toLocaleString('en-IN')}
            description="Awaiting completion"
            icon={Clock3}
            tone="warning"
          />

          <KpiCard
            label="Collected"
            value={fmtCompact(summary.amount)}
            description="Successful payments"
            icon={IndianRupee}
            tone="primary"
          />

          <KpiCard
            label="Net Amount"
            value={fmtCompact(summary.net)}
            description="After recorded fees & tax"
            icon={CircleDollarSign}
            tone="success"
          />
        </div>

        {/* FINANCIAL SUMMARY */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
              <Banknote size={14} />
              Gateway Fees
            </div>
            <p className="mt-1 text-lg font-bold text-[var(--ink)]">
              {fmt(summary.fees)}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
              <CircleDollarSign size={14} />
              Gateway Tax
            </div>
            <p className="mt-1 text-lg font-bold text-[var(--ink)]">
              {fmt(summary.tax)}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
              <ArrowUpRight size={14} />
              Refund Amount
            </div>
            <p className="mt-1 text-lg font-bold text-[var(--ink)]">
              {fmt(summary.refunds)}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
              <ShieldCheck size={14} />
              Refunded Transactions
            </div>
            <p className="mt-1 text-lg font-bold text-[var(--ink)]">
              {summary.refunded}
            </p>
          </div>
        </div>

        {/* FILTERS */}
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-light)]"
              />

              <input
                className="h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--background)] pl-10 pr-3 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
                placeholder="Search invoice, order ID, payment ID, customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                className="h-11 min-w-[145px] rounded-xl border border-[var(--line)] bg-[var(--background)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--primary)]"
                value={statusFilter}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {[
                  'created',
                  'initiated',
                  'pending',
                  'success',
                  'captured',
                  'failed',
                  'expired',
                  'refunded',
                ].map((status) => (
                  <option key={status} value={status}>
                    {titleCase(status)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowFilters((value) => !value)}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                  showFilters
                    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                    : 'border-[var(--line)] bg-[var(--background)] text-[var(--ink-secondary)] hover:bg-[var(--surface-elevated)]'
                }`}
              >
                Filters
                <ChevronDown
                  size={15}
                  className={`transition-transform ${
                    showFilters ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {(search || statusFilter || methodFilter || dateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setStatus('')
                    setMethod('')
                    setDateFilter('')
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                >
                  <X size={15} />
                  Clear
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[var(--line-subtle)] pt-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
                  Payment Method
                </label>

                <select
                  className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm text-[var(--ink)] outline-none"
                  value={methodFilter}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {PAYMENT_METHODS.map((method) => (
                    <option
                      key={method}
                      value={method === 'All methods' ? '' : method}
                    >
                      {titleCase(method)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[var(--muted)]">
                  Transaction Date
                </label>

                <input
                  type="date"
                  className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--background)] px-3 text-sm text-[var(--ink)] outline-none"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <div className="rounded-lg bg-[var(--surface-elevated)] px-3 py-2 text-xs text-[var(--muted)]">
                  Filters are applied to the reconciliation request and local results.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TRANSACTION TABLE */}
        <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b border-[var(--line)] px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <div>
              <h2 className="text-base font-bold text-[var(--ink)]">
                Razorpay Transactions
              </h2>

              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Detailed payment records from your backend
              </p>
            </div>

            <div className="rounded-full bg-[var(--surface-elevated)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
              {visibleRows.length} records
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-elevated)] text-left text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Payment Method</th>
                  <th className="px-4 py-3">Razorpay IDs</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[var(--line-subtle)]">
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <RefreshCw
                        size={24}
                        className="mx-auto mb-3 animate-spin text-[var(--primary)]"
                      />

                      <p className="text-sm font-medium text-[var(--ink)]">
                        Loading transactions...
                      </p>

                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Fetching Razorpay reconciliation data
                      </p>
                    </td>
                  </tr>
                )}

                {!loading && visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-elevated)]">
                        <AlertCircle
                          size={24}
                          className="text-[var(--muted-light)]"
                        />
                      </div>

                      <p className="text-sm font-semibold text-[var(--ink)]">
                        No transactions found
                      </p>

                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Try changing your search or filters.
                      </p>
                    </td>
                  </tr>
                )}

                {!loading &&
                  visibleRows.map((row, index) => {
                    const status = getStatus(row)
                    const currency = getCurrency(row)
                    const amount = getAmount(row)
                    const method = getPaymentMethod(row)
                    const orderId = getOrderId(row)
                    const paymentId = getPaymentId(row)
                    const invoice = getInvoiceNumber(row)
                    const customer = getCustomerName(row)

                    return (
                      <tr
                        key={row.id || paymentId || orderId || index}
                        className="group transition-colors hover:bg-[var(--surface-elevated)]"
                      >
                        {/* TRANSACTION */}
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-elevated)] text-[var(--muted)]">
                              <ReceiptText size={16} />
                            </div>

                            <div className="min-w-0">
                              <p className="font-semibold text-[var(--ink)]">
                                {invoice || 'Unlinked Transaction'}
                              </p>

                              <p className="mt-1 text-[11px] text-[var(--muted)]">
                                Record #{row.id || index + 1}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* AMOUNT */}
                        <td className="px-4 py-4 text-right">
                          <p className="font-bold tabular-nums text-[var(--ink)]">
                            {fmt(amount, currency)}
                          </p>

                          <p className="mt-1 text-[10px] uppercase text-[var(--muted)]">
                            {currency}
                          </p>
                        </td>

                        {/* METHOD */}
                        <td className="px-4 py-4">
                          <MethodBadge method={method} />

                          {(row.card_network ||
                            row.bank ||
                            row.wallet ||
                            row.vpa) && (
                            <p className="mt-1 max-w-[130px] truncate text-[11px] text-[var(--muted)]">
                              {row.card_network ||
                                row.bank ||
                                row.wallet ||
                                row.vpa}
                            </p>
                          )}
                        </td>

                        {/* RAZORPAY IDS */}
                        <td className="px-4 py-4">
                          <div className="space-y-1.5">
                            <div className="flex max-w-[240px] items-center gap-1">
                              <span className="w-12 shrink-0 text-[10px] font-semibold uppercase text-[var(--muted)]">
                                Order
                              </span>

                              <span
                                className="truncate font-mono text-[11px] text-[var(--ink-secondary)]"
                                title={orderId}
                              >
                                {orderId || '—'}
                              </span>

                              <CopyButton
                                value={orderId}
                                label="Order ID"
                              />
                            </div>

                            <div className="flex max-w-[240px] items-center gap-1">
                              <span className="w-12 shrink-0 text-[10px] font-semibold uppercase text-[var(--muted)]">
                                Pay
                              </span>

                              <span
                                className="truncate font-mono text-[11px] text-[var(--ink-secondary)]"
                                title={paymentId}
                              >
                                {paymentId || '—'}
                              </span>

                              <CopyButton
                                value={paymentId}
                                label="Payment ID"
                              />
                            </div>
                          </div>
                        </td>

                        {/* CUSTOMER */}
                        <td className="px-4 py-4">
                          <div className="max-w-[180px]">
                            <p className="truncate text-xs font-semibold text-[var(--ink)]">
                              {customer || 'Guest Customer'}
                            </p>

                            <p className="mt-1 truncate text-[11px] text-[var(--muted)]">
                              {getCustomerEmail(row) ||
                                getCustomerPhone(row) ||
                                'No contact details'}
                            </p>
                          </div>
                        </td>

                        {/* STATUS */}
                        <td className="px-4 py-4 text-center">
                          <StatusBadge status={status} />
                        </td>

                        {/* CREATED */}
                        <td className="whitespace-nowrap px-4 py-4">
                          <p className="text-xs font-medium text-[var(--ink-secondary)]">
                            {fmtDateOnly(getCreatedAt(row))}
                          </p>

                          <p className="mt-1 text-[11px] text-[var(--muted)]">
                            {getCreatedAt(row)
                              ? new Date(getCreatedAt(row)).toLocaleTimeString(
                                  'en-IN',
                                  {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )
                              : '—'}
                          </p>
                        </td>

                        {/* ACTION */}
                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedRow(row)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink-secondary)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
                          >
                            <Eye size={14} />
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          {!loading && visibleRows.length > 0 && (
            <div className="flex flex-col justify-between gap-2 border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)] sm:flex-row sm:items-center">
              <span>
                Showing {visibleRows.length} transaction
                {visibleRows.length !== 1 ? 's' : ''}
              </span>

              <span>
                Data source: Razorpay reconciliation API
              </span>
            </div>
          )}
        </div>
      </div>

      {/* DETAIL DRAWER */}
      {selectedRow && (
        <TransactionDrawer
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
        />
      )}
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
  const fee = getFee(row)
  const tax = getTax(row)
  const failureReason = getFailureReason(row)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close transaction details"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-[2px]"
      />

      <aside className="relative flex h-full w-full max-w-xl flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-2xl">
        {/* DRAWER HEADER */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ReceiptText
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
            <X size={19} />
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
            <SectionTitle icon={Hash}>
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
            <SectionTitle icon={CreditCard}>
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
                label="Fee"
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
            <SectionTitle icon={User}>
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
            <SectionTitle icon={CalendarDays}>
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
          {failureReason && (
            <section className="space-y-4">
              <SectionTitle icon={XCircle}>
                Failure Information
              </SectionTitle>

              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
                <p className="text-sm leading-relaxed text-rose-700 dark:text-rose-300">
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
              <SectionTitle icon={ReceiptText}>
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

              {row.notes && (
                <div className="rounded-xl bg-[var(--surface-elevated)] p-3">
                  <pre className="whitespace-pre-wrap break-words text-xs text-[var(--ink-secondary)]">
                    {typeof row.notes === 'object'
                      ? JSON.stringify(row.notes, null, 2)
                      : String(row.notes)}
                  </pre>
                </div>
              )}
            </section>
          )}

          {/* RAW DATA */}
          <section className="space-y-4">
            <SectionTitle icon={ExternalLink}>
              Complete Backend Record
            </SectionTitle>

            <p className="text-xs text-[var(--muted)]">
              Raw response returned by your reconciliation API.
              Useful for auditing additional fields.
            </p>

            <div className="overflow-x-auto rounded-xl bg-[var(--surface-elevated)] p-3">
              <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-[var(--ink-secondary)]">
                {JSON.stringify(row, null, 2)}
              </pre>
            </div>
          </section>
        </div>

        {/* DRAWER FOOTER */}
        <div className="border-t border-[var(--line)] bg-[var(--surface)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:opacity-80"
          >
            <X size={16} />
            Close Details
          </button>
        </div>
      </aside>
    </div>
  )
}