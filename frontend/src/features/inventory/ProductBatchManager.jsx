import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import productService from './api/productService'

const EMPTY = { batch_number: '', manufacturing_date: '', expiry_date: '', mrp: '', purchase_rate: '', selling_rate: '', quantity: '' }

export default function ProductBatchManager({ product }) {
  const [batches, setBatches] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    try { setBatches(await productService.getBatches(product.id)) }
    catch { toast.error('Could not load product batches') }
  }, [product.id])
  useEffect(() => { load() }, [load])

  const save = async event => {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, product: product.id, mrp: Number(form.mrp || 0), purchase_rate: Number(form.purchase_rate || 0), selling_rate: Number(form.selling_rate || 0), quantity: Number(form.quantity || 0) }
      if (editingId) {
        const result = await productService.updateBatch(editingId, payload)
        if (result?.requires_approval) toast.success(`Stock adjustment is pending approval #${result.approval_request_id}.`)
        else toast.success('Batch updated')
      } else {
        const result = await productService.createBatch(payload)
        if (result?.requires_approval) toast.success(`Batch created. Stock is pending approval #${result.approval_request_id}.`)
        else toast.success('Batch created')
      }
      setForm(EMPTY); setEditingId(null); await load()
    } catch (error) {
      const detail = error.response?.data?.detail || error.response?.data?.expiry_date || error.response?.data?.batch_number || 'Could not save batch'
      toast.error(Array.isArray(detail) ? detail.join(' ') : String(detail))
    } finally { setSaving(false) }
  }

  const edit = batch => {
    setEditingId(batch.id)
    setForm({ batch_number: batch.batch_number, manufacturing_date: batch.manufacturing_date || '', expiry_date: batch.expiry_date || '', mrp: batch.mrp, purchase_rate: batch.purchase_rate, selling_rate: batch.selling_rate, quantity: batch.quantity })
  }

  return <section className="space-y-3 rounded-xl border border-[var(--line)] p-4">
    <div><h3 className="text-sm font-bold text-[var(--ink)]">Batch and expiry stock</h3><p className="text-xs text-[var(--muted)]">Each batch keeps its own MRP, rates, dates, and stock.</p></div>
    {batches.length > 0 && <div className="overflow-x-auto"><table className="erp-table text-xs"><thead><tr><th>Batch</th><th>Mfg.</th><th>Expiry</th><th>MRP</th><th>Rate</th><th>Qty</th><th>Status</th><th></th></tr></thead><tbody>{batches.map(batch => <tr key={batch.id}><td>{batch.batch_number}</td><td>{batch.manufacturing_date || '—'}</td><td>{batch.expiry_date || '—'}</td><td>{batch.mrp}</td><td>{batch.selling_rate}</td><td>{batch.quantity}</td><td>{batch.inventory_status}{!batch.active ? ' · INACTIVE' : ''}</td><td className="whitespace-nowrap"><button className="mr-2 text-blue-700" type="button" onClick={() => edit(batch)}>Edit</button><button className="text-slate-600" type="button" onClick={async () => { try { await productService.updateBatch(batch.id, { active: !batch.active }); await load() } catch { toast.error('Could not update batch status') } }}>{batch.active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>}
    <form onSubmit={save} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <input className="input" required aria-label="Batch number" placeholder="Batch number" value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} />
      <input className="input" type="date" aria-label="Manufacturing date" value={form.manufacturing_date} onChange={e => setForm({ ...form, manufacturing_date: e.target.value })} />
      <input className="input" type="date" aria-label="Expiry date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
      <input className="input" type="number" min="0" step=".01" aria-label="Batch MRP" placeholder="MRP" value={form.mrp} onChange={e => setForm({ ...form, mrp: e.target.value })} />
      <input className="input" type="number" min="0" step=".01" aria-label="Purchase rate" placeholder="Purchase rate" value={form.purchase_rate} onChange={e => setForm({ ...form, purchase_rate: e.target.value })} />
      <input className="input" type="number" min="0" step=".01" aria-label="Selling rate" placeholder="Selling rate" value={form.selling_rate} onChange={e => setForm({ ...form, selling_rate: e.target.value })} />
      <input className="input" type="number" min="0" step=".01" aria-label="Batch quantity" placeholder="Quantity" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
      <div className="col-span-2 flex gap-2 sm:col-span-1"><button className="btn-primary flex-1" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update batch' : 'Add batch'}</button>{editingId && <button type="button" className="btn-secondary" onClick={() => { setEditingId(null); setForm(EMPTY) }}>Cancel</button>}</div>
    </form>
  </section>
}
