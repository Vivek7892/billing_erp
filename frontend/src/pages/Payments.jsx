import { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { Badge, Spinner } from '../components/UI'
import {
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'

const fmt = v =>
  `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const METHOD_META = {
  cash: {
    label: 'Cash',
    icon: Banknote,
    iconCls: 'bg-white border border-emerald-200 text-emerald-600',
    badge: 'bg-emerald-500 text-white',
    border: 'border-emerald-200',
    ring: 'ring-emerald-300',
  },
  upi: {
    label: 'UPI',
    icon: Smartphone,
    iconCls: 'bg-white border border-blue-200 text-blue-600',
    badge: 'bg-blue-500 text-white',
    border: 'border-blue-200',
    ring: 'ring-blue-300',
  },
  card: {
    label: 'Card',
    icon: CreditCard,
    iconCls: 'bg-white border border-violet-200 text-violet-600',
    badge: 'bg-violet-500 text-white',
    border: 'border-violet-200',
    ring: 'ring-violet-300',
  },
  credit: {
    label: 'Credit',
    icon: Wallet,
    iconCls: 'bg-white border border-rose-200 text-rose-600',
    badge: 'bg-rose-500 text-white',
    border: 'border-rose-200',
    ring: 'ring-rose-300',
  },
}

export default function Payments() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    api
      .get('/invoices/?page_size=200&ordering=-created_at')
      .then(r => setBills(r.data?.results || r.data || []))
      .catch(() => setBills([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const summary = useMemo(
    () =>
      Object.entries(METHOD_META).map(([key, meta]) => {
        const rows = bills.filter(b => b.payment_method === key)
        return {
          key,
          ...meta,
          count: rows.length,
          total: rows.reduce((sum, b) => sum + Number(b.grand_total || 0), 0),
        }
      }),
    [bills]
  )

  const FILTERS = [
    { key: 'all', label: 'All' },
    ...Object.entries(METHOD_META).map(([key, meta]) => ({ key, label: meta.label })),
  ]

  const normalizedSearch = search.trim().toLowerCase()

  const filtered = bills.filter(b => {
    const matchesFilter = filter === 'all' || b.payment_method === filter
    if (!normalizedSearch) return matchesFilter
    const searchable = [b.invoice_number, b.customer_name, b.customer_phone, b.customer_email, b.payment_method, b.payment_status]
      .filter(Boolean).join(' ').toLowerCase()
    return matchesFilter && searchable.includes(normalizedSearch)
  })

  const totalCollected = bills.filter(b => b.payment_method !== 'credit').reduce((sum, b) => sum + Number(b.grand_total || 0), 0)
  const totalCredit = bills.filter(b => b.payment_method === 'credit').reduce((sum, b) => sum + Number(b.grand_total || 0), 0)

  return (
    <div className="space-y-3 sm:space-y-5">

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {/* Collected */}
        <div className="rounded-2xl border border-emerald-100 bg-[var(--surface)] p-3 shadow-[var(--shadow-card)] sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)] sm:text-[11px]">Collected</p>
              <p className="mt-1.5 truncate text-base font-bold text-[var(--ink)] sm:text-xl">{fmt(totalCollected)}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-emerald-200 text-emerald-600 shadow-sm sm:h-10 sm:w-10">
              <Banknote size={15} />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-[var(--muted-light)]">Non-credit payments</p>
        </div>

        {/* Credit Due */}
        <div className="rounded-2xl border border-rose-100 bg-[var(--surface)] p-3 shadow-[var(--shadow-card)] sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)] sm:text-[11px]">Credit Due</p>
              <p className="mt-1.5 truncate text-base font-bold text-[var(--ink)] sm:text-xl">{fmt(totalCredit)}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-rose-200 text-rose-600 shadow-sm sm:h-10 sm:w-10">
              <Wallet size={15} />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-[var(--muted-light)]">Credit transactions</p>
        </div>

        {/* Per-method cards */}
        {summary.map(m => {
          const Icon = m.icon
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setFilter(filter === m.key ? 'all' : m.key)}
              className={`group rounded-2xl border bg-[var(--surface)] p-3 text-left shadow-[var(--shadow-card)] transition active:scale-[0.99] sm:p-4 ${
                filter === m.key ? `${m.border} ring-2 ${m.ring}` : m.border
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)] sm:text-[11px]">{m.label}</p>
                  <p className="mt-1.5 truncate text-base font-bold text-[var(--ink)] sm:text-xl">{fmt(m.total)}</p>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ${m.iconCls} sm:h-10 sm:w-10`}>
                  <Icon size={15} />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] text-[var(--muted-light)] sm:text-xs">{m.count} transactions</span>
                <span className="text-[9px] font-semibold text-[var(--muted-light)]">View</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Transactions */}
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[var(--line-subtle)] px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <h2 className="shrink-0 text-sm font-semibold text-[var(--ink)]">Payment Transactions</h2>
            <div className="ml-auto flex min-w-0 items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-light)]" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search invoice, customer..."
                  className="h-9 w-full rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] pl-8 pr-8 text-xs text-[var(--ink-secondary)] outline-none transition placeholder:text-[var(--muted-light)] focus:border-blue-300 focus:bg-[var(--surface)] focus:ring-2 focus:ring-blue-50"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-light)] hover:text-[var(--ink-secondary)]" aria-label="Clear search">
                    <X size={13} />
                  </button>
                )}
              </div>
              <button type="button" onClick={load} disabled={loading} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] disabled:opacity-50" aria-label="Refresh payments">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="mt-3 -mx-1 overflow-x-auto px-1 pb-0.5">
            <div className="flex min-w-max gap-1 rounded-xl bg-slate-100 p-1">
              {FILTERS.map(f => (
                <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                  className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition-all ${
                    filter === f.key ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-card)]' : 'text-[var(--muted)] hover:text-[var(--ink-secondary)]'
                  }`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-14"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-14 text-center text-[var(--muted-light)]">
            <Wallet size={28} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">No transactions found</p>
            <p className="mt-1 text-xs">Try another search or payment method.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y divide-[var(--line-subtle)] sm:hidden">
              {filtered.map(b => {
                const meta = METHOD_META[b.payment_method] || METHOD_META.cash
                const Icon = meta.icon
                return (
                  <div key={b.id} className="p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{b.invoice_number}</p>
                        <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">{b.customer_name || 'Walk-in'}</p>
                        {b.customer_phone && <p className="mt-1 text-[10px] text-[var(--muted-light)]">{b.customer_phone}</p>}
                      </div>
                      <p className="shrink-0 text-sm font-bold text-[var(--ink)]">{fmt(b.grand_total)}</p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-[var(--surface-elevated)] p-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)]">Payment</p>
                        <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold ${meta.badge}`}>
                          <Icon size={11} />{meta.label}
                        </span>
                      </div>
                      <div className="rounded-xl bg-[var(--surface-elevated)] p-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)]">Date</p>
                        <p className="mt-1.5 text-[10px] font-semibold text-[var(--muted)]">{new Date(b.created_at).toLocaleDateString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <Badge status={b.payment_status} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto sm:block">
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
                  {filtered.map(b => {
                    const meta = METHOD_META[b.payment_method] || METHOD_META.cash
                    const Icon = meta.icon
                    return (
                      <tr key={b.id}>
                        <td className="font-mono text-sm font-semibold text-blue-600 dark:text-blue-400">{b.invoice_number}</td>
                        <td className="text-sm text-[var(--ink-secondary)]">{b.customer_name || 'Walk-in'}</td>
                        <td className="text-sm text-[var(--muted)]">{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${meta.badge}`}>
                            <Icon size={11} />{meta.label}
                          </span>
                        </td>
                        <td className="text-sm font-bold text-[var(--ink)]">{fmt(b.grand_total)}</td>
                        <td><Badge status={b.payment_status} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
