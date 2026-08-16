import { useEffect, useState } from 'react'
import api from '../api'
import { Badge, Spinner, Modal } from '../components/UI'
import {
  Building2, Plus, Search, RefreshCw, Pencil, Trash2,
  Phone, Mail, MapPin, ChevronDown, ChevronRight, Package,
  IndianRupee, Save, X
} from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const EMPTY = { name: '', phone: '', email: '', address: '', gstin: '' }

function SupplierForm({ initial, onSaved, onClose }) {
  const [form, setForm] = useState(initial ? { ...initial } : EMPTY)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.name.trim()) return toast.error('Supplier name is required')
    setSaving(true)
    try {
      const res = initial?.id
        ? await api.put(`/suppliers/${initial.id}/`, form)
        : await api.post('/suppliers/', form)
      toast.success(initial?.id ? 'Supplier updated' : 'Supplier added')
      onSaved(res.data)
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.name?.[0] || e.response?.data?.detail || 'Failed to save supplier')
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Name *</label>
        <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus placeholder="Supplier company name" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="Mobile / landline" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
        </div>
      </div>
      <div>
        <label className="label">Address</label>
        <textarea className="input" rows={2} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="Full address" />
      </div>
      <div>
        <label className="label">GSTIN</label>
        <input className="input" value={form.gstin} onChange={e => setForm(p => ({ ...p, gstin: e.target.value }))} placeholder="22AAAAA0000A1Z5" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={save} disabled={saving} className="btn-primary flex-1 flex items-center gap-2">
          <Save size={14} />{saving ? 'Saving…' : initial?.id ? 'Update Supplier' : 'Add Supplier'}
        </button>
        <button onClick={onClose} className="btn-secondary px-4"><X size={14} /></button>
      </div>
    </div>
  )
}

function SupplierCard({ supplier, products, onEdit, onDelete, onRefresh }) {
  const [expanded, setExpanded] = useState(false)
  const [payModal, setPayModal] = useState(false)
  const [payAmt, setPayAmt] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [paying, setPaying] = useState(false)

  const supProducts = products.filter(p => p.supplier === supplier.id)

  const recordPayment = async () => {
    const amt = parseFloat(payAmt)
    if (!amt || amt <= 0) return toast.error('Enter a valid amount')
    setPaying(true)
    try {
      await api.post('/supplier-payments/', {
        supplier: supplier.id,
        amount: amt,
        method: payMethod,
      })
      // reduce outstanding locally
      await api.patch(`/suppliers/${supplier.id}/`, {
        outstanding_amount: Math.max(0, Number(supplier.outstanding_amount) - amt)
      })
      toast.success('Payment recorded')
      setPayModal(false)
      setPayAmt('')
      onRefresh()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to record payment')
    } finally { setPaying(false) }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Building2 size={20} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate text-sm">{supplier.name}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {supplier.phone && <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{supplier.phone}</span>}
              {supplier.email && <span className="text-xs text-gray-400 flex items-center gap-1"><Mail size={10} />{supplier.email}</span>}
              {supplier.gstin && <span className="text-xs text-gray-400">GST: {supplier.gstin}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {Number(supplier.outstanding_amount) > 0 && (
            <button onClick={() => setPayModal(true)}
              className="text-xs bg-red-50 text-red-600 font-semibold px-2.5 py-1 rounded-lg border border-red-100 hover:bg-red-100 transition-colors">
              Due: {fmt(supplier.outstanding_amount)}
            </button>
          )}
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg flex items-center gap-1">
            <Package size={11} />{supProducts.length}
          </span>
          <button onClick={() => onEdit(supplier)} className="icon-btn" title="Edit"><Pencil size={14} /></button>
          <button onClick={() => onDelete(supplier)} className="icon-btn text-red-400 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 size={14} /></button>
          <button onClick={() => setExpanded(x => !x)} className="icon-btn">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 space-y-3">
          {supplier.address && (
            <p className="text-xs text-gray-500 flex items-start gap-1.5">
              <MapPin size={11} className="mt-0.5 flex-shrink-0 text-gray-400" />{supplier.address}
            </p>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Linked Products ({supProducts.length})</p>
            {supProducts.length === 0 ? (
              <p className="text-xs text-gray-400">No products linked to this supplier.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="table text-xs">
                  <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Purchase Price</th><th>Selling Price</th><th>Status</th></tr></thead>
                  <tbody>
                    {supProducts.map(p => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.name}</td>
                        <td className="font-mono text-gray-500">{p.sku}</td>
                        <td className={Number(p.current_stock) <= 0 ? 'text-red-600 font-semibold' : Number(p.current_stock) <= Number(p.minimum_stock) ? 'text-orange-500 font-semibold' : 'text-green-600 font-semibold'}>{p.current_stock}</td>
                        <td>{fmt(p.purchase_price)}</td>
                        <td>{fmt(p.selling_price)}</td>
                        <td><Badge status={p.stock_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pay outstanding modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title={`Record Payment — ${supplier.name}`} size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
            <div className="text-xs text-red-500 font-semibold uppercase tracking-wide">Outstanding Balance</div>
            <div className="text-2xl font-bold text-red-600 mt-1">{fmt(supplier.outstanding_amount)}</div>
          </div>
          <div>
            <label className="label">Amount Paid (₹) *</label>
            <input className="input" type="number" min="0.01" step="0.01" value={payAmt}
              onChange={e => setPayAmt(e.target.value)} placeholder="0.00" autoFocus />
          </div>
          <div>
            <label className="label">Payment Method</label>
            <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
              {['cash', 'upi', 'card', 'online'].map(m => <option key={m} value={m} className="capitalize">{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPayModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={recordPayment} disabled={paying} className="btn-primary flex-1">
              <IndianRupee size={14} />{paying ? 'Saving…' : 'Record Payment'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/suppliers/?page_size=500'),
      api.get('/products/?page_size=1000'),
    ]).then(([sr, pr]) => {
      setSuppliers(sr.data?.results || sr.data || [])
      setProducts(pr.data?.results || pr.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditing(null); setModal(true) }
  const openEdit = s => { setEditing(s); setModal(true) }

  const onSaved = saved => {
    setSuppliers(prev => {
      const exists = prev.find(s => s.id === saved.id)
      return exists ? prev.map(s => s.id === saved.id ? saved : s) : [...prev, saved]
    })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/suppliers/${deleteTarget.id}/`)
      toast.success('Supplier deleted')
      setSuppliers(prev => prev.filter(s => s.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      toast.error('Cannot delete — supplier may have linked purchases')
    } finally { setDeleting(false) }
  }

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    (s.phone || '').includes(q) ||
    (s.email || '').toLowerCase().includes(q.toLowerCase())
  )

  const totalOutstanding = suppliers.reduce((s, x) => s + Number(x.outstanding_amount || 0), 0)

  return (
    <div className="space-y-5">

      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-blue-100 p-4 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Total Suppliers</span>
          <div className="text-2xl font-bold text-blue-600">{suppliers.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-red-100 p-4 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Total Outstanding</span>
          <div className="text-2xl font-bold text-red-600">{fmt(totalOutstanding)}</div>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-4 flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Products Supplied</span>
          <div className="text-2xl font-bold text-green-600">{products.filter(p => p.supplier).length}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 flex-1 max-w-sm">
          <Search size={14} className="text-slate-400 flex-shrink-0" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search suppliers…"
            className="bg-transparent text-sm outline-none w-full text-slate-700 placeholder-slate-400" />
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 transition-colors">
            <RefreshCw size={14} />
          </button>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Add Supplier
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
          <Building2 size={40} className="opacity-30" />
          <p className="text-sm">{q ? 'No suppliers match your search' : 'No suppliers yet'}</p>
          {!q && <button onClick={openAdd} className="btn-primary text-sm">Add First Supplier</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <SupplierCard key={s.id} supplier={s} products={products}
              onEdit={openEdit}
              onDelete={sup => setDeleteTarget(sup)}
              onRefresh={load}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'} size="sm">
        <SupplierForm initial={editing} onSaved={onSaved} onClose={() => setModal(false)} />
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Supplier" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Delete <span className="font-semibold">"{deleteTarget?.name}"</span>? This cannot be undone. Existing purchases will not be affected.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={confirmDelete} disabled={deleting} className="btn-danger flex-1">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
