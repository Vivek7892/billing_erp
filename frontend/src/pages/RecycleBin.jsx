import { useState, useEffect } from 'react'
import api from '../api'
import { PageHeader, Spinner, Modal } from '../components/UI'
import toast from 'react-hot-toast'
import {
  Trash2,
  RotateCcw,
  ShieldAlert,
  FileText,
  Package,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  User,
} from 'lucide-react'

export default function RecycleBin() {
  const [data, setData] = useState({
    cancelled_invoices: [],
    archived_products: [],
    cancelled_purchases: [],
    statutory_notice: '',
  })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('invoices') // invoices | products | purchases
  const [restoreModal, setRestoreModal] = useState({ open: false, item: null, reason: '' })
  const [restoring, setRestoring] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/recycle-bin/')
      setData(res.data)
    } catch {
      toast.error('Failed to load recycle bin records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRestoreProduct = async () => {
    if (!restoreModal.item) return
    setRestoring(true)
    try {
      await api.post(`/recycle-bin/product/${restoreModal.item.id}/restore/`, {
        reason: restoreModal.reason || 'Restored from Recycle Bin',
      })
      toast.success(`Product "${restoreModal.item.name}" restored successfully`)
      setRestoreModal({ open: false, item: null, reason: '' })
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to restore item')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="w-full min-w-0 space-y-4 pb-16 text-[var(--ink)]">
      {/* Header */}
      <PageHeader
        title="Recycle Bin & Reversal Register"
        subtitle="Manage soft-deleted catalog items and audit all cancelled statutory financial transactions."
        action={
          <button
            onClick={fetchData}
            className="btn-secondary btn-base flex items-center gap-1.5 text-xs font-semibold px-3"
          >
            <RotateCcw size={14} /> Refresh
          </button>
        }
      />

      {/* Statutory Notice Banner */}
      <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 p-3.5 text-xs dark:border-amber-900/50 dark:bg-amber-950/20">
        <div className="flex items-start gap-2.5">
          <ShieldAlert size={16} className="mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="space-y-1">
            <span className="font-semibold text-amber-900 dark:text-amber-200">
              Statutory Transaction Immutability (GST / ERP Accounting Rule)
            </span>
            <p className="leading-relaxed text-amber-800/90 dark:text-amber-300/80">
              {data.statutory_notice ||
                'Under statutory GST and ERP audit regulations, financial documents (invoices, payments, purchases) can NEVER be permanently deleted or un-cancelled. Cancelled transactions are permanently recorded here for audit inspection. Master catalog entities (such as inactive products) can be restored.'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--line)]">
        <button
          onClick={() => setTab('invoices')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            tab === 'invoices'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-[var(--ink-secondary)] hover:text-[var(--ink)]'
          }`}
        >
          <FileText size={14} /> Cancelled Invoices ({data.cancelled_invoices.length})
        </button>

        <button
          onClick={() => setTab('products')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            tab === 'products'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-[var(--ink-secondary)] hover:text-[var(--ink)]'
          }`}
        >
          <Package size={14} /> Archived Products ({data.archived_products.length})
        </button>

        <button
          onClick={() => setTab('purchases')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            tab === 'purchases'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-[var(--ink-secondary)] hover:text-[var(--ink)]'
          }`}
        >
          <ShoppingBag size={14} /> Cancelled Purchases ({data.cancelled_purchases.length})
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="py-16 text-center text-[var(--muted)]">
          <Spinner />
        </div>
      ) : tab === 'invoices' ? (
        /* Cancelled Invoices Table */
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="erp-table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-elevated)] font-semibold text-[var(--ink-secondary)]">
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Customer</th>
                  <th className="py-2.5 px-3">Cancelled At</th>
                  <th className="py-2.5 px-3">Cancelled By</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3">Statutory Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-subtle)]">
                {data.cancelled_invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[var(--muted)]">
                      <FileText size={24} className="mx-auto mb-1.5 opacity-40 text-indigo-500" />
                      <p className="font-medium">No cancelled invoices</p>
                    </td>
                  </tr>
                ) : (
                  data.cancelled_invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-[var(--surface-elevated)] transition-colors">
                      <td className="py-2.5 px-3 font-semibold font-mono text-[var(--ink)]">
                        {inv.invoice_number}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--ink)]">
                        {inv.customer__name || 'Walk-in Customer'}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--muted)] font-mono text-[11px]">
                        {inv.cancelled_at
                          ? new Date(inv.cancelled_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--ink-secondary)]">
                        {inv.cancelled_by__username || 'System'}
                      </td>
                      <td className="py-2.5 px-3 italic text-amber-700 dark:text-amber-400">
                        "{inv.cancel_reason || 'Reversed'}"
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[var(--ink)]">
                        ₹{Number(inv.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50">
                          Permanent Reversal (Immutable)
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'products' ? (
        /* Archived Products Table */
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="erp-table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-elevated)] font-semibold text-[var(--ink-secondary)]">
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Barcode</th>
                  <th className="py-2.5 px-3 text-right">Selling Price</th>
                  <th className="py-2.5 px-3 text-right">Stock</th>
                  <th className="py-2.5 px-3">Archived At</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-subtle)]">
                {data.archived_products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[var(--muted)]">
                      <Package size={24} className="mx-auto mb-1.5 opacity-40 text-indigo-500" />
                      <p className="font-medium">No archived products in recycle bin</p>
                    </td>
                  </tr>
                ) : (
                  data.archived_products.map(p => (
                    <tr key={p.id} className="hover:bg-[var(--surface-elevated)] transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-[var(--ink)]">
                        {p.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[var(--ink-secondary)]">
                        {p.sku || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[var(--ink-secondary)]">
                        {p.barcode || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[var(--ink)]">
                        ₹{Number(p.selling_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[var(--ink)]">
                        {p.current_stock}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--muted)] text-[11px] font-mono">
                        {p.updated_at
                          ? new Date(p.updated_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => setRestoreModal({ open: true, item: p, reason: '' })}
                          className="btn-primary btn-sm inline-flex items-center gap-1 text-[11px] px-2.5 py-1"
                        >
                          <RotateCcw size={12} /> Restore
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Cancelled Purchases Table */
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="erp-table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--surface-elevated)] font-semibold text-[var(--ink-secondary)]">
                  <th className="py-2.5 px-3">Purchase #</th>
                  <th className="py-2.5 px-3">Supplier</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-subtle)]">
                {data.cancelled_purchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[var(--muted)]">
                      <ShoppingBag size={24} className="mx-auto mb-1.5 opacity-40 text-indigo-500" />
                      <p className="font-medium">No cancelled purchases</p>
                    </td>
                  </tr>
                ) : (
                  data.cancelled_purchases.map(po => (
                    <tr key={po.id} className="hover:bg-[var(--surface-elevated)] transition-colors">
                      <td className="py-2.5 px-3 font-semibold font-mono text-[var(--ink)]">
                        {po.invoice_number}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--ink)]">
                        {po.supplier__name || 'Direct Supplier'}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--muted)] font-mono text-[11px]">
                        {po.created_at
                          ? new Date(po.created_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-[var(--ink-secondary)]">
                        {po.notes || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[var(--ink)]">
                        ₹{Number(po.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50">
                          Cancelled
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {restoreModal.open && (
        <Modal
          isOpen={restoreModal.open}
          onClose={() => setRestoreModal({ open: false, item: null, reason: '' })}
          title={`Restore Product: ${restoreModal.item?.name}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-[var(--ink-secondary)]">
              This will restore <strong className="text-[var(--ink)]">{restoreModal.item?.name}</strong> to your active product catalog and inventory. Please provide an audit justification.
            </p>

            <div>
              <label className="block mb-1.5 font-semibold text-[var(--ink)]">
                Reason for Restoration <span className="text-rose-500">*</span>
              </label>
              <textarea
                className="input w-full p-2.5 text-xs h-20 resize-y"
                placeholder="e.g. Restocked item, re-opened product line..."
                value={restoreModal.reason}
                onChange={e => setRestoreModal(p => ({ ...p, reason: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestoreModal({ open: false, item: null, reason: '' })}
                className="btn-secondary btn-base text-xs font-semibold px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestoreProduct}
                disabled={restoring}
                className="btn-primary btn-base text-xs font-semibold px-4"
              >
                {restoring ? 'Restoring...' : 'Confirm Restoration'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

