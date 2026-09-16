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
export default function RazorpayPaymentModal({ open, onClose, invoice, onSuccess }) {
  const [phase, setPhase] = useState('idle') // idle | creating | success | failed
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (open) {
      setPhase('idle')
      setErrorMsg('')
    }
  }, [open])

  const phaseRef = useRef(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])

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
    if (!invoice?.id) {
      toast.error('Save the bill before paying with Razorpay')
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
      const res = await api.post('/payments/razorpay/create-order/', { invoice_id: invoice.id })
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
      name: 'Payment',
      description: `Invoice ${invoice.invoice_number}`,
      prefill: {
        name: invoice.customer_name || '',
        contact: invoice.customer_phone || '',
      },
      handler: async (response) => {
        try {
          // Verify against the order ID received from our server, never a
          // value supplied by Checkout. This is the order tied to the saved
          // invoice and is the value Razorpay requires in the HMAC payload.
          const res = await api.post('/payments/razorpay/verify/', {
            razorpay_order_id: orderData.order_id,
            razorpay_checkout_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          })
          if (res.data.success) {
            setPhase('success')
            onSuccess?.(res.data.invoice_id)
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
  }, [invoice, onSuccess])

  const handleClose = () => {
    if (phase === 'creating') return
    onClose?.()
  }

  const fmt = v => `₹${Number(v || 0).toFixed(2)}`

  return (
    <Modal open={open} onClose={handleClose} title="Pay with Razorpay" size="sm">
      <div className="space-y-4">

        {/* Amount banner */}
        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 p-4 text-center">
          <div className="text-xs text-indigo-600 font-medium mb-1">
            Invoice {invoice?.invoice_number}
          </div>
          <div className="text-3xl font-extrabold text-indigo-800 dark:text-indigo-200 tabular-nums">
            {fmt(invoice?.grand_total)}
          </div>
          <div className="text-xs text-indigo-500 mt-1">Amount to pay via Razorpay</div>
        </div>

        {/* IDLE */}
        {phase === 'idle' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-[var(--surface-elevated)] border border-[var(--line)] p-3 text-xs text-[var(--muted)] space-y-1">
              <div>• A Razorpay checkout popup will open to complete payment.</div>
              <div>• Supports UPI, cards, net banking, and wallets.</div>
              <div>• Invoice will be marked paid only after backend verification.</div>
            </div>
            <button
              onClick={initiatePayment}
              className="w-full h-12 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
            >
              Pay {fmt(invoice?.grand_total)} with Razorpay
            </button>
            <button
              onClick={handleClose}
              className="w-full h-10 rounded-xl border border-[var(--line)] text-sm text-[var(--muted)] hover:bg-[var(--surface-elevated)]"
            >
              Cancel
            </button>
          </div>
        )}

        {/* CREATING */}
        {phase === 'creating' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-[var(--muted)]">Opening Razorpay checkout…</p>
          </div>
        )}

        {/* SUCCESS */}
        {phase === 'success' && (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-2 py-2">
              <CheckCircle2 size={44} className="text-emerald-500" />
              <p className="text-lg font-bold text-emerald-700">Payment Successful!</p>
              <p className="text-sm text-[var(--muted)] text-center">
                {fmt(invoice?.grand_total)} received via Razorpay. Invoice marked as paid.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
            >
              Done — View Receipt
            </button>
          </div>
        )}

        {/* FAILED */}
        {phase === 'failed' && (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-2 py-2">
              <XCircle size={44} className="text-rose-500" />
              <p className="text-lg font-bold text-rose-700">Payment Failed</p>
              <p className="text-sm text-[var(--muted)] text-center">{errorMsg || 'The payment could not be completed.'}</p>
            </div>
            <button
              onClick={() => { setPhase('idle'); setErrorMsg('') }}
              className="w-full h-11 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}
            >
              <RefreshCw size={15} /> Try Again
            </button>
            <button
              onClick={handleClose}
              className="w-full h-10 rounded-xl border border-[var(--line)] text-sm text-[var(--muted)] hover:bg-[var(--surface-elevated)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
