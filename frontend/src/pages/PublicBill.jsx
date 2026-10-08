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

} from 'lucide-react'



import invoiceService from '../features/billing/api/invoiceService'

import { API_BASE_URL } from '../api'



const currency = value =>

  `₹${Number(value || 0).toLocaleString('en-IN', {

    minimumFractionDigits: 2,

    maximumFractionDigits: 2,

  })}`



const formatDate = value => {

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



const formatTime = value => {

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




function StatusBadge({ cancelled, paid }) {
  const label = cancelled ? 'Cancelled' : paid ? 'Paid' : 'Payment pending'
  const styles = cancelled
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : paid
      ? 'border-teal-200 bg-teal-50 text-teal-700'
      : 'border-amber-200 bg-amber-50 text-amber-700'

  return (
    <span className={`inline-flex items-center gap-2 border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${styles}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}

function BillActions({ selectedPrinter, setSelectedPrinter, downloadPdf, printBill, copyBillLink, copied, invoiceNumber }) {
  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-3 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-[#1E3A5F] text-white">
            <Receipt size={17} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">Invoice {invoiceNumber || '—'}</p>
            <p className="text-[11px] text-slate-500">
              Digital bill • {selectedPrinter === 'thermal' ? '80 mm thermal' : 'A4'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-slate-300 bg-white" role="group" aria-label="Bill format">
            {[['a4', 'A4'], ['thermal', 'Thermal 80mm']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedPrinter(value)}
                aria-pressed={selectedPrinter === value}
                className={`px-3 py-2 text-[11px] font-bold transition ${
                  selectedPrinter === value
                    ? 'bg-[#1E3A5F] text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button type="button" onClick={() => downloadPdf(selectedPrinter)}
            className="inline-flex items-center gap-1.5 border border-[#1E3A5F] bg-[#1E3A5F] px-3 py-2 text-[11px] font-bold text-white transition hover:bg-[#162F4D]">
            <Download size={14} /> Download
          </button>

          <button type="button" onClick={() => printBill(selectedPrinter)}
            className="inline-flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50">
            <Printer size={14} /> Print
          </button>

          <button type="button" onClick={copyBillLink} aria-label="Copy bill link"
            className="inline-flex items-center gap-1.5 border border-slate-300 bg-white px-3 py-2 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50">
            {copied ? <CheckCircle2 size={14} className="text-teal-600" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy link'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function InvoiceInfo({ invoice: inv, settingEnabled }) {
  return (
    <section className="grid border-b border-slate-200 sm:grid-cols-2">
      <div className="border-b border-slate-200 px-5 py-5 sm:border-b-0 sm:border-r sm:px-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Bill to</p>
        <p className="mt-2 text-sm font-bold text-slate-900">{inv.customer_name || 'Walk-in Customer'}</p>
        {settingEnabled('show_customer_phone') && inv.customer_phone && (
          <p className="mt-1 text-xs text-slate-600">{inv.customer_phone}</p>
        )}
        {settingEnabled('show_customer_address') && inv.customer_address && (
          <p className="mt-1 max-w-md whitespace-pre-line text-xs leading-relaxed text-slate-500">{inv.customer_address}</p>
        )}
      </div>

      <div className="px-5 py-5 sm:px-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Invoice details</p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-xs">
          <dt className="text-slate-500">Invoice no.</dt>
          <dd className="font-mono font-bold text-slate-900 sm:text-right">{inv.invoice_number || '—'}</dd>
          <dt className="text-slate-500">Date</dt>
          <dd className="font-semibold text-slate-800 sm:text-right">{formatDate(inv.created_at)}</dd>
          <dt className="text-slate-500">Time</dt>
          <dd className="text-slate-700 sm:text-right">{formatTime(inv.created_at) || '—'}</dd>
          <dt className="text-slate-500">Payment</dt>
          <dd className="font-semibold capitalize text-slate-800 sm:text-right">{inv.payment_method || 'Cash'}</dd>
        </dl>
      </div>
    </section>
  )
}

function InvoiceItems({ items }) {
  return (
    <section className="px-4 py-5 sm:px-8">
      <div className="overflow-hidden border border-slate-200">
        <table className="w-full table-fixed text-left">
          <thead className="bg-[#1E3A5F] text-white">
            <tr className="text-[10px] font-bold uppercase tracking-wide">
              <th className="w-[7%] px-2 py-3 text-center">#</th>
              <th className="w-[43%] px-2 py-3 sm:w-[49%]">Item</th>
              <th className="w-[15%] px-2 py-3 text-right">Qty</th>
              <th className="w-[17%] px-2 py-3 text-right">Rate</th>
              <th className="w-[18%] px-2 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.length ? items.map((item, index) => (
              <tr key={item.id || index} className="align-top text-xs text-slate-800 even:bg-slate-50/50">
                <td className="px-2 py-3 text-center font-mono text-[10px] text-slate-400">{String(index + 1).padStart(2, '0')}</td>
                <td className="px-2 py-3 font-semibold">
                  <span className="block break-words">{item.product_name || item.name || 'Item'}</span>
                  {item.hsn_code && <span className="mt-1 block font-mono text-[9px] font-normal text-slate-400">HSN: {item.hsn_code}</span>}
                </td>
                <td className="px-2 py-3 text-right whitespace-nowrap">{item.quantity ?? 0}</td>
                <td className="px-2 py-3 text-right whitespace-nowrap">{currency(item.unit_price)}</td>
                <td className="px-2 py-3 text-right font-bold whitespace-nowrap">{currency(item.total)}</td>
              </tr>
            )) : (
              <tr><td colSpan="5" className="px-3 py-8 text-center text-xs text-slate-500">No line items recorded</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function TotalsSection({ invoice: inv, settingEnabled, total, paid, due }) {
  const subtotal = Number(inv.subtotal || 0)
  const discount = Number(inv.discount_amount || 0)
  const tax = Number(inv.tax_amount || 0)
  const roundOff = Number(inv.round_off || 0)

  return (
    <section className="border-t border-slate-200 px-5 py-6 sm:px-8">
      <div className="grid gap-7 sm:grid-cols-[1fr_310px]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Payment</p>
          <p className="mt-2 text-sm font-bold capitalize text-slate-800">{inv.payment_method || 'Cash'}</p>
          <p className={`mt-1 text-xs font-semibold uppercase ${
            String(inv.payment_status || '').toLowerCase() === 'paid' ? 'text-teal-700' : 'text-amber-700'
          }`}>
            {String(inv.payment_status || inv.status || 'Pending')}
          </p>
          {settingEnabled('show_notes') && inv.notes && (
            <div className="mt-5 border-l-2 border-slate-300 pl-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Notes</p>
              <p className="mt-1 max-w-md whitespace-pre-line text-xs italic leading-relaxed text-slate-500">{inv.notes}</p>
            </div>
          )}
        </div>

        <div className="text-sm">
          <div className="flex justify-between py-1 text-slate-500"><span>Subtotal</span><span>{currency(subtotal)}</span></div>
          {discount > 0 && <div className="flex justify-between py-1 text-teal-700"><span>Discount</span><span>-{currency(discount)}</span></div>}
          {tax > 0 && <div className="flex justify-between py-1 text-slate-500"><span>GST</span><span>{currency(tax)}</span></div>}
          {roundOff !== 0 && <div className="flex justify-between py-1 text-slate-500"><span>Round off</span><span>{currency(roundOff)}</span></div>}

          <div className="mt-2 flex items-baseline justify-between border-t-2 border-[#1E3A5F] pt-3">
            <span className="text-sm font-black uppercase text-[#1E3A5F]">Grand total</span>
            <span className="text-xl font-black text-[#1E3A5F]">{currency(total)}</span>
          </div>

          {settingEnabled('show_payment_summary') && (
            <div className="mt-2 flex justify-between text-xs text-slate-500"><span>Paid</span><span>{currency(paid)}</span></div>
          )}
          {settingEnabled('show_balance_due') && due > 0 && (
            <div className="mt-1 flex justify-between text-xs font-bold text-rose-700"><span>Balance due</span><span>{currency(due)}</span></div>
          )}
        </div>
      </div>
    </section>
  )
}

function QrPaymentSection({ invoice: inv, business: biz, settings: s, settingEnabled, showPaymentQr, showBillQr, bankDetails, total }) {
  if (!showPaymentQr && !showBillQr && !(settingEnabled('show_bank_details') && bankDetails)) return null

  return (
    <section className="border-t border-slate-200 px-5 py-6 sm:px-8">
      <div className="grid gap-6 sm:grid-cols-[auto_auto_1fr] sm:items-center">
        {showPaymentQr && (
          <div className="text-center">
            <div className="inline-flex border border-slate-200 bg-white p-2">
              <QRCodeSVG
                value={`upi://pay?pa=${encodeURIComponent(s.shop_upi_id)}&pn=${encodeURIComponent(biz.name || '')}&am=${total.toFixed(2)}&cu=INR`}
                size={104}
                level="M"
              />
            </div>
            <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-teal-700">Scan to pay</p>
            <p className="mt-1 max-w-[140px] break-all text-[9px] text-slate-500">{s.shop_upi_id}</p>
          </div>
        )}

        {showBillQr && (
          <div className="text-center">
            <div className="inline-flex border border-slate-200 bg-white p-2">
              <QRCodeSVG value={inv.short_url} size={104} level="M" />
            </div>
            <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-[#1E3A5F]">Scan to view</p>
            <p className="mt-1 text-[9px] text-slate-500">View this invoice online</p>
          </div>
        )}

        {settingEnabled('show_bank_details') && bankDetails && (
          <div className="border-l border-slate-200 pl-0 sm:pl-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Bank details</p>
            <p className="mt-2 whitespace-pre-line text-xs leading-6 text-slate-600">{bankDetails}</p>
          </div>
        )}
      </div>
    </section>
  )
}

function A4Bill({ invoice: inv, business: biz, settings: s, settingEnabled, showPaymentQr, showBillQr, bankDetails, isPaid, isCancelled, items, total, paid, due }) {
  return (
    <article className="mx-auto w-full max-w-[820px] border border-slate-300 bg-white text-slate-900 print:max-w-none print:border-0">
      <header className="border-b-2 border-[#1E3A5F] px-5 py-6 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="min-w-0">
            {settingEnabled('show_business_logo') && (s.shop_logo || biz.logo) && (
              <img src={s.shop_logo || biz.logo} alt={`${biz.name || 'Business'} logo`} className="mb-3 h-12 max-w-[180px] object-contain object-left" />
            )}
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#1E3A5F]">
              {isCancelled ? 'Cancelled invoice' : 'Tax invoice'}
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-[#1E3A5F] sm:text-3xl">{biz.name || 'Store Invoice'}</h1>
            {settingEnabled('show_business_address') && biz.address && (
              <p className="mt-2 max-w-xl whitespace-pre-line text-xs leading-relaxed text-slate-600">{biz.address}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              {settingEnabled('show_business_phone') && biz.mobile && (
                <span className="inline-flex items-center gap-1.5"><Phone size={12} className="text-[#1E3A5F]" />{biz.mobile}</span>
              )}
              {settingEnabled('show_business_email') && biz.email && (
                <span className="inline-flex items-center gap-1.5 break-all"><Mail size={12} className="text-[#1E3A5F]" />{biz.email}</span>
              )}
              {settingEnabled('show_business_gstin') && biz.gstin && (
                <span className="font-mono text-[11px]">GSTIN: {biz.gstin}</span>
              )}
            </div>
          </div>

          <div className="sm:min-w-[150px] sm:text-right">
            <StatusBadge cancelled={isCancelled} paid={isPaid} />
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Invoice number</p>
            <p className="mt-1 font-mono text-lg font-black text-slate-900">{inv.invoice_number || '—'}</p>
            <p className="mt-2 text-xs text-slate-500">{formatDate(inv.created_at)}</p>
          </div>
        </div>
      </header>

      <InvoiceInfo invoice={inv} settingEnabled={settingEnabled} />
      <InvoiceItems items={items} />

      <TotalsSection invoice={inv} settingEnabled={settingEnabled} total={total} paid={paid} due={due} />

      <QrPaymentSection
        invoice={inv}
        business={biz}
        settings={s}
        settingEnabled={settingEnabled}
        showPaymentQr={showPaymentQr}
        showBillQr={showBillQr}
        bankDetails={bankDetails}
        total={total}
      />

      <footer className="border-t border-slate-200 px-5 py-6 text-center sm:px-8">
        <p className="text-sm font-bold text-slate-700">{s.invoice_footer || 'Thank you for shopping with us!'}</p>
        {settingEnabled('show_terms') && s.invoice_terms && (
          <p className="mx-auto mt-3 max-w-2xl whitespace-pre-line text-left text-[10px] leading-relaxed text-slate-500">{s.invoice_terms}</p>
        )}
        <p className="mt-4 text-[9px] text-slate-400">Computer-generated invoice • {biz.name || 'the business'}</p>
      </footer>
    </article>
  )
}

function ThermalBill({ invoice: inv, business: biz, settings: s, settingEnabled, showPaymentQr, showBillQr, bankDetails }) {
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
    <article className="mx-auto w-full max-w-[80mm] bg-white text-[10px] text-black print:max-w-[80mm]">
      <div className="px-2 py-3 font-mono">
        <header className="text-center">
          {settingEnabled('show_business_logo') && (s.shop_logo || biz.logo) && (
            <img src={s.shop_logo || biz.logo} alt="" className="mx-auto mb-2 max-h-10 max-w-[120px] object-contain" />
          )}
          <h1 className="text-[14px] font-black uppercase">{biz.name || 'Store Invoice'}</h1>
          {settingEnabled('show_business_address') && biz.address && (
            <p className="mt-1 whitespace-pre-line text-[8px] leading-tight">{biz.address}</p>
          )}
          <p className="mt-1 text-[8px]">
            {settingEnabled('show_business_phone') && biz.mobile ? `Ph: ${biz.mobile}` : ''}
            {settingEnabled('show_business_phone') && biz.mobile && settingEnabled('show_business_email') && biz.email ? ' | ' : ''}
            {settingEnabled('show_business_email') && biz.email ? biz.email : ''}
          </p>
          {settingEnabled('show_business_gstin') && biz.gstin && <p className="text-[8px] font-bold">GSTIN: {biz.gstin}</p>}
        </header>

        <div className="my-2 border-t border-dashed border-black" />
        <div className="text-center">
          <p className="text-[11px] font-black">{cancelled ? 'CANCELLED INVOICE' : 'TAX INVOICE'}</p>
          <p>{inv.invoice_number || '—'}</p>
          <p className="text-[8px]">{formatDate(inv.created_at)} {formatTime(inv.created_at)}</p>
        </div>

        <div className="my-2 border-t border-dashed border-black" />
        <div>
          <p className="font-bold uppercase">Customer: {inv.customer_name || 'Walk-in Customer'}</p>
          {settingEnabled('show_customer_phone') && inv.customer_phone && <p className="text-[8px]">Ph: {inv.customer_phone}</p>}
        </div>

        <div className="my-2 border-t border-dashed border-black" />

        <table className="w-full table-fixed text-[9px]">
          <thead className="border-b border-black">
            <tr>
              <th className="w-[48%] pb-1 text-left">ITEM</th>
              <th className="w-[14%] pb-1 text-center">QTY</th>
              <th className="w-[18%] pb-1 text-right">RATE</th>
              <th className="w-[20%] pb-1 text-right">AMT</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? items.map((item, index) => (
              <tr key={item.id || index} className="border-b border-dotted border-black align-top">
                <td className="py-1 pr-1 break-words">
                  {item.product_name || item.name || 'Item'}
                  {item.hsn_code && <small className="block text-[7px]">HSN: {item.hsn_code}</small>}
                </td>
                <td className="py-1 text-center">{item.quantity ?? 0}</td>
                <td className="py-1 text-right">{Number(item.unit_price || 0).toFixed(2)}</td>
                <td className="py-1 text-right font-bold">{Number(item.total || 0).toFixed(2)}</td>
              </tr>
            )) : (
              <tr><td colSpan="4" className="py-3 text-center">No line items</td></tr>
            )}
          </tbody>
        </table>

        <div className="my-2 border-t border-dashed border-black" />

        <div className="space-y-0.5">
          <div className="flex justify-between"><span>SUBTOTAL</span><span>{currency(subtotal)}</span></div>
          {discount > 0 && <div className="flex justify-between"><span>DISCOUNT</span><span>-{currency(discount)}</span></div>}
          {tax > 0 && <div className="flex justify-between"><span>GST</span><span>{currency(tax)}</span></div>}
          {roundOff !== 0 && <div className="flex justify-between"><span>ROUND OFF</span><span>{currency(roundOff)}</span></div>}
          <div className="mt-1 flex justify-between border-t border-black pt-1 text-[12px] font-black"><span>GRAND TOTAL</span><span>{currency(total)}</span></div>
          <div className="flex justify-between text-[8px]"><span>{String(inv.payment_status || 'PAID').toUpperCase()}</span><span>Paid: {currency(paid)}</span></div>
          {due > 0 && <div className="flex justify-between font-bold"><span>DUE</span><span>{currency(due)}</span></div>}
        </div>

        {(showPaymentQr || showBillQr) && (
          <div className="my-3 flex justify-center gap-3 border-t border-dashed border-black pt-3 text-center">
            {showPaymentQr && (
              <div>
                <div className="inline-block border border-black p-1">
                  <QRCodeSVG value={`upi://pay?pa=${encodeURIComponent(s.shop_upi_id)}&pn=${encodeURIComponent(biz.name || '')}&am=${total.toFixed(2)}&cu=INR`} size={84} level="M" />
                </div>
                <p className="mt-1 text-[7px] font-black">SCAN TO PAY</p>
              </div>
            )}
            {showBillQr && (
              <div>
                <div className="inline-block border border-black p-1">
                  <QRCodeSVG value={inv.short_url} size={84} level="M" />
                </div>
                <p className="mt-1 text-[7px] font-black">SCAN TO VIEW</p>
              </div>
            )}
          </div>
        )}

        {settingEnabled('show_bank_details') && bankDetails && (
          <div className="border-t border-dashed border-black pt-2 text-[7px] leading-tight">
            <p className="font-bold">BANK DETAILS</p>
            <p className="mt-1">{bankDetails}</p>
          </div>
        )}

        <footer className="mt-3 border-t border-dashed border-black pt-2 text-center text-[8px]">
          <p className="font-bold">{s.invoice_footer || 'Thank you for shopping with us!'}</p>
          <p className="mt-1">Please visit again.</p>
        </footer>
      </div>
    </article>
  )
}

export default function PublicBill() {

  const { token, id } = useParams()

  const [resolvedToken, setResolvedToken] = useState(token || '')

  const [data, setData] = useState(null)

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState('')

  const [copied, setCopied] = useState(false)

  const [selectedPrinter, setSelectedPrinter] = useState('a4')



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

      .then(invoice => {

        if (!active) return

        if (!invoice?.public_token) throw new Error('This invoice does not have a public bill token.')

        setResolvedToken(invoice.public_token)

      })

      .catch(err => {

        if (!active) return

        setError(err.response?.data?.detail || err.message || 'This digital bill was not found or the link has expired.')

        setLoading(false)

      })

    return () => { active = false }

  }, [id, token])



  useEffect(() => {

    if (!resolvedToken) return undefined

    let active = true

    setLoading(true)

    setError('')

    axios.get(`${API_BASE_URL}/public/bill/${resolvedToken}/`)

      .then(res => {

        if (!active) return

        setData(res.data)

        setLoading(false)

      })

      .catch(err => {

        if (!active) return

        setError(err.response?.data?.detail || 'This digital bill was not found or the link has expired.')

        setLoading(false)

      })

    return () => { active = false }

  }, [resolvedToken])



  const configuredPrinter = useMemo(() => {

    const settings = data?.settings || {}

    const template = String(settings.invoice_template || '').toLowerCase()

    const printer = String(settings.printer_type || '').toLowerCase()

    return template.startsWith('thermal') || printer.startsWith('thermal') ? 'thermal' : 'a4'

  }, [data?.settings])



  useEffect(() => {

    if (data) setSelectedPrinter(configuredPrinter)

  }, [configuredPrinter, data])



  const copyBillLink = () => {

    navigator.clipboard.writeText(window.location.href)

      .then(() => {

        setCopied(true)

        toast.success('Bill link copied to clipboard')

        setTimeout(() => setCopied(false), 2000)

      })

      .catch(() => toast.error('Could not copy link'))

  }



  const fetchDocument = async (printer, download = false) => {

    const response = await axios.get(`${API_BASE_URL}/public/bill/${resolvedToken}/document/`, {

      params: { printer, download: download ? '1' : '0' },

      responseType: 'blob',

    })

    if (!response.data || response.data.size === 0) throw new Error('The bill document was empty.')

    return URL.createObjectURL(response.data)

  }



  const downloadPdf = async (printer = selectedPrinter) => {

    try {

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

    }

  }



  const printBill = async (printer = selectedPrinter) => {

    const printWindow = window.open('', '\_blank')

    if (!printWindow) {

      toast.error('Popup blocked. Allow popups to print the bill.')

      return

    }

    try {

      const url = await fetchDocument(printer)

      printWindow.location.href = url

      setTimeout(() => {

        try { printWindow.focus(); printWindow.print() } catch { /\* PDF viewer owns printing \*/ }

      }, 3000)

      toast.success(`${printer === 'thermal' ? 'Thermal' : 'A4'} bill opened for printing`)

      setTimeout(() => URL.revokeObjectURL(url), 60000)

    } catch (err) {

      printWindow.close()

      console.error('Public bill PDF print failed:', err)

      toast.error('Could not generate the bill PDF')

    }

  }




  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6 text-center">
        <div>
          <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-slate-200 border-t-[#1E3A5F]" />
          <h2 className="font-bold text-slate-900">Loading invoice</h2>
          <p className="mt-1 text-xs text-slate-500">Verifying the secure bill link...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="w-full max-w-md border border-slate-300 bg-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center border border-rose-200 bg-rose-50 text-rose-600">
            <AlertCircle size={22} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Invoice unavailable</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{error || 'Could not locate this digital bill.'}</p>
          <p className="mt-4 text-xs text-slate-400">Please contact the store if you need another copy of this invoice.</p>
        </div>
      </div>
    )
  }

  const { invoice: inv, business: biz, settings: s } = data
  const settingEnabled = key => String(s?.[key] ?? 'true').toLowerCase() !== 'false'
  const items = Array.isArray(inv.items) ? inv.items : []

  const bankDetails =
    s?.shop_bank_details ||
    [
      s?.shop_bank_name && `Bank: ${s.shop_bank_name}`,
      s?.shop_bank_branch && `Branch: ${s.shop_bank_branch}`,
      s?.shop_bank_account && `A/C: ${s.shop_bank_account}`,
      s?.shop_bank_ifsc && `IFSC: ${s.shop_bank_ifsc}`,
    ].filter(Boolean).join(' | ')

  const showPaymentQr = settingEnabled('show_upi_qr_on_invoice') && Boolean(s?.shop_upi_id)
  const showBillQr = settingEnabled('enable_invoice_qr') && Boolean(inv.short_url)
  const isPaid = String(inv.payment_status || '').toLowerCase() === 'paid'
  const isCancelled = String(inv.status || '').toLowerCase() === 'cancelled'
  const total = Number(inv.grand_total || 0)
  const paid = Number(inv.paid_amount || 0)
  const due = Number(inv.balance_due || Math.max(0, total - paid))

  return (
    <main className="min-h-screen bg-white font-sans text-slate-900 print:min-h-0 print:bg-white">
      <BillActions
        selectedPrinter={selectedPrinter}
        setSelectedPrinter={setSelectedPrinter}
        downloadPdf={downloadPdf}
        printBill={printBill}
        copyBillLink={copyBillLink}
        copied={copied}
        invoiceNumber={inv.invoice_number}
      />

      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3 text-[10px] text-slate-500 print:hidden">
          <span className="inline-flex items-center gap-1.5"><FileText size={13} /> Secure public bill</span>
          <span className="hidden items-center gap-1.5 sm:inline-flex"><Share2 size={13} /> Share this invoice with the customer</span>
        </div>

        {selectedPrinter === 'thermal' ? (
          <ThermalBill
            invoice={inv}
            business={biz}
            settings={s}
            settingEnabled={settingEnabled}
            showPaymentQr={showPaymentQr}
            showBillQr={showBillQr}
            bankDetails={bankDetails}
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
          />
        )}
      </div>
    </main>
  )
}
