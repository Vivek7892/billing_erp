import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import api, { API_BASE_URL } from '../api'
import productService from '../features/inventory/api/productService'
import { STOCK_STATUS } from '../constants'
import {
  Badge,
  PageHeader,
  Modal,
  ConfirmDialog,
  Spinner,
  TableSkeleton,
  EmptyState,
  Pagination,
} from '../components/UI'
import toast from 'react-hot-toast'
import BarcodePrintModal from '../components/BarcodePrintModal'
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
  XCircle,
  Eye,
  History,
  Download,
  Upload,
  ArrowUpDown,
  Boxes,
  Tag,
  Percent,
  Power,
  Copy,
  Check,
  FileSpreadsheet,
  MoreVertical,
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
  'meter',
  'set',
  'roll',
  'bag',
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
  reorder_level: '10',
  supplier: '',
  status: 'active',
  image: '',
}

const numVal = value => Number(value || 0)

const formatCurrency = value =>
  `₹${numVal(value).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

function generateRandomSKU(name = '') {
  const prefix = name
    ? name
        .trim()
        .slice(0, 3)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, 'PRD')
    : 'PRD'
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `${prefix.padEnd(3, 'X')}-${rand}`
}

function generateRandomBarcode() {
  const digits = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 10),
  ).join('')
  return digits
}

function getStockAlertState(product) {
  const stock = numVal(product.current_stock)
  const minimum = numVal(product.minimum_stock || 5)

  if (stock <= 0) {
    return {
      type: 'out_of_stock',
      label: 'Out of Stock',
      badgeClass: 'bg-rose-950/40 text-rose-300 border border-rose-800/40',
      dotClass: 'bg-rose-500',
      textClass: 'text-rose-400 font-bold',
      icon: XCircle,
    }
  }

  if (stock <= minimum) {
    return {
      type: 'low_stock',
      label: 'Low Stock',
      badgeClass: 'bg-amber-950/40 text-amber-300 border border-amber-800/40',
      dotClass: 'bg-amber-500',
      textClass: 'text-amber-400 font-bold',
      icon: AlertTriangle,
    }
  }

  return {
    type: 'in_stock',
    label: 'In Stock',
    badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700',
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-300 font-bold',
    icon: CheckCircle2,
  }
}

function FormField({ label, required, hint, children, className = '' }) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-xs font-semibold text-[var(--ink-secondary)]">
          {label}
          {required && <span className="ml-1 text-[var(--danger)]">*</span>}
        </label>
        {hint && (
          <span className="text-[11px] font-normal text-[var(--muted-light)]">
            {hint}
          </span>
        )}
      </div>
      {children}
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
        className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Decrease quantity"
      >
        <Minus size={16} />
      </button>

      <input
        type="number"
        min="1"
        max="500"
        value={value}
        onChange={event => updateValue(event.target.value)}
        className="h-11 min-w-0 flex-1 border-x border-[var(--line)] bg-transparent px-2 text-center text-sm font-bold text-[var(--ink)] outline-none"
        aria-label="Quantity"
      />

      <button
        type="button"
        onClick={() => updateValue(value + 1)}
        disabled={value >= 500}
        className="flex h-11 w-11 shrink-0 items-center justify-center text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Increase quantity"
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

  // Filters
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [gstFilter, setGstFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Sorting
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  // Modals
  const [modal, setModal] = useState(null) // 'add' | 'edit' | 'details' | 'adjust' | 'barcode' | 'import'
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [copiedSku, setCopiedSku] = useState(null)
  const [openActionMenuId, setOpenActionMenuId] = useState(null)

  useEffect(() => {
    const handleOutsideClick = () => setOpenActionMenuId(null)
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [])

  // Details Modal State
  const [detailProduct, setDetailProduct] = useState(null)
  const [detailTab, setDetailTab] = useState('overview')
  const [detailHistory, setDetailHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Stock Adjust Modal State
  const [adjustProduct, setAdjustProduct] = useState(null)
  const [adjustMode, setAdjustMode] = useState('add') // 'add' | 'deduct' | 'set'
  const [adjustQty, setAdjustQty] = useState('1')
  const [adjustReason, setAdjustReason] = useState('adjustment')
  const [adjustNotes, setAdjustNotes] = useState('')
  const [adjusting, setAdjusting] = useState(false)

  // Barcode Print Modal State
  const [barcodeProduct, setBarcodeProduct] = useState(null)
  const [barcodeCopies, setBarcodeCopies] = useState(1)

  // CSV Import State
  const [importFile, setImportFile] = useState(null)
  const [importPreview, setImportPreview] = useState([])
  const [importErrors, setImportErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)

  const debounceRef = useRef(null)

  // Load products catalog
  const load = useCallback(async (query = search, category = catFilter) => {
    setLoading(true)
    try {
      const params = {}
      if (query?.trim()) params.search = query.trim()
      if (category) params.category = category
      params.page_size = 300

      const result = await productService.getProducts(params)
      const rows = Array.isArray(result?.items) ? result.items : (Array.isArray(result) ? result : [])
      setProducts(rows)
    } catch (error) {
      console.error('Failed to load products:', error)
      toast.error('Failed to load products')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [search, catFilter])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(
      () => load(search, catFilter),
      search.trim() ? 300 : 0,
    )
    return () => clearTimeout(debounceRef.current)
  }, [search, catFilter, load])

  // Load categories and suppliers
  useEffect(() => {
    const loadSupportData = async () => {
      try {
        const [cats, supps] = await Promise.all([
          productService.getCategories({ page_size: 100 }),
          productService.getSuppliers({ page_size: 100 }).catch(() => []),
        ])
        setCategories(Array.isArray(cats) ? cats : [])
        setSuppliers(Array.isArray(supps) ? supps : [])
      } catch (err) {
        console.error('Failed to load supporting data:', err)
      }
    }
    loadSupportData()
  }, [])

  // Unique Brands for brand filter dropdown
  const uniqueBrands = useMemo(() => {
    const brands = new Set()
    products.forEach(p => {
      if (p.brand?.trim()) brands.add(p.brand.trim())
    })
    return Array.from(brands).sort()
  }, [products])

  // Filtered & Sorted Products
  const visibleProducts = useMemo(() => {
    return products
      .filter(p => {
        const stock = numVal(p.current_stock)
        const minStock = numVal(p.minimum_stock || 5)

        // Brand filter
        if (brandFilter && p.brand !== brandFilter) return false

        // Stock status filter
        if (stockFilter === 'out_of_stock' && stock > 0) return false
        if (stockFilter === 'low_stock' && (stock <= 0 || stock > minStock))
          return false
        if (stockFilter === 'in_stock' && stock <= minStock) return false

        // GST filter
        if (gstFilter !== 'all' && Number(p.gst_percent || 0) !== Number(gstFilter))
          return false

        // Status filter
        if (statusFilter !== 'all' && p.status !== statusFilter) return false

        return true
      })
      .sort((a, b) => {
        let valA = a[sortBy]
        let valB = b[sortBy]

        if (sortBy === 'name' || sortBy === 'sku' || sortBy === 'brand') {
          valA = (valA || '').toLowerCase()
          valB = (valB || '').toLowerCase()
          return sortDir === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA)
        }

        valA = numVal(valA)
        valB = numVal(valB)
        return sortDir === 'asc' ? valA - valB : valB - valA
      })
  }, [products, brandFilter, stockFilter, gstFilter, statusFilter, sortBy, sortDir])

  useEffect(() => setCurrentPage(1), [brandFilter, stockFilter, gstFilter, statusFilter, search])
  const pagedProducts = visibleProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Product KPIs
  const stats = useMemo(() => {
    let totalStockValue = 0
    let totalRetailValue = 0
    let activeCount = 0
    let lowCount = 0
    let outCount = 0

    products.forEach(p => {
      const stock = numVal(p.current_stock)
      const minStock = numVal(p.minimum_stock || 5)
      const purchase = numVal(p.purchase_price)
      const selling = numVal(p.selling_price)

      totalStockValue += Math.max(0, stock) * purchase
      totalRetailValue += Math.max(0, stock) * selling

      if (p.status === 'active') activeCount++
      if (stock <= 0) outCount++
      else if (stock <= minStock) lowCount++
    })

    return {
      total: products.length,
      active: activeCount,
      low: lowCount,
      out: outCount,
      stockValue: totalStockValue,
      retailValue: totalRetailValue,
    }
  }, [products])

  const handleSort = column => {
    if (sortBy === column) {
      setSortDir(current => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir('asc')
    }
  }

  const resetFilters = () => {
    setSearch('')
    setCatFilter('')
    setBrandFilter('')
    setStockFilter('all')
    setGstFilter('all')
    setStatusFilter('all')
  }

  const isFilterActive =
    Boolean(search) ||
    Boolean(catFilter) ||
    Boolean(brandFilter) ||
    stockFilter !== 'all' ||
    gstFilter !== 'all' ||
    statusFilter !== 'all'

  // Open Add Product
  const openAdd = useCallback(() => {
    const generatedSKU = generateRandomSKU()
    setForm({
      ...EMPTY_FORM,
      sku: generatedSKU,
      barcode: generateRandomBarcode(),
    })
    setEditId(null)
    setModal('add')
  }, [])

  // Open Edit Product
  const openEdit = useCallback(product => {
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
      gst_percent: String(product.gst_percent ?? '0'),
      current_stock: String(product.current_stock ?? '0'),
      minimum_stock: String(product.minimum_stock ?? '5'),
      reorder_level: String(product.minimum_stock ?? '10'),
      supplier: product.supplier || '',
      status: product.status || 'active',
      image: product.image || '',
    })
    setEditId(product.id)
    setModal('edit')
  }, [])

  // Save Product (Add or Edit)
  const save = useCallback(async () => {
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
    if (form.purchase_price === '' || Number(form.purchase_price) < 0) {
      toast.error('Enter a valid purchase price')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        barcode: form.barcode.trim() || undefined,
        category: form.category || null,
        brand: form.brand.trim(),
        unit: form.unit || 'pcs',
        hsn_code: form.hsn_code.trim(),
        mrp: form.mrp !== '' ? Number(form.mrp) : undefined,
        purchase_price: Number(form.purchase_price || 0),
        selling_price: Number(form.selling_price || 0),
        gst_percent: Number(form.gst_percent || 0),
        current_stock: Number(form.current_stock || 0),
        minimum_stock: Number(form.minimum_stock || 5),
        supplier: form.supplier || null,
        status: form.status || 'active',
      }

      if (editId) {
        await productService.updateProduct(editId, payload)
        toast.success('Product updated successfully')
      } else {
        const saved = await productService.createProduct(payload)
        if (!saved?.barcode && saved?.id) {
          const autoCode = generateRandomBarcode()
          await productService.updateProduct(saved.id, { barcode: autoCode })
        }
        toast.success('Product created successfully')
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
  }, [form, editId, load, search, catFilter])

  // Delete Product
  const del = useCallback(async () => {
    if (!deleteId) return
    try {
      await productService.deleteProduct(deleteId)
      toast.success('Product deleted successfully')
      setDeleteId(null)
      await load(search, catFilter)
    } catch {
      toast.error('Failed to delete product')
    }
  }, [deleteId, load, search, catFilter])

  // Quick Toggle Active/Inactive Status
  const toggleProductStatus = useCallback(async product => {
    const newStatus = product.status === 'active' ? 'inactive' : 'active'
    try {
      await productService.updateProduct(product.id, { status: newStatus })
      toast.success(
        `Product marked as ${newStatus === 'active' ? 'Active' : 'Inactive'}`,
      )
      setProducts(prev =>
        prev.map(p => (p.id === product.id ? { ...p, status: newStatus } : p)),
      )
      if (detailProduct?.id === product.id) {
        setDetailProduct(prev => ({ ...prev, status: newStatus }))
      }
    } catch {
      toast.error('Failed to update product status')
    }
  }, [detailProduct])

  // Copy SKU to clipboard
  const copySKU = sku => {
    if (!sku) return
    navigator.clipboard.writeText(sku)
    setCopiedSku(sku)
    toast.success('SKU copied')
    setTimeout(() => setCopiedSku(null), 2000)
  }

  // Open Details Modal
  const openDetails = (product, initialTab = 'overview') => {
    setDetailProduct(product)
    setDetailTab(initialTab)
    setModal('details')
    loadProductHistory(product.id, initialTab)
  }

  const loadProductHistory = async (productId, tab = 'overview') => {
    if (!productId) return
    setLoadingHistory(true)
    try {
      const params = { product: productId }
      if (tab === 'sales') params.transaction_type = 'sale'
      if (tab === 'purchases') params.transaction_type = 'purchase'

      const txs = await productService.getInventoryTransactions(
        productId,
        params,
      )
      setDetailHistory(Array.isArray(txs) ? txs : [])
    } catch (err) {
      console.error('Failed to load product history:', err)
      setDetailHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleTabChange = tab => {
    setDetailTab(tab)
    if (detailProduct?.id) {
      loadProductHistory(detailProduct.id, tab)
    }
  }

  // Open Stock Adjust Modal
  const openAdjust = product => {
    setAdjustProduct(product)
    setAdjustMode('add')
    setAdjustQty('1')
    setAdjustReason('adjustment')
    setAdjustNotes('')
    setModal('adjust')
  }

  // Submit Stock Adjustment
  const submitStockAdjustment = async () => {
    if (!adjustProduct?.id) return
    const current = numVal(adjustProduct.current_stock)
    const qtyNumber = Number(adjustQty)

    if (isNaN(qtyNumber) || qtyNumber <= 0) {
      toast.error('Enter a valid quantity')
      return
    }

    let delta = 0
    if (adjustMode === 'add') delta = qtyNumber
    else if (adjustMode === 'deduct') delta = -qtyNumber
    else if (adjustMode === 'set') delta = qtyNumber - current

    if (delta === 0) {
      toast.error('No stock change detected')
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
      setModal(null)
      await load(search, catFilter)
      if (detailProduct?.id === adjustProduct.id) {
        setDetailProduct(prev => ({
          ...prev,
          current_stock: current + delta,
        }))
        loadProductHistory(adjustProduct.id, detailTab)
      }
    } catch (error) {
      console.error('Stock adjustment error, falling back to direct update:', error)
      // Fallback direct stock patch if adjust endpoint has permission limitation
      try {
        const updatedStock = Math.max(0, current + delta)
        await productService.updateProduct(adjustProduct.id, {
          current_stock: updatedStock,
        })
        toast.success('Stock updated successfully')
        setModal(null)
        await load(search, catFilter)
      } catch (err) {
        toast.error(
          error.response?.data?.error || 'Failed to adjust product stock',
        )
      }
    } finally {
      setAdjusting(false)
    }
  }

  // Open Barcode Modal
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
    const params = new URLSearchParams({ copies: String(quantity) })
    if (token) params.set('token', token)

    const url = `${API_BASE_URL}/products/${barcodeProduct.id}/barcode-label/?${params.toString()}`
    window.open(url, '_blank', 'noopener,noreferrer')
    setModal(null)
  }

  // Export Products to CSV
  const exportToCSV = () => {
    const listToExport = visibleProducts.length > 0 ? visibleProducts : products
    if (listToExport.length === 0) {
      toast.error('No products to export')
      return
    }

    const headers = [
      'Product Name',
      'SKU',
      'Barcode',
      'Category',
      'Brand',
      'Unit',
      'HSN Code',
      'Purchase Price',
      'Selling Price',
      'MRP',
      'GST Percent',
      'Current Stock',
      'Minimum Stock',
      'Supplier',
      'Status',
    ]

    const rows = listToExport.map(p => [
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.sku || '').replace(/"/g, '""')}"`,
      `"${(p.barcode || '').replace(/"/g, '""')}"`,
      `"${(p.category_name || '').replace(/"/g, '""')}"`,
      `"${(p.brand || '').replace(/"/g, '""')}"`,
      `"${p.unit || 'pcs'}"`,
      `"${(p.hsn_code || '').replace(/"/g, '""')}"`,
      numVal(p.purchase_price),
      numVal(p.selling_price),
      numVal(p.mrp),
      numVal(p.gst_percent),
      numVal(p.current_stock),
      numVal(p.minimum_stock || 5),
      `"${(p.supplier_name || '').replace(/"/g, '""')}"`,
      p.status || 'active',
    ])

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `products_catalog_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Exported ${listToExport.length} products to CSV`)
  }

  // Download Sample Template for CSV Import
  const downloadSampleTemplate = () => {
    const headers = [
      'Product Name',
      'SKU',
      'Barcode',
      'Category',
      'Brand',
      'Unit',
      'HSN Code',
      'Purchase Price',
      'Selling Price',
      'MRP',
      'GST Percent',
      'Current Stock',
      'Minimum Stock',
      'Status',
    ]

    const sampleRows = [
      [
        '"Basmati Rice 1kg"',
        '"RICE-1001"',
        '"890123456789"',
        '"Groceries"',
        '"India Gate"',
        '"kg"',
        '"100630"',
        '85.00',
        '115.00',
        '125.00',
        '5',
        '60',
        '10',
        '"active"',
      ],
      [
        '"Sunflower Cooking Oil 1L"',
        '"OIL-2002"',
        '"890987654321"',
        '"Groceries"',
        '"Fortune"',
        '"L"',
        '"151219"',
        '135.00',
        '165.00',
        '180.00',
        '5',
        '40',
        '8',
        '"active"',
      ],
    ]

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...sampleRows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'sample_products_import.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle CSV File Selection
  const handleCSVUpload = e => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)
    const reader = new FileReader()
    reader.onload = event => {
      try {
        const text = event.target.result
        const lines = text.split(/\r?\n/).filter(line => line.trim())
        if (lines.length <= 1) {
          toast.error('The selected file has no data rows')
          return
        }

        const parseLine = line => {
          const result = []
          let start = 0
          let inQuotes = false
          for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
              inQuotes = !inQuotes
            } else if (line[i] === ',' && !inQuotes) {
              result.push(line.slice(start, i).replace(/^"|"$/g, '').trim())
              start = i + 1
            }
          }
          result.push(line.slice(start).replace(/^"|"$/g, '').trim())
          return result
        }

        const rawHeaders = parseLine(lines[0]).map(h =>
          h.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        )

        const parsed = []
        const errs = []

        for (let i = 1; i < lines.length; i++) {
          const values = parseLine(lines[i])
          if (values.every(v => !v)) continue

          const rowData = {}
          rawHeaders.forEach((header, index) => {
            rowData[header] = values[index] || ''
          })

          const name =
            rowData.product_name ||
            rowData.name ||
            rowData.product ||
            rowData.title
          const sku = rowData.sku || rowData.product_sku
          const selling = Number(
            rowData.selling_price || rowData.price || rowData.selling || 0,
          )
          const purchase = Number(
            rowData.purchase_price || rowData.cost || rowData.purchase || 0,
          )

          if (!name) {
            errs.push(`Row ${i + 1}: Missing Product Name`)
            continue
          }

          parsed.push({
            name,
            sku: sku || generateRandomSKU(name),
            barcode: rowData.barcode || '',
            category: rowData.category || '',
            brand: rowData.brand || '',
            unit: rowData.unit || 'pcs',
            hsn_code: rowData.hsn_code || rowData.hsn || '',
            purchase_price: purchase,
            selling_price: selling || purchase * 1.2,
            mrp: Number(rowData.mrp || 0) || undefined,
            gst_percent: Number(rowData.gst_percent || rowData.gst || 0),
            current_stock: Number(
              rowData.current_stock || rowData.stock || rowData.qty || 0,
            ),
            minimum_stock: Number(
              rowData.minimum_stock || rowData.min_stock || 5,
            ),
            status:
              rowData.status?.toLowerCase() === 'inactive'
                ? 'inactive'
                : 'active',
          })
        }

        setImportPreview(parsed)
        setImportErrors(errs)
      } catch (err) {
        console.error('Failed to parse CSV:', err)
        toast.error('Failed to parse CSV file. Ensure standard format.')
      }
    }
    reader.readAsText(file)
  }

  // Execute CSV Import
  const runCSVImport = async () => {
    if (importPreview.length === 0) {
      toast.error('No valid products to import')
      return
    }

    setImporting(true)
    let imported = 0
    let failed = 0

    // Match categories by name
    const categoryMap = {}
    categories.forEach(c => {
      categoryMap[c.name.toLowerCase()] = c.id
    })

    for (const item of importPreview) {
      try {
        const catId = item.category
          ? categoryMap[item.category.toLowerCase()] || null
          : null

        const payload = {
          ...item,
          category: catId,
        }

        // Check if product with this SKU already exists
        const existing = products.find(
          p => p.sku?.toLowerCase() === item.sku?.toLowerCase(),
        )

        if (existing) {
          await productService.updateProduct(existing.id, payload)
        } else {
          await productService.createProduct(payload)
        }
        imported++
      } catch (err) {
        failed++
        console.error('Import row failure:', item.name, err)
      }
    }

    setImporting(false)
    setModal(null)
    setImportFile(null)
    setImportPreview([])
    toast.success(
      `Import complete: ${imported} imported/updated${failed > 0 ? `, ${failed} failed` : ''}`,
    )
    await load(search, catFilter)
  }

  return (
    <div className="products-module min-w-0 space-y-5">
      <style>{`
        .products-module {
          --danger-bg: #fff1f2;
          --danger-border: #fecdd3;
          --warning-bg: #fffbeb;
          --warning-border: #fde68a;
          --success-bg: #ecfdf5;
          --success-border: #a7f3d0;
        }

        .dark .products-module,
        [data-theme="dark"] .products-module {
          --danger-bg: #4c0519;
          --danger-border: #9f1239;
          --warning-bg: #451a03;
          --warning-border: #92400e;
          --success-bg: #052e24;
          --success-border: #065f46;
        }

        .products-module .btn-secondary {
          border-color: #93c5fd;
          background: #eff6ff;
          color: #1d4ed8;
        }

        .dark .products-module .btn-secondary {
          border-color: #1e40af;
          background: rgba(30, 64, 175, .24);
          color: #bfdbfe;
        }

        .products-module .erp-table {
          width: 100%;
          border-collapse: collapse;
        }

        .products-module .erp-table th {
          padding: 12px 14px;
          text-align: left;
          white-space: nowrap;
          background: linear-gradient(135deg, #1e3a8a, #2563eb);
          border-bottom: 1px solid var(--line);
          color: #eff6ff;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .05em;
          text-transform: uppercase;
        }

        .products-module .erp-table td {
          padding: 13px 14px;
          border-bottom: 1px solid var(--line-subtle);
          vertical-align: middle;
        }

        .products-module .erp-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .products-module .erp-table tbody tr:hover {
          background: var(--surface-elevated);
        }
      `}</style>

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}
      <PageHeader
        title="Products & Inventory"
        subtitle={`${stats.total} total items • ${stats.active} active • ${formatCurrency(stats.stockValue)} total stock valuation`}
        action={
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={exportToCSV}
              className="btn-secondary btn-base flex items-center justify-center gap-2 text-xs font-semibold"
              title="Export products to CSV"
            >
              <Download size={15} />
              Export
            </button>

            <button
              type="button"
              onClick={() => {
                setImportFile(null)
                setImportPreview([])
                setImportErrors([])
                setModal('import')
              }}
              className="btn-secondary btn-base flex items-center justify-center gap-2 text-xs font-semibold"
              title="Import products from CSV"
            >
              <Upload size={15} />
              Import
            </button>

            <button
              type="button"
              onClick={openAdd}
              className="btn-primary btn-base flex items-center justify-center gap-2 text-xs font-semibold"
            >
              <Plus size={16} />
              Add Product
            </button>
          </div>
        }
      />

      {/* =====================================================
          PRODUCT METRICS & STOCK ALERTS SUMMARY TABLE
      ====================================================== */}
      <section className="erp-table-container">
        <div className="border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
          Product Catalog & Stock Valuation
        </div>
        <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-5 sm:divide-y-0 sm:divide-x">
          <div
            onClick={() => setStockFilter('all')}
            className={`p-3 cursor-pointer transition-colors ${
              stockFilter === 'all'
                ? 'bg-[var(--surface-elevated)] font-semibold'
                : 'hover:bg-[var(--surface-hover)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Total Products
              </span>
              <Boxes size={13} className="text-[#1E3A5F] dark:text-slate-300" />
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--ink)]">
              {stats.total}
            </p>
            <p className="text-[10px] text-[var(--muted)]">All catalog items</p>
          </div>

          <div
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
            className={`p-3 cursor-pointer transition-colors ${
              statusFilter === 'active'
                ? 'bg-[var(--surface-elevated)] font-semibold'
                : 'hover:bg-[var(--surface-hover)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Active Items
              </span>
              <CheckCircle2 size={13} className="text-teal-600 dark:text-teal-400" />
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-teal-600 dark:text-teal-400">
              {stats.active}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Available for sale</p>
          </div>

          <div
            onClick={() => setStockFilter(stockFilter === 'low_stock' ? 'all' : 'low_stock')}
            className={`p-3 cursor-pointer transition-colors ${
              stockFilter === 'low_stock'
                ? 'bg-[var(--surface-elevated)] font-semibold'
                : 'hover:bg-[var(--surface-hover)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Low Stock Alert
              </span>
              <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400" />
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-amber-600 dark:text-amber-400">
              {stats.low}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Threshold reached</p>
          </div>

          <div
            onClick={() => setStockFilter(stockFilter === 'out_of_stock' ? 'all' : 'out_of_stock')}
            className={`p-3 cursor-pointer transition-colors ${
              stockFilter === 'out_of_stock'
                ? 'bg-[var(--surface-elevated)] font-semibold'
                : 'hover:bg-[var(--surface-hover)]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Out of Stock
              </span>
              <XCircle size={13} className="text-rose-600 dark:text-rose-400" />
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-rose-600 dark:text-rose-400">
              {stats.out}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Zero balance</p>
          </div>

          <div className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Stock Valuation
              </span>
              <Tag size={13} className="text-[#1E3A5F] dark:text-slate-300" />
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-[#1E3A5F] dark:text-slate-200">
              {formatCurrency(stats.stockValue)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">
              Retail: {formatCurrency(stats.retailValue)}
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          SEARCH & MULTI-FILTER TOOLBAR
      ====================================================== */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-center">
          {/* Search bar */}
          <div className="relative min-w-0 sm:col-span-2 lg:col-span-4">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              type="search"
              className="input h-11 w-full pl-10 pr-9 text-xs sm:text-sm font-medium"
              placeholder="Search name, SKU, barcode, brand..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search products"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div className="min-w-0 lg:col-span-2">
            <select
              className="input h-11 w-full text-xs font-medium"
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
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

          {/* Brand Dropdown */}
          <div className="min-w-0 lg:col-span-2">
            <select
              className="input h-11 w-full text-xs font-medium"
              value={brandFilter}
              onChange={e => setBrandFilter(e.target.value)}
              aria-label="Filter by brand"
            >
              <option value="">All Brands</option>
              {uniqueBrands.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Dropdown */}
          <div className="min-w-0 lg:col-span-2">
            <select
              className="input h-11 w-full text-xs font-medium"
              value={stockFilter}
              onChange={e => setStockFilter(e.target.value)}
              aria-label="Filter by stock status"
            >
              <option value="all">All Stock Levels</option>
              <option value="in_stock">In Stock (&gt; Min)</option>
              <option value="low_stock">Low Stock (≤ Min)</option>
              <option value="out_of_stock">Out of Stock (0)</option>
            </select>
          </div>

          {/* GST Rate Filter */}
          <div className="min-w-0 lg:col-span-1">
            <select
              className="input h-11 w-full text-xs font-medium"
              value={gstFilter}
              onChange={e => setGstFilter(e.target.value)}
              aria-label="Filter by GST percent"
            >
              <option value="all">GST</option>
              {GST_OPTIONS.map(gst => (
                <option key={gst} value={gst}>
                  {gst}%
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters Action */}
          {isFilterActive && (
            <div className="flex items-center sm:col-span-2 lg:col-span-1">
              <button
                type="button"
                onClick={resetFilters}
                className="btn-secondary h-11 w-full px-3 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center gap-1.5 font-medium"
                className="btn-secondary h-11 w-full px-3 text-xs text-rose-400 hover:bg-rose-950/40 flex items-center justify-center gap-1.5 font-medium"
                title="Reset all filters"
              >
                <X size={14} />
                <span>Reset</span>
              </button>
            </div>
          )}
        </div>

        {/* Quick Filter Pill Badges */}
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
          ].map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStockFilter(f.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                stockFilter === f.key
                  ? 'bg-[#1E3A5F] text-white font-semibold'
                  : 'bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {f.label}
            </button>
          ))}

          <span className="mx-2 h-4 w-px bg-[var(--line)]" />

          {['all', 'active', 'inactive'].map(st => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                statusFilter === st
                  ? 'bg-teal-600 text-white font-semibold'
                  : 'bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================
          PRODUCTS DATA TABLE & CARDS
      ====================================================== */}
      <div className="  border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[var(--ink)]">
              Product Master Catalog
            </h2>
            <span className="rounded-full bg-[var(--surface-elevated)] px-2.5 py-0.5 text-xs font-semibold text-[var(--muted)]">
              {visibleProducts.length} item
              {visibleProducts.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="text-xs text-[var(--muted)] hidden sm:block">
            Showing all matching products
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={10} cols={7} label="Loading products" />
        ) : visibleProducts.length === 0 ? (
          <EmptyState
            icon={Package}
            title={isFilterActive ? 'No products match filters' : 'No products yet'}
            description={
              isFilterActive
                ? 'Try adjusting your search query, category, or stock filter.'
                : 'Get started by creating your first product or importing catalog.'
            }
            action={
              isFilterActive
                ? { label: 'Clear Filters', onClick: resetFilters }
                : { label: 'Add First Product', onClick: openAdd }
            }
          />
        ) : (
          <>
            {/* Mobile Cards View (< 768px) */}
            <div className="divide-y divide-[var(--line-subtle)] md:hidden">
              {pagedProducts.map(product => {
                const stockAlert = getStockAlertState(product)
                const StockIcon = stockAlert.icon
                return (
                  <article key={product.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-[var(--ink)] truncate">
                          {product.name}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
                          {product.brand && (
                            <span className="font-medium text-[var(--ink-secondary)]">
                              {product.brand}
                            </span>
                          )}
                          {product.brand && <span>•</span>}
                          <span>{product.category_name || 'Uncategorized'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openDetails(product)}
                          className="icon-btn"
                          title="View Details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(product)}
                          className="icon-btn"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Identifiers */}
                    <div className="flex items-center gap-3 text-xs font-mono text-[var(--muted)]">
                      <span>SKU: {product.sku || '—'}</span>
                      <span>•</span>
                      <span>Bar: {product.barcode || '—'}</span>
                    </div>

                    {/* Price & Stock Grid */}
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-elevated)] p-2.5 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--muted-light)]">
                          Selling Price
                        </span>
                        <p className="mt-0.5 font-mono font-bold text-[var(--ink)]">
                          {formatCurrency(product.selling_price)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--muted-light)]">
                          Purchase
                        </span>
                        <p className="mt-0.5 font-mono text-[var(--muted)]">
                          {formatCurrency(product.purchase_price)}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[var(--muted-light)]">
                          Current Stock
                        </span>
                        <p className={`mt-0.5 font-mono ${stockAlert.textClass}`}>
                          {product.current_stock ?? 0}{' '}
                          <span className="text-[10px] font-normal text-[var(--muted)]">
                            {product.unit || 'pcs'}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Stock Alert Badge & Actions */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${stockAlert.badgeClass}`}
                        >
                          <StockIcon size={12} />
                          {stockAlert.label}
                        </span>

                        <Badge status={product.status || 'active'} />
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openAdjust(product)}
                          className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                          title="Adjust stock"
                        >
                          Stock
                        </button>
                        <button
                          type="button"
                          onClick={() => openBarcode(product)}
                          className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                          title="Print barcode"
                        >
                          <Barcode size={13} className="inline mr-1" />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            {/* Desktop Table View (>= 768px) */}
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
                    <th
                      className="cursor-pointer hover:text-[var(--ink)]"
                      onClick={() => handleSort('sku')}
                    >
                      <div className="flex items-center gap-1">
                        SKU / Barcode
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th>Category</th>
                    <th
                      className="text-right cursor-pointer hover:text-[var(--ink)]"
                      onClick={() => handleSort('purchase_price')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Purchase Price
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th
                      className="text-right cursor-pointer hover:text-[var(--ink)]"
                      onClick={() => handleSort('selling_price')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Selling Price
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th
                      className="text-right cursor-pointer hover:text-[var(--ink)]"
                      onClick={() => handleSort('current_stock')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Stock
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th className="text-center">GST</th>
                    <th className="text-center">Status</th>
                    <th className="text-right w-24">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {pagedProducts.map(product => {
                    const stockAlert = getStockAlertState(product)
                    const StockIcon = stockAlert.icon
                    const margin =
                      numVal(product.selling_price) > 0
                        ? (
                            ((numVal(product.selling_price) -
                              numVal(product.purchase_price)) /
                              numVal(product.selling_price)) *
                            100
                          ).toFixed(0)
                        : 0

                    return (
                      <tr
                        key={product.id}
                        className={stockAlert.isLow || stockAlert.isOut ? 'row-low-stock' : ''}
                      >
                        {/* 1. Product Name */}
                        <td>
                          <div className="min-w-44">
                            <button
                              type="button"
                              onClick={() => openDetails(product)}
                              className="text-left font-bold text-sm text-[var(--ink)] hover:text-[#1E3A5F] transition-colors line-clamp-1"
                            >
                              {product.name}
                            </button>
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
                              {product.hsn_code && (
                                <span className="font-mono text-[10px]">
                                  HSN: {product.hsn_code}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. SKU & Barcode */}
                        <td>
                          <div className="min-w-32">
                            <div className="flex items-center gap-1">
                              <span className="font-mono text-xs font-medium text-[var(--ink)]">
                                {product.sku || '—'}
                              </span>
                              {product.sku && (
                                <button
                                  type="button"
                                  onClick={() => copySKU(product.sku)}
                                  className="text-[var(--muted)] hover:text-[#1E3A5F]"
                                  title="Copy SKU"
                                >
                                  {copiedSku === product.sku ? (
                                    <Check size={11} className="text-teal-600" />
                                  ) : (
                                    <Copy size={11} />
                                  )}
                                </button>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-[var(--muted-light)] flex items-center gap-1 mt-0.5">
                              <Barcode size={11} />
                              {product.barcode || 'No barcode'}
                            </span>
                          </div>
                        </td>

                        {/* 3. Category & Unit */}
                        <td>
                          <div className="text-xs">
                            <span className="font-medium text-[var(--ink-secondary)]">
                              {product.category_name || '—'}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {product.brand && (
                                <span className="text-[11px] text-[var(--muted)]">
                                  {product.brand}
                                </span>
                              )}
                              {product.unit && (
                                <span className="rounded bg-[var(--surface-elevated)] px-1 py-0.2 font-mono text-[10px] text-[var(--muted)]">
                                  {product.unit}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 4. Purchase Price */}
                        <td className="text-right font-mono text-xs text-[var(--muted)]">
                          {formatCurrency(product.purchase_price)}
                        </td>

                        {/* 5. Selling Price, MRP & Margin */}
                        <td className="text-right font-mono">
                          <span className="font-bold text-sm text-[var(--ink)]">
                            {formatCurrency(product.selling_price)}
                          </span>
                          {product.mrp && Number(product.mrp) > Number(product.selling_price) && (
                            <span className="block text-[10px] text-[var(--muted-light)] line-through">
                              MRP {formatCurrency(product.mrp)}
                            </span>
                          )}
                          {margin > 0 && (
                            <span className="block text-[10px] font-semibold text-teal-600 dark:text-teal-400">
                              +{margin}% margin
                            </span>
                          )}
                        </td>

                        {/* 6. Current Stock with Alert Badge */}
                        <td className="text-right">
                          <div className="inline-flex flex-col items-end gap-1">
                            <span
                              className={`font-mono text-xs ${stockAlert.textClass}`}
                            >
                              {product.current_stock ?? 0}{' '}
                              <span className="text-[10px] font-normal text-[var(--muted)]">
                                {product.unit || 'pcs'}
                              </span>
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stockAlert.badgeClass}`}
                            >
                              <StockIcon size={10} />
                              {stockAlert.label}
                            </span>
                          </div>
                        </td>

                        {/* 7. GST */}
                        <td className="text-center">
                          <span className="inline-flex rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--muted)]">
                            {product.gst_percent ?? 0}%
                          </span>
                        </td>

                        {/* 8. Status */}
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => toggleProductStatus(product)}
                            title={`Click to mark as ${product.status === 'active' ? 'Inactive' : 'Active'}`}
                          >
                            <Badge status={product.status || 'active'} />
                          </button>
                        </td>

                        {/* 9. Actions with Primary Edit and Three-dot Menu */}
                        <td className="text-right relative">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEdit(product)}
                              className="icon-btn"
                              title="Edit Product"
                              aria-label="Edit"
                            >
                              <Edit2 size={13} />
                            </button>

                            <div className="relative">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation()
                                  setOpenActionMenuId(openActionMenuId === product.id ? null : product.id)
                                }}
                                className={`icon-btn ${openActionMenuId === product.id ? 'bg-[var(--surface-elevated)] text-[var(--ink)]' : ''}`}
                                title="More Actions"
                                aria-label="More actions"
                              >
                                <MoreVertical size={13} />
                              </button>

                              {openActionMenuId === product.id && (
                                <div
                                  className="absolute right-0 top-full mt-1 z-30 w-44 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1 text-left shadow-lg"
                                  onClick={e => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null)
                                      openDetails(product)
                                    }}
                                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                                  >
                                    <Eye size={13} className="text-[var(--muted)]" />
                                    <span>View Details</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null)
                                      openAdjust(product)
                                    }}
                                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                                  >
                                    <SlidersHorizontal size={13} className="text-[var(--muted)]" />
                                    <span>Adjust Stock</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null)
                                      openDetails(product, 'movements')
                                    }}
                                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                                  >
                                    <History size={13} className="text-[var(--muted)]" />
                                    <span>Stock History</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null)
                                      openBarcode(product)
                                    }}
                                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
                                  >
                                    <Barcode size={13} className="text-[var(--muted)]" />
                                    <span>Print Barcode</span>
                                  </button>

                                  <div className="my-1 border-t border-[var(--line)]" />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null)
                                      setDeleteId(product.id)
                                    }}
                                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-[var(--danger)] hover:bg-red-50 dark:hover:bg-red-950/30"
                                    className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40"
                                  >
                                    <Trash2 size={13} />
                                    <span>Delete Product</span>
                                  </button>
                                </div>
                              )}
                            </div>
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

        {!loading && visibleProducts.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={Math.max(1, Math.ceil(visibleProducts.length / pageSize))}
            totalItems={visibleProducts.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        )}

        {/* Footer pagination info */}
        {!loading && visibleProducts.length > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3 text-xs text-[var(--muted)]">
            <span>
              Showing {visibleProducts.length} of {products.length} catalog items
            </span>
            <span className="font-mono">
              Total stock on hand:{' '}
              {visibleProducts.reduce(
                (sum, p) => sum + numVal(p.current_stock),
                0,
              )}{' '}
              units
            </span>
          </div>
        )}
      </div>

      {/* =====================================================
          ADD / EDIT PRODUCT MODAL
      ====================================================== */}
      <Modal
        open={modal === 'add' || modal === 'edit'}
        onClose={() => !saving && setModal(null)}
        title={editId ? 'Edit Product Details' : 'Add New Product to Inventory'}
        size="xl"
      >
        <div className="space-y-5">
          {/* SECTION 1: BASIC INFORMATION */}
          <div>
            <div className="mb-3 flex items-center justify-between border-b border-[var(--line-subtle)] pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1E3A5F] dark:text-slate-200">
                1. General Information
              </span>
              <span className="text-[11px] text-[var(--muted-light)]">
                Required for invoicing &amp; barcode scanning
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="Product Name" required className="sm:col-span-2">
                <input
                  className="input"
                  value={form.name}
                  onChange={e =>
                    setForm(prev => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Basmati Rice Supreme 5kg"
                />
              </FormField>

              <FormField label="Category">
                <select
                  className="input"
                  value={form.category}
                  onChange={e =>
                    setForm(prev => ({ ...prev, category: e.target.value }))
                  }
                >
                  <option value="">Select Category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="SKU (Stock Keeping Unit)" required>
                <div className="flex gap-1.5">
                  <input
                    className="input font-mono flex-1 uppercase"
                    value={form.sku}
                    onChange={e =>
                      setForm(prev => ({ ...prev, sku: e.target.value }))
                    }
                    placeholder="e.g. PRD-1024"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm(prev => ({
                        ...prev,
                        sku: generateRandomSKU(form.name),
                      }))
                    }
                    className="btn-secondary px-2.5 text-xs whitespace-nowrap"
                    title="Auto-generate SKU"
                  >
                    Auto
                  </button>
                </div>
              </FormField>

              <FormField label="Barcode (EAN/UPC)" hint="Scanner/Label">
                <div className="flex gap-1.5">
                  <input
                    className="input font-mono flex-1"
                    value={form.barcode}
                    onChange={e =>
                      setForm(prev => ({ ...prev, barcode: e.target.value }))
                    }
                    placeholder="Auto-assigned if empty"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm(prev => ({
                        ...prev,
                        barcode: generateRandomBarcode(),
                      }))
                    }
                    className="btn-secondary px-2.5 text-xs whitespace-nowrap"
                    title="Auto-generate barcode"
                  >
                    Auto
                  </button>
                </div>
              </FormField>

              <FormField label="Brand / Manufacturer">
                <input
                  className="input"
                  value={form.brand}
                  onChange={e =>
                    setForm(prev => ({ ...prev, brand: e.target.value }))
                  }
                  placeholder="e.g. Nestle, Tata, Fortune"
                />
              </FormField>

              <FormField label="Measurement Unit" required>
                <select
                  className="input"
                  value={form.unit}
                  onChange={e =>
                    setForm(prev => ({ ...prev, unit: e.target.value }))
                  }
                >
                  {UNITS.map(u => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="HSN / SAC Code" hint="GST Classification">
                <input
                  className="input font-mono"
                  value={form.hsn_code}
                  onChange={e =>
                    setForm(prev => ({ ...prev, hsn_code: e.target.value }))
                  }
                  placeholder="e.g. 100630"
                />
              </FormField>
            </div>
          </div>

          {/* SECTION 2: PRICING & GST */}
          <div>
            <div className="mb-3 flex items-center justify-between border-b border-[var(--line-subtle)] pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                2. Pricing &amp; GST Details
              </span>
              {numVal(form.selling_price) > 0 && numVal(form.purchase_price) > 0 && (
                <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">
                  Margin:{' '}
                  {(
                    ((numVal(form.selling_price) -
                      numVal(form.purchase_price)) /
                      numVal(form.selling_price)) *
                    100
                  ).toFixed(1)}
                  % (Profit: ₹
                  {(
                    numVal(form.selling_price) - numVal(form.purchase_price)
                  ).toFixed(2)}
                  /unit)
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Purchase Price (₹)" required hint="Cost price">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input font-mono"
                  value={form.purchase_price}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      purchase_price: e.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="Selling Price (₹)" required hint="Billing rate">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input font-mono font-bold"
                  value={form.selling_price}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      selling_price: e.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="MRP (₹)" hint="Max Retail Price">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input font-mono"
                  value={form.mrp}
                  onChange={e =>
                    setForm(prev => ({ ...prev, mrp: e.target.value }))
                  }
                  placeholder="0.00"
                />
              </FormField>

              <FormField label="GST Rate (%)">
                <select
                  className="input font-mono"
                  value={form.gst_percent}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      gst_percent: e.target.value,
                    }))
                  }
                >
                  {GST_OPTIONS.map(gst => (
                    <option key={gst} value={gst}>
                      {gst}% GST
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </div>

          {/* SECTION 3: INVENTORY & STOCK ALERTS */}
          <div>
            <div className="mb-3 flex items-center justify-between border-b border-[var(--line-subtle)] pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                3. Inventory &amp; Stock Alerts
              </span>
              <span className="text-[11px] text-[var(--muted-light)]">
                Thresholds for low-stock and reorder warnings
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                label="Opening / Current Stock"
                required
                hint="Units on hand"
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input font-mono font-bold"
                  value={form.current_stock}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      current_stock: e.target.value,
                    }))
                  }
                  placeholder="0"
                />
              </FormField>

              <FormField
                label="Minimum Stock Alert"
                hint="Triggers Low Stock"
              >
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input font-mono"
                  value={form.minimum_stock}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      minimum_stock: e.target.value,
                    }))
                  }
                  placeholder="5"
                />
              </FormField>

              <FormField label="Supplier" hint="Default vendor">
                <select
                  className="input"
                  value={form.supplier}
                  onChange={e =>
                    setForm(prev => ({ ...prev, supplier: e.target.value }))
                  }
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Product Status">
                <select
                  className="input font-semibold"
                  value={form.status}
                  onChange={e =>
                    setForm(prev => ({ ...prev, status: e.target.value }))
                  }
                >
                  <option value="active">Active (Available for Sale)</option>
                  <option value="inactive">Inactive (Hidden from POS)</option>
                </select>
              </FormField>
            </div>
          </div>

          {/* MODAL ACTION BUTTONS */}
          <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setModal(null)}
              disabled={saving}
              className="btn-secondary btn-base sm:w-28"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-primary btn-base sm:w-36 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Saving...
                </>
              ) : editId ? (
                'Update Product'
              ) : (
                'Save Product'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* =====================================================
          PRODUCT DETAILS MODAL (Overview, Sales, Purchases, Stock History)
      ====================================================== */}
      <Modal
        open={modal === 'details'}
        onClose={() => setModal(null)}
        title={detailProduct ? detailProduct.name : 'Product Details'}
        size="xl"
      >
        {detailProduct && (
          <div className="space-y-5">
            {/* Top Summary Header */}
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-[var(--ink)]">
                      {detailProduct.name}
                    </h3>
                    <Badge status={detailProduct.status || 'active'} />
                    {(() => {
                      const alert = getStockAlertState(detailProduct)
                      const AlertIcon = alert.icon
                      return (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${alert.badgeClass}`}
                        >
                          <AlertIcon size={12} />
                          {alert.label}
                        </span>
                      )
                    })()}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)] font-mono">
                    <span>SKU: {detailProduct.sku || '—'}</span>
                    <span>•</span>
                    <span>
                      Barcode: {detailProduct.barcode || 'Not assigned'}
                    </span>
                    <span>•</span>
                    <span>
                      Category: {detailProduct.category_name || 'Uncategorized'}
                    </span>
                    {detailProduct.brand && (
                      <>
                        <span>•</span>
                        <span>Brand: {detailProduct.brand}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Quick actions on header */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      openAdjust(detailProduct)
                    }}
                    className="btn-secondary btn-base text-xs flex items-center gap-1.5"
                  >
                    <SlidersHorizontal size={14} />
                    Adjust Stock
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      openBarcode(detailProduct)
                    }}
                    className="btn-secondary btn-base text-xs flex items-center gap-1.5"
                  >
                    <Barcode size={14} />
                    Barcode
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      openEdit(detailProduct)
                    }}
                    className="btn-primary btn-base text-xs flex items-center gap-1.5"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                </div>
              </div>

              {/* KPI Strip */}
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 border-t border-[var(--line)] pt-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-[var(--muted)]">
                    Current Stock
                  </span>
                  <p className="font-mono text-base font-bold text-[var(--ink)]">
                    {detailProduct.current_stock ?? 0}{' '}
                    <span className="text-xs font-normal text-[var(--muted)]">
                      {detailProduct.unit || 'pcs'}
                    </span>
                  </p>
                  <span className="text-[10px] text-[var(--muted-light)]">
                    Min alert: {detailProduct.minimum_stock ?? 5} units
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-[var(--muted)]">
                    Selling Price
                  </span>
                  <p className="font-mono text-base font-bold text-[#1E3A5F] dark:text-slate-200">
                    {formatCurrency(detailProduct.selling_price)}
                  </p>
                  <span className="text-[10px] text-[var(--muted-light)]">
                    MRP: {formatCurrency(detailProduct.mrp || 0)}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-[var(--muted)]">
                    Purchase Price
                  </span>
                  <p className="font-mono text-base font-bold text-[var(--ink)]">
                    {formatCurrency(detailProduct.purchase_price)}
                  </p>
                  <span className="text-[10px] text-[var(--muted-light)]">
                    Cost per unit
                  </span>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase text-[var(--muted)]">
                    Stock Valuation
                  </span>
                  <p className="font-mono text-base font-bold text-teal-600 dark:text-teal-400">
                    {formatCurrency(
                      numVal(detailProduct.current_stock) *
                        numVal(detailProduct.purchase_price),
                    )}
                  </p>
                  <span className="text-[10px] text-[var(--muted-light)]">
                    GST: {detailProduct.gst_percent ?? 0}%
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-1 border-b border-[var(--line)] overflow-x-auto text-xs">
              {[
                { key: 'overview', label: 'Overview & Specs' },
                { key: 'sales', label: 'Sales History' },
                { key: 'purchases', label: 'Purchase History' },
                { key: 'movements', label: 'Stock Movement History' },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleTabChange(t.key)}
                  className={`border-b-2 px-3.5 py-2.5 font-semibold whitespace-nowrap transition-colors ${
                    detailTab === t.key
                      ? 'border-[#1E3A5F] text-[#1E3A5F] dark:text-slate-200'
                      : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENT */}
            {detailTab === 'overview' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-3 rounded-xl border border-[var(--line)] p-4">
                  <h4 className="font-bold uppercase tracking-wider text-[var(--muted-light)] text-[11px]">
                    Product Specification
                  </h4>
                  <div className="divide-y divide-[var(--line-subtle)] space-y-2">
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">Product Name</span>
                      <span className="font-medium text-[var(--ink)]">
                        {detailProduct.name}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">SKU</span>
                      <span className="font-mono font-medium text-[var(--ink)]">
                        {detailProduct.sku || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">Barcode</span>
                      <span className="font-mono font-medium text-[var(--ink)]">
                        {detailProduct.barcode || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">Category</span>
                      <span className="font-medium text-[var(--ink)]">
                        {detailProduct.category_name || 'Uncategorized'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">Brand</span>
                      <span className="font-medium text-[var(--ink)]">
                        {detailProduct.brand || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">Unit</span>
                      <span className="font-medium text-[var(--ink)]">
                        {detailProduct.unit || 'pcs'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">HSN Code</span>
                      <span className="font-mono font-medium text-[var(--ink)]">
                        {detailProduct.hsn_code || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">Supplier</span>
                      <span className="font-medium text-[var(--ink)]">
                        {detailProduct.supplier_name || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-[var(--line)] p-4">
                  <h4 className="font-bold uppercase tracking-wider text-[var(--muted-light)] text-[11px]">
                    Pricing, Margins &amp; Stock
                  </h4>
                  <div className="divide-y divide-[var(--line-subtle)] space-y-2">
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">Purchase Price</span>
                      <span className="font-mono font-medium text-[var(--ink)]">
                        {formatCurrency(detailProduct.purchase_price)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">Selling Price</span>
                      <span className="font-mono font-bold text-[#1E3A5F] dark:text-slate-200">
                        {formatCurrency(detailProduct.selling_price)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">MRP</span>
                      <span className="font-mono text-[var(--ink)]">
                        {detailProduct.mrp
                          ? formatCurrency(detailProduct.mrp)
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">GST Percentage</span>
                      <span className="font-mono text-[var(--ink)]">
                        {detailProduct.gst_percent ?? 0}%
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">Profit Margin</span>
                      <span className="font-semibold text-teal-600 dark:text-teal-400 font-mono">
                        {numVal(detailProduct.selling_price) > 0
                          ? (
                              ((numVal(detailProduct.selling_price) -
                                numVal(detailProduct.purchase_price)) /
                                numVal(detailProduct.selling_price)) *
                              100
                            ).toFixed(1)
                          : 0}
                        %
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">Current Stock</span>
                      <span className="font-mono font-bold text-[var(--ink)]">
                        {detailProduct.current_stock ?? 0}{' '}
                        {detailProduct.unit || 'pcs'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">Low Stock Threshold</span>
                      <span className="font-mono text-[var(--muted)]">
                        {detailProduct.minimum_stock ?? 5}{' '}
                        {detailProduct.unit || 'pcs'}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-[var(--muted)]">Total Inventory Value</span>
                      <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                        {formatCurrency(
                          numVal(detailProduct.current_stock) *
                            numVal(detailProduct.purchase_price),
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(detailTab === 'sales' ||
              detailTab === 'purchases' ||
              detailTab === 'movements') && (
              <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
                {loadingHistory ? (
                  <div className="flex min-h-36 items-center justify-center p-6">
                    <Spinner />
                  </div>
                ) : detailHistory.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[var(--muted)]">
                    No transactions recorded for this tab yet.
                  </div>
                ) : (
                  <table className="erp-table text-xs">
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Type</th>
                        <th>Reference</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Unit Cost</th>
                        <th className="text-right">Stock Before</th>
                        <th className="text-right">Stock After</th>
                        <th>Notes / Staff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailHistory.map(tx => (
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
                                numVal(tx.quantity) >= 0
                                  ? 'text-teal-600 dark:text-teal-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }
                            >
                              {numVal(tx.quantity) > 0 ? '+' : ''}
                              {tx.quantity}
                            </span>
                          </td>
                          <td className="text-right font-mono text-[var(--muted)]">
                            {tx.unit_cost ? formatCurrency(tx.unit_cost) : '—'}
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
            )}

            <div className="flex justify-end pt-3 border-t border-[var(--line)]">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="btn-secondary btn-base sm:w-28"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* =====================================================
          STOCK ADJUSTMENT MODAL
      ====================================================== */}
      <Modal
        open={modal === 'adjust'}
        onClose={() => !adjusting && setModal(null)}
        title={
          adjustProduct
            ? `Adjust Stock: ${adjustProduct.name}`
            : 'Adjust Inventory Stock'
        }
        size="md"
      >
        {adjustProduct && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--muted)]">SKU: {adjustProduct.sku}</span>
                <span className="font-semibold text-[var(--ink)]">
                  Current Stock: {adjustProduct.current_stock ?? 0}{' '}
                  {adjustProduct.unit || 'pcs'}
                </span>
              </div>
            </div>

            {/* Adjustment Type Segment */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--ink-secondary)]">
                Adjustment Mode
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'add', label: 'Add Stock (+)' },
                  { key: 'deduct', label: 'Deduct / Damage (-)' },
                  { key: 'set', label: 'Set Exact Stock' },
                ].map(mode => (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => setAdjustMode(mode.key)}
                    className={`rounded-md border py-2 text-xs font-semibold transition ${
                      adjustMode === mode.key
                        ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                        : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <FormField
              label={
                adjustMode === 'set'
                  ? 'Target Exact Stock Level'
                  : 'Quantity to Adjust'
              }
              required
            >
              <input
                type="number"
                min={adjustMode === 'set' ? '0' : '0.01'}
                step="0.01"
                className="input font-mono text-base font-bold"
                value={adjustQty}
                onChange={e => setAdjustQty(e.target.value)}
                placeholder="1"
              />
            </FormField>

            {/* Preview of resulting stock */}
            <div className="rounded-md border border-[var(--line)] p-3 text-xs bg-[var(--surface)]">
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted)]">Resulting Stock:</span>
                <span className="font-mono text-sm font-bold text-[#1E3A5F] dark:text-slate-200">
                  {(() => {
                    const current = numVal(adjustProduct.current_stock)
                    const parsed = Number(adjustQty) || 0
                    if (adjustMode === 'add') return current + parsed
                    if (adjustMode === 'deduct')
                      return Math.max(0, current - parsed)
                    if (adjustMode === 'set') return Math.max(0, parsed)
                    return current
                  })()}{' '}
                  {adjustProduct.unit || 'pcs'}
                </span>
              </div>
            </div>

            <FormField label="Reason for Adjustment" required>
              <select
                className="input"
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
              >
                <option value="adjustment">Stock Count / Manual Adjustment</option>
                <option value="damage">Damaged Goods</option>
                <option value="audit">Physical Inventory Audit</option>
                <option value="loss">Loss / Expiry / Wastage</option>
                <option value="returned">Customer Return Received</option>
              </select>
            </FormField>

            <FormField label="Remarks / Notes" hint="Optional reference">
              <textarea
                className="input min-h-20 text-xs"
                value={adjustNotes}
                onChange={e => setAdjustNotes(e.target.value)}
                placeholder="e.g. Annual stock audit verification or damaged in transit..."
              />
            </FormField>

            <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={adjusting}
                className="btn-secondary btn-base sm:w-28"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitStockAdjustment}
                disabled={adjusting}
                className="btn-primary btn-base sm:w-36 flex items-center justify-center gap-2"
              >
                {adjusting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Updating...
                  </>
                ) : (
                  'Confirm Adjustment'
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* =====================================================
          BARCODE PRINTING MODAL
      ====================================================== */}
      <BarcodePrintModal
        open={modal === 'barcode'}
        onClose={() => setModal(null)}
        product={barcodeProduct}
      />

      {/* =====================================================
          IMPORT PRODUCTS CSV MODAL
      ====================================================== */}
      <Modal
        open={modal === 'import'}
        onClose={() => !importing && setModal(null)}
        title="Import Products via CSV"
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3 text-xs text-[var(--muted)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[var(--ink)]">
                  CSV Import Guide
                </p>
                <p className="mt-0.5">
                  Import new products or update existing products by SKU.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadSampleTemplate}
                className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 font-semibold text-[#1E3A5F]"
              >
                <FileSpreadsheet size={14} />
                Sample Template
              </button>
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-[var(--line)] bg-[var(--surface)] p-6 cursor-pointer hover:border-[#1E3A5F] transition"
          >
            <Upload size={28} className="text-[#1E3A5F] mb-2" />
            <p className="text-sm font-semibold text-[var(--ink)]">
              {importFile ? importFile.name : 'Click to select CSV file'}
            </p>
            <p className="text-xs text-[var(--muted-light)] mt-1">
              Supports standard UTF-8 CSV files up to 5MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSVUpload}
            />
          </div>

          {importPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-teal-600">
                  Ready to import: {importPreview.length} product(s)
                </span>
                {importErrors.length > 0 && (
                  <span className="text-rose-600 font-semibold">
                    {importErrors.length} warning(s)
                  </span>
                )}
              </div>

              <div className="max-h-52 overflow-y-auto rounded-xl border border-[var(--line)]">
                <table className="erp-table text-xs">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th className="text-right">Purchase</th>
                      <th className="text-right">Selling</th>
                      <th className="text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 10).map((row, idx) => (
                      <tr key={idx}>
                        <td className="font-medium text-[var(--ink)]">
                          {row.name}
                        </td>
                        <td className="font-mono">{row.sku}</td>
                        <td>{row.category || '—'}</td>
                        <td className="text-right font-mono">
                          {formatCurrency(row.purchase_price)}
                        </td>
                        <td className="text-right font-mono font-bold">
                          {formatCurrency(row.selling_price)}
                        </td>
                        <td className="text-right font-mono">
                          {row.current_stock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {importPreview.length > 10 && (
                <p className="text-[11px] text-[var(--muted-light)] text-center">
                  + {importPreview.length - 10} more products in file
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setModal(null)}
              disabled={importing}
              className="btn-secondary btn-base sm:w-28"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runCSVImport}
              disabled={importing || importPreview.length === 0}
              className="btn-primary btn-base sm:w-44 flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Importing...
                </>
              ) : (
                `Import ${importPreview.length} Products`
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* =====================================================
          DELETE CONFIRMATION DIALOG
      ====================================================== */}
      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={del}
        title="Delete Product"
        message="Are you sure you want to permanently delete this product? All historical transactions and catalog links will be preserved in audit logs."
        danger
        confirmLabel="Delete Product"
      />
    </div>
  )
}