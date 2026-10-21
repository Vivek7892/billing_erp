import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  X,
  RotateCcw,
  Save,
  Building2,
  Sliders,
  Type,
  Percent,
  CreditCard,
  Printer,
  Eye,
  Sparkles,
} from 'lucide-react'
import api from '../api'
import InvoiceDocument from './InvoiceDocument'
import { toast } from 'react-hot-toast'

const TABS = [
  { id: 'business', label: 'Business Info', icon: Building2 },
  { id: 'fields', label: 'Invoice Fields', icon: Sliders },
  { id: 'layout', label: 'Layout & Typography', icon: Type },
  { id: 'tax', label: 'Tax & Totals', icon: Percent },
  { id: 'payment', label: 'Payment & Footer', icon: CreditCard },
  { id: 'page', label: 'Page & Printing', icon: Printer },
]

export default function TemplateCustomizerModal({
  isOpen,
  onClose,
  templateId,
  templateMeta,
  globalSettings = {},
  onSaved,
}) {
  const [activeTab, setActiveTab] = useState('business')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [config, setConfig] = useState(null)
  const [previewTab, setPreviewTab] = useState('editor') // for mobile tab toggle: 'editor' | 'preview'
  const [previewScale, setPreviewScale] = useState(1)
  const [manualScale, setManualScale] = useState(null)
  const previewPaneRef = useRef(null)

  const isThermalTpl = templateId?.startsWith('thermal')
  const is58mmRoll = (config?.page?.thermal_roll_width === '58mm' || config?.page?.thermal_roll_width === '58') || (templateId === 'thermal_58' && config?.page?.thermal_roll_width !== '80mm')
  const computedBaseWidth = isThermalTpl ? (is58mmRoll ? 216 : 300) : templateId === 'half_a4' ? 560 : 794

  useEffect(() => {
    const pane = previewPaneRef.current
    if (!pane) return undefined
    const updateScale = () => {
      if (manualScale !== null) return
      const availableWidth = Math.max(0, pane.clientWidth - 24)
      if (availableWidth <= 0) return
      const fit = availableWidth / computedBaseWidth
      setPreviewScale(fit >= 1 ? 1 : Math.max(0.3, Number(fit.toFixed(2))))
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(pane)
    return () => observer.disconnect()
  }, [templateId, isOpen, loading, manualScale, computedBaseWidth])

  const effectiveScale = manualScale !== null ? manualScale : previewScale

  // Load template config from backend
  useEffect(() => {
    if (!isOpen || !templateId) return
    setLoading(true)
    api
      .get(`/settings/templates/${templateId}/`)
      .then(res => {
        setConfig(res.data)
      })
      .catch(() => {
        toast.error('Failed to load template settings')
        // Fallback to meta config if available
        if (templateMeta?.config) {
          setConfig(JSON.parse(JSON.stringify(templateMeta.config)))
        }
      })
      .finally(() => setLoading(false))
  }, [isOpen, templateId, templateMeta])

  // Helpers to update nested config state
  const updateSection = (section, key, value) => {
    setConfig(prev => {
      if (!prev) return prev
      return {
        ...prev,
        [section]: {
          ...(prev[section] || {}),
          [key]: value,
        },
      }
    })
  }

  // Save changes to backend
  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      const res = await api.post(`/settings/templates/${templateId}/`, config)
      toast.success(`${templateMeta?.name || 'Template'} settings saved!`)
      onSaved?.(res.data)
      onClose?.()
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save template configuration'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Reset to factory defaults
  const handleReset = async () => {
    if (!window.confirm(`Reset "${templateMeta?.name || 'this template'}" to factory default settings?`)) {
      return
    }
    setResetting(true)
    try {
      const res = await api.post(`/settings/templates/${templateId}/reset/`)
      setConfig(res.data)
      toast.success('Template reset to factory defaults')
      onSaved?.(res.data)
    } catch {
      toast.error('Failed to reset template')
    } finally {
      setResetting(false)
    }
  }

  // Demo invoice for live preview
  const demoInvoice = useMemo(() => {
    const s = globalSettings || {}
    const prefix = (s.invoice_prefix || 'INV').trim()
    const nextNumber = s.invoice_start_number || '1001'
    return {
      id: 'demo-01',
      invoice_number: `${prefix}${/[-/_]$/.test(prefix) ? '' : '-'}${String(nextNumber).padStart(4, '0')}`,
      created_at: new Date().toISOString(),
      due_date: new Date(Date.now() + 15 * 86400000).toISOString(),
      payment_method: s.default_payment_method || 'CASH',
      payment_status: 'PAID',
      customer_name: 'Anand Kumar (Walk-in Customer)',
      customer_phone: '+91 98765 43210',
      customer_address: '124, Gandhi Bazaar Main Road, Bangalore 560004',
      customer_gstin: '29ABCDE1234F1Z5',
      place_of_supply: s.place_of_supply || s.shop_state || 'Karnataka (29)',
      notes: 'Thank you for your business. Keep this bill for warranty.',
      terms: s.invoice_terms || '1. Goods once sold will not be taken back without original bill.\n2. Warranty handled directly by authorized manufacturer.',
      short_url: 'https://demo.billing/b/demo-01',
      public_token: 'demo-token-12345',
      subtotal: 1045.0,
      discount_amount: 52.25,
      tax_amount: 59.57,
      cess_amount: 0,
      round_off: -0.32,
      grand_total: 1052.0,
      paid_amount: 1052.0,
      balance_due: 0.0,
      items: [
        {
          product_name: 'India Gate Basmati Rice 5kg',
          sku: 'RICE-001',
          hsn_code: '100630',
          unit: 'bag',
          quantity: 1,
          unit_price: 520.0,
          discount_percent: 5,
          gst_percent: 5,
          gst_amount: 24.7,
          total: 518.7,
        },
        {
          product_name: 'Fortune Sunflower Oil 1L Pouch',
          sku: 'OIL-002',
          hsn_code: '151219',
          unit: 'ltr',
          quantity: 2,
          unit_price: 145.0,
          discount_percent: 0,
          gst_percent: 5,
          gst_amount: 14.5,
          total: 304.5,
        },
        {
          product_name: 'Tata Salt Iodized 1kg',
          sku: 'SALT-001',
          hsn_code: '250100',
          unit: 'pkt',
          quantity: 2,
          unit_price: 28.0,
          discount_percent: 0,
          gst_percent: 0,
          gst_amount: 0.0,
          total: 56.0,
        },
        {
          product_name: 'Aashirvaad Shudh Chakki Atta 5kg',
          sku: 'ATTA-005',
          hsn_code: '110100',
          unit: 'bag',
          quantity: 1,
          unit_price: 235.0,
          discount_percent: 5,
          gst_percent: 5,
          gst_amount: 11.16,
          total: 234.41,
        },
      ],
    }
  }, [globalSettings])

  if (!isOpen) return null

  const biz = config?.business_info || {}
  const flds = config?.fields || {}
  const lay = config?.layout || {}
  const tx = config?.tax || {}
  const pay = config?.payment || {}
  const pg = config?.page || {}
  const baseWidth = computedBaseWidth
  const baseHeight = isThermalTpl ? 'auto' : templateId === 'half_a4' ? 792 : 1123
  const targetPreviewMode = isThermalTpl ? (is58mmRoll ? 'thermal_58' : 'thermal_80') : templateId

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:hidden">
      <div className="relative h-[calc(100dvh-1rem)] max-h-[96dvh] w-full max-w-[96vw] flex flex-col bg-white border border-[#DCE3EC] rounded-xl shadow-2xl overflow-hidden transition-colors lg:h-[94dvh]">
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-[#DCE3EC]  flex items-center justify-between bg-slate-50  shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1E3A5F]/10  text-[#1E3A5F]  flex items-center justify-center font-bold">
              <Sliders size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 ">
                  Customize: {templateMeta?.name || templateId}
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
                  {templateMeta?.paper || templateMeta?.size || templateMeta?.dimensions || 'Invoice Template'}
                </span>
              </div>
              <p className="text-xs text-slate-500 ">
                {templateId === 'gst_a4'
                  ? 'Full GST invoice layout, tax fields, payment details, and A4 printing.'
                  : templateId === 'stylish'
                    ? 'Modern corporate GST layout with its own typography, colors, and A4 print settings.'
                    : 'Configure this invoice layout and its print settings.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting || loading}
              className="min-h-11 px-2.5 sm:px-3 rounded-lg border border-[#DCE3EC] bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Reset this template to factory defaults"
            >
              <RotateCcw size={13} className={resetting ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="min-h-11 px-3.5 sm:px-4 rounded-lg bg-[#1E3A5F] hover:bg-[#162C46] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
            >
              <Save size={13} />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-11 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 flex items-center justify-center transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Mobile Preview/Editor Switcher */}
        <div className="lg:hidden flex border-b border-[#DCE3EC] bg-white shrink-0">
          <button
            type="button"
            onClick={() => setPreviewTab('editor')}
            className={`min-h-11 flex-1 py-2 text-xs font-bold text-center border-b-2 ${
              previewTab === 'editor'
                ? 'border-[#1E3A5F]  text-[#1E3A5F] '
                : 'border-transparent text-slate-500'
            }`}
          >
            Customizer Controls
          </button>
          <button
            type="button"
            onClick={() => setPreviewTab('preview')}
            className={`min-h-11 flex-1 py-2 text-xs font-bold text-center border-b-2 ${
              previewTab === 'preview'
                ? 'border-[#1E3A5F]  text-[#1E3A5F] '
                : 'border-transparent text-slate-500'
            }`}
          >
            Live Preview
          </button>
        </div>

        {/* Modal Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20 text-slate-500">
            <div className="animate-spin mr-2">
              <RotateCcw size={18} />
            </div>
            <span>Loading template configuration...</span>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Column: Form & Category Tabs */}
            <div
              className={`w-full lg:w-[42%] flex flex-col border-r border-[#DCE3EC] bg-white min-h-0 ${
                previewTab === 'preview' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Category Sub-tabs */}
              <div className="px-3 pt-2.5 pb-2 border-b border-[#DCE3EC] bg-slate-50/70 overflow-x-auto shrink-0 flex gap-1.5 scrollbar-thin">
                {TABS.map(tab => {
                  const Icon = tab.icon
                  const isCur = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`min-h-10 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap inline-flex items-center gap-2 transition-all ${
                        isCur
                          ? 'bg-[#1E3A5F] text-white shadow-xs '
                          : 'text-slate-600  hover:bg-slate-200/70 '
                      }`}
                    >
                      <Icon size={14} />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Form Controls for Selected Tab */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* 1. Business Info Tab */}
                {activeTab === 'business' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Business Identity &amp; Header
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="col-span-1 sm:col-span-2">
                        <ToggleItem
                          label="Store Details Header"
                          description="Master switch: Print store identity and header on this template"
                          checked={biz.show_shop_details ?? true}
                          onChange={v => updateSection('business_info', 'show_shop_details', v)}
                        />
                      </div>
                      <ToggleItem
                        label="Store Name"
                        description="Print business / shop name in header"
                        checked={biz.show_name ?? true}
                        onChange={v => updateSection('business_info', 'show_name', v)}
                        disabled={biz.show_shop_details === false}
                      />
                      <ToggleItem
                        label="Store Logo"
                        description="Display logo in header"
                        checked={biz.show_logo ?? true}
                        onChange={v => updateSection('business_info', 'show_logo', v)}
                        disabled={biz.show_shop_details === false}
                      />
                      <ToggleItem
                        label="Store Address"
                        description="Print physical shop address"
                        checked={biz.show_address ?? true}
                        onChange={v => updateSection('business_info', 'show_address', v)}
                        disabled={biz.show_shop_details === false}
                      />
                      <ToggleItem
                        label="Phone Number"
                        description="Print contact mobile/phone"
                        checked={biz.show_phone ?? true}
                        onChange={v => updateSection('business_info', 'show_phone', v)}
                        disabled={biz.show_shop_details === false}
                      />
                      <ToggleItem
                        label="Email Address"
                        description="Print store support email"
                        checked={biz.show_email ?? true}
                        onChange={v => updateSection('business_info', 'show_email', v)}
                        disabled={biz.show_shop_details === false}
                      />
                      <ToggleItem
                        label="Store GSTIN"
                        description="Print 15-digit GSTIN number"
                        checked={biz.show_gstin ?? true}
                        onChange={v => updateSection('business_info', 'show_gstin', v)}
                        disabled={biz.show_shop_details === false}
                      />
                      <ToggleItem
                        label="Store PAN"
                        description="Print 10-digit PAN number"
                        checked={biz.show_pan ?? true}
                        onChange={v => updateSection('business_info', 'show_pan', v)}
                        disabled={biz.show_shop_details === false}
                      />
                    </div>

                    <div className="space-y-3 pt-2 border-t border-[#DCE3EC] ">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700  mb-1">
                          Header Layout Style
                        </label>
                        <select
                          value={biz.header_layout || 'logo_left'}
                          onChange={e => updateSection('business_info', 'header_layout', e.target.value)}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC]  bg-white  text-slate-900  p-2 focus:ring-1 focus:ring-[#1E3A5F]"
                        >
                          <option value="logo_left">Logo on Left, Details on Right</option>
                          <option value="logo_right">Details on Left, Logo on Right</option>
                          <option value="logo_top">Centered Logo on Top</option>
                          <option value="name_only">Text Name Only (No Logo)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700  mb-1">
                          Store Name Override (Optional)
                        </label>
                        <input
                          type="text"
                          value={biz.store_name_override || ''}
                          onChange={e => updateSection('business_info', 'store_name_override', e.target.value)}
                          placeholder={globalSettings.shop_name || 'Leave blank to use global business name'}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC]  bg-white  text-slate-900  p-2 focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700  mb-1">
                          Address Override (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={biz.address_override || ''}
                          onChange={e => updateSection('business_info', 'address_override', e.target.value)}
                          placeholder="Leave blank to use global business address"
                          className="w-full text-xs rounded-lg border border-[#DCE3EC]  bg-white  text-slate-900  p-2 focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Invoice Fields Tab */}
                {activeTab === 'fields' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Customer Details Section
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <ToggleItem
                        label="Customer Name"
                        checked={flds.show_customer_name ?? true}
                        onChange={v => updateSection('fields', 'show_customer_name', v)}
                      />
                      <ToggleItem
                        label="Customer Phone"
                        checked={flds.show_customer_phone ?? true}
                        onChange={v => updateSection('fields', 'show_customer_phone', v)}
                      />
                      <ToggleItem
                        label="Customer Address"
                        checked={flds.show_customer_address ?? true}
                        onChange={v => updateSection('fields', 'show_customer_address', v)}
                      />
                      <ToggleItem
                        label="Customer GSTIN"
                        checked={flds.show_customer_gstin ?? true}
                        onChange={v => updateSection('fields', 'show_customer_gstin', v)}
                      />
                    </div>

                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-2 border-t border-[#DCE3EC] ">
                      Product Items Table Columns
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <ToggleItem
                        label="HSN / SAC Code"
                        checked={flds.show_hsn ?? true}
                        onChange={v => updateSection('fields', 'show_hsn', v)}
                      />
                      <ToggleItem
                        label="SKU / Item Code"
                        checked={flds.show_sku ?? false}
                        onChange={v => updateSection('fields', 'show_sku', v)}
                      />
                      <ToggleItem
                        label="Unit of Measure"
                        checked={flds.show_unit ?? false}
                        onChange={v => updateSection('fields', 'show_unit', v)}
                      />
                      <ToggleItem
                        label="Item Rate / Price"
                        checked={flds.show_rate ?? true}
                        onChange={v => updateSection('fields', 'show_rate', v)}
                      />
                      <ToggleItem
                        label="Item Discount (%)"
                        checked={flds.show_discount ?? true}
                        onChange={v => updateSection('fields', 'show_discount', v)}
                      />
                      <ToggleItem
                        label="Tax Breakup (GST)"
                        checked={flds.show_tax_breakup ?? true}
                        onChange={v => updateSection('fields', 'show_tax_breakup', v)}
                      />
                      <ToggleItem
                        label="Batch Number"
                        checked={flds.show_batch ?? false}
                        onChange={v => updateSection('fields', 'show_batch', v)}
                      />
                      <ToggleItem
                        label="Expiry Date"
                        checked={flds.show_expiry ?? false}
                        onChange={v => updateSection('fields', 'show_expiry', v)}
                      />
                    </div>

                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-2 border-t border-[#DCE3EC] ">
                      Additional Metadata
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <ToggleItem
                        label="Payment Mode"
                        checked={flds.show_payment_mode ?? true}
                        onChange={v => updateSection('fields', 'show_payment_mode', v)}
                      />
                      <ToggleItem
                        label="Place of Supply"
                        checked={flds.show_place_of_supply ?? true}
                        onChange={v => updateSection('fields', 'show_place_of_supply', v)}
                      />
                      <ToggleItem
                        label="Invoice Notes"
                        checked={flds.show_notes ?? true}
                        onChange={v => updateSection('fields', 'show_notes', v)}
                      />
                    </div>
                  </div>
                )}

                {/* 3. Layout & Typography Tab */}
                {activeTab === 'layout' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Typography &amp; Spacing
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700  mb-1">
                          Font Family
                        </label>
                        <select
                          value={lay.font_family || 'inter'}
                          onChange={e => updateSection('layout', 'font_family', e.target.value)}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC]  bg-white  text-slate-900  p-2"
                        >
                          <option value="inter">Inter / Clean Sans (Recommended)</option>
                          <option value="roboto">Roboto (Formal ERP)</option>
                          <option value="courier">Courier (Monospace Receipt)</option>
                          <option value="times">Times New Roman (Classic Formal)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700  mb-1">
                          Font Size Scaling
                        </label>
                        <select
                          value={String(lay.font_size_scale || 1.0)}
                          onChange={e => updateSection('layout', 'font_size_scale', parseFloat(e.target.value))}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC]  bg-white  text-slate-900  p-2"
                        >
                          <option value="0.9">Compact (0.9x)</option>
                          <option value="1.0">Standard Regular (1.0x)</option>
                          <option value="1.1">Slightly Large (1.1x)</option>
                          <option value="1.2">High Legibility (1.2x)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      <ToggleItem
                        label="Compact Mode"
                        description="Tighter table row padding to fit more items per page"
                        checked={lay.compact_mode ?? (templateId === 'half_a4' || templateId.startsWith('thermal'))}
                        onChange={v => updateSection('layout', 'compact_mode', v)}
                      />
                      <ToggleItem
                        label="Section Separators"
                        description="Subtle dividing lines between bill blocks"
                        checked={lay.show_separator_lines ?? true}
                        onChange={v => updateSection('layout', 'show_separator_lines', v)}
                      />
                    </div>

                    <div className="pt-2 border-t border-[#DCE3EC] ">
                      <label className="block text-xs font-semibold text-slate-700  mb-1">
                        Header Alignment
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {['left', 'center', 'right'].map(align => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => updateSection('layout', 'header_alignment', align)}
                            className={`py-1.5 text-xs font-semibold rounded-lg border capitalize transition-colors ${
                              (lay.header_alignment || 'left') === align
                                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]  '
                                : 'bg-white  text-slate-700  border-[#DCE3EC] '
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#DCE3EC] ">
                      <div className="text-xs font-semibold text-slate-700  mb-2">
                        Page Margins (mm)
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {['top', 'bottom', 'left', 'right'].map(side => (
                          <div key={side}>
                            <span className="text-[10px] uppercase font-bold text-slate-400">{side}</span>
                            <input
                              type="number"
                              min="0"
                              max="30"
                              value={lay[`margin_${side}_mm`] ?? 8}
                              onChange={e => updateSection('layout', `margin_${side}_mm`, parseInt(e.target.value) || 0)}
                              className="w-full text-xs rounded-lg border border-[#DCE3EC]  bg-white  text-slate-900  p-1.5 text-center mt-0.5"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Tax & Totals Tab */}
                {activeTab === 'tax' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tax &amp; Accounting Totals Breakdown
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <ToggleItem
                        label="Subtotal Amount"
                        description="Gross item total before discounts & taxes"
                        checked={tx.show_subtotal ?? true}
                        onChange={v => updateSection('tax', 'show_subtotal', v)}
                      />
                      <ToggleItem
                        label="Discount Total"
                        description="Total promotional discount applied"
                        checked={tx.show_discount_total ?? true}
                        onChange={v => updateSection('tax', 'show_discount_total', v)}
                      />
                      <ToggleItem
                        label="GST Summary Breakdown"
                        description="Detailed tax breakup (CGST / SGST / IGST)"
                        checked={tx.show_tax_summary ?? true}
                        onChange={v => updateSection('tax', 'show_tax_summary', v)}
                      />
                      <ToggleItem
                        label="Round Off Line"
                        description="Rounding adjustment amount"
                        checked={tx.show_round_off ?? true}
                        onChange={v => updateSection('tax', 'show_round_off', v)}
                      />
                      <ToggleItem
                        label="Amount in Words"
                        description="Rupees in Indian numbering words"
                        checked={tx.show_amount_in_words ?? true}
                        onChange={v => updateSection('tax', 'show_amount_in_words', v)}
                      />
                    </div>
                  </div>
                )}

                {/* 5. Payment & Footer Tab */}
                {activeTab === 'payment' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Payment Settlement &amp; QR
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <ToggleItem
                        label="UPI Payment QR"
                        description="Scan-to-pay QR code for instant UPI payment"
                        checked={pay.show_upi_qr ?? true}
                        onChange={v => updateSection('payment', 'show_upi_qr', v)}
                      />
                      <ToggleItem
                        label="Bank Account Details"
                        description="Bank name, A/C number, IFSC code"
                        checked={pay.show_bank_details ?? true}
                        onChange={v => updateSection('payment', 'show_bank_details', v)}
                      />
                      <ToggleItem
                        label="Payment Summary"
                        description="Paid amount, payment mode, change"
                        checked={pay.show_payment_summary ?? true}
                        onChange={v => updateSection('payment', 'show_payment_summary', v)}
                      />
                      <ToggleItem
                        label="Balance Due"
                        description="Highlight unpaid balance due"
                        checked={pay.show_balance_due ?? true}
                        onChange={v => updateSection('payment', 'show_balance_due', v)}
                      />
                      <ToggleItem
                        label="Digital Bill QR Code"
                        description="'Scan to View Bill' customer mobile link"
                        checked={pay.show_digital_bill_qr ?? true}
                        onChange={v => updateSection('payment', 'show_digital_bill_qr', v)}
                      />
                      <ToggleItem
                        label="Authorised Signature"
                        description="Signatory stamp/signature placeholder"
                        checked={pay.show_signature ?? false}
                        onChange={v => updateSection('payment', 'show_signature', v)}
                      />
                      <ToggleItem
                        label="Show Footer Greeting"
                        description="Thank you message at the bottom"
                        checked={pay.show_footer ?? true}
                        onChange={v => updateSection('payment', 'show_footer', v)}
                      />
                      <ToggleItem
                        label="Terms & Conditions"
                        description="Store return & warranty policies"
                        checked={pay.show_terms ?? true}
                        onChange={v => updateSection('payment', 'show_terms', v)}
                      />
                    </div>

                    <div className="space-y-3 pt-2 border-t border-[#DCE3EC] ">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700  mb-1">
                          Terms Override for this Template (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={pay.terms_override || ''}
                          onChange={e => updateSection('payment', 'terms_override', e.target.value)}
                          placeholder={globalSettings.invoice_terms || 'Leave blank to use global terms & conditions'}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC]  bg-white  text-slate-900  p-2"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700  mb-1">
                          Footer Greeting Override (Optional)
                        </label>
                        <input
                          type="text"
                          value={pay.footer_text_override || ''}
                          onChange={e => updateSection('payment', 'footer_text_override', e.target.value)}
                          placeholder={globalSettings.invoice_footer || 'THANK YOU FOR SHOPPING WITH US! VISIT AGAIN.'}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC]  bg-white  text-slate-900  p-2"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Page & Printing Tab */}
                {activeTab === 'page' && (
                  <div className="space-y-4">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Page Size &amp; Printer Layout
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700  mb-1">
                          Paper Dimensions
                        </label>
                        <select
                          value={pg.page_size || 'a4'}
                          onChange={e => updateSection('page', 'page_size', e.target.value)}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC]  bg-white  text-slate-900  p-2"
                        >
                          <option value="a4">A4 Full Sheet (210 × 297 mm)</option>
                          <option value="a5">A5 Half Sheet (148 × 210 mm)</option>
                          <option value="letter">US Letter (216 × 279 mm)</option>
                          <option value="thermal">Thermal POS Receipt Roll</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700  mb-1">
                          Orientation
                        </label>
                        <select
                          value={pg.orientation || 'portrait'}
                          onChange={e => updateSection('page', 'orientation', e.target.value)}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC]  bg-white  text-slate-900  p-2"
                        >
                          <option value="portrait">Portrait (Vertical)</option>
                          <option value="landscape">Landscape (Horizontal)</option>
                        </select>
                      </div>
                    </div>

                    {templateId.startsWith('thermal') && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700  mb-1">
                          Thermal POS Roll Width
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {['80mm', '58mm'].map(w => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => updateSection('page', 'thermal_roll_width', w)}
                              className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                                (pg.thermal_roll_width || (templateId === 'thermal_58' ? '58mm' : '80mm')) === w
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F]  '
                                  : 'bg-white  text-slate-700  border-[#DCE3EC] '
                              }`}
                            >
                              {w} Roll Width
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <ToggleItem
                        label="Fit to Single Page"
                        description="Scale row heights and padding automatically to prevent multi-page spill"
                        checked={pg.fit_one_page ?? true}
                        onChange={v => updateSection('page', 'fit_one_page', v)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Real-time Live Bill Preview */}
            <div
              ref={previewPaneRef}
              className={`w-full lg:w-[58%] flex flex-col bg-[var(--surface-subtle)] border-l border-[var(--line)] min-h-0 ${
                previewTab === 'editor' ? 'hidden lg:flex' : 'flex'
              }`}
            >
              {/* Preview Header */}
              <div className="px-4 py-2 border-b border-[var(--line)] bg-[var(--surface)] flex items-center justify-between shrink-0 gap-2">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-[var(--accent)]" />
                  <span className="text-xs font-bold text-[var(--ink)]">
                    Live Bill Preview
                  </span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    <Sparkles size={10} />
                    <span>Real-time</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Zoom controls */}
                  <div className="flex items-center border border-[var(--line)] rounded-md bg-[var(--surface-subtle)] p-0.5 text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setManualScale(null)}
                      className={`px-2 py-0.5 rounded transition ${
                        manualScale === null
                          ? 'bg-[var(--primary)] text-white shadow-2xs'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                      title="Fit to width"
                    >
                      Fit
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualScale(0.75)}
                      className={`px-2 py-0.5 rounded transition ${
                        manualScale === 0.75
                          ? 'bg-[var(--primary)] text-white shadow-2xs'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                      title="75% zoom"
                    >
                      75%
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualScale(1)}
                      className={`px-2 py-0.5 rounded transition ${
                        manualScale === 1
                          ? 'bg-[var(--primary)] text-white shadow-2xs'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                      title="100% actual print size"
                    >
                      100%
                    </button>
                  </div>

                  <span className="text-[11px] font-mono text-[var(--muted)] hidden sm:inline">
                    {templateMeta?.paper || templateMeta?.size || templateMeta?.dimensions}
                  </span>
                </div>
              </div>

              {/* Preview Canvas with Scroll */}
              <div className="flex-1 min-h-0 overflow-auto p-2 sm:p-5 flex justify-center items-start bg-[var(--surface-subtle)]">
                <div
                  style={{
                    width: Math.round(baseWidth * effectiveScale),
                    height: isThermalTpl ? 'auto' : Math.round(baseHeight * effectiveScale),
                    overflow: 'visible',
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    className="origin-top transition-transform duration-150 flex justify-center shadow-md border border-slate-300 rounded-sm bg-white text-black shrink-0"
                    style={{
                      width: baseWidth,
                      height: isThermalTpl ? 'auto' : baseHeight,
                      transform: `scale(${effectiveScale})`,
                      transformOrigin: 'top center',
                    }}
                  >
                    <InvoiceDocument invoice={demoInvoice} settings={{ ...globalSettings, shop_upi_id: globalSettings?.shop_upi_id || 'merchant@upi', upi_merchant_name: globalSettings?.upi_merchant_name || globalSettings?.shop_name || 'My Store' }} templateConfig={config} mode={targetPreviewMode} showModePicker={false} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Sticky Bottom Action Bar */}
        <div className="lg:hidden shrink-0 border-t border-[#DCE3EC] bg-white p-2.5 flex items-center gap-2 z-10 shadow-md">
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting || loading}
            className="min-h-11 px-3 flex-1 rounded-lg border border-[#DCE3EC] bg-white text-slate-700 hover:bg-slate-100 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RotateCcw size={14} className={resetting ? 'animate-spin' : ''} />
            <span>Reset Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="min-h-11 px-4 flex-1 rounded-lg bg-[#1E3A5F] hover:bg-[#162C46] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function ToggleItem({ label, description, checked, onChange, disabled = false }) {
  return (
    <label className={`flex items-start gap-2.5 p-2 rounded-lg border border-[#DCE3EC]/70 transition-colors select-none ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50 cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={e => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 rounded text-[#1E3A5F] focus:ring-[#1E3A5F]"
      />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-800  leading-tight">
          {label}
        </div>
        {description && (
          <div className="text-[10.5px] text-slate-500  leading-tight mt-0.5">
            {description}
          </div>
        )}
      </div>
    </label>
  )
}

