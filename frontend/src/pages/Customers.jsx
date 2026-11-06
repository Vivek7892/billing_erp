import { MobileFAB } from '../components/MobileUI'
import { useCallback, useEffect, useMemo, useState } from 'react'
import customerService from '../features/customers/api/customerService'
import invoiceService from '../features/billing/api/invoiceService'
import settingsService from '../features/settings/api/settingsService'
import {
  PageHeader,
  Modal,
  ConfirmDialog,
  Spinner,
  TableSkeleton,
  EmptyState,
  SearchInput,
} from '../components/UI'

import { CustomerEmptyIllustration } from '../components/visuals'
import toast from 'react-hot-toast'
import CommunicationHistory from '../components/CommunicationHistory'
import { QRCodeSVG } from 'qrcode.react'
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconEye,
  IconPhone,
  IconMail,
  IconMapPin,
  IconMessage,
  IconSend,
  IconUsers,
  IconWallet,
  IconCurrencyRupee,
  IconFileText,
  IconRefresh,
  IconX,
  IconUserCircle,
  IconBuildingStore,
  IconCircleCheck,
  IconHistory,
  IconBuildingBank,
  IconAlertCircle,
  IconDots,
  IconCoin,
  IconQrcode,
  IconCreditCard,
  IconCopy,
  IconCheck,
  IconMessageCircle,
} from '@tabler/icons-react'

import {
  formatCurrency,
  formatDate,
  formatTime,
} from '../utils/formatters'

const emptyForm = {
  name: '',
  mobile: '',
  email: '',
  address: '',
  gstin: '',
  credit_limit: '0',
}

const currency = value => formatCurrency(value)

const getErrorMessage = error => {
  const data = error?.response?.data

  if (!data) return 'Something went wrong. Please try again.'
  if (typeof data === 'string') return data
  if (data.detail) return data.detail
  if (data.error) return data.error

  const firstField = Object.values(data).flat()?.[0]
  return firstField || 'Please check the entered details.'
}

/* =========================================================
   CUSTOMER COLLECT PAYMENT MODAL
   - Strictly NO grey background (pure white in light, dark slate in dark)
   - Payment methods: Cash, UPI, Card (No online/bank button)
   - UPI: Live dynamic QRCodeSVG with exact customer credit amount
   - Cash / Card: Direct structured flow
========================================================= */

export function CustomerCollectPaymentModal({
  customer,
  bill,
  shopSettings,
  shopName,
  onClose,
  onSuccess,
}) {
  const paymentTarget = useMemo(() => customer || (bill ? {
    id: bill.customer,
    name: bill.customer_name || 'Walk-in Customer',
    mobile: bill.customer_phone || '',
    outstanding_amount: bill.balance_due,
  } : null), [customer, bill])
  const invoiceMode = Boolean(bill)
  const outstanding = Number(invoiceMode ? bill?.balance_due || 0 : paymentTarget?.outstanding_amount || 0)
  const creditLimit = Number(invoiceMode ? 0 : paymentTarget?.credit_limit || 0)

  const [activeTab, setActiveTab] = useState('collect') // 'collect' | 'history'
  const [paymentsList, setPaymentsList] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [recordedPayment, setRecordedPayment] = useState(null)

  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding) : '')
  const [method, setMethod] = useState('cash')
  const [externalRef, setExternalRef] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [copiedTxn, setCopiedTxn] = useState('')

  // Load customer payment history when modal opens or tab switches
  useEffect(() => {
    if (invoiceMode && bill?.id) {
      setLoadingHistory(true)
      invoiceService.getInvoicePayments(bill.id)
        .then(data => setPaymentsList(Array.isArray(data) ? data : (data?.results || data?.payments || [])))
        .catch(() => setPaymentsList([]))
        .finally(() => setLoadingHistory(false))
    } else if (paymentTarget?.id) {
      setLoadingHistory(true)
      customerService.getCustomerPayments(paymentTarget.id)
        .then(data => {
          const list = Array.isArray(data)
            ? data
            : Array.isArray(data?.results)
            ? data.results
            : []
          setPaymentsList(list)
        })
        .catch(() => {
          customerService.getCustomerTransactions(paymentTarget.id)
            .then(data => {
              const list = Array.isArray(data)
                ? data
                : Array.isArray(data?.results)
                ? data.results
                : Array.isArray(data?.transactions)
                ? data.transactions
                : []
              setPaymentsList(list)
            })
            .catch(() => {})
        })
        .finally(() => setLoadingHistory(false))
    }
  }, [customer, bill, invoiceMode, paymentTarget?.id])

  useEffect(() => {
    if (paymentTarget) {
      setAmount(outstanding > 0 ? String(outstanding) : '')
      setMethod('cash')
      setExternalRef('')
      setNotes('')
      setError('')
      setCopiedUpi(false)
      setRecordedPayment(null)
      setActiveTab('collect')
    }
  }, [customer, bill, paymentTarget, outstanding])

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !submitting) {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, submitting])

  if (!paymentTarget) return null

  const handleAmountChange = value => {
    setAmount(value)
    setError('')
    const num = parseFloat(value)
    if (Number.isNaN(num) || num <= 0) {
      setError('Enter an amount greater than zero.')
    } else if (num > outstanding + 0.005) {
      setError(`Amount cannot exceed balance due (${currency(outstanding)}).`)
    }
  }

  const handleQuickAmount = val => {
    setAmount(String(val))
    setError('')
  }

  const handleCopyTxn = (text) => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopiedTxn(text)
      toast.success('Transaction ID copied')
      setTimeout(() => setCopiedTxn(''), 2000)
    })
  }

  const handleSubmit = async event => {
    event?.preventDefault?.()
    const num = parseFloat(amount)
    if (Number.isNaN(num) || num <= 0) {
      setError('Enter a valid payment amount.')
      return
    }
    if (num > outstanding + 0.005) {
      setError(`Amount cannot exceed balance due (${currency(outstanding)}).`)
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const res = invoiceMode
        ? await invoiceService.collectPayment(bill.id, {
            amount: num,
            method,
            reference: externalRef.trim(),
            notes: notes.trim(),
          })
        : await customerService.recordPayment(paymentTarget.id, {
            amount: num,
            method,
            reference: externalRef.trim(),
            notes: notes.trim(),
          })

      const paymentRecord = invoiceMode ? (res?.latest_payment || res) : res
      const txnId = paymentRecord?.transaction_id || paymentRecord?.reference || res?.reference || (paymentRecord?.id ? `TXN-COL-${paymentRecord.id}` : '')
      const recorded = {
        id: paymentRecord?.id,
        amount: num,
        method,
        reference: txnId,
        transaction_id: txnId,
        date: new Date().toISOString(),
        remainingDue: invoiceMode ? Number(res?.balance_due ?? Math.max(0, outstanding - num)) : Math.max(0, outstanding - num),
      }
      setRecordedPayment(recorded)
      if (!invoiceMode && res?.id) {
        setPaymentsList(prev => [res, ...prev])
      }

      toast.success(`${currency(num)} payment recorded for ${paymentTarget.name}`)
      window.dispatchEvent(
        new CustomEvent('pos:payment-collected', {
          detail: res,
        })
      )

      onSuccess?.(res)
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.amount ||
        err?.message ||
        'Failed to record payment'
      setError(String(msg))
      toast.error(String(msg))
    } finally {
      setSubmitting(false)
    }
  }

  // Dynamic UPI URL
  const upiId = shopSettings?.shop_upi_id || ''
  const payeeName = shopName || 'ShopEase POS'
  const upiUrl = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(amount || '0')}&cu=INR&tn=${encodeURIComponent(invoiceMode ? `Invoice-${bill.invoice_number || bill.id}` : `Khata-${paymentTarget.name}`)}`
    : ''

  const handleCopyUpi = () => {
    if (!upiId) return
    navigator.clipboard.writeText(upiId).then(() => {
      setCopiedUpi(true)
      toast.success('UPI ID copied')
      setTimeout(() => setCopiedUpi(false), 2000)
    })
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-4 animate-in fade-in duration-150"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="collect-payment-title"
        className="flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border-t border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-2xl outline-none sm:max-h-[88dvh] sm:rounded-2xl sm:border"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile touch indicator */}
        <div className="flex justify-center pt-2.5 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Minimalist Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <IconCurrencyRupee size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="collect-payment-title" className="text-sm sm:text-base font-bold text-[var(--ink)] leading-tight">
                  {invoiceMode ? 'Collect Invoice Payment' : 'Collect Customer Payment'}
                </h2>
                {outstanding <= 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <IconCheck size={11} strokeWidth={2.5} /> Settled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                    Due: {currency(outstanding)}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-[var(--muted)] mt-0.5">
                {paymentTarget.name} {paymentTarget.mobile ? `(${paymentTarget.mobile})` : ''}{invoiceMode && bill?.invoice_number ? ` · Invoice ${bill.invoice_number}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] transition"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Navigation Tabs (Collect vs History) */}
        <div className="flex border-b border-[var(--line)] bg-[var(--surface-subtle)] px-4 sm:px-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('collect')
              setRecordedPayment(null)
            }}
            className={`flex items-center gap-2 border-b-2 py-2.5 text-xs font-semibold transition ${
              activeTab === 'collect'
                ? 'border-[#0057B8] text-[#0057B8] dark:border-sky-400 dark:text-sky-300'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <IconCurrencyRupee size={15} />
            <span>Record Payment</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 border-b-2 py-2.5 text-xs font-semibold transition ml-4 ${
              activeTab === 'history'
                ? 'border-[#0057B8] text-[#0057B8] dark:border-sky-400 dark:text-sky-300'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <IconHistory size={15} />
            <span>{invoiceMode ? 'Invoice History' : 'Customer History'}</span>
            {paymentsList.length > 0 && (
              <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {paymentsList.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'history' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
                <span>{invoiceMode ? 'Payments on this invoice' : 'Recent Customer Payments &amp; Entries'}</span>
                <span>{paymentsList.length} Records</span>
              </div>

              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Spinner size={24} className="text-[#0057B8]" />
                  <p className="mt-2 text-xs text-[var(--muted)]">Loading payment entries...</p>
                </div>
              ) : paymentsList.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--line)] py-10 text-center text-xs text-[var(--muted)]">
                  No payment entries found for this {invoiceMode ? 'invoice' : 'customer'}.
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-0.5">
                  {paymentsList.map((p, idx) => {
                    const payMethod = (p.method || 'cash').toLowerCase()
                    const MethodIcon = (payMethod === 'upi' ? IconQrcode : payMethod === 'card' ? IconCreditCard : payMethod === 'bank' ? IconBuildingBank : IconCurrencyRupee) || IconCurrencyRupee
                    const methodColor = payMethod === 'upi' ? 'text-sky-600 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-400' : payMethod === 'card' ? 'text-violet-600 bg-violet-50 dark:bg-violet-950/50 dark:text-violet-400' : payMethod === 'bank' ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400'
                    const txnId = p.reference || p.transaction_id || (p.id ? `TXN-COL-${p.id}` : '—')

                    return (
                      <div
                        key={p.id || idx}
                        className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-xs space-y-2 transition hover:border-[var(--line-strong)]"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${methodColor}`}>
                              <MethodIcon size={14} />
                            </div>
                            <span className="font-mono font-bold text-[var(--ink)]">
                              {p.id ? `#PAY-${p.id}` : `#REC-${idx + 1}`}
                            </span>
                            <span className="inline-flex items-center rounded border border-[var(--line)] bg-[var(--surface-subtle)] px-1.5 py-0.2 text-[10px] font-bold uppercase">
                              {p.method || 'Cash'}
                            </span>
                            {p.invoice_number && (
                              <span className="text-[10px] font-mono text-[var(--muted)]">
                                Bill #{p.invoice_number}
                              </span>
                            )}
                          </div>
                          <span className="amount price font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            + {currency(p.amount || 0)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-[var(--line)]">
                          <div className="flex items-center gap-1 font-mono text-[10px] text-[var(--muted)] truncate">
                            <span>TXN:</span>
                            <span className="font-bold text-[var(--ink)] truncate select-all">{txnId}</span>
                            {txnId !== '—' && (
                              <button
                                type="button"
                                onClick={() => handleCopyTxn(txnId)}
                                className="ml-1 text-sky-700 dark:text-sky-400 hover:underline shrink-0"
                                title="Copy Transaction ID"
                              >
                                {copiedTxn === txnId ? <IconCheck size={11} className="text-emerald-600" /> : <IconCopy size={11} />}
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] text-[var(--muted)] font-mono shrink-0">
                            {p.created_at ? `${formatDate(p.created_at)} ${formatTime(p.created_at)}` : (p.date || '—')}
                          </span>
                        </div>

                        {(p.notes || p.collected_by_name) && (
                          <div className="flex items-center justify-between text-[10px] text-[var(--muted)] pt-0.5">
                            {p.collected_by_name ? <span>Collected by: <strong className="text-[var(--ink)] font-normal">{p.collected_by_name}</strong></span> : <span />}
                            {p.notes && <span className="italic truncate max-w-[200px]">{p.notes}</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : recordedPayment ? (
            /* Confirmation Success Card */
            <div className="flex flex-col items-center text-center py-4 space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <IconCircleCheck size={36} />
              </div>

              <div>
                <h3 className="text-base font-bold text-[var(--ink)]">Payment Recorded Successfully</h3>
                <p className="text-xs text-[var(--muted)] mt-1">
                  Received {currency(recordedPayment.amount)} from {paymentTarget.name}
                </p>
              </div>

              <div className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Amount Collected:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{currency(recordedPayment.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--muted)]">Payment Channel:</span>
                  <span className="font-semibold uppercase">{recordedPayment.method}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--muted)]">Permanent Transaction ID:</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold">
                    <span className="select-all text-[var(--ink)]">{recordedPayment.reference || recordedPayment.transaction_id || 'N/A'}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyTxn(recordedPayment.reference || recordedPayment.transaction_id)}
                      className="text-sky-700 dark:text-sky-400 hover:underline inline-flex items-center"
                      title="Copy Transaction ID"
                    >
                      {copiedTxn === (recordedPayment.reference || recordedPayment.transaction_id) ? (
                        <IconCheck size={13} className="text-emerald-600" />
                      ) : (
                        <IconCopy size={13} />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between pt-1 border-t border-[var(--line)]">
                  <span className="font-semibold text-[var(--ink)]">Remaining {invoiceMode ? 'Invoice Balance' : 'Khata Due'}:</span>
                  <span className="font-bold font-mono text-rose-600 dark:text-rose-400">{currency(recordedPayment.remainingDue)}</span>
                </div>
              </div>

              <div className="flex w-full gap-2">
                {!invoiceMode && <button
                  type="button"
                  onClick={() => {
                    setRecordedPayment(null)
                    setAmount(recordedPayment.remainingDue > 0 ? String(recordedPayment.remainingDue) : '')
                    setExternalRef('')
                  }}
                  className="flex-1 btn-secondary text-xs h-9 font-semibold"
                >
                  Record Another
                </button>}
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg bg-[#0057B8] text-white text-xs h-9 font-semibold hover:bg-[#003F8F] transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* Collection Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Payment Balance Overview */}
              <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{invoiceMode ? 'Invoice Balance Due' : 'Outstanding Balance'}</div>
                  <div className="font-mono text-base font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                    {currency(outstanding)}
                  </div>
                </div>
                {creditLimit > 0 && (
                  <div className="text-right">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Credit Limit</div>
                    <div className="font-mono text-xs font-semibold text-[var(--ink)] mt-0.5">
                      {currency(creditLimit)}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Amount Selection Buttons */}
              {outstanding > 0 && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-1.5">
                    Quick Preset Amounts
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickAmount(outstanding)}
                      className="rounded-lg border border-[#0057B8] bg-blue-50 dark:bg-sky-950/40 text-[#0057B8] dark:text-sky-300 px-2.5 py-1 text-xs font-semibold hover:opacity-90"
                    >
                      Full Due ({currency(outstanding)})
                    </button>
                    {outstanding > 100 && (
                      <button
                        type="button"
                        onClick={() => handleQuickAmount(Math.round(outstanding / 2))}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--ink)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-hover)]"
                      >
                        50% ({currency(Math.round(outstanding / 2))})
                      </button>
                    )}
                    {[500, 1000, 2000].filter(v => v < outstanding).map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleQuickAmount(v)}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface-subtle)] text-[var(--ink)] px-2.5 py-1 text-xs font-medium hover:bg-[var(--surface-hover)]"
                      >
                        ₹{v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-1">
                  Collection Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-[var(--muted)]">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={outstanding > 0 ? outstanding : undefined}
                    value={amount}
                    onChange={e => handleAmountChange(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-8 pr-3 py-2 text-base font-mono font-bold text-[var(--ink)] focus:outline-none focus:border-[#0057B8]"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-1.5">
                  Payment Channel *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'cash', label: 'Cash', icon: IconCoin, color: 'text-emerald-600' },
                    { id: 'upi', label: 'UPI / QR', icon: IconQrcode, color: 'text-sky-600' },
                    { id: 'card', label: 'Card', icon: IconCreditCard, color: 'text-indigo-600' },
                    { id: 'bank', label: 'Bank Transfer', icon: IconBuildingBank, color: 'text-amber-600' },
                  ].map(pm => {
                    const Icon = pm.icon
                    const isSelected = method === pm.id
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setMethod(pm.id)}
                        className={`flex items-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                          isSelected
                            ? 'border-[#0057B8] bg-blue-50/70 dark:bg-sky-950/40 text-[#0057B8] dark:text-sky-300 ring-1 ring-[#0057B8]'
                            : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                        }`}
                      >
                        <Icon size={16} className={pm.color} />
                        <span>{pm.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Live UPI QR Code when UPI is selected */}
              {method === 'upi' && upiId && (
                <div className="rounded-xl border border-[var(--line)] bg-sky-50/50 dark:bg-sky-950/30 p-3.5 text-center space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-sky-900 dark:text-sky-200">Scan to Pay via Any UPI App</span>
                    <button
                      type="button"
                      onClick={handleCopyUpi}
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-sky-700 dark:text-sky-300 hover:underline"
                    >
                      <IconCopy size={12} />
                      {copiedUpi ? 'Copied' : upiId}
                    </button>
                  </div>

                  <div className="flex justify-center p-2 bg-white rounded-lg shadow-2xs inline-block mx-auto">
                    <QRCodeSVG value={upiUrl || `upi://pay?pa=${upiId}`} size={140} level="M" />
                  </div>

                  <p className="text-[11px] text-[var(--muted)]">
                    Amount: <span className="font-mono font-bold text-[var(--ink)]">{currency(parseFloat(amount) || 0)}</span> • Auto-verifies receipt
                  </p>
                </div>
              )}

              {/* Optional External Reference (UTR / Cheque) */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-1">
                  External Ref / UTR / Cheque (Optional)
                </label>
                <input
                  type="text"
                  value={externalRef}
                  onChange={e => setExternalRef(e.target.value)}
                  placeholder="e.g. Bank UTR, Cheque No, or Auth Code"
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[#0057B8]"
                />
              </div>

              {/* Optional Notes */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-1">
                  Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Counter cash / GPay / Cheque details"
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:border-[#0057B8]"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-950/40 p-2.5 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <IconAlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="btn-secondary px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !amount || parseFloat(amount) <= 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0057B8] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#003F8F] transition disabled:opacity-50"
                >
                  {submitting ? <Spinner size={14} /> : <IconCheck size={16} />}
                  <span>Confirm Receipt ({currency(parseFloat(amount) || 0)})</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}


export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [onlyCredit, setOnlyCredit] = useState(false)
  const [mobileActionId, setMobileActionId] = useState(null)
  const [activeMenuId, setActiveMenuId] = useState(null)
  const [payTarget, setPayTarget] = useState(null)
  const [shopSettings, setShopSettings] = useState({})
  const [shopName, setShopName] = useState('Sri Balaji Store')

  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [viewCustomer, setViewCustomer] = useState(null)
  const [customerBills, setCustomerBills] = useState([])
  const [billsLoading, setBillsLoading] = useState(false)

  const [reminderCustomer, setReminderCustomer] = useState(null)
  const [sending, setSending] = useState(false)
  const [commsKey, setCommsKey] = useState(0)

  const load = useCallback(
    async (query = search) => {
      setLoading(true)

      try {
        const params = query.trim() ? { search: query.trim() } : {}
        const result = await customerService.getCustomers(params)
        const rows = Array.isArray(result?.items) ? result.items : (Array.isArray(result) ? result : [])

        setCustomers(rows)
      } catch (error) {
        toast.error(getErrorMessage(error))
        setCustomers([])
      } finally {
        setLoading(false)
      }
    },
    [search]
  )

  useEffect(() => {
    const timer = setTimeout(() => load(search), 300)

    return () => clearTimeout(timer)
  }, [search, load])

  useEffect(() => {
    settingsService
      .getAll()
      .then(settings => {
        if (settings) {
          setShopSettings(settings)
          if (settings.shop_name) {
            setShopName(settings.shop_name)
          }
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!activeMenuId) return
    const handler = () => setActiveMenuId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [activeMenuId])

  useEffect(() => {
    const handleCollected = () => {
      load(search)
    }
    window.addEventListener('pos:payment-collected', handleCollected)
    return () => window.removeEventListener('pos:payment-collected', handleCollected)
  }, [load, search])

  const openAdd = () => {
    setForm(emptyForm)
    setEditId(null)
    setModal('form')
  }

  const openEdit = customer => {
    setForm({
      name: customer.name || '',
      mobile: customer.mobile || '',
      email: customer.email || '',
      address: customer.address || '',
      gstin: customer.gstin || '',
      credit_limit: customer.credit_limit ?? '0',
    })

    setEditId(customer.id)
    setModal('form')
  }

  const openView = async customer => {
    setViewCustomer(customer)
    setCustomerBills([])
    setModal('view')
    setBillsLoading(true)

    try {
      const data = await customerService.getCustomerBills(customer.id)
      setCustomerBills(Array.isArray(data) ? data : (data?.results || []))
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setBillsLoading(false)
    }
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Customer name is required')
      return
    }

    setSaving(true)

    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        gstin: form.gstin.trim().toUpperCase(),
      }

      if (editId) {
        const res = await customerService.updateCustomer(editId, payload)
        if (res?.requires_approval) {
          toast.success(res.message || 'Credit limit increase submitted for Admin approval')
        } else {
          toast.success('Customer updated successfully')
        }
      } else {
        await customerService.createCustomer(payload)
        toast.success('Customer added successfully')
      }

      setModal(null)
      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    if (!deleteId) return

    setDeleting(true)

    try {
      await customerService.deleteCustomer(deleteId)

      toast.success('Customer deleted')

      setDeleteId(null)

      await load()
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  const sendReminder = async (channel = 'whatsapp') => {
    if (!reminderCustomer) return

    setSending(channel)
    const popup = channel === 'whatsapp' ? window.open('', '_blank') : null

    try {
      const res = await customerService.sendReminder(reminderCustomer.id, channel)

      if (res?.data?.whatsapp_url && channel === 'whatsapp') {
        if (popup) popup.location.href = res.data.whatsapp_url
        else window.location.href = res.data.whatsapp_url
      }

      toast.success(
        `${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} reminder sent to ${
          reminderCustomer.name
        }`
      )

      setCommsKey(k => k + 1)
      setModal(null)
    } catch (error) {
      popup?.close()
      toast.error(
        error?.response?.data?.error ||
          'Failed to send payment reminder'
      )
    } finally {
      setSending(false)
    }
  }

  const sendStatement = async (customer, channel = 'whatsapp') => {
    if (!customer) return

    setSending('statement')
    const popup = channel === 'whatsapp' ? window.open('', '_blank') : null

    try {
      const res = await customerService.sendStatement(customer.id, channel)

      if (res?.data?.whatsapp_url && channel === 'whatsapp') {
        if (popup) popup.location.href = res.data.whatsapp_url
        else window.location.href = res.data.whatsapp_url
      }

      toast.success(
        `Statement sent via WhatsApp to ${customer.name}`
      )

      setCommsKey(k => k + 1)
    } catch (error) {
      popup?.close()
      toast.error(
        error?.response?.data?.error ||
          'Failed to send customer statement'
      )
    } finally {
      setSending(false)
    }
  }

  const openReminder = customer => {
    setReminderCustomer(customer)
    setModal('reminder')
  }

  const updateField = (key, value) => {
    setForm(previous => ({
      ...previous,
      [key]: value,
    }))
  }

  const displayed = useMemo(
    () =>
      onlyCredit
        ? customers.filter(
            customer =>
              Number(customer.outstanding_amount) > 0
          )
        : customers,
    [customers, onlyCredit]
  )

  const stats = useMemo(() => {
    const totalOutstanding = customers.reduce(
      (sum, customer) =>
        sum + Number(customer.outstanding_amount || 0),
      0
    )

    const totalCreditLimit = customers.reduce(
      (sum, customer) =>
        sum + Number(customer.credit_limit || 0),
      0
    )

    const totalBills = customers.reduce(
      (sum, customer) =>
        sum + Number(customer.total_bills || 0),
      0
    )

    const customersWithDue = customers.filter(
      customer =>
        Number(customer.outstanding_amount) > 0
    ).length

    return {
      total: customers.length,
      customersWithDue,
      totalOutstanding,
      totalCreditLimit,
      totalBills,
    }
  }, [customers])

  const hasSearch = search.trim().length > 0

  return (
    <div className="space-y-3 sm:space-y-5">

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}

      <PageHeader
        title="Customers & Parties"
        subtitle={`Directory of ${customers.length} registered customer${customers.length === 1 ? '' : 's'} — track ledgers, credit limits, outstanding balances, and billing statements.`}
        action={
          <div className="hidden sm:block">
            <button
              onClick={openAdd}
              className="btn-primary h-8.5 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg font-bold text-xs shadow-xs"
            >
              <IconPlus size={15} />
              <span>Add Customer</span>
            </button>
          </div>
        }
      />

      {/* =====================================================
          ERP SUMMARY (Tokenized Surfaces, Clean & Accessible)
      ====================================================== */}

      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
        <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x divide-[var(--line)]">
          <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-[var(--surface)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
              Total Customers
            </span>
            <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[var(--ink)] tabular-nums truncate">
              {stats.total}
            </p>
            <p className="text-[10px] text-[var(--muted)] truncate">{stats.customersWithDue} with pending credit</p>
          </div>

          <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-[var(--surface)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
              Total Outstanding
            </span>
            <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-red-600 dark:text-red-400 tabular-nums truncate">
              {currency(stats.totalOutstanding)}
            </p>
            <p className="text-[10px] text-[var(--muted)] truncate">Pending receivable balance</p>
          </div>

          <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-[var(--surface)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
              Total Credit Limit
            </span>
            <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-[#1E3A5F] dark:text-sky-400 tabular-nums truncate">
              {currency(stats.totalCreditLimit)}
            </p>
            <p className="text-[10px] text-[var(--muted)] truncate">Combined authorized limit</p>
          </div>

          <div className="px-3.5 py-2 sm:px-4 sm:py-2.5 bg-[var(--surface)]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] truncate block">
              Linked Bills
            </span>
            <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-teal-600 dark:text-teal-400 tabular-nums truncate">
              {stats.totalBills}
            </p>
            <p className="text-[10px] text-[var(--muted)] truncate">Completed customer sales</p>
          </div>
        </div>
      </section>

      {/* =====================================================
          FILTERS
      ====================================================== */}

      <div className="erp-filter-panel rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 sm:p-3.5 shadow-xs">
        <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center">

          {/* Search */}
          <SearchInput
            value={search}
            onChange={event => setSearch(event.target.value)}
            onClear={() => setSearch('')}
            placeholder="Search customers by name, phone or customer ID..."
            shortcut="Ctrl+K"
            className="flex-1"
          />

          {/* Credit filter - simple pill button */}
          <button
            type="button"
            onClick={() => setOnlyCredit(v => !v)}
            aria-pressed={onlyCredit}
            className={`h-[42px] px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 transition shadow-xs shrink-0 ${
              onlyCredit
                ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
                : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${onlyCredit ? 'bg-rose-600 dark:bg-rose-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
            <span>Credit Due Only</span>
          </button>
        </div>

        {(hasSearch || onlyCredit) && (
          <div className="flex items-center gap-2 mt-2.5 text-xs text-[var(--muted)]">
            <span>Showing {displayed.length} result(s)</span>
            {onlyCredit && (
              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 font-medium">
                Credit due
              </span>
            )}
          </div>
        )}
      </div>

      {/* =====================================================
          CUSTOMER LIST (Desktop Table & Mobile Cards)
      ====================================================== */}

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-xs">

        {loading ? (
          <TableSkeleton rows={8} cols={5} label="Loading customers" />
        ) : displayed.length === 0 ? (
          !hasSearch && !onlyCredit ? (
            <CustomerEmptyIllustration onAddCustomer={openAdd} />
          ) : (
            <EmptyState
              icon={IconUsers}
              title="No customers match your filters"
              description="Try adjusting your search terms or credit filter."
              action={{
                label: 'Clear Filters',
                onClick: () => {
                  setSearch('')
                  setOnlyCredit(false)
                },
              }}
            />
          )
        ) : (
          <>
            {/* =================================================
                DESKTOP TABLE
            ================================================== */}

            <div className="hidden lg:block overflow-x-auto min-h-[220px] pb-4">
              <table className="erp-table w-full text-left border-collapse min-w-[1050px]">
                <colgroup>
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '20%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '12%' }} />
                  <col style={{ width: '6%' }} />
                  <col style={{ width: '13%' }} />
                </colgroup>
                <thead className="bg-[var(--surface-subtle)] border-b border-[var(--line)] text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  <tr>
                    <th className="px-4 py-3.5">Customer</th>
                    <th className="px-4 py-3.5">Contact</th>
                    <th className="px-4 py-3.5">GSTIN</th>
                    <th className="px-4 py-3.5 text-right">Credit Limit</th>
                    <th className="px-4 py-3.5 text-right">Outstanding</th>
                    <th className="px-4 py-3.5 text-center">Bills</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {displayed.map((customer, idx) => {
                    const isLastRows = displayed.length > 2 && idx >= displayed.length - 2
                    const outstanding = Number(customer.outstanding_amount || 0)
                    const creditLimit = Number(customer.credit_limit || 0)

                    return (
                      <tr key={customer.id} className="bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition">
                        {/* Customer */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3 min-w-[190px]">
                            <div className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] border border-[var(--line)] flex items-center justify-center shrink-0 text-[#1E3A5F] dark:text-slate-300">
                              <IconUserCircle size={15} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-[var(--ink)] truncate text-sm">
                                {customer.name}
                              </p>
                              {customer.address && (
                                <p className="text-xs text-[var(--muted)] truncate max-w-[180px]">
                                  {customer.address}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-4 py-3.5">
                          <div className="space-y-1 text-xs">
                            {customer.mobile ? (
                              <a
                                href={`tel:${customer.mobile}`}
                                className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                              >
                                <IconPhone size={12} />
                                {customer.mobile}
                              </a>
                            ) : null}
                            {customer.email ? (
                              <a
                                href={`mailto:${customer.email}`}
                                className="flex items-center gap-1.5 text-[var(--ink-secondary)] hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[200px]"
                              >
                                <IconMail size={12} />
                                {customer.email}
                              </a>
                            ) : null}
                            {!customer.mobile && !customer.email && (
                              <span className="text-[var(--muted-light)]">—</span>
                            )}
                          </div>
                        </td>

                        {/* GSTIN */}
                        <td className="px-4 py-3.5 text-xs">
                          {customer.gstin ? (
                            <span className="font-mono text-[var(--ink-secondary)]">
                              {customer.gstin}
                            </span>
                          ) : (
                            <span className="text-[var(--muted-light)]">—</span>
                          )}
                        </td>

                        {/* Credit Limit */}
                        <td className="px-4 py-3.5 text-right font-mono text-xs text-[var(--ink-secondary)]">
                          {currency(creditLimit)}
                        </td>

                        {/* Outstanding */}
                        <td className="px-4 py-3.5 text-right font-mono">
                          <span
                            className={`text-xs font-bold ${
                              outstanding > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {currency(outstanding)}
                          </span>
                        </td>

                        {/* Bills */}
                        <td className="px-4 py-3.5 text-center font-mono text-xs font-semibold text-[var(--ink-secondary)]">
                          {customer.total_bills ?? 0}
                        </td>

                        {/* Actions */}
                        <td className="w-[13%] min-w-[170px] px-2 py-2 text-right">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            {outstanding > 0 && (
                              <button
                                type="button"
                                onClick={() => setPayTarget(customer)}
                                className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md bg-emerald-600 px-1.5 text-[10px] font-medium text-white whitespace-nowrap hover:bg-emerald-700 transition-colors"
                                title={`Collect payment (${currency(outstanding)} due)`}
                              >
                                <IconCurrencyRupee size={10} strokeWidth={2} />
                                <span>Collect</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openView(customer)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:border-[var(--line-strong)] transition"
                              title="View customer"
                            >
                              <IconEye size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => openEdit(customer)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:border-[var(--line-strong)] transition"
                              title="Edit customer"
                            >
                              <IconEdit size={13} />
                            </button>

                            <div className="relative shrink-0">
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation()
                                  setActiveMenuId(current => current === customer.id ? null : customer.id)
                                }}
                                className={`flex h-7 w-7 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--line-strong)] transition ${
                                  activeMenuId === customer.id ? 'border-[var(--line-strong)] bg-[var(--surface-hover)]' : ''
                                }`}
                                title="More actions"
                              >
                                <IconDots size={14} />
                              </button>

                              {activeMenuId === customer.id && (
                                <div
                                  className={`absolute right-0 z-50 w-44 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-xl ${
                                    isLastRows ? 'bottom-full mb-1' : 'top-8'
                                  }`}
                                  onClick={e => e.stopPropagation()}
                                >
                                  {outstanding > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuId(null)
                                        openReminder(customer)
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                                    >
                                      <IconSend size={13} />
                                      <span>Send Reminder</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null)
                                      sendStatement(customer)
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 transition"
                                  >
                                    <IconFileText size={13} />
                                    <span>Send Statement</span>
                                  </button>

                                  <div className="my-1 border-t border-[var(--line)]" />

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuId(null)
                                      setDeleteId(customer.id)
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-rose-950/40 transition"
                                  >
                                    <IconTrash size={13} />
                                    <span>Delete Customer</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* =================================================
                MOBILE CARD LIST (Clean, 1-Tap Touch Ergonomics)
            ================================================== */}

            <div className="lg:hidden divide-y divide-[var(--line)]">
              {displayed.map(customer => {
                const outstanding = Number(customer.outstanding_amount || 0)

                return (
                  <article
                    key={customer.id}
                    className="p-3 bg-[var(--surface)] space-y-2 hover:bg-[var(--surface-hover)]/40 transition-colors"
                  >
                    {/* Top Row: Name and Balance */}
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-bold text-sm text-[var(--ink)] truncate">
                        {customer.name}
                      </h3>
                      <span
                        className={`shrink-0 font-mono text-sm font-bold ${
                          outstanding > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {currency(outstanding)}
                      </span>
                    </div>

                    {/* Info Sub-row: Phone · Bills · Credit / Status */}
                    <div className="flex items-center justify-between text-xs text-[var(--muted)] gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        {customer.mobile ? (
                          <a
                            href={`tel:${customer.mobile}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium shrink-0"
                          >
                            <IconPhone size={11} />
                            <span>{customer.mobile}</span>
                          </a>
                        ) : (
                          <span className="shrink-0">No phone</span>
                        )}
                        <span>·</span>
                        <span className="truncate">{customer.total_bills ?? 0} bills</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                        <span className="font-mono text-[var(--ink-secondary)]">Limit: {currency(customer.credit_limit || 0)}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            outstanding > 0
                              ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          }`}
                        >
                          {outstanding > 0 ? 'Due' : 'Paid'}
                        </span>
                      </div>
                    </div>

                    {/* Action Row: View Eye, Collect Due, Send Statement, Three dots */}
                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-[var(--line-subtle)]">
                      {/* View Eye Button */}
                      <button
                        type="button"
                        onClick={() => openView(customer)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--ink)] hover:bg-[var(--surface-hover)] active:scale-95 transition shrink-0"
                        title="View Customer"
                      >
                        <IconEye size={15} />
                      </button>

                      {/* Collect Button */}
                      <button
                        type="button"
                        onClick={() => setPayTarget(customer)}
                        className={`flex-1 inline-flex h-8 items-center justify-center gap-1 rounded-lg text-xs font-semibold active:scale-95 transition shadow-2xs ${
                          outstanding > 0
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--ink)] hover:bg-[var(--surface-hover)]'
                        }`}
                        title="Collect Payment"
                      >
                        <IconCurrencyRupee size={13} className="shrink-0" />
                        <span className="truncate">Collect</span>
                      </button>

                      {/* Send Statement Button */}
                      <button
                        type="button"
                        onClick={() => sendStatement(customer)}
                        className="flex-1 inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] active:scale-95 transition shadow-2xs"
                        title="Send Statement"
                      >
                        <IconFileText size={13} className="shrink-0" />
                        <span className="truncate">Statement</span>
                      </button>

                      {/* Three Dot Button */}
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={() => setMobileActionId(curr => curr === customer.id ? null : customer.id)}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--ink)] hover:bg-[var(--surface-hover)] active:scale-95 transition ${
                            mobileActionId === customer.id ? 'border-[var(--primary)] bg-[var(--surface-hover)]' : ''
                          }`}
                          aria-label="More actions"
                        >
                          <IconDots size={16} />
                        </button>

                        {mobileActionId === customer.id && (
                          <div className="absolute right-0 bottom-full mb-1 z-50 w-44 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-xl">
                            <button
                              type="button"
                              onClick={() => {
                                setMobileActionId(null)
                                openEdit(customer)
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                            >
                              <IconEdit size={14} />
                              <span>Edit Customer</span>
                            </button>
                            {outstanding > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMobileActionId(null)
                                  openReminder(customer)
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-amber-600 dark:text-amber-400 hover:bg-[var(--surface-hover)] transition"
                              >
                                <IconSend size={14} />
                                <span>Send Reminder</span>
                              </button>
                            )}
                            {customer.mobile && (
                              <a
                                href={`tel:${customer.mobile}`}
                                onClick={() => setMobileActionId(null)}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                              >
                                <IconPhone size={14} />
                                <span>Call Customer</span>
                              </a>
                            )}
                            <div className="my-1 border-t border-[var(--line-subtle)]" />
                            <button
                              type="button"
                              onClick={() => {
                                setMobileActionId(null)
                                setDeleteId(customer.id)
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                            >
                              <IconTrash size={14} />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}

      </div>

      {/* =====================================================
          PAYMENT REMINDER MODAL
      ====================================================== */}

      <Modal
        open={modal === 'reminder'}
        onClose={() => setModal(null)}
        title="Send Payment Reminder"
        size="sm"
      >

        {reminderCustomer && (
          <div className="space-y-4">

            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/30 p-4">

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 flex items-center justify-center">
                  <IconWallet size={18} />
                </div>

                <div>

                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    {reminderCustomer.name}
                  </p>

                  <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1">
                    Outstanding:{' '}
                    <span className="font-bold">
                      {currency(reminderCustomer.outstanding_amount)}
                    </span>
                  </p>

                </div>

              </div>

              {reminderCustomer.mobile && (
                <p className="text-xs text-[var(--muted)] mt-3">
                  Mobile: {reminderCustomer.mobile}
                </p>
              )}

            </div>

            <p className="text-sm text-[var(--muted)]">
              Choose how you want to send the payment reminder.
            </p>

            <div className="grid grid-cols-2 gap-3">

              <button
                onClick={() => sendReminder('sms')}
                disabled={!!sending}
                className="flex flex-col items-center gap-2 border border-[var(--line)] bg-[var(--surface)] rounded-md p-3.5 hover:border-[#1E3A5F] hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
              >

                <IconMessage
                  size={20}
                  className="text-[#1E3A5F] dark:text-slate-300"
                />

                <span className="text-xs font-semibold text-[var(--ink)]">
                  {sending === 'sms'
                    ? 'Sending…'
                    : 'SMS'}
                </span>

              </button>

              <button
                onClick={() =>
                  sendReminder('whatsapp')
                }
                disabled={!!sending}
                className="flex flex-col items-center gap-2 border border-[var(--line)] bg-[var(--surface)] rounded-md p-3.5 hover:border-teal-600 hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
              >

                <IconSend
                  size={20}
                  className="text-teal-700 dark:text-teal-400"
                />

                <span className="text-xs font-semibold text-[var(--ink)]">
                  {sending === 'whatsapp'
                    ? 'Sending…'
                    : 'WhatsApp'}
                </span>

              </button>

            </div>

            {reminderCustomer.mobile && (
              <a
                href={`tel:${reminderCustomer.mobile}`}
                className="flex items-center justify-center gap-2 w-full border border-[var(--line)] rounded-md p-2.5 hover:bg-[var(--surface-hover)] transition text-xs font-semibold text-[var(--ink)]"
              >
                <IconPhone
                  size={15}
                  className="text-[var(--muted)]"
                />

                Call {reminderCustomer.mobile}
              </a>
            )}

            <div className="pt-3 border-t border-[var(--line)]">
              <CommunicationHistory
                referenceType="customer"
                referenceId={reminderCustomer.id}
                key={commsKey}
                compact
              />
            </div>

          </div>
        )}

      </Modal>

      {/* =====================================================
          ADD / EDIT CUSTOMER
      ====================================================== */}

      <Modal
        open={modal === 'form'}
        onClose={() => !saving && setModal(null)}
        title={editId ? 'Edit Customer' : 'Add Customer'}
        subtitle={editId ? 'Update contact, address and credit settings' : 'Register a new customer for billing and credit ledger'}
        size="md"
        footer={
          <div className="flex w-full items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setModal(null)}
              disabled={saving}
              className="min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="min-h-[44px] rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <IconRefresh size={15} className="animate-spin" /> <span>Saving…</span>
                </>
              ) : (
                <>
                  <IconCircleCheck size={15} /> <span>{editId ? 'Update Customer' : 'Save Customer'}</span>
                </>
              )}
            </button>
          </div>
        }
      >

        <div className="space-y-5">

          <div className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 shadow-xs">

            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[#1E3A5F] dark:text-slate-300 flex items-center justify-center">

              {editId ? (
                <IconEdit size={16} />
              ) : (
                <IconUserCircle size={16} />
              )}

            </div>

            <div>

              <p className="font-semibold text-xs text-[var(--ink)]">
                {editId
                  ? 'Update customer details'
                  : 'Create a new customer'}
              </p>

              <p className="text-[11px] text-[var(--muted)] mt-0.5">
                Keep contact and credit information accurate.
              </p>

            </div>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div className="sm:col-span-2">

              <label className="label">
                Customer Name *
              </label>

              <input
                className="input"
                autoFocus
                value={form.name}
                onChange={event =>
                  updateField(
                    'name',
                    event.target.value
                  )
                }
                placeholder="Enter customer name"
              />

            </div>

            <div>

              <label className="label">
                Mobile
              </label>

              <input
                type="tel"
                className="input"
                value={form.mobile}
                onChange={event =>
                  updateField(
                    'mobile',
                    event.target.value
                  )
                }
                placeholder="Enter mobile number"
              />

            </div>

            <div>

              <label className="label">
                Email
              </label>

              <input
                type="email"
                className="input"
                value={form.email}
                onChange={event =>
                  updateField(
                    'email',
                    event.target.value
                  )
                }
                placeholder="customer@example.com"
              />

            </div>

            <div className="sm:col-span-2">

              <label className="label">
                Address
              </label>

              <textarea
                className="input resize-none"
                rows={3}
                value={form.address}
                onChange={event =>
                  updateField(
                    'address',
                    event.target.value
                  )
                }
                placeholder="Enter customer address"
              />

            </div>

            <div>

              <label className="label">
                GSTIN
              </label>

              <input
                className="input uppercase"
                value={form.gstin}
                onChange={event =>
                  updateField(
                    'gstin',
                    event.target.value.toUpperCase()
                  )
                }
                placeholder="GSTIN (optional)"
                maxLength={15}
              />

            </div>

            <div>

              <label className="label">
                Credit Limit
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                className="input"
                value={form.credit_limit}
                onChange={event =>
                  updateField(
                    'credit_limit',
                    event.target.value
                  )
                }
                placeholder="0"
              />

            </div>

          </div>

        </div>
      </Modal>

      {/* =====================================================
          CUSTOMER DETAILS
      ====================================================== */}

      <Modal
        open={modal === 'view'}
        onClose={() => setModal(null)}
        title={`Customer: ${
          viewCustomer?.name || ''
        }`}
        size="lg"
      >

        {viewCustomer && (
          <div className="space-y-4">

            {/* Header card */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3.5">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-full bg-[#1E3A5F]/10 dark:bg-slate-800 border border-[var(--line)] flex items-center justify-center shrink-0 text-[#1E3A5F] dark:text-slate-300">
                    <IconUserCircle size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-[var(--ink)] truncate">{viewCustomer.name}</h3>
                    <p className="text-xs text-[var(--muted)] mt-0.5">ID: #{viewCustomer.id}</p>
                    {viewCustomer.gstin && (
                      <div className="mt-1 flex items-center gap-1 text-xs">
                        <IconBuildingStore size={11} className="text-[var(--muted)]" />
                        <span className="font-mono text-[var(--ink-secondary)]">{viewCustomer.gstin}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  {Number(viewCustomer.outstanding_amount || 0) > 0 && (
                    <button type="button" onClick={() => setPayTarget(viewCustomer)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold shadow-xs transition">
                      <IconCurrencyRupee size={13} />
                      <span>Collect {currency(viewCustomer.outstanding_amount)}</span>
                    </button>
                  )}
                  {Number(viewCustomer.outstanding_amount || 0) > 0 && (
                    <button onClick={() => { setReminderCustomer(viewCustomer); sendReminder('whatsapp') }}
                      disabled={sending === 'whatsapp'}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white px-3 py-1.5 text-xs font-bold transition disabled:opacity-50">
                      <IconMessageCircle size={13} />
                      <span>{sending === 'whatsapp' ? 'Sending…' : 'Remind'}</span>
                    </button>
                  )}
                  <button onClick={() => sendStatement(viewCustomer)} disabled={sending === 'statement'}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition">
                    <IconFileText size={13} />
                    <span>Statement</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Total Bills', value: viewCustomer.total_bills ?? 0, color: 'text-[#1E3A5F] dark:text-slate-200' },
                { label: 'Total Purchases', value: currency(viewCustomer.total_purchases), color: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'Outstanding', value: currency(viewCustomer.outstanding_amount), color: 'text-rose-600 dark:text-rose-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-center">
                  <p className="text-[10px] text-[var(--muted)] font-semibold uppercase tracking-wide">{label}</p>
                  <p className={`mt-1 text-base font-bold font-mono ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Contact info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {viewCustomer.mobile && (
                <a href={`tel:${viewCustomer.mobile}`}
                  className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 hover:border-blue-300 transition">
                  <IconPhone size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-[var(--muted)] uppercase font-semibold">Mobile</p>
                    <p className="text-sm font-medium text-[var(--ink)]">{viewCustomer.mobile}</p>
                  </div>
                </a>
              )}
              {viewCustomer.email && (
                <a href={`mailto:${viewCustomer.email}`}
                  className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 hover:border-blue-300 transition min-w-0">
                  <IconMail size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-[var(--muted)] uppercase font-semibold">Email</p>
                    <p className="text-sm font-medium text-[var(--ink)] truncate">{viewCustomer.email}</p>
                  </div>
                </a>
              )}
              {viewCustomer.address && (
                <div className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                  <IconMapPin size={15} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-[var(--muted)] uppercase font-semibold">Address</p>
                    <p className="text-sm font-medium text-[var(--ink)] mt-0.5">{viewCustomer.address}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Bills */}
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h4 className="font-semibold text-sm text-[var(--ink)]">Recent Bills</h4>
                <span className="text-xs text-[var(--muted)]">{customerBills.length} record(s)</span>
              </div>

              {billsLoading ? (
                <div className="py-6"><Spinner /></div>
              ) : customerBills.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface)] py-8 text-center">
                  <IconFileText size={22} className="mx-auto text-[var(--muted)]" />
                  <p className="text-xs text-[var(--muted)] mt-2">No bills yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                  <table className="table w-full min-w-[360px]">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Date</th>
                        <th className="text-right">Total</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customerBills.map(bill => (
                        <tr key={bill.id}>
                          <td className="font-mono text-blue-600 dark:text-blue-400 text-xs">{bill.invoice_number}</td>
                          <td className="text-xs font-mono">{formatDate(bill.created_at)}</td>
                          <td className="text-right font-semibold text-xs font-mono">{currency(bill.grand_total)}</td>
                          <td className="text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              String(bill.payment_status).toLowerCase() === 'paid'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
                            }`}>{bill.payment_status || 'Unknown'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Communication History */}
            <div className="pt-2 border-t border-[var(--line)]">
              <CommunicationHistory referenceType="customer" referenceId={viewCustomer.id} key={commsKey} />
            </div>

          </div>
        )}

      </Modal>

      {/* =====================================================
          COLLECT PAYMENT MODAL
      ====================================================== */}
      <CustomerCollectPaymentModal
        customer={payTarget}
        shopSettings={shopSettings}
        shopName={shopName}
        onClose={() => setPayTarget(null)}
        onSuccess={() => {
          load(search)
          if (viewCustomer && viewCustomer.id === payTarget?.id) {
            customerService.getCustomer(viewCustomer.id).then(c => {
              if (c) setViewCustomer(c)
            }).catch(() => {})
            customerService.getCustomerBills(viewCustomer.id).then(bills => {
              setCustomerBills(Array.isArray(bills) ? bills : (bills?.results || []))
            }).catch(() => {})
          }
        }}
      />

      {/* =====================================================
          DELETE CONFIRMATION
      ====================================================== */}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() =>
          !deleting && setDeleteId(null)
        }
        onConfirm={del}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This action cannot be undone."
        danger
      />

      {/* Fixed Floating Action Button on Mobile */}
      <MobileFAB icon={IconPlus} label="Add Customer" onClick={openAdd} />
    </div>
  )
}
