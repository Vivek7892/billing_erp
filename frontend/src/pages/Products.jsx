import { useState, useEffect } from 'react'
import api from '../api'
import { Badge, Card, PageHeader, Modal, ConfirmDialog, Spinner, EmptyState } from '../components/UI'
import toast from 'react-hot-toast'
import { Plus, Search, Edit2, Trash2, Eye } from 'lucide-react'

const UNITS = ['pcs', 'kg', 'g', 'L', 'ml', 'box', 'pack', 'dozen', 'pair']

const emptyForm = {
  name: '', sku: '', barcode: '', category: '', brand: '', unit: 'pcs',
  hsn_code: '', mrp: '', purchase_price: '', selling_price: '', gst_percent: '0',
  current_stock: '0', minimum_stock: '5', supplier: '', status: 'active'
}

export default function Products() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [modal, setModal] = useState(null) // null | 'add' | 'edit' | 'view'
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams({ page })
    if (search) params.set('search', search)
    if (catFilter) params.set('category', catFilter)
    api.get(`/products/?${params}`).then(r => {
      setProducts(r.data.results || r.data)
      setCount(r.data.count || 0)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search, catFilter, page])
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

  const save = async () => {
    try {
      const payload = { ...form }
      if (!payload.category) delete payload.category
      if (!payload.supplier) delete payload.supplier
      if (editId) {
        await api.patch(`/products/${editId}/`, payload)
        toast.success('Product updated')
      } else {
        await api.post('/products/', payload)
        toast.success('Product added')
      }
      setModal(null); load()
    } catch (e) {
      toast.error(JSON.stringify(e.response?.data) || 'Error')
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
      <PageHeader title="Products" subtitle={`${count} products`}
        action={<button onClick={openAdd} className="btn-primary flex items-center gap-2"><Plus size={16} />Add Product</button>} />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input pl-8 text-sm" placeholder="Search name, SKU, barcode..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
          </div>
          <select className="input w-44 text-sm" value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1) }}>
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
                <tr><th>Product</th><th>SKU</th><th>Category</th><th>Purchase</th><th>Selling</th><th>GST</th><th>Stock</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-medium">{p.name}</div>
                      {p.brand && <div className="text-xs text-gray-400">{p.brand}</div>}
                    </td>
                    <td className="font-mono text-sm">{p.sku}</td>
                    <td className="text-sm">{p.category_name || '—'}</td>
                    <td className="text-sm">₹{p.purchase_price}</td>
                    <td className="font-semibold text-sm">₹{p.selling_price}</td>
                    <td className="text-sm">{p.gst_percent}%</td>
                    <td>
                      <span className={`font-semibold text-sm ${p.current_stock <= 0 ? 'text-red-600' : p.current_stock <= p.minimum_stock ? 'text-yellow-600' : 'text-green-600'}`}>
                        {p.current_stock} {p.unit}
                      </span>
                    </td>
                    <td><Badge status={p.stock_status} /></td>
                    <td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(p)} className="icon-btn"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteId(p.id)} className="icon-btn text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {count > 50 && (
          <div className="flex justify-center gap-2 p-4">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm">Prev</button>
            <span className="text-sm text-gray-500 py-2">Page {page} of {Math.ceil(count / 50)}</span>
            <button disabled={products.length < 50} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm">Next</button>
          </div>
        )}
      </Card>

      <Modal open={modal === 'add' || modal === 'edit'} onClose={() => setModal(null)}
        title={editId ? 'Edit Product' : 'Add Product'} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Product Name *</label>
            <input className="input" value={form.name} onChange={e => f('name', e.target.value)} /></div>
          <div><label className="label">SKU *</label>
            <input className="input" value={form.sku} onChange={e => f('sku', e.target.value)} /></div>
          <div><label className="label">Barcode</label>
            <input className="input" value={form.barcode} onChange={e => f('barcode', e.target.value)} /></div>
          <div><label className="label">Category</label>
            <select className="input" value={form.category} onChange={e => f('category', e.target.value)}>
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div><label className="label">Brand</label>
            <input className="input" value={form.brand} onChange={e => f('brand', e.target.value)} /></div>
          <div><label className="label">HSN Code</label>
            <input className="input" value={form.hsn_code} onChange={e => f('hsn_code', e.target.value)} /></div>
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
          <button onClick={save} className="btn-primary flex-1">Save Product</button>
          <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={del}
        title="Delete Product" message="This will permanently delete the product." danger />
    </div>
  )
}
