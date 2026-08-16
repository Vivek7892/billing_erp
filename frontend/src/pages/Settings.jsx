import { useState, useEffect, useRef } from 'react'
import api, { API_BASE_URL } from '../api'
import { Card, PageHeader } from '../components/UI'
import toast from 'react-hot-toast'
import { useAuth } from '../AuthContext'
import {
  Building2, FileText, Percent, CreditCard, Printer, Upload, CheckCircle2, Info, XCircle, Trash2, ImageIcon
} from 'lucide-react'

// ── tiny helpers ────────────────────────────────────────────────────────────
function F({ label, children, full }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}

function Inp({ value, onChange, mono, maxLength, type = 'text', placeholder }) {
  return (
    <input
      type={type}
      className={`input${mono ? ' font-mono' : ''}`}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      maxLength={maxLength}
      placeholder={placeholder}
    />
  )
}

function Sel({ value, onChange, options }) {
  return (
    <select className="input" value={value || ''} onChange={e => onChange(e.target.value)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

function Txt({ value, onChange, rows = 3, placeholder }) {
  return (
    <textarea
      className="input"
      rows={rows}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

function Pill({ color, children }) {
  const cls = {
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
  }[color] || 'bg-gray-100 text-gray-600 border-gray-200'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cls}`}>
      {children}
    </span>
  )
}

// ── tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'business', label: 'Business Profile', Icon: Building2 },
  { id: 'invoice', label: 'Invoice Settings', Icon: FileText },
  { id: 'gst', label: 'GST Settings', Icon: Percent },
  { id: 'payment', label: 'Payment Settings', Icon: CreditCard },
  { id: 'printer', label: 'Printer Settings', Icon: Printer },
]

// ── section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">{title}</h3>
      <div className="grid sm:grid-cols-2 gap-3">{children}</div>
    </Card>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 3.1 Business Profile
// ══════════════════════════════════════════════════════════════════════════════
function BusinessTab({ s, set, onLogoUpload, uploading, onUploadSuccess }) {
  const fileRef = useRef()
  const [localPreview, setLocalPreview] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)

  const savedLogoUrl = s.shop_logo
    ? (s.shop_logo.startsWith('http') ? s.shop_logo : `${API_BASE_URL.replace(/\/api$/, '')}${s.shop_logo}`)
    : null
  const previewUrl = localPreview || savedLogoUrl

  // Once upload finishes and s.shop_logo is updated, drop the local blob
  useEffect(() => {
    if (!uploading && s.shop_logo) {
      setLocalPreview(null)
      setFileInfo(null)
    }
  }, [uploading, s.shop_logo])

  const handleFileChange = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setLocalPreview(URL.createObjectURL(file))
    setFileInfo({ name: file.name, size: (file.size / 1024).toFixed(1) + ' KB' })
    onLogoUpload(e)
  }

  const handleRemove = () => {
    setLocalPreview(null)
    setFileInfo(null)
    set('shop_logo', '')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Logo tile */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Business Logo</h3>
        <div className="flex flex-col sm:flex-row gap-5">

          {/* Preview box */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-36 h-36 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors group relative"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Shop logo" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-gray-400 group-hover:text-indigo-500 transition-colors">
                  <ImageIcon size={32} />
                  <span className="text-xs font-medium">No logo</span>
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                <Upload size={22} className="text-white" />
              </div>
            </div>
            <span className="text-[11px] text-gray-400">Click to change</span>
          </div>

          {/* Controls */}
          <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-0.5">Shop / Brand Logo</p>
              <p className="text-xs text-gray-400">PNG · JPG · WEBP &nbsp;·&nbsp; Square recommended &nbsp;·&nbsp; Max 2 MB</p>
              <p className="text-xs text-gray-400 mt-0.5">Appears on invoices, receipts and reports.</p>
            </div>

            {fileInfo && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle2 size={14} className="text-green-600 flex-shrink-0" />
                <span className="text-xs text-green-700 truncate">{fileInfo.name}</span>
                <span className="text-xs text-green-500 flex-shrink-0">{fileInfo.size}</span>
              </div>
            )}

            {uploading && (
              <div className="flex items-center gap-2 text-xs text-indigo-600">
                <div className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                Uploading…
              </div>
            )}

            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary text-xs">
                <Upload size={13} /> {previewUrl ? 'Change logo' : 'Upload logo'}
              </button>
              {previewUrl && (
                <button type="button" onClick={handleRemove} className="btn-secondary text-xs text-red-600 hover:bg-red-50 hover:border-red-200">
                  <Trash2 size={13} /> Remove
                </button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <F label="PAN"><Inp value={s.shop_pan} onChange={v => set('shop_pan', v)} maxLength={10} mono placeholder="AABCS1429B" /></F>
              <F label="FSSAI Licence"><Inp value={s.fssai_licence} onChange={v => set('fssai_licence', v)} placeholder="12345678901234" /></F>
            </div>
          </div>
        </div>
      </Card>

      <Section title="Business Details">
        <F label="Business Name">
          <Inp value={s.shop_name} onChange={v => set('shop_name', v)} placeholder="Sri Balaji Store" />
        </F>
        <F label="Business Type">
          <Sel value={s.business_type} onChange={v => set('business_type', v)} options={[
            ['retail_wholesale', 'Retail & Wholesale'],
            ['manufacturing', 'Manufacturing'],
            ['services', 'Services'],
          ]} />
        </F>
        <F label="GSTIN">
          <Inp value={s.shop_gstin} onChange={v => set('shop_gstin', v)} maxLength={15} mono placeholder="23AABCS1429B1ZP" />
        </F>
        <F label="Phone">
          <Inp value={s.shop_phone} onChange={v => set('shop_phone', v)} placeholder="+91 98765 43210" />
        </F>
        <F label="Email">
          <Inp value={s.shop_email} onChange={v => set('shop_email', v)} type="email" placeholder="billing@balajitraders.in" />
        </F>
        <F label="State">
          <Inp value={s.shop_state} onChange={v => set('shop_state', v)} placeholder="Madhya Pradesh" />
        </F>
        <F label="Business Address" full>
          <Txt value={s.shop_address} onChange={v => set('shop_address', v)} placeholder="Shop no., Street, City, PIN" />
        </F>
      </Section>

      <Section title="Optional Identifiers">
        <F label="CIN"><Inp value={s.cin} onChange={v => set('cin', v)} mono placeholder="U74999MH2021PTC123456" /></F>
        <F label="Financial Year Start">
          <Sel value={s.fy_start} onChange={v => set('fy_start', v)} options={[
            ['april', 'April (default)'], ['january', 'January'], ['july', 'July'],
          ]} />
        </F>
      </Section>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 3.2 Invoice Settings
// ══════════════════════════════════════════════════════════════════════════════
function InvoiceTab({ s, set }) {
  return (
    <div className="space-y-4">
      <Section title="Numbering">
        <F label="Invoice Prefix">
          <Inp value={s.invoice_prefix} onChange={v => set('invoice_prefix', v)} placeholder="INV-2026-" />
        </F>
        <F label="Next Invoice Number">
          <Inp value={s.invoice_start_number} onChange={v => set('invoice_start_number', v)} mono placeholder="0149" />
          <p className="mt-1 text-xs text-gray-400">The next bill uses this number; it advances automatically after each saved invoice.</p>
        </F>
        <F label="Invoice Template">
          <Sel value={s.invoice_template} onChange={v => set('invoice_template', v)} options={[
            ['gst_a4', 'GST Tax Invoice (A4)'],
            ['supply_a4', 'Bill of Supply (A4)'],
            ['thermal_80', 'Thermal Receipt (80mm)'],
          ]} />
        </F>
        <F label="Default Due Days">
          <Inp value={s.invoice_due_days} onChange={v => set('invoice_due_days', v)} type="number" placeholder="15" />
        </F>
      </Section>

      <Section title="Content">
        <F label="Terms & Conditions" full>
          <Txt
            value={s.invoice_terms}
            onChange={v => set('invoice_terms', v)}
            rows={4}
            placeholder={`1. Goods once sold will not be returned.\n2. Payment due within 15 days.\n3. Interest @18% p.a. on overdue amounts.\n4. Subject to local jurisdiction.`}
          />
        </F>
        <F label="Invoice Footer Text" full>
          <Inp value={s.invoice_footer} onChange={v => set('invoice_footer', v)} placeholder="Thank you for your business!" />
        </F>
      </Section>

      <Section title="Show / Hide Columns">
        {[
          ['show_discount_col', 'Discount column'],
          ['show_hsn_col', 'HSN / SAC column'],
          ['show_batch_col', 'Batch number'],
          ['show_expiry_col', 'Expiry date'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={s[key] === 'true' || s[key] === true}
              onChange={e => set(key, String(e.target.checked))}
              className="rounded"
            />
            {label}
          </label>
        ))}
      </Section>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 3.3 GST Settings
// ══════════════════════════════════════════════════════════════════════════════
function GstTab({ s, set }) {
  return (
    <div className="space-y-4">
      <Section title="Registration">
        <F label="GST Registration Type">
          <Sel value={s.gst_reg_type} onChange={v => set('gst_reg_type', v)} options={[
            ['regular', 'Regular'],
            ['composition', 'Composition'],
            ['unregistered', 'Unregistered'],
          ]} />
        </F>
        <F label="Default GST Rate">
          <Sel value={s.default_gst_rate} onChange={v => set('default_gst_rate', v)} options={[
            ['0', '0%'], ['5', '5%'], ['12', '12%'], ['18', '18%'], ['28', '28%'],
          ]} />
        </F>
        <F label="Place of Supply">
          <Inp value={s.place_of_supply} onChange={v => set('place_of_supply', v)} placeholder="Madhya Pradesh (23)" />
        </F>
        <F label="Tax on Price">
          <div className="space-y-1">
            <Sel value={s.tax_on_price} onChange={v => set('tax_on_price', v)} options={[
              ['exclusive', 'Exclusive of GST'],
              ['inclusive', 'Inclusive of GST'],
            ]} />
            <p className="text-xs text-gray-400">
              {s.tax_on_price === 'inclusive'
                ? 'Selling price already includes GST — tax is back-calculated.'
                : 'GST is added on top of the selling price.'}
            </p>
          </div>
        </F>
      </Section>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Feature Flags</h3>
        <div className="flex flex-wrap gap-2">
          <Pill color={s.einvoice_enabled === 'true' ? 'green' : 'gray'}>
            <CheckCircle2 size={12} />
            E-Invoice {s.einvoice_enabled === 'true' ? 'enabled' : 'disabled'}
          </Pill>
          <Pill color={s.hsn_summary_on_invoice === 'true' ? 'blue' : 'gray'}>
            <Info size={12} />
            HSN summary on invoice {s.hsn_summary_on_invoice === 'true' ? 'on' : 'off'}
          </Pill>
          <Pill color="gray">
            <XCircle size={12} />
            Reverse charge {s.reverse_charge === 'true' ? 'on' : 'off'}
          </Pill>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {[
            ['einvoice_enabled', 'E-Invoice enabled'],
            ['hsn_summary_on_invoice', 'HSN summary on invoice'],
            ['reverse_charge', 'Reverse charge applicable'],
            ['cess_enabled', 'CESS handling'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={s[key] === 'true' || s[key] === true}
                onChange={e => set(key, String(e.target.checked))}
                className="rounded"
              />
              {label}
            </label>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 3.4 Payment Settings
// ══════════════════════════════════════════════════════════════════════════════
function PaymentTab({ s, set }) {
  return (
    <div className="space-y-4">
      <Section title="Payment Defaults">
        <F label="Default Payment Mode">
          <Sel value={s.default_payment_method} onChange={v => set('default_payment_method', v)} options={[
            ['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card'], ['credit', 'Credit'],
          ]} />
        </F>
        <F label="Round Off Total">
          <Sel value={s.round_off} onChange={v => set('round_off', v)} options={[
            ['nearest', 'Nearest rupee'],
            ['none', 'No round off'],
          ]} />
        </F>
        <F label="Credit Limit Alert">
          <Inp value={s.credit_limit_alert} onChange={v => set('credit_limit_alert', v)} placeholder="₹50,000" />
        </F>
        <F label="UPI ID">
          <Inp value={s.shop_upi_id} onChange={v => set('shop_upi_id', v)} placeholder="balajitraders@okhdfcbank" />
        </F>
        <F label="Bank Account Details" full>
          <Inp value={s.shop_bank_details} onChange={v => set('shop_bank_details', v)} placeholder="HDFC Bank · A/C 5012 3456 7890 · IFSC HDFC0001234" />
        </F>
      </Section>

      <Section title="Options">
        {[
          ['show_upi_qr_on_invoice', 'Show UPI QR on invoice'],
          ['show_upi_qr_on_thermal', 'Show UPI QR on thermal receipt'],
          ['advance_payment_enabled', 'Allow advance payment'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={s[key] === 'true' || s[key] === true}
              onChange={e => set(key, String(e.target.checked))}
              className="rounded"
            />
            {label}
          </label>
        ))}
      </Section>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// 3.5 Printer Settings
// ══════════════════════════════════════════════════════════════════════════════
function PrinterTab({ s, set }) {
  return (
    <div className="space-y-4">
      <Section title="Printer Configuration">
        <F label="Printer Type">
          <Sel value={s.printer_type} onChange={v => set('printer_type', v)} options={[
            ['thermal_80', 'Thermal 80mm'],
            ['thermal_58', 'Thermal 58mm'],
            ['a4', 'A4 Laser / Inkjet'],
          ]} />
        </F>
        <F label="Default Printer">
          <Inp value={s.default_printer} onChange={v => set('default_printer', v)} placeholder="EPSON TM-T82 (Counter 1)" />
        </F>
        <F label="Copies per Bill">
          <Inp value={s.copies_per_bill} onChange={v => set('copies_per_bill', v)} type="number" placeholder="2" />
        </F>
        <F label="Auto Print After Save">
          <Sel value={s.auto_print} onChange={v => set('auto_print', v)} options={[
            ['yes', 'Yes'], ['no', 'No'],
          ]} />
        </F>
        <F label="Receipt Footer Text" full>
          <Inp value={s.receipt_footer} onChange={v => set('receipt_footer', v)} placeholder="Thank you for shopping with us!" />
        </F>
      </Section>

      <Section title="Options">
        {[
          ['open_cash_drawer', 'Open cash drawer on print'],
          ['print_duplicate', 'Print duplicate copy automatically'],
        ].map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={s[key] === 'true' || s[key] === true}
              onChange={e => set(key, String(e.target.checked))}
              className="rounded"
            />
            {label}
          </label>
        ))}
        <div className="sm:col-span-2 pt-1">
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => toast('Test print sent to printer', { icon: '🖨️' })}
          >
            🖨️ Send Test Print
          </button>
        </div>
      </Section>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// Root
// ══════════════════════════════════════════════════════════════════════════════
export default function Settings() {
  const [tab, setTab] = useState('business')
  const [s, setS] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    api.get('/settings/all/').then(r => setS(r.data)).finally(() => setLoading(false))
  }, [])

  const set = (key, value) => setS(p => ({ ...p, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      await api.post('/settings/bulk_update/', s)
      toast.success('Settings saved')
      window.dispatchEvent(new CustomEvent('shop-settings-updated', { detail: s }))
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const uploadLogo = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const { data } = await api.post('/settings/upload-logo/', fd)
      const urlWithBust = data.url + '?t=' + Date.now()
      setS(p => ({ ...p, shop_logo: urlWithBust }))
      window.dispatchEvent(new CustomEvent('shop-settings-updated', { detail: { shop_logo: urlWithBust } }))
      toast.success('Logo uploaded')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  const tabProps = { s, set }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure your business, invoicing, GST, payments and printer"
        action={
          <button onClick={save} disabled={saving} className="btn-primary px-5">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        }
      />

      <div className="grid lg:grid-cols-[14rem_minmax(0,1fr)] gap-5">
        {/* Left nav */}
        <Card className="p-1.5 h-max">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                tab === id
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={16} className="flex-shrink-0" />
              {label}
            </button>
          ))}
        </Card>

        {/* Right content */}
        <div className="min-w-0">
          {tab === 'business' && <BusinessTab {...tabProps} onLogoUpload={uploadLogo} uploading={uploading} />}
          {tab === 'invoice'  && <InvoiceTab  {...tabProps} />}
          {tab === 'gst'      && <GstTab      {...tabProps} />}
          {tab === 'payment'  && <PaymentTab  {...tabProps} />}
          {tab === 'printer'  && <PrinterTab  {...tabProps} />}
        </div>
      </div>
    </div>
  )
}
