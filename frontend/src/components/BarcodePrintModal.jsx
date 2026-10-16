import { useState, useMemo, useRef, useEffect } from 'react'
import { Modal } from './UI'
import { API_BASE_URL } from '../api'
import { getAccessToken } from '../services/tokenStorage'
import toast from 'react-hot-toast'
import { Printer, Download, Minus, Plus } from 'lucide-react'
import JsBarcode from 'jsbarcode'

const LABEL_SIZES = [
  {
    id: 'a4_3x5',
    title: 'A4 · 3×5',
    sub: '15/sheet · 64×54 mm',
    cols: 3,
    rows: 5,
    perSheet: 15,
  },
  {
    id: 'a4_4x8',
    title: 'A4 · 4×8',
    sub: '32/sheet · 48×34 mm',
    cols: 4,
    rows: 8,
    perSheet: 32,
  },
  {
    id: 'thermal_58',
    title: '58 mm Thermal',
    sub: 'Roll · 58×40 mm',
    cols: 1,
    rows: 1,
    perSheet: 1,
  },
  {
    id: 'thermal_80',
    title: '80 mm Thermal',
    sub: 'Roll · 80×50 mm',
    cols: 1,
    rows: 1,
    perSheet: 1,
  },
  {
    id: 'custom',
    title: 'Custom',
    sub: 'Set cols & rows',
    cols: 3,
    rows: 5,
    perSheet: null,
  },
]

const FIELD_LIST = [
  { key: 'storeName', label: 'Store Name' },
  { key: 'productName', label: 'Product Name' },
  { key: 'barcode', label: 'Barcode' },
  { key: 'barcodeNumber', label: 'Barcode No.' },
  { key: 'sku', label: 'SKU' },
  { key: 'sellingPrice', label: 'Sell Price' },
  { key: 'mrp', label: 'MRP' },
  { key: 'unit', label: 'Unit' },
]

function validRetailCheckDigit(value) {
  const digits = String(value || '')

  if (!/^\d+$/.test(digits) || ![8, 12, 13].includes(digits.length)) {
    return null
  }

  const values = digits
    .slice(0, -1)
    .split('')
    .reverse()
    .map(Number)

  const sum = values.reduce(
    (total, digit, index) =>
      total + digit * (index % 2 === 0 ? 3 : 1),
    0
  )

  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1])
}

export default function BarcodePrintModal({
  open,
  onClose,
  product,
  shopName,
}) {
  const [size, setSize] = useState('a4_3x5')
  const [customCols, setCustomCols] = useState(3)
  const [customRows, setCustomRows] = useState(5)
  const [copies, setCopies] = useState(15)

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

  const toggleField = (key) => {
    setFields((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const sel = useMemo(
    () => LABEL_SIZES.find((s) => s.id === size) || LABEL_SIZES[0],
    [size]
  )

  const presets = useMemo(() => {
    if (size === 'a4_3x5') return [15, 30, 45, 60]
    if (size === 'a4_4x8') return [32, 64, 96, 128]
    if (size.startsWith('thermal')) return [5, 10, 25, 50]
    return [10, 25, 50, 100]
  }, [size])

  const buildUrl = (download = false) => {
    if (!product?.id) return ''

    const token = getAccessToken() || ''

    const params = new URLSearchParams({
      copies: String(
        Math.max(1, Math.min(500, Number(copies) || 1))
      ),

      size,

      custom_cols: String(customCols),
      custom_rows: String(customRows),

      // Store / shop name
      shop_name: shopName || '',

      show_store: String(fields.storeName),
      show_name: String(fields.productName),
      show_barcode: String(fields.barcode),
      show_number: String(fields.barcodeNumber),
      show_sku: String(fields.sku),
      show_price: String(fields.sellingPrice),
      show_mrp: String(fields.mrp),
      show_unit: String(fields.unit),
    })

    if (token) {
      params.set('token', token)
    }

    if (download) {
      params.set('download', '1')
    }

    return `${API_BASE_URL}/products/${product.id}/barcode-label/?${params.toString()}`
  }

  const handlePrint = () => {
    const url = buildUrl(false)

    if (!url) return

    const win = window.open(
      url,
      '_blank',
      'noopener,noreferrer'
    )

    if (win) {
      win.focus()
      toast.success('Opening print document…')
    }
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

  const barcodeValue =
    (product?.barcode || product?.sku || String(product?.id || '890123456789')).trim()

  const retailCheckDigitValid = validRetailCheckDigit(product?.barcode)

  const sellingPriceNum = Number(product?.selling_price) || 0
  const mrpNum =
    product?.mrp != null && String(product.mrp).trim() !== ''
      ? Number(product.mrp)
      : null
  const hasMrp = mrpNum != null && !isNaN(mrpNum) && mrpNum > 0
  const strikeThroughMrp = hasMrp && mrpNum > sellingPriceNum

  const formattedPrice = `₹${sellingPriceNum.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

  const formattedMrp = hasMrp
    ? `MRP ₹${mrpNum.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : ''

  const perPage = sel.perSheet ?? customCols * customRows
  const sheets = perPage > 0 ? Math.ceil(copies / perPage) : 1

  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current || !fields.barcode || !barcodeValue) return
    try {
      JsBarcode(svgRef.current, String(barcodeValue).trim(), {
        format: 'CODE128',
        displayValue: false,
        lineColor: '#000000',
        background: '#ffffff',
        margin: 0,
        height: size === 'a4_4x8' || size.startsWith('thermal') ? 32 : 44,
        width: size === 'a4_4x8' ? 1.2 : 1.45,
        valid: () => {},
      })
    } catch {
      // Fallback if value cannot be encoded in Code128
    }
  }, [barcodeValue, fields.barcode, size])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Print barcode labels"
      size="lg"
    >
      {product && (
        <div className="space-y-4 text-[var(--ink)]">

          {/* Product info strip */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[var(--ink)]">
                {product.name}
              </p>

              <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">
                SKU: {product.sku || '—'}
                {product.barcode
                  ? ` · ${product.barcode}`
                  : ''}
              </p>
            </div>

            <span className="shrink-0 font-mono text-sm font-extrabold text-[#1E3A5F] dark:text-slate-100">
              {formattedPrice}
            </span>
          </div>

          {retailCheckDigitValid === false && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              This number fails the UPC/EAN check digit. It
              will print as Code 128; confirm the product
              barcode before printing a batch.
            </p>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">

            {/* Left controls */}
            <div className="space-y-4 lg:col-span-7">

              {/* Label size */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Label Size
                </p>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {LABEL_SIZES.map((s) => {
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
                          type="radio"
                          name="labelSize"
                          value={s.id}
                          checked={active}
                          onChange={() => {
                            setSize(s.id)

                            if (s.perSheet) {
                              setCopies(s.perSheet)
                            }
                          }}
                          className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-[#1E3A5F]"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs font-bold ${
                                active
                                  ? 'text-[#1E3A5F] dark:text-slate-200'
                                  : 'text-[var(--ink)]'
                              }`}
                            >
                              {s.title}
                            </span>

                            {s.perSheet && (
                              <span className="shrink-0 rounded-full border border-[var(--line)] bg-[var(--surface-elevated)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--muted)]">
                                {s.perSheet}/pg
                              </span>
                            )}
                          </div>

                          <p className="mt-0.5 text-[10px] text-[var(--muted-light)]">
                            {s.sub}
                          </p>
                        </div>
                      </label>
                    )
                  })}
                </div>

                {size === 'custom' && (
                  <div className="mt-2 grid grid-cols-2 gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3">
                    {[
                      [
                        'Columns (1–8)',
                        customCols,
                        (v) =>
                          setCustomCols(
                            Math.max(
                              1,
                              Math.min(8, v)
                            )
                          ),
                        1,
                        8,
                      ],
                      [
                        'Rows (1–15)',
                        customRows,
                        (v) =>
                          setCustomRows(
                            Math.max(
                              1,
                              Math.min(15, v)
                            )
                          ),
                        1,
                        15,
                      ],
                    ].map(
                      ([
                        lbl,
                        val,
                        set,
                        mn,
                        mx,
                      ]) => (
                        <div key={lbl}>
                          <p className="mb-1 text-[11px] font-semibold text-[var(--muted)]">
                            {lbl}
                          </p>

                          <input
                            type="number"
                            min={mn}
                            max={mx}
                            value={val}
                            onChange={(e) =>
                              set(
                                Number(
                                  e.target.value
                                ) || mn
                              )
                            }
                            className="input h-9 w-full text-center font-mono text-xs font-bold"
                          />
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Fields to print */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  Print Fields
                </p>

                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {FIELD_LIST.map(({ key, label }) => {
                    const on = fields[key]

                    return (
                      <label
                        key={key}
                        className={`flex cursor-pointer select-none items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
                          on
                            ? 'border-[#1E3A5F]/30 bg-[#1E3A5F]/5 dark:border-[#1E3A5F]/40 dark:bg-[#1E3A5F]/10'
                            : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-elevated)]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            toggleField(key)
                          }
                          className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded accent-[#1E3A5F]"
                        />

                        <span className="text-[11px] font-semibold text-[var(--ink)]">
                          {label}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Copies */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    Copies
                  </p>

                  <div className="flex items-center gap-1">
                    {presets.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCopies(n)}
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-bold transition ${
                          copies === n
                            ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white'
                            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
                  <button
                    type="button"
                    onClick={() =>
                      setCopies((p) =>
                        Math.max(1, p - 1)
                      )
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
                  >
                    <Minus size={13} />
                  </button>

                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={copies}
                    onChange={(e) =>
                      setCopies(
                        Math.max(
                          1,
                          Math.min(
                            500,
                            Number(
                              e.target.value
                            ) || 1
                          )
                        )
                      )
                    }
                    className="w-full bg-transparent text-center font-mono text-sm font-bold text-[var(--ink)] focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setCopies((p) =>
                        Math.min(500, p + 1)
                      )
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Right: live label preview */}
            <div className="flex flex-col gap-3 lg:col-span-5">

              {/* Preview card */}
              <div className="flex-1 rounded-2xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4 flex flex-col justify-between">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                      Label Preview
                    </p>

                    <span className="rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-800 dark:text-neutral-200">
                      Live B&amp;W
                    </span>
                  </div>

                  {/* Print instruction notice */}
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 px-3 py-2 text-[11px] text-neutral-800 dark:text-neutral-200">
                    <Printer size={13} className="shrink-0 text-neutral-600 dark:text-neutral-400" />
                    <span>
                      Print instruction: <strong>Print at 100% / Actual Size. Disable &quot;Fit to Page&quot;.</strong>
                    </span>
                  </div>

                  {/* Neutral canvas backdrop simulating pre-cut label */}
                  <div className="flex items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-950/80 p-4 min-h-[220px]">
                    {/* Simulated Label - Pure B&W, NO border, NO rounded container, NO shadow */}
                    <div
                      className="bg-white text-black text-center select-none"
                      style={{
                        width: size === 'a4_4x8' ? '200px' : '240px',
                        padding: size === 'a4_4x8' ? '12px 10px' : '16px 14px',
                      }}
                    >
                      {/* Store Name */}
                      {fields.storeName && (
                        <p className="truncate text-[9.5px] font-bold uppercase tracking-wider text-black">
                          {shopName || 'STORE NAME'}
                        </p>
                      )}

                      {/* Product Name */}
                      {fields.productName && (
                        <p className="mt-1 text-[12px] font-bold leading-tight text-black line-clamp-2">
                          {product.name}
                        </p>
                      )}

                      {/* Unit */}
                      {fields.unit && product.unit && (
                        <p className="mt-0.5 text-[9.5px] text-black">
                          {product.unit}
                        </p>
                      )}

                      {/* Machine-readable Code 128 Barcode */}
                      {fields.barcode && (
                        <div className="my-1.5 flex justify-center overflow-hidden">
                          <svg ref={svgRef} className="max-w-full h-auto block" />
                        </div>
                      )}

                      {/* Barcode Number */}
                      {fields.barcodeNumber && (
                        <p className="font-mono text-[9.5px] tracking-widest text-black">
                          {barcodeValue}
                        </p>
                      )}

                      {/* Selling Price - Prominent, Bold, Largest */}
                      {fields.sellingPrice && (
                        <p className="mt-1.5 text-[20px] font-extrabold tracking-tight leading-none text-black">
                          {formattedPrice}
                        </p>
                      )}

                      {/* MRP & SKU Footer */}
                      {(fields.mrp || fields.sku) && (
                        <div className="mt-1 flex items-center justify-center flex-wrap gap-x-3 gap-y-0.5 text-[9.5px] text-black leading-tight">
                          {fields.mrp && hasMrp && (
                            <span
                              className={`relative inline-block ${
                                strikeThroughMrp ? 'line-through decoration-black decoration-[1.5px]' : ''
                              }`}
                            >
                              {formattedMrp}
                            </span>
                          )}

                          {fields.sku && product.sku && (
                            <span>SKU: {product.sku}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Print summary */}
              <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-center">
                <p className="text-[11px] text-[var(--muted)]">
                  Ready to print
                </p>

                <p className="mt-0.5 font-mono text-xl font-extrabold text-[#1E3A5F] dark:text-slate-100">
                  {copies}{' '}
                  <span className="text-sm font-bold">
                    {copies === 1
                      ? 'label'
                      : 'labels'}
                  </span>
                </p>

                {sel.perSheet && (
                  <p className="mt-0.5 text-[10px] text-[var(--muted-light)]">
                    ≈ {sheets} sheet
                    {sheets !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleDownload}
              className="btn-secondary btn-base flex min-h-11 items-center justify-center gap-2 text-xs font-semibold sm:w-auto"
            >
              <Download size={14} />
              Download PDF
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="btn-primary btn-base flex min-h-11 items-center justify-center gap-2 text-xs font-semibold sm:w-auto"
            >
              <Printer size={14} />
              Print Labels
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}