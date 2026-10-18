import { useEffect, useMemo, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import api, { API_BASE_URL } from '../api'
import productService from '../features/inventory/api/productService'
import { Badge, PageHeader, Modal, Spinner, EmptyState, Pagination, TableSkeleton, SearchBar } from '../components/UI'
import { STOCK_STATUS } from '../constants'
import toast from 'react-hot-toast'
import BarcodePrintModal from '../components/BarcodePrintModal'
import {
  Boxes,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
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
    text: 'text-emerald-700 dark:text-emerald-300 font-semibold',
    soft: 'bg-emerald-100 dark:bg-emerald-950/60',
    border: 'border-emerald-300 dark:border-emerald-700',
    bar: 'bg-emerald-500',
  },
  low_stock: {
    label: 'Low Stock',
    icon: AlertTriangle,
    text: 'text-amber-700 dark:text-amber-300 font-bold',
    soft: 'bg-amber-100 dark:bg-amber-950/60',
    border: 'border-amber-300 dark:border-amber-700',
    bar: 'bg-amber-500',
  },
  out_of_stock: {
    label: 'Out of Stock',
    icon: XCircle,
    text: 'text-rose-700 dark:text-rose-300 font-bold',
    soft: 'bg-rose-100 dark:bg-rose-950/60',
    border: 'border-rose-300 dark:border-rose-700',
    bar: 'bg-rose-500',
  },
}

const fmtCurrency = val =>
  `₹${Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

export default function Stock() {
  const location = useLocation()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filter, setFilter] = useState('all') // 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('search') || '')
  const [selectedCat, setSelectedCat] = useState('')
  const [selectedSup, setSelectedSup] = useState('')
  const [sortBy, setSortBy] = useState('stock')
  const [sortDir, setSortDir] = useState('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const target = params.get('search') || ''
    setQ(target)
    if (target) setCurrentPage(1)
  }, [location.search])

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
            p.id,
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

  useEffect(() => setCurrentPage(1), [filter, selectedCat, selectedSup, q])
  const pagedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize)

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

        .stock-page .btn-secondary {
          border-color: #99f6e4;
          background: #f0fdfa;
          color: #0f766e;
        }

        .dark .stock-page .btn-secondary {
          border-color: #115e59;
          background: rgba(15, 118, 110, .24);
          color: #99f6e4;
        }

        .stock-page .erp-table th {
          padding: 10px 12px;
          text-align: left;
          white-space: nowrap;
          background: var(--surface-subtle);
          border-bottom: 1px solid var(--line);
          color: var(--muted);
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: .04em;
          text-transform: uppercase;
        }

        .stock-page .erp-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--line-subtle);
          vertical-align: middle;
        }

        .stock-page .erp-table tbody tr:hover {
          background: var(--surface-hover);
        }
      `}</style>

      {/* =====================================================
          PAGE HEADER (Compact POS / ERP Standard)
      ====================================================== */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-[var(--line)]">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--ink)]">
            Stock &amp; Inventory Control
          </h1>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Track real-time inventory balances, stock valuation, and reorder thresholds
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={exportStockCSV}
            disabled={loading || products.length === 0}
            className="btn-secondary h-8 sm:h-8.5 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
            title="Download Stock CSV"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="btn-secondary h-8 sm:h-8.5 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="Refresh inventory"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-[#1E3A5F]' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* =====================================================
          INVENTORY KPI STRIP (Ultra-compact ~70-85px)
      ====================================================== */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-5 sm:divide-y-0 sm:divide-x">
          {/* Total Products */}
          <div
            onClick={() => setFilter('all')}
            className={`px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-0 cursor-pointer transition-colors ${
              filter === 'all'
                ? 'bg-[var(--surface-elevated)] font-semibold'
                : 'hover:bg-[var(--surface-hover)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Total Items
              </span>
              <Boxes size={13} className="text-[#1E3A5F] dark:text-slate-300 shrink-0" />
            </div>
            <div className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[var(--ink)] tabular-nums truncate">
              {metrics.totalItems}
            </div>
            <div className="text-[11px] text-[var(--muted)] truncate">
              {metrics.totalStockUnits.toLocaleString('en-IN')} units on hand
            </div>
          </div>

          {/* In Stock */}
          <div
            onClick={() => setFilter('in_stock')}
            className={`px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-0 cursor-pointer transition-colors ${
              filter === 'in_stock'
                ? 'bg-[var(--surface-elevated)] font-semibold'
                : 'hover:bg-[var(--surface-hover)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                In Stock
              </span>
              <CheckCircle size={13} className="text-teal-600 dark:text-teal-400 shrink-0" />
            </div>
            <div className="mt-0.5 font-mono text-base sm:text-lg font-bold text-teal-600 dark:text-teal-400 tabular-nums truncate">
              {metrics.inStock}
            </div>
            <div className="text-[11px] text-[var(--muted)] truncate">
              Healthy inventory
            </div>
          </div>

          {/* Low Stock Alert */}
          <div
            onClick={() => setFilter('low_stock')}
            className={`px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-0 cursor-pointer transition-colors ${
              filter === 'low_stock'
                ? 'bg-[var(--surface-elevated)] font-semibold'
                : 'hover:bg-[var(--surface-hover)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Low Stock
              </span>
              <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 shrink-0" />
            </div>
            <div className="mt-0.5 font-mono text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums truncate">
              {metrics.lowStock}
            </div>
            <div className="text-[11px] text-[var(--muted)] truncate">
              Reorder threshold
            </div>
          </div>

          {/* Out of Stock */}
          <div
            onClick={() => setFilter('out_of_stock')}
            className={`px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-0 cursor-pointer transition-colors ${
              filter === 'out_of_stock'
                ? 'bg-[var(--surface-elevated)] font-semibold'
                : 'hover:bg-[var(--surface-hover)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                Out of Stock
              </span>
              <XCircle size={13} className="text-rose-600 dark:text-rose-400 shrink-0" />
            </div>
            <div className="mt-0.5 font-mono text-base sm:text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums truncate">
              {metrics.outStock}
            </div>
            <div className="text-[11px] text-[var(--muted)] truncate">
              Zero balance
            </div>
          </div>

          {/* Stock Valuation */}
          <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 min-w-0 col-span-2 sm:col-span-1 border-t sm:border-t-0 border-[var(--line)]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Stock Valuation
              </span>
              <Tag size={13} className="text-[#1E3A5F] dark:text-slate-300 shrink-0" />
            </div>
            <div className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[#1E3A5F] dark:text-slate-200 tabular-nums truncate">
              {fmtCurrency(metrics.totalStockValue)}
            </div>
            <div className="text-[11px] text-[var(--muted)] truncate">
              Cost basis
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          COMPACT FILTER TOOLBAR (32-34px controls)
      ====================================================== */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 sm:p-2.5 shadow-2xs space-y-2">
        {/* Row 1: Status pills + Dropdowns */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Quick status pills with live counts */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {[
              { key: 'all', label: 'All', count: metrics.totalItems },
              { key: 'in_stock', label: 'In Stock', count: metrics.inStock },
              { key: 'low_stock', label: 'Low Stock', count: metrics.lowStock },
              { key: 'out_of_stock', label: 'Out of Stock', count: metrics.outStock },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-semibold border transition ${
                  filter === tab.key
                    ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-2xs'
                    : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] font-mono px-1 rounded-full ${
                  filter === tab.key
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--surface-subtle)] text-[var(--muted)]'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Category & Supplier selectors */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
            <select
              className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-medium text-[var(--ink)] outline-none focus:border-[#1E3A5F] w-full sm:w-auto"
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

            <select
              className="h-8 rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-medium text-[var(--ink)] outline-none focus:border-[#1E3A5F] w-full sm:w-auto"
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
        </div>

        {/* Row 2: Search input + Clear button */}
        <div className="flex items-center gap-2">
          <div className="group relative flex min-w-0 flex-1 items-center h-[34px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 transition hover:border-slate-300 dark:hover:border-slate-600 focus-within:border-[#1E3A5F] focus-within:ring-1 focus-within:ring-[#1E3A5F]/20">
            <PackageSearch size={14} className="shrink-0 text-[var(--muted)] group-focus-within:text-[#1E3A5F] dark:group-focus-within:text-sky-300 mr-2" />
            <input
              className="w-full bg-transparent text-xs font-medium text-[var(--ink)] placeholder:text-[var(--placeholder)] outline-none"
              placeholder="Search product name, SKU, barcode, supplier... (Ctrl+K)"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
            {q ? (
              <button
                type="button"
                onClick={() => setQ('')}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
                aria-label="Clear search"
                title="Clear search"
              >
                <X size={13} />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex shrink-0 items-center rounded border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                Ctrl+K
              </kbd>
            )}
          </div>

          {isFilterActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-[34px] items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 shrink-0"
              title="Reset all filters"
            >
              <X size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* =====================================================
          STOCK DATA TABLE & MOBILE CARDS
      ====================================================== */}
      <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        {loading ? (
          <TableSkeleton rows={10} cols={8} label="Loading inventory stock" />
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
            {/* Mobile Cards View (md:hidden) — Ergonomic Button Placements */}
            <div className="divide-y divide-[var(--line-subtle)] md:hidden">
              {pagedProducts.map(p => {
                const st = getStatus(p)
                const meta = STATUS_META[st]
                const Icon = meta.icon

                return (
                  <article key={p.id} className="p-3.5 space-y-2.5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-[var(--ink)] truncate">
                          {p.name}
                        </h3>
                        <p className="mt-0.5 text-[11px] text-[var(--muted)] font-mono truncate">
                          SKU: {p.sku || '—'} {p.category_name ? `• ${p.category_name}` : ''}
                        </p>
                      </div>

                      <span
                        className={`inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${meta.soft} ${meta.border} ${meta.text}`}
                      >
                        <Icon size={11} />
                        {meta.label}
                      </span>
                    </div>

                    {/* Compact Metrics Chip */}
                    <div className="grid grid-cols-3 gap-2 rounded-md bg-[var(--surface-elevated)] p-2 text-xs">
                      <div>
                        <span className="text-[9px] uppercase font-bold text-[var(--muted)]">
                          Stock
                        </span>
                        <p className={`mt-0.5 font-mono font-bold text-xs ${meta.text}`}>
                          {p.current_stock ?? 0}{' '}
                          <span className="text-[10px] font-normal text-[var(--muted)]">
                            {p.unit || 'pcs'}
                          </span>
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-[var(--muted)]">
                          Min Stock
                        </span>
                        <p className="mt-0.5 font-mono text-xs text-[var(--muted)]">
                          {p.minimum_stock ?? 5}
                        </p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-[var(--muted)]">
                          Valuation
                        </span>
                        <p className="mt-0.5 font-mono font-bold text-xs text-[var(--ink)]">
                          {fmtCurrency(
                            Number(p.current_stock || 0) *
                              Number(p.purchase_price || 0),
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Action Bar — Mobile-Friendly Button Placements */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--line-subtle)]">
                      <button
                        type="button"
                        onClick={() => setBarcodeProduct(p)}
                        className="min-h-[38px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95"
                        title="Print Barcode Labels"
                      >
                        <Barcode size={14} />
                        <span>Barcode</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openHistory(p)}
                        className="min-h-[38px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95"
                        title="Movement History"
                      >
                        <History size={14} />
                        <span>History</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openAdjust(p)}
                        className="col-span-2 sm:col-span-1 min-h-[38px] rounded-lg bg-[#1E3A5F] text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-[#162F4D] flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95"
                        title="Adjust"
                      >
                        <SlidersHorizontal size={14} />
                        <span>Adjust</span>
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>

            {/* Desktop Semantic Table View */}
            <div className="hidden md:block overflow-x-auto min-h-[220px]">
              <table className="erp-table w-full text-xs min-w-[950px] border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '15%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '10%' }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-[var(--surface-subtle)] border-b border-[var(--line)] text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  <tr>
                    <th
                      className="px-3 py-2.5 text-left cursor-pointer hover:text-[var(--ink)]"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Product</span>
                        <ArrowUpDown size={11} />
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-left">Category &amp; Supplier</th>
                    <th
                      className="px-3 py-2.5 text-right cursor-pointer hover:text-[var(--ink)]"
                      onClick={() => handleSort('stock')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Current Stock</span>
                        <ArrowUpDown size={11} />
                      </div>
                    </th>
                    <th className="px-3 py-2.5 text-right">Min Stock</th>
                    <th
                      className="px-3 py-2.5 text-right cursor-pointer hover:text-[var(--ink)]"
                      onClick={() => handleSort('cost')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Unit Cost</span>
                        <ArrowUpDown size={11} />
                      </div>
                    </th>
                    <th
                      className="px-3 py-2.5 text-right cursor-pointer hover:text-[var(--ink)]"
                      onClick={() => handleSort('value')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Total Value</span>
                        <ArrowUpDown size={11} />
                      </div>
                    </th>
                    <th className="px-2 py-2.5 text-center">Status</th>
                    <th className="px-3 py-2.5 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {pagedProducts.map(p => {
                    const st = getStatus(p)
                    const meta = STATUS_META[st]
                    const Icon = meta.icon

                    return (
                      <tr
                        key={p.id}
                        className="h-[56px] group hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        {/* Name & SKU */}
                        <td className="px-3 py-2 text-left align-middle">
                          <span className="font-semibold text-xs text-[var(--ink)] block truncate" title={p.name}>
                            {p.name}
                          </span>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-mono text-[var(--muted)] truncate">
                            <span>SKU: {p.sku || '—'}</span>
                            {p.barcode && <span>• {p.barcode}</span>}
                          </div>
                        </td>

                        {/* Category & Supplier */}
                        <td className="px-3 py-2 text-left align-middle">
                          <div className="truncate text-xs font-medium text-[var(--ink-secondary)]">
                            {p.category_name || 'Uncategorized'}
                          </div>
                          {p.supplier_name && (
                            <p className="text-[10px] text-[var(--muted)] truncate mt-0.5">
                              {p.supplier_name}
                            </p>
                          )}
                        </td>

                        {/* Current Stock */}
                        <td className="px-3 py-2 text-right align-middle font-mono font-bold text-xs">
                          <span className={meta.text}>
                            {p.current_stock ?? 0}{' '}
                            <span className="text-[10px] font-normal text-[var(--muted)]">
                              {p.unit || 'pcs'}
                            </span>
                          </span>
                        </td>

                        {/* Minimum Stock */}
                        <td className="px-3 py-2 text-right align-middle font-mono text-xs text-[var(--muted)]">
                          {p.minimum_stock ?? 5} {p.unit || 'pcs'}
                        </td>

                        {/* Unit Cost */}
                        <td className="px-3 py-2 text-right align-middle font-mono text-xs text-[var(--muted)]">
                          {fmtCurrency(p.purchase_price)}
                        </td>

                        {/* Total Stock Value */}
                        <td className="px-3 py-2 text-right align-middle font-mono font-bold text-xs text-[var(--ink)]">
                          {fmtCurrency(
                            Number(p.current_stock || 0) *
                              Number(p.purchase_price || 0),
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="px-2 py-2 text-center align-middle">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${meta.soft} ${meta.border} ${meta.text}`}
                          >
                            <Icon size={11} />
                            {meta.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2 text-center align-middle">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => setBarcodeProduct(p)}
                              className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                              title="Print Barcode Labels"
                              aria-label="Barcode"
                            >
                              <Barcode size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => openHistory(p)}
                              className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                              title="View Movement History"
                              aria-label="History"
                            >
                              <History size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => openAdjust(p)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded  text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition-colors whitespace-nowrap"
                              title="Adjust Stock"
                            >
                              <SlidersHorizontal size={14} strokeWidth={2} />
                              
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

        {/* Integrated Subtle Table Footer Pagination */}
        {!loading && filteredProducts.length > 0 && (
          <div className="flex flex-col gap-2.5 border-t border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 sm:h-12 sm:flex-row sm:items-center sm:justify-between sm:px-4 text-xs text-[var(--muted)]">
            <div>
              <span>
                Showing{' '}
                <strong className="font-semibold text-[var(--ink)]">
                  {(currentPage - 1) * pageSize + 1}
                </strong>
                –
                <strong className="font-semibold text-[var(--ink)]">
                  {Math.min(currentPage * pageSize, filteredProducts.length)}
                </strong>{' '}
                of{' '}
                <strong className="font-semibold text-[var(--ink)]">
                  {filteredProducts.length}
                </strong>{' '}
                catalog items
              </span>
              <span className="hidden sm:inline font-mono text-[11px] ml-2 text-[var(--muted-light)]">
                • Total on hand:{' '}
                {filteredProducts
                  .reduce((sum, p) => sum + Math.max(0, Number(p.current_stock || 0)), 0)
                  .toLocaleString('en-IN')}{' '}
                units
              </span>
            </div>

            <div className="flex items-center gap-1 self-end sm:self-auto">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="inline-flex h-7 items-center justify-center rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Previous Page"
              >
                ‹ Prev
              </button>

              <span className="flex h-7 items-center justify-center rounded bg-[#1E3A5F] px-2.5 font-mono text-xs font-bold text-white">
                {currentPage} / {Math.max(1, Math.ceil(filteredProducts.length / pageSize))}
              </span>

              <button
                type="button"
                disabled={currentPage >= Math.ceil(filteredProducts.length / pageSize)}
                onClick={() => setCurrentPage(p => p + 1)}
                className="inline-flex h-7 items-center justify-center rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next Page"
              >
                Next ›
              </button>
            </div>
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
                    className={`rounded-md border py-2 text-xs font-semibold transition ${
                      adjustMode === m.key
                        ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
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
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={adjustMode === 'set' ? '0' : '0.01'}
                  step="0.01"
                  className="input font-mono text-base font-bold flex-1"
                  value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)}
                  placeholder="1"
                />
                <span className="text-xs font-semibold text-[var(--muted)] px-2">
                  {adjustProduct.unit || 'pcs'}
                </span>
              </div>
              {/* Quick Stepper Buttons for Mobile POS */}
              <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-[var(--muted)] mr-1">Quick:</span>
                {[1, 5, 10, 25, 50].map(step => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => {
                      const cur = Number(adjustQty) || 0
                      setAdjustQty(String(cur + step))
                    }}
                    className="h-7 px-2.5 rounded border border-[var(--line)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-xs font-mono font-medium text-[var(--ink-secondary)] transition active:scale-95"
                  >
                    +{step}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAdjustQty('1')}
                  className="h-7 px-2 rounded border border-[var(--line)] bg-[var(--surface)] text-[10px] font-medium text-[var(--muted)] hover:text-rose-500 transition ml-auto"
                >
                  Reset (1)
                </button>
              </div>
            </div>

            {/* Projected Result */}
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">Resulting Stock:</span>
                <span className="font-mono text-sm font-bold text-[#1E3A5F] dark:text-slate-200">
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
                className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] transition sm:w-28"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAdjust}
                disabled={adjusting}
                className="h-10 w-full rounded-lg bg-[#1E3A5F] px-4 text-xs font-semibold text-white hover:bg-[#162F4D] transition flex items-center justify-center gap-2 sm:w-36 active:scale-95 shadow-2xs"
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
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            tx.transaction_type === 'sale'
                              ? 'text-[#1E3A5F] dark:text-slate-300'
                              : tx.transaction_type === 'purchase'
                                ? 'text-teal-700 dark:text-teal-400'
                                : 'text-amber-700 dark:text-amber-400'
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
