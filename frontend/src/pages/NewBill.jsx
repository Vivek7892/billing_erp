import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import api, { API_BASE_URL } from '../api'
import invoiceService from '../features/billing/api/invoiceService'
import productService from '../features/inventory/api/productService'
import customerService from '../features/customers/api/customerService'
import settingsService from '../features/settings/api/settingsService'
import toast from 'react-hot-toast'
import {
  Search, Plus, Minus, Trash2, User, Printer, Download, RefreshCw, QrCode,
  Keyboard, CheckCircle2, Share2, Clock, Layers, X, Banknote,
  CreditCard, Wallet, Receipt, AlertTriangle, FileText, Maximize2, Minimize2, LogOut, MoreHorizontal
} from 'lucide-react'
import { ErrorState, Modal, Skeleton } from '../components/UI'
import { useNavigate } from 'react-router-dom'
import RazorpayPaymentModal from '../features/billing/RazorpayPaymentModal'

// ---------------------------------------------------------------------------
// Local drafts (parked bills) — unchanged storage contract
// ---------------------------------------------------------------------------
const DRAFT_KEY = 'pos_drafts'
function loadDrafts() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]') } catch { return [] } }
function saveDraftsStore(drafts) { localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)) }

const fmt = value => `₹${Number(value || 0).toFixed(2)}`
const upiUri = (upiId, name, amount, invoice = 'NEW-BILL') => {
  const params = new URLSearchParams({ pa: upiId || '', pn: name || 'Dreamwithtech', am: Number(amount || 0).toFixed(2), cu: 'INR', tn: invoice })
  return `upi://pay?${params.toString()}`
}

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'upi', label: 'UPI', icon: QrCode },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'credit', label: 'Credit', icon: Wallet },
  { id: 'razorpay', label: 'Razorpay', icon: CreditCard },
]
const CASH_CHIPS = [50, 100, 200, 500, 1000, 2000]
const QR_PRESETS = [100, 200, 500, 1000, 2000]

// ---------------------------------------------------------------------------
// Cart row
// ---------------------------------------------------------------------------
function CartRow({ item, index, onQty, onRemove, showGst, justAdded }) {
  const basic = item.unit_price * item.qty * (1 - item.discount_percent / 100)
  const gst = basic * item.gst_percent / 100

  return (
    <>
      {/* Desktop cart row */}
      <tr className={`hidden sm:table-row border-b border-[var(--line-subtle)] last:border-0 transition-colors ${justAdded ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-[var(--surface-elevated)]'}`}>
        <td className="py-2 pl-3 pr-1 text-xs text-[var(--muted-light)] text-center align-middle">{index}</td>
        <td className="py-2 pr-2 align-middle min-w-[9rem]">
          <div className="font-medium text-sm text-[var(--ink)] leading-tight">{item.product_name}</div>
          <div className="text-[11px] text-[var(--muted-light)]">{item.sku}{item.hsn_code ? ` · HSN ${item.hsn_code}` : ''}</div>
        </td>
        <td className="py-2 pr-2 text-right align-middle text-xs text-[var(--muted-light)] whitespace-nowrap">{fmt(item.mrp || item.unit_price)}</td>
        <td className="py-2 pr-2 text-right align-middle text-sm font-medium text-[var(--ink-secondary)] whitespace-nowrap">{fmt(item.unit_price)}</td>
        <td className="py-2 px-1 align-middle">
          <div className="flex items-center justify-center gap-1">
            <button
              aria-label={`Decrease ${item.product_name} quantity`}
              onClick={() => onQty(item.id, item.qty - 1)}
              className="h-8 w-8 rounded-md border border-[var(--line)] flex items-center justify-center text-[var(--muted)] hover:bg-slate-100 active:scale-95 transition"
            ><Minus size={13} /></button>
            <input
              aria-label={`${item.product_name} quantity`}
              type="number" min="0.01" step="0.01" value={item.qty}
              onChange={e => onQty(item.id, parseFloat(e.target.value) || 0)}
              className="w-12 h-8 text-center border border-[var(--line)] rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
            <button
              aria-label={`Increase ${item.product_name} quantity`}
              onClick={() => onQty(item.id, item.qty + 1)}
              className="h-8 w-8 rounded-md border border-[var(--line)] flex items-center justify-center text-[var(--muted)] hover:bg-slate-100 active:scale-95 transition"
            ><Plus size={13} /></button>
          </div>
        </td>
        <td className="py-2 px-2 text-right align-middle text-sm text-[var(--muted)] whitespace-nowrap">{fmt(basic)}</td>
        {showGst && (
          <td className="py-2 px-2 text-right align-middle whitespace-nowrap">
            <div className="text-sm text-[var(--muted)]">{fmt(gst)}</div>
            <div className="text-[10px] text-[var(--muted-light)]">{item.gst_percent}%</div>
          </td>
        )}
        <td className="py-2 pl-2 pr-2 text-right align-middle text-sm font-semibold text-[var(--ink)] whitespace-nowrap">{fmt(item.total)}</td>
        <td className="py-2 pr-3 text-center align-middle">
          <button
            aria-label={`Remove ${item.product_name}`}
            onClick={() => onRemove(item.id)}
            className="text-slate-300 hover:text-rose-500 p-2 transition"
          ><Trash2 size={15} /></button>
        </td>
      </tr>

      {/* Mobile cart card */}
      <tr className={`sm:hidden border-b border-[var(--line-subtle)] ${justAdded ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}>
        <td colSpan={showGst ? 9 : 8} className="p-0">
          <div className="p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-sm text-[var(--ink)] leading-tight break-words">{item.product_name}</div>
                <div className="text-[11px] text-[var(--muted-light)] mt-0.5">
                  {item.sku}{item.hsn_code ? ` · HSN ${item.hsn_code}` : ''}
                </div>
              </div>
              <button
                aria-label={`Remove ${item.product_name}`}
                onClick={() => onRemove(item.id)}
                className="shrink-0 h-9 w-9 rounded-lg border border-[var(--line)] text-[var(--muted-light)] hover:text-rose-500 hover:bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center"
              >
                <Trash2 size={15} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
              <div className="rounded-lg bg-[var(--surface-elevated)] px-2.5 py-2">
                <div className="text-[10px] text-[var(--muted-light)]">Rate</div>
                <div className="font-semibold text-[var(--ink-secondary)] mt-0.5">{fmt(item.unit_price)}</div>
              </div>
              <div className="rounded-lg bg-[var(--surface-elevated)] px-2.5 py-2">
                <div className="text-[10px] text-[var(--muted-light)]">MRP</div>
                <div className="font-semibold text-[var(--ink-secondary)] mt-0.5">{fmt(item.mrp || item.unit_price)}</div>
              </div>
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 px-2.5 py-2">
                <div className="text-[10px] text-blue-500 dark:text-blue-400">Total</div>
                <div className="font-bold text-blue-700 dark:text-blue-300 mt-0.5">{fmt(item.total)}</div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 mt-3">
              <div className="flex items-center gap-1.5">
                <button
                  aria-label={`Decrease ${item.product_name} quantity`}
                  onClick={() => onQty(item.id, item.qty - 1)}
                  className="h-10 w-10 rounded-lg border border-[var(--line)] flex items-center justify-center text-[var(--muted)] active:scale-95"
                ><Minus size={15} /></button>
                <input
                  aria-label={`${item.product_name} quantity`}
                  type="number" min="0.01" step="0.01" value={item.qty}
                  onChange={e => onQty(item.id, parseFloat(e.target.value) || 0)}
                  className="w-16 h-10 text-center border border-[var(--line)] rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
                <button
                  aria-label={`Increase ${item.product_name} quantity`}
                  onClick={() => onQty(item.id, item.qty + 1)}
                  className="h-10 w-10 rounded-lg border border-[var(--line)] flex items-center justify-center text-[var(--muted)] active:scale-95"
                ><Plus size={15} /></button>
              </div>

              <div className="text-right text-xs text-[var(--muted)]">
                <div>Basic {fmt(basic)}</div>
                {showGst && <div>GST {fmt(gst)} ({item.gst_percent}%)</div>}
              </div>
            </div>
          </div>
        </td>
      </tr>
    </>
  )
}

// ---------------------------------------------------------------------------
// QR payment modal (Quick Pay)
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
    <Modal open={open} onClose={onClose} title="Quick Customer Payment" size="sm"><div className="mobile-modal-content">
      <div className="text-center space-y-4">
        <div className="flex flex-col items-center justify-center gap-1.5 text-center px-3 sm:px-6 rounded-lg py-3">
          <div className="flex items-center justify-center gap-2 text-blue-700 dark:text-blue-300 font-bold">
            <QrCode size={18} />
            Scan & Pay
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Customer scans this QR with Google Pay, Paytm, BHIM or another UPI app.
          </div>
        </div>

        {/* Manual amount entry */}
        <div className="text-left">
          <span className="text-xs text-[var(--muted)] font-medium">Amount to collect</span>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-light)] text-base font-semibold">₹</span>
            <input
              type="number" min="0" step="0.01" inputMode="decimal"
              className="w-full h-12 pl-7 pr-3 rounded-lg border border-[var(--line)] text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--success)] focus:border-[var(--success)]"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            {hasCart && billTotal > 0 && (
              <button
                onClick={applyBillTotal}
                className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 hover:bg-indigo-100"
              >
                🧾 Bill Total · {fmt(billTotal)}
              </button>
            )}
            {QR_PRESETS.map(v => (
              <button
                key={v}
                onClick={() => applyPreset(v)}
                className="pos-chip"
              >
                ₹{v.toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        </div>

        {differsFromBill && (
          <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-left">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>Bill total is <b>{fmt(billTotal)}</b> but this QR is for <b>{fmt(numericAmount)}</b>.</span>
          </div>
        )}

        <div ref={qrRef} className="inline-flex max-w-full p-3 sm:p-4 border-2 border-blue-200 dark:border-blue-900/60 rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-card)]">
          {numericAmount > 0 ? (
            <QRCodeSVG
              value={uri}
              size={240}
              className="max-w-[70vw] max-h-[70vw] sm:max-w-none sm:max-h-none"
              level="M"
              includeMargin
              bgColor="#ffffff"
              fgColor="#111827"
            />
          ) : (
            <div className="w-[240px] h-[240px] flex items-center justify-center text-center text-sm text-[var(--muted-light)] px-6">
              Enter an amount to generate the QR
            </div>
          )}
        </div>

        <div>
          <div className="text-4xl font-extrabold text-blue-700 dark:text-blue-300 tabular-nums">{fmt(numericAmount)}</div>
          <div className="text-sm font-semibold text-[var(--ink-secondary)] mt-1">{shopName}</div>
          <div className="text-xs text-[var(--muted-light)] mt-1">{upiId || 'UPI ID not configured'}</div>
          <div className="text-xs text-[var(--muted-light)]">Invoice: {invoice || 'NEW-BILL'}</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button onClick={download} disabled={!canAct} className="btn-outline">
            <Download size={15} /> Download QR
          </button>
          <button onClick={print} disabled={!canAct} className="btn-outline">
            <Printer size={15} /> Print QR
          </button>
          <button
            onClick={() => onPaid(numericAmount)}
            disabled={!canAct}
            className="btn-solid bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700 col-span-1 sm:col-span-2 h-11 mobile-safe-button"
          >
            <CheckCircle2 size={16} /> Payment Received — Mark Paid ({fmt(numericAmount)})
          </button>
          <button onClick={onClose} className="btn-outline col-span-1 sm:col-span-2 mobile-safe-button">Close</button>
        </div>

        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-left">
          <b>Important:</b> QR generation does not confirm payment. Verify the money is received in the merchant account before marking the bill as paid.
        </div>
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
  const [cart, setCart] = useState([])
  const [lastAddedId, setLastAddedId] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [payment, setPayment] = useState({ method: 'cash', amount: '', reference: '', status: 'pending' })
  const [billDiscountInput, setBillDiscountInput] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastInvoice, setLastInvoice] = useState(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showRazorpay, setShowRazorpay] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [searchActive, setSearchActive] = useState(false)
  const [showMoreActions, setShowMoreActions] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement))
  const [newCustomer, setNewCustomer] = useState({ name: '', mobile: '', email: '' })
  const [now, setNow] = useState(new Date())
  const searchRef = useRef()
  const customerRef = useRef()
  const paymentRef = useRef()
  const billDiscountRef = useRef()

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t) }, [])
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

  const recalc = item => {
    const basic = item.unit_price * item.qty * (1 - item.discount_percent / 100)
    return { ...item, total: basic + basic * item.gst_percent / 100 }
  }

  const addRecentProduct = product => {
    try {
      const current = JSON.parse(localStorage.getItem('pos_recent_products') || '[]')
      const next = [product, ...current.filter(p => p?.id !== product?.id)].slice(0, 8)
      localStorage.setItem('pos_recent_products', JSON.stringify(next))
    } catch {}
  }

  const addToCart = useCallback(product => {
    setCart(prev => {
      const found = prev.find(item => item.id === product.id)
      return found
        ? prev.map(item => item.id === product.id ? recalc({ ...item, qty: item.qty + 1 }) : item)
        : [...prev, recalc({
            id: product.id, product_name: product.name, sku: product.sku,
            hsn_code: product.hsn_code || '', mrp: Number(product.mrp || product.selling_price),
            unit_price: Number(product.selling_price), qty: 1, discount_percent: 0,
            gst_percent: Number(product.gst_percent || 0), total: 0,
          })]
    })
    setLastAddedId(product.id)
    addRecentProduct(product)
    setTimeout(() => setLastAddedId(null), 800)
    setSearch('')
    searchRef.current?.focus()
  }, [])

  const updateQty = (id, qty) => setCart(prev => qty <= 0 ? prev.filter(item => item.id !== id) : prev.map(item => item.id === id ? recalc({ ...item, qty }) : item))

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

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.qty, 0)
  const discount = cart.reduce((sum, item) => sum + item.unit_price * item.qty * item.discount_percent / 100, 0)
  const taxableBeforeBillDiscount = Math.max(0, subtotal - discount)
  const billDiscount = Math.min(Math.max(0, Number(billDiscountInput) || 0), taxableBeforeBillDiscount)
  const itemTax = cart.reduce((sum, item) => sum + item.unit_price * item.qty * (1 - item.discount_percent / 100) * item.gst_percent / 100, 0)
  const tax = taxableBeforeBillDiscount ? itemTax * ((taxableBeforeBillDiscount - billDiscount) / taxableBeforeBillDiscount) : 0
  const raw = taxableBeforeBillDiscount - billDiscount + tax
  const roundOff = Math.round(raw) - raw
  const grandTotal = raw + roundOff

  const selectPayment = method => {
    setPayment({
      method,
      amount: method === 'credit' ? '' : grandTotal.toFixed(2),
      reference: '',
      status: method === 'cash' ? 'paid' : method === 'credit' ? 'credit' : method === 'razorpay' ? 'pending' : 'pending',
    })
    if (method === 'razorpay' && !lastInvoice) {
      toast('Save the bill first, then use Razorpay to collect payment.', { icon: 'ℹ️' })
    }
  }

  const balance = Math.max(0, grandTotal - (payment.status === 'paid' ? Number(payment.amount || 0) : 0))
  const change = payment.method === 'cash' && payment.status === 'paid' ? Math.max(0, Number(payment.amount || 0) - grandTotal) : 0

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

  // Quick Pay can now be opened with or without a cart — it only requires
  // the shop's UPI ID to be configured. The modal itself handles amount entry.
  const openQuickPayment = () => {
    if (!upiId) {
      toast.error('Configure shop UPI ID in Settings first')
      return
    }
    setShowQr(true)
  }

  const resetBill = () => {
    setCart([]); setCustomer(null); setCustomerSearch('')
    setPayment({ method: 'cash', amount: '', reference: '', status: 'pending' })
    setBillDiscountInput(''); setNotes(''); setLastAddedId(null); setShowSuccess(false); setShowMoreActions(false); setSearchActive(false)
    searchRef.current?.focus()
  }

  const saveDraft = () => {
    if (!cart.length) return toast.error('Cart is empty')
    const draft = {
      id: Date.now(), savedAt: new Date().toISOString(),
      customerName: customer?.name || customerSearch || 'Walk-in Customer',
      cart, customer, customerSearch, payment, billDiscountInput, notes,
    }
    saveDraftsStore([draft, ...loadDrafts().slice(0, 19)])
    toast.success('Bill parked as draft')
    resetBill()
  }

  useEffect(() => {
    const raw = sessionStorage.getItem('pos_resume_draft')
    if (raw) {
      try {
        const d = JSON.parse(raw)
        setCart(d.cart || [])
        setCustomer(d.customer || null)
        setCustomerSearch(d.customerSearch || '')
        setPayment(d.payment || { method: 'cash', amount: '', reference: '', status: 'pending' })
        setBillDiscountInput(d.billDiscountInput || '')
        setNotes(d.notes || '')
        saveDraftsStore(loadDrafts().filter(x => x.id !== d.id))
        toast.success('Draft resumed')
      } catch {}
      sessionStorage.removeItem('pos_resume_draft')
    }
  }, [])

  // -------------------------------------------------------------------------
  // Invoice document helpers
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
      toast.error('Save the bill first')
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
      toast.error('Save the bill first')
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
      } catch {}
      toast.error(
        err.response?.data?.detail ||
        `Could not print ${thermal ? 'thermal bill' : 'bill'}`
      )
    }
  }

  const downloadInvoiceDocument = async (invoiceId, thermal = false) => {
    if (!invoiceId) {
      toast.error('Save the bill first')
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

  const saveBill = async print => {
    if (!cart.length) return toast.error('Cart is empty')
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
      toast.success(`Bill ${data.invoice_number} saved`)

      if (print) {
        await printInvoiceDocument(data.id, false, printWindow)
        printWindow = null
      }

      resetBill()
      if (payment.method === 'razorpay') {
        // Keep the saved invoice reference so Razorpay modal can use it,
        // then open the modal. resetBill() clears cart but not lastInvoice.
        setLastInvoice(savedInvoice)
        setShowRazorpay(true)
      } else {
        setShowSuccess(true)
      }
    } catch (err) {
      if (printWindow && !printWindow.closed) {
        try { printWindow.close() } catch {}
      }
      const responseData = err.response?.data
      const validationMessage = responseData && typeof responseData === 'object'
        ? Object.values(responseData).flat().find(value => typeof value === 'string')
        : null
      toast.error(validationMessage || responseData?.detail || err.message || 'Could not save bill')
    } finally {
      setSaving(false)
    }
  }

  const addCustomer = async () => {
    if (!newCustomer.name.trim()) return toast.error('Customer name is required')
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
    }
  }

  const getShortPdfUrl = async (invoiceId) => {
    const link = await invoiceService.createShortLink(invoiceId)
    return link.url
  }

  const shareInvoice = async () => {
    if (!lastInvoice) {
      toast.error('Save the bill first')
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

  const setExactCash = () => setPayment(x => ({ ...x, method: 'cash', amount: grandTotal.toFixed(2), status: 'paid' }))
  const addCashChip = v => setPayment(x => ({ ...x, method: 'cash', amount: (Number(x.amount || 0) + v).toFixed(2), status: 'paid' }))

  useEffect(() => {
    const onKey = e => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'F1') { e.preventDefault(); navigate('/billing/new') }
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'F3') { e.preventDefault(); customerRef.current?.focus() }
      if (e.key === 'F4') { e.preventDefault(); paymentRef.current?.focus() }
      if (e.key === 'F5') { e.preventDefault(); saveDraft() }
      if (e.key === 'F6') { e.preventDefault(); billDiscountRef.current?.focus() }
      if (e.key === 'F7' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p')) {
        e.preventDefault()
        if (lastInvoice?.id) printInvoiceDocument(lastInvoice.id, false)
        else saveBill(true)
      }
      if (e.key === 'F8' || (e.ctrlKey && e.key === 'Enter')) { e.preventDefault(); saveBill(false) }
      if (e.key === 'Escape') { setShowQr(false); setShowCustomerModal(false); setShowShortcuts(false); if (!typing) setShowSuccess(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [grandTotal, payment, cart, lastInvoice, upiId, billDiscountInput, navigate])

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

  return (
    <div className="pos-page pos-theme-light min-h-screen w-full overflow-x-hidden" data-theme="light">
      <style>{`
        /* ------------------------------------------------------------------
           POS visual system
           Clean, high-contrast, compact and consistent across desktop/mobile.
        ------------------------------------------------------------------ */
        .pos-page{--pos-radius:10px;--pos-radius-sm:8px}
        .pos-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--pos-radius);box-shadow:var(--shadow-card)}
        .pos-sale-toolbar{
          display:flex;align-items:center;justify-content:space-between;gap:1rem;
          padding:.75rem 1rem;border:1px solid var(--primary-border);border-radius:var(--pos-radius);
          background:linear-gradient(90deg,var(--primary-light),var(--surface) 58%);box-shadow:var(--shadow-xs)
        }
        .pos-sale-kicker{font-size:.625rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--primary-text)}
        .pos-sale-title{font-size:1rem;font-weight:800;letter-spacing:-.02em;color:var(--ink);line-height:1.2}
        .pos-flow{display:flex;align-items:center;gap:.35rem;font-size:.6875rem;font-weight:700;color:var(--muted)}
        .pos-flow span{display:inline-flex;align-items:center;gap:.3rem;padding:.3rem .5rem;border-radius:999px;background:var(--surface);border:1px solid var(--line)}
        .pos-flow span:first-child{color:var(--primary-text);border-color:var(--primary-border);background:var(--primary-light)}
        .pos-scan-panel{border-color:var(--primary-border);box-shadow:0 1px 2px rgba(37,99,235,.05)}
        .pos-scan-panel:focus-within{box-shadow:0 0 0 3px rgba(37,99,235,.08)}
        .pos-products-panel{border-top:3px solid var(--primary)}
        .pos-cart-panel{border-top:3px solid #0f766e}
        .pos-checkout{padding:.25rem;border:1px solid var(--line);border-radius:calc(var(--pos-radius) + 2px);background:var(--surface-elevated)}
        .pos-checkout .pos-card{box-shadow:none;background:var(--surface)}
        .pos-checkout-actions{border-color:var(--primary-border)!important;background:var(--surface)!important}
        .pos-card-header{border-bottom:1px solid var(--line-subtle);background:var(--surface);border-radius:var(--pos-radius) var(--pos-radius) 0 0}
        .pos-input{
          width:100%;min-height:2.5rem;padding:.5rem .75rem;border:1px solid var(--line);
          border-radius:var(--pos-radius-sm);background:var(--surface);color:var(--ink);
          font-size:.8125rem;outline:none;transition:border-color .15s ease,box-shadow .15s ease,background .15s ease;
        }
        .pos-input::placeholder{color:var(--muted-light)}
        .pos-input:hover{border-color:var(--muted-light)}
        .pos-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 12%,transparent);background:var(--surface)}
        .pos-select{appearance:auto;cursor:pointer}
        .pos-money{font-variant-numeric:tabular-nums}
        .pos-icon-button{
          display:inline-flex;align-items:center;justify-content:center;width:2rem;height:2rem;
          border:1px solid var(--line);border-radius:var(--pos-radius-sm);background:var(--surface);
          color:var(--muted);transition:all .15s ease;
        }
        .pos-icon-button:hover{background:var(--surface-elevated);color:var(--ink);border-color:var(--muted-light)}
        .pos-icon-button:active{transform:translateY(1px)}
        .btn-solid{
          display:inline-flex;align-items:center;justify-content:center;gap:.375rem;min-height:2.5rem;
          padding:0 1rem;border-radius:var(--pos-radius-sm);background:var(--primary);color:#fff;
          font-weight:700;font-size:.8125rem;letter-spacing:.005em;transition:all .15s ease;
          border:1px solid var(--primary);box-shadow:var(--shadow-primary)
        }
        .btn-solid:hover:not(:disabled){background:var(--primary-hover);border-color:var(--primary-hover);filter:saturate(1.03)}
        .btn-solid:active:not(:disabled){transform:translateY(1px)}
        .btn-solid:disabled{opacity:.5;cursor:not-allowed;box-shadow:none}
        .btn-outline{
          display:inline-flex;align-items:center;justify-content:center;gap:.375rem;min-height:2.5rem;
          padding:0 .875rem;border-radius:var(--pos-radius-sm);border:1px solid var(--line);
          background:var(--surface);color:var(--ink-secondary);font-weight:600;font-size:.8125rem;
          letter-spacing:.005em;transition:all .15s ease;box-shadow:var(--shadow-xs)
        }
        .btn-outline:hover:not(:disabled){background:var(--surface-elevated);border-color:var(--muted-light);color:var(--ink)}
        .btn-outline:active:not(:disabled){transform:translateY(1px)}
        .btn-outline:disabled{opacity:.45;cursor:not-allowed}
        .pos-payment-method{
          min-height:2.75rem;border:1px solid var(--line);background:var(--surface);
          color:var(--muted);border-radius:var(--pos-radius-sm);transition:all .15s ease
        }
        .pos-payment-method:hover{border-color:var(--primary);background:var(--surface-elevated);color:var(--ink)}
        .pos-payment-active{background:var(--primary)!important;border-color:var(--primary)!important;color:#fff!important;box-shadow:var(--shadow-primary)}
        .pos-amount-box{border-radius:var(--pos-radius-sm);padding:.75rem;border:1px solid var(--line);background:var(--surface-elevated)}
        .pos-exact{
          display:inline-flex;align-items:center;justify-content:center;min-height:2rem;padding:0 .8rem;
          border-radius:var(--pos-radius-sm);border:1px solid #059669;background:#059669;color:#fff;
          font-size:.75rem;font-weight:700;transition:all .15s ease
        }
        .pos-exact:hover{background:#047857;border-color:#047857}
        .pos-exact:active{transform:translateY(1px)}
        .pos-chip{
          display:inline-flex;align-items:center;justify-content:center;min-height:2rem;padding:0 .7rem;
          border-radius:var(--pos-radius-sm);border:1px solid var(--line);background:var(--surface);
          color:var(--muted);font-size:.75rem;font-weight:600;transition:all .15s ease
        }
        .pos-chip:hover{background:var(--surface-elevated);border-color:var(--muted-light);color:var(--ink)}
        .pos-total-panel{
          border:1px solid var(--line);border-radius:var(--pos-radius);background:var(--surface-elevated);
          padding:.875rem
        }
        .pos-grand-total{
          font-size:clamp(1.65rem,3vw,2rem);font-weight:800;letter-spacing:-.02em;
          font-variant-numeric:tabular-nums;color:var(--ink)
        }
        .pos-product{
          position:relative;text-align:left;border:1px solid var(--line);border-radius:var(--pos-radius-sm);
          background:var(--surface);padding:.75rem;transition:all .15s ease
        }
        .pos-product:hover{border-color:var(--primary);background:var(--surface-elevated);transform:translateY(-1px);box-shadow:var(--shadow-xs)}
        .pos-product:active{transform:translateY(0)}
        .pos-product-in-cart{border-color:var(--primary)!important;background:color-mix(in srgb,var(--primary) 7%,var(--surface))!important}
        .pos-search-result{border-bottom:1px solid var(--line-subtle);transition:background .15s ease}
        .pos-search-result:hover{background:var(--surface-elevated)}
        .pos-section-label{font-size:.75rem;font-weight:700;color:var(--ink);letter-spacing:.01em}
        .pos-muted-label{font-size:.6875rem;color:var(--muted-light)}
        .pos-table thead th{background:var(--surface-elevated);color:var(--muted);font-size:.6875rem;font-weight:700;letter-spacing:.05em}
        .pos-table tbody tr{transition:background .15s ease}
        .pos-table tbody tr:hover{background:var(--surface-elevated)}
        .pos-danger{color:#dc2626}
        .pos-danger:hover{background:#fef2f2;color:#b91c1c}
        .pos-checkout-actions{position:relative;min-width:0}
        .pos-checkout-actions .btn-outline{min-width:0}
        .pos-products-panel{scroll-margin-top:1rem}
        .pos-cart-panel{min-width:0}
        .pos-table{min-width:720px;table-layout:auto}
        @media (max-width: 767px){
          .pos-checkout{border:0;background:transparent;padding:0}
          .pos-checkout .pos-card{border-radius:12px}
          .mobile-modal-content{width:100%;min-width:0}
          .mobile-modal-content input{max-width:100%}
          .pos-checkout-actions{padding:1rem}
          .pos-checkout-actions > *{min-width:0}

          .pos-sale-toolbar{border-radius:10px}
          .pos-sale-toolbar > div{min-width:0}
          .pos-input{font-size:16px}
          .pos-product{min-height:4.75rem;padding:.7rem}
          .pos-checkout-actions{padding:1rem}
          .pos-checkout-actions .btn-outline,
          .pos-checkout-actions .btn-solid{width:100%;min-height:2.75rem}
          .pos-total-panel{padding:1rem}
        }
        @media (max-width: 639px){
          .pos-sale-toolbar{padding:.7rem .75rem}
          .pos-sale-title{font-size:.9375rem}
          .mobile-safe-button{min-height:2.5rem}
          .mobile-modal-content{max-height:calc(100dvh - 1.5rem);overflow-y:auto}
          .pos-grand-total{font-size:1.75rem}
        }

        .pos-theme-light{--app-bg:#f8fafc;--surface:#ffffff;--surface-elevated:#f7f9fc;--ink:#0f172a;--ink-secondary:#334155;--muted:#64748b;--muted-light:#94a3b8;--line:#cbd5e1;--line-subtle:#e2e8f0;--primary:#2563eb;--primary-hover:#1d4ed8;--primary-light:#eff6ff;--primary-border:#bfdbfe;--primary-text:#1d4ed8;--success:#059669;--shadow-card:0 2px 8px rgba(15,23,42,.06);--shadow-xs:0 1px 3px rgba(15,23,42,.08);--shadow-primary:0 3px 10px rgba(37,99,235,.2)}
        .pos-page{background:var(--app-bg);color:var(--ink);transition:background .2s ease,color .2s ease}
        .pos-search-popover{background:var(--surface);border-color:var(--line);box-shadow:0 18px 40px rgba(15,23,42,.18);max-width:100vw}
        .pos-search-input{font-size:16px!important;font-weight:600;border-width:2px}
        .pos-search-input:focus{border-color:var(--primary);box-shadow:0 0 0 4px color-mix(in srgb,var(--primary) 14%,transparent)}
        .pos-razorpay{border-color:#6366f1;color:#4f46e5}
        .pos-razorpay:hover{background:#eef2ff;border-color:#4f46e5}
        .pos-money,.pos-grand-total,.tabular-nums,input[type=number]{font-family:Arial,Helvetica,sans-serif!important;font-variant-numeric:tabular-nums lining-nums!important;font-feature-settings:"tnum" 1,"lnum" 1}
        .pos-page button,.pos-page input,.pos-page select{touch-action:manipulation}
        .pos-toolbar-control{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;height:2.25rem;padding:0 .6rem;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink-secondary);font-size:.75rem;font-weight:700;box-shadow:var(--shadow-xs);transition:all .15s ease;white-space:nowrap}
        .pos-toolbar-control:hover{background:var(--surface-elevated);color:var(--ink);border-color:var(--muted-light)}
        .pos-toolbar-control:active{transform:translateY(1px)}
        .pos-toolbar-exit{border-color:#fecaca;color:#b91c1c;background:var(--surface)}
        .pos-toolbar-exit:hover{background:#fef2f2;border-color:#fca5a5;color:#991b1b}
.pos-floating-quick-pay{
          position:fixed;right:1rem;bottom:1rem;z-index:55;
          display:inline-flex;align-items:center;justify-content:center;gap:.4rem;
          min-height:2.5rem;padding:0 .9rem;border:1px solid #059669;border-radius:999px;
          background:#059669;color:#fff;font-size:.78rem;font-weight:800;
          box-shadow:0 8px 24px rgba(5,150,105,.22);transition:transform .15s ease,background .15s ease;
        }
        .pos-floating-quick-pay:hover{background:#047857}
        .pos-floating-quick-pay:active{transform:translateY(1px)}
        .pos-floating-quick-pay:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}
        .pos-mobile-checkout{padding-bottom:calc(.75rem + env(safe-area-inset-bottom))}
        .pos-mobile-cart-bar{bottom:calc(.65rem + env(safe-area-inset-bottom))}
        @media(max-width:1023px){.pos-page .pos-shell{padding:0.65rem}.pos-checkout{max-height:88dvh}}
        @media(max-width:767px){
          .pos-page{min-height:100dvh;padding-bottom:5.25rem}
          .pos-shell{padding:0!important;gap:.65rem!important}
          .pos-sale-toolbar{position:sticky;top:0;z-index:25;border-radius:0!important;border-left:0;border-right:0;padding:.65rem .75rem}
          .pos-sale-toolbar .pos-sale-title{font-size:.95rem}
          .pos-sale-toolbar .pos-sale-kicker{font-size:.56rem}
          .pos-toolbar-control{height:2.25rem;width:2.25rem;padding:0;border-radius:9px}
          .pos-toolbar-control .pos-control-label{display:none}
          .pos-search-panel{border-radius:0;border-left:0;border-right:0;padding:.65rem .75rem!important}
          .pos-search-popover{position:absolute;left:0;right:0;width:100%;max-height:60dvh;border-radius:12px;overflow-y:auto}
          .pos-search-popover>div{grid-template-columns:1fr!important}
          .pos-search-popover>div>div{border-right:0!important}
          .pos-cart-panel{border-radius:0;border-left:0;border-right:0;min-height:12rem!important}
          .pos-table{min-width:680px}
          .pos-cart-panel .overflow-auto{max-height:55dvh}
          .pos-checkout{position:fixed!important;left:0;right:0;bottom:0;top:auto!important;width:100%!important;max-height:88dvh!important;margin:0!important;padding:.65rem .65rem 0!important;border-radius:16px 16px 0 0!important;border:1px solid var(--line)!important;background:var(--app-bg)!important;box-shadow:0 -14px 40px rgba(15,23,42,.22);z-index:40}
          .pos-checkout .pos-card,.pos-checkout .pos-checkout-actions{border-radius:12px}
          .pos-checkout .pos-card{padding:.8rem!important}
          .pos-checkout-actions{padding:.8rem!important}
          .pos-checkout-actions .btn-outline,.pos-checkout-actions .btn-solid{min-height:2.5rem}
          .pos-payment-method{min-height:3.1rem}
          .pos-total-panel{padding:.85rem}
          .pos-grand-total{font-size:1.65rem}
          .mobile-safe-button{min-height:2.5rem}
          .mobile-modal-content{width:100%;min-width:0;max-height:calc(100dvh - 1rem);overflow-y:auto}
          .mobile-modal-content input{max-width:100%;font-size:16px}
        }
        @media(max-width:639px){
          .pos-sale-toolbar{padding:.55rem .65rem}
          .pos-sale-toolbar .hidden.sm\:flex{display:none!important}
          .pos-search-input{height:3.1rem!important}
          .pos-page .pos-card{box-shadow:0 1px 4px rgba(15,23,42,.05)}
          .pos-checkout{max-height:92dvh!important}
          .pos-checkout-actions .grid{gap:.5rem}
          .pos-checkout-actions .btn-outline,.pos-checkout-actions .btn-solid{font-size:.78rem;padding:0 .55rem}
        }
        @media(min-width:768px){.pos-checkout{max-height:calc(100dvh - 1rem)}}
      `}</style>

      <div className="pos-shell flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_minmax(300px,36%)] lg:flex lg:flex-row gap-3 lg:gap-4 p-2.5 sm:p-3 lg:p-4 max-w-[1600px] mx-auto">
        {/* ============================= MAIN ============================= */}
        <section className="flex-1 min-w-0 flex flex-col gap-3">

          {/* POS sale command bar */}
          <div className="">
            <div className="w-full flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center shadow-[var(--shadow-primary)]">
                  <Receipt size={17} />
                </div>
                <div>
                  <div className="pos-sale-kicker">POS SCREEN</div>
                  <div className="pos-sale-title">New bill</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {dashboard && (dashboard.today_sales != null || dashboard.today_bills != null) && (
                  <div className="hidden xl:flex items-center gap-3 text-xs text-[var(--muted)]">
                    {dashboard.today_bills != null && <span><b className="text-[var(--ink-secondary)]">{dashboard.today_bills}</b> bills today</span>}
                    {dashboard.today_sales != null && <span><b className="text-[var(--ink-secondary)]">{fmt(dashboard.today_sales)}</b> sold today</span>}
                  </div>
                )}
                <div className="hidden lg:flex items-center gap-1.5 text-xs text-[var(--muted)] border-l border-[var(--primary-border)] pl-3 mr-1">
                  <Clock size={13} className="text-[var(--primary)]" />
                  <span className="font-medium">{fmtDate(now)}</span>
                  <span className="font-mono text-[var(--primary-text)] font-semibold">{fmtTime(now)}</span>
                </div>
                <button type="button" className="pos-toolbar-control" onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                  {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span className="pos-control-label">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                </button>
               
              </div>
            </div>
          </div>

          {/* Search + category chips */}
          <div className="pos-card pos-scan-panel pos-search-panel p-3 space-y-2.5">
            <div className="relative" onMouseEnter={() => setSearchActive(true)} onMouseLeave={() => { if (!search) setSearchActive(false) }}>
              <Search size={1} className="absolute left- top-1/2 -translate-y-1/2 text-[var(--muted-light)] pointer-events-none" />
              <input
                ref={searchRef}
                className=" pos-input pos-search-input w-full pl-9 pr-10 h-11 rounded-lg text-[var(--ink)] placeholder:text-[var(--muted-light)]"
                placeholder="Scan barcode, search product or SKU"
                value={search}
                onFocus={() => setSearchActive(true)}
                onBlur={() => setTimeout(() => setSearchActive(false), 180)}
                onChange={e => { setSearch(e.target.value); setSearchActive(true) }}
                onKeyDown={e => e.key === 'Enter' && filtered[0] && addToCart(filtered[0])}
                autoFocus
                inputMode="search"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              {search ? (
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setSearch(''); setSearchActive(true); searchRef.current?.focus() }}
                  className="absolute right-12 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg text-[var(--muted)] hover:bg-[var(--surface-elevated)]" aria-label="Clear search">
                  <X size={15} className="mx-auto" />
                </button>
              ) : null}
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--muted-light)] border border-[var(--line)] rounded px-1.5 py-0.5">Ctrl K</kbd>

              {searchActive && (
                <div className="pos-search-popover absolute z-30 mt-2 w-full overflow-hidden rounded-xl border shadow-2xl">
                  {search.trim() ? (
                    <>
                      <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-light)]">Search results</div>
                      {filtered.length ? filtered.slice(0, 8).map(p => (
                        <button type="button" key={p.id} onMouseDown={e => e.preventDefault()} onClick={() => addToCart(p)}
                          className="pos-search-result w-full flex items-center justify-between gap-3 px-3 py-3 text-left">
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-[var(--ink)] truncate">{p.name}</span>
                            <span className="block text-[11px] text-[var(--muted-light)] truncate">SKU {p.sku || '—'} · Stock {p.current_stock ?? 0}</span>
                          </span>
                          <span className="text-right shrink-0">
                            <span className="block text-sm font-bold text-[var(--primary-text)]">{fmt(p.selling_price)}</span>
                            <span className="block text-[10px] text-[var(--muted-light)]">MRP {fmt(p.mrp || p.selling_price)}</span>
                          </span>
                        </button>
                      )) : <div className="p-4 text-sm text-[var(--muted-light)]">No products found</div>}
                    </>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
                      <div className="border-r border-[var(--line)]">
                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-light)]">Recent items</div>
                        {recentProducts.length ? recentProducts.map(p => (
                          <button type="button" key={p.id} onMouseDown={e => e.preventDefault()} onClick={() => addToCart(p)}
                            className="pos-search-result w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left">
                            <span className="truncate text-sm font-medium text-[var(--ink)]">{p.name}</span>
                            <span className="text-xs font-semibold text-[var(--primary-text)] shrink-0">{fmt(p.selling_price)}</span>
                          </button>
                        )) : <div className="px-3 py-3 text-xs text-[var(--muted-light)]">Your recently billed items will appear here.</div>}
                      </div>
                      <div>
                        <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-light)]">Recommended</div>
                        {recommendedProducts.length ? recommendedProducts.map(p => (
                          <button type="button" key={p.id} onMouseDown={e => e.preventDefault()} onClick={() => addToCart(p)}
                            className="pos-search-result w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left">
                            <span className="truncate text-sm font-medium text-[var(--ink)]">{p.name}</span>
                            <span className="text-xs font-semibold text-[var(--primary-text)] shrink-0">{fmt(p.selling_price)}</span>
                          </button>
                        )) : <div className="px-3 py-3 text-xs text-[var(--muted-light)]">No recommendations available.</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Cart */}
          <div className="pos-card pos-cart-panel flex flex-col min-h-[12rem] lg:min-h-[calc(100dvh-16rem)] overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--line-subtle)]">
              <div><b className="text-sm text-[var(--ink)]">Items in bill</b> <span className="font-normal text-[var(--muted-light)]">({cart.length} item{cart.length === 1 ? '' : 's'})</span></div>
              {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 font-medium">Clear cart</button>}
            </div>
            {cart.length ? (
              <div className="overflow-auto">
                <table className="pos-table w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-[var(--muted-light)] border-b border-[var(--line-subtle)]">
                      <th className="py-2 pl-3 pr-1 font-medium text-center">#</th>
                      <th className="py-2 pr-2 font-medium text-left">Item</th>
                      <th className="py-2 pr-2 font-medium text-right">MRP</th>
                      <th className="py-2 pr-2 font-medium text-right">Rate</th>
                      <th className="py-2 px-1 font-medium text-center">Qty</th>
                      <th className="py-2 px-2 font-medium text-right">Basic</th>
                      {showGst && <th className="py-2 px-2 font-medium text-right">GST</th>}
                      <th className="py-2 pl-2 pr-2 font-medium text-right">Total</th>
                      <th className="py-2 pr-3 font-medium text-center"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, index) => (
                      <CartRow key={item.id} item={item} index={index + 1} onQty={updateQty} showGst={showGst}
                        justAdded={item.id === lastAddedId}
                        onRemove={id => setCart(x => x.filter(i => i.id !== id))} />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[var(--muted-light)]">
                <Receipt size={32} className="mb-2 text-slate-300" />
                <div className="text-base font-medium text-[var(--muted)]">Cart is empty</div>
                <p className="text-sm mt-1">Search, scan, or tap a product above to start billing.</p>
                <button className="btn-solid mt-4" onClick={() => searchRef.current?.focus()}><Search size={15} /> Search product</button>
              </div>
            )}
          </div>
        </section>

        {/* ============================ SIDEBAR ============================ */}
        <aside className={`pos-checkout pos-mobile-checkout w-full md:w-auto lg:w-[380px] shrink-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto ${cartOpen ? 'flex' : 'hidden'} md:flex max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:max-h-[90dvh] max-md:overflow-y-auto max-md:rounded-t-2xl max-md:bg-[var(--surface-elevated)] max-md:p-3 max-md:shadow-2xl`}>
          <div className="md:hidden flex items-center justify-between rounded-xl bg-[var(--surface)] border border-[var(--line)] px-3 py-2">
            <b className="text-sm text-[var(--ink)]">Cart and checkout</b>
            <button type="button" onClick={() => setCartOpen(false)} aria-label="Close cart" className="icon-btn min-w-10 min-h-10 justify-center"><X size={18} /></button>
          </div>

          {/* Customer */}
          <div className="pos-card p-3.5">
            <div className="flex justify-between items-center mb-2">
              <b className="text-sm text-[var(--ink)]">Customer</b>
              <button className="text-xs text-[var(--primary-text)] font-semibold flex items-center gap-0.5 hover:underline" onClick={() => setShowCustomerModal(true)}>
                <Plus size={13} /> New
              </button>
            </div>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-light)]" />
              <input
                ref={customerRef}
                className="pos-input h-9 pl-8 pr-3 text-sm"
                placeholder="Walk-in customer, or search"
                value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); if (!e.target.value) setCustomer(null) }}
              />
              {customer && (
                <button onClick={() => { setCustomer(null); setCustomerSearch('') }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-[var(--muted)]">
                  <X size={14} />
                </button>
              )}
            </div>
            {customerSearch && !customer && (
              <div className="mt-1.5 border border-[var(--line)] rounded-lg overflow-hidden divide-y divide-slate-50 max-h-40 overflow-y-auto">
                <button onClick={() => { setCustomer(null); setCustomerSearch('Walk-in Customer') }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">Walk-in Customer</button>
                {filteredCustomers.slice(0, 6).map(c => (
                  <button type="button" key={c.id} onClick={() => { setCustomer(c); setCustomerSearch(c.name) }} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                    <div className="text-sm font-medium text-[var(--ink)]">{c.name}</div>
                    <div className="text-[11px] text-[var(--muted-light)]">{c.mobile}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary + grand total — the most important number on the page */}
          <div className="pos-card p-3.5">
            <b className="text-sm text-[var(--ink)]">Bill summary</b>
            <div className="mt-2 space-y-1 text-sm text-[var(--muted)]">
              <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{fmt(subtotal)}</span></div>
              <div className="flex justify-between"><span>Item discount</span><span className="tabular-nums text-rose-500">-{fmt(discount)}</span></div>
              <label className="flex items-center justify-between gap-3">
                <span>Bill discount</span>
                <input
                  ref={billDiscountRef}
                  type="number"
                  min="0"
                  max={taxableBeforeBillDiscount}
                  step="0.01"
                  value={billDiscountInput}
                  onChange={e => setBillDiscountInput(e.target.value)}
                  className="w-24 h-7 px-2 text-right text-xs rounded border border-[var(--line)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  placeholder="0.00"
                />
              </label>
              {showGst && <div className="flex justify-between"><span>GST</span><span className="tabular-nums">{fmt(tax)}</span></div>}
              <div className="flex justify-between"><span>Round off</span><span className="tabular-nums">{fmt(roundOff)}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-dashed border-[var(--line)] flex items-end justify-between">
              <span className="text-sm font-medium text-[var(--muted)]">Grand total</span>
              <strong className="pos-grand-total">{fmt(grandTotal)}</strong>
            </div>
          </div>

          {/* Payment */}
          <div className="pos-card p-3.5">
            <b className="text-sm text-[var(--ink)]">Payment</b>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2.5">
              {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => selectPayment(id)}
                  className={`pos-payment-method flex flex-col items-center justify-center gap-1 border py-2 text-[11px] font-semibold ${payment.method === id ? 'pos-payment-active' : ''}`}
                >
                  <Icon size={15} />{label}
                </button>
              ))}
            </div>

            {payment.method === 'cash' && (
              <div className="mt-3 space-y-2.5">
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Amount received</span>
                  <input
                    ref={paymentRef}
                    type="number" className="pos-input h-10 mt-1 text-sm"
                    value={payment.amount} placeholder={grandTotal.toFixed(2)}
                    onChange={e => setPayment(x => ({ ...x, amount: e.target.value, status: 'paid' }))}
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
<button
  type="button"
  onClick={setExactCash}
  className="pos-exact focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
>
  Exact
</button>
                  {CASH_CHIPS.map(v => (
                    <button key={v} onClick={() => addCashChip(v)} className="pos-chip">+{v}</button>
                  ))}
                </div>
                <div className="flex justify-between text-xs bg-[var(--surface-elevated)] rounded-lg px-3 py-2">
                  <span className="text-[var(--muted)]">Balance due <b className="text-[var(--ink)]">{fmt(balance)}</b></span>
                  <span className="text-[var(--muted)]">Change <b className="text-[var(--ink)]">{fmt(change)}</b></span>
                </div>
              </div>
            )}

            {payment.method === 'upi' && (
              <div className="mt-3 space-y-2.5">
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Merchant UPI ID</span>
                  <input
                    className="w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] text-sm text-[var(--muted)]"
                    value={upiId}
                    readOnly
                    placeholder="Configure in Settings"
                  />
                </label>

                <div className=" flex items-center justify-between px-3 py-3 rounded-lg border border-emerald-200 bg-emerald-50  flex items-center justify-between">
                  <span className="text-xs text-emerald-700">Customer pays</span>
                  <strong className="text-xl text-emerald-700 tabular-nums">{fmt(grandTotal)}</strong>
                </div>

                <button
                  className="btn-solid w-full h-11 bg-emerald-600 hover:bg-emerald-700"
                  onClick={openQuickPayment}
                  disabled={!upiId}
                >
                  <QrCode size={17} /> Show QR & Collect Payment
                </button>
              </div>
            )}

            {['card', 'online'].includes(payment.method) && (
              <div className="mt-3 space-y-2.5">
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Amount</span>
                  <input type="number" className="pos-input h-10 mt-1 text-sm" value={payment.amount} onChange={e => setPayment(x => ({ ...x, amount: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Reference (optional)</span>
                  <input className="pos-input h-10 mt-1 text-sm" value={payment.reference} onChange={e => setPayment(x => ({ ...x, reference: e.target.value }))} />
                </label>
              </div>
            )}

            {payment.method === 'credit' && (
              <p className="text-xs text-[var(--muted)] mt-3 bg-[var(--surface-elevated)] rounded-lg px-3 py-2">This amount will be recorded as customer credit and settled later.</p>
            )}

            {payment.method === 'razorpay' && (
              <div className="mt-3 space-y-2.5">
                <div className="w-full px-3 py-3 rounded-lg border border-indigo-200 bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-between">
                  <span className="text-xs text-indigo-700 font-medium">Customer pays via Razorpay</span>
                  <strong className="text-xl text-indigo-800 tabular-nums">{fmt(grandTotal)}</strong>
                </div>
                {!lastInvoice ? (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">&#9432;</span>
                    <span>Save the bill first using <b>Save Bill</b>, then click <b>Pay with Razorpay</b> to collect payment.</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowRazorpay(true)}
                    className="w-full h-12 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
                  >
                    Pay {fmt(grandTotal)} with Razorpay
                  </button>
                )}
              </div>
            )}

            {!['cash', 'credit', 'razorpay'].includes(payment.method) && (
              <div className="mt-3">
                <span className="text-xs text-[var(--muted)]">Payment status</span>
                <div className="flex gap-1.5 mt-1">
                  {['pending', 'paid', 'failed'].map(s => (
                    <button key={s} onClick={() => setPayment(x => ({ ...x, status: s }))}
                      className={`flex-1 h-8 rounded-lg text-xs font-medium border capitalize transition ${payment.status === s
                        ? s === 'paid' ? 'bg-emerald-600 border-emerald-600 text-white'
                        : s === 'failed' ? 'bg-rose-600 border-rose-600 text-white'
                        : 'bg-amber-500 border-amber-500 text-white'
                        : 'border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'}`}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Primary POS actions */}
          <div className="pos-checkout-actions bg-[var(--surface)] border border-[var(--line)] rounded-xl p-3.5 shadow-[var(--shadow-card)] space-y-2.5">
            <div className="flex items-center justify-between gap-2 pb-1">
              <div>
                <div className="text-sm font-bold text-[var(--ink)]">Complete sale</div>
                <div className="text-[11px] text-[var(--muted-light)]">Save or print the current bill</div>
              </div>
              <Receipt size={17} className="text-[var(--primary)]" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button className="btn-solid mobile-safe-button" onClick={() => saveBill(false)} disabled={saving || !cart.length}>
                <CheckCircle2 size={15} /> {saving ? 'Saving…' : 'Save Bill'}
              </button>
              <button className="btn-outline mobile-safe-button" onClick={() => lastInvoice?.id ? printInvoiceDocument(lastInvoice.id, false) : saveBill(true)} disabled={saving || (!cart.length && !lastInvoice)}>
                <Printer size={15} /> Print Bill
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button className="btn-outline mobile-safe-button pos-razorpay" onClick={() => {
                if (!lastInvoice) {
                  if (!cart.length) return toast.error('Add items before using Razorpay')
                  setPayment(x => ({ ...x, method: 'razorpay', amount: grandTotal.toFixed(2), status: 'pending' }))
                  toast('Save the bill first, then pay with Razorpay.', { icon: 'ℹ️' })
                } else setShowRazorpay(true)
              }}>
                <CreditCard size={15} /> Razorpay
              </button>
            </div>

            <button className="btn-outline w-full mobile-safe-button" onClick={() => setShowMoreActions(v => !v)} aria-expanded={showMoreActions}>
              <MoreHorizontal size={15} /> {showMoreActions ? 'Hide More Actions' : 'More Actions'}
            </button>

            {showMoreActions && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button className="btn-outline mobile-safe-button" onClick={() => openInvoiceDocument(lastInvoice?.id, false)} disabled={!lastInvoice}>
                  <FileText size={14} /> Invoice
                </button>
                <button className="btn-outline mobile-safe-button" onClick={() => printInvoiceDocument(lastInvoice?.id, true)} disabled={!lastInvoice}>
                  <Printer size={14} /> Thermal
                </button>
                <button className="btn-outline mobile-safe-button" onClick={shareInvoice} disabled={!lastInvoice}>
                  <Share2 size={14} /> Share
                </button>
                <button className="btn-outline mobile-safe-button border-amber-300 text-amber-700" onClick={saveDraft} disabled={!cart.length}>
                  <Layers size={14} /> Hold
                </button>
                {lastInvoice && <>
                  <button className="btn-outline mobile-safe-button" onClick={() => downloadInvoiceDocument(lastInvoice.id, false)}>
                    <Download size={14} /> PDF
                  </button>
                  <button className="btn-outline mobile-safe-button" onClick={() => downloadInvoiceDocument(lastInvoice.id, true)}>
                    <Download size={14} /> Thermal PDF
                  </button>
                </>}
                <button className="btn-outline mobile-safe-button col-span-2" onClick={resetBill} disabled={!cart.length && !lastInvoice}>
                  <RefreshCw size={14} /> New Bill
                </button>
              </div>
            )}

            <button className="text-xs text-[var(--muted-light)] hover:text-[var(--muted)] underline inline-flex gap-1 items-center justify-center pt-1 w-full" onClick={() => setShowShortcuts(true)}>
              <Keyboard size={13} /> Keyboard shortcuts
            </button>
          </div>

        </aside>
      </div>

      {cartOpen && <button type="button" aria-label="Close cart" onClick={() => setCartOpen(false)} className="md:hidden fixed inset-0 z-30 bg-slate-950/35" />}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="pos-mobile-cart-bar md:hidden fixed inset-x-3 z-20 min-h-13 rounded-xl bg-[var(--primary)] text-white px-4 shadow-2xl flex items-center justify-between font-bold text-sm border border-white/10"
      >
        <span className="flex items-center gap-2"><Receipt size={17} /> Cart ({cart.reduce((count, item) => count + Number(item.qty || 0), 0)})</span>
        <span>{fmt(grandTotal)}</span>
      </button>

      {/* Floating Quick Pay — kept outside checkout actions so it is always easy to reach. */}
      {!cartOpen && <button
        type="button"
        onClick={openQuickPayment}
        disabled={!upiId}
        aria-label="Quick Pay"
        title={upiId ? 'Quick Pay' : 'Configure UPI ID in Settings'}
        className="pos-floating-quick-pay"
      >
        <QrCode size={17} />
        <span>Quick Pay</span>
      </button>}

      {/* ============================ MODALS ============================ */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Add new customer" size="sm">
        <div className="space-y-3">
          <label className="block text-sm text-[var(--muted)]">Name *
            <input className="pos-input h-10 mt-1 text-sm" value={newCustomer.name} onChange={e => setNewCustomer(x => ({ ...x, name: e.target.value }))} />
          </label>
          <label className="block text-sm text-[var(--muted)]">Mobile
            <input className="pos-input h-10 mt-1 text-sm" value={newCustomer.mobile} onChange={e => setNewCustomer(x => ({ ...x, mobile: e.target.value }))} />
          </label>
          <label className="block text-sm text-[var(--muted)]">Email
            <input className="pos-input h-10 mt-1 text-sm" value={newCustomer.email} onChange={e => setNewCustomer(x => ({ ...x, email: e.target.value }))} />
          </label>
          <button className="btn-solid w-full" onClick={addCustomer}>Add customer</button>
        </div>
      </Modal>

      <Modal open={showSuccess && Boolean(lastInvoice)} onClose={() => setShowSuccess(false)} title="Bill Saved Successfully" size="sm">
        <div className="space-y-4">
<div className="flex flex-col items-center justify-center gap-1.5">
            <CheckCircle2 size={34} className="mx-auto text-blue-600 dark:text-blue-400" />
            <div className="mt-2 text-2xl font-bold text-blue-800 dark:text-blue-300">{fmt(lastInvoice?.grand_total)}</div>
            <div className="text-xs text-blue-700 dark:text-blue-400 mt-1">Invoice {lastInvoice?.invoice_number}</div>
            <button
              className="btn-solid bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700 w-full mt-3 h-10"
              onClick={() => { setShowSuccess(false); resetBill() }}
            >
              <RefreshCw size={14} /> Start New Bill
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm mt-3  border-t border-[var(--line)] pt-3">
            <dt className="text-[var(--muted)]">Payment method</dt>
            <dd className="text-right font-semibold text-[var(--ink)] capitalize">{lastInvoice?.payment_method || 'cash'}</dd>
            <dt className="text-[var(--muted)]">Amount received</dt>
            <dd className="text-right font-semibold text-[var(--ink)]">{fmt(lastInvoice?.amount_received ?? lastInvoice?.paid_amount)}</dd>
            <dt className="text-[var(--muted)]">Change</dt>
            <dd className="text-right font-semibold text-[var(--ink)]">{fmt(Math.max(0, Number(lastInvoice?.amount_received || 0) - Number(lastInvoice?.grand_total || 0)))}</dd>
          </dl>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-outline" onClick={() => printInvoiceDocument(lastInvoice?.id)}><Printer size={14} /> Print</button>
            <button className="btn-outline" onClick={() => downloadInvoiceDocument(lastInvoice?.id)}><Download size={14} /> PDF</button>
            <button className="btn-outline col-span-2" onClick={shareInvoice}><Share2 size={14} /> Share Bill + PDF</button>
            <button className="btn-outline col-span-2" onClick={() => navigate(`/invoice/${lastInvoice?.id}`)}><FileText size={14} /> View Invoice</button>
          </div>
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
          setPayment(x => ({ ...x, method: 'upi', amount: amount.toFixed(2), status: 'paid' }))
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
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[['F1', 'New bill'], ['F2', 'Product search'], ['F3', 'Customer'], ['F4', 'Payment'], ['F5', 'Hold bill'], ['F6', 'Bill discount'], ['F7', 'Print'], ['F8', 'Save'], ['Ctrl/Cmd + K', 'Global search'], ['Esc', 'Close modal']].map(([key, text]) => (
            <div key={key} className="contents">
              <kbd className="border border-[var(--line)] rounded px-2 py-1 text-center bg-[var(--surface-elevated)]">{key}</kbd>
              <span className="text-[var(--muted)]">{text}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}