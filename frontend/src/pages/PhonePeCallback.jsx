import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react'
import api from '../api'

/**
 * PhonePeCallback
 *
 * PhonePe redirects the customer here after payment attempt.
 * URL: /billing/phonepe-callback?txn=<merchant_transaction_id>
 *
 * This page:
 *  1. Reads the txn param from the URL.
 *  2. Calls the backend verify endpoint.
 *  3. Shows success / failed / pending state.
 *  4. Redirects to /billing/new on success or after a delay.
 *
 * Security: the backend verify endpoint is the source of truth.
 * This page never marks anything as paid on its own.
 */
export default function PhonePeCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const txnId = params.get('txn')

  const [status, setStatus] = useState('verifying') // verifying | success | failed | pending | error
  const [invoiceId, setInvoiceId] = useState(null)
  const [amount, setAmount] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const verify = async () => {
    if (!txnId) {
      setStatus('error')
      setErrorMsg('No transaction ID found in URL.')
      return
    }
    setStatus('verifying')
    try {
      const res = await api.post('/payments/phonepe/verify/', {
        merchant_transaction_id: txnId,
      })
      const data = res.data
      setInvoiceId(data.invoice_id)
      setAmount(data.amount)
      if (data.status === 'success') {
        setStatus('success')
        // Auto-redirect to billing after 3 s
        setTimeout(() => navigate('/billing/new'), 3000)
      } else if (data.status === 'failed') {
        setStatus('failed')
        setErrorMsg('Payment was declined or failed.')
      } else {
        setStatus('pending')
      }
    } catch (err) {
      setStatus('error')
      setErrorMsg(
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        'Could not verify payment. Please check Bills page.'
      )
    }
  }

  useEffect(() => {
    verify()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txnId])

  const fmt = v => v ? `₹${Number(v).toFixed(2)}` : ''

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--app-bg)] p-4">
      <div className="w-full max-w-sm bg-[var(--surface)] border border-[var(--line)] rounded-2xl shadow-xl p-6 space-y-5">

        {/* Header */}
        <div className="text-center">
          <div className="text-lg font-bold text-[var(--ink)]">PhonePe Payment</div>
          {txnId && (
            <div className="text-xs text-[var(--muted-light)] mt-1 break-all">Txn: {txnId}</div>
          )}
        </div>

        {/* ── VERIFYING ── */}
        {status === 'verifying' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-[var(--muted)]">Verifying payment with PhonePe…</p>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-3 py-2">
            <CheckCircle2 size={52} className="text-emerald-500" />
            <p className="text-xl font-bold text-emerald-700">Payment Successful!</p>
            {amount && <p className="text-2xl font-extrabold text-emerald-800 tabular-nums">{fmt(amount)}</p>}
            <p className="text-sm text-[var(--muted)] text-center">
              Your payment has been confirmed. Redirecting to billing…
            </p>
            <button
              onClick={() => navigate('/billing/new')}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
            >
              Go to Billing
            </button>
            {invoiceId && (
              <button
                onClick={() => navigate('/sales/invoices')}
                className="w-full h-10 rounded-xl border border-[var(--line)] text-sm text-[var(--muted)] hover:bg-[var(--surface-elevated)]"
              >
                View Invoice
              </button>
            )}
          </div>
        )}

        {/* ── FAILED ── */}
        {status === 'failed' && (
          <div className="flex flex-col items-center gap-3 py-2">
            <XCircle size={52} className="text-rose-500" />
            <p className="text-xl font-bold text-rose-700">Payment Failed</p>
            <p className="text-sm text-[var(--muted)] text-center">{errorMsg}</p>
            <button
              onClick={() => navigate('/billing/new')}
              className="w-full h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm"
            >
              Back to Billing
            </button>
          </div>
        )}

        {/* ── PENDING ── */}
        {status === 'pending' && (
          <div className="flex flex-col items-center gap-3 py-2">
            <Clock size={52} className="text-amber-500" />
            <p className="text-xl font-bold text-amber-700">Payment Pending</p>
            <p className="text-sm text-[var(--muted)] text-center">
              Your payment is being processed. Check the Bills page for the latest status.
            </p>
            <button
              onClick={verify}
              className="w-full h-11 rounded-xl border-2 border-amber-400 text-amber-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-50"
            >
              <RefreshCw size={15} /> Check Again
            </button>
            <button
              onClick={() => navigate('/sales/invoices')}
              className="w-full h-10 rounded-xl border border-[var(--line)] text-sm text-[var(--muted)] hover:bg-[var(--surface-elevated)]"
            >
              View Bills
            </button>
          </div>
        )}

        {/* ── ERROR ── */}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-3 py-2">
            <XCircle size={52} className="text-slate-400" />
            <p className="text-lg font-bold text-[var(--ink)]">Verification Error</p>
            <p className="text-sm text-[var(--muted)] text-center">{errorMsg}</p>
            <button
              onClick={verify}
              className="w-full h-11 rounded-xl border border-[var(--line)] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[var(--surface-elevated)]"
            >
              <RefreshCw size={15} /> Retry
            </button>
            <button
              onClick={() => navigate('/sales/invoices')}
              className="w-full h-10 rounded-xl border border-[var(--line)] text-sm text-[var(--muted)] hover:bg-[var(--surface-elevated)]"
            >
              View Bills
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
