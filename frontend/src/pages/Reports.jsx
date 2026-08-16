import { useState, useEffect } from 'react'
import api from '../api'
import { Card, PageHeader, Spinner } from '../components/UI'
import { Download, AlertCircle, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import toast from 'react-hot-toast'

const fmt = v => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

const today = new Date().toISOString().slice(0, 10)
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)

export default function Reports() {
  const [tab, setTab] = useState('sales')
  const [start, setStart] = useState(monthStart)
  const [end, setEnd] = useState(today)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')

  const endpoints = {
    sales: '/reports/sales/',
    products: '/reports/products/',
    profit: '/reports/profit/',
    gst: '/reports/gst/',
    customers: '/reports/customers/',
    payments: '/reports/payments/',
    expenses: '/reports/expenses/',
  }

  const reportNames = {
    sales: 'sales-report',
    products: 'product-sales-report',
    profit: 'profit-report',
    gst: 'gst-report',
    customers: 'customer-credit-report',
    payments: 'payment-report',
    expenses: 'expenses-report',
  }

  const load = async () => {
    if (tab !== 'customers' && start > end) {
      setError('The start date must be before the end date.')
      return
    }

    setLoading(true)
    setData(null)
    setError('')

    try {
      const params = tab === 'customers'
        ? ''
        : `?start_date=${start}&end_date=${end}`

      const response = await api.get(`${endpoints[tab]}${params}`)
      setData(response.data)
    } catch (err) {
      const message = err.response?.status === 403
        ? 'Reports are available to administrators only.'
        : err.response?.data?.detail ||
          'Could not load this report. Check the server connection and try again.'

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const downloadReport = async (format) => {
    if (tab !== 'customers' && start > end) {
      return toast.error('The start date must be before the end date')
    }

    setExporting(format)

    try {
      const params = new URLSearchParams()

      if (tab !== 'customers') {
        params.set('start_date', start)
        params.set('end_date', end)
      }

      // `format` is reserved by Django REST Framework.
      // `export` reaches the report view.
      params.set('export', format)

      const { data, headers } = await api.get(
        `${endpoints[tab]}?${params.toString()}`,
        { responseType: 'blob' }
      )

      const blob = new Blob(
        [data],
        {
          type:
            headers['content-type'] ||
            (
              format === 'pdf'
                ? 'application/pdf'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
        }
      )

      const url = window.URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = `${reportNames[tab]}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`

      document.body.appendChild(link)
      link.click()
      link.remove()

      window.URL.revokeObjectURL(url)
    } catch (err) {
      let message = 'Could not export this report'

      if (err.response?.data instanceof Blob) {
        try {
          const body = JSON.parse(await err.response.data.text())
          message = body.detail || body.error || message
        } catch {
          // Keep standard message for non-JSON responses.
        }
      } else {
        message =
          err.response?.data?.detail ||
          err.response?.data?.error ||
          message
      }

      toast.error(message)
    } finally {
      setExporting('')
    }
  }

  useEffect(() => {
    load()
  }, [tab, start, end])

  const tabs = [
    { key: 'sales', label: 'Sales' },
    { key: 'products', label: 'Products' },
    { key: 'profit', label: 'Profit' },
    { key: 'gst', label: 'GST' },
    { key: 'customers', label: 'Customer Credit' },
    { key: 'payments', label: 'Payments' },
    { key: 'expenses', label: 'Expenses' },
  ]

  const headerAction = (
    <div className="flex w-full sm:w-auto gap-2">
      <button
        onClick={() => downloadReport('pdf')}
        disabled={Boolean(exporting)}
        className="
          btn-secondary
          text-sm
          flex-1
          sm:flex-none
          justify-center
          items-center
          gap-1
          min-h-[40px]
          px-3
        "
      >
        <Download size={14} />
        {exporting === 'pdf' ? 'Preparing...' : 'PDF'}
      </button>

      <button
        onClick={() => downloadReport('xlsx')}
        disabled={Boolean(exporting)}
        className="
          btn-secondary
          text-sm
          flex-1
          sm:flex-none
          justify-center
          items-center
          gap-1
          min-h-[40px]
          px-3
        "
      >
        <Download size={14} />
        {exporting === 'xlsx' ? 'Preparing...' : 'Excel'}
      </button>
    </div>
  )

  return (
    <div className="space-y-3 sm:space-y-4 w-full min-w-0">

      {/* PAGE HEADER */}
      <PageHeader
        title="Reports"
        subtitle={`Export the selected ${
          tabs.find(item => item.key === tab)?.label || ''
        } report as PDF or Excel`}
        action={headerAction}
      />

      {/* REPORT TABS */}
      <div className="
        flex
        flex-nowrap
        gap-2
        overflow-x-auto
        reports-tabs
        pb-1
        -mx-1
        px-1
        scrollbar-thin
      ">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`
              px-4
              py-2
              rounded-lg
              text-sm
              font-medium
              flex-shrink-0
              whitespace-nowrap
              ${
                tab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }
            `}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* QUICK DATE FILTERS */}
      <div className="
        flex
        flex-nowrap
        sm:flex-wrap
        gap-2
        overflow-x-auto
        pb-1
        -mx-1
        px-1
      ">
        {[
          ['Today', today, today],
          ['This month', monthStart, today],
          [
            'Last 30 days',
            new Date(Date.now() - 29 * 86400000)
              .toISOString()
              .slice(0, 10),
            today
          ]
        ].map(([label, from, to]) => (
          <button
            key={label}
            className="
              text-xs
              sm:text-sm
              text-blue-700
              border
              border-blue-100
              bg-blue-50
              hover:bg-blue-100
              active:bg-blue-100
              rounded-lg
              px-3
              py-2
              min-h-[38px]
              flex-shrink-0
              whitespace-nowrap
              transition-colors
            "
            onClick={() => {
              setStart(from)
              setEnd(to)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* DATE / CALENDAR FILTER */}
      {tab !== 'customers' && tab !== 'expenses' && (
        <Card className="p-3 sm:p-4">
          <div className="
            flex
            flex-col
            sm:flex-row
            gap-3
            sm:gap-4
            sm:items-end
            reports-date-row
          ">

            <div className="
              grid
              grid-cols-1
              sm:grid-cols-2
              gap-3
              flex-1
              min-w-0
            ">

              {/* FROM DATE */}
              <div className="min-w-0">
                <label className="
                  block
                  text-xs
                  sm:text-sm
                  text-gray-600
                  mb-1.5
                ">
                  From
                </label>

                <input
                  type="date"
                  aria-label="Start date"
                  className="
                    input
                    text-sm
                    w-full
                    min-h-[42px]
                  "
                  value={start}
                  max={end}
                  onChange={e => setStart(e.target.value)}
                />
              </div>

              {/* TO DATE */}
              <div className="min-w-0">
                <label className="
                  block
                  text-xs
                  sm:text-sm
                  text-gray-600
                  mb-1.5
                ">
                  To
                </label>

                <input
                  type="date"
                  aria-label="End date"
                  className="
                    input
                    text-sm
                    w-full
                    min-h-[42px]
                  "
                  value={end}
                  min={start}
                  onChange={e => setEnd(e.target.value)}
                />
              </div>

            </div>

            {/* APPLY BUTTON */}
            <button
              onClick={load}
              disabled={start > end}
              className="
                btn-primary
                text-sm
                w-full
                sm:w-auto
                min-h-[42px]
                px-5
                disabled:opacity-50
                disabled:cursor-not-allowed
              "
            >
              Apply
            </button>

          </div>
        </Card>
      )}

      {/* CONTENT */}
      {loading ? (
        <Spinner />
      ) : error ? (
        <Card className="p-5 sm:p-8 text-center">

          <AlertCircle
            className="mx-auto text-red-500 mb-3"
            size={28}
          />

          <p className="font-medium text-gray-800">
            Reports could not be displayed
          </p>

          <p className="text-sm text-gray-500 mt-1">
            {error}
          </p>

          <button
            className="
              btn-secondary
              mt-4
              w-full
              sm:w-auto
              justify-center
            "
            onClick={load}
          >
            <RefreshCw size={15} />
            Try again
          </button>

        </Card>
      ) : data && (
        <>
          {tab === 'sales' && <SalesReport data={data} />}
          {tab === 'products' && <ProductReport data={data} />}
          {tab === 'profit' && <ProfitReport data={data} />}
          {tab === 'gst' && <GSTReport data={data} />}
          {tab === 'customers' && (
            <CustomerCreditReport data={data} />
          )}
          {tab === 'payments' && <PaymentReport data={data} />}
          {tab === 'expenses' && <ExpensesReport data={data} />}
        </>
      )}

    </div>
  )
}


/* =========================================================
   SALES REPORT
========================================================= */

function SalesReport({ data }) {
  const fmt = v =>
    `₹${Number(v || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 0
    })}`

  return (
    <div className="space-y-4">

      {/* SUMMARY CARDS */}
      <div className="
        grid
        grid-cols-2
        md:grid-cols-4
        gap-2.5
        sm:gap-4
      ">

        <Card className="p-3 sm:p-4 text-center">
          <div className="
            text-lg
            sm:text-2xl
            font-bold
            text-blue-600
            break-words
          ">
            {fmt(data.summary?.total_sales)}
          </div>

          <div className="text-sm text-gray-500">
            Total Sales
          </div>
        </Card>

        <Card className="p-3 sm:p-4 text-center">
          <div className="
            text-lg
            sm:text-2xl
            font-bold
            text-green-600
          ">
            {data.summary?.count}
          </div>

          <div className="text-sm text-gray-500">
            Invoices
          </div>
        </Card>

        <Card className="p-3 sm:p-4 text-center">
          <div className="
            text-lg
            sm:text-2xl
            font-bold
            text-red-500
            break-words
          ">
            {fmt(data.summary?.total_discount)}
          </div>

          <div className="text-sm text-gray-500">
            Discounts
          </div>
        </Card>

        <Card className="p-3 sm:p-4 text-center">
          <div className="
            text-lg
            sm:text-2xl
            font-bold
            text-purple-600
            break-words
          ">
            {fmt(data.summary?.total_tax)}
          </div>

          <div className="text-sm text-gray-500">
            Tax Collected
          </div>
        </Card>

      </div>

      {/* DAILY SALES CHART */}
      <Card className="
        p-3
        sm:p-5
        min-w-0
        overflow-hidden
      ">
        <h3 className="font-semibold mb-3 sm:mb-4">
          Daily Sales
        </h3>

        <ResponsiveContainer
          width="100%"
          height={220}
        >
          <LineChart data={data.daily}>

            <XAxis
              dataKey="created_at__date"
              tick={{ fontSize: 11 }}
            />

            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={v => `₹${v}`}
            />

            <Tooltip
              formatter={v => fmt(v)}
            />

            <Line
              type="monotone"
              dataKey="total"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />

          </LineChart>
        </ResponsiveContainer>

      </Card>

    </div>
  )
}


/* =========================================================
   PRODUCT REPORT
========================================================= */

function ProductReport({ data }) {
  const rows = Array.isArray(data)
    ? data
    : (data?.results ?? [])

  return (
    <Card className="p-3 sm:p-5 min-w-0">

      <h3 className="font-semibold mb-4">
        Product Sales
      </h3>

      <div className="overflow-x-auto">
        <table className="table min-w-[560px]">

          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Qty Sold</th>
              <th>Revenue</th>
            </tr>
          </thead>

          <tbody>

            {!rows.length && (
              <EmptyRows
                columns={4}
                message="No product sales in this date range."
              />
            )}

            {rows.map((p, i) => (
              <tr key={i}>

                <td className="font-medium">
                  {p.product_name}
                </td>

                <td className="font-mono text-sm">
                  {p.sku}
                </td>

                <td className="font-semibold">
                  {p.total_qty}
                </td>

                <td className="font-semibold text-green-600">
                  ₹{Number(p.total_revenue).toFixed(2)}
                </td>

              </tr>
            ))}

          </tbody>

        </table>
      </div>

    </Card>
  )
}


/* =========================================================
   PROFIT REPORT
========================================================= */

function ProfitReport({ data }) {
  const fmt = v =>
    `₹${Number(v || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 0
    })}`

  return (
    <div className="space-y-4">

      {/* PROFIT SUMMARY */}
      <div className="
        grid
        grid-cols-2
        sm:grid-cols-3
        gap-2.5
        sm:gap-4
      ">

        <Card className="p-3 sm:p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {fmt(data.total_revenue)}
          </div>

          <div className="text-sm text-gray-500">
            Revenue
          </div>
        </Card>

        <Card className="p-3 sm:p-4 text-center">
          <div className="text-2xl font-bold text-red-500">
            {fmt(data.total_cost)}
          </div>

          <div className="text-sm text-gray-500">
            Cost
          </div>
        </Card>

        <Card className="p-3 sm:p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {fmt(data.total_profit)}
          </div>

          <div className="text-sm text-gray-500">
            Profit
          </div>
        </Card>

      </div>

      {/* PROFIT TABLE */}
      <Card className="p-3 sm:p-5 min-w-0">

        <div className="
          overflow-x-auto
          -mx-1
          px-1
        ">

          <table className="table min-w-[560px]">

            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Revenue</th>
                <th>Cost</th>
                <th>Profit</th>
              </tr>
            </thead>

            <tbody>

              {!data.items?.length && (
                <EmptyRows
                  columns={5}
                  message="No profit data in this date range."
                />
              )}

              {data.items?.slice(0, 30).map((item, i) => (
                <tr key={i}>

                  <td>
                    {item.product}
                  </td>

                  <td>
                    {item.qty}
                  </td>

                  <td>
                    ₹{item.revenue?.toFixed(2)}
                  </td>

                  <td>
                    ₹{item.cost?.toFixed(2)}
                  </td>

                  <td
                    className={`
                      font-semibold
                      ${
                        item.profit >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    `}
                  >
                    ₹{item.profit?.toFixed(2)}
                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </Card>

    </div>
  )
}


/* =========================================================
   GST REPORT
========================================================= */

function GSTReport({ data }) {
  return (
    <div className="space-y-4">

      {/* GST TOTAL */}
      <Card className="
        p-3
        sm:p-4
        text-center
        w-full
        sm:max-w-xs
      ">

        <div className="text-2xl font-bold text-purple-600">
          ₹{Number(data.total_gst).toFixed(2)}
        </div>

        <div className="text-sm text-gray-500">
          Total GST Collected
        </div>

      </Card>

      {/* GST TABLE */}
      <Card className="p-3 sm:p-5 min-w-0">

        <div className="
          overflow-x-auto
          -mx-1
          px-1
        ">

          <table className="table min-w-[560px]">

            <thead>
              <tr>
                <th>GST Rate</th>
                <th>Taxable Amount</th>
                <th>GST Collected</th>
              </tr>
            </thead>

            <tbody>

              {!data.by_rate?.length && (
                <EmptyRows
                  columns={3}
                  message="No GST collected in this date range."
                />
              )}

              {data.by_rate?.map((r, i) => (
                <tr key={i}>

                  <td className="font-semibold">
                    {r.gst_percent}%
                  </td>

                  <td>
                    ₹{Number(r.taxable_amount).toFixed(2)}
                  </td>

                  <td className="font-semibold text-purple-600">
                    ₹{Number(r.gst_collected).toFixed(2)}
                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </Card>

    </div>
  )
}


/* =========================================================
   CUSTOMER CREDIT REPORT
========================================================= */

function CustomerCreditReport({ data }) {
  return (
    <div className="space-y-4">

      {/* OUTSTANDING TOTAL */}
      <Card className="
        p-3
        sm:p-4
        text-center
        w-full
        sm:max-w-xs
      ">

        <div className="text-2xl font-bold text-red-600">
          ₹{Number(data.total_outstanding).toFixed(2)}
        </div>

        <div className="text-sm text-gray-500">
          Total Outstanding
        </div>

      </Card>

      {/* CUSTOMER TABLE */}
      <Card className="p-3 sm:p-5 min-w-0">

        <div className="
          overflow-x-auto
          -mx-1
          px-1
        ">

          <table className="table min-w-[560px]">

            <thead>
              <tr>
                <th>Customer</th>
                <th>Mobile</th>
                <th>Outstanding</th>
                <th>Credit Limit</th>
              </tr>
            </thead>

            <tbody>

              {!data.customers?.length && (
                <EmptyRows
                  columns={4}
                  message="No outstanding customer credit."
                />
              )}

              {data.customers?.map((c, i) => (
                <tr key={i}>

                  <td className="font-medium">
                    {c.name}
                  </td>

                  <td>
                    {c.mobile}
                  </td>

                  <td className="font-semibold text-red-600">
                    ₹{Number(c.outstanding_amount).toFixed(2)}
                  </td>

                  <td>
                    ₹{Number(c.credit_limit).toFixed(2)}
                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </Card>

    </div>
  )
}


/* =========================================================
   PAYMENT REPORT
========================================================= */

function PaymentReport({ data }) {
  const rows = Array.isArray(data)
    ? data
    : (data?.results ?? [])

  const colors = {
    cash: 'text-green-600',
    upi: 'text-blue-600',
    card: 'text-purple-600',
    credit: 'text-red-600'
  }

  return (
    <Card className="
      p-3
      sm:p-5
      min-w-0
      overflow-hidden
    ">

      <h3 className="font-semibold mb-3 sm:mb-4">
        Payment Method Breakdown
      </h3>

      {/* PAYMENT CARDS */}
      <div className="
        grid
        grid-cols-2
        md:grid-cols-4
        gap-2.5
        sm:gap-4
        mb-4
        sm:mb-6
      ">

        {!rows.length && (
          <p className="
            text-sm
            text-gray-500
            col-span-full
          ">
            No recorded payments in this date range.
          </p>
        )}

        {rows.map((p, i) => (
          <div
            key={i}
            className="
              bg-gray-50
              rounded-xl
              p-4
              text-center
            "
          >

            <div
              className={`
                text-2xl
                font-bold
                capitalize
                ${colors[p.method] || 'text-gray-700'}
              `}
            >
              ₹{Number(p.total).toFixed(0)}
            </div>

            <div className="
              text-sm
              text-gray-500
              capitalize
              mt-1
            ">
              {p.method}
            </div>

            <div className="
              text-xs
              text-gray-400
            ">
              {p.count} transactions
            </div>

          </div>
        ))}

      </div>

      {/* PAYMENT CHART */}
      <ResponsiveContainer
        width="100%"
        height={200}
      >
        <BarChart data={rows}>

          <XAxis
            dataKey="method"
            tick={{ fontSize: 12 }}
          />

          <YAxis
            tick={{ fontSize: 11 }}
          />

          <Tooltip
            formatter={v => `₹${v}`}
          />

          <Bar
            dataKey="total"
            fill="#2563eb"
            radius={[4, 4, 0, 0]}
          />

        </BarChart>
      </ResponsiveContainer>

    </Card>
  )
}


/* =========================================================
   EMPTY TABLE ROWS
========================================================= */

function EmptyRows({ columns, message }) {
  return (
    <tr>
      <td
        colSpan={columns}
        className="
          text-center
          text-sm
          text-gray-500
          py-10
        "
      >
        {message}
      </td>
    </tr>
  )
}


/* =========================================================
   EXPENSE REPORT
========================================================= */

function ExpensesReport({ data }) {
  const rows = data.expenses || []
  const summary = data.summary || {}
  const byCategory = data.by_category || []

  return (
    <div className="space-y-4">

      {/* EXPENSE SUMMARY */}
      <div className="
        grid
        grid-cols-2
        md:grid-cols-4
        gap-2.5
        sm:gap-4
      ">

        <Card className="p-3 sm:p-4 text-center">

          <div className="
            text-2xl
            font-bold
            text-red-600
          ">
            {fmt(summary.total_amount)}
          </div>

          <div className="text-sm text-gray-500">
            Total Expenses
          </div>

        </Card>

        <Card className="p-3 sm:p-4 text-center">

          <div className="
            text-2xl
            font-bold
            text-gray-700
          ">
            {summary.count || 0}
          </div>

          <div className="text-sm text-gray-500">
            Transactions
          </div>

        </Card>

        <Card className="p-3 sm:p-4 text-center">

          <div className="
            text-2xl
            font-bold
            text-orange-500
          ">
            {fmt(summary.avg_amount)}
          </div>

          <div className="text-sm text-gray-500">
            Avg per Entry
          </div>

        </Card>

        <Card className="p-3 sm:p-4 text-center">

          <div className="
            text-2xl
            font-bold
            text-purple-600
          ">
            {byCategory.length}
          </div>

          <div className="text-sm text-gray-500">
            Categories
          </div>

        </Card>

      </div>

      {/* CATEGORY BREAKDOWN */}
      {byCategory.length > 0 && (
        <Card className="p-3 sm:p-5 min-w-0">

          <h3 className="
            font-semibold
            mb-3
            text-sm
          ">
            By Category
          </h3>

          <div className="
            grid
            grid-cols-2
            md:grid-cols-4
            gap-2.5
            sm:gap-3
          ">

            {byCategory.map((c, i) => (
              <div
                key={i}
                className="
                  bg-gray-50
                  rounded-xl
                  p-3
                  text-center
                "
              >

                <div className="
                  text-lg
                  font-bold
                  text-gray-800
                ">
                  {fmt(c.total)}
                </div>

                <div className="
                  text-xs
                  text-gray-500
                  mt-0.5
                ">
                  {c.category || 'Uncategorised'}
                </div>

                <div className="
                  text-xs
                  text-gray-400
                ">
                  {c.count} entries
                </div>

              </div>
            ))}

          </div>

        </Card>
      )}

      {/* EXPENSE TRANSACTIONS */}
      <Card className="
        p-3
        sm:p-5
        min-w-0
      ">

        <h3 className="
          font-semibold
          mb-4
          text-sm
        ">
          Expense Transactions
        </h3>

        <div className="
          overflow-x-auto
          -mx-1
          px-1
        ">

          <table className="table min-w-[560px]">

            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Method</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>

              {!rows.length && (
                <EmptyRows
                  columns={5}
                  message="No expenses in this date range."
                />
              )}

              {rows.map((e, i) => (
                <tr key={i}>

                  <td className="
                    text-gray-500
                    text-xs
                  ">
                    {e.expense_date}
                  </td>

                  <td className="font-medium">
                    {e.description}
                  </td>

                  <td>
                    <span className="
                      text-xs
                      bg-gray-100
                      text-gray-600
                      px-2
                      py-0.5
                      rounded-full
                    ">
                      {e.category || '—'}
                    </span>
                  </td>

                  <td className="
                    capitalize
                    text-xs
                  ">
                    {e.payment_method}
                  </td>

                  <td className="
                    font-semibold
                    text-red-600
                  ">
                    {fmt(e.amount)}
                  </td>

                </tr>
              ))}

            </tbody>

          </table>

        </div>

      </Card>

    </div>
  )
}