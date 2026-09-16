import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle2, XCircle, Clock, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react'
import api from '../../api'
import { Modal } from '../../components/UI'
import toast from 'react-hot-toast'

const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 20 // 60 seconds total

/**
 * PhonePePaymentModal
 *
 * Props:
 *   open          – boolean
 *   onClose       – () => void  (only allowed when not mid-payment)
 *   invoice       – { id, invoice_number, grand_total, customer_phone? }
 *   onSuccess     – (invoiceId) => void  called after backend confirms PAID
 */
export default function PhonePePaymentModal({ open, onClose, invoice, onSuccess }) {
  const [phase, setPhase] = useState('idle') // idle | creating | redirecting | polling | success | failed | pending
  const [merchantTxnId, setMerchantTxnId] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const pollRef = useRef(null)
  const attemptsRef = useRef(0)
  const payWindowRef = useRef(null)

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setPhase('idle')
      setMerchantTxnId(null)
      setErrorMsg('')
      attemptsRef.current = 0
    }
  }, [open])

  // Cleanup polling on unmount or close
  useEffect(() => {
    return () => stopPolling()
  }, [])

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const verifyPayment = useCallback(async (txnId) => {
    try {
      const res = await api.post('/payments/phonepe/verify/', {
        merchant_transaction_id: txnId,
      })
      const data = res.data
      if (data.status === 'success') {
        stopPolling()
        setPhase('success')
        onSuccess?.(data.invoice_id)
        return true
      }
      if (data.status === 'failed') {
        stopPolling()
        setPhase('failed')
        setErrorMsg('Payment was declined or failed. Please try again.')
        return true
      }
      // pending — keep polling
      return false
    } catch (err) {
      // Network error during polling — don't stop, just log
      console.warn('PhonePe verify error:', err?.response?.data || err.message)
      return false
    }
  }, [onSuccess])

  const startPolling = useCallback((txnId) => {
    attemptsRef.current = 0
    pollRef.current = setInterval(async () => {
      attemptsRef.current += 1
      const done = await verifyPayment(txnId)
      if (done) return
      if (attemptsRef.current >= POLL_MAX_ATTEMPTS) {
        stopPolling()
        setPhase('pending')
      }
    }, POLL_INTERVAL_MS)
  }, [verifyPayment])

  const initiatePayment = async () => {
    if (!invoice?.id) {
      toast.error('Save the bill before paying with PhonePe')
      return
    }
    setPhase('creating')
    setErrorMsg('')
    try {
      const res = await api.post('/payments/phonepe/initiate/', {
        invoice_id: invoice.id,
        mobile: invoice.customer_phone || '',
      })
      const { merchant_transaction_id, payment_url } = res.data
      setMerchantTxnId(merchant_transaction_id)
      setPhase('redirecting')

      // Open PhonePe checkout in a new tab
      payWindowRef.current = window.open(payment_url, '_blank', 'noopener,noreferrer')
      if (!payWindowRef.current) {
        toast.error('Allow pop-ups to open PhonePe checkout')
      }

      // Start polling for result
      setPhase('polling')
      startPolling(merchant_transaction_id)
    } catch (err) {
      const msg = err?.response?.data?.error || 'Could not initiate PhonePe payment'
      setErrorMsg(msg)
      setPhase('failed')
    }
  }

  const retryVerify = async () => {
    if (!merchantTxnId) return
    setPhase('polling')
    setErrorMsg('')
    attemptsRef.current = 0
    const done = await verifyPayment(merchantTxnId)
    if (!done) startPolling(merchantTxnId)
  }

  const handleClose = () => {
    if (phase === 'creating' || phase === 'redirecting') return // block close mid-create
    stopPolling()
    onClose?.()
  }

  const fmt = v => `₹${Number(v || 0).toFixed(2)}`
  const canClose = !['creating', 'redirecting'].includes(phase)

  return (
    <Modal open={open} onClose={handleClose} title="Pay with PhonePe" size="sm">
      <div className="space-y-4">

        {/* Amount banner */}
        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 p-4 text-center">
          <div className="text-xs text-indigo-600 font-medium mb-1">
            Invoice {invoice?.invoice_number}
          </div>
          <div className="text-3xl font-extrabold text-indigo-800 dark:text-indigo-200 tabular-nums">
            {fmt(invoice?.grand_total)}
          </div>
          <div className="text-xs text-indigo-500 mt-1">Amount to pay via PhonePe</div>
        </div>

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-[var(--surface-elevated)] border border-[var(--line)] p-3 text-xs text-[var(--muted)] space-y-1">
              <div>• You will be redirected to PhonePe to complete payment.</div>
              <div>• Do not close this window until payment is confirmed.</div>
              <div>• The invoice will be marked paid only after backend verification.</div>
            </div>
            <button
              onClick={initiatePayment}
              className="w-full h-12 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#5f259f,#8b2fc9)' }}
            >
              <PhonePeIcon />
              Pay {fmt(invoice?.grand_total)} with PhonePe
            </button>
            {canClose && (
              <button onClick={handleClose} className="w-full h-10 rounded-xl border border-[var(--line)] text-sm text-[var(--muted)] hover:bg-[var(--surface-elevated)]">
                Cancel
              </button>
            )}
          </div>
        )}

        {/* ── CREATING ── */}
        {phase === 'creating' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-[var(--muted)]">Creating payment request…</p>
          </div>
        )}

        {/* ── REDIRECTING ── */}
        {phase === 'redirecting' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <ExternalLink size={28} className="text-indigo-600" />
            <p className="text-sm font-medium text-[var(--ink)]">Opening PhonePe…</p>
            <p className="text-xs text-[var(--muted)] text-center">Complete the payment in the PhonePe window.</p>
          </div>
        )}

        {/* ── POLLING ── */}
        {phase === 'polling' && (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <p className="text-sm font-medium text-[var(--ink)]">Waiting for payment confirmation…</p>
              <p className="text-xs text-[var(--muted)] text-center">
                Complete the payment in the PhonePe window. This page will update automatically.
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2 text-xs text-amber-700">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>Do not close this window or refresh the page until payment is confirmed.</span>
            </div>
            <button
              onClick={retryVerify}
              className="w-full h-10 rounded-xl border border-[var(--line)] text-sm text-[var(--muted)] hover:bg-[var(--surface-elevated)] flex items-center justify-center gap-2"
            >
              <RefreshCw size={14} /> Check payment status now
            </button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {phase === 'success' && (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-2 py-2">
              <CheckCircle2 size={44} className="text-emerald-500" />
              <p className="text-lg font-bold text-emerald-700">Payment Successful!</p>
              <p className="text-sm text-[var(--muted)] text-center">
                {fmt(invoice?.grand_total)} received via PhonePe. Invoice marked as paid.
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

        {/* ── FAILED ── */}
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
              style={{ background: 'linear-gradient(135deg,#5f259f,#8b2fc9)' }}
            >
              <RefreshCw size={15} /> Try Again
            </button>
            <button onClick={handleClose} className="w-full h-10 rounded-xl border border-[var(--line)] text-sm text-[var(--muted)] hover:bg-[var(--surface-elevated)]">
              Cancel
            </button>
          </div>
        )}

        {/* ── PENDING ── */}
        {phase === 'pending' && (
          <div className="space-y-3">
            <div className="flex flex-col items-center gap-2 py-2">
              <Clock size={44} className="text-amber-500" />
              <p className="text-lg font-bold text-amber-700">Payment Pending</p>
              <p className="text-sm text-[var(--muted)] text-center">
                Payment status is still pending. It may take a few minutes to confirm.
              </p>
            </div>
            {merchantTxnId && (
              <div className="rounded-lg bg-[var(--surface-elevated)] border border-[var(--line)] p-2 text-xs text-[var(--muted)] break-all">
                Txn ID: {merchantTxnId}
              </div>
            )}
            <button
              onClick={retryVerify}
              className="w-full h-11 rounded-xl border-2 border-amber-400 text-amber-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-50"
            >
              <RefreshCw size={15} /> Check Status Again
            </button>
            <button onClick={handleClose} className="w-full h-10 rounded-xl border border-[var(--line)] text-sm text-[var(--muted)] hover:bg-[var(--surface-elevated)]">
              Close (check later in Bills)
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function PhonePeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="20" fill="white" fillOpacity="0.2"/>
      <text x="20" y="26" textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">P</text>
    </svg>
  )
}
