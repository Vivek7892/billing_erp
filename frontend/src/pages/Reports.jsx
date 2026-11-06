import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import api from '../api'
import {
  formatCurrency,
  formatNumber,
  formatDate,
} from '../utils/formatters'
import {
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
  IconX,
  IconLayoutGrid,
  IconTable,
} from '@tabler/icons-react'

/* ------------------------------------------------------------------
   Public Exports (Retained for application-wide compatibility)
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
  { key: 'sales', category: 'sales', label: 'Sales Summary', desc: 'Date-wise sales totals, transaction counts and revenues' },
  { key: 'sales_register', category: 'sales', label: 'Sales Register', desc: 'Itemized sales invoices with customer, tax and totals' },
  { key: 'products', category: 'sales', label: 'Item-wise Sales', desc: 'Units sold, average selling prices and gross revenues' },
  { key: 'purchases', category: 'purchases', label: 'Purchase Summary', desc: 'Procurement count, invoiced amounts and supplier dues' },
  { key: 'purchase_register', category: 'purchases', label: 'Purchase Register', desc: 'Inward purchase bills with supplier details and payments' },
  { key: 'item_wise_purchases', category: 'purchases', label: 'Item-wise Purchases', desc: 'Purchased quantities, unit purchase costs and total outlay' },
  { key: 'stock_summary', category: 'inventory', label: 'Stock Valuation', desc: 'Current stock in hand, landed cost, retail value and valuation' },
  { key: 'stock_movement', category: 'inventory', label: 'Stock Movement', desc: 'Stock inflow, outward billing, adjustments and ledger notes' },
  { key: 'day_book', category: 'books', label: 'Day Book', desc: 'Chronological record of all vouchers, debits and credits' },
  { key: 'cash_book', category: 'books', label: 'Cash Book', desc: 'Cash counter collections, payments and closing cash balance' },
  { key: 'bank_book', category: 'books', label: 'Bank Book', desc: 'Bank inflows, outflows, UTR references and bank balance' },
  { key: 'payments', category: 'books', label: 'Payment Collection', desc: 'Collections by payment channel, transaction ID and collector' },
  { key: 'expenses', category: 'books', label: 'Operating Expenses', desc: 'Business expenses by category, payee and payment method' },
  { key: 'profit', category: 'books', label: 'Profit & Loss', desc: 'Gross margin, operating overheads and net income statement' },
  { key: 'customers', category: 'ledgers', label: 'Customer Receivables', desc: 'Customer outstanding dues, credit limits and balances' },
  { key: 'customer_ledger', category: 'ledgers', label: 'Customer Ledger', desc: 'Customer account debit, credit and running balance history' },
  { key: 'outstanding_payables', category: 'ledgers', label: 'Supplier Payables', desc: 'Vendor payables, phone, GSTIN and pending balances' },
  { key: 'supplier_ledger', category: 'ledgers', label: 'Supplier Ledger', desc: 'Vendor bills, debit entries and settlement reconciliations' },
  { key: 'gst', category: 'gst', label: 'GST Tax Summary', desc: 'GST rate slabs, taxable turnovers and net tax liability' },
  { key: 'gstr1', category: 'gst', label: 'GSTR-1 Outward', desc: 'B2B/B2C outward supply schedules with CGST, SGST and IGST' },
  { key: 'gstr2', category: 'gst', label: 'GSTR-2 Inward', desc: 'Inward procurement bills and eligible Input Tax Credit (ITC)' },
  { key: 'gstr3b', category: 'gst', label: 'GSTR-3B Summary', desc: 'Consolidated return summary: output liability vs ITC offset' },
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
   Date Presets
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
const inr = n => formatCurrency(n, { maximumFractionDigits: 0, minimumFractionDigits: 0 })
const num = n => formatNumber(n)
const day = i => `${String(((i * 2) % 28) + 1).padStart(2, '0')} Oct 2026`

/* ------------------------------------------------------------------
   EXACT BACKEND PDF REPORT SCHEMAS & REALISTIC DATASETS
   Matches the exact headers and rows generated by PDF export
------------------------------------------------------------------- */
const BACKEND_TEMPLATES = {
  // 1. Sales Summary
  sales: {
    title: 'Sales Summary',
    headers: ['Date', 'Invoice Count', 'Total Sales'],
    rows: Array.from({ length: 30 }, (_, i) => [
      day(i),
      12 + ((i * 7) % 24),
      Math.round(28000 + ((i * 4120) % 65000)),
    ]),
  },

  // 2. Sales Register
  sales_register: {
    title: 'Sales Register',
    headers: [
      'Date', 'Invoice No.', 'Customer Name', 'GSTIN', 'Payment Mode',
      'Taxable Amount', 'Tax Amount', 'Round Off', 'Invoice Total'
    ],
    rows: [
      ['01 Oct 2026', 'INV-2410', 'Lakshmi Stores', '29AABCL1234F1Z1', 'UPI', 5200, 624, 0, 5824],
      ['02 Oct 2026', 'INV-2411', 'Ravi Kumar', 'URP', 'Cash', 1850, 222, 0, 2072],
      ['03 Oct 2026', 'INV-2412', 'Anita Traders', '29ABCDE5678G2Z2', 'Bank', 14200, 1704, 0, 15904],
      ['04 Oct 2026', 'INV-2413', 'Sri Balaji Mart', '29XYZAB4321C4Z8', 'Card', 7800, 936, 0, 8736],
      ['05 Oct 2026', 'INV-2414', 'Mohammed Iqbal', 'URP', 'Cash', 3100, 372, 0, 3472],
      ['06 Oct 2026', 'INV-2415', 'Meena Provisions', '29KLMNO9012J5Z3', 'UPI', 9400, 1128, 0, 10528],
      ['07 Oct 2026', 'INV-2416', 'Walk-in Customer', 'URP', 'Cash', 640, 77, 0, 717],
      ['08 Oct 2026', 'INV-2417', 'Suresh & Sons', '29PQRST9876Q3Z2', 'UPI', 18900, 2268, 0, 21168],
      ['09 Oct 2026', 'INV-2418', 'Priya Bakery', '29DEFGH3344K6Z0', 'Bank', 12400, 1488, 0, 13888],
      ['10 Oct 2026', 'INV-2419', 'Green Leaf Mart', '29AABCG8899M1Z9', 'UPI', 22100, 2652, 0, 24752],
      ['11 Oct 2026', 'INV-2420', 'Sri Balaji Mart', '29XYZAB4321C4Z8', 'Card', 6500, 780, 0, 7280],
      ['12 Oct 2026', 'INV-2421', 'Lakshmi Stores', '29AABCL1234F1Z1', 'UPI', 11300, 1356, 0, 12656],
    ],
  },

  // 3. Products / Item-Wise Sales
  products: {
    title: 'Item-wise Sales Report',
    headers: ['Item Name', 'Barcode / SKU', 'Category', 'Units Sold', 'Average Price', 'Total Revenue'],
    rows: [
      ['Basmati Rice 5kg', 'SKU-1001', 'Grocery', 140, 450, 63000],
      ['Sunflower Oil 1L', 'SKU-1002', 'Staples', 220, 135, 29700],
      ['Toor Dal 1kg', 'SKU-1003', 'Staples', 185, 155, 28675],
      ['Sugar 1kg', 'SKU-1004', 'Grocery', 310, 44, 13640],
      ['Tata Salt 1kg', 'SKU-1005', 'Grocery', 260, 28, 7280],
      ['Wheat Atta 10kg', 'SKU-1006', 'Staples', 95, 395, 37525],
      ['Tea Powder 500g', 'SKU-1007', 'Beverages', 125, 195, 24375],
      ['Milk 500ml', 'SKU-1008', 'Dairy', 480, 30, 14400],
      ['Biscuits Family Pack', 'SKU-1009', 'Snacks', 170, 85, 14450],
      ['Detergent 1kg', 'SKU-1010', 'Household', 115, 130, 14950],
    ],
  },

  // 4. Purchases Summary
  purchases: {
    title: 'Purchase Summary',
    headers: ['Date', 'Purchase Count', 'Total Purchases'],
    rows: Array.from({ length: 24 }, (_, i) => [
      day(i),
      2 + (i % 5),
      Math.round(18000 + ((i * 5320) % 72000)),
    ]),
  },

  // 5. Purchase Register
  purchase_register: {
    title: 'Purchase Register',
    headers: ['Date', 'Bill No.', 'Supplier Name', 'GSTIN', 'Total Amount', 'Paid Amount', 'Balance Due', 'Status'],
    rows: [
      ['02 Oct 2026', 'PB-880', 'Hindustan Distributors', '29AAACH1234D1Z2', 45000, 45000, 0, 'PAID'],
      ['04 Oct 2026', 'PB-881', 'Sai Wholesale Agros', '29AABCS5544B1Z9', 28500, 28500, 0, 'PAID'],
      ['06 Oct 2026', 'PB-882', 'Karnataka Agro Agency', '29AAACK7788P1Z4', 62000, 30000, 32000, 'PARTIAL'],
      ['08 Oct 2026', 'PB-883', 'Metro Traders Depot', '29AAACM9900C1Z7', 19800, 0, 19800, 'UNPAID'],
      ['10 Oct 2026', 'PB-884', 'Fresh Farms Pvt Ltd', '29AAACF1122E1Z3', 34200, 34200, 0, 'PAID'],
      ['12 Oct 2026', 'PB-885', 'Annapurna Suppliers', '29AAACA3344F1Z8', 51000, 25000, 26000, 'PARTIAL'],
      ['14 Oct 2026', 'PB-886', 'Hindustan Distributors', '29AAACH1234D1Z2', 29000, 29000, 0, 'PAID'],
      ['16 Oct 2026', 'PB-887', 'Sai Wholesale Agros', '29AABCS5544B1Z9', 42000, 0, 42000, 'UNPAID'],
    ],
  },

  // 6. Item-Wise Purchases
  item_wise_purchases: {
    title: 'Item-wise Purchases',
    headers: ['Item Name', 'Barcode / SKU', 'Category', 'Units Purchased', 'Average Cost', 'Total Cost'],
    rows: [
      ['Basmati Rice 5kg', 'SKU-1001', 'Grocery', 180, 380, 68400],
      ['Sunflower Oil 1L', 'SKU-1002', 'Staples', 300, 110, 33000],
      ['Toor Dal 1kg', 'SKU-1003', 'Staples', 250, 130, 32500],
      ['Sugar 1kg', 'SKU-1004', 'Grocery', 400, 38, 15200],
      ['Tata Salt 1kg', 'SKU-1005', 'Grocery', 350, 22, 7700],
      ['Wheat Atta 10kg', 'SKU-1006', 'Staples', 120, 340, 40800],
      ['Tea Powder 500g', 'SKU-1007', 'Beverages', 150, 160, 24000],
      ['Detergent 1kg', 'SKU-1010', 'Household', 140, 105, 14700],
    ],
  },

  // 7. Stock Valuation
  stock_summary: {
    title: 'Stock Summary Report',
    headers: ['Product Name', 'SKU / Code', 'Category', 'Current Stock', 'Unit', 'Cost Price', 'Selling Price', 'Total Valuation'],
    rows: [
      ['Basmati Rice 5kg', 'SKU-1001', 'Grocery', 65, 'Pcs', 380, 450, 24700],
      ['Sunflower Oil 1L', 'SKU-1002', 'Staples', 110, 'Pcs', 110, 135, 12100],
      ['Toor Dal 1kg', 'SKU-1003', 'Staples', 80, 'Pcs', 130, 155, 10400],
      ['Sugar 1kg', 'SKU-1004', 'Grocery', 140, 'Pcs', 38, 44, 5320],
      ['Tata Salt 1kg', 'SKU-1005', 'Grocery', 95, 'Pcs', 22, 28, 2090],
      ['Wheat Atta 10kg', 'SKU-1006', 'Staples', 35, 'Pcs', 340, 395, 11900],
      ['Tea Powder 500g', 'SKU-1007', 'Beverages', 45, 'Pcs', 160, 195, 7200],
      ['Milk 500ml', 'SKU-1008', 'Dairy', 18, 'Pcs', 26, 30, 468],
      ['Biscuits Family Pack', 'SKU-1009', 'Snacks', 60, 'Pcs', 65, 85, 3900],
      ['Detergent 1kg', 'SKU-1010', 'Household', 40, 'Pcs', 105, 130, 4200],
    ],
  },

  // 8. Stock Movement
  stock_movement: {
    title: 'Stock Movement Report',
    headers: ['Date & Time', 'Item Name', 'Movement Type', 'Qty Changed', 'Stock Before', 'Stock After', 'Reference Note'],
    rows: [
      ['01 Oct 2026 10:15', 'Basmati Rice 5kg', 'INWARD_PURCHASE', 50, 15, 65, 'PO-880 Hindustan'],
      ['02 Oct 2026 11:30', 'Sunflower Oil 1L', 'INWARD_PURCHASE', 100, 10, 110, 'PO-881 Sai Agros'],
      ['03 Oct 2026 14:20', 'Toor Dal 1kg', 'OUTWARD_SALE', -10, 90, 80, 'INV-2412 Sale'],
      ['04 Oct 2026 16:45', 'Sugar 1kg', 'OUTWARD_SALE', -25, 165, 140, 'INV-2413 Sale'],
      ['05 Oct 2026 09:30', 'Milk 500ml', 'EXPIRED_DAMAGE', -5, 23, 18, 'Damaged pack write-off'],
      ['06 Oct 2026 17:10', 'Wheat Atta 10kg', 'INWARD_PURCHASE', 20, 15, 35, 'PO-885 Annapurna'],
    ],
  },

  // 9. Day Book
  day_book: {
    title: 'Day Book Statement',
    headers: ['Date & Time', 'Voucher Type', 'Voucher No.', 'Particulars / Account', 'Debit (Dr)', 'Credit (Cr)'],
    rows: [
      ['01 Oct 2026 09:30', 'SALES_INVOICE', 'INV-2410', 'Lakshmi Stores', 0, 5824],
      ['01 Oct 2026 11:15', 'RECEIPT', 'RCT-301', 'Anita Traders', 0, 12000],
      ['01 Oct 2026 14:00', 'PURCHASE_BILL', 'PB-880', 'Hindustan Distributors', 45000, 0],
      ['01 Oct 2026 16:30', 'PAYMENT', 'PMT-302', 'Shop Electric Bill', 3400, 0],
      ['02 Oct 2026 10:00', 'SALES_INVOICE', 'INV-2411', 'Ravi Kumar', 0, 2072],
      ['02 Oct 2026 12:45', 'SALES_INVOICE', 'INV-2412', 'Anita Traders', 0, 15904],
      ['02 Oct 2026 15:20', 'PAYMENT', 'PMT-303', 'Sai Wholesale Agros', 28500, 0],
    ],
  },

  // 10. Cash Book
  cash_book: {
    title: 'Cash Book',
    headers: ['Date', 'Particulars', 'Voucher / Ref No.', 'Cash In (Receipts)', 'Cash Out (Payments)', 'Closing Balance'],
    rows: [
      ['01 Oct 2026', 'Opening Cash Balance', 'OP-BAL', 0, 0, 25000],
      ['01 Oct 2026', 'Cash Counter Sales', 'INV-2411', 2072, 0, 27072],
      ['01 Oct 2026', 'Walk-in Cash Sale', 'INV-2416', 717, 0, 27789],
      ['02 Oct 2026', 'Petty Cash Tea & Refreshment', 'PMT-04', 0, 350, 27439],
      ['02 Oct 2026', 'Mohammed Iqbal Cash Payment', 'RCT-305', 3472, 0, 30911],
      ['03 Oct 2026', 'Cash Deposit to Bank', 'CONTRA-01', 0, 15000, 15911],
    ],
  },

  // 11. Bank Book
  bank_book: {
    title: 'Bank Book',
    headers: ['Date', 'Particulars', 'Ref / UTR No.', 'Payment Mode', 'Bank Inflow', 'Bank Outflow', 'Bank Balance'],
    rows: [
      ['01 Oct 2026', 'Opening Bank Balance', 'OP-BAL', 'Bank', 0, 0, 142000],
      ['01 Oct 2026', 'UPI Collection Lakshmi Stores', 'UPI-98450123', 'UPI', 5824, 0, 147824],
      ['01 Oct 2026', 'Vendor NEFT Hindustan Dist', 'NEFT-004455', 'NEFT', 0, 45000, 102824],
      ['02 Oct 2026', 'NEFT Anita Traders Settlement', 'NEFT-883344', 'NEFT', 15904, 0, 118728],
      ['03 Oct 2026', 'Cash Deposit Counter', 'CHQ-00124', 'Cash', 15000, 0, 133728],
    ],
  },

  // 12. Profit & Loss
  profit: {
    title: 'Profit & Loss Statement',
    headers: ['Account / Particulars', 'Amount (Rs.)'],
    rows: [
      ['Gross Sales Revenue', 624500],
      ['Less: Sales Returns & Discounts', -18200],
      ['Net Revenue', 606300],
      ['Cost of Goods Sold (COGS)', -418000],
      ['Gross Profit Margin', 188300],
      ['Less: Rent & Shop Utilities', -24000],
      ['Less: Staff Salaries & Wages', -35000],
      ['Less: Electricity & Water Bills', -6800],
      ['Less: Logistics & Freight Outward', -8500],
      ['Net Operating Income (EBITDA)', 114000],
    ],
  },

  // 13. Operating Expenses
  expenses: {
    title: 'Expense Report',
    headers: ['Date', 'Category', 'Description', 'Payment Method', 'Amount', 'Created By'],
    rows: [
      ['01 Oct 2026', 'Utilities', 'Shop Electricity Bill', 'UPI', 3400, 'Rajesh K. (Owner)'],
      ['02 Oct 2026', 'Pantry', 'Tea and refreshments', 'Cash', 350, 'Karthik R. (Cashier)'],
      ['03 Oct 2026', 'Logistics', 'Delivery tempo charges', 'Cash', 1200, 'Sundar M. (Admin)'],
      ['05 Oct 2026', 'Rent', 'Commercial shop rent advance', 'Bank', 25000, 'Rajesh K. (Owner)'],
      ['08 Oct 2026', 'Stationery', 'Thermal paper rolls 50 nos', 'UPI', 850, 'Karthik R. (Cashier)'],
    ],
  },

  // 14. Payment Collection
  payments: {
    title: 'Payment Collection Report',
    headers: ['Date & Time', 'Receipt / Voucher No.', 'Customer / Party', 'Payment Mode', 'Reference / Txn ID', 'Amount Collected', 'Collected By'],
    rows: [
      ['01 Oct 2026 10:15', 'RCT-301', 'Lakshmi Stores', 'UPI', 'UPI-98450123', 5824, 'Karthik R.'],
      ['02 Oct 2026 11:20', 'RCT-302', 'Ravi Kumar', 'Cash', 'CASH-REC', 2072, 'Karthik R.'],
      ['03 Oct 2026 13:40', 'RCT-303', 'Anita Traders', 'Bank', 'NEFT-883344', 15904, 'Rajesh K.'],
      ['04 Oct 2026 15:10', 'RCT-304', 'Sri Balaji Mart', 'Card', 'POS-TXN-77', 8736, 'Sundar M.'],
      ['05 Oct 2026 17:00', 'RCT-305', 'Meena Provisions', 'UPI', 'UPI-778811', 10528, 'Karthik R.'],
    ],
  },

  // 15. Customer Receivables
  customers: {
    title: 'Outstanding Receivables Report',
    headers: ['Customer Name', 'Phone / Mobile', 'Credit Limit', 'Outstanding Balance'],
    rows: [
      ['Lakshmi Stores', '9845012345', 50000, 18450],
      ['Anita Traders', '9448034567', 100000, 32100],
      ['Sri Balaji Mart', '9741099882', 40000, 14200],
      ['Meena Provisions', '9880122334', 35000, 9800],
      ['Suresh & Sons', '9844055667', 150000, 48500],
      ['Priya Bakery', '9739088776', 60000, 21400],
      ['Green Leaf Mart', '9916022113', 80000, 27600],
    ],
  },

  // 16. Customer Ledger
  customer_ledger: {
    title: 'Customer Ledger Statement',
    headers: ['Date', 'Voucher / Bill No.', 'Type', 'Debit (Dr)', 'Credit (Cr)', 'Running Balance'],
    rows: [
      ['01 Oct 2026', 'OP-BAL', 'Opening Balance', 12000, 0, 12000],
      ['02 Oct 2026', 'INV-2410', 'Sales Invoice', 5824, 0, 17824],
      ['05 Oct 2026', 'RCT-301', 'Payment Received', 0, 10000, 7824],
      ['08 Oct 2026', 'INV-2421', 'Sales Invoice', 12656, 0, 20480],
      ['10 Oct 2026', 'RCT-309', 'Payment Received', 0, 15000, 5480],
    ],
  },

  // 17. Supplier Payables
  outstanding_payables: {
    title: 'Outstanding Payables Report',
    headers: ['Supplier Name', 'Phone', 'GSTIN', 'Outstanding Payable'],
    rows: [
      ['Hindustan Distributors', '080-22334455', '29AAACH1234D1Z2', 42000],
      ['Sai Wholesale Agros', '9845112233', '29AABCS5544B1Z9', 18500],
      ['Karnataka Agro Agency', '9886223344', '29AAACK7788P1Z4', 32000],
      ['Metro Traders Depot', '080-41223344', '29AAACM9900C1Z7', 19800],
      ['Annapurna Suppliers', '9741445566', '29AAACA3344F1Z8', 26000],
    ],
  },

  // 18. Supplier Ledger
  supplier_ledger: {
    title: 'Supplier Ledger Statement',
    headers: ['Date', 'Voucher / Bill No.', 'Type', 'Debit (Dr)', 'Credit (Cr)', 'Running Balance'],
    rows: [
      ['01 Oct 2026', 'OP-BAL', 'Opening Balance', 0, 24000, 24000],
      ['02 Oct 2026', 'PB-880', 'Purchase Inward', 0, 45000, 69000],
      ['04 Oct 2026', 'PMT-201', 'Payment Made', 45000, 0, 24000],
      ['08 Oct 2026', 'PB-886', 'Purchase Inward', 0, 29000, 53000],
      ['12 Oct 2026', 'PMT-204', 'Payment Made', 20000, 0, 33000],
    ],
  },

  // 19. GST Summary
  gst: {
    title: 'GST Summary Report',
    headers: ['GST Rate Slab', 'Taxable Turnover', 'Output CGST', 'Output SGST', 'Total GST Liability'],
    rows: [
      ['0% (Exempt)', 54200, 0, 0, 0],
      ['5% GST', 324000, 8100, 8100, 16200],
      ['12% GST', 495000, 29700, 29700, 59400],
      ['18% GST', 248000, 22320, 22320, 44640],
      ['28% GST', 12000, 1680, 1680, 3360],
    ],
  },

  // 20. GSTR-1 Outward
  gstr1: {
    title: 'GSTR-1 Outward Supplies',
    headers: [
      'Invoice No.', 'Invoice Date', 'Customer Name', 'Customer GSTIN',
      'Place of Supply', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Invoice Value'
    ],
    rows: [
      ['INV-2410', '01 Oct 2026', 'Lakshmi Stores', '29AABCL1234F1Z1', '29-Karnataka', 5200, 312, 312, 0, 5824],
      ['INV-2412', '03 Oct 2026', 'Anita Traders', '29ABCDE5678G2Z2', '29-Karnataka', 14200, 852, 852, 0, 15904],
      ['INV-2413', '04 Oct 2026', 'Sri Balaji Mart', '29XYZAB4321C4Z8', '29-Karnataka', 7800, 468, 468, 0, 8736],
      ['INV-2415', '06 Oct 2026', 'Meena Provisions', '29KLMNO9012J5Z3', '29-Karnataka', 9400, 564, 564, 0, 10528],
      ['INV-2417', '08 Oct 2026', 'Suresh & Sons', '29PQRST9876Q3Z2', '29-Karnataka', 18900, 1134, 1134, 0, 21168],
    ],
  },

  // 21. GSTR-2 Inward
  gstr2: {
    title: 'GSTR-2 Inward Supplies (ITC)',
    headers: [
      'Supplier GSTIN', 'Supplier Name', 'Invoice / Bill No.', 'Invoice Date',
      'Taxable Value', 'CGST (ITC)', 'SGST (ITC)', 'IGST (ITC)', 'Total ITC Eligible'
    ],
    rows: [
      ['29AAACH1234D1Z2', 'Hindustan Distributors', 'PB-880', '02 Oct 2026', 40178, 2411, 2411, 0, 4822],
      ['29AABCS5544B1Z9', 'Sai Wholesale Agros', 'PB-881', '04 Oct 2026', 25446, 1527, 1527, 0, 3054],
      ['29AAACK7788P1Z4', 'Karnataka Agro Agency', 'PB-882', '06 Oct 2026', 55357, 3321, 3321, 0, 6643],
      ['29AAACF1122E1Z3', 'Fresh Farms Pvt Ltd', 'PB-884', '10 Oct 2026', 30535, 1832, 1832, 0, 3665],
    ],
  },

  // 22. GSTR-3B Summary
  gstr3b: {
    title: 'GSTR-3B Monthly Return Summary',
    headers: [
      'Description / Table Section', 'Taxable Turnover',
      'Integrated Tax (IGST)', 'Central Tax (CGST)', 'State Tax (SGST)', 'Cess'
    ],
    rows: [
      ['3.1 (a) Outward taxable supplies (other than zero rated)', 1067000, 0, 61820, 61820, 0],
      ['3.1 (b) Outward taxable supplies (zero rated)', 0, 0, 0, 0, 0],
      ['3.1 (c) Other outward supplies (Nil rated, exempt)', 54200, 0, 0, 0, 0],
      ['4. (A) Eligible ITC Available (Inward supplies)', 620000, 0, 37200, 37200, 0],
      ['5.1 Net Tax Payable in Cash', 447000, 0, 24620, 24620, 0],
    ],
  },
}

/* ------------------------------------------------------------------
   Field Formatting Helpers
------------------------------------------------------------------- */
const isMonetaryCol = (header = '') => {
  const s = String(header).toLowerCase()
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
    s.includes('cess') ||
    s.includes('margin') ||
    s.includes('rs.')
  )
}

const isNumericCol = (header = '') => {
  const s = String(header).toLowerCase()
  return (
    s.includes('qty') ||
    s.includes('quantity') ||
    s.includes('units') ||
    s.includes('count') ||
    s.includes('stock') ||
    s.includes('items')
  )
}

const isStatusCol = (header = '') => {
  const s = String(header).toLowerCase()
  return s.includes('status') || s.includes('state') || s.includes('payment')
}

const isModeCol = (header = '') => {
  const s = String(header).toLowerCase()
  return s.includes('mode') || s.includes('channel') || s.includes('method')
}

/* ------------------------------------------------------------------
   Main Component
------------------------------------------------------------------- */
export default function Reports() {
  const [reportKey, setReportKey] = useState('sales')
  const [preset, setPreset] = useState('This Month')
  const [startDate, setStartDate] = useState(getMonthStart())
  const [endDate, setEndDate] = useState(getToday())
  const [exportOpen, setExportOpen] = useState(false)
  const [mobileView, setMobileView] = useState('cards')
  const [inspectRecord, setInspectRecord] = useState(null)
  const exportRef = useRef(null)

  // Query, Sort & Pagination state
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState({ colIdx: null, dir: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(15)

  // Backend Integration
  const [backendData, setBackendData] = useState(null)
  const [loading, setLoading] = useState(false)
  const abortControllerRef = useRef(null)

  const report = ALL_REPORTS.find(r => r.key === reportKey) || ALL_REPORTS[0]
  const isSnapshot = SNAPSHOT_REPORTS.has(reportKey)

  // Close export dropdown on click outside
  useEffect(() => {
    const handleClick = e => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false)
      }
    }
    if (exportOpen) {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('touchstart', handleClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [exportOpen])

  // Fetch report data
  const fetchReport = useCallback(async (key, start, end) => {
    const endpoint = ENDPOINTS[key] || `/reports/${key}/`
    if (abortControllerRef.current) abortControllerRef.current.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    try {
      const isSnap = SNAPSHOT_REPORTS.has(key)
      const params = isSnap ? '' : `?start_date=${start}&end_date=${end}`
      const response = await api.get(`${endpoint}${params}`, { signal: controller.signal })
      setBackendData(response.data)
      api.post('/auth/onboarding/reports-viewed/').catch(() => {})
    } catch (err) {
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        setBackendData(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReport(reportKey, startDate, endDate)
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
    }
  }, [reportKey, startDate, endDate, fetchReport])

  // Date Preset Handlers
  const handlePresetChange = p => {
    setPreset(p)
    const range = PRESET_RANGES[p]
    if (range) {
      setStartDate(range.start())
      setEndDate(range.end())
    }
  }

  const handleApplyCustomDates = () => {
    if (startDate > endDate) {
      toast.error('Start date cannot be after end date')
      return
    }
    setPreset('Custom')
    fetchReport(reportKey, startDate, endDate)
  }

  // EXACT PDF REPORT DATA RESOLUTION
  // Ensures the frontend shows the exact data & columns that get exported to PDF
  const reportData = useMemo(() => {
    if (backendData) {
      const backendHeaders = Array.isArray(backendData.headers) ? backendData.headers : []
      const rawRows = Array.isArray(backendData.rows)
        ? backendData.rows
        : Array.isArray(backendData.results)
        ? backendData.results
        : Array.isArray(backendData.customers)
        ? backendData.customers
        : Array.isArray(backendData.products)
        ? backendData.products
        : []

      if (backendHeaders.length > 0) {
        const rows = rawRows.map(r => {
          if (Array.isArray(r)) return r
          return backendHeaders.map(h => r[h] ?? r[h.toLowerCase().replace(/[\s/.-]+/g, '_')] ?? '')
        })

        return {
          title: backendData.title || report.label,
          headers: backendHeaders,
          rows,
          summaryRows: backendData.summary_rows || [],
        }
      }
    }

    const template = BACKEND_TEMPLATES[reportKey] || BACKEND_TEMPLATES.sales
    return {
      title: template.title,
      headers: template.headers,
      rows: template.rows,
      summaryRows: template.summaryRows || [],
    }
  }, [backendData, reportKey, report.label])

  // Column definitions with data type awareness
  const columns = useMemo(() => {
    return reportData.headers.map((label, idx) => ({
      idx,
      label,
      isMoney: isMonetaryCol(label),
      isNum: isNumericCol(label) && !isMonetaryCol(label),
      isStatus: isStatusCol(label),
      isMode: isModeCol(label),
      isTotal: isMonetaryCol(label) || isNumericCol(label),
    }))
  }, [reportData.headers])

  // Query & Sort Filtered Rows
  const filteredRows = useMemo(() => {
    let out = reportData.rows

    const q = query.trim().toLowerCase()
    if (q) {
      out = out.filter(row =>
        row.some(cell => String(cell ?? '').toLowerCase().includes(q))
      )
    }

    if (sort.colIdx !== null) {
      out = [...out].sort((a, b) => {
        const x = a[sort.colIdx]
        const y = b[sort.colIdx]
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
  }, [reportData.rows, query, sort])

  // Pagination
  const totalCount = filteredRows.length
  const actualPageSize = pageSize === 'all' ? Math.max(1, totalCount) : Number(pageSize)
  const pages = Math.max(1, Math.ceil(totalCount / actualPageSize))
  const current = Math.min(page, pages)
  const visibleRows = pageSize === 'all' ? filteredRows : filteredRows.slice((current - 1) * actualPageSize, current * actualPageSize)

  const toggleSort = colIdx => {
    setSort(s => (s.colIdx === colIdx ? { colIdx, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { colIdx, dir: 'asc' }))
  }

  // Calculate totals across rows for a column index
  const calcTotal = colIdx => {
    return filteredRows.reduce((acc, row) => {
      const val = Number(row[colIdx]) || 0
      return acc + val
    }, 0)
  }

  // Real Export Flow
  const exportAs = async type => {
    if (type === 'Print') {
      window.print()
      return
    }

    if (type === 'CSV') {
      try {
        const headers = reportData.headers
        const rows = filteredRows
        if (!headers.length || !rows.length) {
          toast.error('No records available')
          return
        }
        const escapeCell = v => `"${String(v ?? '').replace(/"/g, '""')}"`
        const csvContent = [
          headers.map(h => escapeCell(h)).join(','),
          ...rows.map(row => row.map(cell => escapeCell(cell)).join(',')),
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
        toast.success('CSV Downloaded')
      } catch {
        toast.error('Failed to export CSV')
      }
      return
    }

    const format = type === 'PDF' ? 'pdf' : 'xlsx'
    const endpoint = ENDPOINTS[reportKey] || `/reports/${reportKey}/`
    const toastId = toast.loading(`Generating ${type}...`)

    try {
      const params = new URLSearchParams()
      if (!isSnapshot) {
        params.set('start_date', startDate)
        params.set('end_date', endDate)
      }
      params.set('export', format)

      const response = await api.get(`${endpoint}?${params.toString()}`, { responseType: 'blob' })
      const mimeType = response.headers['content-type'] || (format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      const blob = new Blob([response.data], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${reportKey}_${startDate}_${endDate}.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`${type} downloaded`, { id: toastId })
    } catch {
      toast.error('Server export failed. Generating local CSV...', { id: toastId })
      exportAs('CSV')
    }
  }

  // Cell Renderer for Table
  const renderCell = (col, val) => {
    if (val === undefined || val === null || val === '') return '—'

    if (col.isMoney) {
      return inr(val)
    }

    if (col.isNum && typeof val === 'number') {
      return num(val)
    }

    if (col.isStatus) {
      const s = String(val).toUpperCase()
      const isOk = s === 'PAID' || s === 'IN STOCK' || s === 'ACTIVE'
      const isWarn = s === 'PARTIAL' || s === 'LOW' || s === 'DUE SOON'
      const isBad = s === 'UNPAID' || s === 'DUE' || s === 'OVERDUE' || s === 'OUT OF STOCK'

      const toneClass = isOk
        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
        : isWarn
        ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300'
        : isBad
        ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300'
        : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'

      return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${toneClass}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-85" />
          {val}
        </span>
      )
    }

    if (col.isMode) {
      const m = String(val).toUpperCase()
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--surface-elevated)] border border-[var(--line)]">
          {m}
        </span>
      )
    }

    return String(val)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.75rem)] w-full overflow-hidden text-[var(--ink)]">
      {/* ==================================================================
          1. SIMPLE, SINGLE-ROW TOP AREA (No categories on top, pure space utilization)
      =================================================================== */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--line)] pb-2.5">
        {/* Title & Live Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--ink)] truncate">
            {reportData.title}
          </h1>
          {loading ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary)] text-[var(--primary-contrast)]">
              <IconRefresh size={11} className="animate-spin" />
              Syncing…
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
          )}
        </div>

        {/* Date Range Presets & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Presets */}
          <div className="hidden md:flex items-center rounded-lg bg-[var(--surface-subtle)] p-0.5 border border-[var(--line-subtle)]">
            {PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => handlePresetChange(p)}
                className={`h-7 px-2.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                  preset === p
                    ? 'bg-[var(--primary)] text-[var(--primary-contrast)] shadow-2xs font-bold'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {!isSnapshot ? (
            <div className="flex items-center gap-1.5 text-xs">
              <IconCalendar size={14} className="text-[var(--muted)] hidden sm:inline" />
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                aria-label="Start date"
                className="h-7.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 font-mono text-xs outline-none focus:border-[var(--primary)]"
              />
              <span className="text-[var(--muted)] text-[11px]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                aria-label="End date"
                className="h-7.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 font-mono text-xs outline-none focus:border-[var(--primary)]"
              />
              <button
                type="button"
                onClick={handleApplyCustomDates}
                className="h-7.5 px-2.5 rounded-lg bg-[var(--primary)] text-[var(--primary-contrast)] font-bold text-xs hover:bg-[var(--primary-hover)] transition cursor-pointer shadow-2xs"
              >
                Apply
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-mono text-[var(--muted)] hidden sm:flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live as of Today
            </span>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchReport(reportKey, startDate, endDate)}
            disabled={loading}
            className="inline-flex h-7.5 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] transition cursor-pointer shadow-2xs"
            title="Refresh"
          >
            <IconRefresh size={13} className={loading ? 'animate-spin text-[var(--primary)]' : 'text-[var(--muted)]'} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {/* Simple Clean Export Button */}
          <div className="relative inline-block text-left" ref={exportRef}>
            <button
              type="button"
              onClick={() => setExportOpen(v => !v)}
              className="inline-flex h-7.5 items-center gap-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-contrast)] px-3 text-xs font-bold shadow-2xs hover:bg-[var(--primary-hover)] transition cursor-pointer"
            >
              <IconDownload size={14} />
              <span>Export</span>
              <IconChevronDown
                size={13}
                className={`transition-transform duration-150 ${exportOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {exportOpen && (
              <div className="absolute right-0 z-30 mt-1.5 w-44 origin-top-right rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1 shadow-xl ring-1 ring-black/5 animate-in fade-in duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false)
                    exportAs('PDF')
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <IconFileTypePdf size={15} className="text-rose-600" />
                  <span>PDF Document</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false)
                    exportAs('Excel')
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <IconFileSpreadsheet size={15} className="text-emerald-600" />
                  <span>Excel Spreadsheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false)
                    exportAs('CSV')
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <IconDownload size={15} className="text-[var(--muted)]" />
                  <span>CSV File</span>
                </button>
                <div className="my-1 border-t border-[var(--line-subtle)]" />
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false)
                    exportAs('Print')
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <IconPrinter size={15} className="text-[var(--primary)]" />
                  <span>Print Statement</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================
          2. TWO INDIVIDUALLY SCROLLING SIDES (Left Directory & Right Ledger)
      =================================================================== */}
      <div className="flex-1 min-h-0 pt-2 grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] gap-3 overflow-hidden">
        {/* ---------------------------------------------------------------
            LEFT SIDE: Independent Scrollable Reports Directory
        ---------------------------------------------------------------- */}
        <aside className="hidden lg:flex flex-col h-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-2xs">
          <div className="px-3 py-2 border-b border-[var(--line-subtle)] bg-[var(--surface-elevated)] shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Reports Directory</span>
            <div className="text-xs font-bold text-[var(--ink)]">{ALL_REPORTS.length} Available Statements</div>
          </div>

          {/* Left panel independent vertical scroll */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-thin">
            {NAV_CATEGORIES.map(cat => {
              const catReports = ALL_REPORTS.filter(r => r.category === cat.key)
              if (catReports.length === 0) return null
              const Icon = cat.icon

              return (
                <div key={cat.key} className="space-y-1">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                    <Icon size={12} className="text-[var(--primary)]" />
                    <span>{cat.label}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {catReports.map(r => {
                      const active = r.key === reportKey
                      return (
                        <li key={r.key}>
                          <button
                            type="button"
                            onClick={() => {
                              setReportKey(r.key)
                              setPage(1)
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition cursor-pointer ${
                              active
                                ? 'bg-[var(--primary)] text-[var(--primary-contrast)] font-bold shadow-2xs'
                                : 'text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]'
                            }`}
                          >
                            <span className="truncate pr-1">{r.label}</span>
                            {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary-contrast)]" />}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        </aside>

        {/* ---------------------------------------------------------------
            RIGHT SIDE: Independent Scrollable Data Workspace
        ---------------------------------------------------------------- */}
        <main className="flex flex-col h-full overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-2xs p-3">
          {/* Mobile Select Report Dropdown */}
          <div className="lg:hidden shrink-0 pb-2">
            <select
              value={reportKey}
              onChange={e => {
                setReportKey(e.target.value)
                setPage(1)
              }}
              className="h-9 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] outline-none focus:border-[var(--primary)]"
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

          {/* Table Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0 pb-2.5">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
              <div className="relative w-full">
                <IconSearch
                  size={14}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Filter records..."
                  aria-label="Filter records"
                  className="h-8 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] pl-8 pr-7 text-xs outline-none focus:border-[var(--primary)]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      setPage(1)
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                  >
                    <IconX size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Right side toolbar items: Rows per page & Mobile View Toggle */}
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
              {/* Mobile View Toggle */}
              <div className="flex sm:hidden items-center rounded-lg bg-[var(--surface-subtle)] p-0.5 border border-[var(--line-subtle)]">
                <button
                  type="button"
                  onClick={() => setMobileView('cards')}
                  className={`px-2 py-1 text-[11px] font-bold rounded-md transition ${
                    mobileView === 'cards'
                      ? 'bg-[var(--primary)] text-[var(--primary-contrast)] shadow-2xs'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  <IconLayoutGrid size={12} className="inline mr-1" /> Cards
                </button>
                <button
                  type="button"
                  onClick={() => setMobileView('table')}
                  className={`px-2 py-1 text-[11px] font-bold rounded-md transition ${
                    mobileView === 'table'
                      ? 'bg-[var(--primary)] text-[var(--primary-contrast)] shadow-2xs'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  <IconTable size={12} className="inline mr-1" /> Table
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-1.5">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(e.target.value)
                    setPage(1)
                  }}
                  className="h-7.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-xs font-semibold text-[var(--ink)] outline-none focus:border-[var(--primary)]"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value="all">All</option>
                </select>
              </div>
              <span className="font-mono text-[11px]">{filteredRows.length} entries</span>
            </div>
          </div>

          {/* -------------------------------------------------------------
              RIGHT SIDE MAIN DATA PANE:
              Independent Vertical and Horizontal Scroll for Table
          -------------------------------------------------------------- */}
          <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-2xs">
            {/* Mobile Cards View */}
            <div className={`sm:hidden flex-1 overflow-y-auto p-2.5 space-y-2 scrollbar-thin ${mobileView === 'cards' ? 'block' : 'hidden'}`}>
              {loading ? (
                <div className="py-12 text-center text-xs text-[var(--muted)]">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-[var(--primary)] border-r-transparent"></div>
                  <p className="mt-2 font-bold text-[var(--ink)]">Loading statement data…</p>
                </div>
              ) : visibleRows.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--muted)]">
                  No matching statement entries found.
                </div>
              ) : (
                visibleRows.map((row, i) => (
                  <div
                    key={i}
                    onClick={() => setInspectRecord(row)}
                    className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-2xs active:bg-[var(--surface-hover)] transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-xs font-bold text-[var(--primary)]">
                          {String(row[1] || row[0] || `Row #${i + 1}`)}
                        </span>
                        <p className="text-xs font-bold text-[var(--ink)] truncate mt-0.5">
                          {String(row[2] || row[1] || row[0] || '—')}
                        </p>
                        <p className="text-[11px] text-[var(--muted)] mt-0.5">{String(row[0] || '—')}</p>
                      </div>

                      {/* Primary Amount / Value on right of card */}
                      <div className="flex flex-col items-end shrink-0">
                        <span className="font-mono text-sm font-bold text-[var(--ink)]">
                          {columns.some(c => c.isMoney)
                            ? inr(row[columns.findIndex(c => c.isMoney)] || 0)
                            : String(row[row.length - 1] ?? '—')}
                        </span>
                        {columns.some(c => c.isStatus) && (
                          <div className="mt-1">
                            {renderCell(
                              columns.find(c => c.isStatus),
                              row[columns.findIndex(c => c.isStatus)]
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop & Mobile Scrollable Table (WITHOUT View button column) */}
            <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-auto scrollbar-thin ${mobileView === 'cards' ? 'hidden sm:block' : 'block'}`}>
              <table className="w-full min-w-[650px] border-collapse text-left text-xs sm:text-[13px]">
                {/* Pinned Sticky THEAD */}
                <thead className="sticky top-0 z-20 bg-[var(--surface-elevated)] backdrop-blur-md border-b border-[var(--line)] text-[var(--muted)] shadow-2xs">
                  <tr>
                    {columns.map(col => (
                      <th
                        key={col.idx}
                        scope="col"
                        className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider ${
                          col.isMoney || col.isNum ? 'text-right' : 'text-left'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(col.idx)}
                          className={`inline-flex items-center gap-1.5 hover:text-[var(--ink)] transition cursor-pointer select-none ${
                            col.isMoney || col.isNum ? 'flex-row-reverse' : ''
                          }`}
                        >
                          <span>{col.label}</span>
                          <IconSelector
                            size={13}
                            className={sort.colIdx === col.idx ? 'text-[var(--primary)] opacity-100' : 'opacity-35'}
                          />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {loading ? (
                    <tr>
                      <td colSpan={columns.length} className="px-3 py-16 text-center text-xs text-[var(--muted)]">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-[var(--primary)] border-r-transparent"></div>
                        <p className="mt-2 font-bold text-[var(--ink)]">Loading exact statement data…</p>
                      </td>
                    </tr>
                  ) : visibleRows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-3 py-12 text-center text-xs text-[var(--muted)]">
                        <p className="font-bold text-[var(--ink)]">No statement records match your criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    visibleRows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        onClick={() => setInspectRecord(row)}
                        className="transition-colors hover:bg-[var(--surface-hover)] cursor-pointer"
                      >
                        {columns.map(col => (
                          <td
                            key={col.idx}
                            className={`whitespace-nowrap px-3 py-2.5 ${
                              col.isMoney || col.isNum ? 'text-right font-mono tabular-nums' : 'text-left'
                            } ${col.isMoney ? 'font-semibold text-[var(--ink)]' : ''}`}
                          >
                            {renderCell(col, row[col.idx])}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>

                {/* Sticky TFOOT for Exact Totals */}
                {columns.some(c => c.isTotal) && filteredRows.length > 0 && (
                  <tfoot className="sticky bottom-0 z-20 bg-[var(--surface-elevated)] backdrop-blur-md border-t-2 border-[var(--line)] shadow-2xs">
                    <tr>
                      {columns.map((col, i) => (
                        <td
                          key={col.idx}
                          className={`whitespace-nowrap px-3 py-2.5 text-xs font-bold ${
                            col.isMoney || col.isNum
                              ? 'text-right font-mono tabular-nums text-[var(--primary)]'
                              : 'text-left text-[var(--ink)]'
                          }`}
                        >
                          {i === 0
                            ? `Totals (${filteredRows.length})`
                            : col.isTotal
                            ? col.isMoney
                              ? inr(calcTotal(col.idx))
                              : num(calcTotal(col.idx))
                            : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Right Side Pagination Footer */}
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-[var(--muted)] sm:flex-row pt-2 shrink-0">
            <span>
              Showing{' '}
              <strong className="text-[var(--ink)] font-mono">
                {filteredRows.length === 0 ? 0 : (current - 1) * actualPageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-[var(--ink)] font-mono">
                {Math.min(current * actualPageSize, filteredRows.length)}
              </strong>{' '}
              of <strong className="text-[var(--ink)] font-mono">{filteredRows.length}</strong> records
            </span>

            {pageSize !== 'all' && pages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={current === 1}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)] disabled:opacity-35 hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  «
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={current === 1}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)] disabled:opacity-35 hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <IconChevronLeft size={13} />
                </button>

                <span className="px-2 font-mono font-bold text-[var(--ink)] text-xs">
                  {current} / {pages}
                </span>

                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={current === pages}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)] disabled:opacity-35 hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  <IconChevronRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(pages)}
                  disabled={current === pages}
                  className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)] disabled:opacity-35 hover:bg-[var(--surface-hover)] cursor-pointer"
                >
                  »
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Record Inspect Modal */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5 bg-[var(--surface-elevated)]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Statement Inspection</span>
                <h3 className="text-sm font-bold text-[var(--ink)] truncate">
                  {String(inspectRecord[1] || inspectRecord[0] || 'Statement Row')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectRecord(null)}
                className="grid h-7 w-7 place-items-center rounded-lg border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-hover)] transition cursor-pointer"
              >
                <IconX size={15} />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {columns.map(col => {
                  const val = inspectRecord[col.idx]
                  if (val === undefined || val === null || val === '') return null
                  return (
                    <div key={col.idx} className="rounded-lg border border-[var(--line-subtle)] p-2 bg-[var(--surface)]">
                      <div className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">{col.label}</div>
                      <div className="mt-1 font-mono font-medium text-[var(--ink)] break-words">
                        {renderCell(col, val)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="border-t border-[var(--line)] px-5 py-3 flex justify-end bg-[var(--surface-elevated)]">
              <button
                type="button"
                onClick={() => setInspectRecord(null)}
                className="h-8 px-4 rounded-lg bg-[var(--primary)] text-[var(--primary-contrast)] text-xs font-bold hover:bg-[var(--primary-hover)] cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
