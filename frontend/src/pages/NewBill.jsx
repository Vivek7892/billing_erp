import WhatsAppShareModal from '../components/WhatsAppShareModal'
/*
 * NewBill.jsx
 * Desktop-first POS billing screen: three-column workspace + payment dock.
 *
 *   Header  →  New Bill · date / cashier · Drafts · Shortcuts · Fullscreen
 *   Desktop →  [ Products & search 45% | Current bill 30% | Bill summary 25% ]
 *              [ Payment dock: methods · method fields · actions ]
 *   Tablet  →  [ Products | Current bill + summary stacked ] + sticky payment dock
 *   Mobile  →  single column: search/categories → products → bill → summary →
 *              payment, plus a fixed "total + Complete Sale" bar.
 *
 * Preserved (unchanged): API/service calls, invoice payload, GST / discount /
 * round-off calculations, draft storage contract (localStorage "pos_drafts",
 * sessionStorage "pos_resume_draft"), Razorpay order/verify/success flow,
 * QR payment, invoice print / PDF / thermal / share helpers, keyboard
 * shortcuts, validation summary, stock checks, duplicate-submit guard.
 *
 * All CSS is namespaced with the "pb-" prefix so nothing leaks into the app.
 * It reads the app's existing CSS variables (--surface, --ink, --line, ...)
 * with plain fallbacks, so light/dark themes keep working.
 *
 * Layout tip: on desktop the page is exactly one viewport tall. If your app
 * shell adds its own top bar, set --pb-shell-offset (e.g. 56px) on a parent.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import api, { API_BASE_URL } from '../api'
import invoiceService from '../features/billing/api/invoiceService'
import { getAccessToken } from '../services/tokenStorage'
import productService from '../features/inventory/api/productService'
import customerService from '../features/customers/api/customerService'
import settingsService from '../features/settings/api/settingsService'
import toast from 'react-hot-toast'
import logoImg from '../assets/logo.png'
import {
  UpiBrandStrip,
  generatePrintStandHtml,
  getUpiBrandRibbonSvg,
  loadUpiBrandLogos,
  drawTabletopStandeeCanvas,
} from '../components/UpiLogos'
import './NewBill.css'
import {
  IconPlus,
  IconMinus,
  IconTrash,
  IconPrinter,
  IconDownload,
  IconRefresh,
  IconQrcode,
  IconClock,
  IconKeyboard,
  IconCircleCheck,
  IconShare,
  IconX,
  IconAlertTriangle,
  IconFileText,
  IconMaximize,
  IconMinimize,
  IconLayersLinked,
  IconReceipt,
  IconPackage,
  IconCash,
  IconDeviceMobile,
  IconCreditCard,
  IconBook2,
  IconWallet,
  IconUser,
  IconUserPlus,
  IconUserCircle,
  IconShoppingCart,
  IconDotsVertical,
  IconArrowLeft,
  IconArrowRight,
  IconCopy,
  IconCheck,
  IconSparkles,
  IconBrandWhatsapp,
  IconMail,
  IconCalculator,
} from '@tabler/icons-react'
import { Modal, ConfirmDialog, SearchBar } from '../components/UI'
import { useNavigate } from 'react-router-dom'
import RazorpayPaymentModal from '../features/billing/RazorpayPaymentModal'
import { PAYMENT_METHODS, PAYMENT_STATUS } from '../constants'
import { BillingWorkflowVisual, PaymentCompletedVisual } from '../components/visuals'

// ---------------------------------------------------------------------------
// Configuration switches (UI-level validation only)
// ---------------------------------------------------------------------------
const ENFORCE_STOCK = true            // block quantities above available stock
const CREDIT_REQUIRES_CUSTOMER = true // credit sale needs a named customer
const LOW_STOCK_THRESHOLD = 5         // display only: product cards turn orange at or below this

// ---------------------------------------------------------------------------
// Local drafts (parked bills) — unchanged storage contract
// ---------------------------------------------------------------------------
const DRAFT_KEY = 'pos_drafts'
const ACTIVE_BILL_KEY = 'pos_active_bill'
function loadDrafts() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]') } catch { return [] } }
function saveDraftsStore(drafts) { localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)) }
function loadActiveBill() {
  try {
    const value = JSON.parse(sessionStorage.getItem(ACTIVE_BILL_KEY) || 'null')
    return value && typeof value === 'object' ? value : {}
  } catch {
    return {}
  }
}

const fmt = value => `₹${Number(value || 0).toFixed(2)}`
const fmtSigned = value => {
  const n = Number(value || 0)
  if (Math.abs(n) < 0.005) return fmt(0)
  return `${n < 0 ? '-' : '+'}₹${Math.abs(n).toFixed(2)}`
}
const upiUri = (upiId, name, amount, invoice = 'NEW-BILL') => {
  const params = new URLSearchParams()
  if (upiId) params.set('pa', upiId)
  if (name) params.set('pn', name)
  const num = Number(amount || 0)
  if (num > 0) {
    params.set('am', num.toFixed(2))
  }
  params.set('cu', 'INR')
  if (invoice) params.set('tn', invoice)
  return `upi://pay?${params.toString()}`
}

// Best-effort cashier name. Wire this to your auth context if you have one.
function getCashierName() {
  for (const key of ['user', 'auth_user', 'current_user']) {
    try {
      const u = JSON.parse(localStorage.getItem(key) || 'null')
      if (u) {
        const name = u.full_name || u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || u.email
        if (name) return name
      }
    } catch { /* ignore */ }
  }
  return 'Cashier'
}

// Stock that must be respected for a product (Infinity = not enforced / unknown).
const enforcedStock = product => {
  if (!ENFORCE_STOCK || !product || product.track_stock === false || product.is_service) return Infinity
  const s = product.current_stock
  if (s === undefined || s === null || s === '') return Infinity
  const n = Number(s)
  return Number.isFinite(n) ? n : Infinity
}

// Touch devices: don't re-focus the search box after adding an item, or the
// on-screen keyboard pops up on every product tap.
const canAutoFocus = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: fine)').matches)

const PAYMENT_METHOD_OPTIONS = [
  { id: PAYMENT_METHODS.CASH, label: 'Cash', icon: IconCash },
  { id: PAYMENT_METHODS.UPI, label: 'UPI', icon: IconDeviceMobile },
  { id: PAYMENT_METHODS.CARD, label: 'Card', icon: IconCreditCard },
  { id: PAYMENT_METHODS.CREDIT, label: 'Credit', icon: IconBook2 },
  { id: PAYMENT_METHODS.RAZORPAY, label: 'Razorpay', icon: IconWallet },
]
const CASH_CHIPS = [50, 100, 200, 500, 1000, 2000]
const QR_PRESETS = [100, 200, 500, 1000, 2000]
const INITIAL_PAYMENT = { method: PAYMENT_METHODS.CASH, amount: '', reference: '', status: PAYMENT_STATUS.PAID, autoAmount: true }

// Amount actually received for an invoice, without overstating pending Razorpay.
const lastPaidAmount = inv => {
  if (!inv) return 0
  if (inv.payment_method === 'razorpay' && inv.payment_status !== 'paid') return 0
  if (inv.payment_method === 'credit') return Number(inv.paid_amount ?? 0)
  return Number(inv.amount_received ?? inv.paid_amount ?? 0)
}

function SimpleCalculator({ open, onClose }) {
  const [display, setDisplay] = useState('0')
  const [storedValue, setStoredValue] = useState(null)
  const [operator, setOperator] = useState(null)
  const [startNewValue, setStartNewValue] = useState(false)
  const [memory, setMemory] = useState(0)

  const clear = () => {
    setDisplay('0')
    setStoredValue(null)
    setOperator(null)
    setStartNewValue(false)
  }

  const enterDigit = digit => {
    setDisplay(current => startNewValue || current === '0' || current === 'Error' ? digit : `${current}${digit}`)
    setStartNewValue(false)
  }

  const calculate = (left, right, op) => {
    if (op === '+') return left + right
    if (op === '−') return left - right
    if (op === '×') return left * right
    if (op === '÷') return right === 0 ? null : left / right
    return right
  }

  const chooseOperator = nextOperator => {
    const currentValue = Number(display)
    if (!Number.isFinite(currentValue)) return
    if (storedValue !== null && operator && !startNewValue) {
      const result = calculate(storedValue, currentValue, operator)
      if (result === null || !Number.isFinite(result)) {
        setDisplay('Error')
        setStoredValue(null)
        setOperator(null)
        setStartNewValue(true)
        return
      }
      setStoredValue(result)
      setDisplay(String(Number(result.toPrecision(10))))
    } else {
      setStoredValue(currentValue)
    }
    setOperator(nextOperator)
    setStartNewValue(true)
  }

  const equals = () => {
    if (storedValue === null || !operator) return
    const result = calculate(storedValue, Number(display), operator)
    setDisplay(result === null || !Number.isFinite(result) ? 'Error' : String(Number(result.toPrecision(10))))
    setStoredValue(null)
    setOperator(null)
    setStartNewValue(true)
  }

  const backspace = () => {
    if (startNewValue || display === 'Error' || display.length <= 1) {
      setDisplay('0')
      setStartNewValue(false)
    } else setDisplay(value => value.slice(0, -1))
  }
  const appendDecimal = () => {
    if (startNewValue || display === 'Error') {
      setDisplay('0.')
      setStartNewValue(false)
    } else if (!display.includes('.')) setDisplay(value => `${value}.`)
  }
  const handleKeyDown = useCallback(event => {
    if (event.altKey || event.ctrlKey || event.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable) return
    const key = event.key
    let handled = true
    if (/^\d$/.test(key)) enterDigit(key)
    else if (key === '.') appendDecimal()
    else if (key === '+') chooseOperator('+')
    else if (key === '-') chooseOperator('âˆ’')
    else if (key === '*') chooseOperator('Ã—')
    else if (key === '/') chooseOperator('Ã·')
    else if (key === '%') setDisplay(value => value === 'Error' ? '0' : String(Number(value) / 100))
    else if (key === 'Enter' || key === '=') equals()
    else if (key === 'Backspace') backspace()
    else if (key === 'Delete') clear()
    else handled = false
    if (handled) event.preventDefault()
  }, [display, startNewValue, storedValue, operator])

  useEffect(() => {
    if (!open) return undefined
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  const keys = [
    { label: 'MC', action: () => setMemory(0), utility: true, name: 'Clear memory' },
    { label: 'MR', action: () => { setDisplay(String(Number(memory.toPrecision(10)))); setStartNewValue(true) }, utility: true, name: 'Recall memory' },
    { label: 'M+', action: () => { if (display !== 'Error') setMemory(value => value + Number(display)) }, utility: true, name: 'Add to memory' },
    { label: 'M−', action: () => { if (display !== 'Error') setMemory(value => value - Number(display)) }, utility: true, name: 'Subtract from memory' },
    { label: 'AC', action: clear, utility: true },
    { label: '⌫', action: backspace, utility: true, name: 'Backspace' },
    { label: '±', action: () => setDisplay(value => value === 'Error' ? '0' : String(Number(value) * -1)), utility: true },
    { label: '%', action: () => setDisplay(value => value === 'Error' ? '0' : String(Number(value) / 100)), utility: true },
    { label: '÷', action: () => chooseOperator('÷'), operator: true },
    ...['7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+'].map(label => ({
      label,
      action: ['×', '−', '+'].includes(label) ? () => chooseOperator(label) : () => enterDigit(label),
      operator: ['×', '−', '+'].includes(label),
    })),
    { label: '0', action: () => enterDigit('0'), wide: true },
    { label: '.', action: appendDecimal, name: 'Decimal point' },
    { label: '=', action: equals, equals: true },
  ]

  return (
    <Modal open={open} onClose={onClose} title="Calculator" subtitle="Quick calculations" size="sm" contentClassName="!p-4 sm:!p-5">
      <div className="mx-auto max-w-[320px]">
        <div className="mb-2 flex min-h-16 items-end justify-end overflow-hidden rounded-xl bg-slate-900 px-4 py-3 text-right font-mono text-3xl font-semibold tracking-tight text-white" aria-label="Calculator display" aria-live="polite">
          <span className="max-w-full break-all">{display}</span>
        </div>
        <div className="mb-3 flex min-h-4 items-center justify-between px-1 text-xs text-slate-500" aria-live="polite">
          <span>{memory !== 0 ? `M · ${Number(memory.toPrecision(8))}` : ' '}</span>
          <span>Keyboard: 0–9 · + − × ÷ · Enter · Backspace</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {keys.map(key => (
            <button
              key={key.label}
              type="button"
              onClick={key.action}
              aria-label={key.name || key.label}
              className={`min-h-12 rounded-xl text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                key.equals
                  ? 'bg-sky-700 text-white hover:bg-sky-800'
                  : key.operator
                    ? `${operator === key.label ? 'bg-sky-100 text-sky-900' : 'bg-sky-50 text-sky-800'} hover:bg-sky-100`
                    : key.utility
                      ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                      : 'bg-[var(--surface-elevated)] text-[var(--ink)] hover:bg-[var(--surface-hover)]'
              } ${key.wide ? 'col-span-2' : ''}`}
            >
              {key.label}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Numeric text input that lets the user clear / retype without side effects
// ---------------------------------------------------------------------------
function BufferedNumber({ value, onCommit, max, allowZero = false, onClamp, className, ...rest }) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => { if (!focused) setText(String(value)) }, [value, focused])

  const handleChange = e => {
    const raw = e.target.value
    if (!/^\d*\.?\d*$/.test(raw)) return
    if (raw === '' || raw === '.') {
      setText(raw)
      if (allowZero) onCommit(0)
      return
    }
    let n = parseFloat(raw)
    if (max !== undefined && n > max) {
      n = max
      setText(String(max))
      onClamp?.(max)
    } else {
      setText(raw)
    }
    if (n > 0 || allowZero) onCommit(n)
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={className}
      value={text}
      onFocus={e => { setFocused(true); e.target.select() }}
      onBlur={() => setFocused(false)}
      onChange={handleChange}
      {...rest}
    />
  )
}

// ---------------------------------------------------------------------------
// Cart line (same props as before; now a compact list item instead of a table row)
// Cart line (table row in current bill table)
// ---------------------------------------------------------------------------
function CartRow({ item, index, stock, showGst, justAdded, onQty, onDiscount, onBatch, onRemove }) {
  const gross = item.unit_price * item.qty
  const discountAmount = gross * item.discount_percent / 100
  const basic = gross - discountAmount
  const overStock = Number.isFinite(stock) && item.qty > stock
  return (
    <tr className={`pb-bill-tr${overStock ? ' pb-tr-warn' : ''}${justAdded ? ' pb-tr-added' : ''}`}>
      <td className="pb-td-bitem">
        <div className="pb-item-name">
          <span className="pb-item-index">{index}. </span>
          <span className="pb-item-title" title={item.product_name}>{item.product_name}</span>
          {item.sku && <span className="pb-item-code-inline" title={`SKU: ${item.sku}`}>{item.sku}</span>}
        </div>
        {item.batches?.length > 0 && <select aria-label={`Batch for ${item.product_name}`} className="mt-1 max-w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-[11px]" value={item.batch_id || ''} onChange={e => onBatch(item.id, e.target.value)}>
          <option value="">Select batch</option>
          {item.batches.filter(batch => batch.active && Number(batch.quantity) > 0).map(batch => <option key={batch.id} value={batch.id}>{batch.batch_number} · {batch.quantity} available{batch.expiry_date ? ` · exp ${batch.expiry_date}` : ''}</option>)}
        </select>}
        {overStock && <div className="pb-item-sub pb-text-red">Available stock: {stock}</div>}
        <div className="pb-mobile-only pb-item-mobile-rate">
          @ {fmt(item.unit_price)}
          {item.discount_percent > 0 && <span className="pb-text-red"> ({item.discount_percent}% off)</span>}
        </div>
      </td>
      <td className="pb-td-qty">
        <div className="pb-qty-group">
          <button
            type="button"
            className="pb-qty-btn"
            aria-label={`Decrease ${item.product_name} quantity`}
            onClick={() => onQty(item.id, item.qty - 1)}
          >
            <IconMinus size={11} />
          </button>
          <BufferedNumber
            aria-label={`${item.product_name} quantity`}
            className="pb-qty-input"
            value={item.qty}
            max={Number.isFinite(stock) ? stock : undefined}
            onClamp={m => toast.error(`Only ${m} in stock`)}
            onCommit={n => onQty(item.id, n)}
          />
          <button
            type="button"
            className="pb-qty-btn"
            aria-label={`Increase ${item.product_name} quantity`}
            onClick={() => onQty(item.id, item.qty + 1)}
          >
            <IconPlus size={11} />
          </button>
        </div>
        {item.unit ? <span className="pb-item-unit">{item.unit}</span> : null}
      </td>
      <td className="pb-td-rate">
        <div className="pb-price-val pb-num-rate">{fmt(item.unit_price)}</div>
        {item.mrp && Number(item.mrp) > item.unit_price ? (
          <div className="pb-mrp-val pb-num-mrp">{fmt(item.mrp)}</div>
        ) : null}
      </td>
      <td className="pb-td-disc">
        <div className="pb-disc-box">
          <BufferedNumber
            aria-label={`${item.product_name} discount percent`}
            className="pb-disc-input"
            allowZero
            max={100}
            value={item.discount_percent}
            onCommit={n => onDiscount(item.id, n)}
          />
          <span className="pb-disc-unit">%</span>
        </div>
        {discountAmount > 0 && (
          <div className="pb-disc-val pb-num-disc">-{fmt(discountAmount)}</div>
        )}
      </td>
      <td className="pb-td-total">
        <div className="pb-price-val pb-num-total">{fmt(item.total)}</div>
        {showGst && item.gst_percent > 0 && (
          <div className="pb-gst-val pb-num-gst">GST {item.gst_percent}%</div>
        )}
      </td>
      <td className="pb-td-act">
        <button
          type="button"
          className="pb-icon-danger"
          aria-label={`Remove ${item.product_name}`}
          title="Remove item"
          onClick={() => onRemove(item.id)}
        >
          <IconTrash size={13} />
        </button>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// QR payment modal (Quick Pay) — Mobile-Optimized, Center Logo & Seamless Flow
// ---------------------------------------------------------------------------
function QrPaymentModal({ open, onClose, upiId, shopName, invoice, billTotal, hasCart, onPaid, onCompleteSale, logoSrc }) {
  const qrRef = useRef(null)
  const [amount, setAmount] = useState('')
  const [isEditingAmount, setIsEditingAmount] = useState(false)
  const [copied, setCopied] = useState(false)
  const [logoDataUrl, setLogoDataUrl] = useState('')
  const [downloading, setDownloading] = useState(false)

  // Convert logo to offline base64 data URL for embedded QR and standalone print/download
  useEffect(() => {
    const targetLogo = logoSrc || '/logo.png'
    if (!targetLogo) return

    if (targetLogo.startsWith('data:')) {
      setLogoDataUrl(targetLogo)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || 80
        canvas.height = img.naturalHeight || 80
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        const data = canvas.toDataURL('image/png')
        setLogoDataUrl(data)
      } catch {
        setLogoDataUrl(targetLogo)
      }
    }
    img.onerror = () => {
      setLogoDataUrl(targetLogo)
    }
    img.src = targetLogo
  }, [logoSrc])

  // Reset amount and editing toggle when modal opens
  useEffect(() => {
    if (open) {
      setAmount(billTotal > 0 ? billTotal.toFixed(2) : '')
      setIsEditingAmount(!hasCart || billTotal <= 0)
      setCopied(false)
      setDownloading(false)
    }
  }, [open, billTotal, hasCart])

  const numericAmount = Number(amount) || 0
  const uri = upiUri(upiId, shopName, numericAmount, invoice)
  const differsFromBill = hasCart && billTotal > 0 && Math.abs(numericAmount - billTotal) > 0.004
  const canAct = !!upiId
  const canComplete = !!upiId && numericAmount > 0

  const applyPreset = v => setAmount(v.toFixed(2))
  const applyBillTotal = () => {
    setAmount(billTotal.toFixed(2))
    setIsEditingAmount(false)
  }

  const copyUpiId = async () => {
    if (!upiId) return
    let done = false
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(upiId)
        done = true
      }
    } catch {
      // Fallback
    }
    if (!done) {
      try {
        const el = document.createElement('textarea')
        el.value = upiId
        el.style.position = 'fixed'
        el.style.left = '-9999px'
        document.body.appendChild(el)
        el.select()
        done = document.execCommand('copy')
        document.body.removeChild(el)
      } catch {
        // ignore
      }
    }
    if (done) {
      setCopied(true)
      toast.success('UPI ID copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } else {
      toast.error('Could not copy UPI ID')
    }
  }

  // High-Resolution Scannable Standee PNG Downloader matching tabletop standee design
  const downloadPng = async () => {
    if (!upiId) {
      toast.error('Configure shop UPI ID in Settings first')
      return
    }

    const svg = qrRef.current?.querySelector('svg')
    if (!svg) {
      toast.error('QR code not available')
      return
    }

    setDownloading(true)
    try {
      // 1. Clone SVG with crisp 500x500 dimensions
      const svgClone = svg.cloneNode(true)
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
      svgClone.setAttribute('width', '500')
      svgClone.setAttribute('height', '500')

      const svgData = new XMLSerializer().serializeToString(svgClone)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)

      const qrImg = new Image()
      qrImg.crossOrigin = 'anonymous'

      await new Promise((resolve, reject) => {
        qrImg.onload = resolve
        qrImg.onerror = reject
        qrImg.src = svgUrl
      })

      // 2. Load official brand logos (Google Pay, PhonePe, Paytm, UPI)
      const brandLogos = await loadUpiBrandLogos()

      // 3. Optional store logo image
      let storeLogoImg = null
      if (logoDataUrl) {
        storeLogoImg = new Image()
        storeLogoImg.crossOrigin = 'anonymous'
        await new Promise((resolve) => {
          storeLogoImg.onload = resolve
          storeLogoImg.onerror = resolve
          storeLogoImg.src = logoDataUrl
        })
      }

      // 4. Draw exact rendered preview onto canvas (preserving dimensions, colors, logo, and layout)
      const canvas = document.createElement('canvas')
      drawTabletopStandeeCanvas({
        canvas,
        merchantName: shopName || 'ShopEase POS',
        upiId,
        isFixed: numericAmount > 0,
        numAmt: numericAmount,
        qrImg,
        brandLogos,
        storeLogoImg,
        footerText: 'Accepted Here: GPay • PhonePe • Paytm • UPI',
      })

      brandLogos.cleanup()
      URL.revokeObjectURL(svgUrl)

      // Format descriptive filename based on amount: e.g. UPI-QR-276.png or UPI-QR-Any-Amount.png
      const amountTag = Number.isInteger(numericAmount) ? String(numericAmount) : numericAmount.toFixed(2)
      const filename = numericAmount > 0 ? `UPI-QR-${amountTag}.png` : 'UPI-QR.png'

      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Could not generate PNG image')
          setDownloading(false)
          return
        }
        const pngUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(pngUrl), 1000)
        setDownloading(false)
        toast.success(`Downloaded ${filename}`)
      }, 'image/png')
    } catch (err) {
      console.error('Download QR PNG error:', err)
      setDownloading(false)
      toast.error('Could not download QR code as PNG')
    }
  }

  const print = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg || !canAct) {
      toast.error('Generate a QR before printing')
      return
    }

    const svgClone = svg.cloneNode(true)
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    svgClone.setAttribute('width', '240')
    svgClone.setAttribute('height', '240')
    svgClone.setAttribute('viewBox', svg.getAttribute('viewBox') || '0 0 240 240')
    const svgMarkup = new XMLSerializer().serializeToString(svgClone)

    const win = window.open('', '_blank', 'width=480,height=760')
    if (!win) {
      toast.error('Allow pop-ups to print the QR')
      return
    }

    const standHtml = generatePrintStandHtml({
      shopName,
      upiId,
      amount: numericAmount,
      logoDataUrl,
      svgMarkup,
    })

    win.document.open()
    win.document.write(standHtml)
    win.document.close()

    const triggerPrint = () => {
      try {
        win.focus()
        win.print()
      } catch {
        toast.error('Could not open the print dialog')
      }
    }

    if (win.document.readyState === 'complete') {
      setTimeout(triggerPrint, 500)
    } else {
      win.addEventListener('load', () => setTimeout(triggerPrint, 300), { once: true })
      setTimeout(triggerPrint, 900)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Collect payment by QR" size="md">
      <div className="pb-modal pb-stack pb-qr-modal-content">
        <p className="pb-qr-intro">Show this code to your customer to pay using any supported UPI app.</p>
        {/* Top Header Card */}
        <div className="pb-qr-header-card">
          <div className="pb-qr-shop-title">
            {logoDataUrl ? (
              <img src={logoDataUrl} alt={shopName} className="pb-qr-shop-logo" />
            ) : (
              <IconDeviceMobile size={16} className="text-blue-600 shrink-0" />
            )}
            <span className="truncate">{shopName}</span>
            <span className="pb-qr-verified-tag" title="Merchant UPI QR">
              <IconCircleCheck size={12} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <span>UPI enabled</span>
            </span>
          </div>

          <div className="pb-qr-amount-hero">
            <span className="pb-qr-amount-label">
              {numericAmount > 0 ? 'Amount to Collect' : 'Open Amount (Customer Enters Any Amount)'}
            </span>
            <div className="pb-qr-amount-display">
              {numericAmount > 0 ? (
                <>
                  <span className="pb-qr-curr">₹</span>
                  <span className="pb-qr-figure">
                    {numericAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </>
              ) : (
                <span className="pb-qr-figure text-lg">Any Amount (Open QR)</span>
              )}
            </div>
          </div>

          <div className="pb-qr-meta-sub">
            {differsFromBill ? (
              <span className="pb-text-amber flex items-center gap-1 font-semibold text-xs">
                <IconAlertTriangle size={13} className="shrink-0" /> Bill total is {fmt(billTotal)}
              </span>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-400">Scan with any UPI app</span>
            )}
            {hasCart && billTotal > 0 && (
              <button
                type="button"
                className="pb-qr-edit-amt-btn"
                onClick={() => setIsEditingAmount(v => !v)}
              >
                {isEditingAmount ? 'Done Editing' : 'Change Amount'}
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Amount Editor (Only when requested or no cart) */}
        {isEditingAmount && (
          <div className="pb-qr-edit-section">
            <label className="pb-label" htmlFor="pb-qr-amount">Custom Amount (₹)</label>
            <input
              id="pb-qr-amount"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              className="pb-input pb-input-lg"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
            />
            <div className="pb-chips">
              {hasCart && billTotal > 0 && (
                <button
                  type="button"
                  onClick={applyBillTotal}
                  className={`pb-chip pb-chip-exact${Math.abs(numericAmount - billTotal) < 0.005 ? ' pb-chip-active' : ''}`}
                >
                  Bill Total {fmt(billTotal)}
                </button>
              )}
              <button
                type="button"
                onClick={() => setAmount('0')}
                className={`pb-chip pb-chip-open${numericAmount === 0 ? ' pb-chip-active' : ''}`}
              >
                Fixed / Any Amount QR
              </button>
              {QR_PRESETS.map(v => (
                <button
                  type="button"
                  key={v}
                  onClick={() => applyPreset(v)}
                  className={`pb-chip${Math.abs(numericAmount - v) < 0.005 ? ' pb-chip-active' : ''}`}
                >
                  ₹{v.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* The QR Code Card with Corner Brackets & Center Logo */}
        <section className="pb-quick-qr-preview" aria-label="UPI payment QR">
          <div className="pb-qr-box-wrapper">
            <div ref={qrRef} className="pb-qr-box">
              <div className="pb-qr-corner pb-qr-corner-tl" aria-hidden="true" />
              <div className="pb-qr-corner pb-qr-corner-tr" aria-hidden="true" />
              <div className="pb-qr-corner pb-qr-corner-bl" aria-hidden="true" />
              <div className="pb-qr-corner pb-qr-corner-br" aria-hidden="true" />
              {upiId ? (
                <QRCodeSVG
                  value={uri}
                  size={200}
                  level="H"
                  includeMargin
                  bgColor="#ffffff"
                  fgColor="#0F172A"
                  imageSettings={
                    logoDataUrl
                      ? {
                          src: logoDataUrl,
                          height: 38,
                          width: 38,
                          excavate: true,
                        }
                      : undefined
                  }
                  className="w-full h-auto max-w-[200px]"
                />
              ) : (
                <div className="pb-qr-empty">Configure shop UPI ID in Settings</div>
              )}
            </div>
          </div>

          <UpiBrandStrip height={20} className="mt-3" />
        </section>

        {/* UPI ID Bar with 1-Tap Copy & Visual Feedback */}
        <div className="pb-qr-id-bar">
          <div className="pb-qr-id-text">
            <span className="pb-qr-id-label">UPI ID:</span>
            <span className="pb-qr-id-val" title={upiId}>{upiId || 'UPI ID not configured'}</span>
          </div>
          {upiId && (
            <button
              type="button"
              className={`pb-qr-copy-chip${copied ? ' pb-qr-copied' : ''}`}
              onClick={copyUpiId}
              title="Copy UPI ID to clipboard"
            >
              {copied ? (
                <>
                  <IconCheck size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <IconCopy size={13} />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>

        <div className="pb-qr-guidance" role="note">
          <IconDeviceMobile size={16} />
          <p>Confirm the payment in your UPI app or bank account before marking this bill paid. The QR code does not confirm payment automatically.</p>
        </div>

        {/* Action Buttons for Proper Flow */}
        <div className="pb-qr-action-stack">
          {hasCart && billTotal > 0 && onCompleteSale ? (
            <>
              <button
                type="button"
                onClick={() => onCompleteSale(numericAmount, false)}
                disabled={!canComplete}
                className="pb-btn-qr-complete"
              >
                <IconCircleCheck size={18} />
                <span>Payment Received — Complete Sale</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onCompleteSale(numericAmount, true)}
                  disabled={!canComplete}
                  className="pb-btn pb-btn-sm"
                >
                  <IconPrinter size={14} />
                  <span>Complete &amp; Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPaid(numericAmount)}
                  disabled={!canComplete}
                  className="pb-btn pb-btn-sm"
                >
                  <IconCircleCheck size={14} />
                  <span>Mark Paid Only</span>
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onPaid(numericAmount)}
              disabled={!canComplete}
              className="pb-btn pb-btn-primary pb-btn-lg w-full"
            >
              <IconCircleCheck size={16} /> Payment received — mark paid {numericAmount > 0 ? `(${fmt(numericAmount)})` : ''}
            </button>
          )}

          <div className="pb-grid2 pb-qr-actions">
            <button
              type="button"
              onClick={downloadPng}
              disabled={!canAct || downloading}
              className="pb-btn pb-btn-sm"
              title="Download scannable high-resolution QR as PNG image"
            >
              <IconDownload size={13} />
              <span>{downloading ? 'Downloading...' : 'Download QR'}</span>
            </button>
            <button type="button" onClick={print} disabled={!canAct} className="pb-btn pb-btn-sm">
              <IconPrinter size={13} /> Print QR Stand
            </button>
          </div>

          <button type="button" onClick={onClose} className="pb-btn pb-btn-sm w-full">
            Back to Bill
          </button>
        </div>

      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Main billing page
// ---------------------------------------------------------------------------
export default function NewBill() {
  const navigate = useNavigate()
  const [savedActiveBill] = useState(loadActiveBill)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [customers, setCustomers] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [settings, setSettings] = useState({})
  const [initializing, setInitializing] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const [cart, setCart] = useState(() => Array.isArray(savedActiveBill.cart) ? savedActiveBill.cart : [])
  const [lastAddedId, setLastAddedId] = useState(null)
  const [customer, setCustomer] = useState(() => savedActiveBill.customer || null)
  const [customerSearch, setCustomerSearch] = useState(() => savedActiveBill.customerSearch || '')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [payment, setPayment] = useState(() => savedActiveBill.payment || INITIAL_PAYMENT)
  const [billDiscountInput, setBillDiscountInput] = useState(() => savedActiveBill.billDiscountInput || '')
  const [notes, setNotes] = useState(() => savedActiveBill.notes || '')
  const [saving, setSaving] = useState(false)
  const [lastInvoice, setLastInvoice] = useState(null)
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false)
  const [whatsAppInvoice, setWhatsAppInvoice] = useState(null)
  const [drafts, setDrafts] = useState(loadDrafts)

  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showRazorpay, setShowRazorpay] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [showDrafts, setShowDrafts] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement))
  const [newCustomer, setNewCustomer] = useState({ name: '', mobile: '', email: '' })
  const [addingCustomer, setAddingCustomer] = useState(false)
  const [now, setNow] = useState(new Date())
  const [cashier] = useState(getCashierName)
  const [mobileTab, setMobileTab] = useState('catalog') // 'catalog' | 'cart'
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [mobilePaymentOpen, setMobilePaymentOpen] = useState(false)

  const searchRef = useRef()
  const customerRef = useRef()
  const paymentSectionRef = useRef()
  const billDiscountRef = useRef()
  const savingRef = useRef(false)
  const cartRef = useRef([])
  const actionsRef = useRef({})
  const mobileMoreRef = useRef(null)
  cartRef.current = cart

  useEffect(() => {
    if (!mobileMoreOpen) return
    const handleClickOutside = (e) => {
      if (mobileMoreRef.current && !mobileMoreRef.current.contains(e.target)) {
        setMobileMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [mobileMoreOpen])

  useEffect(() => {
    if (!mobilePaymentOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMobilePaymentOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobilePaymentOpen])

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const fmtDate = d => d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  const fmtTime = d => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

  const loadInitialData = useCallback(async () => {
    setInitializing(true)
    setLoadError(false)
    const results = await Promise.allSettled([
      productService.getProducts({ status: 'active', page_size: 200 }),
      productService.getCategories(),
      customerService.getCustomers({ page_size: 200 }),
      api.get('/dashboard/'),
      settingsService.getAll(),
    ])
    const [productsResult, categoriesResult, customersResult, dashboardResult, settingsResult] = results
    if (productsResult.status === 'fulfilled') {
      const pVal = productsResult.value
      const freshProducts = Array.isArray(pVal) ? pVal : (Array.isArray(pVal?.items) ? pVal.items : [])
      setProducts(freshProducts)
      setCart(current => current.map(item => {
        const product = freshProducts.find(p => String(p.id) === String(item.id))
        if (!product) return item
        const batches = Array.isArray(product.batches) ? product.batches : []
        const selectedBatch = batches.find(batch => String(batch.id) === String(item.batch_id))
          || batches.find(batch => batch.active && Number(batch.quantity) > 0)
        const unitPrice = Number(selectedBatch?.selling_rate ?? product.selling_price ?? item.unit_price)
        const gstPercent = Number(product.gst_percent ?? item.gst_percent ?? 0)
        const base = unitPrice * Number(item.qty || 0) * (1 - Number(item.discount_percent || 0) / 100)
        return {
          ...item,
          product_name: product.name || item.product_name,
          sku: product.sku || item.sku,
          barcode: product.barcode || item.barcode || '',
          unit: product.unit || item.unit || '',
          hsn_code: product.hsn_code || item.hsn_code || '',
          batches,
          batch_id: selectedBatch?.id || item.batch_id || '',
          mrp: Number(selectedBatch?.mrp ?? product.mrp ?? item.mrp ?? 0),
          unit_price: unitPrice,
          gst_percent: gstPercent,
          total: base + base * gstPercent / 100,
        }
      }))
    }
    if (categoriesResult.status === 'fulfilled') {
      const cVal = categoriesResult.value
      setCategories(Array.isArray(cVal) ? cVal : (Array.isArray(cVal?.items) ? cVal.items : []))
    }
    if (customersResult.status === 'fulfilled') {
      const custVal = customersResult.value
      setCustomers(Array.isArray(custVal) ? custVal : (Array.isArray(custVal?.items) ? custVal.items : []))
    }
    if (dashboardResult.status === 'fulfilled') setDashboard(dashboardResult.value?.data || dashboardResult.value)
    if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value || {})
    setLoadError(results.some(result => result.status === 'rejected'))
    setInitializing(false)
  }, [])

  useEffect(() => { loadInitialData() }, [loadInitialData])

  useEffect(() => {
    const hasActiveBill = cart.length > 0 || customer || customerSearch || billDiscountInput || notes
    if (!hasActiveBill) {
      sessionStorage.removeItem(ACTIVE_BILL_KEY)
      return
    }
    try {
      sessionStorage.setItem(ACTIVE_BILL_KEY, JSON.stringify({
        cart, customer, customerSearch, payment, billDiscountInput, notes,
      }))
    } catch { /* storage can be unavailable or full; keep the in-memory bill */ }
  }, [cart, customer, customerSearch, payment, billDiscountInput, notes])

  const productMap = useMemo(() => {
    const list = Array.isArray(products) ? products : []
    return new Map(list.map(p => [p.id, p]))
  }, [products])
  // Display only: quantity already in the bill, shown as a badge on product cards.
  const cartQtyMap = useMemo(() => new Map((Array.isArray(cart) ? cart : []).map(i => [i.id, i.qty])), [cart])

  const recalc = item => {
    const basic = item.unit_price * item.qty * (1 - item.discount_percent / 100)
    return { ...item, total: basic + basic * item.gst_percent / 100 }
  }

  const addRecentProduct = product => {
    try {
      const current = JSON.parse(localStorage.getItem('pos_recent_products') || '[]')
      const next = [product, ...current.filter(p => p?.id !== product?.id)].slice(0, 8)
      localStorage.setItem('pos_recent_products', JSON.stringify(next))
    } catch { /* ignore */ }
  }

  const addToCart = useCallback(product => {
    const stock = enforcedStock(product)
    const inCart = cartRef.current.find(item => item.id === product.id)?.qty || 0
    if (stock <= 0) { toast.error(`${product.name} is out of stock`); return }
    if (inCart + 1 > stock) { toast.error(`Only ${stock} of ${product.name} in stock`); return }

    setCart(prev => {
      const found = prev.find(item => item.id === product.id)
      return found
        ? prev.map(item => item.id === product.id ? recalc({ ...item, qty: item.qty + 1 }) : item)
        : [...prev, recalc({
            id: product.id, product_name: product.name, sku: product.sku,
            barcode: product.barcode || '', unit: product.unit || '',
            hsn_code: product.hsn_code || '', batches: product.batches || [],
            batch_id: product.batches?.find(batch => batch.active && Number(batch.quantity) > 0)?.id || '',
            mrp: Number(product.batches?.find(batch => batch.active && Number(batch.quantity) > 0)?.mrp ?? product.mrp ?? 0),
            unit_price: Number(product.batches?.find(batch => batch.active && Number(batch.quantity) > 0)?.selling_rate ?? product.selling_price), qty: 1, discount_percent: 0,
            gst_percent: Number(product.gst_percent || 0), total: 0,
          })]
    })
    setLastAddedId(product.id)
    addRecentProduct(product)
    toast.success(`Added ${product.name} to bill`, { duration: 1200, id: `add-${product.id}` })
    setTimeout(() => setLastAddedId(null), 800)
    setSearch('')
    setActiveIdx(-1)
    setSearchActive(false)
    if (canAutoFocus()) searchRef.current?.focus()
  }, [])

  const updateQty = useCallback((id, qty) => {
    if (qty > 0) {
      const stock = enforcedStock(productMap.get(id))
      if (qty > stock) {
        if (stock <= 0) { toast.error('Product is out of stock'); return }
        toast.error(`Only ${stock} in stock`)
        qty = stock
      }
    }
    setCart(prev => qty <= 0 ? prev.filter(item => item.id !== id) : prev.map(item => item.id === id ? recalc({ ...item, qty }) : item))
  }, [productMap])

  const updateDiscount = useCallback((id, pct) => {
    const value = Math.min(100, Math.max(0, Number(pct) || 0))
    setCart(prev => prev.map(item => item.id === id ? recalc({ ...item, discount_percent: value }) : item))
  }, [])

  const updateBatch = useCallback((id, batchId) => {
    setCart(prev => prev.map(item => {
      if (item.id !== id) return item
      const batch = item.batches?.find(row => String(row.id) === String(batchId))
      return recalc({ ...item, batch_id: batchId, mrp: Number(batch?.mrp ?? 0), unit_price: Number(batch?.selling_rate ?? item.unit_price) })
    }))
  }, [])

  const removeItem = useCallback(id => setCart(x => x.filter(i => i.id !== id)), [])

  const filtered = useMemo(() => {
    const list = Array.isArray(products) ? products : []
    const q = search.trim().toLowerCase()
    return list.filter(p => {
      const name = String(p?.name || '').toLowerCase()
      const sku = String(p?.sku || '').toLowerCase()
      const barcode = String(p?.barcode || '').toLowerCase()
      return (!q || name.includes(q) || sku.includes(q) || barcode.includes(q)) &&
        (!catFilter || String(p?.category ?? '') === catFilter)
    })
  }, [products, search, catFilter])

  const searchResults = useMemo(() => filtered.slice(0, 8), [filtered])

  const availableProducts = useMemo(() => filtered.filter(p => Number(p?.current_stock || 0) > 0), [filtered])
  const recentProducts = useMemo(() => {
    try {
      const list = Array.isArray(products) ? products : []
      const ids = JSON.parse(localStorage.getItem('pos_recent_products') || '[]').map(p => p?.id)
      return ids.map(id => list.find(p => p?.id === id)).filter(Boolean).filter(p => Number(p.current_stock || 0) > 0).slice(0, 5)
    } catch { return [] }
  }, [products, cart])
  const recommendedProducts = useMemo(() => {
    const base = search.trim() ? filtered : (catFilter ? filtered : availableProducts)
    return base.filter(p => Number(p?.current_stock || 0) > 0 && !cart.some(i => i.id === p.id)).slice(0, 6)
  }, [search, filtered, catFilter, availableProducts, cart])

  // Search is filter-only. Enter never adds a product.
  const onSearchKeyDown = e => {
    if (e.key === 'Enter') { e.preventDefault(); setSearchActive(true); setActiveIdx(-1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSearchActive(true); setActiveIdx(i => Math.min(searchResults.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(-1, i - 1)) }
    else if (e.key === 'Escape') { setSearchActive(false); setActiveIdx(-1) }
  }

  // ---- Calculations (memoized with useMemo) -------------------------------------------
  const {
    subtotal,
    discount,
    taxableBeforeBillDiscount,
    billDiscount,
    tax,
    roundOff,
    grandTotal,
    taxableAmount,
    totalQty,
  } = useMemo(() => {
    const sub = cart.reduce((sum, item) => sum + item.unit_price * item.qty, 0)
    const disc = cart.reduce((sum, item) => sum + (item.unit_price * item.qty * item.discount_percent) / 100, 0)
    const taxableBefore = Math.max(0, sub - disc)
    const billDisc = Math.min(Math.max(0, Number(billDiscountInput) || 0), taxableBefore)
    const itmTax = cart.reduce((sum, item) => sum + item.unit_price * item.qty * (1 - item.discount_percent / 100) * (item.gst_percent / 100), 0)
    const tx = taxableBefore ? itmTax * ((taxableBefore - billDisc) / taxableBefore) : 0
    const rw = taxableBefore - billDisc + tx
    const rnd = Math.round(rw) - rw
    const grand = rw + rnd
    const taxable = taxableBefore - billDisc
    const qtyCount = cart.reduce((count, item) => count + Number(item.qty || 0), 0)
    const itemsTot = cart.reduce((sum, item) => sum + (item.total || 0), 0)

    return {
      subtotal: sub,
      discount: disc,
      taxableBeforeBillDiscount: taxableBefore,
      billDiscount: billDisc,
      itemTax: itmTax,
      tax: tx,
      raw: rw,
      roundOff: rnd,
      grandTotal: grand,
      taxableAmount: taxable,
      totalQty: qtyCount,
      cartItemsTotal: itemsTot,
    }
  }, [cart, billDiscountInput])

  // Keep the payment amount in step with the bill grand total
  useEffect(() => {
    const target = grandTotal > 0 ? grandTotal.toFixed(2) : ''
    setPayment(p => {
      if (p.method !== 'credit' && (p.autoAmount || p.method !== 'cash' || !p.amount)) {
        if (p.amount !== target) {
          return { ...p, amount: target }
        }
      }
      return p
    })
  }, [grandTotal])

  const selectPayment = method => {
    const isCredit = method === 'credit'
    const target = grandTotal > 0 ? grandTotal.toFixed(2) : ''
    setPayment({
      method,
      amount: isCredit ? '' : target,
      reference: '',
      status: (method === 'cash' || method === 'upi' || method === 'card' || method === 'online') ? 'paid' : isCredit ? 'credit' : 'pending',
      autoAmount: !isCredit,
    })
  }

  // Cash: a blank "received" field means exact amount tendered.
  const cashTendered = Number(payment.amount) || grandTotal
  const cashShort = payment.method === 'cash' && cashTendered < grandTotal - 0.005
  const cashBalanceDue = payment.method === 'cash' ? Math.max(0, grandTotal - cashTendered) : 0
  const cashChange = payment.method === 'cash' ? Math.max(0, cashTendered - grandTotal) : 0

  const filteredCustomers = useMemo(() => {
    const list = Array.isArray(customers) ? customers : []
    const q = customerSearch.trim().toLowerCase()
    return list.filter(c =>
      String(c?.name || '').toLowerCase().includes(q) ||
      String(c?.mobile || '').includes(customerSearch)
    )
  }, [customers, customerSearch])

  const shopName = settings.shop_name || 'Dreamwithtech'
  const upiId = settings.shop_upi_id || ''
  const showGst = settings.gst_reg_type !== 'unregistered'

  const isPendingRazorpay = Boolean(lastInvoice && lastInvoice.payment_method === 'razorpay' && lastInvoice.payment_status !== 'paid')

  // ---- Pre-sale validation -------------------------------------------------
  const validationErrors = useMemo(() => {
    if (!cart.length) return ['Cart is empty']
    if (grandTotal <= 0) return ['Total must be greater than ₹0']
    const errs = []
    cart.forEach(item => {
      if (!Number.isFinite(item.qty) || item.qty <= 0) {
        errs.push(`Invalid quantity for ${item.product_name}`)
      } else {
        const stock = enforcedStock(productMap.get(item.id))
        if (item.qty > stock) errs.push(`Insufficient stock for ${item.product_name} (available ${stock})`)
      }
    })
    if (!payment.method) errs.push('Select a payment method')
    if (payment.method === 'credit' && CREDIT_REQUIRES_CUSTOMER && !customer) errs.push('Select a customer for a credit sale')
    if (payment.method === 'cash' && cashShort) errs.push('Cash received is less than the grand total')
    if (payment.method && !['cash', 'credit', 'razorpay'].includes(payment.method) && !Number(payment.amount)) {
      errs.push('Enter payment amount')
    }
    return errs
  }, [cart, productMap, payment, customer, cashShort, grandTotal])

  // Quick Pay can be opened with or without a cart — it only requires the
  // shop's UPI ID. The modal itself handles amount entry.
  const openQuickPayment = () => {
    if (!upiId) {
      toast.error('Configure shop UPI ID in Settings first')
      return
    }
    setShowQr(true)
  }

  const openRazorpayCheckout = () => {
    if (!cart.length) return toast.error('Add products to the bill first')
    if (grandTotal <= 0) return toast.error('Bill total must be greater than ₹0')
    if (validationErrors.length) return toast.error(validationErrors[0])
    setShowRazorpay(true)
  }

  const resetBill = ({ closeSuccess = true } = {}) => {
    setCart([]); setCustomer(null); setCustomerSearch('')
    setPayment(INITIAL_PAYMENT)
    setBillDiscountInput(''); setNotes(''); setLastAddedId(null)
    setMobilePaymentOpen(false)
    if (closeSuccess) setShowSuccess(false)
    setSearchActive(false); setActiveIdx(-1); setCustomerOpen(false)
    searchRef.current?.focus()
  }

  // "New Bill": clear the form and the previous receipt (unless a Razorpay
  // payment for it is still pending).
  const startNewBill = () => {
    resetBill()
    if (!isPendingRazorpay) setLastInvoice(null)
  }

  const saveDraft = () => {
    if (!cart.length) return toast.error('Cart is empty')
    const draft = {
      id: Date.now(), savedAt: new Date().toISOString(),
      customerName: customer?.name || customerSearch || 'Walk-in Customer',
      cart, customer, customerSearch, payment, billDiscountInput, notes,
    }
    saveDraftsStore([draft, ...loadDrafts().slice(0, 19)])
    setDrafts(loadDrafts())
    toast.success('Bill saved as draft')
    resetBill()
  }

  const applyDraft = d => {
    setCart(d.cart || [])
    setCustomer(d.customer || null)
    setCustomerSearch(d.customerSearch || '')
    setPayment(d.payment || INITIAL_PAYMENT)
    setBillDiscountInput(d.billDiscountInput || '')
    setNotes(d.notes || '')
  }

  useEffect(() => {
    const rawDraft = sessionStorage.getItem('pos_resume_draft')
    if (rawDraft) {
      try {
        const d = JSON.parse(rawDraft)
        applyDraft(d)
        saveDraftsStore(loadDrafts().filter(x => x.id !== d.id))
        setDrafts(loadDrafts())
        toast.success('Draft resumed')
      } catch { /* ignore */ }
      sessionStorage.removeItem('pos_resume_draft')
    }
  }, [])

  const resumeDraft = d => {
    if (cart.length) { toast.error('Complete or save the current bill as a draft first'); return }
    applyDraft(d)
    saveDraftsStore(loadDrafts().filter(x => x.id !== d.id))
    setDrafts(loadDrafts())
    setShowDrafts(false)
    toast.success('Draft resumed')
  }

  const deleteDraft = id => {
    saveDraftsStore(loadDrafts().filter(x => x.id !== id))
    setDrafts(loadDrafts())
  }

  // -------------------------------------------------------------------------
  // Invoice document helpers (unchanged)
  // -------------------------------------------------------------------------
  const getInvoicePdfUrl = (invoiceId, thermal = false) => {
    if (!invoiceId) return ''
    const token = getAccessToken() || ''
    const params = new URLSearchParams()
    if (token) params.set('token', token)
    if (thermal) params.set('printer', 'thermal')
    const query = params.toString()
    return `${API_BASE_URL}/invoices/${invoiceId}/pdf/${query ? `?${query}` : ''}`
  }



  // Open the PDF and automatically invoke the browser print dialog.
  // The popup is opened synchronously from the button click so Chrome/Edge
  // are much less likely to block it.
  const printInvoiceDocument = async (invoiceId, thermal = false, existingWindow = null) => {
    if (!invoiceId) {
      toast.error('Complete the sale first')
      return
    }

    let win = existingWindow
    if (!win || win.closed) {
      win = window.open('', '_blank', 'width=900,height=900')
    }

    if (!win) {
      toast.error('Allow pop-ups to print the invoice')
      return
    }

    const mode = thermal ? 'Thermal Bill' : 'Invoice'
    const pdfUrl = getInvoicePdfUrl(invoiceId, thermal)

    try {
      win.location.href = pdfUrl
      const trigger = () => {
        try {
          win.focus()
          win.print()
        } catch {
          toast.error(`Could not open ${mode} print dialog`)
        }
      }
      setTimeout(trigger, thermal ? 1400 : 1200)
    } catch {
      try {
        win.close()
      } catch { /* ignore */ }
      toast.error(`Could not print ${thermal ? 'thermal bill' : 'bill'}`)
    }
  }

  const downloadInvoiceDocument = async (invoiceId, thermal = false) => {
    if (!invoiceId) {
      toast.error('Complete the sale first')
      return
    }

    try {
      const token = getAccessToken() || ''
      const params = new URLSearchParams()
      if (token) params.set('token', token)
      if (thermal) params.set('printer', 'thermal')

      const response = await api.get(
        `/invoices/${invoiceId}/pdf/${params.toString() ? `?${params.toString()}` : ''}`,
        { responseType: 'blob' }
      )

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${thermal ? 'thermal-' : ''}invoice-${invoiceId}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(`${thermal ? 'Thermal' : 'PDF'} invoice downloaded`)
    } catch (err) {
      toast.error(err.response?.data?.detail || `Could not download ${thermal ? 'thermal invoice' : 'PDF'}`)
    }
  }

  // -------------------------------------------------------------------------
  // Complete sale (payload and flow unchanged; validation + double-submit guard added)
  // -------------------------------------------------------------------------
  const saveBill = async (print, overridePayment = null) => {
    if (savingRef.current) return
    if (validationErrors.length) return toast.error(validationErrors[0])

    const activePayment = overridePayment || payment
    const receivedAmount = activePayment.method === 'cash'
      ? (Number(activePayment.amount) || grandTotal)
      : Number(activePayment.amount || 0)
    const effectivePaymentStatus = activePayment.method === 'cash' && activePayment.status === 'pending'
      ? 'paid'
      : activePayment.method === 'razorpay'
      ? (activePayment.status || 'paid')
      : activePayment.status
    if (activePayment.method !== 'credit' && activePayment.method !== 'razorpay' && !receivedAmount) {
      return toast.error('Enter payment amount')
    }

    // For Print, create the popup BEFORE the async API request.
    // This avoids browser popup blockers after the invoice is saved.
    let printWindow = null
    if (print) {
      printWindow = window.open('', '_blank', 'width=900,height=900')
      if (!printWindow) {
        toast.error('Allow pop-ups to print the bill')
        return
      }
      printWindow.document.write(`
        <!doctype html>
        <html><body style="font-family:Arial;text-align:center;padding:40px">
          Preparing bill for printing…
        </body></html>
      `)
      printWindow.document.close()
    }

    savingRef.current = true
    setSaving(true)

    try {
      const payload = {
        customer: customer?.id || null,
        customer_name: customer?.name || 'Walk-in Customer',
        customer_phone: customer?.mobile || '',
        place_of_supply: customer?.place_of_supply || customer?.state || settings.place_of_supply || settings.shop_state || 'Tamil Nadu (33)',
        payment_method: activePayment.method,
        payment_status: effectivePaymentStatus,
        bill_discount: billDiscount,
        notes,
        items: cart.map(i => ({
          product_id: i.id,
          ...(i.batch_id ? { batch_id: Number(i.batch_id) } : {}),
          quantity: i.qty,
          unit_price: i.unit_price,
          discount_percent: i.discount_percent,
          gst_percent: i.gst_percent
        })),
        payments: activePayment.method === 'credit'
          ? []
          : [{
              method: activePayment.method,
              amount: activePayment.method === 'cash'
                ? Math.min(receivedAmount, grandTotal)
                : Number(activePayment.amount || grandTotal),
              reference: activePayment.reference || ''
            }]
      }

      const data = await invoiceService.createInvoice(payload)
      if (!data || typeof data !== 'object' || Array.isArray(data) || !data.id) {
        throw new Error('The sale was saved, but the invoice response was incomplete. Please refresh and check Bills before retrying.')
      }

      // Preserve customer contact/payment information for Share after
      // resetBill() clears the current billing form.
      const savedInvoice = {
        ...data,
        customer_phone: data.customer_phone || customer?.mobile || '',
        customer_name: data.customer_name || customer?.name || 'Walk-in Customer',
        payment_method: data.payment_method || activePayment.method,
        payment_status: data.payment_status || effectivePaymentStatus,
        amount_received: receivedAmount,
      }

      toast.success(`Sale completed — invoice ${data.invoice_number}`)

      if (print) {
        await printInvoiceDocument(data.id, false, printWindow)
        printWindow = null
      }

      resetBill({ closeSuccess: false })
      setLastInvoice(savedInvoice)
      setShowSuccess(true)
      try {
        window.dispatchEvent(new CustomEvent('pos:invoice-created', { detail: savedInvoice }))
      } catch { /* ignore */ }
    } catch (err) {
      if (printWindow && !printWindow.closed) {
        try { printWindow.close() } catch { /* ignore */ }
      }
      const responseData = err.response?.data
      const validationMessage = responseData && typeof responseData === 'object'
        ? Object.values(responseData).flat().find(value => typeof value === 'string')
        : null
      toast.error(validationMessage || responseData?.detail || err.message || 'Could not save bill')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const addCustomer = async () => {
    if (addingCustomer) return
    if (!newCustomer.name.trim()) return toast.error('Customer name is required')
    setAddingCustomer(true)
    try {
      const data = await customerService.createCustomer(newCustomer)
      setCustomers(x => [...x, data]); setCustomer(data); setCustomerSearch(data.name)
      setShowCustomerModal(false); setNewCustomer({ name: '', mobile: '', email: '' })
      toast.success(`Customer "${data.name}" added`)
    } catch (err) {
      const msg = err?.response?.data
      const detail = typeof msg === 'object'
        ? Object.values(msg).flat().find(v => typeof v === 'string')
        : msg?.detail
      toast.error(detail || 'Failed to add customer')
    } finally {
      setAddingCustomer(false)
    }
  }

  const getShortUrl = async (invoiceId) => {
    const link = await invoiceService.createShortLink(invoiceId)
    return link.short_url
  }

  const shareInvoice = (inv = null) => {
    const target = inv || lastInvoice
    if (!target) {
      toast.error('Complete the sale first')
      return
    }
    setWhatsAppInvoice(target)
    setWhatsAppModalOpen(true)
  }

  const emailInvoice = async (inv = null) => {
    const target = inv || lastInvoice
    if (!target) {
      toast.error('Complete the sale first')
      return
    }
    const customerEmail = target.customer?.email || target.customer_email || ''
    let emailToSend = customerEmail
    if (!emailToSend) {
      emailToSend = window.prompt(`Enter customer email address for Invoice #${target.invoice_number || target.id}:`, '')
      if (!emailToSend || !emailToSend.trim()) return
    }
    const toastId = toast.loading(`Emailing invoice to ${emailToSend.trim()}...`)
    try {
      await invoiceService.sendEmail(target.id, emailToSend.trim())
      toast.success(`Invoice emailed successfully to ${emailToSend.trim()}!`, { id: toastId })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send email. Check SMTP settings.', { id: toastId })
    }
  }

  const setExactCash = () => setPayment(x => ({
    ...x,
    method: 'cash',
    amount: grandTotal > 0 ? grandTotal.toFixed(2) : '',
    status: 'paid',
    autoAmount: true,
  }))
  const addCashChip = v => setPayment(x => {
    const current = Number(x.amount || grandTotal || 0)
    return {
      ...x,
      method: 'cash',
      amount: (current + v).toFixed(2),
      status: 'paid',
      autoAmount: false,
    }
  })

  // Ctrl+P / F7: print the bill being built (complete & print), otherwise the last invoice.
  const printCurrent = () => {
    if (cart.length) saveBill(true)
    else if (lastInvoice?.id) printInvoiceDocument(lastInvoice.id, false)
    else toast.error('Nothing to print')
  }

  const focusPayment = () => {
    const root = paymentSectionRef.current
    const target = root?.querySelector('input:not([readonly])') || root?.querySelector('button[aria-checked="true"]')
    target?.focus()
  }

  // Keyboard shortcuts — handlers are read through a ref so they never go stale.
  actionsRef.current = {
    saveBill,
    saveDraft,
    printCurrent,
    focusPayment,
    navigate,
    openRazorpayCheckout,
    showSuccess,
    startNewBill,
    setShowSuccess,
  }
  useEffect(() => {
    const onKey = e => {
      const a = actionsRef.current
      const key = e.key
      const mod = e.ctrlKey || e.metaKey
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if (a.showSuccess && key === 'Enter') {
        e.preventDefault()
        a.setShowSuccess(false)
        a.startNewBill()
        return
      }
      if (mod && key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
      else if (mod && key.toLowerCase() === 'd') { e.preventDefault(); a.saveDraft() }
      else if (mod && key.toLowerCase() === 'p') { e.preventDefault(); a.printCurrent() }
      else if (mod && key === 'Enter') {
        e.preventDefault()
        if (payment.method === 'razorpay') a.openRazorpayCheckout()
        else a.saveBill(false)
      }
      else if (key === 'F1') { e.preventDefault(); a.navigate('/billing/new') }
      else if (key === 'F2') { e.preventDefault(); customerRef.current?.focus() }
      else if (key === 'F3') { e.preventDefault(); searchRef.current?.focus() }
      else if (key === 'F4') { e.preventDefault(); a.focusPayment() }
      else if (key === 'F5') { e.preventDefault(); a.saveDraft() }
      else if (key === 'F6') { e.preventDefault(); billDiscountRef.current?.focus() }
      else if (key === 'F7') { e.preventDefault(); a.printCurrent() }
      else if (key === 'F8') {
        e.preventDefault()
        if (payment.method === 'razorpay') a.openRazorpayCheckout()
        else a.saveBill(false)
      }
      else if (key === 'Escape') {
        setShowQr(false); setShowCustomerModal(false); setShowShortcuts(false)
        setShowClearConfirm(false); setShowDrafts(false); setShowRazorpay(false)
        setSearchActive(false); setCustomerOpen(false)
        if (!typing) setShowSuccess(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => document.removeEventListener('fullscreenchange', onFullscreen)
  }, [])

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch {
      toast.error('Fullscreen is not available in this browser')
    }
  }

  const stockLabel = p => {
    const s = p?.current_stock ?? 0
    return `${s}${p?.unit ? ` ${p.unit}` : ''}`
  }
  const isOut = p => {
    const s = enforcedStock(p)
    return Number.isFinite(s) && s <= 0
  }
  // Display helpers for product cards (service / untracked items show no stock line).

  const isLowStock = p => {
    const n = Number(p?.current_stock)
    return Number.isFinite(n) && n > 0 && n <= LOW_STOCK_THRESHOLD
  }

  const billIssues = cart.length > 0 ? validationErrors : []
  // Keep the action available for a populated bill so validation feedback is
  // delivered by saveBill instead of presenting a button that appears broken.
  const canAttemptComplete = !saving && grandTotal > 0 && cart.length > 0
  const completeTitle = !cart.length
    ? 'Add products to current bill to complete sale'
    : grandTotal <= 0
    ? 'Bill total must be greater than ₹0'
    : validationErrors.length === 0
    ? 'Complete sale (F8)'
    : (validationErrors[0] || '')

  // =========================================================================
  // Render: High-Efficiency 45/55 Table-Based POS Workspace
  // =========================================================================
  return (
    <div className="pb-page">
      {/* ============================ 1. TOP HEADER ============================ */}
      <header className="pb-header">
        <div className="pb-head-left">
          <div className="pb-title">
            <IconShoppingCart size={17} className="text-blue-600" />
            <span>New Sale</span>
          </div>
          <div className="pb-meta">
           <span>Date: <b>{fmtDate(now)} {fmtTime(now)}</b></span>
            <span>Cashier: <b>{cashier}</b></span>
            {dashboard && dashboard.today_bills != null && (
              <span className="pb-hide-sm">Bills today: <b>{dashboard.today_bills}</b></span>
            )}
            {dashboard && dashboard.today_sales != null && (
              <span className="pb-hide-sm">Sales today: <b>{fmt(dashboard.today_sales)}</b></span>
            )}
          </div>
        </div>
        <div className="pb-head-actions">
          <button
            type="button"
            className="pb-btn pb-btn-sm pb-drafts-head-btn"
            aria-label={`Draft bills (${drafts.length})`}
            title="Draft bills (Ctrl+D to save)"
            onClick={() => { setDrafts(loadDrafts()); setShowDrafts(true) }}
          >
            <IconLayersLinked size={14} />
            <span className="pb-drafts-label">Drafts ({drafts.length})</span>
          </button>
          <button
            type="button"
            className="pb-btn pb-btn-sm pb-desktop-only pb-shortcuts-head-btn"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (F1-F10)"
            onClick={() => setShowShortcuts(true)}
          >
            <IconKeyboard size={14} />
            <span className="pb-hide-sm">Shortcuts</span>
          </button>
          <button
            type="button"
            className="pb-btn pb-btn-sm pb-desktop-only"
            aria-label="Calculator"
            title="Calculator"
            onClick={() => setShowCalculator(true)}
          >
            <IconCalculator size={14} />
            <span className="pb-hide-sm">Calculator</span>
          </button>
          <button
            type="button"
            className="pb-btn pb-btn-sm pb-desktop-only pb-fullscreen-head-btn"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <IconMinimize size={14} /> : <IconMaximize size={14} />}
            <span className="pb-hide-sm">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
          </button>

          {/* Mobile More Actions Menu */}
          <div className="pb-mobile-only pb-more-container" ref={mobileMoreRef}>
            <button
              type="button"
              className={`pb-btn pb-btn-sm pb-more-btn${mobileMoreOpen ? ' active' : ''}`}
              aria-label="More actions"
              aria-expanded={mobileMoreOpen}
              onClick={() => setMobileMoreOpen(v => !v)}
            >
              <IconDotsVertical size={16} />
            </button>
            {mobileMoreOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 bg-black/10"
                  onClick={() => setMobileMoreOpen(false)}
                />
                <div className="pb-more-popover" role="menu">
                <button
                  type="button"
                  className="pb-more-item"
                  role="menuitem"
                  onClick={() => { setShowShortcuts(true); setMobileMoreOpen(false) }}
                >
                  <IconKeyboard size={14} />
                  <span>Shortcuts</span>
                </button>
                <button
                  type="button"
                  className="pb-more-item"
                  role="menuitem"
                  onClick={() => { setShowCalculator(true); setMobileMoreOpen(false) }}
                >
                  <IconCalculator size={14} />
                  <span>Calculator</span>
                </button>
                <button
                  type="button"
                  className="pb-more-item"
                  role="menuitem"
                  onClick={() => { toggleFullscreen(); setMobileMoreOpen(false) }}
                >
                  {isFullscreen ? <IconMinimize size={14} /> : <IconMaximize size={14} />}
                  <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                </button>
                <button
                  type="button"
                  className="pb-more-item"
                  role="menuitem"
                  onClick={() => { startNewBill(); setMobileMoreOpen(false) }}
                  disabled={saving || (!cart.length && !lastInvoice)}
                >
                  <IconRefresh size={14} />
                  <span>Start New Bill</span>
                </button>
                <div className="pb-more-divider" />
                <div className="pb-more-info">
                  <span>Cashier: <b>{cashier}</b></span>
                  <span>{fmtDate(now)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      </header>

      {loadError && !initializing && (
        <div className="pb-banner" role="alert">
          <IconAlertTriangle size={14} />
          <span>Some data could not be loaded (products, customers or settings may be incomplete).</span>
          <button type="button" className="pb-link" onClick={loadInitialData}>Retry</button>
        </div>
      )}

      {/* Mobile View Switcher (Catalog vs Cart) */}
      <div className="pb-mobile-view-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'catalog'}
          className={`pb-mobile-tab ${mobileTab === 'catalog' ? 'active' : ''}`}
          onClick={() => setMobileTab('catalog')}
        >
          <IconPackage size={14} />
          <span>Catalog ({filtered.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'cart'}
          className={`pb-mobile-tab ${mobileTab === 'cart' ? 'active' : ''}`}
          onClick={() => setMobileTab('cart')}
        >
          <IconShoppingCart size={14} />
          <span>Active Cart</span>
          <span className={`pb-mobile-cart-badge ${cart.length > 0 ? 'has-items' : ''}`}>
            {cart.length} {cart.length > 0 ? `• ${fmt(grandTotal)}` : ''}
          </span>
        </button>
      </div>

      {/* ============================ LAST COMPLETED BILL BANNER (Responsive & Mobile-Friendly) ============================ */}
      {lastInvoice && (
        <aside className="pb-last-bill-banner" aria-label="Last completed bill banner">
          <div className="pb-last-bill-content">
            <div className="pb-last-bill-lead">
              <span className="pb-last-bill-badge">
                <IconCheck size={11} strokeWidth={2.8} />
                <span>Last Bill</span>
              </span>
              <span className="pb-last-bill-num">
                {lastInvoice.invoice_number || `INV-${lastInvoice.id}`}
              </span>
              <span className="pb-last-bill-meta">
                <span>•</span>
                <strong>{fmt(lastInvoice.grand_total)}</strong>
                <span>•</span>
                <span>{lastInvoice.customer_name || 'Walk-in'}</span>
              </span>
            </div>
            <div className="pb-last-bill-btns">
              <button
                type="button"
                className="pb-last-bill-btn"
                onClick={() => printInvoiceDocument(lastInvoice.id, false)}
                title="Print A4"
              >
                <IconPrinter size={13} />
                <span>A4</span>
              </button>
              <button
                type="button"
                className="pb-last-bill-btn"
                onClick={() => printInvoiceDocument(lastInvoice.id, true)}
                title="Print Thermal"
              >
                <IconReceipt size={13} />
                <span>Thermal</span>
              </button>
              <button
                type="button"
                className="pb-last-bill-btn"
                onClick={() => shareInvoice()}
                title="Review & Send via WhatsApp"
              >
                <IconBrandWhatsapp size={13} className="text-[#25D366]" />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                className="pb-last-bill-close"
                onClick={() => setLastInvoice(null)}
                title="Dismiss banner"
                aria-label="Dismiss last bill banner"
              >
                <IconX size={14} />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ============================ 2. MAIN WORKSPACE (45% / 55% SPLIT) ============================ */}
      <main className="pb-workspace">
        {/* ================= PRODUCT SECTION (45% WIDTH) ================= */}
        <section className={`pb-panel pb-products-col ${mobileTab === 'cart' ? 'pb-col-hidden-mobile' : ''}`} aria-label="Products Catalog">
          {/* Prominent Search and Scan Area */}
          <div className="pb-search-area">
            <SearchBar
              value={search}
              onChange={value => { setSearch(value); setSearchActive(true); setActiveIdx(-1) }}
              onClear={() => { setActiveIdx(-1); setSearchActive(true); searchRef.current?.focus() }}
              inputRef={searchRef}
              placeholder="Search products by name, SKU or barcode"
              shortcut="Ctrl+K"
              className="pb-search-field"
              inputClassName="pb-search-input"
              iconClassName="pb-field-icon"
              clearButtonClassName="pb-search-clear"
              shortcutClassName="pb-kbd-hint"
              clearButtonProps={{ onMouseDown: event => event.preventDefault() }}
              inputProps={{
                id: 'pb-search',
                'aria-label': 'Search products by name, SKU, or barcode',
                onClick: () => setSearchActive(true),
                onBlur: () => setTimeout(() => setSearchActive(false), 180),
                onKeyDown: onSearchKeyDown,
                role: 'combobox',
                'aria-expanded': searchActive,
                'aria-controls': 'pb-search-list',
                'aria-autocomplete': 'list',
                autoFocus: true,
                inputMode: 'search',
                autoComplete: 'off',
                autoCapitalize: 'none',
                spellCheck: false,
              }}
            >
              {/* Autocomplete Dropdown */}
              {searchActive && (
                <div className="pb-dropdown" id="pb-search-list" role="listbox">
                  {search.trim() ? (
                    <>
                      <div className="pb-dd-head">Search results ({filtered.length})</div>
                      {searchResults.length ? searchResults.map((p, i) => (
                        <div
                          role="option"
                          aria-selected={i === activeIdx}
                          key={p.id}
                          onMouseEnter={() => setActiveIdx(i)}
                          onClick={() => { addToCart(p); setSearchActive(false) }}
                          className="pb-result cursor-pointer"
                        >
                          <span>
                            <span className="pb-strong">{p.name}</span>
                            {isOut(p) && <span className="pb-badge">Out of stock</span>}
                            <span className="pb-sub block">
                              SKU: {p.sku || '—'} | Barcode: {p.barcode || '—'}
                            </span>
                          </span>
                          <span className="pb-result-side">
                            <span className="pb-strong block">{fmt(p.selling_price)}</span>
                            <span className="pb-sub">Stock: {stockLabel(p)}</span>
                          </span>
                        </div>
                      )) : <div className="pb-dd-empty">No products found for “{search.trim()}”.</div>}
                      {filtered.length > searchResults.length && (
                        <div className="pb-dd-empty">Showing {searchResults.length} of {filtered.length} — type more to narrow the list.</div>
                      )}
                    </>
                  ) : (
                    <div className="pb-dd-cols">
                      <div>
                        <div className="pb-dd-head">Recent products</div>
                        {recentProducts.length ? recentProducts.map(p => (
                          <div key={p.id} className="pb-result pb-suggestion">
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => { addToCart(p); setSearchActive(false) }}
                              className="pb-suggestion-main"
                              disabled={isOut(p)}
                            >
                              <span className="pb-strong">{p.name}</span>
                              <span className="pb-sub">{p.sku || p.barcode || '—'}</span>
                              <span className="pb-sub">Stock: {stockLabel(p)}</span>
                            </button>
                            <div className="pb-suggestion-side">
                              <span className="pb-strong">{fmt(p.selling_price)}</span>
                              <button
                                type="button"
                                className="pb-suggestion-add"
                                disabled={isOut(p)}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => { addToCart(p); setSearchActive(false) }}
                              >
                                <IconPlus size={12} /> {isOut(p) ? 'Out' : 'Add'}
                              </button>
                            </div>
                          </div>
                        )) : <div className="pb-dd-empty">Recently billed products will appear here.</div>}
                      </div>
                      <div>
                        <div className="pb-dd-head">Recommended products</div>
                        {recommendedProducts.length ? recommendedProducts.map(p => (
                          <div key={p.id} className="pb-result pb-suggestion">
                            <button
                              type="button"
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => { addToCart(p); setSearchActive(false) }}
                              className="pb-suggestion-main"
                              disabled={isOut(p)}
                            >
                              <span className="pb-strong">{p.name}</span>
                              <span className="pb-sub">{p.sku || p.barcode || '—'}</span>
                              <span className="pb-sub">Stock: {stockLabel(p)}</span>
                            </button>
                            <div className="pb-suggestion-side">
                              <span className="pb-strong">{fmt(p.selling_price)}</span>
                              <button
                                type="button"
                                className="pb-suggestion-add"
                                disabled={isOut(p)}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => { addToCart(p); setSearchActive(false) }}
                              >
                                <IconPlus size={12} /> {isOut(p) ? 'Out' : 'Add'}
                              </button>
                            </div>
                          </div>
                        )) : <div className="pb-dd-empty">No recommendations available.</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SearchBar>

            {/* Category Navigation Bar with smooth horizontal scrolling */}
            <div className="pb-cats-container">
              <div className="pb-cats" role="group" aria-label="Filter by category">
                <button
                  type="button"
                  className="pb-cat"
                  aria-pressed={catFilter === ''}
                  onClick={() => setCatFilter('')}
                >
                  All Items
                </button>
                {(Array.isArray(categories) ? categories : []).map(c => (
                  <button
                    type="button"
                    key={c.id}
                    className="pb-cat"
                    aria-pressed={catFilter === String(c.id)}
                    onClick={() => setCatFilter(String(c.id))}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* High-Density Products Table */}
          <div className="pb-table-wrap">
            <table className="pb-prod-table">
              <thead>
                <tr>
                  <th className="pb-th-pname">Product</th>
                  <th className="pb-th-sku">SKU</th>
                  <th className="pb-th-price">Price</th>
                  <th className="pb-th-stock">Stock</th>
                  <th className="pb-th-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {initializing && (!Array.isArray(products) || !products.length) ? (
                  <tr>
                    <td colSpan="5" className="pb-bill-empty-td">
                      <div className="pb-bill-empty-content">
                        <IconPackage size={28} className="pb-text-muted" />
                        <div className="pb-strong">Loading products…</div>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length ? (
                  filtered.map(p => {
                    const out = isOut(p)
                    const inCart = cartQtyMap.get(p.id) || 0
                    const low = isLowStock(p)
                    return (
                      <tr
                        key={p.id}
                        className={`pb-prod-tr${inCart > 0 ? ' pb-row-incart' : ''}${out ? ' pb-row-out' : ''}`}
                        onClick={() => !out && addToCart(p)}
                        title={out ? 'Out of stock' : 'Click row to add to bill'}
                      >
                        <td>
                          <div className="pb-prod-name">{p.name}</div>
                          <div className="pb-prod-sub">
                            <span className="pb-mobile-only pb-sku-inline">{p.sku ? `SKU: ${p.sku} · ` : ''}</span>
                            {[p.category_name, p.unit].filter(Boolean).join(' · ')}
                            {p.barcode && <span className="pb-barcode-inline"> · &#9641; {p.barcode}</span>}
                          </div>
                        </td>
                        <td>
                          {p.sku ? <span className="pb-sku-tag">{p.sku}</span> : <span className="pb-muted">—</span>}
                        </td>
                        <td className="pb-td-price">
                          <div className="pb-price-val">{fmt(p.selling_price)}</div>
                          {p.mrp && Number(p.mrp) > p.selling_price ? (
                            <div className="pb-mrp-val">MRP {fmt(p.mrp)}</div>
                          ) : null}
                        </td>
                        <td className="pb-td-stock">
                          <span className={`pb-stock-badge ${out ? 'pb-stock-out' : low ? 'pb-stock-low' : 'pb-stock-normal'}`}>
                            <span className="pb-stock-dot" />
                            {out ? 'Out' : low ? `Low: ${stockLabel(p)}` : stockLabel(p)}
                          </span>
                        </td>
                        <td className="pb-td-action" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className={`pb-btn-add${inCart > 0 ? ' is-incart' : ''}${out ? ' is-out' : ''}`}
                            disabled={out}
                            aria-label={out ? `${p.name} is out of stock` : `Add ${p.name}`}
                            onClick={e => {
                              e.stopPropagation()
                              addToCart(p)
                            }}
                          >
                            <IconPlus size={13} />
                            {out ? 'Out' : inCart > 0 ? `Add (${inCart})` : 'Add'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan="5" className="pb-bill-empty-td">
                      <div className="pb-bill-empty-content">
                        <IconPackage size={28} className="pb-text-muted" />
                        <div className="pb-strong">No products found</div>
                        <div className="pb-sub">
                          {products.length
                            ? 'Try a different search query or category filter.'
                            : 'Add products to your inventory to start building this bill.'}
                        </div>
                        <button
                          type="button"
                          className="pb-btn-add mt-2"
                          onClick={() => navigate('/inventory/products')}
                        >
                          <IconPlus size={13} /> Add Product
                        </button>
                        {(search || catFilter) && (
                          <button
                            type="button"
                            className="pb-link mt-2"
                            onClick={() => { setSearch(''); setCatFilter('') }}
                          >
                            Clear search &amp; filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="pb-table-footer">
            <span>Showing {filtered.length} products</span>
            <span className="pb-hide-sm">Press Ctrl+K or scan barcode to search</span>
          </div>
        </section>

        {/* ================= CART/BILL SECTION (55% WIDTH) ================= */}
        <section className={`pb-panel pb-bill-col ${mobileTab === 'catalog' ? 'pb-col-hidden-mobile' : ''}`} aria-label="Current Bill and Summary">
          {/* Active Cart Section Header */}
          <div className="pb-cart-header">
            <div className="pb-cart-header-left">
              <div className="pb-cart-title">
                <IconShoppingCart size={16} className="text-blue-600" />
                <span>Active Sale Cart</span>
              </div>
              <span className="pb-cart-count-pill">
                {cart.length} {cart.length === 1 ? 'item' : 'items'}
                {totalQty > 0 ? ` (${totalQty} units)` : ''}
              </span>
            </div>

            <div className="pb-cart-header-actions">
              {cart.length > 0 && (
                <button
                  type="button"
                  className="pb-btn-clear-cart"
                  title="Clear all cart items"
                  onClick={() => setShowClearConfirm(true)}
                >
                  <IconTrash size={13} />
                  <span>Clear</span>
                </button>
              )}
              <button
                type="button"
                className="pb-btn-add-more lg:hidden"
                onClick={() => setMobileTab('catalog')}
              >
                + Add Items
              </button>
            </div>
          </div>

          {/* Improved Customer Selection Row */}
          <div className="pb-cust-bar">
            <span className="pb-cust-label">Customer:</span>
            <div className="pb-cust-select-wrap">
              {customer ? (
                <div className="pb-cust-selected-badge">
                  <IconUser size={14} className="text-blue-600" />
                  <span className="pb-cust-selected-name">{customer.name}</span>
                  {customer.mobile && <span className="pb-cust-selected-phone">({customer.mobile})</span>}
                  <button
                    type="button"
                    className="pb-cust-remove-btn"
                    title="Change to Walk-in Customer"
                    onClick={() => { setCustomer(null); setCustomerSearch('') }}
                  >
                    <IconX size={12} />
                  </button>
                </div>
              ) : (
                <div className="pb-cust-box">
                  <IconUser size={14} className="pb-field-icon" />
                  <input
                    id="pb-customer"
                    ref={customerRef}
                    className="pb-cust-input"
                    placeholder="Walk-in Customer — search name or phone (F2)"
                    value={customerSearch}
                    autoComplete="off"
                    onFocus={() => setCustomerOpen(true)}
                    onBlur={() => setTimeout(() => setCustomerOpen(false), 200)}
                    onChange={e => {
                      const v = e.target.value
                      setCustomerSearch(v)
                      setCustomerOpen(true)
                      if (!v || (customer && v !== customer.name)) setCustomer(null)
                    }}
                  />
                  {customerSearch && (
                    <button
                      type="button"
                      className="pb-cust-clear"
                      aria-label="Clear customer"
                      title="Clear customer"
                      onClick={() => { setCustomer(null); setCustomerSearch('') }}
                    >
                      <IconX size={13} />
                    </button>
                  )}
                </div>
              )}

              {customerOpen && !customer && (
                <div className="pb-cust-popover">
                  <button
                    type="button"
                    className="pb-cust-opt"
                    onMouseDown={e => {
                      e.preventDefault()
                      setCustomer(null)
                      setCustomerSearch('')
                      setCustomerOpen(false)
                    }}
                  >
                    <span className="pb-strong">Walk-in Customer</span>
                    <span className="pb-sub">Default</span>
                  </button>
                  {filteredCustomers.slice(0, 6).map(c => (
                    <button
                      type="button"
                      key={c.id}
                      className="pb-cust-opt"
                      onMouseDown={e => {
                        e.preventDefault()
                        setCustomer(c)
                        setCustomerSearch(c.name)
                        setCustomerOpen(false)
                      }}
                    >
                      <span className="pb-strong">{c.name}</span>
                      <span className="pb-sub">{c.mobile || 'No phone'}</span>
                    </button>
                  ))}
                  {customerSearch && !filteredCustomers.length && (
                    <div className="p-2 text-xs text-slate-500">No customer found. Use “+ Customer” to add.</div>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              className="pb-btn pb-btn-sm pb-customer-add-btn"
              aria-label="Add new customer"
              title="Add new customer"
              onClick={() => setShowCustomerModal(true)}
            >
              <IconUserPlus size={14} />
              <span className="pb-hide-sm">+ Customer</span>
            </button>
          </div>

          {/* Current Bill Items Table */}
          <div className="pb-table-wrap">
            <table className="pb-bill-table">
              <thead>
                <tr>
                  <th className="pb-th-bitem">Item</th>
                  <th className="pb-th-bqty">Qty</th>
                  <th className="pb-th-brate">Rate</th>
                  <th className="pb-th-bdisc">Disc</th>
                  <th className="pb-th-btotal">Total</th>
                  <th className="pb-th-bact"></th>
                </tr>
              </thead>
              <tbody>
                {cart.length > 0 ? (
                  cart.map((item, index) => (
                    <CartRow
                      key={item.id}
                      item={item}
                      index={index + 1}
                      stock={enforcedStock(productMap.get(item.id))}
                      showGst={showGst}
                      justAdded={item.id === lastAddedId}
                      onQty={updateQty}
                      onDiscount={updateDiscount}
                      onBatch={updateBatch}
                      onRemove={removeItem}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="pb-bill-empty-td">
                      <div className="pb-bill-empty-content py-4">
                        <BillingWorkflowVisual className="w-full max-w-lg mb-3 border-0 bg-transparent shadow-none" compact />
                        <div className="flex items-center justify-center gap-2">
                          <IconShoppingCart size={20} className="pb-muted" />
                          <span className="pb-strong text-xs">Ready for Sale · Scan barcode or search product to begin</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bill Financial Summary (Single Grand Total Display) */}
          <div className="pb-summary-section">
            <div className="pb-sum-grid">
              <div className="pb-sum-row">
                <span className="pb-sum-label">Items Count:</span>
                <span className="pb-sum-val">{cart.length} ({totalQty} qty)</span>
              </div>
              <div className="pb-sum-row">
                <span className="pb-sum-label">Subtotal:</span>
                <span className="pb-sum-val">{fmt(subtotal)}</span>
              </div>
              <div className="pb-sum-row">
                <span className="pb-sum-label">Item Discount:</span>
                <span className={`pb-sum-val ${discount > 0 ? 'pb-text-red' : ''}`}>
                  {discount > 0 ? '-' : ''}{fmt(discount)}
                </span>
              </div>
              <div className="pb-sum-row">
                <label className="pb-sum-label" htmlFor="pb-bill-discount">Bill Disc (F6):</label>
                <div className="pb-bill-disc-box">
                  <span>₹</span>
                  <input
                    id="pb-bill-discount"
                    ref={billDiscountRef}
                    type="number"
                    min="0"
                    max={taxableBeforeBillDiscount}
                    step="0.01"
                    value={billDiscountInput}
                    onChange={e => setBillDiscountInput(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="pb-sum-row">
                <span className="pb-sum-label">Taxable Amount:</span>
                <span className="pb-sum-val">{fmt(taxableAmount)}</span>
              </div>
              {showGst && (
                <div className="pb-sum-row">
                  <span className="pb-sum-label">GST / Tax:</span>
                  <span className="pb-sum-val">{fmt(tax)}</span>
                </div>
              )}
              <div className="pb-sum-row">
                <span className="pb-sum-label">Round Off:</span>
                <span className="pb-sum-val">{fmtSigned(roundOff)}</span>
              </div>
            </div>

            {/* Grand Total Display Block */}
            <div className="pb-grand-total-block" aria-live="polite">
              <span className="pb-gt-title">Grand Total</span>
              <span className="pb-gt-figure">{fmt(grandTotal)}</span>
            </div>

            {billIssues.length > 0 && (
              <ul className="pb-errors" role="alert">
                {billIssues.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            )}

            {/* Inline Bill Notes */}
            <div className="pb-note-inline">
              <input
                id="pb-notes"
                className="pb-note-input"
                placeholder="Bill notes or order comments (optional)..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* Mobile-only Continue to Payment CTA */}
            <div className="pb-mobile-only pb-mobile-cart-action-bar">
              <div className="pb-mobile-cart-total-info">
                <span className="pb-sub">To Pay</span>
                <span className="pb-mobile-cart-total-val">{fmt(grandTotal)}</span>
              </div>
              <button
                type="button"
                className="pb-mobile-continue-pay-btn"
                disabled={!cart.length || grandTotal <= 0}
                onClick={() => setMobilePaymentOpen(true)}
              >
                <span>Continue to Payment</span>
                <IconArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ============================ 3. STICKY PAYMENT DOCK (SINGLE COMPLETE SALE) ============================ */}
      <footer className={`pb-dock ${mobileTab === 'catalog' ? 'pb-dock-hidden-mobile' : ''}`} aria-label="Payment dock and actions" ref={paymentSectionRef}>
        <div className="pb-dock-main">
          {/* Top Row: Segmented Payment Method Selector + Contextual Fields */}
          <div className="pb-dock-top-row">
            <div className="pb-methods-segmented" role="radiogroup" aria-label="Payment method (F4)">
              {PAYMENT_METHOD_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={payment.method === id}
                  className={`pb-seg-btn${payment.method === id ? ' active' : ''}`}
                  onClick={() => selectPayment(id)}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Contextual Payment Form Controls */}
            <div className="pb-dock-context">
              {payment.method === 'cash' && (
                <div className="pb-cash-controls">
                  <div className="pb-cash-input-wrap">
                    <span className="pb-dock-mini-label">Cash Received:</span>
                    <div className="pb-money-box">
                      <span className="pb-curr-sym">₹</span>
                      <input
                        id="pb-cash"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        disabled={grandTotal <= 0 || !cart.length}
                        className="pb-cash-input"
                        value={payment.amount}
                        placeholder={grandTotal > 0 ? grandTotal.toFixed(2) : '0.00'}
                        title={grandTotal <= 0 ? 'Add items to the bill' : 'Enter amount tendered'}
                        onChange={e => setPayment(x => ({ ...x, amount: e.target.value, status: 'paid', autoAmount: false }))}
                      />
                    </div>
                  </div>

                  <div className="pb-chips-strip">
                    <button
                      type="button"
                      className="pb-chip pb-chip-exact"
                      disabled={grandTotal <= 0 || !cart.length}
                      onClick={setExactCash}
                    >
                      Exact
                    </button>
                    {CASH_CHIPS.map(v => (
                      <button
                        key={v}
                        type="button"
                        className="pb-chip"
                        disabled={grandTotal <= 0 || !cart.length}
                        onClick={() => addCashChip(v)}
                      >
                        +{v}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="pb-chip"
                      disabled={grandTotal <= 0 || !cart.length}
                      onClick={() => setPayment(x => ({ ...x, amount: grandTotal > 0 ? grandTotal.toFixed(2) : '', autoAmount: true }))}
                    >
                      Reset
                    </button>
                  </div>

                  <div className="pb-change-stat">
                    {cashShort ? (
                      <span className="pb-short-val">Due: {fmt(cashBalanceDue)}</span>
                    ) : (
                      <>
                        <span className="pb-dock-mini-label">Change:</span>
                        <span className="pb-change-val">{fmt(cashChange)}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {payment.method === 'upi' && (
                <div className="pb-upi-controls">
                  <div className="pb-input-inline">
                    <span className="pb-dock-mini-label">Amount:</span>
                    <div className="pb-money-box">
                      <span className="pb-curr-sym">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={grandTotal <= 0 || !cart.length}
                        className="pb-dock-input pb-amt-input"
                        value={payment.amount}
                        onChange={e => setPayment(x => ({ ...x, amount: e.target.value, autoAmount: false }))}
                      />
                    </div>
                  </div>
                  <div className="pb-input-inline">
                    <span className="pb-dock-mini-label">UTR / Ref:</span>
                    <input
                      className="pb-dock-input"
                      placeholder="Optional reference"
                      value={payment.reference}
                      onChange={e => setPayment(x => ({ ...x, reference: e.target.value }))}
                    />
                  </div>
                  <button
                    type="button"
                    className="pb-btn pb-btn-sm pb-qr-action-btn"
                    onClick={openQuickPayment}
                    disabled={grandTotal <= 0 || !cart.length}
                    title={!upiId ? 'Configure shop UPI ID in Settings' : 'Show UPI QR Code'}
                  >
                    <IconQrcode size={14} /> Show QR
                  </button>
                  <div className="pb-input-inline">
                    <span className="pb-dock-mini-label">Status:</span>
                    <div className="pb-status-group" role="radiogroup" aria-label="Payment status">
                      <button
                        type="button"
                        role="radio"
                        data-s="paid"
                        aria-checked={payment.status === 'paid'}
                        className={`pb-status-btn${payment.status === 'paid' ? ' active' : ''}`}
                        onClick={() => setPayment(x => ({ ...x, status: 'paid' }))}
                      >
                        <IconCircleCheck size={12} />
                        <span>Paid</span>
                      </button>
                      <button
                        type="button"
                        role="radio"
                        data-s="pending"
                        aria-checked={payment.status === 'pending'}
                        className={`pb-status-btn${payment.status === 'pending' ? ' active' : ''}`}
                        onClick={() => setPayment(x => ({ ...x, status: 'pending' }))}
                      >
                        <IconClock size={12} />
                        <span>Pending</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {['card', 'online'].includes(payment.method) && (
                <div className="pb-card-controls">
                  <div className="pb-input-inline">
                    <span className="pb-dock-mini-label">Amount:</span>
                    <div className="pb-money-box">
                      <span className="pb-curr-sym">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={grandTotal <= 0 || !cart.length}
                        className="pb-dock-input pb-amt-input"
                        value={payment.amount}
                        onChange={e => setPayment(x => ({ ...x, amount: e.target.value, autoAmount: false }))}
                      />
                    </div>
                  </div>
                  <div className="pb-input-inline">
                    <span className="pb-dock-mini-label">Approval Code:</span>
                    <input
                      className="pb-dock-input"
                      placeholder="Optional reference"
                      value={payment.reference}
                      onChange={e => setPayment(x => ({ ...x, reference: e.target.value }))}
                    />
                  </div>
                  <div className="pb-input-inline">
                    <span className="pb-dock-mini-label">Status:</span>
                    <div className="pb-status-group" role="radiogroup" aria-label="Payment status">
                      <button
                        type="button"
                        role="radio"
                        data-s="paid"
                        aria-checked={payment.status === 'paid'}
                        className={`pb-status-btn${payment.status === 'paid' ? ' active' : ''}`}
                        onClick={() => setPayment(x => ({ ...x, status: 'paid' }))}
                      >
                        <IconCircleCheck size={12} />
                        <span>Paid</span>
                      </button>
                      <button
                        type="button"
                        role="radio"
                        data-s="pending"
                        aria-checked={payment.status === 'pending'}
                        className={`pb-status-btn${payment.status === 'pending' ? ' active' : ''}`}
                        onClick={() => setPayment(x => ({ ...x, status: 'pending' }))}
                      >
                        <IconClock size={12} />
                        <span>Pending</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {payment.method === 'credit' && (
                <div className="pb-credit-info">
                  <span>Credit Sale</span>
                  {CREDIT_REQUIRES_CUSTOMER && !customer && (
                    <span className="pb-text-red font-semibold">⚠️ Select a customer (F2) for credit sale</span>
                  )}
                </div>
              )}

              {payment.method === 'razorpay' && (
                <div className="pb-razorpay-info">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Payable via Razorpay Gateway</span>
                  <span className="text-slate-400">· Click "Pay with Razorpay" below. Sale confirms upon payment success.</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row: Organized Action Groups (Lifecycle on left, Payment on right) */}
          <div className="pb-dock-actions-row">
            <div className="pb-dock-left-actions">
              <button
                type="button"
                className="pb-btn-dock"
                title="Start a fresh bill (F1)"
                onClick={startNewBill}
                disabled={saving || (!cart.length && !lastInvoice)}
              >
                <IconRefresh size={13} />
                <span>New Bill</span>
              </button>
              <button
                type="button"
                className="pb-btn-dock"
                title="Save as Draft (Ctrl+D / F5)"
                onClick={saveDraft}
                disabled={saving || !cart.length}
              >
                <IconLayersLinked size={13} />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                className="pb-btn-dock"
                title={!upiId ? 'Configure shop UPI ID in Settings' : 'Quick QR for UPI collection'}
                onClick={openQuickPayment}
                disabled={grandTotal <= 0 || !cart.length}
              >
                <IconQrcode size={13} />
                <span>Quick QR</span>
              </button>
              <button
                type="button"
                className="pb-btn-dock pb-btn-danger"
                title="Clear all cart items"
                onClick={() => setShowClearConfirm(true)}
                disabled={!cart.length}
              >
                <IconTrash size={13} />
                <span>Clear</span>
              </button>
            </div>

            <div className="pb-dock-right-actions">
              {payment.method !== 'razorpay' && (
                <button
                  type="button"
                  className="pb-btn-dock pb-btn-print"
                  title="Complete Sale &amp; Print Bill (Ctrl+P / F7)"
                  onClick={() => saveBill(true)}
                  disabled={!canAttemptComplete}
                >
                  <IconPrinter size={13} />
                  <span>Complete &amp; Print</span>
                </button>
              )}

              {/* Primary Action: Pay with Razorpay OR Complete Sale */}
              {payment.method === 'razorpay' ? (
                <button
                  type="button"
                  className="pb-btn-razorpay-pay"
                  title={canAttemptComplete ? `Pay ${fmt(grandTotal)} with Razorpay` : completeTitle}
                  onClick={openRazorpayCheckout}
                  disabled={!canAttemptComplete}
                >
                  <IconCreditCard size={15} />
                  <span>{saving ? 'Processing…' : `Pay with Razorpay · ${fmt(grandTotal)}`}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="pb-btn-complete-sale"
                  title={completeTitle}
                  onClick={() => saveBill(false)}
                  disabled={!canAttemptComplete}
                >
                  <IconCircleCheck size={15} />
                  <span>{saving ? 'Processing…' : `✓ COMPLETE SALE · ${fmt(grandTotal)}`}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Mobile Cart Bar when viewing Catalog or Cart */}
      {cart.length > 0 && !mobilePaymentOpen && (
        <aside className="pb-mobile-only pb-mobile-floating-dock" aria-label="Quick cart bar">
          <div className="pb-floating-info">
            <div className="pb-floating-qty">
              <IconShoppingCart size={15} />
              <span><b>{cart.length}</b> {cart.length === 1 ? 'item' : 'items'} ({totalQty} units)</span>
            </div>
            <div className="pb-floating-total">
              <span>Total:</span>
              <b>{fmt(grandTotal)}</b>
            </div>
          </div>
          <button
            type="button"
            className="pb-floating-checkout-btn"
            onClick={() => {
              setMobilePaymentOpen(true)
            }}
          >
            {mobileTab === 'catalog' ? 'View Cart & Pay →' : 'Proceed to Pay →'}
          </button>
        </aside>
      )}

      {/* ============================ DEDICATED COLLECT PAYMENT SCREEN (RESPONSIVE) ============================ */}
      <Modal
        open={mobilePaymentOpen}
        onClose={() => setMobilePaymentOpen(false)}
        title="Collect Payment"
        subtitle={`${cart.length} item${cart.length === 1 ? '' : 's'} (${totalQty} units) · ${customer ? customer.name : 'Walk-in Customer'}`}
        size="lg"
        footer={
          <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {payment.method !== 'razorpay' && (
                <button
                  type="button"
                  className="flex min-h-[44px] flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] active:scale-95 transition disabled:opacity-50"
                  onClick={() => saveBill(true)}
                  disabled={!canAttemptComplete || saving}
                >
                  <IconPrinter size={15} />
                  <span>Complete &amp; Print</span>
                </button>
              )}
              <button
                type="button"
                className="flex min-h-[44px] flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] px-4 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] active:scale-95 transition disabled:opacity-50"
                onClick={saveDraft}
                disabled={saving || !cart.length}
              >
                <IconLayersLinked size={15} />
                <span>Save Draft</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="hidden sm:inline-flex min-h-[44px] items-center justify-center px-4 py-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition"
                onClick={() => setMobilePaymentOpen(false)}
              >
                Back to Bill
              </button>

              {payment.method === 'razorpay' ? (
                <button
                  type="button"
                  className="flex min-h-[48px] w-full sm:w-auto flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title={canAttemptComplete ? `Pay ${fmt(grandTotal)} with Razorpay` : completeTitle}
                  onClick={() => {
                    setMobilePaymentOpen(false)
                    openRazorpayCheckout()
                  }}
                  disabled={!canAttemptComplete || saving}
                >
                  <IconCreditCard size={18} />
                  <span>{saving ? 'Processing…' : `Pay with Razorpay · ${fmt(grandTotal)}`}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="flex min-h-[48px] w-full sm:w-auto flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title={completeTitle}
                  onClick={() => saveBill(false)}
                  disabled={!canAttemptComplete || saving}
                >
                  <IconCircleCheck size={18} />
                  <span>{saving ? 'Processing Sale…' : `Complete Sale · ${fmt(grandTotal)}`}</span>
                </button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Order Summary & Total to Pay Card (Clean, Simple & Mobile-Friendly) */}
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800/90 bg-[var(--surface-elevated)] p-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Total to Collect</span>
                <div className="text-3xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">{fmt(grandTotal)}</div>
                <div className="mt-1 text-xs text-[var(--muted)] flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-[var(--ink)]">{cart.length} {cart.length === 1 ? 'item' : 'items'} ({totalQty} units)</span>
                  <span>•</span>
                  <span>{customer ? customer.name : 'Walk-in Customer'}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--line-subtle)] text-xs">
                <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-[var(--surface)] p-2 shadow-2xs">
                  <span className="text-[9px] uppercase tracking-wider text-[var(--muted)] block">Subtotal</span>
                  <span className="font-mono font-semibold text-[var(--ink)]">{fmt(subtotal)}</span>
                </div>
                {billDiscount > 0 && (
                  <div className="rounded-xl border border-amber-300/60 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 p-2 shadow-2xs">
                    <span className="text-[9px] uppercase tracking-wider text-amber-700 dark:text-amber-400 block">Discount</span>
                    <span className="font-mono font-semibold text-amber-700 dark:text-amber-300">-{fmt(billDiscount)}</span>
                  </div>
                )}
                {showGst && (
                  <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-[var(--surface)] p-2 shadow-2xs">
                    <span className="text-[9px] uppercase tracking-wider text-[var(--muted)] block">GST / Tax</span>
                    <span className="font-mono font-semibold text-[var(--ink)]">{fmt(tax)}</span>
                  </div>
                )}
                <div className="rounded-xl border border-slate-200/70 dark:border-slate-800/70 bg-[var(--surface)] p-2 shadow-2xs">
                  <span className="text-[9px] uppercase tracking-wider text-[var(--muted)] block">Round Off</span>
                  <span className="font-mono font-semibold text-[var(--ink)]">{fmtSigned(roundOff)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Selector Cards */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2 block">
              Choose Payment Method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" role="radiogroup" aria-label="Payment method">
              {PAYMENT_METHOD_OPTIONS.map(({ id, label, icon: Icon }) => {
                const isSelected = payment.method === id
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-bold transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                    }`}
                    onClick={() => selectPayment(id)}
                  >
                    <Icon size={18} className={isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--muted)]'} />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Contextual Form Controls for Chosen Payment Method */}
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4">
            {payment.method === 'cash' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]" htmlFor="pb-modal-cash">
                    Cash Tendered / Received (₹)
                  </label>
                  <button
                    type="button"
                    className="text-xs font-bold text-emerald-600 hover:underline dark:text-emerald-400"
                    onClick={setExactCash}
                  >
                    Set Exact ({fmt(grandTotal)})
                  </button>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-lg font-bold text-[var(--muted)]">₹</span>
                  <input
                    id="pb-modal-cash"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className="w-full min-h-[48px] rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-8 pr-4 font-mono text-xl font-bold text-[var(--ink)] shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    value={payment.amount}
                    placeholder={grandTotal > 0 ? grandTotal.toFixed(2) : '0.00'}
                    onChange={e => setPayment(x => ({ ...x, amount: e.target.value, status: 'paid', autoAmount: false }))}
                  />
                </div>

                {/* Quick Cash Chips */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    className="min-h-[38px] rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition"
                    onClick={setExactCash}
                  >
                    Exact
                  </button>
                  {CASH_CHIPS.map(v => (
                    <button
                      key={v}
                      type="button"
                      className="min-h-[38px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                      onClick={() => addCashChip(v)}
                    >
                      +{v}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="min-h-[38px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] transition"
                    onClick={() => setPayment(x => ({ ...x, amount: grandTotal > 0 ? grandTotal.toFixed(2) : '', autoAmount: true }))}
                  >
                    Reset
                  </button>
                </div>

                {/* Auto Calculated Change / Due Banner */}
                <div className={`flex items-center justify-between rounded-xl p-3 border ${
                  cashShort
                    ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                }`}>
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {cashShort ? '⚠️ Balance Due from Customer:' : '💵 Change to Return to Customer:'}
                  </span>
                  <span className="font-mono text-lg font-black tabular-nums">
                    {cashShort ? fmt(cashBalanceDue) : fmt(cashChange)}
                  </span>
                </div>
              </div>
            )}

            {payment.method === 'upi' && (
              <div className="space-y-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/30 p-3.5 text-left text-blue-900 dark:text-blue-200 hover:bg-blue-100 transition"
                  onClick={openQuickPayment}
                  disabled={grandTotal <= 0}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
                      <IconQrcode size={20} />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Show UPI QR Standee</div>
                      <div className="text-xs text-blue-800/80 dark:text-blue-200/80">
                        {!upiId ? '⚠️ Configure shop UPI ID in Settings' : `Customer scans with PhonePe, GPay, Paytm to pay ${fmt(grandTotal)}`}
                      </div>
                    </div>
                  </div>
                  <IconArrowRight size={18} className="text-blue-600 shrink-0" />
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--muted)] mb-1 block">Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 font-mono text-sm font-semibold text-[var(--ink)]"
                      value={payment.amount}
                      onChange={e => setPayment(x => ({ ...x, amount: e.target.value, autoAmount: false }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--muted)] mb-1 block">UTR / Transaction Reference</label>
                    <input
                      className="w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
                      placeholder="Optional reference / UTR"
                      value={payment.reference}
                      onChange={e => setPayment(x => ({ ...x, reference: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--muted)] mb-1 block">Payment Status</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition ${
                        payment.status === 'paid'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                      }`}
                      onClick={() => setPayment(x => ({ ...x, status: 'paid' }))}
                    >
                      <IconCircleCheck size={14} /> <span>Paid</span>
                    </button>
                    <button
                      type="button"
                      className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition ${
                        payment.status === 'pending'
                          ? 'border-amber-600 bg-amber-600 text-white'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                      }`}
                      onClick={() => setPayment(x => ({ ...x, status: 'pending' }))}
                    >
                      <IconClock size={14} /> <span>Pending</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {['card', 'online'].includes(payment.method) && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--muted)] mb-1 block">Amount (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 font-mono text-sm font-semibold text-[var(--ink)]"
                      value={payment.amount}
                      onChange={e => setPayment(x => ({ ...x, amount: e.target.value, autoAmount: false }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[var(--muted)] mb-1 block">Approval Code / Reference</label>
                    <input
                      className="w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]"
                      placeholder="Optional authorization / swipe code"
                      value={payment.reference}
                      onChange={e => setPayment(x => ({ ...x, reference: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--muted)] mb-1 block">Payment Status</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition ${
                        payment.status === 'paid'
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                      }`}
                      onClick={() => setPayment(x => ({ ...x, status: 'paid' }))}
                    >
                      <IconCircleCheck size={14} /> <span>Paid</span>
                    </button>
                    <button
                      type="button"
                      className={`flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-bold transition ${
                        payment.status === 'pending'
                          ? 'border-amber-600 bg-amber-600 text-white'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                      }`}
                      onClick={() => setPayment(x => ({ ...x, status: 'pending' }))}
                    >
                      <IconClock size={14} /> <span>Pending</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {payment.method === 'credit' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-bold text-sm text-[var(--ink)]">
                  <IconBook2 size={16} className="text-amber-500" />
                  <span>Credit Sale / Customer Khata Account</span>
                </div>

                {CREDIT_REQUIRES_CUSTOMER && !customer ? (
                  <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
                    <IconAlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>A named customer is required for credit sales. Please select or add a customer in the bill tab.</span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-[var(--muted)]">
                      <span>Customer:</span>
                      <span className="font-semibold text-[var(--ink)]">{customer?.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-[var(--muted)]">
                      <span>Current Ledger Balance:</span>
                      <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                        {fmt(customer?.outstanding_amount || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[var(--muted)]">
                      <span>This Sale (Credit):</span>
                      <span className="font-mono font-semibold text-[var(--ink)]">+{fmt(grandTotal)}</span>
                    </div>
                    <div className="pt-2 border-t border-[var(--line)] flex justify-between items-center font-bold">
                      <span className="text-[var(--ink)]">New Ledger Balance:</span>
                      <span className="font-mono text-sm text-rose-600 dark:text-rose-400">
                        {fmt(Number(customer?.outstanding_amount || 0) + Number(grandTotal || 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {payment.method === 'razorpay' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 font-semibold text-sm text-blue-600 dark:text-blue-400">
                  <IconWallet size={16} />
                  <span>Razorpay Online Gateway</span>
                </div>
                <p className="text-xs text-[var(--muted)]">
                  Customer will pay {fmt(grandTotal)} securely via UPI, Credit/Debit Cards, NetBanking, or Digital Wallets.
                </p>
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                  ⚠️ The sale will only be finalized once Razorpay confirms payment completion.
                </div>
              </div>
            )}
          </div>

          {/* Validation Warnings */}
          {billIssues.length > 0 && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300">
              <div className="font-bold mb-1">Please address before completing sale:</div>
              <ul className="list-disc pl-4 space-y-0.5">
                {billIssues.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
        </div>
      </Modal>

      {/* ============================ MODALS ============================ */}
      <Modal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        title="Add New Customer"
        subtitle="Quickly register customer details for this invoice"
        size="sm"
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <button
              type="button"
              className="min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
              onClick={() => setShowCustomerModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="min-h-[44px] rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition disabled:opacity-50"
              onClick={addCustomer}
              disabled={addingCustomer}
            >
              {addingCustomer ? 'Adding…' : 'Add Customer'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1 block" htmlFor="pb-nc-name">
              Full Name *
            </label>
            <input
              id="pb-nc-name"
              className="w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--ink)] focus:border-emerald-500 focus:outline-none"
              autoFocus
              autoComplete="name"
              placeholder="e.g. Rajesh Kumar"
              value={newCustomer.name}
              onChange={e => setNewCustomer(x => ({ ...x, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1 block" htmlFor="pb-nc-mobile">
              Mobile Number
            </label>
            <input
              id="pb-nc-mobile"
              className="w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--ink)] focus:border-emerald-500 focus:outline-none"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              value={newCustomer.mobile}
              onChange={e => setNewCustomer(x => ({ ...x, mobile: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1 block" htmlFor="pb-nc-email">
              Email Address <span className="font-normal normal-case text-[var(--muted)]">(optional)</span>
            </label>
            <input
              id="pb-nc-email"
              className="w-full min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--ink)] focus:border-emerald-500 focus:outline-none"
              type="email"
              autoComplete="email"
              placeholder="customer@example.com"
              value={newCustomer.email}
              onChange={e => setNewCustomer(x => ({ ...x, email: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={() => {
          setCart([])
          setShowClearConfirm(false)
          searchRef.current?.focus()
        }}
        title="Clear Current Bill?"
        message={`Are you sure you want to remove all ${cart.length} item${cart.length === 1 ? '' : 's'} from this bill? This cannot be undone.`}
        confirmText="Clear Cart"
        cancelText="Keep Items"
        isDestructive={true}
      />

      <Modal open={showDrafts} onClose={() => setShowDrafts(false)} title="Draft Bills" subtitle={`${drafts.length} parked bill${drafts.length === 1 ? '' : 's'}`} size="md">
        <div className="space-y-3">
          {drafts.length === 0 ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-6 text-center text-sm text-[var(--muted)]">
              No draft bills saved. Use “Save Draft” during checkout to park a bill and resume it anytime.
            </div>
          ) : drafts.map(d => {
            const draftTotal = (d.cart || []).reduce((s, i) => s + Number(i.total || 0), 0)
            return (
              <div key={d.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3.5">
                <div>
                  <div className="font-bold text-sm text-[var(--ink)]">{d.customerName || 'Walk-in Customer'}</div>
                  <div className="text-xs text-[var(--muted)] mt-0.5">
                    {new Date(d.savedAt).toLocaleString('en-IN')} · {(d.cart || []).length} item(s) · Total {fmt(draftTotal)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="min-h-[38px] flex-1 sm:flex-initial rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
                    onClick={() => resumeDraft(d)}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    className="min-h-[38px] flex-1 sm:flex-initial rounded-lg border border-rose-300 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 px-3.5 py-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition"
                    onClick={() => deleteDraft(d.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      {/* ============================ DEDICATED SALE COMPLETED SCREEN (Simple, Informative & Mobile-Friendly) ============================ */}
      <Modal open={showSuccess && Boolean(lastInvoice?.id)} onClose={() => setShowSuccess(false)} title="" size="sm">
        <div className="pb-sale-success max-h-[85vh] overflow-y-auto pr-0.5 text-center py-1 space-y-3">
          {/* Payment Completed Visual Animation & Settlement Header */}
          <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-50/70 to-white dark:from-emerald-950/30 dark:to-slate-900 p-3 shadow-2xs">
            <div className="flex flex-col items-center justify-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/30">
                <IconCheck size={24} strokeWidth={3} />
              </div>
              <h3 className="mt-1.5 text-sm font-black text-emerald-800 dark:text-emerald-300">Sale Completed!</h3>
              <div className="font-mono text-2xl font-black text-[var(--ink)] mt-0.5">
                {fmt(Number(lastInvoice?.grand_total || 0))}
              </div>
              <div className="text-[11px] text-[var(--muted)] font-mono font-medium">
                {lastInvoice?.invoice_number || `INV-${lastInvoice?.id || ''}`}
              </div>
            </div>
          </div>

          {/* Informative Invoice Breakdown Details */}
          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800/90 bg-[var(--surface)] p-3 space-y-2 text-left text-xs shadow-2xs">
            <div className="flex items-center justify-between pb-1.5 border-b border-[var(--line-subtle)]">
              <span className="text-[var(--muted)] font-medium">Customer:</span>
              <span className="font-semibold text-[var(--ink)] truncate max-w-[190px]">
                {lastInvoice?.customer_name || lastInvoice?.customer?.name || 'Walk-in Customer'}
                {lastInvoice?.customer_phone ? ` (${lastInvoice.customer_phone})` : ''}
              </span>
            </div>

            <div className="flex items-center justify-between pb-1.5 border-b border-[var(--line-subtle)]">
              <span className="text-[var(--muted)] font-medium">Payment Mode & Status:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold uppercase text-[var(--ink)]">
                  {lastInvoice?.payment_method || 'Cash'}
                </span>
                <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  {lastInvoice?.payment_status || 'PAID'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)] font-medium">Total Items Billed:</span>
              <span className="font-mono font-semibold text-[var(--ink)]">
                {Array.isArray(lastInvoice?.items) ? lastInvoice.items.length : cart.length} item{cart.length === 1 ? '' : 's'} ({totalQty} units)
              </span>
            </div>
          </div>

          {/* Cash Change Banner if applicable */}
          {String(lastInvoice?.payment_method || '').toLowerCase() === 'cash' &&
            Number(lastInvoice?.amount_received || 0) > Number(lastInvoice?.grand_total || 0) && (
              <div className="flex items-center justify-between rounded-xl border border-amber-300/80 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/40 px-3.5 py-2 text-amber-900 dark:text-amber-200 shadow-2xs">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <span>💵</span>
                  <span>Change to Return:</span>
                </span>
                <span className="font-mono text-base font-black text-amber-800 dark:text-amber-300 tabular-nums">
                  {fmt(Math.max(0, Number(lastInvoice?.amount_received || 0) - Number(lastInvoice?.grand_total || 0)))}
                </span>
              </div>
            )}

          {/* Balance Due Banner if partially paid or credit */}
          {Number(lastInvoice?.balance_due || 0) > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-rose-300/80 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/40 px-3.5 py-2 text-rose-900 dark:text-rose-200 shadow-2xs">
              <span className="text-xs font-bold flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Pending Balance Due:</span>
              </span>
              <span className="font-mono text-base font-black text-rose-700 dark:text-rose-300 tabular-nums">
                {fmt(lastInvoice.balance_due)}
              </span>
            </div>
          )}

          {/* 4 Touch-Friendly Uniform Action Buttons (2x2 Grid) */}
          <div className="grid grid-cols-2 gap-2 text-left">
            <button
              type="button"
              onClick={() => printInvoiceDocument(lastInvoice?.id, false)}
              className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--surface)] px-2.5 text-xs font-bold text-[var(--ink)] transition hover:border-[#1E3A5F]/40 hover:bg-[var(--surface-hover)] active:scale-[0.98] shadow-2xs"
            >
              <IconPrinter size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Print A4</span>
            </button>
            <button
              type="button"
              onClick={() => printInvoiceDocument(lastInvoice?.id, true)}
              className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--surface)] px-2.5 text-xs font-bold text-[var(--ink)] transition hover:border-slate-400 hover:bg-[var(--surface-hover)] active:scale-[0.98] shadow-2xs"
            >
              <IconReceipt size={15} className="text-slate-600 dark:text-slate-300 shrink-0" />
              <span>Thermal Slip</span>
            </button>
            <button
              type="button"
              onClick={() => shareInvoice()}
              className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--surface)] px-2.5 text-xs font-bold text-[var(--ink)] transition hover:border-emerald-500/40 hover:bg-[var(--surface-hover)] active:scale-[0.98] shadow-2xs"
              title="Review & Send via WhatsApp"
            >
              <IconBrandWhatsapp size={15} className="text-[#25D366] shrink-0" />
              <span>Review &amp; Send</span>
            </button>
            <button
              type="button"
              onClick={() => downloadInvoiceDocument(lastInvoice?.id)}
              className="flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--surface)] px-2.5 text-xs font-bold text-[var(--ink)] transition hover:border-indigo-500/40 hover:bg-[var(--surface-hover)] active:scale-[0.98] shadow-2xs"
            >
              <IconDownload size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={() => emailInvoice()}
              className="col-span-2 flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[var(--surface)] px-2.5 text-xs font-bold text-[var(--ink)] transition hover:border-sky-500/40 hover:bg-[var(--surface-hover)] active:scale-[0.98] shadow-2xs"
              title="Email Invoice to Customer via SMTP"
            >
              <IconMail size={15} className="text-[#1E3A5F] dark:text-sky-400 shrink-0" />
              <span>Email Invoice (SMTP)</span>
            </button>
          </div>

          {/* Primary "+ Start New Sale" CTA */}
          <button
            type="button"
            onClick={() => {
              setShowSuccess(false)
              startNewBill()
            }}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white text-sm shadow-md shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[0.99]"
          >
            <IconPlus size={18} strokeWidth={2.5} />
            <span>Start New Sale (Enter)</span>
          </button>
        </div>
      </Modal>

      <QrPaymentModal
        open={showQr}
        onClose={() => setShowQr(false)}
        upiId={upiId}
        shopName={settings.upi_merchant_name || shopName}
        invoice={lastInvoice?.invoice_number || 'NEW-BILL'}
        billTotal={grandTotal}
        hasCart={cart.length > 0}
        logoSrc={settings.shop_logo || logoImg || '/logo.png'}
        onPaid={(amount) => {
          setPayment(x => ({ ...x, method: 'upi', amount: amount.toFixed(2), status: 'paid', autoAmount: false }))
          setShowQr(false)
          toast.success(`UPI payment of ${fmt(amount)} marked paid`)
        }}
        onCompleteSale={async (amount, isPrint = false) => {
          const upiPayment = {
            method: 'upi',
            amount: amount.toFixed(2),
            reference: payment.reference || '',
            status: 'paid',
            autoAmount: false,
          }
          setPayment(upiPayment)
          setShowQr(false)
          setMobilePaymentOpen(false)
          await saveBill(isPrint, upiPayment)
        }}
      />

      <WhatsAppShareModal
        open={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        invoice={whatsAppInvoice}
        shopName={settings.shop_name || shopName}
      />

      <RazorpayPaymentModal
        open={showRazorpay}
        onClose={() => setShowRazorpay(false)}
        invoice={lastInvoice}
        amount={grandTotal}
        customerName={customer?.name}
        customerPhone={customer?.mobile}
        onConfirmSale={async (paymentResult) => {
          setShowRazorpay(false)
          setMobilePaymentOpen(false)
          const razorpayPayment = {
            method: 'razorpay',
            amount: grandTotal.toFixed(2),
            reference: paymentResult?.paymentId || '',
            status: 'paid',
            autoAmount: false,
          }
          setPayment(razorpayPayment)
          await saveBill(false, razorpayPayment)
        }}
        onSuccess={async (paymentResult) => {
          // If invoice is already saved (e.g., from an existing invoice retry)
          if (paymentResult?.invoiceId && lastInvoice?.id === paymentResult.invoiceId) {
            setShowRazorpay(false)
            setPayment(x => ({ ...x, method: 'razorpay', status: 'paid' }))
            try {
              const paidInvoice = await invoiceService.getInvoice(paymentResult.invoiceId)
              setLastInvoice(previous => ({
                ...previous,
                ...paidInvoice,
                payment_method: 'razorpay',
                payment_status: 'paid',
                paid_amount: paidInvoice?.paid_amount ?? paidInvoice?.grand_total ?? previous?.grand_total,
                balance_due: paidInvoice?.balance_due ?? 0,
                amount_received: paidInvoice?.paid_amount ?? paidInvoice?.grand_total ?? previous?.grand_total,
              }))
            } catch {
              setLastInvoice(previous => previous && ({
                ...previous,
                payment_method: 'razorpay',
                payment_status: 'paid',
                paid_amount: previous.grand_total,
                balance_due: 0,
                amount_received: previous.grand_total,
              }))
            }
            toast.success('Razorpay payment confirmed — invoice marked paid')
            setShowSuccess(true)
          }
        }}
      />

      <SimpleCalculator open={showCalculator} onClose={() => setShowCalculator(false)} />

      <Modal open={showShortcuts} onClose={() => setShowShortcuts(false)} title="Keyboard shortcuts" size="sm">
        <div className="pb-modal">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 items-center">
            {[
              ['Ctrl + K / F3', 'Focus product search'],
              ['↑ ↓', 'Move through search results'],
              ['F2', 'Focus customer search'],
              ['F4', 'Focus payment section'],
              ['F6', 'Bill discount'],
              ['F8 / Ctrl + Enter', 'Complete sale'],
              ['Ctrl + P / F7', 'Print invoice'],
              ['Ctrl + D / F5', 'Save draft'],
              ['F1', 'New bill screen'],
              ['Esc', 'Close dropdown / dialog'],
            ].map(([key, text]) => (
              <div key={key} className="contents">
                <kbd className="pb-kbd">{key}</kbd>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
