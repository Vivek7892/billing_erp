import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  IconBuildingStore,
  IconReceipt,
  IconPackage,
  IconCircleCheck,
  IconArrowRight,
  IconArrowLeft,
  IconPrinter,
  IconSparkles,
  IconShoppingBag,
  IconCheck,
  IconPencil,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'
import http from '../../api'
import { useAuth } from '../../AuthContext'
import './Onboarding.css'

const BUSINESS_TYPES = [
  'Retail / Kirana',
  'Supermarket',
  'Wholesale',
  'Pharmacy',
  'Electronics',
  'Clothing & Apparel',
  'Restaurant / Cafe',
  'Hardware & Electricals',
  'Other',
]

const STEPS = [
  { id: 1, key: 'business', label: 'Business Profile', icon: IconBuildingStore },
  { id: 2, key: 'preferences', label: 'Tax & Invoicing', icon: IconReceipt },
  { id: 3, key: 'choices', label: 'Catalogue Setup', icon: IconPackage },
  { id: 4, key: 'review', label: 'Review & Launch', icon: IconCircleCheck },
]

export default function Onboarding() {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  // Form State
  const [businessData, setBusinessData] = useState({
    name: '',
    business_type: 'Retail / Kirana',
    owner_name: '',
    email: '',
    mobile: '',
    address: '',
    state: '',
    city: '',
    pincode: '',
  })

  const [preferencesData, setPreferencesData] = useState({
    gst_registered: false,
    gstin: '',
    tax_enabled: true,
    currency: '₹',
    invoice_prefix: 'INV',
    invoice_start_number: 1001,
    invoice_format: 'thermal-80mm',
  })

  const [firstProduct, setFirstProduct] = useState({
    add_product: false,
    name: '',
    selling_price: '',
    mrp: '',
    purchase_price: '',
    current_stock: '10',
    unit: 'pcs',
    category_name: '',
  })

  const [completed, setCompleted] = useState(false)

  // Fetch initial onboarding state from backend on mount
  useEffect(() => {
    let active = true

    http.get('/auth/onboarding-status/')
      .then(({ data }) => {
        if (!active) return

        if (data.onboarding_completed) {
          toast.success('Your store profile is already configured!')
          navigate('/', { replace: true })
          return
        }

        if (data.business) {
          const b = data.business
          setBusinessData({
            name: b.name || '',
            business_type: b.business_type || 'Retail / Kirana',
            owner_name: b.owner_name || '',
            email: b.email || '',
            mobile: b.mobile || '',
            address: b.address || '',
            state: b.state || '',
            city: b.city || '',
            pincode: b.pincode || '',
          })

          setPreferencesData({
            gst_registered: Boolean(b.gst_registered),
            gstin: b.gstin || '',
            tax_enabled: b.tax_enabled !== false,
            currency: b.currency || '₹',
            invoice_prefix: b.invoice_prefix || 'INV',
            invoice_start_number: b.invoice_start_number || 1001,
            invoice_format: b.invoice_format || 'thermal-80mm',
          })
        } else if (user) {
          setBusinessData(prev => ({
            ...prev,
            owner_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
            email: user.email || '',
            mobile: user.phone || '',
          }))
        }

        // Resume at persisted step
        if (data.current_step === 'preferences') setCurrentStep(2)
        else if (data.current_step === 'choices') setCurrentStep(3)
        else if (data.current_step === 'review') setCurrentStep(4)
        else setCurrentStep(1)
      })
      .catch(() => {
        // Fallback for new user
        if (user) {
          setBusinessData(prev => ({
            ...prev,
            owner_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
            email: user.email || '',
            mobile: user.phone || '',
          }))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user, navigate])

  // Handle URL sub-routes
  useEffect(() => {
    const path = location.pathname.toLowerCase()
    if (path.includes('/onboarding/business')) setCurrentStep(1)
    else if (path.includes('/onboarding/preferences')) setCurrentStep(2)
    else if (path.includes('/onboarding/complete')) setCompleted(true)
  }, [location.pathname])

  const updateBusiness = (field, val) => {
    setBusinessData(prev => ({ ...prev, [field]: val }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const updatePreferences = (field, val) => {
    setPreferencesData(prev => ({ ...prev, [field]: val }))
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }))
  }

  // STEP 1 VALIDATION & SAVE
  const handleSaveStep1 = async () => {
    const nextErrors = {}
    if (!businessData.name.trim()) nextErrors.name = 'Business or shop name is required'
    if (!businessData.business_type) nextErrors.business_type = 'Please select a business type'

    if (businessData.mobile.trim()) {
      const clean = businessData.mobile.replace(/\D/g, '')
      if (clean.length !== 10) nextErrors.mobile = 'Enter a valid 10-digit mobile number'
    }

    if (businessData.pincode.trim()) {
      const cleanPin = businessData.pincode.trim()
      if (cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
        nextErrors.pincode = 'PIN code must be 6 digits'
      }
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      toast.error('Please fill in required business details')
      return
    }

    setSaving(true)
    setErrors({})

    try {
      await http.patch('/auth/onboarding-progress/', {
        step: 'business',
        ...businessData,
      })
      toast.success('Business profile saved')
      setCurrentStep(2)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        setErrors(data)
      }
      toast.error('Failed to save business details')
    } finally {
      setSaving(false)
    }
  }

  // STEP 2 VALIDATION & SAVE
  const handleSaveStep2 = async () => {
    const nextErrors = {}
    if (preferencesData.gst_registered) {
      const cleanGst = preferencesData.gstin.trim().toUpperCase()
      if (!cleanGst) {
        nextErrors.gstin = 'GSTIN is required when registered for GST'
      } else if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleanGst)) {
        nextErrors.gstin = 'Enter a valid 15-character GSTIN format (e.g. 29ABCDE1234F1Z5)'
      }
    }

    if (!preferencesData.invoice_prefix.trim()) {
      nextErrors.invoice_prefix = 'Invoice prefix is required'
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    setErrors({})

    try {
      await http.patch('/auth/onboarding-progress/', {
        step: 'preferences',
        ...preferencesData,
        gstin: preferencesData.gstin.trim().toUpperCase(),
      })
      toast.success('Invoicing preferences saved')
      setCurrentStep(3)
    } catch (err) {
      const data = err.response?.data
      if (data && typeof data === 'object') {
        setErrors(data)
      }
      toast.error('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  // STEP 3 SAVE (CATALOGUE)
  const handleSaveStep3 = async () => {
    setSaving(true)
    setErrors({})

    try {
      const payload = { step: 'choices' }
      if (firstProduct.add_product && firstProduct.name.trim()) {
        payload.first_product = {
          name: firstProduct.name.trim(),
          selling_price: parseFloat(firstProduct.selling_price) || 0,
          mrp: parseFloat(firstProduct.mrp) || parseFloat(firstProduct.selling_price) || 0,
          purchase_price: parseFloat(firstProduct.purchase_price) || 0,
          unit: firstProduct.unit || 'pcs',
          current_stock: parseFloat(firstProduct.current_stock) || 0,
          category_name: firstProduct.category_name.trim(),
        }
      }

      await http.patch('/auth/onboarding-progress/', payload)
      setCurrentStep(4)
    } catch (err) {
      toast.error('Failed to save catalogue step')
    } finally {
      setSaving(false)
    }
  }

  // STEP 4 COMPLETE ONBOARDING
  const handleCompleteOnboarding = async () => {
    setSaving(true)
    try {
      const { data } = await http.post('/auth/onboarding/complete/')
      if (data.user) {
        updateUser(data.user)
      }
      setCompleted(true)
      toast.success('Congratulations! Your ERP setup is complete.')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to finalize onboarding.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="onboarding-shell flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#0057B8] border-t-transparent animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading store setup wizard...</p>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="onboarding-shell">
        <header className="onboarding-header">
          <div className="onboarding-brand">
            <img src="/logo.png" alt="Logo" />
            <div className="onboarding-brand-title">
              <strong>Dreamwithtech</strong>
              <small>POS &amp; RETAIL ERP</small>
            </div>
          </div>
        </header>

        <main className="onboarding-container">
          <div className="onboarding-card text-center flex flex-col items-center py-10 px-6 max-w-lg">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mb-4">
              <IconCircleCheck size={36} />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {businessData.name || 'Store'} is Ready!
            </h1>

            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-sm">
              Your business profile, tax configurations, and invoicing preferences have been successfully configured.
            </p>

            <div className="w-full mt-6 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-left text-xs space-y-2">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Shop Name:</span>
                <strong className="text-slate-900 dark:text-white">{businessData.name}</strong>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Type:</span>
                <strong className="text-slate-900 dark:text-white">{businessData.business_type}</strong>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Invoice Format:</span>
                <strong className="text-slate-900 dark:text-white capitalize">{preferencesData.invoice_format}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="onboarding-btn-primary w-full mt-6 !py-3 !text-sm"
            >
              <span>Go to Dashboard</span>
              <IconArrowRight size={16} />
            </button>
          </div>
        </main>
      </div>
    )
  }

  const progressPercent = ((currentStep - 1) / (STEPS.length - 1)) * 100

  return (
    <div className="onboarding-shell">
      {/* Top Header */}
      <header className="onboarding-header">
        <div className="onboarding-brand">
          <img src="/logo.png" alt="Logo" />
          <div className="onboarding-brand-title">
            <strong>Dreamwithtech</strong>
            <small>POS &amp; RETAIL ERP</small>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium hidden sm:block">
          Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].label}
        </div>
      </header>

      {/* Main Wizard Area */}
      <main className="onboarding-container">
        {/* Progress Stepper */}
        <nav aria-label="Onboarding Progress" className="onboarding-stepper">
          <div className="onboarding-stepper-line">
            <div className="onboarding-stepper-progress" style={{ width: `${progressPercent}%` }} />
          </div>

          {STEPS.map(step => {
            const isCompleted = currentStep > step.id
            const isActive = currentStep === step.id
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (step.id < currentStep) setCurrentStep(step.id)
                }}
                disabled={step.id > currentStep}
                className={`onboarding-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              >
                <div className="onboarding-step-circle">
                  {isCompleted ? <IconCheck size={18} strokeWidth={2.5} /> : step.id}
                </div>
                <span className="onboarding-step-label">{step.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Wizard Card Body */}
        <div className="onboarding-card">
          {/* STEP 1: BUSINESS PROFILE */}
          {currentStep === 1 && (
            <section aria-labelledby="step1-title">
              <div className="onboarding-title-area">
                <h2 id="step1-title">Tell us about your business</h2>
                <p>These details will appear on your customer bills and tax reports.</p>
              </div>

              <div className="onboarding-grid">
                {/* Business Name */}
                <div className="onboarding-field col-span-2">
                  <label htmlFor="shopName">Business or Shop Name *</label>
                  <input
                    id="shopName"
                    type="text"
                    value={businessData.name}
                    onChange={e => updateBusiness('name', e.target.value)}
                    placeholder="e.g. Krishna Super Market"
                    autoFocus
                  />
                  {errors.name && <p className="onboarding-field-error">{errors.name}</p>}
                </div>

                {/* Business Type */}
                <div className="onboarding-field">
                  <label htmlFor="businessType">Business Type *</label>
                  <select
                    id="businessType"
                    value={businessData.business_type}
                    onChange={e => updateBusiness('business_type', e.target.value)}
                  >
                    {BUSINESS_TYPES.map(type => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {errors.business_type && <p className="onboarding-field-error">{errors.business_type}</p>}
                </div>

                {/* Owner Name */}
                <div className="onboarding-field">
                  <label htmlFor="ownerName">Owner's Full Name</label>
                  <input
                    id="ownerName"
                    type="text"
                    value={businessData.owner_name}
                    onChange={e => updateBusiness('owner_name', e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                  />
                </div>

                {/* Business Email */}
                <div className="onboarding-field">
                  <label htmlFor="bizEmail">Business Email</label>
                  <input
                    id="bizEmail"
                    type="email"
                    value={businessData.email}
                    onChange={e => updateBusiness('email', e.target.value)}
                    placeholder="store@company.com"
                  />
                </div>

                {/* Business Mobile */}
                <div className="onboarding-field">
                  <label htmlFor="bizMobile">Business Mobile Number</label>
                  <input
                    id="bizMobile"
                    type="tel"
                    maxLength={10}
                    value={businessData.mobile}
                    onChange={e => updateBusiness('mobile', e.target.value.replace(/\D/g, ''))}
                    placeholder="98765 43210"
                  />
                  {errors.mobile && <p className="onboarding-field-error">{errors.mobile}</p>}
                </div>

                {/* Address */}
                <div className="onboarding-field col-span-2">
                  <label htmlFor="address">Shop / Business Address</label>
                  <textarea
                    id="address"
                    rows={2}
                    value={businessData.address}
                    onChange={e => updateBusiness('address', e.target.value)}
                    placeholder="Street, locality, landmark"
                  />
                </div>

                {/* City */}
                <div className="onboarding-field">
                  <label htmlFor="city">City</label>
                  <input
                    id="city"
                    type="text"
                    value={businessData.city}
                    onChange={e => updateBusiness('city', e.target.value)}
                    placeholder="e.g. Bengaluru"
                  />
                </div>

                {/* State */}
                <div className="onboarding-field">
                  <label htmlFor="state">State</label>
                  <input
                    id="state"
                    type="text"
                    value={businessData.state}
                    onChange={e => updateBusiness('state', e.target.value)}
                    placeholder="e.g. Karnataka"
                  />
                </div>

                {/* PIN Code */}
                <div className="onboarding-field">
                  <label htmlFor="pincode">PIN Code</label>
                  <input
                    id="pincode"
                    type="text"
                    maxLength={6}
                    value={businessData.pincode}
                    onChange={e => updateBusiness('pincode', e.target.value.replace(/\D/g, ''))}
                    placeholder="6-digit postal code"
                  />
                  {errors.pincode && <p className="onboarding-field-error">{errors.pincode}</p>}
                </div>
              </div>

              <div className="onboarding-footer">
                <div />
                <button
                  type="button"
                  onClick={handleSaveStep1}
                  disabled={saving}
                  className="onboarding-btn-primary"
                >
                  <span>{saving ? 'Saving...' : 'Save & Continue'}</span>
                  <IconArrowRight size={16} />
                </button>
              </div>
            </section>
          )}

          {/* STEP 2: TAX & INVOICING PREFERENCES */}
          {currentStep === 2 && (
            <section aria-labelledby="step2-title">
              <div className="onboarding-title-area">
                <h2 id="step2-title">Tax and invoice preferences</h2>
                <p>Configure GST taxation, invoice formats, and numbering rules.</p>
              </div>

              <div className="flex flex-col gap-5">
                {/* GST Registered Toggle */}
                <div className="onboarding-toggle-row">
                  <div>
                    <strong className="block text-sm font-bold text-slate-900 dark:text-white">
                      Are you registered for GST?
                    </strong>
                    <span className="text-xs text-slate-500">
                      Enable if your business possesses a 15-character GST identification number.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferencesData.gst_registered}
                      onChange={e => updatePreferences('gst_registered', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0057B8]" />
                  </label>
                </div>

                {/* GSTIN Input (shown if registered) */}
                {preferencesData.gst_registered && (
                  <div className="onboarding-field">
                    <label htmlFor="gstin">GSTIN (Goods and Services Tax ID) *</label>
                    <input
                      id="gstin"
                      type="text"
                      maxLength={15}
                      value={preferencesData.gstin}
                      onChange={e => updatePreferences('gstin', e.target.value.toUpperCase())}
                      placeholder="e.g. 29ABCDE1234F1Z5"
                      className="uppercase font-mono font-semibold"
                    />
                    {errors.gstin && <p className="onboarding-field-error">{errors.gstin}</p>}
                  </div>
                )}

                {/* Tax Enabled Toggle */}
                <div className="onboarding-toggle-row">
                  <div>
                    <strong className="block text-sm font-bold text-slate-900 dark:text-white">
                      Enable Tax on Invoices
                    </strong>
                    <span className="text-xs text-slate-500">
                      Compute and print CGST/SGST breakdowns on customer receipts.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferencesData.tax_enabled}
                      onChange={e => updatePreferences('tax_enabled', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0057B8]" />
                  </label>
                </div>

                {/* Preferred Format Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Preferred Receipt &amp; Invoice Format
                  </label>
                  <div className="onboarding-format-grid">
                    <div
                      onClick={() => updatePreferences('invoice_format', 'thermal-80mm')}
                      className={`onboarding-format-card ${
                        preferencesData.invoice_format === 'thermal-80mm' ? 'selected' : ''
                      }`}
                    >
                      <IconPrinter size={24} className="text-[#0057B8]" />
                      <div className="onboarding-format-title">Thermal 80 mm (3")</div>
                      <div className="onboarding-format-desc">Standard POS roll printers. Ideal for retail counters.</div>
                    </div>

                    <div
                      onClick={() => updatePreferences('invoice_format', 'thermal-58mm')}
                      className={`onboarding-format-card ${
                        preferencesData.invoice_format === 'thermal-58mm' ? 'selected' : ''
                      }`}
                    >
                      <IconPrinter size={24} className="text-sky-600" />
                      <div className="onboarding-format-title">Thermal 58 mm (2")</div>
                      <div className="onboarding-format-desc">Compact handheld and Bluetooth receipt printers.</div>
                    </div>

                    <div
                      onClick={() => updatePreferences('invoice_format', 'A4')}
                      className={`onboarding-format-card ${
                        preferencesData.invoice_format === 'A4' ? 'selected' : ''
                      }`}
                    >
                      <IconReceipt size={24} className="text-indigo-600" />
                      <div className="onboarding-format-title">Standard A4 Sheet</div>
                      <div className="onboarding-format-desc">Full-page desktop laser/inkjet billing with itemized tables.</div>
                    </div>
                  </div>
                </div>

                {/* Prefix and Starting Number */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="onboarding-field">
                    <label htmlFor="invoicePrefix">Invoice Prefix</label>
                    <input
                      id="invoicePrefix"
                      type="text"
                      maxLength={10}
                      value={preferencesData.invoice_prefix}
                      onChange={e => updatePreferences('invoice_prefix', e.target.value.toUpperCase())}
                      placeholder="e.g. INV"
                      className="font-mono font-semibold"
                    />
                    {errors.invoice_prefix && <p className="onboarding-field-error">{errors.invoice_prefix}</p>}
                  </div>

                  <div className="onboarding-field">
                    <label htmlFor="startNum">Starting Bill Number</label>
                    <input
                      id="startNum"
                      type="number"
                      min={1}
                      value={preferencesData.invoice_start_number}
                      onChange={e => updatePreferences('invoice_start_number', parseInt(e.target.value) || 1)}
                      placeholder="1001"
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="onboarding-footer">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="onboarding-btn-secondary"
                >
                  <IconArrowLeft size={16} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveStep2}
                  disabled={saving}
                  className="onboarding-btn-primary"
                >
                  <span>{saving ? 'Saving...' : 'Save & Continue'}</span>
                  <IconArrowRight size={16} />
                </button>
              </div>
            </section>
          )}

          {/* STEP 3: CATALOGUE & INVENTORY CHOICES */}
          {currentStep === 3 && (
            <section aria-labelledby="step3-title">
              <div className="onboarding-title-area">
                <h2 id="step3-title">Catalogue and inventory setup</h2>
                <p>Optionally add your first product now, or start with an empty catalogue and add products later.</p>
              </div>

              <div className="flex flex-col gap-5">
                {/* Quick Add Product Card */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="p-2 rounded-lg bg-[#0057B8]/10 text-[#0057B8]">
                        <IconPackage size={20} />
                      </span>
                      <div>
                        <strong className="block text-sm font-bold text-slate-900 dark:text-white">
                          Add your first product (Optional)
                        </strong>
                        <span className="text-xs text-slate-500">
                          Create one initial item to test barcode scanning and counter checkout.
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={firstProduct.add_product}
                        onChange={e => setFirstProduct(prev => ({ ...prev, add_product: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0057B8]" />
                    </label>
                  </div>

                  {firstProduct.add_product && (
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="onboarding-field sm:col-span-2">
                        <label>Product Name *</label>
                        <input
                          type="text"
                          value={firstProduct.name}
                          onChange={e => setFirstProduct(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Basmati Rice 5kg"
                        />
                      </div>

                      <div className="onboarding-field">
                        <label>Selling Price (₹) *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={firstProduct.selling_price}
                          onChange={e => setFirstProduct(prev => ({ ...prev, selling_price: e.target.value }))}
                          placeholder="450.00"
                        />
                      </div>

                      <div className="onboarding-field">
                        <label>MRP (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={firstProduct.mrp}
                          onChange={e => setFirstProduct(prev => ({ ...prev, mrp: e.target.value }))}
                          placeholder="499.00"
                        />
                      </div>

                      <div className="onboarding-field">
                        <label>Purchase Price (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={firstProduct.purchase_price}
                          onChange={e => setFirstProduct(prev => ({ ...prev, purchase_price: e.target.value }))}
                          placeholder="380.00"
                        />
                      </div>

                      <div className="onboarding-field">
                        <label>Initial Opening Stock</label>
                        <input
                          type="number"
                          value={firstProduct.current_stock}
                          onChange={e => setFirstProduct(prev => ({ ...prev, current_stock: e.target.value }))}
                          placeholder="10"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Empty catalogue guarantee note */}
                <div className="p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500 flex items-start gap-2">
                  <IconSparkles size={16} className="text-[#0057B8] shrink-0 mt-0.5" />
                  <span>
                    You can easily bulk import products from Excel/CSV anytime from the Products screen after completing setup.
                  </span>
                </div>
              </div>

              <div className="onboarding-footer">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="onboarding-btn-secondary"
                >
                  <IconArrowLeft size={16} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveStep3}
                  disabled={saving}
                  className="onboarding-btn-primary"
                >
                  <span>{saving ? 'Saving...' : 'Continue to Review'}</span>
                  <IconArrowRight size={16} />
                </button>
              </div>
            </section>
          )}

          {/* STEP 4: REVIEW & CONFIRM */}
          {currentStep === 4 && (
            <section aria-labelledby="step4-title">
              <div className="onboarding-title-area">
                <h2 id="step4-title">Review and launch your store</h2>
                <p>Verify your details before launching your live business workspace.</p>
              </div>

              {/* Review Card 1: Business Profile */}
              <div className="onboarding-review-card">
                <div className="onboarding-review-header">
                  <div className="onboarding-review-title">
                    <IconBuildingStore size={16} className="text-[#0057B8]" />
                    <span>Business Profile</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="onboarding-review-edit"
                  >
                    Edit
                  </button>
                </div>
                <dl className="onboarding-review-grid">
                  <div className="onboarding-review-item">
                    <dt>Shop Name</dt>
                    <dd>{businessData.name || '—'}</dd>
                  </div>
                  <div className="onboarding-review-item">
                    <dt>Business Type</dt>
                    <dd>{businessData.business_type || '—'}</dd>
                  </div>
                  <div className="onboarding-review-item">
                    <dt>Owner Name</dt>
                    <dd>{businessData.owner_name || '—'}</dd>
                  </div>
                  <div className="onboarding-review-item">
                    <dt>Contact Mobile</dt>
                    <dd>{businessData.mobile || '—'}</dd>
                  </div>
                  <div className="onboarding-review-item col-span-2">
                    <dt>Location</dt>
                    <dd>
                      {[businessData.address, businessData.city, businessData.state, businessData.pincode]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Review Card 2: Invoicing & Tax */}
              <div className="onboarding-review-card">
                <div className="onboarding-review-header">
                  <div className="onboarding-review-title">
                    <IconReceipt size={16} className="text-[#0057B8]" />
                    <span>Tax &amp; Invoicing</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="onboarding-review-edit"
                  >
                    Edit
                  </button>
                </div>
                <dl className="onboarding-review-grid">
                  <div className="onboarding-review-item">
                    <dt>GST Registered</dt>
                    <dd>{preferencesData.gst_registered ? `Yes (${preferencesData.gstin})` : 'No'}</dd>
                  </div>
                  <div className="onboarding-review-item">
                    <dt>Tax Computations</dt>
                    <dd>{preferencesData.tax_enabled ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                  <div className="onboarding-review-item">
                    <dt>Receipt Format</dt>
                    <dd className="capitalize">{preferencesData.invoice_format}</dd>
                  </div>
                  <div className="onboarding-review-item">
                    <dt>Invoice Prefix / Starting No.</dt>
                    <dd>{preferencesData.invoice_prefix} - {preferencesData.invoice_start_number}</dd>
                  </div>
                </dl>
              </div>

              {/* Review Card 3: Catalogue */}
              <div className="onboarding-review-card">
                <div className="onboarding-review-header">
                  <div className="onboarding-review-title">
                    <IconPackage size={16} className="text-[#0057B8]" />
                    <span>Catalogue Setup</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="onboarding-review-edit"
                  >
                    Edit
                  </button>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {firstProduct.add_product && firstProduct.name ? (
                    <div>
                      Initial test item configured:{' '}
                      <strong className="font-semibold">{firstProduct.name}</strong> (₹{firstProduct.selling_price || 0})
                    </div>
                  ) : (
                    <div>Starting with clean catalogue. Products will be added via POS or CSV import.</div>
                  )}
                </div>
              </div>

              <div className="onboarding-footer">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="onboarding-btn-secondary"
                >
                  <IconArrowLeft size={16} />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleCompleteOnboarding}
                  disabled={saving}
                  className="onboarding-btn-primary !px-6"
                >
                  <IconSparkles size={16} />
                  <span>{saving ? 'Launching...' : 'Complete Setup & Launch ERP'}</span>
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

