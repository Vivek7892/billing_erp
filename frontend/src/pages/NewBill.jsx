import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import api, { API_BASE_URL } from '../api'
import toast from 'react-hot-toast'
import {
  Search, Plus, Minus, Trash2, User, Printer, Download, RefreshCw, QrCode,
  Keyboard, CheckCircle2, Share2, Clock, Package, Layers, X, Banknote,
  CreditCard, Smartphone, Wallet, Receipt
} from 'lucide-react'
import { Modal } from '../components/UI'

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
  { id: 'online', label: 'Online', icon: Smartphone },
  { id: 'credit', label: 'Credit', icon: Wallet },
]
const CASH_CHIPS = [50, 100, 200, 500, 1000, 2000]

// ---------------------------------------------------------------------------
// Cart row
// ---------------------------------------------------------------------------
function CartRow({ item, index, onQty, onRemove, showGst, justAdded }) {
  const basic = item.unit_price * item.qty * (1 - item.discount_percent / 100)
  const gst = basic * item.gst_percent / 100
  return (
    <tr className={`border-b border-slate-100 last:border-0 transition-colors ${justAdded ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
      <td className="py-2 pl-3 pr-1 text-xs text-slate-400 text-center align-middle">{index}</td>
      <td className="py-2 pr-2 align-middle min-w-[9rem]">
        <div className="font-medium text-sm text-slate-800 leading-tight">{item.product_name}</div>
        <div className="text-[11px] text-slate-400">{item.sku}{item.hsn_code ? ` · HSN ${item.hsn_code}` : ''}</div>
      </td>
      <td className="py-2 pr-2 text-right align-middle text-xs text-slate-400 whitespace-nowrap">{fmt(item.mrp || item.unit_price)}</td>
      <td className="py-2 pr-2 text-right align-middle text-sm font-medium text-slate-700 whitespace-nowrap">{fmt(item.unit_price)}</td>
      <td className="py-2 px-1 align-middle">
        <div className="flex items-center justify-center gap-1">
          <button
            aria-label={`Decrease ${item.product_name} quantity`}
            onClick={() => onQty(item.id, item.qty - 1)}
            className="h-7 w-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition"
          ><Minus size={13} /></button>
          <input
            aria-label={`${item.product_name} quantity`}
            type="number" min="0.01" step="0.01" value={item.qty}
            onChange={e => onQty(item.id, parseFloat(e.target.value) || 0)}
            className="w-12 h-7 text-center border border-slate-200 rounded-md text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            aria-label={`Increase ${item.product_name} quantity`}
            onClick={() => onQty(item.id, item.qty + 1)}
            className="h-7 w-7 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition"
          ><Plus size={13} /></button>
        </div>
      </td>
      <td className="py-2 px-2 text-right align-middle text-sm text-slate-600 whitespace-nowrap">{fmt(basic)}</td>
      {showGst && (
        <td className="py-2 px-2 text-right align-middle whitespace-nowrap">
          <div className="text-sm text-slate-600">{fmt(gst)}</div>
          <div className="text-[10px] text-slate-400">{item.gst_percent}%</div>
        </td>
      )}
      <td className="py-2 pl-2 pr-2 text-right align-middle text-sm font-semibold text-slate-900 whitespace-nowrap">{fmt(item.total)}</td>
      <td className="py-2 pr-3 text-center align-middle">
        <button
          aria-label={`Remove ${item.product_name}`}
          onClick={() => onRemove(item.id)}
          className="text-slate-300 hover:text-rose-500 p-1 transition"
        ><Trash2 size={15} /></button>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// QR payment modal
// ---------------------------------------------------------------------------
function QrPaymentModal({ open, onClose, uri, amount, shopName, upiId, invoice, onPaid }) {
  const qrRef = useRef(null)

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
    const win = window.open('', '_blank', 'noopener,noreferrer')
    if (!win) {
      toast.error('Allow pop-ups to print the QR')
      return
    }

    const svgMarkup = qrRef.current?.querySelector('svg')?.outerHTML || ''
    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>UPI Payment QR - ${invoice || 'NEW-BILL'}</title>
          <style>
            body{font-family:Arial,sans-serif;text-align:center;padding:32px}
            h2{margin-bottom:6px}
            .amount{font-size:30px;font-weight:700;margin:14px 0}
            .upi{color:#475569}
          </style>
        </head>
        <body>
          <h2>${shopName}</h2>
          <div>Scan to pay</div>
          <div style="margin:20px">${svgMarkup}</div>
          <div class="amount">${fmt(amount)}</div>
          <div class="upi">${upiId}</div>
          <div>Invoice: ${invoice || 'NEW-BILL'}</div>
          <script>window.onload=function(){window.print();}</script>
        </body>
      </html>
    `)
    win.document.close()
  }

  return (
    <Modal open={open} onClose={onClose} title="Quick Customer Payment" size="sm">
      <div className="text-center space-y-4">
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
          <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold">
            <QrCode size={18} />
            Scan & Pay
          </div>
          <div className="text-xs text-emerald-600 mt-1">
            Customer scans this QR with Google Pay, PhonePe, Paytm, BHIM or another UPI app.
          </div>
        </div>

        <div ref={qrRef} className="inline-flex p-4 border-2 border-slate-200 rounded-2xl bg-white shadow-sm">
          <QRCodeSVG
            value={uri}
            size={240}
            level="M"
            includeMargin
            bgColor="#ffffff"
            fgColor="#111827"
          />
        </div>

        <div>
          <div className="text-4xl font-extrabold text-slate-900 tabular-nums">{fmt(amount)}</div>
          <div className="text-sm font-semibold text-slate-700 mt-1">{shopName}</div>
          <div className="text-xs text-slate-400 mt-1">{upiId || 'UPI ID not configured'}</div>
          <div className="text-xs text-slate-400">Invoice: {invoice || 'NEW-BILL'}</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={download} disabled={!upiId} className="btn-outline">
            <Download size={15} /> Download QR
          </button>
          <button onClick={print} disabled={!upiId} className="btn-outline">
            <Printer size={15} /> Print QR
          </button>
          <button
            onClick={onPaid}
            disabled={!upiId}
            className="btn-solid bg-emerald-600 hover:bg-emerald-700 col-span-2 h-11"
          >
            <CheckCircle2 size={16} /> Payment Received — Mark Paid
          </button>
          <button onClick={onClose} className="btn-outline col-span-2">Close</button>
        </div>

        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2.5 text-left">
          <b>Important:</b> QR generation does not confirm payment. Verify the money is received in the merchant account before marking the bill as paid.
        </div>
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Main billing page
// ---------------------------------------------------------------------------
export default function NewBill() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [customers, setCustomers] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [settings, setSettings] = useState({})

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [cart, setCart] = useState([])
  const [lastAddedId, setLastAddedId] = useState(null)
  const [customer, setCustomer] = useState(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [payment, setPayment] = useState({ method: 'cash', amount: '', reference: '', status: 'pending' })
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [lastInvoice, setLastInvoice] = useState(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [newCustomer, setNewCustomer] = useState({ name: '', mobile: '', email: '' })
  const [now, setNow] = useState(new Date())
  const searchRef = useRef()

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const fmtDate = d => d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  const fmtTime = d => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })

  useEffect(() => {
    api.get('/products/?status=active&page_size=200').then(r => setProducts(r.data.results || r.data))
    api.get('/categories/').then(r => setCategories(r.data.results || r.data))
    api.get('/customers/?page_size=200').then(r => setCustomers(r.data.results || r.data))
    api.get('/dashboard/').then(r => setDashboard(r.data)).catch(() => {})
    api.get('/settings/all/').then(r => setSettings(r.data)).catch(() => {})
  }, [])

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
    setSearch('')
    searchRef.current?.focus()
  }, [])

  const updateQty = (id, qty) => setCart(prev => qty <= 0 ? prev.filter(item => item.id !== id) : prev.map(item => item.id === id ? recalc({ ...item, qty }) : item))

  const filtered = useMemo(() => products.filter(p => {
    const q = search.toLowerCase()
    return (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || '').includes(q)) &&
      (!catFilter || String(p.category) === catFilter)
  }), [products, search, catFilter])

  const availableProducts = useMemo(() => products.filter(p =>
    p.current_stock > 0 &&
    (!catFilter || String(p.category) === catFilter) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase()) || (p.barcode || '').includes(search))
  ), [products, search, catFilter])

  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.qty, 0)
  const discount = cart.reduce((sum, item) => sum + item.unit_price * item.qty * item.discount_percent / 100, 0)
  const tax = cart.reduce((sum, item) => sum + item.unit_price * item.qty * (1 - item.discount_percent / 100) * item.gst_percent / 100, 0)
  const raw = subtotal - discount + tax
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
  const qrValue = upiUri(
    upiId,
    settings.upi_merchant_name || shopName,
    grandTotal,
    lastInvoice?.invoice_number || 'NEW-BILL'
  )
  const showGst = settings.gst_reg_type !== 'unregistered'

  const openQuickPayment = () => {
    if (!cart.length) {
      toast.error('Add products to the cart first')
      searchRef.current?.focus()
      return
    }
    if (!upiId) {
      toast.error('Configure shop UPI ID in Settings first')
      return
    }

    setPayment(x => ({
      ...x,
      method: 'upi',
      amount: grandTotal.toFixed(2),
      reference: '',
      status: 'pending'
    }))
    setShowQr(true)
  }

  const resetBill = () => {
    setCart([]); setCustomer(null); setCustomerSearch('')
    setPayment({ method: 'cash', amount: '', reference: '', status: 'pending' })
    setNotes(''); setLastAddedId(null)
    searchRef.current?.focus()
  }

  const saveDraft = () => {
    if (!cart.length) return toast.error('Cart is empty')
    const draft = {
      id: Date.now(), savedAt: new Date().toISOString(),
      customerName: customer?.name || customerSearch || 'Walk-in Customer',
      cart, customer, customerSearch, payment, notes,
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
    const win = window.open('', '_blank')

    if (!win) {
      toast.error('Allow pop-ups to view the invoice')
      return
    }

    // Open a blank tab immediately, then navigate after the browser grants it.
    win.opener = null
    win.location.href = url
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
    if (payment.method !== 'credit' && !Number(payment.amount)) return toast.error('Enter payment amount')

    // Important: do not open a blank window before the API request.
    // It can become an unusable blank tab when the request fails.
    setSaving(true)

    try {
      const payload = {
        customer: customer?.id || null,
        customer_name: customer?.name || 'Walk-in Customer',
        customer_phone: customer?.mobile || '',
        payment_method: payment.method,
        payment_status: payment.status,
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
              amount: Number(payment.amount),
              reference: payment.reference
            }]
      }

      const { data } = await api.post('/invoices/', payload)
      setLastInvoice(data)
      toast.success(`Bill ${data.invoice_number} saved`)

      // Keep the saved invoice available for PDF / thermal actions.
      if (print) {
        // Wait until React has committed the invoice state, then open.
        setTimeout(() => openInvoiceDocument(data.id, false), 50)
      }

      resetBill()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save bill')
    } finally {
      setSaving(false)
    }
  }

  const addCustomer = async () => {
    try {
      const { data } = await api.post('/customers/', newCustomer)
      setCustomers(x => [...x, data]); setCustomer(data); setCustomerSearch(data.name)
      setShowCustomerModal(false); setNewCustomer({ name: '', mobile: '', email: '' })
    } catch { toast.error('Failed to add customer') }
  }

  const shareInvoice = async () => {
    if (!lastInvoice) return toast.error('Save a bill first')
    const text = `${shopName} invoice ${lastInvoice.invoice_number} · ${fmt(lastInvoice.grand_total)}`
    const encoded = encodeURIComponent(`*${shopName}*\nInvoice: ${lastInvoice.invoice_number}\nTotal: ${fmt(lastInvoice.grand_total)}\nThank you!`)
    const phone = customer?.mobile || ''
    if (phone) window.open(`https://wa.me/91${phone.replace(/\D/g, '')}?text=${encoded}`, '_blank')
    else if (navigator.share) { try { await navigator.share({ title: `Invoice ${lastInvoice.invoice_number}`, text }) } catch (err) { if (err.name !== 'AbortError') toast.error('Could not share') } }
    else { await navigator.clipboard.writeText(text); toast.success('Invoice details copied') }
  }

  const setExactCash = () => setPayment(x => ({ ...x, method: 'cash', amount: grandTotal.toFixed(2), status: 'paid' }))
  const addCashChip = v => setPayment(x => ({ ...x, method: 'cash', amount: (Number(x.amount || 0) + v).toFixed(2), status: 'paid' }))

  useEffect(() => {
    const onKey = e => {
      if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); saveBill(false) }
      if (e.key === 'F2') { e.preventDefault(); selectPayment('cash') }
      if (e.key === 'F3') { e.preventDefault(); selectPayment('upi') }
      if (e.key === 'F4') { e.preventDefault(); selectPayment('card') }
      if (e.ctrlKey && e.key.toLowerCase() === 'p') { e.preventDefault(); lastInvoice?.id ? openInvoiceDocument(lastInvoice.id, false) : saveBill(true) }
      if (e.key === 'Escape') setShowQr(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [grandTotal, payment, cart, lastInvoice, upiId])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <style>{`
        .btn-solid{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;height:2.5rem;padding:0 .9rem;border-radius:.65rem;background:#4f46e5;color:#fff;font-weight:600;font-size:.8rem;transition:background .15s}
        .btn-solid:hover{background:#4338ca}
        .btn-solid:disabled{background:#c7d2fe;cursor:not-allowed}
        .btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;height:2.5rem;padding:0 .9rem;border-radius:.65rem;border:1px solid #e2e8f0;background:#fff;color:#334155;font-weight:500;font-size:.78rem;transition:background .15s}
        .btn-outline:hover{background:#f8fafc}
        .btn-outline:disabled{opacity:.45;cursor:not-allowed}
      `}</style>

      <div className="flex flex-col lg:flex-row gap-4 p-3 lg:p-4 max-w-[1600px] mx-auto">
        {/* ============================= MAIN ============================= */}
        <section className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Top bar: clock + quick customer QR payment + today snapshot */}
          <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Clock size={13} className="text-indigo-500" />
                <span className="font-medium text-slate-700">{fmtDate(now)}</span>
                <span className="font-mono text-indigo-600 font-semibold tracking-wide">{fmtTime(now)}</span>
              </div>

              <div className="flex items-center gap-2">
                {dashboard && (dashboard.today_sales != null || dashboard.today_bills != null) && (
                  <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
                    {dashboard.today_bills != null && <span><b className="text-slate-700">{dashboard.today_bills}</b> bills today</span>}
                    {dashboard.today_sales != null && <span><b className="text-slate-700">{fmt(dashboard.today_sales)}</b> sold today</span>}
                  </div>
                )}

                <button
                  onClick={openQuickPayment}
                  disabled={!cart.length || !upiId}
                  title={!upiId ? 'Configure UPI ID in Settings' : 'Show customer payment QR'}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs shadow-sm transition active:scale-[0.98]"
                >
                  <QrCode size={17} />
                  <span>Quick Pay</span>
                  <span className="hidden sm:inline">· {fmt(grandTotal)}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Search + category chips */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-2.5">
            <div className="relative">
              <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                className="w-full h-11 pl-10 pr-16 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Scan barcode, or search product / SKU"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && filtered[0] && addToCart(filtered[0])}
                autoFocus
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">Ctrl K</kbd>
              {search && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                  {filtered.length ? filtered.slice(0, 10).map(p => (
                    <button key={p.id} onClick={() => addToCart(p)} className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-indigo-50 border-b border-slate-50 last:border-0">
                      <span>
                        <span className="block text-sm font-medium text-slate-800">{p.name}</span>
                        <span className="block text-[11px] text-slate-400">SKU {p.sku} · Stock {p.current_stock}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-semibold text-slate-800">{fmt(p.selling_price)}</span>
                        <span className="block text-[11px] text-slate-400">MRP {fmt(p.mrp || p.selling_price)}</span>
                      </span>
                    </button>
                  )) : <div className="p-3 text-sm text-slate-400">No products found</div>}
                </div>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'thin' }}>
              <button
                onClick={() => setCatFilter('')}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${catFilter === '' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >All</button>
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCatFilter(String(c.id))}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition ${catFilter === String(c.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >{c.name}</button>
              ))}
            </div>
          </div>

          {/* Quick-add product grid */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
              <Package size={13} /> Quick add <span className="font-normal text-slate-400">({availableProducts.length} in stock)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2 max-h-[15rem] overflow-y-auto pr-0.5">
              {availableProducts.slice(0, 30).map(p => {
                const inCart = cart.find(i => i.id === p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`relative text-left border rounded-lg p-2.5 transition-colors ${inCart ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'}`}
                  >
                    {inCart && <span className="absolute top-1.5 right-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">{inCart.qty}</span>}
                    <div className="text-xs font-medium text-slate-800 truncate pr-4">{p.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{p.sku}</div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs font-semibold text-indigo-600">{fmt(p.selling_price)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.current_stock <= 5 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>{p.current_stock}</span>
                    </div>
                  </button>
                )
              })}
              {availableProducts.length === 0 && <div className="col-span-full text-center text-sm text-slate-400 py-4">No products match this filter</div>}
            </div>
          </div>

          {/* Cart */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 flex flex-col min-h-[16rem]">
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100">
              <b className="text-sm text-slate-800">Cart <span className="font-normal text-slate-400">({cart.length} item{cart.length === 1 ? '' : 's'})</span></b>
              {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-rose-500 hover:text-rose-600 font-medium">Clear cart</button>}
            </div>
            {cart.length ? (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
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
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <Receipt size={32} className="mb-2 text-slate-300" />
                <div className="text-base font-medium text-slate-600">Cart is empty</div>
                <p className="text-sm mt-1">Search, scan, or tap a product above to start billing.</p>
                <button className="btn-solid mt-4" onClick={() => searchRef.current?.focus()}><Search size={15} /> Search product</button>
              </div>
            )}
          </div>
        </section>

        {/* ============================ SIDEBAR ============================ */}
        <aside className="w-full lg:w-[380px] shrink-0 flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">

          {/* Customer */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <b className="text-sm text-slate-800">Customer</b>
              <button className="text-xs text-indigo-600 font-medium flex items-center gap-0.5" onClick={() => setShowCustomerModal(true)}>
                <Plus size={13} /> New
              </button>
            </div>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Walk-in customer, or search"
                value={customerSearch}
                onChange={e => { setCustomerSearch(e.target.value); if (!e.target.value) setCustomer(null) }}
              />
              {customer && (
                <button onClick={() => { setCustomer(null); setCustomerSearch('') }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                  <X size={14} />
                </button>
              )}
            </div>
            {customerSearch && !customer && (
              <div className="mt-1.5 border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-50 max-h-40 overflow-y-auto">
                <button onClick={() => { setCustomer(null); setCustomerSearch('Walk-in Customer') }} className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50">Walk-in Customer</button>
                {filteredCustomers.slice(0, 6).map(c => (
                  <button key={c.id} onClick={() => { setCustomer(c); setCustomerSearch(c.name) }} className="w-full text-left px-3 py-2 hover:bg-indigo-50">
                    <div className="text-sm font-medium text-slate-800">{c.name}</div>
                    <div className="text-[11px] text-slate-400">{c.mobile}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Summary + grand total — the most important number on the page */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
            <b className="text-sm text-slate-800">Bill summary</b>
            <div className="mt-2 space-y-1 text-sm text-slate-600">
              <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{fmt(subtotal)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span className="tabular-nums text-rose-500">-{fmt(discount)}</span></div>
              {showGst && <div className="flex justify-between"><span>GST</span><span className="tabular-nums">{fmt(tax)}</span></div>}
              <div className="flex justify-between"><span>Round off</span><span className="tabular-nums">{fmt(roundOff)}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-dashed border-slate-200 flex items-end justify-between">
              <span className="text-sm font-medium text-slate-500">Grand total</span>
              <strong className="text-3xl font-bold text-slate-900 tabular-nums">{fmt(grandTotal)}</strong>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
            <b className="text-sm text-slate-800">Payment</b>
            <div className="grid grid-cols-5 gap-1.5 mt-2.5">
              {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => selectPayment(id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border py-2 text-[11px] font-medium transition ${payment.method === id ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  <Icon size={15} />{label}
                </button>
              ))}
            </div>

            {payment.method === 'cash' && (
              <div className="mt-3 space-y-2.5">
                <label className="block">
                  <span className="text-xs text-slate-500">Amount received</span>
                  <input
                    type="number" className="w-full h-10 mt-1 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={payment.amount} placeholder={grandTotal.toFixed(2)}
                    onChange={e => setPayment(x => ({ ...x, amount: e.target.value, status: 'paid' }))}
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={setExactCash} className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">Exact</button>
                  {CASH_CHIPS.map(v => (
                    <button key={v} onClick={() => addCashChip(v)} className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100">+{v}</button>
                  ))}
                </div>
                <div className="flex justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                  <span className="text-slate-500">Balance due <b className="text-slate-800">{fmt(balance)}</b></span>
                  <span className="text-slate-500">Change <b className="text-slate-800">{fmt(change)}</b></span>
                </div>
              </div>
            )}

            {payment.method === 'upi' && (
              <div className="mt-3 space-y-2.5">
                <label className="block">
                  <span className="text-xs text-slate-500">Merchant UPI ID</span>
                  <input
                    className="w-full h-10 mt-1 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500"
                    value={upiId}
                    readOnly
                    placeholder="Configure in Settings"
                  />
                </label>

                <div className="w-full h-12 mt-1 px-3 rounded-lg border border-emerald-200 bg-emerald-50 flex items-center justify-between">
                  <span className="text-xs text-emerald-700">Customer pays</span>
                  <strong className="text-xl text-emerald-700 tabular-nums">{fmt(grandTotal)}</strong>
                </div>

                <button
                  className="btn-solid w-full h-11 bg-emerald-600 hover:bg-emerald-700"
                  onClick={openQuickPayment}
                  disabled={!upiId || !cart.length}
                >
                  <QrCode size={17} /> Show QR & Collect Payment
                </button>
              </div>
            )}

            {['card', 'online'].includes(payment.method) && (
              <div className="mt-3 space-y-2.5">
                <label className="block">
                  <span className="text-xs text-slate-500">Amount</span>
                  <input type="number" className="w-full h-10 mt-1 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={payment.amount} onChange={e => setPayment(x => ({ ...x, amount: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Reference (optional)</span>
                  <input className="w-full h-10 mt-1 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={payment.reference} onChange={e => setPayment(x => ({ ...x, reference: e.target.value }))} />
                </label>
              </div>
            )}

            {payment.method === 'credit' && (
              <p className="text-xs text-slate-500 mt-3 bg-slate-50 rounded-lg px-3 py-2">This amount will be recorded as customer credit and settled later.</p>
            )}

            {!['cash', 'credit'].includes(payment.method) && (
              <div className="mt-3">
                <span className="text-xs text-slate-500">Payment status</span>
                <div className="flex gap-1.5 mt-1">
                  {['pending', 'paid', 'failed'].map(s => (
                    <button key={s} onClick={() => setPayment(x => ({ ...x, status: s }))}
                      className={`flex-1 h-8 rounded-lg text-xs font-medium border capitalize transition ${payment.status === s
                        ? s === 'paid' ? 'bg-emerald-600 border-emerald-600 text-white'
                        : s === 'failed' ? 'bg-rose-600 border-rose-600 text-white'
                        : 'bg-amber-500 border-amber-500 text-white'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                    >{s}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-2">
            <button
              className="btn-solid w-full h-12 text-sm"
              onClick={() => saveBill(false)}
              disabled={saving || !cart.length}
            >
              {saving ? 'Saving…' : `Save bill · ${fmt(grandTotal)}`}
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                className="btn-outline"
                onClick={() => saveBill(true)}
                disabled={saving || !cart.length}
              >
                <Printer size={14} /> Print
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
                onClick={() => openInvoiceDocument(lastInvoice?.id, true)}
                disabled={!lastInvoice}
              >
                <Printer size={14} /> Thermal
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                className="btn-outline"
                onClick={openQuickPayment}
                disabled={!cart.length || !upiId}
              >
                <QrCode size={14} /> QR Pay
              </button>
              <button className="btn-outline" onClick={shareInvoice}>
                <Share2 size={14} /> Share
              </button>
              <button className="btn-outline" onClick={saveDraft}>
                <Layers size={14} /> Draft
              </button>
            </div>

            {lastInvoice && (
              <div className="grid grid-cols-2 gap-2">
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
              className="text-xs text-slate-400 hover:text-slate-600 underline inline-flex gap-1 items-center pt-1"
              onClick={() => setShowShortcuts(true)}
            >
              <Keyboard size={13} /> Keyboard shortcuts
            </button>
          </div>
        </aside>
      </div>

      {/* Fixed quick customer payment action */}
      {cart.length > 0 && upiId && (
        <button
          onClick={openQuickPayment}
          title="Quick customer UPI payment"
          className="fixed right-5 bottom-5 z-40 hidden sm:inline-flex items-center gap-2 h-12 px-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-2xl border-2 border-white transition active:scale-[0.98]"
        >
          <QrCode size={18} />
          Quick Pay · {fmt(grandTotal)}
        </button>
      )}

      {/* ============================ MODALS ============================ */}
      <Modal open={showCustomerModal} onClose={() => setShowCustomerModal(false)} title="Add new customer" size="sm">
        <div className="space-y-3">
          <label className="block text-sm text-slate-600">Name *
            <input className="w-full h-10 mt-1 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={newCustomer.name} onChange={e => setNewCustomer(x => ({ ...x, name: e.target.value }))} />
          </label>
          <label className="block text-sm text-slate-600">Mobile
            <input className="w-full h-10 mt-1 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={newCustomer.mobile} onChange={e => setNewCustomer(x => ({ ...x, mobile: e.target.value }))} />
          </label>
          <label className="block text-sm text-slate-600">Email
            <input className="w-full h-10 mt-1 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" value={newCustomer.email} onChange={e => setNewCustomer(x => ({ ...x, email: e.target.value }))} />
          </label>
          <button className="btn-solid w-full" onClick={addCustomer}>Add customer</button>
        </div>
      </Modal>

      <QrPaymentModal
        open={showQr} onClose={() => setShowQr(false)} uri={qrValue} amount={grandTotal} shopName={shopName} upiId={upiId}
        invoice={lastInvoice?.invoice_number || 'NEW-BILL'}
        onPaid={() => { setPayment(x => ({ ...x, method: 'upi', amount: grandTotal.toFixed(2), status: 'paid' })); setShowQr(false); toast.success('UPI payment marked paid') }}
      />

      <Modal open={showShortcuts} onClose={() => setShowShortcuts(false)} title="Keyboard shortcuts" size="sm">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[['Ctrl + K', 'Product search'], ['Enter', 'Add selected product'], ['Ctrl + Enter', 'Save bill'], ['F2', 'Cash'], ['F3', 'UPI'], ['F4', 'Card'], ['Ctrl + P', 'Print bill'], ['Esc', 'Close modal']].map(([key, text]) => (
            <div key={key} className="contents">
              <kbd className="border border-slate-200 rounded px-2 py-1 text-center bg-slate-50">{key}</kbd>
              <span className="text-slate-600">{text}</span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}