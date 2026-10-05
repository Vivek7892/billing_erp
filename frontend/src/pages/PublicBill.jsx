import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'

import invoiceService from '../features/billing/api/invoiceService'
import { API_BASE_URL } from '../api'
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
      return () => {
        active = false
      }
    }

    if (!id) {
      setError('Invalid bill link.')
      setLoading(false)
      return () => {
        active = false
      }
    }

    invoiceService
      .getInvoice(id)
      .then(invoice => {
        if (!active) return
        if (!invoice?.public_token) {
          throw new Error('This invoice does not have a public bill token.')
        }
        setResolvedToken(invoice.public_token)
      })
      .catch(err => {
        if (!active) return
        const msg = err.response?.data?.detail || 'This digital bill was not found or the link has expired.'
        setError(msg)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id, token])

  useEffect(() => {
    if (!resolvedToken) return

    let active = true
    setLoading(true)
    setError('')

    axios
      .get(`${API_BASE_URL}/public/bill/${resolvedToken}/`)
      .then(res => {
        if (!active) return
        setData(res.data)
        setLoading(false)
      })
      .catch(err => {
        if (!active) return
        const msg = err.response?.data?.detail || 'This digital bill was not found or the link has expired.'
        setError(msg)
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [resolvedToken])

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

  const configuredPrinter = (
    s => {
      const template = String(s?.invoice_template || '').toLowerCase()
      const printer = String(s?.printer_type || '').toLowerCase()
      return template.startsWith('thermal') || printer.startsWith('thermal') ? 'thermal' : 'a4'
    }
  )(data?.settings)

  useEffect(() => {
    setSelectedPrinter(configuredPrinter)
  }, [configuredPrinter])

  const fetchDocument = async (printer, download = false) => {
    const response = await axios.get(
      `${API_BASE_URL}/public/bill/${resolvedToken}/document/`,
      {
        params: { printer, download: download ? '1' : '0' },
        responseType: 'blob',
      }
    )
    if (!response.data || response.data.size === 0) {
      throw new Error('The bill document was empty.')
    }
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
      toast.success(`${printer === 'thermal' ? 'Thermal' : 'A4'} PDF downloaded.`)
    } catch (err) {
      console.error('Public bill PDF download failed:', err)
      toast.error('Could not generate the bill PDF.')
    }
  }

  const printBill = async (printer = selectedPrinter) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Popup blocked. Allow popups to print the bill.')
      return
    }

    try {
      const url = await fetchDocument(printer)
      let printed = false
      const printDocument = () => {
        if (printed) return
        printed = true
        printWindow.focus()
        printWindow.print()
      }
      // Navigate the approved popup directly to the generated blob URL. This
      // keeps the browser's PDF viewer as the print target instead of an
      // empty about:blank wrapper document.
      printWindow.location.href = url
      window.setTimeout(printDocument, 3000)
      toast.success(`${printer === 'thermal' ? 'Thermal' : 'A4'} bill opened for printing.`)
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      printWindow.close()
      console.error('Public bill PDF print failed:', err)
      toast.error('Could not generate the bill PDF.')
    }
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
      <div className="min-h-screen bg-[var(--app-bg,#0B1120)] p-4 text-[var(--ink,#F8FAFC)]">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="flex max-w-sm flex-col items-center text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#1E3A5F] border-t-transparent mb-4" />
          <h2 className="text-base font-bold text-[var(--ink,#F8FAFC)]">Loading your digital bill...</h2>
          <p className="text-xs text-[var(--muted,#64748B)] mt-1">Please wait while we verify and load invoice details.</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[var(--app-bg,#0B1120)] p-4 text-[var(--ink,#F8FAFC)]">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="w-full max-w-md rounded-xl border border-[var(--line,#263244)] bg-[var(--surface,#111827)] p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-950/40 text-rose-400 border border-rose-800/40 mb-3">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-lg font-bold text-[var(--ink,#F8FAFC)]">Bill Not Available</h2>
          <p className="text-sm text-[var(--muted,#64748B)] mt-2">{error || 'Could not locate this digital bill.'}</p>
          </div>
        </div>
      </div>
    )
  }

  const { invoice: inv, business: biz, settings: s } = data
  const settingEnabled = key => String(s?.[key] ?? 'true').toLowerCase() !== 'false'
  const bankDetails = s?.shop_bank_details || [
    s?.shop_bank_name && `Bank: ${s.shop_bank_name}`,
    s?.shop_bank_branch && `Branch: ${s.shop_bank_branch}`,
    s?.shop_bank_account && `A/C: ${s.shop_bank_account}`,
    s?.shop_bank_ifsc && `IFSC: ${s.shop_bank_ifsc}`,
  ].filter(Boolean).join(' | ')
  const showPaymentQr = settingEnabled('show_upi_qr_on_invoice') && Boolean(s?.shop_upi_id)
  const showBillQr = settingEnabled('enable_invoice_qr') && Boolean(inv.short_url)
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
            <div className="flex items-center rounded-lg border border-[var(--line,#263244)] bg-[var(--surface-elevated,#172033)] p-0.5">
              {[
                ['a4', 'A4'],
                ['thermal', 'Thermal'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedPrinter(value)}
                  className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    selectedPrinter === value
                      ? 'bg-[#1E3A5F] text-white'
                      : 'text-[var(--muted,#64748B)] hover:text-[var(--ink,#F8FAFC)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => downloadPdf(selectedPrinter)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white text-xs font-semibold hover:bg-[#162F4D] transition"
              title="Download official PDF copy"
            >
              <Download size={13} />
              <span>Download {selectedPrinter === 'thermal' ? 'Thermal' : 'A4'}</span>
            </button>

            <button
              onClick={() => printBill(selectedPrinter)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--line,#263244)] bg-[var(--surface-elevated,#172033)] text-[var(--ink,#F8FAFC)] text-xs font-semibold hover:bg-[var(--line,#263244)] transition"
              title="Print bill"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">
                Print {selectedPrinter === 'thermal' ? 'Thermal' : 'A4'}
              </span>
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
              {(settingEnabled('show_business_logo') && (s.shop_logo || biz.logo)) && (
                <img
                  src={s.shop_logo || biz.logo}
                  alt={`${biz.name || 'Business'} logo`}
                  className="h-14 w-auto max-w-[180px] object-contain object-left"
                />
              )}
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink,#F8FAFC)] print:text-black">
                {biz.name || 'Store Invoice'}
              </h1>
              {settingEnabled('show_business_address') && biz.address && (
                <p className="text-xs text-[var(--ink-secondary,#94A3B8)] print:text-gray-700 flex items-start gap-1.5 max-w-sm">
                  <MapPin size={13} className="shrink-0 text-[var(--muted,#64748B)] mt-0.5" />
                  <span>{biz.address}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-[var(--muted,#64748B)]">
                {settingEnabled('show_business_phone') && biz.mobile && (
                  <span className="flex items-center gap-1">
                    <Phone size={12} className="text-[var(--muted,#64748B)]" /> {biz.mobile}
                  </span>
                )}
                {settingEnabled('show_business_email') && biz.email && (
                  <span className="flex items-center gap-1">
                    <Mail size={12} className="text-[var(--muted,#64748B)]" /> {biz.email}
                  </span>
                )}
                {settingEnabled('show_business_gstin') && biz.gstin && (
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
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700'
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
              {settingEnabled('show_customer_phone') && inv.customer_phone && <span className="text-[var(--ink-secondary,#94A3B8)]">{inv.customer_phone}</span>}
              {settingEnabled('show_customer_address') && inv.customer_address && <p className="text-[var(--muted,#64748B)] mt-0.5 line-clamp-2">{inv.customer_address}</p>}
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
              {settingEnabled('show_notes') && inv.notes && (
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

              {settingEnabled('show_payment_summary') && (
                <div className="flex justify-between text-[11px] pt-1 text-[var(--muted,#64748B)]">
                  <span>Paid Amount</span>
                  <span className="font-semibold text-[var(--ink-secondary,#94A3B8)]">{fmt(inv.paid_amount)}</span>
                </div>
              )}

              {settingEnabled('show_balance_due') && inv.balance_due > 0 && (
                <div className="flex justify-between text-[11px] font-bold text-rose-400">
                  <span>Balance Due</span>
                  <span>{fmt(inv.balance_due)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Payment QR and configured bank details */}
        {(showPaymentQr || showBillQr || (settingEnabled('show_bank_details') && bankDetails)) && (
          <div className="px-4 sm:px-6 py-4 print:py-3">
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              {(showPaymentQr || showBillQr) && (
                <div className="flex flex-wrap gap-5 items-start">
                  {showPaymentQr && (
                    <div className="text-center">
                      <QRCodeSVG value={`upi://pay?pa=${encodeURIComponent(s.shop_upi_id)}&pn=${encodeURIComponent(biz.name || '')}&am=${Number(inv.grand_total || 0).toFixed(2)}&cu=INR`} size={92} />
                      <p className="mt-1 text-[9px] font-bold tracking-wide text-teal-700">SCAN TO PAY</p>
                    </div>
                  )}
                  {showBillQr && (
                    <div className="text-center">
                      <QRCodeSVG value={inv.short_url} size={92} />
                      <p className="mt-1 text-[9px] font-bold tracking-wide text-indigo-700">SCAN TO VIEW BILL</p>
                    </div>
                  )}
                </div>
              )}
              {settingEnabled('show_bank_details') && bankDetails && (
                <div className="text-xs text-[var(--ink-secondary,#94A3B8)]">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--muted,#64748B)]">Bank Details</p>
                  <p className="mt-1 whitespace-pre-line">{bankDetails}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer & Terms */}
        <div className="border-t border-[var(--line,#263244)] p-5 text-center bg-[var(--surface,#111827)] print:bg-white space-y-2">
          {settingEnabled('show_terms') && s?.invoice_terms && (
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
            onClick={() => downloadPdf(selectedPrinter)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-[#1E3A5F] text-white text-xs font-semibold hover:bg-[#162F4D] transition"
          >
            <Download size={14} /> Download {selectedPrinter === 'thermal' ? 'Thermal' : 'A4'}
          </button>
          <button
            onClick={() => printBill(selectedPrinter)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-[var(--line,#263244)] bg-[var(--surface,#111827)] text-[var(--ink,#F8FAFC)] text-xs font-semibold"
          >
            <Printer size={14} /> Print {selectedPrinter === 'thermal' ? 'Thermal' : 'A4'}
          </button>
        </div>
      </div>
    </div>
  )
}
