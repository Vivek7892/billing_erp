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

export default function InvoiceDocument({
  invoice,
  settings = {},
  mode = 'a4',
  onModeChange,
  showModePicker = false,
  className = '',
}) {
  const s = settings || {}
  const inv = invoice || {}

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
  const shopName = s.shop_name || 'SRI BALAJI STORE'
  const shopAddress = s.shop_address || ''
  const shopPhone = s.shop_phone || ''
  const shopEmail = s.shop_email || ''
  const shopGstin = s.shop_gstin || ''
  const shopPan = s.shop_pan || ''
  const shopLogo = s.shop_logo || ''
  const fssai = s.fssai_licence || ''
  const cin = s.cin || ''

  // Business display flags
  const showLogo = isTrue(s.show_business_logo, true) && Boolean(shopLogo) && s.invoice_header_layout !== 'name_only'
  const showAddress = isTrue(s.show_business_address, true) && Boolean(shopAddress)
  const showPhone = isTrue(s.show_business_phone, true) && Boolean(shopPhone)
  const showEmail = isTrue(s.show_business_email, true) && Boolean(shopEmail)
  const showGstin = isTrue(s.show_business_gstin, true) && Boolean(shopGstin)
  const showPan = isTrue(s.show_business_pan, true) && Boolean(shopPan)
  const showFssai = isTrue(s.show_fssai_on_invoice, false) && Boolean(fssai)
  const showCin = isTrue(s.show_cin_on_invoice, false) && Boolean(cin)

  // Customer profile & flags
  const custName = inv.customer_name || inv.customer?.name || 'Walk-in Customer'
  const custPhone = inv.customer_phone || inv.customer?.mobile || ''
  const custAddress = inv.customer_address || inv.customer?.address || ''
  const custGstin = inv.customer_gstin || inv.customer?.gstin || ''

  const showCustPhone = isTrue(s.show_customer_phone, true) && Boolean(custPhone)
  const showCustAddress = isTrue(s.show_customer_address, true) && Boolean(custAddress)
  const showCustGstin = isTrue(s.show_customer_gstin, true) && Boolean(custGstin)

  // Invoice specifics
  const invoiceNo = inv.invoice_number || `${s.invoice_prefix || 'INV-'}${s.invoice_start_number || '1001'}`
  const invoiceDate = inv.created_at ? formatDate(inv.created_at) : formatDate(new Date())
  const invoiceTime = inv.created_at ? formatTime(inv.created_at) : formatTime(new Date())
  const paymentMode = (inv.payment_method || s.default_payment_method || 'CASH').toUpperCase()
  const placeOfSupply = inv.place_of_supply || s.place_of_supply || ''

  const showPaymentMode = isTrue(s.show_payment_mode, true) && Boolean(paymentMode)
  const showPlaceOfSupply = isTrue(s.show_place_of_supply, true) && Boolean(placeOfSupply)

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
          hsn: i.hsn_code || i.hsn || '',
          unit: i.unit || '',
          batch: i.batch_no || i.batch || '',
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
  const showSkuCol = isTrue(s.show_sku_col, false) && items.some(i => Boolean(i.sku))
  const showHsnCol = isTrue(s.show_hsn_col, true) && items.some(i => Boolean(i.hsn))
  const showUnitCol = isTrue(s.show_unit_col, false) && items.some(i => Boolean(i.unit))
  const showBatchCol = isTrue(s.show_batch_col, false) && items.some(i => Boolean(i.batch))
  const showDiscCol = isTrue(s.show_discount_col, true) && items.some(i => Number(i.disc) > 0)
  const showTaxCols = isTrue(s.show_tax_cols, true) && s.gst_reg_type !== 'unregistered'
  const showCessCol = isTrue(s.cess_enabled, false) && cessAmount > 0

  // Payment, QR & Bank
  const showPaymentSummary = isTrue(s.show_payment_summary, true)
  const showBalanceDue = isTrue(s.show_balance_due, true)
  const showBankDetails = isTrue(s.show_bank_details, true) && Boolean(s.shop_bank_details)
  const upiId = s.shop_upi_id || ''
  const showUpiA4 = isTrue(s.show_upi_qr_on_invoice, true) && Boolean(upiId)
  const showUpiThermal = isTrue(s.show_upi_qr_on_thermal, true) && Boolean(upiId)
  const qrSizeA4 = ({ small: 64, medium: 78, large: 96 })[s.upi_qr_size_a4] || 78
  const qrSizeThermal = ({ small: 72, medium: 96, large: 120 })[s.upi_qr_size_thermal] || 96
  const qrValue = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(shopName)}&am=${grandTotal.toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoiceNo)}`

  // Digital Bill QR Code ("Scan to View Bill")
  const showDigitalBillQr = isTrue(s.enable_invoice_qr, true)
  const digitalBillUrl = inv.public_token
    ? `${window.location.origin}/bill/${inv.public_token}`
    : `${window.location.origin}/bill/${inv.id || 'preview'}`

  // Notes, Terms & Footer
  const notesText = inv.notes || s.invoice_notes || ''
  const termsText = inv.terms || s.invoice_terms || ''
  const showNotes = isTrue(s.show_notes, true) && Boolean(notesText)
  const showTerms = isTrue(s.show_terms, true) && Boolean(termsText)
  const showSignature = isTrue(s.show_signature_area, false)
  const showWords = isTrue(s.show_amount_in_words, true)
  const showFooter = isTrue(s.show_footer, true) && s.invoice_footer_layout !== 'none'
  const footerText = s.invoice_footer || 'THANK YOU FOR SHOPPING WITH US!'
  const footerAlign = s.invoice_footer_layout === 'text_left' ? 'left' : 'center'

  // Font
  const fontFamily = s.invoice_font === 'courier' ? 'Courier New, monospace' : 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

  // --------------------------------------------------------------------------
  // THERMAL RECEIPT MODE
  // --------------------------------------------------------------------------
  if (mode === 'thermal') {
    return (
      <div className={`invoice-document-root ${className}`}>
        {showModePicker && (
          <div className="flex items-center gap-2 mb-4 print:hidden">
            <button
              type="button"
              onClick={() => onModeChange?.('a4')}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
            >
              A4 Tax Invoice
            </button>
            <button
              type="button"
              onClick={() => onModeChange?.('thermal')}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white shadow-sm"
            >
              Thermal Receipt (80mm)
            </button>
          </div>
        )}

        <div className="flex justify-center print:m-0">
          <div
            className="bg-white text-black border border-slate-300 shadow-sm print:shadow-none print:border-none"
            style={{
              width: 302,
              fontFamily: 'Courier New, monospace',
              fontSize: 11,
              padding: '12px 10px',
              lineHeight: 1.35,
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 13, marginBottom: 2 }}>
              {shopName.toUpperCase()}
            </div>
            {showAddress && shopAddress.split('\n').map((l, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 9.5 }}>{l}</div>
            ))}
            {(showPhone || showEmail) && (
              <div style={{ textAlign: 'center', fontSize: 9.5 }}>
                {showPhone && `Ph: ${shopPhone}`}
                {showPhone && showEmail && ' | '}
                {showEmail && shopEmail}
              </div>
            )}
            {showGstin && (
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 9.5 }}>
                GSTIN: {shopGstin}
              </div>
            )}

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Document Title & Number */}
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 12 }}>
              {docHeading}
            </div>
            <div style={{ textAlign: 'center', fontSize: 10 }}>{invoiceNo}</div>
            <div style={{ textAlign: 'center', fontSize: 10 }}>Date: {invoiceDate}</div>
            {showPaymentMode && (
              <div style={{ textAlign: 'center', fontSize: 10 }}>Payment: {paymentMode}</div>
            )}
            {showPlaceOfSupply && (
              <div style={{ textAlign: 'center', fontSize: 9.5 }}>Place of Supply: {placeOfSupply}</div>
            )}

            {isCancelled && (
              <div style={{ textAlign: 'center', color: '#dc2626', fontWeight: 'bold', fontSize: 10, marginTop: 2 }}>
                *** CANCELLED ***
              </div>
            )}

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Customer */}
            <div style={{ fontSize: 9.5, fontWeight: 'bold' }}>CUSTOMER: {custName}</div>
            {showCustAddress && <div style={{ fontSize: 9 }}>{custAddress}</div>}
            {showCustPhone && <div style={{ fontSize: 9 }}>Ph: {custPhone}</div>}
            {showCustGstin && <div style={{ fontSize: 9 }}>GSTIN: {custGstin}</div>}

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Items Table */}
            <table style={{ width: '100%', fontSize: 9.5, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <th style={{ textAlign: 'left', paddingBottom: 3 }}>ITEM</th>
                  <th style={{ textAlign: 'center', width: 28 }}>QTY</th>
                  <th style={{ textAlign: 'right', width: 48 }}>RATE</th>
                  <th style={{ textAlign: 'right', width: 56 }}>AMT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                    <td style={{ paddingTop: 2, paddingBottom: 2 }}>
                      <div>{item.name}</div>
                      {showHsnCol && item.hsn && <div style={{ fontSize: 8.5, color: '#444' }}>HSN: {item.hsn}</div>}
                    </td>
                    <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: 2 }}>{item.qty}</td>
                    <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: 2 }}>{item.rate.toFixed(2)}</td>
                    <td style={{ textAlign: 'right', verticalAlign: 'top', paddingTop: 2, fontWeight: 'bold' }}>
                      {item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span>SUBTOTAL</span>
              <span>{fmt(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span>DISCOUNT</span>
                <span>-{fmt(discountAmount)}</span>
              </div>
            )}
            {showTaxCols && taxAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span>GST</span>
                <span>{fmt(taxAmount)}</span>
              </div>
            )}
            {roundOff !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span>ROUND OFF</span>
                <span>{fmt(roundOff)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 12.5, marginTop: 4 }}>
              <span>GRAND TOTAL</span>
              <span>{fmt(grandTotal)}</span>
            </div>

            {/* Amount in words */}
            {showWords && (
              <div style={{ fontSize: 8.5, marginTop: 4, fontStyle: 'italic' }}>
                {numberToIndianWords(grandTotal)}
              </div>
            )}

            {/* Settlement */}
            {showPaymentSummary && (
              <>
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                <div style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 'bold' }}>
                  {paymentStatus} | PAID: {fmt(paidAmount)}
                  {showBalanceDue && balanceDue > 0 && ` | DUE: ${fmt(balanceDue)}`}
                </div>
              </>
            )}

            {/* UPI QR */}
            {showUpiThermal && (
              <>
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                <div style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 'bold', marginBottom: 2 }}>
                  SCAN TO PAY
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                  <QRCodeSVG value={qrValue} size={qrSizeThermal} />
                </div>
                <div style={{ textAlign: 'center', fontSize: 9 }}>{upiId}</div>
              </>
            )}

            {/* Terms */}
            {showTerms && (
              <div style={{ fontSize: 8, marginTop: 6, color: '#333' }}>
                {termsText}
              </div>
            )}

            {/* Footer */}
            {showFooter && (
              <div style={{ textAlign: 'center', fontSize: 9, marginTop: 6 }}>
                <b>{footerText}</b>
                <div style={{ fontSize: 8, marginTop: 1 }}>Date: {invoiceDate} | Ref: {invoiceNo}</div>
              </div>
            )}

            {/* Scan to View Bill QR */}
            {showDigitalBillQr && (
              <>
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
                  <QRCodeSVG value={digitalBillUrl} size={qrSizeThermal} />
                </div>
                <div style={{ textAlign: 'center', fontSize: 8.5, fontWeight: 'bold', marginTop: 1, letterSpacing: '0.02em' }}>
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
  // A4 / A5 TAX INVOICE MODE
  // --------------------------------------------------------------------------
  return (
    <div className={`invoice-document-root ${className}`}>
      {showModePicker && (
        <div className="flex items-center gap-2 mb-4 print:hidden">
          <button
            type="button"
            onClick={() => onModeChange?.('a4')}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white shadow-sm"
          >
            A4 Tax Invoice
          </button>
          <button
            type="button"
            onClick={() => onModeChange?.('thermal')}
            className="px-3.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Thermal Receipt (80mm)
          </button>
        </div>
      )}

      <div className="overflow-x-auto print:overflow-visible">
        <div
          className="bg-white text-[#0F172A] border border-slate-200 shadow-sm print:shadow-none print:border-none mx-auto rounded-sm print:m-0"
          style={{
            width: 794,
            minHeight: 560,
            fontFamily,
            fontSize: 11,
            padding: '24px 28px',
            boxSizing: 'border-box',
          }}
        >
          {/* 1. TOP HEADER: Business info on Left, Invoice details on Right */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ flex: 1, paddingRight: 20 }}>
              {showLogo && (
                <img
                  src={shopLogo}
                  alt="Business Logo"
                  style={{ maxHeight: 46, maxWidth: 140, objectFit: 'contain', marginBottom: 6 }}
                />
              )}
              <div style={{ fontWeight: '800', fontSize: 17, textTransform: 'uppercase', color: '#0F172A', letterSpacing: '0.02em' }}>
                {shopName}
              </div>
              {showAddress && shopAddress.split('\n').map((line, idx) => (
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
            </div>

            <div style={{ textAlign: 'right', minWidth: 230 }}>
              <div style={{
                fontWeight: '800',
                fontSize: 18,
                letterSpacing: '0.03em',
                color: isCancelled ? '#DC2626' : '#0F172A',
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5, marginTop: 4 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderTop: '1px solid #334155', borderBottom: '1px solid #334155' }}>
                <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 34 }}>S.No</th>
                {showSkuCol && (
                  <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 70 }}>Item Code</th>
                )}
                <th style={{ textAlign: 'left', padding: '6px 6px', fontSize: 9, fontWeight: '700', color: '#334155' }}>Item Description</th>
                {showHsnCol && (
                  <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 65 }}>HSN/SAC</th>
                )}
                {showUnitCol && (
                  <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 45 }}>Unit</th>
                )}
                {showBatchCol && (
                  <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 55 }}>Batch</th>
                )}
                <th style={{ textAlign: 'center', padding: '6px 4px', fontSize: 9, fontWeight: '700', color: '#334155', width: 42 }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '6px 6px', fontSize: 9, fontWeight: '700', color: '#334155', width: 72 }}>Rate</th>
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
                <th style={{ textAlign: 'right', padding: '6px 6px', fontSize: 9, fontWeight: '700', color: '#334155', width: 84 }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9.5, color: '#64748B' }}>{idx + 1}</td>
                  {showSkuCol && (
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9.5, color: '#475569' }}>{item.sku || '—'}</td>
                  )}
                  <td style={{ padding: '6px 6px', fontSize: 10.5, color: '#0F172A', fontWeight: '500' }}>
                    {item.name}
                  </td>
                  {showHsnCol && (
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9.5, color: '#64748B' }}>{item.hsn || '—'}</td>
                  )}
                  {showUnitCol && (
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9.5, color: '#64748B' }}>{item.unit || '—'}</td>
                  )}
                  {showBatchCol && (
                    <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 9.5, color: '#64748B' }}>{item.batch || '—'}</td>
                  )}
                  <td style={{ padding: '6px 4px', textAlign: 'center', fontSize: 10.5, color: '#0F172A' }}>{item.qty}</td>
                  <td style={{ padding: '6px 6px', textAlign: 'right', fontSize: 10.5, color: '#0F172A' }}>{fmt(item.rate)}</td>
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
                  <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: '700', fontSize: 10.5, color: '#0F172A' }}>
                    {fmt(item.total)}
                  </td>
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
                  <b>Bank Details:</b> {s.shop_bank_details}
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
              <QRCodeSVG value={digitalBillUrl} size={68} />
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
