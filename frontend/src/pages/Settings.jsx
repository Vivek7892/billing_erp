import { useState, useEffect, useRef, useMemo } from 'react'
import api from '../api'
import { PageHeader, Spinner } from '../components/UI'
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
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import InvoiceDocument, { isTrue } from '../components/InvoiceDocument'
import TemplateCustomizerModal from '../components/TemplateCustomizerModal'
import { QRCodeSVG } from 'qrcode.react'
import logoImg from '../assets/logo.png'
import {
  UpiBrandStrip,
  generatePrintStandHtml,
  loadUpiBrandLogos,
  drawTabletopStandeeCanvas,
} from '../components/UpiLogos'

function FormField({ label, children, full, hint, required }) {
  return (
    <div className={`${full ? 'sm:col-span-2' : ''} min-w-0`}>
      <label className="block mb-1.5 text-[11.5px] font-semibold text-slate-700 tracking-tight">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[10.5px] leading-4 text-slate-500">
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
  disabled,
}) {
  return (
    <input
      type={type}
      className={`w-full h-9 rounded-md border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-medium placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#1E3A5F] dark:focus:border-blue-500 focus:ring-1 focus:ring-[#1E3A5F]/20 dark:focus:ring-blue-500/20 transition-all ${
        mono ? 'font-mono' : ''
      } ${disabled ? 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed' : ''}`}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      maxLength={maxLength}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}

function Sel({ value, onChange, options, disabled }) {
  return (
    <select
      className={`w-full h-9 rounded-md border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-[#1E3A5F] dark:focus:border-blue-500 focus:ring-1 focus:ring-[#1E3A5F]/20 dark:focus:ring-blue-500/20 transition-all ${
        disabled ? 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed' : ''
      }`}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          {l}
        </option>
      ))}
    </select>
  )
}

function Txt({ value, onChange, rows = 3, placeholder, disabled }) {
  return (
    <textarea
      className={`w-full rounded-md border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-medium placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#1E3A5F] dark:focus:border-blue-500 focus:ring-1 focus:ring-[#1E3A5F]/20 dark:focus:ring-blue-500/20 transition-all resize-y leading-5 ${
        disabled ? 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed' : ''
      }`}
      rows={rows}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
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
        className="w-full h-9 rounded-md border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 font-medium placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#1E3A5F] dark:focus:border-blue-500 focus:ring-1 focus:ring-[#1E3A5F]/20 dark:focus:ring-blue-500/20 transition-all"
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

function FieldCheckbox({ checked, onChange, label, description }) {
  return (
    <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 transition-colors cursor-pointer group select-none">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 rounded border-[#DCE3EC] dark:border-slate-600 text-[#1E3A5F] focus:ring-[#1E3A5F] accent-[#1E3A5F] dark:accent-blue-500 cursor-pointer shrink-0"
      />
      <div className="min-w-0">
        <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#1E3A5F] dark:group-hover:text-blue-400 transition-colors">
          {label}
        </span>
        {description && (
          <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
            {description}
          </span>
        )}
      </div>
    </label>
  )
}

function SectionCard({ title, description, children, action, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-none ${className}`}>
      <div className="border-b border-[#DCE3EC] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/80 px-4 py-3 sm:px-5 flex items-center justify-between">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h3>
          {description && (
            <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
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

      const brandLogos = await loadUpiBrandLogos()

      let storeLogoImg = null
      if (logoDataUrl) {
        storeLogoImg = new Image()
        storeLogoImg.crossOrigin = 'anonymous'
        await new Promise(resolve => {
          storeLogoImg.onload = resolve
          storeLogoImg.onerror = resolve
          storeLogoImg.src = logoDataUrl
        })
      }

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
    <div className="overflow-hidden rounded-lg border border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 shadow-none">
      <div className="border-b border-[#DCE3EC] dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/60 px-4 py-3 sm:px-5 flex items-center justify-between">
        <div>
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Store Counter QR Standee (Download &amp; Print)
          </h3>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
            Generate and download a high-resolution, branded tabletop QR stand for your checkout counter.
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-5 grid gap-6 md:grid-cols-[1fr_320px]">
        {/* Left Column: Configuration Controls */}
        <div className="space-y-4">
          <div>
            <label className="block mb-1.5 text-[11.5px] font-semibold text-slate-700 dark:text-slate-300 tracking-tight">
              Stand QR Amount Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setStandMode('any')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  standMode === 'any'
                    ? 'border-[#1E3A5F] dark:border-teal-400 bg-white dark:bg-slate-800 text-[#1E3A5F] dark:text-teal-300 ring-1 ring-[#1E3A5F]/20'
                    : 'border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Any Amount (Open QR)</span>
                  {standMode === 'any' && <Check size={14} className="text-[#0F9D91]" />}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Customer enters any amount on their phone
                </p>
              </button>

              <button
                type="button"
                onClick={() => setStandMode('fixed')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  standMode === 'fixed'
                    ? 'border-[#1E3A5F] dark:border-teal-400 bg-white dark:bg-slate-800 text-[#1E3A5F] dark:text-teal-300 ring-1 ring-[#1E3A5F]/20'
                    : 'border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Fixed Amount (₹)</span>
                  {standMode === 'fixed' && <Check size={14} className="text-[#0F9D91]" />}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Preset amount encoded into QR code
                </p>
              </button>
            </div>
          </div>

          {standMode === 'fixed' && (
            <div>
              <label className="block mb-1.5 text-[11.5px] font-semibold text-slate-700 dark:text-slate-300 tracking-tight">
                Fixed Payment Amount (₹)
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={standAmount}
                onChange={e => setStandAmount(e.target.value)}
                placeholder="e.g. 100"
                className="w-full h-9 rounded-md border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#1E3A5F] dark:focus:border-teal-400 focus:ring-1 focus:ring-[#1E3A5F]/20"
              />
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Customers will be automatically prompted to pay exactly this amount upon scanning.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-800/40 p-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Active Merchant:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{merchantName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Shop UPI ID:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{upiId || '⚠️ UPI ID not set'}</span>
            </div>
            {!upiId && (
              <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 pt-1 border-t border-[#DCE3EC] dark:border-slate-700">
                Enter your UPI ID in the field above to enable high-res download and printing.
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={downloadQrStandPng}
              disabled={!upiId || standDownloading}
              className="h-9 px-4 rounded-md bg-[#1E3A5F] hover:bg-[#162a45] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Download size={14} />
              <span>{standDownloading ? 'Generating PNG…' : 'Download QR Stand (PNG)'}</span>
            </button>
            <button
              type="button"
              onClick={printQrStand}
              disabled={!upiId}
              className="h-9 px-4 rounded-md border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Printer size={14} />
              <span>Print Standee</span>
            </button>
          </div>
        </div>

        {/* Right Column: Live Tabletop Standee Preview */}
        <div className="flex flex-col items-center justify-center">
          <div className="w-full max-w-[260px] rounded-lg border border-[#DCE3EC] bg-white shadow-xs overflow-hidden text-center text-slate-900">
            {/* Header Banner */}
            <div className="bg-[#1E3A5F] text-white p-3 flex flex-col items-center gap-1">
              {logoDataUrl && (
                <img
                  src={logoDataUrl}
                  alt={merchantName}
                  className="w-7 h-7 rounded object-contain bg-white p-0.5 shadow-xs"
                />
              )}
              <h4 className="text-xs font-bold truncate w-full px-2">{merchantName}</h4>
              <span className="text-[8.5px] font-semibold uppercase tracking-wider text-teal-200 bg-white/10 px-2 py-0.5 rounded-full">
                Scan &amp; Pay With Any UPI App
              </span>
            </div>

            {/* Official Brand Logos Strip */}
            <div className="bg-white border-b border-[#DCE3EC] py-1.5 px-2">
              <UpiBrandStrip height={15} className="gap-2.5" />
            </div>

            {/* Centered QR Frame */}
            <div className="p-3 flex items-center justify-center bg-white">
              <div ref={standQrRef} className="p-1.5 bg-white rounded border border-[#DCE3EC] shadow-xs inline-block">
                {upiId ? (
                  <QRCodeSVG
                    value={upiUri}
                    size={144}
                    level="H"
                    includeMargin
                    bgColor="#ffffff"
                    fgColor="#0F172A"
                    imageSettings={
                      logoDataUrl
                        ? {
                            src: logoDataUrl,
                            height: 28,
                            width: 28,
                            excavate: true,
                          }
                        : undefined
                    }
                    className="block"
                  />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center text-[11px] text-slate-400 font-medium p-2 text-center">
                    Enter UPI ID to generate standee
                  </div>
                )}
              </div>
            </div>

            {/* Amount Box */}
            {isFixed && (
              <div className="border-t border-b border-teal-100 bg-[#F0FDF4] py-1.5 px-3">
                <div className="text-[9px] font-bold uppercase text-[#0F9D91] tracking-wider">
                  Amount Payable
                </div>
                <div className="text-sm font-extrabold text-[#1E3A5F] tracking-tight">
                  ₹ {numAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}

            {/* Merchant UPI ID */}
            <div className="py-2 px-2 bg-white border-t border-[#DCE3EC]">
              <div className="text-[8.5px] font-semibold text-slate-500 uppercase tracking-tight">Merchant UPI ID</div>
              <div className="font-mono text-[11px] font-bold text-slate-800 break-all">{upiId || 'balajistore@sbi'}</div>
            </div>

            {/* Standee Base Footer */}
            <div className="bg-[#1E3A5F] text-slate-300 text-[8px] font-semibold py-1.5 px-2">
              Accepted Here: GPay • PhonePe • Paytm • UPI
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const INVOICE_THEMES = [
  {
    id: 'gst_a4',
    name: 'Vertical A4 (Standard GST)',
    size: '210 × 297 mm',
    desc: 'Full-page official GST tax invoice with detailed tax breakups, SAC/HSN codes & bank data.',
    badge: 'Vertical A4',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    type: 'a4',
  },
  {
    id: 'half_a4',
    name: 'Half-A4 Bill (A5)',
    size: '148 × 210 mm',
    desc: 'Compact A5 portrait bill with clean white background, minimal borders & grocery retail layout.',
    badge: 'Half-A4 (A5)',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    type: 'half_a4',
  },
  {
    id: 'stylish',
    name: 'Stylish A4 (Corporate Accent)',
    size: '210 × 297 mm',
    desc: 'Modern corporate vertical design with clean header brand accents and balanced layout.',
    badge: 'Stylish A4',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
    type: 'a4',
  },
  {
    id: 'thermal_80',
    name: 'Thermal POS Receipt (80mm)',
    size: '80mm Roll (3-inch)',
    desc: 'High-speed roll receipt formatted for standard 80mm thermal POS receipt printers.',
    badge: '80mm Roll',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    type: 'thermal',
  },
  {
    id: 'thermal_58',
    name: 'Thermal Receipt (58mm)',
    size: '58mm Roll (2-inch)',
    desc: 'Ultra-compact slip formatted for 58mm (2-inch) mini POS thermal printers.',
    badge: '58mm Roll',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    type: 'thermal_58',
  },
]

function MiniatureInvoicePreview({ themeId }) {
  if (themeId === 'thermal_80') {
    return (
      <div className="w-full h-28 rounded-md bg-[#F8FAFC] dark:bg-slate-950/60 p-1.5 flex items-center justify-center overflow-hidden border border-[#DCE3EC] dark:border-slate-800 select-none">
        <div className="w-24 h-full bg-white shadow-xs rounded-[2px] p-1.5 flex flex-col justify-between border border-[#DCE3EC] text-[5.5px] font-mono leading-tight text-slate-800">
          <div className="text-center font-bold tracking-tight truncate border-b border-dashed border-slate-300 pb-0.5">
            BALAJI STORE
          </div>
          <div className="space-y-0.5 my-0.5">
            <div className="flex justify-between text-[5px]"><span>INV-1001</span><span>12/10</span></div>
            <div className="border-t border-dashed border-slate-200 my-0.5" />
            <div className="flex justify-between text-[5px]"><span>Rice 5kg</span><span>₹260</span></div>
            <div className="flex justify-between text-[5px]"><span>Oil 1L</span><span>₹145</span></div>
          </div>
          <div className="border-t border-dashed border-slate-300 pt-0.5">
            <div className="flex justify-between font-bold text-[5.5px]"><span>TOTAL</span><span>₹405</span></div>
            <div className="mt-0.5 flex justify-center">
              <div className="w-3.5 h-3.5 bg-slate-900 rounded-[1px] flex items-center justify-center text-white text-[4px]">QR</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (themeId === 'thermal_58') {
    return (
      <div className="w-full h-28 rounded-md bg-[#F8FAFC] dark:bg-slate-950/60 p-1.5 flex items-center justify-center overflow-hidden border border-[#DCE3EC] dark:border-slate-800 select-none">
        <div className="w-18 h-full bg-white shadow-xs rounded-[2px] p-1 flex flex-col justify-between border border-[#DCE3EC] text-[5px] font-mono leading-tight text-slate-800">
          <div className="text-center font-bold tracking-tight truncate border-b border-dashed border-slate-300 pb-0.5 text-[5px]">
            BALAJI POS
          </div>
          <div className="space-y-0.5 my-0.5">
            <div className="flex justify-between text-[4.5px]"><span>#1001</span><span>12/10</span></div>
            <div className="border-t border-dashed border-slate-200 my-0.5" />
            <div className="flex justify-between text-[4.5px]"><span>Rice</span><span>₹260</span></div>
            <div className="flex justify-between text-[4.5px]"><span>Oil</span><span>₹145</span></div>
          </div>
          <div className="border-t border-dashed border-slate-300 pt-0.5">
            <div className="flex justify-between font-bold text-[5px]"><span>TOT</span><span>₹405</span></div>
            <div className="mt-0.5 flex justify-center">
              <div className="w-3 h-3 bg-slate-900 rounded-[1px] flex items-center justify-center text-white text-[3.5px]">QR</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (themeId === 'half_a4') {
    return (
      <div className="w-full h-28 rounded-md bg-[#F8FAFC] dark:bg-slate-950/60 p-1.5 flex items-center justify-center overflow-hidden border border-[#DCE3EC] dark:border-slate-800 select-none">
        <div className="w-40 h-full bg-white shadow-xs rounded-[2px] p-1.5 flex flex-col justify-between border border-[#DCE3EC] text-[6px] leading-tight text-slate-800">
          <div className="flex justify-between items-start border-b border-slate-200 pb-0.5">
            <div>
              <div className="font-extrabold text-[7px] text-slate-900 leading-none">BALAJI STORE</div>
              <div className="text-[5px] text-slate-500 mt-0.5">GSTIN: 33AABCU9603R1ZX</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-[6.5px] text-[#1E3A5F]">TAX INVOICE</div>
              <div className="text-[5px] text-emerald-700 font-semibold">Half-A4 (A5)</div>
            </div>
          </div>
          <div className="my-0.5 space-y-0.5">
            <div className="grid grid-cols-4 bg-[#F8FAFC] px-1 py-0.5 font-bold text-[5px] text-slate-700">
              <span className="col-span-2">Item</span><span>Qty</span><span className="text-right">Amt</span>
            </div>
            <div className="grid grid-cols-4 px-1 text-[5px] border-b border-slate-100">
              <span className="col-span-2 truncate">Basmati Rice</span><span>2</span><span className="text-right">₹546</span>
            </div>
            <div className="grid grid-cols-4 px-1 text-[5px]">
              <span className="col-span-2 truncate">Sunflower Oil</span><span>3</span><span className="text-right">₹435</span>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-0.5 flex justify-between items-center text-[5.5px]">
            <div className="w-4 h-4 bg-slate-900 rounded-[1px] flex items-center justify-center text-white text-[4px]">QR</div>
            <div className="text-right">
              <div className="text-[5px] text-slate-500">GST: ₹47.00</div>
              <div className="font-extrabold text-[7px] text-slate-900">₹981.00</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Stylish A4 or Vertical A4
  return (
    <div className="w-full h-28 rounded-md bg-[#F8FAFC] dark:bg-slate-950/60 p-1.5 flex items-center justify-center overflow-hidden border border-[#DCE3EC] dark:border-slate-800 select-none">
      <div className="w-32 h-full bg-white shadow-xs rounded-[2px] p-1.5 flex flex-col justify-between border border-[#DCE3EC] text-[6px] leading-tight text-slate-800">
        <div className={`flex justify-between items-start border-b ${themeId === 'stylish' ? 'border-[#1E3A5F] bg-[#1E3A5F]/10 -mx-1.5 -mt-1.5 p-1 mb-0.5' : 'border-slate-200 pb-0.5'}`}>
          <div>
            <div className={`font-extrabold text-[7px] ${themeId === 'stylish' ? 'text-[#1E3A5F]' : 'text-slate-900'}`}>SRI BALAJI</div>
            <div className="text-[4.5px] text-slate-500">{themeId === 'stylish' ? 'Corporate Accent' : 'Vertical GST Invoice'}</div>
          </div>
          <div className="text-right font-bold text-[6px] text-[#1E3A5F]">
            A4 Sheet
          </div>
        </div>
        <div className="my-0.5 space-y-0.5">
          <div className="grid grid-cols-4 bg-[#F8FAFC] px-1 py-0.5 font-bold text-[4.5px] text-slate-700">
            <span className="col-span-2">Desc</span><span>Qty</span><span className="text-right">Total</span>
          </div>
          <div className="grid grid-cols-4 px-1 text-[4.5px]">
            <span className="col-span-2 truncate">Demo Product 1</span><span>2</span><span className="text-right">₹560</span>
          </div>
          <div className="grid grid-cols-4 px-1 text-[4.5px]">
            <span className="col-span-2 truncate">Demo Product 2</span><span>1</span><span className="text-right">₹504</span>
          </div>
        </div>
        <div className="border-t border-slate-200 pt-0.5 flex justify-between items-center text-[5.5px]">
          <span className="text-[4.5px] text-slate-500 italic">Authorised Signatory</span>
          <div className="font-extrabold text-[6.5px] text-slate-900">₹1,064.00</div>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const [tab, setTab] = useState('business')
  const [s, setS] = useState({})
  const [initialS, setInitialS] = useState({})
  const [isDirty, setIsDirty] = useState(false)
  const [previewMode, setPreviewMode] = useState('a4')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedSuccess, setSavedSuccess] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [customizingTemplateId, setCustomizingTemplateId] = useState(null)

  const selectActiveTemplate = async (format, templateId) => {
    try {
      const res = await api.post('/settings/templates/select-active/', {
        format,
        template_id: templateId,
      })
      setS(prev => ({
        ...prev,
        active_templates: res.data,
        ...(format === 'default' ? { invoice_template: templateId } : {}),
      }))
      if (format === 'default') {
        if (templateId === 'half_a4' || templateId === 'advanced_gst_a5') {
          set('invoice_paper_size', 'a5')
          setPreviewMode('half_a4')
        } else if (templateId === 'thermal_80') {
          setPreviewMode('thermal_80')
        } else if (templateId === 'thermal_58') {
          setPreviewMode('thermal_58')
        } else {
          setPreviewMode('a4')
        }
      }
      toast.success(`Active ${format === 'default' ? 'default' : format.replace('active_template_', '').toUpperCase()} template set`)
    } catch (err) {
      toast.error('Failed to update active template')
    }
  }

  useEffect(() => {
    api
      .get('/settings/all/')
      .then(r => {
        const next = r.data || {}
        setS(next)
        setInitialS(next)
        setIsDirty(false)
        if (next.invoice_template === 'thermal_80') {
          setPreviewMode('thermal_80')
        } else if (next.invoice_template === 'thermal_58') {
          setPreviewMode('thermal_58')
        } else if (next.invoice_template === 'half_a4' || next.invoice_template === 'advanced_gst_a5') {
          setPreviewMode('half_a4')
        } else {
          setPreviewMode('a4')
        }
      })
      .catch(() => {
        setS({})
        setInitialS({})
      })
      .finally(() => setLoading(false))
  }, [])

  const set = (key, value) => {
    setS(p => {
      const updated = { ...p, [key]: value }
      setIsDirty(true)
      return updated
    })
  }

  const save = async () => {
    if (!s.shop_name || !s.shop_name.trim()) {
      toast.error('Business / Shop Name is required')
      setTab('business')
      return
    }

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
      setInitialS({ ...s, place_of_supply: pos, shop_state: pos })
      setIsDirty(false)
      setSavedSuccess(true)
      setTimeout(() => setSavedSuccess(false), 2500)
      toast.success('Settings saved successfully')
      window.dispatchEvent(
        new CustomEvent('shop-settings-updated', {
          detail: { ...s, place_of_supply: pos, shop_state: pos },
        })
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
      setIsDirty(true)
      window.dispatchEvent(
        new CustomEvent('shop-settings-updated', {
          detail: { shop_logo: data.url },
        })
      )
      toast.success('Logo uploaded successfully')
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
      setIsDirty(true)
      window.dispatchEvent(
        new CustomEvent('shop-settings-updated', {
          detail: { shop_logo: '' },
        })
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
    <div className="settings-page w-full min-w-0 space-y-5 pb-16 text-slate-900 dark:text-slate-100">
      {/* Header with Save Button and Dirty Indicator */}
      <PageHeader
        title="Settings & Configuration"
        subtitle="Manage business identity, formal billing layout, tax calculations, and printer presets."
        action={
          <div className="flex items-center gap-2.5">
            {isDirty && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-teal-50 dark:bg-teal-950/60 text-[#0F9D91] dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0F9D91] animate-pulse" />
                Unsaved changes
              </span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-9 px-4 rounded-md bg-[#1E3A5F] hover:bg-[#162a45] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Saving...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <CheckCircle2 size={14} className="text-teal-300" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        }
      />

      {/* Grid: Navigation Sidebar + Tab Panels Canvas */}
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
        {/* Navigation Sidebar */}
        <div className="w-full rounded-lg border border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xs lg:sticky lg:top-4 overflow-hidden">
          <div className="flex gap-1 overflow-x-auto pb-1 lg:pb-0 lg:flex-col no-scrollbar">
            {TABS.map(({ id, label, icon: Icon }) => {
              const isActive = tab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`flex items-center justify-between rounded-md px-3.5 py-2.5 text-left text-xs whitespace-nowrap shrink-0 lg:shrink lg:whitespace-normal transition-all min-h-[40px] w-full ${
                    isActive
                      ? 'bg-[#1E3A5F] dark:bg-teal-600 text-white font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon size={16} className={`shrink-0 ${isActive ? 'text-teal-300 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                    <span className="truncate">{label}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0F9D91] dark:bg-white shrink-0 ml-2" />
                  )}
                </button>
              )
            })}
          </div>

          <div className="hidden lg:block mt-4 pt-3 border-t border-[#DCE3EC] dark:border-slate-800 px-2 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">{s.shop_name || 'My Store'}</div>
            <div className="flex items-center justify-between mt-1 text-[10.5px]">
              <span>Template:</span>
              <span className="font-medium text-[#1E3A5F] dark:text-teal-400">
                {INVOICE_THEMES.find(t => t.id === (s.invoice_template || 'gst_a4'))?.name || 'A4'}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Content Panels */}
        <div className="min-w-0 space-y-5">
          {/* =========================================================
              TAB 1: BUSINESS PROFILE
          ========================================================= */}
          {tab === 'business' && (
            <div className="space-y-4">
              {/* Compact Logo Uploader Card */}
              <SectionCard
                title="Business Logo"
                description="Printed on top of tax invoices, thermal receipts, and formal reports."
              >
                <div className="sm:col-span-2 flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg border-2 border-dashed border-[#DCE3EC] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-800 flex items-center justify-center p-2 relative overflow-hidden shrink-0">
                    {s.shop_logo ? (
                      <img
                        src={s.shop_logo}
                        alt="Logo"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon size={26} className="text-slate-400 dark:text-slate-500" />
                    )}
                  </div>

                  <div className="space-y-1.5 text-center sm:text-left flex-1">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                      Store Brand Logo
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                      Upload square or landscape PNG, JPG, or WEBP (Max 2 MB). A transparent background is recommended for printed receipts.
                    </p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                      <label className="h-8 px-3 rounded-md bg-[#1E3A5F] hover:bg-[#162a45] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all">
                        <Upload size={13} />
                        <span>{s.shop_logo ? 'Change Logo' : 'Upload Logo'}</span>
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
                          className="h-8 px-2.5 rounded-md border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center gap-1 transition-all"
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* General Details Aligned 2-Column Form */}
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
              {/* Active Format Defaults & Routing */}
              <SectionCard
                title="Format Routing & Template Defaults"
                description="Assign dedicated active templates per paper format. Printing or downloading in any format will automatically apply its customized layout."
              >
                <FormField label="Global Default Format" hint="Used when format is not explicitly specified">
                  <Sel
                    value={s.invoice_template || 'gst_a4'}
                    onChange={v => selectActiveTemplate('default', v)}
                    options={[
                      ['gst_a4', 'Standard Vertical A4 (Standard GST Full Sheet)'],
                      ['half_a4', 'Half-A4 Bill (A5 - 148 × 210 mm)'],
                      ['stylish', 'Stylish A4 (Corporate Header Accent)'],
                      ['thermal_80', 'Thermal POS Receipt (80mm / 3-inch)'],
                      ['thermal_58', 'Thermal Receipt (58mm / 2-inch)'],
                    ]}
                  />
                </FormField>

                <FormField label="Active Half-A4 (A5) Template" hint="Used for Half-A4 / A5 prints and PDFs">
                  <Sel
                    value={s.active_templates?.active_template_half_a4 || 'half_a4'}
                    onChange={v => selectActiveTemplate('half_a4', v)}
                    options={[
                      ['half_a4', 'Half-A4 Bill (A5 Portrait - Minimalist Clean)'],
                    ]}
                  />
                </FormField>

                <FormField label="Active A4 Template" hint="Used for full-page A4 prints and PDFs">
                  <Sel
                    value={s.active_templates?.active_template_a4 || 'gst_a4'}
                    onChange={v => selectActiveTemplate('a4', v)}
                    options={[
                      ['gst_a4', 'Standard Vertical A4 (Standard GST Full Sheet)'],
                      ['stylish', 'Stylish A4 (Corporate Header Accent)'],
                    ]}
                  />
                </FormField>

                <FormField label="Active Thermal POS Template" hint="Used for 80mm/58mm thermal receipt printers">
                  <Sel
                    value={s.active_templates?.active_template_thermal || 'thermal_80'}
                    onChange={v => selectActiveTemplate('thermal', v)}
                    options={[
                      ['thermal_80', 'Thermal POS Receipt (80mm Roll / 3-inch)'],
                      ['thermal_58', 'Thermal Mini Slip (58mm Roll / 2-inch)'],
                    ]}
                  />
                </FormField>
              </SectionCard>

              {/* Invoice Themes & Templates Gallery */}
              <SectionCard
                title="Invoice Themes & Individual Customization"
                description="Select an active bill layout or click 'Customize' to modify independent layout, fields, tax, and branding settings for each template."
              >
                <div className="sm:col-span-2 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {INVOICE_THEMES.map(theme => {
                      const isDefault = (s.invoice_template || 'gst_a4') === theme.id
                      const isA4Active = s.active_templates?.active_template_a4 === theme.id && theme.type === 'a4'
                      const isHalfA4Active = s.active_templates?.active_template_half_a4 === theme.id && theme.type === 'half_a4'
                      const isThermalActive = s.active_templates?.active_template_thermal === theme.id && (theme.type === 'thermal' || theme.type === 'thermal_58')

                      return (
                        <div
                          key={theme.id}
                          className={`group relative rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                            isDefault
                              ? 'border-2 border-[#1E3A5F] dark:border-teal-400 bg-[#F8FAFC] dark:bg-slate-800/80 shadow-xs'
                              : 'border-[#DCE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                          }`}
                        >
                          <div>
                            {/* Miniature invoice preview */}
                            <div className="relative mb-3">
                              <MiniatureInvoicePreview themeId={theme.id} />
                              <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                {isDefault && (
                                  <div className="flex items-center gap-1 bg-[#1E3A5F] dark:bg-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                                    <Check size={11} strokeWidth={3} />
                                    <span>Default</span>
                                  </div>
                                )}
                                {isHalfA4Active && !isDefault && (
                                  <div className="flex items-center gap-1 bg-emerald-600 text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                                    <span>Half-A4 Active</span>
                                  </div>
                                )}
                                {isA4Active && !isDefault && (
                                  <div className="flex items-center gap-1 bg-blue-600 text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                                    <span>A4 Active</span>
                                  </div>
                                )}
                                {isThermalActive && !isDefault && (
                                  <div className="flex items-center gap-1 bg-amber-600 text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded-full shadow-xs">
                                    <span>Thermal Active</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Theme info */}
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 group-hover:text-[#1E3A5F] dark:group-hover:text-teal-400 transition-colors">
                                {theme.name}
                              </h4>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${theme.badgeClass}`}>
                                {theme.badge}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal line-clamp-2 mb-3">
                              {theme.desc}
                            </p>
                          </div>

                          <div className="pt-2.5 border-t border-[#DCE3EC] dark:border-slate-800 flex items-center justify-between gap-2">
                            <span className="font-mono text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                              {theme.size}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setCustomizingTemplateId(theme.id)}
                                className="h-7 px-2.5 rounded-md border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors shadow-2xs"
                                title="Customize this template's fields, margins and styles"
                              >
                                <Sliders size={11} />
                                <span>Customize</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => selectActiveTemplate('default', theme.id)}
                                className={`h-7 px-2 rounded-md text-[11px] font-semibold transition-colors ${
                                  isDefault
                                    ? 'bg-[#1E3A5F] dark:bg-teal-600 text-white shadow-2xs cursor-default'
                                    : 'border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                                title="Set as primary default bill template"
                              >
                                {isDefault ? 'Active' : 'Set Default'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </SectionCard>

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
                    onChange={v => {
                      set('invoice_template', v)
                      if (v === 'half_a4') {
                        set('invoice_paper_size', 'a5')
                        setPreviewMode('half_a4')
                      } else if (v === 'thermal_80') {
                        setPreviewMode('thermal_80')
                      } else if (v === 'thermal_58') {
                        setPreviewMode('thermal_58')
                      } else {
                        setPreviewMode('a4')
                      }
                    }}
                    options={[
                      ['gst_a4', 'Standard Vertical A4 (Standard GST Full Sheet)'],
                      ['half_a4', 'Half-A4 Bill (A5 - 148 × 210 mm)'],
                      ['stylish', 'Stylish A4 (Corporate Accent)'],
                      ['thermal_80', 'Thermal POS Receipt (80mm / 3-inch)'],
                      ['thermal_58', 'Thermal Receipt (58mm / 2-inch)'],
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

                <div className="sm:col-span-2 pt-2 border-t border-[#DCE3EC] dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Platform Terms &amp; Conditions:</span>
                  <a
                    href="/terms-and-conditions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A5F] dark:text-teal-400 hover:underline"
                  >
                    <span>View ShopEase Terms &amp; Conditions</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </SectionCard>

              <SectionCard
                title="Digital Bill & QR Code"
                description="Print a secure digital bill QR code at the bottom of bills for instant customer viewing on mobile phones."
              >
                <div className="sm:col-span-2">
                  <FieldCheckbox
                    checked={isTrue(s.enable_invoice_qr, true)}
                    onChange={e => set('enable_invoice_qr', e.target.checked ? 'true' : 'false')}
                    label="Enable Digital Bill QR Code"
                    description="Print 'Scan to View Bill' QR code at the bottom of both A4 and thermal invoices. Customers can scan to view the complete mobile-friendly digital bill, download PDF, and print."
                  />
                </div>
              </SectionCard>
            </div>
          )}

          {/* =========================================================
              TAB 3: BILL FIELDS & COLUMNS
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
              <div className="bg-white dark:bg-slate-900 rounded-lg border border-[#DCE3EC] dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                    Live Bill Preview
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Real-time document rendering using current identity, tax rules, and visible column settings.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-md border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 p-0.5">
                    {[
                      ['a4', 'A4'],
                      ['half_a4', 'Half-A4 (A5)'],
                      ['thermal_80', '80mm Thermal'],
                      ['thermal_58', '58mm Thermal'],
                    ].map(([mKey, label]) => (
                      <button
                        key={mKey}
                        type="button"
                        onClick={() => setPreviewMode(mKey)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                          previewMode === mKey
                            ? 'bg-[#1E3A5F] dark:bg-teal-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="h-8 px-3 rounded-md bg-[#1E3A5F] hover:bg-[#162a45] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-all"
                    title="Print bill preview"
                  >
                    <Printer size={13} />
                    <span>Print Bill</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      toast.success('Select "Save as PDF" in your print destination to download');
                      window.print();
                    }}
                    className="h-8 px-3 rounded-md border border-[#DCE3EC] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition-all"
                    title="Download bill PDF"
                  >
                    <Download size={13} />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-lg border border-[#DCE3EC] dark:border-slate-800 p-3 sm:p-5 overflow-x-auto flex justify-center">
                <InvoiceDocument
                  invoice={{
                    invoice_number: `${s.invoice_prefix || 'INV-'}${s.invoice_start_number || '1001'}`,
                    created_at: new Date().toISOString(),
                    payment_method: s.default_payment_method || 'cash',
                    payment_status: 'paid',
                    customer_name: 'Walk-in Retail Customer',
                    customer_phone: '+91 98765 43210',
                    customer_address: 'Flat 4A, Green Park Apartments, Chennai 600017',
                    customer_gstin: '33AABCS1429B1ZP',
                    place_of_supply: s.place_of_supply || s.shop_state || 'Tamil Nadu (33)',
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
                  showModePicker={false}
                />
              </div>
            </div>
          )}

          {/* Bottom Save Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-[#DCE3EC] dark:border-slate-800">
            <div className="text-xs">
              {isDirty ? (
                <span className="flex items-center gap-1.5 text-[#0F9D91] dark:text-teal-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#0F9D91] animate-pulse" />
                  You have unsaved changes
                </span>
              ) : (
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Check size={14} className="text-teal-600 dark:text-teal-400" />
                  All settings up to date
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-9 px-6 rounded-md bg-[#1E3A5F] hover:bg-[#162a45] text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Saving Changes...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <CheckCircle2 size={14} className="text-teal-300" />
                  <span>Changes Saved</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Template Customizer Modal with Real-time Live Preview */}
      {customizingTemplateId && (
        <TemplateCustomizerModal
          isOpen={Boolean(customizingTemplateId)}
          onClose={() => setCustomizingTemplateId(null)}
          templateId={customizingTemplateId}
          templateMeta={INVOICE_THEMES.find(t => t.id === customizingTemplateId)}
          globalSettings={s}
          onSaved={savedCfg => {
            setS(prev => {
              const tplSettings = { ...(prev.template_settings || {}) }
              if (tplSettings[savedCfg.template_id]) {
                tplSettings[savedCfg.template_id] = {
                  ...tplSettings[savedCfg.template_id],
                  config: savedCfg,
                }
              }
              return {
                ...prev,
                template_settings: tplSettings,
              }
            })
          }}
        />
      )}
    </div>
  )
}
