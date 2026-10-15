import { useState, useMemo } from 'react'
import { Modal } from './UI'
import { API_BASE_URL } from '../api'
import { getAccessToken } from '../services/tokenStorage'
import toast from 'react-hot-toast'
import { Printer, Download, Minus, Plus } from 'lucide-react'

const LABEL_SIZES = [
  { id: 'a4_3x5',    title: 'A4 · 3×5',      sub: '15/sheet · 64×54 mm',  cols: 3, rows: 5,  perSheet: 15 },
  { id: 'a4_4x8',    title: 'A4 · 4×8',      sub: '32/sheet · 48×34 mm',  cols: 4, rows: 8,  perSheet: 32 },
  { id: 'thermal_58',title: '58 mm Thermal',  sub: 'Roll · 58×40 mm',      cols: 1, rows: 1,  perSheet: 1  },
  { id: 'thermal_80',title: '80 mm Thermal',  sub: 'Roll · 80×50 mm',      cols: 1, rows: 1,  perSheet: 1  },
  { id: 'custom',    title: 'Custom',         sub: 'Set cols & rows',       cols: 3, rows: 5,  perSheet: null },
]

const FIELD_LIST = [
  { key: 'storeName',    label: 'Store Name'    },
  { key: 'productName',  label: 'Product Name'  },
  { key: 'barcode',      label: 'Barcode'       },
  { key: 'barcodeNumber',label: 'Barcode No.'   },
  { key: 'sku',          label: 'SKU'           },
  { key: 'sellingPrice', label: 'Sell Price'    },
  { key: 'mrp',          label: 'MRP'           },
  { key: 'unit',         label: 'Unit'          },
]

function validRetailCheckDigit(value) {
  const digits = String(value || '')
  if (!/^\d+$/.test(digits) || ![8, 12, 13].includes(digits.length)) return null
  const values = digits.slice(0, -1).split('').reverse().map(Number)
  const sum = values.reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1])
}

export default function BarcodePrintModal({ open, onClose, product, shopName ={shopname}) {
  const [size, setSize]           = useState('a4_3x5')
  const [customCols, setCustomCols] = useState(3)
  const [customRows, setCustomRows] = useState(5)
  const [copies, setCopies]       = useState(15)
  const [fields, setFields]       = useState({
    storeName: true, productName: true, barcode: true, barcodeNumber: true,
    sku: true, sellingPrice: true, mrp: true, unit: true,
  })

  const toggleField = key => setFields(prev => ({ ...prev, [key]: !prev[key] }))

  const sel = useMemo(() => LABEL_SIZES.find(s => s.id === size) || LABEL_SIZES[0], [size])

  const presets = useMemo(() => {
    if (size === 'a4_3x5')          return [15, 30, 45, 60]
    if (size === 'a4_4x8')          return [32, 64, 96, 128]
    if (size.startsWith('thermal')) return [5, 10, 25, 50]
    return [10, 25, 50, 100]
  }, [size])

  const buildUrl = (download = false) => {
    if (!product?.id) return ''
    const token = getAccessToken() || ''
    const params = new URLSearchParams({
      copies: String(Math.max(1, Math.min(500, Number(copies) || 1))),
      size, custom_cols: String(customCols), custom_rows: String(customRows),
      show_store: String(fields.storeName),   show_name: String(fields.productName),
      show_barcode: String(fields.barcode),   show_number: String(fields.barcodeNumber),
      show_sku: String(fields.sku),           show_price: String(fields.sellingPrice),
      show_mrp: String(fields.mrp),           show_unit: String(fields.unit),
    })
    if (token)    params.set('token', token)
    if (download) params.set('download', '1')
    return `${API_BASE_URL}/products/${product.id}/barcode-label/?${params.toString()}`
  }

  const handlePrint = () => {
    const url = buildUrl(false)
    if (!url) return
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (win) { win.focus(); toast.success('Opening print document…') }
  }

  const handleDownload = () => {
    const url = buildUrl(true)
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `barcode-${product?.sku || 'product'}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Downloading barcode PDF…')
  }

  const barcodeValue  = product?.barcode || product?.sku || '890123456789'
  const retailCheckDigitValid = validRetailCheckDigit(product?.barcode)
  const formattedPrice = product?.selling_price != null
    ? `₹${Number(product.selling_price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : '₹0.00'

  const perPage = sel.perSheet ?? (customCols * customRows)
  const sheets  = perPage > 0 ? Math.ceil(copies / perPage) : 1

  // Simulated barcode bars pattern
  const BARS = Array.from({ length: 42 }, (_, i) => {
    const w = (i * 7) % 9 === 0 ? 3 : (i * 5) % 3 === 0 ? 2 : 1
    return w
  })

  return (
    <Modal open={open} onClose={onClose} title="Print barcode labels" size="lg">
      {product && (
        <div className="space-y-4 text-[var(--ink)]">

          {/* Product info strip */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--ink)]">{product.name}</p>
              <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">
                SKU: {product.sku || '—'}{product.barcode ? ` · ${product.barcode}` : ''}
              </p>
            </div>
            <span className="shrink-0 font-mono text-sm font-extrabold text-[#1E3A5F] dark:text-slate-100">
              {formattedPrice}
            </span>
          </div>
          {retailCheckDigitValid === false && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              This number fails the UPC/EAN check digit. It will print as Code 128; confirm the product barcode before printing a batch.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">

            {/* ── Left controls ── */}
            <div className="lg:col-span-7 space-y-4">

              {/* Label size */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Label Size</p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {LABEL_SIZES.map(s => {
                    const active = size === s.id
                    return (
                      <label
                        key={s.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${
                          active
                            ? 'border-[#1E3A5F] bg-[var(--surface-elevated)] ring-1 ring-[#1E3A5F]/20'
                            : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-elevated)]'
                        }`}
                      >
                        <input
                          type="radio" name="labelSize" value={s.id} checked={active}
                          onChange={() => { setSize(s.id); if (s.perSheet) setCopies(s.perSheet) }}
                          className="h-3.5 w-3.5 accent-[#1E3A5F] cursor-pointer shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-bold ${active ? 'text-[#1E3A5F] dark:text-slate-200' : 'text-[var(--ink)]'}`}>
                              {s.title}
                            </span>
                            {s.perSheet && (
                              <span className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--muted)]">
                                {s.perSheet}/pg
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[10px] text-[var(--muted-light)]">{s.sub}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>

                {size === 'custom' && (
                  <div className="mt-2 grid grid-cols-2 gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3">
                    {[['Columns (1–8)', customCols, v => setCustomCols(Math.max(1, Math.min(8, v))), 1, 8],
                      ['Rows (1–15)',   customRows, v => setCustomRows(Math.max(1, Math.min(15, v))), 1, 15]].map(([lbl, val, set, mn, mx]) => (
                      <div key={lbl}>
                        <p className="mb-1 text-[11px] font-semibold text-[var(--muted)]">{lbl}</p>
                        <input type="number" min={mn} max={mx} value={val}
                          onChange={e => set(Number(e.target.value) || mn)}
                          className="input h-9 w-full text-center font-mono text-xs font-bold"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fields to print */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Print Fields</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {FIELD_LIST.map(({ key, label }) => {
                    const on = fields[key]
                    return (
                      <label
                        key={key}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition select-none ${
                          on
                            ? 'border-[#1E3A5F]/30 bg-[#1E3A5F]/5 dark:border-[#1E3A5F]/40 dark:bg-[#1E3A5F]/10'
                            : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-elevated)]'
                        }`}
                      >
                        <input type="checkbox" checked={on} onChange={() => toggleField(key)}
                          className="h-3.5 w-3.5 rounded accent-[#1E3A5F] cursor-pointer shrink-0"
                        />
                        <span className="text-[11px] font-semibold text-[var(--ink)]">{label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Copies */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Copies</p>
                  <div className="flex items-center gap-1">
                    {presets.map(n => (
                      <button key={n} type="button" onClick={() => setCopies(n)}
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold transition ${
                          copies === n
                            ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'
                        }`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
                  <button type="button" onClick={() => setCopies(p => Math.max(1, p - 1))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)] transition"
                  ><Minus size={13} /></button>
                  <input type="number" min="1" max="500" value={copies}
                    onChange={e => setCopies(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                    className="w-full bg-transparent text-center font-mono text-sm font-bold text-[var(--ink)] focus:outline-none"
                  />
                  <button type="button" onClick={() => setCopies(p => Math.min(500, p + 1))}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)] transition"
                  ><Plus size={13} /></button>
                </div>
              </div>
            </div>

            {/* ── Right: live label preview ── */}
            <div className="lg:col-span-5 flex flex-col gap-3">

              {/* Preview card */}
              <div className="flex-1 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Label Preview</p>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-200">
                    Live
                  </span>
                </div>

                {/* Simulated label */}
                <div className={`mx-auto rounded-xl border-2 border-slate-200 bg-white shadow-md dark:border-slate-700 dark:bg-slate-900 ${size === 'a4_4x8' ? 'max-w-[190px]' : 'max-w-[240px]'} p-3 text-center`}>
                  {fields.storeName && (
                    <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#1E3A5F] dark:text-slate-300">
                      {shopName}
                    </p>
                  )}
                  {fields.productName && (
                    <p className="mt-1 truncate text-[13px] font-extrabold text-slate-900 dark:text-slate-100">
                      {product.name}
                    </p>
                  )}
                  {fields.barcode && (
                    <div className="my-2 flex h-14 items-stretch justify-center gap-px overflow-hidden rounded-md border border-slate-100 bg-white px-2 py-2 dark:border-slate-800">
                      {BARS.map((w, i) => (
                        <div key={i} className="bg-slate-950 dark:bg-slate-100" style={{ width: w }} />
                      ))}
                    </div>
                  )}
                  {fields.barcodeNumber && (
                    <p className="font-mono text-[9px] font-bold tracking-[0.12em] text-slate-600 dark:text-slate-400">
                      {barcodeValue}
                    </p>
                  )}
                  {(fields.sku || fields.sellingPrice || fields.mrp || fields.unit) && (
                    <div className="my-1.5 border-t border-slate-100 dark:border-slate-800" />
                  )}
                  <div className="flex items-end justify-between text-[9px]">
                    <div className="min-w-0 text-left font-mono text-slate-500">
                      {fields.sku && <span className="block truncate">SKU: {product.sku || '—'}</span>}
                      {fields.unit && product.unit && <span className="block">Unit: {product.unit}</span>}
                      {fields.mrp && product.mrp && Number(product.mrp) > 0 && (
                        <span className="block text-slate-400 line-through">
                          MRP: ₹{Number(product.mrp).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                    {fields.sellingPrice && (
                      <span className="shrink-0 font-mono text-[13px] font-extrabold text-slate-900 dark:text-slate-100">
                        {formattedPrice}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Print summary */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-center">
                <p className="text-[11px] text-[var(--muted)]">Ready to print</p>
                <p className="mt-0.5 font-mono text-xl font-extrabold text-[#1E3A5F] dark:text-slate-100">
                  {copies} <span className="text-sm font-bold">{copies === 1 ? 'label' : 'labels'}</span>
                </p>
                {sel.perSheet && (
                  <p className="mt-0.5 text-[10px] text-[var(--muted-light)]">
                    ≈ {sheets} sheet{sheets !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={handleDownload}
              className="btn-secondary btn-base flex min-h-11 items-center justify-center gap-2 text-xs font-semibold sm:w-auto"
            >
              <Download size={14} /> Download PDF
            </button>
            <button type="button" onClick={handlePrint}
              className="btn-primary btn-base flex min-h-11 items-center justify-center gap-2 text-xs font-semibold sm:w-auto"
            >
              <Printer size={14} /> Print Labels
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
