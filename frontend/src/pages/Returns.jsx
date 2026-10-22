import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { API_BASE_URL } from '../api'
import { getAccessToken } from '../services/tokenStorage'
import { Badge, Spinner, Modal } from '../components/UI'
import {
  IconRotate2,
  IconRefresh,
  IconPackageOff,
  IconCurrencyRupee,
  IconFileX,
  IconTrendingDown,
  IconEye,
  IconChevronDown,
  IconChevronUp,
  IconPrinter,
  IconAlertCircle,
  IconPlus,
  IconReceipt,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'

const fmt = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'refunded', label: 'Refunded' },
  { key: 'cancelled', label: 'Cancelled' },
]

function InfoRow({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-[var(--muted-light)] shrink-0">{label}</span>
      <span className={`text-xs font-medium text-[var(--ink-secondary)] text-right min-w-0 break-words ${valueClass}`}>{value}</span>
    </div>
  )
}

const REFUND_METHODS = ['cash', 'UPI', 'card', 'online']

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
          <InfoRow label="Date" value={new Date(invoice.created_at).toLocaleString('en-IN')} />
          <InfoRow label="Payment Method" value={invoice.payment_method} valueClass="capitalize" />
          <InfoRow label="Payment Status" value={<Badge status={invoice.payment_status} />} />
          <InfoRow label="Invoice Status" value={<Badge status={invoice.status} />} />
          {invoice.place_of_supply && <InfoRow label="Place of Supply" value={invoice.place_of_supply} />}
          {invoice.created_by_name && <InfoRow label="Created By" value={invoice.created_by_name} />}
          {invoice.cancelled_by_name && <InfoRow label="Cancelled By" value={invoice.cancelled_by_name} />}
          {invoice.cancelled_at && <InfoRow label="Cancelled At" value={new Date(invoice.cancelled_at).toLocaleString('en-IN')} />}
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
  const [filter, setFilter] = useState('all')
  const [returnModal, setReturnModal] = useState(null)
  const [viewModal, setViewModal] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('Customer requested cancellation')
  const [cancelling, setCancelling] = useState(false)
  const [expandedReturns, setExpandedReturns] = useState({})
  const [returnSearch, setReturnSearch] = useState('')

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
    if (!returnSearch.trim()) return returns
    const q = returnSearch.toLowerCase()
    return returns.filter(r =>
      (r.return_number || '').toLowerCase().includes(q) ||
      (r.invoice_number || '').toLowerCase().includes(q) ||
      (r.customer_name || '').toLowerCase().includes(q) ||
      (r.reason || '').toLowerCase().includes(q)
    )
  }, [returns, returnSearch])

  const stats = [
    { label: 'Total Returns', value: returns.length + refundedInvoices.length, icon: IconRotate2 },
    { label: 'Refunded', value: refundedInvoices.length, icon: IconCurrencyRupee },
    { label: 'Cancelled', value: cancelledInvoices.length, icon: IconFileX },
    { label: 'Value Refunded', value: fmt(totalRefunded), icon: IconTrendingDown },
  ]

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

        <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:items-center sm:gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn-secondary inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold shadow-none transition"
            title="Refresh returns list"
          >
            <IconRefresh size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
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

      {/* Return & Refund Summary (Responsive KPI Grid) */}
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

      {/* Sales Returns (item-level) */}
      <div className="bg-[var(--surface)] rounded-lg border border-[var(--line)] shadow-none overflow-hidden min-w-0">

  {/* Header */}
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[var(--line-subtle)] bg-[var(--surface)]">

    {/* Title */}
    <div className="flex items-center gap-2 min-w-0">
      <IconRotate2
        size={16}
        className="text-[#1E3A5F] dark:text-slate-300 flex-shrink-0"
      />

      <h2 className="font-semibold text-[var(--ink)] text-sm sm:text-base leading-5 tracking-tight truncate">
        Sales Returns (Item-level)
      </h2>
      <span className="rounded-sm bg-[var(--surface-elevated)] border border-[var(--line)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted)]">
        {filteredReturns.length}
      </span>
    </div>

    <div className="flex items-center gap-2 w-full sm:w-auto">
      {/* Search bar */}
      <div className="group relative flex items-center min-h-[38px] w-full sm:w-64 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 transition-all duration-200 hover:border-slate-300 dark:hover:border-slate-600 focus-within:border-[#1E3A5F] focus-within:ring-2 focus-within:ring-[#1E3A5F]/15 dark:focus-within:border-sky-500 dark:focus-within:ring-sky-500/20 shadow-2xs">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-elevated)] text-[var(--muted)] transition-colors group-focus-within:bg-blue-50 group-focus-within:text-[#1E3A5F] dark:group-focus-within:bg-blue-950/50 dark:group-focus-within:text-sky-300">
          <IconSearch size={13} strokeWidth={2.2} />
        </div>
        <input
          type="text"
          value={returnSearch}
          onChange={e => setReturnSearch(e.target.value)}
          placeholder="Search returns..."
          className="w-full bg-transparent px-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--placeholder)] outline-none"
        />
        {returnSearch ? (
          <button
            type="button"
            onClick={() => setReturnSearch('')}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--ink)]"
            title="Clear search"
            aria-label="Clear search"
          >
            <IconX size={12} strokeWidth={2.5} />
          </button>
        ) : null}
      </div>

      {/* Refresh Button */}
      <button
        onClick={load}
        type="button"
        className="btn-icon h-[38px] w-[38px] rounded-xl border border-[var(--line)]"
        aria-label="Refresh sales returns"
        title="Refresh"
      >
        <IconRefresh size={15} strokeWidth={2} />
      </button>
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
                    <tr><td colSpan={10} className="text-center py-10 text-[var(--muted-light)] text-sm">No sales returns yet</td></tr>
                  ) : filteredReturns.map(r => (
                    <Fragment key={r.id}>
                      <tr>
                        <td className="font-mono font-semibold text-[#1E3A5F] dark:text-slate-200 text-sm">{r.return_number}</td>
                        <td className="font-mono text-sm text-[var(--muted)]">{r.invoice_number || `#${r.invoice}`}</td>
                        <td className="text-sm text-[var(--ink-secondary)]">{r.customer_name || '—'}</td>
                        <td className="text-sm text-[var(--muted)]">{r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '—'}</td>
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
                              <div className="sm:col-span-3">
                                <div className="font-semibold uppercase tracking-wide text-[var(--muted)]">Return reason</div>
                                <div className="mt-1 whitespace-pre-wrap text-[var(--ink-secondary)]">{r.reason || 'No reason provided.'}</div>
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
                <div className="text-center py-10 text-[var(--muted-light)] text-sm">No sales returns yet</div>
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
                    <InfoRow label="Date" value={r.created_at ? new Date(r.created_at).toLocaleString('en-IN') : '—'} />
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

      {/* Cancelled / Refunded invoices */}
      <div className="bg-[var(--surface)] rounded-lg border border-[var(--line)] shadow-none overflow-hidden min-w-0">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[var(--line-subtle)] bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <IconPackageOff size={16} className="text-rose-600" />
            <h2 className="font-semibold text-[var(--ink)] text-sm sm:text-base leading-5 tracking-tight">Cancelled &amp; Refunded Invoices</h2>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex gap-1 bg-[var(--surface-elevated)] border border-[var(--line)] rounded-md p-1 w-full sm:w-auto">
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`flex-1 sm:flex-none min-h-8 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    filter === f.key
                      ? 'bg-[#1E3A5F] text-white shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
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
                  {[...cancelledInvoices, ...refundedInvoices]
                    .filter(b => filter === 'all' || b.status === filter)
                    .length === 0 ? (
                    <tr><td colSpan={12} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-[var(--muted-light)]">
                        <IconRotate2 size={28} className="opacity-30" />
                        <span className="text-sm">No records found</span>
                      </div>
                    </td></tr>
                  ) : [...cancelledInvoices, ...refundedInvoices]
                    .filter(b => filter === 'all' || b.status === filter)
                    .map(b => (
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
              {[...cancelledInvoices, ...refundedInvoices]
                .filter(b => filter === 'all' || b.status === filter)
                .length === 0 ? (
                <div className="text-center py-12 text-[var(--muted-light)]">
                  <div className="flex flex-col items-center gap-2">
                    <IconRotate2 size={28} className="opacity-30" />
                    <span className="text-sm">No records found</span>
                  </div>
                </div>
              ) : [...cancelledInvoices, ...refundedInvoices]
                .filter(b => filter === 'all' || b.status === filter)
                .map(b => (
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

      {/* New Return from completed invoices */}
      <div className="bg-[var(--surface)] rounded-md border border-[var(--line)] shadow-none overflow-hidden min-w-0">
        <div className="px-4 sm:px-5 py-4 sm:py-5 border-b border-[var(--line-subtle)] bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <IconRotate2 size={16} className="text-[#1E3A5F] dark:text-slate-300" />
            <h2 className="font-semibold text-[var(--ink)] text-base leading-5 tracking-tight">Process New Return</h2>
            <span className="text-xs text-[var(--muted-light)]">— select a completed invoice</span>
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
                  {completedInvoices.slice(0, 30).length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-[var(--muted-light)] text-sm">No completed invoices</td></tr>
                  ) : completedInvoices.slice(0, 30).map(b => (
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

            <div className="md:hidden p-3 space-y-3">
              {completedInvoices.slice(0, 30).length === 0 ? (
                <div className="text-center py-8 text-[var(--muted-light)] text-sm">No completed invoices</div>
              ) : completedInvoices.slice(0, 30).map(b => (
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
          </>
        )}
      </div>

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
    </div>
  )
}
