import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { API_BASE_URL } from '../api'
import { getAccessToken } from '../services/tokenStorage'
import { Badge, Spinner, Modal, SearchInput } from '../components/UI'
import { MobileFAB } from '../components/MobileUI'
import {
  IconRotate2,
  IconRefresh,
  IconPackageOff,
  IconFileX,
  IconEye,
  IconChevronDown,
  IconChevronUp,
  IconPrinter,
  IconAlertCircle,
  IconPlus,
  IconReceipt,
  IconX,
  IconCalendarEvent,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'

import {
  formatCurrency,
  formatDateTime,
} from '../utils/formatters'

const fmt = v => formatCurrency(v)

const DATE_PRESETS = [
  { label: 'All', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Custom', value: 'custom' },
]

function checkDateMatch(dateValue, preset, customStart, customEnd) {
  if (!preset || preset === 'all') return true
  if (!dateValue) return false

  const d = new Date(dateValue)
  if (isNaN(d.getTime())) return false

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  if (preset === 'today') {
    return d >= todayStart
  }
  if (preset === 'yesterday') {
    const yestStart = new Date(todayStart)
    yestStart.setDate(yestStart.getDate() - 1)
    return d >= yestStart && d < todayStart
  }
  if (preset === 'this_week') {
    const weekStart = new Date(todayStart)
    const day = weekStart.getDay()
    const diff = day === 0 ? 6 : day - 1 // Monday as start of week
    weekStart.setDate(weekStart.getDate() - diff)
    return d >= weekStart
  }
  if (preset === 'this_month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    return d >= monthStart
  }
  if (preset === 'custom') {
    if (customStart) {
      const s = new Date(customStart)
      s.setHours(0, 0, 0, 0)
      if (d < s) return false
    }
    if (customEnd) {
      const e = new Date(customEnd)
      e.setHours(23, 59, 59, 999)
      if (d > e) return false
    }
    return true
  }
  return true
}

function CustomDateRangePicker({ startDate, endDate, onStartChange, onEndChange, onClear }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] p-2 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <div className="flex items-center gap-1.5 font-medium text-[var(--ink-secondary)]">
        <IconCalendarEvent size={14} className="text-[#1E3A5F] dark:text-sky-400" />
        <span>Custom Range:</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-1.5 sm:flex">
        <input
          type="date"
          value={startDate}
          onChange={e => onStartChange(e.target.value)}
          className="min-w-0 h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs text-[var(--ink)] outline-none focus:border-[#1E3A5F] sm:w-auto"
          title="Start date"
          aria-label="Start date"
        />
        <span className="text-[var(--muted)] font-medium">to</span>
        <input
          type="date"
          value={endDate}
          onChange={e => onEndChange(e.target.value)}
          className="min-w-0 h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs text-[var(--ink)] outline-none focus:border-[#1E3A5F] sm:w-auto"
          title="End date"
          aria-label="End date"
        />
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={onClear}
            className="h-8 rounded p-1 text-[var(--muted)] hover:text-rose-600 transition inline-flex items-center justify-center"
            title="Clear custom dates"
          >
            <IconX size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

function DatePresetSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
      {DATE_PRESETS.map(p => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={`shrink-0 min-h-[32px] px-2.5 rounded-md text-xs font-semibold border transition ${
            value === p.value
              ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-700 dark:border-slate-700 shadow-2xs'
              : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}

function InfoRow({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-[var(--muted-light)] shrink-0">{label}</span>
      <span className={`text-xs font-medium text-[var(--ink-secondary)] text-right min-w-0 break-words ${valueClass}`}>{value}</span>
    </div>
  )
}

const REFUND_METHODS = ['cash', 'UPI', 'card', 'online']
const PAYMENT_METHODS = ['cash', 'upi', 'card', 'online', 'credit']

function ReturnModal({ open, onClose, invoice, onDone }) {
  const [items, setItems] = useState([])
  const [reason, setReason] = useState('')
  const [refundMethod, setRefundMethod] = useState('cash')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (invoice) {
      setItems((invoice.items || []).map(it => ({
        ...it,
        return_qty: Number(it.quantity),
        selected: true,
      })))
      setReason('')
      setRefundMethod('cash')
    }
  }, [invoice])

  const toggle = (id) => setItems(prev => prev.map(it => it.id === id ? { ...it, selected: !it.selected } : it))
  const setQty = (id, val) => setItems(prev => prev.map(it => {
    if (it.id !== id) return it
    if (val === '') return { ...it, return_qty: '' }
    const quantity = Number(val)
    if (!Number.isFinite(quantity) || quantity <= 0) return it
    return { ...it, return_qty: Math.min(quantity, Number(it.quantity)) }
  }))

  const selectedItems = items.filter(it => it.selected && it.return_qty > 0)
  const refundTotal = selectedItems.reduce((s, it) => s + (Number(it.total) / Number(it.quantity)) * it.return_qty, 0)

  const submit = async () => {
    if (!selectedItems.length) return toast.error('Select at least one item')
    setSaving(true)
    try {
      const res = await api.post('/sales-returns/', {
        invoice: invoice.id,
        reason,
        refund_method: refundMethod,
        items: selectedItems.map(it => ({ invoice_item_id: it.id, quantity: it.return_qty })),
      })
      if (res?.status === 202 || res?.data?.requires_approval) {
        toast.success(res?.data?.message || 'Refund submitted for Admin approval')
      } else {
        toast.success('Return processed successfully')
      }
      onDone()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to process return')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Process Return — ${invoice?.invoice_number}`} size="md">
      <div className="space-y-4">
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-md p-3 flex gap-2 text-xs text-amber-800 dark:text-amber-300">
          <IconAlertCircle size={14} className="shrink-0 mt-0.5" />
          Stock will be restored for returned items. This action cannot be undone.
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Select Items to Return</div>
          {items.map(it => (
            <div key={it.id} className={`flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 p-3 rounded-md border transition-all duration-200 ${it.selected ? 'border-[#1E3A5F] bg-[#1E3A5F]/5 ring-1 ring-inset ring-[#1E3A5F]/20' : 'border-[var(--line)] bg-[var(--surface)] hover:border-slate-400'}`}>
              <input type="checkbox" checked={it.selected} onChange={() => toggle(it.id)}
                className="w-4 h-4 accent-[#1E3A5F] shrink-0 cursor-pointer" />
              <div className="flex-1 min-w-[calc(100%-2rem)] sm:min-w-0">
                <div className="text-sm font-medium text-[var(--ink)] truncate">{it.product_name}</div>
                <div className="text-xs text-[var(--muted-light)]">
                  Billed: {it.quantity} × {fmt(it.unit_price)}
                  {Number(it.discount_percent) > 0 && <span className="ml-1.5 text-green-600 dark:text-green-400">−{it.discount_percent}%</span>}
                  {Number(it.gst_percent) > 0 && <span className="ml-1.5 text-[var(--muted)]">GST {it.gst_percent}%</span>}
                </div>
              </div>
              {it.selected && (
                <div className="flex items-center gap-1.5 shrink-0 ml-6 sm:ml-0">
                  <span className="text-xs text-[var(--muted)]">Qty:</span>
                  <input type="text" inputMode="decimal" aria-label={`Return quantity for ${it.product_name}`}
                    value={it.return_qty}
                    onChange={e => setQty(it.id, e.target.value)}
                    onBlur={() => {
                      if (!it.return_qty) setQty(it.id, '0.01')
                    }}
                    className="w-20 h-9 sm:h-8 text-center border border-[var(--line)] rounded-md text-xs bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[#1E3A5F] focus:border-[#1E3A5F] transition-all" />
                </div>
              )}
              <div className="text-sm font-semibold text-[var(--ink-secondary)] w-full sm:w-20 text-right shrink-0 mt-1 sm:mt-0">
                {it.selected ? fmt((Number(it.total) / Number(it.quantity)) * it.return_qty) : fmt(it.total)}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-[var(--muted)] block mb-1">Refund Method</label>
            <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)}
              className="input w-full capitalize focus:ring-1 focus:ring-[#1E3A5F] focus:border-[#1E3A5F] transition-all">
              {REFUND_METHODS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted)] block mb-1">Reason</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Optional reason" className="input w-full focus:ring-1 focus:ring-[#1E3A5F] focus:border-[#1E3A5F] transition-all" />
          </div>
        </div>

        <div className="flex items-center justify-between bg-[var(--surface-elevated)] rounded-xl px-4 py-3.5 border border-[var(--line)]">
          <span className="text-sm font-medium text-[var(--muted)]">Refund Amount</span>
          <span className="text-lg font-bold text-[var(--ink)]">{fmt(refundTotal)}</span>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-2">
          <button onClick={submit} disabled={saving || !selectedItems.length}
            className="btn-primary flex-1 min-h-11 sm:h-10 shadow-sm hover:shadow-md transition-all active:scale-[0.99]">
            {saving ? 'Processing…' : 'Confirm Return'}
          </button>
          <button onClick={onClose} className="btn-secondary min-h-11 sm:h-10 px-5 border border-[var(--line)] hover:bg-[var(--surface-elevated)] transition-all">Cancel</button>
        </div>
      </div>
    </Modal>
  )
}

function ViewModal({ open, onClose, invoice }) {
  if (!invoice) return null
  return (
    <Modal open={open} onClose={onClose} title={`Invoice — ${invoice.invoice_number}`} size="lg">
      <div className="space-y-4 text-sm">
        {/* Meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-xs">
          <InfoRow label="Customer" value={invoice.customer_name || 'Walk-in'} />
          <InfoRow label="Phone" value={invoice.customer_phone || '—'} />
          <InfoRow label="Date" value={formatDateTime(invoice.created_at)} />
          <InfoRow label="Payment Method" value={invoice.payment_method} valueClass="capitalize" />
          <InfoRow label="Payment Status" value={<Badge status={invoice.payment_status} />} />
          <InfoRow label="Invoice Status" value={<Badge status={invoice.status} />} />
          {invoice.place_of_supply && <InfoRow label="Place of Supply" value={invoice.place_of_supply} />}
          {invoice.created_by_name && <InfoRow label="Created By" value={invoice.created_by_name} />}
          {invoice.cancelled_by_name && <InfoRow label="Cancelled By" value={invoice.cancelled_by_name} />}
          {invoice.cancelled_at && <InfoRow label="Cancelled At" value={formatDateTime(invoice.cancelled_at)} />}
          {invoice.cancel_reason && <InfoRow label="Cancel Reason" value={invoice.cancel_reason} valueClass="text-rose-600 dark:text-rose-400" />}
          {invoice.notes && <InfoRow label="Notes" value={invoice.notes} />}
        </div>

        {/* Items table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="table w-full text-xs min-w-[520px]">
            <thead>
              <tr>
                <th>Item</th><th>SKU</th><th>HSN</th><th className="text-center">Qty</th>
                <th className="text-right">Rate</th><th className="text-right">Disc%</th>
                <th className="text-right">GST%</th><th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items || []).map(it => (
                <tr key={it.id}>
                  <td className="font-medium">{it.product_name}</td>
                  <td className="text-[var(--muted)] font-mono">{it.sku || '—'}</td>
                  <td className="text-[var(--muted)] font-mono">{it.hsn_code || '—'}</td>
                  <td className="text-center font-mono">{it.quantity}</td>
                  <td className="text-right font-mono">{fmt(it.unit_price)}</td>
                  <td className="text-right font-mono">{it.discount_percent > 0 ? `${it.discount_percent}%` : '—'}</td>
                  <td className="text-right font-mono">{it.gst_percent > 0 ? `${it.gst_percent}%` : '—'}</td>
                  <td className="text-right font-mono font-semibold">{fmt(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full sm:w-64 space-y-1 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 text-xs">
            <InfoRow label="Subtotal" value={fmt(invoice.subtotal)} />
            {Number(invoice.discount_amount) > 0 && <InfoRow label="Discount" value={`− ${fmt(invoice.discount_amount)}`} valueClass="text-green-600 dark:text-green-400" />}
            {Number(invoice.tax_amount) > 0 && <InfoRow label="GST" value={`+ ${fmt(invoice.tax_amount)}`} />}
            {Number(invoice.round_off) !== 0 && <InfoRow label="Round Off" value={fmt(invoice.round_off)} />}
            <div className="border-t border-[var(--line)] pt-1.5 mt-1">
              <InfoRow label="Grand Total" value={fmt(invoice.grand_total)} valueClass="text-base font-bold text-[var(--ink)]" />
            </div>
            {Number(invoice.paid_amount) > 0 && <InfoRow label="Paid" value={fmt(invoice.paid_amount)} valueClass="text-green-600 dark:text-green-400" />}
            {Number(invoice.balance_due) > 0 && <InfoRow label="Balance Due" value={fmt(invoice.balance_due)} valueClass="text-rose-600 dark:text-rose-400 font-bold" />}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function Returns() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'returns' | 'invoices' | 'process'

  // Section 1: Sales Returns filters
  const [returnSearch, setReturnSearch] = useState('')
  const [returnDateFilter, setReturnDateFilter] = useState('all')
  const [returnStartDate, setReturnStartDate] = useState('')
  const [returnEndDate, setReturnEndDate] = useState('')
  const [returnMethodFilter, setReturnMethodFilter] = useState('')

  // Section 2: Cancelled & Refunded filters
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all') // 'all' | 'refunded' | 'cancelled'
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const [invoiceDateFilter, setInvoiceDateFilter] = useState('all')
  const [invoiceStartDate, setInvoiceStartDate] = useState('')
  const [invoiceEndDate, setInvoiceEndDate] = useState('')
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState('')

  // Section 3: Process New Return filters
  const [processSearch, setProcessSearch] = useState('')
  const [processDateFilter, setProcessDateFilter] = useState('all')
  const [processStartDate, setProcessStartDate] = useState('')
  const [processEndDate, setProcessEndDate] = useState('')
  const [processPaymentMethod, setProcessPaymentMethod] = useState('')
  const [processLimit, setProcessLimit] = useState(30)

  const [returnModal, setReturnModal] = useState(null)
  const [viewModal, setViewModal] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('Customer requested cancellation')
  const [cancelling, setCancelling] = useState(false)
  const [expandedReturns, setExpandedReturns] = useState({})

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/invoices/?status=cancelled&page_size=200'),
      api.get('/invoices/?status=refunded&page_size=200'),
      api.get('/invoices/?status=completed&page_size=200'),
      api.get('/sales-returns/'),
    ]).then(([cancelled, refunded, completed, salesReturns]) => {
      const cancelledData = cancelled.data?.results || cancelled.data || []
      const refundedData = refunded.data?.results || refunded.data || []
      const completedData = completed.data?.results || completed.data || []
      setInvoices([...cancelledData, ...refundedData, ...completedData])
      setReturns(salesReturns.data?.results || salesReturns.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const cancelledInvoices = invoices.filter(b => b.status === 'cancelled')
  const refundedInvoices = invoices.filter(b => b.status === 'refunded')
  const completedInvoices = invoices.filter(b => b.status === 'completed')

  const totalRefunded = [...refundedInvoices, ...returns].reduce((s, b) => s + Number(b.refund_amount || b.grand_total || 0), 0)

  const filteredReturns = useMemo(() => {
    return returns.filter(r => {
      if (returnSearch.trim()) {
        const q = returnSearch.toLowerCase()
        const match =
          (r.return_number || '').toLowerCase().includes(q) ||
          (r.invoice_number || '').toLowerCase().includes(q) ||
          (r.customer_name || '').toLowerCase().includes(q) ||
          (r.customer_phone || '').toLowerCase().includes(q) ||
          (r.reason || '').toLowerCase().includes(q) ||
          (r.created_by_name || '').toLowerCase().includes(q)
        if (!match) return false
      }
      if (!checkDateMatch(r.created_at, returnDateFilter, returnStartDate, returnEndDate)) {
        return false
      }
      if (returnMethodFilter) {
        if ((r.refund_method || '').toLowerCase() !== returnMethodFilter.toLowerCase()) {
          return false
        }
      }
      return true
    })
  }, [returns, returnSearch, returnDateFilter, returnStartDate, returnEndDate, returnMethodFilter])

  const filteredCancelledRefunded = useMemo(() => {
    const combined = [...cancelledInvoices, ...refundedInvoices]
    return combined.filter(b => {
      if (invoiceStatusFilter !== 'all' && b.status !== invoiceStatusFilter) {
        return false
      }
      if (invoiceSearch.trim()) {
        const q = invoiceSearch.toLowerCase()
        const match =
          (b.invoice_number || '').toLowerCase().includes(q) ||
          (b.customer_name || '').toLowerCase().includes(q) ||
          (b.customer_phone || '').toLowerCase().includes(q) ||
          (b.cancel_reason || '').toLowerCase().includes(q) ||
          (b.cancelled_by_name || '').toLowerCase().includes(q)
        if (!match) return false
      }
      const dateToCheck = b.cancelled_at || b.created_at
      if (!checkDateMatch(dateToCheck, invoiceDateFilter, invoiceStartDate, invoiceEndDate)) {
        return false
      }
      if (invoicePaymentMethod) {
        if ((b.payment_method || '').toLowerCase() !== invoicePaymentMethod.toLowerCase()) {
          return false
        }
      }
      return true
    })
  }, [cancelledInvoices, refundedInvoices, invoiceStatusFilter, invoiceSearch, invoiceDateFilter, invoiceStartDate, invoiceEndDate, invoicePaymentMethod])

  const filteredCompleted = useMemo(() => {
    return completedInvoices.filter(b => {
      if (processSearch.trim()) {
        const q = processSearch.toLowerCase()
        const match =
          (b.invoice_number || '').toLowerCase().includes(q) ||
          (b.customer_name || '').toLowerCase().includes(q) ||
          (b.customer_phone || '').toLowerCase().includes(q)
        if (!match) return false
      }
      if (!checkDateMatch(b.created_at, processDateFilter, processStartDate, processEndDate)) {
        return false
      }
      if (processPaymentMethod) {
        if ((b.payment_method || '').toLowerCase() !== processPaymentMethod.toLowerCase()) {
          return false
        }
      }
      return true
    })
  }, [completedInvoices, processSearch, processDateFilter, processStartDate, processEndDate, processPaymentMethod])

  const hasActiveReturnFilters = Boolean(
    returnSearch.trim() ||
    (returnDateFilter && returnDateFilter !== 'all') ||
    returnMethodFilter ||
    returnStartDate ||
    returnEndDate
  )

  const handleClearReturnFilters = () => {
    setReturnSearch('')
    setReturnDateFilter('all')
    setReturnStartDate('')
    setReturnEndDate('')
    setReturnMethodFilter('')
  }

  const hasActiveInvoiceFilters = Boolean(
    invoiceSearch.trim() ||
    invoiceStatusFilter !== 'all' ||
    (invoiceDateFilter && invoiceDateFilter !== 'all') ||
    invoicePaymentMethod ||
    invoiceStartDate ||
    invoiceEndDate
  )

  const handleClearInvoiceFilters = () => {
    setInvoiceSearch('')
    setInvoiceStatusFilter('all')
    setInvoiceDateFilter('all')
    setInvoiceStartDate('')
    setInvoiceEndDate('')
    setInvoicePaymentMethod('')
  }

  const hasActiveProcessFilters = Boolean(
    processSearch.trim() ||
    (processDateFilter && processDateFilter !== 'all') ||
    processPaymentMethod ||
    processStartDate ||
    processEndDate
  )

  const handleClearProcessFilters = () => {
    setProcessSearch('')
    setProcessDateFilter('all')
    setProcessStartDate('')
    setProcessEndDate('')
    setProcessPaymentMethod('')
  }

  const toggleExpand = (id) => setExpandedReturns(prev => ({ ...prev, [id]: !prev[id] }))

  const cancelInvoice = async () => {
    if (!cancelTarget || cancelling) return
    setCancelling(true)
    try {
      const response = await api.post(`/invoices/${cancelTarget.id}/cancel/`, {
        reason: cancelReason.trim() || 'Customer requested cancellation',
      })
      toast.success(response.data?.message || (response.data?.requires_approval
        ? 'Invoice cancellation submitted for approval'
        : 'Invoice cancelled and preserved in records'))
      setCancelTarget(null)
      setCancelReason('Customer requested cancellation')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.detail || 'Failed to cancel invoice')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-0.5">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[var(--muted-light)]">
            <IconRotate2 size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Sales / Returns</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)]">Returns &amp; Refunds</h1>
          <p className="mt-0.5 text-xs text-[var(--muted)] max-w-2xl">Review returned items, refunded invoices, and process new returns.</p>
        </div>

        <div className="flex w-full sm:w-auto items-center justify-between sm:justify-end gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn-secondary inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold shadow-none transition"
            title="Refresh returns data"
          >
            <IconRefresh size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/sales/invoices')}
            className="btn-secondary inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold shadow-none transition"
            title="View Invoices"
          >
            <IconReceipt size={14} />
            <span>Invoices</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/billing/new')}
            className="btn-primary inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-bold text-white shadow-none transition"
          >
            <IconPlus size={15} />
            <span>New Bill</span>
          </button>
        </div>
      </div>

      {/* Return & Refund Summary (Responsive 4-card 2x2 Grid) */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x divide-[var(--line)]">
          <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
              Total Returns
            </span>
            <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[var(--ink)] tabular-nums truncate">
              {returns.length + refundedInvoices.length}
            </p>
            <p className="text-[10px] text-[var(--muted)] truncate">Recorded returns</p>
          </div>
          <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
              Refunded Invoices
            </span>
            <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums truncate">
              {refundedInvoices.length}
            </p>
            <p className="text-[10px] text-[var(--muted)] truncate">Complete refunds</p>
          </div>
          <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
              Cancelled Invoices
            </span>
            <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[var(--muted)] tabular-nums truncate">
              {cancelledInvoices.length}
            </p>
            <p className="text-[10px] text-[var(--muted)] truncate">Voided sales</p>
          </div>
          <div className="px-3.5 py-2 sm:px-4 sm:py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
              Value Refunded
            </span>
            <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums truncate">
              {fmt(totalRefunded)}
            </p>
            <p className="text-[10px] text-[var(--muted)] truncate">Total refund amount</p>
          </div>
        </div>
      </div>

      {/* Section Switcher Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
        {[
          { id: 'all', label: 'All Sections', count: returns.length + cancelledInvoices.length + refundedInvoices.length },
          { id: 'returns', label: 'Sales Returns', count: returns.length, icon: IconRotate2 },
          { id: 'invoices', label: 'Cancelled & Refunded', count: cancelledInvoices.length + refundedInvoices.length, icon: IconPackageOff },
          { id: 'process', label: 'Process New Return', count: completedInvoices.length, icon: IconPlus },
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`shrink-0 inline-flex items-center gap-1.5 min-h-[36px] px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
              activeTab === t.id
                ? 'bg-[var(--primary)] border-[var(--primary)] text-white dark:text-slate-900 shadow-2xs'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            {t.icon && <t.icon size={14} />}
            <span>{t.label}</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
              activeTab === t.id
                ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900'
                : 'bg-[var(--surface-subtle)] text-[var(--muted)]'
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Sales Returns (item-level) */}
      {(activeTab === 'all' || activeTab === 'returns') && (
        <div className="bg-[var(--surface)] rounded-lg border border-[var(--line)] shadow-none overflow-hidden min-w-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[var(--line-subtle)] bg-[var(--surface)]">
            <div className="flex items-center gap-2 min-w-0">
              <IconRotate2 size={16} className="text-[#1E3A5F] dark:text-slate-300 flex-shrink-0" />
              <h2 className="font-semibold text-[var(--ink)] text-sm sm:text-base leading-5 tracking-tight truncate">
                Sales Returns (Item-level)
              </h2>
              <span className="rounded-sm bg-[var(--surface-elevated)] border border-[var(--line)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted)]">
                {filteredReturns.length < returns.length ? `${filteredReturns.length} of ${returns.length}` : returns.length}
              </span>
            </div>
            {hasActiveReturnFilters && (
              <button
                type="button"
                onClick={handleClearReturnFilters}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1 font-medium"
              >
                <IconX size={13} />
                <span>Reset filters</span>
              </button>
            )}
          </div>

          {/* ERP Filter Panel */}
          <div className="p-3 sm:p-4 bg-[var(--surface-elevated)]/40 border-b border-[var(--line-subtle)] space-y-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Filter by Date
              </span>
              <DatePresetSelector
                value={returnDateFilter}
                onChange={v => {
                  setReturnDateFilter(v)
                  if (v !== 'custom') {
                    setReturnStartDate('')
                    setReturnEndDate('')
                  }
                }}
              />
            </div>

            {returnDateFilter === 'custom' && (
              <CustomDateRangePicker
                startDate={returnStartDate}
                endDate={returnEndDate}
                onStartChange={setReturnStartDate}
                onEndChange={setReturnEndDate}
                onClear={() => { setReturnStartDate(''); setReturnEndDate('') }}
              />
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <SearchInput
                value={returnSearch}
                onChange={e => setReturnSearch(e.target.value)}
                onClear={() => setReturnSearch('')}
                placeholder="Search returns by return #, invoice #, customer, reason..."
                className="flex-1"
              />
              <select
                value={returnMethodFilter}
                onChange={e => setReturnMethodFilter(e.target.value)}
                aria-label="Filter by refund method"
                className="input h-9 px-3 text-xs rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] sm:w-44 capitalize cursor-pointer"
              >
                <option value="">All Refund Methods</option>
                {REFUND_METHODS.map(m => (
                  <option key={m} value={m}>{m.toUpperCase()}</option>
                ))}
              </select>
              {hasActiveReturnFilters && (
                <button
                  type="button"
                  onClick={handleClearReturnFilters}
                  className="btn-secondary min-h-[36px] sm:h-9 px-3 text-xs inline-flex items-center justify-center gap-1 text-rose-600 dark:text-rose-400 border border-[var(--line)] hover:bg-rose-50 dark:hover:bg-rose-950/30 transition shrink-0 font-medium"
                >
                  <IconX size={14} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {loading ? <Spinner /> : (
            <>
              <div className="hidden md:block overflow-x-auto min-h-[180px] pb-4">
                <table className="table min-w-[1180px] [&_th]:whitespace-nowrap [&_td]:align-middle">
                  <thead>
                    <tr>
                      <th>Return #</th>
                      <th>Invoice</th>
                      <th>Customer</th>
                      <th>Returned At</th>
                      <th className="text-center">Items</th>
                      <th>Refund Method</th>
                      <th className="text-right">Refund Amount</th>
                      <th>Reason</th>
                      <th>Processed By</th>
                      <th className="text-center">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturns.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-12 text-[var(--muted-light)]">
                          <div className="flex flex-col items-center gap-2">
                            <IconRotate2 size={28} className="opacity-30" />
                            <span className="text-sm font-medium">No sales returns found</span>
                            {hasActiveReturnFilters && (
                              <button
                                type="button"
                                onClick={handleClearReturnFilters}
                                className="text-xs text-[var(--primary)] underline font-medium mt-1"
                              >
                                Clear filters to see all returns
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : filteredReturns.map(r => (
                      <Fragment key={r.id}>
                        <tr>
                          <td className="font-mono font-semibold text-[#1E3A5F] dark:text-slate-200 text-sm">{r.return_number}</td>
                          <td className="font-mono text-sm text-[var(--muted)]">{r.invoice_number || `#${r.invoice}`}</td>
                          <td className="text-sm text-[var(--ink-secondary)]">{r.customer_name || '—'}</td>
                          <td className="text-sm text-[var(--muted)]">{r.created_at ? formatDateTime(r.created_at) : '—'}</td>
                          <td className="text-center text-sm font-mono text-[var(--muted)]">{(r.items || []).length}</td>
                          <td className="text-sm text-[var(--muted)] capitalize">{r.refund_method || '—'}</td>
                          <td className="text-right font-mono font-bold text-[var(--ink)] text-sm">{fmt(r.refund_amount)}</td>
                          <td className="text-xs text-[var(--muted-light)] max-w-[180px] truncate" title={r.reason}>{r.reason || '—'}</td>
                          <td className="text-sm text-[var(--muted)]">{r.created_by_name || (r.created_by ? `User #${r.created_by}` : '—')}</td>
                          <td className="text-center">
                            <button onClick={() => toggleExpand(r.id)} className="w-8 h-8 inline-flex items-center justify-center text-[var(--ink-secondary)] bg-[var(--surface)] border border-[var(--line)] rounded-md hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-all active:scale-95" aria-label="Toggle return details">
                              {expandedReturns[r.id] ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                            </button>
                          </td>
                        </tr>
                        {expandedReturns[r.id] && (
                          <tr className="bg-[var(--surface-elevated)]">
                            <td colSpan={10} className="p-0">
                              <div className="grid gap-3 border-t border-[var(--line)] p-4 text-xs sm:grid-cols-3">
                                <div>
                                  <div className="font-semibold uppercase tracking-wide text-[var(--muted)]">Return ID</div>
                                  <div className="mt-1 font-mono font-semibold text-[var(--ink)]">{r.return_number || `#${r.id}`}</div>
                                </div>
                                <div>
                                  <div className="font-semibold uppercase tracking-wide text-[var(--muted)]">Bill / Invoice</div>
                                  <div className="mt-1 font-mono font-semibold text-[var(--ink)]">{r.invoice_number || `#${r.invoice}`}</div>
                                </div>
                                <div>
                                  <div className="font-semibold uppercase tracking-wide text-[var(--muted)]">Return reason</div>
                                  <div className="mt-1 font-mono font-semibold text-[var(--ink)]">{r.reason || 'No reason provided.'}</div>
                                </div>
                              </div>
                              <table className="erp-table w-full text-xs border-t border-[var(--line)]">
                                <thead>
                                  <tr className="bg-[var(--surface)]">
                                    <th className="pl-8 py-1.5 text-left font-semibold text-[var(--muted)] uppercase tracking-wide">Product</th>
                                    <th className="py-1.5 text-center font-semibold text-[var(--muted)] uppercase tracking-wide">Qty</th>
                                    <th className="py-1.5 text-right font-semibold text-[var(--muted)] uppercase tracking-wide">Unit Price</th>
                                    <th className="py-1.5 pr-4 text-right font-semibold text-[var(--muted)] uppercase tracking-wide">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(r.items || []).length === 0 ? (
                                    <tr>
                                      <td colSpan={4} className="py-4 text-center text-[var(--muted)]">No returned item details available.</td>
                                    </tr>
                                  ) : (r.items || []).map(it => (
                                    <tr key={`${r.id}-${it.id}`}>
                                      <td className="pl-8 py-1.5 text-[var(--ink-secondary)] font-medium">{it.product_name}</td>
                                      <td className="py-1.5 text-center text-[var(--muted)]">{it.quantity}</td>
                                      <td className="py-1.5 text-right text-[var(--muted)]">{fmt(it.unit_price)}</td>
                                      <td className="py-1.5 pr-4 text-right font-semibold text-[var(--ink-secondary)]">{fmt(it.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden p-3 space-y-3">
                {filteredReturns.length === 0 ? (
                  <div className="text-center py-10 text-[var(--muted-light)] text-sm">
                    <p>No sales returns found</p>
                    {hasActiveReturnFilters && (
                      <button
                        type="button"
                        onClick={handleClearReturnFilters}
                        className="text-xs text-[var(--primary)] underline font-medium mt-1"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : filteredReturns.map(r => (
                  <div key={r.id} className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-none transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-[#1E3A5F] dark:text-slate-200 text-sm break-all">{r.return_number}</div>
                        <div className="font-mono text-xs text-[var(--muted)] mt-0.5">{r.invoice_number}</div>
                      </div>
                      <button onClick={() => toggleExpand(r.id)} className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-md bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)]" aria-label="Toggle return details">
                        {expandedReturns[r.id] ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[var(--line-subtle)] pt-2">
                      <InfoRow label="Customer" value={r.customer_name || '—'} />
                      <InfoRow label="Date" value={r.created_at ? formatDateTime(r.created_at) : '—'} />
                      <InfoRow label="Items" value={(r.items || []).length} />
                      <InfoRow label="Method" value={r.refund_method || '—'} valueClass="capitalize" />
                      <InfoRow label="Processed by" value={r.created_by_name || (r.created_by ? `User #${r.created_by}` : '—')} />
                      <InfoRow label="Refund" value={fmt(r.refund_amount)} valueClass="font-bold" />
                    </div>
                    <div className="mt-2 text-xs text-[var(--muted-light)] break-words"><span className="font-medium text-[var(--muted)]">Reason:</span> {r.reason || '—'}</div>
                    {expandedReturns[r.id] && (r.items || []).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[var(--line-subtle)] space-y-2">
                        {(r.items || []).map(it => (
                          <div key={`${r.id}-${it.id}`} className="rounded-lg border border-[var(--line-subtle)] bg-[var(--surface-elevated)] p-3">
                            <div className="text-xs font-medium text-[var(--ink-secondary)] break-words">{it.product_name}</div>
                            <div className="flex justify-between gap-3 mt-1 text-xs text-[var(--muted)]">
                              <span>Qty: {it.quantity}</span>
                              <span>@ {fmt(it.unit_price)}</span>
                              <span className="font-semibold text-[var(--ink-secondary)]">{fmt(it.total)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Cancelled / Refunded invoices */}
      {(activeTab === 'all' || activeTab === 'invoices') && (
        <div className="bg-[var(--surface)] rounded-lg border border-[var(--line)] shadow-none overflow-hidden min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[var(--line-subtle)] bg-[var(--surface)]">
            <div className="flex items-center gap-2">
              <IconPackageOff size={16} className="text-rose-600" />
              <h2 className="font-semibold text-[var(--ink)] text-sm sm:text-base leading-5 tracking-tight">Cancelled &amp; Refunded Invoices</h2>
              <span className="rounded-sm bg-[var(--surface-elevated)] border border-[var(--line)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted)]">
                {filteredCancelledRefunded.length < (cancelledInvoices.length + refundedInvoices.length)
                  ? `${filteredCancelledRefunded.length} of ${cancelledInvoices.length + refundedInvoices.length}`
                  : (cancelledInvoices.length + refundedInvoices.length)}
              </span>
            </div>
            {hasActiveInvoiceFilters && (
              <button
                type="button"
                onClick={handleClearInvoiceFilters}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1 font-medium"
              >
                <IconX size={13} />
                <span>Reset filters</span>
              </button>
            )}
          </div>

          {/* ERP Filter Panel */}
          <div className="p-3 sm:p-4 bg-[var(--surface-elevated)]/40 border-b border-[var(--line-subtle)] space-y-2.5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              {/* Status pills */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {[
                  { key: 'all', label: 'All', count: cancelledInvoices.length + refundedInvoices.length },
                  { key: 'refunded', label: 'Refunded', count: refundedInvoices.length },
                  { key: 'cancelled', label: 'Cancelled', count: cancelledInvoices.length },
                ].map(st => (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => setInvoiceStatusFilter(st.key)}
                    className={`shrink-0 inline-flex items-center gap-1.5 min-h-[32px] px-2.5 rounded-md text-xs font-semibold border transition ${
                      invoiceStatusFilter === st.key
                        ? 'bg-[var(--primary)] border-[var(--primary)] text-white dark:text-slate-900 shadow-2xs'
                        : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <span>{st.label}</span>
                    <span className={`text-[10px] font-mono px-1 rounded-full ${
                      invoiceStatusFilter === st.key
                        ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900'
                        : 'bg-[var(--surface-subtle)] text-[var(--muted)]'
                    }`}>
                      {st.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Date Presets */}
              <DatePresetSelector
                value={invoiceDateFilter}
                onChange={v => {
                  setInvoiceDateFilter(v)
                  if (v !== 'custom') {
                    setInvoiceStartDate('')
                    setInvoiceEndDate('')
                  }
                }}
              />
            </div>

            {invoiceDateFilter === 'custom' && (
              <CustomDateRangePicker
                startDate={invoiceStartDate}
                endDate={invoiceEndDate}
                onStartChange={setInvoiceStartDate}
                onEndChange={setInvoiceEndDate}
                onClear={() => { setInvoiceStartDate(''); setInvoiceEndDate('') }}
              />
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <SearchInput
                value={invoiceSearch}
                onChange={e => setInvoiceSearch(e.target.value)}
                onClear={() => setInvoiceSearch('')}
                placeholder="Search by invoice #, customer, cancelled by, reason..."
                className="flex-1"
              />
              <select
                value={invoicePaymentMethod}
                onChange={e => setInvoicePaymentMethod(e.target.value)}
                aria-label="Filter by payment method"
                className="input h-9 px-3 text-xs rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] sm:w-44 capitalize cursor-pointer"
              >
                <option value="">All Payment Methods</option>
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m.toUpperCase()}</option>
                ))}
              </select>
              {hasActiveInvoiceFilters && (
                <button
                  type="button"
                  onClick={handleClearInvoiceFilters}
                  className="btn-secondary min-h-[36px] sm:h-9 px-3 text-xs inline-flex items-center justify-center gap-1 text-rose-600 dark:text-rose-400 border border-[var(--line)] hover:bg-rose-50 dark:hover:bg-rose-950/30 transition shrink-0 font-medium"
                >
                  <IconX size={14} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {loading ? <Spinner /> : (
            <>
              <div className="hidden md:block overflow-x-auto min-h-[180px] pb-4">
                <table className="table min-w-[1000px] [&_th]:whitespace-nowrap [&_td]:align-middle">
                  <thead>
                    <tr>
                      <th>Invoice</th><th>Customer</th><th>Date</th><th>Payment</th>
                      <th className="text-right">Subtotal</th><th className="text-right">Discount</th>
                      <th className="text-right">GST</th><th className="text-right">Grand Total</th>
                      <th>Status</th><th>Cancelled By</th><th>Reason</th><th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCancelledRefunded.length === 0 ? (
                      <tr><td colSpan={12} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-[var(--muted-light)]">
                          <IconRotate2 size={28} className="opacity-30" />
                          <span className="text-sm font-medium">No records found</span>
                          {hasActiveInvoiceFilters && (
                            <button
                              type="button"
                              onClick={handleClearInvoiceFilters}
                              className="text-xs text-[var(--primary)] underline font-medium mt-1"
                            >
                              Clear filters to view all records
                            </button>
                          )}
                        </div>
                      </td></tr>
                    ) : filteredCancelledRefunded.map(b => (
                      <tr key={b.id}>
                        <td className="font-mono font-semibold text-[#1E3A5F] dark:text-slate-200 text-sm">{b.invoice_number}</td>
                        <td className="text-sm text-[var(--ink-secondary)]">{b.customer_name || 'Walk-in'}</td>
                        <td className="text-sm text-[var(--muted)]">{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="text-sm text-[var(--muted)] capitalize">{b.payment_method}</td>
                        <td className="text-right font-mono text-sm text-[var(--muted)]">{fmt(b.subtotal)}</td>
                        <td className="text-right font-mono text-sm text-green-600 dark:text-green-400">{Number(b.discount_amount) > 0 ? fmt(b.discount_amount) : '—'}</td>
                        <td className="text-right font-mono text-sm text-[var(--muted)]">{Number(b.tax_amount) > 0 ? fmt(b.tax_amount) : '—'}</td>
                        <td className="text-right font-mono font-bold text-[var(--ink)] text-sm">{fmt(b.grand_total)}</td>
                        <td><Badge status={b.status} /></td>
                        <td className="text-sm text-[var(--muted)]">{b.cancelled_by_name || '—'}</td>
                        <td className="text-xs text-[var(--muted-light)] max-w-[160px] truncate" title={b.cancel_reason}>{b.cancel_reason || '—'}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setViewModal(b)} className="w-8 h-8 inline-flex items-center justify-center text-[var(--ink-secondary)] bg-[var(--surface)] border border-[var(--line)] rounded-md hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] transition-all active:scale-95" title="View" aria-label="View invoice">
                              <IconEye size={14} />
                            </button>
                            <a href={`${API_BASE_URL}/invoices/${b.id}/pdf/?token=${getAccessToken()}`}
                              target="_blank" rel="noreferrer" className="w-8 h-8 inline-flex items-center justify-center text-[var(--ink-secondary)] bg-[var(--surface)] border border-[var(--line)] rounded-md hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] transition-all active:scale-95" title="Print" aria-label="Print invoice">
                              <IconPrinter size={14} />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden p-3 space-y-3">
                {filteredCancelledRefunded.length === 0 ? (
                  <div className="text-center py-12 text-[var(--muted-light)]">
                    <div className="flex flex-col items-center gap-2">
                      <IconRotate2 size={28} className="opacity-30" />
                      <span className="text-sm font-medium">No records found</span>
                      {hasActiveInvoiceFilters && (
                        <button
                          type="button"
                          onClick={handleClearInvoiceFilters}
                          className="text-xs text-[var(--primary)] underline font-medium mt-1"
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </div>
                ) : filteredCancelledRefunded.map(b => (
                  <div key={b.id} className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-none transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-[#1E3A5F] dark:text-slate-200 text-sm break-all">{b.invoice_number}</div>
                        <div className="text-sm text-[var(--ink-secondary)] mt-1 break-words">{b.customer_name || 'Walk-in'}</div>
                      </div>
                      <Badge status={b.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 pt-2 border-t border-[var(--line-subtle)]">
                      <InfoRow label="Date" value={new Date(b.created_at).toLocaleDateString('en-IN')} />
                      <InfoRow label="Payment" value={b.payment_method} valueClass="capitalize" />
                      <InfoRow label="Subtotal" value={fmt(b.subtotal)} />
                      {Number(b.discount_amount) > 0 && <InfoRow label="Discount" value={fmt(b.discount_amount)} valueClass="text-green-600 dark:text-green-400" />}
                      {Number(b.tax_amount) > 0 && <InfoRow label="GST" value={fmt(b.tax_amount)} />}
                      {b.cancelled_by_name && <InfoRow label="Cancelled By" value={b.cancelled_by_name} />}
                    </div>
                    {b.cancel_reason && (
                      <div className="mt-2 text-xs text-[var(--muted-light)] break-words"><span className="font-medium text-[var(--muted)]">Reason:</span> {b.cancel_reason}</div>
                    )}
                    <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-[var(--line-subtle)]">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-[var(--muted-light)]">Grand Total</div>
                        <div className="text-base font-bold text-[var(--ink)]">{fmt(b.grand_total)}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setViewModal(b)} className="min-h-[38px] px-2.5 inline-flex items-center justify-center gap-1 text-[var(--ink-secondary)] rounded-md bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] transition-all active:scale-95 text-xs font-semibold" title="View" aria-label="View invoice">
                          <IconEye size={14} />
                          <span>View</span>
                        </button>
                        <a href={`${API_BASE_URL}/invoices/${b.id}/pdf/?token=${getAccessToken()}`}
                          target="_blank" rel="noreferrer" className="min-h-[38px] px-2.5 inline-flex items-center justify-center gap-1 text-[var(--ink-secondary)] rounded-md bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] transition-all active:scale-95 text-xs font-semibold" title="Print" aria-label="Print invoice">
                          <IconPrinter size={14} />
                          <span>Print</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* New Return from completed invoices */}
      {(activeTab === 'all' || activeTab === 'process') && (
        <div className="bg-[var(--surface)] rounded-md border border-[var(--line)] shadow-none overflow-hidden min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-[var(--line-subtle)] bg-[var(--surface)]">
            <div className="flex items-center gap-2">
              <IconRotate2 size={16} className="text-[#1E3A5F] dark:text-slate-300" />
              <h2 className="font-semibold text-[var(--ink)] text-base leading-5 tracking-tight">Process New Return</h2>
              <span className="text-xs text-[var(--muted-light)]">— select a completed invoice</span>
              <span className="rounded-sm bg-[var(--surface-elevated)] border border-[var(--line)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted)]">
                {filteredCompleted.length < completedInvoices.length ? `${filteredCompleted.length} of ${completedInvoices.length}` : completedInvoices.length}
              </span>
            </div>
            {hasActiveProcessFilters && (
              <button
                type="button"
                onClick={handleClearProcessFilters}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1 font-medium"
              >
                <IconX size={13} />
                <span>Reset filters</span>
              </button>
            )}
          </div>

          {/* ERP Filter Panel */}
          <div className="p-3 sm:p-4 bg-[var(--surface-elevated)]/40 border-b border-[var(--line-subtle)] space-y-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Filter by Bill Date
              </span>
              <DatePresetSelector
                value={processDateFilter}
                onChange={v => {
                  setProcessDateFilter(v)
                  if (v !== 'custom') {
                    setProcessStartDate('')
                    setProcessEndDate('')
                  }
                }}
              />
            </div>

            {processDateFilter === 'custom' && (
              <CustomDateRangePicker
                startDate={processStartDate}
                endDate={processEndDate}
                onStartChange={setProcessStartDate}
                onEndChange={setProcessEndDate}
                onClear={() => { setProcessStartDate(''); setProcessEndDate('') }}
              />
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <SearchInput
                value={processSearch}
                onChange={e => setProcessSearch(e.target.value)}
                onClear={() => setProcessSearch('')}
                placeholder="Search completed invoice #, customer name or phone to return..."
                className="flex-1"
              />
              <select
                value={processPaymentMethod}
                onChange={e => setProcessPaymentMethod(e.target.value)}
                aria-label="Filter by payment method"
                className="input h-9 px-3 text-xs rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] sm:w-44 capitalize cursor-pointer"
              >
                <option value="">All Payment Methods</option>
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m.toUpperCase()}</option>
                ))}
              </select>
              {hasActiveProcessFilters && (
                <button
                  type="button"
                  onClick={handleClearProcessFilters}
                  className="btn-secondary min-h-[36px] sm:h-9 px-3 text-xs inline-flex items-center justify-center gap-1 text-rose-600 dark:text-rose-400 border border-[var(--line)] hover:bg-rose-50 dark:hover:bg-rose-950/30 transition shrink-0 font-medium"
                >
                  <IconX size={14} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {loading ? <Spinner /> : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="table min-w-[860px] [&_th]:whitespace-nowrap [&_td]:align-middle">
                  <thead>
                    <tr>
                      <th>Invoice</th><th>Customer</th><th>Date</th><th>Payment</th>
                      <th className="text-center">Items</th><th className="text-right">Discount</th>
                      <th className="text-right">GST</th><th className="text-right">Grand Total</th>
                      <th>Pay Status</th><th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompleted.slice(0, processLimit).length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-10 text-[var(--muted-light)] text-sm">
                          <div className="flex flex-col items-center gap-2">
                            <IconRotate2 size={28} className="opacity-30" />
                            <span className="text-sm font-medium">No completed invoices found</span>
                            {hasActiveProcessFilters && (
                              <button
                                type="button"
                                onClick={handleClearProcessFilters}
                                className="text-xs text-[var(--primary)] underline font-medium mt-1"
                              >
                                Clear filters to see all completed bills
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : filteredCompleted.slice(0, processLimit).map(b => (
                      <tr key={b.id}>
                        <td className="font-mono font-semibold text-[#1E3A5F] dark:text-slate-200 text-sm">{b.invoice_number}</td>
                        <td className="text-sm text-[var(--ink-secondary)]">{b.customer_name || 'Walk-in'}</td>
                        <td className="text-sm text-[var(--muted)]">{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="text-sm text-[var(--muted)] capitalize">{b.payment_method}</td>
                        <td className="text-center text-sm font-mono text-[var(--muted)]">{(b.items || []).length}</td>
                        <td className="text-right font-mono text-sm text-green-600 dark:text-green-400">{Number(b.discount_amount) > 0 ? fmt(b.discount_amount) : '—'}</td>
                        <td className="text-right font-mono text-sm text-[var(--muted)]">{Number(b.tax_amount) > 0 ? fmt(b.tax_amount) : '—'}</td>
                        <td className="text-right font-mono font-bold text-[var(--ink)] text-sm">{fmt(b.grand_total)}</td>
                        <td><Badge status={b.payment_status} /></td>
                        <td className="text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button onClick={() => { setCancelTarget(b); setCancelReason('Customer requested cancellation') }}
                              className="btn-secondary min-h-8 text-xs px-2.5 py-1 rounded-md font-semibold inline-flex items-center justify-center gap-1.5 text-rose-600">
                              <IconFileX size={12} /> Cancel Bill
                            </button>
                            <button onClick={() => setReturnModal(b)}
                              className="btn-danger min-h-8 text-xs px-2.5 py-1 rounded-md font-semibold inline-flex items-center justify-center gap-1.5">
                              <IconRotate2 size={12} /> Return
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredCompleted.length > processLimit && (
                <div className="p-3 text-center border-t border-[var(--line-subtle)] bg-[var(--surface)]">
                  <button
                    type="button"
                    onClick={() => setProcessLimit(prev => prev + 50)}
                    className="btn-secondary text-xs px-4 py-1.5 font-semibold"
                  >
                    Load more invoices ({filteredCompleted.length - processLimit} remaining)
                  </button>
                </div>
              )}

              <div className="md:hidden p-3 space-y-3">
                {filteredCompleted.slice(0, processLimit).length === 0 ? (
                  <div className="text-center py-8 text-[var(--muted-light)] text-sm">
                    <p>No completed invoices found</p>
                    {hasActiveProcessFilters && (
                      <button
                        type="button"
                        onClick={handleClearProcessFilters}
                        className="text-xs text-[var(--primary)] underline font-medium mt-1"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                ) : filteredCompleted.slice(0, processLimit).map(b => (
                  <div key={b.id} className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-none transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-[#1E3A5F] dark:text-slate-200 text-sm break-all">{b.invoice_number}</div>
                        <div className="text-sm text-[var(--ink-secondary)] mt-1 break-words">{b.customer_name || 'Walk-in'}</div>
                      </div>
                      <Badge status={b.payment_status} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 pt-2 border-t border-[var(--line-subtle)]">
                      <InfoRow label="Date" value={new Date(b.created_at).toLocaleDateString('en-IN')} />
                      <InfoRow label="Payment" value={b.payment_method} valueClass="capitalize" />
                      <InfoRow label="Items" value={(b.items || []).length} />
                      {Number(b.discount_amount) > 0 && <InfoRow label="Discount" value={fmt(b.discount_amount)} valueClass="text-green-600 dark:text-green-400" />}
                      {Number(b.tax_amount) > 0 && <InfoRow label="GST" value={fmt(b.tax_amount)} />}
                    </div>
                    <div className="flex items-end justify-between gap-3 mt-3 pt-3 border-t border-[var(--line-subtle)]">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-[var(--muted-light)]">Grand Total</div>
                        <div className="text-base font-bold text-[var(--ink)]">{fmt(b.grand_total)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setCancelTarget(b); setCancelReason('Customer requested cancellation') }}
                          className="btn-secondary min-h-[40px] px-3 text-xs rounded-md font-semibold inline-flex items-center justify-center gap-1.5 text-rose-600">
                          <IconFileX size={13} /> <span>Cancel Bill</span>
                        </button>
                        <button onClick={() => setReturnModal(b)}
                          className="btn-danger min-h-[40px] px-3.5 text-xs rounded-md font-bold inline-flex items-center justify-center gap-1.5 shrink-0 shadow-xs active:scale-95 transition">
                          <IconRotate2 size={13} /> <span>Return</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredCompleted.length > processLimit && (
                <div className="md:hidden p-3 text-center border-t border-[var(--line-subtle)] bg-[var(--surface)]">
                  <button
                    type="button"
                    onClick={() => setProcessLimit(prev => prev + 50)}
                    className="btn-secondary w-full text-xs py-2 font-semibold"
                  >
                    Load more invoices ({filteredCompleted.length - processLimit} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ReturnModal open={!!returnModal} onClose={() => setReturnModal(null)} invoice={returnModal} onDone={load} />
      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => !cancelling && setCancelTarget(null)}
        title={`Cancel Bill${cancelTarget?.invoice_number ? ` — ${cancelTarget.invoice_number}` : ''}`}
      >
        <div className="space-y-4 text-sm">
          <p className="text-[var(--muted)]">The invoice will be marked cancelled and retained in your records. Inventory and ledger adjustments will be reversed.</p>
          <div>
            <label htmlFor="return-cancel-reason" className="mb-1.5 block text-xs font-semibold text-[var(--ink-secondary)]">Cancellation reason</label>
            <textarea
              id="return-cancel-reason"
              value={cancelReason}
              onChange={event => setCancelReason(event.target.value)}
              rows={3}
              className="input w-full resize-y p-2.5 text-xs"
              placeholder="Why is this bill being cancelled?"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCancelTarget(null)} disabled={cancelling} className="btn-secondary px-4 text-xs">Keep Bill</button>
            <button type="button" onClick={cancelInvoice} disabled={cancelling} className="btn-danger px-4 text-xs font-semibold">{cancelling ? 'Cancelling…' : 'Confirm Cancel'}</button>
          </div>
        </div>
      </Modal>
      <ViewModal open={!!viewModal} onClose={() => setViewModal(null)} invoice={viewModal} />
      <MobileFAB icon={IconPlus} label="New Bill" to="/billing/new" />
    </div>
  )
}
