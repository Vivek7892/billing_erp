/**
 * Centralized Invoice Configuration Normalization Contract
 * 
 * Precedence Order:
 * 1. Template-specific saved setting (templateConfig fields / flat keys)
 * 2. Thermal-specific setting (if mode is thermal)
 * 3. Global invoice setting (settings)
 * 4. System default
 */

export function parseBool(val, defaultVal = true) {
  if (val === undefined || val === null || val === '') return defaultVal
  if (typeof val === 'boolean') return val
  const str = String(val).trim().toLowerCase()
  if (str === 'true' || str === '1' || str === 'yes' || str === 'on') return true
  if (str === 'false' || str === '0' || str === 'no' || str === 'off') return false
  return defaultVal
}

export function normalizeInvoiceConfig(settings = {}, templateConfig = null, mode = 'a4') {
  const s = settings || {}
  const t = templateConfig || {}

  const tBiz = t.business_info || {}
  const tFields = t.fields || {}
  const tLayout = t.layout || {}
  const tTax = t.tax || {}
  const tPayment = t.payment || {}
  const tPage = t.page || {}

  const isThermal = mode === 'thermal' || mode === 'thermal_80' || mode === 'thermal_58' || String(s.invoice_template || '').startsWith('thermal')
  const is58mm = mode === 'thermal_58' || (isThermal && (String(s.thermal_paper_width || '').trim() in { '58': 1, '2': 1, '58mm': 1 } || tPage.thermal_roll_width === '58mm'))
  const isHalfA4 = mode === 'half_a4' || mode === 'a5' || s.invoice_template === 'half_a4'

  // Header settings
  const rawShowShopDetails = tBiz.show_shop_details !== undefined
    ? tBiz.show_shop_details
    : (tBiz.show_business_info !== undefined ? tBiz.show_business_info : (s.show_shop_details !== undefined ? s.show_shop_details : s.show_business_info))
  const showShopDetails = parseBool(rawShowShopDetails, true)

  const rawShowStoreName = tBiz.show_name !== undefined
    ? tBiz.show_name
    : (tBiz.show_business_name !== undefined ? tBiz.show_business_name : (t.show_business_name !== undefined ? t.show_business_name : (s.show_business_name !== undefined ? s.show_business_name : s.show_shop_name)))
  const showStoreName = showShopDetails && parseBool(rawShowStoreName, true)

  const rawShowLogo = tBiz.show_logo !== undefined
    ? tBiz.show_logo
    : (t.show_business_logo !== undefined ? t.show_business_logo : (isThermal ? s.thermal_show_logo : s.show_business_logo))
  const showLogo = showShopDetails && parseBool(rawShowLogo, !is58mm)

  const showAddress = showShopDetails && parseBool(
    tBiz.show_address !== undefined ? tBiz.show_address : (t.show_business_address !== undefined ? t.show_business_address : s.show_business_address),
    true
  )
  const showPhone = showShopDetails && parseBool(
    tBiz.show_phone !== undefined ? tBiz.show_phone : (t.show_business_phone !== undefined ? t.show_business_phone : s.show_business_phone),
    true
  )
  const showEmail = showShopDetails && parseBool(
    tBiz.show_email !== undefined ? tBiz.show_email : (t.show_business_email !== undefined ? t.show_business_email : s.show_business_email),
    !isHalfA4 && !isThermal
  )
  const showGstin = showShopDetails && parseBool(
    tBiz.show_gstin !== undefined ? tBiz.show_gstin : (t.show_business_gstin !== undefined ? t.show_business_gstin : s.show_business_gstin),
    true
  )
  const showPan = showShopDetails && parseBool(
    tBiz.show_pan !== undefined ? tBiz.show_pan : (t.show_business_pan !== undefined ? t.show_business_pan : s.show_business_pan),
    !isHalfA4 && !isThermal
  )
  const showCin = showShopDetails && parseBool(s.show_cin_on_invoice, false)
  const showFssai = showShopDetails && parseBool(s.show_fssai_on_invoice, false)

  // Document Title
  const title = (
    (t.invoice_title && String(t.invoice_title).trim())
    || (tLayout.invoice_title && String(tLayout.invoice_title).trim())
    || (s.invoice_title && String(s.invoice_title).trim())
    || 'TAX INVOICE'
  )

  // Party / Customer settings
  const showCustomerName = parseBool(
    tFields.show_customer_name !== undefined ? tFields.show_customer_name : (t.show_customer_name !== undefined ? t.show_customer_name : (isThermal ? s.thermal_show_customer_name : s.show_customer_name)),
    true
  )
  const showCustomerPhone = parseBool(
    tFields.show_customer_phone !== undefined ? tFields.show_customer_phone : (t.show_customer_phone !== undefined ? t.show_customer_phone : (isThermal ? s.thermal_show_customer_phone : s.show_customer_phone)),
    !isThermal
  )
  const showCustomerAddress = parseBool(
    tFields.show_customer_address !== undefined ? tFields.show_customer_address : (t.show_customer_address !== undefined ? t.show_customer_address : (isThermal ? s.thermal_show_customer_address : s.show_customer_address)),
    !isThermal
  )
  const showCustomerGstin = parseBool(
    tFields.show_customer_gstin !== undefined ? tFields.show_customer_gstin : (t.show_customer_gstin !== undefined ? t.show_customer_gstin : (isThermal ? s.thermal_show_customer_gstin : s.show_customer_gstin)),
    !isThermal
  )
  const showPlaceOfSupply = parseBool(
    tFields.show_place_of_supply !== undefined ? tFields.show_place_of_supply : (t.show_place_of_supply !== undefined ? t.show_place_of_supply : (isThermal ? s.thermal_show_place_of_supply : s.show_place_of_supply)),
    !isThermal
  )
  const showPaymentMode = parseBool(
    tFields.show_payment_mode !== undefined ? tFields.show_payment_mode : (t.show_payment_mode !== undefined ? t.show_payment_mode : (isThermal ? s.thermal_show_payment_mode : s.show_payment_mode)),
    true
  )

  // Item Table Columns
  const showSrNo = parseBool(t.show_sr_no !== undefined ? t.show_sr_no : s.show_sr_no, true)
  const showItemName = parseBool(t.show_item_name !== undefined ? t.show_item_name : s.show_item_name, true)
  const showItemDescription = parseBool(t.show_item_description !== undefined ? t.show_item_description : s.show_item_description, false)
  const showHsn = parseBool(
    tFields.show_hsn !== undefined ? tFields.show_hsn : (t.show_hsn_col !== undefined ? t.show_hsn_col : (isThermal ? s.thermal_show_hsn : s.show_hsn_col)),
    !isThermal
  )
  const showSku = parseBool(
    tFields.show_sku !== undefined ? tFields.show_sku : (t.show_sku_col !== undefined ? t.show_sku_col : (isThermal ? s.thermal_show_sku : s.show_sku_col)),
    false
  )
  const showBarcode = parseBool(
    t.show_barcode_col !== undefined ? t.show_barcode_col : (isThermal ? s.thermal_show_barcode : s.show_barcode_col),
    false
  )
  const showBatch = parseBool(
    tFields.show_batch !== undefined ? tFields.show_batch : (t.show_batch_col !== undefined ? t.show_batch_col : (isThermal ? s.thermal_show_batch : s.show_batch_col)),
    false
  )
  const showMfgDate = parseBool(t.show_mfg_date !== undefined ? t.show_mfg_date : s.show_mfg_date, false)
  const showExpiryDate = parseBool(
    tFields.show_expiry !== undefined ? tFields.show_expiry : (t.show_expiry_col !== undefined ? t.show_expiry_col : (isThermal ? s.thermal_show_expiry : s.show_expiry_col)),
    false
  )
  const showMrp = parseBool(
    t.show_mrp_col !== undefined ? t.show_mrp_col : (isThermal ? s.thermal_show_mrp : s.show_mrp_col),
    false
  )
  const showQty = parseBool(
    t.show_qty_col !== undefined ? t.show_qty_col : (isThermal ? s.thermal_show_qty : s.show_qty_col),
    true
  )
  const showUnit = parseBool(
    tFields.show_unit !== undefined ? tFields.show_unit : (t.show_unit_col !== undefined ? t.show_unit_col : s.show_unit_col),
    false
  )
  const showRate = parseBool(
    tFields.show_rate !== undefined ? tFields.show_rate : (t.show_rate_col !== undefined ? t.show_rate_col : (isThermal ? s.thermal_show_rate : s.show_rate_col)),
    true
  )
  const showDiscount = parseBool(
    tFields.show_discount !== undefined ? tFields.show_discount : (t.show_discount_col !== undefined ? t.show_discount_col : (isThermal ? s.thermal_show_discount : s.show_discount_col)),
    !is58mm
  )
  const showTaxCols = parseBool(
    tFields.show_tax_breakup !== undefined ? tFields.show_tax_breakup : (t.show_tax_cols !== undefined ? t.show_tax_cols : (isThermal ? s.thermal_show_tax : s.show_tax_cols)),
    !isThermal
  )
  const showTotal = parseBool(
    t.show_total_col !== undefined ? t.show_total_col : (isThermal ? s.thermal_show_total : s.show_total_col),
    true
  )

  // Totals & Breakdown
  const showSubtotal = parseBool(tTax.show_subtotal !== undefined ? tTax.show_subtotal : (t.show_subtotal !== undefined ? t.show_subtotal : s.show_subtotal), true)
  const showDiscountTotal = parseBool(tTax.show_discount_total !== undefined ? tTax.show_discount_total : (t.show_discount_total !== undefined ? t.show_discount_total : s.show_discount_total), true)
  const showTaxBreakdown = parseBool(tTax.show_tax_summary !== undefined ? tTax.show_tax_summary : (t.show_tax_breakdown !== undefined ? t.show_tax_breakdown : s.show_tax_breakdown), !isThermal)
  const showRoundOff = parseBool(tTax.show_round_off !== undefined ? tTax.show_round_off : (t.show_round_off !== undefined ? t.show_round_off : s.round_off), true)
  const showAmountInWords = parseBool(
    tTax.show_amount_in_words !== undefined ? tTax.show_amount_in_words : (t.show_amount_in_words !== undefined ? t.show_amount_in_words : s.show_amount_in_words),
    !isThermal
  )
  const showBalanceDue = parseBool(
    tPayment.show_balance_due !== undefined ? tPayment.show_balance_due : (t.show_balance_due !== undefined ? t.show_balance_due : s.show_balance_due),
    true
  )
  const showPaymentSummary = parseBool(
    tPayment.show_payment_summary !== undefined ? tPayment.show_payment_summary : (t.show_payment_summary !== undefined ? t.show_payment_summary : s.show_payment_summary),
    true
  )

  // QR Codes - INDEPENDENT
  const showUpiQrOnInvoice = parseBool(
    tPayment.show_upi_qr !== undefined ? tPayment.show_upi_qr : (t.show_upi_qr_on_invoice !== undefined ? t.show_upi_qr_on_invoice : s.show_upi_qr_on_invoice),
    true
  )
  const showBillQrOnInvoice = parseBool(
    tPayment.show_digital_bill_qr !== undefined ? tPayment.show_digital_bill_qr : (t.enable_invoice_qr !== undefined ? t.enable_invoice_qr : s.enable_invoice_qr),
    true
  )
  const showUpiQrOnThermal = parseBool(
    s.thermal_show_upi_qr !== undefined ? s.thermal_show_upi_qr : (tPayment.show_upi_qr !== undefined ? tPayment.show_upi_qr : s.show_upi_qr_on_thermal),
    true
  )
  const showBillQrOnThermal = parseBool(s.thermal_show_bill_qr, false)

  // Payment & Misc
  const showBankDetails = parseBool(
    tPayment.show_bank_details !== undefined ? tPayment.show_bank_details : (t.show_bank_details !== undefined ? t.show_bank_details : s.show_bank_details),
    !isThermal
  )
  const showSignature = parseBool(
    tPayment.show_signature !== undefined ? tPayment.show_signature : (t.show_signature_area !== undefined ? t.show_signature_area : s.show_signature_area),
    mode === 'gst_a4' || mode === 'stylish'
  )
  const showTerms = parseBool(
    tPayment.show_terms !== undefined ? tPayment.show_terms : (t.show_terms !== undefined ? t.show_terms : (isThermal ? s.thermal_show_terms : s.show_terms)),
    !isThermal
  )
  const showFooter = parseBool(
    tPayment.show_footer !== undefined ? tPayment.show_footer : (t.show_footer !== undefined ? t.show_footer : (isThermal ? s.thermal_show_footer : s.show_footer)),
    true
  )
  const showNotes = parseBool(
    tFields.show_notes !== undefined ? tFields.show_notes : (t.show_notes !== undefined ? t.show_notes : s.show_notes),
    true
  )

  // Theme & Appearance
  const accentColor = s.invoice_theme_color || tLayout.accent_color || '#1E3A5F'
  const secondaryColor = s.invoice_theme_secondary || tLayout.secondary_color || '#64748B'
  const fontFamily = tLayout.font_family || s.invoice_font || 'inter'
  const borderStyle = s.invoice_border_style || tLayout.border_style || 'solid'
  const tableStyle = s.invoice_table_style || tLayout.table_style || 'clean'
  const headerLayout = tBiz.header_layout || s.invoice_header_layout || 'logo_left'

  // Text overrides
  const termsText = tPayment.terms_override || t.terms_override || s.invoice_terms || ''
  const footerText = tPayment.footer_text_override || t.footer_text_override || s.invoice_footer || 'THANK YOU FOR SHOPPING WITH US!'
  const notesText = s.invoice_notes || ''

  return {
    mode,
    isThermal,
    is58mm,
    isHalfA4,
    header: {
      showShopDetails,
      showStoreName,
      showLogo,
      showAddress,
      showPhone,
      showEmail,
      showGstin,
      showPan,
      showCin,
      showFssai,
      layout: headerLayout,
      storeNameOverride: tBiz.store_name_override || '',
      addressOverride: tBiz.address_override || '',
      phoneOverride: tBiz.phone_override || '',
      emailOverride: tBiz.email_override || '',
      gstinOverride: tBiz.gstin_override || '',
    },
    invoice: {
      title,
      prefix: s.invoice_prefix || 'INV-',
      startNumber: s.invoice_start_number || '1001',
      showTime: parseBool(s.show_invoice_time, true),
      dueDays: Number(s.invoice_due_days || 15),
      paymentTerms: s.default_payment_terms || 'Net 15 Days',
      notes: notesText,
      terms: termsText,
      footer: footerText,
    },
    party: {
      showName: showCustomerName,
      showPhone: showCustomerPhone,
      showAddress: showCustomerAddress,
      showGstin: showCustomerGstin,
      showPlaceOfSupply,
      showPaymentMode,
    },
    items: {
      showSrNo,
      showName: showItemName,
      showDescription: showItemDescription,
      showHsn,
      showSku,
      showBarcode,
      showBatch,
      showMfgDate,
      showExpiryDate,
      showMrp,
      showQty,
      showUnit,
      showRate,
      showDiscount,
      showTaxCols,
      showTotal,
    },
    totals: {
      showSubtotal,
      showDiscountTotal,
      showTaxBreakdown,
      showRoundOff,
      showAmountInWords,
      showBalanceDue,
      showPaymentSummary,
    },
    payment: {
      showUpiQr: isThermal ? showUpiQrOnThermal : showUpiQrOnInvoice,
      showBankDetails,
      showSignature,
    },
    qr: {
      showUpiQrOnInvoice,
      showBillQrOnInvoice,
      showUpiQrOnThermal,
      showBillQrOnThermal,
    },
    footer: {
      showFooter,
      showTerms,
      showNotes,
      termsText,
      footerText,
    },
    theme: {
      accentColor,
      secondaryColor,
      fontFamily,
      borderStyle,
      tableStyle,
    },
    thermal: {
      paperWidth: is58mm ? 58 : 80,
      is58mm,
      is80mm: !is58mm,
      title: (s.thermal_title || title || 'TAX INVOICE').trim(),
      showLogo: showLogo,
      showInvoiceNo: parseBool(s.thermal_show_invoice_no, true),
      showDate: parseBool(s.thermal_show_date, true),
      showTime: parseBool(s.thermal_show_time, true),
      showCashier: parseBool(s.thermal_show_cashier, false),
      showPaymentMode,
      showPlaceOfSupply,
      showCustomerName,
      showCustomerPhone,
      showCustomerAddress,
      showCustomerGstin,
      showSku,
      showBarcode,
      showHsn,
      showBatch,
      showExpiry: showExpiryDate,
      showMrp,
      showQty,
      showRate,
      showTotal,
      showDiscount,
      showTax: showTaxCols,
      showPartyBalance: parseBool(s.thermal_show_party_balance, false),
      showUpiQr: showUpiQrOnThermal,
      showBillQr: showBillQrOnThermal,
      showTerms: parseBool(s.thermal_show_terms, false),
      showFooter: parseBool(s.thermal_show_footer, true),
      termsText: s.thermal_terms || termsText,
      footerText: s.receipt_footer || footerText,
    },
  }
}

