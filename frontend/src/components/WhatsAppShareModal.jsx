import React, { useState, useEffect, useMemo } from 'react'
import {
  IconBrandWhatsapp,
  IconFileText,
  IconInfoCircle,
  IconPhone,
  IconReceipt,
  IconCalendar,
  IconArrowRight,
  IconDownload,
  IconLoader2,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'
import { Modal } from './UI'
import { invoiceService } from '../features/billing/api/invoiceService'

/**
 * Format currency amount with Indian rupee symbol and commas.
 */
function formatCurrency(val) {
  const num = Number(val || 0)
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Format ISO date string or Date to '24 Oct 2026'
 */
function formatDate(dateVal) {
  if (!dateVal) {
    return new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }
  const d = new Date(dateVal)
  if (isNaN(d.getTime())) {
    return String(dateVal)
  }
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Clean phone digits to 10-digit or full national number
 */
function cleanPhoneNumber(phone) {
  return String(phone || '').replace(/\D/g, '')
}

export default function WhatsAppShareModal({
  open,
  onClose,
  invoice,
  shopName = 'Dreamwithtech',
  onConfirmed,
}) {
  const [phone, setPhone] = useState('')
  const [shortUrl, setShortUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [loadingLink, setLoadingLink] = useState(false)

  // Dynamic invoice values
  const invoiceNumber = useMemo(() => {
    if (!invoice) return ''
    return invoice.invoice_number || (invoice.id ? `INV-${invoice.id}` : 'SI-000001')
  }, [invoice])

  const amountFormatted = useMemo(() => {
    return formatCurrency(invoice?.grand_total)
  }, [invoice?.grand_total])

  const dateFormatted = useMemo(() => {
    return formatDate(invoice?.created_at || invoice?.date)
  }, [invoice?.created_at, invoice?.date])

  const customerName = useMemo(() => {
    if (!invoice) return 'Valued Customer'
    return (
      invoice.customer_name ||
      invoice.customer?.name ||
      'Walk-in Customer'
    )
  }, [invoice])

  const pdfFileName = useMemo(() => {
    return `${invoiceNumber}.pdf`
  }, [invoiceNumber])

  // Sync phone & short URL whenever modal opens
  useEffect(() => {
    if (!open || !invoice) return

    const initialPhone =
      invoice.customer_phone ||
      invoice.customer?.mobile ||
      invoice.phone ||
      ''
    const digits = cleanPhoneNumber(initialPhone)
    // If it has 91 prefix with 12 digits, strip 91 for cleaner input
    setPhone(digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits)

    if (invoice.short_url) {
      setShortUrl(invoice.short_url)
    } else if (invoice.id) {
      setLoadingLink(true)
      invoiceService
        .createShortLink(invoice.id)
        .then(res => {
          if (res?.short_url) setShortUrl(res.short_url)
        })
        .catch(() => {
          // Non-blocking fallback
        })
        .finally(() => setLoadingLink(false))
    }
  }, [open, invoice])

  // Build the exact WhatsApp message to display & send
  const message = useMemo(() => {
    const lines = [
      `*${shopName || 'Store'}*`,
      '',
      `*Bill / Invoice:* ${invoiceNumber}`,
      `*Customer:* ${customerName}`,
      `*Date:* ${dateFormatted}`,
      `*Amount:* ${amountFormatted}`,
      `*Payment:* ${(invoice?.payment_method || 'CASH').toUpperCase()}${
        invoice?.payment_status ? ` (${invoice.payment_status.toUpperCase()})` : ''
      }`,
    ]

    if (invoice?.notes) {
      lines.push(`*Notes:* ${invoice.notes}`)
    }

    if (shortUrl) {
      lines.push('', 'View your digital bill online:', shortUrl)
    }

    lines.push('', 'Thank you for shopping with us! 🙏')
    lines.push('Please find your invoice PDF attached.')

    return lines.join('\n')
  }, [
    shopName,
    invoiceNumber,
    customerName,
    dateFormatted,
    amountFormatted,
    invoice?.payment_method,
    invoice?.payment_status,
    invoice?.notes,
    shortUrl,
  ])

  // Trigger PDF download, open WhatsApp with pre-filled message, and notify user
  const handleConfirmAndOpen = async () => {
    if (!invoice?.id) {
      toast.error('No invoice available to share')
      return
    }

    setDownloading(true)

    // 1. Download the invoice PDF
    try {
      const response = await invoiceService.getPdf(invoice.id, {}, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdfFileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => window.URL.revokeObjectURL(url), 2500)
    } catch (pdfErr) {
      console.warn('PDF direct fetch failed; falling back to direct PDF endpoint:', pdfErr)
      const fallbackUrl = `/api/invoices/${invoice.id}/pdf/`
      const a = document.createElement('a')
      a.href = fallbackUrl
      a.download = pdfFileName
      document.body.appendChild(a)
      a.click()
      a.remove()
    }

    // 2. Prepare WhatsApp URL & record communication log on backend
    const rawDigits = cleanPhoneNumber(phone)
    const waPhone = rawDigits.length === 10 ? `91${rawDigits}` : rawDigits

    let waUrl = ''
    try {
      const res = await invoiceService.sendWhatsApp(invoice.id, waPhone)
      if (res?.whatsapp_url) {
        waUrl = res.whatsapp_url
      }
    } catch (apiErr) {
      console.warn('Backend sendWhatsApp log fallback:', apiErr)
    }

    if (!waUrl) {
      waUrl = waPhone
        ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`
    }

    // 3. Open WhatsApp
    const win = window.open(waUrl, '_blank', 'noopener,noreferrer')
    if (!win) {
      window.location.href = waUrl
    }

    // 4. Close modal and instruct user to attach PDF manually
    // Important: Do not show "Message Sent" because WhatsApp does not confirm delivery
    setDownloading(false)
    onClose()
    toast.success('WhatsApp opened. Please attach the downloaded PDF manually before sending.', {
      duration: 6500,
    })
    onConfirmed?.()
  }

  if (!open || !invoice) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Review & Send via WhatsApp"
      subtitle={`Invoice ${invoiceNumber} • ${amountFormatted}`}
      size="md"
      footer={
        <div className="flex w-full flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={downloading}
            className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] active:scale-95 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmAndOpen}
            disabled={downloading}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white px-5 py-2.5 text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition disabled:opacity-60"
          >
            {downloading ? (
              <>
                <IconLoader2 size={16} className="animate-spin" />
                <span>Preparing PDF &amp; WhatsApp...</span>
              </>
            ) : (
              <>
                <IconBrandWhatsapp size={17} />
                <span>Confirm &amp; Open WhatsApp</span>
              </>
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-3.5 text-left text-xs">
        {/* Recipient and Bill Metadata Card */}
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-[var(--surface-elevated)] p-3 sm:p-4 space-y-3 shadow-2xs">
          {/* Phone Number Field */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center justify-between mb-1.5">
              <span>Phone Number</span>
              <span className="text-[10px] lowercase text-[var(--muted)] font-normal">
                {phone ? 'Recipient on WhatsApp' : 'Enter mobile number'}
              </span>
            </label>
            <div className="relative flex items-center">
              <span className="inline-flex items-center gap-1 pl-3 pr-2 text-xs font-bold text-[var(--muted)] bg-transparent select-none">
                <IconPhone size={14} className="text-[#25D366]" />
                <span>+91</span>
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={12}
                value={phone}
                onChange={e => setPhone(cleanPhoneNumber(e.target.value))}
                placeholder="98765 43210"
                className="w-full min-h-[40px] rounded-lg border border-slate-200 dark:border-slate-800 bg-[var(--surface)] px-3 text-sm font-semibold text-[var(--ink)] placeholder:text-[var(--placeholder)] focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
              />
            </div>
          </div>

          {/* Key Invoice Attributes Strip */}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--line-subtle)]">
            <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 bg-[var(--surface)] p-2">
              <span className="text-[9px] uppercase tracking-wider text-[var(--muted)] block">Invoice</span>
              <span className="font-mono font-bold text-[var(--ink)] truncate block">{invoiceNumber}</span>
            </div>
            <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 bg-[var(--surface)] p-2">
              <span className="text-[9px] uppercase tracking-wider text-[var(--muted)] block">Amount</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate block">
                {amountFormatted}
              </span>
            </div>
            <div className="rounded-lg border border-slate-200/70 dark:border-slate-800/70 bg-[var(--surface)] p-2">
              <span className="text-[9px] uppercase tracking-wider text-[var(--muted)] block">Date</span>
              <span className="font-medium text-[var(--ink)] truncate block">{dateFormatted}</span>
            </div>
          </div>

          {/* PDF Attachment preview row */}
          <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200/80 dark:border-slate-800/80 bg-[var(--surface)] p-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                <IconFileText size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[9.5px] uppercase font-bold text-[var(--muted)] block">PDF Attachment</span>
                <span className="font-mono text-[11px] font-semibold text-[var(--ink)] truncate block">
                  {pdfFileName}
                </span>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
              <IconDownload size={11} />
              <span>Auto-download</span>
            </span>
          </div>
        </div>

        {/* Small Notice Callout */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-300/80 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
          <IconInfoCircle size={17} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="leading-snug">
            <strong>The PDF will be downloaded. Please attach it manually in WhatsApp before sending.</strong>
          </p>
        </div>

        {/* Exact WhatsApp Message Preview Box */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Exact WhatsApp Message Preview
            </label>
            {loadingLink && (
              <span className="text-[10px] text-[var(--muted)] animate-pulse">Generating short link...</span>
            )}
          </div>
          <div className="max-h-[140px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--surface)] p-3 text-xs font-mono leading-relaxed text-[var(--ink)] whitespace-pre-wrap shadow-2xs select-text">
            {message}
          </div>
        </div>
      </div>
    </Modal>
  )
}

