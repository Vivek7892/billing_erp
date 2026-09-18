import { useState, useEffect, useCallback } from 'react'
import api from '../api'
import { RefreshCw, Search, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  created:  'bg-slate-100 text-slate-600',
  initiated:'bg-blue-100 text-blue-700',
  pending:  'bg-amber-100 text-amber-700',
  success:  'bg-emerald-100 text-emerald-700',
  failed:   'bg-rose-100 text-rose-700',
  expired:  'bg-gray-100 text-gray-500',
}

const fmt = v => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
const fmtDate = s => s ? new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export default function PaymentReconciliation() {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page_size: 200 }
      if (statusFilter) params.status = statusFilter
      if (search.trim()) params.search = search.trim()
      const res = await api.get('/payments/razorpay/reconciliation/', { params })
      setRows(res.data)
    } catch {
      toast.error('Failed to load reconciliation data')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => { load() }, [load])

  const summary = {
    total:   rows.length,
    success: rows.filter(r => r.status === 'success').length,
    failed:  rows.filter(r => r.status === 'failed').length,
    pending: rows.filter(r => ['created','initiated','pending'].includes(r.status)).length,
    amount:  rows.filter(r => r.status === 'success').reduce((s, r) => s + Number(r.amount || 0), 0),
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--ink)]">Payment Reconciliation</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">Razorpay transaction audit — admin only</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-sm font-medium text-[var(--ink-secondary)] hover:bg-[var(--surface-elevated)] disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total',    value: summary.total,              cls: 'text-[var(--ink)]' },
          { label: 'Success',  value: summary.success,            cls: 'text-emerald-600' },
          { label: 'Failed',   value: summary.failed,             cls: 'text-rose-600' },
          { label: 'Pending',  value: summary.pending,            cls: 'text-amber-600' },
          { label: 'Collected',value: fmt(summary.amount),        cls: 'text-indigo-700' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">{label}</div>
            <div className={`text-2xl font-extrabold mt-1 tabular-nums ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-light)]" />
          <input
            className="h-9 pl-8 pr-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] w-64"
            placeholder="Invoice no., Order ID, Payment ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="h-9 px-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {['created','initiated','pending','success','failed','expired'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--surface-elevated)] text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Invoice</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Gateway</th>
                <th className="px-4 py-3 text-left">Razorpay Order ID</th>
                <th className="px-4 py-3 text-left">Payment ID</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Failure Reason</th>
                <th className="px-4 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)]">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--muted)]">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[var(--muted)]">
                    <AlertCircle size={20} className="mx-auto mb-2 text-[var(--muted-light)]" />
                    No transactions found
                  </td>
                </tr>
              )}
              {!loading && rows.map(row => (
                <tr key={row.id} className="hover:bg-[var(--surface-elevated)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--ink)]">
                    {row.invoice_number || <span className="text-[var(--muted-light)]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-[var(--ink)]">
                    {fmt(row.amount)}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)] capitalize">{row.provider}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--ink-secondary)] max-w-[180px] truncate" title={row.razorpay_order_id}>
                    {row.razorpay_order_id || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--ink-secondary)] max-w-[160px] truncate" title={row.razorpay_payment_id}>
                    {row.razorpay_payment_id || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-600'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-rose-600 max-w-[200px] truncate" title={row.failure_reason}>
                    {row.failure_reason || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)] whitespace-nowrap">
                    {fmtDate(row.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && rows.length > 0 && (
          <div className="px-4 py-2 border-t border-[var(--line-subtle)] text-xs text-[var(--muted)]">
            Showing {rows.length} transaction{rows.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
