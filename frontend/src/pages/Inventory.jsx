import { useState, useEffect } from 'react'
import api from '../api'
import { Badge, Card, PageHeader, Modal, Spinner, EmptyState } from '../components/UI'
import toast from 'react-hot-toast'
import { Search, ArrowUpCircle, ArrowDownCircle, Settings, Layers, Upload, Download } from 'lucide-react'

export default function Inventory() {
  const [products, setProducts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('stock') // stock | transactions
  const [adjustModal, setAdjustModal] = useState(false)
  const [bulkModal, setBulkModal] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [bulkQuantities, setBulkQuantities] = useState({})
  const [adjustForm, setAdjustForm] = useState({ product_id: '', quantity: '', transaction_type: 'stock_in', notes: '' })

  const loadProducts = () => {
    setLoading(true)
    const params = new URLSearchParams({ page_size: 100 })
    if (search) params.set('search', search)
    api.get(`/products/?${params}`).then(r => setProducts(r.data.results || r.data)).finally(() => setLoading(false))
  }

  const loadTransactions = () => {
    setLoading(true)
    api.get('/inventory/?page_size=50').then(r => setTransactions(r.data.results || r.data)).finally(() => setLoading(false))
  }

  useEffect(() => { tab === 'stock' ? loadProducts() : loadTransactions() }, [tab, search])

  const adjust = async () => {
    try {
      await api.post('/inventory/adjust/', adjustForm)
      toast.success('Stock adjusted')
      setAdjustModal(false)
      setAdjustForm({ product_id: '', quantity: '', transaction_type: 'stock_in', notes: '' })
      loadProducts()
    } catch (e) { toast.error(e.response?.data?.error || 'Failed') }
  }

  const submitBulkStock = async () => {
    const items = Object.entries(bulkQuantities).filter(([, quantity]) => Number(quantity)).map(([product_id, quantity]) => ({ product_id, quantity: Number(quantity) }))
    if (!items.length) return toast.error('Enter stock quantity for at least one product')
    try {
      await api.post('/inventory/bulk-adjust/', { items })
      toast.success(`${items.length} stock item${items.length === 1 ? '' : 's'} updated`)
      setBulkQuantities({}); setBulkModal(false); loadProducts()
    } catch (e) { toast.error(e.response?.data?.detail || 'Could not update stock') }
  }

  const downloadImportTemplate = () => {
    const csv = 'SKU,Quantity\nEXAMPLE-SKU,10\n'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'stock-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const importStock = async () => {
    if (!importFile) return toast.error('Choose a CSV or Excel file')
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', importFile)
      const { data } = await api.post('/inventory/import/', form)
      toast.success(`${data.imported} product${data.imported === 1 ? '' : 's'} updated from file`)
      setImportFile(null); setImportModal(false); loadProducts()
    } catch (e) {
      const errors = e.response?.data?.errors
      toast.error(errors?.[0] || e.response?.data?.detail || 'Could not import stock')
    } finally { setImporting(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Inventory" subtitle="Stock management"
        action={<div className="flex gap-2"><button onClick={() => setImportModal(true)} className="btn-secondary flex items-center gap-2"><Upload size={16} />Import File</button><button onClick={() => setBulkModal(true)} className="btn-secondary flex items-center gap-2"><Layers size={16} />Bulk Stock</button><button onClick={() => setAdjustModal(true)} className="btn-primary flex items-center gap-2"><Settings size={16} />Adjust Stock</button></div>} />

      <div className="flex gap-2">
        {['stock', 'transactions'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t === 'stock' ? 'Current Stock' : 'Transactions'}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <>
          <Card className="p-4">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-8 text-sm" placeholder="Search products..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </Card>
          <Card>
            {loading ? <Spinner /> : products.length === 0 ? <EmptyState /> : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead><tr><th>Product</th><th>SKU</th><th>Current Stock</th><th>Min Stock</th><th>Purchase Price</th><th>Selling Price</th><th>Status</th></tr></thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.name}</td>
                        <td className="font-mono text-sm">{p.sku}</td>
                        <td className={`font-bold ${p.current_stock <= 0 ? 'text-red-600' : p.current_stock <= p.minimum_stock ? 'text-yellow-600' : 'text-green-600'}`}>
                          {p.current_stock} {p.unit}
                        </td>
                        <td>{p.minimum_stock}</td>
                        <td>₹{p.purchase_price}</td>
                        <td>₹{p.selling_price}</td>
                        <td><Badge status={p.stock_status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'transactions' && (
        <Card>
          {loading ? <Spinner /> : transactions.length === 0 ? <EmptyState message="No transactions" /> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Before</th><th>After</th><th>Reference</th></tr></thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td className="text-sm text-gray-500">{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="font-medium text-sm">{t.product_name}</td>
                      <td>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          t.transaction_type === 'sale' ? 'bg-red-100 text-red-700' :
                          t.transaction_type === 'purchase' ? 'bg-green-100 text-green-700' :
                          'bg-blue-100 text-blue-700'}`}>
                          {t.transaction_type === 'sale' ? <ArrowDownCircle size={11} /> : <ArrowUpCircle size={11} />}
                          {t.transaction_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className={`font-semibold ${t.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>{t.quantity > 0 ? '+' : ''}{t.quantity}</td>
                      <td className="text-sm">{t.before_stock}</td>
                      <td className="text-sm font-medium">{t.after_stock}</td>
                      <td className="text-xs text-gray-500">{t.reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal open={adjustModal} onClose={() => setAdjustModal(false)} title="Adjust Stock" size="sm">
        <div className="space-y-3">
          <div><label className="label">Product *</label>
            <select className="input" value={adjustForm.product_id} onChange={e => setAdjustForm(p => ({ ...p, product_id: e.target.value }))}>
              <option value="">Select product</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.current_stock})</option>)}
            </select></div>
          <div><label className="label">Type</label>
            <select className="input" value={adjustForm.transaction_type} onChange={e => setAdjustForm(p => ({ ...p, transaction_type: e.target.value }))}>
              <option value="stock_in">Stock In</option>
              <option value="stock_out">Stock Out</option>
              <option value="adjustment">Adjustment</option>
              <option value="damaged">Damaged</option>
              <option value="returned">Returned</option>
            </select></div>
          <div><label className="label">Quantity (use negative for stock out)</label>
            <input type="number" className="input" value={adjustForm.quantity} onChange={e => setAdjustForm(p => ({ ...p, quantity: e.target.value }))} /></div>
          <div><label className="label">Notes</label>
            <textarea className="input" rows={2} value={adjustForm.notes} onChange={e => setAdjustForm(p => ({ ...p, notes: e.target.value }))} /></div>
          <button onClick={adjust} className="btn-primary w-full">Apply Adjustment</button>
        </div>
      </Modal>

      <Modal open={bulkModal} onClose={() => setBulkModal(false)} title="Bulk Stock Update" size="lg">
        <p className="text-sm text-gray-500 mb-3">Enter quantities to add or remove. The current stock stays visible for every product.</p>
        <div className="border border-gray-200 rounded-lg max-h-[50vh] overflow-y-auto">
          <table className="table text-sm"><thead><tr><th>Product</th><th>SKU</th><th className="text-right">Current</th><th className="text-right">Add / Remove</th></tr></thead><tbody>{products.map(product => <tr key={product.id}><td className="font-medium">{product.name}</td><td className="text-xs text-gray-500">{product.sku}</td><td className="text-right">{product.current_stock} {product.unit}</td><td><input aria-label={`Stock adjustment for ${product.name}`} type="number" step="0.01" placeholder="0" value={bulkQuantities[product.id] || ''} onChange={e => setBulkQuantities(previous => ({ ...previous, [product.id]: e.target.value }))} className="input h-8 text-right text-sm" /></td></tr>)}</tbody></table>
        </div>
        <div className="flex gap-3 mt-4"><button onClick={submitBulkStock} className="btn-primary flex-1">Update Stock</button><button onClick={() => setBulkModal(false)} className="btn-secondary flex-1">Cancel</button></div>
      </Modal>

      <Modal open={importModal} onClose={() => !importing && setImportModal(false)} title="Import Stock from File" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Upload a CSV or Excel file (.xlsx/.xlsm) to update existing products. Match each product by <b>SKU</b> (recommended) or Product Name.</p>
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900 space-y-1">
            <p><b>To add or remove stock:</b> use columns <code>SKU, Quantity</code>; negative quantities remove stock.</p>
            <p><b>To set an exact balance:</b> use <code>SKU, Current Stock</code>.</p>
          </div>
          <button type="button" onClick={downloadImportTemplate} className="text-sm text-blue-700 inline-flex items-center gap-1 hover:underline"><Download size={15} /> Download CSV template</button>
          <input type="file" accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e => setImportFile(e.target.files?.[0] || null)} className="block w-full text-sm" disabled={importing} />
          {importFile && <p className="text-xs text-gray-500">Selected: {importFile.name}</p>}
          <div className="flex gap-3"><button onClick={importStock} disabled={importing} className="btn-primary flex-1">{importing ? 'Importing...' : 'Import Stock'}</button><button onClick={() => setImportModal(false)} disabled={importing} className="btn-secondary flex-1">Cancel</button></div>
        </div>
      </Modal>
    </div>
  )
}
