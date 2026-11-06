import { useMemo } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { normalizeThermalSettings, buildUpiPaymentUrl } from '../utils/thermalSettings'
import { formatDate as formatDateUtil } from '../utils/formatters'

export default function ThermalReceipt({
  invoice = {},
  settings = {},
  templateConfig = null,
  mode = null, // 'thermal_58' | 'thermal_80' | null (auto from settings)
  isPreview = false,
  className = '',
}) {
  const inv = invoice || {}

  // 1. Resolve normalized thermal configuration
  const thermalConfig = useMemo(() => {
    const raw = { ...settings }

    // Layer structured or flat templateConfig if supplied
    if (templateConfig) {
      const tBiz = templateConfig.business_info || {}
      const tFields = templateConfig.fields || {}
      const tPay = templateConfig.payment || {}
      const tPage = templateConfig.page || {}

      if (templateConfig.invoice_title) raw.thermal_title = templateConfig.invoice_title
      if (tBiz.show_logo !== undefined) raw.thermal_show_logo = tBiz.show_logo
      if (tBiz.show_name !== undefined) raw.show_business_name = tBiz.show_name
      if (tBiz.show_address !== undefined) raw.show_business_address = tBiz.show_address
      if (tBiz.show_phone !== undefined) raw.show_business_phone = tBiz.show_phone
      if (tBiz.show_email !== undefined) raw.show_business_email = tBiz.show_email
      if (tBiz.show_gstin !== undefined) raw.show_business_gstin = tBiz.show_gstin
      if (tBiz.store_name_override) raw.shop_name = tBiz.store_name_override

      if (tFields.show_customer_name !== undefined) raw.thermal_show_customer_name = tFields.show_customer_name
      if (tFields.show_customer_phone !== undefined) raw.thermal_show_customer_phone = tFields.show_customer_phone
      if (tFields.show_customer_address !== undefined) raw.thermal_show_customer_address = tFields.show_customer_address
      if (tFields.show_customer_gstin !== undefined) raw.thermal_show_customer_gstin = tFields.show_customer_gstin
      if (tFields.show_place_of_supply !== undefined) raw.thermal_show_place_of_supply = tFields.show_place_of_supply
      if (tFields.show_payment_mode !== undefined) raw.thermal_show_payment_mode = tFields.show_payment_mode
      if (tFields.show_sku !== undefined) raw.thermal_show_sku = tFields.show_sku
      if (tFields.show_qty !== undefined) raw.thermal_show_qty = tFields.show_qty
      if (tFields.show_rate !== undefined) raw.thermal_show_rate = tFields.show_rate
      if (tFields.show_discount !== undefined) raw.thermal_show_discount = tFields.show_discount
      if (tFields.show_tax_breakup !== undefined) raw.thermal_show_tax = tFields.show_tax_breakup
      if (tFields.show_batch !== undefined) raw.thermal_show_batch = tFields.show_batch
      if (tFields.show_expiry !== undefined) raw.thermal_show_expiry = tFields.show_expiry

      if (tPay.show_upi_qr !== undefined) raw.thermal_show_upi_qr = tPay.show_upi_qr
      if (tPay.show_digital_bill_qr !== undefined) raw.thermal_show_bill_qr = tPay.show_digital_bill_qr
      if (tPay.show_terms !== undefined) raw.thermal_show_terms = tPay.show_terms
      if (tPay.show_balance_due !== undefined) raw.thermal_show_party_balance = tPay.show_balance_due
      if (tPay.show_footer !== undefined) raw.thermal_show_footer = tPay.show_footer
      if (tPay.terms_override) raw.thermal_terms = tPay.terms_override
      if (tPay.footer_text_override) raw.receipt_footer = tPay.footer_text_override

      if (tPage.thermal_roll_width) raw.thermal_paper_width = tPage.thermal_roll_width

      // Direct flat overrides from templateConfig
      Object.keys(templateConfig).forEach(k => {
        if (!['business_info', 'fields', 'layout', 'tax', 'payment', 'page'].includes(k)) {
          raw[k] = templateConfig[k]
        }
      })
    }

    if (mode === 'thermal_58') raw.thermal_paper_width = '58'
    else if (mode === 'thermal_80') raw.thermal_paper_width = '80'

    return normalizeThermalSettings(raw, invoice)
  }, [settings, templateConfig, invoice, mode])

  const {
    is58mm,
    title,
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
    renderUpiQr,
    upiValid,
    upiConfigured,
    renderBillQr,
    digitalBillUrl,
    showTerms,
    termsText,
    showFooter,
    footerText,
    shopName,
    shopAddress,
    shopPhone,
    shopEmail,
    shopGstin,
    shopLogo,
    shopUpiId,
    upiMerchantName,
  } = thermalConfig

  // 2. Invoice Data & Calculations
  const invoiceNo = inv.invoice_number || inv.bill_number || 'INV-0000'
  const isCancelled = inv.status === 'cancelled'

  const invoiceDate = useMemo(() => {
    const d = inv.created_at || inv.date
    if (!d) return ''
    try {
      return formatDateUtil(d)
    } catch {
      return String(d)
    }
  }, [inv.created_at, inv.date])

  const invoiceTime = useMemo(() => {
    const d = inv.created_at || inv.date
    if (!d) return ''
    try {
      return new Date(d).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    } catch {
      return ''
    }
  }, [inv.created_at, inv.date])

  const customerName = inv.customer_name || inv.customer?.name || 'Walk-in Customer'
  const customerPhone = inv.customer_phone || inv.customer?.mobile || ''
  const customerGstin = inv.customer_gstin || inv.customer?.gstin || ''
  const customerAddress = inv.customer_address || inv.customer?.address || ''
  const placeOfSupply = inv.place_of_supply || inv.customer?.state || settings.place_of_supply || ''
  const cashierName = inv.created_by_name || inv.created_by?.first_name || inv.created_by?.username || ''
  const paymentMode = (inv.payment_method || settings.default_payment_method || 'CASH').toUpperCase()

  // Dynamically proportioned column widths so hidden columns never leave gaps
  const colWidths80 = useMemo(() => {
    let itemW = 44
    let qtyW = showQty ? 16 : 0
    let rateW = showRate ? 20 : 0
    let totalW = showTotal ? 20 : 0
    if (!qtyW && !rateW && !totalW) {
      itemW = 100
    } else {
      const sum = itemW + qtyW + rateW + totalW
      itemW = (itemW / sum) * 100
      if (qtyW) qtyW = (qtyW / sum) * 100
      if (rateW) rateW = (rateW / sum) * 100
      if (totalW) totalW = (totalW / sum) * 100
    }
    return {
      item: `${itemW.toFixed(1)}%`,
      qty: qtyW ? `${qtyW.toFixed(1)}%` : '0%',
      rate: rateW ? `${rateW.toFixed(1)}%` : '0%',
      total: totalW ? `${totalW.toFixed(1)}%` : '0%',
    }
  }, [showQty, showRate, showTotal])

  const colWidths58 = useMemo(() => {
    let itemW = 60
    let totalW = showTotal ? 40 : 0
    if (!totalW) itemW = 100
    return {
      item: `${itemW}%`,
      total: totalW ? `${totalW}%` : '0%',
    }
  }, [showTotal])

  const items = Array.isArray(inv.items) ? inv.items : []
  const subtotal = Number(inv.subtotal || 0)
  const discountTotal = Number(inv.discount_amount || 0)
  const taxTotal = Number(inv.tax_amount || 0)
  const grandTotal = Number(inv.grand_total || 0)
  const paidAmount = Number(inv.paid_amount !== undefined ? inv.paid_amount : grandTotal)
  const balanceDue = Math.max(0, Number((grandTotal - paidAmount).toFixed(2)))
  const changeReturned = Math.max(0, Number((paidAmount - grandTotal).toFixed(2)))
  const isFullyPaid = balanceDue <= 0 && paidAmount >= grandTotal

  // UPI payment payload
  const upiQrString = useMemo(() => {
    return buildUpiPaymentUrl({
      upiId: shopUpiId,
      merchantName: upiMerchantName,
      amount: balanceDue > 0 ? balanceDue : grandTotal,
      invoiceNumber: invoiceNo,
      isFullyPaid,
    })
  }, [shopUpiId, upiMerchantName, balanceDue, grandTotal, invoiceNo, isFullyPaid])

  // Formatting helper
  const fmt = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Dimension setup
  const pixelWidth = is58mm ? 216 : 300
  const qrPixelSize = is58mm ? 108 : 132

  const hasStoreHeader = showShopDetails && (
    (showLogo && shopLogo) ||
    (showBusinessName && shopName) ||
    (showBusinessAddress && shopAddress) ||
    (showBusinessPhone && shopPhone) ||
    (showBusinessEmail && shopEmail) ||
    (showBusinessGstin && shopGstin)
  )

  const hasCustomerInfo = (
    (showCustomerName && customerName) ||
    (showCustomerPhone && customerPhone) ||
    (showCustomerGstin && customerGstin) ||
    (showCustomerAddress && customerAddress)
  )

  return (
    <div
      className={`thermal-receipt font-mono bg-white text-black selection:bg-none ${className}`}
      style={{
        width: `${pixelWidth}px`,
        maxWidth: '100%',
        margin: '0 auto',
        padding: is58mm ? '6px 5px' : '10px 8px',
        fontSize: is58mm ? '9px' : '10.5px',
        lineHeight: 1.28,
        color: '#000000',
        backgroundColor: '#FFFFFF',
        boxSizing: 'border-box',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
      }}
    >
      {/* ==============================================================
          1. STORE IDENTITY
      =============================================================== */}
      {hasStoreHeader && (
        <div className="text-center">
          {showLogo && shopLogo && (
            <div className="flex justify-center mb-1.5">
              <img
                src={shopLogo}
                alt="Logo"
                style={{
                  maxHeight: is58mm ? '38px' : '48px',
                  maxWidth: is58mm ? '120px' : '160px',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  filter: 'grayscale(100%) contrast(140%)',
                  display: 'block',
                  margin: '0 auto',
                }}
              />
            </div>
          )}

          {showBusinessName && shopName && (
            <div
              className="font-bold uppercase tracking-tight text-black"
              style={{ fontSize: is58mm ? '12px' : '13.5px' }}
            >
              {shopName}
            </div>
          )}

          {showBusinessAddress && shopAddress && (
            <div className="text-black" style={{ fontSize: is58mm ? '8px' : '9.5px', marginTop: '1px' }}>
              {shopAddress.split('\n').filter(Boolean).map((line, idx) => (
                <div key={idx}>{line.trim()}</div>
              ))}
            </div>
          )}

          {(showBusinessPhone || showBusinessEmail) && (shopPhone || shopEmail) && (
            <div className="text-black" style={{ fontSize: is58mm ? '8px' : '9.5px' }}>
              {showBusinessPhone && shopPhone && <span>Ph: {shopPhone}</span>}
              {showBusinessPhone && shopPhone && showBusinessEmail && shopEmail && <span> · </span>}
              {showBusinessEmail && shopEmail && <span>{shopEmail}</span>}
            </div>
          )}

          {showBusinessGstin && shopGstin && (
            <div className="font-bold text-black" style={{ fontSize: is58mm ? '8px' : '9.5px' }}>
              GSTIN: {shopGstin}
            </div>
          )}
        </div>
      )}

      {/* ==============================================================
          2. INVOICE CONTROL & CUSTOMER
      =============================================================== */}
      <div className="text-center mt-1">
        {title && (
          <div
            className="font-bold uppercase tracking-wider text-black"
            style={{ fontSize: is58mm ? '10px' : '11.5px' }}
          >
            {isCancelled ? 'CANCELLED INVOICE' : title}
          </div>
        )}

        <div className="flex flex-wrap justify-center items-center gap-x-2 text-black" style={{ fontSize: is58mm ? '8.5px' : '9.5px' }}>
          {showInvoiceNo && (
            <span>Invoice: <strong>{invoiceNo}</strong></span>
          )}
          {showDate && (
            <span>
              Date: {invoiceDate}
              {showTime && invoiceTime ? ` · ${invoiceTime}` : ''}
            </span>
          )}
        </div>

        {((showCashier && cashierName) || (showPaymentMode && paymentMode) || (showPlaceOfSupply && placeOfSupply)) && (
          <div className="flex flex-wrap justify-center items-center gap-x-2 text-black" style={{ fontSize: is58mm ? '8px' : '9px' }}>
            {showCashier && cashierName && <span>Cashier: {cashierName}</span>}
            {showPaymentMode && paymentMode && <span>Mode: {paymentMode}</span>}
            {showPlaceOfSupply && placeOfSupply && <span>POS: {placeOfSupply}</span>}
          </div>
        )}
      </div>

      {/* Customer line */}
      {hasCustomerInfo && (
        <div className="mt-1 pt-1 text-left text-black" style={{ fontSize: is58mm ? '8.5px' : '9.5px' }}>
          {showCustomerName && customerName && (
            <div>Customer: <strong>{customerName}</strong></div>
          )}
          {showCustomerPhone && customerPhone && (
            <div>Phone: {customerPhone}</div>
          )}
          {showCustomerGstin && customerGstin && (
            <div>GSTIN: {customerGstin}</div>
          )}
          {showCustomerAddress && customerAddress && (
            <div>Address: {customerAddress}</div>
          )}
        </div>
      )}

      {/* ─── SEPARATOR 1: After invoice / customer info ─── */}
      <div
        className="my-1 border-t border-dashed border-black"
        style={{ borderWidth: '1px 0 0 0', borderStyle: 'dashed' }}
      />

      {/* ==============================================================
          3. ITEM TABLE
      =============================================================== */}
      <div className="w-full">
        {/* Table Header */}
        <div
          className="font-bold uppercase text-black pb-0.5 flex justify-between"
          style={{ fontSize: is58mm ? '8px' : '9px', borderBottom: '1px solid #000' }}
        >
          <span style={{ width: is58mm ? colWidths58.item : colWidths80.item }}>ITEM</span>
          {showQty && !is58mm && <span className="text-right" style={{ width: colWidths80.qty }}>QTY</span>}
          {showRate && !is58mm && <span className="text-right" style={{ width: colWidths80.rate }}>RATE</span>}
          {showTotal && !is58mm && <span className="text-right" style={{ width: colWidths80.total }}>TOTAL</span>}
          {showTotal && is58mm && <span className="text-right" style={{ width: colWidths58.total }}>TOTAL</span>}
        </div>

        {/* Item Rows */}
        <div className="divide-y divide-dotted divide-black">
          {items.map((item, idx) => {
            const name = item.product_name || item.name || item.product?.name || 'Item'
            const qty = Number(item.quantity ?? item.qty ?? 1)
            const rate = Number(item.unit_price ?? item.rate ?? 0)
            const total = Number(item.total ?? (qty * rate))
            const sku = item.sku || item.product?.sku || ''
            const barcode = item.barcode || item.product?.barcode || ''
            const batch = item.batch_number || item.batch_no || (typeof item.batch === 'string' ? item.batch : item.batch?.batch_number) || ''
            const expiry = item.expiry_date || item.exp_date || item.batch?.expiry_date || ''
            const mrp = Number(item.mrp || item.batch?.mrp || item.product?.mrp || 0)
            const discPercent = Number(item.discount_percent || item.disc || 0)
            const gstPercent = Number(item.gst_percent || item.gst || 0)
            const desc = item.description || item.desc || item.product?.description || ''

            const hasMetaDetails = (
              (showSku && sku) ||
              (showBarcode && barcode) ||
              (showBatch && batch) ||
              (showExpiry && expiry) ||
              (showMrp && mrp > 0) ||
              (showDiscount && discPercent > 0) ||
              (showTax && gstPercent > 0) ||
              (showItemDesc && desc)
            )

            const showSecondRow58 = showQty || showRate || showTotal

            return (
              <div key={item.id || idx} className="text-black leading-tight py-0.5">
                {is58mm ? (
                  /* 58mm compact stacked row */
                  <div>
                    <div className="font-semibold text-black break-words" style={{ fontSize: '9px' }}>
                      {name}
                    </div>

                    {showSecondRow58 && (
                      <div className="flex justify-between items-baseline" style={{ fontSize: '8px' }}>
                        <span className="text-black" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                          {showQty && qty}
                          {showQty && item.unit && ` (${item.unit})`}
                          {showQty && showRate && ` × ₹${fmt(rate)}`}
                          {!showQty && showRate && `₹${fmt(rate)}`}
                        </span>
                        {showTotal && (
                          <span className="font-bold text-black tabular-nums" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                            ₹{fmt(total)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* 80mm clean row - dynamically sized columns without blank gaps */
                  <div>
                    <div className="flex justify-between items-baseline" style={{ fontSize: '9px' }}>
                      <span className="font-semibold text-black break-words" style={{ width: colWidths80.item, minWidth: 0, overflowWrap: 'anywhere' }}>
                        {name}
                        {item.unit && <span className="font-normal"> ({item.unit})</span>}
                      </span>
                      {showQty && (
                        <span className="text-right tabular-nums text-black" style={{ width: colWidths80.qty, minWidth: 0, overflowWrap: 'anywhere' }}>
                          {qty}
                        </span>
                      )}
                      {showRate && (
                        <span className="text-right tabular-nums text-black" style={{ width: colWidths80.rate, minWidth: 0, overflowWrap: 'anywhere' }}>
                          ₹{fmt(rate)}
                        </span>
                      )}
                      {showTotal && (
                        <span className="text-right font-bold tabular-nums text-black" style={{ width: colWidths80.total, minWidth: 0, overflowWrap: 'anywhere' }}>
                          ₹{fmt(total)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Optional metadata (only rendered if enabled and present) */}
                {hasMetaDetails && (
                  <div
                    className="flex flex-wrap gap-x-1.5 text-black"
                    style={{ fontSize: is58mm ? '7.5px' : '8.5px', marginTop: '1px' }}
                  >
                    {showSku && sku && <span>SKU: {sku}</span>}
                    {showBarcode && barcode && <span>Bar: {barcode}</span>}
                    {showBatch && batch && <span>Batch: {batch}</span>}
                    {showExpiry && expiry && <span>Exp: {expiry}</span>}
                    {showMrp && mrp > 0 && <span>MRP: ₹{fmt(mrp)}</span>}
                    {showDiscount && discPercent > 0 && <span>Disc: {discPercent}%</span>}
                    {showTax && gstPercent > 0 && <span>GST: {gstPercent}%</span>}
                    {showItemDesc && desc && <div className="w-full italic">{desc}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ─── SEPARATOR 2: Before totals ─── */}
      <div
        className="my-1 border-t border-dashed border-black"
        style={{ borderWidth: '1px 0 0 0', borderStyle: 'dashed' }}
      />

      {/* ==============================================================
          4. TOTALS & SUMMARY
      =============================================================== */}
      <div className="space-y-0.5 text-black">
        {/* Subtotal (only if discount or tax present and subtotal enabled) */}
        {showSubtotal && (discountTotal > 0 || taxTotal > 0) && (
          <div className="flex justify-between" style={{ fontSize: is58mm ? '8px' : '9px' }}>
            <span>Subtotal</span>
            <span className="tabular-nums">₹{fmt(subtotal)}</span>
          </div>
        )}

        {/* Discount Total */}
        {showDiscount && discountTotal > 0 && (
          <div className="flex justify-between" style={{ fontSize: is58mm ? '8px' : '9px' }}>
            <span>Discount</span>
            <span className="tabular-nums">-₹{fmt(discountTotal)}</span>
          </div>
        )}

        {/* Tax */}
        {showTax && taxTotal > 0 && (
          <div className="flex justify-between" style={{ fontSize: is58mm ? '8px' : '9px' }}>
            <span>Tax (GST)</span>
            <span className="tabular-nums">₹{fmt(taxTotal)}</span>
          </div>
        )}

        {/* Round off */}
        {inv.round_off && Number(inv.round_off) !== 0 && (
          <div className="flex justify-between" style={{ fontSize: is58mm ? '8px' : '9px' }}>
            <span>Round Off</span>
            <span className="tabular-nums">{Number(inv.round_off) > 0 ? '+' : ''}₹{fmt(inv.round_off)}</span>
          </div>
        )}

        {/* Grand Total */}
        <div
          className="flex justify-between font-bold text-black pt-1 mt-0.5"
          style={{
            fontSize: is58mm ? '11px' : '12.5px',
            borderTop: '1px solid #000',
          }}
        >
          <span>GRAND TOTAL</span>
          <span className="tabular-nums">₹{fmt(grandTotal)}</span>
        </div>

        {/* Payment Settlement Status */}
        <div className="flex justify-between pt-0.5 font-medium" style={{ fontSize: is58mm ? '8.5px' : '9.5px' }}>
          <span>Paid {showPaymentMode && paymentMode ? `(${paymentMode})` : ''}</span>
          <span className="tabular-nums">₹{fmt(paidAmount)}</span>
        </div>

        {balanceDue > 0 ? (
          <div className="flex justify-between font-bold" style={{ fontSize: is58mm ? '9px' : '10px' }}>
            <span>BALANCE DUE</span>
            <span className="tabular-nums">₹{fmt(balanceDue)}</span>
          </div>
        ) : changeReturned > 0 ? (
          <div className="flex justify-between" style={{ fontSize: is58mm ? '8px' : '9px' }}>
            <span>Change Returned</span>
            <span className="tabular-nums">₹{fmt(changeReturned)}</span>
          </div>
        ) : (
          <div className="text-right text-[8px] font-bold uppercase tracking-wider text-black">
            PAID IN FULL
          </div>
        )}

        {showPartyBalance && inv.customer_balance !== undefined && (
          <div className="flex justify-between border-t border-dotted border-black pt-0.5" style={{ fontSize: is58mm ? '8px' : '9px' }}>
            <span>Party Total Due</span>
            <span className="tabular-nums">₹{fmt(inv.customer_balance)}</span>
          </div>
        )}
      </div>

      {/* ─── SEPARATOR 3: Before QR / Footer (Rendered only if QR or footer present) ─── */}
      {(renderUpiQr || renderBillQr || (showTerms && termsText) || (showFooter && footerText) || (isPreview && showUpiQrToggle && !upiValid)) && (
        <div
          className="my-1.5 border-t border-dashed border-black"
          style={{ borderWidth: '1px 0 0 0', borderStyle: 'dashed' }}
        />
      )}

      {/* ==============================================================
          5. SCANNABLE UPI QR CODE
      =============================================================== */}
      {renderUpiQr && upiQrString && (
        <div className="text-center my-1">
          <div
            className="font-bold uppercase tracking-wider text-black mb-0.5"
            style={{ fontSize: is58mm ? '8px' : '9px' }}
          >
            SCAN &amp; PAY VIA UPI
          </div>

          <div className="flex justify-center p-1 bg-white">
            <QRCodeSVG
              value={upiQrString}
              size={qrPixelSize}
              level="M"
              fgColor="#000000"
              bgColor="#FFFFFF"
              includeMargin={false}
            />
          </div>

          <div
            className="font-mono text-black mt-0.5 break-all"
            style={{ fontSize: is58mm ? '7.5px' : '8.5px' }}
          >
            UPI ID: {shopUpiId}
          </div>
          {balanceDue > 0 && (
            <div className="text-black font-semibold" style={{ fontSize: is58mm ? '7.5px' : '8.5px' }}>
              Amount: ₹{fmt(balanceDue)}
            </div>
          )}
        </div>
      )}

      {/* Settings Preview Warning: when toggle is ON but UPI ID is not configured */}
      {isPreview && showUpiQrToggle && !upiValid && (
        <div className="text-center p-1.5 my-1 rounded border border-amber-300 bg-amber-50 text-amber-900 text-[8.5px] leading-tight">
          <strong>UPI QR Warning:</strong>{' '}
          {upiConfigured ? 'Invalid UPI ID format' : 'Merchant UPI ID not configured'}
          <div className="text-[7.5px] text-amber-800">Set a valid UPI ID (e.g. store@bank) in Settings</div>
        </div>
      )}

      {/* ==============================================================
          6. DIGITAL BILL QR CODE (Separate from UPI QR)
      =============================================================== */}
      {renderBillQr && digitalBillUrl && (
        <div className="text-center my-1.5 pt-1 border-t border-dotted border-black">
          <div
            className="font-bold uppercase tracking-wider text-black mb-0.5"
            style={{ fontSize: is58mm ? '7.5px' : '8.5px' }}
          >
            SCAN TO VIEW DIGITAL BILL
          </div>
          <div className="flex justify-center p-0.5 bg-white">
            <QRCodeSVG
              value={digitalBillUrl}
              size={is58mm ? 84 : 96}
              level="L"
              fgColor="#000000"
              bgColor="#FFFFFF"
              includeMargin={false}
            />
          </div>
        </div>
      )}

      {/* ==============================================================
          7. TERMS & CONDITIONS
      =============================================================== */}
      {showTerms && termsText && (
        <div
          className="text-center text-black mt-1 leading-tight whitespace-pre-line"
          style={{ fontSize: is58mm ? '7px' : '8px' }}
        >
          {termsText}
        </div>
      )}

      {/* ==============================================================
          8. RECEIPT FOOTER GREETING
      =============================================================== */}
      {showFooter && footerText && (
        <div
          className="text-center font-bold text-black mt-1 leading-snug whitespace-pre-line"
          style={{ fontSize: is58mm ? '8px' : '9px' }}
        >
          {footerText}
        </div>
      )}
    </div>
  )
}
