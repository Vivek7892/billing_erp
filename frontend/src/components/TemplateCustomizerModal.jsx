import React, { useState, useEffect, useMemo } from 'react'
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
  Check,
  AlertCircle,
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

  // Load template config from backend
  useEffect(() => {
    if (!isOpen || !templateId) return
    setLoading(true)
    api
      .get(`/settings/templates/${templateId}/`)
      .then(res => {
        setConfig(res.data)
      })
      .catch(err => {
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
    } catch (err) {
      toast.error('Failed to reset template')
    } finally {
      setResetting(false)
    }
  }

  // Demo invoice for live preview
  const demoInvoice = useMemo(() => {
    const s = globalSettings || {}
    return {
      id: 'demo-01',
      invoice_number: `${s.invoice_prefix || 'INV-'}${s.invoice_start_number || '1001'}`,
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

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:hidden">
      <div className="relative w-full max-w-6xl max-h-[94vh] flex flex-col bg-white dark:bg-slate-900 border border-[#DCE3EC] dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden transition-colors">
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-[#DCE3EC] dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1E3A5F]/10 dark:bg-sky-500/10 text-[#1E3A5F] dark:text-sky-400 flex items-center justify-center font-bold">
              <Sliders size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Customize: {templateMeta?.name || templateId}
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {templateMeta?.size || 'Invoice Template'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Independent configuration for this template only. Other templates remain unchanged.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={resetting || loading}
              className="h-8 px-2.5 sm:px-3 rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Reset this template to factory defaults"
            >
              <RotateCcw size={13} className={resetting ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              className="h-8 px-3.5 sm:px-4 rounded-lg bg-[#1E3A5F] hover:bg-[#162C46] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
            >
              <Save size={13} />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Mobile Preview/Editor Switcher */}
        <div className="sm:hidden flex border-b border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <button
            type="button"
            onClick={() => setPreviewTab('editor')}
            className={`flex-1 py-2 text-xs font-bold text-center border-b-2 ${
              previewTab === 'editor'
                ? 'border-[#1E3A5F] dark:border-sky-400 text-[#1E3A5F] dark:text-sky-400'
                : 'border-transparent text-slate-500'
            }`}
          >
            Customizer Controls
          </button>
          <button
            type="button"
            onClick={() => setPreviewTab('preview')}
            className={`flex-1 py-2 text-xs font-bold text-center border-b-2 ${
              previewTab === 'preview'
                ? 'border-[#1E3A5F] dark:border-sky-400 text-[#1E3A5F] dark:text-sky-400'
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
          <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
            {/* Left Column: Form & Category Tabs */}
            <div
              className={`w-full sm:w-[50%] lg:w-[46%] flex flex-col border-r border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 min-h-0 ${
                previewTab === 'preview' ? 'hidden sm:flex' : 'flex'
              }`}
            >
              {/* Category Sub-tabs */}
              <div className="px-3 pt-2.5 pb-2 border-b border-[#DCE3EC] dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 overflow-x-auto shrink-0 flex gap-1.5 scrollbar-thin">
                {TABS.map(tab => {
                  const Icon = tab.icon
                  const isCur = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap inline-flex items-center gap-1.5 transition-all ${
                        isCur
                          ? 'bg-[#1E3A5F] text-white shadow-xs dark:bg-sky-600'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon size={12} />
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
                      <ToggleItem
                        label="Store Logo"
                        description="Display logo in header"
                        checked={biz.show_logo ?? true}
                        onChange={v => updateSection('business_info', 'show_logo', v)}
                      />
                      <ToggleItem
                        label="Store Address"
                        description="Print physical shop address"
                        checked={biz.show_address ?? true}
                        onChange={v => updateSection('business_info', 'show_address', v)}
                      />
                      <ToggleItem
                        label="Phone Number"
                        description="Print contact mobile/phone"
                        checked={biz.show_phone ?? true}
                        onChange={v => updateSection('business_info', 'show_phone', v)}
                      />
                      <ToggleItem
                        label="Email Address"
                        description="Print store support email"
                        checked={biz.show_email ?? true}
                        onChange={v => updateSection('business_info', 'show_email', v)}
                      />
                      <ToggleItem
                        label="Store GSTIN"
                        description="Print 15-digit GSTIN number"
                        checked={biz.show_gstin ?? true}
                        onChange={v => updateSection('business_info', 'show_gstin', v)}
                      />
                      <ToggleItem
                        label="Store PAN"
                        description="Print 10-digit PAN number"
                        checked={biz.show_pan ?? true}
                        onChange={v => updateSection('business_info', 'show_pan', v)}
                      />
                    </div>

                    <div className="space-y-3 pt-2 border-t border-[#DCE3EC] dark:border-slate-800">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Header Layout Style
                        </label>
                        <select
                          value={biz.header_layout || 'logo_left'}
                          onChange={e => updateSection('business_info', 'header_layout', e.target.value)}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 focus:ring-1 focus:ring-[#1E3A5F]"
                        >
                          <option value="logo_left">Logo on Left, Details on Right</option>
                          <option value="logo_right">Details on Left, Logo on Right</option>
                          <option value="logo_top">Centered Logo on Top</option>
                          <option value="name_only">Text Name Only (No Logo)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Store Name Override (Optional)
                        </label>
                        <input
                          type="text"
                          value={biz.store_name_override || ''}
                          onChange={e => updateSection('business_info', 'store_name_override', e.target.value)}
                          placeholder={globalSettings.shop_name || 'Leave blank to use global business name'}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 focus:ring-1 focus:ring-[#1E3A5F]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Address Override (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={biz.address_override || ''}
                          onChange={e => updateSection('business_info', 'address_override', e.target.value)}
                          placeholder="Leave blank to use global business address"
                          className="w-full text-xs rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2 focus:ring-1 focus:ring-[#1E3A5F]"
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

                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-2 border-t border-[#DCE3EC] dark:border-slate-800">
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

                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pt-2 border-t border-[#DCE3EC] dark:border-slate-800">
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
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Font Family
                        </label>
                        <select
                          value={lay.font_family || 'inter'}
                          onChange={e => updateSection('layout', 'font_family', e.target.value)}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2"
                        >
                          <option value="inter">Inter / Clean Sans (Recommended)</option>
                          <option value="roboto">Roboto (Formal ERP)</option>
                          <option value="courier">Courier (Monospace Receipt)</option>
                          <option value="times">Times New Roman (Classic Formal)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Font Size Scaling
                        </label>
                        <select
                          value={String(lay.font_size_scale || 1.0)}
                          onChange={e => updateSection('layout', 'font_size_scale', parseFloat(e.target.value))}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2"
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

                    <div className="pt-2 border-t border-[#DCE3EC] dark:border-slate-800">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                                ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] dark:bg-sky-600 dark:border-sky-600'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-[#DCE3EC] dark:border-slate-700'
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#DCE3EC] dark:border-slate-800">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
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
                              className="w-full text-xs rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-1.5 text-center mt-0.5"
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

                    <div className="space-y-3 pt-2 border-t border-[#DCE3EC] dark:border-slate-800">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Terms Override for this Template (Optional)
                        </label>
                        <textarea
                          rows={2}
                          value={pay.terms_override || ''}
                          onChange={e => updateSection('payment', 'terms_override', e.target.value)}
                          placeholder={globalSettings.invoice_terms || 'Leave blank to use global terms & conditions'}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Footer Greeting Override (Optional)
                        </label>
                        <input
                          type="text"
                          value={pay.footer_text_override || ''}
                          onChange={e => updateSection('payment', 'footer_text_override', e.target.value)}
                          placeholder={globalSettings.invoice_footer || 'THANK YOU FOR SHOPPING WITH US! VISIT AGAIN.'}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2"
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
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Paper Dimensions
                        </label>
                        <select
                          value={pg.page_size || 'a4'}
                          onChange={e => updateSection('page', 'page_size', e.target.value)}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2"
                        >
                          <option value="a4">A4 Full Sheet (210 × 297 mm)</option>
                          <option value="a5">A5 Half Sheet (148 × 210 mm)</option>
                          <option value="letter">US Letter (216 × 279 mm)</option>
                          <option value="thermal">Thermal POS Receipt Roll</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Orientation
                        </label>
                        <select
                          value={pg.orientation || 'portrait'}
                          onChange={e => updateSection('page', 'orientation', e.target.value)}
                          className="w-full text-xs rounded-lg border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-2"
                        >
                          <option value="portrait">Portrait (Vertical)</option>
                          <option value="landscape">Landscape (Horizontal)</option>
                        </select>
                      </div>
                    </div>

                    {templateId.startsWith('thermal') && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
                                  ? 'bg-[#1E3A5F] text-white border-[#1E3A5F] dark:bg-sky-600 dark:border-sky-600'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-[#DCE3EC] dark:border-slate-700'
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
              className={`w-full sm:w-[50%] lg:w-[54%] flex flex-col bg-slate-100/80 dark:bg-slate-950/70 min-h-0 ${
                previewTab === 'editor' ? 'hidden sm:flex' : 'flex'
              }`}
            >
              {/* Preview Header */}
              <div className="px-4 py-2.5 border-b border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Eye size={14} className="text-[#0F9D91]" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Live Bill Preview
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                    <Sparkles size={10} />
                    <span>Real-time</span>
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  {templateMeta?.size}
                </span>
              </div>

              {/* Preview Canvas with Scroll */}
              <div className="flex-1 overflow-y-auto p-3 sm:p-5 flex justify-center items-start">
                <div className="w-full flex justify-center scale-95 sm:scale-100 origin-top transition-transform">
                  <InvoiceDocument
                    invoice={demoInvoice}
                    settings={globalSettings}
                    templateConfig={config}
                    mode={templateId}
                    showModePicker={false}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ToggleItem({ label, description, checked, onChange }) {
  return (
    <label className="flex items-start gap-2.5 p-2 rounded-lg border border-[#DCE3EC]/70 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 rounded text-[#1E3A5F] focus:ring-[#1E3A5F] dark:bg-slate-900 dark:border-slate-700"
      />
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
          {label}
        </div>
        {description && (
          <div className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
            {description}
          </div>
        )}
      </div>
    </label>
  )
}

