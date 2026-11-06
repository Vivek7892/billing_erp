import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  IconDownload,
  IconPrinter,
  IconRefresh,
  IconAlertCircle,
  IconEye,
} from '@tabler/icons-react'

import invoiceService from '../features/billing/api/invoiceService'
import {
  formatCurrency,
  formatDate,
  formatTime,
} from '../utils/formatters'
import { API_BASE_URL } from '../api'

const currency = (value) => formatCurrency(value)

/* ============================================================
   REALISTIC SAMPLE INVOICE DATA (PREVIEW / DEMO MODE)
============================================================ */
const SAMPLE_INVOICE_DATA = {
  invoice: {
    id: 1001,
    invoice_number: 'INV-2026-001',
    public_token: 'preview-sample',
    short_url: typeof window !== 'undefined' ? window.location.href : '',
    created_at: new Date().toISOString(),
    customer_name: 'Metro Retail Mart',
    customer_phone: '+91 98765 43210',
    customer_address: '42, Mount Road, Guindy, Chennai 600032',
    customer_gstin: '33AABCS1429B1ZP',
    subtotal: 1040.00,
    discount_amount: 52.00,
    tax_amount: 52.00,
    round_off: 0.00,
    grand_total: 1040.00,
    paid_amount: 500.00,
    balance_due: 540.00,
    payment_method: 'UPI',
    payment_status: 'PARTIAL',
    status: 'COMPLETED',
    notes: 'Goods once sold can be exchanged within 7 days with original tax invoice.',
    items: [
      {
        id: 1,
        product_name: 'India Gate Basmati Rice 5kg',
        hsn_code: '100630',
        quantity: 2,
        unit_price: 260.00,
        discount_amount: 26.00,
        gst_percent: 5,
        total: 518.70,
      },
      {
        id: 2,
        product_name: 'Fortune Sunflower Oil 1L Pouch',
        hsn_code: '151219',
        quantity: 3,
        unit_price: 180.00,
        discount_amount: 26.00,
        gst_percent: 5,
        total: 521.30,
      },
    ],
    payments: [
      {
        id: 1,
        created_at: new Date().toISOString(),
        amount: 500.00,
        method: 'UPI',
        reference: 'UPI/9876543210/1001',
      },
    ],
  },
  business: {
    name: 'DreamWithTech Retail Mart',
    owner_name: 'Store Manager',
    mobile: '+91 98765 00000',
    email: 'support@dreamwithtech.dev',
    address: '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    gstin: '29ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    currency: '₹',
    logo: '',
  },
  settings: {
    shop_name: 'DreamWithTech Retail Mart',
    shop_address: '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    shop_phone: '+91 98765 00000',
    shop_email: 'support@dreamwithtech.dev',
    shop_gstin: '29ABCDE1234F1Z5',
    currency: '₹',
    invoice_terms: '1. Goods once sold will be exchanged within 7 days with original invoice.\n2. Warranty claims handled by authorized service centers.',
    invoice_notes: 'Thank you for your business! Visit again.',
  },
}

/* ============================================================
   LOADING SKELETON
============================================================ */
function InvoiceLoadingSkeleton() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-8 bg-white" aria-label="Loading digital invoice" aria-busy="true">
      <div className="animate-pulse space-y-6">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-2">
            <div className="h-6 w-52 bg-neutral-200 rounded" />
            <div className="h-3 w-40 bg-neutral-200 rounded" />
            <div className="h-3 w-32 bg-neutral-200 rounded" />
          </div>
          <div className="space-y-2 text-right">
            <div className="h-5 w-28 bg-neutral-200 rounded ml-auto" />
            <div className="h-3 w-20 bg-neutral-200 rounded ml-auto" />
          </div>
        </div>
        <div className="h-20 bg-neutral-100 rounded" />
        <div className="h-40 bg-neutral-100 rounded" />
      </div>
      <p className="mt-6 text-center text-xs text-neutral-400">Loading tax invoice…</p>
    </main>
  )
}

/* ============================================================
   MAIN COMPONENT: PUBLIC DIGITAL BILL
============================================================ */
export default function PublicBill() {
  const { token, id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isPreview, setIsPreview] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  // Enforce search engine privacy
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

  // Set page title dynamically
  useEffect(() => {
    if (data?.invoice?.invoice_number) {
      const shop = data.business?.name || data.settings?.shop_name || 'Tax Invoice'
      document.title = `Tax Invoice #${data.invoice.invoice_number} • ${shop}`
    }
  }, [data])

  // Fetch invoice payload or load preview
  useEffect(() => {
    let active = true
    const cleanToken = (token || '').trim()
    const cleanId = (id || '').trim()

    const isSampleRequest =
      (!cleanToken && !cleanId) ||
      cleanToken === 'preview' ||
      cleanToken === 'sample' ||
      cleanToken === 'demo' ||
      cleanToken === 'sample-token-1001' ||
      cleanToken === 'test'

    if (isSampleRequest) {
      setData(SAMPLE_INVOICE_DATA)
      setIsPreview(true)
      setLoading(false)
      setError('')
      return () => { active = false }
    }

    setLoading(true)
    setError('')
    setIsPreview(false)

    const fetchPublicBill = async () => {
      try {
        let lookupToken = cleanToken
        const isNumericId = cleanId || (/^\d+$/.test(cleanToken) ? cleanToken : null)

        if (cleanId || (isNumericId && !lookupToken)) {
          const targetId = cleanId || isNumericId
          try {
            const inv = await invoiceService.getInvoice(targetId)
            if (inv?.public_token) {
              lookupToken = inv.public_token
            }
          } catch {
            lookupToken = targetId
          }
        }

        const endpoint = `${API_BASE_URL}/public/bill/${lookupToken || cleanToken || cleanId}/`
        const res = await axios.get(endpoint)
        if (!active) return

        if (res.data && res.data.invoice) {
          setData(res.data)
        } else {
          throw new Error('Invoice data format unrecognized.')
        }
      } catch (err) {
        if (!active) return
        console.error('Failed to load public bill:', err)
        const msg =
          err.response?.data?.detail ||
          err.response?.data?.error ||
          err.message ||
          'This digital bill was not found or the link has expired.'
        setError(msg)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchPublicBill()

    return () => {
      active = false
    }
  }, [id, token, retryCount])

  // Action: Print Invoice
  const printBill = async () => {
    if (isPreview) {
      window.print()
      return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      window.print()
      return
    }

    try {
      const lookupToken = data?.invoice?.public_token || token || id
      const response = await axios.get(`${API_BASE_URL}/public/bill/${lookupToken}/document/`, {
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
      console.error('PDF print failed, triggering browser print:', err)
      window.print()
    }
  }

  // Action: Download PDF
  const downloadPdf = async () => {
    if (isPreview) {
      window.print()
      return
    }

    try {
      setDownloading(true)
      const lookupToken = data?.invoice?.public_token || token || id
      const response = await axios.get(`${API_BASE_URL}/public/bill/${lookupToken}/document/`, {
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
      toast.error('Could not download invoice PDF. Triggering print view instead.')
      window.print()
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return <InvoiceLoadingSkeleton />

  const retryLoad = () => {
    setLoading(true)
    setError('')
    setRetryCount(count => count + 1)
  }

  const loadSamplePreview = () => {
    setData(SAMPLE_INVOICE_DATA)
    setIsPreview(true)
    setError('')
  }

  // Error State with fallback
  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-4 py-12 text-neutral-900">
        <section role="alert" className="w-full max-w-md border border-neutral-300 p-8 text-center bg-white">
          <div className="mx-auto flex h-12 w-12 items-center justify-center text-neutral-700">
            <IconAlertCircle size={32} strokeWidth={1.75} />
          </div>
          <h1 className="mt-4 text-lg font-bold tracking-tight text-neutral-900">Invoice Unavailable</h1>
          <p className="mt-2 text-xs leading-relaxed text-neutral-600">
            {error || 'This digital bill could not be found or the link may have expired.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={retryLoad}
              className="inline-flex items-center gap-1.5 border border-neutral-800 bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800"
            >
              <IconRefresh size={14} />
              <span>Try again</span>
            </button>
            <button
              type="button"
              onClick={loadSamplePreview}
              className="inline-flex items-center gap-1.5 border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition"
            >
              <IconEye size={14} />
              <span>View Sample Bill</span>
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
  const customerName = inv.customer_name || 'Walk-in Customer'
  const total = Number(inv.grand_total || 0)
  const subtotal = Number(inv.subtotal || 0)
  const discount = Number(inv.discount_amount || 0)
  const tax = Number(inv.tax_amount || 0)
  const roundOff = Number(inv.round_off || 0)
  const paid = Number(inv.paid_amount || 0)
  const due = Math.max(0, Number(inv.balance_due ?? Math.max(0, total - paid)))
  const isPaid = String(inv.payment_status || '').toLowerCase() === 'paid' || (total > 0 && due <= 0.005)

  // Determine Payment Status Label
  let paymentStatusLabel = 'Unpaid'
  if (isPaid) {
    paymentStatusLabel = 'Paid in Full'
  } else if (paid > 0 && due > 0) {
    paymentStatusLabel = 'Partially Paid'
  }

  // Inter-state vs Intra-state GST determination
  const bizGstin = (biz.gstin || s.shop_gstin || '').trim().toUpperCase()
  const custGstin = (inv.customer_gstin || '').trim().toUpperCase()
  const isInterState =
    bizGstin.length >= 2 &&
    custGstin.length >= 2 &&
    bizGstin.slice(0, 2) !== custGstin.slice(0, 2)

  const halfTax = tax > 0 ? tax / 2 : 0

  return (
    <div className="min-h-screen bg-[#F3F5F7] font-sans text-[#111827] antialiased print:bg-white sm:py-8" style={{ colorScheme: 'light' }}>
      
      {/* Sample Banner if in preview mode */}
      {isPreview && (
        <div className="bg-[#EAF2FB] text-[#174A7C] text-xs font-semibold text-center py-2 px-4 print:hidden">
          Sample Digital Tax Invoice Preview
        </div>
      )}

      {/* ============================================================
          TOP ACTION CONTROLS (Rectangular, Simple, Print-Hidden)
      ============================================================ */}
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="text-xs text-neutral-600 font-medium">
          Invoice #{inv.invoice_number || '—'}
        </div>

        <div className="flex items-center gap-2">
   

          <button
            type="button"
            onClick={printBill}
            className="inline-flex min-h-10 items-center gap-1.5 border border-neutral-300 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-800 hover:bg-neutral-50 transition active:scale-[0.99]"
            title="Print Invoice"
          >
            <IconPrinter size={15} />
            <span>Print</span>
          </button>

          <button
            type="button"
            onClick={downloadPdf}
            disabled={downloading}
            className="inline-flex min-h-10 items-center gap-1.5 bg-[#1E3A5F] hover:bg-[#162F4D] text-white px-4 py-2 text-xs font-semibold transition active:scale-[0.99] disabled:opacity-60"
            title="Download PDF"
          >
            <IconDownload size={14} />
            <span>{downloading ? 'Downloading…' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* ============================================================
          MAIN INVOICE SHEET (Pure White, Traditional Accounting Standard)
      ============================================================ */}
      <article className="max-w-5xl mx-auto bg-white border-0 sm:border border-[#D9E0E8] p-4 sm:p-8 lg:p-10 text-[#111827] shadow-none sm:shadow-sm print:p-0 print:border-none print:shadow-none print:max-w-none">
        
        {/* HEADER SECTION: Business Details (Left) & Tax Invoice Meta (Right) */}
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 pb-5 sm:pb-6 border-b-2 border-[#1E3A5F]">
          
          {/* Left: Business Credentials */}
          <div className="flex items-start gap-3 max-w-md">
            {(biz.logo || s.shop_logo) && (
              <img src={biz.logo || s.shop_logo} alt={`${shopName} logo`} className="h-14 w-14 shrink-0 object-contain print:h-12 print:w-12" />
            )}
            <div className="space-y-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-neutral-900 uppercase break-words">
                {shopName}
              </h1>
              {biz.address && (
                <p className="whitespace-pre-line text-xs text-neutral-600 leading-relaxed pt-0.5">
                  {biz.address}
                </p>
              )}
              {biz.mobile && (
                <p className="text-xs text-neutral-600">
                  Phone: <span className="text-neutral-900 font-medium">{biz.mobile}</span>
                </p>
              )}
              {biz.email && (
                <p className="text-xs text-neutral-600 break-all">
                  Email: <span className="text-neutral-900">{biz.email}</span>
                </p>
              )}
              {bizGstin && (
                <p className="text-xs font-semibold text-neutral-800 pt-0.5">
                  GSTIN: <span className="font-mono text-neutral-900">{bizGstin}</span>
                </p>
              )}
            </div>
          </div>

          {/* Right: Invoice Metadata */}
          <div className="sm:text-right space-y-1 text-xs sm:min-w-[240px] sm:pl-4">
            <p className="text-base sm:text-lg font-black tracking-wider text-[#1E3A5F] uppercase">
              TAX INVOICE
            </p>
            <p className="text-xs font-bold text-neutral-800">
              Invoice No: <span className="font-mono text-neutral-900">#{inv.invoice_number || '—'}</span>
            </p>
            <p className="text-neutral-600">
              Invoice Date: <span className="font-medium text-neutral-900">{formatDate(inv.created_at)}</span>
            </p>
            {formatTime(inv.created_at) && (
              <p className="text-neutral-600">
                Invoice Time: <span className="font-medium text-neutral-900">{formatTime(inv.created_at)}</span>
              </p>
            )}
            <p className="text-neutral-600">
              Payment Method: <span className="font-medium uppercase text-neutral-900">{inv.payment_method || 'Cash'}</span>
            </p>
            <p className="text-neutral-600">
              Payment Status:{' '}
              <span className={`inline-flex items-center border px-2 py-0.5 text-[10px] uppercase tracking-wide ${isPaid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : due > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-neutral-200 bg-neutral-50 text-neutral-700'}`}>
                {paymentStatusLabel}
              </span>
            </p>
          </div>

        </header>

        {/* CUSTOMER DETAILS: BILL TO */}
        <section className="grid gap-4 py-5 border-b border-neutral-200 text-xs sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1E3A5F] mb-1.5">
            BILL TO
          </p>
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-neutral-900">
              {customerName}
            </p>
            {inv.customer_phone && (
              <p className="text-neutral-600">
                Phone: <span className="font-mono text-neutral-900">{inv.customer_phone}</span>
              </p>
            )}
            {inv.customer_address && (
              <p className="text-neutral-600 leading-normal">
                Address: <span className="text-neutral-900">{inv.customer_address}</span>
              </p>
            )}
            {custGstin && (
              <p className="text-neutral-700 font-semibold pt-0.5">
                GSTIN: <span className="font-mono text-neutral-900">{custGstin}</span>
              </p>
            )}
          </div>
          </div>
          {!isPaid && due > 0 && (
            <div className="border-l-2 border-amber-400 bg-amber-50 px-3 py-2 sm:min-w-44">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Balance due</p>
              <p className="mt-0.5 font-mono text-base font-bold text-amber-900">{currency(due)}</p>
            </div>
          )}
        </section>

        {/* ITEMIZED INVOICE TABLE */}
        <section className="py-5 sm:py-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-y border-neutral-300 bg-[#F3F6FA] text-[10px] font-bold uppercase tracking-wider text-neutral-700">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 w-24 text-center">HSN/SAC</th>
                  <th className="py-2.5 px-3 w-16 text-right">Qty</th>
                  <th className="py-2.5 px-3 w-24 text-right">Rate</th>
                  <th className="py-2.5 px-3 w-20 text-right">GST %</th>
                  <th className="py-2.5 px-3 w-28 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {items.length ? (
                  items.map((item, index) => (
                    <tr key={item.id || index} className="align-top even:bg-[#FAFBFC]">
                      <td className="py-3 px-3 text-center text-neutral-500 font-mono">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3 font-medium text-neutral-900">
                        <span>{item.product_name || item.name || 'Item'}</span>
                        {Number(item.discount_amount) > 0 && (
                          <span className="block text-[11px] text-neutral-500 font-normal">
                            Discount: −{currency(item.discount_amount)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-neutral-600">
                        {item.hsn_code || '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-neutral-800">
                        {item.quantity ?? 0}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-neutral-700">
                        {currency(item.unit_price)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-neutral-600">
                        {Number(item.gst_percent || 0) > 0 ? `${item.gst_percent}%` : '0%'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-neutral-900">
                        {currency(item.total)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-6 text-center text-neutral-500">
                      No line items recorded for this invoice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* PAYMENT DETAILS & INVOICE SUMMARY */}
        <section className="pt-4 pb-6 border-t border-neutral-300">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 sm:gap-8">
            
            {/* Left: Notes & Terms */}
            <div className="text-xs text-neutral-600 space-y-3 max-w-sm">
              {inv.notes && (
                <div>
                  <p className="font-bold uppercase tracking-wider text-[10px] text-neutral-500 mb-0.5">
                    Notes
                  </p>
                  <p className="text-neutral-800 leading-relaxed">{inv.notes}</p>
                </div>
              )}

              {s.invoice_terms && (
                <div>
                  <p className="font-bold uppercase tracking-wider text-[10px] text-neutral-500 mb-0.5">
                    Terms &amp; Conditions
                  </p>
                  <p className="whitespace-pre-line text-neutral-600 leading-relaxed">{s.invoice_terms}</p>
                </div>
              )}
            </div>

            {/* Right: Accounting Summary Table */}
            <div className="w-full sm:w-[340px] space-y-2 text-xs">
              <div className="flex justify-between text-neutral-700">
                <span>Subtotal / Taxable Value</span>
                <span className="font-mono text-neutral-900 font-medium">{currency(subtotal)}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>Discount</span>
                  <span className="font-mono text-neutral-900 font-medium">−{currency(discount)}</span>
                </div>
              )}

              {tax > 0 && (
                isInterState ? (
                  <div className="flex justify-between text-neutral-700">
                    <span>IGST</span>
                    <span className="font-mono text-neutral-900 font-medium">{currency(tax)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-neutral-600 text-[11px]">
                      <span>CGST</span>
                      <span className="font-mono text-neutral-900 font-medium">{currency(halfTax)}</span>
                    </div>
                    <div className="flex justify-between text-neutral-600 text-[11px]">
                      <span>SGST</span>
                      <span className="font-mono text-neutral-900 font-medium">{currency(halfTax)}</span>
                    </div>
                  </>
                )
              )}

              {roundOff !== 0 && (
                <div className="flex justify-between text-neutral-600 text-[11px]">
                  <span>Round Off</span>
                  <span className="font-mono text-neutral-900 font-medium">{currency(roundOff)}</span>
                </div>
              )}

              {/* GRAND TOTAL (Prominent Bold Typography) */}
              <div className="py-3 my-2 border-y-2 border-[#1E3A5F] flex justify-between items-baseline">
                <span className="text-sm font-black uppercase tracking-wider text-[#1E3A5F]">
                  GRAND TOTAL
                </span>
                <span className="text-xl sm:text-2xl font-black font-mono text-neutral-900">
                  {currency(total)}
                </span>
              </div>

              {/* Amount Paid & Balance Due */}
              <div className="space-y-1.5 pt-1 text-[11px]">
                <div className="flex justify-between text-neutral-600">
                  <span>Amount Paid</span>
                  <span className="font-mono text-neutral-900 font-semibold">{currency(paid)}</span>
                </div>

                {due > 0 ? (
                  <div className="flex justify-between font-bold text-amber-900 text-xs pt-2 border-t border-neutral-200">
                    <span>Balance Due</span>
                    <span className="font-mono text-neutral-900">{currency(due)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between font-bold text-emerald-800 text-xs pt-1 border-t border-neutral-200">
                    <span>Balance</span>
                    <span>Paid in Full</span>
                  </div>
                )}
              </div>

            </div>

          </div>
        </section>

        {/* PAYMENT HISTORY (Only if payment records exist) */}
        {payments.length > 0 && (
          <section className="pt-4 pb-6 border-t border-neutral-200 text-xs">
            <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-2">
              Payment History
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 bg-[#F8FAFC] text-neutral-600 text-[10px] uppercase tracking-wide">
                    <th className="py-1.5 pr-4 font-semibold">Date</th>
                    <th className="py-1.5 pr-4 font-semibold">Method</th>
                    <th className="py-1.5 pr-4 font-semibold">Reference</th>
                    <th className="py-1.5 text-right font-semibold">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-mono">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-1.5 pr-4 text-neutral-700">{formatDate(p.created_at)}</td>
                      <td className="py-1.5 pr-4 uppercase text-neutral-700">{p.method}</td>
                      <td className="py-1.5 pr-4 text-neutral-500">{p.reference || '—'}</td>
                      <td className="py-1.5 text-right font-bold text-neutral-900">{currency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* COMPANY BRANDING: BOTTOM OF INVOICE */}
        <footer className="mt-8 sm:mt-12 pt-5 sm:pt-6 border-t border-neutral-200 text-center">
          <p className="text-[11px] text-neutral-500 font-medium tracking-wide">
            Powered by DreamWithTech
          </p>
        </footer>

      </article>

    </div>
  )
}
