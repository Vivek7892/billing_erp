import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api'
import {
  Card,
  PageHeader,
  Modal,
  ConfirmDialog,
  Spinner,
  EmptyState,
} from '../components/UI'
import toast from 'react-hot-toast'
import CommunicationHistory from '../components/CommunicationHistory'
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
    .split(/\\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('')

const avatarColors = [
  'bg-slate-100 text-[#1E3A5F] border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  'bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/40',
  'bg-slate-200 text-slate-800 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700',
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

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [onlyCredit, setOnlyCredit] = useState(false)
  const [mobileActionId, setMobileActionId] = useState(null)

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
        const params = query.trim()
          ? `?search=${encodeURIComponent(query.trim())}`
          : ''

        const { data } = await api.get(`/customers/${params}`)

        setCustomers(data?.results || data || [])
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
      const { data } = await api.get(
        `/customers/${customer.id}/bills/`
      )

      setCustomerBills(data || [])
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
        await api.patch(`/customers/${editId}/`, payload)
        toast.success('Customer updated successfully')
      } else {
        await api.post('/customers/', payload)
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
      await api.delete(`/customers/${deleteId}/`)

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
      const res = await api.post(
        `/customers/${reminderCustomer.id}/send-reminder/`,
        { channel }
      )

      if (res.data?.whatsapp_url && channel === 'whatsapp') {
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
      const res = await api.post(
        `/customers/${customer.id}/send-statement/`,
        { channel }
      )

      if (res.data?.whatsapp_url && channel === 'whatsapp') {
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
        title="Customers"
        subtitle={`${customers.length} registered customer${
          customers.length === 1 ? '' : 's'
        }`}
        action={
          <button
            onClick={openAdd}
            className="btn-primary btn-base w-full sm:w-auto"
          >
            <Plus size={16} />
            <span>Add Customer</span>
          </button>
        }
      />

      {/* =====================================================
          ERP SUMMARY (Table-Based)
      ====================================================== */}

      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
          Customer Ledger Summary
        </div>
        <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Total Customers
            </span>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-[var(--ink)]">
              {stats.total}
            </p>
            <p className="text-[10px] text-[var(--muted)]">{stats.customersWithDue} with pending credit</p>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Total Outstanding
            </span>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-red-600">
              {currency(stats.totalOutstanding)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Pending receivable balance</p>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Total Credit Limit
            </span>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-blue-600">
              {currency(stats.totalCreditLimit)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Combined authorized limit</p>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Linked Bills
            </span>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-green-600">
              {stats.totalBills}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Completed customer sales</p>
          </div>
        </div>
      </section>

      {/* =====================================================
          FILTERS
      ====================================================== */}

      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 sm:p-3.5">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">

          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              className="input w-full pl-9 pr-9 text-sm"
              placeholder="Search name, mobile, or email..."
              value={search}
              onChange={event => setSearch(event.target.value)}
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Credit filter */}
          <label className="form-check w-full shrink-0 cursor-pointer whitespace-nowrap sm:w-auto">
            <input
              type="checkbox"
              checked={onlyCredit}
              onChange={event => setOnlyCredit(event.target.checked)}
              className="form-check-input"
            />
            <span className="form-check-label text-xs sm:text-sm">
              <span className="hidden sm:inline">Credit Due Only</span>
              <span className="sm:hidden">Credit Due only </span>
            </span>
          </label>
        </div>

        {(hasSearch || onlyCredit) && (
          <div className="flex items-center gap-2 mt-3 text-xs text-[var(--muted)]">
            <span>
              Showing {displayed.length} result(s)
            </span>

            {onlyCredit && (
              <span className="px-2 py-0.5 rounded-full bg-rose-950/40 text-rose-300 border border-rose-800/40 font-medium">
                Credit due
              </span>
            )}
          </div>
        )}
      </div>

      {/* =====================================================
          CUSTOMER LIST
      ====================================================== */}

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">

        {loading ? (
          <div className="py-14">
            <Spinner />
          </div>
        ) : displayed.length === 0 ? (

          <div className="py-10">

            <EmptyState
              message={
                hasSearch || onlyCredit
                  ? 'No customers match your filters'
                  : 'No customers found'
              }
            />

            {(hasSearch || onlyCredit) && (
              <div className="flex justify-center mt-4">

                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setOnlyCredit(false)
                  }}
                  className="btn-secondary text-sm"
                >
                  Clear Filters
                </button>

              </div>
            )}
          </div>

        ) : (
          <>
            {/* =================================================
                DESKTOP TABLE
            ================================================== */}

            <div className="hidden lg:block overflow-x-auto">

              <table className="table">

                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>GSTIN</th>
                    <th className="num-col">Credit Limit</th>
                    <th className="num-col">Outstanding</th>
                    <th className="text-center">Bills</th>
                    <th className="text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {displayed.map(customer => {

                    const outstanding = Number(
                      customer.outstanding_amount || 0
                    )

                    const creditLimit = Number(
                      customer.credit_limit || 0
                    )

                    return (
                      <tr key={customer.id}>

                        {/* Customer */}

                        <td>

                          <div className="flex items-center gap-3 min-w-[190px]">

                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-[var(--line)] flex items-center justify-center shrink-0 text-[#1E3A5F] dark:text-slate-300">
                              <UserRound size={15} />
                            </div>

                            <div className="min-w-0">

                              <p className="font-semibold text-[var(--ink)] truncate">
                                {customer.name}
                              </p>

                              {customer.address && (
                                <p className="text-xs text-slate-500 truncate max-w-[180px]">
                                  {customer.address}
                                </p>
                              )}

                            </div>
                          </div>

                        </td>

                        {/* Contact */}

                        <td>

                          <div className="space-y-1 text-sm">

                            {customer.mobile ? (
                              <a
                                href={`tel:${customer.mobile}`}
                                className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                <Phone size={12} />
                                {customer.mobile}
                              </a>
                            ) : null}

                            {customer.email ? (
                              <a
                                href={`mailto:${customer.email}`}
                                className="flex items-center gap-1.5 text-slate-600 hover:text-blue-600 dark:text-blue-400 truncate max-w-[200px]"
                              >
                                <Mail size={12} />
                                {customer.email}
                              </a>
                            ) : null}

                            {!customer.mobile &&
                              !customer.email && (
                                <span className="text-slate-500">
                                  —
                                </span>
                              )}

                          </div>

                        </td>

                        {/* GSTIN */}

                        <td className="text-sm">

                          {customer.gstin ? (
                            <span className="font-mono text-slate-600">
                              {customer.gstin}
                            </span>
                          ) : (
                            '—'
                          )}

                        </td>

                        {/* Credit */}

                        <td className="num-col font-mono text-xs text-[var(--ink-secondary)]">
                          {currency(creditLimit)}
                        </td>

                        {/* Outstanding */}

                        <td className="num-col font-mono">
                          <span
                            className={`text-xs font-bold ${
                              outstanding > 0 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {currency(outstanding)}
                          </span>
                        </td>

                        {/* Bills */}

                        <td className="text-center font-mono text-xs font-semibold text-[var(--ink-secondary)]">
                          {customer.total_bills ?? 0}
                        </td>

                        {/* Actions */}

                        <td>

                          <div className="flex justify-end gap-1">

                            <button
                              onClick={() =>
                                openView(customer)
                              }
                              className="icon-btn"
                              title="View customer"
                            >
                              <Eye size={14} />
                            </button>

                            <button
                              onClick={() =>
                                openEdit(customer)
                              }
                              className="icon-btn"
                              title="Edit customer"
                            >
                              <Edit2 size={14} />
                            </button>

                            {outstanding > 0 && (
                              <button
                                onClick={() =>
                                  openReminder(customer)
                                }
                                className="icon-btn text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60"
                                title="Send Payment Reminder"
                              >
                                <Send size={14} />
                              </button>
                            )}

                            <button
                              onClick={() => sendStatement(customer)}
                              className="icon-btn text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/60"
                              title="Send Customer Statement"
                            >
                              <FileText size={14} />
                            </button>

                            <button
                              onClick={() =>
                                setDeleteId(customer.id)
                              }
                              className="icon-btn text-red-500"
                              title="Delete customer"
                            >
                              <Trash2 size={14} />
                            </button>

                          </div>

                        </td>

                      </tr>
                    )
                  })}

                </tbody>

              </table>

            </div>

            {/* =================================================
                MOBILE COMPACT LIST

                IMPORTANT:
                No large cards.
                Each customer is a compact single row.
            ================================================== */}

            <div className="lg:hidden divide-y divide-blue-100">

              {displayed.map(customer => {

                const outstanding = Number(
                  customer.outstanding_amount || 0
                )

                return (
                  <div
                    key={customer.id}
                    className="px-3 py-3 sm:px-4 sm:py-3.5"
                  >

                    <div className="flex min-w-0 items-start gap-2.5">

                      {/* Avatar */}

                      <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-[var(--line)] flex items-center justify-center shrink-0 text-[#1E3A5F] dark:text-slate-300">
                        <UserRound size={13} />
                      </div>

                      {/* Customer */}

                      <div className="min-w-0 flex-1">

                        <div className="flex min-w-0 items-start gap-2">

                          <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--ink)]">
                            {customer.name}
                          </p>

                          {outstanding > 0 ? (
                            <span className="shrink-0 text-[10px] text-red-700 dark:text-red-400 font-semibold">
                              Due
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] text-teal-700 dark:text-teal-400 font-semibold">
                              Paid
                            </span>
                          )}

                        </div>

                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-[var(--muted)]">

                          {customer.mobile ? (
                            <a
                              href={`tel:${customer.mobile}`}
                              className="text-blue-600 dark:text-blue-400 truncate"
                            >
                              {customer.mobile}
                            </a>
                          ) : (
                            <span>No mobile</span>
                          )}

                          <span>•</span>

                          <span className="shrink-0">
                            {customer.total_bills ?? 0} bills
                          </span>

                        </div>

                        <div className="mt-2 grid grid-cols-2 gap-1.5 text-[10px]">
                          <div className="min-w-0 rounded-lg bg-[var(--surface-elevated)] px-2 py-1.5">
                            <span className="block uppercase tracking-wide text-[var(--muted-light)]">Credit limit</span>
                            <span className="font-mono font-semibold text-[var(--ink-secondary)]">
                              {currency(customer.credit_limit || 0)}
                            </span>
                          </div>
                          <div className="min-w-0 rounded-lg bg-[var(--surface-elevated)] px-2 py-1.5">
                            <span className="block uppercase tracking-wide text-[var(--muted-light)]">GSTIN</span>
                            <span className="block truncate font-mono font-semibold text-[var(--ink-secondary)]">
                              {customer.gstin || 'Not added'}
                            </span>
                          </div>
                        </div>

                      </div>

                      {/* Amount */}

                      <div className="mr-0.5 shrink-0 text-right">

                        <p
                          className={`text-[11px] font-semibold ${
                            outstanding > 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}
                        >
                          {outstanding > 0
                            ? currency(outstanding)
                            : '₹0'}
                        </p>

                        <p className="text-[9px] text-slate-500">
                          {outstanding > 0
                            ? 'outstanding'
                            : 'clear'}
                        </p>

                      </div>

                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex items-center gap-1.5 border-t border-[var(--line-subtle)] pt-2.5 sm:justify-end">

                        <button
                          onClick={() =>
                            openView(customer)
                          }
                          className="icon-btn flex !h-9 flex-1 !p-0 sm:!w-9 sm:flex-none"
                          title="View customer"
                          aria-label="View customer"
                        >
                          <Eye size={13} /><span className="ml-1 text-[10px] sm:hidden">View</span>
                        </button>

                        <button
                          onClick={() =>
                            openEdit(customer)
                          }
                          className="icon-btn flex !h-9 flex-1 !p-0 sm:!w-9 sm:flex-none"
                          title="Edit customer"
                          aria-label="Edit customer"
                        >
                          <Edit2 size={13} /><span className="ml-1 text-[10px] sm:hidden">Edit</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMobileActionId(current => current === customer.id ? null : customer.id)}
                          className={`icon-btn flex !h-9 flex-1 !p-0 sm:!w-9 sm:flex-none ${
                            mobileActionId === customer.id ? 'bg-[var(--surface-active)] text-[var(--ink)]' : ''
                          }`}
                          title="More customer actions"
                          aria-label="More customer actions"
                        >
                          <MoreHorizontal size={15} /><span className="ml-1 text-[10px] sm:hidden">More</span>
                        </button>

                    </div>

                    {mobileActionId === customer.id && (
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5 rounded-lg bg-[var(--surface-elevated)] p-1.5 sm:hidden">
                        {outstanding > 0 && (
                          <button
                            onClick={() => {
                              setMobileActionId(null)
                              openReminder(customer)
                            }}
                            className="flex h-9 items-center justify-center gap-1 rounded-md px-2 text-[10px] font-semibold text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950/50"
                          >
                            <Send size={13} /> Remind
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setMobileActionId(null)
                            sendStatement(customer)
                          }}
                          className="flex h-9 items-center justify-center gap-1 rounded-md px-2 text-[10px] font-semibold text-teal-700 hover:bg-teal-100 dark:text-teal-300 dark:hover:bg-teal-950/50"
                        >
                          <FileText size={13} /> Statement
                        </button>
                        <button
                          onClick={() => {
                            setMobileActionId(null)
                            setDeleteId(customer.id)
                          }}
                          className="flex h-9 items-center justify-center gap-1 rounded-md px-2 text-[10px] font-semibold text-red-600 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-950/50"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}

                  </div>
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
        onClose={() =>
          !saving && setModal(null)
        }
        title={
          editId ? 'Edit Customer' : 'Add Customer'
        }
        size="md"
      >

        <div className="space-y-5">

          <div className="flex items-center gap-3 rounded-md bg-[var(--surface-elevated)] border border-[var(--line)] p-3.5">

            <div className="w-9 h-9 rounded-md bg-[var(--surface)] border border-[var(--line)] text-[#1E3A5F] dark:text-slate-300 flex items-center justify-center">

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

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">

            <button
              onClick={() => setModal(null)}
              disabled={saving}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>

            <button
              onClick={save}
              disabled={saving}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >

              {saving ? (
                <>
                  <RefreshCw
                    size={15}
                    className="animate-spin"
                  />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />

                  {editId
                    ? 'Update Customer'
                    : 'Save Customer'}
                </>
              )}

            </button>

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
          <div className="space-y-5">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-4">

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-[#1E3A5F] dark:text-slate-300 border border-[var(--line)] flex items-center justify-center">
                  <UserRound size={18} />
                </div>

                <div>

                  <h3 className="font-bold text-[var(--ink)]">
                    {viewCustomer.name}
                  </h3>

                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    Customer ID: #{viewCustomer.id}
                  </p>

                </div>

              </div>

              <div className="flex flex-wrap items-center gap-2">
                {viewCustomer.gstin && (
                  <div className="flex items-center gap-1.5 text-xs mr-2">
                    <Building2
                      size={14}
                      className="text-[var(--muted)]"
                    />
                    <span className="font-mono text-[var(--muted)]">
                      {viewCustomer.gstin}
                    </span>
                  </div>
                )}

                {Number(viewCustomer.outstanding_amount || 0) > 0 && (
                  <button
                    onClick={() => {
                      setReminderCustomer(viewCustomer)
                      sendReminder('whatsapp')
                    }}
                    disabled={sending === 'whatsapp'}
                    className="btn-secondary text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/50 px-3 py-1.5 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/40 transition inline-flex items-center gap-1.5 rounded-md"
                  >
                    <Send size={13} />
                    <span>Send Reminder</span>
                  </button>
                )}

                <button
                  onClick={() => sendStatement(viewCustomer)}
                  disabled={sending === 'statement'}
                  className="btn-secondary px-3 py-1.5 text-xs font-semibold transition inline-flex items-center gap-1.5 rounded-md"
                >
                  <FileText size={13} />
                  <span>Send Statement</span>
                </button>
              </div>

            </div>

            {/* Statistics */}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              <div className="bg-[var(--surface-elevated)] border border-[var(--line)] rounded-md p-4">

                <div className="text-xs text-[var(--muted)]">
                  Total Bills
                </div>

                <div className="text-xl font-bold font-mono text-[#1E3A5F] dark:text-slate-200 mt-1">
                  {viewCustomer.total_bills ?? 0}
                </div>

              </div>

              <div className="bg-[var(--surface-elevated)] border border-[var(--line)] rounded-xl p-4">

                <div className="text-xs text-[var(--muted)]">
                  Total Purchases
                </div>

                <div className="text-xl font-bold text-emerald-400 mt-1">
                  {currency(
                    viewCustomer.total_purchases
                  )}
                </div>

              </div>

              <div className="bg-[var(--surface-elevated)] border border-[var(--line)] rounded-xl p-4">

                <div className="text-xs text-[var(--muted)]">
                  Outstanding
                </div>

                <div className="text-xl font-bold text-rose-400 mt-1">
                  {currency(
                    viewCustomer.outstanding_amount
                  )}
                </div>

              </div>

            </div>

            {/* Contact */}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

              {viewCustomer.mobile && (
                <a
                  href={`tel:${viewCustomer.mobile}`}
                  className="flex items-center gap-3 rounded-xl border border-blue-100 p-3 hover:bg-white"
                >

                  <Phone
                    size={16}
                    className="text-blue-600 dark:text-blue-400"
                  />

                  <div>

                    <p className="text-[11px] text-slate-500 uppercase">
                      Mobile
                    </p>

                    <p className="text-sm font-medium text-slate-700">
                      {viewCustomer.mobile}
                    </p>

                  </div>

                </a>
              )}

              {viewCustomer.email && (
                <a
                  href={`mailto:${viewCustomer.email}`}
                  className="flex items-center gap-3 rounded-xl border border-blue-100 p-3 hover:bg-white min-w-0"
                >

                  <Mail
                    size={16}
                    className="text-blue-600 dark:text-blue-400 shrink-0"
                  />

                  <div className="min-w-0">

                    <p className="text-[11px] text-slate-500 uppercase">
                      Email
                    </p>

                    <p className="text-sm font-medium text-slate-700 truncate">
                      {viewCustomer.email}
                    </p>

                  </div>

                </a>
              )}

              {viewCustomer.address && (
                <div className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-blue-100 p-3">

                  <MapPin
                    size={16}
                    className="text-blue-600 dark:text-blue-400 mt-0.5"
                  />

                  <div>

                    <p className="text-[11px] text-slate-500 uppercase">
                      Address
                    </p>

                    <p className="text-sm font-medium text-slate-700 mt-0.5">
                      {viewCustomer.address}
                    </p>

                  </div>

                </div>
              )}

            </div>

            {/* Bills */}

            <div>

              <div className="flex items-center justify-between gap-3 mb-3">

                <div>

                  <h4 className="font-semibold text-slate-900">
                    Recent Bills
                  </h4>

                  <p className="text-xs text-slate-500 mt-0.5">
                    Billing history for this customer
                  </p>

                </div>

                <span className="text-xs font-medium text-slate-600">
                  {customerBills.length} record(s)
                </span>

              </div>

              {billsLoading ? (
                <div className="py-8">
                  <Spinner />
                </div>
              ) : customerBills.length === 0 ? (

                <div className="rounded-xl border border-dashed border-blue-100 py-8 text-center">

                  <FileText
                    size={24}
                    className="mx-auto text-gray-300"
                  />

                  <p className="text-sm text-slate-500 mt-2">
                    No bills yet
                  </p>

                </div>

              ) : (

                <div className="overflow-x-auto border border-blue-100 rounded-xl">

                  <table className="table">

                    <thead>

                      <tr>
                        <th>Invoice</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Status</th>
                      </tr>

                    </thead>

                    <tbody>

                      {customerBills.map(bill => (

                        <tr key={bill.id}>

                          <td className="font-mono text-blue-600 dark:text-blue-400 text-sm">
                            {bill.invoice_number}
                          </td>

                          <td className="text-sm">
                            {new Date(
                              bill.created_at
                            ).toLocaleDateString('en-IN')}
                          </td>

                          <td className="font-semibold text-sm">
                            {currency(
                              bill.grand_total
                            )}
                          </td>

                          <td>

                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                String(
                                  bill.payment_status
                                ).toLowerCase() ===
                                'paid'
                                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-800/40'
                                  : 'bg-amber-950/40 text-amber-300 border border-amber-800/40'
                              }`}
                            >
                              {bill.payment_status ||
                                'Unknown'}
                            </span>

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
              <CommunicationHistory
                referenceType="customer"
                referenceId={viewCustomer.id}
                key={commsKey}
              />
            </div>

          </div>
        )}

      </Modal>

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