import { useEffect, useMemo, useState, useRef } from 'react'
import api, { API_BASE_URL } from '../api'
import productService from '../features/inventory/api/productService'
import { Badge, PageHeader, Modal, Spinner, EmptyState } from '../components/UI'
import toast from 'react-hot-toast'
import BarcodePrintModal from '../components/BarcodePrintModal'
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
  Download,
  Barcode,
  History,
  TrendingDown,
  TrendingUp,
  Tag,
  ArrowUpDown,
  Filter,
} from 'lucide-react'

const getStatus = product => {
  const current = Number(product.current_stock || 0)
  const minimum = Number(product.minimum_stock || 5)

  if (current <= 0) return 'out_of_stock'
  if (current <= minimum) return 'low_stock'
  return 'in_stock'
}

const STATUS_META = {
  in_stock: {
    label: 'In Stock',
    icon: CheckCircle,
    text: 'text-teal-700 dark:text-teal-300 font-semibold',
    soft: 'bg-teal-50 dark:bg-teal-950/40',
    border: 'border-teal-200 dark:border-teal-800/60',
    bar: 'bg-teal-500',
  },
  low_stock: {
    label: 'Low Stock',
    icon: AlertTriangle,
    text: 'text-amber-700 dark:text-amber-300 font-bold',
    soft: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800/60',
    bar: 'bg-amber-500',
  },
  out_of_stock: {
    label: 'Out of Stock',
    icon: XCircle,
    text: 'text-rose-700 dark:text-rose-300 font-bold',
    soft: 'bg-rose-50 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-800/60',
    bar: 'bg-rose-500',
  },
}

const fmtCurrency = val =>
  `₹${Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export default function Stock() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filter, setFilter] = useState('all') // 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  const [q, setQ] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedSup, setSelectedSup] = useState('')
  const [sortBy, setSortBy] = useState('stock')
  const [sortDir, setSortDir] = useState('asc')

  // Modals
  const [adjustModal, setAdjustModal] = useState(false)
  const [adjustProduct, setAdjustProduct] = useState(null)
  const [adjustMode, setAdjustMode] = useState('add')
  const [adjustQty, setAdjustQty] = useState('1')
  const [adjustReason, setAdjustReason] = useState('adjustment')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  // History Modal
  const [historyModal, setHistoryModal] = useState(false)
  const [historyProduct, setHistoryProduct] = useState(null)
  const [historyList, setHistoryList] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [barcodeProduct, setBarcodeProduct] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [prodRes, catRes, supRes] = await Promise.all([
        api.get('/products/?page_size=300'),
        productService.getCategories({ page_size: 100 }),
        productService.getSuppliers({ page_size: 100 }).catch(() => []),
      ])
      const prodData = prodRes.data?.results || prodRes.data || []
      setProducts(Array.isArray(prodData) ? prodData : [])
      setCategories(Array.isArray(catRes) ? catRes : [])
      setSuppliers(Array.isArray(supRes) ? supRes : [])
    } catch (err) {
      console.error('Failed to load stock data:', err)
      toast.error('Failed to load inventory stock data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // KPI Calculations
  const metrics = useMemo(() => {
    let totalItems = products.length
    let inStock = 0
    let lowStock = 0
    let outStock = 0
    let totalStockUnits = 0
    let totalStockValue = 0

    products.forEach(p => {
      const st = getStatus(p)
      const stock = Number(p.current_stock || 0)
      const cost = Number(p.purchase_price || 0)

      if (st === 'in_stock') inStock++
      else if (st === 'low_stock') lowStock++
      else if (st === 'out_of_stock') outStock++

      totalStockUnits += Math.max(0, stock)
      totalStockValue += Math.max(0, stock) * cost
    })

    return {
      totalItems,
      inStock,
      lowStock,
      outStock,
      totalStockUnits,
      totalStockValue,
    }
  }, [products])

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    const search = q.trim().toLowerCase()

    return products
      .filter(p => {
        const st = getStatus(p)
        if (filter !== 'all' && st !== filter) return false
        if (selectedCat && String(p.category) !== String(selectedCat)) return false
        if (selectedSup && String(p.supplier) !== String(selectedSup)) return false

        if (search) {
          return [
            p.name,
            p.sku,
            p.category_name,
            p.supplier_name,
            p.barcode,
            p.brand,
          ].some(val => String(val || '').toLowerCase().includes(search))
        }

        return true
      })
      .sort((a, b) => {
        let valA, valB

        if (sortBy === 'name') {
          valA = (a.name || '').toLowerCase()
          valB = (b.name || '').toLowerCase()
          return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
        } else if (sortBy === 'stock') {
          valA = Number(a.current_stock || 0)
          valB = Number(b.current_stock || 0)
        } else if (sortBy === 'cost') {
          valA = Number(a.purchase_price || 0)
          valB = Number(b.purchase_price || 0)
        } else if (sortBy === 'value') {
          valA = Number(a.current_stock || 0) * Number(a.purchase_price || 0)
          valB = Number(b.current_stock || 0) * Number(b.purchase_price || 0)
        } else {
          valA = Number(a.current_stock || 0)
          valB = Number(b.current_stock || 0)
        }

        return sortDir === 'asc' ? valA - valB : valB - valA
      })
  }, [products, filter, selectedCat, selectedSup, q, sortBy, sortDir])

  const handleSort = col => {
    if (sortBy === col) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
  }

  const resetFilters = () => {
    setQ('')
    setFilter('all')
    setSelectedCat('')
    setSelectedSup('')
  }

  const isFilterActive =
    Boolean(q) || filter !== 'all' || Boolean(selectedCat) || Boolean(selectedSup)

  // Quick Adjust Modal Handlers
  const openAdjust = product => {
    setAdjustProduct(product)
    setAdjustMode('add')
    setAdjustQty('1')
    setAdjustReason('adjustment')
    setAdjustNotes('')
    setAdjustModal(true)
  }

  const submitAdjust = async () => {
    if (!adjustProduct?.id) return
    const current = Number(adjustProduct.current_stock || 0)
    const qty = Number(adjustQty)

    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }

    let delta = 0
    if (adjustMode === 'add') delta = qty
    else if (adjustMode === 'deduct') delta = -qty
    else if (adjustMode === 'set') delta = qty - current

    if (delta === 0) {
      toast.error('No change in stock detected')
      return
    }

    setAdjusting(true)
    try {
      await productService.adjustStock({
        product_id: adjustProduct.id,
        quantity: delta,
        transaction_type: adjustReason,
        notes: adjustNotes.trim(),
      })
      toast.success('Stock adjusted successfully')
      setAdjustModal(false)
      await load()
    } catch (err) {
      // Fallback direct patch if adjust endpoint has permission limitation
      try {
        const nextStock = Math.max(0, current + delta)
        await api.patch(`/products/${adjustProduct.id}/`, {
          current_stock: nextStock,
        })
        toast.success('Stock updated successfully')
        setAdjustModal(false)
        await load()
      } catch (e) {
        toast.error('Failed to adjust stock')
      }
    } finally {
      setAdjusting(false)
    }
  }

  // Open Movement History Modal
  const openHistory = async product => {
    setHistoryProduct(product)
    setHistoryModal(true)
    setLoadingHistory(true)
    try {
      const txs = await productService.getInventoryTransactions(product.id)
      setHistoryList(Array.isArray(txs) ? txs : [])
    } catch (err) {
      console.error('Failed to load transactions:', err)
      setHistoryList([])
    } finally {
      setLoadingHistory(false)
    }
  }

  // Export Stock CSV
  const exportStockCSV = () => {
    const list = filteredProducts.length > 0 ? filteredProducts : products
    if (list.length === 0) {
      toast.error('No stock items to export')
      return
    }

    const headers = [
      'Product Name',
      'SKU',
      'Barcode',
      'Category',
      'Supplier',
      'Current Stock',
      'Min Stock Level',
      'Unit',
      'Purchase Price',
      'Selling Price',
      'Stock Valuation',
      'Status',
    ]

    const rows = list.map(p => [
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.sku || '').replace(/"/g, '""')}"`,
      `"${(p.barcode || '').replace(/"/g, '""')}"`,
      `"${(p.category_name || '').replace(/"/g, '""')}"`,
      `"${(p.supplier_name || '').replace(/"/g, '""')}"`,
      p.current_stock ?? 0,
      p.minimum_stock ?? 5,
      p.unit || 'pcs',
      p.purchase_price ?? 0,
      p.selling_price ?? 0,
      Number(p.current_stock || 0) * Number(p.purchase_price || 0),
      getStatus(p).replace('_', ' ').toUpperCase(),
    ])

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `inventory_stock_report_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Exported ${list.length} inventory records`)
  }

  return (
    <div className="stock-page min-w-0 space-y-5 text-[var(--ink)]">
      <style>{`
        .stock-page .erp-table {
          width: 100%;
          border-collapse: collapse;
        }

        .stock-page .erp-table th {
          padding: 12px 14px;
          text-align: left;
          white-space: nowrap;
          background: var(--surface-elevated);
          border-bottom: 1px solid var(--line);
          color: var(--muted-light);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .05em;
          text-transform: uppercase;
        }

        .stock-page .erp-table td {
          padding: 13px 14px;
          border-bottom: 1px solid var(--line-subtle);
          vertical-align: middle;
        }

        .stock-page .erp-table tbody tr:hover {
          background: var(--surface-elevated);
        }
      `}</style>

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}
      <PageHeader
        title="Stock & Inventory Control"
        subtitle={`Track real-time inventory balances, stock valuation, low-stock reorder thresholds, and ledger movements.`}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportStockCSV}
              className="btn-secondary btn-base text-xs flex items-center gap-1.5"
              title="Download Stock CSV"
            >
              <Download size={14} />
              Export Stock
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="btn-secondary btn-base text-xs flex items-center gap-1.5"
              title="Refresh balances"
            >
              <RefreshCw
                size={14}
                className={loading ? 'animate-spin text-indigo-600' : ''}
              />
              Refresh
            </button>
          </div>
        }
      />

      {/* =====================================================
          EXECUTIVE STOCK KPI TILES
      ====================================================== */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Total Catalog Items */}
        <div
          onClick={() => setFilter('all')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
            filter === 'all'
              ? 'border-indigo-400 bg-[var(--surface-elevated)] ring-1 ring-indigo-400'
              : 'border-[var(--line)] bg-[var(--surface)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Total Products
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Boxes size={15} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-[var(--ink)]">
            {metrics.totalItems}
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            {metrics.totalStockUnits.toLocaleString('en-IN')} units on hand
          </p>
        </div>

        {/* In Stock (Healthy) */}
        <div
          onClick={() => setFilter('in_stock')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
            filter === 'in_stock'
              ? 'border-teal-400 bg-[var(--surface-elevated)] ring-1 ring-teal-400'
              : 'border-[var(--line)] bg-[var(--surface)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              In Stock
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
              <CheckCircle size={15} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-teal-600 dark:text-teal-400">
            {metrics.inStock}
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Healthy &gt; minimum level
          </p>
        </div>

        {/* Low Stock Alert */}
        <div
          onClick={() => setFilter('low_stock')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
            filter === 'low_stock'
              ? 'border-amber-400 bg-[var(--surface-elevated)] ring-1 ring-amber-400'
              : 'border-[var(--line)] bg-[var(--surface)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Low Stock Alert
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <AlertTriangle size={15} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-amber-600 dark:text-amber-400">
            {metrics.lowStock}
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Reorder threshold reached
          </p>
        </div>

        {/* Out of Stock */}
        <div
          onClick={() => setFilter('out_of_stock')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
            filter === 'out_of_stock'
              ? 'border-rose-400 bg-[var(--surface-elevated)] ring-1 ring-rose-400'
              : 'border-[var(--line)] bg-[var(--surface)]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Out of Stock
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <XCircle size={15} />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-bold text-rose-600 dark:text-rose-400">
            {metrics.outStock}
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Zero inventory balance
          </p>
        </div>

        {/* Total Stock Valuation */}
        <div className="col-span-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Stock Valuation
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <Tag size={15} />
            </span>
          </div>
          <p className="mt-2 font-mono text-xl sm:text-2xl font-bold text-[var(--ink)]">
            {fmtCurrency(metrics.totalStockValue)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            Cost price basis
          </p>
        </div>
      </section>

      {/* =====================================================
          FILTER & SEARCH WORKBENCH
      ====================================================== */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-center">
          {/* Search bar */}
          <div className="relative min-w-0 sm:col-span-2 lg:col-span-5">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              type="search"
              className="input h-11 w-full pl-10 pr-9 text-xs sm:text-sm font-medium"
              placeholder="Search product name, SKU, barcode, supplier..."
              value={q}
              onChange={e => setQ(e.target.value)}
              aria-label="Search inventory"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="min-w-0 lg:col-span-3">
            <select
              className="input h-11 w-full text-xs font-medium"
              value={selectedCat}
              onChange={e => setSelectedCat(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier Filter */}
          <div className="min-w-0 lg:col-span-3">
            <select
              className="input h-11 w-full text-xs font-medium"
              value={selectedSup}
              onChange={e => setSelectedSup(e.target.value)}
              aria-label="Filter by supplier"
            >
              <option value="">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-center lg:col-span-1">
            {isFilterActive && (
              <button
                type="button"
                onClick={resetFilters}
                className="btn-secondary h-11 w-full flex items-center justify-center gap-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                title="Clear all filters"
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Quick Filter Tabs */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-[var(--line-subtle)] text-xs">
          <SlidersHorizontal
            size={13}
            className="shrink-0 text-[var(--muted-light)] mr-1"
          />
          {[
            { key: 'all', label: 'All Items' },
            { key: 'in_stock', label: 'In Stock' },
            { key: 'low_stock', label: 'Low Stock Alerts' },
            { key: 'out_of_stock', label: 'Out of Stock' },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                filter === tab.key
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================
          STOCK DATA TABLE & CARDS
      ====================================================== */}
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[var(--ink)]">
              Inventory Ledger Balances
            </h2>
            <span className="rounded-full bg-[var(--surface-elevated)] px-2.5 py-0.5 text-xs font-semibold text-[var(--muted)]">
              {filteredProducts.length} product
              {filteredProducts.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="hidden sm:block text-xs text-[var(--muted)]">
            Total Valuation:{' '}
            <span className="font-mono font-bold text-[var(--ink)]">
              {fmtCurrency(
                filteredProducts.reduce(
                  (sum, p) =>
                    sum +
                    Math.max(0, Number(p.current_stock || 0)) *
                      Number(p.purchase_price || 0),
                  0,
                ),
              )}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="px-4 py-16">
            <EmptyState
              message={
                isFilterActive
                  ? 'No inventory items match your search or filter criteria'
                  : 'No products found in inventory'
              }
              action={
                isFilterActive ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="btn-secondary btn-base mt-3"
                  >
                    Reset Filters
                  </button>
                ) : null
              }
            />
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="divide-y divide-[var(--line-subtle)] md:hidden">
              {filteredProducts.map(p => {
                const st = getStatus(p)
                const meta = STATUS_META[st]
                const Icon = meta.icon
                const current = Math.max(0, Number(p.current_stock || 0))
                const minimum = Math.max(0, Number(p.minimum_stock || 5))
                const max = Math.max(current, minimum, 1)
                const pct = Math.min(100, Math.round((current / max) * 100))

                return (
                  <article key={p.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[var(--ink)] truncate">
                          {p.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-[var(--muted)] font-mono">
                          SKU: {p.sku || '—'} • {p.category_name || 'Uncategorized'}
                        </p>
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.soft} ${meta.border} ${meta.text}`}
                      >
                        <Icon size={12} />
                        {meta.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-elevated)] p-2.5 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--muted-light)]">
                          Stock
                        </span>
                        <p className={`mt-0.5 font-mono ${meta.text}`}>
                          {p.current_stock ?? 0}{' '}
                          <span className="text-[10px] font-normal text-[var(--muted)]">
                            {p.unit || 'pcs'}
                          </span>
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--muted-light)]">
                          Min Level
                        </span>
                        <p className="mt-0.5 font-mono text-[var(--muted)]">
                          {p.minimum_stock ?? 5}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--muted-light)]">
                          Valuation
                        </span>
                        <p className="mt-0.5 font-mono font-bold text-[var(--ink)]">
                          {fmtCurrency(
                            Number(p.current_stock || 0) *
                              Number(p.purchase_price || 0),
                          )}
                        </p>
                      </div>
                    </div>


                    {/* Action Bar */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--line-subtle)]">
                      <button
                        type="button"
                        onClick={() => setBarcodeProduct(p)}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-elevated)] flex items-center gap-1"
                        title="Print Barcode Labels"
                      >
                        <Barcode size={12} />
                        Barcode
                      </button>
                      <button
                        type="button"
                        onClick={() => openHistory(p)}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-elevated)] flex items-center gap-1"
                      >
                        <History size={12} />
                        History
                      </button>
                      <button
                        type="button"
                        onClick={() => openAdjust(p)}
                        className="rounded-lg bg-indigo-600 text-white px-3 py-1 text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1"
                      >
                        <SlidersHorizontal size={12} />
                        Adjust Stock
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th
                      className="cursor-pointer hover:text-[var(--ink)]"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        Product
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th>Category &amp; Supplier</th>
                    <th
                      className="text-right cursor-pointer hover:text-[var(--ink)]"
                      onClick={() => handleSort('stock')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Current Stock
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="text-right">Min Threshold</th>
                    <th
                      className="text-right cursor-pointer hover:text-[var(--ink)]"
                      onClick={() => handleSort('cost')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Unit Cost
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th
                      className="text-right cursor-pointer hover:text-[var(--ink)]"
                      onClick={() => handleSort('value')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Total Value
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="text-center">Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map(p => {
                    const st = getStatus(p)
                    const meta = STATUS_META[st]
                    const Icon = meta.icon
                    const current = Math.max(0, Number(p.current_stock || 0))
                    const minimum = Math.max(0, Number(p.minimum_stock || 5))
                    const max = Math.max(current, minimum, 1)
                    const pct = Math.min(100, Math.round((current / max) * 100))

                    return (
                      <tr key={p.id}>
                        {/* Name & SKU */}
                        <td>
                          <div className="min-w-44">
                            <span className="font-bold text-sm text-[var(--ink)] block truncate">
                              {p.name}
                            </span>
                            <div className="mt-0.5 flex items-center gap-2 text-xs font-mono text-[var(--muted)]">
                              <span>SKU: {p.sku || '—'}</span>
                              {p.barcode && <span>• Bar: {p.barcode}</span>}
                            </div>
                          </div>
                        </td>

                        {/* Category & Supplier */}
                        <td>
                          <div className="text-xs">
                            <span className="font-medium text-[var(--ink-secondary)]">
                              {p.category_name || 'Uncategorized'}
                            </span>
                            {p.supplier_name && (
                              <p className="text-[11px] text-[var(--muted)] mt-0.5">
                                {p.supplier_name}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Current Stock */}
                        <td className="text-right font-mono font-bold text-sm">
                          <span className={meta.text}>
                            {p.current_stock ?? 0}{' '}
                            <span className="text-xs font-normal text-[var(--muted)]">
                              {p.unit || 'pcs'}
                            </span>
                          </span>
                        </td>


                        {/* Minimum Stock */}
                        <td className="text-right font-mono text-xs text-[var(--muted)]">
                          {p.minimum_stock ?? 5} {p.unit || 'pcs'}
                        </td>

                        {/* Unit Cost */}
                        <td className="text-right font-mono text-xs text-[var(--muted)]">
                          {fmtCurrency(p.purchase_price)}
                        </td>

                        {/* Total Stock Value */}
                        <td className="text-right font-mono font-bold text-sm text-[var(--ink)]">
                          {fmtCurrency(
                            Number(p.current_stock || 0) *
                              Number(p.purchase_price || 0),
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.soft} ${meta.border} ${meta.text}`}
                          >
                            <Icon size={12} />
                            {meta.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setBarcodeProduct(p)}
                              className="icon-btn"
                              title="Print Barcode Labels"
                              aria-label="Barcode"
                            >
                              <Barcode size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => openHistory(p)}
                              className="icon-btn"
                              title="View Movement History"
                              aria-label="History"
                            >
                              <History size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => openAdjust(p)}
                              className="btn-primary btn-sm flex items-center gap-1 text-xs"
                              title="Adjust Stock"
                            >
                              <SlidersHorizontal size={13} />
                              Adjust
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Footer summary */}
        {!loading && filteredProducts.length > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]">
            <span>
              Showing {filteredProducts.length} of {products.length} catalog items
            </span>
            <span className="font-mono">
              Total Units:{' '}
              {filteredProducts
                .reduce((sum, p) => sum + Math.max(0, Number(p.current_stock || 0)), 0)
                .toLocaleString('en-IN')}{' '}
              units
            </span>
          </div>
        )}
      </div>

      {/* =====================================================
          STOCK ADJUSTMENT MODAL
      ====================================================== */}
      <Modal
        open={adjustModal}
        onClose={() => !adjusting && setAdjustModal(false)}
        title={
          adjustProduct
            ? `Adjust Stock: ${adjustProduct.name}`
            : 'Inventory Stock Adjustment'
        }
        size="md"
      >
        {adjustProduct && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[var(--muted)]">
                  SKU: {adjustProduct.sku}
                </span>
                <span className="font-bold text-[var(--ink)]">
                  Current Balance: {adjustProduct.current_stock ?? 0}{' '}
                  {adjustProduct.unit || 'pcs'}
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--ink-secondary)]">
                Adjustment Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'add', label: 'Add Stock (+)' },
                  { key: 'deduct', label: 'Deduct / Damage (-)' },
                  { key: 'set', label: 'Set Exact Balance' },
                ].map(m => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setAdjustMode(m.key)}
                    className={`rounded-xl border py-2 text-xs font-semibold transition ${
                      adjustMode === m.key
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                        : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--ink-secondary)]">
                {adjustMode === 'set' ? 'Target Stock Count' : 'Quantity'}
              </label>
              <input
                type="number"
                min={adjustMode === 'set' ? '0' : '0.01'}
                step="0.01"
                className="input font-mono text-base font-bold"
                value={adjustQty}
                onChange={e => setAdjustQty(e.target.value)}
                placeholder="1"
              />
            </div>

            {/* Projected Result */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">Resulting Stock:</span>
                <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {(() => {
                    const cur = Number(adjustProduct.current_stock || 0)
                    const qVal = Number(adjustQty) || 0
                    if (adjustMode === 'add') return cur + qVal
                    if (adjustMode === 'deduct') return Math.max(0, cur - qVal)
                    if (adjustMode === 'set') return Math.max(0, qVal)
                    return cur
                  })()}{' '}
                  {adjustProduct.unit || 'pcs'}
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--ink-secondary)]">
                Reason for Adjustment
              </label>
              <select
                className="input text-xs"
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
              >
                <option value="adjustment">Stock Count / Audit Correction</option>
                <option value="damage">Damaged in Transit / Warehouse</option>
                <option value="audit">Physical Inventory Audit</option>
                <option value="loss">Expired / Wastage Write-off</option>
                <option value="returned">Customer Return Received</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--ink-secondary)]">
                Remarks / Notes (Optional)
              </label>
              <textarea
                className="input min-h-20 text-xs"
                value={adjustNotes}
                onChange={e => setAdjustNotes(e.target.value)}
                placeholder="Audit notes or reasons..."
              />
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setAdjustModal(false)}
                disabled={adjusting}
                className="btn-secondary btn-base sm:w-28"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAdjust}
                disabled={adjusting}
                className="btn-primary btn-base sm:w-36 flex items-center justify-center gap-2"
              >
                {adjusting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Saving...
                  </>
                ) : (
                  'Confirm Stock'
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* =====================================================
          STOCK MOVEMENT HISTORY MODAL
      ====================================================== */}
      <Modal
        open={historyModal}
        onClose={() => setHistoryModal(false)}
        title={
          historyProduct
            ? `Stock Movement History: ${historyProduct.name}`
            : 'Stock Movement Ledger'
        }
        size="lg"
      >
        <div className="space-y-4">
          {historyProduct && (
            <div className="flex items-center justify-between text-xs rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3">
              <span className="font-mono text-[var(--muted)]">
                SKU: {historyProduct.sku}
              </span>
              <span className="font-bold text-[var(--ink)]">
                Current Balance: {historyProduct.current_stock ?? 0}{' '}
                {historyProduct.unit || 'pcs'}
              </span>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
            {loadingHistory ? (
              <div className="flex min-h-36 items-center justify-center p-6">
                <Spinner />
              </div>
            ) : historyList.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--muted)]">
                No recorded stock movement ledger entries for this product yet.
              </div>
            ) : (
              <table className="erp-table text-xs">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Before</th>
                    <th className="text-right">After</th>
                    <th>Staff / Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map(tx => (
                    <tr key={tx.id}>
                      <td className="font-mono whitespace-nowrap text-[var(--muted)]">
                        {new Date(tx.created_at).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                            tx.transaction_type === 'sale'
                              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                              : tx.transaction_type === 'purchase'
                                ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                          }`}
                        >
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="font-mono font-medium text-[var(--ink)]">
                        {tx.reference || tx.reference_id || '—'}
                      </td>
                      <td className="text-right font-mono font-bold">
                        <span
                          className={
                            Number(tx.quantity) >= 0
                              ? 'text-teal-600 dark:text-teal-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }
                        >
                          {Number(tx.quantity) > 0 ? '+' : ''}
                          {tx.quantity}
                        </span>
                      </td>
                      <td className="text-right font-mono text-[var(--muted)]">
                        {tx.before_stock ?? '—'}
                      </td>
                      <td className="text-right font-mono font-semibold text-[var(--ink)]">
                        {tx.after_stock ?? '—'}
                      </td>
                      <td className="text-[var(--muted)] text-[11px]">
                        {tx.notes || '—'}
                        {tx.created_by_name && (
                          <span className="block text-[10px] text-[var(--muted-light)]">
                            By: {tx.created_by_name}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setHistoryModal(false)}
              className="btn-secondary btn-base sm:w-28"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Barcode Print Modal */}
      <BarcodePrintModal
        open={Boolean(barcodeProduct)}
        onClose={() => setBarcodeProduct(null)}
        product={barcodeProduct}
      />
    </div>
  )
}
