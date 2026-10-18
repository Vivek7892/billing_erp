import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import api from '../api'
import customerService from '../features/customers/api/customerService'
import settingsService from '../features/settings/api/settingsService'
import {
  Card,
  PageHeader,
  Modal,
  ConfirmDialog,
  Spinner,
  TableSkeleton,
  EmptyState,
} from '../components/UI'
import toast from 'react-hot-toast'
import CommunicationHistory from '../components/CommunicationHistory'
import { QRCodeSVG } from 'qrcode.react'
import { GooglePayLogo, PhonePeLogo, PaytmLogo, UpiLogo } from '../components/UpiLogos'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  Phone,
  Mail,
  MapPin,
  MessageSquare,
  Send,
  Users,
  WalletCards,
  IndianRupee,
  FileText,
  RefreshCw,
  X,
  UserRound,
  Building2,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  CircleDollarSign,
  QrCode,
  CreditCard,
  Copy,
  Check,
  MessageCircle,
} from 'lucide-react'

const emptyForm = {
  name: '',
  mobile: '',
  email: '',
  address: '',
  gstin: '',
  credit_limit: '0',
}

const currency = value =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`

const getInitials = name =>
  String(name || 'Customer')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('')

const avatarColors = [
  'bg-white text-[#1E3A5F] border border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700',
  'bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/40',
  'bg-white text-slate-800 border border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700',
  'bg-sky-50 text-[#1E3A5F] border border-sky-200 dark:bg-slate-900 dark:text-sky-300 dark:border-slate-700',
]

const CustomerAvatar = ({ customer, size = 'md' }) => {
  const initials = getInitials(customer?.name)
  const color = avatarColors[(Number(customer?.id) || 0) % avatarColors.length]
  const dimensions = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'sm' ? 'w-9 h-9 text-xs' : 'w-11 h-11 text-sm'

  return customer?.profile_picture || customer?.profile_image || customer?.avatar ? (
    <img
      src={customer.profile_picture || customer.profile_image || customer.avatar}
      alt={customer?.name || 'Customer'}
      className={`${dimensions} rounded-full object-cover shrink-0`}
    />
  ) : (
    <div className={`${dimensions} ${color} rounded-full flex items-center justify-center font-bold ring-2 ring-[var(--surface)] shadow-sm shrink-0`}>
      {initials || <UserRound size={18} />}
    </div>
  )
}

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
  shopSettings,
  shopName,
  onClose,
  onSuccess,
}) {
  const modalRef = useRef(null)
  const outstanding = Number(customer?.outstanding_amount || 0)

  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding) : '')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [copiedUpi, setCopiedUpi] = useState(false)

  useEffect(() => {
    if (customer && outstanding > 0) {
      setAmount(String(outstanding))
      setError('')
      setReference('')
      setNotes('')
    }
  }, [customer, outstanding])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!customer) return null

  const handleAmountChange = (val) => {
    setAmount(val)
    setError('')
    const num = parseFloat(val)
    if (isNaN(num) || num <= 0) {
      setError('Amount must be greater than zero')
    } else if (num > outstanding) {
      setError(`Amount cannot exceed outstanding balance (${currency(outstanding)})`)
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid amount greater than zero.')
      return
    }
    if (num > outstanding) {
      setError(`Amount cannot exceed outstanding balance (${currency(outstanding)}).`)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const res = await customerService.recordPayment(customer.id, {
        amount: num,
        method,
        reference: reference.trim(),
        notes: notes.trim(),
      })
      toast.success(`Payment of ${currency(num)} recorded for ${customer.name}!`)
      window.dispatchEvent(new CustomEvent('pos:payment-collected', { detail: res }))
      onSuccess?.(res)
      onClose()
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.response?.data?.amount || err?.message || 'Failed to record customer payment'
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
      toast.error('Failed to record customer payment')
    } finally {
      setSubmitting(false)
    }
  }

  // Payment methods: ONLY Cash, UPI, and Card. Online/Bank is removed!
  const METHODS = [
    { id: 'cash', label: 'Cash', icon: IndianRupee },
    { id: 'upi', label: 'UPI / QR', icon: QrCode },
    { id: 'card', label: 'Card / POS', icon: CreditCard },
  ]

  const upiId = shopSettings?.shop_upi_id || ''
  const merchantName = shopSettings?.upi_merchant_name || shopName || 'Sri Balaji Store'
  const amountNum = parseFloat(amount) || 0
  const effectiveUpiId = upiId || 'merchant@upi'
  const upiNote = `Credit Pay - ${customer.name}`
  const upiUri = `upi://pay?pa=${encodeURIComponent(effectiveUpiId)}&pn=${encodeURIComponent(merchantName)}&am=${amountNum > 0 ? amountNum.toFixed(2) : '1.00'}&cu=INR&tn=${encodeURIComponent(upiNote)}`

  const handleCopyUpi = () => {
    if (!effectiveUpiId) return
    navigator.clipboard.writeText(effectiveUpiId)
    setCopiedUpi(true)
    toast.success('UPI ID copied')
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  return (
    <Modal
      open={Boolean(customer)}
      onClose={onClose}
      title="Collect Customer Payment"
      subtitle={`${customer.name}${customer.mobile ? ` · ${customer.mobile}` : ''}`}
      size="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[44px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || Boolean(error) || !amount}
            className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-6 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50 transition"
          >
            {submitting ? (
              <>
                <Spinner size={14} />
                <span>Recording…</span>
              </>
            ) : (
              <>
                <IndianRupee size={14} />
                <span>Record {currency(parseFloat(amount) || 0)}</span>
              </>
            )}
          </button>
        </div>
      }
    >

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {/* Outstanding banner */}
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3">
            <div className="rounded-lg bg-[var(--surface)] p-2 border border-[var(--line)] text-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted)] block">Credit Limit</span>
              <p className="mt-0.5 font-mono text-sm font-semibold text-[var(--ink)]">{currency(customer.credit_limit || 0)}</p>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2 border border-amber-300 dark:border-amber-700 text-center">
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block">Outstanding Due</span>
              <p className="mt-0.5 font-mono text-sm font-bold text-amber-600 dark:text-amber-400">{currency(outstanding)}</p>
            </div>
          </div>

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-[var(--ink)]">Amount (₹) <span className="text-rose-500">*</span></label>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => handleAmountChange(String(outstanding))}
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold bg-[var(--surface)] text-emerald-700 dark:text-emerald-400 border border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition">
                  Full {currency(outstanding)}
                </button>
                {outstanding > 100 && (
                  <button type="button" onClick={() => handleAmountChange(String((outstanding / 2).toFixed(2)))}
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold bg-[var(--surface)] text-[var(--ink-secondary)] border border-[var(--line)] hover:border-[var(--line-strong)] transition">
                    50%
                  </button>
                )}
              </div>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--muted)]">
                <IndianRupee size={15} />
              </div>
              <input type="number" step="0.01" min="0.01" max={outstanding} required
                value={amount} onChange={e => handleAmountChange(e.target.value)} placeholder="0.00"
                className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] pl-8 pr-3 py-2.5 text-base font-mono font-bold text-[var(--ink)] placeholder:text-[var(--placeholder)] focus:border-[#1E3A5F] focus:ring-2 focus:ring-[#1E3A5F]/15 outline-none transition" />
            </div>
            {error && (
              <p className="mt-1.5 text-xs font-medium text-rose-500 flex items-center gap-1">
                <AlertCircle size={12} />{error}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <label className="text-xs font-bold text-[var(--ink)] mb-1.5 block">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(m => {
                const Icon = m.icon
                const selected = method === m.id
                return (
                  <button key={m.id} type="button" onClick={() => setMethod(m.id)}
                    className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-xs font-semibold transition ${
                      selected ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white shadow-sm' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:border-[var(--line-strong)]'
                    }`}>
                    <Icon size={17} />
                    <span>{m.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Method-specific content */}
          {method === 'upi' ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-4 text-center space-y-3">
              {/* QR Code */}
              <div className="mx-auto w-fit p-3 bg-white rounded-xl border-2 border-[#1E3A5F]/20 shadow-sm">
                <QRCodeSVG value={upiUri} size={160} level="M" includeMargin={false} />
              </div>

              {/* Amount display */}
              <div>
                <p className="font-mono text-lg font-black text-[#1E3A5F] dark:text-sky-300">{currency(amountNum)}</p>
                <p className="text-[10px] text-[var(--muted)] mt-0.5">Scan to pay · {customer.name}</p>
              </div>

              {/* UPI ID row */}
              <div className="flex items-center justify-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
                <span className="font-mono text-xs font-semibold text-[var(--ink)] truncate">{effectiveUpiId}</span>
                <button type="button" onClick={handleCopyUpi}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E3A5F] dark:text-sky-400 hover:underline">
                  {copiedUpi ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                  <span>{copiedUpi ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              {/* Payment app logos */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <GooglePayLogo height={20} />
                <PhonePeLogo height={20} />
                <PaytmLogo height={20} />
                <UpiLogo height={20} />
              </div>
            </div>
          ) : method === 'card' ? (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3.5">
              <p className="text-xs font-semibold text-[var(--ink)]">Card / POS Terminal</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">Swipe or tap card on POS machine for {currency(amountNum)}. Enter approval code below.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-subtle)] p-3.5">
              <p className="text-xs font-semibold text-[var(--ink)]">Cash Collection</p>
              <p className="mt-1 text-[11px] text-[var(--muted)]">Collect {currency(amountNum)} in cash. Settles oldest unpaid bills first (FIFO).</p>
            </div>
          )}

          {/* Reference */}
          <div>
            <label className="text-xs font-medium text-[var(--ink-secondary)] mb-1 block">
              {method === 'upi' ? 'UPI UTR / Reference (Optional)' : method === 'card' ? 'Card Auth Code (Optional)' : 'Cash Receipt Ref (Optional)'}
            </label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)}
              placeholder={method === 'upi' ? '12-digit UTR' : method === 'card' ? 'Auth #9872' : 'Cash ref'}
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--placeholder)] focus:border-[#1E3A5F] outline-none transition" />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-[var(--ink-secondary)] mb-1 block">Notes (Optional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Cleared credit dues"
              className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--placeholder)] focus:border-[#1E3A5F] outline-none transition" />
          </div>
        </form>

    </Modal>
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
          <button
            onClick={openAdd}
            className="btn-primary min-h-[38px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg font-bold text-xs"
          >
            <Plus size={15} />
            <span>Add Customer</span>
          </button>
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

      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 sm:p-3.5 shadow-xs">
        <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center">

          {/* Search */}
          <div className="group relative flex min-w-0 flex-1 items-center min-h-[42px] rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 transition-all duration-200 hover:border-[var(--line-strong)] focus-within:border-[#1E3A5F] focus-within:ring-2 focus-within:ring-[#1E3A5F]/15 dark:focus-within:border-sky-500 dark:focus-within:ring-sky-500/20 shadow-xs">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--muted)] group-focus-within:text-[#1E3A5F] dark:group-focus-within:text-sky-400">
              <Search size={15} strokeWidth={2.2} />
            </div>

            <input
              className="w-full bg-transparent px-2.5 text-xs sm:text-sm font-medium text-[var(--ink)] placeholder:text-[var(--placeholder)] outline-none"
              placeholder="Search name, mobile, or email..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />

            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:text-[var(--ink)] active:scale-95 transition"
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex shrink-0 items-center rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                Ctrl+K
              </kbd>
            )}
          </div>

          {/* Credit filter */}
          <label className="flex items-center gap-2 cursor-pointer select-none rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-xs sm:text-sm font-medium text-[var(--ink-secondary)] hover:border-[var(--line-strong)] transition shadow-xs">
            <input
              type="checkbox"
              checked={onlyCredit}
              onChange={event => setOnlyCredit(event.target.checked)}
              className="h-4 w-4 rounded border-[var(--line)] text-[#1E3A5F] focus:ring-[#1E3A5F]"
            />
            <span>Credit Due Only</span>
          </label>
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
          <EmptyState
            icon={Users}
            title={hasSearch || onlyCredit ? 'No customers match your filters' : 'No customers yet'}
            description={
              hasSearch || onlyCredit
                ? 'Try adjusting your search terms or credit filter.'
                : 'Add your first customer to track ledger balance, invoices, and communication.'
            }
            action={
              hasSearch || onlyCredit
                ? {
                    label: 'Clear Filters',
                    onClick: () => {
                      setSearch('')
                      setOnlyCredit(false)
                    },
                  }
                : {
                    label: 'Add First Customer',
                    onClick: openAdd,
                  }
            }
          />
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
                              <UserRound size={15} />
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
                                <Phone size={12} />
                                {customer.mobile}
                              </a>
                            ) : null}
                            {customer.email ? (
                              <a
                                href={`mailto:${customer.email}`}
                                className="flex items-center gap-1.5 text-[var(--ink-secondary)] hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[200px]"
                              >
                                <Mail size={12} />
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
                                <IndianRupee size={10} strokeWidth={2} />
                                <span>Collect</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openView(customer)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:border-[var(--line-strong)] transition"
                              title="View customer"
                            >
                              <Eye size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => openEdit(customer)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:border-[var(--line-strong)] transition"
                              title="Edit customer"
                            >
                              <Edit2 size={13} />
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
                                <MoreHorizontal size={14} />
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
                                      <Send size={13} />
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
                                    <FileText size={13} />
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
                                    <Trash2 size={13} />
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
                    className="p-3.5 bg-[var(--surface)] space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-[var(--surface-subtle)] border border-[var(--line)] flex items-center justify-center shrink-0 text-[var(--primary)]">
                          <UserRound size={14} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-[var(--ink)] truncate">
                            {customer.name}
                          </h3>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--muted)]">
                            {customer.mobile ? (
                              <a
                                href={`tel:${customer.mobile}`}
                                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                              >
                                <Phone size={10} />
                                <span>{customer.mobile}</span>
                              </a>
                            ) : (
                              <span>No mobile</span>
                            )}
                            <span>•</span>
                            <span>{customer.total_bills ?? 0} bills</span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={`font-mono text-sm font-bold ${
                            outstanding > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {currency(outstanding)}
                        </p>
                        <span
                          className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                            outstanding > 0
                              ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          }`}
                        >
                          {outstanding > 0 ? 'Credit Due' : 'Paid Up'}
                        </span>
                      </div>
                    </div>

                    {/* Compact info strip */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 py-1.5">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
                          Credit limit
                        </span>
                        <span className="font-mono font-semibold text-[var(--ink)]">
                          {currency(customer.credit_limit || 0)}
                        </span>
                      </div>
                      <div className="rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] px-2.5 py-1.5">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
                          GSTIN
                        </span>
                        <span className="block truncate font-mono font-semibold text-[var(--ink)]">
                          {customer.gstin || 'None'}
                        </span>
                      </div>
                    </div>

                    {/* 1-Tap Mobile Action Row */}
                    <div className="space-y-2 pt-1 border-t border-[var(--line)]">
                      {outstanding > 0 && (
                        <button
                          type="button"
                          onClick={() => setPayTarget(customer)}
                          className="w-full flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-emerald-600 active:bg-emerald-700 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
                        >
                          <IndianRupee size={13} />
                          <span>Collect Due ({currency(outstanding)})</span>
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openView(customer)}
                          className="flex-1 inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink)] active:bg-[var(--surface-hover)] transition hover:bg-[var(--surface-elevated)]"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openEdit(customer)}
                          className="flex-1 inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] text-xs font-semibold text-[var(--ink)] active:bg-[var(--surface-hover)] transition hover:bg-[var(--surface-elevated)]"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMobileActionId(current => current === customer.id ? null : customer.id)}
                          className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-secondary)] ${
                            mobileActionId === customer.id ? 'border-[var(--primary)] bg-[var(--surface-hover)] text-[var(--ink)]' : ''
                          }`}
                          title="More customer actions"
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                    </div>

                    {mobileActionId === customer.id && (
                      <div className="grid grid-cols-3 gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface-subtle)] p-2 shadow-xs">
                        {outstanding > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setMobileActionId(null)
                              openReminder(customer)
                            }}
                            className="flex min-h-[36px] items-center justify-center gap-1 rounded-md border border-amber-300 dark:border-amber-800 bg-[var(--surface)] text-xs font-semibold text-amber-700 dark:text-amber-400"
                          >
                            <Send size={12} />
                            <span>Remind</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setMobileActionId(null)
                            sendStatement(customer)
                          }}
                          className="flex min-h-[36px] items-center justify-center gap-1 rounded-md border border-teal-300 dark:border-teal-800 bg-[var(--surface)] text-xs font-semibold text-teal-700 dark:text-teal-400"
                        >
                          <FileText size={12} />
                          <span>Statement</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileActionId(null)
                            setDeleteId(customer.id)
                          }}
                          className="flex min-h-[36px] items-center justify-center gap-1 rounded-md border border-red-300 dark:border-red-800 bg-[var(--surface)] text-xs font-semibold text-red-600 dark:text-red-400"
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </div>
                    )}
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
                  <WalletCards size={18} />
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

                <MessageSquare
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

                <Send
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
                <Phone
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
                  <RefreshCw size={15} className="animate-spin" /> <span>Saving…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} /> <span>{editId ? 'Update Customer' : 'Save Customer'}</span>
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
                <Edit2 size={16} />
              ) : (
                <UserRound size={16} />
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
                    <UserRound size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base text-[var(--ink)] truncate">{viewCustomer.name}</h3>
                    <p className="text-xs text-[var(--muted)] mt-0.5">ID: #{viewCustomer.id}</p>
                    {viewCustomer.gstin && (
                      <div className="mt-1 flex items-center gap-1 text-xs">
                        <Building2 size={11} className="text-[var(--muted)]" />
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
                      <IndianRupee size={13} />
                      <span>Collect {currency(viewCustomer.outstanding_amount)}</span>
                    </button>
                  )}
                  {Number(viewCustomer.outstanding_amount || 0) > 0 && (
                    <button onClick={() => { setReminderCustomer(viewCustomer); sendReminder('whatsapp') }}
                      disabled={sending === 'whatsapp'}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white px-3 py-1.5 text-xs font-bold transition disabled:opacity-50">
                      <MessageCircle size={13} />
                      <span>{sending === 'whatsapp' ? 'Sending…' : 'Remind'}</span>
                    </button>
                  )}
                  <button onClick={() => sendStatement(viewCustomer)} disabled={sending === 'statement'}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] transition">
                    <FileText size={13} />
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
                  <Phone size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-[var(--muted)] uppercase font-semibold">Mobile</p>
                    <p className="text-sm font-medium text-[var(--ink)]">{viewCustomer.mobile}</p>
                  </div>
                </a>
              )}
              {viewCustomer.email && (
                <a href={`mailto:${viewCustomer.email}`}
                  className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 hover:border-blue-300 transition min-w-0">
                  <Mail size={15} className="text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-[var(--muted)] uppercase font-semibold">Email</p>
                    <p className="text-sm font-medium text-[var(--ink)] truncate">{viewCustomer.email}</p>
                  </div>
                </a>
              )}
              {viewCustomer.address && (
                <div className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                  <MapPin size={15} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
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
                  <FileText size={22} className="mx-auto text-[var(--muted)]" />
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
                          <td className="text-xs font-mono">{new Date(bill.created_at).toLocaleDateString('en-IN')}</td>
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

    </div>
  )
}