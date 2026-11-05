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
  if (str === 'true' || str === '1' || str === 'yes' || str === 'on') return true
  if (str === 'false' || str === '0' || str === 'no' || str === 'off') return false
  return defaultVal
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

  // 2. Store identity toggles
  const showShopDetails = parseBooleanSetting(s.show_shop_details, parseBooleanSetting(s.show_business_info, true))
  const showBusinessName = showShopDetails && parseBooleanSetting(s.show_business_name, parseBooleanSetting(s.show_shop_name, true))
  const showBusinessAddress = showShopDetails && parseBooleanSetting(s.show_business_address, true)
  const showBusinessPhone = showShopDetails && parseBooleanSetting(s.show_business_phone, true)
  const showBusinessEmail = showShopDetails && parseBooleanSetting(s.show_business_email, false)
  const showBusinessGstin = showShopDetails && parseBooleanSetting(s.show_business_gstin, true)
  const showLogo = showShopDetails && parseBooleanSetting(s.thermal_show_logo, parseBooleanSetting(s.show_business_logo, true))

  // 3. Invoice Controls
  const showInvoiceNo = parseBooleanSetting(s.thermal_show_invoice_no, true)
  const showDate = parseBooleanSetting(s.thermal_show_date, true)
  const showTime = parseBooleanSetting(s.thermal_show_time, parseBooleanSetting(s.show_invoice_time, true))
  const showCashier = parseBooleanSetting(s.thermal_show_cashier, false)
  const showPaymentMode = parseBooleanSetting(s.thermal_show_payment_mode, parseBooleanSetting(s.show_payment_mode, true))
  const showPlaceOfSupply = parseBooleanSetting(s.thermal_show_place_of_supply, parseBooleanSetting(s.show_place_of_supply, false))

  // 4. Customer / Party
  const showCustomerName = parseBooleanSetting(s.thermal_show_customer_name, parseBooleanSetting(s.show_customer_name, true))
  const showCustomerPhone = parseBooleanSetting(s.thermal_show_customer_phone, parseBooleanSetting(s.show_customer_phone, false))
  const showCustomerGstin = parseBooleanSetting(s.thermal_show_customer_gstin, parseBooleanSetting(s.show_customer_gstin, false))
  const showCustomerAddress = parseBooleanSetting(s.thermal_show_customer_address, parseBooleanSetting(s.show_customer_address, false))

  // 5. Items
  const showSku = parseBooleanSetting(s.thermal_show_sku, parseBooleanSetting(s.show_sku_col, false))
  const showBarcode = parseBooleanSetting(s.thermal_show_barcode, parseBooleanSetting(s.show_barcode_col, false))
  const showQty = parseBooleanSetting(s.thermal_show_qty, parseBooleanSetting(s.show_qty_col, true))
  const showRate = parseBooleanSetting(s.thermal_show_rate, parseBooleanSetting(s.show_rate_col, true))
  const showTotal = parseBooleanSetting(s.thermal_show_total, parseBooleanSetting(s.show_total_col, true))
  const showDiscount = parseBooleanSetting(s.thermal_show_discount, parseBooleanSetting(s.show_discount_col, false))
  const showTax = parseBooleanSetting(s.thermal_show_tax, parseBooleanSetting(s.show_tax_cols, false))
  const showBatch = parseBooleanSetting(s.thermal_show_batch, parseBooleanSetting(s.show_batch_col, false))
  const showExpiry = parseBooleanSetting(s.thermal_show_expiry, parseBooleanSetting(s.show_expiry_col, false))
  const showMrp = parseBooleanSetting(s.thermal_show_mrp, parseBooleanSetting(s.show_mrp_col, parseBooleanSetting(s.show_price_history, false)))
  const showItemDesc = parseBooleanSetting(s.thermal_show_item_desc, parseBooleanSetting(s.show_item_description, false))

  // 6. Totals & Settlement
  const showSubtotal = parseBooleanSetting(s.show_subtotal, true)
  const showPartyBalance = parseBooleanSetting(s.thermal_show_party_balance, parseBooleanSetting(s.show_balance_due, false))

  // 7. UPI QR
  const upiId = (s.shop_upi_id || '').trim()
  const upiMerchantName = (s.upi_merchant_name || s.shop_name || '').trim()
  const upiConfigured = Boolean(upiId)
  const upiValid = isValidUpiId(upiId)
  const showUpiQrToggle = parseBooleanSetting(
    s.thermal_show_upi_qr,
    parseBooleanSetting(s.show_upi_qr_on_thermal, parseBooleanSetting(s.upi_qr_enabled, true))
  )

  // 8. Digital Bill QR
  const showBillQr = parseBooleanSetting(
    s.thermal_show_bill_qr,
    parseBooleanSetting(s.show_bill_qr_on_thermal, false)
  )
  const shareDomain = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_SHARE_URL) || (typeof window !== 'undefined' ? window.location.origin : '')
  let digitalBillUrl = ''
  if (inv.short_url) {
    digitalBillUrl = inv.short_url
  } else if (inv.public_token && shareDomain) {
    digitalBillUrl = `${shareDomain}/b/${inv.public_token}`
  } else if (inv.id && shareDomain && !String(inv.id).includes('preview')) {
    digitalBillUrl = `${shareDomain}/b/${inv.id}`
  }

  // 9. Terms & Footer
  const showTerms = parseBooleanSetting(s.thermal_show_terms, parseBooleanSetting(s.show_terms, false))
  const termsText = (s.thermal_terms || s.invoice_terms || '').trim()
  const showFooter = parseBooleanSetting(s.thermal_show_footer, parseBooleanSetting(s.show_footer, true))
  const footerText = (s.receipt_footer || 'Thank you for shopping with us!\nVisit Again!').trim()

  return {
    width,
    is58mm: width === 58,
    is80mm: width === 80,

    title: (s.thermal_title || s.invoice_title || 'TAX INVOICE').trim(),
    showShopDetails,
    showBusinessName,
    showBusinessAddress,
    showBusinessPhone,
    showBusinessEmail,
    showBusinessGstin,
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

    showSubtotal,
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
    showFooter,
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
