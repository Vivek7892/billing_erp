import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Printer,
  Download,
  Eye,
  FileText,
  User,
  Building2,
  Phone,
  MapPin,
  Receipt,
  Sliders,
  ShieldCheck,
  RefreshCw,
  Layers,
  ChevronDown,
  Copy,
  Check,
  MessageCircle,
  XCircle,
  RotateCcw,
  Search,
} from 'lucide-react'
import api, { API_BASE_URL } from '../api'
import { getAccessToken } from '../services/tokenStorage'
import invoiceService from '../features/billing/api/invoiceService'
import InvoiceDocument, { numberToIndianWords } from './InvoiceDocument'
import toast from 'react-hot-toast'

const INVOICE_TEMPLATES_LIST = [
  { id: 'gst_a4', name: 'Vertical A4 (Standard GST)', size: '210 × 297 mm', badge: 'Vertical A4', type: 'a4' },
  { id: 'half_a4', name: 'Half-A4 Bill (A5)', size: '148 × 210 mm', badge: 'Half-A4 (A5)', type: 'half_a4' },
  { id: 'stylish', name: 'Stylish A4 (Corporate Accent)', size: '210 × 297 mm', badge: 'Stylish A4', type: 'a4' },
  { id: 'thermal_80', name: 'Thermal POS Receipt (80mm)', size: '80mm Roll (3-inch)', badge: '80mm Roll', type: 'thermal_80' },
  { id: 'thermal_58', name: 'Thermal Mini Slip (58mm)', size: '58mm Roll (2-inch)', badge: '58mm Roll', type: 'thermal_58' },
]

export default function InvoiceDetailAndPreview({
  settings = {},
  onOpenCustomizer,
  onCancel,
  onRefund,
  className = '',
}) {
  const s = settings || {}
  const isHalfA4 = s.invoice_template === 'half_a4' || s.printer_type === 'half_a4' || s.invoice_template === 'advanced_gst_a5'
  const isThermal58 = s.printer_type === 'thermal_58' || s.invoice_template === 'thermal_58'
  const isThermal = s.printer_type === 'thermal' || s.printer_type === 'thermal_58' || s.invoice_template === 'thermal_80' || s.invoice_template === 'thermal_58'
  const sheetMode = isHalfA4 ? 'half_a4' : (s.invoice_template === 'stylish' ? 'stylish' : 'a4')
  const thermalMode = isThermal58 ? 'thermal_58' : 'thermal_80'
  const defaultFormat = isThermal ? thermalMode : sheetMode

  const [invoices, setInvoices] = useState([])
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('sample')
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState(defaultFormat)
  const [viewMode, setViewMode] = useState('dual') // 'dual' | 'details' | 'preview'
  const [copiedLink, setCopiedLink] = useState(false)
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false)
  const [invoiceSearch, setInvoiceSearch] = useState('')
  const printAreaRef = useRef(null)
  const userHasSelected = useRef(false)

  // 1. Fetch real recent invoices from backend
  const loadRecentInvoices = async () => {
    setLoadingInvoices(true)
    try {
      const res = await api.get('/invoices/?ordering=-created_at&page_size=25')
      const items = res.data?.results || (Array.isArray(res.data) ? res.data : [])
      setInvoices(items)
      if (items.length > 0 && !userHasSelected.current) {
        setSelectedInvoiceId(items[0].id)
      }
    } catch {
      // non-fatal, keep sample
    } finally {
      setLoadingInvoices(false)
    }
  }

  useEffect(() => {
    loadRecentInvoices()
  }, [])

  // Ctrl+P → print
  useEffect(() => {
    const handler = e => {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault()
        window.print()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 2. Comprehensive live sample invoice generated from actual store configuration
  const sampleInvoice = useMemo(() => {
    const prefix = s.invoice_prefix || 'INV-'
    const startNum = s.invoice_start_number || '1001'
    const now = new Date()
    const dueDate = new Date(now.getTime() + 15 * 86400000)

    return {
      id: 'SAMPLE-1001',
      invoice_number: `${prefix}${startNum}`,
      created_at: now.toISOString(),
      due_date: dueDate.toISOString(),
      payment_method: (s.default_payment_method || 'cash').toUpperCase(),
      payment_status: 'paid',
      status: 'completed',
      customer_name: 'Anand Kumar (Walk-in Customer)',
      customer_phone: '+91 98765 43210',
      customer_address: 'Flat 4A, Green Park Apartments, Cathedral Road, Chennai 600086',
      customer_gstin: '33AABCS1429B1ZP',
      place_of_supply: s.place_of_supply || s.shop_state || 'Tamil Nadu (33)',
      notes: s.invoice_notes || 'Thank you for your business. Retain this invoice for warranty and exchanges.',
      terms: s.invoice_terms || '1. Goods once sold will not be accepted back without bill.\n2. Warranty handled as per manufacturer terms.',
      subtotal: 1540.0,
      discount_amount: 54.0,
      tax_amount: 128.24,
      cess_amount: 0.0,
      round_off: -0.24,
      grand_total: 1614.0,
      paid_amount: 1614.0,
      balance_due: 0.0,
      public_token: 'SAMPLE-QR-TOKEN-1234',
      short_url: '',
      created_by_name: 'Admin Cashier (Counter #01)',
      items: [
        {
          id: 1,
          product_name: 'India Gate Classic Basmati Rice 5kg',
          sku: 'RICE-001',
          hsn_code: '100630',
          unit: 'kg',
          quantity: 2,
          unit_price: 280.0,
          discount_percent: 5,
          taxable_amount: 532.0,
          gst_percent: 5,
          gst_amount: 26.6,
          total: 558.6,
        },
        {
          id: 2,
          product_name: 'Fortune Sunlite Refined Sunflower Oil 1L',
          sku: 'OIL-002',
          hsn_code: '151219',
          unit: 'L',
          quantity: 3,
          unit_price: 150.0,
          discount_percent: 0,
          taxable_amount: 450.0,
          gst_percent: 5,
          gst_amount: 22.5,
          total: 472.5,
        },
        {
          id: 3,
          product_name: 'Amul Pasteurised Butter 500g Pack',
          sku: 'DAIRY-003',
          hsn_code: '040510',
          unit: 'pack',
          quantity: 2,
          unit_price: 275.0,
          discount_percent: 0,
          taxable_amount: 550.0,
          gst_percent: 12,
          gst_amount: 66.0,
          total: 616.0,
        },
        {
          id: 4,
          product_name: 'Tata Salt Iodized Vacuum Evaporated 1kg',
          sku: 'GROC-004',
          hsn_code: '250100',
          unit: 'pkt',
          quantity: 1,
          unit_price: 28.0,
          discount_percent: 0,
          taxable_amount: 28.0,
          gst_percent: 5,
          gst_amount: 1.4,
          total: 29.4,
        },
      ],
      payments: [
        {
          id: 1,
          amount: 1614.0,
          payment_method: (s.default_payment_method || 'cash').toUpperCase(),
          created_at: now.toISOString(),
          reference_id: 'TXN-9021849102',
          notes: 'Settled at checkout counter',
        },
      ],
    }
  }, [s])

  // 3. Resolve active invoice data (Selected real bill or Sample bill)
  const activeInvoice = useMemo(() => {
    if (selectedInvoiceId === 'sample') return sampleInvoice
    const found = invoices.find(inv => String(inv.id) === String(selectedInvoiceId))
    if (!found) return sampleInvoice

    // Normalize real invoice structure to ensure all display properties exist
    return {
      ...found,
      id: found.id,
      invoice_number: found.invoice_number,
      created_at: found.created_at,
      due_date: found.due_date || found.created_at,
      payment_method: (found.payment_method || 'CASH').toUpperCase(),
      payment_status: (found.payment_status || 'PAID').toLowerCase(),
      status: found.status || 'completed',
      customer_name: found.customer_name_display || found.customer_name || found.customer?.name || 'Walk-in Customer',
      customer_phone: found.customer_phone || found.customer?.phone || '',
      customer_address: found.customer_address || found.customer?.address || '',
      customer_gstin: found.customer_gstin || found.customer?.gstin || '',
      place_of_supply: found.place_of_supply || s.place_of_supply || s.shop_state || '',
      notes: found.notes || s.invoice_notes || '',
      terms: found.terms || s.invoice_terms || '',
      subtotal: Number(found.subtotal || 0),
      discount_amount: Number(found.discount_amount || 0),
      tax_amount: Number(found.tax_amount || 0),
      cess_amount: Number(found.cess_amount || 0),
      round_off: Number(found.round_off || 0),
      grand_total: Number(found.grand_total || 0),
      paid_amount: Number(found.paid_amount || 0),
      balance_due: Number(found.balance_due || Math.max(0, (found.grand_total || 0) - (found.paid_amount || 0))),
      public_token: found.public_token || '',
      short_url: found.short_url || '',
      created_by_name: found.created_by_name || 'Store Cashier',
      items: (found.items || []).map((it, idx) => ({
        id: it.id || idx + 1,
        product_name: it.product_name || it.name || 'Item',
        sku: it.sku || '',
        hsn_code: it.hsn_code || it.hsn || '',
        unit: it.unit || 'pcs',
        quantity: Number(it.quantity || 1),
        unit_price: Number(it.unit_price || it.rate || 0),
        discount_percent: Number(it.discount_percent || 0),
        taxable_amount: Number(it.taxable_amount || (Number(it.quantity || 1) * Number(it.unit_price || 0))),
        gst_percent: Number(it.gst_percent || 0),
        gst_amount: Number(it.gst_amount || 0),
        total: Number(it.total || 0),
      })),
      payments: found.payments || [],
    }
  }, [selectedInvoiceId, invoices, sampleInvoice, s])

  // Currency helper
  const fmt = val =>
    `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Date/Time helper
  const formatDate = d => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return String(d)
    }
  }

  const formatTime = d => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const isSample = activeInvoice.id === 'SAMPLE-1001'
  const isCompletedReal = !isSample && activeInvoice.status === 'completed'

  const handlePrint = () => window.print()

  const handleDownloadPdf = () => {
    if (isSample) {
      toast('Select a real invoice to download PDF')
      return
    }
    const token = getAccessToken() || ''
    const url = `${API_BASE_URL}/invoices/${activeInvoice.id}/pdf/?token=${token}&printer=${selectedFormat}`
    window.open(url, '_blank')
  }

  const copyPublicLink = () => {
    if (!activeInvoice.short_url) return
    navigator.clipboard.writeText(activeInvoice.short_url)
    setCopiedLink(true)
    toast.success('Invoice link copied')
    setTimeout(() => setCopiedLink(false), 2200)
  }

  const handleSendWhatsApp = async () => {
    if (isSample) return
    setSendingWhatsApp(true)
    const cleanPhone = (activeInvoice.customer_phone || '').replace(/\D/g, '')
    const popup = window.open('', '_blank')
    try {
      const res = await invoiceService.sendWhatsApp(activeInvoice.id, cleanPhone)
      if (res?.whatsapp_url) {
        if (popup) popup.location.href = res.whatsapp_url
        else window.location.href = res.whatsapp_url
        toast.success('WhatsApp opened!')
      } else {
        popup?.close()
        toast.error('Could not prepare WhatsApp link')
      }
    } catch {
      popup?.close()
      toast.error('Failed to send WhatsApp')
    } finally {
      setSendingWhatsApp(false)
    }
  }

  const filteredInvoices = useMemo(() => {
    if (!invoiceSearch.trim()) return invoices
    const q = invoiceSearch.toLowerCase()
    return invoices.filter(
      inv =>
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.customer_name?.toLowerCase().includes(q)
    )
  }, [invoices, invoiceSearch])

  return (
    <div className={`space-y-4 ${className}`}>
      <style>{`
        @media print {
          @page {
            size: ${
              selectedFormat === 'thermal_80'
                ? '80mm auto'
                : selectedFormat === 'thermal_58'
                ? '58mm auto'
                : selectedFormat === 'half_a4'
                ? '148mm 210mm portrait'
                : 'A4 portrait'
            };
            margin: ${
              selectedFormat === 'thermal_80' || selectedFormat === 'thermal_58'
                ? '0mm'
                : selectedFormat === 'half_a4'
                ? '4mm'
                : '6mm'
            };
          }
          body {
            background: #FFFFFF !important;
            color: #000000 !important;
          }
          .no-print { display: none !important; }
          .print-canvas-wrapper {
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Top Header & Toolbar Bar: Invoice Selector, Format Switcher & Actions */}
      <div className="no-print rounded-xl border border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          {/* Left: Invoice Data Picker */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
              <Receipt size={16} className="text-[#1E3A5F] dark:text-sky-400" />
              <span>Preview Bill:</span>
            </div>

            <div className="flex flex-col gap-1.5 min-w-[240px] sm:min-w-[340px]">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={invoiceSearch}
                  onChange={e => setInvoiceSearch(e.target.value)}
                  placeholder="Search invoice # or customer..."
                  className="w-full h-8 pl-7 pr-3 text-xs rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-[#1E3A5F]"
                />
              </div>
              <div className="relative">
                <select
                  value={selectedInvoiceId}
                  onChange={e => {
                    userHasSelected.current = true
                    setSelectedInvoiceId(e.target.value)
                  }}
                  disabled={loadingInvoices}
                  className="w-full h-9 rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 pr-8 text-xs font-semibold focus:outline-none focus:border-[#1E3A5F] shadow-2xs disabled:opacity-60"
                >
                  {loadingInvoices ? (
                    <option>Loading recent invoices...</option>
                  ) : (
                    <>
                      <option value="sample">⭐ Sample Bill ({s.shop_name || 'My Store'}) — {fmt(sampleInvoice.grand_total)}</option>
                      {filteredInvoices.map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoice_number} · {inv.customer_name || 'Walk-in'} · {fmt(inv.grand_total)} · {formatDate(inv.created_at)}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <button
              type="button"
              onClick={loadRecentInvoices}
              disabled={loadingInvoices}
              className="h-9 w-9 rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-colors shadow-2xs"
              title="Refresh invoices"
            >
              <RefreshCw size={13} className={loadingInvoices ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Right: View Mode Toggle & Print/PDF Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('dual')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === 'dual'
                    ? 'bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span className="hidden sm:inline">Side-by-Side</span>
                <span className="sm:hidden">Dual</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('details')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === 'details'
                    ? 'bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Details Only
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  viewMode === 'preview'
                    ? 'bg-white dark:bg-slate-900 text-[#1E3A5F] dark:text-sky-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Print Preview
              </button>
            </div>

            {!isSample && (
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={sendingWhatsApp}
                className="h-9 px-3.5 rounded-lg border border-transparent bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
              >
                <MessageCircle size={14} />
                <span>{sendingWhatsApp ? 'Sending…' : 'WhatsApp'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="h-9 px-3.5 rounded-lg bg-[#1E3A5F] hover:bg-[#162A45] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-colors active:scale-95"
              title="Print (Ctrl+P)"
            >
              <Printer size={13} />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="h-9 px-3 rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
              title="Download PDF"
            >
              <Download size={13} />
              <span className="hidden sm:inline">PDF</span>
            </button>

            {!isSample && activeInvoice.short_url && (
              <button
                type="button"
                onClick={copyPublicLink}
                className="h-9 px-2.5 rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 shadow-2xs transition-colors"
                title="Copy bill link"
              >
                {copiedLink ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              </button>
            )}
          </div>
        </div>

        {/* Format Selector Pill Strip */}
        <div className="mt-3 pt-3 border-t border-[#DCE3EC] dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mr-1 uppercase tracking-wider shrink-0">
              Format:
            </span>
            {[
              {
                id: sheetMode,
                label: isHalfA4 ? 'Sheet Bill (Half-A4)' : 'Sheet Bill (A4)',
                size: isHalfA4 ? '148 × 210 mm' : '210 × 297 mm',
              },
              {
                id: thermalMode,
                label: isThermal58 ? 'Thermal Receipt (58mm)' : 'Thermal Receipt (80mm)',
                size: isThermal58 ? '58mm Roll' : '80mm Roll',
              },
            ].map(fmtOption => {
              const isActive = selectedFormat === fmtOption.id
              return (
                <button
                  key={fmtOption.id}
                  type="button"
                  onClick={() => setSelectedFormat(fmtOption.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all inline-flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? 'border-[#1E3A5F] dark:border-teal-400 bg-[#1E3A5F] text-white shadow-xs dark:bg-teal-600'
                      : 'border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span>{fmtOption.label}</span>
                  <span className={`text-[10px] opacity-80 ${isActive ? 'text-teal-200' : 'text-slate-400'}`}>
                    ({fmtOption.size})
                  </span>
                </button>
              )
            })}
          </div>

          {onOpenCustomizer && (
            <button
              type="button"
              onClick={() => onOpenCustomizer(selectedFormat)}
              className="h-7 px-2.5 rounded-md border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-[#1E3A5F] dark:text-sky-400 text-xs font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
            >
              <Sliders size={12} />
              <span>Customize Layout</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Canvas: Left Invoice Detail View, Right Faithful Print Preview */}
      <div className={`grid gap-5 ${viewMode === 'dual' ? 'lg:grid-cols-[1fr_560px] xl:grid-cols-[1fr_620px]' : 'grid-cols-1'}`}>
        {/* ============================================================
            PANEL 1: STRUCTURED INVOICE DETAIL VIEW
        ============================================================ */}
        {(viewMode === 'dual' || viewMode === 'details') && (
          <div className="no-print space-y-4">
            {/* Overview & Key Indicators Card */}
            <div className="rounded-xl border border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#DCE3EC] dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-[#1E3A5F]/10 dark:bg-teal-500/10 text-[#1E3A5F] dark:text-teal-400 flex items-center justify-center font-bold">
                    <FileText size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
                        {activeInvoice.invoice_number}
                      </h3>
                      <span
                        className={`text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          activeInvoice.payment_status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : activeInvoice.payment_status === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                            : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {activeInvoice.payment_status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Issued on {formatDate(activeInvoice.created_at)} at {formatTime(activeInvoice.created_at)}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Grand Total
                  </span>
                  <div className="text-xl sm:text-2xl font-extrabold text-[#1E3A5F] dark:text-teal-300 font-mono">
                    {fmt(activeInvoice.grand_total)}
                  </div>
                </div>
              </div>

              {/* Two-Column Parties Metadata: Customer vs Business Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Customer Details Box */}
                <div className="rounded-lg border border-[#DCE3EC] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-850 p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100 text-xs">
                    <User size={14} className="text-[#0F9D91]" />
                    <span>Customer Details (Bill To)</span>
                  </div>
                  <div className="space-y-1 text-slate-700 dark:text-slate-300">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{activeInvoice.customer_name}</div>
                    {activeInvoice.customer_phone && (
                      <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <Phone size={11} />
                        <span>{activeInvoice.customer_phone}</span>
                      </div>
                    )}
                    {activeInvoice.customer_address && (
                      <div className="flex items-start gap-1 text-slate-600 dark:text-slate-400">
                        <MapPin size={11} className="mt-0.5 shrink-0" />
                        <span className="leading-tight">{activeInvoice.customer_address}</span>
                      </div>
                    )}
                    {activeInvoice.customer_gstin && (
                      <div className="font-mono text-[11px] pt-1">
                        <span className="text-slate-500">GSTIN: </span>
                        <span className="font-semibold">{activeInvoice.customer_gstin}</span>
                      </div>
                    )}
                    {activeInvoice.place_of_supply && (
                      <div className="text-[11px]">
                        <span className="text-slate-500">Place of Supply: </span>
                        <span className="font-semibold">{activeInvoice.place_of_supply}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Business Details Box */}
                <div className="rounded-lg border border-[#DCE3EC] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-850 p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100 text-xs">
                    <Building2 size={14} className="text-[#1E3A5F] dark:text-sky-400" />
                    <span>Business Details (Billed By)</span>
                  </div>
                  <div className="space-y-1 text-slate-700 dark:text-slate-300">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{s.shop_name || 'My Store'}</div>
                    {s.shop_address && (
                      <div className="text-slate-600 dark:text-slate-400 leading-tight">{s.shop_address}</div>
                    )}
                    {(s.shop_phone || s.shop_email) && (
                      <div className="text-slate-600 dark:text-slate-400 text-[11px]">
                        {s.shop_phone && `Ph: ${s.shop_phone}`}
                        {s.shop_phone && s.shop_email && ' | '}
                        {s.shop_email && s.shop_email}
                      </div>
                    )}
                    {s.shop_gstin && (
                      <div className="font-mono text-[11px] pt-1">
                        <span className="text-slate-500">GSTIN: </span>
                        <span className="font-semibold">{s.shop_gstin}</span>
                      </div>
                    )}
                    {s.shop_pan && (
                      <div className="font-mono text-[11px]">
                        <span className="text-slate-500">PAN: </span>
                        <span className="font-semibold">{s.shop_pan}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Itemized Products Table Card */}
            <div className="rounded-xl border border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
              <div className="px-4 py-3 border-b border-[#DCE3EC] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Layers size={14} className="text-[#0F9D91]" />
                  <span>Itemized Products ({activeInvoice.items.length})</span>
                </h4>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  All taxes &amp; discounts included
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[var(--surface-subtle)] border-b border-[var(--line)] text-[var(--ink)]">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10 font-bold text-[var(--muted)]">#</th>
                      <th className="py-2.5 px-3 font-bold text-[var(--ink)]">Item Description</th>
                      <th className="py-2.5 px-3 font-bold text-center text-[var(--muted)]">HSN</th>
                      <th className="py-2.5 px-3 font-bold text-center text-[var(--muted)]">Qty</th>
                      <th className="py-2.5 px-3 font-bold text-right text-[var(--muted)]">Rate</th>
                      <th className="py-2.5 px-3 font-bold text-right text-[var(--muted)]">Disc %</th>
                      <th className="py-2.5 px-3 font-bold text-right text-[var(--muted)]">Taxable</th>
                      <th className="py-2.5 px-3 font-bold text-right text-[var(--muted)]">GST %</th>
                      <th className="py-2.5 px-3 font-bold text-right text-[var(--ink)]">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE3EC] dark:divide-slate-800">
                    {activeInvoice.items.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{item.product_name}</div>
                          {item.sku && (
                            <div className="font-mono text-[10px] text-slate-500">SKU: {item.sku}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                          {item.hsn_code || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {item.quantity} {item.unit || ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          {fmt(item.unit_price)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {item.discount_percent ? `${item.discount_percent}%` : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                          {fmt(item.taxable_amount || item.quantity * item.unit_price)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {item.gst_percent ? `${item.gst_percent}%` : '0%'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {fmt(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Totals, Taxes & Words Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left Box: Words & Legal Info */}
              <div className="rounded-xl border border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs shadow-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Amount in Words
                  </span>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-[#DCE3EC] dark:border-slate-700 leading-snug">
                    {numberToIndianWords(activeInvoice.grand_total)}
                  </div>
                </div>

                {activeInvoice.notes && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                      Notes
                    </span>
                    <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                      {activeInvoice.notes}
                    </p>
                  </div>
                )}

                {activeInvoice.terms && (
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                      Terms &amp; Conditions
                    </span>
                    <p className="text-slate-500 dark:text-slate-400 text-[10.5px] whitespace-pre-line leading-relaxed">
                      {activeInvoice.terms}
                    </p>
                  </div>
                )}
              </div>

              {/* Right Box: Math Calculations & Taxes Summary */}
              <div className="rounded-xl border border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2 text-xs shadow-xs font-mono">
                <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                  <span>Gross Subtotal</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{fmt(activeInvoice.subtotal)}</span>
                </div>
                {activeInvoice.discount_amount > 0 && (
                  <div className="flex justify-between py-1 text-rose-600 dark:text-rose-400 font-semibold">
                    <span>Discount Savings</span>
                    <span>-{fmt(activeInvoice.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                  <span>GST Taxes (SGST + CGST)</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{fmt(activeInvoice.tax_amount)}</span>
                </div>
                {activeInvoice.cess_amount > 0 && (
                  <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                    <span>CESS Tax</span>
                    <span className="font-semibold">{fmt(activeInvoice.cess_amount)}</span>
                  </div>
                )}
                {activeInvoice.round_off !== 0 && (
                  <div className="flex justify-between py-1 text-slate-600 dark:text-slate-400">
                    <span>Round Off Adjustment</span>
                    <span className="font-semibold">{fmt(activeInvoice.round_off)}</span>
                  </div>
                )}
                <div className="border-t-2 border-slate-900 dark:border-slate-700 pt-2.5 mt-1 flex justify-between items-center text-sm font-bold text-slate-900 dark:text-slate-100">
                  <span className="uppercase tracking-tight">Grand Total</span>
                  <span className="text-base text-[#1E3A5F] dark:text-teal-300 font-extrabold">
                    {fmt(activeInvoice.grand_total)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                  <span>Paid Amount</span>
                  <span>{fmt(activeInvoice.paid_amount)}</span>
                </div>
                {activeInvoice.balance_due > 0 && (
                  <div className="flex justify-between pt-0.5 text-xs text-amber-700 dark:text-amber-400 font-bold">
                    <span>Balance Due</span>
                    <span>{fmt(activeInvoice.balance_due)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment & Statutory Audit Details Card */}
            <div className="rounded-xl border border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-[#DCE3EC] dark:border-slate-800 pb-2.5">
                <ShieldCheck size={16} className="text-[#0F9D91]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                  Payment &amp; Statutory Audit Trail
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-slate-850 border border-[#DCE3EC] dark:border-slate-800 sm:col-span-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Payment Breakdown</span>
                  {activeInvoice.payments?.length > 0 ? (
                    <div className="space-y-1">
                      {activeInvoice.payments.map((p, i) => (
                        <div key={p.id || i} className="flex justify-between text-xs">
                          <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">{p.method || p.payment_method || 'Cash'}</span>
                          <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{fmt(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">{activeInvoice.payment_method || 'Cash'}</span>
                      <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">{fmt(activeInvoice.paid_amount)}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-slate-850 border border-[#DCE3EC] dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Cashier / Billed By</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block truncate">
                    {activeInvoice.created_by_name || 'Store Cashier'}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-[#F8FAFC] dark:bg-slate-850 border border-[#DCE3EC] dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Verification Token</span>
                  <span className="font-mono text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 mt-0.5 block truncate">
                    {activeInvoice.public_token || 'SYS-AUDIT-OK'}
                  </span>
                </div>
              </div>

              {isCompletedReal && (onCancel || onRefund) && (
                <div className="flex gap-2 pt-3 border-t border-[#DCE3EC] dark:border-slate-800">
                  {onCancel && (
                    <button
                      type="button"
                      onClick={() => onCancel(activeInvoice.id)}
                      className="h-8 px-3 text-xs font-semibold rounded border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <XCircle size={13} />
                      Cancel Invoice
                    </button>
                  )}
                  {onRefund && (
                    <button
                      type="button"
                      onClick={() => onRefund(activeInvoice.id)}
                      className="h-8 px-3 text-xs font-semibold rounded border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw size={13} />
                      Refund Invoice
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================
            PANEL 2: FAITHFUL PRINT PREVIEW CANVAS
        ============================================================ */}
        {(viewMode === 'dual' || viewMode === 'preview') && (
          <div className="print-canvas-wrapper flex flex-col items-center">
            {/* Faithful Print Document Card */}
            <div className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3 sm:p-5 flex flex-col items-center justify-start overflow-x-auto shadow-xs">
              <div className="no-print mb-3 text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--surface)] text-[var(--ink)] border border-[var(--line)] shadow-2xs">
                  <Eye size={13} className="text-[var(--accent)]" />
                  <span>Faithful Print Preview: {INVOICE_TEMPLATES_LIST.find(t => t.id === selectedFormat)?.name || selectedFormat.toUpperCase()}</span>
                </span>
              </div>

              {/* Document Rendering */}
              <div
                ref={printAreaRef}
                className="bg-white text-black shadow-md border border-slate-300 rounded-sm overflow-hidden origin-top transition-transform max-w-full"
              >
                <InvoiceDocument
                  invoice={activeInvoice}
                  settings={s}
                  mode={selectedFormat}
                  showModePicker={false}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

