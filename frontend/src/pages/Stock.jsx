import { useEffect, useMemo, useState } from 'react'
import api from '../api'
import { Badge, Spinner } from '../components/UI'
import {
  Boxes,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  SlidersHorizontal,
  PackageSearch,
  ChevronDown,
  X,
} from 'lucide-react'

const FILTERS = [
  { key: 'all', label: 'All Products', shortLabel: 'All', icon: Boxes },
  { key: 'in_stock', label: 'In Stock', shortLabel: 'In Stock', icon: CheckCircle },
  { key: 'low_stock', label: 'Low Stock', shortLabel: 'Low Stock', icon: AlertTriangle },
  { key: 'out_of_stock', label: 'Out of Stock', shortLabel: 'Out', icon: XCircle },
]

const getStatus = product => {
  const current = Number(product.current_stock || 0)
  const minimum = Number(product.minimum_stock || 0)

  if (current <= 0) return 'out_of_stock'
  if (current <= minimum) return 'low_stock'
  return 'in_stock'
}

const STATUS_META = {
  in_stock: {
    label: 'In Stock',
    icon: CheckCircle,
    tone: 'success',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    soft: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-900/60',
  },
  low_stock: {
    label: 'Low Stock',
    icon: AlertTriangle,
    tone: 'warning',
    bar: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    soft: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-900/60',
  },
  out_of_stock: {
    label: 'Out of Stock',
    icon: XCircle,
    tone: 'danger',
    bar: 'bg-red-500',
    text: 'text-red-700 dark:text-red-300',
    soft: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-900/60',
  },
}

const statCards = [
  {
    key: 'all',
    label: 'Total Products',
    icon: Boxes,
    iconClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60',
  },
  {
    key: 'in_stock',
    label: 'In Stock',
    icon: CheckCircle,
    iconClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
  },
  {
    key: 'low_stock',
    label: 'Low Stock',
    icon: AlertTriangle,
    iconClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
  },
  {
    key: 'out_of_stock',
    label: 'Out of Stock',
    icon: XCircle,
    iconClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60',
  },
]

function StockProgress({ product, status }) {
  const current = Math.max(0, Number(product.current_stock || 0))
  const minimum = Math.max(0, Number(product.minimum_stock || 0))
  const max = Math.max(current, minimum, 1)
  const percentage = Math.min(100, Math.round((current / max) * 100))
  const meta = STATUS_META[status]

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-[var(--muted)]">
        <span>Stock level</span>
        <span>{percentage}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
        <div
          className={`h-full rounded-full transition-all ${meta.bar}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function MobileStockCard({ product }) {
  const status = getStatus(product)
  const meta = STATUS_META[status]
  const StatusIcon = meta.icon

  return (
    <article className="stock-surface rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--primary)]">
          <PackageSearch size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-[var(--ink)]">
            {product.name || 'Unnamed product'}
          </h3>
          <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--muted)]">
            {product.sku || 'No SKU'}
          </p>
        </div>

        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${meta.soft} ${meta.border} ${meta.text}`}>
          <StatusIcon size={11} />
          {meta.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-light)]">
            Current stock
          </p>
          <p className={`mt-1 text-xl font-bold ${meta.text}`}>
            {product.current_stock ?? 0}
            <span className="ml-1 text-xs font-medium text-[var(--muted)]">
              {product.unit || 'pcs'}
            </span>
          </p>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-light)]">
            Minimum stock
          </p>
          <p className="mt-1 text-xl font-bold text-[var(--ink)]">
            {product.minimum_stock ?? 0}
          </p>
        </div>
      </div>

      <StockProgress product={product} status={status} />

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--line-subtle)] pt-3 text-xs">
        <span className="truncate text-[var(--muted)]">
          {product.category_name || 'Uncategorized'}
        </span>
        {product.supplier_name && (
          <span className="max-w-[52%] truncate text-right text-[var(--muted-light)]">
            {product.supplier_name}
          </span>
        )}
      </div>
    </article>
  )
}

export default function Stock() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const load = () => {
    setLoading(true)

    api.get('/products/')
      .then(response => {
        setProducts(response.data?.results || response.data || [])
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => ({
    all: products.length,
    in_stock: products.filter(product => getStatus(product) === 'in_stock').length,
    low_stock: products.filter(product => getStatus(product) === 'low_stock').length,
    out_of_stock: products.filter(product => getStatus(product) === 'out_of_stock').length,
  }), [products])

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase()

    return products
      .filter(product => filter === 'all' || getStatus(product) === filter)
      .filter(product => {
        if (!search) return true

        return [
          product.name,
          product.sku,
          product.category_name,
          product.supplier_name,
          product.barcode,
        ].some(value => String(value || '').toLowerCase().includes(search))
      })
  }, [products, filter, q])

  const activeFilterLabel = FILTERS.find(item => item.key === filter)?.label || 'All Products'

  return (
    <div className="stock-page min-w-0 space-y-5 text-[var(--ink)]">
      <style>{`
        .stock-page {
          color-scheme: light;
        }

        .dark .stock-page {
          color-scheme: dark;
        }

        .stock-page input {
          color: var(--ink);
          background: var(--surface);
        }

        .stock-page input::placeholder {
          color: var(--muted-light);
          opacity: 1;
        }

        .stock-page input[type="search"]::-webkit-search-cancel-button {
          -webkit-appearance: none;
          appearance: none;
        }

        .stock-page .stock-table tbody tr {
          background: var(--surface);
        }

        .stock-page .stock-table tbody tr:hover {
          background: var(--surface-muted);
        }

        @media (max-width: 639px) {
          .stock-page .desktop-only-table {
            display: none;
          }
        }

        @media (min-width: 640px) {
          .stock-page .mobile-only-cards {
            display: none;
          }
        }
      `}</style>

      {/* Overview cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map(stat => {
          const Icon = stat.icon
          const selected = filter === stat.key

          return (
            <button
              key={stat.key}
              type="button"
              onClick={() => setFilter(stat.key)}
              aria-pressed={selected}
              className={`group min-w-0 rounded-2xl border bg-[var(--surface)] p-3 text-left shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-4 ${
                selected
                  ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/20'
                  : 'border-[var(--line)]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-light)] sm:text-[11px]">
                  {stat.label}
                </span>
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border sm:h-9 sm:w-9 ${stat.iconClass}`}>
                  <Icon size={16} />
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold tracking-tight text-[var(--ink)] sm:text-3xl">
                {counts[stat.key]}
              </p>
              <p className="mt-1 text-[10px] text-[var(--muted)] sm:text-xs">
                {selected ? 'Currently selected' : 'View products'}
              </p>
            </button>
          )
        })}
      </section>

      {/* Main stock panel */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[var(--line-subtle)] p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-base font-bold text-[var(--ink)] sm:text-lg">
                  Stock Levels
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Monitor inventory availability and low-stock items.
                </p>
              </div>

              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="icon-btn shrink-0"
                title="Refresh stock"
                aria-label="Refresh stock"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
              {/* Search */}
              <div className="relative min-w-0 flex-1">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  type="search"
                  value={q}
                  onChange={event => setQ(event.target.value)}
                  placeholder="        Search product, SKU, barcode, category..."
                  aria-label="Search stock"
                  className="input h-12 w-full min-w-0 pl-11 pr-10 text-sm font-medium"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => setQ('')}
                    aria-label="Clear search"
                    title="Clear search"
                    className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--ink)]"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Desktop filter tabs */}
              <div className="hidden shrink-0 items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1 sm:flex">
                {FILTERS.map(item => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key)}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                      filter === item.key
                        ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {item.shortLabel}
                    <span className="ml-1 opacity-60">({counts[item.key]})</span>
                  </button>
                ))}
              </div>

              {/* Mobile filter trigger */}
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(open => !open)}
                className="flex h-11 w-full items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 text-sm font-semibold text-[var(--ink)] sm:hidden"
                aria-expanded={mobileFiltersOpen}
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal size={15} />
                  {activeFilterLabel}
                </span>
                <ChevronDown size={16} className={mobileFiltersOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>

              {mobileFiltersOpen && (
                <div className="grid grid-cols-2 gap-2 sm:hidden">
                  {FILTERS.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setFilter(item.key)
                        setMobileFiltersOpen(false)
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold ${
                        filter === item.key
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]'
                      }`}
                    >
                      {item.label}
                      <span className="ml-1 opacity-70">({counts[item.key]})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
              <span>
                Showing <strong className="text-[var(--ink)]">{filtered.length}</strong> of {products.length} products
              </span>
              {(q || filter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setQ('')
                    setFilter('all')
                  }}
                  className="font-semibold text-[var(--primary)] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center p-6">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-5 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-muted)] text-[var(--muted-light)]">
              <Boxes size={28} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">No products found</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Try changing the search term or stock filter.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setQ('')
                setFilter('all')
              }}
              className="btn-secondary text-sm"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="mobile-only-cards space-y-3 p-3">
              {filtered.map(product => (
                <MobileStockCard key={product.id} product={product} />
              ))}
            </div>

            {/* Desktop/tablet table */}
            <div className="desktop-only-table w-full overflow-x-auto">
              <table className="table stock-table min-w-[760px]">
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
                  {filtered.map(product => {
                    const status = getStatus(product)
                    const meta = STATUS_META[status]

                    return (
                      <tr key={product.id}>
                        <td>
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--primary)]">
                              <PackageSearch size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="max-w-[250px] truncate text-sm font-semibold text-[var(--ink)]">
                                {product.name || 'Unnamed product'}
                              </div>
                              {product.supplier_name && (
                                <div className="max-w-[250px] truncate text-xs text-[var(--muted-light)]">
                                  {product.supplier_name}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="font-mono text-xs text-[var(--muted)]">
                          {product.sku || '—'}
                        </td>
                        <td className="text-sm text-[var(--muted)]">
                          {product.category_name || 'Uncategorized'}
                        </td>
                        <td>
                          <span className={`text-sm font-bold ${meta.text}`}>
                            {product.current_stock ?? 0}
                          </span>
                          <span className="ml-1 text-xs text-[var(--muted-light)]">
                            {product.unit || 'pcs'}
                          </span>
                        </td>
                        <td className="text-sm text-[var(--muted)]">
                          {product.minimum_stock ?? 0}
                        </td>
                        <td>
                          <Badge status={status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
