import { useState, useEffect, useCallback, useRef } from 'react'
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import api from '../../api'
import { Modal } from '../../components/UI'
import toast from 'react-hot-toast'

/**
 * RazorpayPaymentModal
 *
 * Props:
 *   open      – boolean
 *   onClose   – () => void
 *   invoice   – { id, invoice_number, grand_total, customer_name?, customer_phone? }
 *   onSuccess – (invoiceId) => void  called after backend confirms PAID
 */
export default function RazorpayPaymentModal({
  open,
  onClose,
  invoice,
  amount,
  customerName,
  customerPhone,
  onSuccess,
  onConfirmSale,
}) {
  const [phase, setPhase] = useState('idle') // idle | creating | success | failed
  const [errorMsg, setErrorMsg] = useState('')
  const [paymentData, setPaymentData] = useState(null)

  useEffect(() => {
    if (open) {
      setPhase('idle')
      setErrorMsg('')
      setPaymentData(null)
    }
  }, [open])

  const phaseRef = useRef(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])

  const effectiveAmount = invoice?.grand_total != null ? Number(invoice.grand_total) : Number(amount || 0)
  const effectiveCustomerName = invoice?.customer_name || customerName || ''
  const effectiveCustomerPhone = invoice?.customer_phone || customerPhone || ''
  const effectiveTitle = invoice?.invoice_number ? `Invoice ${invoice.invoice_number}` : 'POS Sale'

  const loadRazorpayScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true)
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })

  const initiatePayment = useCallback(async () => {
    if (!invoice?.id && effectiveAmount <= 0) {
      toast.error('Add items to the bill before paying with Razorpay')
      return
    }
    setPhase('creating')
    setErrorMsg('')

    const loaded = await loadRazorpayScript()
    if (!loaded) {
      setErrorMsg('Could not load Razorpay SDK. Check your internet connection.')
      setPhase('failed')
      return
    }

    let orderData
    try {
      const payload = invoice?.id ? { invoice_id: invoice.id } : { amount: effectiveAmount }
      const res = await api.post('/payments/razorpay/create-order/', payload)
      orderData = res.data
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || 'Could not create Razorpay order')
      setPhase('failed')
      return
    }

    const options = {
      key: orderData.key_id,
      amount: orderData.amount,
      currency: orderData.currency,
      order_id: orderData.order_id,
      name: 'POS Payment',
      description: invoice?.invoice_number ? `Invoice ${invoice.invoice_number}` : 'POS Sale Checkout',
      prefill: {
        name: effectiveCustomerName,
        contact: effectiveCustomerPhone,
      },
      handler: async (response) => {
        try {
          const res = await api.post('/payments/razorpay/verify/', {
            razorpay_order_id: orderData.order_id,
            razorpay_checkout_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          })
          if (res.data.success) {
            setPhase('success')
            const resultData = {
              paymentId: response.razorpay_payment_id,
              orderId: orderData.order_id,
              signature: response.razorpay_signature,
              amount: effectiveAmount,
              invoiceId: res.data.invoice_id || invoice?.id,
            }
            setPaymentData(resultData)
            onSuccess?.(resultData)
          } else {
            setErrorMsg('Payment verification failed. Contact support.')
            setPhase('failed')
          }
        } catch (err) {
          setErrorMsg(err?.response?.data?.error || 'Payment verification failed')
          setPhase('failed')
        }
      },
      modal: {
        ondismiss: () => {
          if (phaseRef.current !== 'success') setPhase('idle')
        },
      },
      theme: { color: '#4f46e5' },
    }

    const rzp = new window.Razorpay(options)
    rzp.on('payment.failed', (response) => {
      setErrorMsg(response.error?.description || 'Payment failed')
      setPhase('failed')
    })
    rzp.open()
  }, [invoice, effectiveAmount, effectiveCustomerName, effectiveCustomerPhone, onSuccess])

  const handleClose = () => {
    if (phase === 'creating') return
    onClose?.()
  }

  const fmt = v => `₹${Number(v || 0).toFixed(2)}`

  return (
    <Modal open={open} onClose={handleClose} title="Pay with Razorpay" size="sm">
      <div className="space-y-4">

        {/* Amount banner */}
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3.5 dark:border-violet-800/60 dark:bg-violet-950/30">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-left">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                Razorpay payment
              </div>
              <div className="break-all font-mono text-sm font-extrabold text-[var(--ink)]">
                {effectiveTitle}
              </div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Amount to pay via Razorpay
              </div>
            </div>
            <div className="shrink-0 rounded-xl border border-violet-200 bg-white px-3 py-2 text-right shadow-sm dark:border-violet-800 dark:bg-slate-900">
              <div className="text-xl font-mono font-extrabold text-violet-800 dark:text-violet-200">
                {fmt(effectiveAmount)}
              </div>
            </div>
          </div>
        </div>

        {/* IDLE */}
        {phase === 'idle' && (
          <div className="space-y-3">
            <div className="rounded-md bg-[var(--surface-elevated)] border border-[var(--line)] p-3 text-xs text-[var(--muted)] space-y-1">
              <div>• Opens official Razorpay checkout popup.</div>
              <div>• Supports UPI, cards, net banking, and wallets.</div>
              <div>• Sale is confirmed only after payment verification.</div>
            </div>
            <button
              type="button"
              onClick={initiatePayment}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-extrabold text-white shadow-md shadow-violet-700/20 transition hover:bg-violet-800 disabled:opacity-60 cursor-pointer"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">₹</span>
              Pay {fmt(effectiveAmount)} with Razorpay
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)] cursor-pointer"
            >
              Cancel (Return to Bill)
            </button>
          </div>
        )}

        {/* CREATING */}
        {phase === 'creating' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1E3A5F] rounded-full animate-spin" />
            <p className="text-sm text-[var(--muted)]">Opening Razorpay checkout…</p>
          </div>
        )}

        {/* SUCCESS */}
        {phase === 'success' && (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-2 py-2">
              <CheckCircle2 size={44} className="text-[#15803D]" />
              <p className="text-lg font-bold text-[#15803D]">Payment Successful!</p>
              <p className="text-sm text-[var(--muted)] text-center">
                {fmt(effectiveAmount)} received via Razorpay.
              </p>
              {paymentData?.paymentId && (
                <div className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                  Ref: {paymentData.paymentId}
                </div>
              )}
            </div>
            {onConfirmSale ? (
              <button
                type="button"
                onClick={() => {
                  if (paymentData) onConfirmSale(paymentData)
                  else handleClose()
                }}
                className="min-h-12 w-full rounded-xl bg-emerald-700 text-sm font-extrabold text-white shadow-md shadow-emerald-700/20 transition hover:bg-emerald-800 cursor-pointer"
              >
                Confirm Sale &amp; View Receipt
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="min-h-12 w-full rounded-xl bg-emerald-700 text-sm font-extrabold text-white shadow-md shadow-emerald-700/20 transition hover:bg-emerald-800 cursor-pointer"
              >
                Payment confirmed — View receipt
              </button>
            )}
          </div>
        )}

        {/* FAILED */}
        {phase === 'failed' && (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-2 py-2">
              <XCircle size={44} className="text-[#B91C1C]" />
              <p className="text-lg font-bold text-[#B91C1C]">Payment Failed</p>
              <p className="text-sm text-[var(--muted)] text-center">{errorMsg || 'The payment could not be completed.'}</p>
            </div>
            <button
              type="button"
              onClick={() => { setPhase('idle'); setErrorMsg('') }}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-700 text-sm font-extrabold text-white transition hover:bg-rose-800 cursor-pointer"
            >
              <RefreshCw size={15} /> Try Again
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="min-h-11 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] text-sm font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)] cursor-pointer"
            >
              Cancel (Return to Bill)
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
