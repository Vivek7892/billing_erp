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
import './NewBill.css'
import {
  Search, Plus, Minus, Trash2, Printer, Download, RefreshCw, QrCode,
  Keyboard, CheckCircle2, Share2, X, AlertTriangle, FileText,
  Maximize2, Minimize2, Layers,
  Package, Banknote, Smartphone, CreditCard, BookOpen, Wallet,
  User, UserPlus, ShoppingCart,
} from 'lucide-react'
import { Modal } from '../components/UI'
import { useNavigate } from 'react-router-dom'
import RazorpayPaymentModal from '../features/billing/RazorpayPaymentModal'

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
  const params = new URLSearchParams({ pa: upiId || '', pn: name || 'Dreamwithtech', am: Number(amount || 0).toFixed(2), cu: 'INR', tn: invoice })
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

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'credit', label: 'Credit', icon: BookOpen },
  { id: 'razorpay', label: 'Razorpay', icon: Wallet },
]
const CASH_CHIPS = [50, 100, 200, 500, 1000, 2000]
const QR_PRESETS = [100, 200, 500, 1000, 2000]
const INITIAL_PAYMENT = { method: 'cash', amount: '', reference: '', status: 'pending', autoAmount: false }

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
// ---------------------------------------------------------------------------
function CartRow({ item, index, stock, showGst, justAdded, onQty, onDiscount, onRemove }) {
  const gross = item.unit_price * item.qty
  const discountAmount = gross * item.discount_percent / 100
  const basic = gross - discountAmount
  const gst = basic * item.gst_percent / 100
  const overStock = Number.isFinite(stock) && item.qty > stock
  const codes = [item.sku, item.barcode, item.hsn_code ? `HSN ${item.hsn_code}` : ''].filter(Boolean)

  return (
    <li className={`pb-item${overStock ? ' pb-item-warn' : justAdded ? ' pb-item-added' : ''}`}>
      <div className="pb-item-top">
        <span className="pb-item-no">{index}</span>
        <div className="pb-item-info">
          <div className="pb-item-name">{item.product_name}</div>
          {codes.length ? <div className="pb-sub">{codes.join(' | ')}</div> : null}
        </div>
        <div className="pb-item-total">{fmt(item.total)}</div>
        <button type="button" className="pb-icon-btn pb-icon-danger" aria-label={`Remove ${item.product_name}`} title="Remove item" onClick={() => onRemove(item.id)}>
          <Trash2 size={15} />
        </button>
      </div>

      <div className="pb-item-mid">
        <div className="pb-qtywrap">
          <div className="pb-qty">
            <button type="button" aria-label={`Decrease ${item.product_name} quantity`} onClick={() => onQty(item.id, item.qty - 1)}>
              <Minus size={14} />
            </button>
            <BufferedNumber
              aria-label={`${item.product_name} quantity`}
              value={item.qty}
              max={Number.isFinite(stock) ? stock : undefined}
              onClamp={m => toast.error(`Only ${m} in stock`)}
              onCommit={n => onQty(item.id, n)}
            />
            <button type="button" aria-label={`Increase ${item.product_name} quantity`} onClick={() => onQty(item.id, item.qty + 1)}>
              <Plus size={14} />
            </button>
          </div>
          {item.unit ? <span className="pb-unit">{item.unit}</span> : null}
        </div>
        <div className="pb-item-price">
          <span className="pb-strong">{fmt(item.unit_price)}</span> <span className="pb-sub">each</span>
          {item.mrp && Number(item.mrp) > item.unit_price ? <div className="pb-sub">MRP {fmt(item.mrp)}</div> : null}
        </div>
      </div>

      <div className="pb-item-meta">
        <label className="pb-disc">
          <span>Disc</span>
          <BufferedNumber
            aria-label={`${item.product_name} discount percent`}
            allowZero
            max={100}
            value={item.discount_percent}
            onCommit={n => onDiscount(item.id, n)}
          />
          <span>%</span>
        </label>
        {discountAmount > 0 ? <span className="pb-text-red">-{fmt(discountAmount)}</span> : null}
        {showGst && <span>GST {fmt(gst)} ({item.gst_percent}%)</span>}
        {Number.isFinite(stock) && (
          <span className={overStock ? 'pb-text-red pb-strong' : ''}>Available: {stock}</span>
        )}
      </div>
    </li>
  )
}

// ---------------------------------------------------------------------------
// QR payment modal (Quick Pay) — logic unchanged
// ---------------------------------------------------------------------------
function QrPaymentModal({ open, onClose, upiId, shopName, invoice, billTotal, hasCart, onPaid }) {
  const qrRef = useRef(null)
  const [amount, setAmount] = useState('')

  // Reset the amount every time the modal is opened — default to the bill
  // total when a cart exists, otherwise leave it blank for manual entry.
  useEffect(() => {
    if (open) setAmount(billTotal > 0 ? billTotal.toFixed(2) : '')
  }, [open, billTotal])

  const numericAmount = Number(amount) || 0
  const uri = upiUri(upiId, shopName, numericAmount, invoice)
  const differsFromBill = hasCart && billTotal > 0 && Math.abs(numericAmount - billTotal) > 0.004
  const canAct = !!upiId && numericAmount > 0

  const applyPreset = v => setAmount(v.toFixed(2))
  const applyBillTotal = () => setAmount(billTotal.toFixed(2))

  const download = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg) return

    const svgData = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `payment-qr-${invoice || 'new-bill'}.svg`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const print = () => {
    const svg = qrRef.current?.querySelector('svg')
    if (!svg || !canAct) {
      toast.error('Generate a QR before printing')
      return
    }

    // Clone the rendered QR and make it completely self-contained for printing.
    const svgClone = svg.cloneNode(true)
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    svgClone.setAttribute('width', '240')
    svgClone.setAttribute('height', '240')
    svgClone.setAttribute('viewBox', svg.getAttribute('viewBox') || '0 0 240 240')
    const svgMarkup = new XMLSerializer().serializeToString(svgClone)

    const escapeHtml = value => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')

    // Open synchronously from the button click so mobile browsers are less
    // likely to block the print window as a popup.
    const win = window.open('', '_blank', 'width=480,height=760')
    if (!win) {
      toast.error('Allow pop-ups to print the QR')
      return
    }

    const safeShopName = escapeHtml(shopName)
    const safeUpiId = escapeHtml(upiId)
    const safeInvoice = escapeHtml(invoice || 'NEW-BILL')
    const safeAmount = escapeHtml(fmt(numericAmount))

    win.document.open()
    win.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>UPI Payment QR - ${safeInvoice}</title>
  <style>
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#111827}
    body{font-family:Arial,Helvetica,sans-serif;min-height:100vh}
    .page{width:min(100%,480px);margin:0 auto;padding:28px 20px;text-align:center}
    h1{font-size:22px;line-height:1.25;margin:0 0 6px;font-weight:700}
    .subtitle{font-size:14px;color:#475569;margin-bottom:20px}
    .qr{display:flex;justify-content:center;align-items:center;margin:0 auto 18px}
    .qr svg{display:block;width:240px;height:240px;max-width:72vw;max-height:72vw}
    .amount{font-size:30px;font-weight:800;line-height:1.1;margin:10px 0}
    .upi{font-size:14px;color:#475569;word-break:break-all;margin-top:6px}
    .invoice{font-size:12px;color:#64748b;margin-top:8px}
    .hint{font-size:12px;color:#64748b;margin-top:18px}
    @media print{
      @page{size:auto;margin:10mm}
      body{min-height:auto}
      .page{padding:8px 0}
    }
  </style>
</head>
<body>
  <main class="page">
    <h1>${safeShopName}</h1>
    <div class="subtitle">Scan to pay</div>
    <div class="qr">${svgMarkup}</div>
    <div class="amount">${safeAmount}</div>
    <div class="upi">${safeUpiId}</div>
    <div class="invoice">Invoice: ${safeInvoice}</div>
    <div class="hint">Scan this QR using any UPI app</div>
  </main>
</body>
</html>`)
    win.document.close()

    // Give the browser time to parse/layout the inline SVG before print.
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
      <div className="pb-modal pb-stack">
        <div className="pb-note">
          Customer scans this QR with any UPI app. <b>Generating the QR does not confirm payment.</b>
        </div>

        <div>
          <label className="pb-label" htmlFor="pb-qr-amount">Amount to collect (₹)</label>
          <input
            id="pb-qr-amount"
            type="number" min="0" step="0.01" inputMode="decimal"
            className="pb-input pb-input-lg"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
          />
          <div className="pb-chips">
            {hasCart && billTotal > 0 && (
              <button type="button" onClick={applyBillTotal} className="pb-chip">Bill total {fmt(billTotal)}</button>
            )}
            {QR_PRESETS.map(v => (
              <button type="button" key={v} onClick={() => applyPreset(v)} className="pb-chip">
                ₹{v.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        </div>

        {differsFromBill && (
          <div className="pb-note pb-note-warn" role="alert">
            <AlertTriangle size={14} />
            <span>Bill total is <b>{fmt(billTotal)}</b> but this QR is for <b>{fmt(numericAmount)}</b>.</span>
          </div>
        )}

        <div className="pb-c">
          <div ref={qrRef} className="pb-qr-box">
            {numericAmount > 0 ? (
              <QRCodeSVG
                value={uri}
                size={240}
                level="M"
                includeMargin
                bgColor="#ffffff"
                fgColor="#111827"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
            ) : (
              <div className="pb-qr-empty">Enter an amount to generate the QR</div>
            )}
          </div>
        </div>

        <div className="pb-c">
          <div className="pb-qr-amount">{fmt(numericAmount)}</div>
          <div className="pb-strong">{shopName}</div>
          <div className="pb-sub">{upiId || 'UPI ID not configured'}</div>
          <div className="pb-sub">Invoice: {invoice || 'NEW-BILL'}</div>
        </div>

        <div className="pb-grid2">
          <button type="button" onClick={download} disabled={!canAct} className="pb-btn"><Download size={14} /> Download QR</button>
          <button type="button" onClick={print} disabled={!canAct} className="pb-btn"><Printer size={14} /> Print QR</button>
        </div>
        <button
          type="button"
          onClick={() => onPaid(numericAmount)}
          disabled={!canAct}
          className="pb-btn pb-btn-primary pb-btn-lg"
        >
          <CheckCircle2 size={16} /> Payment received — mark paid ({fmt(numericAmount)})
        </button>
        <button type="button" onClick={onClose} className="pb-btn">Close</button>
        <div className="pb-sub">Verify the money in your UPI app or bank account before marking the bill as paid.</div>
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

  const searchRef = useRef()
  const customerRef = useRef()
  const paymentSectionRef = useRef()
  const billDiscountRef = useRef()
  const savingRef = useRef(false)
  const cartRef = useRef([])
  const actionsRef = useRef({})
  cartRef.current = cart

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
    if (productsResult.status === 'fulfilled') setProducts(productsResult.value)
    if (categoriesResult.status === 'fulfilled') setCategories(categoriesResult.value)
    if (customersResult.status === 'fulfilled') setCustomers(customersResult.value)
    if (dashboardResult.status === 'fulfilled') setDashboard(dashboardResult.value.data)
    if (settingsResult.status === 'fulfilled') setSettings(settingsResult.value)
    setLoadError(results.some(result => result.status === 'rejected'))
    setInitializing(false)
  }, [])

  useEffect(() => { loadInitialData() }, [loadInitialData])

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products])
  // Display only: quantity already in the bill, shown as a badge on product cards.
  const cartQtyMap = useMemo(() => new Map(cart.map(i => [i.id, i.qty])), [cart])

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
    setTimeout(() => setLastAddedId(null), 800)
    setSearch('')
    setActiveIdx(-1)
    setSearchActive(false)
    if (canAutoFocus()) searchRef.current?.focus()
  }, [])

  const updateQty = (id, qty) => {
    if (qty > 0) {
      const stock = enforcedStock(productMap.get(id))
      if (qty > stock) {
        if (stock <= 0) { toast.error('Product is out of stock'); return }
        toast.error(`Only ${stock} in stock`)
        qty = stock
      }
    }
    setCart(prev => qty <= 0 ? prev.filter(item => item.id !== id) : prev.map(item => item.id === id ? recalc({ ...item, qty }) : item))
  }

  const updateDiscount = (id, pct) => {
    const value = Math.min(100, Math.max(0, Number(pct) || 0))
    setCart(prev => prev.map(item => item.id === id ? recalc({ ...item, discount_percent: value }) : item))
  }

  const removeItem = id => setCart(x => x.filter(i => i.id !== id))

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter(p => {
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
      const ids = JSON.parse(localStorage.getItem('pos_recent_products') || '[]').map(p => p?.id)
      return ids.map(id => products.find(p => p?.id === id)).filter(Boolean).filter(p => Number(p.current_stock || 0) > 0).slice(0, 5)
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

  // ---- Calculations (unchanged) -------------------------------------------
  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.qty, 0)
  const discount = cart.reduce((sum, item) => sum + item.unit_price * item.qty * item.discount_percent / 100, 0)
  const taxableBeforeBillDiscount = Math.max(0, subtotal - discount)
  const billDiscount = Math.min(Math.max(0, Number(billDiscountInput) || 0), taxableBeforeBillDiscount)
  const itemTax = cart.reduce((sum, item) => sum + item.unit_price * item.qty * (1 - item.discount_percent / 100) * item.gst_percent / 100, 0)
  const tax = taxableBeforeBillDiscount ? itemTax * ((taxableBeforeBillDiscount - billDiscount) / taxableBeforeBillDiscount) : 0
  const raw = taxableBeforeBillDiscount - billDiscount + tax
  const roundOff = Math.round(raw) - raw
  const grandTotal = raw + roundOff
  // Display-only figures
  const taxableAmount = taxableBeforeBillDiscount - billDiscount
  const totalQty = cart.reduce((count, item) => count + Number(item.qty || 0), 0)
  const cartItemsTotal = cart.reduce((sum, item) => sum + item.total, 0)

  // Keep the auto-filled amount of non-cash methods in step with the bill total.
  useEffect(() => {
    const target = grandTotal.toFixed(2)
    setPayment(p => (p.autoAmount && p.amount !== target) ? { ...p, amount: target } : p)
  }, [grandTotal])

  const selectPayment = method => {
    const digital = method !== 'cash' && method !== 'credit'
    setPayment({
      method,
      amount: digital ? grandTotal.toFixed(2) : '',
      reference: '',
      status: method === 'cash' ? 'paid' : method === 'credit' ? 'credit' : 'pending',
      autoAmount: digital,
    })
  }

  // Cash: a blank "received" field means exact amount tendered.
  const cashTendered = Number(payment.amount) || grandTotal
  const cashShort = payment.method === 'cash' && cashTendered < grandTotal - 0.005
  const cashBalanceDue = payment.method === 'cash' ? Math.max(0, grandTotal - cashTendered) : 0
  const cashChange = payment.method === 'cash' ? Math.max(0, cashTendered - grandTotal) : 0

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase()
    return customers.filter(c =>
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
  }, [cart, productMap, payment, customer, cashShort])

  // Quick Pay can be opened with or without a cart — it only requires the
  // shop's UPI ID. The modal itself handles amount entry.
  const openQuickPayment = () => {
    if (!upiId) {
      toast.error('Configure shop UPI ID in Settings first')
      return
    }
    setShowQr(true)
  }

  const resetBill = () => {
    setCart([]); setCustomer(null); setCustomerSearch('')
    setPayment(INITIAL_PAYMENT)
    setBillDiscountInput(''); setNotes(''); setLastAddedId(null); setShowSuccess(false)
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
    win.document.open()
    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${mode}</title>
          <style>
            body{margin:0;font-family:Arial,sans-serif;background:#fff;color:#334155}
            .loading{display:flex;min-height:100vh;align-items:center;justify-content:center;font-size:16px}
          </style>
        </head>
        <body><div class="loading">Preparing ${mode} for printing…</div></body>
      </html>
    `)
    win.document.close()
    win.focus()

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
      const blobUrl = URL.createObjectURL(blob)

      // Navigate the already-approved popup to the authenticated PDF.
      win.location.href = blobUrl

      // Chrome/Edge PDF viewer needs a little time before print().
      const trigger = () => {
        try {
          win.focus()
          win.print()
        } catch {
          toast.error(`Could not open ${mode} print dialog`)
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
      }

      setTimeout(trigger, thermal ? 1400 : 1200)
    } catch (err) {
      try {
        win.close()
      } catch { /* ignore */ }
      toast.error(
        err.response?.data?.detail ||
        `Could not print ${thermal ? 'thermal bill' : 'bill'}`
      )
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
  const saveBill = async print => {
    if (savingRef.current) return
    if (validationErrors.length) return toast.error(validationErrors[0])

    const receivedAmount = payment.method === 'cash'
      ? (Number(payment.amount) || grandTotal)
      : Number(payment.amount || 0)
    const effectivePaymentStatus = payment.method === 'cash' && payment.status === 'pending'
      ? 'paid'
      : payment.method === 'razorpay'
      ? 'pending'
      : payment.status
    if (payment.method !== 'credit' && payment.method !== 'razorpay' && !receivedAmount) {
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
        payment_method: payment.method,
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
        payments: payment.method === 'credit' || payment.method === 'razorpay'
          ? []
          : [{
              method: payment.method,
              amount: payment.method === 'cash'
                ? Math.min(receivedAmount, grandTotal)
                : Number(payment.amount),
              reference: payment.reference
            }]
      }

      const data = await invoiceService.createInvoice(payload)

      // Preserve customer contact/payment information for Share after
      // resetBill() clears the current billing form.
      const savedInvoice = {
        ...data,
        customer_phone: data.customer_phone || customer?.mobile || '',
        customer_name: data.customer_name || customer?.name || 'Walk-in Customer',
        payment_method: data.payment_method || payment.method,
        payment_status: data.payment_status || effectivePaymentStatus,
        amount_received: receivedAmount,
      }

      setLastInvoice(savedInvoice)
      toast.success(`Sale completed — invoice ${data.invoice_number}`)

      if (print) {
        await printInvoiceDocument(data.id, false, printWindow)
        printWindow = null
      }

      const usedRazorpay = payment.method === 'razorpay'
      resetBill()
      if (usedRazorpay) {
        // resetBill() clears the cart but not lastInvoice, so the Razorpay
        // modal can use the saved invoice.
        setLastInvoice(savedInvoice)
        setShowRazorpay(true)
      } else {
        setShowSuccess(true)
      }
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

  const getShortPdfUrl = async (invoiceId) => {
    const link = await invoiceService.createShortLink(invoiceId)
    return link.url
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

    let pdfUrl = ''
    try {
      pdfUrl = await getShortPdfUrl(lastInvoice.id)
    } catch {
      toast.error('Could not prepare the bill PDF')
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
      `Bill PDF: ${pdfUrl}`

    let pdfFile = null
    try {
      const res = await fetch(pdfUrl)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      pdfFile = new File([blob], `invoice-${invoiceNumber}.pdf`, { type: 'application/pdf' })
    } catch {
      // Continue with the shareable bill description/link.
    }

    // WhatsApp gets the complete bill description and PDF link.
    if (phone) {
      const whatsappPhone = phone.length === 10 ? `91${phone}` : phone
      const waUrl = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`
      const win = window.open(waUrl, '_blank', 'noopener,noreferrer')
      if (!win) toast.error('Allow pop-ups to share through WhatsApp')
      return
    }

    // Native share sheet: share both the bill description and PDF file.
    if (navigator.share) {
      try {
        if (pdfFile && navigator.canShare?.({ files: [pdfFile] })) {
          await navigator.share({
            title: `Bill ${invoiceNumber}`,
            text: message,
            files: [pdfFile],
          })
        } else {
          await navigator.share({ title: `Bill ${invoiceNumber}`, text: message })
        }
        return
      } catch (err) {
        if (err?.name === 'AbortError') return
      }
    }

    // No clipboard/copy-link fallback. Open the PDF for manual sharing.
    const win = window.open(pdfUrl, '_blank', 'noopener,noreferrer')
    if (!win) toast.error('Could not open the bill PDF')
  }

  const setExactCash = () => setPayment(x => ({ ...x, method: 'cash', amount: grandTotal.toFixed(2), status: 'paid', autoAmount: false }))
  const addCashChip = v => setPayment(x => ({ ...x, method: 'cash', amount: (Number(x.amount || 0) + v).toFixed(2), status: 'paid', autoAmount: false }))

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
  actionsRef.current = { saveBill, saveDraft, printCurrent, focusPayment, navigate }
  useEffect(() => {
    const onKey = e => {
      const a = actionsRef.current
      const key = e.key
      const mod = e.ctrlKey || e.metaKey
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if (mod && key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
      else if (mod && key.toLowerCase() === 'd') { e.preventDefault(); a.saveDraft() }
      else if (mod && key.toLowerCase() === 'p') { e.preventDefault(); a.printCurrent() }
      else if (mod && key === 'Enter') { e.preventDefault(); a.saveBill(false) }
      else if (key === 'F1') { e.preventDefault(); a.navigate('/billing/new') }
      else if (key === 'F2') { e.preventDefault(); customerRef.current?.focus() }
      else if (key === 'F3') { e.preventDefault(); searchRef.current?.focus() }
      else if (key === 'F4') { e.preventDefault(); a.focusPayment() }
      else if (key === 'F5') { e.preventDefault(); a.saveDraft() }
      else if (key === 'F6') { e.preventDefault(); billDiscountRef.current?.focus() }
      else if (key === 'F7') { e.preventDefault(); a.printCurrent() }
      else if (key === 'F8') { e.preventDefault(); a.saveBill(false) }
      else if (key === 'Escape') {
        setShowQr(false); setShowCustomerModal(false); setShowShortcuts(false)
        setShowClearConfirm(false); setShowDrafts(false)
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
  const canComplete = !saving && validationErrors.length === 0
  const completeTitle = canComplete ? 'Complete sale (F8)' : (validationErrors[0] || '')

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="pb-page">
      {/* Styles moved to NewBill.css */}


      {/* ============================ A. HEADER ============================ */}
      <header className="pb-header">
        <div className="pb-head-left">
          <h1 className="pb-title">New Bill</h1>
          <div className="pb-meta">
            <span className="pb-hide-sm">Invoice No: <b>Assigned on save</b></span>
            <span>Date: <b>{fmtDate(now)}</b></span>
            <span className="pb-hide-sm">Time: <b>{fmtTime(now)}</b></span>
            <span>Cashier: <b>{cashier}</b></span>
            {dashboard && dashboard.today_bills != null && <span className="pb-hide-sm">Bills today: <b>{dashboard.today_bills}</b></span>}
            {dashboard && dashboard.today_sales != null && <span className="pb-hide-sm">Sales today: <b>{fmt(dashboard.today_sales)}</b></span>}
          </div>
        </div>
        <div className="pb-head-actions">
          <button type="button" className="pb-btn" aria-label={`Draft bills (${drafts.length})`} title="Draft bills" onClick={() => { setDrafts(loadDrafts()); setShowDrafts(true) }}>
            <Layers size={15} /> <span className="pb-hide-sm">Drafts ({drafts.length})</span>
          </button>
          <button type="button" className="pb-btn" aria-label="Keyboard shortcuts" title="Keyboard shortcuts" onClick={() => setShowShortcuts(true)}>
            <Keyboard size={15} /> <span className="pb-hide-sm">Shortcuts</span>
          </button>
          <button type="button" className="pb-btn" aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />} <span className="pb-hide-sm">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </header>

      {loadError && !initializing && (
        <div className="pb-banner" role="alert">
          <AlertTriangle size={14} />
          <span>Some data could not be loaded (products, customers or settings may be incomplete).</span>
          <button type="button" className="pb-link" onClick={loadInitialData}>Retry</button>
        </div>
      )}

      <div className="pb-workspace">
        {/* ================= COLUMN 1: PRODUCTS & SEARCH ================= */}
        <section className="pb-panel pb-products" aria-labelledby="pb-add-products">
          <div className="pb-panel-head">
            <h2 id="pb-add-products">Products</h2>
            <span className="pb-hint">
              {initializing ? 'Loading products…' : `${filtered.length} of ${products.length}`}
              <span className="pb-hide-sm"> · Ctrl+K to search</span>
            </span>
          </div>

          <div className="pb-tools">
            <label className="pb-sr" htmlFor="pb-search">Scan barcode, or search by product name, SKU or code</label>
            <div className="pb-search-row">
              <div className="pb-search-field">
                <Search size={17} className="pb-field-icon" />
                <input
                  id="pb-search"
                  ref={searchRef}
                  className="pb-input pb-input-lg pb-has-icon"
                  placeholder="Search product, SKU or scan barcode"
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
                  <button type="button" className="pb-icon-btn pb-search-clear" aria-label="Clear search" title="Clear search" onMouseDown={e => e.preventDefault()}
                    onClick={() => { setSearch(''); setActiveIdx(-1); setSearchActive(true); searchRef.current?.focus() }}>
                    <X size={16} />
                  </button>
                ) : null}

                {searchActive && (
                  <div className="pb-dropdown" id="pb-search-list" role="listbox">
                    {search.trim() ? (
                      <>
                        <div className="pb-dd-head">Search results ({filtered.length})</div>
                        {searchResults.length ? searchResults.map((p, i) => (
                          <div role="option" aria-selected={i === activeIdx} key={p.id}
                            onMouseEnter={() => setActiveIdx(i)}
                            className="pb-result pb-result-readonly">
                            <span>
                              <span className="pb-strong">{p.name}</span>
                              {isOut(p) && <span className="pb-badge">Out of stock</span>}
                              <span className="pb-sub" style={{ display: 'block' }}>
                                SKU: {p.sku || '—'} | Barcode: {p.barcode || '—'}
                              </span>
                            </span>
                            <span className="pb-result-side">
                              <span className="pb-strong" style={{ display: 'block' }}>{fmt(p.selling_price)}</span>
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
                            <button type="button" key={p.id} onMouseDown={e => e.preventDefault()} onClick={() => addToCart(p)} className="pb-result">
                              <span className="pb-strong">{p.name}</span>
                              <span className="pb-result-side pb-strong">{fmt(p.selling_price)}</span>
                              <span className="pb-sub">{p.sku || p.barcode || '—'}</span>
                              <span className="pb-result-side pb-sub">Stock: {stockLabel(p)}</span>
                            </button>
                          )) : <div className="pb-dd-empty">Recently billed products will appear here.</div>}
                        </div>
                        <div>
                          <div className="pb-dd-head">Recommended products</div>
                          {recommendedProducts.length ? recommendedProducts.map(p => (
                            <button type="button" key={p.id} onMouseDown={e => e.preventDefault()} onClick={() => addToCart(p)} className="pb-result">
                              <span className="pb-strong">{p.name}</span>
                              <span className="pb-result-side pb-strong">{fmt(p.selling_price)}</span>
                              <span className="pb-sub">{p.sku || p.barcode || '—'}</span>
                              <span className="pb-result-side pb-sub">Stock: {stockLabel(p)}</span>
                            </button>
                          )) : <div className="pb-dd-empty">No recommendations available.</div>}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pb-cats" role="group" aria-label="Filter by category">
              <button type="button" className="pb-cat" aria-pressed={catFilter === ''} onClick={() => setCatFilter('')}>All</button>
              {categories.map(c => (
                <button type="button" key={c.id} className="pb-cat" aria-pressed={catFilter === String(c.id)} onClick={() => setCatFilter(String(c.id))}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="pb-scroll pb-pscroll">
            {initializing && !products.length ? (
              <div className="pb-empty"><Package size={28} /><b>Loading products…</b></div>
            ) : filtered.length ? (
              <div className="pb-pgrid">
                {filtered.map(p => {
                  const out = isOut(p)
                  const inCart = cartQtyMap.get(p.id) || 0
                  const img = p.image || p.image_url || p.thumbnail
                  return (
                    <article
                      key={p.id}
                      className={`pb-pcard${out ? ' pb-pcard-out' : ''}`}
                      aria-label={`${p.name}, ${fmt(p.selling_price)}`}
                    >
                      <div className="pb-pcard-top">
                        <div className="pb-pthumb">
                          <Package size={16} />
                          {img ? (
                            <img
                              src={img}
                              alt=""
                              loading="lazy"
                              onError={e => { e.currentTarget.style.display = 'none' }}
                            />
                          ) : null}
                        </div>
                        {inCart > 0 ? (
                          <span className="pb-pqty" title="Quantity already in this bill">
                            {inCart}
                          </span>
                        ) : null}
                      </div>

                      <div className="pb-pname" title={p.name}>{p.name}</div>

                      <div className="pb-pmeta">
                        <span className="pb-pprice">{fmt(p.selling_price)}</span>
                        {hasStockInfo(p) ? (
                          <span className={`pb-pstock${out ? ' pb-pstock-out' : isLowStock(p) ? ' pb-pstock-low' : ''}`}>
                            {out ? 'Out of stock' : `Stock ${stockLabel(p)}`}
                          </span>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        className="pb-padd pb-btn pb-btn-primary"
                        disabled={out}
                        aria-label={out ? `${p.name} is out of stock` : `Add ${p.name} to bill`}
                        onClick={() => addToCart(p)}
                      >
                        <Plus size={14} />
                        {out ? 'Out of Stock' : 'Add'}
                      </button>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="pb-empty">
                <Package size={28} />
                <b>No products found</b>
                <span>Try a different search or category.</span>
                {(search || catFilter) && (
                  <button type="button" className="pb-link" onClick={() => { setSearch(''); setCatFilter('') }}>Clear search and filters</button>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="pb-right">
          {/* ================= COLUMN 2: CURRENT BILL ================= */}
          <section className="pb-panel pb-cartpanel" aria-labelledby="pb-bill-items">
            <div className="pb-panel-head">
              <h2 id="pb-bill-items">
                Current Bill
                <span className="pb-count">{cart.length} item{cart.length === 1 ? '' : 's'} · qty {totalQty}</span>
              </h2>
            </div>

            <div className="pb-cust">
              <div className="pb-cust-row">
                <div className="pb-cust-field">
                  <label className="pb-sr" htmlFor="pb-customer">Search customer by name or phone (F2)</label>
                  <User size={16} className="pb-field-icon" />
                  <input
                    id="pb-customer"
                    ref={customerRef}
                    className="pb-input pb-has-icon"
                    placeholder="Walk-in Customer — search name or phone (F2)"
                    value={customerSearch}
                    autoComplete="off"
                    onFocus={() => setCustomerOpen(true)}
                    onBlur={() => setTimeout(() => setCustomerOpen(false), 180)}
                    onChange={e => {
                      const v = e.target.value
                      setCustomerSearch(v)
                      setCustomerOpen(true)
                      if (!v || (customer && v !== customer.name)) setCustomer(null)
                    }}
                  />
                  {customerOpen && !customer && (
                    <div className="pb-cust-list">
                      <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setCustomer(null); setCustomerSearch(''); setCustomerOpen(false) }}>
                        <span className="pb-strong">Walk-in Customer</span>
                      </button>
                      {filteredCustomers.slice(0, 6).map(c => (
                        <button type="button" key={c.id} onMouseDown={e => e.preventDefault()} onClick={() => { setCustomer(c); setCustomerSearch(c.name); setCustomerOpen(false) }}>
                          <span className="pb-strong">{c.name}</span>
                          <span className="pb-sub" style={{ display: 'block' }}>{c.mobile || 'No phone'}</span>
                        </button>
                      ))}
                      {customerSearch && !filteredCustomers.length && (
                        <div className="pb-dd-empty">No customer found. Use “New customer”.</div>
                      )}
                    </div>
                  )}
                </div>
                <button type="button" className="pb-btn" aria-label="Add new customer" title="Add new customer" onClick={() => setShowCustomerModal(true)}>
                  <UserPlus size={15} /> <span className="pb-hide-sm">New</span>
                </button>
              </div>
              <div className="pb-cust-line">
                <span><b>{customer?.name || 'Walk-in Customer'}</b></span>
                <span>{customer?.mobile || '—'}</span>
                {customer && (
                  <button type="button" className="pb-link" onClick={() => { setCustomer(null); setCustomerSearch('') }}>
                    Change to Walk-in Customer
                  </button>
                )}
              </div>
            </div>

            <div className="pb-scroll pb-cscroll">
              {cart.length ? (
                <ul className="pb-cart-list">
                  {cart.map((item, index) => (
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
                  ))}
                </ul>
              ) : (
                <div className="pb-empty">
                  <ShoppingCart size={30} />
                  <b>No items in this bill</b>
                  <span>Scan a barcode, search, or tap a product to start billing.</span>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="pb-cart-foot">
                <span>Total quantity {totalQty}</span>
                <span>Items total {fmt(cartItemsTotal)}</span>
              </div>
            )}
          </section>

          {/* ================= COLUMN 3: BILL SUMMARY ================= */}
          <div className="pb-side">
            <section className="pb-panel pb-summary-panel" aria-labelledby="pb-summary-h">
              <div className="pb-panel-head"><h2 id="pb-summary-h">Bill Summary</h2></div>
              <div className="pb-panel-body">
                <table className="pb-summary">
                  <tbody>
                    <tr><td>Total items</td><td>{cart.length} ({totalQty} qty)</td></tr>
                    <tr><td>Subtotal</td><td>{fmt(subtotal)}</td></tr>
                    <tr><td>Item discount</td><td className={discount > 0 ? 'pb-red' : ''}>{discount > 0 ? '-' : ''}{fmt(discount)}</td></tr>
                    <tr>
                      <td><label htmlFor="pb-bill-discount">Bill discount (F6)</label></td>
                      <td>
                        <input
                          id="pb-bill-discount"
                          ref={billDiscountRef}
                          type="number" min="0" max={taxableBeforeBillDiscount} step="0.01"
                          value={billDiscountInput}
                          onChange={e => setBillDiscountInput(e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                    <tr><td>Taxable amount</td><td>{fmt(taxableAmount)}</td></tr>
                    {showGst && <tr><td>GST / tax</td><td>{fmt(tax)}</td></tr>}
                    <tr><td>Round-off</td><td>{fmtSigned(roundOff)}</td></tr>
                  </tbody>
                </table>
                <div className="pb-grand" aria-live="polite">
                  <span>Grand total</span>
                  <strong>{fmt(grandTotal)}</strong>
                </div>
                {billIssues.length > 0 && (
                  <ul className="pb-errors" role="alert">
                    {billIssues.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                )}
                <div className="pb-notes">
                  <label className="pb-label" htmlFor="pb-notes">Bill notes (optional)</label>
                  <input id="pb-notes" className="pb-input" value={notes} onChange={e => setNotes(e.target.value)} />
                </div>
              </div>
            </section>

            {/* ============ Last completed bill / invoice actions ============ */}
            {lastInvoice && (
              <section className="pb-panel" aria-labelledby="pb-last-h">
                <div className="pb-panel-head"><h2 id="pb-last-h">Last Completed Bill</h2></div>
                <div className="pb-panel-body pb-stack">
                  <dl className="pb-dl">
                    <dt>Invoice no.</dt><dd>{lastInvoice.invoice_number || `INV-${lastInvoice.id}`}</dd>
                    <dt>Grand total</dt><dd>{fmt(lastInvoice.grand_total)}</dd>
                    <dt>Paid amount</dt><dd>{fmt(lastPaidAmount(lastInvoice))}</dd>
                    <dt>Payment method</dt><dd style={{ textTransform: 'capitalize' }}>{lastInvoice.payment_method || 'cash'}</dd>
                    <dt>Payment status</dt><dd style={{ textTransform: 'capitalize' }}>{lastInvoice.payment_status || '—'}</dd>
                  </dl>
                  {isPendingRazorpay && (
                    <button type="button" className="pb-btn pb-btn-primary" onClick={() => setShowRazorpay(true)}>
                      Collect {fmt(lastInvoice.grand_total)} with Razorpay
                    </button>
                  )}
                  <div className="pb-grid2">
                    <button type="button" className="pb-btn" onClick={() => printInvoiceDocument(lastInvoice.id, false)}><Printer size={14} /> Print Bill</button>
                    <button type="button" className="pb-btn" onClick={() => downloadInvoiceDocument(lastInvoice.id, false)}><Download size={14} /> Download Invoice</button>
                    <button type="button" className="pb-btn" onClick={shareInvoice}><Share2 size={14} /> Share Invoice</button>
                    <button type="button" className="pb-btn" onClick={() => openInvoiceDocument(lastInvoice.id, false)}><FileText size={14} /> Open PDF</button>
                    <button type="button" className="pb-btn" onClick={() => printInvoiceDocument(lastInvoice.id, true)}><Printer size={14} /> Print Thermal</button>
                    <button type="button" className="pb-btn" onClick={() => downloadInvoiceDocument(lastInvoice.id, true)}><Download size={14} /> Thermal PDF</button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* ================= PAYMENT DOCK ================= */}
      <section className="pb-dock" aria-label="Payment and actions" ref={paymentSectionRef}>
        <div className="pb-dock-row">
          <div className="pb-dock-methods">
            <span className="pb-dock-label" id="pb-payment-h">Payment method (F4)</span>
            <div className="pb-methods" role="radiogroup" aria-labelledby="pb-payment-h">
              {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" role="radio" aria-checked={payment.method === id} className="pb-method" onClick={() => selectPayment(id)}>
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="pb-dock-fields">
            {payment.method === 'cash' && (
              <>
                <div className="pb-field">
                  <label className="pb-label" htmlFor="pb-cash">Cash received</label>
                  <div className="pb-money">
                    <span aria-hidden="true">₹</span>
                    <input
                      id="pb-cash"
                      type="number" min="0" step="0.01" inputMode="decimal"
                      className="pb-input pb-input-num"
                      value={payment.amount}
                      placeholder={grandTotal.toFixed(2)}
                      title="Leave blank for the exact amount"
                      onChange={e => setPayment(x => ({ ...x, amount: e.target.value, status: 'paid', autoAmount: false }))}
                    />
                  </div>
                </div>
                <div className="pb-chips">
                  <button type="button" className="pb-chip pb-chip-exact" onClick={setExactCash}>Exact</button>
                  {CASH_CHIPS.map(v => (
                    <button type="button" key={v} className="pb-chip" onClick={() => addCashChip(v)}>+{v}</button>
                  ))}
                  <button type="button" className="pb-chip" onClick={() => setPayment(x => ({ ...x, amount: '', autoAmount: false }))}>Reset</button>
                </div>
                <div className="pb-stat"><span>Balance due</span><b className={cashBalanceDue > 0 ? 'pb-red' : ''}>{fmt(cashBalanceDue)}</b></div>
                <div className="pb-stat"><span>Change to return</span><b>{fmt(cashChange)}</b></div>
                {cashShort && (
                  <div className="pb-note pb-note-warn pb-dock-note" role="alert"><AlertTriangle size={14} /> Cash received is less than the grand total.</div>
                )}
              </>
            )}

            {['upi', 'card', 'online'].includes(payment.method) && (
              <>
                {payment.method === 'upi' && (
                  <div className="pb-field">
                    <label className="pb-label" htmlFor="pb-upi-id">Merchant UPI ID</label>
                    <input id="pb-upi-id" className="pb-input" value={upiId} readOnly placeholder="Configure in Settings" />
                  </div>
                )}
                <div className="pb-field">
                  <label className="pb-label" htmlFor="pb-pay-amount">Amount</label>
                  <div className="pb-money">
                    <span aria-hidden="true">₹</span>
                    <input
                      id="pb-pay-amount"
                      type="number" min="0" step="0.01" inputMode="decimal"
                      className="pb-input pb-input-num"
                      value={payment.amount}
                      onChange={e => setPayment(x => ({ ...x, amount: e.target.value, autoAmount: false }))}
                    />
                  </div>
                </div>
                <div className="pb-field">
                  <label className="pb-label" htmlFor="pb-pay-ref">{payment.method === 'upi' ? 'UTR / reference (optional)' : 'Reference (optional)'}</label>
                  <input id="pb-pay-ref" className="pb-input" value={payment.reference} onChange={e => setPayment(x => ({ ...x, reference: e.target.value }))} />
                </div>
                {payment.method === 'upi' && (
                  <button type="button" className="pb-btn pb-btn-lg" onClick={openQuickPayment} disabled={!upiId}>
                    <QrCode size={15} /> Show QR code
                  </button>
                )}
                <div>
                  <span className="pb-label">Payment status</span>
                  <div className="pb-status" role="radiogroup" aria-label="Payment status">
                    {['pending', 'paid', 'failed'].map(s => (
                      <button key={s} type="button" role="radio" data-s={s} aria-checked={payment.status === s} onClick={() => setPayment(x => ({ ...x, status: s }))}>{s}</button>
                    ))}
                  </div>
                </div>
                {payment.method === 'upi' && (
                  <div className={`pb-note pb-dock-note ${payment.status === 'paid' ? 'pb-note-ok' : 'pb-note-warn'}`}>
                    {payment.status === 'paid'
                      ? 'Payment is marked as RECEIVED.'
                      : 'QR shown ≠ payment received. Keep status “pending” until the money is confirmed in your UPI app or bank.'}
                  </div>
                )}
              </>
            )}

            {payment.method === 'credit' && (
              <>
                <div className="pb-note">This amount will be recorded as customer credit and settled later.</div>
                {CREDIT_REQUIRES_CUSTOMER && !customer && (
                  <div className="pb-note pb-note-warn" role="alert"><AlertTriangle size={14} /> Select a customer (F2) to complete a credit sale.</div>
                )}
              </>
            )}

            {payment.method === 'razorpay' && (
              <>
                <div className="pb-stat"><span>Payable via Razorpay</span><b>{fmt(grandTotal)}</b></div>
                <div className="pb-note">
                  “Complete Sale” saves the bill as <b>pending</b> and opens Razorpay checkout. The bill is marked paid only after the payment is verified.
                </div>
              </>
            )}
          </div>
        </div>

        <div className="pb-dock-actions">
          <div className="pb-dock-secondary">
            <button type="button" className="pb-btn" title="Save draft (Ctrl+D)" onClick={saveDraft} disabled={saving || !cart.length}>
              <Layers size={14} /> Save Draft
            </button>
            <button type="button" className="pb-btn" title={upiId ? 'Show a UPI QR without a bill' : 'Configure UPI ID in Settings'} onClick={openQuickPayment} disabled={!upiId}>
              <QrCode size={14} /> Quick QR
            </button>
            <button type="button" className="pb-btn" title="Complete the sale and print the bill" onClick={() => saveBill(true)} disabled={!canComplete}>
              <Printer size={14} /> Complete &amp; Print
            </button>
            <button type="button" className="pb-btn pb-btn-danger" title="Remove all items from this bill" onClick={() => setShowClearConfirm(true)} disabled={!cart.length}>
              <Trash2 size={14} /> Clear
            </button>
            <button type="button" className="pb-btn" title="Start a fresh bill" onClick={startNewBill} disabled={saving || (!cart.length && !lastInvoice)}>
              <RefreshCw size={14} /> New Bill
            </button>
          </div>
          <button type="button" className="pb-btn pb-btn-success pb-btn-xl pb-dock-complete" title={completeTitle} onClick={() => saveBill(false)} disabled={!canComplete}>
            <CheckCircle2 size={18} />
            {saving ? 'Saving…' : <>Complete Sale <span className="pb-amt">{fmt(grandTotal)}</span></>}
          </button>
        </div>
      </section>

      {/* Mobile: total + Complete Sale always reachable */}
      <div className="pb-mobile-bar">
        <div className="pb-mobile-total"><span>Grand total</span><strong>{fmt(grandTotal)}</strong></div>
        <button type="button" className="pb-btn pb-btn-success pb-btn-lg" title={completeTitle} onClick={() => saveBill(false)} disabled={!canComplete}>
          <CheckCircle2 size={16} /> {saving ? 'Saving…' : 'Complete Sale'}
        </button>
      </div>

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
          <p style={{ margin: 0 }}>Remove all {cart.length} item{cart.length === 1 ? '' : 's'} from this bill? This cannot be undone.</p>
          <div className="pb-grid2">
            <button type="button" className="pb-btn" onClick={() => setShowClearConfirm(false)}>Cancel</button>
            <button type="button" className="pb-btn pb-btn-primary" onClick={() => { setCart([]); setShowClearConfirm(false); searchRef.current?.focus() }}>Clear Cart</button>
          </div>
        </div>
      </Modal>

      <Modal open={showDrafts} onClose={() => setShowDrafts(false)} title="Draft bills" size="md">
        <div className="pb-modal">
          {drafts.length === 0 ? (
            <p className="pb-sub" style={{ margin: 0 }}>No draft bills saved. Use “Save Draft” to park a bill and resume it later.</p>
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
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="pb-btn pb-btn-sm pb-btn-primary" onClick={() => resumeDraft(d)}>Resume</button>
                  <button type="button" className="pb-btn pb-btn-sm pb-btn-danger" onClick={() => deleteDraft(d.id)}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      </Modal>

      <Modal open={showSuccess && Boolean(lastInvoice)} onClose={() => setShowSuccess(false)} title="Sale completed" size="sm">
        <div className="pb-modal pb-stack">
          <div className="pb-c">
            <CheckCircle2 size={30} color="#15803d" />
            <div className="pb-qr-amount">{fmt(lastInvoice?.grand_total)}</div>
            <div className="pb-sub">Invoice {lastInvoice?.invoice_number}</div>
          </div>
          <dl className="pb-dl" style={{ borderTop: '1px solid var(--pb-border)', paddingTop: 8 }}>
            <dt>Invoice number</dt><dd>{lastInvoice?.invoice_number || '—'}</dd>
            <dt>Payment method</dt><dd style={{ textTransform: 'capitalize' }}>{lastInvoice?.payment_method || 'cash'}</dd>
            <dt>Payment status</dt><dd style={{ textTransform: 'capitalize' }}>{lastInvoice?.payment_status || '—'}</dd>
            <dt>Paid amount</dt><dd>{fmt(lastPaidAmount(lastInvoice))}</dd>
            {lastInvoice?.payment_method === 'cash' && (
              <>
                <dt>Change returned</dt>
                <dd>{fmt(Math.max(0, Number(lastInvoice?.amount_received || 0) - Number(lastInvoice?.grand_total || 0)))}</dd>
              </>
            )}
          </dl>
          <div className="pb-grid2">
            <button type="button" className="pb-btn" onClick={() => printInvoiceDocument(lastInvoice?.id)}><Printer size={14} /> Print Bill</button>
            <button type="button" className="pb-btn" onClick={() => downloadInvoiceDocument(lastInvoice?.id)}><Download size={14} /> Download</button>
            <button type="button" className="pb-btn" onClick={shareInvoice}><Share2 size={14} /> Share</button>
            <button type="button" className="pb-btn" onClick={() => navigate(`/invoice/${lastInvoice?.id}`)}><FileText size={14} /> View Invoice</button>
          </div>
          <button type="button" className="pb-btn pb-btn-primary pb-btn-lg" onClick={() => { setShowSuccess(false); startNewBill() }}>
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
        onPaid={(amount) => {
          setPayment(x => ({ ...x, method: 'upi', amount: amount.toFixed(2), status: 'paid', autoAmount: false }))
          setShowQr(false)
          toast.success(`UPI payment of ${fmt(amount)} marked paid`)
        }}
      />

      <RazorpayPaymentModal
        open={showRazorpay}
        onClose={() => setShowRazorpay(false)}
        invoice={lastInvoice}
        onSuccess={async (invoiceId) => {
          setShowRazorpay(false)
          setPayment(x => ({ ...x, method: 'razorpay', status: 'paid' }))
          // The invoice held in state was created before checkout, so its
          // payment_status is still "pending". Reload the backend-confirmed
          // record before showing the receipt or allowing it to be printed.
          try {
            const paidInvoice = await invoiceService.getInvoice(invoiceId)
            setLastInvoice(previous => ({
              ...previous,
              ...paidInvoice,
              payment_method: paidInvoice?.payment_method || 'razorpay',
              payment_status: paidInvoice?.payment_status || 'paid',
              paid_amount: paidInvoice?.paid_amount ?? paidInvoice?.grand_total ?? previous?.grand_total,
              balance_due: paidInvoice?.balance_due ?? 0,
              amount_received: paidInvoice?.paid_amount ?? paidInvoice?.grand_total ?? previous?.grand_total,
            }))
          } catch {
            // Payment verification has already completed server-side. Keep
            // the receipt truthful even if the follow-up display fetch fails.
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
        }}
      />

      <Modal open={showShortcuts} onClose={() => setShowShortcuts(false)} title="Keyboard shortcuts" size="sm">
        <div className="pb-modal">
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', alignItems: 'center' }}>
            {[
              ['Ctrl + K / F3', 'Focus product search'],
             ['↑ ↓', 'Move through search results'],
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
              <div key={key} style={{ display: 'contents' }}>
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