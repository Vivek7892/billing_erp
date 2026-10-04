import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  Copy,
  Receipt,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react'

// API base URL for public calls
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000/api').replace(/\/+$/, '')

export default function PublicBill() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Invalid bill link.')
      setLoading(false)
      return
    }

    axios
      .get(`${API_BASE_URL}/public/bill/${token}/`)
      .then(res => {
        setData(res.data)
        setLoading(false)
      })
      .catch(err => {
        const msg = err.response?.data?.detail || 'This digital bill was not found or the link has expired.'
        setError(msg)
        setLoading(false)
      })
  }, [token])

  const copyBillLink = () => {
    const url = window.location.href
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true)
        toast.success('Bill link copied to clipboard!')
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        toast.error('Could not copy link.')
      })
  }

  const downloadPdf = (printer = false) => {
    const url = `${API_BASE_URL}/public/bill/${token}/pdf/?download=1${printer ? '&printer=thermal' : ''}`
    const link = document.createElement('a')
    link.href = url
    link.download = `Invoice-${data?.invoice?.invoice_number || token}${printer ? '-thermal' : ''}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const printBill = () => {
    window.print()
  }

  const fmt = val => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const formatDate = d => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return String(d)
    }
  }

  const formatTime = d => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg,#0B1120)] p-4">
        <div className="flex flex-col items-center max-w-sm text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#1E3A5F] border-t-transparent mb-4" />
          <h2 className="text-base font-bold text-[var(--ink,#F8FAFC)]">Loading your digital bill...</h2>
          <p className="text-xs text-[var(--muted,#64748B)] mt-1">Please wait while we verify and load invoice details.</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg,#0B1120)] p-4">
        <div className="w-full max-w-md bg-[var(--surface,#111827)] border border-[var(--line,#263244)] rounded-xl p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-950/40 text-rose-400 border border-rose-800/40 mb-3">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-bold text-[var(--ink,#F8FAFC)]">Bill Not Available</h2>
          <p className="text-sm text-[var(--muted,#64748B)] mt-2">{error || 'Could not locate this digital bill.'}</p>
        </div>
      </div>
    )
  }

  const { invoice: inv, business: biz, settings: s } = data
  const isPaid = (inv.payment_status || '').toLowerCase() === 'paid'
  const isCancelled = (inv.status || '').toLowerCase() === 'cancelled'

  return (
    <div className="min-h-screen bg-[var(--app-bg,#0B1120)] py-4 px-3 sm:py-8 sm:px-4 text-[var(--ink,#F8FAFC)] font-sans print:p-0 print:bg-white print:text-black">
      {/* Top action toolbar (Hidden in print) */}
      <div className="max-w-2xl mx-auto mb-4 print:hidden">
        <div className="bg-[var(--surface,#111827)] border border-[var(--line,#263244)] rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[var(--surface-elevated)] text-[#1E3A5F] dark:text-slate-300 border border-[var(--line,#263244)] flex items-center justify-center">
              <Receipt size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-[var(--ink,#F8FAFC)] block leading-tight">Digital Bill</span>
              <span className="text-[11px] text-[var(--muted,#64748B)] font-mono">#{inv.invoice_number}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => downloadPdf(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white text-xs font-semibold hover:bg-[#162F4D] transition"
              title="Download official PDF copy"
            >
              <Download size={13} />
              <span>Download PDF</span>
            </button>

            <button
              onClick={printBill}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line,#263244)] bg-[var(--surface-elevated,#172033)] text-[var(--ink,#F8FAFC)] text-xs font-semibold hover:bg-[var(--line,#263244)] transition"
              title="Print bill"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={copyBillLink}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--line,#263244)] bg-[var(--surface-elevated,#172033)] text-[var(--ink,#F8FAFC)] text-xs font-semibold hover:bg-[var(--line,#263244)] transition"
              title="Copy bill link"
            >
              {copied ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Digital Bill Receipt Card */}
      <div className="max-w-2xl mx-auto bg-[var(--surface,#111827)] border border-[var(--line,#263244)] rounded-2xl shadow-sm overflow-hidden print:border-none print:shadow-none print:rounded-none print:bg-white print:text-black">
        {/* Bill Header */}
        <div className="border-b border-[var(--line,#263244)] bg-[var(--surface-elevated,#172033)] p-5 sm:p-7 print:bg-white">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink,#F8FAFC)] print:text-black">
                {biz.name || 'Store Invoice'}
              </h1>
              {biz.address && (
                <p className="text-xs text-[var(--ink-secondary,#94A3B8)] print:text-gray-700 flex items-start gap-1.5 max-w-sm">
                  <MapPin size={13} className="shrink-0 text-[var(--muted,#64748B)] mt-0.5" />
                  <span>{biz.address}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-[var(--muted,#64748B)]">
                {biz.mobile && (
                  <span className="flex items-center gap-1">
                    <Phone size={12} className="text-[var(--muted,#64748B)]" /> {biz.mobile}
                  </span>
                )}
                {biz.email && (
                  <span className="flex items-center gap-1">
                    <Mail size={12} className="text-[var(--muted,#64748B)]" /> {biz.email}
                  </span>
                )}
                {biz.gstin && (
                  <span className="font-mono bg-[var(--surface,#111827)] border border-[var(--line,#263244)] px-1.5 py-0.5 rounded text-[11px] font-semibold text-[var(--ink-secondary,#94A3B8)]">
                    GSTIN: {biz.gstin}
                  </span>
                )}
              </div>
            </div>

            {/* Status & Reference Pill */}
            <div className="flex flex-row sm:flex-col items-start sm:items-end justify-between sm:justify-start gap-2">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${
                  isCancelled
                    ? 'bg-rose-950/40 text-rose-300 border border-rose-800/50'
                    : isPaid
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/50'
                    : 'bg-amber-950/40 text-amber-300 border border-amber-800/50'
                }`}
              >
                {isCancelled ? 'Cancelled' : isPaid ? 'Paid' : 'Pending'}
              </span>

              <div className="text-right sm:mt-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted,#64748B)] block">Invoice Number</span>
                <span className="text-sm font-mono font-bold text-[var(--ink,#F8FAFC)] print:text-black">{inv.invoice_number}</span>
              </div>
            </div>
          </div>

          {/* Date & Customer Row */}
          <div className="mt-5 pt-4 border-t border-[var(--line,#263244)] grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted,#64748B)] block">Billed To</span>
              <span className="font-semibold text-[var(--ink,#F8FAFC)] print:text-black block text-sm">{inv.customer_name || 'Walk-in Customer'}</span>
              {inv.customer_phone && <span className="text-[var(--ink-secondary,#94A3B8)]">{inv.customer_phone}</span>}
              {inv.customer_address && <p className="text-[var(--muted,#64748B)] mt-0.5 line-clamp-2">{inv.customer_address}</p>}
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted,#64748B)] block">Date & Time</span>
              <span className="font-medium text-[var(--ink,#F8FAFC)] print:text-black block">{formatDate(inv.created_at)}</span>
              <span className="text-[var(--muted,#64748B)]">{formatTime(inv.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="p-4 sm:p-6 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--line,#263244)] text-[var(--muted,#64748B)] print:text-gray-600 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-4">Item & Description</th>
                <th className="py-2 px-3 text-right">Qty</th>
                <th className="py-2 px-3 text-right">Rate</th>
                {inv.items.some(i => i.discount_amount > 0) && (
                  <th className="py-2 px-2 text-right">Disc</th>
                )}
                {inv.items.some(i => i.gst_percent > 0) && (
                  <th className="py-2 px-2 text-right">GST</th>
                )}
                <th className="py-2 pl-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line,#263244)] print:divide-gray-200">
              {inv.items.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-[var(--surface-elevated,#172033)] transition-colors">
                  <td className="py-3 pr-3 text-[var(--muted,#64748B)] font-mono text-[11px] align-top">{idx + 1}</td>
                  <td className="py-3 pr-4 align-top">
                    <span className="font-semibold text-[var(--ink,#F8FAFC)] print:text-black block">{item.product_name}</span>
                    {item.hsn_code && (
                      <span className="text-[10px] text-[var(--muted,#64748B)] font-mono block">HSN: {item.hsn_code}</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-[var(--ink,#F8FAFC)] print:text-black align-top">
                    {item.quantity}
                  </td>
                  <td className="py-3 px-3 text-right font-medium text-[var(--ink,#F8FAFC)] print:text-black align-top">
                    {fmt(item.unit_price)}
                  </td>
                  {inv.items.some(i => i.discount_amount > 0) && (
                    <td className="py-3 px-2 text-right text-[var(--ink-secondary,#94A3B8)] align-top">
                      {item.discount_amount > 0 ? fmt(item.discount_amount) : '-'}
                    </td>
                  )}
                  {inv.items.some(i => i.gst_percent > 0) && (
                    <td className="py-3 px-2 text-right text-[var(--ink-secondary,#94A3B8)] align-top">
                      {item.gst_percent > 0 ? `${item.gst_percent}%` : '-'}
                    </td>
                  )}
                  <td className="py-3 pl-3 text-right font-bold text-[var(--ink,#F8FAFC)] print:text-black align-top">
                    {fmt(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bill Calculation Totals */}
        <div className="border-t border-[var(--line,#263244)] bg-[var(--surface-elevated,#172033)] p-4 sm:p-6 print:bg-white">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            {/* Payment Mode & Bank/Notes on left */}
            <div className="space-y-2 text-xs text-[var(--ink-secondary,#94A3B8)] max-w-sm">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted,#64748B)] block">Payment Method</span>
                <span className="font-semibold uppercase text-[var(--ink,#F8FAFC)] print:text-black">{inv.payment_method || 'Cash'}</span>
              </div>
              {inv.notes && (
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted,#64748B)] block">Notes</span>
                  <p className="text-[var(--ink-secondary,#94A3B8)] italic">{inv.notes}</p>
                </div>
              )}
            </div>

            {/* Calculations Breakdown on right */}
            <div className="w-full sm:w-64 space-y-1.5 text-xs text-[var(--ink-secondary,#94A3B8)]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium text-[var(--ink,#F8FAFC)] print:text-black">{fmt(inv.subtotal)}</span>
              </div>

              {inv.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount</span>
                  <span>- {fmt(inv.discount_amount)}</span>
                </div>
              )}

              {inv.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span>Tax (GST)</span>
                  <span className="font-medium text-[var(--ink,#F8FAFC)] print:text-black">{fmt(inv.tax_amount)}</span>
                </div>
              )}

              {inv.round_off !== 0 && (
                <div className="flex justify-between">
                  <span>Round Off</span>
                  <span className="font-medium text-[var(--ink,#F8FAFC)] print:text-black">{fmt(inv.round_off)}</span>
                </div>
              )}

              <div className="border-t border-[var(--line,#263244)] pt-2 flex justify-between items-baseline text-sm font-bold text-[var(--ink,#F8FAFC)] print:text-black">
                <span>Grand Total</span>
                <span className="text-base text-[#1E3A5F] dark:text-slate-100 font-mono font-bold">{fmt(inv.grand_total)}</span>
              </div>

              <div className="flex justify-between text-[11px] pt-1 text-[var(--muted,#64748B)]">
                <span>Paid Amount</span>
                <span className="font-semibold text-[var(--ink-secondary,#94A3B8)]">{fmt(inv.paid_amount)}</span>
              </div>

              {inv.balance_due > 0 && (
                <div className="flex justify-between text-[11px] font-bold text-rose-400">
                  <span>Balance Due</span>
                  <span>{fmt(inv.balance_due)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer & Terms */}
        <div className="border-t border-[var(--line,#263244)] p-5 text-center bg-[var(--surface,#111827)] print:bg-white space-y-2">
          {s?.invoice_terms && (
            <div className="text-[10px] text-[var(--muted,#64748B)] text-left max-w-xl mx-auto pb-2 border-b border-[var(--line,#263244)]">
              <span className="font-bold text-[var(--ink-secondary,#94A3B8)] block uppercase tracking-wider mb-0.5">Terms & Conditions</span>
              <p className="whitespace-pre-line leading-relaxed">{s.invoice_terms}</p>
            </div>
          )}

          <p className="text-xs font-semibold text-[var(--ink-secondary,#94A3B8)] uppercase tracking-wide">
            {s?.invoice_footer || 'Thank you for shopping with us! Visit again.'}
          </p>

          <p className="text-[10px] text-[var(--muted,#64748B)]">
            This is a genuine digital tax invoice issued by {biz.name}.
          </p>
        </div>

        {/* Bottom Actions Bar on Mobile */}
        <div className="border-t border-[var(--line,#263244)] bg-[var(--surface-elevated,#172033)] p-3 flex sm:hidden items-center justify-around gap-2 print:hidden">
          <button
            onClick={() => downloadPdf(false)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-[#1E3A5F] text-white text-xs font-semibold hover:bg-[#162F4D] transition"
          >
            <Download size={14} /> Download PDF
          </button>
          <button
            onClick={printBill}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-[var(--line,#263244)] bg-[var(--surface,#111827)] text-[var(--ink,#F8FAFC)] text-xs font-semibold"
          >
            <Printer size={14} /> Print Bill
          </button>
        </div>
      </div>
    </div>
  )
}
