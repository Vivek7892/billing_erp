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

  const sendReminder = async channel => {
    if (!reminderCustomer) return

    setSending(channel)

    try {
      await api.post(
        `/customers/${reminderCustomer.id}/send-reminder/`,
        { channel }
      )

      toast.success(
        `${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} reminder sent to ${
          reminderCustomer.name
        }`
      )

      setModal(null)
    } catch (error) {
      toast.error(
        error?.response?.data?.error ||
          'Failed to send payment reminder'
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
            className="btn-primary flex items-center justify-center gap-2 text-xs sm:text-sm px-3 sm:px-4"
          >
            <Plus size={16} />
            <span>Add Customer</span>
          </button>
        }
      />

      {/* =====================================================
          SUMMARY
      ====================================================== */}

      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-4">

        {/* Total Customers */}

        <Card className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
                Total Customers
              </p>

              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 sm:mt-2">
                {stats.total}
              </p>
            </div>

            <div className="p-2 rounded-lg sm:rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <Users size={17} />
            </div>
          </div>

          <p className="text-[10px] sm:text-xs text-gray-500 mt-2 sm:mt-3 truncate">
            {stats.customersWithDue} with pending credit
          </p>
        </Card>

        {/* Outstanding */}

        <Card className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
                Outstanding
              </p>

              <p className="text-lg sm:text-2xl font-bold text-red-600 mt-1 sm:mt-2 truncate">
                {currency(stats.totalOutstanding)}
              </p>
            </div>

            <div className="p-2 rounded-lg sm:rounded-xl bg-red-50 text-red-600 shrink-0">
              <IndianRupee size={17} />
            </div>
          </div>

          <p className="text-[10px] sm:text-xs text-gray-500 mt-2 sm:mt-3 truncate">
            Amount pending
          </p>
        </Card>

        {/* Credit Limit */}

        <Card className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
                Credit Limit
              </p>

              <p className="text-lg sm:text-2xl font-bold text-amber-600 mt-1 sm:mt-2 truncate">
                {currency(stats.totalCreditLimit)}
              </p>
            </div>

            <div className="p-2 rounded-lg sm:rounded-xl bg-amber-50 text-amber-600 shrink-0">
              <WalletCards size={17} />
            </div>
          </div>

          <p className="text-[10px] sm:text-xs text-gray-500 mt-2 sm:mt-3 truncate">
            Combined limit
          </p>
        </Card>

        {/* Total Bills */}

        <Card className="p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wide truncate">
                Total Bills
              </p>

              <p className="text-xl sm:text-2xl font-bold text-green-600 mt-1 sm:mt-2">
                {stats.totalBills}
              </p>
            </div>

            <div className="p-2 rounded-lg sm:rounded-xl bg-green-50 text-green-600 shrink-0">
              <FileText size={17} />
            </div>
          </div>

          <p className="text-[10px] sm:text-xs text-gray-500 mt-2 sm:mt-3 truncate">
            Linked bills
          </p>
        </Card>
      </div>

      {/* =====================================================
          FILTERS
      ====================================================== */}

      <Card className="p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 sm:gap-3">

          <div className="relative flex-1">

            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              className="input pl-9 pr-9 text-sm"
              placeholder="Search by customer name, mobile, email..."
              value={search}
              onChange={event =>
                setSearch(event.target.value)
              }
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                title="Clear search"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">

            <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-600 cursor-pointer whitespace-nowrap">

              <input
                type="checkbox"
                checked={onlyCredit}
                onChange={event =>
                  setOnlyCredit(event.target.checked)
                }
                className="accent-red-500"
              />

              Credit Due Only
            </label>

            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="icon-btn"
              title="Refresh customers"
            >
              <RefreshCw
                size={15}
                className={
                  loading ? 'animate-spin' : ''
                }
              />
            </button>
          </div>
        </div>

        {(hasSearch || onlyCredit) && (
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">

            <span>
              Showing {displayed.length} result(s)
            </span>

            {onlyCredit && (
              <span className="px-2 py-1 rounded-full bg-red-50 text-red-600 font-medium">
                Credit due
              </span>
            )}
          </div>
        )}
      </Card>

      {/* =====================================================
          CUSTOMER LIST
      ====================================================== */}

      <Card className="overflow-hidden">

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
                    <th>Credit Limit</th>
                    <th>Outstanding</th>
                    <th>Bills</th>
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

                            <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                              <UserRound size={16} />
                            </div>

                            <div className="min-w-0">

                              <p className="font-semibold text-gray-800 truncate">
                                {customer.name}
                              </p>

                              {customer.address && (
                                <p className="text-xs text-gray-400 truncate max-w-[180px]">
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
                                className="flex items-center gap-1.5 text-blue-600 hover:underline"
                              >
                                <Phone size={12} />
                                {customer.mobile}
                              </a>
                            ) : null}

                            {customer.email ? (
                              <a
                                href={`mailto:${customer.email}`}
                                className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 truncate max-w-[200px]"
                              >
                                <Mail size={12} />
                                {customer.email}
                              </a>
                            ) : null}

                            {!customer.mobile &&
                              !customer.email && (
                                <span className="text-gray-400">
                                  —
                                </span>
                              )}

                          </div>

                        </td>

                        {/* GSTIN */}

                        <td className="text-sm">

                          {customer.gstin ? (
                            <span className="font-mono text-gray-600">
                              {customer.gstin}
                            </span>
                          ) : (
                            '—'
                          )}

                        </td>

                        {/* Credit */}

                        <td className="text-sm">
                          {currency(creditLimit)}
                        </td>

                        {/* Outstanding */}

                        <td>

                          <div className="flex items-center gap-2">

                            {outstanding > 0 ? (
                              <>
                                <AlertCircle
                                  size={14}
                                  className="text-red-500"
                                />

                                <span className="font-semibold text-red-600 text-sm">
                                  {currency(outstanding)}
                                </span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2
                                  size={14}
                                  className="text-green-500"
                                />

                                <span className="text-sm text-green-600 font-medium">
                                  Paid
                                </span>
                              </>
                            )}

                          </div>

                        </td>

                        {/* Bills */}

                        <td className="text-sm font-medium">
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
                                className="icon-btn text-orange-500"
                                title="Send payment reminder"
                              >
                                <MessageSquare
                                  size={14}
                                />
                              </button>
                            )}

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

            <div className="lg:hidden divide-y divide-gray-100">

              {displayed.map(customer => {

                const outstanding = Number(
                  customer.outstanding_amount || 0
                )

                return (
                  <div
                    key={customer.id}
                    className="px-2.5 py-2.5 sm:px-4 sm:py-3"
                  >

                    <div className="flex items-center gap-2.5 min-w-0">

                      {/* Avatar */}

                      <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <UserRound size={14} />
                      </div>

                      {/* Customer */}

                      <div className="flex-1 min-w-0">

                        <div className="flex items-center gap-2 min-w-0">

                          <p className="font-semibold text-[13px] text-gray-800 truncate">
                            {customer.name}
                          </p>

                          {outstanding > 0 ? (
                            <span className="shrink-0 text-[9px] leading-4 px-1.5 rounded-full bg-red-50 text-red-600 font-semibold">
                              Due
                            </span>
                          ) : (
                            <span className="shrink-0 text-[9px] leading-4 px-1.5 rounded-full bg-green-50 text-green-600 font-semibold">
                              Paid
                            </span>
                          )}

                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-400 min-w-0">

                          {customer.mobile ? (
                            <a
                              href={`tel:${customer.mobile}`}
                              className="text-blue-600 truncate"
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

                      </div>

                      {/* Amount */}

                      <div className="text-right shrink-0 mr-0.5">

                        <p
                          className={`text-[11px] font-semibold ${
                            outstanding > 0
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}
                        >
                          {outstanding > 0
                            ? currency(outstanding)
                            : '₹0'}
                        </p>

                        <p className="text-[9px] text-gray-400">
                          {outstanding > 0
                            ? 'outstanding'
                            : 'clear'}
                        </p>

                      </div>

                      {/* Actions */}

                      <div className="flex items-center gap-0.5 shrink-0">

                        <button
                          onClick={() =>
                            openView(customer)
                          }
                          className="icon-btn !w-7 !h-7 !p-0"
                          title="View customer"
                          aria-label="View customer"
                        >
                          <Eye size={13} />
                        </button>

                        <button
                          onClick={() =>
                            openEdit(customer)
                          }
                          className="icon-btn !w-7 !h-7 !p-0"
                          title="Edit customer"
                          aria-label="Edit customer"
                        >
                          <Edit2 size={13} />
                        </button>

                        {outstanding > 0 && (
                          <button
                            onClick={() =>
                              openReminder(customer)
                            }
                            className="icon-btn !w-7 !h-7 !p-0 text-orange-500"
                            title="Send payment reminder"
                            aria-label="Send payment reminder"
                          >
                            <MessageSquare size={13} />
                          </button>
                        )}

                        <button
                          onClick={() =>
                            setDeleteId(customer.id)
                          }
                          className="icon-btn !w-7 !h-7 !p-0 text-red-500"
                          title="Delete customer"
                          aria-label="Delete customer"
                        >
                          <Trash2 size={13} />
                        </button>

                      </div>

                    </div>

                  </div>
                )
              })}

            </div>
          </>
        )}

      </Card>

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

            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">

              <div className="flex items-center gap-3">

                <div className="w-10 h-10 rounded-full bg-white text-orange-600 flex items-center justify-center">
                  <WalletCards size={18} />
                </div>

                <div>

                  <p className="text-sm font-semibold text-orange-900">
                    {reminderCustomer.name}
                  </p>

                  <p className="text-xs text-orange-700 mt-1">
                    Outstanding:{' '}
                    <span className="font-bold">
                      {currency(
                        reminderCustomer.outstanding_amount
                      )}
                    </span>
                  </p>

                </div>

              </div>

              {reminderCustomer.mobile && (
                <p className="text-xs text-gray-500 mt-3">
                  Mobile: {reminderCustomer.mobile}
                </p>
              )}

            </div>

            <p className="text-sm text-gray-500">
              Choose how you want to send the payment
              reminder.
            </p>

            <div className="grid grid-cols-2 gap-3">

              <button
                onClick={() => sendReminder('sms')}
                disabled={!!sending}
                className="flex flex-col items-center gap-2 border-2 border-blue-200 rounded-xl p-4 hover:bg-blue-50 transition disabled:opacity-50"
              >

                <MessageSquare
                  size={22}
                  className="text-blue-600"
                />

                <span className="text-sm font-semibold text-blue-700">
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
                className="flex flex-col items-center gap-2 border-2 border-green-200 rounded-xl p-4 hover:bg-green-50 transition disabled:opacity-50"
              >

                <Send
                  size={22}
                  className="text-green-600"
                />

                <span className="text-sm font-semibold text-green-700">
                  {sending === 'whatsapp'
                    ? 'Sending…'
                    : 'WhatsApp'}
                </span>

              </button>

            </div>

            {reminderCustomer.mobile && (
              <a
                href={`tel:${reminderCustomer.mobile}`}
                className="flex items-center justify-center gap-2 w-full border-2 border-gray-200 rounded-xl p-3 hover:bg-gray-50 transition text-sm font-semibold text-gray-700"
              >
                <Phone
                  size={16}
                  className="text-gray-500"
                />

                Call {reminderCustomer.mobile}
              </a>
            )}

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

          <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 p-4">

            <div className="w-10 h-10 rounded-lg bg-white text-blue-600 flex items-center justify-center">

              {editId ? (
                <Edit2 size={18} />
              ) : (
                <UserRound size={18} />
              )}

            </div>

            <div>

              <p className="font-semibold text-blue-900">
                {editId
                  ? 'Update customer details'
                  : 'Create a new customer'}
              </p>

              <p className="text-xs text-blue-700 mt-0.5">
                Keep contact and credit information
                accurate.
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

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">

              <div className="flex items-center gap-3">

                <div className="w-11 h-11 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <UserRound size={19} />
                </div>

                <div>

                  <h3 className="font-bold text-gray-800">
                    {viewCustomer.name}
                  </h3>

                  <p className="text-xs text-gray-500 mt-0.5">
                    Customer ID: #{viewCustomer.id}
                  </p>

                </div>

              </div>

              {viewCustomer.gstin && (
                <div className="flex items-center gap-2 text-xs">

                  <Building2
                    size={14}
                    className="text-gray-400"
                  />

                  <span className="font-mono text-gray-600">
                    {viewCustomer.gstin}
                  </span>

                </div>
              )}

            </div>

            {/* Statistics */}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

              <div className="bg-blue-50 rounded-xl p-4">

                <div className="text-xs text-gray-500">
                  Total Bills
                </div>

                <div className="text-xl font-bold text-blue-600 mt-1">
                  {viewCustomer.total_bills ?? 0}
                </div>

              </div>

              <div className="bg-green-50 rounded-xl p-4">

                <div className="text-xs text-gray-500">
                  Total Purchases
                </div>

                <div className="text-xl font-bold text-green-600 mt-1">
                  {currency(
                    viewCustomer.total_purchases
                  )}
                </div>

              </div>

              <div className="bg-red-50 rounded-xl p-4">

                <div className="text-xs text-gray-500">
                  Outstanding
                </div>

                <div className="text-xl font-bold text-red-600 mt-1">
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
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 hover:bg-gray-50"
                >

                  <Phone
                    size={16}
                    className="text-blue-600"
                  />

                  <div>

                    <p className="text-[11px] text-gray-400 uppercase">
                      Mobile
                    </p>

                    <p className="text-sm font-medium text-gray-700">
                      {viewCustomer.mobile}
                    </p>

                  </div>

                </a>
              )}

              {viewCustomer.email && (
                <a
                  href={`mailto:${viewCustomer.email}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 hover:bg-gray-50 min-w-0"
                >

                  <Mail
                    size={16}
                    className="text-blue-600 shrink-0"
                  />

                  <div className="min-w-0">

                    <p className="text-[11px] text-gray-400 uppercase">
                      Email
                    </p>

                    <p className="text-sm font-medium text-gray-700 truncate">
                      {viewCustomer.email}
                    </p>

                  </div>

                </a>
              )}

              {viewCustomer.address && (
                <div className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-gray-200 p-3">

                  <MapPin
                    size={16}
                    className="text-blue-600 mt-0.5"
                  />

                  <div>

                    <p className="text-[11px] text-gray-400 uppercase">
                      Address
                    </p>

                    <p className="text-sm font-medium text-gray-700 mt-0.5">
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

                  <h4 className="font-semibold text-gray-800">
                    Recent Bills
                  </h4>

                  <p className="text-xs text-gray-400 mt-0.5">
                    Billing history for this customer
                  </p>

                </div>

                <span className="text-xs font-medium text-gray-500">
                  {customerBills.length} record(s)
                </span>

              </div>

              {billsLoading ? (
                <div className="py-8">
                  <Spinner />
                </div>
              ) : customerBills.length === 0 ? (

                <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center">

                  <FileText
                    size={24}
                    className="mx-auto text-gray-300"
                  />

                  <p className="text-sm text-gray-400 mt-2">
                    No bills yet
                  </p>

                </div>

              ) : (

                <div className="overflow-x-auto border border-gray-100 rounded-xl">

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

                          <td className="font-mono text-blue-600 text-sm">
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
                                  ? 'bg-green-50 text-green-600'
                                  : 'bg-orange-50 text-orange-600'
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