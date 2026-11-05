import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'
import {
  IconAlertCircle,
  IconCircleCheck,
  IconCircleX,
  IconDownload,
  IconPrinter,
  IconRefresh,
  IconCheck,
  IconCopy,
  IconPhone,
  IconMail,
  IconMapPin,
  IconShieldCheck,
  IconBrandWhatsapp,
  IconShare,
  IconBuildingBank,
  IconQrcode,
  IconReceipt,
  IconFileText,
  IconExternalLink,
} from '@tabler/icons-react'

import invoiceService from '../features/billing/api/invoiceService'
import {
  formatCurrency,
  formatNumber,
  formatDecimal,
  formatDate,
  formatTime,
} from '../utils/formatters'
import { API_BASE_URL } from '../api'

const currency = (value) => formatCurrency(value)

/* ============================================================
   STATUS BADGE COMPONENT
============================================================ */
function InvoiceStatusBadge({ cancelled, paid, due, total }) {
  if (cancelled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
        <IconCircleX size={14} aria-hidden="true" />
        <span>Cancelled</span>
      </span>
    )
  }

  if (paid || (total > 0 && due <= 0.005)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
        <IconCircleCheck size={14} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span>✓ Paid in Full</span>
      </span>
    )
  }

  if (due > 0 && due < total) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
        <IconAlertCircle size={14} className="text-amber-600" aria-hidden="true" />
        <span>Partially Paid</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
      <IconReceipt size={14} className="text-sky-600" aria-hidden="true" />
      <span>Payment Due</span>
    </span>
  )
}

/* ============================================================
   LOADING SKELETON STATE
============================================================ */
function InvoiceLoadingSkeleton() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-12" aria-label="Loading digital invoice" aria-busy="true">
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 space-y-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="space-y-2">
              <div className="h-5 w-44 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-3.5 w-28 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
          <div className="h-8 w-28 rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="h-24 rounded-xl bg-slate-50 dark:bg-slate-800/50" />
        <div className="space-y-3 pt-2">
          <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="h-28 rounded-xl bg-slate-50 dark:bg-slate-800/50" />
      </div>
      <p className="mt-4 text-center text-xs font-medium text-slate-400">Loading verified digital invoice…</p>
    </main>
  )
}

/* ============================================================
   MAIN CUSTOMER-FACING DIGITAL INVOICE COMPONENT
============================================================ */
export default function PublicBill() {
  const { token, id } = useParams()
  const [resolvedToken, setResolvedToken] = useState(token || '')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [copiedBank, setCopiedBank] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // 1. Enforce noindex, nofollow for search engine privacy
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]')
    let created = false
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'robots'
      document.head.appendChild(meta)
      created = true
    }
    const previousContent = meta.content
    meta.content = 'noindex, nofollow'

    return () => {
      if (created && meta.parentNode) {
        meta.parentNode.removeChild(meta)
      } else if (meta) {
        meta.content = previousContent
      }
    }
  }, [])

  // 2. Set dynamic customer document title
  useEffect(() => {
    if (data?.invoice?.invoice_number) {
      const shop = data.business?.name || data.settings?.shop_name || 'Store'
      document.title = `Tax Invoice #${data.invoice.invoice_number} • ${shop}`
    }
  }, [data])

  // 3. Resolve public token if accessed by internal invoice ID
  useEffect(() => {
    let active = true
    if (token) {
      setResolvedToken(token)
      return () => { active = false }
    }
    if (!id) {
      setError('Invalid invoice link.')
      setLoading(false)
      return () => { active = false }
    }
    invoiceService.getInvoice(id)
      .then((invoice) => {
        if (!active) return
        if (!invoice?.public_token) {
          throw new Error('This invoice does not have a public digital bill token.')
        }
        setResolvedToken(invoice.public_token)
      })
      .catch((err) => {
        if (!active) return
        setError(err.response?.data?.detail || err.message || 'This digital bill was not found or the link has expired.')
        setLoading(false)
      })
    return () => { active = false }
  }, [id, token, retryCount])

  // 4. Fetch public invoice payload
  useEffect(() => {
    if (!resolvedToken) return undefined
    let active = true
    setLoading(true)
    setError('')

    axios.get(`${API_BASE_URL}/public/bill/${resolvedToken}/`)
      .then((res) => {
        if (!active) return
        setData(res.data)
        setLoading(false)
      })
      .catch((err) => {
        if (!active) return
        setError(err.response?.data?.detail || 'This digital bill was not found or the link has expired.')
        setLoading(false)
      })
    return () => { active = false }
  }, [resolvedToken, retryCount])

  const getBillUrl = () => {
    return data?.invoice?.short_url || window.location.href
  }

  // Copy verification link to clipboard
  const handleCopyLink = async () => {
    const billUrl = getBillUrl()
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(billUrl)
      } else {
        const input = document.createElement('textarea')
        input.value = billUrl
        input.setAttribute('readonly', '')
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.appendChild(input)
        input.select()
        document.execCommand('copy')
        input.remove()
      }
      setCopiedLink(true)
      toast.success('Invoice verification link copied')
      setTimeout(() => setCopiedLink(false), 2200)
    } catch {
      toast.error('Could not copy link')
    }
  }

  // Copy UPI ID to clipboard
  const handleCopyUpi = async (upiId) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(upiId)
      }
      setCopiedUpi(true)
      toast.success(`UPI ID copied: ${upiId}`)
      setTimeout(() => setCopiedUpi(false), 2200)
    } catch {
      toast.error('Could not copy UPI ID')
    }
  }

  // Copy Bank Details
  const handleCopyBank = async (bankText) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(bankText)
      }
      setCopiedBank(true)
      toast.success('Bank details copied')
      setTimeout(() => setCopiedBank(false), 2200)
    } catch {
      toast.error('Could not copy bank details')
    }
  }

  // Download official PDF document
  const downloadPdf = async () => {
    try {
      setDownloading(true)
      const response = await axios.get(`${API_BASE_URL}/public/bill/${resolvedToken}/document/`, {
        params: { printer: 'a4', download: '1' },
        responseType: 'blob',
      })
      if (!response.data || response.data.size === 0) {
        throw new Error('The invoice document was empty.')
      }
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `Invoice-${data.invoice.invoice_number || 'bill'}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1500)
      toast.success('Invoice PDF downloaded')
    } catch (err) {
      console.error('Invoice PDF download failed:', err)
      toast.error('Could not download invoice PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  // Print invoice directly
  const printBill = async () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      window.print()
      return
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/public/bill/${resolvedToken}/document/`, {
        params: { printer: 'a4', download: '0' },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      printWindow.location.href = url
      setTimeout(() => {
        try {
          printWindow.focus()
          printWindow.print()
        } catch {
          /* PDF viewer controls printing */
        }
      }, 2000)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      printWindow.close()
      console.error('PDF print failed, using browser print:', err)
      window.print()
    }
  }

  // Share via WhatsApp
  const shareWhatsApp = () => {
    if (!data?.invoice) return
    const billUrl = getBillUrl()
    const shop = data.business?.name || data.settings?.shop_name || 'Store'
    const invNum = data.invoice.invoice_number || ''
    const grandTotal = currency(data.invoice.grand_total || 0)
    const isSettled = String(data.invoice.payment_status || '').toLowerCase() === 'paid'
    const dueAmt = Number(data.invoice.balance_due || 0)

    const text = `🧾 *Tax Invoice #${invNum}*\nStore: *${shop}*\nAmount: *${grandTotal}* (${isSettled ? 'Paid in Full ✓' : `Balance Due: ${currency(dueAmt)}`})\n\nView official verified digital bill:\n${billUrl}`
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  if (loading) return <InvoiceLoadingSkeleton />

  const retryLoad = () => {
    setLoading(true)
    setError('')
    setRetryCount(count => count + 1)
  }

  // Error State
  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <section role="alert" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 sm:p-9 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <IconAlertCircle size={28} strokeWidth={2} />
          </div>
          <h1 className="mt-5 text-lg font-bold tracking-tight">Invoice Unavailable</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            This digital bill was not found or the link may have expired. Please verify the URL or contact the store.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={retryLoad}
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-[#1E3A5F] px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#162F4D] active:scale-[0.98]"
            >
              <IconRefresh size={14} />
              <span>Try again</span>
            </button>
          </div>
        </section>
      </main>
    )
  }

  const { invoice: inv, business: businessData, settings: settingsData } = data
  const biz = businessData || {}
  const s = settingsData || {}
  const items = Array.isArray(inv?.items) ? inv.items : []
  const payments = Array.isArray(inv?.payments) ? inv.payments : []
  const shopName = biz.name || s.shop_name || 'Store'
  const companyLogo = s.shop_logo || biz.logo || ''
  const customerName = inv.customer_name || 'Walk-in Customer'
  const total = Number(inv.grand_total || 0)
  const subtotal = Number(inv.subtotal || 0)
  const discount = Number(inv.discount_amount || 0)
  const tax = Number(inv.tax_amount || 0)
  const roundOff = Number(inv.round_off || 0)
  const paid = Number(inv.paid_amount || 0)
  const due = Math.max(0, Number(inv.balance_due ?? Math.max(0, total - paid)))
  const isCancelled = String(inv.status || '').toLowerCase() === 'cancelled'
  const isPaid = String(inv.payment_status || '').toLowerCase() === 'paid' || (total > 0 && due <= 0.005)
  const verificationUrl = getBillUrl()

  // Calculate half-tax for CGST/SGST display
  const halfTax = tax > 0 ? (tax / 2) : 0

  // Dynamic UPI Payment Link (NPCI Standard)
  const upiId = s.shop_upi_id || ''
  const upiPayLink = useMemo(() => {
    if (!upiId || due <= 0 || isCancelled) return ''
    const cleanShop = encodeURIComponent(shopName.slice(0, 30))
    const cleanNote = encodeURIComponent(`Invoice ${inv.invoice_number || ''}`.slice(0, 30))
    return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${cleanShop}&am=${due.toFixed(2)}&cu=INR&tn=${cleanNote}`
  }, [upiId, due, isCancelled, shopName, inv.invoice_number])

  const bankAccount = s.shop_bank_account || ''
  const bankIfsc = s.shop_bank_ifsc || ''
  const bankName = s.shop_bank_name || ''

  return (
    <div className="min-h-screen bg-slate-50/70 pb-24 font-sans text-slate-800 antialiased sm:pb-16 dark:bg-slate-950 dark:text-slate-100">
      
      {/* ============================================================
          TOP ACTIONS HEADER BAR (Minimalist & Functional)
      ============================================================ */}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          
          {/* Left: Brand Identity */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1E3A5F] text-xs font-bold text-white shadow-2xs">
              {shopName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-bold text-slate-900 dark:text-white">
                  {shopName}
                </span>
                <span className="hidden sm:inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <IconShieldCheck size={11} /> Verified
                </span>
              </div>
              <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                #{inv.invoice_number || '—'}
              </p>
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={shareWhatsApp}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition active:scale-95 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              title="Share invoice on WhatsApp"
            >
              <IconBrandWhatsapp size={15} className="text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={printBill}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-95 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              title="Print Invoice"
            >
              <IconPrinter size={15} />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              type="button"
              onClick={downloadPdf}
              disabled={downloading}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#1E3A5F] px-3.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#162F4D] active:scale-95 disabled:opacity-60 dark:bg-sky-700 dark:hover:bg-sky-600"
              title="Download official PDF invoice"
            >
              <IconDownload size={14} />
              <span>{downloading ? 'Downloading…' : 'PDF'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================
          MAIN INVOICE CONTAINER
      ============================================================ */}
      <main className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
        
        {/* The White Invoice Sheet */}
        <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          
          {/* Top Status Banner */}
          <div className={`px-5 py-2.5 border-b flex items-center justify-between gap-3 text-xs font-bold ${
            isCancelled
              ? 'bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50'
              : isPaid
                ? 'bg-emerald-50/90 text-emerald-900 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
                : 'bg-amber-50/90 text-amber-900 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50'
          }`}>
            <div className="flex items-center gap-1.5">
              {isCancelled ? (
                <>
                  <IconCircleX size={16} className="text-rose-600" />
                  <span>Invoice Cancelled</span>
                </>
              ) : isPaid ? (
                <>
                  <IconCircleCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Payment Confirmed • Paid in Full</span>
                </>
              ) : (
                <>
                  <IconAlertCircle size={16} className="text-amber-600" />
                  <span>Payment Status: Pending • Balance Due: {currency(due)}</span>
                </>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 font-normal">
              <IconShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span>Authentic Tax Invoice</span>
            </div>
          </div>

          {/* Header Section: Store Identity & Invoice Info Box */}
          <header className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
              
              {/* Left: Merchant Profile */}
              <div className="space-y-1.5 max-w-sm">
                {companyLogo && (
                  <img
                    src={companyLogo}
                    alt={`${shopName} logo`}
                    className="h-10 max-w-[160px] object-contain object-left mb-2"
                  />
                )}
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {shopName}
                </h1>
                
                {biz.gstin && (
                  <p className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    GSTIN: <span className="text-slate-900 dark:text-white">{biz.gstin}</span>
                  </p>
                )}

                {biz.pan && (
                  <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    PAN: {biz.pan}
                  </p>
                )}

                {biz.address && (
                  <p className="whitespace-pre-line text-xs text-slate-500 leading-relaxed dark:text-slate-400 pt-0.5">
                    {biz.address}
                  </p>
                )}

                {/* Quick Contact Links */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400 pt-1.5">
                  {biz.mobile && (
                    <a
                      href={`tel:${String(biz.mobile).replace(/[^+\d]/g, '')}`}
                      className="inline-flex items-center gap-1 hover:text-[#1E3A5F] hover:underline dark:hover:text-sky-400"
                    >
                      <IconPhone size={12} className="text-[#1E3A5F] dark:text-sky-400" />
                      <span>{biz.mobile}</span>
                    </a>
                  )}
                  {biz.email && (
                    <a
                      href={`mailto:${biz.email}`}
                      className="inline-flex items-center gap-1 hover:text-[#1E3A5F] hover:underline dark:hover:text-sky-400 break-all"
                    >
                      <IconMail size={12} className="text-[#1E3A5F] dark:text-sky-400" />
                      <span>{biz.email}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Right: Tax Invoice Details Box */}
              <div className="sm:text-right bg-slate-50/80 p-3.5 sm:p-4 rounded-xl border border-slate-200/70 dark:bg-slate-800/50 dark:border-slate-700/60 sm:min-w-[200px]">
                <span className="inline-block rounded bg-[#1E3A5F]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1E3A5F] dark:bg-sky-950/60 dark:text-sky-300">
                  Tax Invoice
                </span>
                <p className="mt-1 font-mono text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  #{inv.invoice_number || '—'}
                </p>
                <div className="mt-2.5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <p>
                    <span className="text-slate-400">Date: </span>
                    <strong className="font-semibold">{formatDate(inv.created_at)}</strong>
                  </p>
                  {formatTime(inv.created_at) && (
                    <p>
                      <span className="text-slate-400">Time: </span>
                      <strong className="font-semibold">{formatTime(inv.created_at)}</strong>
                    </p>
                  )}
                  <p>
                    <span className="text-slate-400">Payment: </span>
                    <strong className="capitalize font-semibold">{inv.payment_method || 'Cash'}</strong>
                  </p>
                </div>
              </div>

            </div>
          </header>

          {/* Customer & Transaction Meta Row */}
          <section className="px-6 py-3.5 sm:px-8 bg-slate-50/50 border-b border-slate-100 dark:bg-slate-800/30 dark:border-slate-800 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Billed To
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {customerName}
                  </span>
                  {inv.customer_phone && (
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      • Ph: {inv.customer_phone}
                    </span>
                  )}
                  {inv.customer_gstin && (
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      • GSTIN: {inv.customer_gstin}
                    </span>
                  )}
                </div>
                {inv.customer_address && (
                  <p className="mt-0.5 text-slate-500 dark:text-slate-400 leading-normal">
                    {inv.customer_address}
                  </p>
                )}
              </div>

              <div className="sm:text-right">
                <InvoiceStatusBadge cancelled={isCancelled} paid={isPaid} due={due} total={total} />
              </div>
            </div>
          </section>

          {/* Line Items Breakdown */}
          <section className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Itemized Breakdown
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Desktop Table */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
              <table className="w-full text-xs text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400 select-none">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">Item Description</th>
                    <th className="py-2.5 px-3 w-24 text-center">HSN/SAC</th>
                    <th className="py-2.5 px-3 w-16 text-right">Qty</th>
                    <th className="py-2.5 px-3 w-24 text-right">Rate</th>
                    {tax > 0 && <th className="py-2.5 px-3 w-20 text-right">GST %</th>}
                    <th className="py-2.5 px-3 w-28 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.length ? (
                    items.map((item, index) => (
                      <tr key={item.id || index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                          <span>{item.product_name || item.name || 'Item'}</span>
                          {Number(item.discount_amount) > 0 && (
                            <span className="block text-[10px] font-normal text-emerald-700 dark:text-emerald-400">
                              Discount −{currency(item.discount_amount)}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {item.hsn_code || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-800 dark:text-slate-200">
                          {item.quantity ?? 0}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {currency(item.unit_price)}
                        </td>
                        {tax > 0 && (
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                            {Number(item.gst_percent || 0) > 0 ? `${item.gst_percent}%` : '0%'}
                          </td>
                        )}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {currency(item.total)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={tax > 0 ? 7 : 6} className="py-6 text-center text-xs text-slate-400">
                        No line items recorded for this invoice.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
              {items.length ? (
                items.map((item, index) => (
                  <div key={item.id || index} className="p-3 space-y-1 bg-white dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs">
                        {item.product_name || item.name || 'Item'}
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs shrink-0">
                        {currency(item.total)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono">
                        {item.quantity ?? 0} × {currency(item.unit_price)}
                      </span>
                      {item.hsn_code && <span>HSN: {item.hsn_code}</span>}
                    </div>
                    {Number(item.discount_amount) > 0 && (
                      <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        Discount: −{currency(item.discount_amount)}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="p-4 text-center text-xs text-slate-400">
                  No line items recorded for this bill.
                </p>
              )}
            </div>

            {/* Financial Summary Calculation Block */}
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-start gap-6 pt-5 border-t border-slate-100 dark:border-slate-800">
              
              {/* Left Notes & Customer Message */}
              <div className="text-xs text-slate-500 space-y-3 max-w-sm">
                {inv.notes && (
                  <div className="rounded-lg bg-slate-50 p-3 border border-slate-200/60 dark:bg-slate-800/40 dark:border-slate-700/50">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block mb-1">
                      Note from Store
                    </span>
                    <p className="italic text-slate-700 dark:text-slate-300">"{inv.notes}"</p>
                  </div>
                )}

                {/* Mini Payment Log (if recorded) */}
                {payments.length > 0 && (
                  <div>
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block mb-1">
                      Payment History
                    </span>
                    <div className="space-y-1 font-mono text-[11px]">
                      {payments.map((p) => (
                        <div key={p.id} className="flex justify-between text-slate-600 dark:text-slate-400">
                          <span>{formatDate(p.created_at)} • {p.method}</span>
                          <span className="font-semibold">{currency(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Thank you for your business! Please keep this official digital tax invoice for warranty and records.
                </p>
              </div>

              {/* Right Totals Table */}
              <div className="w-full sm:w-72 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal (Taxable Value)</span>
                  <span className="font-mono">{currency(subtotal)}</span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                    <span>Discount</span>
                    <span className="font-mono">−{currency(discount)}</span>
                  </div>
                )}

                {tax > 0 && (
                  <>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>CGST</span>
                      <span className="font-mono">{currency(halfTax)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>SGST</span>
                      <span className="font-mono">{currency(halfTax)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400 font-medium">
                      <span>Total Tax (GST)</span>
                      <span className="font-mono">{currency(tax)}</span>
                    </div>
                  </>
                )}

                {roundOff !== 0 && (
                  <div className="flex justify-between text-slate-400 text-[11px]">
                    <span>Round Off</span>
                    <span className="font-mono">{currency(roundOff)}</span>
                  </div>
                )}

                {/* Grand Total Box */}
                <div className="pt-2.5 border-t-2 border-[#1E3A5F] dark:border-sky-500 flex items-baseline justify-between">
                  <span className="text-sm font-black uppercase text-[#1E3A5F] dark:text-sky-400">Grand Total</span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-[#1E3A5F] dark:text-sky-300">
                    {currency(total)}
                  </span>
                </div>

                {/* Amount Paid & Due Status */}
                <div className="pt-2 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Amount Paid</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{currency(paid)}</span>
                  </div>
                  {due > 0 ? (
                    <div className="flex justify-between font-bold text-rose-600 dark:text-rose-400 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Outstanding Due</span>
                      <span className="font-mono">{currency(due)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Balance</span>
                      <span>✓ Fully Settled</span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </section>

          {/* ============================================================
              DYNAMIC UPI PAYMENT & BANK DETAILS (When balance due > 0)
          ============================================================ */}
          {due > 0 && !isCancelled && (upiId || bankAccount) && (
            <section className="p-6 sm:p-8 bg-sky-50/40 border-t border-sky-100 dark:bg-sky-950/20 dark:border-sky-900/30">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                
                {upiId && (
                  <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    <div className="rounded-xl border border-sky-200 bg-white p-2.5 shadow-2xs dark:border-sky-800 dark:bg-slate-900 shrink-0">
                      <QRCodeSVG value={upiPayLink} size={92} level="M" />
                    </div>
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-[#1E3A5F] dark:text-sky-300">
                        <IconQrcode size={15} />
                        <span>Pay {currency(due)} via UPI</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Scan with GPay, PhonePe, Paytm, or BHIM.
                      </p>
                      <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyUpi(upiId)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-mono text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                        >
                          {copiedUpi ? <IconCheck size={12} className="text-emerald-600" /> : <IconCopy size={12} />}
                          <span>{upiId}</span>
                        </button>

                        <a
                          href={upiPayLink}
                          className="inline-flex sm:hidden items-center gap-1 rounded-lg bg-[#1E3A5F] px-3 py-1 text-xs font-bold text-white shadow-2xs hover:bg-[#162F4D]"
                        >
                          <span>Open UPI App</span>
                          <IconExternalLink size={12} />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bank Account Details */}
                {bankAccount && (
                  <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 sm:min-w-[200px] space-y-1">
                    <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-white text-[11px]">
                      <IconBuildingBank size={14} className="text-[#1E3A5F] dark:text-sky-400" />
                      <span>Bank Transfer</span>
                    </div>
                    {bankName && <p className="text-[11px] text-slate-500">{bankName}</p>}
                    <p className="font-mono text-[11px]">
                      A/C: <strong>{bankAccount}</strong>
                    </p>
                    {bankIfsc && (
                      <p className="font-mono text-[11px]">
                        IFSC: <strong>{bankIfsc}</strong>
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyBank(`Bank: ${bankName}, A/C: ${bankAccount}, IFSC: ${bankIfsc}`)}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] text-sky-600 hover:underline dark:text-sky-400 font-medium"
                    >
                      {copiedBank ? <IconCheck size={11} className="text-emerald-600" /> : <IconCopy size={11} />}
                      <span>{copiedBank ? 'Copied' : 'Copy Bank Details'}</span>
                    </button>
                  </div>
                )}

              </div>
            </section>
          )}

          {/* ============================================================
              VERIFICATION QR & OFFICIAL FOOTER
          ============================================================ */}
          <footer className="p-6 sm:p-8 bg-slate-50/70 border-t border-slate-100 dark:bg-slate-800/40 dark:border-slate-800 text-xs">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
              
              <div className="flex items-center gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-2xs dark:border-slate-700 shrink-0">
                  <QRCodeSVG value={verificationUrl} size={70} level="M" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-1">
                    <IconShieldCheck size={15} className="text-emerald-600" />
                    <span>Official Invoice Verification QR</span>
                  </h3>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    Scan with any smartphone camera to verify this digital invoice online.
                  </p>
                  <div className="mt-1.5 flex items-center justify-center sm:justify-start gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {copiedLink ? <IconCheck size={11} className="text-emerald-600" /> : <IconCopy size={11} />}
                      <span>{copiedLink ? 'Link Copied' : 'Copy Verification Link'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="sm:text-right text-[11px] text-slate-400 space-y-0.5">
                <p>Computer-generated digital tax invoice.</p>
                <p>Powered by DreamWithTech ERP</p>
              </div>

            </div>

            {/* Terms & Conditions Note (if configured) */}
            {s.invoice_terms && (
              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/50 text-[10px] text-slate-400 text-center sm:text-left leading-relaxed">
                <strong className="text-slate-500 dark:text-slate-300">Terms & Conditions: </strong>
                <span>{s.invoice_terms}</span>
              </div>
            )}
          </footer>

        </article>

      </main>

      {/* ============================================================
          MOBILE STICKY ACTION BAR (Fast Access)
      ============================================================ */}
      <aside
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur-md sm:hidden dark:border-slate-800 dark:bg-slate-900/95 print:hidden"
        aria-label="Mobile invoice actions"
      >
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2.5">
          {due > 0 && upiId && !isCancelled ? (
            <>
              <a
                href={upiPayLink}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white shadow-2xs active:scale-95 hover:bg-emerald-700"
              >
                <IconQrcode size={16} />
                <span>Pay {currency(due)}</span>
              </a>

              <button
                type="button"
                onClick={downloadPdf}
                disabled={downloading}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#1E3A5F] px-3 text-xs font-bold text-white shadow-2xs active:scale-95 disabled:opacity-60 dark:bg-sky-700"
              >
                <IconDownload size={16} />
                <span>{downloading ? 'Downloading…' : 'Download PDF'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={shareWhatsApp}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 shadow-2xs active:scale-95 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <IconBrandWhatsapp size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={downloadPdf}
                disabled={downloading}
                className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#1E3A5F] px-3 text-xs font-bold text-white shadow-2xs active:scale-95 disabled:opacity-60 dark:bg-sky-700"
              >
                <IconDownload size={16} />
                <span>{downloading ? 'Downloading…' : 'Download PDF'}</span>
              </button>
            </>
          )}
        </div>
      </aside>

    </div>
  )
}
