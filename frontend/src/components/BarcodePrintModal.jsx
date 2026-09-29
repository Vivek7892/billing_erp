import { useState, useMemo } from 'react'
import { Modal } from './UI'
import { API_BASE_URL } from '../api'
import toast from 'react-hot-toast'
import {
  Printer,
  Download,
  Eye,
  Sliders,
  CheckSquare,
  Square,
  Minus,
  Plus,
  Sparkles,
  Layers,
  X,
} from 'lucide-react'

const LABEL_SIZES = [
  {
    id: 'a4_3x5',
    title: 'A4 - 3 × 5',
    description: '15 labels/sheet · 64 × 54 mm (Medium standard)',
    cols: 3,
    rows: 5,
    perSheet: 15,
  },
  {
    id: 'a4_4x8',
    title: 'A4 - 4 × 8',
    description: '32 labels/sheet · 48 × 34 mm (Compact mini)',
    cols: 4,
    rows: 8,
    perSheet: 32,
  },
  {
    id: 'thermal_58',
    title: '58mm Thermal',
    description: 'Continuous roll · 58 × 40 mm (POS receipt/label)',
    cols: 1,
    rows: 1,
    perSheet: 1,
  },
  {
    id: 'thermal_80',
    title: '80mm Thermal',
    description: 'Continuous roll · 80 × 50 mm (Wide thermal)',
    cols: 1,
    rows: 1,
    perSheet: 1,
  },
  {
    id: 'custom',
    title: 'Custom',
    description: 'Custom columns and rows on standard A4 page',
    cols: 3,
    rows: 5,
    perSheet: null,
  },
]

export default function BarcodePrintModal({ open, onClose, product, shopName = 'RETAIL STORE' }) {
  const [size, setSize] = useState('a4_3x5')
  const [customCols, setCustomCols] = useState(3)
  const [customRows, setCustomRows] = useState(5)
  const [copies, setCopies] = useState(15)

  // Information fields toggles
  const [fields, setFields] = useState({
    storeName: true,
    productName: true,
    barcode: true,
    barcodeNumber: true,
    sku: true,
    sellingPrice: true,
    mrp: true,
    unit: true,
  })

  const toggleField = key => {
    setFields(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const selectedSizeObj = useMemo(() => {
    return LABEL_SIZES.find(s => s.id === size) || LABEL_SIZES[0]
  }, [size])

  // Quick preset copies based on layout
  const presets = useMemo(() => {
    if (size === 'a4_3x5') return [1, 15, 30, 45, 60]
    if (size === 'a4_4x8') return [1, 32, 64, 96, 128]
    if (size.startsWith('thermal')) return [1, 5, 10, 25, 50]
    return [1, 10, 25, 50, 100]
  }, [size])

  const buildUrl = (download = false) => {
    if (!product?.id) return ''
    const token = localStorage.getItem('access_token') || ''
    const params = new URLSearchParams({
      copies: String(Math.max(1, Math.min(500, Number(copies) || 1))),
      size: size,
      custom_cols: String(customCols),
      custom_rows: String(customRows),
      show_store: String(fields.storeName),
      show_name: String(fields.productName),
      show_barcode: String(fields.barcode),
      show_number: String(fields.barcodeNumber),
      show_sku: String(fields.sku),
      show_price: String(fields.sellingPrice),
      show_mrp: String(fields.mrp),
      show_unit: String(fields.unit),
    })
    if (token) params.set('token', token)
    if (download) params.set('download', '1')

    return `${API_BASE_URL}/products/${product.id}/barcode-label/?${params.toString()}`
  }

  const handlePreview = () => {
    const url = buildUrl(false)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handlePrint = () => {
    const url = buildUrl(false)
    if (url) {
      const win = window.open(url, '_blank', 'noopener,noreferrer')
      if (win) {
        win.focus()
        toast.success('Opening print document...')
      }
    }
  }

  const handleDownload = () => {
    const url = buildUrl(true)
    if (url) {
      const a = document.createElement('a')
      a.href = url
      a.download = `barcode-${product?.sku || 'product'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      toast.success('Downloading barcode PDF...')
    }
  }

  const barcodeValue = product?.barcode || product?.sku || '890123456789'
  const formattedPrice = product?.selling_price != null
    ? `₹${Number(product.selling_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : '₹0.00'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Barcode Label Generator"
      size="lg"
    >
      {product && (
        <div className="space-y-5 text-[var(--ink)]">
          {/* Top Info Banner */}
          <div className="flex items-center justify-between rounded-xl bg-[var(--surface-elevated)] border border-[var(--line)] px-3.5 py-2.5 text-xs">
            <div className="min-w-0">
              <span className="font-bold text-[var(--ink)] block truncate">{product.name}</span>
              <span className="text-[11px] text-[var(--muted)] font-mono">
                SKU: {product.sku || '—'} {product.barcode ? `· Barcode: ${product.barcode}` : ''}
              </span>
            </div>
            <span className="font-mono font-bold text-indigo-600 text-sm shrink-0">
              {formattedPrice}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left Controls (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* 1. Label Size Selection */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] block mb-2">
                  Label Size
                </label>
                <div className="space-y-1.5">
                  {LABEL_SIZES.map(s => {
                    const isSelected = size === s.id
                    return (
                      <label
                        key={s.id}
                        className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500/20'
                            : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-elevated)]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="labelSize"
                          value={s.id}
                          checked={isSelected}
                          onChange={() => {
                            setSize(s.id)
                            if (s.perSheet) setCopies(s.perSheet)
                          }}
                          className="mt-0.5 h-4 w-4 text-indigo-600 border-[var(--line)] focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-xs font-bold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-[var(--ink)]'}`}>
                              {s.title}
                            </span>
                            {s.perSheet && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--muted)] font-mono">
                                {s.perSheet} / page
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--muted-light)] mt-0.5">
                            {s.description}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>

                {/* Custom Columns & Rows Input */}
                {size === 'custom' && (
                  <div className="mt-2.5 grid grid-cols-2 gap-3 p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--line)]">
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--muted)] block mb-1">
                        Columns (1–8)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        className="input h-9 w-full text-xs font-mono font-bold"
                        value={customCols}
                        onChange={e => setCustomCols(Math.max(1, Math.min(8, Number(e.target.value) || 1)))}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[var(--muted)] block mb-1">
                        Rows (1–15)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="15"
                        className="input h-9 w-full text-xs font-mono font-bold"
                        value={customRows}
                        onChange={e => setCustomRows(Math.max(1, Math.min(15, Number(e.target.value) || 1)))}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Information to Include */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Information
                  </label>
                  <span className="text-[11px] text-[var(--muted-light)]">
                    Toggle elements to print
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'storeName', label: 'Store Name' },
                    { key: 'productName', label: 'Product Name' },
                    { key: 'barcode', label: 'Barcode' },
                    { key: 'barcodeNumber', label: 'Barcode Number' },
                    { key: 'sku', label: 'SKU' },
                    { key: 'sellingPrice', label: 'Selling Price' },
                    { key: 'mrp', label: 'MRP' },
                    { key: 'unit', label: 'Unit' },
                  ].map(({ key, label }) => {
                    const checked = fields[key]
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-2 p-2 rounded-xl border border-[var(--line-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-elevated)] cursor-pointer transition select-none"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleField(key)}
                          className="h-4 w-4 rounded border-[var(--line)] text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-semibold text-[var(--ink)]">
                          {label}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* 3. Copies and Quick Count */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Copies
                  </label>
                  <div className="flex items-center gap-1">
                    {presets.map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setCopies(cnt)}
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold border transition ${
                          copies === cnt
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--line)] hover:bg-[var(--surface-elevated)]'
                        }`}
                      >
                        {cnt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-xs flex-1">
                    <button
                      type="button"
                      onClick={() => setCopies(prev => Math.max(1, prev - 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)] transition"
                      aria-label="Decrease copies"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      value={copies}
                      onChange={e => setCopies(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                      className="w-full text-center font-mono text-sm font-bold text-[var(--ink)] bg-transparent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setCopies(prev => Math.min(500, prev + 1))}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)] transition"
                      aria-label="Increase copies"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handlePreview}
                    className="btn-primary btn-base px-4 text-xs font-semibold flex items-center gap-1.5 shrink-0"
                  >
                    <Sparkles size={14} />
                    Generate Labels
                  </button>
                </div>
              </div>
            </div>

            {/* Right Live Tag Preview (5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-[var(--line)] pb-2">
                  <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
                    <Eye size={13} className="text-indigo-600" />
                    Live Label Preview
                  </span>
                  <span className="text-[10px] font-mono text-[var(--muted)]">
                    {selectedSizeObj.title}
                  </span>
                </div>

                {/* Simulated Label Card */}
                <div
                  className={`mx-auto rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-sm text-center transition-all ${
                    size === 'a4_4x8' ? 'max-w-[200px]' : 'max-w-[240px]'
                  }`}
                >
                  {/* Store Name */}
                  {fields.storeName && (
                    <p className="text-[10px] font-bold tracking-wider text-indigo-900 dark:text-indigo-300 uppercase truncate">
                      {shopName}
                    </p>
                  )}

                  {/* Product Name */}
                  {fields.productName && (
                    <p className="mt-1 text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {product.name}
                    </p>
                  )}

                  {/* Barcode Graphic */}
                  {fields.barcode && (
                    <div className="my-2.5 flex items-center justify-center">
                      <div className="flex items-center justify-center gap-[2px] h-11 w-full bg-white px-2 py-1.5 border border-slate-200 rounded">
                        {Array.from({ length: 30 }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-full bg-slate-900 ${
                              (i * 7) % 5 === 0
                                ? 'w-[3px]'
                                : (i * 3) % 2 === 0
                                  ? 'w-[2px]'
                                  : 'w-[1px]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Barcode Number */}
                  {fields.barcodeNumber && (
                    <p className="font-mono text-[10px] font-bold tracking-widest text-slate-600 dark:text-slate-400">
                      {barcodeValue}
                    </p>
                  )}

                  {/* Divider */}
                  {(fields.sku || fields.sellingPrice || fields.mrp || fields.unit) && (
                    <div className="my-2 border-t border-slate-200 dark:border-slate-800" />
                  )}

                  {/* Bottom Line */}
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="text-left font-mono text-slate-500 truncate space-x-1">
                      {fields.sku && <span>SKU: {product.sku}</span>}
                      {fields.unit && product.unit && <span>({product.unit})</span>}
                      {fields.mrp && product.mrp && Number(product.mrp) > 0 && (
                        <span className="line-through text-slate-400">MRP: ₹{product.mrp}</span>
                      )}
                    </div>
                    {fields.sellingPrice && (
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-xs shrink-0">
                        {formattedPrice}
                      </span>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-center text-[10px] text-[var(--muted-light)]">
                  Matches your selected size &amp; field checkboxes in real-time.
                </p>
              </div>

              {/* Total info badge */}
              <div className="mt-4 rounded-xl bg-[var(--surface)] border border-[var(--line)] p-2.5 text-center text-xs">
                <span className="text-[var(--muted)]">Total Labels to Print: </span>
                <span className="font-mono font-bold text-indigo-600 text-sm">
                  {copies} {copies === 1 ? 'Label' : 'Labels'}
                </span>
                {selectedSizeObj.perSheet && (
                  <span className="text-[11px] text-[var(--muted-light)] block mt-0.5">
                    (~{Math.ceil(copies / selectedSizeObj.perSheet)} sheet{Math.ceil(copies / selectedSizeObj.perSheet) !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary btn-base w-full sm:w-auto text-xs"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handlePreview}
                className="btn-secondary btn-base flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-semibold"
                title="Preview labels in new tab"
              >
                <Eye size={14} />
                Preview
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="btn-primary btn-base flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-semibold"
                title="Print labels"
              >
                <Printer size={14} />
                Print
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="btn-secondary btn-base flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-xs font-semibold"
                title="Download PDF"
              >
                <Download size={14} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
