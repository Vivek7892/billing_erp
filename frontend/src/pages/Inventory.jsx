import { useState, useEffect } from 'react'
import inventoryService from '../features/inventory/api/inventoryService'
import { Badge, Card, PageHeader, Modal, Spinner, EmptyState } from '../components/UI'
import toast from 'react-hot-toast'
import { Search, ArrowUpCircle, ArrowDownCircle, Settings, Layers, Upload, Download, RefreshCw } from 'lucide-react'


function MobileStockCard({ product }) {
  const current = Number(product.current_stock || 0)
  const minimum = Number(product.minimum_stock || 0)

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">{product.name}</p>
          <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">{product.sku || 'No SKU'}</p>
        </div>
        <Badge status={product.stock_status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-[var(--surface-elevated)] p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-light)]">Current</p>
          <p className={`mt-1 text-sm font-bold ${
            current <= 0 ? 'text-red-600 dark:text-red-400' :
            current <= minimum ? 'text-yellow-600' :
            'text-green-600 dark:text-green-400'
          }`}>
            {product.current_stock} {product.unit}
          </p>
        </div>

        <div className="rounded-xl bg-[var(--surface-elevated)] p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-light)]">Minimum</p>
          <p className="mt-1 text-sm font-semibold text-[var(--ink-secondary)]">{product.minimum_stock}</p>
        </div>

        <div className="rounded-xl bg-[var(--surface-elevated)] p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-light)]">Purchase</p>
          <p className="mt-1 text-sm font-semibold text-[var(--ink-secondary)]">₹{product.purchase_price}</p>
        </div>

        <div className="rounded-xl bg-[var(--surface-elevated)] p-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-light)]">Selling</p>
          <p className="mt-1 text-sm font-semibold text-[var(--ink-secondary)]">₹{product.selling_price}</p>
        </div>
      </div>
    </div>
  )
}

function MobileTransactionCard({ transaction }) {
  const qty = Number(transaction.quantity || 0)
  const isSale = transaction.transaction_type === 'sale'

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--ink)]">
            {transaction.product_name}
          </p>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            {new Date(transaction.created_at).toLocaleDateString('en-IN')}
          </p>
        </div>

        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${
          isSale
            ? 'bg-red-100 text-red-700'
            : transaction.transaction_type === 'purchase'
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
        }`}>
          {isSale ? <ArrowDownCircle size={11} /> : <ArrowUpCircle size={11} />}
          {transaction.transaction_type.replace('_', ' ')}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-[var(--surface-elevated)] p-2.5">
        <div>
          <p className="text-[9px] uppercase tracking-wide text-[var(--muted-light)]">Qty</p>
          <p className={`mt-1 text-xs font-bold ${qty < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {qty > 0 ? '+' : ''}{transaction.quantity}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-[var(--muted-light)]">Before</p>
          <p className="mt-1 text-xs font-semibold text-[var(--ink-secondary)]">{transaction.before_stock}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wide text-[var(--muted-light)]">After</p>
          <p className="mt-1 text-xs font-semibold text-[var(--ink-secondary)]">{transaction.after_stock}</p>
        </div>
      </div>

      {transaction.reference && (
        <p className="mt-2 truncate text-[10px] text-[var(--muted-light)]">
          Ref: {transaction.reference}
        </p>
      )}
    </div>
  )
}

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
    inventoryService.getProducts(Object.fromEntries(params)).then(setProducts).finally(() => setLoading(false))
  }

  const loadTransactions = () => {
    setLoading(true)
    inventoryService.getTransactions({ page_size: 50 }).then(setTransactions).finally(() => setLoading(false))
  }

  useEffect(() => { tab === 'stock' ? loadProducts() : loadTransactions() }, [tab, search])

  const adjust = async () => {
    try {
      await inventoryService.adjustStock(adjustForm)
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
      await inventoryService.bulkAdjustStock(items)
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
      const data = await inventoryService.importStock(form)
      toast.success(`${data.imported} product${data.imported === 1 ? '' : 's'} updated from file`)
      setImportFile(null); setImportModal(false); loadProducts()
    } catch (e) {
      const errors = e.response?.data?.errors
      toast.error(errors?.[0] || e.response?.data?.detail || 'Could not import stock')
    } finally { setImporting(false) }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory"
        subtitle="Stock management"
        action={
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              onClick={() => setImportModal(true)}
              className="btn-secondary flex items-center justify-center gap-2 text-xs sm:text-sm"
            >
              <Upload size={16} />
              <span>Import File</span>
            </button>
            <button
              onClick={() => setBulkModal(true)}
              className="btn-secondary flex items-center justify-center gap-2 text-xs sm:text-sm"
            >
              <Layers size={16} />
              <span>Bulk Stock</span>
            </button>
            <button
              onClick={() => setAdjustModal(true)}
              className="btn-primary col-span-2 flex items-center justify-center gap-2 text-xs sm:col-span-1 sm:text-sm"
            >
              <Settings size={16} />
              <span>Adjust Stock</span>
            </button>
          </div>
        }
      />

      <div className="flex w-full gap-2 rounded-xl bg-gray-100 p-1 sm:w-fit">
        {['stock', 'transactions'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium capitalize transition sm:flex-none sm:px-4 ${
              tab === t
                ? 'bg-blue-600 text-white shadow-[var(--shadow-card)]'
                : 'text-[var(--muted)] hover:bg-[var(--surface)]'
            }`}
          >
            {t === 'stock' ? 'Current Stock' : 'Transactions'}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <>
          <Card className="p-2.5 sm:p-3">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-light)]" />
                <input
                  className="input w-full pl-8 pr-3 text-sm"
                  placeholder="Search products..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={() => loadProducts()}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface-elevated)]"
                title="Refresh stock"
                aria-label="Refresh stock"
              >
                <RefreshCw size={14} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </Card>
          <Card>
            {loading ? <Spinner /> : products.length === 0 ? <EmptyState /> : (
              <>
                <div className="space-y-2.5 p-2.5 sm:hidden">
                  {products.map(p => <MobileStockCard key={p.id} product={p} />)}
                </div>

                <div className="hidden overflow-x-auto sm:block">
                  <table className="table">
                    <thead><tr><th>Product</th><th>SKU</th><th>Current Stock</th><th>Min Stock</th><th>Purchase Price</th><th>Selling Price</th><th>Status</th></tr></thead>
                    <tbody>
                      {products.map(p => (
                        <tr key={p.id}>
                          <td className="font-medium">{p.name}</td>
                          <td className="font-mono text-sm">{p.sku}</td>
                          <td className={`font-bold ${p.current_stock <= 0 ? 'text-red-600 dark:text-red-400' : p.current_stock <= p.minimum_stock ? 'text-yellow-600' : 'text-green-600 dark:text-green-400'}`}>
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
              </>
            )}
          </Card>
        </>
      )}

      {tab === 'transactions' && (
        <Card>
          {loading ? <Spinner /> : transactions.length === 0 ? <EmptyState message="No transactions" /> : (
            <>
              <div className="space-y-2.5 p-2.5 sm:hidden">
                {transactions.map(t => <MobileTransactionCard key={t.id} transaction={t} />)}
              </div>

              <div className="hidden overflow-x-auto sm:block">
                <table className="table">
                  <thead><tr><th>Date</th><th>Product</th><th>Type</th><th>Qty</th><th>Before</th><th>After</th><th>Reference</th></tr></thead>
                  <tbody>
                    {transactions.map(t => (
                      <tr key={t.id}>
                        <td className="text-sm text-[var(--muted)]">{new Date(t.created_at).toLocaleDateString('en-IN')}</td>
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
                        <td className={`font-semibold ${t.quantity < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{t.quantity > 0 ? '+' : ''}{t.quantity}</td>
                        <td className="text-sm">{t.before_stock}</td>
                        <td className="text-sm font-medium">{t.after_stock}</td>
                        <td className="text-xs text-[var(--muted)]">{t.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
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
        <p className="text-sm text-[var(--muted)] mb-3">Enter quantities to add or remove. The current stock stays visible for every product.</p>
        <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-[var(--line)]">
          <div className="space-y-2 p-2 sm:hidden">
            {products.map(product => (
              <div key={product.id} className="rounded-xl bg-[var(--surface-elevated)] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[var(--ink)]">{product.name}</p>
                    <p className="mt-1 truncate text-[10px] text-[var(--muted)]">{product.sku}</p>
                  </div>
                  <p className="shrink-0 text-xs font-semibold text-[var(--ink-secondary)]">
                    {product.current_stock} {product.unit}
                  </p>
                </div>
                <input
                  aria-label={`Stock adjustment for ${product.name}`}
                  type="number"
                  step="0.01"
                  placeholder="Add / Remove"
                  value={bulkQuantities[product.id] || ''}
                  onChange={e => setBulkQuantities(previous => ({ ...previous, [product.id]: e.target.value }))}
                  className="input mt-2 h-9 w-full text-right text-sm"
                />
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="table text-sm">
              <thead><tr><th>Product</th><th>SKU</th><th className="text-right">Current</th><th className="text-right">Add / Remove</th></tr></thead>
              <tbody>
                {products.map(product => (
                  <tr key={product.id}>
                    <td className="font-medium">{product.name}</td>
                    <td className="text-xs text-[var(--muted)]">{product.sku}</td>
                    <td className="text-right">{product.current_stock} {product.unit}</td>
                    <td>
                      <input
                        aria-label={`Stock adjustment for ${product.name}`}
                        type="number"
                        step="0.01"
                        placeholder="0"
                        value={bulkQuantities[product.id] || ''}
                        onChange={e => setBulkQuantities(previous => ({ ...previous, [product.id]: e.target.value }))}
                        className="input h-8 text-right text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2"><button onClick={submitBulkStock} className="btn-primary w-full">Update Stock</button><button onClick={() => setBulkModal(false)} className="btn-secondary w-full">Cancel</button></div>
      </Modal>

      <Modal open={importModal} onClose={() => !importing && setImportModal(false)} title="Import Stock from File" size="md">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">Upload a CSV or Excel file (.xlsx/.xlsm) to update existing products. Match each product by <b>SKU</b> (recommended) or Product Name.</p>
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 p-3 text-xs text-blue-900 space-y-1">
            <p><b>To add or remove stock:</b> use columns <code>SKU, Quantity</code>; negative quantities remove stock.</p>
            <p><b>To set an exact balance:</b> use <code>SKU, Current Stock</code>.</p>
          </div>
          <button type="button" onClick={downloadImportTemplate} className="text-sm text-blue-700 inline-flex items-center gap-1 hover:underline"><Download size={15} /> Download CSV template</button>
          <input type="file" accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e => setImportFile(e.target.files?.[0] || null)} className="block w-full text-sm" disabled={importing} />
          {importFile && <p className="text-xs text-[var(--muted)]">Selected: {importFile.name}</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><button onClick={importStock} disabled={importing} className="btn-primary w-full">{importing ? 'Importing...' : 'Import Stock'}</button><button onClick={() => setImportModal(false)} disabled={importing} className="btn-secondary w-full">Cancel</button></div>
        </div>
      </Modal>
    </div>
  )
}