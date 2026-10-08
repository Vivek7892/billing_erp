import { Fragment, useState, useEffect, useMemo, useRef } from 'react'
import api from '../api'
import { Badge, PageHeader, Modal, Spinner, EmptyState, ConfirmDialog } from '../components/UI'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Printer, Package, ChevronDown, ChevronRight,
  Building2, Phone, Mail, MapPin, Edit2, Search, Save,
  Wallet, Clock3, ClipboardList, TrendingUp, Filter, MessageCircle,
  FileSpreadsheet, Upload, Download, CheckCircle2, AlertCircle, AlertTriangle,
  RotateCcw, Check, ArrowRight, FileText
} from 'lucide-react'
import CommunicationHistory from '../components/CommunicationHistory'

const fmt = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const fmt2 = v => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

/* Adaptive Input Style — completely responsive to Light and Dark mode */
const inputCls =
  'input h-9 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] text-sm text-[var(--ink)] ' +
  'placeholder:text-[var(--placeholder)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] ' +
  'transition-colors duration-150'

const dueOf = p => Math.max(0, Number(p.total_amount || 0) - Number(p.paid_amount || 0))

/* Surface Tokens matching ERP Theme */
const cardCls =
  'rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-xs)]'
const cardHover =
  'transition-all duration-150 hover:border-[var(--line-strong)]'
const tableCls =
  '[&_thead]:bg-[var(--surface-elevated)] [&_th]:text-[11px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-[var(--muted)] ' +
  '[&_th]:border-b [&_th]:border-[var(--line)] [&_td]:border-b [&_td]:border-[var(--line-subtle)] [&_td]:text-[var(--ink-secondary)]'

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
      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <label className="label text-xs font-semibold text-[var(--ink-secondary)]">Name *</label>
          <input className={inputCls} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label text-xs font-semibold text-[var(--ink-secondary)]">Phone</label>
            <input className={inputCls} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="label text-xs font-semibold text-[var(--ink-secondary)]">Email</label>
            <input className={inputCls} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="label text-xs font-semibold text-[var(--ink-secondary)]">Address</label>
          <textarea className={`${inputCls} h-20 py-2`} rows={2} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
        </div>
        <div>
          <label className="label text-xs font-semibold text-[var(--ink-secondary)]">GSTIN</label>
          <input className={inputCls} value={form.gstin} onChange={e => setForm(p => ({ ...p, gstin: e.target.value }))} />
        </div>
        <div className="flex gap-2.5 pt-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            <Save size={14} />{saving ? 'Saving…' : 'Save Supplier'}
          </button>
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
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-elevated)] border border-[var(--line)] text-[#1E3A5F] dark:text-slate-200">
            <Building2 size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base text-[var(--ink)]">{supplier.name}</span>
              {supplier.gstin && (
                <span className="text-xs font-mono text-[var(--muted)] bg-[var(--surface-elevated)] border border-[var(--line)] px-2 py-0.5 rounded">
                  GST: {supplier.gstin}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 flex-wrap sm:w-auto sm:flex-nowrap sm:flex-shrink-0">
          {supplier.outstanding_amount > 0 && (
            <span className="text-xs bg-rose-950/40 border border-rose-800/50 text-rose-300 font-semibold px-2.5 py-1 rounded-lg">
              Due: {fmt(supplier.outstanding_amount)}
            </span>
          )}
          <span className="text-xs bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--muted)] font-medium px-2.5 py-1 rounded-full">
            {supProducts.length} product{supProducts.length !== 1 ? 's' : ''}
          </span>
          <button onClick={() => onEdit(supplier)} className="icon-btn hover:bg-[var(--surface-hover)] text-[var(--ink-secondary)]" title="Edit supplier">
            <Edit2 size={14} />
          </button>
          <button onClick={() => onDelete(supplier)} className="icon-btn hover:bg-rose-950/50 text-rose-400" title="Delete supplier">
            <Trash2 size={14} />
          </button>
          <button onClick={() => setExpanded(x => !x)} className="icon-btn hover:bg-[var(--surface-hover)] text-[var(--ink-secondary)]" title={expanded ? 'Collapse' : 'Expand products'}>
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[var(--line)] bg-[var(--surface-elevated)] px-4 sm:px-5 py-4">
          {supplier.address && (
            <p className="text-xs text-[var(--muted)] flex items-start gap-1.5 mb-3 bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--line-subtle)]">
              <MapPin size={12} className="mt-0.5 flex-shrink-0 text-[var(--muted-light)]" />
              {supplier.address}
            </p>
          )}
          {supProducts.length === 0 ? (
            <p className="text-xs text-[var(--muted)] py-2">No products linked to this supplier.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
              <table className={`table text-xs ${tableCls}`}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Stock</th>
                    <th>Purchase Price</th>
                    <th>Selling Price</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {supProducts.map(p => (
                    <tr key={p.id} className="hover:bg-[var(--surface-hover)]">
                      <td className="font-semibold text-[var(--ink)]">{p.name}</td>
                      <td className="font-mono text-[var(--muted)]">{p.sku || '—'}</td>
                      <td className={`font-semibold tabular-nums ${p.current_stock <= 0 ? 'text-rose-600 dark:text-rose-400' : p.current_stock <= p.minimum_stock ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {p.current_stock}
                      </td>
                      <td className="tabular-nums text-[var(--ink-secondary)]">{fmt(p.purchase_price)}</td>
                      <td className="tabular-nums text-[var(--ink-secondary)]">{fmt(p.selling_price)}</td>
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

/* ============================================================
   PURCHASE & SUPPLIER BULK EXCEL IMPORT MODAL
   Flow:
   Upload Excel -> Validate -> Preview -> Highlight Errors -> Confirm Import -> Import -> Success / Failure Report
============================================================ */

function PurchaseBulkImportModal({ open, onClose, onSuccess, initialMode = 'orders' }) {
  const [mode, setMode] = useState(initialMode) // 'orders' | 'suppliers'
  const [step, setStep] = useState('upload') // 'upload' | 'preview' | 'report'
  const [file, setFile] = useState(null)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [validationResult, setValidationResult] = useState(null)
  const [importReport, setImportReport] = useState(null)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'valid' | 'errors'
  const [createMissingSuppliers, setCreateMissingSuppliers] = useState(true)
  const [updateExistingSuppliers, setUpdateExistingSuppliers] = useState(true)
  const [skipErrors, setSkipErrors] = useState(true)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [expandedOrders, setExpandedOrders] = useState(new Set())
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setMode(initialMode)
      setStep('upload')
      setFile(null)
      setValidating(false)
      setImporting(false)
      setValidationResult(null)
      setImportReport(null)
      setActiveTab('all')
      setCreateMissingSuppliers(true)
      setUpdateExistingSuppliers(true)
      setSkipErrors(true)
      setExpandedOrders(new Set())
    }
  }, [open, initialMode])

  const toggleExpandOrder = (idx) => {
    setExpandedOrders(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleDownloadTemplate = async (format = 'xlsx') => {
    setDownloadingTemplate(true)
    const endpoint = mode === 'orders' ? '/purchases/import-template/' : '/suppliers/import-template/'
    const filename = mode === 'orders' ? 'Purchase_Import_Template.xlsx' : 'Supplier_Import_Template.xlsx'
    try {
      const res = await api.get(endpoint, { responseType: 'blob' })
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Template downloaded successfully')
    } catch {
      toast.error('Failed to download template')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const handleFileChange = e => {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  const handleDrop = e => {
    e.preventDefault()
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) setFile(dropped)
  }

  const handleValidate = async () => {
    if (!file) return toast.error('Please select an Excel or CSV file')
    setValidating(true)
    const formData = new FormData()
    formData.append('file', file)

    const endpoint = mode === 'orders' ? '/purchases/validate-import/' : '/suppliers/validate-import/'
    try {
      const res = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setValidationResult(res.data)
      const errorsCount = mode === 'orders' ? res.data.error_orders_count : res.data.error_rows_count
      const totalCount = mode === 'orders' ? res.data.total_orders : res.data.total_rows
      const validCount = mode === 'orders' ? res.data.valid_orders_count : res.data.valid_rows_count

      if (errorsCount > 0) {
        toast(`Validated ${totalCount} records: ${validCount} valid, ${errorsCount} with errors`, { icon: '⚠️' })
      } else {
        toast.success(`All ${totalCount} records are valid and ready to import!`)
      }
      setStep('preview')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to read and validate import file')
    } finally {
      setValidating(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!validationResult) return

    setImporting(true)
    try {
      if (mode === 'orders') {
        let ordersToImport = validationResult.orders || []
        if (skipErrors) {
          ordersToImport = ordersToImport.filter(o => o.is_valid)
        } else {
          const hasErr = ordersToImport.some(o => !o.is_valid)
          if (hasErr) {
            toast.error('Please resolve errors or enable "Skip orders with errors"')
            setImporting(false)
            return
          }
        }

        if (ordersToImport.length === 0) {
          toast.error('No valid purchase orders available to import')
          setImporting(false)
          return
        }

        const res = await api.post('/purchases/bulk-import/', {
          orders: ordersToImport,
          create_missing_suppliers: createMissingSuppliers,
        })
        setImportReport(res.data)
        setStep('report')
        toast.success(`Successfully imported ${res.data.created_count} purchase orders!`)
      } else {
        let rowsToImport = validationResult.rows || []
        if (skipErrors) {
          rowsToImport = rowsToImport.filter(r => r.is_valid)
        } else {
          const hasErr = rowsToImport.some(r => !r.is_valid)
          if (hasErr) {
            toast.error('Please resolve errors or enable "Skip rows with errors"')
            setImporting(false)
            return
          }
        }

        if (rowsToImport.length === 0) {
          toast.error('No valid supplier rows available to import')
          setImporting(false)
          return
        }

        const res = await api.post('/suppliers/bulk-import/', {
          rows: rowsToImport,
          update_existing: updateExistingSuppliers,
        })
        setImportReport(res.data)
        setStep('report')
        toast.success(`Successfully imported ${res.data.created_count + res.data.updated_count} suppliers!`)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to complete import')
    } finally {
      setImporting(false)
    }
  }

  const handleDone = () => {
    onSuccess?.()
    onClose()
  }

  // Preview filtering for Orders
  const displayedOrders = useMemo(() => {
    if (!validationResult?.orders) return []
    if (activeTab === 'valid') return validationResult.orders.filter(o => o.is_valid)
    if (activeTab === 'errors') return validationResult.orders.filter(o => !o.is_valid)
    return validationResult.orders
  }, [validationResult, activeTab])

  // Preview filtering for Suppliers
  const displayedRows = useMemo(() => {
    if (!validationResult?.rows) return []
    if (activeTab === 'valid') return validationResult.rows.filter(r => r.is_valid)
    if (activeTab === 'errors') return validationResult.rows.filter(r => !r.is_valid)
    return validationResult.rows
  }, [validationResult, activeTab])

  const validOrdersCount = useMemo(() => {
    if (mode === 'orders') {
      if (!validationResult?.orders) return 0
      return skipErrors
        ? validationResult.orders.filter(o => o.is_valid).length
        : validationResult.orders.length
    } else {
      if (!validationResult?.rows) return 0
      return skipErrors
        ? validationResult.rows.filter(r => r.is_valid).length
        : validationResult.rows.length
    }
  }, [mode, validationResult, skipErrors])

  return (
    <Modal
      open={open}
      onClose={() => !importing && !validating && onClose()}
      title="Bulk Excel Import"
      size="xl"
    >
      <div className="space-y-4">
        {/* Top Header: Mode Selector & Step Indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--line)] pb-3">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 border border-[var(--line)] bg-[var(--surface-elevated)] p-1 rounded-md">
            <button
              type="button"
              onClick={() => {
                setMode('orders')
                setStep('upload')
                setFile(null)
                setValidationResult(null)
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
                mode === 'orders'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Package size={13} />
                <span>Purchase Orders</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('suppliers')
                setStep('upload')
                setFile(null)
                setValidationResult(null)
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
                mode === 'suppliers'
                  ? 'bg-[#1E3A5F] text-white shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Building2 size={13} />
                <span>Suppliers</span>
              </div>
            </button>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                step === 'upload'
                  ? 'bg-[#1E3A5F] text-white'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}
            >
              {step !== 'upload' ? <Check size={11} /> : '1'}
            </span>
            <span className={step === 'upload' ? 'font-bold text-[var(--ink)]' : 'text-[var(--muted)]'}>
              Upload
            </span>

            <ArrowRight size={12} className="text-[var(--muted-light)]" />

            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                step === 'preview'
                  ? 'bg-[#1E3A5F] text-white'
                  : step === 'report'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--muted)]'
              }`}
            >
              {step === 'report' ? <Check size={11} /> : '2'}
            </span>
            <span className={step === 'preview' ? 'font-bold text-[var(--ink)]' : 'text-[var(--muted)]'}>
              Validate & Preview
            </span>

            <ArrowRight size={12} className="text-[var(--muted-light)]" />

            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                step === 'report'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--muted)]'
              }`}
            >
              3
            </span>
            <span className={step === 'report' ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-[var(--muted)]'}>
              Report
            </span>
          </div>
        </div>

        {/* ====================================================
            STEP 1: UPLOAD EXCEL
        ==================================================== */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Download Template Banner */}
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-[var(--surface)] border border-[var(--line)] flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--ink)]">
                    {mode === 'orders' ? 'Purchase Order Import Template' : 'Supplier Import Template'}
                  </h4>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">
                    {mode === 'orders'
                      ? 'Pre-formatted sheet with supplier, invoice, product SKU/name, quantity, and price columns.'
                      : 'Pre-formatted sheet with company name, phone, email, address, and GSTIN.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('xlsx')}
                  disabled={downloadingTemplate}
                  className="btn-secondary h-8 px-3 text-xs flex items-center gap-1.5 rounded-md"
                >
                  <Download size={13} />
                  <span>{downloadingTemplate ? 'Downloading...' : 'Download Template (.xlsx)'}</span>
                </button>
              </div>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--line)] hover:border-[#1E3A5F] dark:hover:border-blue-400 rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-colors bg-[var(--surface)]"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-full bg-[var(--surface-elevated)] border border-[var(--line)] flex items-center justify-center mx-auto mb-3 text-[#1E3A5F] dark:text-slate-200">
                <Upload size={22} />
              </div>

              <h4 className="text-sm font-bold text-[var(--ink)]">
                {file ? file.name : `Choose an Excel or CSV file to import ${mode === 'orders' ? 'purchases' : 'suppliers'}`}
              </h4>

              <p className="text-xs text-[var(--muted)] mt-1 max-w-md mx-auto">
                {file
                  ? `File size: ${(file.size / 1024).toFixed(1)} KB — Click to change file`
                  : 'Drag and drop your spreadsheet here, or click to browse. Supports .xlsx, .xls, and .csv up to 5 MB.'}
              </p>

              {file && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-semibold">
                  <CheckCircle2 size={13} />
                  File loaded & ready for validation
                </div>
              )}
            </div>

            {/* Guidelines box */}
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] p-3 space-y-1.5 text-xs">
              <span className="font-bold text-[var(--ink)] block">
                {mode === 'orders' ? 'Purchase Order Formatting Rules:' : 'Supplier Column Guidelines:'}
              </span>
              {mode === 'orders' ? (
                <ul className="text-[11px] text-[var(--muted)] space-y-1 list-disc pl-4">
                  <li>
                    <strong className="text-[var(--ink)]">Multi-item POs</strong>: Group items under the same purchase order by giving them the same <code>Supplier Name</code> and <code>Invoice Number</code>.
                  </li>
                  <li>
                    <strong className="text-[var(--ink)]">Product SKU or Name*</strong>: Must match an active inventory product in your system.
                  </li>
                  <li>
                    <strong className="text-[var(--ink)]">Quantity* & Price*</strong>: Numeric values greater than zero.
                  </li>
                  <li>
                    <strong className="text-[var(--ink)]">Stock Movement</strong>: Successfully imported purchases automatically increment inventory stock.
                  </li>
                </ul>
              ) : (
                <ul className="text-[11px] text-[var(--muted)] space-y-1 list-disc pl-4">
                  <li><strong className="text-[var(--ink)]">Company / Supplier Name*</strong>: Required.</li>
                  <li><strong className="text-[var(--ink)]">GSTIN</strong>: Optional 15 alphanumeric characters.</li>
                  <li><strong className="text-[var(--ink)]">Phone</strong>: 10 to 15 digits.</li>
                </ul>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary h-9 px-4 text-xs"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleValidate}
                disabled={!file || validating}
                className="btn-primary h-9 px-4 text-xs flex items-center justify-center gap-1.5"
              >
                {validating ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>Validating File...</span>
                  </>
                ) : (
                  <>
                    <span>Validate & Preview</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ====================================================
            STEP 2: VALIDATE, PREVIEW & HIGHLIGHT ERRORS
        ==================================================== */}
        {step === 'preview' && validationResult && (
          <div className="space-y-4">
            {/* KPI Metrics Strip */}
            <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
              <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
                <div className="p-2.5 sm:p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    {mode === 'orders' ? 'Total POs' : 'Total Suppliers'}
                  </span>
                  <p className="mt-1 font-mono text-base sm:text-lg font-bold text-[var(--ink)]">
                    {mode === 'orders' ? validationResult.total_orders : validationResult.total_rows}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {mode === 'orders' ? `${validationResult.total_rows} line items` : 'In spreadsheet'}
                  </p>
                </div>

                <div className="p-2.5 sm:p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Ready to Import
                  </span>
                  <p className="mt-1 font-mono text-base sm:text-lg font-bold text-teal-600 dark:text-teal-400">
                    {mode === 'orders' ? validationResult.valid_orders_count : validationResult.valid_rows_count}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">Valid records</p>
                </div>

                <div className="p-2.5 sm:p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    With Errors
                  </span>
                  <p
                    className={`mt-1 font-mono text-base sm:text-lg font-bold ${
                      (mode === 'orders' ? validationResult.error_orders_count : validationResult.error_rows_count) > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-teal-600 dark:text-teal-400'
                    }`}
                  >
                    {mode === 'orders' ? validationResult.error_orders_count : validationResult.error_rows_count}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {(mode === 'orders' ? validationResult.error_orders_count : validationResult.error_rows_count) > 0 ? 'Requires attention' : '0 validation issues'}
                  </p>
                </div>

                <div className="p-2.5 sm:p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    {mode === 'orders' ? 'Est. Total Value' : 'Will Update'}
                  </span>
                  <p className="mt-1 font-mono text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
                    {mode === 'orders'
                      ? fmt(validationResult.orders?.reduce((s, o) => s + (o.total_amount || 0), 0))
                      : validationResult.update_count}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {mode === 'orders' ? 'Gross procurement' : 'Existing vendor matches'}
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-1 border border-[var(--line)] bg-[var(--surface)] p-1 rounded-md">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    activeTab === 'all'
                      ? 'bg-[#1E3A5F] text-white'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  All ({mode === 'orders' ? validationResult.total_orders : validationResult.total_rows})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('valid')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    activeTab === 'valid'
                      ? 'bg-teal-700 text-white'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  Valid ({mode === 'orders' ? validationResult.valid_orders_count : validationResult.valid_rows_count})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('errors')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    activeTab === 'errors'
                      ? 'bg-red-700 text-white'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  Errors ({mode === 'orders' ? validationResult.error_orders_count : validationResult.error_rows_count})
                </button>
              </div>

              <div className="text-xs text-[var(--muted)]">
                Showing{' '}
                <strong className="text-[var(--ink)]">
                  {mode === 'orders' ? displayedOrders.length : displayedRows.length}
                </strong>{' '}
                records
              </div>
            </div>

            {/* Preview Table: Purchase Orders Mode */}
            {mode === 'orders' ? (
              <div className="overflow-x-auto max-h-[340px] border border-[var(--line)] rounded-md bg-[var(--surface)]">
                <table className="erp-table w-full text-xs min-w-[850px]">
                  <thead className="sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="w-10 text-center">#</th>
                      <th className="w-20">Status</th>
                      <th>Invoice / PO #</th>
                      <th>Supplier</th>
                      <th>Date</th>
                      <th className="text-center">Items</th>
                      <th className="text-right">Total</th>
                      <th className="text-right">Paid</th>
                      <th>Validation Issues</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[var(--line-subtle)]">
                    {displayedOrders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-xs text-[var(--muted)]">
                          No purchase orders match this filter.
                        </td>
                      </tr>
                    ) : (
                      displayedOrders.map((ord, idx) => {
                        const hasErrors = !ord.is_valid
                        const isExpanded = expandedOrders.has(idx)

                        return (
                          <Fragment key={idx}>
                            <tr
                              className={`transition-colors cursor-pointer ${
                                hasErrors
                                  ? 'bg-red-500/10 hover:bg-red-500/15'
                                  : 'hover:bg-[var(--surface-hover)]'
                              }`}
                              onClick={() => toggleExpandOrder(idx)}
                            >
                              <td className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                  <span className="font-mono text-[10px] text-[var(--muted)]">{idx + 1}</span>
                                </div>
                              </td>

                              <td>
                                {hasErrors ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                                    <AlertCircle size={10} /> Error
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                                    <Check size={10} /> Valid
                                  </span>
                                )}
                              </td>

                              <td className="font-mono font-bold text-[var(--ink)]">
                                {ord.invoice_number}
                              </td>

                              <td>
                                <div className="font-semibold text-[var(--ink)]">{ord.supplier_name || '—'}</div>
                                {!ord.supplier_exists && ord.supplier_name && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                    (New supplier — will create)
                                  </span>
                                )}
                              </td>

                              <td className="text-[var(--ink-secondary)] whitespace-nowrap">
                                {ord.purchase_date}
                              </td>

                              <td className="text-center font-mono font-semibold">
                                {ord.items_count} item{ord.items_count !== 1 ? 's' : ''}
                              </td>

                              <td className="text-right font-mono font-bold tabular-nums text-[var(--ink)]">
                                {fmt(ord.total_amount)}
                              </td>

                              <td className="text-right font-mono tabular-nums text-[var(--ink-secondary)]">
                                {fmt(ord.paid_amount)}
                              </td>

                              <td>
                                {hasErrors ? (
                                  <div className="space-y-0.5 max-w-[240px]">
                                    {ord.errors.map((err, eIdx) => (
                                      <div key={eIdx} className="text-[11px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                                        <AlertCircle size={10} className="shrink-0" />
                                        <span>{err}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
                                    <Check size={11} /> Ready to import
                                  </span>
                                )}
                              </td>
                            </tr>

                            {/* Expanded items row */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={9} className="bg-[var(--surface-elevated)] p-3 border-y border-[var(--line)]">
                                  <div className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">
                                    Line items for {ord.invoice_number} ({ord.items.length})
                                  </div>
                                  <table className="w-full text-xs border border-[var(--line)] bg-[var(--surface)] rounded">
                                    <thead>
                                      <tr className="border-b border-[var(--line)] bg-[var(--surface-elevated)] text-[10px] uppercase font-bold text-[var(--muted)]">
                                        <th className="p-1.5 text-center">Row</th>
                                        <th className="p-1.5 text-left">Product</th>
                                        <th className="p-1.5 text-left">SKU</th>
                                        <th className="p-1.5 text-right">Qty</th>
                                        <th className="p-1.5 text-right">Unit Price</th>
                                        <th className="p-1.5 text-right">GST %</th>
                                        <th className="p-1.5 text-right">Total</th>
                                        <th className="p-1.5 text-left">Issues</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--line-subtle)]">
                                      {ord.items.map((it, itIdx) => (
                                        <tr key={itIdx} className={it.is_valid ? '' : 'bg-red-500/10'}>
                                          <td className="p-1.5 text-center font-mono text-[10px] text-[var(--muted)]">{it.row_number}</td>
                                          <td className="p-1.5 font-semibold text-[var(--ink)]">{it.product_name}</td>
                                          <td className="p-1.5 font-mono text-[10px] text-[var(--muted)]">{it.product_sku || '—'}</td>
                                          <td className="p-1.5 text-right font-mono">{it.quantity}</td>
                                          <td className="p-1.5 text-right font-mono">{fmt(it.purchase_price)}</td>
                                          <td className="p-1.5 text-right font-mono">{it.gst_percent}%</td>
                                          <td className="p-1.5 text-right font-mono font-bold">{fmt(it.line_total)}</td>
                                          <td className="p-1.5 text-red-600 dark:text-red-400 font-semibold text-[10px]">
                                            {it.errors?.join(', ') || '✓'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Preview Table: Suppliers Mode */
              <div className="overflow-x-auto max-h-[340px] border border-[var(--line)] rounded-md bg-[var(--surface)]">
                <table className="erp-table w-full text-xs min-w-[760px]">
                  <thead className="sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="w-12 text-center">Row</th>
                      <th className="w-24">Status</th>
                      <th>Company / Name</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>GSTIN</th>
                      <th>Validation Issues</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line-subtle)]">
                    {displayedRows.map(row => {
                      const hasErrors = !row.is_valid
                      return (
                        <tr key={row.row_number} className={hasErrors ? 'bg-red-500/10' : ''}>
                          <td className="text-center font-mono text-[11px] text-[var(--muted)]">{row.row_number}</td>
                          <td>
                            {hasErrors ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">Error</span>
                            ) : row.action === 'update' ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">Will Update</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">New</span>
                            )}
                          </td>
                          <td className="font-semibold text-[var(--ink)]">{row.name || 'Missing Name'}</td>
                          <td className="font-mono text-[11px]">{row.phone || '—'}</td>
                          <td className="text-[11px]">{row.email || '—'}</td>
                          <td className="font-mono text-[11px]">{row.gstin || '—'}</td>
                          <td>
                            {hasErrors ? (
                              <span className="text-red-600 dark:text-red-400 font-semibold text-[11px]">
                                {row.errors?.join(', ')}
                              </span>
                            ) : (
                              <span className="text-teal-600 dark:text-teal-400 font-semibold text-[11px] flex items-center gap-1">
                                <Check size={11} /> Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Options Flags */}
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] p-3 space-y-2">
              {mode === 'orders' ? (
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={createMissingSuppliers}
                    onChange={e => setCreateMissingSuppliers(e.target.checked)}
                    className="rounded border-[var(--line)] text-[#1E3A5F] focus:ring-0"
                  />
                  <span>Create missing suppliers automatically if they do not exist yet</span>
                </label>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={updateExistingSuppliers}
                    onChange={e => setUpdateExistingSuppliers(e.target.checked)}
                    className="rounded border-[var(--line)] text-[#1E3A5F] focus:ring-0"
                  />
                  <span>Update existing suppliers if matching Name or GSTIN is found</span>
                </label>
              )}

              {((mode === 'orders' ? validationResult.error_orders_count : validationResult.error_rows_count) > 0) && (
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={skipErrors}
                    onChange={e => setSkipErrors(e.target.checked)}
                    className="rounded border-[var(--line)] text-[#1E3A5F] focus:ring-0"
                  />
                  <span>
                    Skip records with errors and import only valid records ({mode === 'orders' ? validationResult.valid_orders_count : validationResult.valid_rows_count})
                  </span>
                </label>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-4">
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={importing}
                className="btn-secondary h-9 px-3.5 text-xs flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                Upload Different File
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={importing}
                  className="btn-secondary h-9 px-4 text-xs"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={validOrdersCount === 0 || importing}
                  className="btn-primary h-9 px-4 text-xs flex items-center gap-1.5"
                >
                  {importing ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Confirm & Import ({validOrdersCount} {mode === 'orders' ? 'Orders' : 'Suppliers'})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================
            STEP 3: SUCCESS / FAILURE REPORT
        ==================================================== */}
        {step === 'report' && importReport && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-md border ${
                importReport.failed_count === 0
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-100'
              }`}
            >
              <div className="flex items-start gap-3">
                {importReport.failed_count === 0 ? (
                  <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={24} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}

                <div>
                  <h4 className="text-sm font-bold">
                    {importReport.failed_count === 0
                      ? `Bulk ${mode === 'orders' ? 'Purchase Order' : 'Supplier'} Import Completed Successfully!`
                      : 'Bulk Import Completed with Warnings'}
                  </h4>
                  <p className="text-xs mt-0.5 opacity-90">
                    Processed {importReport.total_processed} records from your spreadsheet.
                  </p>
                </div>
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
              <div className="grid grid-cols-3 divide-x divide-[var(--line)]">
                <div className="p-3 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Processed</span>
                  <p className="mt-1 font-mono text-lg font-bold text-[var(--ink)]">{importReport.total_processed}</p>
                </div>
                <div className="p-3 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Successful</span>
                  <p className="mt-1 font-mono text-lg font-bold text-teal-600 dark:text-teal-400">
                    {mode === 'orders' ? importReport.created_count : (importReport.created_count + importReport.updated_count)}
                  </p>
                </div>
                <div className="p-3 text-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Failed / Skipped</span>
                  <p className={`mt-1 font-mono text-lg font-bold ${importReport.failed_count > 0 ? 'text-red-600 dark:text-red-400' : 'text-teal-600 dark:text-teal-400'}`}>
                    {importReport.failed_count}
                  </p>
                </div>
              </div>
            </div>

            {/* Failed Rows Detail */}
            {importReport.failed_orders?.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 block">
                  Failed Records Breakdown ({importReport.failed_orders.length})
                </span>
                <div className="overflow-x-auto max-h-[200px] border border-red-500/20 rounded-md bg-red-500/5">
                  <table className="erp-table w-full text-xs">
                    <thead>
                      <tr>
                        <th>Invoice / PO #</th>
                        <th>Supplier</th>
                        <th>Error Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line-subtle)]">
                      {importReport.failed_orders.map((f, i) => (
                        <tr key={i}>
                          <td className="font-mono font-bold text-[var(--ink)]">{f.invoice_number}</td>
                          <td>{f.supplier_name || '—'}</td>
                          <td className="text-red-600 dark:text-red-400 font-semibold">{f.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-4">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="btn-secondary h-9 px-3.5 text-xs flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                Import Another File
              </button>

              <button
                type="button"
                onClick={handleDone}
                className="btn-primary h-9 px-5 text-xs flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Done (View Purchases)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ============================================================
   MAIN PURCHASES PAGE
============================================================ */

export default function Purchases() {
  const [tab, setTab] = useState('orders')
  const [purchases, setPurchases] = useState([])
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [importMode, setImportMode] = useState('orders')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [supModal, setSupModal] = useState(false)
  const [editSupplier, setEditSupplier] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [supSearch, setSupSearch] = useState('')
  const [poSearch, setPoSearch] = useState('')
  const [expandedPO, setExpandedPO] = useState(null)
  const [sendingPO, setSendingPO] = useState(null)
  const [poCommsKey, setPoCommsKey] = useState(0)

  const sendConfirmation = async (p, channel = 'whatsapp') => {
    setSendingPO(p.id)
    const popup = channel === 'whatsapp' ? window.open('', '_blank') : null
    try {
      const res = await api.post(`/purchases/${p.id}/send-confirmation/`, { channel })
      if (res.data?.whatsapp_url && channel === 'whatsapp') {
        if (popup) popup.location.href = res.data.whatsapp_url
        else window.location.href = res.data.whatsapp_url
      }
      toast.success('PO confirmation sent via WhatsApp!')
      setPoCommsKey(k => k + 1)
    } catch (err) {
      popup?.close()
      toast.error(err?.response?.data?.error || 'Failed to send confirmation')
    } finally {
      setSendingPO(null)
    }
  }

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
    form.payment_status === 'partial' &&
    (paidNow <= 0 || paidNow >= grandTotal)

  const addItem = () =>
    setForm(p => ({
      ...p,
      items: [
        ...p.items,
        { product: '', quantity: 1, purchase_price: '', gst_percent: 0, total: 0 }
      ]
    }))

  const removeItem = i => {
    if (form.items.length <= 1) return toast.error('At least one item required')
    setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))
  }

  const save = async () => {
    if (!form.supplier) return toast.error('Please select a supplier')
    if (form.items.some(i => !i.product)) return toast.error('All items must have a product selected')
    if (form.items.some(i => !i.quantity || Number(i.quantity) <= 0))
      return toast.error('Quantity must be greater than zero')
    if (form.items.some(i => i.purchase_price === '' || Number(i.purchase_price) < 0))
      return toast.error('Purchase price cannot be negative')
    if (paymentError) {
      return toast.error(
        paidNow <= 0
          ? 'Enter paid amount greater than 0 for partial payment'
          : 'Paid amount cannot equal or exceed total (mark as Paid instead)'
      )
    }

    setSaving(true)
    const payload = {
      supplier: parseInt(form.supplier),
      invoice_number: form.invoice_number,
      purchase_date: form.purchase_date,
      payment_status: form.payment_status,
      paid_amount: paidNow,
      notes: form.notes,
      items: form.items.map(i => ({
        product: parseInt(i.product),
        quantity: parseFloat(i.quantity),
        purchase_price: parseFloat(i.purchase_price),
        gst_percent: parseFloat(i.gst_percent) || 0,
      }))
    }

    try {
      await api.post('/purchases/', payload)
      toast.success('Purchase recorded & stock updated!')
      setModal(false)
      setForm(emptyForm)
      load()
    } catch (e) {
      toast.error(e.response?.data?.detail || e.response?.data?.non_field_errors?.[0] || 'Failed to save purchase')
    } finally {
      setSaving(false)
    }
  }

  const deleteSupplier = async () => {
    try {
      await api.delete(`/suppliers/${deleteConfirm.id}/`)
      toast.success('Supplier deleted')
      setSuppliers(prev => prev.filter(s => s.id !== deleteConfirm.id))
      setDeleteConfirm(null)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete supplier')
    }
  }

  /* ── KPI Metrics ── */
  const totalSpend = purchases.reduce((s, p) => s + Number(p.total_amount || 0), 0)
  const totalDue = purchases.reduce((s, p) => s + dueOf(p), 0)
  const totalPaid = totalSpend - totalDue

  const summaryCards = [
    {
      label: 'Total Spend',
      value: fmt(totalSpend),
      hint: `${purchases.length} total orders`,
      icon: TrendingUp,
      iconClass: 'bg-indigo-50 dark:bg-indigo-950/50 text-[#1E3A5F] dark:text-slate-200',
    },
    {
      label: 'Amount Paid',
      value: fmt(totalPaid),
      hint: 'Supplier settlements',
      icon: Wallet,
      iconClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Balance Due',
      value: fmt(totalDue),
      hint: 'Outstanding payable',
      icon: Clock3,
      iconClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400',
    },
    {
      label: 'Active Suppliers',
      value: String(suppliers.length),
      hint: 'Registered vendors',
      icon: Building2,
      iconClass: 'bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400',
    },
  ]

  const filteredPOs = purchases.filter(p => {
    if (!poSearch.trim()) return true
    const q = poSearch.toLowerCase()
    return (
      (p.supplier_name || '').toLowerCase().includes(q) ||
      (p.invoice_number || '').toLowerCase().includes(q) ||
      `po-${p.id}`.toLowerCase().includes(q)
    )
  })

  const filteredSuppliers = suppliers.filter(s => {
    if (!supSearch.trim()) return true
    const q = supSearch.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      (s.phone || '').includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.gstin || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="min-h-screen space-y-6 bg-[var(--app-bg)] px-3 pb-20 pt-4 text-[var(--ink)] sm:px-5 lg:px-6">
      <PageHeader
        title="Purchases"
        subtitle="Manage purchase orders, suppliers, payments and stock-in"
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              onClick={() => {
                setImportMode(tab === 'suppliers' ? 'suppliers' : 'orders')
                setImportModal(true)
              }}
              className="btn-secondary flex items-center justify-center gap-2 text-sm"
              title="Bulk import from Excel"
            >
              <FileSpreadsheet size={15} /> Import Excel
            </button>
            <button onClick={() => { setEditSupplier(null); setSupModal(true) }} className="btn-secondary flex items-center justify-center gap-2 text-sm">
              <Building2 size={15} /> Add Supplier
            </button>
            <button onClick={() => setModal(true)} className="btn-primary flex items-center justify-center gap-2">
              <Plus size={16} /> New Purchase
            </button>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#1E3A5F] dark:text-slate-300">
            Procurement workspace
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Track supplier spending, purchase orders and outstanding payments.
          </p>
        </div>
      </div>

      {/* Table-First Procurement Summary */}
      <section className="erp-table-container">
        <div className="border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
          Procurement & Supplier Payable Summary
        </div>
        <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          {summaryCards.map(({ label, value, hint, icon: Icon, iconClass }) => (
            <div key={label} className="p-3 sm:p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  {label}
                </span>
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${iconClass}`}>
                  <Icon size={13} />
                </div>
              </div>
              <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-[var(--ink)] tabular-nums">
                {value}
              </p>
              <p className="text-[10px] text-[var(--muted)]">{hint}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="flex w-full max-w-full gap-1 overflow-x-auto rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] p-1 shadow-xs sm:inline-flex sm:w-auto">
        {[
          ['orders', `Purchase Orders (${purchases.length})`],
          ['suppliers', `Suppliers (${suppliers.length})`]
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-semibold transition-all ${
              tab === key
                ? 'bg-[var(--primary)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
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
                  <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--placeholder)]" />
                  <input
                    className="input h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-10 text-sm text-[var(--ink)] placeholder:text-[var(--placeholder)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                    placeholder="Search supplier or invoice number..."
                    value={poSearch}
                    onChange={e => setPoSearch(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setImportMode('orders')
                      setImportModal(true)
                    }}
                    className="btn-secondary h-11 px-3 text-xs flex items-center justify-center gap-1.5 rounded-xl shrink-0"
                    title="Import purchase orders from Excel"
                  >
                    <FileSpreadsheet size={14} />
                    <span>Import Excel</span>
                  </button>

                  <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-[var(--muted)] px-1">
                    <Filter size={14} className="text-[var(--muted-light)]" />
                    <span>{filteredPOs.length} result{filteredPOs.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>

              {filteredPOs.length === 0 ? <EmptyState message="No purchase orders yet" /> : (
                <div className={`overflow-hidden ${cardCls}`}>
                  <div className="w-full max-w-full overflow-x-auto overscroll-x-contain">
                    <table className={`table min-w-[900px] ${tableCls}`}>
                      <thead>
                        <tr>
                          <th>PO #</th>
                          <th>Supplier</th>
                          <th>Invoice</th>
                          <th>Date</th>
                          <th>Total</th>
                          <th>Paid</th>
                          <th>Balance Due</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPOs.map(p => (
                          <Fragment key={p.id}>
                            <tr
                              className="cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
                              onClick={() => setExpandedPO(expandedPO === p.id ? null : p.id)}
                            >
                              <td className="font-mono font-bold text-[#1E3A5F] dark:text-slate-200">PO-{p.id}</td>
                              <td className="font-semibold text-[var(--ink)]">{p.supplier_name || '—'}</td>
                              <td className="text-sm text-[var(--muted)]">{p.invoice_number || '—'}</td>
                              <td className="text-sm whitespace-nowrap text-[var(--ink-secondary)]">{fmtDate(p.purchase_date)}</td>
                              <td className="font-bold text-[var(--ink)] whitespace-nowrap tabular-nums">{fmt(p.total_amount)}</td>
                              <td className="text-sm text-[var(--ink-secondary)] whitespace-nowrap tabular-nums">{fmt(p.paid_amount)}</td>
                              <td className={`text-sm font-semibold whitespace-nowrap tabular-nums ${dueOf(p) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--muted-light)]'}`}>
                                {fmt(dueOf(p))}
                              </td>
                              <td><Badge status={p.payment_status} /></td>
                              <td className="text-right whitespace-nowrap">
                                <button
                                  onClick={e => {
                                    e.stopPropagation()
                                    sendConfirmation(p)
                                  }}
                                  disabled={sendingPO === p.id}
                                  className="btn-secondary text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold mr-1.5"
                                  title="Send PO Confirmation via WhatsApp"
                                >
                                  <MessageCircle size={13} />
                                  <span className="hidden sm:inline">{sendingPO === p.id ? 'Sending…' : 'Send Confirmation'}</span>
                                </button>

                                <button
                                  onClick={e => { e.stopPropagation(); printPO(p, suppliers) }}
                                  className="icon-btn"
                                  title="Print purchase order"
                                >
                                  <Printer size={14} />
                                </button>
                              </td>
                            </tr>
                            {expandedPO === p.id && (
                              <tr>
                                <td colSpan={9} className="border-y border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-4 sm:px-6">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                                      Items in Purchase Order #{p.id}
                                    </div>
                                    <span className="text-xs text-[var(--muted-light)]">
                                      {(p.items || []).length} line item{(p.items || []).length !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                  <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-sm">
                                    <table className={`table text-xs min-w-[560px] ${tableCls}`}>
                                      <thead>
                                        <tr>
                                          <th>#</th>
                                          <th>Product</th>
                                          <th>Qty</th>
                                          <th>Purchase Price</th>
                                          <th>GST %</th>
                                          <th>Line Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(p.items || []).map((it, idx) => (
                                          <tr key={it.id || idx}>
                                            <td className="font-mono text-[var(--muted)]">{idx + 1}</td>
                                            <td className="font-semibold text-[var(--ink)]">{it.product_name || it.product}</td>
                                            <td className="font-mono tabular-nums">{it.quantity}</td>
                                            <td className="font-mono tabular-nums">{fmt(it.purchase_price)}</td>
                                            <td className="font-mono tabular-nums">{it.gst_percent}%</td>
                                            <td className="font-mono font-bold tabular-nums text-[var(--ink)]">{fmt(it.total)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  {p.notes && (
                                    <p className="mt-3 text-xs text-[var(--muted)] bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--line-subtle)]">
                                      <span className="font-semibold text-[var(--ink)]">Notes: </span>{p.notes}
                                    </p>
                                  )}

                                  <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-xs">
                                    <CommunicationHistory
                                      referenceType="purchase"
                                      referenceId={p.id}
                                      key={poCommsKey}
                                    />
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Suppliers Tab ── */}
          {tab === 'suppliers' && (
            <div className="space-y-4">
              <div className={`flex flex-col gap-3 p-3.5 ${cardCls} sm:flex-row sm:items-center`}>
                <div className="relative flex-1">
                  <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--placeholder)]" />
                  <input
                    className="input h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-10 text-sm text-[var(--ink)] placeholder:text-[var(--placeholder)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                    placeholder="Search suppliers..."
                    value={supSearch}
                    onChange={e => setSupSearch(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setImportMode('suppliers')
                      setImportModal(true)
                    }}
                    className="btn-secondary h-11 px-3 text-xs flex items-center justify-center gap-1.5 rounded-xl shrink-0"
                    title="Import suppliers from Excel"
                  >
                    <FileSpreadsheet size={14} />
                    <span>Import Excel</span>
                  </button>

                  <button onClick={() => { setEditSupplier(null); setSupModal(true) }} className="btn-primary h-11 px-4 justify-center flex items-center gap-2 text-sm rounded-xl shrink-0">
                    <Plus size={14} /> Add Supplier
                  </button>
                </div>
              </div>

              {filteredSuppliers.length === 0 ? <EmptyState message="No suppliers found" /> : (
                <div className="space-y-4">
                  {filteredSuppliers.map(s => (
                    <SupplierCard
                      key={s.id}
                      supplier={s}
                      products={products}
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
        <div className="space-y-5 p-4 sm:p-6 bg-[var(--surface)] text-[var(--ink)]">

          {/* Order details */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 sm:p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-[var(--ink)]">Order details</h3>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="label text-xs font-semibold text-[var(--ink-secondary)]">Supplier *</label>
                <div className="flex gap-2">
                  <select
                    className={`${inputCls} flex-1`}
                    value={form.supplier}
                    onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
                  >
                    <option className="bg-[var(--surface)] text-[var(--ink)]" value="">Select supplier</option>
                    {suppliers.map(s => (
                      <option className="bg-[var(--surface)] text-[var(--ink)]" key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <button onClick={() => { setEditSupplier(null); setSupModal(true) }} className="btn-secondary px-3" title="Add new supplier">
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div>
                <label className="label text-xs font-semibold text-[var(--ink-secondary)]">Invoice No.</label>
                <input
                  className={inputCls}
                  value={form.invoice_number}
                  onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))}
                  placeholder="Supplier's invoice #"
                />
              </div>
              <div>
                <label className="label text-xs font-semibold text-[var(--ink-secondary)]">Date</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.purchase_date}
                  onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="label text-xs font-semibold text-[var(--ink-secondary)]">Payment</label>
                <select
                  className={inputCls}
                  value={form.payment_status}
                  onChange={e => setForm(p => ({ ...p, payment_status: e.target.value }))}
                >
                  <option className="bg-[var(--surface)] text-[var(--ink)]" value="paid">Paid</option>
                  <option className="bg-[var(--surface)] text-[var(--ink)]" value="pending">Pending</option>
                  <option className="bg-[var(--surface)] text-[var(--ink)]" value="partial">Partial</option>
                </select>
              </div>
            </div>

            {form.payment_status === 'partial' && (
              <div className="mt-3.5 max-w-xs">
                <label className="label text-xs font-semibold text-[var(--ink-secondary)]">Paid Amount</label>
                <input
                  type="number" min="0" step="0.01"
                  className={`${inputCls} ${paymentError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : ''}`}
                  value={form.paid_amount}
                  onChange={e => setForm(p => ({ ...p, paid_amount: e.target.value }))}
                />
                {paymentError && (
                  <p className="mt-1 text-xs text-rose-500">
                    {paidNow <= 0
                      ? 'Paid amount must be > 0'
                      : 'Paid amount cannot equal or exceed total'}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Items */}
          <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 sm:p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[var(--ink)]">Items</h3>
              <button onClick={addItem} className="btn-secondary h-8 px-3 text-xs flex items-center gap-1">
                <Plus size={14} /> Add item
              </button>
            </div>
            <div className="space-y-3">
              {form.items.map((it, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 sm:flex-row sm:items-center">
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] font-semibold text-[var(--muted)] block mb-1">Product *</label>
                    <select
                      className={`${inputCls} text-xs`}
                      value={it.product}
                      onChange={e => updateItem(i, 'product', e.target.value)}
                    >
                      <option className="bg-[var(--surface)] text-[var(--ink)]" value="">Select product</option>
                      {products.map(p => (
                        <option className="bg-[var(--surface)] text-[var(--ink)]" key={p.id} value={p.id}>
                          {p.name} {p.sku ? `(${p.sku})` : ''} — Stock: {p.current_stock}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full sm:w-20">
                    <label className="text-[10px] font-semibold text-[var(--muted)] block mb-1">Qty *</label>
                    <input
                      type="number" min="0.01" step="0.01"
                      className={`${inputCls} text-xs`}
                      value={it.quantity}
                      onChange={e => updateItem(i, 'quantity', e.target.value)}
                    />
                  </div>
                  <div className="w-full sm:w-28">
                    <label className="text-[10px] font-semibold text-[var(--muted)] block mb-1">Price (₹) *</label>
                    <input
                      type="number" min="0" step="0.01"
                      className={`${inputCls} text-xs`}
                      placeholder="0.00"
                      value={it.purchase_price}
                      onChange={e => updateItem(i, 'purchase_price', e.target.value)}
                    />
                  </div>
                  <div className="w-full sm:w-20">
                    <label className="text-[10px] font-semibold text-[var(--muted)] block mb-1">GST %</label>
                    <input
                      type="number" min="0" max="100" step="0.1"
                      className={`${inputCls} text-xs`}
                      value={it.gst_percent}
                      onChange={e => updateItem(i, 'gst_percent', e.target.value)}
                    />
                  </div>
                  <div className="w-full sm:w-28 sm:text-right">
                    <label className="text-[10px] font-semibold text-[var(--muted)] block mb-1">Total</label>
                    <span className="font-mono font-bold text-sm text-[var(--ink)] block pt-1">
                      ₹{it.total || '0.00'}
                    </span>
                  </div>
                  {form.items.length > 1 && (
                    <button
                      onClick={() => removeItem(i)}
                      className="text-rose-500 hover:text-rose-400 p-1 self-end sm:self-center"
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Notes and summary */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label text-xs font-semibold text-[var(--ink-secondary)]">Notes</label>
              <textarea
                className={`${inputCls} h-24 py-2`}
                rows={3}
                placeholder="Optional purchase order notes..."
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 space-y-2">
              <div className="flex justify-between text-xs text-[var(--ink-secondary)]">
                <span>Subtotal (excl. GST)</span>
                <span className="font-mono">₹{fmt2(subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-[var(--ink-secondary)]">
                <span>GST Total</span>
                <span className="font-mono">₹{fmt2(gstTotal)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-[var(--ink)] border-t border-[var(--line)] pt-2">
                <span>Grand Total</span>
                <span className="font-mono text-[#1E3A5F] dark:text-slate-200">₹{fmt2(grandTotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                <span>Paid Now</span>
                <span className="font-mono">₹{fmt2(paidNow)}</span>
              </div>
              {balanceDue > 0 && (
                <div className="flex justify-between text-xs font-semibold text-rose-500">
                  <span>Balance Due</span>
                  <span className="font-mono">₹{fmt2(balanceDue)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3 pt-2">
            <button onClick={save} disabled={saving} className="btn-primary min-h-11 w-full flex-1 justify-center">
              <Package size={16} />{saving ? 'Saving…' : 'Save Purchase & Update Stock'}
            </button>
            <button onClick={() => { setModal(false); setForm(emptyForm) }} className="btn-secondary min-h-11 w-full px-6 sm:w-auto">
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Excel Import Modal */}
      <PurchaseBulkImportModal
        open={importModal}
        onClose={() => setImportModal(false)}
        onSuccess={load}
        initialMode={importMode}
      />

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