import { useEffect, useState } from 'react'
import api from '../api'
import { Badge, Spinner } from '../components/UI'
import { CreditCard, Banknote, Smartphone, Wallet, TrendingUp, RefreshCw } from 'lucide-react'

const fmt = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const METHOD_META = {
  cash:   { label: 'Cash',   icon: Banknote,    bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-100' },
  upi:    { label: 'UPI',    icon: Smartphone,  bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-100' },
  card:   { label: 'Card',   icon: CreditCard,  bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-100' },
  credit: { label: 'Credit', icon: Wallet,      bg: 'bg-rose-50',   text: 'text-rose-600',   border: 'border-rose-100' },
  online: { label: 'Online', icon: TrendingUp,  bg: 'bg-cyan-50',   text: 'text-cyan-600',   border: 'border-cyan-100' },
}

export default function Payments() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const load = () => {
    setLoading(true)
    api.get('/invoices/?page_size=200&ordering=-created_at').then(r => setBills(r.data?.results || r.data || [])).catch(() => setBills([])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? bills : bills.filter(b => b.payment_method === filter)

  // Summary by method
  const summary = Object.entries(METHOD_META).map(([key, meta]) => {
    const rows = bills.filter(b => b.payment_method === key)
    return { key, ...meta, count: rows.length, total: rows.reduce((s, b) => s + Number(b.grand_total || 0), 0) }
  })

  const FILTERS = [{ key: 'all', label: 'All' }, ...Object.entries(METHOD_META).map(([k, v]) => ({ key: k, label: v.label }))]

  return (
    <div className="space-y-5">

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {summary.map(m => (
          <div key={m.key} className={`bg-white rounded-xl border ${m.border} p-4 flex flex-col gap-2`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{m.label}</span>
              <div className={`w-8 h-8 rounded-lg ${m.bg} flex items-center justify-center`}>
                <m.icon size={15} className={m.text} />
              </div>
            </div>
            <div className="text-lg font-bold text-slate-800">{fmt(m.total)}</div>
            <div className="text-xs text-slate-400">{m.count} transactions</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 text-sm">Payment Transactions</h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    filter === f.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={load} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-slate-400 text-sm">No transactions found</td></tr>
                ) : filtered.map(b => {
                  const meta = METHOD_META[b.payment_method] || METHOD_META.cash
                  return (
                    <tr key={b.id}>
                      <td className="font-mono font-semibold text-blue-600 text-sm">{b.invoice_number}</td>
                      <td className="text-sm text-slate-700">{b.customer_name || 'Walk-in'}</td>
                      <td className="text-sm text-slate-500">{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${meta.bg} ${meta.text}`}>
                          <meta.icon size={11} /> {meta.label}
                        </span>
                      </td>
                      <td className="font-bold text-slate-800 text-sm">{fmt(b.grand_total)}</td>
                      <td><Badge status={b.payment_status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
