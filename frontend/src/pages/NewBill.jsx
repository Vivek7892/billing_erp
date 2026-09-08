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
  Keyboard, CheckCircle2, Share2, Clock, Package, Layers, X, Banknote,
  CreditCard, Wallet, Receipt, AlertTriangle
} from 'lucide-react'
import { ErrorState, Modal, Skeleton } from '../components/UI'
import { useNavigate } from 'react-router-dom'

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
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 p-3">
          <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold">
            <QrCode size={18} />
            Scan & Pay
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            Customer scans this QR with Google Pay, PhonePe, Paytm, BHIM or another UPI app.
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
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--surface-elevated)] text-[var(--muted)] border border-[var(--line)] hover:bg-slate-100"
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

        <div ref={qrRef} className="inline-flex max-w-full p-3 sm:p-4 border-2 border-[var(--line)] rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-card)]">
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
          <div className="text-4xl font-extrabold text-[var(--ink)] tabular-nums">{fmt(numericAmount)}</div>
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
            className="btn-solid bg-emerald-600 hover:bg-emerald-700 col-span-1 sm:col-span-2 h-11 mobile-safe-button"
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
  const [cartOpen, setCartOpen] = useState(false)
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
    setTimeout(() => setLastAddedId(null), 800)
    setSearch('')
    searchRef.current?.focus()
  }, [])

  const updateQty = (id, qty) => setCart(prev => qty <= 0 ? prev.filter(item => item.id !== id) : prev.map(item => item.id === id ? recalc({ ...item, qty }) : item))

  const filtered = useMemo(() => products.filter(p => {
    const q = search.toLowerCase()
    return (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || '').includes(q)) &&
      (!catFilter || String(p.category) === catFilter)
  }), [products, search, catFilter])

  const availableProducts = useMemo(() => filtered.filter(p => p.current_stock > 0), [filtered])

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.qty, 0)
  const discount = cart.reduce((sum, item) => sum + item.unit_price * item.qty * item.discount_percent / 100, 0)
  const taxableBeforeBillDiscount = Math.max(0, subtotal - discount)
  const billDiscount = Math.min(Math.max(0, Number(billDiscountInput) || 0), taxableBeforeBillDiscount)
  const itemTax = cart.reduce((sum, item) => sum + item.unit_price * item.qty * (1 - item.discount_percent / 100) * item.gst_percent / 100, 0)
  const tax = taxableBeforeBillDiscount ? itemTax * ((taxableBeforeBillDiscount - billDiscount) / taxableBeforeBillDiscount) : 0
  const raw = taxableBeforeBillDiscount - billDiscount + tax
  const roundOff = Math.round(raw) - raw
  const grandTotal = raw + roundOff

  const selectPayment = method => setPayment({
    method,
    amount: method === 'credit' ? '' : grandTotal.toFixed(2),
    reference: '',
    status: method === 'cash' ? 'paid' : method === 'credit' ? 'credit' : 'pending',
  })

  const balance = Math.max(0, grandTotal - (payment.status === 'paid' ? Number(payment.amount || 0) : 0))
  const change = payment.method === 'cash' && payment.status === 'paid' ? Math.max(0, Number(payment.amount || 0) - grandTotal) : 0

  const filteredCustomers = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || (c.mobile || '').includes(customerSearch))

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
    setBillDiscountInput(''); setNotes(''); setLastAddedId(null); setShowSuccess(false)
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
      : payment.status
    if (payment.method !== 'credit' && !receivedAmount) {
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
        payments: payment.method === 'credit'
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
      setShowSuccess(true)
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
  }, [grandTotal, payment, cart, lastInvoice, upiId, billDiscount, navigate])

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[var(--app-bg)] text-[var(--ink)]">
      <style>{`
        .btn-solid{display:inline-flex;align-items:center;justify-content:center;gap:.375rem;min-height:2.375rem;padding:0 1rem;border-radius:var(--radius);background:var(--primary);color:#fff;font-weight:600;font-size:.8125rem;letter-spacing:.01em;transition:all .15s ease;border:1.5px solid var(--primary);box-shadow:var(--shadow-primary)}
        .btn-solid:hover:not(:disabled){background:var(--primary-hover);border-color:var(--primary-hover)}
        .btn-solid:active:not(:disabled){transform:translateY(1px) scale(.99)}
        .btn-solid:disabled{opacity:.5;cursor:not-allowed}
        .btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:.375rem;min-height:2.375rem;padding:0 .875rem;border-radius:var(--radius);border:1.5px solid var(--line);background:var(--surface);color:var(--ink-secondary);font-weight:600;font-size:.8125rem;letter-spacing:.01em;transition:all .15s ease;box-shadow:var(--shadow-xs)}
        .btn-outline:hover:not(:disabled){background:var(--surface-hover);border-color:var(--muted-light);color:var(--ink)}
        .btn-outline:active:not(:disabled){transform:translateY(1px)}
        .btn-outline:disabled{opacity:.45;cursor:not-allowed}
        @media (max-width: 639px){
          .mobile-safe-button{min-height:2.75rem}
          .mobile-modal-content{max-height:calc(100dvh - 1.5rem);overflow-y:auto}
        }
      `}</style>

      <div className="flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_minmax(300px,36%)] lg:flex lg:flex-row gap-3 lg:gap-4 p-2.5 sm:p-3 lg:p-4 max-w-[1600px] mx-auto">
        {/* ============================= MAIN ============================= */}
        <section className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Top bar: clock + quick customer QR payment + today snapshot */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl px-3 py-2 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <Clock size={13} className="text-blue-500 dark:text-blue-400" />
                <span className="font-medium text-[var(--ink-secondary)]">{fmtDate(now)}</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold tracking-wide">{fmtTime(now)}</span>
              </div>

              <div className="flex items-center gap-2">
                {dashboard && (dashboard.today_sales != null || dashboard.today_bills != null) && (
                  <div className="hidden sm:flex items-center gap-3 text-xs text-[var(--muted)]">
                    {dashboard.today_bills != null && <span><b className="text-[var(--ink-secondary)]">{dashboard.today_bills}</b> bills today</span>}
                    {dashboard.today_sales != null && <span><b className="text-[var(--ink-secondary)]">{fmt(dashboard.today_sales)}</b> sold today</span>}
                  </div>
                )}

                <button
                  onClick={openQuickPayment}
                  disabled={!upiId}
                  title={!upiId ? 'Configure UPI ID in Settings' : 'Show customer payment QR'}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-[var(--muted-light)] text-white font-bold text-xs shadow-[var(--shadow-card)] transition active:scale-[0.98]"
                >
                  <QrCode size={17} />
                  <span>Quick Pay</span>
                  {cart.length > 0 && <span className="hidden sm:inline">· {fmt(grandTotal)}</span>}
                </button>
              </div>
            </div>
          </div>

          {/* Search + category chips */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-3 shadow-[var(--shadow-card)] space-y-2.5">
            <div className="relative">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-light)]" />
              <input
                ref={searchRef}
                className="w-full h-11 pl-10 pr-16 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                placeholder="Scan barcode, or search product / SKU"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && filtered[0] && addToCart(filtered[0])}
                autoFocus
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--muted-light)] border border-[var(--line)] rounded px-1.5 py-0.5">Ctrl K</kbd>
              {search && (
                <div className="absolute z-20 mt-1 w-full bg-[var(--surface)] border border-[var(--line)] rounded-lg shadow-lg max-h-72 overflow-y-auto">
                  {filtered.length ? filtered.slice(0, 10).map(p => (
                    <button key={p.id} onClick={() => addToCart(p)} className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-950/30 border-b border-[var(--line-subtle)] last:border-0 transition-colors">
                      <span>
                        <span className="block text-sm font-medium text-[var(--ink)]">{p.name}</span>
                        <span className="block text-[11px] text-[var(--muted-light)]">SKU {p.sku} · Stock {p.current_stock}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-semibold text-[var(--ink)]">{fmt(p.selling_price)}</span>
                        <span className="block text-[11px] text-[var(--muted-light)]">MRP {fmt(p.mrp || p.selling_price)}</span>
                      </span>
                    </button>
                  )) : <div className="p-3 text-sm text-[var(--muted-light)]">No products found</div>}
                </div>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'thin' }}>
              <button
                onClick={() => setCatFilter('')}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${catFilter === '' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'}`}
              >All</button>
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCatFilter(String(c.id))}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${catFilter === String(c.id) ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-[var(--shadow-primary)]' : 'bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-elevated)]'}`}
                >{c.name}</button>
              ))}
            </div>
          </div>

          {/* Quick-add product grid */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-3 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] mb-2">
              <Package size={13} /> Quick add <span className="font-normal text-[var(--muted-light)]">({availableProducts.length} in stock)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 max-h-[15rem] overflow-y-auto pr-0.5">
              {initializing && Array.from({ length: 10 }, (_, index) => <Skeleton key={index} className="h-20" />)}
              {!initializing && availableProducts.slice(0, 30).map(p => {
                const inCart = cart.find(i => i.id === p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`relative text-left border rounded-lg p-2.5 transition-colors ${inCart ? 'border-blue-300 bg-blue-50 dark:bg-blue-950/40' : 'border-[var(--line)] hover:border-blue-200 hover:bg-blue-50/50 dark:hover:bg-blue-950/20'}`}
                  >
                    {inCart && <span className="absolute top-1.5 right-1.5 bg-[var(--primary)] text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">{inCart.qty}</span>}
                    <div className="text-xs font-medium text-[var(--ink)] truncate pr-4">{p.name}</div>
                    <div className="text-[10px] text-[var(--muted-light)] truncate">{p.sku}</div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs font-semibold text-[var(--primary-text)]">{fmt(p.selling_price)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.current_stock <= 5 ? 'bg-rose-100 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 text-emerald-600 dark:text-emerald-400'}`}>{p.current_stock}</span>
                    </div>
                  </button>
                )
              })}
              {!initializing && availableProducts.length === 0 && <div className="col-span-full text-center text-sm text-[var(--muted-light)] py-4">No products match this filter</div>}
            </div>
            {loadError && <ErrorState title="Some billing data could not be loaded" message="Products already loaded remain available. Retry to refresh products, customers, and settings." onRetry={loadInitialData} />}
          </div>

          {/* Cart */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-[var(--shadow-card)] flex-1 flex flex-col min-h-[16rem]">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--line-subtle)]">
              <b className="text-sm text-[var(--ink)]">Cart <span className="font-normal text-[var(--muted-light)]">({cart.length} item{cart.length === 1 ? '' : 's'})</span></b>
              {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 font-medium">Clear cart</button>}
            </div>
            {cart.length ? (
              <div className="overflow-auto">
                <table className="w-full text-sm">
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
        <aside className={`w-full md:w-auto lg:w-[380px] shrink-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto ${cartOpen ? 'flex' : 'hidden'} md:flex max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:max-h-[90dvh] max-md:overflow-y-auto max-md:rounded-t-2xl max-md:bg-[var(--surface-elevated)] max-md:p-3 max-md:shadow-2xl`}>
          <div className="md:hidden flex items-center justify-between rounded-xl bg-[var(--surface)] border border-[var(--line)] px-3 py-2">
            <b className="text-sm text-[var(--ink)]">Cart and checkout</b>
            <button type="button" onClick={() => setCartOpen(false)} aria-label="Close cart" className="icon-btn min-w-10 min-h-10 justify-center"><X size={18} /></button>
          </div>

          {/* Customer */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-3.5 shadow-[var(--shadow-card)]">
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
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
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
                  <button key={c.id} onClick={() => { setCustomer(c); setCustomerSearch(c.name) }} className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors">
                    <div className="text-sm font-medium text-[var(--ink)]">{c.name}</div>
                    <div className="text-[11px] text-[var(--muted-light)]">{c.mobile}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary + grand total — the most important number on the page */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-3.5 shadow-[var(--shadow-card)]">
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
              <strong className="text-3xl font-bold text-[var(--ink)] tabular-nums">{fmt(grandTotal)}</strong>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-3.5 shadow-[var(--shadow-card)]">
            <b className="text-sm text-[var(--ink)]">Payment</b>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-2.5">
              {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => selectPayment(id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border py-2 text-[11px] font-medium transition ${payment.method === id ? 'bg-[var(--primary)] border-[var(--primary)] text-white shadow-[var(--shadow-primary)]' : 'border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:border-[var(--primary-border)]'}`}
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
                    type="number" className="w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                    value={payment.amount} placeholder={grandTotal.toFixed(2)}
                    onChange={e => setPayment(x => ({ ...x, amount: e.target.value, status: 'paid' }))}
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={setExactCash} className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">Exact</button>
                  {CASH_CHIPS.map(v => (
                    <button key={v} onClick={() => addCashChip(v)} className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--surface-elevated)] text-[var(--muted)] border border-[var(--line)] hover:bg-slate-100">+{v}</button>
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

                <div className="w-full h-12 mt-1 px-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-between">
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
                  <input type="number" className="w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]" value={payment.amount} onChange={e => setPayment(x => ({ ...x, amount: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="text-xs text-[var(--muted)]">Reference (optional)</span>
                  <input className="w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]" value={payment.reference} onChange={e => setPayment(x => ({ ...x, reference: e.target.value }))} />
                </label>
              </div>
            )}

            {payment.method === 'credit' && (
              <p className="text-xs text-[var(--muted)] mt-3 bg-[var(--surface-elevated)] rounded-lg px-3 py-2">This amount will be recorded as customer credit and settled later.</p>
            )}

            {!['cash', 'credit'].includes(payment.method) && (
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

          {/* Actions */}
          <div className="bg-[var(--surface)] border border-[var(--line)] rounded-xl p-3.5 shadow-[var(--shadow-card)] space-y-2">
            <button
              className="btn-solid w-full h-12 text-sm font-bold tracking-wide"
              onClick={() => saveBill(false)}
              disabled={saving || !cart.length}
            >
              {saving ? 'Saving…' : `Save bill · ${fmt(grandTotal)}`}
            </button>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                className="btn-outline"
                onClick={() => saveBill(true)}
                disabled={saving || !cart.length}
                title="Save this bill and open the print dialog"
              >
                <Printer size={14} /> Print Bill
              </button>

              <button
                className="btn-outline"
                onClick={() => openInvoiceDocument(lastInvoice?.id, false)}
                disabled={!lastInvoice}
              >
                <Download size={14} /> View PDF
              </button>

              <button
                className="btn-outline"
                onClick={() => printInvoiceDocument(lastInvoice?.id, true)}
                disabled={!lastInvoice}
                title="Print the saved bill in thermal format"
              >
                <Printer size={14} /> Thermal Bill
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                className="btn-outline"
                onClick={openQuickPayment}
                disabled={!upiId}
              >
                <QrCode size={14} /> QR Pay
              </button>
              <button className="btn-outline w-full" onClick={shareInvoice} disabled={!lastInvoice}>
                <Share2 size={14} /> Share Bill + PDF
              </button>
              <button className="btn-outline border-amber-300 text-amber-700 hover:border-amber-500 hover:bg-amber-50 hover:text-amber-800" onClick={saveDraft}>
                <Layers size={14} /> Draft
              </button>
            </div>

            {lastInvoice && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  className="btn-outline"
                  onClick={() => downloadInvoiceDocument(lastInvoice.id, false)}
                >
                  <Download size={14} /> Download PDF
                </button>
                <button
                  className="btn-outline"
                  onClick={() => downloadInvoiceDocument(lastInvoice.id, true)}
                >
                  <Download size={14} /> Download Thermal
                </button>
              </div>
            )}

            <button className="btn-outline w-full" onClick={resetBill}>
              <RefreshCw size={14} /> New bill
            </button>

            <button
              className="text-xs text-[var(--muted-light)] hover:text-[var(--muted)] underline inline-flex gap-1 items-center pt-1"
              onClick={() => setShowShortcuts(true)}
            >
              <Keyboard size={13} /> Keyboard shortcuts
            </button>
          </div>
        </aside>
      </div>

      {cartOpen && <button type="button" aria-label="Close cart" onClick={() => setCartOpen(false)} className="md:hidden fixed inset-0 z-30 bg-slate-950/35" />}
      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="md:hidden fixed bottom-3 inset-x-3 z-20 min-h-12 rounded-xl bg-[var(--primary)] text-white px-4 shadow-xl flex items-center justify-between font-semibold text-sm"
      >
        <span className="flex items-center gap-2"><Receipt size={17} /> Cart ({cart.reduce((count, item) => count + Number(item.qty || 0), 0)})</span>
        <span>{fmt(grandTotal)}</span>
      </button>

      {/* Fixed quick customer payment action — available whenever UPI ID is configured */}
      {upiId && (
        <button
          onClick={openQuickPayment}
          title="Quick customer UPI payment"
          className="fixed right-3 bottom-20 md:right-5 md:bottom-5 z-20 inline-flex items-center gap-2 h-12 px-4 sm:px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-2xl border-2 border-white transition active:scale-[0.98]"
        >
          <QrCode size={18} />
          Quick Pay{cart.length > 0 ? ` · ${fmt(grandTotal)}` : ''}
        </button>
      )}

      {/* ============================ MODALS ============================ */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Add new customer" size="sm">
        <div className="space-y-3">
          <label className="block text-sm text-[var(--muted)]">Name *
            <input className="w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]" value={newCustomer.name} onChange={e => setNewCustomer(x => ({ ...x, name: e.target.value }))} />
          </label>
          <label className="block text-sm text-[var(--muted)]">Mobile
            <input className="w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]" value={newCustomer.mobile} onChange={e => setNewCustomer(x => ({ ...x, mobile: e.target.value }))} />
          </label>
          <label className="block text-sm text-[var(--muted)]">Email
            <input className="w-full h-10 mt-1 px-3 rounded-lg border border-[var(--line)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]" value={newCustomer.email} onChange={e => setNewCustomer(x => ({ ...x, email: e.target.value }))} />
          </label>
          <button className="btn-solid w-full" onClick={addCustomer}>Add customer</button>
        </div>
      </Modal>

      <Modal open={showSuccess && Boolean(lastInvoice)} onClose={() => setShowSuccess(false)} title="Bill Saved Successfully" size="sm">
        <div className="space-y-4">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 p-4 text-center">
            <CheckCircle2 size={34} className="mx-auto text-emerald-600 dark:text-emerald-400" />
            <div className="mt-2 text-2xl font-bold text-emerald-800">{fmt(lastInvoice?.grand_total)}</div>
            <div className="text-xs text-emerald-700 mt-1">Invoice {lastInvoice?.invoice_number}</div>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-sm">
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
            <button className="btn-solid col-span-2" onClick={() => { setShowSuccess(false); resetBill() }}><RefreshCw size={14} /> New Bill</button>
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