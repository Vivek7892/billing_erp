import { useState, useEffect, useCallback, useRef } from 'react'
import api, { API_BASE_URL } from '../api'
import { Badge, Card, PageHeader, Modal, ConfirmDialog, Spinner, EmptyState } from '../components/UI'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, Barcode } from 'lucide-react'

const UNITS = ['pcs', 'kg', 'g', 'L', 'ml', 'box', 'pack', 'dozen', 'pair']

const emptyForm = {
  name: '', sku: '', barcode: '', category: '', brand: '', unit: 'pcs',
  hsn_code: '', mrp: '', purchase_price: '', selling_price: '', gst_percent: '0',
  current_stock: '0', minimum_stock: '5', supplier: '', status: 'active'
}

// Auto-generate a barcode from product id + timestamp when barcode is blank
function autoBarcode(productId) {
  return String(productId).padStart(12, '0').slice(-12)
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [modal, setModal] = useState(null) // null | 'add' | 'edit' | 'barcode'
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [count, setCount] = useState(0)
  const [barcodeProduct, setBarcodeProduct] = useState(null)
  const [barcodeCopies, setBarcodeCopies] = useState(1)

  const load = useCallback((q, cat) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('search', q)
    if (cat) params.set('category', cat)
    api.get(`/products/?${params}`).then(r => {
      const data = r.data.results || r.data
      setProducts(Array.isArray(data) ? data : [])
      setCount(r.data.count || (Array.isArray(data) ? data.length : 0))
    }).catch(() => toast.error('Failed to load products')).finally(() => setLoading(false))
  }, [])

  const debounceRef = useRef(null)
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(search, catFilter), search ? 400 : 0)
    return () => clearTimeout(debounceRef.current)
  }, [search, catFilter, load])
  useEffect(() => {
    api.get('/categories/?page_size=100').then(r => setCategories(r.data.results || r.data))
    api.get('/suppliers/?page_size=100').then(r => setSuppliers(r.data.results || r.data))
  }, [])

  const openAdd = () => { setForm(emptyForm); setEditId(null); setModal('add') }
  const openEdit = p => {
    setForm({
      name: p.name, sku: p.sku, barcode: p.barcode || '', category: p.category || '',
      brand: p.brand || '', unit: p.unit, hsn_code: p.hsn_code || '', mrp: p.mrp || '',
      purchase_price: p.purchase_price, selling_price: p.selling_price, gst_percent: p.gst_percent,
      current_stock: p.current_stock, minimum_stock: p.minimum_stock,
      supplier: p.supplier || '', status: p.status
    })
    setEditId(p.id); setModal('edit')
  }

  const openBarcode = p => { setBarcodeProduct(p); setBarcodeCopies(1); setModal('barcode') }

  const printBarcodeLabel = () => {
    const token = localStorage.getItem('access_token') || ''
    const url = `${API_BASE_URL}/products/${barcodeProduct.id}/barcode-label/?copies=${barcodeCopies}&token=${token}`
    window.open(url, '_blank')
    setModal(null)
  }

  const save = async () => {
    try {
      const payload = { ...form }
      if (!payload.category) delete payload.category
      if (!payload.supplier) delete payload.supplier
      let saved
      if (editId) {
        const r = await api.patch(`/products/${editId}/`, payload)
        saved = r.data
        toast.success('Product updated')
      } else {
        const r = await api.post('/products/', payload)
        saved = r.data
        // Auto-assign barcode from product id if none provided
        if (!saved.barcode && saved.id) {
          const bc = autoBarcode(saved.id)
          await api.patch(`/products/${saved.id}/`, { barcode: bc })
        }
        toast.success('Product added')
      }
      setModal(null); load()
    } catch (e) {
      toast.error(e.response?.data?.detail || e.response?.data?.name?.[0] || 'Failed to save product')
    }
  }

  const del = async () => {
    try {
      await api.delete(`/products/${deleteId}/`)
      toast.success('Product deleted'); load()
    } catch { toast.error('Failed to delete') }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        subtitle={`${count} product${count !== 1 ? 's' : ''}`}
        action={
          <button onClick={openAdd} className="btn-primary btn-base flex items-center gap-2">
            <Plus size={16} />Add Product
          </button>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              className="input pl-9 text-sm"
              placeholder="Search name, SKU, barcode..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input w-44 text-sm"
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        {loading ? <Spinner /> : products.length === 0 ? <EmptyState message="No products found" /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th><th>SKU</th><th>Category</th>
                  <th>Purchase</th><th>Selling</th><th>GST</th>
                  <th>Stock</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-semibold text-[var(--ink)]">{p.name}</div>
                      {p.brand && <div className="text-xs text-[var(--muted)] mt-0.5">{p.brand}</div>}
                    </td>
                    <td className="font-mono text-xs text-[var(--muted)]">{p.sku}</td>
                    <td className="text-sm">{p.category_name || '—'}</td>
                    <td className="text-sm">₹{p.purchase_price}</td>
                    <td className="font-semibold text-sm text-[var(--ink)]">₹{p.selling_price}</td>
                    <td>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--surface-elevated)] text-xs font-semibold text-[var(--muted)] border border-[var(--line)]">
                        {p.gst_percent}%
                      </span>
                    </td>
                    <td>
                      <span className={`font-bold text-sm ${
                        p.current_stock <= 0
                          ? 'text-[var(--danger)]'
                          : p.current_stock <= p.minimum_stock
                          ? 'text-[var(--warning)]'
                          : 'text-[var(--success)]'
                      }`}>
                        {p.current_stock} <span className="font-normal text-xs text-[var(--muted)]">{p.unit}</span>
                      </span>
                    </td>
                    <td><Badge status={p.stock_status} /></td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(p)} className="icon-btn" title="Edit product"><Edit2 size={14} /></button>
                        <button onClick={() => openBarcode(p)} className="icon-btn" title="Print barcode label"><Barcode size={14} /></button>
                        <button onClick={() => setDeleteId(p.id)} className="icon-btn danger" title="Delete product"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {count > 0 && (
          <div className="px-4 py-2.5 text-xs text-[var(--muted)] border-t border-[var(--line)]">
            {count} product{count !== 1 ? 's' : ''} total
          </div>
        )}
      </Card>

      <Modal open={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)}
        title={editId ? 'Edit Product' : 'Add Product'} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-1 sm:col-span-2">
            <label className="label">Product Name *</label>
            <input className="input" value={form.name} onChange={e => f('name', e.target.value)} />
          </div>
          <div><label className="label">SKU *</label>
            <input className="input" value={form.sku} onChange={e => f('sku', e.target.value)} /></div>
          <div>
            <label className="label">
              Barcode
              <span className="ml-1 text-[var(--muted)] font-normal text-xs">(auto-assigned if blank)</span>
            </label>
            <input className="input" value={form.barcode} onChange={e => f('barcode', e.target.value)} placeholder="Leave blank to auto-assign" />
          </div>
          <div><label className="label">Category</label>
            <select className="input" value={form.category} onChange={e => f('category', e.target.value)}>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="label">Brand</label>
            <input className="input" value={form.brand} onChange={e => f('brand', e.target.value)} /></div>
          <div>
            <label className="label">
              HSN Code
              <span className="ml-1 text-[var(--muted)] font-normal text-xs">(GST classification)</span>
            </label>
            <input className="input" value={form.hsn_code} onChange={e => f('hsn_code', e.target.value)} placeholder="e.g. 1905" />
          </div>
          <div><label className="label">MRP</label>
            <input type="number" className="input" value={form.mrp} onChange={e => f('mrp', e.target.value)} /></div>
          <div><label className="label">Unit</label>
            <select className="input" value={form.unit} onChange={e => f('unit', e.target.value)}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select></div>
          <div><label className="label">Supplier</label>
            <select className="input" value={form.supplier} onChange={e => f('supplier', e.target.value)}>
              <option value="">Select supplier</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>
          <div><label className="label">Purchase Price *</label>
            <input type="number" className="input" value={form.purchase_price} onChange={e => f('purchase_price', e.target.value)} /></div>
          <div><label className="label">Selling Price *</label>
            <input type="number" className="input" value={form.selling_price} onChange={e => f('selling_price', e.target.value)} /></div>
          <div><label className="label">GST %</label>
            <select className="input" value={form.gst_percent} onChange={e => f('gst_percent', e.target.value)}>
              {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
            </select></div>
          <div><label className="label">Current Stock</label>
            <input type="number" className="input" value={form.current_stock} onChange={e => f('current_stock', e.target.value)} /></div>
          <div><label className="label">Minimum Stock</label>
            <input type="number" className="input" value={form.minimum_stock} onChange={e => f('minimum_stock', e.target.value)} /></div>
          <div><label className="label">Status</label>
            <select className="input" value={form.status} onChange={e => f('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select></div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={save} className="btn-primary btn-base flex-1">Save Product</button>
          <button onClick={() => setModal(null)} className="btn-secondary btn-base flex-1">Cancel</button>
        </div>
      </Modal>

      {/* Barcode label print modal */}
      <Modal open={modal === 'barcode'} onClose={() => setModal(null)} title="Print Barcode Labels">
        {barcodeProduct && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 text-sm space-y-1">
              <div className="font-semibold text-[var(--ink)]">{barcodeProduct.name}</div>
              <div className="text-[var(--muted)] font-mono text-xs">
                {barcodeProduct.barcode || barcodeProduct.sku}
              </div>
              <div className="text-[var(--muted)] text-xs">
                SKU: {barcodeProduct.sku} · ₹{barcodeProduct.selling_price}
                {barcodeProduct.hsn_code && ` · HSN: ${barcodeProduct.hsn_code}`}
              </div>
            </div>
            <div>
              <label className="label">Number of labels</label>
              <input
                type="number"
                min={1}
                max={100}
                className="input w-32"
                value={barcodeCopies}
                onChange={e => setBarcodeCopies(Math.max(1, Math.min(100, Number(e.target.value))))}
              />
              <p className="text-xs text-[var(--muted)] mt-1">Prints on A4 (2 × 5 grid, 10 labels per page)</p>
            </div>
            <div className="flex gap-3">
              <button onClick={printBarcodeLabel} className="btn-primary btn-base flex-1 flex items-center justify-center gap-2">
                <Barcode size={15} /> Print / Download PDF
              </button>
              <button onClick={() => setModal(null)} className="btn-secondary btn-base flex-1">Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={del}
        title="Delete Product" message="This will permanently delete the product." danger />
    </div>
  )
}
