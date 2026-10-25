import WhatsAppShareModal from '../components/WhatsAppShareModal'
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
import TemplateCustomizerModal from '../components/TemplateCustomizerModal'
import CommunicationHistory from '../components/CommunicationHistory'
import { InvoiceEmptyIllustration } from '../components/visuals'
import { MobileKpiGrid, MobileFAB } from '../components/MobileUI'

import { QRCodeSVG } from 'qrcode.react'
import {
  IconBrandWhatsapp,
  IconEye,
  IconPrinter,
  IconDownload,
  IconFileTypeXls,
  IconCircleX,
  IconRotate2,
  IconSearch,
  IconX,
  IconMessageCircle,
  IconMail,
  IconShare,
  IconPhone,
  IconPlus,
  IconReceipt,
  IconCurrencyRupee,
  IconShoppingBag,
  IconShoppingCart,
  IconCreditCard,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconRefresh,
  IconClockHour3,
  IconUserCircle,
  IconCoin,
  IconCircleCheck,
  IconAlertCircle,
  IconBan,
  IconRotate2 as RefundIcon,
  IconAdjustmentsHorizontal,
  IconFilter,
  IconFileText,
  IconExternalLink,
  IconCopy,
  IconQrcode,
  IconCheck,
  IconHistory,
  IconBuildingBank,
} from '@tabler/icons-react'

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
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Custom', value: 'custom' },
  { label: 'All Time', value: '' },
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
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return String(date).slice(0, 10) || '—'
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return String(date).slice(0, 10) || '—'
  }
}

function formatTime(date) {
  if (!date) return ''
  try {
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
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

function ShareMenu({ bill, shopName, onClose, onShareWhatsApp }) {
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
      label: 'Review & Send (WhatsApp)',
      icon: <IconBrandWhatsapp size={16} className="text-[#25D366]" />,
      hover: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
      action: () => {
        onClose?.()
        if (onShareWhatsApp) {
          onShareWhatsApp(bill)
        }
      },
    },
    {
      label: 'SMS',
      icon: <IconPhone size={16} className="text-[#1E3A5F]" />,
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
      label: 'Email (SMTP)',
      icon: <IconMail size={16} className="text-[#1E3A5F] dark:text-sky-400" />,
      hover: 'hover:bg-[var(--surface-hover)]',
      action: async () => {
        const customerEmail = bill.customer?.email || bill.customer_email || ''
        let emailToSend = customerEmail
        if (!emailToSend) {
          emailToSend = window.prompt(`Enter customer email address for Invoice #${bill.invoice_number}:`, '')
          if (!emailToSend || !emailToSend.trim()) return
        }
        const loadingToast = toast.loading(`Sending invoice #${bill.invoice_number} to ${emailToSend.trim()}...`)
        try {
          await invoiceService.sendEmail(bill.id, emailToSend.trim())
          toast.success(`Invoice #${bill.invoice_number} emailed successfully!`, { id: loadingToast })
        } catch (err) {
          toast.error(err.response?.data?.detail || 'Failed to send email. Check SMTP settings.', { id: loadingToast })
        }
      },
    },
    {
      label: 'Share Bill',
      icon: <IconFileText size={16} className="text-rose-600 dark:text-rose-400" />,
      hover: 'hover:bg-rose-50 dark:hover:bg-rose-950/40',
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
      icon: <IconShare size={16} className="text-[var(--muted)]" />,
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
      icon: IconCircleCheck,
      className: 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm dark:bg-emerald-900/70 dark:text-emerald-200 dark:border-emerald-600',
    },
    completed: {
      label: 'Paid',
      icon: IconCircleCheck,
      className: 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-sm dark:bg-emerald-900/70 dark:text-emerald-200 dark:border-emerald-600',
    },
    credit: {
      label: 'Credit',
      icon: IconAlertCircle,
      className: 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700',
    },
    partial: {
      label: 'Partial',
      icon: IconAlertCircle,
      className: 'bg-amber-50 text-[#B45309] border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
    },
    pending: {
      label: 'Pending',
      icon: IconClockHour3,
      className: 'bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40',
    },
    cancelled: {
      label: 'Cancelled',
      icon: IconBan,
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
    icon: IconAlertCircle,
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
  let icon = <IconCurrencyRupee size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
  let label = 'Cash'

  if (m === 'upi') {
    icon = <IconQrcode size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />
    label = 'UPI'
  } else if (m === 'card') {
    icon = <IconCreditCard size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
    label = 'Card'
  } else if (m === 'online' || m === 'razorpay') {
    icon = <IconExternalLink size={12} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
    label = 'Online'
  } else if (m === 'credit') {
    icon = <IconAlertCircle size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
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
  onOpenWhatsApp,
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
          className="btn-success btn-sm compact-table-action inline-flex shrink-0 items-center gap-1"
          title={`Collect payment (${fmt(bill.balance_due)} due)`}
        >
          <IconCurrencyRupee size={11} />
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
        <IconEye size={15} />
      </button>

      <button
        type="button"
        onClick={() => openPdf(bill.id, sheetMode)}
        className="p-1.5 rounded-md text-[var(--muted)] hover:text-[#1E3A5F] dark:hover:text-sky-400 hover:bg-[var(--surface-hover)] transition"
        title={`Print bill (${isHalfA4 ? 'Half-A4' : 'A4'})`}
        aria-label="Print invoice"
      >
        <IconPrinter size={15} />
      </button>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setMenuOpen(v => !v)
          }}
          className={`p-1.5 rounded-md text-[var(--muted)] hover:text-[#1E3A5F] hover:bg-blue-50 dark:hover:bg-blue-950/40 transition ${
            menuOpen ? 'bg-blue-50 text-[#1E3A5F] dark:bg-blue-950/40 dark:text-sky-300' : ''
          }`}
          title="More actions"
          aria-label="More actions"
        >
          <IconDots size={15} />
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
                className="flex min-h-9 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              >
                <IconCurrencyRupee size={13} />
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
              <IconPrinter size={13} className="text-slate-500" />
              <span>Thermal Receipt ({isThermal58 ? '58mm' : '80mm'})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                if (onOpenWhatsApp) {
                  onOpenWhatsApp(bill)
                }
              }}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <IconBrandWhatsapp size={14} className="text-[#25D366]" />
              <span>Review &amp; Send WhatsApp</span>
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
              <IconExternalLink size={13} className="text-blue-600 dark:text-blue-400" />
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
              <IconCopy size={13} className="text-violet-600 dark:text-violet-400" />
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
                  <IconBan size={13} />
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
                  <IconRotate2 size={13} />
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
  onReloadSettings,
  onOpenWhatsApp,
}) {
  const modalRef = useRef(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [customizingTpl, setCustomizingTpl] = useState(null)
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [historyKey, setHistoryKey] = useState(0)
  const [mobileTab, setMobileTab] = useState('summary') // 'summary' | 'preview' | 'activity'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [invoicePayments, setInvoicePayments] = useState([])
  const [loadingInvoicePayments, setLoadingInvoicePayments] = useState(false)
  const [copiedInvoiceTxn, setCopiedInvoiceTxn] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  useEffect(() => {
    if (selected?.id) {
      if (Array.isArray(selected.payments) && selected.payments.length > 0) {
        setInvoicePayments(selected.payments)
      } else {
        setLoadingInvoicePayments(true)
        invoiceService.getInvoicePayments(selected.id)
          .then(data => {
            if (Array.isArray(data)) setInvoicePayments(data)
          })
          .catch(() => {})
          .finally(() => setLoadingInvoicePayments(false))
      }
    } else {
      setInvoicePayments([])
    }
  }, [selected?.id, selected?.payments])

  const handleCopyInvoiceTxn = (txn) => {
    if (!txn) return
    navigator.clipboard.writeText(txn)
    setCopiedInvoiceTxn(txn)
    toast.success('Transaction ID copied')
    setTimeout(() => setCopiedInvoiceTxn(''), 2000)
  }

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

  const items = Array.isArray(selected?.items) && selected.items.length > 0
    ? selected.items
    : (Array.isArray(selected?.invoice_items) ? selected.invoice_items : [])

  const dateStr = selected.created_at
    ? new Date(selected.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : (selected.date || '—')

  const handleSendWhatsApp = () => {
    if (onOpenWhatsApp) {
      onOpenWhatsApp(selected)
    }
  }

  const handleSendEmail = async () => {
    const customerEmail = selected.customer?.email || selected.customer_email || ''
    let emailToSend = customerEmail
    if (!emailToSend) {
      emailToSend = window.prompt(`Enter customer email address for Invoice #${selected.invoice_number}:`, '')
      if (!emailToSend || !emailToSend.trim()) return
    }
    setSendingEmail(true)
    const loadingToast = toast.loading(`Sending invoice #${selected.invoice_number} to ${emailToSend.trim()}...`)
    try {
      await invoiceService.sendEmail(selected.id, emailToSend.trim())
      toast.success(`Invoice #${selected.invoice_number} emailed successfully!`, { id: loadingToast })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send email. Check SMTP settings.', { id: loadingToast })
    } finally {
      setSendingEmail(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/60 p-0 sm:p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="invoice-modal-title"
        tabIndex={-1}
        className="flex h-full sm:h-auto sm:max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-none sm:rounded-2xl bg-[var(--surface)] shadow-2xl border-0 sm:border border-[var(--line)] outline-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="border-b border-[var(--line)] bg-[var(--surface)] px-3.5 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#1E3A5F] border border-[#D7DEE7] dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                <IconReceipt size={18} />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 id="invoice-modal-title" className="text-base sm:text-lg font-bold text-[var(--ink)] truncate">
                    {selected.invoice_number}
                  </h2>
                  <StatusPill bill={selected} />
                </div>
                <p className="text-[11px] text-[var(--muted)] truncate">
                  {selected.customer_name || 'Walk-in Customer'} {selected.customer_phone ? `• ${selected.customer_phone}` : ''}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-elevated)] transition shrink-0"
              aria-label="Close modal"
            >
              <IconX size={18} />
            </button>
          </div>

          {/* =====================================================
              MOBILE ACTION BAR (sm:hidden) — 1 Simple Clean Row
          ====================================================== */}
          <div className="mt-2.5 pt-2 border-t border-[var(--line-subtle)] sm:hidden flex items-center gap-1.5">
            {/* WhatsApp */}
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex-1 inline-flex h-8.5 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] hover:bg-[#1EBE5D] text-xs font-bold text-white transition active:scale-95 shadow-2xs min-w-0 px-2"
              title="Review & Send via WhatsApp"
            >
              <IconBrandWhatsapp size={14} className="shrink-0" />
              <span className="truncate">Review &amp; Send</span>
            </button>

            {/* Email Direct */}
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={sendingEmail}
              className="inline-flex h-8.5 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] active:scale-95 transition shadow-2xs min-w-0 px-2.5"
              title="Email Invoice"
            >
              <IconMail size={13} className="text-[#1E3A5F] dark:text-sky-400 shrink-0" />
              <span>Email</span>
            </button>

            {/* Print Direct */}
            <button
              type="button"
              onClick={() => openPdf(selected.id, defaultMode)}
              className="flex-1 inline-flex h-8.5 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] active:scale-95 transition shadow-2xs min-w-0 px-2"
              title="Print Invoice"
            >
              <IconPrinter size={14} className="shrink-0" />
              <span className="truncate">Print</span>
            </button>

            {/* Collect Due */}
            {Number(selected.balance_due || 0) > 0 && selected.status !== 'cancelled' && selected.status !== 'refunded' && (
              <button
                type="button"
                onClick={() => onCollect?.(selected)}
                className="flex-1 inline-flex h-8.5 items-center justify-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition active:scale-95 shadow-2xs min-w-0 px-2"
                title={`Collect ${fmt(selected.balance_due)}`}
              >
                <IconCurrencyRupee size={13} className="shrink-0" />
                <span className="truncate">Collect</span>
              </button>
            )}

            {/* 3-Dots Dropdown Menu */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(curr => !curr)}
                className={`inline-flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--ink)] hover:bg-[var(--surface-hover)] active:scale-95 transition ${
                  mobileMenuOpen ? 'border-[var(--primary)] bg-[var(--surface-hover)]' : ''
                }`}
                aria-label="More actions"
              >
                <IconDots size={16} />
              </button>

              {mobileMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      openPdf(selected.id, thermalMode)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                  >
                    <IconPrinter size={14} />
                    <span>Thermal ({isThermal58 ? '58mm' : '80mm'})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      openPdf(selected.id, sheetMode)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                  >
                    <IconFileText size={14} />
                    <span>Sheet Bill ({isHalfA4 ? 'Half-A4' : 'A4'})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      openPdf(selected.id, modalMode)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                  >
                    <IconDownload size={14} />
                    <span>Download PDF</span>
                  </button>
                  <div className="my-1 border-t border-[var(--line-subtle)]" />
                  <button
                    type="button"
                    onClick={async () => {
                      setMobileMenuOpen(false)
                      try {
                        const url = selected.short_url || await getShortUrl(selected.id)
                        window.open(url, '_blank')
                      } catch {
                        toast.error('Could not get bill link')
                      }
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                  >
                    <IconExternalLink size={14} />
                    <span>View Digital Bill</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setMobileMenuOpen(false)
                      try {
                        const url = selected.short_url || await getShortUrl(selected.id)
                        await navigator.clipboard.writeText(url)
                        toast.success('Bill link copied!')
                      } catch {
                        toast.error('Could not copy link')
                      }
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                  >
                    <IconCopy size={14} />
                    <span>Copy Bill Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      setShareOpen(true)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                  >
                    <IconShare size={14} />
                    <span>Share Invoice</span>
                  </button>
                  <div className="my-1 border-t border-[var(--line-subtle)]" />
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      const activeMap = settings?.active_templates || {}
                      const targetId = modalMode === 'half_a4' ? (activeMap.half_a4 || 'half_a4')
                        : modalMode === 'thermal_58' ? 'thermal_58'
                        : (modalMode === 'thermal' || modalMode === 'thermal_80') ? (activeMap.thermal || 'thermal_80')
                        : (activeMap.default || activeMap.a4 || settings?.invoice_template || 'gst_a4')
                      const meta = (settings?.template_settings?.templates || []).find(t => t.id === targetId) || { id: targetId, name: targetId }
                      setCustomizingTpl(meta)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                  >
                    <IconAdjustmentsHorizontal size={14} className="text-[#0057B8] dark:text-sky-400" />
                    <span>Customize Template</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* =====================================================
              MOBILE NAVIGATION TABS (sm:hidden)
          ====================================================== */}
          <div className="mt-2.5 sm:hidden flex rounded-lg bg-[var(--surface-subtle)] p-0.5 border border-[var(--line-subtle)]">
            <button
              type="button"
              onClick={() => setMobileTab('summary')}
              className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-md transition ${
                mobileTab === 'summary'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Summary & Items
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-md transition ${
                mobileTab === 'preview'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Document Preview
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('activity')}
              className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-md transition ${
                mobileTab === 'activity'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Activity
            </button>
          </div>

          {/* =====================================================
              DESKTOP ACTION TOOLBAR (hidden sm:flex)
          ====================================================== */}
          <div className="mt-3 pt-3 border-t border-[var(--line)]/70 hidden sm:flex items-center justify-between gap-2.5">
            {/* Primary Actions (WhatsApp, Collect) */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-transparent bg-[#25D366] hover:bg-[#1EBE5D] px-4 py-1.5 text-xs font-bold text-white transition hover:shadow-xs active:scale-95 shadow-2xs"
                title="Review & Send via WhatsApp"
              >
                <IconBrandWhatsapp size={15} />
                <span>Review &amp; Send (WhatsApp)</span>
              </button>

              <button
                type="button"
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] px-3.5 py-1.5 text-xs font-bold text-[var(--ink)] transition hover:shadow-xs active:scale-95 shadow-2xs"
                title="Email Invoice to Customer via SMTP"
              >
                <IconMail size={15} className="text-[#1E3A5F] dark:text-sky-400" />
                <span>{sendingEmail ? 'Sending…' : 'Email Bill'}</span>
              </button>

              {Number(selected.balance_due || 0) > 0 && selected.status !== 'cancelled' && selected.status !== 'refunded' && (
                <button
                  type="button"
                  onClick={() => onCollect?.(selected)}
                  className="btn-success inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition active:scale-95 shadow-xs"
                  title={`Collect outstanding balance (${fmt(selected.balance_due)})`}
                >
                  <IconCurrencyRupee size={14} />
                  <span>Collect Due ({fmt(selected.balance_due)})</span>
                </button>
              )}
            </div>

            {/* Print & Secondary Actions */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Sheet Bill */}
              <button
                type="button"
                onClick={() => openPdf(selected.id, sheetMode)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
                title={`Print Sheet Bill (${isHalfA4 ? 'Half-A4' : 'A4'})`}
              >
                <IconPrinter size={13} />
                <span>{isHalfA4 ? 'Half-A4' : 'A4 Bill'}</span>
              </button>

              {/* Thermal Receipt */}
              <button
                type="button"
                onClick={() => openPdf(selected.id, thermalMode)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
                title={`Print Thermal Receipt (${isThermal58 ? '58mm' : '80mm'})`}
              >
                <IconPrinter size={13} />
                <span>Thermal ({isThermal58 ? '58mm' : '80mm'})</span>
              </button>

              {/* Download PDF */}
              <button
                type="button"
                onClick={() => openPdf(selected.id, modalMode)}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
                title="Download PDF"
              >
                <IconDownload size={13} />
                <span>PDF</span>
              </button>

              {/* Customize Template */}
              <button
                type="button"
                onClick={() => {
                  const activeMap = settings?.active_templates || {}
                  const targetId = modalMode === 'half_a4' ? (activeMap.half_a4 || 'half_a4')
                    : modalMode === 'thermal_58' ? 'thermal_58'
                    : (modalMode === 'thermal' || modalMode === 'thermal_80') ? (activeMap.thermal || 'thermal_80')
                    : (activeMap.default || activeMap.a4 || settings?.invoice_template || 'gst_a4')
                  const meta = (settings?.template_settings?.templates || []).find(t => t.id === targetId) || { id: targetId, name: targetId }
                  setCustomizingTpl(meta)
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
                title="Customize invoice template style and layout"
              >
                <IconAdjustmentsHorizontal size={13} className="text-[#0057B8] dark:text-sky-400" />
                <span>Customize Template</span>
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
                title="View digital bill"
              >
                <IconExternalLink size={13} />
                <span>View Bill</span>
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
                    toast.error('Could not copy link')
                  }
                }}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
                title="Copy digital bill link"
              >
                <IconCopy size={13} />
                <span>Copy</span>
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
                  <IconShare size={13} />
                  <span>Share</span>
                </button>

                {shareOpen && (
                  <ShareMenu
                    bill={selected}
                    shopName={shopName}
                    onClose={() => setShareOpen(false)}
                    onShareWhatsApp={handleOpenWhatsApp}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            MOBILE BODY CONTAINER (sm:hidden)
        ====================================================== */}
        <div className="sm:hidden flex-1 min-h-0 overflow-y-auto bg-[var(--surface-elevated)]">
          {/* Tab 1: Summary & Items */}
          {mobileTab === 'summary' && (
            <div className="space-y-3 p-3">
              {/* Customer & Bill Overview Card */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2.5 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-light)]">Customer</p>
                    <p className="text-sm font-bold text-[var(--ink)] truncate">
                      {selected.customer_name || 'Walk-in Customer'}
                    </p>
                    {selected.customer_phone ? (
                      <a
                        href={`tel:${selected.customer_phone}`}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline mt-0.5"
                      >
                        <IconPhone size={12} />
                        <span>{selected.customer_phone}</span>
                      </a>
                    ) : (
                      <p className="text-[11px] text-[var(--muted)] mt-0.5">No phone number</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-light)]">Date & Mode</p>
                    <p className="text-xs font-semibold text-[var(--ink)]">
                      {dateStr}
                    </p>
                    <p className="text-[11px] text-[var(--muted)] capitalize mt-0.5">
                      {selected.payment_method || 'Cash'}
                    </p>
                  </div>
                </div>

                {/* Financial Numbers Strip */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--line-subtle)] text-xs">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-[var(--muted)]">Grand Total</span>
                    <p className="font-mono font-bold text-sm text-[var(--ink)] tabular-nums">{fmt(selected.grand_total)}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-[var(--muted)]">Paid</span>
                    <p className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(selected.paid_amount || 0)}</p>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-[var(--muted)]">Balance Due</span>
                    <p className={`font-mono font-bold text-sm tabular-nums ${Number(selected.balance_due || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-[var(--muted)]'}`}>
                      {fmt(selected.balance_due || 0)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Received History Section */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--line-subtle)]">
                  <div className="flex items-center gap-1.5">
                    <IconHistory size={16} className="text-[#1E3A5F] dark:text-sky-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                      Payment History ({invoicePayments.length})
                    </h4>
                  </div>
                  {Number(selected.balance_due || 0) > 0 && selected.status !== 'cancelled' && selected.status !== 'refunded' ? (
                    <button
                      type="button"
                      onClick={() => onCollect?.(selected)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-bold shadow-xs transition"
                    >
                      <IconCurrencyRupee size={12} />
                      <span>Collect Balance ({fmt(selected.balance_due)})</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <IconCheck size={12} />
                      <span>Paid in Full</span>
                    </span>
                  )}
                </div>

                {loadingInvoicePayments ? (
                  <div className="py-3 text-center text-xs text-[var(--muted)] flex items-center justify-center gap-2">
                    <Spinner size={14} />
                    <span>Loading payment history…</span>
                  </div>
                ) : invoicePayments.length === 0 ? (
                  <div className="py-3 text-center text-xs text-[var(--muted)]">
                    No payment collections recorded for this invoice yet.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--line-subtle)]">
                    {invoicePayments.map((p, idx) => {
                      const payMethod = (p.method || 'cash').toLowerCase()
                      const MethodIcon = (payMethod === 'upi' ? IconQrcode : payMethod === 'card' ? IconCreditCard : payMethod === 'bank' ? IconBuildingBank : IconCurrencyRupee) || IconCurrencyRupee
                      const txnId = p.reference || p.transaction_id || `TXN-INV-${p.id}`

                      return (
                        <div key={p.id || idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              <MethodIcon size={14} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-[var(--ink)]">#PAY-{p.id || idx + 1}</span>
                                <span className="inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {p.method || 'Cash'}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-[var(--muted)]">
                                <span>TXN: <strong className="text-[var(--ink)] select-all">{txnId}</strong></span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyInvoiceTxn(txnId)}
                                  className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-700 hover:underline dark:text-sky-400"
                                  title="Copy Transaction ID"
                                >
                                  {copiedInvoiceTxn === txnId ? (
                                    <span className="text-emerald-600 font-bold">Copied</span>
                                  ) : (
                                    <>
                                      <IconCopy size={11} />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>
                              </div>
                              <p className="text-[10px] text-[var(--muted)] mt-0.5">
                                {formatDate(p.created_at)} • {formatTime(p.created_at)}
                                {p.notes ? ` • ${p.notes}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-400 tabular-nums">
                              + {fmt(p.amount)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Line Items List */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-[var(--line-subtle)]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Items ({items.length})
                  </h4>
                  <span className="text-xs font-mono font-semibold text-[var(--ink)]">Total: {fmt(selected.grand_total)}</span>
                </div>

                {items.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] py-3 text-center">No line items details available</p>
                ) : (
                  <div className="divide-y divide-[var(--line-subtle)]">
                    {items.map((it, idx) => {
                      const qty = Number(it.quantity ?? it.qty ?? 1)
                      const rate = Number(it.unit_price ?? it.rate ?? 0)
                      const total = Number(it.total ?? (qty * rate))
                      return (
                        <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--ink)] truncate">{it.product_name || it.name || 'Item'}</p>
                            <p className="text-[11px] text-[var(--muted)] font-mono mt-0.5">
                              {qty} {it.unit || 'pcs'} × {fmt(rate)}
                              {Number(it.discount_percent || 0) > 0 ? ` (${it.discount_percent}% off)` : ''}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="font-mono font-bold text-xs text-[var(--ink)] tabular-nums">{fmt(total)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Document Preview */}
          {mobileTab === 'preview' && (
            <div className="p-2 space-y-2.5">
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setModalMode(thermalMode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    modalMode === thermalMode
                      ? 'bg-[#1E3A5F] text-white shadow-xs'
                      : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  Thermal ({isThermal58 ? '58mm' : '80mm'})
                </button>
                <button
                  type="button"
                  onClick={() => setModalMode(sheetMode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    modalMode === sheetMode
                      ? 'bg-[#1E3A5F] text-white shadow-xs'
                      : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  {isHalfA4 ? 'Half-A4' : 'A4 Sheet'}
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2">
                <InvoiceDocument
                  invoice={selected}
                  settings={settings}
                  mode={modalMode}
                  onModeChange={setModalMode}
                  showModePicker={false}
                />
              </div>
            </div>
          )}

          {/* Tab 3: Activity Logs */}
          {mobileTab === 'activity' && (
            <div className="p-3">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-xs">
                <CommunicationHistory
                  referenceType="invoice"
                  referenceId={selected.id}
                  initialLogs={selected.communication_history}
                  key={historyKey}
                />
              </div>
            </div>
          )}
        </div>

        {/* =====================================================
            DESKTOP BODY CONTAINER (hidden sm:block)
        ====================================================== */}
        <div className="hidden sm:block min-h-0 flex-1 overflow-y-auto bg-[var(--surface-elevated)] p-4 sm:p-5 space-y-5">
          <section className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4">
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

          {/* Desktop Payment History Section */}
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-[var(--line-subtle)]">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <IconHistory size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--ink)]">
                    Payment Collection History ({invoicePayments.length})
                  </h4>
                  <p className="text-[11px] text-[var(--muted)]">Recorded collections and transaction IDs for this invoice</p>
                </div>
              </div>
              {Number(selected.balance_due || 0) > 0 && selected.status !== 'cancelled' && selected.status !== 'refunded' ? (
                <button
                  type="button"
                  onClick={() => onCollect?.(selected)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-xs transition"
                >
                  <IconCurrencyRupee size={14} />
                  <span>Collect Outstanding ({fmt(selected.balance_due)})</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <IconCheck size={14} />
                  <span>Invoice Settled in Full</span>
                </span>
              )}
            </div>

            {loadingInvoicePayments ? (
              <div className="py-4 text-center text-xs text-[var(--muted)] flex items-center justify-center gap-2">
                <Spinner size={16} />
                <span>Loading payments…</span>
              </div>
            ) : invoicePayments.length === 0 ? (
              <div className="py-4 text-center text-xs text-[var(--muted)]">
                No payment transactions recorded for this invoice yet.
              </div>
            ) : (
              <div className="divide-y divide-[var(--line-subtle)]">
                {invoicePayments.map((p, idx) => {
                  const payMethod = (p.method || 'cash').toLowerCase()
                  const MethodIcon = (payMethod === 'upi' ? IconQrcode : payMethod === 'card' ? IconCreditCard : payMethod === 'bank' ? IconBuildingBank : IconCurrencyRupee) || IconCurrencyRupee
                  const txnId = p.reference || p.transaction_id || `TXN-INV-${p.id}`

                  return (
                    <div key={p.id || idx} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                          <MethodIcon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-[var(--ink)]">#PAY-{p.id || idx + 1}</span>
                            <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {p.method || 'Cash'}
                            </span>
                            <span className="text-[11px] text-[var(--muted)]">
                              {formatDate(p.created_at)} • {formatTime(p.created_at)}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-[var(--muted)]">
                            <span>Transaction ID: <strong className="text-[var(--ink)] select-all">{txnId}</strong></span>
                            <button
                              type="button"
                              onClick={() => handleCopyInvoiceTxn(txnId)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline dark:text-sky-400"
                              title="Copy Transaction ID"
                            >
                              {copiedInvoiceTxn === txnId ? (
                                <span className="text-emerald-600 font-bold">Copied</span>
                              ) : (
                                <>
                                  <IconCopy size={12} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                          {p.notes && <p className="text-[11px] text-[var(--muted)] mt-0.5">{p.notes}</p>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-400 tabular-nums">
                          + {fmt(p.amount)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 shadow-xs">
            <CommunicationHistory
              referenceType="invoice"
              referenceId={selected.id}
              initialLogs={selected.communication_history}
              key={historyKey}
            />
          </div>
        </div>

        {/* Template Customizer Modal embedded in Bills */}
        {customizingTpl && (
          <TemplateCustomizerModal
            isOpen={Boolean(customizingTpl)}
            onClose={() => setCustomizingTpl(null)}
            templateId={customizingTpl.id}
            templateMeta={customizingTpl}
            globalSettings={settings}
            onSaved={async () => {
              setCustomizingTpl(null)
              if (typeof onReloadSettings === 'function') {
                await onReloadSettings()
              }
              toast.success('Template customizations saved')
            }}
          />
        )}
      </div>
    </div>
  )
}

/* =========================================================
   MOBILE INVOICE CARD
========================================================= */

function MobileInvoiceCard({ bill, shopName, settings, onView, onCollect, onRefresh, onShareWhatsApp }) {
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
      className="p-3 transition hover:bg-[var(--surface-hover)] active:bg-[var(--surface-elevated)]"
      onClick={() => onView ? onView(bill) : navigate(`/invoice/${bill.id}`)}
    >
      {/* Row 1: Invoice # + Date/Time + Status Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onView ? onView(bill) : navigate(`/invoice/${bill.id}`)
            }}
            className="font-mono text-xs font-bold text-[#1E3A5F] hover:underline dark:text-sky-400 shrink-0"
          >
            {bill.invoice_number}
          </button>
          <span className="text-[10px] text-[var(--muted-light)]">&bull;</span>
          <span className="truncate text-[11px] text-[var(--muted)]">
            {formatDate(bill.created_at)} {formatTime(bill.created_at)}
          </span>
        </div>
        <div className="shrink-0">
          <StatusPill bill={bill} />
        </div>
      </div>

      {/* Row 2: Customer Name/Phone & Grand Total + Due */}
      <div className="mt-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-[var(--ink)]">
            {bill.customer_name || 'Walk-in Customer'}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--muted)]">
            {bill.customer_phone ? (
              <span className="inline-flex items-center gap-0.5">
                <IconPhone size={10} className="shrink-0" />
                <span>{bill.customer_phone}</span>
              </span>
            ) : null}
            <span className="inline-flex items-center">
              <PaymentBadge method={bill.payment_method} />
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-extrabold tabular-nums text-[var(--ink)]">
            {fmt(bill.grand_total)}
          </div>
          {isDue ? (
            <div className="inline-block mt-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold font-mono text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Due: {fmt(balance)}
            </div>
          ) : Number(bill.discount_amount || 0) > 0 ? (
            <span className="text-[10px] text-rose-500 font-medium">-{fmt(bill.discount_amount)} disc</span>
          ) : null}
        </div>
      </div>

      {/* Row 3: Action Buttons (Touch-friendly, sleek, informative) */}
      <div
        className="mt-2.5 flex items-center justify-between gap-1.5 pt-2 border-t border-[var(--line-subtle)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {/* View Button */}
          <button
            type="button"
            onClick={() => onView ? onView(bill) : navigate(`/invoice/${bill.id}`)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[11px] font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)] shadow-2xs"
            title="View invoice"
          >
            <IconEye size={13} />
            <span>View</span>
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => openPdf(bill.id, sheetMode)}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1E3A5F] px-2.5 text-[11px] font-semibold text-white transition hover:bg-[#162A45] shadow-2xs"
            title="Print bill"
          >
            <IconPrinter size={13} />
            <span>Print</span>
          </button>

          {/* Share WhatsApp Button */}
          <button
            type="button"
            onClick={() => onShareWhatsApp ? onShareWhatsApp(bill) : setShareOpen(v => !v)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 shadow-2xs"
            title="Share via WhatsApp"
          >
            <IconBrandWhatsapp size={13} />
            <span>Share</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Collect Due Button (Only when balance is due) */}
          {isDue && (
            <button
              type="button"
              onClick={() => onCollect?.(bill)}
              className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white transition hover:bg-emerald-700 shadow-2xs"
              title={`Collect due ${fmt(balance)}`}
            >
              <IconCurrencyRupee size={12} />
              <span>Collect</span>
            </button>
          )}

          {/* More Actions Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMoreOpen(v => !v)
                setShareOpen(false)
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] transition hover:bg-[var(--surface-hover)] shadow-2xs"
              title="More actions"
            >
              <IconDots size={15} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 bottom-9 z-50 w-44 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false)
                    openPdf(bill.id, thermalMode)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-hover)]"
                >
                  <IconPrinter size={13} /> Thermal ({isThermal58 ? '58mm' : '80mm'})
                </button>
                {(bill.status === 'completed' || bill.status === 'paid') && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false)
                        onRefresh('cancel', bill.id)
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <IconBan size={13} /> Cancel Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false)
                        onRefresh('refund', bill.id)
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
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

      {shareOpen && (
        <div className="mt-2" onClick={e => e.stopPropagation()}>
          <ShareMenu
            bill={bill}
            shopName={shopName}
            onClose={() => setShareOpen(false)}
            onShareWhatsApp={onShareWhatsApp}
          />
        </div>
      )}
    </article>
  )
}

/* =========================================================
   COLLECT PAYMENT MODAL (NO-GREY UI, LIVE UPI QR, CASH & CARD)
========================================================= */

function CollectPaymentModal({ bill, shopSettings, shopName, onClose, onSuccess }) {
  const modalRef = useRef(null)
  const [currentBill, setCurrentBill] = useState(bill)
  const [activeTab, setActiveTab] = useState('collect') // 'collect' | 'history'
  const [paymentsList, setPaymentsList] = useState(bill?.payments || [])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [recordedPayment, setRecordedPayment] = useState(null)

  const balanceDue = Number(currentBill?.balance_due || 0)
  const grandTotal = Number(currentBill?.grand_total || 0)
  const paidAmount = Number(currentBill?.paid_amount || 0)
  const percentPaid = grandTotal > 0 ? Math.min(100, Math.max(0, Math.round((paidAmount / grandTotal) * 100))) : 100

  // Helper to generate a friendly transaction ID
  const generateTxnId = () => {
    const d = new Date()
    const yy = String(d.getFullYear()).slice(-2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `TXN-${yy}${mm}${dd}${hh}${min}-${rand}`
  }

  const [amount, setAmount] = useState(balanceDue > 0 ? String(balanceDue) : '')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState(() => generateTxnId())
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [copiedTxn, setCopiedTxn] = useState('')

  // Sync when bill prop changes
  useEffect(() => {
    if (bill) {
      setCurrentBill(bill)
      const due = Number(bill?.balance_due || 0)
      setAmount(due > 0 ? String(due) : '')
      setError('')
      setReference(generateTxnId())
      setNotes('')
      setRecordedPayment(null)
      setActiveTab(due > 0 ? 'collect' : 'history')
      setPaymentsList(Array.isArray(bill?.payments) ? bill.payments : [])

      if (bill.id) {
        setLoadingHistory(true)
        invoiceService.getInvoicePayments(bill.id)
          .then(data => {
            if (Array.isArray(data)) {
              setPaymentsList(data)
            }
          })
          .catch(() => {})
          .finally(() => setLoadingHistory(false))
      }
    }
  }, [bill])

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

  const handleQuickAmount = (val) => {
    setAmount(String(val))
    setError('')
  }

  const handleRegenerateTxnId = () => {
    const nextTxn = generateTxnId()
    setReference(nextTxn)
    toast.success('Generated new Transaction ID')
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
      const txnRef = reference.trim() || generateTxnId()
      const res = await invoiceService.collectPayment(currentBill.id, {
        amount: num,
        method,
        reference: txnRef,
        notes: notes.trim(),
      })

      const newLatest = res?.latest_payment || {
        id: (paymentsList[0]?.id || 0) + 1,
        amount: num,
        method,
        reference: txnRef,
        transaction_id: txnRef,
        created_at: new Date().toISOString(),
      }

      setRecordedPayment(newLatest)
      setCurrentBill(res)
      if (Array.isArray(res?.payments)) {
        setPaymentsList(res.payments)
      } else {
        setPaymentsList(prev => [newLatest, ...prev])
      }

      toast.success(`Payment of ${fmt(num)} recorded for ${currentBill.invoice_number}!`)
      window.dispatchEvent(new CustomEvent('pos:payment-collected', { detail: res }))
      onSuccess?.(res)

      // Reset for any subsequent collections
      const newDue = Number(res?.balance_due ?? Math.max(0, balanceDue - num))
      setAmount(newDue > 0 ? String(newDue) : '')
      setReference(generateTxnId())
      setNotes('')
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.amount || err?.message || 'Failed to collect payment'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
      toast.error('Failed to collect payment')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyText = (text, type = 'generic') => {
    if (!text) return
    navigator.clipboard.writeText(text)
    if (type === 'upi') {
      setCopiedUpi(true)
      toast.success('UPI ID copied')
      setTimeout(() => setCopiedUpi(false), 2000)
    } else {
      setCopiedTxn(text)
      toast.success('Transaction ID copied')
      setTimeout(() => setCopiedTxn(''), 2000)
    }
  }

  // Payment methods with tactile icons & descriptions
  const METHODS = [
    { id: 'cash', label: 'Cash', icon: IconCurrencyRupee, badge: 'Counter Cash' },
    { id: 'upi', label: 'UPI / QR', icon: IconQrcode, badge: 'Instant Scan' },
    { id: 'card', label: 'Card / POS', icon: IconCreditCard, badge: 'Terminal / Tap' },
    { id: 'bank', label: 'Bank', icon: IconBuildingBank, badge: 'NEFT / RTGS' },
  ]

  const upiId = shopSettings?.shop_upi_id || ''
  const merchantName = shopSettings?.upi_merchant_name || shopName || 'Sri Balaji Store'
  const amountNum = parseFloat(amount) || 0
  const note = `Invoice ${currentBill.invoice_number}`
  const effectiveUpiId = upiId || 'merchant@upi'
  const upiUri = `upi://pay?pa=${encodeURIComponent(effectiveUpiId)}&pn=${encodeURIComponent(merchantName)}&am=${amountNum > 0 ? amountNum.toFixed(2) : '1.00'}&cu=INR&tn=${encodeURIComponent(note)}`

  const remainingAfterPayment = Math.max(0, balanceDue - (amountNum || 0))
  const isSettlingInFull = amountNum > 0 && Math.abs(balanceDue - amountNum) < 0.01

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-4 animate-in fade-in duration-150"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="collect-payment-title"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border-t border-slate-200 bg-[var(--surface)] text-[var(--ink)] shadow-2xl outline-none dark:border-slate-800 sm:max-h-[calc(100dvh-40px)] sm:rounded-2xl sm:border"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile touch indicator */}
        <div className="flex justify-center pt-2 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-[var(--surface)] px-4 py-3 dark:border-slate-800/80 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <IconCoin size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="collect-payment-title" className="text-base font-bold text-[var(--ink)] leading-tight">
                  Collect Payment
                </h2>
                <span className="inline-flex items-center rounded-md border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
                  {currentBill.invoice_number}
                </span>
              </div>
              <p className="truncate text-xs text-[var(--muted)] mt-0.5">
                {currentBill.customer_name || 'Walk-in Customer'} {currentBill.customer_phone ? `• ${currentBill.customer_phone}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
            aria-label="Close"
          >
            <IconX size={16} />
          </button>
        </div>

        {/* Tab Switcher: Collect vs History */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 px-4 py-1.5 dark:border-slate-800 dark:bg-slate-900/50 sm:px-5">
          <div className="grid w-full grid-cols-2 gap-1 rounded-lg border border-slate-200/80 bg-white/80 p-0.5 dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => {
                setActiveTab('collect')
                setRecordedPayment(null)
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                activeTab === 'collect' && !recordedPayment
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'text-[var(--ink-secondary)] hover:text-[var(--ink)]'
              }`}
            >
              <IconCurrencyRupee size={15} />
              <span>Collect Payment</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('history')
                setRecordedPayment(null)
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                activeTab === 'history'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'text-[var(--ink-secondary)] hover:text-[var(--ink)]'
              }`}
            >
              <IconHistory size={15} />
              <span>Payment History</span>
              <span className={`inline-flex items-center rounded-full px-1.5 text-[10px] font-bold ${
                activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}>
                {paymentsList.length}
              </span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {/* SUCCESS RECEIPT CARD (When a payment was just recorded) */}
          {recordedPayment ? (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-inner dark:bg-emerald-950/60 dark:text-emerald-400">
                  <IconCircleCheck size={36} />
                </div>
                <h3 className="mt-3 text-base font-bold text-[var(--ink)]">
                  Payment Recorded Successfully!
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Payment record created and ledger synchronized
                </p>
              </div>

              {/* Receipt Summary Card */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2.5 dark:border-emerald-900/40">
                  <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Amount Received</span>
                  <span className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {fmt(recordedPayment.amount)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="block text-[11px] text-[var(--muted)]">Payment ID</span>
                    <span className="font-mono font-semibold text-[var(--ink)]">#PAY-{recordedPayment.id}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-[var(--muted)]">Method</span>
                    <span className="font-semibold uppercase text-[var(--ink)]">{recordedPayment.method || method}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200/80 bg-white/90 p-2.5 dark:border-slate-800 dark:bg-slate-900/80">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">Transaction ID</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(recordedPayment.reference || recordedPayment.transaction_id, 'txn')}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1E3A5F] hover:underline dark:text-sky-400"
                    >
                      {copiedTxn === (recordedPayment.reference || recordedPayment.transaction_id) ? (
                        <>
                          <IconCheck size={12} className="text-emerald-600" />
                          <span className="text-emerald-600 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <IconCopy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="mt-1 font-mono text-xs font-bold text-slate-800 dark:text-slate-200 break-all select-all">
                    {recordedPayment.reference || recordedPayment.transaction_id || 'N/A'}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-[var(--muted)]">Updated Balance Due:</span>
                  <span className={`font-mono font-bold ${balanceDue <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                    {balanceDue <= 0 ? '✓ Paid in Full' : fmt(balanceDue)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setRecordedPayment(null)
                    setActiveTab('history')
                  }}
                  className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-[var(--surface)] text-xs font-semibold text-[var(--ink-secondary)] transition hover:border-slate-300 hover:text-[var(--ink)] dark:border-slate-800"
                >
                  <IconHistory size={16} />
                  <span>View All Payments ({paymentsList.length})</span>
                </button>
                {balanceDue > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setRecordedPayment(null)
                      setActiveTab('collect')
                    }}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    <IconPlus size={16} />
                    <span>Collect Remaining ({fmt(balanceDue)})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 items-center justify-center rounded-lg bg-[#1E3A5F] px-5 text-xs font-bold text-white transition hover:bg-[#162F4D]"
                >
                  Done
                </button>
              </div>
            </div>
          ) : activeTab === 'collect' ? (
            /* ===================================================
               TAB 1: COLLECT PAYMENT FORM
               =================================================== */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Balance Due KPI with Progress Bar */}
              <div className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white/80 to-amber-50/30 p-3.5 dark:border-amber-900/50 dark:from-amber-950/20 dark:via-slate-900/60 dark:to-amber-950/10">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                      Balance Due
                    </span>
                    <div className="mt-0.5 font-mono text-2xl font-extrabold text-amber-700 dark:text-amber-400 sm:text-3xl">
                      {fmt(balanceDue)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <div className="inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300">
                      <span className="text-[10px] text-[var(--muted)] uppercase">Invoice Total:</span>
                      <span className="font-mono font-semibold">{fmt(grandTotal)}</span>
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-md border border-emerald-200/70 bg-emerald-50/90 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <span className="text-[10px] uppercase">Already Paid:</span>
                      <span className="font-mono font-semibold">{fmt(paidAmount)}</span>
                    </div>
                  </div>
                </div>

                {/* Micro progress bar */}
                <div className="mt-2.5">
                  <div className="flex items-center justify-between text-[10px] font-medium text-[var(--muted)] mb-1">
                    <span>Payment Progress</span>
                    <span>{percentPaid}% Settled</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                      style={{ width: `${percentPaid}%` }}
                    />
                  </div>
                </div>
              </div>

              {balanceDue <= 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <IconCircleCheck size={28} className="mx-auto text-emerald-600 dark:text-emerald-400" />
                  <h4 className="mt-1.5 text-sm font-bold text-emerald-900 dark:text-emerald-300">
                    Invoice Settled in Full
                  </h4>
                  <p className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-400/80">
                    No balance remaining on this bill. You can view past payments in the History tab.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
                  >
                    <IconHistory size={14} />
                    <span>View Payment History</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Amount to Collect Input & Chips */}
                  <div className="rounded-xl border border-slate-200/90 bg-[var(--surface)] p-3.5 dark:border-slate-800">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[var(--ink-secondary)]">
                        Amount to Collect <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleQuickAmount(balanceDue)}
                          className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                        >
                          Full Due ({fmt(balanceDue)})
                        </button>
                        {balanceDue > 50 && (
                          <button
                            type="button"
                            onClick={() => handleQuickAmount((balanceDue / 2).toFixed(2))}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            50%
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleQuickAmount('')}
                          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-500 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <IconCurrencyRupee size={18} />
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
                        className={`h-11 w-full rounded-lg border bg-[var(--surface)] pl-9 pr-3 text-lg font-mono font-bold text-[var(--ink)] outline-none transition focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/15 ${
                          error ? 'border-rose-400' : 'border-slate-200 dark:border-slate-800'
                        }`}
                        aria-invalid={Boolean(error)}
                      />
                    </div>

                    {/* Live remaining calculation */}
                    {amountNum > 0 && !error && (
                      <div className="mt-2 flex items-center justify-between text-xs font-medium">
                        <span className="text-[var(--muted)]">Remaining after this payment:</span>
                        {isSettlingInFull ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <IconCheck size={12} />
                            Will settle bill in full
                          </span>
                        ) : (
                          <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">
                            {fmt(remainingAfterPayment)}
                          </span>
                        )}
                      </div>
                    )}

                    {error && (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300" role="alert">
                        <IconAlertCircle size={14} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                      </p>
                    )}
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--ink-secondary)]">
                      Payment Method
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {METHODS.map(m => {
                        const Icon = m.icon
                        const selected = method === m.id
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setMethod(m.id)}
                            aria-pressed={selected}
                            className={`flex min-h-[58px] flex-col items-center justify-center rounded-xl border p-2 text-xs font-semibold transition ${
                              selected
                                ? m.id === 'cash'
                                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                                  : m.id === 'upi'
                                    ? 'border-sky-600 bg-sky-600 text-white shadow-sm shadow-sky-600/20'
                                    : m.id === 'card'
                                      ? 'border-violet-600 bg-violet-600 text-white shadow-sm shadow-violet-600/20'
                                      : 'border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                                : 'border-slate-200 bg-[var(--surface)] text-[var(--ink-secondary)] hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700'
                            }`}
                          >
                            <Icon size={18} className="mb-1" />
                            <span>{m.label}</span>
                            <span className={`text-[10px] font-normal ${selected ? 'text-white/80' : 'text-[var(--muted)]'}`}>
                              {m.badge}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Contextual Visual Panel (UPI QR / Card / Cash / Bank) */}
                  {method === 'upi' ? (
                    <div className="grid grid-cols-1 items-center gap-3 rounded-xl border border-sky-200/80 bg-sky-50/50 p-3 dark:border-sky-900/60 dark:bg-sky-950/20 sm:grid-cols-[116px_1fr]">
                      <div className="mx-auto flex w-fit items-center justify-center rounded-xl border border-slate-200 bg-white p-2 shadow-xs dark:border-slate-700">
                        <QRCodeSVG value={upiUri} size={100} level="M" includeMargin={false} />
                      </div>

                      <div className="min-w-0 text-center sm:text-left">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-sky-700 dark:text-sky-400 sm:justify-start">
                          <IconQrcode size={15} />
                          <span>Dynamic UPI QR Code</span>
                        </div>
                        <p className="mt-1 font-mono text-lg font-bold text-[var(--ink)]">
                          {fmt(amountNum)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-xs text-[var(--muted)] sm:justify-start">
                          <span className="break-all font-mono text-[11px] font-medium">{effectiveUpiId}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(effectiveUpiId, 'upi')}
                            className="inline-flex items-center gap-1 rounded bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700 hover:underline dark:bg-slate-900 dark:text-sky-400"
                            title="Copy UPI ID"
                          >
                            {copiedUpi ? <IconCheck size={12} className="text-emerald-500" /> : <IconCopy size={12} />}
                            <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <p className="mt-1 text-[10px] text-[var(--muted-light)]">
                          Scan with Google Pay &bull; PhonePe &bull; Paytm &bull; BHIM
                        </p>
                      </div>
                    </div>
                  ) : method === 'card' ? (
                    <div className="flex items-start gap-2.5 rounded-xl border border-violet-200/80 bg-violet-50/40 p-3 dark:border-violet-900/40 dark:bg-violet-950/20">
                      <IconCreditCard size={18} className="mt-0.5 shrink-0 text-violet-600 dark:text-violet-400" />
                      <div>
                        <p className="text-xs font-semibold text-[var(--ink)]">
                          Card / POS Terminal Collection
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                          Tap or swipe customer's Debit/Credit card for {fmt(amountNum)}. Enter auth code or card reference below.
                        </p>
                      </div>
                    </div>
                  ) : method === 'bank' ? (
                    <div className="flex items-start gap-2.5 rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                      <IconBuildingBank size={18} className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400" />
                      <div>
                        <p className="text-xs font-semibold text-[var(--ink)]">
                          Bank Transfer / Net Banking (NEFT/RTGS/IMPS)
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                          Record direct bank transfer of {fmt(amountNum)}. Bank UTR can be recorded below.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                      <IconCurrencyRupee size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <p className="text-xs font-semibold text-[var(--ink)]">
                          Physical Cash Collection
                        </p>
                        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                          Collect {fmt(amountNum)} in currency at the counter. Receipt is generated with unique Transaction ID.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Transaction ID & Notes Fields */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <label className="text-xs font-medium text-[var(--ink-secondary)]">
                          Transaction ID / Ref
                        </label>
                        <button
                          type="button"
                          onClick={handleRegenerateTxnId}
                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 hover:text-[#1E3A5F] dark:hover:text-sky-400"
                          title="Generate new ID"
                        >
                          <IconRefresh size={11} />
                          <span>Generate New</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                        placeholder="e.g. TXN-... or UTR"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-[var(--surface)] px-3 font-mono text-xs font-medium text-[var(--ink)] placeholder:text-slate-400 outline-none transition focus:border-[#1E3A5F] dark:border-slate-800 dark:placeholder:text-slate-600"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--ink-secondary)]">
                        Payment Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="e.g. Counter payment"
                        className="h-9 w-full rounded-lg border border-slate-200 bg-[var(--surface)] px-3 text-xs font-medium text-[var(--ink)] placeholder:text-slate-400 outline-none transition focus:border-[#1E3A5F] dark:border-slate-800 dark:placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting || Boolean(error) || !amount || amountNum <= 0}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#162F4D] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? (
                        <>
                          <Spinner size={16} />
                          <span>Recording Payment…</span>
                        </>
                      ) : (
                        <>
                          <IconCheck size={18} />
                          <span>Record Payment &bull; {fmt(amountNum)}</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : (
            /* ===================================================
               TAB 2: PAYMENT HISTORY LIST
               =================================================== */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-secondary)]">
                    Payment History ({paymentsList.length})
                  </h4>
                  <p className="text-[11px] text-[var(--muted)]">
                    All payments received and recorded for this bill
                  </p>
                </div>
                {balanceDue > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('collect')}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    <IconPlus size={13} />
                    <span>Collect More</span>
                  </button>
                )}
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner size={22} />
                  <span className="ml-2 text-xs text-[var(--muted)]">Loading payments…</span>
                </div>
              ) : paymentsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-10 text-center dark:border-slate-800">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
                    <IconHistory size={20} />
                  </div>
                  <p className="mt-2 text-xs font-medium text-[var(--ink)]">No payments recorded yet</p>
                  <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                    Payments collected against this bill will appear here with Transaction IDs.
                  </p>
                  {balanceDue > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('collect')}
                      className="mt-3 inline-flex items-center gap-1 rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white shadow-xs"
                    >
                      <IconCurrencyRupee size={14} />
                      <span>Collect First Payment</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {paymentsList.map((p, idx) => {
                    const payMethod = (p.method || 'cash').toLowerCase()
                    const MethodIcon = (payMethod === 'upi' ? IconQrcode : payMethod === 'card' ? IconCreditCard : payMethod === 'bank' ? IconBuildingBank : IconCurrencyRupee) || IconCurrencyRupee
                    const methodColor = payMethod === 'upi' ? 'text-sky-600 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-400' : payMethod === 'card' ? 'text-violet-600 bg-violet-50 dark:bg-violet-950/50 dark:text-violet-400' : payMethod === 'bank' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400'

                    const txnId = p.reference || p.transaction_id || `TXN-INV-${p.id}`

                    return (
                      <div
                        key={p.id || idx}
                        className="flex flex-col gap-2 rounded-xl border border-slate-200/80 bg-[var(--surface)] p-3 text-xs transition hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${methodColor}`}>
                            <MethodIcon size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono font-bold text-[var(--ink)]">
                                #PAY-{p.id || idx + 1}
                              </span>
                              <span className="inline-flex items-center rounded-md border border-slate-200/70 bg-slate-50 px-1.5 py-0.2 text-[10px] font-semibold uppercase text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {p.method || 'Cash'}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[11px] text-[var(--muted)]">
                                TXN: <strong className="text-[var(--ink)] select-all">{txnId}</strong>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyText(txnId, 'txn')}
                                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-700 hover:underline dark:text-sky-400"
                                title="Copy Transaction ID"
                              >
                                {copiedTxn === txnId ? (
                                  <span className="text-emerald-600">Copied</span>
                                ) : (
                                  <>
                                    <IconCopy size={11} />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="mt-0.5 text-[10px] text-[var(--muted)]">
                              {formatDate(p.created_at)} &bull; {formatTime(p.created_at)}
                              {p.notes ? ` • ${p.notes}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 sm:border-0 sm:pt-0 sm:text-right">
                          <span className="text-[11px] text-[var(--muted)] sm:hidden">Received:</span>
                          <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                            + {fmt(p.amount)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* History Summary Footer */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-[var(--muted)]">Invoiced</span>
                    <span className="font-mono font-bold text-[var(--ink)]">{fmt(grandTotal)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">Collected</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{fmt(paidAmount)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400">Pending</span>
                    <span className="font-mono font-bold text-amber-700 dark:text-amber-400">{fmt(balanceDue)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex shrink-0 items-center justify-end border-t border-slate-100 bg-[var(--surface)] p-3 dark:border-slate-800 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-full rounded-lg border border-slate-200 bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--ink-secondary)] transition hover:border-slate-300 hover:text-[var(--ink)] dark:border-slate-800 dark:hover:border-slate-700 sm:w-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function Bills() {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [showKpis, setShowKpis] = useState(false)
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
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false)
  const [whatsAppInvoice, setWhatsAppInvoice] = useState(null)

  const handleOpenWhatsApp = (billToShare) => {
    setWhatsAppInvoice(billToShare || selected)
    setWhatsAppModalOpen(true)
  }
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
  const reloadSettings = useCallback(async () => {
    try {
      const s = await settingsService.getAll()
      if (s) {
        setShopSettings(s)
        if (s.shop_name) {
          setShopName(s.shop_name)
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    reloadSettings()
  }, [reloadSettings])

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
     PAGINATION HELPERS
  ------------------------------------------------------- */
  const totalInvoices = count || visibleBills.length
  const totalPages = Math.max(1, Math.ceil(totalInvoices / pageSize))

  const paginationPages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages]
    }
    if (page >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }
    return [1, '...', page - 1, page, page + 1, '...', totalPages]
  }, [page, totalPages])

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
      <div className="mx-auto max-w-[1600px] space-y-3 pb-6">
        {/* =================================================
            PAGE HEADER (Compact, aligned on one row)
        ================================================= */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-[var(--line)]">
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--ink)]">
              Billing &amp; Invoices
            </h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Manage sales, payments, customer credit and invoices
            </p>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={() => navigate('/sales/payments')}
              className="btn-secondary h-8 sm:h-8.5 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Payment Sheet & Collection"
            >
              <IconCreditCard size={13} />
              <span>Payments</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/billing/drafts')}
              className="btn-secondary h-8 sm:h-8.5 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Parked Bills"
            >
              <IconClockHour3 size={13} />
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
              className="btn-secondary h-8 sm:h-8.5 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
              title="Export Excel"
              aria-label="Export Excel"
            >
              <IconFileTypeXls size={15} className="text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/billing/new')}
              className="btn-primary h-8 sm:h-8.5 px-3.5 text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
            >
              <IconPlus size={14} />
              <span>New Bill</span>
            </button>
          </div>
        </div>

        {/* KPI Strip: 5 cards -> displays 4 initially on mobile (2x2), with Show more for 5th */}
        <div className="sm:hidden flex items-center justify-between px-1 py-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Sales Summary</span>
          <button
            type="button"
            onClick={() => setShowKpis(v => !v)}
            className="text-xs font-semibold text-[var(--primary)] underline underline-offset-4 hover:opacity-80 transition"
          >
            {showKpis ? 'Show less' : 'Show more'}
          </button>
        </div>

        {/* =================================================
            COMPACT KPI STRIP (~70-80px height, single container)
        ================================================= */}
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-2xs">
          <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-5 sm:divide-y-0 sm:divide-x divide-[var(--line)]">
            {/* Total Sales */}
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block truncate">
                Total Sales
              </span>
              <div className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[var(--ink)] tabular-nums truncate">
                {fmt(totals.revenue)}
              </div>
              <div className="text-[11px] text-[var(--muted)] truncate">
                {totals.completed} {totals.completed === 1 ? 'bill' : 'bills'}
              </div>
            </div>

            {/* Collected */}
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block truncate">
                Collected
              </span>
              <div className="mt-0.5 font-mono text-base sm:text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums truncate">
                {fmt(totals.paid)}
              </div>
              <div className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 truncate">
                {totals.revenue > 0 ? `${Math.round((totals.paid / totals.revenue) * 100)}%` : '100%'}
              </div>
            </div>

            {/* Balance Due */}
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block truncate">
                Balance Due
              </span>
              <div className={`mt-0.5 font-mono text-base sm:text-lg font-bold tabular-nums truncate ${
                totals.due > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--ink)]'
              }`}>
                {fmt(totals.due)}
              </div>
              <div className="text-[11px] text-[var(--muted)] truncate">
                Outstanding
              </div>
            </div>

            {/* GST / Tax */}
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block truncate">
                GST / Tax
              </span>
              <div className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[var(--ink)] tabular-nums truncate">
                {fmt(totals.tax)}
              </div>
              <div className="text-[11px] text-[var(--muted)] truncate">
                Tax collected
              </div>
            </div>

            {/* Average Bill (5th Card, toggled via Show more on mobile) */}
            <div className={`${showKpis ? 'block' : 'hidden'} sm:block px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-0 col-span-2 sm:col-span-1`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block truncate">
                Average Bill
              </span>
              <div className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[#1E3A5F] dark:text-slate-200 tabular-nums truncate">
                {fmt(totals.average)}
              </div>
              <div className="text-[11px] text-[var(--muted)] truncate">
                Per sale
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            COMPACT FILTER & SEARCH TOOLBAR
        ================================================= */}
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 sm:p-2.5 shadow-2xs space-y-2">
          {/* Status Pills & Date Presets */}
          <div className={`${advancedFiltersOpen ? 'flex' : 'hidden'} sm:flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between`}>
            {/* Quick Status Filter Pills with live item counts */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
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
                  className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-semibold border transition ${
                    statusFilter === st.value
                      ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-2xs'
                      : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]'
                  }`}
                >
                  <span>{st.label}</span>
                  <span className={`text-[10px] font-mono px-1 rounded-full ${
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
                  className={`shrink-0 h-8 px-2.5 rounded-md text-xs font-semibold border transition ${
                    dateFilter === f.value
                      ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-700 dark:border-slate-700'
                      : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range Picker (shown when 'Custom' preset is selected) */}
          {dateFilter === 'custom' && (
            <div className="flex flex-col gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] p-2 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <div className="flex items-center gap-1.5 font-medium text-[var(--ink-secondary)]">
                <IconCalendarEvent size={14} className="text-[#1E3A5F] dark:text-sky-400" />
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
                  className="min-w-0 h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs text-[var(--ink)] outline-none focus:border-[#1E3A5F] sm:w-auto"
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
                  className="min-w-0 h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs text-[var(--ink)] outline-none focus:border-[#1E3A5F] sm:w-auto"
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
                    className="h-8 rounded p-1 text-[var(--muted)] hover:text-rose-600 transition"
                    title="Clear custom dates"
                  >
                    <IconX size={14} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Search Bar + Controls */}
          <div className="flex w-full items-center gap-2">
            {/* Search */}
            <div className="group relative flex min-w-0 flex-1 items-center h-[34px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 transition hover:border-slate-300 dark:hover:border-slate-600 focus-within:border-[#1E3A5F] focus-within:ring-1 focus-within:ring-[#1E3A5F]/20">
              <IconSearch size={14} className="shrink-0 text-[var(--muted)] group-focus-within:text-[#1E3A5F] dark:group-focus-within:text-sky-300 mr-2" />
              <input
                ref={searchInputRef}
                className="w-full bg-transparent text-xs font-medium text-[var(--ink)] placeholder:text-[var(--placeholder)] outline-none"
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
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <IconX size={13} />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex shrink-0 items-center rounded border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                  Ctrl+K
                </kbd>
              )}
            </div>

            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setAdvancedFiltersOpen(v => !v)}
              className={`inline-flex h-[34px] items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-2xs transition shrink-0 ${
                paymentMethodFilter || minAmount || maxAmount || advancedFiltersOpen
                  ? 'border-[#1E3A5F] bg-blue-50 text-[#1E3A5F] dark:border-blue-600 dark:bg-blue-950/50 dark:text-sky-300'
                  : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
              title="Toggle advanced filters"
              aria-label="Toggle advanced filters"
            >
              <IconAdjustmentsHorizontal size={13} />
              <span>Filters</span>
              {(paymentMethodFilter || minAmount || maxAmount) && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1E3A5F] px-1 text-[9px] text-white">
                  {[paymentMethodFilter, minAmount || maxAmount].filter(Boolean).length}
                </span>
              )}
            </button>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="inline-flex h-[34px] items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 shrink-0"
                title="Reset all search and filter conditions"
              >
                <IconX size={13} />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}
          </div>

          {/* Expandable Advanced Filters Drawer */}
          {advancedFiltersOpen && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] p-2.5 text-xs">
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
                  className="w-full h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-medium text-[var(--ink)] outline-none focus:border-[#1E3A5F]"
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
                  className="w-full h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs text-[var(--ink)] outline-none focus:border-[#1E3A5F]"
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
                  className="w-full h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs text-[var(--ink)] outline-none focus:border-[#1E3A5F]"
                />
              </div>
            </div>
          )}
        </div>

        {/* =================================================
            BULK ACTION BAR (Visible when items selected)
        ================================================= */}
        {selectedIds.size > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-[#1E3A5F]/20 bg-blue-50/90 dark:border-blue-900/60 dark:bg-blue-950/40 px-3 py-1.5 text-xs text-[var(--ink)] shadow-2xs">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">
                {selectedIds.size}
              </span>
              <span className="font-semibold text-[#1E3A5F] dark:text-sky-300">
                {selectedIds.size} {selectedIds.size === 1 ? 'invoice' : 'invoices'} selected
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={exportSelectedCsv}
                className="inline-flex h-7 items-center gap-1.5 rounded border border-[#1E3A5F] bg-[#1E3A5F] hover:bg-[#162a45] px-2.5 text-xs font-semibold text-white shadow-2xs transition active:scale-95"
              >
                <IconDownload size={12} />
                <span>Export Selected</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex h-7 items-center gap-1 rounded border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] px-2 text-xs font-medium text-[var(--ink-secondary)] transition"
              >
                <IconX size={12} />
                <span>Clear</span>
              </button>
            </div>
          </div>
        )}

        {/* =================================================
            INVOICE TABLE CONTAINER
        ================================================= */}
        <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
          {/* Table content / loading / empty */}
          {loading ? (
            <TableSkeleton rows={10} cols={11} label="Loading bills" />
          ) : visibleBills.length === 0 ? (
            <>
             
                <InvoiceEmptyIllustration
                title={search || statusFilter !== 'all' ? "No invoices match your filters" : "No Invoices Generated Yet"}
                description={search || statusFilter !== 'all' ? "Try changing your search, date range, or payment status filters." : "Start billing customers with high-speed barcode scanning, dynamic UPI QR and automated GST calculations."}
              />
            </>
          ) : (
            <>
              {/* Mobile cards view (sm:hidden) */}
              <div className="sm:hidden divide-y divide-[var(--line-subtle)]">
                {visibleBills.map(bill => (
                  <MobileInvoiceCard
                    key={bill.id}
                    bill={bill}
                    shopName={shopName}
                    settings={shopSettings}
                    onView={setSelected}
                    onCollect={setPayTarget}
                    onShareWhatsApp={handleOpenWhatsApp}
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
              <div className="hidden sm:block overflow-x-auto">
                <table className="erp-table w-full text-xs min-w-[1150px] border-collapse" style={{ tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '38px' }} />  {/* Selection Checkbox */}
                    <col style={{ width: '125px' }} /> {/* Invoice */}
                    <col style={{ width: '170px' }} /> {/* Customer */}
                    <col style={{ width: '125px' }} /> {/* Date & Time */}
                    <col style={{ width: '60px' }} />  {/* Items */}
                    <col style={{ width: '110px' }} /> {/* Total */}
                    <col style={{ width: '100px' }} /> {/* Paid */}
                    <col style={{ width: '110px' }} /> {/* Balance Due */}
                    <col style={{ width: '90px' }} />  {/* Payment Method */}
                    <col style={{ width: '95px' }} />  {/* Status */}
                    <col style={{ width: '160px' }} /> {/* Actions */}
                  </colgroup>

                  <thead className="sticky top-0 z-10 bg-[var(--surface-subtle)] border-b border-[var(--line)] text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    <tr>
                      {/* Selection Checkbox */}
                      <th className="px-2 py-2.5 text-center">
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
                      <th className="px-3 py-2.5 text-left">
                        Invoice
                      </th>

                      {/* 2. Customer (Left) */}
                      <th className="px-3 py-2.5 text-left">
                        Customer
                      </th>

                      {/* 3. Date & Time (Left) */}
                      <th className="px-3 py-2.5 text-left">
                        Date &amp; Time
                      </th>

                      {/* 4. Items (Center) */}
                      <th className="px-2 py-2.5 text-center">
                        Items
                      </th>

                      {/* 5. Total (Right) */}
                      <th className="px-3 py-2.5 text-right">
                        Total
                      </th>

                      {/* 6. Paid (Right) */}
                      <th className="px-3 py-2.5 text-right">
                        Paid
                      </th>

                      {/* 7. Balance Due (Right) */}
                      <th className="px-3 py-2.5 text-right">
                        Balance
                      </th>

                      {/* 8. Payment Method (Left) */}
                      <th className="px-3 py-2.5 text-left truncate">
                        Payment
                      </th>

                      {/* 9. Status (Center) */}
                      <th className="px-2 py-2.5 text-center">
                        Status
                      </th>

                      {/* 10. Actions (Center) */}
                      <th className="px-2 py-2.5 text-center">
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
                          className={`h-[58px] group transition-colors ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-950/30'
                              : 'hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <td className="px-2 py-2 text-center align-middle">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectBill(bill.id)}
                              className="h-4 w-4 rounded border-[var(--line)] text-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] cursor-pointer align-middle"
                              aria-label={`Select invoice ${bill.invoice_number}`}
                            />
                          </td>

                          {/* 1. Invoice (Left) */}
                          <td className="px-3 py-2 text-left align-middle">
                            <button
                              type="button"
                              onClick={() => setSelected(bill)}
                              className="font-mono text-xs font-bold text-[#1E3A5F] dark:text-sky-400 hover:underline block max-w-full text-left break-all"
                              title={`View invoice ${bill.invoice_number}`}
                            >
                              {bill.invoice_number}
                            </button>
                            <div className="mt-0.5 text-[10px] text-[var(--muted)] font-mono tabular-nums truncate">
                              {fmt(bill.subtotal)} subtotal
                            </div>
                          </td>

                          {/* 2. Customer (Left) */}
                          <td className="px-3 py-2 text-left align-middle">
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
                                <IconPhone size={10} className="shrink-0" />
                                <span className="truncate">{bill.customer_phone}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-[var(--muted-light)] mt-0.5">
                                Walk-in customer
                              </div>
                            )}
                          </td>

                          {/* 3. Date & Time (Left) */}
                          <td className="px-3 py-2 text-left align-middle">
                            <div className="text-xs font-medium text-[var(--ink)] whitespace-nowrap">
                              {formatDate(bill.created_at)}
                            </div>
                            <div className="text-[10px] text-[var(--muted)] font-mono whitespace-nowrap mt-0.5">
                              {formatTime(bill.created_at)}
                            </div>
                          </td>

                          {/* 4. Items (Center) */}
                          <td className="px-2 py-2 text-center align-middle">
                            <span
                              className="inline-flex items-center justify-center gap-1 rounded bg-[var(--surface-subtle)] border border-[var(--line)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-secondary)]"
                              title={`${bill.items?.length || 0} item${(bill.items?.length || 0) === 1 ? '' : 's'} in invoice`}
                            >
                              <IconShoppingBag size={11} className="text-[var(--muted)]" />
                              <span>{bill.items?.length || 0}</span>
                            </span>
                          </td>

                          {/* 5. Total (Right) */}
                          <td className="px-3 py-2 text-right align-middle">
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
                          <td className="px-3 py-2 text-right align-middle">
                            <div className="font-mono text-xs sm:text-sm font-semibold tabular-nums text-teal-700 dark:text-teal-400">
                              {fmt(paid)}
                            </div>
                          </td>

                          {/* 7. Balance Due (Right) */}
                          <td className="px-3 py-2 text-right align-middle">
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
                          <td className="px-3 py-2 text-left align-middle">
                            <div className="truncate">
                              <PaymentBadge method={bill.payment_method} />
                            </div>
                          </td>

                          {/* 9. Status (Center) */}
                          <td className="px-2 py-2 text-center align-middle">
                            <div className="flex justify-center">
                              <StatusPill bill={bill} />
                            </div>
                          </td>

                          {/* 10. Actions (Center) */}
                          <td className="px-2 py-2 text-center align-middle">
                            <InvoiceActions
                              bill={bill}
                              shopName={shopName}
                              settings={shopSettings}
                              onView={setSelected}
                              onCollect={setPayTarget}
                              onOpenWhatsApp={handleOpenWhatsApp}
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
              INTEGRATED SUBTLE PAGINATION FOOTER
          ================================================= */}
          {totalInvoices > 0 && (
          <div className="flex flex-col gap-2.5 border-t border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 sm:h-12 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            {/* Left: Showing count */}
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              <span>
                Showing{' '}
                <strong className="font-semibold text-[var(--ink)]">
                  {totalInvoices > 0 ? (page - 1) * pageSize + 1 : 0}
                </strong>
                –
                <strong className="font-semibold text-[var(--ink)]">
                  {Math.min(page * pageSize, totalInvoices)}
                </strong>{' '}
                of{' '}
                <strong className="font-semibold text-[var(--ink)]">
                  {totalInvoices}
                </strong>{' '}
                invoices
              </span>
            </div>

            {/* Right: Page size selector + Page navigation buttons */}
            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              {/* Rows per page */}
              <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <span className="text-[11px] text-[var(--muted-light)]">Rows:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                  className="h-7 rounded border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-semibold text-[var(--ink)] outline-none focus:border-[#1E3A5F]"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Navigation buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="inline-flex h-7 items-center justify-center rounded border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous Page"
                  title="Previous Page"
                >
                  <IconChevronLeft size={14} />
                  <span className="hidden sm:inline ml-0.5">Prev</span>
                </button>

                {/* Desktop page buttons with ellipsis */}
                <div className="hidden sm:flex items-center gap-1">
                  {paginationPages.map((pg, i) =>
                    pg === '...' ? (
                      <span key={`ellipsis-${i}`} className="px-1 text-xs text-[var(--muted)]">
                        …
                      </span>
                    ) : (
                      <button
                        key={pg}
                        type="button"
                        onClick={() => setPage(pg)}
                        className={`h-7 min-w-7 px-2 rounded text-xs font-mono font-semibold transition ${
                          page === pg
                            ? 'bg-[#1E3A5F] text-white shadow-2xs'
                            : 'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
                        }`}
                      >
                        {pg}
                      </button>
                    )
                  )}
                </div>

                {/* Mobile page indicator */}
                <span className="sm:hidden font-mono text-xs font-semibold text-[var(--ink)] px-2">
                  {page} / {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="inline-flex h-7 items-center justify-center rounded border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next Page"
                  title="Next Page"
                >
                  <span className="hidden sm:inline mr-0.5">Next</span>
                  <IconChevronRight size={14} />
                </button>
              </div>
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
            <IconCalendarEvent size={11} />
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
        onReloadSettings={reloadSettings}
        onOpenWhatsApp={handleOpenWhatsApp}
      />

      <WhatsAppShareModal
        open={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        invoice={whatsAppInvoice}
        shopName={shopName}
        onConfirmed={() => reloadBills()}
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
      <MobileFAB icon={IconPlus} label="New Bill" to="/billing/new" />
    </div>
  )
}
