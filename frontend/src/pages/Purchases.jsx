import { useState, useEffect } from 'react'
import api from '../api'
import { Badge, Card, PageHeader, Modal, Spinner, EmptyState, ConfirmDialog } from '../components/UI'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Printer, Package, ChevronDown, ChevronRight,
  Building2, Phone, Mail, MapPin, Edit2, Search, Save
} from 'lucide-react'

const fmt = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const emptyForm = {
  supplier: '', invoice_number: '',
  purchase_date: new Date().toISOString().slice(0, 10),
  payment_status: 'paid', paid_amount: 0, notes: '',
  items: [{ product: '', quantity: 1, purchase_price: '', gst_percent: 0, total: 0 }]
}
const emptySupplier = { name: '', phone: '', email: '', address: '', gstin: '' }

/* ── Print purchase order ── */
function printPO(purchase, suppliers) {
  const sup = suppliers.find(s => s.id === purchase.supplier) || {}
  const win = window.open('', '_blank')
  if (!win) return
  const rows = (purchase.items || []).map((it, i) => `
    <tr>
      <td>${i + 1}</td><td>${it.product_name || it.product}</td>
      <td style="text-align:right">${it.quantity}</td>
      <td style="text-align:right">₹${Number(it.purchase_price).toFixed(2)}</td>
      <td style="text-align:right">${it.gst_percent}%</td>
      <td style="text-align:right">₹${Number(it.total).toFixed(2)}</td>
    </tr>`).join('')
  win.document.write(`<!DOCTYPE html><html><head><title>PO-${purchase.id}</title>
  <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}
  h2{margin:0 0 4px}p{margin:2px 0;font-size:13px;color:#555}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{background:#1e40af;color:#fff;padding:8px;font-size:12px;text-align:left}
  td{padding:7px 8px;border-bottom:1px solid #e5e7eb;font-size:12px}
  .total{text-align:right;font-size:16px;font-weight:bold;margin-top:12px}
  .footer{margin-top:32px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px}
  @media print{button{display:none}}</style></head><body>
  <h2>Purchase Order — PO-${purchase.id}</h2>
  <p>Supplier: <b>${purchase.supplier_name || sup.name || '—'}</b></p>
  <p>Invoice No: ${purchase.invoice_number || '—'} &nbsp;|&nbsp; Date: ${purchase.purchase_date}</p>
  <p>Payment: ${purchase.payment_status?.toUpperCase()}</p>
  <table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Price</th><th>GST</th><th>Total</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div class="total">Grand Total: ₹${Number(purchase.total_amount).toFixed(2)}</div>
  <div class="footer">This is a computer generated purchase order.</div>
  <script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`)
  win.document.close()
}

/* ── Supplier Form Modal ── */
function SupplierModal({ open, onClose, initial, onSaved }) {
  const [form, setForm] = useState(emptySupplier)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setForm(initial ? { ...initial } : emptySupplier) }, [initial, open])
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
    } catch (e) { toast.error(e.response?.data?.name?.[0] || 'Failed to save supplier') }
    finally { setSaving(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Edit Supplier' : 'Add Supplier'} size="sm">
      <div className="space-y-3">
        <div><label className="label">Name *</label><input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
          <div><label className="label">Email</label><input className="input" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
        </div>
        <div><label className="label">Address</label><textarea className="input" rows={2} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
        <div><label className="label">GSTIN</label><input className="input" value={form.gstin} onChange={e => setForm(p => ({ ...p, gstin: e.target.value }))} /></div>
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving} className="btn-primary flex-1"><Save size={14} />{saving ? 'Saving…' : 'Save Supplier'}</button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </Modal>
  )
}

/* ── Supplier Card with products ── */
function SupplierCard({ supplier, products, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const supProducts = products.filter(p => p.supplier === supplier.id)
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Building2 size={18} className="text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">{supplier.name}</div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {supplier.phone && <span className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{supplier.phone}</span>}
              {supplier.email && <span className="text-xs text-gray-400 flex items-center gap-1"><Mail size={10} />{supplier.email}</span>}
              {supplier.gstin && <span className="text-xs text-gray-400">GST: {supplier.gstin}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {supplier.outstanding_amount > 0 && (
            <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-1 rounded-lg">Due: {fmt(supplier.outstanding_amount)}</span>
          )}
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{supProducts.length} products</span>
          <button onClick={() => onEdit(supplier)} className="icon-btn"><Edit2 size={14} /></button>
          <button onClick={() => onDelete(supplier)} className="icon-btn text-red-400"><Trash2 size={14} /></button>
          <button onClick={() => setExpanded(x => !x)} className="icon-btn">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          {supplier.address && <p className="text-xs text-gray-500 flex items-start gap-1 mb-2"><MapPin size={11} className="mt-0.5 flex-shrink-0" />{supplier.address}</p>}
          {supProducts.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No products linked to this supplier.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table text-xs">
                <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Purchase Price</th><th>Selling Price</th><th>Status</th></tr></thead>
                <tbody>
                  {supProducts.map(p => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td className="font-mono text-gray-500">{p.sku}</td>
                      <td className={p.current_stock <= 0 ? 'text-red-600 font-semibold' : p.current_stock <= p.minimum_stock ? 'text-orange-500 font-semibold' : 'text-green-600'}>{p.current_stock}</td>
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
      )}
    </div>
  )
}

export default function Purchases() {
  const [tab, setTab] = useState('orders')
  const [purchases, setPurchases] = useState([])
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [supModal, setSupModal] = useState(false)
  const [editSupplier, setEditSupplier] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [supSearch, setSupSearch] = useState('')
  const [poSearch, setPoSearch] = useState('')
  const [expandedPO, setExpandedPO] = useState(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/purchases/').then(r => setPurchases(r.data.results || r.data)),
      api.get('/products/?page_size=500').then(r => setProducts(r.data.results || r.data)),
      api.get('/suppliers/?page_size=200').then(r => setSuppliers(r.data.results || r.data)),
    ]).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const updateItem = (i, key, val) => {
    const items = [...form.items]
    items[i] = { ...items[i], [key]: val }
    if (['quantity', 'purchase_price', 'gst_percent'].includes(key)) {
      const qty = parseFloat(items[i].quantity) || 0
      const price = parseFloat(items[i].purchase_price) || 0
      const gst = parseFloat(items[i].gst_percent) || 0
      items[i].total = (qty * price * (1 + gst / 100)).toFixed(2)
    }
    // auto-fill purchase price from product
    if (key === 'product') {
      const prod = products.find(p => String(p.id) === String(val))
      if (prod) {
        items[i].purchase_price = prod.purchase_price
        items[i].gst_percent = prod.gst_percent || 0
        const qty = parseFloat(items[i].quantity) || 1
        items[i].total = (qty * parseFloat(prod.purchase_price) * (1 + parseFloat(prod.gst_percent || 0) / 100)).toFixed(2)
      }
    }
    setForm(p => ({ ...p, items }))
  }

  const grandTotal = form.items.reduce((s, i) => s + parseFloat(i.total || 0), 0)

  const save = async () => {
    if (!form.supplier) return toast.error('Select a supplier')
    if (form.items.some(i => !i.product || !i.purchase_price)) return toast.error('Fill all item details')
    setSaving(true)
    try {
      const payload = {
        ...form,
        paid_amount: form.payment_status === 'paid' ? grandTotal : parseFloat(form.paid_amount) || 0,
        items: form.items.map(i => ({
          product: parseInt(i.product),
          quantity: parseFloat(i.quantity),
          purchase_price: parseFloat(i.purchase_price),
          gst_percent: parseFloat(i.gst_percent),
          total: parseFloat(i.total),
        }))
      }
      await api.post('/purchases/', payload)
      toast.success('Purchase saved & stock updated')
      setModal(false); setForm(emptyForm); load()
    } catch (e) { toast.error(JSON.stringify(e.response?.data) || 'Error saving purchase') }
    finally { setSaving(false) }
  }

  const deleteSupplier = async () => {
    try {
      await api.delete(`/suppliers/${deleteConfirm.id}/`)
      toast.success('Supplier deleted')
      setSuppliers(s => s.filter(x => x.id !== deleteConfirm.id))
    } catch { toast.error('Cannot delete — supplier may have linked purchases') }
    finally { setDeleteConfirm(null) }
  }

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supSearch.toLowerCase()) ||
    (s.phone || '').includes(supSearch) ||
    (s.email || '').toLowerCase().includes(supSearch.toLowerCase())
  )
  const filteredPOs = purchases.filter(p =>
    (p.supplier_name || '').toLowerCase().includes(poSearch.toLowerCase()) ||
    (p.invoice_number || '').toLowerCase().includes(poSearch.toLowerCase())
  )

  // supplier products for the new PO form
  const supplierProducts = form.supplier
    ? products.filter(p => String(p.supplier) === String(form.supplier))
    : products

  return (
    <div className="space-y-4">
      <PageHeader title="Purchases" subtitle="Purchase orders, suppliers & stock-in"
        action={
          <div className="flex gap-2">
            <button onClick={() => { setEditSupplier(null); setSupModal(true) }} className="btn-secondary flex items-center gap-2 text-sm">
              <Building2 size={15} /> Add Supplier
            </button>
            <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> New Purchase
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {[['orders', 'Purchase Orders'], ['suppliers', `Suppliers (${suppliers.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* ── Purchase Orders Tab ── */}
          {tab === 'orders' && (
            <div className="space-y-3">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="input pl-9 text-sm" placeholder="Search by supplier or invoice number…"
                  value={poSearch} onChange={e => setPoSearch(e.target.value)} />
              </div>
              {filteredPOs.length === 0 ? <EmptyState message="No purchase orders yet" /> : (
                <Card>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr><th>PO #</th><th>Supplier</th><th>Invoice</th><th>Date</th><th>Total</th><th>Paid</th><th>Status</th><th>Actions</th></tr>
                      </thead>
                      <tbody>
                        {filteredPOs.map(p => (
                          <>
                            <tr key={p.id} className="cursor-pointer hover:bg-blue-50" onClick={() => setExpandedPO(expandedPO === p.id ? null : p.id)}>
                              <td className="font-mono text-blue-600 font-medium">PO-{p.id}</td>
                              <td className="font-medium">{p.supplier_name || '—'}</td>
                              <td className="text-sm text-gray-500">{p.invoice_number || '—'}</td>
                              <td className="text-sm">{p.purchase_date}</td>
                              <td className="font-semibold">{fmt(p.total_amount)}</td>
                              <td className="text-sm">{fmt(p.paid_amount)}</td>
                              <td><Badge status={p.payment_status} /></td>
                              <td>
                                <button onClick={e => { e.stopPropagation(); printPO(p, suppliers) }}
                                  className="icon-btn" title="Print PO"><Printer size={15} /></button>
                              </td>
                            </tr>
                            {expandedPO === p.id && (
                              <tr key={`${p.id}-detail`}>
                                <td colSpan={8} className="bg-blue-50 px-4 py-3">
                                  <div className="text-xs font-semibold text-gray-500 mb-2">Items in PO-{p.id}</div>
                                  <table className="table text-xs bg-white rounded-lg overflow-hidden">
                                    <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Price</th><th>GST</th><th>Total</th></tr></thead>
                                    <tbody>
                                      {(p.items || []).map((it, idx) => (
                                        <tr key={idx}>
                                          <td>{idx + 1}</td>
                                          <td className="font-medium">{it.product_name}</td>
                                          <td>{it.quantity}</td>
                                          <td>{fmt(it.purchase_price)}</td>
                                          <td>{it.gst_percent}%</td>
                                          <td className="font-semibold">{fmt(it.total)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {p.notes && <p className="text-xs text-gray-500 mt-2">Notes: {p.notes}</p>}
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ── Suppliers Tab ── */}
          {tab === 'suppliers' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="input pl-9 text-sm" placeholder="Search suppliers…"
                    value={supSearch} onChange={e => setSupSearch(e.target.value)} />
                </div>
                <button onClick={() => { setEditSupplier(null); setSupModal(true) }} className="btn-primary flex items-center gap-2 text-sm">
                  <Plus size={14} /> Add Supplier
                </button>
              </div>
              {filteredSuppliers.length === 0 ? <EmptyState message="No suppliers found" /> : (
                <div className="space-y-3">
                  {filteredSuppliers.map(s => (
                    <SupplierCard key={s.id} supplier={s} products={products}
                      onEdit={sup => { setEditSupplier(sup); setSupModal(true) }}
                      onDelete={sup => setDeleteConfirm(sup)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── New Purchase Modal ── */}
      <Modal open={modal} onClose={() => { setModal(false); setForm(emptyForm) }} title="New Purchase Order" size="xl">
        <div className="space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="label">Supplier *</label>
              <div className="flex gap-2">
                <select className="input flex-1" value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}>
                  <option value="">Select supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={() => { setEditSupplier(null); setSupModal(true) }} className="btn-secondary px-2" title="Add new supplier">
                  <Plus size={14} />
                </button>
              </div>
            </div>
            <div>
              <label className="label">Invoice No.</label>
              <input className="input" value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="Supplier's invoice #" />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.purchase_date} onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Payment</label>
              <select className="input" value={form.payment_status} onChange={e => setForm(p => ({ ...p, payment_status: e.target.value }))}>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
              </select>
            </div>
          </div>

          {form.payment_status === 'partial' && (
            <div className="max-w-xs">
              <label className="label">Paid Amount</label>
              <input type="number" className="input" value={form.paid_amount} onChange={e => setForm(p => ({ ...p, paid_amount: e.target.value }))} />
            </div>
          )}

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-gray-700">Items</span>
              <button onClick={() => setForm(p => ({ ...p, items: [...p.items, { product: '', quantity: 1, purchase_price: '', gst_percent: 0, total: 0 }] }))}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                <Plus size={13} /> Add Item
              </button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="table">
                <thead>
                  <tr><th>Product</th><th>Qty</th><th>Purchase Price</th><th>GST%</th><th>Total</th><th></th></tr>
                </thead>
                <tbody>
                  {form.items.map((item, i) => (
                    <tr key={i}>
                      <td className="min-w-48">
                        <select className="input text-sm" value={item.product} onChange={e => updateItem(i, 'product', e.target.value)}>
                          <option value="">Select product</option>
                          {(form.supplier && supplierProducts.length > 0 ? supplierProducts : products).map(p => (
                            <option key={p.id} value={p.id}>{p.name} (Stock: {p.current_stock})</option>
                          ))}
                        </select>
                      </td>
                      <td><input type="number" className="input text-sm w-20" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} /></td>
                      <td><input type="number" className="input text-sm w-28" min="0" step="0.01" value={item.purchase_price} onChange={e => updateItem(i, 'purchase_price', e.target.value)} /></td>
                      <td>
                        <select className="input text-sm w-20" value={item.gst_percent} onChange={e => updateItem(i, 'gst_percent', e.target.value)}>
                          {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                        </select>
                      </td>
                      <td className="font-semibold text-sm text-green-700">₹{item.total}</td>
                      <td>
                        <button onClick={() => setForm(p => ({ ...p, items: p.items.filter((_, j) => j !== i) }))}
                          className="text-red-400 hover:text-red-600 p-1" disabled={form.items.length === 1}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes + Total */}
          <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
            <div className="flex-1">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes…" />
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-right min-w-48">
              <div className="text-xs text-gray-500 mb-1">Grand Total</div>
              <div className="text-2xl font-bold text-blue-700">₹{grandTotal.toFixed(2)}</div>
              <div className="text-xs text-gray-400 mt-1">{form.items.length} item{form.items.length !== 1 ? 's' : ''}</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="btn-primary flex-1 h-11">
              <Package size={16} />{saving ? 'Saving…' : 'Save Purchase & Update Stock'}
            </button>
            <button onClick={() => { setModal(false); setForm(emptyForm) }} className="btn-secondary px-6">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Supplier Add/Edit Modal */}
      <SupplierModal
        open={supModal}
        onClose={() => setSupModal(false)}
        initial={editSupplier}
        onSaved={saved => {
          setSuppliers(prev => {
            const exists = prev.find(s => s.id === saved.id)
            return exists ? prev.map(s => s.id === saved.id ? saved : s) : [...prev, saved]
          })
          // auto-select in form if adding new
          if (!editSupplier) setForm(p => ({ ...p, supplier: String(saved.id) }))
        }}
      />

      {/* Delete Supplier Confirm */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={deleteSupplier}
        title="Delete Supplier"
        message={`Delete "${deleteConfirm?.name}"? This cannot be undone. Existing purchases will not be affected.`}
        danger
      />
    </div>
  )
}
