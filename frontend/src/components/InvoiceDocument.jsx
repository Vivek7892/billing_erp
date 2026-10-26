import { useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import ThermalReceipt from './ThermalReceipt'

/**
 * Robust Indian numbering system converter to words:
 * e.g. 12500.50 -> "Rupees Twelve Thousand Five Hundred and Fifty Paise Only"
 */
export function numberToIndianWords(num) {
  const n = Number(num || 0)
  if (isNaN(n) || n === 0) return 'Rupees Zero Only'

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ]
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const convertTwoDigits = val => {
    if (val < 20) return ones[val]
    return tens[Math.floor(val / 10)] + (val % 10 !== 0 ? ' ' + ones[val % 10] : '')
  }

  const convertThreeDigits = val => {
    if (val === 0) return ''
    if (val < 100) return convertTwoDigits(val)
    const h = Math.floor(val / 100)
    const rem = val % 100
    return ones[h] + ' Hundred' + (rem > 0 ? ' ' + convertTwoDigits(rem) : '')
  }

  const integerPart = Math.floor(Math.abs(n))
  const paise = Math.round((Math.abs(n) - integerPart) * 100)

  if (integerPart === 0 && paise === 0) return 'Rupees Zero Only'

  let parts = []
  let crore = Math.floor(integerPart / 10000000)
  let lakh = Math.floor((integerPart % 10000000) / 100000)
  let thousand = Math.floor((integerPart % 100000) / 1000)
  let hundreds = integerPart % 1000

  if (crore > 0) parts.push(convertThreeDigits(crore) + ' Crore')
  if (lakh > 0) parts.push(convertThreeDigits(lakh) + ' Lakh')
  if (thousand > 0) parts.push(convertThreeDigits(thousand) + ' Thousand')
  if (hundreds > 0) parts.push(convertThreeDigits(hundreds))

  let words = 'Rupees ' + parts.join(' ')
  if (paise > 0) {
    words += (integerPart > 0 ? ' and ' : '') + convertTwoDigits(paise) + ' Paise'
  }
  return words + ' Only'
}

export function isTrue(val, defaultVal = true) {
  if (val === undefined || val === null || val === '') return defaultVal
  if (typeof val === 'boolean') return val
  const str = String(val).trim().toLowerCase()
  if (str === 'true' || str === '1' || str === 'yes' || str === 'on') return true
  if (str === 'false' || str === '0' || str === 'no' || str === 'off') return false
  return defaultVal
}

function InvoiceModePicker({ mode, onModeChange, settings = {} }) {
  const isHalfA4 = settings.invoice_template === 'half_a4' || settings.printer_type === 'half_a4'
  const isThermal58 = settings.printer_type === 'thermal_58' || settings.invoice_template === 'thermal_58'

  const sheetId = isHalfA4 ? 'half_a4' : 'a4'
  const sheetLabel = isHalfA4 ? 'Sheet Bill (Half-A4)' : 'Sheet Bill (A4)'

  const thermalId = isThermal58 ? 'thermal_58' : 'thermal_80'
  const thermalLabel = isThermal58 ? 'Thermal Receipt (58mm)' : 'Thermal Receipt (80mm)'

  const isSheetSel = mode === sheetId || (sheetId === 'a4' && (mode === 'gst_a4' || mode === 'stylish'))
  const isThermalSel = mode === thermalId || (thermalId === 'thermal_80' && (mode === 'thermal' || mode === 'thermal_80')) || (thermalId === 'thermal_58' && mode === 'thermal_58')

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
      <button
        type="button"
        onClick={() => onModeChange?.(sheetId)}
        className={`min-h-9 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          isSheetSel
            ? 'bg-[#1E3A5F] text-white shadow-xs'
            : 'border border-[#DCE3EC] bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        {sheetLabel}
      </button>

      <button
        type="button"
        onClick={() => onModeChange?.(thermalId)}
        className={`min-h-9 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
          isThermalSel
            ? 'bg-[#1E3A5F] text-white shadow-xs'
            : 'border border-[#DCE3EC] bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        {thermalLabel}
      </button>
    </div>
  )
}

export default function InvoiceDocument({
  invoice,
  settings = {},
  templateConfig = null,
  mode = 'a4',
  onModeChange,
  showModePicker = false,
  className = '',
}) {
  const s = settings || {}
  const inv = invoice || {}

  // Determine effective invoice mode
  const effectiveMode = useMemo(() => {
    if (mode === 'thermal' || mode === 'thermal_80' || mode === 'thermal_58') return 'thermal'
    if (mode === 'half_a4' || mode === 'a5' || mode === 'advanced_gst_a5' || mode === 'compact') return 'half_a4'
    if (mode === 'a4' || mode === 'gst_a4' || mode === 'classic' || mode === 'luxury' || mode === 'stylish' || mode === 'professional') return 'a4'
    if (s.invoice_template === 'thermal_80' || s.invoice_template === 'thermal_58' || s.invoice_template === 'thermal') return 'thermal'
    if (s.invoice_template === 'half_a4' || s.invoice_template === 'advanced_gst_a5' || s.invoice_template === 'compact') return 'half_a4'
    return 'a4'
  }, [mode, s.invoice_template])

  // Extract template configuration if provided or resolve from settings.template_settings
  const activeTplConfig = useMemo(() => {
    if (templateConfig && typeof templateConfig === 'object') return templateConfig
    if (s.template_settings && typeof s.template_settings === 'object') {
      const activeMap = s.active_templates || {}
      let targetId = mode
      if (mode === 'half_a4') targetId = activeMap.active_template_half_a4 || 'half_a4'
      else if (mode === 'thermal' || mode === 'thermal_80') targetId = activeMap.active_template_thermal || 'thermal_80'
      else if (mode === 'thermal_58') targetId = 'thermal_58'
      else if (mode === 'a4') targetId = activeMap.active_template_a4 || 'gst_a4'

      const templateSummary = s.template_settings
      const entry = Array.isArray(templateSummary.templates)
        ? templateSummary.templates.find(template => template.id === targetId || template.id === mode)
        : templateSummary[targetId] || templateSummary[mode]
      return entry?.config || null
    }
    return null
  }, [templateConfig, s, mode])

  const tBiz = activeTplConfig?.business_info || {}
  const tFields = activeTplConfig?.fields || {}
  const tLayout = activeTplConfig?.layout || {}
  const tTax = activeTplConfig?.tax || {}
  const tPayment = activeTplConfig?.payment || {}
  const tPage = activeTplConfig?.page || {}
  const accentColor = tLayout.accent_color || s.invoice_theme_color || '#1E3A5F'
  const secondaryColor = tLayout.secondary_color || s.invoice_theme_secondary || accentColor
  const invoiceBorderStyle = tLayout.border_style || s.invoice_border_style || 'solid'
  const invoiceTableStyle = tLayout.table_style || s.invoice_table_style || 'clean'

  // Currency formatter
  const fmt = val => `₹${Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Date formatter
  const formatDate = d => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

  // Business profile
  const rawShopName = tBiz.store_name_override || s.shop_name || ''
  const shopName = rawShopName || 'SRI BALAJI STORE'
  const shopAddress = tBiz.address_override || s.shop_address || ''
  const shopPhone = tBiz.phone_override || s.shop_phone || ''
  const shopEmail = tBiz.email_override || s.shop_email || ''
  const shopGstin = tBiz.gstin_override || s.shop_gstin || ''
  const shopPan = s.shop_pan || ''
  const shopLogo = s.shop_logo || ''
  const fssai = s.fssai_licence || ''
  const cin = s.cin || ''

  // Business display flags
  const showShopDetails = isTrue(
    tBiz.show_shop_details !== undefined ? tBiz.show_shop_details
      : tBiz.show_business_info !== undefined ? tBiz.show_business_info
        : s.show_shop_details !== undefined ? s.show_shop_details : s.show_business_info,
    true,
  )
  const templateShowName = tBiz.show_name !== undefined ? tBiz.show_name : tBiz.show_business_name
  const showShopName = showShopDetails
    && isTrue(s.show_business_name, true)
    && isTrue(s.show_shop_name, true)
    && isTrue(templateShowName, true)
    && Boolean(rawShopName || shopName)
  const showLogoSetting = isTrue(s.show_business_logo, true)
    && isTrue(tBiz.show_logo, true)
    && (effectiveMode !== 'thermal' || isTrue(s.thermal_show_logo, true))
  const showLogo = showShopDetails && showLogoSetting && Boolean(shopLogo)
    && (tBiz.header_layout || s.invoice_header_layout) !== 'name_only'
  const isCorporateA4 = effectiveMode === 'a4' && ((tBiz.header_layout || s.invoice_header_layout) === 'corporate_bar' || mode === 'professional' || mode === 'stylish' || s.invoice_template === 'professional' || s.invoice_template === 'stylish')
  const showAddress = showShopDetails && (tBiz.show_address !== undefined ? Boolean(tBiz.show_address) : isTrue(s.show_business_address, true)) && Boolean(shopAddress)
  const showPhone = showShopDetails && (tBiz.show_phone !== undefined ? Boolean(tBiz.show_phone) : isTrue(s.show_business_phone, true)) && Boolean(shopPhone)
  const showEmail = showShopDetails && (tBiz.show_email !== undefined ? Boolean(tBiz.show_email) : isTrue(s.show_business_email, true)) && Boolean(shopEmail)
  const showGstin = showShopDetails && (tBiz.show_gstin !== undefined ? Boolean(tBiz.show_gstin) : isTrue(s.show_business_gstin, true)) && Boolean(shopGstin)
  const showPan = showShopDetails && (tBiz.show_pan !== undefined ? Boolean(tBiz.show_pan) : isTrue(s.show_business_pan, true)) && Boolean(shopPan)
  const showFssai = showShopDetails && isTrue(s.show_fssai_on_invoice, false) && Boolean(fssai)
  const showCin = showShopDetails && isTrue(s.show_cin_on_invoice, false) && Boolean(cin)

  // Customer profile & flags
  const custName = inv.customer_name || inv.customer?.name || 'Walk-in Customer'
  const custPhone = inv.customer_phone || inv.customer?.mobile || ''
  const custAddress = inv.customer_address || inv.customer?.address || ''
  const custGstin = inv.customer_gstin || inv.customer?.gstin || ''

  const showCustName = isTrue(tFields.show_customer_name, true)
  const showCustPhone = (tFields.show_customer_phone !== undefined ? tFields.show_customer_phone : isTrue(s.show_customer_phone, true)) && Boolean(custPhone)
  const showCustAddress = (tFields.show_customer_address !== undefined ? tFields.show_customer_address : isTrue(s.show_customer_address, true)) && Boolean(custAddress)
  const showCustGstin = (tFields.show_customer_gstin !== undefined ? tFields.show_customer_gstin : isTrue(s.show_customer_gstin, true)) && Boolean(custGstin)

  // Invoice specifics
  const invoiceNo = inv.invoice_number || `${s.invoice_prefix || 'INV-'}${s.invoice_start_number || '1001'}`
  const invoiceDate = inv.created_at ? formatDate(inv.created_at) : formatDate(new Date())
  const invoiceTime = inv.created_at ? formatTime(inv.created_at) : formatTime(new Date())
  const paymentMode = (inv.payment_method || s.default_payment_method || 'CASH').toUpperCase()
  const placeOfSupply = inv.place_of_supply || s.place_of_supply || ''

  const showPaymentMode = (tFields.show_payment_mode !== undefined ? tFields.show_payment_mode : isTrue(s.show_payment_mode, true)) && Boolean(paymentMode)
  const showPlaceOfSupply = (tFields.show_place_of_supply !== undefined ? tFields.show_place_of_supply : isTrue(s.show_place_of_supply, true)) && Boolean(placeOfSupply)

  // Document status
  const isCancelled = inv.status === 'cancelled'
  const configuredDocTitle = (
    (templateConfig?.invoice_title && String(templateConfig.invoice_title).trim())
    || (tLayout?.invoice_title && String(tLayout.invoice_title).trim())
    || (s.invoice_title && String(s.invoice_title).trim())
    || 'TAX INVOICE'
  )
  const docHeading = isCancelled ? 'CANCELLED INVOICE' : configuredDocTitle
  const paymentStatus = isCancelled ? 'CANCELLED' : (inv.payment_status || 'PAID').toUpperCase()

  // Items and totals
  const items = useMemo(() => {
    if (inv.items && inv.items.length) {
      return inv.items.map(i => {
        const qty = Number(i.quantity ?? i.qty ?? 1)
        const rate = Number(i.unit_price ?? i.rate ?? 0)
        const disc = Number(i.discount_percent ?? i.disc ?? 0)
        const gst = Number(i.gst_percent ?? i.gst ?? 0)
        const basic = qty * rate * (1 - disc / 100)
        const gstAmt = Number(i.gst_amount ?? (basic * gst / 100))
        const total = Number(i.total ?? (basic + gstAmt))
        return {
          ...i,
          name: i.product_name || i.name || i.product?.name || 'Item',
          sku: i.sku || i.product?.sku || '',
          barcode: i.barcode || i.product?.barcode || '',
          hsn: i.hsn_code || i.hsn || i.product?.hsn_code || '',
          unit: i.unit || i.product?.unit || '',
          batch: i.batch_number || i.batch_no || (typeof i.batch === 'string' ? i.batch : i.batch?.batch_number) || '',
          manufacturing: i.manufacturing_date || i.mfg_date || i.batch?.manufacturing_date || '',
          expiry: i.expiry_date || i.exp_date || i.batch?.expiry_date || '',
          mrp: Number(i.mrp ?? i.batch?.mrp ?? i.product?.mrp ?? 0),
          qty,
          rate,
          disc,
          gst,
          gstAmt,
          total,
        }
      })
    }
    // Demo item fallback for empty previews
    return [
      { name: 'Demo Product 1', sku: 'SKU-001', barcode: '890123456789', hsn: '1905', unit: 'pcs', batch: 'B-101', manufacturing: '2025-01-10', expiry: '2026-12-31', mrp: 280, qty: 2, rate: 250, disc: 5, gst: 18, gstAmt: 85.5, total: 560.5 },
      { name: 'Demo Product 2', sku: 'SKU-002', barcode: '890987654321', hsn: '2106', unit: 'box', batch: 'B-202', manufacturing: '2025-03-15', expiry: '2027-04-30', mrp: 500, qty: 1, rate: 450, disc: 0, gst: 12, gstAmt: 54.0, total: 504.0 },
    ]
  }, [inv.items])

  const subtotal = Number(inv.subtotal ?? items.reduce((sum, i) => sum + (i.rate * i.qty), 0))
  const discountAmount = Number(inv.discount_amount ?? items.reduce((sum, i) => sum + (i.rate * i.qty * i.disc / 100), 0))
  const taxAmount = Number(inv.tax_amount ?? items.reduce((sum, i) => sum + i.gstAmt, 0))
  const cessAmount = Number(inv.cess_amount ?? 0)
  const roundOff = Number(inv.round_off ?? 0)
  const grandTotal = Number(inv.grand_total ?? (subtotal - discountAmount + taxAmount + cessAmount + roundOff))
  const paidAmount = Number(inv.paid_amount ?? (paymentStatus === 'PAID' ? grandTotal : 0))
  const balanceDue = Number(inv.balance_due ?? Math.max(0, grandTotal - paidAmount))

  // Column toggles
  const showSkuCol = (tFields.show_sku !== undefined ? tFields.show_sku : isTrue(s.show_sku_col, false)) && items.some(i => Boolean(i.sku))
  const showBarcodeCol = isTrue(s.show_barcode_col, false) && items.some(i => Boolean(i.barcode))
  const showHsnCol = (tFields.show_hsn !== undefined ? tFields.show_hsn : isTrue(s.show_hsn_col, true)) && items.some(i => Boolean(i.hsn))
  const showUnitCol = (tFields.show_unit !== undefined ? tFields.show_unit : isTrue(s.show_unit_col, false)) && items.some(i => Boolean(i.unit))
  const showBatchCol = (tFields.show_batch !== undefined ? tFields.show_batch : isTrue(s.show_batch_col, false)) && items.some(i => Boolean(i.batch))
  const showExpiryCol = isTrue(s.show_expiry_col, false) && items.some(i => Boolean(i.expiry))
  const showMfgCol = isTrue(s.show_mfg_date, false) && items.some(i => Boolean(i.manufacturing))
  const showMrpCol = isTrue(s.show_mrp_col, false) && items.some(i => Number(i.mrp) > 0)
  const showDiscCol = (tFields.show_discount !== undefined ? tFields.show_discount : isTrue(s.show_discount_col, true)) && items.some(i => Number(i.disc) > 0)
  const showTaxCols = (tFields.show_tax_breakup !== undefined ? tFields.show_tax_breakup : isTrue(s.show_tax_cols, true)) && s.gst_reg_type !== 'unregistered'
  const thermal = effectiveMode === 'thermal'
  const showSerialCol = isTrue(tFields.show_sr_no !== undefined ? tFields.show_sr_no : s.show_sr_no, true)
  const showItemName = isTrue(tFields.show_item_name !== undefined ? tFields.show_item_name : s.show_item_name, true)
  const showQtyCol = thermal
    ? isTrue(s.thermal_show_qty, true)
    : isTrue(tFields.show_qty !== undefined ? tFields.show_qty : s.show_qty_col, true)
  const showRateCol = thermal
    ? isTrue(s.thermal_show_rate, true)
    : isTrue(tFields.show_rate !== undefined ? tFields.show_rate : s.show_rate_col, true)
  const showTotalCol = thermal
    ? isTrue(s.thermal_show_total, true)
    : isTrue(tFields.show_total !== undefined ? tFields.show_total : s.show_total_col, true)
  const showThermalBatch = isTrue(s.thermal_show_batch, showBatchCol)
  const showThermalExpiry = isTrue(s.thermal_show_expiry, showExpiryCol)
  const showThermalMrp = isTrue(s.thermal_show_mrp, showMrpCol)
  const showCessCol = isTrue(s.cess_enabled, false) && cessAmount > 0

  // Tax breakdown flags
  const showSubtotal = isTrue(tTax.show_subtotal, true)
  const showDiscountTotal = isTrue(tTax.show_discount_total, true)
  const showTaxSummary = isTrue(tTax.show_tax_summary, true)
  const showRoundOff = tTax.show_round_off !== undefined ? tTax.show_round_off : isTrue(s.round_off, true)
  const showWords = (tTax.show_amount_in_words !== undefined ? tTax.show_amount_in_words : isTrue(s.show_amount_in_words, true))

  // Payment, QR & Bank
  const showPaymentSummary = isTrue(tPayment.show_payment_summary, isTrue(s.show_payment_summary, true))
  const showBalanceDue = isTrue(tPayment.show_balance_due, isTrue(s.show_balance_due, true))
  const bankDetailsText = s.shop_bank_details || [
    s.shop_bank_name ? `Bank: ${s.shop_bank_name}` : '',
    s.shop_bank_account ? `A/C: ${s.shop_bank_account}` : '',
    s.shop_bank_ifsc ? `IFSC: ${s.shop_bank_ifsc}` : '',
    s.shop_bank_branch ? `Branch: ${s.shop_bank_branch}` : '',
  ].filter(Boolean).join(' | ')
  const showBankDetails = isTrue(tPayment.show_bank_details, isTrue(s.show_bank_details, true)) && Boolean(bankDetailsText)
  const upiId = s.shop_upi_id || ''
  const showUpiA4 = isTrue(tPayment.show_upi_qr !== undefined ? tPayment.show_upi_qr : s.show_upi_qr_on_invoice, true) && Boolean(upiId)
  const showUpiThermal = isTrue(s.thermal_show_upi_qr !== undefined ? s.thermal_show_upi_qr : (tPayment.show_upi_qr !== undefined ? tPayment.show_upi_qr : s.show_upi_qr_on_thermal), true) && Boolean(upiId)
  const is58mm = mode === 'thermal_58' || (mode === 'thermal' && (s.thermal_paper_width === '58' || s.thermal_paper_width === '58mm' || s.thermal_paper_width === '2' || s.printer_type === 'thermal_58')) || tPage.thermal_roll_width === '58mm' || (s.invoice_template === 'thermal_58' && mode !== 'thermal_80' && mode !== 'a4' && mode !== 'half_a4')

  const qrSizeA4 = ({ small: 64, medium: 78, large: 96 })[s.upi_qr_size_a4] || 78
  const qrSizeThermal = is58mm
    ? ({ small: 64, medium: 78, large: 88 })[s.upi_qr_size_thermal] || 78
    : ({ small: 72, medium: 92, large: 110 })[s.upi_qr_size_thermal] || 92
  const qrValue = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoiceNo)}`

  // Digital Bill QR Code ("Scan to View Bill") - completely separate from payment UPI QR
  const showDigitalBillQr = effectiveMode === 'thermal'
    ? isTrue(s.thermal_show_bill_qr, false)
    : isTrue(tPayment.show_digital_bill_qr !== undefined ? tPayment.show_digital_bill_qr : s.enable_invoice_qr, true)
  const shareDomain = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_SHARE_URL) || (typeof window !== 'undefined' ? window.location.origin : '')
  const digitalBillUrl = inv.short_url
    || (inv.public_token && shareDomain ? `${shareDomain}/b/${inv.public_token}` : (shareDomain ? `${shareDomain}/b/${inv.id || 'preview'}` : ''))

  // Notes, Terms & Footer
  const notesText = inv.notes || s.invoice_notes || ''
  const termsText = tPayment.terms_override || inv.terms || s.invoice_terms || ''
  const showNotes = (tFields.show_notes !== undefined ? tFields.show_notes : isTrue(s.show_notes, true)) && Boolean(notesText)
  const showTerms = (tPayment.show_terms !== undefined ? tPayment.show_terms : isTrue(s.show_terms, true)) && Boolean(termsText)
  const showSignature = tPayment.show_signature !== undefined ? tPayment.show_signature : isTrue(s.show_signature_area, false)
  const showFooter = (tPayment.show_footer !== undefined ? tPayment.show_footer : isTrue(s.show_footer, true)) && (tPayment.footer_layout || s.invoice_footer_layout) !== 'none'
  const footerText = tPayment.footer_text_override || s.invoice_footer || 'THANK YOU FOR SHOPPING WITH US!'
  const thermalTermsText = s.thermal_terms || termsText
  const thermalFooterText = s.receipt_footer || footerText
  const footerAlign = (tPayment.footer_layout || s.invoice_footer_layout) === 'text_left' ? 'left' : 'center'

  // Font and typography
  const selectedFont = tLayout.font_family || s.invoice_font || 'inter'
  const fontFamily = selectedFont === 'courier'
    ? 'Courier New, monospace'
    : selectedFont === 'roboto'
    ? 'Roboto, sans-serif'
    : selectedFont === 'times'
    ? '"Times New Roman", Times, serif'
    : 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

  // --------------------------------------------------------------------------
  // THERMAL RECEIPT MODE
  // --------------------------------------------------------------------------
  if (effectiveMode === 'thermal') {
    const is58 = mode === 'thermal_58' || s.thermal_paper_width === '58' || s.thermal_paper_width === '2' || s.printer_type === 'thermal_58' || tPage.thermal_roll_width === '58mm'
    const targetMode = is58 ? 'thermal_58' : 'thermal_80'
    return (
      <div className={`invoice-document-root ${className}`}>
        {showModePicker && <InvoiceModePicker mode={mode} onModeChange={onModeChange} settings={s} />}
        <div className="flex justify-center print:m-0 print:p-0">
          <ThermalReceipt
            invoice={inv}
            settings={s}
            mode={targetMode}
            isPreview={false}
          />
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // HALF-A4 (A5) TAX INVOICE MODE (148 x 210 mm)
  // --------------------------------------------------------------------------
  if (effectiveMode === 'half_a4') {
    return (
      <div className={`invoice-document-root ${className}`}>
        <style>{`
          @media print {
            @page {
              size: 148mm 210mm;
              margin: 4mm 5mm;
            }
            .invoice-document-root {
              width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
            }
            .invoice-sheet-half-a4 {
              width: 100% !important;
              max-width: 100% !important;
              min-height: auto !important;
              margin: 0 !important;
              padding: 4mm 5mm !important;
              box-shadow: none !important;
              border: none !important;
              box-sizing: border-box !important;
            }
            .invoice-sheet-half-a4 * {
              word-break: break-word !important;
              overflow-wrap: break-word !important;
            }
          }
        `}</style>
        {showModePicker && <InvoiceModePicker mode={mode} onModeChange={onModeChange} settings={s} />}

        <div className="overflow-x-auto print:overflow-visible flex justify-center">
          <div
            className="invoice-sheet-half-a4 bg-white text-[#0F172A] border shadow-sm print:shadow-none print:border-none rounded-sm print:m-0"
            style={{
              width: 560,
              maxWidth: '100%',
              minHeight: effectiveMode === 'thermal' ? undefined : 792,
              fontFamily,
              fontSize: 10,
              padding: '16px 20px',
              boxSizing: 'border-box',
              lineHeight: 1.35,
              borderColor: `${accentColor}55`,
              borderStyle: invoiceBorderStyle === 'double' ? 'double' : invoiceBorderStyle === 'dashed' ? 'dashed' : 'solid',
            }}
          >
            {/* Header: Shop info left, invoice metadata right */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {showShopDetails && (
                  <>
                    {showLogo && (
                      <img
                        src={shopLogo}
                        alt="Store Logo"
                        style={{ maxHeight: 28, maxWidth: 84, objectFit: 'contain', marginBottom: 8 }}
                      />
                    )}
                    {showShopName && shopName && (
                      <div style={{ fontWeight: '800', fontSize: 14.5, textTransform: 'uppercase', color: accentColor, letterSpacing: '0.02em', lineHeight: 1.2 }}>
                        {shopName}
                      </div>
                    )}
                    {showAddress && shopAddress && shopAddress.split('\n').map((line, idx) => (
                      <div key={idx} style={{ fontSize: 8.5, color: '#334155', marginTop: 1 }}>{line}</div>
                    ))}
                    {(showPhone || showEmail) && (
                      <div style={{ fontSize: 8.5, color: '#475569', marginTop: 1 }}>
                        {showPhone && `Ph: ${shopPhone}`}
                        {showPhone && showEmail && ' | '}
                        {showEmail && shopEmail}
                      </div>
                    )}
                    {(showGstin || showPan || showFssai || showCin) && (
                      <div style={{ fontSize: 8.5, color: '#334155', marginTop: 1 }}>
                        {showGstin && <span><b>GSTIN:</b> {shopGstin} </span>}
                        {showPan && <span>| <b>PAN:</b> {shopPan} </span>}
                        {showFssai && <span>| <b>FSSAI:</b> {fssai}</span>}
                        {showCin && <span>| <b>CIN:</b> {cin}</span>}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div style={{ textAlign: 'right', minWidth: 170 }}>
                <div style={{
                  fontWeight: '800',
                  fontSize: 15,
                  letterSpacing: '0.03em',
                  color: isCancelled ? '#DC2626' : accentColor,
                }}>
                  {docHeading}
                </div>
                <div style={{ fontSize: 10, fontWeight: '700', marginTop: 4, color: '#0F172A' }}>
                  Inv #: {invoiceNo}
                </div>
                <div style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>
                  Date: {invoiceDate}
                </div>
                {inv.due_date && (
                  <div style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>
                    Due: {formatDate(inv.due_date)}
                  </div>
                )}
                {showPaymentMode && (
                  <div style={{ fontSize: 9, color: '#334155', marginTop: 1 }}>
                    Payment: {paymentMode}
                  </div>
                )}
                {showPlaceOfSupply && (
                  <div style={{ fontSize: 8.5, color: '#475569', marginTop: 1 }}>
                    POS: {placeOfSupply}
                  </div>
                )}
                {isCancelled && (
                  <div style={{ marginTop: 4, fontSize: 8.5, color: '#DC2626', background: '#FEF2F2', padding: '2px 4px', borderRadius: 3 }}>
                    <b>CANCELLED</b>
                    {inv.cancel_reason && <div>{inv.cancel_reason}</div>}
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: `1px ${invoiceBorderStyle === 'dashed' ? 'dashed' : 'solid'} ${secondaryColor}66`, marginBottom: 8 }} />

            {/* Bill To Customer Section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 8.5, fontWeight: '700', textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em' }}>
                  BILL TO
                </div>
                <div style={{ fontWeight: '700', fontSize: 11.5, color: '#0F172A' }}>
                  {custName}
                </div>
                {showCustAddress && (
                  <div style={{ fontSize: 8.5, color: '#334155', marginTop: 1 }}>{custAddress}</div>
                )}
                {showCustPhone && (
                  <div style={{ fontSize: 8.5, color: '#334155', marginTop: 1 }}>Mobile: {custPhone}</div>
                )}
                {showCustGstin && (
                  <div style={{ fontSize: 8.5, color: '#334155', marginTop: 1 }}><b>GSTIN:</b> {custGstin}</div>
                )}
              </div>
              {showPlaceOfSupply && placeOfSupply && (
                <div style={{ textAlign: 'right', fontSize: 8.5, color: '#475569', shrink: 0 }}>
                  <b>Place of Supply:</b> {placeOfSupply}
                </div>
              )}
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5, marginTop: 2, tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: invoiceTableStyle === 'bold' ? `${accentColor}18` : `${secondaryColor}10`, borderTop: `1px ${invoiceBorderStyle === 'dashed' ? 'dashed' : 'solid'} ${accentColor}`, borderBottom: `1px ${invoiceBorderStyle === 'dashed' ? 'dashed' : 'solid'} ${accentColor}` }}>
                  {showSerialCol && <th style={{ textAlign: 'center', padding: '4px 3px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 34, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>S.No</th>}
                  {showItemName && <th style={{ textAlign: 'left', padding: '4px 4px', fontSize: 8.5, fontWeight: '700', color: '#334155', whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Item Description</th>}
                  {showHsnCol && (
                    <th style={{ textAlign: 'center', padding: '4px 3px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 54, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>HSN/AC</th>
                  )}
                  {showQtyCol && <th style={{ textAlign: 'center', padding: '4px 3px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 36, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Qty</th>}
                  {showRateCol && <th style={{ textAlign: 'right', padding: '4px 4px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 56, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Rate</th>}
                  {showDiscCol && (
                    <th style={{ textAlign: 'right', padding: '4px 4px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 42, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Disc</th>
                  )}
                  {showTaxCols && (
                    <th style={{ textAlign: 'right', padding: '4px 4px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 48, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>GST</th>
                  )}
                  {showTotalCol && <th style={{ textAlign: 'right', padding: '4px 4px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 66, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Amount</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px ${invoiceBorderStyle === 'dashed' ? 'dashed' : 'solid'} #E2E8F0`, background: invoiceTableStyle === 'striped' && idx % 2 === 1 ? `${secondaryColor}0A` : '#FFFFFF' }}>
                    {showSerialCol && <td style={{ padding: '4px 3px', textAlign: 'center', fontSize: 8.5, color: '#64748B', whiteSpace: 'nowrap' }}>{idx + 1}</td>}
                    {showItemName && <td style={{ padding: '4px 4px', fontSize: 8.5, color: '#0F172A', fontWeight: '500', wordBreak: 'break-word', whiteSpace: 'normal', overflowWrap: 'break-word' }}>
                      <div style={{ wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: 1.25 }}>{item.name}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 6px', marginTop: 2, fontSize: 7.5, color: '#64748B' }}>
                        {item.sku && showSkuCol && <span>SKU: {item.sku}</span>}
                        {item.barcode && showBarcodeCol && <span>Bar: {item.barcode}</span>}
                        {item.unit && showUnitCol && <span>({item.unit})</span>}
                        {showBatchCol && item.batch && <span style={{ fontWeight: '600', color: '#0F172A' }}>Batch: {item.batch}</span>}
                        {showExpiryCol && item.expiry && <span>Exp: {item.expiry}</span>}
                        {showMfgCol && item.manufacturing && <span>Mfg: {item.manufacturing}</span>}
                        {showMrpCol && Number(item.mrp) > 0 && <span>MRP: {fmt(item.mrp)}</span>}
                      </div>
                    </td>}
                    {showHsnCol && (
                      <td style={{ padding: '4px 3px', textAlign: 'center', fontSize: 8.5, color: '#64748B', whiteSpace: 'nowrap' }}>{item.hsn || '—'}</td>
                    )}
                    {showQtyCol && <td style={{ padding: '4px 3px', textAlign: 'center', fontSize: 8.5, color: '#0F172A', whiteSpace: 'nowrap' }}>{item.qty}</td>}
                    {showRateCol && <td style={{ padding: '4px 4px', textAlign: 'right', fontSize: 8.5, color: '#0F172A', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.rate)}</td>}
                    {showDiscCol && (
                      <td style={{ padding: '4px 4px', textAlign: 'right', fontSize: 8.5, color: '#64748B', whiteSpace: 'nowrap' }}>
                        {item.disc ? `${item.disc}%` : '—'}
                      </td>
                    )}
                    {showTaxCols && (
                      <td style={{ padding: '4px 4px', textAlign: 'right', fontSize: 8.5, color: '#334155', whiteSpace: 'nowrap' }}>
                        {item.gst ? `${item.gst}%` : '—'}
                      </td>
                    )}
                    {showTotalCol && <td style={{ padding: '4px 4px', textAlign: 'right', fontWeight: '700', fontSize: 8.5, color: '#0F172A', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      {fmt(item.total)}
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals & Words / Notes */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8, gap: 12 }}>
              <div style={{ fontSize: 8.5, color: '#334155', flex: 1, minWidth: 0 }}>
                {showWords && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontWeight: '700', textTransform: 'uppercase', color: '#475569', fontSize: 8 }}>
                      AMOUNT IN WORDS
                    </div>
                    <div style={{ fontSize: 9.5, color: '#0F172A', fontWeight: '600' }}>
                      {numberToIndianWords(grandTotal)}
                    </div>
                  </div>
                )}
                {showNotes && (
                  <div style={{ marginBottom: 4, fontSize: 8, color: '#475569' }}>
                    <b>Notes:</b> {notesText}
                  </div>
                )}
                {showTerms && (
                  <div style={{ fontSize: 7.5, color: '#64748B', lineHeight: 1.3 }}>
                    <b style={{ color: '#475569' }}>Terms &amp; Conditions: </b>
                    {termsText}
                  </div>
                )}
              </div>

              {/* Accounting Totals */}
              <div style={{ minWidth: 190 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5px 0', fontSize: 9.5, color: '#334155' }}>
                  <span>Subtotal</span>
                  <span style={{ fontWeight: '600', color: '#0F172A' }}>{fmt(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5px 0', fontSize: 9.5, color: '#334155' }}>
                    <span>Discount</span>
                    <span style={{ fontWeight: '600', color: '#DC2626' }}>-{fmt(discountAmount)}</span>
                  </div>
                )}
                {showTaxCols && taxAmount > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5px 0', fontSize: 9, color: '#334155' }}>
                      <span>SGST</span>
                      <span style={{ fontWeight: '600', color: '#0F172A' }}>{fmt(taxAmount / 2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5px 0', fontSize: 9, color: '#334155' }}>
                      <span>CGST</span>
                      <span style={{ fontWeight: '600', color: '#0F172A' }}>{fmt(taxAmount / 2)}</span>
                    </div>
                  </>
                )}
                {showCessCol && cessAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5px 0', fontSize: 9, color: '#334155' }}>
                    <span>CESS</span>
                    <span style={{ fontWeight: '600', color: '#0F172A' }}>{fmt(cessAmount)}</span>
                  </div>
                )}
                {roundOff !== 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5px 0', fontSize: 9, color: '#334155' }}>
                    <span>Round Off</span>
                    <span style={{ fontWeight: '600', color: '#0F172A' }}>{fmt(roundOff)}</span>
                  </div>
                )}

                {/* Grand Total */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '5px 7px',
                  fontWeight: '800',
                  fontSize: 12,
                  borderTop: `1px solid ${accentColor}`,
                  borderBottom: `1px solid ${accentColor}`,
                  background: `${secondaryColor}12`,
                  marginTop: 4,
                  color: accentColor,
                }}>
                  <span>GRAND TOTAL</span>
                  <span>{fmt(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Payment Summary, Bank Details & QR Codes */}
            {(showPaymentSummary || showBankDetails || showUpiA4 || showDigitalBillQr) && (
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: 4,
                marginTop: 8,
                padding: '6px 10px',
                fontSize: 8.5,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {showPaymentSummary && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: 7.5, color: '#475569', fontWeight: '700' }}>STATUS</span><br />
                          <b style={{
                            color: paymentStatus === 'PAID' ? '#16A34A' : paymentStatus === 'CANCELLED' ? '#DC2626' : '#D97706',
                            fontSize: 9.5,
                          }}>
                            {paymentStatus}
                          </b>
                        </div>
                        <div>
                          <span style={{ fontSize: 7.5, color: '#475569', fontWeight: '700' }}>PAID</span><br />
                          <b style={{ color: '#0F172A', fontSize: 9.5 }}>{fmt(paidAmount)}</b>
                        </div>
                        {showBalanceDue && (
                          <div>
                            <span style={{ fontSize: 7.5, color: '#475569', fontWeight: '700' }}>BALANCE DUE</span><br />
                            <b style={{ color: balanceDue > 0 ? '#DC2626' : '#0F172A', fontSize: 9.5 }}>
                              {fmt(balanceDue)}
                            </b>
                          </div>
                        )}
                        {showPaymentMode && (
                          <div>
                            <span style={{ fontSize: 7.5, color: '#475569', fontWeight: '700' }}>MODE</span><br />
                            <b style={{ color: '#0F172A', fontSize: 9.5 }}>{paymentMode}</b>
                          </div>
                        )}
                      </div>
                    )}

                    {showBankDetails && Boolean(bankDetailsText) && (
                      <div style={{ borderTop: showPaymentSummary ? '1px solid #E2E8F0' : 'none', marginTop: showPaymentSummary ? 4 : 0, paddingTop: showPaymentSummary ? 4 : 0, fontSize: 8, color: '#475569', lineHeight: 1.35 }}>
                        <b>Bank Details:</b> {bankDetailsText}
                      </div>
                    )}
                  </div>

                  {/* Scannable QR Codes side-by-side */}
                  {(showUpiA4 || showDigitalBillQr) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {showUpiA4 && qrValue && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-block', border: '1px solid #CBD5E1', padding: 2, borderRadius: 4, background: '#FFFFFF' }}>
                            <QRCodeSVG value={qrValue} size={52} level="M" />
                          </div>
                          <div style={{ marginTop: 1, fontWeight: '700', fontSize: 7.5, color: '#0F766E', letterSpacing: '0.02em' }}>SCAN TO PAY</div>
                        </div>
                      )}
                      {showDigitalBillQr && digitalBillUrl && (
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-block', border: '1px solid #CBD5E1', padding: 2, borderRadius: 4, background: '#FFFFFF' }}>
                            <QRCodeSVG value={digitalBillUrl} size={52} level="M" />
                          </div>
                          <div style={{ marginTop: 1, fontWeight: '700', fontSize: 7.5, color: '#4F46E5', letterSpacing: '0.02em' }}>VIEW BILL</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Signature Area */}
            {showSignature && (
              <div style={{
                borderTop: '1px solid #CBD5E1',
                marginTop: 14,
                paddingTop: 16,
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 8.5,
                color: '#475569',
              }}>
                <span>Prepared by</span>
                <span>Authorised Signatory</span>
              </div>
            )}

            {/* Footer */}
            {showFooter && (
              <div style={{
                borderTop: '1px solid #E2E8F0',
                marginTop: 8,
                paddingTop: 6,
                textAlign: footerAlign,
                fontSize: 8.5,
                color: '#475569',
              }}>
                <b style={{ color: '#334155' }}>{footerText.toUpperCase()}</b>
                <div style={{ marginTop: 1, fontSize: 7.5, color: '#64748B' }}>
                  Date: {invoiceDate} {invoiceTime ? ` ${invoiceTime}` : ''} · Ref: {invoiceNo}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // --------------------------------------------------------------------------
  // A4 TAX INVOICE MODE
  // --------------------------------------------------------------------------
  const a4ColCount = [
    showSerialCol, showSkuCol, showBarcodeCol, showItemName, showHsnCol,
    showUnitCol, showBatchCol, showExpiryCol, showMfgCol, showMrpCol,
    showQtyCol, showRateCol, showDiscCol, showTaxCols, showTaxCols, showCessCol, showTotalCol
  ].filter(Boolean).length
  const a4FontSize = a4ColCount > 10 ? 8 : a4ColCount > 8 ? 8.5 : 9.5
  const a4PadY = a4ColCount > 10 ? 4 : 5.5

  return (
    <div className={`invoice-document-root ${className}`}>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 4mm 6mm;
          }
          .invoice-document-root {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .invoice-sheet-a4 {
            width: 100% !important;
            max-width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 4mm 6mm !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
          }
          .invoice-sheet-a4 * {
            word-break: break-word !important;
            overflow-wrap: break-word !important;
          }
        }
      `}</style>
      {showModePicker && <InvoiceModePicker mode={mode} onModeChange={onModeChange} settings={s} />}

      <div className="overflow-x-auto print:overflow-visible">
        <div
          className="invoice-sheet-a4 bg-white text-[#0F172A] border border-slate-200 shadow-sm print:shadow-none print:border-none mx-auto rounded-sm print:m-0"
          style={{
            width: '100%',
            maxWidth: 794,
            minHeight: 1123,
            fontFamily,
            fontSize: 11,
            padding: '24px 28px',
            boxSizing: 'border-box',
          }}
        >
          {/* 1. TOP HEADER: Business info on Left, Invoice details on Right */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 12,
              gap: 18,
              padding: isCorporateA4 ? '12px 14px' : 0,
              border: isCorporateA4 ? `1px solid ${secondaryColor}` : undefined,
              borderTop: isCorporateA4 ? `4px solid ${accentColor}` : undefined,
              background: isCorporateA4 ? '#F8FAFC' : undefined,
              borderRadius: isCorporateA4 ? 4 : undefined,
            }}
          >
            <div style={{ flex: 1, paddingRight: 20 }}>
              {showShopDetails && (
                <>
                  {showLogo && (
                    <img
                      src={shopLogo}
                      alt="Business Logo"
                      style={{ maxHeight: 32, maxWidth: 100, objectFit: 'contain', marginBottom: 8 }}
                    />
                  )}
                  {showShopName && shopName && (
                    <div style={{ fontWeight: '800', fontSize: 17, textTransform: 'uppercase', color: '#0F172A', letterSpacing: '0.02em' }}>
                      {shopName}
                    </div>
                  )}
                  {showAddress && shopAddress && shopAddress.split('\n').map((line, idx) => (
                    <div key={idx} style={{ fontSize: 9.5, color: '#334155', marginTop: 1 }}>{line}</div>
                  ))}
                  {(showPhone || showEmail) && (
                    <div style={{ fontSize: 9.5, color: '#475569', marginTop: 2 }}>
                      {showPhone && `Mobile: ${shopPhone}`}
                      {showPhone && showEmail && '  |  '}
                      {showEmail && `Email: ${shopEmail}`}
                    </div>
                  )}
                  {(showGstin || showPan || showFssai || showCin) && (
                    <div style={{ fontSize: 9.5, color: '#334155', marginTop: 2 }}>
                      {showGstin && <span><b>GSTIN:</b> {shopGstin}</span>}
                      {showGstin && showPan && '  |  '}
                      {showPan && <span><b>PAN:</b> {shopPan}</span>}
                      {showFssai && <span>  |  <b>FSSAI:</b> {fssai}</span>}
                      {showCin && <span>  |  <b>CIN:</b> {cin}</span>}
                    </div>
                  )}
                </>
              )}
            </div>

            <div style={{ textAlign: 'right', minWidth: 230 }}>
              <div style={{
                fontWeight: '800',
                fontSize: 18,
                letterSpacing: '0.03em',
                color: isCancelled ? '#DC2626' : isCorporateA4 ? accentColor : '#0F172A',
              }}>
                {docHeading}
              </div>
              <div style={{ fontSize: 11, fontWeight: '700', marginTop: 6, color: '#0F172A' }}>
                Invoice No: {invoiceNo}
              </div>
              <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                Invoice Date: {invoiceDate}
              </div>
              {showPaymentMode && (
                <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                  Payment Mode: {paymentMode}
                </div>
              )}
              {showPlaceOfSupply && (
                <div style={{ fontSize: 9.5, color: '#475569', marginTop: 2 }}>
                  Place of Supply: {placeOfSupply}
                </div>
              )}

              {isCancelled && (
                <div style={{ marginTop: 6, fontSize: 9, color: '#DC2626', background: '#FEF2F2', padding: '4px 6px', borderRadius: 4, textAlign: 'right' }}>
                  <b style={{ display: 'block' }}>STATUS: CANCELLED</b>
                  {inv.cancelled_by_name && <div>By: {inv.cancelled_by_name}</div>}
                  {inv.cancel_reason && <div>Reason: {inv.cancel_reason}</div>}
                </div>
              )}
            </div>
          </div>

          <div style={{ borderTop: `1px solid ${secondaryColor}`, marginBottom: 10 }} />

          {/* 2. BILL TO CUSTOMER SECTION */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 16 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 9, fontWeight: '700', textTransform: 'uppercase', color: '#475569', letterSpacing: '0.04em', marginBottom: 2 }}>
                BILL TO
              </div>
              <div style={{ fontWeight: '700', fontSize: 12.5, color: '#0F172A' }}>
                {custName}
              </div>
              {showCustAddress && (
                <div style={{ fontSize: 9.5, color: '#334155', marginTop: 1 }}>{custAddress}</div>
              )}
              {showCustPhone && (
                <div style={{ fontSize: 9.5, color: '#334155', marginTop: 1 }}>Mobile: {custPhone}</div>
              )}
              {showCustGstin && (
                <div style={{ fontSize: 9.5, color: '#334155', marginTop: 1 }}><b>GSTIN:</b> {custGstin}</div>
              )}
            </div>

            <div style={{ textAlign: 'right', fontSize: 9.5, color: '#475569', flexShrink: 0 }}>
              {showPlaceOfSupply && placeOfSupply && (
                <div><b>Place of Supply:</b> {placeOfSupply}</div>
              )}
              {inv.shipping_address && (
                <div style={{ marginTop: 2 }}><b>Ship To:</b> {inv.shipping_address}</div>
              )}
            </div>
          </div>

          {/* 3. DYNAMIC ITEM TABLE WITH LIGHT SHADED HEADER */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: a4FontSize, marginTop: 4, tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: invoiceTableStyle === 'bold' ? accentColor : '#F8FAFC', borderTop: `1px solid ${accentColor}`, borderBottom: `1px solid ${accentColor}` }}>
                {showSerialCol && <th style={{ textAlign: 'center', padding: `${a4PadY}px 4px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 38, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>S.No</th>}
                {showSkuCol && (
                  <th style={{ textAlign: 'center', padding: `${a4PadY}px 4px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 66, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Item Code</th>
                )}
                {showBarcodeCol && <th style={{ textAlign: 'center', padding: `${a4PadY}px 4px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 72, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Barcode</th>}
                {showItemName && <th style={{ textAlign: 'left', padding: `${a4PadY}px 6px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Item Description</th>}
                {showHsnCol && (
                  <th style={{ textAlign: 'center', padding: `${a4PadY}px 4px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 64, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>HSN/AC</th>
                )}
                {showUnitCol && (
                  <th style={{ textAlign: 'center', padding: `${a4PadY}px 4px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 44, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Unit</th>
                )}
                {showBatchCol && (
                  <th style={{ textAlign: 'center', padding: `${a4PadY}px 4px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 56, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Batch</th>
                )}
                {showExpiryCol && <th style={{ textAlign: 'center', padding: `${a4PadY}px 4px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 56, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Expiry</th>}
                {showMfgCol && <th style={{ textAlign: 'center', padding: `${a4PadY}px 4px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 56, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Mfg.</th>}
                {showMrpCol && <th style={{ textAlign: 'right', padding: `${a4PadY}px 4px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 58, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>MRP</th>}
                {showQtyCol && <th style={{ textAlign: 'center', padding: `${a4PadY}px 4px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 42, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Qty</th>}
                {showRateCol && <th style={{ textAlign: 'right', padding: `${a4PadY}px 6px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 68, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Rate</th>}
                {showDiscCol && (
                  <th style={{ textAlign: 'right', padding: `${a4PadY}px 5px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 48, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Disc.</th>
                )}
                {showTaxCols && (
                  <>
                    <th style={{ textAlign: 'right', padding: `${a4PadY}px 5px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 58, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>SGST</th>
                    <th style={{ textAlign: 'right', padding: `${a4PadY}px 5px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 58, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>CGST</th>
                  </>
                )}
                {showCessCol && (
                  <th style={{ textAlign: 'right', padding: `${a4PadY}px 5px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 52, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>CESS</th>
                )}
                {showTotalCol && <th style={{ textAlign: 'right', padding: `${a4PadY}px 6px`, fontSize: a4FontSize, fontWeight: '700', color: invoiceTableStyle === 'bold' ? '#FFFFFF' : accentColor, width: 78, whiteSpace: 'nowrap', wordBreak: 'keep-all', overflowWrap: 'normal' }}>Amount</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: `${invoiceBorderStyle === 'double' ? 3 : 1}px ${invoiceBorderStyle} ${secondaryColor}`, background: invoiceTableStyle === 'striped' && idx % 2 === 1 ? '#F1F5F9' : '#FFFFFF' }}>
                  {showSerialCol && <td style={{ padding: `${a4PadY}px 4px`, textAlign: 'center', fontSize: a4FontSize, color: '#64748B', whiteSpace: 'nowrap' }}>{idx + 1}</td>}
                  {showSkuCol && (
                    <td style={{ padding: `${a4PadY}px 4px`, textAlign: 'center', fontSize: a4FontSize, color: '#475569', whiteSpace: 'nowrap' }}>{item.sku || '—'}</td>
                  )}
                  {showBarcodeCol && <td style={{ padding: `${a4PadY}px 4px`, textAlign: 'center', fontSize: a4FontSize, color: '#64748B', whiteSpace: 'nowrap' }}>{item.barcode || '—'}</td>}
                  {showItemName && <td style={{ padding: `${a4PadY}px 6px`, fontSize: a4FontSize, color: '#0F172A', fontWeight: '500', wordBreak: 'break-word', whiteSpace: 'normal', overflowWrap: 'break-word', lineHeight: 1.3 }}>{item.name}</td>}
                  {showHsnCol && (
                    <td style={{ padding: `${a4PadY}px 4px`, textAlign: 'center', fontSize: a4FontSize, color: '#64748B', whiteSpace: 'nowrap' }}>{item.hsn || '—'}</td>
                  )}
                  {showUnitCol && (
                    <td style={{ padding: `${a4PadY}px 4px`, textAlign: 'center', fontSize: a4FontSize, color: '#64748B', whiteSpace: 'nowrap' }}>{item.unit || '—'}</td>
                  )}
                  {showBatchCol && (
                    <td style={{ padding: `${a4PadY}px 4px`, textAlign: 'center', fontSize: a4FontSize, color: '#0F172A', fontWeight: '500', whiteSpace: 'nowrap' }}>{item.batch || '—'}</td>
                  )}
                  {showExpiryCol && <td style={{ padding: `${a4PadY}px 4px`, textAlign: 'center', fontSize: a4FontSize, color: '#64748B', whiteSpace: 'nowrap' }}>{item.expiry || '—'}</td>}
                  {showMfgCol && <td style={{ padding: `${a4PadY}px 4px`, textAlign: 'center', fontSize: a4FontSize, color: '#64748B', whiteSpace: 'nowrap' }}>{item.manufacturing || '—'}</td>}
                  {showMrpCol && <td style={{ padding: `${a4PadY}px 4px`, textAlign: 'right', fontSize: a4FontSize, color: '#64748B', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{Number(item.mrp) > 0 ? fmt(item.mrp) : '—'}</td>}
                  {showQtyCol && <td style={{ padding: `${a4PadY}px 4px`, textAlign: 'center', fontSize: a4FontSize, color: '#0F172A', whiteSpace: 'nowrap' }}>{item.qty}</td>}
                  {showRateCol && <td style={{ padding: `${a4PadY}px 6px`, textAlign: 'right', fontSize: a4FontSize, color: '#0F172A', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.rate)}</td>}
                  {showDiscCol && (
                    <td style={{ padding: `${a4PadY}px 5px`, textAlign: 'right', fontSize: a4FontSize, color: '#64748B', whiteSpace: 'nowrap' }}>
                      {item.disc ? `${item.disc}%` : '—'}
                    </td>
                  )}
                  {showTaxCols && (
                    <>
                      <td style={{ padding: `${a4PadY}px 5px`, textAlign: 'right', fontSize: a4FontSize, color: '#334155', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.gstAmt / 2)}</td>
                      <td style={{ padding: `${a4PadY}px 5px`, textAlign: 'right', fontSize: a4FontSize, color: '#334155', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.gstAmt / 2)}</td>
                    </>
                  )}
                  {showCessCol && (
                    <td style={{ padding: `${a4PadY}px 5px`, textAlign: 'right', fontSize: a4FontSize, color: '#64748B', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{fmt(0)}</td>
                  )}
                  {showTotalCol && <td style={{ padding: `${a4PadY}px 6px`, textAlign: 'right', fontWeight: '700', fontSize: a4FontSize, color: '#0F172A', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {fmt(item.total)}
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>

          {/* 4. AMOUNT IN WORDS, NOTES, TERMS & TOTALS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12 }}>
            <div style={{ fontSize: 9.5, color: '#334155', maxWidth: 390, paddingRight: 16 }}>
              {showWords && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: '700', textTransform: 'uppercase', color: '#475569', fontSize: 9, marginBottom: 2 }}>
                    AMOUNT IN WORDS
                  </div>
                  <div style={{ fontSize: 10.5, color: '#0F172A', fontWeight: '600' }}>
                    {numberToIndianWords(grandTotal)}
                  </div>
                  {s.tax_on_price === 'inclusive' && showTaxCols && (
                    <div style={{ fontSize: 8.5, color: '#64748B', fontStyle: 'italic', marginTop: 1 }}>
                      Prices shown are inclusive of applicable GST.
                    </div>
                  )}
                </div>
              )}

              {showNotes && (
                <div style={{ marginBottom: 6, fontSize: 9, color: '#475569' }}>
                  <b>Notes:</b> {notesText}
                </div>
              )}

              {showTerms && (
                <div style={{ fontSize: 8.5, color: '#64748B' }}>
                  <b style={{ color: '#475569' }}>Terms &amp; Conditions</b><br />
                  {termsText.split('\n').map((l, i) => (
                    <span key={i} style={{ display: 'block' }}>{l}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Accounting totals */}
            <div style={{ minWidth: 240 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10.5, color: '#334155' }}>
                <span>Sub Total</span>
                <span style={{ fontWeight: '600', color: '#0F172A' }}>{fmt(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10.5, color: '#334155' }}>
                  <span>Discount</span>
                  <span style={{ fontWeight: '600', color: '#DC2626' }}>-{fmt(discountAmount)}</span>
                </div>
              )}
              {showTaxCols && taxAmount > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10.5, color: '#334155' }}>
                    <span>SGST</span>
                    <span style={{ fontWeight: '600', color: '#0F172A' }}>{fmt(taxAmount / 2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10.5, color: '#334155' }}>
                    <span>CGST</span>
                    <span style={{ fontWeight: '600', color: '#0F172A' }}>{fmt(taxAmount / 2)}</span>
                  </div>
                </>
              )}
              {showCessCol && cessAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10.5, color: '#334155' }}>
                  <span>CESS</span>
                  <span style={{ fontWeight: '600', color: '#0F172A' }}>{fmt(cessAmount)}</span>
                </div>
              )}
              {roundOff !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10.5, color: '#334155' }}>
                  <span>Round Off</span>
                  <span style={{ fontWeight: '600', color: '#0F172A' }}>{fmt(roundOff)}</span>
                </div>
              )}

              {/* HIGHLIGHTED GRAND TOTAL BLOCK */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '7px 9px',
                fontWeight: '800',
                fontSize: 13.5,
                borderTop: `1px solid ${accentColor}`,
                borderBottom: `1px solid ${accentColor}`,
                background: '#F8FAFC',
                marginTop: 6,
                color: accentColor,
              }}>
                <span>GRAND TOTAL</span>
                <span>{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* 5. PAYMENT SUMMARY, BANK DETAILS & SCANNABLE QR CODES (Matches Backend PDF) */}
          {(showPaymentSummary || showBankDetails || showUpiA4 || showDigitalBillQr) && (
            <div style={{
              background: '#F8FAFC',
              border: `1px solid ${secondaryColor}35`,
              borderRadius: 6,
              marginTop: 14,
              padding: '10px 14px',
              fontSize: 9.5,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {showPaymentSummary && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 8, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Status</span><br />
                        <b style={{
                          color: paymentStatus === 'PAID' ? '#16A34A' : paymentStatus === 'CANCELLED' ? '#DC2626' : '#D97706',
                          fontSize: 11,
                        }}>
                          {paymentStatus}
                        </b>
                      </div>
                      <div>
                        <span style={{ fontSize: 8, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Amount Paid</span><br />
                        <b style={{ color: '#0F172A', fontSize: 11 }}>{fmt(paidAmount)}</b>
                      </div>
                      {showBalanceDue && (
                        <div>
                          <span style={{ fontSize: 8, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Balance Due</span><br />
                          <b style={{ color: balanceDue > 0 ? '#DC2626' : '#0F172A', fontSize: 11 }}>
                            {fmt(balanceDue)}
                          </b>
                        </div>
                      )}
                      {showPaymentMode && (
                        <div>
                          <span style={{ fontSize: 8, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Mode</span><br />
                          <b style={{ color: '#0F172A', fontSize: 11 }}>{paymentMode}</b>
                        </div>
                      )}
                    </div>
                  )}

                  {showBankDetails && Boolean(bankDetailsText) && (
                    <div style={{ borderTop: showPaymentSummary ? '1px solid #E2E8F0' : 'none', marginTop: showPaymentSummary ? 8 : 0, paddingTop: showPaymentSummary ? 6 : 0, fontSize: 9, color: '#475569', lineHeight: 1.4 }}>
                      <b style={{ color: '#0F172A' }}>Bank Details:</b> {bankDetailsText}
                    </div>
                  )}
                </div>

                {/* QR Blocks matching backend pdf_utils.py */}
                {(showUpiA4 || showDigitalBillQr) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                    {showUpiA4 && qrValue && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-block', border: '1px solid #CBD5E1', padding: 3, borderRadius: 5, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                          <QRCodeSVG value={qrValue} size={qrSizeA4} level="M" />
                        </div>
                        <div style={{ marginTop: 2, fontWeight: '700', fontSize: 8, color: '#0F766E', letterSpacing: '0.03em' }}>SCAN TO PAY</div>
                      </div>
                    )}

                    {showDigitalBillQr && digitalBillUrl && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-block', border: '1px solid #CBD5E1', padding: 3, borderRadius: 5, background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                          <QRCodeSVG value={digitalBillUrl} size={qrSizeA4} level="M" />
                        </div>
                        <div style={{ marginTop: 2, fontWeight: '700', fontSize: 8, color: '#4F46E5', letterSpacing: '0.03em' }}>SCAN TO VIEW BILL</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. SIGNATURE AREA */}
          {showSignature && (
            <div style={{
              borderTop: '1px solid #CBD5E1',
              marginTop: 22,
              paddingTop: 24,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 9.5,
              color: '#475569',
            }}>
              <span>Prepared by</span>
              <span>Checked by</span>
              <span>Authorised Signatory</span>
            </div>
          )}

          {/* 7. CLEAN FOOTER */}
          {showFooter && (
            <div style={{
              borderTop: '1px solid #E2E8F0',
              marginTop: 12,
              paddingTop: 8,
              textAlign: footerAlign,
              fontSize: 9.5,
              color: '#475569',
            }}>
              <b style={{ color: '#334155' }}>{footerText.toUpperCase()}</b>
              <div style={{ marginTop: 2, fontSize: 8.5, color: '#64748B' }}>
                Date: {invoiceDate} {invoiceTime ? ` ${invoiceTime}` : ''}  ·  Bill Ref: {invoiceNo}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
