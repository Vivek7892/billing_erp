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
      />

      {/* Statutory Notice Banner — Clean Light Amber Alert */}
      {/* Statutory Notice Banner — Dark Muted Amber Alert */}
      <div className="rounded-xl border border-amber-800/50  p-3.5 sm:p-4 text-xs text-amber-200">
        <div className="flex items-start gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-900/50 text-amber-300 border border-amber-800/40 mt-0.5">
            <ShieldAlert size={16} />
          </div>
          <div className="space-y-1">
            <span className="font-semibold text-[var(--ink)]">
              Statutory Transaction Immutability (GST / ERP Accounting Rule)
            </span>
            <p className="leading-relaxed text-amber-300/90">
              {data.statutory_notice ||
                'Under statutory GST and ERP audit regulations, confirmed financial documents (invoices, payments, purchases) cannot be permanently deleted. Cancelled transactions are permanently recorded in this register for statutory audit. Master catalog items (such as archived products) can be restored.'}
            </p>
          </div>
        </div>
      </div>

      {/* Clean Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--line)] overflow-x-auto no-scrollbar">
        <button
          onClick={() => setTab('invoices')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
            tab === 'invoices'
              ? 'border-[#1E3A5F] text-[#1E3A5F] dark:text-slate-200'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <FileText size={14} />
          <span>Cancelled Invoices</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === 'invoices' ? 'bg-[#1E3A5F] text-white' : 'bg-[var(--line-subtle)] text-[var(--muted)]'}`}>
            {data.cancelled_invoices.length}
          </span>
        </button>

        <button
          onClick={() => setTab('products')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
            tab === 'products'
              ? 'border-[#1E3A5F] text-[#1E3A5F] dark:text-slate-200'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <Package size={14} />
          <span>Archived Products</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === 'products' ? 'bg-[#1E3A5F] text-white' : 'bg-[var(--line-subtle)] text-[var(--muted)]'}`}>
            {data.archived_products.length}
          </span>
        </button>

        <button
          onClick={() => setTab('purchases')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
            tab === 'purchases'
              ? 'border-[#1E3A5F] text-[#1E3A5F] dark:text-slate-200'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
          }`}
        >
          <ShoppingBag size={14} />
          <span>Cancelled Purchases</span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === 'purchases' ? 'bg-[#1E3A5F] text-white' : 'bg-[var(--line-subtle)] text-[var(--muted)]'}`}>
            {data.cancelled_purchases.length}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {loading ? (
        <div className="py-16 text-center text-[var(--muted)]">
          <Spinner />
        </div>
      ) : tab === 'invoices' ? (
        /* Cancelled Invoices */
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-xs">
          {/* Mobile Cards (sm:hidden) */}
          <div className="sm:hidden divide-y divide-[var(--line-subtle)]">
            {data.cancelled_invoices.length === 0 ? (
              <div className="py-10 text-center text-[var(--muted)]">
                <FileText size={22} className="mx-auto mb-1.5 opacity-40 text-[#1E3A5F] dark:text-slate-400" />
                <p className="font-medium text-xs">No cancelled invoices</p>
              </div>
            ) : (
              data.cancelled_invoices.map(inv => (
                <div key={inv.id} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[var(--ink)]">
                      {inv.invoice_number}
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--ink)]">
                      ₹{Number(inv.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--ink)] flex items-center justify-between">
                    <span>{inv.customer__name || 'Walk-in Customer'}</span>
                    <span className="text-[11px] font-mono text-[var(--muted)]">
                      {inv.cancelled_at ? new Date(inv.cancelled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                  {inv.cancel_reason && (
                    <div className="text-[11px] italic text-amber-300 bg-amber-950/30 p-1.5 rounded border border-amber-800/40">
                      "{inv.cancel_reason}"
                    </div>
                  )}
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[11px] text-[var(--muted)]">By: {inv.cancelled_by__username || 'System'}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semiboldtext-rose-300 border border-rose-800/50">
                      Permanent Reversal (Immutable)
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="erp-table w-full text-left text-xs min-w-[680px]">
              <thead>
                <tr className=" border-b border-[var(--line)] bg-[var(--surface-elevated)] font-semibold text-[var(--ink-secondary)]">
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
                      <FileText size={24} className="mx-auto mb-1.5 opacity-40 text-[#1E3A5F] dark:text-slate-400" />
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
                      <td className="font-mono text-[var(--ink-secondary)] py-2.5 px-3">
                        "{inv.cancel_reason || 'Reversed'}"
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-[var(--ink)]">
                        ₹{Number(inv.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[var(--ink-secondary)] py-2.5 px-3">
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
        /* Archived Products */
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-xs">
          {/* Mobile Cards (sm:hidden) */}
          <div className="sm:hidden divide-y divide-[var(--line-subtle)]">
            {data.archived_products.length === 0 ? (
              <div className="py-10 text-center text-[var(--muted)]">
                <Package size={22} className="mx-auto mb-1.5 opacity-40 text-[#1E3A5F] dark:text-slate-400" />
                <p className="font-medium text-xs">No archived products in recycle bin</p>
              </div>
            ) : (
              data.archived_products.map(p => (
                <div key={p.id} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[var(--ink)]">
                      {p.name}
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--ink)]">
                      ₹{Number(p.selling_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted)] font-mono">
                    <span>SKU: {p.sku || '—'} · Stock: {p.current_stock}</span>
                    <span>{p.updated_at ? new Date(p.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                  </div>
                  <div className="pt-1 flex justify-end">
                    <button
                      onClick={() => setRestoreModal({ open: true, item: p, reason: '' })}
                      className="btn-primary btn-sm inline-flex items-center gap-1 text-[11px] px-3 py-1 rounded-lg"
                    >
                      <RotateCcw size={12} /> Restore Item
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="erp-table w-full text-left text-xs min-w-[680px]">
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
                      <Package size={24} className="mx-auto mb-1.5 opacity-40 text-[#1E3A5F] dark:text-slate-400" />
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
        /* Cancelled Purchases */
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-xs">
          {/* Mobile Cards (sm:hidden) */}
          <div className="sm:hidden divide-y divide-[var(--line-subtle)]">
            {data.cancelled_purchases.length === 0 ? (
              <div className="py-10 text-center text-[var(--muted)]">
                <ShoppingBag size={22} className="mx-auto mb-1.5 opacity-40 text-[#1E3A5F] dark:text-slate-400" />
                <p className="font-medium text-xs">No cancelled purchases</p>
              </div>
            ) : (
              data.cancelled_purchases.map(po => (
                <div key={po.id} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[var(--ink)]">
                      {po.invoice_number}
                    </span>
                    <span className="font-mono font-bold text-sm text-[var(--ink)]">
                      ₹{Number(po.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--ink)]">
                    <span>{po.supplier__name || 'Direct Supplier'}</span>
                    <span className="text-[11px] font-mono text-[var(--muted)]">
                      {po.created_at ? new Date(po.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                  {po.notes && (
                    <div className="text-[11px] text-[var(--muted)] bg-[var(--surface-elevated)] p-1.5 rounded border border-[var(--line-subtle)]">
                      {po.notes}
                    </div>
                  )}
                  <div className="pt-1 flex justify-end">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/40 text-rose-300 border border-rose-800/50">
                      Cancelled
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Table (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="erp-table w-full text-left text-xs min-w-[640px]">
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
                      <ShoppingBag size={24} className="mx-auto mb-1.5 opacity-40 text-[#1E3A5F] dark:text-slate-400" />
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
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/40 text-rose-300 border border-rose-800/50">
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
