import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Mail,
  MapPin,
  Phone,
  Printer,
  Receipt,
  Share2,
  Check,
  Smartphone,
  ExternalLink,
} from 'lucide-react'

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
   STATUS BADGE
============================================================ */
function StatusBadge({ cancelled, paid }) {
  const label = cancelled ? 'Cancelled' : paid ? 'Paid' : 'Payment pending'
  const styles = cancelled
    ? 'border-rose-300 bg-rose-50 text-rose-700'
    : paid
      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
      : 'border-amber-300 bg-amber-50 text-amber-800'

  return (
    <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md ${styles}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

/* ============================================================
   EXACT A4 TAX INVOICE COMPONENT
============================================================ */
function A4Bill({
  invoice: inv,
  business: biz,
  settings: s,
  settingEnabled,
  showPaymentQr,
  showBillQr,
  bankDetails,
  isPaid,
  isCancelled,
  items,
  total,
  paid,
  due,
  upiPayUrl,
  isHalf = false,
}) {
  const subtotal = Number(inv.subtotal || 0)
  const discount = Number(inv.discount_amount || 0)
  const tax = Number(inv.tax_amount || 0)
  const roundOff = Number(inv.round_off || 0)

  return (
    <article className={`mx-auto w-full ${isHalf ? 'max-w-[580px]' : 'max-w-[820px]'} rounded-xl border border-slate-300 bg-white text-slate-900 shadow-sm print:max-w-none print:border-0 print:rounded-none print:shadow-none`}>
      {/* A4 Header */}
      <header className="border-b-2 border-[#1E3A5F] px-5 py-6 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="min-w-0">
            {settingEnabled('show_business_logo') && (s.shop_logo || biz.logo) && (
              <img
                src={s.shop_logo || biz.logo}
                alt={`${biz.name || 'Business'} logo`}
                className="mb-3 h-12 max-w-[180px] object-contain object-left"
              />
            )}
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1E3A5F]">
              {isCancelled ? 'Cancelled invoice' : 'Tax invoice'}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#1E3A5F] sm:text-3xl">
              {biz.name || s.shop_name || 'Store Invoice'}
            </h1>
            {settingEnabled('show_business_address') && biz.address && (
              <p className="mt-2 max-w-xl whitespace-pre-line text-xs leading-relaxed text-slate-600">
                {biz.address}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              {settingEnabled('show_business_phone') && biz.mobile && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={12} className="text-[#1E3A5F]" />
                  {biz.mobile}
                </span>
              )}
              {settingEnabled('show_business_email') && biz.email && (
                <span className="inline-flex items-center gap-1.5 break-all">
                  <Mail size={12} className="text-[#1E3A5F]" />
                  {biz.email}
                </span>
              )}
              {settingEnabled('show_business_gstin') && biz.gstin && (
                <span className="font-mono text-[11px] font-semibold">
                  GSTIN: {biz.gstin}
                </span>
              )}
            </div>
          </div>

          <div className="sm:min-w-[160px] sm:text-right">
            <StatusBadge cancelled={isCancelled} paid={isPaid} />
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Invoice Number
            </p>
            <p className="mt-1 font-mono text-lg font-black text-slate-900">
              {inv.invoice_number || '—'}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              {formatDate(inv.created_at)}
            </p>
            {formatTime(inv.created_at) && (
              <p className="text-[11px] text-slate-400">
                {formatTime(inv.created_at)}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Bill To & Invoice Info */}
      <section className="grid border-b border-slate-200 sm:grid-cols-2">
        <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r sm:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Bill To</p>
          <p className="mt-1.5 text-sm font-bold text-slate-900">{inv.customer_name || 'Walk-in Customer'}</p>
          {settingEnabled('show_customer_phone') && inv.customer_phone && (
            <p className="mt-1 text-xs text-slate-600">{inv.customer_phone}</p>
          )}
          {settingEnabled('show_customer_address') && inv.customer_address && (
            <p className="mt-1 max-w-md whitespace-pre-line text-xs leading-relaxed text-slate-500">
              {inv.customer_address}
            </p>
          )}
        </div>

        <div className="px-5 py-4 sm:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Transaction Details</p>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-xs">
            <dt className="text-slate-500">Payment Mode</dt>
            <dd className="font-semibold capitalize text-slate-800 sm:text-right">{inv.payment_method || 'Cash'}</dd>
            <dt className="text-slate-500">Payment Status</dt>
            <dd className="font-semibold capitalize text-slate-800 sm:text-right">{inv.payment_status || (isPaid ? 'Paid' : 'Pending')}</dd>
            <dt className="text-slate-500">Invoice Date</dt>
            <dd className="font-semibold text-slate-800 sm:text-right">{formatDate(inv.created_at)}</dd>
          </dl>
        </div>
      </section>

      {/* Line Items Table */}
      <section className="px-5 py-5 sm:px-8">
        <div className="overflow-hidden border border-slate-200 rounded-md">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-[#1E3A5F] text-white">
              <tr className="text-[10px] font-bold uppercase tracking-wide">
                <th className="w-[8%] px-3 py-2.5 text-center">#</th>
                <th className="w-[44%] px-3 py-2.5">Item</th>
                <th className="w-[14%] px-3 py-2.5 text-right">Qty</th>
                <th className="w-[16%] px-3 py-2.5 text-right">Rate</th>
                <th className="w-[18%] px-3 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length ? (
                items.map((item, index) => (
                  <tr key={item.id || index} className="align-top text-xs text-slate-800 even:bg-slate-50/50">
                    <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400">
                      {String(index + 1).padStart(2, '0')}
                    </td>
                    <td className="px-3 py-2.5 font-semibold">
                      <span className="block break-words">{item.product_name || item.name || 'Item'}</span>
                      {item.hsn_code && (
                        <span className="mt-0.5 block font-mono text-[9px] font-normal text-slate-400">
                          HSN: {item.hsn_code}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">{item.quantity ?? 0}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap font-mono">{currency(item.unit_price)}</td>
                    <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap font-mono">{currency(item.total)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-3 py-6 text-center text-xs text-slate-500">
                    No line items recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Totals Section */}
      <section className="border-t border-slate-200 px-5 py-5 sm:px-8">
        <div className="grid gap-6 sm:grid-cols-[1fr_280px]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Notes &amp; Details</p>
            <p className="mt-1 text-xs text-slate-600">
              Payment mode: <strong className="uppercase">{inv.payment_method || 'Cash'}</strong>
            </p>
            {settingEnabled('show_notes') && inv.notes && (
              <div className="mt-3 border-l-2 border-slate-300 pl-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Notes</p>
                <p className="mt-0.5 max-w-md whitespace-pre-line text-xs italic text-slate-600">{inv.notes}</p>
              </div>
            )}
          </div>

          <div className="text-xs space-y-1.5">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-mono">{currency(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-emerald-700 font-semibold"><span>Discount</span><span className="font-mono">-{currency(discount)}</span></div>}
            {tax > 0 && <div className="flex justify-between text-slate-600"><span>GST</span><span className="font-mono">{currency(tax)}</span></div>}
            {roundOff !== 0 && <div className="flex justify-between text-slate-500"><span>Round off</span><span className="font-mono">{currency(roundOff)}</span></div>}

            <div className="mt-2 flex items-baseline justify-between border-t-2 border-[#1E3A5F] pt-2 text-sm">
              <span className="font-black uppercase text-[#1E3A5F]">Grand Total</span>
              <span className="text-lg font-black font-mono text-[#1E3A5F]">{currency(total)}</span>
            </div>

            {settingEnabled('show_payment_summary') && (
              <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>Paid Amount</span><span className="font-mono">{currency(paid)}</span></div>
            )}
            {settingEnabled('show_balance_due') && due > 0 && (
              <div className="mt-1 flex justify-between text-xs font-bold text-rose-700"><span>Balance Due</span><span className="font-mono">{currency(due)}</span></div>
            )}
          </div>
        </div>
      </section>

      {/* QR Codes & Bank Details */}
      {(showPaymentQr || showBillQr || (settingEnabled('show_bank_details') && bankDetails)) && (
        <section className="border-t border-slate-200 px-5 py-5 sm:px-8">
          <div className="grid gap-6 sm:grid-cols-[auto_auto_1fr] sm:items-center">
            {showPaymentQr && (
              <div className="text-center">
                <div className="inline-flex border border-slate-200 bg-white p-2 rounded-lg shadow-2xs">
                  <QRCodeSVG value={upiPayUrl} size={96} level="M" />
                </div>
                <p className="mt-1.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">Scan to Pay</p>
                <p className="mt-0.5 max-w-[140px] break-all font-mono text-[9px] text-slate-500">{s.shop_upi_id}</p>
              </div>
            )}

            {showBillQr && (
              <div className="text-center">
                <div className="inline-flex border border-slate-200 bg-white p-2 rounded-lg shadow-2xs">
                  <QRCodeSVG value={inv.short_url} size={96} level="M" />
                </div>
                <p className="mt-1.5 text-[10px] font-black uppercase tracking-wide text-[#1E3A5F]">Scan to View</p>
                <p className="mt-0.5 text-[9px] text-slate-500">Digital bill link</p>
              </div>
            )}

            {settingEnabled('show_bank_details') && bankDetails && (
              <div className="border-l border-slate-200 pl-0 sm:pl-6 text-xs text-slate-600">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Bank Details</p>
                <p className="mt-1 font-mono text-[11px] leading-relaxed whitespace-pre-line">{bankDetails}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* A4 Footer */}
      <footer className="border-t border-slate-200 px-5 py-5 text-center sm:px-8">
        <p className="text-xs sm:text-sm font-bold text-slate-700">
          {s.invoice_footer || 'Thank you for shopping with us! Visit again.'}
        </p>
        {settingEnabled('show_terms') && s.invoice_terms && (
          <p className="mx-auto mt-2 max-w-2xl whitespace-pre-line text-left text-[10px] leading-relaxed text-slate-500 border-t border-slate-100 pt-2">
            {s.invoice_terms}
          </p>
        )}
        <p className="mt-3 text-[9px] text-slate-400">
          Computer-generated tax invoice • {biz.name || s.shop_name || 'Store'}
        </p>
      </footer>
    </article>
  )
}

/* ============================================================
   EXACT 80MM THERMAL RECEIPT COMPONENT
============================================================ */
function ThermalBill({
  invoice: inv,
  business: biz,
  settings: s,
  settingEnabled,
  showPaymentQr,
  showBillQr,
  bankDetails,
  upiPayUrl,
}) {
  const items = Array.isArray(inv.items) ? inv.items : []
  const subtotal = Number(inv.subtotal || 0)
  const discount = Number(inv.discount_amount || 0)
  const tax = Number(inv.tax_amount || 0)
  const roundOff = Number(inv.round_off || 0)
  const total = Number(inv.grand_total || 0)
  const paid = Number(inv.paid_amount || 0)
  const due = Number(inv.balance_due || Math.max(0, total - paid))
  const cancelled = String(inv.status || '').toLowerCase() === 'cancelled'

  return (
    <article className="mx-auto w-full max-w-[80mm] rounded-xl border border-slate-300 bg-white p-3 font-mono text-[10px] text-black shadow-sm print:max-w-[80mm] print:border-0 print:rounded-none print:shadow-none print:p-0">
      <header className="text-center">
        {settingEnabled('show_business_logo') && (s.shop_logo || biz.logo) && (
          <img
            src={s.shop_logo || biz.logo}
            alt=""
            className="mx-auto mb-2 max-h-10 max-w-[120px] object-contain"
          />
        )}
        <h1 className="text-[13px] font-black uppercase tracking-tight">
          {biz.name || s.shop_name || 'Store Invoice'}
        </h1>
        {settingEnabled('show_business_address') && biz.address && (
          <p className="mt-1 whitespace-pre-line text-[8px] leading-tight">
            {biz.address}
          </p>
        )}
        <p className="mt-0.5 text-[8px]">
          {settingEnabled('show_business_phone') && biz.mobile ? `Ph: ${biz.mobile}` : ''}
          {settingEnabled('show_business_phone') && biz.mobile && settingEnabled('show_business_email') && biz.email ? ' | ' : ''}
          {settingEnabled('show_business_email') && biz.email ? biz.email : ''}
        </p>
        {settingEnabled('show_business_gstin') && biz.gstin && (
          <p className="text-[8px] font-bold">GSTIN: {biz.gstin}</p>
        )}
      </header>

      <div className="my-2 border-t border-dashed border-black" />
      <div className="text-center">
        <p className="text-[11px] font-black uppercase">
          {cancelled ? 'CANCELLED INVOICE' : 'TAX INVOICE'}
        </p>
        <p className="font-bold">{inv.invoice_number || '—'}</p>
        <p className="text-[8px]">{formatDate(inv.created_at)} {formatTime(inv.created_at)}</p>
      </div>

      <div className="my-2 border-t border-dashed border-black" />
      <div>
        <p className="font-bold uppercase">Customer: {inv.customer_name || 'Walk-in Customer'}</p>
        {settingEnabled('show_customer_phone') && inv.customer_phone && (
          <p className="text-[8px]">Ph: {inv.customer_phone}</p>
        )}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      {/* Items Table */}
      <table className="w-full table-fixed text-[9px]">
        <thead className="border-b border-black">
          <tr>
            <th className="w-[48%] pb-1 text-left font-bold">ITEM</th>
            <th className="w-[14%] pb-1 text-center font-bold">QTY</th>
            <th className="w-[18%] pb-1 text-right font-bold">RATE</th>
            <th className="w-[20%] pb-1 text-right font-bold">AMT</th>
          </tr>
        </thead>
        <tbody>
          {items.length ? (
            items.map((item, index) => (
              <tr key={item.id || index} className="border-b border-dotted border-black align-top">
                <td className="py-1 pr-1 break-words">
                  {item.product_name || item.name || 'Item'}
                  {item.hsn_code && <small className="block text-[7px]">HSN: {item.hsn_code}</small>}
                </td>
                <td className="py-1 text-center">{item.quantity ?? 0}</td>
                <td className="py-1 text-right">{Number(item.unit_price || 0).toFixed(2)}</td>
                <td className="py-1 text-right font-bold">{Number(item.total || 0).toFixed(2)}</td>
              </tr>
            ))
          ) : (
            <tr><td colSpan="4" className="py-2 text-center">No line items</td></tr>
          )}
        </tbody>
      </table>

      <div className="my-2 border-t border-dashed border-black" />

      {/* Totals */}
      <div className="space-y-0.5 text-[9px]">
        <div className="flex justify-between"><span>SUBTOTAL</span><span>{currency(subtotal)}</span></div>
        {discount > 0 && <div className="flex justify-between"><span>DISCOUNT</span><span>-{currency(discount)}</span></div>}
        {tax > 0 && <div className="flex justify-between"><span>GST</span><span>{currency(tax)}</span></div>}
        {roundOff !== 0 && <div className="flex justify-between"><span>ROUND OFF</span><span>{currency(roundOff)}</span></div>}
        <div className="mt-1 flex justify-between border-t border-black pt-1 text-[11px] font-black">
          <span>GRAND TOTAL</span>
          <span>{currency(total)}</span>
        </div>
        <div className="flex justify-between text-[8px]">
          <span>{String(inv.payment_status || 'PAID').toUpperCase()} ({inv.payment_method || 'CASH'})</span>
          <span>Paid: {currency(paid)}</span>
        </div>
        {due > 0 && <div className="flex justify-between font-bold"><span>DUE</span><span>{currency(due)}</span></div>}
      </div>

      {/* QR Codes */}
      {(showPaymentQr || showBillQr) && (
        <div className="my-3 flex justify-center gap-3 border-t border-dashed border-black pt-3 text-center">
          {showPaymentQr && (
            <div>
              <div className="inline-block border border-black p-1 bg-white">
                <QRCodeSVG value={upiPayUrl} size={80} level="M" />
              </div>
              <p className="mt-1 text-[7px] font-black">SCAN TO PAY</p>
            </div>
          )}
          {showBillQr && (
            <div>
              <div className="inline-block border border-black p-1 bg-white">
                <QRCodeSVG value={inv.short_url} size={80} level="M" />
              </div>
              <p className="mt-1 text-[7px] font-black">SCAN TO VIEW</p>
            </div>
          )}
        </div>
      )}

      {settingEnabled('show_bank_details') && bankDetails && (
        <div className="border-t border-dashed border-black pt-2 text-[7px] leading-tight">
          <p className="font-bold">BANK DETAILS</p>
          <p className="mt-0.5">{bankDetails}</p>
        </div>
      )}

      <footer className="mt-3 border-t border-dashed border-black pt-2 text-center text-[8px]">
        <p className="font-bold">{s.invoice_footer || 'Thank you for shopping with us!'}</p>
        <p className="mt-0.5">Please visit again.</p>
      </footer>
    </article>
  )
}

/* ============================================================
   MAIN PUBLIC BILL CONTAINER
============================================================ */
export default function PublicBill() {
  const { token, id } = useParams()
  const [resolvedToken, setResolvedToken] = useState(token || '')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [selectedPrinter, setSelectedPrinter] = useState('a4')
  const [downloading, setDownloading] = useState(false)

  // 1. Resolve token if accessed via invoice ID
  useEffect(() => {
    let active = true
    if (token) {
      setResolvedToken(token)
      return () => { active = false }
    }
    if (!id) {
      setError('Invalid bill link.')
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
  }, [id, token])

  // 2. Fetch public invoice data
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
  }, [resolvedToken])

  // 3. Printer format preference
  const configuredPrinter = useMemo(() => {
    const settings = data?.settings || {}
    const template = String(settings.invoice_template || '').toLowerCase()
    const printer = String(settings.printer_type || '').toLowerCase()
    if (template.startsWith('thermal') || printer.startsWith('thermal')) return 'thermal'
    if (template === 'half_a4' || template === 'advanced_gst_a5' || printer === 'half_a4' || printer === 'a5') return 'half_a4'
    return 'a4'
  }, [data?.settings])

  useEffect(() => {
    if (data) setSelectedPrinter(configuredPrinter)
  }, [configuredPrinter, data])

  // 4. Copy & Share
  const copyBillLink = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        setCopied(true)
        toast.success('Bill link copied to clipboard')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error('Could not copy link'))
  }

  const shareBill = async () => {
    const billUrl = window.location.href
    const invNumber = data?.invoice?.invoice_number || 'Bill'
    const shopName = data?.business?.name || data?.settings?.shop_name || 'Store'
    const totalAmount = currency(data?.invoice?.grand_total || 0)

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice #${invNumber} from ${shopName}`,
          text: `Digital bill for ${totalAmount} from ${shopName}: ${billUrl}`,
          url: billUrl,
        })
        return
      } catch (err) {
        if (err.name !== 'AbortError') {
          copyBillLink()
        }
        return
      }
    }
    copyBillLink()
  }

  // 5. Fetch PDF & Print exact bill
  const fetchDocument = async (printer, download = false) => {
    const response = await axios.get(`${API_BASE_URL}/public/bill/${resolvedToken}/document/`, {
      params: { printer, download: download ? '1' : '0' },
      responseType: 'blob',
    })
    if (!response.data || response.data.size === 0) {
      throw new Error('The bill document was empty.')
    }
    return URL.createObjectURL(response.data)
  }

  const downloadPdf = async (printer = selectedPrinter) => {
    try {
      setDownloading(true)
      const url = await fetchDocument(printer, true)
      const link = document.createElement('a')
      link.href = url
      link.download = `Invoice-${data.invoice.invoice_number}-${printer}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(`${printer === 'thermal' ? 'Thermal' : 'A4'} PDF downloaded`)
    } catch (err) {
      console.error('Public bill PDF download failed:', err)
      toast.error('Could not generate the bill PDF')
    } finally {
      setDownloading(false)
    }
  }

  const printBill = async (printer = selectedPrinter) => {
    // Open the exact PDF document in print window
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      // Direct browser print fallback
      window.print()
      return
    }

    try {
      const url = await fetchDocument(printer)
      printWindow.location.href = url
      setTimeout(() => {
        try {
          printWindow.focus()
          printWindow.print()
        } catch {
          /* PDF viewer controls printing */
        }
      }, 2000)
      toast.success(`${printer === 'thermal' ? 'Thermal (80mm)' : 'A4'} bill opened for printing`)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      printWindow.close()
      console.error('Public bill PDF print failed, using browser print:', err)
      window.print()
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[#1E3A5F]" />
          <h2 className="text-base font-bold text-slate-900">Loading invoice...</h2>
          <p className="mt-1 text-xs text-slate-500">Retrieving exact bill preview</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-base font-bold text-slate-900">Invoice Unavailable</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">{error || 'Could not locate this digital bill.'}</p>
          <p className="mt-4 text-[11px] text-slate-400">Please contact the store if you need another copy of your invoice.</p>
        </div>
      </div>
    )
  }

  const { invoice: inv, business: biz, settings: s } = data
  const settingEnabled = (key) => String(s?.[key] ?? 'true').toLowerCase() !== 'false'
  const items = Array.isArray(inv.items) ? inv.items : []

  const bankDetails =
    s?.shop_bank_details ||
    [
      s?.shop_bank_name && `Bank: ${s.shop_bank_name}`,
      s?.shop_bank_branch && `Branch: ${s.shop_bank_branch}`,
      s?.shop_bank_account && `A/C: ${s.shop_bank_account}`,
      s?.shop_bank_ifsc && `IFSC: ${s.shop_bank_ifsc}`,
    ].filter(Boolean).join(' | ')

  const isPaid = String(inv.payment_status || '').toLowerCase() === 'paid'
  const isCancelled = String(inv.status || '').toLowerCase() === 'cancelled'
  const total = Number(inv.grand_total || 0)
  const paid = Number(inv.paid_amount || 0)
  const due = Number(inv.balance_due || Math.max(0, total - paid))

  const showPaymentQr = settingEnabled('show_upi_qr_on_invoice') && Boolean(s?.shop_upi_id)
  const showBillQr = settingEnabled('enable_invoice_qr') && Boolean(inv.short_url)

  const upiPayUrl = s?.shop_upi_id
    ? `upi://pay?pa=${encodeURIComponent(s.shop_upi_id)}&pn=${encodeURIComponent(biz?.name || s?.shop_name || '')}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${inv?.invoice_number || ''}`)}`
    : ''

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 antialiased print:min-h-0 print:bg-white print:p-0">
      {/* Dynamic print stylesheet for exact printing */}
      <style>{`
        @media print {
          @page {
            size: ${selectedPrinter === 'thermal' ? '80mm auto' : (selectedPrinter === 'half_a4' ? '148mm 210mm' : 'A4 portrait')};
            margin: ${selectedPrinter === 'thermal' ? '0mm' : (selectedPrinter === 'half_a4' ? '5mm' : '8mm')};
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-hidden, header, aside {
            display: none !important;
          }
        }
      `}</style>

      {/* ============================================================
          STICKY TOP ACTION BAR (Clean, simple, mobile-friendly)
      ============================================================ */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          {/* Brand info */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E3A5F] text-white shadow-xs">
              <Receipt size={16} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-900 sm:text-sm">
                Invoice {inv.invoice_number || '—'}
              </p>
              <p className="text-[10px] text-slate-500">
                {biz.name || s.shop_name || 'Store Invoice'} • {selectedPrinter === 'thermal' ? '80mm Thermal' : (selectedPrinter === 'half_a4' ? 'Half-A4 (A5)' : 'A4 Document')}
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Format Toggle Pill — Strictly two types: Sheet Bill vs Thermal Receipt */}
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold text-slate-600" role="group" aria-label="Bill format">
              <button
                type="button"
                onClick={() => setSelectedPrinter(s?.invoice_template === 'half_a4' || s?.printer_type === 'half_a4' ? 'half_a4' : 'a4')}
                className={`rounded-md px-3 py-1 text-xs transition ${
                  selectedPrinter !== 'thermal'
                    ? 'bg-[#1E3A5F] text-white shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                {s?.invoice_template === 'half_a4' || s?.printer_type === 'half_a4' ? 'Tax Invoice (Half-A4)' : 'Tax Invoice (A4)'}
              </button>

              <button
                type="button"
                onClick={() => setSelectedPrinter('thermal')}
                className={`rounded-md px-3 py-1 text-xs transition ${
                  selectedPrinter === 'thermal'
                    ? 'bg-[#1E3A5F] text-white shadow-xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                {s?.printer_type === 'thermal_58' || s?.invoice_template === 'thermal_58' ? 'Thermal Receipt (58mm)' : 'Thermal Receipt (80mm)'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => printBill(selectedPrinter)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95"
            >
              <Printer size={13} />
              <span>Print {selectedPrinter === 'thermal' ? 'Thermal' : (selectedPrinter === 'A4')}</span>
            </button>

            <button
              type="button"
              onClick={() => downloadPdf(selectedPrinter)}
              disabled={downloading}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1E3A5F] px-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#162F4D] active:scale-95 disabled:opacity-60"
            >
              <Download size={13} />
              <span>{downloading ? 'Downloading…' : 'PDF'}</span>
            </button>

            <button
              type="button"
              onClick={shareBill}
              className="hidden sm:inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95"
            >
              {copied ? <Check size={13} className="text-teal-600" /> : <Share2 size={13} />}
              <span>{copied ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================
          MAIN BILL DISPLAY AREA (Exact A4, Exact Half-A4, or Exact Thermal)
      ============================================================ */}
      <main className="mx-auto max-w-5xl px-2 py-4 sm:px-6 sm:py-6 pb-20 sm:pb-8">
        {/* Format hint for mobile users */}
        {selectedPrinter === 'a4' && (
          <div className="mb-3 block sm:hidden rounded-lg bg-blue-50/80 border border-blue-200/80 p-2 text-center text-[11px] text-blue-900 print:hidden">
            Showing exact <strong>A4 Tax Invoice</strong>. Swipe horizontally to view full table, or tap <strong>Half-A4</strong> or <strong>Thermal</strong> above for a compact receipt.
          </div>
        )}

        {/* Outer scroll wrapper for mobile screens to preserve exact dimensions */}
        <div className="w-full overflow-x-auto overscroll-x-contain py-1">
          {selectedPrinter === 'thermal' ? (
            <ThermalBill
              invoice={inv}
              business={biz}
              settings={s}
              settingEnabled={settingEnabled}
              showPaymentQr={showPaymentQr}
              showBillQr={showBillQr}
              bankDetails={bankDetails}
              upiPayUrl={upiPayUrl}
            />
          ) : (
            <A4Bill
              invoice={inv}
              business={biz}
              settings={s}
              settingEnabled={settingEnabled}
              showPaymentQr={showPaymentQr}
              showBillQr={showBillQr}
              bankDetails={bankDetails}
              isPaid={isPaid}
              isCancelled={isCancelled}
              items={items}
              total={total}
              paid={paid}
              due={due}
              upiPayUrl={upiPayUrl}
              isHalf={selectedPrinter === 'half_a4'}
            />
          )}
        </div>
      </main>

      {/* ============================================================
          FIXED MOBILE BOTTOM ACTION BAR
      ============================================================ */}
      <aside className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 border-t border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-md sm:hidden print:hidden">
        {/* Mobile Format Switcher — Two Types: Sheet vs Thermal */}
        <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setSelectedPrinter(s?.invoice_template === 'half_a4' || s?.printer_type === 'half_a4' ? 'half_a4' : 'a4')}
            className={`rounded px-2.5 py-1 ${selectedPrinter !== 'thermal' ? 'bg-[#1E3A5F] text-white shadow-xs' : 'text-slate-600'}`}
          >
            {s?.invoice_template === 'half_a4' || s?.printer_type === 'half_a4' ? 'Half-A4' : 'A4 Bill'}
          </button>
          <button
            type="button"
            onClick={() => setSelectedPrinter('thermal')}
            className={`rounded px-2.5 py-1 ${selectedPrinter === 'thermal' ? 'bg-[#1E3A5F] text-white shadow-xs' : 'text-slate-600'}`}
          >
            {s?.printer_type === 'thermal_58' || s?.invoice_template === 'thermal_58' ? '58mm Roll' : 'Thermal'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => printBill(selectedPrinter)}
          className="flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 active:scale-95"
        >
          <Printer size={13} />
          <span>Print</span>
        </button>

        <button
          type="button"
          onClick={() => downloadPdf(selectedPrinter)}
          disabled={downloading}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1E3A5F] px-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#162F4D] active:scale-95 disabled:opacity-60"
        >
          <Download size={13} />
          <span>{downloading ? 'Downloading…' : `PDF (${selectedPrinter === 'thermal' ? 'Thermal' : selectedPrinter === 'half_a4' ? 'Half-A4' : 'A4'})`}</span>
        </button>

        <button
          type="button"
          onClick={shareBill}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 active:scale-95"
          title="Share"
        >
          <Share2 size={13} />
        </button>
      </aside>
    </div>
  )
}
