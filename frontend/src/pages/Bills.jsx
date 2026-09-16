import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../api'
import invoiceService from '../features/billing/api/invoiceService'
import settingsService from '../features/settings/api/settingsService'
import { Spinner, ConfirmDialog } from '../components/UI'
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
   ERP BILLING UI — CLEAN BUSINESS / POS STYLE
   - White / soft-gray surfaces
   - Indigo primary actions
   - Thin borders and restrained radius
   - Monospaced, tabular financial figures
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

function getPdfUrl(billId, printer = false) {
  const token = localStorage.getItem('access_token') || ''
  return `${API_BASE_URL}/invoices/${billId}/pdf/?token=${token}${printer ? '&printer=thermal' : ''}`
}

function openPdf(billId, printer = false) {
  const url = getPdfUrl(billId, printer)
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  if (isMobile) {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }
  const w = window.open('', '_blank')
  if (!w) { toast.error('Popup blocked. Please allow popups.'); return }
  w.location.href = url
}

async function fetchPdfBlob(billId) {
  const res = await fetch(getPdfUrl(billId))
  if (!res.ok) throw new Error('PDF fetch failed')
  return res.blob()
}

async function getShortPdfUrl(billId) {
  const link = await invoiceService.createShortLink(billId)
  if (!link?.url) throw new Error('Short-link response did not contain a URL')
  return link.url
}

function ShareMenu({ bill, shopName, onClose }) {
  const text = buildShareText(bill, shopName)
  const phone = bill.customer_phone || ''

  const shareTextWithLink = async () => {
    const pdfUrl = await getShortPdfUrl(bill.id)
    return { pdfUrl, text: `${text}\n\nDownload PDF: ${pdfUrl}` }
  }

  const actions = [
    {
      label: 'WhatsApp',
      icon: <MessageCircle size={16} className="text-green-600 dark:text-green-400" />,
      hover: 'hover:bg-green-50 dark:bg-green-950/60',
      action: async () => {
        const cleanPhone = phone.replace(/\D/g, '')
        // Reserve the popup while this click still has browser user activation.
        const popup = window.open('', '_blank')
        try {
          const { text: message } = await shareTextWithLink()
          const url = cleanPhone
            ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`
            : `https://wa.me/?text=${encodeURIComponent(message)}`
          if (popup) popup.location.href = url
          else window.location.href = url
        } catch {
          popup?.close()
          toast.error('Could not create a share link')
        }
      },
    },
    {
      label: 'SMS',
      icon: <Phone size={16} className="text-[#4338CA]" />,
      hover: 'hover:bg-indigo-50',
      action: async () => {
        if (!phone) {
          toast.error('No phone number for this customer')
          return
        }
        try {
          const { text: message } = await shareTextWithLink()
          window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`
        } catch {
          toast.error('Could not create a share link')
        }
      },
    },
    {
      label: 'Email',
      icon: <Mail size={16} className="text-purple-600" />,
      hover: 'hover:bg-purple-50',
      action: async () => {
        try {
          const { text: message } = await shareTextWithLink()
          const subject = encodeURIComponent(
            `Invoice ${bill.invoice_number} from ${shopName || 'Dreamwithtech'}`
          )
          window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(message)}`
        } catch {
          toast.error('Could not create a share link')
        }
      },
    },
    {
      label: 'Share PDF',
      icon: <FileText size={16} className="text-rose-600 dark:text-rose-400" />,
      hover: 'hover:bg-rose-50 dark:bg-rose-950/60',
      action: async () => {
        try {
          const [blob, shortUrl] = await Promise.all([
            fetchPdfBlob(bill.id),
            getShortPdfUrl(bill.id),
          ])
          const file = new File([blob], `invoice-${bill.invoice_number}.pdf`, { type: 'application/pdf' })
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: `Invoice ${bill.invoice_number}` })
          } else if (navigator.share) {
            await navigator.share({ title: `Invoice ${bill.invoice_number}`, text, url: shortUrl })
          } else {
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `invoice-${bill.invoice_number}.pdf`
            a.click()
            setTimeout(() => URL.revokeObjectURL(a.href), 1000)
            toast.success('PDF downloaded')
          }
        } catch (err) {
          if (err?.name !== 'AbortError') toast.error('Could not share PDF')
        }
      },
    },
    {
      label: 'Copy PDF link',
      icon: <Share2 size={16} className="text-[var(--muted)]" />,
      hover: 'hover:bg-[var(--surface-elevated)]',
      action: async () => {
        try {
          const pdfUrl = await getShortPdfUrl(bill.id)
          await navigator.clipboard.writeText(pdfUrl)
          toast.success('PDF link copied')
        } catch {
          toast.error('Could not create a share link')
        }
      },
    },
  ]

  return (
    <div
      className="absolute right-0 top-11 z-[70] w-52 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-lg"
      onClick={e => e.stopPropagation()}
    >
      <div className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-light)]">
        Share invoice
      </div>

      {actions.map(action => (
        <button
          key={action.label}
          onClick={() => {
            action.action()
            onClose()
          }}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-[var(--ink-secondary)] transition ${action.hover}`}
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
    blue:   { icon: 'bg-white border border-blue-100 text-[#4338CA]',    accent: 'text-[#4338CA]' },
    green:  { icon: 'bg-white border border-emerald-100 text-emerald-600', accent: 'text-emerald-600' },
    violet: { icon: 'bg-white border border-violet-100 text-violet-600', accent: 'text-violet-600' },
    amber:  { icon: 'bg-white border border-amber-100 text-amber-600',   accent: 'text-amber-600' },
    rose:   { icon: 'bg-white border border-rose-100 text-rose-600',     accent: 'text-rose-600' },
  }

  const style = tones[tone] || tones.blue

  return (
    <div className="group rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 shadow-none transition hover:shadow-md sm:p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-light)]">
            {label}
          </p>
          <p className="mt-1.5 truncate font-mono text-base font-semibold tabular-nums tracking-tight text-[var(--ink)] sm:text-xl">
            {value}
          </p>
          {helper && (
            <p className="mt-1 text-[11px] text-[var(--muted-light)]">
              {helper}
            </p>
          )}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md shadow-sm ${style.icon}`}>
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
      className: 'bg-emerald-500 text-white',
    },
    completed: {
      label: 'Paid',
      icon: CheckCircle2,
      className: 'bg-emerald-500 text-white',
    },
    partial: {
      label: 'Partial',
      icon: AlertCircle,
      className: 'bg-amber-400 text-white',
    },
    pending: {
      label: 'Pending',
      icon: Clock3,
      className: 'bg-orange-500 text-white',
    },
    cancelled: {
      label: 'Cancelled',
      icon: Ban,
      className: 'bg-red-500 text-white',
    },
    refunded: {
      label: 'Refunded',
      icon: RefundIcon,
      className: 'bg-slate-500 text-white',
    },
  }

  const item = config[status] || {
    label: status || 'Unknown',
    icon: AlertCircle,
    className: 'bg-gray-400 text-white',
  }

  const Icon = item.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-semibold ${item.className}`}
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
    cash:     'bg-emerald-500 text-white',
    upi:      'bg-blue-500 text-white',
    card:     'bg-violet-500 text-white',
    credit:   'bg-rose-500 text-white',
    bank:     'bg-cyan-600 text-white',
    razorpay: 'bg-indigo-500 text-white',
    online:   'bg-sky-500 text-white',
  }

  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-1 text-[11px] font-semibold ${
        styles[value] || 'bg-slate-400 text-white'
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
  const navigate = useNavigate()
  const [shareOpen, setShareOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
        onClick={() => navigate(`/invoice/${bill.id}`)}
        className="icon-btn"
        title="View invoice"
      >
        <Eye size={15} />
      </button>

      <button
        onClick={() => openPdf(bill.id, false)}
        className="icon-btn"
        title="Download PDF"
      >
        <Download size={15} />
      </button>

      <button
        onClick={() => openPdf(bill.id, true)}
        className="icon-btn"
        title="Thermal print"
      >
        <Printer size={15} />
      </button>

      <div className="relative">
        <button
          onClick={e => {
            e.stopPropagation()
            setShareOpen(v => !v)
            setMenuOpen(false)
          }}
          className="icon-btn"
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
            className="icon-btn"
            title="More actions"
          >
            <MoreHorizontal size={17} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setMenuOpen(false)
                  onRefresh('cancel', bill.id)
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-[var(--ink-secondary)] hover:bg-red-50 dark:hover:bg-red-950/60 hover:text-red-600 dark:hover:text-red-400"
              >
                <XCircle size={15} />
                Cancel invoice
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false)
                  onRefresh('refund', bill.id)
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-sm text-[var(--ink-secondary)] hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-700"
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-5"
      onClick={onClose}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-[var(--surface)] shadow-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="border-b border-[var(--line-subtle)] bg-[var(--surface)] px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[#4338CA]">
                <Receipt size={19} />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-light)]">
                  Invoice
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[var(--ink)]">
                    {selected.invoice_number}
                  </h2>

                  <StatusPill bill={selected} />
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="icon-btn"
            >
              <XCircle size={16} />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
            <button
              onClick={() => openPdf(selected.id, false)}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] px-3.5 py-2 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
            >
              <Download size={14} />
              Download PDF
            </button>

            <button
              onClick={() => openPdf(selected.id, true)}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] px-3.5 py-2 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
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
                className="inline-flex items-center gap-2 rounded-md border border-[var(--line)] px-3.5 py-2 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
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
        <div className="overflow-y-auto bg-[var(--surface-elevated)] p-3 sm:p-6">
          {/* Information cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3.5 sm:p-4">
              <div className="flex items-center gap-2 text-[var(--muted-light)]">
                <UserRound size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Customer
                </span>
              </div>

              <p className="mt-2 truncate font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">
                {selected.customer_name || 'Walk-in customer'}
              </p>

              {selected.customer_phone && (
                <p className="mt-1 text-xs text-[var(--muted-light)]">
                  {selected.customer_phone}
                </p>
              )}
            </div>

            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3.5 sm:p-4">
              <div className="flex items-center gap-2 text-[var(--muted-light)]">
                <CalendarDays size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Date
                </span>
              </div>

              <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">
                {formatDate(selected.created_at)}
              </p>

              <p className="mt-1 text-xs text-[var(--muted-light)]">
                {formatTime(selected.created_at)}
              </p>
            </div>

            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3.5 sm:p-4">
              <div className="flex items-center gap-2 text-[var(--muted-light)]">
                <CreditCard size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Payment
                </span>
              </div>

              <div className="mt-2">
                <PaymentBadge method={selected.payment_method} />
              </div>
            </div>

            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3.5 sm:p-4">
              <div className="flex items-center gap-2 text-[var(--muted-light)]">
                <CircleDollarSign size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Total
                </span>
              </div>

              <p className="mt-2 font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">
                {fmt(selected.grand_total)}
              </p>

              <p className="mt-1 text-xs text-[var(--muted-light)]">
                {selected.items?.length || 0} items
              </p>
            </div>
          </div>

          {/* Items */}
          <div className="mt-4 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--line-subtle)] px-4 py-3">
              <div>
                <h3 className="font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">
                  Invoice items
                </h3>
                <p className="mt-0.5 text-[11px] text-[var(--muted-light)]">
                  Products included in this invoice
                </p>
              </div>

              <span className="rounded-sm bg-[var(--surface-elevated)] border border-[var(--line)] px-2.5 py-1 text-[11px] font-semibold text-[var(--muted)]">
                {selected.items?.length || 0} items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-sm">
                <thead className="bg-[var(--surface-elevated)]">
                  <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-[var(--muted-light)]">
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

                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {selected.items?.map((item, i) => (
                    <tr key={i} className="hover:bg-[var(--surface-elevated)]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[var(--ink)]">
                          {item.product_name}
                        </p>

                        <p className="mt-0.5 text-[10px] text-[var(--muted-light)]">
                          GST {item.gst_percent || 0}%
                        </p>
                      </td>

                      <td className="px-3 py-3 text-center text-[var(--muted)]">
                        {item.quantity}
                      </td>

                      <td className="px-3 py-3 text-right text-[var(--muted)]">
                        {fmt(item.unit_price)}
                      </td>

                      <td className="px-3 py-3 text-right text-[var(--muted)]">
                        {item.discount_percent || 0}%
                      </td>

                      <td className="px-4 py-3 text-right font-bold text-[var(--ink)]">
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
            <div className="w-full max-w-md rounded-md border border-[var(--line)] bg-[var(--surface)] p-5">
              <h3 className="mb-4 font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">
                Payment summary
              </h3>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-[var(--muted)]">
                  <span>Subtotal</span>
                  <strong className="text-[var(--ink)]">
                    {fmt(selected.subtotal)}
                  </strong>
                </div>

                <div className="flex justify-between text-[var(--muted)]">
                  <span>Discount</span>
                  <strong className="text-red-500">
                    -{fmt(selected.discount_amount)}
                  </strong>
                </div>

                <div className="flex justify-between text-[var(--muted)]">
                  <span>GST</span>
                  <strong className="text-[var(--ink)]">
                    {fmt(selected.tax_amount)}
                  </strong>
                </div>

                <div className="my-3 border-t border-dashed border-[var(--line)]" />

                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--ink-secondary)]">
                    Grand total
                  </span>

                  <span className="font-mono text-xl font-semibold tabular-nums text-[#0F172A]">
                    {fmt(selected.grand_total)}
                  </span>
                </div>

                <div className="flex justify-between pt-1 text-[var(--muted)]">
                  <span>Paid</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {fmt(selected.paid_amount)}
                  </strong>
                </div>

                {Number(selected.balance_due || 0) > 0 && (
                  <div className="flex justify-between text-[var(--muted)]">
                    <span>Balance due</span>
                    <strong className="text-red-600 dark:text-red-400">
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
   MOBILE INVOICE CARD
========================================================= */

function MobileInvoiceCard({ bill, shopName, onView, onRefresh }) {
  const navigate = useNavigate()
  return (
    <article
      className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-none transition active:bg-[var(--surface-elevated)]"
      onClick={() => navigate(`/invoice/${bill.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            onClick={e => {
              e.stopPropagation()
              navigate(`/invoice/${bill.id}`)
            }}
            className="font-mono text-xs font-bold text-[#4338CA]"
          >
            {bill.invoice_number}
          </button>

          <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">
            {bill.customer_name || 'Walk-in customer'}
          </p>

          {bill.customer_phone && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--muted-light)]">
              <Phone size={10} />
              {bill.customer_phone}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="font-mono text-base font-semibold tabular-nums text-[#0F172A]">
            {fmt(bill.grand_total)}
          </p>
          <div className="mt-1 flex justify-end">
            <StatusPill bill={bill} />
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-[var(--surface-elevated)] p-2.5">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)]">
            Date
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[var(--ink-secondary)]">
            {formatDate(bill.created_at)}
          </p>
          <p className="text-[10px] text-[var(--muted-light)]">
            {formatTime(bill.created_at)}
          </p>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)]">
            Payment
          </p>
          <div className="mt-1">
            <PaymentBadge method={bill.payment_method} />
          </div>
        </div>

        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)]">
            Items
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[var(--ink-secondary)]">
            {bill.items?.length || 0} products
          </p>
        </div>

        <div className="text-right">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)]">
            Subtotal
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[var(--ink-secondary)]">
            {fmt(bill.subtotal)}
          </p>
        </div>
      </div>

      {Number(bill.discount_amount || 0) > 0 && (
        <p className="mt-2 text-right text-[10px] font-medium text-red-500">
          -{fmt(bill.discount_amount)} discount
        </p>
      )}

      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          navigate(`/invoice/${bill.id}`)
        }}
        className="btn-primary mt-3 w-full sm:hidden"
      >
        <Eye size={15} /> Open bill
      </button>

      <div
        className="mt-3 border-t border-[var(--line-subtle)] pt-2.5"
        onClick={e => e.stopPropagation()}
      >
        <InvoiceActions
          bill={bill}
          shopName={shopName}
          onView={onView}
          onRefresh={onRefresh}
        />
      </div>
    </article>
  )
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function Bills() {
  const navigate = useNavigate()
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
    settingsService
      .getAll()
      .then(settings => {
        if (settings?.shop_name) {
          setShopName(settings.shop_name)
        }
      })
      .catch(() => {})
  }, [])

  /* -------------------------------------------------------
     LOAD BILLS
  ------------------------------------------------------- */

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [dateFilter, statusFilter])

  const load = useCallback(
    (pg = 1, q = search) => {
      setLoading(true)

      const params = new URLSearchParams({ page: pg })

      if (dateFilter) params.set('date_filter', dateFilter)
      if (q.trim()) params.set('search', q.trim())

      invoiceService
        .getInvoices(params)
        .then(({ items, count: totalCount }) => {
          setBills(items)
          setCount(totalCount)
        })
        .catch(() => toast.error('Failed to load bills'))
        .finally(() => setLoading(false))
    },
    [dateFilter]
  )

  const searchDebounce = useRef(null)
  useEffect(() => {
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => load(page, search), search ? 400 : 0)
    return () => clearTimeout(searchDebounce.current)
  }, [search, page, load])

  /* -------------------------------------------------------
     FILTERED BILLS
  ------------------------------------------------------- */

  const visibleBills = useMemo(() => {
    if (!statusFilter) return bills
    // cancelled / refunded live on invoice.status; others are payment_status
    if (statusFilter === 'cancelled' || statusFilter === 'refunded') {
      return bills.filter(bill => bill.status === statusFilter)
    }
    return bills.filter(bill => bill.payment_status === statusFilter)
  }, [bills, statusFilter])

  /* -------------------------------------------------------
     CANCEL
  ------------------------------------------------------- */

  const cancel = async id => {
    try {
      await invoiceService.cancelInvoice(id)

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
      await invoiceService.refundInvoice(id)

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
    <div className="min-h-full">
      <div className="mx-auto max-w-[1600px] space-y-4 overflow-x-hidden">
        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-4 shadow-none sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold text-[var(--muted-light)]">
              <Receipt size={13} />
              <span>Sales</span>
              <span>/</span>
              <span className="text-[var(--muted)]">
                Invoices
              </span>
            </div>

            <h1 className="text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
              Billing & Invoices
            </h1>

            <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
              Manage sales, payments and customer invoices.
            </p>
          </div>

          <button
            onClick={() => navigate('/billing/new')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-[#4338CA] px-4 py-2.5 text-sm font-semibold text-white shadow-none transition hover:bg-[#3730A3] active:scale-[0.98] sm:w-auto"
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

        <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-none sm:p-3">
          {/* Date filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2" style={{ scrollbarWidth: 'none' }}>
            {DATE_FILTERS.map(f => (
              <button
                key={f.value}
                type="button"
                onClick={() => setDateFilter(f.value)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  dateFilter === f.value
                    ? 'bg-[#4338CA] border-blue-600 text-white'
                    : 'border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex w-full items-center gap-2">
            {/* Search */}
            <div className="relative min-w-0 flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted-light)]"
              />

              <input
                className="w-full rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] py-2.5 pl-10 pr-3 text-sm outline-none transition placeholder:text-[var(--muted-light)] focus:border-[#818CF8] focus:bg-[var(--surface)] focus:ring-4 focus:ring-indigo-50"
                placeholder="Search invoice, customer or phone..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>

            {/* Filter */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setFilterOpen(v => !v)
                }}
                className={`inline-flex h-[42px] items-center justify-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition ${
                  statusFilter
                    ? 'border-indigo-200 bg-indigo-50 text-[#3730A3]'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'
                }`}
                title="Filter invoices"
                aria-label="Filter invoices"
              >
                <SlidersHorizontal size={14} />
                <span className="hidden sm:inline">Filter</span>

                {statusFilter && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#4338CA] px-1 text-[9px] text-white">
                    1
                  </span>
                )}
              </button>

              {filterOpen && (
                <div
                  className="absolute right-0 top-11 z-50 w-48 max-w-[calc(100vw-1rem)] rounded-md border border-[var(--line)] bg-[var(--surface)] p-2 shadow-xl"
                  onClick={e => e.stopPropagation()}
                >
                  <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-light)]">
                    Payment status
                  </p>

                  {STATUS_FILTERS.map(filter => (
                    <button
                      type="button"
                      key={filter.value}
                      onClick={() => {
                        setStatusFilter(filter.value)
                        setFilterOpen(false)
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold ${
                        statusFilter === filter.value
                          ? 'bg-indigo-50 text-[#3730A3]'
                          : 'text-[var(--muted)] hover:bg-[var(--surface-elevated)]'
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
              type="button"
              onClick={() => load(page)}
              className="inline-flex h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
              title="Refresh invoices"
              aria-label="Refresh invoices"
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* =================================================
            INVOICE TABLE
        ================================================= */}

        <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-none">
          {/* Table header */}
          <div className="flex items-center justify-between border-b border-[var(--line-subtle)] px-3.5 py-3 sm:px-5">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">
                  Invoices
                </h2>

                <span className="rounded-sm bg-[var(--surface-elevated)] border border-[var(--line)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted)]">
                  {visibleBills.length}
                </span>
              </div>

              <p className="mt-0.5 text-[11px] text-[var(--muted-light)]">
                {count
                  ? `${count.toLocaleString(
                      'en-IN'
                    )} invoices found`
                  : 'Recent billing transactions'}
              </p>
            </div>

            <div className="hidden items-center gap-1.5 text-[11px] text-[var(--muted-light)] sm:flex">
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
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--muted-light)]">
                <FileText size={22} />
              </div>

              <h3 className="font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">
                No invoices found
              </h3>

              <p className="mt-1 max-w-sm text-center text-xs text-[var(--muted-light)]">
                Try changing your search, date or payment
                status filters.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-2.5 p-2.5 sm:hidden">
                {visibleBills.map(bill => (
                  <MobileInvoiceCard
                    key={bill.id}
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
                ))}
              </div>

              {/* Desktop/tablet table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[1050px]">
                <thead className="bg-[var(--surface-elevated)]/80">
                  <tr className="border-b border-[var(--line-subtle)] text-left text-[10px] font-bold uppercase tracking-wider text-[var(--muted-light)]">
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

                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {visibleBills.map(bill => (
                    <tr
                      key={bill.id}
                      className="group transition hover:bg-indigo-50"
                    >
                      {/* Invoice */}
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() =>
                            navigate(`/invoice/${bill.id}`)
                          }
                          className="font-mono text-xs font-bold text-[#4338CA] hover:text-[#312E81] hover:underline"
                        >
                          {bill.invoice_number}
                        </button>

                        <p className="mt-1 text-[10px] text-[var(--muted-light)]">
                          {fmt(bill.subtotal)} subtotal
                        </p>
                      </td>

                      {/* Customer */}
                      <td className="px-3 py-3.5">
                        <div className="max-w-[190px] truncate text-sm font-semibold text-[var(--ink)]">
                          {bill.customer_name ||
                            'Walk-in customer'}
                        </div>

                        {bill.customer_phone && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--muted-light)]">
                            <Phone size={10} />
                            {bill.customer_phone}
                          </div>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-3 py-3.5">
                        <div className="text-xs font-semibold text-[var(--ink-secondary)]">
                          {formatDate(
                            bill.created_at
                          )}
                        </div>

                        <div className="mt-1 text-[10px] text-[var(--muted-light)]">
                          {formatTime(
                            bill.created_at
                          )}
                        </div>
                      </td>

                      {/* Items */}
                      <td className="px-3 py-3.5 text-center">
                        <span className="inline-flex items-center gap-1 rounded-sm bg-[var(--surface-elevated)] border border-[var(--line)] px-2 py-1 text-[10px] font-bold text-[var(--muted)]">
                          <ShoppingBag size={11} />
                          {bill.items?.length || 0}
                        </span>
                      </td>

                      {/* Total */}
                      <td className="px-3 py-3.5 text-right">
                        <div className="font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">
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
            </>
          )}

          {/* =================================================
              PAGINATION
          ================================================= */}

          {count > 50 && (
            <div className="flex items-center justify-between border-t border-[var(--line-subtle)] px-3 py-3 sm:px-5">
              <p className="text-[11px] text-[var(--muted-light)]">
                Page {page} · {visibleBills.length}{' '}
                shown
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={page === 1}
                  onClick={() =>
                    setPage(p => p - 1)
                  }
                  className="rounded-sm border border-[var(--line)] p-2 text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={15} />
                </button>

                <span className="flex h-8 min-w-8 items-center justify-center rounded-sm bg-[var(--primary)] px-2 text-xs font-semibold text-white">
                  {page}
                </span>

                <button
                  disabled={bills.length < 50}
                  onClick={() =>
                    setPage(p => p + 1)
                  }
                  className="rounded-sm border border-[var(--line)] p-2 text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-40"
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

        <div className="flex flex-col items-start gap-1 px-1 pb-2 text-[10px] text-[var(--muted-light)] sm:flex-row sm:items-center sm:justify-between">
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
