import React, { useEffect, useMemo, useState, useRef } from 'react'
import api from '../api'

import { Badge, Spinner, Modal } from '../components/UI'

import {
  Building2,
  Plus,
  Search,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  ChevronRight,
  Package,
  IndianRupee,
  Save,
  X,
  CreditCard,
  Clock3,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Check,
  FileText,
  ArrowRight,
} from 'lucide-react'

import toast from 'react-hot-toast'

/* ============================================================
   HELPERS
============================================================ */

const fmt = value =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const EMPTY = {
  name: '',
  phone: '',
  email: '',
  address: '',
  gstin: '',
}

/* ============================================================
   SUPPLIER FORM MODAL CONTENT
============================================================ */

function SupplierForm({ initial, onSaved, onClose }) {
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name || '',
          phone: initial.phone || '',
          email: initial.email || '',
          address: initial.address || '',
          gstin: initial.gstin || '',
        }
      : EMPTY
  )

  const [saving, setSaving] = useState(false)

  const updateField = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Supplier name is required')
      return
    }

    setSaving(true)

    try {
      const res = initial?.id
        ? await api.put(`/suppliers/${initial.id}/`, form)
        : await api.post('/suppliers/', form)

      toast.success(
        initial?.id
          ? 'Supplier updated successfully'
          : 'Supplier added successfully'
      )

      onSaved(res.data)
      onClose()
    } catch (error) {
      toast.error(
        error.response?.data?.name?.[0] ||
          error.response?.data?.detail ||
          'Failed to save supplier'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Supplier Name */}
      <div>
        <label className="label">
          Company / Supplier Name <span className="text-red-600 dark:text-red-400">*</span>
        </label>
        <input
          type="text"
          className="input"
          value={form.name}
          onChange={e => updateField('name', e.target.value)}
          autoFocus
          placeholder="e.g. Balaji Traders Pvt Ltd"
        />
      </div>

      {/* Phone / Email */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Phone / Mobile</label>
          <input
            type="text"
            className="input"
            value={form.phone}
            onChange={e => updateField('phone', e.target.value)}
            placeholder="Mobile / Landline"
          />
        </div>

        <div>
          <label className="label">Email Address</label>
          <input
            type="email"
            className="input"
            value={form.email}
            onChange={e => updateField('email', e.target.value)}
            placeholder="supplier@example.com"
          />
        </div>
      </div>

      {/* Address */}
      <div>
        <label className="label">Business Address</label>
        <textarea
          className="input resize-none"
          rows={3}
          value={form.address}
          onChange={e => updateField('address', e.target.value)}
          placeholder="Shop / warehouse address"
        />
      </div>

      {/* GSTIN */}
      <div>
        <label className="label">GSTIN</label>
        <input
          type="text"
          maxLength={15}
          className="input font-mono uppercase"
          value={form.gstin}
          onChange={e => updateField('gstin', e.target.value.toUpperCase())}
          placeholder="22AAAAA0000A1Z5"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] pt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="btn-secondary h-9 px-4 text-xs"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="btn-primary h-9 px-4 text-xs flex items-center justify-center gap-2"
        >
          <Save size={14} />
          {saving
            ? 'Saving...'
            : initial?.id
              ? 'Update Supplier'
              : 'Save Supplier'}
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   EXPANDED LINKED PRODUCTS ROW
============================================================ */

function SupplierProductsRow({ supplier, products, onClose }) {
  const supplierProducts = products.filter(
    product => product.supplier === supplier.id
  )

  return (
    <tr>
      <td
        colSpan={7}
        className="p-0 border-b border-[var(--line)] bg-[var(--surface-elevated)]"
      >
        <div className="px-4 py-4">
          {/* Expanded Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Package size={15} className="text-[#1E3A5F] dark:text-slate-200" />
              <span className="text-xs font-bold uppercase tracking-wide text-[var(--ink)]">
                Products supplied by {supplier.name}
              </span>
              <span className="inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded bg-[var(--surface)] border border-[var(--line)] text-[10px] font-bold text-[var(--ink)] font-mono">
                {supplierProducts.length}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
            >
              Close
            </button>
          </div>

          {/* No Products */}
          {supplierProducts.length === 0 ? (
            <div className="border border-[var(--line)] bg-[var(--surface)] px-4 py-8 text-center rounded-md">
              <Package size={25} className="mx-auto text-[var(--muted-light)] mb-2" />
              <p className="text-xs font-semibold text-[var(--ink)]">
                No products linked to this supplier
              </p>
              <p className="text-[11px] text-[var(--muted)] mt-1">
                Products assigned to this supplier will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-[var(--line)] bg-[var(--surface)] rounded-md">
              <table className="erp-table w-full text-xs">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th className="text-right">Current Stock</th>
                    <th className="text-right">Purchase Price</th>
                    <th className="text-right">Selling Price</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {supplierProducts.map(product => {
                    const stock = Number(product.current_stock || 0)

                    return (
                      <tr
                        key={product.id}
                        className="hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <td>
                          <span className="font-semibold text-[var(--ink)]">
                            {product.name}
                          </span>
                        </td>

                        <td>
                          <span className="font-mono text-[11px] text-[var(--muted)]">
                            {product.sku || '—'}
                          </span>
                        </td>

                        <td
                          className={`text-right font-bold font-mono tabular-nums ${
                            stock <= 0
                              ? 'text-red-600 dark:text-red-400'
                              : stock <= 10
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-[var(--ink)]'
                          }`}
                        >
                          {product.current_stock ?? 0}
                        </td>

                        <td className="text-right font-mono tabular-nums text-[var(--ink)]">
                          {fmt(product.purchase_price)}
                        </td>

                        <td className="text-right font-mono font-bold tabular-nums text-[var(--ink)]">
                          {fmt(product.selling_price)}
                        </td>

                        <td>
                          <Badge
                            status={
                              product.stock_status ||
                              (stock <= 0 ? 'out_of_stock' : 'in_stock')
                            }
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

/* ============================================================
   BULK EXCEL IMPORT MODAL
   Flow:
   Upload Excel -> Validate -> Preview -> Highlight Errors -> Confirm Import -> Import -> Success / Failure Report
============================================================ */

function SupplierBulkImportModal({ open, onClose, onSuccess }) {
  const [step, setStep] = useState('upload') // 'upload' | 'preview' | 'report'
  const [file, setFile] = useState(null)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [validationResult, setValidationResult] = useState(null)
  const [importReport, setImportReport] = useState(null)
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'valid' | 'errors'
  const [updateExisting, setUpdateExisting] = useState(true)
  const [skipErrors, setSkipErrors] = useState(true)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setStep('upload')
      setFile(null)
      setValidating(false)
      setImporting(false)
      setValidationResult(null)
      setImportReport(null)
      setActiveTab('all')
      setUpdateExisting(true)
      setSkipErrors(true)
    }
  }, [open])

  const handleDownloadTemplate = async (format = 'xlsx') => {
    setDownloadingTemplate(true)
    try {
      if (format === 'xlsx') {
        const res = await api.get('/suppliers/import-template/', {
          responseType: 'blob',
        })
        const blob = new Blob([res.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'Supplier_Import_Template.xlsx'
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
        toast.success('Excel template downloaded')
      } else {
        // CSV fallback
        const headers = [
          'Company / Supplier Name*',
          'Phone / Mobile',
          'Email Address',
          'Business Address',
          'GSTIN',
        ]
        const sample = [
          [
            'Balaji Traders Pvt Ltd',
            '9876543210',
            'sales@balajitraders.com',
            '123 MG Road, Bangalore',
            '29ABCDE1234F1Z5',
          ],
          [
            'Sri Krishna Enterprises',
            '9123456789',
            'contact@srikrishna.in',
            '45 Market Yard, Pune',
            '27AABCS1429B1ZB',
          ],
        ]
        const csvContent = [
          headers.join(','),
          ...sample.map(r => r.map(c => `"${c}"`).join(',')),
        ].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'Supplier_Import_Template.csv'
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
        toast.success('CSV template downloaded')
      }
    } catch {
      toast.error('Failed to download template')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const handleFileChange = e => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
    }
  }

  const handleDrop = e => {
    e.preventDefault()
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) {
      setFile(dropped)
    }
  }

  const handleValidate = async () => {
    if (!file) {
      toast.error('Please choose an Excel or CSV file first')
      return
    }

    setValidating(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await api.post('/suppliers/validate-import/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setValidationResult(res.data)
      if (res.data.error_rows_count > 0) {
        toast(
          `Validated ${res.data.total_rows} rows: ${res.data.valid_rows_count} valid, ${res.data.error_rows_count} with errors`,
          { icon: '⚠️' }
        )
      } else {
        toast.success(
          `All ${res.data.total_rows} suppliers are valid and ready to import!`
        )
      }
      setStep('preview')
    } catch (err) {
      toast.error(
        err.response?.data?.detail || 'Failed to read and validate import file'
      )
    } finally {
      setValidating(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!validationResult) return

    let rowsToImport = validationResult.rows || []
    if (skipErrors) {
      rowsToImport = rowsToImport.filter(r => r.is_valid)
    } else {
      const hasErrors = rowsToImport.some(r => !r.is_valid)
      if (hasErrors) {
        toast.error(
          'Please resolve validation errors or enable "Skip rows with errors"'
        )
        return
      }
    }

    if (rowsToImport.length === 0) {
      toast.error('No valid rows available to import')
      return
    }

    setImporting(true)
    try {
      const res = await api.post('/suppliers/bulk-import/', {
        rows: rowsToImport,
        update_existing: updateExisting,
      })

      setImportReport(res.data)
      setStep('report')
      toast.success(
        `Successfully imported ${res.data.created_count + res.data.updated_count} suppliers!`
      )
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to complete bulk import')
    } finally {
      setImporting(false)
    }
  }

  const handleDone = () => {
    onSuccess?.()
    onClose()
  }

  const displayedRows = useMemo(() => {
    if (!validationResult?.rows) return []
    if (activeTab === 'valid') {
      return validationResult.rows.filter(r => r.is_valid)
    }
    if (activeTab === 'errors') {
      return validationResult.rows.filter(r => !r.is_valid)
    }
    return validationResult.rows
  }, [validationResult, activeTab])

  const validRowsToImportCount = useMemo(() => {
    if (!validationResult?.rows) return 0
    if (skipErrors) {
      return validationResult.rows.filter(r => r.is_valid).length
    }
    return validationResult.rows.length
  }, [validationResult, skipErrors])

  return (
    <Modal
      open={open}
      onClose={() => !importing && !validating && onClose()}
      title="Bulk Supplier Excel Import"
      size="xl"
    >
      <div className="space-y-4">
        {/* Step Flow Indicator */}
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                step === 'upload'
                  ? 'bg-[#1E3A5F] text-white'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
              }`}
            >
              {step !== 'upload' ? <Check size={13} /> : '1'}
            </span>
            <span
              className={`text-xs font-semibold ${
                step === 'upload'
                  ? 'text-[var(--ink)]'
                  : 'text-[var(--muted)]'
              }`}
            >
              Upload Excel
            </span>
          </div>

          <ArrowRight size={14} className="text-[var(--muted-light)]" />

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                step === 'preview'
                  ? 'bg-[#1E3A5F] text-white'
                  : step === 'report'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--muted)]'
              }`}
            >
              {step === 'report' ? <Check size={13} /> : '2'}
            </span>
            <span
              className={`text-xs font-semibold ${
                step === 'preview'
                  ? 'text-[var(--ink)]'
                  : 'text-[var(--muted)]'
              }`}
            >
              Validate & Preview
            </span>
          </div>

          <ArrowRight size={14} className="text-[var(--muted-light)]" />

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                step === 'report'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--muted)]'
              }`}
            >
              3
            </span>
            <span
              className={`text-xs font-semibold ${
                step === 'report'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-[var(--muted)]'
              }`}
            >
              Import & Report
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
                    Supplier Excel Import Template
                  </h4>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">
                    Pre-formatted spreadsheet with column headers, required fields, and sample vendor records.
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
                {file ? file.name : 'Choose an Excel or CSV file to import'}
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

            {/* Column Specs & Guidance */}
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] p-3 space-y-1.5 text-xs">
              <span className="font-bold text-[var(--ink)] block">
                Required & Optional Column Guidelines:
              </span>
              <ul className="text-[11px] text-[var(--muted)] space-y-1 list-disc pl-4">
                <li>
                  <strong className="text-[var(--ink)]">Company / Supplier Name*</strong>: Required. Business or vendor name.
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Phone / Mobile</strong>: Optional. 10 to 15 digits.
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Email Address</strong>: Optional. Valid format (e.g. <code>vendor@example.com</code>).
                </li>
                <li>
                  <strong className="text-[var(--ink)]">GSTIN</strong>: Optional. 15-character statutory GST identification number.
                </li>
                <li>
                  <strong className="text-[var(--ink)]">Business Address</strong>: Optional. Street, city, state, pincode.
                </li>
              </ul>
            </div>

            {/* Footer Buttons */}
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
                    Total In File
                  </span>
                  <p className="mt-1 font-mono text-base sm:text-lg font-bold text-[var(--ink)]">
                    {validationResult.total_rows}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">Spreadsheet rows</p>
                </div>

                <div className="p-2.5 sm:p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Ready To Import
                  </span>
                  <p className="mt-1 font-mono text-base sm:text-lg font-bold text-teal-600 dark:text-teal-400">
                    {validationResult.valid_rows_count}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">Valid supplier records</p>
                </div>

                <div className="p-2.5 sm:p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Rows With Errors
                  </span>
                  <p
                    className={`mt-1 font-mono text-base sm:text-lg font-bold ${
                      validationResult.error_rows_count > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-teal-600 dark:text-teal-400'
                    }`}
                  >
                    {validationResult.error_rows_count}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {validationResult.error_rows_count > 0 ? 'Requires attention' : '0 validation issues'}
                  </p>
                </div>

                <div className="p-2.5 sm:p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Will Update
                  </span>
                  <p className="mt-1 font-mono text-base sm:text-lg font-bold text-amber-600 dark:text-amber-400">
                    {validationResult.update_count}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">Existing supplier matches</p>
                </div>
              </div>
            </div>

            {/* Filter Tabs & Row Count */}
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
                  All Rows ({validationResult.total_rows})
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
                  Valid ({validationResult.valid_rows_count})
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
                  Errors ({validationResult.error_rows_count})
                </button>
              </div>

              <div className="text-xs text-[var(--muted)]">
                Showing{' '}
                <strong className="text-[var(--ink)]">{displayedRows.length}</strong>{' '}
                rows in preview
              </div>
            </div>

            {/* Preview Data Table */}
            <div className="overflow-x-auto max-h-[340px] border border-[var(--line)] rounded-md bg-[var(--surface)]">
              <table className="erp-table w-full text-xs min-w-[760px]">
                <thead className="sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="w-12 text-center">Row</th>
                    <th className="w-24">Status</th>
                    <th className="min-w-[180px]">Company / Name</th>
                    <th className="w-28">Phone</th>
                    <th className="min-w-[160px]">Email</th>
                    <th className="w-32">GSTIN</th>
                    <th className="min-w-[180px]">Address</th>
                    <th className="min-w-[180px]">Validation Issues</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {displayedRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-[var(--muted)]">
                        No rows matching the active filter.
                      </td>
                    </tr>
                  ) : (
                    displayedRows.map(row => {
                      const hasErrors = !row.is_valid

                      return (
                        <tr
                          key={row.row_number}
                          className={`transition-colors ${
                            hasErrors
                              ? 'bg-red-500/10 hover:bg-red-500/15'
                              : 'hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          <td className="text-center font-mono text-[11px] text-[var(--muted)]">
                            {row.row_number}
                          </td>

                          <td>
                            {hasErrors ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300">
                                <AlertCircle size={10} />
                                Error
                              </span>
                            ) : row.action === 'update' ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                Will Update
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                                New
                              </span>
                            )}
                          </td>

                          <td className="font-semibold text-[var(--ink)]">
                            {row.name || (
                              <span className="text-red-600 dark:text-red-400 italic">
                                Missing Name
                              </span>
                            )}
                          </td>

                          <td className="font-mono text-[11px] text-[var(--ink-secondary)]">
                            {row.phone || '—'}
                          </td>

                          <td className="text-[11px] text-[var(--muted)] truncate max-w-[160px]">
                            {row.email || '—'}
                          </td>

                          <td className="font-mono text-[11px] text-[var(--ink-secondary)]">
                            {row.gstin || '—'}
                          </td>

                          <td className="text-[11px] text-[var(--muted)] truncate max-w-[180px]">
                            {row.address || '—'}
                          </td>

                          <td>
                            {hasErrors ? (
                              <div className="space-y-0.5">
                                {row.errors.map((err, eIdx) => (
                                  <div
                                    key={eIdx}
                                    className="flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400"
                                  >
                                    <AlertCircle size={11} className="shrink-0" />
                                    <span>{err}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold flex items-center gap-1">
                                <Check size={11} />
                                Ready to import
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Import Settings & Flags */}
            <div className="rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] p-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={e => setUpdateExisting(e.target.checked)}
                  className="rounded border-[var(--line)] text-[#1E3A5F] focus:ring-0"
                />
                <span>Update existing suppliers if matching Name or GSTIN is found</span>
              </label>

              {validationResult.error_rows_count > 0 && (
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={skipErrors}
                    onChange={e => setSkipErrors(e.target.checked)}
                    className="rounded border-[var(--line)] text-[#1E3A5F] focus:ring-0"
                  />
                  <span>
                    Skip the {validationResult.error_rows_count} row(s) with errors and import only valid rows ({validationResult.valid_rows_count})
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
                  disabled={validRowsToImportCount === 0 || importing}
                  className="btn-primary h-9 px-4 text-xs flex items-center gap-1.5"
                >
                  {importing ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Importing Suppliers...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Confirm & Import ({validRowsToImportCount} Suppliers)</span>
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
            {/* Status Hero Card */}
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
                      ? 'Bulk Supplier Import Completed Successfully!'
                      : 'Bulk Import Completed with Warnings'}
                  </h4>
                  <p className="text-xs mt-0.5 opacity-90">
                    Processed {importReport.total_processed} supplier rows from your spreadsheet.
                  </p>
                </div>
              </div>
            </div>

            {/* Results KPI Breakdown */}
            <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)]">
              <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
                <div className="p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Total Processed
                  </span>
                  <p className="mt-1 font-mono text-lg font-bold text-[var(--ink)]">
                    {importReport.total_processed}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">Rows evaluated</p>
                </div>

                <div className="p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Added New
                  </span>
                  <p className="mt-1 font-mono text-lg font-bold text-teal-600 dark:text-teal-400">
                    {importReport.created_count}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">New vendor accounts</p>
                </div>

                <div className="p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Updated
                  </span>
                  <p className="mt-1 font-mono text-lg font-bold text-blue-600 dark:text-blue-400">
                    {importReport.updated_count}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">Existing records updated</p>
                </div>

                <div className="p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Failed / Skipped
                  </span>
                  <p
                    className={`mt-1 font-mono text-lg font-bold ${
                      importReport.failed_count > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-teal-600 dark:text-teal-400'
                    }`}
                  >
                    {importReport.failed_count}
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {importReport.failed_count > 0 ? 'Not imported' : '0 errors'}
                  </p>
                </div>
              </div>
            </div>

            {/* Failed Rows Detail (If Any) */}
            {importReport.failed_rows?.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 block">
                  Failed / Skipped Records Breakdown ({importReport.failed_rows.length})
                </span>

                <div className="overflow-x-auto max-h-[220px] border border-red-500/20 rounded-md bg-red-500/5">
                  <table className="erp-table w-full text-xs">
                    <thead>
                      <tr>
                        <th className="w-14 text-center">Row</th>
                        <th>Supplier Name</th>
                        <th>Failure Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line-subtle)]">
                      {importReport.failed_rows.map((fail, fIdx) => (
                        <tr key={fIdx}>
                          <td className="text-center font-mono text-[11px] text-[var(--muted)]">
                            {fail.row_number}
                          </td>
                          <td className="font-semibold text-[var(--ink)]">
                            {fail.name || '—'}
                          </td>
                          <td className="text-red-600 dark:text-red-400 font-semibold text-[11px]">
                            {fail.error}
                          </td>
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
                <span>Done (View Suppliers)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ============================================================
   MAIN SUPPLIERS PAGE
============================================================ */

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])

  const [loading, setLoading] = useState(true)

  const [q, setQ] = useState('')

  const [modal, setModal] = useState(false)
  const [importModal, setImportModal] = useState(false)
  const [editing, setEditing] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [expandedIds, setExpandedIds] = useState(new Set())

  /* Payment */
  const [payTarget, setPayTarget] = useState(null)
  const [payAmt, setPayAmt] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [paying, setPaying] = useState(false)

  /* ==========================================================
     LOAD DATA
  ========================================================== */

  const load = async () => {
    setLoading(true)

    try {
      const [supplierResponse, productResponse] = await Promise.all([
        api.get('/suppliers/?page_size=500'),
        api.get('/products/?page_size=1000'),
      ])

      setSuppliers(
        supplierResponse.data?.results || supplierResponse.data || []
      )

      setProducts(
        productResponse.data?.results || productResponse.data || []
      )
    } catch {
      toast.error('Unable to load supplier data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  /* ==========================================================
     ADD / EDIT
  ========================================================== */

  const openAdd = () => {
    setEditing(null)
    setModal(true)
  }

  const openEdit = supplier => {
    setEditing(supplier)
    setModal(true)
  }

  /* ==========================================================
     EXPAND
  ========================================================== */

  const toggleExpand = id => {
    setExpandedIds(previous => {
      const next = new Set(previous)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const closeAllExpanded = () => {
    setExpandedIds(new Set())
  }

  /* ==========================================================
     SAVED
  ========================================================== */

  const onSaved = saved => {
    setSuppliers(previous => {
      const exists = previous.some(supplier => supplier.id === saved.id)
      if (exists) {
        return previous.map(supplier =>
          supplier.id === saved.id ? saved : supplier
        )
      }
      return [...previous, saved]
    })
  }

  /* ==========================================================
     DELETE
  ========================================================== */

  const confirmDelete = async () => {
    if (!deleteTarget) return

    setDeleting(true)

    try {
      await api.delete(`/suppliers/${deleteTarget.id}/`)

      toast.success('Supplier deleted successfully')

      setSuppliers(previous =>
        previous.filter(supplier => supplier.id !== deleteTarget.id)
      )

      setExpandedIds(previous => {
        const next = new Set(previous)
        next.delete(deleteTarget.id)
        return next
      })

      setDeleteTarget(null)
    } catch {
      toast.error(
        'Cannot delete — supplier may have linked purchases or records'
      )
    } finally {
      setDeleting(false)
    }
  }

  /* ==========================================================
     PAYMENT
  ========================================================== */

  const openPayment = supplier => {
    const outstanding = Number(supplier.outstanding_amount || 0)
    setPayTarget(supplier)
    setPayAmt(String(outstanding))
    setPayMethod('cash')
  }

  const recordPayment = async () => {
    if (!payTarget) return

    const amount = parseFloat(payAmt)
    const outstanding = Number(payTarget.outstanding_amount || 0)

    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount')
      return
    }

    if (amount > outstanding) {
      toast.error('Payment cannot be greater than the outstanding balance')
      return
    }

    setPaying(true)

    try {
      await api.post('/supplier-payments/', {
        supplier: payTarget.id,
        amount,
        method: payMethod,
      })

      await api.patch(`/suppliers/${payTarget.id}/`, {
        outstanding_amount: Math.max(0, outstanding - amount),
      })

      toast.success('Payment recorded successfully')

      setPayTarget(null)
      setPayAmt('')

      await load()
    } catch (error) {
      toast.error(
        error.response?.data?.detail || 'Failed to record payment'
      )
    } finally {
      setPaying(false)
    }
  }

  /* ==========================================================
     FILTER
  ========================================================== */

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase()

    if (!search) {
      return suppliers
    }

    return suppliers.filter(
      supplier =>
        (supplier.name || '').toLowerCase().includes(search) ||
        (supplier.phone || '').toLowerCase().includes(search) ||
        (supplier.email || '').toLowerCase().includes(search) ||
        (supplier.gstin || '').toLowerCase().includes(search)
    )
  }, [suppliers, q])

  /* ==========================================================
     METRICS
  ========================================================== */

  const totalOutstanding = suppliers.reduce(
    (sum, supplier) => sum + Number(supplier.outstanding_amount || 0),
    0
  )

  const suppliedProductCount = products.filter(
    product => product.supplier
  ).length

  const suppliersWithDue = suppliers.filter(
    supplier => Number(supplier.outstanding_amount || 0) > 0
  ).length

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="suppliers-page min-w-0 bg-[var(--app-bg)] text-[var(--ink)] pb-8">
      {/* ======================================================
          PAGE HEADER
      ====================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-md bg-[var(--surface-elevated)] border border-[var(--line)] flex items-center justify-center text-[#1E3A5F] dark:text-slate-200 shrink-0">
            <Building2 size={18} />
          </div>

          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--ink)]">
              Suppliers
            </h1>
            <p className="text-xs text-[var(--muted)]">
              Manage supplier accounts, payable balances and linked inventory products.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setImportModal(true)}
            className="btn-secondary h-9 px-3.5 text-xs flex items-center justify-center gap-1.5 flex-1 sm:flex-none rounded-md"
            title="Bulk import suppliers from Excel or CSV"
          >
            <FileSpreadsheet size={14} />
            Import Excel
          </button>

          <button
            type="button"
            onClick={openAdd}
            className="btn-primary h-9 px-3.5 text-xs flex items-center justify-center gap-1.5 flex-1 sm:flex-none rounded-md"
          >
            <Plus size={14} />
            Add Supplier
          </button>
        </div>
      </div>

      {/* ======================================================
          ERP METRICS SUMMARY (Strict ERP Standard)
      ====================================================== */}
      <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] mb-4">
        <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Total Suppliers
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-[var(--ink)]">
              {suppliers.length}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Registered suppliers</p>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Outstanding Payable
            </span>
            <p
              className={`mt-1 font-mono text-lg font-bold ${
                totalOutstanding > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-teal-600 dark:text-teal-400'
              }`}
            >
              {fmt(totalOutstanding)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Total amount payable</p>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Suppliers With Due
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-amber-600 dark:text-amber-400">
              {suppliersWithDue}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Accounts requiring payment</p>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Linked Products
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-teal-600 dark:text-teal-400">
              {suppliedProductCount}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Inventory products linked</p>
          </div>
        </div>
      </div>

      {/* ======================================================
          SEARCH TOOLBAR
      ====================================================== */}
      <div className="mb-4 rounded-md border border-[var(--line)] bg-[var(--surface)] p-2.5 sm:p-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-2 w-full md:max-w-xl border border-[var(--line)] bg-[var(--surface-elevated)] px-3 h-9 rounded-md">
            <Search size={14} className="text-[var(--muted-light)] shrink-0" />
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search supplier name, phone, email or GSTIN..."
              className="w-full bg-transparent outline-none text-xs text-[var(--ink)] placeholder:text-[var(--muted-light)]"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between md:justify-end gap-3 text-xs">
            <span className="text-[var(--muted)]">
              Showing{' '}
              <strong className="text-[var(--ink)] font-semibold mx-0.5">
                {filtered.length}
              </strong>{' '}
              of{' '}
              <strong className="text-[var(--ink)] font-semibold mx-0.5">
                {suppliers.length}
              </strong>{' '}
              suppliers
            </span>

            {expandedIds.size > 0 && (
              <button
                type="button"
                onClick={closeAllExpanded}
                className="text-[#1E3A5F] hover:text-[#162F4D] dark:text-blue-400 dark:hover:text-blue-300 font-semibold text-xs"
              >
                Collapse all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================
          SUPPLIERS TABLE CONTAINER
      ====================================================== */}
      <div className="overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface)] shadow-none">
        {/* Table topbar */}
        <div className="flex items-center justify-between border-b border-[var(--line-subtle)] px-3.5 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">
              Registered Suppliers
            </h2>
            <span className="rounded-sm bg-[var(--surface-elevated)] border border-[var(--line)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted)]">
              {filtered.length}
            </span>
          </div>

          <div className="hidden items-center gap-1.5 text-[11px] text-[var(--muted)] sm:flex">
            <Clock3 size={12} />
            <span>Vendor accounts & payables</span>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <Spinner />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center px-4">
            <Building2
              size={36}
              className="mx-auto text-[var(--muted-light)] mb-3"
            />
            <p className="text-sm font-semibold text-[var(--ink)]">
              {q
                ? 'No suppliers matching your search'
                : 'No suppliers registered'}
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">
              {q
                ? 'Try another supplier name, phone, email or GSTIN.'
                : 'Add your first supplier or import an Excel sheet to start managing vendor accounts.'}
            </p>
            {!q && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setImportModal(true)}
                  className="btn-secondary h-9 px-4 text-xs inline-flex items-center gap-1.5 rounded-md"
                >
                  <FileSpreadsheet size={14} />
                  Import Excel
                </button>
                <button
                  type="button"
                  onClick={openAdd}
                  className="btn-primary h-9 px-4 text-xs inline-flex items-center gap-1.5 rounded-md"
                >
                  <Plus size={14} />
                  Add Supplier
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card List (lg:hidden) */}
            <div className="space-y-2.5 p-2.5 lg:hidden">
              {filtered.map((supplier, index) => {
                const supplierProducts = products.filter(
                  product => product.supplier === supplier.id
                )
                const expanded = expandedIds.has(supplier.id)
                const due = Number(supplier.outstanding_amount || 0)

                return (
                  <div
                    key={supplier.id}
                    className="rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-[var(--muted)] font-mono">
                            #{index + 1}
                          </span>
                          <span className="font-bold text-sm text-[var(--ink)] truncate">
                            {supplier.name}
                          </span>
                        </div>
                        {supplier.address && (
                          <div className="flex items-start gap-1 mt-1 text-[11px] text-[var(--muted)]">
                            <MapPin size={10} className="shrink-0 mt-0.5" />
                            <span className="truncate">{supplier.address}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`font-mono text-sm font-bold tabular-nums ${
                            due > 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-teal-600 dark:text-teal-400'
                          }`}
                        >
                          {fmt(due)}
                        </div>
                        <div
                          className={`text-[10px] mt-0.5 ${
                            due > 0
                              ? 'text-red-500 dark:text-red-400'
                              : 'text-teal-600 dark:text-teal-400'
                          }`}
                        >
                          {due > 0 ? 'Payment due' : 'Paid / clear'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs border-t border-[var(--line-subtle)] pt-2 text-[var(--muted)]">
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider">
                          Contact
                        </div>
                        <div className="text-xs text-[var(--ink)] mt-0.5 truncate">
                          {supplier.phone || supplier.email || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider">
                          GSTIN
                        </div>
                        <div className="text-xs font-mono text-[var(--ink)] mt-0.5 truncate">
                          {supplier.gstin || 'Not provided'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--line-subtle)]">
                      <button
                        type="button"
                        onClick={() => toggleExpand(supplier.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[var(--line)] bg-[var(--surface-elevated)] text-[11px] font-semibold text-[var(--ink)]"
                      >
                        <Package size={12} className="text-[#1E3A5F] dark:text-slate-300" />
                        <span>{supplierProducts.length} Products</span>
                        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </button>

                      <div className="flex items-center gap-1.5">
                        {due > 0 && (
                          <button
                            type="button"
                            onClick={() => openPayment(supplier)}
                            className="h-7 px-2.5 bg-[#1E3A5F] text-white hover:bg-[#162F4D] text-[11px] font-semibold flex items-center gap-1 rounded"
                          >
                            <CreditCard size={12} />
                            Pay
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(supplier)}
                          className="h-7 px-2 border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:text-[var(--ink)] text-[11px] font-semibold flex items-center gap-1 rounded"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(supplier)}
                          className="h-7 w-7 border border-[var(--line)] bg-[var(--surface)] text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded flex items-center justify-center"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Mobile Expanded Products */}
                    {expanded && (
                      <div className="mt-2 pt-2 border-t border-[var(--line)] space-y-2">
                        <div className="text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider">
                          Linked Products ({supplierProducts.length})
                        </div>
                        {supplierProducts.length === 0 ? (
                          <p className="text-xs text-[var(--muted)]">No products linked.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {supplierProducts.map(p => (
                              <div
                                key={p.id}
                                className="flex items-center justify-between text-xs p-2 rounded bg-[var(--surface-elevated)] border border-[var(--line)]"
                              >
                                <div className="min-w-0">
                                  <div className="font-semibold text-[var(--ink)] truncate">
                                    {p.name}
                                  </div>
                                  <div className="text-[10px] text-[var(--muted)] font-mono">
                                    SKU: {p.sku || '—'}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="font-mono font-bold text-[var(--ink)]">
                                    {fmt(p.selling_price)}
                                  </div>
                                  <div className="text-[10px] text-[var(--muted)] font-mono">
                                    Stock: {p.current_stock ?? 0}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop / Tablet Table (hidden lg:block) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="erp-table w-full text-left text-xs min-w-[1050px]">
                <thead>
                  <tr>
                    <th className="w-12 text-center">#</th>
                    <th className="min-w-[220px]">Supplier</th>
                    <th className="min-w-[190px]">Contact Details</th>
                    <th className="w-40">GSTIN</th>
                    <th className="w-28 text-center">Products</th>
                    <th className="w-36 text-right">Outstanding</th>
                    <th className="w-36 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {filtered.map((supplier, index) => {
                    const supplierProducts = products.filter(
                      product => product.supplier === supplier.id
                    )
                    const expanded = expandedIds.has(supplier.id)
                    const due = Number(supplier.outstanding_amount || 0)

                    return (
                      <React.Fragment key={supplier.id}>
                        <tr
                          className={`hover:bg-[var(--surface-hover)] transition-colors ${
                            expanded ? 'bg-[var(--surface-elevated)]' : ''
                          }`}
                        >
                          {/* Number & Expand Chevron */}
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => toggleExpand(supplier.id)}
                                className="w-6 h-6 flex items-center justify-center text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] rounded transition-colors"
                                title={
                                  expanded
                                    ? 'Collapse products'
                                    : 'View products'
                                }
                              >
                                {expanded ? (
                                  <ChevronDown size={14} />
                                ) : (
                                  <ChevronRight size={14} />
                                )}
                              </button>
                              <span className="text-[10px] text-[var(--muted)] font-mono">
                                {index + 1}
                              </span>
                            </div>
                          </td>

                          {/* Supplier */}
                          <td>
                            <div className="min-w-[210px]">
                              <div className="font-bold text-sm text-[var(--ink)]">
                                {supplier.name}
                              </div>
                              {supplier.address && (
                                <div className="flex items-start gap-1 mt-1 max-w-[280px] text-[11px] text-[var(--muted)]">
                                  <MapPin
                                    size={10}
                                    className="shrink-0 mt-0.5 text-[var(--muted-light)]"
                                  />
                                  <span className="line-clamp-2">
                                    {supplier.address}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Contact Details */}
                          <td>
                            <div className="space-y-1 min-w-[180px]">
                              {supplier.phone ? (
                                <div className="flex items-center gap-1.5 text-xs text-[var(--ink-secondary)]">
                                  <Phone
                                    size={11}
                                    className="text-[#1E3A5F] dark:text-slate-300"
                                  />
                                  <span>{supplier.phone}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-[var(--muted)]">
                                  No phone
                                </span>
                              )}

                              {supplier.email && (
                                <div className="flex items-center gap-1.5 max-w-[200px] text-[11px] text-[var(--muted)]">
                                  <Mail
                                    size={11}
                                    className="shrink-0 text-[var(--muted-light)]"
                                  />
                                  <span className="truncate">
                                    {supplier.email}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* GSTIN */}
                          <td>
                            {supplier.gstin ? (
                              <span className="font-mono text-[11px] font-semibold text-[var(--ink-secondary)]">
                                {supplier.gstin}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[var(--muted)]">
                                Not provided
                              </span>
                            )}
                          </td>

                          {/* Products */}
                          <td className="text-center">
                            <button
                              type="button"
                              onClick={() => toggleExpand(supplier.id)}
                              className="inline-flex items-center gap-1.5 h-7 px-2.5 border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink-secondary)] hover:border-[#1E3A5F] hover:text-[var(--primary)] rounded transition-colors"
                            >
                              <Package
                                size={12}
                                className="text-[#1E3A5F] dark:text-slate-300"
                              />
                              {supplierProducts.length}
                            </button>
                          </td>

                          {/* Outstanding */}
                          <td className="text-right">
                            <div
                              className={`font-mono text-sm font-bold tabular-nums ${
                                due > 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-teal-600 dark:text-teal-400'
                              }`}
                            >
                              {fmt(due)}
                            </div>
                            <div
                              className={`text-[10px] mt-0.5 ${
                                due > 0
                                  ? 'text-red-500 dark:text-red-400'
                                  : 'text-teal-600 dark:text-teal-400'
                              }`}
                            >
                              {due > 0 ? 'Payment due' : 'Paid / clear'}
                            </div>
                          </td>

                          {/* Actions */}
                          <td>
                            <div className="flex items-center justify-end gap-1.5">
                              {due > 0 && (
                                <button
                                  type="button"
                                  onClick={() => openPayment(supplier)}
                                  className="h-7 px-2.5 bg-[#1E3A5F] text-white hover:bg-[#162F4D] text-[11px] font-semibold flex items-center gap-1 rounded transition-colors"
                                  title="Record payment"
                                >
                                  <CreditCard size={12} />
                                  Pay
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => openEdit(supplier)}
                                className="h-7 px-2 border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:border-[var(--line-strong)] hover:text-[var(--ink)] text-[11px] font-semibold flex items-center gap-1 rounded transition-colors"
                                title="Edit supplier"
                              >
                                <Pencil size={12} />
                                <span className="hidden xl:inline">Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeleteTarget(supplier)}
                                className="h-7 w-7 border border-[var(--line)] bg-[var(--surface)] text-red-500 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 rounded flex items-center justify-center transition-colors"
                                title="Delete supplier"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Linked Products */}
                        {expanded && (
                          <SupplierProductsRow
                            supplier={supplier}
                            products={products}
                            onClose={() => toggleExpand(supplier.id)}
                          />
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ======================================================
          ADD / EDIT MODAL
      ====================================================== */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Supplier' : 'Add Supplier'}
        size="sm"
      >
        <SupplierForm
          initial={editing}
          onSaved={onSaved}
          onClose={() => setModal(false)}
        />
      </Modal>

      {/* ======================================================
          BULK EXCEL IMPORT MODAL
      ====================================================== */}
      <SupplierBulkImportModal
        open={importModal}
        onClose={() => setImportModal(false)}
        onSuccess={load}
      />

      {/* ======================================================
          PAYMENT MODAL
      ====================================================== */}
      <Modal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title={`Record Payment — ${payTarget?.name || ''}`}
        size="sm"
      >
        <div className="space-y-4">
          {/* Outstanding Banner */}
          <div className="border border-red-500/20 bg-red-500/10 px-4 py-3 rounded-md">
            <div className="text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
              Outstanding Payable
            </div>
            <div className="mt-1 text-xl font-bold font-mono text-red-700 dark:text-red-300">
              {fmt(payTarget?.outstanding_amount)}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="label">
              Amount Paid (₹)
              <span className="text-red-600 dark:text-red-400 ml-1">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={payTarget?.outstanding_amount || undefined}
              className="input font-mono text-right"
              value={payAmt}
              onChange={e => setPayAmt(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>

          {/* Payment Method */}
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

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] pt-4">
            <button
              type="button"
              onClick={() => setPayTarget(null)}
              className="btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={recordPayment}
              disabled={paying}
              className="btn-primary h-9 px-4 text-xs flex items-center justify-center gap-1.5"
            >
              <IndianRupee size={14} />
              {paying ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ======================================================
          DELETE MODAL
      ====================================================== */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Supplier"
        size="sm"
      >
        <div className="space-y-4">
          <div className="border border-red-500/20 bg-red-500/10 p-3 rounded-md">
            <div className="flex items-start gap-2">
              <Trash2
                size={16}
                className="text-red-600 dark:text-red-400 mt-0.5 shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                  Delete supplier record?
                </p>
                <p className="text-xs text-red-600/80 dark:text-red-400 mt-1">
                  This action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-[var(--muted)]">
            Are you sure you want to delete{' '}
            <span className="font-bold text-[var(--ink)]">
              "{deleteTarget?.name}"
            </span>
            ?
          </p>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] pt-4">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="btn-danger h-9 px-4 text-xs"
            >
              {deleting ? 'Deleting...' : 'Delete Supplier'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}