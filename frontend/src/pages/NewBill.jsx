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
import productService from '../features/inventory/api/productService'
import customerService from '../features/customers/api/customerService'
import settingsService from '../features/settings/api/settingsService'
import toast from 'react-hot-toast'
import logoImg from '../assets/logo.png'
import {
  UpiBrandStrip,
  generatePrintStandHtml,
  getUpiBrandRibbonSvg,
} from '../components/UpiLogos'
import './NewBill.css'
import {
  Search, Plus, Minus, Trash2, Printer, Download, RefreshCw, QrCode, Clock,
  Keyboard, CheckCircle2, Share2, X, AlertTriangle, FileText,
  Maximize2, Minimize2, Layers, Receipt,
  Package, Banknote, Smartphone, CreditCard, BookOpen, Wallet,
  User, UserPlus, ShoppingCart,
  MoreVertical, ArrowLeft, ArrowRight, Copy, Check, Sparkles,
} from 'lucide-react'
import { Modal } from '../components/UI'
import { useNavigate } from 'react-router-dom'
import RazorpayPaymentModal from '../features/billing/RazorpayPaymentModal'
import { PAYMENT_METHODS, PAYMENT_STATUS, INVOICE_STATUS } from '../constants'

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
function loadDrafts() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]') } catch { return [] } }
function saveDraftsStore(drafts) { localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)) }

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
  { id: PAYMENT_METHODS.CASH, label: 'Cash', icon: Banknote },
  { id: PAYMENT_METHODS.UPI, label: 'UPI', icon: Smartphone },
  { id: PAYMENT_METHODS.CARD, label: 'Card', icon: CreditCard },
  { id: PAYMENT_METHODS.CREDIT, label: 'Credit', icon: BookOpen },
  { id: PAYMENT_METHODS.RAZORPAY, label: 'Razorpay', icon: Wallet },
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
function CartRow({ item, index, stock, showGst, justAdded, onQty, onDiscount, onRemove }) {
  const gross = item.unit_price * item.qty
  const discountAmount = gross * item.discount_percent / 100
  const basic = gross - discountAmount
  const gst = basic * item.gst_percent / 100
  const overStock = Number.isFinite(stock) && item.qty > stock
  const codes = [item.sku, item.barcode, item.hsn_code ? `HSN ${item.hsn_code}` : ''].filter(Boolean)

  return (
    <tr className={`pb-bill-tr${overStock ? ' pb-tr-warn' : ''}${justAdded ? ' pb-tr-added' : ''}`}>
      <td className="pb-td-bitem">
        <div className="pb-item-name">
          <span className="pb-item-index">{index}. </span>
          <span className="pb-item-title" title={item.product_name}>{item.product_name}</span>
          {codes.length > 0 && <span className="pb-item-code-inline" title={codes.join(' · ')}>{codes[0]}</span>}
        </div>
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
            <Minus size={11} />
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
            <Plus size={11} />
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
          <Trash2 size={13} />
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

      // 2. Load composite brand ribbon SVG (Google Pay, PhonePe, Paytm, UPI - no borders/cards)
      const ribbonSvg = getUpiBrandRibbonSvg({ width: 440, height: 26 })
      const ribbonBlob = new Blob([ribbonSvg], { type: 'image/svg+xml;charset=utf-8' })
      const ribbonUrl = URL.createObjectURL(ribbonBlob)
      const ribbonImg = new Image()
      ribbonImg.crossOrigin = 'anonymous'
      await new Promise((resolve) => {
        ribbonImg.onload = resolve
        ribbonImg.onerror = resolve
        ribbonImg.src = ribbonUrl
      })

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

      // 4. Executive Tabletop Standee Canvas (640 x 900 px)
      const canvasWidth = 640
      const canvasHeight = 900
      const canvas = document.createElement('canvas')
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      const ctx = canvas.getContext('2d')

      // White background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)

      // Outer Standee Border
      ctx.strokeStyle = '#0F2744'
      ctx.lineWidth = 4
      ctx.strokeRect(10, 10, canvasWidth - 20, canvasHeight - 20)

      // Top Navy Header Banner
      const grad = ctx.createLinearGradient(0, 12, 0, 126)
      grad.addColorStop(0, '#0B2240')
      grad.addColorStop(1, '#153860')
      ctx.fillStyle = grad
      ctx.fillRect(12, 12, canvasWidth - 24, 114)

      if (storeLogoImg && storeLogoImg.width) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(canvasWidth / 2 - 22, 20, 44, 44)
        ctx.drawImage(storeLogoImg, canvasWidth / 2 - 20, 22, 40, 40)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(shopName || 'ShopEase POS', canvasWidth / 2, 78)
        ctx.fillStyle = '#38BDF8'
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.fillText('★ SCAN & PAY WITH ANY UPI APP ★', canvasWidth / 2, 102)
      } else {
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(shopName || 'ShopEase POS', canvasWidth / 2, 52)
        ctx.fillStyle = '#38BDF8'
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.fillText('★ SCAN & PAY WITH ANY UPI APP ★', canvasWidth / 2, 88)
      }

      // Brand strip bar with pure official logos (NO borders, NO pill cards, NO text names)
      const ribY = 126
      const ribH = 54
      ctx.fillStyle = '#F8FAFC'
      ctx.fillRect(12, ribY, canvasWidth - 24, ribH)
      ctx.strokeStyle = '#E2E8F0'
      ctx.lineWidth = 1.5
      ctx.strokeRect(12, ribY, canvasWidth - 24, ribH)

      ctx.fillStyle = '#64748B'
      ctx.font = 'bold 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText('ACCEPTED PAYMENT METHODS', canvasWidth / 2, ribY + 14)

      if (ribbonImg.width) {
        const rW = 420
        const rH = 26
        ctx.drawImage(ribbonImg, (canvasWidth - rW) / 2, ribY + 22, rW, rH)
      }
      URL.revokeObjectURL(ribbonUrl)

      // Centered QR Code with Quiet Zone & Frame
      const qrSize = 390
      const qrX = (canvasWidth - qrSize) / 2
      const qrY = ribY + ribH + 24

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24)
      ctx.strokeStyle = '#0F2744'
      ctx.lineWidth = 2.5
      ctx.strokeRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24)

      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)
      URL.revokeObjectURL(svgUrl)

      // Amount Box
      const isFixed = numericAmount > 0
      const amtY = qrY + qrSize + 30
      const amtH = 92
      ctx.fillStyle = isFixed ? '#EFF6FF' : '#F0FDF4'
      ctx.fillRect(28, amtY, canvasWidth - 56, amtH)
      ctx.strokeStyle = isFixed ? '#BFDBFE' : '#BBF7D0'
      ctx.lineWidth = 1.5
      ctx.strokeRect(28, amtY, canvasWidth - 56, amtH)

      ctx.fillStyle = isFixed ? '#1E40AF' : '#15803D'
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(isFixed ? 'AMOUNT PAYABLE' : 'PAYMENT COLLECTION', canvasWidth / 2, amtY + 22)

      ctx.fillStyle = isFixed ? '#1E3A5F' : '#166534'
      ctx.font = isFixed
        ? '900 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        : '800 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(
        isFixed
          ? `₹ ${numericAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : 'Scan & Enter Any Amount',
        canvasWidth / 2,
        amtY + 56
      )

      ctx.fillStyle = '#64748B'
      ctx.font = '600 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(
        isFixed ? `Ref: ${invoice || 'NEW-BILL'} • Instant Payment Confirmation` : 'Zero Extra Fee • Instant Bank Settlement',
        canvasWidth / 2,
        amtY + 79
      )

      // Merchant UPI VPA
      const vpaY = amtY + amtH + 18
      ctx.fillStyle = '#059669'
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText('✔ Verified Merchant UPI VPA', canvasWidth / 2, vpaY)

      ctx.fillStyle = '#0F172A'
      ctx.font = 'bold 15px "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace'
      ctx.fillText(upiId, canvasWidth / 2, vpaY + 24)

      // Standee Base Footer
      ctx.fillStyle = '#0B2240'
      ctx.fillRect(12, canvasHeight - 44, canvasWidth - 24, 32)
      ctx.fillStyle = '#94A3B8'
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText('Bharat QR  •  Powered by NPCI UPI  •  Works with All Indian Banks', canvasWidth / 2, canvasHeight - 28)

      // Format descriptive filename based on amount: e.g. UPI-QR-276.png or UPI-QR-Any-Amount.png
      const amountTag = Number.isInteger(numericAmount) ? String(numericAmount) : numericAmount.toFixed(2)
      const filename = numericAmount > 0 ? `UPI-QR-${amountTag}.png` : 'UPI-QR-Any-Amount.png'

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
      invoice: invoice || 'NEW-BILL',
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
    <Modal open={open} onClose={onClose} title="UPI QR Payment" size="sm">
      <div className="pb-modal pb-stack pb-qr-modal-content">
        {/* Top Header Card */}
        <div className="pb-qr-header-card">
          <div className="pb-qr-shop-title">
            {logoDataUrl ? (
              <img src={logoDataUrl} alt={shopName} className="pb-qr-shop-logo" />
            ) : (
              <Smartphone size={16} className="text-blue-600 shrink-0" />
            )}
            <span className="truncate">{shopName}</span>
            <span className="pb-qr-verified-tag" title="Verified UPI Merchant">
              <CheckCircle2 size={12} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <span>Verified</span>
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
                <AlertTriangle size={13} className="shrink-0" /> Bill total is {fmt(billTotal)}
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
                  <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
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
                <CheckCircle2 size={18} />
                <span>Payment Received — Complete Sale</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onCompleteSale(numericAmount, true)}
                  disabled={!canComplete}
                  className="pb-btn pb-btn-sm"
                >
                  <Printer size={14} />
                  <span>Complete &amp; Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPaid(numericAmount)}
                  disabled={!canComplete}
                  className="pb-btn pb-btn-sm"
                >
                  <CheckCircle2 size={14} />
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
              <CheckCircle2 size={16} /> Payment received — mark paid {numericAmount > 0 ? `(${fmt(numericAmount)})` : ''}
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
              <Download size={13} />
              <span>{downloading ? 'Downloading...' : 'Download QR'}</span>
            </button>
            <button type="button" onClick={print} disabled={!canAct} className="pb-btn pb-btn-sm">
              <Printer size={13} /> Print QR Stand
            </button>
          </div>

          <button type="button" onClick={onClose} className="pb-btn pb-btn-sm w-full">
            Back to Bill
          </button>
        </div>

        <div className="pb-sub text-center text-xs text-slate-500">
          Verify the payment notification in your UPI app or bank before completing.
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
  const [cart, setCart] = useState([])
  const [lastAddedId, setLastAddedId] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerOpen, setCustomerOpen] = useState(false)
  const [payment, setPayment] = useState(INITIAL_PAYMENT)
  const [billDiscountInput, setBillDiscountInput] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastInvoice, setLastInvoice] = useState(null)
  const [drafts, setDrafts] = useState(loadDrafts)

  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
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
      setProducts(Array.isArray(pVal) ? pVal : (Array.isArray(pVal?.items) ? pVal.items : []))
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
            hsn_code: product.hsn_code || '', mrp: Number(product.mrp || product.selling_price),
            unit_price: Number(product.selling_price), qty: 1, discount_percent: 0,
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
    itemTax,
    tax,
    raw,
    roundOff,
    grandTotal,
    taxableAmount,
    totalQty,
    cartItemsTotal,
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
    const token = localStorage.getItem('access_token') || ''
    const params = new URLSearchParams()
    if (token) params.set('token', token)
    if (thermal) params.set('printer', 'thermal')
    const query = params.toString()
    return `${API_BASE_URL}/invoices/${invoiceId}/pdf/${query ? `?${query}` : ''}`
  }

  const openInvoiceDocument = (invoiceId, thermal = false) => {
    if (!invoiceId) {
      toast.error('Complete the sale first')
      return
    }

    const url = getInvoicePdfUrl(invoiceId, thermal)
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win) {
      toast.error('Allow pop-ups to view the invoice')
      return
    }
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
      const token = localStorage.getItem('access_token') || ''
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

  const shareInvoice = async () => {
    if (!lastInvoice) {
      toast.error('Complete the sale first')
      return
    }

    const invoiceNumber = lastInvoice.invoice_number || `INV-${lastInvoice.id}`
    const total = Number(lastInvoice.grand_total || grandTotal || 0)
    const phone = String(
      lastInvoice.customer_phone ||
      lastInvoice.customer?.mobile ||
      ''
    ).replace(/\D/g, '')
    const customerName = lastInvoice.customer_name || lastInvoice.customer?.name || 'Walk-in Customer'
    const items = Array.isArray(lastInvoice.items)
      ? lastInvoice.items
      : cart.map(item => ({
          product_name: item.product_name,
          quantity: item.qty,
          total: item.total,
        }))

    let shortUrl = ''
    try {
      shortUrl = lastInvoice.short_url || await getShortUrl(lastInvoice.id)
    } catch {
      toast.error('Could not prepare the bill link')
      return
    }

    const itemDescription = items.length
      ? items.map(item => `${item.product_name} × ${item.quantity} — ${fmt(item.total)}`).join('\n')
      : 'Bill details are available in the attached PDF.'

    const message =
      `*${shopName}*\n\n` +
      `*Bill / Invoice:* ${invoiceNumber}\n` +
      `Customer: ${customerName}\n\n` +
      `*Items:*\n${itemDescription}\n\n` +
      `*Total: ${fmt(total)}*\n` +
      `Payment: ${(lastInvoice.payment_method || payment.method || 'cash').toUpperCase()}\n` +
      (lastInvoice.notes ? `Notes: ${lastInvoice.notes}\n` : '') +
      `\nThank you for shopping with us! 🙏\n` +
      `We appreciate your business.\n\n` +
      `View your bill:\n${shortUrl}`

    // WhatsApp gets the complete bill description and canonical bill link.
    if (phone) {
      const whatsappPhone = phone.length === 10 ? `91${phone}` : phone
      const waUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`
      const win = window.open(waUrl, '_blank', 'noopener,noreferrer')
      if (!win) toast.error('Allow pop-ups to share through WhatsApp')
      return
    }

    // Native share sheet shares the same canonical bill link.
    if (navigator.share) {
      try {
        await navigator.share({ title: `Bill ${invoiceNumber}`, text: message })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
    }

    const win = window.open(shortUrl, '_blank', 'noopener,noreferrer')
    if (!win) toast.error('Could not open the bill link')
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
  actionsRef.current = { saveBill, saveDraft, printCurrent, focusPayment, navigate, openRazorpayCheckout }
  useEffect(() => {
    const onKey = e => {
      const a = actionsRef.current
      const key = e.key
      const mod = e.ctrlKey || e.metaKey
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
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
  const hasStockInfo = p => {
    const s = p?.current_stock
    return p?.track_stock !== false && !p?.is_service && s !== undefined && s !== null && s !== ''
  }
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
            <ShoppingCart size={17} className="text-blue-600" />
            <span>New Sale</span>
          </div>
          <div className="pb-meta">
            <span>Invoice: <span className="pb-badge-pill">Assigned on save</span></span>
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
            <Layers size={14} />
            <span className="pb-drafts-label">Drafts ({drafts.length})</span>
          </button>
          <button
            type="button"
            className="pb-btn pb-btn-sm pb-desktop-only"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (F1-F10)"
            onClick={() => setShowShortcuts(true)}
          >
            <Keyboard size={14} />
            <span className="pb-hide-sm">Shortcuts</span>
          </button>
          <button
            type="button"
            className="pb-btn pb-btn-sm pb-desktop-only"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
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
              <MoreVertical size={16} />
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
                  <Keyboard size={14} />
                  <span>Shortcuts</span>
                </button>
                <button
                  type="button"
                  className="pb-more-item"
                  role="menuitem"
                  onClick={() => { toggleFullscreen(); setMobileMoreOpen(false) }}
                >
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                </button>
                <button
                  type="button"
                  className="pb-more-item"
                  role="menuitem"
                  onClick={() => { startNewBill(); setMobileMoreOpen(false) }}
                  disabled={saving || (!cart.length && !lastInvoice)}
                >
                  <RefreshCw size={14} />
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
          <AlertTriangle size={14} />
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
          <Package size={14} />
          <span>Catalog ({filtered.length})</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === 'cart'}
          className={`pb-mobile-tab ${mobileTab === 'cart' ? 'active' : ''}`}
          onClick={() => setMobileTab('cart')}
        >
          <ShoppingCart size={14} />
          <span>Active Cart</span>
          <span className={`pb-mobile-cart-badge ${cart.length > 0 ? 'has-items' : ''}`}>
            {cart.length} {cart.length > 0 ? `• ${fmt(grandTotal)}` : ''}
          </span>
        </button>
      </div>

      {/* ============================ 2. MAIN WORKSPACE (45% / 55% SPLIT) ============================ */}
      <main className="pb-workspace">
        {/* ================= PRODUCT SECTION (45% WIDTH) ================= */}
        <section className={`pb-panel pb-products-col ${mobileTab === 'cart' ? 'pb-col-hidden-mobile' : ''}`} aria-label="Products Catalog">
          {/* Prominent Search and Scan Area */}
          <div className="pb-search-area">
            {lastInvoice && (
              <div className="pb-last-bill-strip" aria-label="Last completed bill">
                <div className="pb-last-bill-track">
                  <div className="pb-last-bill-icon">
                    <Receipt size={14} />
                  </div>
                  <div className="pb-last-bill-info">
                    <span className="pb-last-bill-label">Last completed bill</span>
                    <strong>{lastInvoice.invoice_number || `INV-${lastInvoice.id}`}</strong>
                    <span>{fmt(lastInvoice.grand_total)} · {lastInvoice.customer_name || 'Walk-in customer'}</span>
                  </div>
                  <div className="pb-last-bill-actions">
                    <button type="button" onClick={() => printInvoiceDocument(lastInvoice.id, false)} title="Print last bill">
                      <Printer size={12} /> <span>Print</span>
                    </button>
                    <button type="button" onClick={() => printInvoiceDocument(lastInvoice.id, true)} title="Print thermal last bill">
                      <span>Thermal</span>
                    </button>
                    <button type="button" onClick={shareInvoice} title="Share last bill">
                      <Share2 size={12} /> <span>Share</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="pb-search-field">
              <Search size={18} className="pb-field-icon" />
              <input
                id="pb-search"
                ref={searchRef}
                className="pb-search-input"
                placeholder="Search product name, SKU or scan barcode (Ctrl+K)"
                value={search}
                onClick={() => setSearchActive(true)}
                onBlur={() => setTimeout(() => setSearchActive(false), 180)}
                onChange={e => { setSearch(e.target.value); setSearchActive(true); setActiveIdx(-1) }}
                onKeyDown={onSearchKeyDown}
                role="combobox"
                aria-expanded={searchActive}
                aria-controls="pb-search-list"
                aria-autocomplete="list"
                autoFocus
                inputMode="search"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              {search ? (
                <button
                  type="button"
                  className="pb-search-clear"
                  aria-label="Clear search"
                  title="Clear search"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { setSearch(''); setActiveIdx(-1); setSearchActive(true); searchRef.current?.focus() }}
                >
                  <X size={16} />
                </button>
              ) : null}
              <span className="pb-kbd-hint">Ctrl+K</span>

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
                                <Plus size={12} /> {isOut(p) ? 'Out' : 'Add'}
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
                                <Plus size={12} /> {isOut(p) ? 'Out' : 'Add'}
                              </button>
                            </div>
                          </div>
                        )) : <div className="pb-dd-empty">No recommendations available.</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

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
                        <Package size={28} className="pb-text-muted" />
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
                            {[p.category_name, p.unit, p.barcode ? `Bar: ${p.barcode}` : ''].filter(Boolean).join(' · ')}
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
                            {out ? 'Out' : stockLabel(p)}
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
                            <Plus size={13} />
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
                        <Package size={28} className="pb-text-muted" />
                        <div className="pb-strong">No products found</div>
                        <div className="pb-sub">Try a different search query or category filter.</div>
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
                <ShoppingCart size={16} className="text-blue-600" />
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
                  <Trash2 size={13} />
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
                  <User size={14} className="text-blue-600" />
                  <span className="pb-cust-selected-name">{customer.name}</span>
                  {customer.mobile && <span className="pb-cust-selected-phone">({customer.mobile})</span>}
                  <button
                    type="button"
                    className="pb-cust-remove-btn"
                    title="Change to Walk-in Customer"
                    onClick={() => { setCustomer(null); setCustomerSearch('') }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="pb-cust-box">
                  <User size={14} className="pb-field-icon" />
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
                      <X size={13} />
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
              className="pb-btn pb-btn-sm"
              aria-label="Add new customer"
              title="Add new customer"
              onClick={() => setShowCustomerModal(true)}
            >
              <UserPlus size={14} />
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
                      onRemove={removeItem}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="pb-bill-empty-td">
                      <div className="pb-bill-empty-content">
                        <ShoppingCart size={32} className="pb-muted" />
                        <div className="pb-strong">No items added</div>
                        <div className="pb-sub">Search or scan a product to start the bill.</div>
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
                <ArrowRight size={16} />
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
                    className="pb-btn pb-btn-sm"
                    onClick={openQuickPayment}
                    disabled={grandTotal <= 0 || !cart.length}
                    title={!upiId ? 'Configure shop UPI ID in Settings' : 'Show UPI QR Code'}
                  >
                    <QrCode size={14} /> Show QR
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
                        <CheckCircle2 size={12} />
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
                        <Clock size={12} />
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
                        <CheckCircle2 size={12} />
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
                        <Clock size={12} />
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

          {/* Bottom Row: Secondary Actions + Single Large Green Complete Sale Action */}
          <div className="pb-dock-actions-row">
            <div className="pb-dock-left-actions">
              <button
                type="button"
                className="pb-btn-dock"
                title="Save as Draft (Ctrl+D / F5)"
                onClick={saveDraft}
                disabled={saving || !cart.length}
              >
                <Layers size={14} />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                className="pb-btn-dock"
                title={!upiId ? 'Configure shop UPI ID in Settings' : 'Quick QR for UPI collection'}
                onClick={openQuickPayment}
                disabled={grandTotal <= 0 || !cart.length}
              >
                <QrCode size={14} />
                <span>Quick QR</span>
              </button>
              {payment.method !== 'razorpay' && (
                <button
                  type="button"
                  className="pb-btn-dock"
                  title="Complete Sale &amp; Print Bill (Ctrl+P / F7)"
                  onClick={() => saveBill(true)}
                  disabled={!canAttemptComplete}
                >
                  <Printer size={14} />
                  <span>Complete &amp; Print</span>
                </button>
              )}
              <button
                type="button"
                className="pb-btn-dock pb-btn-danger"
                title="Clear all cart items"
                onClick={() => setShowClearConfirm(true)}
                disabled={!cart.length}
              >
                <Trash2 size={14} />
                <span>Clear</span>
              </button>
              <button
                type="button"
                className="pb-btn-dock"
                title="Start a fresh bill (F1)"
                onClick={startNewBill}
                disabled={saving || (!cart.length && !lastInvoice)}
              >
                <RefreshCw size={14} />
                <span>New Bill</span>
              </button>
            </div>

            {/* Primary Action: Pay with Razorpay OR Complete Sale */}
            {payment.method === 'razorpay' ? (
              <button
                type="button"
                className="pb-btn-razorpay-pay"
                title={canAttemptComplete ? `Pay ${fmt(grandTotal)} with Razorpay` : completeTitle}
                onClick={openRazorpayCheckout}
                disabled={!canAttemptComplete}
              >
                <CreditCard size={18} />
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
                <CheckCircle2 size={18} />
                <span>{saving ? 'Processing…' : `✓ COMPLETE SALE · ${fmt(grandTotal)}`}</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Floating Mobile Cart Bar when viewing Catalog */}
      {cart.length > 0 && mobileTab === 'catalog' && !mobilePaymentOpen && (
        <aside className="pb-mobile-floating-dock" aria-label="Quick cart bar">
          <div className="pb-floating-info">
            <div className="pb-floating-qty">
              <ShoppingCart size={15} />
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
              setMobileTab('cart')
              setMobilePaymentOpen(true)
            }}
          >
            View Cart &amp; Pay →
          </button>
        </aside>
      )}

      {/* ============================ MOBILE PAYMENT BOTTOM SHEET ============================ */}
      {mobilePaymentOpen && (
        <div className="pb-mobile-only pb-mobile-sheet-overlay" onClick={() => setMobilePaymentOpen(false)}>
          <div
            className="pb-mobile-sheet-content"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Payment and Checkout"
          >
            {/* Sheet Handle & Header */}
            <div className="pb-mobile-sheet-header">
              <div className="pb-mobile-sheet-handle" />
              <div className="pb-mobile-sheet-title-bar">
                <button
                  type="button"
                  className="pb-mobile-sheet-back-btn"
                  onClick={() => setMobilePaymentOpen(false)}
                  aria-label="Back to bill"
                >
                  <ArrowLeft size={16} />
                  <span>Back to Bill</span>
                </button>
                <span className="pb-mobile-sheet-heading">Payment</span>
                <button
                  type="button"
                  className="pb-mobile-sheet-close-btn"
                  onClick={() => setMobilePaymentOpen(false)}
                  aria-label="Close payment"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Grand Total Banner at Top */}
              <div className="pb-mobile-sheet-total-banner">
                <div className="pb-mobile-sheet-total-label">Grand Total to Collect</div>
                <div className="pb-mobile-sheet-total-val">{fmt(grandTotal)}</div>
                <div className="pb-mobile-sheet-total-meta">
                  {cart.length} {cart.length === 1 ? 'item' : 'items'} ({totalQty} units)
                  {customer ? ` · ${customer.name}` : ' · Walk-in Customer'}
                </div>
              </div>
            </div>

            {/* Sheet Scrollable Body */}
            <div className="pb-mobile-sheet-body">
              {/* Payment Methods Selector */}
              <div className="pb-mobile-methods-label">Payment Method</div>
              <div className="pb-mobile-methods-grid" role="radiogroup" aria-label="Payment method">
                {PAYMENT_METHOD_OPTIONS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={payment.method === id}
                    className={`pb-mobile-method-chip${payment.method === id ? ' active' : ''}`}
                    onClick={() => selectPayment(id)}
                  >
                    <Icon size={15} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* Method-specific Form Controls */}
              <div className="pb-mobile-sheet-context">
                {payment.method === 'cash' && (
                  <div className="pb-mobile-cash-panel">
                    <label className="pb-mobile-field-label" htmlFor="pb-mobile-cash">Cash Received (₹)</label>
                    <div className="pb-mobile-money-input-wrap">
                      <span className="pb-curr-sym">₹</span>
                      <input
                        id="pb-mobile-cash"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className="pb-mobile-cash-input"
                        value={payment.amount}
                        placeholder={grandTotal > 0 ? grandTotal.toFixed(2) : '0.00'}
                        onChange={e => setPayment(x => ({ ...x, amount: e.target.value, status: 'paid', autoAmount: false }))}
                      />
                    </div>

                    {/* Quick Cash Chips */}
                    <div className="pb-mobile-cash-chips">
                      <button type="button" className="pb-mobile-chip pb-mobile-chip-exact" onClick={setExactCash}>
                        Exact
                      </button>
                      {CASH_CHIPS.map(v => (
                        <button key={v} type="button" className="pb-mobile-chip" onClick={() => addCashChip(v)}>
                          +{v}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="pb-mobile-chip"
                        onClick={() => setPayment(x => ({ ...x, amount: grandTotal > 0 ? grandTotal.toFixed(2) : '', autoAmount: true }))}
                      >
                        Reset
                      </button>
                    </div>

                    {/* Change / Due Feedback */}
                    <div className={`pb-mobile-cash-feedback ${cashShort ? 'is-due' : 'is-change'}`}>
                      {cashShort ? (
                        <>
                          <span className="pb-feedback-label">Balance Due:</span>
                          <span className="pb-feedback-val pb-text-red">{fmt(cashBalanceDue)}</span>
                        </>
                      ) : (
                        <>
                          <span className="pb-feedback-label">Change to Return:</span>
                          <span className="pb-feedback-val pb-text-green">{fmt(cashChange)}</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {payment.method === 'upi' && (
                  <div className="pb-mobile-upi-panel">
                    <div className="pb-mobile-qr-hero">
                      <button
                        type="button"
                        className="pb-mobile-qr-launch-btn"
                        onClick={openQuickPayment}
                        disabled={grandTotal <= 0}
                      >
                        <div className="pb-qr-launch-icon">
                          <QrCode size={22} />
                        </div>
                        <div className="pb-qr-launch-info">
                          <span className="pb-qr-launch-title">Show UPI QR to Customer</span>
                          <span className="pb-qr-launch-sub">
                            {!upiId
                              ? '⚠️ Configure shop UPI ID in Settings'
                              : `Customer scans with any UPI app to pay ${fmt(grandTotal)}`}
                          </span>
                        </div>
                        <ArrowRight size={18} className="pb-qr-launch-arrow" />
                      </button>
                    </div>

                    <div className="pb-mobile-field-group">
                      <label className="pb-mobile-field-label">Amount (₹)</label>
                      <div className="pb-mobile-money-input-wrap">
                        <span className="pb-curr-sym">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="pb-mobile-cash-input"
                          value={payment.amount}
                          onChange={e => setPayment(x => ({ ...x, amount: e.target.value, autoAmount: false }))}
                        />
                      </div>
                    </div>

                    <div className="pb-mobile-field-group">
                      <label className="pb-mobile-field-label">UTR / Transaction Reference</label>
                      <input
                        className="pb-mobile-text-input"
                        placeholder="Optional reference / UTR"
                        value={payment.reference}
                        onChange={e => setPayment(x => ({ ...x, reference: e.target.value }))}
                      />
                    </div>

                    <div className="pb-mobile-field-group">
                      <label className="pb-mobile-field-label">Payment Status</label>
                      <div className="pb-mobile-status-toggle">
                        <button
                          type="button"
                          className={`pb-mobile-status-btn ${payment.status === 'paid' ? 'active' : ''}`}
                          onClick={() => setPayment(x => ({ ...x, status: 'paid' }))}
                        >
                          <CheckCircle2 size={14} /> <span>Paid</span>
                        </button>
                        <button
                          type="button"
                          className={`pb-mobile-status-btn ${payment.status === 'pending' ? 'active' : ''}`}
                          onClick={() => setPayment(x => ({ ...x, status: 'pending' }))}
                        >
                          <Clock size={14} /> <span>Pending</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {['card', 'online'].includes(payment.method) && (
                  <div className="pb-mobile-card-panel">
                    <div className="pb-mobile-field-group">
                      <label className="pb-mobile-field-label">Amount (₹)</label>
                      <div className="pb-mobile-money-input-wrap">
                        <span className="pb-curr-sym">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="pb-mobile-cash-input"
                          value={payment.amount}
                          onChange={e => setPayment(x => ({ ...x, amount: e.target.value, autoAmount: false }))}
                        />
                      </div>
                    </div>

                    <div className="pb-mobile-field-group">
                      <label className="pb-mobile-field-label">Approval Code / Reference</label>
                      <input
                        className="pb-mobile-text-input"
                        placeholder="Optional approval code"
                        value={payment.reference}
                        onChange={e => setPayment(x => ({ ...x, reference: e.target.value }))}
                      />
                    </div>

                    <div className="pb-mobile-field-group">
                      <label className="pb-mobile-field-label">Payment Status</label>
                      <div className="pb-mobile-status-toggle">
                        <button
                          type="button"
                          className={`pb-mobile-status-btn ${payment.status === 'paid' ? 'active' : ''}`}
                          onClick={() => setPayment(x => ({ ...x, status: 'paid' }))}
                        >
                          <CheckCircle2 size={14} /> <span>Paid</span>
                        </button>
                        <button
                          type="button"
                          className={`pb-mobile-status-btn ${payment.status === 'pending' ? 'active' : ''}`}
                          onClick={() => setPayment(x => ({ ...x, status: 'pending' }))}
                        >
                          <Clock size={14} /> <span>Pending</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {payment.method === 'credit' && (
                  <div className="pb-mobile-credit-panel">
                    <div className="font-semibold text-sm">Credit Sale / Account Khata</div>
                    {CREDIT_REQUIRES_CUSTOMER && !customer ? (
                      <div className="pb-note pb-note-warn mt-2">
                        <AlertTriangle size={14} />
                        <span>A named customer is required for credit sales. Please select or add a customer in the bill tab.</span>
                      </div>
                    ) : (
                      <div className="pb-sub mt-1">This sale will be recorded against {customer?.name || 'the customer'}'s credit ledger.</div>
                    )}
                  </div>
                )}

                {payment.method === 'razorpay' && (
                  <div className="pb-mobile-razorpay-panel">
                    <div className="flex items-center gap-2 font-semibold text-sm text-blue-600 dark:text-blue-400">
                      <CreditCard size={16} />
                      <span>Razorpay Online Gateway</span>
                    </div>
                    <div className="pb-sub mt-1">
                      Customer pays {fmt(grandTotal)} via UPI, Cards, NetBanking, or Wallets.
                    </div>
                    <div className="dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-900/50">
                      ⚠️ Sale will be confirmed only after online payment succeeds.
                    </div>
                  </div>
                )}
              </div>

              {/* Validation errors in bottom sheet if any */}
              {billIssues.length > 0 && (
                <ul className="pb-errors mt-2" role="alert">
                  {billIssues.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              )}
            </div>

            {/* Sheet Footer with Razorpay Pay OR Complete Sale Action */}
            <div className="pb-mobile-sheet-footer">
              <div className="pb-mobile-sheet-actions-grid">
                {payment.method !== 'razorpay' && (
                  <button
                    type="button"
                    className="pb-mobile-sheet-btn-secondary"
                    onClick={() => saveBill(true)}
                    disabled={!canAttemptComplete}
                  >
                    <Printer size={15} />
                    <span>Complete &amp; Print</span>
                  </button>
                )}
                <button
                  type="button"
                  className={`pb-mobile-sheet-btn-secondary ${payment.method === 'razorpay' ? 'col-span-2' : ''}`}
                  onClick={saveDraft}
                  disabled={saving || !cart.length}
                >
                  <Layers size={15} />
                  <span>Save Draft</span>
                </button>
              </div>

              {payment.method === 'razorpay' ? (
                <button
                  type="button"
                  className="pb-mobile-sheet-razorpay-btn"
                  title={canAttemptComplete ? `Pay ${fmt(grandTotal)} with Razorpay` : completeTitle}
                  onClick={() => {
                    setMobilePaymentOpen(false)
                    openRazorpayCheckout()
                  }}
                  disabled={!canAttemptComplete}
                >
                  <CreditCard size={18} />
                  <span>{saving ? 'Processing…' : `Pay with Razorpay · ${fmt(grandTotal)}`}</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="pb-mobile-sheet-complete-btn"
                  title={completeTitle}
                  onClick={() => saveBill(false)}
                  disabled={!canAttemptComplete}
                >
                  <CheckCircle2 size={18} />
                  <span>{saving ? 'Processing Sale…' : `Complete Sale · ${fmt(grandTotal)}`}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================ MODALS ============================ */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Add new customer" size="sm">
        <div className="pb-modal pb-stack">
          <div>
            <label className="pb-label" htmlFor="pb-nc-name">Name *</label>
            <input id="pb-nc-name" className="pb-input" autoFocus value={newCustomer.name} onChange={e => setNewCustomer(x => ({ ...x, name: e.target.value }))} />
          </div>
          <div>
            <label className="pb-label" htmlFor="pb-nc-mobile">Mobile</label>
            <input id="pb-nc-mobile" className="pb-input" inputMode="tel" value={newCustomer.mobile} onChange={e => setNewCustomer(x => ({ ...x, mobile: e.target.value }))} />
          </div>
          <div>
            <label className="pb-label" htmlFor="pb-nc-email">Email</label>
            <input id="pb-nc-email" className="pb-input" type="email" value={newCustomer.email} onChange={e => setNewCustomer(x => ({ ...x, email: e.target.value }))} />
          </div>
          <div className="pb-grid2">
            <button type="button" className="pb-btn" onClick={() => setShowCustomerModal(false)}>Cancel</button>
            <button type="button" className="pb-btn pb-btn-primary" onClick={addCustomer} disabled={addingCustomer}>{addingCustomer ? 'Adding…' : 'Add customer'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={showClearConfirm} onClose={() => setShowClearConfirm(false)} title="Clear cart?" size="sm">
        <div className="pb-modal pb-stack">
          <p className="m-0">Remove all {cart.length} item{cart.length === 1 ? '' : 's'} from this bill? This cannot be undone.</p>
          <div className="pb-grid2">
            <button type="button" className="pb-btn" onClick={() => setShowClearConfirm(false)}>Cancel</button>
            <button type="button" className="pb-btn pb-btn-primary" onClick={() => { setCart([]); setShowClearConfirm(false); searchRef.current?.focus() }}>Clear Cart</button>
          </div>
        </div>
      </Modal>

      <Modal open={showDrafts} onClose={() => setShowDrafts(false)} title="Draft bills" size="md">
        <div className="pb-modal">
          {drafts.length === 0 ? (
            <p className="pb-sub m-0">No draft bills saved. Use “Save Draft” to park a bill and resume it later.</p>
          ) : drafts.map(d => {
            const draftTotal = (d.cart || []).reduce((s, i) => s + Number(i.total || 0), 0)
            return (
              <div key={d.id} className="pb-draft">
                <div>
                  <div className="pb-strong">{d.customerName || 'Walk-in Customer'}</div>
                  <div className="pb-sub">
                    {new Date(d.savedAt).toLocaleString('en-IN')} | {(d.cart || []).length} item(s) | Items total {fmt(draftTotal)}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" className="pb-btn pb-btn-sm pb-btn-primary" onClick={() => resumeDraft(d)}>Resume</button>
                  <button type="button" className="pb-btn pb-btn-sm pb-btn-danger" onClick={() => deleteDraft(d.id)}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      <Modal open={showSuccess && Boolean(lastInvoice?.id)} onClose={() => setShowSuccess(false)} title="Sale completed" size="sm">
        <div className="pb-modal pb-stack">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center dark:border-emerald-800/60 dark:bg-emerald-950/30">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/25">
              <CheckCircle2 size={32} />
            </div>
            <p className="mt-3 text-lg font-extrabold text-emerald-800 dark:text-emerald-200">Sale completed successfully</p>
            <div className="mt-1 font-mono text-2xl font-extrabold text-[var(--ink)]">{fmt(lastInvoice?.grand_total)}</div>
            <div className="mt-2 break-all font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
              Invoice {lastInvoice?.invoice_number || '—'}
            </div>
          </div>
          <dl className="pb-dl border-t border-[var(--pb-border)] pt-2">
            <dt>Invoice number</dt><dd>{lastInvoice?.invoice_number || '—'}</dd>
            <dt>Payment method</dt><dd className="capitalize">{lastInvoice?.payment_method || 'cash'}</dd>
            <dt>Payment status</dt><dd className="capitalize">{lastInvoice?.payment_status || '—'}</dd>
            <dt>Paid amount</dt><dd>{fmt(lastPaidAmount(lastInvoice))}</dd>
            {lastInvoice?.payment_method === 'cash' && (
              <>
                <dt>Change returned</dt>
                <dd>{fmt(Math.max(0, Number(lastInvoice?.amount_received || 0) - Number(lastInvoice?.grand_total || 0)))}</dd>
              </>
            )}
          </dl>
          <div className="grid grid-cols-2 gap-2 pb-success-actions-grid">
            <button type="button" className="pb-btn pb-btn-primary" onClick={() => printInvoiceDocument(lastInvoice?.id, false)}><Printer size={14} /> Print invoice</button>
            <button type="button" className="pb-btn" onClick={() => printInvoiceDocument(lastInvoice?.id, true)}><Printer size={14} /> Thermal Print</button>
            <button type="button" className="pb-btn" onClick={() => downloadInvoiceDocument(lastInvoice?.id)}><Download size={14} /> Download PDF</button>
            <button type="button" className="pb-btn" onClick={shareInvoice}><Share2 size={14} /> Share Bill</button>
            <button type="button" className="pb-btn col-span-2" onClick={() => navigate(`/invoice/${lastInvoice?.id}`)}><FileText size={14} /> View Invoice</button>
          </div>
          <button type="button" className="pb-btn pb-btn-primary pb-btn-lg w-full" onClick={() => { setShowSuccess(false); startNewBill() }}>
            <RefreshCw size={14} /> Start New Bill
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