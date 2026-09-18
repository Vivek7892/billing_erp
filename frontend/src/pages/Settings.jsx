import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { Card, PageHeader } from '../components/UI'
import toast from 'react-hot-toast'
import { Building2, FileText, Percent, CreditCard, Printer, Upload, CheckCircle2, Trash2, ImageIcon, Eye } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

function F({ label, children, full, hint }) {
  return (
    <div className={`${full ? 'sm:col-span-2' : ''} min-w-0`}>
      <label className="block mb-1.5 text-xs font-semibold tracking-wide text-slate-600">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-[11px] leading-4 text-slate-400">{hint}</p>}
    </div>
  )
}

function Inp({ value, onChange, mono, maxLength, type = 'text', placeholder }) {
  return (
    <input
      type={type}
      className={`w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300 ${mono ? 'font-mono tracking-tight' : ''}`}
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
      className="w-full min-h-11 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

function Txt({ value, onChange, rows = 3, placeholder }) {
  return (
    <textarea
      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-5 text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300 resize-y"
      rows={rows}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )
}

const TABS = [
  { id: 'business', label: 'Business Profile', Icon: Building2 },
  { id: 'invoice',  label: 'Invoice Settings', Icon: FileText },
  { id: 'gst',      label: 'GST Settings',     Icon: Percent },
  { id: 'payment',  label: 'Payment Settings', Icon: CreditCard },
  { id: 'printer',  label: 'Printer Settings', Icon: Printer },
  { id: 'preview',  label: 'Bill Preview',     Icon: Eye },
]

function Section({ title, description, children }) {
  return (
    <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3.5 sm:px-5">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {description && <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{description}</p>}
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">{children}</div>
    </Card>
  )
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="group flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition-all hover:border-indigo-200 hover:bg-indigo-50/40">
      <span className="relative mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-slate-300 transition-colors peer-checked:bg-indigo-600 peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-500/20" />
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {description && <span className="mt-0.5 block text-[11px] leading-4 text-slate-400">{description}</span>}
      </span>
    </label>
  )
}

// ── Business Profile ─────────────────────────────────────────────────────────
function BusinessTab({ s, set, onLogoUpload, onLogoRemove, uploading, removing }) {
  const fileRef = useRef()
  const [localPreview, setLocalPreview] = useState(null)
  const [fileInfo, setFileInfo] = useState(null)

  const previewUrl = localPreview || s.shop_logo || null

  useEffect(() => {
    if (!uploading && s.shop_logo) { setLocalPreview(null); setFileInfo(null) }
  }, [uploading, s.shop_logo])

  const handleFileChange = e => {
    const file = e.target.files?.[0]
    if (!file) return
    setLocalPreview(URL.createObjectURL(file))
    setFileInfo({ name: file.name, size: (file.size / 1024).toFixed(1) + ' KB' })
    onLogoUpload(e)
  }

  const handleRemove = () => {
    setLocalPreview(null); setFileInfo(null)
    if (fileRef.current) fileRef.current.value = ''
    onLogoRemove()
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50 via-white to-white px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <ImageIcon size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Business Logo</h3>
              <p className="text-[11px] text-slate-500">Used on invoices, receipts and reports</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-5 p-4 sm:flex-row sm:p-5">
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div
              onClick={() => fileRef.current?.click()}
              className="w-32 h-32 rounded-xl border border-[var(--line)] bg-white flex flex-col items-center justify-center overflow-hidden cursor-pointer hover:border-[var(--muted-light)] transition-colors group relative"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="Shop logo" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-[var(--muted-light)]">
                  <ImageIcon size={28} />
                  <span className="text-xs">No logo</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                <Upload size={20} className="text-white" />
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-400">Tap image to change</span>
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-0.5">Shop / Brand Logo</p>
              <p className="text-xs text-slate-500">PNG · JPG · WEBP · Square recommended · Max 2 MB</p>
              <p className="text-xs text-slate-400 mt-0.5">Keep the logo simple for clear printing.</p>
            </div>

            {fileInfo && (
              <div className="flex items-center gap-2 bg-[var(--surface-elevated)] border border-[var(--line)] rounded-lg px-3 py-2">
                <CheckCircle2 size={14} className="text-[var(--muted)] flex-shrink-0" />
                <span className="text-xs text-[var(--ink-secondary)] truncate">{fileInfo.name}</span>
                <span className="text-xs text-[var(--muted)] flex-shrink-0">{fileInfo.size}</span>
              </div>
            )}

            {uploading && (
              <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <div className="w-3.5 h-3.5 border-2 border-[var(--line)] border-t-[var(--muted)] rounded-full animate-spin" />
                Uploading…
              </div>
            )}

            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary btn-sm gap-1.5">
                <Upload size={13} /> {previewUrl ? 'Change logo' : 'Upload logo'}
              </button>
              {previewUrl && (
                <button type="button" onClick={handleRemove} disabled={removing} className="btn-secondary btn-sm gap-1.5">
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

      <Section title="Business Details" description="Basic information shown across your billing documents.">
        <F label="Business Name"><Inp value={s.shop_name} onChange={v => set('shop_name', v)} placeholder="Sri Balaji Store" /></F>
        <F label="Business Type">
          <Sel value={s.business_type} onChange={v => set('business_type', v)} options={[
            ['retail_wholesale', 'Retail & Wholesale'],
            ['manufacturing', 'Manufacturing'],
            ['services', 'Services'],
          ]} />
        </F>
        <F label="GSTIN"><Inp value={s.shop_gstin} onChange={v => set('shop_gstin', v)} maxLength={15} mono placeholder="23AABCS1429B1ZP" /></F>
        <F label="Phone"><Inp value={s.shop_phone} onChange={v => set('shop_phone', v)} placeholder="+91 98765 43210" /></F>
        <F label="Email"><Inp value={s.shop_email} onChange={v => set('shop_email', v)} type="email" placeholder="billing@store.in" /></F>
        <F label="State"><Inp value={s.shop_state} onChange={v => set('shop_state', v)} placeholder="Madhya Pradesh" /></F>
        <F label="Business Address" full><Txt value={s.shop_address} onChange={v => set('shop_address', v)} placeholder="Shop no., Street, City, PIN" /></F>
      </Section>

      <Section title="Optional Identifiers" description="Additional business details used when required.">
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

// ── Invoice Settings ─────────────────────────────────────────────────────────
function InvoiceTab({ s, set }) {
  return (
    <div className="space-y-4">
      <Section title="Numbering" description="Control invoice numbering and document defaults.">
        <F label="Invoice Prefix"><Inp value={s.invoice_prefix} onChange={v => set('invoice_prefix', v)} placeholder="INV-2026-" /></F>
        <F label="Next Invoice Number">
          <Inp value={s.invoice_start_number} onChange={v => set('invoice_start_number', v)} mono placeholder="0149" />
          <p className="mt-1 text-xs text-[var(--muted-light)]">Advances automatically after each saved invoice.</p>
        </F>
        <F label="Invoice Template">
          <Sel value={s.invoice_template} onChange={v => set('invoice_template', v)} options={[
            ['gst_a4', 'GST Tax Invoice (A4)'],
            ['thermal_80', 'Thermal Receipt (80mm)'],
          ]} />
        </F>
        <F label="Default Due Days"><Inp value={s.invoice_due_days} onChange={v => set('invoice_due_days', v)} type="number" placeholder="15" /></F>
      </Section>

      <Section title="Appearance" description="Choose how your printed invoices are structured.">
        <F label="Invoice Font">
          <Sel value={s.invoice_font || 'default'} onChange={v => set('invoice_font', v)} options={[
            ['default', 'Default (Helvetica)'],
            ['dejavu', 'DejaVu Sans (Unicode)'],
            ['courier', 'Courier (Monospace)'],
          ]} />
          <p className="mt-1 text-xs text-[var(--muted-light)]">DejaVu supports ₹ and regional characters.</p>
        </F>
        <F label="Header Layout">
          <Sel value={s.invoice_header_layout || 'logo_left'} onChange={v => set('invoice_header_layout', v)} options={[
            ['logo_left', 'Logo left · Business name right'],
            ['name_only', 'Business name only (no logo)'],
          ]} />
        </F>
        <F label="Footer Layout">
          <Sel value={s.invoice_footer_layout || 'text_center'} onChange={v => set('invoice_footer_layout', v)} options={[
            ['text_center', 'Footer text centered'],
            ['text_left', 'Footer text left-aligned'],
            ['none', 'No footer'],
          ]} />
        </F>
        <F label="Paper Size">
          <Sel value={s.invoice_paper_size || 'a4'} onChange={v => set('invoice_paper_size', v)} options={[
            ['a4', 'A4 (210 × 297 mm)'],
            ['letter', 'US Letter (216 × 279 mm)'],
            ['a5', 'A5 (148 × 210 mm)'],
          ]} />
        </F>
      </Section>

      <Section title="Content" description="Add the standard text printed on each invoice.">
        <F label="Terms & Conditions" full>
          <Txt value={s.invoice_terms} onChange={v => set('invoice_terms', v)} rows={4}
            placeholder={`1. Goods once sold will not be returned.\n2. Payment due within 15 days.`} />
        </F>
        <F label="Invoice Footer Text" full>
          <Inp value={s.invoice_footer} onChange={v => set('invoice_footer', v)} placeholder="Thank you for your business!" />
        </F>
      </Section>

      <Section title="Show / Hide Columns" description="Keep only the columns your customers need to see.">
        {[
          ['show_discount_col', 'Discount column'],
          ['show_hsn_col', 'HSN / SAC column'],
          ['show_batch_col', 'Batch number'],
          ['show_expiry_col', 'Expiry date'],
        ].map(([key, label]) => (
          <Toggle
            key={key}
            checked={s[key] === 'true' || s[key] === true}
            onChange={e => set(key, String(e.target.checked))}
            label={label}
          />
        ))}
      </Section>

      <Section title="Additional Options" description="Extra fields and sections printed on the invoice.">
        {[
          ['show_signature_area', 'Signature area (Prepared by / Authorised Signatory)', 'Adds a signature strip at the bottom of A4 invoices.'],
          ['show_fssai_on_invoice', 'Print FSSAI licence number', 'Shown in the business header when a licence is configured.'],
          ['show_cin_on_invoice', 'Print CIN number', 'Shown in the business header when a CIN is configured.'],
        ].map(([key, label, desc]) => (
          <Toggle key={key} checked={s[key] === 'true' || s[key] === true}
            onChange={e => set(key, String(e.target.checked))}
            label={label} description={desc} />
        ))}
        <F label="Invoice Notes" full>
          <Txt value={s.invoice_notes} onChange={v => set('invoice_notes', v)} rows={2}
            placeholder="e.g. Subject to jurisdiction of local courts only." />
          <p className="mt-1 text-xs text-[var(--muted-light)]">Printed above Terms &amp; Conditions on every invoice.</p>
        </F>
      </Section>

      <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-[11px] font-700 uppercase tracking-widest text-[var(--muted)] mb-4">UPI QR on Invoice</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="UPI ID">
            <Inp value={s.shop_upi_id} onChange={v => set('shop_upi_id', v)} placeholder="balajitraders@okhdfcbank" />
            <p className="mt-1 text-xs text-[var(--muted-light)]">Printed as a scannable QR on the invoice.</p>
          </F>
          <F label="UPI Merchant Name"><Inp value={s.upi_merchant_name} onChange={v => set('upi_merchant_name', v)} placeholder="Balaji Traders" /></F>
          <F label="QR Size on A4">
            <Sel value={s.upi_qr_size_a4 || 'medium'} onChange={v => set('upi_qr_size_a4', v)} options={[
              ['small', 'Small (18mm)'], ['medium', 'Medium (22mm)'], ['large', 'Large (28mm)'],
            ]} />
          </F>
          <F label="QR Size on Thermal">
            <Sel value={s.upi_qr_size_thermal || 'medium'} onChange={v => set('upi_qr_size_thermal', v)} options={[
              ['small', 'Small (20mm)'], ['medium', 'Medium (28mm)'], ['large', 'Large (36mm)'],
            ]} />
          </F>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2">
            {[
              ['show_upi_qr_on_invoice', 'Show QR on A4 invoice'],
              ['show_upi_qr_on_thermal', 'Show QR on thermal receipt'],
            ].map(([key, label]) => (
              <Toggle
                key={key}
                checked={s[key] === 'true' || s[key] === true}
                onChange={e => set(key, String(e.target.checked))}
                label={label}
              />
            ))}
          </div>
          {s.shop_upi_id && (
            <div className="sm:col-span-2 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="w-9 h-9 bg-white rounded-lg border border-[var(--line)] flex items-center justify-center shrink-0">
                <span className="text-base">📱</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--ink-secondary)]">UPI configured</p>
                <p className="text-xs text-[var(--muted)] font-mono">{s.shop_upi_id}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-5">
          <h3 className="text-sm font-bold text-slate-800">Invoice Preview</h3>
          <p className="mt-0.5 text-xs text-slate-500">Live sample — updates as you change settings above.</p>
        </div>
        <div className="p-4 sm:p-5">
        <BillPreviewTab s={s} embedded />
        </div>
      </Card>
    </div>
  )
}

// ── GST Settings ─────────────────────────────────────────────────────────────
function GstTab({ s, set }) {
  return (
    <div className="space-y-4">
      <Section title="Registration" description="Configure GST registration and tax calculation defaults.">
        <F label="GST Registration Type">
          <Sel value={s.gst_reg_type} onChange={v => set('gst_reg_type', v)} options={[
            ['regular', 'Regular'], ['composition', 'Composition'], ['unregistered', 'Unregistered'],
          ]} />
        </F>
        <F label="Default GST Rate">
          <Sel value={s.default_gst_rate} onChange={v => set('default_gst_rate', v)} options={[
            ['0', '0%'], ['5', '5%'], ['12', '12%'], ['18', '18%'], ['28', '28%'],
          ]} />
        </F>
        <F label="Place of Supply"><Inp value={s.place_of_supply} onChange={v => set('place_of_supply', v)} placeholder="Madhya Pradesh (23)" /></F>
        <F label="Tax on Price">
          <Sel value={s.tax_on_price} onChange={v => set('tax_on_price', v)} options={[
            ['exclusive', 'Exclusive of GST'], ['inclusive', 'Inclusive of GST'],
          ]} />
          <p className="mt-1 text-xs text-[var(--muted-light)]">
            {s.tax_on_price === 'inclusive' ? 'Tax is back-calculated from the selling price.' : 'GST is added on top of the selling price.'}
          </p>
        </F>
      </Section>

      <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-[11px] font-700 uppercase tracking-widest text-[var(--muted)] mb-4">Feature Flags</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            ['einvoice_enabled', 'E-Invoice enabled'],
            ['hsn_summary_on_invoice', 'HSN summary on invoice'],
            ['reverse_charge', 'Reverse charge applicable'],
            ['cess_enabled', 'CESS handling'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-[var(--ink-secondary)] cursor-pointer">
              <input type="checkbox" checked={s[key] === 'true' || s[key] === true}
                onChange={e => set(key, String(e.target.checked))} className="rounded" />
              {label}
            </label>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ── Payment Settings ──────────────────────────────────────────────────────────
function PaymentTab({ s, set }) {
  return (
    <div className="space-y-4">
      <Section title="Payment Defaults" description="Set the payment information used by default on new bills.">
        <F label="Default Payment Mode">
          <Sel value={s.default_payment_method} onChange={v => set('default_payment_method', v)} options={[
            ['cash', 'Cash'], ['upi', 'UPI'], ['card', 'Card'], ['credit', 'Credit'],
          ]} />
        </F>
        <F label="Round Off Total">
          <Sel value={s.round_off} onChange={v => set('round_off', v)} options={[
            ['nearest', 'Nearest rupee'], ['none', 'No round off'],
          ]} />
        </F>
        <F label="Credit Limit Alert"><Inp value={s.credit_limit_alert} onChange={v => set('credit_limit_alert', v)} placeholder="₹50,000" /></F>
        <F label="UPI ID"><Inp value={s.shop_upi_id} onChange={v => set('shop_upi_id', v)} placeholder="balajitraders@okhdfcbank" /></F>
        <F label="Bank Account Details" full>
          <Inp value={s.shop_bank_details} onChange={v => set('shop_bank_details', v)} placeholder="HDFC Bank · A/C 5012 3456 7890 · IFSC HDFC0001234" />
        </F>
      </Section>
      <Section title="Options" description="Enable or disable optional billing behaviour.">
        {[
          ['show_upi_qr_on_invoice', 'Show UPI QR on invoice'],
          ['show_upi_qr_on_thermal', 'Show UPI QR on thermal receipt'],
          ['advance_payment_enabled', 'Allow advance payment'],
        ].map(([key, label]) => (
          <Toggle
            key={key}
            checked={s[key] === 'true' || s[key] === true}
            onChange={e => set(key, String(e.target.checked))}
            label={label}
          />
        ))}
      </Section>
    </div>
  )
}

// ── Printer Settings ──────────────────────────────────────────────────────────
function PrinterTab({ s, set }) {
  return (
    <div className="space-y-4">
      <Section title="Printer Configuration" description="Configure your counter printer and automatic printing.">
        <F label="Printer Type">
          <Sel value={s.printer_type} onChange={v => set('printer_type', v)} options={[
            ['thermal_80', 'Thermal 80mm'], ['a4', 'A4 Laser / Inkjet'],
          ]} />
        </F>
        <F label="Default Printer"><Inp value={s.default_printer} onChange={v => set('default_printer', v)} placeholder="EPSON TM-T82 (Counter 1)" /></F>
        <F label="Copies per Bill"><Inp value={s.copies_per_bill} onChange={v => set('copies_per_bill', v)} type="number" placeholder="2" /></F>
        <F label="Auto Print After Save">
          <Sel value={s.auto_print} onChange={v => set('auto_print', v)} options={[['yes', 'Yes'], ['no', 'No']]} />
        </F>
        <F label="Receipt Footer Text" full>
          <Inp value={s.invoice_footer} onChange={v => set('invoice_footer', v)} placeholder="Thank you for shopping with us!" />
          <p className="mt-1 text-xs text-[var(--muted-light)]">Shared with Invoice Settings — used on both A4 and thermal.</p>
        </F>
      </Section>
      <Section title="Options" description="Enable or disable optional billing behaviour.">
        {[
          ['open_cash_drawer', 'Open cash drawer on print'],
          ['print_duplicate', 'Print duplicate copy automatically'],
        ].map(([key, label]) => (
          <Toggle
            key={key}
            checked={s[key] === 'true' || s[key] === true}
            onChange={e => set(key, String(e.target.checked))}
            label={label}
          />
        ))}
        <div className="sm:col-span-2 pt-1">
          <button type="button" className="btn-secondary btn-sm"
            onClick={() => toast('Test print sent to printer', { icon: '🖨️' })}>
            🖨️ Send Test Print
          </button>
        </div>
      </Section>
    </div>
  )
}

// ── Bill Preview ──────────────────────────────────────────────────────────────
const DEMO_ITEMS = [
  { name: 'Basmati Rice 5kg', hsn: '1006', qty: 2, rate: 320, gst: 5, disc: 0 },
  { name: 'Sunflower Oil 1L',  hsn: '1512', qty: 3, rate: 145, gst: 5, disc: 5 },
  { name: 'Toor Dal 1kg',      hsn: '0713', qty: 4, rate: 110, gst: 0, disc: 0 },
]

function BillPreviewTab({ s, embedded = false }) {
  const selectedMode = s.invoice_template === 'thermal_80' ? 'thermal' : 'a4'
  const [mode, setMode] = useState(selectedMode)
  useEffect(() => setMode(selectedMode), [selectedMode])

  const items = DEMO_ITEMS.map(i => {
    const basic = i.rate * i.qty * (1 - i.disc / 100)
    const gst = basic * i.gst / 100
    return { ...i, basic, gst, total: basic + gst }
  })
  const subtotal  = items.reduce((a, i) => a + i.basic, 0)
  const totalGst  = items.reduce((a, i) => a + i.gst, 0)
  const grand     = subtotal + totalGst
  const fmt       = v => `Rs.${Number(v).toFixed(2)}`
  const today     = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const showHsn  = s.show_hsn_col  === 'true' || s.show_hsn_col  === true
  const showDisc = s.show_discount_col === 'true' || s.show_discount_col === true
  const showGst  = s.gst_reg_type !== 'unregistered'
  const invoiceNo    = `${s.invoice_prefix || 'INV-'}${s.invoice_start_number || '0001'}`
  const shopName     = s.shop_name    || 'Your Business Name'
  const address      = s.shop_address || '123, Main Street, City - 400001'
  const phone        = s.shop_phone   || '+91 98765 43210'
  const gstin        = s.shop_gstin   || '23AABCS1429B1ZP'
  const footer       = s.invoice_footer || 'Thank you for your business!'
  const terms        = s.invoice_terms  || '1. Goods once sold will not be returned.\n2. Payment due within 15 days.'
  const upiId        = s.shop_upi_id
  const showUpiA4    = (s.show_upi_qr_on_invoice === 'true' || s.show_upi_qr_on_invoice === true) && upiId
  const showUpiThermal = (s.show_upi_qr_on_thermal === 'true' || s.show_upi_qr_on_thermal === true) && upiId
  const showSignature  = s.show_signature_area === 'true' || s.show_signature_area === true
  const showFssai      = (s.show_fssai_on_invoice === 'true' || s.show_fssai_on_invoice === true) && s.fssai_licence
  const showCin        = (s.show_cin_on_invoice === 'true' || s.show_cin_on_invoice === true) && s.cin
  const footerLayout = s.invoice_footer_layout || 'text_center'
  const headerLayout = s.invoice_header_layout || 'logo_left'
  const a4Font = s.invoice_font === 'courier' ? 'Courier New, monospace' : 'Helvetica, Arial, sans-serif'
  const qrSize = mode === 'thermal'
    ? ({ small: 76, medium: 106, large: 136 }[s.upi_qr_size_thermal] || 106)
    : ({ small: 68, medium: 83,  large: 106 }[s.upi_qr_size_a4]      || 83)
  const qrValue = `upi://pay?pa=${encodeURIComponent(upiId || '')}&pn=${encodeURIComponent(shopName)}&am=${grand.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoiceNo)}`

  const modePicker = (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {['a4', 'thermal'].map(m => (
        <button key={m} type="button" onClick={() => setMode(m)}
          className={`min-h-10 rounded-xl border px-3.5 text-xs font-semibold transition-all ${
            mode === m
              ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/50'
          }`}>
          {m === 'a4' ? 'A4 Invoice' : 'Thermal Receipt'}
        </button>
      ))}
      <span className="text-xs text-[var(--muted-light)]">Live preview · sample data</span>
    </div>
  )

  if (mode === 'thermal') {
    return (
      <div>
        {modePicker}
        <div className="flex justify-center">
          <div className="bg-white text-black shadow border border-gray-200"
            style={{ width: 302, fontFamily: 'Courier New, monospace', fontSize: 11, padding: '12px 10px' }}>
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 13, marginBottom: 2 }}>{shopName.toUpperCase()}</div>
            {address.split('\n').map((l, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10 }}>{l}</div>)}
            <div style={{ textAlign: 'center', fontSize: 10 }}>Ph: {phone}</div>
            {gstin && <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 10 }}>GSTIN: {gstin}</div>}
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <div style={{ textAlign: 'center', fontWeight: 'bold' }}>TAX INVOICE</div>
            <div style={{ textAlign: 'center', fontSize: 10 }}>{invoiceNo}</div>
            <div style={{ textAlign: 'center', fontSize: 10 }}>Date: {today}</div>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <div style={{ fontSize: 10, fontWeight: 'bold' }}>CUSTOMER: Walk-in Customer</div>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <th style={{ textAlign: 'left', paddingBottom: 3 }}>ITEM</th>
                  <th style={{ textAlign: 'right' }}>QTY</th>
                  <th style={{ textAlign: 'right' }}>RATE</th>
                  <th style={{ textAlign: 'right' }}>AMT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px dotted #ccc' }}>
                    <td style={{ paddingTop: 2, paddingBottom: 2 }}>{item.name}</td>
                    <td style={{ textAlign: 'right' }}>{item.qty}</td>
                    <td style={{ textAlign: 'right' }}>{item.rate}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{fmt(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}><span>SUBTOTAL</span><span>{fmt(subtotal)}</span></div>
            {showGst && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}><span>GST</span><span>{fmt(totalGst)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 13, marginTop: 4 }}><span>GRAND TOTAL</span><span>{fmt(grand)}</span></div>
            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
            {showUpiThermal && (
              <>
                <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 'bold', marginBottom: 4 }}>SCAN TO PAY</div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}><QRCodeSVG value={qrValue} size={qrSize} /></div>
                <div style={{ textAlign: 'center', fontSize: 10, marginBottom: 4 }}>{upiId}</div>
              </>
            )}
            <div style={{ textAlign: 'center', fontSize: 10, marginTop: 4 }}>{footer}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {modePicker}
      <div className="overflow-x-auto">
        <div className="bg-white text-black shadow border border-gray-200 mx-auto"
          style={{ width: 794, minHeight: 500, fontFamily: a4Font, fontSize: 12, padding: '24px 28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              {headerLayout !== 'name_only' && s.shop_logo && (
                <img src={s.shop_logo} alt="logo" style={{ height: 48, marginBottom: 6, objectFit: 'contain' }} />
              )}
              <div style={{ fontWeight: 'bold', fontSize: 16, textTransform: 'uppercase' }}>{shopName}</div>
              {address.split('\n').map((l, i) => <div key={i} style={{ fontSize: 10, color: '#444' }}>{l}</div>)}
              <div style={{ fontSize: 10, color: '#444' }}>Mobile: {phone}{s.shop_email ? ` | Email: ${s.shop_email}` : ''}</div>
              {gstin && <div style={{ fontSize: 10, color: '#444' }}>GSTIN: {gstin}{s.shop_pan ? ` | PAN: ${s.shop_pan}` : ''}{showFssai ? ` | FSSAI: ${s.fssai_licence}` : ''}{showCin ? ` | CIN: ${s.cin}` : ''}</div>}
            </div>
            <div style={{ textAlign: 'right', minWidth: 200 }}>
              <div style={{ fontWeight: 'bold', fontSize: 18 }}>TAX INVOICE</div>
              <div style={{ fontSize: 11, fontWeight: 'bold', marginTop: 4 }}>Invoice No: {invoiceNo}</div>
              <div style={{ fontSize: 10, color: '#444' }}>Invoice Date: {today}</div>
              <div style={{ fontSize: 10, color: '#444' }}>Payment Mode: CASH</div>
            </div>
          </div>
          <div style={{ borderTop: '1.5px solid #000', marginBottom: 10 }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 2 }}>BILL TO</div>
              <div style={{ fontWeight: 'bold', fontSize: 13 }}>Walk-in Customer</div>
              <div style={{ fontSize: 10, color: '#444' }}>Mobile: +91 99999 00000</div>
            </div>
            {showUpiA4 && (
              <div style={{ textAlign: 'center', fontSize: 10 }}>
                <div style={{ fontWeight: 'bold', marginBottom: 2 }}>UPI PAYMENT</div>
                <QRCodeSVG value={qrValue} size={qrSize} />
                <div style={{ marginTop: 2 }}>SCAN TO PAY</div>
              </div>
            )}
          </div>
          <div style={{ borderTop: '0.8px solid #000', marginBottom: 8 }} />

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ borderTop: '1px solid #000', borderBottom: '1px solid #000', background: '#f9f9f9' }}>
                <th style={{ textAlign: 'left', padding: '5px 4px', fontSize: 10 }}>S.No</th>
                <th style={{ textAlign: 'left', padding: '5px 4px', fontSize: 10 }}>Item Description</th>
                {showHsn && <th style={{ textAlign: 'center', padding: '5px 4px', fontSize: 10 }}>HSN/SAC</th>}
                <th style={{ textAlign: 'center', padding: '5px 4px', fontSize: 10 }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '5px 4px', fontSize: 10 }}>Rate</th>
                {showDisc && <th style={{ textAlign: 'right', padding: '5px 4px', fontSize: 10 }}>Disc.</th>}
                {showGst && <th style={{ textAlign: 'right', padding: '5px 4px', fontSize: 10 }}>SGST</th>}
                {showGst && <th style={{ textAlign: 'right', padding: '5px 4px', fontSize: 10 }}>CGST</th>}
                <th style={{ textAlign: 'right', padding: '5px 4px', fontSize: 10 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '0.3px solid #ddd' }}>
                  <td style={{ padding: '4px', textAlign: 'center', fontSize: 10, color: '#666' }}>{i + 1}</td>
                  <td style={{ padding: '4px', fontSize: 11 }}>{item.name}</td>
                  {showHsn && <td style={{ padding: '4px', textAlign: 'center', fontSize: 10, color: '#666' }}>{item.hsn}</td>}
                  <td style={{ padding: '4px', textAlign: 'center' }}>{item.qty}</td>
                  <td style={{ padding: '4px', textAlign: 'right' }}>{fmt(item.rate)}</td>
                  {showDisc && <td style={{ padding: '4px', textAlign: 'right', fontSize: 10, color: '#666' }}>{item.disc}%</td>}
                  {showGst && <td style={{ padding: '4px', textAlign: 'right', fontSize: 10, color: '#666' }}>{fmt(item.gst / 2)}</td>}
                  {showGst && <td style={{ padding: '4px', textAlign: 'right', fontSize: 10, color: '#666' }}>{fmt(item.gst / 2)}</td>}
                  <td style={{ padding: '4px', textAlign: 'right', fontWeight: 'bold' }}>{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <div style={{ fontSize: 10, color: '#555', maxWidth: 340 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 2 }}>Amount in Words</div>
              <div>Rupees {Math.floor(grand)} Only</div>
              {terms && <div style={{ marginTop: 8, fontSize: 9, color: '#777' }}>
                <b>Terms &amp; Conditions</b><br />
                {terms.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}
              </div>}
            </div>
            <div style={{ minWidth: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}><span>Sub Total</span><span>{fmt(subtotal)}</span></div>
              {showGst && <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}><span>SGST</span><span>{fmt(totalGst / 2)}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 11 }}><span>CGST</span><span>{fmt(totalGst / 2)}</span></div>
              </>}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontWeight: 'bold', fontSize: 14, borderTop: '1px solid #000', marginTop: 4 }}>
                <span>GRAND TOTAL</span><span>{fmt(grand)}</span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '0.8px solid #000', marginTop: 10, paddingTop: 6, display: 'flex', gap: 24, fontSize: 10 }}>
            <div><b>PAYMENT STATUS</b><br />PAID</div>
            <div><b>AMOUNT PAID</b><br />{fmt(grand)}</div>
            <div><b>BALANCE DUE</b><br />{fmt(0)}</div>
            <div><b>MODE</b><br />CASH</div>
          </div>

          {footerLayout !== 'none' && (
            <div style={{ borderTop: '0.8px solid #000', marginTop: 10, paddingTop: 6, textAlign: footerLayout === 'text_left' ? 'left' : 'center', fontSize: 10, color: '#555' }}>
              <b>{footer.toUpperCase()}</b>
              <div style={{ marginTop: 2, fontSize: 9 }}>Date: {today} | Bill Ref: {invoiceNo}</div>
            </div>
          )}

          {showSignature && (
            <div style={{ borderTop: '0.8px solid #000', marginTop: 14, paddingTop: 18, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#555' }}>
              <span>Prepared by</span>
              <span>Checked by</span>
              <span>Authorised Signatory</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  const [tab, setTab] = useState('business')
  const [s, setS] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

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
    if (file.size > 2 * 1024 * 1024) { toast.error('Logo must be under 2 MB'); return }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const { data } = await api.post('/settings/upload-logo/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setS(p => ({ ...p, shop_logo: data.url }))
      window.dispatchEvent(new CustomEvent('shop-settings-updated', { detail: { shop_logo: data.url } }))
      toast.success('Logo uploaded')
    } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed') }
    finally { setUploading(false) }
  }

  const removeLogo = async () => {
    setRemoving(true)
    try {
      await api.post('/settings/remove-logo/')
      setS(p => ({ ...p, shop_logo: '' }))
      window.dispatchEvent(new CustomEvent('shop-settings-updated', { detail: { shop_logo: '' } }))
      toast.success('Logo removed')
    } catch (err) { toast.error(err.response?.data?.detail || 'Could not remove logo') }
    finally { setRemoving(false) }
  }

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center bg-slate-50/60">
      <div className="flex flex-col items-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
        <span className="text-xs font-medium text-slate-500">Loading settings…</span>
      </div>
    </div>
  )

  const tabProps = { s, set }

  return (
    <div className="min-h-full bg-slate-50/60 pb-24 lg:pb-8">
      <div className="mb-4 sm:mb-5">
        <PageHeader
          title="Settings"
          subtitle="Manage your business, invoices, GST, payments and printer"
          action={
            <button
              onClick={save}
              disabled={saving}
              className="hidden min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:flex"
            >
              {saving
                ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving…</>
                : 'Save Changes'}
            </button>
          }
        />
      </div>

      {/* Mobile: compact 2-column navigation. Desktop: vertical sidebar. */}
      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-5">
        <Card className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:sticky lg:top-4">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`group flex min-h-[58px] items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all sm:px-3 lg:min-h-11 ${
                  tab === id
                    ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-100'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
              >
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                  tab === id ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                }`}>
                  <Icon size={16} />
                </span>
                <span className="min-w-0 text-xs font-semibold leading-4 sm:text-sm">{label}</span>
              </button>
            ))}
          </div>
        </Card>

        <div className="min-w-0 space-y-4">
          {tab === 'business' && <BusinessTab {...tabProps} onLogoUpload={uploadLogo} onLogoRemove={removeLogo} uploading={uploading} removing={removing} />}
          {tab === 'invoice'  && <InvoiceTab  {...tabProps} />}
          {tab === 'gst'      && <GstTab      {...tabProps} />}
          {tab === 'payment'  && <PaymentTab  {...tabProps} />}
          {tab === 'printer'  && <PrinterTab  {...tabProps} />}
          {tab === 'preview'  && <BillPreviewTab s={s} />}
        </div>
      </div>

      {/* Always reachable on mobile. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden">
        <button
          onClick={save}
          disabled={saving}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving
            ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />Saving changes…</>
            : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
