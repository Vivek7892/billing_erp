import { Fragment, useState, useEffect } from 'react'
import api from '../api'
import { Badge, Card, PageHeader, Modal, Spinner, EmptyState, ConfirmDialog } from '../components/UI'
import toast from 'react-hot-toast'
import {
 Plus, Trash2, Printer, Package, ChevronDown, ChevronRight,
 Building2, Phone, Mail, MapPin, Edit2, Search, Save,
 Wallet, Clock3, ClipboardList, TrendingUp, Filter, Download
} from 'lucide-react'

const fmt = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const fmtDate = value => value
 ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
 day: '2-digit', month: 'short', year: 'numeric'
 })
 : '—'
const emptyForm = {
 supplier: '', invoice_number: '',
 purchase_date: new Date().toISOString().slice(0, 10),
 payment_status: 'paid', paid_amount: 0, notes: '',
 items: [{ product: '', quantity: 1, purchase_price: '', gst_percent: 0, total: 0 }]
}
const emptySupplier = { name: '', phone: '', email: '', address: '', gstin: '' }

/* Shared field style — light mode */
const inputCls =
 'input !bg-white !text-slate-900 !border-slate-300 placeholder:!text-slate-400 focus:!border-indigo-500 focus:!ring-indigo-500'

const fmt2 = v => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dueOf = p => Math.max(0, Number(p.total_amount || 0) - Number(p.paid_amount || 0))

/* Shared surface tokens — clean light-mode surfaces */
const cardCls =
 'rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_rgba(15,23,42,0.05)]'
const cardHover =
 'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 ' +
 'hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_14px_30px_rgba(15,23,42,0.10)] '
const tableCls =
 '[&_thead]:bg-slate-50 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-slate-500 ' +
 '[&_td]:border-slate-100 [&_td]:text-slate-700'

/* ── Print purchase order ── */
function printPO(purchase, suppliers) {
 const sup = suppliers.find(s => s.id === purchase.supplier) || {}
 const win = window.open('', '_blank')
 if (!win) return
 const subtotal = (purchase.items || []).reduce((s, it) => s + Number(it.quantity || 0) * Number(it.purchase_price || 0), 0)
 const total = Number(purchase.total_amount || 0)
 const gstTotal = total - subtotal
 const balance = dueOf(purchase)
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
 td{padding:7px 8px;border-bottom:1px solid #e9eef7;font-size:12px}
 .total{text-align:right;font-size:16px;font-weight:bold;margin-top:12px}
 .footer{margin-top:32px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px}
 @media print{button{display:none}}</style></head><body>
 <h2>Purchase Order — PO-${purchase.id}</h2>
 <p>Supplier: <b>${purchase.supplier_name || sup.name || '—'}</b></p>
 <p>Invoice No: ${purchase.invoice_number || '—'} &nbsp;|&nbsp; Date: ${purchase.purchase_date}</p>
 <p>Payment: ${purchase.payment_status?.toUpperCase()}</p>
 <table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Price</th><th>GST</th><th>Total</th></tr></thead>
 <tbody>${rows}</tbody></table>
 <div class="total" style="font-weight:normal;font-size:13px;color:#555">Subtotal: ₹${subtotal.toFixed(2)}</div>
 <div class="total" style="font-weight:normal;font-size:13px;color:#555;margin-top:4px">GST: ₹${gstTotal.toFixed(2)}</div>
 <div class="total" style="margin-top:8px">Grand Total: ₹${total.toFixed(2)}</div>
 <div class="total" style="font-size:13px;margin-top:4px">Balance Due: ₹${balance.toFixed(2)}</div>
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
 <div className="space-y-4">
 <div><label className="label">Name *</label><input className={inputCls} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus /></div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div><label className="label">Phone</label><input className={inputCls} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
 <div><label className="label">Email</label><input className={inputCls} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
 </div>
 <div><label className="label">Address</label><textarea className={inputCls} rows={2} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} /></div>
 <div><label className="label">GSTIN</label><input className={inputCls} value={form.gstin} onChange={e => setForm(p => ({ ...p, gstin: e.target.value }))} /></div>
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
 <div className={`group overflow-hidden ${cardCls} ${cardHover}`}>
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5">
 <div className="flex items-start gap-3 min-w-0">
 <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
 <Building2 size={18} className="text-indigo-600 " />
 </div>
 <div className="min-w-0">
 <div className="font-semibold text-slate-900 truncate">{supplier.name}</div>
 <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
 {supplier.phone && <span className="text-xs text-slate-500 flex items-center gap-1"><Phone size={10} />{supplier.phone}</span>}
 {supplier.email && <span className="text-xs text-slate-500 flex items-center gap-1"><Mail size={10} />{supplier.email}</span>}
 {supplier.gstin && <span className="text-xs text-slate-500 ">GST: {supplier.gstin}</span>}
 </div>
 </div>
 </div>
 <div className="flex w-full items-center gap-1.5 flex-wrap sm:w-auto sm:flex-nowrap sm:flex-shrink-0">
 {supplier.outstanding_amount > 0 && (
 <span className="text-xs bg-red-50 border border-red-100 text-red-600 font-semibold px-2 py-1 rounded-lg">Due: {fmt(supplier.outstanding_amount)}</span>
 )}
 <span className="text-xs bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-full">{supProducts.length} products</span>
 <button onClick={() => onEdit(supplier)} className="icon-btn"><Edit2 size={14} /></button>
 <button onClick={() => onDelete(supplier)} className="icon-btn text-red-400"><Trash2 size={14} /></button>
 <button onClick={() => setExpanded(x => !x)} className="icon-btn">
 {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
 </button>
 </div>
 </div>
 {expanded && (
 <div className="border-t border-slate-200 bg-white text-slate-800 px-4 sm:px-5 py-4">
 {supplier.address && <p className="text-xs text-slate-500 flex items-start gap-1 mb-2"><MapPin size={11} className="mt-0.5 flex-shrink-0" />{supplier.address}</p>}
 {supProducts.length === 0 ? (
 <p className="text-xs text-slate-500 py-2">No products linked to this supplier.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className={`table text-xs ${tableCls}`}>
 <thead><tr><th>Product</th><th>SKU</th><th>Stock</th><th>Purchase Price</th><th>Selling Price</th><th>Status</th></tr></thead>
 <tbody className="text-slate-800 ">
 {supProducts.map(p => (
 <tr key={p.id} className="text-slate-800 ">
 <td className="font-medium">{p.name}</td>
 <td className="font-mono text-slate-500 ">{p.sku}</td>
 <td className={p.current_stock <= 0 ? 'text-red-600 font-semibold' : p.current_stock <= p.minimum_stock ? 'text-orange-500 font-semibold' : 'text-green-600 '}>{p.current_stock}</td>
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

 const grandTotal = form.items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0)
 const subtotal = form.items.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.purchase_price) || 0), 0)
 const gstTotal = grandTotal - subtotal
 const paidNow = form.payment_status === 'paid' ? grandTotal
 : form.payment_status === 'partial' ? (parseFloat(form.paid_amount) || 0) : 0
 const balanceDue = Math.max(0, grandTotal - paidNow)
 const paymentError =
 form.payment_status !== 'partial' ? ''
 : paidNow <= 0 ? 'Enter the amount paid so far'
 : paidNow >= grandTotal ? 'Must be less than the total — choose "Paid" instead'
 : ''

 const save = async () => {
 if (!form.supplier) return toast.error('Select a supplier')
 if (form.items.some(i => !i.product || !i.purchase_price)) return toast.error('Fill all item details')
 if (form.items.some(i => !(parseFloat(i.quantity) > 0))) return toast.error('Quantity must be greater than zero')
 if (grandTotal <= 0) return toast.error('Purchase total must be greater than zero')
 if (paymentError) return toast.error(paymentError)
 setSaving(true)
 try {
 const payload = {
 ...form,
 paid_amount: Number(paidNow.toFixed(2)),
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

 const purchaseSummary = {
 total: purchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0),
 paid: purchases.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0),
 due: purchases.reduce((sum, p) => sum + dueOf(p), 0),
 orders: purchases.length,
 }

 const summaryCards = [
 {
 label: 'Total Purchases',
 value: fmt(purchaseSummary.total),
 hint: 'Across all purchase orders',
 icon: TrendingUp,
 iconClass: 'bg-indigo-50 text-indigo-600 border border-indigo-200 ',
 },
 {
 label: 'Amount Paid',
 value: fmt(purchaseSummary.paid),
 hint: 'Settled with suppliers',
 icon: Wallet,
 iconClass: 'bg-emerald-50 text-emerald-600 border border-emerald-200 ',
 },
 {
 label: 'Amount Due',
 value: fmt(purchaseSummary.due),
 hint: purchaseSummary.due > 0 ? 'Requires payment attention' : 'No outstanding balance',
 icon: Clock3,
 iconClass: 'bg-amber-50 text-amber-600 border border-amber-200 ',
 },
 {
 label: 'Purchase Orders',
 value: purchaseSummary.orders,
 hint: `${suppliers.length} registered suppliers`,
 icon: ClipboardList,
 iconClass: 'bg-sky-50 text-sky-600 border border-sky-200 ',
 },
 ]

 return (
 <div className="min-h-screen space-y-6 bg-slate-50 px-3 pb-20 pt-4 text-slate-900 sm:px-5 lg:px-6">
 <PageHeader title="Purchases" subtitle="Manage purchase orders, suppliers, payments and stock-in"
 action={
 <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
 <button onClick={() => { setEditSupplier(null); setSupModal(true) }} className="btn-secondary flex items-center gap-2 text-sm">
 <Building2 size={15} /> Add Supplier
 </button>
 <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2">
 <Plus size={16} /> New Purchase
 </button>
 </div>
 }
 />

 <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 ">Procurement workspace</p><p className="mt-1 text-sm text-slate-500 ">Track supplier spending, purchase orders and outstanding payments.</p></div></div>

 {/* Purchase overview */}
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
 {summaryCards.map(({ label, value, hint, icon: Icon, iconClass }) => (
 <div
 key={label}
 className={`group relative overflow-hidden p-4 sm:p-5 ${cardCls} ${cardHover}`}
 >
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 ">{label}</p>
 <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900 ">{value}</p>
 <p className="mt-1 text-xs text-slate-500 ">{hint}</p>
 </div>
 <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
 <Icon size={18} />
 </div>
 </div>
 </div>
 ))}
 </div>

 {/* Tabs */}
 <div className="flex w-full max-w-full gap-1 overflow-x-auto sm:inline-flex sm:w-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm ">
 {[['orders', 'Purchase Orders'], ['suppliers', `Suppliers (${suppliers.length})`]].map(([key, label]) => (
 <button
 key={key}
 onClick={() => setTab(key)}
 className={`whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
 tab === key
 ? 'bg-indigo-600 text-white shadow-sm '
 : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 '
 }`}
 >
 {label}
 </button>
 ))}
 </div>

 {loading ? <Spinner /> : (
 <>
 {/* ── Purchase Orders Tab ── */}
 {tab === 'orders' && (
 <div className="space-y-4">
 <div className={`flex flex-col gap-3 p-3.5 ${cardCls} sm:flex-row sm:items-center`}>
 <div className="relative flex-1">
 <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 " />
 <input
 className="input h-11 w-full rounded-xl border-slate-300 bg-white pl-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-indigo-500 "
 placeholder="Search supplier or invoice number..."
 value={poSearch}
 onChange={e => setPoSearch(e.target.value)}
 />
 </div>
 <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500 ">
 <Filter size={14} />
 <span>{filteredPOs.length} result{filteredPOs.length !== 1 ? 's' : ''}</span>
 </div>
 </div>
 {filteredPOs.length === 0 ? <EmptyState message="No purchase orders yet" /> : (
 <Card className={`overflow-hidden ${cardCls} shadow-sm`}>
 <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
 <table className={`table min-w-[900px] ${tableCls}`}>
 <thead>
 <tr><th>PO #</th><th>Supplier</th><th>Invoice</th><th>Date</th><th>Total</th><th>Paid</th><th>Balance Due</th><th>Status</th><th>Actions</th></tr>
 </thead>
 <tbody className="text-slate-800 ">
 {filteredPOs.map(p => (
 <Fragment key={p.id}>
 <tr className="text-slate-800 cursor-pointer hover:bg-blue-50/60 transition-colors" onClick={() => setExpandedPO(expandedPO === p.id ? null : p.id)}>
 <td className="font-mono text-indigo-700 font-semibold">PO-{p.id}</td>
 <td className="font-medium">{p.supplier_name || '—'}</td>
 <td className="text-sm text-slate-500 ">{p.invoice_number || '—'}</td>
 <td className="text-sm whitespace-nowrap">{fmtDate(p.purchase_date)}</td>
 <td className="font-semibold whitespace-nowrap">{fmt(p.total_amount)}</td>
 <td className="text-sm whitespace-nowrap">{fmt(p.paid_amount)}</td>
 <td className={`text-sm font-semibold whitespace-nowrap ${dueOf(p) > 0 ? 'text-amber-600 ' : 'text-slate-400 '}`}>{fmt(dueOf(p))}</td>
 <td><Badge status={p.payment_status} /></td>
 <td>
 <button onClick={e => { e.stopPropagation(); printPO(p, suppliers) }}
 className="icon-btn transition-colors hover:bg-indigo-50 hover:text-indigo-700 " title="Print purchase order"><Printer size={15} /></button>
 </td>
 </tr>
 {expandedPO === p.id && (
 <tr className="text-slate-800 ">
 <td colSpan={9} className="border-y border-slate-200 bg-white px-3 py-4 sm:px-4">
 <div className="text-xs font-semibold text-slate-500 mb-2">Items in PO-{p.id}</div>
 <table className={`table text-xs bg-white rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.06)] min-w-[560px] ${tableCls}`}>
 <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Price</th><th>GST</th><th>Total</th></tr></thead>
 <tbody className="text-slate-800 ">
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
 {p.notes && <p className="text-xs text-slate-500 mt-2">Notes: {p.notes}</p>}
 </td>
 </tr>
 )}
 </Fragment>
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
 <div className="space-y-4">
 <div className={`flex flex-col gap-3 p-3.5 ${cardCls} sm:flex-row sm:items-center`}>
 <div className="relative flex-1">
 <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 " />
 <input className="input h-11 w-full rounded-xl border-slate-300 bg-white pl-10 text-sm text-slate-900 placeholder:text-slate-400 " placeholder="Search suppliers..."
 value={supSearch} onChange={e => setSupSearch(e.target.value)} />
 </div>
 <button onClick={() => { setEditSupplier(null); setSupModal(true) }} className="btn-primary w-full justify-center flex items-center gap-2 text-sm sm:w-auto">
 <Plus size={14} /> Add Supplier
 </button>
 </div>
 {filteredSuppliers.length === 0 ? <EmptyState message="No suppliers found" /> : (
 <div className="space-y-4">
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
 <div className="space-y-5 rounded-2xl bg-white p-4 text-slate-900 transition-colors duration-300 sm:p-5">

 {/* Order details */}
 <section className={`${cardCls} p-4 sm:p-5`}>
 <h3 className="mb-3 text-sm font-semibold text-slate-900 ">Order details</h3>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <div className="sm:col-span-2 lg:col-span-1">
 <label className="label">Supplier *</label>
 <div className="flex flex-wrap gap-2">
 <select className={`${inputCls} flex-1`} value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}>
 <option className="bg-white text-slate-900 " value="">Select supplier</option>
 {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
 </select>
 <button onClick={() => { setEditSupplier(null); setSupModal(true) }} className="btn-secondary px-2" title="Add new supplier">
 <Plus size={14} />
 </button>
 </div>
 </div>
 <div>
 <label className="label">Invoice No.</label>
 <input className={inputCls} value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} placeholder="Supplier's invoice #" />
 </div>
 <div>
 <label className="label">Date</label>
 <input type="date" className={inputCls} value={form.purchase_date} onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))} />
 </div>
 <div>
 <label className="label">Payment</label>
 <select className={inputCls} value={form.payment_status} onChange={e => setForm(p => ({ ...p, payment_status: e.target.value }))}>
 <option className="bg-white text-slate-900 " value="paid">Paid</option>
 <option className="bg-white text-slate-900 " value="pending">Pending</option>
 <option className="bg-white text-slate-900 " value="partial">Partial</option>
 </select>
 </div>
 </div>

 {form.payment_status === 'partial' && (
 <div className="mt-3 max-w-xs">
 <label className="label">Paid Amount</label>
 <input
 type="number" min="0" step="0.01"
 className={paymentError ? inputCls.replace('border-slate-300', 'border-red-400').replace('', '') : inputCls}
 value={form.paid_amount}
 onChange={e => setForm(p => ({ ...p, paid_amount: e.target.value }))}
 />
 {paymentError
 ? <p className="mt-1 text-xs text-red-600 ">{paymentError}</p>
 : <p className="mt-1 text-xs text-slate-500 ">Balance due: ₹{fmt2(balanceDue)}</p>}
 </div>
 )}
 </section>

 {/* Items */}
 <section className={`${cardCls} overflow-hidden`}>
 <div className="flex items-center justify-between px-4 py-3 sm:px-5">
 <h3 className="text-sm font-semibold text-slate-900 ">Items</h3>
 <button onClick={() => setForm(p => ({ ...p, items: [...p.items, { product: '', quantity: 1, purchase_price: '', gst_percent: 0, total: 0 }] }))}
 className="text-sm font-medium text-indigo-600 hover:underline flex items-center gap-1">
 <Plus size={13} /> Add Item
 </button>
 </div>
 <div className="w-full max-w-full overflow-x-auto border-t border-slate-100 ">
 <table className={`table min-w-[980px] ${tableCls}`}>
 <thead>
 <tr><th>Product</th><th>Qty</th><th>Purchase Price</th><th>GST%</th><th>Total</th><th></th></tr>
 </thead>
 <tbody className="text-slate-800 ">
 {form.items.map((item, i) => (
 <tr key={i}>
 <td className="min-w-48">
 <select className={`${inputCls} text-sm`} value={item.product} onChange={e => updateItem(i, 'product', e.target.value)}>
 <option className="bg-white text-slate-900 " value="">Select product</option>
 {(form.supplier && supplierProducts.length > 0 ? supplierProducts : products).map(p => (
 <option key={p.id} value={p.id}>{p.name} (Stock: {p.current_stock})</option>
 ))}
 </select>
 </td>
 <td><input type="number" className={`${inputCls} text-sm w-20`} min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} /></td>
 <td><input type="number" className={`${inputCls} text-sm w-28`} min="0" step="0.01" value={item.purchase_price} onChange={e => updateItem(i, 'purchase_price', e.target.value)} /></td>
 <td>
 <select className={`${inputCls} text-sm w-20`} value={item.gst_percent} onChange={e => updateItem(i, 'gst_percent', e.target.value)}>
 {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
 </select>
 </td>
 <td className="font-semibold text-sm text-green-700 ">₹{fmt2(item.total)}</td>
 <td>
 <button onClick={() => setForm(p => ({ ...p, items: p.items.filter((_, j) => j !== i) }))}
 className="text-red-400 hover:text-red-600 p-1 disabled:opacity-40" disabled={form.items.length === 1}>
 <Trash2 size={14} />
 </button>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </section>

 {/* Notes + payment summary */}
 <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
 <section className={`${cardCls} flex-1 p-4 sm:p-5`}>
 <label className="label">Notes</label>
 <textarea className={inputCls} rows={4} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes…" />
 </section>

 <section className={`${cardCls} w-full p-4 sm:p-5 lg:w-80`}>
 <h3 className="mb-3 text-sm font-semibold text-slate-900 ">Payment summary</h3>
 <dl className="space-y-2 text-sm">
 <div className="flex items-center justify-between">
 <dt className="text-slate-500 ">Subtotal</dt>
 <dd className="font-medium text-slate-800 ">₹{fmt2(subtotal)}</dd>
 </div>
 <div className="flex items-center justify-between">
 <dt className="text-slate-500 ">GST</dt>
 <dd className="font-medium text-slate-800 ">₹{fmt2(gstTotal)}</dd>
 </div>
 <div className="flex items-center justify-between border-t border-slate-200 pt-3 ">
 <dt className="font-semibold text-slate-900 ">Grand total</dt>
 <dd className="text-xl font-bold text-indigo-700 ">₹{fmt2(grandTotal)}</dd>
 </div>
 <div className="flex items-center justify-between">
 <dt className="text-slate-500 ">Paid</dt>
 <dd className="font-medium text-slate-800 ">₹{fmt2(paidNow)}</dd>
 </div>
 <div className="flex items-center justify-between">
 <dt className="text-slate-500 ">Balance due</dt>
 <dd className={`font-semibold ${balanceDue > 0 ? 'text-amber-600 ' : 'text-emerald-600 '}`}>₹{fmt2(balanceDue)}</dd>
 </div>
 </dl>
 <p className="mt-3 text-xs text-slate-500 ">{form.items.length} item{form.items.length !== 1 ? 's' : ''}</p>
 </section>
 </div>

 <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
 <button onClick={save} disabled={saving} className="btn-primary min-h-11 w-full flex-1 justify-center">
 <Package size={16} />{saving ? 'Saving…' : 'Save Purchase & Update Stock'}
 </button>
 <button onClick={() => { setModal(false); setForm(emptyForm) }} className="btn-secondary min-h-11 w-full px-6 sm:w-auto">Cancel</button>
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