import { useEffect, useState } from 'react'
import api, { API_BASE_URL } from '../api'
import { Badge, Spinner, Modal } from '../components/UI'
import {
  RotateCcw, RefreshCw, PackageX, IndianRupee, FileX, TrendingDown,
  Eye, ChevronDown, ChevronUp, Printer, AlertCircle
} from 'lucide-react'
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

const REFUND_METHODS = ['cash', 'upi', 'card', 'online']

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
  const setQty = (id, val) => setItems(prev => prev.map(it => it.id === id ? { ...it, return_qty: Math.min(Math.max(0.01, Number(val)), Number(it.quantity)) } : it))

  const selectedItems = items.filter(it => it.selected && it.return_qty > 0)
  const refundTotal = selectedItems.reduce((s, it) => s + (Number(it.total) / Number(it.quantity)) * it.return_qty, 0)

  const submit = async () => {
    if (!selectedItems.length) return toast.error('Select at least one item')
    setSaving(true)
    try {
      await api.post('/sales-returns/', {
        invoice: invoice.id,
        reason,
        refund_method: refundMethod,
        items: selectedItems.map(it => ({ invoice_item_id: it.id, quantity: it.return_qty })),
      })
      toast.success('Return processed successfully')
      onDone()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to process return')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Process Return — ${invoice?.invoice_number}`} size="md">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex gap-2 text-xs text-amber-900">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          Stock will be restored for returned items. This action cannot be undone.
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Select Items to Return</div>
          {items.map(it => (
            <div key={it.id} className={`flex flex-wrap sm:flex-nowrap items-center gap-2.5 sm:gap-3 p-3.5 rounded-xl border transition-all duration-200 ${it.selected ? 'border-blue-300 bg-blue-50 ring-1 ring-inset ring-blue-100' : 'border-[var(--line)] bg-[var(--surface)] hover:border-slate-300'}`}>
              <input type="checkbox" checked={it.selected} onChange={() => toggle(it.id)}
                className="w-4 h-4 accent-blue-600 shrink-0 cursor-pointer" />
              <div className="flex-1 min-w-[calc(100%-2rem)] sm:min-w-0">
                <div className="text-sm font-medium text-[var(--ink)] truncate">{it.product_name}</div>
                <div className="text-xs text-[var(--muted-light)]">Billed: {it.quantity} × {fmt(it.unit_price)}</div>
              </div>
              {it.selected && (
                <div className="flex items-center gap-1.5 shrink-0 ml-6 sm:ml-0">
                  <span className="text-xs text-[var(--muted)]">Qty:</span>
                  <input type="number" min="0.01" max={it.quantity} step="0.01"
                    value={it.return_qty}
                    onChange={e => setQty(it.id, e.target.value)}
                    className="w-20 h-9 sm:h-8 text-center border border-[var(--line)] rounded-lg text-xs bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
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
              className="input w-full capitalize focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all">
              {REFUND_METHODS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--muted)] block mb-1">Reason</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Optional reason" className="input w-full focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
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
    <Modal open={open} onClose={onClose} title={`Invoice — ${invoice.invoice_number}`} size="md">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div><span className="text-[var(--muted-light)]">Customer:</span> <span className="font-medium">{invoice.customer_name || 'Walk-in'}</span></div>
          <div><span className="text-[var(--muted-light)]">Date:</span> <span className="font-medium">{new Date(invoice.created_at).toLocaleDateString('en-IN')}</span></div>
          <div><span className="text-[var(--muted-light)]">Payment:</span> <span className="font-medium capitalize">{invoice.payment_method}</span></div>
          <div><span className="text-[var(--muted-light)]">Status:</span> <Badge status={invoice.payment_status} /></div>
        </div>
        <div className="hidden sm:block overflow-x-auto">
          <table className="table w-full text-xs">
            <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Total</th></tr></thead>
            <tbody>
              {(invoice.items || []).map(it => (
                <tr key={it.id}>
                  <td>{it.product_name}</td>
                  <td className="text-center">{it.quantity}</td>
                  <td className="text-right">{fmt(it.unit_price)}</td>
                  <td className="text-right font-semibold">{fmt(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="sm:hidden space-y-2">
          {(invoice.items || []).map(it => (
            <div key={it.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] p-3">
              <div className="font-medium text-[var(--ink)] text-sm break-words">{it.product_name}</div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <InfoRow label="Qty" value={it.quantity} />
                <InfoRow label="Rate" value={fmt(it.unit_price)} />
                <InfoRow label="Total" value={fmt(it.total)} valueClass="font-bold" />
              </div>
            </div>
          ))}
        </div>
        <div className="text-right font-bold text-base">{fmt(invoice.grand_total)}</div>
      </div>
    </Modal>
  )
}

export default function Returns() {
  const [invoices, setInvoices] = useState([])
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [returnModal, setReturnModal] = useState(null)
  const [viewModal, setViewModal] = useState(null)
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

  const stats = [
    { label: 'Total Returns', value: returns.length + refundedInvoices.length, icon: RotateCcw, accent: 'text-rose-600', iconBg: 'bg-rose-50', border: 'border-rose-100' },
    { label: 'Refunded', value: refundedInvoices.length, icon: IndianRupee, accent: 'text-amber-600', iconBg: 'bg-amber-50', border: 'border-amber-100' },
    { label: 'Cancelled', value: cancelledInvoices.length, icon: FileX, accent: 'text-slate-600', iconBg: 'bg-slate-50', border: 'border-slate-200' },
    { label: 'Value Refunded', value: fmt(totalRefunded), icon: TrendingDown, accent: 'text-red-600', iconBg: 'bg-red-50', border: 'border-red-100' },
  ]

  const toggleExpand = (id) => setExpandedReturns(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="space-y-6 min-w-0 pb-6">
      <div className="flex flex-col gap-1 px-0.5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">Returns & Refunds</h1>
        <p className="text-sm text-[var(--muted)] max-w-2xl">Review returned items, refunded invoices, and process new returns.</p>
      </div>
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s, i) => (
          <div
            key={i}
            className={`group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 min-w-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
          >
            <div className={`absolute inset-x-0 top-0 h-0.5 ${s.iconBg}`} />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] sm:text-[11px] font-bold text-[var(--muted-light)] uppercase tracking-[0.08em]">
                  {s.label}
                </span>
                <div className="mt-2 text-2xl sm:text-[26px] font-bold tracking-tight text-[var(--ink)] break-words">
                  {s.value}
                </div>
              </div>
              <div className={`w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-xl ${s.iconBg} bg-white border border-slate-200 shadow-sm flex items-center justify-center`}>
                <s.icon size={17} strokeWidth={2.2} className={s.accent} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sales Returns (item-level) */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--line)] shadow-sm overflow-hidden min-w-0">

  {/* Header */}
  <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-[var(--line-subtle)] bg-[var(--surface)]">

    {/* Title */}
    <div className="flex items-center gap-2 min-w-0">
      <RotateCcw
        size={16}
        className="text-blue-600 flex-shrink-0"
      />

      <h2 className="font-semibold text-[var(--ink)] text-sm sm:text-base leading-5 tracking-tight truncate">
        Sales Returns (Item-level)
      </h2>
    </div>

    {/* Refresh Button */}
    <button
      onClick={load}
      type="button"
      className="
        flex-shrink-0
        inline-flex items-center justify-center
        w-8 h-8 sm:w-9 sm:h-9
        rounded-lg
        border border-[var(--line)]
        bg-[var(--surface)]
        text-[var(--muted)]
        hover:text-blue-600
        hover:border-blue-200
        hover:bg-blue-50
        transition-all duration-200
        active:scale-95
        focus:outline-none
        focus:ring-2 focus:ring-blue-500/20
      "
      aria-label="Refresh sales returns"
      title="Refresh"
    >
      <RefreshCw size={15} strokeWidth={2} />
    </button>
        </div>
        {loading ? <Spinner /> : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="table min-w-[900px] [&_th]:whitespace-nowrap [&_td]:align-middle">
                <thead>
                  <tr><th>Return #</th><th>Invoice</th><th>Customer</th><th>Date</th><th>Refund Method</th><th>Refund Amt</th><th>Reason</th><th></th></tr>
                </thead>
                <tbody>
                  {returns.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-10 text-[var(--muted-light)] text-sm">No sales returns yet</td></tr>
                  ) : returns.map(r => (
                    <>
                      <tr key={r.id}>
                        <td className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-sm">{r.return_number}</td>
                        <td className="font-mono text-sm text-[var(--muted)]">{r.invoice_number}</td>
                        <td className="text-sm text-[var(--ink-secondary)]">{r.invoice?.customer_name || '—'}</td>
                        <td className="text-sm text-[var(--muted)]">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="text-sm text-[var(--muted)] capitalize">{r.refund_method}</td>
                        <td className="font-bold text-[var(--ink)] text-sm">{fmt(r.refund_amount)}</td>
                        <td className="text-xs text-[var(--muted-light)] max-w-[120px] truncate">{r.reason || '—'}</td>
                        <td>
                          <button onClick={() => toggleExpand(r.id)} className="w-9 h-9 inline-flex items-center justify-center text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:text-white hover:bg-slate-800 hover:border-slate-800 transition-all active:scale-95" aria-label="Toggle return details">
                            {expandedReturns[r.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>
                      {expandedReturns[r.id] && (r.items || []).map(it => (
                        <tr key={`${r.id}-${it.id}`} className="bg-[var(--surface-elevated)]">
                          <td colSpan={2} className="pl-8 text-xs text-[var(--muted)]">↳ {it.product_name}</td>
                          <td className="text-xs text-[var(--muted)]">Qty: {it.quantity}</td>
                          <td colSpan={2} className="text-xs text-[var(--muted)]">@ {fmt(it.unit_price)}</td>
                          <td className="text-xs font-semibold text-[var(--ink-secondary)]">{fmt(it.total)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden p-3 space-y-3">
              {returns.length === 0 ? (
                <div className="text-center py-10 text-[var(--muted-light)] text-sm">No sales returns yet</div>
              ) : returns.map(r => (
                <div key={r.id} className="rounded-2xl border border-slate-200 bg-white hover:border-slate-300 p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-sm break-all">{r.return_number}</div>
                      <div className="font-mono text-xs text-[var(--muted)] mt-0.5">{r.invoice_number}</div>
                    </div>
                    <button onClick={() => toggleExpand(r.id)} className="w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg bg-[var(--surface-elevated)] text-[var(--muted)]" aria-label="Toggle return details">
                      {expandedReturns[r.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-[var(--line-subtle)] pt-2">
                    <InfoRow label="Customer" value={r.invoice?.customer_name || '—'} />
                    <InfoRow label="Date" value={new Date(r.created_at).toLocaleDateString('en-IN')} />
                    <InfoRow label="Method" value={r.refund_method} valueClass="capitalize" />
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
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--line)] shadow-sm overflow-hidden min-w-0">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-[var(--line-subtle)] bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <PackageX size={16} className="text-rose-600" />
            <h2 className="font-semibold text-[var(--ink)] text-base leading-5 tracking-tight">Cancelled & Refunded Invoices</h2>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex gap-1 bg-[var(--surface-elevated)] border border-[var(--line)] rounded-lg p-1 w-full sm:w-auto">
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`flex-1 sm:flex-none min-h-9 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    filter === f.key
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {loading ? <Spinner /> : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="table min-w-[760px] [&_th]:whitespace-nowrap [&_td]:align-middle">
                <thead>
                  <tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Payment</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {[...cancelledInvoices, ...refundedInvoices]
                    .filter(b => filter === 'all' || b.status === filter)
                    .length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-[var(--muted-light)]">
                        <RotateCcw size={28} className="opacity-30" />
                        <span className="text-sm">No records found</span>
                      </div>
                    </td></tr>
                  ) : [...cancelledInvoices, ...refundedInvoices]
                    .filter(b => filter === 'all' || b.status === filter)
                    .map(b => (
                      <tr key={b.id}>
                        <td className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-sm">{b.invoice_number}</td>
                        <td className="text-sm text-[var(--ink-secondary)]">{b.customer_name || 'Walk-in'}</td>
                        <td className="text-sm text-[var(--muted)]">{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="text-sm text-[var(--muted)] capitalize">{b.payment_method}</td>
                        <td className="font-bold text-[var(--ink)] text-sm">{fmt(b.grand_total)}</td>
                        <td><Badge status={b.status} /></td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setViewModal(b)} className="w-9 h-9 inline-flex items-center justify-center text-blue-700 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95" title="View" aria-label="View invoice">
                              <Eye size={14} />
                            </button>
                            <a href={`${API_BASE_URL}/invoices/${b.id}/pdf/?token=${localStorage.getItem('access_token')}`}
                              target="_blank" rel="noreferrer" className="w-9 h-9 inline-flex items-center justify-center text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:text-white hover:bg-slate-800 hover:border-slate-800 transition-all active:scale-95" title="Print" aria-label="Print invoice">
                              <Printer size={14} />
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
                    <RotateCcw size={28} className="opacity-30" />
                    <span className="text-sm">No records found</span>
                  </div>
                </div>
              ) : [...cancelledInvoices, ...refundedInvoices]
                .filter(b => filter === 'all' || b.status === filter)
                .map(b => (
                  <div key={b.id} className="rounded-2xl border border-slate-200 bg-white hover:border-slate-300 p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-sm break-all">{b.invoice_number}</div>
                        <div className="text-sm text-[var(--ink-secondary)] mt-1 break-words">{b.customer_name || 'Walk-in'}</div>
                      </div>
                      <Badge status={b.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 pt-2 border-t border-[var(--line-subtle)]">
                      <InfoRow label="Date" value={new Date(b.created_at).toLocaleDateString('en-IN')} />
                      <InfoRow label="Payment" value={b.payment_method} valueClass="capitalize" />
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-[var(--line-subtle)]">
                      <div>
                        <div className="text-[11px] uppercase tracking-wide text-[var(--muted-light)]">Amount</div>
                        <div className="text-base font-bold text-[var(--ink)]">{fmt(b.grand_total)}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewModal(b)} className="w-10 h-10 inline-flex items-center justify-center text-blue-700 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95" title="View" aria-label="View invoice">
                          <Eye size={16} />
                        </button>
                        <a href={`${API_BASE_URL}/invoices/${b.id}/pdf/?token=${localStorage.getItem('access_token')}`}
                          target="_blank" rel="noreferrer" className="w-10 h-10 inline-flex items-center justify-center text-blue-700 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95" title="Print" aria-label="Print invoice">
                          <Printer size={16} />
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
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--line)] shadow-sm overflow-hidden min-w-0">
        <div className="px-4 sm:px-5 py-4 sm:py-5 border-b border-[var(--line-subtle)] bg-[var(--surface)]">
          <div className="flex items-center gap-2">
            <RotateCcw size={16} className="text-emerald-600" />
            <h2 className="font-semibold text-[var(--ink)] text-base leading-5 tracking-tight">Process New Return</h2>
            <span className="text-xs text-[var(--muted-light)]">— select a completed invoice</span>
          </div>
        </div>
        {loading ? <Spinner /> : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="table min-w-[700px] [&_th]:whitespace-nowrap [&_td]:align-middle">
                <thead>
                  <tr><th>Invoice</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {completedInvoices.slice(0, 30).length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-8 text-[var(--muted-light)] text-sm">No completed invoices</td></tr>
                  ) : completedInvoices.slice(0, 30).map(b => (
                    <tr key={b.id}>
                      <td className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-sm">{b.invoice_number}</td>
                      <td className="text-sm text-[var(--ink-secondary)]">{b.customer_name || 'Walk-in'}</td>
                      <td className="text-sm text-[var(--muted)]">{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="font-bold text-[var(--ink)] text-sm">{fmt(b.grand_total)}</td>
                      <td><Badge status={b.payment_status} /></td>
                      <td>
                        <button onClick={() => setReturnModal(b)}
                          className="min-h-10 text-xs bg-slate-900 text-white hover:bg-rose-600 active:bg-rose-700 border border-slate-900 hover:border-rose-600 px-3.5 py-2 rounded-lg font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98] inline-flex items-center justify-center gap-1.5">
                          <RotateCcw size={12} /> Return
                        </button>
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
                <div key={b.id} className="rounded-2xl border border-slate-200 bg-white hover:border-slate-300 p-3.5 sm:p-4 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-sm break-all">{b.invoice_number}</div>
                      <div className="text-sm text-[var(--ink-secondary)] mt-1 break-words">{b.customer_name || 'Walk-in'}</div>
                    </div>
                    <Badge status={b.payment_status} />
                  </div>
                  <div className="flex items-end justify-between gap-3 mt-3 pt-3 border-t border-[var(--line-subtle)]">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-[var(--muted-light)]">Date</div>
                      <div className="text-xs text-[var(--muted)]">{new Date(b.created_at).toLocaleDateString('en-IN')}</div>
                      <div className="text-[11px] uppercase tracking-wide text-[var(--muted-light)] mt-2">Amount</div>
                      <div className="text-base font-bold text-[var(--ink)]">{fmt(b.grand_total)}</div>
                    </div>
                    <button onClick={() => setReturnModal(b)}
                      className="min-h-11 px-4 text-xs bg-slate-900 text-white hover:bg-rose-600 active:bg-rose-700 border border-slate-900 hover:border-rose-600 rounded-lg font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98] inline-flex items-center justify-center gap-1.5 shrink-0">
                      <RotateCcw size={13} /> Return
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ReturnModal open={!!returnModal} onClose={() => setReturnModal(null)} invoice={returnModal} onDone={load} />
      <ViewModal open={!!viewModal} onClose={() => setViewModal(null)} invoice={viewModal} />
    </div>
  )
}