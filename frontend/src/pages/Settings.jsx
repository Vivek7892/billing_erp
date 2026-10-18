import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Building2,
  Receipt,
  FileText,
  Printer,
  Barcode,
  Users,
  Bell,
  Percent,
  CreditCard,
  FileSpreadsheet,
  Tag,
  Gift,
  HelpCircle,
  Keyboard,
  LogOut,
  Check,
  ChevronDown,
  ChevronUp,
  Upload,
  Trash2,
  Save,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  Copy,
  Menu,
  X,
  UserCheck,
  Sliders,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  PhoneCall,
  Mail,
} from 'lucide-react'
import JsBarcode from 'jsbarcode'
import { QRCodeSVG } from 'qrcode.react'
import api from '../api'
import toast from 'react-hot-toast'
import { useAuth } from '../AuthContext'
import InvoiceDocument, { isTrue } from '../components/InvoiceDocument'
import { drawTabletopStandeeCanvas, generatePrintStandHtml, loadUpiBrandLogos } from '../components/UpiLogos'
import merchantStandIllustration from '../assets/merchant-qr-stand.svg'
import googlePayLogo from '../assets/google-pay.svg'
import phonePeLogo from '../assets/phonepe.svg'
import paytmLogo from '../assets/paytm.svg'
import { Spinner } from '../components/UI'
import { SETTINGS_TABS } from '../components/SettingsNavigation'
import './Settings.css'

/* =====================================================================
   INDIAN STATES & UNION TERRITORIES WITH GST STATE CODES
===================================================================== */
const INDIAN_STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman and Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
]

/* =====================================================================
   BARCODE LABEL SIZES
===================================================================== */
const BARCODE_LABEL_SIZES = [
  { id: '50x25', label: '50 × 25 mm', desc: 'Standard Retail Roll (Most Popular)', type: 'label' },
  { id: '38x25', label: '38 × 25 mm', desc: 'Compact Kirana / Jewelry Roll', type: 'label' },
  { id: 'a4_3x5', label: 'A4 · 3×5 Sheet', desc: '15 Labels / Sheet (64 × 54 mm)', type: 'a4' },
  { id: 'a4_4x8', label: 'A4 · 4×8 Sheet', desc: '32 Labels / Sheet (48 × 34 mm)', type: 'a4' },
  { id: '80mm_roll', label: '80 mm Thermal Multi-bar', desc: 'POS continuous slip', type: 'label' },
]

const INVOICE_THEME_COLORS = [
  { name: 'Black', value: '#111827' },
  { name: 'Green', value: '#16803c' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Gold', value: '#b7791f' },
  { name: 'Orange', value: '#ea580c' },
]

/* =====================================================================
   REUSABLE UI COMPONENTS
===================================================================== */
function SettingRow({ label, description, required = false, children, error, id }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-6 py-3.5 border-b border-slate-200 items-start">
      <div className="md:col-span-4 lg:col-span-4">
        <label htmlFor={id} className="text-xs font-semibold text-slate-900 block">
          {label} {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
        {description && (
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
        {error && (
          <p className="text-[11px] text-rose-600 mt-1 font-medium flex items-center gap-1">
            <AlertCircle size={12} />
            <span>{error}</span>
          </p>
        )}
      </div>
      <div className="md:col-span-8 lg:col-span-8">{children}</div>
    </div>
  )
}

function TextInput({ id, value, onChange, placeholder, type = 'text', disabled = false, mono = false, error, maxLength }) {
  return (
    <input
      id={id}
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      className={`w-full h-10 sm:h-9 px-3 text-xs rounded-lg border bg-white text-slate-900 shadow-2xs transition-colors focus:outline-none ${
        mono ? 'font-mono' : ''
      } ${
        error
          ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
          : 'border-slate-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600'
      } disabled:opacity-60 disabled:bg-slate-50`}
    />
  )
}

function SelectInput({ id, value, onChange, options = [], disabled = false }) {
  return (
    <select
      id={id}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full h-10 sm:h-9 px-3 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 shadow-2xs focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none disabled:opacity-60"
    >
      {options.map(([optVal, optLabel]) => (
        <option key={optVal} value={optVal}>
          {optLabel}
        </option>
      ))}
    </select>
  )
}

function TextAreaInput({ id, value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      id={id}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 shadow-2xs focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 focus:outline-none"
    />
  )
}

function CheckboxField({ checked, onChange, label, description, disabled = false }) {
  return (
    <label className={`flex items-start gap-2.5 cursor-pointer select-none group ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer disabled:cursor-not-allowed"
      />
      <div className="min-w-0">
        <span className="text-xs font-semibold text-slate-800 block leading-snug">
          {label}
        </span>
        {description && (
          <span className="text-[11px] text-slate-500 block mt-0.5 leading-relaxed">
            {description}
          </span>
        )}
      </div>
    </label>
  )
}

function AccordionSection({ title, subtitle, icon: Icon, isOpen, onToggle, children, badge }) {
  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs transition-all">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3.5 sm:p-4 text-left hover:bg-slate-50/80 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              isOpen ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <Icon size={16} />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">{title}</span>
              {badge && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        <div className="text-slate-400 p-1 shrink-0">
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      {isOpen && (
        <div className="p-4 pt-2 border-t border-slate-100 bg-white space-y-3.5">
          {children}
        </div>
      )}
    </div>
  )
}

function PageHeader({ title, description }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-200">
      <div>
        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">
            {description}
          </p>
        )}
      </div>
      <span className="text-[11px] text-slate-500">Changes save from the Settings bar.</span>
    </div>
  )
}

/* =====================================================================
   LIVE BARCODE SVG PREVIEW COMPONENT
===================================================================== */
function BarcodeSvgCanvas({
  barcodeValue = '8901030382918',
  width = 1.6,
  height = 36,
  displayValue = true,
  fontSize = 11,
}) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (!svgRef.current) return
    try {
      JsBarcode(svgRef.current, String(barcodeValue || '8901030382918'), {
        format: 'CODE128',
        width: Math.max(1, Math.min(3, Number(width) || 1.6)),
        height: Math.max(20, Math.min(80, Number(height) || 36)),
        displayValue: Boolean(displayValue),
        fontSize: Math.max(9, Math.min(14, Number(fontSize) || 11)),
        margin: 2,
        textMargin: 2,
        background: '#ffffff',
        lineColor: '#000000',
      })
    } catch {
      // Ignore barcode encoding exceptions for live draft edits
    }
  }, [barcodeValue, width, height, displayValue, fontSize])

  return <svg ref={svgRef} className="max-w-full block mx-auto" />
}

/* =====================================================================
   MAIN SETTINGS PAGE COMPONENT
===================================================================== */
export default function Settings() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // 1. Resolve Active Tab from URL query params
  const rawTab = searchParams.get('tab') || 'manage-business'
  const activeTab = useMemo(() => {
    if (rawTab === 'business') return 'manage-business'
    if (rawTab === 'billing') return 'invoice-settings'
    if (rawTab === 'templates') return 'print-settings'
    const found = SETTINGS_TABS.find(item => item.id === rawTab)
    return found ? found.id : 'manage-business'
  }, [rawTab])

  const activeTabObj = useMemo(() => {
    return SETTINGS_TABS.find(item => item.id === activeTab) || SETTINGS_TABS[0]
  }, [activeTab])

  // 2. Settings State & Persistence
  const [settings, setSettings] = useState({})
  const [initialSettings, setInitialSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingTemplateId, setSavingTemplateId] = useState(null)
  const [showAllTemplates, setShowAllTemplates] = useState(false)
  const [showCustomTheme, setShowCustomTheme] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)

  // Print Settings Tab sub-view: 'thermal' or 'barcode'
  const [printSubTab, setPrintSubTab] = useState('thermal')

  // Preview & Zoom controls
  const [previewZoom, setPreviewZoom] = useState(1)
  const [previewFitScale, setPreviewFitScale] = useState(1)
  const [downloadingQrPng, setDownloadingQrPng] = useState(false)

  // Accordion open states
  const [invoiceAccordions, setInvoiceAccordions] = useState({
    theme: true,
    invoiceDetails: false,
    party: false,
    columns: false,
    misc: false,
  })

  const [thermalAccordions, setThermalAccordions] = useState({
    invoiceDetails: true,
    party: false,
    columns: false,
    misc: false,
  })

  // Sample Product for Barcode Preview Testing
  const [testProduct, setTestProduct] = useState({
    name: 'Cadbury Dairy Milk Silk 150g',
    sku: 'CHOC-001',
    barcode: '8901030382918',
    mrp: '180.00',
    price: '165.00',
  })

  const logoInputRef = useRef(null)
  const previewAreaRef = useRef(null)

  // Field Updater
  const setField = useCallback((key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
      ...(['invoice_theme_color', 'invoice_theme_secondary', 'invoice_font', 'invoice_header_layout', 'invoice_border_style', 'invoice_table_style', 'invoice_layout'].includes(key)
        ? { custom_theme_enabled: 'true' }
        : {}),
    }))
  }, [])

  // Check Dirty State
  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(initialSettings)
  }, [settings, initialSettings])

  // Load Settings from Backend
  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/settings/all/')
      const data = res.data || {}
      setSettings(data)
      setInitialSettings(data)
    } catch {
      toast.error('Failed to load shop settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Save Settings to Backend
  const saveCurrentSettings = async (reason = 'Settings updated via settings console') => {
    setSaving(true)
    try {
      const payload = {}
      Object.keys(settings).forEach(key => {
        if (key !== 'active_templates' && key !== 'template_settings') {
          payload[key] = settings[key]
        }
      })
      payload.reason = reason

      await api.post('/settings/bulk_update/', payload)
      toast.success('Settings saved successfully')
      setInitialSettings({ ...settings })
      window.dispatchEvent(new CustomEvent('shop-settings-updated', { detail: settings }))
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to save settings'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleSelectInvoiceTemplate = async template => {
    if (!template?.id || savingTemplateId) return
    setSavingTemplateId(template.id)
    setSettings(previous => ({
      ...previous,
      invoice_template: template.id,
      invoice_layout: template.format === 'thermal' ? 'thermal' : template.format === 'half_a4' ? 'compact' : 'standard',
      active_templates: { ...(previous.active_templates || {}), default: template.id },
    }))
    try {
      const { data: activeMap } = await api.post('/settings/templates/select-active/', {
        format: 'default',
        template_id: template.id,
      })
      const updateTemplateState = previous => {
        const templateSettings = previous.template_settings || {}
        const templates = (templateSettings.templates || []).map(item => ({
          ...item,
          is_default: activeMap.default === item.id,
          is_format_active: (item.format === 'a4' && activeMap.a4 === item.id)
            || (item.format === 'half_a4' && activeMap.half_a4 === item.id)
            || (item.format === 'thermal' && activeMap.thermal === item.id),
        }))
        return {
          ...previous,
          invoice_template: activeMap.default || template.id,
          invoice_layout: template.format === 'thermal' ? 'thermal' : template.format === 'half_a4' ? 'compact' : 'standard',
          active_templates: activeMap,
          template_settings: { ...templateSettings, active: activeMap, templates },
        }
      }
      setSettings(updateTemplateState)
      setInitialSettings(updateTemplateState)
      window.dispatchEvent(new CustomEvent('shop-settings-updated'))
      toast.success(`${template.name} selected as the default invoice template`)
    } catch (error) {
      await loadSettings()
      toast.error(error.response?.data?.error || 'Unable to update the active invoice template')
    } finally {
      setSavingTemplateId(null)
    }
  }

  // Logo Upload
  const handleLogoUpload = async e => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, or SVG)')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file size must be less than 2 MB')
      return
    }

    setUploadingLogo(true)
    const fd = new FormData()
    fd.append('logo', file)

    try {
      const { data } = await api.post('/settings/upload-logo/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const logoUrl = data.url || data.logo || ''
      setField('shop_logo', logoUrl)
      setInitialSettings(prev => ({ ...prev, shop_logo: logoUrl }))
      toast.success('Logo uploaded successfully')
    } catch {
      toast.error('Failed to upload business logo')
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ''
    }
  }

  // Logo Removal
  const handleLogoRemove = async () => {
    setRemovingLogo(true)
    try {
      await api.post('/settings/remove-logo/')
      setField('shop_logo', '')
      setInitialSettings(prev => ({ ...prev, shop_logo: '' }))
      toast.success('Logo removed')
    } catch {
      toast.error('Failed to remove logo')
    } finally {
      setRemovingLogo(false)
    }
  }

  // Realistic Sample Invoice for Live Document Previews
  const sampleInvoice = useMemo(() => {
    const prefix = settings.invoice_prefix || 'INV-'
    const startNum = settings.invoice_start_number || '1001'
    return {
      invoice_number: `${prefix}${/[-/_]$/.test(prefix) ? '' : '-'}${String(startNum).padStart(4, '0')}`,
      created_at: new Date().toISOString(),
      due_date: new Date(Date.now() + 15 * 86400000).toISOString(),
      payment_method: (settings.default_payment_method || 'cash').toUpperCase(),
      payment_status: 'PAID',
      customer_name: 'Metro Retail Mart',
      customer_phone: '+91 98765 43210',
      customer_address: '42, Mount Road, Guindy, Chennai 600032',
      customer_gstin: settings.gst_reg_type !== 'unregistered' ? '33AABCS1429B1ZP' : '',
      place_of_supply: settings.place_of_supply || settings.shop_state || 'Tamil Nadu (33)',
      notes: settings.invoice_notes || 'Thank you for shopping with us! Visit again.',
      terms: settings.invoice_terms || '1. Goods once sold will be exchanged within 7 days.\n2. Please retain original invoice for claims.',
      items: [
        {
          product_name: 'India Gate Basmati Rice 5kg',
          description: 'Premium aged long-grain basmati rice',
          sku: 'RICE-001',
          hsn_code: '100630',
          unit: 'kg',
          quantity: 2,
          unit_price: 260,
          discount_percent: 5,
          gst_percent: 5,
          total: 518.7,
        },
        {
          product_name: 'Fortune Sunflower Oil 1L Pouch',
          description: 'Refined sunflower cooking oil',
          sku: 'OIL-001',
          hsn_code: '151219',
          unit: 'L',
          quantity: 3,
          unit_price: 145,
          discount_percent: 0,
          gst_percent: 5,
          total: 456.75,
        },
        {
          product_name: 'Amul Pasteurised Butter 500g',
          description: 'Pure salted dairy butter pack',
          sku: 'DAIRY-001',
          hsn_code: '040510',
          unit: 'pack',
          quantity: 2,
          unit_price: 275,
          discount_percent: 0,
          gst_percent: 12,
          total: 616.0,
        },
      ],
      subtotal: 1475.0,
      discount_amount: 26.0,
      tax_amount: 116.45,
      grand_total: 1565.45,
      paid_amount: 1565.45,
      balance_due: 0,
    }
  }, [settings])

  // Merchant QR Value for Bank / UPI Tab
  const merchantQrValue = useMemo(() => {
    if (!settings.shop_upi_id) return ''
    const merchantName = settings.upi_merchant_name || settings.shop_name || ''
    return `upi://pay?pa=${encodeURIComponent(settings.shop_upi_id)}&pn=${encodeURIComponent(merchantName)}&cu=INR`
  }, [settings.shop_upi_id, settings.upi_merchant_name, settings.shop_name])

  // Print Actions
  const printInvoiceDirect = (targetMode) => {
    const isHalfA4 = targetMode === 'compact' || targetMode === 'half_a4'
    const pageSize = isHalfA4 ? 'A5 portrait' : 'A4 portrait'
    document.getElementById('settings-invoice-print-page')?.remove()
    const pageStyle = document.createElement('style')
    pageStyle.id = 'settings-invoice-print-page'
    pageStyle.textContent = `@page { size: ${pageSize}; margin: 0; }`
    document.head.appendChild(pageStyle)
    document.body.classList.add('settings-invoice-print')
    const cleanup = () => {
      document.body.classList.remove('settings-invoice-print')
      pageStyle.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup, { once: true })
    requestAnimationFrame(() => window.print())
  }

  const printThermalDirect = () => {
    const is58 = settings.thermal_paper_width === '58' || settings.thermal_paper_width === '2'
    const pageSize = `${is58 ? '58mm' : '80mm'} 200mm`
    document.getElementById('settings-invoice-print-page')?.remove()
    const pageStyle = document.createElement('style')
    pageStyle.id = 'settings-invoice-print-page'
    pageStyle.textContent = `@page { size: ${pageSize}; margin: 0; }`
    document.head.appendChild(pageStyle)
    document.body.classList.add('settings-invoice-print')
    const cleanup = () => {
      document.body.classList.remove('settings-invoice-print')
      pageStyle.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup, { once: true })
    requestAnimationFrame(() => window.print())
  }

  const printBarcodeLabelDirect = () => {
    const labelSize = settings.barcode_label_size || '50x25'
    const sheetLayout = labelSize === 'a4_4x8'
      ? { columns: 4, rows: 8, width: 48, height: 34, gap: 2 }
      : labelSize === 'a4_3x5' ? { columns: 3, rows: 5, width: 64, height: 54, gap: 3 } : null
    const rollWidth = labelSize === '38x25' ? 38 : labelSize === '80mm_roll' ? 80 : 50
    const rollHeight = labelSize === '80mm_roll' ? 50 : 25
    const printWindow = window.open('', '_blank', 'width=450,height=400')
    if (!printWindow) {
      toast.error('Allow pop-ups to print barcode labels')
      return
    }

    const svgMarkup = document.querySelector('#barcode-preview-canvas svg')?.outerHTML || ''
    const bizName = isTrue(settings.barcode_show_business_name, true) ? (settings.shop_name || 'MY STORE') : ''
    const prodName = isTrue(settings.barcode_show_product_name, true) ? testProduct.name : ''
    const mrp = isTrue(settings.barcode_show_mrp, true) ? `MRP: ₹${testProduct.mrp}` : ''
    const price = isTrue(settings.barcode_show_selling_price, true) ? `₹${testProduct.price}` : ''
    const isBold = isTrue(settings.barcode_bold, true)
    const align = settings.barcode_align || 'center'
    const labelFont = settings.barcode_font_size === 'large' ? 13 : settings.barcode_font_size === 'small' ? 9 : 11
    const sku = isTrue(settings.barcode_show_sku, true) && testProduct.sku ? `SKU: ${testProduct.sku}` : ''
    const escapeHtml = value => String(value || '').replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' })[char])
    const safeLabelContent = `
      ${bizName ? `<div class="store-name">${escapeHtml(bizName)}</div>` : ''}
      ${prodName ? `<div class="prod-name">${escapeHtml(prodName)}</div>` : ''}
      ${svgMarkup}
      ${sku ? `<div class="sku">${escapeHtml(sku)}</div>` : ''}
      ${(mrp || price) ? `<div class="prices">${mrp ? `<span class="mrp">${escapeHtml(mrp)}</span>` : ''}${price ? `<span class="price">${escapeHtml(price)}</span>` : ''}</div>` : ''}
    `
    const labels = sheetLayout
      ? `<main class="sheet">${Array.from({ length: sheetLayout.columns * sheetLayout.rows }, () => `<article class="label-box">${safeLabelContent}</article>`).join('')}</main>`
      : `<main class="roll">${safeLabelContent}</main>`
    const pageSize = sheetLayout ? 'A4 portrait' : `${rollWidth}mm ${rollHeight}mm`

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode Label</title>
          <style>
            @page { size: ${pageSize}; margin: 0; }
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; font-family: Arial, sans-serif; text-align: ${align}; color: #111; }
            .sheet { width: 210mm; height: 297mm; padding: ${sheetLayout ? Math.max(0, (297 - sheetLayout.rows * sheetLayout.height - (sheetLayout.rows - 1) * sheetLayout.gap) / 2) : 0}mm ${sheetLayout ? Math.max(0, (210 - sheetLayout.columns * sheetLayout.width - (sheetLayout.columns - 1) * sheetLayout.gap) / 2) : 0}mm; display: grid; gap: ${sheetLayout?.gap || 0}mm; grid-template-columns: repeat(${sheetLayout?.columns || 1}, ${sheetLayout?.width || rollWidth}mm); grid-template-rows: repeat(${sheetLayout?.rows || 1}, ${sheetLayout?.height || rollHeight}mm); align-content: start; justify-content: center; }
            .label-box { width: ${sheetLayout?.width || rollWidth}mm; height: ${sheetLayout?.height || rollHeight}mm; padding: 1.5mm; display: flex; flex-direction: column; justify-content: center; overflow: hidden; text-align: ${align}; }
            .roll { width: ${rollWidth}mm; height: ${rollHeight}mm; padding: 1mm; display: flex; flex-direction: column; justify-content: center; overflow: hidden; text-align: ${align}; }
            .store-name { font-size: ${Math.max(8, labelFont - 2)}px; font-weight: bold; text-transform: uppercase; }
            .prod-name { font-size: ${labelFont}px; font-weight: ${isBold ? 'bold' : 'normal'}; margin: 1px 0; }
            .sku { font-size: 8px; margin-top: 1px; }
            .prices { font-size: 11px; margin-top: 1px; display: flex; justify-content: center; gap: 3px; }
            .mrp { text-decoration: line-through; color: #555; font-size: 9px; margin-right: 4px; }
            .price { font-weight: ${isBold ? 'bold' : 'normal'}; font-size: ${labelFont}px; }
            svg { display: block; margin: 1px auto; width: 95%; max-height: ${Number(settings.barcode_height) || 36}px; }
            @media print { .sheet, .roll { break-inside: avoid; } }
          </style>
        </head>
        <body>
          ${labels}
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  // QR Stand actions
  const printMerchantQrStand = () => {
    if (!merchantQrValue) {
      toast.error('Add a merchant UPI ID in Payment & Bank Details first')
      return
    }
    const svg = document.querySelector('#merchant-qr-preview svg')
    if (!svg) return
    const qrSvg = svg.cloneNode(true)
    qrSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    qrSvg.setAttribute('width', '240')
    qrSvg.setAttribute('height', '240')
    const win = window.open('', '_blank', 'width=480,height=760')
    if (!win) {
      toast.error('Allow pop-ups to print the QR stand')
      return
    }
    win.onload = () => {
      win.focus()
      win.print()
    }
    win.document.open()
    win.document.write(generatePrintStandHtml({
      shopName: settings.upi_merchant_name || settings.shop_name || 'Merchant',
      upiId: settings.shop_upi_id,
      logoDataUrl: settings.shop_logo || '',
      svgMarkup: new XMLSerializer().serializeToString(qrSvg),
    }))
    win.document.close()
  }

  const downloadMerchantQrStand = async () => {
    if (!merchantQrValue) {
      toast.error('Add a merchant UPI ID in Payment & Bank Details first')
      return
    }
    const sourceSvg = document.querySelector('#merchant-qr-preview svg')
    if (!sourceSvg) return

    setDownloadingQrPng(true)
    let qrUrl = ''
    let brandLogos
    try {
      const qrSvg = sourceSvg.cloneNode(true)
      qrSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      qrSvg.setAttribute('width', '500')
      qrSvg.setAttribute('height', '500')
      qrUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(qrSvg)], { type: 'image/svg+xml;charset=utf-8' }))
      const qrImage = new Image()
      await new Promise((resolve, reject) => {
        qrImage.onload = resolve
        qrImage.onerror = reject
        qrImage.src = qrUrl
      })

      brandLogos = await loadUpiBrandLogos()
      let storeLogoImage = null
      if (settings.shop_logo) {
        storeLogoImage = await new Promise(resolve => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => resolve(img)
          img.onerror = () => resolve(null)
          img.src = settings.shop_logo
        })
      }

      const canvas = document.createElement('canvas')
      drawTabletopStandeeCanvas({
        canvas,
        merchantName: settings.upi_merchant_name || settings.shop_name || 'Merchant',
        upiId: settings.shop_upi_id,
        qrImg: qrImage,
        brandLogos,
        storeLogoImg: storeLogoImage,
        footerText: 'Accepted Here: GPay • PhonePe • Paytm • UPI',
      })

      const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!pngBlob) throw new Error('Unable to create PNG image')
      const pngUrl = URL.createObjectURL(pngBlob)
      const link = document.createElement('a')
      link.href = pngUrl
      link.download = 'merchant-qr-stand.png'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000)
      toast.success('Merchant QR stand PNG downloaded')
    } catch (err) {
      toast.error(err.message || 'Could not download the merchant QR stand')
    } finally {
      if (qrUrl) URL.revokeObjectURL(qrUrl)
      brandLogos?.cleanup()
      setDownloadingQrPng(false)
    }
  }

  // Logout Handler
  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Signed out successfully')
      navigate('/login')
    } catch {
      navigate('/login')
    }
  }

  const invoiceTemplates = settings.template_settings?.templates || []
  const selectedTemplateId = settings.active_templates?.default
    || settings.template_settings?.active?.default
    || settings.invoice_template
    || 'gst_a4'
  const selectedInvoiceTemplate = invoiceTemplates.find(template => template.id === selectedTemplateId)
    || invoiceTemplates[0]
  const previewTemplateId = settings.invoice_layout === 'compact'
    ? 'half_a4'
    : settings.invoice_layout === 'thermal'
      ? 'thermal_80'
      : selectedTemplateId
  const previewInvoiceTemplate = invoiceTemplates.find(template => template.id === previewTemplateId)
    || selectedInvoiceTemplate
  const getTemplatePreviewConfig = template => {
    const config = template?.config || {}
    if (!isTrue(settings.custom_theme_enabled, false)) return config
    return {
      ...config,
      business_info: {
        ...(config.business_info || {}),
        header_layout: settings.invoice_header_layout || config.business_info?.header_layout,
      },
      layout: {
        ...(config.layout || {}),
        font_family: settings.invoice_font || config.layout?.font_family,
      },
    }
  }

  const previewDocumentWidth = previewTemplateId === 'thermal_58' ? 220 : previewTemplateId.startsWith('thermal') ? 302 : previewTemplateId === 'half_a4' ? 560 : 794
  const previewDocumentHeight = previewTemplateId.startsWith('thermal') ? 620 : previewTemplateId === 'half_a4' ? 792 : 1123
  const effectivePreviewZoom = Math.min(1.4, previewZoom * previewFitScale)

  useEffect(() => {
    const container = previewAreaRef.current
    if (!container) return undefined
    const updateFit = () => {
      const availableWidth = Math.max(0, container.clientWidth - 32)
      const availableHeight = Math.max(0, container.clientHeight - 32)
      const fitByWidth = availableWidth / previewDocumentWidth
      const fitByHeight = availableHeight / previewDocumentHeight
      setPreviewFitScale(Math.min(1, fitByWidth, fitByHeight) || 1)
    }
    updateFit()
    const observer = new ResizeObserver(updateFit)
    observer.observe(container)
    return () => observer.disconnect()
  }, [previewDocumentWidth])
  const visibleInvoiceTemplates = showAllTemplates ? invoiceTemplates : invoiceTemplates.slice(0, 4)

  if (loading) {
    return <Spinner label="Loading ERP settings..." />
  }

  return (
    <div className="settings-page w-full min-w-0 font-sans text-slate-900 pb-16">
      {/* Breadcrumb Navigation & Top Action Bar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-semibold text-slate-900">Settings</span>
          {activeTabObj && (
            <>
              <span>/</span>
              <span className="text-slate-600">{activeTabObj.label}</span>
            </>
          )}
        </nav>

        {isDirty && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Unsaved changes
            </span>
            <button
              type="button"
              onClick={() => saveCurrentSettings('Saved from top bar')}
              disabled={saving}
              className="h-8 px-3 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-60"
            >
              <Save size={13} />
              <span>{saving ? 'Saving...' : 'Save All'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Settings Tab Canvas */}
      <div className="w-full">
        {/* ============================================================
            TAB: INVOICE SETTINGS (Backend Templates + Live Preview)
        ============================================================ */}
        {activeTab === 'invoice-settings' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
            <PageHeader
              title="Invoice Settings"
              description="Choose your active invoice template and customize printed columns, party details, and layout."
              isDirty={isDirty}
              saving={saving}
              onSave={() => saveCurrentSettings('Updated invoice template and layout rules')}
              saveLabel="Save Changes"
            />

            {/* Responsive Two-Column Arrangement: Left 60% Live Preview, Right 40% Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-0">
              {/* Left Column (~60% on desktop): Live Invoice Preview */}
              <div className="lg:col-span-7 flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                {/* Preview Toolbar */}
                <div className="p-3 sm:px-4 border-b border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Live Invoice Preview
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                      Real-Time
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Zoom Controls */}
                    <div className="inline-flex items-center gap-1 border border-slate-200 rounded-lg bg-white px-2 py-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(z => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
                        className="p-0.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100"
                        title="Zoom Out"
                      >
                        <ZoomOut size={13} />
                      </button>
                      <span className="text-[10px] font-mono font-semibold text-slate-700 min-w-9 text-center">
                        {Math.round(effectivePreviewZoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(z => Math.min(1.4, Math.round((z + 0.1) * 10) / 10))}
                        className="p-0.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100"
                        title="Zoom In"
                      >
                        <ZoomIn size={13} />
                      </button>
                      {previewZoom !== 1 && (
                        <button
                          type="button"
                          onClick={() => setPreviewZoom(1)}
                          className="p-0.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                          title="Reset Zoom"
                        >
                          <RotateCcw size={11} />
                        </button>
                      )}
                    </div>

                    {/* Test Print Button */}
                    <button
                      type="button"
                      onClick={() => printInvoiceDirect(previewTemplateId)}
                      className="h-8 px-3 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <Printer size={13} />
                      <span>Test Print</span>
                    </button>
                  </div>
                </div>

                {/* Live Canvas Area */}
                <div ref={previewAreaRef} className="h-[78vh] min-h-[420px] max-h-[850px] p-3 sm:p-5 bg-slate-100/90 overflow-auto flex justify-center items-start">
                  <div className="settings-print-invoice-target transition-transform" style={{ width: previewDocumentWidth * effectivePreviewZoom, height: previewDocumentHeight * effectivePreviewZoom }}>
                    <div style={{ width: previewDocumentWidth, transform: `scale(${effectivePreviewZoom})`, transformOrigin: 'top left' }}>
                      <InvoiceDocument invoice={sampleInvoice} settings={settings} templateConfig={getTemplatePreviewConfig(previewInvoiceTemplate)} mode={previewTemplateId} showModePicker={false} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column (~40% on desktop): Controls & Accordions */}
              <div className="lg:col-span-5 space-y-4">
                {/* Backend-managed invoice templates */}
                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Invoice Templates</h2>
                      <p className="mt-1 text-[11px] text-slate-500">Choose a visual invoice style.</p>
                    </div>
                    <button type="button" onClick={() => setShowAllTemplates(true)} className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100">
                      See all {invoiceTemplates.length} templates
                    </button>
                  </div>

                  <div className="overflow-x-auto pb-1">
                    <div className="grid min-w-[430px] grid-cols-4 gap-2">
                    {visibleInvoiceTemplates.map(template => {
                      const isDefault = selectedTemplateId === template.id
                      return (
                        <article key={template.id} className={`relative min-w-0 overflow-hidden rounded-lg border p-1.5 transition-all ${isDefault ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'}`}>
                          {isDefault && <span className="absolute right-1 top-1 z-10 inline-flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-white shadow"><Check size={11} strokeWidth={3} /></span>}
                          <button type="button" onClick={() => handleSelectInvoiceTemplate(template)} disabled={Boolean(savingTemplateId) || isDefault} className="block w-full overflow-hidden rounded-lg border border-slate-100 bg-slate-50 p-1 text-left" aria-label={`Preview and select ${template.name}`}>
                            <div className="mx-auto h-[66px] overflow-hidden rounded bg-white shadow-sm">
                              <div style={{ width: template.format === 'thermal' ? 302 : 560, transform: `scale(${template.format === 'thermal' ? 0.25 : 0.17})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
                                <InvoiceDocument invoice={sampleInvoice} settings={settings} templateConfig={getTemplatePreviewConfig(template)} mode={template.id} showModePicker={false} />
                              </div>
                            </div>
                          </button>
                          <div className="flex min-h-7 items-center justify-between gap-1 px-0.5 pt-1">
                            <h3 className="min-w-0 truncate text-[9px] font-bold text-slate-900" title={template.name}>{template.name}</h3>
                            {isDefault && <span className="shrink-0 text-[7px] font-bold text-indigo-700">Selected</span>}
                          </div>
                        </article>
                      )
                    })}
                    {!invoiceTemplates.length && (
                      <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-5 text-center">
                        <p className="text-xs font-semibold text-slate-700">No invoice templates found</p>
                        <button type="button" onClick={loadSettings} className="mt-2 text-[11px] font-semibold text-indigo-600 hover:text-indigo-700">Reload templates</button>
                      </div>
                    )}
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Select Color</h2>
                      <p className="mt-1 text-[11px] text-slate-500">See your accent color in the live invoice preview.</p>
                    </div>
                    <span className="h-7 w-7 rounded-full border border-slate-200 shadow-inner" style={{ backgroundColor: settings.invoice_theme_color || '#1e3a5f' }} aria-label="Current invoice accent color" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2.5">
                    {INVOICE_THEME_COLORS.map(color => {
                      const selected = (settings.invoice_theme_color || '#1e3a5f').toLowerCase() === color.value
                      return (
                        <button key={color.value} type="button" onClick={() => setField('invoice_theme_color', color.value)} aria-label={`${color.name} invoice color`} title={color.name} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${selected ? 'border-slate-900 ring-2 ring-slate-200' : 'border-white shadow ring-1 ring-slate-200'}`} style={{ backgroundColor: color.value }}>
                          {selected && <Check size={15} className="text-white drop-shadow" />}
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-semibold text-slate-900">Custom Theme</h3>
                        <p className="mt-0.5 text-[10px] text-slate-500">Tune colors, type, borders, and layout.</p>
                      </div>
                      <button type="button" onClick={() => setShowCustomTheme(true)} className="h-8 rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100">Create your own theme</button>
                    </div>
                  </div>
                </section>

                {/* 2. Accordion 1: Theme Settings */}
                <AccordionSection
                  title="Theme Settings"
                  subtitle="Party balance, phone, alternate unit, and price history"
                  icon={Sliders}
                  isOpen={invoiceAccordions.theme}
                  onToggle={() => setInvoiceAccordions(prev => ({ ...prev, theme: !prev.theme }))}
                >
                  <CheckboxField
                    checked={isTrue(settings.show_business_logo, true)}
                    onChange={v => setField('show_business_logo', String(v))}
                    label="Show Business Logo on Bills"
                    description="Master switch for invoice templates. Individual templates can also hide the logo."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_business_name, true) && isTrue(settings.show_shop_name, true)}
                    onChange={v => {
                      setField('show_business_name', String(v))
                      setField('show_shop_name', String(v))
                    }}
                    label="Show Store Name on Bills"
                    description="Show or hide the business name in invoice headers."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_balance_due, true)}
                    onChange={v => setField('show_balance_due', String(v))}
                    label="Show Party Balance"
                    description="Print outstanding customer balance due at the bottom of the invoice."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_item_description, false)}
                    onChange={v => setField('show_item_description', String(v))}
                    label="Show Item Description"
                    description="Display sub-line product description below item name."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_business_phone, true)}
                    onChange={v => setField('show_business_phone', String(v))}
                    label="Show Phone Number"
                    description="Print store official telephone and mobile on document header."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_invoice_time, true)}
                    onChange={v => setField('show_invoice_time', String(v))}
                    label="Show Invoice Time"
                    description="Print transaction hour and minute alongside invoice date."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_alternate_unit, false)}
                    onChange={v => setField('show_alternate_unit', String(v))}
                    label="Show Alternate Unit"
                    description="Display secondary packaging unit (e.g. 1 Box = 12 Pcs)."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_free_qty, false)}
                    onChange={v => setField('show_free_qty', String(v))}
                    label="Show Free-Item Quantity"
                    description="Print complimentary scheme quantities (e.g. Buy 5 Get 1 Free)."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_price_history, false)}
                    onChange={v => setField('show_price_history', String(v))}
                    label="Show Price History / MRP"
                    description="Display printed maximum retail price and savings."
                  />
                </AccordionSection>

                {/* 3. Accordion 2: Invoice Details */}
                <AccordionSection
                  title="Invoice Details"
                  subtitle="Title, invoice numbering, dates, notes, and terms"
                  icon={Receipt}
                  isOpen={invoiceAccordions.invoiceDetails}
                  onToggle={() => setInvoiceAccordions(prev => ({ ...prev, invoiceDetails: !prev.invoiceDetails }))}
                >
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-800 block mb-1">
                        Invoice Document Title
                      </label>
                      <TextInput
                        value={settings.invoice_title || 'TAX INVOICE'}
                        onChange={v => setField('invoice_title', v)}
                        placeholder="e.g. TAX INVOICE or BILL OF SUPPLY"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-800 block mb-1">
                          Invoice Prefix
                        </label>
                        <TextInput
                          value={settings.invoice_prefix}
                          onChange={v => setField('invoice_prefix', v)}
                          placeholder="e.g. INV-"
                          mono
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-800 block mb-1">
                          Start Number
                        </label>
                        <TextInput
                          value={settings.invoice_start_number}
                          onChange={v => setField('invoice_start_number', v)}
                          placeholder="1001"
                          mono
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-800 block mb-1">
                          Due Date (Days)
                        </label>
                        <TextInput
                          type="number"
                          value={settings.invoice_due_days}
                          onChange={v => setField('invoice_due_days', v)}
                          placeholder="15"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-800 block mb-1">
                          Payment Terms
                        </label>
                        <TextInput
                          value={settings.default_payment_terms || 'Net 15 Days'}
                          onChange={v => setField('default_payment_terms', v)}
                          placeholder="e.g. Net 15 Days"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-800 block mb-1">
                        Customer Notes / Remarks
                      </label>
                      <TextAreaInput
                        value={settings.invoice_notes}
                        onChange={v => setField('invoice_notes', v)}
                        placeholder="e.g. Thank you for your business!"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-800 block mb-1">
                        Terms & Conditions
                      </label>
                      <TextAreaInput
                        value={settings.invoice_terms}
                        onChange={v => setField('invoice_terms', v)}
                        placeholder="1. Goods once sold will be exchanged within 7 days..."
                        rows={2}
                      />
                    </div>
                  </div>
                </AccordionSection>

                {/* 4. Accordion 3: Party Details */}
                <AccordionSection
                  title="Party Details"
                  subtitle="Customer name, addresses, phone number, and GSTIN"
                  icon={Users}
                  isOpen={invoiceAccordions.party}
                  onToggle={() => setInvoiceAccordions(prev => ({ ...prev, party: !prev.party }))}
                >
                  <CheckboxField
                    checked={isTrue(settings.show_customer_name, true)}
                    onChange={v => setField('show_customer_name', String(v))}
                    label="Customer Name"
                    description="Display customer / buyer business name."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_customer_address, true)}
                    onChange={v => setField('show_customer_address', String(v))}
                    label="Billing and Shipping Address"
                    description="Print customer premises address for dispatch and delivery."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_customer_phone, true)}
                    onChange={v => setField('show_customer_phone', String(v))}
                    label="Customer Phone Number"
                    description="Print buyer mobile number for carrier delivery."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_customer_gstin, true)}
                    onChange={v => setField('show_customer_gstin', String(v))}
                    label="Customer GSTIN & Tax Details"
                    description="Required for B2B input tax credit eligibility."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_place_of_supply, true)}
                    onChange={v => setField('show_place_of_supply', String(v))}
                    label="Place of Supply"
                    description="Print state code and location determining IGST vs CGST/SGST."
                  />
                </AccordionSection>

                {/* 5. Accordion 4: Item Table Columns */}
                <AccordionSection
                  title="Item Table Columns"
                  subtitle="Configure printed columns (display only · preserves GST math)"
                  icon={FileSpreadsheet}
                  isOpen={invoiceAccordions.columns}
                  onToggle={() => setInvoiceAccordions(prev => ({ ...prev, columns: !prev.columns }))}
                >
                  <div className="p-2.5 rounded-lg bg-indigo-50/60 border border-indigo-100 text-[11px] text-indigo-900 leading-relaxed mb-3">
                    These toggles configure which columns are visually printed on the customer bill. Underlying GST calculations and tax records remain fully preserved.
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CheckboxField
                      checked={isTrue(settings.show_sr_no, true)}
                      onChange={v => setField('show_sr_no', String(v))}
                      label="Serial Number (S.No)"
                    />
                    <CheckboxField
                      checked={isTrue(settings.show_item_name, true)}
                      onChange={v => setField('show_item_name', String(v))}
                      label="Item Name"
                    />
                    <CheckboxField
                      checked={isTrue(settings.show_hsn_col, true)}
                      onChange={v => setField('show_hsn_col', String(v))}
                      label="HSN / SAC Code"
                    />
                    <CheckboxField
                      checked={isTrue(settings.show_sku_col, false)}
                      onChange={v => setField('show_sku_col', String(v))}
                      label="Item Code / SKU"
                    />
                    <CheckboxField
                      checked={isTrue(settings.show_batch_col, false)}
                      onChange={v => setField('show_batch_col', String(v))}
                      label="Batch Number"
                    />
                    <CheckboxField
                      checked={isTrue(settings.show_mfg_date, false)}
                      onChange={v => setField('show_mfg_date', String(v))}
                      label="Mfg Date"
                    />
                    <CheckboxField
                      checked={isTrue(settings.show_expiry_col, false)}
                      onChange={v => setField('show_expiry_col', String(v))}
                      label="Expiry Date"
                    />
                    <CheckboxField
                      checked={isTrue(settings.show_qty_col, true)}
                      onChange={v => setField('show_qty_col', String(v))}
                      label="Quantity"
                    />
                    <CheckboxField
                      checked={isTrue(settings.show_unit_col, true)}
                      onChange={v => setField('show_unit_col', String(v))}
                      label="Unit (kg, pcs, L)"
                    />
                    <CheckboxField
                      checked={isTrue(settings.show_rate_col, true)}
                      onChange={v => setField('show_rate_col', String(v))}
                      label="Rate / Price"
                    />
                    <CheckboxField
                      checked={isTrue(settings.show_discount_col, true)}
                      onChange={v => setField('show_discount_col', String(v))}
                      label="Discount Column"
                    />
                    <CheckboxField
                      checked={isTrue(settings.show_tax_cols, true)}
                      onChange={v => setField('show_tax_cols', String(v))}
                      label="Tax Breakdown (CGST/SGST)"
                    />
                    <CheckboxField
                      checked={isTrue(settings.show_total_col, true)}
                      onChange={v => setField('show_total_col', String(v))}
                      label="Item Total Amount"
                    />
                  </div>
                </AccordionSection>

                {/* 6. Accordion 5: Miscellaneous Details */}
                <AccordionSection
                  title="Miscellaneous Details"
                  subtitle="Bank details, payment QR, signature block, and words"
                  icon={CheckCircle2}
                  isOpen={invoiceAccordions.misc}
                  onToggle={() => setInvoiceAccordions(prev => ({ ...prev, misc: !prev.misc }))}
                >
                  <CheckboxField
                    checked={isTrue(settings.show_bank_details, true)}
                    onChange={v => setField('show_bank_details', String(v))}
                    label="Bank Account Details"
                    description="Print bank name, account number & IFSC in invoice footer."
                  />
                  <CheckboxField
                    checked={isTrue(settings.enable_invoice_qr, true)}
                    onChange={v => setField('enable_invoice_qr', String(v))}
                    label="Payment QR Code (UPI)"
                    description="Print dynamic UPI QR for customer scan-to-pay."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_signature_area, true)}
                    onChange={v => setField('show_signature_area', String(v))}
                    label="Authorized Signature Block"
                    description="Print signatory box at bottom right of invoice."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_terms, true)}
                    onChange={v => setField('show_terms', String(v))}
                    label="Terms and Conditions Section"
                    description="Display terms and conditions bullet points."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_footer, true)}
                    onChange={v => setField('show_footer', String(v))}
                    label="Invoice Footer Note"
                    description="Print custom greeting note at the very bottom."
                  />
                  <CheckboxField
                    checked={isTrue(settings.show_amount_in_words, true)}
                    onChange={v => setField('show_amount_in_words', String(v))}
                    label="Amount in Words"
                    description="Print written rupee words (e.g. Rupees One Thousand Five Hundred...)."
                  />
                </AccordionSection>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB: PRINT SETTINGS (Two Main Tabs: Thermal & Barcode Print)
        ============================================================ */}
        {activeTab === 'print-settings' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
            <PageHeader
              title="Print Settings"
              description="Configure thermal receipt printers and generate barcode product labels."
              isDirty={isDirty}
              saving={saving}
              onSave={() => saveCurrentSettings('Updated print and barcode settings')}
              saveLabel="Save Settings"
            />

            {/* Responsive Two-Column Arrangement: Left 60% Preview, Right 40% Configuration */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start flex-1 min-h-0">
              {/* Left Column (~60%): Live Preview (Thermal Receipt or Barcode Label) */}
              <div className="lg:col-span-7 flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                {/* Preview Toolbar */}
                <div className="p-3 sm:px-4 border-b border-slate-200 bg-slate-50/90 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      {printSubTab === 'thermal' ? 'Live Thermal Receipt' : 'Live Barcode Label'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                      {printSubTab === 'thermal'
                        ? (settings.thermal_paper_width === '58' || settings.thermal_paper_width === '2' ? '58 mm (2-inch)' : '80 mm (3-inch)')
                        : (BARCODE_LABEL_SIZES.find(s => s.id === (settings.barcode_label_size || '50x25'))?.label || '50 × 25 mm')
                      }
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {printSubTab === 'thermal' ? (
                      <button
                        type="button"
                        onClick={printThermalDirect}
                        className="h-8 px-3 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                      >
                        <Printer size={13} />
                        <span>Test Print Receipt</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={printBarcodeLabelDirect}
                        className="h-8 px-3 text-xs font-semibold rounded-lg bg-teal-700 hover:bg-teal-800 text-white inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                      >
                        <Printer size={13} />
                        <span>Test Print Label</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Preview Display Stage */}
                <div className="p-6 bg-slate-100/90 overflow-x-auto flex justify-center items-start min-h-[520px]">
                  {printSubTab === 'thermal' ? (
                    /* Thermal Continuous Receipt Simulator */
                    <div className="settings-print-invoice-target bg-white text-black shadow-lg rounded-xs overflow-visible border border-slate-300">
                      <InvoiceDocument
                        invoice={sampleInvoice}
                        settings={settings}
                        mode={settings.thermal_paper_width === '58' || settings.thermal_paper_width === '2' ? 'thermal_58' : 'thermal_80'}
                        showModePicker={false}
                      />
                    </div>
                  ) : (
                    /* Barcode Label Simulator */
                    <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                      <div
                        id="barcode-preview-canvas"
                        className={`bg-white rounded-xl border border-slate-300 p-4 shadow-lg w-full transition-all ${
                          (settings.barcode_align || 'center') === 'left' ? 'text-left' : 'text-center'
                        }`}
                        style={{
                          maxWidth: ({ '38x25': '280px', 'a4_3x5': '300px', 'a4_4x8': '240px', '80mm_roll': '380px' })[settings.barcode_label_size || '50x25'] || '340px',
                          aspectRatio: ({ '38x25': '1.52', '50x25': '2', 'a4_3x5': '1.19', 'a4_4x8': '1.41', '80mm_roll': '1.6' })[settings.barcode_label_size || '50x25'],
                        }}
                      >
                        {/* Business Name */}
                        {isTrue(settings.barcode_show_business_name, true) && (
                          <div className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-1 truncate">
                            {settings.shop_name || 'MY RETAIL STORE'}
                          </div>
                        )}

                        {/* Product Title */}
                        {isTrue(settings.barcode_show_product_name, true) && (
                          <div className={`text-xs text-slate-800 leading-snug mb-1.5 ${
                            isTrue(settings.barcode_bold, true) ? 'font-bold' : 'font-normal'
                          }`}>
                            {testProduct.name}
                          </div>
                        )}

                        {/* Barcode SVG */}
                        <div className="py-1">
                          <BarcodeSvgCanvas
                            barcodeValue={testProduct.barcode}
                            width={Number(settings.barcode_width) || 1.6}
                            height={Number(settings.barcode_height) || 36}
                            displayValue={isTrue(settings.barcode_show_code, true)}
                            fontSize={settings.barcode_font_size === 'large' ? 13 : settings.barcode_font_size === 'small' ? 9 : 11}
                          />
                        </div>

                        {/* SKU */}
                        {isTrue(settings.barcode_show_sku, true) && testProduct.sku && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            SKU: {testProduct.sku}
                          </div>
                        )}

                        {/* Price & MRP Row */}
                        <div className="flex items-center justify-center gap-2 mt-2 pt-1 border-t border-slate-100">
                          {isTrue(settings.barcode_show_mrp, true) && (
                            <span className="text-[11px] text-slate-400 line-through">
                              MRP: ₹{testProduct.mrp}
                            </span>
                          )}
                          {isTrue(settings.barcode_show_selling_price, true) && (
                            <span className="text-sm font-extrabold text-slate-900">
                              ₹{testProduct.price}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-center text-xs text-slate-500">
                        Live responsive label sticker formatted for{' '}
                        <strong className="text-slate-700">
                          {BARCODE_LABEL_SIZES.find(s => s.id === (settings.barcode_label_size || '50x25'))?.label}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column (~40%): Controls with EXACTLY TWO TABS */}
              <div className="lg:col-span-5 space-y-4">
                {/* The Two Main Tabs */}
                <div className="p-1 rounded-xl bg-slate-200/80 grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setPrintSubTab('thermal')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      printSubTab === 'thermal'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Receipt size={15} />
                    <span>Thermal Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintSubTab('barcode')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                      printSubTab === 'barcode'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Barcode size={15} />
                    <span>Barcode Print</span>
                  </button>
                </div>

                {/* ====================================================
                    TAB 1: THERMAL SETTINGS CONTROLS
                ==================================================== */}
                {printSubTab === 'thermal' && (
                  <div className="space-y-4">
                    {/* Paper Width Selection */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                        Thermal Paper Width
                      </span>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setField('thermal_paper_width', '58')}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            settings.thermal_paper_width === '58' || settings.thermal_paper_width === '2'
                              ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-900">2-inch (58 mm)</span>
                            {(settings.thermal_paper_width === '58' || settings.thermal_paper_width === '2') && (
                              <Check size={12} className="text-indigo-600" />
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block">Mini Handheld & Bluetooth</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setField('thermal_paper_width', '80')}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            settings.thermal_paper_width !== '58' && settings.thermal_paper_width !== '2'
                              ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-900">3-inch (80 mm)</span>
                            {settings.thermal_paper_width !== '58' && settings.thermal_paper_width !== '2' && (
                              <Check size={12} className="text-indigo-600" />
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block">Standard POS Cash Counter</span>
                        </button>
                      </div>
                    </div>

                    {/* Logo Management */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">Business Logo</span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">Printed at top of thermal slip</span>
                        </div>
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                          {settings.shop_logo ? (
                            <img src={settings.shop_logo} alt="Logo" className="w-full h-full object-contain p-1" />
                          ) : (
                            <Building2 size={20} className="text-slate-400" />
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={uploadingLogo}
                            className="h-8 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <Upload size={13} />
                            <span>{uploadingLogo ? 'Uploading...' : settings.shop_logo ? 'Replace Logo' : 'Upload Logo'}</span>
                          </button>
                          {settings.shop_logo && (
                            <button
                              type="button"
                              onClick={handleLogoRemove}
                              disabled={removingLogo}
                              className="h-8 px-2.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Remove Logo"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_logo, isTrue(settings.show_business_logo, true))}
                          onChange={v => setField('thermal_show_logo', String(v))}
                          label="Print Logo on Thermal Receipt"
                          description="Prints high-contrast monochrome logo on receipt head."
                        />
                      </div>
                    </div>

                    {/* Theme Settings Accordion */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                        Thermal Theme Settings
                      </span>
                      <CheckboxField
                        checked={isTrue(settings.thermal_show_party_balance, isTrue(settings.show_balance_due, true))}
                        onChange={v => setField('thermal_show_party_balance', String(v))}
                        label="Show Party Balance"
                        description="Print previous balance due on customer thermal bill."
                      />
                      <CheckboxField
                        checked={isTrue(settings.thermal_show_item_desc, false)}
                        onChange={v => setField('thermal_show_item_desc', String(v))}
                        label="Show Item Description"
                        description="Print product sub-note or variant detail below item line."
                      />
                      <CheckboxField
                        checked={isTrue(settings.thermal_show_time, isTrue(settings.show_invoice_time, true))}
                        onChange={v => setField('thermal_show_time', String(v))}
                        label="Show Invoice Time"
                        description="Print transaction timestamp (HH:MM) beside invoice date."
                      />
                    </div>

                    {/* Accordion 1: Invoice Details */}
                    <AccordionSection
                      title="1. Invoice Details"
                      subtitle="Receipt title, cashier, and transaction metadata"
                      icon={Receipt}
                      isOpen={thermalAccordions.invoiceDetails}
                      onToggle={() => setThermalAccordions(prev => ({ ...prev, invoiceDetails: !prev.invoiceDetails }))}
                    >
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-800 block mb-1">
                            Receipt Heading Title
                          </label>
                          <TextInput
                            value={settings.thermal_title || 'TAX INVOICE'}
                            onChange={v => setField('thermal_title', v)}
                            placeholder="e.g. TAX INVOICE or CASH RECEIPT"
                          />
                        </div>
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_invoice_no, true)}
                          onChange={v => setField('thermal_show_invoice_no', String(v))}
                          label="Print Invoice Number"
                        />
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_date, true)}
                          onChange={v => setField('thermal_show_date', String(v))}
                          label="Print Bill Date"
                        />
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_cashier, true)}
                          onChange={v => setField('thermal_show_cashier', String(v))}
                          label="Print Cashier Name"
                        />
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_payment_mode, true)}
                          onChange={v => setField('thermal_show_payment_mode', String(v))}
                          label="Print Payment Mode (Cash/UPI/Card)"
                        />
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_place_of_supply, true)}
                          onChange={v => setField('thermal_show_place_of_supply', String(v))}
                          label="Print Place of Supply"
                        />
                      </div>
                    </AccordionSection>

                    {/* Accordion 2: Party Details */}
                    <AccordionSection
                      title="2. Party Details"
                      subtitle="Customer name, mobile number, and tax IDs"
                      icon={Users}
                      isOpen={thermalAccordions.party}
                      onToggle={() => setThermalAccordions(prev => ({ ...prev, party: !prev.party }))}
                    >
                      <div className="space-y-3">
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_customer_name, true)}
                          onChange={v => setField('thermal_show_customer_name', String(v))}
                          label="Print Customer Name"
                        />
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_customer_phone, true)}
                          onChange={v => setField('thermal_show_customer_phone', String(v))}
                          label="Print Customer Phone Number"
                        />
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_customer_gstin, true)}
                          onChange={v => setField('thermal_show_customer_gstin', String(v))}
                          label="Print Customer GSTIN"
                        />
                      </div>
                    </AccordionSection>

                    {/* Accordion 3: Item Columns */}
                    <AccordionSection
                      title="3. Item Columns"
                      subtitle="Quantity, rate, discounts, and item total format"
                      icon={FileSpreadsheet}
                      isOpen={thermalAccordions.columns}
                      onToggle={() => setThermalAccordions(prev => ({ ...prev, columns: !prev.columns }))}
                    >
                      <div className="space-y-3">
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_sku, true)}
                          onChange={v => setField('thermal_show_sku', String(v))}
                          label="Print SKU / Barcode Number"
                        />
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_qty, true)}
                          onChange={v => setField('thermal_show_qty', String(v))}
                          label="Print Quantity and Unit"
                        />
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_rate, true)}
                          onChange={v => setField('thermal_show_rate', String(v))}
                          label="Print Unit Rate / Price"
                        />
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_discount, true)}
                          onChange={v => setField('thermal_show_discount', String(v))}
                          label="Print Discount Given"
                        />
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_tax, true)}
                          onChange={v => setField('thermal_show_tax', String(v))}
                          label="Print Tax Rate % (HSN/GST)"
                        />
                      </div>
                    </AccordionSection>

                    {/* Accordion 4: Miscellaneous Details */}
                    <AccordionSection
                      title="4. Miscellaneous Details"
                      subtitle="UPI QR, greetings footer, cash drawer, and terms"
                      icon={CheckCircle2}
                      isOpen={thermalAccordions.misc}
                      onToggle={() => setThermalAccordions(prev => ({ ...prev, misc: !prev.misc }))}
                    >
                      <div className="space-y-3">
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_upi_qr, true)}
                          onChange={v => setField('thermal_show_upi_qr', String(v))}
                          label="Print UPI QR Code for Payment"
                          description="Customers can scan and pay bill directly at POS."
                        />
                        <CheckboxField
                          checked={isTrue(settings.thermal_show_bill_qr, true)}
                          onChange={v => setField('thermal_show_bill_qr', String(v))}
                          label="Digital Bill QR Code (Scan to View Bill)"
                          description="Paperless customer receipt access via QR."
                        />
                        <div>
                          <label className="text-xs font-semibold text-slate-800 block mb-1">
                            Receipt Footer Greeting
                          </label>
                          <TextInput
                            value={settings.receipt_footer || 'Thank you for shopping with us!'}
                            onChange={v => setField('receipt_footer', v)}
                            placeholder="e.g. Visit Again!"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-800 block mb-1">
                            Exchange & Return Policy Snippet
                          </label>
                          <TextAreaInput
                            value={settings.thermal_terms || 'Goods once sold can be exchanged within 7 days with bill.'}
                            onChange={v => setField('thermal_terms', v)}
                            placeholder="Short terms line..."
                            rows={2}
                          />
                        </div>
                        <CheckboxField
                          checked={isTrue(settings.open_cash_drawer, false)}
                          onChange={v => setField('open_cash_drawer', String(v))}
                          label="Open Cash Drawer on Print"
                          description="Sends pulse kickout command (ESC/POS 27,112,0,25,250)."
                        />
                        <CheckboxField
                          checked={isTrue(settings.print_duplicate, false)}
                          onChange={v => setField('print_duplicate', String(v))}
                          label="Print Duplicate Kitchen / Merchant Copy"
                        />
                      </div>
                    </AccordionSection>
                  </div>
                )}

                {/* ====================================================
                    TAB 2: BARCODE PRINT CONTROLS
                ==================================================== */}
                {printSubTab === 'barcode' && (
                  <div className="space-y-4">
                    {/* Printer Type Selection */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                        Printer Type
                      </span>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setField('barcode_printer_type', 'label')
                            if ((settings.barcode_label_size || '').startsWith('a4_')) setField('barcode_label_size', '50x25')
                          }}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            (settings.barcode_printer_type || 'label') === 'label'
                              ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-900">Label Printer (Roll)</span>
                            {(settings.barcode_printer_type || 'label') === 'label' && (
                              <Check size={12} className="text-indigo-600" />
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block">TVS, Zebra, TSC, Godex</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setField('barcode_printer_type', 'a4')
                            if (!(settings.barcode_label_size || '').startsWith('a4_')) setField('barcode_label_size', 'a4_3x5')
                          }}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            settings.barcode_printer_type === 'a4'
                              ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-900">Standard Printer (A4)</span>
                            {settings.barcode_printer_type === 'a4' && (
                              <Check size={12} className="text-indigo-600" />
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block">Sticker Sheets (Laser/Inkjet)</span>
                        </button>
                      </div>
                    </div>

                    {/* Label Size Selection */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2.5">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                        Label Dimensions & Size
                      </span>
                      <SelectInput
                        value={settings.barcode_label_size || '50x25'}
                        onChange={v => {
                          setField('barcode_label_size', v)
                          setField('barcode_printer_type', v.startsWith('a4_') ? 'a4' : 'label')
                        }}
                        options={BARCODE_LABEL_SIZES.map(s => [s.id, `${s.label} · ${s.desc}`])}
                      />
                    </div>

                    {/* Visibility Toggles */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                        Label Attributes & Visibility
                      </span>
                      <div className="grid grid-cols-2 gap-3">
                        <CheckboxField
                          checked={isTrue(settings.barcode_show_business_name, true)}
                          onChange={v => setField('barcode_show_business_name', String(v))}
                          label="Business Name"
                        />
                        <CheckboxField
                          checked={isTrue(settings.barcode_show_product_name, true)}
                          onChange={v => setField('barcode_show_product_name', String(v))}
                          label="Product Name"
                        />
                        <CheckboxField
                          checked={isTrue(settings.barcode_show_code, true)}
                          onChange={v => setField('barcode_show_code', String(v))}
                          label="Barcode Number"
                        />
                        <CheckboxField
                          checked={isTrue(settings.barcode_show_sku, true)}
                          onChange={v => setField('barcode_show_sku', String(v))}
                          label="SKU Code"
                        />
                        <CheckboxField
                          checked={isTrue(settings.barcode_show_mrp, true)}
                          onChange={v => setField('barcode_show_mrp', String(v))}
                          label="MRP (Strikethrough)"
                        />
                        <CheckboxField
                          checked={isTrue(settings.barcode_show_selling_price, true)}
                          onChange={v => setField('barcode_show_selling_price', String(v))}
                          label="Selling Price"
                        />
                      </div>
                    </div>

                    {/* Styling & Alignment Controls */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3.5">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                        Typography & Barcode Dimensions
                      </span>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-800 block mb-1">
                            Font Size
                          </label>
                          <SelectInput
                            value={settings.barcode_font_size || 'medium'}
                            onChange={v => setField('barcode_font_size', v)}
                            options={[
                              ['small', 'Small (9 pt)'],
                              ['medium', 'Medium (11 pt)'],
                              ['large', 'Large (13 pt)'],
                            ]}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-800 block mb-1">
                            Alignment
                          </label>
                          <SelectInput
                            value={settings.barcode_align || 'center'}
                            onChange={v => setField('barcode_align', v)}
                            options={[
                              ['center', 'Center Aligned'],
                              ['left', 'Left Aligned'],
                            ]}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-800 block mb-1">
                            Barcode Height: {settings.barcode_height || 36}px
                          </label>
                          <input
                            type="range"
                            min="24"
                            max="60"
                            step="2"
                            value={Number(settings.barcode_height) || 36}
                            onChange={e => setField('barcode_height', e.target.value)}
                            className="w-full accent-indigo-600 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-slate-800 block mb-1">
                            Bar Thickness: {settings.barcode_width || 1.6}
                          </label>
                          <input
                            type="range"
                            min="1.0"
                            max="2.5"
                            step="0.2"
                            value={Number(settings.barcode_width) || 1.6}
                            onChange={e => setField('barcode_width', e.target.value)}
                            className="w-full accent-indigo-600 cursor-pointer"
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        <CheckboxField
                          checked={isTrue(settings.barcode_bold, true)}
                          onChange={v => setField('barcode_bold', String(v))}
                          label="Bold Product & Price Typography"
                          description="Enhances readability on thermal label rolls."
                        />
                      </div>
                    </div>

                    {/* Test Sample Product Fields */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                          Preview Test Product
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Edit to test label fit
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                            Product Title
                          </label>
                          <TextInput
                            value={testProduct.name}
                            onChange={v => setTestProduct(p => ({ ...p, name: v }))}
                            placeholder="Item name"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                            Barcode Number
                          </label>
                          <TextInput
                            value={testProduct.barcode}
                            onChange={v => setTestProduct(p => ({ ...p, barcode: v }))}
                            placeholder="e.g. 8901030382918"
                            mono
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                            Selling Price (₹)
                          </label>
                          <TextInput
                            value={testProduct.price}
                            onChange={v => setTestProduct(p => ({ ...p, price: v }))}
                            placeholder="165.00"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB: MANAGE BUSINESS
        ============================================================ */}
        {activeTab === 'manage-business' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 max-w-4xl w-full mx-auto">
            <PageHeader
              title="Manage Business"
              description="Manage your business legal profile, trade name, official contacts, and store branding."
              isDirty={isDirty}
              saving={saving}
              onSave={() => saveCurrentSettings('Updated business profile')}
              saveLabel="Save Business Profile"
            />

            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              {/* Logo Upload Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-6 py-3.5 border-b border-slate-200 items-center">
                <div className="md:col-span-4">
                  <span className="text-xs font-semibold text-slate-900 block">
                    Business Logo
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Printed on headers of tax invoices, POS receipts, and delivery challans.
                  </p>
                </div>
                <div className="md:col-span-8 flex flex-wrap items-center gap-4">
                  <div className="h-16 w-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                    {settings.shop_logo ? (
                      <img src={settings.shop_logo} alt="Store Logo" className="h-full w-full object-contain p-1" />
                    ) : (
                      <Building2 size={24} className="text-slate-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="h-8 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Upload size={13} />
                      <span>{uploadingLogo ? 'Uploading...' : settings.shop_logo ? 'Replace Logo' : 'Upload Logo'}</span>
                    </button>
                    {settings.shop_logo && (
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        disabled={removingLogo}
                        className="h-8 px-2.5 text-xs font-medium rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove Logo"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Core Business Fields */}
              <SettingRow label="Business Name" required description="Official legal name printed on all tax invoices." id="shop_name">
                <TextInput
                  id="shop_name"
                  value={settings.shop_name}
                  onChange={v => setField('shop_name', v)}
                  placeholder="e.g. Sri Balaji Supermarket"
                />
              </SettingRow>

              <SettingRow label="Owner / Contact Person" description="Principal store proprietor or director." id="owner_name">
                <TextInput
                  id="owner_name"
                  value={settings.owner_name}
                  onChange={v => setField('owner_name', v)}
                  placeholder="e.g. K. Balaji"
                />
              </SettingRow>

              <SettingRow label="Business Phone" required description="Store contact telephone printed on receipts." id="shop_phone">
                <TextInput
                  id="shop_phone"
                  value={settings.shop_phone}
                  onChange={v => setField('shop_phone', v)}
                  placeholder="e.g. +91 98765 43210"
                />
              </SettingRow>

              <SettingRow label="Official Email" description="Billing queries, purchase orders & e-way bills." id="shop_email">
                <TextInput
                  id="shop_email"
                  type="email"
                  value={settings.shop_email}
                  onChange={v => setField('shop_email', v)}
                  placeholder="e.g. contact@balajistore.in"
                />
              </SettingRow>

              <SettingRow label="Business Category" description="Industry sector for statutory classification." id="business_type">
                <SelectInput
                  id="business_type"
                  value={settings.business_type || 'retail_wholesale'}
                  onChange={v => setField('business_type', v)}
                  options={[
                    ['retail_wholesale', 'Retail Supermarket & FMCG'],
                    ['apparel_footwear', 'Apparel & Footwear Store'],
                    ['pharmacy_medical', 'Pharmacy & Healthcare'],
                    ['electronics_electrical', 'Consumer Electronics & Hardware'],
                    ['restaurant_cafe', 'Restaurant, Cafe & Bakery'],
                    ['automotive_spares', 'Auto Parts & Service Centre'],
                    ['other', 'General Wholesale & Distribution'],
                  ]}
                />
              </SettingRow>

              <SettingRow label="Store Address" required description="Physical shop address printed on bills." id="shop_address">
                <TextAreaInput
                  id="shop_address"
                  value={settings.shop_address}
                  onChange={v => setField('shop_address', v)}
                  placeholder="Shop No. 4, Ground Floor, Anna Salai..."
                  rows={2}
                />
              </SettingRow>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-2 border-b border-slate-200">
                <div>
                  <label className="text-xs font-semibold text-slate-800 block mb-1">City</label>
                  <TextInput
                    value={settings.shop_city}
                    onChange={v => setField('shop_city', v)}
                    placeholder="e.g. Chennai"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800 block mb-1">State</label>
                  <SelectInput
                    value={settings.shop_state}
                    onChange={v => {
                      setField('shop_state', v)
                      setField('place_of_supply', v)
                    }}
                    options={[['', 'Select State'], ...INDIAN_STATES.map(s => [s.name, `${s.name} (${s.code})`])]}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-800 block mb-1">Pincode</label>
                  <TextInput
                    value={settings.shop_pincode}
                    onChange={v => setField('shop_pincode', v)}
                    placeholder="600001"
                    maxLength={6}
                    mono
                  />
                </div>
              </div>

              {/* Tax & Registration Identifiers */}
              <SettingRow label="Store GSTIN" description="15-character statutory GST identification number." id="shop_gstin">
                <TextInput
                  id="shop_gstin"
                  value={settings.shop_gstin}
                  onChange={v => setField('shop_gstin', v.toUpperCase())}
                  placeholder="e.g. 33AABCS1429B1ZP"
                  maxLength={15}
                  mono
                />
              </SettingRow>

              <SettingRow label="Income Tax PAN" description="Permanent Account Number." id="shop_pan">
                <TextInput
                  id="shop_pan"
                  value={settings.shop_pan}
                  onChange={v => setField('shop_pan', v.toUpperCase())}
                  placeholder="e.g. AABCS1429B"
                  maxLength={10}
                  mono
                />
              </SettingRow>

              <SettingRow label="FSSAI License" description="14-digit food safety registration number (if applicable)." id="fssai_licence">
                <TextInput
                  id="fssai_licence"
                  value={settings.fssai_licence}
                  onChange={v => setField('fssai_licence', v)}
                  placeholder="e.g. 12418008000456"
                  maxLength={14}
                  mono
                />
              </SettingRow>

              <SettingRow label="CIN / Registration No" description="Corporate Identification Number for PVT LTD / LLP." id="cin">
                <TextInput
                  id="cin"
                  value={settings.cin}
                  onChange={v => setField('cin', v.toUpperCase())}
                  placeholder="e.g. U74999TN2018PTC123456"
                  mono
                />
              </SettingRow>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB: ACCOUNT
        ============================================================ */}
        {activeTab === 'account' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 max-w-4xl w-full mx-auto">
            <PageHeader
              title="Account & Profile"
              description="Signed-in user identity, access role, and enterprise credentials."
              isDirty={false}
              saving={false}
              onSave={() => {}}
              saveLabel="Save"
            />

            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-6">
              <div className="flex items-center gap-4 pb-5 border-b border-slate-200">
                <div className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xl font-bold">
                  {(user?.username || user?.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {user?.first_name || user?.username || 'Operator'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {user?.email || 'No email associated'}
                  </p>
                  <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
                    Role: {user?.role || 'Administrator'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Username</span>
                  <span className="text-sm font-bold text-slate-900 font-mono">{user?.username || 'admin'}</span>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">Business Associated</span>
                  <span className="text-sm font-bold text-slate-900">{settings.shop_name || 'My Store'}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-indigo-950">Active Session Security</h4>
                  <p className="text-[11px] text-indigo-700 mt-0.5">
                    Two-factor dual control authentication active for sensitive maker-checker operations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="h-8 px-3 text-xs font-semibold rounded-lg bg-white border border-indigo-200 text-rose-600 hover:bg-rose-50 transition-colors shrink-0 shadow-2xs"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB: APPROVAL SETTINGS (MAKER-CHECKER WORKFLOW)
        ============================================================ */}
        {activeTab === 'approvals' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 max-w-4xl w-full mx-auto">
            <PageHeader
              title="Approval Settings & Thresholds"
              description="Configure maker-checker dual-control compliance rules requiring administrator authorization before committing changes."
              isDirty={isDirty}
              saving={saving}
              onSave={() => saveCurrentSettings('Updated approval thresholds')}
              saveLabel="Save Approval Rules"
            />

            <div className="space-y-6">
              {/* Architecture Workflow Banner */}
              <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-indigo-50/70 p-4 sm:p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck size={18} className="text-indigo-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                    Maker-Checker Audit Architecture
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
                  <div className="bg-white rounded-lg border border-indigo-100 p-2.5 shadow-xs">
                    <span className="block font-bold text-slate-900 text-[11px]">1. Current Data</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">+ Proposed Diff</span>
                  </div>
                  <div className="bg-white rounded-lg border border-indigo-100 p-2.5 shadow-xs">
                    <span className="block font-bold text-slate-900 text-[11px]">2. Request</span>
                    <span className="text-[10px] text-amber-600 font-semibold block mt-0.5">Status: Pending</span>
                  </div>
                  <div className="bg-white rounded-lg border border-indigo-100 p-2.5 shadow-xs">
                    <span className="block font-bold text-slate-900 text-[11px]">3. Admin Review</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Approve/Reject</span>
                  </div>
                  <div className="bg-white rounded-lg border border-indigo-100 p-2.5 shadow-xs">
                    <span className="block font-bold text-slate-900 text-[11px]">4. DB Transaction</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Atomic Commit</span>
                  </div>
                  <div className="bg-white rounded-lg border border-indigo-100 p-2.5 shadow-xs">
                    <span className="block font-bold text-slate-900 text-[11px]">5. Actual Data</span>
                    <span className="text-[10px] text-teal-600 font-semibold block mt-0.5">Updated</span>
                  </div>
                  <div className="bg-white rounded-lg border border-indigo-100 p-2.5 shadow-xs">
                    <span className="block font-bold text-slate-900 text-[11px]">6. AuditLog</span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Signed Entry</span>
                  </div>
                </div>
              </div>

              {/* Threshold Rules Grid */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                <SettingRow label="Price Change Threshold (%)" description="Price variance exceeding this % triggers mandatory manager sign-off." id="approval_price_change_pct">
                  <TextInput
                    id="approval_price_change_pct"
                    type="number"
                    value={settings.approval_price_change_pct || '10'}
                    onChange={v => setField('approval_price_change_pct', v)}
                    placeholder="10"
                  />
                </SettingRow>

                <SettingRow label="Refund Threshold (₹)" description="Cash/Card refunds exceeding this amount require manager approval." id="approval_refund_threshold">
                  <TextInput
                    id="approval_refund_threshold"
                    type="number"
                    value={settings.approval_refund_threshold || '1000'}
                    onChange={v => setField('approval_refund_threshold', v)}
                    placeholder="1000"
                  />
                </SettingRow>

                <SettingRow label="Stock Adjustment Quantity" description="Inventory quantity write-offs exceeding this threshold require admin review." id="approval_stock_adjustment_qty">
                  <TextInput
                    id="approval_stock_adjustment_qty"
                    type="number"
                    value={settings.approval_stock_adjustment_qty || '10'}
                    onChange={v => setField('approval_stock_adjustment_qty', v)}
                    placeholder="10"
                  />
                </SettingRow>

                <div className="pt-2 border-t border-slate-200 space-y-3">
                  <CheckboxField
                    checked={isTrue(settings.approval_invoice_cancellation, true)}
                    onChange={v => setField('approval_invoice_cancellation', String(v))}
                    label="Invoice Cancellation requires Admin Approval"
                    description="Cashiers cannot void saved tax invoices without manager dual-control."
                  />
                  <CheckboxField
                    checked={isTrue(settings.approval_user_role_change, true)}
                    onChange={v => setField('approval_user_role_change', String(v))}
                    label="User Role Promotion / Privilege Change requires Admin Approval"
                  />
                  <CheckboxField
                    checked={isTrue(settings.approval_credit_limit_increase, true)}
                    onChange={v => setField('approval_credit_limit_increase', String(v))}
                    label="Customer Credit Limit Increase requires Admin Approval"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB: TAX & GST
        ============================================================ */}
        {activeTab === 'tax' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 max-w-4xl w-full mx-auto">
            <PageHeader
              title="Tax & GST Settings"
              description="Manage statutory GST registration mode, state of supply, and default tax rates."
              isDirty={isDirty}
              saving={saving}
              onSave={() => saveCurrentSettings('Updated tax and GST configuration')}
              saveLabel="Save Tax Rules"
            />

            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <SettingRow label="GST Registration Type" required description="Determines whether bills are generated as Tax Invoice or Bill of Supply." id="gst_reg_type">
                <SelectInput
                  id="gst_reg_type"
                  value={settings.gst_reg_type || 'regular'}
                  onChange={v => setField('gst_reg_type', v)}
                  options={[
                    ['regular', 'Regular GST (Full Input Credit & Tax Invoices)'],
                    ['composition', 'Composition Scheme (Fixed turnover levy, no input tax)'],
                    ['unregistered', 'Unregistered (Exempt from GST filing)'],
                  ]}
                />
              </SettingRow>

              <SettingRow label="Store GSTIN" description="15-character statutory GST identification number." id="tax_shop_gstin">
                <TextInput
                  id="tax_shop_gstin"
                  value={settings.shop_gstin}
                  onChange={v => setField('shop_gstin', v.toUpperCase())}
                  placeholder="e.g. 33AABCS1429B1ZP"
                  maxLength={15}
                  mono
                />
              </SettingRow>

              <SettingRow label="Place of Supply (State)" required description="Base state determining Intrastate (CGST+SGST) vs Interstate (IGST)." id="place_of_supply">
                <SelectInput
                  id="place_of_supply"
                  value={settings.place_of_supply || settings.shop_state}
                  onChange={v => {
                    setField('place_of_supply', v)
                    setField('shop_state', v)
                  }}
                  options={[['', 'Select State'], ...INDIAN_STATES.map(s => [s.name, `${s.name} (${s.code})`])]}
                />
              </SettingRow>

              <SettingRow label="Default GST Rate" description="Default tax rate assigned when creating new items." id="default_gst_rate">
                <SelectInput
                  id="default_gst_rate"
                  value={settings.default_gst_rate || '18'}
                  onChange={v => setField('default_gst_rate', v)}
                  options={[
                    ['0', '0% (Exempted / Zero Rated)'],
                    ['5', '5% (Essential Goods & Food)'],
                    ['12', '12% (Standard Consumables)'],
                    ['18', '18% (Standard GST Goods & Services)'],
                    ['28', '28% (Luxury & Electronic Items)'],
                  ]}
                />
              </SettingRow>

              <SettingRow label="Tax on Price Mode" description="Whether shelf prices entered include or exclude tax." id="tax_on_price">
                <SelectInput
                  id="tax_on_price"
                  value={settings.tax_on_price || 'exclusive'}
                  onChange={v => setField('tax_on_price', v)}
                  options={[
                    ['exclusive', 'Tax Exclusive (GST calculated on top of item rate)'],
                    ['inclusive', 'Tax Inclusive (Item price already includes GST component)'],
                  ]}
                />
              </SettingRow>

              <div className="pt-2 border-t border-slate-200 space-y-3">
                <CheckboxField
                  checked={isTrue(settings.hsn_summary_on_invoice, true)}
                  onChange={v => setField('hsn_summary_on_invoice', String(v))}
                  label="Statutory HSN Tax Breakdown Summary Table on Invoices"
                  description="Prints summary table with Taxable Value, CGST, SGST, IGST totals."
                />
                <CheckboxField
                  checked={isTrue(settings.reverse_charge, false)}
                  onChange={v => setField('reverse_charge', String(v))}
                  label="Enable Reverse Charge Mechanism (RCM)"
                  description="Applicable when buyer pays GST directly to government."
                />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB: PAYMENT & BANK DETAILS
        ============================================================ */}
        {activeTab === 'payments' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 max-w-4xl w-full mx-auto">
            <PageHeader
              title="Payment & Bank Details"
              description="Manage bank account information, UPI payment QR codes, and online payment gateways."
              isDirty={isDirty}
              saving={saving}
              onSave={() => saveCurrentSettings('Updated bank and payment details')}
              saveLabel="Save Payment Details"
            />

            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-5">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block pb-2 border-b border-slate-200">
                Bank Wire Transfer Details
              </span>

              <SettingRow label="Bank Name" description="Name of commercial bank." id="shop_bank_name">
                <TextInput
                  id="shop_bank_name"
                  value={settings.shop_bank_name}
                  onChange={v => setField('shop_bank_name', v)}
                  placeholder="e.g. State Bank of India"
                />
              </SettingRow>

              <SettingRow label="Account Number" description="Current or savings account number." id="shop_bank_account">
                <TextInput
                  id="shop_bank_account"
                  value={settings.shop_bank_account}
                  onChange={v => setField('shop_bank_account', v)}
                  placeholder="e.g. 384920194829"
                  mono
                />
              </SettingRow>

              <SettingRow label="IFSC Code" description="11-character Indian Financial System Code." id="shop_bank_ifsc">
                <TextInput
                  id="shop_bank_ifsc"
                  value={settings.shop_bank_ifsc}
                  onChange={v => setField('shop_bank_ifsc', v.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  maxLength={11}
                  mono
                />
              </SettingRow>

              <SettingRow label="Branch Name" description="Bank branch locality." id="shop_bank_branch">
                <TextInput
                  id="shop_bank_branch"
                  value={settings.shop_bank_branch}
                  onChange={v => setField('shop_bank_branch', v)}
                  placeholder="e.g. Cathedral Road, Chennai"
                />
              </SettingRow>

              {/* UPI & Tabletop Standee */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                  UPI Payment QR & Tabletop Standee
                </span>

                <SettingRow label="Merchant UPI ID" description="UPI VPA address for instant collections." id="shop_upi_id">
                  <TextInput
                    id="shop_upi_id"
                    value={settings.shop_upi_id}
                    onChange={v => setField('shop_upi_id', v.trim())}
                    placeholder="e.g. balajistore@okaxis"
                    mono
                  />
                </SettingRow>

                <SettingRow label="UPI Merchant Name" description="Name displayed on customer payment apps." id="upi_merchant_name">
                  <TextInput
                    id="upi_merchant_name"
                    value={settings.upi_merchant_name}
                    onChange={v => setField('upi_merchant_name', v)}
                    placeholder="e.g. Sri Balaji Supermarket"
                  />
                </SettingRow>

                {/* Tabletop Standee Box */}
                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-4 sm:gap-5 items-center rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
                  <div>
                    <div className="flex items-center gap-3">
                      <img src={merchantStandIllustration} alt="Stand layout" className="h-12 w-10 shrink-0" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">Tabletop QR Standee</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">Print a high-resolution counter stand for your cash desk.</p>
                      </div>
                    </div>

                    {merchantQrValue ? (
                      <div className="mt-4 flex items-center gap-3">
                        <div id="merchant-qr-preview" className="shrink-0 rounded-lg border border-slate-200 bg-white p-2">
                          <QRCodeSVG value={merchantQrValue} size={100} level="H" marginSize={2} />
                        </div>
                        <div className="min-w-0 text-xs text-slate-700">
                          <p className="font-bold text-slate-900">{settings.upi_merchant_name || settings.shop_name || 'Merchant'}</p>
                          <p className="mt-0.5 font-mono text-slate-600 break-all text-[11px]">{settings.shop_upi_id}</p>
                          <div className="mt-2">
                            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Accepted payment apps</p>
                            <div className="flex items-center gap-2.5" aria-label="Accepted payment apps">
                              <img src={googlePayLogo} alt="Google Pay" title="Google Pay" className="h-5 w-auto max-w-[48px] object-contain" />
                              <img src={phonePeLogo} alt="PhonePe" title="PhonePe" className="h-5 w-auto max-w-[72px] object-contain" />
                              <img src={paytmLogo} alt="Paytm" title="Paytm" className="h-5 w-auto max-w-[54px] object-contain" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-slate-500">Configure a Merchant UPI ID above to preview and print standee.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:flex md:flex-col">
                    <button
                      type="button"
                      onClick={downloadMerchantQrStand}
                      disabled={!merchantQrValue || downloadingQrPng}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      <Download size={14} />
                      <span>{downloadingQrPng ? 'Preparing…' : 'Download PNG'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={printMerchantQrStand}
                      disabled={!merchantQrValue}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-[#1E3A5F] px-3 text-xs font-semibold text-white hover:bg-[#162F4D] disabled:opacity-50 transition-colors"
                    >
                      <Printer size={14} />
                      <span>Print QR stand</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB: REMINDERS & ALERTS
        ============================================================ */}
        {activeTab === 'reminders' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 max-w-4xl w-full mx-auto">
            <PageHeader
              title="Reminders & Notifications"
              description="Configure automatic overdue customer payment reminders and low inventory stock alerts."
              isDirty={isDirty}
              saving={saving}
              onSave={() => saveCurrentSettings('Updated reminder preferences')}
              saveLabel="Save Reminders"
            />

            <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <SettingRow label="Payment Reminder Notice (Days)" description="Send payment alerts before and after invoice due date." id="reminder_due_days">
                <SelectInput
                  id="reminder_due_days"
                  value={settings.reminder_due_days || '3'}
                  onChange={v => setField('reminder_due_days', v)}
                  options={[
                    ['1', '1 Day before & after due date'],
                    ['3', '3 Days before & after due date'],
                    ['7', '7 Days before & after due date'],
                  ]}
                />
              </SettingRow>

              <SettingRow label="Default Low Stock Threshold" description="Trigger dashboard alerts when item quantity dips below this count." id="low_stock_threshold">
                <TextInput
                  id="low_stock_threshold"
                  type="number"
                  value={settings.low_stock_threshold || '5'}
                  onChange={v => setField('low_stock_threshold', v)}
                  placeholder="5"
                />
              </SettingRow>

              <div className="pt-2 border-t border-slate-200 space-y-3">
                <CheckboxField
                  checked={isTrue(settings.enable_whatsapp_reminders, true)}
                  onChange={v => setField('enable_whatsapp_reminders', String(v))}
                  label="Enable WhatsApp Reminders for Outstanding Customer Receivables"
                  description="One-click send payment reminder with digital bill link via WhatsApp Web."
                />
                <CheckboxField
                  checked={isTrue(settings.enable_low_stock_notification, true)}
                  onChange={v => setField('enable_low_stock_notification', String(v))}
                  label="Enable Daily Low Stock Reorder Notifications in Header"
                />
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB: PRICING
        ============================================================ */}
        {activeTab === 'pricing' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 max-w-4xl w-full mx-auto">
            <PageHeader
              title="Pricing & Plan"
              description="View your active ERP subscription tier, features, and upgrade options."
              isDirty={false}
              saving={false}
              onSave={() => {}}
              saveLabel="Save"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Starter</span>
                  <div className="mt-2 text-2xl font-black text-slate-900">₹0 <span className="text-xs font-normal text-slate-500">/mo</span></div>
                  <p className="text-xs text-slate-600 mt-2">Essential POS billing for single counters.</p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-600">
                    <li className="flex items-center gap-2"><Check size={14} className="text-teal-600" /> POS billing</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-teal-600" /> Thermal receipt printing</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-teal-600" /> Basic inventory</li>
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border-2 border-indigo-600 bg-white p-5 shadow-md flex flex-col justify-between relative">
                <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white tracking-wider">
                  ACTIVE PLAN
                </span>
                <div>
                  <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Business Pro</span>
                  <div className="mt-2 text-2xl font-black text-slate-900">₹799 <span className="text-xs font-normal text-slate-500">/mo</span></div>
                  <p className="text-xs text-slate-600 mt-2">Comprehensive retail ERP with GST compliance.</p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-600">
                    <li className="flex items-center gap-2"><Check size={14} className="text-indigo-600" /> All invoice templates and saved template options</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-indigo-600" /> Barcode Sticker Printing (50×25mm)</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-indigo-600" /> Maker-Checker Dual-Control Approvals</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-indigo-600" /> Tabletop UPI QR Standee</li>
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Enterprise</span>
                  <div className="mt-2 text-2xl font-black text-slate-900">₹1,999 <span className="text-xs font-normal text-slate-500">/mo</span></div>
                  <p className="text-xs text-slate-600 mt-2">Multi-branch chains with centralized inventory.</p>
                  <ul className="mt-4 space-y-2 text-xs text-slate-600">
                    <li className="flex items-center gap-2"><Check size={14} className="text-teal-600" /> Multi-branch central warehouse</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-teal-600" /> Automated tally sync</li>
                    <li className="flex items-center gap-2"><Check size={14} className="text-teal-600" /> Dedicated account manager</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB: REFER & EARN
        ============================================================ */}
        {activeTab === 'refer' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 max-w-4xl w-full mx-auto">
            <PageHeader
              title="Refer & Earn Rewards"
              description="Invite fellow retail business owners and earn ₹500 credits for each activated store."
              isDirty={false}
              saving={false}
              onSave={() => {}}
              saveLabel="Save"
            />

            <div className="space-y-6">
              <div className="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/80 p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-2">
                  <Gift size={24} className="text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">Your Merchant Referral Code</h3>
                </div>
                <p className="text-xs text-slate-600 max-w-xl">
                  Share your unique referral link with fellow distributors, supermarkets, and stores. When they join, both of you receive ₹500 subscription discount credit!
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="px-4 py-2 rounded-xl border border-indigo-200 bg-white font-mono text-base font-bold text-indigo-700 shadow-2xs">
                    BALAJI500
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('BALAJI500')
                      toast.success('Referral code copied to clipboard!')
                    }}
                    className="h-10 px-4 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Copy size={14} />
                    <span>Copy Code</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs text-center">
                  <span className="text-[11px] font-semibold text-slate-500 block">Invited Stores</span>
                  <span className="text-2xl font-black text-slate-900 block mt-1">4</span>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs text-center">
                  <span className="text-[11px] font-semibold text-slate-500 block">Activated Stores</span>
                  <span className="text-2xl font-black text-teal-600 block mt-1">2</span>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs text-center">
                  <span className="text-[11px] font-semibold text-slate-500 block">Rewards Earned</span>
                  <span className="text-2xl font-black text-indigo-600 block mt-1">₹1,000</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB: HELP & SUPPORT
        ============================================================ */}
        {activeTab === 'support' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 max-w-4xl w-full mx-auto">
            <PageHeader
              title="Help & Support"
              description="Get immediate assistance from our technical team, hardware guides, and FAQ."
              isDirty={false}
              saving={false}
              onSave={() => {}}
              saveLabel="Save"
            />

            <div className="space-y-6">
              {/* Contact Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <a
                  href="https://wa.me/919876543210"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-500 shadow-2xs transition-all flex flex-col items-center text-center group"
                >
                  <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <MessageCircle size={20} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">WhatsApp Helpdesk</span>
                  <span className="text-[11px] text-slate-500 mt-0.5">Average reply in 5 mins</span>
                </a>

                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center mb-2">
                    <PhoneCall size={20} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Phone Support</span>
                  <span className="text-[11px] text-slate-500 mt-0.5">Mon–Sat, 9:00 AM – 8:00 PM</span>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center mb-2">
                    <Mail size={20} />
                  </div>
                  <span className="text-xs font-bold text-slate-900">Email Support</span>
                  <span className="text-[11px] text-slate-500 mt-0.5">support@billing-erp.in</span>
                </div>
              </div>

              {/* FAQ Accordion */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Frequently Asked Questions
                </h3>

                <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-800">How do I setup a thermal receipt printer?</h4>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Under Print Settings, choose either 2-inch (58 mm) or 3-inch (80 mm) paper width. Ensure your browser print margins are set to &apos;None&apos;. The system outputs standard continuous receipts formatted specifically for POS thermal rolls.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-800">How do I print 50 × 25 mm barcode labels?</h4>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Navigate to Print Settings &rarr; Barcode Print tab. Select 50 &times; 25 mm Standard Label Roll. You can toggle business name, product title, MRP, and selling price. Tap &apos;Test Print Label&apos; to print directly to your label printer.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                  <h4 className="text-xs font-bold text-slate-800">How does the Maker-Checker approval workflow work?</h4>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Sensitive operations like discounts exceeding 10%, refunds over ₹1,000, or bill cancellations enter a pending approval state. An administrator receives a notification to approve or reject the request before database records are committed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            TAB: KEYBOARD SHORTCUTS
        ============================================================ */}
        {activeTab === 'keyboard' && (
          <div className="flex-1 flex flex-col min-h-0 p-4 sm:p-6 max-w-4xl w-full mx-auto">
            <PageHeader
              title="Keyboard Shortcuts"
              description="High-speed cash desk POS shortcuts for rapid checkout without touching the mouse."
              isDirty={false}
              saving={false}
              onSave={() => {}}
              saveLabel="Save"
            />

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs overflow-x-auto">
              <table className="erp-table w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-2.5 px-3">Shortcut Key</th>
                    <th className="py-2.5 px-3">POS Counter Action</th>
                    <th className="py-2.5 px-3">Context</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">F1</td>
                    <td className="py-2.5 px-3 font-medium">New Sale Bill</td>
                    <td className="py-2.5 px-3 text-slate-500">Everywhere</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">F2</td>
                    <td className="py-2.5 px-3 font-medium">Hold Cart Bill</td>
                    <td className="py-2.5 px-3 text-slate-500">POS Checkout</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">F3</td>
                    <td className="py-2.5 px-3 font-medium">Search Customer</td>
                    <td className="py-2.5 px-3 text-slate-500">POS Checkout</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">F4</td>
                    <td className="py-2.5 px-3 font-medium">Complete Payment & Print</td>
                    <td className="py-2.5 px-3 text-slate-500">POS Checkout</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">F8</td>
                    <td className="py-2.5 px-3 font-medium">Barcode Scan Focus</td>
                    <td className="py-2.5 px-3 text-slate-500">POS Checkout</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">Esc</td>
                    <td className="py-2.5 px-3 font-medium">Close Modal / Cancel</td>
                    <td className="py-2.5 px-3 text-slate-500">Dialog Windows</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ==============================================================
          ALL INVOICE TEMPLATES DRAWER
      ============================================================== */}
      {showAllTemplates && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="all-invoice-templates-title" onMouseDown={event => { if (event.target === event.currentTarget) setShowAllTemplates(false) }}>
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-6">
              <div>
                <h2 id="all-invoice-templates-title" className="text-base font-bold text-slate-900">All Invoice Templates</h2>
                <p className="mt-0.5 text-xs text-slate-500">Choose a layout after previewing the actual invoice design.</p>
              </div>
              <button type="button" onClick={() => setShowAllTemplates(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Close all templates"> <X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {invoiceTemplates.map(template => {
                  const selected = selectedTemplateId === template.id
                  return (
                    <button key={template.id} type="button" onClick={() => { handleSelectInvoiceTemplate(template); setShowAllTemplates(false) }} className={`overflow-hidden rounded-xl border p-3 text-left transition ${selected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-indigo-300 hover:shadow-md'}`}>
                      <div className="h-[210px] overflow-hidden rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <div className="mx-auto" style={{ width: template.format === 'thermal' ? 302 : 560, transform: `scale(${template.format === 'thermal' ? 0.62 : 0.34})`, transformOrigin: 'top center', pointerEvents: 'none' }}>
                          <InvoiceDocument invoice={sampleInvoice} settings={settings} templateConfig={getTemplatePreviewConfig(template)} mode={template.id} showModePicker={false} />
                        </div>
                      </div>
                      <div className="mt-3 flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">{template.name}</h3>
                          <p className="mt-0.5 text-xs text-slate-500">{template.badge || template.size}</p>
                        </div>
                        {selected && <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white"><Check size={12} /> Selected</span>}
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{template.desc}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          CREATE CUSTOM INVOICE THEME
      ============================================================== */}
      {showCustomTheme && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="custom-invoice-theme-title" onMouseDown={event => { if (event.target === event.currentTarget) setShowCustomTheme(false) }}>
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="custom-invoice-theme-title" className="text-base font-bold text-slate-900">Create Custom Theme</h2>
                <p className="mt-0.5 text-xs text-slate-500">Preview updates as you change these settings. Save with the Settings bar.</p>
              </div>
              <button type="button" onClick={() => setShowCustomTheme(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close custom theme"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-700">Primary color<input type="color" value={settings.invoice_theme_color || '#1e3a5f'} onChange={event => setField('invoice_theme_color', event.target.value)} className="mt-1 block h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1" /></label>
              <label className="text-xs font-semibold text-slate-700">Secondary color<input type="color" value={settings.invoice_theme_secondary || settings.invoice_theme_color || '#64748b'} onChange={event => setField('invoice_theme_secondary', event.target.value)} className="mt-1 block h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1" /></label>
              <label className="text-xs font-semibold text-slate-700">Font<select value={settings.invoice_font || 'inter'} onChange={event => setField('invoice_font', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"><option value="inter">Inter / Sans serif</option><option value="roboto">Roboto</option><option value="times">Times New Roman</option><option value="courier">Courier</option></select></label>
              <label className="text-xs font-semibold text-slate-700">Border style<select value={settings.invoice_border_style || 'solid'} onChange={event => setField('invoice_border_style', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="double">Double</option></select></label>
              <label className="text-xs font-semibold text-slate-700">Header style<select value={settings.invoice_header_layout || 'logo_left'} onChange={event => setField('invoice_header_layout', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"><option value="logo_left">Logo left</option><option value="split">Split</option><option value="center">Centered</option><option value="corporate_bar">Corporate accent</option><option value="name_only">Business name only</option></select></label>
              <label className="text-xs font-semibold text-slate-700">Table style<select value={settings.invoice_table_style || 'clean'} onChange={event => setField('invoice_table_style', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"><option value="clean">Clean</option><option value="striped">Striped rows</option><option value="bold">Bold header</option></select></label>
              <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Invoice layout<select value={settings.invoice_layout || 'standard'} onChange={event => setField('invoice_layout', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"><option value="standard">Standard A4</option><option value="compact">Compact</option><option value="thermal">Thermal receipt</option></select></label>
            </div>
            <div className="mx-5 mb-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Live theme preview</p>
              <div className="h-[190px] overflow-hidden rounded bg-white p-2">
                <div className="mx-auto w-[560px] origin-top scale-[0.32]" style={{ pointerEvents: 'none' }}>
                  <InvoiceDocument invoice={sampleInvoice} settings={settings} templateConfig={getTemplatePreviewConfig(previewInvoiceTemplate)} mode={previewTemplateId} showModePicker={false} />
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-3"><button type="button" onClick={() => setShowCustomTheme(false)} className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-700">Done</button></div>
          </div>
        </div>
      )}

    </div>
  )
}
