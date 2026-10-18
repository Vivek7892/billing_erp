import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getAccessToken } from '../services/tokenStorage'
import { API_BASE_URL } from '../api'
import invoiceService from '../features/billing/api/invoiceService'
import settingsService from '../features/settings/api/settingsService'
import { Spinner, TableSkeleton, ConfirmDialog, EmptyState, useModalA11y } from '../components/UI'
import { INVOICE_STATUS, PAYMENT_STATUS, PAYMENT_METHODS } from '../constants'
import toast from 'react-hot-toast'
import InvoiceDocument from '../components/InvoiceDocument'
import CommunicationHistory from '../components/CommunicationHistory'

import { QRCodeSVG } from 'qrcode.react'
import {
  Eye,
  Printer,
  Download,
  XCircle,
  RotateCcw,
  Search,
  X,
  MessageCircle,
  Mail,
  Share2,
  Phone,
  Plus,
  Receipt,
  IndianRupee,
  ShoppingBag,
  ShoppingCart,
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
  ExternalLink,
  Copy,
  QrCode,
  Check,
} from 'lucide-react'

/* =========================================================
   ERP BILLING UI — CLEAN BUSINESS / POS STYLE
   - White / soft-gray surfaces
   - Dark navy primary actions
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
  { label: 'Custom', value: 'custom' },
  { label: 'All time', value: '' },
]

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Paid', value: 'paid' },
  { label: 'Partial', value: 'partial' },
  { label: 'Credit', value: 'credit' },
  { label: 'Pending', value: 'pending' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Refunded', value: 'refunded' },
]

function buildShareText(bill, shopName) {
  const date = bill.created_at
    ? new Date(bill.created_at).toLocaleDateString('en-IN')
    : '—'
  return [
    `${shopName || 'Dreamwithtech'} — Invoice ${bill.invoice_number}`,
    `Customer: ${bill.customer_name || 'Walk-in customer'}`,
    `Date: ${date}`,
    `Total: ${fmt(bill.grand_total)}`,
    `Payment: ${bill.payment_method?.toUpperCase() || '—'} — ${
      bill.payment_status?.toUpperCase() || bill.status?.toUpperCase() || '—'
    }`,
  ].join('\n')
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

function getPdfUrl(billId, printer = false, template = null) {
  const token = getAccessToken() || ''
  let printerParam = ''
  if (printer === 'thermal_58' || printer === '58mm') printerParam = '&printer=thermal_58'
  else if (printer === true || printer === 'thermal' || printer === 'thermal_80') printerParam = '&printer=thermal'
  else if (printer === 'half_a4' || printer === 'a5') printerParam = '&printer=half_a4'
  else if (printer === 'a4') printerParam = '&printer=a4'
  const tplParam = template ? `&template=${template}` : ''
  return `${API_BASE_URL}/invoices/${billId}/pdf/?token=${token}${printerParam}${tplParam}`
}

function openPdf(billId, printer = false, template = null) {
  const url = getPdfUrl(billId, printer, template)
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

async function getShortUrl(billId) {
  const link = await invoiceService.createShortLink(billId)
  if (!link?.short_url) throw new Error('Short-link response did not contain a URL')
  return link.short_url
}

function ShareMenu({ bill, shopName, onClose }) {
  const text = buildShareText(bill, shopName)
  const phone = bill.customer_phone || ''

  const shareTextWithLink = async () => {
    const shortUrl = bill.short_url || await getShortUrl(bill.id)
    return {
      shortUrl,
      text: `${text}\n\nView your bill:\n${shortUrl}\n\nThank you for shopping with us.`,
    }
  }

  const actions = [
    {
      label: 'WhatsApp',
      icon: <MessageCircle size={16} className="text-[#25D366]" />,
      hover: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
      action: async () => {
        const cleanPhone = phone.replace(/\D/g, '')
        const popup = window.open('', '_blank')
        try {
          const res = await invoiceService.sendWhatsApp(bill.id, cleanPhone)
          if (res?.whatsapp_url) {
            if (popup) popup.location.href = res.whatsapp_url
            else window.location.href = res.whatsapp_url
            toast.success('WhatsApp opened & logged!')
            return
          }
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
      icon: <Phone size={16} className="text-[#1E3A5F]" />,
      hover: 'hover:bg-[var(--surface-hover)]',
      action: async () => {
        if (!phone) {
          toast.error('No phone number for this customer')
          return
        }
        try {
          const { text: message } = await shareTextWithLink()
          const smsPhone = phone.replace(/\D/g, '')
          window.location.href = `sms:${smsPhone}?body=${encodeURIComponent(message)}`
        } catch {
          toast.error('Could not create a share link')
        }
      },
    },
    {
      label: 'Email',
      icon: <Mail size={16} className="text-[#475569]" />,
      hover: 'hover:bg-[var(--surface-hover)]',
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
      label: 'Share Bill',
      icon: <FileText size={16} className="text-rose-600 dark:text-rose-400" />,
      hover: 'hover:bg-rose-50 dark:bg-rose-950/60',
      icon: <FileText size={16} className="text-rose-400" />,
      hover: 'hover:bg-rose-950/40',
      action: async () => {
        try {
          const [blob, shortUrl] = await Promise.all([
            fetchPdfBlob(bill.id),
            getShortUrl(bill.id),
          ])
          const file = new File([blob], `invoice-${bill.invoice_number}.pdf`, { type: 'application/pdf' })
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: `Invoice ${bill.invoice_number}` })
          } else if (navigator.share) {
            const message = `${text}\n\nView your bill:\n${shortUrl}`
            await navigator.share({ title: `Invoice ${bill.invoice_number}`, text: message })
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
      label: 'Copy Bill Link',
      icon: <Share2 size={16} className="text-[var(--muted)]" />,
      hover: 'hover:bg-[var(--surface-elevated)]',
      action: async () => {
        try {
          const shortUrl = bill.short_url || await getShortUrl(bill.id)
          await navigator.clipboard.writeText(shortUrl)
          toast.success('Bill link copied')
        } catch {
          toast.error('Could not create a share link')
        }
      },
    },
  ]

  return (
    <div
      className=" absolute right-0 top-10 z-50 w-44 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="border-b border-[var(--line)] px-3 py-2.5 text-sm font-semibold text-[var(--ink-secondary)]">
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
    blue:   { icon: 'bg-[var(--surface-elevated)] border border-[var(--line)] text-[#1E3A5F] dark:text-slate-200', accent: 'text-[#1E3A5F] dark:text-slate-200' },
    green:  { icon: 'bg-[var(--surface-elevated)] border border-[var(--line)] text-teal-700 dark:text-teal-400',     accent: 'text-teal-700 dark:text-teal-400' },
    violet: { icon: 'bg-[var(--surface-elevated)] border border-[var(--line)] text-[#475569] dark:text-slate-300', accent: 'text-[#475569] dark:text-slate-300' },
    amber:  { icon: 'bg-[var(--surface-elevated)] border border-[var(--line)] text-amber-700 dark:text-amber-400',   accent: 'text-amber-700 dark:text-amber-400' },
    rose:   { icon: 'bg-[var(--surface-elevated)] border border-[var(--line)] text-red-600 dark:text-red-400',     accent: 'text-red-600 dark:text-red-400' },
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
      className: 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm dark:bg-emerald-900/70 dark:text-emerald-200 dark:border-emerald-600',
    },
    completed: {
      label: 'Paid',
      icon: CheckCircle2,
      className: 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm dark:bg-emerald-900/70 dark:text-emerald-200 dark:border-emerald-600',
    },
    credit: {
      label: 'Credit',
      icon: AlertCircle,
      className: 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700',
    },
    partial: {
      label: 'Partial',
      icon: AlertCircle,
      className: 'bg-amber-50 text-[#B45309] border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
    },
    pending: {
      label: 'Pending',
      icon: Clock3,
      className: 'bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40',
    },
    cancelled: {
      label: 'Cancelled',
      icon: Ban,
      className: 'bg-rose-100 text-rose-800 border border-rose-300 shadow-sm dark:bg-rose-900/70 dark:text-rose-200 dark:border-rose-600',
    },
    refunded: {
      label: 'Refunded',
      icon: RefundIcon,
      className: 'bg-orange-50 text-[#C2410C] border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/40',
    },
  }

  const item = config[status] || {
    label: status || 'Unknown',
    icon: AlertCircle,
    className: 'bg-[var(--surface-elevated)] text-[var(--muted)] border border-[var(--line)]',
  }

  const Icon = item.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-semibold ${item.className}`}
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
  const m = (method || '').toLowerCase()
  let icon = <IndianRupee size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
  let label = 'Cash'

  if (m === 'upi') {
    icon = <QrCode size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />
    label = 'UPI'
  } else if (m === 'card') {
    icon = <CreditCard size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
    label = 'Card'
  } else if (m === 'online' || m === 'razorpay') {
    icon = <ExternalLink size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
    label = 'Online'
  } else if (m === 'credit') {
    icon = <AlertCircle size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
    label = 'Credit'
  } else if (!m) {
    label = '—'
    icon = null
  } else {
    label = method.charAt(0).toUpperCase() + method.slice(1)
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-secondary)] truncate">
      {icon}
      <span className="truncate">{label}</span>
    </span>
  )
}

/* =========================================================
   INVOICE ACTIONS
========================================================= */

function InvoiceActions({
  bill,
  shopName,
  settings,
  onView,
  onCollect,
  onRefresh,
  isLastRows = false,
}) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const isDue = Number(bill.balance_due || 0) > 0 && bill.status !== 'cancelled' && bill.status !== 'refunded'

  const isHalfA4 = settings?.invoice_template === 'half_a4' || settings?.printer_type === 'half_a4' || settings?.invoice_template === 'advanced_gst_a5'
  const isThermal58 = settings?.printer_type === 'thermal_58' || settings?.invoice_template === 'thermal_58'
  const sheetMode = isHalfA4 ? 'half_a4' : 'a4'
  const thermalMode = isThermal58 ? 'thermal_58' : 'thermal'

  useEffect(() => {
    if (!menuOpen) return

    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <div className="flex items-center justify-center gap-1">
      {isDue && (
        <button
          type="button"
          onClick={() => onCollect?.(bill)}
          className="btn-success btn-sm inline-flex shrink-0 items-center gap-1"
          title={`Collect payment (${fmt(bill.balance_due)} due)`}
        >
          <IndianRupee size={11} />
          <span>Collect</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => onView ? onView(bill) : navigate(`/invoice/${bill.id}`)}
        className="p-1.5 rounded-md text-[var(--muted)] hover:text-[#1E3A5F] dark:hover:text-sky-400 hover:bg-[var(--surface-hover)] transition"
        title="View invoice details"
        aria-label="View invoice"
      >
        <Eye size={15} />
      </button>

      <button
        type="button"
        onClick={() => openPdf(bill.id, sheetMode)}
        className="p-1.5 rounded-md text-[var(--muted)] hover:text-[#1E3A5F] dark:hover:text-sky-400 hover:bg-[var(--surface-hover)] transition"
        title={`Print bill (${isHalfA4 ? 'Half-A4' : 'A4'})`}
        aria-label="Print invoice"
      >
        <Printer size={15} />
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(v => !v)
          }}
          className={`p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition ${
            menuOpen ? 'bg-[var(--surface-hover)] text-[var(--ink)]' : ''
          }`}
          title="More actions"
          aria-label="More actions"
        >
          <MoreHorizontal size={15} />
        </button>

        {menuOpen && (
          <div
            className={`absolute right-0 z-50 w-52 overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl text-left ${
              isLastRows ? 'bottom-8' : 'top-8'
            }`}
            onClick={e => e.stopPropagation()}
          >
            {isDue && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  onCollect?.(bill)
                }}
                className="flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-[#1E3A5F] hover:bg-[var(--surface-elevated)] dark:text-sky-300"
              >
                <IndianRupee size={13} />
                <span>Collect Payment</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                openPdf(bill.id, thermalMode)
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
            >
              <Printer size={13} />
              <span>Thermal Receipt ({isThermal58 ? '58mm' : '80mm'})</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                setMenuOpen(false)
                const phone = (bill.customer_phone || '').replace(/\D/g, '')
                const popup = window.open('', '_blank')
                try {
                  const res = await invoiceService.sendWhatsApp(bill.id, phone)
                  if (res?.whatsapp_url) {
                    if (popup) popup.location.href = res.whatsapp_url
                    else window.location.href = res.whatsapp_url
                    toast.success('WhatsApp opened & logged!')
                    return
                  }
                  const shortUrl = bill.short_url || await getShortUrl(bill.id)
                  const message = `${buildShareText(bill, shopName)}\n\nView bill: ${shortUrl}`
                  const url = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`
                  if (popup) popup.location.href = url
                  else window.location.href = url
                } catch {
                  popup?.close()
                  toast.error('Could not open WhatsApp')
                }
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <MessageCircle size={13} />
              <span>Send WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                setMenuOpen(false)
                try {
                  const url = bill.short_url || await getShortUrl(bill.id)
                  window.open(url, '_blank')
                } catch {
                  toast.error('Could not get digital bill link')
                }
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
            >
              <ExternalLink size={13} />
              <span>View Digital Bill</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                setMenuOpen(false)
                try {
                  const url = bill.short_url || await getShortUrl(bill.id)
                  await navigator.clipboard.writeText(url)
                  toast.success('Bill link copied!')
                } catch {
                  toast.error('Could not copy bill link')
                }
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
            >
              <Copy size={13} />
              <span>Copy Bill Link</span>
            </button>

            {(bill.status === 'completed' || bill.status === 'paid' || bill.status === 'posted') && (
              <>
                <div className="my-1 border-t border-[var(--line)]" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onRefresh('cancel', bill.id)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                >
                  <Ban size={13} />
                  <span>Cancel invoice</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    onRefresh('refund', bill.id)
                  }}
                  className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                >
                  <RotateCcw size={13} />
                  <span>Refund invoice</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* =========================================================
   INVOICE MODAL
========================================================= */

function InvoiceModal({
  selected,
  settings,
  shopName,
  onCollect,
  onClose,
}) {
  const modalRef = useRef(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)
  const isHalfA4 = settings?.invoice_template === 'half_a4' || settings?.printer_type === 'half_a4' || settings?.invoice_template === 'advanced_gst_a5'
  const isThermal58 = settings?.printer_type === 'thermal_58' || settings?.invoice_template === 'thermal_58'
  const sheetMode = isHalfA4 ? 'half_a4' : 'a4'
  const thermalMode = isThermal58 ? 'thermal_58' : 'thermal'
  const defaultMode = (settings?.invoice_template === 'thermal_80' || settings?.invoice_template === 'thermal_58' || settings?.printer_type === 'thermal' || settings?.printer_type === 'thermal_58')
    ? thermalMode
    : sheetMode
  const [modalMode, setModalMode] = useState(defaultMode)

  useEffect(() => {
    setModalMode(defaultMode)
  }, [selected?.id, defaultMode])

  useModalA11y(Boolean(selected), onClose, modalRef)

  if (!selected) return null

  const handleSendWhatsApp = async () => {
    setSendingWhatsApp(true)
    const cleanPhone = (selected.customer_phone || '').replace(/\D/g, '')
    const popup = window.open('', '_blank')
    try {
      const res = await invoiceService.sendWhatsApp(selected.id, cleanPhone)
      if (res?.whatsapp_url) {
        if (popup) popup.location.href = res.whatsapp_url
        else window.location.href = res.whatsapp_url
        toast.success('WhatsApp opened & communication logged!')
        setHistoryKey(k => k + 1)
      } else {
        popup?.close()
        toast.error('Could not prepare WhatsApp link')
      }
    } catch {
      popup?.close()
      toast.error('Failed to send WhatsApp')
    } finally {
      setSendingWhatsApp(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-5"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-modal-title"
        tabIndex={-1}
        className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-2xl border border-[var(--line)] outline-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal top action bar */}
        <div className="border-b border-[var(--line)] bg-[var(--surface)] px-3 py-3 sm:px-6">
          {/* Top Row: Title, Invoice No, Status & Close Button */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#1E3A5F] border border-[#D7DEE7] dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                <Receipt size={19} />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-light)]">
                  Invoice Details
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="invoice-modal-title" className="text-base sm:text-lg font-bold text-[var(--ink)] truncate">
                    {selected.invoice_number}
                  </h2>
                  <StatusPill bill={selected} />
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-elevated)] transition"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Action Toolbar: Primary actions prominent, print & share responsive */}
          <div className="mt-3 pt-3 border-t border-[var(--line)]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Primary Actions (WhatsApp, Collect) */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={sendingWhatsApp}
                className="inline-flex min-h-9 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl border border-transparent bg-[#25D366] hover:bg-[#1EBE5D] px-4 py-1.5 text-xs font-bold text-white transition hover:shadow-xs active:scale-95 shadow-2xs disabled:opacity-50"
                title="Send invoice via WhatsApp"
              >
                <MessageCircle size={15} />
                <span>{sendingWhatsApp ? 'Sending…' : 'Send WhatsApp'}</span>
              </button>

              {Number(selected.balance_due || 0) > 0 && selected.status !== 'cancelled' && selected.status !== 'refunded' && (
                <button
                  type="button"
                  onClick={() => onCollect?.(selected)}
                  className="btn-success inline-flex min-h-9 flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition active:scale-95 shadow-xs"
                  title={`Collect outstanding balance (${fmt(selected.balance_due)})`}
                >
                  <IndianRupee size={14} />
                  <span>Collect Due ({fmt(selected.balance_due)})</span>
                </button>
              )}
            </div>

            {/* Print & Secondary Actions */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Settings-driven Sheet Bill */}
              <button
                type="button"
                onClick={() => openPdf(selected.id, sheetMode)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
                title={`Print Sheet Bill (${isHalfA4 ? 'Half-A4' : 'A4'})`}
              >
                <Printer size={13} />
                <span>{isHalfA4 ? 'Half-A4' : 'A4 Bill'}</span>
              </button>

              {/* Settings-driven Thermal Receipt */}
              <button
                type="button"
                onClick={() => openPdf(selected.id, thermalMode)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
                title={`Print Thermal Receipt (${isThermal58 ? '58mm' : '80mm'})`}
              >
                <Printer size={13} />
                <span>Thermal ({isThermal58 ? '58mm' : '80mm'})</span>
              </button>

              {/* Download PDF */}
              <button
                type="button"
                onClick={() => openPdf(selected.id, modalMode)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
                title="Download PDF in current preview layout"
              >
                <Download size={13} />
                <span className="hidden xs:inline">PDF</span>
              </button>

              {/* Digital Bill Link */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const url = selected.short_url || await getShortUrl(selected.id)
                    window.open(url, '_blank')
                  } catch {
                    toast.error('Could not get bill link')
                  }
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
                title="View mobile-friendly digital bill"
              >
                <ExternalLink size={13} />
                <span className="hidden sm:inline">View Bill</span>
              </button>

              {/* Copy Link */}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const url = selected.short_url || await getShortUrl(selected.id)
                    await navigator.clipboard.writeText(url)
                    toast.success('Bill link copied!')
                  } catch {
                    toast.error('Could not copy bill link')
                  }
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
                title="Copy digital bill link"
              >
                <Copy size={13} />
                <span className="hidden sm:inline">Copy</span>
              </button>

              {/* Share Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    setShareOpen(v => !v)
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
                  title="Share invoice"
                >
                  <Share2 size={13} />
                  <span>Share</span>
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
        </div>

        {/* Modal body: settings-driven invoice + communication history */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-elevated)] p-2 sm:p-5 space-y-5">
          <section className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 sm:p-4">
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <h3 className="text-xs font-bold text-[var(--ink)]">Invoice document</h3>
              <span className="text-[10px] text-[var(--muted-light)]">Swipe horizontally to view the full page</span>
            </div>
            <div className="flex max-w-full justify-start overflow-x-auto sm:justify-center">
              <InvoiceDocument
                invoice={selected}
                settings={settings}
                mode={modalMode}
                onModeChange={setModalMode}
                showModePicker={true}
              />
            </div>
          </section>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
            <CommunicationHistory
              referenceType="invoice"
              referenceId={selected.id}
              initialLogs={selected.communication_history}
              key={historyKey}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   MOBILE INVOICE CARD
========================================================= */

function MobileInvoiceCard({ bill, shopName, settings, onView, onCollect, onRefresh }) {
  const navigate = useNavigate()
  const [shareOpen, setShareOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const isDue = Number(bill.balance_due || 0) > 0 && bill.status !== 'cancelled' && bill.status !== 'refunded'
  const balance = Number(bill.balance_due || 0)
  const paid = Number(bill.paid_amount || 0)

  const isHalfA4 = settings?.invoice_template === 'half_a4' || settings?.printer_type === 'half_a4' || settings?.invoice_template === 'advanced_gst_a5'
  const isThermal58 = settings?.printer_type === 'thermal_58' || settings?.invoice_template === 'thermal_58'
  const sheetMode = isHalfA4 ? 'half_a4' : 'a4'
  const thermalMode = isThermal58 ? 'thermal_58' : 'thermal'

  return (
    <article
      className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-none transition active:bg-[var(--surface-elevated)]"
      onClick={() => onView ? onView(bill) : navigate(`/invoice/${bill.id}`)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            onClick={e => {
              e.stopPropagation()
              onView ? onView(bill) : navigate(`/invoice/${bill.id}`)
            }}
            className="font-mono text-xs font-bold text-[#1E3A5F] hover:underline"
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
          <p className="font-mono text-base font-semibold tabular-nums text-[#0F172A] dark:text-slate-100">
            {fmt(bill.grand_total)}
          </p>
          {isDue && (
            <p className="font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
              Due: {fmt(balance)}
            </p>
          )}
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
            Paid
          </p>
          <p className="mt-1 font-mono text-[11px] font-semibold text-teal-600 dark:text-teal-400">
            {fmt(paid)}
          </p>
        </div>

        <div className="text-right">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)]">
            Balance Due
          </p>
          <p className={`mt-1 font-mono text-[11px] font-bold ${balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--ink-secondary)]'}`}>
            {fmt(balance)}
          </p>
        </div>
      </div>

      {Number(bill.discount_amount || 0) > 0 && (
        <p className="mt-2 text-right text-[10px] font-medium text-red-500">
          -{fmt(bill.discount_amount)} discount
        </p>
      )}

      {/* 1-Tap Mobile Action Buttons */}
      <div
        className="mt-3 space-y-2 border-t border-[var(--line-subtle)] pt-2.5"
        onClick={e => e.stopPropagation()}
      >
        {isDue && (
          <button
            type="button"
            onClick={() => onCollect?.(bill)}
            className="btn-success flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold"
            title={`Collect payment (${fmt(balance)})`}
          >
            <IndianRupee size={13} />
            <span>Collect Due ({fmt(balance)})</span>
          </button>
        )}

        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => onView ? onView(bill) : navigate(`/invoice/${bill.id}`)}
            className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink)] shadow-xs transition hover:bg-[var(--surface-elevated)] active:scale-95"
            title="View invoice"
          >
            <Eye size={13} />
            <span>View</span>
          </button>

          <button
            type="button"
            onClick={() => openPdf(bill.id, sheetMode)}
            className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg bg-[#1E3A5F] text-xs font-semibold text-white shadow-xs transition hover:bg-[#162a45] active:scale-95"
            title={`Print bill (${isHalfA4 ? 'Half-A4' : 'A4'})`}
          >
            <Printer size={13} />
            <span>Print</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShareOpen(v => !v)
                setMoreOpen(false)
              }}
              className="inline-flex min-h-[38px] w-full items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-800 shadow-xs transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 active:scale-95"
            >
              <Share2 size={13} />
              <span>Share</span>
            </button>
            {shareOpen && (
              <ShareMenu
                bill={bill}
                shopName={shopName}
                onClose={() => setShareOpen(false)}
              />
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMoreOpen(v => !v)
                setShareOpen(false)
              }}
              className="inline-flex min-h-[38px] w-full items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--muted)] shadow-xs transition hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)] active:scale-95"
              title="More actions"
            >
              <MoreHorizontal size={16} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 bottom-11 z-50 w-48 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl">
                {isDue && (
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false)
                      onCollect?.(bill)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  >
                    <IndianRupee size={13} /> Collect Payment
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false)
                    openPdf(bill.id, thermalMode)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                >
                  <Printer size={13} /> Thermal ({isThermal58 ? '58mm' : '80mm'})
                </button>
              {(bill.status === 'completed' || bill.status === 'paid') && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false)
                      onRefresh('cancel', bill.id)
                    }}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Ban size={13} /> Cancel Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false)
                      onRefresh('refund', bill.id)
                    }}
                    className="flex w-full items-center gap-2 rounded px-2.5 py-2 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                  >
                    <RefundIcon size={13} /> Refund Sale
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  </article>
  )
}

/* =========================================================
   COLLECT PAYMENT MODAL (NO-GREY UI, LIVE UPI QR, CASH & CARD)
========================================================= */

function CollectPaymentModal({ bill, shopSettings, shopName, onClose, onSuccess }) {
  const modalRef = useRef(null)
  const balanceDue = Number(bill?.balance_due || 0)
  const grandTotal = Number(bill?.grand_total || 0)
  const paidAmount = Number(bill?.paid_amount || 0)

  const [amount, setAmount] = useState(balanceDue > 0 ? String(balanceDue) : '')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copiedUpi, setCopiedUpi] = useState(false)

  useEffect(() => {
    if (bill && balanceDue > 0) {
      setAmount(String(balanceDue))
      setError('')
      setReference('')
      setNotes('')
    }
  }, [bill, balanceDue])

  useModalA11y(Boolean(bill), onClose, modalRef)

  if (!bill) return null

  const handleAmountChange = (val) => {
    setAmount(val)
    setError('')
    const num = parseFloat(val)
    if (isNaN(num) || num <= 0) {
      setError('Amount must be greater than zero')
    } else if (num > balanceDue) {
      setError(`Amount cannot exceed balance due (${fmt(balanceDue)})`)
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid amount greater than zero.')
      return
    }
    if (num > balanceDue) {
      setError(`Amount cannot exceed balance due (${fmt(balanceDue)}).`)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await invoiceService.collectPayment(bill.id, {
        amount: num,
        method,
        reference: reference.trim(),
        notes: notes.trim(),
      })
      toast.success(`Payment of ${fmt(num)} recorded for ${bill.invoice_number}!`)
      window.dispatchEvent(new CustomEvent('pos:payment-collected', { detail: res }))
      onSuccess?.(res)
      onClose()
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.amount || err?.message || 'Failed to collect payment'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
      toast.error('Failed to collect payment')
    } finally {
      setSubmitting(false)
    }
  }

  // Payment methods — ONLY Cash, UPI, and Card. Online/Bank is removed!
  const METHODS = [
    { id: 'cash', label: 'Cash', icon: IndianRupee },
    { id: 'upi', label: 'UPI / QR', icon: QrCode },
    { id: 'card', label: 'Card / POS', icon: CreditCard },
  ]

  const upiId = shopSettings?.shop_upi_id || ''
  const merchantName = shopSettings?.upi_merchant_name || shopName || 'Sri Balaji Store'
  const amountNum = parseFloat(amount) || 0
  const note = `Invoice ${bill.invoice_number}`
  const effectiveUpiId = upiId || 'merchant@upi'
  const upiUri = `upi://pay?pa=${encodeURIComponent(effectiveUpiId)}&pn=${encodeURIComponent(merchantName)}&am=${amountNum > 0 ? amountNum.toFixed(2) : '1.00'}&cu=INR&tn=${encodeURIComponent(note)}`

  const handleCopyUpi = () => {
    if (!effectiveUpiId) return
    navigator.clipboard.writeText(effectiveUpiId)
    setCopiedUpi(true)
    toast.success('UPI ID copied')
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-3 backdrop-blur-xs sm:p-5"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="collect-payment-title"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-xl outline-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1E3A5F] text-white">
              <CircleDollarSign size={18} />
            </div>
            <div className="min-w-0">
              <h2 id="collect-payment-title" className="text-sm font-semibold text-[var(--ink)] sm:text-base">
                Collect Payment
              </h2>
              <p className="truncate text-xs text-[var(--muted)]">
                {bill.invoice_number} &bull; {bill.customer_name || 'Walk-in customer'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)] transition sm:h-9 sm:w-9"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="max-h-[calc(100dvh-112px)] space-y-4 overflow-y-auto p-4 sm:max-h-[72vh] sm:p-5">
          {/* Summary Strip */}
          <div className="grid grid-cols-3 gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] p-2.5 text-center sm:gap-2 sm:p-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Total Bill
              </span>
              <p className="mt-0.5 font-mono text-sm font-semibold text-[var(--ink)]">
                {fmt(grandTotal)}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Paid
              </span>
              <p className="mt-0.5 font-mono text-sm font-semibold text-teal-600 dark:text-teal-400">
                {fmt(paidAmount)}
              </p>
            </div>
            <div className="rounded-lg bg-[var(--surface)] p-1 border border-amber-300 dark:border-amber-700">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Balance Due
              </span>
              <p className="mt-0.5 font-mono text-sm font-bold text-amber-600 dark:text-amber-400">
                {fmt(balanceDue)}
              </p>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[var(--ink)]">
                Amount to Collect (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAmountChange(String(balanceDue))}
              className="min-h-9 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[#1E3A5F] transition hover:bg-[var(--surface-elevated)] dark:text-sky-300"
                >
                  Pay Full ({fmt(balanceDue)})
                </button>
                {balanceDue > 100 && (
                  <button
                    type="button"
                    onClick={() => handleAmountChange(String((balanceDue / 2).toFixed(2)))}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-[var(--surface)] text-[var(--ink-secondary)] border border-[var(--line)] hover:border-[var(--line-strong)] transition"
                  >
                    50%
                  </button>
                )}
              </div>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--muted)]">
                <IndianRupee size={16} />
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={balanceDue}
                required
                value={amount}
                onChange={e => handleAmountChange(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-9 pr-3 py-2.5 text-base font-mono font-bold text-[var(--ink)] placeholder:text-[var(--placeholder)] focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/15 outline-none transition"
              />
            </div>
            {error && (
              <p className="mt-1.5 text-xs font-medium text-rose-500 flex items-center gap-1">
                <AlertCircle size={13} />
                {error}
              </p>
            )}
          </div>

          {/* Payment Method Selector — Cash, UPI, Card */}
          <div>
            <label className="text-xs font-bold text-[var(--ink)] mb-1.5 block">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(m => {
                const Icon = m.icon
                const selected = method === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex min-h-[58px] flex-col items-center justify-center rounded-lg border p-2 text-xs font-semibold transition ${
                      selected
                        ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white shadow-xs'
                        : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:border-[var(--line-strong)]'
                    }`}
                  >
                    <Icon size={18} className="mb-1" />
                    <span>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dynamic Content Based on Method */}
          {method === 'upi' ? (
            <div className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] p-3 text-center sm:p-4">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-[#1E3A5F] dark:text-sky-400">
                <QrCode size={16} />
                <span>Scan QR with Any UPI App</span>
              </div>

              <div className="mx-auto flex w-fit items-center justify-center p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
                <QRCodeSVG
                  value={upiUri}
                  size={136}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div>
                <p className="font-mono text-base font-bold text-[var(--ink)]">
                  {fmt(amountNum)}
                </p>
                <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-[var(--muted)]">
                  <span className="font-mono">{effectiveUpiId}</span>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E3A5F] dark:text-sky-400 hover:underline"
                    title="Copy UPI ID"
                  >
                    {copiedUpi ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-[var(--muted-light)]">
                  GPay • PhonePe • Paytm • BHIM • Any Bank App
                </p>
              </div>
            </div>
          ) : method === 'card' ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3.5 shadow-xs">
              <p className="text-xs font-semibold text-[var(--ink)]">
                Card / POS Terminal Collection
              </p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Swipe or tap customer card on your card machine for {fmt(amountNum)}. Enter auth code or card details below.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3.5 shadow-xs">
              <p className="text-xs font-semibold text-[var(--ink)]">
                Cash Collection
              </p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Collect {fmt(amountNum)} in physical cash from customer. Provide receipt if requested.
              </p>
            </div>
          )}

          {/* Reference / Transaction ID */}
          <div>
            <label className="text-xs font-medium text-[var(--ink-secondary)] mb-1 block">
              {method === 'upi' ? 'UPI UTR / Reference No. (Optional)' : method === 'card' ? 'Card Auth Code / Last 4 Digits (Optional)' : 'Receipt / Cash Ref (Optional)'}
            </label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder={method === 'upi' ? 'e.g. 12-digit UTR from customer app' : method === 'card' ? 'e.g. 4321 or Auth #9872' : 'e.g. Counter Cash'}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--placeholder)] focus:border-[#1E3A5F] outline-none transition"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-[var(--ink-secondary)] mb-1 block">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Partial balance collected"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--placeholder)] focus:border-[#1E3A5F] outline-none transition"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-3 sm:flex-row sm:justify-end sm:gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="min-h-11 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:border-[var(--line-strong)] hover:text-[var(--ink)] sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || Boolean(error) || !amount}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#1E3A5F] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#162F4D] disabled:opacity-50 sm:w-auto"
            >
              {submitting ? (
                <>
                  <Spinner size={14} />
                  <span>Recording…</span>
                </>
              ) : (
                <>
                  <IndianRupee size={14} />
                  <span>Record Payment ({fmt(parseFloat(amount) || 0)})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function Bills() {
  const navigate = useNavigate()
  const location = useLocation()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  const [dateFilter, setDateFilter] = useState(() => new URLSearchParams(window.location.search).has('search') ? '' : 'today')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false)

  const [search, setSearch] = useState(() => new URLSearchParams(window.location.search).get('search') || '')
  const [selected, setSelected] = useState(null)
  const [payTarget, setPayTarget] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [cancelReason, setCancelReason] = useState('Customer requested cancellation')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [count, setCount] = useState(0)

  const [selectedIds, setSelectedIds] = useState(new Set())

  const [shopName, setShopName] = useState('Dreamwithtech')
  const [shopSettings, setShopSettings] = useState({})

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const target = params.get('search') || ''
    setSearch(target)
    if (target) {
      setDateFilter('')
      setPage(1)
    }
  }, [location.search])

  const searchInputRef = useRef(null)
  const masterCheckboxRef = useRef(null)

  const draftCount = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('pos_drafts') || '[]').length
    } catch {
      return 0
    }
  }, [])

  /* -------------------------------------------------------
     KEYBOARD SHORTCUTS
  ------------------------------------------------------- */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  /* -------------------------------------------------------
     SHOP SETTINGS
  ------------------------------------------------------- */
  useEffect(() => {
    settingsService
      .getAll()
      .then(settings => {
        if (settings) {
          setShopSettings(settings)
          if (settings.shop_name) {
            setShopName(settings.shop_name)
          }
        }
      })
      .catch(() => {})
  }, [])

  /* -------------------------------------------------------
     RESET PAGE & SELECTIONS ON FILTER CHANGE
  ------------------------------------------------------- */
  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [dateFilter, startDate, endDate, statusFilter, paymentMethodFilter, minAmount, maxAmount, pageSize])

  /* -------------------------------------------------------
     LOAD BILLS
  ------------------------------------------------------- */
  const load = useCallback(
    (pg = 1, q = search) => {
      setLoading(true)

      const params = new URLSearchParams({ page: pg, page_size: pageSize })

      if (dateFilter && dateFilter !== 'custom') {
        params.set('date_filter', dateFilter)
      } else if (dateFilter === 'custom') {
        if (startDate) params.set('start_date', startDate)
        if (endDate) params.set('end_date', endDate)
      }
      if (paymentMethodFilter) {
        params.set('payment_method', paymentMethodFilter)
      }
      if (q.trim()) {
        params.set('search', q.trim())
      }

      invoiceService
        .getInvoices(params)
        .then(({ items, count: totalCount }) => {
          setBills(items)
          setCount(totalCount)
        })
        .catch(() => toast.error('Failed to load bills'))
        .finally(() => setLoading(false))
    },
    [dateFilter, startDate, endDate, paymentMethodFilter, pageSize]
  )

  const searchDebounce = useRef(null)
  useEffect(() => {
    clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => load(page, search), search ? 400 : 0)
    return () => clearTimeout(searchDebounce.current)
  }, [search, page, load])

  // Live synchronization: reload when invoice or payment is created anywhere
  useEffect(() => {
    const handleInvoiceCreated = () => load(1, search)
    const handleWindowFocus = () => load(page, search)
    const handlePaymentCollected = () => load(page, search)
    window.addEventListener('pos:invoice-created', handleInvoiceCreated)
    window.addEventListener('pos:payment-collected', handlePaymentCollected)
    window.addEventListener('focus', handleWindowFocus)
    return () => {
      window.removeEventListener('pos:invoice-created', handleInvoiceCreated)
      window.removeEventListener('pos:payment-collected', handlePaymentCollected)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [load, page, search])

  /* -------------------------------------------------------
     FILTERED BILLS
  ------------------------------------------------------- */
  const visibleBills = useMemo(() => {
    let list = bills
    if (statusFilter) {
      if (statusFilter === 'cancelled' || statusFilter === 'refunded') {
        list = list.filter(bill => bill.status === statusFilter)
      } else {
        list = list.filter(bill => bill.payment_status === statusFilter)
      }
    }
    if (paymentMethodFilter) {
      list = list.filter(bill => (bill.payment_method || '').toLowerCase() === paymentMethodFilter.toLowerCase())
    }
    if (minAmount !== '') {
      list = list.filter(b => Number(b.grand_total || 0) >= Number(minAmount))
    }
    if (maxAmount !== '') {
      list = list.filter(b => Number(b.grand_total || 0) <= Number(maxAmount))
    }
    return list
  }, [bills, statusFilter, paymentMethodFilter, minAmount, maxAmount])

  const statusCounts = useMemo(() => {
    const counts = { all: bills.length, paid: 0, credit: 0, partial: 0, cancelled: 0 }
    bills.forEach(b => {
      const ps = (b.payment_status || '').toLowerCase()
      const st = (b.status || '').toLowerCase()
      if (st === 'cancelled') counts.cancelled++
      else if (ps === 'paid' || st === 'completed') counts.paid++
      else if (ps === 'credit' || (Number(b.balance_due || 0) > 0 && Number(b.paid_amount || 0) === 0)) counts.credit++
      else if (ps === 'partial' || (Number(b.balance_due || 0) > 0 && Number(b.paid_amount || 0) > 0)) counts.partial++
    })
    return counts
  }, [bills])

  /* -------------------------------------------------------
     SELECTION & BULK ACTIONS
  ------------------------------------------------------- */
  const isAllSelected = useMemo(() => {
    if (visibleBills.length === 0) return false
    return visibleBills.every(b => selectedIds.has(b.id))
  }, [visibleBills, selectedIds])

  const isIndeterminate = useMemo(() => {
    if (visibleBills.length === 0) return false
    const someSelected = visibleBills.some(b => selectedIds.has(b.id))
    return someSelected && !isAllSelected
  }, [visibleBills, selectedIds, isAllSelected])

  useEffect(() => {
    if (masterCheckboxRef.current) {
      masterCheckboxRef.current.indeterminate = isIndeterminate
    }
  }, [isIndeterminate])

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleBills.map(b => b.id)))
    }
  }

  const toggleSelectBill = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /* -------------------------------------------------------
     CSV EXPORT
  ------------------------------------------------------- */
  const exportCsvData = useCallback((dataToExport, filenamePrefix = 'Sales_Invoices') => {
    if (!dataToExport || dataToExport.length === 0) {
      toast.error('No invoices to export')
      return
    }

    const headers = [
      'Invoice No',
      'Date',
      'Time',
      'Customer Name',
      'Customer Phone',
      'Items Count',
      'Payment Method',
      'Payment Status',
      'Total Amount (₹)',
      'Paid Amount (₹)',
      'Balance Due (₹)',
    ]

    const rows = dataToExport.map(b => [
      `"${b.invoice_number || ''}"`,
      `"${formatDate(b.created_at)}"`,
      `"${formatTime(b.created_at)}"`,
      `"${(b.customer_name || 'Walk-in Customer').replace(/"/g, '""')}"`,
      `"${b.customer_phone || ''}"`,
      b.items?.length || 0,
      `"${(b.payment_method || 'CASH').toUpperCase()}"`,
      `"${(b.payment_status || b.status || 'PAID').toUpperCase()}"`,
      Number(b.grand_total || 0).toFixed(2),
      Number(b.paid_amount || 0).toFixed(2),
      Number(b.balance_due || 0).toFixed(2),
    ])

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(`Exported ${dataToExport.length} invoices to CSV`)
  }, [])

  const exportCsv = () => exportCsvData(visibleBills, 'Sales_Invoices')
  const exportSelectedCsv = () => {
    const selectedList = visibleBills.filter(b => selectedIds.has(b.id))
    exportCsvData(selectedList, 'Selected_Invoices')
  }

  /* -------------------------------------------------------
     CANCEL
  ------------------------------------------------------- */
  const cancel = useCallback(async (id, reason) => {
    try {
      const res = await invoiceService.cancelInvoice(id, reason || cancelReason || 'Customer requested cancellation')
      if (res?.requires_approval) {
        toast.success(res.message || 'Invoice cancellation submitted for Admin approval')
      } else {
        toast.success('Invoice cancelled and preserved in records')
      }
      setConfirm(null)
      setCancelReason('Customer requested cancellation')
      load(page)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to cancel invoice')
    }
  }, [cancelReason, page, load])

  /* -------------------------------------------------------
     REFUND
  ------------------------------------------------------- */
  const refund = useCallback(async id => {
    try {
      const res = await invoiceService.refundInvoice(id)
      if (res?.requires_approval) {
        toast.success(res.message || 'Refund submitted for Admin approval')
      } else {
        toast.success('Invoice refunded')
      }
      setConfirm(null)
      load(page)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to refund invoice')
    }
  }, [page, load])

  /* -------------------------------------------------------
     TOTALS
  ------------------------------------------------------- */
  const totals = useMemo(() => {
    const revenue = visibleBills.reduce(
      (sum, bill) => sum + (bill.status !== 'cancelled' ? Number(bill.grand_total || 0) : 0),
      0
    )
    const paid = visibleBills.reduce(
      (sum, bill) => sum + (bill.status !== 'cancelled' ? Number(bill.paid_amount || 0) : 0),
      0
    )
    const due = visibleBills.reduce(
      (sum, bill) => sum + (bill.status !== 'cancelled' ? Number(bill.balance_due || 0) : 0),
      0
    )
    const tax = visibleBills.reduce(
      (sum, bill) => sum + (bill.status !== 'cancelled' ? Number(bill.tax_amount || 0) : 0),
      0
    )
    const completed = visibleBills.filter(
      bill => bill.status === 'completed' || bill.payment_status === 'paid'
    ).length

    return {
      revenue,
      paid,
      due,
      tax,
      completed,
      average: completed ? revenue / completed : 0,
    }
  }, [visibleBills])

  /* -------------------------------------------------------
     ACTIVE FILTERS STATE
  ------------------------------------------------------- */
  const hasActiveFilters = Boolean(
    search.trim() ||
    (dateFilter && dateFilter !== 'today') ||
    statusFilter ||
    paymentMethodFilter ||
    minAmount ||
    maxAmount ||
    startDate ||
    endDate
  )

  const handleClearAllFilters = () => {
    setSearch('')
    setDateFilter('today')
    setStartDate('')
    setEndDate('')
    setStatusFilter('')
    setPaymentMethodFilter('')
    setMinAmount('')
    setMaxAmount('')
    setPage(1)
  }

  /* =======================================================
     UI
  ======================================================= */
  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1600px] space-y-4 overflow-x-hidden pb-4">
        {/* =================================================
            HEADER
        ================================================= */}
        <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[var(--muted-light)]">
              <Receipt size={13} />
              <span>Sales</span>
              <span>/</span>
              <span className="text-[var(--muted)]">Invoices</span>
            </div>

            <h1 className="text-xl font-semibold tracking-tight text-[var(--ink)] sm:text-2xl">
              Billing &amp; Invoices
            </h1>

            <p className="mt-0.5 text-xs text-[var(--muted)] sm:text-sm">
              Manage sales, payments, customer credit and invoices.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            {/* Horizontal Scrollable Action Pills for Mobile */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={() => navigate('/sales/payments')}
                className="inline-flex min-h-[42px] whitespace-nowrap items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] shadow-none transition hover:bg-[var(--surface-hover)]"
                title="Payment Sheet & Collection"
              >
                <CreditCard size={14} />
                <span>Payments</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/billing/drafts')}
                className="inline-flex min-h-[42px] whitespace-nowrap items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] shadow-none transition hover:bg-[var(--surface-hover)]"
                title="Parked Bills"
              >
                <Clock3 size={14} />
                <span>Parked</span>
                {draftCount > 0 && (
                  <span className="rounded-full bg-[#1E3A5F] px-1.5 py-0.2 text-[10px] font-bold text-white">
                    {draftCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={exportCsv}
                disabled={loading || visibleBills.length === 0}
                className="inline-flex min-h-[42px] whitespace-nowrap items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] shadow-none transition hover:bg-[var(--surface-hover)] active:scale-95 disabled:opacity-50"
                title="Export visible invoices to CSV"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={() => load(page, search)}
                disabled={loading}
                className="inline-flex min-h-[42px] whitespace-nowrap items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] shadow-none transition hover:bg-[var(--surface-hover)] active:scale-95"
                title="Refresh invoices table"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin text-[#1E3A5F]' : ''} />
                <span>Refresh</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate('/billing/new')}
              className="btn-primary inline-flex min-h-[42px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-none transition active:scale-95 shrink-0"
            >
              <Plus size={15} />
              <span>New Bill</span>
            </button>
          </div>
        </div>

        {/* =================================================
            ERP METRICS SUMMARY (Table-Based)
        ================================================= */}
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
          <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-5 sm:divide-y-0 sm:divide-x">
            <div className="p-3 sm:p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Total Sales
              </span>
              <p className="mt-1 font-mono text-lg font-bold text-[var(--ink)]">
                {fmt(totals.revenue)}
              </p>
              <p className="text-[10px] text-[var(--muted)]">{totals.completed} completed bills</p>
            </div>
            <div className="p-3 sm:p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Collected
              </span>
              <p className="mt-1 font-mono text-lg font-bold text-teal-700 dark:text-teal-400">
                {fmt(totals.paid)}
              </p>
              <p className="text-[10px] text-[var(--muted)]">Total collected</p>
            </div>
            <div className="p-3 sm:p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Balance Due
              </span>
              <p className={`mt-1 font-mono text-lg font-bold ${totals.due > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--ink)]'}`}>
                {fmt(totals.due)}
              </p>
              <p className="text-[10px] text-[var(--muted)]">Outstanding credit</p>
            </div>
            <div className="p-3 sm:p-3.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                GST / Tax
              </span>
              <p className="mt-1 font-mono text-lg font-bold text-[var(--ink)]">
                {fmt(totals.tax)}
              </p>
              <p className="text-[10px] text-[var(--muted)]">Across listed bills</p>
            </div>
            <div className="p-3 sm:p-3.5 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Average Bill
              </span>
              <p className="mt-1 font-mono text-lg font-bold text-[#1E3A5F] dark:text-slate-200">
                {fmt(totals.average)}
              </p>
              <p className="text-[10px] text-[var(--muted)]">Average per sale</p>
            </div>
          </div>
        </div>

        {/* =================================================
            FILTER & SEARCH TOOLBAR
        ================================================= */}
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-xs sm:p-3 space-y-2.5">
          {/* Quick Status Filter Pills with live item counts */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {[
                { label: 'All', value: '', count: statusCounts.all },
                { label: 'Paid', value: 'paid', count: statusCounts.paid },
                { label: 'Credit Due', value: 'credit', count: statusCounts.credit },
                { label: 'Partial', value: 'partial', count: statusCounts.partial },
                { label: 'Cancelled', value: 'cancelled', count: statusCounts.cancelled },
              ].map(st => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => setStatusFilter(st.value)}
                  className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
                    statusFilter === st.value
                      ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-2xs'
                      : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <span>{st.label}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                    statusFilter === st.value
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--surface-subtle)] text-[var(--muted)]'
                  }`}>
                    {st.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Date filter presets */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
              {DATE_FILTERS.map(f => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => {
                    setDateFilter(f.value)
                    if (f.value !== 'custom') {
                      setStartDate('')
                      setEndDate('')
                    }
                  }}
                  className={`shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${
                    dateFilter === f.value
                      ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-700 dark:border-slate-700'
                      : 'border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range Picker (shown when 'Custom' preset is selected) */}
          {dateFilter === 'custom' && (
            <div className="flex flex-col gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] p-2 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <div className="flex items-center gap-1.5 font-medium text-[var(--ink-secondary)]">
                <CalendarDays size={14} className="text-[#1E3A5F] dark:text-sky-400" />
                <span>Custom Date Range:</span>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5 sm:flex">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value)
                    setPage(1)
                  }}
                  className="min-w-0 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-xs text-[var(--ink)] outline-none focus:border-[#1E3A5F] sm:w-auto"
                  title="Start date"
                  aria-label="Start date"
                />
                <span className="text-[var(--muted)] font-medium">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => {
                    setEndDate(e.target.value)
                    setPage(1)
                  }}
                  className="min-w-0 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-2 text-xs text-[var(--ink)] outline-none focus:border-[#1E3A5F] sm:w-auto"
                  title="End date"
                  aria-label="End date"
                />
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('')
                      setEndDate('')
                      setPage(1)
                    }}
                    className="rounded p-1 text-[var(--muted)] hover:text-rose-600 transition"
                    title="Clear custom dates"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Search Bar + Controls */}
          <div className="flex w-full items-center gap-2">
            {/* Search */}
            <div className="group relative flex min-w-0 flex-1 items-center min-h-[42px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600 focus-within:border-[#1E3A5F] focus-within:ring-2 focus-within:ring-[#1E3A5F]/15 dark:focus-within:border-sky-500 dark:focus-within:ring-sky-500/20 shadow-xs">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-elevated)] text-[var(--muted)] transition-colors group-focus-within:bg-blue-50 group-focus-within:text-[#1E3A5F] dark:group-focus-within:bg-blue-950/50 dark:group-focus-within:text-sky-300">
                <Search size={14} strokeWidth={2.2} />
              </div>

              <input
                ref={searchInputRef}
                className="w-full bg-transparent px-2.5 text-xs sm:text-sm font-medium text-[var(--ink)] placeholder:text-[var(--placeholder)] outline-none"
                placeholder="Search invoice number, customer name or phone... (Ctrl+K)"
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />

              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setPage(1)
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] active:scale-95"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex shrink-0 items-center rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)] shadow-2xs">
                  Ctrl+K
                </kbd>
              )}
            </div>

            {/* Filter Toggle Button */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setAdvancedFiltersOpen(v => !v)}
                className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-xs transition ${
                  paymentMethodFilter || minAmount || maxAmount || advancedFiltersOpen
                    ? 'border-[#1E3A5F] bg-blue-50 text-[#1E3A5F] dark:border-blue-600 dark:bg-blue-950/50 dark:text-sky-300'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:border-slate-300'
                }`}
                title="Toggle advanced filters"
                aria-label="Toggle advanced filters"
              >
                <SlidersHorizontal size={14} />
                <span className="hidden sm:inline">Filters</span>

                {(paymentMethodFilter || minAmount || maxAmount) && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1E3A5F] px-1 text-[9px] text-white">
                    {[paymentMethodFilter, minAmount || maxAmount].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="inline-flex min-h-[42px] items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 shrink-0"
                title="Reset all search and filter conditions"
              >
                <X size={13} />
                <span className="hidden md:inline">Reset</span>
              </button>
            )}
          </div>

          {/* Expandable Advanced Filters Drawer */}
          {advancedFiltersOpen && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] p-3 text-xs animate-in fade-in">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink-secondary)] mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethodFilter}
                  onChange={e => {
                    setPaymentMethodFilter(e.target.value)
                    setPage(1)
                  }}
                  className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] outline-none focus:border-[#1E3A5F]"
                >
                  <option value="">All Payment Methods</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI / QR</option>
                  <option value="card">Card / POS</option>
                  <option value="credit">Credit / Pay Later</option>
                  <option value="online">Online / Gateway</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink-secondary)] mb-1">
                  Min Total (₹)
                </label>
                <input
                  type="number"
                  value={minAmount}
                  onChange={e => setMinAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)] outline-none focus:border-[#1E3A5F]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--ink-secondary)] mb-1">
                  Max Total (₹)
                </label>
                <input
                  type="number"
                  value={maxAmount}
                  onChange={e => setMaxAmount(e.target.value)}
                  placeholder="Any amount"
                  min="0"
                  className="w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--ink)] outline-none focus:border-[#1E3A5F]"
                />
              </div>
            </div>
          )}
        </div>

        {/* =================================================
            BULK ACTION BAR (Visible when items selected)
        ================================================= */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-[#1E3A5F]/20 bg-blue-50/90 dark:border-blue-900/60 dark:bg-blue-950/40 px-3.5 py-2 text-xs text-[var(--ink)] shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">
                {selectedIds.size}
              </span>
              <span className="font-semibold text-[#1E3A5F] dark:text-sky-300">
                {selectedIds.size} {selectedIds.size === 1 ? 'invoice' : 'invoices'} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportSelectedCsv}
                className="inline-flex items-center gap-1.5 rounded border border-[#1E3A5F] bg-[#1E3A5F] hover:bg-[#162a45] px-2.5 py-1 text-xs font-semibold text-white shadow-2xs transition active:scale-95"
              >
                <Download size={13} />
                <span>Export Selected (CSV)</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex items-center gap-1 rounded border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] px-2 py-1 text-xs font-medium text-[var(--ink-secondary)] transition"
              >
                <X size={12} />
                <span>Clear Selection</span>
              </button>
            </div>
          </div>
        )}

        {/* =================================================
            INVOICE TABLE
        ================================================= */}
        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">
          {/* Table header bar */}
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
                  ? `${count.toLocaleString('en-IN')} invoices in total`
                  : 'Recent billing transactions'}
              </p>
            </div>

            <div className="hidden items-center gap-1.5 text-[11px] text-[var(--muted-light)] sm:flex">
              <Clock3 size={12} />
              <span>Real-time billing stream</span>
            </div>
          </div>

          {/* Table content / loading / empty */}
          {loading ? (
            <TableSkeleton rows={10} cols={11} label="Loading bills" />
          ) : visibleBills.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No invoices found"
              description="Try changing your search, date range, or payment status filters."
            />
          ) : (
            <>
              {/* Mobile cards view (sm:hidden) */}
              <div className="hidden">
                {visibleBills.map(bill => (
                  <MobileInvoiceCard
                    key={bill.id}
                    bill={bill}
                    shopName={shopName}
                    settings={shopSettings}
                    onView={setSelected}
                    onCollect={setPayTarget}
                    onRefresh={(type, id) =>
                      setConfirm({
                        type,
                        id,
                        invoice_number: bill.invoice_number,
                      })
                    }
                  />
                ))}
              </div>

              {/* Desktop / Tablet Semantic Table */}
              <div className="overflow-x-auto min-h-[220px] pb-4">
                <table className="erp-table w-full text-xs min-w-[1175px]" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '40px' }} />  {/* Selection Checkbox */}
                    <col style={{ width: '130px' }} /> {/* Invoice */}
                    <col style={{ width: '190px' }} /> {/* Customer */}
                    <col style={{ width: '135px' }} /> {/* Date & Time */}
                    <col style={{ width: '75px' }} />  {/* Items */}
                    <col style={{ width: '120px' }} /> {/* Total */}
                    <col style={{ width: '110px' }} /> {/* Paid */}
                    <col style={{ width: '120px' }} /> {/* Balance Due */}
                    <col style={{ width: '105px' }} /> {/* Payment Method */}
                    <col style={{ width: '105px' }} /> {/* Status */}
                    <col style={{ width: '135px' }} /> {/* Actions */}
                  </colgroup>

                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--surface-subtle)] text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      {/* Selection Checkbox */}
                      <th className="px-2 py-3 text-center">
                        <input
                          ref={masterCheckboxRef}
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-[var(--line)] text-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] cursor-pointer align-middle"
                          aria-label="Select all invoices on this page"
                        />
                      </th>

                      {/* 1. Invoice (Left) */}
                      <th className="px-3 py-3 text-left">
                        Invoice
                      </th>

                      {/* 2. Customer (Left) */}
                      <th className="px-3 py-3 text-left">
                        Customer
                      </th>

                      {/* 3. Date & Time (Left) */}
                      <th className="px-3 py-3 text-left">
                        Date &amp; Time
                      </th>

                      {/* 4. Items (Center) */}
                      <th className="px-2 py-3 text-center">
                        Items
                      </th>

                      {/* 5. Total (Right) */}
                      <th className="px-3 py-3 text-right">
                        Total
                      </th>

                      {/* 6. Paid (Right) */}
                      <th className="px-3 py-3 text-right">
                        Paid
                      </th>

                      {/* 7. Balance Due (Right) */}
                      <th className="px-3 py-3 text-right">
                        Balance Due
                      </th>

                      {/* 8. Payment Method (Left) */}
                      <th className="px-3 py-3 text-left truncate">
                        Payment
                      </th>

                      {/* 9. Status (Center) */}
                      <th className="px-2 py-3 text-center">
                        Status
                      </th>

                      {/* 10. Actions (Center) */}
                      <th className="px-2 py-3 text-center">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[var(--line-subtle)]">
                    {visibleBills.map((bill, idx) => {
                      const isLastRows = visibleBills.length > 2 && idx >= visibleBills.length - 2
                      const isSelected = selectedIds.has(bill.id)
                      const balance = Number(bill.balance_due || 0)
                      const paid = Number(bill.paid_amount || 0)
                      const total = Number(bill.grand_total || 0)
                      const discount = Number(bill.discount_amount || 0)
                      const isCancelled = bill.status === 'cancelled'

                      return (
                        <tr
                          key={bill.id}
                          className={`group transition-colors ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-950/30'
                              : 'hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <td className="px-2 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectBill(bill.id)}
                              className="h-4 w-4 rounded border-[var(--line)] text-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] cursor-pointer align-middle"
                              aria-label={`Select invoice ${bill.invoice_number}`}
                            />
                          </td>

                          {/* 1. Invoice (Left) */}
                          <td className="px-3 py-2.5 text-left">
                            <button
                              type="button"
                              onClick={() => setSelected(bill)}
                              className="font-mono text-xs font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline truncate block max-w-full text-left"
                              title={`View invoice ${bill.invoice_number}`}
                            >
                              {bill.invoice_number}
                            </button>
                            <div className="mt-0.5 text-[10px] text-[var(--muted)] font-mono tabular-nums truncate">
                              {fmt(bill.subtotal)} subtotal
                            </div>
                          </td>

                          {/* 2. Customer (Left) */}
                          <td className="px-3 py-2.5 text-left">
                            <div
                              className="truncate font-semibold text-xs text-[var(--ink)]"
                              title={bill.customer_name || 'Walk-in customer'}
                            >
                              {bill.customer_name || 'Walk-in customer'}
                            </div>
                            {bill.customer_phone ? (
                              <div
                                className="flex items-center gap-1 text-[11px] text-[var(--muted)] font-mono truncate mt-0.5"
                                title={bill.customer_phone}
                              >
                                <Phone size={10} className="shrink-0" />
                                <span className="truncate">{bill.customer_phone}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-[var(--muted-light)] mt-0.5">
                                Unknown / No phone
                              </div>
                            )}
                          </td>

                          {/* 3. Date & Time (Left) */}
                          <td className="px-3 py-2.5 text-left">
                            <div className="text-xs font-medium text-[var(--ink)] whitespace-nowrap">
                              {formatDate(bill.created_at)}
                            </div>
                            <div className="text-[10px] text-[var(--muted)] font-mono whitespace-nowrap mt-0.5">
                              {formatTime(bill.created_at)}
                            </div>
                          </td>

                          {/* 4. Items (Center) */}
                          <td className="px-2 py-2.5 text-center">
                            <span
                              className="inline-flex items-center justify-center gap-1 rounded bg-[var(--surface-subtle)] border border-[var(--line)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-secondary)]"
                              title={`${bill.items?.length || 0} item${(bill.items?.length || 0) === 1 ? '' : 's'} in invoice`}
                            >
                              <ShoppingBag size={11} className="text-[var(--muted)]" />
                              <span>{bill.items?.length || 0}</span>
                            </span>
                          </td>

                          {/* 5. Total (Right) */}
                          <td className="px-3 py-2.5 text-right">
                            <div className="font-mono text-xs sm:text-sm font-bold tabular-nums text-[var(--ink)]">
                              {fmt(total)}
                            </div>
                            {discount > 0 && (
                              <div className="text-[10px] font-medium text-rose-600 dark:text-rose-400 truncate">
                                -{fmt(discount)}
                              </div>
                            )}
                          </td>

                          {/* 6. Paid (Right) */}
                          <td className="px-3 py-2.5 text-right">
                            <div className="font-mono text-xs sm:text-sm font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                              {fmt(paid)}
                            </div>
                          </td>

                          {/* 7. Balance Due (Right) */}
                          <td className="px-3 py-2.5 text-right">
                            <div className={`font-mono text-xs sm:text-sm font-bold tabular-nums ${balance > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--muted-light)]'}`}>
                              {fmt(balance)}
                            </div>
                            {balance > 0 && !isCancelled && (
                              <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 flex items-center justify-end gap-1">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                <span>Due</span>
                              </div>
                            )}
                          </td>

                          {/* 8. Payment Method (Left) */}
                          <td className="px-3 py-2.5 text-left">
                            <div className="truncate">
                              <PaymentBadge method={bill.payment_method} />
                            </div>
                          </td>

                          {/* 9. Status (Center) */}
                          <td className="px-2 py-2.5 text-center">
                            <div className="flex justify-center">
                              <StatusPill bill={bill} />
                            </div>
                          </td>

                          {/* 10. Actions (Center) */}
                          <td className="px-2 py-2.5 text-center">
                            <InvoiceActions
                              bill={bill}
                              shopName={shopName}
                              settings={shopSettings}
                              onView={setSelected}
                              onCollect={setPayTarget}
                              isLastRows={isLastRows}
                              onRefresh={(type, id) =>
                                setConfirm({
                                  type,
                                  id,
                                  invoice_number: bill.invoice_number,
                                })
                              }
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* =================================================
              PAGINATION & PAGE SIZE SELECTOR
          ================================================= */}
          <div className="flex flex-col gap-3 border-t border-[var(--line-subtle)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
              <span>
                Showing{' '}
                <strong className="font-semibold text-[var(--ink)]">
                  {count > 0 ? (page - 1) * pageSize + 1 : 0}
                </strong>{' '}
                to{' '}
                <strong className="font-semibold text-[var(--ink)]">
                  {Math.min(page * pageSize, count || visibleBills.length)}
                </strong>{' '}
                of{' '}
                <strong className="font-semibold text-[var(--ink)]">
                  {count || visibleBills.length}
                </strong>{' '}
                invoices
              </span>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[var(--muted-light)]">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                  className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--ink)] outline-none focus:border-[#1E3A5F]"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                disabled={page === 1 || loading}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous Page"
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>

              <span className="flex h-7 min-w-7 items-center justify-center rounded bg-[var(--primary)] px-2 font-mono text-xs font-bold text-white">
                {page}
              </span>

              <button
                disabled={loading || (count ? page * pageSize >= count : bills.length < pageSize)}
                onClick={() => setPage(p => p + 1)}
                className="inline-flex items-center gap-1 rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next Page"
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
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
          COLLECT PAYMENT MODAL
      =================================================== */}

      <CollectPaymentModal
        bill={payTarget}
        shopSettings={shopSettings}
        shopName={shopName}
        onClose={() => setPayTarget(null)}
        onSuccess={(updated) => {
          load(page)
          if (selected && (selected.id === updated.id || selected.invoice_number === updated.invoice_number)) {
            setSelected(updated)
          }
        }}
      />

      {/* ===================================================
          INVOICE PREVIEW
      =================================================== */}

      <InvoiceModal
        selected={selected}
        settings={shopSettings}
        shopName={shopName}
        onCollect={setPayTarget}
        onClose={() => setSelected(null)}
      />

      {/* ===================================================
          CONFIRM DIALOG
      =================================================== */}

      <ConfirmDialog
        open={!!confirm}
        onClose={() => {
          setConfirm(null)
          setCancelReason('Customer requested cancellation')
        }}
        onConfirm={() =>
          confirm?.type === 'cancel'
            ? cancel(confirm.id, cancelReason)
            : refund(confirm.id)
        }
        title={
          confirm?.type === 'cancel'
            ? `Cancel Invoice ${confirm.invoice_number ? `(${confirm.invoice_number})` : ''}`
            : 'Refund Invoice'
        }
        message={
          confirm?.type === 'cancel'
            ? 'Financial documents are never deleted. This invoice will transition to CANCELLED status, inventory and ledger adjustments will be reversed, and the original document will be retained.'
            : 'Are you sure? Stock will be restored.'
        }
        confirmLabel={confirm?.type === 'cancel' ? 'Cancel Invoice' : 'Refund'}
        danger
      >
        {confirm?.type === 'cancel' && (
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold text-[var(--ink-secondary)]">
              Cancellation Reason
            </label>
            <input
              type="text"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="e.g. Customer requested cancellation"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-2 text-xs text-[var(--ink)] focus:border-red-500 focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                'Customer requested cancellation',
                'Billing error / duplicate invoice',
                'Customer changed mind',
                'Item out of stock / damaged',
              ].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCancelReason(preset)}
                  className={`rounded border px-2 py-0.5 text-[10px] font-medium transition ${
                    cancelReason === preset
                      ? 'border-rose-800/60 bg-rose-950/40 text-rose-300'
                      : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--line-strong)]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
