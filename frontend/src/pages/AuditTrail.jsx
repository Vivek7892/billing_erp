import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import api from '../api'
import { PageHeader, Spinner, Modal, Pagination } from '../components/UI'
import { MobileKpiGrid } from '../components/MobileUI'
import toast from 'react-hot-toast'
import {
  IconShieldCheck,
  IconSearch,
  IconX,
  IconFilter,
  IconCalendar,
  IconRotate2,
  IconArrowRight,
  IconEye,
  IconDownload,
  IconDeviceLaptop,
  IconCircleCheck,
  IconCircleX,
  IconFileText,
  IconUser,
  IconTag,
  IconLayersLinked,
  IconCopy,
  IconCheck,
  IconAlertTriangle,
  IconChevronDown,
  IconChevronUp,
  IconCreditCard,
  IconSettings,
  IconActivity,
  IconSparkles,
} from '@tabler/icons-react'

// ============================================================
// FORMATTERS & FIELD DICTIONARIES
// ============================================================

const FIELD_LABELS = {
  selling_price: 'Selling Price (₹)',
  purchase_price: 'Purchase Price (₹)',
  mrp: 'MRP (₹)',
  gst_percent: 'GST Rate (%)',
  current_stock: 'Stock Quantity',
  credit_limit: 'Credit Limit (₹)',
  balance: 'Balance (₹)',
  balance_due: 'Balance Due (₹)',
  grand_total: 'Grand Total (₹)',
  paid_amount: 'Paid Amount (₹)',
  total_amount: 'Total Amount (₹)',
  debit_amount: 'Debit Amount (₹)',
  discount_amount: 'Discount (₹)',
  is_active: 'Account Active',
  status: 'Record Status',
  sku: 'Product SKU',
  barcode: 'Barcode',
  hsn_code: 'HSN Code',
  mobile: 'Mobile Number',
  phone: 'Phone Number',
  gstin: 'GSTIN Number',
  email: 'Email Address',
  payment_method: 'Payment Method',
  cancel_reason: 'Cancellation Reason',
  role: 'User Role',
  username: 'Username',
  amount: 'Amount (₹)',
  order_id: 'Order ID',
  payment_id: 'Payment Gateway Ref',
  quantity: 'Quantity',
  adjustment: 'Stock Adjustment',
  transaction_type: 'Movement Type',
  description: 'Description',
}

const HIGH_IMPACT_ACTIONS = new Set([
  'USER_PERMISSIONS_CHANGED',
  'SETTINGS_CHANGED',
  'INVOICE_CANCELLED',
  'INVOICE_REFUNDED',
  'PRODUCT_ARCHIVED',
  'PRICE_CHANGED',
  'FINANCIAL_RESTORE_BLOCKED',
  'LOGIN_FAILED',
  'CUSTOMER_DELETED',
  'SUPPLIER_DELETED',
  'EXPENSE_DELETED',
  'PRODUCT_DELETED',
  'PAYMENT_FAILED',
])

function parseJsonSafe(val) {
  if (!val) return null
  if (typeof val === 'object') return val
  try {
    return JSON.parse(val)
  } catch {
    return val
  }
}

function fieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key]
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function isSensitiveKey(key) {
  return /(password|token|secret|api.?key|authorization|credential|signature)/i.test(String(key))
}

function formatCurrency(val) {
  const num = Number(val)
  if (isNaN(num)) return '₹0.00'
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatBusinessValue(key, val) {
  if (isSensitiveKey(key)) return '•••••••• [REDACTED]'
  if (val === null || val === undefined) return '—'
  if (val === '') return 'Empty'
  if (typeof val === 'boolean') return val ? 'Yes / Active' : 'No / Inactive'

  const lowerKey = String(key).toLowerCase()
  if (lowerKey.includes('price') || lowerKey.includes('amount') || lowerKey.includes('balance') || lowerKey.includes('mrp')) {
    const num = Number(val)
    if (!isNaN(num)) return formatCurrency(num)
  }
  if (lowerKey.includes('percent') || lowerKey.includes('gst') || lowerKey.includes('tax')) {
    const num = Number(val)
    if (!isNaN(num)) return `${num}%`
  }

  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      if (val.length === 0) return 'None'
      return `[${val.length} items]`
    }
    return Object.entries(val)
      .map(([k, v]) => `${fieldLabel(k)}: ${formatBusinessValue(k, v)}`)
      .join(', ')
  }
  return String(val)
}

function getStructuredChanges(log) {
  const beforeRaw = parseJsonSafe(log.previous_value)
  const afterRaw = parseJsonSafe(log.new_value)

  const isObj = v => v && typeof v === 'object' && !Array.isArray(v)
  const before = isObj(beforeRaw) ? beforeRaw : {}
  const after = isObj(afterRaw) ? afterRaw : {}

  const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  if (allKeys.length === 0) {
    if (log.previous_value || log.new_value) {
      return [{
        key: 'data',
        label: 'Payload',
        before: log.previous_value || '—',
        after: log.new_value || '—',
      }]
    }
    return []
  }

  return allKeys
    .filter(k => !isSensitiveKey(k))
    .filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .map(k => ({
      key: k,
      label: fieldLabel(k),
      before: formatBusinessValue(k, before[k]),
      after: formatBusinessValue(k, after[k]),
    }))
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function AuditTrail() {
  const [logs, setLogs] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [showDistribution, setShowDistribution] = useState(false)
  const [selectedLog, setSelectedLog] = useState(null)
  const [copiedKey, setCopiedKey] = useState(null)

  // Filters state
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('ALL')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [resultFilter, setResultFilter] = useState('ALL')
  const [operatorFilter, setOperatorFilter] = useState('ALL')
  const [entityFilter, setEntityFilter] = useState('ALL')
  const [datePreset, setDatePreset] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [highImpactOnly, setHighImpactOnly] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const searchInputRef = useRef(null)

  // Keyboard shortcut Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Date range presets helper
  const applyDatePreset = preset => {
    setDatePreset(preset)
    const now = new Date()
    const formatDate = d => d.toISOString().slice(0, 10)

    if (preset === 'TODAY') {
      const today = formatDate(now)
      setDateFrom(today)
      setDateTo(today)
    } else if (preset === 'YESTERDAY') {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      const yStr = formatDate(y)
      setDateFrom(yStr)
      setDateTo(yStr)
    } else if (preset === '7DAYS') {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      setDateFrom(formatDate(d))
      setDateTo(formatDate(now))
    } else if (preset === '30DAYS') {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      setDateFrom(formatDate(d))
      setDateTo(formatDate(now))
    } else if (preset === 'THIS_MONTH') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1)
      setDateFrom(formatDate(d))
      setDateTo(formatDate(now))
    } else {
      setDateFrom('')
      setDateTo('')
    }
  }

  const resetFilters = () => {
    setSearch('')
    setModuleFilter('ALL')
    setActionFilter('ALL')
    setResultFilter('ALL')
    setOperatorFilter('ALL')
    setEntityFilter('ALL')
    setDatePreset('ALL')
    setDateFrom('')
    setDateTo('')
    setHighImpactOnly(false)
    setCurrentPage(1)
  }

  // Active filter count
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (search.trim()) count++
    if (moduleFilter !== 'ALL') count++
    if (actionFilter !== 'ALL') count++
    if (resultFilter !== 'ALL') count++
    if (operatorFilter !== 'ALL') count++
    if (entityFilter !== 'ALL') count++
    if (dateFrom || dateTo) count++
    if (highImpactOnly) count++
    return count
  }, [search, moduleFilter, actionFilter, resultFilter, operatorFilter, entityFilter, dateFrom, dateTo, highImpactOnly])

  // Fetch summary from backend
  const fetchSummary = useCallback(async () => {
    try {
      const params = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (moduleFilter !== 'ALL') params.module = moduleFilter
      if (actionFilter !== 'ALL') params.action = actionFilter
      if (resultFilter !== 'ALL') params.result = resultFilter
      if (operatorFilter !== 'ALL') params.operator = operatorFilter
      if (entityFilter !== 'ALL') params.entity = entityFilter
      if (highImpactOnly) params.high_impact = 'true'
      if (search.trim()) params.search = search.trim()

      const res = await api.get('/audit-logs/summary/', { params })
      if (res.data) {
        setSummary(res.data)
      }
    } catch {
      // Quiet fallback, local stats will compute
    }
  }, [dateFrom, dateTo, moduleFilter, actionFilter, resultFilter, operatorFilter, entityFilter, highImpactOnly, search])

  // Fetch logs from backend
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page_size: 500 }
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (moduleFilter !== 'ALL') params.module = moduleFilter
      if (actionFilter !== 'ALL') params.action = actionFilter
      if (resultFilter !== 'ALL') params.result = resultFilter
      if (operatorFilter !== 'ALL') params.operator = operatorFilter
      if (entityFilter !== 'ALL') params.entity = entityFilter
      if (highImpactOnly) params.high_impact = 'true'
      if (search.trim()) params.search = search.trim()

      const res = await api.get('/audit-logs/', { params })
      let data = Array.isArray(res.data) ? res.data : [...(res.data.results || [])]
      setLogs(data)
      fetchSummary()
    } catch {
      toast.error('Failed to load audit trail events.')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, moduleFilter, actionFilter, resultFilter, operatorFilter, entityFilter, highImpactOnly, search, fetchSummary])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Client-side filtering pass
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (moduleFilter !== 'ALL' && log.module && log.module.toLowerCase() !== moduleFilter.toLowerCase()) {
        return false
      }
      if (actionFilter !== 'ALL' && log.action !== actionFilter) {
        return false
      }
      if (resultFilter !== 'ALL' && log.result !== resultFilter) {
        return false
      }
      if (operatorFilter !== 'ALL' && String(log.user || '') !== String(operatorFilter) && log.username !== operatorFilter) {
        return false
      }
      if (entityFilter !== 'ALL' && log.entity && log.entity.toLowerCase() !== entityFilter.toLowerCase()) {
        return false
      }
      if (highImpactOnly && !HIGH_IMPACT_ACTIONS.has(log.action)) {
        return false
      }

      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        String(log.id || '').toLowerCase().includes(q) ||
        (log.action && log.action.toLowerCase().includes(q)) ||
        (log.entity && log.entity.toLowerCase().includes(q)) ||
        (log.entity_name && log.entity_name.toLowerCase().includes(q)) ||
        (log.entity_id && String(log.entity_id).toLowerCase().includes(q)) ||
        (log.reason && log.reason.toLowerCase().includes(q)) ||
        (log.failure_reason && log.failure_reason.toLowerCase().includes(q)) ||
        (log.username && log.username.toLowerCase().includes(q)) ||
        (log.user_email && log.user_email.toLowerCase().includes(q)) ||
        (log.ip_address && log.ip_address.includes(q))
      )
    })
  }, [logs, moduleFilter, actionFilter, resultFilter, operatorFilter, entityFilter, highImpactOnly, search])

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, moduleFilter, actionFilter, resultFilter, operatorFilter, entityFilter, dateFrom, dateTo, highImpactOnly, pageSize])

  // Distinct operators list for dropdown
  const uniqueOperators = useMemo(() => {
    const map = new Map()
    logs.forEach(l => {
      if (l.user && l.username) {
        map.set(String(l.user), l.username)
      } else if (l.username) {
        map.set(l.username, l.username)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [logs])

  // Distinct entities for dropdown
  const uniqueEntities = useMemo(() => {
    const set = new Set()
    logs.forEach(l => {
      if (l.entity) set.add(l.entity)
    })
    return Array.from(set).sort()
  }, [logs])

  // Sliced paginated logs
  const pagedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredLogs.slice(start, start + pageSize)
  }, [filteredLogs, currentPage, pageSize])

  // Real KPI Metrics
  const metrics = useMemo(() => {
    const totalMatching = summary?.total_matching ?? filteredLogs.length
    const totalOverall = summary?.total_overall ?? logs.length
    const successCount = summary?.successful_count ?? filteredLogs.filter(l => l.result === 'success').length
    const failCount = summary?.failed_count ?? filteredLogs.filter(l => l.result === 'failure').length
    const operatorsCount = summary?.unique_operators ?? uniqueOperators.length
    const highImpactCount = summary?.high_impact_count ?? filteredLogs.filter(l => HIGH_IMPACT_ACTIONS.has(l.action)).length
    const successRate = totalMatching > 0 ? ((successCount / totalMatching) * 100).toFixed(1) : '100'

    return {
      totalMatching,
      totalOverall,
      successCount,
      failCount,
      operatorsCount,
      highImpactCount,
      successRate,
    }
  }, [summary, filteredLogs, logs, uniqueOperators])

  // Copy to clipboard helper
  const copyToClipboard = (text, key) => {
    if (!text) return
    navigator.clipboard.writeText(String(text))
    setCopiedKey(key)
    toast.success(`Copied ${key} to clipboard!`)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Export to CSV with Formula Injection Prevention
  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const params = {}
      if (dateFrom) params.date_from = dateFrom
      if (dateTo) params.date_to = dateTo
      if (moduleFilter !== 'ALL') params.module = moduleFilter
      if (actionFilter !== 'ALL') params.action = actionFilter
      if (resultFilter !== 'ALL') params.result = resultFilter
      if (operatorFilter !== 'ALL') params.operator = operatorFilter
      if (entityFilter !== 'ALL') params.entity = entityFilter
      if (highImpactOnly) params.high_impact = 'true'
      if (search.trim()) params.search = search.trim()

      const res = await api.get('/audit-logs/export/', {
        params,
        responseType: 'blob',
      })

      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Audit trail CSV exported successfully!')
    } catch {
      // Client-side fallback
      try {
        const sanitizeCell = val => {
          let str = String(val ?? '')
          if (/^[\s]*[=+@\-\t\r]/.test(str)) str = `'${str}`
          return `"${str.replace(/"/g, '""')}"`
        }
        const headers = [
          'Timestamp',
          'Operator',
          'Email',
          'Role',
          'Action',
          'Module',
          'Entity',
          'Entity ID',
          'Entity Name',
          'Outcome',
          'Reason',
          'IP Address',
        ]
        const rows = filteredLogs.map(l => [
          l.created_at,
          l.username || 'System',
          l.user_email || '',
          l.user_role || '',
          l.action,
          l.module || '',
          l.entity || '',
          l.entity_id || '',
          l.entity_name || '',
          l.result || 'success',
          l.result === 'failure' ? l.failure_reason : l.reason,
          l.ip_address || '',
        ])
        const csvContent = [headers, ...rows].map(r => r.map(sanitizeCell).join(',')).join('\r\n')
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        toast.success('Audit trail CSV generated.')
      } catch {
        toast.error('Failed to export audit CSV.')
      }
    } finally {
      setExporting(false)
    }
  }

  // Action badge renderer
  const getActionBadge = (action, result) => {
    const isFail = result === 'failure'
    if (isFail) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800">
          <IconCircleX size={12} className="shrink-0 text-rose-600 dark:text-rose-400" />
          <span className="truncate">{action}</span>
        </span>
      )
    }

    if (action.includes('PRICE')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
          <IconTag size={12} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="truncate">{action}</span>
        </span>
      )
    }

    if (action.includes('STOCK')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800">
          <IconLayersLinked size={12} className="shrink-0 text-teal-600 dark:text-teal-400" />
          <span className="truncate">{action}</span>
        </span>
      )
    }

    if (action.includes('INVOICE') || action.includes('BILL')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800">
          <IconFileText size={12} className="shrink-0 text-sky-600 dark:text-sky-400" />
          <span className="truncate">{action}</span>
        </span>
      )
    }

    if (action.includes('PAYMENT') || action.includes('REFUND')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800">
          <IconCreditCard size={12} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="truncate">{action}</span>
        </span>
      )
    }

    if (action.includes('USER') || action.includes('AUTH') || action.includes('LOGIN')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
          <IconUser size={12} className="shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span className="truncate">{action}</span>
        </span>
      )
    }

    if (action.includes('SETTING')) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
          <IconSettings size={12} className="shrink-0 text-slate-600 dark:text-slate-400" />
          <span className="truncate">{action}</span>
        </span>
      )
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
        <IconCircleCheck size={12} className="shrink-0 text-blue-600 dark:text-blue-400" />
        <span className="truncate">{action}</span>
      </span>
    )
  }

  // Concise diff preview renderer for table column #7
  const renderDiffPreview = log => {
    const prevObj = parseJsonSafe(log.previous_value)
    const newObj = parseJsonSafe(log.new_value)

    if (log.action === 'PRICE_CHANGED' && prevObj && newObj) {
      const p = prevObj.selling_price !== undefined ? prevObj.selling_price : prevObj
      const n = newObj.selling_price !== undefined ? newObj.selling_price : newObj
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
          <span className="text-rose-600 line-through dark:text-rose-400">{formatCurrency(p)}</span>
          <IconArrowRight size={10} className="text-[var(--muted)]" />
          <span className="font-bold text-teal-700 dark:text-teal-400">{formatCurrency(n)}</span>
        </span>
      )
    }

    if (log.action === 'STOCK_ADJUSTED' && prevObj && newObj) {
      const p = prevObj.current_stock ?? '—'
      const n = newObj.current_stock ?? '—'
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
          <span className="text-[var(--muted)]">{p}</span>
          <IconArrowRight size={10} className="text-[var(--muted)]" />
          <span className="font-bold text-teal-700 dark:text-teal-400">{n}</span>
        </span>
      )
    }

    if (log.action === 'USER_PERMISSIONS_CHANGED' && prevObj && newObj) {
      return (
        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
          <span className="text-[var(--muted)] uppercase">{prevObj.role || 'prev'}</span>
          <IconArrowRight size={10} className="text-[var(--muted)]" />
          <span className="font-bold text-indigo-700 dark:text-indigo-400 uppercase">{newObj.role || 'new'}</span>
        </span>
      )
    }

    const changes = getStructuredChanges(log)
    if (changes.length > 0) {
      if (changes.length === 1) {
        return (
          <span className="truncate text-[11px] text-[var(--ink)]" title={`${changes[0].label}: ${changes[0].before} → ${changes[0].after}`}>
            <span className="font-medium text-[var(--muted)]">{changes[0].label}:</span> {changes[0].after}
          </span>
        )
      }
      return (
        <span className="inline-flex items-center gap-1 rounded bg-[var(--surface-elevated)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--ink)] border border-[var(--line)]">
          {changes.length} fields modified
        </span>
      )
    }

    if (log.action.endsWith('_CREATED')) {
      return <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">+ Record Created</span>
    }
    if (log.action.endsWith('_DELETED') || log.action.endsWith('_ARCHIVED')) {
      return <span className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">- Record Deleted</span>
    }

    return <span className="text-[11px] text-[var(--muted)]">—</span>
  }

  return (
    <div className="audit-trail-page w-full min-w-0 space-y-4 pb-16 text-[var(--ink)]">
      
      {/* Top Page Header with Title, Subtitle and Export CSV */}
      <header className="flex flex-col justify-between gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Audit Trail</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Track system events, data mutations, security actions, and user activities.</p>
        </div>
     
      </header>

      {/* Audit health summary */}
      <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 shadow-xs space-y-2.5" aria-label="Audit health">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">
          <IconShieldCheck size={14} className="text-[var(--ink-secondary)]" /> Audit health
          {metrics.failCount === 0 && <span className="normal-case tracking-normal font-medium text-emerald-700 dark:text-emerald-400">· No failures detected</span>}
        </div>

        {/* Mobile KPI Grid (Displays 4 initially with Show more for 5th) */}
        <MobileKpiGrid
          title="Audit Metrics"
          allKpis={[
            {
              label: 'Failed events',
              value: metrics.failCount,
              icon: IconCircleX,
              sub: metrics.failCount ? 'Review required' : 'No failures',
              onClick: () => setResultFilter('failure'),
            },
            {
              label: 'High-impact',
              value: metrics.highImpactCount,
              icon: IconAlertTriangle,
              sub: 'Recorded changes',
              onClick: () => setHighImpactOnly(true),
            },
            {
              label: 'Matching events',
              value: Number(metrics.totalMatching) ? Number(metrics.totalMatching).toLocaleString() : metrics.totalMatching,
              icon: IconFileText,
              sub: `of ${metrics.totalOverall.toLocaleString()} total`,
            },
            {
              label: 'Success rate',
              value: `${metrics.successRate}%`,
              icon: IconCircleCheck,
              sub: `${metrics.successCount.toLocaleString()} successful`,
            },
            {
              label: 'Unique actors',
              value: metrics.operatorsCount,
              icon: IconUser,
              sub: 'Operators recorded',
            },
          ]}
        />

        {/* Desktop/Tablet Metric Grid (all 5) */}
        <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-5 gap-2">
          {[
            { label: 'Failed events', value: metrics.failCount, icon: IconCircleX, tone: metrics.failCount ? 'text-rose-700 dark:text-rose-300' : 'text-[var(--ink)]', hint: metrics.failCount ? 'Review required' : 'No failures' },
            { label: 'High-impact', value: metrics.highImpactCount, icon: IconAlertTriangle, tone: 'text-amber-700 dark:text-amber-300', hint: 'Recorded changes' },
            { label: 'Matching events', value: metrics.totalMatching, icon: IconFileText, tone: 'text-[var(--ink)]', hint: `of ${metrics.totalOverall.toLocaleString()} total` },
            { label: 'Success rate', value: `${metrics.successRate}%`, icon: IconCircleCheck, tone: 'text-emerald-700 dark:text-emerald-300', hint: `${metrics.successCount.toLocaleString()} successful` },
            { label: 'Unique actors', value: metrics.operatorsCount, icon: IconUser, tone: 'text-[var(--ink)]', hint: 'Operators recorded' },
          ].map(item => {
            const Icon = item.icon
            const Tag = item.label === 'High-impact' || item.label === 'Failed events' ? 'button' : 'div'
            return <Tag key={item.label} type={Tag === 'button' ? 'button' : undefined} onClick={item.label === 'High-impact' ? () => setHighImpactOnly(true) : item.label === 'Failed events' ? () => setResultFilter('failure') : undefined} className={`min-w-0 rounded-md border px-3 py-2 text-left ${item.label === 'Failed events' && metrics.failCount ? 'border-rose-300 bg-rose-50/70 dark:border-rose-900 dark:bg-rose-950/20' : 'border-[var(--line-subtle)] bg-[var(--surface)]'} ${Tag === 'button' ? 'cursor-pointer hover:bg-[var(--surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]' : ''}`}>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--muted)]"><Icon size={12} className={item.tone} />{item.label}</div>
              <div className={`mt-0.5 text-xl font-bold tabular-nums ${item.tone}`}>{Number(item.value) ? Number(item.value).toLocaleString() : item.value}</div>
              <div className="truncate text-[10px] text-[var(--muted)]">{item.hint}</div>
            </Tag>
          })}
        </div>
      </section>

      {/* Investigation shortcuts */}
      <div className="flex flex-col gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-xs text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mr-1 shrink-0">Investigate:</span>
          <button type="button" onClick={() => { setResultFilter('ALL'); setHighImpactOnly(false); setActionFilter('ALL'); setModuleFilter('ALL') }} className="rounded-md border border-[var(--line)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-secondary)] hover:bg-[var(--surface-elevated)]">All Events</button>

          <button
            type="button"
            onClick={() => {
              if (resultFilter === 'failure') {
                setResultFilter('ALL')
              } else {
                setResultFilter('failure')
              }
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition border ${
              resultFilter === 'failure'
                ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-700 shadow-xs'
                : 'bg-[var(--surface-elevated)] text-[var(--ink-secondary)] border-[var(--line)] hover:border-rose-300 hover:text-rose-700'
            }`}
          >
            <IconCircleX size={12} className={resultFilter === 'failure' ? 'text-rose-600' : 'text-slate-400'} />
            <span>Failed</span>
            {metrics.failCount > 0 && (
              <span className="ml-1 rounded-full bg-rose-600 text-white text-[10px] px-1.5 py-0.2">
                {metrics.failCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setHighImpactOnly(!highImpactOnly)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition border ${
              highImpactOnly
                ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700 shadow-xs'
                : 'bg-[var(--surface-elevated)] text-[var(--ink-secondary)] border-[var(--line)] hover:border-amber-300 hover:text-amber-700'
            }`}
          >
            <IconAlertTriangle size={12} className={highImpactOnly ? 'text-amber-600' : 'text-slate-400'} />
            <span>High Impact</span>
            {metrics.highImpactCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-600 text-white text-[10px] px-1.5 py-0.2">
                {metrics.highImpactCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActionFilter(actionFilter === 'PRICE_CHANGED' ? 'ALL' : 'PRICE_CHANGED')
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition border ${
              actionFilter === 'PRICE_CHANGED'
                ? 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-700 shadow-xs'
                : 'bg-[var(--surface-elevated)] text-[var(--ink-secondary)] border-[var(--line)] hover:border-teal-300 hover:text-teal-700'
            }`}
          >
            <IconTag size={12} className={actionFilter === 'PRICE_CHANGED' ? 'text-teal-600' : 'text-slate-400'} />
            <span>Price Changes</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModuleFilter(moduleFilter === 'user' ? 'ALL' : 'user')
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition border ${
              moduleFilter === 'user'
                ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-700 shadow-xs'
                : 'bg-[var(--surface-elevated)] text-[var(--ink-secondary)] border-[var(--line)] hover:border-indigo-300 hover:text-indigo-700'
            }`}
          >
            <IconUser size={12} className={moduleFilter === 'user' ? 'text-indigo-600' : 'text-slate-400'} />
            <span>Security & Users</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowDistribution(!showDistribution)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#1E3A5F] hover:text-[#162F4D] dark:text-sky-300"
        >
          <IconActivity size={13} />
          <span>{showDistribution ? 'Hide Activity Distribution' : 'Activity Distribution'}</span>
          {showDistribution ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}
        </button>
      </div>

      {/* Collapsible Activity Distribution Strip */}
      {showDistribution && summary && (
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xs space-y-3 transition">
          <div className="flex items-center justify-between border-b border-[var(--line-subtle)] pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
              <IconActivity size={14} className="text-[#1E3A5F] dark:text-sky-400" />
              Event Volume Distribution Breakdown
            </h4>
            <span className="text-[11px] text-[var(--muted)]">Based on currently matching audit logs</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top Modules */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[var(--ink-secondary)] uppercase">Top Modules</p>
              <div className="space-y-1.5">
                {(summary.by_module || []).slice(0, 5).map(m => {
                  const pct = metrics.totalMatching > 0 ? ((m.count / metrics.totalMatching) * 100).toFixed(0) : 0
                  return (
                    <div key={m.module} className="text-xs space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-medium capitalize text-[var(--ink)]">{m.module || 'Unknown'}</span>
                        <span className="font-mono text-[var(--muted)]">
                          {m.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[var(--line-subtle)] overflow-hidden">
                        <div className="h-full bg-[#1E3A5F] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top Actions */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[var(--ink-secondary)] uppercase">Top Actions</p>
              <div className="space-y-1.5">
                {(summary.by_action || []).slice(0, 5).map(a => {
                  const pct = metrics.totalMatching > 0 ? ((a.count / metrics.totalMatching) * 100).toFixed(0) : 0
                  return (
                    <div key={a.action} className="text-xs space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-mono text-[10px] text-[var(--ink)] truncate max-w-[150px]">{a.action}</span>
                        <span className="font-mono text-[var(--muted)]">
                          {a.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[var(--line-subtle)] overflow-hidden">
                        <div className="h-full bg-teal-600 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Top Operators */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-[var(--ink-secondary)] uppercase">Top Operators</p>
              <div className="space-y-1.5">
                {(summary.by_operator || []).slice(0, 5).map(u => {
                  const pct = metrics.totalMatching > 0 ? ((u.count / metrics.totalMatching) * 100).toFixed(0) : 0
                  return (
                    <div key={u.user__username} className="text-xs space-y-0.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-medium text-[var(--ink)]">{u.user__username || 'System'}</span>
                        <span className="font-mono text-[var(--muted)]">
                          {u.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[var(--line-subtle)] overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Filter Toolbar (Section C) */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 sm:p-3.5 shadow-xs space-y-3">
        {/* Quick Search bar + Mobile Filters Toggle */}
        <div className="flex items-center gap-2">
          <div className="group relative flex flex-1 items-center min-h-[40px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 transition focus-within:border-[#1E3A5F] focus-within:ring-2 focus-within:ring-[#1E3A5F]/15">
            <IconSearch size={14} className="text-[var(--muted)] shrink-0 group-focus-within:text-[#1E3A5F]" />
            <input
              ref={searchInputRef}
              type="text"
              className="w-full bg-transparent px-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--placeholder)] outline-none"
              placeholder="Search action, entity, user, IP... (Ctrl+K)"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-[var(--muted)] hover:text-[var(--ink)] p-1 rounded"
                title="Clear search"
              >
                <IconX size={13} />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setShowMobileFilters(v => !v)}
            className="lg:hidden inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--ink-secondary)] hover:bg-[var(--surface-hover)] shadow-2xs shrink-0"
            aria-label="Toggle filters"
          >
            <IconFilter size={15} />
            <span>Filters</span>
            {(moduleFilter !== 'ALL' || actionFilter !== 'ALL' || resultFilter !== 'ALL' || operatorFilter !== 'ALL' || entityFilter !== 'ALL' || dateFrom || dateTo) ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">
                !
              </span>
            ) : null}
          </button>
        </div>

        {/* Filter Dropdowns (expandable on mobile, always visible on desktop) */}
        <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block space-y-3`}>
        {/* Row 1: Module, Action, Outcome */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">

          {/* Module Filter */}
          <div className="flex items-center gap-1.5">
            <IconFilter size={14} className="text-[var(--muted)] shrink-0" />
            <select
              className="input w-full h-[40px] text-xs font-medium"
              value={moduleFilter}
              onChange={e => setModuleFilter(e.target.value)}
              aria-label="Filter module"
            >
              <option value="ALL">All Event Modules</option>
              <option value="invoice">Sales & Invoices</option>
              <option value="payment">Payments & Collections</option>
              <option value="product">Products & Pricing</option>
              <option value="inventory">Stock Movements & Inventory</option>
              <option value="purchase">Purchases & Inflows</option>
              <option value="salesreturn">Sales Returns & Refunds</option>
              <option value="customer">Customers & Parties</option>
              <option value="supplier">Suppliers</option>
              <option value="expense">Operating Expenses</option>
              <option value="setting">Business Profile & Settings</option>
              <option value="user">Users, Roles & Security</option>
              <option value="report">Statutory Reports</option>
            </select>
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-1.5">
            <IconTag size={14} className="text-[var(--muted)] shrink-0" />
            <select
              className="input w-full h-[40px] text-xs font-medium"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              aria-label="Filter action type"
            >
              <option value="ALL">All Action Types</option>
              <optgroup label="Sales & Invoices">
                <option value="INVOICE_CREATED">INVOICE_CREATED</option>
                <option value="INVOICE_CANCELLED">INVOICE_CANCELLED</option>
                <option value="INVOICE_REFUNDED">INVOICE_REFUNDED</option>
                <option value="INVOICE_EDITED">INVOICE_EDITED</option>
              </optgroup>
              <optgroup label="Payments & Financials">
                <option value="PAYMENT_RECEIVED">PAYMENT_RECEIVED</option>
                <option value="PAYMENT_COLLECTED">PAYMENT_COLLECTED</option>
                <option value="PAYMENT_RECONCILED">PAYMENT_RECONCILED</option>
                <option value="PAYMENT_FAILED">PAYMENT_FAILED</option>
                <option value="REFUND_ISSUED">REFUND_ISSUED</option>
              </optgroup>
              <optgroup label="Products & Stock">
                <option value="PRODUCT_CREATED">PRODUCT_CREATED</option>
                <option value="PRODUCT_UPDATED">PRODUCT_UPDATED</option>
                <option value="PRICE_CHANGED">PRICE_CHANGED</option>
                <option value="PRODUCT_ARCHIVED">PRODUCT_ARCHIVED</option>
                <option value="PRODUCT_RESTORED">PRODUCT_RESTORED</option>
                <option value="STOCK_ADJUSTED">STOCK_ADJUSTED</option>
              </optgroup>
              <optgroup label="Masters (Customers & Suppliers)">
                <option value="CUSTOMER_CREATED">CUSTOMER_CREATED</option>
                <option value="CUSTOMER_UPDATED">CUSTOMER_UPDATED</option>
                <option value="CUSTOMER_DELETED">CUSTOMER_DELETED</option>
                <option value="SUPPLIER_CREATED">SUPPLIER_CREATED</option>
                <option value="SUPPLIER_UPDATED">SUPPLIER_UPDATED</option>
                <option value="SUPPLIER_DELETED">SUPPLIER_DELETED</option>
              </optgroup>
              <optgroup label="Security & Administration">
                <option value="USER_LOGIN">USER_LOGIN</option>
                <option value="LOGIN_FAILED">LOGIN_FAILED</option>
                <option value="USER_CREATED">USER_CREATED</option>
                <option value="USER_UPDATED">USER_UPDATED</option>
                <option value="USER_PERMISSIONS_CHANGED">USER_PERMISSIONS_CHANGED</option>
                <option value="SETTINGS_CHANGED">SETTINGS_CHANGED</option>
                <option value="FINANCIAL_RESTORE_BLOCKED">FINANCIAL_RESTORE_BLOCKED</option>
                <option value="REPORT_EXPORTED">REPORT_EXPORTED</option>
                <option value="AUDIT_EXPORTED">AUDIT_EXPORTED</option>
              </optgroup>
            </select>
          </div>

          {/* Outcome Filter */}
          <div className="flex items-center gap-1.5">
            <IconCircleCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <select
              className="input w-full h-[40px] text-xs font-medium"
              value={resultFilter}
              onChange={e => setResultFilter(e.target.value)}
              aria-label="Filter outcome"
            >
              <option value="ALL">All Outcomes (Success & Fail)</option>
              <option value="success">Successful Events Only</option>
              <option value="failure">Failed Operations Only</option>
            </select>
          </div>
        </div>

        <details open={showAdvancedFilters} onToggle={e => setShowAdvancedFilters(e.currentTarget.open)} className="rounded-md border border-[var(--line-subtle)] px-3">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 text-xs font-semibold text-[var(--ink-secondary)]">
          <span className="inline-flex items-center gap-2"><IconFilter size={13} /> More filters</span>
          <span className="text-[10px] text-[var(--muted)]">Operator, entity and date range</span>
        </summary>
        {/* Row 2: Operator, Target Entity, Date From, Date To */}
        <div className="grid grid-cols-1 gap-2.5 pb-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Operator Filter */}
          <div className="flex items-center gap-1.5">
            <IconUser size={14} className="text-[var(--muted)] shrink-0" />
            <select
              className="input w-full h-[40px] text-xs font-medium"
              value={operatorFilter}
              onChange={e => setOperatorFilter(e.target.value)}
              aria-label="Filter operator"
            >
              <option value="ALL">All Operators / Actors</option>
              {uniqueOperators.map(op => (
                <option key={op.id} value={op.id}>
                  {op.name}
                </option>
              ))}
            </select>
          </div>

          {/* Target Entity Filter */}
          <div className="flex items-center gap-1.5">
            <IconLayersLinked size={14} className="text-[var(--muted)] shrink-0" />
            <select
              className="input w-full h-[40px] text-xs font-medium"
              value={entityFilter}
              onChange={e => setEntityFilter(e.target.value)}
              aria-label="Filter target entity"
            >
              <option value="ALL">All Target Entities</option>
              {uniqueEntities.map(ent => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div className="flex items-center gap-1.5">
            <IconCalendar size={14} className="text-[var(--muted)] shrink-0" />
            <div className="relative w-full">
              <input
                type="date"
                className="input w-full h-[40px] text-xs font-medium"
                value={dateFrom}
                onChange={e => {
                  setDateFrom(e.target.value)
                  setDatePreset('CUSTOM')
                }}
                title="Date From"
              />
              <span className="absolute -top-1.5 left-2 bg-[var(--surface)] px-1 text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
                From
              </span>
            </div>
          </div>

          {/* Date To */}
          <div className="flex items-center gap-1.5">
            <IconCalendar size={14} className="text-[var(--muted)] shrink-0" />
            <div className="relative w-full">
              <input
                type="date"
                className="input w-full h-[40px] text-xs font-medium"
                value={dateTo}
                onChange={e => {
                  setDateTo(e.target.value)
                  setDatePreset('CUSTOM')
                }}
                title="Date To"
              />
              <span className="absolute -top-1.5 left-2 bg-[var(--surface)] px-1 text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">
                To
              </span>
            </div>
          </div>
        </div>
        </details>

        {/* Row 3: Date Presets & Filter Counters Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line-subtle)] pt-3 text-xs">
          {/* Date Presets Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mr-1 shrink-0">Date:</span>
            {[
              { id: 'ALL', label: 'All Time' },
              { id: 'TODAY', label: 'Today' },
              { id: 'YESTERDAY', label: 'Yesterday' },
              { id: '7DAYS', label: 'Last 7 Days' },
              { id: '30DAYS', label: 'Last 30 Days' },
              { id: 'THIS_MONTH', label: 'This Month' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyDatePreset(p.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition whitespace-nowrap ${
                  datePreset === p.id
                    ? 'bg-[#1E3A5F] text-white font-semibold'
                    : 'bg-[var(--surface-elevated)] text-[var(--ink-secondary)] hover:bg-[var(--line-subtle)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Active Filters Clear Button */}
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#1E3A5F] border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                  <IconSparkles size={11} />
                  {activeFiltersCount} active {activeFiltersCount === 1 ? 'filter' : 'filters'}
                </span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300 transition"
                >
                  <IconRotate2 size={11} /> Clear All
                </button>
              </div>
            ) : (
              <span className="text-[11px] text-[var(--muted)]">No active filters applied</span>
            )}
          </div>
        </div>
        </div>
      </div>

      {/* Main Table Container (Section E) */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-[var(--muted)] space-y-2">
            <Spinner />
            <p className="text-xs">Loading statutory audit logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-[var(--muted)] space-y-2">
            <IconShieldCheck size={32} className="mx-auto opacity-40 text-[#1E3A5F] dark:text-slate-400" />
            <p className="text-sm font-bold text-[var(--ink)]">No audit events match your criteria</p>
            <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
              Try adjusting your search query, clearing event filters, or broadening the date range.
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface-elevated)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--line-subtle)]"
            >
              <IconRotate2 size={12} /> Reset all filters
            </button>
          </div>
        ) : (
          <>
            {/* Responsive investigation cards */}
            <div className="divide-y divide-[var(--line-subtle)] lg:hidden">
              {pagedLogs.map(log => (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="p-3.5 space-y-2.5 active:bg-[var(--surface-elevated)] transition cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {getActionBadge(log.action, log.result)}
                      <span className="block mt-1 text-[11px] font-mono text-[var(--muted)]">
                        {log.created_at
                          ? new Date(log.created_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        setSelectedLog(log)
                      }}
                      className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-[#1E3A5F] px-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#162F4D]"
                    >
                      <IconEye size={12} /> View
                    </button>
                  </div>

                  <div className="text-xs">
                    <div className="font-bold text-[var(--ink)]">{log.entity_name || log.entity_id || 'System Entity'}</div>
                    <div className="text-[11px] text-[var(--muted)]">
                      {log.entity || log.module || ''} {log.entity_id ? `(#${log.entity_id})` : ''}
                    </div>
                  </div>

                  {/* Changes preview */}
                  <div className="text-xs bg-[var(--surface-elevated)] p-2 rounded border border-[var(--line)]">
                    {renderDiffPreview(log)}
                  </div>

                  {/* Reason */}
                  {(log.reason || log.failure_reason) && (
                    <div
                      className={`text-[11px] px-2 py-1 rounded border italic ${
                        log.result === 'failure'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
                          : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                      }`}
                    >
                      "{log.failure_reason || log.reason}"
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-[var(--muted)] pt-1 border-t border-[var(--line-subtle)]">
                    <div className="flex items-center gap-1">
                      <IconUser size={12} className="text-[#1E3A5F] dark:text-slate-300" />
                      <span className="font-semibold text-[var(--ink)]">{log.username || 'System'}</span>
                      {log.user_role && (
                        <span className="text-[9px] uppercase px-1 rounded bg-[var(--surface-elevated)] border border-[var(--line)]">
                          {log.user_role}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px]">{log.ip_address || '—'}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Dense ERP table for wide screens */}
            <div className="hidden lg:block overflow-x-auto min-h-[220px] pb-2">
              <table className="erp-table w-full text-xs text-left" style={{ tableLayout: 'fixed', minWidth: '1040px' }}>
                <colgroup>
                  <col style={{ width: '140px' }} /> {/* 1. Timestamp */}
                  <col style={{ width: '140px' }} /> {/* 2. Operator */}
                  <col style={{ width: '175px' }} /> {/* 3. Action */}
                  <col style={{ width: '160px' }} /> {/* 4. Target Entity */}
                  <col style={{ width: '100px' }} /> {/* 5. Outcome */}
                  <col style={{ width: '190px' }} /> {/* 6. Changes */}
                  <col style={{ width: '125px' }} /> {/* 7. Source */}
                  <col style={{ width: '75px' }} />  {/* 8. Details */}
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--line)] bg-[var(--surface-elevated)] font-bold text-[var(--ink-secondary)] select-none">
                    <th className="py-3 px-3 text-left">Time</th>
                    <th className="py-3 px-3 text-left">Operator</th>
                    <th className="py-3 px-3 text-left">Action</th>
                    <th className="py-3 px-3 text-left">Target Entity</th>
                    <th className="py-3 px-3 text-center">Result</th>
                    <th className="py-3 px-3 text-left">Change</th>
                    <th className="py-3 px-3 text-center">Source</th>
                    <th className="py-3 px-3 text-center">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {pagedLogs.map(log => (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`hover:bg-[var(--surface-elevated)]/75 transition-colors cursor-pointer group ${log.result === 'failure' ? 'border-l-2 border-l-rose-500' : HIGH_IMPACT_ACTIONS.has(log.action) ? 'border-l-2 border-l-amber-500' : ''}`}
                    >
                      {/* 1. Timestamp (Left-aligned, tabular nums) */}
                      <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-[var(--ink-secondary)]">
                        <div
                          className="truncate"
                          title={log.created_at ? new Date(log.created_at).toISOString() : ''}
                        >
                          {log.created_at
                            ? new Date(log.created_at).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })
                            : '—'}
                        </div>
                      </td>

                      {/* 2. Operator (Left-aligned, user icon + name + role) */}
                      <td className="py-3 px-3 whitespace-nowrap text-left">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <IconUser size={13} className="text-[#1E3A5F] dark:text-sky-300 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-bold text-[var(--ink)] truncate block">
                              {log.username || 'System'}
                            </span>
                            {log.user_role && (
                              <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--muted)] font-semibold">
                                {log.user_role}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3. Action (Left-aligned, high-contrast badge) */}
                      <td className="py-3 px-3 whitespace-nowrap text-left">
                        {getActionBadge(log.action, log.result)}
                        {(log.failure_reason || log.reason) && <div className={`mt-1 max-w-[165px] truncate text-[10px] ${log.result === 'failure' ? 'font-semibold text-rose-700 dark:text-rose-300' : 'text-[var(--muted)]'}`} title={log.failure_reason || log.reason}>{log.failure_reason || log.reason}</div>}
                      </td>

                      {/* 4. Target Entity (Left-aligned, entity name primary, entity type secondary) */}
                      <td className="py-3 px-3 whitespace-nowrap text-left">
                        <div className="font-bold text-[var(--ink)] truncate" title={log.entity_name || log.entity_id}>
                          {log.entity_name || (log.entity_id ? `#${log.entity_id}` : '—')}
                        </div>
                        <div className="text-[10px] text-[var(--muted)] truncate">
                          {log.entity || log.module || ''} {log.entity_id && log.entity_name ? `(#${log.entity_id})` : ''}
                        </div>
                      </td>

                      {/* 5. Outcome (Center-aligned, Success/Fail badge) */}
                      <td className="py-3 px-3 whitespace-nowrap text-center">
                        {log.result === 'failure' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-700">
                            <IconCircleX size={11} className="text-rose-600" />
                            Failure
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700">
                            <IconCircleCheck size={11} className="text-emerald-600" />
                            Success
                          </span>
                        )}
                      </td>

                      {/* 6. Changes (readable diff preview) */}
                      <td className="py-3 px-3 text-left whitespace-nowrap">
                        {renderDiffPreview(log)}
                      </td>

                      {/* 8. IP / Device (Center-aligned, laptop icon + IP) */}
                      <td className="py-3 px-3 whitespace-nowrap text-center text-[11px] font-mono text-[var(--muted)]">
                        <div className="inline-flex items-center gap-1">
                          <IconDeviceLaptop size={11} className="text-[var(--muted)] shrink-0" />
                          <span>{log.ip_address || '—'}</span>
                        </div>
                      </td>

                      {/* 9. Details (Center-aligned, View button) */}
                      <td className="py-3 px-3 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedLog(log)
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold text-[#1E3A5F] hover:bg-slate-100 dark:text-sky-300 dark:hover:bg-slate-800 transition"
                        >
                          <IconEye size={12} />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer with Pagination & Page Size Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--muted)]">
              {/* Page size selector */}
              <div className="flex items-center gap-1.5">
                <span>Show</span>
                <select
                  className="input h-7 px-2 text-xs font-semibold"
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>rows per page</span>
              </div>

              {/* Pagination controls */}
              <Pagination
                currentPage={currentPage}
                totalPages={Math.max(1, Math.ceil(filteredLogs.length / pageSize))}
                totalItems={filteredLogs.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                className="border-t-0 p-0"
              />
            </div>
          </>
        )}
      </div>

      {/* Detailed Event Modal with 7 Structured Sections (Section G) */}
      {selectedLog && (
        <Modal
          open={Boolean(selectedLog)}
          onClose={() => setSelectedLog(null)}
          title={`Audit Record #${selectedLog.id} — ${selectedLog.action}`}
        >
          <div className="space-y-4 text-xs">
            {/* Section 1: Event Summary Banner */}
            <div
              className={`p-3.5 rounded-lg border flex flex-wrap items-center justify-between gap-3 ${
                selectedLog.result === 'failure'
                  ? 'bg-rose-50/70 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800'
                  : 'bg-[var(--surface-elevated)] border-[var(--line)]'
              }`}
            >
              <div className="flex items-center gap-2">
                {getActionBadge(selectedLog.action, selectedLog.result)}
                <span className="font-mono text-[11px] text-[var(--muted)]">ID: #{selectedLog.id}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-[var(--ink-secondary)]">
                  {selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString('en-IN') : '—'}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(selectedLog.id, 'Log ID')}
                  className="p-1 rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)] transition"
                  title="Copy log ID"
                >
                  {copiedKey === 'Log ID' ? <IconCheck size={13} className="text-emerald-600" /> : <IconCopy size={13} />}
                </button>
              </div>
            </div>

            {/* Grid: Operator Details & Target Entity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Section 2: Operator Details */}
              <div className="p-3.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                    <IconUser size={12} className="text-[#1E3A5F] dark:text-sky-300" /> Operator Attribution
                  </span>
                  {selectedLog.username && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedLog.username, 'Username')}
                      className="text-[var(--muted)] hover:text-[var(--ink)]"
                      title="Copy username"
                    >
                      {copiedKey === 'Username' ? <IconCheck size={11} className="text-emerald-600" /> : <IconCopy size={11} />}
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-[var(--ink)]">{selectedLog.username || 'System Automation'}</p>
                  <p className="text-[11px] text-[var(--muted)] font-mono">{selectedLog.user_email || 'No email recorded'}</p>
                  <div className="pt-1">
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--ink-secondary)]">
                      Role: {selectedLog.user_role || 'Staff'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Target Entity */}
              <div className="p-3.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                    <IconLayersLinked size={12} className="text-[#0F766E] dark:text-teal-300" /> Target Entity
                  </span>
                  {selectedLog.entity_id && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(selectedLog.entity_id, 'Entity ID')}
                      className="text-[var(--muted)] hover:text-[var(--ink)]"
                      title="Copy Entity ID"
                    >
                      {copiedKey === 'Entity ID' ? <IconCheck size={11} className="text-emerald-600" /> : <IconCopy size={11} />}
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-[var(--ink)]">{selectedLog.entity_name || `#${selectedLog.entity_id || 'System'}`}</p>
                  <p className="text-[11px] text-[var(--muted)]">
                    Module: <strong className="text-[var(--ink)] capitalize">{selectedLog.module || selectedLog.entity || 'General'}</strong>
                  </p>
                  <div className="pt-1">
                    <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-mono bg-[var(--surface-elevated)] border border-[var(--line)] text-[var(--ink-secondary)]">
                      Entity ID: {selectedLog.entity_id || '—'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Recorded Business Changes (Human-Readable Diff Table) */}
            <div className="rounded-lg border border-[var(--line)] overflow-hidden">
              <div className="bg-[var(--surface-elevated)] px-3.5 py-2.5 border-b border-[var(--line)] flex items-center justify-between">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
                  <IconActivity size={13} className="text-teal-600" /> Recorded Business Field Changes
                </h4>
                <span className="text-[10px] text-[var(--muted)]">Zero raw JSON • Formatted Indian currency (₹)</span>
              </div>

              {getStructuredChanges(selectedLog).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="erp-table w-full text-xs text-left">
                    <thead className="bg-[var(--surface)] text-[10px] font-bold uppercase text-[var(--muted)] border-b border-[var(--line-subtle)]">
                      <tr>
                        <th className="py-2 px-3 w-1/3">Business Attribute</th>
                        <th className="py-2 px-3 w-1/3">Previous Recorded Value</th>
                        <th className="py-2 px-3 w-1/3">Updated Recorded Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line-subtle)]">
                      {getStructuredChanges(selectedLog).map(change => (
                        <tr key={change.key} className="hover:bg-[var(--surface-elevated)]/50">
                          <td className="py-2.5 px-3 font-semibold text-[var(--ink)]">{change.label}</td>
                          <td className="py-2.5 px-3 font-mono text-[var(--muted)] line-through break-all">
                            {change.before}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-teal-700 dark:text-teal-400 break-all">
                            {change.after}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : selectedLog.new_value && selectedLog.action.endsWith('_CREATED') ? (
                <div className="p-3.5 space-y-2">
                  <p className="text-[11px] text-[var(--muted)]">Initial state captured upon record creation:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[var(--surface)] p-3 rounded border border-[var(--line-subtle)]">
                    {Object.entries(parseJsonSafe(selectedLog.new_value) || {}).map(([k, v]) => (
                      <div key={k} className="text-xs">
                        <span className="font-semibold text-[var(--muted)] block text-[10px] uppercase">
                          {fieldLabel(k)}
                        </span>
                        <span className="font-mono text-[var(--ink)] break-all">{formatBusinessValue(k, v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-[var(--muted)]">
                  No structural before-and-after attribute changes were recorded for this transaction.
                </div>
              )}
            </div>

            {/* Section 5: Reason & Justification */}
            <div className="p-3.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
                Reason / Statutory Justification
              </span>
              <p className="p-2.5 rounded bg-[var(--surface-elevated)] border border-[var(--line)] font-medium text-[var(--ink)] italic text-xs leading-relaxed">
                "{selectedLog.failure_reason || selectedLog.reason || 'Standard business transaction. No special override justification was required.'}"
              </p>
            </div>

            {/* Section 6: Network & Device Client */}
            <div className="p-3.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                  <IconDeviceLaptop size={12} className="text-[#1E3A5F] dark:text-sky-300" /> Network Client & Device Details
                </span>
                {selectedLog.ip_address && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedLog.ip_address, 'IP Address')}
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    {copiedKey === 'IP Address' ? (
                      <IconCheck size={11} className="text-emerald-600" />
                    ) : (
                      <IconCopy size={11} />
                    )}
                    <span>Copy IP</span>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-[var(--muted)] uppercase font-semibold">IP Address</span>
                  <p className="font-mono text-[var(--ink)]">{selectedLog.ip_address || 'Not recorded'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--muted)] uppercase font-semibold">Result Outcome</span>
                  <p className="font-semibold uppercase text-xs text-[var(--ink)]">{selectedLog.result || 'Success'}</p>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-[10px] text-[var(--muted)] uppercase font-semibold">Client User Agent</span>
                  <p
                    className="font-mono text-[11px] text-[var(--muted)] truncate p-1.5 rounded bg-[var(--surface-elevated)] border border-[var(--line-subtle)]"
                    title={selectedLog.user_agent}
                  >
                    {selectedLog.user_agent || 'Standard Web Browser'}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 7: Safe Metadata & Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--line)]">
              <div className="text-[10px] text-[var(--muted)] font-mono">
                ISO Timestamp: {selectedLog.created_at || '—'}
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="min-h-[36px] rounded-lg bg-[#1E3A5F] px-4 text-xs font-semibold text-white hover:bg-[#162F4D] transition shadow-xs"
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
