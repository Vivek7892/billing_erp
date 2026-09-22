import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api'
import { Badge, Spinner } from '../components/UI'
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
    tone: 'violet',
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

          <p className="mt-2 truncate text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
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
        className={`group rounded-2xl border bg-[var(--surface)] p-4 text-left shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] ${
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
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
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
            (sum, bill) => sum + Number(bill.grand_total || 0),
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
          (sum, bill) => sum + Number(bill.grand_total || 0),
          0,
        ),
    [bills],
  )

  const totalCredit = useMemo(
    () =>
      bills
        .filter(bill => bill.payment_method === 'credit')
        .reduce(
          (sum, bill) => sum + Number(bill.grand_total || 0),
          0,
        ),
    [bills],
  )

  const totalTransactions = bills.length

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
    <div className="payments-page min-w-0 space-y-5">
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

        .payments-page .payment-table {
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
          color: var(--muted-light);
          background: var(--surface-elevated);
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

      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[var(--muted-light)]">
            <Receipt size={16} />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em]">
              Finance / Payments
            </span>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-[var(--ink)] sm:text-2xl">
            Payment Sheet
          </h1>

          <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
            Track collections, credit sales, and payment transactions.
          </p>
        </div>

        <button
          type="button"
          onClick={loadPayments}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 text-xs font-semibold text-[var(--ink-secondary)] shadow-sm transition hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard
          title="Collected"
          value={formatCurrency(totalCollected)}
          description="Non-credit payments"
          count={bills.filter(bill => bill.payment_method !== 'credit').length}
          icon={CircleDollarSign}
          iconClass="bg-[var(--payment-cash-bg)] text-[var(--payment-cash-text)] border-[var(--payment-cash-border)]"
        />

        <SummaryCard
          title="Credit due"
          value={formatCurrency(totalCredit)}
          description="Outstanding credit sales"
          count={bills.filter(bill => bill.payment_method === 'credit').length}
          icon={Wallet}
          iconClass="bg-[var(--payment-credit-bg)] text-[var(--payment-credit-text)] border-[var(--payment-credit-border)]"
        />

        <SummaryCard
          title="Transactions"
          value={totalTransactions.toLocaleString('en-IN')}
          description="Total recorded bills"
          icon={Receipt}
          iconClass="bg-[var(--surface-elevated)] text-[var(--muted)] border-[var(--line)]"
        />

        {summary.slice(0, 2).map(item => {
          const Icon = item.icon

          return (
            <SummaryCard
              key={item.key}
              title={item.label}
              value={formatCurrency(item.total)}
              description={item.description}
              count={item.count}
              icon={Icon}
              active={filter === item.key}
              onClick={() =>
                setFilter(current =>
                  current === item.key ? 'all' : item.key,
                )
              }
              iconClass={item.iconClass}
            />
          )
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <div className="border-b border-[var(--line)] p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal
                  size={16}
                  className="text-[var(--muted)]"
                />
                <h2 className="text-sm font-bold text-[var(--ink)]">
                  Payment Transactions
                </h2>
              </div>

              <p className="mt-1 text-xs text-[var(--muted-light)]">
                {filteredBills.length} transaction
                {filteredBills.length === 1 ? '' : 's'} displayed
              </p>
            </div>

            <div className="flex w-full gap-2 lg:w-auto">
              <div className="relative min-w-0 flex-1 lg:w-72 lg:flex-none">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-light)]"
                />

                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search invoice or customer..."
                  className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-elevated)] pl-9 pr-9 text-xs text-[var(--ink)] outline-none transition placeholder:text-[var(--muted-light)] focus:border-[var(--primary-border)] focus:ring-2 focus:ring-[var(--focus-ring)]"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-light)] transition hover:text-[var(--ink)]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={loadPayments}
                disabled={loading}
                aria-label="Refresh payment transactions"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={loading ? 'animate-spin' : ''}
                />
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-1 overflow-x-auto rounded-xl bg-[var(--surface-elevated)] p-1">
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
                <article key={bill.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-bold text-[var(--primary)]">
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

                  <div className="mt-4 grid grid-cols-2 gap-2">
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

                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--muted-light)]">
                      View record
                      <ArrowUpRight size={12} />
                    </span>
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
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBills.map(bill => (
                    <tr key={bill.id}>
                      <td>
                        <span className="font-mono text-xs font-bold text-[var(--primary)]">
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
                        <span className="text-xs text-[var(--muted)]">
                          {formatDate(bill.created_at || bill.date)}
                        </span>
                      </td>

                      <td>
                        <PaymentBadge method={bill.payment_method} />
                      </td>

                      <td>
                        <span className="text-sm font-bold text-[var(--ink)]">
                          {formatCurrency(bill.grand_total)}
                        </span>
                      </td>

                      <td>
                        <PaymentStatus status={bill.payment_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
