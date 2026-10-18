import { useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'

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
  return val === 'true' || val === true || val === 1 || val === '1'
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
  const accentColor = s.invoice_theme_color || tLayout.accent_color || '#1E3A5F'
  const secondaryColor = s.invoice_theme_secondary || tLayout.secondary_color || accentColor
  const invoiceBorderStyle = s.invoice_border_style || 'solid'
  const invoiceTableStyle = s.invoice_table_style || 'clean'

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
  const docHeading = isCancelled ? 'CANCELLED INVOICE' : 'TAX INVOICE'
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
          name: i.product_name || i.name || 'Item',
          sku: i.sku || '',
          barcode: i.barcode || '',
          hsn: i.hsn_code || i.hsn || '',
          unit: i.unit || '',
          batch: i.batch_number || i.batch_no || i.batch || '',
          manufacturing: i.manufacturing_date || i.mfg_date || '',
          expiry: i.expiry_date || i.exp_date || '',
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
      { name: 'Demo Product 1', sku: 'SKU-001', hsn: '1905', unit: 'pcs', qty: 2, rate: 250, disc: 5, gst: 18, gstAmt: 85.5, total: 560.5 },
      { name: 'Demo Product 2', sku: 'SKU-002', hsn: '2106', unit: 'box', qty: 1, rate: 450, disc: 0, gst: 12, gstAmt: 54.0, total: 504.0 },
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
  const showQtyCol = thermal ? isTrue(s.thermal_show_qty, true) : isTrue(s.show_qty_col, true)
  const showRateCol = thermal ? isTrue(s.thermal_show_rate, true) : isTrue(s.show_rate_col, true)
  const showTotalCol = thermal ? isTrue(s.thermal_show_total, true) : isTrue(s.show_total_col, true)
  const showSerialCol = isTrue(s.show_sr_no, true)
  const showItemName = isTrue(s.show_item_name, true)
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
  const showUpiA4 = isTrue(tPayment.show_upi_qr, isTrue(s.show_upi_qr_on_invoice, true)) && Boolean(upiId)
  const showUpiThermal = isTrue(s.thermal_show_upi_qr, isTrue(tPayment.show_upi_qr, isTrue(s.show_upi_qr_on_thermal, true))) && Boolean(upiId)
  const is58mm = mode === 'thermal_58' || (mode === 'thermal' && (s.thermal_paper_width === '58' || s.thermal_paper_width === '58mm' || s.thermal_paper_width === '2' || s.printer_type === 'thermal_58')) || tPage.thermal_roll_width === '58mm' || (s.invoice_template === 'thermal_58' && mode !== 'thermal_80' && mode !== 'a4' && mode !== 'half_a4')

  const qrSizeA4 = ({ small: 64, medium: 78, large: 96 })[s.upi_qr_size_a4] || 78
  const qrSizeThermal = is58mm
    ? ({ small: 64, medium: 78, large: 88 })[s.upi_qr_size_thermal] || 78
    : ({ small: 72, medium: 92, large: 110 })[s.upi_qr_size_thermal] || 92
  const qrValue = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoiceNo)}`

  // Digital Bill QR Code ("Scan to View Bill")
  const showDigitalBillQr = effectiveMode === 'thermal'
    ? isTrue(s.thermal_show_bill_qr, isTrue(s.enable_invoice_qr, true))
    : isTrue(tPayment.show_digital_bill_qr, isTrue(s.enable_invoice_qr, true))
  const digitalBillUrl = inv.short_url
    || (inv.public_token ? `${window.location.origin}/bill/${inv.public_token}` : `${window.location.origin}/bill/${inv.id || 'preview'}`)
    || (inv.id ? `http://127.0.0.1:8000/s/${inv.public_token ? inv.public_token.slice(0, 6) : inv.id}/` : '')

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
    return (
      <div className={`invoice-document-root ${className}`}>
        {showModePicker && <InvoiceModePicker mode={mode} onModeChange={onModeChange} settings={s} />}

        <div className="flex justify-center print:m-0">
          <div
            className="bg-white text-black border border-slate-300 shadow-sm print:shadow-none print:border-none"
            style={{
              width: is58mm ? 216 : 302,
              fontFamily: 'Courier New, monospace',
              fontSize: is58mm ? 9 : 10.5,
              padding: is58mm ? '8px 6px' : '12px 10px',
              lineHeight: 1.3,
            }}
          >
            {/* Store Identity Header */}
            {showShopDetails && (showLogo || showShopName || showAddress || showPhone || showEmail || showGstin) && (
              <>
                {/* Store Logo */}
                {showLogo && shopLogo && (
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <img
                      src={shopLogo}
                      alt="Store Logo"
                      style={{
                        maxHeight: is58mm ? 20 : 26,
                        maxWidth: is58mm ? 76 : 100,
                        objectFit: 'contain',
                        margin: '0 auto',
                        display: 'block',
                      }}
                    />
                  </div>
                )}

                {/* Header */}
                {showShopName && shopName && (
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: is58mm ? 12 : 13.5, marginBottom: 1 }}>
                    {shopName.toUpperCase()}
                  </div>
                )}
                {showAddress && shopAddress && shopAddress.split('\n').map((l, i) => (
                  <div key={i} style={{ textAlign: 'center', fontSize: is58mm ? 8.5 : 9.5 }}>{l}</div>
                ))}
                {(showPhone || showEmail) && (
                  <div style={{ textAlign: 'center', fontSize: is58mm ? 8.5 : 9.5 }}>
                    {showPhone && `Ph: ${shopPhone}`}
                    {showPhone && showEmail && ' | '}
                    {showEmail && shopEmail}
                  </div>
                )}
                {showGstin && shopGstin && (
                  <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: is58mm ? 8.5 : 9.5 }}>
                    GSTIN: {shopGstin}
                  </div>
                )}

                <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />
              </>
            )}

            {/* Document Title & Number */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: is58mm ? 10.5 : 12 }}>
              {isCancelled ? 'CANCELLED INVOICE' : s.thermal_title || docHeading}
            </div>
            {isTrue(s.thermal_show_invoice_no, true) && <div style={{ textAlign: 'center', fontSize: is58mm ? 9 : 10, fontWeight: '600' }}>{invoiceNo}</div>}
            {isTrue(s.thermal_show_date, true) && <div style={{ textAlign: 'center', fontSize: is58mm ? 8.5 : 9.5 }}>
              Date: {invoiceDate}{(isTrue(s.thermal_show_time, isTrue(s.show_invoice_time, true)) && invoiceTime) ? ` ${invoiceTime}` : ''}
            </div>}
            {isTrue(s.thermal_show_cashier, true) && inv.created_by_name && <div style={{ textAlign: 'center', fontSize: 8.5 }}>Cashier: {inv.created_by_name}</div>}
            {isTrue(s.thermal_show_payment_mode, showPaymentMode) && showPaymentMode && (
              <div style={{ textAlign: 'center', fontSize: is58mm ? 8.5 : 9.5 }}>Payment: {paymentMode}</div>
            )}
            {isTrue(s.thermal_show_place_of_supply, showPlaceOfSupply) && showPlaceOfSupply && (
              <div style={{ textAlign: 'center', fontSize: is58mm ? 8 : 9 }}>Place of Supply: {placeOfSupply}</div>
            )}

            {isCancelled && (
              <div style={{ textAlign: 'center', color: '#dc2626', fontWeight: 'bold', fontSize: 9.5, marginTop: 2 }}>
                *** CANCELLED ***
              </div>
            )}

            <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />

            {/* Customer */}
            {isTrue(s.thermal_show_customer_name, true) && <div style={{ fontSize: is58mm ? 9 : 10, fontWeight: 'bold' }}>CUSTOMER: {custName}</div>}
            {showCustAddress && isTrue(s.thermal_show_customer_address, true) && <div style={{ fontSize: is58mm ? 8 : 8.5 }}>{custAddress}</div>}
            {showCustPhone && isTrue(s.thermal_show_customer_phone, true) && <div style={{ fontSize: is58mm ? 8 : 8.5 }}>Ph: {custPhone}</div>}
            {showCustGstin && isTrue(s.thermal_show_customer_gstin, true) && <div style={{ fontSize: is58mm ? 8 : 8.5 }}>GSTIN: {custGstin}</div>}
            {isTrue(s.thermal_show_party_balance, isTrue(s.show_balance_due, true)) && (
              <div style={{ fontSize: is58mm ? 8 : 8.5 }}>Balance Due: {fmt(balanceDue)}</div>
            )}

            <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />

            {/* Items Section: Stacked 2-line layout for 58mm, 4-column layout for 80mm */}
            {is58mm ? (
              <div style={{ width: '100%', fontSize: 9 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #000',
                  paddingBottom: 2,
                  fontWeight: 'bold',
                  fontSize: 8.5,
                  textTransform: 'uppercase',
                }}>
                  <span>ITEM / DETAILS</span>
                  {showTotalCol && <span>AMOUNT</span>}
                </div>
                {items.map((item, idx) => (
                  <div key={idx} style={{ padding: '3px 0', borderBottom: '1px dotted #ccc' }}>
                    {showItemName && <div style={{ fontWeight: 'bold', fontSize: 9, lineHeight: 1.25 }}>{item.name}</div>}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      fontSize: 8,
                      color: '#222',
                      marginTop: 1,
                    }}>
                      <span>
                        {showQtyCol ? `${item.qty} ${showUnitCol && item.unit ? item.unit : ''}` : ''}{showQtyCol && showRateCol ? ' × ' : ''}{showRateCol ? item.rate.toFixed(2) : ''}
                        {isTrue(s.thermal_show_discount, showDiscCol) && showDiscCol && item.disc > 0 && ` (-${item.disc}%)`}
                        {isTrue(s.thermal_show_sku, true) && item.sku && ` SKU:${item.sku}`}
                        {isTrue(s.thermal_show_tax, showTaxCols) && showHsnCol && item.hsn && ` [HSN:${item.hsn}]`}
                        {showThermalBatch && item.batch && ` Batch:${item.batch}`}
                        {isTrue(s.thermal_show_barcode, false) && item.barcode && ` Barcode:${item.barcode}`}
                        {showThermalExpiry && item.expiry && ` EXP:${item.expiry}`}
                        {showMfgCol && item.manufacturing && ` MFG:${item.manufacturing}`}
                        {showThermalMrp && Number(item.mrp) > 0 && ` MRP:${fmt(item.mrp)}`}
                      </span>
                      {showTotalCol && <span style={{ fontWeight: 'bold', fontSize: 9, color: '#000' }}>
                        {item.total.toFixed(2)}
                      </span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: 9.5, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000' }}>
                    <th style={{ textAlign: 'left', paddingBottom: 3 }}>ITEM</th>
                    {showQtyCol && <th style={{ textAlign: 'center', width: 32 }}>QTY</th>}
                    {showRateCol && <th style={{ textAlign: 'right', width: 50 }}>RATE</th>}
                    {showTotalCol && <th style={{ textAlign: 'right', width: 58 }}>AMT</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                      <td style={{ paddingTop: 2, paddingBottom: 2 }}>
                        {showItemName && <div style={{ fontWeight: '600' }}>{item.name}</div>}
                        <div style={{ fontSize: 8, color: '#444' }}>
                          {isTrue(s.thermal_show_sku, true) && item.sku && <span>SKU: {item.sku} </span>}
                          {isTrue(s.thermal_show_tax, showTaxCols) && showHsnCol && item.hsn && <span>HSN: {item.hsn} </span>}
                          {isTrue(s.thermal_show_barcode, false) && item.barcode && <span>Barcode: {item.barcode} </span>}
                          {showThermalBatch && item.batch && <span>Batch: {item.batch} </span>}
                          {showThermalExpiry && item.expiry && <span>EXP: {item.expiry} </span>}
                          {showMfgCol && item.manufacturing && <span>MFG: {item.manufacturing} </span>}
                          {showThermalMrp && Number(item.mrp) > 0 && <span>MRP: {fmt(item.mrp)} </span>}
                          {isTrue(s.thermal_show_discount, showDiscCol) && showDiscCol && item.disc > 0 && <span>Disc: {item.disc}% </span>}
                          {showUnitCol && item.unit && <span>({item.unit})</span>}
                        </div>
                      </td>
                      {showQtyCol && <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: 2 }}>{item.qty}</td>}
                      {showRateCol && <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: 2 }}>{item.rate.toFixed(2)}</td>}
                      {showTotalCol && <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: 2, fontWeight: 'bold' }}>
                        {item.total.toFixed(2)}
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: is58mm ? 9 : 10 }}>
              <span>SUBTOTAL</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: is58mm ? 9 : 10 }}>
                <span>DISCOUNT</span>
                <span>-{fmt(discountAmount)}</span>
              </div>
            )}
            {showTaxCols && taxAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: is58mm ? 9 : 10 }}>
                <span>GST</span>
                <span>{fmt(taxAmount)}</span>
              </div>
            )}
            {roundOff !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: is58mm ? 9 : 10 }}>
                <span>ROUND OFF</span>
                <span>{fmt(roundOff)}</span>
              </div>
            )}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 'bold',
              fontSize: is58mm ? 11.5 : 12.5,
              marginTop: 4,
              paddingTop: 3,
              borderTop: '1px solid #000',
            }}>
              <span>GRAND TOTAL</span>
              <span>{fmt(grandTotal)}</span>
            </div>

            {/* Amount in words */}
            {showWords && (
              <div style={{ fontSize: is58mm ? 7.5 : 8.5, marginTop: 3, fontStyle: 'italic', lineHeight: 1.2 }}>
                {numberToIndianWords(grandTotal)}
              </div>
            )}

            {/* Settlement */}
            {showPaymentSummary && (
              <>
                <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />
                <div style={{ textAlign: 'center', fontSize: is58mm ? 8.5 : 9.5, fontWeight: 'bold' }}>
                  {paymentStatus} | PAID: {fmt(paidAmount)}
                  {showBalanceDue && balanceDue > 0 && ` | DUE: ${fmt(balanceDue)}`}
                </div>
              </>
            )}

            {/* UPI QR */}
            {showUpiThermal && (
              <>
                <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />
                <div style={{ textAlign: 'center', fontSize: is58mm ? 8.5 : 9.5, fontWeight: 'bold', marginBottom: 2 }}>
                  SCAN TO PAY
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '3px 0' }}>
                  <QRCodeSVG value={qrValue} size={qrSizeThermal} />
                </div>
                <div style={{ textAlign: 'center', fontSize: is58mm ? 8 : 9, wordBreak: 'break-all' }}>{upiId}</div>
              </>
            )}

            {/* Terms */}
            {isTrue(s.thermal_show_terms, showTerms) && Boolean(thermalTermsText) && (
              <div style={{ fontSize: 7.5, marginTop: 5, color: '#333', lineHeight: 1.25 }}>
                {thermalTermsText}
              </div>
            )}

            {/* Footer */}
            {(Boolean(s.receipt_footer) || showFooter) && (
              <div style={{ textAlign: 'center', fontSize: is58mm ? 8 : 9, marginTop: 5 }}>
                <b>{thermalFooterText}</b>
                <div style={{ fontSize: is58mm ? 7.5 : 8, marginTop: 1 }}>Date: {invoiceDate} | Ref: {invoiceNo}</div>
              </div>
            )}

            {/* Scan to View Bill QR */}
            {showDigitalBillQr && (
              <>
                <div style={{ borderTop: '1px dashed #000', margin: '5px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'center', margin: '3px 0' }}>
                  <QRCodeSVG value={digitalBillUrl} size={qrSizeThermal} />
                </div>
                <div style={{ textAlign: 'center', fontSize: 8, fontWeight: 'bold', marginTop: 1, letterSpacing: '0.02em' }}>
                  Scan to View Bill
                </div>
              </>
            )}
          </div>
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
        {showModePicker && <InvoiceModePicker mode={mode} onModeChange={onModeChange} settings={s} />}

        <div className="overflow-x-auto print:overflow-visible flex justify-center">
          <div
            className="bg-white text-[#0F172A] border shadow-sm print:shadow-none print:border-none rounded-sm print:m-0"
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

            {/* Bill To & UPI QR */}
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

              {showUpiA4 && (
                <div style={{ textAlign: 'center', fontSize: 8, color: '#475569' }}>
                  <div style={{ display: 'inline-block', border: '1px solid #E2E8F0', padding: 2, borderRadius: 4, background: '#FFFFFF' }}>
                    <QRCodeSVG value={qrValue} size={58} />
                  </div>
                  <div style={{ marginTop: 1, fontWeight: '600', fontSize: 8 }}>SCAN TO PAY</div>
                </div>
              )}
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5, marginTop: 2 }}>
              <thead>
                <tr style={{ background: invoiceTableStyle === 'bold' ? `${accentColor}18` : `${secondaryColor}10`, borderTop: `1px ${invoiceBorderStyle === 'dashed' ? 'dashed' : 'solid'} ${accentColor}`, borderBottom: `1px ${invoiceBorderStyle === 'dashed' ? 'dashed' : 'solid'} ${accentColor}` }}>
                  {showSerialCol && <th style={{ textAlign: 'center', padding: '4px 3px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 26 }}>#</th>}
                  {showItemName && <th style={{ textAlign: 'left', padding: '4px 4px', fontSize: 8.5, fontWeight: '700', color: '#334155' }}>Item</th>}
                  {showHsnCol && (
                    <th style={{ textAlign: 'center', padding: '4px 3px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 50 }}>HSN</th>
                  )}
                  {showQtyCol && <th style={{ textAlign: 'center', padding: '4px 3px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 34 }}>Qty</th>}
                  {showRateCol && <th style={{ textAlign: 'right', padding: '4px 4px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 56 }}>Rate</th>}
                  {showDiscCol && (
                    <th style={{ textAlign: 'right', padding: '4px 4px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 42 }}>Disc</th>
                  )}
                  {showTaxCols && (
                    <th style={{ textAlign: 'right', padding: '4px 4px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 44 }}>GST</th>
                  )}
                  {showTotalCol && <th style={{ textAlign: 'right', padding: '4px 4px', fontSize: 8.5, fontWeight: '700', color: '#334155', width: 64 }}>Amount</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px ${invoiceBorderStyle === 'dashed' ? 'dashed' : 'solid'} #E2E8F0`, background: invoiceTableStyle === 'striped' && idx % 2 === 1 ? `${secondaryColor}0A` : '#FFFFFF' }}>
                    {showSerialCol && <td style={{ padding: '4px 3px', textAlign: 'center', fontSize: 8.5, color: '#64748B' }}>{idx + 1}</td>}
                    {showItemName && <td style={{ padding: '4px 4px', fontSize: 9.5, color: '#0F172A', fontWeight: '500', wordBreak: 'break-word' }}>
                      <div>{item.name}</div>
                      {item.sku && showSkuCol && <span style={{ fontSize: 7.5, color: '#64748B' }}>SKU: {item.sku} </span>}
                      {item.barcode && showBarcodeCol && <span style={{ fontSize: 7.5, color: '#64748B' }}>Barcode: {item.barcode} </span>}
                      {item.unit && showUnitCol && <span style={{ fontSize: 7.5, color: '#64748B' }}>({item.unit})</span>}
                      {showBatchCol && item.batch && <span style={{ fontSize: 7.5, color: '#64748B' }}> Batch: {item.batch}</span>}
                      {showExpiryCol && item.expiry && <span style={{ fontSize: 7.5, color: '#64748B' }}> Expiry: {item.expiry}</span>}
                      {showMfgCol && item.manufacturing && <span style={{ fontSize: 7.5, color: '#64748B' }}> Mfg: {item.manufacturing}</span>}
                      {showMrpCol && Number(item.mrp) > 0 && <span style={{ fontSize: 7.5, color: '#64748B' }}> MRP: {fmt(item.mrp)}</span>}
                    </td>}
                    {showHsnCol && (
                      <td style={{ padding: '4px 3px', textAlign: 'center', fontSize: 8.5, color: '#64748B' }}>{item.hsn || '—'}</td>
                    )}
                    {showQtyCol && <td style={{ padding: '4px 3px', textAlign: 'center', fontSize: 9.5, color: '#0F172A' }}>{item.qty}</td>}
                    {showRateCol && <td style={{ padding: '4px 4px', textAlign: 'right', fontSize: 9.5, color: '#0F172A' }}>{fmt(item.rate)}</td>}
                    {showDiscCol && (
                      <td style={{ padding: '4px 4px', textAlign: 'right', fontSize: 8.5, color: '#64748B' }}>
                        {item.disc ? `${item.disc}%` : '—'}
                      </td>
                    )}
                    {showTaxCols && (
                      <td style={{ padding: '4px 4px', textAlign: 'right', fontSize: 8.5, color: '#334155' }}>
                        {item.gst ? `${item.gst}%` : '—'}
                      </td>
                    )}
                    {showTotalCol && <td style={{ padding: '4px 4px', textAlign: 'right', fontWeight: '700', fontSize: 9.5, color: '#0F172A' }}>
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

            {/* Payment Summary */}
            {showPaymentSummary && (
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: 4,
                marginTop: 8,
                padding: '6px 10px',
                fontSize: 8.5,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

                {showBankDetails && (
                  <div style={{ borderTop: '1px solid #E2E8F0', marginTop: 4, paddingTop: 4, fontSize: 8, color: '#475569' }}>
                    <b>Bank Details:</b> {bankDetailsText}
                  </div>
                )}
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

            {/* Scan to View Bill QR */}
            {showDigitalBillQr && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
                marginBottom: 2,
              }}>
                <QRCodeSVG value={digitalBillUrl} size={qrSizeA4} />
                <span style={{ fontSize: 8, fontWeight: '700', color: '#475569', marginTop: 2, letterSpacing: '0.02em' }}>
                  Scan to View Bill
                </span>
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
  return (
    <div className={`invoice-document-root ${className}`}>
      {showModePicker && <InvoiceModePicker mode={mode} onModeChange={onModeChange} settings={s} />}

      <div className="overflow-x-auto print:overflow-visible">
        <div
          className="bg-white text-[#0F172A] border border-slate-200 shadow-sm print:shadow-none print:border-none mx-auto rounded-sm print:m-0"
          style={{
            width: 794,
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
              border: isCorporateA4 ? '1px solid #CBD5E1' : undefined,
              borderTop: isCorporateA4 ? '4px solid #1E3A5F' : undefined,
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
                color: isCancelled ? '#DC2626' : isCorporateA4 ? '#0F766E' : '#0F172A',
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

          <div style={{ borderTop: '1px solid #CBD5E1', marginBottom: 10 }} />

          {/* 2. BILL TO CUSTOMER SECTION & OPTIONAL UPI QR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
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

            {showUpiA4 && (
              <div style={{ textAlign: 'center', fontSize: 8.5, color: '#475569' }}>
                <div style={{ fontWeight: '700', marginBottom: 2 }}>UPI PAYMENT</div>
                <div style={{ display: 'inline-block', border: '1px solid #E2E8F0', padding: 3, borderRadius: 4, background: '#FFFFFF' }}>
                  <QRCodeSVG value={qrValue} size={qrSizeA4} />
                </div>
                <div style={{ marginTop: 2, fontWeight: '600' }}>SCAN TO PAY</div>
              </div>
            )}
          </div>

          {/* 3. DYNAMIC ITEM TABLE WITH LIGHT SHADED HEADER */}
          <table className={isCorporateA4 ? 'settings-corporate-table' : undefined} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5, marginTop: 4 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderTop: '1px solid #334155', borderBottom: '1px solid #334155' }}>
                {showSerialCol && <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 34 }}>S.No</th>}
                {showSkuCol && (
                  <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 70 }}>Item Code</th>
                )}
                {showBarcodeCol && <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 75 }}>Barcode</th>}
                {showItemName && <th style={{ textAlign: 'left', padding: '6px 6px', fontSize: 9, fontWeight: '700', color: '#334155' }}>Item Description</th>}
                {showHsnCol && (
                  <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 65 }}>HSN/SAC</th>
                )}
                {showUnitCol && (
                  <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 45 }}>Unit</th>
                )}
                {showBatchCol && (
                  <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 55 }}>Batch</th>
                )}
                {showExpiryCol && <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 58 }}>Expiry</th>}
                {showMfgCol && <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 58 }}>Mfg.</th>}
                {showMrpCol && <th style={{ textAlign: 'right', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 58 }}>MRP</th>}
                {showQtyCol && <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 42 }}>Qty</th>}
                {showRateCol && <th style={{ textAlign: 'right', padding: '6px 6px', fontSize: 9, fontWeight: '700', color: '#334155', width: 72 }}>Rate</th>}
                {showDiscCol && (
                  <th style={{ textAlign: 'right', padding: '6px 6px', fontSize: 9, fontWeight: '700', color: '#334155', width: 52 }}>Disc.</th>
                )}
                {showTaxCols && (
                  <>
                    <th style={{ textAlign: 'right', padding: '6px 6px', fontSize: 9, fontWeight: '700', color: '#334155', width: 62 }}>SGST</th>
                    <th style={{ textAlign: 'right', padding: '6px 6px', fontSize: 9, fontWeight: '700', color: '#334155', width: 62 }}>CGST</th>
                  </>
                )}
                {showCessCol && (
                  <th style={{ textAlign: 'right', padding: '6px 6px', fontSize: 9, fontWeight: '700', color: '#334155', width: 54 }}>CESS</th>
                )}
                {showTotalCol && <th style={{ textAlign: 'right', padding: '6px 6px', fontSize: 9, fontWeight: '700', color: '#334155', width: 84 }}>Amount</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  {showSerialCol && <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9.5, color: '#64748B' }}>{idx + 1}</td>}
                  {showSkuCol && (
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9.5, color: '#475569' }}>{item.sku || '—'}</td>
                  )}
                  {showBarcodeCol && <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9, color: '#64748B' }}>{item.barcode || '—'}</td>}
                  {showItemName && <td style={{ padding: '6px 6px', fontSize: 10.5, color: '#0F172A', fontWeight: '500' }}>{item.name}</td>}
                  {showHsnCol && (
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9.5, color: '#64748B' }}>{item.hsn || '—'}</td>
                  )}
                  {showUnitCol && (
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9.5, color: '#64748B' }}>{item.unit || '—'}</td>
                  )}
                  {showBatchCol && (
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9.5, color: '#64748B' }}>{item.batch || '—'}</td>
                  )}
                  {showExpiryCol && <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9.5, color: '#64748B' }}>{item.expiry || '—'}</td>}
                  {showMfgCol && <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9.5, color: '#64748B' }}>{item.manufacturing || '—'}</td>}
                  {showMrpCol && <td style={{ padding: '6px 4px', textAlign: 'right', fontSize: 9.5, color: '#64748B' }}>{Number(item.mrp) > 0 ? fmt(item.mrp) : '—'}</td>}
                  {showQtyCol && <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 10.5, color: '#0F172A' }}>{item.qty}</td>}
                  {showRateCol && <td style={{ padding: '6px 6px', textAlign: 'right', fontSize: 10.5, color: '#0F172A' }}>{fmt(item.rate)}</td>}
                  {showDiscCol && (
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontSize: 9.5, color: '#64748B' }}>
                      {item.disc ? `${item.disc}%` : '—'}
                    </td>
                  )}
                  {showTaxCols && (
                    <>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontSize: 10, color: '#334155' }}>{fmt(item.gstAmt / 2)}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontSize: 10, color: '#334155' }}>{fmt(item.gstAmt / 2)}</td>
                    </>
                  )}
                  {showCessCol && (
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontSize: 9.5, color: '#64748B' }}>{fmt(0)}</td>
                  )}
                  {showTotalCol && <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: '700', fontSize: 10.5, color: '#0F172A' }}>
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
                borderTop: '1px solid #0F172A',
                borderBottom: '1px solid #0F172A',
                background: '#F1F5F9',
                marginTop: 6,
                color: '#0F172A',
              }}>
                <span>GRAND TOTAL</span>
                <span>{fmt(grandTotal)}</span>
              </div>
            </div>
          </div>

          {/* 5. PAYMENT SUMMARY & BANK DETAILS */}
          {showPaymentSummary && (
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              borderRadius: 4,
              marginTop: 14,
              padding: '8px 14px',
              fontSize: 9.5,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: 8.5, color: '#475569', fontWeight: '700' }}>PAYMENT STATUS</span><br />
                  <b style={{
                    color: paymentStatus === 'PAID' ? '#16A34A' : paymentStatus === 'CANCELLED' ? '#DC2626' : '#D97706',
                    fontSize: 11,
                  }}>
                    {paymentStatus}
                  </b>
                </div>
                <div>
                  <span style={{ fontSize: 8.5, color: '#475569', fontWeight: '700' }}>AMOUNT PAID</span><br />
                  <b style={{ color: '#0F172A', fontSize: 11 }}>{fmt(paidAmount)}</b>
                </div>
                {showBalanceDue && (
                  <div>
                    <span style={{ fontSize: 8.5, color: '#475569', fontWeight: '700' }}>BALANCE DUE</span><br />
                    <b style={{ color: balanceDue > 0 ? '#DC2626' : '#0F172A', fontSize: 11 }}>
                      {fmt(balanceDue)}
                    </b>
                  </div>
                )}
                {showPaymentMode && (
                  <div>
                    <span style={{ fontSize: 8.5, color: '#475569', fontWeight: '700' }}>MODE</span><br />
                    <b style={{ color: '#0F172A', fontSize: 11 }}>{paymentMode}</b>
                  </div>
                )}
              </div>

              {showBankDetails && (
                <div style={{ borderTop: '1px solid #E2E8F0', marginTop: 6, paddingTop: 5, fontSize: 9, color: '#475569' }}>
                  <b>Bank Details:</b> {bankDetailsText}
                </div>
              )}
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

          {/* Scan to View Bill QR */}
          {showDigitalBillQr && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 14,
              marginBottom: 4,
            }}>
              <QRCodeSVG value={digitalBillUrl} size={qrSizeA4} />
              <span style={{ fontSize: 9, fontWeight: '700', color: '#475569', marginTop: 3, letterSpacing: '0.02em' }}>
                Scan to View Bill
              </span>
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
