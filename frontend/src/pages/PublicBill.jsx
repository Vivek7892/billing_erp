import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'
import {
  IconAlertCircle,
  IconCircleCheck,
  IconDownload,
  IconMail,
  IconMapPin,
  IconPhone,
  IconPrinter,
  IconRefresh,
  IconCheck,
  IconCircleX,
  IconCopy,
  IconFileText,
  IconShieldCheck,
} from '@tabler/icons-react'

import invoiceService from '../features/billing/api/invoiceService'
import { API_BASE_URL } from '../api'

const currency = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const formatDate = (value) => {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return String(value)
  }
}

const formatTime = (value) => {
  if (!value) return ''
  try {
    return new Date(value).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

/* ============================================================
   CUSTOMER PAYMENT STATUS BADGE
============================================================ */
function PaymentStatusBadge({ cancelled, paid, due, total }) {
  if (cancelled) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 shadow-2xs">
        <IconCircleX size={15} aria-hidden="true" />
        <span>Cancelled</span>
      </span>
    )
  }

  if (paid || (total > 0 && due <= 0.005)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 shadow-2xs">
        <IconCircleCheck size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span>✓ Paid in Full</span>
      </span>
    )
  }

  if (due > 0 && due < total) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 shadow-2xs">
        <IconAlertCircle size={15} className="text-amber-600" aria-hidden="true" />
        <span>Partially Paid</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50 px-3.5 py-1.5 text-xs font-bold text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-300 shadow-2xs">
      <IconAlertCircle size={15} className="text-orange-600" aria-hidden="true" />
      <span>Payment Pending</span>
    </span>
  )
}

function InvoiceLoadingState() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl space-y-4 px-4 py-12" aria-label="Loading digital invoice" aria-busy="true">
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 space-y-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800" />
            <div className="space-y-2">
              <div className="h-5 w-44 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-3.5 w-28 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
          <div className="h-8 w-32 rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800" />
        <div className="space-y-3">
          <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
      <p className="text-center text-sm font-medium text-slate-500">Preparing your official digital invoice…</p>
    </main>
  )
}

/* ============================================================
   MAIN CUSTOMER-FACING DIGITAL INVOICE
============================================================ */
export default function PublicBill() {
  const { token, id } = useParams()
  const [resolvedToken, setResolvedToken] = useState(token || '')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
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
      document.title = `Invoice #${data.invoice.invoice_number} • ${shop}`
    }
  }, [data])

  // 3. Resolve public token if accessed by ID
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

  // 4. Fetch public invoice data
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

  const copyBillLink = async () => {
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
        const res = document.execCommand('copy')
        input.remove()
        if (!res) throw new Error('Copy unavailable')
      }
      setCopied(true)
      toast.success('Invoice verification link copied')
      setTimeout(() => setCopied(false), 2200)
    } catch {
      toast.error('Could not copy link')
    }
  }

  // 5. Download official PDF document
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
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('Invoice PDF downloaded')
    } catch (err) {
      console.error('Invoice PDF download failed:', err)
      toast.error('Could not download invoice PDF. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  // 6. Print invoice directly
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

  if (loading) return <InvoiceLoadingState />

  const retryLoad = () => {
    setLoading(true)
    setError('')
    setRetryCount(count => count + 1)
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <section role="alert" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 sm:p-9 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <IconAlertCircle size={28} strokeWidth={2} />
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight">Invoice Unavailable</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            This digital bill could not be found or the link may have expired. Please verify the URL or contact the store.
          </p>
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={retryLoad}
              className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#162F4D] active:scale-[0.98] dark:bg-sky-700 dark:hover:bg-sky-600"
            >
              <IconRefresh size={15} />
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
  const verificationUrl = inv.short_url || window.location.href

  return (
    <div className="min-h-screen bg-slate-100/70 pb-24 font-sans text-slate-900 antialiased sm:pb-16 dark:bg-slate-950 dark:text-slate-100">
      
      {/* ============================================================
          TOP ACTIONS HEADER BAR (Clean & Customer-Facing)
      ============================================================ */}
      <header className="border-b border-slate-200/80 bg-white/90 sticky top-0 z-20 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 print:hidden">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E3A5F] text-xs font-black text-white">
              {shopName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {shopName}
              </p>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Invoice #{inv.invoice_number || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={printBill}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition active:scale-95 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Print Invoice"
            >
              <IconPrinter size={15} />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              type="button"
              onClick={downloadPdf}
              disabled={downloading}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-[#1E3A5F] px-4 text-xs font-bold text-white shadow-2xs transition hover:bg-[#162F4D] active:scale-95 disabled:opacity-60 dark:bg-sky-700 dark:hover:bg-sky-600"
              title="Download Invoice PDF"
            >
              <IconDownload size={15} />
              <span>{downloading ? 'Downloading…' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================
          MAIN INVOICE CARD CONTAINER (Professional Digital Invoice)
      ============================================================ */}
      <main className="mx-auto max-w-4xl px-3 py-6 sm:px-6 sm:py-8">
        
        {/* The White Invoice Sheet */}
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900">
          
          {/* Status Ribbon / Top Notification Bar */}
          <div className={`px-5 py-3 border-b flex items-center justify-between gap-3 text-xs font-bold ${
            isCancelled
              ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50'
              : isPaid
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
                : 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50'
          }`}>
            <div className="flex items-center gap-2">
              {isCancelled ? (
                <>
                  <IconCircleX size={17} className="text-rose-600" />
                  <span>Invoice Cancelled</span>
                </>
              ) : isPaid ? (
                <>
                  <IconCircleCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <span>✓ Payment Received • Paid in Full</span>
                </>
              ) : (
                <>
                  <IconAlertCircle size={17} className="text-amber-600" />
                  <span>Payment Status: Pending • Balance Due: {currency(due)}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              <IconShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span>Verified Customer Bill</span>
            </div>
          </div>

          {/* Invoice Header Section: Store Branding & Invoice Metadata */}
          <header className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
              
              {/* Left: Store Branding */}
              <div className="space-y-2 max-w-md">
                {companyLogo && (
                  <img
                    src={companyLogo}
                    alt={`${shopName} logo`}
                    className="h-12 max-w-[180px] object-contain object-left mb-2"
                  />
                )}
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {shopName}
                </h1>
                {biz.gstin && (
                  <p className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                    GSTIN: <span className="text-slate-900 dark:text-white">{biz.gstin}</span>
                  </p>
                )}
                {biz.address && (
                  <p className="whitespace-pre-line text-xs text-slate-500 leading-relaxed dark:text-slate-400">
                    {biz.address}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 pt-1">
                  {biz.mobile && (
                    <span className="inline-flex items-center gap-1.5">
                      <IconPhone size={13} className="text-[#1E3A5F] dark:text-sky-400" />
                      <a href={`tel:${String(biz.mobile).replace(/[^+\d]/g, '')}`} className="hover:underline">{biz.mobile}</a>
                    </span>
                  )}
                  {biz.email && (
                    <span className="inline-flex items-center gap-1.5 break-all">
                      <IconMail size={13} className="text-[#1E3A5F] dark:text-sky-400" />
                      <a href={`mailto:${biz.email}`} className="hover:underline">{biz.email}</a>
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Invoice Number & Date Box */}
              <div className="sm:text-right bg-slate-50 p-4 rounded-xl border border-slate-200/60 dark:bg-slate-800/60 dark:border-slate-700/60 sm:min-w-[220px]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tax Invoice
                </p>
                <p className="mt-1 font-mono text-lg font-black text-slate-900 dark:text-white">
                  #{inv.invoice_number || '—'}
                </p>
                <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <p>
                    <span className="text-slate-500 dark:text-slate-400">Date: </span>
                    <strong className="font-semibold">{formatDate(inv.created_at)}</strong>
                  </p>
                  {formatTime(inv.created_at) && (
                    <p>
                      <span className="text-slate-500 dark:text-slate-400">Time: </span>
                      <strong className="font-semibold">{formatTime(inv.created_at)}</strong>
                    </p>
                  )}
                  <p>
                    <span className="text-slate-500 dark:text-slate-400">Payment: </span>
                    <strong className="capitalize font-semibold">{inv.payment_method || 'Cash'}</strong>
                  </p>
                </div>
              </div>

            </div>
          </header>

          {/* Customer & Transaction Meta Row */}
          <section className="px-6 py-4 sm:px-8 bg-slate-50/60 border-b border-slate-100 dark:bg-slate-800/30 dark:border-slate-800 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Billed To
                </p>
                <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                  {customerName}
                </p>
                {inv.customer_phone && (
                  <p className="mt-0.5 font-mono text-slate-600 dark:text-slate-400">
                    Ph: {inv.customer_phone}
                  </p>
                )}
                {inv.customer_address && (
                  <p className="mt-0.5 whitespace-pre-line text-slate-500 leading-relaxed dark:text-slate-400">
                    {inv.customer_address}
                  </p>
                )}
              </div>

              <div className="sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Payment Status
                </p>
                <div className="mt-1.5 sm:flex sm:justify-end">
                  <PaymentStatusBadge cancelled={isCancelled} paid={isPaid} due={due} total={total} />
                </div>
              </div>
            </div>
          </section>

          {/* Line Items Table */}
          <section className="p-6 sm:p-8">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Itemized Breakdown
            </h2>

            {/* Desktop & Tablet Table View */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs text-left" style={{ minWidth: '600px' }}>
                <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400 select-none">
                  <tr>
                    <th className="py-2.5 px-4 w-12 text-center">#</th>
                    <th className="py-2.5 px-4">Item Description</th>
                    <th className="py-2.5 px-4 w-28 text-center">HSN/SAC</th>
                    <th className="py-2.5 px-4 w-20 text-right">Qty</th>
                    <th className="py-2.5 px-4 w-28 text-right">Rate</th>
                    <th className="py-2.5 px-4 w-32 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.length ? (
                    items.map((item, index) => (
                      <tr key={item.id || index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition">
                        <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-400">
                          {String(index + 1).padStart(2, '0')}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          <span className="block">{item.product_name || item.name || 'Item'}</span>
                          {Number(item.discount_amount) > 0 && (
                            <span className="text-[10px] font-normal text-emerald-700 dark:text-emerald-400">
                              Discount −{currency(item.discount_amount)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {item.hsn_code || '—'}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-800 dark:text-slate-200">
                          {item.quantity ?? 0}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                          {currency(item.unit_price)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {currency(item.total)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-xs text-slate-500">
                        No line items recorded for this invoice.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards View (Single Column for Small Screens) */}
            <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {items.length ? (
                items.map((item, index) => (
                  <div key={item.id || index} className="p-3.5 space-y-1 bg-white dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                        {item.product_name || item.name || 'Item'}
                      </div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-sm shrink-0">
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
                <p className="p-6 text-center text-xs text-slate-500">
                  No line items recorded for this bill.
                </p>
              )}
            </div>

            {/* Financial Summary & Totals Block */}
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-start gap-6 pt-6 border-t border-slate-100 dark:border-slate-800">
              
              {/* Left Note / Customer Acknowledgement */}
              <div className="text-xs text-slate-500 space-y-2 max-w-sm">
                {inv.notes && (
                  <div>
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400">Note from Store</span>
                    <p className="mt-1 italic text-slate-700 dark:text-slate-300">"{inv.notes}"</p>
                  </div>
                )}
                <p className="text-[11px] text-slate-400 pt-1">
                  Thank you for your business! Please keep this digital receipt for your reference.
                </p>
              </div>

              {/* Right Totals Table */}
              <div className="w-full sm:w-72 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-mono">{currency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-semibold">
                    <span>Discount</span>
                    <span className="font-mono">−{currency(discount)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>GST / Taxes</span>
                    <span className="font-mono">{currency(tax)}</span>
                  </div>
                )}
                {roundOff !== 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Round Off</span>
                    <span className="font-mono">{currency(roundOff)}</span>
                  </div>
                )}

                {/* Grand Total Box */}
                <div className="pt-2 border-t-2 border-[#1E3A5F] dark:border-sky-500 flex items-baseline justify-between">
                  <span className="text-sm font-black uppercase text-[#1E3A5F] dark:text-sky-400">Grand Total</span>
                  <span className="text-2xl font-black font-mono text-[#1E3A5F] dark:text-sky-300">
                    {currency(total)}
                  </span>
                </div>

                {/* Amount Paid & Due Status */}
                <div className="pt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between text-slate-500 dark:text-slate-400">
                    <span>Amount Paid</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{currency(paid)}</span>
                  </div>
                  {due > 0 ? (
                    <div className="flex justify-between font-bold text-rose-600 dark:text-rose-400 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>Outstanding Balance</span>
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

          {/* Digital Verification & Authenticity QR Section */}
          <footer className="p-6 sm:p-8 bg-slate-50/70 border-t border-slate-100 dark:bg-slate-800/40 dark:border-slate-800 text-xs">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-5 text-center sm:text-left">
              
              <div className="flex items-center gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-2xs dark:border-slate-700 shrink-0">
                  <QRCodeSVG value={verificationUrl} size={76} level="M" />
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
                      onClick={copyBillLink}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {copied ? <IconCheck size={11} className="text-emerald-600" /> : <IconCopy size={11} />}
                      <span>{copied ? 'Link Copied' : 'Copy Verification Link'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="sm:text-right text-[11px] text-slate-400">
                <p>Computer-generated digital tax invoice.</p>
                <p>Powered by {shopName}</p>
              </div>

            </div>
          </footer>

        </article>

      </main>

      {/* ============================================================
          MOBILE STICKY ACTION BAR (Clean 2-Button Floating Sheet)
      ============================================================ */}
      <aside
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur-md sm:hidden dark:border-slate-800 dark:bg-slate-900/95 print:hidden"
        aria-label="Mobile invoice actions"
      >
        <div className="mx-auto grid max-w-md grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={printBill}
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-800 shadow-2xs active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <IconPrinter size={16} />
            <span>Print Invoice</span>
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
        </div>
      </aside>

    </div>
  )
}
