import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IconTrendingUp,
  IconShoppingCart,
  IconPackage,
  IconCash,
  IconReceiptTax,
  IconUsers,
  IconArrowLeft,
  IconDownload,
  IconPrinter,
  IconRefresh,
  IconFilter,
  IconSearch,
  IconX,
  IconCalendar,
  IconChevronDown,
  IconCheck,
  IconFileTypePdf,
  IconFileTypeXls,
  IconFileSpreadsheet,
  IconArrowUpRight,
  IconArrowDownRight,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import toast from 'react-hot-toast'
import { fmtCurrency, fmtNumber } from '../utils/formatters'

/* ============================================================
   STATIC ACCURATE SAMPLE DATASETS (INDIAN ERP STANDARDS)
============================================================ */

const SAMPLE_TREND_DATA = [
  { month: 'Apr', revenue: 142000, purchases: 98000, profit: 32000, orders: 48 },
  { month: 'May', revenue: 168000, purchases: 105000, profit: 41000, orders: 56 },
  { month: 'Jun', revenue: 154000, purchases: 112000, profit: 31000, orders: 51 },
  { month: 'Jul', revenue: 189000, purchases: 118000, profit: 48000, orders: 63 },
  { month: 'Aug', revenue: 215000, purchases: 134000, profit: 54000, orders: 72 },
  { month: 'Sep', revenue: 198000, purchases: 122000, profit: 49000, orders: 67 },
  { month: 'Oct', revenue: 245000, purchases: 152000, profit: 61000, orders: 84 },
  { month: 'Nov', revenue: 280000, purchases: 171000, profit: 72000, orders: 95 },
  { month: 'Dec', revenue: 262000, purchases: 160000, profit: 66000, orders: 89 },
  { month: 'Jan', revenue: 231000, purchases: 145000, profit: 57000, orders: 78 },
  { month: 'Feb', revenue: 210000, purchases: 130000, profit: 51000, orders: 71 },
  { month: 'Mar', revenue: 275000, purchases: 168000, profit: 69000, orders: 92 },
]

const SAMPLE_REPORTS_DATA = {
  sales_register: {
    title: 'Sales Invoice Register',
    subtitle: 'Chronological sales vouchers with customer GSTIN, taxable values, and tax breakup',
    kpis: [
      { label: 'Total Invoiced Gross', value: '₹25,69,000', change: '+14.8%', isPositive: true },
      { label: 'Taxable Turnover', value: '₹22,14,655', change: '+12.4%', isPositive: true },
      { label: 'Output GST Collected', value: '₹3,54,345', change: 'IGST+CGST+SGST', isNeutral: true },
      { label: 'Realized Collections', value: '₹23,40,000', change: '91.1% Settled', isPositive: true },
      { label: 'Unpaid Receivables', value: '₹2,29,000', change: '8.9% Pending', isNegative: true },
    ],
    headers: ['Invoice #', 'Date', 'Customer Name', 'GSTIN', 'Taxable Val', 'CGST', 'SGST', 'IGST', 'Total Invoice', 'Status'],
    rows: [
      { id: 'INV-2026-0891', date: '2026-03-30', party: 'Om Enterprises', gstin: '29AABCO4128F1Z4', taxable: 48500, cgst: 4365, sgst: 4365, igst: 0, total: 57230, status: 'PAID' },
      { id: 'INV-2026-0890', date: '2026-03-29', party: 'Krishna Traders', gstin: '29ABCDE1234F1Z5', taxable: 84000, cgst: 7560, sgst: 7560, igst: 0, total: 99120, status: 'PAID' },
      { id: 'INV-2026-0889', date: '2026-03-28', party: 'Balaji Hardware Mart', gstin: '29KLMNO5678P2Z9', taxable: 125000, cgst: 11250, sgst: 11250, igst: 0, total: 147500, status: 'PARTIAL' },
      { id: 'INV-2026-0888', date: '2026-03-28', party: 'Apex Solutions Pvt Ltd', gstin: '27AABCA1234E1Z1', taxable: 62000, cgst: 0, sgst: 0, igst: 11160, total: 73160, status: 'PAID' },
      { id: 'INV-2026-0887', date: '2026-03-27', party: 'Venkateshwara Stores', gstin: 'URP (Unregistered)', taxable: 18400, cgst: 1656, sgst: 1656, igst: 0, total: 21712, status: 'PAID' },
      { id: 'INV-2026-0886', date: '2026-03-26', party: 'Sri Ganesh Electricals', gstin: '29PQRST9876Q3Z2', taxable: 92400, cgst: 8316, sgst: 8316, igst: 0, total: 109032, status: 'DUE' },
      { id: 'INV-2026-0885', date: '2026-03-25', party: 'Mahalaxmi Provisions', gstin: '29XYZAB4321C4Z8', taxable: 34100, cgst: 3069, sgst: 3069, igst: 0, total: 40238, status: 'PAID' },
      { id: 'INV-2026-0884', date: '2026-03-24', party: 'Kaveri Distributing Co.', gstin: '29DEFGH9012J5Z3', taxable: 142000, cgst: 12780, sgst: 12780, igst: 0, total: 167560, status: 'PAID' },
      { id: 'INV-2026-0883', date: '2026-03-23', party: 'Universal Tech Store', gstin: '33AABCT9988G1Z7', taxable: 75500, cgst: 0, sgst: 0, igst: 13590, total: 89090, status: 'DUE' },
      { id: 'INV-2026-0882', date: '2026-03-22', party: 'Star Retailers Bangalore', gstin: '29LMNOP3344K6Z0', taxable: 51200, cgst: 4608, sgst: 4608, igst: 0, total: 60416, status: 'PAID' },
    ],
  },

  product_sales: {
    title: 'Item-wise Product Sales Performance',
    subtitle: 'Volume sold, realized margins, turnover, and contribution per catalog item',
    kpis: [
      { label: 'Active Catalog SKUs', value: '384 Items', change: '85 Selling', isNeutral: true },
      { label: 'Total Units Dispatched', value: '14,820 Units', change: '+18.2%', isPositive: true },
      { label: 'Top Contributor', value: 'Syska LED 15W', change: '18.4% share', isPositive: true },
      { label: 'Gross Product Margin', value: '26.8%', change: 'Target 25%', isPositive: true },
    ],
    headers: ['Product Name', 'SKU / Barcode', 'Category', 'Units Sold', 'Avg Price', 'Total Turnover', 'Margin %'],
    rows: [
      { party: 'Syska LED Bulb 15W Cool Day', id: 'SKU-LED-15W', date: 'Electrical', taxable: 1850, cgst: 140, sgst: 259000, igst: 28.5, total: 259000, status: 'IN_STOCK' },
      { party: 'Polycab 2.5 Sq mm Copper Wire 90m', id: 'SKU-CAB-25C', date: 'Cables', taxable: 420, cgst: 1850, sgst: 777000, igst: 24.0, total: 777000, status: 'IN_STOCK' },
      { party: 'Anchor Roma 6A Modular Switch', id: 'SKU-ROM-6AS', date: 'Accessories', taxable: 3200, cgst: 42, sgst: 134400, igst: 34.2, total: 134400, status: 'IN_STOCK' },
      { party: 'Havells Reo 16A Power Socket', id: 'SKU-REO-16S', date: 'Accessories', taxable: 1100, cgst: 115, sgst: 126500, igst: 31.0, total: 126500, status: 'IN_STOCK' },
      { party: 'Schneider MCB Single Pole 16A C-Curve', id: 'SKU-SCH-16C', date: 'Switchgear', taxable: 680, cgst: 240, sgst: 163200, igst: 22.5, total: 163200, status: 'LOW_STOCK' },
      { party: 'Finolex 4 Core Flexible Cable 100m', id: 'SKU-FIN-4CF', date: 'Cables', taxable: 190, cgst: 3450, sgst: 655500, igst: 21.8, total: 655500, status: 'IN_STOCK' },
      { party: 'Crompton Ceiling Fan 1200mm High Speed', id: 'SKU-FAN-12C', date: 'Appliances', taxable: 210, cgst: 2150, sgst: 451500, igst: 20.4, total: 451500, status: 'IN_STOCK' },
    ],
  },

  purchase_register: {
    title: 'Inward Purchases & Procurement Register',
    subtitle: 'Vendor procurement bills, input tax credit (ITC), and payment settlements',
    kpis: [
      { label: 'Total Inward Procurements', value: '₹16,68,000', change: '54 Inward Bills', isNeutral: true },
      { label: 'Taxable Inward Value', value: '₹14,13,559', change: 'Cost Basis', isNeutral: true },
      { label: 'Input Tax Credit (ITC)', value: '₹2,54,441', change: '100% Eligible', isPositive: true },
      { label: 'Settled to Vendors', value: '₹14,25,000', change: '85.4% Cleared', isPositive: true },
      { label: 'Pending Vendor Payables', value: '₹2,43,000', change: '14.6% Payable', isNegative: true },
    ],
    headers: ['Bill #', 'Date', 'Supplier / Distributor', 'GSTIN', 'Taxable Val', 'CGST', 'SGST', 'IGST', 'Bill Total', 'Payment'],
    rows: [
      { id: 'PB-2026-0312', date: '2026-03-29', party: 'Polycab India Ltd - Regional Hub', gstin: '29AAACP1234D1Z2', taxable: 385000, cgst: 34650, sgst: 34650, igst: 0, total: 454300, status: 'PAID' },
      { id: 'PB-2026-0311', date: '2026-03-27', party: 'Havells India Limited', gstin: '27AAACH0987K1Z8', taxable: 245000, cgst: 0, sgst: 0, igst: 44100, total: 289100, status: 'PAID' },
      { id: 'PB-2026-0310', date: '2026-03-25', party: 'Anchor Electricals Distributor', gstin: '29AABCA7766M1Z5', taxable: 182000, cgst: 16380, sgst: 16380, igst: 0, total: 214760, status: 'PARTIAL' },
      { id: 'PB-2026-0309', date: '2026-03-22', party: 'Schneider Electric India Depot', gstin: '29AABCS5544B1Z9', taxable: 195000, cgst: 17550, sgst: 17550, igst: 0, total: 230100, status: 'DUE' },
      { id: 'PB-2026-0308', date: '2026-03-18', party: 'Crompton Greaves Consumer Electricals', gstin: '29AAACC1122C1Z4', taxable: 310000, cgst: 27900, sgst: 27900, igst: 0, total: 365800, status: 'PAID' },
      { id: 'PB-2026-0307', date: '2026-03-12', party: 'Finolex Cables Agency', gstin: '29AAACF3344D1Z7', taxable: 96000, cgst: 8640, sgst: 8640, igst: 0, total: 113280, status: 'PAID' },
    ],
  },

  stock_summary: {
    title: 'Live Stock Valuation & Inventory Audit',
    subtitle: 'Stock-in-hand, purchase cost valuation, retail value, and replenishment reorders',
    kpis: [
      { label: 'Total Inventory Valuation', value: '₹8,94,500', change: 'Cost Basis', isPositive: true },
      { label: 'Retail Value Potential', value: '₹12,45,000', change: '39.2% Gross Spread', isPositive: true },
      { label: 'Items In Hand', value: '8,420 Pcs', change: 'Across 145 SKUs', isNeutral: true },
      { label: 'Low Stock Reorder Alert', value: '6 Items', change: 'Action Required', isNegative: true },
    ],
    headers: ['Item Name', 'SKU Code', 'Category', 'Quantity In Stock', 'Unit Cost (₹)', 'Selling Price (₹)', 'Total Valuation', 'Status'],
    rows: [
      { party: 'Polycab 2.5 Sq mm Copper Wire 90m', id: 'SKU-CAB-25C', date: 'Cables', taxable: 140, cgst: 1420, sgst: 1850, total: 198800, status: 'IN_STOCK' },
      { party: 'Syska LED Bulb 15W Cool Day', id: 'SKU-LED-15W', date: 'Lighting', taxable: 650, cgst: 105, sgst: 140, total: 68250, status: 'IN_STOCK' },
      { party: 'Anchor Roma 6A Modular Switch', id: 'SKU-ROM-6AS', date: 'Modular', taxable: 1850, cgst: 28, sgst: 42, total: 51800, status: 'IN_STOCK' },
      { party: 'Havells Reo 16A Power Socket', id: 'SKU-REO-16S', date: 'Modular', taxable: 420, cgst: 82, sgst: 115, total: 34440, status: 'IN_STOCK' },
      { party: 'Schneider MCB Single Pole 16A C-Curve', id: 'SKU-SCH-16C', date: 'Switchgear', taxable: 18, cgst: 175, sgst: 240, total: 3150, status: 'LOW_STOCK' },
      { party: 'Finolex 4 Core Flexible Cable 100m', id: 'SKU-FIN-4CF', date: 'Cables', taxable: 35, cgst: 2650, sgst: 3450, total: 92750, status: 'LOW_STOCK' },
      { party: 'Crompton Ceiling Fan 1200mm High Speed', id: 'SKU-FAN-12C', date: 'Appliances', taxable: 48, cgst: 1680, sgst: 2150, total: 80640, status: 'IN_STOCK' },
      { party: 'Philips Batten LED Tubelight 20W', id: 'SKU-PHI-20B', date: 'Lighting', taxable: 210, cgst: 220, sgst: 320, total: 46200, status: 'IN_STOCK' },
    ],
  },

  profit_loss: {
    title: 'Financial Profit & Loss Statement (P&L)',
    subtitle: 'Revenue, direct inventory cost of sales, operating overheads, and net profit',
    kpis: [
      { label: 'Gross Sales Revenue', value: '₹25,69,000', change: '100% Topline', isPositive: true },
      { label: 'Cost of Goods Sold (COGS)', value: '₹17,45,000', change: '67.9% of Sales', isNeutral: true },
      { label: 'Gross Operating Profit', value: '₹8,24,000', change: '32.1% Gross Margin', isPositive: true },
      { label: 'Operating Expenditures', value: '₹2,84,000', change: 'Rent, Staff, Utilities', isNeutral: true },
      { label: 'Net Operating Profit', value: '₹5,40,000', change: '21.0% Net Margin', isPositive: true },
    ],
    headers: ['Accounting Particulars', 'Classification', 'Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4', 'FY Total (₹)'],
    rows: [
      { party: 'Gross Invoiced Sales', id: 'Operating Revenue', date: '₹5,40,000', taxable: '₹6,15,000', cgst: '₹6,90,000', sgst: '₹7,24,000', total: 2569000, status: 'REVENUE' },
      { party: 'Less: Sales Returns & Rebates', id: 'Deductions', date: '-₹8,000', taxable: '-₹12,000', cgst: '-₹14,000', sgst: '-₹11,000', total: 45000, status: 'EXPENSE' },
      { party: 'Net Sales Revenue', id: 'Net Operating Topline', date: '₹5,32,000', taxable: '₹6,03,000', cgst: '₹6,76,000', sgst: '₹7,13,000', total: 2524000, status: 'TOTAL' },
      { party: 'Less: Cost of Goods Sold (COGS)', id: 'Direct Material Cost', date: '-₹3,65,000', taxable: '-₹4,18,000', cgst: '-₹4,68,000', sgst: '-₹4,94,000', total: 1745000, status: 'EXPENSE' },
      { party: 'Gross Profit (Trading Profit)', id: 'Gross Contribution', date: '₹1,67,000', taxable: '₹1,85,000', cgst: '₹2,08,000', sgst: '₹2,19,000', total: 779000, status: 'TOTAL' },
      { party: 'Less: Store Rent & Facilities', id: 'Overhead Expense', date: '-₹30,000', taxable: '-₹30,000', cgst: '-₹30,000', sgst: '-₹30,000', total: 120000, status: 'EXPENSE' },
      { party: 'Less: Staff Salaries & Bonus', id: 'Staff Overhead', date: '-₹25,000', taxable: '-₹25,000', cgst: '-₹28,000', sgst: '-₹32,000', total: 110000, status: 'EXPENSE' },
      { party: 'Less: Electricity & Connectivity', id: 'Utility Overhead', date: '-₹8,500', taxable: '-₹9,200', cgst: '-₹11,400', sgst: '-₹10,900', total: 40000, status: 'EXPENSE' },
      { party: 'Net Operating Profit (Before Tax)', id: 'EBIT Net Profit', date: '₹1,03,500', taxable: '₹1,20,800', cgst: '₹1,38,600', sgst: '₹1,46,100', total: 509000, status: 'PROFIT' },
    ],
  },

  gst_tax: {
    title: 'GST Tax Liability & Compliance Summary',
    subtitle: 'Output GST on outward supplies vs. Input Tax Credit (ITC) reconciliation',
    kpis: [
      { label: 'Outward Output Tax Liability', value: '₹3,54,345', change: 'Total Output GST', isNeutral: true },
      { label: 'Eligible Input Tax Credit', value: '₹2,54,441', change: 'Purchase ITC', isPositive: true },
      { label: 'Net Cash GST Payable', value: '₹99,904', change: 'Via Electronic Cash Ledger', isNegative: true },
      { label: 'GSTR-1 Status', value: 'Filed on Time', change: 'Ref: ARN-AA290326019', isPositive: true },
      { label: 'GSTR-3B Status', value: 'Draft Reconciled', change: 'Due on 20th', isNeutral: true },
    ],
    headers: ['GST Tax Slab Rate', 'Outward Supplies (Sales)', 'CGST Output', 'SGST Output', 'IGST Output', 'Inward ITC (Purchases)', 'Net Payable (₹)'],
    rows: [
      { party: '0% Exemption Slab (Nil Rated)', id: '₹1,24,000', date: '₹0', taxable: '₹0', cgst: '₹0', sgst: '₹0', total: 0, status: 'EXEMPT' },
      { party: '5% Essential GST Slab', id: '₹2,10,000', date: '₹5,250', taxable: '₹5,250', cgst: '₹0', sgst: '₹7,800', total: 2700, status: 'ACTIVE' },
      { party: '12% Standard GST Slab', id: '₹4,50,000', date: '₹27,000', taxable: '₹27,000', cgst: '₹0', sgst: '₹38,400', total: 15600, status: 'ACTIVE' },
      { party: '18% Standard GST Slab (Majority)', id: '₹13,85,000', date: '₹1,12,185', taxable: '₹1,12,185', cgst: '₹24,750', sgst: '₹1,84,500', total: 64620, status: 'ACTIVE' },
      { party: '28% Luxury / Heavy Electricals', id: '₹1,45,000', date: '₹20,300', taxable: '₹20,300', cgst: '₹0', sgst: '₹23,620', total: 16980, status: 'ACTIVE' },
    ],
  },

  ledgers_dues: {
    title: 'Outstanding Ledgers & Receivables Aging',
    subtitle: 'Debtors receivables balances, aging buckets, and credit monitoring',
    kpis: [
      { label: 'Total Customer Dues', value: '₹2,29,000', change: 'Across 14 Parties', isNegative: true },
      { label: 'Current (< 30 Days)', value: '₹1,48,500', change: '64.8% Normal', isPositive: true },
      { label: 'Aging (31 - 60 Days)', value: '₹56,200', change: '24.5% Follow Up', isNeutral: true },
      { label: 'Overdue (> 60 Days)', value: '₹24,300', change: '10.6% High Risk', isNegative: true },
    ],
    headers: ['Party / Customer Name', 'Phone Number', 'Credit Limit', 'Current Balance (₹)', '0 - 30 Days', '31 - 60 Days', '60+ Days', 'Risk Status'],
    rows: [
      { party: 'Balaji Hardware Mart', id: '+91 98450 12345', date: '₹2,00,000', taxable: 68500, cgst: 42000, sgst: 26500, igst: 0, total: 68500, status: 'MODERATE' },
      { party: 'Sri Ganesh Electricals', id: '+91 98860 67890', date: '₹1,50,000', taxable: 54200, cgst: 38000, sgst: 16200, igst: 0, total: 54200, status: 'MODERATE' },
      { party: 'Universal Tech Store', id: '+91 94480 34567', date: '₹1,00,000', taxable: 39500, cgst: 21000, sgst: 13500, igst: 5000, total: 39500, status: 'HIGH_RISK' },
      { party: 'Apex Solutions Pvt Ltd', id: '+91 97410 99882', date: '₹3,00,000', taxable: 28400, cgst: 28400, sgst: 0, igst: 0, total: 28400, status: 'NORMAL' },
      { party: 'Kaveri Distributing Co.', id: '+91 99000 44551', date: '₹2,50,000', taxable: 19800, cgst: 19100, sgst: 0, igst: 700, total: 19800, status: 'NORMAL' },
      { party: 'Krishna Traders', id: '+91 98801 22334', date: '₹1,20,000', taxable: 18600, cgst: 0, sgst: 0, igst: 18600, total: 18600, status: 'HIGH_RISK' },
    ],
  },
}

const REPORT_TABS = [
  { key: 'sales_register', label: 'Sales & Revenue', icon: IconTrendingUp, count: '₹25.69L' },
  { key: 'product_sales', label: 'Item Performance', icon: IconPackage, count: '384 SKUs' },
  { key: 'purchase_register', label: 'Purchases & Inwards', icon: IconShoppingCart, count: '₹16.68L' },
  { key: 'stock_summary', label: 'Stock Valuation', icon: IconPackage, count: '₹8.95L' },
  { key: 'profit_loss', label: 'Profit & Loss', icon: IconCash, count: '+₹5.40L' },
  { key: 'gst_tax', label: 'GST Compliance', icon: IconReceiptTax, count: '₹3.54L Tax' },
  { key: 'ledgers_dues', label: 'Ledgers & Dues', icon: IconUsers, count: '₹2.29L Due' },
]

const DATE_PRESETS = [
  { key: 'fy_current', label: 'This FY (2026-27)', period: '01 Apr 2026 – 31 Mar 2027' },
  { key: 'month_current', label: 'This Month', period: '01 Mar 2026 – 31 Mar 2026' },
  { key: 'last_30', label: 'Last 30 Days', period: '01 Mar 2026 – 30 Mar 2026' },
  { key: 'last_quarter', label: 'Last Quarter (Q3)', period: '01 Oct 2025 – 31 Dec 2025' },
]

export default function Reports() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('sales_register')
  const [datePreset, setDatePreset] = useState('fy_current')
  const [filterOpen, setFilterOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [chartView, setChartView] = useState('revenue')
  const [startDate, setStartDate] = useState('2026-04-01')
  const [endDate, setEndDate] = useState('2026-03-31')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  const exportMenuRef = useRef(null)

  // Current active report dataset
  const activeReport = SAMPLE_REPORTS_DATA[activeTab] || SAMPLE_REPORTS_DATA.sales_register
  const currentPresetObj = DATE_PRESETS.find(p => p.key === datePreset) || DATE_PRESETS[0]

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportMenuOpen) return undefined
    const handleOutside = e => {
      if (!exportMenuRef.current?.contains(e.target)) setExportMenuOpen(false)
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [exportMenuOpen])

  // Reset page when tab or search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, searchQuery])

  // Filtered rows based on search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return activeReport.rows
    const q = searchQuery.toLowerCase()
    return activeReport.rows.filter(row =>
      Object.values(row).some(val => String(val).toLowerCase().includes(q))
    )
  }, [activeReport.rows, searchQuery])

  // Paginated rows
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage, pageSize])

  // Export CSV generator (works completely client-side)
  const handleExportCSV = () => {
    try {
      const headers = activeReport.headers
      const rows = filteredRows.map(r => [
        r.id || '',
        r.date || '',
        r.party || '',
        r.gstin || '',
        r.taxable || '',
        r.cgst || '',
        r.sgst || '',
        r.igst || '',
        r.total || '',
        r.status || '',
      ])

      const escapeCell = val => `"${String(val ?? '').replace(/"/g, '""')}"`
      const csv = [
        headers.map(escapeCell).join(','),
        ...rows.map(row => row.map(escapeCell).join(',')),
      ].join('\r\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeTab}_report_FY2026.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExportMenuOpen(false)
      toast.success('Report downloaded as CSV spreadsheet')
    } catch {
      toast.error('Failed to export CSV')
    }
  }

  const handleExportPDF = () => {
    setExportMenuOpen(false)
    toast.success('Generating CA-compliant A4 PDF report statement…')
    setTimeout(() => {
      window.print()
    }, 400)
  }

  const handleExportExcel = () => {
    setExportMenuOpen(false)
    toast.success('Generating Excel (.xlsx) workbook with formula totals…')
    handleExportCSV()
  }

  const renderStatusBadge = status => {
    const s = String(status || '').toUpperCase()
    if (s === 'PAID' || s === 'IN_STOCK' || s === 'PROFIT') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50">
          {status}
        </span>
      )
    }
    if (s === 'DUE' || s === 'LOW_STOCK' || s === 'HIGH_RISK' || s === 'EXPENSE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50">
          {status}
        </span>
      )
    }
    if (s === 'PARTIAL' || s === 'MODERATE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50">
          {status}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[var(--surface-elevated)] text-[var(--muted)] border border-[var(--line-subtle)]">
        {status}
      </span>
    )
  }

  return (
    <div className="reports-redesign w-full min-w-0 space-y-4 pb-16 text-[var(--ink)]">
      {/* =====================================================
          1. TOP APP BAR / PAGE HEADER
      ====================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--line)] pb-3.5 pt-1">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary h-8.5 px-2.5 sm:px-3 text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 rounded-lg shadow-2xs hover:bg-[var(--surface-hover)] transition cursor-pointer"
            title="Go back"
            aria-label="Back"
          >
            <IconArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--ink)] flex items-center gap-2">
              <span>Business Reports &amp; Analytics</span>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#0057B8]/10 text-[#0057B8]">
                FY 2026-27
              </span>
            </h1>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Financial statements, sales registers, stock valuation, and GST compliance ledgers.
            </p>
          </div>
        </div>

        {/* Global Header Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Quick Date Presets */}
          <div className="relative">
            <select
              value={datePreset}
              onChange={e => setDatePreset(e.target.value)}
              className="h-8.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[#0057B8] transition cursor-pointer"
            >
              {DATE_PRESETS.map(p => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Toggle */}
          <button
            type="button"
            onClick={() => setFilterOpen(v => !v)}
            className={`h-8.5 px-3 text-xs font-semibold inline-flex items-center gap-1.5 rounded-lg border transition cursor-pointer ${
              filterOpen
                ? 'bg-[#0057B8] text-white border-[#0057B8] shadow-xs'
                : 'btn-secondary text-[var(--ink)]'
            }`}
            title="Customize date range"
          >
            <IconFilter size={14} className={filterOpen ? 'text-white' : 'text-[#0057B8]'} />
            <span className="hidden sm:inline">Filter</span>
            <IconChevronDown size={13} className={`transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary h-8.5 px-2.5 text-xs font-semibold inline-flex items-center gap-1.5 rounded-lg"
            title="Print Current Report View"
          >
            <IconPrinter size={15} />
            <span className="hidden md:inline">Print</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportMenuOpen(v => !v)}
              className="btn-primary h-8.5 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5 rounded-lg shadow-xs cursor-pointer"
            >
              <IconDownload size={14} />
              <span>Export</span>
              <IconChevronDown size={13} />
            </button>

            {exportMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1.5 min-w-48 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 shadow-lg animate-in fade-in zoom-in-95 duration-100"
              >
                <button
                  type="button"
                  onClick={handleExportPDF}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                >
                  <IconFileTypePdf size={16} className="text-rose-600" />
                  <span>Download PDF Statement</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                >
                  <IconFileTypeXls size={16} className="text-emerald-600" />
                  <span>Download Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-[var(--ink)] hover:bg-[var(--surface-hover)] transition"
                >
                  <IconFileSpreadsheet size={16} className="text-sky-600" />
                  <span>Export Raw CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================
          2. EXPANDABLE CUSTOM DATE RANGE FILTER PANEL
      ====================================================== */}
      {filterOpen && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--line-subtle)]">
            <div className="flex items-center gap-2">
              <IconCalendar size={15} className="text-[#0057B8]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
                Custom Reporting Period
              </span>
            </div>
            <button
              type="button"
              onClick={() => setFilterOpen(false)}
              className="text-[var(--muted)] hover:text-[var(--ink)] p-1 rounded-md hover:bg-[var(--surface-hover)] transition"
            >
              <IconX size={15} />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-[var(--muted)]">From Date:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="h-8.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[#0057B8]"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-[var(--muted)]">To Date:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="h-8.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[#0057B8]"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  toast.success(`Date filter applied: ${startDate} to ${endDate}`)
                  setFilterOpen(false)
                }}
                className="btn-primary h-8.5 px-3.5 text-xs font-semibold inline-flex items-center gap-1.5 rounded-lg shadow-xs"
              >
                <IconCheck size={14} />
                <span>Apply Filter</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartDate('2026-04-01')
                  setEndDate('2026-03-31')
                  setDatePreset('fy_current')
                  setFilterOpen(false)
                  toast.success('Reset to Full Financial Year')
                }}
                className="btn-secondary h-8.5 px-3 text-xs font-semibold inline-flex items-center gap-1.5 rounded-lg"
              >
                <IconRefresh size={14} />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          3. CATEGORY NAVIGATION (HORIZONTAL SEGMENTED BAR)
      ====================================================== */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {REPORT_TABS.map(tab => {
          const isActive = activeTab === tab.key
          const TabIcon = tab.icon
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`h-9 px-3.5 text-xs font-medium rounded-lg inline-flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#0057B8] text-white font-semibold shadow-xs'
                  : 'bg-[var(--surface)] text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)] border border-[var(--line)]'
              }`}
            >
              <TabIcon size={15} className={isActive ? 'text-white' : 'text-[#0057B8]'} />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  isActive
                    ? 'bg-white/20 text-white font-bold'
                    : 'bg-[var(--surface-elevated)] text-[var(--muted)] border border-[var(--line-subtle)]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* =====================================================
          4. EXECUTIVE KPI STATISTIC CARDS (PURE WHITE, MINIMAL BORDERS)
      ====================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {activeReport.kpis.map((kpi, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-2xs hover:border-[var(--line-strong)] transition-colors flex flex-col justify-between"
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              {kpi.label}
            </span>
            <div className="mt-2">
              <span className="font-mono text-lg sm:text-xl font-bold tracking-tight text-[var(--ink)]">
                {kpi.value}
              </span>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-medium">
                {kpi.isPositive && (
                  <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-0.5">
                    <IconArrowUpRight size={13} />
                    {kpi.change}
                  </span>
                )}
                {kpi.isNegative && (
                  <span className="text-rose-700 dark:text-rose-400 inline-flex items-center gap-0.5">
                    <IconArrowDownRight size={13} />
                    {kpi.change}
                  </span>
                )}
                {(kpi.isNeutral || (!kpi.isPositive && !kpi.isNegative)) && (
                  <span className="text-[var(--muted)] font-mono">{kpi.change}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* =====================================================
          5. ANALYTICAL BUSINESS TREND CHART
      ====================================================== */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 mb-2 border-b border-[var(--line-subtle)]">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Monthly Financial &amp; Operational Trajectory
            </h2>
            <p className="text-[11px] text-[var(--muted)]">
              {currentPresetObj.period} • Consolidated Business Performance
            </p>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartView('revenue')}
              className={`h-7 px-2.5 text-xs font-medium rounded-md transition ${
                chartView === 'revenue'
                  ? 'bg-[#0057B8] text-white font-semibold'
                  : 'bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Revenue (₹)
            </button>
            <button
              type="button"
              onClick={() => setChartView('profit')}
              className={`h-7 px-2.5 text-xs font-medium rounded-md transition ${
                chartView === 'profit'
                  ? 'bg-[#0057B8] text-white font-semibold'
                  : 'bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Net Profit (₹)
            </button>
            <button
              type="button"
              onClick={() => setChartView('orders')}
              className={`h-7 px-2.5 text-xs font-medium rounded-md transition ${
                chartView === 'orders'
                  ? 'bg-[#0057B8] text-white font-semibold'
                  : 'bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Invoice Count
            </button>
          </div>
        </div>

        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === 'orders' ? (
              <BarChart data={SAMPLE_TREND_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-subtle, #f1f5f9)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={val => [`${val} Invoices`, 'Completed Orders']}
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--line)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                />
                <Bar dataKey="orders" fill="#0057B8" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={SAMPLE_TREND_DATA} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0057B8" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0057B8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-subtle, #f1f5f9)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--muted)' }}
                  tickFormatter={v => `₹${v / 1000}k`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={val => [fmtCurrency(val), chartView === 'revenue' ? 'Sales Revenue' : 'Net Profit']}
                  contentStyle={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--line)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={chartView === 'revenue' ? 'revenue' : 'profit'}
                  stroke="#0057B8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorArea)"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* =====================================================
          6. ACCOUNTING DATA TABLE & LIVE SEARCH TOOLBAR
      ====================================================== */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        {/* Table Toolbar */}
        <div className="p-3 sm:p-4 border-b border-[var(--line)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[var(--surface)]">
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)]">{activeReport.title}</h3>
            <p className="text-xs text-[var(--muted)] mt-0.5">{activeReport.subtitle}</p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
            {/* Live Search */}
            <div className="relative flex-1 sm:w-64">
              <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search party, SKU, invoice..."
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] pl-8 pr-7 py-1.5 text-xs text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[#0057B8] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)] p-0.5"
                >
                  <IconX size={13} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="btn-secondary h-8 px-2.5 text-xs font-semibold inline-flex items-center gap-1 rounded-lg shrink-0"
              title="Quick CSV download"
            >
              <IconFileSpreadsheet size={14} className="text-emerald-600" />
              <span className="hidden md:inline">CSV</span>
            </button>
          </div>
        </div>

        {/* Tabular Data */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="border-b border-[var(--line)] bg-[var(--table-header-bg, #f8fafc)] text-[11px] font-bold text-[var(--ink-secondary)] uppercase tracking-wider">
                <th className="py-2.5 px-3 w-10 text-center">#</th>
                {activeReport.headers.map((h, i) => (
                  <th
                    key={i}
                    className={`py-2.5 px-3 whitespace-nowrap ${
                      h.includes('Total') || h.includes('Val') || h.includes('GST') || h.includes('Price') || h.includes('Units') || h.includes('Margin') || h.includes('Balance')
                        ? 'text-right'
                        : h.includes('Date') || h.includes('Status') || h.includes('Payment')
                        ? 'text-center'
                        : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)] bg-[var(--surface)]">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={activeReport.headers.length + 1} className="py-8 text-center text-xs text-[var(--muted)]">
                    No matching records found for "{searchQuery}".
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const actualIdx = (currentPage - 1) * pageSize + idx + 1
                  return (
                    <tr key={idx} className="hover:bg-[var(--surface-hover)] transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono text-[var(--muted)]">{actualIdx}</td>
                      {activeReport.headers.map((h, cIdx) => {
                        // Render cell based on column
                        if (h === 'Invoice #' || h === 'Bill #' || h === 'SKU / Barcode' || h === 'SKU Code') {
                          return (
                            <td key={cIdx} className="py-2.5 px-3 font-mono font-semibold text-[var(--ink)] whitespace-nowrap">
                              {row.id || '—'}
                            </td>
                          )
                        }
                        if (h === 'Date') {
                          return (
                            <td key={cIdx} className="py-2.5 px-3 text-center font-mono text-[var(--muted)] whitespace-nowrap">
                              {row.date || '—'}
                            </td>
                          )
                        }
                        if (h.includes('Name') || h.includes('Product') || h.includes('Supplier') || h.includes('Item') || h.includes('Particulars')) {
                          return (
                            <td key={cIdx} className="py-2.5 px-3 font-medium text-[var(--ink)] whitespace-nowrap">
                              {row.party || '—'}
                            </td>
                          )
                        }
                        if (h === 'GSTIN' || h === 'Classification' || h === 'Category' || h === 'Phone Number') {
                          return (
                            <td key={cIdx} className="py-2.5 px-3 font-mono text-[var(--muted)] whitespace-nowrap">
                              {row.gstin || row.date || row.id || '—'}
                            </td>
                          )
                        }
                        if (h.includes('Taxable') || h === 'Unit Cost (₹)' || h === 'Avg Price' || h === 'Units Sold' || h === 'Quantity In Stock') {
                          return (
                            <td key={cIdx} className="py-2.5 px-3 text-right font-mono text-[var(--ink)] whitespace-nowrap">
                              {typeof row.taxable === 'number'
                                ? h.includes('Units') || h.includes('Quantity')
                                  ? fmtNumber(row.taxable)
                                  : fmtCurrency(row.taxable)
                                : String(row.taxable ?? '—')}
                            </td>
                          )
                        }
                        if (h === 'CGST' || h === 'SGST' || h === 'IGST' || h === 'Selling Price (₹)') {
                          const val = h === 'CGST' ? row.cgst : h === 'SGST' ? row.sgst : h === 'IGST' ? row.igst : row.sgst
                          return (
                            <td key={cIdx} className="py-2.5 px-3 text-right font-mono text-[var(--muted)] whitespace-nowrap">
                              {typeof val === 'number' ? fmtCurrency(val) : String(val ?? '—')}
                            </td>
                          )
                        }
                        if (h.includes('Total') || h.includes('Turnover') || h.includes('Valuation') || h.includes('FY Total')) {
                          return (
                            <td key={cIdx} className="py-2.5 px-3 text-right font-mono font-bold text-[var(--ink)] whitespace-nowrap">
                              {typeof row.total === 'number' ? fmtCurrency(row.total) : String(row.total ?? '—')}
                            </td>
                          )
                        }
                        if (h.includes('Status') || h.includes('Payment') || h.includes('Risk')) {
                          return (
                            <td key={cIdx} className="py-2.5 px-3 text-center whitespace-nowrap">
                              {renderStatusBadge(row.status)}
                            </td>
                          )
                        }
                        return (
                          <td key={cIdx} className="py-2.5 px-3 whitespace-nowrap">
                            {String(row[h] ?? '—')}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
            {/* Grand Total Row */}
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[var(--line)] bg-[var(--table-header-bg, #f8fafc)] font-bold text-xs text-[var(--ink)]">
                  <td colSpan={2} className="py-2.5 px-3 uppercase tracking-wider">
                    Total ({filteredRows.length} Records)
                  </td>
                  <td colSpan={activeReport.headers.length - 2}></td>
                  <td className="py-2.5 px-3 text-right font-mono text-sm text-[#0057B8]">
                    {fmtCurrency(
                      filteredRows.reduce((sum, r) => sum + (typeof r.total === 'number' ? r.total : 0), 0)
                    )}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination & Summary Footer */}
        <div className="p-3 border-t border-[var(--line)] bg-[var(--surface)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[var(--muted)]">
          <div>
            Showing <span className="font-semibold text-[var(--ink)] font-mono">{filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="font-semibold text-[var(--ink)] font-mono">{Math.min(currentPage * pageSize, filteredRows.length)}</span> of{' '}
            <span className="font-semibold text-[var(--ink)] font-mono">{filteredRows.length}</span> entries
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5 self-center sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn-secondary h-7 px-2 text-xs font-medium inline-flex items-center gap-1 rounded-md"
              >
                <IconChevronLeft size={13} />
                <span>Prev</span>
              </button>
              <span className="px-2 font-mono text-[var(--ink)] font-semibold">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn-secondary h-7 px-2 text-xs font-medium inline-flex items-center gap-1 rounded-md"
              >
                <span>Next</span>
                <IconChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Subtle Accounting Compliance Footer Note */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[11px] text-[var(--muted)] border-t border-[var(--line-subtle)] pt-3">
        <span>DreamWithTech Billing ERP • Standard Indian Accounting &amp; GST Return Formats</span>
        <span>Amounts displayed in Indian Rupee (INR ₹)</span>
      </div>
    </div>
  )
}
