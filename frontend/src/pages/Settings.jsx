import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2,
  Receipt,
  FileText,
  Percent,
  CreditCard,
  Save,
  Check,
  X,
  Upload,
  Trash2,
  Printer,
  Eye,
  ChevronRight,
  Sliders,
  ArrowUp,
  Download,
  Keyboard,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
} from 'lucide-react'
import api from '../api'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'
import InvoiceDocument, { isTrue } from '../components/InvoiceDocument'
import './Settings.css'
import TemplateCustomizerModal from '../components/TemplateCustomizerModal'
import { drawTabletopStandeeCanvas, generatePrintStandHtml, loadUpiBrandLogos } from '../components/UpiLogos'
import merchantStandIllustration from '../assets/merchant-qr-stand.svg'

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
   SETTINGS NAVIGATION SECTIONS DEFINITION
===================================================================== */
const SECTIONS = [
  { id: 'business', label: 'Business Profile', icon: Building2, desc: 'Store details, GSTIN & branding' },
  { id: 'billing', label: 'Billing & Invoice', icon: Receipt, desc: 'Numbering, terms, notes & columns' },
  { id: 'templates', label: 'Invoice Templates & Printing', icon: FileText },
  { id: 'tax', label: 'Tax & GST', icon: Percent, desc: 'GST rules, rates & tax modes' },
  { id: 'payments', label: 'Payment & Bank Details', icon: CreditCard, desc: 'Payment collection, UPI & bank account' },
  { id: 'keyboard', label: 'Keyboard Shortcuts', icon: Keyboard },
]

/* =====================================================================
   TEMPLATE CATALOG DEFINITIONS
===================================================================== */
const TEMPLATE_CATALOG = [
  {
    id: 'gst_a4',
    name: 'A4 GST Invoice',
    paper: 'A4 Portrait',
    dimensions: '210 x 297 mm',
    type: 'a4',
    desc: 'Full-sheet formal GST tax invoice with statutory HSN tax breakdown table.',
  },
  {
    id: 'half_a4',
    name: 'Half-A4 / A5 Bill',
    paper: 'A5 Portrait',
    dimensions: '148 x 210 mm',
    type: 'half_a4',
    desc: 'Cost-saving compact half sheet format for fast-paced kirana and retail counters.',
  },
  {
    id: 'stylish',
    name: 'Stylish A4',
    paper: 'A4 Portrait',
    dimensions: '210 x 297 mm',
    type: 'a4',
    desc: 'Modern corporate layout with high-contrast accent header and item stripes.',
  },
  {
    id: 'thermal_80',
    name: '80mm Thermal Receipt',
    paper: '80mm Roll (3 inch)',
    dimensions: '80 mm continuous',
    type: 'thermal_80',
    desc: 'Standard high-speed POS thermal receipt with square UPI QR code.',
  },
  {
    id: 'thermal_58',
    name: '58mm Thermal Receipt',
    paper: '58mm Roll (2 inch)',
    dimensions: '58 mm continuous',
    type: 'thermal_58',
    desc: 'Compact thermal slip designed for mini handheld and Bluetooth printers.',
  },
]

/* =====================================================================
   REUSABLE STRUCTURED FORM CONTROLS
===================================================================== */
function SettingRow({ label, description, required = false, children, error, id }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-6 py-3.5 border-b border-[#DCE3EC]  items-start">
      <div className="md:col-span-4 lg:col-span-4">
        <label htmlFor={id} className="text-xs font-semibold text-slate-800  block">
          {label} {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
        {description && (
          <p className="text-[11px] leading-relaxed text-slate-500  mt-0.5">
            {description}
          </p>
        )}
      </div>
      <div className="md:col-span-8 lg:col-span-8 max-w-xl">
        {children}
        {error && <p className="text-[11px] text-rose-600  font-medium mt-1">{error}</p>}
      </div>
    </div>
  )
}

function SectionHeading({ title, description, badge }) {
  return (
    <div className="pb-3 border-b border-[#DCE3EC]  flex items-center justify-between">
      <div>
        <h2 className="text-sm font-bold text-slate-900  tracking-tight flex items-center gap-2">
          <span>{title}</span>
          {badge && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700   border border-indigo-200 ">
              {badge}
            </span>
          )}
        </h2>
        {description && (
          <p className="text-xs text-slate-500  mt-0.5">
            {description}
          </p>
        )}
      </div>
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
      className={`w-full h-10 sm:h-8 px-2.5 text-xs rounded border transition-colors bg-white  text-slate-900  ${
        mono ? 'font-mono' : ''
      } ${
        error
          ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
          : 'border-[#DCE3EC]  focus:border-indigo-600  focus:ring-1 focus:ring-indigo-600 '
      } disabled:opacity-60 disabled:bg-slate-50 `}
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
      className="w-full h-10 sm:h-8 px-2.5 text-xs rounded border border-[#DCE3EC]  bg-white  text-slate-900  focus:border-indigo-600  focus:ring-1 focus:ring-indigo-600  disabled:opacity-60"
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
      className="w-full px-2.5 py-1.5 text-xs rounded border border-[#DCE3EC]  bg-white  text-slate-900  focus:border-indigo-600  focus:ring-1 focus:ring-indigo-600 "
    />
  )
}

function ToggleSwitch({ checked, onChange, label, description, disabled = false }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <div className="relative inline-flex items-center shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={Boolean(checked)}
          onChange={e => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only peer"
        />
        <div className="w-8 h-4.5 bg-slate-300  peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-indigo-600 " />
      </div>
      <div className="min-w-0">
        <span className="text-xs font-semibold text-slate-800  block">
          {label}
        </span>
        {description && (
          <span className="text-[11px] text-slate-500  block mt-0.5 leading-relaxed">
            {description}
          </span>
        )}
      </div>
    </label>
  )
}

function SectionFooterActions({ onSave, onCancel, saving, isDirty, label = 'Save Changes' }) {
  return (
    <div className="pt-5 mt-6 border-t border-[#DCE3EC]  flex items-center justify-between">
      <div className="text-xs">
        {isDirty ? (
          <span className="text-amber-700  font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Unsaved changes in this section
          </span>
        ) : (
          <span className="text-slate-500  flex items-center gap-1.5">
            <Check size={13} className="text-teal-600 " />
            Settings saved
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isDirty && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="h-10 sm:h-8 px-3 text-xs font-medium rounded border border-[#DCE3EC]  text-slate-700  bg-white  hover:bg-slate-50  transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !isDirty}
          className="h-10 sm:h-8 px-4 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 text-white shadow-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save size={13} />
              <span>{label}</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

/* =====================================================================
   MAIN SETTINGS PAGE COMPONENT
===================================================================== */
export default function Settings() {
  // State
  const [activeSection, setActiveSection] = useState('business')
  const [settings, setSettings] = useState({})
  const [initialSettings, setInitialSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [customizingTemplateId, setCustomizingTemplateId] = useState(null)
  const [previewFormat, setPreviewFormat] = useState('a4')
  const [previewZoom, setPreviewZoom] = useState(1.0)
  const [downloadingQrPng, setDownloadingQrPng] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  const logoInputRef = useRef(null)

  // 1. Load initial settings
  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/settings/all/')
      const data = res.data || {}
      setSettings(data)
      setInitialSettings(data)
      if (data.invoice_template) {
        setPreviewFormat(data.invoice_template)
      }
    } catch {
      toast.error('Failed to load shop settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    const scrollContainer = document.querySelector('#root main')
    const updateScrollButton = () => setShowScrollTop((scrollContainer?.scrollTop || window.scrollY) > 320)
    updateScrollButton()
    scrollContainer?.addEventListener('scroll', updateScrollButton, { passive: true })
    window.addEventListener('scroll', updateScrollButton, { passive: true })
    return () => {
      scrollContainer?.removeEventListener('scroll', updateScrollButton)
      window.removeEventListener('scroll', updateScrollButton)
    }
  }, [])

  // Field updater
  const setField = useCallback((key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }))
  }, [])

  // Check dirty state
  const isDirty = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(initialSettings)
  }, [settings, initialSettings])

  // Save Settings to Backend
  const saveCurrentSettings = async (reasonText = 'Settings updated via ERP console') => {
    setSaving(true)
    try {
      // Exclude nested objects from flat key-value save
      const payload = {}
      Object.keys(settings).forEach(key => {
        if (key !== 'active_templates' && key !== 'template_settings') {
          payload[key] = settings[key]
        }
      })
      payload.reason = reasonText

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

  // Logo upload
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

  // Logo removal
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

  // Active Template Selector
  const handleSelectTemplate = async (formatKey, templateId) => {
    try {
      const res = await api.post('/settings/templates/select-active/', {
        format: formatKey,
        template_id: templateId,
      })
      setSettings(prev => ({
        ...prev,
        active_templates: res.data,
        invoice_template: templateId,
      }))
      setInitialSettings(prev => ({
        ...prev,
        active_templates: res.data,
        invoice_template: templateId,
      }))
      setPreviewFormat(templateId)
      toast.success(`Active invoice template set to ${TEMPLATE_CATALOG.find(t => t.id === templateId)?.name || templateId}`)
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to select active template')
    }
  }

  const availableTemplates = useMemo(() => {
    const backendTemplates = settings.template_settings?.templates
    if (!Array.isArray(backendTemplates) || backendTemplates.length === 0) return TEMPLATE_CATALOG

    return backendTemplates.flatMap(template => {
      const localTemplate = TEMPLATE_CATALOG.find(item => item.id === template.id)
      if (!localTemplate) return []
      return [{
        ...localTemplate,
        name: template.name || localTemplate.name,
        dimensions: template.size || localTemplate.dimensions,
        desc: template.desc || localTemplate.desc,
      }]
    })
  }, [settings.template_settings])

  const merchantQrValue = useMemo(() => {
    if (!settings.shop_upi_id) return ''
    const merchantName = settings.upi_merchant_name || settings.shop_name || ''
    return `upi://pay?pa=${encodeURIComponent(settings.shop_upi_id)}&pn=${encodeURIComponent(merchantName)}&cu=INR`
  }, [settings.shop_upi_id, settings.upi_merchant_name, settings.shop_name])

  const printSelectedInvoice = (templateId = previewFormat) => {
    const selectedTemplate = TEMPLATE_CATALOG.find(template => template.id === templateId)
    const pageSize = selectedTemplate?.type === 'half_a4'
      ? 'A5 portrait'
      : selectedTemplate?.type.startsWith('thermal')
        ? `${selectedTemplate.id === 'thermal_58' ? '58mm' : '80mm'} 200mm`
        : 'A4 portrait'
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

  const openTestPrint = () => {
    const activeTemplates = settings.active_templates || {}
    const printerType = String(settings.printer_type || 'a4').toLowerCase()
    const templateId = printerType.startsWith('thermal')
      ? activeTemplates.active_template_thermal || printerType
      : ['half_a4', 'a5'].includes(printerType)
        ? activeTemplates.active_template_half_a4 || 'half_a4'
        : activeTemplates.active_template_a4 || settings.invoice_template || 'gst_a4'
    setPreviewFormat(templateId)
    setPreviewModalOpen(true)
    window.setTimeout(() => printSelectedInvoice(templateId), 500)
  }

  const printMerchantQrStand = () => {
    if (!merchantQrValue) {
      toast.error('Add a merchant UPI ID in Bank & UPI Details first')
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
      toast.error('Add a merchant UPI ID in Bank & UPI Details first')
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

  // Realistic Sample Invoice for Live Document Previews
  const sampleInvoice = useMemo(() => {
    const prefix = settings.invoice_prefix || 'INV-'
    const startNum = settings.invoice_start_number || '1001'
    return {
      invoice_number: `${prefix}${/[-/_]$/.test(prefix) ? '' : '-'}${String(startNum).padStart(4, '0')}`,
      created_at: new Date().toISOString(),
      due_date: new Date(Date.now() + 15 * 86400000).toISOString(),
      payment_method: (settings.default_payment_method || 'cash').toUpperCase(),
      payment_status: 'paid',
      customer_name: 'Walk-in Retail Customer',
      customer_phone: '+91 98765 43210',
      customer_address: 'Flat 4A, Green Park Apartments, Cathedral Road, Chennai 600086',
      customer_gstin: settings.gst_reg_type !== 'unregistered' ? '33AABCS1429B1ZP' : '',
      place_of_supply: settings.place_of_supply || settings.shop_state || 'Tamil Nadu (33)',
      notes: settings.invoice_notes || 'Thank you for shopping with us! Visit again.',
      terms: settings.invoice_terms || '1. Goods once sold will be exchanged within 7 days.\n2. Please retain original invoice for claims.',
      items: [
        {
          product_name: 'India Gate Basmati Rice 5kg',
          sku: 'RICE-001',
          hsn_code: '100630',
          unit: 'kg',
          quantity: 2,
          unit_price: 260,
          discount_percent: 0,
          gst_percent: 5,
          total: 546.0,
        },
        {
          product_name: 'Fortune Sunflower Oil 1L Pouch',
          sku: 'OIL-001',
          hsn_code: '151219',
          unit: 'L',
          quantity: 3,
          unit_price: 145,
          discount_percent: 5,
          gst_percent: 5,
          total: 433.91,
        },
        {
          product_name: 'Amul Pasteurised Butter 500g',
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
      discount_amount: 21.75,
      tax_amount: 119.91,
      grand_total: 1573.16,
      paid_amount: 1573.16,
      balance_due: 0,
    }
  }, [settings])

  if (loading) {
    return (
      <div className="w-full min-h-[500px] flex flex-col items-center justify-center p-8 text-slate-500">
        <div className="h-8 w-8 rounded-full border-2 border-indigo-600/30 border-t-indigo-600 animate-spin mb-3" />
        <span className="text-xs font-semibold">Loading enterprise settings...</span>
      </div>
    )
  }

  return (
    <div className="settings-page min-h-full w-full min-w-0 bg-[var(--app-bg)] pb-16 font-sans text-[var(--ink)]">
      {/* ==============================================================
          1. BREADCRUMB & PAGE HEADER
      ============================================================== */}
      <div className="border-b border-[#DCE3EC]  pb-4 mb-5">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500  mb-1.5">
          <Link to="/" className="hover:text-indigo-600  transition-colors">
            Home
          </Link>
          <ChevronRight size={12} className="text-slate-400" />
          <span className="text-slate-900  font-semibold">Settings</span>
        </nav>

        {/* Title and Top Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 ">
              Settings
            </h1>
            <p className="text-xs text-slate-500  mt-0.5">
              Manage your business, billing, invoices, payments, and application preferences.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {isDirty && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50  text-amber-700  border border-amber-200  text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved Changes
              </span>
            )}
            <button
              type="button"
              onClick={() => saveCurrentSettings('Top bar save button')}
              disabled={saving || !isDirty}
              className="h-10 sm:h-8 px-4 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 text-white shadow-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={13} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ==============================================================
          2. TWO-COLUMN ERP SETTINGS LAYOUT
      ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-6 items-start">
        {/* Left Settings Navigation (~240px) */}
        <aside className="w-full min-w-0 rounded border border-[#DCE3EC] bg-white p-1.5 shadow-2xs lg:sticky lg:top-4">
          <div className="flex max-w-full snap-x gap-1 overflow-x-auto overscroll-x-contain pb-1 lg:pb-0 lg:flex-col no-scrollbar">
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className={`flex min-w-max snap-start items-center justify-between rounded px-3 py-2 text-left text-xs whitespace-nowrap shrink-0 lg:min-w-0 lg:shrink lg:whitespace-normal transition-colors min-h-11 lg:min-h-[40px] w-auto lg:w-full ${
                    isActive
                      ? 'bg-indigo-50  text-indigo-700  font-semibold border-l-2 border-indigo-600 '
                      : 'text-slate-600  hover:bg-slate-50  hover:text-slate-900  font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon size={15} className={`shrink-0 ${isActive ? 'text-indigo-600 ' : 'text-slate-400 '}`} />
                    <span className="truncate">{label}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600  shrink-0 ml-1.5 hidden lg:block" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="hidden lg:block mt-3 pt-3 border-t border-[#DCE3EC]  px-2.5 text-[11px] text-slate-500 ">
            <div className="font-semibold text-slate-800  truncate">{settings.shop_name || 'My Store'}</div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
              GSTIN: {settings.shop_gstin || 'Unregistered'}
            </div>
          </div>
        </aside>

        {/* Right Settings Content Canvas */}
        <main className="min-w-0 rounded border border-[#DCE3EC] bg-white p-5 shadow-2xs sm:p-6">
          {/* ==========================================================
              SECTION 1: BUSINESS PROFILE
          ========================================================== */}
          {activeSection === 'business' && (
            <div className="space-y-6">
              <SectionHeading
                title="Business Profile"
                description="Manage your business identity, legal registration, official contact information, and store branding."
              />

              {/* Logo Upload Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-6 py-3.5 border-b border-[#DCE3EC]  items-center">
                <div className="md:col-span-4">
                  <span className="text-xs font-semibold text-slate-800  block">
                    Business Logo
                  </span>
                  <p className="text-[11px] text-slate-500  mt-0.5">
                    Printed on headers of tax invoices, POS receipts, and delivery challans.
                  </p>
                </div>
                <div className="md:col-span-8 flex flex-wrap items-center gap-4">
                  <div className="h-16 w-16 rounded border border-[#DCE3EC]  bg-slate-50  flex items-center justify-center overflow-hidden shrink-0">
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
                      className="h-8 px-3 text-xs font-semibold rounded border border-[#DCE3EC]  bg-white  hover:bg-slate-50 text-slate-700  inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Upload size={13} />
                      <span>{uploadingLogo ? 'Uploading...' : settings.shop_logo ? 'Replace Logo' : 'Upload Logo'}</span>
                    </button>
                    {settings.shop_logo && (
                      <button
                        type="button"
                        onClick={handleLogoRemove}
                        disabled={removingLogo}
                        className="h-8 px-2.5 text-xs font-medium rounded border border-rose-200  text-rose-600  hover:bg-rose-50  transition-colors"
                        title="Remove Logo"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400">PNG, JPG, or SVG up to 2 MB</span>
                </div>
              </div>

              {/* Business Name */}
              <SettingRow label="Business Name" required description="Legal name or trade name printed on bill headers." id="shop_name">
                <TextInput
                  id="shop_name"
                  value={settings.shop_name}
                  onChange={v => setField('shop_name', v)}
                  placeholder="e.g. Sri Balaji Supermarket"
                />
              </SettingRow>

              {/* Business Type */}
              <SettingRow label="Business Type" description="Industry classification for tax categorizations and reports." id="business_type">
                <SelectInput
                  id="business_type"
                  value={settings.business_type || 'retail'}
                  onChange={v => setField('business_type', v)}
                  options={[
                    ['retail', 'Grocery / Kirana & Retail Provision'],
                    ['supermarket', 'Supermarket & Departmental Store'],
                    ['wholesale', 'Wholesale & FMCG Distribution'],
                    ['electronics', 'Electronics & Mobile Retail'],
                    ['pharmacy', 'Pharmacy & Medical Retail'],
                    ['apparel', 'Textiles, Garments & Boutique'],
                    ['food', 'Bakery, Restaurant & Food Outlet'],
                    ['general', 'General Enterprise Retail'],
                  ]}
                />
              </SettingRow>

              {/* Owner / Contact Name */}
              <SettingRow label="Owner / Proprietor Name" description="Primary account holder or shop owner name." id="owner_name">
                <TextInput
                  id="owner_name"
                  value={settings.owner_name}
                  onChange={v => setField('owner_name', v)}
                  placeholder="e.g. Anand Kumar"
                />
              </SettingRow>

              {/* Phone & Email */}
              <SettingRow label="Phone Number" required description="10-digit primary contact number for bill headers." id="shop_phone">
                <TextInput
                  id="shop_phone"
                  value={settings.shop_phone}
                  onChange={v => setField('shop_phone', v)}
                  placeholder="e.g. 9876543210"
                  maxLength={15}
                />
              </SettingRow>

              <SettingRow label="Email Address" description="Official email address for billing correspondence." id="shop_email">
                <TextInput
                  id="shop_email"
                  type="email"
                  value={settings.shop_email}
                  onChange={v => setField('shop_email', v)}
                  placeholder="e.g. contact@balajistore.com"
                />
              </SettingRow>

              {/* Address */}
              <SettingRow label="Store Address" required description="Physical retail address printed on tax invoices." id="shop_address">
                <TextAreaInput
                  id="shop_address"
                  value={settings.shop_address}
                  onChange={v => setField('shop_address', v)}
                  placeholder="e.g. Shop No. 12, Market Road, T. Nagar"
                />
              </SettingRow>

              {/* City, State, PIN */}
              <SettingRow label="City & PIN Code" required description="Operating city and postal PIN code." id="shop_city">
                <div className="grid grid-cols-2 gap-3">
                  <TextInput
                    id="shop_city"
                    value={settings.shop_city}
                    onChange={v => setField('shop_city', v)}
                    placeholder="City (e.g. Chennai)"
                  />
                  <TextInput
                    id="shop_pincode"
                    value={settings.shop_pincode}
                    onChange={v => setField('shop_pincode', v)}
                    placeholder="PIN (e.g. 600017)"
                    maxLength={6}
                    mono
                  />
                </div>
              </SettingRow>

              <SettingRow label="State of Registration" required description="GST jurisdiction used for intra vs inter-state tax splits." id="shop_state">
                <SelectInput
                  id="shop_state"
                  value={settings.shop_state || 'Tamil Nadu (33)'}
                  onChange={v => {
                    setField('shop_state', v)
                    setField('place_of_supply', v)
                  }}
                  options={INDIAN_STATES.map(s => [`${s.name} (${s.code})`, `${s.name} (${s.code})`])}
                />
              </SettingRow>

              <SettingRow label="Country" id="shop_country">
                <TextInput
                  id="shop_country"
                  value={settings.shop_country || 'India'}
                  onChange={v => setField('shop_country', v)}
                  disabled
                />
              </SettingRow>

              {/* GST Status & GSTIN */}
              <SettingRow label="GST Registration Status" required description="Determines whether GST rates and CGST/SGST splits apply." id="gst_reg_type">
                <SelectInput
                  id="gst_reg_type"
                  value={settings.gst_reg_type || 'regular'}
                  onChange={v => setField('gst_reg_type', v)}
                  options={[
                    ['regular', 'Registered - Regular GST (Tax Invoice)'],
                    ['composition', 'Composition Scheme (Bill of Supply)'],
                    ['unregistered', 'Unregistered / Consumer Retail (No GST)'],
                  ]}
                />
              </SettingRow>

              {settings.gst_reg_type !== 'unregistered' && (
                <SettingRow
                  label="GSTIN Number"
                  required
                  description="15-character Goods & Services Tax Identification Number."
                  id="shop_gstin"
                  error={
                    settings.shop_gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(settings.shop_gstin.trim())
                      ? 'Invalid GSTIN format (e.g. 33AABCS1429B1ZP)'
                      : null
                  }
                >
                  <TextInput
                    id="shop_gstin"
                    value={settings.shop_gstin}
                    onChange={v => setField('shop_gstin', v.toUpperCase())}
                    placeholder="e.g. 33AABCS1429B1ZP"
                    maxLength={15}
                    mono
                  />
                </SettingRow>
              )}

              {/* Website */}
              <SettingRow label="Website / Online Portal" description="Optional web address for customer receipts." id="shop_website">
                <TextInput
                  id="shop_website"
                  value={settings.shop_website}
                  onChange={v => setField('shop_website', v)}
                  placeholder="e.g. https://www.balajistore.com"
                />
              </SettingRow>

              {/* Store Identity & Header Printing Controls */}
              <div className="pt-4 border-t border-[#DCE3EC]">
                <div className="mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Bill Header &amp; Store Printing Controls
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Configure whether store branding and details appear on printed bills and receipts.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 py-3 border-y border-[#DCE3EC]">
                  <div className="col-span-1 sm:col-span-2">
                    <ToggleSwitch
                      checked={isTrue(settings.show_shop_details, true)}
                      onChange={v => setField('show_shop_details', String(v))}
                      label="Print Store Header on Bills"
                      description="Master switch: display business identity header on printed invoices and receipts."
                    />
                  </div>
                  <ToggleSwitch
                    checked={isTrue(settings.show_business_name, true)}
                    onChange={v => setField('show_business_name', String(v))}
                    disabled={!isTrue(settings.show_shop_details, true)}
                    label="Store Name on Bill"
                    description="Print company/shop trade name in header."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_business_logo, true)}
                    onChange={v => setField('show_business_logo', String(v))}
                    disabled={!isTrue(settings.show_shop_details, true)}
                    label="Store Logo on Bill"
                    description="Print business graphic logo in header."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_business_address, true)}
                    onChange={v => setField('show_business_address', String(v))}
                    disabled={!isTrue(settings.show_shop_details, true)}
                    label="Store Address on Bill"
                    description="Print physical shop address on invoices."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_business_phone, true)}
                    onChange={v => setField('show_business_phone', String(v))}
                    disabled={!isTrue(settings.show_shop_details, true)}
                    label="Contact Phone & Email"
                    description="Print contact numbers and support email."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_business_gstin, true)}
                    onChange={v => setField('show_business_gstin', String(v))}
                    disabled={!isTrue(settings.show_shop_details, true)}
                    label="Tax Registrations (GSTIN & PAN)"
                    description="Print 15-digit GSTIN and PAN numbers."
                  />
                </div>
              </div>

              <SectionFooterActions
                onSave={() => saveCurrentSettings('Updated business profile')}
                onCancel={loadSettings}
                saving={saving}
                isDirty={isDirty}
              />
            </div>
          )}

          {/* ==========================================================
              SECTION 2: BILLING & INVOICE
          ========================================================== */}
          {activeSection === 'billing' && (
            <div className="space-y-6">
              <SectionHeading
                title="Billing & Invoice Settings"
                description="Configure invoice numbering format, calculation preferences, default payment terms, and printed bill fields."
              />

              {/* Numbering Prefix & Starting */}
              <SettingRow label="Invoice Prefix" required description="Prefix prepended to sequential bill numbers." id="invoice_prefix">
                <TextInput
                  id="invoice_prefix"
                  value={settings.invoice_prefix || 'INV-'}
                  onChange={v => setField('invoice_prefix', v)}
                  placeholder="e.g. INV- or BILL-"
                  maxLength={10}
                  mono
                />
              </SettingRow>

              <SettingRow
                label="Next Invoice Sequence"
                required
                description="Starting sequence number for subsequent sales. Duplicate sequence numbers are protected."
                id="invoice_start_number"
              >
                <TextInput
                  id="invoice_start_number"
                  type="number"
                  value={settings.invoice_start_number || '1001'}
                  onChange={v => setField('invoice_start_number', v)}
                  placeholder="1001"
                  mono
                />
              </SettingRow>

              {/* Default Payment Terms & Discount */}
<SettingRow label="Default Tax Inclusion Mode" description="Whether retail item rates already include GST." id="tax_on_price">
                <SelectInput
                  id="tax_on_price"
                  value={settings.tax_on_price || 'exclusive'}
                  onChange={v => setField('tax_on_price', v)}
                  options={[
                    ['exclusive', 'Exclusive of GST (Tax added on top of base price)'],
                    ['inclusive', 'Inclusive of GST (Tax back-calculated from MRP)'],
                  ]}
                />
              </SettingRow>

              {/* Default Notes & Terms */}
              <SettingRow label="Default Invoice Notes" description="Closing note printed above invoice footer." id="invoice_notes">
                <TextAreaInput
                  id="invoice_notes"
                  value={settings.invoice_notes}
                  onChange={v => setField('invoice_notes', v)}
                  placeholder="Thank you for shopping with us! Visit again."
                  rows={2}
                />
              </SettingRow>

              <SettingRow label="Invoice Footer Message" description="Thank-you message printed at the very bottom of every bill." id="invoice_footer">
                <TextInput
                  id="invoice_footer"
                  value={settings.invoice_footer}
                  onChange={v => setField('invoice_footer', v)}
                  placeholder="THANK YOU FOR SHOPPING WITH US! VISIT AGAIN."
                />
              </SettingRow>

              <SettingRow label="Terms & Conditions" description="Store policies and exchange rules printed on invoices." id="invoice_terms">
                <TextAreaInput
                  id="invoice_terms"
                  value={settings.invoice_terms}
                  onChange={v => setField('invoice_terms', v)}
                  placeholder="1. Goods once sold can be exchanged within 7 days.&#10;2. Please produce original bill for returns."
                  rows={3}
                />
              </SettingRow>

              {/* Column Visibility Toggles */}
              <div className="pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Printed Invoice Elements & Table Columns
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 py-3 border-y border-[#DCE3EC] ">
                  <div className="col-span-1 sm:col-span-2">
                    <ToggleSwitch
                      checked={isTrue(settings.show_shop_details, true)}
                      onChange={v => setField('show_shop_details', String(v))}
                      label="Store Details Header"
                      description="Master switch: print business identity header on invoices & receipts."
                    />
                  </div>
                  <ToggleSwitch
                    checked={isTrue(settings.show_business_name, true)}
                    onChange={v => setField('show_business_name', String(v))}
                    disabled={!isTrue(settings.show_shop_details, true)}
                    label="Store Name on Bill"
                    description="Print company / store name in header."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_business_logo, true)}
                    onChange={v => setField('show_business_logo', String(v))}
                    disabled={!isTrue(settings.show_shop_details, true)}
                    label="Store Logo on Bill"
                    description="Print company logo graphic in header."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_business_address, true)}
                    onChange={v => setField('show_business_address', String(v))}
                    disabled={!isTrue(settings.show_shop_details, true)}
                    label="Store Address on Bill"
                    description="Print physical store address on invoices."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_business_phone, true)}
                    onChange={v => setField('show_business_phone', String(v))}
                    disabled={!isTrue(settings.show_shop_details, true)}
                    label="Store Phone & Email"
                    description="Print primary mobile number and support email."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_business_gstin, true)}
                    onChange={v => setField('show_business_gstin', String(v))}
                    disabled={!isTrue(settings.show_shop_details, true)}
                    label="Store GSTIN & PAN"
                    description="Print 15-digit GSTIN and PAN tax registrations."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_hsn_col, true)}
                    onChange={v => setField('show_hsn_col', String(v))}
                    label="HSN / SAC Column"
                    description="Print item tax classification code in product table."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_sku_col, false)}
                    onChange={v => setField('show_sku_col', String(v))}
                    label="SKU / Item Code"
                    description="Show product SKU code beside item name."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_unit_col, true)}
                    onChange={v => setField('show_unit_col', String(v))}
                    label="Unit of Measurement"
                    description="Display quantity unit (kg, pcs, L, pack)."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_discount_col, true)}
                    onChange={v => setField('show_discount_col', String(v))}
                    label="Item Discount Column"
                    description="Show discount percentage given per line item."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_tax_cols, true)}
                    onChange={v => setField('show_tax_cols', String(v))}
                    label="Tax Split Columns"
                    description="Show SGST / CGST rate and tax amount columns."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_bank_details, true)}
                    onChange={v => setField('show_bank_details', String(v))}
                    label="Bank Account Details"
                    description="Print bank account & IFSC code for wire transfer."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_signature_area, true)}
                    onChange={v => setField('show_signature_area', String(v))}
                    label="Cashier Signature Block"
                    description="Print authorized signatory box at bottom right."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.show_amount_in_words, true)}
                    onChange={v => setField('show_amount_in_words', String(v))}
                    label="Amount in Words"
                    description="Print written rupee words (e.g. Rupees One Thousand...)."
                  />
                  <ToggleSwitch
                    checked={isTrue(settings.enable_invoice_qr, true)}
                    onChange={v => setField('enable_invoice_qr', String(v))}
                    label="Digital Bill QR Code"
                    description="Print 'Scan to View Bill' QR for customer mobile phones."
                  />
                </div>
              </div>

              {/* Rich Real-Time Live Bill Preview & Simulator */}
              <div className="mt-8 rounded-xl border border-[#DCE3EC] bg-white overflow-hidden shadow-xs">
                {/* Header */}
                <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-[#DCE3EC] bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#1E3A5F] text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Eye size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Live Bill Preview
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Real-Time Updates
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Faithful preview updates instantly as you adjust store headers, toggles, taxes &amp; columns above.
                      </p>
                    </div>
                  </div>

                  {/* Format switcher tabs & actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-lg border border-[#DCE3EC] bg-white p-0.5 shadow-2xs overflow-x-auto max-w-full">
                      {[
                        { id: 'gst_a4', label: 'Vertical A4' },
                        { id: 'half_a4', label: 'Half-A4 (A5)' },
                        { id: 'stylish', label: 'Stylish A4' },
                        { id: 'thermal_80', label: '80mm Roll' },
                        { id: 'thermal_58', label: '58mm Roll' },
                      ].map(fmtTab => (
                        <button
                          key={fmtTab.id}
                          type="button"
                          onClick={() => setPreviewFormat(fmtTab.id)}
                          className={`px-2.5 py-1 text-[11px] font-semibold rounded whitespace-nowrap transition-all ${
                            previewFormat === fmtTab.id
                              ? 'bg-[#1E3A5F] text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          {fmtTab.label}
                        </button>
                      ))}
                    </div>

                    {/* Zoom controls */}
                    <div className="inline-flex items-center gap-1 border border-[#DCE3EC] rounded-lg bg-white px-2 py-1 shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(z => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
                        className="p-0.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100"
                        title="Zoom Out"
                      >
                        <ZoomOut size={13} />
                      </button>
                      <span className="text-[10px] font-mono font-semibold text-slate-700 min-w-9 text-center">
                        {Math.round(previewZoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(z => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))}
                        className="p-0.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100"
                        title="Zoom In"
                      >
                        <ZoomIn size={13} />
                      </button>
                      {previewZoom !== 1.0 && (
                        <button
                          type="button"
                          onClick={() => setPreviewZoom(1.0)}
                          className="p-0.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 text-[10px]"
                          title="Reset to 100%"
                        >
                          <RotateCcw size={11} />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setPreviewModalOpen(true)}
                      className="h-8 px-3 text-xs font-semibold rounded-lg border border-[#DCE3EC] bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                      title="Open Fullscreen Preview"
                    >
                      <Maximize2 size={13} />
                      <span className="hidden sm:inline">Fullscreen</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => printSelectedInvoice()}
                      className="h-8 px-3 text-xs font-semibold rounded-lg bg-[#0F766E] hover:bg-[#0d655e] text-white inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                      title="Print current preview format"
                    >
                      <Printer size={13} />
                      <span>Print</span>
                    </button>
                  </div>
                </div>

                {/* Active settings quick pill row */}
                <div className="px-4 py-2 border-b border-[#DCE3EC] bg-slate-50/40 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-slate-700">Active Format:</span>
                    <span className="px-2 py-0.5 rounded bg-slate-200/80 font-mono font-medium text-slate-800 uppercase">
                      {previewFormat}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span>
                      Store Header: <b className={isTrue(settings.show_shop_details, true) ? 'text-emerald-700' : 'text-rose-600'}>
                        {isTrue(settings.show_shop_details, true) ? 'Enabled' : 'Disabled'}
                      </b>
                    </span>
                    <span>
                      Logo: <b className={isTrue(settings.show_business_logo, true) && settings.shop_logo ? 'text-emerald-700' : 'text-slate-500'}>
                        {isTrue(settings.show_business_logo, true) && settings.shop_logo ? 'On' : 'Off'}
                      </b>
                    </span>
                    <span>
                      Tax Cols: <b className={isTrue(settings.show_tax_cols, true) ? 'text-emerald-700' : 'text-slate-500'}>
                        {isTrue(settings.show_tax_cols, true) ? 'Visible' : 'Hidden'}
                      </b>
                    </span>
                    <span>
                      HSN: <b className={isTrue(settings.show_hsn_col, true) ? 'text-emerald-700' : 'text-slate-500'}>
                        {isTrue(settings.show_hsn_col, true) ? 'Visible' : 'Hidden'}
                      </b>
                    </span>
                  </div>
                  <div className="text-[10.5px] text-slate-400">
                    * All changes above reflect immediately below
                  </div>
                </div>

                {/* Stage Body */}
                <div className="p-4 sm:p-6 md:p-8 bg-slate-100/90 overflow-x-auto flex justify-center items-start min-h-[480px]">
                  <div
                    className="bg-white text-slate-900 shadow-xl rounded-sm transition-transform origin-top overflow-hidden max-w-full"
                    style={{
                      transform: `scale(${previewZoom})`,
                      transformOrigin: 'top center',
                      marginBottom: previewZoom < 1 ? `-${Math.round((1 - previewZoom) * 400)}px` : undefined,
                    }}
                  >
                    <InvoiceDocument
                      invoice={sampleInvoice}
                      settings={settings}
                      mode={previewFormat}
                      showModePicker={false}
                    />
                  </div>
                </div>
              </div>

              <SectionFooterActions
                onSave={() => saveCurrentSettings('Updated billing and invoice rules')}
                onCancel={loadSettings}
                saving={saving}
                isDirty={isDirty}
              />
            </div>
          )}

          {/* ==========================================================
              SECTION 3: INVOICE TEMPLATES & PRINTING
          ========================================================== */}
          {activeSection === 'templates' && (
            <div className="space-y-6">
              <SectionHeading
                title="Invoice Templates & Printing"
              />

              {/* Template Catalog Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableTemplates.map(tpl => {
                  const activeMap = settings.active_templates || {}
                  const activeKey = tpl.type === 'a4' ? 'active_template_a4' : tpl.type === 'half_a4' ? 'active_template_half_a4' : 'active_template_thermal'
                  const isSelected = (activeMap[activeKey] || (tpl.type === 'half_a4' ? 'half_a4' : tpl.type.startsWith('thermal') ? 'thermal_80' : settings.invoice_template || 'gst_a4')) === tpl.id
                  const tplWidth = tpl.id === 'thermal_58' ? 216 : tpl.type.startsWith('thermal') ? 302 : tpl.type === 'half_a4' ? 560 : 794
                  const tplScale = tpl.id === 'thermal_58' ? 0.72 : tpl.type.startsWith('thermal') ? 0.62 : tpl.type === 'half_a4' ? 0.38 : 0.24
                  return (
                    <div
                      key={tpl.id}
                      className={`rounded border p-4 transition-all relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-600  bg-indigo-50/20  ring-1 ring-indigo-600'
                          : 'border-[#DCE3EC]  bg-white  hover:border-slate-400'
                      }`}
                    >
                      <div>
                        {/* Miniature rendered from the same invoice component used to print bills. */}
                        <div className="h-48 rounded bg-slate-100 border border-slate-200 flex justify-center items-start p-2 mb-3 relative overflow-hidden shadow-2xs">
                          {isSelected && (
                            <span className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white tracking-wide">
                              ACTIVE
                            </span>
                          )}
                          <div
                            className="settings-template-miniature"
                            style={{
                              '--preview-scale': tplScale,
                              '--miniature-width': `${tplWidth}px`,
                            }}
                          >
                            <InvoiceDocument invoice={sampleInvoice} settings={settings} mode={tpl.id} />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-1 mb-1">
                          <h4 className="text-xs font-bold text-slate-900 ">{tpl.name}</h4>
                          <span className="text-[10px] font-mono text-slate-500 ">{tpl.dimensions}</span>
                        </div>
                        <p className="text-[11px] text-slate-500  leading-relaxed mb-3">
                          {tpl.desc}
                        </p>
                      </div>

                      {/* Card Actions */}
                      <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#DCE3EC] ">
                        {isSelected ? (
                          <span className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded bg-indigo-50 px-3 text-xs font-bold text-indigo-700">
                            <Check size={14} /> Active Template
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectTemplate('default', tpl.id)}
                            className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded border border-teal-700 bg-teal-700 px-3 text-xs font-bold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                          >
                            <Check size={14} />
                            Set as Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewFormat(tpl.id)
                            setPreviewModalOpen(true)
                          }}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                          title="Preview Template"
                        >
                          <Eye size={15} />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomizingTemplateId(tpl.id)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                          title="Configure Template Settings"
                        >
                          <Sliders size={15} />
                          <span>Configure</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Hardware & Printer Driver Presets */}
              <div className="pt-4 border-t border-[#DCE3EC] ">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Printer Hardware & POS Counter Actions
                </h3>

                <SettingRow label="Hardware Printer Device" description="Printer type connected to this cashier terminal." id="printer_type">
                  <SelectInput
                    id="printer_type"
                    value={settings.printer_type || 'a4'}
                    onChange={v => setField('printer_type', v)}
                    options={[
                      ['a4', 'Standard Laser / Inkjet A4 Printer'],
                      ['half_a4', 'A5 / Half-A4 Printer'],
                      ['thermal_80', 'Thermal Receipt Printer (80mm / 3 inch)'],
                      ['thermal_58', 'Thermal Receipt Printer (58mm / 2 inch)'],
                    ]}
                  />
                </SettingRow>

                {/* Test Print Action */}
                <div className="pt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Prints the active template for the selected paper size.</span>
                  <button
                    type="button"
                    onClick={openTestPrint}
                    className="h-8 px-3 text-xs font-semibold rounded border border-[#DCE3EC]  bg-white  hover:bg-slate-50 text-slate-700  inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Printer size={13} />
                    <span>Test Print</span>
                  </button>
                </div>
              </div>

              <SectionFooterActions
                onSave={() => saveCurrentSettings('Updated template and printer configuration')}
                onCancel={loadSettings}
                saving={saving}
                isDirty={isDirty}
              />
            </div>
          )}

          {/* ==========================================================
              SECTION 4: TAX & GST SETTINGS
          ========================================================== */}
          {activeSection === 'tax' && (
            <div className="space-y-6">
              <SectionHeading
                title="Tax & GST Settings"
                description="Manage GST registration mode, state of supply, default tax rates, and statutory HSN summary tables."
              />

              <SettingRow label="GST Registration Type" required description="Determines whether bills are generated as Tax Invoice or Bill of Supply." id="gst_reg_type_tax">
                <SelectInput
                  id="gst_reg_type_tax"
                  value={settings.gst_reg_type || 'regular'}
                  onChange={v => setField('gst_reg_type', v)}
                  options={[
                    ['regular', 'Regular GST (Full Input Credit & Tax Invoices)'],
                    ['composition', 'Composition Scheme (Fixed turnover levy, no input tax)'],
                    ['unregistered', 'Unregistered (Exempt from GST filing)'],
                  ]}
                />
              </SettingRow>

              <SettingRow label="Store GSTIN" description="15-character statutory GST identification number." id="shop_gstin_tax">
                <TextInput
                  id="shop_gstin_tax"
                  value={settings.shop_gstin}
                  onChange={v => setField('shop_gstin', v.toUpperCase())}
                  placeholder="e.g. 33AABCS1429B1ZP"
                  maxLength={15}
                  mono
                />
              </SettingRow>

              <SettingRow label="Default Place of Supply" required description="Jurisdiction state code compared against customer state for IGST." id="place_of_supply">
                <SelectInput
                  id="place_of_supply"
                  value={settings.place_of_supply || settings.shop_state || 'Tamil Nadu (33)'}
                  onChange={v => {
                    setField('place_of_supply', v)
                    setField('shop_state', v)
                  }}
                  options={INDIAN_STATES.map(s => [`${s.name} (${s.code})`, `${s.name} (${s.code})`])}
                />
              </SettingRow>

              <SettingRow label="Pricing Tax Mode" description="Standard mode of retail item prices." id="tax_on_price_tax">
                <SelectInput
                  id="tax_on_price_tax"
                  value={settings.tax_on_price || 'exclusive'}
                  onChange={v => setField('tax_on_price', v)}
                  options={[
                    ['exclusive', 'Exclusive of GST (Base Price + GST calculated on top)'],
                    ['inclusive', 'Inclusive of GST (MRP includes tax; tax back-calculated)'],
                  ]}
                />
              </SettingRow>

              <SettingRow label="Default GST Rate" description="Fallback GST rate applied to unclassified goods." id="default_gst_rate">
                <SelectInput
                  id="default_gst_rate"
                  value={settings.default_gst_rate || '18'}
                  onChange={v => setField('default_gst_rate', v)}
                  options={[
                    ['0', '0% (Exempt Essentials)'],
                    ['5', '5% (Packaged Food & Commodities)'],
                    ['12', '12% (Standard Tier I)'],
                    ['18', '18% (Standard Tier II)'],
                    ['28', '28% (Luxury & Demerit Goods)'],
                  ]}
                />
              </SettingRow>

              <div className="space-y-3 py-3 border-y border-[#DCE3EC] ">
                <ToggleSwitch
                  checked={isTrue(settings.hsn_summary_on_invoice, true)}
                  onChange={v => setField('hsn_summary_on_invoice', String(v))}
                  label="Print Statutory HSN Tax Summary Table"
                  description="Prints summary block showing taxable value, CGST, SGST, and IGST by HSN code at bottom of invoice."
                />
                <ToggleSwitch
                  checked={isTrue(settings.reverse_charge, false)}
                  onChange={v => setField('reverse_charge', String(v))}
                  label="Reverse Charge Mechanism (RCM) Flag"
                  description="Enable RCM indicator on B2B invoices when recipient is liable to pay tax."
                />
              </div>

              <SectionFooterActions
                onSave={() => saveCurrentSettings('Updated tax and GST configuration')}
                onCancel={loadSettings}
                saving={saving}
                isDirty={isDirty}
              />
            </div>
          )}

          {/* ==========================================================
              SECTION 5: PAYMENT SETTINGS
          ========================================================== */}
          {activeSection === 'payments' && (
            <div className="space-y-6">
              <SectionHeading
                title="Payment & Bank Details"
                description="Manage merchant UPI, payment QR, gateway, and bank transfer details."
              />

              {/* Dynamic UPI Configuration */}
              <div className="pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Dynamic UPI QR Configuration
                </h3>

                <SettingRow label="UPI VPA / ID" required description="Virtual Payment Address receiving funds (e.g. store@sbi)." id="shop_upi_id">
                  <TextInput
                    id="shop_upi_id"
                    value={settings.shop_upi_id}
                    onChange={v => setField('shop_upi_id', v)}
                    placeholder="e.g. balajistore@sbi"
                  />
                </SettingRow>

                <SettingRow label="Payee Merchant Name" description="Name displayed on customer phone upon scanning QR." id="upi_merchant_name">
                  <TextInput
                    id="upi_merchant_name"
                    value={settings.upi_merchant_name}
                    onChange={v => setField('upi_merchant_name', v)}
                    placeholder="e.g. Sri Balaji Supermarket"
                  />
                </SettingRow>

                <div className="py-3 border-y border-[#DCE3EC] text-xs leading-relaxed text-slate-600">
                  The invoice QR is generated from this merchant UPI ID and the saved bill amount. To show or hide it for a specific paper format, use <strong className="text-slate-800">Configure</strong> on that invoice template.
                </div>
              </div>

<section className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_240px] gap-5 items-center rounded border border-slate-200  p-4 sm:p-5">
                <div>
                  <div className="flex items-center gap-3">
                    <img src={merchantStandIllustration} alt="QR stand layout" className="h-14 w-12 shrink-0" />
                    <h3 className="text-sm font-semibold text-slate-900 ">Merchant QR Stand</h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 ">Print a counter stand with your configured payment QR.</p>
                  {merchantQrValue ? (
                    <div className="mt-4 flex items-center gap-3">
                      <div id="merchant-qr-preview" className="shrink-0 rounded border border-slate-300 bg-white p-2">
                        <QRCodeSVG value={merchantQrValue} size={116} level="H" marginSize={2} />
                      </div>
                      <div className="min-w-0 text-xs text-slate-700 ">
                        {settings.shop_logo && <img src={settings.shop_logo} alt="Business logo" className="mb-2 h-8 max-w-24 object-contain" />}
                        <p className="font-semibold">{settings.upi_merchant_name || settings.shop_name || 'Merchant'}</p>
                        <p className="mt-1 break-all font-mono text-slate-600 ">{settings.shop_upi_id}</p>
                        <p className="mt-2 font-medium text-teal-700 ">Scan &amp; Pay</p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-600 ">Configure a merchant UPI ID to generate the payment QR.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 md:flex-col">
                  <button type="button" onClick={downloadMerchantQrStand} disabled={!merchantQrValue || downloadingQrPng} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
                    <Download size={16} /> {downloadingQrPng ? 'Preparing PNG…' : 'Download PNG'}
                  </button>
                  <button type="button" onClick={printMerchantQrStand} disabled={!merchantQrValue} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50     disabled:cursor-not-allowed disabled:opacity-50">
                    <Printer size={16} /> Print stand
                  </button>
                </div>
              </section>

              {/* Online Payment Gateway (Razorpay) */}
              <div className="pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Online Payment Gateway (Razorpay)
                </h3>

                <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-700 text-sm font-extrabold text-white">R</div>
                      <div className="min-w-0">
                        <p className="m-0 text-sm font-bold text-slate-900">Razorpay India</p>
                        <p className="m-0 mt-0.5 text-xs text-slate-600">Online payments for customer bills</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">Server managed</span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-violet-100 bg-white/80 p-3">
                      <p className="m-0 text-xs font-semibold text-slate-900">Payment methods</p>
                      <p className="mb-0 mt-1 text-[11px] leading-relaxed text-slate-600">Customers can use the methods enabled for your Razorpay account, such as UPI, cards, wallets, or net banking.</p>
                    </div>
                    <div className="rounded-xl border border-violet-100 bg-white/80 p-3">
                      <p className="m-0 text-xs font-semibold text-slate-900">Payment verification</p>
                      <p className="mb-0 mt-1 text-[11px] leading-relaxed text-slate-600">The server verifies payment details before a sale is marked paid. Secret keys stay on the server.</p>
                    </div>
                    <div className="rounded-xl border border-violet-100 bg-white/80 p-3">
                      <p className="m-0 text-xs font-semibold text-slate-900">If checkout is cancelled</p>
                      <p className="mb-0 mt-1 text-[11px] leading-relaxed text-slate-600">The sale is not completed, and items remain in the bill so you can retry or choose another payment method.</p>
                    </div>
                  </div>

                  <p className="mb-0 mt-3 border-t border-violet-100 pt-3 text-[11px] leading-relaxed text-slate-600">
                    Gateway credentials, webhook configuration, and account activation are managed by your server administrator. This page does not display or store secret API keys.
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* ==========================================================
              SECTION 6: BANK DETAILS
          ========================================================== */}
          {activeSection === 'payments' && (
            <div className="space-y-6">
              <SectionHeading
                title="Bank Account Details"
                description="Manage official bank account numbers and wire transfer information printed on invoices for B2B and institutional sales."
              />

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

              <SettingRow
                label="IFSC Code"
                description="11-character Indian Financial System Code."
                id="shop_bank_ifsc"
                error={
                  settings.shop_bank_ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(settings.shop_bank_ifsc.trim())
                    ? 'Invalid IFSC format (e.g. SBIN0001234)'
                    : null
                }
              >
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
                  placeholder="e.g. T. Nagar Branch, Chennai"
                />
              </SettingRow>

              <div className="py-3 border-y border-[#DCE3EC] ">
                <ToggleSwitch
                  checked={isTrue(settings.show_bank_details, true)}
                  onChange={v => setField('show_bank_details', String(v))}
                  label="Display Bank Account on Printed Invoices"
                  description="When enabled, account number and IFSC are neatly formatted in the invoice footer."
                />
              </div>

              {/* Live Preview of Bank Details Block */}
              <div className="p-4 rounded border border-[#DCE3EC]  bg-slate-50 ">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Invoice Print Preview â€” Bank Transfer Block
                </span>
                <div className="p-3 rounded bg-white  border border-slate-200  text-xs text-slate-800  font-mono space-y-1">
                  <div><span className="text-slate-500">Bank:</span> {settings.shop_bank_name || 'Not configured'}</div>
                  <div><span className="text-slate-500">A/C No:</span> {settings.shop_bank_account || 'Not configured'}</div>
                  <div><span className="text-slate-500">IFSC:</span> {settings.shop_bank_ifsc || 'Not configured'}</div>
                  <div><span className="text-slate-500">Branch:</span> {settings.shop_bank_branch || 'Not configured'}</div>
                </div>
              </div>

              <SectionFooterActions
                onSave={() => saveCurrentSettings('Updated bank details')}
                onCancel={loadSettings}
                saving={saving}
                isDirty={isDirty}
              />
            </div>
          )}

          {/* ==========================================================
              KEYBOARD SHORTCUTS
          ========================================================== */}
          {activeSection === 'keyboard' && (
            <div className="space-y-6">
              <SectionHeading title="Keyboard Shortcuts" description="Keyboard controls available on the New Bill screen." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  ['Ctrl + K / F3', 'Focus product search'],
                  ['↑ / ↓', 'Move through product search results'],
                  ['F2', 'Focus customer search'],
                  ['F4', 'Focus payment section'],
                  ['F6', 'Focus bill discount'],
                  ['F8 / Ctrl + Enter', 'Complete sale'],
                  ['Ctrl + P / F7', 'Print invoice'],
                  ['Ctrl + D / F5', 'Save draft'],
                  ['F1', 'Open New Bill'],
                  ['Esc', 'Close the active dropdown or dialog'],
                ].map(([shortcut, action]) => (
                  <div key={shortcut} className="flex items-center gap-3 rounded border border-[#DCE3EC] bg-slate-50 p-3">
                    <kbd className="min-w-28 rounded border border-slate-300 bg-white px-2 py-1 text-center font-mono text-xs font-semibold text-slate-800">{shortcut}</kbd>
                    <span className="text-xs text-slate-700">{action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ==============================================================
          3. LIVE INVOICE PREVIEW MODAL
      ============================================================== */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-5xl max-h-[94vh] bg-white rounded-lg border border-[#DCE3EC] shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-b border-[#DCE3EC] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50">
              <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={18} className="text-[#1E3A5F] shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      Live Bill Preview: {TEMPLATE_CATALOG.find(t => t.id === previewFormat)?.name || previewFormat.toUpperCase()}
                    </h3>
                    <p className="text-[10px] text-slate-500 truncate hidden xs:block">
                      Faithful black-and-white print preview with current store configuration.
                    </p>
                  </div>
                </div>
                {/* Mobile top-right close */}
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="sm:hidden h-8 w-8 rounded-md border border-[#DCE3EC] flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
                  aria-label="Close"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto justify-between sm:justify-end">
                {/* Format Switcher Tabs */}
                <div className="inline-flex rounded-md border border-[#DCE3EC] bg-white p-0.5 shadow-2xs overflow-x-auto max-w-full no-scrollbar">
                  {[
                    { id: 'gst_a4', label: 'A4 GST' },
                    { id: 'half_a4', label: 'Half-A4' },
                    { id: 'stylish', label: 'Stylish A4' },
                    { id: 'thermal_80', label: '80mm Roll' },
                    { id: 'thermal_58', label: '58mm Roll' },
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setPreviewFormat(t.id)}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded whitespace-nowrap transition-colors ${
                        previewFormat === t.id
                          ? 'bg-[#1E3A5F] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Zoom Controls */}
                  <div className="inline-flex items-center gap-1 border border-[#DCE3EC] rounded-md bg-white px-1.5 py-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(z => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
                      className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100"
                      title="Zoom Out"
                    >
                      <ZoomOut size={13} />
                    </button>
                    <span className="text-[10px] font-mono font-semibold text-slate-700 min-w-9 text-center">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(z => Math.min(1.8, Math.round((z + 0.1) * 10) / 10))}
                      className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100"
                      title="Zoom In"
                    >
                      <ZoomIn size={13} />
                    </button>
                    {previewZoom !== 1.0 && (
                      <button
                        type="button"
                        onClick={() => setPreviewZoom(1.0)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                        title="Reset 100%"
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </div>

                  {/* Print Button */}
                  <button
                    type="button"
                    onClick={() => printSelectedInvoice()}
                    className="h-8 px-3 text-xs font-semibold rounded-md bg-[#0F766E] hover:bg-[#0d655e] text-white inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <Printer size={13} />
                    <span className="hidden xs:inline">Print</span>
                  </button>

                  {/* Desktop Close Button */}
                  <button
                    type="button"
                    onClick={() => setPreviewModalOpen(false)}
                    className="hidden sm:flex h-8 w-8 rounded-md border border-[#DCE3EC] items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    aria-label="Close"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>
            </div>

            {/* Document Body */}
            <div className="flex-1 overflow-auto p-2 sm:p-6 md:p-8 bg-slate-100 flex justify-center items-start">
              <div
                className="settings-print-invoice-target bg-white text-black shadow-lg rounded-xs overflow-visible max-w-none origin-top transition-transform"
                style={{ transform: `scale(${previewZoom})` }}
              >
                <InvoiceDocument
                  invoice={sampleInvoice}
                  settings={settings} 
                  mode={previewFormat}
                  showModePicker={false}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==============================================================
          5. TEMPLATE CUSTOMIZER MODAL
      ============================================================== */}
      {customizingTemplateId && (
        <TemplateCustomizerModal
          isOpen={Boolean(customizingTemplateId)}
          onClose={() => setCustomizingTemplateId(null)}
          templateId={customizingTemplateId}
          templateMeta={TEMPLATE_CATALOG.find(t => t.id === customizingTemplateId)}
          globalSettings={settings}
          onSaved={savedCfg => {
            setSettings(prev => {
              const tplSettings = prev.template_settings || {}
              const updatedTemplateSettings = Array.isArray(tplSettings.templates)
                ? {
                    ...tplSettings,
                    templates: tplSettings.templates.map(template => (
                      template.id === savedCfg.template_id
                        ? { ...template, config: savedCfg }
                        : template
                    )),
                  }
                : {
                    ...tplSettings,
                    [savedCfg.template_id]: {
                      ...(tplSettings[savedCfg.template_id] || {}),
                      config: savedCfg,
                    },
                  }
              return {
                ...prev,
                template_settings: updatedTemplateSettings,
              }
            })
          }}
        />
      )}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => {
            document.querySelector('#root main')?.scrollTo({ top: 0, behavior: 'smooth' })
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          aria-label="Scroll to top"
          title="Scroll to top"
          className="fixed bottom-5 right-5 z-40 inline-flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 "
        >
          <ArrowUp size={19} />
        </button>
      )}
    </div>
  )
}
