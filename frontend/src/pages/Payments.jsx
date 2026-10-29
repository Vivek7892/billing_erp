import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import api from '../api'
import { Spinner, Modal, TableSkeleton, EmptyState, ErrorState, Pagination, SearchInput } from '../components/UI'
import { MobileKpiGrid, MobileFAB } from '../components/MobileUI'
import toast from 'react-hot-toast'
import {
  IconCash,
  IconCreditCard,
  IconRefresh,
  IconSearch,
  IconDeviceMobile,
  IconWallet,
  IconX,
  IconReceipt,
  IconAdjustmentsHorizontal,
  IconEye,
  IconUserCircle,
  IconReceiptTax,
  IconPrinter,
  IconDownload,
  IconShieldCheck,
  IconExternalLink,
  IconPlus,
  IconFilter,
  IconCurrencyRupee,
  IconCircleCheck,
  IconClock,
  IconCircleX,
  IconCircleDot,
  IconRotate2,
  IconBan,
  IconPhone,
  IconMail,
  IconCalendar,
  IconTrendingUp,
  IconChartBar,
  IconArrowDownRight,
  IconArrowUpRight,
  IconArrowsSort,
  IconDotsVertical,
  IconCopy,
  IconCheck,
  IconAlertCircle,
  IconFileText,
  IconBuildingBank,
  IconHistory,
  IconQrcode,
} from '@tabler/icons-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { CustomerCollectPaymentModal } from './Customers'
import customerService from '../features/customers/api/customerService'
import settingsService from '../features/settings/api/settingsService'

const today = new Date().toISOString().slice(0, 10)
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

const DATE_PRESETS = [
  { key: 'today', label: 'Today', start: today, end: today },
  {
    key: 'yesterday',
    label: 'Yesterday',
    start: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    end: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
  },
  {
    key: 'week',
    label: 'Last 7 Days',
    start: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
    end: today,
  },
  { key: 'month', label: 'This Month', start: monthStart, end: today },
  {
    key: 'last30',
    label: 'Last 30 Days',
    start: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
    end: today,
  },
  { key: 'all', label: 'All Time', start: '', end: '' },
]

const formatCurrency = value =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`

const formatDate = value => {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const formatTime = value => {
  if (!value) return ''
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

const formatDateTime = value => {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return `${date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })} · ${date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

const getPaymentRef = bill => {
  if (!bill) return '—'
  if (bill.razorpay_payment_id) return bill.razorpay_payment_id
  if (Array.isArray(bill.payments) && bill.payments.length > 0) {
    const p = bill.payments[0]
    if (p.reference) return p.reference
    if (p.transaction_id) return p.transaction_id
    if (p.id) return `PMT-${p.id}`
  }
  return `PMT-${bill.id}`
}

const METHOD_META = {
  cash: {
    label: 'Cash',
    description: 'Cash payments',
    icon: IconCash,
    tone: 'success',
    iconClass:
      'bg-[var(--payment-cash-bg)] text-[var(--payment-cash-text)] border-[var(--payment-cash-border)]',
    badgeClass:
      'bg-[var(--payment-cash-bg)] text-[var(--payment-cash-text)] border border-[var(--payment-cash-border)]',
  },
  upi: {
    label: 'UPI',
    description: 'UPI transactions',
    icon: IconDeviceMobile,
    tone: 'info',
    iconClass:
      'bg-[var(--payment-upi-bg)] text-[var(--payment-upi-text)] border-[var(--payment-upi-border)]',
    badgeClass:
      'bg-[var(--payment-upi-bg)] text-[var(--payment-upi-text)] border border-[var(--payment-upi-border)]',
  },
  razorpay: {
    label: 'Razorpay',
    description: 'Razorpay Gateway',
    icon: IconCreditCard,
    tone: 'blue',
    iconClass:
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    badgeClass:
      'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
  },
  card: {
    label: 'Card',
    description: 'Card payments',
    icon: IconCreditCard,
    tone: 'slate',
    iconClass:
      'bg-[var(--payment-card-bg)] text-[var(--payment-card-text)] border-[var(--payment-card-border)]',
    badgeClass:
      'bg-[var(--payment-card-bg)] text-[var(--payment-card-text)] border border-[var(--payment-card-border)]',
  },
  credit: {
    label: 'Credit',
    description: 'Credit transactions',
    icon: IconWallet,
    tone: 'danger',
    iconClass:
      'bg-[var(--payment-credit-bg)] text-[var(--payment-credit-text)] border-[var(--payment-credit-border)]',
    badgeClass:
      'bg-[var(--payment-credit-bg)] text-[var(--payment-credit-text)] border border-[var(--payment-credit-border)]',
  },
}

const FILTERS = [
  { key: 'all', label: 'All payments' },
  ...Object.entries(METHOD_META).map(([key, value]) => ({
    key,
    label: value.label,
  })),
]

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass,
  active,
  onClick,
  count,
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-light)] sm:text-[11px]">
            {title}
          </p>

          <p className="mt-2 truncate text-lg font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm ${iconClass}`}
        >
          <Icon size={18} strokeWidth={1.8} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="truncate text-[11px] text-[var(--muted-light)]">
          {description}
        </p>

        {typeof count === 'number' && (
          <span className="shrink-0 rounded-full bg-[var(--surface-elevated)] px-2 py-1 text-[10px] font-semibold text-[var(--muted)]">
            {count}
          </span>
        )}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group rounded-2xl border bg-[var(--surface)] p-5 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] ${
          active
            ? 'border-[var(--primary-border)] ring-2 ring-[var(--focus-ring)]'
            : 'border-[var(--line)]'
        }`}
      >
        {content}
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 shadow-[var(--shadow-card)]">
      {content}
    </div>
  )
}

function PaymentBadge({ method }) {
  const meta = METHOD_META[method] || METHOD_META.cash
  const Icon = meta.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${meta.badgeClass}`}
    >
      <Icon size={12} strokeWidth={2} />
      {meta.label}
    </span>
  )
}

function PaymentStatus({ status, showIcon = true }) {
  const normalized = String(status || 'pending').toLowerCase().trim()

  const statusMap = {
    paid: {
      label: 'Paid',
      icon: IconCircleCheck,
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
      iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
    completed: {
      label: 'Completed',
      icon: IconCircleCheck,
      className:
        'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
      iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
    pending: {
      label: 'Pending',
      icon: IconClock,
      className:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
      iconClass: 'text-amber-600 dark:text-amber-400',
    },
    partial: {
      label: 'Partial',
      icon: IconCircleDot,
      className:
        'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
      iconClass: 'text-blue-600 dark:text-blue-400',
    },
    partially_paid: {
      label: 'Partial',
      icon: IconCircleDot,
      className:
        'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
      iconClass: 'text-blue-600 dark:text-blue-400',
    },
    failed: {
      label: 'Failed',
      icon: IconCircleX,
      className:
        'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
      iconClass: 'text-rose-600 dark:text-rose-400',
    },
    refunded: {
      label: 'Refunded',
      icon: IconRotate2,
      className:
        'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
      iconClass: 'text-orange-600 dark:text-orange-400',
    },
    cancelled: {
      label: 'Cancelled',
      icon: IconBan,
      className:
        'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
      iconClass: 'text-slate-500 dark:text-slate-400',
    },
    canceled: {
      label: 'Cancelled',
      icon: IconBan,
      className:
        'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
      iconClass: 'text-slate-500 dark:text-slate-400',
    },
  }

  const current = statusMap[normalized] || {
    label: status ? String(status).charAt(0).toUpperCase() + String(status).slice(1) : 'Pending',
    icon: IconClock,
    className:
      'border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--muted)]',
    iconClass: 'text-[var(--muted)]',
  }

  const Icon = current.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${current.className}`}
    >
      {showIcon && <Icon size={12} strokeWidth={2.2} className={current.iconClass} />}
      <span>{current.label}</span>
    </span>
  )
}

export default function Payments() {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('transactions')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('search') || '')
  const [selectedBill, setSelectedBill] = useState(null)
  const [invoiceAction, setInvoiceAction] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)
  const [openActionMenuId, setOpenActionMenuId] = useState(null)

  // Sorting and pagination state
  const [sortBy, setSortBy] = useState('date') // 'date' | 'amount' | 'status' | 'invoice'
  const [sortDir, setSortDir] = useState('desc') // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  useEffect(() => {
    const target = new URLSearchParams(location.search).get('search') || ''
    setSearch(target)
    if (target) setCurrentPage(1)
  }, [location.search])

  // Date filter state
  const [datePreset, setDatePreset] = useState('month')
  const [dateStart, setDateStart] = useState(monthStart)
  const [dateEnd, setDateEnd] = useState(today)

  const applyPreset = preset => {
    setDatePreset(preset.key)
    setDateStart(preset.start)
    setDateEnd(preset.end)
  }

  // Payment Collection History State
  const [collections, setCollections] = useState([])
  const [loadingCollections, setLoadingCollections] = useState(false)
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('')
  const [collectionMethodFilter, setCollectionMethodFilter] = useState('all')
  const [copiedCollectionTxn, setCopiedCollectionTxn] = useState('')

  const loadCollections = useCallback(async () => {
    setLoadingCollections(true)
    try {
      const res = await customerService.getPaymentCollections({ page_size: 500 })
      const data = Array.isArray(res?.results) ? res.results : (Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []))
      setCollections(data)
    } catch (err) {
      console.error('Failed to load collections:', err)
      setCollections([])
    } finally {
      setLoadingCollections(false)
    }
  }, [])

  useEffect(() => {
    loadCollections()
  }, [loadCollections])

  const handleCopyTxnId = (txnId) => {
    if (!txnId) return
    navigator.clipboard.writeText(txnId)
    setCopiedCollectionTxn(txnId)
    toast.success('Transaction ID copied')
    setTimeout(() => setCopiedCollectionTxn(''), 2000)
  }

  const filteredCollections = useMemo(() => {
    const safeCollections = Array.isArray(collections) ? collections : []
    return safeCollections.filter(item => {
      if (collectionMethodFilter !== 'all') {
        const m = (item.method || 'cash').toLowerCase()
        if (collectionMethodFilter === 'card_bank') {
          if (!['card', 'bank', 'online'].includes(m)) return false
        } else if (m !== collectionMethodFilter.toLowerCase()) {
          return false
        }
      }
      if (collectionSearchQuery.trim()) {
        const q = collectionSearchQuery.toLowerCase()
        const name = (item.customer_name || '').toLowerCase()
        const phone = (item.customer_mobile || '').toLowerCase()
        const inv = (item.invoice_number || '').toLowerCase()
        const ref = (item.reference || item.transaction_id || '').toLowerCase()
        const notes = (item.notes || '').toLowerCase()
        const pId = String(item.id || '')
        if (!name.includes(q) && !phone.includes(q) && !inv.includes(q) && !ref.includes(q) && !notes.includes(q) && !pId.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [collections, collectionMethodFilter, collectionSearchQuery])

  const collectionTotals = useMemo(() => {
    const safeCollections = Array.isArray(collections) ? collections : []
    const total = safeCollections.reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
    const cash = safeCollections.filter(c => (c.method || 'cash').toLowerCase() === 'cash').reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
    const upi = safeCollections.filter(c => (c.method || '').toLowerCase() === 'upi').reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
    const cardBank = safeCollections.filter(c => ['card', 'bank', 'online'].includes((c.method || '').toLowerCase())).reduce((acc, curr) => acc + Number(curr.amount || 0), 0)
    return { total, cash, upi, cardBank, count: safeCollections.length }
  }, [collections])

  // Customer Credit Collection State
  const [customers, setCustomers] = useState([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [collectionSearch, setCollectionSearch] = useState('')
  const [onlyWithBalance, setOnlyWithBalance] = useState(true)
  const [selectedCustomerForPay, setSelectedCustomerForPay] = useState(null)
  const [shopSettings, setShopSettings] = useState({})
  const [shopName, setShopName] = useState('')

  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true)
    try {
      const res = await customerService.getCustomers()
      const rows = Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : [])
      setCustomers(rows)
    } catch (err) {
      console.error('Failed to load customers for collection:', err)
      setCustomers([])
    } finally {
      setLoadingCustomers(false)
    }
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  useEffect(() => {
    settingsService
      .getAll()
      .then(settings => {
        if (settings) {
          setShopSettings(settings)
          if (settings.shop_name) setShopName(settings.shop_name)
        }
      })
      .catch(() => {})
  }, [])

  const dueCustomers = useMemo(() => {
    return customers.filter(c => Number(c.outstanding_amount || 0) > 0)
  }, [customers])

  const totalOutstandingReceivables = useMemo(() => {
    return dueCustomers.reduce((sum, c) => sum + Number(c.outstanding_amount || 0), 0)
  }, [dueCustomers])

  const totalCreditLimitGiven = useMemo(() => {
    return customers.reduce((sum, c) => sum + Number(c.credit_limit || 0), 0)
  }, [customers])

  const filteredCustomers = useMemo(() => {
    const list = onlyWithBalance ? dueCustomers : customers
    if (!collectionSearch.trim()) return list
    const q = collectionSearch.toLowerCase().trim()
    return list.filter(c =>
      (c.name || '').toLowerCase().includes(q) ||
      (c.mobile || '').includes(q) ||
      (c.gstin || '').toLowerCase().includes(q)
    )
  }, [customers, dueCustomers, onlyWithBalance, collectionSearch])

  const handleCopy = useCallback((text, key) => {
    if (!text) return
    navigator.clipboard?.writeText(String(text))
    setCopiedKey(key)
    toast.success('Copied to clipboard')
    setTimeout(() => {
      setCopiedKey(prev => (prev === key ? null : prev))
    }, 2000)
  }, [])

  const handleInvoiceAction = useCallback(async (bill, action) => {
    if (!bill?.id || invoiceAction) return

    setInvoiceAction(`${bill.id}:${action}`)
    try {
      const response = await api.get(`/invoices/${bill.id}/pdf/`, {
        responseType: 'blob',
      })
      const blobUrl = URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' }),
      )

      if (action === 'download') {
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = `invoice-${bill.invoice_number || bill.id}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
        toast.success('Invoice downloaded')
      } else {
        const printWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer')
        if (!printWindow) {
          toast.error('Allow pop-ups to print the invoice')
        } else {
          toast.success('Invoice opened for printing')
        }
      }

      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (error) {
      console.error('Failed to generate invoice PDF:', error)
      toast.error(error.response?.data?.detail || 'Could not generate the invoice')
    } finally {
      setInvoiceAction(null)
    }
  }, [invoiceAction])

  const handleReceiptAction = useCallback(async (bill) => {
    if (!bill?.id || invoiceAction) return
    setInvoiceAction(`${bill.id}:receipt`)
    try {
      const response = await api.get(`/invoices/${bill.id}/pdf/?printer=thermal`, {
        responseType: 'blob',
      })
      const blobUrl = URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' }),
      )
      const printWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer')
      if (!printWindow) {
        toast.error('Allow pop-ups to print the thermal receipt')
      } else {
        toast.success('Thermal receipt opened for printing')
      }
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (error) {
      console.error('Failed to generate thermal receipt:', error)
      toast.error(error.response?.data?.detail || 'Could not generate thermal receipt')
    } finally {
      setInvoiceAction(null)
    }
  }, [invoiceAction])

  const InvoiceActions = ({ bill, compact = false }) => {
    const isBusy = invoiceAction?.startsWith(`${bill.id}:`)
    return (
      <div className={`flex items-center gap-1.5 ${compact ? 'w-full' : ''}`}>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => handleInvoiceAction(bill, 'print')}
          title="Open invoice for printing"
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-2.5 py-2 text-[11px] font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 ${compact ? 'flex-1' : ''}`}
        >
          <IconPrinter size={13} />
          <span>{isBusy ? 'Preparing...' : 'Invoice'}</span>
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => handleInvoiceAction(bill, 'download')}
          title="Download invoice PDF"
          className="inline-flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)] disabled:cursor-wait disabled:opacity-60"
        >
          <IconDownload size={13} />
        </button>
      </div>
    )
  }

  const loadPayments = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)
    try {
      let url = '/invoices/?page_size=500&ordering=-created_at'
      if (dateStart) url += `&start_date=${dateStart}`
      if (dateEnd) url += `&end_date=${dateEnd}`
      const response = await api.get(url)
      const data = response.data?.results || response.data || []
      setBills(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load payment transactions:', err)
      setError('Unable to load payment transactions. Please check your network or try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [dateStart, dateEnd])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  useEffect(() => {
    const handleSync = () => {
      loadCollections()
      loadCustomers()
      loadPayments()
    }
    window.addEventListener('pos:payment-collected', handleSync)
    return () => window.removeEventListener('pos:payment-collected', handleSync)
  }, [loadCollections, loadCustomers, loadPayments])

  const summary = useMemo(
    () =>
      Object.entries(METHOD_META).map(([key, meta]) => {
        const transactions = bills.filter(
          bill => bill.payment_method === key,
        )

        return {
          key,
          ...meta,
          count: transactions.length,
          total: transactions.reduce(
            (sum, bill) =>
              sum +
              Number(
                bill.paid_amount ??
                  (bill.payment_method === 'credit' ? 0 : bill.grand_total) ??
                  0,
              ),
            0,
          ),
        }
      }),
    [bills],
  )

  const totalCollected = useMemo(
    () =>
      bills
        .filter(bill => bill.payment_method !== 'credit')
        .reduce(
          (sum, bill) =>
            sum +
            Number(
              bill.paid_amount ??
                bill.grand_total ??
                0,
            ),
          0,
        ),
    [bills],
  )

  const totalCredit = useMemo(
    () =>
      bills
        .filter(bill => bill.payment_method === 'credit')
        .reduce(
          (sum, bill) => sum + Number(bill.balance_due ?? bill.grand_total ?? 0),
          0,
        ),
    [bills],
  )

  const totalTransactions = bills.length

  const paymentMetrics = useMemo(() => ({
    paid: bills.filter(bill => ['paid', 'completed'].includes(bill.payment_status)).length,
    partial: bills.filter(bill => bill.payment_status === 'partial').length,
    pending: bills.filter(bill => bill.payment_status === 'pending').length,
    refunded: bills.filter(bill => bill.payment_status === 'refunded').length,
    outstanding: bills.reduce((sum, bill) => sum + Number(bill.balance_due || 0), 0),
    discounts: bills.reduce((sum, bill) => sum + Number(bill.discount_amount || 0), 0),
    tax: bills.reduce((sum, bill) => sum + Number(bill.tax_amount || 0), 0),
    avgBill: bills.length > 0 ? bills.reduce((s, b) => s + Number(b.grand_total || 0), 0) / bills.length : 0,
  }), [bills])

  // Daily totals for bar chart
  const dailyChartData = useMemo(() => {
    const map = {}
    bills.forEach(bill => {
      const d = (bill.created_at || '').slice(0, 10)
      if (!d) return
      if (!map[d]) map[d] = { date: d, total: 0, count: 0 }
      map[d].total += Number(bill.grand_total || 0)
      map[d].count += 1
    })
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map(r => ({ ...r, label: r.date.slice(5) }))
  }, [bills])

  // Method share for mini bar
  const methodChartData = useMemo(() => {
    return summary
      .filter(s => s.total > 0)
      .map(s => ({ name: s.label, value: s.total, count: s.count }))
      .sort((a, b) => b.value - a.value)
  }, [summary])

  const normalizedSearch = search.trim().toLowerCase()

  const filteredBills = useMemo(
    () =>
      bills.filter(bill => {
        const matchesFilter =
          filter === 'all' || bill.payment_method === filter

        if (!normalizedSearch) return matchesFilter

        const paymentRef = getPaymentRef(bill)
        const searchableText = [
          bill.invoice_number,
          bill.customer_name,
          bill.customer_phone,
          bill.customer_email,
          bill.payment_method,
          bill.payment_status,
          bill.created_at,
          bill.razorpay_payment_id,
          bill.razorpay_order_id,
          paymentRef,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return matchesFilter && searchableText.includes(normalizedSearch)
      }),
    [bills, filter, normalizedSearch],
  )

  const handleSort = key => {
    if (sortBy === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
    setCurrentPage(1)
  }

  const sortedFilteredBills = useMemo(() => {
    const list = [...filteredBills]
    list.sort((a, b) => {
      let valA, valB
      if (sortBy === 'amount') {
        valA = Number(a.paid_amount ?? a.grand_total ?? 0)
        valB = Number(b.paid_amount ?? b.grand_total ?? 0)
      } else if (sortBy === 'status') {
        valA = String(a.payment_status || '').toLowerCase()
        valB = String(b.payment_status || '').toLowerCase()
      } else if (sortBy === 'invoice') {
        valA = String(a.invoice_number || '').toLowerCase()
        valB = String(b.invoice_number || '').toLowerCase()
      } else {
        // default: date
        valA = new Date(a.created_at || a.date || 0).getTime()
        valB = new Date(b.created_at || b.date || 0).getTime()
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [filteredBills, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedFilteredBills.length / pageSize))
  const pagedBills = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedFilteredBills.slice(start, start + pageSize)
  }, [sortedFilteredBills, currentPage, pageSize])

  // Reset pagination on filter or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, search, pageSize])

  // Close menus on page/sort changes or outside click
  useEffect(() => {
    setOpenActionMenuId(null)
  }, [currentPage, pageSize, filter, search, sortBy, sortDir])

  useEffect(() => {
    const handleClickOutside = e => {
      if (!e.target.closest('.payment-action-menu-container')) {
        setOpenActionMenuId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <div className="payments-page min-w-0 space-y-4 overflow-x-hidden pb-4 sm:space-y-6 sm:pb-6">
      <style>{`
        .payments-page * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .payments-page *::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .payments-page {
          --payment-cash-bg: #ecfdf5;
          --payment-cash-text: #047857;
          --payment-cash-border: #a7f3d0;

          --payment-upi-bg: #eff6ff;
          --payment-upi-text: #1d4ed8;
          --payment-upi-border: #bfdbfe;

          --payment-card-bg: #f5f3ff;
          --payment-card-text: #6d28d9;
          --payment-card-border: #ddd6fe;

          --payment-credit-bg: #fff1f2;
          --payment-credit-text: #be123c;
          --payment-credit-border: #fecdd3;

          --payment-warning-bg: #fffbeb;
          --payment-warning-text: #b45309;
          --payment-warning-border: #fde68a;
        }

        .dark .payments-page,
        [data-theme="dark"] .payments-page {
          --payment-cash-bg: #052e24;
          --payment-cash-text: #6ee7b7;
          --payment-cash-border: #065f46;

          --payment-upi-bg: #172554;
          --payment-upi-text: #93c5fd;
          --payment-upi-border: #1e40af;

          --payment-card-bg: #2e1065;
          --payment-card-text: #c4b5fd;
          --payment-card-border: #5b21b6;

          --payment-credit-bg: #4c0519;
          --payment-credit-text: #fda4af;
          --payment-credit-border: #9f1239;

          --payment-warning-bg: #451a03;
          --payment-warning-text: #fcd34d;
          --payment-warning-border: #92400e;
        }

        .payments-page .section-heading {
          background: var(--surface);
        }
        .payments-page .payment-table tbody tr:hover td {
          background: var(--surface-elevated);
        }
        .payments-page .payment-table td:first-child,
        .payments-page .payment-table th:first-child {
          padding-left: 22px;
        }
        .payments-page .payment-table td:last-child,
        .payments-page .payment-table th:last-child {
          padding-right: 22px;
        }
        .payments-page .metric-accent {
          height: 3px;
          border-radius: 999px;
          background: var(--primary);
          opacity: .75;
        }

        .payments-page button, .payments-page input {\n          -webkit-tap-highlight-color: transparent;\n        }\n        .payments-page .mobile-transaction {\n          min-width: 0;\n        }\n        @media (max-width: 639px) {\n          .payments-page .section-heading {\n            border-radius: 0;\n          }\n          .payments-page .payment-table {\n            min-width: 720px;\n          }\n        }\n\n        .payments-page .payment-table {
          width: 100%;
          border-collapse: collapse;
        }

        .payments-page .payment-table th {
          padding: 10px 14px;
          border-right: 1px solid var(--line-subtle);
          text-align: left;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0;
          color: var(--ink-secondary);
          background: var(--table-header-bg);
          border-bottom: 1px solid var(--line);
          white-space: nowrap;
        }

        .payments-page .payment-table td {
          padding: 10px 14px;
          border-right: 1px solid var(--line-subtle);
          border-bottom: 1px solid var(--line-subtle);
          font-size: 14px;
          vertical-align: middle;
        }

        .payments-page .payment-table th:last-child,
        .payments-page .payment-table td:last-child {
          border-right: 0;
        }

        .payments-page .payment-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .payments-page .payment-table tbody tr {
          transition: background .15s ease;
        }

        .payments-page .payment-table tbody tr:hover {
          background: var(--surface-elevated);
        }
      `}</style>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[var(--muted-light)]">
            <IconReceipt size={15} />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em]">
              Finance / Payments
            </span>
          </div>

          <h1 className="text-lg font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
            Payment Sheet
          </h1>

          <p className="mt-0.5 text-xs text-[var(--muted)] sm:text-sm">
            Track collections, credit sales, Razorpay online gateway, and payment transactions.
          </p>
        </div>

        <div className="hidden sm:flex sm:w-auto sm:items-center sm:gap-2">
          <button
            type="button"
            onClick={() => navigate('/payments/reconciliation')}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink-secondary)] shadow-sm transition hover:bg-[var(--surface-elevated)]"
          >
            <IconShieldCheck size={14} className="text-blue-600" />
            <span>Transaction Ledger</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/billing/new')}
            className="btn-primary inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white dark:text-slate-900 shadow-sm transition"
          >
            <IconPlus size={15} />
            <span>New Bill</span>
          </button>
        </div>
      </header>

      {/* View Switcher: Sales Transactions vs Collection History vs Customer Dues */}
      <div className="flex w-full max-w-full gap-1 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] p-1 shadow-xs sm:inline-flex sm:w-auto">
        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'transactions'
              ? 'bg-[var(--primary)] text-white dark:text-slate-900 shadow-xs'
              : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
          }`}
        >
          <IconReceipt size={14} />
          <span>Sales Transactions ({bills.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('collections')}
          className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'collections'
              ? 'bg-[var(--primary)] text-white dark:text-slate-900 shadow-xs'
              : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
          }`}
        >
          <IconHistory size={14} />
          <span>Payment Collection History</span>
          <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
            activeTab === 'collections'
              ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
          }`}>
            {collections.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('collection')}
          className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-semibold transition ${
            activeTab === 'collection'
              ? 'bg-[var(--primary)] text-white dark:text-slate-900 shadow-xs'
              : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
          }`}
        >
          <IconCurrencyRupee size={14} />
          <span>Customer Credit Dues</span>
          {dueCustomers.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
              activeTab === 'collection'
                ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
            }`}>
              {dueCustomers.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'transactions' && (
        <>
          {/* DATE FILTER BAR */}
          <section className={`${mobileFiltersOpen ? 'block' : 'hidden'} sm:block rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 sm:p-3`}>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <IconCalendar size={13} className="shrink-0 text-[var(--muted)]" />
                {DATE_PRESETS.map(preset => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                      datePreset === preset.key
                        ? 'bg-[#1E3A5F] text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateStart}
                  max={dateEnd || today}
                  onChange={e => { setDateStart(e.target.value); setDatePreset('custom') }}
                  className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-mono text-[var(--ink)] outline-none focus:border-[#1E3A5F]"
                />
                <span className="text-[10px] text-[var(--muted)] font-semibold">TO</span>
                <input
                  type="date"
                  value={dateEnd}
                  min={dateStart}
                  max={today}
                  onChange={e => { setDateEnd(e.target.value); setDatePreset('custom') }}
                  className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-mono text-[var(--ink)] outline-none focus:border-[#1E3A5F]"
                />
                <button
                  type="button"
                  onClick={() => loadPayments(false)}
                  disabled={loading || refreshing}
                  className="h-8 px-3 rounded-md bg-[#1E3A5F] text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold hover:bg-[#162d4a] disabled:opacity-50 transition"
                >
                  Apply
                </button>
              </div>
            </div>
          </section>
          {/* SUMMARY STRIP */}
          {/* Mobile KPI Grid with Top-Right Round Button for >4 KPIs */}
          <MobileKpiGrid
            title="Payment Metrics"
            primaryKpis={[
              { label: 'Collected', value: formatCurrency(totalCollected), sub: 'Non-credit receipts' },
              { label: 'Credit Due', value: formatCurrency(totalCredit), sub: 'Receivable balances' },
              { label: 'Transactions', value: totalTransactions.toLocaleString('en-IN'), sub: 'Total recorded bills' },
              { label: 'Avg Bill', value: formatCurrency(paymentMetrics.avgBill), sub: 'Per transaction' },
            ]}
            secondaryKpis={[
              { label: 'Tax Collected', value: formatCurrency(paymentMetrics.tax), sub: 'Output GST' },
              { label: 'Discounts', value: formatCurrency(paymentMetrics.discounts), sub: 'Total given' },
            ]}
          />

          {/* Desktop Summary Strip (hidden sm:block) */}
          <section className="hidden sm:block overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
            <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-3 lg:grid-cols-6 sm:divide-y-0 sm:divide-x divide-[var(--line)]">
              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">Collected</span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-teal-600 dark:text-teal-400 tabular-nums truncate">{formatCurrency(totalCollected)}</p>
                <p className="text-[10px] text-[var(--muted)] truncate">Non-credit receipts</p>
              </div>
              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">Credit Due</span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums truncate">{formatCurrency(totalCredit)}</p>
                <p className="text-[10px] text-[var(--muted)] truncate">Receivable balances</p>
              </div>
              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">Transactions</span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[var(--ink)] tabular-nums truncate">{totalTransactions.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-[var(--muted)] truncate">Total recorded bills</p>
              </div>
              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">Avg Bill</span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[var(--ink)] tabular-nums truncate">{formatCurrency(paymentMetrics.avgBill)}</p>
                <p className="text-[10px] text-[var(--muted)] truncate">Per transaction</p>
              </div>
              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">Tax Collected</span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums truncate">{formatCurrency(paymentMetrics.tax)}</p>
                <p className="text-[10px] text-[var(--muted)] truncate">Output GST</p>
              </div>
              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">Discounts</span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-slate-600 dark:text-slate-300 tabular-nums truncate">{formatCurrency(paymentMetrics.discounts)}</p>
                <p className="text-[10px] text-[var(--muted)] truncate">Total given</p>
              </div>
            </div>
          </section>

          {/* STATUS METRICS + METHOD BREAKDOWN */}
          <div className="grid items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-2">
            {/* Status pills */}
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Payment Status Breakdown</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Paid', paymentMetrics.paid, 'text-emerald-700 dark:text-emerald-300', 'bg-emerald-50 dark:bg-emerald-950/40'],
                  ['Partial', paymentMetrics.partial, 'text-amber-700 dark:text-amber-300', 'bg-amber-50 dark:bg-amber-950/40'],
                  ['Pending', paymentMetrics.pending, 'text-orange-700 dark:text-orange-300', 'bg-orange-50 dark:bg-orange-950/40'],
                  ['Refunded', paymentMetrics.refunded, 'text-rose-700 dark:text-rose-300', 'bg-rose-50 dark:bg-rose-950/40'],
                ].map(([label, value, color, bg]) => (
                  <div key={label} className={`rounded-lg p-2.5 ${bg}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p>
                    <p className={`mt-0.5 font-mono text-xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
              <div className="pt-1 border-t border-[var(--line)]">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--muted)] font-semibold">Outstanding balance</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400">{formatCurrency(paymentMetrics.outstanding)}</span>
                </div>
              </div>
            </div>

           

            {/* Daily trend chart */}
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                <IconChartBar size={12} /> Daily Collections Trend
              </p>
              {dailyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={dailyChartData} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip
                      formatter={v => formatCurrency(v)}
                      labelFormatter={l => `Date: ${l}`}
                      contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid var(--line)', background: 'var(--surface)' }}
                    />
                    <Bar dataKey="total" radius={[3, 3, 0, 0]}>
                      {dailyChartData.map((_, i) => (
                        <Cell key={i} fill={i === dailyChartData.length - 1 ? '#0F766E' : '#1E3A5F'} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[110px] items-center justify-center text-xs text-[var(--muted)]">
                  No daily data for this period
                </div>
              )}
            </div>
          </div>

      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="section-heading border-b border-[var(--line)] p-3 sm:p-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <IconAdjustmentsHorizontal
                  size={15}
                  className="text-[var(--muted)]"
                />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                  Payment Transactions
                </h2>
              </div>

              <p className="mt-0.5 text-xs text-[var(--muted-light)]">
                {filteredBills.length} transaction
                {filteredBills.length === 1 ? '' : 's'} displayed
              </p>
            </div>

            <div className="flex w-full min-w-0 items-center gap-2 lg:w-auto">
              <SearchInput
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClear={() => setSearch('')}
                placeholder="Search payments by invoice, customer or transaction ID..."
                shortcut="Ctrl+K"
                className="w-full lg:w-80"
              />

              <button
                type="button"
                onClick={() => setMobileFiltersOpen(v => !v)}
                className={`sm:hidden inline-flex h-[42px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-2xs transition shrink-0 ${
                  mobileFiltersOpen || filter !== 'all' || datePreset !== 'all'
                    ? 'border-[#1E3A5F] bg-blue-50 text-[#1E3A5F] dark:border-blue-600 dark:bg-blue-950/50 dark:text-sky-300'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]'
                }`}
                aria-label="Toggle filters"
              >
                <IconFilter size={15} />
                <span>Filters</span>
              </button>
            </div>
          </div>

          <div className={`${mobileFiltersOpen ? 'flex' : 'hidden'} sm:flex mt-2.5 gap-1 overflow-x-auto rounded-md pb-0.5 bg-[var(--surface-elevated)] p-1`}>
            {FILTERS.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                  filter === item.key
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--ink-secondary)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {loading && !refreshing ? (
          <div className="p-4">
            <TableSkeleton rows={8} cols={8} label="Loading payment transactions" />
          </div>
        ) : error ? (
          <ErrorState
            title="Unable to load payments"
            message={error}
            onRetry={() => loadPayments(false)}
          />
        ) : filteredBills.length === 0 ? (
          bills.length === 0 ? (
            <EmptyState
              icon={IconWallet}
              title="No payments recorded yet"
              description="All invoice payments, customer credit settlements, and online gateway transactions will appear here."
              action={{
                label: 'Create First Bill',
                onClick: () => navigate('/billing/new'),
              }}
            />
          ) : search.trim() !== '' ? (
            <EmptyState
              icon={IconSearch}
              title="No payments match your search"
              description={`No transactions found matching "${search}". Check for typos or search by invoice number, customer name, or payment ID.`}
              action={{
                label: 'Clear search',
                onClick: () => setSearch(''),
              }}
            />
          ) : (
            <EmptyState
              icon={IconAdjustmentsHorizontal}
              title="No transactions for this method"
              description={`There are no ${METHOD_META[filter]?.label || filter} payment transactions recorded for the selected date range.`}
              action={{
                label: 'Show all payments',
                onClick: () => setFilter('all'),
              }}
            />
          )
        ) : (
          <>
            {/* MOBILE CARDS VIEW (sm:hidden) */}
            <div className="sm:hidden divide-y divide-[var(--line-subtle)]">
              {pagedBills.map((bill, idx) => {
                const paymentRef = getPaymentRef(bill)
                const isMenuOpen = openActionMenuId === `mobile-${bill.id}`
                const isLastRows = pagedBills.length > 2 && idx >= pagedBills.length - 2
                return (
                  <article key={bill.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <PaymentStatus status={bill.payment_status} />
                          <PaymentBadge method={bill.payment_method} />
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 font-mono text-xs">
                          <button
                            type="button"
                            onClick={() => navigate(`/sales/invoices?search=${encodeURIComponent(bill.invoice_number || '')}`)}
                            className="font-bold text-[var(--primary)] hover:underline"
                            title="View invoice"
                          >
                            {bill.invoice_number || 'No invoice #'}
                          </button>
                          <span className="text-[var(--muted-light)]">•</span>
                          <span className="text-[11px] text-[var(--muted)] truncate max-w-[120px]" title={paymentRef}>
                            {paymentRef}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-mono text-base font-bold text-[var(--ink)] tabular-nums">
                          {formatCurrency(bill.paid_amount ?? bill.grand_total)}
                        </p>
                        {Number(bill.balance_due || 0) > 0 && (
                          <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                            Due: {formatCurrency(bill.balance_due)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--ink)] truncate">
                          {bill.customer_name || 'Walk-in customer'}
                        </p>
                        {bill.customer_phone && (
                          <p className="text-[11px] text-[var(--muted-light)] font-mono">{bill.customer_phone}</p>
                        )}
                      </div>
                      <div className="text-right font-mono text-[11px] text-[var(--muted)] shrink-0">
                        {formatDateTime(bill.created_at || bill.date)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[var(--line-subtle)]">
                      <button
                        type="button"
                        onClick={() => setSelectedBill(bill)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <span>View details</span>
                        <span>→</span>
                      </button>

                      <div className="relative payment-action-menu-container flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={invoiceAction?.startsWith(`${bill.id}:`)}
                          onClick={() => handleInvoiceAction(bill, 'print')}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                        >
                          <IconPrinter size={12} />
                          <span>Invoice</span>
                        </button>

                        <button
                          type="button"
                          disabled={invoiceAction?.startsWith(`${bill.id}:`)}
                          onClick={() => handleReceiptAction(bill)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                          title="Print thermal receipt"
                        >
                          <IconReceipt size={12} />
                          <span>Receipt</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setOpenActionMenuId(isMenuOpen ? null : `mobile-${bill.id}`)}
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--ink)]"
                          aria-label="More actions"
                        >
                          <IconDotsVertical size={13} />
                        </button>

                        {isMenuOpen && (
                          <div
                            className={`absolute right-0 z-30 w-44 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-lg ${
                              isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBill(bill)
                                setOpenActionMenuId(null)
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                            >
                              <IconEye size={13} className="text-[var(--muted)]" />
                              <span>View Details</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleInvoiceAction(bill, 'download')
                                setOpenActionMenuId(null)
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                            >
                              <IconDownload size={13} className="text-[var(--muted)]" />
                              <span>Download PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleCopy(paymentRef, `mobile-copy-${bill.id}`)
                                setOpenActionMenuId(null)
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                            >
                              <IconCopy size={13} className="text-[var(--muted)]" />
                              <span>Copy Ref ID</span>
                            </button>
                            {(bill.razorpay_payment_id || bill.payment_method === 'razorpay') && (
                              <button
                                type="button"
                                onClick={() => {
                                  navigate('/payments/reconciliation')
                                  setOpenActionMenuId(null)
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                              >
                                <IconShieldCheck size={13} />
                                <span>Transaction Ledger</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            {/* DESKTOP TABLE VIEW (hidden sm:block) */}
            <div className="hidden sm:block overflow-x-auto min-h-[280px]">
              <table className="payment-table table-fixed w-full min-w-[840px]">
                <colgroup>
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '9%' }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-[var(--surface-subtle)] shadow-2xs">
                  <tr>
                    <th className="text-left font-bold text-xs uppercase tracking-wider text-[var(--muted)]">Payment</th>
                    <th className="text-left font-bold text-xs uppercase tracking-wider text-[var(--muted)]">Invoice</th>
                    <th className="text-left font-bold text-xs uppercase tracking-wider text-[var(--muted)]">Customer</th>
                    <th className="text-left font-bold text-xs uppercase tracking-wider text-[var(--muted)]">Method</th>
                    <th className="text-right font-bold text-xs uppercase tracking-wider text-[var(--muted)]">
                      <button
                        type="button"
                        onClick={() => handleSort('amount')}
                        className="inline-flex items-center gap-1 font-bold hover:text-[var(--ink)] transition ml-auto"
                        title="Sort by amount"
                      >
                        <span>Amount</span>
                        <IconArrowsSort size={11} className={sortBy === 'amount' ? 'text-[var(--primary)]' : 'opacity-40'} />
                      </button>
                    </th>
                    <th className="text-center font-bold text-xs uppercase tracking-wider text-[var(--muted)]">
                      <button
                        type="button"
                        onClick={() => handleSort('status')}
                        className="inline-flex items-center gap-1 font-bold hover:text-[var(--ink)] transition mx-auto"
                        title="Sort by status"
                      >
                        <span>Status</span>
                        <IconArrowsSort size={11} className={sortBy === 'status' ? 'text-[var(--primary)]' : 'opacity-40'} />
                      </button>
                    </th>
                    <th className="text-left font-bold text-xs uppercase tracking-wider text-[var(--muted)]">
                      <button
                        type="button"
                        onClick={() => handleSort('date')}
                        className="inline-flex items-center gap-1 font-bold hover:text-[var(--ink)] transition"
                        title="Sort by date"
                      >
                        <span>Date</span>
                        <IconArrowsSort size={11} className={sortBy === 'date' ? 'text-[var(--primary)]' : 'opacity-40'} />
                      </button>
                    </th>
                    <th className="text-right font-bold text-xs uppercase tracking-wider text-[var(--muted)]">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {pagedBills.map((bill, idx) => {
                    const paymentRef = getPaymentRef(bill)
                    const isMenuOpen = openActionMenuId === bill.id
                    const isLastRows = pagedBills.length > 2 && idx >= pagedBills.length - 2
                    return (
                      <tr key={bill.id} className="transition-colors hover:bg-[var(--surface-elevated)]">
                        {/* 1. PAYMENT ID */}
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="font-mono text-xs font-bold text-[var(--ink)] truncate max-w-[120px]"
                              title={paymentRef}
                            >
                              {paymentRef}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(paymentRef, `tbl-pmt-${bill.id}`)}
                              className="p-1 rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                              title="Copy payment reference"
                            >
                              {copiedKey === `tbl-pmt-${bill.id}` ? (
                                <IconCheck size={12} className="text-emerald-600" />
                              ) : (
                                <IconCopy size={12} />
                              )}
                            </button>
                          </div>
                          {bill.razorpay_payment_id && (
                            <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-blue-600 dark:text-blue-400">
                              <IconShieldCheck size={11} className="shrink-0" />
                              <span className="truncate max-w-[120px]">Gateway</span>
                            </div>
                          )}
                        </td>

                        {/* 2. INVOICE */}
                        <td>
                          <button
                            type="button"
                            onClick={() => navigate(`/sales/invoices?search=${encodeURIComponent(bill.invoice_number || '')}`)}
                            className="inline-flex max-w-36 truncate rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-xs font-extrabold text-[#1E3A5F] hover:underline dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-100"
                            title={bill.invoice_number || 'View Invoice'}
                          >
                            {bill.invoice_number || '—'}
                          </button>
                          {Number(bill.balance_due || 0) > 0 && (
                            <p className="mt-0.5 font-mono text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                              Due: {formatCurrency(bill.balance_due)}
                            </p>
                          )}
                        </td>

                        {/* 3. CUSTOMER */}
                        <td>
                          <div className="min-w-0 max-w-[180px]">
                            <p className="text-xs font-semibold text-[var(--ink)] truncate">
                              {bill.customer_name || 'Walk-in customer'}
                            </p>
                            {bill.customer_phone ? (
                              <p className="mt-0.5 text-[11px] text-[var(--muted-light)] font-mono flex items-center gap-1 truncate">
                                <IconPhone size={10} className="shrink-0" />
                                <span>{bill.customer_phone}</span>
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[10px] text-[var(--muted-light)]">No phone</p>
                            )}
                          </div>
                        </td>

                        {/* 4. METHOD */}
                        <td>
                          <PaymentBadge method={bill.payment_method} />
                        </td>

                        {/* 5. AMOUNT */}
                        <td className="text-right">
                          <span className="amount price font-mono text-xs font-bold text-[var(--ink)] tabular-nums">
                            {formatCurrency(bill.paid_amount ?? bill.grand_total)}
                          </span>
                          {Number(bill.paid_amount) > 0 && Number(bill.paid_amount) < Number(bill.grand_total) && (
                            <p className="text-[10px] text-[var(--muted)] font-mono">
                              of {formatCurrency(bill.grand_total)}
                            </p>
                          )}
                        </td>

                        {/* 6. STATUS */}
                        <td className="text-center">
                          <PaymentStatus status={bill.payment_status} />
                        </td>

                        {/* 7. DATE */}
                        <td>
                          <span className="text-xs font-mono text-[var(--muted)]">
                            {formatDateTime(bill.created_at || bill.date)}
                          </span>
                        </td>

                        {/* 8. ACTIONS */}
                        <td className="text-right">
                          <div className="relative payment-action-menu-container inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedBill(bill)}
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                              title="View transaction details"
                            >
                              <IconEye size={12} />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setOpenActionMenuId(isMenuOpen ? null : bill.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                              title="More actions"
                            >
                              <IconDotsVertical size={13} />
                            </button>

                            {isMenuOpen && (
                              <div
                                className={`absolute right-0 z-30 w-48 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 text-left shadow-lg ${
                                  isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedBill(bill)
                                    setOpenActionMenuId(null)
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                                >
                                  <IconEye size={13} className="text-[var(--muted)]" />
                                  <span>View Details</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigate(`/sales/invoices?search=${encodeURIComponent(bill.invoice_number || '')}`)
                                    setOpenActionMenuId(null)
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                                >
                                  <IconFileText size={13} className="text-[var(--muted)]" />
                                  <span>View Invoice</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={invoiceAction?.startsWith(`${bill.id}:`)}
                                  onClick={() => {
                                    handleInvoiceAction(bill, 'print')
                                    setOpenActionMenuId(null)
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                                >
                                  <IconPrinter size={13} className="text-[var(--muted)]" />
                                  <span>Print Invoice</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={invoiceAction?.startsWith(`${bill.id}:`)}
                                  onClick={() => {
                                    handleReceiptAction(bill)
                                    setOpenActionMenuId(null)
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                                >
                                  <IconReceipt size={13} className="text-[var(--muted)]" />
                                  <span>Print Thermal Receipt</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={invoiceAction?.startsWith(`${bill.id}:`)}
                                  onClick={() => {
                                    handleInvoiceAction(bill, 'download')
                                    setOpenActionMenuId(null)
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                                >
                                  <IconDownload size={13} className="text-[var(--muted)]" />
                                  <span>Download PDF</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleCopy(paymentRef, `overflow-copy-${bill.id}`)
                                    setOpenActionMenuId(null)
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                                >
                                  <IconCopy size={13} className="text-[var(--muted)]" />
                                  <span>Copy Payment ID</span>
                                </button>
                                {(bill.razorpay_payment_id || bill.payment_method === 'razorpay') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigate('/payments/reconciliation')
                                      setOpenActionMenuId(null)
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                                  >
                                    <IconShieldCheck size={13} />
                                    <span>Transaction Ledger</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION TOOLBAR */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[var(--line)] bg-[var(--surface)] text-xs text-[var(--muted)]">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <span>
                  Showing <strong className="text-[var(--ink)] font-semibold">{sortedFilteredBills.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> to <strong className="text-[var(--ink)] font-semibold">{Math.min(currentPage * pageSize, sortedFilteredBills.length)}</strong> of <strong className="text-[var(--ink)] font-semibold">{sortedFilteredBills.length}</strong> payments
                </span>
                <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--line)]">
                  <span className="text-[11px] text-[var(--muted)]">Rows:</span>
                  <select
                    value={pageSize}
                    onChange={e => {
                      setPageSize(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="h-7 rounded border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 text-xs font-semibold text-[var(--ink)] outline-none focus:border-[#1E3A5F]"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="btn-secondary h-8 px-2.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>

                <span className="px-2 text-xs font-semibold text-[var(--ink)]">
                  {currentPage} / {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="btn-secondary h-8 px-2.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
        </>
      )}

      {activeTab === 'collections' && (
        <div className="space-y-4">
          {/* Payment Collection Summary Metrics Strip */}
          <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
            <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x divide-[var(--line)]">
              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
                  Total Collections
                </span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
                  {formatCurrency(collectionTotals.total)}
                </p>
                <p className="text-[10px] text-[var(--muted)] truncate">{collectionTotals.count} payments recorded</p>
              </div>

              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
                  Cash Collections
                </span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[var(--ink)] tabular-nums truncate">
                  {formatCurrency(collectionTotals.cash)}
                </p>
                <p className="text-[10px] text-[var(--muted)] truncate">Physical cash receipts</p>
              </div>

              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
                  UPI / QR Collections
                </span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-sky-600 dark:text-sky-400 tabular-nums truncate">
                  {formatCurrency(collectionTotals.upi)}
                </p>
                <p className="text-[10px] text-[var(--muted)] truncate">Direct QR &amp; VPA scans</p>
              </div>

              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
                  Card &amp; Bank Collections
                </span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-violet-600 dark:text-violet-400 tabular-nums truncate">
                  {formatCurrency(collectionTotals.cardBank)}
                </p>
                <p className="text-[10px] text-[var(--muted)] truncate">POS terminal &amp; NEFT/RTGS</p>
              </div>
            </div>
          </div>

          {/* Collection Filter & Search Bar */}
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-2.5 sm:p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <SearchInput
                value={collectionSearchQuery}
                onChange={e => setCollectionSearchQuery(e.target.value)}
                onClear={() => setCollectionSearchQuery('')}
                placeholder="Search collections by Customer, Mobile, Transaction ID, Invoice #..."
                className="flex-1"
              />

              {/* Method filter chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
                {[
                  { id: 'all', label: 'All Methods' },
                  { id: 'cash', label: 'Cash' },
                  { id: 'upi', label: 'UPI / QR' },
                  { id: 'card_bank', label: 'Card / Bank' },
                ].map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setCollectionMethodFilter(m.id)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition ${
                      collectionMethodFilter === m.id
                        ? 'bg-[#1E3A5F] text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                        : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={loadCollections}
                  disabled={loadingCollections}
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-elevated)] transition"
                  title="Refresh collection history"
                >
                  <IconRefresh size={13} className={loadingCollections ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* Collection History Table / Cards */}
          {loadingCollections ? (
            <div className="flex min-h-60 items-center justify-center">
              <Spinner />
            </div>
          ) : filteredCollections.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center p-6 text-center border border-[var(--line)] rounded-md bg-[var(--surface)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--muted)] mb-2">
                <IconHistory size={24} className="text-[#1E3A5F] dark:text-sky-400" />
              </div>
              <h4 className="text-sm font-bold text-[var(--ink)]">No payment collections found</h4>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {collectionSearchQuery || collectionMethodFilter !== 'all'
                  ? 'No collection matches your search/filter criteria.'
                  : 'Collected payments with transaction IDs and receipts will appear here.'}
              </p>
              {dueCustomers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('collection')}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-bold shadow-xs hover:bg-[#162F4D] transition"
                >
                  <IconCurrencyRupee size={14} />
                  <span>View Customer Dues to Collect</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-xs">
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto min-h-[220px]">
                <table className="erp-table w-full text-left text-xs min-w-[800px]">
                  <colgroup>
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '11%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '14%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Date &amp; Time (When)</th>
                      <th>Payment ID</th>
                      <th>Transaction ID / Ref</th>
                      <th>Who Gave (Customer)</th>
                      <th>Who Collected</th>
                      <th>Linked Invoice</th>
                      <th>Method</th>
                      <th className="text-right">Amount Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCollections.map((c, idx) => {
                      const payMethod = (c.method || 'cash').toLowerCase()
                      const MethodIcon = (payMethod === 'upi' ? IconQrcode : payMethod === 'card' ? IconCreditCard : payMethod === 'bank' ? IconBuildingBank : IconCurrencyRupee) || IconCurrencyRupee
                      const methodColor = payMethod === 'upi' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' : payMethod === 'card' ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300' : payMethod === 'bank' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      const txnId = c.reference || c.transaction_id || `TXN-COL-${c.id}`

                      return (
                        <tr key={c.id || idx} className="hover:bg-[var(--surface-hover)] transition">
                          <td>
                            <div className="font-mono text-xs text-[var(--ink)] font-medium">
                              {formatDate(c.created_at)}
                            </div>
                            <div className="font-mono text-[10px] text-[var(--muted)]">
                              {formatTime(c.created_at)}
                            </div>
                          </td>
                          <td>
                            <span className="font-mono font-bold text-xs text-[var(--ink)]">
                              #PAY-{c.id}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5 font-mono text-xs">
                              <span className="font-bold text-slate-800 dark:text-slate-200 select-all truncate max-w-[140px]">
                                {txnId}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyTxnId(txnId)}
                                className="inline-flex items-center text-sky-700 hover:text-sky-800 dark:text-sky-400"
                                title="Copy Transaction ID"
                              >
                                {copiedCollectionTxn === txnId ? (
                                  <span className="text-[10px] font-bold text-emerald-600">Copied</span>
                                ) : (
                                  <IconCopy size={12} />
                                )}
                              </button>
                            </div>
                            {c.notes && (
                              <p className="text-[10px] text-[var(--muted)] truncate max-w-[160px]">{c.notes}</p>
                            )}
                          </td>
                          <td>
                            <div className="font-bold text-[var(--ink)] truncate">
                              {c.customer_name || 'Walk-in Customer'}
                            </div>
                            {c.customer_mobile && (
                              <a
                                href={`tel:${c.customer_mobile}`}
                                className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                              >
                                <IconPhone size={10} />
                                <span>{c.customer_mobile}</span>
                              </a>
                            )}
                          </td>
                          <td>
                            <div className="font-semibold text-xs text-[var(--ink)]">
                              {c.created_by_name || c.collected_by_name || 'Staff / Cashier'}
                            </div>
                            <span className="text-[10px] text-[var(--muted)]">Receiver</span>
                          </td>
                          <td>
                            {c.invoice_number ? (
                              <span className="inline-flex items-center gap-1 font-mono font-semibold text-xs text-[#1E3A5F] dark:text-sky-300">
                                <IconReceipt size={12} />
                                <span>{c.invoice_number}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-[var(--muted)]">Direct Account</span>
                            )}
                          </td>
                          <td>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${methodColor}`}>
                              <MethodIcon size={12} />
                              <span>{c.method || 'Cash'}</span>
                            </span>
                          </td>
                          <td className="text-right">
                            <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                              + {formatCurrency(c.amount)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="sm:hidden divide-y divide-[var(--line-subtle)]">
                {filteredCollections.map((c, idx) => {
                  const payMethod = (c.method || 'cash').toLowerCase()
                  const MethodIcon = (payMethod === 'upi' ? IconQrcode : payMethod === 'card' ? IconCreditCard : payMethod === 'bank' ? IconBuildingBank : IconCurrencyRupee) || IconCurrencyRupee
                  const methodColor = payMethod === 'upi' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' : payMethod === 'card' ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300' : payMethod === 'bank' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  const txnId = c.reference || c.transaction_id || `TXN-COL-${c.id}`

                  return (
                    <div key={c.id || idx} className="p-3.5 space-y-2 bg-[var(--surface)]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-[var(--ink)]">
                              #PAY-{c.id}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${methodColor}`}>
                              <MethodIcon size={11} />
                              <span>{c.method || 'Cash'}</span>
                            </span>
                          </div>
                          <p className="font-bold text-sm text-[var(--ink)] mt-0.5">
                            {c.customer_name || 'Walk-in Customer'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-base text-emerald-600 dark:text-emerald-400 tabular-nums">
                            + {formatCurrency(c.amount)}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-subtle)] p-2 text-xs space-y-1">
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="text-[var(--muted)]">TXN ID:</span>
                          <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                            <span className="select-all break-all">{txnId}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyTxnId(txnId)}
                              className="text-sky-700 dark:text-sky-400"
                            >
                              {copiedCollectionTxn === txnId ? (
                                <span className="text-[10px] text-emerald-600">Copied</span>
                              ) : (
                                <IconCopy size={11} />
                              )}
                            </button>
                          </div>
                        </div>

                        {c.invoice_number && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[var(--muted)]">Invoice:</span>
                            <span className="font-mono font-semibold text-[#1E3A5F] dark:text-sky-300">
                              #{c.invoice_number}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[var(--muted)]">Who Collected:</span>
                          <span className="font-semibold text-[var(--ink)]">
                            {c.created_by_name || c.collected_by_name || 'Staff / Cashier'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
                          <span>When Collected:</span>
                          <span>{formatDate(c.created_at)} &bull; {formatTime(c.created_at)}</span>
                        </div>
                      </div>

                      {c.notes && (
                        <p className="text-[11px] text-[var(--muted)] italic">
                          Notes: {c.notes}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'collection' && (
        <div className="space-y-4">
          {/* Outstanding Receivables Metrics Strip */}
          <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
            <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x divide-[var(--line)]">
              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
                  Total Receivables Due
                </span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums truncate">
                  {formatCurrency(totalOutstandingReceivables)}
                </p>
                <p className="text-[10px] text-[var(--muted)] truncate">{dueCustomers.length} customers with balance</p>
              </div>

              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
                  Customers with Dues
                </span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums truncate">
                  {dueCustomers.length}
                </p>
                <p className="text-[10px] text-[var(--muted)] truncate">Pending recovery</p>
              </div>

              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
                  Credit Limit Extended
                </span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[var(--ink)] tabular-nums truncate">
                  {formatCurrency(totalCreditLimitGiven)}
                </p>
                <p className="text-[10px] text-[var(--muted)] truncate">Total allowed credit</p>
              </div>

              <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
                  Total Customers
                </span>
                <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[var(--primary)] tabular-nums truncate">
                  {customers.length}
                </p>
                <p className="text-[10px] text-[var(--muted)] truncate">In store registry</p>
              </div>
            </div>
          </div>

          {/* Collection Filter & Search Bar */}
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-2.5 sm:p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <SearchInput
                value={collectionSearch}
                onChange={e => setCollectionSearch(e.target.value)}
                onClear={() => setCollectionSearch('')}
                placeholder="Search customer by name, mobile, or GSTIN..."
                className="flex-1"
              />

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setOnlyWithBalance(v => !v)}
                  className={`px-3 py-2 text-xs font-semibold rounded-md border transition ${
                    onlyWithBalance
                      ? 'border-rose-300 dark:border-rose-800 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                      : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {onlyWithBalance ? `Only Due (${dueCustomers.length})` : `All (${customers.length})`}
                </button>

                <button
                  type="button"
                  onClick={loadCustomers}
                  disabled={loadingCustomers}
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]"
                  title="Refresh customers"
                >
                  <IconRefresh size={13} className={loadingCustomers ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* Customer Table / List */}
          {loadingCustomers ? (
            <div className="flex min-h-60 items-center justify-center">
              <Spinner />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex min-h-60 flex-col items-center justify-center p-6 text-center border border-[var(--line)] rounded-md bg-[var(--surface)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--muted)] mb-2">
                <IconCircleCheck size={24} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h4 className="text-sm font-bold text-[var(--ink)]">No customer dues found</h4>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {collectionSearch ? 'No customer matches your search filter.' : 'All customer accounts are clear with zero outstanding balance.'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-xs">
              {/* Desktop Table View */}
              <div className="overflow-x-auto min-h-[220px] pb-4">
                <table className="erp-table w-full text-left text-xs min-w-[760px]">
                  <colgroup>
                    <col style={{ width: '28%' }} />
                    <col style={{ width: '16%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '14%' }} />
                    <col style={{ width: '15%' }} />
                    <col style={{ width: '15%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Mobile</th>
                      <th>Bills</th>
                      <th className="text-right">Credit Limit</th>
                      <th className="text-right">Balance Due</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map(customer => {
                      const due = Number(customer.outstanding_amount || 0)
                      return (
                        <tr key={customer.id} className="hover:bg-[var(--surface-hover)] transition">
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--primary)] border border-[var(--line)] font-bold">
                                <IconUserCircle size={12} />
                              </div>
                              <div>
                                <span className="font-bold text-[var(--ink)]">{customer.name}</span>
                                {customer.gstin && (
                                  <span className="block font-mono text-[10px] text-[var(--muted)]">GSTIN: {customer.gstin}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            {customer.mobile ? (
                              <a
                                href={`tel:${customer.mobile}`}
                                className="font-mono text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                              >
                                <IconPhone size={11} />
                                <span>{customer.mobile}</span>
                              </a>
                            ) : (
                              <span className="text-[var(--muted)]">—</span>
                            )}
                          </td>
                          <td className="font-mono text-[var(--muted)]">
                            {customer.total_bills ?? 0} bills
                          </td>
                          <td className="text-right font-mono text-[var(--ink)]">
                            {formatCurrency(customer.credit_limit || 0)}
                          </td>
                          <td className="text-right">
                            <span className={`font-mono font-bold text-sm ${due > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {formatCurrency(due)}
                            </span>
                          </td>
                          <td className="text-right">
                            {due > 0 ? (
                              <button
                                type="button"
                                onClick={() => setSelectedCustomerForPay(customer)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs transition"
                              >
                                <IconCurrencyRupee size={12} />
                                <span>Collect Payment</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                <IconCircleCheck size={11} />
                                <span>Settled</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="hidden">
                {filteredCustomers.map(customer => {
                  const due = Number(customer.outstanding_amount || 0)
                  return (
                    <article key={customer.id} className="p-3.5 space-y-2.5 bg-[var(--surface)]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--primary)] border border-[var(--line)]">
                            <IconUserCircle size={14} />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-sm text-[var(--ink)] truncate">{customer.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                              {customer.mobile ? (
                                <a href={`tel:${customer.mobile}`} className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium">
                                  <IconPhone size={10} />
                                  <span>{customer.mobile}</span>
                                </a>
                              ) : <span>No phone</span>}
                              <span>•</span>
                              <span>{customer.total_bills ?? 0} bills</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className={`font-mono text-sm font-bold ${due > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {formatCurrency(due)}
                          </p>
                          <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                            due > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}>
                            {due > 0 ? 'Due' : 'Clear'}
                          </span>
                        </div>
                      </div>

                      {due > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCustomerForPay(customer)}
                          className="w-full inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs transition"
                        >
                          <IconCurrencyRupee size={13} />
                          <span>Collect Payment</span>
                        </button>
                      )}
                    </article>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedBill && (
        <Modal
          open={Boolean(selectedBill)}
          onClose={() => setSelectedBill(null)}
          title={`Payment Transaction Details`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            {/* 1. PAYMENT OVERVIEW */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[var(--line)]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Payment Reference ID
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-[var(--primary)] select-all">
                      {getPaymentRef(selectedBill)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(getPaymentRef(selectedBill), 'modal-pmt-ref')}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                      title="Copy Payment ID"
                    >
                      {copiedKey === 'modal-pmt-ref' ? (
                        <>
                          <IconCheck size={12} className="text-emerald-600" />
                          <span className="text-emerald-600 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <IconCopy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <PaymentBadge method={selectedBill.payment_method} />
                  <PaymentStatus status={selectedBill.payment_status} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Amount Paid</span>
                  <p className="mt-0.5 font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selectedBill.paid_amount ?? (selectedBill.payment_method === 'credit' ? 0 : selectedBill.grand_total))}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Payment Method</span>
                  <p className="mt-0.5 font-semibold text-[var(--ink)] uppercase">
                    {selectedBill.payment_method || 'Cash'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Created Date &amp; Time</span>
                  <p className="mt-0.5 font-mono text-xs text-[var(--ink)]">
                    {formatDateTime(selectedBill.created_at || selectedBill.date)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Settlement Status</span>
                  <p className="mt-0.5 font-semibold text-[var(--ink)]">
                    {['paid', 'completed'].includes(String(selectedBill.payment_status).toLowerCase())
                      ? 'Captured / Settled'
                      : String(selectedBill.payment_status || 'Pending')}
                  </p>
                </div>
              </div>
            </div>

            {/* 2. INVOICE RELATIONSHIP & FINANCIAL BREAKDOWN */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--line)]">
                <div className="flex items-center gap-2">
                  <IconReceipt className="text-[var(--primary)]" size={16} />
                  <h3 className="font-bold text-sm text-[var(--ink)]">Associated Invoice Details</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBill(null)
                    navigate(`/sales/invoices?search=${encodeURIComponent(selectedBill.invoice_number || '')}`)
                  }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[var(--primary)] hover:underline"
                >
                  <span>Open in Invoices</span>
                  <IconExternalLink size={12} />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--line)]">
                  <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Invoice Number</span>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-[var(--primary)] select-all truncate">
                      {selectedBill.invoice_number || '—'}
                    </span>
                    {selectedBill.invoice_number && (
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedBill.invoice_number, 'modal-inv-num')}
                        className="text-[var(--muted)] hover:text-[var(--ink)] p-0.5 shrink-0"
                        title="Copy Invoice Number"
                      >
                        {copiedKey === 'modal-inv-num' ? (
                          <IconCheck size={11} className="text-emerald-600" />
                        ) : (
                          <IconCopy size={11} />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--line)]">
                  <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Invoice Total</span>
                  <p className="mt-1 font-mono text-xs font-bold text-[var(--ink)]">
                    {formatCurrency(selectedBill.grand_total)}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--line)]">
                  <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Total Paid</span>
                  <p className="mt-1 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selectedBill.paid_amount ?? (selectedBill.payment_method === 'credit' ? 0 : selectedBill.grand_total))}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-[var(--surface-elevated)] border border-[var(--line)]">
                  <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Outstanding Balance</span>
                  <p className={`mt-1 font-mono text-xs font-bold ${Number(selectedBill.balance_due || 0) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                    {formatCurrency(selectedBill.balance_due || 0)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-[var(--line-subtle)]">
                <div className="text-[var(--muted)]">
                  Subtotal: <strong className="font-mono text-[var(--ink)]">{formatCurrency(selectedBill.subtotal)}</strong>
                </div>
                <div className="text-[var(--muted)]">
                  Discount: <strong className="font-mono text-[var(--ink)]">{formatCurrency(selectedBill.discount_amount)}</strong>
                </div>
                <div className="text-[var(--muted)]">
                  Tax (GST): <strong className="font-mono text-[var(--ink)]">{formatCurrency(selectedBill.tax_amount)}</strong>
                </div>
              </div>
            </div>

            {/* 3. CUSTOMER INFORMATION */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                <h4 className="mb-2 flex items-center gap-1.5 font-bold text-[var(--ink)]">
                  <IconUserCircle size={14} className="text-[var(--primary)]" /> Customer Information
                </h4>
                <p className="font-semibold text-sm text-[var(--ink)]">{selectedBill.customer_name || 'Walk-in customer'}</p>
                {selectedBill.customer_phone ? (
                  <a
                    href={`tel:${selectedBill.customer_phone}`}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <IconPhone size={12} />
                    <span>{selectedBill.customer_phone}</span>
                  </a>
                ) : (
                  <p className="mt-1.5 text-xs text-[var(--muted)]">No phone number recorded</p>
                )}
                {selectedBill.customer_email ? (
                  <a
                    href={`mailto:${selectedBill.customer_email}`}
                    className="mt-1 block text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <IconMail size={12} className="inline mr-1" />
                    <span>{selectedBill.customer_email}</span>
                  </a>
                ) : (
                  <p className="mt-1 text-xs text-[var(--muted)]">No email recorded</p>
                )}
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                <h4 className="mb-2 flex items-center gap-1.5 font-bold text-[var(--ink)]">
                  <IconReceiptTax size={14} className="text-[var(--primary)]" /> Notes &amp; Biller
                </h4>
                <p className="text-xs text-[var(--muted)]">{selectedBill.notes || 'No notes attached to this transaction.'}</p>
                <div className="mt-3 pt-2 border-t border-[var(--line)] flex items-center justify-between text-xs">
                  <span className="text-[var(--muted)]">Billed by:</span>
                  <span className="font-semibold text-[var(--ink)]">{selectedBill.created_by_name || 'System / Admin'}</span>
                </div>
              </div>
            </div>

            {/* 4. GATEWAY DETAILS (For Razorpay / Online Payments) */}
            {(selectedBill.payment_method === 'razorpay' || selectedBill.razorpay_payment_id || selectedBill.razorpay_order_id) && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 dark:border-blue-900/60 dark:bg-blue-950/30">
                <div className="flex items-center justify-between pb-2 border-b border-blue-200/60 dark:border-blue-900/40">
                  <h4 className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-200">
                    <IconShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
                    Razorpay Gateway Transaction Details
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBill(null)
                      navigate('/payments/reconciliation')
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                  >
                    <span>Transaction Ledger</span>
                    <IconExternalLink size={12} />
                  </button>
                </div>

                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="rounded-lg border border-blue-100 bg-white p-2.5 dark:border-blue-900/40 dark:bg-slate-900/70">
                    <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Payment ID</span>
                    <div className="mt-0.5 flex items-center justify-between">
                      <p className="select-all font-mono text-xs font-bold text-blue-700 dark:text-blue-300 truncate">
                        {selectedBill.razorpay_payment_id || 'Direct Settlement / Captured'}
                      </p>
                      {selectedBill.razorpay_payment_id && (
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedBill.razorpay_payment_id, 'modal-rzp-pmt')}
                          className="shrink-0 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          title="Copy Payment ID"
                        >
                          {copiedKey === 'modal-rzp-pmt' ? (
                            <IconCheck size={11} className="text-emerald-600" />
                          ) : (
                            <IconCopy size={11} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-blue-100 bg-white p-2.5 dark:border-blue-900/40 dark:bg-slate-900/70">
                    <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Order ID</span>
                    <div className="mt-0.5 flex items-center justify-between">
                      <p className="select-all font-mono text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                        {selectedBill.razorpay_order_id || 'Standard Checkout'}
                      </p>
                      {selectedBill.razorpay_order_id && (
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedBill.razorpay_order_id, 'modal-rzp-ord')}
                          className="shrink-0 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          title="Copy Order ID"
                        >
                          {copiedKey === 'modal-rzp-ord' ? (
                            <IconCheck size={11} className="text-emerald-600" />
                          ) : (
                            <IconCopy size={11} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-[var(--muted)]">Currency</span>
                    <p className="font-mono font-bold text-[var(--ink)]">INR (₹)</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted)]">Method</span>
                    <p className="font-semibold text-[var(--ink)] uppercase">{selectedBill.payment_method || 'Razorpay'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted)]">Gateway Fee</span>
                    <p className="font-mono text-[var(--ink)]">Direct Store Account</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted)]">Capture Status</span>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">Captured (Auto)</p>
                  </div>
                </div>
              </div>
            )}

            {/* 5. SEPARATE PAYMENT LEDGER ENTRIES */}
            {selectedBill.payments && selectedBill.payments.length > 0 && (
              <div className="rounded-xl border border-[var(--line)] p-3">
                <h4 className="mb-2 flex items-center gap-1.5 font-bold text-[var(--ink)]">
                  <IconCash size={14} className="text-[var(--primary)]" /> Payment Entries ({selectedBill.payments.length})
                </h4>
                <div className="space-y-1.5">
                  {selectedBill.payments.map((payment, index) => (
                    <div key={payment.id || index} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-elevated)] p-2">
                      <span className="font-semibold uppercase">{payment.method || selectedBill.payment_method || 'Payment'}</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(payment.amount)}</span>
                      <span className="text-[var(--muted)] font-mono">{formatDateTime(payment.created_at)}</span>
                      <span className="text-[var(--muted)] font-mono">{payment.reference || payment.transaction_id || `ID: ${payment.id}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. INVOICE ITEMS BREAKDOWN */}
            {selectedBill.items && selectedBill.items.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                <table className="erp-table min-w-[560px] text-xs">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>SKU</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Unit price</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBill.items.map((item, index) => (
                      <tr key={item.id || index}>
                        <td className="font-semibold">{item.product_name || item.name || 'Item'}</td>
                        <td className="font-mono text-[var(--muted)]">{item.sku || '—'}</td>
                        <td className="text-right font-mono">{item.quantity || 0}</td>
                        <td className="text-right font-mono">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right font-mono font-bold">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 7. QUICK ACTION BUTTONS */}
            <div className="pt-3 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={invoiceAction?.startsWith(`${selectedBill.id}:`)}
                  onClick={() => handleInvoiceAction(selectedBill, 'print')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-bold text-white dark:text-slate-900 shadow-xs hover:brightness-110 transition disabled:opacity-50"
                >
                  <IconPrinter size={13} />
                  <span>Print Invoice</span>
                </button>
                <button
                  type="button"
                  disabled={invoiceAction?.startsWith(`${selectedBill.id}:`)}
                  onClick={() => handleReceiptAction(selectedBill)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-elevated)] transition disabled:opacity-50"
                >
                  <IconReceipt size={13} />
                  <span>Thermal Receipt</span>
                </button>
                <button
                  type="button"
                  disabled={invoiceAction?.startsWith(`${selectedBill.id}:`)}
                  onClick={() => handleInvoiceAction(selectedBill, 'download')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-elevated)] transition disabled:opacity-50"
                >
                  <IconDownload size={13} />
                  <span>Download PDF</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedBill(null)}
                className="btn-secondary h-8 px-3 text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedCustomerForPay && (
        <CustomerCollectPaymentModal
          customer={selectedCustomerForPay}
          shopSettings={shopSettings}
          shopName={shopName}
          onClose={() => setSelectedCustomerForPay(null)}
          onSuccess={() => {
            loadCustomers()
            loadPayments()
            loadCollections()
            setSelectedCustomerForPay(null)
          }}
        />
      )}
      
      {/* Mobile Dual Floating Action Buttons: New Bill & Transaction Ledger */}
      <div className="fixed right-4 bottom-20 z-40 flex flex-col items-end gap-2 sm:hidden print:hidden">
        <button
          type="button"
          onClick={() => navigate('/audit/transactions')}
          className="flex h-10 items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] px-3.5 text-xs font-semibold text-[var(--ink)] shadow-md hover:bg-[var(--surface-hover)] active:scale-95 transition-transform backdrop-blur-md"
          aria-label="Transaction Ledger"
        >
          <IconShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
          <span>Ledger</span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/billing/new')}
          className="flex h-12 items-center gap-1.5 rounded-full bg-[#1E3A5F] text-white dark:bg-slate-100 dark:text-slate-900 px-4.5 text-xs font-bold shadow-lg shadow-black/25 active:scale-95 transition-all"
          aria-label="New Bill"
        >
          <IconPlus size={18} strokeWidth={2.5} />
          <span>New Bill</span>
        </button>
      </div>
    </div>
  )
}
