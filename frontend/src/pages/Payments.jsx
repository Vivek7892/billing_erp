import { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { Badge, Spinner } from '../components/UI'
import {
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  TrendingUp,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'

const fmt = v =>
  `₹${Number(v || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`

const METHOD_META = {
  cash: {
    label: 'Cash',
    icon: Banknote,
    bg: 'bg-green-50',
    text: 'text-green-600',
    border: 'border-green-100',
    ring: 'ring-green-100',
  },
  upi: {
    label: 'UPI',
    icon: Smartphone,
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    border: 'border-blue-100',
    ring: 'ring-blue-100',
  },
  card: {
    label: 'Card',
    icon: CreditCard,
    bg: 'bg-violet-50',
    text: 'text-violet-600',
    border: 'border-violet-100',
    ring: 'ring-violet-100',
  },
  credit: {
    label: 'Credit',
    icon: Wallet,
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    border: 'border-rose-100',
    ring: 'ring-rose-100',
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

  useEffect(() => {
    load()
  }, [])

  const summary = useMemo(
    () =>
      Object.entries(METHOD_META).map(([key, meta]) => {
        const rows = bills.filter(b => b.payment_method === key)

        return {
          key,
          ...meta,
          count: rows.length,
          total: rows.reduce(
            (sum, b) => sum + Number(b.grand_total || 0),
            0
          ),
        }
      }),
    [bills]
  )

  const FILTERS = [
    { key: 'all', label: 'All' },
    ...Object.entries(METHOD_META).map(([key, meta]) => ({
      key,
      label: meta.label,
    })),
  ]

  const normalizedSearch = search.trim().toLowerCase()

  const filtered = bills.filter(b => {
    const matchesFilter =
      filter === 'all' || b.payment_method === filter

    if (!normalizedSearch) return matchesFilter

    const searchable = [
      b.invoice_number,
      b.customer_name,
      b.customer_phone,
      b.customer_email,
      b.payment_method,
      b.payment_status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return matchesFilter && searchable.includes(normalizedSearch)
  })

  const totalCollected = bills
    .filter(b => b.payment_method !== 'credit')
    .reduce((sum, b) => sum + Number(b.grand_total || 0), 0)

  const totalCredit = bills
    .filter(b => b.payment_method === 'credit')
    .reduce((sum, b) => sum + Number(b.grand_total || 0), 0)

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        {summary.map(m => {
          const Icon = m.icon

          return (
            <button
              key={m.key}
              type="button"
              onClick={() =>
                setFilter(filter === m.key ? 'all' : m.key)
              }
              className={`group rounded-2xl border bg-white p-3 text-left shadow-sm transition active:scale-[0.99] sm:p-4 ${
                filter === m.key
                  ? `${m.border} ring-2 ${m.ring}`
                  : m.border
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[11px]">
                    {m.label}
                  </p>

                  <p className="mt-1.5 truncate text-base font-bold text-slate-800 sm:text-xl">
                    {fmt(m.total)}
                  </p>
                </div>

                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${m.bg} sm:h-9 sm:w-9`}
                >
                  <Icon size={15} className={m.text} />
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400 sm:text-xs">
                  {m.count} transactions
                </span>

                <span
                  className={`text-[9px] font-semibold ${m.text}`}
                >
                  View
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Quick payment totals */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm sm:p-4">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">
            Collected
          </p>
          <p className="mt-1 text-base font-bold text-emerald-600 sm:text-xl">
            {fmt(totalCollected)}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">
            Non-credit payments
          </p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-white p-3 shadow-sm sm:p-4">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 sm:text-[10px]">
            Credit Due
          </p>
          <p className="mt-1 text-base font-bold text-rose-600 sm:text-xl">
            {fmt(totalCredit)}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">
            Credit transactions
          </p>
        </div>
      </div>

      {/* Transactions */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-slate-100 px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-center gap-2">
            <h2 className="shrink-0 text-sm font-semibold text-slate-800">
              Payment Transactions
            </h2>

            <div className="ml-auto flex min-w-0 items-center gap-2">
              {/* Search */}
              <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search invoice, customer..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-8 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-50"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Refresh */}
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                title="Refresh payments"
                aria-label="Refresh payments"
              >
                <RefreshCw
                  size={14}
                  className={loading ? 'animate-spin' : ''}
                />
              </button>
            </div>
          </div>

          {/* Mobile filter scroller */}
          <div className="mt-3 -mx-1 overflow-x-auto px-1 pb-0.5">
            <div className="flex min-w-max gap-1 rounded-xl bg-slate-100 p-1">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`rounded-lg px-3 py-2 text-[11px] font-semibold transition-all ${
                    filter === f.key
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-14">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-14 text-center text-slate-400">
            <Wallet size={28} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">No transactions found</p>
            <p className="mt-1 text-xs">
              Try another search or payment method.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {filtered.map(b => {
                const meta =
                  METHOD_META[b.payment_method] || METHOD_META.cash
                const Icon = meta.icon

                return (
                  <div key={b.id} className="p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs font-bold text-blue-600">
                          {b.invoice_number}
                        </p>

                        <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                          {b.customer_name || 'Walk-in'}
                        </p>

                        {b.customer_phone && (
                          <p className="mt-1 text-[10px] text-slate-400">
                            {b.customer_phone}
                          </p>
                        )}
                      </div>

                      <p className="shrink-0 text-sm font-bold text-slate-800">
                        {fmt(b.grand_total)}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Payment
                        </p>

                        <span
                          className={`mt-1.5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold ${meta.bg} ${meta.text}`}
                        >
                          <Icon size={11} />
                          {meta.label}
                        </span>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          Date
                        </p>
                        <p className="mt-1.5 text-[10px] font-semibold text-slate-600">
                          {new Date(
                            b.created_at
                          ).toLocaleDateString('en-IN')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <Badge status={b.payment_status} />

                      {b.payment_method === 'credit' && (
                        <span className="text-[10px] font-semibold text-rose-600">
                          Credit due
                        </span>
                      )}

                      {b.payment_method === 'online' && (
                        <span className="text-[10px] font-semibold text-cyan-600">
                          Online payment
                        </span>
                      )}
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
                    const meta =
                      METHOD_META[b.payment_method] || METHOD_META.cash
                    const Icon = meta.icon

                    return (
                      <tr key={b.id}>
                        <td className="font-mono text-sm font-semibold text-blue-600">
                          {b.invoice_number}
                        </td>

                        <td className="text-sm text-slate-700">
                          {b.customer_name || 'Walk-in'}
                        </td>

                        <td className="text-sm text-slate-500">
                          {new Date(
                            b.created_at
                          ).toLocaleDateString('en-IN')}
                        </td>

                        <td>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${meta.bg} ${meta.text}`}
                          >
                            <Icon size={11} />
                            {meta.label}
                          </span>
                        </td>

                        <td className="text-sm font-bold text-slate-800">
                          {fmt(b.grand_total)}
                        </td>

                        <td>
                          <Badge status={b.payment_status} />
                        </td>
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