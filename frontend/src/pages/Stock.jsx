import { useEffect, useState } from 'react'
import api from '../api'
import { Badge, Spinner } from '../components/UI'
import { Boxes, RefreshCw, AlertTriangle, CheckCircle, XCircle, Search } from 'lucide-react'

export default function Stock() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/products/').then(r => setProducts(r.data?.results || r.data || [])).catch(() => setProducts([])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const getStatus = p => {
    if (p.current_stock <= 0) return 'out_of_stock'
    if (p.current_stock <= p.minimum_stock) return 'low_stock'
    return 'in_stock'
  }

  const filtered = products
    .filter(p => filter === 'all' || getStatus(p) === filter)
    .filter(p => !q || p.name?.toLowerCase().includes(q.toLowerCase()) || p.sku?.toLowerCase().includes(q.toLowerCase()))

  const inStock   = products.filter(p => getStatus(p) === 'in_stock').length
  const lowStock  = products.filter(p => getStatus(p) === 'low_stock').length
  const outStock  = products.filter(p => getStatus(p) === 'out_of_stock').length

  const stats = [
    { label: 'Total Products', value: products.length, icon: Boxes, bg: 'bg-blue-50 dark:bg-blue-950/60', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-100', key: 'all' },
    { label: 'In Stock', value: inStock, icon: CheckCircle, bg: 'bg-green-50 dark:bg-green-950/60', text: 'text-green-600 dark:text-green-400', border: 'border-green-100', key: 'in_stock' },
    { label: 'Low Stock', value: lowStock, icon: AlertTriangle, bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', key: 'low_stock' },
    { label: 'Out of Stock', value: outStock, icon: XCircle, bg: 'bg-red-50 dark:bg-red-950/60', text: 'text-red-600 dark:text-red-400', border: 'border-red-100', key: 'out_of_stock' },
  ]

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'in_stock', label: 'In Stock' },
    { key: 'low_stock', label: 'Low Stock' },
    { key: 'out_of_stock', label: 'Out of Stock' },
  ]

  return (
    <div className="space-y-5">

      {/* Stats — clickable to filter */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`bg-[var(--surface)] rounded-xl border p-4 flex flex-col gap-2 text-left transition-all hover:shadow-md ${
              filter === s.key ? `${s.border} ring-2 ring-offset-1 ${s.border.replace('border-', 'ring-')}` : 'border-[var(--line)]'
            }`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--muted-light)] uppercase tracking-wide">{s.label}</span>
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon size={15} className={s.text} />
              </div>
            </div>
            <div className="text-xl font-bold text-[var(--ink)]">{s.value}</div>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[var(--surface)] rounded-xl border border-[var(--line)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[var(--line-subtle)]">
          <h2 className="font-semibold text-[var(--ink)] text-sm">Stock Levels</h2>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="flex items-center gap-2 bg-[var(--surface-elevated)] border border-[var(--line)] rounded-lg px-3 py-1.5">
              <Search size={13} className="text-[var(--muted-light)]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search product…"
                className="bg-transparent text-sm outline-none w-36 text-[var(--ink-secondary)] placeholder-slate-400" />
            </div>
            {/* Filter tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    filter === f.key ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-card)]' : 'text-[var(--muted)] hover:text-[var(--ink-secondary)]'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={load} className="icon-btn">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Current Stock</th>
                  <th>Min Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2 text-[var(--muted-light)]">
                        <Boxes size={28} className="opacity-30" />
                        <span className="text-sm">No products found</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(p => {
                  const status = getStatus(p)
                  const stockColor = status === 'out_of_stock' ? 'text-red-600 dark:text-red-400 font-bold' : status === 'low_stock' ? 'text-amber-600 font-bold' : 'text-green-700 font-semibold'
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="font-medium text-[var(--ink)] text-sm">{p.name}</div>
                        {p.supplier_name && <div className="text-xs text-[var(--muted-light)]">{p.supplier_name}</div>}
                      </td>
                      <td className="font-mono text-xs text-[var(--muted)]">{p.sku || '—'}</td>
                      <td className="text-sm text-[var(--muted)]">{p.category_name || '—'}</td>
                      <td>
                        <span className={`text-sm ${stockColor}`}>{p.current_stock ?? 0}</span>
                        <span className="text-xs text-[var(--muted-light)] ml-1">{p.unit || 'pcs'}</span>
                      </td>
                      <td className="text-sm text-[var(--muted)]">{p.minimum_stock ?? 0}</td>
                      <td><Badge status={status} /></td>
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
