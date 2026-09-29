import { useEffect, useState } from 'react'
import api from '../api'
import { Badge, Spinner, Modal } from '../components/UI'
import {
  Building2, Plus, Search, RefreshCw, Pencil, Trash2,
  Phone, Mail, MapPin, ChevronDown, ChevronRight, Package,
  IndianRupee, Save, X, CreditCard
} from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = v => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtInt = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
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
    <div className="space-y-3.5">
      <div>
        <label className="label">Company / Supplier Name *</label>
        <input
          className="input"
          value={form.name}
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          autoFocus
          placeholder="e.g. Balaji Traders Pvt Ltd"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Phone / Mobile</label>
          <input
            className="input"
            value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            placeholder="Mobile / Landline"
          />
        </div>
        <div>
          <label className="label">Email Address</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            placeholder="supplier@example.com"
          />
        </div>
      </div>
      <div>
        <label className="label">Business Address</label>
        <textarea
          className="input"
          rows={2}
          value={form.address}
          onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
          placeholder="Shop / warehouse address"
        />
      </div>
      <div>
        <label className="label">GSTIN (Optional)</label>
        <input
          className="input font-mono uppercase"
          value={form.gstin}
          onChange={e => setForm(p => ({ ...p, gstin: e.target.value.toUpperCase() }))}
          placeholder="22AAAAA0000A1Z5"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          <Save size={14} />
          <span>{saving ? 'Saving…' : initial?.id ? 'Update Supplier' : 'Save Supplier'}</span>
        </button>
        <button onClick={onClose} className="btn-secondary px-4">
          <X size={14} />
        </button>
      </div>
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

  // Expanded rows to see linked products
  const [expandedIds, setExpandedIds] = useState(new Set())

  // Pay Modal
  const [payTarget, setPayTarget] = useState(null)
  const [payAmt, setPayAmt] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [paying, setPaying] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.get('/suppliers/?page_size=500'),
      api.get('/products/?page_size=1000'),
    ])
      .then(([sr, pr]) => {
        setSuppliers(sr.data?.results || sr.data || [])
        setProducts(pr.data?.results || pr.data || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const openAdd = () => { setEditing(null); setModal(true) }
  const openEdit = s => { setEditing(s); setModal(true) }

  const toggleExpand = id => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const onSaved = saved => {
    setSuppliers(prev => {
      const exists = prev.find(s => s.id === saved.id)
      return exists ? prev.map(s => (s.id === saved.id ? saved : s)) : [...prev, saved]
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
      toast.error('Cannot delete — supplier may have linked purchases or records')
    } finally {
      setDeleting(false)
    }
  }

  const recordPayment = async () => {
    if (!payTarget) return
    const amt = parseFloat(payAmt)
    if (!amt || amt <= 0) return toast.error('Enter a valid payment amount')
    setPaying(true)
    try {
      await api.post('/supplier-payments/', {
        supplier: payTarget.id,
        amount: amt,
        method: payMethod,
      })
      // update outstanding locally
      await api.patch(`/suppliers/${payTarget.id}/`, {
        outstanding_amount: Math.max(0, Number(payTarget.outstanding_amount || 0) - amt),
      })
      toast.success('Payment recorded successfully')
      setPayTarget(null)
      setPayAmt('')
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to record payment')
    } finally {
      setPaying(false)
    }
  }

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    (s.phone || '').includes(q) ||
    (s.email || '').toLowerCase().includes(q.toLowerCase()) ||
    (s.gstin || '').toLowerCase().includes(q.toLowerCase())
  )

  const totalOutstanding = suppliers.reduce(
    (sum, x) => sum + Number(x.outstanding_amount || 0),
    0
  )

  const suppliedProductCount = products.filter(p => p.supplier).length

  return (
    <div className="suppliers-page min-w-0 space-y-4 pb-6">
      {/* -------------------------------------------------------------
          PAGE HEADER
      -------------------------------------------------------------- */}
      <header className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[var(--ink)]">
              Suppliers Directory
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              Manage vendor accounts, ledger balances, and purchase relationships
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="btn-secondary h-9 text-xs px-3" title="Refresh">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={openAdd} className="btn-primary h-9 text-xs px-4 flex items-center gap-1.5">
              <Plus size={15} />
              <span>Add Supplier</span>
            </button>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------
          ERP METRICS BAR (Replaces Floating Cards)
      -------------------------------------------------------------- */}
      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
          Supplier Summary
        </div>
        <div className="grid grid-cols-1 divide-y divide-[var(--line)] sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
          <div className="p-3.5 sm:p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Total Suppliers
            </span>
            <p className="mt-1 text-xl font-bold font-mono text-[var(--ink)]">
              {suppliers.length}
            </p>
            <p className="text-[11px] text-[var(--muted)]">Active business vendors</p>
          </div>

          <div className="p-3.5 sm:p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Total Outstanding Due
            </span>
            <p className="mt-1 text-xl font-bold font-mono text-red-600">
              {fmt(totalOutstanding)}
            </p>
            <p className="text-[11px] text-[var(--muted)]">Payable balance across suppliers</p>
          </div>

          <div className="p-3.5 sm:p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Supplied Catalog Items
            </span>
            <p className="mt-1 text-xl font-bold font-mono text-blue-600">
              {suppliedProductCount}
            </p>
            <p className="text-[11px] text-[var(--muted)]">Linked inventory products</p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------
          SEARCH TOOLBAR
      -------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-[var(--surface)] border border-[var(--line)] rounded-lg px-3 py-1.5 flex-1 w-full sm:max-w-md">
          <Search size={14} className="text-[var(--muted-light)] flex-shrink-0" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search suppliers by name, phone, email, GSTIN..."
            className="bg-transparent text-xs outline-none w-full text-[var(--ink)] placeholder:text-[var(--placeholder)]"
          />
          {q && (
            <button onClick={() => setQ('')} className="text-[var(--muted)] hover:text-[var(--ink)]">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="text-xs text-[var(--muted)]">
          Showing <span className="font-bold text-[var(--ink)]">{filtered.length}</span> of {suppliers.length} suppliers
        </div>
      </div>

      {/* -------------------------------------------------------------
          SUPPLIERS TABLE (Table-Based ERP Design)
      -------------------------------------------------------------- */}
      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        {loading ? (
          <div className="py-16">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <Building2 size={36} className="text-[var(--muted-light)] opacity-40" />
            <p className="text-sm font-semibold text-[var(--ink)]">
              {q ? 'No suppliers matching search' : 'No suppliers registered'}
            </p>
            <p className="text-xs text-[var(--muted)]">
              {q ? 'Try a different search term.' : 'Get started by adding your first vendor.'}
            </p>
            {!q && (
              <button onClick={openAdd} className="btn-primary text-xs mt-2">
                <Plus size={14} /> Add Supplier
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10"></th>
                  <th>Supplier Name</th>
                  <th>Contact Details</th>
                  <th>GSTIN</th>
                  <th className="text-center">Products</th>
                  <th className="num-col">Outstanding</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const supProds = products.filter(p => p.supplier === s.id)
                  const isExpanded = expandedIds.has(s.id)
                  const due = Number(s.outstanding_amount || 0)

                  return (
                    <tr key={s.id} className="group">
                      {/* Expand Chevron */}
                      <td className="w-10 text-center">
                        <button
                          onClick={() => toggleExpand(s.id)}
                          className="p-1 rounded text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
                          title={isExpanded ? 'Collapse' : 'Expand products'}
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>

                      {/* Name & Address */}
                      <td>
                        <div className="font-semibold text-sm text-[var(--ink)]">
                          {s.name}
                        </div>
                        {s.address && (
                          <div className="flex items-center gap-1 text-[11px] text-[var(--muted)] mt-0.5 truncate max-w-xs">
                            <MapPin size={10} className="shrink-0" />
                            <span className="truncate">{s.address}</span>
                          </div>
                        )}
                      </td>

                      {/* Phone & Email */}
                      <td>
                        <div className="space-y-0.5 text-xs">
                          {s.phone ? (
                            <div className="flex items-center gap-1 text-[var(--ink-secondary)]">
                              <Phone size={11} className="text-[var(--muted)]" />
                              <span>{s.phone}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[var(--muted-light)]">—</span>
                          )}
                          {s.email && (
                            <div className="flex items-center gap-1 text-[11px] text-[var(--muted)] truncate max-w-[180px]">
                              <Mail size={11} className="shrink-0" />
                              <span className="truncate">{s.email}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* GSTIN */}
                      <td>
                        {s.gstin ? (
                          <span className="font-mono text-xs font-semibold text-[var(--ink-secondary)] bg-[var(--surface-elevated)] border border-[var(--line)] px-1.5 py-0.5 rounded">
                            {s.gstin}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--muted-light)]">—</span>
                        )}
                      </td>

                      {/* Products Count */}
                      <td className="text-center">
                        <button
                          onClick={() => toggleExpand(s.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
                        >
                          <Package size={11} />
                          <span>{supProds.length}</span>
                        </button>
                      </td>

                      {/* Outstanding */}
                      <td className="num-col">
                        <span
                          className={`font-mono text-xs font-bold ${
                            due > 0 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {fmt(due)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {due > 0 && (
                            <button
                              onClick={() => {
                                setPayTarget(s)
                                setPayAmt(String(due))
                              }}
                              className="btn-sm bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-2.5 rounded-lg flex items-center gap-1"
                              title="Record Payment"
                            >
                              <CreditCard size={12} />
                              <span>Pay</span>
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(s)}
                            className="btn-secondary btn-sm text-xs px-2"
                            title="Edit Supplier"
                          >
                            <Pencil size={12} />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(s)}
                            className="btn-secondary btn-sm text-xs px-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                            title="Delete Supplier"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* -------------------------------------------------------------
          LINKED PRODUCTS DRAWER (If any supplier row expanded)
      -------------------------------------------------------------- */}
      {Array.from(expandedIds).map(id => {
        const sup = suppliers.find(s => s.id === id)
        if (!sup) return null
        const supProducts = products.filter(p => p.supplier === id)

        return (
          <div
            key={id}
            className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package size={15} className="text-blue-600" />
                <h3 className="text-xs font-bold text-[var(--ink)]">
                  Linked Catalog Products for <span className="text-blue-600">{sup.name}</span> ({supProducts.length})
                </h3>
              </div>
              <button
                onClick={() => toggleExpand(id)}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Close
              </button>
            </div>

            {supProducts.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">No products linked to this supplier yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
                <table className="table text-xs">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th className="num-col">Current Stock</th>
                      <th className="num-col">Purchase Price</th>
                      <th className="num-col">Selling Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supProducts.map(p => (
                      <tr key={p.id}>
                        <td className="font-semibold text-[var(--ink)]">{p.name}</td>
                        <td className="font-mono text-[var(--muted)]">{p.sku || '—'}</td>
                        <td className={`num-col font-bold ${Number(p.current_stock) <= 0 ? 'text-red-600' : 'text-[var(--ink)]'}`}>
                          {p.current_stock}
                        </td>
                        <td className="num-col font-mono">{fmt(p.purchase_price)}</td>
                        <td className="num-col font-mono font-bold">{fmt(p.selling_price)}</td>
                        <td>
                          <Badge status={p.stock_status || (Number(p.current_stock) <= 0 ? 'out_of_stock' : 'in_stock')} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      {/* -------------------------------------------------------------
          ADD / EDIT MODAL
      -------------------------------------------------------------- */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'} size="sm">
        <SupplierForm initial={editing} onSaved={onSaved} onClose={() => setModal(false)} />
      </Modal>

      {/* -------------------------------------------------------------
          RECORD PAYMENT MODAL
      -------------------------------------------------------------- */}
      <Modal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title={`Record Payment — ${payTarget?.name}`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center dark:border-red-900/40 dark:bg-red-950/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">
              Outstanding Payable Balance
            </span>
            <p className="text-xl font-bold font-mono text-red-600 mt-0.5">
              {fmt(payTarget?.outstanding_amount)}
            </p>
          </div>

          <div>
            <label className="label">Amount Paid (₹) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input font-mono"
              value={payAmt}
              onChange={e => setPayAmt(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>

          <div>
            <label className="label">Payment Method</label>
            <select
              className="input"
              value={payMethod}
              onChange={e => setPayMethod(e.target.value)}
            >
              <option value="cash">Cash</option>
              <option value="upi">UPI / QR</option>
              <option value="card">Bank Card</option>
              <option value="online">Net Banking / NEFT</option>
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => setPayTarget(null)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              onClick={recordPayment}
              disabled={paying}
              className="btn-primary flex-1 flex items-center justify-center gap-1.5"
            >
              <IndianRupee size={14} />
              <span>{paying ? 'Recording…' : 'Record Payment'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* -------------------------------------------------------------
          DELETE CONFIRM MODAL
      -------------------------------------------------------------- */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Supplier" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Are you sure you want to delete <span className="font-bold text-[var(--ink)]">"{deleteTarget?.name}"</span>?
            This will permanently remove the supplier from your records.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button onClick={confirmDelete} disabled={deleting} className="btn-danger flex-1">
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
