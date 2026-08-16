import { useState, useEffect, useCallback, useMemo } from 'react'
import api, { API_BASE_URL } from '../api'
import { Badge, Spinner, EmptyState, ConfirmDialog } from '../components/UI'
import toast from 'react-hot-toast'

import {
  Eye,
  Printer,
  Download,
  XCircle,
  RotateCcw,
  Search,
  MessageCircle,
  Mail,
  Share2,
  Phone,
  Plus,
  Receipt,
  IndianRupee,
  ShoppingBag,
  CreditCard,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  RefreshCw,
  Clock3,
  UserRound,
  CircleDollarSign,
  CheckCircle2,
  AlertCircle,
  Ban,
  RotateCcw as RefundIcon,
  SlidersHorizontal,
  FileText,
} from 'lucide-react'

/* =========================================================
   HELPERS
========================================================= */

const fmt = v =>
  `₹${Number(v || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const DATE_FILTERS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This week', value: 'this_week' },
  { label: 'This month', value: 'this_month' },
  { label: 'All time', value: '' },
]

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Paid', value: 'paid' },
  { label: 'Partial', value: 'partial' },
  { label: 'Pending', value: 'pending' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Refunded', value: 'refunded' },
]

function buildShareText(bill, shopName) {
  return `*${shopName || 'Dreamwithtech'} — Invoice ${
    bill.invoice_number
  }*\nCustomer: ${
    bill.customer_name || 'Walk-in customer'
  }\nDate: ${new Date(bill.created_at).toLocaleDateString(
    'en-IN'
  )}\nTotal: ${fmt(
    bill.grand_total
  )}\nPayment: ${bill.payment_method?.toUpperCase() || '—'} — ${
    bill.payment_status?.toUpperCase() || bill.status?.toUpperCase() || '—'
  }\n\nThank you for shopping with us!`
}

function paymentLabel(method) {
  if (!method) return '—'
  return method.charAt(0).toUpperCase() + method.slice(1)
}

function getStatus(bill) {
  return bill.status === 'completed'
    ? bill.payment_status || 'paid'
    : bill.status
}

function formatDate(date) {
  if (!date) return '—'

  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(date) {
  if (!date) return ''

  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* =========================================================
   SHARE MENU
========================================================= */

function ShareMenu({ bill, shopName, onClose }) {
  const text = buildShareText(bill, shopName)
  const encoded = encodeURIComponent(text)
  const phone = bill.customer_phone || ''

  const actions = [
    {
      label: 'WhatsApp',
      icon: <MessageCircle size={16} className="text-green-600" />,
      hover: 'hover:bg-green-50',
      action: () => {
        const cleanPhone = phone.replace(/\D/g, '')

        const url = cleanPhone
          ? `https://wa.me/91${cleanPhone}?text=${encoded}`
          : `https://wa.me/?text=${encoded}`

        window.open(url, '_blank')
      },
    },
    {
      label: 'SMS',
      icon: <Phone size={16} className="text-blue-600" />,
      hover: 'hover:bg-blue-50',
      action: () => {
        if (!phone) {
          toast.error('No phone number for this customer')
          return
        }

        window.open(`sms:${phone}?body=${encoded}`)
      },
    },
    {
      label: 'Email',
      icon: <Mail size={16} className="text-purple-600" />,
      hover: 'hover:bg-purple-50',
      action: () => {
        const subject = encodeURIComponent(
          `Invoice ${bill.invoice_number} from ${
            shopName || 'Dreamwithtech'
          }`
        )

        window.open(`mailto:?subject=${subject}&body=${encoded}`)
      },
    },
    {
      label: 'Copy details',
      icon: <Share2 size={16} className="text-gray-600" />,
      hover: 'hover:bg-gray-50',
      action: async () => {
        try {
          await navigator.clipboard.writeText(text)
          toast.success('Invoice details copied')
        } catch {
          toast.error('Unable to copy invoice details')
        }
      },
    },
  ]

  return (
    <div
      className="absolute right-0 top-11 z-[70] w-52 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-gray-200/60"
      onClick={e => e.stopPropagation()}
    >
      <div className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
        Share invoice
      </div>

      {actions.map(action => (
        <button
          key={action.label}
          onClick={() => {
            action.action()
            onClose()
          }}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-700 transition ${action.hover}`}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  )
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = 'blue',
}) {
  const tones = {
    blue: {
      icon: 'bg-blue-50 text-blue-600',
      value: 'text-gray-950',
    },
    green: {
      icon: 'bg-emerald-50 text-emerald-600',
      value: 'text-gray-950',
    },
    violet: {
      icon: 'bg-violet-50 text-violet-600',
      value: 'text-gray-950',
    },
    amber: {
      icon: 'bg-amber-50 text-amber-600',
      value: 'text-gray-950',
    },
  }

  const style = tones[tone] || tones.blue

  return (
    <div className="group rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {label}
          </p>

          <p
            className={`mt-1.5 truncate text-xl font-bold tracking-tight ${style.value}`}
          >
            {value}
          </p>

          {helper && (
            <p className="mt-1 text-[11px] text-gray-400">
              {helper}
            </p>
          )}
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.icon}`}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   STATUS
========================================================= */

function StatusPill({ bill }) {
  const status = getStatus(bill)

  const config = {
    paid: {
      label: 'Paid',
      icon: CheckCircle2,
      className:
        'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100',
    },

    completed: {
      label: 'Paid',
      icon: CheckCircle2,
      className:
        'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100',
    },

    partial: {
      label: 'Partial',
      icon: AlertCircle,
      className:
        'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100',
    },

    pending: {
      label: 'Pending',
      icon: Clock3,
      className:
        'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-100',
    },

    cancelled: {
      label: 'Cancelled',
      icon: Ban,
      className:
        'bg-red-50 text-red-700 ring-1 ring-inset ring-red-100',
    },

    refunded: {
      label: 'Refunded',
      icon: RefundIcon,
      className:
        'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100',
    },
  }

  const item = config[status] || {
    label: status || 'Unknown',
    icon: AlertCircle,
    className:
      'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200',
  }

  const Icon = item.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.className}`}
    >
      <Icon size={12} />
      {item.label}
    </span>
  )
}

/* =========================================================
   PAYMENT BADGE
========================================================= */

function PaymentBadge({ method }) {
  const value = method?.toLowerCase()

  const styles = {
    cash: 'bg-slate-50 text-slate-700 border-slate-200',
    upi: 'bg-blue-50 text-blue-700 border-blue-100',
    card: 'bg-violet-50 text-violet-700 border-violet-100',
    credit: 'bg-amber-50 text-amber-700 border-amber-100',
    bank: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  }

  return (
    <span
      className={`inline-flex items-center rounded-lg border px-2 py-1 text-[11px] font-semibold ${
        styles[value] || 'border-gray-200 bg-gray-50 text-gray-600'
      }`}
    >
      {paymentLabel(method)}
    </span>
  )
}

/* =========================================================
   INVOICE ACTIONS
========================================================= */

function InvoiceActions({
  bill,
  shopName,
  onView,
  onRefresh,
}) {
  const [shareOpen, setShareOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const openPdf = printer => {
    const w = window.open('', '_blank')

    if (!w) {
      toast.error('Popup blocked. Please allow popups.')
      return
    }

    w.location.href =
      `${API_BASE_URL}/invoices/${bill.id}/pdf/?token=${localStorage.getItem(
        'access_token'
      )}${printer ? '&printer=thermal' : ''}`
  }

  useEffect(() => {
    if (!shareOpen && !menuOpen) return

    const handler = () => {
      setShareOpen(false)
      setMenuOpen(false)
    }

    document.addEventListener('click', handler)

    return () =>
      document.removeEventListener('click', handler)
  }, [shareOpen, menuOpen])

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        onClick={() => onView(bill)}
        className="rounded-lg p-2 text-gray-400 transition hover:bg-blue-50 hover:text-blue-600"
        title="View invoice"
      >
        <Eye size={16} />
      </button>

      <button
        onClick={() => openPdf(false)}
        className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-800"
        title="Download PDF"
      >
        <Download size={16} />
      </button>

      <button
        onClick={() => openPdf(true)}
        className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-800"
        title="Thermal print"
      >
        <Printer size={16} />
      </button>

      <div className="relative">
        <button
          onClick={e => {
            e.stopPropagation()
            setShareOpen(v => !v)
            setMenuOpen(false)
          }}
          className="rounded-lg p-2 text-gray-400 transition hover:bg-emerald-50 hover:text-emerald-600"
          title="Share invoice"
        >
          <Share2 size={16} />
        </button>

        {shareOpen && (
          <ShareMenu
            bill={bill}
            shopName={shopName}
            onClose={() => setShareOpen(false)}
          />
        )}
      </div>

      {(bill.status === 'completed' ||
        bill.status === 'paid') && (
        <div className="relative">
          <button
            onClick={e => {
              e.stopPropagation()
              setMenuOpen(v => !v)
              setShareOpen(false)
            }}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-800"
            title="More actions"
          >
            <MoreHorizontal size={17} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onRefresh('cancel', bill.id)
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600"
              >
                <XCircle size={15} />
                Cancel invoice
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false)
                  onRefresh('refund', bill.id)
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-600"
              >
                <RotateCcw size={15} />
                Refund invoice
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* =========================================================
   INVOICE MODAL
========================================================= */

function InvoiceModal({
  selected,
  shopName,
  onClose,
}) {
  const [shareOpen, setShareOpen] = useState(false)

  if (!selected) return null

  const openPdf = printer => {
    const w = window.open('', '_blank')

    if (!w) {
      toast.error('Popup blocked. Please allow popups.')
      return
    }

    w.location.href =
      `${API_BASE_URL}/invoices/${selected.id}/pdf/?token=${localStorage.getItem(
        'access_token'
      )}${printer ? '&printer=thermal' : ''}`
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="border-b border-gray-100 bg-white px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Receipt size={19} />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Invoice
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-950">
                    {selected.invoice_number}
                  </h2>

                  <StatusPill bill={selected} />
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <XCircle size={21} />
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => openPdf(false)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <Download size={14} />
              Download PDF
            </button>

            <button
              onClick={() => openPdf(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <Printer size={14} />
              Thermal
            </button>

            <div className="relative">
              <button
                onClick={e => {
                  e.stopPropagation()
                  setShareOpen(v => !v)
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                <Share2 size={14} />
                Share
              </button>

              {shareOpen && (
                <ShareMenu
                  bill={selected}
                  shopName={shopName}
                  onClose={() => setShareOpen(false)}
                />
              )}
            </div>
          </div>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto bg-[#f8fafc] p-4 sm:p-6">
          {/* Information cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-gray-400">
                <UserRound size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Customer
                </span>
              </div>

              <p className="mt-2 truncate text-sm font-bold text-gray-900">
                {selected.customer_name || 'Walk-in customer'}
              </p>

              {selected.customer_phone && (
                <p className="mt-1 text-xs text-gray-400">
                  {selected.customer_phone}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-gray-400">
                <CalendarDays size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Date
                </span>
              </div>

              <p className="mt-2 text-sm font-bold text-gray-900">
                {formatDate(selected.created_at)}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                {formatTime(selected.created_at)}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-gray-400">
                <CreditCard size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Payment
                </span>
              </div>

              <div className="mt-2">
                <PaymentBadge method={selected.payment_method} />
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-gray-400">
                <CircleDollarSign size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Total
                </span>
              </div>

              <p className="mt-2 text-sm font-bold text-gray-900">
                {fmt(selected.grand_total)}
              </p>

              <p className="mt-1 text-xs text-gray-400">
                {selected.items?.length || 0} items
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Invoice items
                </h3>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  Products included in this invoice
                </p>
              </div>

              <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                {selected.items?.length || 0} items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-3 py-3 text-center">
                      Qty
                    </th>
                    <th className="px-3 py-3 text-right">
                      Rate
                    </th>
                    <th className="px-3 py-3 text-right">
                      Discount
                    </th>
                    <th className="px-4 py-3 text-right">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {selected.items?.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800">
                          {item.product_name}
                        </p>

                        <p className="mt-0.5 text-[10px] text-gray-400">
                          GST {item.gst_percent || 0}%
                        </p>
                      </td>

                      <td className="px-3 py-3 text-center text-gray-600">
                        {item.quantity}
                      </td>

                      <td className="px-3 py-3 text-right text-gray-600">
                        {fmt(item.unit_price)}
                      </td>

                      <td className="px-3 py-3 text-right text-gray-500">
                        {item.discount_percent || 0}%
                      </td>

                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {fmt(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-bold text-gray-900">
                Payment summary
              </h3>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <strong className="text-gray-800">
                    {fmt(selected.subtotal)}
                  </strong>
                </div>

                <div className="flex justify-between text-gray-500">
                  <span>Discount</span>
                  <strong className="text-red-500">
                    -{fmt(selected.discount_amount)}
                  </strong>
                </div>

                <div className="flex justify-between text-gray-500">
                  <span>GST</span>
                  <strong className="text-gray-800">
                    {fmt(selected.tax_amount)}
                  </strong>
                </div>

                <div className="my-3 border-t border-dashed border-gray-200" />

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">
                    Grand total
                  </span>

                  <span className="text-xl font-bold text-gray-950">
                    {fmt(selected.grand_total)}
                  </span>
                </div>

                <div className="flex justify-between pt-1 text-gray-500">
                  <span>Paid</span>
                  <strong className="text-emerald-600">
                    {fmt(selected.paid_amount)}
                  </strong>
                </div>

                {Number(selected.balance_due || 0) > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Balance due</span>
                    <strong className="text-red-600">
                      {fmt(selected.balance_due)}
                    </strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function Bills() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  const [dateFilter, setDateFilter] = useState('today')
  const [statusFilter, setStatusFilter] = useState('')

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)

  const [shopName, setShopName] =
    useState('Dreamwithtech')

  const [filterOpen, setFilterOpen] = useState(false)

  /* -------------------------------------------------------
     SHOP SETTINGS
  ------------------------------------------------------- */

  useEffect(() => {
    api
      .get('/settings/all/')
      .then(r => {
        if (r.data?.shop_name) {
          setShopName(r.data.shop_name)
        }
      })
      .catch(() => {})
  }, [])

  /* -------------------------------------------------------
     LOAD BILLS
  ------------------------------------------------------- */

  const load = useCallback(
    (pg = 1) => {
      setLoading(true)

      const params = new URLSearchParams({
        page: pg,
      })

      if (dateFilter) {
        params.set('date_filter', dateFilter)
      }

      if (search.trim()) {
        params.set('search', search.trim())
      }

      api
        .get(`/invoices/?${params}`)
        .then(r => {
          setBills(r.data.results || r.data)
          setCount(r.data.count || 0)
        })
        .catch(() => {
          toast.error('Failed to load bills')
        })
        .finally(() => {
          setLoading(false)
        })
    },
    [dateFilter, search]
  )

  useEffect(() => {
    load(page)
  }, [load, page])

  /* -------------------------------------------------------
     FILTERED BILLS
  ------------------------------------------------------- */

  const visibleBills = useMemo(() => {
    if (!statusFilter) return bills

    return bills.filter(
      bill => getStatus(bill) === statusFilter
    )
  }, [bills, statusFilter])

  /* -------------------------------------------------------
     CANCEL
  ------------------------------------------------------- */

  const cancel = async id => {
    try {
      await api.post(`/invoices/${id}/cancel/`)

      toast.success('Invoice cancelled')
      setConfirm(null)

      load(page)
    } catch (e) {
      toast.error(
        e.response?.data?.error ||
          'Failed to cancel invoice'
      )
    }
  }

  /* -------------------------------------------------------
     REFUND
  ------------------------------------------------------- */

  const refund = async id => {
    try {
      await api.post(`/invoices/${id}/refund/`)

      toast.success('Invoice refunded')
      setConfirm(null)

      load(page)
    } catch (e) {
      toast.error(
        e.response?.data?.error ||
          'Failed to refund invoice'
      )
    }
  }

  /* -------------------------------------------------------
     TOTALS
  ------------------------------------------------------- */

  const totals = useMemo(() => {
    const revenue = visibleBills.reduce(
      (sum, bill) =>
        sum + Number(bill.grand_total || 0),
      0
    )

    const paid = visibleBills.reduce(
      (sum, bill) =>
        sum + Number(bill.paid_amount || 0),
      0
    )

    const tax = visibleBills.reduce(
      (sum, bill) =>
        sum + Number(bill.tax_amount || 0),
      0
    )

    const completed = visibleBills.filter(
      bill => bill.status === 'completed'
    ).length

    return {
      revenue,
      paid,
      tax,
      completed,
      average: completed
        ? revenue / completed
        : 0,
    }
  }, [visibleBills])

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-full bg-[#f7f8fb] px-3 py-4 sm:px-5 lg:px-7">
      <div className="mx-auto max-w-[1600px] space-y-4">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200/80 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold text-gray-400">
              <Receipt size={13} />
              <span>Sales</span>
              <span>/</span>
              <span className="text-gray-600">
                Invoices
              </span>
            </div>

            <h1 className="text-xl font-bold tracking-tight text-gray-950 sm:text-2xl">
              Billing & Invoices
            </h1>

            <p className="mt-1 text-xs text-gray-500 sm:text-sm">
              Manage sales, payments and customer invoices.
            </p>
          </div>

          <button
            onClick={() =>
              (window.location.href = '/new-bill')
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-200 transition hover:bg-blue-700 active:scale-[0.98]"
          >
            <Plus size={17} />
            New Bill
          </button>
        </div>

        {/* =================================================
            KPI CARDS
        ================================================= */}

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            icon={IndianRupee}
            label="Total sales"
            value={fmt(totals.revenue)}
            helper={`${totals.completed} completed invoices`}
            tone="blue"
          />

          <StatCard
            icon={CreditCard}
            label="Collected"
            value={fmt(totals.paid)}
            helper="Based on loaded invoices"
            tone="green"
          />

          <StatCard
            icon={Receipt}
            label="GST collected"
            value={fmt(totals.tax)}
            helper="Tax across loaded invoices"
            tone="violet"
          />

          <StatCard
            icon={ShoppingBag}
            label="Average bill"
            value={fmt(totals.average)}
            helper="Completed invoices"
            tone="amber"
          />
        </div>

        {/* =================================================
            FILTER BAR
        ================================================= */}

        <div className="rounded-2xl border border-gray-200/80 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            {/* Date filters */}
            <div className="flex overflow-x-auto rounded-xl bg-gray-50 p-1">
              {DATE_FILTERS.map(filter => (
                <button
                  key={filter.value}
                  onClick={() => {
                    setDateFilter(filter.value)
                    setPage(1)
                  }}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                    dateFilter === filter.value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                placeholder="Search invoice, customer or phone..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>

            {/* Filter button */}
            <div className="relative">
              <button
                onClick={e => {
                  e.stopPropagation()
                  setFilterOpen(v => !v)
                }}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition xl:w-auto ${
                  statusFilter
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <SlidersHorizontal size={14} />
                Filters
                {statusFilter && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] text-white">
                    1
                  </span>
                )}
              </button>

              {filterOpen && (
                <div
                  className="absolute right-0 top-12 z-50 w-48 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl"
                  onClick={e => e.stopPropagation()}
                >
                  <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Payment status
                  </p>

                  {STATUS_FILTERS.map(filter => (
                    <button
                      key={filter.value}
                      onClick={() => {
                        setStatusFilter(filter.value)
                        setFilterOpen(false)
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold ${
                        statusFilter === filter.value
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {filter.label}

                      {statusFilter === filter.value && (
                        <CheckCircle2 size={14} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Refresh */}
            <button
              onClick={() => load(page)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
              title="Refresh invoices"
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline">
                Refresh
              </span>
            </button>
          </div>
        </div>

        {/* =================================================
            INVOICE TABLE
        ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
          {/* Table header */}
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3.5 sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-gray-900">
                  Invoices
                </h2>

                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                  {visibleBills.length}
                </span>
              </div>

              <p className="mt-0.5 text-[11px] text-gray-400">
                {count
                  ? `${count.toLocaleString(
                      'en-IN'
                    )} invoices found`
                  : 'Recent billing transactions'}
              </p>
            </div>

            <div className="hidden items-center gap-1.5 text-[11px] text-gray-400 sm:flex">
              <Clock3 size={12} />
              Updated just now
            </div>
          </div>

          {/* Loading */}
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <Spinner />
            </div>
          ) : visibleBills.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center px-5">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
                <FileText size={22} />
              </div>

              <h3 className="text-sm font-bold text-gray-800">
                No invoices found
              </h3>

              <p className="mt-1 max-w-sm text-center text-xs text-gray-400">
                Try changing your search, date or payment
                status filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead className="bg-gray-50/80">
                  <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="px-5 py-3.5">
                      Invoice
                    </th>

                    <th className="px-3 py-3.5">
                      Customer
                    </th>

                    <th className="px-3 py-3.5">
                      Date
                    </th>

                    <th className="px-3 py-3.5 text-center">
                      Items
                    </th>

                    <th className="px-3 py-3.5 text-right">
                      Total
                    </th>

                    <th className="px-3 py-3.5">
                      Payment
                    </th>

                    <th className="px-3 py-3.5">
                      Status
                    </th>

                    <th className="px-5 py-3.5 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {visibleBills.map(bill => (
                    <tr
                      key={bill.id}
                      className="group transition hover:bg-blue-50/30"
                    >
                      {/* Invoice */}
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() =>
                            setSelected(bill)
                          }
                          className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {bill.invoice_number}
                        </button>

                        <p className="mt-1 text-[10px] text-gray-400">
                          {fmt(bill.subtotal)} subtotal
                        </p>
                      </td>

                      {/* Customer */}
                      <td className="px-3 py-3.5">
                        <div className="max-w-[190px] truncate text-sm font-semibold text-gray-800">
                          {bill.customer_name ||
                            'Walk-in customer'}
                        </div>

                        {bill.customer_phone && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-gray-400">
                            <Phone size={10} />
                            {bill.customer_phone}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-3 py-3.5">
                        <div className="text-xs font-semibold text-gray-700">
                          {formatDate(
                            bill.created_at
                          )}
                        </div>

                        <div className="mt-1 text-[10px] text-gray-400">
                          {formatTime(
                            bill.created_at
                          )}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="px-3 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600">
                          <ShoppingBag size={11} />
                          {bill.items?.length || 0}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-3 py-3.5 text-right">
                        <div className="text-sm font-bold text-gray-900">
                          {fmt(bill.grand_total)}
                        </div>

                        {Number(
                          bill.discount_amount || 0
                        ) > 0 && (
                          <div className="mt-1 text-[10px] font-medium text-red-500">
                            -
                            {fmt(
                              bill.discount_amount
                            )}{' '}
                            discount
                          </div>
                        )}
                      </td>

                      {/* Payment */}
                      <td className="px-3 py-3.5">
                        <PaymentBadge
                          method={
                            bill.payment_method
                          }
                        />
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5">
                        <StatusPill bill={bill} />
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <InvoiceActions
                          bill={bill}
                          shopName={shopName}
                          onView={setSelected}
                          onRefresh={(type, id) =>
                            setConfirm({
                              type,
                              id,
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* =================================================
              PAGINATION
          ================================================= */}

          {count > 50 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 sm:px-5">
              <p className="text-[11px] text-gray-400">
                Page {page} · {visibleBills.length}{' '}
                shown
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() =>
                    setPage(p => p - 1)
                  }
                  className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                </button>

                <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-gray-900 px-2 text-xs font-semibold text-white">
                  {page}
                </span>

                <button
                  disabled={bills.length < 50}
                  onClick={() =>
                    setPage(p => p + 1)
                  }
                  className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="flex items-center justify-between px-1 pb-2 text-[10px] text-gray-400">
          <span>{shopName}</span>

          <span className="flex items-center gap-1">
            <CalendarDays size={11} />
            Billing workspace
          </span>
        </div>
      </div>

      {/* ===================================================
          INVOICE PREVIEW
      =================================================== */}

      <InvoiceModal
        selected={selected}
        shopName={shopName}
        onClose={() => setSelected(null)}
      />

      {/* ===================================================
          CONFIRM DIALOG
      =================================================== */}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          confirm?.type === 'cancel'
            ? cancel(confirm.id)
            : refund(confirm.id)
        }
        title={
          confirm?.type === 'cancel'
            ? 'Cancel Invoice'
            : 'Refund Invoice'
        }
        message="Are you sure? Stock will be restored."
        danger
      />
    </div>
  )
}