import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { Card, PageHeader, Spinner } from '../components/UI'
import toast from 'react-hot-toast'
import {
  Building2,
  FileText,
  Percent,
  CreditCard,
  Printer,
  Upload,
  CheckCircle2,
  Trash2,
  ImageIcon,
  Eye,
  Sliders,
  Save,
  Check,
  Download,
  QrCode,
} from 'lucide-react'
import InvoiceDocument, { isTrue } from '../components/InvoiceDocument'
import { QRCodeSVG } from 'qrcode.react'
import logoImg from '../assets/logo.png'
import {
  UpiBrandStrip,
  generatePrintStandHtml,
  getUpiBrandRibbonSvg,
  loadUpiBrandLogos,
  drawTabletopStandeeCanvas,
} from '../components/UpiLogos'

function FormField({ label, children, full, hint }) {
  return (
    <div className={`${full ? 'sm:col-span-2' : ''} min-w-0`}>
      <label className="block mb-1.5 text-xs font-semibold tracking-wide text-[var(--ink-secondary)]">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[11px] leading-4 text-[var(--muted-light)]">
          {hint}
        </p>
      )}
    </div>
  )
}

function Inp({
  value,
  onChange,
  mono,
  maxLength,
  type = 'text',
  placeholder,
}) {
  return (
    <input
      type={type}
      className={`input w-full h-11 text-xs sm:text-sm font-medium ${mono ? 'font-mono' : ''}`}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      maxLength={maxLength}
      placeholder={placeholder}
    />
  )
}

function Sel({ value, onChange, options }) {
  return (
    <select
      className="input w-full h-11 text-xs sm:text-sm font-medium"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )
}

function Txt({ value, onChange, rows = 3, placeholder }) {
  return (
    <textarea
      className="input w-full text-xs sm:text-sm leading-5 p-3 resize-y font-medium"
      rows={rows}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

const INDIAN_STATES = [
  'Tamil Nadu (33)',
  'Karnataka (29)',
  'Kerala (32)',
  'Andhra Pradesh (37)',
  'Telangana (36)',
  'Maharashtra (27)',
  'Delhi (07)',
  'Gujarat (24)',
  'Uttar Pradesh (09)',
  'West Bengal (19)',
  'Rajasthan (08)',
  'Madhya Pradesh (23)',
  'Bihar (10)',
  'Punjab (03)',
  'Haryana (06)',
  'Odisha (21)',
  'Jharkhand (20)',
  'Assam (18)',
  'Chhattisgarh (22)',
  'Uttarakhand (05)',
  'Himachal Pradesh (02)',
  'Goa (30)',
  'Jammu & Kashmir (01)',
  'Puducherry (34)',
  'Chandigarh (04)',
  'Tripura (16)',
  'Manipur (14)',
  'Meghalaya (17)',
  'Nagaland (13)',
  'Mizoram (15)',
  'Sikkim (11)',
  'Arunachal Pradesh (12)',
  'Ladakh (38)',
  'Dadra & Nagar Haveli and Daman & Diu (26)',
  'Andaman & Nicobar Islands (35)',
  'Lakshadweep (31)',
  'Other Territory (97)',
]

function StateInput({ value, onChange, placeholder = 'Tamil Nadu (33)' }) {
  return (
    <>
      <input
        type="text"
        list="indian-states-settings-list"
        className="input w-full h-11 text-xs sm:text-sm font-medium"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <datalist id="indian-states-settings-list">
        {INDIAN_STATES.map(st => (
          <option key={st} value={st} />
        ))}
      </datalist>
    </>
  )
}

// Formal clean checkbox row (replaces oversized weird toggle cards)
function FieldCheckbox({ checked, onChange, label, description }) {
  return (
    <label className="flex items-start gap-3 p-2.5 rounded-md border border-[var(--line-subtle)] bg-[var(--surface)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer group">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 rounded border-[var(--line)] text-[#1E3A5F] focus:ring-[#1E3A5F] accent-[#1E3A5F] cursor-pointer shrink-0"
      />
      <div className="min-w-0">
        <span className="block text-xs font-semibold text-[var(--ink)] group-hover:text-[#1E3A5F] transition-colors">
          {label}
        </span>
        {description && (
          <span className="block text-[11px] text-[var(--muted-light)] mt-0.5 leading-normal">
            {description}
          </span>
        )}
      </div>
    </label>
  )
}

function SectionCard({ title, description, children, action }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-none">
      <div className="border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 sm:px-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--ink)]">{title}</h3>
          {description && (
            <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
              {description}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="grid gap-3.5 p-4 sm:grid-cols-2 sm:p-5">{children}</div>
    </div>
  )
}

const TABS = [
  { id: 'business', label: 'Business Profile', icon: Building2 },
  { id: 'invoice', label: 'Invoicing & Print', icon: FileText },
  { id: 'fields', label: 'Bill Fields & Columns', icon: Sliders },
  { id: 'gst', label: 'GST & Accounting', icon: Percent },
  { id: 'payment', label: 'Banking & UPI QR', icon: CreditCard },
  { id: 'printer', label: 'Printer Setup', icon: Printer },
  { id: 'preview', label: 'Live Bill Preview', icon: Eye },
]

function StoreQrStandSettingsCard({ s }) {
  const [standMode, setStandMode] = useState('any')
  const [standAmount, setStandAmount] = useState('')
  const [standDownloading, setStandDownloading] = useState(false)
  const [logoDataUrl, setLogoDataUrl] = useState('')
  const standQrRef = useRef(null)

  useEffect(() => {
    const targetLogo = s.shop_logo || logoImg || '/logo.png'
    if (!targetLogo) return

    if (typeof targetLogo === 'string' && targetLogo.startsWith('data:')) {
      setLogoDataUrl(targetLogo)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || 80
        canvas.height = img.naturalHeight || 80
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        setLogoDataUrl(canvas.toDataURL('image/png'))
      } catch {
        setLogoDataUrl(targetLogo)
      }
    }
    img.onerror = () => setLogoDataUrl(targetLogo)
    img.src = targetLogo
  }, [s.shop_logo])

  const upiId = s.shop_upi_id || ''
  const merchantName = s.upi_merchant_name || s.shop_name || 'Sri Balaji Store'
  const isFixed = standMode === 'fixed' && Number(standAmount) > 0
  const numAmt = isFixed ? Number(standAmount) : 0

  const upiUri = (() => {
    const params = new URLSearchParams()
    if (upiId) params.set('pa', upiId)
    if (merchantName) params.set('pn', merchantName)
    if (numAmt > 0) {
      params.set('am', numAmt.toFixed(2))
    }
    params.set('cu', 'INR')
    params.set('tn', isFixed ? `Pay to ${merchantName}` : 'Store Counter Payment')
    return `upi://pay?${params.toString()}`
  })()

  const downloadQrStandPng = async () => {
    if (!upiId) {
      toast.error('Please configure your Shop UPI ID in the section above first')
      return
    }

    const svg = standQrRef.current?.querySelector('svg')
    if (!svg) {
      toast.error('QR code not available')
      return
    }

    setStandDownloading(true)
    try {
      // 1. High-resolution cloned SVG
      const svgClone = svg.cloneNode(true)
      svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
      svgClone.setAttribute('width', '500')
      svgClone.setAttribute('height', '500')

      const svgData = new XMLSerializer().serializeToString(svgClone)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)

      const qrImg = new Image()
      qrImg.crossOrigin = 'anonymous'

      await new Promise((resolve, reject) => {
        qrImg.onload = resolve
        qrImg.onerror = reject
        qrImg.src = svgUrl
      })

      // 2. Load official brand logos (Google Pay, PhonePe, Paytm, UPI)
      const brandLogos = await loadUpiBrandLogos()

      // 3. Optional store logo image
      let storeLogoImg = null
      if (logoDataUrl) {
        storeLogoImg = new Image()
        storeLogoImg.crossOrigin = 'anonymous'
        await new Promise((resolve) => {
          storeLogoImg.onload = resolve
          storeLogoImg.onerror = resolve
          storeLogoImg.src = logoDataUrl
        })
      }

      // 4. Draw exact rendered preview onto canvas (preserving dimensions, colors, logo, and layout)
      const canvas = document.createElement('canvas')
      drawTabletopStandeeCanvas({
        canvas,
        merchantName,
        upiId,
        isFixed,
        numAmt,
        qrImg,
        brandLogos,
        storeLogoImg,
        footerText: 'Accepted Here: GPay • PhonePe • Paytm • UPI',
      })

      brandLogos.cleanup()
      URL.revokeObjectURL(svgUrl)

      const safeName = merchantName.replace(/[^a-zA-Z0-9_-]/g, '_')
      const filename = isFixed
        ? `UPI-QR-Stand-${safeName}-${numAmt}.png`
        : `UPI-QR-Stand-${safeName}.png`

      canvas.toBlob(blob => {
        if (!blob) {
          toast.error('Could not generate PNG image')
          setStandDownloading(false)
          return
        }
        const pngUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = pngUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(pngUrl), 1000)
        setStandDownloading(false)
        toast.success(`Downloaded ${filename}`)
      }, 'image/png')
    } catch (err) {
      console.error('Download QR Stand PNG error:', err)
      setStandDownloading(false)
      toast.error('Could not download QR stand as PNG')
    }
  }

  const printQrStand = () => {
    if (!upiId) {
      toast.error('Please configure your Shop UPI ID in the section above first')
      return
    }

    const svg = standQrRef.current?.querySelector('svg')
    if (!svg) {
      toast.error('QR code not available')
      return
    }

    const svgClone = svg.cloneNode(true)
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    svgClone.setAttribute('width', '240')
    svgClone.setAttribute('height', '240')
    svgClone.setAttribute('viewBox', svg.getAttribute('viewBox') || '0 0 240 240')
    const svgMarkup = new XMLSerializer().serializeToString(svgClone)

    const win = window.open('', '_blank', 'width=480,height=760')
    if (!win) {
      toast.error('Allow pop-ups to print the QR stand')
      return
    }

    const standHtml = generatePrintStandHtml({
      shopName: merchantName,
      upiId,
      invoice: isFixed ? `STAND-${numAmt}` : 'STORE-COUNTER',
      amount: numAmt,
      logoDataUrl,
      svgMarkup,
    })

    win.document.open()
    win.document.write(standHtml)
    win.document.close()

    const triggerPrint = () => {
      try {
        win.focus()
        win.print()
      } catch {
        toast.error('Could not open print dialog')
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
    <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-none">
      <div className="border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-3 sm:px-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--ink)]">Store Counter QR Standee (Download &amp; Print)</h3>
          <p className="mt-0.5 text-[11px] leading-4 text-[var(--muted)]">
            Generate and download a high-resolution, branded tabletop QR stand for your checkout counter. Accepts Google Pay, PhonePe, Paytm, and any UPI app.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5 grid gap-6 md:grid-cols-[1fr_320px]">
        {/* Left Column: Configuration Controls */}
        <div className="space-y-4">
          <div>
            <label className="block mb-1.5 text-xs font-semibold tracking-wide text-[var(--ink-secondary)]">
              Stand QR Amount Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setStandMode('any')}
                className={`px-3.5 py-3 rounded-xl border text-xs font-bold text-left transition-all ${
                  standMode === 'any'
                    ? 'border-[#1E3A5F] bg-blue-50/90 text-[#1E3A5F] dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300 ring-2 ring-[#1E3A5F]/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Any Amount (Open QR)</span>
                  {standMode === 'any' && <Check size={14} className="text-[#1E3A5F] dark:text-blue-400" />}
                </div>
                <p className="mt-1 text-[11px] font-normal text-slate-500 dark:text-slate-400">
                  Customer enters any amount on their phone
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStandMode('fixed')}
                className={`px-3.5 py-3 rounded-xl border text-xs font-bold text-left transition-all ${
                  standMode === 'fixed'
                    ? 'border-[#1E3A5F] bg-blue-50/90 text-[#1E3A5F] dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-300 ring-2 ring-[#1E3A5F]/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>Fixed Amount (₹)</span>
                  {standMode === 'fixed' && <Check size={14} className="text-[#1E3A5F] dark:text-blue-400" />}
                </div>
                <p className="mt-1 text-[11px] font-normal text-slate-500 dark:text-slate-400">
                  Preset amount encoded into QR code
                </p>
              </button>
            </div>
          </div>

          {standMode === 'fixed' && (
            <div>
              <label className="block mb-1.5 text-xs font-semibold tracking-wide text-[var(--ink-secondary)]">
                Fixed Payment Amount (₹)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={standAmount}
                  onChange={e => setStandAmount(e.target.value)}
                  placeholder="  e.g. 100"
                  className="input w-full h-11 pl-7 text-xs sm:text-sm font-bold tracking-wide text-[var(--ink)] placeholder:text-[var(--muted-light)]"
                />
              </div>
              <p className="mt-1 text-[11px] text-[var(--muted-light)] leading-normal ">
                Customers will be automatically prompted to pay exactly this amount upon scanning.
              </p>
            </div>
          )}

          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Active Merchant:</span>
              <span className="font-bold text-[var(--ink)]">{merchantName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">Shop UPI ID:</span>
              <span className="font-mono font-bold text-[var(--ink)]">{upiId || '⚠️ UPI ID not set'}</span>
            </div>
            {!upiId && (
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 pt-1 border-t border-[var(--line)]">
                Enter your UPI ID in the field above to enable high-res download and printing.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={downloadQrStandPng}
              disabled={!upiId || standDownloading}
              className="w-full sm:flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-[#1E3A5F] text-white text-xs font-bold shadow-sm hover:bg-[#162F4D] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Download size={15} />
              <span>{standDownloading ? 'Generating PNG…' : 'Download QR Stand (PNG)'}</span>
            </button>
            <button
              type="button"
              onClick={printQrStand}
              disabled={!upiId}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 text-xs font-bold shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Printer size={15} />
              <span>Print Standee</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Tabletop Standee Preview */}
        <div className="flex flex-col items-center justify-center">
          <div className="w-full max-w-[280px] rounded-xl border-2 border-slate-900 bg-white shadow-xl overflow-hidden text-center text-slate-900">
            {/* Header Banner */}
            <div className="bg-[#1E3A5F] text-white p-3 flex flex-col items-center gap-1.5">
              {logoDataUrl && (
                <img
                  src={logoDataUrl}
                  alt={merchantName}
                  className="w-8 h-8 rounded object-contain bg-white p-0.5 shadow-sm"
                />
              )}
              <h4 className="text-sm font-extrabold truncate w-full px-2">{merchantName}</h4>
              <span className="text-[9px] font-bold uppercase tracking-wider text-blue-200 bg-white/10 px-2 py-0.5 rounded-full">
                Scan &amp; Pay With Any UPI App
              </span>
            </div>

            {/* Official Brand Logos Strip */}
            <div className="bg-white border-b border-slate-200 py-1.5 px-2">
              <UpiBrandStrip height={16} className="gap-2.5" />
            </div>

            {/* Centered QR Frame */}
            <div className="p-3 flex items-center justify-center bg-white">
              <div ref={standQrRef} className="p-2 bg-white rounded-lg border-2 border-slate-900 shadow-sm inline-block">
                {upiId ? (
                  <QRCodeSVG
                    value={upiUri}
                    size={160}
                    level="H"
                    includeMargin
                    bgColor="#ffffff"
                    fgColor="#0F172A"
                    imageSettings={
                      logoDataUrl
                        ? {
                            src: logoDataUrl,
                            height: 32,
                            width: 32,
                            excavate: true,
                          }
                        : undefined
                    }
                    className="block"
                  />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center text-[11px] text-slate-400 font-medium p-2 text-center">
                    Enter UPI ID to generate standee
                  </div>
                )}
              </div>
            </div>

            {/* Amount Box */}
            {isFixed && (
              <div className="border-t border-b border-blue-200 bg-[#EFF6FF] py-2 px-3">
                <div className="text-[9.5px] font-bold uppercase text-blue-700 tracking-wider">
                  Amount Payable
                </div>

                <div className="text-base font-black text-[#1E3A5F] tracking-tight">
                  ₹{" "}
                  {numAmt.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            )}

            {/* Merchant UPI ID */}
            <div className="py-2 px-2 bg-white">
              <div className="text-[9px] font-semibold text-slate-500 uppercase">Merchant UPI ID</div>
              <div className="font-mono text-xs font-extrabold text-slate-800 break-all">{upiId || 'balajistore@sbi'}</div>
            </div>

            {/* Standee Base Footer */}
            <div className="bg-slate-900 text-slate-400 text-[8.5px] font-semibold py-1.5 px-2">
              Accepted Here: GPay • PhonePe • Paytm • UPI
            </div>
          </div>
          
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const [tab, setTab] = useState('business')
  const [s, setS] = useState({})
  const [previewMode, setPreviewMode] = useState('a4')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    api
      .get('/settings/all/')
      .then(r => {
        const next = r.data || {}
        setS(next)
        setPreviewMode(next.invoice_template === 'thermal_80' ? 'thermal' : 'a4')
      })
      .catch(() => setS({}))
      .finally(() => setLoading(false))
  }, [])

  const set = (key, value) => setS(p => ({ ...p, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const pos = s.place_of_supply || s.shop_state || ''
      const payload = {
        ...s,
        place_of_supply: pos,
        shop_state: pos,
        reason: 'Updated store configuration from Settings panel',
      }
      await api.post('/settings/bulk_update/', payload)
      toast.success('Settings saved successfully')
      window.dispatchEvent(
        new CustomEvent('shop-settings-updated', { detail: { ...s, place_of_supply: pos, shop_state: pos } })
      )
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.error || 'Failed to save settings'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const uploadLogo = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo image must be smaller than 2 MB')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const { data } = await api.post('/settings/upload-logo/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setS(p => ({ ...p, shop_logo: data.url }))
      window.dispatchEvent(
        new CustomEvent('shop-settings-updated', {
          detail: { shop_logo: data.url },
        }),
      )
      toast.success('Logo uploaded')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const removeLogo = async () => {
    setRemoving(true)
    try {
      await api.post('/settings/remove-logo/')
      setS(p => ({ ...p, shop_logo: '' }))
      window.dispatchEvent(
        new CustomEvent('shop-settings-updated', {
          detail: { shop_logo: '' },
        }),
      )
      toast.success('Logo removed')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not remove logo')
    } finally {
      setRemoving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="settings-page w-full min-w-0 space-y-5 pb-16 text-[var(--ink)]">
      {/* Header with Save Button */}
      <PageHeader
        title="Settings & Configuration"
        subtitle="Manage business identity, formal billing layout, tax calculations, and printer presets."
        action={
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="btn-primary btn-base flex items-center justify-center gap-2 text-xs font-semibold px-4"
          >
            {saving ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving...
              </>
            ) : (
              <>
                <Save size={14} />
                Save Changes
              </>
            )}
          </button>
        }
      />

      {/* Grid: Formal Sidebar + Form Canvas */}
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        {/* Navigation Sidebar */}
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 shadow-none lg:sticky lg:top-4 overflow-hidden">
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0 lg:flex-col no-scrollbar">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold whitespace-nowrap shrink-0 lg:shrink lg:whitespace-normal transition-all min-h-[40px] ${
                  tab === id
                    ? 'bg-[#1E3A5F] text-white shadow-xs'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]'
                }`}
              >
                <Icon size={16} className="shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Panels */}
        <div className="min-w-0 space-y-5">
          {/* =========================================================
              TAB 1: BUSINESS PROFILE
          ========================================================= */}
          {tab === 'business' && (
            <div className="space-y-4">
              {/* Logo Card */}
              <SectionCard
                title="Business Logo"
                description="Printed on top of tax invoices, thermal receipts, and formal reports."
              >
                <div className="sm:col-span-2 flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-24 h-24 rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] flex items-center justify-center overflow-hidden shrink-0">
                    {s.shop_logo ? (
                      <img
                        src={s.shop_logo}
                        alt="Logo"
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <ImageIcon
                        size={28}
                        className="text-[var(--muted-light)]"
                      />
                    )}
                  </div>

                  <div className="space-y-2 text-xs">
                    <p className="font-semibold text-[var(--ink)]">
                      Upload Brand / Store Logo
                    </p>
                    <p className="text-[11px] text-[var(--muted)]">
                      Square or rectangular PNG, JPG, or WEBP (Max 2MB).
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <label className="btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer">
                        <Upload size={12} />
                        {s.shop_logo ? 'Change Logo' : 'Upload Logo'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={uploadLogo}
                          disabled={uploading}
                        />
                      </label>
                      {s.shop_logo && (
                        <button
                          type="button"
                          onClick={removeLogo}
                          disabled={removing}
                          className="btn-secondary btn-sm text-rose-400 hover:bg-rose-950/40 flex items-center gap-1"
                        >
                          <Trash2 size={12} />
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* General Details */}
              <SectionCard
                title="Store & Entity Information"
                description="Core identification details printed on invoices."
              >
                <FormField label="Business / Shop Name" required>
                  <Inp
                    value={s.shop_name}
                    onChange={v => set('shop_name', v)}
                    placeholder="Sri Balaji Store"
                  />
                </FormField>

                <FormField label="Business Type">
                  <Sel
                    value={s.business_type}
                    onChange={v => set('business_type', v)}
                    options={[
                      ['retail', 'Retail Store / Supermarket'],
                      ['wholesale', 'Wholesale & Distribution'],
                      ['services', 'Services & Trading'],
                    ]}
                  />
                </FormField>

                <FormField label="GSTIN (Goods & Services Tax ID)">
                  <Inp
                    value={s.shop_gstin}
                    onChange={v => set('shop_gstin', v)}
                    maxLength={15}
                    mono
                    placeholder="33AABCU9603R1ZX"
                  />
                </FormField>

                <FormField label="PAN (Permanent Account Number)">
                  <Inp
                    value={s.shop_pan}
                    onChange={v => set('shop_pan', v)}
                    maxLength={10}
                    mono
                    placeholder="AABCU9603R"
                  />
                </FormField>

                <FormField label="Phone / Mobile Number" required>
                  <Inp
                    value={s.shop_phone}
                    onChange={v => set('shop_phone', v)}
                    placeholder="+91 98765 43210"
                  />
                </FormField>

                <FormField label="Official Email Address">
                  <Inp
                    value={s.shop_email}
                    onChange={v => set('shop_email', v)}
                    type="email"
                    placeholder="contact@balajistore.com"
                  />
                </FormField>

                <FormField label="State / Place of Supply">
                  <StateInput
                    value={s.place_of_supply || s.shop_state}
                    onChange={v => {
                      set('place_of_supply', v)
                      set('shop_state', v)
                    }}
                    placeholder="Tamil Nadu (33)"
                  />
                </FormField>

                <FormField label="FSSAI Licence Number" hint="Optional">
                  <Inp
                    value={s.fssai_licence}
                    onChange={v => set('fssai_licence', v)}
                    placeholder="12423002000123"
                  />
                </FormField>

                <FormField label="Full Store Address" full>
                  <Txt
                    value={s.shop_address}
                    onChange={v => set('shop_address', v)}
                    placeholder="No. 123 Market Road, T. Nagar, Chennai, Tamil Nadu 600017"
                  />
                </FormField>
              </SectionCard>
            </div>
          )}

          {/* =========================================================
              TAB 2: INVOICING & PRINT
          ========================================================= */}
          {tab === 'invoice' && (
            <div className="space-y-4">
              <SectionCard
                title="Numbering & Formatting"
                description="Configure prefix, automatic serial progression, and paper dimensions."
              >
                <FormField label="Invoice Prefix">
                  <Inp
                    value={s.invoice_prefix}
                    onChange={v => set('invoice_prefix', v)}
                    mono
                    placeholder="INV-"
                  />
                </FormField>

                <FormField
                  label="Next Sequence Number"
                  hint="Advances automatically"
                >
                  <Inp
                    value={s.invoice_start_number}
                    onChange={v => set('invoice_start_number', v)}
                    mono
                    placeholder="1001"
                  />
                </FormField>

                <FormField label="Default Bill Format">
                  <Sel
                    value={s.invoice_template || 'gst_a4'}
                    onChange={v => set('invoice_template', v)}
                    options={[
                      ['gst_a4', 'Standard GST Tax Invoice (A4 Sheet)'],
                      ['thermal_80', 'Thermal POS Receipt (80mm/3-inch)'],
                    ]}
                  />
                </FormField>

                <FormField label="Paper Size">
                  <Sel
                    value={s.invoice_paper_size || 'a4'}
                    onChange={v => set('invoice_paper_size', v)}
                    options={[
                      ['a4', 'A4 (210 × 297 mm)'],
                      ['letter', 'US Letter (216 × 279 mm)'],
                      ['a5', 'A5 (148 × 210 mm)'],
                    ]}
                  />
                </FormField>

                <FormField label="Typography / Font Style">
                  <Sel
                    value={s.invoice_font || 'default'}
                    onChange={v => set('invoice_font', v)}
                    options={[
                      ['default', 'Inter / Roboto (Formal Clean)'],
                      ['dejavu', 'DejaVu Sans (Unicode)'],
                      ['courier', 'Courier (Monospace POS)'],
                    ]}
                  />
                </FormField>

                <FormField label="Credit Due Period (Days)">
                  <Inp
                    value={s.invoice_due_days}
                    onChange={v => set('invoice_due_days', v)}
                    type="number"
                    placeholder="15"
                  />
                </FormField>
              </SectionCard>

              <SectionCard
                title="Invoice Terms & Bottom Footer"
                description="Custom legal disclaimer and thank you message printed at the bottom of bills."
              >
                <FormField label="Terms & Conditions" full>
                  <Txt
                    value={s.invoice_terms}
                    onChange={v => set('invoice_terms', v)}
                    rows={3}
                    placeholder="1. Goods once sold will not be accepted back without bill.&#10;2. Warranty as per manufacturer terms."
                  />
                </FormField>

                <FormField label="Bottom Footer Greeting" full>
                  <Inp
                    value={s.invoice_footer}
                    onChange={v => set('invoice_footer', v)}
                    placeholder="Thank you for shopping with us! Visit again."
                  />
                </FormField>
              </SectionCard>

              <SectionCard
                title="Digital Bill & QR Code"
                description="Print a secure digital bill QR code at the bottom of bills for instant customer viewing on mobile phones."
              >
                <div className="sm:col-span-2">
                  <FieldCheckbox
                    checked={isTrue(s.enable_invoice_qr, true)}
                    onChange={e => set('enable_invoice_qr', e.target.checked ? 'true' : 'false')}
                    label="Enable QR Code"
                    description="Print 'Scan to View Bill' QR code at the bottom of both A4 and thermal invoices. Customers can scan to view the complete mobile-friendly digital bill, download PDF, and print."
                  />
                </div>
              </SectionCard>
            </div>
          )}

          {/* =========================================================
              TAB 3: BILL FIELDS & COLUMNS (Clean formal checkboxes)
          ========================================================= */}
          {tab === 'fields' && (
            <div className="space-y-4">
              <SectionCard
                title="1. Store Details on Bill"
                description="Select which company information fields should be visible in the bill header."
              >
                {[
                  [
                    'show_business_logo',
                    'Store Logo',
                    'Display company logo graphic in header',
                  ],
                  [
                    'show_business_address',
                    'Business Address',
                    'Print registered address and city',
                  ],
                  [
                    'show_business_phone',
                    'Phone / Mobile Number',
                    'Print store contact numbers',
                  ],
                  [
                    'show_business_email',
                    'Official Email Address',
                    'Print store email in header',
                  ],
                  [
                    'show_business_gstin',
                    'GSTIN Number',
                    'Print GST Identification Number',
                  ],
                  [
                    'show_business_pan',
                    'PAN Number',
                    'Print Permanent Account Number',
                  ],
                ].map(([key, label, desc]) => (
                  <FieldCheckbox
                    key={key}
                    checked={isTrue(s[key], true)}
                    onChange={e => set(key, String(e.target.checked))}
                    label={label}
                    description={desc}
                  />
                ))}
              </SectionCard>

              <SectionCard
                title="2. Customer (Bill To) Information"
                description="Select which customer attributes are displayed in the customer section."
              >
                {[
                  [
                    'show_customer_phone',
                    'Customer Phone Number',
                    'Display buyer contact number',
                  ],
                  [
                    'show_customer_address',
                    'Customer Billing Address',
                    'Print buyer address details',
                  ],
                  [
                    'show_customer_gstin',
                    'Customer GSTIN',
                    'Required for B2B tax invoice input credit',
                  ],
                  [
                    'show_place_of_supply',
                    'Place of Supply',
                    'Print delivery state / code',
                  ],
                ].map(([key, label, desc]) => (
                  <FieldCheckbox
                    key={key}
                    checked={isTrue(s[key], true)}
                    onChange={e => set(key, String(e.target.checked))}
                    label={label}
                    description={desc}
                  />
                ))}
              </SectionCard>

              <SectionCard
                title="3. Line Item Table Columns"
                description="Customize visible columns in the itemized products table."
              >
                {[
                  [
                    'show_sku_col',
                    'SKU / Item Code Column',
                    'Display product SKU code',
                  ],
                  [
                    'show_hsn_col',
                    'HSN / SAC Column',
                    'Display tax classification code',
                  ],
                  [
                    'show_unit_col',
                    'Unit of Measurement',
                    'Display unit (pcs, kg, L, etc.)',
                  ],
                  [
                    'show_discount_col',
                    'Item Discount Column',
                    'Show discount percent given per item',
                  ],
                  [
                    'show_tax_cols',
                    'Tax Breakdown (SGST / CGST)',
                    'Show tax percent and amount columns',
                  ],
                  [
                    'hsn_summary_on_invoice',
                    'HSN Tax Summary Table',
                    'Print formal HSN summary block at bottom',
                  ],
                ].map(([key, label, desc]) => (
                  <FieldCheckbox
                    key={key}
                    checked={isTrue(s[key], true)}
                    onChange={e => set(key, String(e.target.checked))}
                    label={label}
                    description={desc}
                  />
                ))}
              </SectionCard>

              <SectionCard
                title="4. Summary, Payments & Footer"
                description="Configure accounting summaries, payment notes, and signature block."
              >
                {[
                  [
                    'show_amount_in_words',
                    'Grand Total in Words',
                    'Print written currency words (e.g. Rupees...)',
                  ],
                  [
                    'show_payment_summary',
                    'Payment Status Box',
                    'Display paid amount, mode, and balance',
                  ],
                  [
                    'show_balance_due',
                    'Highlight Balance Due',
                    'Distinct indicator for credit sales',
                  ],
                  [
                    'show_bank_details',
                    'Bank Account Details',
                    'Print bank account & IFSC on invoice',
                  ],
                  [
                    'show_signature_area',
                    'Authorized Signatory Block',
                    'Print signature space for store cashier',
                  ],
                ].map(([key, label, desc]) => (
                  <FieldCheckbox
                    key={key}
                    checked={isTrue(s[key], true)}
                    onChange={e => set(key, String(e.target.checked))}
                    label={label}
                    description={desc}
                  />
                ))}
              </SectionCard>
            </div>
          )}

          {/* =========================================================
              TAB 4: GST & ACCOUNTING
          ========================================================= */}
          {tab === 'gst' && (
            <div className="space-y-4">
              <SectionCard
                title="Tax Calculation Rules"
                description="Define how GST and item rates are computed during billing."
              >
                <FormField label="Tax Calculation Mode">
                  <Sel
                    value={s.tax_on_price || 'exclusive'}
                    onChange={v => set('tax_on_price', v)}
                    options={[
                      ['exclusive', 'Exclusive of GST (Tax added on top)'],
                      ['inclusive', 'Inclusive of GST (Tax back-calculated)'],
                    ]}
                  />
                </FormField>

                <FormField label="Default GST Rate">
                  <Sel
                    value={s.default_gst_rate || '18'}
                    onChange={v => set('default_gst_rate', v)}
                    options={[
                      ['0', '0% (Exempt)'],
                      ['5', '5% (Essential Goods)'],
                      ['12', '12% (Standard I)'],
                      ['18', '18% (Standard II)'],
                      ['28', '28% (Luxury)'],
                    ]}
                  />
                </FormField>

                <FormField label="Default Place of Supply" hint="Printed on invoices and used to determine CGST/SGST vs IGST">
                  <StateInput
                    value={s.place_of_supply || s.shop_state}
                    onChange={v => {
                      set('place_of_supply', v)
                      set('shop_state', v)
                    }}
                    placeholder="Tamil Nadu (33)"
                  />
                </FormField>

                <FormField label="Invoice Round-off Rule">
                  <Sel
                    value={s.round_off || 'nearest'}
                    onChange={v => set('round_off', v)}
                    options={[
                      ['nearest', 'Round to Nearest Rupee (Recommended)'],
                      ['none', 'Exact Decimals (No Round-off)'],
                    ]}
                  />
                </FormField>

                <FormField label="Currency Symbol">
                  <Inp
                    value={s.currency || 'INR'}
                    onChange={v => set('currency', v)}
                    placeholder="INR or ₹"
                  />
                </FormField>
              </SectionCard>
            </div>
          )}

          {/* =========================================================
              TAB 5: BANKING & UPI QR
          ========================================================= */}
          {tab === 'payment' && (
            <div className="space-y-4">
              <SectionCard
                title="Bank Account Information"
                description="Printed on customer invoices for NEFT/RTGS wire transfers."
              >
                <FormField label="Bank Name">
                  <Inp
                    value={s.shop_bank_name}
                    onChange={v => set('shop_bank_name', v)}
                    placeholder="State Bank of India"
                  />
                </FormField>

                <FormField label="Account Number">
                  <Inp
                    value={s.shop_bank_account}
                    onChange={v => set('shop_bank_account', v)}
                    mono
                    placeholder="384920194829"
                  />
                </FormField>

                <FormField label="IFSC Code">
                  <Inp
                    value={s.shop_bank_ifsc}
                    onChange={v => set('shop_bank_ifsc', v)}
                    mono
                    placeholder="SBIN0001234"
                  />
                </FormField>

                <FormField label="Branch Name">
                  <Inp
                    value={s.shop_bank_branch}
                    onChange={v => set('shop_bank_branch', v)}
                    placeholder="T. Nagar Branch"
                  />
                </FormField>
              </SectionCard>

              <SectionCard
                title="Dynamic UPI QR Configuration"
                description="Generates an automatic scannable UPI QR code on the invoice."
              >
                <FormField label="UPI VPA / ID" hint="e.g. storename@sbi">
                  <Inp
                    value={s.shop_upi_id}
                    onChange={v => set('shop_upi_id', v)}
                    placeholder="balajistore@sbi"
                  />
                </FormField>

                <FormField label="UPI Payee / Merchant Name">
                  <Inp
                    value={s.upi_merchant_name}
                    onChange={v => set('upi_merchant_name', v)}
                    placeholder="Sri Balaji Store"
                  />
                </FormField>

                <div className="sm:col-span-2 pt-2">
                  <FieldCheckbox
                    checked={isTrue(s.upi_qr_enabled, true)}
                    onChange={e => set('upi_qr_enabled', String(e.target.checked))}
                    label="Enable Dynamic UPI QR Code on Invoices"
                    description="Encodes the exact bill amount and UPI VPA into a scannable QR code on the invoice."
                  />
                </div>
              </SectionCard>

              <StoreQrStandSettingsCard s={s} />
            </div>
          )}

          {/* =========================================================
              TAB 6: PRINTER SETUP
          ========================================================= */}
          {tab === 'printer' && (
            <div className="space-y-4">
              <SectionCard
                title="Printer Device & Hardware Presets"
                description="Configure hardware printing behavior for POS and cashier counters."
              >
                <FormField label="Primary Printer Hardware">
                  <Sel
                    value={s.printer_type || 'a4'}
                    onChange={v => set('printer_type', v)}
                    options={[
                      ['a4', 'Standard Laser / Inkjet A4 Printer'],
                      ['thermal_80', 'Thermal Receipt Printer (80mm / 3 inch)'],
                      ['thermal_58', 'Thermal Receipt Printer (58mm / 2 inch)'],
                    ]}
                  />
                </FormField>

                <FormField label="Copies Printed per Sale">
                  <Sel
                    value={s.copies_per_bill || '1'}
                    onChange={v => set('copies_per_bill', v)}
                    options={[
                      ['1', '1 Copy (Customer Bill)'],
                      ['2', '2 Copies (Customer + Store Copy)'],
                      ['3', '3 Copies (Customer + Store + Accounts)'],
                    ]}
                  />
                </FormField>

                <div className="sm:col-span-2 pt-2 space-y-2">
                  <FieldCheckbox
                    checked={isTrue(s.open_cash_drawer, false)}
                    onChange={e =>
                      set('open_cash_drawer', String(e.target.checked))
                    }
                    label="Trigger Electronic Cash Drawer Open on Print"
                    description="Sends ESC/POS pulse signal to cash drawer port after completing transaction."
                  />

                  <FieldCheckbox
                    checked={isTrue(s.auto_print, false)}
                    onChange={e => set('auto_print', String(e.target.checked))}
                    label="Automatically Print Receipt after Completing Sale"
                    description="Triggers the browser print dialog immediately when a bill is saved."
                  />
                </div>
              </SectionCard>
            </div>
          )}

          {/* =========================================================
              TAB 7: LIVE BILL PREVIEW
          ========================================================= */}
          {tab === 'preview' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 text-xs text-[var(--muted)] flex items-center justify-between">
                <span>
                  Interactive preview reflecting your current profile,
                  visibility settings, and layout options.
                </span>
                <span className="font-semibold text-[#1E3A5F] dark:text-slate-200">
                  Real-time Simulation
                </span>
              </div>

              <InvoiceDocument
                invoice={{
                  invoice_number: `${s.invoice_prefix || 'INV-'}${s.invoice_start_number || '1001'}`,
                  created_at: new Date().toISOString(),
                  payment_method: s.default_payment_method || 'cash',
                  payment_status: 'paid',
                  customer_name: 'Walk-in Retail Customer',
                  customer_phone: '+91 98765 43210',
                  customer_address:
                    'Flat 4A, Green Park Apartments, Chennai 600017',
                  customer_gstin: '33AABCS1429B1ZP',
                  place_of_supply: s.place_of_supply || 'Tamil Nadu (33)',
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
                      total: 546,
                    },
                    {
                      product_name: 'Fortune Sunflower Oil 1L',
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
                      total: 616,
                    },
                  ],
                  subtotal: 1475.0,
                  discount_amount: 21.75,
                  tax_amount: 119.91,
                  grand_total: 1573.16,
                  paid_amount: 1573.16,
                  balance_due: 0,
                  notes: s.invoice_notes,
                  terms: s.invoice_terms,
                }}
                settings={s}
                mode={previewMode}
                onModeChange={setPreviewMode}
                showModePicker={true}
              />
            </div>
          )}

          {/* Bottom Save Bar */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-primary btn-base flex items-center justify-center gap-2 text-xs font-semibold px-6"
            >
              {saving ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
