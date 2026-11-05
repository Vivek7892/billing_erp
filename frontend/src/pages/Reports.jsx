import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconFileSpreadsheet,
  IconFileTypePdf,
  IconPrinter,
  IconSearch,
  IconSelector,
  IconTrendingUp,
  IconShoppingCart,
  IconPackages,
  IconCash,
  IconUsers,
  IconReceiptTax,
  IconChartBar,
  IconRefresh,
} from '@tabler/icons-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/* ------------------------------------------------------------------
   Public exports (kept so other modules importing them keep working)
------------------------------------------------------------------- */
export const REPORT_CATEGORIES = [
  { key: 'all', label: 'All Reports', icon: IconChartBar },
  { key: 'sales', label: 'Sales & Revenue', icon: IconTrendingUp },
  { key: 'purchases', label: 'Purchases', icon: IconShoppingCart },
  { key: 'inventory', label: 'Stock & Inventory', icon: IconPackages },
  { key: 'books', label: 'Accounting Books', icon: IconCash },
  { key: 'ledgers', label: 'Ledgers & Dues', icon: IconUsers },
  { key: 'gst', label: 'GST & Compliance', icon: IconReceiptTax },
]

export const ALL_REPORTS = [
  { key: 'sales', category: 'sales', label: 'Sales Summary', desc: 'Revenue, collections and daily sales trend' },
  { key: 'sales_register', category: 'sales', label: 'Sales Register', desc: 'Invoice-wise sales with GST breakup' },
  { key: 'products', category: 'sales', label: 'Item-wise Sales', desc: 'Volume and revenue per product' },
  { key: 'purchases', category: 'purchases', label: 'Purchase Summary', desc: 'Supplier purchase totals and dues' },
  { key: 'purchase_register', category: 'purchases', label: 'Purchase Register', desc: 'Inward bills with payment status' },
  { key: 'item_wise_purchases', category: 'purchases', label: 'Item-wise Purchases', desc: 'Procurement quantity and cost per item' },
  { key: 'stock_summary', category: 'inventory', label: 'Stock Valuation', desc: 'Stock in hand, cost and valuation' },
  { key: 'stock_movement', category: 'inventory', label: 'Stock Movement', desc: 'Purchases, sales and adjustments' },
  { key: 'day_book', category: 'books', label: 'Day Book', desc: 'Chronological record of all transactions' },
  { key: 'cash_book', category: 'books', label: 'Cash Book', desc: 'Cash receipts, payments and balance' },
  { key: 'bank_book', category: 'books', label: 'Bank Book', desc: 'Deposits, withdrawals and UPI receipts' },
  { key: 'payments', category: 'books', label: 'Payment Collection', desc: 'Receipts by payment method' },
  { key: 'expenses', category: 'books', label: 'Operating Expenses', desc: 'Expenses by category' },
  { key: 'profit', category: 'books', label: 'Profit & Loss', desc: 'Revenue, costs and net profit' },
  { key: 'customers', category: 'ledgers', label: 'Customer Receivables', desc: 'Outstanding balances by customer' },
  { key: 'customer_ledger', category: 'ledgers', label: 'Customer Ledger', desc: 'Debit, credit and payment history' },
  { key: 'outstanding_payables', category: 'ledgers', label: 'Supplier Payables', desc: 'Dues payable to vendors' },
  { key: 'supplier_ledger', category: 'ledgers', label: 'Supplier Ledger', desc: 'Bills, returns and settlements' },
  { key: 'gst', category: 'gst', label: 'GST Tax Summary', desc: 'Taxable value and CGST / SGST liability' },
  { key: 'gstr1', category: 'gst', label: 'GSTR-1 Outward', desc: 'Outward supplies for filing' },
  { key: 'gstr2', category: 'gst', label: 'GSTR-2 Inward', desc: 'Inward supplies and ITC' },
  { key: 'gstr3b', category: 'gst', label: 'GSTR-3B Summary', desc: 'Output tax vs eligible ITC' },
]

const NAV_CATEGORIES = REPORT_CATEGORIES.filter(c => c.key !== 'all')

const ENDPOINTS = {
  sales: '/reports/sales/',
  sales_register: '/reports/sales-register/',
  products: '/reports/products/',
  purchases: '/reports/purchases/',
  purchase_register: '/reports/purchase-register/',
  item_wise_purchases: '/reports/item-wise-purchases/',
  stock_summary: '/reports/stock-summary/',
  stock_movement: '/reports/stock-movement/',
  day_book: '/reports/day-book/',
  cash_book: '/reports/cash-book/',
  bank_book: '/reports/bank-book/',
  payments: '/reports/payment-collection/',
  expenses: '/reports/expenses/',
  profit: '/reports/profit/',
  customers: '/reports/customers/',
  customer_ledger: '/reports/customer-ledger/',
  outstanding_payables: '/reports/outstanding-payables/',
  supplier_ledger: '/reports/supplier-ledger/',
  gst: '/reports/gst-summary/',
  gstr1: '/reports/gstr1/',
  gstr2: '/reports/gstr2/',
  gstr3b: '/reports/gstr3b/',
}

const SNAPSHOT_REPORTS = new Set(['customers', 'outstanding_payables', 'stock_summary'])

/* ------------------------------------------------------------------
   Date Helpers & Presets
------------------------------------------------------------------- */
const toLocalDate = d => {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const getToday = () => toLocalDate(new Date())
const getWeekStart = () => {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return toLocalDate(new Date(d.setDate(diff)))
}
const getMonthStart = () => toLocalDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const getLast90Days = () => toLocalDate(new Date(Date.now() - 89 * 86400000))
const getYearStart = () => {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-04-01`
}

const PRESET_RANGES = {
  Today: { start: getToday, end: getToday },
  'This Week': { start: getWeekStart, end: getToday },
  'This Month': { start: getMonthStart, end: getToday },
  'Last 90 Days': { start: getLast90Days, end: getToday },
  'This Year': { start: getYearStart, end: getToday },
}
const PRESETS = Object.keys(PRESET_RANGES)

/* ------------------------------------------------------------------
   Formatters
------------------------------------------------------------------- */
const inr = n =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
const num = n => Number(n || 0).toLocaleString('en-IN')
const pick = (arr, i) => arr[i % arr.length]
const day = i => `${String(((i * 2) % 28) + 1).padStart(2, '0')} Oct 2026`

/* ------------------------------------------------------------------
   Updated Comprehensive Seed Data with User & Operator Details
------------------------------------------------------------------- */
const CUSTOMERS_SEED = [
  { name: 'Lakshmi Stores', phone: '9845012345', gstin: '29AABCL1234F1Z1', role: 'Retailer' },
  { name: 'Ravi Kumar', phone: '9886067890', gstin: 'URP', role: 'Customer' },
  { name: 'Anita Traders', phone: '9448034567', gstin: '29ABCDE5678G2Z2', role: 'Wholesaler' },
  { name: 'Sri Balaji Mart', phone: '9741099882', gstin: '29XYZAB4321C4Z8', role: 'Retailer' },
  { name: 'Mohammed Iqbal', phone: '9900044551', gstin: 'URP', role: 'Customer' },
  { name: 'Meena Provisions', phone: '9880122334', gstin: '29KLMNO9012J5Z3', role: 'Retailer' },
  { name: 'Walk-in Customer', phone: 'Cash Counter', gstin: 'URP', role: 'Walk-in' },
  { name: 'Suresh & Sons', phone: '9844055667', gstin: '29PQRST9876Q3Z2', role: 'Distributor' },
  { name: 'Priya Bakery', phone: '9739088776', gstin: '29DEFGH3344K6Z0', role: 'Commercial' },
  { name: 'Green Leaf Mart', phone: '9916022113', gstin: '29AABCG8899M1Z9', role: 'Supermarket' },
]

const SUPPLIERS_SEED = [
  { name: 'Hindustan Distributors', phone: '080-22334455', gstin: '29AAACH1234D1Z2' },
  { name: 'Sai Wholesale Agros', phone: '9845112233', gstin: '29AABCS5544B1Z9' },
  { name: 'Karnataka Agro Agency', phone: '9886223344', gstin: '29AAACK7788P1Z4' },
  { name: 'Metro Traders Depot', phone: '080-41223344', gstin: '29AAACM9900C1Z7' },
  { name: 'Fresh Farms Pvt Ltd', phone: '9900334455', gstin: '29AAACF1122E1Z3' },
  { name: 'Annapurna Suppliers', phone: '9741445566', gstin: '29AAACA3344F1Z8' },
]

const OPERATORS_SEED = ['Karthik R. (Cashier)', 'Rajesh K. (Owner)', 'Sundar M. (Admin)', 'Karthik R. (Cashier)']
const ITEMS = ['Basmati Rice 5kg', 'Sunflower Oil 1L', 'Toor Dal 1kg', 'Sugar 1kg', 'Tata Salt 1kg', 'Wheat Atta 10kg', 'Tea Powder 500g', 'Milk 500ml', 'Biscuits Family Pack', 'Detergent 1kg']
const MODES = ['UPI', 'Cash', 'Card', 'Bank']
const STATUS_SALES = ['Paid', 'Paid', 'Partial', 'Paid', 'Due']

const DEFAULT_TREND = Array.from({ length: 30 }, (_, i) => {
  const revenue = Math.round(42000 + Math.sin(i / 2.2) * 9000 + i * 520 + (i % 7 === 0 ? 7000 : 0))
  const collections = Math.round(revenue * (0.82 + ((i * 7) % 10) / 100))
  return { label: `${i + 1} Oct`, revenue, collections }
})

const salesRows = Array.from({ length: 24 }, (_, i) => {
  const taxable = 1800 + ((i * 937) % 9200)
  const gst = Math.round(taxable * 0.12)
  const cust = pick(CUSTOMERS_SEED, i * 3)
  return {
    invoice: `INV-${2410 + i}`,
    date: day(i),
    customer: cust.name,
    mobile: cust.phone,
    user: pick(OPERATORS_SEED, i),
    mode: pick(MODES, i),
    taxable,
    gst,
    total: taxable + gst,
    status: pick(STATUS_SALES, i),
  }
})

const purchaseRows = Array.from({ length: 18 }, (_, i) => {
  const amount = 14000 + ((i * 4871) % 61000)
  const paid = i % 4 === 0 ? 0 : i % 3 === 0 ? Math.round(amount / 2) : amount
  const sup = pick(SUPPLIERS_SEED, i)
  return {
    bill: `PB-${880 + i}`,
    date: day(i),
    supplier: sup.name,
    mobile: sup.phone,
    user: 'Rajesh K. (Owner)',
    items: 4 + ((i * 3) % 17),
    amount,
    paid,
    due: amount - paid,
    status: paid === amount ? 'Paid' : paid === 0 ? 'Unpaid' : 'Partial',
  }
})

const stockRows = Array.from({ length: 20 }, (_, i) => {
  const stock = (i * 17) % 140
  const cost = 20 + ((i * 53) % 480)
  const retail = Math.round(cost * 1.18)
  return {
    sku: `SKU-${1001 + i}`,
    item: pick(ITEMS, i),
    category: pick(['Grocery', 'Staples', 'Beverages', 'Snacks', 'Household'], i),
    stock,
    cost,
    retail,
    valuation: stock * cost,
    status: stock === 0 ? 'Out of stock' : stock < 25 ? 'Low' : 'In stock',
  }
})

const bookRows = (() => {
  let bal = 120000
  return Array.from({ length: 22 }, (_, i) => {
    const credit = i % 3 === 0 ? 0 : 2500 + ((i * 1331) % 14000)
    const debit = i % 3 === 0 ? 1800 + ((i * 977) % 9000) : 0
    bal += credit - debit
    const partyObj = credit ? pick(CUSTOMERS_SEED, i) : pick(SUPPLIERS_SEED, i)
    return {
      date: day(i),
      voucher: `${credit ? 'RCT' : 'PMT'}-${300 + i}`,
      particulars: partyObj.name,
      mobile: partyObj.phone,
      user: pick(OPERATORS_SEED, i),
      mode: pick(MODES, i),
      debit,
      credit,
      balance: bal,
    }
  })
})()

const ledgerRows = Array.from({ length: 16 }, (_, i) => {
  const billed = 20000 + ((i * 6113) % 90000)
  const received = Math.round(billed * (0.35 + ((i * 11) % 55) / 100))
  const out = billed - received
  const age = 6 + ((i * 13) % 80)
  const cust = pick(CUSTOMERS_SEED, i)
  return {
    party: cust.name,
    mobile: cust.phone,
    role: cust.role,
    invoices: 3 + (i % 9),
    billed,
    received,
    outstanding: out,
    aging: `${age} days`,
    status: age > 60 ? 'Overdue' : age > 30 ? 'Due soon' : 'Current',
  }
})

const gstRows = [
  { slab: '0% (Exempt)', taxable: 48200, cgst: 0, sgst: 0, total: 0, share: '0.0%' },
  { slab: '5% GST', taxable: 312400, cgst: 7810, sgst: 7810, total: 15620, share: '13.2%' },
  { slab: '12% GST', taxable: 486900, cgst: 29214, sgst: 29214, total: 58428, share: '49.4%' },
  { slab: '18% GST', taxable: 238700, cgst: 21483, sgst: 21483, total: 42966, share: '36.3%' },
  { slab: '28% GST', taxable: 4600, cgst: 644, sgst: 644, total: 1288, share: '1.1%' },
]

const sum = (rows, k) => (Array.isArray(rows) ? rows.reduce((s, r) => s + (Number(r[k]) || 0), 0) : 0)

// Dynamic real metrics computed directly from datasets
const salesTotal = sum(salesRows, 'total')
const salesTaxable = sum(salesRows, 'taxable')
const salesGst = sum(salesRows, 'gst')
const salesCollected = salesRows.filter(r => r.status === 'Paid').reduce((s, r) => s + r.total, 0)
const salesOutstanding = Math.max(0, salesTotal - salesCollected)
const salesModeSums = {}
salesRows.forEach(r => {
  salesModeSums[r.mode] = (salesModeSums[r.mode] || 0) + r.total
})
const salesModeBreakdown = Object.entries(salesModeSums)
  .sort((a, b) => b[1] - a[1])
  .map(([mode, amt]) => [mode, Math.round((amt / (salesTotal || 1)) * 100), amt])

const purchaseTotal = sum(purchaseRows, 'amount')
const purchasePaid = sum(purchaseRows, 'paid')
const purchaseDue = sum(purchaseRows, 'due')
const purchaseSupplierSums = {}
purchaseRows.forEach(r => {
  purchaseSupplierSums[r.supplier] = (purchaseSupplierSums[r.supplier] || 0) + r.amount
})
const purchaseBreakdown = Object.entries(purchaseSupplierSums)
  .sort((a, b) => b[1] - a[1])
  .map(([sup, amt]) => [sup, Math.round((amt / (purchaseTotal || 1)) * 100), amt])

const stockValuation = sum(stockRows, 'valuation')
const lowStockCount = stockRows.filter(r => r.status === 'Low').length
const outStockCount = stockRows.filter(r => r.status === 'Out of stock').length
const stockCatSums = {}
stockRows.forEach(r => {
  stockCatSums[r.category] = (stockCatSums[r.category] || 0) + r.valuation
})
const stockBreakdown = Object.entries(stockCatSums)
  .sort((a, b) => b[1] - a[1])
  .map(([cat, amt]) => [cat, Math.round((amt / (stockValuation || 1)) * 100), amt])

const bookCredit = sum(bookRows, 'credit')
const bookDebit = sum(bookRows, 'debit')
const bookClosing = bookRows[bookRows.length - 1]?.balance || 0
const bookModeSums = {}
bookRows.forEach(r => {
  bookModeSums[r.mode] = (bookModeSums[r.mode] || 0) + (r.credit || r.debit || 0)
})
const bookTotal = bookCredit + bookDebit || 1
const bookModeBreakdown = Object.entries(bookModeSums)
  .sort((a, b) => b[1] - a[1])
  .map(([mode, amt]) => [mode, Math.round((amt / bookTotal) * 100), amt])

const ledgerTotal = sum(ledgerRows, 'outstanding')
const ledgerOverdue = ledgerRows.filter(r => r.status === 'Overdue' || r.status === 'Due').reduce((s, r) => s + r.outstanding, 0)

const FALLBACK_DATASETS = {
  sales: {
    kpis: [
      { label: 'Net Sales', value: inr(salesTotal), delta: 12.4 },
      { label: 'Collections', value: inr(salesCollected), delta: 9.1 },
      { label: 'Outstanding', value: inr(salesOutstanding), delta: -3.2, invert: true },
      { label: 'Invoices', value: num(salesRows.length), delta: 6.8 },
    ],
    chartTitle: 'Revenue vs collections',
    breakdownTitle: 'Collections by payment mode',
    breakdown: salesModeBreakdown,
    columns: [
      { key: 'invoice', label: 'Invoice' },
      { key: 'date', label: 'Date' },
      { key: 'customer', label: 'Customer' },
      { key: 'user', label: 'Billed By' },
      { key: 'mode', label: 'Mode' },
      { key: 'taxable', label: 'Taxable', money: true },
      { key: 'gst', label: 'GST', money: true },
      { key: 'total', label: 'Total', money: true, total: true },
      { key: 'status', label: 'Status', badge: true },
    ],
    rows: salesRows,
  },
  purchases: {
    kpis: [
      { label: 'Total Purchases', value: inr(purchaseTotal), delta: 4.2 },
      { label: 'Paid to Suppliers', value: inr(purchasePaid), delta: 5.9 },
      { label: 'Payables', value: inr(purchaseDue), delta: 8.1, invert: true },
      { label: 'Bills', value: num(purchaseRows.length), delta: 2.0 },
    ],
    chartTitle: 'Purchases vs payments',
    breakdownTitle: 'Spend by supplier',
    breakdown: purchaseBreakdown,
    columns: [
      { key: 'bill', label: 'Bill No.' },
      { key: 'date', label: 'Date' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'items', label: 'Items', num: true },
      { key: 'amount', label: 'Amount', money: true, total: true },
      { key: 'paid', label: 'Paid', money: true, total: true },
      { key: 'due', label: 'Due', money: true, total: true },
      { key: 'status', label: 'Status', badge: true },
    ],
    rows: purchaseRows,
  },
  inventory: {
    kpis: [
      { label: 'Stock Valuation', value: inr(stockValuation), delta: 3.5 },
      { label: 'SKUs Tracked', value: num(stockRows.length), delta: 1.2 },
      { label: 'Low Stock', value: num(lowStockCount), delta: 14.0, invert: true },
      { label: 'Out of Stock', value: num(outStockCount), delta: -12.5, invert: true },
    ],
    chartTitle: 'Stock valuation trend',
    breakdownTitle: 'Valuation by category',
    breakdown: stockBreakdown,
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'item', label: 'Item' },
      { key: 'category', label: 'Category' },
      { key: 'stock', label: 'In Stock', num: true, total: true },
      { key: 'cost', label: 'Cost', money: true },
      { key: 'retail', label: 'Retail', money: true },
      { key: 'valuation', label: 'Valuation', money: true, total: true },
      { key: 'status', label: 'Status', badge: true },
    ],
    rows: stockRows,
  },
  books: {
    kpis: [
      { label: 'Total Receipts', value: inr(bookCredit), delta: 7.7 },
      { label: 'Total Payments', value: inr(bookDebit), delta: 3.1, invert: true },
      { label: 'Closing Balance', value: inr(bookClosing), delta: 5.4 },
      { label: 'Vouchers', value: num(bookRows.length), delta: 4.6 },
    ],
    chartTitle: 'Cash inflow vs outflow',
    breakdownTitle: 'Transactions by mode',
    breakdown: bookModeBreakdown,
    columns: [
      { key: 'date', label: 'Date' },
      { key: 'voucher', label: 'Voucher' },
      { key: 'particulars', label: 'Particulars' },
      { key: 'user', label: 'Operator' },
      { key: 'mode', label: 'Mode' },
      { key: 'debit', label: 'Debit', money: true, total: true },
      { key: 'credit', label: 'Credit', money: true, total: true },
      { key: 'balance', label: 'Balance', money: true },
    ],
    rows: bookRows,
  },
  ledgers: {
    kpis: [
      { label: 'Total Outstanding', value: inr(ledgerTotal), delta: -2.8, invert: true },
      { label: 'Debtor Accounts', value: num(ledgerRows.length), delta: 6.7 },
      { label: 'Overdue Balances', value: inr(ledgerOverdue), delta: 11.2, invert: true },
      { label: 'Avg. Collection Days', value: '24', delta: -4.0, invert: true },
    ],
    chartTitle: 'Outstanding balance trend',
    breakdownTitle: 'Receivables aging',
    breakdown: [['0–30 days', 48], ['31–60 days', 29], ['61–90 days', 15], ['90+ days', 8]],
    columns: [
      { key: 'party', label: 'Customer / Party' },
      { key: 'invoices', label: 'Invoices', num: true },
      { key: 'billed', label: 'Billed', money: true, total: true },
      { key: 'received', label: 'Received', money: true, total: true },
      { key: 'outstanding', label: 'Outstanding', money: true, total: true },
      { key: 'aging', label: 'Aging' },
      { key: 'status', label: 'Status', badge: true },
    ],
    rows: ledgerRows,
  },
  gst: {
    kpis: [
      { label: 'Taxable Turnover', value: inr(sum(gstRows, 'taxable')), delta: 10.3 },
      { label: 'Output CGST', value: inr(sum(gstRows, 'cgst')), delta: 10.1 },
      { label: 'Output SGST', value: inr(sum(gstRows, 'sgst')), delta: 10.1 },
      { label: 'Net Tax Payable', value: inr(sum(gstRows, 'total')), delta: 9.8, invert: true },
    ],
    chartTitle: 'GST liability trend',
    breakdownTitle: 'Tax share by slab',
    breakdown: [['12%', 49], ['18%', 36], ['5%', 13], ['28%', 1], ['Exempt', 1]],
    columns: [
      { key: 'slab', label: 'Rate Slab' },
      { key: 'taxable', label: 'Taxable Value', money: true, total: true },
      { key: 'cgst', label: 'CGST', money: true, total: true },
      { key: 'sgst', label: 'SGST', money: true, total: true },
      { key: 'total', label: 'Total Tax', money: true, total: true },
      { key: 'share', label: 'Share', num: true },
    ],
    rows: gstRows,
  },
}

/* ------------------------------------------------------------------
   Field Detection Helpers
------------------------------------------------------------------- */
const isMonetaryCol = h => {
  const s = String(h || '').toLowerCase()
  return (
    s.includes('amount') ||
    s.includes('total') ||
    s.includes('tax') ||
    s.includes('price') ||
    s.includes('balance') ||
    s.includes('debit') ||
    s.includes('credit') ||
    s.includes('due') ||
    s.includes('valuation') ||
    s.includes('cost') ||
    s.includes('revenue') ||
    s.includes('turnover') ||
    s.includes('paid') ||
    s.includes('cgst') ||
    s.includes('sgst') ||
    s.includes('igst') ||
    s.includes('billed') ||
    s.includes('received')
  )
}

const isNumericCol = h => {
  const s = String(h || '').toLowerCase()
  return (
    s.includes('qty') ||
    s.includes('quantity') ||
    s.includes('units') ||
    s.includes('count') ||
    s.includes('items') ||
    s.includes('invoices') ||
    s.includes('stock')
  )
}

const isUserOrPartyCol = (c, r) => {
  const label = String(c?.label || '').toLowerCase()
  const key = String(c?.key || '').toLowerCase()
  const isParty =
    label.includes('customer') ||
    label.includes('party') ||
    label.includes('supplier') ||
    label.includes('user') ||
    label.includes('cashier') ||
    label.includes('operator') ||
    label.includes('particulars') ||
    label.includes('billed by') ||
    key.includes('customer') ||
    key.includes('party') ||
    key.includes('supplier') ||
    key.includes('user')
  return Boolean(isParty && r)
}

const STATUS_TONE = {
  Paid: 'ok', 'In stock': 'ok', Current: 'ok',
  Partial: 'warn', Low: 'warn', 'Due soon': 'warn',
  Due: 'bad', Unpaid: 'bad', Overdue: 'bad', 'Out of stock': 'bad',
}
const TONE_CLASS = {
  ok: 'text-emerald-700 dark:text-emerald-400',
  warn: 'text-amber-700 dark:text-amber-400',
  bad: 'text-rose-700 dark:text-rose-400',
}
const DOT_CLASS = { ok: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500' }

/* ------------------------------------------------------------------
   Small building blocks
------------------------------------------------------------------- */
function Badge({ value }) {
  const tone = STATUS_TONE[value] || 'ok'
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${TONE_CLASS[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]}`} />
      {value}
    </span>
  )
}

function Delta({ value, invert }) {
  const good = invert ? value < 0 : value > 0
  const Icon = value >= 0 ? IconArrowUpRight : IconArrowDownRight
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        good ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
      }`}
    >
      <Icon size={14} stroke={2} />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

function Nav({ activeKey, onSelect }) {
  return (
    <nav aria-label="Reports" className="space-y-5">
      {NAV_CATEGORIES.map(cat => {
        const Icon = cat.icon
        return (
          <div key={cat.key}>
            <div className="mb-1.5 flex items-center gap-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              <Icon size={14} />
              {cat.label}
            </div>
            <ul>
              {ALL_REPORTS.filter(r => r.category === cat.key).map(r => {
                const active = r.key === activeKey
                return (
                  <li key={r.key}>
                    <button
                      type="button"
                      onClick={() => onSelect(r.key)}
                      aria-current={active ? 'page' : undefined}
                      className={`relative block w-full py-1.5 pl-3 pr-2 text-left text-[13px] transition-colors cursor-pointer ${
                        active
                          ? 'font-semibold text-[#0057B8]'
                          : 'text-[var(--ink)] hover:text-[#0057B8]'
                      }`}
                    >
                      {active && (
                        <span className="absolute inset-y-1 left-0 w-0.5 rounded bg-[#0057B8]" />
                      )}
                      {r.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

function Breakdown({ title, items }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-4 space-y-3.5">
        {items.map(([label, pct, amt]) => (
          <li key={label}>
            <div className="mb-1 flex items-baseline justify-between text-[13px]">
              <span className="truncate pr-2 font-medium">{label}</span>
              <div className="flex items-center gap-1.5 font-mono tabular-nums text-xs">
                {amt !== undefined && amt !== null && (
                  <span className="font-semibold text-[var(--ink)]">{inr(amt)}</span>
                )}
                <span className="text-[var(--muted)]">({pct}%)</span>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[var(--line-subtle,rgba(100,116,139,0.15))]">
              <div className="h-1.5 rounded-full bg-[#0057B8]" style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DataTable({ columns, rows, loading }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ key: null, dir: 'asc' })
  const [page, setPage] = useState(1)
  const pageSize = 8

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = q
      ? rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q)))
      : rows
    if (sort.key) {
      out = [...out].sort((a, b) => {
        const x = a[sort.key]
        const y = b[sort.key]
        const numX = Number(x)
        const numY = Number(y)
        if (!isNaN(numX) && !isNaN(numY)) {
          return sort.dir === 'asc' ? numX - numY : numY - numX
        }
        const cmp = String(x ?? '').localeCompare(String(y ?? ''))
        return sort.dir === 'asc' ? cmp : -cmp
      })
    }
    return out
  }, [rows, query, sort])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const current = Math.min(page, pages)
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize)

  const toggleSort = key =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  const isRight = c => c.money || c.num

  const renderCellContent = (c, r) => {
    const v = r[c.key]
    if (c.badge) return <Badge value={String(v ?? '—')} />
    if (c.money) return inr(v)
    if (c.num && typeof v === 'number') return num(v)

    // User or Party Row Information enhancement
    if (isUserOrPartyCol(c, r)) {
      const sub = r.mobile || r.phone || r.gstin || r.role || ''
      return (
        <div className="flex flex-col min-w-0 py-0.5">
          <span className="font-medium text-[var(--ink)] truncate">{String(v ?? '—')}</span>
          {sub && (
            <span className="text-[11px] text-[var(--muted)] font-mono truncate">{sub}</span>
          )}
        </div>
      )
    }

    return String(v ?? '—')
  }

  const hasTotals = columns.some(c => c.total)

  return (
    <section>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold">
          Detailed statement{' '}
          <span className="ml-1 font-normal text-[var(--muted)]">
            {loading ? 'Refreshing…' : `${filtered.length} records`}
          </span>
        </h3>
        <label className="relative block w-full sm:w-64">
          <IconSearch
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Search records"
            aria-label="Search records"
            className="h-8.5 sm:h-9 w-full rounded-md border border-[var(--line)] bg-transparent pl-8 pr-3 text-xs sm:text-[13px] outline-none placeholder:text-[var(--muted)] focus:border-[#0057B8]"
          />
        </label>
      </div>

      <div className="mt-3 overflow-x-auto border-y border-[var(--line)] scrollbar-thin">
        <table className="w-full min-w-[640px] sm:min-w-[720px] border-collapse text-xs sm:text-[13px]">
          <thead>
            <tr className="border-b border-[var(--line)] text-[var(--muted)] bg-[var(--table-header-bg,rgba(100,116,139,0.03))]">
              {columns.map(c => (
                <th
                  key={c.key}
                  scope="col"
                  className={`whitespace-nowrap px-2.5 sm:px-3 py-2 sm:py-2.5 text-[11px] sm:text-xs font-medium ${
                    isRight(c) ? 'text-right' : 'text-left'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className={`inline-flex items-center gap-1 hover:text-[var(--ink)] cursor-pointer ${
                      isRight(c) ? 'flex-row-reverse' : ''
                    }`}
                  >
                    {c.label}
                    <IconSelector size={12} className={sort.key === c.key ? 'text-[#0057B8]' : 'opacity-40'} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-xs text-[var(--muted)]">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-[#0057B8] border-r-transparent"></div>
                  <p className="mt-2 font-medium">Loading live report data…</p>
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-xs text-[var(--muted)]">
                  {query ? 'No records match your search query.' : 'No transaction records found for the selected period.'}
                </td>
              </tr>
            ) : (
              visible.map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--line-subtle,rgba(100,116,139,0.15))] last:border-0 hover:bg-[var(--surface-hover,rgba(100,116,139,0.06))]"
                >
                  {columns.map(c => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-2.5 sm:px-3 py-2 sm:py-2.5 ${
                        isRight(c) ? 'text-right font-mono tabular-nums' : 'text-left'
                      } ${c.key === columns[0].key ? 'font-mono font-medium text-[var(--ink)]' : ''}`}
                    >
                      {renderCellContent(c, r)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {hasTotals && filtered.length > 0 && (
            <tfoot>
              <tr className="border-t border-[var(--line)] font-semibold bg-[var(--table-header-bg,rgba(100,116,139,0.03))]">
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={`whitespace-nowrap px-2.5 sm:px-3 py-2 sm:py-2.5 ${
                      isRight(c) ? 'text-right font-mono tabular-nums text-[#0057B8]' : 'text-left'
                    }`}
                  >
                    {i === 0
                      ? 'Total'
                      : c.total
                        ? c.money
                          ? inr(sum(filtered, c.key))
                          : num(sum(filtered, c.key))
                        : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="mt-3 flex flex-col items-center justify-between gap-2 text-xs text-[var(--muted)] sm:flex-row">
        <span>
          Showing {filtered.length === 0 ? 0 : (current - 1) * pageSize + 1}–
          {Math.min(current * pageSize, filtered.length)} of {filtered.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(current - 1)}
            disabled={current === 1}
            aria-label="Previous page"
            className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--ink)] disabled:opacity-40 cursor-pointer"
          >
            <IconChevronLeft size={14} />
          </button>
          <span className="px-2 font-mono tabular-nums text-[var(--ink)] text-xs">
            {current} / {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage(current + 1)}
            disabled={current === pages}
            aria-label="Next page"
            className="grid h-7 w-7 sm:h-8 sm:w-8 place-items-center rounded-md border border-[var(--line)] text-[var(--ink)] disabled:opacity-40 cursor-pointer"
          >
            <IconChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------
   Page Component with Full Live Backend Flow & Mobile Optimization
------------------------------------------------------------------- */
export default function Reports() {
  const [reportKey, setReportKey] = useState('sales')
  const [preset, setPreset] = useState('This Month')
  const [startDate, setStartDate] = useState(getMonthStart())
  const [endDate, setEndDate] = useState(getToday())
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef(null)

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = e => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false)
      }
    }
    if (exportOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [exportOpen])

  // Backend state
  const [backendData, setBackendData] = useState(null)
  const [loading, setLoading] = useState(false)
  const abortControllerRef = useRef(null)

  const report = ALL_REPORTS.find(r => r.key === reportKey) || ALL_REPORTS[0]
  const category = REPORT_CATEGORIES.find(c => c.key === report.category)
  const isSnapshot = SNAPSHOT_REPORTS.has(reportKey)

  // Fetch report data from Django Rest Framework backend
  const fetchReport = useCallback(async (key, start, end) => {
    const endpoint = ENDPOINTS[key] || `/reports/${key}/`
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    try {
      const isSnap = SNAPSHOT_REPORTS.has(key)
      const params = isSnap ? '' : `?start_date=${start}&end_date=${end}`
      const response = await api.get(`${endpoint}${params}`, {
        signal: controller.signal,
      })
      setBackendData(response.data)
      api.post('/auth/onboarding/reports-viewed/').catch(() => {})
    } catch (err) {
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        // Fallback gracefully to default sample data if endpoint not reachable
        setBackendData(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Refetch when reportKey or dates change
  useEffect(() => {
    fetchReport(reportKey, startDate, endDate)
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [reportKey, startDate, endDate, fetchReport])

  // Handle Preset changes
  const handlePresetChange = p => {
    setPreset(p)
    const range = PRESET_RANGES[p]
    if (range) {
      const s = range.start()
      const e = range.end()
      setStartDate(s)
      setEndDate(e)
    }
  }

  // Handle manual date range apply
  const handleApplyCustomDates = () => {
    if (startDate > endDate) {
      toast.error('Start date cannot be after end date')
      return
    }
    setPreset('Custom')
    fetchReport(reportKey, startDate, endDate)
  }

  // Adapter: map backend response to current view schema
  const data = useMemo(() => {
    const fallback = FALLBACK_DATASETS[report.category] || FALLBACK_DATASETS.sales

    if (!backendData) {
      return fallback
    }

    const headers = Array.isArray(backendData.headers) ? backendData.headers : []
    const rawRows = Array.isArray(backendData.rows)
      ? backendData.rows
      : Array.isArray(backendData.results)
      ? backendData.results
      : Array.isArray(backendData.customers)
      ? backendData.customers
      : Array.isArray(backendData.products)
      ? backendData.products
      : Array.isArray(backendData)
      ? backendData
      : []

    // If backend returned valid headers and records, construct dynamic columns & rows
    let columns = fallback.columns
    let rows = fallback.rows

    if (headers.length > 0 && rawRows.length > 0) {
      columns = headers.map((h, i) => {
        const isMoney = isMonetaryCol(h)
        const isNum = isNumericCol(h)
        const isBadge = h.toLowerCase().includes('status') || h.toLowerCase().includes('payment')
        return {
          key: `col_${i}`,
          label: h,
          money: isMoney,
          num: isNum && !isMoney,
          total: isMoney || isNum,
          badge: isBadge,
        }
      })

      rows = rawRows.map((r, rIdx) => {
        const rowObj = { _id: rIdx }
        headers.forEach((h, cIdx) => {
          const cellVal = Array.isArray(r) ? r[cIdx] : r[h] ?? Object.values(r)[cIdx] ?? ''
          rowObj[`col_${cIdx}`] = cellVal
        })
        return rowObj
      })
    } else if (headers.length > 0 && rawRows.length === 0) {
      columns = headers.map((h, i) => ({
        key: `col_${i}`,
        label: h,
        money: isMonetaryCol(h),
        num: isNumericCol(h),
        total: isMonetaryCol(h),
        badge: h.toLowerCase().includes('status'),
      }))
      rows = []
    }

    // Dynamic KPIs from backend summary
    let kpis = fallback.kpis
    const summary = backendData.summary || {}
    const summaryRows = Array.isArray(backendData.summary_rows) ? backendData.summary_rows : []

    if (summaryRows.length >= 4) {
      kpis = summaryRows.slice(0, 4).map(([lbl, val]) => ({
        label: lbl,
        value: typeof val === 'number' ? (isMonetaryCol(lbl) ? inr(val) : num(val)) : String(val),
        delta: 5.0,
      }))
    } else if (summary.gross_sales || summary.total_sales || summary.total_purchases || summary.total_valuation) {
      const primaryVal = summary.gross_sales || summary.total_sales || summary.total_purchases || summary.total_valuation || 0
      const secondaryVal = summary.collection || summary.paid_amount || summary.total_retail_valuation || 0
      const taxVal = summary.total_tax || summary.outstanding || 0
      const countVal = summary.count || rawRows.length || 0

      kpis = [
        { label: fallback.kpis[0]?.label || 'Total Amount', value: inr(primaryVal), delta: 8.4 },
        { label: fallback.kpis[1]?.label || 'Settled / Collections', value: inr(secondaryVal), delta: 4.2 },
        { label: fallback.kpis[2]?.label || 'Tax / Outstanding', value: inr(taxVal), delta: -2.1, invert: true },
        { label: fallback.kpis[3]?.label || 'Records Count', value: num(countVal), delta: 3.5 },
      ]
    }

    // Chart trend mapping: use actual revenue and real collections
    let chartData = DEFAULT_TREND
    if (Array.isArray(backendData.daily) && backendData.daily.length > 0) {
      chartData = backendData.daily.map(d => {
        if (Array.isArray(d)) {
          const rev = Number(d[2] || 0)
          const col = d[3] !== undefined ? Number(d[3] || 0) : rev
          return {
            label: d[0] || '—',
            revenue: rev,
            collections: col,
          }
        }
        const rev = Number(d.total || d.total_sales || 0)
        const col = Number(d.collection ?? d.collections ?? d.paid ?? rev)
        return {
          label: d.date || d.created_at__date || '—',
          revenue: rev,
          collections: col,
        }
      })
    }

    // Dynamic Breakdown mapping: real collections by payment mode
    let breakdown = []
    if (Array.isArray(backendData.by_mode) && backendData.by_mode.length > 0) {
      breakdown = backendData.by_mode.map(m => [
        m.mode || m[0],
        Number(m.share || m[1] || 0),
        Number(m.total || m[2] || 0),
      ])
    } else if (Array.isArray(backendData.methods) && backendData.methods.length > 0) {
      breakdown = backendData.methods.map(m => [
        m.method,
        Number(m.share_pct || 0),
        Number(m.total || 0),
      ])
    } else if (Array.isArray(backendData.rates) && backendData.rates.length > 0) {
      const totalTax = backendData.rates.reduce((acc, r) => acc + Number(r.taxable || 0), 0) || 1
      breakdown = backendData.rates.map(r => [
        `${r.gst_percent || 0}% GST`,
        Math.round((Number(r.taxable || 0) / totalTax) * 100),
        Number(r.taxable || 0),
      ])
    } else {
      // Dynamically compute real payment mode sums from active rows
      const modeCol = columns.find(c => {
        const l = (c.label || '').toLowerCase()
        const k = (c.key || '').toLowerCase()
        return l.includes('mode') || l.includes('method') || l.includes('channel') || k === 'mode'
      })
      const amountCol = columns.find(c => c.money || c.total || c.key === 'total' || c.key === 'amount')

      if (modeCol && rows.length > 0) {
        const modeSums = {}
        let totalVal = 0
        rows.forEach(r => {
          const m = String(r[modeCol.key] || 'Other').trim()
          const amt = Number(amountCol ? r[amountCol.key] : 0) || 0
          modeSums[m] = (modeSums[m] || 0) + amt
          totalVal += amt
        })
        const totalBase = totalVal || 1
        breakdown = Object.entries(modeSums)
          .sort((a, b) => b[1] - a[1])
          .map(([mode, amt]) => [
            mode,
            Math.round((amt / totalBase) * 100),
            amt,
          ])
      } else {
        breakdown = fallback.breakdown || []
      }
    }

    return {
      kpis,
      chartTitle: fallback.chartTitle,
      breakdownTitle: fallback.breakdownTitle,
      breakdown,
      columns,
      rows,
      chartData,
    }
  }, [backendData, report.category])

  // Real Export Flow (PDF, Excel, CSV, Print)
  const exportAs = async type => {
    if (type === 'Print') {
      window.print()
      return
    }

    if (type === 'CSV') {
      try {
        const cols = data.columns
        const rws = data.rows
        if (!cols.length || !rws.length) {
          toast.error('No records available to export')
          return
        }
        const escapeCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`
        const csvContent = [
          cols.map(c => escapeCell(c.label)).join(','),
          ...rws.map(row => cols.map(c => escapeCell(row[c.key] ?? '')).join(',')),
        ].join('\r\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${reportKey}_${startDate}_${endDate}.csv`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        toast.success('Report exported as CSV')
      } catch {
        toast.error('Failed to export CSV')
      }
      return
    }

    // PDF and Excel from backend
    const format = type === 'PDF' ? 'pdf' : 'xlsx'
    const endpoint = ENDPOINTS[reportKey] || `/reports/${reportKey}/`
    const toastId = toast.loading(`Generating ${type} report...`)

    try {
      const params = new URLSearchParams()
      if (!isSnapshot) {
        params.set('start_date', startDate)
        params.set('end_date', endDate)
      }
      params.set('export', format)

      const response = await api.get(`${endpoint}?${params.toString()}`, {
        responseType: 'blob',
      })

      const mimeType =
        response.headers['content-type'] ||
        (format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

      const blob = new Blob([response.data], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${reportKey}_${startDate}_${endDate}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`Downloaded ${type} successfully`, { id: toastId })
    } catch {
      toast.error(`Server export not available. Exporting local CSV...`, { id: toastId })
      exportAs('CSV')
    }
  }

  return (
    <div className="w-full min-w-0 pb-12 text-[var(--ink)]">
      {/* Header */}
      <header className="flex flex-col gap-3.5 border-b border-[var(--line)] pb-4 sm:pb-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs text-[var(--muted)]">
            Reports <span className="mx-1">/</span> {category?.label}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{report.label}</h1>
            {loading && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)] font-mono">
                <IconRefresh size={12} className="animate-spin text-[#0057B8]" />
                Syncing…
              </span>
            )}
          </div>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-[var(--muted)]">{report.desc}</p>
        </div>
        {/* Simple Export Dropdown */}
        <div className="relative inline-block text-left" ref={exportRef}>
          <button
            type="button"
            onClick={() => setExportOpen(v => !v)}
            aria-expanded={exportOpen}
            aria-haspopup="true"
            className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-md border border-[var(--line)] bg-[var(--surface,#ffffff)] px-3 text-xs sm:text-[13px] font-medium text-[var(--ink)] shadow-xs transition-colors hover:bg-[var(--surface-hover,rgba(100,116,139,0.08))] cursor-pointer focus:outline-none"
          >
            <IconDownload size={15} className="text-[#0057B8]" />
            <span>Export</span>
            <IconChevronDown
              size={14}
              className={`text-[var(--muted)] transition-transform duration-150 ${exportOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {exportOpen && (
            <div className="absolute right-0 z-30 mt-1.5 w-48 origin-top-right rounded-md border border-[var(--line)] bg-[var(--surface,#ffffff)] py-1 shadow-lg ring-1 ring-black/5 animate-in fade-in duration-100">
              <button
                type="button"
                onClick={() => {
                  setExportOpen(false)
                  exportAs('PDF')
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs sm:text-[13px] text-[var(--ink)] hover:bg-[var(--surface-hover,rgba(100,116,139,0.08))] cursor-pointer transition-colors"
              >
                <IconFileTypePdf size={16} className="text-rose-600 shrink-0" />
                <span>PDF Document</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExportOpen(false)
                  exportAs('Excel')
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs sm:text-[13px] text-[var(--ink)] hover:bg-[var(--surface-hover,rgba(100,116,139,0.08))] cursor-pointer transition-colors"
              >
                <IconFileSpreadsheet size={16} className="text-emerald-600 shrink-0" />
                <span>Excel Spreadsheet</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setExportOpen(false)
                  exportAs('CSV')
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs sm:text-[13px] text-[var(--ink)] hover:bg-[var(--surface-hover,rgba(100,116,139,0.08))] cursor-pointer transition-colors"
              >
                <IconDownload size={16} className="text-[var(--muted)] shrink-0" />
                <span>CSV File</span>
              </button>

              <div className="my-1 border-t border-[var(--line)]" />

              <button
                type="button"
                onClick={() => {
                  setExportOpen(false)
                  exportAs('Print')
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs sm:text-[13px] text-[var(--ink)] hover:bg-[var(--surface-hover,rgba(100,116,139,0.08))] cursor-pointer transition-colors"
              >
                <IconPrinter size={16} className="text-[#0057B8] shrink-0" />
                <span>Print Report</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="mt-4 sm:mt-6 grid gap-6 sm:gap-8 lg:grid-cols-[216px_minmax(0,1fr)]">
        {/* Navigator: desktop list */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 scrollbar-thin">
            <Nav activeKey={reportKey} onSelect={setReportKey} />
          </div>
        </aside>

        <div className="min-w-0 space-y-6 sm:space-y-8">
          {/* Mobile / tablet report picker */}
          <div className="lg:hidden">
            <label htmlFor="report-select" className="mb-1 block text-xs font-medium text-[var(--muted)]">
              Select Report
            </label>
            <select
              id="report-select"
              value={reportKey}
              onChange={e => setReportKey(e.target.value)}
              className="h-9 sm:h-10 w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs sm:text-sm outline-none focus:border-[#0057B8]"
            >
              {NAV_CATEGORIES.map(cat => (
                <optgroup key={cat.key} label={cat.label}>
                  {ALL_REPORTS.filter(r => r.category === cat.key).map(r => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* =====================================================
              FILTERS: Simple text-based button on Mobile & clean bar on Desktop
          ====================================================== */}
          <section className="space-y-2">
            {/* Mobile Simple Text-Based Filter Button */}
            <div className="sm:hidden flex items-center justify-between border-b border-[var(--line-subtle)] pb-2 text-xs">
              {!isSnapshot ? (
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(v => !v)}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#0057B8] hover:underline cursor-pointer"
                >
                  <IconCalendar size={14} />
                  <span>Period: {preset}</span>
                  <span className="text-[11px] text-[var(--muted)] font-normal">
                    {mobileFilterOpen ? '· (Hide filter)' : '· (Change)'}
                  </span>
                </button>
              ) : (
                <span className="text-[11px] text-[var(--muted)] font-mono">Live Snapshot as of Today</span>
              )}
              <span className="font-mono text-[11px] text-[var(--muted)]">
                {isSnapshot ? 'Live' : `${startDate.slice(5)} – ${endDate.slice(5)}`}
              </span>
            </div>

            {/* Mobile Expanded Filter Box */}
            {mobileFilterOpen && !isSnapshot && (
              <div className="sm:hidden rounded-lg border border-[var(--line)] bg-[var(--surface-elevated,rgba(100,116,139,0.04))] p-3 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex flex-wrap gap-1">
                  {PRESETS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        handlePresetChange(p)
                        setMobileFilterOpen(false)
                      }}
                      className={`h-7 px-2.5 text-xs rounded transition-colors cursor-pointer ${
                        preset === p
                          ? 'bg-[#0057B8] font-semibold text-white'
                          : 'bg-[var(--surface)] border border-[var(--line)] text-[var(--ink)]'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1 text-xs">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="h-8 flex-1 rounded border border-[var(--line)] bg-[var(--surface)] px-2 font-mono text-xs outline-none"
                  />
                  <span className="text-[var(--muted)]">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="h-8 flex-1 rounded border border-[var(--line)] bg-[var(--surface)] px-2 font-mono text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleApplyCustomDates()
                      setMobileFilterOpen(false)
                    }}
                    className="h-8 px-3 rounded bg-[#0057B8] text-xs font-semibold text-white cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}

            {/* Desktop Filters (Visible on sm screens and up) */}
            <div className="hidden sm:flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div
                role="tablist"
                aria-label="Date range"
                className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 xl:pb-0 scrollbar-thin"
              >
                {PRESETS.map(p => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={preset === p}
                    onClick={() => handlePresetChange(p)}
                    className={`h-8 shrink-0 rounded-md px-3 text-[13px] transition-colors cursor-pointer ${
                      preset === p
                        ? 'bg-[#0057B8] font-semibold text-white'
                        : 'text-[var(--muted)] hover:bg-[var(--surface-hover,rgba(100,116,139,0.08))] hover:text-[var(--ink)]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {!isSnapshot ? (
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <IconCalendar size={16} className="text-[var(--muted)]" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    aria-label="From date"
                    className="h-9 rounded-md border border-[var(--line)] bg-transparent px-2.5 font-mono text-xs outline-none focus:border-[#0057B8]"
                  />
                  <span className="text-[var(--muted)]">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    aria-label="To date"
                    className="h-9 rounded-md border border-[var(--line)] bg-transparent px-2.5 font-mono text-xs outline-none focus:border-[#0057B8]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCustomDates}
                    className="inline-flex h-9 items-center rounded-md border border-[var(--line)] px-3 text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover,rgba(100,116,139,0.08))] cursor-pointer transition-colors"
                  >
                    Apply
                  </button>
                </div>
              ) : (
                <div className="text-xs text-[var(--muted)] font-mono">
                  Live Snapshot as of Today (Date filtering not applicable)
                </div>
              )}
            </div>
          </section>

          {/* KPI strip */}
          <section
            aria-label="Summary"
            className="grid grid-cols-2 border-y border-[var(--line)] lg:grid-cols-4"
          >
            {data.kpis.map((k, i) => (
              <div
                key={k.label}
                className={`p-3 sm:py-4 sm:px-5 ${i > 0 ? 'lg:border-l lg:border-[var(--line)]' : ''} ${
                  i % 2 === 1 ? 'border-l border-[var(--line)] lg:border-l' : ''
                } ${i >= 2 ? 'border-t border-[var(--line)] lg:border-t-0' : ''} ${i === 0 ? 'sm:pl-0' : ''}`}
              >
                <p className="text-[11px] sm:text-xs text-[var(--muted)] truncate">{k.label}</p>
                <p className="mt-1 truncate font-mono text-lg sm:text-2xl font-semibold tabular-nums">
                  {k.value}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Delta value={k.delta} invert={k.invert} />
                  <span className="text-[10px] sm:text-xs text-[var(--muted)] hidden xs:inline">vs prev. period</span>
                </div>
              </div>
            ))}
          </section>

          {/* Chart + breakdown */}
          <section className="grid gap-6 sm:gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-semibold">{data.chartTitle}</h3>
                <div className="flex items-center gap-3 sm:gap-4 text-xs text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-3 bg-[#0057B8]" /> Primary
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-0.5 w-3 bg-slate-400" /> Secondary
                  </span>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 h-48 sm:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.chartData || DEFAULT_TREND} margin={{ top: 6, right: 4, left: -8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--line, #e2e8f0)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      interval={4}
                      tick={{ fontSize: 10, fill: 'var(--muted, #64748b)' }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickFormatter={v => `₹${Math.round(v / 1000)}k`}
                      tick={{ fontSize: 10, fill: 'var(--muted, #64748b)' }}
                    />
                    <Tooltip
                      formatter={(v, n) => [inr(v), n === 'revenue' ? 'Primary' : 'Secondary']}
                      contentStyle={{
                        background: 'var(--surface, #fff)',
                        border: '1px solid var(--line, #e2e8f0)',
                        borderRadius: 6,
                        fontSize: 12,
                        boxShadow: 'none',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="collections"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      fill="transparent"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#0057B8"
                      strokeWidth={2}
                      fill="#0057B8"
                      fillOpacity={0.06}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <Breakdown title={data.breakdownTitle} items={data.breakdown} />
          </section>

          {/* Table */}
          <DataTable key={`${reportKey}_${startDate}_${endDate}`} columns={data.columns} rows={data.rows} loading={loading} />

          <footer className="flex flex-col gap-1 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted)] sm:flex-row sm:justify-between">
            <span>
              {isSnapshot
                ? 'Live Snapshot ledger as of today'
                : `Period: ${preset} (${startDate} to ${endDate})`}
            </span>
            <span>Amounts in INR (₹)</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
