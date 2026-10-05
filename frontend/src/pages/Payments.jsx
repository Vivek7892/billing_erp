import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api'
import { Badge, Spinner, Modal } from '../components/UI'
import toast from 'react-hot-toast'
import {
  Banknote,
  CreditCard,
  RefreshCw,
  Search,
  Smartphone,
  Wallet,
  X,
  ArrowUpRight,
  Receipt,
  CircleDollarSign,
  SlidersHorizontal,
  Eye,
  UserRound,
  ReceiptText,
  Printer,
  Download,
} from 'lucide-react'

const formatCurrency = value =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`

const formatDate = value => {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const METHOD_META = {
  cash: {
    label: 'Cash',
    description: 'Cash payments',
    icon: Banknote,
    tone: 'success',
    iconClass:
      'bg-[var(--payment-cash-bg)] text-[var(--payment-cash-text)] border-[var(--payment-cash-border)]',
    badgeClass:
      'bg-[var(--payment-cash-bg)] text-[var(--payment-cash-text)] border border-[var(--payment-cash-border)]',
  },
  upi: {
    label: 'UPI',
    description: 'UPI transactions',
    icon: Smartphone,
    tone: 'info',
    iconClass:
      'bg-[var(--payment-upi-bg)] text-[var(--payment-upi-text)] border-[var(--payment-upi-border)]',
    badgeClass:
      'bg-[var(--payment-upi-bg)] text-[var(--payment-upi-text)] border border-[var(--payment-upi-border)]',
  },
  card: {
    label: 'Card',
    description: 'Card payments',
    icon: CreditCard,
    tone: 'slate',
    iconClass:
      'bg-[var(--payment-card-bg)] text-[var(--payment-card-text)] border-[var(--payment-card-border)]',
    badgeClass:
      'bg-[var(--payment-card-bg)] text-[var(--payment-card-text)] border border-[var(--payment-card-border)]',
  },
  credit: {
    label: 'Credit',
    description: 'Credit transactions',
    icon: Wallet,
    tone: 'danger',
    iconClass:
      'bg-[var(--payment-credit-bg)] text-[var(--payment-credit-text)] border-[var(--payment-credit-border)]',
    badgeClass:
      'bg-[var(--payment-credit-bg)] text-[var(--payment-credit-text)] border border-[var(--payment-credit-border)]',
  },
}

const FILTERS = [
  { key: 'all', label: 'All payments' },
  ...Object.entries(METHOD_META).map(([key, value]) => ({
    key,
    label: value.label,
  })),
]

function SummaryCard({
  title,
  value,
  description,
  icon: Icon,
  iconClass,
  active,
  onClick,
  count,
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted-light)] sm:text-[11px]">
            {title}
          </p>

          <p className="mt-2 truncate text-lg font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
            {value}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm ${iconClass}`}
        >
          <Icon size={18} strokeWidth={1.8} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="truncate text-[11px] text-[var(--muted-light)]">
          {description}
        </p>

        {typeof count === 'number' && (
          <span className="shrink-0 rounded-full bg-[var(--surface-elevated)] px-2 py-1 text-[10px] font-semibold text-[var(--muted)]">
            {count}
          </span>
        )}
      </div>
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`group rounded-2xl border bg-[var(--surface)] p-5 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] ${
          active
            ? 'border-[var(--primary-border)] ring-2 ring-[var(--focus-ring)]'
            : 'border-[var(--line)]'
        }`}
      >
        {content}
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 sm:p-5 shadow-[var(--shadow-card)]">
      {content}
    </div>
  )
}

function PaymentBadge({ method }) {
  const meta = METHOD_META[method] || METHOD_META.cash
  const Icon = meta.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${meta.badgeClass}`}
    >
      <Icon size={12} strokeWidth={2} />
      {meta.label}
    </span>
  )
}

function PaymentStatus({ status }) {
  const normalized = String(status || 'pending').toLowerCase()

  const statusMap = {
    paid: {
      label: 'Paid',
      className:
        'border-[var(--payment-cash-border)] bg-[var(--payment-cash-bg)] text-[var(--payment-cash-text)]',
    },
    completed: {
      label: 'Completed',
      className:
        'border-[var(--payment-cash-border)] bg-[var(--payment-cash-bg)] text-[var(--payment-cash-text)]',
    },
    pending: {
      label: 'Pending',
      className:
        'border-[var(--payment-warning-border)] bg-[var(--payment-warning-bg)] text-[var(--payment-warning-text)]',
    },
    failed: {
      label: 'Failed',
      className:
        'border-[var(--payment-credit-border)] bg-[var(--payment-credit-bg)] text-[var(--payment-credit-text)]',
    },
    cancelled: {
      label: 'Cancelled',
      className:
        'border-[var(--payment-credit-border)] bg-[var(--payment-credit-bg)] text-[var(--payment-credit-text)]',
    },
  }

  const current = statusMap[normalized] || {
    label: status || 'Unknown',
    className:
      'border-[var(--line)] bg-[var(--surface-elevated)] text-[var(--muted)]',
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${current.className}`}
    >
      {current.label}
    </span>
  )
}

export default function Payments() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedBill, setSelectedBill] = useState(null)
  const [invoiceAction, setInvoiceAction] = useState(null)

  const handleInvoiceAction = useCallback(async (bill, action) => {
    if (!bill?.id || invoiceAction) return

    setInvoiceAction(`${bill.id}:${action}`)
    try {
      const response = await api.get(`/invoices/${bill.id}/pdf/`, {
        responseType: 'blob',
      })
      const blobUrl = URL.createObjectURL(
        new Blob([response.data], { type: 'application/pdf' }),
      )

      if (action === 'download') {
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = `invoice-${bill.invoice_number || bill.id}.pdf`
        document.body.appendChild(link)
        link.click()
        link.remove()
        toast.success('Invoice downloaded')
      } else {
        const printWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer')
        if (!printWindow) {
          toast.error('Allow pop-ups to print the invoice')
        } else {
          toast.success('Invoice opened for printing')
        }
      }

      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (error) {
      console.error('Failed to generate invoice PDF:', error)
      toast.error(error.response?.data?.detail || 'Could not generate the invoice')
    } finally {
      setInvoiceAction(null)
    }
  }, [invoiceAction])

  const InvoiceActions = ({ bill, compact = false }) => {
    const isBusy = invoiceAction?.startsWith(`${bill.id}:`)
    return (
      <div className={`flex items-center gap-1.5 ${compact ? 'w-full' : ''}`}>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => handleInvoiceAction(bill, 'print')}
          title="Open invoice for printing"
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-2.5 py-2 text-[11px] font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60 ${compact ? 'flex-1' : ''}`}
        >
          <Printer size={13} />
          <span>{isBusy ? 'Preparing...' : 'Invoice'}</span>
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() => handleInvoiceAction(bill, 'download')}
          title="Download invoice PDF"
          className="inline-flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)] disabled:cursor-wait disabled:opacity-60"
        >
          <Download size={13} />
        </button>
      </div>
    )
  }

  const loadPayments = useCallback(async () => {
    setLoading(true)

    try {
      const response = await api.get(
        '/invoices/?page_size=200&ordering=-created_at',
      )

      const data = response.data?.results || response.data || []

      setBills(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load payment transactions:', error)
      setBills([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  const summary = useMemo(
    () =>
      Object.entries(METHOD_META).map(([key, meta]) => {
        const transactions = bills.filter(
          bill => bill.payment_method === key,
        )

        return {
          key,
          ...meta,
          count: transactions.length,
          total: transactions.reduce(
            (sum, bill) =>
              sum +
              Number(
                bill.paid_amount ??
                  (bill.payment_method === 'credit' ? 0 : bill.grand_total) ??
                  0,
              ),
            0,
          ),
        }
      }),
    [bills],
  )

  const totalCollected = useMemo(
    () =>
      bills
        .filter(bill => bill.payment_method !== 'credit')
        .reduce(
          (sum, bill) =>
            sum +
            Number(
              bill.paid_amount ??
                bill.grand_total ??
                0,
            ),
          0,
        ),
    [bills],
  )

  const totalCredit = useMemo(
    () =>
      bills
        .filter(bill => bill.payment_method === 'credit')
        .reduce(
          (sum, bill) => sum + Number(bill.balance_due ?? bill.grand_total ?? 0),
          0,
        ),
    [bills],
  )

  const totalTransactions = bills.length

  const paymentMetrics = useMemo(() => ({
    paid: bills.filter(bill => ['paid', 'completed'].includes(bill.payment_status)).length,
    partial: bills.filter(bill => bill.payment_status === 'partial').length,
    pending: bills.filter(bill => bill.payment_status === 'pending').length,
    refunded: bills.filter(bill => bill.payment_status === 'refunded').length,
    outstanding: bills.reduce((sum, bill) => sum + Number(bill.balance_due || 0), 0),
    discounts: bills.reduce((sum, bill) => sum + Number(bill.discount_amount || 0), 0),
    tax: bills.reduce((sum, bill) => sum + Number(bill.tax_amount || 0), 0),
  }), [bills])

  const normalizedSearch = search.trim().toLowerCase()

  const filteredBills = useMemo(
    () =>
      bills.filter(bill => {
        const matchesFilter =
          filter === 'all' || bill.payment_method === filter

        if (!normalizedSearch) return matchesFilter

        const searchableText = [
          bill.invoice_number,
          bill.customer_name,
          bill.customer_phone,
          bill.customer_email,
          bill.payment_method,
          bill.payment_status,
          bill.created_at,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return matchesFilter && searchableText.includes(normalizedSearch)
      }),
    [bills, filter, normalizedSearch],
  )

  return (
    <div className="payments-page min-w-0 space-y-4 overflow-x-hidden pb-4 sm:space-y-6 sm:pb-6">
      <style>{`
        .payments-page {
          --payment-cash-bg: #ecfdf5;
          --payment-cash-text: #047857;
          --payment-cash-border: #a7f3d0;

          --payment-upi-bg: #eff6ff;
          --payment-upi-text: #1d4ed8;
          --payment-upi-border: #bfdbfe;

          --payment-card-bg: #f5f3ff;
          --payment-card-text: #6d28d9;
          --payment-card-border: #ddd6fe;

          --payment-credit-bg: #fff1f2;
          --payment-credit-text: #be123c;
          --payment-credit-border: #fecdd3;

          --payment-warning-bg: #fffbeb;
          --payment-warning-text: #b45309;
          --payment-warning-border: #fde68a;
        }

        .dark .payments-page,
        [data-theme="dark"] .payments-page {
          --payment-cash-bg: #052e24;
          --payment-cash-text: #6ee7b7;
          --payment-cash-border: #065f46;

          --payment-upi-bg: #172554;
          --payment-upi-text: #93c5fd;
          --payment-upi-border: #1e40af;

          --payment-card-bg: #2e1065;
          --payment-card-text: #c4b5fd;
          --payment-card-border: #5b21b6;

          --payment-credit-bg: #4c0519;
          --payment-credit-text: #fda4af;
          --payment-credit-border: #9f1239;

          --payment-warning-bg: #451a03;
          --payment-warning-text: #fcd34d;
          --payment-warning-border: #92400e;
        }

        .payments-page .section-heading {
          background: var(--surface);
        }
        .payments-page .payment-table tbody tr:hover td {
          background: var(--surface-elevated);
        }
        .payments-page .payment-table td:first-child,
        .payments-page .payment-table th:first-child {
          padding-left: 22px;
        }
        .payments-page .payment-table td:last-child,
        .payments-page .payment-table th:last-child {
          padding-right: 22px;
        }
        .payments-page .metric-accent {
          height: 3px;
          border-radius: 999px;
          background: var(--primary);
          opacity: .75;
        }

        .payments-page button, .payments-page input {\n          -webkit-tap-highlight-color: transparent;\n        }\n        .payments-page .mobile-transaction {\n          min-width: 0;\n        }\n        @media (max-width: 639px) {\n          .payments-page .section-heading {\n            border-radius: 0;\n          }\n          .payments-page .payment-table {\n            min-width: 720px;\n          }\n        }\n\n        .payments-page .payment-table {
          width: 100%;
          border-collapse: collapse;
        }

        .payments-page .payment-table th {
          padding: 13px 18px;
          text-align: left;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: #eff6ff;
          background: linear-gradient(135deg, #1e3a8a, #2563eb);
          border-bottom: 1px solid var(--line);
          white-space: nowrap;
        }

        .payments-page .payment-table td {
          padding: 15px 18px;
          border-bottom: 1px solid var(--line-subtle);
          vertical-align: middle;
        }

        .payments-page .payment-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .payments-page .payment-table tbody tr {
          transition: background .15s ease;
        }

        .payments-page .payment-table tbody tr:hover {
          background: var(--surface-elevated);
        }
      `}</style>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[var(--muted-light)]">
            <Receipt size={16} />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em]">
              Finance / Payments
            </span>
          </div>

          <h1 className="text-lg font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
            Payment Sheet
          </h1>

          <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
            Track collections, credit sales, and payment transactions.
          </p>
        </div>
      </header>

      {/* =====================================================
          ERP SUMMARY (Table-Based)
      ====================================================== */}
      <section className="erp-table-container">
        <div className="border-b border-[var(--line)] bg-[var(--surface-elevated)] px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">
          Payment & Collection Summary
        </div>
        <div className="grid grid-cols-2 divide-y divide-[var(--line)] sm:grid-cols-5 sm:divide-y-0 sm:divide-x">
          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Collected
            </span>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-teal-600 dark:text-teal-400">
              {formatCurrency(totalCollected)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Non-credit receipts</p>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Credit Due
            </span>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-rose-600 dark:text-rose-400">
              {formatCurrency(totalCredit)}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Receivable balances</p>
          </div>

          <div className="p-3 sm:p-3.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
              Transactions
            </span>
            <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-[var(--ink)]">
              {totalTransactions.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-[var(--muted)]">Total recorded bills</p>
          </div>

          {summary.slice(0, 2).map(item => (
            <div
              key={item.key}
              onClick={() => setFilter(c => (c === item.key ? 'all' : item.key))}
              className={`p-3 sm:p-3.5 cursor-pointer transition ${
                filter === item.key ? 'bg-[var(--surface-elevated)] border-l-2 border-[#1E3A5F]' : 'hover:bg-[var(--surface-elevated)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                  {item.label}
                </span>
                {filter === item.key && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1E3A5F] dark:bg-slate-300"></span>
                )}
              </div>
              <p className="mt-1 font-mono text-lg sm:text-xl font-bold text-[#1E3A5F] dark:text-slate-100">
                {formatCurrency(item.total)}
              </p>
              <p className="text-[10px] text-[var(--muted)]">{item.count} bills ({item.label})</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Paid bills', paymentMetrics.paid, 'text-emerald-700 dark:text-emerald-300'],
          ['Partial', paymentMetrics.partial, 'text-amber-700 dark:text-amber-300'],
          ['Pending', paymentMetrics.pending, 'text-orange-700 dark:text-orange-300'],
          ['Refunded', paymentMetrics.refunded, 'text-rose-700 dark:text-rose-300'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p>
            <p className={`mt-1 font-mono text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-xs">
        <div className="section-heading border-b border-[var(--line)] p-3 sm:p-3.5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal
                  size={15}
                  className="text-[var(--muted)]"
                />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                  Payment Transactions
                </h2>
              </div>

              <p className="mt-0.5 text-xs text-[var(--muted-light)]">
                {filteredBills.length} transaction
                {filteredBills.length === 1 ? '' : 's'} displayed
              </p>
            </div>

            <div className="flex w-full min-w-0 gap-2 lg:w-auto">
              <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-light)]"
                />

                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search invoice or customer..."
                  className="h-8 w-full rounded-md border border-[var(--line)] bg-[var(--surface-elevated)] pl-8 pr-8 text-xs text-[var(--ink)] outline-none transition placeholder:text-[var(--muted-light)] focus:border-[var(--primary-border)] focus:ring-1 focus:ring-[var(--primary)]"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-light)] transition hover:text-[var(--ink)]"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={loadPayments}
                disabled={loading}
                aria-label="Refresh payment transactions"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] disabled:opacity-50"
              >
                <RefreshCw
                  size={14}
                  className={loading ? 'animate-spin' : ''}
                />
              </button>
            </div>
          </div>

          <div className="mt-2.5 flex gap-1 overflow-x-auto rounded-md pb-0.5 bg-[var(--surface-elevated)] p-1">
            {FILTERS.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                  filter === item.key
                    ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--ink-secondary)]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : filteredBills.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-elevated)] text-[var(--muted-light)]">
              <Wallet size={25} strokeWidth={1.5} />
            </div>

            <h3 className="mt-4 text-sm font-bold text-[var(--ink)]">
              No payment transactions found
            </h3>

            <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--muted-light)]">
              Try changing the payment method filter or searching with another
              invoice or customer name.
            </p>

            {(search || filter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setFilter('all')
                }}
                className="mt-4 rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--ink-secondary)] transition hover:bg-[var(--surface-elevated)]"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-[var(--line-subtle)] sm:hidden">
              {filteredBills.map(bill => (
                <article key={bill.id} className="p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--muted-light)]">
                        Invoice number
                      </p>
                      <p
                        className="max-w-[calc(100vw-9rem)] break-all font-mono text-sm font-extrabold leading-5 text-[var(--primary)]"
                        title={bill.invoice_number || 'No invoice number'}
                      >
                        {bill.invoice_number || 'No invoice number'}
                      </p>

                      <p className="mt-1 truncate text-sm font-semibold text-[var(--ink)]">
                        {bill.customer_name || 'Walk-in customer'}
                      </p>

                      {bill.customer_phone && (
                        <p className="mt-1 text-[11px] text-[var(--muted-light)]">
                          {bill.customer_phone}
                        </p>
                      )}
                    </div>

                    <p className="shrink-0 text-base font-bold text-[var(--ink)]">
                      {formatCurrency(bill.grand_total)}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
                    <div className="rounded-xl bg-[var(--surface-elevated)] p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)]">
                        Payment method
                      </p>

                      <div className="mt-2">
                        <PaymentBadge method={bill.payment_method} />
                      </div>
                    </div>

                    <div className="rounded-xl bg-[var(--surface-elevated)] p-3">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--muted-light)]">
                        Date
                      </p>

                      <p className="mt-2 text-xs font-semibold text-[var(--ink-secondary)]">
                        {formatDate(bill.created_at || bill.date)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <PaymentStatus status={bill.payment_status} />

                    <button
                      type="button"
                      onClick={() => setSelectedBill(bill)}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-900/70"
                    >
                      <Eye size={12} /> View details
                    </button>
                  </div>
                  <div className="mt-3">
                    <InvoiceActions bill={bill} compact />
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="payment-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th className="num-col">Amount</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBills.map(bill => (
                    <tr key={bill.id}>
                      <td>
                        <span
                          className="inline-flex max-w-44 break-all rounded-md border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-xs font-extrabold leading-4 text-[#1E3A5F] dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-100"
                          title={bill.invoice_number || 'Invoice number unavailable'}
                        >
                          {bill.invoice_number || '—'}
                        </span>
                      </td>

                      <td>
                        <div className="min-w-32">
                          <p className="text-sm font-semibold text-[var(--ink)]">
                            {bill.customer_name || 'Walk-in customer'}
                          </p>

                          {bill.customer_phone && (
                            <p className="mt-1 text-[11px] text-[var(--muted-light)]">
                              {bill.customer_phone}
                            </p>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className="text-xs text-[var(--muted)] font-mono">
                          {formatDate(bill.created_at || bill.date)}
                        </span>
                      </td>

                      <td>
                        <PaymentBadge method={bill.payment_method} />
                      </td>

                      <td className="num-col font-mono text-sm font-bold text-[var(--ink)]">
                        {formatCurrency(bill.grand_total)}
                      </td>

                      <td>
                        <PaymentStatus status={bill.payment_status} />
                      </td>

                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedBill(bill)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-200 dark:hover:bg-blue-900/70"
                          >
                            <Eye size={12} /> Details
                          </button>
                          <InvoiceActions bill={bill} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {selectedBill && (
        <Modal
          open={Boolean(selectedBill)}
          onClose={() => setSelectedBill(null)}
          title={`Payment details — ${selectedBill.invoice_number || 'Invoice'}`}
          size="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] p-3 sm:grid-cols-4">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Invoice number</span>
                <p
                  className="mt-1 break-all font-mono text-sm font-extrabold leading-5 text-[var(--primary)]"
                  title={selectedBill.invoice_number || 'Invoice number unavailable'}
                >
                  {selectedBill.invoice_number || '—'}
                </p>
              </div>
              <div><span className="text-[10px] font-bold uppercase text-[var(--muted)]">Date</span><p className="mt-1 font-semibold text-[var(--ink)]">{formatDate(selectedBill.created_at)}</p></div>
              <div><span className="text-[10px] font-bold uppercase text-[var(--muted)]">Payment status</span><div className="mt-1"><PaymentStatus status={selectedBill.payment_status} /></div></div>
              <div><span className="text-[10px] font-bold uppercase text-[var(--muted)]">Method</span><div className="mt-1"><PaymentBadge method={selectedBill.payment_method} /></div></div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Subtotal', selectedBill.subtotal],
                ['Discount', selectedBill.discount_amount],
                ['Tax', selectedBill.tax_amount],
                ['Grand total', selectedBill.grand_total],
                ['Paid amount', selectedBill.paid_amount],
                ['Balance due', selectedBill.balance_due],
                ['Round off', selectedBill.round_off],
                ['Items', selectedBill.items?.length || 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-[var(--line)] p-2.5">
                  <p className="text-[10px] font-bold uppercase text-[var(--muted)]">{label}</p>
                  <p className="mt-1 font-mono font-bold text-[var(--ink)]">
                    {label === 'Items' ? value : formatCurrency(value)}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] p-3">
                <h3 className="mb-2 flex items-center gap-1.5 font-bold text-[var(--ink)]"><UserRound size={14} /> Customer</h3>
                <p className="font-semibold">{selectedBill.customer_name || 'Walk-in customer'}</p>
                <p className="mt-1 text-[var(--muted)]">{selectedBill.customer_phone || 'No phone number'}</p>
                <p className="mt-1 text-[var(--muted)]">{selectedBill.customer_email || 'No email address'}</p>
              </div>
              <div className="rounded-xl border border-[var(--line)] p-3">
                <h3 className="mb-2 flex items-center gap-1.5 font-bold text-[var(--ink)]"><ReceiptText size={14} /> Notes & operator</h3>
                <p className="text-[var(--muted)]">{selectedBill.notes || 'No notes recorded'}</p>
                <p className="mt-2 text-[11px] text-[var(--muted)]">Created by: <span className="font-semibold text-[var(--ink)]">{selectedBill.created_by_name || 'System'}</span></p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
              <table className="erp-table min-w-[560px] text-xs">
                <thead><tr><th>Item</th><th>SKU</th><th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {(selectedBill.items || []).map((item, index) => (
                    <tr key={item.id || index}>
                      <td className="font-semibold">{item.product_name || item.name || 'Item'}</td>
                      <td className="font-mono text-[var(--muted)]">{item.sku || '—'}</td>
                      <td className="text-right font-mono">{item.quantity || 0}</td>
                      <td className="text-right font-mono">{formatCurrency(item.unit_price)}</td>
                      <td className="text-right font-mono font-bold">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                  {!selectedBill.items?.length && <tr><td colSpan={5} className="py-6 text-center text-[var(--muted)]">No item details available.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-[var(--line)] p-3">
              <h3 className="mb-2 flex items-center gap-1.5 font-bold text-[var(--ink)]"><Banknote size={14} /> Payment entries</h3>
              <div className="space-y-2">
                {(selectedBill.payments || []).map((payment, index) => (
                  <div key={payment.id || index} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-elevated)] p-2.5">
                    <span className="font-semibold">{payment.method || selectedBill.payment_method || 'Payment'}</span>
                    <span className="font-mono font-bold">{formatCurrency(payment.amount)}</span>
                    <span className="text-[var(--muted)]">{formatDate(payment.created_at)}</span>
                    <span className="text-[var(--muted)]">{payment.reference || payment.transaction_id || 'No reference'}</span>
                  </div>
                ))}
                {!selectedBill.payments?.length && <p className="text-[var(--muted)]">No separate payment entries available.</p>}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
