/**
 * Centralized Thermal Settings Normalization Contract
 * 
 * Normalizes raw settings from Settings.jsx and backend GET /settings/all/
 * into a single consistent, type-safe contract used by both the preview
 * and live printing.
 */

export function parseBooleanSetting(val, defaultVal = false) {
  if (val === undefined || val === null || val === '') return defaultVal
  if (typeof val === 'boolean') return val
  const str = String(val).trim().toLowerCase()
  return str === 'true' || str === '1' || str === 'yes'
}

export function isValidUpiId(upiId) {
  if (!upiId || typeof upiId !== 'string') return false
  const trimmed = upiId.trim()
  // Basic UPI ID validation: username@bankhandle (at least one @, no spaces, characters on both sides)
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9.\-_]{2,64}$/.test(trimmed)
}

export function buildUpiPaymentUrl({
  upiId,
  merchantName,
  amount,
  invoiceNumber,
  isFullyPaid = false,
}) {
  if (!upiId || !isValidUpiId(upiId)) return ''

  const params = new URLSearchParams()
  params.set('pa', upiId.trim())
  if (merchantName?.trim()) {
    params.set('pn', merchantName.trim())
  }
  params.set('cu', 'INR')

  // Dynamic amount: only include 'am' when there is an active payable balance.
  // Never generate a ₹0 payment QR, which causes immediate failure on PhonePe/GPay/Paytm.
  const numAmount = Number(amount || 0)
  if (!isFullyPaid && numAmount > 0) {
    params.set('am', numAmount.toFixed(2))
  }

  if (invoiceNumber) {
    params.set('tn', String(invoiceNumber))
  }

  return `upi://pay?${params.toString()}`
}

export function normalizeThermalSettings(rawSettings = {}, invoice = null) {
  const s = rawSettings || {}
  const inv = invoice || {}

  // 1. Width normalization: supports '58', '80', '2', '3', '58mm', '80mm'
  const widthRaw = String(s.thermal_paper_width || s.printer_paper_width || '').trim().toLowerCase()
  const width = (widthRaw === '58' || widthRaw === '2' || widthRaw === '58mm') ? 58 : 80

  // 2. Precedence fallbacks with retail defaults
  const showLogo = parseBooleanSetting(s.thermal_show_logo, parseBooleanSetting(s.show_business_logo, true))
  const showInvoiceNo = parseBooleanSetting(s.thermal_show_invoice_no, true)
  const showDate = parseBooleanSetting(s.thermal_show_date, true)
  const showTime = parseBooleanSetting(s.thermal_show_time, parseBooleanSetting(s.show_invoice_time, true))
  const showCashier = parseBooleanSetting(s.thermal_show_cashier, false)
  const showPaymentMode = parseBooleanSetting(s.thermal_show_payment_mode, parseBooleanSetting(s.show_payment_mode, true))
  const showPlaceOfSupply = parseBooleanSetting(s.thermal_show_place_of_supply, false)

  // Customer / Party
  const showCustomerName = parseBooleanSetting(s.thermal_show_customer_name, true)
  const showCustomerPhone = parseBooleanSetting(s.thermal_show_customer_phone, false)
  const showCustomerGstin = parseBooleanSetting(s.thermal_show_customer_gstin, false)
  const showCustomerAddress = parseBooleanSetting(s.thermal_show_customer_address, false)

  // Items
  const showSku = parseBooleanSetting(s.thermal_show_sku, false)
  const showBarcode = parseBooleanSetting(s.thermal_show_barcode, false)
  const showQty = parseBooleanSetting(s.thermal_show_qty, true)
  const showRate = parseBooleanSetting(s.thermal_show_rate, true)
  const showTotal = parseBooleanSetting(s.thermal_show_total, true)
  const showDiscount = parseBooleanSetting(s.thermal_show_discount, false)
  const showTax = parseBooleanSetting(s.thermal_show_tax, false)
  const showBatch = parseBooleanSetting(s.thermal_show_batch, false)
  const showExpiry = parseBooleanSetting(s.thermal_show_expiry, false)
  const showMrp = parseBooleanSetting(s.thermal_show_mrp, false)
  const showItemDesc = parseBooleanSetting(s.thermal_show_item_desc, false)

  // Totals & Settlement
  const showPartyBalance = parseBooleanSetting(s.thermal_show_party_balance, false)

  // UPI QR
  const upiId = (s.shop_upi_id || '').trim()
  const upiMerchantName = (s.upi_merchant_name || s.shop_name || '').trim()
  const upiConfigured = Boolean(upiId)
  const upiValid = isValidUpiId(upiId)
  const showUpiQrToggle = parseBooleanSetting(
    s.thermal_show_upi_qr,
    parseBooleanSetting(s.show_upi_qr_on_thermal, parseBooleanSetting(s.upi_qr_enabled, true))
  )

  // Digital Bill QR
  const showBillQr = parseBooleanSetting(s.thermal_show_bill_qr, false)
  const shareDomain = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_SHARE_URL) || (typeof window !== 'undefined' ? window.location.origin : '')
  let digitalBillUrl = ''
  if (inv.short_url) {
    digitalBillUrl = inv.short_url
  } else if (inv.public_token && shareDomain) {
    digitalBillUrl = `${shareDomain}/bill/${inv.public_token}`
  } else if (inv.id && shareDomain && !String(inv.id).includes('preview')) {
    digitalBillUrl = `${shareDomain}/bill/${inv.id}`
  }

  // Terms & Footer
  const showTerms = parseBooleanSetting(s.thermal_show_terms, false)
  const termsText = (s.thermal_terms || s.invoice_terms || '').trim()
  const footerText = (s.receipt_footer || 'Thank you for shopping with us!\nVisit Again!').trim()

  return {
    width,
    is58mm: width === 58,
    is80mm: width === 80,

    title: (s.thermal_title || 'TAX INVOICE').trim(),
    showLogo,
    showInvoiceNo,
    showDate,
    showTime,
    showCashier,
    showPaymentMode,
    showPlaceOfSupply,

    showCustomerName,
    showCustomerPhone,
    showCustomerGstin,
    showCustomerAddress,

    showSku,
    showBarcode,
    showQty,
    showRate,
    showTotal,
    showDiscount,
    showTax,
    showBatch,
    showExpiry,
    showMrp,
    showItemDesc,

    showPartyBalance,

    showUpiQrToggle,
    upiConfigured,
    upiValid,
    // Only actually render on receipt if enabled AND a valid UPI ID exists
    renderUpiQr: showUpiQrToggle && upiValid,

    showBillQr,
    digitalBillUrl: digitalBillUrl || null,
    renderBillQr: showBillQr && Boolean(digitalBillUrl),

    showTerms,
    termsText,
    footerText,

    openCashDrawer: parseBooleanSetting(s.open_cash_drawer, false),
    printDuplicate: parseBooleanSetting(s.print_duplicate, false),

    // Business identity
    shopName: (s.shop_name || 'SRI BALAJI STORE').trim(),
    shopAddress: (s.shop_address || '').trim(),
    shopPhone: (s.shop_phone || '').trim(),
    shopEmail: (s.shop_email || '').trim(),
    shopGstin: (s.shop_gstin || '').trim(),
    shopLogo: s.shop_logo || '',
    shopUpiId: upiId,
    upiMerchantName,
  }
}

