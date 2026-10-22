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
  IconShare,
  IconCheck,
  IconCircleX,
  IconExternalLink,
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
   STATUS BADGE
============================================================ */
function StatusBadge({ cancelled, paid }) {
  const label = cancelled ? 'Cancelled' : paid ? 'Paid' : 'Payment pending'
  const styles = cancelled
    ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300'
    : paid
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
  const Icon = cancelled ? IconCircleX : paid ? IconCircleCheck : IconAlertCircle

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold tracking-wide ${styles}`}>
      <Icon size={14} aria-hidden="true" />
      {label}
    </span>
  )
}

function InvoiceLoadingState() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6" aria-label="Loading digital invoice" aria-busy="true">
      <div className="animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 sm:p-7">
        <div className="flex items-center gap-3"><div className="h-12 w-12 rounded-xl bg-[var(--surface-elevated)]" /><div className="flex-1 space-y-2"><div className="h-4 w-40 rounded bg-[var(--surface-elevated)]" /><div className="h-3 w-28 rounded bg-[var(--surface-elevated)]" /></div><div className="h-7 w-24 rounded-full bg-[var(--surface-elevated)]" /></div>
        <div className="mt-8 h-3 w-28 rounded bg-[var(--surface-elevated)]" /><div className="mt-3 h-8 w-48 max-w-full rounded bg-[var(--surface-elevated)]" /><div className="mt-3 h-12 w-56 max-w-full rounded bg-[var(--surface-elevated)]" />
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map(key => <div key={key} className="h-16 rounded-xl bg-[var(--surface-elevated)]" />)}</div>
      </div>
      <div className="animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"><div className="h-4 w-24 rounded bg-[var(--surface-elevated)]" /><div className="mt-5 space-y-3">{[0, 1, 2].map(key => <div key={key} className="h-12 rounded-lg bg-[var(--surface-elevated)]" />)}</div></div>
      <p className="text-center text-sm text-[var(--muted)]">Loading your digital bill…</p>
    </main>
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
                  <IconPhone size={12} className="text-[#1E3A5F]" />
                  {biz.mobile}
                </span>
              )}
              {settingEnabled('show_business_email') && biz.email && (
                <span className="inline-flex items-center gap-1.5 break-all">
                  <IconMail size={12} className="text-[#1E3A5F]" />
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
          <table className="table w-full table-fixed text-left text-xs">
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
  const [retryCount, setRetryCount] = useState(0)

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
  }, [id, token, retryCount])

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
  }, [resolvedToken, retryCount])

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
const copyBillLink = async () => {
  const billUrl = inv.short_url || window.location.href
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
      const copied = document.execCommand('copy')
      input.remove()
      if (!copied) throw new Error('Copy unavailable')
    }
    setCopied(true)
    toast.success('Bill link copied')
    setTimeout(() => setCopied(false), 2200)
  } catch {
    toast.error('Could not copy bill link')
  }
}

const shareBill = async () => {
  const billUrl = inv.short_url || window.location.href
  const invNumber = data?.invoice?.invoice_number || 'Bill'
  const shopName = data?.business?.name || data?.settings?.shop_name || 'Store'
  const totalAmount = currency(data?.invoice?.grand_total || 0)

  if (navigator.share) {
    try {
      await navigator.share({
        title: `Invoice #${invNumber} from ${shopName}`,
        text: `Digital bill for ${totalAmount} from ${shopName}`,
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

  if (loading) return <InvoiceLoadingState />

  const retryLoad = () => {
    setLoading(true)
    setError('')
    setRetryCount(count => count + 1)
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-10 text-[var(--ink)]">
        <section role="alert" className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"><IconAlertCircle size={26} aria-hidden="true" /></div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Digital invoice</p>
          <h1 className="mt-2 text-xl font-bold">Invoice unavailable</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">This digital bill could not be found or the link may have expired.</p>
          <p className="mt-3 text-sm text-[var(--ink-secondary)]">Please contact the store if you need another copy.</p>
          <button type="button" onClick={retryLoad} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-5 text-sm font-semibold text-white hover:bg-[#162F4D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F] dark:bg-sky-700 dark:hover:bg-sky-600"><IconRefresh size={16} aria-hidden="true" />Try again</button>
        </section>
      </main>
    )
  }

  const { invoice: inv, business: businessData, settings: settingsData } = data
  const biz = businessData || {}
  const s = settingsData || {}
  const settingEnabled = key => String(s?.[key] ?? 'true').toLowerCase() !== 'false'
  const items = Array.isArray(inv?.items) ? inv.items : []
  const shopName = biz.name || s.shop_name || 'Store'
  const companyLogo = settingEnabled('show_business_logo') ? (s.shop_logo || biz.logo) : ''
  const companyWebsite = String(s.shop_website || biz.website || '').trim()
  const websiteHref = companyWebsite
    ? (/^https?:\/\//i.test(companyWebsite) ? companyWebsite : `https://${companyWebsite}`)
    : ''
  const contactHref = settingEnabled('show_business_phone') && biz.mobile
    ? `tel:${String(biz.mobile).replace(/[^+\d]/g, '')}`
    : settingEnabled('show_business_email') && biz.email
      ? `mailto:${biz.email}`
      : ''
  const customerName = inv.customer_name || 'Walk-in Customer'
  const total = Number(inv.grand_total || 0)
  const paid = Number(inv.paid_amount || 0)
  const due = Math.max(0, Number(inv.balance_due ?? Math.max(0, total - paid)))
  const isCancelled = String(inv.status || '').toLowerCase() === 'cancelled'
  const isPaid = String(inv.payment_status || '').toLowerCase() === 'paid' || (total > 0 && due <= 0.005)
  const showPaymentQr = !isCancelled && due > 0 && settingEnabled('show_upi_qr_on_invoice') && Boolean(s.shop_upi_id)
  const showBillQr = settingEnabled('enable_invoice_qr') && Boolean(inv.short_url)
  const bankDetails = s.shop_bank_details || [
    s.shop_bank_name && `Bank: ${s.shop_bank_name}`,
    s.shop_bank_branch && `Branch: ${s.shop_bank_branch}`,
    s.shop_bank_account && `A/C: ${s.shop_bank_account}`,
    s.shop_bank_ifsc && `IFSC: ${s.shop_bank_ifsc}`,
  ].filter(Boolean).join(' · ')
  const upiPayUrl = s.shop_upi_id
    ? `upi://pay?pa=${encodeURIComponent(s.shop_upi_id)}&pn=${encodeURIComponent(shopName)}&am=${due.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Invoice ${inv.invoice_number || ''}`)}`
    : ''
  const printProps = { invoice: inv, business: biz, settings: s, settingEnabled, showPaymentQr, showBillQr, bankDetails, upiPayUrl }
  const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#162F4D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F] active:scale-[.98] disabled:cursor-wait disabled:opacity-60 dark:bg-sky-700 dark:hover:bg-sky-600'
  const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F] active:scale-[.98]'
  const desktopPrimaryButton = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[#1E3A5F] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#162F4D] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F] disabled:cursor-wait disabled:opacity-60 dark:bg-sky-700 dark:hover:bg-sky-600'
  const desktopSecondaryButton = 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink)] transition hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]'

  return (
    <div className="relative isolate min-h-screen bg-[var(--app-bg)] pb-24 font-sans text-[var(--ink)] antialiased sm:pb-10 print:bg-white print:p-0">
      <style>{`@media print { @page { size: ${selectedPrinter === 'thermal' ? '80mm auto' : selectedPrinter === 'half_a4' ? '148mm 210mm' : 'A4 portrait'}; margin: ${selectedPrinter === 'thermal' ? '0mm' : selectedPrinter === 'half_a4' ? '5mm' : '8mm'}; } body { background: white !important; color: black !important; } .public-screen { display: none !important; } .print-invoice { display: block !important; } }`}</style>

      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden print:hidden">
        {companyLogo
          ? <img src={companyLogo} alt="" className="max-h-[52vh] max-w-[72vw] object-contain opacity-[0.04] grayscale" />
          : <span className="max-w-[90vw] rotate-[-22deg] break-words text-center text-[clamp(3rem,10vw,8rem)] font-black leading-none text-[var(--muted)] opacity-[0.04]">{shopName}</span>}
      </div>

      <div className="public-screen relative z-10">
        <header className="border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
            {companyLogo && <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)]"><img src={companyLogo} alt={`${shopName} logo`} className="h-full w-full object-contain p-1.5" /></div>}
            <div className="min-w-0 flex-1"><p className="truncate text-base font-bold sm:text-lg">{shopName}</p><p className="text-xs text-[var(--muted)]">Digital invoice · Issued by {shopName}</p></div>
            <div className="hidden sm:block"><StatusBadge cancelled={isCancelled} paid={isPaid} /></div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl space-y-4 px-3 py-4 sm:space-y-5 sm:px-6 sm:py-7">
          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]/90 shadow-sm" aria-labelledby="invoice-summary-title">
            <div className="border-b border-[var(--line-subtle)] px-4 py-5 sm:px-7 sm:py-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Invoice <span className="font-mono tracking-normal">#{inv.invoice_number || '—'}</span></p><h1 id="invoice-summary-title" className="mt-2 break-words text-xl font-bold tracking-tight sm:text-2xl">Digital bill from {shopName}</h1><p className="mt-1.5 text-sm text-[var(--muted)]">{formatDate(inv.created_at)}{formatTime(inv.created_at) ? ` · ${formatTime(inv.created_at)}` : ''}</p></div>
                <div className="sm:hidden"><StatusBadge cancelled={isCancelled} paid={isPaid} /></div>
              </div>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Grand total</p>
              <p className="mt-1 break-all font-mono text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{currency(total)}</p>
              {isCancelled ? <p className="mt-3 text-sm font-semibold text-rose-700 dark:text-rose-300">This invoice has been cancelled.</p> : due > 0 ? <div className="mt-4 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm dark:border-amber-900 dark:bg-amber-950/40"><span className="font-semibold text-amber-900 dark:text-amber-200">Balance due</span><span className="font-mono text-lg font-bold text-amber-950 dark:text-amber-100">{currency(due)}</span></div> : <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300"><IconCircleCheck size={16} aria-hidden="true" />Paid in full</p>}
              <div className="mt-5 hidden flex-wrap justify-end gap-2 border-t border-[var(--line-subtle)] pt-4 sm:flex">
                <button type="button" onClick={shareBill} className={desktopSecondaryButton}>{copied ? <IconCheck size={14} /> : <IconShare size={14} />}{copied ? 'Link copied' : 'Share bill'}</button>
                <button type="button" onClick={() => printBill(selectedPrinter)} className={desktopSecondaryButton}><IconPrinter size={14} />Print</button>
                <button type="button" onClick={() => downloadPdf(selectedPrinter)} disabled={downloading} className={desktopPrimaryButton}><IconDownload size={14} />{downloading ? 'Preparing PDF…' : 'Download PDF'}</button>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px bg-[var(--line-subtle)] sm:grid-cols-4">
              <div className="min-w-0 bg-[var(--surface)] px-4 py-3.5"><dt className="text-xs text-[var(--muted)]">Billed to</dt><dd className="mt-1 truncate text-sm font-semibold" title={customerName}>{customerName}</dd></div>
              <div className="min-w-0 bg-[var(--surface)] px-4 py-3.5"><dt className="text-xs text-[var(--muted)]">Payment</dt><dd className="mt-1 truncate text-sm font-semibold capitalize">{inv.payment_method || 'Not specified'}</dd></div>
              <div className="min-w-0 bg-[var(--surface)] px-4 py-3.5"><dt className="text-xs text-[var(--muted)]">Items</dt><dd className="mt-1 text-sm font-semibold">{items.length} {items.length === 1 ? 'item' : 'items'}</dd></div>
              {Number(inv.tax_amount) > 0 && <div className="min-w-0 bg-[var(--surface)] px-4 py-3.5"><dt className="text-xs text-[var(--muted)]">GST / tax</dt><dd className="mt-1 truncate font-mono text-sm font-semibold">{currency(inv.tax_amount)}</dd></div>}
            </dl>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/90 p-4 sm:p-5"><h2 className="text-sm font-bold">Bill to</h2><p className="mt-2 text-sm font-semibold">{customerName}</p>{settingEnabled('show_customer_phone') && inv.customer_phone && <a className="mt-1.5 inline-flex min-h-8 items-center gap-2 text-sm text-[var(--primary)] hover:underline" href={`tel:${String(inv.customer_phone).replace(/[^+\d]/g, '')}`}><IconPhone size={14} aria-hidden="true" />{inv.customer_phone}</a>}{settingEnabled('show_customer_address') && inv.customer_address && <p className="mt-1.5 flex gap-2 whitespace-pre-line text-sm leading-relaxed text-[var(--ink-secondary)]"><IconMapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{inv.customer_address}</p>}</div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)]/90 p-4 sm:p-5"><h2 className="text-sm font-bold">Payment summary</h2><dl className="mt-3 space-y-2.5 text-sm"><div className="flex items-start justify-between gap-3"><dt className="text-[var(--muted)]">Method</dt><dd className="text-right font-semibold capitalize">{inv.payment_method || 'Not specified'}</dd></div><div className="flex items-start justify-between gap-3"><dt className="text-[var(--muted)]">Status</dt><dd className="text-right font-semibold">{isCancelled ? 'Cancelled' : isPaid ? 'Paid' : due < total ? 'Partially paid' : 'Payment pending'}</dd></div><div className="flex items-start justify-between gap-3"><dt className="text-[var(--muted)]">Amount paid</dt><dd className="font-mono font-semibold">{currency(paid)}</dd></div><div className="flex items-start justify-between gap-3 border-t border-[var(--line-subtle)] pt-2.5"><dt className="font-semibold">{due > 0 ? 'Balance due' : 'Remaining balance'}</dt><dd className={`font-mono font-bold ${due > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{currency(due)}</dd></div></dl></div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]" aria-labelledby="purchased-items-title">
            <div className="border-b border-[var(--line-subtle)] px-4 py-4 sm:px-5"><h2 id="purchased-items-title" className="text-sm font-bold">Purchased items</h2><p className="mt-0.5 text-xs text-[var(--muted)]">{items.length} {items.length === 1 ? 'item' : 'items'} on this invoice</p></div>
            {items.length ? <div className="divide-y divide-[var(--line-subtle)]">{items.map((item, index) => <article key={item.id || index} className="flex min-w-0 items-start justify-between gap-3 px-4 py-3.5 sm:px-5"><div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold">{item.product_name || item.name || 'Item'}</h3><p className="mt-1 text-xs text-[var(--muted)]"><span className="font-mono">{item.quantity ?? 0} × {currency(item.unit_price)}</span>{item.hsn_code && <span className="ml-2">HSN {item.hsn_code}</span>}</p>{Number(item.discount_amount) > 0 && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Item discount −{currency(item.discount_amount)}</p>}</div><p className="shrink-0 pt-0.5 text-right font-mono text-sm font-bold tabular-nums">{currency(item.total)}</p></article>)}</div> : <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">No line items were recorded for this bill.</p>}
          </section>

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5" aria-label="Invoice totals"><div className="ml-auto w-full max-w-sm space-y-2.5 text-sm"><div className="flex justify-between gap-4 text-[var(--ink-secondary)]"><span>Subtotal</span><span className="font-mono tabular-nums">{currency(inv.subtotal)}</span></div>{Number(inv.discount_amount) > 0 && <div className="flex justify-between gap-4 text-emerald-700 dark:text-emerald-300"><span>Discount</span><span className="font-mono tabular-nums">−{currency(inv.discount_amount)}</span></div>}{Number(inv.tax_amount) > 0 && <div className="flex justify-between gap-4 text-[var(--ink-secondary)]"><span>GST / tax</span><span className="font-mono tabular-nums">{currency(inv.tax_amount)}</span></div>}{Number(inv.round_off) !== 0 && <div className="flex justify-between gap-4 text-[var(--muted)]"><span>Round off</span><span className="font-mono tabular-nums">{currency(inv.round_off)}</span></div>}<div className="flex items-center justify-between gap-4 border-t-2 border-[var(--line)] pt-3 text-base font-bold"><span>Total</span><span className="font-mono text-xl tabular-nums">{currency(total)}</span></div><div className="flex justify-between gap-4 text-[var(--ink-secondary)]"><span>Paid</span><span className="font-mono tabular-nums">{currency(paid)}</span></div><div className={`flex justify-between gap-4 font-bold ${due > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}`}><span>{due > 0 ? 'Balance due' : 'Paid in full'}</span><span className="font-mono tabular-nums">{currency(due)}</span></div></div></section>

          {(showPaymentQr || showBillQr || (settingEnabled('show_bank_details') && bankDetails)) && <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5" aria-label="Payment and invoice options"><h2 className="text-sm font-bold">Payment and bill details</h2><div className="mt-4 grid gap-5 sm:grid-cols-[auto_auto_1fr] sm:items-center">{showPaymentQr && <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:text-center"><div className="rounded-xl border border-[var(--line)] bg-white p-2"><QRCodeSVG value={upiPayUrl} size={88} level="M" /></div><div><p className="text-sm font-bold">Scan to pay</p><p className="mt-0.5 break-all text-xs text-[var(--muted)]">{s.shop_upi_id}</p></div></div>}{showBillQr && <div className="flex items-center gap-3 sm:flex-col sm:items-center sm:text-center"><div className="rounded-xl border border-[var(--line)] bg-white p-2"><QRCodeSVG value={inv.short_url} size={88} level="M" /></div><div><p className="text-sm font-bold">Scan to view</p><p className="mt-0.5 text-xs text-[var(--muted)]">Digital bill link</p></div></div>}{settingEnabled('show_bank_details') && bankDetails && <div className="min-w-0 border-t border-[var(--line-subtle)] pt-4 text-sm sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"><p className="font-semibold">Bank details</p><p className="mt-1 whitespace-pre-line break-words font-mono text-xs leading-relaxed text-[var(--ink-secondary)]">{bankDetails}</p></div>}</div></section>}

          {settingEnabled('show_notes') && inv.notes && <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5"><h2 className="text-sm font-bold">Note from {shopName}</h2><p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-[var(--ink-secondary)]">{inv.notes}</p></section>}

          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5" aria-label="Business contact information"><h2 className="text-sm font-bold">Questions about this bill?</h2><p className="mt-1 text-sm text-[var(--muted)]">Contact {shopName} if you need help.</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">{settingEnabled('show_business_phone') && biz.mobile && <a href={`tel:${String(biz.mobile).replace(/[^+\d]/g, '')}`} className="inline-flex min-h-8 items-center gap-2 font-medium text-[var(--primary)] hover:underline"><IconPhone size={15} aria-hidden="true" />{biz.mobile}</a>}{settingEnabled('show_business_email') && biz.email && <a href={`mailto:${biz.email}`} className="inline-flex min-h-8 min-w-0 items-center gap-2 break-all font-medium text-[var(--primary)] hover:underline"><IconMail size={15} className="shrink-0" aria-hidden="true" />{biz.email}</a>}{settingEnabled('show_business_address') && biz.address && <p className="flex w-full gap-2 whitespace-pre-line text-[var(--ink-secondary)]"><IconMapPin size={15} className="mt-0.5 shrink-0" aria-hidden="true" />{biz.address}</p>}</div>{settingEnabled('show_business_gstin') && biz.gstin && <p className="mt-3 text-xs text-[var(--muted)]">GSTIN <span className="font-mono font-medium text-[var(--ink-secondary)]">{biz.gstin}</span></p>}</section>

          {settingEnabled('show_terms') && s.invoice_terms && <details className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm"><summary className="cursor-pointer font-semibold">Terms and conditions</summary><p className="mt-3 whitespace-pre-line text-xs leading-relaxed text-[var(--ink-secondary)]">{s.invoice_terms}</p></details>}
        
          <footer className="px-2 pb-2 pt-1 text-center">{s.invoice_footer && <p className="text-sm font-semibold text-[var(--ink-secondary)]">{s.invoice_footer}</p>}<p className="mt-2 text-xs text-[var(--muted)]">This is a digital copy of your invoice.</p></footer>
          <details className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm print:hidden"><summary className="cursor-pointer font-semibold text-[var(--ink-secondary)]">More options · Receipt format</summary><label className="mt-3 flex flex-col gap-1.5 text-xs font-medium text-[var(--muted)]">Choose a PDF or print format<select value={selectedPrinter} onChange={event => setSelectedPrinter(event.target.value)} className="min-h-11 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F]"><option value="a4">Full page invoice (A4)</option><option value="half_a4">Compact invoice (A5)</option><option value="thermal">Receipt</option></select></label></details>
        </main>

        <aside className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[var(--surface)]/95 p-2 pb-[max(.5rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur sm:hidden print:hidden" aria-label="Invoice actions"><div className="mx-auto grid max-w-3xl grid-cols-3 gap-2"><button type="button" onClick={shareBill} className={`${secondaryButton} min-w-0 px-1.5 text-xs`} aria-label={copied ? 'Bill link copied' : 'Share invoice'}>{copied ? <IconCheck size={16} /> : <IconShare size={16} />}<span>{copied ? 'Copied' : 'Share'}</span></button><button type="button" onClick={() => printBill(selectedPrinter)} className={`${secondaryButton} min-w-0 px-1.5 text-xs`}><IconPrinter size={16} aria-hidden="true" />Print</button><button type="button" onClick={() => downloadPdf(selectedPrinter)} disabled={downloading} className={`${primaryButton} min-w-0 px-1.5 text-xs`}><IconDownload size={16} aria-hidden="true" />{downloading ? 'Preparing…' : 'Download'}</button></div></aside>
      </div>

      <div className="print-invoice hidden">{selectedPrinter === 'thermal' ? <ThermalBill {...printProps} /> : <A4Bill {...printProps} isPaid={isPaid} isCancelled={isCancelled} items={items} total={total} paid={paid} due={due} isHalf={selectedPrinter === 'half_a4'} />}</div>
    </div>
  )
}
