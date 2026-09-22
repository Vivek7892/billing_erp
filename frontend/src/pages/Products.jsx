import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import api, { API_BASE_URL } from '../api'
import {
  Badge,
  Card,
  PageHeader,
  Modal,
  ConfirmDialog,
  Spinner,
  EmptyState,
} from '../components/UI'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Barcode,
  Package,
  RefreshCw,
  SlidersHorizontal,
  Minus,
  X,
  Printer,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'

const UNITS = [
  'pcs',
  'kg',
  'g',
  'L',
  'ml',
  'box',
  'pack',
  'dozen',
  'pair',
]

const GST_OPTIONS = [0, 5, 12, 18, 28]

const EMPTY_FORM = {
  name: '',
  sku: '',
  barcode: '',
  category: '',
  brand: '',
  unit: 'pcs',
  hsn_code: '',
  mrp: '',
  purchase_price: '',
  selling_price: '',
  gst_percent: '0',
  current_stock: '0',
  minimum_stock: '5',
  supplier: '',
  status: 'active',
}

const numberValue = value => Number(value || 0)

const currency = value =>
  `₹${numberValue(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

function autoBarcode(productId) {
  return String(productId).padStart(12, '0').slice(-12)
}

function getStockState(product) {
  const stock = numberValue(product.current_stock)
  const minimum = numberValue(product.minimum_stock)

  if (stock <= 0) {
    return {
      label: 'Out of stock',
      className: 'text-[var(--danger)]',
      badgeClass:
        'border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]',
      icon: AlertTriangle,
    }
  }

  if (stock <= minimum) {
    return {
      label: 'Low stock',
      className: 'text-[var(--warning)]',
      badgeClass:
        'border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]',
      icon: AlertTriangle,
    }
  }

  return {
    label: 'In stock',
    className: 'text-[var(--success)]',
    badgeClass:
      'border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]',
    icon: CheckCircle2,
  }
}

function Field({ label, required, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold text-[var(--ink-secondary)]">
        {label}
        {required && <span className="ml-1 text-[var(--danger)]">*</span>}
        {hint && (
          <span className="ml-1 font-normal text-[var(--muted-light)]">
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

function ProductStatus({ product }) {
  const stock = getStockState(product)

  return (
    <div className="flex flex-col items-start gap-1.5">
      <Badge status={product.status || product.stock_status} />
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${stock.badgeClass}`}
      >
        <stock.icon size={11} />
        {stock.label}
      </span>
    </div>
  )
}

function ProductActions({ product, onEdit, onBarcode, onDelete }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onEdit(product)}
        className="icon-btn"
        title="Edit product"
        aria-label={`Edit ${product.name}`}
      >
        <Edit2 size={14} />
      </button>

      <button
        type="button"
        onClick={() => onBarcode(product)}
        className="icon-btn"
        title="Print barcode labels"
        aria-label={`Print barcode labels for ${product.name}`}
      >
        <Barcode size={15} />
      </button>

      <button
        type="button"
        onClick={() => onDelete(product.id)}
        className="icon-btn danger"
        title="Delete product"
        aria-label={`Delete ${product.name}`}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function BarcodeQuantityControl({ value, onChange }) {
  const updateValue = nextValue => {
    const parsed = Number(nextValue)

    if (!Number.isFinite(parsed)) {
      onChange(1)
      return
    }

    onChange(Math.max(1, Math.min(500, Math.floor(parsed))))
  }

  return (
    <div className="flex w-full max-w-xs items-center overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => updateValue(value - 1)}
        disabled={value <= 1}
        className="flex h-12 w-12 shrink-0 items-center justify-center text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Decrease label quantity"
      >
        <Minus size={16} />
      </button>

      <input
        type="number"
        min="1"
        max="500"
        value={value}
        onChange={event => updateValue(event.target.value)}
        className="h-12 min-w-0 flex-1 border-x border-[var(--line)] bg-transparent px-2 text-center text-base font-bold text-[var(--ink)] outline-none"
        aria-label="Number of labels"
      />

      <button
        type="button"
        onClick={() => updateValue(value + 1)}
        disabled={value >= 500}
        className="flex h-12 w-12 shrink-0 items-center justify-center text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Increase label quantity"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [count, setCount] = useState(0)
  const [barcodeProduct, setBarcodeProduct] = useState(null)
  const [barcodeCopies, setBarcodeCopies] = useState(1)
  const [saving, setSaving] = useState(false)

  const debounceRef = useRef(null)

  const load = useCallback(async (query = search, category = catFilter) => {
    setLoading(true)

    try {
      const params = new URLSearchParams()

      if (query?.trim()) params.set('search', query.trim())
      if (category) params.set('category', category)

      const response = await api.get(`/products/?${params.toString()}`)
      const data = response.data?.results || response.data || []
      const rows = Array.isArray(data) ? data : []

      setProducts(rows)
      setCount(response.data?.count ?? rows.length)
    } catch (error) {
      console.error('Failed to load products:', error)
      setProducts([])
      setCount(0)
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [search, catFilter])

  useEffect(() => {
    clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(
      () => load(search, catFilter),
      search.trim() ? 350 : 0,
    )

    return () => clearTimeout(debounceRef.current)
  }, [search, catFilter, load])

  useEffect(() => {
    const loadSupportingData = async () => {
      try {
        const [categoryResponse, supplierResponse] = await Promise.all([
          api.get('/categories/?page_size=100'),
          api.get('/suppliers/?page_size=100'),
        ])

        setCategories(
          categoryResponse.data?.results || categoryResponse.data || [],
        )

        setSuppliers(
          supplierResponse.data?.results || supplierResponse.data || [],
        )
      } catch (error) {
        console.error('Failed to load categories or suppliers:', error)
      }
    }

    loadSupportingData()
  }, [])

  const visibleProducts = useMemo(() => {
    return products.filter(product => {
      const stock = numberValue(product.current_stock)
      const minimum = numberValue(product.minimum_stock)

      if (stockFilter === 'out' && stock > 0) return false
      if (stockFilter === 'low' && (stock <= 0 || stock > minimum)) {
        return false
      }
      if (stockFilter === 'available' && stock <= 0) return false

      return true
    })
  }, [products, stockFilter])

  const stats = useMemo(() => {
    return {
      total: products.length,
      active: products.filter(product => product.status === 'active').length,
      low: products.filter(product => {
        const stock = numberValue(product.current_stock)
        const minimum = numberValue(product.minimum_stock)
        return stock > 0 && stock <= minimum
      }).length,
      out: products.filter(product => numberValue(product.current_stock) <= 0)
        .length,
    }
  }, [products])

  const openAdd = () => {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
    setModal('add')
  }

  const openEdit = product => {
    setForm({
      name: product.name || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      category: product.category || '',
      brand: product.brand || '',
      unit: product.unit || 'pcs',
      hsn_code: product.hsn_code || '',
      mrp: product.mrp ?? '',
      purchase_price: product.purchase_price ?? '',
      selling_price: product.selling_price ?? '',
      gst_percent: product.gst_percent ?? '0',
      current_stock: product.current_stock ?? '0',
      minimum_stock: product.minimum_stock ?? '5',
      supplier: product.supplier || '',
      status: product.status || 'active',
    })

    setEditId(product.id)
    setModal('edit')
  }

  const openBarcode = product => {
    setBarcodeProduct(product)
    setBarcodeCopies(1)
    setModal('barcode')
  }

  const printBarcodeLabel = () => {
    if (!barcodeProduct?.id) {
      toast.error('Select a product first')
      return
    }

    const quantity = Math.max(1, Math.min(500, Number(barcodeCopies) || 1))
    const token = localStorage.getItem('access_token') || ''

    const params = new URLSearchParams({
      copies: String(quantity),
    })

    if (token) params.set('token', token)

    const url = `${API_BASE_URL}/products/${barcodeProduct.id}/barcode-label/?${params.toString()}`

    window.open(url, '_blank', 'noopener,noreferrer')
    setModal(null)
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Product name is required')
      return
    }

    if (!form.sku.trim()) {
      toast.error('SKU is required')
      return
    }

    if (form.selling_price === '' || Number(form.selling_price) < 0) {
      toast.error('Enter a valid selling price')
      return
    }

    setSaving(true)

    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        sku: form.sku.trim(),
        barcode: form.barcode.trim(),
      }

      if (!payload.category) delete payload.category
      if (!payload.supplier) delete payload.supplier

      if (editId) {
        await api.patch(`/products/${editId}/`, payload)
        toast.success('Product updated successfully')
      } else {
        const response = await api.post('/products/', payload)
        const saved = response.data

        if (!saved.barcode && saved.id) {
          await api.patch(`/products/${saved.id}/`, {
            barcode: autoBarcode(saved.id),
          })
        }

        toast.success('Product added successfully')
      }

      setModal(null)
      await load(search, catFilter)
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        error.response?.data?.name?.[0] ||
        error.response?.data?.sku?.[0] ||
        'Failed to save product'

      toast.error(detail)
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    if (!deleteId) return

    try {
      await api.delete(`/products/${deleteId}/`)
      toast.success('Product deleted successfully')
      setDeleteId(null)
      await load(search, catFilter)
    } catch (error) {
      toast.error('Failed to delete product')
    }
  }

  const updateForm = (key, value) => {
    setForm(previous => ({
      ...previous,
      [key]: value,
    }))
  }

  return (
    <div className="products-page min-w-0 space-y-5">
      <style>{`
        .products-page {
          --danger-bg: #fff1f2;
          --danger-border: #fecdd3;
          --warning-bg: #fffbeb;
          --warning-border: #fde68a;
          --success-bg: #ecfdf5;
          --success-border: #a7f3d0;
        }

        .dark .products-page,
        [data-theme="dark"] .products-page {
          --danger-bg: #4c0519;
          --danger-border: #9f1239;
          --warning-bg: #451a03;
          --warning-border: #92400e;
          --success-bg: #052e24;
          --success-border: #065f46;
        }

        .products-page input[type="search"]::-webkit-search-cancel-button,
        .products-page input[type="search"]::-webkit-search-decoration {
          -webkit-appearance: none;
          appearance: none;
        }

        .products-page input,
        .products-page select {
          color: var(--ink);
          background-color: var(--surface);
        }

        .products-page input::placeholder {
          color: var(--muted-light);
          opacity: 1;
        }

        .products-page select {
          text-overflow: ellipsis;
        }

        @media (min-width: 1024px) {
          .products-page .product-search-grid {
            grid-template-columns: minmax(0, 1fr) minmax(220px, 280px) auto;
          }
        }

        .products-page .product-table {
          width: 100%;
          border-collapse: collapse;
        }

        .products-page .product-table th {
          padding: 13px 16px;
          text-align: left;
          white-space: nowrap;
          background: var(--surface-elevated);
          border-bottom: 1px solid var(--line);
          color: var(--muted-light);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
        }

        .products-page .product-table td {
          padding: 15px 16px;
          border-bottom: 1px solid var(--line-subtle);
          vertical-align: middle;
        }

        .products-page .product-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .products-page .product-table tbody tr:hover {
          background: var(--surface-elevated);
        }
      `}</style>

      <PageHeader
        title="Products"
        subtitle={`${count} product${count !== 1 ? 's' : ''} in inventory`}
        action={
          <button
            type="button"
            onClick={openAdd}
            className="btn-primary btn-base flex w-full items-center justify-center gap-2 sm:w-auto"
          >
            <Plus size={16} />
            Add Product
          </button>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Total products',
            value: stats.total,
            description: 'Loaded products',
            icon: Package,
          },
          {
            label: 'Active products',
            value: stats.active,
            description: 'Available in catalog',
            icon: CheckCircle2,
          },
          {
            label: 'Low stock',
            value: stats.low,
            description: 'Needs replenishment',
            icon: AlertTriangle,
          },
          {
            label: 'Out of stock',
            value: stats.out,
            description: 'Unavailable inventory',
            icon: AlertTriangle,
          },
        ].map(item => {
          const Icon = item.icon

          return (
            <div
              key={item.label}
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--muted-light)]">
                    {item.label}
                  </p>

                  <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--ink)]">
                    {item.value}
                  </p>
                </div>

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-elevated)] text-[var(--muted)]">
                  <Icon size={17} />
                </div>
              </div>

              <p className="mt-3 text-[11px] text-[var(--muted-light)]">
                {item.description}
              </p>
            </div>
          )
        })}
      </section>

      <Card className="p-4">
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,280px)_auto] lg:items-center">
          <div className="relative min-w-0 w-full">
            <Search
              size={17}
              strokeWidth={1.5}
              className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-[var(--muted)]"
            />

            <input
              type="search"
              className="input h-12 w-full min-w-0 truncate pl-11 pr-11 text-sm font-medium text-[var(--ink)] placeholder:text-[var(--muted-light)] focus:outline-none"
              placeholder="          Search product name, SKU, barcode or brand..."
              value={search}
              onChange={event => setSearch(event.target.value)}
              aria-label="Search products"
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
                aria-label="Clear search"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="relative min-w-0 w-full">
            <select
              className="input h-12 w-full min-w-0 truncate pr-9 text-sm font-medium text-[var(--ink)]"
              value={catFilter}
              onChange={event => setCatFilter(event.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => load(search, catFilter)}
            disabled={loading}
            className="btn-secondary btn-base flex h-12 w-full items-center justify-center gap-2 whitespace-nowrap lg:w-auto lg:px-5"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 overflow-x-auto">
          <SlidersHorizontal
            size={14}
            className="shrink-0 text-[var(--muted-light)]"
          />

          {[
            ['all', 'All products'],
            ['available', 'Available'],
            ['low', 'Low stock'],
            ['out', 'Out of stock'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStockFilter(key)}
              className={`whitespace-nowrap rounded-lg border px-3 py-2 text-[11px] font-semibold transition ${
                stockFilter === key
                  ? 'border-[var(--primary-border)] bg-[var(--surface-elevated)] text-[var(--ink)]'
                  : 'border-transparent text-[var(--muted)] hover:bg-[var(--surface-elevated)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-bold text-[var(--ink)]">
              Product inventory
            </h2>
            <p className="mt-1 text-xs text-[var(--muted-light)]">
              {visibleProducts.length} product
              {visibleProducts.length !== 1 ? 's' : ''} displayed
            </p>
          </div>

          <span className="hidden rounded-full bg-[var(--surface-elevated)] px-3 py-1.5 text-[10px] font-semibold text-[var(--muted)] sm:inline-flex">
            Inventory catalog
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="px-4 py-14">
            <EmptyState message="No products found" />
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--line-subtle)] sm:hidden">
              {visibleProducts.map(product => (
                <article key={product.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-[var(--ink)]">
                        {product.name}
                      </h3>

                      {product.brand && (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {product.brand}
                        </p>
                      )}

                      <p className="mt-1 font-mono text-[10px] text-[var(--muted-light)]">
                        SKU: {product.sku || '—'}
                      </p>

                      <p className="mt-1 font-mono text-[10px] text-[var(--muted-light)]">
                        Barcode: {product.barcode || 'Not assigned'}
                      </p>
                    </div>

                    <ProductActions
                      product={product}
                      onEdit={openEdit}
                      onBarcode={openBarcode}
                      onDelete={setDeleteId}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-[var(--surface-elevated)] p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)]">
                        Selling price
                      </p>
                      <p className="mt-1 text-sm font-bold text-[var(--ink)]">
                        {currency(product.selling_price)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[var(--surface-elevated)] p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)]">
                        Stock
                      </p>
                      <p
                        className={`mt-1 text-sm font-bold ${getStockState(product).className}`}
                      >
                        {product.current_stock ?? 0}{' '}
                        <span className="text-xs font-normal text-[var(--muted)]">
                          {product.unit || 'pcs'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-[var(--muted)]">
                      {product.category_name || 'Uncategorized'}
                    </span>

                    <ProductStatus product={product} />
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU / Barcode</th>
                    <th>Category</th>
                    <th>Purchase</th>
                    <th>Selling</th>
                    <th>GST</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleProducts.map(product => (
                    <tr key={product.id}>
                      <td>
                        <div className="min-w-40">
                          <p className="text-sm font-bold text-[var(--ink)]">
                            {product.name}
                          </p>

                          {product.brand && (
                            <p className="mt-1 text-xs text-[var(--muted)]">
                              {product.brand}
                            </p>
                          )}
                        </div>
                      </td>

                      <td>
                        <p className="font-mono text-xs text-[var(--ink-secondary)]">
                          {product.sku || '—'}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-[var(--muted-light)]">
                          {product.barcode || 'No barcode'}
                        </p>
                      </td>

                      <td className="text-xs text-[var(--muted)]">
                        {product.category_name || '—'}
                      </td>

                      <td className="text-sm text-[var(--muted)]">
                        {currency(product.purchase_price)}
                      </td>

                      <td className="text-sm font-bold text-[var(--ink)]">
                        {currency(product.selling_price)}
                      </td>

                      <td>
                        <span className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-2 py-1 text-xs font-semibold text-[var(--muted)]">
                          {product.gst_percent ?? 0}%
                        </span>
                      </td>

                      <td>
                        <span
                          className={`text-sm font-bold ${getStockState(product).className}`}
                        >
                          {product.current_stock ?? 0}
                          <span className="ml-1 text-xs font-normal text-[var(--muted)]">
                            {product.unit || 'pcs'}
                          </span>
                        </span>
                      </td>

                      <td>
                        <ProductStatus product={product} />
                      </td>

                      <td>
                        <ProductActions
                          product={product}
                          onEdit={openEdit}
                          onBarcode={openBarcode}
                          onDelete={setDeleteId}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && count > 0 && (
          <div className="border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]">
            Showing {visibleProducts.length} of {count} product
            {count !== 1 ? 's' : ''}
          </div>
        )}
      </Card>

      <Modal
        open={modal === 'add' || modal === 'edit'}
        onClose={() => !saving && setModal(null)}
        title={editId ? 'Edit product' : 'Add new product'}
        size="lg"
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3">
            <p className="text-xs font-semibold text-[var(--ink)]">
              Product information
            </p>
            <p className="mt-1 text-xs text-[var(--muted-light)]">
              Enter accurate product details for billing, inventory, and
              barcode printing.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Product name" required className="sm:col-span-2">
              <input
                className="input"
                value={form.name}
                onChange={event => updateForm('name', event.target.value)}
                placeholder="Enter product name"
              />
            </Field>

            <Field label="SKU" required>
              <input
                className="input"
                value={form.sku}
                onChange={event => updateForm('sku', event.target.value)}
                placeholder="e.g. PROD-001"
              />
            </Field>

            <Field
              label="Barcode"
              hint="Optional"
            >
              <input
                className="input"
                value={form.barcode}
                onChange={event => updateForm('barcode', event.target.value)}
                placeholder="Auto-assign if blank"
              />
            </Field>

            <Field label="Category">
              <select
                className="input"
                value={form.category}
                onChange={event => updateForm('category', event.target.value)}
              >
                <option value="">Select category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Brand">
              <input
                className="input"
                value={form.brand}
                onChange={event => updateForm('brand', event.target.value)}
                placeholder="Brand name"
              />
            </Field>

            <Field label="HSN code">
              <input
                className="input"
                value={form.hsn_code}
                onChange={event => updateForm('hsn_code', event.target.value)}
                placeholder="GST classification"
              />
            </Field>

            <Field label="Unit">
              <select
                className="input"
                value={form.unit}
                onChange={event => updateForm('unit', event.target.value)}
              >
                {UNITS.map(unit => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="border-t border-[var(--line)] pt-5">
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--muted-light)]">
              Pricing and tax
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="MRP">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={form.mrp}
                  onChange={event => updateForm('mrp', event.target.value)}
                  placeholder="0.00"
                />
              </Field>

              <Field label="Purchase price" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={form.purchase_price}
                  onChange={event =>
                    updateForm('purchase_price', event.target.value)
                  }
                  placeholder="0.00"
                />
              </Field>

              <Field label="Selling price" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={form.selling_price}
                  onChange={event =>
                    updateForm('selling_price', event.target.value)
                  }
                  placeholder="0.00"
                />
              </Field>

              <Field label="GST percentage">
                <select
                  className="input"
                  value={form.gst_percent}
                  onChange={event =>
                    updateForm('gst_percent', event.target.value)
                  }
                >
                  {GST_OPTIONS.map(gst => (
                    <option key={gst} value={gst}>
                      {gst}%
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="border-t border-[var(--line)] pt-5">
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--muted-light)]">
              Inventory settings
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Current stock">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={form.current_stock}
                  onChange={event =>
                    updateForm('current_stock', event.target.value)
                  }
                />
              </Field>

              <Field label="Minimum stock">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input"
                  value={form.minimum_stock}
                  onChange={event =>
                    updateForm('minimum_stock', event.target.value)
                  }
                />
              </Field>

              <Field label="Supplier">
                <select
                  className="input"
                  value={form.supplier}
                  onChange={event => updateForm('supplier', event.target.value)}
                >
                  <option value="">Select supplier</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Status">
                <select
                  className="input"
                  value={form.status}
                  onChange={event => updateForm('status', event.target.value)}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-5 sm:flex-row">
            <button
              type="button"
              onClick={() => setModal(null)}
              disabled={saving}
              className="btn-secondary btn-base flex-1"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-primary btn-base flex-1"
            >
              {saving ? 'Saving...' : editId ? 'Update product' : 'Save product'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={modal === 'barcode'}
        onClose={() => setModal(null)}
        title="Print barcode labels"
        size="md"
      >
        {barcodeProduct && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--surface)] text-[var(--muted)]">
                  <Barcode size={25} />
                </div>

                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-[var(--ink)]">
                    {barcodeProduct.name}
                  </h3>

                  <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                    {barcodeProduct.barcode ||
                      barcodeProduct.sku ||
                      'Barcode not assigned'}
                  </p>

                  <p className="mt-2 text-xs text-[var(--muted)]">
                    SKU: {barcodeProduct.sku || '—'}
                  </p>

                  <p className="mt-1 text-sm font-bold text-[var(--ink)]">
                    {currency(barcodeProduct.selling_price)}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-sm font-bold text-[var(--ink)]">
                  Number of labels
                </label>

                <span className="rounded-full bg-[var(--surface-elevated)] px-2.5 py-1 text-[10px] font-semibold text-[var(--muted)]">
                  1–500 labels
                </span>
              </div>

              <BarcodeQuantityControl
                value={barcodeCopies}
                onChange={setBarcodeCopies}
              />

              <p className="mt-2 text-xs leading-5 text-[var(--muted-light)]">
                Choose how many copies to print. The selected quantity is sent
                to the backend print endpoint.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--line)] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">
                  Total labels
                </span>
                <span className="text-sm font-bold text-[var(--ink)]">
                  {barcodeCopies}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-xs text-[var(--muted)]">
                  Estimated sheets
                </span>
                <span className="text-sm font-semibold text-[var(--ink)]">
                  {Math.ceil(barcodeCopies / 10)}
                </span>
              </div>

              <p className="mt-2 text-[10px] text-[var(--muted-light)]">
                Estimate based on 10 labels per A4 sheet. Actual layout depends
                on your backend print template.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="btn-secondary btn-base flex-1"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={printBarcodeLabel}
                className="btn-primary btn-base flex flex-1 items-center justify-center gap-2"
              >
                <Printer size={15} />
                Print {barcodeCopies} label
                {barcodeCopies !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={del}
        title="Delete product"
        message="This action will permanently delete the selected product."
        danger
      />
    </div>
  )
}
  